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

describe('Altbestand (gezogene Stellen) wird bei 0006 umgestellt', () => {
  it('Fotos in den Eingang, alte Stellen in den Papierkorb', async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const { readFileSync, readdirSync } = await import('node:fs');
    const alt = new PGlite();
    await alt.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
    const dateien = readdirSync('supabase/migrations').sort();
    for (const f of dateien.filter((f) => f < '0006')) await alt.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
    const e = (await alt.query(`insert into etagen(name) values ('EG') returning id`)).rows[0].id;
    const s = (await alt.query(`insert into stellen(etage_id, name, x, y, richtung_grad) values ($1, 'Bad – Ostwand', 1, 1, 90) returning id`, [e])).rows[0].id;
    await alt.query(`insert into fotos(stelle_id, sha256, aufgenommen_am, tag) values ($1, 'z', now(), '2026-11-25')`, [s]);
    for (const f of dateien.filter((f) => f >= '0006')) await alt.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
    expect((await alt.query(`select stelle_id from fotos`)).rows[0].stelle_id).toBeNull();
    expect((await alt.query(`select geloescht_am from stellen`)).rows[0].geloescht_am).not.toBeNull();
  });
});

describe('0007: Räume als Vieleck', () => {
  async function vor0007(fn) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { readFileSync, readdirSync } = await import('node:fs');
    const d = new PGlite();
    await d.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;`);
    const dateien = readdirSync('supabase/migrations').sort();
    for (const f of dateien.filter((f) => f < '0007')) await d.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
    await fn(d);
    for (const f of dateien.filter((f) => f >= '0007')) await d.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
    return d;
  }

  it('Rechteck-Raum → 4 Ecken; Wandfotos bleiben an der passenden Linie', async () => {
    let raum; const st = {};
    const d = await vor0007(async (db0) => {
      const e = (await db0.query(`insert into etagen(name) values ('EG') returning id`)).rows[0].id;
      raum = (await db0.query(`insert into raeume(etage_id, name, flaechen) values ($1,'Bad','[{"x1":10,"y1":20,"x2":30,"y2":40}]') returning id`, [e])).rows[0].id;
      for (const s of ['oben', 'rechts', 'unten', 'links', 'boden']) {
        st[s] = (await db0.query(`insert into stellen(etage_id, name, raum_id, seite) values ($1,'x',$2,$3) returning id`, [e, raum, s])).rows[0].id;
      }
    });
    const r = (await d.query(`select ecken, pruefen from raeume where id = $1`, [raum])).rows[0];
    expect(r.ecken).toEqual([{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 30, y: 20 }, { id: 'c', x: 30, y: 40 }, { id: 'd', x: 10, y: 40 }]);
    expect(r.pruefen).toBe(false);
    const get = async (id) => (await d.query(`select seite, kante from stellen where id = $1`, [id])).rows[0];
    expect(await get(st.oben)).toEqual({ seite: 'wand', kante: 'a' });
    expect(await get(st.rechts)).toEqual({ seite: 'wand', kante: 'b' });
    expect(await get(st.unten)).toEqual({ seite: 'wand', kante: 'c' });
    expect(await get(st.links)).toEqual({ seite: 'wand', kante: 'd' });
    expect(await get(st.boden)).toEqual({ seite: 'boden', kante: null });
  });

  it('Raum aus mehreren Rechtecken → umschließender Umriss, „bitte prüfen“', async () => {
    let raum;
    const d = await vor0007(async (db0) => {
      const e = (await db0.query(`insert into etagen(name) values ('EG') returning id`)).rows[0].id;
      raum = (await db0.query(`insert into raeume(etage_id, name, flaechen) values ($1,'L','[{"x1":0,"y1":0,"x2":20,"y2":10},{"x1":0,"y1":10,"x2":10,"y2":30}]') returning id`, [e])).rows[0].id;
    });
    const r = (await d.query(`select ecken, pruefen from raeume where id = $1`, [raum])).rows[0];
    expect(r.ecken.map((p) => [p.x, p.y])).toEqual([[0, 0], [20, 0], [20, 30], [0, 30]]);
    expect(r.pruefen).toBe(true);
  });

  it('eine aktive Wand je Raum und Kante', async () => {
    await als(db, FAMILIE, async (tx) => {
      const e = (await tx.query(`insert into etagen(name) values ('EG') returning id`)).rows[0].id;
      const r = (await tx.query(`insert into raeume(etage_id, name, ecken) values ($1,'Bad','[{"id":"a","x":0,"y":0},{"id":"b","x":1,"y":0},{"id":"c","x":1,"y":1}]') returning id`, [e])).rows[0].id;
      await tx.query(`insert into stellen(etage_id, name, raum_id, seite, kante) values ($1,'x',$2,'wand','a')`, [e, r]);
      await tx.query(`insert into stellen(etage_id, name, raum_id, seite, kante) values ($1,'x',$2,'wand','b')`, [e, r]);
      await tx.query('savepoint s');
      await expect(tx.query(`insert into stellen(etage_id, name, raum_id, seite, kante) values ($1,'x',$2,'wand','a')`, [e, r])).rejects.toMatchObject({ code: '23505' });
      await tx.query('rollback to savepoint s');
      await tx.query(`insert into stellen(etage_id, name, raum_id, seite) values ($1,'x',$2,'boden')`, [e, r]);
      await tx.query('savepoint t');
      await expect(tx.query(`insert into stellen(etage_id, name, raum_id, seite) values ($1,'x',$2,'boden')`, [e, r])).rejects.toMatchObject({ code: '23505' });
      await tx.query('rollback to savepoint t');
    });
  });
});
