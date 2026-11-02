import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SW_UPDATE_EVENT,
  SW_UPDATE_SHOWN_KEY,
  SW_UPDATE_DISMISSED_KEY,
  SW_UPDATE_TOAST_DURATION_MS,
  swUpdateVersionFromScriptUrl,
  decideSwUpdatePrompt,
  shouldShowSwUpdatePrompt,
  markSwUpdatePromptShown,
  markSwUpdatePromptDismissed,
  requestSwUpdateActivation,
  createSwUpdateReloadGuard,
  setupSwUpdatePrompt
} from '../nav-pwa.js';

import { t, TRANSLATIONS } from '../nav-language.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

/* ------------------------------- mocks ------------------------------- */

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    has: (key) => store.has(key)
  };
}

function createMockWorker(scriptURL) {
  return {
    scriptURL,
    state: 'installed',
    messages: [],
    postMessage(message) { this.messages.push(message); }
  };
}

function createMockRegistration({ waiting = null } = {}) {
  return {
    waiting,
    installing: null,
    active: null,
    update: async () => {},
    addEventListener: () => {}
  };
}

function createMockServiceWorker({ registration = null, controller = {} } = {}) {
  const listeners = new Map();
  return {
    controller,
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    },
    dispatch(type) {
      (listeners.get(type) || []).forEach(cb => cb({ type }));
    },
    getRegistration: async () => registration
  };
}

function createMockWindow({ serviceWorker = null, pending, registration } = {}) {
  const listeners = new Map();
  const win = {
    navigator: serviceWorker ? { serviceWorker } : {},
    location: {
      reloads: 0,
      reload() { this.reloads += 1; }
    },
    addEventListener(type, cb) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(cb);
    },
    dispatchEvent(evt) {
      (listeners.get(evt.type) || []).forEach(cb => cb(evt));
      return true;
    }
  };
  if (pending !== undefined) win.__swUpdatePending = pending;
  if (registration !== undefined) win.__swUpdateRegistration = registration;
  return win;
}

function createToastRecorder() {
  const calls = [];
  return { calls, onToast: (msg, opts) => { calls.push({ msg, opts }); } };
}

const V2_URL = 'https://offerpk.github.io/shahdara-isp-billing/sw.js?v=2.0.0';
const V21_URL = 'https://offerpk.github.io/shahdara-isp-billing/sw.js?v=2.1.0';

function setupWithPending({ storage = createMockStorage(), version = '2.0.0', reloadFallbackMs } = {}) {
  const worker = createMockWorker(`https://offerpk.github.io/shahdara-isp-billing/sw.js?v=${version}`);
  const registration = createMockRegistration({ waiting: worker });
  const serviceWorker = createMockServiceWorker({ registration });
  const win = createMockWindow({
    serviceWorker,
    pending: { scriptURL: worker.scriptURL, hasController: true },
    registration
  });
  const recorder = createToastRecorder();
  const options = { win, storage, onToast: recorder.onToast };
  if (reloadFallbackMs !== undefined) options.reloadFallbackMs = reloadFallbackMs;
  const controller = setupSwUpdatePrompt(options);
  return { worker, registration, serviceWorker, win, storage, recorder, controller };
}

/* --------------------------- pure decision --------------------------- */

test('sw update version: parsed from the worker scriptURL release stamp', () => {
  assert.equal(swUpdateVersionFromScriptUrl(V2_URL), '2.0.0');
  assert.equal(swUpdateVersionFromScriptUrl('./sw.js?v=1.11.0'), '1.11.0');
  assert.equal(swUpdateVersionFromScriptUrl('https://x.test/sw.js'), 'https://x.test/sw.js', 'unstamped URL falls back to the full URL');
  assert.equal(swUpdateVersionFromScriptUrl(''), '');
  assert.equal(swUpdateVersionFromScriptUrl(null), '');
  assert.equal(swUpdateVersionFromScriptUrl(undefined), '');
});

test('sw update decision: fires only for a waiting version not shown or dismissed', () => {
  assert.equal(decideSwUpdatePrompt({ waitingVersion: '' }), false, 'no waiting worker, no prompt');
  assert.equal(decideSwUpdatePrompt({}), false);
  assert.equal(decideSwUpdatePrompt({ waitingVersion: '2.0.0' }), true);
  assert.equal(decideSwUpdatePrompt({ waitingVersion: '2.0.0', dismissedVersion: '2.0.0' }), false, 'dismissed version stays silent');
  assert.equal(decideSwUpdatePrompt({ waitingVersion: '2.0.0', shownVersion: '2.0.0' }), false, 'already shown: at most once per version');
  assert.equal(decideSwUpdatePrompt({ waitingVersion: '2.1.0', dismissedVersion: '2.0.0', shownVersion: '2.0.0' }), true, 'the next deploy prompts again');
});

