// Datenschicht gegen Supabase (Daten) und R2 (Dateien).
import { makeSign, upload, signedUrl } from './storage.js';
import { startSync } from './sync.js';

const TAG_MS = 86_400_000;
// Tabellen ohne Papierkorb haben keine *_aktiv-Sicht.
const OHNE_PAPIERKORB = new Set(['einstellungen', 'aenderungen', 'erlaubte_nutzer']);
const pruefe = ({ data, error }) => { if (error) throw error; return data; };

export function createRemoteApi({ client, queue, me, onQueueChange = () => {} }) {
  const sign = makeSign(client);
  const api = {
    me, queue,
    async list(table, filter = {}) {
      let q = client.from(OHNE_PAPIERKORB.has(table) ? table : `${table}_aktiv`).select('*');
      for (const [k, v] of Object.entries(filter)) q = v === null ? q.is(k, null) : q.eq(k, v);
      return pruefe(await q);
    },
    async listDeleted(table) {
      const grenze = new Date(Date.now() - 90 * TAG_MS).toISOString();
      return pruefe(await client.from(table).select('*').not('geloescht_am', 'is', null).gte('geloescht_am', grenze));
    },
    async insert(table, row) { return pruefe(await client.from(table).insert(row).select().single()); },
    async update(table, id, patch) { return pruefe(await client.from(table).update(patch).eq('id', id).select().single()); },
    async upsert(table, row, key) { return pruefe(await client.from(table).upsert(row, { onConflict: key }).select().single()); },
    async softDelete(table, id) { await api.update(table, id, { geloescht_am: new Date().toISOString() }); },
    async restore(table, id) { await api.update(table, id, { geloescht_am: null }); },
    async history(id) {
      return pruefe(await client.from('aenderungen').select('*').eq('datensatz_id', id).order('am', { ascending: false }));
    },
    url: (key) => signedUrl(sign, key),
    async put(key, blob, type) { const [u] = await sign([{ method: 'PUT', key, contentType: type }]); await upload(u, blob, type); },
    syncNow: null,
  };
  client.rpc('verknuepfe_mich').then(() => {}, () => {}); // eigene Person mit dem Login verknüpfen
  api.syncNow = startSync({ queue, sign, upload, insertFoto: (d) => api.insert('fotos', d) }, { onChange: onQueueChange });
  return api;
}
