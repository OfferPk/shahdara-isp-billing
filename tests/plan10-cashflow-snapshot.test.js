import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SNAPSHOT_STATUSES,
  isValidSnapshotMonth,
  isValidSnapshotDate,
  snapshotMonthLabel,
  monthRange,
  daysElapsedInMonth,
  buildCashflowSnapshot,
  cashflowSnapshotSummary,
  cashflowSnapshotFilename,
  cashflowSnapshotHtml,
  cashflowSnapshotCsv,
} from '../cashflow-snapshot.js';

const MONTH = '2026-11'; // 30 days
const AS_OF = '2026-11-10'; // 10 days elapsed

const snapshotInput = (overrides = {}) => ({
  month: MONTH,
  asOfDate: AS_OF,
  collected: { amount: 30000, count: 12, sourceScreen: 'Analytics cash collection' },
  expenses: {
    amount: 12000, count: 3, sourceScreen: 'Expenses register',
    items: [
      { amount: 5000, category: 'Fuel' },
      { amount: 4000, category: 'Salaries' },
      { amount: 3000, category: 'Fuel' },
    ],
  },
  ...overrides,
});

// ---- month and date validation ----

test('valid months pass and impossible months fail', () => {
  assert.equal(isValidSnapshotMonth('2026-11'), true);
  assert.equal(isValidSnapshotMonth('2024-02'), true);
  assert.equal(isValidSnapshotMonth('2026-13'), false);
  assert.equal(isValidSnapshotMonth('2026-00'), false);
  assert.equal(isValidSnapshotMonth('2026-1'), false);
  assert.equal(isValidSnapshotMonth('2026-11-03'), false);
  assert.equal(isValidSnapshotMonth(''), false);
  assert.equal(isValidSnapshotMonth(null), false);
});

test('valid dates pass and impossible dates fail, leap-aware', () => {
  assert.equal(isValidSnapshotDate('2026-11-03'), true);
  assert.equal(isValidSnapshotDate('2024-02-29'), true);
  assert.equal(isValidSnapshotDate('2026-02-29'), false);
  assert.equal(isValidSnapshotDate('2026-11-32'), false);
  assert.equal(isValidSnapshotDate('03-11-2026'), false);
  assert.equal(isValidSnapshotDate(''), false);
  assert.equal(isValidSnapshotDate(null), false);
});

test('month labels name the month and year', () => {
  assert.equal(snapshotMonthLabel('2026-11'), 'November 2026');
  assert.equal(snapshotMonthLabel('2024-02'), 'February 2024');
  assert.equal(snapshotMonthLabel('2026-13'), '');
});

test('month ranges cover the whole calendar month, leap-aware', () => {
  assert.deepEqual(monthRange('2026-11'), { valid: true, startDate: '2026-11-01', endDate: '2026-11-30', daysInMonth: 30 });
  assert.deepEqual(monthRange('2024-02'), { valid: true, startDate: '2024-02-01', endDate: '2024-02-29', daysInMonth: 29 });
  assert.deepEqual(monthRange('2026-02'), { valid: true, startDate: '2026-02-01', endDate: '2026-02-28', daysInMonth: 28 });
  assert.deepEqual(monthRange('2026-13'), { valid: false, startDate: '', endDate: '', daysInMonth: 0 });
});

test('days elapsed clamps to the month', () => {
  assert.equal(daysElapsedInMonth('2026-11', '2026-11-10'), 10);
  assert.equal(daysElapsedInMonth('2026-11', '2026-11-01'), 1);
  assert.equal(daysElapsedInMonth('2026-11', '2026-11-30'), 30);
  assert.equal(daysElapsedInMonth('2026-11', '2026-10-31'), 0);
  assert.equal(daysElapsedInMonth('2026-11', '2026-12-05'), 30);
  assert.equal(daysElapsedInMonth('2026-13', '2026-11-10'), 0);
  assert.equal(daysElapsedInMonth('2026-11', 'not-a-date'), 0);
});

// ---- snapshot figures and projection ----

test('collected and expense figures carry through verbatim with sources', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput());
  assert.equal(snapshot.valid, true);
  assert.equal(snapshot.month, MONTH);
  assert.equal(snapshot.monthLabel, 'November 2026');
  assert.equal(snapshot.collected.amount, 30000);
  assert.equal(snapshot.collected.count, 12);
  assert.equal(snapshot.collected.sourceScreen, 'Analytics cash collection');
  assert.equal(snapshot.expenses.amount, 12000);
  assert.equal(snapshot.expenses.count, 3);
  assert.equal(snapshot.expenses.sourceScreen, 'Expenses register');
  assert.deepEqual(snapshot.sources, ['Analytics cash collection', 'Expenses register']);
});

