// Dauerhafte Warteschlange im Gerät (IndexedDB). Überlebt Schließen der App und Neustart des Handys.
const VERSION = 1;

function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function done(tx) { return new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); }); }

export async function openQueue(name = 'bautagebuch') {
  const open = indexedDB.open(name, VERSION);
  open.onupgradeneeded = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains('warteschlange')) db.createObjectStore('warteschlange', { keyPath: 'fotoId' });
    if (!db.objectStoreNames.contains('geteilt')) db.createObjectStore('geteilt', { autoIncrement: true });
  };
  const db = await req(open);
  const store = (s, mode = 'readonly') => db.transaction(s, mode).objectStore(s);

  return {
    async add(item) {
      const tx = db.transaction('warteschlange', 'readwrite');
      tx.objectStore('warteschlange').put({ ...item, eingereiht: Date.now() });
      await done(tx);
      dispatchEvent?.(new Event('warteschlange'));
    },
    async pending() {
      const all = await req(store('warteschlange').getAll());
      return all.sort((a, b) => a.eingereiht - b.eingereiht);
    },
    async remove(fotoId) {
      const tx = db.transaction('warteschlange', 'readwrite');
      tx.objectStore('warteschlange').delete(fotoId);
      await done(tx);
    },
    count() { return req(store('warteschlange').count()); },
    async addShared(files) {
      const tx = db.transaction('geteilt', 'readwrite');
      // Name und Datum explizit sichern: nicht jeder Browser klont File-Objekte vollständig.
      for (const f of files) tx.objectStore('geteilt').add({ name: f.name, type: f.type, lastModified: f.lastModified, blob: f });
      await done(tx);
    },
    async takeShared() {
      const tx = db.transaction('geteilt', 'readwrite');
      const s = tx.objectStore('geteilt');
      const files = await req(s.getAll());
      s.clear();
      await done(tx);
      return files.map((x) => new File([x.blob], x.name, { type: x.type, lastModified: x.lastModified }));
    },
    close() { db.close(); },
  };
}

function dispatchEvent(e) { if (typeof window !== 'undefined') window.dispatchEvent(e); }
