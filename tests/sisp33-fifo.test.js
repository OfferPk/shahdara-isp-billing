// SISP-33: Partial Payment FIFO Allocation Across Arrears, Package Bill &
// Hardware Kist. Pure-function + derivation tests on synthetic data only.
// Pinned criterion (verbatim from the phase brief): Arrears 3,000 +
// Package 3,000 + Kist 1,000 (Total 7,000), paying 4,500 clears Arrears,
// leaving 1,500 Package + 1,000 Kist (2,500 remaining).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateFifoPayment,
  allocateFifoForBill,
  applyFifoPaymentEventToState,
  fifoAllocationForPayment,
  fifoBillContext,
  fifoRemainingForBill,
  fifoTextLines
} from '../billing-cycle.js';
import { advancePlansForCoveredKist } from '../installment-plan.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { createReceiptWhatsAppDraft, currentBillPresentation } from '../profile-ui.js';
import { calculatePaymentAllocations } from '../core.js';

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
// Customer owing 3,000 arrears (unpaid 2026-09 bill) + a 2026-10 bill of
// 4,000 (3,000 package + 1,000 kist) with one active kist plan.
const fifoCustomer = (currentPayments, planOverrides = {}) => ({
  id: 'cust-1', customerNumber: 7, name: 'FIFO Customer', archived: false, billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  installmentPlans: [plan(planOverrides)],
  bills: [
    bill('2026-09', { dueAmount: 3000, priceSnapshot: 3000 }),
    bill('2026-10', {
      dueAmount: 4000, priceSnapshot: 3000, kistLines: [kistLine()], kistTotal: 1000, payments: currentPayments
    })
  ]
});
const currentBillOf = (customer) => customer.bills.find((row) => row.month === '2026-10');

test('SISP-33 pinned: 4,500 across 3,000 arrears + 3,000 package + 1,000 kist clears arrears, leaves 1,500 package + 1,000 kist', () => {
  const result = allocateFifoPayment({ previousArrears: 3000, currentMonthBill: 3000, monthlyKist: 1000, amount: 4500 });
  assert.equal(result.toArrears, 3000);
  assert.equal(result.toPackage, 1500);
  assert.equal(result.toKist, 0);
  assert.equal(result.remainingArrears, 0);
  assert.equal(result.remainingPackage, 1500);
  assert.equal(result.remainingKist, 1000);
  assert.equal(result.allocatedTotal, 4500);
  assert.equal(result.remainingTotal, 2500);
});

test('SISP-33 toggle: Prioritize Kist First clears arrears + kist, leaving 2,500 package (500 applied to package)', () => {
  // NOTE: the brief's parenthetical "leaving 500 Package" reads as the
  // amount APPLIED to the package, not the amount remaining: 4,500 −
  // 3,000 arrears − 1,000 kist = 500 toward the 3,000 package, so 2,500
  // of package remains. The pinned numbers below are the arithmetic.
  const result = allocateFifoPayment({ previousArrears: 3000, currentMonthBill: 3000, monthlyKist: 1000, amount: 4500, prioritizeKistFirst: true });
  assert.equal(result.toArrears, 3000);
  assert.equal(result.toKist, 1000);
  assert.equal(result.toPackage, 500);
  assert.equal(result.remainingArrears, 0);
  assert.equal(result.remainingKist, 0);
  assert.equal(result.remainingPackage, 2500);
  assert.equal(result.remainingTotal, 2500);
});

test('SISP-33: full payment zeroes every bucket; overpayment attributes only up to the total', () => {
  const full = allocateFifoPayment({ previousArrears: 3000, currentMonthBill: 3000, monthlyKist: 1000, amount: 7000 });
  assert.deepEqual(
    [full.toArrears, full.toPackage, full.toKist, full.remainingTotal],
    [3000, 3000, 1000, 0]
  );
  const over = allocateFifoPayment({ previousArrears: 3000, currentMonthBill: 3000, monthlyKist: 1000, amount: 8000 });
  assert.equal(over.allocatedTotal, 7000);
  assert.equal(over.remainingTotal, 0);
});

test('SISP-33: zero amount and negative buckets count as zero', () => {
  const zero = allocateFifoPayment({ previousArrears: 3000, currentMonthBill: 3000, monthlyKist: 1000, amount: 0 });
  assert.deepEqual([zero.allocatedTotal, zero.remainingTotal], [0, 7000]);
  const negative = allocateFifoPayment({ previousArrears: -500, currentMonthBill: 3000, monthlyKist: 1000, amount: 1500 });
  assert.deepEqual([negative.toArrears, negative.toPackage, negative.remainingPackage], [0, 1500, 1500]);
});

