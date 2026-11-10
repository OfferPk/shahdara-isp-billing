// QC-9 — Honest sync wording.
// There is no server sync in this app: the ledger is one localStorage
// key, "sync" is a manual file merge, and "pending" means pending
// clearance. Every user-facing string that promised an upload sync
// ("Syncing…", "Sync complete", "Sync Now", "Synced") is reworded to
// say what actually happens: entries are saved on this device and the
// offline queue is only confirmed locally. No data flow changes — the
// queue still drains, payments still save locally, and the real Google
// Sheet import (a genuine download) keeps its wording.
//
// The old strings are built from fragments below so this file never
// literally contains them: a wording guard must not trip on its own
// literals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  setupOfflineSyncBanner,
  setupOfflineQueueModal,
  setupNetworkStatusIndicator,
  startOfflineQueueAutoRetryEngine,
  addOfflineSyncItem,
  getOfflineSyncQueue,
  processOfflineSyncQueue,
  OFFLINE_SYNC_QUEUE_KEY
} from '../nav.js';
import {
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  addPayment
} from '../core.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

// Old user-facing sync promises, fragment-built so this file never
// literally contains them.
const OLD_SYNCING = 'Sync' + 'ing';
const OLD_SYNC_COMPLETE = 'Sync' + ' complete';
const OLD_SYNC_NOW = 'Sync' + ' Now';
const OLD_SYNC_LEDGER_NOW = 'Sync' + ' Ledger Now';
const OLD_SYNCED_LABEL = 'Sync' + 'ed';
const OLD_SYNCED_TOAST = 'Sync' + 'ed:';
const OLD_SYNCED_QUEUED = 'Sync' + 'ed 2 queued items';
const OLD_NOT_SYNCED = 'not sync' + 'ed';
const OLD_PENDING_SYNC = 'pending sync';
const OLD_AUTO_RETRY_SYNCED = 'Auto-retry sync' + 'ed';
const OLD_QUEUE_IS_SYNCED = 'offline queue is sync' + 'ed';
const OLD_SYNC_QUEUE_LABEL = 'Offline Payment Sync' + ' Queue';

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

function setupBannerWith(items, { online = true, onToast } = {}) {
  const origDoc = globalThis.document;
  const origNavigator = globalThis.navigator;
  const origSetTimeout = globalThis.setTimeout;
  const timers = [];
  globalThis.setTimeout = (fn, ms) => { timers.push(ms); return 1; };
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
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: online }, configurable: true, writable: true });
  const storage = createQueueStorage();
  for (const item of items) addOfflineSyncItem(item, storage);
  let toasted = null;
  const controller = setupOfflineSyncBanner({ storage, onToast: msg => { toasted = msg; if (typeof onToast === 'function') onToast(msg); } });
  return {
    banner, textEl, retryBtn, storage, controller,
    get toasted() { return toasted; },
    restore: () => {
      globalThis.document = origDoc;
      Object.defineProperty(globalThis, 'navigator', { value: origNavigator, configurable: true, writable: true });
      globalThis.setTimeout = origSetTimeout;
    }
  };
}

function setupModalWith(items) {
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
    listEl, countBadge, emptyMsg, storage, modalCtl, syncBtn: byId.queueSyncAllBtn,
    retryFailedBtn: byId.queueRetryFailedBtn,
    get toasted() { return toasted; },
    restore: () => { globalThis.document = origDoc; }
  };
}

function collectButtons(card, label) {
  let out = [];
  if (card.textContent === label) out.push(card);
  for (const child of card.children || []) out = out.concat(collectButtons(child, label));
  return out;
}

/* ------------------------- offline banner ------------------------- */

test('QC-9 banner: online with a queued item says Confirming on this device, never Syncing', () => {
  const ctx = setupBannerWith([{ action: 'record_payment', summary: 'Receipt for Ali' }], { online: true });
  try {
    assert.equal(ctx.banner.hidden, false);
    assert.match(ctx.textEl.textContent, /Confirming/);
    assert.match(ctx.textEl.textContent, /queued/);
    assert.match(ctx.textEl.textContent, /on this device/);
    assert.ok(!ctx.textEl.textContent.includes(OLD_SYNCING), 'no syncing claim');
    assert.equal(ctx.retryBtn.textContent, 'Confirm Queue');
  } finally { ctx.restore(); }
});

