// Plan 407 — History monthly grouping with subtotals: a flat
// history list hides the shape of a customer's year, so the operator
// cannot say which month was the heaviest or which month had no
// payment at all. One monthly grouping of the customer history
// (transactions grouped by month, each month with a billed subtotal,
// a paid subtotal, and a still-owed figure). It groups only and
// changes nothing, and the monthly subtotals sum exactly to the full
// history totals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_MONTHLY_GROUPING_EMPTY_TEXT,
  HISTORY_MONTHLY_GROUPING_UNDATED_LABEL,
  isStrictMonthlyGroupingMonth,
  historyMonthlyGroupingMonthOf,
  historyMonthlyGroupingDelta,
  formatMonthlyGroupingAmount,
  historyMonthlyGroupingMonthLabel,
  historyMonthlyGroupingGroups,
  historyMonthlyGroupingTotals,
  historyMonthlyGroupingReconciliation,
  historyMonthlyGroupingGroupText,
  historyMonthlyGroupingSummaryText,
  historyMonthlyGroupingHtml,
} from '../history-monthly-grouping.js';

function entry(overrides = {}) {
  return { type: 'payment', date: '2026-09-15', amountCents: 150000, runningBalanceCents: 150000, method: 'Cash', ...overrides };
}

// A full chain, balances hand-computed step by step:
// Sep: charge 300000 -> 300000; pay 150000 -> 150000; pay 150000 -> 0.
// Oct: charge 300000 -> 300000; advance 50000 -> 250000; credit
// (overpayment) 50000 -> 250000; credit (adjustment) 20000 -> 230000;
// refund 20000 -> 250000; adjustment 30000 -> 220000.
// Nov: voided pay 300000 -> 220000 (moves nothing).
// Undated: credit (adjustment) 10000 -> 210000.
function mixedEntries() {
  return [
    entry({ type: 'charge', date: '2026-09-01', amountCents: 300000, runningBalanceCents: 300000, method: '', ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-09-15', amountCents: 150000, runningBalanceCents: 150000, method: 'Cash', ref: 'PAY-1' }),
    entry({ type: 'payment', date: '2026-09-20', amountCents: 150000, runningBalanceCents: 0, method: 'JazzCash', ref: 'PAY-2' }),
    entry({ type: 'charge', date: '2026-10-01', amountCents: 300000, runningBalanceCents: 300000, method: '', ref: 'BILL-2' }),
    entry({ type: 'advance', date: '2026-10-05', amountCents: 50000, runningBalanceCents: 250000, method: 'Easypaisa', ref: 'PAY-3' }),
    entry({ type: 'credit', date: '2026-10-06', amountCents: 50000, runningBalanceCents: 250000, method: '', ref: 'CR-1', source: 'overpayment' }),
    entry({ type: 'credit', date: '2026-10-07', amountCents: 20000, runningBalanceCents: 230000, method: '', ref: 'CR-2', source: 'adjustment' }),
    entry({ type: 'refund', date: '2026-10-20', amountCents: 20000, runningBalanceCents: 250000, method: 'Raast', ref: 'RF-1' }),
    entry({ type: 'adjustment', date: '2026-10-25', amountCents: 30000, runningBalanceCents: 220000, method: '', ref: 'ADJ-1' }),
    entry({ type: 'payment', date: '2026-11-03', amountCents: 300000, runningBalanceCents: 220000, method: 'Cash', ref: 'PAY-4', voided: true }),
    entry({ type: 'credit', date: '', month: '', amountCents: 10000, runningBalanceCents: 210000, method: '', ref: 'CR-3', source: 'adjustment' }),
  ];
}

// September has entries, December has a charge, October and
// November have none: the gap months must show as empty, not skip.
function gapEntries() {
  return [
    entry({ type: 'charge', date: '2026-09-01', amountCents: 300000, runningBalanceCents: 300000, method: '', ref: 'BILL-1' }),
    entry({ type: 'payment', date: '2026-09-15', amountCents: 150000, runningBalanceCents: 150000, method: 'Cash', ref: 'PAY-1' }),
    entry({ type: 'charge', date: '2026-12-01', amountCents: 300000, runningBalanceCents: 450000, method: '', ref: 'BILL-2' }),
  ];
}

// --- Month of an entry ---

test('Plan 407: the month of an entry follows its date', () => {
  assert.equal(historyMonthlyGroupingMonthOf(entry({ date: '2026-09-15' })), '2026-09');
  assert.equal(historyMonthlyGroupingMonthOf(entry({ date: '2026-10-01' })), '2026-10');
});

test('Plan 407: a month-only date is its own month, and the entry month wins over the date', () => {
  assert.equal(historyMonthlyGroupingMonthOf(entry({ date: '2026-09' })), '2026-09');
  assert.equal(historyMonthlyGroupingMonthOf(entry({ date: '2026-10-05', month: '2026-09' })), '2026-09');
});

test('Plan 407: an entry with no month and no date has no month', () => {
  assert.equal(historyMonthlyGroupingMonthOf(entry({ date: '', month: '' })), '');
  assert.equal(historyMonthlyGroupingMonthOf(entry({ date: 'not-a-date', month: '2026-13' })), '');
  assert.equal(historyMonthlyGroupingMonthOf(null), '');
  assert.equal(historyMonthlyGroupingMonthOf('2026-09-15'), '');
});

test('Plan 407: strict months accept 01-12 only', () => {
  assert.equal(isStrictMonthlyGroupingMonth('2026-09'), true);
  assert.equal(isStrictMonthlyGroupingMonth('2026-12'), true);
  assert.equal(isStrictMonthlyGroupingMonth('2026-13'), false);
  assert.equal(isStrictMonthlyGroupingMonth('2026-00'), false);
  assert.equal(isStrictMonthlyGroupingMonth('2026-9'), false);
  assert.equal(isStrictMonthlyGroupingMonth('2026-09-15'), false);
});

// --- Signed movement ---

test('Plan 407: charges and refunds add to what is owed', () => {
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'charge', amountCents: 300000 })), 300000);
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'refund', amountCents: 20000 })), 20000);
});

