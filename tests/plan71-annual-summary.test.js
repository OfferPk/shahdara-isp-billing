/**
 * plan71-annual-summary.test.js — Plan 71: annual owner summary
 * (composition only, from the twelve monthly closes).
 * Pins:
 * - annual figures sum exactly to the twelve monthly figures on the
 *   same fixture (collections, expenses, net, new, departed);
 * - year start + new − departed = year end reconciles, with a
 *   plainly shown difference when it does not, per month and year;
 * - a month with no row, or with no frozen snapshot, is flagged
 *   incomplete rather than estimated — totals cover only supplied
 *   months and the text says so;
 * - an unusable figure contributes nothing and is named, never
 *   silently zero-filled; churn is null when year-start is missing;
 * - composing never mutates inputs and the view holds no bill,
 *   payment, snapshot, or customer record of its own;
 * - HTML escaping, CSV quoting, and the export filename.
 * Synthetic data only; no live record is ever changed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validAnnualYear,
  monthsOfYear,
  buildAnnualSummary,
  annualSummaryText,
  annualSummaryHtml,
  annualSummaryCsv,
  annualSummaryFilename,
} from '../annual-summary.js';

function fullYearRows() {
  // Twelve months, each: collections 10000, expenses 4000, new 2,
  // departed 1, start/end chaining 100 → 112.
  let start = 100;
  return Array.from({ length: 12 }, (_, i) => {
    const row = {
      month: `2026-${String(i + 1).padStart(2, '0')}`,
      collections: 10000, expenses: 4000,
      newCustomers: 2, departed: 1,
      customersStart: start, customersEnd: start + 1,
      churnRate: 1 / start, snapshotClosed: true,
    };
    start += 1;
    return row;
  });
}

test('year validation and the twelve months of a year', () => {
  assert.equal(validAnnualYear('2026'), '2026');
  assert.equal(validAnnualYear('26'), '');
  assert.equal(validAnnualYear(''), '');
  assert.equal(buildAnnualSummary({ year: '26', months: [] }), null);
  assert.deepEqual(monthsOfYear('2026'), [
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
  ]);
  assert.deepEqual(monthsOfYear('junk'), []);
});

test('annual figures sum exactly to the twelve monthly figures', () => {
  const view = buildAnnualSummary({ year: '2026', months: fullYearRows() });
  assert.equal(view.collectionsTotal, 120000);
  assert.equal(view.expensesTotal, 48000);
  assert.equal(view.netTotal, 72000);
  assert.equal(view.newTotal, 24);
  assert.equal(view.departedTotal, 12);
  assert.equal(view.yearStart, 100);
  assert.equal(view.yearEnd, 112);
  assert.equal(view.growth, 12);
  assert.equal(view.reconciles, true);
  assert.equal(view.complete, true);
  assert.equal(view.monthsCovered, 12);
  assert.deepEqual(view.missingMonths, []);
  assert.deepEqual(view.snapshotMissingMonths, []);
  assert.deepEqual(view.unusable, []);
  assert.ok(view.months.every((row) => row.reconciles === true));
});

test('annual churn rate is departures divided by year-start customers', () => {
  const view = buildAnnualSummary({ year: '2026', months: fullYearRows() });
  assert.equal(view.annualChurnRate, 12 / 100);
  assert.equal(view.annualChurnRatePercent, 12);
  assert.equal(view.months[0].churnRatePercent, 1);
});

test('exact cent sums, no float drift', () => {
  const rows = fullYearRows();
  rows[0].collections = 333.33;
  rows[1].collections = 166.67;
  rows[2].collections = 500;
  for (let i = 3; i < 12; i += 1) rows[i].collections = 0;
  const view = buildAnnualSummary({ year: '2026', months: rows });
  assert.equal(view.collectionsTotal, 1000);
});

test('a missing month is flagged incomplete, never estimated', () => {
  const rows = fullYearRows().slice(0, 10);
  const view = buildAnnualSummary({ year: '2026', months: rows });
  assert.equal(view.complete, false);
  assert.deepEqual(view.missingMonths, ['2026-11', '2026-12']);
  assert.equal(view.monthsCovered, 10);
  assert.equal(view.collectionsTotal, 100000);
  assert.match(annualSummaryText(view), /Incomplete/);
  assert.match(annualSummaryText(view), /2026-11/);
  assert.match(annualSummaryText(view), /not estimated/);
});

test('a month without a frozen snapshot is flagged incomplete', () => {
  const rows = fullYearRows();
  rows[5].snapshotClosed = false;
  const view = buildAnnualSummary({ year: '2026', months: rows });
  assert.equal(view.complete, false);
  assert.deepEqual(view.snapshotMissingMonths, ['2026-06']);
  assert.match(annualSummaryText(view), /without a frozen snapshot/);
  // Its figures still count — only the snapshot flag is missing.
  assert.equal(view.collectionsTotal, 120000);
});

test('an unusable figure contributes nothing and is named, never zero-filled', () => {
  const rows = fullYearRows();
  rows[3].collections = 'blank';
  rows[7].expenses = true;
  rows[9].newCustomers = 1.5;
  const view = buildAnnualSummary({ year: '2026', months: rows });
  assert.equal(view.complete, false);
  assert.ok(view.unusable.includes('2026-04: collections'));
  assert.ok(view.unusable.includes('2026-08: expenses'));
  assert.ok(view.unusable.includes('2026-10: new customers'));
  assert.equal(view.collectionsTotal, 110000);
  assert.equal(view.expensesTotal, 44000);
  assert.match(annualSummaryText(view), /not zero-filled/);
});

test('churn is null when year-start customers are missing', () => {
  const rows = fullYearRows().map((row) => ({ ...row, customersStart: null, customersEnd: null }));
  const view = buildAnnualSummary({ year: '2026', months: rows });
  assert.equal(view.yearStart, null);
  assert.equal(view.annualChurnRate, null);
  assert.equal(view.annualChurnRatePercent, null);
  assert.equal(view.reconciles, null);
});

test('a non-reconciling year shows its difference plainly', () => {
  const rows = fullYearRows();
  rows[11].customersEnd = 999;
  const view = buildAnnualSummary({ year: '2026', months: rows });
  assert.equal(view.reconciles, false);
  assert.equal(view.difference, 112 - 999);
  assert.match(annualSummaryText(view), /Does not reconcile/);
  assert.equal(view.months[11].reconciles, false);
});

test('rows outside the year and duplicate months are ignored and named', () => {
  const rows = [...fullYearRows(), { month: '2025-12', collections: 1, expenses: 1, newCustomers: 1, departed: 1, snapshotClosed: true }, fullYearRows()[0]];
  const view = buildAnnualSummary({ year: '2026', months: rows });
  assert.equal(view.collectionsTotal, 120000);
  assert.ok(view.ignored.includes('2025-12'));
  assert.ok(view.ignored.includes('2026-01'));
});

test('composing never mutates inputs', () => {
  const rows = fullYearRows();
  const before = JSON.stringify(rows);
  buildAnnualSummary({ year: '2026', months: rows });
  assert.equal(JSON.stringify(rows), before);
});

test('the view holds no bill, payment, snapshot, or customer record', () => {
  const view = buildAnnualSummary({ year: '2026', months: fullYearRows() });
  const flat = JSON.stringify(view);
  assert.doesNotMatch(flat, /billId|paymentId|receiptId|snapshotId|customerId/);
  assert.ok(!('snapshots' in view));
});

test('HTML escaping, CSV quoting, and the export filename', () => {
  const rows = fullYearRows();
  rows[0].month = '2026-01';
  const view = buildAnnualSummary({ year: '2026', months: rows });
  const html = annualSummaryHtml(view);
  assert.match(html, /Year 2026/);
  assert.match(html, /120000|120,000/);
  const csv = annualSummaryCsv(view);
  assert.match(csv, /^Month,Collections,Expenses,Net,New,Departed/);
  assert.match(csv, /Year 2026,120000,48000,72000,24,12,100,112,12,/);
  assert.equal(csv.trim().split('\n').length, 14);
  assert.equal(annualSummaryFilename('2026'), 'annual-owner-summary-2026.csv');
  assert.equal(annualSummaryFilename('junk'), 'annual-owner-summary.csv');
});

test('HTML escapes a hostile month label', () => {
  const view = buildAnnualSummary({ year: '2026', months: fullYearRows() });
  const hostile = { ...view, months: view.months.map((row) => ({ ...row, month: '<script>' })) };
  assert.doesNotMatch(annualSummaryHtml(hostile), /<script>/);
});

test('Owner 5-part fix: live (unfrozen) months contribute real figures and are badged', () => {
  // October has a frozen snapshot; November has none, so its figures
  // come from the live ledger. The year is still incomplete — a live
  // month is never silently treated as frozen.
  const rows = [
    { month: '2026-10', collections: 10000, expenses: 4000, newCustomers: 2, departed: 1, customersStart: 100, customersEnd: 101, churnRate: 0.01, snapshotClosed: true },
    { month: '2026-11', collections: 5000, expenses: 2000, newCustomers: 1, departed: 0, customersStart: 101, customersEnd: 102, churnRate: 0, snapshotClosed: false, live: true },
  ];
  const view = buildAnnualSummary({ year: '2026', months: rows });
  assert.equal(view.collectionsTotal, 15000);
  assert.equal(view.expensesTotal, 6000);
  assert.equal(view.netTotal, 9000);
  assert.deepEqual(view.liveMonths, ['2026-11']);
  assert.equal(view.complete, false);
  assert.ok(view.snapshotMissingMonths.includes('2026-11'));
  const text = annualSummaryText(view);
  assert.match(text, /Includes live\/unfrozen months: 2026-11/);
  assert.match(text, /live ledger, not a frozen snapshot/);
  const html = annualSummaryHtml(view);
  assert.ok(html.includes('Includes live/unfrozen months'), 'badge in the table');
  assert.ok(html.includes('>Live<'), 'November shows Live in the Snapshot column');
  assert.ok(html.includes('>Frozen<'), 'October still shows Frozen');
  const csv = annualSummaryCsv(view);
  assert.ok(csv.split('\n')[0].includes('Live'), 'CSV gains a Live column');
  assert.ok(csv.includes('2026-11,5000,2000,3000,1,0,101,102,0,no,yes,yes'), 'November row is live, not frozen');
});

test('Owner 5-part fix: a frozen snapshot wins over a live flag in the Snapshot column', () => {
  // The caller never sends both, but the module must not show a
  // frozen month as Live anywhere — not in the column, not in the
  // live-months list, badge, or text.
  const rows = [
    { month: '2026-10', collections: 10000, expenses: 4000, newCustomers: 2, departed: 1, customersStart: 100, customersEnd: 101, churnRate: 0.01, snapshotClosed: true, live: true },
  ];
  const view = buildAnnualSummary({ year: '2026', months: rows });
  assert.deepEqual(view.liveMonths, []);
  assert.ok(annualSummaryHtml(view).includes('>Frozen<'));
  assert.ok(!annualSummaryHtml(view).includes('>Live<'));
  assert.ok(!annualSummaryHtml(view).includes('Includes live/unfrozen months'));
  assert.ok(!annualSummaryText(view).includes('Includes live/unfrozen months'));
});

test('Owner 5-part fix: a year with no snapshots and no live months still totals zero honestly', () => {
  const view = buildAnnualSummary({ year: '2026', months: [] });
  assert.equal(view.collectionsTotal, 0);
  assert.equal(view.expensesTotal, 0);
  assert.deepEqual(view.liveMonths, []);
  assert.ok(!annualSummaryText(view).includes('Includes live/unfrozen months'));
  assert.ok(!annualSummaryHtml(view).includes('Includes live/unfrozen months'));
});
