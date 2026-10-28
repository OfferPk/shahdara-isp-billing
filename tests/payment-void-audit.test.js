// SISP-34: Wrong / Duplicate Payment Reversal (Void Receipt) &
// Cross-Ledger Rollback. Pure-function tests on synthetic data only.
// Pinned criterion: voiding a Rs. 3,000 Waseem Shop payment restores the
// customer's Rs. 3,000 balance, reduces Waseem Shop unsettled cash by
// Rs. 3,000, and logs the void record. Plus: void without a reason is
// refused, and the rollback is all-or-nothing (input state untouched on
// any failure).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VOIDED_PAYMENTS_KEY,
  voidPayment,
  loadVoidPayments,
  saveVoidPayments,
  sanitizeVoidPayments,
  isVoidedPayment
} from '../payment-void-audit.js';
import {
  addPayment,
  correctPayment,
  deletePayment,
  calculatePaymentAllocations,
  calculateMethodCollectionTotals,
  recordedAmount,
  summarizeCustomerReceipts,
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge
} from '../core.js';
import { buildShopSummaries } from '../shop-settlement.js';

function waseemState() {
  return {
    customers: [{
      id: 'c1',
      customerNumber: 1,
      name: 'Test Customer',
      bills: [{
        id: 'b1',
        month: '2026-10',
        status: 'received',
        dueAmount: 3000,
        payments: [{
          id: 'p1',
          date: '2026-10-02',
          amount: 3000,
          method: 'Cash at Waseem Abbasi shop'
        }]
      }]
    }]
  };
}

function balanceOf(state) {
  return calculatePaymentAllocations(state).forMonth('c1', '2026-10')?.balanceDueCents;
}

function waseemUnsettled(state) {
  const found = buildShopSummaries(state, []).find((s) => s.shop === 'Waseem Abbasi Shop');
  return found ? found.unsettled : 0;
}

test('PINNED: voiding a Rs. 3,000 Waseem Shop payment restores the Rs. 3,000 balance, drops Waseem unsettled cash by Rs. 3,000, and logs the void', () => {
  const state = waseemState();
  assert.equal(balanceOf(state), 0);
  assert.equal(waseemUnsettled(state), 3000);

  const { state: next, voidRecord } = voidPayment(state, 'c1', '2026-10', 'p1', {
    voidReason: 'Entered twice',
    voidedAt: '2026-10-28T09:00:00.000Z'
  });

  // Balance leg: the voided receipt no longer settles anything.
  assert.equal(balanceOf(next), 300000);
  // Shop leg: the voided receipt drops out of unsettled cash.
  assert.equal(waseemUnsettled(next), 0);
  // Original payment is preserved, marked — never deleted.
  const payment = next.customers[0].bills[0].payments[0];
  assert.equal(payment.voided, true);
  assert.equal(payment.voidedAt, '2026-10-28T09:00:00.000Z');
  assert.equal(payment.voidReason, 'Entered twice');
  assert.equal(isVoidedPayment(payment), true);
  assert.equal(next.customers[0].bills[0].payments.length, 1);
  // Void log record carries the full audit trail.
  assert.equal(voidRecord.paymentId, 'p1');
  assert.equal(voidRecord.customerId, 'c1');
  assert.equal(voidRecord.billMonth, '2026-10');
  assert.equal(voidRecord.amount, 3000);
  assert.equal(voidRecord.method, 'Cash at Waseem Abbasi shop');
  assert.equal(voidRecord.shop, 'Waseem Abbasi Shop');
  assert.equal(voidRecord.voidReason, 'Entered twice');
  assert.equal(voidRecord.promiseRestored, false);
  // Input state untouched (pure function).
  assert.equal(state.customers[0].bills[0].payments[0].voided, undefined);
  assert.equal(balanceOf(state), 0);
});

test('void without a reason is refused and changes nothing', () => {
  const state = waseemState();
  for (const bad of ['', '   ', undefined, null]) {
    assert.throws(
      () => voidPayment(state, 'c1', '2026-10', 'p1', bad === undefined || bad === null ? {} : { voidReason: bad }),
      /reason is required/i
    );
  }
  assert.equal(balanceOf(state), 0);
  assert.equal(waseemUnsettled(state), 3000);
  assert.equal(state.customers[0].bills[0].payments[0].voided, undefined);
});

