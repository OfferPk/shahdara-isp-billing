// M1: FIFO Voided-Payment Guard. Regression pins for the whole FIFO
// seam (billing-cycle.js derivation + every production consumer
// surface), proving a SISP-34 voided payment allocates NOTHING through
// any path, and that non-voided allocations are byte-identical to the
// behaviour the seam has always had.
//
// Background: SISP-164's prep probe found the FIFO helper did not skip
// voided payments itself, so its consumer (revenue-stream-breakdown.js)
// fed it a hand-filtered view. FU4 later made the shared derivation
// (allocateFifoForBill) skip voided payments via the canonical
// isVoidedPayment — but the audit of ALL consumers was never done and
// the safety lived in one stale header comment. M1 completes the
// audit, switches the last hand-rolled duplicate predicate in the
// FIFO consumer set to the canonical isVoidedPayment, and pins every
// surface here so the exclusion can never silently regress.
//
// Synthetic data only. Fixture mirrors tests/sisp33-fifo.test.js:
// Rs 3,000 unpaid September bill (arrears) + October bill of Rs 4,000
// (Rs 3,000 package + Rs 1,000 kist, plan-1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateFifoForBill,
  applyFifoPaymentEventToState,
  fifoAllocationForPayment,
  fifoRemainingForBill
} from '../billing-cycle.js';
import { buildPaymentReceipt } from '../receipt.js';
import { buildRevenueStreamBreakdown } from '../revenue-stream-breakdown.js';

const payment = (id, overrides) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });
const bill = (month, overrides) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending',
  payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [],
  ...overrides
});
const plan = (overrides) => ({
  id: 'plan-1', itemTitle: 'Tenda F3 Router', totalAmount: 3000, downPayment: 0,
  monthlyKist: 1000, totalMonths: 3, monthsBilled: 1, monthsPaid: 0, startDate: null, ...overrides
});
const kistLine = (overrides) => ({
  planId: 'plan-1', installmentNumber: 1, totalMonths: 3, amount: 1000, itemTitle: 'Tenda F3 Router', ...overrides
});
const customerWith = (currentPayments, planOverrides = {}) => ({
  id: 'cust-m1', customerNumber: 71, name: 'M1 Guard Customer', archived: false, billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  installmentPlans: [plan(planOverrides)],
  bills: [
    bill('2026-09', { dueAmount: 3000, priceSnapshot: 3000 }),
    bill('2026-10', {
      dueAmount: 4000, priceSnapshot: 3000, kistLines: [kistLine()], kistTotal: 1000, payments: currentPayments
    })
  ]
});
const octBillOf = (customer) => customer.bills.find((row) => row.month === '2026-10');

// The voided record is deliberately poisonous: Rs 7,000 + Rs 500
// discount would clear EVERY bucket (3,000 arrears + 3,000 package +
// 1,000 kist) and trigger the kist bump if it ever allocated.
// The valid Rs 4,500 splits arrears 3,000 / package 1,500 / kist 0.
const VOIDED = () => payment('p-void', { date: '2026-10-03', amount: 7000, discount: 500, voided: true, voidReason: 'wrong customer' });
const VALID = () => payment('p-ok', { date: '2026-10-06', amount: 4500 });
const guardedCustomer = () => customerWith([VOIDED(), VALID()]);
const cleanCustomer = () => customerWith([VALID()]); // the same world with the voided record simply absent

test('M1 helper: fifoAllocationForPayment returns null for a voided payment', () => {
  const customer = guardedCustomer();
  assert.equal(fifoAllocationForPayment(customer, octBillOf(customer), 'p-void'), null);
});

test('M1 derivation: a voided payment leaves no split entry and consumes no bucket', () => {
  const customer = guardedCustomer();
  const derived = allocateFifoForBill(customer, octBillOf(customer));
  assert.equal(derived.payments.length, 1);
  assert.equal(derived.payments[0].paymentId, 'p-ok');
  assert.deepEqual(
    [derived.payments[0].toArrears, derived.payments[0].toPackage, derived.payments[0].toKist],
    [3000, 1500, 0]
  );
  // The voided record contributes exactly zero: the whole derivation
  // is identical to the world where the record was never written.
  const clean = cleanCustomer();
  assert.deepEqual(derived, allocateFifoForBill(clean, octBillOf(clean)));
});

test('M1 profile surface: fifoRemainingForBill ignores the voided payment', () => {
  const customer = guardedCustomer();
  const remaining = fifoRemainingForBill(customer, octBillOf(customer));
  assert.deepEqual(
    [remaining.remainingArrears, remaining.remainingPackage, remaining.remainingKist, remaining.remainingTotal],
    [0, 1500, 1000, 2500]
  );
  const clean = cleanCustomer();
  assert.deepEqual(remaining, fifoRemainingForBill(clean, octBillOf(clean)));
});