test('SISP-33 bill derivation matches the pinned split for a real bill shape', () => {
  const customer = fifoCustomer([payment('p1', { amount: 4500 })]);
  const bill10 = currentBillOf(customer);
  const context = fifoBillContext(customer, bill10);
  assert.equal(context.previousArrears, 3000);
  assert.equal(context.packageTotal, 3000);
  assert.equal(context.kistTotal, 1000);
  const fifo = fifoAllocationForPayment(customer, bill10, 'p1');
  assert.deepEqual(
    [fifo.allocation.toArrears, fifo.allocation.toPackage, fifo.allocation.toKist],
    [3000, 1500, 0]
  );
  assert.deepEqual(
    [fifo.remaining.arrears, fifo.remaining.package, fifo.remaining.kist],
    [0, 1500, 1000]
  );
  assert.equal(fifo.show, true);
  const remaining = fifoRemainingForBill(customer, bill10);
  assert.deepEqual(
    [remaining.remainingArrears, remaining.remainingPackage, remaining.remainingKist, remaining.remainingTotal],
    [0, 1500, 1000, 2500]
  );
});

test('SISP-33: two payments in order equal one payment of the same total; derivation is deterministic', () => {
  const two = fifoCustomer([payment('p1', { amount: 3000 }), payment('p2', { amount: 1500 })]);
  const bill10 = currentBillOf(two);
  const first = fifoAllocationForPayment(two, bill10, 'p1');
  assert.deepEqual([first.allocation.toArrears, first.remaining.arrears], [3000, 0]);
  const second = fifoAllocationForPayment(two, bill10, 'p2');
  assert.deepEqual([second.allocation.toPackage, second.remaining.package, second.remaining.kist], [1500, 1500, 1000]);
  const once = allocateFifoForBill(two, bill10);
  const twice = allocateFifoForBill(two, bill10);
  assert.deepEqual(once, twice);
});

test('SISP-33: toggle flag on the second payment reorders only that payment', () => {
  const customer = fifoCustomer([
    payment('p1', { amount: 3000 }),
    payment('p2', { amount: 1500, fifoPrioritizeKistFirst: true })
  ]);
  const bill10 = currentBillOf(customer);
  const second = fifoAllocationForPayment(customer, bill10, 'p2');
  assert.deepEqual([second.allocation.toKist, second.allocation.toPackage], [1000, 500]);
  assert.deepEqual([second.remaining.package, second.remaining.kist], [2500, 0]);
});

test('SISP-33: a discount waives balance like cash in the split', () => {
  const customer = fifoCustomer([payment('p1', { amount: 4000, discount: 500 })]);
  const fifo = fifoAllocationForPayment(customer, currentBillOf(customer), 'p1');
  assert.deepEqual([fifo.allocation.toArrears, fifo.allocation.toPackage, fifo.remaining.package], [3000, 1500, 1500]);
});

test('SISP-33: unpriced bills carry no split; package-only bills hide the block', () => {
  const unpriced = fifoCustomer([payment('p1', { amount: 1000 })]);
  const unpricedBill = currentBillOf(unpriced);
  unpricedBill.dueAmount = null;
  assert.equal(fifoBillContext(unpriced, unpricedBill), null);
  assert.equal(fifoAllocationForPayment(unpriced, unpricedBill, 'p1'), null);

  const plain = {
    id: 'cust-2', customerNumber: 8, name: 'Plain', archived: false, billingStartMonth: null,
    monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
    installmentPlans: [],
    bills: [bill('2026-10', { dueAmount: 3000, priceSnapshot: 3000, payments: [payment('p9', { amount: 1000 })] })]
  };
  const plainBill = plain.bills[0];
  const plainFifo = fifoAllocationForPayment(plain, plainBill, 'p9');
  assert.equal(plainFifo.allocation.toPackage, 1000);
  assert.equal(plainFifo.show, false);
});

test('SISP-33: receipts carry the split and render it in all three layouts', () => {
  const customer = fifoCustomer([payment('p1', { amount: 4500 })]);
  const bill10 = currentBillOf(customer);
  const receipt = buildPaymentReceipt(customer, bill10, bill10.payments[0]);
  assert.deepEqual(
    [receipt.fifoAllocation.toArrears, receipt.fifoAllocation.toPackage, receipt.fifoAllocation.toKist],
    [3000, 1500, 0]
  );
  assert.deepEqual(
    [receipt.fifoRemaining.arrears, receipt.fifoRemaining.package, receipt.fifoRemaining.kist],
    [0, 1500, 1000]
  );
  assert.equal(receipt.fifoShow, true);
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.match(html, /Baqi Sabiqa Baqaya/);
    assert.match(html, /Baqi Mahana Bill/);
    assert.match(html, /Baqi Kist/);
    assert.match(html, /PKR 1,500/);
  }
  const plainReceipt = buildPaymentReceipt(
    { id: 'cust-2', customerNumber: 8, name: 'Plain', archived: false, billingStartMonth: null, monthlyPriceSchedule: [], installmentPlans: [], bills: [] },
    bill('2026-10', { dueAmount: 3000, priceSnapshot: 3000, payments: [payment('p9', { amount: 1000 })] }),
    payment('p9', { amount: 1000 })
  );
  assert.equal(plainReceipt.fifoShow, false);
  assert.doesNotMatch(generatePaymentReceiptHtml(plainReceipt, { format: 'a4' }), /Baqi Sabiqa Baqaya/);
});

