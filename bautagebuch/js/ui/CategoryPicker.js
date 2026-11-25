// Gewerk und Phase: freiwillig, nie vorausgewählt. Gespeichert wird mit „Speichern“.
import { html } from '../vendor/htm.js';
import { useState } from '../vendor/preact.js';

const SICHTBAR = 5;

// start: aktueller Stand beim nachträglichen Ändern (bei neuen Fotos leer – nie vorausgewählt).
export function CategoryPicker({ gewerke = [], phasen = [], onComplete, vorschau = null, titel = null, start = null }) {
  const [gewerk, setGewerk] = useState(start?.gewerk_id ?? null);
  const [phase, setPhase] = useState(start?.phase_id ?? null);
  const [alle, setAlle] = useState(!!start?.gewerk_id && gewerke.findIndex((g) => g.id === start.gewerk_id) >= SICHTBAR);
  const [notizOffen, setNotizOffen] = useState(!!start?.notiz);
  const [notiz, setNotiz] = useState(start?.notiz ?? '');
  const [fertig, setFertig] = useState(false);

  const sichtbar = alle ? gewerke : gewerke.slice(0, SICHTBAR);
  const knopf = (x, aktiv, setze) => html`<button data-id=${x.id} aria-pressed=${aktiv === x.id ? 'true' : 'false'}
    onClick=${() => setze(aktiv === x.id ? null : x.id)}>${x.name}</button>`;
  return html`<div class="picker">
    ${titel && html`<h3>${titel}</h3>`}
    ${vorschau && html`<img class="picker-vorschau" src=${vorschau} alt="Aufgenommenes Foto" />`}
    <h4>Gewerk <span class="hinweis">(freiwillig)</span></h4>
    <div class="knopfgitter gewerke">
      ${sichtbar.map((g) => knopf(g, gewerk, setGewerk))}
      ${!alle && gewerke.length > SICHTBAR && html`<button class="mehr" onClick=${() => setAlle(true)}>mehr…</button>`}
    </div>
    <h4>Phase <span class="hinweis">(freiwillig)</span></h4>
    <div class="knopfgitter phasen">${phasen.map((p) => knopf(p, phase, setPhase))}</div>
    ${notizOffen
      ? html`<textarea name="notiz" placeholder="Notiz (optional)" onInput=${(e) => setNotiz(e.target.value)}>${notiz}</textarea>`
      : html`<button class="link" onClick=${() => setNotizOffen(true)}>+ Notiz</button>`}
    <button class="primaer gross" disabled=${fertig} onClick=${() => {
      if (fertig) return; setFertig(true);
      onComplete({ gewerk_id: gewerk, phase_id: phase, notiz: notiz.trim() });
    }}>Speichern</button>
  </div>`;
}
