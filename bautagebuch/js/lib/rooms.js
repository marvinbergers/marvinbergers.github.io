// Räume als Rechteck-Flächen (Prozent des Planbilds) und ihre Wände.
import { toCompass } from './geometry.js';

export const SEITEN = ['oben', 'rechts', 'unten', 'links', 'boden', 'decke'];
const WINKEL = { oben: 0, rechts: 90, unten: 180, links: 270 };

export const normRect = (a, b) => ({ x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) });
const flaeche = (r) => (r.x2 - r.x1) * (r.y2 - r.y1);
const inRect = (p, r) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;

/** Raum unter dem Punkt; bei Überlappung der kleinere. Räume ohne Flächen (alte Punkt-Räume) werden nie getroffen. */
export function roomAt(p, raeume) {
  let best = null; let bestA = Infinity;
  for (const r of raeume ?? []) {
    for (const f of r.flaechen ?? []) {
      if (inRect(p, f) && flaeche(f) < bestA) { best = r; bestA = flaeche(f); }
    }
  }
  return best;
}

export function roomBox(raum) {
  const fs = raum.flaechen ?? [];
  return { x1: Math.min(...fs.map((f) => f.x1)), y1: Math.min(...fs.map((f) => f.y1)), x2: Math.max(...fs.map((f) => f.x2)), y2: Math.max(...fs.map((f) => f.y2)) };
}

/** Zoom und Verschiebung, damit box (Prozent) mit etwas Rand zentriert im Rahmen liegt. plan = Größe der Planfläche bei Zoom 1. */
export function fitView(box, frame, rand = 0.08, plan = frame) {
  const bw = ((box.x2 - box.x1) / 100) * plan.w; const bh = ((box.y2 - box.y1) / 100) * plan.h;
  const s = Math.min(6, frame.w / (bw * (1 + 2 * rand) || 1), frame.h / (bh * (1 + 2 * rand) || 1));
  if (s <= 1) return { s: 1, x: 0, y: 0 };
  const cx = (((box.x1 + box.x2) / 2) / 100) * plan.w; const cy = (((box.y1 + box.y2) / 2) / 100) * plan.h;
  return { s, x: frame.w / 2 - cx * s, y: frame.h / 2 - cy * s };
}

/** Anzeigenamen der Seiten nach dem Nordpfeil der Etage. */
export function wandNamen(nordGrad = 0) {
  const n = { boden: 'Boden', decke: 'Decke' };
  for (const [seite, w] of Object.entries(WINKEL)) n[seite] = `${toCompass(w, nordGrad)}wand`;
  const waende = Object.keys(WINKEL).map((s) => n[s]);
  if (new Set(waende).size < 4) for (const s of Object.keys(WINKEL)) n[s] = `Wand ${s}`; // Sicherheitsnetz
  return n;
}

export const wandTitel = (raum, seite, nordGrad) => `${raum.name} – ${wandNamen(nordGrad)[seite]}`;

/** Punkt für die Übersicht: Mitte des größten Rechtecks (liegt so auch bei L-Räumen sicher im Raum). */
export function raumPunkt(raum) {
  const f = [...(raum.flaechen ?? [])].sort((a, b) => flaeche(b) - flaeche(a))[0];
  return f ? { x: Math.round(((f.x1 + f.x2) / 2) * 100) / 100, y: Math.round(((f.y1 + f.y2) / 2) * 100) / 100 } : null;
}
