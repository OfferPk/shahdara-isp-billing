// Sharafat 59: the inbox cap keeps the newest rows but drops the oldest
// RECORDED rows first — never an unrecorded transfer — and reports the
// drop instead of losing it silently. Pattern-fake data only (Test
// Sender, 03012345678 family, TESTTXN* ids) — no real customer data.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  saveInboxItems,
  loadInboxItems,
  planInboxCap,
  formatCapDrop,
  INBOX_MAX_ROWS
} from '../payments-inbox.js';

// Setup Mock LocalStorage for Node test environment (same shape as
// tests/easypaisa-inbox.test.js).
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new MockLocalStorage();
}

const SENDER = 'Test Sender';
const PHONE = '03012345678';

// Rows newest-first: index 0 is the newest (2026-11-15), each next row
// one day older, so the date order matches the list order.
function row(index, { recorded = false } = {}) {
  const day = new Date(Date.UTC(2026, 10, 15) - index * 24 * 60 * 60 * 1000);
  return {
    txnId: `TESTTXN${String(index).padStart(4, '0')}`,
    amount: 1000 + index,
    direction: 'Received',
    date: day.toISOString().slice(0, 10),
    senderName: SENDER,
    senderNumber: PHONE,
    recorded
  };
}

function txnIds(items) {
  return items.map(item => item.txnId);
}

test('sharafat 59 (D1): the cap is 2,000 rows', () => {
  assert.equal(INBOX_MAX_ROWS, 2000);
});

test('sharafat 59 (D1/D6): 2,001 rows with an old unrecorded row — the unrecorded row survives, the oldest recorded row is dropped', () => {
  localStorage.clear();
  const items = [];
  for (let i = 0; i < 2000; i++) items.push(row(i, { recorded: true }));
  items.push(row(2000, { recorded: false })); // oldest row, unrecorded

  const result = saveInboxItems(items);

  assert.equal(result.ok, true);
  assert.equal(result.refused, false);
  assert.equal(result.saved.length, 2000);
  assert.equal(result.dropped, 1);
  assert.equal(result.droppedRecorded, 1);
  assert.equal(result.droppedUnrecorded, 0);
  // The old unrecorded transfer survives; the oldest recorded row goes.
  assert.ok(txnIds(result.saved).includes('TESTTXN2000'));
  assert.ok(!txnIds(result.saved).includes('TESTTXN1999'));
  // Memory == storage after save.
  assert.deepEqual(txnIds(loadInboxItems()), txnIds(result.saved));
});

test('sharafat 59 (D1): several rows over the cap — the oldest recorded rows go first, newest recorded survive', () => {
  localStorage.clear();
  const items = [];
  for (let i = 0; i < 2003; i++) items.push(row(i, { recorded: true }));
  items.push(row(2003, { recorded: false }));
  items.push(row(2004, { recorded: false }));

  const result = saveInboxItems(items);

  assert.equal(result.ok, true);
  assert.equal(result.saved.length, 2000);
  assert.equal(result.dropped, 5);
  assert.equal(result.droppedRecorded, 5);
  assert.equal(result.droppedUnrecorded, 0);
  // The five oldest recorded rows (TESTTXN1998–2002) are gone; both
  // unrecorded rows and the newest recorded rows survive.
  assert.ok(!txnIds(result.saved).includes('TESTTXN1998'));
  assert.ok(!txnIds(result.saved).includes('TESTTXN1999'));
  assert.ok(!txnIds(result.saved).includes('TESTTXN2000'));
  assert.ok(!txnIds(result.saved).includes('TESTTXN2001'));
  assert.ok(!txnIds(result.saved).includes('TESTTXN2002'));
  assert.ok(txnIds(result.saved).includes('TESTTXN2003'));
  assert.ok(txnIds(result.saved).includes('TESTTXN2004'));
  assert.ok(txnIds(result.saved).includes('TESTTXN0000'));
});

test('sharafat 59 (D1): unrecorded rows fill most of the cap — only the recorded rows past the cap are dropped', () => {
  localStorage.clear();
  const items = [];
  for (let i = 0; i < 1999; i++) items.push(row(i, { recorded: false }));
  for (let i = 1999; i < 2004; i++) items.push(row(i, { recorded: true }));

  const result = saveInboxItems(items);

  assert.equal(result.saved.length, 2000);
  assert.equal(result.dropped, 4);
  assert.equal(result.droppedRecorded, 4);
  assert.equal(result.droppedUnrecorded, 0);
  assert.ok(txnIds(result.saved).includes('TESTTXN0000'));
  assert.ok(txnIds(result.saved).includes('TESTTXN1998'));
  assert.ok(txnIds(result.saved).includes('TESTTXN1999')); // newest recorded
  assert.ok(!txnIds(result.saved).includes('TESTTXN2000'));
  assert.ok(!txnIds(result.saved).includes('TESTTXN2003'));
});

