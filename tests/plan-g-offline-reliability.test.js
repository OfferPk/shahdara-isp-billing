import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import {
  setupSwUpdatePrompt,
  isSwUpdatePromptBusy,
  defaultSwUpdateBusyCheck,
  clearSwUpdatePromptShown,
  SW_UPDATE_SHOWN_KEY,
  SW_UPDATE_DISMISSED_KEY,
  SW_UPDATE_EVENT
} from '../nav-pwa.js';
import { describeWriteFailure, writeFailureMessage } from '../ui-feedback.js';
import {
  setupOfflineSyncBanner,
  setupOfflineQueueModal,
  addOfflineSyncItem,
  OFFLINE_SYNC_QUEUE_KEY
} from '../nav.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

/* ------------------------------- sw.js ------------------------------- */

const workerSource = read('sw.js');

class MockResponse {
  constructor(body, opts = {}) {
    this.body = body;
    this.status = opts.status ?? 200;
    this.headers = opts.headers ?? {};
    this.ok = this.status >= 200 && this.status < 300;
    this.type = 'basic';
  }
  clone() { return this; }
}

function createWorker({ cacheNames = [], entries = [], precacheFails = false } = {}) {
  const origin = 'https://billing.example';
  const handlers = new Map();
  const names = new Set(cacheNames);
  const stored = new Map([...names].map(name => [name, new Map()]));
  const posted = [];
  const clients = [{ posted: [], postMessage(msg) { this.posted.push(msg); posted.push(msg); } }];
  let fetchImpl = async () => { throw new Error('offline'); };
  let skipWaitingCalls = 0;
  let claimCalls = 0;
  const urlFor = request => new URL(typeof request === 'string' ? request : request.url, `${origin}/`);
  for (const [name, path, value] of entries) {
    names.add(name);
    if (!stored.has(name)) stored.set(name, new Map());
    stored.get(name).set(urlFor(path).pathname, value);
  }
  const cacheFor = name => {
    names.add(name);
    if (!stored.has(name)) stored.set(name, new Map());
    return {
      addAll: async files => {
        if (precacheFails) throw new Error('precache boom');
        return files;
      },
      put: async (request, response) => { stored.get(name).set(urlFor(request).pathname, response); }
    };
  };
  const caches = {
    open: async name => cacheFor(name),
    keys: async () => [...names],
    delete: async name => { stored.delete(name); return names.delete(name); },
    match: async (request) => {
      const pathname = urlFor(request).pathname;
      for (const name of names) {
        const value = stored.get(name)?.get(pathname);
        if (value !== undefined) return value;
      }
      return undefined;
    }
  };
  const self = {
    location: { origin },
    addEventListener: (type, callback) => handlers.set(type, callback),
    skipWaiting: () => { skipWaitingCalls += 1; return Promise.resolve(); },
    clients: {
      claim: () => { claimCalls += 1; return Promise.resolve(); },
      matchAll: async () => clients
    }
  };
  runInNewContext(workerSource, { self, caches, fetch: request => fetchImpl(request), URL, Promise, Response: MockResponse });
  return {
    names, posted, clients,
    get skipWaitingCalls() { return skipWaitingCalls; },
    get claimCalls() { return claimCalls; },
    setFetch: fn => { fetchImpl = fn; },
    async dispatch(type, request) {
      const waits = [];
      let responsePromise;
      let responded = false;
      const event = {
        request,
        waitUntil: promise => waits.push(Promise.resolve(promise)),
        respondWith: promise => { responded = true; responsePromise = Promise.resolve(promise); }
      };
      handlers.get(type)(event);
      await Promise.all(waits);
      return { responded, response: responded ? await responsePromise : undefined };
    },
    dispatchMessage(data, source) {
      handlers.get('message')({ data, source });
    }
  };
}

test('Plan G worker: install still precaches the shell and takes control', async () => {
  const worker = createWorker();
  await worker.dispatch('install');
  assert.equal(worker.skipWaitingCalls, 1);
  assert.deepEqual(worker.posted, []);
});

test('Plan G worker: a precache failure notifies clients and does not silently pass', async () => {
  const worker = createWorker({ precacheFails: true });
  await assert.rejects(() => worker.dispatch('install'));
  await tick();
  assert.equal(worker.posted.length, 1);
  assert.equal(worker.posted[0].type, 'SW_PRECACHE_FAILED');
  assert.match(worker.posted[0].error, /precache boom/);
});

