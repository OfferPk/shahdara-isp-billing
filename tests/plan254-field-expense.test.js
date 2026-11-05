// Plan 254 — Field expense note per visit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validFieldExpenseDate,
  normalizeFieldExpenseList,
  recordFieldExpense,
  removeFieldExpense,
  findFieldExpense,
  addFieldExpenseFollowup,
  fieldExpenseSorted,
  fieldExpensesForVisit,
  fieldExpenseVisits,
  fieldExpenseTotalForVisit,
  fieldExpensesForMonth,
  fieldExpenseTotalForMonth,
  fieldExpenseMonthTotals,
  fieldExpenseSummaryText,
  fieldExpenseText,
  fieldExpenseHtml,
  fieldExpenseCsv,
  fieldExpenseFilename,
} from '../field-expense.js';

const first = {
  id: 'FE-1',
  visitRef: 'VISIT-101',
  expense: 'Rickshaw fare',
  amount: 250,
  date: '2026-11-01',
  paidBy: 'Saad',
};

const second = {
  id: 'FE-2',
  visitRef: 'VISIT-101',
  expense: 'Meal on long day',
  amount: '150',
  date: '2026-11-02',
  paidBy: 'Saad',
};

const third = {
  id: 'FE-3',
  visitRef: 'VISIT-102',
  expense: 'Rickshaw fare',
  amount: 300.5,
  date: '2026-11-15',
  paidBy: 'Owner',
};

const fourth = {
  id: 'FE-4',
  visitRef: 'visit-101',
  expense: 'Water bottle',
  amount: 50,
  date: '2026-12-01',
  paidBy: 'Saad',
};

const all = [first, second, third, fourth];

test('half-formed expense note is refused', () => {
  const base = { ...first };
  for (const field of ['id', 'visitRef', 'expense', 'date', 'paidBy']) {
    assert.deepEqual(recordFieldExpense([], { ...base, [field]: '  ' }), []);
  }
  for (const bad of [0, -20, NaN, 'not a number', '', undefined]) {
    assert.deepEqual(recordFieldExpense([], { ...base, amount: bad }), []);
  }
});

test('strict dates: leap years and month lengths', () => {
  assert.equal(validFieldExpenseDate('2024-02-29'), true);
  assert.equal(validFieldExpenseDate('2025-02-29'), false);
  assert.equal(validFieldExpenseDate('2026-04-31'), false);
  assert.equal(validFieldExpenseDate('2026-11-30'), true);
  assert.equal(validFieldExpenseDate('2026-13-01'), false);
  assert.equal(validFieldExpenseDate('2026-1-1'), false);
  assert.equal(validFieldExpenseDate('01-11-2026'), false);
  assert.equal(validFieldExpenseDate(20261101), false);
  assert.deepEqual(recordFieldExpense([], { ...first, date: '2025-02-29' }), []);
});

test('amount is kept exactly as entered', () => {
  assert.equal(findFieldExpense(recordFieldExpense([], second), 'FE-2').amount, 150);
  assert.equal(findFieldExpense(recordFieldExpense([], third), 'FE-3').amount, 300.5);
  assert.equal(findFieldExpense(recordFieldExpense([], first), 'FE-1').amount, 250);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, surprise: 'x', billTotal: 9999, pettyCashTotal: 5000 };
  const frozen = JSON.parse(JSON.stringify(raw));
  const recorded = recordFieldExpense([], raw);
  assert.deepEqual(Object.keys(recorded[0]).sort(), ['amount', 'date', 'expense', 'followups', 'id', 'paidBy', 'visitRef']);
  assert.deepEqual(raw, frozen);
  const list = [{ ...first, extra: true }];
  const snapshot = JSON.parse(JSON.stringify(list));
  normalizeFieldExpenseList(list);
  assert.deepEqual(list, snapshot);
});

test('duplicate ids are never rewritten', () => {
  const once = recordFieldExpense([], first);
  const twice = recordFieldExpense(once, { ...first, expense: 'Different expense', amount: 999 });
  assert.equal(twice.length, 1);
  assert.equal(twice[0].expense, 'Rickshaw fare');
  assert.equal(twice[0].amount, 250);
});

test('find and remove', () => {
  assert.equal(findFieldExpense(all, 'FE-2').expense, 'Meal on long day');
  assert.equal(findFieldExpense(all, 'FE-9'), null);
  assert.equal(findFieldExpense(all, '  '), null);
  assert.equal(removeFieldExpense(all, 'FE-2').length, 3);
  assert.equal(removeFieldExpense(all, 'FE-9').length, 4);
  assert.equal(removeFieldExpense(all, '').length, 4);
});

test('sorting is by date, then visit, then id', () => {
  const shuffled = [fourth, third, second, first];
  assert.deepEqual(fieldExpenseSorted(shuffled).map((item) => item.id), ['FE-1', 'FE-2', 'FE-3', 'FE-4']);
});

test('expenses list by visit, case-insensitively', () => {
  assert.deepEqual(fieldExpensesForVisit(all, 'VISIT-101').map((item) => item.id), ['FE-1', 'FE-2', 'FE-4']);
  assert.deepEqual(fieldExpensesForVisit(all, 'visit-102').map((item) => item.id), ['FE-3']);
  assert.deepEqual(fieldExpensesForVisit(all, 'VISIT-999'), []);
  assert.deepEqual(fieldExpensesForVisit(all, ''), []);
});

test('visit list keeps the first spelling', () => {
  assert.deepEqual(fieldExpenseVisits(all), ['VISIT-101', 'VISIT-102']);
});

