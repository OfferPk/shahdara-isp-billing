// Plan N: Payment completion flows — kist payoff is a payment or an
// explicit waiver (never a silent close), and a profile partial payment
// can stamp a remainder Waada exactly as Quick Collect does.
// Pure-function tests on synthetic data only; app.js wiring is not
// imported by unit tests (see Plan K precedent), so the UI paths are
// pinned here through the pure functions the UI calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKistProgress,
  createInstallmentPlan,
  earlyPayoffAmount,
  sanitizeInstallmentPlan,
  settlePlanEarly,
  validatePayoffChoice
} from '../installment-plan.js';
import { kistSettlementPresentation } from '../profile-ui.js';
import {
  REMAINDER_WAADA_NOTE,
  computeRemainderWaada,
  remainderWaadaChipDates,
  remainderWaadaOf,
  stampRemainderWaada
} from '../waada-queue.js';

const plan = (overrides = {}) => createInstallmentPlan({
  itemTitle: 'Tenda F3 Router', totalAmount: 3000, downPayment: 0, totalMonths: 3, ...overrides
});
const billedOnce = { ...plan(), monthsBilled: 1 };

// ---- Payoff choice validation ----

test('validatePayoffChoice accepts a payment path and a waiver with a reason', () => {
  assert.equal(validatePayoffChoice({ method: 'payment' }), null);
  assert.equal(validatePayoffChoice({ method: 'waiver', reason: 'Owner concession' }), null);
});

test('validatePayoffChoice rejects a blank waiver reason and unknown methods', () => {
  assert.match(validatePayoffChoice({ method: 'waiver', reason: '' }), /reason/);
  assert.match(validatePayoffChoice({ method: 'waiver', reason: '   ' }), /reason/);
  assert.match(validatePayoffChoice({ method: 'waiver' }), /reason/);
  assert.match(validatePayoffChoice({ method: 'close' }), /payment|waive/);
  assert.match(validatePayoffChoice({}), /payment|waive/);
  assert.match(validatePayoffChoice(null), /payment|waive/);
});

// ---- Payoff settlement recording ----

test('settlePlanEarly with a payment records method and payment id, and completes the plan', () => {
  const settled = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20', method: 'payment', paymentId: 'pay-9' })[0];
  assert.equal(settled.status, 'completed');
  assert.equal(settled.monthsBilled, 3);
  assert.equal(settled.monthsPaid, 3);
  assert.equal(settled.payoffAmount, 2000);
  assert.equal(settled.payoffDate, '2026-10-20');
  assert.equal(settled.payoffMethod, 'payment');
  assert.equal(settled.payoffPaymentId, 'pay-9');
  assert.equal(settled.payoffReason, null);
});

test('settlePlanEarly with a waiver records method and reason, and no payment id', () => {
  const settled = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20', method: 'waiver', reason: 'Device returned' })[0];
  assert.equal(settled.status, 'completed');
  assert.equal(settled.payoffMethod, 'waiver');
  assert.equal(settled.payoffReason, 'Device returned');
  assert.equal(settled.payoffPaymentId, null);
});

test('settlePlanEarly with a waiver but no reason settles nothing', () => {
  const result = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20', method: 'waiver', reason: '' });
  assert.equal(result[0].status, 'active');
  assert.equal(result[0].monthsBilled, 1);
  assert.equal(result[0].payoffMethod, null);
});

test('settlePlanEarly with an unknown method settles nothing', () => {
  const result = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20', method: 'close' });
  assert.equal(result[0].status, 'active');
  assert.equal(result[0].payoffAmount, null);
});

test('settlePlanEarly without a method keeps the pre-Plan-N behaviour (settles, no method)', () => {
  const settled = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20' })[0];
  assert.equal(settled.status, 'completed');
  assert.equal(settled.payoffAmount, 2000);
  assert.equal(settled.payoffMethod, null);
});

test('settlePlanEarly payment path still refuses completed plans and unknown ids', () => {
  const done = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20', method: 'payment', paymentId: 'pay-1' })[0];
  const again = settlePlanEarly([done], done.id, { date: '2026-10-21', method: 'waiver', reason: 'Second try' });
  assert.equal(again[0].payoffMethod, 'payment');
  assert.equal(again[0].payoffDate, '2026-10-20');
  const unknown = settlePlanEarly([billedOnce], 'no-such-plan', { date: '2026-10-20', method: 'payment', paymentId: 'pay-1' });
  assert.equal(unknown[0].status, 'active');
});

test('settlePlanEarly settles only the matching plan on either path', () => {
  const other = plan({ itemTitle: 'ONU' });
  const result = settlePlanEarly([billedOnce, other], billedOnce.id, { date: '2026-10-20', method: 'waiver', reason: 'Goodwill' });
  assert.equal(result[0].status, 'completed');
  assert.equal(result[1].status, 'active');
  assert.equal(result[1].payoffMethod, null);
});

