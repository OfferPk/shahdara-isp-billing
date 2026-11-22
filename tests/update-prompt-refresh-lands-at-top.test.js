// Update-prompt Refresh must land the fresh load at the TOP, not the bottom.
// Bug (user, 2026-11-22): tapping Refresh on the "new version" toast landed the
// page at the very bottom (footer / Backup area). The tap itself never scrolls:
// Refresh reloads the page, and the reloaded page restores the saved dashboard
// place (Plan 485, shahdara_dashboard_place_v1) — which on the phone is the
// bottom — while the browser's own reload restoration ('auto') independently
// returns to the pre-reload bottom. The fix clears the saved place AND sets
// history.scrollRestoration = 'manual' in refresh(), before any reload path.

import test from 'node:test';
import assert from 'node:assert/strict';

import { setupSwUpdatePrompt, SW_UPDATE_EVENT } from '../nav-pwa.js';
import {
  saveDashboardPlace,
  restoreDashboardPlace,
} from '../dashboard-place.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const BOTTOM_SCROLL_Y = 4200;

function fakeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  };
}

function fakeDoc() {
  return {
    querySelector: () => null,
    getElementById: () => null,
    addEventListener: () => {},
  };
}

function createMockServiceWorker() {
  const listeners = new Map();
  const waiting = {
    scriptURL: 'https://example.com/app.js?v=2.0.0',
    state: 'installed',
    messages: [],
    postMessage(message) { this.messages.push(message); },
  };
  const sw = {
    controller: { scriptURL: 'https://example.com/app.js?v=1.11.0', state: 'activated' },
    onmessage: null,
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    dispatch: (type, event = {}) => {
      for (const fn of [...(listeners.get(type) ?? [])]) fn(event);
    },
    getRegistration: () => Promise.resolve({
      scope: 'https://example.com/',
      waiting,
      active: { scriptURL: 'https://example.com/app.js?v=1.11.0', state: 'activated' },
    }),
    _waiting: waiting,
  };
  return sw;
}

function createMockWindow(sw) {
  const listeners = new Map();
  const scrollCalls = [];
  const focusCalls = [];
  let reloads = 0;
  const history = { scrollRestoration: 'auto' };
  const win = {
    navigator: { serviceWorker: sw },
    location: { reload: () => { reloads += 1; } },
    document: fakeDoc(),
    history,
    scrollY: 0,
    scrollTo: (...args) => scrollCalls.push(args),
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
    dispatchEvent: (event) => {
      for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event);
    },
    __swUpdatePending: null,
    __swUpdateRegistration: null,
    _reloads: () => reloads,
    _scrollCalls: scrollCalls,
    _focusCalls: focusCalls,
    _history: history,
  };
  win.document.activeElement = null;
  return win;
}

function createFreshViewport() {
  const scrollCalls = [];
  return {
    scrollY: 0,
    scrollTo: (...args) => scrollCalls.push(args),
    _scrollCalls: scrollCalls,
  };
}

// Shared driver: seed a saved place, show the prompt, tap an action, then
// simulate the fresh load's restore. Returns what the fresh load did.
async function driveUpdateClick({ seedScrollY, actionIndex = 0, isBusy = null, beforeTap = null } = {}) {
  const storage = fakeStorage();
  if (seedScrollY != null) {
    saveDashboardPlace(storage, { scrollY: seedScrollY, openSectionId: null, savedAt: Date.now() });
  }
  const sw = createMockServiceWorker();
  const win = createMockWindow(sw);
  const toasts = [];
  const options = {
    win,
    storage,
    onToast: (msg, opts) => toasts.push({ msg, opts }),
    reloadFallbackMs: 1500,
  };
  if (isBusy != null) options.isBusy = isBusy;
  setupSwUpdatePrompt(options);
  // Pending update (a newer scriptURL than the running one) — as stashed by
  // the <head> script in index.html when the waiting worker is found on load.
  win.__swUpdatePending = { scriptURL: 'https://example.com/app.js?v=2.0.0' };
  win.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT, { detail: win.__swUpdatePending }));
  await tick();
  await tick();
  assert.equal(toasts.length, 1, 'update toast should be shown once');
  const actions = toasts[0].opts.actions;
  assert.equal(actions.length, 2, 'toast should offer Refresh + Later');

  const scrollCallsBeforeReload = win._scrollCalls.length;
  const focusCallsBeforeReload = win._focusCalls.length;

  // Tap the action (a caller hook may flip busy state first).
  if (beforeTap) beforeTap();
  actions[actionIndex].onAction();
  // The waiting worker activates -> controllerchange -> reloadOnce().
  sw.dispatch('controllerchange');
  await tick();

  // Fresh load: the new page boots, renderDashboard() restores the saved place.
  const viewport = createFreshViewport();
  restoreDashboardPlace(fakeDoc(), viewport, storage);
  return {
    storage,
    win,
    sw,
    viewport,
    scrollCallsBeforeReload,
    focusCallsBeforeReload,
  };
}

