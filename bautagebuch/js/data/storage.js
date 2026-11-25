// Zugriff auf den privaten R2-Bucket über die Edge Function r2-sign.
import { R2_SIGN_FUNCTION } from '../config.js';

const cache = new Map(); // key → { url, bis }
const CACHE_MS = 240_000;

export function makeSign(supabase) {
  return async function sign(ops) {
    const { data, error } = await supabase.functions.invoke(R2_SIGN_FUNCTION, { body: { ops } });
    if (error) throw error;
    return data.urls;
  };
}

export async function upload(url, blob, contentType) {
  const r = await fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
  if (!r.ok) throw new Error(`Upload fehlgeschlagen (${r.status})`);
}

/** Signierte Lese-URL, 4 Minuten zwischengespeichert (gültig sind sie 5). */
export async function signedUrl(sign, key, jetzt = Date.now()) {
  const c = cache.get(key);
  if (c && c.bis > jetzt) return c.url;
  const [url] = await sign([{ method: 'GET', key }]);
  cache.set(key, { url, bis: jetzt + CACHE_MS });
  return url;
}
