// SISP-29: Installment (Kist) Early Payoff, Down-Payment Receipt & Ledger Sync.
// Pure-function tests on synthetic data only.
//
// PINNED TEST CRITERION (verbatim): exercising Early Payoff on a 3-month
// plan after 1 billed month collects the remaining 2 months' balance,
// marks the plan completed, and ensures the next SISP-2 billing cycle adds
// Rs. 0 kist for that plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyBillingCycle } from '../billing-cycle.js';
import {
  buildKistProgress,
  createInstallmentPlan,
  dueKistLines,
  earlyPayoffAmount,
  kistSchedule,
  sanitizeInstallmentPlan,
  sanitizeInstallmentPlans,
  settlePlanEarly
} from '../installment-plan.js';
import {
  buildDownPaymentKistReceipt,
  buildDownPaymentKistReceiptHtml
} from '../receipt.js';
import { kistSettlementPresentation } from '../profile-ui.js';

const bill = (month, overrides) => ({ id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [], ...overrides });
const customer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  bills: [], ...overrides
});
const kistCustomer = (overrides = {}) => customer('c1', 11, 'Test Customer 11', {
  installmentPlans: [createInstallmentPlan({ itemTitle: 'Tenda F3 Router', totalAmount: 3000, downPayment: 0, totalMonths: 3 })],
  ...overrides
});

test('PINNED: early payoff after 1 billed month collects 2 months, completes the plan, next cycle adds Rs 0 kist', () => {
  const first = applyBillingCycle({ customers: [kistCustomer()] }, '2026-10', new Date('2026-10-05T00:00:00Z'));
  const afterFirst = first.state.customers[0];
  assert.equal(afterFirst.installmentPlans[0].monthsBilled, 1);
  assert.equal(afterFirst.bills.find((row) => row.month === '2026-10').kistTotal, 1000);

  const planId = afterFirst.installmentPlans[0].id;
  assert.equal(earlyPayoffAmount(afterFirst.installmentPlans[0]), 2000);

  const settled = settlePlanEarly(afterFirst.installmentPlans, planId, { date: '2026-10-20' });
  assert.equal(settled[0].monthsBilled, 3);
  assert.equal(settled[0].monthsPaid, 3);
  assert.equal(settled[0].status, 'completed');
  assert.equal(settled[0].payoffAmount, 2000);
  assert.equal(settled[0].payoffDate, '2026-10-20');

  const settledCustomer = { ...afterFirst, installmentPlans: settled };
  assert.deepEqual(dueKistLines(settledCustomer, '2026-11'), []);

  const second = applyBillingCycle({ customers: [settledCustomer] }, '2026-11', new Date('2026-11-05T00:00:00Z'));
  const line = second.plan.lines.find((row) => row.customerId === 'c1');
  assert.equal(line.kistNewAmount, 0);
  assert.deepEqual(line.kistLines, []);
  const newBill = second.state.customers[0].bills.find((row) => row.month === '2026-11');
  assert.deepEqual(newBill.kistLines, []);
  assert.equal(newBill.kistTotal, 0);
  assert.equal(second.state.customers[0].installmentPlans[0].status, 'completed');
});

test('earlyPayoffAmount follows total - down payment - billed so far, and is 0 once completed', () => {
  const plan = createInstallmentPlan({ itemTitle: 'ONU', totalAmount: 5000, downPayment: 2000, totalMonths: 3 });
  assert.equal(earlyPayoffAmount(plan), 3000);
  const billedOnce = { ...plan, monthsBilled: 1 };
  assert.equal(earlyPayoffAmount(billedOnce), 2000);
  const done = { ...plan, monthsBilled: 3 };
  assert.equal(earlyPayoffAmount(done), 0);
  assert.equal(earlyPayoffAmount(null), 0);
  assert.equal(earlyPayoffAmount({ itemTitle: '', totalAmount: -5 }), 0);
});

test('settlePlanEarly only settles the matching active plan and records the payoff audit fields', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Router', totalAmount: 3000, downPayment: 0, totalMonths: 3 });
  const other = createInstallmentPlan({ itemTitle: 'ONU', totalAmount: 2000, downPayment: 0, totalMonths: 2 });
  const settled = settlePlanEarly([plan, other], plan.id, { date: '2026-10-20' });
  assert.equal(settled[0].status, 'completed');
  assert.equal(settled[0].payoffAmount, 3000);
  assert.equal(settled[0].payoffDate, '2026-10-20');
  assert.equal(settled[1].status, 'active');
  assert.equal(settled[1].payoffAmount, null);

  const alreadyDone = settlePlanEarly(settled, plan.id, { date: '2026-10-21' });
  assert.equal(alreadyDone[0].payoffDate, '2026-10-20');

  const unknown = settlePlanEarly([plan], 'no-such-plan', { date: '2026-10-20' });
  assert.equal(unknown[0].status, 'active');
  assert.equal(unknown[0].payoffAmount, null);

  const badDate = settlePlanEarly([plan], plan.id, { date: 'not-a-date' });
  assert.equal(badDate[0].status, 'completed');
  assert.equal(badDate[0].payoffDate, null);
  assert.equal(badDate[0].payoffAmount, 3000);

  assert.deepEqual(settlePlanEarly(undefined, plan.id), []);
});

test('sanitize preserves payoff fields, drops invalid ones, and old plans stay payoff-free', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Router', totalAmount: 3000, downPayment: 0, totalMonths: 3 });
  const kept = sanitizeInstallmentPlan({ ...plan, payoffAmount: 2000, payoffDate: '2026-10-20' });
  assert.equal(kept.payoffAmount, 2000);
  assert.equal(kept.payoffDate, '2026-10-20');
  const dropped = sanitizeInstallmentPlan({ ...plan, payoffAmount: -5, payoffDate: '2026-13-40' });
  assert.equal(dropped.payoffAmount, null);
  assert.equal(dropped.payoffDate, null);
  const old = sanitizeInstallmentPlan(plan);
  assert.equal(old.payoffAmount, null);
  assert.equal(old.payoffDate, null);
  assert.equal(sanitizeInstallmentPlans([plan, { ...plan, id: 'other-id', payoffAmount: 100 }]).length, 2);
});

