/**
 * backdated-payment-helper.test.js — SISP-161: Backdated Receipt
 * paymentDate Chips (Today / Yesterday / Prev Month End) & Month
 * Attribution Guard.
 *
 * The owner's case: a shop or night collection received on 30 September
 * gets typed into the app on 2 October. The money belongs to September
 * everywhere the app attributes by payment date (Roznamcha drawer +
 * month figures, Owner Khata, P&L), while the record keeps an honest
 * audit trail: payment.date = the day the money was received, the
 * recordedAt stamp (SISP-146; aliased for this phase — see below) =
 * the day it was typed in.
 *
 * Audit facts this suite pins (all verified against the shipped base):
 *  - The Quick Collect sheet (#quickCollectModal — the spec's
 *    "#collectModal") already has a real date input
 *    (#quickCollectDateInput), prefilled with the PKT today and capped
 *    by its max attribute; the chips are a 1-tap affordance on top of
 *    that input, not a second recorder.
 *  - The future-date guard ALREADY lives at the recorder: core
 *    validatePayment throws 'Payment date cannot be in the future.' for
 *    date > dateKey(referenceDate) (the PKT calendar). These tests pin
 *    that shipped guard through executeQuickCollection (the shared path
 *    Quick Collect AND Field Mode both record through).
 *  - Entry-time stamp (MERGE-TIME ALIAS): this phase's build stamped a
 *    new enteredAt field in addPayment ('YYYY-MM-DDTHH:MM' PKT, the
 *    localDateTimeValue house style) because payments carried no
 *    entry-time stamp on its base. By reconciliation time SISP-146 had
 *    already landed the very same audit stamp as recordedAt (ISO
 *    instant, stamped once in addPayment after the validatePayment
 *    spread and carried verbatim by correctPayment). Shipping both
 *    would store one fact twice, so the enteredAt stamp was dropped
 *    and every pin below targets recordedAt instead. validatePayment
 *    stamps neither, so backup revalidation (which calls
 *    validatePayment directly) can never re-stamp a stored record,
 *    and legacy (pre-SISP-146) payments stay without the field
 *    forever.
 *  - Bill-month allocation keys off the BILL month, never the payment
 *    date: a payment dated September recorded against the October bill
 *    still pays October.
 *  - Receipts already print payment.date (receipt.js paymentDate) —
 *    pinned here so no surface can drift to printing entry time.
 *
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  addPayment, validatePayment, correctPayment, calculatePaymentAllocations,
  persistState, readState
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { computePaymentDateChip, paymentDateChipTargets, isFuturePaymentDate, isValidPaymentDateKey } from '../backdated-payment-helper.js';
import { collectDirectCashPayments, buildRoznamchaDay } from '../roznamcha.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import { buildOwnerKhataReport } from '../owner-khata.js';
import { buildPaymentReceipt } from '../receipt.js';
import { TRANSLATIONS, t } from '../nav-language.js';

// 07:00 UTC == 12:00 PKT on the same calendar day — unambiguous in PKT
// (core's date helpers all read the Asia/Karachi calendar).
const OCT_2 = new Date('2026-10-02T07:00:00Z');
const OCT_5 = new Date('2026-10-05T07:00:00Z');
const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

/** One synthetic customer, PKR 3,000/month, bills generated through Oct 2026. */
function octoberState() {
  let state = createInitialState(['Backdate Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_2);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_2);
  return state;
}

function onlyPayment(state, customerId = 'seed-001') {
  const customer = state.customers.find(c => c.id === customerId);
  const payments = customer.bills.flatMap(b => b.payments);
  assert.equal(payments.length, 1);
  return payments[0];
}

/* ---------------- chip date math (injectable today) ---------------- */

test('chip targets: today / yesterday / prev-month-end on a plain mid-month day', () => {
  assert.deepEqual(paymentDateChipTargets('2026-10-15'), {
    today: '2026-10-15',
    yesterday: '2026-10-14',
    prevMonthEnd: '2026-09-30'
  });
  assert.equal(computePaymentDateChip('today', '2026-10-15'), '2026-10-15');
  assert.equal(computePaymentDateChip('yesterday', '2026-10-15'), '2026-10-14');
  assert.equal(computePaymentDateChip('prev-month-end', '2026-10-15'), '2026-09-30');
});

test('chip math across the year boundary: 2026-01-01 -> yesterday and prev month end are 2025-12-31', () => {
  assert.equal(computePaymentDateChip('yesterday', '2026-01-01'), '2025-12-31');
  assert.equal(computePaymentDateChip('prev-month-end', '2026-01-01'), '2025-12-31');
  assert.equal(computePaymentDateChip('prev-month-end', '2026-01-15'), '2025-12-31');
});

test('chip math across February: 2026-03-01 -> 2026-02-28 (non-leap), 2024-03-01 -> 2024-02-29 (leap)', () => {
  assert.equal(computePaymentDateChip('yesterday', '2026-03-01'), '2026-02-28');
  assert.equal(computePaymentDateChip('prev-month-end', '2026-03-01'), '2026-02-28');
  assert.equal(computePaymentDateChip('yesterday', '2024-03-01'), '2024-02-29');
  assert.equal(computePaymentDateChip('prev-month-end', '2024-03-01'), '2024-02-29');
});

test('custom chip returns the operator date verbatim (validated); junk resolves to null', () => {
  assert.equal(computePaymentDateChip('custom', '2026-10-02', '2026-09-27'), '2026-09-27');
  assert.equal(computePaymentDateChip('custom', '2026-10-02', '27-09-2026'), null);
  assert.equal(computePaymentDateChip('custom', '2026-10-02', '2026-02-30'), null);
  assert.equal(computePaymentDateChip('custom', '2026-10-02', ''), null);
  assert.equal(computePaymentDateChip('nonsense', '2026-10-02'), null);
  assert.equal(computePaymentDateChip('today', 'not-a-date'), null);
  assert.equal(paymentDateChipTargets('2026-13-01'), null);
  assert.equal(isValidPaymentDateKey('2026-02-29'), false);
  assert.equal(isValidPaymentDateKey('2024-02-29'), true);
});

test('future-date mirror: after PKT today is future; today and any past date are not', () => {
  assert.equal(isFuturePaymentDate('2026-10-03', '2026-10-02'), true);
  assert.equal(isFuturePaymentDate('2026-10-02', '2026-10-02'), false);
  assert.equal(isFuturePaymentDate('2025-01-01', '2026-10-02'), false);
  assert.equal(isFuturePaymentDate('junk', '2026-10-02'), false);
});

/* ------------- recorder: recordedAt (SISP-161 alias) + the shipped guard ------------- */

test('backdated collection: date is the chosen day, recordedAt is the real entry moment', () => {
  const { nextState } = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-30', method: 'Cash'
  }, OCT_2);
  const payment = onlyPayment(nextState);
  assert.equal(payment.date, '2026-09-30');
  // SISP-161 alias: the entry moment is SISP-146's recordedAt (the ISO
  // instant of the recording call's reference date) — no second stamp.
  assert.equal(payment.recordedAt, '2026-10-02T07:00:00.000Z');
  assert.equal(new Date(payment.recordedAt).toISOString().slice(0, 10), '2026-10-02');
  assert.notEqual(new Date(payment.recordedAt).toISOString().slice(0, 10), payment.date);
  assert.equal('enteredAt' in payment, false);
});

