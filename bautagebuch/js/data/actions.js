// Fachliche Aktionen über mehrere Tabellen, unabhängig von der Datenschicht.

/** Legt Stelle quelle in ziel zusammen: Fotos umhängen, Quelle in den Papierkorb. */
export async function mergeStellen(api, quelleId, zielId) {
  if (quelleId === zielId) return;
  for (const f of await api.list('fotos', { stelle_id: quelleId })) await api.update('fotos', f.id, { stelle_id: zielId });
  await api.softDelete('stellen', quelleId);
}
