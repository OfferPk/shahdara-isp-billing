// SISP-2: Automated Monthly Bill Cycle, Arrears Carry-Forward & Advance
// Adjustment Engine. Pure-function tests on synthetic data only.
// Spec test criteria (verbatim):
//   - A customer with a Rs. 3,000 prior unpaid bill gets a new month bill
//     of Rs. 3,000 with total outstanding showing Rs. 6,000.
//   - A customer who paid Rs. 6,000 in advance gets a Rs. 3,000 current
//     bill with Rs. 0 net due and Rs. 3,000 remaining advance credit.
//   - Running the cycle twice for the same month creates no duplicate
//     bills (second run is refused with a clear message).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BILLING_CYCLES_KEY,
  applicablePriceForMonth,
  arrearsAndAdvance,
  arrearsBreakdownTextLines,
  buildArrearsBreakdown,
  isBillingCycleMonth,
  loadBillingCycles,
  planBillingCycle,
  planCustomerCycleLine,
  runBillingCycle,
  applyBillingCycle,
  sanitizeBillingCycles,
  saveBillingCycles
} from '../billing-cycle.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

const payment = (id, overrides) => ({ id, date: '2026-09-06', amount: 0, method: 'Cash', ...overrides });
const bill = (month, overrides) => ({ id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [], ...overrides });
const customer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  bills: [], ...overrides
});
const stateWith = (customers) => ({ customers });

test('spec criterion 1: Rs. 3,000 prior unpaid bill -> new Rs. 3,000 bill, Rs. 6,000 outstanding', () => {
  const c = customer('c1', 11, 'CH BILAL', { bills: [bill('2026-09')] });
  const line = planCustomerCycleLine(c, '2026-10');
  assert.equal(line.skipped, false);
  assert.equal(line.currentMonthBill, 3000);
  assert.equal(line.previousArrears, 3000);
  assert.equal(line.advanceCredit, 0);
  assert.equal(line.netDue, 6000);
  const { state: next } = applyBillingCycle(stateWith([c]), '2026-10', new Date('2026-10-01T00:00:00Z'));
  const nextCustomer = next.customers[0];
  assert.equal(nextCustomer.bills.length, 2);
  const october = nextCustomer.bills.find((row) => row.month === '2026-10');
  assert.equal(october.dueAmount, 3000);
  assert.equal(october.priceSnapshot, 3000);
  assert.equal(october.dueDate, '2026-10-05');
  const breakdown = buildArrearsBreakdown(nextCustomer, october);
  assert.equal(breakdown.packageAmount, 3000);
  assert.equal(breakdown.previousArrears, 3000);
  assert.equal(breakdown.totalDue, 6000);
  assert.equal(breakdown.balanceDue, 6000);
});

test('spec criterion 2: Rs. 6,000 advance -> Rs. 3,000 bill, Rs. 0 net due, Rs. 3,000 advance left', () => {
  // Rs. 6,000 of ADVANCE credit before the cycle month: a Rs. 9,000 receipt
  // on the Rs. 3,000 September bill covers it and leaves Rs. 6,000 excess.
  const c = customer('c1', 11, 'CH BILAL', {
    bills: [bill('2026-09', { payments: [payment('p1', { date: '2026-09-06', amount: 9000 })] })]
  });
  const line = planCustomerCycleLine(c, '2026-10');
  assert.equal(line.currentMonthBill, 3000);
  assert.equal(line.previousArrears, 0);
  assert.equal(line.advanceCredit, 6000);
  assert.equal(line.netDue, 0);
  assert.equal(line.remainingAdvance, 3000);
});

test('spec criterion 3: second run for the same month is refused and creates no duplicate bills', () => {
  const c = customer('c1', 11, 'CH BILAL', { bills: [bill('2026-09')] });
  const first = runBillingCycle(stateWith([c]), '2026-10', [], new Date('2026-10-01T00:00:00Z'));
  assert.equal(first.state.customers[0].bills.length, 2);
  assert.equal(first.cycle.month, '2026-10');
  assert.throws(() => runBillingCycle(first.state, '2026-10', [first.cycle]), /already ran/);
  // Backstop: even without the record, re-applying adopts the existing bill.
  const reapplied = applyBillingCycle(first.state, '2026-10', new Date('2026-10-01T00:00:00Z'));
  assert.equal(reapplied.state.customers[0].bills.length, 2);
  assert.deepEqual(reapplied.createdBillIds, []);
});

test('arrears math: multi-month unpaid + partial payment sums to Rs. 5,000 arrears', () => {
  const c = customer('c1', 11, 'CH BILAL', {
    bills: [
      bill('2026-08'),
      bill('2026-09', { payments: [payment('p1', { date: '2026-09-06', amount: 1000 })] })
    ]
  });
  const { previousArrears, advanceCredit, arrearsMonths } = arrearsAndAdvance(c, '2026-10');
  assert.equal(previousArrears, 5000);
  assert.equal(advanceCredit, 0);
  assert.equal(arrearsMonths, 2);
});

test('advance from a payment on an unpriced bill rolls forward', () => {
  const c = customer('c1', 11, 'CH BILAL', {
    bills: [bill('2026-08', { dueAmount: null, priceSnapshot: null, payments: [payment('p1', { date: '2026-08-06', amount: 2000 })] })]
  });
  const { previousArrears, advanceCredit } = arrearsAndAdvance(c, '2026-10');
  assert.equal(previousArrears, 0);
  assert.equal(advanceCredit, 2000);
});

