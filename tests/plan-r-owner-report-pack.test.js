// Plan R — Owner reporting pack: composition only, no new metrics.
// Every figure in the pack is pinned to its source builder's own output
// on the same synthetic ledger (month comparison, area breakdowns,
// business health score, ISP insights). Pure computation, synthetic
// data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOwnerReportPack,
  buildOwnerReportPackPrintHtml,
  buildOwnerReportPackCsv,
  packReferenceDate,
  setupOwnerReportPack
} from '../owner-report-pack.js';
import {
  buildMonthToMonthComparison,
  buildAreaBreakdowns,
  buildBusinessHealthScore,
  buildIspInsights
} from '../owner-insights.js';

// A reference date AFTER October 2026, so the pack month is fully
// closed and the health window (three complete months) ends at it.
const REF = new Date('2026-11-05T12:00:00Z');

function baseState() {
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali Raza', area: 'Shahdara', addedOn: '2025-01-10', connectionDate: '2025-01-10', bills: [
        { id: 'b1a', month: '2026-09', dueAmount: 3000, dueDate: '2026-09-10', payments: [] },
        { id: 'b1b', month: '2026-10', dueAmount: 3000, dueDate: '2026-10-10', payments: [
          { id: 'p1', date: '2026-10-05', amount: 3000, method: 'Cash' },
        ] },
      ] },
      { id: 'c2', customerNumber: 2, name: 'Bilal Ahmed', area: 'Shahdara', addedOn: '2026-10-11', bills: [
        { id: 'b2a', month: '2026-10', dueAmount: 2000, dueDate: '2026-10-10', payments: [
          { id: 'p2', date: '2026-10-07', amount: 2000, method: 'JazzCash' },
        ] },
      ] },
      { id: 'c3', customerNumber: 3, name: 'Chaudhry <Nazeer> & Sons', area: 'Lahore, "Old" Town', connectionDate: '2025-01-10', bills: [
        { id: 'b3a', month: '2026-09', dueAmount: 1500, dueDate: '2026-09-10', payments: [] },
        { id: 'b3b', month: '2026-10', dueAmount: 1500, dueDate: '2026-10-10', payments: [] },
      ] },
      { id: 'c4', customerNumber: 4, name: 'Danish Iqbal', connectionDate: '2025-05-01', bills: [
        { id: 'b4a', month: '2026-10', dueAmount: 5000, dueDate: '2026-10-10', payments: [
          { id: 'p4', date: '2026-10-09', amount: 5000, method: 'Cash', voided: true, voidedAt: '2026-10-10T10:00:00Z', voidReason: 'Duplicate entry' },
        ] },
      ] },
    ],
    expenses: [
      { id: 'e1', date: '2026-10-02', amount: 2000, category: 'Bandwidth' },
      { id: 'e2', date: '2026-10-18', amount: 500, category: 'Field Visit' },
      { id: 'e3', date: '2026-09-05', amount: 700, category: 'Electricity' },
    ],
  };
}

function build(state = baseState(), month = '2026-10') {
  return buildOwnerReportPack(state, month, { referenceDate: REF });
}

test('Plan R packReferenceDate: pack month maps to the 5th of the next month', () => {
  assert.equal(packReferenceDate('2026-10').toISOString().slice(0, 10), '2026-11-05');
  assert.equal(packReferenceDate('2026-12').toISOString().slice(0, 10), '2027-01-05');
  assert.equal(packReferenceDate('2026-01').toISOString().slice(0, 10), '2026-02-05');
});

test('Plan R header: month, previous month, date range and generated date', () => {
  const pack = build();
  assert.equal(pack.validMonth, true);
  assert.equal(pack.month, '2026-10');
  assert.equal(pack.previousMonth, '2026-09');
  assert.deepEqual(pack.dateRange, { start: '2026-10-01', end: '2026-10-31' });
  assert.equal(pack.generatedOn, '2026-11-05');
});

test('Plan R header: February date range uses the month length', () => {
  const pack = build(baseState(), '2026-02');
  assert.deepEqual(pack.dateRange, { start: '2026-02-01', end: '2026-02-28' });
});

