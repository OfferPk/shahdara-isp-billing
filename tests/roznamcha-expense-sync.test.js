// SISP-45: Roznamcha Petty Cash (SISP-11) ↔ Monthly Expenses Auto-Sync.
// Pure-function tests on synthetic data only. Spec test criterion:
// logging Rs. 600 petrol in roznamcha.js increases current month
// expenses by Rs. 600 and reduces each partner's 50% share by Rs. 300
// with zero duplicates on re-close.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROZNAMCHA_CATEGORIES,
  ROZNAMCHA_EXPENSE_CATEGORY_MAP,
  addRoznamchaOutflow,
  buildRoznamchaDay,
  closeRoznamchaDay,
  deleteRoznamchaOutflow,
  reopenRoznamchaDay,
  roznamchaExpenseCategory,
  roznamchaSourceDateForExpense,
  syncRoznamchaExpenses,
  syncedRoznamchaExpenseId
} from '../roznamcha.js';
import { buildPartnerShareReport } from '../phase3.js';
import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import {
  expenseSourceOf,
  filterExpenseRows,
  isDirectManualExpense,
  isRoznamchaMirrorExpense,
  isSaadMirrorExpense,
  listExpenseRoznamchaCategories
} from '../form-validation.js';
import { TRANSLATIONS } from '../nav-language.js';
import { readFileSync } from 'node:fs';

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

// ---------------------------------------------------------------------------
// SISP-182: Expenses source filter (All / Direct Manual / Roznamcha
// Mirrors) + roznamchaCategory sub-filter + badge jump to the source
// Roznamcha day. Synthetic data only.

const DAY_A = '2026-10-15';
const DAY_B = '2026-10-16';

// Two hand-entered rows, three roznamcha mirrors across two days (one
// whose canonical expense category differs from its petty-cash
// category), and one Saad Visit Log mirror (the third provenance
// class the Expenses UI already badges separately).
function mixedLedger() {
  const manual = [
    { id: 'e-man-1', date: '2026-10-03', amount: 15000, category: 'Salary — Saad', notes: 'October salary', area: '' },
    { id: 'e-man-2', date: '2026-10-05', amount: 2200, category: 'Cable', notes: 'Drop cable roll', area: '' }
  ];
  let days = addRoznamchaOutflow([], DAY_A, { category: 'Petrol / Bike Fuel', amount: 600, lineman: 'Test Lineman', note: 'Bike petrol' });
  days = addRoznamchaOutflow(days, DAY_A, { category: 'RJ45 / Patch Cord', amount: 350, lineman: '', note: 'Connectors' });
  days = addRoznamchaOutflow(days, DAY_B, { category: 'Petrol / Bike Fuel', amount: 450, lineman: 'Test Lineman', note: '' });
  const { expenses } = syncRoznamchaExpenses(manual, days, REF);
  const saadMirror = {
    id: 'saadexp-sp1', date: '2026-10-10', amount: 5000, category: 'Salary — Saad',
    notes: 'Saad Visit Log · Test payment', area: '',
    saadPaymentId: 'sp1', saadPaymentType: 'salary', source: 'saad-visits'
  };
  return { days, expenses: [...expenses, saadMirror] };
}

test('SISP-182: a mirror row date is its source roznamcha day', () => {
  const { days, expenses } = mixedLedger();
  const mirrors = expenses.filter(isRoznamchaMirrorExpense);
  assert.equal(mirrors.length, 3);
  for (const row of mirrors) {
    assert.equal(roznamchaSourceDateForExpense(days, row), row.date);
  }
  assert.deepEqual(mirrors.map((r) => r.date).sort(), [DAY_A, DAY_A, DAY_B]);
});

test('SISP-182: source filter partitions a mixed ledger exactly', () => {
  const { expenses } = mixedLedger();
  const ids = (rows) => rows.map((r) => r.id).sort();
  const all = filterExpenseRows(expenses, {});
  const manual = filterExpenseRows(expenses, { source: 'manual' });
  const roznamcha = filterExpenseRows(expenses, { source: 'roznamcha' });
  const saad = expenses.filter(isSaadMirrorExpense);
  assert.equal(all.length, 6);
  assert.deepEqual(ids(manual), ['e-man-1', 'e-man-2']);
  assert.deepEqual(ids(roznamcha), ids(expenses.filter(isRoznamchaMirrorExpense)));
  // Disjoint buckets; together with the Saad class they cover All.
  assert.equal(manual.some((r) => roznamcha.includes(r)), false);
  assert.deepEqual(ids([...manual, ...roznamcha, ...saad]), ids(all));
  // Provenance classes read the same fields the badges read.
  assert.equal(expenseSourceOf(manual[0]), 'manual');
  assert.equal(expenseSourceOf(roznamcha[0]), 'roznamcha');
  assert.equal(expenseSourceOf(saad[0]), 'saad');
  assert.equal(isDirectManualExpense(saad[0]), false, 'a Saad mirror is synced, not direct manual');
  assert.equal(isDirectManualExpense(manual[0]), true);
});

