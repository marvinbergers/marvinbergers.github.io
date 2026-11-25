// Foto-Checklisten (z. B. Kontrollpunkte für den Statiker). Gepflegt in einstellungen['checklisten'].
import { html } from '../vendor/htm.js';

export const STANDARD_CHECKLISTEN = [
  { name: 'Bodenplatte', punkte: ['nach dem Aushub', 'vor dem Betonieren', 'vor dem Verdecken', 'nach der Herstellung'] },
];

export const checklisten = (einstellungen = []) => einstellungen.find((e) => e.schluessel === 'checklisten')?.wert ?? STANDARD_CHECKLISTEN;

export function checklistStatus(liste, fotos) {
  return liste.punkte.map((punkt) => {
    const schluessel = `${liste.name}: ${punkt}`;
    return { punkt, schluessel, erledigt: fotos.some((f) => f.checkpunkt === schluessel) };
  });
}

/** Checkliste mit Foto-Knopf je offenem Punkt. */
export function Checkliste({ listen, fotos, onFoto }) {
  return html`<details class="checkliste"><summary>Checklisten</summary>
    ${listen.map((l) => html`<div><h4>${l.name}</h4><ul class="liste">
      ${checklistStatus(l, fotos).map((p) => html`<li><span>${p.erledigt ? '✅' : '⬜️'} ${p.punkt}</span>
        <button aria-label=${`Foto für ${p.punkt}`} onClick=${() => onFoto(p.schluessel)}>📷</button></li>`)}
    </ul></div>`)}
  </details>`;
}
