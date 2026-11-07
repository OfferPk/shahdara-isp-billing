// Plan 418 — History this-month versus last-month comparison.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { historyMonthlyGroupingGroups } from '../history-monthly-grouping.js';
import {
  HISTORY_MONTH_COMPARISON_EMPTY_TEXT,
  HISTORY_MONTH_COMPARISON_MONTH_NOT_RECORDED_TEXT,
  isStrictMonthComparisonMonth,
  historyMonthComparisonPreviousMonth,
  historyMonthComparisonMonthOf,
  historyMonthComparisonDelta,
  historyMonthComparisonPaidCents,
  historyMonthComparisonDirection,
  historyMonthComparisonMonthLabel,
  formatMonthComparisonAmount,
  historyMonthComparison,
  historyMonthComparisonText,
  historyMonthComparisonHtml,
} from '../history-month-comparison.js';

function entry(overrides = {}) {
  return {
    type: 'payment',
    date: '2026-11-06',
    month: '2026-11',
    amountCents: 200000,
    runningBalanceCents: 0,
    note: '',
    method: 'Cash',
    ref: 'P1',
    voided: false,
    ...overrides,
  };
}

// October charge PKR 3,000, October payment PKR 2,000, November
// charge PKR 3,000, November payment PKR 3,000 — this month paid
// more than last month.
function moreFixture() {
  return [
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 300000, ref: 'B-OCT' }),
    entry({ type: 'payment', date: '2026-10-05', month: '2026-10', amountCents: 200000, ref: 'P-OCT' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 300000, ref: 'B-NOV' }),
    entry({ type: 'payment', date: '2026-11-06', month: '2026-11', amountCents: 300000, ref: 'P-NOV' }),
  ];
}

test('strict month: YYYY-MM only, month 01-12', () => {
  assert.equal(isStrictMonthComparisonMonth('2026-11'), true);
  assert.equal(isStrictMonthComparisonMonth('2026-01'), true);
  assert.equal(isStrictMonthComparisonMonth('2026-12'), true);
  assert.equal(isStrictMonthComparisonMonth('2026-13'), false);
  assert.equal(isStrictMonthComparisonMonth('2026-00'), false);
  assert.equal(isStrictMonthComparisonMonth('2026-11-06'), false);
  assert.equal(isStrictMonthComparisonMonth('2026-1'), false);
  assert.equal(isStrictMonthComparisonMonth(''), false);
  assert.equal(isStrictMonthComparisonMonth(null), false);
  assert.equal(isStrictMonthComparisonMonth(202611), false);
});

test('previous month steps back one calendar month', () => {
  assert.equal(historyMonthComparisonPreviousMonth('2026-11'), '2026-10');
  assert.equal(historyMonthComparisonPreviousMonth('2026-12'), '2026-11');
  assert.equal(historyMonthComparisonPreviousMonth('2026-01'), '2025-12');
  assert.equal(historyMonthComparisonPreviousMonth('2026-02'), '2026-01');
});

test('previous month of a month that is not strict is empty', () => {
  assert.equal(historyMonthComparisonPreviousMonth('2026-13'), '');
  assert.equal(historyMonthComparisonPreviousMonth(''), '');
  assert.equal(historyMonthComparisonPreviousMonth(null), '');
  assert.equal(historyMonthComparisonPreviousMonth('2026-11-06'), '');
});

test('entry month: the record month wins over the date', () => {
  assert.equal(historyMonthComparisonMonthOf(entry({ month: '2026-10', date: '2026-11-05' })), '2026-10');
});

test('entry month: a strict date gives its month when no record month', () => {
  assert.equal(historyMonthComparisonMonthOf(entry({ month: '', date: '2026-11-05' })), '2026-11');
});

test('entry month: a month-only date is its own month', () => {
  assert.equal(historyMonthComparisonMonthOf(entry({ month: '', date: '2026-10' })), '2026-10');
});

