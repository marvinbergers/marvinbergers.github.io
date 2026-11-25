// Fotos auf dem Gerät verkleinern, Aufnahmedatum lesen, Fingerabdruck bilden.
import exifr from '../vendor/exifr.js';

export const MAX_KANTE = 2560;
export const VORSCHAU_KANTE = 400;
export const QUALITAET = 0.85;
export const VORSCHAU_QUALITAET = 0.8;
const FRUEHESTES = Date.UTC(2000, 0, 1);

export class FotoFehler extends Error {
  constructor(msg = 'Foto konnte nicht gelesen werden', cause) { super(msg); this.name = 'FotoFehler'; this.cause = cause; }
}

export function targetSize(w, h, max = MAX_KANTE) {
  const f = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * f), h: Math.round(h * f) };
}

export async function readCaptureDate(file) {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const exif = await exifr.parse(buf); // Lite-Build: ohne Feldliste lesen
    const d = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (d instanceof Date && !isNaN(d) && d.getTime() >= FRUEHESTES) return { date: d, geschaetzt: false };
  } catch { /* kein EXIF – weiter mit Dateidatum */ }
  if (file.lastModified && file.lastModified >= FRUEHESTES) return { date: new Date(file.lastModified), geschaetzt: true };
  return { date: new Date(), geschaetzt: true };
}

async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const browserDeps = {
  // imageOrientation dreht nach EXIF-Ausrichtung, damit Hochkantfotos nicht liegen.
  decode: (blob) => createImageBitmap(blob, { imageOrientation: 'from-image' }),
  async encode(bmp, w, h, q) {
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(w, h);
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      return c.convertToBlob({ type: 'image/jpeg', quality: q });
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q));
  },
};

export async function processImage(file, deps = browserDeps) {
  let bmp;
  try { bmp = await deps.decode(file); } catch (e) { throw new FotoFehler(undefined, e); }
  try {
    const gross = targetSize(bmp.width, bmp.height);
    const klein = targetSize(bmp.width, bmp.height, VORSCHAU_KANTE);
    const [bild, vorschau, sha256, datum] = await Promise.all([
      deps.encode(bmp, gross.w, gross.h, QUALITAET),
      deps.encode(bmp, klein.w, klein.h, VORSCHAU_QUALITAET),
      sha256Hex(file), // Fingerabdruck des Originals: gleiche Quelldatei = Duplikat, unabhängig vom Gerät
      readCaptureDate(file),
    ]);
    return { bild, vorschau, breite: gross.w, hoehe: gross.h, sha256, aufgenommenAm: datum.date, datumGeschaetzt: datum.geschaetzt };
  } catch (e) {
    throw e instanceof FotoFehler ? e : new FotoFehler(undefined, e);
  } finally { bmp.close?.(); }
}