test('net is collected minus expenses, surplus status', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput());
  assert.equal(snapshot.net, 18000);
  assert.equal(snapshot.status, SNAPSHOT_STATUSES.SURPLUS);
  assert.equal(snapshot.statusLabel, 'Surplus');
});

test('deficit, break-even, and no-activity statuses', () => {
  assert.equal(buildCashflowSnapshot(snapshotInput({ collected: { amount: 5000, count: 2 } })).status, SNAPSHOT_STATUSES.DEFICIT);
  assert.equal(buildCashflowSnapshot(snapshotInput({ collected: { amount: 12000, count: 4 } })).status, SNAPSHOT_STATUSES.BREAK_EVEN);
  const empty = buildCashflowSnapshot(snapshotInput({
    collected: { amount: 0, count: 0 },
    expenses: { amount: 0, count: 0, items: [] },
  }));
  assert.equal(empty.net, 0);
  assert.equal(empty.status, SNAPSHOT_STATUSES.NO_ACTIVITY);
});

test('partial-month projection uses the run rate over the whole month', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput());
  assert.equal(snapshot.daysInMonth, 30);
  assert.equal(snapshot.daysElapsed, 10);
  assert.equal(snapshot.collectedRunRate, 3000);
  assert.equal(snapshot.expensesRunRate, 1200);
  assert.equal(snapshot.projectedCollected, 90000);
  assert.equal(snapshot.projectedExpenses, 36000);
  assert.equal(snapshot.projectedNet, 54000);
});

test('projection basis states days elapsed and both daily rates in plain words', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput());
  assert.match(snapshot.projectionBasis, /10 of 30 days/);
  assert.match(snapshot.projectionBasis, /November 2026/);
  assert.match(snapshot.projectionBasis, /Rs\. 3,000\/day/);
  assert.match(snapshot.projectionBasis, /Rs\. 1,200\/day/);
  assert.match(snapshot.projectionBasis, /run-rate estimate, not a promise/);
});

test('complete month projects the actual figures', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({ asOfDate: '2026-11-30' }));
  assert.equal(snapshot.daysElapsed, 30);
  assert.equal(snapshot.projectedCollected, 30000);
  assert.equal(snapshot.projectedExpenses, 12000);
  assert.equal(snapshot.projectedNet, 18000);
  assert.match(snapshot.projectionBasis, /Month complete/);
});

test('as-of date past month-end also counts the month complete', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({ asOfDate: '2026-12-05' }));
  assert.equal(snapshot.daysElapsed, 30);
  assert.equal(snapshot.projectedNet, 18000);
});

test('zero days elapsed gives no projection instead of an invented one', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({ asOfDate: '2026-10-31' }));
  assert.equal(snapshot.daysElapsed, 0);
  assert.equal(snapshot.projectedCollected, null);
  assert.equal(snapshot.projectedExpenses, null);
  assert.equal(snapshot.projectedNet, null);
  assert.match(snapshot.projectionBasis, /No days.*have elapsed yet/);
  assert.match(snapshot.projectionBasis, /no run rate/);
});

test('invalid month or as-of date yields an invalid snapshot', () => {
  assert.equal(buildCashflowSnapshot(snapshotInput({ month: '2026-13' })).valid, false);
  assert.equal(buildCashflowSnapshot(snapshotInput({ asOfDate: '2026-02-30' })).valid, false);
  assert.equal(buildCashflowSnapshot({}).valid, false);
});

test('non-numeric amounts normalise to zero, never NaN', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({
    collected: { amount: 'oops', count: -3 },
    expenses: { amount: undefined, count: NaN, items: [] },
  }));
  assert.equal(snapshot.valid, true);
  assert.equal(snapshot.collected.amount, 0);
  assert.equal(snapshot.collected.count, 0);
  assert.equal(snapshot.expenses.amount, 0);
  assert.equal(snapshot.net, 0);
});

// ---- expense items, categories, consistency ----

