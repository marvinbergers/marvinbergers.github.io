// Eingang: unsortierte Fotos markieren und gemeinsam einer Stelle, einem Gewerk und einer Phase zuordnen.
import { html } from '../vendor/htm.js';
import { useState, useEffect } from '../vendor/preact.js';
import { useApi } from '../data/api.js';
import { useLoad, useUrls, sortiert } from './hooks.js';
import { importFiles, assignFotos, imEingang } from '../data/inbox.js';
import { pickFile } from './capture.js';
import { FloorPlan } from './FloorPlan.js';
import { CategoryPicker } from './CategoryPicker.js';
import { pickEtage } from '../lib/filter.js';
import { sortByFrequency, countUsage } from '../lib/frequency.js';

export function Inbox() {
  const api = useApi();
  const [markiert, setMarkiert] = useState(new Set());
  const [schritt, setSchritt] = useState(null); // null | 'stelle' | {stelle}
  const [meldung, setMeldung] = useState('');
  const [etageId, setEtageId] = useState(null);

  const d = useLoad(async () => {
    const [fotos, etagen, gewerke, phasen, wartend] = await Promise.all([
      api.list('fotos'), api.list('etagen'), api.list('gewerke'), api.list('phasen'), api.queue.count(),
    ]);
    return { alle: fotos, fotos: fotos.filter(imEingang).sort((a, b) => `${b.aufgenommen_am}`.localeCompare(`${a.aufgenommen_am}`)),
      etagen: sortiert(etagen), gewerke: sortByFrequency(sortiert(gewerke), countUsage(fotos)), phasen: sortiert(phasen), wartend };
  });

  const melde = (r) => setMeldung([r.neu && `${r.neu} neu`, r.doppelt && `${r.doppelt} schon vorhanden`, r.fehler && `${r.fehler} nicht lesbar`,
    r.nichtGespeichert && `${r.nichtGespeichert} nicht gespeichert`].filter(Boolean).join(', ') + (r.meldungen.length ? ` – ${r.meldungen.join('; ')}` : ''));
  const importieren = async (files) => {
    if (!files.length) return;
    try { melde(await importFiles(api, files)); } catch (e) { setMeldung(`Fehler beim Import: ${e.message}`); }
    d.reload();
  };

  // Über „Teilen“ (Android) angekommene Fotos übernehmen – erst nach dem sicheren Einreihen löschen.
  useEffect(() => {
    (async () => {
      const geteilt = (await api.queue.peekShared?.()) ?? [];
      if (!geteilt.length) return;
      const summe = { neu: 0, doppelt: 0, fehler: 0, nichtGespeichert: 0, meldungen: [] };
      for (const { key, file } of geteilt) {
        const r = await importFiles(api, [file]).catch((e) => ({ neu: 0, doppelt: 0, fehler: 0, nichtGespeichert: 1, meldungen: [`${file.name}: ${e.message}`] }));
        for (const k of ['neu', 'doppelt', 'fehler', 'nichtGespeichert']) summe[k] += r[k];
        summe.meldungen.push(...r.meldungen);
        if (!r.nichtGespeichert) await api.queue.removeShared(key);
      }
      melde(summe); d.reload();
    })();
  }, []);

  const fotos = d.data?.fotos ?? [];
  const urls = useUrls(api, fotos.map((f) => f.key_vorschau));
  const toggle = (id) => { const n = new Set(markiert); n.has(id) ? n.delete(id) : n.add(id); setMarkiert(n); };

  if (schritt === 'stelle') {
    const etage = pickEtage(d.data.etagen, etageId);
    return html`<${StelleWaehlen} api=${api} etage=${etage} etagen=${d.data.etagen} onEtage=${setEtageId}
      onWahl=${(stelle) => setSchritt({ stelle })} onAbbruch=${() => setSchritt(null)} />`;
  }
  if (schritt?.stelle) {
    return html`<div class="karte"><${CategoryPicker} titel=${`${markiert.size} Fotos → ${schritt.stelle.name}`}
      gewerke=${d.data.gewerke} phasen=${d.data.phasen}
      onComplete=${async ({ gewerk_id, phase_id }) => {
        await assignFotos(api, [...markiert], { stelle_id: schritt.stelle.id, gewerk_id, phase_id });
        setMarkiert(new Set()); setSchritt(null); d.reload();
      }} />
      <button onClick=${() => setSchritt(null)}>Abbrechen</button></div>`;
  }

  return html`<div>
    <div class="zeile"><h2>Eingang</h2>
      <button onClick=${async () => importieren(await pickFile({ kamera: false, mehrere: true }))}>Fotos importieren</button></div>
    ${meldung && html`<p class="hinweis" role="status">${meldung}</p>`}
    ${d.data?.wartend > 0 && html`<p class="hinweis">${d.data.wartend} Foto(s) warten noch auf den Upload.</p>`}
    ${!d.loading && fotos.length === 0 && html`<p class="leer">Alles einsortiert.</p>`}
    <div class="thumbs auswahl">
      ${fotos.map((f) => html`<button class="thumb" data-foto=${f.id} aria-pressed=${markiert.has(f.id) ? 'true' : 'false'} onClick=${() => toggle(f.id)}>
        <img src=${urls[f.key_vorschau] ?? ''} alt="" loading="lazy" />
        ${f.stelle_id && html`<span class="marke">Stelle ✓</span>`}${f.datum_geschaetzt && html`<span class="marke">Datum geschätzt</span>`}
      </button>`)}
    </div>
    ${markiert.size > 0 && html`<button class="primaer gross schwebend" onClick=${() => setSchritt('stelle')}>Einsortieren (${markiert.size})</button>`}
  </div>`;
}

function StelleWaehlen({ api, etage, etagen, onEtage, onWahl, onAbbruch }) {
  const s = useLoad(async () => etage ? Promise.all([api.list('stellen', { etage_id: etage.id }), api.list('raeume', { etage_id: etage.id })]) : [[], []], [etage?.id]);
  const urls = useUrls(api, [etage?.plan_key]);
  if (!etage) return html`<p>Keine Etage angelegt.</p>`;
  const [stellen, raeume] = s.data ?? [[], []];
  const kopf = html`<select aria-label="Etage" value=${etage.id} onChange=${(e) => onEtage(e.target.value)}>
    ${etagen.map((e) => html`<option value=${e.id}>${e.name}</option>`)}</select>`;
  return html`<div>
    <p><b>Stelle wählen</b> – antippen, oder neue Stelle durch Drücken und Ziehen.</p>
    <${FloorPlan} etage=${etage} planUrl=${urls[etage.plan_key]} stellen=${stellen} raeume=${raeume} kopf=${kopf}
      onSelectStelle=${onWahl} onCreateStelle=${async (pos) => onWahl(await api.insert('stellen', { ...pos, etage_id: etage.id }))} />
    <button onClick=${onAbbruch}>Abbrechen</button>
  </div>`;
}
