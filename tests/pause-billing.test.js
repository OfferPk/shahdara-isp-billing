// SISP-8: Pro-Rata Package Upgrade & Temporary Vacation Hold (Freeze).
// Pure-function tests on synthetic data only.
//
// Spec test criterion (verbatim): Paused customers generate Rs. 0 new
// monthly charges during a billing snapshot while preserving any prior
// unpaid balance.
//
// The mid-month pro-rata calculator itself is NOT re-tested here beyond
// the QA wiring: calculatePlanMigrationProration already exists in
// form-validation.js and is pinned by tests/forms-qa.test.js. SISP-8
// verifies the freeze paths and adds QA rules covering both the hold
// and the saved pro-rata history entries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBillingPaused,
  isValidPauseDate,
  pauseMonthsBetween,
  pauseSkippedMonthsOnResume,
  pauseStatusLabel,
  sanitizePauseFields,
  validatePauseFields
} from '../pause-billing.js';
import {
  generateMonthlyBillsThroughCurrentMonth,
  updateCustomerProfile
} from '../core.js';
import { applyBillingCycle, planCustomerCycleLine } from '../billing-cycle.js';
import { auditBillingCorrectness, AUDIT_RULE_CODES } from '../qa-billing-correctness.js';
import { calculatePlanMigrationProration } from '../form-validation.js';
import { pauseBillingSummary } from '../profile-ui.js';

function baseCustomer(overrides = {}) {
  return {
    id: 'c1',
    customerNumber: 1,
    name: 'TEST CUSTOMER',
    monthlySellingAmount: 3000,
    monthlyPriceSchedule: [{ amount: 3000, effectiveMonth: '2026-01', recordedAt: '2026-01-01 00:00' }],
    billingStartMonth: '2026-01',
    bills: [],
    archived: false,
    serviceStatus: 'active',
    paused: false,
    pauseStartDate: null,
    autoResumeDate: null,
    pauseSkippedMonths: [],
    ...overrides
  };
}

function baseState(customerOverrides = {}) {
  return { customers: [baseCustomer(customerOverrides)], nextCustomerNumber: 2 };
}

// --- pause-billing.js pure helpers --------------------------------------

test('isBillingPaused: months before the pause month are never paused', () => {
  const customer = baseCustomer({ paused: true, pauseStartDate: '2026-11-05' });
  assert.equal(isBillingPaused(customer, '2026-10'), false);
  assert.equal(isBillingPaused(customer, '2026-11'), true);
  assert.equal(isBillingPaused(customer, '2026-12'), true);
});

test('isBillingPaused: auto-resume month bills again, earlier months stay paused', () => {
  const customer = baseCustomer({ paused: true, pauseStartDate: '2026-11-05', autoResumeDate: '2027-01-10' });
  assert.equal(isBillingPaused(customer, '2026-11'), true);
  assert.equal(isBillingPaused(customer, '2026-12'), true);
  assert.equal(isBillingPaused(customer, '2027-01'), false);
});

test('isBillingPaused: not paused, or a hold without a valid start date, pauses nothing', () => {
  assert.equal(isBillingPaused(baseCustomer(), '2026-11'), false);
  assert.equal(isBillingPaused(baseCustomer({ paused: true, pauseStartDate: null }), '2026-11'), false);
  assert.equal(isBillingPaused(baseCustomer({ paused: true, pauseStartDate: 'not-a-date' }), '2026-11'), false);
  assert.equal(isBillingPaused(baseCustomer({ paused: true, pauseStartDate: '2026-02-30' }), '2026-11'), false);
});

test('isBillingPaused: a recorded skipped month stays paused after resume', () => {
  const customer = baseCustomer({ paused: false, pauseStartDate: null, pauseSkippedMonths: ['2026-11'] });
  assert.equal(isBillingPaused(customer, '2026-11'), true);
  assert.equal(isBillingPaused(customer, '2026-12'), false);
});

test('validatePauseFields: rejects a hold without a start date and an auto-resume on/before the start', () => {
  assert.equal(validatePauseFields({ paused: false, pauseStartDate: null, autoResumeDate: null }), null);
  assert.match(validatePauseFields({ paused: true, pauseStartDate: null, autoResumeDate: null }), /start date/);
  assert.match(validatePauseFields({ paused: true, pauseStartDate: '2026-11-05', autoResumeDate: '2026-11-05' }), /after the pause/);
  assert.match(validatePauseFields({ paused: true, pauseStartDate: '2026-11-05', autoResumeDate: '2026-11-01' }), /after the pause/);
  assert.equal(validatePauseFields({ paused: true, pauseStartDate: '2026-11-05', autoResumeDate: '2026-12-01' }), null);
  assert.equal(validatePauseFields({ paused: true, pauseStartDate: '2026-11-05', autoResumeDate: null }), null);
});

