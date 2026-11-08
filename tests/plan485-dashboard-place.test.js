import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DASHBOARD_PLACE_KEY,
  bindDashboardPlaceKeeping,
  clearDashboardPlace,
  collectDashboardPlace,
  loadDashboardPlace,
  restoreDashboardPlace,
  saveDashboardPlace
} from '../dashboard-place.js';
import { TRANSLATIONS } from '../nav-language.js';

// A small in-memory stand-in for the record store: the module
// takes storage in, so the tests never touch the real one.
function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    dump: () => Object.fromEntries(map)
  };
}

// A small stand-in for the page: only the dashboard element and
// its open collapsible sections, plus the visibility flag the
// keeping listens to.
function fakeDoc({ openSections = [], dashboardPresent = true } = {}) {
  const details = openSections.map((id) => ({ id, open: true }));
  const dashboard = {
    querySelectorAll: (selector) => (selector === 'details[open]' ? details.filter((el) => el.open) : [])
  };
  const byId = new Map();
  if (dashboardPresent) byId.set('billingDashboard', dashboard);
  for (const el of details) byId.set(el.id, el);
  const listeners = new Map();
  return {
    hidden: false,
    getElementById: (id) => byId.get(id) ?? null,
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    removeEventListener: (type) => { listeners.delete(type); },
    fire: (type) => { listeners.get(type)?.(); },
    details,
    listeners
  };
}

// A small stand-in for the viewport the operator scrolls: the
// scroll offset, a scrollTo that records its calls, and the
// listener table the keeping binds to.
function fakeViewport({ scrollY = 0 } = {}) {
  const listeners = new Map();
  const scrollCalls = [];
  return {
    scrollY,
    scrollCalls,
    scrollTo: (x, y) => { scrollCalls.push([x, y]); },
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    removeEventListener: (type) => { listeners.delete(type); },
    requestAnimationFrame: (fn) => { fn(); return 1; },
    fire: (type) => { listeners.get(type)?.(); },
    listeners
  };
}

test('save and load round-trip: the saved place comes back exactly', () => {
  const storage = fakeStorage();
  const place = { scrollY: 1200, openSectionId: 'homeChartsCollapsible' };
  assert.equal(saveDashboardPlace(storage, place), true);
  assert.deepEqual(loadDashboardPlace(storage), place);
  // Saving never rewrites the place the caller passed in.
  assert.deepEqual(place, { scrollY: 1200, openSectionId: 'homeChartsCollapsible' });
  assert.equal(storage.dump()[DASHBOARD_PLACE_KEY], JSON.stringify(place));
});

test('save normalises the place: a fractional or negative offset reads back clean', () => {
  const storage = fakeStorage();
  assert.equal(saveDashboardPlace(storage, { scrollY: 1234.9, openSectionId: 'homeProviderCostDetails' }), true);
  assert.deepEqual(loadDashboardPlace(storage), { scrollY: 1234, openSectionId: 'homeProviderCostDetails' });
  assert.equal(saveDashboardPlace(storage, { scrollY: -40, openSectionId: null }), true);
  assert.deepEqual(loadDashboardPlace(storage), { scrollY: 0, openSectionId: null });
});

test('save refuses what it cannot store: no store, no place, or a wrong shape', () => {
  const storage = fakeStorage();
  assert.equal(saveDashboardPlace(null, { scrollY: 10, openSectionId: null }), false);
  assert.equal(saveDashboardPlace(storage, null), false);
  assert.equal(saveDashboardPlace(storage, 'top'), false);
  assert.equal(saveDashboardPlace(storage, { scrollY: '1200', openSectionId: null }), false);
  assert.equal(saveDashboardPlace(storage, { scrollY: Number.NaN, openSectionId: null }), false);
  assert.equal(saveDashboardPlace(storage, { scrollY: 10, openSectionId: 42 }), false);
  assert.equal(saveDashboardPlace(storage, { scrollY: 10, openSectionId: '' }), false);
  assert.deepEqual(storage.dump(), {});
});

