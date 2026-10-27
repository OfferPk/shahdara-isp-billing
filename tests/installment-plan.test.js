// SISP-4: Hardware & Wire Installment (Kist / EMI) Auto-Billing Engine.
// Pure-function tests on synthetic data only.
// Spec test criterion (verbatim): creating a Rs. 3,000 router plan
// (3 x Rs. 1,000) adds exactly Rs. 1,000 to the next 3 monthly snapshots
// and automatically marks status "completed" after the 3rd cycle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBillingCycle,
  arrearsBreakdownTextLines,
  buildArrearsBreakdown,
  planBillingCycle,
  planCustomerCycleLine,
  runBillingCycle
} from '../billing-cycle.js';
import {
  advancePlansForBilledLines,
  buildKistProgress,
  createInstallmentPlan,
  dueKistLines,
  kistLineLabel,
  sanitizeBillKistLines,
  sanitizeInstallmentPlans
} from '../installment-plan.js';

const bill = (month, overrides) => ({ id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [], ...overrides });
const customer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  bills: [], ...overrides
});
const kistCustomer = (overrides = {}) => customer('c1', 11, 'CH BILAL', {
  installmentPlans: [createInstallmentPlan({ itemTitle: 'Tenda F3 Router', totalAmount: 3000, downPayment: 0, totalMonths: 3 })],
  ...overrides
});

test('createInstallmentPlan validates and auto-splits the monthly kist', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Tenda F3 Router + 120m Fiber', totalAmount: 3000, totalMonths: 3 });
  assert.equal(plan.monthlyKist, 1000);
  assert.equal(plan.monthsBilled, 0);
  assert.equal(plan.status, 'active');
  assert.throws(() => createInstallmentPlan({ itemTitle: 'Router', totalAmount: 3000, totalMonths: 1 }), /between 2 and 6/);
  assert.throws(() => createInstallmentPlan({ itemTitle: 'Router', totalAmount: 3000, totalMonths: 7 }), /between 2 and 6/);
  assert.throws(() => createInstallmentPlan({ itemTitle: 'Router', totalAmount: 3000, downPayment: 3000, totalMonths: 3 }), /less than the total/);
  assert.throws(() => createInstallmentPlan({ itemTitle: '', totalAmount: 3000, totalMonths: 3 }), /what the installment is for/);
  const withDown = createInstallmentPlan({ itemTitle: 'ONU', totalAmount: 5000, downPayment: 2000, totalMonths: 3 });
  assert.equal(withDown.monthlyKist, 1000);
});

test('old customers without installmentPlans keep working (backward compatible)', () => {
  const c = customer('c9', 99, 'OLD CUSTOMER');
  assert.deepEqual(dueKistLines(c, '2026-10'), []);
  assert.deepEqual(sanitizeInstallmentPlans(undefined), []);
  assert.deepEqual(sanitizeInstallmentPlans(c.installmentPlans), []);
  const line = planCustomerCycleLine(c, '2026-10');
  assert.equal(line.skipped, false);
  assert.equal(line.kistAmount, 0);
  assert.deepEqual(line.kistLines, []);
});

test('spec criterion verbatim: Rs. 3,000 router plan (3 x Rs. 1,000) bills Rs. 1,000 for 3 cycles, then completes', () => {
  let state = { customers: [kistCustomer()] };
  let cycles = [];
  const months = ['2026-10', '2026-11', '2026-12'];
  months.forEach((month, index) => {
    const { state: nextState, cycle } = runBillingCycle(state, month, cycles, new Date(`${month}-05T00:00:00Z`));
    state = nextState;
    cycles = [...cycles, cycle];
    const c = state.customers[0];
    const monthBill = c.bills.find((row) => row.month === month);
    // Package Rs. 3,000 + exactly one kist of Rs. 1,000 — never more.
    assert.equal(monthBill.dueAmount, 4000);
    assert.equal(monthBill.priceSnapshot, 3000);
    assert.equal(monthBill.kistTotal, 1000);
    assert.equal(monthBill.kistLines.length, 1);
    assert.equal(monthBill.kistLines[0].installmentNumber, index + 1);
    assert.equal(monthBill.kistLines[0].totalMonths, 3);
    assert.equal(monthBill.kistLines[0].amount, 1000);
    assert.equal(kistLineLabel(monthBill.kistLines[0]), 'Kist 1/3: Tenda F3 Router'.replace('1/3', `${index + 1}/3`));
    assert.equal(c.installmentPlans[0].monthsBilled, index + 1);
    assert.equal(c.installmentPlans[0].status, index === 2 ? 'completed' : 'active');
  });
  // A 4th cycle bills no kist: the plan is completed, the bill is package-only.
  const { state: finalState } = runBillingCycle(state, '2027-01', cycles, new Date('2027-01-05T00:00:00Z'));
  const january = finalState.customers[0].bills.find((row) => row.month === '2027-01');
  assert.equal(january.dueAmount, 3000);
  assert.equal(january.kistTotal, 0);
  assert.deepEqual(january.kistLines, []);
});