test('M1 payment event: a voided payment earns no FIFO flag and no kist bump', () => {
  const customer = guardedCustomer();
  const state = { customers: [customer] };
  const next = applyFifoPaymentEventToState(state, 'cust-m1', '2026-10', 'p-void');
  // No derivation entry exists for a voided payment, so the event is a
  // strict no-op — the very same state object comes back.
  assert.equal(next, state);
  const saved = next.customers[0];
  assert.equal(saved.bills[1].payments[0].fifoEventApplied, undefined);
  assert.equal(saved.installmentPlans[0].monthsPaid, 0);
});

test('M1 payment event control: a valid payment that covers the kist still bumps monthsPaid', () => {
  const customer = customerWith([payment('p-full', { amount: 7000 })]);
  const state = { customers: [customer] };
  const next = applyFifoPaymentEventToState(state, 'cust-m1', '2026-10', 'p-full');
  assert.notEqual(next, state);
  assert.equal(next.customers[0].bills[1].payments[0].fifoEventApplied, true);
  assert.equal(next.customers[0].installmentPlans[0].monthsPaid, 1);
});

test('M1 receipt surface: the voided payment prints no FIFO split; the valid receipt split is unchanged', () => {
  const customer = guardedCustomer();
  const oct = octBillOf(customer);
  const voidedReceipt = buildPaymentReceipt(customer, oct, oct.payments[0]);
  assert.equal(voidedReceipt.fifoAllocation, null);
  assert.equal(voidedReceipt.fifoRemaining, null);
  assert.equal(voidedReceipt.fifoShow, false);

  const receipt = buildPaymentReceipt(customer, oct, oct.payments[1]);
  assert.deepEqual(receipt.fifoAllocation, { toArrears: 3000, toPackage: 1500, toKist: 0, prioritizeKistFirst: false });
  assert.deepEqual(receipt.fifoRemaining, { arrears: 0, package: 1500, kist: 1000 });

  const clean = cleanCustomer();
  const cleanReceipt = buildPaymentReceipt(clean, octBillOf(clean), octBillOf(clean).payments[0]);
  assert.deepEqual(receipt.fifoAllocation, cleanReceipt.fifoAllocation);
  assert.deepEqual(receipt.fifoRemaining, cleanReceipt.fifoRemaining);
});

test('M1 revenue-stream surface: a voided payment contributes nothing to any stream', () => {
  const breakdown = buildRevenueStreamBreakdown({ customers: [guardedCustomer()] }, '2026-10');
  // Only the valid Rs 4,500 counts: 3,000 recovered arrears + 1,500
  // current-month package. Had the voided Rs 7,000 leaked, it would
  // have surfaced as unattributed Other and a second counted payment.
  assert.equal(breakdown.arrearsCents, 300000);
  assert.equal(breakdown.currentCents, 150000);
  assert.equal(breakdown.kistCents, 0);
  assert.equal(breakdown.otherCents, 0);
  assert.equal(breakdown.collectionsCents, 450000);
  assert.equal(breakdown.paymentCount, 1);
  // Identical, figure for figure, to the world without the record.
  assert.deepEqual(breakdown, buildRevenueStreamBreakdown({ customers: [cleanCustomer()] }, '2026-10'));
});

test('M1 control: non-voided allocations are byte-identical to the established FIFO behaviour', () => {
  const customer = customerWith([
    payment('p1', { amount: 4500 }),
    payment('p2', { date: '2026-10-09', amount: 2500, fifoPrioritizeKistFirst: true })
  ]);
  const oct = octBillOf(customer);
  const first = fifoAllocationForPayment(customer, oct, 'p1');
  assert.deepEqual(
    [first.allocation.toArrears, first.allocation.toPackage, first.allocation.toKist],
    [3000, 1500, 0]
  );
  assert.deepEqual(first.remaining, { arrears: 0, package: 1500, kist: 1000 });
  const second = fifoAllocationForPayment(customer, oct, 'p2');
  // Kist-first toggle: the remaining Rs 1,000 kist clears before the
  // last Rs 1,500 of package.
  assert.deepEqual(
    [second.allocation.toArrears, second.allocation.toPackage, second.allocation.toKist],
    [0, 1500, 1000]
  );
  assert.deepEqual(second.remaining, { arrears: 0, package: 0, kist: 0 });
  assert.equal(fifoRemainingForBill(customer, oct).remainingTotal, 0);
});
