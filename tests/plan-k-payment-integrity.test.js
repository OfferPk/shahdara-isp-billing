// Plan K — Payment integrity and audit.
// (1) correctPayment amount/date corrections append an append-only
// correctionHistory entry (previous values + correctedAt), carried
// across later corrections; voided payments still cannot be corrected.
// (2) A voided payment's receipt (HTML + PNG) stamps VOID and never
// shows PAID, while money totals stay driven by the ledger alone.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addCustomer,
  saveBillMonth,
  addPayment,
  correctPayment,
  calculatePaymentAllocations,
  createJsonBackup,
} from '../core.js';
import { voidPayment } from '../payment-void-audit.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { decideSeal, buildPngReceiptModel } from '../png-receipt.js';

const MONTH = '2026-10';
const REF = new Date('2026-10-20');

function setup() {
  let state = { customers: [] };
  state = addCustomer(state, 'Plan K Customer', REF, { phone: '03001111111', area: 'Main Bazaar' });
  const customer = state.customers[0];
  state = saveBillMonth(state, customer.id, { month: MONTH, dueAmount: 2000, status: 'pending' }, REF);
  return { state, customerId: customer.id };
}

function record(state, customerId, fields) {
  const next = addPayment(state, customerId, MONTH, {
    date: '2026-10-15', amount: 2000, method: 'Cash', ...fields,
  }, REF);
  const bill = next.customers.find((c) => c.id === customerId).bills.find((b) => b.month === MONTH);
  return { state: next, payment: bill.payments[bill.payments.length - 1] };
}

function paymentOf(state, customerId, paymentId) {
  return state.customers.find((c) => c.id === customerId).bills
    .find((b) => b.month === MONTH).payments.find((p) => p.id === paymentId);
}

function correct(state, customerId, paymentId, fields, ref = new Date('2026-10-21')) {
  return correctPayment(state, customerId, MONTH, paymentId, fields, ref);
}

// --- correctionHistory -------------------------------------------------

test('Plan K: an amount correction appends a correctionHistory entry with previous and new values', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const corrected = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash' });
  const after = paymentOf(corrected, customerId, payment.id);
  assert.equal(after.amount, 2500);
  assert.equal(after.correctionHistory.length, 1);
  assert.equal(after.correctionHistory[0].previousAmount, 2000);
  assert.equal(after.correctionHistory[0].previousDate, '2026-10-15');
  assert.equal(after.correctionHistory[0].newAmount, 2500);
  assert.equal(after.correctionHistory[0].newDate, '2026-10-15');
  assert.equal(after.correctionHistory[0].correctedAt, new Date('2026-10-21').toISOString());
});

test('Plan K: a date-only correction appends an entry (amount fields repeat the unchanged amount)', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const corrected = correct(recorded, customerId, payment.id, { date: '2026-10-16', amount: 2000, method: 'Cash' });
  const after = paymentOf(corrected, customerId, payment.id);
  assert.equal(after.date, '2026-10-16');
  assert.equal(after.correctionHistory.length, 1);
  assert.equal(after.correctionHistory[0].previousDate, '2026-10-15');
  assert.equal(after.correctionHistory[0].newDate, '2026-10-16');
  assert.equal(after.correctionHistory[0].previousAmount, 2000);
  assert.equal(after.correctionHistory[0].newAmount, 2000);
});

test('Plan K: a second correction carries the first entry and appends the second, chained on intermediate values', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const once = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash' });
  const twice = correct(once, customerId, payment.id, { date: '2026-10-17', amount: 1800, method: 'Cash' }, new Date('2026-10-22'));
  const after = paymentOf(twice, customerId, payment.id);
  assert.equal(after.correctionHistory.length, 2);
  assert.equal(after.correctionHistory[0].previousAmount, 2000);
  assert.equal(after.correctionHistory[0].newAmount, 2500);
  assert.equal(after.correctionHistory[1].previousAmount, 2500);
  assert.equal(after.correctionHistory[1].previousDate, '2026-10-15');
  assert.equal(after.correctionHistory[1].newAmount, 1800);
  assert.equal(after.correctionHistory[1].newDate, '2026-10-17');
  assert.equal(after.correctionHistory[1].correctedAt, new Date('2026-10-22').toISOString());
});

test('Plan K: a discount-only correction adds no entry but carries prior history verbatim', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const once = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash' });
  const again = correct(once, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash', discount: 100, discountReason: 'Owner concession' });
  const after = paymentOf(again, customerId, payment.id);
  assert.equal(after.correctionHistory.length, 1);
  assert.equal(after.correctionHistory[0].previousAmount, 2000);
  assert.equal(after.discount, 100);
});

