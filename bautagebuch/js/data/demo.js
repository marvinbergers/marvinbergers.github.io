// Beispieldaten für die Vorschau ohne Server. Rein erfunden, keine echten Hausdaten.
export function demoSeed() {
  return {
    gewerke: [
      { id: 'g1', bereich: 'Technik', name: 'Elektro', din276: '440', eigenleistung: true, sortierung: 1 },
      { id: 'g2', bereich: 'Technik', name: 'Heizung und Sanitär', din276: '420', eigenleistung: true, sortierung: 2 },
      { id: 'g3', bereich: 'Ausbau', name: 'Trockenbau', din276: '340', eigenleistung: false, sortierung: 3 },
      { id: 'g4', bereich: 'Rohbau', name: 'Bodenplatte', din276: '320', eigenleistung: false, sortierung: 4 },
      { id: 'g5', bereich: 'Ausbau', name: 'Maler', din276: '340', eigenleistung: true, sortierung: 5 },
      { id: 'g6', bereich: 'Ausbau', name: 'Fliesen', din276: '350', eigenleistung: false, sortierung: 6 },
    ],
    etagen: [{ id: 'e1', name: 'EG', sortierung: 1, plan_key: 'plaene/demo-eg.svg', plan_breite: 1000, plan_hoehe: 700, nord_grad: 0 }],
    raeume: [
      { id: 'r-bad', etage_id: 'e1', name: 'Bad', flaechen: [{ x1: 2, y1: 3, x2: 38, y2: 46 }] },
      { id: 'r-kue', etage_id: 'e1', name: 'Küche', flaechen: [{ x1: 38, y1: 3, x2: 98, y2: 46 }] },
      { id: 'r-flu', etage_id: 'e1', name: 'Flur', flaechen: [{ x1: 2, y1: 46, x2: 38, y2: 97 }] },
      { id: 'r-woh', etage_id: 'e1', name: 'Wohnen', flaechen: [{ x1: 38, y1: 46, x2: 98, y2: 97 }] },
    ],
    personen: [{ name: 'Person A', ist_nutzer: true, nutzer_id: 'u1' }, { name: 'Person B', ist_nutzer: true }],
    firmen: [{ name: 'Elektro Muster GmbH', gewerk_id: 'g1' }],
  };
}

/** Erfundener Beispiel-Grundriss als SVG (4 Räume). */
export function demoBlobs() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><rect width="1000" height="700" fill="#fff"/>
<g fill="none" stroke="#333" stroke-width="10"><rect x="20" y="20" width="960" height="660"/><path d="M380 20v300M20 320h960M380 420v260M600 320v-120"/></g>
<g font-family="sans-serif" font-size="34" fill="#777"><text x="120" y="190">Bad</text><text x="640" y="190">Küche</text><text x="120" y="540">Flur</text><text x="640" y="540">Wohnen</text></g></svg>`;
  return { 'plaene/demo-eg.svg': new Blob([svg], { type: 'image/svg+xml' }) };
}