test('Plan R sources: one entry per assembled report', () => {
  const pack = build();
  assert.deepEqual(pack.sources.map((row) => row.section), ['month', 'areas', 'health', 'insights']);
  assert.ok(pack.sources.every((row) => typeof row.builder === 'string' && row.builder.length > 0));
});

test('Plan R traceability: month facts are the comparison monthB, verbatim', () => {
  const state = baseState();
  const pack = buildOwnerReportPack(state, '2026-10', { referenceDate: REF });
  const comparison = buildMonthToMonthComparison(state, '2026-09', '2026-10', REF);
  assert.deepEqual(pack.monthFacts, comparison.monthB);
  assert.deepEqual(pack.previousMonthFacts, comparison.monthA);
  assert.deepEqual(pack.changes, comparison.changes);
  assert.equal(pack.comparisonAvailable, true);
  assert.equal(pack.comparisonUnavailableReason, '');
});

test('Plan R month figures: billed, collection, rate, outstanding, expenses, profit', () => {
  const facts = build().monthFacts;
  assert.equal(facts.billedAmount, 11500);
  // The source builder counts receipts by payment date, voided or not;
  // the pack carries that figure unchanged, it does not re-filter it.
  assert.equal(facts.collection, 10000);
  assert.equal(facts.collectionRate, 87.0);
  assert.equal(facts.outstanding, 6500);
  assert.equal(facts.expenses, 2500);
  assert.equal(facts.cashProfit, 7500);
  assert.equal(facts.pricedBillCount, 4);
  assert.equal(facts.billCount, 4);
  assert.equal(facts.collectionReceiptCount, 3);
  assert.equal(facts.newCustomers, 1);
});

test('Plan R traceability: areas are the area breakdowns, verbatim', () => {
  const state = baseState();
  const pack = buildOwnerReportPack(state, '2026-10', { referenceDate: REF });
  assert.deepEqual(pack.areas, buildAreaBreakdowns(state, REF));
});

test('Plan R area totals: cumulative priced bills, voided receipt excluded', () => {
  const totals = build().areas.totals;
  assert.equal(totals.billed, 16000);
  assert.equal(totals.collected, 5000);
  assert.equal(totals.outstanding, 11000);
  assert.equal(totals.overdueBills, 4);
});

test('Plan R area rows: Shahdara, the quoted area, and unrecorded area', () => {
  const areas = build().areas.areas;
  const byName = Object.fromEntries(areas.map((row) => [row.name, row]));
  assert.equal(byName.Shahdara.billed, 8000);
  assert.equal(byName.Shahdara.collected, 5000);
  assert.equal(byName.Shahdara.outstanding, 3000);
  // The source builder canonicalises area labels ("Old" -> "old");
  // the pack carries the canonical label unchanged.
  assert.equal(byName['Lahore, "old" Town'].billed, 3000);
  assert.equal(byName['Lahore, "old" Town'].collected, 0);
  assert.equal(byName['Lahore, "old" Town'].outstanding, 3000);
  assert.equal(byName['Area not recorded'].billed, 5000);
  assert.equal(byName['Area not recorded'].collected, 0);
  assert.equal(byName['Area not recorded'].outstanding, 5000);
});

test('Plan R area rows: sorted by outstanding, as the source returns them', () => {
  const areas = build().areas.areas;
  const outstanding = areas.map((row) => row.outstanding);
  assert.deepEqual(outstanding, [...outstanding].sort((a, b) => b - a));
});

test('Plan R traceability: health is the business health score, verbatim', () => {
  const state = baseState();
  const pack = buildOwnerReportPack(state, '2026-10', { referenceDate: REF });
  assert.deepEqual(pack.health, buildBusinessHealthScore(state, REF));
});

test('Plan R health: window ends at the pack month', () => {
  const health = build().health;
  assert.equal(health.window.endMonth, '2026-10');
  assert.equal(health.window.startMonth, '2026-08');
  assert.equal(health.availableFactorCount, health.factors.length);
  assert.ok(Number.isFinite(health.score));
});

