// Billing history — hide 'Not set' months + 1-tap '✓ Paid' (2026-11-22).
//
// Adapted from the prep repro (~/workspace/.billing-history-empty-months-prep-scratch/repro-billing-history-empty-months.mjs).
// C tests assert the FIXED state (they FAIL on base, PASS with the fix).
// S tests are stability (PASS on base AND with the fix) — they pin the
// engine contract the fix relies on. B tests are behaviour.
// S5 is FLIPPED from the repro: the repro pinned the undo gap as a
// passing test on base (the auto-generated bill REMAINS after undo);
// here S5 asserts the FIXED behaviour — undo of a tap-created bill
// removes the bill object too, so the month is empty again.
// 0 parity literals in this file (it is not a pinning file).
//
// Harness: node:test + direct core.js / billing-cycle.js imports (pure
// modules — the Plan 627 repro's pattern). renderHistory lives in
// app.js, a browser script node cannot import, so the UI behaviour is
// asserted at source level (the repro-627 C6 precedent): the drawer,
// the compact rows, the '✓ Paid' + 'Custom' actions and the handler
// that records through core addPayment. Synthetic data only — no real
// customer names, no realistic phone numbers (pattern-fake digits only).
//
// Defect (base): renderHistory (app.js:6817) renders ALL 24 months
// from monthsForHistory() as full <details class="month-card"> cards,
// so a customer with one populated month shows 23 empty 'Not set'
// cards (Oct 2026 down to Dec 2024) and the operator scrolls past
// them all. There is no way to settle a past month in one tap: the
// only path is opening its card, typing the bill amount, then typing
// the payment in the full manual form.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2] || '.';
const {
  createInitialState, saveBillMonth, addPayment, deletePayment, deleteBill,
  derivedBillStatus, monthsForHistory, calculatePaymentAllocations
} = await import(pathToFileURL(join(root, 'core.js')).href);
const { applicablePriceForMonth } = await import(pathToFileURL(join(root, 'billing-cycle.js')).href);

const app = readFileSync(join(root, 'app.js'), 'utf8');
const navLanguage = readFileSync(join(root, 'nav-language.js'), 'utf8');

// Fixed reference date: November 2026. monthsForHistory() then covers
// 2026-11 back to 2024-12 — the exact window in the user's screenshots.
const NOW = new Date('2026-11-21T12:00:00+05:00');
const MONTHS = monthsForHistory(NOW);
assert.equal(MONTHS.length, 24, 'precondition: the history window is 24 months');
assert.equal(MONTHS[0], '2026-11', 'precondition: the window starts at the current month');

function baseCustomer(overrides = {}) {
  let state = createInitialState(['Repro Tester']);
  const customer = {
    ...state.customers[0],
    billingStartMonth: '2026-11',
    monthlySellingAmount: 1500,
    monthlyPriceSchedule: [{ amount: 1500, effectiveMonth: '2026-11', recordedAt: '2026-11-01T00:00:00' }],
    bills: [],
    ...overrides
  };
  return { ...state, customers: [customer] };
}

const billsOf = (state) => state.customers[0].bills;
const billOf = (state, month) => billsOf(state).find((b) => b.month === month);

// The recommended populated predicate (see the prep report §7): a month
// is populated when it has a priced bill (a deliberate Rs 0 bill
// counts), OR any payment at all (even on an unpriced bill — S4 shows
// the status alone cannot see those), OR the allocation engine
// reports a billed total for it. A month with no bill object at all
// is empty. This helper mirrors the recommendation so the partition
// itself is testable; the C tests pin the app's own implementation.
function isPopulatedMonth(state, customer, month) {
  const bill = (customer.bills ?? []).find((b) => b.month === month);
  if (!bill) return false;
  if (bill.isZeroPriced === true) return true;
  if (typeof bill.dueAmount === 'number' && bill.dueAmount > 0) return true;
  if (Array.isArray(bill.payments) && bill.payments.length > 0) return true;
  const summary = calculatePaymentAllocations(state).forMonth(customer.id, month);
  return typeof summary?.billAmountCents === 'number' && summary.billAmountCents !== null;
}

// --- C1: one collapsed 'Past / Empty Months (X)' toggle below the active months ---
test('C1: a single collapsed Past / Empty Months toggle carries the empty count', () => {
  assert.match(navLanguage, /Past \/ Empty Months/,
    'the toggle label exists in the language file (EN value or key)');
  assert.ok(app.includes('data-empty-months-toggle'),
    'renderHistory renders a toggle button for the empty months (data-empty-months-toggle)');
  assert.ok(app.includes('data-empty-months'),
    'the empty months live in one collapsed container (data-empty-months)');
});

// --- C2: empty months render as compact single-line rows, not full cards ---
test('C2: an empty month renders as a compact single-line row inside the drawer', () => {
  assert.ok(app.includes('empty-month-row'),
    'the drawer renders compact empty-month rows (empty-month-row), not full month cards');
});

