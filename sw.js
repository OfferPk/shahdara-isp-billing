const CACHE_PREFIX = 'shahdara-isp-billing-';
// build.mjs rewrites CACHE_NAME (adds a content hash) and APP_FILES (every file in dist/) in dist/sw.js (#210).
const CACHE_NAME = 'shahdara-isp-billing-v37-3240b11e24';
const APP_FILES = ["./","./app.bundle.css","./app.js","./bulk-collect.js","./chunk-6U6H6AYU.js","./chunk-BSJA76UD.js","./chunk-HJ3MF7SS.js","./chunk-LKCHDKPR.js","./chunk-N3PZEYZ6.js","./chunk-NA7LJK4P.js","./chunk-OM5HHFNC.js","./chunk-R2ZKPHR7.js","./chunk-RJNDBRYO.js","./chunk-WZJHBWR2.js","./collect-setup.js","./customer-import.js","./customer-plan.js","./icon.svg","./index.html","./manifest.webmanifest","./payments-inbox.js","./screen-router.js","./ui-feedback.js","./urdu-font.css"];

// Bypass the HTTP cache while precaching so a new worker never stores files from the previous deploy.
const freshRequest = url => (typeof Request === 'function' ? new Request(url, { cache:'reload' }) : url);
// Only complete same-origin responses are cached; a 404/500 must never be replayed from cache.
const cacheable = response => Boolean(response && response.ok && (!response.type || response.type === 'basic'));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES.map(freshRequest))));
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

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function fetchAndCache(request) {
  return fetch(request).then(response => {
    if (cacheable(response)) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Page navigations are network-first so an online phone always gets the latest app shell.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetchAndCache(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch:true }).then(cached => {
      // Self-heal: ignore error responses that older workers stored (e.g. 404s from the pre-#208 build).
      if (cached && (cached.ok !== false)) return cached;
      return fetchAndCache(event.request);
    }).catch(() => caches.match('./index.html'))
  );
});
