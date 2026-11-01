// SISP-151 [P1]: Projected Next-Month Invoice Preview. Pure-projector
// tests on synthetic data only. Spec pins: standard, paused, seasonal,
// kist-active and advance-wallet customers, plus arrears, a combined
// case proving every component lands exactly once, FREE, the SISP-61
// prepay-coverage partition of the advance pool, the already-billed
// branch, refusal cases, and a byte-for-byte purity pin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment, formatPKR
} from '../core.js';
import { applyBillingCycle, arrearsAndAdvance, planCustomerCycleLine } from '../billing-cycle.js';
import { createInstallmentPlan } from '../installment-plan.js';
import { recordPrepay } from '../advance-prepay.js';
import { nextMonthKey, projectNextMonthInvoice, splitAdvanceCredit } from '../next-bill-projector.js';
import { nextBillProjectionSectionHtml } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';

const payment = (id, overrides) => ({ id, date: '2026-09-06', amount: 0, method: 'Cash', ...overrides });
const bill = (month, overrides) => ({ id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [], ...overrides });
const customer = (overrides) => ({
  id: 'c1', customerNumber: 11, name: 'Projection Tester', archived: false, billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  bills: [], ...overrides
});
const CTX = { currentMonth: '2026-10' }; // target month: 2026-11

test('nextMonthKey rolls months and years, rejects invalid keys', () => {
  assert.equal(nextMonthKey('2026-10'), '2026-11');
  assert.equal(nextMonthKey('2026-12'), '2027-01');
  assert.equal(nextMonthKey('2026-13'), null);
  assert.equal(nextMonthKey('junk'), null);
});

test('standard customer: package only, Rs. 3,000 projected', () => {
  const c = customer();
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.status, 'projected');
  assert.equal(proj.targetMonth, '2026-11');
  assert.equal(proj.basePackage, 3000);
  assert.equal(proj.kist, 0);
  assert.equal(proj.previousArrears, 0);
  assert.equal(proj.advanceWallet, 0);
  assert.equal(proj.prepayCoverage, 0);
  assert.equal(proj.referralCredit, 0);
  assert.equal(proj.pendingCredits, 0);
  assert.equal(proj.projectedDue, 3000);
  // Engine agreement: identical to the cycle planner's own net due.
  assert.equal(proj.projectedDue, planCustomerCycleLine(c, '2026-11').netDue);
});

test('seasonal / schedule-change customer: next month uses the NEW scheduled price', () => {
  const c = customer({
    monthlyPriceSchedule: [
      { effectiveMonth: '2026-08', amount: 2500 },
      { effectiveMonth: '2026-11', amount: 3200 }
    ]
  });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.basePackage, 3200);
  assert.equal(proj.projectedDue, 3200);
});

test('arrears case: Rs. 1,500 unpaid arrears + Rs. 3,000 package = Rs. 4,500', () => {
  const c = customer({ bills: [bill('2026-09', { payments: [payment('p1', { amount: 1500 })] })] });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.previousArrears, 1500);
  assert.equal(proj.basePackage, 3000);
  assert.equal(proj.projectedDue, 4500);
});

test('advance-wallet case: arrears 0, credit Rs. 1,000, package Rs. 3,000 -> Rs. 2,000', () => {
  const c = customer({ bills: [bill('2026-09', { payments: [payment('p1', { amount: 4000 })] })] });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.previousArrears, 0);
  assert.equal(proj.advanceWallet, 1000);
  assert.equal(proj.prepayCoverage, 0);
  assert.equal(proj.projectedDue, 2000);
  const split = splitAdvanceCredit(c, '2026-11');
  assert.equal(split.walletCents + split.prepayCents, arrearsAndAdvance(c, '2026-11').advanceCredit * 100);
});

test('kist-active customer: next month kist lands on top of the package', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Test Router', totalAmount: 1500, downPayment: 0, totalMonths: 3, startDate: '2026-10-05' });
  const c = customer({ installmentPlans: [plan] });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.kist, 500);
  assert.equal(proj.kistLines.length, 1);
  assert.equal(proj.kistLines[0].installmentNumber, 1);
  assert.equal(proj.projectedDue, 3500);
});

test('kist plan fully billed contributes nothing', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Test Router', totalAmount: 1500, downPayment: 0, totalMonths: 3, startDate: '2026-08-05' });
  plan.monthsBilled = 3;
  plan.status = 'completed';
  const c = customer({ installmentPlans: [plan] });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.kist, 0);
  assert.equal(proj.projectedDue, 3000);
});

