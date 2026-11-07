import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isStrictDuesAmountDefaultMonth,
  duesAmountDefaultCents,
  duesAmountDefault,
  formatDuesAmountDefault,
} from '../dues-amount-default.js';
import { addManualBaqayaEntry, calculatePaymentAllocations } from '../core.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'dues-amount-default.js'), 'utf8');
const quickCollectSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

const REF = new Date('2026-10-15T10:00:00Z');

// Generic fixtures only — clearly made-up names, never a real customer.
function bill(month, dueAmount, payments = []) {
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    id: `B-${month}`,
    month,
    dueAmount,
    status: paid >= dueAmount ? 'paid' : paid > 0 ? 'partial' : 'pending',
    payments,
  };
}

function payment(date, amount, method = 'Cash') {
  return { id: `P-${date}`, date, amount, method };
}

function customerWithBills(bills, overrides = {}) {
  return {
    id: 'CUST-1',
    customerNumber: 1,
    name: 'Customer One',
    mohalla: 'Mohalla A',
    archived: false,
    monthlySellingAmount: 2500,
    bills,
    ...overrides,
  };
}

function stateWith(customer) {
  return { version: 1, nextCustomerNumber: 2, customers: [customer] };
}

// The same fixture as the oldest-bill pre-fill tests: August paid in
// full, September partially paid (2,500 billed, 1,000 received),
// October unpaid. Full dues are 1,500 + 3,000 = 4,500; the oldest
// open bill alone is only 1,500.
function mixedDuesCustomer() {
  return customerWithBills([
    bill('2026-08', 2500, [payment('2026-08-05', 2500)]),
    bill('2026-09', 2500, [payment('2026-09-07', 1000, 'JazzCash')]),
    bill('2026-10', 3000),
  ]);
}

function allocationsFor(state) {
  return calculatePaymentAllocations(state);
}

// ---------------------------------------------------------------------------
// Strict months
// ---------------------------------------------------------------------------

test('months: strict YYYY-MM, 01–12 only', () => {
  assert.equal(isStrictDuesAmountDefaultMonth('2026-09'), true);
  assert.equal(isStrictDuesAmountDefaultMonth('2026-01'), true);
  assert.equal(isStrictDuesAmountDefaultMonth('2026-12'), true);
  assert.equal(isStrictDuesAmountDefaultMonth('2026-13'), false);
  assert.equal(isStrictDuesAmountDefaultMonth('2026-00'), false);
  assert.equal(isStrictDuesAmountDefaultMonth('2026-9'), false);
  assert.equal(isStrictDuesAmountDefaultMonth('2026/09'), false);
  assert.equal(isStrictDuesAmountDefaultMonth(''), false);
  assert.equal(isStrictDuesAmountDefaultMonth(null), false);
  assert.equal(isStrictDuesAmountDefaultMonth(undefined), false);
  assert.equal(isStrictDuesAmountDefaultMonth(202609), false);
});

// ---------------------------------------------------------------------------
// The default itself — full dues, not the oldest bill alone
// ---------------------------------------------------------------------------

test('module: the default is the full dues — every open bill, not the oldest alone', () => {
  const customer = mixedDuesCustomer();
  const allocations = allocationsFor(stateWith(customer));
  assert.equal(duesAmountDefaultCents(customer, allocations, 0), 450000);
  assert.equal(duesAmountDefault(customer, allocations, 0), 4500);
});

test('module: a single open bill defaults to that bill alone', () => {
  const customer = customerWithBills([bill('2026-10', 3000)]);
  const allocations = allocationsFor(stateWith(customer));
  assert.equal(duesAmountDefault(customer, allocations, 0), 3000);
});

test('module: a fully paid customer defaults to nothing', () => {
  const customer = customerWithBills([
    bill('2026-08', 2500, [payment('2026-08-05', 2500)]),
    bill('2026-09', 2500, [payment('2026-09-07', 2500)]),
  ]);
  const allocations = allocationsFor(stateWith(customer));
  assert.equal(duesAmountDefaultCents(customer, allocations, 0), 0);
  assert.equal(duesAmountDefault(customer, allocations, 0), null);
});

test('module: a customer with no bills defaults to nothing', () => {
  const customer = customerWithBills([]);
  const allocations = allocationsFor(stateWith(customer));
  assert.equal(duesAmountDefaultCents(customer, allocations, 0), 0);
  assert.equal(duesAmountDefault(customer, allocations, 0), null);
});

test('module: unpaid manual baqaya joins the dues', () => {
  const customer = customerWithBills([bill('2026-09', 3000)]);
  const allocations = allocationsFor(stateWith(customer));
  assert.equal(duesAmountDefault(customer, allocations, 50000), 3500);
  assert.equal(duesAmountDefaultCents(customer, allocations, 50000), 350000);
});

