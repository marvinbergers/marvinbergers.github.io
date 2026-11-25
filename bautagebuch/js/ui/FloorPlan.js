// Grundriss mit Stellen. Ein Finger: Drücken und in Blickrichtung ziehen = neue Stelle.
// Zwei Finger: zoomen und verschieben. Tipp auf eine Stelle: auswählen.
import { html } from '../vendor/htm.js';
import { useState, useRef } from '../vendor/preact.js';
import { dragToDirection, suggestName, fitTransform } from '../lib/geometry.js';

const rund = (v) => Math.round(v * 100) / 100;

export function FloorPlan({
  etage, planUrl, bestandUrl, stellen = [], raeume = [], verschiebe = null,
  onSelectStelle = () => {}, onCreateStelle = () => {}, onMoveStelle = () => {}, onQuickPhoto = () => {},
  kopf = null,
}) {
  const inhalt = useRef(null);
  const pointer = useRef(new Map());
  const start = useRef(null);
  const pinch = useRef(null);
  const [ansicht, setAnsicht] = useState({ s: 1, x: 0, y: 0 });
  const [neu, setNeu] = useState(null);
  const [bestand, setBestand] = useState(false);
  const aspect = etage?.plan_breite && etage?.plan_hoehe ? etage.plan_breite / etage.plan_hoehe : 1;

  const toPlan = (e) => {
    const r = inhalt.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  function down(e) {
    if (e.target.closest?.('[data-stelle], button')) return;
    pointer.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointer.current.size === 1) start.current = toPlan(e);
    if (pointer.current.size === 2) {
      start.current = null;
      const [a, b] = [...pointer.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ansicht };
    }
  }
  function move(e) {
    if (!pointer.current.has(e.pointerId)) return;
    pointer.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointer.current.size === 2) {
      const [a, b] = [...pointer.current.values()];
      const p = pinch.current;
      const s = Math.min(6, Math.max(1, p.ansicht.s * (Math.hypot(a.x - b.x, a.y - b.y) / p.d)));
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // Punkt unter der Fingermitte bleibt unter der Fingermitte.
      const k = s / p.ansicht.s;
      setAnsicht({ s, x: m.x - k * (p.m.x - p.ansicht.x), y: m.y - k * (p.m.y - p.ansicht.y) });
    }
  }
  function up(e) {
    const war = pointer.current.size;
    pointer.current.delete(e.pointerId);
    if (war === 2) { pinch.current = null; return; }
    if (!start.current) return;
    const ende = toPlan(e);
    const richtung = dragToDirection(start.current, ende, aspect);
    const p = start.current;
    start.current = null;
    if (richtung === null) return;
    const pos = { x: rund(p.x), y: rund(p.y), richtung_grad: richtung };
    if (verschiebe) { onMoveStelle(verschiebe.id, pos); return; }
    setNeu({ ...pos, name: suggestName(p, richtung, etage?.nord_grad ?? 0, raeume) });
  }

  const zoom = (f) => setAnsicht((a) => ({ ...a, s: Math.min(6, Math.max(1, a.s * f)) }));

  let bestandStil = '';
  if (bestand && etage?.bestand_passpunkte) {
    const t = fitTransform(etage.bestand_passpunkte.plan, etage.bestand_passpunkte.bestand);
    // Passpunkte liegen in Prozent; Verschiebung daher in Prozent der Fläche.
    bestandStil = `transform: translate(${t.tx}%, ${t.ty}%) rotate(${t.rotation}rad) scale(${t.scale}); transform-origin: 0 0;`;
  }

  return html`<div class="grundriss">
    <div class="grundriss-kopf">
      ${kopf}
      ${etage?.bestand_key && html`<button class="bestand-schalter" aria-pressed=${bestand} onClick=${() => setBestand(!bestand)}>Bestand</button>`}
      <button class="zoom" aria-label="Vergrößern" onClick=${() => zoom(1.4)}>+</button>
      <button class="zoom" aria-label="Verkleinern" onClick=${() => zoom(1 / 1.4)}>−</button>
      <button class="schnellfoto primaer" aria-label="Schnellfoto" onClick=${onQuickPhoto}>📷</button>
    </div>
    ${verschiebe && html`<p class="hinweis">Neue Position: auf den Plan drücken und in Blickrichtung ziehen.</p>`}
    <div class="plan-rahmen">
      <div class="plan-inhalt" ref=${inhalt}
        style=${`transform: translate(${ansicht.x}px, ${ansicht.y}px) scale(${ansicht.s}); aspect-ratio: ${aspect};`}
        onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}>
        ${planUrl ? html`<img class="plan-bild" src=${planUrl} alt=${`Grundriss ${etage?.name ?? ''}`} draggable="false" />`
                  : html`<p class="hinweis">Noch kein Grundriss für diese Etage. Unter Einrichtung hochladen.</p>`}
        ${bestand && bestandUrl && html`<img class="plan-bestand" src=${bestandUrl} alt="Bestandsplan" style=${bestandStil} draggable="false" />`}
        ${stellen.map((s) => html`<button class="stelle" data-stelle=${s.id} title=${s.name}
            style=${`left:${s.x}%;top:${s.y}%`} onClick=${() => onSelectStelle(s)}>
            <span class="pfeil" style=${`transform: rotate(${s.richtung_grad}deg)`}>▲</span></button>`)}
      </div>
    </div>
    ${neu && html`<div class="dialog karte" role="dialog" aria-label="Neue Stelle">
      <label>Name der Stelle<input name="stellenname" value=${neu.name} onInput=${(e) => setNeu({ ...neu, name: e.target.value })} /></label>
      <div class="knopfgitter">
        <button onClick=${() => setNeu(null)}>Abbrechen</button>
        <button class="primaer" onClick=${() => { const { name, ...pos } = neu; setNeu(null); onCreateStelle({ ...pos, name: name.trim() || neu.name }); }}>Anlegen</button>
      </div>
    </div>`}
  </div>`;
}