test('load reads nothing usable as no saved place, never a guessed position', () => {
  assert.equal(loadDashboardPlace(null), null);
  assert.equal(loadDashboardPlace(fakeStorage()), null);
  assert.equal(loadDashboardPlace(fakeStorage({ [DASHBOARD_PLACE_KEY]: 'not json {' })), null);
  assert.equal(loadDashboardPlace(fakeStorage({ [DASHBOARD_PLACE_KEY]: '"just a string"' })), null);
  assert.equal(loadDashboardPlace(fakeStorage({ [DASHBOARD_PLACE_KEY]: JSON.stringify({ scrollY: '900' }) })), null);
  assert.equal(loadDashboardPlace(fakeStorage({ [DASHBOARD_PLACE_KEY]: JSON.stringify({ scrollY: 900, openSectionId: 7 }) })), null);
  const throwing = { getItem: () => { throw new Error('store gone'); } };
  assert.equal(loadDashboardPlace(throwing), null);
});

test('clear removes the saved place, so the next return starts at the top', () => {
  const storage = fakeStorage();
  saveDashboardPlace(storage, { scrollY: 800, openSectionId: 'homeChartsCollapsible' });
  assert.equal(clearDashboardPlace(storage), true);
  assert.equal(loadDashboardPlace(storage), null);
  assert.equal(clearDashboardPlace(null), false);
});

test('collect reads the live place: scroll offset plus the open section', () => {
  const doc = fakeDoc({ openSections: ['homeChartsCollapsible'] });
  const viewport = fakeViewport({ scrollY: 1200 });
  assert.deepEqual(collectDashboardPlace(doc, viewport), { scrollY: 1200, openSectionId: 'homeChartsCollapsible' });
});

test('collect reads no open section as null, and skips sections without an id', () => {
  const doc = fakeDoc({ openSections: [] });
  assert.deepEqual(collectDashboardPlace(doc, fakeViewport({ scrollY: 300 })), { scrollY: 300, openSectionId: null });
  const nameless = fakeDoc({ openSections: [''] });
  assert.deepEqual(collectDashboardPlace(nameless, fakeViewport({ scrollY: 0 })), { scrollY: 0, openSectionId: null });
});

test('collect never reads below zero and never needs the dashboard to exist', () => {
  const doc = fakeDoc({ dashboardPresent: false });
  assert.deepEqual(collectDashboardPlace(doc, fakeViewport({ scrollY: -50 })), { scrollY: 0, openSectionId: null });
  assert.deepEqual(collectDashboardPlace(null, fakeViewport({ scrollY: 75 })), { scrollY: 75, openSectionId: null });
  assert.deepEqual(collectDashboardPlace(fakeDoc(), null), { scrollY: 0, openSectionId: null });
});

test('restore returns to the saved scroll position and reopens the saved section', () => {
  const storage = fakeStorage();
  saveDashboardPlace(storage, { scrollY: 1200, openSectionId: 'homeChartsCollapsible' });
  const doc = fakeDoc({ openSections: [] });
  const viewport = fakeViewport({ scrollY: 0 });
  assert.deepEqual(restoreDashboardPlace(doc, viewport, storage), { scrollY: 1200, openSectionId: 'homeChartsCollapsible' });
  assert.deepEqual(viewport.scrollCalls, [[0, 1200]]);
  assert.equal(doc.details.length, 0);
  // The section was closed in the fixture, so restore reopens it.
  const reopened = fakeDoc({ openSections: [] });
  reopened.details.push({ id: 'homeChartsCollapsible', open: false });
  const byIdDoc = {
    ...reopened,
    getElementById: (id) => (id === 'homeChartsCollapsible' ? reopened.details[0] : (id === 'billingDashboard' ? { querySelectorAll: () => [] } : null))
  };
  restoreDashboardPlace(byIdDoc, fakeViewport(), storage);
  assert.equal(reopened.details[0].open, true);
});

test('restore with nothing saved returns to the top and opens nothing', () => {
  const doc = fakeDoc({ openSections: [] });
  const viewport = fakeViewport({ scrollY: 900 });
  assert.equal(restoreDashboardPlace(doc, viewport, fakeStorage()), null);
  assert.deepEqual(viewport.scrollCalls, [[0, 0]]);
  assert.equal(restoreDashboardPlace(doc, viewport, null), null);
  assert.deepEqual(viewport.scrollCalls, [[0, 0], [0, 0]]);
});

