import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runExport } from '../../tools/export/export.mjs';
import { monatsArchiv } from '../../bautagebuch/js/data/archiv.js';
import { unzipSync, strFromU8 } from 'fflate';

const TAG = 86_400_000;
const jetzt = new Date('2027-06-01T10:00:00Z');
const jpg = readFileSync('tests/fixtures/ohne-exif.jpg');

function quelle() {
  const tables = {
    erlaubte_nutzer: [{ email: 'geheim@example.org' }],
    etagen: [{ id: 'e1', name: 'EG', plan_key: 'plaene/e1.png', plan_breite: 100, plan_hoehe: 50 }],
    raeume: [{ id: 'r1', etage_id: 'e1', name: 'Bad', flaechen: [{ x1: 0, y1: 0, x2: 20, y2: 30 }] }],
    stellen: [{ id: 's1', etage_id: 'e1', name: 'Bad – Ostwand', raum_id: 'r1', seite: 'rechts' }],
    gewerke: [{ id: 'g1', name: 'Elektro' }], phasen: [{ id: 'p4', name: 'Installation', sortierung: 4 }],
    fotos: [
      { id: 'f1', stelle_id: 's1', gewerk_id: 'g1', phase_id: 'p4', tag: '2027-03-17', aufgenommen_am: '2027-03-17T09:00:00Z', key_bild: 'fotos/f1.jpg', key_vorschau: 'fotos/f1_v.jpg' },
      { id: 'f2', stelle_id: null, tag: '2027-03-18', aufgenommen_am: '2027-03-18T09:00:00Z', key_bild: 'fotos/f2.jpg', key_vorschau: 'fotos/f2_v.jpg' },
      { id: 'alt', stelle_id: null, tag: '2027-01-01', key_bild: 'fotos/alt.jpg', key_vorschau: 'fotos/alt_v.jpg', geloescht_am: new Date(jetzt - 100 * TAG).toISOString() },
      { id: 'neu-geloescht', stelle_id: null, tag: '2027-05-01', key_bild: 'fotos/ng.jpg', key_vorschau: 'fotos/ng_v.jpg', geloescht_am: new Date(jetzt - 10 * TAG).toISOString() },
    ],
    tage: [{ id: 't1', datum: '2027-03-17', wetter: { text: 'Regen', tmin: 2, tmax: 8 } }],
    tag_abschnitte: [{ id: 'a1', tag_id: 't1', typ: 'arbeiten', text: 'Leitungen im Bad verlegt – äöüß' }],
    anwesenheit: [], personen: [], firmen: [], dokumente: [], einstellungen: [],
  };
  const db = { all: vi.fn(async (t) => tables[t] ?? []), hardDelete: vi.fn(async (t, ids) => { tables[t] = tables[t].filter((r) => !ids.includes(r.id)); }) };
  const storage = { get: vi.fn(async () => jpg), delete: vi.fn(async () => {}) }; // Node-Buffer wie von fs
  return { tables, db, storage };
}

let ziel;
beforeEach(() => { ziel = mkdtempSync(join(tmpdir(), 'archiv-')); });

describe('runExport', () => {
  it('legt die Archivstruktur an', async () => {
    const { db, storage } = quelle();
    await runExport({ ziel, db, storage, now: () => jetzt });
    expect(existsSync(join(ziel, 'Stellen/EG/Bad – Ostwand/2027-03-17_Elektro_Installation_01.jpg'))).toBe(true);
    expect(readdirSync(join(ziel, 'Eingang'))).toEqual(['2027-03-18_01.jpg']);
    const pdf = readFileSync(join(ziel, 'Tagebuch.pdf'));
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.toString('latin1')).toMatch(/\/Subtype\s*\/Image/); // Vorschaubilder sind eingebettet
    const svg = readFileSync(join(ziel, 'Grundrisse/EG.svg'), 'utf8');
    expect(svg).toContain('Bad');
    expect(svg).not.toContain('NaN');
  });

  it('daten.json enthält alles außer der Freigabeliste', async () => {
    const { db, storage } = quelle();
    await runExport({ ziel, db, storage, now: () => jetzt });
    const daten = JSON.parse(readFileSync(join(ziel, 'daten.json'), 'utf8'));
    expect(daten.erlaubte_nutzer).toBeUndefined();
    expect(daten.fotos.length).toBeGreaterThan(0);
    expect(JSON.stringify(daten)).not.toContain('geheim@example.org');
  });

  it('zweiter Lauf lädt keine vorhandenen Fotos neu', async () => {
    const { db, storage } = quelle();
    await runExport({ ziel, db, storage, now: () => jetzt });
    const fotoAbrufe = () => storage.get.mock.calls.filter(([k]) => k.startsWith('fotos/') && !k.endsWith('_v.jpg')).length;
    const vorher = fotoAbrufe();
    await runExport({ ziel, db, storage, now: () => jetzt });
    expect(fotoAbrufe()).toBe(vorher);
  });

  it('löscht endgültig nur, was länger als 90 Tage im Papierkorb liegt', async () => {
    const { db, storage, tables } = quelle();
    await runExport({ ziel, db, storage, now: () => jetzt });
    expect(tables.fotos.map((f) => f.id)).toEqual(['f1', 'f2', 'neu-geloescht']);
    expect(storage.delete).toHaveBeenCalledWith('fotos/alt.jpg');
    expect(storage.delete).toHaveBeenCalledWith('fotos/alt_v.jpg');
    expect(storage.delete).not.toHaveBeenCalledWith('fotos/ng.jpg');
  });
});

describe('Archiv in der App (ein Monat als ZIP)', () => {
  it('enthält daten.json und genau die Fotos des Monats', async () => {
    const api = { list: async (t) => quelle().tables[t].filter((r) => !r.geloescht_am) };
    const zip = await monatsArchiv(api, '2027-03', async () => new Blob(['x']));
    const inhalt = unzipSync(zip.daten);
    expect(zip.name).toBe('Bautagebuch-2027-03.zip');
    expect(Object.keys(inhalt).sort()).toEqual(['2027-03-17_f1.jpg', '2027-03-18_f2.jpg', 'daten.json']);
    expect(JSON.parse(strFromU8(inhalt['daten.json'])).tage[0].datum).toBe('2027-03-17');
  });
});