test('sanitizePauseFields: corrupt values fall back to no-hold defaults', () => {
  const cleaned = sanitizePauseFields({ paused: 'yes', pauseStartDate: '2026-13-40', autoResumeDate: 42, pauseSkippedMonths: ['2026-11', 'junk', '2026-11'] });
  assert.deepEqual(cleaned, { paused: false, pauseStartDate: null, autoResumeDate: null, pauseSkippedMonths: ['2026-11'] });
  assert.equal(isValidPauseDate('2026-02-29'), false);
  assert.equal(isValidPauseDate('2024-02-29'), true);
});

test('pauseMonthsBetween: half-open range, empty when reversed', () => {
  assert.deepEqual(pauseMonthsBetween('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01']);
  assert.deepEqual(pauseMonthsBetween('2026-11', '2026-11'), []);
  assert.deepEqual(pauseMonthsBetween('2026-12', '2026-11'), []);
});

test('pauseSkippedMonthsOnResume: records hold months without a bill, never months that already have one', () => {
  const customer = baseCustomer({
    paused: true,
    pauseStartDate: '2026-10-20',
    pauseSkippedMonths: ['2026-09'],
    bills: [{ month: '2026-10', dueAmount: 3000, payments: [] }]
  });
  assert.deepEqual(pauseSkippedMonthsOnResume(customer, '2026-12'), ['2026-09', '2026-11']);
});

test('pauseStatusLabel: human labels for active hold, auto-resume, and no hold', () => {
  assert.equal(pauseStatusLabel(baseCustomer()), 'Not paused');
  assert.equal(pauseStatusLabel(baseCustomer({ paused: true, pauseStartDate: '2026-11-05' })), 'Paused since 2026-11-05 · until resumed');
  assert.equal(pauseStatusLabel(baseCustomer({ paused: true, pauseStartDate: '2026-11-05', autoResumeDate: '2027-01-10' })), 'Paused since 2026-11-05 · auto-resumes 2027-01-10');
});

// --- auto-generator (core.js) -------------------------------------------

test('auto-generator: paused month gets Rs. 0 new charges and the month is recorded as skipped', () => {
  const state = generateMonthlyBillsThroughCurrentMonth(
    baseState({ paused: true, pauseStartDate: '2026-11-05' }),
    new Date('2026-11-15T12:00:00')
  );
  const customer = state.customers[0];
  assert.equal(customer.bills.some((bill) => bill.month === '2026-11'), false);
  assert.ok(customer.pauseSkippedMonths.includes('2026-11'));
  // Earlier months still bill normally — the hold only pauses its window.
  assert.equal(customer.bills.some((bill) => bill.month === '2026-10'), true);
});

