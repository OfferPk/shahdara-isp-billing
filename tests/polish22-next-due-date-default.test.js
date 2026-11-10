// Polish #22 — Next due date defaults to the 5th of the NEXT month.
//
// The user's words (2026-11-09): "Next due date by default aggly
// month ki 5 ho." Root cause: bills are generated only through the
// CURRENT month, so in November no December bill exists and every
// bill-reading surface can only say "not recorded" after a full
// payment. The fix is a COMPUTED fallback, never a hardcoded 5th:
// when no open bill carries a due date, fall back to
// dueDateForBillMonth(cycleChoice, nextMonth) — a cycle-day-15
// customer keeps Dec 15. Dec 5 shows only when nothing is owed; an
// overdue Nov 5 stays while November is owed.
//
// Pins:
// - the QC success screen's next-due helper returns the fallback
//   only when no bill carries an open balance; an open bill with a
//   balance but no usable due date still reads null, never a guess;
// - the fallback shapes themselves (default 5th, cycle-day 15,
//   Dec -> Jan rollover) come from billing-cycle-choice.js, never
//   from a hardcoded date in the caller;
// - a fallback-fed balance reply states the due date, and a
//   fallback-fed profile header strip shows "Next due <date>";
// - wiring: app.js computes the fallback from the customer's own
//   cycle choice and passes it into the Quick Collect modal; the
//   modal passes it to the success helper; balanceReplyForCustomer
//   applies the same fallback (one fix covers the balance reply
//   AND the profile header strip, which reads its due date);
// - the info card is already compliant and is NOT touched.
//
// Synthetic data only. No real customer names, no phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  successNextStepsNextDueDate,
  successNextStepsFromReceipt,
  successNextStepsLineText,
  successNextStepsHtml,
} from '../success-next-steps.js';
import {
  DEFAULT_BILL_DUE_DAY,
  dueDateForBillMonth,
  findBillingCycleChoice,
} from '../billing-cycle-choice.js';
import { buildBalanceReply } from '../balance-reply.js';
import {
  buildProfileHeaderStrip,
  profileHeaderStripText,
  profileHeaderStripHtml,
} from '../profile-header-strip.js';

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const navSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

// November 2026, cycle-day-5 customer, November bill paid in full.
const fullyPaidCustomer = () => ({
  id: 'c1',
  customerNumber: 41,
  name: 'Customer One',
  bills: [
    { month: '2026-10', dueAmount: 3000, dueDate: '2026-10-05', payments: [{ id: 'PAY-1', amount: 3000, date: '2026-11-07' }] },
    { month: '2026-11', dueAmount: 3000, dueDate: '2026-11-05', payments: [{ id: 'PAY-2', amount: 3000, date: '2026-11-07' }] },
  ],
});

const allocationsFor = (balances) => ({
  forMonth: (_customerId, month) => ({ balanceDueCents: balances[month] ?? 0 }),
});

const receipt = () => ({
  customerName: 'Customer One',
  customerNumber: 41,
  amount: 3000,
  payableRemaining: 0,
  newTotalDues: 0,
  date: '2026-11-07',
  method: 'Cash',
});

test('fallback shapes: default cycle is the 5th, a cycle choice keeps its own day, Dec rolls to Jan', () => {
  assert.equal(DEFAULT_BILL_DUE_DAY, 5);
  assert.equal(dueDateForBillMonth(null, '2026-12'), '2026-12-05');
  assert.equal(dueDateForBillMonth({ customerId: 'c1', dueDay: 15 }, '2026-12'), '2026-12-15');
  assert.equal(dueDateForBillMonth(null, '2027-01'), '2027-01-05');
  assert.equal(dueDateForBillMonth({ customerId: 'c1', dueDay: 15 }, '2027-01'), '2027-01-15');
  assert.equal(findBillingCycleChoice([], 'c1'), null);
  assert.equal(findBillingCycleChoice([{ customerId: 'c1', dueDay: 15 }], 'c1')?.dueDay, 15);
});

test('success screen: nothing owed + fallback returns the fallback, never a hardcoded 5th', () => {
  const customer = fullyPaidCustomer();
  const allocations = allocationsFor({ '2026-10': 0, '2026-11': 0 });
  assert.equal(successNextStepsNextDueDate(customer, allocations, '2026-12-05'), '2026-12-05');
  assert.equal(successNextStepsNextDueDate(customer, allocations, '2026-12-15'), '2026-12-15');
});

test('success screen: Dec payment with nothing owed rolls the fallback to Jan 5', () => {
  const customer = fullyPaidCustomer();
  const allocations = allocationsFor({ '2026-10': 0, '2026-11': 0 });
  assert.equal(successNextStepsNextDueDate(customer, allocations, '2027-01-05'), '2027-01-05');
});

test('success screen: an overdue Nov 5 stays while November is owed, fallback or not', () => {
  const customer = fullyPaidCustomer();
  const allocations = allocationsFor({ '2026-10': 0, '2026-11': 300000 });
  assert.equal(successNextStepsNextDueDate(customer, allocations), '2026-11-05');
  assert.equal(successNextStepsNextDueDate(customer, allocations, '2026-12-05'), '2026-11-05');
});

