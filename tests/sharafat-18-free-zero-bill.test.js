// Sharafat 18: a bill deliberately priced at Rs 0 (free month) is a
// priced bill, not an unpriced one — but only with the explicit
// `isZeroPriced: true` flag AND an exact 0 due. Without the flag, a
// Rs 0 / null bill stays unpriced everywhere, exactly as before.
//
// Parent decisions (2026-11-13): flag name `isZeroPriced: true` +
// a bill-form checkbox mirroring the tax checkbox; flagged zero
// bills count as PRICED everywhere (closing counts, dashboard,
// isPricedBill) — otherwise Polish #11 auto-reprice destroys free
// months.
//
// Fixtures are synthetic data only — no real customer names anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addPayment,
  autoPackageFromPayment,
  buildMonthlyClosingSnapshot,
  calculatePaymentAllocations,
  createInitialState,
  derivedBillStatus,
  isZeroPricedBill,
  saveBillMonth
} from '../core.js';
import { calculateDashboardKpis } from '../dashboard.js';
import { planCustomerCycleLine } from '../billing-cycle.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';

// Cycle-line fixtures mirror tests/billing-cycle.test.js.
const cycleBill = (month, overrides) => ({ id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [], ...overrides });
const cycleCustomer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  bills: [], ...overrides
});

function flaggedZeroState() {
  let state = createInitialState(['Free Month Tester']);
  state = saveBillMonth(state, 'seed-001', { month: MONTH, dueAmount: 0, status: 'pending', isZeroPriced: true }, REF);
  return state;
}

test('cycle line: a flagged zero bill is a line, not a skip', () => {
  const c = cycleCustomer('c1', 11, 'Free Month Tester', { bills: [cycleBill(MONTH, { dueAmount: 0, isZeroPriced: true })] });
  const line = planCustomerCycleLine(c, MONTH);
  assert.equal(line.skipped, false);
  assert.equal(line.currentMonthBill, 0);
  assert.equal(line.netDue, 0);
});

test('cycle line: an unflagged bill with no price is still skipped as unpriced-bill', () => {
  const c = cycleCustomer('c1', 11, 'No Price Tester', { bills: [cycleBill(MONTH, { dueAmount: null, priceSnapshot: null })] });
  const line = planCustomerCycleLine(c, MONTH);
  assert.equal(line.skipped, true);
  assert.equal(line.reason, 'unpriced-bill');
});

test('cycle line: a flagged zero bill keeps prior arrears (a free month never erases them)', () => {
  const prior = cycleBill('2026-09', { dueAmount: 3000 });
  const free = cycleBill(MONTH, { dueAmount: 0, isZeroPriced: true });
  const c = cycleCustomer('c1', 11, 'Arrears Tester', { bills: [prior, free] });
  const line = planCustomerCycleLine(c, MONTH);
  assert.equal(line.skipped, false);
  assert.equal(line.currentMonthBill, 0);
  assert.equal(line.previousArrears, 3000);
  assert.equal(line.netDue, 3000);
});

test('allocations: a flagged zero bill with no payment reads Paid, not unpriced', () => {
  const state = flaggedZeroState();
  const summary = calculatePaymentAllocations(state).forMonth('seed-001', MONTH);
  // The priced-path summary carries no billUnpriced field at all (that
  // flag lives on the payment ledger) — the priced read is 0, not null.
  assert.equal(summary.billAmountCents, 0);
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(summary.billUnpriced, undefined);
});

test('allocations: a payment on a flagged zero bill becomes excess credit and the bill stays Paid', () => {
  let state = flaggedZeroState();
  state = addPayment(state, 'seed-001', MONTH, { date: '2026-10-05', amount: 500, method: 'Cash' }, REF);
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth('seed-001', MONTH);
  assert.equal(summary.billAmountCents, 0);
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(summary.excessGeneratedCents, 50000);
  const paymentId = state.customers[0].bills.find(b => b.month === MONTH).payments[0].id;
  const ledger = allocations.byPaymentId.get(paymentId);
  assert.equal(ledger.billUnpriced, false);
  assert.equal(ledger.excessCents, 50000);
});

test('allocations: a payment on an unflagged bill with no price is still held as credit', () => {
  let state = createInitialState(['No Price Tester']);
  state = { ...state, customers: state.customers.map(c => c.id === 'seed-001' ? { ...c, bills: [{ id: 'unpriced-bill', month: MONTH, dueAmount: null, status: 'pending', payments: [{ id: 'advance-1', date: '2026-10-05', amount: 500, method: 'Cash' }] }] } : c) };
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth('seed-001', MONTH);
  assert.equal(summary.billAmountCents, null);
  assert.equal(summary.balanceDueCents, null);
  assert.equal(summary.excessGeneratedCents, 50000);
  assert.equal(allocations.byPaymentId.get('advance-1').billUnpriced, true);
});

test('status: flagged zero reads paid, unflagged no-price reads not-set, flagged non-zero is ordinary', () => {
  const flaggedZero = flaggedZeroState().customers[0];
  assert.equal(derivedBillStatus(flaggedZero, flaggedZero.bills[0]), 'paid');
  const unpriced = { ...flaggedZero, bills: [{ id: 'b2', month: MONTH, dueAmount: null, status: 'pending', payments: [] }] };
  assert.equal(derivedBillStatus(unpriced, unpriced.bills[0]), 'not-set');
  const flaggedPriced = { ...flaggedZero, bills: [{ id: 'b3', month: MONTH, dueAmount: 3000, isZeroPriced: true, status: 'pending', payments: [] }] };
  assert.equal(derivedBillStatus(flaggedPriced, flaggedPriced.bills[0]), 'pending');
});