// --- C3: each empty row carries a 1-tap '✓ Paid' pill ---
test('C3: each empty row carries a 1-tap Paid action', () => {
  assert.ok(app.includes('data-mark-month-paid'),
    'the empty row carries a mark-paid action (data-mark-month-paid)');
  assert.ok(app.includes('✓ Paid') || navLanguage.includes('✓ Paid'),
    'the action reads ✓ Paid');
});

// --- C4: each empty row carries a Custom tap target for manual entry ---
test('C4: each empty row carries a Custom target opening the manual form', () => {
  assert.ok(app.includes('data-open-month-form'),
    'the empty row carries a Custom target (data-open-month-form)');
  assert.ok(app.includes('Custom') || navLanguage.includes('Custom'),
    'the target reads Custom');
});

// --- C5 + C6: the mark-paid handler records through core and re-renders ---
function markPaidHandlerSlice() {
  const named = app.indexOf('onMarkMonthPaid');
  if (named !== -1) return app.slice(named, named + 1500);
  const alt = app.indexOf('markMonthPaid');
  if (alt !== -1) return app.slice(alt, alt + 1500);
  const binding = app.indexOf("querySelectorAll('[data-mark-month-paid]')");
  if (binding !== -1) return app.slice(binding, binding + 1500);
  return '';
}

test('C5: the mark-paid handler records the payment at the applicable price', () => {
  const handler = markPaidHandlerSlice();
  assert.ok(handler.length > 0,
    'a mark-paid handler exists (onMarkMonthPaid / markMonthPaid / data-mark-month-paid binding)');
  assert.ok(handler.includes('addPayment('),
    'the handler records through core addPayment — the choke point that auto-generates the bill');
  assert.ok(handler.includes('applicablePriceForMonth('),
    'the amount is the saved package rate for that month (applicablePriceForMonth — schedule, seasonal-aware)');
});

test('C6: after marking paid the month moves to the populated list (re-render)', () => {
  const handler = markPaidHandlerSlice();
  assert.ok(handler.length > 0, 'precondition: the mark-paid handler exists (see C5)');
  assert.ok(handler.includes('save('), 'the handler persists the recording');
  assert.ok(handler.includes('renderDetail('),
    'the handler re-renders the profile — the month leaves the empty partition on the next render');
});

// --- C7: the current month stays visible even when empty (recommendation) ---
test('C7: the current month stays in the visible list even when it is empty', () => {
  const start = app.indexOf('function renderHistory(customer)');
  assert.ok(start !== -1, 'precondition: renderHistory exists');
  const nextFn = app.indexOf('\nfunction ', start + 10);
  const body = app.slice(start, nextFn === -1 ? start + 20000 : nextFn);
  assert.ok(body.includes('monthsForHistory()[0]'),
    'the partition names the current month (monthsForHistory()[0]) — it stays visible, only PAST empty months collapse');
  assert.match(body, /empty/i, 'the partition names the empty months it collapses');
});

// --- S1: engine contract — a payment for an empty month auto-prices + settles it ---
test('S1: recording a payment for an empty month auto-generates its bill and settles it', () => {
  const customer = {
    ...baseCustomer().customers[0],
    billingStartMonth: '2026-06',
    monthlyPriceSchedule: [{ amount: 1500, effectiveMonth: '2026-06', recordedAt: '2026-06-01T00:00:00' }]
  };
  const state = { ...baseCustomer(), customers: [customer] };
  const next = addPayment(state, 'seed-001', '2026-09',
    { amount: 1500, method: 'Cash', date: '2026-09-30' }, NOW);
  const bill = billOf(next, '2026-09');
  assert.ok(bill, 'the bill is created by the recording itself');
  assert.equal(bill.dueAmount, 1500, 'the bill is priced from the schedule (1500)');
  assert.equal(derivedBillStatus(next.customers[0], bill), 'paid',
    'the full payment settles the month — status paid');
  assert.equal(bill.payments.length, 1, 'exactly one payment recorded');
  assert.equal(bill.payments[0].method, 'Cash', 'the recorded method is Cash (the 1-tap default)');
});

// --- S2: the saved rate for a backdated month is the schedule rate at that month ---
test('S2: applicablePriceForMonth returns the schedule rate effective at the month', () => {
  const customer = {
    billingStartMonth: '2026-06',
    monthlySellingAmount: 2000,
    monthlyPriceSchedule: [
      { amount: 1500, effectiveMonth: '2026-06', recordedAt: '2026-06-01T00:00:00' },
      { amount: 2000, effectiveMonth: '2026-10', recordedAt: '2026-10-01T00:00:00' }
    ]
  };
  assert.equal(applicablePriceForMonth(customer, '2026-09'), 1500,
    'September prices at the June rate (1500), not the current 2000');
  assert.equal(applicablePriceForMonth(customer, '2026-10'), 2000,
    'October prices at the October rate (2000)');
  assert.equal(applicablePriceForMonth(customer, '2026-05'), null,
    'a month before the first schedule entry has no applicable price');
  assert.equal(applicablePriceForMonth({ monthlyPriceSchedule: [] }, '2026-09'), null,
    'a customer with no schedule has no applicable price — no Paid button, Custom only');
});

