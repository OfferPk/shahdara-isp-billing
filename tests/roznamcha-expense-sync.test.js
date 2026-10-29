// SISP-45: Roznamcha Petty Cash (SISP-11) ↔ Monthly Expenses Auto-Sync.
// Pure-function tests on synthetic data only. Spec test criterion:
// logging Rs. 600 petrol in roznamcha.js increases current month
// expenses by Rs. 600 and reduces each partner's 50% share by Rs. 300
// with zero duplicates on re-close.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROZNAMCHA_EXPENSE_CATEGORY_MAP,
  addRoznamchaOutflow,
  buildRoznamchaDay,
  closeRoznamchaDay,
  deleteRoznamchaOutflow,
  reopenRoznamchaDay,
  roznamchaExpenseCategory,
  syncRoznamchaExpenses,
  syncedRoznamchaExpenseId
} from '../roznamcha.js';
import { buildPartnerShareReport } from '../phase3.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';

const REF = new Date('2026-10-28T12:00:00Z');
const DAY = '2026-10-15';

function revenueState(expenses = []) {
  // October 2026 revenue Rs. 250,000 (same shape as partner-share.test.js).
  return {
    customers: [
      { id: 'c1', customerNumber: 1, name: 'Test Customer A', bills: [
        { month: '2026-10', payments: [
          { id: 'p1', date: '2026-10-05', amount: 120000, method: 'Cash' },
          { id: 'p2', date: '2026-10-20', amount: 80000, method: 'Cash' }
        ] }
      ] },
      { id: 'c2', customerNumber: 2, name: 'Test Customer B', bills: [
        { month: '2026-10', payments: [
          { id: 'p4', date: '2026-10-07', amount: 50000, method: 'Cash' }
        ] }
      ] }
    ],
    expenses
  };
}

function monthExpenses(expenses, month = '2026-10') {
  return (expenses || []).filter((e) => typeof e.date === 'string' && e.date.slice(0, 7) === month)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
}

test('spec criterion: Rs. 600 petrol in roznamcha → month expenses +600, each partner share −300', () => {
  const manual = [{ id: 'e1', date: '2026-10-03', amount: 15000, category: 'Salary — Saad', notes: '', area: '' }];
  const state = revenueState(manual);
  const before = buildPartnerShareReport(state, '2026-10', REF);
  assert.equal(before.summary.expenses, 15000);
  assert.equal(before.summary.share, 117500);

  const days = addRoznamchaOutflow([], DAY, { category: 'Petrol / Bike Fuel', amount: 600, lineman: 'Test Lineman', note: 'Bike petrol' });
  const outflow = days[0].outflows[0];
  const result = syncRoznamchaExpenses(state.expenses, days, REF);
  assert.equal(result.changed, true);
  assert.equal(result.added, 1);
  assert.equal(result.expenses.length, 2);

  const synced = result.expenses.find((e) => e.roznamchaEntryId === outflow.id);
  assert.ok(synced, 'a mirrored expense exists');
  assert.equal(synced.id, syncedRoznamchaExpenseId(outflow.id));
  assert.equal(synced.date, DAY);
  assert.equal(synced.amount, 600);
  assert.equal(synced.source, 'roznamcha');
  assert.equal(synced.roznamchaCategory, 'Petrol / Bike Fuel');
  assert.equal(synced.category, 'Other expenses');
  assert.match(synced.notes, /Petrol \/ Bike Fuel/);
  assert.match(synced.notes, /Test Lineman/);
  assert.match(synced.notes, /Bike petrol/);

  const after = buildPartnerShareReport({ ...state, expenses: result.expenses }, '2026-10', REF);
  assert.equal(after.summary.expenses, before.summary.expenses + 600);
  assert.equal(after.summary.share, before.summary.share - 300);
});