test('QC-9 banner: confirming the queue says entries were already saved on this device', () => {
  const ctx = setupBannerWith([{ action: 'record_payment', summary: 'Receipt for Ali' }], { online: true });
  try {
    const res = ctx.controller.syncNow();
    assert.equal(res.processedCount, 1, 'queue still drains');
    assert.equal(ctx.controller.getQueueCount(), 0, 'queue is emptied');
    assert.match(ctx.toasted || '', /Queue confirmed/);
    assert.match(ctx.toasted || '', /already saved on this device/);
    assert.ok(!(ctx.toasted || '').includes(OLD_SYNC_COMPLETE), 'no Sync complete claim');
    assert.ok(!(ctx.toasted || '').includes('saved to ledger'), 'nothing is newly saved by confirming');
    assert.match(ctx.textEl.textContent, /confirmed/);
  } finally { ctx.restore(); }
});

test('QC-9 banner: offline copy is unchanged — local ledger active with pending actions', () => {
  const ctx = setupBannerWith([
    { action: 'record_payment', summary: 'Receipt for Ali' },
    { action: 'add_customer', summary: 'New subscriber Tariq' }
  ], { online: false });
  try {
    assert.equal(ctx.banner.hidden, false);
    assert.match(ctx.textEl.textContent, /Offline Mode/);
    assert.match(ctx.textEl.textContent, /2 pending/);
    assert.equal(ctx.controller.getQueueCount(), 2);
  } finally { ctx.restore(); }
});

test('QC-9 banner: offline with an empty queue still says entries are saved to device storage', () => {
  const ctx = setupBannerWith([], { online: false });
  try {
    assert.equal(ctx.textEl.textContent, 'Offline Mode · All billing entries saved to device storage');
  } finally { ctx.restore(); }
});

/* --------------------- network status indicator --------------------- */

test('QC-9 status pill: the syncing state says Saving to device, never Syncing', () => {
  const dotEl = { className: '' };
  const textEl = { textContent: '' };
  const pillEl = {
    dataset: {}, attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    classList: { toggle() {} }, addEventListener() {}
  };
  const origDoc = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      if (id === 'networkStatusDot') return dotEl;
      if (id === 'networkStatusText') return textEl;
      if (id === 'networkStatusPill') return pillEl;
      return null;
    },
    body: {}
  };
  try {
    const net = setupNetworkStatusIndicator();
    net.updateSyncStatus({ isSyncing: true });
    assert.equal(textEl.textContent, 'Saving to device...');
    assert.ok(!textEl.textContent.includes(OLD_SYNCING), 'no Syncing text');
    // The dot class is a CSS identifier, not user copy — unchanged.
    assert.equal(dotEl.className, 'network-status-dot syncing');
  } finally { globalThis.document = origDoc; }
});

test('QC-9 status pill: pending changes read as queued on this device', () => {
  const dotEl = { className: '' };
  const textEl = { textContent: '' };
  const pillEl = {
    dataset: {}, attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    classList: { toggle() {} }, addEventListener() {}
  };
  const origDoc = globalThis.document;
  const origNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
  globalThis.document = {
    getElementById(id) {
      if (id === 'networkStatusDot') return dotEl;
      if (id === 'networkStatusText') return textEl;
      if (id === 'networkStatusPill') return pillEl;
      return null;
    },
    body: {}
  };
  try {
    const net = setupNetworkStatusIndicator();
    net.updateSyncStatus({ isSyncing: false, pendingChanges: 3 });
    assert.equal(textEl.textContent, '3 queued on this device');
    net.updateSyncStatus({ isSyncing: false, pendingChanges: 0 });
    assert.ok(textEl.textContent.includes('Online'));
  } finally {
    globalThis.document = origDoc;
    Object.defineProperty(globalThis, 'navigator', { value: origNavigator, configurable: true, writable: true });
  }
});

/* ------------------------- queue inspector ------------------------- */

