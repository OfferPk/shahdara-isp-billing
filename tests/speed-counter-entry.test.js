// SISP-99: Keyboard-First "Speed Batch Counter Entry" modal (Ctrl+Shift+E).
// Pure-function tests on synthetic data only. Pins the spec criterion:
// submitting 3 batch rows records all 3 payments accurately across
// customer ledgers AND shop balances — verified through the REAL core
// allocation engine (saveBillMonth + calculatePaymentAllocations), the
// REAL shop-settlement summaries, and the REAL quick-collection executor
// (executeQuickCollection, the same payment path as hand entry, with
// SISP-33 FIFO allocation). Also pins: the method letters map onto real
// PAYMENT_METHODS values only, per-row failure isolation (a bad row
// never blocks, rolls back, or double-records the good rows), ambiguous
// names asking instead of guessing, FREE/archived refusal, state
// threading for two slips of one customer, and the en+ur i18n audit for
// every speed_entry_* key the module and markup use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PAYMENT_METHODS, saveBillMonth, calculatePaymentAllocations
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { buildShopSummaries } from '../shop-settlement.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  SPEED_ENTRY_METHOD_KEYS,
  methodForSpeedKey,
  speedKeyForMethod,
  resolveSpeedEntryCustomer,
  validateSpeedEntryRow,
  isBlankSpeedRow,
  submitSpeedEntryBatch,
  summarizeSpeedEntryResults
} from '../speed-counter-entry.js';

const now = new Date();
const month = now.toISOString().slice(0, 7);
const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10); // PKT

const customer = (id, n, name, extra = {}) => ({
  id, customerNumber: n, name, phone: `030000000${n}`, area: 'Shahdara',
  archived: false, bills: [], ...extra
});

function stateWithDues() {
  let s = {
    customers: [
      customer('a', 1, 'Test Customer Alpha'),
      customer('b', 2, 'Test Customer Bravo'),
      customer('c', 3, 'Test Customer Charli')
    ]
  };
  for (const id of ['a', 'b', 'c']) {
    s = saveBillMonth(s, id, { month, dueAmount: 3000, status: 'pending' });
  }
  return s;
}

function balanceDue(state, customerId) {
  const summary = calculatePaymentAllocations(state).forMonth(customerId, month);
  return summary ? summary.balanceDueCents / 100 : null;
}

function paymentsOf(state, customerId) {
  const cust = state.customers.find((c) => c.id === customerId);
  return (cust.bills.find((b) => b.month === month)?.payments ?? []);
}

const row = (id, customerQuery, amount, methodKey, extra = {}) => ({
  id, customerQuery, amount, methodKey, status: 'draft', ...extra
});

// ------------------------------------------------------------- method map

test('method letters map onto REAL recorded payment methods only', () => {
  assert.deepEqual(Object.keys(SPEED_ENTRY_METHOD_KEYS).sort(), ['B', 'C', 'E', 'H', 'N', 'W']);
  for (const [letter, method] of Object.entries(SPEED_ENTRY_METHOD_KEYS)) {
    assert.ok(PAYMENT_METHODS.includes(method), `${letter} → "${method}" must be a real PAYMENT_METHODS value`);
    assert.equal(methodForSpeedKey(letter), method);
    assert.equal(speedKeyForMethod(method), letter);
  }
  // The three shop letters land on the three real shop methods.
  assert.equal(methodForSpeedKey('W'), 'Cash at Waseem Abbasi shop');
  assert.equal(methodForSpeedKey('H'), 'Cash at Hassan shop');
  assert.equal(methodForSpeedKey('B'), 'Cash at Balla shop');
  assert.equal(methodForSpeedKey('E'), 'Easypaisa');
  assert.equal(methodForSpeedKey('N'), 'NayaPay');
  assert.equal(methodForSpeedKey('C'), 'Cash');
});

test('method lookup is forgiving about case/space and strict about unknown letters', () => {
  assert.equal(methodForSpeedKey('c'), 'Cash');
  assert.equal(methodForSpeedKey(' w '), 'Cash at Waseem Abbasi shop');
  assert.equal(methodForSpeedKey('X'), null);
  assert.equal(methodForSpeedKey(''), null);
  assert.equal(methodForSpeedKey(null), null);
  // Real methods with no speed letter stay letter-less (used via Quick Collect).
  assert.equal(speedKeyForMethod('JazzCash'), null);
  assert.equal(speedKeyForMethod('Bank Transfer'), null);
  assert.equal(speedKeyForMethod('Raast'), null);
});

