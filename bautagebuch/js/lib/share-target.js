// Android „Teilen → Bautagebuch“: wird im Service Worker per importScripts geladen und in Tests importiert.
(function (g) {
  async function handleShare(request, addShared) {
    const fd = await request.formData();
    const files = fd.getAll('fotos').filter((f) => f && typeof f === 'object' && 'size' in f);
    if (files.length) await addShared(files);
    return new Response(null, { status: 303, headers: { Location: '/bautagebuch/#/eingang' } });
  }

  // Gleiches Schema wie js/lib/queue.js (Version 1, Store „geteilt“).
  function addSharedIdb(files) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('bautagebuch', 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('warteschlange')) db.createObjectStore('warteschlange', { keyPath: 'fotoId' });
        if (!db.objectStoreNames.contains('geteilt')) db.createObjectStore('geteilt', { autoIncrement: true });
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('geteilt', 'readwrite');
        for (const f of files) tx.objectStore('geteilt').add({ name: f.name, type: f.type, lastModified: f.lastModified, blob: f });
        tx.oncomplete = () => { open.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  g.btShare = { handleShare, addSharedIdb };
})(typeof self !== 'undefined' ? self : globalThis);
