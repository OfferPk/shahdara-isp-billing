import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECEIPT_DELIVERY_STATUSES,
  RECEIPT_DELIVERY_STATUS_LABELS,
  isReceiptDeliveryStatus,
  receiptDeliveryStatusLabel,
  normalizeReceiptDelivery,
  createReceiptDelivery,
  markDeliverySent,
  markDeliveryPending,
  markDeliveryFailed,
  markDeliveryRetry,
  deliveryFromSharedRecord,
  pendingDeliveryList,
  deliverySummary,
  receiptDeliveryHtml,
  withReceiptDelivery,
} from '../receipt-delivery.js';

import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';

const OCT_29 = new Date(2026, 9, 29, 12);

// ---- catalogue ----

test('catalogue is exactly the plan four statuses, in order, with labels', () => {
  assert.deepEqual([...RECEIPT_DELIVERY_STATUSES], ['generated', 'sent', 'pending', 'failed']);
  assert.equal(RECEIPT_DELIVERY_STATUS_LABELS.sent, 'Sent');
  assert.equal(RECEIPT_DELIVERY_STATUS_LABELS.failed, 'Failed');
  assert.equal(isReceiptDeliveryStatus('pending'), true);
  assert.equal(isReceiptDeliveryStatus('delivered'), false);
  assert.equal(isReceiptDeliveryStatus(''), false);
  assert.equal(receiptDeliveryStatusLabel('sent'), 'Sent');
  assert.equal(receiptDeliveryStatusLabel('bogus'), 'Generated');
});

// ---- creation and normalisation ----

test('new field receipt starts generated, no sent time, no attempts, refs trimmed', () => {
  const entry = createReceiptDelivery({ receiptRef: '  RCPT-1 ', paymentId: 'pay-9', channel: 'whatsapp' });
  assert.equal(entry.status, 'generated');
  assert.equal(entry.receiptRef, 'RCPT-1');
  assert.equal(entry.paymentId, 'pay-9');
  assert.equal(entry.channel, 'whatsapp');
  assert.equal(entry.sentAt, null);
  assert.equal(entry.attempts, 0);
  assert.equal(entry.retries, 0);
  assert.equal(entry.lastFailure, '');
});

test('empty creation gives a generated entry, never a null', () => {
  const entry = createReceiptDelivery();
  assert.equal(entry.status, 'generated');
  assert.equal(entry.receiptRef, '');
});

test('normalise repairs an unknown status to generated and drops a claimed sent time', () => {
  const entry = normalizeReceiptDelivery({ receiptRef: 'R-1', status: 'delivered', sentAt: '2026-10-29T10:00:00Z' });
  assert.equal(entry.status, 'generated');
  assert.equal(entry.sentAt, null);
});

test('normalise keeps a sent time only on sent entries, and clamps bad counts', () => {
  const sent = normalizeReceiptDelivery({ status: 'sent', sentAt: '2026-10-29T10:00:00Z', attempts: -2, retries: 'x' });
  assert.equal(sent.sentAt, '2026-10-29T10:00:00Z');
  assert.equal(sent.attempts, 0);
  assert.equal(sent.retries, 0);
  const failed = normalizeReceiptDelivery({ status: 'failed', lastFailure: '  no answer  ', attempts: 2.7 });
  assert.equal(failed.lastFailure, 'no answer');
  assert.equal(failed.attempts, 2);
});

test('normalise of a non-record is a fresh generated entry', () => {
  for (const bad of [null, undefined, 'sent', 42]) {
    assert.equal(normalizeReceiptDelivery(bad).status, 'generated');
  }
});

// ---- transitions ----

test('mark sent sets status, sent time and counts the attempt, and clears a failure', () => {
  const failed = markDeliveryFailed(createReceiptDelivery({ receiptRef: 'R-1' }), 'number unreachable', '2026-10-29T09:00:00Z');
  const sent = markDeliverySent(failed, '2026-10-29T10:00:00Z');
  assert.equal(sent.status, 'sent');
  assert.equal(sent.sentAt, '2026-10-29T10:00:00Z');
  assert.equal(sent.attempts, 2);
  assert.equal(sent.lastFailure, '');
});