test('expense categories aggregate and sort largest first with shares', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput());
  assert.deepEqual(
    snapshot.expenseCategories.map(({ category, amount, count }) => ({ category, amount, count })),
    [
      { category: 'Fuel', amount: 8000, count: 2 },
      { category: 'Salaries', amount: 4000, count: 1 },
    ],
  );
  assert.equal(snapshot.expenseCategories[0].sharePercent, 66.7);
  assert.equal(snapshot.expenseCategories[1].sharePercent, 33.3);
});

test('blank expense category groups under Uncategorised', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({
    expenses: { amount: 1000, count: 1, items: [{ amount: 1000, category: '  ' }] },
  }));
  assert.equal(snapshot.expenseCategories[0].category, 'Uncategorised');
});

test('item-list mismatch is flagged, never silently fixed', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({
    expenses: { amount: 12000, count: 3, items: [{ amount: 9000, category: 'Fuel' }] },
  }));
  assert.equal(snapshot.expensesConsistent, false);
  assert.equal(snapshot.expenses.itemsTotal, 9000);
  assert.equal(snapshot.expenses.amount, 12000);
  assert.match(cashflowSnapshotHtml(snapshot), /differs from the stated expense total/);
});

test('no item list means nothing to check: consistent', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({
    expenses: { amount: 12000, count: 3 },
  }));
  assert.equal(snapshot.expensesConsistent, true);
  assert.deepEqual(snapshot.expenseCategories, []);
});

test('snapshot does not mutate its input', () => {
  const input = snapshotInput();
  const before = JSON.stringify(input);
  buildCashflowSnapshot(input);
  assert.equal(JSON.stringify(input), before);
});

// ---- summary, filename, HTML, CSV ----

test('summary carries headline figures and projected net', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput());
  assert.equal(
    cashflowSnapshotSummary(snapshot),
    'November 2026: collected Rs. 30,000, expenses Rs. 12,000, net Rs. 18,000 (surplus), projected month-end net Rs. 54,000.',
  );
  assert.equal(cashflowSnapshotSummary({ valid: false }), '');
});

test('summary with no projection says so', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({ asOfDate: '2026-10-31' }));
  assert.match(cashflowSnapshotSummary(snapshot), /no projection yet/);
});

test('filename is month-specific; invalid snapshot gets a generic name', () => {
  assert.equal(cashflowSnapshotFilename(buildCashflowSnapshot(snapshotInput())), 'cashflow-snapshot-2026-11.csv');
  assert.equal(cashflowSnapshotFilename({ valid: false }), 'cashflow-snapshot.csv');
});

test('HTML shows figures, basis, categories, and escapes hostile text', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({
    expenses: {
      amount: 12000, count: 1, sourceScreen: 'Expenses register',
      items: [{ amount: 12000, category: '<script>alert(1)</script>' }],
    },
  }));
  const html = cashflowSnapshotHtml(snapshot);
  assert.match(html, /November 2026 cash-flow snapshot/);
  assert.match(html, /Rs\. 30,000/);
  assert.match(html, /Rs\. 18,000/);
  assert.match(html, /Rs\. 54,000/);
  assert.match(html, /10 of 30 days/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(cashflowSnapshotHtml({ valid: false }), '<p class="empty-state">Cash-flow snapshot unavailable.</p>');
});

test('HTML with no expense items says so instead of an empty table', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({
    expenses: { amount: 0, count: 0 },
  }));
  assert.match(cashflowSnapshotHtml(snapshot), /No expense items listed/);
});

test('CSV has headline rows, basis, and one row per category, escaped', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput());
  const csv = cashflowSnapshotCsv(snapshot);
  assert.match(csv, /^figure,amount,detail,source\n/);
  assert.match(csv, /Collected,30000,12 receipts,Analytics cash collection/);
  assert.match(csv, /Expenses,12000,3 entries,Expenses register/);
  assert.match(csv, /Net,18000,Surplus,Collected minus expenses/);
  assert.match(csv, /Projected month-end net,54000/);
  assert.match(csv, /Projection basis,,"Projection: 10 of 30 days/);
  assert.match(csv, /Fuel,8000,2,66\.7%/);
  assert.match(csv, /Salaries,4000,1,33\.3%/);
  assert.equal(cashflowSnapshotCsv({ valid: false }), '');
});

test('CSV quotes a category containing a comma', () => {
  const snapshot = buildCashflowSnapshot(snapshotInput({
    expenses: { amount: 1000, count: 1, items: [{ amount: 1000, category: 'Fuel, diesel' }] },
  }));
  assert.match(cashflowSnapshotCsv(snapshot), /"Fuel, diesel",1000,1,100%/);
});
