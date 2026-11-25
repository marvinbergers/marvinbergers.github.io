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

/** Wand-Stelle finden oder anlegen. Gleichzeitige Aufrufe teilen sich eine Anfrage. */
export function ensureWand(api, etage, raum, wand) {
  const kante = wand.seite === 'wand' ? wand.kante : null;
  const k = `${raum.id}|${wand.seite}|${kante ?? ''}`;
  if (!laufend.has(k)) {
    const p = (async () => {
      const finde = async () => (await api.list('stellen', { raum_id: raum.id, seite: wand.seite, kante })).find(Boolean) ?? null;
      const da = await finde();
      if (da) return da;
      try {
        return await api.insert('stellen', { etage_id: etage.id, raum_id: raum.id, seite: wand.seite, kante, name: wandTitel(raum, wand, etage) });
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

/** Raum mit neuen Ecken speichern. umzuege: [{von, nach}] aus gelöschten Ecken – Fotos ziehen auf die zusammengelegte Wand. */
export async function speichereRaum(api, etage, raum, ecken, umzuege = []) {
  const normiert = uhrzeigersinn(ecken);
  await api.update('raeume', raum.id, { ecken: normiert, pruefen: false });
  const neu = { ...raum, ecken: normiert };
  for (const { von, nach } of umzuege) {
    const alt = (await api.list('stellen', { raum_id: raum.id, seite: 'wand', kante: von }))[0];
    if (!alt) continue;
    const ziel = await ensureWand(api, etage, neu, { seite: 'wand', kante: nach });
    await mergeStellen(api, alt.id, ziel.id);
  }
}

/** Raum löschen: Fotos seiner Wände zurück in den Eingang, Wände und Raum in den Papierkorb. */
export async function deleteRaum(api, raum) {
  for (const st of await api.list('stellen', { raum_id: raum.id })) {
    for (const f of await api.list('fotos', { stelle_id: st.id })) await api.update('fotos', f.id, { stelle_id: null });
    await api.softDelete('stellen', st.id);
  }
  await api.softDelete('raeume', raum.id);
}
