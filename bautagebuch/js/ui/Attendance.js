// Anwesenheit: Namen antippen genügt. Stunden und Gewerk sind freiwillig – keine Pflicht, keine Erinnerung.
import { html } from '../vendor/htm.js';
import { useState } from '../vendor/preact.js';

const DAUER = [['', 'Stunden –'], ['2', '2 h'], ['4', '4 h'], ['8', 'ganzer Tag'], ['frei', 'andere …']];

export function Attendance({ personen = [], firmen = [], gewerke = [], anwesenheit = [], onToggle, onUpdate }) {
  const eintrag = (art, id) => anwesenheit.find((a) => (art === 'person' ? a.person_id : a.firma_id) === id);
  const zeile = (art, x) => {
    const a = eintrag(art, x.id);
    return html`<div class="anwesend-zeile">
      <button data-anwesend=${`${art}:${x.id}`} aria-pressed=${a ? 'true' : 'false'} onClick=${() => onToggle(art, x.id, a)}>${a ? '☑' : '☐'} ${x.name}</button>
      ${a && html`<${Stunden} a=${a} id=${x.id} gewerke=${gewerke} onUpdate=${onUpdate} />`}
    </div>`;
  };
  return html`<div class="anwesenheit">
    ${personen.map((p) => zeile('person', p))}
    ${firmen.map((f) => zeile('firma', f))}
  </div>`;
}

function Stunden({ a, id, gewerke, onUpdate }) {
  const bekannt = a.stunden == null ? '' : ['2', '4', '8'].includes(String(a.stunden)) ? String(a.stunden) : 'frei';
  const [frei, setFrei] = useState(bekannt === 'frei');
  return html`<span class="stunden">
    <select name=${`stunden-${id}`} value=${frei ? 'frei' : bekannt} onChange=${(e) => {
      const v = e.target.value;
      if (v === 'frei') { setFrei(true); return; }
      setFrei(false); onUpdate(a, { stunden: v === '' ? null : Number(v) });
    }}>${DAUER.map(([v, t]) => html`<option value=${v}>${t}</option>`)}</select>
    ${frei && html`<input type="number" min="0.5" max="24" step="0.5" name=${`stunden-frei-${id}`} value=${a.stunden ?? ''} placeholder="h"
      onChange=${(e) => onUpdate(a, { stunden: e.target.value ? Number(e.target.value) : null })} />`}
    <select name=${`gewerk-${id}`} value=${a.gewerk_id ?? ''} onChange=${(e) => onUpdate(a, { gewerk_id: e.target.value || null })}>
      <option value="">Gewerk –</option>${gewerke.map((g) => html`<option value=${g.id}>${g.name}</option>`)}
    </select>
  </span>`;
}
