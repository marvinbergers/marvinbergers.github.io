// Ein Tag im Bautagebuch. Alle Abschnitte sind freiwillig; jede Ergänzung trägt den Namen des Verfassers.
import { html } from '../vendor/htm.js';
import { useState } from '../vendor/preact.js';
import { useApi } from '../data/api.js';
import { useLoad, useUrls, sortiert } from './hooks.js';
import { findTag, ensureTag, nameOf } from '../data/diary.js';
import { groupFotosByDay, formatTag } from '../lib/days.js';
import { weatherText } from '../lib/weather.js';
import { Attendance } from './Attendance.js';
import { ShareDialog, shareFotos, blobLoader } from './Share.js';
import { FotoAnsicht } from './FotoAnsicht.js';
import { History } from './History.js';
import { wandTitel } from '../data/actions.js';

export const ABSCHNITTE = [
  ['arbeiten', 'Arbeiten'], ['lieferungen', 'Lieferungen'], ['probleme', 'Probleme / Entscheidungen / Absprachen'],
];

export function DayEntry({ datum, kopf = null }) {
  const api = useApi();
  const [teilen, setTeilen] = useState(false);
  const [offen, setOffen] = useState(null);
  const d = useLoad(async () => {
    const tag = await findTag(api, datum);
    const [abschnitte, anwesenheit, personen, firmen, gewerke, fotos, stellen, raeume, etagen] = await Promise.all([
      tag ? api.list('tag_abschnitte', { tag_id: tag.id }) : [], tag ? api.list('anwesenheit', { tag_id: tag.id }) : [],
      api.list('personen'), api.list('firmen'), api.list('gewerke'), api.list('fotos', { tag: datum }), api.list('stellen'),
      api.list('raeume'), api.list('etagen'),
    ]);
    return { tag, abschnitte, anwesenheit, personen: sortiert(personen), firmen: sortiert(firmen), gewerke: sortiert(gewerke), fotos, stellen, raeume, etagen };
  }, [datum]);
  const fotos = d.data?.fotos ?? [];
  const urls = useUrls(api, fotos.map((f) => f.key_vorschau));
  if (!d.data) return html`<p class="hinweis">Lädt …</p>`;
  const { tag, abschnitte, anwesenheit, personen, firmen, gewerke, stellen, raeume, etagen } = d.data;

  const tagId = async () => (await ensureTag(api, datum)).id;
  const gruppen = groupFotosByDay(fotos).get(datum) ?? [];
  // Wandnamen immer aus Raumform und Nordpfeil berechnen (wie Grundriss und Archiv)
  const stellenName = (id) => {
    if (!id) return 'Eingang';
    const s = stellen.find((x) => x.id === id); if (!s) return 'Stelle';
    const r = raeume.find((x) => x.id === s.raum_id);
    return r && s.seite ? wandTitel(r, { seite: s.seite, kante: s.kante }, etagen.find((e) => e.id === r.etage_id)) : s.name;
  };

  return html`<article class="tag">
    ${kopf}
    <h2>${formatTag(datum)}</h2>
    <${Wetter} tag=${tag} onSave=${async (text) => {
      const id = await tagId();
      await api.update('tage', id, { wetter: { text }, wetter_manuell: true }); d.reload();
    }} />

    <section class="karte"><h3>👷 Anwesend</h3>
      <${Attendance} personen=${personen} firmen=${firmen} gewerke=${gewerke} anwesenheit=${anwesenheit}
        onToggle=${async (art, id, vorhanden) => {
          if (vorhanden) await api.softDelete('anwesenheit', vorhanden.id);
          else await api.insert('anwesenheit', { tag_id: await tagId(), [art === 'person' ? 'person_id' : 'firma_id']: id });
          d.reload();
        }}
        onUpdate=${async (a, patch) => { await api.update('anwesenheit', a.id, patch); d.reload(); }} />
    </section>

    ${ABSCHNITTE.map(([typ, titel]) => html`<${Abschnitt} typ=${typ} titel=${titel} personen=${personen}
      eintraege=${abschnitte.filter((a) => a.typ === typ)}
      onAdd=${async (text) => { await api.insert('tag_abschnitte', { tag_id: await tagId(), typ, text }); d.reload(); }}
      onEdit=${async (a, text) => { await api.update('tag_abschnitte', a.id, { text }); d.reload(); }}
      onDelete=${async (a) => { await api.softDelete('tag_abschnitte', a.id); d.reload(); }} />`)}

    <section class="karte"><div class="zeile"><h3>📷 ${fotos.length} ${fotos.length === 1 ? 'Foto' : 'Fotos'}</h3>
      ${fotos.length > 0 && html`<button onClick=${() => setTeilen(true)}>Teilen…</button>`}</div>
      ${teilen && html`<${ShareDialog} fotos=${fotos} thumb=${(f) => urls[f.key_vorschau] ?? ''} onClose=${() => setTeilen(false)}
        onShare=${(auswahl) => shareFotos(auswahl, { getBlob: blobLoader(api) })} />`}
      ${gruppen.map((g) => html`<div><h4>${stellenName(g.stelle_id)}</h4>
        <div class="thumbs">${g.fotos.map((f) => html`<img src=${urls[f.key_vorschau] ?? ''} alt="" loading="lazy" onClick=${() => setOffen(f)} />`)}</div></div>`)}
      ${offen && html`<${FotoAnsicht} foto=${offen} gewerke=${gewerke} onClose=${() => setOffen(null)} onChanged=${d.reload} />`}
    </section>
  </article>`;
}

function Wetter({ tag, onSave }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  return html`<p class="wetter">☁️ ${weatherText(tag?.wetter) || html`<span class="hinweis">Wetter wird beim ersten Eintrag geholt</span>`}
    ${!edit && html` <button class="link" onClick=${() => { setText(tag?.wetter?.text ?? ''); setEdit(true); }}>Wetter ändern</button>`}
    ${edit && html`<span><input name="wetter" value=${text} onInput=${(e) => setText(e.target.value)} />
      <button onClick=${async () => { await onSave(text.trim()); setEdit(false); }}>Übernehmen</button></span>`}
  </p>`;
}

function Abschnitt({ typ, titel, eintraege, personen, onAdd, onEdit, onDelete }) {
  const [neu, setNeu] = useState('');
  const [bearbeite, setBearbeite] = useState(null);
  return html`<section class="karte abschnitt"><h3>${titel}</h3>
    ${eintraege.map((a) => bearbeite?.id === a.id
      ? html`<div><textarea value=${bearbeite.text} onInput=${(e) => setBearbeite({ ...bearbeite, text: e.target.value })} />
          <button onClick=${async () => { await onEdit(a, bearbeite.text); setBearbeite(null); }}>Fertig</button>
          <button onClick=${async () => { await onDelete(a); setBearbeite(null); }}>Löschen</button>
          <details><summary>Verlauf</summary><${History} id=${a.id} feld="text" /></details></div>`
      : html`<p class="eintrag" onClick=${() => setBearbeite({ id: a.id, text: a.text })}>${a.text}
          <small class="hinweis"> — ${nameOf(a.erstellt_von, personen)}${a.geaendert_von && a.geaendert_von !== a.erstellt_von ? `, bearbeitet von ${nameOf(a.geaendert_von, personen)}` : ''}</small></p>`)}
    <textarea name=${typ} placeholder="Ergänzen …" value=${neu} onInput=${(e) => setNeu(e.target.value)} />
    ${neu.trim() && html`<button class="primaer" onClick=${async () => { await onAdd(neu.trim()); setNeu(''); }}>Speichern</button>`}
  </section>`;
}