// ------------------------------------------------------------- resolution

test('resolution: connection ID digits (with or without #) resolve exactly', () => {
  const s = stateWithDues();
  assert.equal(resolveSpeedEntryCustomer(s, '2').customer.id, 'b');
  assert.equal(resolveSpeedEntryCustomer(s, '#3').customer.id, 'c');
  assert.equal(resolveSpeedEntryCustomer(s, ' 1 ').customer.id, 'a');
  assert.equal(resolveSpeedEntryCustomer(s, '99').status, 'not-found');
  assert.equal(resolveSpeedEntryCustomer(s, '').status, 'empty');
  assert.equal(resolveSpeedEntryCustomer(s, '   ').status, 'empty');
});

test('resolution: a unique name resolves; an exact full name wins over fuzzy hits', () => {
  const s = stateWithDues();
  assert.equal(resolveSpeedEntryCustomer(s, 'Test Customer Bravo').customer.id, 'b');
  assert.equal(resolveSpeedEntryCustomer(s, 'bravo').customer.id, 'b');
});

test('resolution: duplicate names are ambiguous — the row asks, never guesses', () => {
  let s = { customers: [customer('x', 7, 'Test Twin'), customer('y', 9, 'Test Twin')] };
  const res = resolveSpeedEntryCustomer(s, 'Test Twin');
  assert.equal(res.status, 'ambiguous');
  assert.deepEqual(res.candidates.map((c) => c.customerNumber), [7, 9]);
});

test('resolution: archived-only matches report archived, never resolve', () => {
  const s = { customers: [customer('z', 5, 'Test Archived', { archived: true })] };
  assert.equal(resolveSpeedEntryCustomer(s, '5').status, 'archived');
  assert.equal(resolveSpeedEntryCustomer(s, 'Test Archived').status, 'archived');
});

// ------------------------------------------------------------- validation

test('validation: FREE connections, bad amounts and bad letters are refused with codes', () => {
  const s = {
    customers: [
      customer('f', 4, 'Test Free House', { isFreeConnection: true }),
      customer('a', 1, 'Test Customer Alpha')
    ]
  };
  const free = validateSpeedEntryRow(s, row('r1', '4', '3000', 'C'));
  assert.equal(free.ok, false);
  assert.ok(free.errors.some((e) => e.code === 'free-connection'));

  for (const bad of ['0', '-50', 'abc', '']) {
    const v = validateSpeedEntryRow(s, row('r2', '1', bad, 'C'));
    assert.equal(v.ok, false, `amount "${bad}" must fail`);
    assert.ok(v.errors.some((e) => e.code === 'invalid-amount'));
  }
  const badMethod = validateSpeedEntryRow(s, row('r3', '1', '3000', 'X'));
  assert.ok(badMethod.errors.some((e) => e.code === 'invalid-method'));

  const good = validateSpeedEntryRow(s, row('r4', '1', '3000', 'b'));
  assert.equal(good.ok, true);
  assert.equal(good.method, 'Cash at Balla shop');
  assert.equal(good.amount, 3000);
});

test('validation and resolution never mutate the ledger (typing records nothing)', () => {
  const s = stateWithDues();
  const before = JSON.stringify(s);
  validateSpeedEntryRow(s, row('r1', '1', '3000', 'C'));
  resolveSpeedEntryCustomer(s, 'Test Customer Alpha');
  assert.equal(JSON.stringify(s), before);
  assert.equal(isBlankSpeedRow(row('r9', '', '', '')), true);
  assert.equal(isBlankSpeedRow(row('r9', '1', '', '')), false);
});

// ------------------------------------------------------------- SPEC PIN