test('predicate: isZeroPricedBill needs the flag AND an exact 0 due', () => {
  assert.equal(isZeroPricedBill({ dueAmount: 0, isZeroPriced: true }), true);
  assert.equal(isZeroPricedBill({ dueAmount: '0', isZeroPriced: true }), true);
  assert.equal(isZeroPricedBill({ dueAmount: 0 }), false);
  assert.equal(isZeroPricedBill({ dueAmount: 3000, isZeroPriced: true }), false);
  assert.equal(isZeroPricedBill({ dueAmount: null, isZeroPriced: true }), false);
  assert.equal(isZeroPricedBill({ dueAmount: '', isZeroPriced: true }), false);
  assert.equal(isZeroPricedBill({ dueAmount: 0, isZeroPriced: false }), false);
  assert.equal(isZeroPricedBill(null), false);
  assert.equal(isZeroPricedBill(undefined), false);
});

test('saveBillMonth: 0 is accepted with the flag and refused without it; re-pricing clears the flag', () => {
  const state = flaggedZeroState();
  const bill = state.customers[0].bills.find(b => b.month === MONTH);
  assert.equal(bill.dueAmount, 0);
  assert.equal(bill.isZeroPriced, true);

  let fresh = createInitialState(['Zero Without Flag']);
  assert.throws(
    () => saveBillMonth(fresh, 'seed-001', { month: MONTH, dueAmount: 0, status: 'pending' }, REF),
    /greater than zero/
  );

  // A flagged null due is still "no amount entered", not a free bill.
  assert.throws(
    () => saveBillMonth(fresh, 'seed-001', { month: MONTH, dueAmount: null, status: 'pending', isZeroPriced: true }, REF),
    /Enter a bill amount/
  );

  // Re-saving the free month at a real price clears the flag.
  const repriced = saveBillMonth(state, 'seed-001', { month: MONTH, dueAmount: 3000, status: 'pending' }, REF);
  const repricedBill = repriced.customers[0].bills.find(b => b.month === MONTH);
  assert.equal(repricedBill.dueAmount, 3000);
  assert.equal(repricedBill.isZeroPriced, undefined);
});

test('closing: a flagged zero bill counts as priced and adds Rs 0 to the billed amount', () => {
  let state = createInitialState(['Free Month Tester', 'No Price Tester']);
  state = saveBillMonth(state, 'seed-001', { month: MONTH, dueAmount: 0, status: 'pending', isZeroPriced: true }, REF);
  state = { ...state, customers: state.customers.map(c => c.id !== 'seed-002' ? c : { ...c, bills: [{ id: 'null-bill', month: MONTH, dueAmount: null, status: 'pending', payments: [] }] }) };
  const snapshot = buildMonthlyClosingSnapshot(state, MONTH, REF);
  assert.equal(snapshot.billCount, 2);
  assert.equal(snapshot.pricedBillCount, 1);
  assert.equal(snapshot.unpricedBillCount, 1);
  assert.equal(snapshot.billedAmount, 0);
  assert.equal(snapshot.pending, 0);
  assert.equal(snapshot.pendingBillCount, 0);
});

test('dashboard: a flagged zero bill counts as paid, not unpriced', () => {
  const state = flaggedZeroState();
  const kpis = calculateDashboardKpis(state, new Date('2026-10-15T12:00:00Z'));
  assert.equal(kpis.totalCurrentMonthBills, 1);
  assert.equal(kpis.paidBillsCount, 1);
  assert.equal(kpis.unpricedBillsCount, 0);
});

test('auto-reprice guard: a payment on a flagged zero bill never reprices it to the taken fee', () => {
  const before = flaggedZeroState();
  const after = addPayment(before, 'seed-001', MONTH, { date: '2026-10-05', amount: 2000, method: 'Cash' }, REF);
  const payment = after.customers[0].bills.find(b => b.month === MONTH).payments[0];
  const { nextState } = autoPackageFromPayment(before, after, 'seed-001', MONTH, payment.id, REF);
  const bill = nextState.customers[0].bills.find(b => b.month === MONTH);
  assert.equal(Number(bill.dueAmount), 0, 'the free month stands at Rs 0');
  assert.equal(bill.isZeroPriced, true);
  assert.equal(nextState.customers[0].monthlySellingAmount, 2000, 'the package still follows the taken fee');
});

test('i18n: the free-bill checkbox label exists in both dictionaries', () => {
  assert.equal(typeof TRANSLATIONS.en.prof_hist_bill_zero_price, 'string');
  assert.equal(typeof TRANSLATIONS.ur.prof_hist_bill_zero_price, 'string');
  assert.notEqual(TRANSLATIONS.en.prof_hist_bill_zero_price, 'prof_hist_bill_zero_price');
  assert.notEqual(TRANSLATIONS.ur.prof_hist_bill_zero_price, 'prof_hist_bill_zero_price');
});

test('form: the bill form carries the free-bill checkbox and the submit passes the flag', () => {
  // renderFullHistory is an unexported closure (no jsdom in the repo),
  // so the form is pinned by source scan, like the Sharafat 24 pins.
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /data-zero-price/);
  assert.match(app, /name="isZeroPriced"/);
  assert.match(app, /prof_hist_bill_zero_price/);
  assert.match(app, /isZeroPriced: Boolean\(zeroBox/);
});