test('Plan G worker: navigation offline falls back to the shell and notifies clients', async () => {
  const worker = createWorker({
    cacheNames: ['shahdara-isp-billing-v37'],
    entries: [['shahdara-isp-billing-v37', './index.html', 'cached shell']]
  });
  const result = await worker.dispatch('fetch', { url: 'https://billing.example/', method: 'GET', mode: 'navigate' });
  assert.equal(result.response, 'cached shell');
  await tick();
  assert.equal(worker.posted[0].type, 'SW_OFFLINE_FALLBACK');
});

test('Plan G worker: an offline asset is a 503, never the app shell', async () => {
  const worker = createWorker({
    cacheNames: ['shahdara-isp-billing-v37'],
    entries: [['shahdara-isp-billing-v37', './index.html', 'cached shell']]
  });
  const result = await worker.dispatch('fetch', { url: 'https://billing.example/app.js', method: 'GET' });
  assert.equal(result.response.status, 503);
  assert.equal(result.response.body, 'Offline — file unavailable');
  await tick();
  assert.equal(worker.posted[0].type, 'SW_ASSET_OFFLINE');
});

test('Plan G worker: a versioned asset offline is still an asset, not the shell', async () => {
  const worker = createWorker({ cacheNames: ['shahdara-isp-billing-v37'] });
  const result = await worker.dispatch('fetch', { url: 'https://billing.example/app.js?v=1.11.0', method: 'GET' });
  assert.equal(result.response.status, 503);
});

test('Plan G worker: an offline SPA route without an extension still gets the shell', async () => {
  const worker = createWorker({
    cacheNames: ['shahdara-isp-billing-v37'],
    entries: [['shahdara-isp-billing-v37', './index.html', 'cached shell']]
  });
  const result = await worker.dispatch('fetch', { url: 'https://billing.example/uncached-route', method: 'GET' });
  assert.equal(result.response, 'cached shell');
  await tick();
  assert.equal(worker.posted[0].type, 'SW_OFFLINE_FALLBACK');
});

test('Plan G worker: a cached asset is served with no notification and no fetch', async () => {
  const worker = createWorker({
    cacheNames: ['shahdara-isp-billing-v37'],
    entries: [['shahdara-isp-billing-v37', '/app.js', 'cached module']]
  });
  const result = await worker.dispatch('fetch', { url: 'https://billing.example/app.js?v=1.10.0', method: 'GET' });
  assert.equal(result.response, 'cached module');
  await tick();
  assert.deepEqual(worker.posted, []);
});

test('Plan G worker: SKIP_WAITING still activates, and SW_GET_STATUS answers', () => {
  const worker = createWorker();
  worker.dispatchMessage('SKIP_WAITING');
  assert.equal(worker.skipWaitingCalls, 1);
  const source = { posted: [], postMessage(msg) { this.posted.push(msg); } };
  worker.dispatchMessage({ type: 'SW_GET_STATUS' }, source);
  assert.equal(source.posted[0].type, 'SW_STATUS');
  assert.equal(source.posted[0].cache, 'shahdara-isp-billing-v37');
});

test('Plan G worker: non-GET and cross-origin requests are left to the browser', async () => {
  const worker = createWorker();
  const post = await worker.dispatch('fetch', { url: 'https://billing.example/records', method: 'POST' });
  const external = await worker.dispatch('fetch', { url: 'https://wa.me/12345678', method: 'GET' });
  assert.equal(post.responded, false);
  assert.equal(external.responded, false);
});