test('total per visit matches the notes listed', () => {
  const rows = fieldExpensesForVisit(all, 'VISIT-101');
  const listed = rows.reduce((sum, item) => sum + item.amount, 0);
  assert.equal(fieldExpenseTotalForVisit(all, 'VISIT-101'), listed);
  assert.equal(fieldExpenseTotalForVisit(all, 'VISIT-101'), 450);
  assert.equal(fieldExpenseTotalForVisit(all, 'VISIT-102'), 300.5);
  assert.equal(fieldExpenseTotalForVisit(all, 'VISIT-999'), 0);
});

test('total per month matches the notes listed', () => {
  const rows = fieldExpensesForMonth(all, '2026-11');
  const listed = rows.reduce((sum, item) => sum + item.amount, 0);
  assert.equal(fieldExpenseTotalForMonth(all, '2026-11'), listed);
  assert.equal(fieldExpenseTotalForMonth(all, '2026-11'), 700.5);
  assert.equal(fieldExpenseTotalForMonth(all, '2026-12'), 50);
  assert.equal(fieldExpenseTotalForMonth(all, '2026-10'), 0);
  assert.deepEqual(fieldExpensesForMonth(all, '2026-13'), []);
  assert.deepEqual(fieldExpensesForMonth(all, '2026-1'), []);
  assert.deepEqual(fieldExpensesForMonth(all, ''), []);
  assert.equal(fieldExpenseTotalForMonth(all, '2026-13'), 0);
});

test('month totals list every month in order', () => {
  assert.deepEqual(fieldExpenseMonthTotals(all), [
    { month: '2026-11', total: 700.5 },
    { month: '2026-12', total: 50 },
  ]);
  assert.deepEqual(fieldExpenseMonthTotals([]), []);
});

test('a note is never edited, only corrected by a dated follow-up note', () => {
  const withNote = addFieldExpenseFollowup(all, 'FE-1', '2026-11-03', 'Fare was for two trips.');
  const entry = findFieldExpense(withNote, 'FE-1');
  assert.equal(entry.expense, 'Rickshaw fare');
  assert.equal(entry.amount, 250);
  assert.equal(entry.date, '2026-11-01');
  assert.equal(entry.paidBy, 'Saad');
  assert.deepEqual(entry.followups, [{ date: '2026-11-03', note: 'Fare was for two trips.' }]);
  assert.deepEqual(addFieldExpenseFollowup(all, 'FE-1', '2025-02-29', 'Bad date.'), normalizeFieldExpenseList(all));
  assert.deepEqual(addFieldExpenseFollowup(all, 'FE-1', '2026-11-03', '  '), normalizeFieldExpenseList(all));
  assert.deepEqual(addFieldExpenseFollowup(all, 'FE-9', '2026-11-03', 'Unknown id.'), normalizeFieldExpenseList(all));
});

test('summary text', () => {
  assert.equal(fieldExpenseSummaryText([]), 'No field expenses recorded.');
  assert.equal(fieldExpenseSummaryText([first]), '1 expense note across 1 visit, 250 in total.');
  assert.equal(fieldExpenseSummaryText(all), '4 expense notes across 2 visits, 750.5 in total.');
});

test('entry text names the visit, expense and amount', () => {
  assert.equal(fieldExpenseText(first), 'Visit VISIT-101: Rickshaw fare, 250 on 2026-11-01, paid by Saad.');
  assert.equal(fieldExpenseText({}), 'No field expense recorded.');
  const withNote = addFieldExpenseFollowup([first], 'FE-1', '2026-11-03', 'Fare was for two trips.');
  assert.equal(
    fieldExpenseText(withNote[0]),
    'Visit VISIT-101: Rickshaw fare, 250 on 2026-11-01, paid by Saad. Follow-ups: 2026-11-03: Fare was for two trips.',
  );
});

test('HTML is escaped', () => {
  const evil = { ...first, expense: '<script>alert(1)</script>', paidBy: 'Saad & Co' };
  const html = fieldExpenseHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('Saad &amp; Co'), true);
  assert.equal(fieldExpenseHtml({}), '<p>No field expense recorded.</p>');
});

test('CSV export and filename', () => {
  assert.equal(fieldExpenseFilename(), 'field-expenses.csv');
  const csv = fieldExpenseCsv(all);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","visit reference","expense","amount","date","paid by","follow-ups"');
  assert.equal(lines.length, 5);
  assert.equal(lines[1].includes('"FE-1"'), true);
  assert.equal(lines[1].includes('"250"'), true);
  assert.equal(fieldExpenseCsv([]), '"id","visit reference","expense","amount","date","paid by","follow-ups"');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, amount: 999 }, { id: 'FE-9' }, null, 'nope', second];
  assert.deepEqual(normalizeFieldExpenseList(messy).map((item) => item.id), ['FE-1', 'FE-2']);
  assert.deepEqual(normalizeFieldExpenseList('not a list'), []);
  assert.deepEqual(normalizeFieldExpenseList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../field-expense.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the petty cash and field advance log is untouched', () => {
  const source = readFileSync(new URL('../field-expense.js', import.meta.url), 'utf8');
  assert.equal(source.includes('petty-cash'), false, 'module must not reference the petty cash module');
  assert.equal(existsSync(new URL('../petty-cash.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'feHeading', 'feSummary', 'feList', 'feExportBtn',
    'feVisitRef', 'feExpense', 'feAmount', 'feDate', 'fePaidBy', 'feRecordBtn',
    'feAnnotateId', 'feAnnotateDate', 'feAnnotateNote', 'feAnnotateBtn',
    'feRemoveId', 'feRemoveBtn',
    'feFilterVisit', 'feVisitBtn', 'feVisitBody',
    'feFilterMonth', 'feMonthBtn', 'feMonthBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the field expense panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './field-expense.js'"), true);
  assert.equal(source.includes('renderFieldExpenses()'), true);
  assert.equal(source.includes('FIELD_EXPENSE_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