test('module: baqaya alone, with no open bill, is still dues', () => {
  const customer = customerWithBills([
    bill('2026-10', 3000, [payment('2026-10-05', 3000)]),
  ]);
  const allocations = allocationsFor(stateWith(customer));
  assert.equal(duesAmountDefault(customer, allocations, 150000), 1500);
});

test('module: non-number baqaya figures are ignored, never read as zero dues', () => {
  const customer = customerWithBills([bill('2026-10', 3000)]);
  const allocations = allocationsFor(stateWith(customer));
  for (const bad of [null, undefined, '', true, false, 0, -5000]) {
    assert.equal(duesAmountDefault(customer, allocations, bad), 3000, `baqaya ${String(bad)} must be ignored`);
  }
});

test('module: a bill with a null or negative engine balance is skipped', () => {
  const customer = customerWithBills([
    bill('2026-09', 2500),
    bill('2026-10', 3000),
  ]);
  const stub = {
    forMonth: (_id, month) => ({ balanceDueCents: month === '2026-09' ? null : 300000 }),
  };
  assert.equal(duesAmountDefault(customer, stub, 0), 3000);
  const negative = {
    forMonth: (_id, month) => ({ balanceDueCents: month === '2026-09' ? -50000 : 300000 }),
  };
  assert.equal(duesAmountDefault(customer, negative, 0), 3000);
});

test('module: a bill with no usable month is skipped', () => {
  const customer = customerWithBills([
    { id: 'B-bad', month: '2026-13', dueAmount: 100, status: 'pending', payments: [] },
    bill('2026-10', 3000),
  ]);
  // The stub would offer 50 on any month it is asked about — the
  // unusable month must never reach it, so the total is exactly the
  // October figure alone.
  const stub = { forMonth: () => ({ balanceDueCents: 5000 }) };
  assert.equal(duesAmountDefault(customer, stub, 0), 50);
});

test('module: a missing customer, id, or allocation lookup defaults to nothing', () => {
  const customer = mixedDuesCustomer();
  const allocations = allocationsFor(stateWith(customer));
  assert.equal(duesAmountDefault(null, allocations, 0), null);
  assert.equal(duesAmountDefault({ bills: [] }, allocations, 0), null);
  assert.equal(duesAmountDefault(customer, null, 0), null);
  assert.equal(duesAmountDefault(customer, {}, 0), null);
  assert.equal(duesAmountDefault(customer, { forMonth: 'not-a-function' }, 0), null);
});

test('module: a throwing allocation lookup defaults to nothing, never a guessed figure', () => {
  const customer = mixedDuesCustomer();
  const throwing = { forMonth: () => { throw new Error('boom'); } };
  assert.equal(duesAmountDefaultCents(customer, throwing, 0), 0);
  assert.equal(duesAmountDefault(customer, throwing, 0), null);
});

test('module: paisa dues keep their paisa', () => {
  const customer = customerWithBills([bill('2026-10', 1500.5)]);
  const stub = { forMonth: () => ({ balanceDueCents: 150050 }) };
  assert.equal(duesAmountDefault(customer, stub, 0), 1500.5);
  assert.equal(duesAmountDefaultCents(customer, stub, 0), 150050);
});

test('module: inputs are never mutated', () => {
  const customer = mixedDuesCustomer();
  const state = stateWith(customer);
  const allocations = allocationsFor(state);
  const before = JSON.stringify(customer);
  duesAmountDefault(customer, allocations, 50000);
  assert.equal(JSON.stringify(customer), before);
});

test('formatter: min-0 decimals, the way the app shows money', () => {
  assert.equal(formatDuesAmountDefault(1500), '1,500');
  assert.equal(formatDuesAmountDefault(1500.5), '1,500.5');
  assert.equal(formatDuesAmountDefault(0), '0');
  assert.equal(formatDuesAmountDefault(4500), '4,500');
});

// ---------------------------------------------------------------------------
// Wiring — the Quick Collect amount field defaults to the full dues
// ---------------------------------------------------------------------------

test('wiring: defaults offer the full dues as the starting amount; the pre-fill still names the oldest open bill', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  const state = stateWith(mixedDuesCustomer());
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF);
  assert.equal(defaults.targetMonth, '2026-09');
  assert.equal(defaults.balanceDue, 1500);
  // Full dues: 1,500 still open on September + 3,000 on October.
  assert.equal(defaults.suggestedAmount, 4500);
  assert.equal(defaults.totalDues, 4500);
  // The oldest-bill pre-fill is unchanged: it still names September.
  assert.deepEqual(defaults.prefill, { amount: 1500, month: '2026-09', billAmount: 2500 });
});