test('Plan R health: PR #688 coverage wording carried unchanged', () => {
  const state = baseState();
  const pack = buildOwnerReportPack(state, '2026-10', { referenceDate: REF });
  const health = buildBusinessHealthScore(state, REF);
  assert.deepEqual(pack.health.coverage, health.coverage);
  assert.equal(pack.health.openingBasis, health.openingBasis);
  assert.equal(pack.health.coverage.pricedBillCount, 6);
  assert.equal(pack.health.coverage.receiptCount, 3);
  assert.equal(pack.health.coverage.totalProfiles, 4);
});

test('Plan R traceability: insights are the ISP insights, verbatim', () => {
  const state = baseState();
  const pack = buildOwnerReportPack(state, '2026-10', { referenceDate: REF });
  assert.deepEqual(pack.insights, buildIspInsights(state, REF));
});

test('Plan R insights: last month is the pack month, this month is next', () => {
  const insights = build().insights;
  assert.equal(insights.lastMonth, '2026-10');
  assert.equal(insights.currentMonth, '2026-11');
  assert.equal(insights.collection.lastMonth.rate, 87.0);
  assert.equal(insights.collection.lastMonth.billed, 11500);
  assert.equal(insights.collection.thisMonth.rate, null);
  assert.equal(insights.collection.deltaPoints, null);
});

test('Plan R insights: overdue trend carries the pack-month outstanding', () => {
  const trend = build().insights.overdueTrend;
  const byMonth = Object.fromEntries(trend.map((row) => [row.month, row.outstanding]));
  assert.equal(byMonth['2026-09'], 4500);
  assert.equal(byMonth['2026-10'], 6500);
  assert.equal(byMonth['2026-11'], 0);
});

test('Plan R no mutation: state is unchanged after building the pack', () => {
  const state = baseState();
  const before = JSON.stringify(state);
  buildOwnerReportPack(state, '2026-10', { referenceDate: REF });
  assert.equal(JSON.stringify(state), before);
});

test('Plan R invalid month: zeroed pack, no throw', () => {
  const pack = buildOwnerReportPack(baseState(), 'not-a-month', { referenceDate: REF });
  assert.equal(pack.validMonth, false);
  assert.equal(pack.monthFacts, null);
  assert.equal(pack.areas, null);
  assert.equal(pack.health, null);
  assert.equal(pack.insights, null);
  assert.equal(pack.comparisonAvailable, false);
  assert.ok(pack.comparisonUnavailableReason.length > 0);
});

test('Plan R invalid month: print and CSV are the empty forms', () => {
  const pack = buildOwnerReportPack(baseState(), '', { referenceDate: REF });
  assert.match(buildOwnerReportPackPrintHtml(pack), /No month selected/);
  assert.equal(buildOwnerReportPackCsv(pack), 'section,metric,value,source\n');
  assert.match(buildOwnerReportPackPrintHtml(null), /No month selected/);
  assert.equal(buildOwnerReportPackCsv(null), 'section,metric,value,source\n');
});

test('Plan R comparison unavailable: old month keeps the other sections', () => {
  const pack = buildOwnerReportPack(baseState(), '2020-01', { referenceDate: REF });
  assert.equal(pack.validMonth, true);
  assert.equal(pack.comparisonAvailable, false);
  assert.equal(pack.monthFacts, null);
  assert.ok(pack.comparisonUnavailableReason.length > 0);
  assert.ok(pack.areas !== null);
  assert.ok(pack.health !== null);
  assert.ok(pack.insights !== null);
});

test('Plan R comparison unavailable: print names the reason, CSV has no month rows', () => {
  const pack = buildOwnerReportPack(baseState(), '2020-01', { referenceDate: REF });
  const html = buildOwnerReportPackPrintHtml(pack);
  assert.ok(html.includes(pack.comparisonUnavailableReason));
  const csv = buildOwnerReportPackCsv(pack);
  assert.ok(!csv.split('\n').some((line) => line.startsWith('month,')));
  assert.ok(csv.split('\n').some((line) => line.startsWith('health,')));
});

