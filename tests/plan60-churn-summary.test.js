/**
 * plan60-churn-summary.test.js — Plan 60: monthly churn and retention
 * summary (read-only).
 * Pins:
 * - the month arithmetic reconciles exactly on one fixture: start +
 *   new − departed = end, and that end also equals an independent
 *   count of customers active at month end;
 * - stayed is counted directly (month-start customers who did not
 *   depart), NOT as start minus departed, because departures also
 *   include customers who joined during the month;
 * - a departure on the first day of the month counts at month start
 *   and as a departure in the month; a departure before the month
 *   counts in neither; a join after the month counts in neither;
 * - churn rate is departed ÷ month-start customers, and null (not
 *   0%) when there were no customers at month start;
 * - revenue at risk sums exactly the monthly amounts of the Plan 56
 *   at-risk rows supplied by the caller, in integer cents, and an
 *   entry with no usable amount is counted, never zero-filled;
 * - impossible dates (2026-02-30) are refused; a missing join date
 *   counts the customer as already a customer at month start and is
 *   named in the assumptions; a departure before its join date is
 *   ignored as inconsistent data, never silently repaired;
 * - invalid months return null, inputs are never mutated, and the
 *   module holds no bill, payment, or lifecycle field.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validChurnDate,
  validChurnMonth,
  monthBounds,
  buildMonthlyChurnSummary,
  churnSummaryText,
  churnHtml,
  churnCsv,
  churnFilename,
} from '../churn-summary.js';

// One fixture, used by every arithmetic test so the counts must
// agree with each other, not just with themselves.
function fixtureCustomers() {
  return [
    { id: 'a', name: 'Ayesha', joinedDate: '2026-09-10', leftDate: null },
    { id: 'b', name: 'Bilal', joinedDate: '2026-09-20', leftDate: '2026-10-15' },
    { id: 'c', name: 'Chaudhry', joinedDate: '2026-10-05', leftDate: null },
    { id: 'd', name: 'Danish', joinedDate: '2026-10-20', leftDate: '2026-10-28' },
    { id: 'e', name: 'Erum', joinedDate: '2026-08-01', leftDate: '2026-09-30' },
    { id: 'f', name: 'Faraz', joinedDate: '2026-11-02', leftDate: null },
    { id: 'g', name: 'Gul', joinedDate: null, leftDate: null },
    { id: 'h', name: 'Hassan', joinedDate: '2026-10-01', leftDate: null },
    { id: 'i', name: 'Irfan', joinedDate: '2026-09-01', leftDate: '2026-10-01' },
    { id: 'j', name: 'Jamila', joinedDate: '2026-10-31', leftDate: null },
  ];
}

test('month and date validation', () => {
  assert.equal(validChurnMonth('2026-10'), '2026-10');
  assert.equal(validChurnMonth('2026-13'), null);
  assert.equal(validChurnMonth('2026-1'), null);
  assert.equal(validChurnMonth(''), null);
  assert.equal(validChurnDate('2026-02-30'), null);
  assert.equal(validChurnDate('2024-02-29'), '2024-02-29');
  assert.equal(validChurnDate('2026-10-15T10:30:00'), '2026-10-15');
  assert.equal(validChurnDate('not a date'), null);
  assert.deepEqual(monthBounds('2026-10'), { start: '2026-10-01', end: '2026-10-31' });
  assert.deepEqual(monthBounds('2026-02'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(monthBounds('2024-02'), { start: '2024-02-01', end: '2024-02-29' });
  assert.equal(monthBounds('2026-13'), null);
});

test('fixture arithmetic reconciles exactly', () => {
  const view = buildMonthlyChurnSummary({ month: '2026-10', customers: fixtureCustomers(), atRisk: [] });
  // Start: A, B, G (no join date, counted as already a customer),
  // I (departs on the first day, still counts at month start).
  assert.equal(view.start, 4);
  // New: C, D, H (joins on the first day), J (joins on the last day).
  assert.equal(view.newCustomers, 4);
  // Departed: B, D (joined this month), I (first day).
  assert.equal(view.departed, 3);
  // Stayed counts start customers directly: A and G only — D was
  // never a month-start customer, so start minus departed (1)
  // would be wrong here.
  assert.equal(view.stayed, 2);
  assert.equal(view.end, 5);
  assert.equal(view.endCheck, 5);
  assert.equal(view.reconciles, true);
  assert.equal(view.netChange, 1);
  assert.equal(view.churnRate, 3 / 4);
  assert.equal(view.churnRatePercent, 75);
  assert.deepEqual(view.newList.map((row) => row.customerId), ['c', 'd', 'h', 'j'].map((id) => id));
  assert.deepEqual(
    view.departedList.map((row) => row.customerId).sort(),
    ['b', 'd', 'i'],
  );
});

test('invalid month returns null', () => {
  assert.equal(buildMonthlyChurnSummary({ month: '2026-13', customers: [] }), null);
  assert.equal(buildMonthlyChurnSummary({ month: '', customers: [] }), null);
  assert.equal(buildMonthlyChurnSummary({ customers: [] }), null);
});

test('churn rate is null, not zero, with no month-start customers', () => {
  const view = buildMonthlyChurnSummary({
    month: '2026-10',
    customers: [{ id: 'x', name: 'X', joinedDate: '2026-10-05', leftDate: null }],
    atRisk: [],
  });
  assert.equal(view.start, 0);
  assert.equal(view.newCustomers, 1);
  assert.equal(view.departed, 0);
  assert.equal(view.end, 1);
  assert.equal(view.churnRate, null);
  assert.equal(view.churnRatePercent, null);
  assert.match(churnSummaryText(view), /not calculable/);
});

test('empty month: all zero, churn null, reconciles', () => {
  const view = buildMonthlyChurnSummary({ month: '2026-10', customers: [], atRisk: [] });
  assert.equal(view.start, 0);
  assert.equal(view.end, 0);
  assert.equal(view.reconciles, true);
  assert.equal(view.revenueAtRisk, 0);
});

test('revenue at risk sums at-risk package amounts in cents', () => {
  const view = buildMonthlyChurnSummary({
    month: '2026-10',
    customers: fixtureCustomers(),
    atRisk: [
      { customerId: 'a', monthlyAmount: 1000 },
      { customerId: 'c', monthlyAmount: 1500.10 },
      { customerId: 'g', monthlyAmount: 349.90 },
      { customerId: 'z', monthlyAmount: null },
      { customerId: 'y', monthlyAmount: -50 },
      { customerId: '', monthlyAmount: 9999 },
    ],
  });
  // 1000 + 1500.10 + 349.90 = 2850 exactly, no float drift.
  assert.equal(view.revenueAtRisk, 2850);
  assert.equal(view.revenueAtRiskCents, 285000);
  assert.equal(view.atRiskCount, 5);
  assert.equal(view.atRiskUnknownAmount, 2);
  assert.match(churnSummaryText(view), /Rs\. 2850/);
});

test('missing join date is an assumption, not a silent guess', () => {
  const view = buildMonthlyChurnSummary({
    month: '2026-10',
    customers: [{ id: 'g', name: 'Gul', joinedDate: null, leftDate: null }],
    atRisk: [],
  });
  assert.equal(view.start, 1);
  assert.equal(view.end, 1);
  assert.equal(view.assumptions.length, 1);
  assert.match(view.assumptions[0], /no recorded join date/);
});

test('departure before join date is ignored as inconsistent', () => {
  const view = buildMonthlyChurnSummary({
    month: '2026-10',
    customers: [{ id: 'k', name: 'Kiran', joinedDate: '2026-10-10', leftDate: '2026-09-01' }],
    atRisk: [],
  });
  assert.equal(view.newCustomers, 1);
  assert.equal(view.departed, 0);
  assert.equal(view.end, 1);
  assert.equal(view.reconciles, true);
  assert.equal(view.assumptions.length, 1);
  assert.match(view.assumptions[0], /inconsistent/);
});

test('impossible join date behaves like a missing join date', () => {
  const view = buildMonthlyChurnSummary({
    month: '2026-10',
    customers: [{ id: 'm', name: 'Musa', joinedDate: '2026-02-30', leftDate: null }],
    atRisk: [],
  });
  assert.equal(view.start, 1);
  assert.equal(view.assumptions.length, 1);
});

test('inputs are never mutated and no record field is held', () => {
  const customers = fixtureCustomers();
  const atRisk = [{ customerId: 'a', monthlyAmount: 1000 }];
  const snapshot = JSON.stringify({ customers, atRisk });
  const view = buildMonthlyChurnSummary({ month: '2026-10', customers, atRisk });
  assert.equal(JSON.stringify({ customers, atRisk }), snapshot);
  assert.equal('bills' in view, false);
  assert.equal('payments' in view, false);
  assert.equal('lifecycle' in view, false);
  assert.equal(view.revenueAtRisk, 1000);
});

test('summary text, HTML, CSV and filename', () => {
  const view = buildMonthlyChurnSummary({ month: '2026-10', customers: fixtureCustomers(), atRisk: [] });
  const text = churnSummaryText(view);
  assert.match(text, /2026-10: 4 at month start, 4 new, 3 departed, 2 stayed, 5 at month end/);
  assert.match(text, /net \+1/);
  assert.match(text, /churn rate 75%/);
  const html = churnHtml(view);
  assert.match(html, /Customers at month start/);
  assert.match(html, /Reconciliation: start 4 \+ new 4 − departed 3 = end 5 ✓/);
  assert.match(html, /Chaudhry/);
  assert.match(html, /Bilal/);
  const csv = churnCsv(view);
  assert.match(csv, /customers at month start,4/);
  assert.match(csv, /churn rate,75/);
  assert.equal(churnFilename('2026-10'), 'churn-summary-2026-10.csv');
  assert.equal(churnFilename('bad'), 'churn-summary-all.csv');
  assert.equal(churnHtml(null), '<p style="font-size: 12px;">No churn view for this month.</p>');
  assert.equal(churnCsv(null), '');
});

test('HTML escapes customer names', () => {
  const view = buildMonthlyChurnSummary({
    month: '2026-10',
    customers: [{ id: 'x', name: '<script>alert(1)</script>', joinedDate: '2026-10-05', leftDate: null }],
    atRisk: [],
  });
  assert.doesNotMatch(churnHtml(view), /<script>alert/);
});