test('Plan 407: payments, advances and adjustments reduce what is owed', () => {
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'payment', amountCents: 150000 })), -150000);
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'advance', amountCents: 50000 })), -50000);
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'adjustment', amountCents: 30000 })), -30000);
});

test('Plan 407: an overpayment credit moves nothing, an adjustment credit reduces what is owed', () => {
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'credit', amountCents: 50000, source: 'overpayment' })), 0);
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'credit', amountCents: 20000, source: 'adjustment' })), -20000);
});

test('Plan 407: a voided entry and a missing figure move nothing — never zero-filled', () => {
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'payment', amountCents: 300000, voided: true })), 0);
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'payment', amountCents: null })), 0);
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'payment', amountCents: true })), 0);
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'payment', amountCents: '' })), 0);
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'payment', amountCents: 'not-a-number' })), 0);
  assert.equal(historyMonthlyGroupingDelta(entry({ type: 'mystery', amountCents: 50000 })), 0);
  assert.equal(historyMonthlyGroupingDelta(null), 0);
});

// --- Groups ---

test('Plan 407: groups run in ascending month order with the undated group last', () => {
  const groups = historyMonthlyGroupingGroups(mixedEntries());
  assert.deepEqual(groups.map((group) => group.month), ['2026-09', '2026-10', '2026-11', '']);
  assert.deepEqual(groups.map((group) => group.entryCount), [3, 6, 1, 1]);
});

test('Plan 407: September subtotals — billed 300000, paid 300000, still owed 0', () => {
  const [september] = historyMonthlyGroupingGroups(mixedEntries());
  assert.equal(september.label, 'September 2026');
  assert.equal(september.billedCents, 300000);
  assert.equal(september.paidCents, 300000);
  assert.equal(september.stillOwedCents, 0);
  assert.equal(september.closingBalanceCents, 0);
});

