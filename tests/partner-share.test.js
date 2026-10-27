// Partner share report: one shared helper drives both the "Nasir share" and
// "Aqib share" tabs in the Expenses view. Revenue is bill collections
// (receipts grouped by payment date); expenses are all dated recorded
// expenses grouped by payment date, across every recorded category.
// Profit = revenue - expenses; partner share = 50% of positive profit,
// otherwise 0 with the loss shown. Pure computation, synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPartnerShareReport, PARTNER_SHARE_RATE } from '../phase3.js';

function baseState() {
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
        { month: '2026-10', payments: [
          { id: 'p1', date: '2026-10-05', amount: 120000, method: 'Cash' },
          { id: 'p2', date: '2026-10-20', amount: 80000, method: 'Cash' },
        ] },
        { month: '2026-09', payments: [
          { id: 'p3', date: '2026-09-10', amount: 150000, method: 'Cash' },
        ] },
      ] },
      { id: 'c2', customerNumber: 2, name: 'Bilal', bills: [
        { month: '2026-10', payments: [
          { id: 'p4', date: '2026-10-07', amount: 50000, method: 'Cash' },
        ] },
      ] },
    ],
    expenses: [
      { id: 'e1', date: '2026-10-03', amount: 15000, category: 'Salary — Saad' },
      { id: 'e2', date: '2026-10-10', amount: 20000, category: 'Nayatel bill' },
      { id: 'e3', date: '2026-10-12', amount: 15000, category: 'Electricity' },
      { id: 'e4', date: '2026-09-05', amount: 10000, category: 'Electricity' },
    ],
  };
}

test('partner share rate is 50%', () => {
  assert.equal(PARTNER_SHARE_RATE, 0.5);
});

test('selected month: revenue, expenses, profit and 50% share', () => {
  const report = buildPartnerShareReport(baseState(), '2026-10', new Date('2026-10-27T12:00:00Z'));
  assert.equal(report.month, '2026-10');
  assert.equal(report.summary.revenue, 250000);
  assert.equal(report.summary.expenses, 50000);
  assert.equal(report.summary.profit, 200000);
  assert.equal(report.summary.share, 100000);
  assert.equal(report.summary.isLoss, false);
  assert.equal(report.summary.receiptCount, 3);
  assert.equal(report.summary.expenseCount, 3);
});

test('category breakdown is derived from recorded expenses, never hardcoded', () => {
  const report = buildPartnerShareReport(baseState(), '2026-10', new Date('2026-10-27T12:00:00Z'));
  assert.deepEqual(
    report.summary.categoryBreakdown.map(row => [row.category, row.amount, row.count]),
    [['Nayatel bill', 20000, 1], ['Electricity', 15000, 1], ['Salary — Saad', 15000, 1]],
  );
  const breakdownTotal = report.summary.categoryBreakdown.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(breakdownTotal, report.summary.expenses);
});

test('previous month is relative to the selected month', () => {
  const report = buildPartnerShareReport(baseState(), '2026-10', new Date('2026-10-27T12:00:00Z'));
  assert.equal(report.previousMonth.month, '2026-09');
  assert.equal(report.previousMonth.revenue, 150000);
  assert.equal(report.previousMonth.expenses, 10000);
  assert.equal(report.previousMonth.profit, 140000);
  assert.equal(report.previousMonth.share, 70000);
});

test('all-time totals are the sum of monthly reports', () => {
  const report = buildPartnerShareReport(baseState(), '2026-10', new Date('2026-10-27T12:00:00Z'));
  assert.equal(report.allTime.revenue, 400000);
  assert.equal(report.allTime.expenses, 60000);
  assert.equal(report.allTime.profit, 340000);
  assert.equal(report.allTime.share, 170000);
  assert.equal(report.allTime.profit, report.allTime.revenue - report.allTime.expenses);
});

test('loss month: share is 0 and the loss is shown', () => {
  const state = {
    customers: [{ id: 'c1', customerNumber: 1, name: 'Ali', bills: [
      { month: '2026-10', payments: [{ id: 'p1', date: '2026-10-05', amount: 5000, method: 'Cash' }] },
    ] }],
    expenses: [{ id: 'e1', date: '2026-10-03', amount: 20000, category: 'Electricity' }],
  };
  const report = buildPartnerShareReport(state, '2026-10', new Date('2026-10-27T12:00:00Z'));
  assert.equal(report.summary.revenue, 5000);
  assert.equal(report.summary.expenses, 20000);
  assert.equal(report.summary.profit, -15000);
  assert.equal(report.summary.share, 0);
  assert.equal(report.summary.isLoss, true);
});

test('empty month: zeros, empty breakdown, no crash', () => {
  const report = buildPartnerShareReport(baseState(), '2026-08', new Date('2026-10-27T12:00:00Z'));
  assert.equal(report.month, '2026-08');
  assert.equal(report.summary.revenue, 0);
  assert.equal(report.summary.expenses, 0);
  assert.equal(report.summary.profit, 0);
  assert.equal(report.summary.share, 0);
  assert.equal(report.summary.isLoss, false);
  assert.equal(report.summary.receiptCount, 0);
  assert.equal(report.summary.expenseCount, 0);
  assert.deepEqual(report.summary.categoryBreakdown, []);
});

test('invalid or missing month falls back to the current PKT month', () => {
  const ref = new Date('2026-10-27T12:00:00Z');
  assert.equal(buildPartnerShareReport(baseState(), 'bogus', ref).month, '2026-10');
  assert.equal(buildPartnerShareReport(baseState(), undefined, ref).month, '2026-10');
});

test('months list is newest first and always includes the current month', () => {
  const report = buildPartnerShareReport(baseState(), '2026-09', new Date('2026-10-27T12:00:00Z'));
  assert.deepEqual(report.months, ['2026-10', '2026-09']);
  assert.equal(report.history.length, 2);
  assert.equal(report.history[0].month, '2026-10');
});

test('whole-Rupee rounding keeps displayed numbers self-consistent', () => {
  const state = {
    customers: [{ id: 'c1', customerNumber: 1, name: 'Ali', bills: [
      { month: '2026-10', payments: [{ id: 'p1', date: '2026-10-05', amount: 1000.50, method: 'Cash' }] },
    ] }],
    expenses: [{ id: 'e1', date: '2026-10-03', amount: 0.50, category: 'Other expenses' }],
  };
  const { summary } = buildPartnerShareReport(state, '2026-10', new Date('2026-10-27T12:00:00Z'));
  assert.ok(Number.isInteger(summary.revenue) && Number.isInteger(summary.expenses));
  assert.equal(summary.profit, summary.revenue - summary.expenses);
  assert.equal(summary.share, Math.round(summary.profit * 0.5));
});

test('input state is not mutated', () => {
  const state = baseState();
  const before = JSON.stringify(state);
  buildPartnerShareReport(state, '2026-10', new Date('2026-10-27T12:00:00Z'));
  assert.equal(JSON.stringify(state), before);
});
