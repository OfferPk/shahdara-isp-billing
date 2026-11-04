/**
 * plan73-payment-slip.test.js — Plan 73: payment history mini-slip
 * on request.
 * Pins:
 * - every listed payment matches the ledger on the same fixture,
 *   in date order, with live amounts summing exactly to the
 *   stated subtotal in integer cents;
 * - a voided payment is never presented as a successful payment:
 *   it is listed marked VOID, excluded from the subtotal, and
 *   the exclusion is stated;
 * - a missing or unusable balance figure refuses the whole slip,
 *   never zero-filled or guessed; a payment row with no usable
 *   date or amount is counted as skipped, never zero-filled;
 * - a blank channel is said plainly ("not recorded"), never
 *   invented; impossible dates (2026-02-30) are never dates;
 * - sending is logged once per customer with re-send allowed,
 *   and drafting or sending never changes any payment record.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYMENT_SLIP_VARIANTS,
  PAYMENT_SLIP_DEFAULT_COUNT,
  normalizePaymentSlipVariant,
  normalizePaymentSlipCount,
  validPaymentSlipDate,
  buildPaymentSlip,
  buildPaymentSlipText,
  paymentSlipSummaryText,
  logPaymentSlipSent,
  findPaymentSlipSends,
  paymentSlipSentText,
  paymentSlipHtml,
} from '../payment-slip.js';

const base = {
  customerId: 'C-1',
  customerName: 'Ahmed',
  balance: 500,
  payments: [
    { date: '2026-08-05', amount: 1000, channel: 'cash' },
    { date: '2026-09-05', amount: 1000, channel: 'Easypaisa' },
    { date: '2026-10-05', amount: 1000, channel: 'cash' },
  ],
};

test('strict dates and variant/count normalisation', () => {
  assert.equal(validPaymentSlipDate('2026-02-30'), null);
  assert.equal(validPaymentSlipDate('2026-11-04'), '2026-11-04');
  assert.equal(validPaymentSlipDate('2026-11-04T10:00:00'), '2026-11-04');
  assert.equal(validPaymentSlipDate(''), null);
  assert.equal(normalizePaymentSlipVariant('urdu'), 'urdu');
  assert.equal(normalizePaymentSlipVariant('anything'), 'roman');
  assert.equal(normalizePaymentSlipCount(3), 3);
  assert.equal(normalizePaymentSlipCount(0), PAYMENT_SLIP_DEFAULT_COUNT);
  assert.equal(normalizePaymentSlipCount(-2), PAYMENT_SLIP_DEFAULT_COUNT);
  assert.equal(normalizePaymentSlipCount(2.5), PAYMENT_SLIP_DEFAULT_COUNT);
  assert.equal(normalizePaymentSlipCount(''), PAYMENT_SLIP_DEFAULT_COUNT);
  assert.equal(PAYMENT_SLIP_DEFAULT_COUNT, 6);
});

test('exact cent sums and date order on one fixture', () => {
  const slip = buildPaymentSlip({
    ...base,
    payments: [
      { date: '2026-10-05', amount: 333.33, channel: 'cash' },
      { date: '2026-08-05', amount: 166.67, channel: 'cash' },
      { date: '2026-09-05', amount: 500, channel: 'Easypaisa' },
    ],
  });
  assert.deepEqual(slip.payments.map((row) => row.date), ['2026-08-05', '2026-09-05', '2026-10-05']);
  assert.equal(slip.subtotalCents, 100000);
  assert.equal(slip.subtotal, 1000);
  assert.equal(slip.liveCount, 3);
  assert.equal(slip.voidedCount, 0);
  assert.ok(slip.text.includes('Subtotal (live payments): Rs. 1000'));
  assert.ok(slip.text.includes('Current balance: Rs. 500'));
});

test('last-N selection keeps the most recent payments, in date order', () => {
  const payments = [];
  for (let i = 1; i <= 8; i += 1) {
    payments.push({ date: `2026-0${i}-05`, amount: 100, channel: 'cash' });
  }
  const slip = buildPaymentSlip({ ...base, payments, count: 6 });
  assert.equal(slip.payments.length, 6);
  assert.deepEqual(slip.payments.map((row) => row.date), [
    '2026-03-05', '2026-04-05', '2026-05-05', '2026-06-05', '2026-07-05', '2026-08-05',
  ]);
  assert.equal(slip.subtotal, 600);
});

test('voided payments are marked VOID, excluded from the subtotal, and the exclusion is stated', () => {
  const slip = buildPaymentSlip({
    ...base,
    payments: [
      { date: '2026-08-05', amount: 1000, channel: 'cash' },
      { date: '2026-09-05', amount: 1000, channel: 'cash', voided: true },
      { date: '2026-10-05', amount: 500, channel: 'Easypaisa' },
    ],
  });
  assert.equal(slip.subtotal, 1500);
  assert.equal(slip.voidedCount, 1);
  assert.equal(slip.liveCount, 2);
  const voided = slip.payments.find((row) => row.voided);
  assert.equal(voided.amount, 1000);
  assert.ok(slip.text.includes('VOID'));
  assert.ok(slip.text.includes('1 voided payment(s) excluded from the subtotal'));
  assert.ok(!slip.text.includes('Subtotal (live payments): Rs. 2500'));
  const html = paymentSlipHtml(slip, { draftText: slip.text });
  assert.ok(html.includes('<strong>VOID</strong>'));
  assert.ok(html.includes('excluded from the subtotal'));
});

test('unusable rows are counted as skipped, never zero-filled', () => {
  const slip = buildPaymentSlip({
    ...base,
    payments: [
      { date: '2026-08-05', amount: 1000, channel: 'cash' },
      { date: '2026-02-30', amount: 1000, channel: 'cash' },
      { date: '2026-09-05', amount: '', channel: 'cash' },
      { date: '2026-09-06', amount: true, channel: 'cash' },
      { date: '', amount: 1000, channel: 'cash' },
    ],
  });
  assert.equal(slip.payments.length, 1);
  assert.equal(slip.skippedUnusable, 4);
  assert.equal(slip.subtotal, 1000);
  assert.ok(slip.text.includes('4 payment row(s) could not be listed'));
});

test('missing or unusable balance refuses the slip; zero balance is a real figure', () => {
  assert.equal(buildPaymentSlip({ ...base, balance: '' }), null);
  assert.equal(buildPaymentSlip({ ...base, balance: null }), null);
  assert.equal(buildPaymentSlip({ ...base, balance: true }), null);
  assert.equal(buildPaymentSlip({ ...base, balance: -5 }), null);
  assert.equal(buildPaymentSlip({ ...base, customerId: '' }), null);
  const zero = buildPaymentSlip({ ...base, balance: 0 });
  assert.notEqual(zero, null);
  assert.equal(zero.balance, 0);
  assert.ok(zero.text.includes('Current balance: Rs. 0'));
  const empty = buildPaymentSlip({ ...base, payments: [] });
  assert.notEqual(empty, null);
  assert.equal(empty.payments.length, 0);
  assert.ok(empty.text.includes('No payments listed.'));
});

test('blank channel says "not recorded", never invented', () => {
  const slip = buildPaymentSlip({
    ...base,
    payments: [
      { date: '2026-08-05', amount: 1000, channel: '' },
      { date: '2026-09-05', amount: 1000, method: 'JazzCash' },
    ],
  });
  assert.equal(slip.payments[0].channel, 'not recorded');
  assert.equal(slip.payments[1].channel, 'JazzCash');
});

test('Urdu variant carries the same figures', () => {
  const slip = buildPaymentSlip({ ...base, variant: 'urdu' });
  assert.equal(slip.variant, PAYMENT_SLIP_VARIANTS.URDU);
  assert.ok(slip.text.includes('payment history'));
  assert.ok(slip.text.includes('Rs. 3000'));
  assert.ok(slip.text.includes('Current balance: Rs. 500'));
});

test('send log: once per customer, re-send allowed, half-formed ignored', () => {
  const empty = [];
  const logged = logPaymentSlipSent(empty, { customerId: 'C-1', sentAt: '2026-11-04T10:00:00', channel: 'whatsapp', variant: 'roman' });
  assert.equal(logged.length, 1);
  const resent = logPaymentSlipSent(logged, { customerId: 'C-1', sentAt: '2026-11-05T10:00:00', channel: 'whatsapp', variant: 'urdu' });
  assert.equal(resent.length, 2);
  assert.equal(findPaymentSlipSends(resent, 'C-1').length, 2);
  assert.equal(findPaymentSlipSends(resent, 'C-2').length, 0);
  assert.equal(logPaymentSlipSent(resent, { customerId: '', sentAt: '2026-11-05T10:00:00' }).length, 2);
  assert.equal(logPaymentSlipSent(resent, { customerId: 'C-1' }).length, 2);
  assert.equal(paymentSlipSentText([]), 'Not sent yet.');
  assert.ok(paymentSlipSentText(resent).includes('last 2026-11-05T10:00:00'));
});

test('non-mutation and no ledger-field fence', () => {
  const input = {
    ...base,
    payments: [{ date: '2026-08-05', amount: 1000, channel: 'cash' }],
  };
  const snapshot = JSON.parse(JSON.stringify(input));
  const slip = buildPaymentSlip(input);
  assert.deepEqual(input, snapshot);
  assert.deepEqual(Object.keys(slip).sort(), [
    'balance', 'balanceCents', 'count', 'customerId', 'customerName',
    'liveCount', 'payments', 'skippedUnusable', 'subtotal', 'subtotalCents',
    'text', 'variant', 'voidedCount',
  ].sort());
  assert.deepEqual(Object.keys(slip.payments[0]).sort(), ['amount', 'amountCents', 'channel', 'date', 'voided'].sort());
  assert.equal(paymentSlipSummaryText(slip), 'Payment history: 1 live payment(s), 0 voided, subtotal Rs. 1000, current balance Rs. 500.');
  assert.equal(paymentSlipHtml(null), '<p class="empty-state">Payment slip unavailable — the balance figure is missing or unusable.</p>');
});

test('HTML escaping', () => {
  const slip = buildPaymentSlip({
    ...base,
    customerName: '<b>Ahmed</b>',
    payments: [{ date: '2026-08-05', amount: 1000, channel: '<script>cash' }],
  });
  const html = paymentSlipHtml(slip, { draftText: slip.text });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;cash'));
  assert.ok(html.includes('&lt;b&gt;Ahmed&lt;/b&gt;'));
});
