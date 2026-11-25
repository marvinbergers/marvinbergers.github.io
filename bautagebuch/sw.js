// Service Worker: hält die App-Hülle offline verfügbar und nimmt geteilte Fotos (Android) an.
importScripts('js/lib/share-target.js');
const CACHE = 'bautagebuch-v6';
const TIMEOUT_MS = 3000; // schwaches Netz: nach 3 s aus dem Speicher
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/main.js', 'js/config.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  'js/ui/Attendance.js',
  'js/ui/CategoryPicker.js',
  'js/ui/Checkliste.js',
  'js/ui/DayEntry.js',
  'js/ui/Diary.js',
  'js/ui/FloorPlan.js',
  'js/ui/FotoAnsicht.js',
  'js/ui/GrundrissView.js',
  'js/ui/History.js',
  'js/ui/Inbox.js',
  'js/ui/Login.js',
  'js/ui/Setup.js',
  'js/ui/Share.js',
  'js/ui/StellePanel.js',
  'js/ui/SyncBadge.js',
  'js/ui/Trash.js',
  'js/ui/capture.js',
  'js/ui/hooks.js',
  'js/ui/views.js',
  'js/data/actions.js',
  'js/data/api.js',
  'js/data/archiv.js',
  'js/data/demo.js',
  'js/data/diary.js',
  'js/data/inbox.js',
  'js/data/memory.js',
  'js/data/offline.js',
  'js/data/remote.js',
  'js/data/storage.js',
  'js/data/supabase.js',
  'js/data/sync.js',
  'js/lib/days.js',
  'js/lib/filter.js',
  'js/lib/frequency.js',
  'js/lib/geometry.js',
  'js/lib/hours.js',
  'js/lib/keys.js',
  'js/lib/photo.js',
  'js/lib/queue.js',
  'js/lib/rooms.js',
  'js/lib/share-target.js',
  'js/lib/weather.js',
  'js/vendor/exifr.js',
  'js/vendor/fflate.js',
  'js/vendor/htm.js',
  'js/vendor/preact.js',
  'js/vendor/supabase.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/bautagebuch/teilen')) {
    e.respondWith(self.btShare.handleShare(e.request, self.btShare.addSharedIdb));
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Netz zuerst (damit Updates ankommen), aber mit Zeitlimit; sonst aus dem Speicher.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const netz = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; });
    const zeit = new Promise((r) => setTimeout(r, TIMEOUT_MS));
    const schnell = await Promise.race([netz.catch(() => null), zeit]);
    if (schnell) return schnell;
    const gespeichert = await cache.match(e.request, { ignoreSearch: true });
    if (gespeichert) return gespeichert;
    if (e.request.mode === 'navigate') return (await cache.match('index.html')) ?? netz;
    return netz; // Module nie durch index.html ersetzen
  })());
});