test('cycle adopts an existing auto-generated bill and appends kist exactly once', () => {
  const c = kistCustomer({ bills: [bill('2026-10')] });
  const { state: once } = applyBillingCycle({ customers: [c] }, '2026-10', new Date('2026-10-05T00:00:00Z'));
  const first = once.customers[0].bills.find((row) => row.month === '2026-10');
  assert.equal(first.dueAmount, 4000);
  assert.equal(first.kistTotal, 1000);
  assert.equal(first.priceSnapshot, 3000);
  assert.equal(once.customers[0].installmentPlans[0].monthsBilled, 1);
  // Re-applying the same month must not bill the next installment into it.
  const { state: twice } = applyBillingCycle(once, '2026-10', new Date('2026-10-05T00:00:00Z'));
  const second = twice.customers[0].bills.find((row) => row.month === '2026-10');
  assert.equal(second.dueAmount, 4000);
  assert.equal(second.kistLines.length, 1);
  assert.equal(twice.customers[0].installmentPlans[0].monthsBilled, 1);
  // And the plan preview for that month no longer shows new kist.
  const line = planCustomerCycleLine(twice.customers[0], '2026-10');
  assert.deepEqual(line.kistLines, []);
  assert.equal(line.kistAmount, 1000);
  assert.equal(line.currentMonthBill, 3000);
});

test('plans starting in a future month are not billed early', () => {
  const c = kistCustomer({
    installmentPlans: [createInstallmentPlan({ itemTitle: 'Fiber Wire', totalAmount: 2000, totalMonths: 2, startDate: '2026-11-15' })]
  });
  assert.deepEqual(dueKistLines(c, '2026-10'), []);
  assert.equal(dueKistLines(c, '2026-11').length, 1);
  assert.equal(dueKistLines(c, '2026-11')[0].amount, 1000);
});

test('cycle totals include kist and the receipt breakdown splits package from kist', () => {
  const { plan } = applyBillingCycle({ customers: [kistCustomer()] }, '2026-10', new Date('2026-10-05T00:00:00Z'));
  assert.equal(plan.totals.totalKist, 1000);
  assert.equal(plan.totals.totalBilled, 3000);
  const { state } = applyBillingCycle({ customers: [kistCustomer()] }, '2026-10', new Date('2026-10-05T00:00:00Z'));
  const c = state.customers[0];
  const monthBill = c.bills.find((row) => row.month === '2026-10');
  const breakdown = buildArrearsBreakdown(c, monthBill);
  assert.equal(breakdown.packageAmount, 3000);
  assert.equal(breakdown.kistAmount, 1000);
  assert.equal(breakdown.totalDue, 4000);
  const lines = arrearsBreakdownTextLines(breakdown);
  assert.ok(lines.some((row) => row.startsWith('Kist (installments this month):')));
  assert.ok(lines.some((row) => row.includes('Kist 1/3: Tenda F3 Router')));
  assert.ok(lines.some((row) => row.startsWith('Mahana Package:')));
});

