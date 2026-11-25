// Tage im Bautagebuch: Zuordnung immer nach deutscher Zeit.
const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/** YYYY-MM-DD in Europe/Berlin. */
export function berlinDate(d) { return fmt.format(d); }

/** Fotos je Tag, darin je Stelle (Eingang = stelle_id null, zuletzt). Tage aufsteigend. */
export function groupFotosByDay(fotos) {
  const tage = new Map();
  for (const f of [...fotos].sort((a, b) => `${a.tag}`.localeCompare(`${b.tag}`))) {
    if (!tage.has(f.tag)) tage.set(f.tag, new Map());
    const st = tage.get(f.tag);
    const k = f.stelle_id ?? null;
    if (!st.has(k)) st.set(k, []);
    st.get(k).push(f);
  }
  const out = new Map();
  for (const [tag, st] of tages(tage)) {
    out.set(tag, [...st].map(([stelle_id, fs]) => ({ stelle_id, fotos: fs })).sort((a, b) => (a.stelle_id === null) - (b.stelle_id === null)));
  }
  return out;
}
const tages = (m) => m.entries();

/** Anzeige „Mi, 17.03.2027“. */
export function formatTag(datum) {
  const d = new Date(`${datum}T12:00:00Z`);
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(d);
}
