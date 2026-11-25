import { wandTitel } from '../lib/rooms.js';

// Fachliche Aktionen über mehrere Tabellen, unabhängig von der Datenschicht.

/** Legt Stelle quelle in ziel zusammen: Fotos umhängen, Quelle in den Papierkorb. */
export async function mergeStellen(api, quelleId, zielId) {
  if (quelleId === zielId) return;
  for (const f of await api.list('fotos', { stelle_id: quelleId })) await api.update('fotos', f.id, { stelle_id: zielId });
  await api.softDelete('stellen', quelleId);
}


const laufend = new Map();

/** Wand-Stelle (Raum + Seite) finden oder anlegen. Gleichzeitige Aufrufe teilen sich eine Anfrage. */
export function ensureWand(api, etage, raum, seite) {
  const k = `${raum.id}|${seite}`;
  if (!laufend.has(k)) {
    const p = (async () => {
      const finde = async () => (await api.list('stellen', { raum_id: raum.id, seite }))[0] ?? null;
      const da = await finde();
      if (da) return da;
      try {
        return await api.insert('stellen', { etage_id: etage.id, raum_id: raum.id, seite, name: wandTitel(raum, seite, etage.nord_grad ?? 0) });
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