test('kist progress: paid counts only settled bill months, remaining falls as installments settle', () => {
  const c = kistCustomer({
    bills: [
      bill('2026-10', { dueAmount: 4000, kistLines: [{ planId: 'p1', installmentNumber: 1, totalMonths: 3, amount: 1000, itemTitle: 'Tenda F3 Router' }], kistTotal: 1000, payments: [{ id: 'pay1', date: '2026-10-03', amount: 4000, method: 'Cash' }] })
    ],
    installmentPlans: [{ id: 'p1', itemTitle: 'Tenda F3 Router', totalAmount: 3000, downPayment: 0, monthlyKist: 1000, totalMonths: 3, monthsBilled: 1, monthsPaid: 0, startDate: null, status: 'active' }]
  });
  const allocations = {
    forMonth: (customerId, month) => (month === '2026-10' ? { balanceDueCents: 0 } : { balanceDueCents: 400000 })
  };
  const progress = buildKistProgress(c, allocations);
  assert.equal(progress.plans[0].monthsPaid, 1);
  assert.equal(progress.plans[0].percentPaid, 33);
  assert.equal(progress.plans[0].remainingAmount, 2000);
  assert.equal(progress.totals.totalRemaining, 2000);
  // Without allocations the stored monthsPaid is the fallback.
  assert.equal(buildKistProgress(c).plans[0].monthsPaid, 0);
});

test('sanitize drops malformed plans and dedupes bill kist lines', () => {
  assert.deepEqual(sanitizeInstallmentPlans([
    { id: 'p1', itemTitle: 'Router', totalAmount: 3000, downPayment: 0, monthlyKist: 1000, totalMonths: 3, monthsBilled: 5, monthsPaid: 9, startDate: 'not-a-date', status: 'active' },
    { id: 'p1', itemTitle: 'Duplicate', totalAmount: 3000, downPayment: 0, monthlyKist: 1000, totalMonths: 3, monthsBilled: 0, monthsPaid: 0, startDate: null, status: 'active' },
    { itemTitle: 'No id', totalAmount: 3000, downPayment: 0, monthlyKist: 1000, totalMonths: 3 }
  ]).map((plan) => [plan.monthsBilled, plan.monthsPaid, plan.status, plan.startDate]), [[3, 3, 'completed', null]]);
  assert.equal(sanitizeBillKistLines([
    { planId: 'p1', installmentNumber: 1, totalMonths: 3, amount: 1000, itemTitle: 'Router' },
    { planId: 'p1', installmentNumber: 1, totalMonths: 3, amount: 1000, itemTitle: 'Router' },
    { planId: 'p1', installmentNumber: 0, totalMonths: 3, amount: 1000 }
  ]).length, 1);
  // advancePlansForBilledLines completes a plan on its final billed line.
  const advanced = advancePlansForBilledLines(
    [{ id: 'p1', itemTitle: 'Router', totalAmount: 3000, downPayment: 0, monthlyKist: 1000, totalMonths: 3, monthsBilled: 2, monthsPaid: 0, startDate: null, status: 'active' }],
    [{ planId: 'p1', installmentNumber: 3, totalMonths: 3, amount: 1000 }]
  );
  assert.equal(advanced[0].monthsBilled, 3);
  assert.equal(advanced[0].status, 'completed');
});

test('kist plans do not touch the one-time new-customer fields', () => {
  const c = kistCustomer({ connectionFee: 1500, routerModel: 'Tenda F3', routerPrice: 3200, fiberMeters: 120 });
  const { state } = applyBillingCycle({ customers: [c] }, '2026-10', new Date('2026-10-05T00:00:00Z'));
  const next = state.customers[0];
  assert.equal(next.connectionFee, 1500);
  assert.equal(next.routerModel, 'Tenda F3');
  assert.equal(next.routerPrice, 3200);
  assert.equal(next.fiberMeters, 120);
  assert.equal(next.installmentPlans[0].monthsBilled, 1);
});

test('planBillingCycle skips archived customers (no kist for them either)', () => {
  const plan = planBillingCycle({ customers: [kistCustomer({ archived: true })] }, '2026-10');
  assert.equal(plan.lines.length, 0);
  assert.equal(plan.totals.totalKist, 0);
});
