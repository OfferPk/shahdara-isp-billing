// Plan 434 — Quick Collect success screen with next steps: after a
// Quick Collect save, the screen shows the amount paid, the still
// owed figure after this payment, the next due date, and a "collect
// again" action, beside the existing package success message. It
// shows only and it records nothing new.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT,
  SUCCESS_NEXT_STEPS_NO_DUE_DATE_TEXT,
  SUCCESS_NEXT_STEPS_COLLECT_AGAIN_TEXT,
  successNextStepsIsStrictDate,
  successNextStepsFigureCents,
  successNextStepsNextDueDate,
  successNextStepsFromReceipt,
  successNextStepsLineText,
  successNextStepsHtml,
  formatSuccessNextStepsAmount,
} from '../success-next-steps.js';

const moduleSrc = readFileSync(new URL('../success-next-steps.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The same fixture the acceptance uses: Customer One (#41) pays
// PKR 2,000 in cash for October 2026, on 2026-11-07, leaving
// PKR 1,000 still owed on the October bill, due 2026-10-05.
const postSaveCustomer = () => ({
  id: 'c1',
  customerNumber: 41,
  name: 'Customer One',
  bills: [
    { month: '2026-10', dueAmount: 3000, dueDate: '2026-10-05', payments: [{ id: 'PAY-1', amount: 2000, date: '2026-11-07' }] },
    { month: '2026-11', dueAmount: 3000, dueDate: '2026-11-05', payments: [] },
  ],
});

const allocationsFor = (balances) => ({
  forMonth: (_customerId, month) => ({ balanceDueCents: balances[month] ?? 0 }),
});

const receipt = () => ({
  customerName: 'Customer One',
  customerNumber: 41,
  amount: 2000,
  payableRemaining: 1000,
  newTotalDues: 1000,
  date: '2026-11-07',
  method: 'Cash',
});

test('dates: strict leap-aware calendar days only', () => {
  assert.equal(successNextStepsIsStrictDate('2026-10-05'), true);
  assert.equal(successNextStepsIsStrictDate('2024-02-29'), true);
  assert.equal(successNextStepsIsStrictDate('2025-02-29'), false);
  assert.equal(successNextStepsIsStrictDate('2026-02-30'), false);
  assert.equal(successNextStepsIsStrictDate('2026-13-01'), false);
  assert.equal(successNextStepsIsStrictDate('2026-10-5'), false);
  assert.equal(successNextStepsIsStrictDate(''), false);
  assert.equal(successNextStepsIsStrictDate(null), false);
  assert.equal(successNextStepsIsStrictDate('2026-10-05T10:00'), false);
});

test('figures: null, boolean, and non-numbers are not a number, never zero', () => {
  assert.equal(successNextStepsFigureCents(null), null);
  assert.equal(successNextStepsFigureCents(undefined), null);
  assert.equal(successNextStepsFigureCents(''), null);
  assert.equal(successNextStepsFigureCents(true), null);
  assert.equal(successNextStepsFigureCents(Number.NaN), null);
  assert.equal(successNextStepsFigureCents(0), 0);
  assert.equal(successNextStepsFigureCents(2000), 200000);
  assert.equal(successNextStepsFigureCents(1500.5), 150050);
});

test('format: money in the app min-0 style', () => {
  assert.equal(formatSuccessNextStepsAmount(2000), '2,000');
  assert.equal(formatSuccessNextStepsAmount(1500.5), '1,500.5');
  assert.equal(formatSuccessNextStepsAmount(0), '0');
});

test('next due date: earliest due date among bills that still carry a balance', () => {
  const due = successNextStepsNextDueDate(postSaveCustomer(), allocationsFor({ '2026-10': 100000, '2026-11': 0 }));
  assert.equal(due, '2026-10-05');
});

test('next due date: a settled bill contributes nothing, the next open bill wins', () => {
  const due = successNextStepsNextDueDate(postSaveCustomer(), allocationsFor({ '2026-10': 0, '2026-11': 300000 }));
  assert.equal(due, '2026-11-05');
});

test('next due date: no open bill with a due date means no date, never a guess', () => {
  assert.equal(successNextStepsNextDueDate(postSaveCustomer(), allocationsFor({ '2026-10': 0, '2026-11': 0 })), null);
  const noDate = postSaveCustomer();
  delete noDate.bills[0].dueDate;
  assert.equal(successNextStepsNextDueDate(noDate, allocationsFor({ '2026-10': 100000 })), null);
  const badDate = postSaveCustomer();
  badDate.bills[0].dueDate = '2026-02-30';
  assert.equal(successNextStepsNextDueDate(badDate, allocationsFor({ '2026-10': 100000 })), null);
  assert.equal(successNextStepsNextDueDate(null, allocationsFor({})), null);
  assert.equal(successNextStepsNextDueDate(postSaveCustomer(), null), null);
  assert.equal(successNextStepsNextDueDate({ id: '' }, allocationsFor({})), null);
});

test('next due date: an allocation lookup that throws means no date', () => {
  const throwing = { forMonth: () => { throw new Error('no ledger'); } };
  assert.equal(successNextStepsNextDueDate(postSaveCustomer(), throwing), null);
});

test('from receipt: amount paid, still owed, and fully-paid flag from the issued receipt', () => {
  const next = successNextStepsFromReceipt(receipt(), '2026-10-05');
  assert.deepEqual(next, {
    customerName: 'Customer One',
    customerNumber: 41,
    amountPaidCents: 200000,
    amountPaid: 2000,
    stillOwedCents: 100000,
    stillOwed: 1000,
    nextDueDate: '2026-10-05',
    fullyPaid: false,
  });
});

test('from receipt: a fully paid customer reads fully paid with no due date', () => {
  const paid = successNextStepsFromReceipt({ ...receipt(), amount: 3000, payableRemaining: 0, newTotalDues: 0 }, null);
  assert.equal(paid.fullyPaid, true);
  assert.equal(paid.stillOwed, 0);
  assert.equal(paid.nextDueDate, null);
});

test('from receipt: the payable remainder wins over the total dues when they differ', () => {
  const next = successNextStepsFromReceipt({ ...receipt(), payableRemaining: 1200, newTotalDues: 1000 }, '2026-10-05');
  assert.equal(next.stillOwed, 1200);
});

test('from receipt: a split collection reads the combined receipt, never one leg', () => {
  const split = successNextStepsFromReceipt({
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 1000,
    payableRemaining: 0,
    splitTender: { totalReceived: 3000, balanceDueCents: 0 },
  }, null);
  assert.equal(split.amountPaid, 3000);
  assert.equal(split.stillOwed, 0);
  assert.equal(split.fullyPaid, true);
  const splitOwing = successNextStepsFromReceipt({
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 1000,
    payableRemaining: 0,
    splitTender: { totalReceived: 2500, balanceDueCents: 50000 },
  }, '2026-10-05');
  assert.equal(splitOwing.amountPaid, 2500);
  assert.equal(splitOwing.stillOwed, 500);
  assert.equal(splitOwing.fullyPaid, false);
});

test('from receipt: no panel when the amount or the still-owed figure cannot be worked out', () => {
  assert.equal(successNextStepsFromReceipt(null, '2026-10-05'), null);
  assert.equal(successNextStepsFromReceipt({ ...receipt(), amount: null }, '2026-10-05'), null);
  assert.equal(successNextStepsFromReceipt({ ...receipt(), amount: 0 }, '2026-10-05'), null);
  assert.equal(successNextStepsFromReceipt({ ...receipt(), amount: true }, '2026-10-05'), null);
  const noOwed = { ...receipt() };
  delete noOwed.payableRemaining;
  delete noOwed.newTotalDues;
  delete noOwed.newBalanceDue;
  assert.equal(successNextStepsFromReceipt(noOwed, '2026-10-05'), null);
  const badSplit = { ...receipt(), splitTender: { totalReceived: null, balanceDueCents: null } };
  assert.equal(successNextStepsFromReceipt(badSplit, '2026-10-05'), null);
});

test('from receipt: a non-strict next due date reads as no date, never a guessed one', () => {
  const next = successNextStepsFromReceipt(receipt(), '2026-02-30');
  assert.equal(next.nextDueDate, null);
  assert.equal(next.fullyPaid, false);
});

test('acceptance: still owed and next due date match the customer record on the same fixture', () => {
  const customer = postSaveCustomer();
  const allocations = allocationsFor({ '2026-10': 100000, '2026-11': 0 });
  const due = successNextStepsNextDueDate(customer, allocations);
  const next = successNextStepsFromReceipt(receipt(), due);
  assert.equal(next.stillOwed, 1000);
  assert.equal(next.stillOwedCents, allocations.forMonth('c1', '2026-10').balanceDueCents);
  assert.equal(next.nextDueDate, '2026-10-05');
  assert.equal(next.nextDueDate, customer.bills[0].dueDate);
  assert.equal(next.amountPaid, 2000);
  assert.equal(next.fullyPaid, false);
});

test('acceptance: a fully paid customer shows fully paid', () => {
  const customer = postSaveCustomer();
  const allocations = allocationsFor({ '2026-10': 0, '2026-11': 0 });
  const due = successNextStepsNextDueDate(customer, allocations);
  const next = successNextStepsFromReceipt({ ...receipt(), amount: 3000, payableRemaining: 0, newTotalDues: 0 }, due);
  assert.equal(next.fullyPaid, true);
  assert.equal(successNextStepsLineText(next), 'Paid PKR 3,000 · Fully paid · Next due date not recorded');
  assert.match(successNextStepsHtml(next), /Fully paid/);
  assert.doesNotMatch(successNextStepsHtml(next), /Still owed<\/span><strong class="qc-meta-val has-balance">/);
});

test('line text: paid, still owed, and next due in plain words', () => {
  const next = successNextStepsFromReceipt(receipt(), '2026-10-05');
  assert.equal(successNextStepsLineText(next), 'Paid PKR 2,000 · Still owed PKR 1,000 · Next due 2026-10-05');
  const noDue = successNextStepsFromReceipt(receipt(), null);
  assert.equal(successNextStepsLineText(noDue), 'Paid PKR 2,000 · Still owed PKR 1,000 · Next due date not recorded');
  assert.equal(successNextStepsLineText(null), '');
  assert.equal(successNextStepsLineText({}), '');
});

test('html: every figure shows, user text is escaped, nothing when there is no panel', () => {
  const next = successNextStepsFromReceipt(receipt(), '2026-10-05');
  const html = successNextStepsHtml(next);
  assert.match(html, /Amount paid/);
  assert.match(html, /PKR 2,000/);
  assert.match(html, /Still owed/);
  assert.match(html, /PKR 1,000/);
  assert.match(html, /Next due date/);
  assert.match(html, /2026-10-05/);
  assert.match(html, /Collect again/);
  assert.match(html, /data-sns-collect-again/);
  assert.match(html, /Customer One \(#41\)/);
  const nasty = successNextStepsFromReceipt({ ...receipt(), customerName: '<script>alert(1)</script>' }, '2026-10-05');
  assert.doesNotMatch(successNextStepsHtml(nasty), /<script>/);
  assert.match(successNextStepsHtml(nasty), /&lt;script&gt;/);
  assert.equal(successNextStepsHtml(null), '');
});

test('html: the collect-again action is a button that posts nothing by itself', () => {
  const html = successNextStepsHtml(successNextStepsFromReceipt(receipt(), '2026-10-05'));
  assert.match(html, /<button type="button"[^>]*data-sns-collect-again/);
  assert.doesNotMatch(html, /<form/);
  assert.doesNotMatch(html, /type="submit"/);
});

test('purity: the module is pure and standalone, with no store and no live handles', () => {
  assert.doesNotMatch(moduleSrc, /localStorage/);
  assert.doesNotMatch(moduleSrc, /sessionStorage/);
  assert.doesNotMatch(moduleSrc, /new Date\(/);
  assert.doesNotMatch(moduleSrc, /Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /document\./);
  assert.doesNotMatch(moduleSrc, /fetch\(/);
  assert.doesNotMatch(moduleSrc, /import /);
  assert.doesNotMatch(moduleSrc, /shahdara_[a-z_]+_v1/);
});

test('fences: the module header never names a fenced module literally', () => {
  const header = moduleSrc.slice(0, moduleSrc.indexOf('const SUCCESS_NEXT_STEPS_DATE_RE'));
  for (const name of ['receipt-preview.js', 'cash-change-calculator.js', 'remembered-method.js', 'dues-amount-default.js', 'quick-collect-one-screen.js', 'name-prefix-lookup.js', 'recent-quick-pick.js', 'one-screen-quick-amounts.js', 'package-success-message.js', 'save-confirmation-summary.js', 'full-history-list.js']) {
    assert.ok(!header.includes(name), `header names fenced module ${name}`);
  }
});

test('styles: the panel reuses the receipt card classes, so no new hex can enter', () => {
  assert.ok(!stylesSrc.includes('sns-'), 'no sns- rule in styles.css');
  const html = successNextStepsHtml(successNextStepsFromReceipt(receipt(), '2026-10-05'));
  assert.match(html, /qc-receipt-card/);
  assert.match(html, /qc-receipt-item/);
  assert.match(html, /qc-meta-label/);
  assert.match(html, /qc-meta-val/);
});

test('wiring: the controller imports the success next steps module', () => {
  assert.match(wiringSrc, /success-next-steps\.js/);
  assert.match(wiringSrc, /successNextStepsFromReceipt/);
  assert.match(wiringSrc, /successNextStepsHtml/);
  assert.match(wiringSrc, /successNextStepsNextDueDate/);
});

test('wiring: the success screen renders the panel beside the receipt card', () => {
  assert.match(wiringSrc, /const nextStepsBox = /);
  assert.match(wiringSrc, /document\.getElementById\('snsSuccessNextSteps'\)/);
  assert.match(wiringSrc, /function renderSuccessNextSteps\(\)/);
  const start = wiringSrc.indexOf('function renderSuccessNextSteps()');
  const slice = wiringSrc.slice(start, start + 1600);
  assert.match(slice, /successNextStepsFromReceipt\(activeReceipt/);
  assert.match(slice, /successNextStepsNextDueDate\(/);
  assert.match(slice, /successNextStepsHtml\(nextSteps\)/);
  assert.match(slice, /nextStepsBox\.hidden = /);
});

test('wiring: the panel renders on both success paths, single and split', () => {
  const occurrences = wiringSrc.match(/renderSuccessNextSteps\(\);/g) || [];
  assert.ok(occurrences.length >= 2, `expected at least 2 render calls, found ${occurrences.length}`);
  const packageAt = wiringSrc.indexOf('applyPackageSuccessMessage(totalCollected)');
  assert.ok(packageAt > 0);
  assert.ok(wiringSrc.indexOf('renderSuccessNextSteps();', packageAt) > packageAt, 'split path renders the panel after the package message');
  const singleAt = wiringSrc.indexOf('applyPackageSuccessMessage(receipt.amount)');
  assert.ok(singleAt > 0);
  assert.ok(wiringSrc.indexOf('renderSuccessNextSteps();', singleAt) > singleAt, 'single path renders the panel after the package message');
});

test('wiring: collect again reopens the form for the same customer and posts nothing', () => {
  const start = wiringSrc.indexOf('data-sns-collect-again');
  assert.ok(start > 0, 'wiring listens for the collect-again hook');
  const slice = wiringSrc.slice(start, start + 600);
  assert.match(slice, /openCustomerCollectionForm\(activeCustomerId\)/);
  assert.doesNotMatch(slice, /addPayment|executeQuickCollection/);
});

test('wiring: the panel host sits on the success step after the receipt card', () => {
  assert.ok(pageSrc.includes('id="snsSuccessNextSteps"'));
  const cardAt = pageSrc.indexOf('id="quickCollectReceiptCard"');
  const hostAt = pageSrc.indexOf('id="snsSuccessNextSteps"');
  const actionsAt = pageSrc.indexOf('qc-success-actions');
  assert.ok(cardAt > 0 && hostAt > cardAt, 'panel host follows the receipt card');
  assert.ok(actionsAt > hostAt, 'success actions follow the panel host');
  const successAt = pageSrc.indexOf('id="quickCollectStepSuccess"');
  assert.ok(successAt > 0 && hostAt > successAt, 'panel host sits inside the success step');
});