test('P&L analytics count a synced expense exactly once', () => {
  const days = addRoznamchaOutflow([], DAY, { category: 'Fiber Splicing', amount: 1250, lineman: 'Test Lineman', note: '' });
  const { expenses } = syncRoznamchaExpenses([], days, REF);
  const pnl = calculatePnlAnalytics(revenueState(expenses), { selectedMonth: '2026-10', referenceDate: REF });
  assert.equal(pnl.selectedMonthCategoryBreakdown.totalExpenses, 1250);
  const october = pnl.monthlyData.find((row) => row.month === '2026-10');
  assert.equal(october.expenses, 1250);
  assert.equal(october.expenseCount, 1);
  const categoryRow = pnl.selectedMonthCategoryBreakdown.categories.find((row) => row.category === 'Cable');
  assert.ok(categoryRow, 'splicing maps onto the Cable category in the P&L breakdown');
  assert.equal(categoryRow.amount, 1250);
  assert.equal(categoryRow.count, 1);
});

test('idempotent: a second sync pass changes nothing and returns the same array', () => {
  let days = addRoznamchaOutflow([], DAY, { category: 'Petrol / Bike Fuel', amount: 600, lineman: 'Test Lineman', note: '' });
  days = addRoznamchaOutflow(days, DAY, { category: 'Other', amount: 150, lineman: '', note: 'Tea' });
  const first = syncRoznamchaExpenses([], days, REF);
  assert.equal(first.added, 2);
  const second = syncRoznamchaExpenses(first.expenses, days, REF);
  assert.equal(second.changed, false);
  assert.equal(second.added + second.updated + second.removed, 0);
  assert.equal(second.expenses, first.expenses, 'unchanged pass returns the identical array');
});

test('zero duplicates on re-close: close, reopen, re-close keeps exactly one mirror', () => {
  const state = { customers: [] };
  let days = addRoznamchaOutflow([], DAY, { category: 'Petrol / Bike Fuel', amount: 600, lineman: 'Test Lineman', note: '' });
  const view = buildRoznamchaDay(state, days, DAY, []);
  days = closeRoznamchaDay(days, view, 0);
  const first = syncRoznamchaExpenses([], days, REF);
  assert.equal(first.expenses.length, 1);

  days = reopenRoznamchaDay(days, DAY);
  const second = syncRoznamchaExpenses(first.expenses, days, REF);
  assert.equal(second.changed, false);
  days = closeRoznamchaDay(days, buildRoznamchaDay(state, days, DAY, []), 0);
  const third = syncRoznamchaExpenses(second.expenses, days, REF);
  assert.equal(third.changed, false);
  assert.equal(third.expenses.filter((e) => e.roznamchaEntryId).length, 1);
});

test('deleting the outflow in roznamcha removes its mirror; manual expenses are untouched', () => {
  const manual = { id: 'e-manual', date: DAY, amount: 600, category: 'Other expenses', notes: 'Manual same-day same-amount entry', area: '' };
  let days = addRoznamchaOutflow([], DAY, { category: 'Petrol / Bike Fuel', amount: 600, lineman: 'Test Lineman', note: '' });
  const outflowId = days[0].outflows[0].id;
  const synced = syncRoznamchaExpenses([manual], days, REF);
  assert.equal(synced.expenses.length, 2);
  assert.equal(monthExpenses(synced.expenses), 1200);

  days = deleteRoznamchaOutflow(days, DAY, outflowId);
  const after = syncRoznamchaExpenses(synced.expenses, days, REF);
  assert.equal(after.removed, 1);
  assert.deepEqual(after.expenses, [manual], 'the manual row survives verbatim');
  assert.equal(monthExpenses(after.expenses), 600);
});