test('BUG: Refresh with a bottom place saved lands the fresh load at the TOP', async () => {
  const { viewport, win } = await driveUpdateClick({ seedScrollY: BOTTOM_SCROLL_Y });
  assert.equal(win._reloads(), 1, 'Refresh must trigger exactly one location.reload()');
  // The fresh load must NOT restore the saved bottom place.
  assert.deepEqual(viewport._scrollCalls, [[0, 0]], 'fresh load scrolls to the top, not the saved bottom place');
  assert.equal(win._history.scrollRestoration, 'manual', 'browser reload restoration is stopped for this navigation');
});

test('Refresh tap itself does not scroll or move focus', async () => {
  const { scrollCallsBeforeReload, focusCallsBeforeReload } = await driveUpdateClick({ seedScrollY: BOTTOM_SCROLL_Y });
  assert.equal(scrollCallsBeforeReload, 0, 'toast show + Refresh tap must not scroll');
  assert.equal(focusCallsBeforeReload, 0, 'toast show + Refresh tap must not move focus');
});

test('Update still works: Refresh posts SKIP_WAITING and reloads exactly once', async () => {
  const { win, sw } = await driveUpdateClick({ seedScrollY: BOTTOM_SCROLL_Y });
  assert.deepEqual(sw._waiting.messages, [{ type: 'SKIP_WAITING' }], 'waiting worker is asked to activate');
  assert.equal(win._reloads(), 1, 'location.reload() is called exactly once');
});

test('Refresh sets history.scrollRestoration to manual', async () => {
  const { win } = await driveUpdateClick({ seedScrollY: BOTTOM_SCROLL_Y });
  assert.equal(win._history.scrollRestoration, 'manual');
});

test('CONTROL: with no saved place the fresh load lands at the TOP', async () => {
  const { viewport, win } = await driveUpdateClick({ seedScrollY: null });
  assert.deepEqual(viewport._scrollCalls, [[0, 0]], 'no saved place -> restore scrolls to top');
  assert.equal(win._reloads(), 1, 'Refresh still reloads');
});

test('Later is untouched: no reload, saved place survives, restoration stays auto', async () => {
  const { storage, win, viewport } = await driveUpdateClick({ seedScrollY: BOTTOM_SCROLL_Y, actionIndex: 1 });
  assert.equal(win._reloads(), 0, 'Later must not reload');
  assert.equal(win._history.scrollRestoration, 'auto', 'Later must not touch scrollRestoration');
  // The saved place is intact, so a later ordinary reload still restores it.
  assert.notEqual(storage.getItem('shahdara_dashboard_place_v1'), null, 'saved place survives Later');
  assert.deepEqual(viewport._scrollCalls, [[0, BOTTOM_SCROLL_Y]], 'place-keeping still restores after Later');
});

test('Busy case: Refresh does not reload and does not clear the place', async () => {
  // The prompt shows while free; the operator goes busy before tapping Refresh.
  let busy = false;
  const { storage, win } = await driveUpdateClick({
    seedScrollY: BOTTOM_SCROLL_Y,
    isBusy: () => busy,
    beforeTap: () => { busy = true; },
  });
  assert.equal(win._reloads(), 0, 'busy Refresh must not reload');
  assert.equal(win._history.scrollRestoration, 'auto', 'busy Refresh must not touch scrollRestoration');
  assert.notEqual(storage.getItem('shahdara_dashboard_place_v1'), null, 'busy Refresh must not clear the saved place');
});