// --- S3: an empty month reads Not set ---
test('S3: a month with no bill reads not-set', () => {
  const state = baseCustomer();
  assert.equal(derivedBillStatus(state.customers[0], undefined), 'not-set',
    'no bill object means Not set');
  assert.equal(isPopulatedMonth(state, state.customers[0], '2026-09'), false,
    'the predicate agrees: no bill means empty');
});

// --- S4: status alone cannot see a payment on an unpriced bill ---
test('S4: a payment on an unpriced bill still reads not-set — the predicate must count payments', () => {
  const customer = {
    ...baseCustomer().customers[0],
    billingStartMonth: null,
    monthlySellingAmount: null,
    monthlyPriceSchedule: []
  };
  const state = { ...baseCustomer(), customers: [customer] };
  const next = addPayment(state, 'seed-001', '2026-09',
    { amount: 1500, method: 'Cash', date: '2026-09-30' }, NOW);
  const bill = billOf(next, '2026-09');
  assert.ok(bill, 'the payment creates a bill object');
  assert.equal(bill.dueAmount, null, 'with no schedule the bill stays unpriced');
  assert.equal(bill.payments.length, 1, 'the payment is on the bill');
  assert.equal(derivedBillStatus(next.customers[0], bill), 'not-set',
    'status alone still reads Not set — the month looks empty to a status-only check');
  assert.equal(isPopulatedMonth(next, next.customers[0], '2026-09'), true,
    'the predicate counts the payment, so the month is populated');
});

// --- S5 (FLIPPED from the repro): undo of a tap-created bill removes the bill too ---
test('S5: undoing a tap-created payment also removes the bill it created', () => {
  const customer = {
    ...baseCustomer().customers[0],
    billingStartMonth: '2026-06',
    monthlyPriceSchedule: [{ amount: 1500, effectiveMonth: '2026-06', recordedAt: '2026-06-01T00:00:00' }]
  };
  const state = { ...baseCustomer(), customers: [customer] };
  const paid = addPayment(state, 'seed-001', '2026-09',
    { amount: 1500, method: 'Cash', date: '2026-09-30' }, NOW);
  const paymentId = billOf(paid, '2026-09').payments[0].id;
  assert.throws(() => deleteBill(paid, 'seed-001', '2026-09'), /still has payments/,
    'a bill that still has payments refuses removal — the payment goes first');
  const undone = deletePayment(paid, 'seed-001', '2026-09', paymentId, NOW);
  assert.equal(billOf(undone, '2026-09').payments.length, 0, 'the payment is gone after undo');
  const removed = deleteBill(undone, 'seed-001', '2026-09');
  assert.equal(billOf(removed, '2026-09'), undefined,
    'FIXED (was the repro gap): the bill the tap created is gone too — the month is empty again, not Pending');
  assert.equal(isPopulatedMonth(removed, removed.customers[0], '2026-09'), false,
    'the month reads empty again after undo');
  assert.throws(() => deleteBill(removed, 'seed-001', '2026-09'), /Bill not found/,
    'removing a month with no bill throws instead of silently succeeding');
});

// --- B1: the recommended partition splits the fixture 2 populated / 22 empty ---
test('B1: the partition splits a 2-bill fixture into 2 populated and 22 empty months', () => {
  let state = baseCustomer();
  state = saveBillMonth(state, 'seed-001',
    { month: '2026-11', dueAmount: 1500, status: 'pending' }, NOW);
  state = addPayment(state, 'seed-001', '2026-11',
    { amount: 1500, method: 'Cash', date: '2026-11-05' }, NOW);
  state = saveBillMonth(state, 'seed-001',
    { month: '2026-06', dueAmount: 1500, status: 'pending' }, NOW);
  const customer = state.customers[0];
  assert.equal(derivedBillStatus(customer, billOf(state, '2026-11')), 'paid', 'November is paid');
  assert.equal(derivedBillStatus(customer, billOf(state, '2026-06')), 'pending', 'June is pending');
  const populated = MONTHS.filter((m) => isPopulatedMonth(state, customer, m));
  const empty = MONTHS.filter((m) => !isPopulatedMonth(state, customer, m));
  assert.deepEqual(populated, ['2026-11', '2026-06'], 'only the two billed months are populated');
  assert.equal(empty.length, 22, 'the other 22 months are empty — the drawer count is 22');
});

// --- B2: the full transaction history is a separate renderer, untouched ---
test('B2: the full transaction history renderer still exists untouched', () => {
  assert.ok(app.includes('function renderFullHistory(customer)'),
    'renderFullHistory is a separate renderer and stays in place');
});
