// Grundriss mit Räumen. Tipp auf einen Raum: Raum groß, dann eine Wand (oder Boden/Decke) antippen.
// Zwei Finger: zoomen und verschieben.
import { html } from '../vendor/htm.js';
import { useState, useRef, useEffect } from '../vendor/preact.js';
import { fitTransform } from '../lib/geometry.js';
import { fitView } from '../lib/rooms.js';
import { roomAt, polyBox, raumPunkt, wandNamen, kanten, uhrzeigersinn } from '../lib/polygon.js';

export function FloorPlan({
  etage, planUrl, bestandUrl, raeume = [], raumZahlen = {}, gedimmt = new Set(), aktiverRaum = null, wandZahlen = {},
  onRoom = () => {}, onWand = () => {}, onQuickPhoto = () => {}, kopf = null, ohneSchnellfoto = false,
}) {
  const inhalt = useRef(null);
  const rahmen = useRef(null);
  const pointer = useRef(new Map());
  const pinch = useRef(null);
  const gezoomt = useRef(false); // nach einer Zwei-Finger-Geste keinen Raum-Tipp auslösen
  const [ansicht, setAnsicht] = useState({ s: 1, x: 0, y: 0 });
  const [bestand, setBestand] = useState(false);
  const aspect = etage?.plan_breite && etage?.plan_hoehe ? etage.plan_breite / etage.plan_hoehe : 1;

  // Raum aktiv → auf ihn zoomen; kein Raum → Gesamtansicht.
  useEffect(() => {
    const r = rahmen.current;
    if (!(aktiverRaum?.ecken?.length >= 3) || !r?.clientWidth) { setAnsicht({ s: 1, x: 0, y: 0 }); return; }
    const frame = { w: r.clientWidth, h: r.clientHeight };
    setAnsicht(fitView(polyBox(aktiverRaum.ecken), frame, 0.12, frame));
  }, [aktiverRaum?.id]);

  const toPlan = (e) => {
    const r = inhalt.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  function tipp(e) {
    if (gezoomt.current) { gezoomt.current = false; return; }
    if (e.target.closest?.('.raum-punkt')) return; // der Punkt hat einen eigenen Klick
    const raum = roomAt(toPlan(e), raeume);
    if (raum && raum.id !== aktiverRaum?.id) onRoom(raum);
  }
  function down(e) {
    pointer.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointer.current.size === 2) {
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
      const k = s / p.ansicht.s;
      gezoomt.current = true;
      setAnsicht({ s, x: m.x - k * (p.m.x - p.ansicht.x), y: m.y - k * (p.m.y - p.ansicht.y) });
    }
  }
  function up(e) {
    pointer.current.delete(e.pointerId);
    if (pointer.current.size < 2) pinch.current = null;
  }

  // Knöpfe zoomen zur Mitte des sichtbaren Ausschnitts hin.
  const zoom = (f) => setAnsicht((a) => {
    const s = Math.min(6, Math.max(1, a.s * f));
    const r = rahmen.current; const cx = (r?.clientWidth ?? 0) / 2; const cy = (r?.clientHeight ?? 0) / 2;
    const k = s / a.s;
    return s === 1 ? { s: 1, x: 0, y: 0 } : { s, x: cx - k * (cx - a.x), y: cy - k * (cy - a.y) };
  });

  let bestandStil = '';
  if (bestand && etage?.bestand_passpunkte) {
    const t = fitTransform(etage.bestand_passpunkte.plan, etage.bestand_passpunkte.bestand);
    bestandStil = `transform: translate(${t.tx}%, ${t.ty}%) rotate(${t.rotation}rad) scale(${t.scale}); transform-origin: 0 0;`;
  }
  const gegen = `scale(${Math.round((1 / ansicht.s) * 1e4) / 1e4})`; // Beschriftungen bleiben gleich groß
  const mitEcken = raeume.filter((r) => r.ecken?.length >= 3);
  const aktiv = aktiverRaum?.ecken?.length >= 3 ? { ...aktiverRaum, ecken: uhrzeigersinn(aktiverRaum.ecken) } : null;
  const namen = aktiv ? wandNamen(aktiv, etage?.nord_grad ?? 0, aspect) : new Map();
  const punkte = (e) => e.map((p) => `${p.x},${p.y}`).join(' ');
  // Wandknöpfe auf der Mitte ihrer Linie, leicht nach innen versetzt
  const wandKnoepfe = aktiv ? kanten(aktiv.ecken).map((k) => {
    const mx = (k.a.x + k.b.x) / 2; const my = (k.a.y + k.b.y) / 2;
    const dx = (k.b.x - k.a.x) * aspect; const dy = k.b.y - k.a.y; const l = Math.hypot(dx, dy) || 1;
    const versatz = 3.5 / ansicht.s; // in Prozent der Planhöhe
    const x = mx + ((-dy / l) * versatz) / aspect; const y = my + (dx / l) * versatz;
    const key = `wand:${k.id}`;
    return html`<button class="wand" data-wand=${key} style=${`left:${x}%;top:${y}%;transform:translate(-50%,-50%) ${gegen}`}
      onClick=${(e) => { e.stopPropagation(); onWand({ seite: 'wand', kante: k.id }); }}>
      ${namen.get(k.id)}${wandZahlen[key] ? html` <span class="zahl">${wandZahlen[key]}</span>` : ''}</button>`;
  }) : null;
  const bdKnopf = (seite, text) => html`<button class="wand" data-wand=${seite} onClick=${() => onWand({ seite })}>
    ${text}${wandZahlen[seite] ? html` <span class="zahl">${wandZahlen[seite]}</span>` : ''}</button>`;

  return html`<div class="grundriss">
    <div class="grundriss-kopf">
      ${aktiverRaum ? html`<button class="zurueck" onClick=${() => onRoom(null)}>‹ Grundriss</button><b class="flex1">${aktiverRaum.name}</b>` : kopf}
      ${etage?.bestand_key && html`<button class="bestand-schalter" aria-pressed=${bestand} onClick=${() => setBestand(!bestand)}>Bestand</button>`}
      ${!aktiverRaum && html`<button class="zoom" aria-label="Vergrößern" onClick=${() => zoom(1.4)}>+</button>
      <button class="zoom" aria-label="Verkleinern" onClick=${() => zoom(1 / 1.4)}>−</button>`}
      ${!ohneSchnellfoto && html`<button class="schnellfoto primaer" aria-label="Schnellfoto" onClick=${onQuickPhoto}>📷</button>`}
    </div>
    ${!aktiverRaum && mitEcken.length > 0 && html`<p class="hinweis klein">Raum antippen, dann die Wand.</p>`}
    <div class=${`plan-rahmen${aktiverRaum ? ' raumansicht' : ''}`} ref=${rahmen}>
      <div class="plan-inhalt" ref=${inhalt}
        style=${`transform: translate(${ansicht.x}px, ${ansicht.y}px) scale(${ansicht.s}); aspect-ratio: ${aspect};`}
        onClick=${tipp} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}>
        ${planUrl ? html`<img class="plan-bild" src=${planUrl} alt=${`Grundriss ${etage?.name ?? ''}`} draggable="false" />`
                  : html`<p class="hinweis">Noch kein Grundriss für diese Etage. Unter Einrichtung hochladen.</p>`}
        ${bestand && bestandUrl && html`<img class="plan-bestand" src=${bestandUrl} alt="Bestandsplan" style=${bestandStil} draggable="false" />`}
        ${!aktiverRaum && mitEcken.map((r) => {
          const p = raumPunkt(r, aspect);
          return p && html`<button class=${`raum-punkt${gedimmt.has(r.id) ? ' gedimmt' : ''}`} data-raum=${r.id} aria-label=${r.name} title=${r.name}
            style=${`left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%) ${gegen}`} onClick=${() => onRoom(r)}></button>`;
        })}
        ${aktiv && html`<svg class="raum-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path class="raum-dunkel" fill-rule="evenodd" d=${`M-1000 -1000H1100V1100H-1000Z M${punkte(aktiv.ecken).replace(/ /g, ' L')}Z`} />
          <polygon class="raum-umriss" points=${punkte(aktiv.ecken)} vector-effect="non-scaling-stroke" />
        </svg>`}
        ${wandKnoepfe}
      </div>
    </div>
    ${aktiv && html`<div class="knopfgitter boden-decke">${bdKnopf('boden', 'Boden')}${bdKnopf('decke', 'Decke')}</div>`}
  </div>`;
}
