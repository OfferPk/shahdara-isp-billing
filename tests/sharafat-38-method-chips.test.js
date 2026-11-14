// Sharafat 38: method-breakdown chips derive from the monthly report's
// FILTERED rows. Every fixture here is synthetic; no real customer names or
// phone numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildMonthlyReport,
  calculateMethodCollectionTotals,
  calculateMethodTotalsForRows,
  recordedAmount,
} from '../core.js';

// 2026-11-15 12:00 PKT: current month 2026-11, previous 2026-10.
const REF = new Date(Date.UTC(2026, 10, 15, 7));
const MONTH = '2026-11';
const bill = (overrides) => ({ payments: [], ...overrides });
const customer = (id, fields, bills) => ({ id, customerNumber: id, name: `Customer ${id}`, archived: false, ...fields, bills });

const chipsSum = (totals) => totals.Cash + totals.JazzCash + totals.Easypaisa + totals.Raast + totals.Bank + totals.other;
const collectedSum = (rows) => rows.reduce((sum, row) => sum + (row.amountReceived || 0), 0);

// November fixture: c1 pending (nothing paid), c2 partial Cash 400,
// c3 paid Cash 1000, c4 partial with a CROSS-MONTH JazzCash 500 (dated
// December, on the November bill), c5 pending with only a VOIDED Cash 700,
// c6 with no November bill at all (not-set), c7 partial with NayaPay 1200
// (→ other) + 'Bank Transfer' 800 (→ Bank). The DATELESS payment lives in
// its own fixture below, not here: buildMonthlyReport sorts payments by
// date and throws on a dateless one (pre-existing, Sharafat 10 scope gap),
// so the dateless case is pinned at the helper level with fabricated rows.
function monthlyFixture() {
  return {
    customers: [
      customer('c1', { mohalla: 'Kishti' }, [
        bill({ month: MONTH, dueAmount: 1000, dueDate: '2026-11-05' }),
      ]),
      customer('c2', { mohalla: 'Kishti' }, [
        bill({ month: MONTH, dueAmount: 1000, dueDate: '2026-11-05', payments: [{ date: '2026-11-06', amount: 400, method: 'Cash' }] }),
      ]),
      customer('c3', { mohalla: 'Barrian' }, [
        bill({ month: MONTH, dueAmount: 1000, dueDate: '2026-11-05', payments: [{ date: '2026-11-06', amount: 1000, method: 'Cash' }] }),
      ]),
      customer('c4', { mohalla: 'Barrian' }, [
        bill({ month: MONTH, dueAmount: 2000, dueDate: '2026-11-05', payments: [
          { date: '2026-12-02', amount: 500, method: 'JazzCash' },
        ] }),
      ]),
      customer('c5', { mohalla: 'Kishti' }, [
        bill({ month: MONTH, dueAmount: 1000, dueDate: '2026-11-05', payments: [{ date: '2026-11-10', amount: 700, method: 'Cash', voided: true }] }),
      ]),
      customer('c6', { mohalla: 'Barrian' }, []),
      customer('c7', { mohalla: 'Kishti' }, [
        bill({ month: MONTH, dueAmount: 3000, dueDate: '2026-11-05', payments: [
          { date: '2026-11-08', amount: 1200, method: 'NayaPay' },
          { date: '2026-11-09', amount: 800, method: 'Bank Transfer' },
        ] }),
      ]),
    ],
    expenses: [],
  };
}

test('Sharafat 38: outstanding filter — chips sum to the filtered Collected figure', () => {
  const state = monthlyFixture();
  const rows = buildMonthlyReport(state, { month: MONTH, statusFilter: 'outstanding' }, REF);
  assert.deepEqual(rows.map((row) => row.customerId), ['c1', 'c2', 'c4', 'c5', 'c7']);
  assert.equal(collectedSum(rows), 2900);
  const totals = calculateMethodTotalsForRows(rows, state);
  assert.equal(totals.Cash, 400);
  assert.equal(totals.JazzCash, 500);
  assert.equal(totals.Easypaisa, 0);
  assert.equal(totals.Raast, 0);
  assert.equal(totals.Bank, 800);
  assert.equal(totals.other, 1200);
  assert.equal(totals.total, 2900);
  assert.equal(chipsSum(totals), collectedSum(rows));
});

