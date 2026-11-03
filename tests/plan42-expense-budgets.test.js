/**
 * plan42-expense-budgets.test.js — Plan 42: expense category
 * budgets with a budget-versus-actual view.
 * Pins:
 * - one budget per (category, month); a budget with no category,
 *   a bad month, or a negative/non-finite amount is rejected,
 *   never stored half-formed; last budget wins per key;
 * - the view shows budget, actual, remaining, and variance per
 *   category matching the expense records on the same fixture;
 * - a category with no budget shows as unbudgeted with null
 *   budget/remaining/variance, never as a zero budget;
 * - changing a budget never rewrites a past expense (inputs are
 *   never mutated, and expense rows come back untouched);
 * - impossible dates (2026-02-30) and negative/non-finite amounts
 *   are excluded and counted, never totalled or zero-filled;
 * - budgets are targets only: the module holds no payment, bill,
 *   or customer field and never blocks anything.
 * Synthetic data only; no ledger figure is ever changed by this
 * plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidBudgetMonth,
  isValidBudgetDate,
  normalizeMonthBudget,
  normalizeMonthBudgets,
  findMonthBudget,
  upsertMonthBudget,
  removeMonthBudget,
  buildBudgetVersusActual,
  budgetVersusActualSummaryText,
  budgetVersusActualHtml,
  budgetVersusActualCsv,
  budgetVersusActualFilename,
} from '../expense-month-budgets.js';

const MONTH = '2026-11';

const expenses = [
  { date: '2026-11-03', amount: 45000, category: 'Nayatel bill' },
  { date: '2026-11-05', amount: 8000, category: 'Electricity' },
  { date: '2026-11-07', amount: 8000, category: 'Electricity' },
  { date: '2026-11-09', amount: 3000, category: 'Repairs' },
  { date: '2026-10-28', amount: 99999, category: 'Nayatel bill' },
];

const budgets = [
  { category: 'Nayatel bill', month: MONTH, amount: 40000 },
  { category: 'Electricity', month: MONTH, amount: 16000 },
  { category: 'Repairs', month: '2026-10', amount: 5000 },
];

test('month and date validation rejects bad months and impossible dates', () => {
  assert.equal(isValidBudgetMonth('2026-11'), true);
  assert.equal(isValidBudgetMonth('2026-13'), false);
  assert.equal(isValidBudgetMonth('2026-1'), false);
  assert.equal(isValidBudgetMonth(''), false);
  assert.notEqual(isValidBudgetDate('2026-11-03'), null);
  assert.equal(isValidBudgetDate('2026-02-30'), null);
  assert.equal(isValidBudgetDate('2026-13-01'), null);
  assert.equal(isValidBudgetDate('not-a-date'), null);
});

test('normalize rejects a half-formed budget and keeps a zero target', () => {
  assert.equal(normalizeMonthBudget({ category: '', month: MONTH, amount: 100 }), null);
  assert.equal(normalizeMonthBudget({ category: 'Rent', month: '2026-13', amount: 100 }), null);
  assert.equal(normalizeMonthBudget({ category: 'Rent', month: MONTH, amount: -50 }), null);
  assert.equal(normalizeMonthBudget({ category: 'Rent', month: MONTH, amount: 'abc' }), null);
  assert.deepEqual(
    normalizeMonthBudget({ category: '  Rent ', month: MONTH, amount: 0 }),
    { category: 'Rent', month: MONTH, amount: 0 },
  );
  assert.deepEqual(
    normalizeMonthBudget({ category: 'Rent', month: MONTH, amount: '12000' }),
    { category: 'Rent', month: MONTH, amount: 12000 },
  );
});

test('upsert is last-wins per key and remove drops only that key', () => {
  const next = upsertMonthBudget(budgets, { category: 'Nayatel bill', month: MONTH, amount: 50000 });
  assert.equal(findMonthBudget(next, 'Nayatel bill', MONTH).amount, 50000);
  assert.equal(next.length, budgets.length);
  const rejected = upsertMonthBudget(budgets, { category: '', month: MONTH, amount: 1 });
  assert.deepEqual(rejected, normalizeMonthBudgets(budgets));
  const removed = removeMonthBudget(next, 'Nayatel bill', MONTH);
  assert.equal(findMonthBudget(removed, 'Nayatel bill', MONTH), null);
  assert.equal(findMonthBudget(removed, 'Electricity', MONTH).amount, 16000);
  // The October budget for Repairs is a different key and survives.
  assert.equal(findMonthBudget(removed, 'Repairs', '2026-10').amount, 5000);
});

test('view matches the fixture: budget, actual, remaining, variance', () => {
  const view = buildBudgetVersusActual(budgets, expenses, MONTH);
  assert.equal(view.valid, true);
  const nayatel = view.rows.find((row) => row.category === 'Nayatel bill');
  assert.deepEqual(
    { budget: nayatel.budget, actual: nayatel.actual, remaining: nayatel.remaining, variance: nayatel.variance, status: nayatel.status },
    { budget: 40000, actual: 45000, remaining: -5000, variance: 5000, status: 'over' },
  );
  const electricity = view.rows.find((row) => row.category === 'Electricity');
  assert.deepEqual(
    { budget: electricity.budget, actual: electricity.actual, remaining: electricity.remaining, variance: electricity.variance, status: electricity.status },
    { budget: 16000, actual: 16000, remaining: 0, variance: 0, status: 'at' },
  );
  // The October expense never lands in the November view.
  assert.equal(nayatel.actual, 45000);
  // Over-budget rows sort first.
  assert.equal(view.rows[0].category, 'Nayatel bill');
  assert.equal(view.totals.budgetedCategories, 2);
  assert.equal(view.totals.overCategories, 1);
  assert.equal(view.totals.totalBudget, 56000);
  // Remaining covers budgeted rows only: (40000-45000) + (16000-16000).
  assert.equal(view.totals.totalRemaining, -5000);
  assert.equal(view.totals.totalVariance, 5000);
  assert.equal(view.totals.entries, 4);
  assert.equal(view.totals.excluded, 0);
});

test('a category with no budget shows as unbudgeted, never zero', () => {
  const view = buildBudgetVersusActual(budgets, expenses, MONTH);
  const repairs = view.rows.find((row) => row.category === 'Repairs');
  assert.deepEqual(
    { budget: repairs.budget, remaining: repairs.remaining, variance: repairs.variance, status: repairs.status, actual: repairs.actual },
    { budget: null, remaining: null, variance: null, status: 'unbudgeted', actual: 3000 },
  );
  assert.equal(view.totals.unbudgetedCategories, 1);
  // Totals still cover the budgeted rows only for budget figures.
  assert.equal(view.totals.totalBudget, 56000);
  assert.equal(view.totals.totalActual, 64000);
});

test('impossible dates and bad amounts are excluded and counted, never totalled', () => {
  const dirty = [
    ...expenses,
    { date: '2026-02-30', amount: 7000, category: 'Electricity' },
    { date: '2026-11-12', amount: -4000, category: 'Repairs' },
    { date: '2026-11-12', amount: 'nonsense', category: 'Repairs' },
    { date: '2026-11-12', amount: 1000, category: '' },
    null,
  ];
  const view = buildBudgetVersusActual(budgets, dirty, MONTH);
  assert.equal(view.totals.excluded, 4);
  assert.equal(view.rows.find((row) => row.category === 'Electricity').actual, 16000);
  assert.equal(view.rows.find((row) => row.category === 'Repairs').actual, 3000);
  // A blank category falls back to Other expenses, never dropped.
  const other = view.rows.find((row) => row.category === 'Other expenses');
  assert.equal(other.actual, 1000);
  assert.equal(other.status, 'unbudgeted');
});

test('changing a budget never rewrites a past expense and mutates no input', () => {
  const before = JSON.stringify(expenses);
  const beforeBudgets = JSON.stringify(budgets);
  const changed = upsertMonthBudget(budgets, { category: 'Nayatel bill', month: MONTH, amount: 90000 });
  const view = buildBudgetVersusActual(changed, expenses, MONTH);
  assert.equal(view.rows.find((row) => row.category === 'Nayatel bill').remaining, 45000);
  assert.equal(JSON.stringify(expenses), before);
  assert.equal(JSON.stringify(budgets), beforeBudgets);
  assert.equal(view.rows.find((row) => row.category === 'Nayatel bill').actual, 45000);
});

test('an invalid month yields an invalid view, never invented figures', () => {
  const view = buildBudgetVersusActual(budgets, expenses, '2026-13');
  assert.equal(view.valid, false);
  assert.deepEqual(view.rows, []);
  assert.equal(view.totals.totalBudget, null);
  assert.equal(budgetVersusActualSummaryText(view), 'Budget-versus-actual needs a valid month (YYYY-MM).');
});

test('a month with no budgets and no expenses is empty, not zero-filled', () => {
  const view = buildBudgetVersusActual(budgets, expenses, '2026-09');
  assert.equal(view.valid, true);
  assert.deepEqual(view.rows, []);
  assert.equal(view.totals.totalBudget, null);
  assert.equal(view.totals.totalActual, 0);
  assert.match(budgetVersusActualSummaryText(view), /No budgets and no recorded expenses/);
});

test('summary, HTML, CSV, and filename helpers stay honest', () => {
  const view = buildBudgetVersusActual(budgets, expenses, MONTH);
  const summary = budgetVersusActualSummaryText(view);
  assert.match(summary, /2026-11/);
  assert.match(summary, /Budget PKR 56,000/);
  assert.match(summary, /1 categor.? over budget/);
  const html = budgetVersusActualHtml(view);
  assert.match(html, /Nayatel bill/);
  assert.match(html, /Unbudgeted/);
  assert.doesNotMatch(html, /<script/i);
  const csv = budgetVersusActualCsv(view);
  assert.match(csv, /^month,category,budget,actual,remaining,variance,status,entries\n/);
  assert.match(csv, /2026-11,Nayatel bill,40000,45000,-5000,5000,over,1\n/);
  assert.match(csv, /2026-11,Repairs,,3000,,,unbudgeted,1\n/);
  assert.equal(budgetVersusActualFilename('2026-11'), 'expense-budgets-2026-11.csv');
  assert.equal(budgetVersusActualFilename('bogus'), 'expense-budgets-month.csv');
});

test('HTML escapes a hostile category name', () => {
  const view = buildBudgetVersusActual(
    [{ category: '<script>alert(1)</script>', month: MONTH, amount: 100 }],
    [],
    MONTH,
  );
  assert.doesNotMatch(budgetVersusActualHtml(view), /<script>alert/);
  assert.match(budgetVersusActualHtml(view), /&lt;script&gt;/);
});

test('float amounts sum exactly in cents', () => {
  const view = buildBudgetVersusActual(
    [],
    [
      { date: '2026-11-01', amount: 0.1, category: 'Tools' },
      { date: '2026-11-02', amount: 0.2, category: 'Tools' },
    ],
    MONTH,
  );
  assert.equal(view.rows[0].actual, 0.3);
});