test('auto-generator VERBATIM criterion: paused customer keeps the prior unpaid balance, gains no new charge', () => {
  const priorBill = { id: 'b-oct', month: '2026-10', dueAmount: 3000, dueDate: '2026-10-05', status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-10-01 00:00', amountHistory: [] };
  const state = generateMonthlyBillsThroughCurrentMonth(
    baseState({ paused: true, pauseStartDate: '2026-11-05', bills: [priorBill] }),
    new Date('2026-11-15T12:00:00')
  );
  const customer = state.customers[0];
  assert.equal(customer.bills.some((bill) => bill.month === '2026-11'), false);
  const kept = customer.bills.find((bill) => bill.month === '2026-10');
  assert.equal(kept.dueAmount, 3000);
  assert.deepEqual(kept.payments, []);
});

test('auto-generator: a skipped month is never backfilled after resume', () => {
  const paused = generateMonthlyBillsThroughCurrentMonth(
    baseState({ paused: true, pauseStartDate: '2026-11-05' }),
    new Date('2026-11-15T12:00:00')
  );
  const resumed = generateMonthlyBillsThroughCurrentMonth(
    { ...paused, customers: paused.customers.map((c) => ({ ...c, paused: false, pauseStartDate: null, autoResumeDate: null })) },
    new Date('2026-12-15T12:00:00')
  );
  const customer = resumed.customers[0];
  assert.equal(customer.bills.some((bill) => bill.month === '2026-11'), false);
  assert.equal(customer.bills.some((bill) => bill.month === '2026-12'), true);
});

test('auto-generator: unpaused customers behave exactly as before', () => {
  const state = generateMonthlyBillsThroughCurrentMonth(baseState(), new Date('2026-11-15T12:00:00'));
  const bill = state.customers[0].bills.find((item) => item.month === '2026-11');
  assert.equal(bill.dueAmount, 3000);
  assert.equal(bill.dueDate, '2026-11-05');
});

// --- billing cycle (billing-cycle.js) -----------------------------------

test('cycle planner: paused month is skipped with reason paused, never priced', () => {
  const line = planCustomerCycleLine(baseCustomer({ paused: true, pauseStartDate: '2026-11-05' }), '2026-11');
  assert.equal(line.skipped, true);
  assert.equal(line.reason, 'paused');
  const unpaused = planCustomerCycleLine(baseCustomer(), '2026-11');
  assert.equal(unpaused.skipped, false);
  assert.equal(unpaused.currentMonthBill, 3000);
});

test('cycle apply: a skipped paused month is recorded so resume never backfills it', () => {
  const { state, plan } = applyBillingCycle(baseState({ paused: true, pauseStartDate: '2026-11-05' }), '2026-11');
  assert.ok(plan.skipped.some((line) => line.reason === 'paused'));
  assert.ok(state.customers[0].pauseSkippedMonths.includes('2026-11'));
  assert.equal(state.customers[0].bills.some((bill) => bill.month === '2026-11'), false);
});

// --- profile update (core.js) -------------------------------------------

test('updateCustomerProfile: pause fields round-trip and resume finalizes skipped months', () => {
  const pausedState = updateCustomerProfile(baseState(), 'c1', { paused: true, pauseStartDate: '2026-10-20' }, new Date('2026-10-20T12:00:00'));
  const paused = pausedState.customers[0];
  assert.equal(paused.paused, true);
  assert.equal(paused.pauseStartDate, '2026-10-20');
  const withOctBill = { ...pausedState, customers: pausedState.customers.map((c) => ({ ...c, bills: [{ month: '2026-10', dueAmount: 3000, payments: [] }] })) };
  const resumed = updateCustomerProfile(withOctBill, 'c1', { paused: false, pauseStartDate: null, autoResumeDate: null }, new Date('2026-12-10T12:00:00'));
  const customer = resumed.customers[0];
  assert.equal(customer.paused, false);
  assert.deepEqual(customer.pauseSkippedMonths, ['2026-11']);
});

test('updateCustomerProfile: invalid holds are rejected, never stored', () => {
  assert.throws(() => updateCustomerProfile(baseState(), 'c1', { paused: true }), /start date/);
  assert.throws(() => updateCustomerProfile(baseState(), 'c1', { paused: true, pauseStartDate: '2026-11-05', autoResumeDate: '2026-11-01' }), /after the pause/);
});

// --- QA rules (qa-billing-correctness.js) -------------------------------

test('QA: a generated bill created during a hold is flagged, a pre-hold bill is not', () => {
  const leaked = { id: 'b-nov', month: '2026-11', dueAmount: 3000, dueDate: '2026-11-05', status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-11-10 00:00', amountHistory: [] };
  const legitimate = { id: 'b-oct', month: '2026-10', dueAmount: 3000, dueDate: '2026-10-05', status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-10-01 00:00', amountHistory: [] };
  const manual = { id: 'b-dec', month: '2026-12', dueAmount: 3000, dueDate: '2026-12-05', status: 'pending', payments: [], generated: false, priceSnapshot: null, createdAt: '2026-12-10 00:00', amountHistory: [] };
  const audit = auditBillingCorrectness(baseState({ paused: true, pauseStartDate: '2026-10-20', bills: [legitimate, leaked, manual] }));
  const flagged = audit.discrepancies.filter((d) => d.ruleId === AUDIT_RULE_CODES.BILL_DURING_PAUSE);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].month, '2026-11');
});

test('QA: saved pro-rata history recomputes; a tampered entry is flagged', () => {
  const correct = calculatePlanMigrationProration(1000, 3000, '2026-11-10');
  const goodEntry = { date: '2026-11-10', oldPackage: '3 Mbps', newPackage: '15 Mbps', oldMonthlyRate: 1000, newMonthlyRate: 3000, proRataAdjustment: correct.netAdjustment, proRatedBillAmount: correct.proRatedCurrentBill };
  const good = auditBillingCorrectness(baseState({ packageHistory: [goodEntry] }));
  assert.equal(good.discrepancies.filter((d) => d.ruleId === AUDIT_RULE_CODES.PRORATA_HISTORY_MISMATCH).length, 0);
  const tampered = { ...goodEntry, proRataAdjustment: correct.netAdjustment + 500 };
  const bad = auditBillingCorrectness(baseState({ packageHistory: [tampered] }));
  const flagged = bad.discrepancies.filter((d) => d.ruleId === AUDIT_RULE_CODES.PRORATA_HISTORY_MISMATCH);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].month, '2026-11');
});

// --- profile view summary (profile-ui.js) -------------------------------

test('pauseBillingSummary: active hold states the billing effect; skipped months are noted', () => {
  const summary = pauseBillingSummary(baseCustomer({ paused: true, pauseStartDate: '2026-11-05', pauseSkippedMonths: ['2026-11'] }));
  assert.equal(summary.active, true);
  assert.match(summary.detail, /No new monthly charges/);
  assert.match(summary.detail, /1 skipped month/);
  const clear = pauseBillingSummary(baseCustomer());
  assert.equal(clear.active, false);
  assert.equal(clear.detail, 'Not paused');
});