test('Plan G worker: source keeps the exact CACHE_NAME and APP_FILES shapes the build rewrites', () => {
  assert.match(workerSource, /const CACHE_NAME = 'shahdara-isp-billing-v37';/);
  assert.match(workerSource, /const APP_FILES = \['\.\/','\.\/index\.html'/);
  assert.match(workerSource, /SW_PRECACHE_FAILED/);
  assert.match(workerSource, /SW_ASSET_OFFLINE/);
  assert.match(workerSource, /SW_OFFLINE_FALLBACK/);
});

/* --------------------------- update deferral --------------------------- */

test('Plan G update busy rule: free by default', () => {
  assert.equal(isSwUpdatePromptBusy(), false);
  assert.equal(isSwUpdatePromptBusy({}), false);
});

test('Plan G update busy rule: an open dialog is busy', () => {
  assert.equal(isSwUpdatePromptBusy({ hasOpenDialog: true }), true);
});

test('Plan G update busy rule: unsaved changes are busy', () => {
  assert.equal(isSwUpdatePromptBusy({ hasUnsavedChanges: true }), true);
});

test('Plan G update busy check: a document with an open dialog is busy', () => {
  const doc = { querySelector: sel => (sel === 'dialog[open]' ? { tagName: 'DIALOG' } : null) };
  assert.equal(defaultSwUpdateBusyCheck({ document: doc }), true);
});

test('Plan G update busy check: a dirty or busy element is busy', () => {
  const doc = { querySelector: sel => (sel === '.is-dirty, [aria-busy="true"]' ? { className: 'is-dirty' } : null) };
  assert.equal(defaultSwUpdateBusyCheck({ document: doc }), true);
});

test('Plan G update busy check: no document, or a clean document, is not busy', () => {
  assert.equal(defaultSwUpdateBusyCheck({}), false);
  assert.equal(defaultSwUpdateBusyCheck(null), false);
  const clean = { querySelector: () => null };
  assert.equal(defaultSwUpdateBusyCheck({ document: clean }), false);
});

function createMockStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key)
  };
}
function createMockWorker(scriptURL) {
  return { scriptURL, state: 'installed', messages: [], postMessage(m) { this.messages.push(m); } };
}
function createPromptWindow({ pending, registration, docListeners = null } = {}) {
  const listeners = new Map();
  const worker = createMockWorker('https://offerpk.github.io/shahdara-isp-billing/sw.js?v=2.0.0');
  const serviceWorker = {
    controller: {},
    addEventListener: (type, cb) => listeners.set(type, (listeners.get(type) || []).concat(cb)),
    getRegistration: async () => registration || { waiting: worker }
  };
  const win = {
    navigator: { serviceWorker },
    location: { reloads: 0, reload() { this.reloads += 1; } },
    addEventListener: (type, cb) => listeners.set(type, (listeners.get(type) || []).concat(cb)),
    dispatchEvent: evt => { (listeners.get(evt.type) || []).forEach(cb => cb(evt)); return true; }
  };
  if (pending !== undefined) win.__swUpdatePending = pending;
  if (registration !== undefined) win.__swUpdateRegistration = registration;
  if (docListeners) {
    win.document = {
      querySelector: () => null,
      addEventListener: (type, cb) => docListeners.set(type, (docListeners.get(type) || []).concat(cb))
    };
  }
  return { win, worker, serviceWorker };
}
const PENDING_V2 = { scriptURL: 'https://offerpk.github.io/shahdara-isp-billing/sw.js?v=2.0.0', hasController: true };

test('Plan G update prompt: a busy operator gets no toast and no shown record, only a deferral', () => {
  const { win } = createPromptWindow({ pending: PENDING_V2 });
  const storage = createMockStorage();
  const toasts = [];
  const controller = setupSwUpdatePrompt({
    win, storage, onToast: (msg, opts) => toasts.push({ msg, opts }), isBusy: () => true
  });
  assert.equal(toasts.length, 0, 'no toast mid-entry');
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), null, 'not marked shown');
  assert.equal(storage.getItem(SW_UPDATE_DISMISSED_KEY), null, 'not dismissed either');
  assert.equal(controller.deferredVersion, '2.0.0');
});

test('Plan G update prompt: reconsidering after the entry finishes shows the prompt', () => {
  let busy = true;
  const { win } = createPromptWindow({ pending: PENDING_V2 });
  const storage = createMockStorage();
  const toasts = [];
  const controller = setupSwUpdatePrompt({
    win, storage, onToast: (msg, opts) => toasts.push({ msg, opts }), isBusy: () => busy
  });
  assert.equal(toasts.length, 0);
  busy = false;
  assert.equal(controller.reconsider(), true);
  assert.equal(toasts.length, 1);
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), '2.0.0');
  assert.equal(controller.deferredVersion, '');
});

