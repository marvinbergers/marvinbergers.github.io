// Reine Prüflogik, getrennt vom Deno-Einstieg, damit sie in Node testbar ist.
// Muss identisch sein mit bautagebuch/js/lib/keys.js (Test prüft das).
export const KEY_REGEX = /^(fotos|plaene|dokumente)\/[\w\-/.äöüÄÖÜß]+$/;
export const MAX_OPS = 50;
export const GUELTIG_SEKUNDEN = 300;

export type Op = { method: 'PUT' | 'GET' | 'DELETE'; key: string; contentType?: string };
export type Ergebnis = { ok: true; ops: Op[] } | { ok: false; status: 400; fehler: string };

export function isValidKey(key: unknown): boolean {
  return typeof key === 'string' && KEY_REGEX.test(key) && !key.includes('..') && !key.includes('//');
}

export function validateRequest(body: any): Ergebnis {
  const ops = body?.ops;
  if (!Array.isArray(ops) || ops.length === 0) return { ok: false, status: 400, fehler: 'ops fehlt' };
  if (ops.length > MAX_OPS) return { ok: false, status: 400, fehler: `höchstens ${MAX_OPS} Ops` };
  for (const op of ops) {
    if (!['PUT', 'GET', 'DELETE'].includes(op?.method)) return { ok: false, status: 400, fehler: 'ungültige Methode' };
    if (!isValidKey(op.key)) return { ok: false, status: 400, fehler: 'ungültiger Schlüssel' };
    if (op.method === 'PUT' && typeof op.contentType !== 'string') return { ok: false, status: 400, fehler: 'contentType fehlt' };
  }
  return { ok: true, ops };
}