test('existing priced bill is adopted untouched (rate-locked) even after a price change', () => {
  const c = customer('c1', 11, 'CH BILAL', {
    monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }, { effectiveMonth: '2026-10', amount: 4000 }],
    bills: [bill('2026-09'), bill('2026-10', { dueAmount: 3000, priceSnapshot: 3000 })]
  });
  const line = planCustomerCycleLine(c, '2026-10');
  assert.equal(line.currentMonthBill, 3000);
  assert.equal(line.existingBillId, 'bill-2026-10');
  const input = stateWith([c]);
  const { state: next } = applyBillingCycle(input, '2026-10');
  assert.equal(next, input); // nothing created: the same state object is returned
  assert.equal(next.customers[0].bills.length, 2);
  assert.equal(applicablePriceForMonth(c, '2026-10'), 4000); // schedule says 4000, bill stays 3000
});

test('skips: archived, billing-not-started, no-price, unpriced-bill', () => {
  const archived = customer('a', 1, 'ARCHIVED', { archived: true });
  const future = customer('f', 2, 'FUTURE', { billingStartMonth: '2026-12' });
  const noPrice = customer('n', 3, 'NO PRICE', { monthlyPriceSchedule: [] });
  const unpriced = customer('u', 4, 'UNPRICED', { bills: [bill('2026-10', { dueAmount: null, priceSnapshot: null })] });
  const plan = planBillingCycle(stateWith([archived, future, noPrice, unpriced]), '2026-10');
  assert.equal(plan.lines.length, 0);
  assert.deepEqual(plan.skipped.map((row) => row.reason), ['archived', 'billing-not-started', 'no-price', 'unpriced-bill']);
  assert.equal(plan.totals.billedCount, 0);
});

test('batch summary totals and defaulter aging buckets', () => {
  const currentOnly = customer('c1', 11, 'CURRENT ONLY');
  const aged = customer('c2', 12, 'AGED', { bills: [bill('2026-08'), bill('2026-09')] });
  const settled = customer('c3', 13, 'SETTLED', {
    bills: [bill('2026-09', { payments: [payment('p1', { date: '2026-09-06', amount: 6000 })] })]
  });
  const plan = planBillingCycle(stateWith([currentOnly, aged, settled]), '2026-10');
  assert.equal(plan.totals.totalBilled, 9000);
  assert.equal(plan.totals.totalArrears, 6000);
  assert.equal(plan.totals.totalAdvanceAvailable, 3000);
  assert.equal(plan.totals.totalAdvanceApplied, 3000);
  assert.equal(plan.totals.netExpectedCollection, 12000);
  assert.deepEqual(plan.defaulterBuckets, { current: 1, oneMonth: 0, twoToThreeMonths: 1, fourPlusMonths: 0 });
});

test('receipt breakdown reconciles: total - paid - discount = balance', () => {
  const c = customer('c1', 11, 'CH BILAL', {
    bills: [
      bill('2026-09'),
      bill('2026-10', { payments: [payment('p1', { date: '2026-10-06', amount: 2000 })] })
    ]
  });
  const october = c.bills.find((row) => row.month === '2026-10');
  const breakdown = buildArrearsBreakdown(c, october);
  assert.equal(breakdown.packageAmount, 3000);
  assert.equal(breakdown.previousArrears, 3000);
  assert.equal(breakdown.totalDue, 6000);
  assert.equal(breakdown.paidAmount, 2000);
  assert.equal(breakdown.balanceDue, 4000);
  assert.equal(breakdown.totalDue - breakdown.paidAmount - breakdown.discountApplied, breakdown.balanceDue);
  const lines = arrearsBreakdownTextLines(breakdown);
  assert.equal(lines.length, 5);
  assert.match(lines[0], /Mahana Package/);
  assert.match(lines[1], /Sabiqa Baqaya/);
  assert.match(lines[2], /Kul Qabil-e-Ada/);
  assert.match(lines[3], /Wusool Paya/);
  assert.match(lines[4], /Baqi Rehta/);
  assert.equal(buildArrearsBreakdown(c, bill('2026-11', { dueAmount: null })), null);
});

test('cycle records: sanitize drops invalid/duplicate months, storage round-trips', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadBillingCycles(storage), []);
  const cycles = sanitizeBillingCycles([
    { month: '2026-10', ranAt: '2026-10-01 10:00 PKT', totals: { billedCount: 2, netExpectedCollection: 6000 }, lines: [], skipped: [] },
    { month: '2026-10', ranAt: 'dup', totals: {}, lines: [], skipped: [] },
    { month: 'not-a-month', ranAt: '', totals: {}, lines: [], skipped: [] },
    null
  ]);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0].month, '2026-10');
  saveBillingCycles(cycles, storage);
  assert.equal(JSON.parse(storage.getItem(BILLING_CYCLES_KEY)).length, 1);
  assert.equal(loadBillingCycles(storage).length, 1);
  assert.equal(isBillingCycleMonth('2026-10'), true);
  assert.equal(isBillingCycleMonth('2026-13'), false);
  assert.equal(isBillingCycleMonth('2026-1'), false);
});