test('Plan K: a channel-only correction adds no correctionHistory entry (the channel has its own methodCorrections trail)', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId, { method: 'JazzCash', transactionId: 'TXN-PLAN-K-1' });
  const corrected = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 2000, method: 'Cash' });
  const after = paymentOf(corrected, customerId, payment.id);
  assert.equal(after.correctionHistory, undefined);
  assert.equal(after.methodCorrections.length, 1);
  assert.equal(after.methodCorrections[0].fromMethod, 'JazzCash');
  assert.equal(after.methodCorrections[0].toMethod, 'Cash');
});

test('Plan K: a no-op correction (same amount and date) adds no entry', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const corrected = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 2000, method: 'Cash' });
  const after = paymentOf(corrected, customerId, payment.id);
  assert.equal(after.correctionHistory, undefined);
});

test('Plan K: correcting does not mutate the input state (the original payment carries no history)', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash' });
  assert.equal(paymentOf(recorded, customerId, payment.id).correctionHistory, undefined);
});

test('Plan K: a voided payment still cannot be corrected, and its record is untouched', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const { state: voided } = voidPayment(recorded, customerId, MONTH, payment.id, { voidReason: 'Wrong entry (test)' });
  assert.throws(
    () => correct(voided, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash' }),
    /voided/i,
  );
  const after = paymentOf(voided, customerId, payment.id);
  assert.equal(after.voided, true);
  assert.equal(after.amount, 2000);
  assert.equal(after.correctionHistory, undefined);
});

test('Plan K: corrections made before a void survive the void (history is frozen, not erased)', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const corrected = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash' });
  const { state: voided } = voidPayment(corrected, customerId, MONTH, payment.id, { voidReason: 'Wrong entry (test)' });
  const after = paymentOf(voided, customerId, payment.id);
  assert.equal(after.voided, true);
  assert.equal(after.correctionHistory.length, 1);
  assert.equal(after.correctionHistory[0].previousAmount, 2000);
});

test('Plan K: history survives a later channel change (carried, not reset, and no duplicate entry)', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId, { method: 'JazzCash', transactionId: 'TXN-PLAN-K-2' });
  const corrected = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'JazzCash' });
  const moved = correct(corrected, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash' });
  const after = paymentOf(moved, customerId, payment.id);
  assert.equal(after.correctionHistory.length, 1);
  assert.equal(after.methodCorrections.length, 1);
  assert.equal(after.methodCorrections[0].toMethod, 'Cash');
});

test('Plan K: correcting one month never touches another month payment history', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const otherMonth = '2026-09';
  let withOther = saveBillMonth(recorded, customerId, { month: otherMonth, dueAmount: 2000, status: 'pending' }, REF);
  withOther = addPayment(withOther, customerId, otherMonth, { date: '2026-09-15', amount: 2000, method: 'Cash' }, REF);
  const otherPayment = withOther.customers.find((c) => c.id === customerId).bills
    .find((b) => b.month === otherMonth).payments[0];
  const corrected = correct(withOther, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash' });
  assert.equal(paymentOf(corrected, customerId, payment.id).correctionHistory.length, 1);
  const otherAfter = corrected.customers.find((c) => c.id === customerId).bills
    .find((b) => b.month === otherMonth).payments.find((p) => p.id === otherPayment.id);
  assert.equal(otherAfter.correctionHistory, undefined);
});

test('Plan K: correctionHistory travels in a JSON backup with the payment', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const corrected = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 2500, method: 'Cash' });
  const backup = JSON.parse(createJsonBackup(corrected, new Date('2026-10-21')));
  const backed = backup.state.customers.find((c) => c.id === customerId).bills
    .find((b) => b.month === MONTH).payments.find((p) => p.id === payment.id);
  assert.equal(backed.correctionHistory.length, 1);
  assert.equal(backed.correctionHistory[0].previousAmount, 2000);
});

test('Plan K: voiding a corrected payment restores the full balance (the void, not the correction, is the last word)', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const corrected = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 1500, method: 'Cash' });
  assert.equal(calculatePaymentAllocations(corrected).forMonth(customerId, MONTH).balanceDueCents, 50000);
  const { state: voided } = voidPayment(corrected, customerId, MONTH, payment.id, { voidReason: 'Wrong entry (test)' });
  assert.equal(calculatePaymentAllocations(voided).forMonth(customerId, MONTH).balanceDueCents, 200000);
});

test('Plan K: totals follow the corrected ledger, not the original amount', () => {
  const { state, customerId } = setup();
  const { state: recorded, payment } = record(state, customerId);
  const corrected = correct(recorded, customerId, payment.id, { date: '2026-10-15', amount: 1500, method: 'Cash' });
  const summary = calculatePaymentAllocations(corrected).forMonth(customerId, MONTH);
  assert.equal(summary.balanceDueCents, 50000);
});