test('sw update records: shown/dismissed round-trip through storage', () => {
  const storage = createMockStorage();
  assert.equal(shouldShowSwUpdatePrompt({ waitingVersion: '2.0.0', storage }), true);
  markSwUpdatePromptShown(storage, '2.0.0');
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), '2.0.0');
  assert.equal(shouldShowSwUpdatePrompt({ waitingVersion: '2.0.0', storage }), false);
  assert.equal(shouldShowSwUpdatePrompt({ waitingVersion: '2.1.0', storage }), true);

  const storage2 = createMockStorage();
  markSwUpdatePromptDismissed(storage2, '2.0.0');
  assert.equal(storage2.getItem(SW_UPDATE_DISMISSED_KEY), '2.0.0');
  assert.equal(shouldShowSwUpdatePrompt({ waitingVersion: '2.0.0', storage: storage2 }), false);
  assert.equal(shouldShowSwUpdatePrompt({ waitingVersion: '2.1.0', storage: storage2 }), true, 'dismissal is per-version, not forever');

  // No storage at all: decisions still work, records simply do not persist.
  assert.equal(shouldShowSwUpdatePrompt({ waitingVersion: '2.0.0', storage: null }), true);
  assert.doesNotThrow(() => { markSwUpdatePromptShown(null, '2.0.0'); markSwUpdatePromptDismissed(null, '2.0.0'); });
});

test('sw update activation: posts SKIP_WAITING to the waiting worker only', () => {
  const worker = createMockWorker(V2_URL);
  assert.equal(requestSwUpdateActivation(worker), true);
  assert.deepEqual(worker.messages, [{ type: 'SKIP_WAITING' }]);
  assert.equal(requestSwUpdateActivation(null), false);
  assert.equal(requestSwUpdateActivation({}), false);
});

test('sw update reload guard: reloads exactly once', () => {
  const guard = createSwUpdateReloadGuard();
  let reloads = 0;
  assert.equal(guard.reloadOnce(() => { reloads += 1; }), true);
  assert.equal(guard.reloadOnce(() => { reloads += 1; }), false);
  assert.equal(reloads, 1);
  assert.equal(guard.reloaded, true);
});

/* ----------------------------- controller ---------------------------- */

test('sw update prompt: shows once per version via the bilingual app toast', () => {
  const { win, storage, recorder, controller } = setupWithPending({});
  assert.equal(recorder.calls.length, 1, 'pending update on load prompts once');
  const [call] = recorder.calls;
  assert.equal(call.msg, TRANSLATIONS.en.sw_update_ready);
  assert.equal(call.opts.type, 'info');
  assert.equal(call.opts.duration, SW_UPDATE_TOAST_DURATION_MS);
  assert.deepEqual(
    call.opts.actions.map(a => a.label),
    [TRANSLATIONS.en.sw_update_refresh, TRANSLATIONS.en.sw_update_dismiss]
  );
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), '2.0.0');
  assert.equal(controller.pendingVersion, '2.0.0');

  // The same signal arriving again (controllerchange re-dispatch) must not re-prompt.
  win.dispatchEvent({ type: SW_UPDATE_EVENT, detail: { scriptURL: V2_URL, hasController: true } });
  assert.equal(controller.checkNow(), false);
  assert.equal(recorder.calls.length, 1, 'at most once per version');
});

test('sw update prompt: a dismissed version stays silent, the next deploy prompts', () => {
  const storage = createMockStorage({ [SW_UPDATE_DISMISSED_KEY]: '2.0.0' });
  const { win, recorder } = setupWithPending({ storage });
  assert.equal(recorder.calls.length, 0, 'dismissed 2.0.0 never prompts');

  win.__swUpdatePending = { scriptURL: V21_URL, hasController: true };
  win.dispatchEvent({ type: SW_UPDATE_EVENT, detail: { scriptURL: V21_URL, hasController: true } });
  assert.equal(recorder.calls.length, 1, 'a new version prompts again');
});

test('sw update prompt: never fires on a first install (no existing controller)', () => {
  const worker = createMockWorker(V2_URL);
  const registration = createMockRegistration({ waiting: worker });
  const serviceWorker = createMockServiceWorker({ registration, controller: null });
  const win = createMockWindow({
    serviceWorker,
    pending: { scriptURL: V2_URL, hasController: false },
    registration
  });
  const recorder = createToastRecorder();
  setupSwUpdatePrompt({ win, storage: createMockStorage(), onToast: recorder.onToast });
  assert.equal(recorder.calls.length, 0);
});

test('sw update prompt: no waiting update, no prompt', async () => {
  const registration = createMockRegistration({ waiting: null });
  const serviceWorker = createMockServiceWorker({ registration });
  const win = createMockWindow({ serviceWorker });
  const recorder = createToastRecorder();
  const controller = setupSwUpdatePrompt({ win, storage: createMockStorage(), onToast: recorder.onToast });
  await tick();
  assert.equal(recorder.calls.length, 0);
  assert.equal(controller.checkNow(), false);

  const bareWin = createMockWindow({});
  const bare = setupSwUpdatePrompt({ win: bareWin, storage: createMockStorage(), onToast: recorder.onToast });
  assert.equal(bare.checkNow(), false, 'no serviceWorker support: silent no-op');
  assert.equal(recorder.calls.length, 0);
});

