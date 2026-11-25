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
      { etage_id: 'e1', name: 'Bad', x: 18, y: 25 }, { etage_id: 'e1', name: 'Küche', x: 70, y: 25 },
      { etage_id: 'e1', name: 'Flur', x: 18, y: 70 }, { etage_id: 'e1', name: 'Wohnen', x: 70, y: 70 },
    ],
    personen: [{ name: 'Person A', ist_nutzer: true }, { name: 'Person B', ist_nutzer: true }],
    firmen: [{ name: 'Elektro Muster GmbH', gewerk_id: 'g1' }],
  };
}