test('entry month: an undated entry has no month', () => {
  assert.equal(historyMonthComparisonMonthOf(entry({ month: '', date: '' })), '');
  assert.equal(historyMonthComparisonMonthOf(null), '');
  assert.equal(historyMonthComparisonMonthOf({}), '');
});

test('delta: charge and refund add to what is owed', () => {
  assert.equal(historyMonthComparisonDelta(entry({ type: 'charge', amountCents: 300000 })), 300000);
  assert.equal(historyMonthComparisonDelta(entry({ type: 'refund', amountCents: 50000 })), 50000);
});

test('delta: payment, advance and adjustment reduce what is owed', () => {
  assert.equal(historyMonthComparisonDelta(entry({ type: 'payment', amountCents: 200000 })), -200000);
  assert.equal(historyMonthComparisonDelta(entry({ type: 'advance', amountCents: 50000 })), -50000);
  assert.equal(historyMonthComparisonDelta(entry({ type: 'adjustment', amountCents: 25000 })), -25000);
});

test('delta: an overpayment credit moves nothing, an adjustment credit reduces what is owed', () => {
  assert.equal(historyMonthComparisonDelta(entry({ type: 'credit', source: 'overpayment', amountCents: 100000 })), 0);
  assert.equal(historyMonthComparisonDelta(entry({ type: 'credit', source: 'adjustment', amountCents: 40000 })), -40000);
});

test('delta: a voided entry moves nothing', () => {
  assert.equal(historyMonthComparisonDelta(entry({ type: 'payment', amountCents: 300000, voided: true })), 0);
  assert.equal(historyMonthComparisonDelta(entry({ type: 'charge', amountCents: 300000, voided: true })), 0);
});

test('delta: a missing, boolean or blank figure is not a number, never zero', () => {
  assert.equal(historyMonthComparisonDelta(entry({ amountCents: null })), 0);
  assert.equal(historyMonthComparisonDelta(entry({ amountCents: undefined })), 0);
  assert.equal(historyMonthComparisonDelta(entry({ amountCents: true })), 0);
  assert.equal(historyMonthComparisonDelta(entry({ amountCents: '' })), 0);
  assert.equal(historyMonthComparisonDelta(entry({ amountCents: 'abc' })), 0);
});

test('delta: an unknown type moves nothing', () => {
  assert.equal(historyMonthComparisonDelta(entry({ type: 'mystery', amountCents: 100000 })), 0);
  assert.equal(historyMonthComparisonDelta(null), 0);
});

test('paid cents: sums what reduced what is owed in one month only', () => {
  const entries = moreFixture();
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-10'), 200000);
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-11'), 300000);
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-09'), 0);
  assert.equal(historyMonthComparisonPaidCents(entries, 'not-a-month'), 0);
  assert.equal(historyMonthComparisonPaidCents([], '2026-11'), 0);
  assert.equal(historyMonthComparisonPaidCents(null, '2026-11'), 0);
});

test('paid cents: charges and refunds are never paid', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 300000, ref: 'B' }),
    entry({ type: 'refund', date: '2026-11-10', month: '2026-11', amountCents: 50000, ref: 'R' }),
  ];
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-11'), 0);
});

test('paid cents: advance and adjustment count as paid, an overpayment credit does not', () => {
  const entries = [
    entry({ type: 'advance', date: '2026-11-03', month: '2026-11', amountCents: 50000, ref: 'A' }),
    entry({ type: 'adjustment', date: '2026-11-04', month: '2026-11', amountCents: 25000, ref: 'J' }),
    entry({ type: 'credit', source: 'overpayment', date: '2026-11-05', month: '2026-11', amountCents: 100000, ref: 'C1' }),
    entry({ type: 'credit', source: 'adjustment', date: '2026-11-06', month: '2026-11', amountCents: 40000, ref: 'C2' }),
  ];
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-11'), 115000);
});

