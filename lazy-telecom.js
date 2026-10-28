/**
 * lazy-telecom.js — SISP-9: deferred loading for the heavy telecom /
 * engineering charts + diagnostics modals (dashboard-otdr, dashboard-dwdm,
 * dashboard-roadm, dashboard-bgp, dashboard-cgnat, dashboard-pon-dba, ... —
 * 43 modules in total, moved into telecom-charts.js).
 *
 * Before SISP-9, dashboard-charts.js statically imported all of them, so
 * esbuild bundled ~2.4 MB of telecom simulation code into the first-load
 * app.js chunk. Now telecom-charts.js is ONLY reached through the dynamic
 * import() below, so it ships as a separate chunk that the browser fetches
 * after first paint — and only when the dashboard charts region actually
 * becomes visible (IntersectionObserver). The service worker precaches every
 * dist file (build.mjs rewrites APP_FILES), so the lazy chunk still works
 * 100% offline.
 *
 * Quick jump (spec requirement 2) needed no new code and is NOT re-implemented
 * here: '/' already focuses #globalCustomerSearch (app.js), '/' already opens
 * the mobile search sheet (nav-customer-search.js), and Ctrl+K already opens
 * the command palette (nav.js setupCommandPalette) — every handler already
 * guards INPUT/TEXTAREA/SELECT so typing in a field is never hijacked.
 *
 * This module never throws: queueTelecomCharts is called on every dashboard
 * render, and a failed telecom load must never break the core charts that
 * already rendered. Failures surface once via options.onToast when provided,
 * and the next render retries (the failed import is not cached).
 */

// The dynamic import specifier MUST stay a string literal: esbuild turns it
// into a separate chunk, and build.mjs collectRuntimeFiles follows it, so the
// chunk lands in dist/ and in the service worker precache list.
const realImporter = () => import('./telecom-charts.js');

const CHARTS_REGION_SELECTOR = '.dashboard-charts-region';

let telecomPromise = null;
let telecomLoaded = false;
let latestArgs = null;

/** Test-only reset (the loader cache is module state). */
export function resetTelecomLoaderForTests() {
  telecomPromise = null;
  telecomLoaded = false;
  latestArgs = null;
}

export function isTelecomChartsLoaded() { return telecomLoaded; }

/**
 * Load the telecom chunk once; concurrent callers share the same promise.
 * A failed load clears the cache entry so the next call retries.
 * `importer` is injectable for tests (production uses the real dynamic import).
 */
export function loadTelecomCharts(importer = realImporter) {
  if (!telecomPromise) {
    telecomPromise = Promise.resolve()
      .then(() => importer())
      .then(mod => { telecomLoaded = true; return mod; })
      .catch(err => { telecomPromise = null; throw err; });
  }
  return telecomPromise;
}

/** Load (if needed) and render the telecom charts immediately. */
export async function renderTelecomChartsNow(state, referenceDate, options = {}, importer) {
  const mod = await loadTelecomCharts(importer);
  return mod.renderTelecomCharts(state, referenceDate, options);
}

function globalOf(name) {
  return (typeof globalThis !== 'undefined' && globalThis[name]) || undefined;
}

/**
 * Schedule a telecom render for the latest dashboard state, without blocking
 * first paint:
 * - Already loaded → render on a microtask (latest args win).
 * - Charts region observable via IntersectionObserver → render when it
 *   scrolls into view (a user who jumps straight to Customers never pays
 *   for telecom code at all).
 * - No observer support, or no region element in a real browser document →
 *   defer past first paint via requestIdleCallback / setTimeout.
 * - No querySelector on the document (unit-test fake documents) → do nothing;
 *   there is no region to observe and no real DOM to render into.
 * Re-queues are safe: every attempt renders whatever args are newest when
 * the load completes, so a render queued during a load is never dropped
 * (a duplicate render with the same args is harmless — setups already run
 * on every dashboard render today).
 */
export function queueTelecomCharts(state, referenceDate, options = {}, env = {}) {
  try {
    latestArgs = { state, referenceDate, options };
    const doc = env.document ?? globalOf('document');

    const attempt = () => {
      loadTelecomCharts(env.importer).then(mod => {
        const args = latestArgs;
        return mod.renderTelecomCharts(args.state, args.referenceDate, args.options);
      }).catch(() => {
        if (options && typeof options.onToast === 'function') {
          try { options.onToast('Telecom charts load nahi ho sakay — dobara try karein'); } catch { /* never break core render */ }
        }
      });
    };

    if (telecomLoaded) { attempt(); return; }
    if (!doc || typeof doc.querySelector !== 'function') return; // fake document: nothing to observe

    const IO = env.IntersectionObserver ?? globalOf('IntersectionObserver');
    const region = doc.querySelector(CHARTS_REGION_SELECTOR);
    if (IO && region) {
      const observer = new IO(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          if (typeof observer.disconnect === 'function') observer.disconnect();
          attempt();
        }
      });
      observer.observe(region);
      return;
    }

    const ric = env.requestIdleCallback ?? globalOf('requestIdleCallback');
    const timer = env.setTimeout ?? globalOf('setTimeout');
    if (typeof ric === 'function') ric(() => attempt());
    else if (typeof timer === 'function') timer(() => attempt(), 0);
    else attempt();
  } catch {
    // Never let lazy loading break the core dashboard render.
  }
}