test('payoff amount follows the billed-so-far formula on both paths', () => {
  assert.equal(earlyPayoffAmount(billedOnce), 2000);
  const unbilled = plan();
  const settled = settlePlanEarly([unbilled], unbilled.id, { date: '2026-10-20', method: 'payment', paymentId: 'pay-2' })[0];
  assert.equal(settled.payoffAmount, 3000);
});

// ---- Sanitize round-trip for the new fields ----

test('sanitize preserves payoff method, reason and payment id, and drops invalid ones', () => {
  const kept = sanitizeInstallmentPlan({ ...plan(), payoffAmount: 2000, payoffDate: '2026-10-20', payoffMethod: 'waiver', payoffReason: '  Goodwill gesture  ', payoffPaymentId: 'pay-3' });
  assert.equal(kept.payoffMethod, 'waiver');
  assert.equal(kept.payoffReason, 'Goodwill gesture');
  assert.equal(kept.payoffPaymentId, 'pay-3');
  const dropped = sanitizeInstallmentPlan({ ...plan(), payoffAmount: 2000, payoffDate: '2026-10-20', payoffMethod: 'close', payoffReason: '', payoffPaymentId: '' });
  assert.equal(dropped.payoffMethod, null);
  assert.equal(dropped.payoffReason, null);
  assert.equal(dropped.payoffPaymentId, null);
  const old = sanitizeInstallmentPlan(plan());
  assert.equal(old.payoffMethod, null);
  assert.equal(old.payoffReason, null);
  assert.equal(old.payoffPaymentId, null);
});

test('sanitize trims a long waiver reason to the stored cap', () => {
  const kept = sanitizeInstallmentPlan({ ...plan(), payoffMethod: 'waiver', payoffReason: 'x'.repeat(500) });
  assert.equal(kept.payoffReason.length, 200);
});

test('a waived plan still counts as settled-early: Rs 0 remaining, completed', () => {
  const settled = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20', method: 'waiver', reason: 'Goodwill' })[0];
  const customer = { id: 'c1', customerNumber: 11, name: 'Test', bills: [], installmentPlans: [settled] };
  const progress = buildKistProgress(customer, { forMonth: () => ({ balanceDueCents: 5000 }) });
  assert.equal(progress.plans[0].remainingAmount, 0);
  assert.equal(progress.plans[0].percentPaid, 100);
  assert.equal(progress.totals.totalRemaining, 0);
});

// ---- Settled-plan presentation ----

test('kistSettlementPresentation labels a waived settlement with its reason', () => {
  const settled = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20', method: 'waiver', reason: 'Device returned' })[0];
  const done = kistSettlementPresentation(settled);
  assert.equal(done.canPayoff, false);
  assert.equal(done.settledEarly, true);
  assert.equal(done.settledMethod, 'waiver');
  assert.equal(done.settledReason, 'Device returned');
  assert.match(done.settledLabel, /waived/i);
  assert.match(done.settledLabel, /Device returned/);
  assert.match(done.settledLabel, /2026-10-20/);
});

test('kistSettlementPresentation keeps the existing label for a paid settlement', () => {
  const settled = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20', method: 'payment', paymentId: 'pay-4' })[0];
  const done = kistSettlementPresentation(settled);
  assert.equal(done.settledMethod, 'payment');
  assert.match(done.settledLabel, /Settled early/);
  assert.doesNotMatch(done.settledLabel, /waived/i);
});

test('kistSettlementPresentation keeps the legacy label when no method is on record', () => {
  const settled = settlePlanEarly([billedOnce], billedOnce.id, { date: '2026-10-20' })[0];
  const done = kistSettlementPresentation(settled);
  assert.equal(done.settledMethod, null);
  assert.match(done.settledLabel, /Settled early/);
  assert.doesNotMatch(done.settledLabel, /waived/i);
});

test('kistSettlementPresentation still gates the payoff button on active plans', () => {
  const active = kistSettlementPresentation(billedOnce);
  assert.equal(active.canPayoff, true);
  assert.equal(active.payoffAmount, 2000);
  assert.equal(active.settledEarly, false);
  assert.equal(active.settledMethod, null);
  const invalid = kistSettlementPresentation(null);
  assert.equal(invalid.canPayoff, false);
  assert.equal(invalid.settledMethod, null);
});

// ---- Profile remainder Waada (pure stamp) ----

const waadaCustomer = (overrides = {}) => ({
  id: 'c1', customerNumber: 101, name: 'Synthetic Tester', phone: '03001234567', area: 'Test Area',
  bills: [{ id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, payments: [{ id: 'pay-1', amount: 1000, date: '2026-10-20', method: 'Cash' }] }],
  ...overrides
});

test('stampRemainderWaada stamps the payment and sets the live promise, exactly like Quick Collect', () => {
  const stamped = stampRemainderWaada(waadaCustomer(), '2026-10', 'pay-1', { promiseDate: '2026-10-27', promiseAmount: 2000 });
  assert.equal(stamped.promiseDate, '2026-10-27');
  assert.equal(stamped.promiseAmount, 2000);
  assert.equal(stamped.promiseNote, REMAINDER_WAADA_NOTE);
  assert.deepEqual(remainderWaadaOf(stamped.bills[0].payments[0]), { promiseDate: '2026-10-27', promiseAmount: 2000 });
  assert.equal(stamped.bills[0].payments[0].remainderWaada.previousWaada, undefined);
});

