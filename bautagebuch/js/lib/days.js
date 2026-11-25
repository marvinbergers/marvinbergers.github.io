// Tage im Bautagebuch: Zuordnung immer nach deutscher Zeit.
const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/** YYYY-MM-DD in Europe/Berlin. */
export function berlinDate(d) { return fmt.format(d); }