test('QC-9 queue modal: a confirmed item is labelled Confirmed, never Synced', () => {
  const ctx = setupModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'synced', timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    const text = ctx.listEl.children.map(collectText).join(' ');
    assert.match(text, /Confirmed/);
    assert.ok(!text.includes(OLD_SYNCED_LABEL), 'no Synced label');
  } finally { ctx.restore(); }
});

test('QC-9 queue modal: a dead-letter item says not confirmed yet and what to do', () => {
  const ctx = setupModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'dead_letter', retryCount: 5, lastError: 'Network error', timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    const text = ctx.listEl.children.map(collectText).join(' ');
    assert.match(text, /Dead Letter \(5 failed\)/);
    assert.match(text, /Max retries reached — not confirmed yet/);
    assert.match(text, /discard only if this entry was recorded another way/);
    assert.ok(!text.includes(OLD_NOT_SYNCED), 'no not synced claim');
  } finally { ctx.restore(); }
});

test('QC-9 queue modal: confirming all toasts Confirmed N queued items and clears the queue', () => {
  const ctx = setupModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', timestamp: '2026-10-16T00:30:00Z' },
    { action: 'add_customer', summary: 'New subscriber Tariq', timestamp: '2026-10-16T00:32:00Z' }
  ]);
  try {
    assert.ok(ctx.countBadge.textContent.includes('2 items pending'));
    for (const fn of ctx.syncBtn.listeners.get('click') || []) fn();
    assert.equal(ctx.toasted, 'Confirmed 2 queued items');
    assert.ok(!String(ctx.toasted).includes(OLD_SYNCED_QUEUED), 'no Synced toast');
    assert.equal(getOfflineSyncQueue(ctx.storage).length, 0, 'queue still drains');
    assert.ok(ctx.countBadge.textContent.includes('0 items pending'));
  } finally { ctx.restore(); }
});

test('QC-9 queue modal: a successful per-item retry toasts Confirmed, never Synced', async () => {
  const ctx = setupModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'pending', timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    const card = ctx.listEl.children[0];
    const retryBtn = collectButtons(card, 'Retry')[0];
    assert.ok(retryBtn, 'a Retry button is rendered');
    for (const fn of retryBtn.listeners.get('click') || []) await fn();
    await tick();
    assert.equal(ctx.toasted, 'Confirmed: Receipt for Ali');
    assert.ok(!String(ctx.toasted).includes(OLD_SYNCED_TOAST), 'no Synced toast');
  } finally { ctx.restore(); }
});

test('QC-9 queue modal: retry-eligible toasts confirmed counts, never synced counts', async () => {
  const ctx = setupModalWith([
    { action: 'record_payment', summary: 'Receipt for Ali', status: 'pending', timestamp: '2026-10-16T00:30:00Z' }
  ]);
  try {
    for (const fn of ctx.retryFailedBtn.listeners.get('click') || []) await fn();
    await tick();
    assert.match(ctx.toasted || '', /Processed 1 items \(1 confirmed, 0 failed\)/);
    assert.ok(!String(ctx.toasted).includes(OLD_SYNCED_LABEL), 'no synced count');
  } finally { ctx.restore(); }
});

/* ---------------------- auto-retry engine ---------------------- */

test('QC-9 auto-retry engine: with no retry handler the tick confirms — it never claims a sync', async () => {
  const storage = createQueueStorage();
  addOfflineSyncItem({ action: 'record_payment', summary: 'Receipt for Ali' }, storage);
  let toasted = null;
  // Production starts this engine with no retryHandler: items are
  // marked done with nothing ever sent. The toast must say so.
  const engine = startOfflineQueueAutoRetryEngine({
    storage,
    pollIntervalMs: 100000,
    isOnlineCheck: () => true,
    onToast: msg => { toasted = msg; }
  });
  try {
    assert.equal(engine.isRunning(), true);
    await engine.triggerNow();
    assert.equal(toasted, 'Auto-retry confirmed 1 offline transaction');
    assert.ok(!String(toasted).includes(OLD_AUTO_RETRY_SYNCED), 'no Auto-retry synced claim');
    // The stored status VALUE is untouched by QC-9 — only the words
    // changed, so the engine still records the same 'synced' value.
    const queue = getOfflineSyncQueue(storage);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].status, 'synced');
  } finally { engine.stop(); }
});

/* ------------------- no sync promise in copy ------------------- */

