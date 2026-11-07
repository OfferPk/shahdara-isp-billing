import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  customerDeleteCleanCheck,
  customerDeleteRefusalText,
  customerDeleteFigureCents,
  formatCustomerDeleteAmount,
} from '../customer-delete-clean-check.js';

function cleanCustomer() {
  return { id: 'cust-001', customerNumber: 101, name: 'Test Customer', bills: [], manualBaqaya: [] };
}

function billedCustomer() {
  return {
    id: 'cust-002',
    customerNumber: 102,
    name: 'Test Customer',
    bills: [
      { id: 'bill-1', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [] },
      { id: 'bill-2', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [] },
    ],
    manualBaqaya: [],
  };
}

function paidCustomer() {
  const customer = billedCustomer();
  customer.bills[0].payments = [
    { id: 'pay-1', amount: 3000, date: '2026-11-05', method: 'cash' },
    { id: 'pay-2', amount: 1500, date: '2026-11-06', method: 'cash' },
  ];
  return customer;
}

function baqayaCustomer() {
  return {
    id: 'cust-003',
    customerNumber: 103,
    name: 'Test Customer',
    bills: [],
    manualBaqaya: [{ id: 'MBQ-101', amount: 500, date: '2026-11-01' }],
  };
}

test('a customer with no bills, payments, dues or baqaya is clean', () => {
  const check = customerDeleteCleanCheck(cleanCustomer(), { duesCents: 0, baqayaOutstandingCents: 0 });
  assert.equal(check.clean, true);
  assert.deepEqual(check.reasons, []);
  assert.equal(check.billCount, 0);
  assert.equal(check.paymentCount, 0);
  assert.equal(check.baqayaEntryCount, 0);
  assert.equal(check.duesCents, 0);
});

test('missing bills and baqaya lists read as empty', () => {
  const customer = { id: 'cust-004', customerNumber: 104, name: 'Test Customer' };
  const check = customerDeleteCleanCheck(customer, { duesCents: 0, baqayaOutstandingCents: 0 });
  assert.equal(check.clean, true);
});

test('any bill blocks deletion even when it has no payments', () => {
  const check = customerDeleteCleanCheck(billedCustomer(), { duesCents: 600000, baqayaOutstandingCents: 0 });
  assert.equal(check.clean, false);
  assert.ok(check.reasons.includes('has-bills'));
  assert.equal(check.billCount, 2);
  assert.equal(check.paymentCount, 0);
});

test('payments block deletion, and a voided payment still counts as a payment record', () => {
  const withPayments = customerDeleteCleanCheck(paidCustomer(), { duesCents: 450000, baqayaOutstandingCents: 0 });
  assert.equal(withPayments.clean, false);
  assert.ok(withPayments.reasons.includes('has-bills'));
  assert.ok(withPayments.reasons.includes('has-payments'));
  assert.equal(withPayments.paymentCount, 2);

  const voidedOnly = cleanCustomer();
  voidedOnly.bills = [{ id: 'bill-1', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [{ id: 'pay-1', amount: 3000, date: '2026-11-05', method: 'cash', voided: true }] }];
  const voidedCheck = customerDeleteCleanCheck(voidedOnly, { duesCents: 0, baqayaOutstandingCents: 0 });
  assert.equal(voidedCheck.clean, false);
  assert.ok(voidedCheck.reasons.includes('has-payments'));
});

test('a manual baqaya entry blocks deletion', () => {
  const check = customerDeleteCleanCheck(baqayaCustomer(), { duesCents: 50000, baqayaOutstandingCents: 50000 });
  assert.equal(check.clean, false);
  assert.ok(check.reasons.includes('has-baqaya'));
  assert.equal(check.baqayaEntryCount, 1);
  assert.equal(check.baqayaOutstandingCents, 50000);
});

test('dues still owed block deletion even on an otherwise clean record', () => {
  const check = customerDeleteCleanCheck(cleanCustomer(), { duesCents: 150000, baqayaOutstandingCents: 0 });
  assert.equal(check.clean, false);
  assert.ok(check.reasons.includes('has-dues'));
});