test('void refuses unknown targets, double voids, and shop-settled payments — input untouched', () => {
  const state = waseemState();
  assert.throws(() => voidPayment(state, 'nope', '2026-10', 'p1', { voidReason: 'x' }), /Customer not found/);
  assert.throws(() => voidPayment(state, 'c1', '2026-09', 'p1', { voidReason: 'x' }), /Bill not found/);
  assert.throws(() => voidPayment(state, 'c1', '2026-10', 'nope', { voidReason: 'x' }), /Payment not found/);

  const { state: voided } = voidPayment(state, 'c1', '2026-10', 'p1', { voidReason: 'wrong customer' });
  assert.throws(() => voidPayment(voided, 'c1', '2026-10', 'p1', { voidReason: 'again' }), /already voided/);

  const settled = waseemState();
  settled.customers[0].bills[0].payments[0].shopSettledAmount = 3000;
  settled.customers[0].bills[0].payments[0].shopSettled = true;
  assert.throws(() => voidPayment(settled, 'c1', '2026-10', 'p1', { voidReason: 'x' }), /handed over/);
  assert.equal(settled.customers[0].bills[0].payments[0].voided, undefined);
});

test('void restores the Waada promise the payment had cleared — and never clobbers a newer promise', () => {
  // Customer with a promise + a priced bill; the payment settles in full,
  // so addPayment auto-clears the promise and stamps it on the payment.
  const base = {
    customers: [{
      id: 'c1',
      customerNumber: 1,
      name: 'Test Customer',
      promiseDate: '2026-11-05',
      promiseAmount: 3000,
      promiseNote: 'will pay on 5th',
      bills: [{ month: '2026-10', dueAmount: 3000, payments: [] }]
    }]
  };
  const paid = addPayment(base, 'c1', '2026-10', {
    date: '2026-10-02', amount: 3000, method: 'Cash'
  });
  const paidCustomer = paid.customers[0];
  assert.equal(paidCustomer.promiseDate, undefined);
  const payment = paidCustomer.bills.find((b) => b.month === '2026-10').payments[0];
  assert.deepEqual(payment.clearedWaada, {
    promiseDate: '2026-11-05',
    promiseAmount: 3000,
    promiseNote: 'will pay on 5th'
  });

  const { state: next, voidRecord } = voidPayment(paid, 'c1', '2026-10', payment.id, { voidReason: 'duplicate entry' });
  const restored = next.customers[0];
  assert.equal(restored.promiseDate, '2026-11-05');
  assert.equal(restored.promiseAmount, 3000);
  assert.equal(restored.promiseNote, 'will pay on 5th');
  assert.equal(voidRecord.promiseRestored, true);
  assert.equal(voidRecord.restoredPromiseDate, '2026-11-05');
  assert.equal(balanceOf(next), 300000);

  // Newer promise set after the clear: void must NOT overwrite it.
  const rePromised = JSON.parse(JSON.stringify(paid));
  rePromised.customers[0].promiseDate = '2026-12-01';
  rePromised.customers[0].promiseAmount = 1000;
  const { state: kept, voidRecord: keptRecord } = voidPayment(rePromised, 'c1', '2026-10', payment.id, { voidReason: 'duplicate entry' });
  assert.equal(kept.customers[0].promiseDate, '2026-12-01');
  assert.equal(keptRecord.promiseRestored, false);
});

test('voided payments stop counting as collected cash in receipts and method totals', () => {
  const before = waseemState();
  const billBefore = before.customers[0].bills[0];
  assert.equal(recordedAmount(billBefore), 3000);
  assert.equal(summarizeCustomerReceipts(before.customers[0]).total, 3000);
  assert.equal(calculateMethodCollectionTotals(before).total, 3000);

  const { state: next } = voidPayment(before, 'c1', '2026-10', 'p1', { voidReason: 'wrong amount' });
  const billAfter = next.customers[0].bills[0];
  assert.equal(recordedAmount(billAfter), 0);
  assert.equal(summarizeCustomerReceipts(next.customers[0]).total, 0);
  assert.equal(summarizeCustomerReceipts(next.customers[0]).receiptCount, 0);
  assert.equal(calculateMethodCollectionTotals(next).total, 0);
  assert.equal(calculateMethodCollectionTotals(next).cashTotal, 0);
});

