// Plan 400 — Transaction daily entry summary on the entry screen:
// during a busy day the operator has no running sense of how much
// has been taken today, so the day's total is only discovered at
// settlement time. One live daily summary on the transaction entry
// screen — today's transaction count and total amount on this
// device, updated after each save. It summarises only: it settles
// nothing and never changes any bill, payment, digest, or
// settlement record. The owner digest and the collector settlement
// statement already exist and are left alone; the offline queue view
// already lists today's recorded transactions, but it is a list,
// not a count and total. This plan adds only the summary, derived
// from the transaction rows the app already projects, with no store
// of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isStrictSummaryDate,
  formatSummaryAmount,
  dailyEntrySummary,
  dailyEntrySummaryText,
} from '../daily-entry-summary.js';
import {
  addPayment,
  listTransactions,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
} from '../core.js';

const SEP_5 = new Date('2026-09-05T12:00:00Z');
const NOV_7 = new Date('2026-11-07T12:00:00Z');
const TODAY = '2026-11-07';

function stateWithBills(monthlySellingAmount = 3000) {
  let state = createInitialState(['Customer One', 'Customer Two']);
  // Priced from September so the fixture carries Sep, Oct and Nov
  // 2026 bills (the Plan 385 pattern): a November-only pricing
  // leaves October unpriced, and a payment for October would create
  // an unpriced bill instead of settling a priced one.
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: String(monthlySellingAmount) }, SEP_5);
  state = updateCustomerProfile(state, 'seed-002', { monthlySellingAmount: String(monthlySellingAmount) }, SEP_5);
  return generateMonthlyBillsThroughCurrentMonth(state, NOV_7);
}

function payOn(state, customerId, month, fields, referenceDate) {
  return addPayment(state, customerId, month, {
    amount: 1000,
    date: '2026-11-07',
    method: 'Cash',
    ...fields,
  }, referenceDate);
}

function row(overrides = {}) {
  return {
    paymentId: 'pay-001',
    customerNumber: 36,
    customerName: 'Customer One',
    amount: 3000,
    date: '2026-11-07',
    method: 'Cash',
    recordedAt: '2026-11-07T04:00:00.000Z',
    month: '2026-11',
    voided: false,
    ...overrides,
  };
}

// --- Strict date ---

test('Plan 400: isStrictSummaryDate accepts only real YYYY-MM-DD calendar dates', () => {
  for (const date of ['2026-01-01', '2026-11-07', '2026-12-31', '2028-02-29', '2000-02-29']) {
    assert.equal(isStrictSummaryDate(date), true, date);
  }
  for (const bad of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-32', '2026-11-00', '2026-11', '2026/11/07', '07 Nov 2026', '', ' 2026-11-07', '2026-11-07 ', null, undefined, 20261107, {}, []]) {
    assert.equal(isStrictSummaryDate(bad), false, String(bad));
  }
});

// --- Amount formatting ---

test('Plan 400: formatSummaryAmount prints PKR with min-0 decimals', () => {
  assert.equal(formatSummaryAmount(3000), 'PKR 3,000');
  assert.equal(formatSummaryAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatSummaryAmount(0), 'PKR 0');
  assert.equal(formatSummaryAmount('2500'), 'PKR 2,500');
  assert.equal(formatSummaryAmount(-3000), 'PKR -3,000');
});

test('Plan 400: formatSummaryAmount never prints a missing amount as PKR 0', () => {
  for (const missing of [null, undefined, '', true, false, Number.NaN, 'abc', {}]) {
    assert.equal(formatSummaryAmount(missing), 'Not set', String(missing));
  }
});

// --- Summary computation ---

test('Plan 400: dailyEntrySummary counts and totals exactly today\'s rows', () => {
  const summary = dailyEntrySummary([
    row({ paymentId: 'pay-001', amount: 3000 }),
    row({ paymentId: 'pay-002', amount: 2000 }),
    row({ paymentId: 'pay-003', amount: 1500.5 }),
  ], TODAY);
  assert.deepEqual(summary, { date: TODAY, count: 3, total: 6500.5 });
});

test('Plan 400: dailyEntrySummary is empty for an empty day', () => {
  assert.deepEqual(dailyEntrySummary([], TODAY), { date: TODAY, count: 0, total: 0 });
  assert.deepEqual(dailyEntrySummary(null, TODAY), { date: TODAY, count: 0, total: 0 });
  assert.deepEqual(dailyEntrySummary(undefined, TODAY), { date: TODAY, count: 0, total: 0 });
});

test('Plan 400: dailyEntrySummary needs a strict today key', () => {
  assert.deepEqual(dailyEntrySummary([row()], '2026-11'), { date: '', count: 0, total: 0 });
  assert.deepEqual(dailyEntrySummary([row()], null), { date: '', count: 0, total: 0 });
  assert.deepEqual(dailyEntrySummary([row()], ''), { date: '', count: 0, total: 0 });
});

