// Update popup twice — the "Naya version tayyar hai" Note must appear
// ONCE per page session, not once per deploy.
//
// The update-prompt dedupe is per version (decideSwUpdatePrompt blocks
// only the SAME version string), so two deploys landing while the app
// is open each passed the gate and the toast system stacked a second
// card above the first. The fix is a session-level shown flag in
// setupSwUpdatePrompt's closure (nav-pwa.js): the first show sets it,
// a second deploy in the same session shows nothing, and the newer
// version is never written to the shown record, so it prompts on the
// next page load.
//
// Harness: the sw-update-prompt.test.js mocks (mock window / service
// worker / registration / storage / toast recorder), adapted to drive
// two deploys inside one page session. Mock dispatch MUST snapshot
// the listener list (a listener re-registering during dispatch would
// OOM on live iteration). The mock window has no `document`, so the
// Plan G busy check returns not-busy, as in the existing tests.
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
// This file is NOT a pinning file: it carries no parity total.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SW_UPDATE_EVENT,
  SW_UPDATE_SHOWN_KEY,
  setupSwUpdatePrompt
} from '../nav-pwa.js';

// The frozen ?v= stamp the shipped sw.js carries (SW_UPDATE_FROZEN_VERSION).
const FROZEN_URL = 'https://offerpk.github.io/shahdara-isp-billing/sw.js?v=1.11.0';
// Two distinct deploy cache names (build.mjs stamps a 10-hex content hash).
const CACHE_A = 'shahdara-isp-billing-v37-aaaa000001';
const CACHE_B = 'shahdara-isp-billing-v37-bbbb000002';
const CACHE_C = 'shahdara-isp-billing-v37-cccc000003';

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, val) => { store.set(key, String(val)); },
    removeItem: (key) => { store.delete(key); }
  };
}

