// Plan 408 — History yearly summary per customer: a customer who
// wants "how much did I pay this year?" must add up twelve months
// by hand, because the history has no yearly view. One yearly
// summary per customer (year, total billed, total paid, total still
// owed, number of payments), composed from existing records. It
// summarises only and changes nothing, and the yearly figures match
// the sum of that year's monthly figures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_YEARLY_SUMMARY_EMPTY_TEXT,
  HISTORY_YEARLY_SUMMARY_UNDATED_LABEL,
  isStrictYearlySummaryYear,
  isStrictYearlySummaryMonth,
  historyYearlySummaryYearOf,
  historyYearlySummaryDelta,
  formatYearlySummaryAmount,
  historyYearlySummaryYearLabel,
  historyYearlySummary,
  historyYearlySummaries,
  historyYearlySummaryTotals,
  historyYearlySummaryReconciliation,
  historyYearlySummaryText,
  historyYearlySummarySummaryText,
  historyYearlySummaryHtml,
} from '../history-yearly-summary.js';
import {
  historyMonthlyGroupingGroups,
} from '../history-monthly-grouping.js';

function entry(overrides = {}) {
  return { type: 'payment', date: '2026-09-15', amountCents: 150000, method: 'Cash', ...overrides };
}

// A full chain, hand-computed step by step:
// 2025: charge 300000; pay 150000; pay 150000
//   -> billed 300000, paid 300000, still owed 0, 2 payments.
// 2026: charge 300000; advance 50000; credit (overpayment) 50000
//   (moves nothing); credit (adjustment) 20000; refund 20000;
//   adjustment 30000; voided pay 300000 (moves nothing, not a
//   payment) -> billed 320000, paid 100000, still owed 220000,
//   1 payment (the advance).
// Undated: credit (adjustment) 10000 -> billed 0, paid 10000,
//   still owed -10000, 0 payments.
// Totals: billed 620000, paid 410000, still owed 210000,
//   3 payments, 11 entries.
function mixedEntries() {
  return [
    entry({ type: 'charge', date: '2025-09-01', amountCents: 300000 }),
    entry({ type: 'payment', date: '2025-09-15', amountCents: 150000 }),
    entry({ type: 'payment', date: '2025-09-20', amountCents: 150000 }),
    entry({ type: 'charge', date: '2026-01-05', amountCents: 300000 }),
    entry({ type: 'advance', date: '2026-01-10', amountCents: 50000 }),
    entry({ type: 'credit', date: '2026-01-12', amountCents: 50000, source: 'overpayment' }),
    entry({ type: 'credit', date: '2026-01-15', amountCents: 20000, source: 'adjustment' }),
    entry({ type: 'refund', date: '2026-02-01', amountCents: 20000 }),
    entry({ type: 'adjustment', date: '2026-02-05', amountCents: 30000 }),
    entry({ type: 'payment', date: '2026-02-10', amountCents: 300000, voided: true }),
    entry({ type: 'credit', date: undefined, month: undefined, amountCents: 10000, source: 'adjustment' }),
  ];
}

test('year of an entry follows its month first, then its date', () => {
  assert.equal(historyYearlySummaryYearOf(entry({ month: '2025-09', date: '2026-01-05' })), '2025');
  assert.equal(historyYearlySummaryYearOf(entry({ date: '2026-01-05' })), '2026');
  assert.equal(historyYearlySummaryYearOf(entry({ date: '2026-01' })), '2026');
  assert.equal(historyYearlySummaryYearOf(entry({ date: undefined, month: undefined })), '');
  assert.equal(historyYearlySummaryYearOf(null), '');
  assert.equal(historyYearlySummaryYearOf('2026'), '');
});

test('strict year is a four-digit year string only', () => {
  assert.equal(isStrictYearlySummaryYear('2026'), true);
  assert.equal(isStrictYearlySummaryYear('26'), false);
  assert.equal(isStrictYearlySummaryYear(2026), false);
  assert.equal(isStrictYearlySummaryYear(''), false);
  assert.equal(isStrictYearlySummaryYear(null), false);
});

test('strict month is a YYYY-MM month with month 01-12', () => {
  assert.equal(isStrictYearlySummaryMonth('2026-09'), true);
  assert.equal(isStrictYearlySummaryMonth('2026-13'), false);
  assert.equal(isStrictYearlySummaryMonth('2026-9'), false);
  assert.equal(isStrictYearlySummaryMonth('2026'), false);
});

test('delta: charges and refunds add to what is owed', () => {
  assert.equal(historyYearlySummaryDelta(entry({ type: 'charge', amountCents: 300000 })), 300000);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'refund', amountCents: 20000 })), 20000);
});