test('restore never throws when the saved section is gone from the page', () => {
  const storage = fakeStorage();
  saveDashboardPlace(storage, { scrollY: 640, openSectionId: 'goneSection' });
  const viewport = fakeViewport();
  assert.deepEqual(restoreDashboardPlace(fakeDoc({ openSections: [] }), viewport, storage), { scrollY: 640, openSectionId: 'goneSection' });
  assert.deepEqual(viewport.scrollCalls, [[0, 640]]);
});

test('keeping saves the place as the operator scrolls and when the page is left', () => {
  const storage = fakeStorage();
  const doc = fakeDoc({ openSections: ['homeProviderCostDetails'] });
  const viewport = fakeViewport({ scrollY: 450 });
  const stop = bindDashboardPlaceKeeping(viewport, doc, storage);
  assert.equal(typeof stop, 'function');
  viewport.fire('scroll');
  assert.deepEqual(loadDashboardPlace(storage), { scrollY: 450, openSectionId: 'homeProviderCostDetails' });
  viewport.scrollY = 900;
  viewport.fire('beforeunload');
  assert.deepEqual(loadDashboardPlace(storage), { scrollY: 900, openSectionId: 'homeProviderCostDetails' });
  doc.hidden = true;
  viewport.scrollY = 1100;
  doc.fire('visibilitychange');
  assert.deepEqual(loadDashboardPlace(storage), { scrollY: 1100, openSectionId: 'homeProviderCostDetails' });
  stop();
  assert.equal(viewport.listeners.size, 0);
  assert.equal(doc.listeners.size, 0);
});

test('keeping without a viewport to listen to is a harmless no-op', () => {
  const stop = bindDashboardPlaceKeeping(null, fakeDoc(), fakeStorage());
  assert.equal(typeof stop, 'function');
  assert.doesNotThrow(stop);
});

test('wiring: the dashboard binds the keeping once, restores once, and offers a way back to the top', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="dplBackToTop"'), 'back-to-top button exists');
  assert.ok(page.indexOf('id="dplBackToTop"') > page.indexOf('id="quickAddPaymentButton"'), 'button sits beside Add payment');
  assert.ok(page.includes('data-i18n="dash_place_top"'), 'button label is translated');
  assert.ok(page.includes('Back to top'), 'button label reads Back to top');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-place.js?v=1.11.0'"), 'dashboard imports the place module at the pinned version');
  assert.ok(app.includes('bindDashboardPlaceKeeping(window, document, storageAvailable ? localStorage : null)'), 'keeping is bound once at startup');
  assert.ok(app.includes("$('#dplBackToTop')?.addEventListener('click'"), 'back-to-top button is wired');
  assert.ok(app.includes('clearDashboardPlace(storageAvailable ? localStorage : null)'), 'back-to-top clears the saved place');
  assert.ok(app.includes('let dashboardPlaceRestored = false;'), 'restore runs once per page load');
  assert.ok(app.includes('restoreDashboardPlace(document, window, storageAvailable ? localStorage : null)'), 'first dashboard render restores the saved place');
});

test('i18n: the back-to-top key exists in English and Urdu, with Urdu script in the Urdu value', () => {
  assert.equal(typeof TRANSLATIONS.en.dash_place_top, 'string');
  assert.ok(TRANSLATIONS.en.dash_place_top.length > 0);
  assert.equal(typeof TRANSLATIONS.ur.dash_place_top, 'string');
  assert.ok(TRANSLATIONS.ur.dash_place_top.length > 0);
  assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur.dash_place_top), 'Urdu value of dash_place_top carries no Urdu script');
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-place.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false, 'header names no module file');
  assert.equal(module.includes('full-history-list.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document'), false);
  assert.equal(/\bwindow\s*[.([]/.test(module), false, 'module touches the window global');
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
  // The header is a /* */ block, never // line comments.
  assert.ok(module.startsWith('/*'), 'header is a block comment');
  // PKR only — no other currency symbol or code in the module source
  // (a dollar followed by a digit would be money; `${` template
  // placeholders are not).
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(module), false);
  // The module touches view state only: no ledger record of any
  // kind is named, so no bill, payment, or customer record can
  // change through it.
  assert.equal(/customers|payments|bills/.test(module), false, 'module names ledger records');
});