test('Sharafat 38: paid and all filters — chips follow only the filtered rows', () => {
  const state = monthlyFixture();
  const paid = buildMonthlyReport(state, { month: MONTH, statusFilter: 'paid' }, REF);
  assert.deepEqual(paid.map((row) => row.customerId), ['c3']);
  const paidTotals = calculateMethodTotalsForRows(paid, state);
  assert.equal(paidTotals.Cash, 1000);
  assert.equal(paidTotals.total, 1000);
  assert.equal(chipsSum(paidTotals), collectedSum(paid));

  const all = buildMonthlyReport(state, { month: MONTH, statusFilter: 'all' }, REF);
  assert.equal(all.length, 7);
  const allTotals = calculateMethodTotalsForRows(all, state);
  assert.equal(allTotals.Cash, 1400);
  assert.equal(allTotals.JazzCash, 500);
  assert.equal(allTotals.Easypaisa, 0);
  assert.equal(allTotals.Bank, 800);
  assert.equal(allTotals.other, 1200);
  assert.equal(allTotals.total, 3900);
  assert.equal(chipsSum(allTotals), collectedSum(all));
});

test('Sharafat 38: area filter — chips follow the drilled-down mohalla rows only', () => {
  const state = monthlyFixture();
  const all = buildMonthlyReport(state, { month: MONTH, statusFilter: 'all' }, REF);
  const kishti = all.filter((row) => row.area === 'Kishti');
  assert.deepEqual(kishti.map((row) => row.customerId), ['c1', 'c2', 'c5', 'c7']);
  const kishtiTotals = calculateMethodTotalsForRows(kishti, state);
  assert.equal(kishtiTotals.Cash, 400);
  assert.equal(kishtiTotals.Bank, 800);
  assert.equal(kishtiTotals.other, 1200);
  assert.equal(kishtiTotals.total, 2400);
  assert.equal(chipsSum(kishtiTotals), collectedSum(kishti));

  const barrian = all.filter((row) => row.area === 'Barrian');
  assert.deepEqual(barrian.map((row) => row.customerId), ['c3', 'c4', 'c6']);
  const barrianTotals = calculateMethodTotalsForRows(barrian, state);
  assert.equal(barrianTotals.Cash, 1000);
  assert.equal(barrianTotals.JazzCash, 500);
  assert.equal(barrianTotals.Easypaisa, 0);
  assert.equal(barrianTotals.total, 1500);
  assert.equal(chipsSum(barrianTotals), collectedSum(barrian));
});

test('Sharafat 38: search filter — chips follow only the matching rows', () => {
  const state = monthlyFixture();
  const rows = buildMonthlyReport(state, { month: MONTH, statusFilter: 'all', customerQuery: 'Customer c4' }, REF);
  assert.deepEqual(rows.map((row) => row.customerId), ['c4']);
  const totals = calculateMethodTotalsForRows(rows, state);
  assert.equal(totals.JazzCash, 500);
  assert.equal(totals.Easypaisa, 0);
  assert.equal(totals.total, 500);
  assert.equal(chipsSum(totals), collectedSum(rows));
});

test('Sharafat 38: cross-month payment counts in the chips (bill-based, like Collected)', () => {
  const state = monthlyFixture();
  // The December-dated JazzCash 500 sits on the November bill: it counts in
  // November's Collected (recordedAmount) and must count in November's chips.
  const rows = buildMonthlyReport(state, { month: MONTH, statusFilter: 'all', customerQuery: 'Customer c4' }, REF);
  const totals = calculateMethodTotalsForRows(rows, state);
  assert.equal(totals.JazzCash, 500);
  assert.equal(totals.total, recordedAmount(state.customers[3].bills[0]));
  // The old whole-month helper keeps its payment-date contract: the same
  // December payment is NOT in November's unfiltered totals.
  const oldTotals = calculateMethodCollectionTotals(state, MONTH);
  assert.equal(oldTotals.JazzCash, 0);
  assert.equal(oldTotals.Easypaisa, 0);
  assert.equal(oldTotals.total, 3400);
});

test('Sharafat 38: dateless payment counts in the chips (the old helper skips it)', () => {
  // Fabricated rows, not buildMonthlyReport: buildMonthlyReport sorts each
  // bill's payments by date (calculatePaymentAllocations, core.js:3698) and
  // throws on a dateless payment — the pre-existing Sharafat 10 scope gap,
  // not this item. The rows helper itself takes the bill's payments as they
  // are, so it covers the dateless case the render path cannot reach today.
  const state = {
    customers: [
      customer('d1', { mohalla: 'Kishti' }, [
        bill({ month: MONTH, dueAmount: 1000, dueDate: '2026-11-05', payments: [
          { amount: 300, method: 'Easypaisa' },
          { date: '2026-11-06', amount: 100, method: 'Cash' },
        ] }),
      ]),
    ],
    expenses: [],
  };
  const totals = calculateMethodTotalsForRows([{ customerId: 'd1', month: MONTH }], state);
  assert.equal(totals.Easypaisa, 300);
  assert.equal(totals.Cash, 100);
  assert.equal(totals.total, 400);
  assert.equal(totals.total, recordedAmount(state.customers[0].bills[0]));
  // Why-comment, correcting the prep: the old helper's date guard only
  // excludes STRING dates in another month
  // (`typeof payment.date === 'string' && ... !== month`), so a dateless
  // payment was never skipped by it either — the gap shape (a) closes is
  // the cross-month DATED payment, locked by the previous test.
  const oldTotals = calculateMethodCollectionTotals(state, MONTH);
  assert.equal(oldTotals.Easypaisa, 300);
  assert.equal(oldTotals.Cash, 100);
  assert.equal(oldTotals.total, 400);
});

