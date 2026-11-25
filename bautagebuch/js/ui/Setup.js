// Einrichtung: Etagen mit Plan, Nordrichtung, Räumen und Bestandsplan; Listen; Dokumente; Koordinaten.
import { html } from '../vendor/htm.js';
import { useState, useRef } from '../vendor/preact.js';
import { useApi } from '../data/api.js';
import { useLoad, useUrls, sortiert } from './hooks.js';
import { safeName } from '../lib/keys.js';
import { checklisten } from './Checkliste.js';
import { normRect } from '../lib/rooms.js';
import { monatsArchiv } from '../data/archiv.js';
import { blobLoader } from './Share.js';

const kurzId = () => crypto.randomUUID().slice(0, 8);
async function bildMasse(api, file) {
  if (api.imageSize) return api.imageSize(file);
  const b = await createImageBitmap(file); const m = { width: b.width, height: b.height }; b.close?.(); return m;
}

export function Setup({ extra = null }) {
  const api = useApi();
  const d = useLoad(async () => {
    const [etagen, raeume, gewerke, phasen, personen, firmen, dokumente, einstellungen] = await Promise.all(
      ['etagen', 'raeume', 'gewerke', 'phasen', 'personen', 'firmen', 'dokumente', 'einstellungen'].map((t) => api.list(t)));
    return { etagen: sortiert(etagen), raeume, gewerke: sortiert(gewerke), phasen: sortiert(phasen), personen: sortiert(personen), firmen: sortiert(firmen), dokumente, einstellungen };
  });
  if (!d.data) return html`<p class="hinweis">Lädt …</p>`;
  const r = d.reload;
  return html`<div class="setup">
    <div class="zeile"><h2>Einrichtung</h2><a class="btn" href="#/papierkorb">🗑 Papierkorb</a></div>
    ${extra}
    <h3>Etagen</h3>
    ${d.data.etagen.map((e) => html`<${EtageKarte} key=${e.id} api=${api} etage=${e} raeume=${d.data.raeume.filter((x) => x.etage_id === e.id)} reload=${r} />`)}
    <${NeueZeile} felder=${[['name', 'Neue Etage (z. B. KG, EG, DG)']]} knopf="Etage anlegen"
      onSave=${async (v) => { await api.insert('etagen', { name: v.name, sortierung: d.data.etagen.length + 1, nord_grad: 0 }); r(); }} />

    <${Gewerke} api=${api} gewerke=${d.data.gewerke} reload=${r} />

    <h3>Phasen</h3>
    <${Liste} rows=${d.data.phasen} text=${(p) => p.name} onDelete=${async (p) => { await api.softDelete('phasen', p.id); r(); }} />
    <${NeueZeile} felder=${[['name', 'Neue Phase']]} knopf="Phase anlegen"
      onSave=${async (v) => { await api.insert('phasen', { name: v.name, sortierung: d.data.phasen.length + 1 }); r(); }} />

    <h3>Personen</h3>
    <p class="hinweis">Mit E-Mail-Adresse wird die Person beim Anmelden als Verfasser erkannt.</p>
    <${Liste} rows=${d.data.personen} text=${(p) => `${p.name}${p.email ? ` · ${p.email}` : ''}`} onDelete=${async (p) => { await api.softDelete('personen', p.id); r(); }} />
    <${NeueZeile} felder=${[['name', 'Name'], ['email', 'E-Mail (optional)']]} knopf="Person anlegen"
      onSave=${async (v) => { await api.insert('personen', { name: v.name, email: v.email || null, ist_nutzer: !!v.email }); r(); }} />

    <h3>Firmen</h3>
    <${Liste} rows=${d.data.firmen} text=${(f) => `${f.name}${f.kontakt ? ` · ${f.kontakt}` : ''}`} onDelete=${async (f) => { await api.softDelete('firmen', f.id); r(); }} />
    <${NeueZeile} felder=${[['name', 'Firma'], ['kontakt', 'Kontakt (optional)']]} knopf="Firma anlegen"
      onSave=${async (v) => { await api.insert('firmen', { name: v.name, kontakt: v.kontakt || null }); r(); }} />

    <${Checklisten} api=${api} listen=${checklisten(d.data.einstellungen)} reload=${r} />
    <${Dokumente} api=${api} dokumente=${d.data.dokumente} reload=${r} />
    <${Archiv} api=${api} />
    <${Koordinaten} api=${api} wert=${d.data.einstellungen.find((e) => e.schluessel === 'haus_koordinaten')?.wert} reload=${r} />
  </div>`;
}

const rund = (v) => Math.round(v * 100) / 100;
const rStil = (f) => `left:${f.x1}%;top:${f.y1}%;width:${f.x2 - f.x1}%;height:${f.y2 - f.y1}%`;

