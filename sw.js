const CACHE_NAME = 'inventarisku-shell-v1';
const CORE_FILES = [
  './', './index.html', './styles.css', './app.js', './firebase-config.js', './manifest.webmanifest',
  './assets/logo-imm.png', './assets/logo-umkt.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('inventarisku-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !url.hostname.endsWith('gstatic.com') && !url.hostname.endsWith('googleapis.com')) return;
  // Never cache Firestore/Storage REST responses; allow the SDK to manage their own cache.
  if (/firestore|identitytoolkit|securetoken|firebaseinstallations|storage\/v1/i.test(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (req.mode === 'navigate') {
      try { const fresh = await fetch(req); cache.put('./index.html', fresh.clone()); return fresh; }
      catch { return cached || cache.match('./index.html'); }
    }
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok && (url.origin === self.location.origin || url.hostname.endsWith('gstatic.com'))) cache.put(req, fresh.clone());
      return fresh;
    } catch { return cached || (url.origin === self.location.origin ? cache.match('./index.html') : Response.error()); }
  })());
});
