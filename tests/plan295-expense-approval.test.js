import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validExpenseApprovalDate,
  foldExpenseApprovalStatus,
  normalizeExpenseApproval,
  normalizeExpenseApprovalList,
  findExpenseApproval,
  recordExpenseApproval,
  removeExpenseApproval,
  expenseApprovalsSorted,
  expenseApprovalLatest,
  expenseApprovalsForCategory,
  expenseApprovalCategories,
  expenseApprovalCategorySummary,
  expenseApprovalSummaryText,
  expenseApprovalEntryText,
  expenseApprovalEntryHtml,
  expenseApprovalAllHtml,
  expenseApprovalsForCategoryHtml,
  expenseApprovalCategorySummaryHtml,
  expenseApprovalCsv,
  expenseApprovalFilename,
} from '../expense-approval.js';

const first = {
  id: 'EA-1',
  expense: 'Emergency fibre cable roll',
  category: 'Field material',
  amount: 12500,
  approver: 'Aqib',
  date: '2026-11-02',
  status: 'approved',
};
const second = {
  id: 'EA-2',
  expense: 'Shop tea and cleaning',
  category: 'Petty cash',
  amount: 800,
  approver: 'Aqib',
  date: '2026-11-09',
  status: 'pending',
};
const third = {
  id: 'EA-3',
  expense: 'Spare ONU units',
  category: 'field material',
  amount: 9200,
  approver: 'Saad',
  date: '2026-10-26',
  status: 'declined',
};
const fixture = [second, first, third];

test('half-formed approvals are refused', () => {
  assert.equal(normalizeExpenseApproval(null), null);
  assert.equal(normalizeExpenseApproval([]), null);
  assert.equal(normalizeExpenseApproval({ ...first, id: '  ' }), null);
  assert.equal(normalizeExpenseApproval({ ...first, expense: '' }), null);
  assert.equal(normalizeExpenseApproval({ ...first, category: '   ' }), null);
  assert.equal(normalizeExpenseApproval({ ...first, amount: '' }), null);
  assert.equal(normalizeExpenseApproval({ ...first, amount: 0 }), null);
  assert.equal(normalizeExpenseApproval({ ...first, amount: -100 }), null);
  assert.equal(normalizeExpenseApproval({ ...first, amount: 12500.5 }), null);
  assert.equal(normalizeExpenseApproval({ ...first, amount: '12,500' }), null);
  assert.equal(normalizeExpenseApproval({ ...first, approver: '' }), null);
  assert.equal(normalizeExpenseApproval({ ...first, date: '' }), null);
  assert.equal(normalizeExpenseApproval({ ...first, date: '2026-13-02' }), null);
  assert.equal(normalizeExpenseApproval({ ...first, date: '02-11-2026' }), null);
  assert.deepEqual(normalizeExpenseApproval(first), first);
  assert.deepEqual(normalizeExpenseApproval({ ...first, amount: '12500' }).amount, 12500);
  assert.deepEqual(normalizeExpenseApproval({ ...first, expense: '  Emergency fibre cable roll  ' }).expense, 'Emergency fibre cable roll');
});

test('status folds from plain spellings and defaults to pending', () => {
  assert.equal(foldExpenseApprovalStatus('approved'), 'approved');
  assert.equal(foldExpenseApprovalStatus('Approve'), 'approved');
  assert.equal(foldExpenseApprovalStatus('YES'), 'approved');
  assert.equal(foldExpenseApprovalStatus('agreed'), 'approved');
  assert.equal(foldExpenseApprovalStatus('declined'), 'declined');
  assert.equal(foldExpenseApprovalStatus('Rejected'), 'declined');
  assert.equal(foldExpenseApprovalStatus('no'), 'declined');
  assert.equal(foldExpenseApprovalStatus('pending'), 'pending');
  assert.equal(foldExpenseApprovalStatus('requested'), 'pending');
  assert.equal(foldExpenseApprovalStatus(''), 'pending');
  assert.equal(foldExpenseApprovalStatus('maybe'), 'pending');
  assert.equal(foldExpenseApprovalStatus(undefined), 'pending');
  assert.equal(normalizeExpenseApproval({ ...first, status: undefined }).status, 'pending');
  assert.equal(normalizeExpenseApproval({ ...first, status: 'AGREED' }).status, 'approved');
});

