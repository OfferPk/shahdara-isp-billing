const CACHE_PREFIX = 'shahdara-isp-billing-';
const CACHE_NAME = 'shahdara-isp-billing-v34';
const APP_FILES = ['./','./index.html','./styles.css','./app.js','./profile-labels.js','./profile-ui.js','./receipt.js','./package-catalog.js','./core.js','./phase3.js','./owner-insights.js','./owner-ui.js','./backup-store.js','./duplicate-detection.js','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch:true }).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