test('PINNED: submitting 3 batch rows records all 3 payments across ledgers and shop balances', () => {
  const before = stateWithDues();
  assert.equal(balanceDue(before, 'a'), 3000);
  assert.equal(balanceDue(before, 'b'), 3000);
  assert.equal(balanceDue(before, 'c'), 3000);
  const ballaBefore = buildShopSummaries(before, []).find((s) => s.shop === 'Balla Shop');
  assert.equal(ballaBefore?.unsettled ?? 0, 0);

  const rows = [
    row('row-1', '1', '3000', 'C'),                    // by connection ID, cash
    row('row-2', 'Test Customer Bravo', 3000, 'B'),    // by name, Balla shop
    row('row-3', '#3', '1500', 'e')                    // by #ID, Easypaisa, partial
  ];
  const { nextState, results, totals, recordedCount } = submitSpeedEntryBatch(before, rows, {
    execute: executeQuickCollection, month, date: today, referenceDate: now
  });

  assert.equal(recordedCount, 3);
  assert.deepEqual(results.map((r) => r.status), ['recorded', 'recorded', 'recorded']);
  assert.ok(results.every((r) => r.receipt?.receiptNumber), 'every recorded row carries its real receipt');

  // Customer ledgers: dues settled / reduced exactly by the slip amounts.
  assert.equal(balanceDue(nextState, 'a'), 0);
  assert.equal(balanceDue(nextState, 'b'), 0);
  assert.equal(balanceDue(nextState, 'c'), 1500);
  assert.equal(paymentsOf(nextState, 'a').length, 1);
  assert.equal(paymentsOf(nextState, 'a')[0].amount, 3000);
  assert.equal(paymentsOf(nextState, 'a')[0].method, 'Cash');
  assert.equal(paymentsOf(nextState, 'b')[0].method, 'Cash at Balla shop');
  assert.equal(paymentsOf(nextState, 'c')[0].amount, 1500);
  assert.equal(paymentsOf(nextState, 'c')[0].method, 'Easypaisa');

  // Shop balances: the Balla slip now sits as unsettled cash at Balla Shop.
  const ballaAfter = buildShopSummaries(nextState, []).find((s) => s.shop === 'Balla Shop');
  assert.equal(ballaAfter.totalCollected, 3000);
  assert.equal(ballaAfter.unsettled, 3000);
  assert.equal(ballaAfter.unsettledReceiptCount, 1);

  // Session totals count recorded rows only, split by real method.
  assert.equal(totals.count, 3);
  assert.equal(totals.amount, 7500);
  assert.deepEqual(totals.byMethod.Cash, { count: 1, amount: 3000 });
  assert.deepEqual(totals.byMethod['Cash at Balla shop'], { count: 1, amount: 3000 });
  assert.deepEqual(totals.byMethod.Easypaisa, { count: 1, amount: 1500 });
});

// ------------------------------------------------------------- row safety

test('per-row safety: bad rows fail in place, good rows record once, retry never double-records', () => {
  let s = {
    customers: [
      customer('a', 1, 'Test Customer Alpha'),
      customer('f', 4, 'Test Free House', { isFreeConnection: true }),
      customer('x', 7, 'Test Twin'),
      customer('y', 9, 'Test Twin')
    ]
  };
  s = saveBillMonth(s, 'a', { month, dueAmount: 3000, status: 'pending' });

  const sheet = [
    row('row-1', '1', '3000', 'C'),
    row('row-2', '404', '3000', 'C'),          // unknown connection
    row('row-3', '4', '3000', 'C'),            // FREE connection
    row('row-4', 'Test Twin', '1000', 'C'),    // ambiguous name
    row('row-5', '', '', '')                   // blank draft — skipped silently
  ];
  const first = submitSpeedEntryBatch(s, sheet, {
    execute: executeQuickCollection, month, date: today, referenceDate: now
  });
  assert.deepEqual(first.results.map((r) => r.status), ['recorded', 'error', 'error', 'ambiguous', 'blank']);
  assert.equal(first.recordedCount, 1);
  assert.equal(first.totals.count, 1);
  assert.equal(paymentsOf(first.nextState, 'a').length, 1);
  assert.equal(balanceDue(first.nextState, 'a'), 0);
  const ambiguous = first.results[3];
  assert.deepEqual(ambiguous.candidates.map((c) => c.customerNumber), [7, 9]);

  // Operator fixes the ambiguous row by picking connection #9, and the
  // whole sheet is resubmitted: the recorded row echoes back and is NOT
  // recorded a second time; the fixed row now records.
  const resheet = sheet.map((r) => {
    const result = first.results.find((x) => x.rowId === r.id);
    if (result?.status === 'recorded') {
      return { ...r, status: 'recorded', receipt: result.receipt, customerId: result.customerId, customerName: result.customerName, customerNumber: result.customerNumber };
    }
    if (r.id === 'row-4') return { ...r, customerQuery: '9' };
    return r;
  });
  const second = submitSpeedEntryBatch(first.nextState, resheet, {
    execute: executeQuickCollection, month, date: today, referenceDate: now
  });
  assert.equal(paymentsOf(second.nextState, 'a').length, 1, 'recorded row must never double-record');
  assert.equal(second.recordedCount, 1, 'only the fixed row is newly recorded');
  assert.equal(second.totals.count, 2, 'session totals count both recorded rows exactly once');
  assert.equal(second.totals.amount, 4000);
});

