// Fachliche Aktionen über mehrere Tabellen, unabhängig von der Datenschicht.
import { wandNamen, uhrzeigersinn } from '../lib/polygon.js';

/** Legt Stelle quelle in ziel zusammen: Fotos umhängen, Quelle in den Papierkorb. */
export async function mergeStellen(api, quelleId, zielId) {
  if (quelleId === zielId) return;
  for (const f of await api.list('fotos', { stelle_id: quelleId })) await api.update('fotos', f.id, { stelle_id: zielId });
  await api.softDelete('stellen', quelleId);
}

export const aspectVon = (etage) => (etage?.plan_breite && etage?.plan_hoehe ? etage.plan_breite / etage.plan_hoehe : 1);

/** „Bad – Nordwand 2“ – immer aus Form und Nordpfeil berechnet. wand = { seite: 'wand', kante } | { seite: 'boden'|'decke' } */
export function wandName(raum, wand, etage) {
  if (wand.seite === 'boden') return 'Boden';
  if (wand.seite === 'decke') return 'Decke';
  return (raum.ecken?.length >= 3 && wandNamen(raum, etage?.nord_grad ?? 0, aspectVon(etage)).get(wand.kante)) || 'Wand';
}
export const wandTitel = (raum, wand, etage) => `${raum.name} – ${wandName(raum, wand, etage)}`;

const laufend = new Map();

/** Kante nach gelöschten Ecken auflösen (Alias-Kette); null, wenn die Wand nicht mehr zuzuordnen ist. */
export function resolveKante(raum, kante) {
  const ids = new Set((raum.ecken ?? []).map((p) => p.id));
  if (!ids.size) return kante; // Raum noch ohne Ecken bekannt: nichts auflösen
  let k = kante; const gesehen = new Set();
  while (k && !ids.has(k)) {
    if (gesehen.has(k)) return null;
    gesehen.add(k); k = raum.kanten_alias?.[k] ?? null;
  }
  return k;
}

async function frischerRaum(api, raum) {
  try { return (await api.list('raeume', { id: raum.id }))[0] ?? null; } catch { return undefined; } // undefined = offline
}

/** Wand-Stelle finden oder anlegen. Gleichzeitige Aufrufe teilen sich eine Anfrage.
 *  Kennt das Gerät eine inzwischen gelöschte Ecke, landet das Foto auf der zusammengelegten Wand. */
export function ensureWand(api, etage, raum, wand) {
  const k = `${raum.id}|${wand.seite}|${wand.kante ?? ''}`;
  if (!laufend.has(k)) {
    const p = (async () => {
      let r = raum; let kante = wand.seite === 'wand' ? wand.kante : null;
      if (wand.seite === 'wand') {
        const frisch = await frischerRaum(api, raum);
        if (frisch) r = { ...raum, ...frisch };
        kante = resolveKante(r, kante);
        if (!kante) throw Object.assign(new Error('Diese Wand gibt es nicht mehr.'), { code: 'WAND_FEHLT' });
      }
      const finde = async () => (await api.list('stellen', { raum_id: r.id, seite: wand.seite, kante })).find(Boolean) ?? null;
      const da = await finde();
      if (da) return da;
      try {
        return await api.insert('stellen', { etage_id: etage.id, raum_id: r.id, seite: wand.seite, kante, name: wandTitel(r, { seite: wand.seite, kante }, etage) });
      } catch (e) {
        if (e?.code !== '23505') throw e;
        const jetzt = await finde(); // anderes Gerät war schneller
        if (jetzt) return jetzt;
        throw e;
      }
    })().finally(() => laufend.delete(k));
    laufend.set(k, p);
  }
  return laufend.get(k);
}

/** Für das Hochladen offline aufgenommener Fotos: Wand anlegen/finden; null, wenn Raum oder Wand nicht mehr existiert (→ Eingang). */
export async function wandFuerSync(api, w) {
  const raum = (await api.list('raeume', { id: w.raum_id }))[0];
  if (!raum) return null;
  const etage = (await api.list('etagen', { id: raum.etage_id }))[0] ?? { id: w.etage_id, nord_grad: w.nord_grad };
  try { return await ensureWand(api, etage, raum, { seite: w.seite, kante: w.kante }); } catch (e) { if (e?.code === 'WAND_FEHLT') return null; throw e; }
}

/** Raum mit neuen Ecken speichern. umzuege: [{von, nach}] aus gelöschten Ecken.
 *  Reihenfolge: erst Fotos umziehen (bleiben bei Abbruch sichtbar), dann die Form. Fremde Änderungen werden nicht überschrieben. */
export async function speichereRaum(api, etage, raum, ecken, umzuege = []) {
  const aktuell = (await api.list('raeume', { id: raum.id }))[0];
  if (aktuell && JSON.stringify(aktuell.ecken ?? null) !== JSON.stringify(raum.ecken ?? null)) {
    throw new Error('Der Raum wurde inzwischen auf einem anderen Gerät geändert. Bitte Editor schließen und neu öffnen.');
  }
  const normiert = uhrzeigersinn(ecken);
  const alias = { ...(aktuell?.kanten_alias ?? raum.kanten_alias ?? {}) };
  for (const { von, nach } of umzuege) {
    for (const [k, v] of Object.entries(alias)) if (v === von) alias[k] = nach;
    alias[von] = nach;
  }
  for (const { von, nach } of umzuege) {
    const alt = (await api.list('stellen', { raum_id: raum.id, seite: 'wand', kante: von }))[0];
    if (!alt) continue;
    const ziel = await ensureWand(api, etage, { ...raum, ecken: [...(raum.ecken ?? []), ...normiert] }, { seite: 'wand', kante: nach });
    await mergeStellen(api, alt.id, ziel.id);
  }
  await api.update('raeume', raum.id, { ecken: normiert, kanten_alias: alias, pruefen: false });
}

/** Raum löschen: Fotos seiner Wände zurück in den Eingang, Wände und Raum in den Papierkorb. */
export async function deleteRaum(api, raum) {
  for (const st of await api.list('stellen', { raum_id: raum.id })) {
    for (const f of await api.list('fotos', { stelle_id: st.id })) await api.update('fotos', f.id, { stelle_id: null });
    await api.softDelete('stellen', st.id);
  }
  await api.softDelete('raeume', raum.id);
}