test('source of truth: a drifted mirror is restored to the roznamcha values', () => {
  const days = addRoznamchaOutflow([], DAY, { category: 'RJ45 / Patch Cord', amount: 450, lineman: 'Test Lineman', note: 'Patch cords' });
  const outflowId = days[0].outflows[0].id;
  const first = syncRoznamchaExpenses([], days, REF);
  const tampered = first.expenses.map((e) => ({ ...e, amount: 999, category: 'Tools', notes: 'hand-edited' }));
  const fixed = syncRoznamchaExpenses(tampered, days, REF);
  assert.equal(fixed.updated, 1);
  const row = fixed.expenses.find((e) => e.roznamchaEntryId === outflowId);
  assert.equal(row.amount, 450);
  assert.equal(row.category, 'Cable');
  assert.match(row.notes, /RJ45 \/ Patch Cord/);
  assert.equal(row.id, first.expenses[0].id, 'the mirror keeps its expense id');
});

test('duplicate mirrors for one outflow collapse back to exactly one row', () => {
  const days = addRoznamchaOutflow([], DAY, { category: 'Petrol / Bike Fuel', amount: 600, lineman: '', note: '' });
  const outflowId = days[0].outflows[0].id;
  const first = syncRoznamchaExpenses([], days, REF);
  const duplicated = [...first.expenses, { ...first.expenses[0], id: 'roz-dup-copy' }];
  const fixed = syncRoznamchaExpenses(duplicated, days, REF);
  assert.equal(fixed.removed, 1);
  assert.equal(fixed.expenses.filter((e) => e.roznamchaEntryId === outflowId).length, 1);
  assert.equal(monthExpenses(fixed.expenses), 600, 'the outflow is counted once, never twice');
});

test('category mapping: every roznamcha category maps onto a canonical expense category', () => {
  assert.deepEqual({ ...ROZNAMCHA_EXPENSE_CATEGORY_MAP }, {
    'Petrol / Bike Fuel': 'Other expenses',
    'RJ45 / Patch Cord': 'Cable',
    'Fiber Splicing': 'Cable',
    'Lineman Allowance': 'Other expenses',
    'Other': 'Other expenses'
  });
  assert.equal(roznamchaExpenseCategory('Something Unknown'), 'Other expenses');
  let days = [];
  for (const category of Object.keys(ROZNAMCHA_EXPENSE_CATEGORY_MAP)) {
    days = addRoznamchaOutflow(days, DAY, { category, amount: 100, lineman: 'Test Lineman', note: '' });
  }
  const { expenses, added } = syncRoznamchaExpenses([], days, REF);
  assert.equal(added, 5);
  for (const row of expenses) assert.equal(row.category, ROZNAMCHA_EXPENSE_CATEGORY_MAP[row.roznamchaCategory]);
});

test('entries that must not sync: invalid outflows and empty days create no expenses', () => {
  const rawDays = [{ date: DAY, closed: false, outflows: [
    { id: 'bad-amount', category: 'Petrol / Bike Fuel', amount: 0, lineman: '', note: '' },
    { id: 'bad-category', category: 'Not A Category', amount: 500, lineman: '', note: '' }
  ] }];
  const result = syncRoznamchaExpenses([], rawDays, REF);
  assert.equal(result.changed, false);
  assert.equal(result.expenses.length, 0);
  const empty = syncRoznamchaExpenses([], [], REF);
  assert.equal(empty.changed, false);
});

test('multiple days sync into their own months; totals stay per-month exact', () => {
  let days = addRoznamchaOutflow([], '2026-09-30', { category: 'Lineman Allowance', amount: 2000, lineman: 'Test Lineman', note: '' });
  days = addRoznamchaOutflow(days, DAY, { category: 'Petrol / Bike Fuel', amount: 600, lineman: 'Test Lineman', note: '' });
  const { expenses } = syncRoznamchaExpenses([], days, REF);
  assert.equal(expenses.length, 2);
  assert.equal(monthExpenses(expenses, '2026-09'), 2000);
  assert.equal(monthExpenses(expenses, '2026-10'), 600);
  const report = buildPartnerShareReport(revenueState(expenses), '2026-10', REF);
  assert.equal(report.summary.expenses, 600, 'the October share math sees only the October mirror');
});
