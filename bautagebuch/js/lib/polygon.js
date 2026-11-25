// Räume als Vieleck: Ecken [{id, x, y}] in Prozent des Planbilds, im Uhrzeigersinn (Bildschirm, y nach unten).
// Eine Wand ist die Linie, die an einer Ecke beginnt (Kennung = Ecken-id).
import { toCompass } from './geometry.js';

const EINRAST = 1.5; // Prozent

export function pointInPolygon(p, ecken) {
  let drin = false;
  for (let i = 0, j = ecken.length - 1; i < ecken.length; j = i++) {
    const a = ecken[i]; const b = ecken[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) drin = !drin;
  }
  return drin;
}

/** Vorzeichenbehaftete Fläche (Bildschirmkoordinaten): positiv = im Uhrzeigersinn. */
const flaecheSigned = (e, aspect = 1) => e.reduce((s, p, i) => { const q = e[(i + 1) % e.length]; return s + (p.x * aspect * q.y - q.x * aspect * p.y); }, 0) / 2;
export const polyFlaeche = (e, aspect = 1) => Math.abs(flaecheSigned(e, aspect));

export function uhrzeigersinn(ecken) {
  return flaecheSigned(ecken) < 0 ? [ecken[0], ...ecken.slice(1).reverse()] : [...ecken];
}

export function roomAt(p, raeume) {
  let best = null; let bestA = Infinity;
  for (const r of raeume ?? []) {
    if (!(r.ecken?.length >= 3) || !pointInPolygon(p, r.ecken)) continue;
    const a = polyFlaeche(r.ecken);
    if (a < bestA) { best = r; bestA = a; }
  }
  return best;
}

export function polyBox(e) {
  return { x1: Math.min(...e.map((p) => p.x)), y1: Math.min(...e.map((p) => p.y)), x2: Math.max(...e.map((p) => p.x)), y2: Math.max(...e.map((p) => p.y)) };
}

export function kanten(ecken) {
  return ecken.map((a, i) => ({ id: a.id, a, b: ecken[(i + 1) % ecken.length] }));
}

/** Name jeder Wand nach ihrer Außenseite; doppelte Richtungen werden in Eckenreihenfolge nummeriert. */
export function wandNamen(raum, nordGrad = 0, aspect = 1) {
  const e = uhrzeigersinn(raum.ecken ?? []);
  const richtung = kanten(e).map((k) => {
    const dx = (k.b.x - k.a.x) * aspect; const dy = k.b.y - k.a.y;
    const nx = dy; const ny = -dx; // Außennormale bei Uhrzeigersinn
    const grad = ((Math.atan2(nx, -ny) * 180) / Math.PI + 360) % 360;
    return { id: k.id, r: toCompass(grad, nordGrad) };
  });
  const anzahl = {}; for (const x of richtung) anzahl[x.r] = (anzahl[x.r] ?? 0) + 1;
  const lauf = {};
  return new Map(richtung.map((x) => {
    lauf[x.r] = (lauf[x.r] ?? 0) + 1;
    return [x.id, anzahl[x.r] > 1 ? `${x.r}wand ${lauf[x.r]}` : `${x.r}wand`];
  }));
}

/** Punkt im Raum, möglichst weit von allen Wänden entfernt (für den Raumpunkt in der Übersicht). */
export function raumPunkt(raum, aspect = 1) {
  const e = raum.ecken ?? []; if (e.length < 3) return null;
  const b = polyBox(e); const N = 24;
  const abstand = (p) => Math.min(...kanten(e).map(({ a, b: c }) => segAbstand(p, a, c, aspect)));
  const mitte = { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 };
  const zurMitte = (p) => Math.hypot((p.x - mitte.x) * aspect, p.y - mitte.y);
  let best = null; let bestD = -1;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const p = { x: b.x1 + ((b.x2 - b.x1) * i) / N, y: b.y1 + ((b.y2 - b.y1) * j) / N };
    if (!pointInPolygon(p, e)) continue;
    const d = abstand(p);
    // bei gleichem Abstand (z. B. längliche Räume) den Punkt näher zur Mitte nehmen
    if (d > bestD + 1e-9 || (Math.abs(d - bestD) <= 1e-9 && zurMitte(p) < zurMitte(best))) { bestD = d; best = p; }
  }
  return best && { x: Math.round(best.x * 100) / 100, y: Math.round(best.y * 100) / 100 };
}

function segAbstand(p, a, b, aspect) {
  const ax = a.x * aspect; const bx = b.x * aspect; const px = p.x * aspect;
  const vx = bx - ax; const vy = b.y - a.y; const l2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (p.y - a.y) * vy) / l2));
  return Math.hypot(px - (ax + t * vx), p.y - (a.y + t * vy));
}

/** An Ecken anderer Räume einrasten. */
export function einrasten(p, andereRaeume, abstand = EINRAST) {
  let best = null; let bestD = abstand;
  for (const r of andereRaeume ?? []) for (const q of r.ecken ?? []) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bestD) { bestD = d; best = q; }
  }
  return best ? { x: best.x, y: best.y } : { x: p.x, y: p.y };
}

/** Neue Ecke in der Mitte der Linie ab `kanteId`; die erste Hälfte behält die Kennung. */
export function punktEinfuegen(ecken, kanteId, neueId) {
  const i = ecken.findIndex((p) => p.id === kanteId);
  const a = ecken[i]; const b = ecken[(i + 1) % ecken.length];
  const m = { id: neueId, x: Math.round(((a.x + b.x) / 2) * 100) / 100, y: Math.round(((a.y + b.y) / 2) * 100) / 100 };
  return [...ecken.slice(0, i + 1), m, ...ecken.slice(i + 1)];
}

/** Ecke löschen: die Linie davor reicht nun bis zur nächsten Ecke; Fotos der wegfallenden Wand ziehen dorthin um. */
export function punktLoeschen(ecken, id) {
  if (ecken.length <= 3) throw new Error('Ein Raum braucht mindestens 3 Ecken.');
  const i = ecken.findIndex((p) => p.id === id);
  const vorher = ecken[(i - 1 + ecken.length) % ecken.length];
  return { ecken: ecken.filter((p) => p.id !== id), umzug: { von: id, nach: vorher.id } };
}

export const neueEckenId = () => Math.random().toString(36).slice(2, 8);
