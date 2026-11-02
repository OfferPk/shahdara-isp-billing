// M8: Month-End Owner Report (printable A4, read-only). Every figure is
// composed from an existing builder — the tests pin the composition by
// deep-comparing the report against those builders' own outputs on the
// same synthetic ledger (Owner Khata report, phase3 month-end
// outstanding, dashboard KPIs). Pure computation, synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOwnerMonthReport,
  buildOwnerMonthReportPrintHtml,
  setupOwnerMonthReport
} from '../owner-month-report.js';
import { buildOwnerKhataReport, formatPKR } from '../owner-khata.js';
import { buildPartnerShareReport, outstandingAtMonthEnd } from '../phase3.js';
import { calculateDashboardKpis } from '../dashboard.js';
import { TRANSLATIONS, t } from '../nav-language.js';

// A reference date AFTER October 2026, so the report month is fully
// closed (month-end cutoff, not a partial month).
const REF = new Date('2026-11-05T12:00:00Z');
const MID_OCT = new Date('2026-10-15T12:00:00Z');

function baseState() {
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali Raza', connectionDate: '2026-10-03', bills: [
        { id: 'b1a', month: '2026-09', dueAmount: 3000, payments: [] },
        { id: 'b1b', month: '2026-10', dueAmount: 3000, payments: [
          { id: 'p1', date: '2026-10-05', amount: 3000, method: 'Cash' },
        ] },
      ] },
      { id: 'c2', customerNumber: 2, name: 'Bilal Ahmed', addedOn: '2026-10-11', bills: [
        { id: 'b2a', month: '2026-10', dueAmount: 2000, payments: [
          { id: 'p2', date: '2026-10-07', amount: 2000, method: 'JazzCash' },
        ] },
      ] },
      { id: 'c3', customerNumber: 3, name: 'Chaudhry <Nazeer> & Sons', connectionDate: '2025-01-10', bills: [
        { id: 'b3a', month: '2026-09', dueAmount: 1500, payments: [] },
        { id: 'b3b', month: '2026-10', dueAmount: 1500, payments: [] },
      ] },
      { id: 'c4', customerNumber: 4, name: 'Danish Iqbal', connectionDate: '2025-05-01', bills: [
        { id: 'b4a', month: '2026-10', dueAmount: 5000, payments: [
          { id: 'p4', date: '2026-10-09', amount: 5000, method: 'Cash', voided: true, voidedAt: '2026-10-10T10:00:00Z', voidReason: 'Duplicate entry' },
        ] },
      ] },
      { id: 'c5', customerNumber: 5, name: 'Ehsan Ullah', archived: true, connectionDate: '2026-10-20', bills: [
        { id: 'b5a', month: '2026-10', dueAmount: 1000, payments: [] },
      ] },
    ],
    expenses: [
      { id: 'e1', date: '2026-10-02', amount: 2000, category: 'NayaPay Bandwidth' },
      { id: 'e2', date: '2026-10-18', amount: 500, category: 'Field Visit' },
      { id: 'e3', date: '2026-09-05', amount: 700, category: 'Electricity' },
    ],
  };
}

function build(state = baseState(), overrides = {}) {
  return buildOwnerMonthReport(state, '2026-10', { referenceDate: REF, ...overrides });
}

test('collections, channels, expenses, profit and shares equal the Owner Khata report exactly', () => {
  const state = baseState();
  const inputs = { referenceDate: REF };
  const khata = buildOwnerKhataReport(state, '2026-10', inputs);
  const report = build(state);
  assert.equal(report.validMonth, true);
  assert.equal(report.month, '2026-10');
  assert.equal(report.collected, khata.collected);
  assert.equal(report.receiptCount, khata.receiptCount);
  assert.deepEqual(report.collectionChannels, khata.collectionChannels);
  assert.equal(report.expenses, khata.expenses);
  assert.equal(report.expenseCount, khata.expenseCount);
  assert.deepEqual(report.expenseCategories, khata.expenseCategories);
  assert.equal(report.profit, khata.profit);
  assert.equal(report.isLoss, khata.isLoss);
  assert.equal(report.nasirShare, khata.nasirShare);
  assert.equal(report.aqibShare, khata.aqibShare);
  // Hard pins on the same fixture (partner report is the shared source).
  const partner = buildPartnerShareReport(state, '2026-10', REF);
  assert.equal(report.collected, partner.summary.revenue);
  assert.equal(report.collected, 5000);
  assert.equal(report.expenses, 2500);
  assert.equal(report.profit, 2500);
  assert.equal(report.nasirShare, 1250);
  assert.equal(report.aqibShare, 1250);
  // The channel split still sums to the collected total.
  assert.equal(report.collectionChannels.reduce((sum, row) => sum + row.amount, 0), report.collected);
});

