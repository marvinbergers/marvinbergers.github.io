// Gewerk und Phase: immer bewusst wählen, nie vorausgewählt. Gespeichert wird, sobald beides gewählt ist.
import { html } from '../vendor/htm.js';
import { useState, useEffect } from '../vendor/preact.js';

const SICHTBAR = 5;

export function CategoryPicker({ gewerke = [], phasen = [], onComplete, vorschau = null, titel = null }) {
  const [gewerk, setGewerk] = useState(null);
  const [phase, setPhase] = useState(null);
  const [alle, setAlle] = useState(false);
  const [notizOffen, setNotizOffen] = useState(false);
  const [notiz, setNotiz] = useState('');
  const [fertig, setFertig] = useState(false);

  useEffect(() => {
    if (gewerk && phase && !fertig) { setFertig(true); onComplete({ gewerk_id: gewerk, phase_id: phase, notiz: notiz.trim() }); }
  }, [gewerk, phase]);

  const sichtbar = alle ? gewerke : gewerke.slice(0, SICHTBAR);
  return html`<div class="picker">
    ${titel && html`<h3>${titel}</h3>`}
    ${vorschau && html`<img class="picker-vorschau" src=${vorschau} alt="Aufgenommenes Foto" />`}
    <h4>Gewerk</h4>
    <div class="knopfgitter gewerke">
      ${sichtbar.map((g) => html`<button data-id=${g.id} aria-pressed=${gewerk === g.id ? 'true' : 'false'} onClick=${() => setGewerk(g.id)}>${g.name}</button>`)}
      ${!alle && gewerke.length > SICHTBAR && html`<button class="mehr" onClick=${() => setAlle(true)}>mehr…</button>`}
    </div>
    <h4>Phase</h4>
    <div class="knopfgitter phasen">
      ${phasen.map((p) => html`<button data-id=${p.id} aria-pressed=${phase === p.id ? 'true' : 'false'} onClick=${() => setPhase(p.id)}>${p.name}</button>`)}
    </div>
    ${notizOffen
      ? html`<textarea name="notiz" placeholder="Notiz (optional)" onInput=${(e) => setNotiz(e.target.value)}>${notiz}</textarea>`
      : html`<button class="link" onClick=${() => setNotizOffen(true)}>+ Notiz</button>`}
  </div>`;
}