test('wiring: a customer with no dues defaults to nothing', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  const state = stateWith(customerWithBills([
    bill('2026-08', 2500, [payment('2026-08-05', 2500)]),
    bill('2026-09', 2500, [payment('2026-09-07', 2500)]),
  ]));
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF);
  assert.equal(defaults.prefill, null);
  assert.equal(defaults.suggestedAmount, 0);
  assert.equal(defaults.totalDues, 0);
});

test('wiring: hand-written dues still join the offered amount, on the same fixture as the pre-fill', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addManualBaqayaEntry(state, 'CUST-1', { amount: 500, date: '2026-09-10', note: 'Last month balance' }, REF);
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF);
  assert.equal(defaults.manualBaqayaPending, 500);
  assert.equal(defaults.payableTotal, 3500);
  assert.equal(defaults.suggestedAmount, 3500);
  assert.deepEqual(defaults.prefill, { amount: 3000, month: '2026-09', billAmount: 3000 });
});

test('wiring: hand-written dues alone still offer their total when no bill is open', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  let state = stateWith(customerWithBills([
    bill('2026-10', 3000, [payment('2026-10-05', 3000)]),
  ]));
  state = addManualBaqayaEntry(state, 'CUST-1', { amount: 1500, date: '2026-09-10', note: 'Last month balance' }, REF);
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF);
  assert.equal(defaults.prefill, null);
  assert.equal(defaults.manualBaqayaPending, 1500);
  assert.equal(defaults.payableTotal, 1500);
  assert.equal(defaults.suggestedAmount, 1500);
});

test('wiring: the controller imports the module and fills the amount from the default on both screens', () => {
  assert.ok(quickCollectSrc.includes("from './dues-amount-default.js'"));
  assert.ok(quickCollectSrc.includes('duesAmountDefault('));
  assert.ok(quickCollectSrc.includes('amountInput.value = activeDefaults.suggestedAmount'));
  assert.ok(quickCollectSrc.includes('amountInputOne.value = activeDefaults.suggestedAmount'));
});

test('wiring: the offered amount stays editable', () => {
  const amountInput = indexSrc.match(/<input id="quickCollectAmountInput"[^>]*>/);
  assert.ok(amountInput, 'amount input exists');
  assert.ok(!/readonly|disabled/.test(amountInput[0]), 'the offered amount stays editable');
});

// ---------------------------------------------------------------------------
// Purity, fences, and the no-new-store rule
// ---------------------------------------------------------------------------

test('purity: the module reads nothing and stores nothing', () => {
  for (const token of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'shahdara_']) {
    assert.ok(!moduleSrc.includes(token), `module must not contain ${token}`);
  }
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not contain the standalone word OLT');
});

test('fences: the module and its tests never name a fenced file literally', () => {
  // The fenced neighbours are the one-screen flow, the name-prefix
  // lookup, the recent-customers quick-pick, the oldest-bill pre-fill,
  // the save-confirmation summary, the history views, the
  // roll-forward rule, and the daily entry summary. Their filenames
  // are built from fragments here so the test itself never contains
  // them either. The payment sheet controller is the wiring host,
  // not a fence — it is read and wired, never re-implemented.
  const fenced = [
    ['quick-collect-one-screen', '.js'],
    ['name-prefix-lookup', '.js'],
    ['recent-quick-pick', '.js'],
    ['transaction-prefill', '.js'],
    ['save-confirmation-summary', '.js'],
    ['full-history-list', '.js'],
    ['history-type-filter', '.js'],
    ['history-data-quality-flags', '.js'],
    ['balance-rollforward', '.js'],
    ['daily-entry-summary', '.js'],
  ];
  for (const parts of fenced) {
    const name = parts.join('');
    assert.ok(!moduleSrc.includes(name), `module names fenced file ${name}`);
    assert.ok(!testSrc.includes(name), `test names fenced file ${name}`);
  }
});

test('no real customer names or phone numbers in the module or its tests', () => {
  // Pattern-based: an 11-digit Pakistani mobile shape, or a +92 number,
  // must never appear in the module or its tests. (Substring checks
  // would trip on the pattern itself, so the shape is tested by regex.)
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(moduleSrc));
  assert.ok(!phoneShape.test(testSrc));
  // The forbidden names are built from fragments so this test itself
  // never contains them literally.
  const forbiddenNames = [
    ['Kir', 'an'],
    ['Hai', 'der'],
    ['Shu', 'naid'],
    ['Kha', 'zer'],
    ['Moh', 'sin'],
    ['Shar', 'jell'],
    ['No', 'mi'],
  ].map((parts) => parts.join(''));
  for (const name of forbiddenNames) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('no new store, no new styles rule, and no new language key', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'the default is derived, it keeps no store');
  assert.ok(!/dues-amount-default/.test(stylesSrc), 'no styles rule for this plan');
  assert.ok(!/dud_/.test(langSrc), 'no language key for this plan');
});
