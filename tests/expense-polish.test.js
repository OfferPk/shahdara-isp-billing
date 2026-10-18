import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  filterExpenseRows,
  sortExpenseRows,
  generateExpensesCsv
} from '../form-validation.js';

const mockExpenses = [
  { id: 'exp-1', date: '2026-10-05', category: 'Electricity', amount: 8500, area: 'Bara Dari Road', notes: 'Main hub meter bill' },
  { id: 'exp-2', date: '2026-10-12', category: 'Repairs', amount: 1200, area: 'Saeed Park', notes: 'Fiber cut near pole 14' },
  { id: 'exp-3', date: '2026-09-28', category: 'Nayatel bill', amount: 45000, area: '', notes: 'Upstream transit monthly' },
  { id: 'exp-4', date: '2026-10-15', category: 'Salary — Saad', amount: 15400, area: 'Shahdara Town', notes: 'Base salary plus active customers' },
  { id: 'exp-5', date: '2026-10-02', category: 'Tools', amount: 3500, area: 'Chowk Shahdara', notes: 'Visual fault locator pen' }
];

test('filterExpenseRows: filters by month accurately', () => {
  const oct = filterExpenseRows(mockExpenses, { month: '2026-10' });
  assert.equal(oct.length, 4);
  assert.ok(oct.every(e => e.date.startsWith('2026-10')));

  const sep = filterExpenseRows(mockExpenses, { month: '2026-09' });
  assert.equal(sep.length, 1);
  assert.equal(sep[0].id, 'exp-3');

  const all = filterExpenseRows(mockExpenses, { month: 'all' });
  assert.equal(all.length, 5);
});

test('filterExpenseRows: filters by category accurately', () => {
  const repairs = filterExpenseRows(mockExpenses, { category: 'Repairs' });
  assert.equal(repairs.length, 1);
  assert.equal(repairs[0].id, 'exp-2');

  const salary = filterExpenseRows(mockExpenses, { category: 'Salary — Saad' });
  assert.equal(salary.length, 1);
  assert.equal(salary[0].id, 'exp-4');

  const nonExistent = filterExpenseRows(mockExpenses, { category: 'ONU' });
  assert.equal(nonExistent.length, 0);
});

test('filterExpenseRows: searches query across notes, category, and area', () => {
  // Query matching notes
  const notesMatch = filterExpenseRows(mockExpenses, { query: 'pole 14' });
  assert.equal(notesMatch.length, 1);
  assert.equal(notesMatch[0].id, 'exp-2');

  // Query matching area
  const areaMatch = filterExpenseRows(mockExpenses, { query: 'Bara Dari' });
  assert.equal(areaMatch.length, 1);
  assert.equal(areaMatch[0].id, 'exp-1');

  // Query matching category
  const catMatch = filterExpenseRows(mockExpenses, { query: 'electric' });
  assert.equal(catMatch.length, 1);
  assert.equal(catMatch[0].id, 'exp-1');

  // Combined filters: month + query
  const combined = filterExpenseRows(mockExpenses, { month: '2026-10', query: 'transit' });
  assert.equal(combined.length, 0, 'Transit was in Sep, so Oct filter should yield 0');

  const combinedSep = filterExpenseRows(mockExpenses, { month: '2026-09', query: 'transit' });
  assert.equal(combinedSep.length, 1);
});

test('sortExpenseRows: sorts by date asc and desc', () => {
  const asc = sortExpenseRows(mockExpenses, 'date', true);
  assert.equal(asc[0].date, '2026-09-28');
  assert.equal(asc[asc.length - 1].date, '2026-10-15');

  const desc = sortExpenseRows(mockExpenses, 'date', false);
  assert.equal(desc[0].date, '2026-10-15');
  assert.equal(desc[desc.length - 1].date, '2026-09-28');
});

test('sortExpenseRows: sorts by amount asc and desc', () => {
  const asc = sortExpenseRows(mockExpenses, 'amount', true);
  assert.equal(asc[0].amount, 1200);
  assert.equal(asc[asc.length - 1].amount, 45000);

  const desc = sortExpenseRows(mockExpenses, 'amount', false);
  assert.equal(desc[0].amount, 45000);
  assert.equal(desc[desc.length - 1].amount, 1200);
});

test('sortExpenseRows: sorts by category asc and desc', () => {
  const asc = sortExpenseRows(mockExpenses, 'category', true);
  assert.equal(asc[0].category, 'Electricity');
  assert.equal(asc[asc.length - 1].category, 'Tools');

  const desc = sortExpenseRows(mockExpenses, 'category', false);
  assert.equal(desc[0].category, 'Tools');
  assert.equal(desc[desc.length - 1].category, 'Electricity');
});

test('sortExpenseRows: sorts by area asc and desc with fallback', () => {
  const asc = sortExpenseRows(mockExpenses, 'area', true);
  // Unallocated empty string comes first in asc
  assert.equal(asc[0].area, '');
  assert.equal(asc[1].area, 'Bara Dari Road');

  const desc = sortExpenseRows(mockExpenses, 'area', false);
  assert.equal(desc[0].area, 'Shahdara Town');
});

test('generateExpensesCsv: produces RFC-4180 CSV with BOM, area, and quotes', () => {
  const csv = generateExpensesCsv(mockExpenses);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'Date,Category,Amount (PKR),Area / Mohalla,Notes');
  
  // Verify row 1 (Electricity)
  assert.ok(lines.some(l => l.includes('Electricity') && l.includes('Bara Dari Road') && l.includes('Main hub meter bill')));

  // Verify unallocated area fallback
  assert.ok(lines.some(l => l.includes('Nayatel bill') && l.includes('Unallocated')));
});

test('UI integrity: expense table headers, empty state clear button, and styles exist', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('styles.css', 'utf8');
  const app = fs.readFileSync('app.js', 'utf8');

  // HTML elements
  assert.match(html, /id="resetExpenseFiltersInlineBtn"/, 'resetExpenseFiltersInlineBtn exists in index.html');
  assert.match(html, /id="dismissExpensePayrollNoticeBtn"/, 'dismissExpensePayrollNoticeBtn exists in index.html');
  assert.match(html, /data-sort-expense="date"/, 'data-sort-expense="date" exists');
  assert.match(html, /data-sort-expense="area"/, 'data-sort-expense="area" exists');

  // CSS styles
  assert.match(css, /th\[data-sort-expense\]/, 'th[data-sort-expense] styled in CSS');
  assert.match(css, /#expenseTableCount/, '#expenseTableCount styled in CSS');
  assert.match(css, /#resetExpenseFiltersInlineBtn/, '#resetExpenseFiltersInlineBtn styled in CSS');

  // app.js wiring
  assert.match(app, /filterExpenseRows/, 'filterExpenseRows used in app.js');
  assert.match(app, /sortExpenseRows/, 'sortExpenseRows used in app.js');
  assert.match(app, /generateExpensesCsv/, 'generateExpensesCsv used in app.js');
  assert.match(app, /dismissExpensePayrollNoticeBtn/, 'dismissExpensePayrollNoticeBtn wired in app.js');
  assert.match(app, /resetExpenseFiltersInlineBtn/, 'resetExpenseFiltersInlineBtn wired in app.js');
});
