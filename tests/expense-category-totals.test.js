import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExpenseCategoryTotals
} from '../form-validation.js';

const mockExpenses = [
  { id: 'exp-1', date: '2026-10-05', category: 'Electricity', amount: 8500 },
  { id: 'exp-2', date: '2026-10-12', category: 'Repairs', amount: 1200 },
  { id: 'exp-3', date: '2026-09-28', category: 'Nayatel bill', amount: 45000 },
  { id: 'exp-4', date: '2026-10-15', category: 'Salary — Saad', amount: 15400 },
  { id: 'exp-5', date: '2026-10-02', category: 'Tools', amount: 3500 },
  { id: 'exp-6', date: '2026-10-20', category: 'Electricity', amount: 1500 }
];

test('buildExpenseCategoryTotals: groups, counts and sums per category', () => {
  const totals = buildExpenseCategoryTotals(mockExpenses);
  const byCategory = Object.fromEntries(totals.map(entry => [entry.category, entry]));
  assert.equal(byCategory['Electricity'].count, 2);
  assert.equal(byCategory['Electricity'].total, 10000);
  assert.equal(byCategory['Nayatel bill'].count, 1);
  assert.equal(byCategory['Nayatel bill'].total, 45000);
  assert.equal(byCategory['Tools'].total, 3500);
  assert.equal(totals.length, 5);
});

test('buildExpenseCategoryTotals: sorts by total descending, ties by category name', () => {
  const totals = buildExpenseCategoryTotals(mockExpenses);
  assert.deepEqual(
    totals.map(entry => entry.category),
    ['Nayatel bill', 'Salary — Saad', 'Electricity', 'Tools', 'Repairs']
  );
  const tied = buildExpenseCategoryTotals([
    { id: 'a', date: '2026-10-01', category: 'Repairs', amount: 500 },
    { id: 'b', date: '2026-10-02', category: 'Cable', amount: 500 }
  ]);
  assert.deepEqual(tied.map(entry => entry.category), ['Cable', 'Repairs']);
});

test('buildExpenseCategoryTotals: hand-computed filtered subset (October only)', () => {
  const october = mockExpenses.filter(row => row.date.startsWith('2026-10'));
  const totals = buildExpenseCategoryTotals(october);
  const grand = totals.reduce((sum, entry) => sum + entry.total, 0);
  // 8500 + 1200 + 15400 + 3500 + 1500 = 30100
  assert.equal(grand, 30100);
  assert.equal(totals.find(entry => entry.category === 'Nayatel bill'), undefined);
});

test('buildExpenseCategoryTotals: empty input, missing category, non-numeric amount', () => {
  assert.deepEqual(buildExpenseCategoryTotals([]), []);
  assert.deepEqual(buildExpenseCategoryTotals(), []);
  const totals = buildExpenseCategoryTotals([
    { id: 'a', date: '2026-10-01', amount: 700 },
    { id: 'b', date: '2026-10-02', category: 'Tools', amount: 'not-a-number' },
    { id: 'c', date: '2026-10-03', category: 'Tools', amount: 100.5 },
    { id: 'd', date: '2026-10-04', category: 'Tools', amount: 200.25 }
  ]);
  const unrecorded = totals.find(entry => entry.category === 'Not recorded');
  assert.equal(unrecorded.count, 1);
  assert.equal(unrecorded.total, 700);
  const tools = totals.find(entry => entry.category === 'Tools');
  assert.equal(tools.count, 3);
  assert.equal(tools.total, 300.75);
});
