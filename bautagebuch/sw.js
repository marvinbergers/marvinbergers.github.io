// Service Worker: hält die App-Hülle offline verfügbar.
const CACHE = 'bautagebuch-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/main.js', 'js/config.js',
  'js/vendor/preact.js', 'js/vendor/htm.js', 'js/vendor/supabase.js', 'js/vendor/exifr.js', 'js/vendor/fflate.js',
  'icons/icon-192.png', 'icons/icon-512.png',
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
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Netz zuerst, damit Updates ankommen; offline aus dem Cache.
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});