test('strict dates: real calendar only', () => {
  assert.equal(validExpenseApprovalDate('2026-02-29'), false);
  assert.equal(validExpenseApprovalDate('2024-02-29'), true);
  assert.equal(validExpenseApprovalDate('2026-04-31'), false);
  assert.equal(validExpenseApprovalDate('2026-11-05'), true);
  assert.equal(validExpenseApprovalDate('2026-00-10'), false);
  assert.equal(validExpenseApprovalDate('2026-11-00'), false);
  assert.equal(validExpenseApprovalDate(20261105), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = {
    ...first,
    billId: 'B-1',
    paymentId: 'P-1',
    budgetId: 'BU-1',
    extra: 'drop me',
  };
  const clean = normalizeExpenseApproval(raw);
  assert.equal(clean.billId, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.budgetId, undefined);
  assert.equal(clean.extra, undefined);
  assert.deepEqual(Object.keys(clean).sort(), ['amount', 'approver', 'category', 'date', 'expense', 'id', 'status']);
  const before = JSON.stringify(raw);
  normalizeExpenseApproval(raw);
  assert.equal(JSON.stringify(raw), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordExpenseApproval([first], { ...first, amount: 1 });
  assert.deepEqual(list, [first]);
  assert.deepEqual(recordExpenseApproval([first], { ...first, id: 'EA-9', date: '2026-11-03' }), [first, {
    id: 'EA-9', expense: 'Emergency fibre cable roll', category: 'Field material', amount: 12500, approver: 'Aqib', date: '2026-11-03', status: 'approved',
  }]);
});

test('find and remove', () => {
  assert.deepEqual(findExpenseApproval(fixture, 'EA-2'), second);
  assert.equal(findExpenseApproval(fixture, 'EA-9'), null);
  assert.equal(findExpenseApproval(fixture, ''), null);
  assert.deepEqual(removeExpenseApproval(fixture, 'EA-2'), [first, third]);
  assert.deepEqual(removeExpenseApproval(fixture, 'EA-9'), fixture);
});

test('sorting is by date then id', () => {
  assert.deepEqual(expenseApprovalsSorted(fixture).map((approval) => approval.id), ['EA-3', 'EA-1', 'EA-2']);
  assert.deepEqual(expenseApprovalsSorted([{ ...first, id: 'EA-0', date: '2026-11-02' }, first]).map((approval) => approval.id), ['EA-0', 'EA-1']);
  assert.deepEqual(expenseApprovalLatest(fixture), second);
  assert.equal(expenseApprovalLatest([]), null);
});

test('approvals list per category with the first spelling kept', () => {
  assert.deepEqual(expenseApprovalsForCategory(fixture, 'FIELD MATERIAL').map((approval) => approval.id), ['EA-3', 'EA-1']);
  assert.deepEqual(expenseApprovalsForCategory(fixture, 'Petty cash').map((approval) => approval.id), ['EA-2']);
  assert.deepEqual(expenseApprovalsForCategory(fixture, 'No such category'), []);
  assert.deepEqual(expenseApprovalsForCategory(fixture, ''), []);
  assert.deepEqual(expenseApprovalCategories(fixture), ['Field material', 'Petty cash']);
  assert.deepEqual(expenseApprovalCategories([]), []);
});

test('category summary shows where the money goes', () => {
  assert.deepEqual(expenseApprovalCategorySummary(fixture), [
    { category: 'Field material', count: 2, totalAmount: 21700 },
    { category: 'Petty cash', count: 1, totalAmount: 800 },
  ]);
  assert.deepEqual(expenseApprovalCategorySummary([]), []);
  const html = expenseApprovalCategorySummaryHtml(fixture);
  assert.equal(html.includes('Field material: 2 approvals, Rs 21700 in total'), true);
  assert.equal(html.includes('Petty cash: 1 approval, Rs 800 in total'), true);
  assert.equal(expenseApprovalCategorySummaryHtml([]), '<p>No expense categories yet.</p>');
});

test('summary text names the counts and the latest approval', () => {
  assert.equal(expenseApprovalSummaryText([]), 'No expense approvals recorded.');
  assert.equal(
    expenseApprovalSummaryText([first]),
    '1 expense approval recorded: 1 approved, 0 pending, 0 declined. Latest approval on 2026-11-02: Emergency fibre cable roll, Rs 12500, Field material, approved by Aqib.',
  );
  assert.equal(
    expenseApprovalSummaryText(fixture),
    '3 expense approvals recorded: 1 approved, 1 pending, 1 declined. Latest approval on 2026-11-09: Shop tea and cleaning, Rs 800, Petty cash, approved by Aqib.',
  );
});

test('entry text shows expense, category, amount, approver, and status', () => {
  assert.equal(expenseApprovalEntryText(null), 'No expense approval recorded.');
  assert.equal(
    expenseApprovalEntryText(first),
    '2026-11-02 — Emergency fibre cable roll, Rs 12500, Field material, approved by Aqib, approved.',
  );
  assert.equal(
    expenseApprovalEntryText(second),
    '2026-11-09 — Shop tea and cleaning, Rs 800, Petty cash, approved by Aqib, pending.',
  );
});

test('HTML escapes input', () => {
  const nasty = { ...second, expense: 'Tea & snacks <b>bold</b>' };
  assert.equal(expenseApprovalEntryHtml(nasty).includes('<b>'), false);
  assert.equal(expenseApprovalEntryHtml(nasty).includes('Tea &amp; snacks &lt;b&gt;bold&lt;/b&gt;'), true);
  assert.equal(expenseApprovalEntryHtml(null), '<p>No expense approval recorded.</p>');
  const html = expenseApprovalAllHtml(fixture);
  assert.equal(html.includes('2026-11-09'), true);
  assert.equal(html.includes('Spare ONU units'), true);
  assert.equal(expenseApprovalAllHtml([]), '<p>No expense approvals recorded.</p>');
  assert.equal(expenseApprovalsForCategoryHtml(fixture, 'Petty cash').includes('Shop tea and cleaning'), true);
  assert.equal(expenseApprovalsForCategoryHtml(fixture, 'No such category'), '<p>No expense approvals in this category.</p>');
});

test('CSV export and filename', () => {
  const csv = expenseApprovalCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","date","expense","category","amount","approver","status"');
  assert.equal(csv.includes('"EA-2","2026-11-09","Shop tea and cleaning","Petty cash","800","Aqib","pending"'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"EA-3"'), true);
  assert.equal(expenseApprovalFilename(), 'expense-approvals.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeExpenseApprovalList(null), []);
  assert.deepEqual(normalizeExpenseApprovalList('nope'), []);
  assert.deepEqual(normalizeExpenseApprovalList([first, null, { ...first, id: '' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../expense-approval.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the bill schedule, budgets, and approval limits records are untouched', () => {
  const source = readFileSync(new URL('../expense-approval.js', import.meta.url), 'utf8');
  assert.equal(source.includes('vendor-bills.js'), false, 'module must not reference the vendor bill schedule module');
  assert.equal(source.includes('expense-month-budgets.js'), false, 'module must not reference the expense budgets module');
  assert.equal(source.includes('expense-budget-caps.js'), false, 'module must not reference the expense budget caps module');
  assert.equal(source.includes('approval-limits.js'), false, 'module must not reference the discount approval limits module');
  assert.equal(existsSync(new URL('../vendor-bills.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../expense-month-budgets.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../expense-budget-caps.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../approval-limits.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'eapHeading', 'eapSummary', 'eapExportBtn', 'eapExpense', 'eapCategory',
    'eapAmount', 'eapApprover', 'eapDate', 'eapStatus', 'eapRecordBtn',
    'eapRemoveId', 'eapRemoveBtn', 'eapCategorySelect', 'eapCategoryBody', 'eapCategorySummary', 'eapBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the expense approval panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './expense-approval.js'"), true);
  assert.equal(source.includes('renderExpenseApproval()'), true);
  assert.equal(source.includes('loadExpenseApprovals()'), true);
  assert.equal(source.includes('shahdara_expense_approvals_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