test('Plan G update prompt: a dialog closing re-offers a deferred update', () => {
  let busy = true;
  const docListeners = new Map();
  const { win } = createPromptWindow({ pending: PENDING_V2, docListeners });
  const storage = createMockStorage();
  const toasts = [];
  setupSwUpdatePrompt({
    win, storage, onToast: (msg, opts) => toasts.push({ msg, opts }), isBusy: () => busy
  });
  assert.equal(toasts.length, 0);
  busy = false;
  for (const cb of docListeners.get('close') || []) cb({ target: { tagName: 'DIALOG' } });
  assert.equal(toasts.length, 1, 'closing the dialog re-offers the deferred update');
});

test('Plan G update prompt: Refresh while busy reloads nothing and clears the shown record', () => {
  // Prompt while free, then the operator starts an entry before tapping
  // Refresh: the tap must not activate the worker or reload the page.
  let busyFlag = false;
  const { win, worker } = createPromptWindow({ pending: PENDING_V2 });
  const storage = createMockStorage();
  const toasts = [];
  const controller = setupSwUpdatePrompt({
    win, storage, onToast: (msg, opts) => toasts.push({ msg, opts }), isBusy: () => busyFlag
  });
  assert.equal(toasts.length, 1);
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), '2.0.0');
  busyFlag = true;
  assert.equal(controller.refresh(), false, 'busy refresh must not reload');
  assert.equal(win.location.reloads, 0);
  assert.deepEqual(worker.messages, [], 'no SKIP_WAITING while busy');
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), null, 'shown record cleared so the offer can return');
});

test('Plan G update prompt: clear shown record is a safe no-op without storage', () => {
  assert.doesNotThrow(() => clearSwUpdatePromptShown(null));
  const storage = createMockStorage({ [SW_UPDATE_SHOWN_KEY]: '2.0.0' });
  clearSwUpdatePromptShown(storage);
  assert.equal(storage.getItem(SW_UPDATE_SHOWN_KEY), null);
});

/* ------------------------- write failures ------------------------- */

test('Plan G write failure: storage full says what failed and what to do', () => {
  const d = describeWriteFailure({ operation: 'Payment', error: { name: 'QuotaExceededError', message: 'quota exceeded' } });
  assert.equal(d.title, 'Storage full');
  assert.match(d.message, /Payment was not saved/);
  assert.match(d.nextStep, /Free up space/);
  assert.match(d.nextStep, /Nothing was recorded/);
  assert.equal(d.retryable, true);
});

test('Plan G write failure: blocked storage is named, not a generic error', () => {
  const d = describeWriteFailure({ operation: 'Customer', error: { name: 'SecurityError', message: 'blocked' } });
  assert.equal(d.title, 'Storage blocked');
  assert.match(d.nextStep, /private mode/);
});

test('Plan G write failure: offline says the entry is still in the form', () => {
  const d = describeWriteFailure({ operation: 'Payment', online: false });
  assert.equal(d.title, 'You are offline');
  assert.match(d.message, /not sent/);
  assert.match(d.nextStep, /still in the form/);
});

test('Plan G write failure: an unknown error still says it was not saved', () => {
  const d = describeWriteFailure({ operation: 'Backup', error: new Error('boom') });
  assert.equal(d.title, 'Could not save');
  assert.match(d.message, /Backup failed and was not saved/);
  assert.match(d.nextStep, /try again/);
});

test('Plan G write failure: defaults to Save, and a string error still classifies quota', () => {
  assert.match(describeWriteFailure({}).message, /Save failed/);
  assert.equal(describeWriteFailure({ error: 'QuotaExceededError: out of space' }).title, 'Storage full');
});

test('Plan G write failure: the one-line message carries title, failure and next step', () => {
  const msg = writeFailureMessage({ operation: 'Payment', online: false });
  assert.match(msg, /You are offline/);
  assert.match(msg, /not sent/);
  assert.match(msg, /Reconnect/);
});

/* --------------------- offline banner + queue UI --------------------- */