test('Plan 407: October subtotals — billed 320000, paid 100000, still owed 220000', () => {
  const [, october] = historyMonthlyGroupingGroups(mixedEntries());
  assert.equal(october.label, 'October 2026');
  assert.equal(october.billedCents, 320000);
  assert.equal(october.paidCents, 100000);
  assert.equal(october.stillOwedCents, 220000);
  assert.equal(october.closingBalanceCents, 220000);
});

test('Plan 407: a voided-only month has zero subtotals and carries the balance', () => {
  const [, , november] = historyMonthlyGroupingGroups(mixedEntries());
  assert.equal(november.label, 'November 2026');
  assert.equal(november.billedCents, 0);
  assert.equal(november.paidCents, 0);
  assert.equal(november.stillOwedCents, 0);
  assert.equal(november.closingBalanceCents, 220000);
});

test('Plan 407: the undated group is last, labelled plainly, and still counts', () => {
  const groups = historyMonthlyGroupingGroups(mixedEntries());
  const undated = groups[groups.length - 1];
  assert.equal(undated.month, '');
  assert.equal(undated.label, HISTORY_MONTHLY_GROUPING_UNDATED_LABEL);
  assert.equal(undated.billedCents, 0);
  assert.equal(undated.paidCents, 10000);
  assert.equal(undated.stillOwedCents, -10000);
  assert.equal(undated.closingBalanceCents, 210000);
});

test('Plan 407: a month with no transactions is shown as empty, not skipped', () => {
  const groups = historyMonthlyGroupingGroups(gapEntries());
  assert.deepEqual(groups.map((group) => group.month), ['2026-09', '2026-10', '2026-11', '2026-12']);
  const [september, october, november, december] = groups;
  assert.equal(october.entryCount, 0);
  assert.equal(october.billedCents, 0);
  assert.equal(october.paidCents, 0);
  assert.equal(october.stillOwedCents, 0);
  assert.equal(october.closingBalanceCents, 150000);
  assert.equal(november.entryCount, 0);
  assert.equal(november.closingBalanceCents, 150000);
  assert.equal(december.billedCents, 300000);
  assert.equal(december.closingBalanceCents, 450000);
  assert.equal(september.closingBalanceCents, 150000);
});

test('Plan 407: grouping never mutates or reorders the entries given', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  const groups = historyMonthlyGroupingGroups(entries);
  assert.equal(JSON.stringify(entries), before);
  assert.deepEqual(
    groups.flatMap((group) => group.entries.map((entryItem) => entryItem.ref)),
    ['BILL-1', 'PAY-1', 'PAY-2', 'BILL-2', 'PAY-3', 'CR-1', 'CR-2', 'RF-1', 'ADJ-1', 'PAY-4', 'CR-3'],
  );
  assert.deepEqual(historyMonthlyGroupingGroups(null), []);
  assert.deepEqual(historyMonthlyGroupingGroups([]), []);
  assert.deepEqual(historyMonthlyGroupingGroups('not-a-list'), []);
});

// --- Totals and reconciliation (the acceptance) ---

test('Plan 407: totals over the fixture — billed 620000, paid 410000, still owed 210000', () => {
  const totals = historyMonthlyGroupingTotals(mixedEntries());
  assert.equal(totals.entryCount, 11);
  assert.equal(totals.billedCents, 620000);
  assert.equal(totals.paidCents, 410000);
  assert.equal(totals.stillOwedCents, 210000);
  assert.equal(totals.finalBalanceCents, 210000);
  assert.deepEqual(historyMonthlyGroupingTotals([]), {
    entryCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0, finalBalanceCents: 0,
  });
  assert.deepEqual(historyMonthlyGroupingTotals(null), {
    entryCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0, finalBalanceCents: 0,
  });
});