test('sw update refresh: SKIP_WAITING posted, reload happens exactly once', async () => {
  const { win, serviceWorker, worker, recorder } = setupWithPending({ reloadFallbackMs: 30 });
  assert.equal(recorder.calls.length, 1);
  recorder.calls[0].opts.actions[0].onAction(); // Refresh
  assert.deepEqual(worker.messages, [{ type: 'SKIP_WAITING' }], 'waiting worker was asked to activate');
  assert.equal(win.location.reloads, 0, 'no reload until the new worker takes control');

  serviceWorker.dispatch('controllerchange');
  assert.equal(win.location.reloads, 1);
  await new Promise(resolve => setTimeout(resolve, 90)); // let the fallback timer fire too
  assert.equal(win.location.reloads, 1, 'fallback timer cannot double-reload');
});

test('sw update refresh: an already-activated worker reloads immediately, once', () => {
  const registration = createMockRegistration({ waiting: null });
  const serviceWorker = createMockServiceWorker({ registration });
  const win = createMockWindow({
    serviceWorker,
    pending: { scriptURL: V2_URL, hasController: true },
    registration
  });
  const recorder = createToastRecorder();
  setupSwUpdatePrompt({ win, storage: createMockStorage(), onToast: recorder.onToast });
  assert.equal(recorder.calls.length, 1, 'a retained pending update still prompts');
  recorder.calls[0].opts.actions[0].onAction(); // Refresh
  assert.equal(win.location.reloads, 1, 'nothing waiting: reload straight away');
});

test('sw update dismiss: Later records the version and silences it', () => {
  const { win, storage, recorder } = setupWithPending({});
  assert.equal(recorder.calls.length, 1);
  recorder.calls[0].opts.actions[1].onAction(); // Later
  assert.equal(storage.getItem(SW_UPDATE_DISMISSED_KEY), '2.0.0');
  win.dispatchEvent({ type: SW_UPDATE_EVENT, detail: { scriptURL: V2_URL, hasController: true } });
  assert.equal(recorder.calls.length, 1, 'dismissed version never re-prompts');
});

/* -------------------------------- i18n ------------------------------- */

test('sw update i18n: keys defined exactly twice and resolve in both languages', () => {
  const source = read('nav-language.js');
  for (const key of ['sw_update_ready', 'sw_update_refresh', 'sw_update_dismiss']) {
    assert.equal(source.split(`${key}:`).length - 1, 2, `${key} must be defined once per language`);
    assert.ok(TRANSLATIONS.en[key], `${key} has an English value`);
    assert.ok(TRANSLATIONS.ur[key], `${key} has an Urdu value`);
    assert.equal(t(key, 'en'), TRANSLATIONS.en[key]);
    assert.equal(t(key, 'ur'), TRANSLATIONS.ur[key]);
    assert.notEqual(t(key, 'ur'), key, 'Urdu must not fall back to the raw key');
  }
  assert.ok(TRANSLATIONS.en.sw_update_ready.includes('Naya version tayyar hai'), 'the friendly phrase from the old banner is kept');
});

/* --------------------------- static wiring --------------------------- */

test('sw update wiring: head script detects and stashes, it no longer renders a bar', () => {
  const index = read('index.html');
  const head = index.slice(0, index.indexOf('<body>'));
  const pkg = JSON.parse(read('package.json'));
  assert.ok(head.includes(`navigator.serviceWorker.register('./sw.js?v=${pkg.version}'`), 'registration keeps the shipped versioned URL');
  assert.ok(head.includes('registration.waiting'), 'waiting worker on load is detected');
  assert.ok(head.includes("addEventListener('updatefound'"), 'in-session updates are detected');
  assert.ok(head.includes("state==='installed'"), 'detection waits for the installed state');
  assert.ok(head.includes("addEventListener('controllerchange'"), 'controllerchange re-notifies');
  assert.ok(head.includes('__swUpdatePending'), 'pending update is stashed for the controller');
  assert.ok(head.includes('sw-update-pending'), 'pending update is dispatched as an event');
  assert.ok(!head.includes('swUpdateBanner'), 'the hardcoded banner bar (and its hardcoded colours) is gone');
});

test('sw update wiring: app boots the controller and nav re-exports it', () => {
  const app = read('app.js');
  assert.ok(app.includes('setupSwUpdatePrompt'), 'app.js imports the controller setup');
  assert.ok(app.includes('window.swUpdateController = setupSwUpdatePrompt('), 'app.js boots the controller');
  const nav = read('nav.js');
  assert.ok(nav.includes('setupSwUpdatePrompt'), 'nav.js re-exports the setup for app.js');
  const navPwa = read('nav-pwa.js');
  assert.ok(navPwa.includes("postMessage({ type: 'SKIP_WAITING' })"), 'activation uses the message sw.js already handles');
  assert.ok(navPwa.includes('location.reload()'), 'the controller owns the reload');
});