test('paid cents: a voided payment never counts as paid', () => {
  const entries = [
    entry({ type: 'payment', date: '2026-11-06', month: '2026-11', amountCents: 300000, voided: true, ref: 'P-V' }),
    entry({ type: 'payment', date: '2026-11-07', month: '2026-11', amountCents: 100000, ref: 'P' }),
  ];
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-11'), 100000);
});

test('paid cents: a payment dated November on an October bill counts in October', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 300000, ref: 'B-OCT' }),
    entry({ type: 'payment', date: '2026-11-05', month: '2026-10', amountCents: 200000, ref: 'P' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 300000, ref: 'B-NOV' }),
  ];
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-10'), 200000);
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-11'), 0);
});

test('acceptance: both figures match the history monthly totals on the same fixture', () => {
  const entries = moreFixture();
  const groups = historyMonthlyGroupingGroups(entries);
  const october = groups.find((group) => group.month === '2026-10');
  const november = groups.find((group) => group.month === '2026-11');
  assert.equal(october.paidCents, 200000);
  assert.equal(november.paidCents, 300000);
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-10'), october.paidCents);
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-11'), november.paidCents);
});

test('acceptance: the cross-month payment matches the monthly totals too', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 300000, ref: 'B-OCT' }),
    entry({ type: 'payment', date: '2026-11-05', month: '2026-10', amountCents: 200000, ref: 'P' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 300000, ref: 'B-NOV' }),
  ];
  const groups = historyMonthlyGroupingGroups(entries);
  const october = groups.find((group) => group.month === '2026-10');
  const november = groups.find((group) => group.month === '2026-11');
  assert.equal(october.paidCents, 200000);
  assert.equal(november.paidCents, 0);
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-10'), october.paidCents);
  assert.equal(historyMonthComparisonPaidCents(entries, '2026-11'), november.paidCents);
});

test('direction: more, less, and the same', () => {
  assert.equal(historyMonthComparisonDirection(300000, 200000), 'more');
  assert.equal(historyMonthComparisonDirection(100000, 200000), 'less');
  assert.equal(historyMonthComparisonDirection(200000, 200000), 'same');
  assert.equal(historyMonthComparisonDirection(0, 0), 'same');
});

test('direction: an unusable figure never invents a direction', () => {
  assert.equal(historyMonthComparisonDirection(null, 200000), 'same');
  assert.equal(historyMonthComparisonDirection(300000, undefined), 'same');
  assert.equal(historyMonthComparisonDirection(true, 200000), 'same');
});

test('month label: plain month and year', () => {
  assert.equal(historyMonthComparisonMonthLabel('2026-11'), 'November 2026');
  assert.equal(historyMonthComparisonMonthLabel('2026-01'), 'January 2026');
  assert.equal(historyMonthComparisonMonthLabel('2025-12'), 'December 2025');
  assert.equal(historyMonthComparisonMonthLabel('2026-13'), HISTORY_MONTH_COMPARISON_MONTH_NOT_RECORDED_TEXT);
  assert.equal(historyMonthComparisonMonthLabel(''), HISTORY_MONTH_COMPARISON_MONTH_NOT_RECORDED_TEXT);
});

test('amount format: whole rupees plain, paisa with one decimal', () => {
  assert.equal(formatMonthComparisonAmount(150000), 'PKR 1,500');
  assert.equal(formatMonthComparisonAmount(150050), 'PKR 1,500.5');
  assert.equal(formatMonthComparisonAmount(0), 'PKR 0');
  assert.equal(formatMonthComparisonAmount(null), 'PKR 0');
  assert.equal(formatMonthComparisonAmount(-50000), '-PKR 500');
});

test('comparison: this month, last month, both figures, and the word', () => {
  const comparison = historyMonthComparison('2026-11', moreFixture());
  assert.deepEqual(comparison, {
    thisMonth: '2026-11',
    lastMonth: '2026-10',
    thisMonthPaidCents: 300000,
    lastMonthPaidCents: 200000,
    direction: 'more',
  });
});