function createMockElement(id) {
  const listeners = new Map();
  const el = {
    id, className: '', textContent: '', hidden: false, disabled: false, dataset: {},
    children: [],
    classList: { toggle: () => {}, contains: () => false, add: () => {}, remove: () => {} },
    setAttribute: () => {}, removeAttribute: () => {},
    appendChild(child) { this.children.push(child); return child; },
    insertBefore(child) { this.children.push(child); return child; },
    addEventListener: (type, fn) => listeners.set(type, (listeners.get(type) || []).concat(fn)),
    listeners,
    querySelectorAll: () => [],
    get nextSibling() { return null; }
  };
  return el;
}
function collectText(el) {
  let out = el.textContent || '';
  for (const child of el.children || []) out += ' ' + collectText(child);
  return out;
}
function createQueueStorage() {
  const store = new Map();
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key),
    _store: store
  };
}

test('Plan G offline banner: while offline it stays visible and is not auto-hidden', () => {
  const origDoc = globalThis.document;
  const origNavigator = globalThis.navigator;
  const origSetTimeout = globalThis.setTimeout;
  const timers = [];
  globalThis.setTimeout = (fn, ms) => { timers.push(ms); return 1; };
  try {
    const banner = createMockElement('offlineSyncBanner');
    const textEl = createMockElement('offlineSyncText');
    const retryBtn = createMockElement('offlineSyncRetryBtn');
    const dismissBtn = createMockElement('offlineSyncDismissBtn');
    const viewQueueBtn = createMockElement('offlineSyncViewQueueBtn');
    const byId = {
      offlineSyncBanner: banner, offlineSyncText: textEl, offlineSyncRetryBtn: retryBtn,
      offlineSyncDismissBtn: dismissBtn, offlineSyncViewQueueBtn: viewQueueBtn
    };
    globalThis.document = { getElementById: id => byId[id] || null, body: {} };
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true, writable: true });
    const storage = createQueueStorage();
    addOfflineSyncItem({ action: 'record_payment', summary: 'Receipt for Ali' }, storage);
    addOfflineSyncItem({ action: 'add_customer', summary: 'New subscriber Tariq' }, storage);
    const controller = setupOfflineSyncBanner({ storage });
    assert.equal(banner.hidden, false, 'offline banner must stay visible');
    assert.match(textEl.textContent, /Offline Mode/);
    assert.match(textEl.textContent, /2 pending/);
    assert.deepEqual(timers, [], 'no auto-hide timer may be scheduled while offline');
    assert.equal(controller.getQueueCount(), 2);
  } finally {
    globalThis.document = origDoc;
    Object.defineProperty(globalThis, 'navigator', { value: origNavigator, configurable: true, writable: true });
    globalThis.setTimeout = origSetTimeout;
  }
});

test('Plan G offline banner: online with a queue shows confirming, not silence', () => { // QC-9: confirming locally, never "syncing"
  const origDoc = globalThis.document;
  const origNavigator = globalThis.navigator;
  try {
    const banner = createMockElement('offlineSyncBanner');
    const textEl = createMockElement('offlineSyncText');
    const retryBtn = createMockElement('offlineSyncRetryBtn');
    const viewQueueBtn = createMockElement('offlineSyncViewQueueBtn');
    const byId = {
      offlineSyncBanner: banner, offlineSyncText: textEl, offlineSyncRetryBtn: retryBtn,
      offlineSyncViewQueueBtn: viewQueueBtn
    };
    globalThis.document = { getElementById: id => byId[id] || null, body: {} };
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
    const storage = createQueueStorage();
    addOfflineSyncItem({ action: 'record_payment', summary: 'Receipt for Ali' }, storage);
    setupOfflineSyncBanner({ storage });
    assert.equal(banner.hidden, false);
    assert.match(textEl.textContent, /Confirming 1 queued action/); // QC-9: confirming locally, never "Syncing"
    assert.equal(retryBtn.hidden, false);
  } finally {
    globalThis.document = origDoc;
    Object.defineProperty(globalThis, 'navigator', { value: origNavigator, configurable: true, writable: true });
  }
});

