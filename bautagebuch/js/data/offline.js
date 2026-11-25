// Offline-Zwischenspeicher: zuletzt geladene Listen und Grundrisse liegen im Gerät,
// damit die App auch im Funkloch startet und Fotos an Stellen möglich sind.
const VERSION = 1;
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

async function openCache(name) {
  const open = indexedDB.open(name, VERSION);
  open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains('daten')) open.result.createObjectStore('daten'); };
  const db = await req(open);
  return {
    get: (k) => req(db.transaction('daten').objectStore('daten').get(k)),
    put: (k, v) => req(db.transaction('daten', 'readwrite').objectStore('daten').put(v, k)),
  };
}

const objectUrl = (blob) => (typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : 'blob:zwischengespeichert');

export async function withOfflineCache(api, { name = 'bautagebuch-cache' } = {}) {
  const cache = await openCache(name);
  const ladeBlob = api.fetchBlob ?? (async (key) => { const r = await fetch(await api.url(key)); if (!r.ok) throw new Error(r.status); return r.blob(); });
  const planUrls = new Map();
  return {
    ...api,
    async list(table, filter = {}) {
      const k = `list|${table}|${JSON.stringify(filter)}`;
      try {
        const rows = await api.list(table, filter);
        cache.put(k, rows).catch(() => {});
        return rows;
      } catch (e) {
        const alt = await cache.get(k).catch(() => undefined);
        if (alt) return alt;
        throw e;
      }
    },
    async url(key) {
      if (!key?.startsWith('plaene/')) return api.url(key);
      if (planUrls.has(key)) return planUrls.get(key);
      let blob;
      try { blob = await ladeBlob(key); cache.put(`blob|${key}`, blob).catch(() => {}); }
      catch (e) { blob = await cache.get(`blob|${key}`).catch(() => undefined); if (!blob) throw e; }
      const u = objectUrl(blob); planUrls.set(key, u); return u;
    },
  };
}