test('default no-chip path: date defaults to PKT today and the ONLY entry stamp is the SISP-146 recordedAt (no enteredAt)', () => {
  const { nextState } = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-10', amount: 3000, method: 'Cash'
  }, OCT_2);
  const payment = onlyPayment(nextState);
  assert.equal(payment.date, '2026-10-02');
  assert.deepEqual(Object.keys(payment).sort(), ['amount', 'date', 'id', 'method', 'recordedAt']);
});

test('validatePayment itself never stamps recordedAt (backup revalidation cannot re-stamp a stored record)', () => {
  const clean = validatePayment({ date: '2026-09-30', amount: 100, method: 'Cash' }, OCT_2);
  assert.equal('recordedAt' in clean, false);
  assert.equal('enteredAt' in clean, false);
});

test('recordedAt survives a persist/read round-trip unchanged; legacy payments stay without it', () => {
  const { nextState } = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-30', method: 'Cash'
  }, OCT_2);
  const storage = store();
  persistState(nextState, storage);
  const payment = onlyPayment(readState(storage));
  assert.equal(payment.recordedAt, '2026-10-02T07:00:00.000Z');

  // Legacy: a stored payment with no stamp loads back with no stamp.
  const legacyStorage = store();
  const legacy = octoberState();
  const withLegacy = addPayment(legacy, 'seed-001', '2026-10', { date: '2026-10-01', amount: 500, method: 'Cash' }, OCT_2);
  const stripped = {
    ...withLegacy,
    customers: withLegacy.customers.map(c => ({
      ...c,
      bills: c.bills.map(b => ({ ...b, payments: b.payments.map(({ recordedAt, ...rest }) => rest) }))
    }))
  };
  persistState(stripped, legacyStorage);
  assert.equal('recordedAt' in onlyPayment(readState(legacyStorage)), false);
});