test('sharafat 59 (D3): surviving rows keep their newest-first order — the cap never re-sorts the list', () => {
  localStorage.clear();
  const items = [];
  for (let i = 0; i < 2000; i++) items.push(row(i, { recorded: true }));
  items.push(row(2000, { recorded: false }));

  const result = saveInboxItems(items);
  const expected = txnIds(items).filter(id => id !== 'TESTTXN1999');

  assert.deepEqual(txnIds(result.saved), expected);
  assert.deepEqual(txnIds(loadInboxItems()), expected);
});

test('sharafat 59 (D6): exactly 2,000 items — no drop, no warning', () => {
  localStorage.clear();
  const items = [];
  for (let i = 0; i < 2000; i++) items.push(row(i, { recorded: i % 2 === 0 }));

  const result = saveInboxItems(items);

  assert.equal(result.ok, true);
  assert.equal(result.refused, false);
  assert.equal(result.dropped, 0);
  assert.equal(result.saved.length, 2000);
  assert.equal(formatCapDrop(result), '');
  assert.deepEqual(txnIds(loadInboxItems()), txnIds(items));
});

test('sharafat 59 (D4): all-unrecorded cap refuses the newest import — storage is unchanged', () => {
  localStorage.clear();
  const seed = [row(0), row(1)];
  saveInboxItems(seed);

  const items = [];
  for (let i = 0; i < 2001; i++) items.push(row(i, { recorded: false }));

  const result = saveInboxItems(items);

  assert.equal(result.ok, false);
  assert.equal(result.refused, true);
  assert.equal(result.dropped, 0);
  assert.equal(result.saved.length, 2001); // input returned unchanged
  // The stored list is untouched — the refused import saved nothing new.
  assert.deepEqual(txnIds(loadInboxItems()), txnIds(seed));
});

test('sharafat 59 (D4): exactly 2,000 unrecorded rows is fine — refusal starts past the cap', () => {
  localStorage.clear();
  const items = [];
  for (let i = 0; i < 2000; i++) items.push(row(i, { recorded: false }));

  const result = saveInboxItems(items);

  assert.equal(result.ok, true);
  assert.equal(result.refused, false);
  assert.equal(result.saved.length, 2000);
});

test('sharafat 59 (D2): planInboxCap is pure — it plans the drop without writing', () => {
  localStorage.clear();
  const items = [];
  for (let i = 0; i < 2000; i++) items.push(row(i, { recorded: true }));
  items.push(row(2000, { recorded: false }));

  const plan = planInboxCap(items);

  assert.equal(plan.wouldDropUnrecorded, false);
  assert.equal(plan.dropped, 1);
  assert.equal(plan.droppedRecorded, 1);
  assert.deepEqual(loadInboxItems(), []); // nothing was written

  const refused = planInboxCap(items.map(item => ({ ...item, recorded: false })));
  assert.equal(refused.wouldDropUnrecorded, true);
  assert.equal(refused.dropped, 0);
  assert.equal(refused.saved.length, 2001);
});

test('sharafat 59 (D2): a storage failure reports ok:false and saves nothing', () => {
  localStorage.clear();
  const seed = [row(0)];
  saveInboxItems(seed);

  const originalSetItem = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  try {
    const result = saveInboxItems([row(0), row(1)]);
    assert.equal(result.ok, false);
    assert.equal(result.refused, false);
    assert.deepEqual(result.saved, []);
  } finally {
    localStorage.setItem = originalSetItem;
  }
  assert.deepEqual(txnIds(loadInboxItems()), txnIds(seed));
});

test('sharafat 59 (D2): formatCapDrop composes the toast tail — empty at zero', () => {
  assert.equal(formatCapDrop({ dropped: 0 }), '');
  assert.equal(formatCapDrop({ dropped: 1 }), ' · 1 dropped at cap');
  assert.equal(formatCapDrop({ dropped: 3 }), ' · 3 dropped at cap');
  assert.equal(formatCapDrop(null), '');
});

test('sharafat 59: non-array input saves an empty list', () => {
  localStorage.clear();
  const result = saveInboxItems(null);
  assert.equal(result.ok, true);
  assert.deepEqual(result.saved, []);
  assert.deepEqual(loadInboxItems(), []);
});

test('sharafat 59: a small list round-trips unchanged (the 305 pin shape)', () => {
  localStorage.clear();
  const items = [row(0), row(1)];
  const result = saveInboxItems(items);
  assert.equal(result.ok, true);
  assert.equal(result.dropped, 0);
  assert.deepEqual(loadInboxItems(), items);
});
