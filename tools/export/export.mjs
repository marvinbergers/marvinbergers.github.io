// Wöchentlicher Archiv-Export (läuft auf dem PC des Admins, siehe README.md).
// Erzeugt eine Ordnerstruktur, die ohne die App lesbar bleibt, und leert den Papierkorb nach 90 Tagen.
import { mkdirSync, writeFileSync, existsSync, readFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fotoDateiname, stellenOrdner, sauber } from './paths.mjs';
import { tagebuchPdf } from './pdf.mjs';
import { raumPunkt } from '../../bautagebuch/js/lib/polygon.js';

const TAG_MS = 86_400_000;
const TABELLEN = ['etagen', 'raeume', 'stellen', 'gewerke', 'phasen', 'personen', 'firmen', 'fotos', 'tage', 'tag_abschnitte', 'anwesenheit', 'dokumente', 'einstellungen'];
// Reihenfolge fürs endgültige Löschen: abhängige Tabellen zuerst.
const LOESCHFOLGE = ['fotos', 'tag_abschnitte', 'anwesenheit', 'dokumente', 'stellen', 'raeume', 'firmen', 'personen', 'gewerke', 'phasen', 'etagen'];
const DATEI_SCHLUESSEL = ['key_bild', 'key_vorschau', 'key', 'plan_key', 'bestand_key'];

const schreibe = (pfad, inhalt) => { mkdirSync(dirname(pfad), { recursive: true }); writeFileSync(pfad, inhalt); };