function EtageKarte({ api, etage, raeume, reload }) {
  const [modus, setModus] = useState(null); // 'raeume' | 'passpunkte'
  const [name, setName] = useState('');
  const ecke = useRef(null); const [eckeSichtbar, setEcke] = useState(null);
  const [rechteck, setRechteck] = useState(null);
  const [letzter, setLetzter] = useState(null); // zuletzt angelegter Raum (für L-Form)
  const [anhaengen, setAnhaengen] = useState(null);
  const [pp, setPpState] = useState([]);
  const ppRef = useRef([]); // schnelle Tipps hintereinander dürfen keinen Punkt verlieren
  const setPp = (v) => { ppRef.current = v; setPpState(v); };
  const urls = useUrls(api, [etage.plan_key, etage.bestand_key]);

  const [fehler, setFehler] = useState('');
  const hochladen = (feld) => async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFehler('');
    try { await hochladenIntern(feld, file); } catch (err) { setFehler(`Hochladen fehlgeschlagen: ${err.message ?? err}`); }
  };
  const hochladenIntern = async (feld, file) => {
    const key = `plaene/${etage.id}-${feld === 'bestand' ? 'bestand-' : ''}${safeName(file.name)}`;
    await api.put(key, file, file.type || 'image/png');
    if (feld === 'plan') { const m = await bildMasse(api, file); await api.update('etagen', etage.id, { plan_key: key, plan_breite: m.width, plan_hoehe: m.height }); }
    else await api.update('etagen', etage.id, { bestand_key: key, bestand_passpunkte: null });
    reload();
  };
  const tipp = async (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: Math.round(((e.clientX - r.left) / r.width) * 10000) / 100, y: Math.round(((e.clientY - r.top) / r.height) * 10000) / 100 };
    if (modus === 'raeume') {
      if (!ecke.current) { ecke.current = p; setEcke(p); setRechteck(null); return; }
      const r = normRect(ecke.current, p); ecke.current = null; setEcke(null);
      setRechteck({ x1: rund(r.x1), y1: rund(r.y1), x2: rund(r.x2), y2: rund(r.y2) });
      return;
    }
    if (modus === 'passpunkte') {
      const neu = [...ppRef.current, p]; setPp(neu);
      if (neu.length === 4) {
        await api.update('etagen', etage.id, { bestand_passpunkte: { plan: neu.slice(0, 2), bestand: neu.slice(2) } });
        setPp([]); setModus(null); reload();
      }
    }
  };
  const ppHinweis = ['Punkt 1 im neuen Plan antippen (z. B. eine Hausecke)', 'Punkt 2 im neuen Plan (möglichst weit entfernt)',
    'Denselben Punkt 1 im Bestandsplan', 'Denselben Punkt 2 im Bestandsplan'][pp.length];
  const zeigeBestand = modus === 'passpunkte' && pp.length >= 2;

  return html`<div class="karte etage">
    <b>${etage.name}</b>
    ${fehler && html`<p class="fehler" role="alert">${fehler}</p>`}
    <label>Grundriss (Bild)<input type="file" accept="image/*" name=${`plan-${etage.id}`} onChange=${hochladen('plan')} /></label>
    <label>Nordrichtung: ${etage.nord_grad ?? 0}° <span class="nordpfeil" style=${`transform: rotate(${etage.nord_grad ?? 0}deg)`}>⬆︎N</span>
      <input type="range" min="0" max="359" name=${`nord-${etage.id}`} value=${etage.nord_grad ?? 0}
        onChange=${async (e) => { await api.update('etagen', etage.id, { nord_grad: Number(e.target.value) }); reload(); }} /></label>
    <label>Bestandsplan (optional)<input type="file" accept="image/*" name=${`bestand-${etage.id}`} onChange=${hochladen('bestand')} /></label>
    <div class="knopfgitter klein">
      <button aria-pressed=${modus === 'raeume'} onClick=${() => setModus(modus === 'raeume' ? null : 'raeume')}>Räume (${raeume.length})</button>
      ${etage.bestand_key && html`<button aria-pressed=${modus === 'passpunkte'} onClick=${() => { setPp([]); setModus(modus === 'passpunkte' ? null : 'passpunkte'); }}>Passpunkte${etage.bestand_passpunkte ? ' ✓' : ''}</button>`}
    </div>
    ${modus && html`<div>
      <p class="hinweis">${modus === 'raeume' ? 'Zwei gegenüberliegende Ecken des Raums antippen, dann benennen. L-förmige Räume: danach „+ weiteres Rechteck“.' : ppHinweis}</p>
      <div class="setup-plan" style=${`aspect-ratio: ${etage.plan_breite && etage.plan_hoehe ? etage.plan_breite / etage.plan_hoehe : 1.4}`} onClick=${tipp}>
        <img src=${(zeigeBestand ? urls[etage.bestand_key] : urls[etage.plan_key]) ?? ''} alt="" draggable="false" />
        ${modus === 'raeume' && raeume.flatMap((r) => (r.flaechen ?? []).map((f) => html`<span class="raum-rahmen" style=${rStil(f)}><b>${r.name}</b></span>`))}
        ${modus === 'raeume' && eckeSichtbar && html`<span class="pp" style=${`left:${eckeSichtbar.x}%;top:${eckeSichtbar.y}%`}>+</span>`}
        ${modus === 'raeume' && rechteck && html`<span class="raum-rahmen neu" style=${rStil(rechteck)}></span>`}
        ${modus === 'passpunkte' && pp.filter((_, i) => (zeigeBestand ? i >= 2 : i < 2)).map((p) => html`<span class="pp" style=${`left:${p.x}%;top:${p.y}%`}>+</span>`)}
      </div>
      ${rechteck && !anhaengen && html`<div class="zeile"><input name="raumname" placeholder="Raumname" value=${name} onInput=${(e) => setName(e.target.value)} />
        <button class="primaer" onClick=${async () => {
          if (!name.trim()) return;
          const neu = await api.insert('raeume', { etage_id: etage.id, name: name.trim(), flaechen: [rechteck] });
          setRechteck(null); setName(''); setLetzter(neu); reload();
        }}>Hinzufügen</button></div>`}
      ${rechteck && anhaengen && html`<button class="primaer" onClick=${async () => {
          await api.update('raeume', anhaengen.id, { flaechen: [...(anhaengen.flaechen ?? []), rechteck] });
          setRechteck(null); setAnhaengen(null); reload();
        }}>Rechteck hinzufügen</button>`}
      ${modus === 'raeume' && letzter && !rechteck && !anhaengen && html`<button class="link" onClick=${() => {
          setAnhaengen(raeume.find((r) => r.id === letzter.id) ?? letzter); }}>+ weiteres Rechteck für ${letzter.name}</button>`}
      ${anhaengen && !rechteck && html`<p class="hinweis">Zweites Rechteck für ${anhaengen.name}: zwei Ecken antippen.</p>`}
      ${modus === 'raeume' && html`<${Liste} rows=${raeume} text=${(r) => (r.flaechen?.length ? r.name : `${r.name} – neu aufziehen`)}
        onDelete=${async (r) => { await api.softDelete('raeume', r.id); reload(); }} />`}
    </div>`}
  </div>`;
}