test('stampRemainderWaada captures the promise it replaced for the void path', () => {
  const before = waadaCustomer({ promiseDate: '2026-10-15', promiseAmount: 3000, promiseNote: 'Old promise' });
  const stamped = stampRemainderWaada(before, '2026-10', 'pay-1', { promiseDate: '2026-10-27', promiseAmount: 2000 });
  assert.equal(stamped.promiseDate, '2026-10-27');
  assert.deepEqual(stamped.bills[0].payments[0].remainderWaada.previousWaada, { promiseDate: '2026-10-15', promiseAmount: 3000, promiseNote: 'Old promise' });
});

test('stampRemainderWaada refuses invalid dates, non-positive remainders and unknown payments', () => {
  const customer = waadaCustomer();
  assert.equal(stampRemainderWaada(customer, '2026-10', 'pay-1', { promiseDate: 'not-a-date', promiseAmount: 2000 }), null);
  assert.equal(stampRemainderWaada(customer, '2026-10', 'pay-1', { promiseDate: '2026-10-27', promiseAmount: 0 }), null);
  assert.equal(stampRemainderWaada(customer, '2026-10', 'pay-1', { promiseDate: '2026-10-27', promiseAmount: -50 }), null);
  assert.equal(stampRemainderWaada(customer, '2026-10', 'no-such-payment', { promiseDate: '2026-10-27', promiseAmount: 2000 }), null);
  assert.equal(stampRemainderWaada(customer, '2026-11', 'pay-1', { promiseDate: '2026-10-27', promiseAmount: 2000 }), null);
  assert.equal(stampRemainderWaada(null, '2026-10', 'pay-1', { promiseDate: '2026-10-27', promiseAmount: 2000 }), null);
  // Refusals leave the customer untouched.
  assert.equal(customer.promiseDate, undefined);
  assert.equal(customer.bills[0].payments[0].remainderWaada, undefined);
});

test('stampRemainderWaada never mutates its input customer', () => {
  const customer = waadaCustomer();
  const before = JSON.stringify(customer);
  stampRemainderWaada(customer, '2026-10', 'pay-1', { promiseDate: '2026-10-27', promiseAmount: 2000 });
  assert.equal(JSON.stringify(customer), before);
});

test('stampRemainderWaada only touches the matching month and payment', () => {
  const customer = waadaCustomer({
    bills: [
      { id: 'bill-2026-10', month: '2026-10', payments: [{ id: 'pay-1', amount: 1000 }, { id: 'pay-2', amount: 500 }] },
      { id: 'bill-2026-09', month: '2026-09', payments: [{ id: 'pay-0', amount: 3000 }] }
    ]
  });
  const stamped = stampRemainderWaada(customer, '2026-10', 'pay-2', { promiseDate: '2026-10-27', promiseAmount: 1500 });
  assert.equal(stamped.bills[0].payments[0].remainderWaada, undefined);
  assert.equal(stamped.bills[0].payments[1].remainderWaada.promiseDate, '2026-10-27');
  assert.equal(stamped.bills[1].payments[0].remainderWaada, undefined);
});

test('stampRemainderWaada rounds the promise amount to cents', () => {
  const stamped = stampRemainderWaada(waadaCustomer(), '2026-10', 'pay-1', { promiseDate: '2026-10-27', promiseAmount: 2000.005 });
  assert.equal(stamped.promiseAmount, 2000.01);
  assert.equal(stamped.bills[0].payments[0].remainderWaada.promiseAmount, 2000.01);
});

// ---- Remainder offer arithmetic (shared with Quick Collect) ----

test('computeRemainderWaada offers only on a true partial payment', () => {
  assert.deepEqual(computeRemainderWaada(3000, 1000), { remainder: 2000 });
  assert.equal(computeRemainderWaada(3000, 3000), null);
  assert.equal(computeRemainderWaada(3000, 3500), null);
  assert.equal(computeRemainderWaada(3000, 0), null);
  assert.equal(computeRemainderWaada(null, 1000), null);
});

test('remainderWaadaChipDates gives the same four dates the profile form offers', () => {
  const dates = remainderWaadaChipDates('2026-10-20');
  assert.deepEqual(dates, { plus3: '2026-10-23', plus7: '2026-10-27', tenth: '2026-11-10', fifteenth: '2026-11-15' });
  assert.equal(remainderWaadaChipDates('not-a-date'), null);
});

test('remainderWaadaOf trusts only a validated stamp', () => {
  assert.deepEqual(remainderWaadaOf({ remainderWaada: { promiseDate: '2026-10-27', promiseAmount: 2000 } }), { promiseDate: '2026-10-27', promiseAmount: 2000 });
  assert.equal(remainderWaadaOf({ remainderWaada: { promiseDate: 'bad', promiseAmount: 2000 } }), null);
  assert.equal(remainderWaadaOf({}), null);
});
