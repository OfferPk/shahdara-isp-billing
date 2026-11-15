import test from 'node:test';
import assert from 'node:assert/strict';

import { findCandidateBillMonth, recordInboxPayment } from '../payments-inbox.js';
import { calculatePaymentAllocations } from '../core.js';

// Sharafat 55 — findCandidateBillMonth must use the allocation engine's
// balanceDueCents per month (the figure Quick Collect already uses), not
// the dueAmount-vs-payments comparison, which cannot see late fees,
// concessions, referral/feeder credits or FIFO credit.
//
// The correction runs BOTH ways: a late-fee month is rescued (test 2),
// while concession / referral / FIFO-covered months stop being picked
// (tests 3–5). The stored-status arm is dropped, so a stale 'pending'
// status no longer overrides a zero balance (tests 6–7). Unpriced bills
// have no balance figure (null) and are skipped (test 8). A dateless
// payment throws inside the engine order-dependently, so the function
// falls back to the old comparison instead of breaking the record
// (test 9). The payment-date month fallback is unchanged (test 1).

// Setup Mock LocalStorage for Node test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new MockLocalStorage();
}

const refDate = new Date('2026-10-20T12:00:00Z');
const P = (amount, date = '2026-10-05', id = 'p1') => ({ id, amount, date, method: 'Cash' });

test('Sharafat 55: control pins survive — earliest unpaid and fully-paid fallback', () => {
  const customerWithDues = {
    id: 'c1',
    bills: [
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' },
      { month: '2026-09', dueAmount: 2000, payments: [], status: 'pending' },
      { month: '2026-08', dueAmount: 2000, payments: [{ amount: 2000 }], status: 'paid' }
    ]
  };

  // Earliest unpaid is 2026-09 (engine agrees: Sep/Oct balance 200000, Aug 0)
  assert.equal(findCandidateBillMonth(customerWithDues, '2026-10-20', refDate), '2026-09');

  const fullyPaidCustomer = {
    id: 'c2',
    bills: [
      { month: '2026-10', dueAmount: 2000, payments: [{ amount: 2000 }], status: 'paid' }
    ]
  };

  // Fallback to transaction date's month (engine: Oct balance 0)
  assert.equal(findCandidateBillMonth(fullyPaidCustomer, '2026-10-20', refDate), '2026-10');
});

test('Sharafat 55: bill fully paid on principal but late fee outstanding → that bill month', () => {
  const customer = {
    id: 'c3',
    bills: [
      { month: '2026-09', dueAmount: 2000, payments: [P(2000, '2026-09-05')], status: 'paid', lateFee: 100 },
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' }
    ]
  };

  // Engine: Sep balanceDueCents is 10000 (the PKR 100 late fee), Oct 200000.
  // The old comparison read Sep as settled and returned 2026-10.
  assert.equal(findCandidateBillMonth(customer, '2026-10-20', refDate), '2026-09');
});

test('Sharafat 55: concession-covered balance is not picked → next unpaid month', () => {
  const customer = {
    id: 'c4',
    bills: [
      { month: '2026-09', dueAmount: 2000, payments: [P(1500, '2026-09-05')], status: 'pending', concessionAmount: 500 },
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' }
    ]
  };

  // Engine: Sep balanceDueCents is 0 (the 500 concession covers the gap).
  // The old comparison saw due 2000 > paid 1500 and returned 2026-09.
  assert.equal(findCandidateBillMonth(customer, '2026-10-20', refDate), '2026-10');
});

test('Sharafat 55: referral-credit-covered balance is not picked → next unpaid month', () => {
  const customer = {
    id: 'c5',
    bills: [
      { month: '2026-09', dueAmount: 2000, payments: [P(1500, '2026-09-05')], status: 'pending', referralCreditAmount: 500 },
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' }
    ]
  };

  // Engine: Sep balanceDueCents is 0. The old comparison returned 2026-09.
  assert.equal(findCandidateBillMonth(customer, '2026-10-20', refDate), '2026-10');
});

test('Sharafat 55: FIFO credit from an overpaid earlier month covers the gap → next unpaid month', () => {
  const customer = {
    id: 'c6',
    bills: [
      { month: '2026-08', dueAmount: 2000, payments: [P(2500, '2026-08-05')], status: 'paid' },
      { month: '2026-09', dueAmount: 2000, payments: [P(1500, '2026-09-05')], status: 'pending' },
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' }
    ]
  };

  // Engine: the 500 Aug excess carries forward, so Sep balanceDueCents is 0.
  // The old comparison saw Sep due 2000 > paid 1500 and returned 2026-09.
  assert.equal(findCandidateBillMonth(customer, '2026-10-20', refDate), '2026-10');
});