test('Sharafat 38: empty filter shows no chips (all buckets zero)', () => {
  const state = monthlyFixture();
  const empty = calculateMethodTotalsForRows([], state);
  assert.deepEqual([empty.total, empty.Cash, empty.JazzCash, empty.Easypaisa, empty.Raast, empty.Bank, empty.other], [0, 0, 0, 0, 0, 0, 0]);
  const noMatch = buildMonthlyReport(state, { month: MONTH, statusFilter: 'all', customerQuery: 'zzz-no-such-customer' }, REF);
  assert.equal(noMatch.length, 0);
  assert.equal(calculateMethodTotalsForRows(noMatch, state).total, 0);
  // A pending-only filter has no collections at all: chips are empty too,
  // exactly matching its Collected figure of 0.
  const pending = buildMonthlyReport(state, { month: MONTH, statusFilter: 'pending' }, REF);
  assert.deepEqual(pending.map((row) => row.customerId), ['c1', 'c5']);
  assert.equal(collectedSum(pending), 0);
  assert.equal(calculateMethodTotalsForRows(pending, state).total, 0);
});

test('Sharafat 38: voided payment on a filtered row is excluded from the chips', () => {
  const state = monthlyFixture();
  const rows = [{ customerId: 'c5', month: MONTH }];
  const totals = calculateMethodTotalsForRows(rows, state);
  assert.equal(totals.Cash, 0);
  assert.equal(totals.total, 0);
  assert.equal(totals.total, recordedAmount(state.customers[4].bills[0]));
});

test('Sharafat 38: row with no bill (not-set) and unknown customer sum 0, never crash', () => {
  const state = monthlyFixture();
  const totals = calculateMethodTotalsForRows([
    { customerId: 'c6', month: MONTH },
    { customerId: 'no-such-customer', month: MONTH },
    { customerId: 'c1', month: '1999-01' },
  ], state);
  assert.equal(totals.total, 0);
  assert.equal(calculateMethodTotalsForRows(null, state).total, 0);
  assert.equal(calculateMethodTotalsForRows(undefined, state).total, 0);
  assert.equal(calculateMethodTotalsForRows([{ customerId: 'c2', month: MONTH }], null).total, 0);
});

test('Sharafat 38: advance counts as cash in the month PAID (sisp61 semantics)', () => {
  const state = {
    customers: [
      customer('a1', { mohalla: 'Kishti' }, [
        bill({ month: '2026-10', dueAmount: 10000, dueDate: '2026-10-05', payments: [
          { date: '2026-10-29', amount: 8500, method: 'JazzCash', kind: 'advance', targetMonth: '2026-11' },
        ] }),
      ]),
    ],
    expenses: [],
  };
  const rows = buildMonthlyReport(state, { month: '2026-10', statusFilter: 'all' }, REF);
  assert.equal(rows.length, 1);
  assert.equal(collectedSum(rows), 8500);
  const totals = calculateMethodTotalsForRows(rows, state);
  assert.equal(totals.JazzCash, 8500);
  assert.equal(totals.total, 8500);
  assert.equal(chipsSum(totals), collectedSum(rows));
});

test('Sharafat 38: NayaPay lands in other, Bank Transfer lands in Bank (bucketing preserved)', () => {
  const state = monthlyFixture();
  const rows = [{ customerId: 'c7', month: MONTH }];
  const totals = calculateMethodTotalsForRows(rows, state);
  assert.equal(totals.other, 1200);
  assert.equal(totals.Bank, 800);
  assert.equal(totals.Cash, 0);
});

test('Sharafat 38: renderMonthlyReport wires the rows helper, not the whole-month helper', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('function renderMonthlyReport() {');
  const end = app.indexOf('function populateReportMonths()', start);
  assert.ok(start > 0 && end > start, 'renderMonthlyReport body must be extractable');
  const body = app.slice(start, end);
  assert.ok(body.includes('calculateMethodTotalsForRows(rows, state)'), 'renderMonthlyReport must derive chips from the filtered rows');
  assert.ok(!body.includes('calculateMethodCollectionTotals(state, month)'), 'renderMonthlyReport must no longer call the unfiltered whole-month helper');
  assert.ok(body.includes("t('bill_method_title')"), 'chip title must still render via t() inside renderMonthlyReport');
});
