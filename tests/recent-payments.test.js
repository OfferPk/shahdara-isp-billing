/**
 * recent-payments.test.js — Owner feature (2026-10-29): Dashboard
 * "Recent Payments" card builder.
 *
 * Pins: latest-5 selection + ordering across customers, voided-payment
 * exclusion (SISP-34) with the 6th-latest filling the gap, field
 * mapping (name / method / amount / stored receipt reference only),
 * same-date tie-break by ledger traversal order, and the empty ledger.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecentPayments, RECENT_PAYMENTS_LIMIT } from '../recent-payments.js';

function payment(id, date, amount, method, extra = {}) {
  return { id, date, amount, method, ...extra };
}

function customer(id, customerNumber, name, bills, extra = {}) {
  return { id, customerNumber, name, bills, ...extra };
}

function bill(month, payments) {
  return { id: `bill-${month}`, month, dueAmount: 1500, status: 'paid', payments };
}

/** Seven payments across three customers, newest = p7 (2026-10-28). */
function seededState() {
  return {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [
        bill('2026-09', [payment('p1', '2026-09-05', 1500, 'Cash', { receiptNumber: 'RCPT-1-202609-01' })]),
        bill('2026-10', [payment('p5', '2026-10-20', 1500, 'Cash', { receiptNumber: 'RCPT-1-202610-01' })])
      ]),
      customer('cust-b', 2, 'Kamran Iqbal', [
        bill('2026-09', [payment('p2', '2026-09-09', 2000, 'Bank Transfer')]),
        bill('2026-10', [
          payment('p4', '2026-10-11', 2500, 'JazzCash', { receiptNumber: 'RCPT-2-202610-01' }),
          payment('p7', '2026-10-28', 1500, 'Cash at Balla shop', { permanentReceiptNumber: 'REC-2610-0002-AB12' })
        ])
      ]),
      customer('cust-c', 3, 'Fatima Ali', [
        bill('2026-09', [payment('p3', '2026-09-15', 1500, 'Easypaisa')]),
        bill('2026-10', [payment('p6', '2026-10-25', 3000, 'Raast', { receiptNumber: 'RCPT-3-202610-01' })])
      ])
    ]
  };
}

test('returns exactly the latest 5 payments across customers, newest first', () => {
  const rows = buildRecentPayments(seededState());
  assert.equal(RECENT_PAYMENTS_LIMIT, 5);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(r => r.paymentId), ['p7', 'p6', 'p5', 'p4', 'p3']);
  assert.deepEqual(rows.map(r => r.date), ['2026-10-28', '2026-10-25', '2026-10-20', '2026-10-11', '2026-09-15']);
});

test('maps name, method, amount and customer identity onto each row', () => {
  const rows = buildRecentPayments(seededState());
  const first = rows[0];
  assert.equal(first.customerId, 'cust-b');
  assert.equal(first.customerNumber, 2);
  assert.equal(first.customerName, 'Kamran Iqbal');
  assert.equal(first.method, 'Cash at Balla shop');
  assert.equal(first.amount, 1500);
  assert.equal(first.month, '2026-10');
  const second = rows[1];
  assert.equal(second.customerName, 'Fatima Ali');
  assert.equal(second.method, 'Raast');
  assert.equal(second.amount, 3000);
});

test('receiptRef is the stored reference only — receiptNumber, else permanentReceiptNumber, else empty', () => {
  const rows = buildRecentPayments(seededState());
  const byId = Object.fromEntries(rows.map(r => [r.paymentId, r]));
  assert.equal(byId.p7.receiptRef, 'REC-2610-0002-AB12');
  assert.equal(byId.p6.receiptRef, 'RCPT-3-202610-01');
  assert.equal(byId.p5.receiptRef, 'RCPT-1-202610-01');
  // p3 carries no stored reference: the builder must NOT invent one.
  assert.equal(byId.p3.receiptRef, '');
});

test('a voided payment among the latest is excluded and the 6th-latest fills its place', () => {
  const state = seededState();
  // Void the newest payment (p7, 2026-10-28) the SISP-34 way.
  state.customers[1].bills[1].payments[1] = {
    ...state.customers[1].bills[1].payments[1],
    voided: true,
    voidedAt: '2026-10-29T09:00:00.000Z',
    voidReason: 'Duplicate entry'
  };
  const rows = buildRecentPayments(state);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(r => r.paymentId), ['p6', 'p5', 'p4', 'p3', 'p2']);
  assert.ok(!rows.some(r => r.paymentId === 'p7'));
});

test('same-date ties break by ledger traversal order — later-recorded payment first', () => {
  const state = {
    customers: [
      customer('cust-a', 1, 'Ahmed Khan', [
        bill('2026-10', [payment('early', '2026-10-10', 1500, 'Cash')])
      ]),
      customer('cust-b', 2, 'Kamran Iqbal', [
        bill('2026-10', [payment('late', '2026-10-10', 1500, 'Cash')])
      ])
    ]
  };
  const rows = buildRecentPayments(state);
  assert.deepEqual(rows.map(r => r.paymentId), ['late', 'early']);
});

test('payments of archived customers still count (money received is received)', () => {
  const state = {
    customers: [
      customer('cust-z', 9, 'Old Customer', [
        bill('2026-10', [payment('pz', '2026-10-27', 1800, 'Cash')])
      ], { archived: true })
    ]
  };
  const rows = buildRecentPayments(state);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].paymentId, 'pz');
});

test('empty and malformed ledgers return an empty array', () => {
  assert.deepEqual(buildRecentPayments({ customers: [] }), []);
  assert.deepEqual(buildRecentPayments({}), []);
  assert.deepEqual(buildRecentPayments(null), []);
  assert.deepEqual(buildRecentPayments({ customers: [customer('c1', 1, 'No Bills', [])] }), []);
  const noDates = {
    customers: [
      customer('c2', 2, 'Dateless', [bill('2026-10', [{ id: 'px', amount: 100, method: 'Cash' }])])
    ]
  };
  assert.deepEqual(buildRecentPayments(noDates), []);
});

test('limit parameter is honoured', () => {
  const rows = buildRecentPayments(seededState(), 3);
  assert.deepEqual(rows.map(r => r.paymentId), ['p7', 'p6', 'p5']);
});