test('Plan 400: dailyEntrySummary skips other days and bad dates', () => {
  const summary = dailyEntrySummary([
    row({ paymentId: 'pay-001', amount: 3000, date: '2026-11-07' }),
    row({ paymentId: 'pay-002', amount: 2000, date: '2026-11-06' }),
    row({ paymentId: 'pay-003', amount: 5000, date: '2026-11-08' }),
    row({ paymentId: 'pay-004', amount: 4000, date: '2026-02-30' }),
    row({ paymentId: 'pay-005', amount: 4000, date: '' }),
    row({ paymentId: 'pay-006', amount: 4000, date: undefined }),
  ], TODAY);
  assert.deepEqual(summary, { date: TODAY, count: 1, total: 3000 });
});

test('Plan 400: dailyEntrySummary skips voided rows for both count and total', () => {
  const summary = dailyEntrySummary([
    row({ paymentId: 'pay-001', amount: 3000 }),
    row({ paymentId: 'pay-002', amount: 2000, voided: true }),
    row({ paymentId: 'pay-003', amount: 1000, voided: false }),
  ], TODAY);
  assert.deepEqual(summary, { date: TODAY, count: 2, total: 4000 });
});

test('Plan 400: dailyEntrySummary counts a reversal and nets it into the total', () => {
  const summary = dailyEntrySummary([
    row({ paymentId: 'pay-001', amount: 3000 }),
    row({ paymentId: 'pay-002', amount: -3000 }),
  ], TODAY);
  assert.deepEqual(summary, { date: TODAY, count: 2, total: 0 });
});

test('Plan 400: dailyEntrySummary counts a row with a missing amount but never sums it as zero', () => {
  const summary = dailyEntrySummary([
    row({ paymentId: 'pay-001', amount: 3000 }),
    row({ paymentId: 'pay-002', amount: null }),
    row({ paymentId: 'pay-003', amount: undefined }),
    row({ paymentId: 'pay-004', amount: 'abc' }),
  ], TODAY);
  assert.deepEqual(summary, { date: TODAY, count: 4, total: 3000 });
});

test('Plan 400: dailyEntrySummary skips non-object rows and never mutates its inputs', () => {
  const rows = [row({ paymentId: 'pay-001', amount: 3000 }), null, undefined, 'pay-002', 42];
  const before = JSON.stringify(rows);
  const summary = dailyEntrySummary(rows, TODAY);
  assert.deepEqual(summary, { date: TODAY, count: 1, total: 3000 });
  assert.equal(JSON.stringify(rows), before);
});

// --- Summary text ---

test('Plan 400: dailyEntrySummaryText says an empty day plainly', () => {
  assert.equal(dailyEntrySummaryText({ date: TODAY, count: 0, total: 0 }), 'Today: no payments yet');
  assert.equal(dailyEntrySummaryText(null), 'Today: no payments yet');
  assert.equal(dailyEntrySummaryText(undefined), 'Today: no payments yet');
  assert.equal(dailyEntrySummaryText({}), 'Today: no payments yet');
});

test('Plan 400: dailyEntrySummaryText uses the singular for one payment', () => {
  assert.equal(dailyEntrySummaryText({ date: TODAY, count: 1, total: 3000 }), 'Today: 1 payment · PKR 3,000');
});

test('Plan 400: dailyEntrySummaryText prints count and total for several payments', () => {
  assert.equal(dailyEntrySummaryText({ date: TODAY, count: 3, total: 9000 }), 'Today: 3 payments · PKR 9,000');
  assert.equal(dailyEntrySummaryText({ date: TODAY, count: 2, total: 1500.5 }), 'Today: 2 payments · PKR 1,500.5');
  assert.equal(dailyEntrySummaryText({ date: TODAY, count: 2, total: 0 }), 'Today: 2 payments · PKR 0');
});

// --- Acceptance: same fixture ---

test('Plan 400: the count and total match today\'s recorded transactions on the same fixture', () => {
  let state = stateWithBills();
  state = payOn(state, 'seed-001', '2026-11', { amount: 1000 }, NOV_7);
  state = payOn(state, 'seed-001', '2026-10', { amount: 2000, date: '2026-11-07' }, NOV_7);
  state = payOn(state, 'seed-002', '2026-11', { amount: 1500 }, NOV_7);
  state = payOn(state, 'seed-002', '2026-11', { amount: 5000, date: '2026-11-06' }, NOV_7);
  const summary = dailyEntrySummary(listTransactions(state), TODAY);
  assert.deepEqual(summary, { date: TODAY, count: 3, total: 4500 });
});

test('Plan 400: the summary updates immediately after a save', () => {
  let state = stateWithBills();
  state = payOn(state, 'seed-001', '2026-11', { amount: 1000 }, NOV_7);
  const before = dailyEntrySummary(listTransactions(state), TODAY);
  assert.deepEqual(before, { date: TODAY, count: 1, total: 1000 });
  // One more save on the same day.
  state = payOn(state, 'seed-002', '2026-11', { amount: 2500 }, NOV_7);
  const after = dailyEntrySummary(listTransactions(state), TODAY);
  assert.deepEqual(after, { date: TODAY, count: 2, total: 3500 });
  assert.equal(dailyEntrySummaryText(after), 'Today: 2 payments · PKR 3,500');
});

