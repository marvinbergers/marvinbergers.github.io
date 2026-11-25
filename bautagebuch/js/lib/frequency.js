// Häufig benutzte Gewerke nach vorn, damit die üblichen Knöpfe oben stehen.

export function countUsage(fotos) {
  const m = new Map();
  for (const f of fotos ?? []) if (f.gewerk_id) m.set(f.gewerk_id, (m.get(f.gewerk_id) ?? 0) + 1);
  return [...m].map(([gewerk_id, anzahl]) => ({ gewerk_id, anzahl }));
}

export function sortByFrequency(gewerke, nutzungen) {
  const n = new Map((nutzungen ?? []).map((x) => [x.gewerk_id, x.anzahl]));
  return [...gewerke].sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || (a.sortierung ?? 0) - (b.sortierung ?? 0));
}
