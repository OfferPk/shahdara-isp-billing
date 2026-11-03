/**
 * plan36-billing-cycle-choice.test.js — Plan 36: per-customer billing
 * cycle and due-date choice.
 *
 * Pins:
 * - a cycle record is one due day per customer with a change date;
 *   invalid due days and missing customers are rejected, never stored
 *   half-formed; bad change dates become null, never guessed;
 * - a bill raised in or after the change month gets the cycle due date
 *   (clamped to the month's length); an earlier bill keeps its old due
 *   date (or the shared 5th default); no choice means the 5th;
 * - the auto-generator honours cycle records passed to it and leaves
 *   existing bills untouched; addPayment honours options.cycleChoices;
 * - the Plan 11 pre-due queue reads a bill's own due date, so a
 *   cycle-dated bill is reminded on the customer's own date;
 * - a cycle record carries no money, bill, payment, or Waada field.
 * Synthetic data only; no record is ever rewritten by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment,
} from '../core.js';
import {
  DEFAULT_BILL_DUE_DAY,
  isValidBillingCycleDate,
  normalizeBillingDueDay,
  normalizeBillingCycleChoice,
  normalizeBillingCycleChoices,
  findBillingCycleChoice,
  upsertBillingCycleChoice,
  removeBillingCycleChoice,
  daysInBillingMonth,
  dueDateForBillMonth,
  dueDateForBill,
  billingCycleChoiceSummaryText,
  billingCycleChoiceHtml,
} from '../billing-cycle-choice.js';
import { buildPreDueReminderQueue } from '../pre-due-reminders.js';

const OCT_29 = new Date(2026, 9, 29, 12);
const NOV_2 = new Date(2026, 10, 2, 12);
const NOV_12 = new Date(2026, 10, 12, 12);

const choice15Nov = { customerId: 'seed-001', dueDay: 15, changedAt: '2026-11-02', note: '' };

function pricedState() {
  let state = createInitialState(['Cycle Customer']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  return state;
}

function billFor(state, customerId, month) {
  return (state.customers.find((c) => c.id === customerId)?.bills ?? []).find((b) => b.month === month);
}

test('due day normalisation accepts integers and numeric strings only', () => {
  assert.equal(normalizeBillingDueDay(15), 15);
  assert.equal(normalizeBillingDueDay('15'), 15);
  assert.equal(normalizeBillingDueDay(1), 1);
  assert.equal(normalizeBillingDueDay(31), 31);
  assert.equal(normalizeBillingDueDay(0), null);
  assert.equal(normalizeBillingDueDay(32), null);
  assert.equal(normalizeBillingDueDay(15.5), null);
  assert.equal(normalizeBillingDueDay(''), null);
  assert.equal(normalizeBillingDueDay('abc'), null);
  assert.equal(normalizeBillingDueDay(Number.NaN), null);
  assert.equal(normalizeBillingDueDay(null), null);
});

test('change-date validation rejects impossible dates', () => {
  assert.equal(isValidBillingCycleDate('2026-11-02'), true);
  assert.equal(isValidBillingCycleDate('2024-02-29'), true);
  assert.equal(isValidBillingCycleDate('2026-02-30'), false);
  assert.equal(isValidBillingCycleDate('2026-13-01'), false);
  assert.equal(isValidBillingCycleDate('not-a-date'), false);
  assert.equal(isValidBillingCycleDate(null), false);
});

test('choice normalisation trims, rejects half-formed records, nulls bad dates', () => {
  assert.deepEqual(normalizeBillingCycleChoice({ customerId: '  seed-001 ', dueDay: '15', changedAt: '2026-11-02', note: ' payday ' }), { customerId: 'seed-001', dueDay: 15, changedAt: '2026-11-02', note: 'payday' });
  assert.equal(normalizeBillingCycleChoice({ customerId: '', dueDay: 15 }), null);
  assert.equal(normalizeBillingCycleChoice({ dueDay: 15 }), null);
  assert.equal(normalizeBillingCycleChoice({ customerId: 'seed-001', dueDay: 0 }), null);
  assert.equal(normalizeBillingCycleChoice({ customerId: 'seed-001', dueDay: 15, changedAt: '2026-02-30' }).changedAt, null);
  assert.equal(normalizeBillingCycleChoice(null), null);
  assert.equal(normalizeBillingCycleChoice('seed-001'), null);
});

test('list normalisation is last-wins, one per customer, sorted, non-mutating', () => {
  const input = [
    { customerId: 'seed-002', dueDay: 1, changedAt: '2026-10-01' },
    { customerId: 'seed-001', dueDay: 15, changedAt: '2026-11-02' },
    { customerId: 'seed-001', dueDay: 20, changedAt: '2026-11-05' },
    { customerId: '', dueDay: 15 },
    { customerId: 'seed-003', dueDay: 99 },
  ];
  const snapshot = JSON.parse(JSON.stringify(input));
  const out = normalizeBillingCycleChoices(input);
  assert.deepEqual(out.map((c) => c.customerId), ['seed-001', 'seed-002']);
  assert.equal(out[0].dueDay, 20);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(normalizeBillingCycleChoices(null), []);
  assert.deepEqual(normalizeBillingCycleChoices('nope'), []);
});

test('find, upsert and remove keep one record per customer', () => {
  const list = normalizeBillingCycleChoices([choice15Nov]);
  assert.equal(findBillingCycleChoice(list, 'seed-001').dueDay, 15);
  assert.equal(findBillingCycleChoice(list, 'nobody'), null);
  assert.equal(findBillingCycleChoice(list, ''), null);
  const replaced = upsertBillingCycleChoice(list, { customerId: 'seed-001', dueDay: 1, changedAt: '2026-12-01' });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].dueDay, 1);
  assert.equal(list[0].dueDay, 15, 'upsert never mutates its input');
  assert.equal(upsertBillingCycleChoice(list, { customerId: 'seed-001', dueDay: 0 }).length, 1, 'invalid upsert leaves the list unchanged');
  assert.equal(removeBillingCycleChoice(list, 'seed-001').length, 0);
  assert.equal(removeBillingCycleChoice(list, 'nobody').length, 1);
});

test('days in month are leap-aware; invalid months are null', () => {
  assert.equal(daysInBillingMonth('2026-02'), 28);
  assert.equal(daysInBillingMonth('2024-02'), 29);
  assert.equal(daysInBillingMonth('2026-04'), 30);
  assert.equal(daysInBillingMonth('2026-01'), 31);
  assert.equal(daysInBillingMonth('2026-13'), null);
  assert.equal(daysInBillingMonth('nope'), null);
});

test('due date for a bill month clamps the due day to the month length', () => {
  assert.equal(dueDateForBillMonth(null, '2026-11'), '2026-11-05');
  assert.equal(dueDateForBillMonth(choice15Nov, '2026-11'), '2026-11-15');
  assert.equal(dueDateForBillMonth({ customerId: 'seed-001', dueDay: 31 }, '2026-02'), '2026-02-28');
  assert.equal(dueDateForBillMonth({ customerId: 'seed-001', dueDay: 31 }, '2024-02'), '2024-02-29');
  assert.equal(dueDateForBillMonth({ customerId: 'seed-001', dueDay: 31 }, '2026-04'), '2026-04-30');
  assert.equal(dueDateForBillMonth(choice15Nov, '2026-13'), null);
  assert.equal(DEFAULT_BILL_DUE_DAY, 5);
});

test('due date for a bill honours the change month and keeps earlier bills', () => {
  assert.equal(dueDateForBill({ choice: null, month: '2026-11', existingDueDate: '2026-11-05' }), '2026-11-05');
  assert.equal(dueDateForBill({ choice: null, month: '2026-11', existingDueDate: null }), '2026-11-05');
  assert.equal(dueDateForBill({ choice: choice15Nov, month: '2026-11', existingDueDate: '2026-11-05' }), '2026-11-15');
  assert.equal(dueDateForBill({ choice: choice15Nov, month: '2026-12', existingDueDate: null }), '2026-12-15');
  assert.equal(dueDateForBill({ choice: choice15Nov, month: '2026-10', existingDueDate: '2026-10-05' }), '2026-10-05');
  assert.equal(dueDateForBill({ choice: choice15Nov, month: '2026-10', existingDueDate: null }), '2026-10-05');
  assert.equal(dueDateForBill({ choice: { customerId: 'seed-001', dueDay: 15, changedAt: null }, month: '2026-10', existingDueDate: null }), '2026-10-15', 'no change date recorded means the current choice applies');
  assert.equal(dueDateForBill({ choice: choice15Nov, month: '2026-13', existingDueDate: '2026-11-05' }), '2026-11-05');
  assert.equal(dueDateForBill({ choice: choice15Nov, month: '2026-13', existingDueDate: null }), null);
});

test('summary text names the due day, change date and note; ordinals are right', () => {
  assert.equal(billingCycleChoiceSummaryText(null), 'No billing cycle choice recorded — bills fall due on the 5th of each month.');
  assert.equal(billingCycleChoiceSummaryText(choice15Nov), 'Due on the 15th of each month, changed on 2026-11-02.');
  assert.ok(billingCycleChoiceSummaryText({ customerId: 'x', dueDay: 1 }).includes('Due on the 1st'));
  assert.ok(billingCycleChoiceSummaryText({ customerId: 'x', dueDay: 2 }).includes('Due on the 2nd'));
  assert.ok(billingCycleChoiceSummaryText({ customerId: 'x', dueDay: 3 }).includes('Due on the 3rd'));
  assert.ok(billingCycleChoiceSummaryText({ customerId: 'x', dueDay: 22 }).includes('Due on the 22nd'));
  assert.ok(billingCycleChoiceSummaryText({ customerId: 'x', dueDay: 15, changedAt: null }).includes('change date not recorded'));
  assert.ok(billingCycleChoiceSummaryText({ customerId: 'x', dueDay: 15, changedAt: '2026-11-02', note: 'payday' }).includes('Note: payday'));
});

test('summary HTML escapes hostile notes', () => {
  const html = billingCycleChoiceHtml({ customerId: 'x', dueDay: 15, changedAt: '2026-11-02', note: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('a cycle record carries no money, bill, payment, or Waada field', () => {
  assert.deepEqual(Object.keys(normalizeBillingCycleChoice(choice15Nov)).sort(), ['changedAt', 'customerId', 'dueDay', 'note']);
});

test('generator without choices keeps the shared 5th default', () => {
  const generated = generateMonthlyBillsThroughCurrentMonth(pricedState(), OCT_29);
  assert.equal(billFor(generated, 'seed-001', '2026-10').dueDate, '2026-10-05');
});

test('generator with a cycle gives the next bill the new date and keeps the earlier bill', () => {
  let state = generateMonthlyBillsThroughCurrentMonth(pricedState(), OCT_29);
  assert.equal(billFor(state, 'seed-001', '2026-10').dueDate, '2026-10-05');
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2, [choice15Nov]);
  assert.equal(billFor(state, 'seed-001', '2026-10').dueDate, '2026-10-05', 'the earlier bill is never rewritten');
  assert.equal(billFor(state, 'seed-001', '2026-11').dueDate, '2026-11-15');
});

test('generator backfill in one run still respects the change month', () => {
  const state = generateMonthlyBillsThroughCurrentMonth(pricedState(), NOV_2, [choice15Nov]);
  assert.equal(billFor(state, 'seed-001', '2026-10').dueDate, '2026-10-05');
  assert.equal(billFor(state, 'seed-001', '2026-11').dueDate, '2026-11-15');
});

test('generator without choices in November keeps the 5th', () => {
  const state = generateMonthlyBillsThroughCurrentMonth(pricedState(), NOV_2);
  assert.equal(billFor(state, 'seed-001', '2026-11').dueDate, '2026-11-05');
});

test('generator never mutates the input state', () => {
  const before = pricedState();
  const billsBefore = before.customers[0].bills;
  const generated = generateMonthlyBillsThroughCurrentMonth(before, NOV_2, [choice15Nov]);
  assert.equal(before.customers[0].bills, billsBefore, 'the input customer keeps its own bills array');
  assert.equal(billsBefore.length, 0);
  assert.ok(billFor(generated, 'seed-001', '2026-11'), 'the returned state carries the new bill instead');
});

test('addPayment with cycle choices raises the bill on the customer date', () => {
  let state = generateMonthlyBillsThroughCurrentMonth(pricedState(), OCT_29);
  state = addPayment(state, 'seed-001', '2026-11', { date: '2026-11-12', amount: '3000', method: 'Cash' }, NOV_12, { cycleChoices: [choice15Nov] });
  assert.equal(billFor(state, 'seed-001', '2026-11').dueDate, '2026-11-15');
  assert.equal(billFor(state, 'seed-001', '2026-11').payments.length, 1);
});

test('addPayment without cycle choices keeps the 5th default', () => {
  let state = generateMonthlyBillsThroughCurrentMonth(pricedState(), OCT_29);
  state = addPayment(state, 'seed-001', '2026-11', { date: '2026-11-12', amount: '3000', method: 'Cash' }, NOV_12);
  assert.equal(billFor(state, 'seed-001', '2026-11').dueDate, '2026-11-05');
});

test('Plan 11 pre-due queue reads the bill due date, so it uses the customer date', () => {
  const cycleDue = dueDateForBill({ choice: choice15Nov, month: '2026-11', existingDueDate: null });
  assert.equal(cycleDue, '2026-11-15');
  const queue = buildPreDueReminderQueue({
    today: '2026-11-13',
    windowDays: 3,
    bills: [{ customerId: 'seed-001', customerName: 'Cycle Customer', balanceDue: 3000, dueDate: cycleDue, billMonth: '2026-11' }],
  });
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.rows[0].dueDate, '2026-11-15');
  assert.equal(queue.rows[0].daysLeft, 2);
  const defaultQueue = buildPreDueReminderQueue({
    today: '2026-11-03',
    windowDays: 3,
    bills: [{ customerId: 'seed-002', customerName: 'Default Customer', balanceDue: 3000, dueDate: '2026-11-05', billMonth: '2026-11' }],
  });
  assert.equal(defaultQueue.rows[0].dueDate, '2026-11-05');
});