test('Sharafat 55: credit-covered bill with status pending is not picked → next unpaid month', () => {
  const customer = {
    id: 'c7',
    bills: [
      { month: '2026-09', dueAmount: 2000, payments: [P(2000, '2026-09-05')], status: 'pending', referralCreditAmount: 500 },
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' }
    ]
  };

  // The fixture MUST use status 'pending': with status 'paid' the old code
  // already returned 2026-10, so the test would not discriminate. With
  // 'pending' the old stored-status arm returned 2026-09; the engine says
  // Sep balanceDueCents is 0 (the 500 excess flows forward to Oct: 150000).
  assert.equal(findCandidateBillMonth(customer, '2026-10-20', refDate), '2026-10');
});

test('Sharafat 55: stale pending status on a fully-paid bill no longer overrides a zero balance', () => {
  const customer = {
    id: 'c8',
    bills: [
      { month: '2026-09', dueAmount: 2000, payments: [P(2000, '2026-09-05')], status: 'pending' },
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' }
    ]
  };

  // Engine: Sep balanceDueCents is 0. The old `|| b.status === 'pending'`
  // arm returned 2026-09 for this bill even though it is fully paid.
  assert.equal(findCandidateBillMonth(customer, '2026-10-20', refDate), '2026-10');
});

test('Sharafat 55: unpriced bill is skipped — its receipts become forward credit', () => {
  const customer = {
    id: 'c9',
    bills: [
      { month: '2026-09', dueAmount: null, payments: [P(2000, '2026-09-05')], status: 'pending' },
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' }
    ]
  };

  // Engine: Sep balanceDueCents is null (unpriced bills carry no balance
  // figure) and the 2000 receipt becomes forward credit, so Oct is 0 too.
  // Both months are skipped and the pick falls back to the payment date's
  // month. The old code returned 2026-09 via the stored-status arm.
  const allocs = calculatePaymentAllocations({ customers: [customer] });
  assert.equal(allocs.forMonth(customer.id, '2026-09')?.balanceDueCents, null);
  assert.equal(allocs.forMonth(customer.id, '2026-10')?.balanceDueCents, 0);
  assert.equal(findCandidateBillMonth(customer, '2026-10-20', refDate), '2026-10');
});

test('Sharafat 55: dateless payment (second of two) falls back to the old comparison, not a throw', () => {
  const customer = {
    id: 'c10',
    bills: [
      { month: '2026-09', dueAmount: 2000, payments: [P(1000, '2026-09-05', 'p1'), { id: 'p2', amount: 1000 }], status: 'pending' },
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' }
    ]
  };

  // The engine throws on this data (the dateless payment sorts as the left
  // operand) — a single dateless payment would not throw, so the fixture
  // needs two payments with the dateless one second. The function must not
  // throw: it falls back to the old comparison, which returns 2026-09 via
  // the stored-status arm (due 2000 is not greater than paid 2000).
  assert.doesNotThrow(() => findCandidateBillMonth(customer, '2026-10-20', refDate));
  assert.equal(findCandidateBillMonth(customer, '2026-10-20', refDate), '2026-09');
});

test('Sharafat 55: recording a payment with no explicit month lands on the late-fee bill month', () => {
  const customer = {
    id: 'c3', customerNumber: '103', name: 'Late Fee Customer', phone: '03012345678', archived: false,
    bills: [
      { month: '2026-09', dueAmount: 2000, payments: [P(2000, '2026-09-05', 'p-sep')], status: 'paid', lateFee: 100 },
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' }
    ]
  };
  const state = { customers: [customer] };
  const txn = { txnId: '57255284000', amount: 100, date: '2026-10-20', direction: 'Received', senderName: 'Late Fee Customer', senderNumber: '03012345678' };

  const res = recordInboxPayment({ state, txn, customerId: 'c3', referenceDate: refDate });

  // The 100 PKR settles the September late fee instead of landing on October.
  assert.equal(res.txn.recordedMonth, '2026-09');
  const allocsAfter = calculatePaymentAllocations(res.nextState);
  assert.equal(allocsAfter.forMonth('c3', '2026-09')?.balanceDueCents, 0);
  assert.equal(allocsAfter.forMonth('c3', '2026-10')?.balanceDueCents, 200000);
});