test('SISP-182: canonical category and roznamchaCategory stay distinct', () => {
  const { expenses } = mixedLedger();
  const petrol = expenses.filter((r) => r.roznamchaCategory === 'Petrol / Bike Fuel');
  assert.equal(petrol.length, 2);
  assert.ok(petrol.every((r) => r.category === 'Other expenses'), 'petrol mirrors carry the canonical Other expenses category');
  const rj45 = expenses.find((r) => r.roznamchaCategory === 'RJ45 / Patch Cord');
  assert.equal(rj45.category, 'Cable');
  // Canonical-category filter and petty-cash sub-filter compose.
  assert.deepEqual(filterExpenseRows(expenses, { category: 'Cable', roznamchaCategory: 'RJ45 / Patch Cord' }).map((r) => r.id), [rj45.id]);
  assert.equal(filterExpenseRows(expenses, { category: 'Other expenses', roznamchaCategory: 'Petrol / Bike Fuel' }).length, 2);
});

test('SISP-182: roznamchaCategory sub-filter excludes manual rows', () => {
  const { expenses } = mixedLedger();
  const petrolOnly = filterExpenseRows(expenses, { roznamchaCategory: 'Petrol / Bike Fuel' });
  assert.equal(petrolOnly.length, 2);
  assert.ok(petrolOnly.every(isRoznamchaMirrorExpense), 'manual rows carry no roznamchaCategory and never match');
  // A petty-cash sub-filter over the manual bucket is honestly empty.
  assert.equal(filterExpenseRows(expenses, { source: 'manual', roznamchaCategory: 'Petrol / Bike Fuel' }).length, 0);
});

test('SISP-182: sub-filter options derive from the mirrored rows present', () => {
  const { expenses } = mixedLedger();
  const categories = listExpenseRoznamchaCategories(expenses);
  assert.deepEqual(categories, ['Petrol / Bike Fuel', 'RJ45 / Patch Cord']);
  assert.ok(categories.every((c) => ROZNAMCHA_CATEGORIES.includes(c)), 'derived values stay inside the frozen petty-cash set');
  assert.deepEqual(listExpenseRoznamchaCategories(expenses.filter(isDirectManualExpense)), []);
  assert.deepEqual(listExpenseRoznamchaCategories([]), []);
});

test('SISP-182: badge jump resolves the source date by entry id', () => {
  const { days, expenses } = mixedLedger();
  const mirrorB = expenses.find((r) => isRoznamchaMirrorExpense(r) && r.date === DAY_B);
  // Even if a mirror's stamped date drifted, the ledger lookup by
  // roznamchaEntryId finds the true source day.
  const drifted = { ...mirrorB, date: '2026-10-01' };
  assert.equal(roznamchaSourceDateForExpense(days, drifted), DAY_B);
  // Without the day in the ledger, the stamped source date is the fallback.
  assert.equal(roznamchaSourceDateForExpense([], mirrorB), DAY_B);
  // Manual rows have no roznamcha day to jump to.
  const manual = expenses.find(isDirectManualExpense);
  assert.equal(roznamchaSourceDateForExpense(days, manual), null);
});

test('SISP-182: filtering is view-only — state and P&L are untouched', () => {
  const { expenses } = mixedLedger();
  const state = revenueState(expenses);
  const snapshot = JSON.stringify(state.expenses);
  const before = calculatePnlAnalytics(state, { selectedMonth: '2026-10', referenceDate: REF });
  filterExpenseRows(expenses, { source: 'roznamcha' });
  filterExpenseRows(expenses, { source: 'manual', roznamchaCategory: 'Petrol / Bike Fuel' });
  filterExpenseRows(expenses, { source: 'all', month: '2026-10', category: 'Cable', query: 'cable' });
  listExpenseRoznamchaCategories(expenses);
  assert.equal(JSON.stringify(state.expenses), snapshot, 'expense rows are byte-identical after filtering');
  const after = calculatePnlAnalytics(state, { selectedMonth: '2026-10', referenceDate: REF });
  assert.equal(after.selectedMonthCategoryBreakdown.totalExpenses, before.selectedMonthCategoryBreakdown.totalExpenses);
  assert.equal(after.monthlyData.find((r) => r.month === '2026-10').expenses, before.monthlyData.find((r) => r.month === '2026-10').expenses);
});

test('SISP-182: i18n keys exist in English and Urdu', () => {
  const keys = [
    'exp_source_filter_label',
    'exp_source_all',
    'exp_source_manual',
    'exp_source_roznamcha',
    'exp_roznamcha_category_all',
    'exp_roznamcha_category_label',
    'exp_roznamcha_jump_title'
  ];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  assert.ok(TRANSLATIONS.en.exp_roznamcha_jump_title.includes('{date}'));
  assert.ok(TRANSLATIONS.ur.exp_roznamcha_jump_title.includes('{date}'));
});

test('SISP-182: wiring — chips, sub-filter select and badge jump are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('data-expense-source="all"'), 'source chip: all');
  assert.ok(html.includes('data-expense-source="manual"'), 'source chip: manual');
  assert.ok(html.includes('data-expense-source="roznamcha"'), 'source chip: roznamcha');
  assert.ok(html.includes('id="expenseRoznamchaCategoryFilter"'), 'roznamcha category sub-filter select');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('data-roznamcha-jump'), 'badge renders as a jump button');
  assert.ok(app.includes('roznamchaSourceDateForExpense(loadRoznamchaDays(),row)'), 'jump resolves the date from the day ledger');
  assert.ok(app.includes('roznamchaModalController.open({ date }'), 'jump opens the Roznamcha modal on that date');
  assert.ok(app.includes("source: expenseSourceFilter"), 'render passes the source filter');
  assert.ok(app.includes("roznamchaCategory: expenseRoznamchaCategoryFilter"), 'render passes the sub-filter');
});