test('mark sent with no new time keeps the earlier sent time', () => {
  const sent = markDeliverySent(createReceiptDelivery({ receiptRef: 'R-1' }), '2026-10-29T10:00:00Z');
  assert.equal(markDeliverySent(sent).sentAt, '2026-10-29T10:00:00Z');
  assert.equal(markDeliverySent(sent).status, 'sent');
});

test('mark sent on a non-record returns null, never an invented entry', () => {
  assert.equal(markDeliverySent(null, '2026-10-29T10:00:00Z'), null);
});

test('pending queues a generated receipt without counting an attempt', () => {
  const pending = markDeliveryPending(createReceiptDelivery({ receiptRef: 'R-1' }));
  assert.equal(pending.status, 'pending');
  assert.equal(pending.attempts, 0);
});

test('pending never moves a sent receipt backwards, and never jumps a failed one', () => {
  const sent = markDeliverySent(createReceiptDelivery({ receiptRef: 'R-1' }), '2026-10-29T10:00:00Z');
  assert.equal(markDeliveryPending(sent).status, 'sent');
  const failed = markDeliveryFailed(createReceiptDelivery({ receiptRef: 'R-1' }), 'busy');
  assert.equal(markDeliveryPending(failed).status, 'failed');
  assert.equal(markDeliveryPending(failed).retries, 0);
});

test('mark failed counts the attempt, keeps the note and the attempt time', () => {
  const pending = markDeliveryPending(createReceiptDelivery({ receiptRef: 'R-1' }));
  const failed = markDeliveryFailed(pending, 'customer phone off', '2026-10-29T09:30:00Z');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.attempts, 1);
  assert.equal(failed.lastFailure, 'customer phone off');
  assert.equal(failed.lastAttemptAt, '2026-10-29T09:30:00Z');
});

test('mark failed never fails a sent receipt', () => {
  const sent = markDeliverySent(createReceiptDelivery({ receiptRef: 'R-1' }), '2026-10-29T10:00:00Z');
  const again = markDeliveryFailed(sent, 'late failure');
  assert.equal(again.status, 'sent');
  assert.equal(again.sentAt, '2026-10-29T10:00:00Z');
  assert.equal(again.attempts, 1);
});

test('retry moves pending and failed back to pending and counts the retry', () => {
  const failed = markDeliveryFailed(createReceiptDelivery({ receiptRef: 'R-1' }), 'busy', '2026-10-29T09:00:00Z');
  const retried = markDeliveryRetry(failed, '2026-10-29T11:00:00Z');
  assert.equal(retried.status, 'pending');
  assert.equal(retried.retries, 1);
  assert.equal(retried.lastFailure, '');
  assert.equal(retried.lastAttemptAt, '2026-10-29T11:00:00Z');
  const pending = markDeliveryPending(createReceiptDelivery({ receiptRef: 'R-2' }));
  assert.equal(markDeliveryRetry(pending).retries, 1);
});

test('retry never touches generated or sent entries', () => {
  assert.equal(markDeliveryRetry(createReceiptDelivery({ receiptRef: 'R-1' })).status, 'generated');
  const sent = markDeliverySent(createReceiptDelivery({ receiptRef: 'R-1' }), '2026-10-29T10:00:00Z');
  assert.equal(markDeliveryRetry(sent).status, 'sent');
  assert.equal(markDeliveryRetry(sent).retries, 0);
});

test('transitions never mutate the input entry', () => {
  const original = createReceiptDelivery({ receiptRef: 'R-1' });
  const snapshot = { ...original };
  markDeliverySent(original, '2026-10-29T10:00:00Z');
  markDeliveryFailed(original, 'busy');
  markDeliveryRetry(original);
  assert.deepEqual(original, snapshot);
});

// ---- bridge from existing sharing ----

test('shared record bridges to sent with sharedAt, unshared bridges to generated', () => {
  const sent = deliveryFromSharedRecord('R-1', { shared: true, sharedAt: '2026-10-29T10:05:00Z', method: 'whatsapp' });
  assert.equal(sent.status, 'sent');
  assert.equal(sent.sentAt, '2026-10-29T10:05:00Z');
  assert.equal(sent.attempts, 1);
  assert.equal(sent.channel, 'whatsapp');
  assert.equal(deliveryFromSharedRecord('R-2', { shared: false }).status, 'generated');
  assert.equal(deliveryFromSharedRecord('R-3', null).status, 'generated');
});