test('Plan 400: the summary never changes any bill, payment, or customer record by itself', () => {
  const state = stateWithBills();
  const before = JSON.stringify(state);
  const rows = listTransactions(state);
  dailyEntrySummary(rows, TODAY);
  dailyEntrySummaryText({ date: TODAY, count: 0, total: 0 });
  assert.equal(JSON.stringify(state), before);
  assert.equal(JSON.stringify(rows), JSON.stringify(listTransactions(state)));
});

// --- Wiring ---

test('Plan 400: the Quick Collect sheet keeps the summary module for the target progress, not the entry line', () => {
  // QC Modal Overhaul 2: the 'Today payments' entry-summary LINE is
  // REMOVED from the form step (the stray line the spec deletes) —
  // so the dailyEntrySummaryText import and the refresh call go with
  // it. The dailyEntrySummary import STAYS: refreshDailyTargetProgress
  // still uses it for the 'Today' banner line, which is the one
  // summary the picker keeps.
  const src = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(src.includes("from './daily-entry-summary.js'"), 'the module import must stay for the target progress');
  assert.ok(src.includes('dailyEntrySummary'), 'dailyEntrySummary must still be used by the target progress');
  assert.ok(!src.includes('dailyEntrySummaryText'), 'the entry-line text import must be gone');
  assert.ok(!src.includes('refreshDailyEntrySummary'), 'the entry-line refresh must be gone');
  assert.ok(src.includes('listTransactions'), 'missing listTransactions import');
});

test('Plan 400: the entry-summary refresh is gone — updateCounts no longer refreshes a deleted line', () => {
  // QC Modal Overhaul 2: refreshDailyEntrySummary() is deleted with
  // the line it refreshed. updateCounts() still runs (it refreshes
  // the round totals and the target progress); it simply has no
  // entry-summary call left inside it.
  const src = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('refreshDailyEntrySummary'), 'the refresh function must be gone');
  const updateCounts = src.match(/function updateCounts\(\) \{[\s\S]*?\n  \}/);
  assert.ok(updateCounts, 'updateCounts not found');
  assert.ok(!updateCounts[0].includes('refreshDailyEntrySummary();'), 'updateCounts must not refresh a deleted line');
});

test('Plan 400: the summary refreshes after a save, through updateCounts on the success path', () => {
  const src = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(src.includes("showStep('success');\n      updateCounts();"), 'updateCounts must run on the success path after a save');
});

test('Plan 400: the entry screen no longer carries the summary line inside the form step', () => {
  // QC Modal Overhaul 2: the 'Today payments' line is deleted — the
  // form step fits on one screen without it. The form step and the
  // payment form stay, in the same order.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('<p id="quickCollectDailyEntrySummary" class="des-summary"'), 'the summary line element must be gone');
  assert.ok(!html.includes('id="quickCollectDailyEntrySummary"'), 'no summary host may remain');
  const formStep = html.indexOf('id="quickCollectStepForm"');
  const paymentForm = html.indexOf('id="quickCollectPaymentForm"');
  assert.ok(formStep !== -1 && paymentForm !== -1, 'anchors missing');
  assert.ok(formStep < paymentForm, 'the form step must still sit before the payment form');
});

// --- Fences ---

test('Plan 400: the digest and settlement modules are untouched by the summary', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenceFiles = ['owner-' + 'digest.js', 'collector-' + 'settlements.js', 'dashboard-' + 'daily-closing.js'];
  for (const file of fenceFiles) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('dailyEntrySummary'), `${file} must not reference the summary`);
    assert.ok(!src.includes('quickCollectDailyEntrySummary'), `${file} must not reference the summary line`);
  }
});

test('Plan 400: the module header never names a fenced file literally', () => {
  const src = readFileSync(new URL('../daily-entry-summary.js', import.meta.url), 'utf8');
  const fenced = ['owner-' + 'digest.js', 'collector-' + 'settlements.js', 'offline-' + 'queue-status.js'];
  for (const name of fenced) {
    assert.ok(!src.includes(name), `module header must not name ${name}`);
  }
});

test('Plan 400: the summary module is pure — no clock, no storage, no store key', () => {
  const src = readFileSync(new URL('../daily-entry-summary.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('new Date('), 'module must not read the clock');
  assert.ok(!src.includes('Date.now('), 'module must not read the clock');
  assert.ok(!src.includes('localStorage'), 'module must not touch storage');
  assert.ok(!src.includes('sessionStorage'), 'module must not touch storage');
  assert.ok(!src.includes('shahdara_'), 'module must not hold a store key');
  assert.ok(!/\bOLT\b/.test(src), 'module must not name the OLT word');
});

// --- Styles ---

test('Plan 400: styles reuse existing colours only — no new hex in the summary rule', () => {
  // QC Modal Overhaul 2: the .des-summary rule is deleted with the
  // line it styled (dead-rule precedent). The no-new-hex invariant
  // is vacuous now — there is no .des- rule left to carry one.
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const summaryRules = stylesSrc.match(/\.des-[^{]+\{[^}]*\}/g) || [];
  assert.equal(summaryRules.length, 0, `expected no .des- rules, found ${summaryRules.length}`);
});