test('buildKistProgress treats a settled-early plan as paid in full with Rs 0 remaining', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Router', totalAmount: 3000, downPayment: 0, totalMonths: 3 });
  const settled = settlePlanEarly([plan], plan.id, { date: '2026-10-20' })[0];
  const c = kistCustomer({ installmentPlans: [settled] });
  // Allocations stub claims nothing is settled: without the payoff
  // override, monthsPaid would derive to 0 and remaining to Rs 3,000.
  const allocations = { forMonth: () => ({ balanceDueCents: 5000 }) };
  const progress = buildKistProgress(c, allocations);
  assert.equal(progress.plans[0].monthsPaid, 3);
  assert.equal(progress.plans[0].remainingAmount, 0);
  assert.equal(progress.plans[0].percentPaid, 100);
  assert.equal(progress.totals.totalRemaining, 0);

  const unbilled = buildKistProgress(kistCustomer(), allocations);
  assert.equal(unbilled.plans[0].monthsPaid, 0);
  assert.equal(unbilled.plans[0].remainingAmount, 3000);
});

test('kistSchedule mirrors cycle billing: monthly kist per row, billed/remaining by monthsBilled', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Router', totalAmount: 3000, downPayment: 0, totalMonths: 3 });
  assert.deepEqual(kistSchedule(plan).map((row) => [row.installmentNumber, row.amount, row.status]), [
    [1, 1000, 'remaining'], [2, 1000, 'remaining'], [3, 1000, 'remaining']
  ]);
  const billedOnce = kistSchedule({ ...plan, monthsBilled: 1 });
  assert.deepEqual(billedOnce.map((row) => row.status), ['billed', 'remaining', 'remaining']);
  // Rounding case: the cycle bills monthlyKist every month, so the
  // schedule rows are monthlyKist (the payoff formula reconciles the
  // remainder at settlement instead of rewriting cycle math).
  const rounding = createInstallmentPlan({ itemTitle: 'Fiber', totalAmount: 10000, downPayment: 0, totalMonths: 3 });
  assert.equal(rounding.monthlyKist, 3333.33);
  assert.deepEqual(kistSchedule(rounding).map((row) => row.amount), [3333.33, 3333.33, 3333.33]);
  assert.equal(earlyPayoffAmount({ ...rounding, monthsBilled: 1 }), 6666.67);
  assert.deepEqual(kistSchedule(null), []);
  assert.deepEqual(kistSchedule({ itemTitle: '', totalAmount: 0 }), []);
});

test('down-payment receipt snapshot carries the payment, plan totals and schedule', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Tenda F3 Router', totalAmount: 5000, downPayment: 2000, totalMonths: 3 });
  const payment = { id: 'pay-1', amount: 2000, date: '2026-10-20', method: 'Cash' };
  const receipt = buildDownPaymentKistReceipt(kistCustomer(), plan, payment);
  assert.equal(receipt.customerName, 'Test Customer 11');
  assert.equal(receipt.customerId, '11');
  assert.match(receipt.receiptNumber, /^REC-/);
  assert.equal(receipt.paymentDate, '2026-10-20');
  assert.equal(receipt.paymentMethod, 'Cash');
  assert.equal(receipt.itemTitle, 'Tenda F3 Router');
  assert.equal(receipt.totalAmount, 5000);
  assert.equal(receipt.downPayment, 2000);
  assert.equal(receipt.paidDownPayment, 2000);
  assert.equal(receipt.monthlyKist, 1000);
  assert.equal(receipt.totalMonths, 3);
  assert.equal(receipt.remainingAfterDownPayment, 3000);
  assert.equal(receipt.schedule.length, 3);

  const html = buildDownPaymentKistReceiptHtml(receipt, { businessName: 'Shahdara ISP' });
  assert.match(html, /Tenda F3 Router/);
  assert.match(html, /PKR 2,000/);
  assert.match(html, /Kist 1\/3/);
  assert.match(html, /Kist 3\/3/);

  assert.throws(() => buildDownPaymentKistReceipt(kistCustomer(), plan, { amount: 0, date: '2026-10-20', method: 'Cash' }), /valid down payment/);
  assert.throws(() => buildDownPaymentKistReceipt(kistCustomer(), null, payment), /customer, installment plan/);
  assert.equal(buildDownPaymentKistReceiptHtml(null), '');
});

test('kistSettlementPresentation gates the payoff button and labels settled plans', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Router', totalAmount: 3000, downPayment: 0, totalMonths: 3 });
  const active = kistSettlementPresentation({ ...plan, monthsBilled: 1 });
  assert.equal(active.canPayoff, true);
  assert.equal(active.payoffAmount, 2000);
  assert.match(active.payoffLabel, /Early payoff/);
  assert.equal(active.settledEarly, false);

  const settled = settlePlanEarly([plan], plan.id, { date: '2026-10-20' })[0];
  const done = kistSettlementPresentation(settled);
  assert.equal(done.canPayoff, false);
  assert.equal(done.payoffAmount, 0);
  assert.equal(done.settledEarly, true);
  assert.match(done.settledLabel, /Settled early/);
  assert.match(done.settledLabel, /2026-10-20/);

  const invalid = kistSettlementPresentation(null);
  assert.equal(invalid.canPayoff, false);
  assert.equal(invalid.payoffAmount, 0);
});