// ---- retry list and summary ----

test('retry list is pending and failed only, in original order, normalised', () => {
  const list = pendingDeliveryList([
    createReceiptDelivery({ receiptRef: 'R-gen' }),
    markDeliveryPending(createReceiptDelivery({ receiptRef: 'R-pend' })),
    markDeliverySent(createReceiptDelivery({ receiptRef: 'R-sent' }), '2026-10-29T10:00:00Z'),
    markDeliveryFailed(createReceiptDelivery({ receiptRef: 'R-fail' }), 'busy'),
    { receiptRef: 'R-bogus', status: 'delivered' },
  ]);
  assert.deepEqual(list.map((e) => e.receiptRef), ['R-pend', 'R-fail']);
  assert.deepEqual(pendingDeliveryList(null), []);
  assert.deepEqual(pendingDeliveryList('nope'), []);
});

test('summary counts sum to total, with undelivered and retryable derived', () => {
  const summary = deliverySummary([
    createReceiptDelivery({ receiptRef: 'R-gen' }),
    markDeliverySent(createReceiptDelivery({ receiptRef: 'R-sent' }), '2026-10-29T10:00:00Z'),
    markDeliveryPending(createReceiptDelivery({ receiptRef: 'R-pend' })),
    markDeliveryFailed(createReceiptDelivery({ receiptRef: 'R-fail' }), 'busy'),
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.generated, 1);
  assert.equal(summary.sent, 1);
  assert.equal(summary.pending, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.undelivered, 3);
  assert.equal(summary.retryable, 2);
  assert.deepEqual(deliverySummary(null), { total: 0, generated: 0, sent: 0, pending: 0, failed: 0, undelivered: 0, retryable: 0 });
});

// ---- html and payment separation ----

test('html chip shows status, sent time, and an escaped failure note', () => {
  const sent = receiptDeliveryHtml(markDeliverySent(createReceiptDelivery({ receiptRef: 'R-1' }), '2026-10-29T10:00:00Z'));
  assert.match(sent, /Sent/);
  assert.match(sent, /2026-10-29T10:00:00Z/);
  assert.match(sent, /receipt-delivery--sent/);
  const failed = receiptDeliveryHtml(markDeliveryFailed(createReceiptDelivery({ receiptRef: 'R-1' }), '<script>alert(1)</script>'));
  assert.match(failed, /Failed/);
  assert.doesNotMatch(failed, /<script>/);
  assert.match(receiptDeliveryHtml(createReceiptDelivery({ receiptRef: 'R-1' })), /Generated/);
});

test('withReceiptDelivery copies the payment, leaves the original untouched, and changes no money', () => {
  const payment = { id: 'pay-1', amount: 3000, method: 'Cash', date: '2026-10-29' };
  const copy = withReceiptDelivery(payment, createReceiptDelivery({ receiptRef: 'R-1', paymentId: 'pay-1' }));
  assert.equal(copy.amount, 3000);
  assert.equal(copy.method, 'Cash');
  assert.equal(copy.receiptDelivery.status, 'generated');
  assert.equal(copy.receiptDelivery.receiptRef, 'R-1');
  assert.equal('receiptDelivery' in payment, false);
  assert.deepEqual(payment, { id: 'pay-1', amount: 3000, method: 'Cash', date: '2026-10-29' });
});

test('withReceiptDelivery on a non-record returns it unchanged', () => {
  assert.equal(withReceiptDelivery(null, createReceiptDelivery()), null);
});

// ---- wiring: quick-collect field receipt ----

test('quick-collect field receipt is created generated, with its own receipt number, money untouched', () => {
  let state = createInitialState(['Delivery Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  const { receipt, nextState } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-29', method: 'Cash',
  }, OCT_29);
  assert.equal(receipt.success, true);
  assert.equal(receipt.amount, 3000);
  assert.equal(receipt.delivery.status, 'generated');
  assert.equal(receipt.delivery.receiptRef, receipt.receiptNumber);
  assert.equal(receipt.delivery.paymentId, receipt.paymentId);
  assert.equal(receipt.delivery.sentAt, null);
  const bill = nextState.customers[0].bills.find((b) => b.month === '2026-10');
  assert.equal(bill.payments.length, 1);
  assert.equal(bill.payments[0].amount, 3000);
});
