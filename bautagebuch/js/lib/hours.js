// Stunden-Auswertung. Erfasst ist nur, was jemand eingetragen hat – nichts wird hochgerechnet.

const add = (m, k, v) => m.set(k, (m.get(k) ?? 0) + v);
const absteigend = (m, feld) => [...m].map(([k, stunden]) => ({ [feld]: k, stunden })).sort((a, b) => b.stunden - a.stunden);

export function summarizeHours(anwesenheit, tage, personen = [], gewerke = []) {
  const datum = new Map(tage.map((t) => [t.id, t.datum]));
  const pName = new Map(personen.map((p) => [p.id, p.name]));
  const gName = new Map(gewerke.map((g) => [g.id, g.name]));
  const proPerson = new Map(); const proMonat = new Map(); const proGewerk = new Map(); const erfasst = new Set();
  for (const a of anwesenheit) {
    if (a.stunden == null || !a.person_id) continue; // Firmenstunden sind keine Eigenleistung
    erfasst.add(a.tag_id);
    add(proPerson, pName.get(a.person_id) ?? 'Unbekannt', a.stunden);
    add(proMonat, (datum.get(a.tag_id) ?? '').slice(0, 7), a.stunden);
    add(proGewerk, gName.get(a.gewerk_id) ?? 'ohne Gewerk', a.stunden);
  }
  return {
    proPerson: absteigend(proPerson, 'name'),
    proMonat: [...proMonat].map(([monat, stunden]) => ({ monat, stunden })).sort((a, b) => a.monat.localeCompare(b.monat)),
    proGewerk: absteigend(proGewerk, 'gewerk'),
    erfassteTage: erfasst.size,
    tageGesamt: tage.length,
  };
}

export function hoursLabel(erfasst, gesamt) {
  return `an ${erfasst} von ${gesamt} ${gesamt === 1 ? 'Tag' : 'Tagen'} erfasst`;
}