test('success screen: an open bill with a balance but no usable due date never takes the fallback', () => {
  const noDate = fullyPaidCustomer();
  delete noDate.bills[1].dueDate;
  assert.equal(successNextStepsNextDueDate(noDate, allocationsFor({ '2026-10': 0, '2026-11': 300000 }), '2026-12-05'), null);
  const badDate = fullyPaidCustomer();
  badDate.bills[1].dueDate = '2026-02-30';
  assert.equal(successNextStepsNextDueDate(badDate, allocationsFor({ '2026-10': 0, '2026-11': 300000 }), '2026-12-05'), null);
});

test('success screen: no fallback given means no date, never a guess', () => {
  const customer = fullyPaidCustomer();
  const allocations = allocationsFor({ '2026-10': 0, '2026-11': 0 });
  assert.equal(successNextStepsNextDueDate(customer, allocations), null);
  assert.equal(successNextStepsNextDueDate(customer, allocations, null), null);
  assert.equal(successNextStepsNextDueDate(customer, allocations, ''), null);
});

test('success screen: an invalid fallback is ignored, never rendered', () => {
  const customer = fullyPaidCustomer();
  const allocations = allocationsFor({ '2026-10': 0, '2026-11': 0 });
  assert.equal(successNextStepsNextDueDate(customer, allocations, 'not a date'), null);
  assert.equal(successNextStepsNextDueDate(customer, allocations, '2026-02-30'), null);
  assert.equal(successNextStepsNextDueDate(customer, allocations, '2026-12-5'), null);
});

test('success screen: a fully paid receipt with the fallback date shows Dec 5, not "not recorded"', () => {
  const next = successNextStepsFromReceipt(receipt(), '2026-12-05');
  assert.equal(next.nextDueDate, '2026-12-05');
  assert.equal(next.fullyPaid, true);
  assert.equal(successNextStepsLineText(next), 'Paid PKR 3,000 · Fully paid · Next due 2026-12-05');
  const html = successNextStepsHtml(next);
  assert.ok(html.includes('2026-12-05'));
  assert.ok(!html.includes('Next due date not recorded'));
});

test('balance reply: a fallback-fed reply states the due date instead of "not recorded"', () => {
  const reply = buildBalanceReply({
    customerId: 'c1',
    customerName: 'Customer One',
    outstanding: 0,
    dueDate: '2026-12-05',
    lastPayment: { amount: 3000, date: '2026-11-07' },
    openDisputes: [],
    variant: 'roman',
  });
  assert.equal(reply.dueDate, '2026-12-05');
  assert.ok(reply.text.includes('Due date: 2026-12-05.'));
  assert.ok(reply.text.includes('You have no amount due at the moment.'));
  assert.ok(!reply.text.includes('Due date: not recorded.'));
});

test('profile strip: a fallback-fed strip shows "Next due Dec 5" instead of "Not recorded"', () => {
  const strip = buildProfileHeaderStrip({
    customerId: 'c1',
    customerName: 'Customer One',
    outstanding: 0,
    packageLabel: '5 Mbps',
    packagePrice: 1000,
    lastPayment: { amount: 3000, date: '2026-11-07' },
    nextDueDate: '2026-12-05',
  });
  assert.equal(strip.nextDueDate, '2026-12-05');
  assert.ok(profileHeaderStripText(strip).includes('Next due 2026-12-05.'));
  const html = profileHeaderStripHtml(strip, (amount) => `PKR ${Number(amount).toLocaleString('en-PK')}`);
  assert.ok(html.includes('2026-12-05'));
  assert.ok(!html.includes('Not recorded'));
});

test('wiring: app.js computes the fallback from the customer cycle and the balance reply uses it', () => {
  assert.ok(appSrc.includes('function fallbackNextDueDateForCustomer(customerId)'), 'app.js defines the fallback helper');
  assert.ok(appSrc.includes('dueDateForBillMonth(findBillingCycleChoice(loadBillingCycleChoices(), customerId), nextMonth)'), 'fallback is dueDateForBillMonth(cycleChoice, nextMonth), never a hardcoded 5th');
  assert.ok(appSrc.includes('if (!nextDueDate && !anyOpenBalance) nextDueDate = fallbackNextDueDateForCustomer(customer.id);'), 'balanceReplyForCustomer applies the fallback only when nothing is owed');
  assert.ok(appSrc.includes('nextDueDateFallback: (customerId) => fallbackNextDueDateForCustomer(customerId),'), 'app.js passes the fallback loader into the Quick Collect modal');
});

test('wiring: the Quick Collect modal passes the fallback into the success helper', () => {
  assert.ok(navSrc.includes('nextDueDateFallback'), 'setupQuickCollectModal accepts the fallback loader');
  assert.ok(navSrc.includes('successNextStepsNextDueDate(postSaveCustomer, calculatePaymentAllocations(postSaveState), fallbackDueDate)'), 'renderSuccessNextSteps passes the fallback through');
});

test('info card untouched: it still reads dueDateForBillMonth(cycleChoice, nextMonth) directly', () => {
  assert.ok(appSrc.includes('nextDueDate: dueDateForBillMonth(cycleChoice, nextMonth),'), 'infoCardForCustomer keeps its own compliant computation');
});
