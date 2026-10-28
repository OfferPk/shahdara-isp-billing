import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import {
  HOME_BUDGET_CATEGORIES,
  HOME_BUDGET_KEY,
  addHomeBudgetExpense,
  deleteHomeBudgetExpense,
  filterHomeBudget,
  homeBudgetCategories,
  homeBudgetMonths,
  loadHomeBudgetExpenses,
  nextHomeBudgetId,
  sanitizeHomeBudget,
  saveHomeBudgetExpenses,
  sortHomeBudgetEntries,
  summarizeHomeBudget,
  updateHomeBudgetExpense,
} from '../home-budget.js';

// Home Budget: the owner's PERSONAL household ledger. It must stay fully
// apart from the business expense ledger: own storage key, own categories,
// and totals that never feed profit or partner shares. These tests cover
// the ledger logic, the monthly + all-time totals, custom categories, and
// the backup round-trip under the same safe-merge rules as complaints.

function entry(overrides) {
  return { id: 'HB-1', date: '2026-10-05', category: 'Balla shop', amount: 1500, notes: '', ...overrides };
}

test('default categories are the owner\'s eight examples', () => {
  assert.deepEqual(HOME_BUDGET_CATEGORIES, [
    'Balla shop',
    'Waseem shop',
    'Milk expense',
    'Electricity bill',
    'Plumber',
    'Electrician maintenance',
    'Wedding expense',
    'Death expense',
  ]);
});

test('adding entries assigns sequential ids and never mutates the input', () => {
  const before = [];
  const after = addHomeBudgetExpense(before, { date: '2026-10-05', category: 'Milk expense', amount: 1200, notes: 'daily' });
  assert.equal(after.length, 1);
  assert.equal(after[0].id, 'HB-1');
  assert.equal(after[0].amount, 1200);
  assert.deepEqual(before, []);
  const again = addHomeBudgetExpense(after, { date: '2026-10-06', category: 'Balla shop', amount: 500 });
  assert.equal(again[1].id, 'HB-2');
  assert.equal(nextHomeBudgetId(again), 'HB-3');
});

test('adding rejects a bad date, a non-positive amount, and a blank category', () => {
  assert.throws(() => addHomeBudgetExpense([], { date: '2026-13-40', category: 'Milk expense', amount: 100 }), /valid date/);
  assert.throws(() => addHomeBudgetExpense([], { date: '2026-10-05', category: 'Milk expense', amount: 0 }), /above zero/);
  assert.throws(() => addHomeBudgetExpense([], { date: '2026-10-05', category: 'Milk expense', amount: -50 }), /above zero/);
  assert.throws(() => addHomeBudgetExpense([], { date: '2026-10-05', category: '   ', amount: 100 }), /category/);
  assert.throws(() => addHomeBudgetExpense([], { date: '2026-02-30', category: 'Milk expense', amount: 100 }), /valid date/);
});

test('custom categories pass through and appear in the filter list', () => {
  const list = addHomeBudgetExpense([], { date: '2026-10-05', category: 'School fees', amount: 3000 });
  assert.equal(list[0].category, 'School fees');
  assert.deepEqual(homeBudgetCategories(list), ['School fees']);
  assert.deepEqual(homeBudgetCategories([entry({ category: 'Balla shop' }), entry({ id: 'HB-2', category: 'School fees' })]), ['Balla shop', 'School fees']);
});

test('update changes fields and keeps the id; delete removes; unknown ids throw', () => {
  const list = [entry(), entry({ id: 'HB-2', date: '2026-10-06', category: 'Plumber', amount: 800 })];
  const updated = updateHomeBudgetExpense(list, 'HB-2', { date: '2026-10-07', category: 'Plumber', amount: 900, notes: 'tap fixed' });
  assert.equal(updated[1].amount, 900);
  assert.equal(updated[1].date, '2026-10-07');
  assert.equal(updated[1].id, 'HB-2');
  assert.equal(updated[0].amount, 1500, 'other entries are untouched');
  assert.throws(() => updateHomeBudgetExpense(list, 'HB-9', { date: '2026-10-07', category: 'Plumber', amount: 900 }), /not found/);
  assert.deepEqual(deleteHomeBudgetExpense(list, 'HB-1').map(row => row.id), ['HB-2']);
  assert.throws(() => deleteHomeBudgetExpense(list, 'HB-9'), /not found/);
});

test('monthly totals and the all-time total add up across many months', () => {
  const list = [
    entry({ id: 'HB-1', date: '2026-10-05', amount: 1000 }),
    entry({ id: 'HB-2', date: '2026-10-20', category: 'Milk expense', amount: 500 }),
    entry({ id: 'HB-3', date: '2026-09-12', category: 'Electricity bill', amount: 2000 }),
    entry({ id: 'HB-4', date: '2026-08-01', category: 'Wedding expense', amount: 25000 }),
  ];
  const summary = summarizeHomeBudget(list);
  assert.equal(summary.count, 4);
  assert.equal(summary.allTimeTotal, 28500);
  assert.deepEqual(summary.months, [
    { month: '2026-10', total: 1500, count: 2 },
    { month: '2026-09', total: 2000, count: 1 },
    { month: '2026-08', total: 25000, count: 1 },
  ]);
  assert.equal(summary.categories.find(row => row.category === 'Wedding expense').total, 25000);
});