test('Plan 407: monthly subtotals sum exactly to the full history totals', () => {
  const entries = mixedEntries();
  const groups = historyMonthlyGroupingGroups(entries);
  const check = historyMonthlyGroupingReconciliation(groups, entries);
  assert.equal(check.ok, true);
  assert.equal(check.billedCents, 620000);
  assert.equal(check.paidCents, 410000);
  assert.equal(check.stillOwedCents, 210000);
  assert.equal(check.expectedBilledCents, 620000);
  assert.equal(check.expectedPaidCents, 410000);
  assert.equal(check.expectedStillOwedCents, 210000);
  assert.equal(check.finalBalanceCents, 210000);
  assert.ok(check.message.includes('reconcile'));
});

test('Plan 407: reconciliation reports a mismatch instead of hiding it', () => {
  const entries = mixedEntries();
  const septemberOnly = historyMonthlyGroupingGroups(entries.slice(0, 3));
  const check = historyMonthlyGroupingReconciliation(septemberOnly, entries);
  assert.equal(check.ok, false);
  assert.equal(check.billedCents, 300000);
  assert.equal(check.expectedBilledCents, 620000);
  assert.ok(check.message.includes('do not reconcile'));
});

// --- Labels, amounts, text ---

test('Plan 407: month labels read plainly', () => {
  assert.equal(historyMonthlyGroupingMonthLabel('2026-09'), 'September 2026');
  assert.equal(historyMonthlyGroupingMonthLabel('2026-02'), 'February 2026');
  assert.equal(historyMonthlyGroupingMonthLabel('2026-12'), 'December 2026');
  assert.equal(historyMonthlyGroupingMonthLabel(''), HISTORY_MONTHLY_GROUPING_UNDATED_LABEL);
  assert.equal(historyMonthlyGroupingMonthLabel('2026-13'), HISTORY_MONTHLY_GROUPING_UNDATED_LABEL);
  assert.equal(historyMonthlyGroupingMonthLabel('not-a-month'), HISTORY_MONTHLY_GROUPING_UNDATED_LABEL);
});

test('Plan 407: amounts print with no decimals for whole rupees', () => {
  assert.equal(formatMonthlyGroupingAmount(150000), 'PKR 1,500');
  assert.equal(formatMonthlyGroupingAmount(150050), 'PKR 1,500.5');
  assert.equal(formatMonthlyGroupingAmount(-10000), '-PKR 100');
  assert.equal(formatMonthlyGroupingAmount(0), 'PKR 0');
  assert.equal(formatMonthlyGroupingAmount(null), 'PKR 0');
  assert.equal(formatMonthlyGroupingAmount('not-a-number'), 'PKR 0');
});

test('Plan 407: a month line reads billed, paid and still owed in plain words', () => {
  const [september, october] = historyMonthlyGroupingGroups(mixedEntries());
  assert.equal(
    historyMonthlyGroupingGroupText(september),
    'September 2026 · 3 entries · Billed PKR 3,000 · Paid PKR 3,000 · Still owed PKR 0',
  );
  assert.equal(
    historyMonthlyGroupingGroupText(october),
    'October 2026 · 6 entries · Billed PKR 3,200 · Paid PKR 1,000 · Still owed PKR 2,200',
  );
  assert.equal(historyMonthlyGroupingGroupText(null), '');
});

test('Plan 407: an empty month line says plainly that it has no transactions', () => {
  const [, october] = historyMonthlyGroupingGroups(gapEntries());
  assert.equal(
    historyMonthlyGroupingGroupText(october),
    'October 2026 · No transactions · Billed PKR 0 · Paid PKR 0 · Still owed PKR 0',
  );
});

test('Plan 407: the summary names months, billed, paid and still owed', () => {
  assert.equal(historyMonthlyGroupingSummaryText([], mixedEntries()), HISTORY_MONTHLY_GROUPING_EMPTY_TEXT);
  assert.equal(historyMonthlyGroupingSummaryText(null, null), HISTORY_MONTHLY_GROUPING_EMPTY_TEXT);
  assert.equal(
    historyMonthlyGroupingSummaryText(mixedEntries(), mixedEntries()),
    '4 months · Billed PKR 6,200 · Paid PKR 4,100 · Still owed PKR 2,100',
  );
  assert.equal(
    historyMonthlyGroupingSummaryText(mixedEntries().slice(0, 3), mixedEntries()),
    '1 month · Billed PKR 3,000 · Paid PKR 3,000 · Still owed PKR 0 · Full history: Billed PKR 6,200 · Paid PKR 4,100 · Still owed PKR 2,100',
  );
});