function Gewerke({ api, gewerke, reload }) {
  const [v, setV] = useState({ bereich: '', name: '', din: '', eigen: false });
  const [fehler, setFehler] = useState('');
  return html`<div><h3>Gewerke</h3>
    <${Liste} rows=${gewerke} text=${(g) => `${g.bereich} · ${g.name}${g.din276 ? ` (${g.din276})` : ''}${g.eigenleistung ? ' · Eigenleistung' : ''}`}
      onDelete=${async (g) => { await api.softDelete('gewerke', g.id); reload(); }} />
    <div class="karte formular">
      <input name="gewerk-bereich" placeholder="Bereich (z. B. Technik)" value=${v.bereich} onInput=${(e) => setV({ ...v, bereich: e.target.value })} />
      <input name="gewerk-name" placeholder="Gewerk (z. B. Elektro)" value=${v.name} onInput=${(e) => setV({ ...v, name: e.target.value })} />
      <input name="gewerk-din" placeholder="DIN 276 (optional)" value=${v.din} onInput=${(e) => setV({ ...v, din: e.target.value })} />
      <label class="check"><input type="checkbox" checked=${v.eigen} onChange=${(e) => setV({ ...v, eigen: e.target.checked })} /> Eigenleistung</label>
      <button class="primaer" onClick=${async () => {
        if (!v.bereich.trim() || !v.name.trim()) { setFehler('Bitte Bereich und Name angeben.'); return; }
        await api.insert('gewerke', { bereich: v.bereich.trim(), name: v.name.trim(), din276: v.din.trim() || null, eigenleistung: v.eigen, sortierung: gewerke.length + 1 });
        setV({ bereich: v.bereich, name: '', din: '', eigen: false }); setFehler(''); reload();
      }}>Gewerk anlegen</button>
      ${fehler && html`<p class="fehler">${fehler}</p>`}
    </div></div>`;
}