export async function runExport({ ziel, db, storage, now = () => new Date(), log = () => {} }) {
  await papierkorbLeeren({ db, storage, now, log });
  const t = Object.fromEntries(await Promise.all(TABELLEN.map(async (n) => [n, await db.all(n)])));
  const aktiv = (n) => t[n].filter((r) => !r.geloescht_am);
  schreibe(join(ziel, 'daten.json'), JSON.stringify(t, null, 2));

  // Fotos: stabile Dateinamen über einen Index, damit nichts doppelt geladen wird.
  const indexPfad = join(ziel, '.export-index.json');
  const index = existsSync(indexPfad) ? JSON.parse(readFileSync(indexPfad, 'utf8')) : {};
  const byId = (n) => new Map(t[n].map((r) => [r.id, r]));
  const etagen = byId('etagen'); const stellen = byId('stellen'); const raeume = byId('raeume'); const gewerke = byId('gewerke'); const phasen = byId('phasen');
  const belegt = new Set(Object.values(index));
  let geladen = 0;
  for (const f of aktiv('fotos').sort((a, b) => `${a.aufgenommen_am}`.localeCompare(`${b.aufgenommen_am}`))) {
    const st = stellen.get(f.stelle_id);
    const ordner = st ? stellenOrdner(etagen.get(st.etage_id), st, raeume.get(st.raum_id)) : 'Eingang';
    const vorhanden = index[f.id];
    if (vorhanden && dirname(vorhanden) === ordner && existsSync(join(ziel, vorhanden))) continue;
    let nr = 1; let rel;
    do { rel = `${ordner}/${fotoDateiname(f, gewerke.get(f.gewerk_id), phasen.get(f.phase_id), nr++)}`; } while (belegt.has(rel) || existsSync(join(ziel, rel)));
    if (vorhanden && existsSync(join(ziel, vorhanden))) { mkdirSync(join(ziel, ordner), { recursive: true }); renameSync(join(ziel, vorhanden), join(ziel, rel)); }
    else { schreibe(join(ziel, rel), await storage.get(f.key_bild)); geladen++; }
    belegt.add(rel); index[f.id] = rel;
  }
  schreibe(indexPfad, JSON.stringify(index, null, 1));

  // Grundrisse mit eingezeichneten Stellen (SVG, im Browser lesbar).
  for (const e of aktiv('etagen')) {
    if (!e.plan_key) continue;
    const bild = Buffer.from(await storage.get(e.plan_key)).toString('base64');
    const mime = e.plan_key.endsWith('.svg') ? 'image/svg+xml' : e.plan_key.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const w = e.plan_breite || 1000; const h = e.plan_hoehe || 700;
    // Räume als Flächen mit Name und Fotozahl
    const zahl = new Map();
    for (const f of aktiv('fotos')) { const st = stellen.get(f.stelle_id); if (st?.raum_id) zahl.set(st.raum_id, (zahl.get(st.raum_id) ?? 0) + 1); }
    const l = w / 45;
    const marken = aktiv('raeume').filter((r) => r.etage_id === e.id && r.ecken?.length >= 3).map((r) => {
      const pts = r.ecken.map((p) => `${(p.x / 100) * w},${(p.y / 100) * h}`).join(' ');
      const m = raumPunkt(r, w / h) ?? r.ecken[0]; const cx = (m.x / 100) * w; const cy = (m.y / 100) * h;
      return `<g><polygon points="${pts}" fill="#2f5d5022" stroke="#2f5d50" stroke-width="${l / 6}"/>`
        + `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="${l}" font-family="sans-serif" fill="#1f2421">${esc(r.name)}${zahl.get(r.id) ? ` (${zahl.get(r.id)} Fotos)` : ''}</text></g>`;
    }).join('');
    schreibe(join(ziel, 'Grundrisse', `${sauber(e.name)}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><image href="data:${mime};base64,${bild}" width="${w}" height="${h}"/>${marken}</svg>`);
  }

  // Tagebuch-PDF
  const fotosNachTag = new Map();
  for (const f of aktiv('fotos')) {
    if (!fotosNachTag.has(f.tag)) fotosNachTag.set(f.tag, new Map());
    const m = fotosNachTag.get(f.tag); const k = f.stelle_id ?? null;
    if (!m.has(k)) m.set(k, []); m.get(k).push(f);
  }
  const gruppiert = new Map([...fotosNachTag].map(([tag, m]) => [tag, [...m].map(([stelle_id, fotos]) => ({ stelle_id, fotos }))]));
  schreibe(join(ziel, 'Tagebuch.pdf'), await tagebuchPdf({
    tage: aktiv('tage'), abschnitte: aktiv('tag_abschnitte'), anwesenheit: aktiv('anwesenheit'), personen: t.personen, firmen: t.firmen,
    fotosNachTag: gruppiert, ladeVorschau: (f) => storage.get(f.key_vorschau), stellenName: (id) => stellen.get(id)?.name ?? 'Eingang',
  }));
  log(`Export fertig: ${geladen} neue Fotos.`);
  return { geladen };
}

const esc = (s) => `${s}`.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

export async function papierkorbLeeren({ db, storage, now, log = () => {} }) {
  const grenze = now().getTime() - 90 * TAG_MS;
  for (const n of LOESCHFOLGE) {
    const alt = (await db.all(n)).filter((r) => r.geloescht_am && new Date(r.geloescht_am).getTime() < grenze);
    if (!alt.length) continue;
    for (const r of alt) for (const k of DATEI_SCHLUESSEL) if (r[k]) await storage.delete(r[k]).catch(() => {});
    try { await db.hardDelete(n, alt.map((r) => r.id)); log(`${n}: ${alt.length} endgültig gelöscht`); }
    catch (e) { log(`${n}: übersprungen (${e.message})`); } // z. B. noch verknüpft
  }
}

// ---- Kommandozeile: node tools/export/export.mjs --ziel "D:\OneDrive\...\Bautagebuch-Archiv"
async function main() {
  const hier = dirname(fileURLToPath(import.meta.url));
  const envDatei = join(hier, '.env');
  if (existsSync(envDatei)) for (const z of readFileSync(envDatei, 'utf8').split(/\r?\n/)) { const m = z.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, ''); }
  const ziel = process.argv[process.argv.indexOf('--ziel') + 1];
  if (!process.argv.includes('--ziel') || !ziel) { console.error('Aufruf: node tools/export/export.mjs --ziel "<Ordner>"'); process.exit(2); }
  const env = (k) => { if (!process.env[k]) { console.error(`Fehlt in tools/export/.env: ${k}`); process.exit(2); } return process.env[k]; };
  const { createClient } = await import('@supabase/supabase-js');
  const { AwsClient } = await import('aws4fetch');
  process.env.SUPABASE_SECRET_KEY ??= process.env.SUPABASE_SERVICE_ROLE_KEY; // alter Name als Rückfall
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), { auth: { persistSession: false } });
  const r2 = new AwsClient({ accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' });
  const endpunkt = (process.env.R2_ENDPOINT ?? `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`).replace(/\/+$/, '');
  const basis = `${endpunkt}/${env('R2_BUCKET')}`;
  const url = (key) => `${basis}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const db = {
    async all(n) {
      const rows = [];
      for (let von = 0; ; von += 1000) {
        const { data, error } = await sb.from(n).select('*').range(von, von + 999);
        if (error) throw error; rows.push(...data); if (data.length < 1000) return rows;
      }
    },
    async hardDelete(n, ids) { const { error } = await sb.from(n).delete().in('id', ids); if (error) throw error; },
  };
  const storage = {
    async get(key) { const r = await r2.fetch(url(key)); if (!r.ok) throw new Error(`${key}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); },
    async delete(key) { await r2.fetch(url(key), { method: 'DELETE' }); },
  };
  await runExport({ ziel, db, storage, log: console.log });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e); process.exit(1); });
