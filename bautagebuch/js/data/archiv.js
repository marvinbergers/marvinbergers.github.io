// Archiv eines Monats direkt aus der App: daten.json + Fotos des Monats als ZIP.
// (Das komplette Archiv wäre im Browser zu groß – dafür gibt es den wöchentlichen Export.)
import { zipSync, strToU8 } from '../vendor/fflate.js';

const TABELLEN = ['etagen', 'raeume', 'stellen', 'gewerke', 'phasen', 'personen', 'firmen', 'fotos', 'tage', 'tag_abschnitte', 'anwesenheit', 'dokumente'];

export async function monatsArchiv(api, monat, getBlob) {
  const t = Object.fromEntries(await Promise.all(TABELLEN.map(async (n) => [n, await api.list(n)])));
  const fotos = t.fotos.filter((f) => `${f.tag}`.startsWith(monat));
  const tageImMonat = new Set(t.tage.filter((x) => `${x.datum}`.startsWith(monat)).map((x) => x.id));
  const daten = { ...t, fotos, tage: t.tage.filter((x) => tageImMonat.has(x.id)),
    tag_abschnitte: t.tag_abschnitte.filter((a) => tageImMonat.has(a.tag_id)), anwesenheit: t.anwesenheit.filter((a) => tageImMonat.has(a.tag_id)) };
  const dateien = { 'daten.json': strToU8(JSON.stringify(daten, null, 2)) };
  for (const f of fotos) dateien[`${f.tag}_${f.id}.jpg`] = new Uint8Array(await (await getBlob(f.key_bild)).arrayBuffer());
  return { name: `Bautagebuch-${monat}.zip`, daten: zipSync(dateien, { level: 0 }) };
}