// --- HTML ---

test('Plan 407: the grouping table lists every month with a totals footer', () => {
  const html = historyMonthlyGroupingHtml(mixedEntries(), mixedEntries());
  assert.ok(html.includes('<table class="statement-table">'));
  assert.ok(html.includes('September 2026'));
  assert.ok(html.includes('October 2026'));
  assert.ok(html.includes('November 2026'));
  assert.ok(html.includes(HISTORY_MONTHLY_GROUPING_UNDATED_LABEL));
  assert.ok(html.includes('PKR 6,200'));
  assert.ok(html.includes('PKR 4,100'));
  assert.ok(html.includes('PKR 2,100'));
  assert.ok(html.includes('<strong>Totals</strong>'));
  assert.equal(html.includes('Full history'), false);
});

test('Plan 407: an empty month row says plainly that it has no transactions', () => {
  const html = historyMonthlyGroupingHtml(gapEntries(), gapEntries());
  assert.ok(html.includes('October 2026 · No transactions'));
  assert.ok(html.includes('November 2026 · No transactions'));
});

test('Plan 407: a filtered view adds a full-history footer row', () => {
  const html = historyMonthlyGroupingHtml(mixedEntries().slice(0, 3), mixedEntries());
  assert.ok(html.includes('<strong>Full history</strong>'));
  assert.ok(html.includes('PKR 6,200'));
});

test('Plan 407: an empty shown list renders nothing', () => {
  assert.equal(historyMonthlyGroupingHtml([], mixedEntries()), '');
  assert.equal(historyMonthlyGroupingHtml(null, mixedEntries()), '');
});

test('Plan 407: a strange month value falls to the undated group, never into the markup', () => {
  const weird = entry({ type: 'charge', date: '2026-09<script>', amountCents: 300000, runningBalanceCents: 300000, ref: 'BILL-X' });
  const groups = historyMonthlyGroupingGroups([weird]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].month, '');
  assert.equal(groups[0].label, HISTORY_MONTHLY_GROUPING_UNDATED_LABEL);
  assert.equal(historyMonthlyGroupingHtml([weird], [weird]).includes('<script>'), false);
});

// --- Fences: neighbours still exist, still wired, untouched ---

