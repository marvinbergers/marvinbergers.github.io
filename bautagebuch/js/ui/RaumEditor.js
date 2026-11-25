// Raum zeichnen (Ecke für Ecke) und bearbeiten (Ecken ziehen, einfügen, löschen). Übernommen wird erst mit „Speichern“.
import { html } from '../vendor/htm.js';
import { useState, useRef } from '../vendor/preact.js';
import { einrasten, punktEinfuegen, punktLoeschen, kanten, neueEckenId, uhrzeigersinn } from '../lib/polygon.js';
import { speichereRaum } from '../data/actions.js';

const SCHLIESSEN = 2; // Prozent: so nah am ersten Punkt schließt der Raum
const rund = (v) => Math.round(v * 100) / 100;
const punkte = (e) => e.map((p) => `${p.x},${p.y}`).join(' ');

export function RaumEditor({ api, etage, raum = null, andere = [], planUrl, onDone }) {
  const [ecken, setEckenState] = useState(raum?.ecken ? uhrzeigersinn(raum.ecken) : []);
  const eckenRef = useRef(ecken); // schnelle Tipps hintereinander dürfen keinen Punkt verlieren
  const setEcken = (v) => { eckenRef.current = v; setEckenState(v); };
  const [geschlossen, setGeschlossen] = useState(raum?.ecken?.length >= 3);
  const [name, setName] = useState(raum?.name ?? '');
  const [auswahl, setAuswahl] = useState(null);
  const [umzuege, setUmzuege] = useState([]);
  const [fehler, setFehler] = useState('');
  const flaeche = useRef(null);
  const zieht = useRef(null);
  const aspect = etage.plan_breite && etage.plan_hoehe ? etage.plan_breite / etage.plan_hoehe : 1.4;

  const toPlan = (e) => {
    const r = flaeche.current.getBoundingClientRect();
    return { x: rund(((e.clientX - r.left) / r.width) * 100), y: rund(((e.clientY - r.top) / r.height) * 100) };
  };
  const gerastet = (p) => { const q = einrasten(p, andere); return { x: rund(q.x), y: rund(q.y) }; };

  function tipp(e) {
    if (geschlossen) { setAuswahl(null); return; }
    const p = toPlan(e); const e0 = eckenRef.current;
    if (e0.length >= 3 && Math.hypot(e0[0].x - p.x, e0[0].y - p.y) <= SCHLIESSEN) { setGeschlossen(true); return; }
    setEcken([...e0, { id: neueEckenId(), ...gerastet(p) }]);
  }
  function ziehStart(e, id) { e.stopPropagation(); zieht.current = id; setAuswahl(id); }
  function zieh(e) {
    if (!zieht.current) return;
    const p = gerastet(toPlan(e));
    setEcken(eckenRef.current.map((q) => (q.id === zieht.current ? { ...q, ...p } : q)));
  }
  function ziehEnde() { zieht.current = null; }

  async function speichern() {
    setFehler('');
    if (ecken.length < 3) { setFehler('Ein Raum braucht mindestens 3 Ecken.'); return; }
    if (!name.trim()) { setFehler('Bitte einen Namen eingeben.'); return; }
    try {
      if (raum) {
        await speichereRaum(api, etage, raum, ecken, umzuege);
        if (name.trim() !== raum.name) await api.update('raeume', raum.id, { name: name.trim() });
      } else {
        await api.insert('raeume', { etage_id: etage.id, name: name.trim(), ecken: uhrzeigersinn(ecken) });
      }
      onDone(true);
    } catch (err) { setFehler(`Speichern fehlgeschlagen: ${err.message ?? err}`); }
  }

  // Gleich bleibender Hinweis: ein wechselnder Text würde den Plan während des Zeichnens verschieben.
  const hinweis = !geschlossen
    ? 'Ecken nacheinander antippen. Schließen: ersten Punkt antippen oder „Fertig“.'
    : 'Ecken ziehen zum Verschieben, „+“ für eine neue Ecke, Ecke antippen zum Löschen.';

  return html`<div class="raum-editor karte">
    <b>${raum ? `Raum bearbeiten: ${raum.name}` : 'Neuer Raum'}</b>
    <p class="hinweis">${hinweis}</p>
    <div class="setup-plan" ref=${flaeche} style=${`aspect-ratio: ${aspect}`}
      onClick=${tipp} onPointerMove=${zieh} onPointerUp=${ziehEnde} onPointerCancel=${ziehEnde}>
      <img src=${planUrl ?? ''} alt="" draggable="false" />
      <svg class="raum-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        ${andere.filter((r) => r.ecken?.length >= 3).map((r) => html`<polygon class="andere" points=${punkte(r.ecken)} vector-effect="non-scaling-stroke" />`)}
        ${ecken.length > 1 && (geschlossen
          ? html`<polygon class="entwurf" points=${punkte(ecken)} vector-effect="non-scaling-stroke" />`
          : html`<polyline class="entwurf" points=${punkte(ecken)} vector-effect="non-scaling-stroke" />`)}
      </svg>
      ${geschlossen && kanten(ecken).map((k) => html`<button class="plus" data-plus=${k.id} aria-label="Ecke einfügen"
        style=${`left:${(k.a.x + k.b.x) / 2}%;top:${(k.a.y + k.b.y) / 2}%`}
        onClick=${(e) => { e.stopPropagation(); setEcken(punktEinfuegen(eckenRef.current, k.id, neueEckenId())); }}>+</button>`)}
      ${ecken.map((p, i) => html`<button class=${`ecke${auswahl === p.id ? ' gewaehlt' : ''}${i === 0 && !geschlossen ? ' erste' : ''}`} data-ecke=${p.id}
        aria-label="Ecke" style=${`left:${p.x}%;top:${p.y}%`}
        onPointerDown=${(e) => geschlossen && ziehStart(e, p.id)}
        onClick=${(e) => { e.stopPropagation(); if (!geschlossen) { if (i === 0 && ecken.length >= 3) setGeschlossen(true); return; } setAuswahl(p.id); }}></button>`)}
    </div>
    <div class="knopfgitter klein">
      ${!geschlossen && html`<button disabled=${!ecken.length} onClick=${() => setEcken(eckenRef.current.slice(0, -1))}>Letzten Punkt zurück</button>
        <button class="primaer" disabled=${ecken.length < 3} onClick=${() => setGeschlossen(true)}>Fertig</button>`}
      ${geschlossen && auswahl && html`<button onClick=${() => {
        try {
          const r = punktLoeschen(eckenRef.current, auswahl);
          setEcken(r.ecken); setUmzuege([...umzuege, r.umzug]); setAuswahl(null);
        } catch (err) { setFehler(err.message); }
      }}>Punkt löschen</button>`}
    </div>
    ${geschlossen && html`<div class="zeile">
      <input name="raumname" placeholder="Raumname" value=${name} onInput=${(e) => setName(e.target.value)} />
      <button class="primaer" onClick=${speichern}>Speichern</button></div>`}
    <button onClick=${() => onDone(false)}>Abbrechen</button>
    ${fehler && html`<p class="fehler" role="alert">${fehler}</p>`}
  </div>`;
}
