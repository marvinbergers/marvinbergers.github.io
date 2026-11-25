// Startbildschirm: Grundriss der zuletzt benutzten Etage mit Stellen, Filter und Stellen-Ansicht.
import { html } from '../vendor/htm.js';
import { useState } from '../vendor/preact.js';
import { useApi } from '../data/api.js';
import { useLoad, useUrls, sortiert } from './hooks.js';
import { FloorPlan } from './FloorPlan.js';
import { StellePanel } from './StellePanel.js';
import { pickEtage, filterStellen } from '../lib/filter.js';
import { mergeStellen } from '../data/actions.js';
import { useCapture } from './capture.js';
import { ShareDialog, shareFotos, blobLoader } from './Share.js';
import { Checkliste, checklisten } from './Checkliste.js';
import { FotoAnsicht } from './FotoAnsicht.js';

const LS = 'bautagebuch-etage';
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

export function GrundrissView() {
  const api = useApi();
  const [etageId, setEtageId] = useState(ls.get(LS));
  const [filter, setFilter] = useState({ gewerk_id: '', phase_id: '' });
  const [auswahl, setAuswahl] = useState(null);
  const [verschiebe, setVerschiebe] = useState(null);
  const reloadRef = { current: () => {} };
  const capture = useCapture(api, { onSaved: () => reloadRef.current() });

  const basis = useLoad(async () => {
    const [etagen, gewerke, phasen, einstellungen] = await Promise.all([api.list('etagen'), api.list('gewerke'), api.list('phasen'), api.list('einstellungen')]);
    return { etagen: sortiert(etagen), gewerke: sortiert(gewerke), phasen: sortiert(phasen), listen: checklisten(einstellungen) };
  });
  const etage = pickEtage(basis.data?.etagen ?? [], etageId);
  const daten = useLoad(async () => {
    if (!etage) return { stellen: [], raeume: [], fotos: [] };
    const [stellen, raeume, fotos] = await Promise.all([
      api.list('stellen', { etage_id: etage.id }), api.list('raeume', { etage_id: etage.id }), api.list('fotos'),
    ]);
    return { stellen, raeume, fotos };
  }, [etage?.id]);
  const urls = useUrls(api, [etage?.plan_key, etage?.bestand_key]);
  reloadRef.current = daten.reload;

  if (basis.loading) return html`<p class="hinweis">Lädt …</p>`;
  if (!etage) return html`<div class="karte"><h2>Willkommen</h2><p>Es ist noch keine Etage angelegt.</p>
    <a class="btn" href="#/einrichtung">Zur Einrichtung</a></div>`;

  const { stellen = [], raeume = [], fotos = [] } = daten.data ?? {};
  const sichtbar = filterStellen(stellen, fotos, filter);
  const wechsel = (id) => { ls.set(LS, id); setEtageId(id); setAuswahl(null); };
  const neu = async (pos) => { const s = await api.insert('stellen', { ...pos, etage_id: etage.id }); await daten.reload(); setAuswahl(s); };
  const verschoben = async (id, pos) => { await api.update('stellen', id, pos); setVerschiebe(null); await daten.reload(); };

  const kopf = html`
    <select aria-label="Etage" value=${etage.id} onChange=${(e) => wechsel(e.target.value)}>
      ${basis.data.etagen.map((e) => html`<option value=${e.id}>${e.name}</option>`)}
    </select>
    <a class="btn einstellungen" href="#/einrichtung" aria-label="Einrichtung">⚙︎</a>`;

  return html`<div>
    <${FloorPlan} etage=${etage} planUrl=${urls[etage.plan_key]} bestandUrl=${urls[etage.bestand_key]}
      stellen=${sichtbar} raeume=${raeume} verschiebe=${verschiebe} kopf=${kopf}
      onSelectStelle=${setAuswahl} onCreateStelle=${neu} onMoveStelle=${verschoben}
      onQuickPhoto=${() => capture.quick()} />
    <div class="filter zeile">
      <select aria-label="Filter Gewerk" onChange=${(e) => setFilter({ ...filter, gewerk_id: e.target.value })}>
        <option value="">Alle Gewerke</option>${basis.data.gewerke.map((g) => html`<option value=${g.id}>${g.name}</option>`)}
      </select>
      <select aria-label="Filter Phase" onChange=${(e) => setFilter({ ...filter, phase_id: e.target.value })}>
        <option value="">Alle Phasen</option>${basis.data.phasen.map((p) => html`<option value=${p.id}>${p.name}</option>`)}
      </select>
    </div>
    ${auswahl && html`<${StelleMitFotos} api=${api} stelle=${auswahl} fotos=${fotos.filter((f) => f.stelle_id === auswahl.id)}
      phasen=${basis.data.phasen} gewerke=${basis.data.gewerke} stellen=${stellen} capture=${capture} listen=${basis.data.listen} alleFotos=${fotos}
      onClose=${() => setAuswahl(null)} onChanged=${() => daten.reload()}
      onRename=${async (name) => { const s = await api.update('stellen', auswahl.id, { name }); setAuswahl(s); daten.reload(); }}
      onMove=${(s) => { setVerschiebe(s); setAuswahl(null); }}
      onMerge=${async (ziel) => { await mergeStellen(api, auswahl.id, ziel); setAuswahl(stellen.find((s) => s.id === ziel)); daten.reload(); }} />`}
    ${capture.overlay}
  </div>`;
}

function StelleMitFotos({ api, fotos, capture, stelle, gewerke, phasen, listen, alleFotos, ...rest }) {
  const urls = useUrls(api, fotos.map((f) => f.key_vorschau));
  const [teilen, setTeilen] = useState(false);
  const [offen, setOffen] = useState(null);
  const thumb = (f) => urls[f.key_vorschau] ?? '';
  const extra = html`<div class="knopfgitter klein">
      ${fotos.length > 0 && html`<button onClick=${() => setTeilen(true)}>Teilen…</button>`}</div>
    <${Checkliste} listen=${listen} fotos=${alleFotos}
      onFoto=${(checkpunkt) => capture.atStelle(stelle, { gewerke, phasen, fotos, checkpunkt })} />
    ${teilen && html`<${ShareDialog} fotos=${fotos} thumb=${thumb} onClose=${() => setTeilen(false)}
      onShare=${(auswahl) => shareFotos(auswahl, { getBlob: blobLoader(api) })} />`}
    ${offen && html`<${FotoAnsicht} foto=${offen} gewerke=${gewerke} phasen=${phasen} onClose=${() => setOffen(null)} onChanged=${rest.onChanged} />`}`;
  return html`<${StellePanel} stelle=${stelle} fotos=${fotos} phasen=${phasen} thumb=${thumb}
    onPhoto=${() => capture.atStelle(stelle, { gewerke, phasen, fotos })} onOpenFoto=${setOffen} extra=${extra} ...${rest} />`;
}
