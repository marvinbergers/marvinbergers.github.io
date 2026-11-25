// Tagebuch-Übersicht: Tage mit Inhalt oder Fotos, neueste zuerst. Dazu die freiwillige Stunden-Auswertung.
import { html } from '../vendor/htm.js';
import { useApi } from '../data/api.js';
import { useLoad } from './hooks.js';
import { berlinDate, formatTag } from '../lib/days.js';
import { weatherText } from '../lib/weather.js';
import { summarizeHours, hoursLabel } from '../lib/hours.js';
import { DayEntry } from './DayEntry.js';

export function Diary() {
  const api = useApi();
  const d = useLoad(async () => {
    const [tage, abschnitte, anwesenheit, fotos, personen, gewerke] = await Promise.all([
      api.list('tage'), api.list('tag_abschnitte'), api.list('anwesenheit'), api.list('fotos'), api.list('personen'), api.list('gewerke'),
    ]);
    const tagVon = new Map(tage.map((t) => [t.id, t]));
    const zeilen = new Map();
    const zeile = (datum) => { if (!zeilen.has(datum)) zeilen.set(datum, { datum, texte: [], fotos: 0, tag: null }); return zeilen.get(datum); };
    for (const a of abschnitte) { const t = tagVon.get(a.tag_id); if (t) { const z = zeile(t.datum); z.texte.push(a.text); z.tag = t; } }
    for (const a of anwesenheit) { const t = tagVon.get(a.tag_id); if (t) zeile(t.datum).tag = t; }
    for (const f of fotos) zeile(f.tag).fotos++;
    for (const z of zeilen.values()) z.tag ??= tage.find((t) => t.datum === z.datum) ?? null;
    return { zeilen: [...zeilen.values()].sort((a, b) => b.datum.localeCompare(a.datum)), stunden: summarizeHours(anwesenheit, tage, personen, gewerke) };
  });
  const s = d.data?.stunden;
  return html`<div>
    <div class="zeile"><h2>Tagebuch</h2><a class="btn primaer" href=${`#/tagebuch?datum=${berlinDate(new Date())}`}>Heute</a></div>
    ${d.data?.zeilen.length === 0 && html`<p class="leer">Noch keine Einträge.</p>`}
    ${d.data?.zeilen.map((z) => html`<a class="karte tag-zeile" data-tag=${z.datum} href=${`#/tagebuch?datum=${z.datum}`}>
      <b>${formatTag(z.datum)}</b> <span class="hinweis">${weatherText(z.tag?.wetter)}</span>
      ${z.texte[0] && html`<div class="vorschau-text">${z.texte[0]}</div>`}
      ${z.fotos > 0 && html`<div class="hinweis">📷 ${z.fotos}</div>`}
    </a>`)}
    ${s && s.erfassteTage > 0 && html`<section class="karte"><h3>Stunden (Eigenleistung)</h3>
      <p class="hinweis">${hoursLabel(s.erfassteTage, s.tageGesamt)}</p>
      <table class="tabelle"><tbody>${s.proPerson.map((p) => html`<tr><td>${p.name}</td><td>${p.stunden} h</td></tr>`)}</tbody></table>
      <details><summary>Nach Monat und Gewerk</summary>
        <table class="tabelle"><tbody>${s.proMonat.map((m) => html`<tr><td>${m.monat}</td><td>${m.stunden} h</td></tr>`)}</tbody></table>
        <table class="tabelle"><tbody>${s.proGewerk.map((g) => html`<tr><td>${g.gewerk}</td><td>${g.stunden} h</td></tr>`)}</tbody></table>
      </details></section>`}
  </div>`;
}

/** Route #/tagebuch bzw. #/tagebuch?datum=YYYY-MM-DD */
export function TagebuchView() {
  const datum = new URLSearchParams((location.hash.split('?')[1]) ?? '').get('datum');
  if (datum && /^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return html`<${DayEntry} key=${datum} datum=${datum} kopf=${html`<a href="#/tagebuch">‹ Alle Tage</a>`} />`;
  }
  return html`<${Diary} />`;
}