test('QC-9 source: nav.js carries no sync-promise copy', () => {
  const src = read('nav.js');
  // The user-facing literal was 'Syncing...' (with the ellipsis). The
  // bare word also sits inside the internal option name `isSyncing`,
  // which is a code identifier, not copy — so the guard pins the exact
  // literal, not the bare word.
  const OLD_SYNCING_LITERAL = 'Sync' + 'ing...';
  assert.ok(!src.includes(`'${OLD_SYNCING_LITERAL}'`), 'nav.js must not say Syncing...');
  for (const old of [OLD_SYNC_COMPLETE, OLD_SYNC_NOW, OLD_SYNCED_TOAST, OLD_NOT_SYNCED, OLD_AUTO_RETRY_SYNCED]) {
    assert.ok(!src.includes(old), `nav.js must not say ${old}`);
  }
});

test('QC-9 source: index.html carries no sync-promise copy', () => {
  const src = read('index.html');
  for (const old of [OLD_SYNC_NOW, OLD_SYNC_LEDGER_NOW, OLD_QUEUE_IS_SYNCED]) {
    assert.ok(!src.includes(old), `index.html must not say ${old}`);
  }
  assert.ok(src.includes('Confirm Queue'), 'banner button reads Confirm Queue');
  assert.ok(src.includes('Confirm All'), 'queue button reads Confirm All');
  assert.ok(src.includes('offline queue is clear'), 'empty state says the queue is clear');
});

test('QC-9 source: the pending-actions digest never says pending sync', () => {
  const src = read('nav-pending-actions.js');
  assert.ok(!src.includes(OLD_PENDING_SYNC), 'digest must not say pending sync');
  assert.ok(src.includes('queued on this device'), 'digest says queued on this device');
});

test('QC-9 source: the backup catalogue calls the queue an Offline Payment Queue', () => {
  const src = read('qa-backup-csv-import.js');
  assert.ok(src.includes('Offline Payment Queue'), 'catalogue label is honest');
  assert.ok(!src.includes(OLD_SYNC_QUEUE_LABEL), 'no Sync Queue label');
});

/* --------------------- data flow unchanged --------------------- */

test('QC-9 data flow: a payment recorded before the wording change survives a backup round-trip unchanged', () => {
  const SEP_5 = new Date('2026-09-05T12:00:00Z');
  const NOV_7 = new Date('2026-11-07T12:00:00Z');
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_7);
  state = addPayment(state, 'seed-001', '2026-11', {
    amount: 1000, date: '2026-11-07', method: 'Cash'
  }, NOV_7);
  const bill = state.customers.find(c => c.id === 'seed-001').bills.find(b => b.month === '2026-11');
  assert.equal(bill.payments.length, 1, 'payment recorded');
  const paymentId = bill.payments[0].id;
  // The backup format is plain JSON: a round-trip must keep the payment.
  const restored = JSON.parse(JSON.stringify(state));
  const restoredBill = restored.customers.find(c => c.id === 'seed-001').bills.find(b => b.month === '2026-11');
  assert.equal(restoredBill.payments.length, 1);
  assert.equal(restoredBill.payments[0].id, paymentId);
});

test('QC-9 data flow: confirming the queue still drains it and reports the count', () => {
  const storage = createQueueStorage();
  addOfflineSyncItem({ action: 'record_payment', summary: 'Receipt for Ali' }, storage);
  addOfflineSyncItem({ action: 'add_customer', summary: 'New subscriber Tariq' }, storage);
  const res = processOfflineSyncQueue({ storage });
  assert.equal(res.processedCount, 2);
  assert.equal(res.success, true);
  assert.equal(getOfflineSyncQueue(storage).length, 0);
});

/* --------------------------- boundary --------------------------- */

test('QC-9 boundary: the real Google Sheet import still says Synced — QC-9 only rewords the offline queue', () => {
  // payments-inbox.js downloads rows from a user-configured Sheet URL:
  // a genuine import, not a promised upload. Its wording stays.
  const src = read('payments-inbox.js');
  assert.ok(src.includes('from Google Sheet'), 'Sheet import copy is untouched');
  assert.match(src, /Synced \S+ transactions from Google Sheet/);
});