test('paused customer: hold covering the target month projects Rs. 0 with the paused marker', () => {
  const c = customer({ paused: true, pauseStartDate: '2026-10-15' });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.status, 'paused');
  assert.equal(proj.projectedDue, 0);
});

test('paused customer: a hold starting mid-target-month pauses the whole month (cycle month rule)', () => {
  const c = customer({ paused: true, pauseStartDate: '2026-11-20' });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.status, 'paused');
  assert.equal(proj.projectedDue, 0);
});

test('hold that resumes before the target month does not pause the projection', () => {
  const c = customer({ paused: true, pauseStartDate: '2026-09-01', autoResumeDate: '2026-10-20' });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.status, 'projected');
  assert.equal(proj.projectedDue, 3000);
});

test('FREE customer projects Rs. 0 with the free marker', () => {
  const proj = projectNextMonthInvoice(customer({ isFreeConnection: true }), CTX);
  assert.equal(proj.status, 'free');
  assert.equal(proj.projectedDue, 0);
});

test('refusals: archived, no price, and billing-not-started all return null', () => {
  assert.equal(projectNextMonthInvoice(customer({ archived: true }), CTX), null);
  assert.equal(projectNextMonthInvoice(customer({ monthlyPriceSchedule: [] }), CTX), null);
  assert.equal(projectNextMonthInvoice(customer({ billingStartMonth: '2026-12' }), CTX), null);
  assert.equal(projectNextMonthInvoice(null, CTX), null);
});

test('combined case: every component lands exactly once', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Test Router', totalAmount: 1500, downPayment: 0, totalMonths: 3, startDate: '2026-10-05' });
  const c = customer({
    installmentPlans: [plan],
    bills: [
      bill('2026-09', { payments: [payment('p1', { amount: 2000 })] }), // Rs. 1,000 arrears
      bill('2026-10', { payments: [payment('p2', { date: '2026-10-06', amount: 3500 })] }) // Rs. 500 wallet credit
    ]
  });
  const proj = projectNextMonthInvoice(c, { ...CTX, referralQueued: 500 });
  assert.equal(proj.basePackage, 3000);
  assert.equal(proj.kist, 500);
  assert.equal(proj.previousArrears, 1000);
  assert.equal(proj.advanceWallet, 500);
  assert.equal(proj.prepayCoverage, 0);
  assert.equal(proj.referralCredit, 500);
  assert.equal(proj.pendingCredits, 500);
  assert.equal(proj.advanceCredit, 500);
  // 3000 + 500 + 1000 − 500 (wallet) − 500 (referral) = 3500, and the
  // total is the cycle planner's own net due — nothing counted twice.
  assert.equal(proj.projectedDue, 3500);
  assert.equal(proj.projectedDue, planCustomerCycleLine(c, '2026-11', 500).netDue);
  const split = splitAdvanceCredit(c, '2026-11');
  assert.equal(split.walletCents + split.prepayCents, arrearsAndAdvance(c, '2026-11').advanceCredit * 100);
});

/** A real SISP-61 prepay state, built through the shipped recorders. */
function prepayState() {
  const OCT_29 = new Date(2026, 9, 29, 12);
  let state = createInitialState(['Prepay Projection Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-05', amount: '3000', method: 'Cash' }, OCT_29);
  const { nextState } = recordPrepay(state, 'seed-001', { months: 3, discount: 500, date: '2026-10-29', method: 'Cash' }, OCT_29);
  return nextState;
}

test('prepay coverage: released gross is its own line, never double-counted as wallet', () => {
  const state = prepayState();
  const c = state.customers.find((entry) => entry.id === 'seed-001');
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.status, 'projected');
  assert.equal(proj.targetMonth, '2026-11');
  assert.equal(proj.basePackage, 3000);
  // 3 months x Rs. 3,000 gross coverage (Rs. 8,500 cash + Rs. 500 discount).
  assert.equal(proj.prepayCoverage, 9000);
  assert.equal(proj.advanceWallet, 0);
  assert.equal(proj.pendingCredits, 9000);
  assert.equal(proj.advanceCredit, 9000);
  assert.equal(proj.projectedDue, 0);
  assert.equal(proj.remainingAdvance, 6000);
});

test('prepay coverage shrinks as real cycles consume it', () => {
  const state = prepayState();
  const { state: afterNov } = applyBillingCycle(state, '2026-11', new Date('2026-11-02T00:00:00Z'));
  const c = afterNov.customers.find((entry) => entry.id === 'seed-001');
  const proj = projectNextMonthInvoice(c, { currentMonth: '2026-11' });
  assert.equal(proj.targetMonth, '2026-12');
  assert.equal(proj.prepayCoverage, 6000);
  assert.equal(proj.projectedDue, 0);
  assert.equal(proj.remainingAdvance, 3000);
});