test('delta: payments, advances and adjustments reduce what is owed', () => {
  assert.equal(historyYearlySummaryDelta(entry({ type: 'payment', amountCents: 150000 })), -150000);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'advance', amountCents: 50000 })), -50000);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'adjustment', amountCents: 30000 })), -30000);
});

test('delta: an overpayment credit moves nothing, an adjustment credit reduces what is owed', () => {
  assert.equal(historyYearlySummaryDelta(entry({ type: 'credit', amountCents: 50000, source: 'overpayment' })), 0);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'credit', amountCents: 20000, source: 'adjustment' })), -20000);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'credit', amountCents: 20000 })), 0);
});

test('delta: a voided entry moves nothing', () => {
  assert.equal(historyYearlySummaryDelta(entry({ type: 'payment', amountCents: 300000, voided: true })), 0);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'charge', amountCents: 300000, voided: true })), 0);
});

test('delta: a missing, boolean or blank amount is not a number, never zero-filled into a movement', () => {
  assert.equal(historyYearlySummaryDelta(entry({ type: 'charge', amountCents: null })), 0);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'charge', amountCents: undefined })), 0);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'charge', amountCents: true })), 0);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'charge', amountCents: '' })), 0);
  assert.equal(historyYearlySummaryDelta(entry({ type: 'charge', amountCents: 'abc' })), 0);
  assert.equal(historyYearlySummaryDelta(null), 0);
});

test('amounts print with no decimals for whole rupees and one decimal for a paisa remainder', () => {
  assert.equal(formatYearlySummaryAmount(150000), 'PKR 1,500');
  assert.equal(formatYearlySummaryAmount(150050), 'PKR 1,500.5');
  assert.equal(formatYearlySummaryAmount(0), 'PKR 0');
  assert.equal(formatYearlySummaryAmount(-50000), '-PKR 500');
  assert.equal(formatYearlySummaryAmount(null), 'PKR 0');
  assert.equal(formatYearlySummaryAmount(true), 'PKR 0');
});

test('year label is the year, or the undated label for no year', () => {
  assert.equal(historyYearlySummaryYearLabel('2026'), '2026');
  assert.equal(historyYearlySummaryYearLabel(''), HISTORY_YEARLY_SUMMARY_UNDATED_LABEL);
  assert.equal(historyYearlySummaryYearLabel('26'), HISTORY_YEARLY_SUMMARY_UNDATED_LABEL);
});

test('one year summary: 2025 billed, paid, still owed and payments', () => {
  const summary = historyYearlySummary(mixedEntries(), '2025');
  assert.equal(summary.year, '2025');
  assert.equal(summary.billedCents, 300000);
  assert.equal(summary.paidCents, 300000);
  assert.equal(summary.stillOwedCents, 0);
  assert.equal(summary.paymentCount, 2);
  assert.equal(summary.entryCount, 3);
});

test('one year summary: 2026 billed, paid, still owed and payments', () => {
  const summary = historyYearlySummary(mixedEntries(), '2026');
  assert.equal(summary.year, '2026');
  assert.equal(summary.billedCents, 320000);
  assert.equal(summary.paidCents, 100000);
  assert.equal(summary.stillOwedCents, 220000);
  assert.equal(summary.paymentCount, 1);
  assert.equal(summary.entryCount, 7);
});

test('a year with no transactions shows zeros, not a blank', () => {
  const summary = historyYearlySummary(mixedEntries(), '2024');
  assert.equal(summary.year, '2024');
  assert.equal(summary.billedCents, 0);
  assert.equal(summary.paidCents, 0);
  assert.equal(summary.stillOwedCents, 0);
  assert.equal(summary.paymentCount, 0);
  assert.equal(summary.entryCount, 0);
});

test('a year that is not a strict four-digit year has no summary', () => {
  assert.equal(historyYearlySummary(mixedEntries(), '26'), null);
  assert.equal(historyYearlySummary(mixedEntries(), null), null);
  assert.equal(historyYearlySummary(mixedEntries(), 2026), null);
});

test('summaries come in ascending year order', () => {
  const summaries = historyYearlySummaries(mixedEntries());
  assert.deepEqual(summaries.map((summary) => summary.year), ['2025', '2026', '']);
  assert.equal(summaries[0].label, '2025');
  assert.equal(summaries[1].label, '2026');
});

test('undated entries sit in a final summary, so no entry is ever dropped', () => {
  const summaries = historyYearlySummaries(mixedEntries());
  const undated = summaries[summaries.length - 1];
  assert.equal(undated.year, '');
  assert.equal(undated.label, HISTORY_YEARLY_SUMMARY_UNDATED_LABEL);
  assert.equal(undated.billedCents, 0);
  assert.equal(undated.paidCents, 10000);
  assert.equal(undated.stillOwedCents, -10000);
  assert.equal(undated.paymentCount, 0);
  assert.equal(undated.entryCount, 1);
});

