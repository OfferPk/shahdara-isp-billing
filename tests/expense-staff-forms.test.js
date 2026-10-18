import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateExpenseFormFields,
  buildPayrollExpensePrefill,
  validateStaffAttendanceDate
} from '../form-validation.js';
import {
  EXPENSE_CATEGORIES,
  addExpense,
  updateExpense,
  addSaadAttendanceDay,
  addUmairWorkday
} from '../phase3.js';
import { createInitialState, buildPayrollSummary } from '../core.js';

test('validateExpenseFormFields: valid expense fields pass with cleaned fields', () => {
  const result = validateExpenseFormFields({
    date: '2026-10-18',
    amount: '4500.50',
    category: 'Electricity',
    area: 'Bara Dari Road',
    notes: 'Shop bill paid via Easypaisa'
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.cleanFields.date, '2026-10-18');
  assert.equal(result.cleanFields.amount, 4500.5);
  assert.equal(result.cleanFields.category, 'Electricity');
  assert.equal(result.cleanFields.area, 'Bara Dari Road');
  assert.equal(result.cleanFields.notes, 'Shop bill paid via Easypaisa');
});

test('validateExpenseFormFields: validates missing and malformed dates', () => {
  assert.equal(validateExpenseFormFields({ amount: '1000', category: 'Electricity' }).errors.date, 'Payment date is required.');
  assert.equal(validateExpenseFormFields({ date: '18-10-2026', amount: '1000', category: 'Electricity' }).errors.date, 'Payment date must be in YYYY-MM-DD format.');
  assert.equal(validateExpenseFormFields({ date: '2026-02-31', amount: '1000', category: 'Electricity' }).errors.date, 'Payment date must be a valid calendar date.');
});

test('validateExpenseFormFields: validates missing, non-positive, or non-numeric amounts', () => {
  assert.equal(validateExpenseFormFields({ date: '2026-10-18', amount: '', category: 'Repairs' }).errors.amount, 'Expense amount is required.');
  assert.equal(validateExpenseFormFields({ date: '2026-10-18', amount: '0', category: 'Repairs' }).errors.amount, 'Expense amount must be greater than zero.');
  assert.equal(validateExpenseFormFields({ date: '2026-10-18', amount: '-500', category: 'Repairs' }).errors.amount, 'Expense amount must be greater than zero.');
  assert.equal(validateExpenseFormFields({ date: '2026-10-18', amount: 'abc', category: 'Repairs' }).errors.amount, 'Expense amount must be greater than zero.');
});

test('validateExpenseFormFields: validates allowed expense categories', () => {
  assert.equal(validateExpenseFormFields({ date: '2026-10-18', amount: '1000', category: '' }).errors.category, 'Choose a valid expense category.');
  assert.equal(validateExpenseFormFields({ date: '2026-10-18', amount: '1000', category: 'Cryptocurrency' }).errors.category, 'Selected expense category is not recognized.');
  
  for (const cat of EXPENSE_CATEGORIES) {
    const res = validateExpenseFormFields({ date: '2026-10-18', amount: '100', category: cat });
    assert.equal(res.errors.category, undefined, `Expected category "${cat}" to be valid`);
  }
});

test('validateExpenseFormFields: checks max length constraints on area and notes', () => {
  const longNotes = 'X'.repeat(1005);
  const longArea = 'Y'.repeat(105);
  const res = validateExpenseFormFields({
    date: '2026-10-18',
    amount: '500',
    category: 'Repairs',
    notes: longNotes,
    area: longArea
  });
  assert.equal(res.valid, false);
  assert.ok(res.errors.notes.includes('1000 characters'));
  assert.ok(res.errors.area.includes('100 characters'));
});

test('buildPayrollExpensePrefill: correctly calculates Saad and Umair expense prefill payloads', () => {
  let state = createInitialState();
  state = addUmairWorkday(state, '2026-10-01');
  state = addUmairWorkday(state, '2026-10-02');
  state = addUmairWorkday(state, '2026-10-05');

  const saadPrefill = buildPayrollExpensePrefill('saad', state, '2026-10', new Date('2026-10-18T10:00:00Z'));
  assert.equal(saadPrefill.category, 'Salary — Saad');
  assert.equal(saadPrefill.date, '2026-10-18');
  assert.ok(Number(saadPrefill.amount) >= 15000);
  assert.ok(saadPrefill.notes.includes('Monthly salary for 2026-10'));

  const umairPrefill = buildPayrollExpensePrefill('umair', state, '2026-10', new Date('2026-10-18T10:00:00Z'));
  assert.equal(umairPrefill.category, 'Salary — Umair');
  assert.equal(umairPrefill.date, '2026-10-18');
  assert.equal(umairPrefill.amount, '3000');
  assert.ok(umairPrefill.notes.includes('3 logged workdays @ PKR 1,000/day'));

  assert.throws(() => buildPayrollExpensePrefill('unknown', state, '2026-10'), /Unknown payroll type/);
});

test('validateStaffAttendanceDate: validates format, existence, and checks duplicates', () => {
  assert.equal(validateStaffAttendanceDate('', [], 'Date').valid, false);
  assert.equal(validateStaffAttendanceDate('invalid-date', [], 'Date').valid, false);
  assert.equal(validateStaffAttendanceDate('2026-02-31', [], 'Date').valid, false);

  const validRes = validateStaffAttendanceDate('2026-10-15', ['2026-10-10', '2026-10-11'], 'Workday');
  assert.equal(validRes.valid, true);
  assert.equal(validRes.date, '2026-10-15');

  const dupRes = validateStaffAttendanceDate('2026-10-10', ['2026-10-10', '2026-10-11'], 'Workday');
  assert.equal(dupRes.valid, false);
  assert.equal(dupRes.duplicate, true);
  assert.ok(dupRes.error.includes('already recorded'));
});

test('addExpense and updateExpense: persist and preserve area / mohalla location tag', () => {
  let state = createInitialState();
  state = addExpense(state, {
    date: '2026-10-18',
    amount: '3500',
    category: 'Repairs',
    area: 'Saeed Park',
    notes: 'Fiber joint splice box replacement'
  });

  const created = state.expenses.find(e => e.category === 'Repairs');
  assert.ok(created, 'Expense created');
  assert.equal(created.area, 'Saeed Park');

  state = updateExpense(state, created.id, {
    date: '2026-10-18',
    amount: '4000',
    category: 'Repairs',
    area: 'Chowk Shahdara',
    notes: 'Updated joint box and connectors'
  });

  const updated = state.expenses.find(e => e.id === created.id);
  assert.equal(updated.amount, 4000);
  assert.equal(updated.area, 'Chowk Shahdara');
  assert.equal(updated.notes, 'Updated joint box and connectors');
});

test('HTML and CSS integrity: forms, buttons, error containers, and responsive classes exist', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const css = fs.readFileSync('styles.css', 'utf8');
  const app = fs.readFileSync('app.js', 'utf8');

  // HTML checks
  assert.match(html, /id="expenseArea"/, 'expenseArea select exists');
  assert.match(html, /id="expensePayrollPrefillNotice"/, 'expensePayrollPrefillNotice exists');
  assert.match(html, /id="recordSaadSalaryExpenseBtn"/, 'recordSaadSalaryExpenseBtn exists');
  assert.match(html, /id="recordUmairSalaryExpenseBtn"/, 'recordUmairSalaryExpenseBtn exists');
  assert.match(html, /id="logSaadTodayBtn"/, 'logSaadTodayBtn exists');
  assert.match(html, /id="logUmairTodayBtn"/, 'logUmairTodayBtn exists');
  assert.match(html, /id="expenseDateError"/, 'expenseDateError span exists');
  assert.match(html, /id="expenseAmountError"/, 'expenseAmountError span exists');
  assert.match(html, /id="expenseCategoryError"/, 'expenseCategoryError span exists');
  assert.match(html, /id="expenseAreaError"/, 'expenseAreaError span exists');
  assert.match(html, /id="expenseNotesError"/, 'expenseNotesError span exists');
  assert.match(html, /id="saadAttendanceError"/, 'saadAttendanceError span exists');
  assert.match(html, /id="umairWorkdayError"/, 'umairWorkdayError span exists');
  assert.match(html, /data-sort-expense="area"/, 'area column header sortable attribute exists');

  // CSS checks
  assert.match(css, /\.field-error/, 'field-error class styled in CSS');
  assert.match(css, /\.payroll-to-expense-btn/, 'payroll-to-expense-btn class styled in CSS');
  assert.match(css, /#expensePayrollPrefillNotice/, 'expensePayrollPrefillNotice styled in CSS');
  assert.match(css, /\.expense-area-badge/, 'expense-area-badge class styled in CSS');
  assert.match(css, /\.prefilled-pulse/, 'prefilled-pulse animation styled in CSS');

  // app.js wiring checks
  assert.match(app, /validateExpenseFormFields/, 'validateExpenseFormFields wired in app.js');
  assert.match(app, /buildPayrollExpensePrefill/, 'buildPayrollExpensePrefill wired in app.js');
  assert.match(app, /validateStaffAttendanceDate/, 'validateStaffAttendanceDate wired in app.js');
  assert.match(app, /recordSaadSalaryExpenseBtn/, 'recordSaadSalaryExpenseBtn listener wired in app.js');
  assert.match(app, /recordUmairSalaryExpenseBtn/, 'recordUmairSalaryExpenseBtn listener wired in app.js');
});