function Dokumente({ api, dokumente, reload }) {
  const urls = useUrls(api, dokumente.map((x) => x.key));
  return html`<div><h3>Dokumente</h3>
    <p class="hinweis">Fachpläne (Elektro, Sanitär, Statik), DXF-Dateien usw.</p>
    ${dokumente.map((x) => html`<div class="zeile"><a href=${urls[x.key]} target="_blank" rel="noopener">${x.titel}</a>
      <button aria-label="Löschen" onClick=${async () => { await api.softDelete('dokumente', x.id); reload(); }}>🗑</button></div>`)}
    <label>Dokument hinzufügen<input type="file" name="dokument" onChange=${async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const key = `dokumente/${kurzId()}-${safeName(f.name)}`;
      await api.put(key, f, f.type || 'application/octet-stream');
      await api.insert('dokumente', { titel: f.name, key, mime: f.type || null, groesse: f.size });
      reload();
    }} /></label></div>`;
}

function Koordinaten({ api, wert, reload }) {
  const [v, setV] = useState({ lat: wert?.lat ?? '', lon: wert?.lon ?? '' });
  return html`<div><h3>Haus-Koordinaten (für das Wetter)</h3>
    <div class="zeile"><input name="lat" inputmode="decimal" placeholder="Breite, z. B. 51.6" value=${v.lat} onInput=${(e) => setV({ ...v, lat: e.target.value })} />
      <input name="lon" inputmode="decimal" placeholder="Länge, z. B. 6.2" value=${v.lon} onInput=${(e) => setV({ ...v, lon: e.target.value })} /></div>
    <button onClick=${async () => {
      const lat = Number(`${v.lat}`.replace(',', '.')); const lon = Number(`${v.lon}`.replace(',', '.'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      await api.upsert('einstellungen', { schluessel: 'haus_koordinaten', wert: { lat, lon } }, 'schluessel'); reload();
    }}>Koordinaten speichern</button></div>`;
}

function Checklisten({ api, listen, reload }) {
  const [name, setName] = useState('');
  const [punkte, setPunkte] = useState('');
  const speichern = (wert) => api.upsert('einstellungen', { schluessel: 'checklisten', wert }, 'schluessel');
  return html`<div><h3>Foto-Checklisten</h3>
    <p class="hinweis">Kontrollpunkte, zu denen ein Foto gemacht werden soll (z. B. für den Statiker).</p>
    ${listen.map((l, i) => html`<div class="karte"><div class="zeile"><b>${l.name}</b>
      <button aria-label="Löschen" onClick=${async () => { await speichern(listen.filter((_, j) => j !== i)); reload(); }}>🗑</button></div>
      <div class="hinweis">${l.punkte.join(' · ')}</div></div>`)}
    <input name="checkliste-name" placeholder="Name (z. B. Dach)" value=${name} onInput=${(e) => setName(e.target.value)} />
    <textarea name="checkliste-punkte" placeholder="Ein Punkt pro Zeile" value=${punkte} onInput=${(e) => setPunkte(e.target.value)} />
    <button onClick=${async () => {
      const p = punkte.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!name.trim() || !p.length) return;
      await speichern([...listen, { name: name.trim(), punkte: p }]); setName(''); setPunkte(''); reload();
    }}>Checkliste anlegen</button></div>`;
}

function Archiv({ api }) {
  const [monat, setMonat] = useState(new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState('');
  const speichern = api.downloadZip ?? ((daten, name) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([daten], { type: 'application/zip' })); a.download = name; a.click();
  });
  return html`<div><h3>Archiv</h3>
    <p class="hinweis">Das vollständige Archiv erzeugt der wöchentliche Export. Hier: ein Monat als ZIP (Daten + Fotos).</p>
    <div class="zeile"><input type="month" name="archiv-monat" value=${monat} onInput=${(e) => setMonat(e.target.value)} />
      <button onClick=${async () => {
        setStatus('Wird erstellt …');
        try { const z = await monatsArchiv(api, monat, blobLoader(api)); speichern(z.daten, z.name); setStatus(''); }
        catch { setStatus('Archiv konnte nicht erstellt werden (Netz?).'); }
      }}>Archiv herunterladen</button></div>
    ${status && html`<p class="hinweis">${status}</p>`}</div>`;
}

function Liste({ rows, text, onDelete }) {
  return html`<ul class="liste">${rows.map((x) => html`<li><span>${text(x)}</span>
    <button aria-label="Löschen" onClick=${() => onDelete(x)}>🗑</button></li>`)}</ul>`;
}

function NeueZeile({ felder, knopf, onSave }) {
  const leer = Object.fromEntries(felder.map(([k]) => [k, '']));
  const [v, setV] = useState(leer);
  return html`<div class="zeile neu">
    ${felder.map(([k, ph]) => html`<input name=${`neu-${k}`} placeholder=${ph} value=${v[k]} onInput=${(e) => setV({ ...v, [k]: e.target.value })} />`)}
    <button onClick=${async () => { if (!v[felder[0][0]].trim()) return; await onSave(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]))); setV(leer); }}>${knopf}</button>
  </div>`;
}
