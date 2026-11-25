// Datenschicht im Speicher: für die Vorschau ohne Backend und für UI-Tests.
import { syncOnce } from './sync.js';
import { ensureWand } from './actions.js';

const PHASEN = ['Bestand vor Umbau', 'Abbruch', 'Rohbau', 'Installation', 'Verschlossen', 'Fertig'];
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
const TAG_MS = 86_400_000;

export function createMemoryApi({ queue, me = { id: 'u1', email: 'demo@example.org', name: 'Demo' }, seed = {}, seedBlobs = {}, now = () => new Date() } = {}) {
  const tables = new Map();
  const blobs = new Map(Object.entries(seedBlobs));
  const history = [];
  const t = (name) => { if (!tables.has(name)) tables.set(name, []); return tables.get(name); };
  t('phasen').push(...PHASEN.map((name, i) => ({ id: `p${i + 1}`, name, sortierung: i + 1 })));
  for (const [k, rows] of Object.entries(seed)) t(k).push(...rows.map((r) => ({ id: uuid(), ...r })));

  const log = (tabelle, row, aktion, vorher) => history.push({ tabelle, datensatz_id: row.id, aktion, vorher, nachher: { ...row }, von: me.id, am: now().toISOString() });
  const matches = (r, f = {}) => Object.entries(f).every(([k, v]) => (v === null ? r[k] == null : r[k] === v));

  const api = {
    me, queue, tables,
    async list(table, filter) { return t(table).filter((r) => !r.geloescht_am && matches(r, filter)).map((r) => ({ ...r })); },
    async listDeleted(table) {
      const grenze = now().getTime() - 90 * TAG_MS;
      return t(table).filter((r) => r.geloescht_am && new Date(r.geloescht_am).getTime() >= grenze).map((r) => ({ ...r }));
    },
    async insert(table, row) {
      if (table === 'fotos' && t('fotos').some((f) => f.sha256 === row.sha256)) throw Object.assign(new Error('doppelt'), { code: '23505' });
      const r = { id: uuid(), erstellt_am: now().toISOString(), erstellt_von: me.id, ...row };
      t(table).push(r); log(table, r, 'insert');
      return { ...r };
    },
    async update(table, id, patch) {
      const r = t(table).find((x) => x.id === id);
      const vorher = { ...r };
      Object.assign(r, patch, { geaendert_am: now().toISOString(), geaendert_von: me.id });
      log(table, r, 'update', vorher);
      return { ...r };
    },
    async upsert(table, row, key) {
      const r = t(table).find((x) => x[key] === row[key]);
      return r ? api.update(table, r.id, row) : api.insert(table, row);
    },
    softDelete(table, id) { return api.update(table, id, { geloescht_am: now().toISOString() }); },
    restore(table, id) { return api.update(table, id, { geloescht_am: null }); },
    async history(id) { return history.filter((h) => h.datensatz_id === id).reverse(); },
    async put(key, blob) { blobs.set(key, blob); },
    async url(key) {
      const b = blobs.get(key);
      return b && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(b) : `memory://${key}`;
    },
    async syncNow() {
      if (!queue) return;
      await syncOnce({
        queue,
        sign: async (ops) => ops.map((o) => o.key),
        upload: async (key, blob) => { blobs.set(key, blob); },
        insertFoto: (d) => api.insert('fotos', d),
        updateFoto: (id, p) => api.update('fotos', id, p),
        ensureWand: (w) => ensureWand(api, { id: w.etage_id, nord_grad: w.nord_grad }, { id: w.raum_id, name: w.raum_name }, w.seite),
      });
    },
  };
  return api;
}