test('Plan R empty ledger: pack builds, health unavailable, no crash', () => {
  const pack = buildOwnerReportPack({ customers: [], expenses: [] }, '2026-10', { referenceDate: REF });
  assert.equal(pack.validMonth, true);
  assert.equal(pack.monthFacts.billedAmount, 0);
  assert.equal(pack.monthFacts.collection, 0);
  assert.equal(pack.monthFacts.collectionRate, null);
  assert.equal(pack.health.score, null);
  assert.deepEqual(pack.areas.areas, []);
  assert.deepEqual(pack.areas.totals, { billed: 0, collected: 0, outstanding: 0, overdueBills: 0 });
});

test('Plan R print: one header with month, date range and generated date', () => {
  const html = buildOwnerReportPackPrintHtml(build());
  assert.match(html, /Owner Report Pack/);
  assert.match(html, /October 2026/);
  assert.ok(html.includes('2026-10-01 to 2026-10-31'));
  assert.ok(html.includes('Generated 2026-11-05'));
});

test('Plan R print: brand header from the Plan Q branding system', () => {
  const html = buildOwnerReportPackPrintHtml(build());
  assert.ok(html.includes('Shahdara ISP'));
  assert.ok(html.includes('Tel: 0300-1234567'));
  assert.ok(html.includes('مالک رپورٹ پیک'));
  const custom = buildOwnerReportPackPrintHtml(build(), { brand: { businessName: 'Test Net', businessPhone: '0301-9999999', areaName: 'Test Area' } });
  assert.ok(custom.includes('Test Net'));
  assert.ok(custom.includes('Tel: 0301-9999999'));
});

test('Plan R print: month figures and area table', () => {
  const html = buildOwnerReportPackPrintHtml(build());
  assert.ok(html.includes('PKR 11,500'));
  assert.ok(html.includes('PKR 10,000'));
  assert.ok(html.includes('PKR 6,500'));
  assert.ok(html.includes('Shahdara'));
  assert.ok(html.includes('PKR 16,000'));
});

test('Plan R print: health score, factors, coverage and opening basis', () => {
  const pack = build();
  const html = buildOwnerReportPackPrintHtml(pack);
  assert.ok(html.includes(String(pack.health.score)));
  assert.ok(html.includes(pack.health.category));
  for (const factor of pack.health.factors) assert.ok(html.includes(factor.label));
  assert.ok(html.includes(pack.health.openingBasis));
  assert.ok(html.includes('6 priced bill(s)'));
});

test('Plan R print: insights trend and the read-only footer', () => {
  const html = buildOwnerReportPackPrintHtml(build());
  assert.ok(html.includes('2026-10'));
  assert.ok(html.includes('changes no record'));
  assert.ok(html.includes('month comparison, area breakdowns, business health score, ISP insights'));
});

test('Plan R print: names and area names are escaped', () => {
  const html = buildOwnerReportPackPrintHtml(build());
  assert.ok(html.includes('Lahore, &quot;old&quot; Town'));
  assert.ok(!html.includes('Lahore, "old" Town'));
  assert.ok(!html.includes('<Nazeer>'));
});

test('Plan R print: empty ledger shows Not available, never NaN', () => {
  const pack = buildOwnerReportPack({ customers: [], expenses: [] }, '2026-10', { referenceDate: REF });
  const html = buildOwnerReportPackPrintHtml(pack);
  assert.ok(html.includes('Not available'));
  assert.ok(!html.includes('NaN'));
  assert.ok(html.includes('No priced bills are recorded yet.'));
});

