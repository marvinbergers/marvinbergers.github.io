// Speicherschlüssel im R2-Bucket. Dieselbe Regel prüft die Edge Function (supabase/functions/r2-sign/logic.ts).
export const KEY_REGEX = /^(fotos|plaene|dokumente)\/[\w\-/.äöüÄÖÜß]+$/;

export function isValidKey(key) {
  return typeof key === 'string' && KEY_REGEX.test(key) && !key.includes('..') && !key.includes('//');
}

export function fotoKeys(fotoId, datum) {
  const y = datum.getUTCFullYear();
  const m = String(datum.getUTCMonth() + 1).padStart(2, '0');
  return { bild: `fotos/${y}/${m}/${fotoId}.jpg`, vorschau: `fotos/${y}/${m}/${fotoId}_v.jpg` };
}
