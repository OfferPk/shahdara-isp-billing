const CACHE_PREFIX = 'shahdara-isp-billing-';
// build.mjs rewrites CACHE_NAME (adds a content hash) and APP_FILES (every file in dist/) in dist/sw.js (#210).
const CACHE_NAME = 'shahdara-isp-billing-v37-279decbf98';
const APP_FILES = ["./","./app.js","./backup-store.js","./bulk-collect.css","./bulk-collect.js","./collect-setup.js","./core.js","./dashboard-aerial.js","./dashboard-area-collections.js","./dashboard-bfd.js","./dashboard-bgp.js","./dashboard-botda.js","./dashboard-cgnat.js","./dashboard-charts.js","./dashboard-collection-target.js","./dashboard-daily-closing.js","./dashboard-dns.js","./dashboard-dues-aging.js","./dashboard-dwdm.js","./dashboard-edfa-cascade.js","./dashboard-erps.js","./dashboard-evpn.js","./dashboard-flex-algo.js","./dashboard-flowspec.js","./dashboard-iptv.js","./dashboard-jetting.js","./dashboard-kerr.js","./dashboard-l3vpn.js","./dashboard-mclag.js","./dashboard-mef-ethernet.js","./dashboard-micro-otdr.js","./dashboard-microwave.js","./dashboard-mom-growth.js","./dashboard-mpls-te.js","./dashboard-mpls-tp.js","./dashboard-olp-protection.js","./dashboard-olt-chassis.js","./dashboard-optical-evm.js","./dashboard-osc.js","./dashboard-otdr.js","./dashboard-otn.js","./dashboard-package-revenue.js","./dashboard-pmd.js","./dashboard-pnl.js","./dashboard-polarization-eq.js","./dashboard-pon-dba.js","./dashboard-pseudowire.js","./dashboard-ptp-tbc.js","./dashboard-qinq.js","./dashboard-raman.js","./dashboard-roadm.js","./dashboard-rocev2.js","./dashboard-rpki.js","./dashboard-solar.js","./dashboard-splice.js","./dashboard-splicer.js","./dashboard-sr-mpls.js","./dashboard-srv6.js","./dashboard-synce.js","./dashboard-top-defaulters.js","./dashboard-vpls.js","./dashboard-y1731-oam.js","./dashboard.css","./dashboard.js","./duplicate-detection.js","./form-validation.js","./icon.svg","./index.html","./manifest.webmanifest","./nav-accessibility.js","./nav-aerial-alerts.js","./nav-bare-fiber-adapter.js","./nav-collection-rounds.js","./nav-connector-cleaning.js","./nav-customer-search.js","./nav-drop-retention.js","./nav-fast-connector.js","./nav-fdt-allocation.js","./nav-fiber-cleaver.js","./nav-fiber-identifier.js","./nav-fiber-microscope.js","./nav-fiber-probe.js","./nav-fiber-talkset.js","./nav-fusion-splice.js","./nav-gps-tracking.js","./nav-language.js","./nav-macro-bend.js","./nav-mechanical-splice.js","./nav-midspan-access.js","./nav-mpo-polarity.js","./nav-olts-cert.js","./nav-ont-diagnostics.js","./nav-opm-testing.js","./nav-optical-attenuator.js","./nav-optical-budget.js","./nav-optical-map.js","./nav-optical-return-loss.js","./nav-otdr-deadzone.js","./nav-otdr-launch-cable.js","./nav-otdr-trace.js","./nav-pending-actions.js","./nav-power-logger.js","./nav-pwa.js","./nav-quick-collect.js","./nav-quick-profile.js","./nav-reference-jumpers.js","./nav-ribbon-separator.js","./nav-splitter-tree.js","./nav-stabilized-light-source.js","./nav-tube-shaving.js","./nav-van-inventory.js","./nav-vfl-tracer.js","./nav-wdm-spectrum.js","./nav-wifi-survey.js","./nav.css","./nav.js","./owner-insights.js","./owner-ui.js","./package-catalog.js","./phase3.js","./profile-labels.js","./profile-ui.js","./qa-adss-sag-tension.js","./qa-armored-cable-crush.js","./qa-backup-csv-import.js","./qa-bend-loss-inspection.js","./qa-billing-correctness.js","./qa-cable-jetting-blowing.js","./qa-cleave-quality.js","./qa-coating-strip-force.js","./qa-conduit-pulling-tension.js","./qa-data-integrity.js","./qa-ddmi-calibration.js","./qa-discounts-late-fee.js","./qa-dispersion-inspection.js","./qa-fast-connector.js","./qa-ferrule-geometry.js","./qa-fosc-seal-inspection.js","./qa-fusion-splicer-arc.js","./qa-orl-reflectance.js","./qa-otdr-bidirectional-inspection.js","./qa-otdr-deadzone-cert.js","./qa-otdr-ghost-artifact.js","./qa-ribbon-splice.js","./qa-spectral-attenuation.js","./qa-splice-mfd-offset.js","./qa-splice-sleeve-cure.js","./qa-splitter-tolerance.js","./qa-thermal-cycling.js","./qa-tube-slitting-access.js","./receipt.js","./screen-router.css","./screen-router.js","./styles.css"];

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
