// Startbildschirm: Grundriss der zuletzt benutzten Etage → Raum → Wand → Fotos.
import { html } from '../vendor/htm.js';
import { useState } from '../vendor/preact.js';
import { useApi } from '../data/api.js';
import { useLoad, useUrls, sortiert } from './hooks.js';
import { FloorPlan } from './FloorPlan.js';
import { StellePanel } from './StellePanel.js';
import { pickEtage } from '../lib/filter.js';
import { wandTitel } from '../lib/rooms.js';
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
  const [raum, setRaum] = useState(null);
  const [seite, setSeite] = useState(null);
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
  if (!etage) return html`<div>
    <div class="grundriss-kopf"><span class="flex1"></span><button class="schnellfoto primaer" aria-label="Schnellfoto" onClick=${() => capture.quick()}>📷</button></div>
    ${basis.error
      ? html`<div class="karte"><p>Keine Verbindung und noch keine gespeicherten Daten auf diesem Gerät.</p><p class="hinweis">Schnellfotos gehen trotzdem – sie werden hochgeladen, sobald wieder Netz da ist.</p></div>`
      : html`<div class="karte"><h2>Willkommen</h2><p>Es ist noch keine Etage angelegt.</p><a class="btn" href="#/einrichtung">Zur Einrichtung</a></div>`}
    ${capture.overlay}</div>`;

  const { stellen = [], raeume = [], fotos = [] } = daten.data ?? {};
  const passt = (f) => (!filter.gewerk_id || f.gewerk_id === filter.gewerk_id) && (!filter.phase_id || f.phase_id === filter.phase_id);
  const gefiltert = !!(filter.gewerk_id || filter.phase_id);
  const stelleVon = new Map(stellen.map((s) => [s.id, s]));
  const raumZahlen = {}; const wandZahlen = {};
  for (const f of fotos) {
    const s = stelleVon.get(f.stelle_id);
    if (!s?.raum_id || !passt(f)) continue;
    raumZahlen[s.raum_id] = (raumZahlen[s.raum_id] ?? 0) + 1;
    if (raum && s.raum_id === raum.id) wandZahlen[s.seite] = (wandZahlen[s.seite] ?? 0) + 1;
  }
  const gedimmt = new Set(gefiltert ? raeume.filter((r) => !raumZahlen[r.id]).map((r) => r.id) : []);
  const wechsel = (id) => { ls.set(LS, id); setEtageId(id); setRaum(null); setSeite(null); };
  const wandStelle = raum && seite ? stellen.find((s) => s.raum_id === raum.id && s.seite === seite) : null;
  const wandFotos = wandStelle ? fotos.filter((f) => f.stelle_id === wandStelle.id) : [];

  const kopf = html`
    <select aria-label="Etage" value=${etage.id} onChange=${(e) => wechsel(e.target.value)}>
      ${basis.data.etagen.map((e) => html`<option value=${e.id}>${e.name}</option>`)}
    </select>
    <a class="btn einstellungen" href="#/einrichtung" aria-label="Einrichtung">⚙︎</a>`;

  const ohneFlaechen = raeume.length > 0 && !raeume.some((r) => r.flaechen?.length);

  return html`<div>
    <${FloorPlan} etage=${etage} planUrl=${urls[etage.plan_key]} bestandUrl=${urls[etage.bestand_key]}
      raeume=${raeume} raumZahlen=${raumZahlen} gedimmt=${gedimmt} aktiverRaum=${raum} wandZahlen=${wandZahlen} kopf=${kopf}
      onRoom=${(r) => { setRaum(r); setSeite(null); }} onWand=${setSeite} onQuickPhoto=${() => capture.quick()} />
    ${(ohneFlaechen || raeume.length === 0) && html`<p class="hinweis">Noch keine Räume aufgezogen – unter ⚙︎ Einrichtung → Räume.</p>`}
    <div class="filter zeile">
      <select aria-label="Filter Gewerk" onChange=${(e) => setFilter({ ...filter, gewerk_id: e.target.value })}>
        <option value="">Alle Gewerke</option>${basis.data.gewerke.map((g) => html`<option value=${g.id}>${g.name}</option>`)}
      </select>
      <select aria-label="Filter Phase" onChange=${(e) => setFilter({ ...filter, phase_id: e.target.value })}>
        <option value="">Alle Phasen</option>${basis.data.phasen.map((p) => html`<option value=${p.id}>${p.name}</option>`)}
      </select>
    </div>
    ${raum && seite && html`<${WandMitFotos} api=${api} titel=${wandTitel(raum, seite, etage.nord_grad ?? 0)}
      fotos=${wandFotos.filter(passt)} alleFotos=${fotos} gewerke=${basis.data.gewerke} phasen=${basis.data.phasen} listen=${basis.data.listen}
      onPhoto=${(extra = {}) => capture.atWand(etage, raum, seite, { gewerke: basis.data.gewerke, phasen: basis.data.phasen, fotos, wandStelle, ...extra })}
      onClose=${() => setSeite(null)} onChanged=${() => daten.reload()} />`}
    ${capture.overlay}
  </div>`;
}

function WandMitFotos({ api, titel, fotos, alleFotos, gewerke, phasen, listen, onPhoto, onClose, onChanged }) {
  const urls = useUrls(api, fotos.map((f) => f.key_vorschau));
  const [teilen, setTeilen] = useState(false);
  const [offen, setOffen] = useState(null);
  const thumb = (f) => urls[f.key_vorschau] ?? '';
  const extra = html`<div class="knopfgitter klein">
      ${fotos.length > 0 && html`<button onClick=${() => setTeilen(true)}>Teilen…</button>`}</div>
    <${Checkliste} listen=${listen} fotos=${alleFotos} onFoto=${(checkpunkt) => onPhoto({ checkpunkt })} />
    ${teilen && html`<${ShareDialog} fotos=${fotos} thumb=${thumb} onClose=${() => setTeilen(false)}
      onShare=${(auswahl) => shareFotos(auswahl, { getBlob: blobLoader(api) })} />`}
    ${offen && html`<${FotoAnsicht} foto=${offen} gewerke=${gewerke} phasen=${phasen} onClose=${() => setOffen(null)} onChanged=${onChanged} />`}`;
  return html`<${StellePanel} titel=${titel} fotos=${fotos} phasen=${phasen} thumb=${thumb}
    onPhoto=${() => onPhoto()} onOpenFoto=${setOffen} onClose=${onClose} extra=${extra} />`;
}