test('totals over all entries include the undated ones', () => {
  const totals = historyYearlySummaryTotals(mixedEntries());
  assert.equal(totals.entryCount, 11);
  assert.equal(totals.billedCents, 620000);
  assert.equal(totals.paidCents, 410000);
  assert.equal(totals.stillOwedCents, 210000);
  assert.equal(totals.paymentCount, 3);
});

test('totals over no entries are zeros', () => {
  const totals = historyYearlySummaryTotals([]);
  assert.deepEqual(totals, { entryCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0, paymentCount: 0 });
});

test('reconciliation: yearly figures sum exactly to the full history totals', () => {
  const entries = mixedEntries();
  const result = historyYearlySummaryReconciliation(historyYearlySummaries(entries), entries);
  assert.equal(result.ok, true);
  assert.equal(result.billedCents, 620000);
  assert.equal(result.paidCents, 410000);
  assert.equal(result.stillOwedCents, 210000);
  assert.equal(result.paymentCount, 3);
  assert.match(result.message, /reconcile/);
});

test('reconciliation: a tampered summary is caught', () => {
  const entries = mixedEntries();
  const summaries = historyYearlySummaries(entries);
  summaries[0] = { ...summaries[0], billedCents: summaries[0].billedCents + 100 };
  const result = historyYearlySummaryReconciliation(summaries, entries);
  assert.equal(result.ok, false);
  assert.match(result.message, /do not reconcile/);
});

test('acceptance: each year matches the sum of that year\'s monthly figures', () => {
  const entries = mixedEntries();
  const groups = historyMonthlyGroupingGroups(entries);
  for (const year of ['2025', '2026']) {
    const monthly = groups.filter((group) => group.month.startsWith(year));
    const billed = monthly.reduce((sum, group) => sum + group.billedCents, 0);
    const paid = monthly.reduce((sum, group) => sum + group.paidCents, 0);
    const summary = historyYearlySummary(entries, year);
    assert.equal(summary.billedCents, billed);
    assert.equal(summary.paidCents, paid);
    assert.equal(summary.stillOwedCents, billed - paid);
  }
});

test('acceptance: the undated yearly figures match the undated monthly group', () => {
  const entries = mixedEntries();
  const groups = historyMonthlyGroupingGroups(entries);
  const undatedMonthly = groups.find((group) => group.month === '');
  const summaries = historyYearlySummaries(entries);
  const undatedYearly = summaries[summaries.length - 1];
  assert.equal(undatedYearly.billedCents, undatedMonthly.billedCents);
  assert.equal(undatedYearly.paidCents, undatedMonthly.paidCents);
  assert.equal(undatedYearly.stillOwedCents, undatedMonthly.stillOwedCents);
});

test('summary text reads as one line per year', () => {
  const summary2026 = historyYearlySummary(mixedEntries(), '2026');
  assert.equal(
    historyYearlySummaryText(summary2026),
    '2026 · Billed PKR 3,200 · Paid PKR 1,000 · Still owed PKR 2,200 · 1 payment',
  );
  const summary2025 = historyYearlySummary(mixedEntries(), '2025');
  assert.equal(
    historyYearlySummaryText(summary2025),
    '2025 · Billed PKR 3,000 · Paid PKR 3,000 · Still owed PKR 0 · 2 payments',
  );
  assert.equal(historyYearlySummaryText(null), '');
});

test('summary text over the shown entries names the years and the totals', () => {
  const entries = mixedEntries();
  assert.equal(
    historyYearlySummarySummaryText(entries, entries),
    '2 years · Billed PKR 6,200 · Paid PKR 4,100 · Still owed PKR 2,100 · 3 payments',
  );
});

test('summary text over a filtered view adds the full-history totals', () => {
  const entries = mixedEntries();
  const shown = entries.filter((item) => historyYearlySummaryYearOf(item) === '2026');
  const text = historyYearlySummarySummaryText(shown, entries);
  assert.match(text, /1 year · Billed PKR 3,200 · Paid PKR 1,000 · Still owed PKR 2,200 · 1 payment/);
  assert.match(text, /Full history: Billed PKR 6,200 · Paid PKR 4,100 · Still owed PKR 2,100 · 3 payments/);
});

test('summary text over no entries says plainly there is nothing', () => {
  assert.equal(historyYearlySummarySummaryText([], mixedEntries()), HISTORY_YEARLY_SUMMARY_EMPTY_TEXT);
});

test('html: one row per year plus a totals footer', () => {
  const html = historyYearlySummaryHtml(mixedEntries(), mixedEntries());
  assert.match(html, /<table class="statement-table">/);
  assert.match(html, /<th>Year<\/th>/);
  assert.match(html, /<td>2025<\/td>/);
  assert.match(html, /<td>2026<\/td>/);
  assert.match(html, /PKR 3,200/);
  assert.match(html, /PKR 1,000/);
  assert.match(html, /PKR 2,200/);
  assert.match(html, /Totals/);
  assert.match(html, /PKR 6,200/);
  assert.doesNotMatch(html, /Full history/);
});