test('a recorder failure on one row is isolated — the rest of the batch still records', () => {
  const s = stateWithDues();
  const flakyExecute = (state, fields, ref) => {
    if (fields.customerId === 'b') throw new Error('Synthetic recorder failure');
    return executeQuickCollection(state, fields, ref);
  };
  const { nextState, results } = submitSpeedEntryBatch(s, [
    row('row-1', '1', '3000', 'C'),
    row('row-2', '2', '3000', 'C'),
    row('row-3', '3', '3000', 'C')
  ], { execute: flakyExecute, month, date: today, referenceDate: now });
  assert.deepEqual(results.map((r) => r.status), ['recorded', 'error', 'recorded']);
  assert.equal(results[1].errors[0].code, 'recorder-failed');
  assert.equal(balanceDue(nextState, 'a'), 0);
  assert.equal(balanceDue(nextState, 'b'), 3000, 'failed row leaves its ledger untouched');
  assert.equal(balanceDue(nextState, 'c'), 0);
});

test('two slips for the same customer in one batch thread the evolving state', () => {
  const s = stateWithDues();
  const { nextState, recordedCount } = submitSpeedEntryBatch(s, [
    row('row-1', '1', '1500', 'C'),
    row('row-2', 'Test Customer Alpha', '1500', 'N')
  ], { execute: executeQuickCollection, month, date: today, referenceDate: now });
  assert.equal(recordedCount, 2);
  assert.equal(paymentsOf(nextState, 'a').length, 2);
  assert.equal(balanceDue(nextState, 'a'), 0);
});

test('submitSpeedEntryBatch requires the real recorder to be injected', () => {
  assert.throws(() => submitSpeedEntryBatch(stateWithDues(), [], {}), /requires an execute recorder/);
  const totals = summarizeSpeedEntryResults([
    { status: 'recorded', amount: 100, method: 'Cash' },
    { status: 'error', amount: 999, method: 'Cash' },
    { status: 'blank' }
  ]);
  assert.deepEqual(totals, { count: 1, amount: 100, byMethod: { Cash: { count: 1, amount: 100 } } });
});

// ------------------------------------------------------------- wiring + i18n

test('wiring: the dialog, open button and app.js controller are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['speedEntryModal', 'speedEntryRows', 'speedEntryTotals', 'speedEntryDate',
    'speedEntryCloseBtn', 'speedEntryAddRowBtn', 'speedEntrySubmitAllBtn', 'speedEntryClearBtn', 'speedEntryOpenBtn']) {
    assert.ok(html.includes(`id="${id}"`), `index.html is missing #${id}`);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './speed-counter-entry.js'"), 'app.js must import the module');
  assert.ok(app.includes('setupSpeedCounterEntryModal'), 'app.js must set up the modal');
  assert.ok(app.includes('submitSpeedEntryBatch'), 'app.js must run batches through submitSpeedEntryBatch');
  assert.ok(app.includes('execute: executeQuickCollection'), 'batches must record through executeQuickCollection');
});

test('i18n audit: every speed_entry_* key exists in BOTH dictionaries and never renders raw', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter((k) => k.startsWith('speed_entry_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter((k) => k.startsWith('speed_entry_')).sort();
  assert.ok(enKeys.length >= 25, `expected a full speed_entry_* key set, got ${enKeys.length}`);
  assert.deepEqual(urKeys, enKeys, 'en and ur speed_entry_* key sets must match exactly');

  const moduleSource = readFileSync(new URL('../speed-counter-entry.js', import.meta.url), 'utf8');
  const usedKeys = new Set([...moduleSource.matchAll(/t\('(speed_entry_[a-z_]+)'/g)].map((m) => m[1]));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const m of html.matchAll(/data-i18n(?:-[a-z-]+)?="(speed_entry_[a-z_]+)"/g)) usedKeys.add(m[1]);
  assert.ok(usedKeys.size >= 20, 'the module and markup should use the speed_entry_* keys');
  for (const key of usedKeys) {
    assert.ok(TRANSLATIONS.en[key], `missing en translation for ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur translation for ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `${key} must not render as its raw key (en)`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `${key} must not render as its raw key (ur)`);
  }
});