test('already-billed target month reports the live engine balance, not a projection', () => {
  const c = customer({ bills: [bill('2026-11', { payments: [payment('p9', { date: '2026-11-03', amount: 1000 })] })] });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.status, 'already-billed');
  assert.equal(proj.basePackage, 3000);
  assert.equal(proj.billBalanceDue, 2000);
  assert.equal(proj.projectedDue, 2000);
});

test('already-billed month adds earlier arrears and reports stamped credits once', () => {
  const c = customer({
    bills: [
      bill('2026-09'), // Rs. 3,000 arrears
      bill('2026-11', { referralCreditAmount: 500, payments: [payment('p9', { date: '2026-11-03', amount: 2500 })] })
    ]
  });
  const proj = projectNextMonthInvoice(c, CTX);
  assert.equal(proj.status, 'already-billed');
  assert.equal(proj.stampedCredits, 500);
  assert.equal(proj.billBalanceDue, 0); // 3000 − 500 referral − 2500 paid
  assert.equal(proj.previousArrears, 3000);
  assert.equal(proj.projectedDue, 3000);
});

test('purity: the projector mutates neither the customer nor the context', () => {
  const plan = createInstallmentPlan({ itemTitle: 'Test Router', totalAmount: 1500, downPayment: 0, totalMonths: 3, startDate: '2026-10-05' });
  const c = customer({
    installmentPlans: [plan],
    bills: [bill('2026-09', { payments: [payment('p1', { amount: 2000 })] })]
  });
  const ctx = { ...CTX, referralQueued: 500 };
  const customerBefore = JSON.stringify(c);
  const ctxBefore = JSON.stringify(ctx);
  const proj = projectNextMonthInvoice(c, ctx);
  assert.equal(proj.projectedDue, 4000); // 3000 + 500 kist + 1000 arrears − 500 referral
  assert.equal(JSON.stringify(c), customerBefore);
  assert.equal(JSON.stringify(ctx), ctxBefore);
});

test('section html renders real figures with no raw i18n keys, for every status', () => {
  const fmt = (n) => formatPKR(n);
  const projected = projectNextMonthInvoice(customer(), CTX);
  const html = nextBillProjectionSectionHtml(projected, fmt);
  assert.match(html, /profile-next-bill-section/);
  assert.match(html, /Nov 2026/);
  assert.ok(html.includes(formatPKR(3000)));
  assert.ok(!html.includes('nbp_'));
  const paused = projectNextMonthInvoice(customer({ paused: true, pauseStartDate: '2026-10-15' }), CTX);
  const pausedHtml = nextBillProjectionSectionHtml(paused, fmt);
  assert.match(pausedHtml, /profile-next-bill-section/);
  assert.ok(!pausedHtml.includes('nbp_'));
  const billed = projectNextMonthInvoice(customer({ bills: [bill('2026-11')] }), CTX);
  const billedHtml = nextBillProjectionSectionHtml(billed, fmt);
  assert.ok(billedHtml.includes(formatPKR(3000)));
  assert.ok(!billedHtml.includes('nbp_'));
  assert.equal(nextBillProjectionSectionHtml(null, fmt), '');
});

test('i18n audit: every nbp_ key used exists in en and ur with matching placeholders', () => {
  const sources = [
    readFileSync(new URL('../profile-ui.js', import.meta.url), 'utf8'),
    readFileSync(new URL('../next-bill-projector.js', import.meta.url), 'utf8')
  ].join('\n');
  const keys = new Set([...sources.matchAll(/'(nbp_[a-z0-9_]+)'/g)].map((m) => m[1]));
  assert.ok(keys.size >= 15, `expected at least 15 nbp_ keys, found ${keys.size}`);
  const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `missing en ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `missing ur ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0 && TRANSLATIONS.ur[key].length > 0, `empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder mismatch ${key}`);
  }
});

test('wiring: app.js renders the projection into the customer profile', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /from '\.\/next-bill-projector\.js'/);
  assert.match(appSource, /projectNextMonthInvoice\(customer, \{ referralQueued: queuedReferralTotalFor\(loadReferralCredits\(\), customer\.id\) \}\)/);
  assert.match(appSource, /nextBillProjectionSectionHtml\(nextBillProjection, formatAmount\)/);
  assert.match(appSource, /\$\{nextBillSectionHtml\}/);
});