function setupQueueModalWith(items) {
  const origDoc = globalThis.document;
  const modal = createMockElement('offlineQueueModal');
  modal.showModal = () => {};
  const listEl = createMockElement('offlineQueueList');
  const countBadge = createMockElement('queueItemCountBadge');
  const emptyMsg = createMockElement('offlineQueueEmptyMessage');
  const byId = {
    offlineQueueModal: modal,
    closeOfflineQueueModalBtn: createMockElement('closeOfflineQueueModalBtn'),
    queueSyncAllBtn: createMockElement('queueSyncAllBtn'),
    queueRetryFailedBtn: createMockElement('queueRetryFailedBtn'),
    queueClearAllBtn: createMockElement('queueClearAllBtn'),
    offlineQueueList: listEl,
    queueItemCountBadge: countBadge,
    queueDeadLetterBadge: createMockElement('queueDeadLetterBadge'),
    offlineQueueEmptyMessage: emptyMsg,
    queueFilterBar: createMockElement('queueFilterBar'),
    queueFilterAllCount: createMockElement('queueFilterAllCount'),
    queueFilterPendingCount: createMockElement('queueFilterPendingCount'),
    queueFilterDeadCount: createMockElement('queueFilterDeadCount')
  };
  const storage = createQueueStorage();
  for (const item of items) addOfflineSyncItem(item, storage);
  let toasted = null;
  globalThis.document = {
    getElementById: id => byId[id] || null,
    createElement: () => createMockElement('div')
  };
  const modalCtl = setupOfflineQueueModal({ storage, onToast: msg => { toasted = msg; } });
  modalCtl.open();
  return {
    listEl, countBadge, deadLetterBadge: byId.queueDeadLetterBadge, emptyMsg, storage, modalCtl,
    get toasted() { return toasted; },
    restore: () => { globalThis.document = origDoc; }
  };
}

test('Plan G queue inspector: a retrying item shows its next retry time', () => {
  const ctx = setupQueueModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'retrying', retryCount: 2, nextRetryAt: new Date(Date.now() + 60000).toISOString(), timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    const text = ctx.listEl.children.map(collectText).join(' ');
    assert.match(text, /Retry #2/);
    assert.match(text, /Next retry:/);
  } finally { ctx.restore(); }
});

test('Plan G queue inspector: a dead-letter item says it is not confirmed and what to do', () => {
  const ctx = setupQueueModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'dead_letter', retryCount: 5, lastError: 'Network error', timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    const text = ctx.listEl.children.map(collectText).join(' ');
    assert.match(text, /Dead Letter \(5 failed\)/);
    // QC-9: "not confirmed yet" — there is no sync to be pending.
    assert.match(text, /Max retries reached — not confirmed yet/);
    assert.match(text, /discard only if this entry was recorded another way/);
  } finally { ctx.restore(); }
});

test('Plan G queue inspector: a pending item shows Pending with no dead-letter guidance', () => {
  const ctx = setupQueueModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'pending', timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    const text = ctx.listEl.children.map(collectText).join(' ');
    assert.match(text, /Pending/);
    assert.doesNotMatch(text, /Max retries reached/);
    assert.match(ctx.countBadge.textContent, /1 item pending/);
  } finally { ctx.restore(); }
});

test('Plan G queue inspector: a confirmed item is labelled Confirmed', () => {
  const ctx = setupQueueModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'synced', timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    const text = ctx.listEl.children.map(collectText).join(' ');
    // QC-9: the stored status value stays 'synced'; only the label
    // shown to the operator changed to Confirmed.
    assert.match(text, /Confirmed/);
  } finally { ctx.restore(); }
});

test('Plan G queue inspector: a failed retry says the entry was not confirmed and what to do', async () => {
  const ctx = setupQueueModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'pending', timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    const card = ctx.listEl.children[0];
    const collectButtons = el => {
      let out = [];
      if (el.textContent === 'Retry' || el.textContent === 'Discard') out.push(el);
      for (const child of el.children || []) out = out.concat(collectButtons(child));
      return out;
    };
    const retryBtn = collectButtons(card).find(b => b.textContent === 'Retry');
    assert.ok(retryBtn, 'a Retry button is rendered');
    // The entry disappears before the retry runs, so the retry cannot
    // succeed — the failure toast must still explain what to do next.
    ctx.storage.removeItem(OFFLINE_SYNC_QUEUE_KEY);
    for (const fn of retryBtn.listeners.get('click') || []) await fn();
    await tick();
    assert.match(ctx.toasted || '', /Retry failed/);
    // QC-9: "not confirmed yet" — there is no sync to be pending.
    assert.match(ctx.toasted || '', /Entry not confirmed yet/);
    assert.match(ctx.toasted || '', /discard if recorded another way/);
  } finally { ctx.restore(); }
});

