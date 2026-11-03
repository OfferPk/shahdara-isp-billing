import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addCustomer,
  saveBillMonth,
  addPayment,
  findDuplicatePaymentReference,
} from '../core.js';
import { voidPayment } from '../payment-void-audit.js';

const MONTH = '2026-10';
const REF = new Date('2026-10-20');

function setup() {
  let state = { customers: [] };
  state = addCustomer(state, 'Void TID Alpha', REF, { phone: '03001111111', area: 'Main Bazaar' });
  state = addCustomer(state, 'Void TID Beta', REF, { phone: '03002222222', area: 'Main Bazaar' });
  const a = state.customers[0];
  const b = state.customers[1];
  state = saveBillMonth(state, a.id, { month: MONTH, dueAmount: 2000, status: 'pending' }, REF);
  state = saveBillMonth(state, b.id, { month: MONTH, dueAmount: 2000, status: 'pending' }, REF);
  return { state, a, b };
}

function record(state, customerId, tid) {
  const next = addPayment(state, customerId, MONTH, {
    date: '2026-10-15', amount: 2000, method: 'JazzCash', transactionId: tid,
  }, REF);
  const bill = next.customers.find((c) => c.id === customerId).bills.find((x) => x.month === MONTH);
  return { state: next, payment: bill.payments[bill.payments.length - 1] };
}

test('CP-01: a live TID is still reported as a duplicate', () => {
  const { state, a } = setup();
  const { state: next } = record(state, a.id, 'TXN-CP01-111');
  const dup = findDuplicatePaymentReference(next, 'TXN-CP01-111');
  assert.ok(dup);
  assert.equal(dup.customerId, a.id);
  assert.equal(dup.amount, 2000);
});

test('CP-01: a voided TID no longer blocks re-recording', () => {
  const { state, a } = setup();
  const { state: recorded, payment } = record(state, a.id, 'TXN-CP01-222');
  assert.ok(findDuplicatePaymentReference(recorded, 'TXN-CP01-222'));
  const { state: voided } = voidPayment(recorded, a.id, MONTH, payment.id, { voidReason: 'Wrong entry (test)' });
  assert.equal(findDuplicatePaymentReference(voided, 'TXN-CP01-222'), null);
  // Case/whitespace normalisation must not resurrect the voided TID.
  assert.equal(findDuplicatePaymentReference(voided, '  txn-cp01-222  '), null);
});

test('CP-01: after a void, the same TID recorded live is found again', () => {
  const { state, a, b } = setup();
  const { state: recorded, payment } = record(state, a.id, 'TXN-CP01-333');
  const { state: voided } = voidPayment(recorded, a.id, MONTH, payment.id, { voidReason: 'Wrong entry (test)' });
  const { state: reRecorded } = record(voided, b.id, 'TXN-CP01-333');
  const dup = findDuplicatePaymentReference(reRecorded, 'TXN-CP01-333');
  assert.ok(dup);
  assert.equal(dup.customerId, b.id);
});

test('CP-01: excludePaymentId still works for a live payment', () => {
  const { state, a } = setup();
  const { state: recorded, payment } = record(state, a.id, 'TXN-CP01-444');
  assert.equal(findDuplicatePaymentReference(recorded, 'TXN-CP01-444', payment.id), null);
  assert.ok(findDuplicatePaymentReference(recorded, 'TXN-CP01-444'));
});