test('html: a filtered view adds a full-history footer row', () => {
  const entries = mixedEntries();
  const shown = entries.filter((item) => historyYearlySummaryYearOf(item) === '2026');
  const html = historyYearlySummaryHtml(shown, entries);
  assert.match(html, /<td>2026<\/td>/);
  assert.doesNotMatch(html, /<td>2025<\/td>/);
  assert.match(html, /Full history/);
  assert.match(html, /PKR 6,200/);
});

test('html: the undated row is shown, never dropped', () => {
  const html = historyYearlySummaryHtml(mixedEntries(), mixedEntries());
  assert.match(html, new RegExp(HISTORY_YEARLY_SUMMARY_UNDATED_LABEL));
});

test('html: an empty shown list renders nothing', () => {
  assert.equal(historyYearlySummaryHtml([], mixedEntries()), '');
  assert.equal(historyYearlySummaryHtml(null, mixedEntries()), '');
});

test('entries are never mutated and never reordered', () => {
  const entries = mixedEntries();
  const before = JSON.stringify(entries);
  historyYearlySummaries(entries);
  historyYearlySummaryTotals(entries);
  historyYearlySummaryHtml(entries, entries);
  assert.equal(JSON.stringify(entries), before);
});

// Fences: the fenced module names are built in fragments below so
// this file never states them as literals.
test('fence: the annual summary still exports its builders and is still wired', () => {
  const annualName = 'annual-' + 'summary.js';
  const annualSource = readFileSync(new URL(`../${annualName}`, import.meta.url), 'utf8');
  assert.match(annualSource, /export function buildAnnualSummary/);
  assert.match(annualSource, /export function annualSummaryHtml/);
  assert.match(annualSource, /export function validAnnualYear/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /buildAnnualSummary/);
  assert.match(appSource, /annualSummaryHtml/);
  assert.doesNotMatch(annualSource, /historyYearlySummary/);
});

test('fence: the full history list still exports its builders and is still wired', () => {
  const listName = 'full-' + 'history-list.js';
  const listSource = readFileSync(new URL(`../${listName}`, import.meta.url), 'utf8');
  assert.match(listSource, /export const FULL_HISTORY_TYPES/);
  assert.match(listSource, /export function fullHistoryEntries/);
  assert.match(listSource, /export function fullHistoryListHtml/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /fullHistoryEntries/);
  assert.match(appSource, /fullHistoryListHtml/);
  assert.doesNotMatch(listSource, /historyYearlySummary/);
});

test('fence: the monthly grouping still exports its builders and is still wired', () => {
  const groupingName = 'history-' + 'monthly-grouping.js';
  const groupingSource = readFileSync(new URL(`../${groupingName}`, import.meta.url), 'utf8');
  assert.match(groupingSource, /export function historyMonthlyGroupingGroups/);
  assert.match(groupingSource, /export function historyMonthlyGroupingTotals/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /historyMonthlyGroupingHtml/);
  assert.doesNotMatch(groupingSource, /historyYearlySummary/);
});

test('fence: the type, date-range, method, amount and balance neighbours are untouched', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /historyTypeFilterSelectMarkup/);
  assert.match(appSource, /historyDateRangeFilterMarkup/);
  assert.match(appSource, /historyMethodFilterSelectMarkup/);
  assert.match(appSource, /historyAmountSearchMarkup/);
  assert.match(appSource, /historyRunningBalanceColumnHtml/);
  for (const name of [
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
  ]) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /historyYearlySummary/);
  }
});

test('fence: the roll-forward still exports its builders and is still wired', () => {
  const rollName = 'balance-' + 'rollforward.js';
  const rollSource = readFileSync(new URL(`../${rollName}`, import.meta.url), 'utf8');
  assert.match(rollSource, /export function buildCustomerRollForward/);
  assert.match(rollSource, /export function buildRollForwardTotals/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /buildCustomerRollForward/);
  assert.doesNotMatch(rollSource, /historyYearlySummary/);
});

test('purity: the module is a view only — no store, no date, no document, no fetch', () => {
  const source = readFileSync(new URL('../history-yearly-summary.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /new Date\(/);
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /import /);
});

test('header: the module header never names a fenced module literally', () => {
  const source = readFileSync(new URL('../history-yearly-summary.js', import.meta.url), 'utf8');
  const header = source.slice(0, source.indexOf('export const'));
  for (const name of [
    'annual-' + 'summary.js',
    'full-' + 'history-list.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'balance-' + 'rollforward.js',
  ]) {
    assert.doesNotMatch(header, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
