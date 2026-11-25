// Ansicht einer Stelle: Fotos als Zeitleiste nach Phase, Umbenennen, Verschieben, Zusammenlegen.
import { html } from '../vendor/htm.js';
import { useState } from '../vendor/preact.js';

export function StellePanel({
  stelle, fotos = [], phasen = [], stellen = [], thumb, onPhoto = () => {}, onRename = () => {},
  onMove = () => {}, onMerge = () => {}, onClose = () => {}, onOpenFoto = () => {}, extra = null,
}) {
  const [modus, setModus] = useState(null);
  const [name, setName] = useState(stelle.name);
  const [ziel, setZiel] = useState('');
  const reihenfolge = new Map(phasen.map((p) => [p.id, p.sortierung ?? 0]));
  const gruppen = phasen
    .map((p) => ({ phase: p, fotos: fotos.filter((f) => f.phase_id === p.id).sort((a, b) => `${a.aufgenommen_am ?? a.tag}`.localeCompare(`${b.aufgenommen_am ?? b.tag}`)) }))
    .filter((g) => g.fotos.length)
    .sort((a, b) => reihenfolge.get(a.phase.id) - reihenfolge.get(b.phase.id));
  const ohnePhase = fotos.filter((f) => !f.phase_id);

  return html`<section class="stelle-panel karte">
    <header class="zeile"><h2>${stelle.name}</h2><button aria-label="Schließen" onClick=${onClose}>✕</button></header>
    <p class="hinweis">${fotos.length} ${fotos.length === 1 ? 'Foto' : 'Fotos'}</p>
    <button class="primaer gross" onClick=${onPhoto}>📷 Foto</button>
    ${extra}
    <div class="zeitleiste">
      ${gruppen.map((g) => html`<div><h4>${g.phase.name} · ${g.fotos.length}</h4>
        <div class="thumbs">${g.fotos.map((f) => html`<img src=${thumb(f)} alt="" loading="lazy" onClick=${() => onOpenFoto(f)} />`)}</div></div>`)}
      ${ohnePhase.length > 0 && html`<div><h4>Ohne Phase · ${ohnePhase.length}</h4>
        <div class="thumbs">${ohnePhase.map((f) => html`<img src=${thumb(f)} alt="" loading="lazy" onClick=${() => onOpenFoto(f)} />`)}</div></div>`}
    </div>
    <div class="knopfgitter klein">
      <button onClick=${() => setModus('name')}>Umbenennen</button>
      <button onClick=${() => onMove(stelle)}>Verschieben</button>
      <button onClick=${() => setModus('merge')}>Zusammenlegen mit…</button>
    </div>
    ${modus === 'name' && html`<div>
      <input name="neuername" value=${name} onInput=${(e) => setName(e.target.value)} />
      <button class="primaer" onClick=${() => { onRename(name.trim()); setModus(null); }}>Speichern</button></div>`}
    ${modus === 'merge' && html`<div>
      <select name="ziel" onChange=${(e) => setZiel(e.target.value)}>
        <option value="">Stelle wählen…</option>
        ${stellen.filter((s) => s.id !== stelle.id).map((s) => html`<option value=${s.id}>${s.name}</option>`)}
      </select>
      <button class="primaer" disabled=${!ziel} onClick=${() => { onMerge(ziel); setModus(null); }}>Fotos dorthin verschieben</button></div>`}
  </section>`;
}
