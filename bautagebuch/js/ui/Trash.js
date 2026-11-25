// Papierkorb: Gelöschtes der letzten 90 Tage, wiederherstellbar. Danach löscht der wöchentliche Export endgültig.
import { html } from '../vendor/htm.js';
import { useApi } from '../data/api.js';
import { useLoad } from './hooks.js';

const TABELLEN = [
  ['fotos', 'Foto', (r) => `vom ${r.tag ?? ''}${r.notiz ? ` – ${r.notiz}` : ''}`],
  ['stellen', 'Stelle', (r) => r.name], ['tag_abschnitte', 'Tagebuch', (r) => r.text],
  ['anwesenheit', 'Anwesenheit', () => 'Eintrag'], ['dokumente', 'Dokument', (r) => r.titel],
  ['raeume', 'Raum', (r) => r.name], ['etagen', 'Etage', (r) => r.name], ['personen', 'Person', (r) => r.name],
  ['firmen', 'Firma', (r) => r.name], ['gewerke', 'Gewerk', (r) => r.name], ['phasen', 'Phase', (r) => r.name],
];

export function Trash() {
  const api = useApi();
  const d = useLoad(async () => {
    const listen = await Promise.all(TABELLEN.map(async ([t, art, text]) => (await api.listDeleted(t)).map((r) => ({ t, art, text: text(r), r }))));
    return listen.flat().sort((a, b) => `${b.r.geloescht_am}`.localeCompare(`${a.r.geloescht_am}`));
  });
  return html`<div><a href="#/einrichtung">‹ Einrichtung</a><h2>Papierkorb</h2>
    <p class="hinweis">Gelöschtes bleibt 90 Tage wiederherstellbar.</p>
    ${d.data?.length === 0 && html`<p class="leer">Der Papierkorb ist leer.</p>`}
    <ul class="liste">${(d.data ?? []).map((x) => html`<li><span><b>${x.art}</b> ${x.text}
      <small class="hinweis"> · gelöscht ${new Date(x.r.geloescht_am).toLocaleDateString('de-DE')}</small></span>
      <button data-restore=${`${x.t}:${x.r.id}`} onClick=${async () => { await api.restore(x.t, x.r.id); d.reload(); }}>Wiederherstellen</button></li>`)}
    </ul></div>`;
}