test('Plan G worker: activate drops old caches and keeps the current one', async () => {
  const worker = createWorker({ cacheNames: ['shahdara-isp-billing-v36', 'shahdara-isp-billing-v37', 'other-cache'] });
  await worker.dispatch('activate');
  assert.equal(worker.names.has('shahdara-isp-billing-v36'), false);
  assert.equal(worker.names.has('shahdara-isp-billing-v37'), true);
  assert.equal(worker.names.has('other-cache'), true);
  assert.equal(worker.claimCalls, 1);
});

test('Plan G worker: a cached error response is never served — it refetches', async () => {
  const worker = createWorker({
    cacheNames: ['shahdara-isp-billing-v37'],
    entries: [['shahdara-isp-billing-v37', '/app.js', { ok: false, status: 404 }]]
  });
  worker.setFetch(async () => 'fresh module');
  const result = await worker.dispatch('fetch', { url: 'https://billing.example/app.js', method: 'GET' });
  assert.equal(result.response, 'fresh module');
});

test('Plan G update prompt: Refresh while free still activates and reloads exactly once', async () => {
  const { win, worker } = createPromptWindow({ pending: PENDING_V2 });
  win.__swUpdateRegistration = { waiting: worker };
  const storage = createMockStorage();
  const toasts = [];
  const controller = setupSwUpdatePrompt({
    win, storage, onToast: (msg, opts) => toasts.push({ msg, opts }), isBusy: () => false, reloadFallbackMs: 1
  });
  assert.equal(toasts.length, 1);
  const refreshAction = (toasts[0].opts.actions || []).find(a => a.label === 'Refresh');
  assert.ok(refreshAction, 'a Refresh action is offered');
  refreshAction.onAction();
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(worker.messages, [{ type: 'SKIP_WAITING' }], 'activation is posted');
  assert.equal(win.location.reloads, 1, 'reloads exactly once');
  assert.equal(controller.reloaded, true);
});

test('Plan G write failure: offline wins over a generic error', () => {
  const d = describeWriteFailure({ operation: 'Payment', error: new Error('boom'), online: false });
  assert.equal(d.title, 'You are offline');
});

test('Plan G queue inspector: the dead-letter badge counts dead items', () => {
  const ctx = setupQueueModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'dead_letter', retryCount: 5, timestamp: '2026-10-16T00:30:00Z' },
    { action: 'record_payment', summary: 'Receipt for Tariq', status: 'pending', timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    assert.equal(ctx.deadLetterBadge.textContent, '1 dead letter');
    assert.match(ctx.countBadge.textContent, /2 items pending/);
  } finally { ctx.restore(); }
});

test('Plan G offline banner: the Dismiss button hides it by hand', () => {
  const origDoc = globalThis.document;
  const origNavigator = globalThis.navigator;
  try {
    const banner = createMockElement('offlineSyncBanner');
    const textEl = createMockElement('offlineSyncText');
    const retryBtn = createMockElement('offlineSyncRetryBtn');
    const dismissBtn = createMockElement('offlineSyncDismissBtn');
    const viewQueueBtn = createMockElement('offlineSyncViewQueueBtn');
    const byId = {
      offlineSyncBanner: banner, offlineSyncText: textEl, offlineSyncRetryBtn: retryBtn,
      offlineSyncDismissBtn: dismissBtn, offlineSyncViewQueueBtn: viewQueueBtn
    };
    globalThis.document = { getElementById: id => byId[id] || null, body: {} };
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true, writable: true });
    const storage = createQueueStorage();
    addOfflineSyncItem({ action: 'record_payment', summary: 'Receipt for Ali' }, storage);
    setupOfflineSyncBanner({ storage });
    assert.equal(banner.hidden, false);
    for (const fn of dismissBtn.listeners.get('click') || []) fn({});
    assert.equal(banner.hidden, true, 'manual dismiss hides the banner');
  } finally {
    globalThis.document = origDoc;
    Object.defineProperty(globalThis, 'navigator', { value: origNavigator, configurable: true, writable: true });
  }
});
