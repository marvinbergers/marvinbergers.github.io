import { describe, it, expect } from 'vitest';
import { createRemoteApi } from '../../bautagebuch/js/data/remote.js';

// Minimaler PostgREST-Nachbau: liefert höchstens 1000 Zeilen pro Abfrage (wie Supabase „Max rows“).
function fakeClient(rows) {
  const builder = (filter = []) => {
    let von = 0; let bis = null;
    const b = {
      select: () => b, eq: (k, v) => builder([...filter, (r) => r[k] === v]), is: (k) => builder([...filter, (r) => r[k] == null]),
      order: () => b, range: (a, z) => { von = a; bis = z; return b; },
      then(res, rej) {
        const alle = rows.filter((r) => filter.every((f) => f(r)));
        const ende = Math.min(bis == null ? von + 999 : bis, von + 999);
        return Promise.resolve({ data: alle.slice(von, ende + 1), error: null }).then(res, rej);
      },
    };
    return b;
  };
  return { from: () => builder(), functions: { invoke: async () => ({ data: { urls: [] } }) }, rpc: async () => ({}) };
}

describe('remote.list', () => {
  it('liefert alle Zeilen, auch über 1000 (Seitenweise)', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: `f${i}`, stelle_id: i % 2 ? 's1' : null }));
    const queue = { count: async () => 0, pending: async () => [] };
    const api = createRemoteApi({ client: fakeClient(rows), queue, me: { id: 'u' } });
    expect(await api.list('fotos')).toHaveLength(2500);
    expect(await api.list('fotos', { stelle_id: 's1' })).toHaveLength(1250);
  });
});