test('SISP-33: profile current-bill presentation carries the remaining split', () => {
  const customer = fifoCustomer([payment('p1', { amount: 4500 })]);
  const allocations = calculatePaymentAllocations({ customers: [customer] });
  const summary = currentBillPresentation(customer, '2026-10', allocations);
  assert.deepEqual(
    [summary.fifo.remainingArrears, summary.fifo.remainingPackage, summary.fifo.remainingKist],
    [0, 1500, 1000]
  );
  assert.equal(summary.fifo.show, true);
});

test('SISP-33: WhatsApp drafts include the split only when the receipt carries it', () => {
  const withFifo = createReceiptWhatsAppDraft('+923001234567', {
    customerName: 'FIFO Customer', customerNumber: 7, amount: 4500, method: 'Cash',
    date: '2026-10-06', month: '2026-10', billAmount: 4000, balanceDueCents: 250000, billStatus: 'partial',
    fifoAllocation: { toArrears: 3000, toPackage: 1500, toKist: 0 },
    fifoRemaining: { arrears: 0, package: 1500, kist: 1000 },
    fifoShow: true
  });
  assert.match(withFifo.message, /FIFO taqseem/);
  assert.match(withFifo.message, /Baqi Sabiqa Baqaya: PKR 0/);
  assert.match(withFifo.message, /Baqi Kist: PKR 1,000/);
  const withoutFifo = createReceiptWhatsAppDraft('+923001234567', {
    customerName: 'FIFO Customer', customerNumber: 7, amount: 4500, method: 'Cash',
    date: '2026-10-06', month: '2026-10', billAmount: 4000, balanceDueCents: 250000, billStatus: 'partial'
  });
  assert.doesNotMatch(withoutFifo.message, /FIFO taqseem/);
  assert.deepEqual(fifoTextLines(
    { toArrears: 3000, toPackage: 1500, toKist: 0 },
    { arrears: 0, package: 1500, kist: 1000 }
  ).length, 2);
});

test('SISP-33: covered-kist plans advance one month, capped by months billed', () => {
  const advanced = advancePlansForCoveredKist([plan({ monthsBilled: 1, monthsPaid: 0 })], new Set(['plan-1']));
  assert.equal(advanced[0].monthsPaid, 1);
  const capped = advancePlansForCoveredKist([plan({ monthsBilled: 1, monthsPaid: 1 })], new Set(['plan-1']));
  assert.equal(capped[0].monthsPaid, 1);
  const untouched = advancePlansForCoveredKist([plan({ monthsBilled: 1, monthsPaid: 0 })], new Set(['other-plan']));
  assert.equal(untouched[0].monthsPaid, 0);
  const empty = advancePlansForCoveredKist([plan({ monthsBilled: 1, monthsPaid: 0 })], new Set());
  assert.equal(empty[0].monthsPaid, 0);
});

test('SISP-33: payment-event hook records the toggle, bumps monthsPaid once, and is idempotent', () => {
  const state = { customers: [fifoCustomer([payment('p1', { amount: 4500 })])] };
  const once = applyFifoPaymentEventToState(state, 'cust-1', '2026-10', 'p1', { prioritizeKistFirst: true });
  const paidCustomer = once.customers[0];
  const paid = paidCustomer.bills.find((row) => row.month === '2026-10').payments[0];
  assert.equal(paid.fifoPrioritizeKistFirst, true);
  assert.equal(paid.fifoEventApplied, true);
  assert.equal(paid.fifoKistBumpApplied, true);
  assert.equal(paidCustomer.installmentPlans[0].monthsPaid, 1);
  const twice = applyFifoPaymentEventToState(once, 'cust-1', '2026-10', 'p1', { prioritizeKistFirst: true });
  assert.deepEqual(twice, once);

  const defaultState = { customers: [fifoCustomer([payment('p1', { amount: 4500 })])] };
  const defaulted = applyFifoPaymentEventToState(defaultState, 'cust-1', '2026-10', 'p1', { prioritizeKistFirst: false });
  const defaultPaid = defaulted.customers[0].bills.find((row) => row.month === '2026-10').payments[0];
  assert.equal(defaultPaid.fifoPrioritizeKistFirst, undefined);
  assert.equal(defaultPaid.fifoEventApplied, true);
  assert.equal(defaultPaid.fifoKistBumpApplied, undefined);
  assert.equal(defaulted.customers[0].installmentPlans[0].monthsPaid, 0);

  const missing = applyFifoPaymentEventToState(state, 'cust-1', '2026-10', 'no-such-payment', { prioritizeKistFirst: true });
  assert.deepEqual(missing, state);
});