test('comparison: less when this month paid less', () => {
  const entries = [
    entry({ type: 'payment', date: '2026-10-05', month: '2026-10', amountCents: 200000, ref: 'P-OCT' }),
    entry({ type: 'payment', date: '2026-11-06', month: '2026-11', amountCents: 100000, ref: 'P-NOV' }),
  ];
  const comparison = historyMonthComparison('2026-11', entries);
  assert.equal(comparison.direction, 'less');
  assert.equal(comparison.thisMonthPaidCents, 100000);
  assert.equal(comparison.lastMonthPaidCents, 200000);
});

test('comparison: the same when both months paid the same', () => {
  const entries = [
    entry({ type: 'payment', date: '2026-10-05', month: '2026-10', amountCents: 200000, ref: 'P-OCT' }),
    entry({ type: 'payment', date: '2026-11-06', month: '2026-11', amountCents: 200000, ref: 'P-NOV' }),
  ];
  assert.equal(historyMonthComparison('2026-11', entries).direction, 'same');
});

test('acceptance: a customer with no payment in either month shows zeros', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 300000, ref: 'B-OCT' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 300000, ref: 'B-NOV' }),
  ];
  const comparison = historyMonthComparison('2026-11', entries);
  assert.equal(comparison.thisMonthPaidCents, 0);
  assert.equal(comparison.lastMonthPaidCents, 0);
  assert.equal(comparison.direction, 'same');
  assert.equal(
    historyMonthComparisonText('2026-11', entries),
    'Paid PKR 0 in November 2026 · the same as October 2026 (PKR 0)',
  );
});

test('comparison: January steps back to December of the previous year', () => {
  const entries = [
    entry({ type: 'payment', date: '2025-12-20', month: '2025-12', amountCents: 200000, ref: 'P-DEC' }),
    entry({ type: 'payment', date: '2026-01-06', month: '2026-01', amountCents: 100000, ref: 'P-JAN' }),
  ];
  const comparison = historyMonthComparison('2026-01', entries);
  assert.equal(comparison.thisMonth, '2026-01');
  assert.equal(comparison.lastMonth, '2025-12');
  assert.equal(comparison.direction, 'less');
  assert.equal(
    historyMonthComparisonText('2026-01', entries),
    'Paid PKR 1,000 in January 2026 · less than December 2025 (PKR 2,000)',
  );
});

test('comparison: no reference month falls back to the latest month among the entries', () => {
  const comparison = historyMonthComparison('', moreFixture());
  assert.equal(comparison.thisMonth, '2026-11');
  assert.equal(comparison.lastMonth, '2026-10');
  assert.equal(comparison.direction, 'more');
  assert.equal(historyMonthComparison(null, moreFixture()).thisMonth, '2026-11');
});

test('comparison: no month can be drawn from undated entries alone', () => {
  const entries = [entry({ month: '', date: '' })];
  assert.equal(historyMonthComparison('', entries), null);
  assert.equal(historyMonthComparisonText('', entries), '');
  assert.equal(historyMonthComparisonHtml('', entries), '');
  assert.equal(historyMonthComparison(null, null), null);
});

test('text: more, with both figures in plain words', () => {
  assert.equal(
    historyMonthComparisonText('2026-11', moreFixture()),
    'Paid PKR 3,000 in November 2026 · more than October 2026 (PKR 2,000)',
  );
});

test('text: less, with both figures in plain words', () => {
  const entries = [
    entry({ type: 'payment', date: '2026-10-05', month: '2026-10', amountCents: 200000, ref: 'P-OCT' }),
    entry({ type: 'payment', date: '2026-11-06', month: '2026-11', amountCents: 100000, ref: 'P-NOV' }),
  ];
  assert.equal(
    historyMonthComparisonText('2026-11', entries),
    'Paid PKR 1,000 in November 2026 · less than October 2026 (PKR 2,000)',
  );
});

