import { describe, it, expect, beforeEach } from 'vitest';
import { freshDb, als, FAMILIE, FREMD } from './helpers.js';

let db;
beforeEach(async () => {
  db = await freshDb();
  await db.query(`insert into erlaubte_nutzer(email) values ($1)`, [FAMILIE.email]);
});

const TABELLEN = ['personen', 'firmen', 'gewerke', 'phasen', 'etagen', 'raeume', 'stellen', 'fotos',
  'tage', 'tag_abschnitte', 'anwesenheit', 'dokumente', 'einstellungen', 'aenderungen', 'erlaubte_nutzer'];

describe('Zugriffsregeln', () => {
  it('fremder Nutzer sieht nichts', async () => {
    await als(db, FREMD, async (tx) => {
      expect((await tx.query('select count(*)::int n from phasen')).rows[0].n).toBe(0);
      expect((await tx.query('select count(*)::int n from fotos')).rows[0].n).toBe(0);
    });
    await expect(als(db, FREMD, (tx) => tx.query(`insert into tage(datum) values ('2027-03-17')`)))
      .rejects.toThrow(/row-level security/);
  });

  it('anon sieht nichts', async () => {
    await als(db, null, async (tx) => {
      for (const t of TABELLEN) {
        const r = await tx.query(`select count(*)::int n from ${t}`).catch(() => ({ rows: [{ n: 0 }] }));
        expect(r.rows[0].n, t).toBe(0);
      }
    });
  });

  it('Familienmitglied darf alles', async () => {
    await als(db, FAMILIE, async (tx) => {
      const e = await tx.query(`insert into etagen(name, sortierung) values ('EG', 1) returning id`);
      const s = await tx.query(`insert into stellen(etage_id, name, x, y, richtung_grad) values ($1,'Bad – Ostwand',10,20,90) returning id`, [e.rows[0].id]);
      await tx.query(`update stellen set name = 'Bad – Nordwand' where id = $1`, [s.rows[0].id]);
      await tx.query(`update stellen set geloescht_am = now() where id = $1`, [s.rows[0].id]);
      expect((await tx.query('select count(*)::int n from stellen')).rows[0].n).toBe(1);
    });
  });

  it('E-Mail-Vergleich ignoriert Groß-/Kleinschreibung', async () => {
    await als(db, { ...FAMILIE, email: 'EINS@Example.org' }, async (tx) => {
      expect((await tx.query('select count(*)::int n from phasen')).rows[0].n).toBe(6);
    });
  });
});

describe('Verlauf, Papierkorb, Stammdaten', () => {
  it('Verlauf protokolliert Änderungen', async () => {
    await als(db, FAMILIE, async (tx) => {
      const t = await tx.query(`insert into tage(datum) values ('2027-03-17') returning id`);
      const a = await tx.query(`insert into tag_abschnitte(tag_id, typ, text) values ($1,'arbeiten','alt') returning id`, [t.rows[0].id]);
      await tx.query(`update tag_abschnitte set text = 'neu' where id = $1`, [a.rows[0].id]);
      const v = await tx.query(`select aktion, vorher, nachher, von from aenderungen where datensatz_id = $1 and aktion = 'update'`, [a.rows[0].id]);
      expect(v.rows).toHaveLength(1);
      expect(v.rows[0].vorher.text).toBe('alt');
      expect(v.rows[0].nachher.text).toBe('neu');
      expect(v.rows[0].von).toBe(FAMILIE.sub);
    });
  });

  it('Papierkorb blendet in der aktiv-Sicht aus', async () => {
    await als(db, FAMILIE, async (tx) => {
      const e = await tx.query(`insert into etagen(name, sortierung) values ('EG', 1) returning id`);
      const s = await tx.query(`insert into stellen(etage_id, name, x, y, richtung_grad) values ($1,'X',1,1,0) returning id`, [e.rows[0].id]);
      await tx.query(`update stellen set geloescht_am = now() where id = $1`, [s.rows[0].id]);
      expect((await tx.query('select count(*)::int n from stellen_aktiv')).rows[0].n).toBe(0);
      expect((await tx.query('select count(*)::int n from stellen')).rows[0].n).toBe(1);
    });
  });

  it('Phasen-Seed in fester Reihenfolge', async () => {
    const r = await als(db, FAMILIE, (tx) => tx.query('select name from phasen order by sortierung'));
    expect(r.rows.map((x) => x.name)).toEqual(['Bestand vor Umbau', 'Abbruch', 'Rohbau', 'Installation', 'Verschlossen', 'Fertig']);
  });

  it('erstellt_von und geaendert_von werden automatisch gesetzt', async () => {
    await als(db, FAMILIE, async (tx) => {
      const r = await tx.query(`insert into firmen(name) values ('Elektro Test') returning erstellt_von, geaendert_von`);
      expect(r.rows[0].erstellt_von).toBe(FAMILIE.sub);
      expect(r.rows[0].geaendert_von).toBe(FAMILIE.sub);
    });
  });

  it('Foto-Hash ist eindeutig (Duplikate)', async () => {
    await als(db, FAMILIE, async (tx) => {
      await tx.query(`insert into fotos(sha256, aufgenommen_am, tag) values ('abc', now(), '2027-03-17')`);
    });
    await expect(als(db, FAMILIE, (tx) => tx.query(`insert into fotos(sha256, aufgenommen_am, tag) values ('abc', now(), '2027-03-17')`)))
      .rejects.toMatchObject({ code: '23505' });
  });
});

describe('Personen ↔ Anmeldung', () => {
  it('verknuepfe_mich() verbindet die eigene Person über die E-Mail', async () => {
    await als(db, FAMILIE, async (tx) => {
      await tx.query(`insert into personen(name, email, ist_nutzer) values ('Person A', 'Eins@Example.org', true)`);
      await tx.query(`select verknuepfe_mich()`);
      const r = await tx.query(`select nutzer_id from personen where name = 'Person A'`);
      expect(r.rows[0].nutzer_id).toBe(FAMILIE.sub);
    });
  });
});

describe('Checkliste', () => {
  it('Fotos können einem Kontrollpunkt zugeordnet werden (auch in der aktiv-Sicht)', async () => {
    await als(db, FAMILIE, async (tx) => {
      await tx.query(`insert into fotos(sha256, aufgenommen_am, tag, checkpunkt) values ('c', now(), '2027-03-17', 'Bodenplatte: vor dem Betonieren')`);
      const r = await tx.query(`select checkpunkt from fotos_aktiv`);
      expect(r.rows[0].checkpunkt).toBe('Bodenplatte: vor dem Betonieren');
    });
  });
});