test('a dues figure that cannot be worked out refuses instead of guessing', () => {
  for (const dues of [null, undefined, '3000', true, Number.NaN]) {
    const check = customerDeleteCleanCheck(cleanCustomer(), { duesCents: dues, baqayaOutstandingCents: 0 });
    assert.equal(check.clean, false, `dues ${String(dues)} must refuse`);
    assert.ok(check.reasons.includes('dues-unknown'));
  }
  const nullCustomer = customerDeleteCleanCheck(null, { duesCents: 0, baqayaOutstandingCents: 0 });
  assert.equal(nullCustomer.clean, false);
});

test('the refusal text names what is still on the account and what to do instead', () => {
  const billsAndPayments = customerDeleteCleanCheck(paidCustomer(), { duesCents: 300000, baqayaOutstandingCents: 0 });
  const text = customerDeleteRefusalText(billsAndPayments);
  assert.match(text, /2 bills/);
  assert.match(text, /2 payments/);
  assert.match(text, /PKR 3,000 is still due/);
  assert.match(text, /Clear the account first/);
  assert.match(text, /archive the profile instead/);

  const baqaya = customerDeleteRefusalText(customerDeleteCleanCheck(baqayaCustomer(), { duesCents: 50000, baqayaOutstandingCents: 50000 }));
  assert.match(baqaya, /1 manual baqaya entry/);
  assert.match(baqaya, /PKR 500 is still due/);

  const unknown = customerDeleteRefusalText(customerDeleteCleanCheck(cleanCustomer(), { duesCents: null, baqayaOutstandingCents: 0 }));
  assert.match(unknown, /could not be worked out/);
  assert.doesNotMatch(unknown, /PKR/);
});

test('money figures format min-0 decimals in PKR, and non-numbers are never zero', () => {
  assert.equal(formatCustomerDeleteAmount(3000), 'PKR 3,000');
  assert.equal(formatCustomerDeleteAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatCustomerDeleteAmount(0), 'PKR 0');
  assert.equal(customerDeleteFigureCents(null), null);
  assert.equal(customerDeleteFigureCents(undefined), null);
  assert.equal(customerDeleteFigureCents(''), null);
  assert.equal(customerDeleteFigureCents(true), null);
  assert.equal(customerDeleteFigureCents(1500.4), 1500);
});

test('the wiring gates the profile Delete button on the clean check and confirms Yes/No', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf("$('#deleteCustomerButton').addEventListener");
  assert.ok(start > 0, 'delete button handler exists');
  const body = app.slice(start, app.indexOf('\n});', start));
  assert.doesNotMatch(body, /window\.confirm\(/, 'delete must not use window.confirm');
  assert.ok(body.includes('customerDeleteCleanCheck('), 'handler runs the clean check');
  assert.ok(body.includes('customerDeleteRefusalText('), 'handler shows the refusal text');
  assert.ok(body.includes("title:`Are you sure you want to delete ${customer.name}'s profile?`"), 'confirm asks the exact question with the customer name');
  assert.ok(body.includes("confirmLabel:'Yes'"), 'confirm button is Yes');
  assert.ok(body.includes("cancelLabel:'No'"), 'cancel button is No');
  assert.ok(!body.includes('Archive instead'), 'no Archive instead button on the delete confirm');
  assert.ok(body.includes('snapshotBeforeDestructiveAction()'), 'safety snapshot still runs before deleting');
  assert.match(body, /title:`#\$\{customer\.customerNumber\} \$\{customer\.name\} deleted`[^]*actionLabel:'Undo'/, 'delete keeps the Undo window');
});

test('the danger-zone help says deletion only happens when nothing is owed', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('Deletes this profile only when nothing is owed'), 'profile help text updated');
  const lang = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
  assert.ok(lang.includes('Deletes this profile only when nothing is owed'), 'English help text updated');
  assert.ok(lang.includes('صرف تب حذف ہوتی ہے جب کچھ واجب الادا نہ ہو'), 'Urdu help text updated');
});

test('the new module names no fenced module file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../customer-delete-clean-check.js', import.meta.url), 'utf8');
  for (const fenced of [
    'profile-ui.js',
    'nav-quick-profile.js',
    'customer-record-merge-note.js',
    'wada-record.js',
    'quick-collect-still-owes.js',
    'core.js',
    'customer-emergency-contact.js',
    'suspension-records.js',
    'full-history-list.js',
    'nav-customer-search.js',
    'customer-id-lookup.js',
    'customer-status-filter.js',
  ]) {
    assert.equal(module.includes(fenced), false, `module must not name ${fenced}`);
  }
  assert.equal(module.includes('localStorage'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches pure function calls, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});