test('correctPayment preserves the original recordedAt verbatim (correction never rewrites the audit trail)', () => {
  const { nextState } = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-30', method: 'Cash'
  }, OCT_2);
  const payment = onlyPayment(nextState);
  const corrected = correctPayment(nextState, 'seed-001', '2026-09', payment.id, {
    date: '2026-09-30', amount: 2500, method: 'Cash'
  }, OCT_5);
  assert.equal(onlyPayment(corrected).recordedAt, '2026-10-02T07:00:00.000Z');
  assert.equal(onlyPayment(corrected).amount, 2500);
});

test('future-date rejection at the recorder: 2026-10-03 entered on 2026-10-02 is refused; today is allowed', () => {
  assert.throws(() => executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-03', method: 'Cash'
  }, OCT_2), /Payment date cannot be in the future/);
  assert.throws(() => validatePayment({ date: '2026-10-03', amount: 100, method: 'Cash' }, OCT_2),
    /Payment date cannot be in the future/);
  const { nextState } = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-02', method: 'Cash'
  }, OCT_2);
  assert.equal(onlyPayment(nextState).date, '2026-10-02');
});

/* ---------------- cross-month attribution ---------------- */

test('cross-month attribution: a payment dated 2026-09-30 entered 2026-10-02 counts in September, not October', () => {
  const { nextState } = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-30', method: 'Cash'
  }, OCT_2);

  // Roznamcha: the day drawer for 30 Sep holds the cash; 2 Oct does not.
  const sepDrawer = collectDirectCashPayments(nextState, '2026-09-30');
  assert.equal(sepDrawer.reduce((sum, p) => sum + p.amount, 0), 3000);
  assert.equal(collectDirectCashPayments(nextState, '2026-10-02').length, 0);
  assert.equal(buildRoznamchaDay(nextState, [], '2026-09-30', []).cashIn, 3000);

  // P&L: September income carries it; October income does not.
  const sepPnl = calculatePnlAnalytics(nextState, { selectedMonth: '2026-09', referenceDate: OCT_2 });
  assert.equal(sepPnl.monthlyData.find(m => m.month === '2026-09').income, 3000);
  const octPnl = calculatePnlAnalytics(nextState, { selectedMonth: '2026-10', referenceDate: OCT_2 });
  assert.equal(octPnl.monthlyData.find(m => m.month === '2026-10').income, 0);

  // Owner Khata: the September closing collects it; October collects nothing.
  assert.equal(buildOwnerKhataReport(nextState, '2026-09').collected, 3000);
  assert.equal(buildOwnerKhataReport(nextState, '2026-10').collected, 0);
});

test('bill-month allocation is unchanged by the payment date: a September-dated payment on the October bill pays October', () => {
  const { nextState } = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-09-30', method: 'Cash'
  }, OCT_2);
  const allocations = calculatePaymentAllocations(nextState);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
});

test('receipt prints the PAYMENT date (2026-09-30), never the entry moment', () => {
  const { nextState } = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-30', method: 'Cash'
  }, OCT_2);
  const customer = nextState.customers.find(c => c.id === 'seed-001');
  const bill = customer.bills.find(b => b.payments.length > 0);
  const receipt = buildPaymentReceipt(customer, bill, bill.payments[0]);
  assert.equal(receipt.paymentDate, '2026-09-30');
});

/* ---------------- wiring + i18n ---------------- */

test('wiring: chips in the sheet markup, helper wired in the modal, module outside the build entries', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const chip of ['today', 'yesterday', 'prev-month-end', 'custom']) {
    assert.ok(html.includes(`data-qc-date-chip="${chip}"`), `missing chip ${chip}`);
  }
  assert.ok(html.includes('id="quickCollectDateInput"'));

  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes("from './backdated-payment-helper.js'"));
  assert.ok(qc.includes('computePaymentDateChip('));
  assert.ok(qc.includes('isFuturePaymentDate('));
  assert.ok(qc.includes("t('bdate_future_error')"));

  const build = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.ok(!build.includes('backdated-payment-helper'),
    'helper must stay out of ENTRY_FILES (dist stays at the 25-file budget)');

  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const chipBlock = css.slice(css.indexOf('.qc-date-chips'), css.indexOf('.qc-form-row'));
  assert.ok(chipBlock.includes('.qc-date-chip'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(chipBlock), 'date-chip CSS must be theme tokens only (no new hex)');
});

test('i18n: every bdate_* key exists in both dictionaries and t() never returns a raw key', () => {
  const keys = ['bdate_chips_aria', 'bdate_chip_today', 'bdate_chip_yesterday', 'bdate_chip_prev_month_end', 'bdate_chip_custom', 'bdate_future_error'];
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur ${key}`);
    assert.notEqual(t(key, 'en'), key);
    assert.notEqual(t(key, 'ur'), key);
  }
});
