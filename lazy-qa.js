/**
 * lazy-qa.js — FIRST-LOAD SPLIT (2026-10-28): deferred loading for the
 * QA-certification modals (qa-setups.js, re-exporting all 26 qa-* modules).
 *
 * Before this split, app.js statically imported 26 QA setup functions (plus
 * getLateFeeConfig/isBillOverdue) from form-validation.js, which statically
 * re-exported them — so esbuild bundled ~1.09 MB of QA-certification code
 * into the static first-load graph (chunk-3WMVHHAB.js) even though QA modals
 * live in the customer profile and are opened rarely. Now qa-setups.js is
 * ONLY reached through the dynamic import() below, so it ships as a lazy
 * chunk fetched on first profile open (or first interaction) — never before
 * first paint. The service worker precaches every dist file (build.mjs
 * rewrites APP_FILES), so the lazy chunk still works 100% offline.
 *
 * Pattern mirrors lazy-telecom.js (SISP-9): promise-cached loader, injectable
 * importer for tests, failed loads are not cached so the next call retries.
 * This module never decides WHAT to set up — app.js ensureQaModals() runs
 * the setup calls with the loaded namespace, exactly as the boot block did.
 *
 * Two names stay static on purpose: getLateFeeConfig/isBillOverdue are used
 * by renderHistory (profile billing history, synchronous markup), so app.js
 * imports them directly from qa-discounts-late-fee.js — that one small module
 * (~44 KB source) stays in the static graph rather than making renderHistory
 * async. Everything else QA goes through here.
 */

// The dynamic import specifier MUST stay a string literal: esbuild turns it
// into a separate chunk, and build.mjs collectRuntimeFiles follows it, so the
// chunk lands in dist/ and in the service worker precache list.
const realImporter = () => import('./qa-setups.js');

let qaPromise = null;
let qaLoaded = false;

/** Test-only reset (the loader cache is module state). */
export function resetQaLoaderForTests() {
  qaPromise = null;
  qaLoaded = false;
}

export function isQaSetupsLoaded() { return qaLoaded; }

/**
 * Load the QA chunk once; concurrent callers share the same promise.
 * A failed load clears the cache entry so the next call retries.
 * `importer` is injectable for tests (production uses the real dynamic import).
 */
export function loadQaSetups(importer = realImporter) {
  if (!qaPromise) {
    qaPromise = Promise.resolve()
      .then(() => importer())
      .then(mod => { qaLoaded = true; return mod; })
      .catch(err => { qaPromise = null; throw err; });
  }
  return qaPromise;
}