test('Plan R CSV: header and month rows', () => {
  const csv = buildOwnerReportPackCsv(build());
  const lines = csv.split('\n');
  assert.equal(lines[0], 'section,metric,value,source');
  assert.ok(lines.includes('month,billed_amount,11500,buildMonthToMonthComparison'));
  assert.ok(lines.includes('month,collection,10000,buildMonthToMonthComparison'));
  assert.ok(lines.includes('month,collection_rate_pct,87,buildMonthToMonthComparison'));
  assert.ok(lines.includes('month,outstanding,6500,buildMonthToMonthComparison'));
  assert.ok(lines.includes('month,expenses,2500,buildMonthToMonthComparison'));
  assert.ok(lines.includes('month,cash_profit,7500,buildMonthToMonthComparison'));
  assert.ok(lines.includes('month,priced_bill_count,4,buildMonthToMonthComparison'));
  assert.ok(lines.includes('month,collection_receipt_count,3,buildMonthToMonthComparison'));
  assert.ok(csv.endsWith('\n'));
});

test('Plan R CSV: area totals and area rows', () => {
  const csv = buildOwnerReportPackCsv(build());
  assert.ok(csv.includes('areas,total_billed,16000,buildAreaBreakdowns'));
  assert.ok(csv.includes('areas,total_collected,5000,buildAreaBreakdowns'));
  assert.ok(csv.includes('areas,total_outstanding,11000,buildAreaBreakdowns'));
  assert.ok(csv.includes('areas,total_overdue_bills,4,buildAreaBreakdowns'));
  assert.ok(csv.includes('area:Shahdara,billed,8000,buildAreaBreakdowns'));
  assert.ok(csv.includes('area:Shahdara,outstanding,3000,buildAreaBreakdowns'));
  assert.ok(csv.includes('area:Area not recorded,billed,5000,buildAreaBreakdowns'));
});

test('Plan R CSV: area name with comma and quote is quoted and doubled', () => {
  const csv = buildOwnerReportPackCsv(build());
  assert.ok(csv.includes('"area:Lahore, ""old"" Town",billed,3000,buildAreaBreakdowns'));
  assert.ok(!csv.split('\n').some((line) => line.startsWith('area:Lahore,')));
});

test('Plan R CSV: health rows carry score, category and factor values', () => {
  const pack = build();
  const csv = buildOwnerReportPackCsv(pack);
  assert.ok(csv.includes(`health,score,${pack.health.score},buildBusinessHealthScore`));
  assert.ok(csv.includes(`health,category,${pack.health.category},buildBusinessHealthScore`));
  assert.ok(csv.includes(`health,available_factor_count,${pack.health.availableFactorCount},buildBusinessHealthScore`));
  for (const factor of pack.health.factors) {
    assert.ok(csv.includes(`health_factor:${factor.id},value,${factor.value},buildBusinessHealthScore`));
  }
});

test('Plan R CSV: insights rows and overdue trend rows', () => {
  const csv = buildOwnerReportPackCsv(build());
  assert.ok(csv.includes('insights,collection_last_month_rate_pct,87,buildIspInsights'));
  assert.ok(csv.includes('insights,collection_this_month_rate_pct,,buildIspInsights'));
  assert.ok(csv.includes('insights,collection_delta_points,,buildIspInsights'));
  assert.ok(csv.includes('overdue_trend:2026-09,outstanding,4500,buildIspInsights'));
  assert.ok(csv.includes('overdue_trend:2026-10,outstanding,6500,buildIspInsights'));
});

test('Plan R CSV: nulls stay blank, never zero', () => {
  const pack = buildOwnerReportPack({ customers: [], expenses: [] }, '2026-10', { referenceDate: REF });
  const csv = buildOwnerReportPackCsv(pack);
  assert.ok(csv.includes('month,collection_rate_pct,,buildMonthToMonthComparison'));
  assert.ok(csv.includes('health,score,,buildBusinessHealthScore'));
  assert.ok(!csv.includes('month,collection_rate_pct,0,'));
});

test('Plan R CSV: every row names a source builder', () => {
  const rows = buildOwnerReportPackCsv(build()).trim().split('\n').slice(1);
  assert.ok(rows.length > 20);
  for (const row of rows) {
    assert.ok(/,build(MonthToMonthComparison|AreaBreakdowns|BusinessHealthScore|IspInsights)$/.test(row), row);
  }
});

test('Plan R controller: null when the dialog is absent (unit-test DOM)', () => {
  assert.equal(setupOwnerReportPack(() => ({}), {}), null);
});
