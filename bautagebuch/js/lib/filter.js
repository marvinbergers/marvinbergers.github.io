// Auswahl- und Filterlogik für den Grundriss.

/** Zuletzt benutzte Etage, sonst die erste nach Sortierung. */
export function pickEtage(etagen, letzteId) {
  const sortiert = [...(etagen ?? [])].sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));
  return sortiert.find((e) => e.id === letzteId) ?? sortiert[0] ?? null;
}

/** Ohne Filter alle Stellen; mit Filter nur Stellen, die mindestens ein passendes Foto haben. */
export function filterStellen(stellen, fotos, filter = {}) {
  const aktiv = Object.entries(filter).filter(([, v]) => v);
  if (aktiv.length === 0) return stellen;
  const treffer = new Set(fotos.filter((f) => aktiv.every(([k, v]) => f[k] === v)).map((f) => f.stelle_id));
  return stellen.filter((s) => treffer.has(s.id));
}
