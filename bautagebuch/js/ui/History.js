// Änderungsverlauf eines Datensatzes: wer hat wann was geändert.
import { html } from '../vendor/htm.js';
import { useApi } from '../data/api.js';
import { useLoad } from './hooks.js';
import { nameOf } from '../data/diary.js';

const AKTION = { insert: 'angelegt', update: 'geändert', delete: 'gelöscht' };
const zeit = (iso) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(iso));

export function History({ id, feld = null }) {
  const api = useApi();
  const d = useLoad(async () => ({ eintraege: await api.history(id), personen: await api.list('personen') }), [id]);
  if (!d.data) return null;
  const aktion = (h) => (h.nachher?.geloescht_am && !h.vorher?.geloescht_am ? 'in den Papierkorb'
    : h.vorher?.geloescht_am && !h.nachher?.geloescht_am ? 'wiederhergestellt' : AKTION[h.aktion] ?? h.aktion);
  return html`<ul class="verlauf liste">
    ${d.data.eintraege.map((h) => html`<li><span>
      ${feld && h.nachher?.[feld] != null ? html`<q>${h.nachher[feld]}</q> ` : ''}
      <small class="hinweis">${aktion(h)} · ${nameOf(h.von, d.data.personen)} · ${zeit(h.am)}</small></span></li>`)}
  </ul>`;
}