test('void log storage round-trips and is sanitized', () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, v); }
  };
  assert.deepEqual(loadVoidPayments(storage), []);
  const record = {
    id: 'void-1', customerId: 'c1', customerNumber: 1, customerName: 'Test',
    billMonth: '2026-10', paymentId: 'p1', paymentDate: '2026-10-02',
    amount: 3000, method: 'Cash at Waseem Abbasi shop', shop: 'Waseem Abbasi Shop',
    voidReason: 'Entered twice', voidedAt: '2026-10-28T09:00:00.000Z',
    promiseRestored: false, restoredPromiseDate: '', createdAt: '2026-10-28T09:00:00.000Z'
  };
  assert.equal(saveVoidPayments([record, { paymentId: '', voidReason: '' }, null], storage), true);
  assert.deepEqual(loadVoidPayments(storage), [record]);
  assert.equal(store.get(VOIDED_PAYMENTS_KEY).includes('void-1'), true);
  assert.deepEqual(sanitizeVoidPayments('not-an-array'), []);
});

test('void log travels in JSON backups via settings.voidPayments (safe-merge)', () => {
  const record = {
    id: 'void-1', customerId: 'c1', customerNumber: 1, customerName: 'Test',
    billMonth: '2026-10', paymentId: 'p1', paymentDate: '2026-10-02',
    amount: 3000, method: 'Cash', shop: '', voidReason: 'duplicate',
    voidedAt: '2026-10-28T09:00:00.000Z', promiseRestored: false,
    restoredPromiseDate: '', createdAt: '2026-10-28T09:00:00.000Z'
  };
  // Full valid ledger state (initial state + the voided customer's bill),
  // because previewJsonBackupMerge validates the whole incoming state.
  const full = createInitialState();
  full.customers.push({
    id: 'cx-void', customerNumber: 999, name: 'Void Backup Customer',
    monthlyPriceSchedule: [], packageHistory: [], incidents: [],
    bills: [{
      id: 'b-void', month: '2026-10', status: 'received', dueAmount: 3000,
      payments: [{ id: 'p-void', date: '2026-10-02', amount: 3000, method: 'Cash' }]
    }]
  });
  const text = createJsonBackup(full, new Date('2026-10-28T09:00:00.000Z'), { voidPayments: [record] });
  const document = JSON.parse(text);
  assert.deepEqual(document.settings.voidPayments, [record]);
  assert.ok(document.checksum, 'checksum stamp covers the new section');

  const preview = previewJsonBackupMerge(full, text, {
    currentVoidPayments: [], currentVoidPaymentsStored: false
  });
  assert.deepEqual(preview.voidPayments, [record]);
  assert.equal(preview.counts.voidPaymentsRestored, 1);

  // Device already holds different voids: keep existing + conflict.
  const other = { ...record, id: 'void-2', paymentId: 'p9' };
  const conflicted = previewJsonBackupMerge(full, text, {
    currentVoidPayments: [other], currentVoidPaymentsStored: true
  });
  assert.equal(conflicted.voidPayments, null);
  assert.ok(conflicted.conflicts.some((c) => String(c.field).includes('Voided payment')));
});

test('correcting or deleting a voided payment is refused (voided rows are frozen)', () => {
  const { state: next } = voidPayment(waseemState(), 'c1', '2026-10', 'p1', { voidReason: 'wrong customer' });
  assert.throws(
    () => correctPayment(next, 'c1', '2026-10', 'p1', { date: '2026-10-03', amount: 2500, method: 'Cash' }),
    /Cannot correct a voided payment/
  );
  assert.throws(() => deletePayment(next, 'c1', '2026-10', 'p1'), /Cannot delete a voided payment/);
  assert.equal(next.customers[0].bills[0].payments[0].voided, true);
});
