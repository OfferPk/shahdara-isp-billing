const CACHE_PREFIX = 'shahdara-isp-billing-';
// build.mjs rewrites CACHE_NAME (adds a content hash) and APP_FILES (every file in dist/) in dist/sw.js (#210).
const CACHE_NAME = 'shahdara-isp-billing-v37-cbd8f472ad';
const APP_FILES = ["./","./app.bundle.css","./app.js","./bulk-collect.js","./chunk-3FTJQWOH.js","./chunk-7XSRK4AH.js","./chunk-EEV4PB2O.js","./chunk-FB3B3Z5N.js","./chunk-GFZKWJ6B.js","./chunk-HNV5NGFU.js","./chunk-J4P4BRY7.js","./chunk-PAV5HII3.js","./chunk-Q2BCPP6G.js","./chunk-YGMZWU3A.js","./collect-setup.js","./customer-import.js","./customer-plan.js","./icon.svg","./index.html","./manifest.webmanifest","./payments-inbox.js","./screen-router.js","./ui-feedback.js","./urdu-font.css"];

// Bypass the HTTP cache while precaching so a new worker never stores files from the previous deploy.
const freshRequest = url => (typeof Request === 'function' ? new Request(url, { cache:'reload' }) : url);
// Only complete same-origin responses are cached; a 404/500 must never be replayed from cache.
const cacheable = response => Boolean(response && response.ok && (!response.type || response.type === 'basic'));

// Plan G — tell open pages what the worker could not do, instead of
// failing silently. Every call is guarded: the worker must never crash
// because a client list or a postMessage is unavailable (the unit-test
// harness, for example, provides clients.claim but no matchAll).
function notifyClients(message) {
  try {
    const clients = self.clients;
    if (!clients || typeof clients.matchAll !== 'function') return;
    clients.matchAll({ includeUncontrolled: true }).then(list => {
      for (const client of list || []) {
        try { client.postMessage(message); } catch {}
      }
    }).catch(() => {});
  } catch {}
}

// An app-module/asset request (it has a file extension) must never be
// answered with the app shell: that would serve HTML where the page
// expects JS/CSS and fail silently later. SPA routes have no extension
// and keep the shell fallback.
function isAssetRequest(request) {
  try {
    const path = new URL(request.url).pathname;
    return /\.(?:js|css|json|png|jpe?g|svg|webp|webmanifest|ico|woff2?|ttf|map)$/i.test(path);
  } catch {
    return false;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES.map(freshRequest))).catch(err => {
    notifyClients({ type: 'SW_PRECACHE_FAILED', cache: CACHE_NAME, error: String((err && err.message) || err) });
    throw err;
  }));
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
  if (event.data?.type === 'SW_GET_STATUS') {
    try { event.source?.postMessage({ type: 'SW_STATUS', cache: CACHE_NAME }); } catch {}
  }
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
    event.respondWith(fetchAndCache(event.request).catch(() => {
      notifyClients({ type: 'SW_OFFLINE_FALLBACK', url: event.request.url, cache: CACHE_NAME });
      return caches.match('./index.html');
    }));
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch:true }).then(cached => {
      // Self-heal: ignore error responses that older workers stored (e.g. 404s from the pre-#208 build).
      if (cached && (cached.ok !== false)) return cached;
      return fetchAndCache(event.request);
    }).catch(() => {
      if (isAssetRequest(event.request)) {
        notifyClients({ type: 'SW_ASSET_OFFLINE', url: event.request.url, cache: CACHE_NAME });
        return typeof Response === 'function'
          ? new Response('Offline — file unavailable', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          : null;
      }
      notifyClients({ type: 'SW_OFFLINE_FALLBACK', url: event.request.url, cache: CACHE_NAME });
      return caches.match('./index.html');
    })
  );
});