test('text: the same, with both figures in plain words', () => {
  const entries = [
    entry({ type: 'payment', date: '2026-10-05', month: '2026-10', amountCents: 200000, ref: 'P-OCT' }),
    entry({ type: 'payment', date: '2026-11-06', month: '2026-11', amountCents: 200000, ref: 'P-NOV' }),
  ];
  assert.equal(
    historyMonthComparisonText('2026-11', entries),
    'Paid PKR 2,000 in November 2026 · the same as October 2026 (PKR 2,000)',
  );
});

test('text: a paisa payment prints with one decimal', () => {
  const entries = [
    entry({ type: 'payment', date: '2026-10-05', month: '2026-10', amountCents: 100000, ref: 'P-OCT' }),
    entry({ type: 'payment', date: '2026-11-06', month: '2026-11', amountCents: 150050, ref: 'P-NOV' }),
  ];
  assert.equal(
    historyMonthComparisonText('2026-11', entries),
    'Paid PKR 1,500.5 in November 2026 · more than October 2026 (PKR 1,000)',
  );
});

test('html: one plain-words line in a notice', () => {
  assert.equal(
    historyMonthComparisonHtml('2026-11', moreFixture()),
    '<p class="notice">Paid PKR 3,000 in November 2026 · more than October 2026 (PKR 2,000)</p>',
  );
});

test('html: an empty history renders nothing', () => {
  assert.equal(historyMonthComparisonHtml('2026-11', []), '');
  assert.equal(historyMonthComparisonHtml('2026-11', null), '');
});

test('whole-history principle: the line is drawn from the full entries, never a filtered subset', () => {
  const full = moreFixture();
  const novemberOnly = full.filter((e) => e.month === '2026-11');
  // A filter that hides October would understate last month at
  // zero — the full history says last month paid PKR 2,000.
  assert.equal(
    historyMonthComparisonHtml('2026-11', novemberOnly),
    '<p class="notice">Paid PKR 3,000 in November 2026 · more than October 2026 (PKR 0)</p>',
  );
  assert.equal(
    historyMonthComparisonHtml('2026-11', full),
    '<p class="notice">Paid PKR 3,000 in November 2026 · more than October 2026 (PKR 2,000)</p>',
  );
});

test('comparison never mutates the entries given', () => {
  const entries = moreFixture();
  const before = JSON.stringify(entries);
  historyMonthComparison('2026-11', entries);
  historyMonthComparisonText('2026-11', entries);
  historyMonthComparisonHtml('2026-11', entries);
  assert.equal(JSON.stringify(entries), before);
});

test('wiring: app.js imports the module and renders the line from the full entries', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("import { historyMonthComparisonHtml } from './history-month-comparison.js';"));
  assert.ok(app.includes("historyMonthComparisonHtml(localDate().slice(0, 7), entries)"));
  assert.ok(app.includes("$('#hmcHistoryMonthComparison')"));
});

test('wiring: index.html carries the comparison host after the adjustments host', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const adjustmentsAt = html.indexOf('id="hadHistoryAdjustmentsInline"');
  const comparisonAt = html.indexOf('id="hmcHistoryMonthComparison"');
  assert.ok(adjustmentsAt !== -1);
  assert.ok(comparisonAt !== -1);
  assert.ok(comparisonAt > adjustmentsAt);
});

test('module header names no fenced filename literally', () => {
  const source = readFileSync(new URL('../history-month-comparison.js', import.meta.url), 'utf8');
  const fenced = [
    'full-' + 'history-list.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'first-dates.js',
    'history-' + 'adjustments-inline.js',
    'history-' + 'credit-inline.js',
    'history-' + 'refunds-inline.js',
  ];
  for (const name of fenced) {
    assert.ok(!source.includes(name), `header must not name ${name}`);
  }
});

test('module is pure: no clock, storage, network, or page access', () => {
  const source = readFileSync(new URL('../history-month-comparison.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('window.'));
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('OLT'));
});