test('a voided payment is never collected and never settles a bill', () => {
  const state = baseState();
  const report = build(state);
  const partner = buildPartnerShareReport(state, '2026-10', REF);
  // The voided Rs 5,000 receipt (c4) is in neither the partner revenue
  // nor this report's collected figure.
  assert.equal(partner.summary.revenue, 5000);
  assert.equal(report.collected, partner.summary.revenue);
  assert.equal(report.receiptCount, 2);
  // And c4's bill still stands unpaid at month end (top defaulter).
  const closing = outstandingAtMonthEnd(state, '2026-10', REF);
  assert.equal(closing.byCustomer.get('c4'), 5000);
  assert.equal(report.topDefaulters[0].customerId, 'c4');
  assert.equal(report.topDefaulters[0].amount, 5000);
});

test('arrears movement reads outstandingAtMonthEnd at both ends of the month', () => {
  const state = baseState();
  const report = build(state);
  const opening = outstandingAtMonthEnd(state, '2026-09', REF);
  const closing = outstandingAtMonthEnd(state, '2026-10', REF);
  const khata = buildOwnerKhataReport(state, '2026-10', { referenceDate: REF });
  assert.equal(report.openingArrears, Math.round(opening.total));
  assert.equal(report.closingArrears, Math.round(closing.total));
  assert.equal(report.closingArrears, khata.pendingArrears);
  assert.equal(report.arrearsChange, report.closingArrears - report.openingArrears);
  // Hard pins: Sep-end pending is Ali's unpaid Sep bill + Chaudhry's
  // Sep bill. Oct-end keeps both (payments sit on their own bill in
  // this ledger, so Ali's October payment settles his October bill,
  // not September's) and adds Chaudhry's Oct bill, Danish's
  // voided-only bill and the archived customer's bill.
  assert.equal(report.openingArrears, 4500);
  assert.equal(report.closingArrears, 12000);
  assert.equal(report.arrearsChange, 7500);
});