test('totals are exact to the paisa (no float drift)', () => {
  const list = [
    entry({ id: 'HB-1', amount: 0.1 }),
    entry({ id: 'HB-2', amount: 0.2 }),
  ];
  assert.equal(summarizeHomeBudget(list).allTimeTotal, 0.3);
});

test('filtering by month, category, and search never changes the all-time total', () => {
  const list = [
    entry({ id: 'HB-1', date: '2026-10-05', category: 'Balla shop', amount: 1000, notes: 'groceries' }),
    entry({ id: 'HB-2', date: '2026-09-12', category: 'Milk expense', amount: 500, notes: '' }),
  ];
  assert.equal(filterHomeBudget(list, { month: '2026-10' }).length, 1);
  assert.equal(filterHomeBudget(list, { category: 'Milk expense' }).length, 1);
  assert.equal(filterHomeBudget(list, { query: 'grocer' }).length, 1);
  assert.equal(filterHomeBudget(list, { query: 'GROCER' }).length, 1, 'search is case-insensitive');
  assert.equal(filterHomeBudget(list, { month: '2026-10', category: 'Milk expense' }).length, 0);
  assert.equal(filterHomeBudget(list, {}).length, 2);
  assert.equal(summarizeHomeBudget(list).allTimeTotal, 1500, 'all-time total ignores filters');
  assert.deepEqual(homeBudgetMonths(list), ['2026-10', '2026-09']);
  assert.deepEqual(sortHomeBudgetEntries([list[1], list[0]]).map(row => row.id), ['HB-1', 'HB-2']);
});

test('sanitize drops malformed entries and duplicate ids, keeps custom categories', () => {
  const cleaned = sanitizeHomeBudget([
    entry(),
    entry({ id: 'HB-1', date: '2026-10-06' }),
    entry({ id: 'HB-2', date: 'not-a-date' }),
    entry({ id: 'HB-3', amount: 0 }),
    entry({ id: 'HB-4', category: '' }),
    entry({ id: 'HB-5', category: 'School fees', amount: 3000 }),
    null,
    'junk',
  ]);
  assert.deepEqual(cleaned.map(row => row.id), ['HB-1', 'HB-5']);
  assert.equal(cleaned[1].category, 'School fees');
  assert.deepEqual(sanitizeHomeBudget('not a list'), []);
});

test('storage uses its own key: business state and home entries never mix', () => {
  const store = new Map();
  const storage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, value); },
  };
  storage.setItem('shahdara-isp-billing-v1', JSON.stringify({ version: 1, expenses: [{ id: 'E-1', amount: 999 }] }));
  assert.deepEqual(loadHomeBudgetExpenses(storage), [], 'business key is not read as home entries');
  saveHomeBudgetExpenses([entry()], storage);
  assert.equal(store.get(HOME_BUDGET_KEY), JSON.stringify([entry()]));
  assert.equal(JSON.parse(store.get('shahdara-isp-billing-v1')).expenses.length, 1, 'business state untouched by home save');
  assert.deepEqual(loadHomeBudgetExpenses(storage), [entry()]);
  assert.deepEqual(loadHomeBudgetExpenses({ getItem: () => '{bad json' }), [], 'corrupt home storage reads as empty, never throws');
});

test('backup round-trip: home entries travel in settings.homeBudget under safe-merge rules', () => {
  const state = createInitialState();
  const home = [entry()];
  const when = new Date('2026-10-28T12:00:00');
  const backup = createJsonBackup(state, when, { homeBudget: home });
  const document = JSON.parse(backup);
  assert.equal(document.settings.homeBudget.length, 1);
  assert.equal(document.settings.homeBudget[0].id, 'HB-1');
  // Device with no home entries adopts the backup's records.
  const preview = previewJsonBackupMerge(state, backup, { currentHomeBudget: [], currentHomeBudgetStored: false });
  assert.equal(preview.homeBudget.length, 1);
  assert.equal(preview.counts.homeBudgetRestored, 1);
  // Device with different records keeps its own + reports a conflict.
  const different = [entry({ id: 'HB-900' })];
  const conflict = previewJsonBackupMerge(state, backup, { currentHomeBudget: different, currentHomeBudgetStored: true });
  assert.equal(conflict.homeBudget, null);
  assert.ok(conflict.conflicts.some(c => /Home budget/.test(c.field)));
  // No homeBudget section when the ledger is empty.
  const empty = JSON.parse(createJsonBackup(state, when, { homeBudget: [] }));
  assert.equal(empty.settings?.homeBudget, undefined);
  // And home entries never land in the business expense list.
  assert.deepEqual(state.expenses, [], 'business expenses untouched by home backup');
});