// --- VOID receipts ------------------------------------------------------

function receiptFixture({ dueAmount = 2000, payments = [], month = '2026-08' } = {}) {
  const bill = { id: `bill-${month}`, month, dueAmount, status: 'pending', payments };
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer',
    packageSpeed: '5 Mbps', packageHistory: [], bills: [bill],
  };
  return { customer, bill };
}

const pay = (id, amount, date, extra = {}) => ({ id, amount, date, method: 'Cash', ...extra });

test('Plan K: a voided sole payment receipt is VOID, never PAID, with the full balance still due', () => {
  const voided = pay('void-1', 2000, '2026-08-07', { voided: true, voidedAt: '2026-08-08', voidReason: 'Wrong entry' });
  const { customer, bill } = receiptFixture({ payments: [voided] });
  const receipt = buildPaymentReceipt(customer, bill, voided);
  assert.equal(receipt.status, 'VOID');
  assert.equal(receipt.balanceDueCents, 200000);
});

test('Plan K: a voided payment is VOID even when sibling payments fully cleared the bill (the pre-K bug showed PAID/CREDIT RECEIVED)', () => {
  const live = pay('live-1', 2000, '2026-08-05');
  const voided = pay('void-2', 2000, '2026-08-09', { voided: true, voidedAt: '2026-08-10', voidReason: 'Duplicate' });
  const { customer, bill } = receiptFixture({ payments: [live, voided] });
  const receipt = buildPaymentReceipt(customer, bill, voided);
  assert.equal(receipt.status, 'VOID');
  // The live sibling's own receipt is unaffected by the voided row.
  assert.equal(buildPaymentReceipt(customer, bill, live).status, 'PAID');
});

test('Plan K: a voided payment on an unpriced bill is VOID, not the default RECEIVED', () => {
  const voided = pay('void-0', 2000, '2026-08-07', { voided: true, voidedAt: '2026-08-08', voidReason: 'Wrong entry' });
  const { customer, bill } = receiptFixture({ dueAmount: null, payments: [voided] });
  assert.equal(buildPaymentReceipt(customer, bill, voided).status, 'VOID');
});

test('Plan K: a voided payment receipt never shows PAID in any HTML layout, and carries the VOID stamp', () => {
  const voided = pay('void-3', 2000, '2026-08-07', { voided: true, voidedAt: '2026-08-08', voidReason: 'Wrong entry' });
  const { customer, bill } = receiptFixture({ payments: [voided] });
  const receipt = buildPaymentReceipt(customer, bill, voided);
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes('receipt-void-stamp'), `${format} carries the VOID stamp`);
    assert.ok(html.includes('receipt-status-void'), `${format} marks the status void`);
    assert.ok(!html.includes('receipt-status-paid'), `${format} never marks a voided receipt paid`);
    assert.ok(html.includes('>VOID<') || html.includes('VOID —'), `${format} prints VOID prominently`);
  }
});

test('Plan K: a live receipt is byte-stable with respect to the VOID stamp (no stamp, no void class)', () => {
  const live = pay('live-2', 2000, '2026-08-07');
  const { customer, bill } = receiptFixture({ payments: [live] });
  const receipt = buildPaymentReceipt(customer, bill, live);
  assert.equal(receipt.status, 'PAID');
  const html = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(!html.includes('receipt-void-stamp'));
  assert.ok(!html.includes('receipt-status-void'));
});

test('Plan K: decideSeal stamps VOID in red even when the balance is cleared by siblings', () => {
  assert.deepEqual(
    decideSeal({ status: 'VOID', balanceDueCents: 0 }),
    { kind: 'VOID', label: 'VOID', urdu: '', sub: 'Shahdara ISP', color: '#a11d1d' },
  );
  assert.equal(decideSeal({ status: 'VOID', balanceDueCents: 5000 }).kind, 'VOID');
});

test('Plan K: decideSeal is unchanged for live receipts', () => {
  assert.equal(decideSeal({ balanceDueCents: 0 }).kind, 'PAID');
  assert.equal(decideSeal({ balanceDueCents: 5000 }).kind, 'PARTIAL');
  assert.equal(decideSeal({ balanceDueCents: null }).kind, 'PARTIAL');
});

test('Plan K: the PNG model for a voided receipt carries the VOID seal, not PAID', () => {
  const live = pay('live-3', 2000, '2026-08-05');
  const voided = pay('void-4', 2000, '2026-08-09', { voided: true, voidedAt: '2026-08-10', voidReason: 'Duplicate' });
  const { customer, bill } = receiptFixture({ payments: [live, voided] });
  const receipt = buildPaymentReceipt(customer, bill, voided);
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(model.seal.kind, 'VOID');
  assert.equal(model.seal.label, 'VOID');
  assert.equal(model.status, 'VOID');
});