test('top defaulters are the five largest month-end balances from byCustomer', () => {
  const state = baseState();
  const report = build(state);
  const closing = outstandingAtMonthEnd(state, '2026-10', REF);
  const expected = [...closing.byCustomer.entries()]
    .map(([customerId, amount]) => ({ customerId, amount }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  assert.deepEqual(
    report.topDefaulters.map(({ customerId, amount }) => ({ customerId, amount })),
    expected
  );
  assert.deepEqual(report.topDefaulters.map((row) => row.customerId), ['c4', 'c1', 'c3', 'c5']);
  assert.equal(report.topDefaulters[2].name, 'Chaudhry <Nazeer> & Sons');
  // A month with more than five debtors is cut at five, highest first.
  const many = baseState();
  for (let i = 0; i < 6; i += 1) {
    many.customers.push({ id: `d${i}`, customerNumber: 10 + i, name: `Debtor ${i}`, bills: [
      { id: `bd${i}`, month: '2026-10', dueAmount: 100 * (i + 1), payments: [] },
    ] });
  }
  const manyReport = build(many);
  assert.equal(manyReport.topDefaulters.length, 5);
  assert.equal(manyReport.topDefaulters[0].amount, 5000);
  assert.equal(manyReport.topDefaulters.at(-1).amount, 600);
});

test('new connections equal the dashboard KPI count for the month', () => {
  const state = baseState();
  const report = build(state);
  const kpis = calculateDashboardKpis(state, MID_OCT);
  assert.equal(report.newConnections, kpis.newConnectionsCount);
  // Ali (connectionDate in Oct) + Bilal (addedOn fallback in Oct) = 2;
  // the archived October connection is excluded by the dashboard rule.
  assert.equal(report.newConnections, 2);
});

test('a loss month shows the loss and zero partner shares, identical to Owner Khata', () => {
  const state = {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Ali Raza', bills: [
        { id: 'b1', month: '2026-10', dueAmount: 1000, payments: [
          { id: 'p1', date: '2026-10-05', amount: 1000, method: 'Cash' },
        ] },
      ] },
    ],
    expenses: [
      { id: 'e1', date: '2026-10-02', amount: 4000, category: 'NayaPay Bandwidth' },
    ],
  };
  const inputs = { referenceDate: REF };
  const khata = buildOwnerKhataReport(state, '2026-10', inputs);
  const report = build(state);
  assert.equal(report.collected, 1000);
  assert.equal(report.expenses, 4000);
  assert.equal(report.profit, -3000);
  assert.equal(report.isLoss, true);
  assert.equal(report.nasirShare, 0);
  assert.equal(report.aqibShare, 0);
  assert.equal(report.nasirShare, khata.nasirShare);
  assert.equal(report.aqibShare, khata.aqibShare);
  assert.equal(report.profit, khata.profit);
});

test('the builder is read-only and deterministic', () => {
  const state = baseState();
  const snapshot = structuredClone(state);
  const first = build(state);
  const second = build(state);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(first, second);
});

test('an invalid month yields the zeroed report', () => {
  const report = buildOwnerMonthReport(baseState(), 'October', { referenceDate: REF });
  assert.equal(report.validMonth, false);
  assert.equal(report.month, '');
  assert.equal(report.collected, 0);
  assert.equal(report.closingArrears, 0);
  assert.deepEqual(report.topDefaulters, []);
  assert.equal(report.newConnections, 0);
});

test('print HTML carries the same figures, escapes names, and localizes headings', () => {
  const report = build(baseState());
  const html = buildOwnerMonthReportPrintHtml(report);
  assert.ok(html.includes(formatPKR(5000)));
  assert.ok(html.includes(formatPKR(12000)));
  assert.ok(html.includes(formatPKR(7500)));
  assert.ok(html.includes('October 2026'));
  assert.ok(html.includes('Chaudhry &lt;Nazeer&gt; &amp; Sons'));
  assert.ok(!html.includes('Chaudhry <Nazeer>'));
  const htmlUr = buildOwnerMonthReportPrintHtml(report, { lang: 'ur' });
  assert.ok(htmlUr.includes(TRANSLATIONS.ur.omr_title));
  assert.ok(!htmlUr.includes('omr_title'));
  const empty = buildOwnerMonthReportPrintHtml({ validMonth: false });
  assert.ok(empty.includes('No month selected.'));
});

test('every omr_* key used by the phase is defined in both languages', () => {
  const keys = [
    'omr_title', 'omr_help', 'omr_month_label', 'omr_collections', 'omr_collected',
    'omr_channels', 'omr_expenses', 'omr_entry_sing', 'omr_entry_plur', 'omr_profit',
    'omr_loss_suffix', 'omr_shares', 'omr_nasir_share', 'omr_aqib_share', 'omr_arrears',
    'omr_opening', 'omr_closing', 'omr_change', 'omr_defaulters', 'omr_no_defaulters',
    'omr_new_connections', 'omr_print_btn', 'omr_close', 'omr_popup_blocked', 'omr_foot'
  ];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.equal(t(key, 'en'), TRANSLATIONS.en[key]);
    assert.equal(t(key, 'ur'), TRANSLATIONS.ur[key]);
  }
});

test('setup returns null without a DOM (unit-test environment)', () => {
  assert.equal(setupOwnerMonthReport(() => baseState()), null);
});
