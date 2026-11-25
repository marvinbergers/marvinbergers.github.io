// Grundriss mit Räumen. Tipp auf einen Raum: Raum groß, dann eine Wand (oder Boden/Decke) antippen.
// Zwei Finger: zoomen und verschieben.
import { html } from '../vendor/htm.js';
import { useState, useRef, useEffect } from '../vendor/preact.js';
import { fitTransform } from '../lib/geometry.js';
import { roomAt, roomBox, fitView, wandNamen } from '../lib/rooms.js';

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
  const namen = wandNamen(etage?.nord_grad ?? 0);

  // Raum aktiv → auf ihn zoomen; kein Raum → Gesamtansicht.
  useEffect(() => {
    const r = rahmen.current;
    if (!aktiverRaum?.flaechen?.length || !r?.clientWidth) { setAnsicht({ s: 1, x: 0, y: 0 }); return; }
    const frame = { w: r.clientWidth, h: r.clientHeight };
    setAnsicht(fitView(roomBox(aktiverRaum), frame, 0.08, frame));
  }, [aktiverRaum?.id]);

  const toPlan = (e) => {
    const r = inhalt.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  function tipp(e) {
    if (gezoomt.current) { gezoomt.current = false; return; }
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
  const box = aktiverRaum?.flaechen?.length ? roomBox(aktiverRaum) : null;
  const wandKnopf = (seite, cls) => html`<button class=${`wand ${cls}`} data-seite=${seite} onClick=${() => onWand(seite)}>
    ${namen[seite]}${wandZahlen[seite] ? html` <span class="zahl">${wandZahlen[seite]}</span>` : ''}</button>`;

  return html`<div class="grundriss">
    <div class="grundriss-kopf">
      ${aktiverRaum ? html`<button class="zurueck" onClick=${() => onRoom(null)}>‹ Grundriss</button><b class="flex1">${aktiverRaum.name}</b>` : kopf}
      ${etage?.bestand_key && html`<button class="bestand-schalter" aria-pressed=${bestand} onClick=${() => setBestand(!bestand)}>Bestand</button>`}
      ${!aktiverRaum && html`<button class="zoom" aria-label="Vergrößern" onClick=${() => zoom(1.4)}>+</button>
      <button class="zoom" aria-label="Verkleinern" onClick=${() => zoom(1 / 1.4)}>−</button>`}
      ${!ohneSchnellfoto && html`<button class="schnellfoto primaer" aria-label="Schnellfoto" onClick=${onQuickPhoto}>📷</button>`}
    </div>
    ${!aktiverRaum && raeume.some((r) => r.flaechen?.length) && html`<p class="hinweis klein">Raum antippen, dann die Wand.</p>`}
    <div class=${`plan-rahmen${aktiverRaum ? ' raumansicht' : ''}`} ref=${rahmen}>
      <div class="plan-inhalt" ref=${inhalt}
        style=${`transform: translate(${ansicht.x}px, ${ansicht.y}px) scale(${ansicht.s}); aspect-ratio: ${aspect};`}
        onClick=${tipp} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}>
        ${planUrl ? html`<img class="plan-bild" src=${planUrl} alt=${`Grundriss ${etage?.name ?? ''}`} draggable="false" />`
                  : html`<p class="hinweis">Noch kein Grundriss für diese Etage. Unter Einrichtung hochladen.</p>`}
        ${bestand && bestandUrl && html`<img class="plan-bestand" src=${bestandUrl} alt="Bestandsplan" style=${bestandStil} draggable="false" />`}
        ${raeume.filter((r) => r.flaechen?.length).map((r) => {
          const b = roomBox(r);
          return html`<div class=${`raum${gedimmt.has(r.id) ? ' gedimmt' : ''}${aktiverRaum?.id === r.id ? ' aktiv' : ''}`} data-raum=${r.id}>
            ${r.flaechen.map((f) => html`<span class="raum-flaeche" style=${`left:${f.x1}%;top:${f.y1}%;width:${f.x2 - f.x1}%;height:${f.y2 - f.y1}%`}></span>`)}
            ${!aktiverRaum && html`<span class="raum-zahl" style=${`left:${(b.x1 + b.x2) / 2}%;top:${(b.y1 + b.y2) / 2}%;transform:translate(-50%,-50%) ${gegen}`}>
              ${raumZahlen[r.id] ? `📷 ${raumZahlen[r.id]}` : ''}</span>`}
          </div>`;
        })}
        ${box && html`<div class="raum-fokus" style=${`left:${box.x1}%;top:${box.y1}%;width:${box.x2 - box.x1}%;height:${box.y2 - box.y1}%`}></div>`}
      </div>
      ${aktiverRaum && html`${wandKnopf('oben', 'w-oben')}${wandKnopf('rechts', 'w-rechts')}${wandKnopf('unten', 'w-unten')}${wandKnopf('links', 'w-links')}`}
    </div>
    ${aktiverRaum && html`<div class="knopfgitter boden-decke">${wandKnopf('boden', '')}${wandKnopf('decke', '')}</div>`}
  </div>`;
}
