// Ansicht einer Wand: Fotos als Zeitleiste nach Phase, Knopf für ein neues Foto.
import { html } from '../vendor/htm.js';

export function StellePanel({ titel, fotos = [], phasen = [], thumb, onPhoto = () => {}, onClose = () => {}, onOpenFoto = () => {}, extra = null }) {
  const reihenfolge = new Map(phasen.map((p) => [p.id, p.sortierung ?? 0]));
  const sortiert = (fs) => [...fs].sort((a, b) => `${a.aufgenommen_am ?? a.tag}`.localeCompare(`${b.aufgenommen_am ?? b.tag}`));
  const gruppen = phasen
    .map((p) => ({ phase: p, fotos: sortiert(fotos.filter((f) => f.phase_id === p.id)) }))
    .filter((g) => g.fotos.length)
    .sort((a, b) => reihenfolge.get(a.phase.id) - reihenfolge.get(b.phase.id));
  const ohnePhase = sortiert(fotos.filter((f) => !f.phase_id));
  const reihe = (titelText, fs) => html`<div><h4>${titelText} · ${fs.length}</h4>
    <div class="thumbs">${fs.map((f) => html`<img src=${thumb(f)} alt="" loading="lazy" onClick=${() => onOpenFoto(f)} />`)}</div></div>`;

  return html`<section class="stelle-panel karte">
    <header class="zeile"><h2>${titel}</h2><button aria-label="Schließen" onClick=${onClose}>✕</button></header>
    <p class="hinweis">${fotos.length} ${fotos.length === 1 ? 'Foto' : 'Fotos'}</p>
    <button class="primaer gross" onClick=${onPhoto}>📷 Foto</button>
    ${extra}
    <div class="zeitleiste">
      ${gruppen.map((g) => reihe(g.phase.name, g.fotos))}
      ${ohnePhase.length > 0 && reihe('Ohne Phase', ohnePhase)}
    </div>
  </section>`;
}