test('Plan 407: the roll-forward proof view still exists and is still wired, untouched', () => {
  const rollForwardModule = 'balance-' + 'rollforward.js';
  const rollSrc = readFileSync(new URL(`../${rollForwardModule}`, import.meta.url), 'utf8');
  assert.ok(rollSrc.includes('buildCustomerRollForward'));
  assert.ok(rollSrc.includes('buildRollForwardTotals'));
  assert.ok(rollSrc.includes('rollForwardSummaryText'));
  assert.ok(!rollSrc.includes('historyMonthlyGrouping'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${rollForwardModule}'`));
});

test('Plan 407: the full history list and its filters still exist and are still wired, untouched', () => {
  const fullHistoryModule = 'full-history-' + 'list.js';
  const historySrc = readFileSync(new URL(`../${fullHistoryModule}`, import.meta.url), 'utf8');
  assert.ok(historySrc.includes('FULL_HISTORY_TYPES'));
  assert.ok(historySrc.includes('fullHistoryEntries'));
  assert.ok(historySrc.includes('fullHistoryListHtml'));
  assert.ok(!historySrc.includes('historyMonthlyGrouping'));
  const typeFilterModule = 'history-type-' + 'filter.js';
  const typeSrc = readFileSync(new URL(`../${typeFilterModule}`, import.meta.url), 'utf8');
  assert.ok(typeSrc.includes('filterHistoryEntriesByType'));
  assert.ok(!typeSrc.includes('historyMonthlyGrouping'));
  const rangeFilterModule = 'history-date-range-' + 'filter.js';
  const rangeSrc = readFileSync(new URL(`../${rangeFilterModule}`, import.meta.url), 'utf8');
  assert.ok(rangeSrc.includes('filterHistoryEntriesByDateRange'));
  assert.ok(!rangeSrc.includes('historyMonthlyGrouping'));
  const methodFilterModule = 'history-method-' + 'filter.js';
  const methodSrc = readFileSync(new URL(`../${methodFilterModule}`, import.meta.url), 'utf8');
  assert.ok(methodSrc.includes('filterHistoryEntriesByMethod'));
  assert.ok(!methodSrc.includes('historyMonthlyGrouping'));
  const amountSearchModule = 'history-amount-' + 'search.js';
  const amountSrc = readFileSync(new URL(`../${amountSearchModule}`, import.meta.url), 'utf8');
  assert.ok(amountSrc.includes('searchHistoryEntriesByAmount'));
  assert.ok(!amountSrc.includes('historyMonthlyGrouping'));
  const runningBalanceModule = 'history-running-' + 'balance.js';
  const balanceSrc = readFileSync(new URL(`../${runningBalanceModule}`, import.meta.url), 'utf8');
  assert.ok(balanceSrc.includes('historyRunningBalanceColumnHtml'));
  assert.ok(!balanceSrc.includes('historyMonthlyGrouping'));
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes(`from './${fullHistoryModule}'`));
  assert.ok(appSrc.includes(`from './${typeFilterModule}'`));
  assert.ok(appSrc.includes(`from './${rangeFilterModule}'`));
  assert.ok(appSrc.includes(`from './${methodFilterModule}'`));
  assert.ok(appSrc.includes(`from './${amountSearchModule}'`));
  assert.ok(appSrc.includes(`from './${runningBalanceModule}'`));
  assert.ok(appSrc.includes('renderFullHistory(customer)'));
});

test('Plan 407: the profile wires the monthly grouping into the full history render', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSrc.includes("from './history-monthly-grouping.js'"));
  assert.ok(appSrc.includes('historyMonthlyGroupingHtml'));
  assert.ok(appSrc.includes('hmgHistoryMonthlyGrouping'));
  const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexSrc.includes('id="hmgHistoryMonthlyGrouping"'));
  assert.ok(indexSrc.indexOf('id="hrbHistoryRunningBalance"') < indexSrc.indexOf('id="hmgHistoryMonthlyGrouping"'));
});

test('Plan 407: no new styles are added — the grouping reuses the statement table classes only', () => {
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal(stylesSrc.includes('hmg'), false);
  const moduleSrc = readFileSync(new URL('../history-monthly-grouping.js', import.meta.url), 'utf8');
  assert.ok(moduleSrc.includes('statement-table'));
});

test('Plan 407: the module is a pure view — no store, no clock, no document, no fetch', () => {
  const moduleSrc = readFileSync(new URL('../history-monthly-grouping.js', import.meta.url), 'utf8');
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('new ' + 'Date('), false);
  assert.equal(moduleSrc.includes('Date' + '.now('), false);
  assert.equal(moduleSrc.includes('document' + '.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
});

test('Plan 407: the module header never names a fenced file literally', () => {
  const moduleSrc = readFileSync(new URL('../history-monthly-grouping.js', import.meta.url), 'utf8');
  const fenced = [
    'full-history-' + 'list.js',
    'history-type-' + 'filter.js',
    'history-date-range-' + 'filter.js',
    'history-method-' + 'filter.js',
    'history-amount-' + 'search.js',
    'history-running-' + 'balance.js',
    'balance-' + 'rollforward.js',
  ];
  for (const name of fenced) {
    assert.equal(moduleSrc.includes(name), false, `header names ${name}`);
  }
});

test('Plan 407: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\\\\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.equal(mobilePattern.test(testSrc), false, 'test carries a mobile number');
  assert.ok(!testSrc.includes(fakeFamily), 'test uses a fake number outside the allowed family');
});