function createMockWorker() {
  return {
    scriptURL: FROZEN_URL,
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
    // Snapshot-iteration dispatch.
    dispatch(type, evt = {}) {
      for (const cb of [...(listeners.get(type) || [])]) cb({ type, ...evt });
    },
    dispatchMessage(data) {
      for (const cb of [...(listeners.get('message') || [])]) cb({ data });
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
      for (const cb of [...(listeners.get(evt.type) || [])]) cb(evt);
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

function setupOneDeploy({ storage = createMockStorage() } = {}) {
  const workerA = createMockWorker();
  const registration = createMockRegistration({ waiting: workerA });
  const serviceWorker = createMockServiceWorker({ registration });
  const win = createMockWindow({
    serviceWorker,
    pending: { scriptURL: FROZEN_URL, hasController: true },
    registration
  });
  const recorder = createToastRecorder();
  const controller = setupSwUpdatePrompt({ win, storage, onToast: recorder.onToast });
  // Setup-time consider() asks the waiting worker for its cache name.
  assert.deepEqual(workerA.messages, [{ type: 'SW_GET_STATUS' }],
    'precondition: the setup asks the waiting worker for its status');
  return { workerA, registration, serviceWorker, win, storage, recorder, controller };
}

function answerStatus(serviceWorker, cacheName) {
  serviceWorker.dispatchMessage({ type: 'SW_STATUS', cache: cacheName });
}

// A second deploy lands mid-session: a NEW waiting worker installs
// (updatefound) and the head script re-dispatches the pending event.
function secondDeployArrives({ registration, win }, workerB) {
  registration.waiting = workerB;
  win.__swUpdatePending = { scriptURL: FROZEN_URL, hasController: true };
  win.dispatchEvent({ type: SW_UPDATE_EVENT, detail: { scriptURL: FROZEN_URL, hasController: true } });
  assert.deepEqual(workerB.messages, [{ type: 'SW_GET_STATUS' }],
    'precondition: the new waiting worker is asked for its status');
}

test('C1: two deploys in one page session show the update prompt exactly ONCE', () => {
  const ctx = setupOneDeploy();
  answerStatus(ctx.serviceWorker, CACHE_A);
  assert.equal(ctx.recorder.calls.length, 1, 'precondition: the first deploy prompts once');

  const workerB = createMockWorker();
  secondDeployArrives(ctx, workerB);
  answerStatus(ctx.serviceWorker, CACHE_B);
  assert.equal(ctx.recorder.calls.length, 1,
    'the second deploy in the same session must NOT show a second Note card');
  assert.equal(ctx.recorder.calls[0].opts.actions.length, 2,
    'the single shown prompt still carries Refresh + Later');
});

test('C2: after Later dismisses the first prompt, a second deploy in the same session still shows no second card', () => {
  const ctx = setupOneDeploy();
  answerStatus(ctx.serviceWorker, CACHE_A);
  assert.equal(ctx.recorder.calls.length, 1, 'precondition: the first deploy prompts once');
  ctx.recorder.calls[0].opts.actions[1].onAction(); // Later

  const workerB = createMockWorker();
  secondDeployArrives(ctx, workerB);
  answerStatus(ctx.serviceWorker, CACHE_B);
  assert.equal(ctx.recorder.calls.length, 1,
    'dismissing the first prompt must not let the second deploy open a second card this session');
});

test('C3: a controllerchange re-dispatch plus a third deploy still shows exactly ONE card', () => {
  const ctx = setupOneDeploy();
  answerStatus(ctx.serviceWorker, CACHE_A);
  assert.equal(ctx.recorder.calls.length, 1, 'precondition: the first deploy prompts once');

  // The head script re-dispatches the stashed pending event on controllerchange.
  ctx.win.dispatchEvent({ type: SW_UPDATE_EVENT, detail: { scriptURL: FROZEN_URL, hasController: true } });
  assert.equal(ctx.recorder.calls.length, 1, 'the re-dispatch alone must not re-prompt');

  const workerC = createMockWorker();
  secondDeployArrives(ctx, workerC);
  answerStatus(ctx.serviceWorker, CACHE_C);
  assert.equal(ctx.recorder.calls.length, 1,
    'a third deploy in the same session must NOT show another card');
});

test('S1: a single deploy still prompts exactly once', () => {
  const ctx = setupOneDeploy();
  answerStatus(ctx.serviceWorker, CACHE_A);
  assert.equal(ctx.recorder.calls.length, 1, 'one deploy, one prompt');
  assert.equal(ctx.recorder.calls[0].msg.includes('Naya version tayyar hai'), true,
    'the prompt is the familiar update message');
});

test('S2: the deferred newer deploy prompts on the NEXT page load (the fix is session-scoped, not permanent)', () => {
  const first = setupOneDeploy();
  answerStatus(first.serviceWorker, CACHE_A);
  assert.equal(first.recorder.calls.length, 1, 'precondition: first session prompts once');
  const storage = first.storage;
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), 'swu-aaaa000001',
    'precondition: the shown record holds the first deploy');

  // A fresh page load (new controller, same storage) with the newer deploy waiting.
  const workerB = createMockWorker();
  const registration = createMockRegistration({ waiting: workerB });
  const serviceWorker = createMockServiceWorker({ registration });
  const win = createMockWindow({
    serviceWorker,
    pending: { scriptURL: FROZEN_URL, hasController: true },
    registration
  });
  const recorder = createToastRecorder();
  setupSwUpdatePrompt({ win, storage, onToast: recorder.onToast });
  answerStatus(serviceWorker, CACHE_B);
  assert.equal(recorder.calls.length, 1,
    'the newer deploy must prompt on the next load — it was only deferred, never lost');
});

test('B1: Refresh on the single shown card activates the NEWEST waiting worker and reloads exactly once', async () => {
  const ctx = setupOneDeploy();
  answerStatus(ctx.serviceWorker, CACHE_A);
  const workerB = createMockWorker();
  secondDeployArrives(ctx, workerB);
  answerStatus(ctx.serviceWorker, CACHE_B);

  // The single card's Refresh must target the live waiting worker (the newest deploy).
  ctx.recorder.calls[0].opts.actions[0].onAction(); // Refresh
  assert.deepEqual(workerB.messages, [{ type: 'SW_GET_STATUS' }, { type: 'SKIP_WAITING' }],
    'Refresh activates the newest waiting worker');
  assert.deepEqual(ctx.workerA.messages, [{ type: 'SW_GET_STATUS' }],
    'the stale worker is never asked to activate');
  assert.equal(ctx.win.location.reloads, 0, 'no reload until the new worker takes control');
  ctx.serviceWorker.dispatch('controllerchange');
  assert.equal(ctx.win.location.reloads, 1);
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.equal(ctx.win.location.reloads, 1, 'the fallback timer cannot double-reload');
});

test('B2: the shown record still marks the prompted version', () => {
  const ctx = setupOneDeploy();
  answerStatus(ctx.serviceWorker, CACHE_A);
  assert.equal(ctx.storage.getItem(SW_UPDATE_SHOWN_KEY), 'swu-aaaa000001',
    'the first deploy is recorded as shown');
  assert.equal(ctx.controller.pendingVersion, 'swu-aaaa000001',
    'the controller tracks the prompted version');
});
