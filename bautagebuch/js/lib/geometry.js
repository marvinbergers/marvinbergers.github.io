// Grundriss-Geometrie. Koordinaten sind Prozent des Planbilds (0–100), Winkel in Grad,
// 0 = im Bild nach oben, im Uhrzeigersinn.

const MIN_ZUG = 2; // Prozent: kürzere Züge gelten als Tipp, nicht als Richtungsangabe

/**
 * Richtung eines Zugs. `aspect` = Planbreite / Planhöhe, damit nicht-quadratische Pläne
 * keine verzerrten Winkel liefern.
 */
export function dragToDirection(start, end, aspect = 1) {
  const dx = (end.x - start.x) * aspect;
  const dy = end.y - start.y;
  if (Math.hypot(end.x - start.x, dy) < MIN_ZUG) return null;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

const RICHTUNGEN = ['Nord', 'Ost', 'Süd', 'West'];

/** Himmelsrichtung eines Planwinkels; nordGrad = Planwinkel, in den Norden zeigt. */
export function toCompass(planDeg, nordGrad = 0) {
  const real = (((planDeg - nordGrad) % 360) + 360) % 360;
  return RICHTUNGEN[Math.floor(((real + 45) % 360) / 90)];
}

export function nearestRoom(point, raeume) {
  let best = null; let bestD = Infinity;
  for (const r of raeume ?? []) {
    const d = Math.hypot(r.x - point.x, r.y - point.y);
    if (d < bestD) { bestD = d; best = r.name; }
  }
  return best;
}

export function suggestName(point, richtungGrad, nordGrad, raeume) {
  const raum = nearestRoom(point, raeume) ?? 'Stelle';
  return `${raum} – ${toCompass(richtungGrad, nordGrad)}wand`;
}

/**
 * Ähnlichkeitstransformation (Maßstab, Drehung, Verschiebung), die die zwei Bestand-Passpunkte
 * auf die zwei Plan-Passpunkte abbildet.
 */
export function fitTransform(plan, bestand) {
  const [p1, p2] = plan; const [b1, b2] = bestand;
  const vb = { x: b2.x - b1.x, y: b2.y - b1.y };
  const vp = { x: p2.x - p1.x, y: p2.y - p1.y };
  const scale = Math.hypot(vp.x, vp.y) / Math.hypot(vb.x, vb.y);
  const rotation = Math.atan2(vp.y, vp.x) - Math.atan2(vb.y, vb.x);
  const c = Math.cos(rotation) * scale; const s = Math.sin(rotation) * scale;
  return { scale, rotation, tx: p1.x - (c * b1.x - s * b1.y), ty: p1.y - (s * b1.x + c * b1.y) };
}

export function applyTransform(t, p) {
  const c = Math.cos(t.rotation) * t.scale; const s = Math.sin(t.rotation) * t.scale;
  return { x: c * p.x - s * p.y + t.tx, y: s * p.x + c * p.y + t.ty };
}
