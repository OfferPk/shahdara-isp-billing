// Sharafat 61 — Delete refuses a shop-settled payment, like void does.
//
// voidPayment refuses any payment whose cash was already handed over from a
// shop ("Reverse the shop handover first, then void"). deletePayment had no
// such check, so deleting a handed-over receipt left the shop settlement's
// allocations pointing at a payment that no longer exists — including via
// the Quick Collect undo path, which shares deletePayment.
//
// The guard lives in core.js deletePayment (after the voided guard,
// alongside ticket/addon/waiver), reusing the file-local
// shopSettledAmountOf helper: any settled amount, even partial, refuses.
// Pattern-fake data only — no real customer names or phone numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deletePayment } from '../core.js';
import { reverseCollectedPayment } from '../quick-undo-toast.js';

const MONTH = '2026-10';
const SHOP_MSG = 'This payment was already handed over from the shop and cannot be deleted. Reverse the shop handover first, then delete.';

function stateWith(payment) {
  return {
    customers: [{
      id: 'cust-1', customerNumber: 101, name: 'Test Customer',
      phone: '03012345678', archived: false,
      bills: [{
        id: 'bill-2026-10', month: MONTH, status: 'received', dueAmount: 3000,
        payments: [payment]
      }]
    }]
  };
}

const base = { id: 'p1', date: '2026-10-02', amount: 3000, method: 'Cash at Test Shop' };
const paymentsOf = (state) => state.customers[0].bills[0].payments;

test('fully shop-settled payment cannot be deleted (exact message)', () => {
  const state = stateWith({ ...base, shopSettled: true, shopSettledAmount: 3000, settlementIds: ['set-1'] });
  assert.throws(() => deletePayment(state, 'cust-1', MONTH, 'p1'), (err) => err.message === SHOP_MSG);
});

test('partially shop-settled payment cannot be deleted either', () => {
  const state = stateWith({ ...base, shopSettledAmount: 1500, settlementIds: ['set-1'] });
  assert.throws(() => deletePayment(state, 'cust-1', MONTH, 'p1'), (err) => err.message === SHOP_MSG);
});

test('a PKR 1 settled slice blocks the delete too', () => {
  const state = stateWith({ ...base, shopSettledAmount: 1, settlementIds: ['set-1'] });
  assert.throws(() => deletePayment(state, 'cust-1', MONTH, 'p1'), (err) => err.message === SHOP_MSG);
});

test('normal payment still deletes, and the payment is gone', () => {
  const state = stateWith({ ...base });
  const after = deletePayment(state, 'cust-1', MONTH, 'p1');
  assert.equal(paymentsOf(after).length, 0);
  // Input untouched (pure).
  assert.equal(paymentsOf(state).length, 1);
});

test('settlementIds alone with a zero settled amount does not block', () => {
  const state = stateWith({ ...base, shopSettledAmount: 0, settlementIds: ['set-1'] });
  const after = deletePayment(state, 'cust-1', MONTH, 'p1');
  assert.equal(paymentsOf(after).length, 0);
});

test('voided + settled: the voided message still wins (guard order)', () => {
  const state = stateWith({ ...base, voided: true, shopSettled: true, shopSettledAmount: 3000, settlementIds: ['set-1'] });
  assert.throws(
    () => deletePayment(state, 'cust-1', MONTH, 'p1'),
    (err) => err.message === 'Cannot delete a voided payment. Voided receipts are kept as history.'
  );
});

test('settled + ticket charge: the shop-settled message wins (guard sits before ticket)', () => {
  const state = stateWith({
    ...base, shopSettled: true, shopSettledAmount: 3000, settlementIds: ['set-1'],
    ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }]
  });
  assert.throws(() => deletePayment(state, 'cust-1', MONTH, 'p1'), (err) => err.message === SHOP_MSG);
});

test('existing guards still refuse: ticket charge', () => {
  const state = stateWith({ ...base, ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }] });
  assert.throws(
    () => deletePayment(state, 'cust-1', MONTH, 'p1'),
    (err) => err.message === 'This payment settled a ticket charge. Void it instead so the ticket charge reopens.'
  );
});

test('existing guards still refuse: speed boost charge', () => {
  const state = stateWith({ ...base, addonCharges: [{ boostId: 'BST-101', amount: 500 }] });
  assert.throws(
    () => deletePayment(state, 'cust-1', MONTH, 'p1'),
    (err) => err.message === 'This payment settled a speed boost charge. Void it instead so the boost charge reopens.'
  );
});

test('existing guards still refuse: waived late fee', () => {
  const state = stateWith({
    ...base, lateFeeWaived: true, waivedAmount: 150,
    waivedLateFee: { month: MONTH, lateFee: 150, lateFeeAppliedAt: '2026-10-01T00:00:00.000Z', lateFeeReason: 'Test waiver' }
  });
  assert.throws(
    () => deletePayment(state, 'cust-1', MONTH, 'p1'),
    (err) => err.message === 'This payment waived a late fee. Void it instead so the late fee is restored.'
  );
});

test('QC undo path: reverseCollectedPayment throws on a shop-settled payment', () => {
  const state = stateWith({ ...base, shopSettled: true, shopSettledAmount: 3000, settlementIds: ['set-1'] });
  assert.throws(
    () => reverseCollectedPayment({ state, tickets: [], customerId: 'cust-1', paymentId: 'p1' }),
    (err) => err.message === SHOP_MSG
  );
});

test('QC undo path: reverseCollectedPayment still works on a normal payment', () => {
  const state = stateWith({ ...base });
  const out = reverseCollectedPayment({ state, tickets: [], customerId: 'cust-1', paymentId: 'p1' });
  assert.equal(out.nextState.customers[0].bills[0].payments.length, 0);
  assert.equal(out.month, MONTH);
});
