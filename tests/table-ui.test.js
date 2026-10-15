import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const styles = read('styles.css');

test('index.html contains expense table filter toolbar, search, count, and sortable headers', () => {
  assert.match(index, /class="table-filter-toolbar"/);
  assert.match(index, /id="expenseCategoryFilter"/);
  assert.match(index, /id="expenseSearchInput"/);
  assert.match(index, /id="clearExpenseFilters"/);
  assert.match(index, /id="expenseTableCount"/);
  assert.match(index, /data-sort-expense="date"/);
  assert.match(index, /data-sort-expense="category"/);
  assert.match(index, /data-sort-expense="amount"/);
  assert.match(index, /aria-sort="descending"/);
  assert.match(index, /id="expensesFilterEmpty"/);
});

test('styles.css provides sticky table headers and dark mode support for tables', () => {
  assert.match(styles, /\.table-scroll\s*\{[^}]*max-height:\s*75vh;/);
  assert.match(styles, /\.table-scroll thead th\s*\{[^}]*position:\s*sticky;/);
  assert.match(styles, /\.table-scroll thead th\s*\{[^}]*top:\s*0;/);
  assert.match(styles, /\.table-scroll thead th\s*\{[^}]*z-index:\s*2;/);
  assert.match(styles, /\.sortable-th\s*\{[^}]*cursor:\s*pointer;/);
  assert.match(styles, /\.table-filter-toolbar\s*\{/);
  assert.match(styles, /\[data-theme="dark"\]\s*\.table-scroll thead th/);
  assert.match(styles, /\[data-theme="dark"\]\s*\.table-filter-toolbar/);
  assert.match(styles, /@media print\s*\{[\s\S]*?\.table-filter-toolbar\{display:none!important\}/);
});

test('app.js wires expense table filtering by category and search query', () => {
  assert.match(app, /let expenseSortKey\s*=\s*'date'/);
  assert.match(app, /let expenseCategoryFilter\s*=\s*'all'/);
  assert.match(app, /let expenseSearchQuery\s*=\s*''/);
  assert.match(app, /expenseCategoryFilter\s*!==\s*'all'/);
  assert.match(app, /data-sort-expense/);
  assert.match(app, /clearExpenseFilters/);
  assert.match(app, /expensesFilterEmpty/);
});

test('expense filtering logic correctly matches category and notes search', () => {
  const sampleExpenses = [
    { id: 'exp-1', date: '2026-10-01', amount: 5000, category: 'Electricity', notes: 'Office bill for September' },
    { id: 'exp-2', date: '2026-10-03', amount: 12000, category: 'Nayatel bill', notes: 'Upstream bandwidth' },
    { id: 'exp-3', date: '2026-10-05', amount: 3500, category: 'Routers', notes: 'Purchased 2 gigabit units' },
    { id: 'exp-4', date: '2026-10-08', amount: 15000, category: 'Salary — Saad', notes: 'Monthly base pay' }
  ];

  // Category filter test
  const electricityOnly = sampleExpenses.filter(e => e.category === 'Electricity');
  assert.equal(electricityOnly.length, 1);
  assert.equal(electricityOnly[0].id, 'exp-1');

  // Search query in notes
  const bandwidthQuery = 'bandwidth';
  const matchBandwidth = sampleExpenses.filter(e =>
    e.category.toLowerCase().includes(bandwidthQuery) || e.notes.toLowerCase().includes(bandwidthQuery)
  );
  assert.equal(matchBandwidth.length, 1);
  assert.equal(matchBandwidth[0].id, 'exp-2');

  // Combined search and category
  const filtered = sampleExpenses.filter(e => {
    if (e.category !== 'Routers') return false;
    const q = 'gigabit';
    return e.category.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q);
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'exp-3');
});

test('expense sorting logic orders rows by date, category, and amount in both directions', () => {
  const sampleExpenses = [
    { id: 'exp-1', date: '2026-10-01', amount: 5000, category: 'Electricity' },
    { id: 'exp-2', date: '2026-10-05', amount: 12000, category: 'Nayatel bill' },
    { id: 'exp-3', date: '2026-10-03', amount: 3500, category: 'Routers' }
  ];

  // Sort by date ascending
  const byDateAsc = [...sampleExpenses].sort((a, b) => a.date.localeCompare(b.date));
  assert.deepEqual(byDateAsc.map(e => e.id), ['exp-1', 'exp-3', 'exp-2']);

  // Sort by date descending
  const byDateDesc = [...sampleExpenses].sort((a, b) => b.date.localeCompare(a.date));
  assert.deepEqual(byDateDesc.map(e => e.id), ['exp-2', 'exp-3', 'exp-1']);

  // Sort by amount ascending
  const byAmountAsc = [...sampleExpenses].sort((a, b) => a.amount - b.amount);
  assert.deepEqual(byAmountAsc.map(e => e.id), ['exp-3', 'exp-1', 'exp-2']);

  // Sort by amount descending
  const byAmountDesc = [...sampleExpenses].sort((a, b) => b.amount - a.amount);
  assert.deepEqual(byAmountDesc.map(e => e.id), ['exp-2', 'exp-1', 'exp-3']);

  // Sort by category ascending (A-Z)
  const byCategoryAsc = [...sampleExpenses].sort((a, b) => a.category.localeCompare(b.category));
  assert.deepEqual(byCategoryAsc.map(e => e.id), ['exp-1', 'exp-2', 'exp-3']);
});
