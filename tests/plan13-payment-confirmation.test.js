import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIRMATION_DRAFT_VARIANTS,
  isValidConfirmationDate,
  formatConfirmationAmount,
  formatConfirmationDate,
  isVoidedConfirmationPayment,
  buildPaymentConfirmationDraft,
  buildPaymentConfirmationList,
  logConfirmationSent,
  confirmationSentAt,
  paymentConfirmationSummaryText,
  paymentConfirmationFilename,
  paymentConfirmationHtml,
  paymentConfirmationCsv,
} from '../payment-confirmation.js';

const payment = (overrides = {}) => ({
  id: 'p1',
  customerId: 'c1',
  customerName: 'Ahmed',
  mohalla: 'Bani',
  amount: 1500,
  date: '2026-11-03',
  method: 'Cash',
  ...overrides,
});

// ---- date / amount formatting ----

test('valid calendar dates pass and impossible dates fail', () => {
  assert.equal(isValidConfirmationDate('2026-11-03'), true);
  assert.equal(isValidConfirmationDate('2024-02-29'), true);
  assert.equal(isValidConfirmationDate('2026-02-29'), false);
  assert.equal(isValidConfirmationDate('2026-13-01'), false);
  assert.equal(isValidConfirmationDate('03-11-2026'), false);
  assert.equal(isValidConfirmationDate(''), false);
  assert.equal(isValidConfirmationDate(null), false);
});

test('amount formatting keeps PKR prefix and decimals only when needed', () => {
  assert.equal(formatConfirmationAmount(1500), 'PKR 1,500');
  assert.equal(formatConfirmationAmount(1500.5), 'PKR 1,500.50');
  assert.equal(formatConfirmationAmount('abc'), '');
  assert.equal(formatConfirmationAmount(NaN), '');
});

test('date formatting renders day month year', () => {
  assert.equal(formatConfirmationDate('2026-11-03'), '3 Nov 2026');
  assert.equal(formatConfirmationDate('2026-02-29'), '');
  assert.equal(formatConfirmationDate(null), '');
});

// ---- voided never drafted ----

test('voided payments are detected and never get a draft', () => {
  assert.equal(isVoidedConfirmationPayment({ voided: true }), true);
  assert.equal(isVoidedConfirmationPayment({ voided: false }), false);
  assert.equal(isVoidedConfirmationPayment({}), false);
  assert.equal(isVoidedConfirmationPayment(null), false);
  assert.equal(buildPaymentConfirmationDraft(payment({ voided: true })), null);
  assert.notEqual(buildPaymentConfirmationDraft(payment({ voided: false })), null);
});

test('undraftable records return null instead of an invented draft', () => {
  assert.equal(buildPaymentConfirmationDraft(null), null);
  assert.equal(buildPaymentConfirmationDraft('not a record'), null);
  assert.equal(buildPaymentConfirmationDraft(payment({ id: '' })), null);
  assert.equal(buildPaymentConfirmationDraft(payment({ amount: 0 })), null);
  assert.equal(buildPaymentConfirmationDraft(payment({ amount: -500 })), null);
  assert.equal(buildPaymentConfirmationDraft(payment({ amount: 'abc' })), null);
  assert.equal(buildPaymentConfirmationDraft(payment({ date: '2026-02-29' })), null);
  assert.equal(buildPaymentConfirmationDraft(payment({ date: '' })), null);
});

// ---- draft content ----

test('roman draft carries name, amount, date and method verbatim', () => {
  const draft = buildPaymentConfirmationDraft(payment());
  assert.equal(draft.variant, 'roman');
  assert.equal(draft.paymentId, 'p1');
  assert.match(draft.text, /Ahmed/);
  assert.match(draft.text, /PKR 1,500/);
  assert.match(draft.text, /3 Nov 2026/);
  assert.match(draft.text, /Cash/);
  assert.match(draft.text, /Shahdara Fiber Net/);
});

test('urdu draft carries the same figures in Urdu script', () => {
  const draft = buildPaymentConfirmationDraft(payment(), { variant: 'urdu' });
  assert.equal(draft.variant, 'urdu');
  assert.match(draft.text, /Ahmed/);
  assert.match(draft.text, /PKR 1,500/);
  assert.match(draft.text, /3 Nov 2026/);
  assert.match(draft.text, /شاہدرہ فائبر نیٹ/);
});

test('an unknown variant falls back to the roman draft', () => {
  const draft = buildPaymentConfirmationDraft(payment(), { variant: 'french' });
  assert.equal(draft.variant, 'roman');
  assert.match(draft.text, /Assalam-o-Alaikum/);
});

test('positive remaining balance is stated in both variants', () => {
  const roman = buildPaymentConfirmationDraft(payment({ remainingBalance: 2500 }));
  assert.match(roman.text, /Baqaya PKR 2,500 baqi hai/);
  const urdu = buildPaymentConfirmationDraft(payment({ remainingBalance: 2500 }), { variant: 'urdu' });
  assert.match(urdu.text, /بقایا PKR 2,500 باقی ہے/);
});

test('zero remaining balance is stated as no balance remains', () => {
  const roman = buildPaymentConfirmationDraft(payment({ remainingBalance: 0 }));
  assert.match(roman.text, /Koi baqaya baqi nahi hai/);
  const urdu = buildPaymentConfirmationDraft(payment({ remainingBalance: 0 }), { variant: 'urdu' });
  assert.match(urdu.text, /کوئی بقایا باقی نہیں ہے/);
});

test('absent remaining balance adds no balance line, never an invented one', () => {
  const draft = buildPaymentConfirmationDraft(payment());
  assert.doesNotMatch(draft.text, /Baqaya|بقایا/);
});

test('non-finite remaining balance is omitted', () => {
  const draft = buildPaymentConfirmationDraft(payment({ remainingBalance: 'nonsense' }));
  assert.doesNotMatch(draft.text, /Baqaya/);
});

test('negative remaining balance is omitted, not stated as a due', () => {
  const draft = buildPaymentConfirmationDraft(payment({ remainingBalance: -100 }));
  assert.doesNotMatch(draft.text, /Baqaya/);
});

test('options override customer name, method and remaining balance', () => {
  const draft = buildPaymentConfirmationDraft(
    payment({ customerName: 'Old', remainingBalance: 999 }),
    { customerName: 'New Name', method: 'JazzCash', remainingBalance: 100 },
  );
  assert.match(draft.text, /New Name/);
  assert.doesNotMatch(draft.text, /Old/);
  assert.match(draft.text, /JazzCash/);
  assert.match(draft.text, /PKR 100/);
});

test('a payment without a method has no method line', () => {
  const draft = buildPaymentConfirmationDraft(payment({ method: '' }));
  assert.doesNotMatch(draft.text, /Tareeqa/);
});

test('a payment without a customer name still drafts with a placeholder', () => {
  const draft = buildPaymentConfirmationDraft(payment({ customerName: '' }));
  assert.notEqual(draft, null);
  assert.match(draft.text, /—/);
});

// ---- list builder ----

test('list gives one row per recorded payment, newest first', () => {
  const list = buildPaymentConfirmationList({
    payments: [
      payment({ id: 'p-old', date: '2026-11-01', customerName: 'Zara' }),
      payment({ id: 'p-new', date: '2026-11-03', customerName: 'Ahmed' }),
      payment({ id: 'p-mid', date: '2026-11-02', customerName: 'Bilal' }),
    ],
  });
  assert.deepEqual(list.rows.map((r) => r.paymentId), ['p-new', 'p-mid', 'p-old']);
  assert.equal(list.counts.drafted, 3);
  assert.equal(list.totalAmount, 4500);
});

test('list sorts same-day rows by customer name then payment id', () => {
  const list = buildPaymentConfirmationList({
    payments: [
      payment({ id: 'p2', customerName: 'Ahmed' }),
      payment({ id: 'p1', customerName: 'Ahmed' }),
      payment({ id: 'p3', customerName: 'Bilal' }),
    ],
  });
  assert.deepEqual(list.rows.map((r) => r.paymentId), ['p1', 'p2', 'p3']);
});

test('list counts voided and invalid payments without drafting them', () => {
  const list = buildPaymentConfirmationList({
    payments: [
      payment({ id: 'p-good' }),
      payment({ id: 'p-void', voided: true }),
      payment({ id: 'p-bad', amount: 0 }),
      payment({ id: 'p-baddate', date: 'not-a-date' }),
    ],
  });
  assert.equal(list.rows.length, 1);
  assert.equal(list.counts.totalPayments, 4);
  assert.equal(list.counts.drafted, 1);
  assert.equal(list.counts.excludedVoided, 1);
  assert.equal(list.counts.excludedInvalid, 2);
  assert.equal(list.totalAmount, 1500);
});

test('list total sums drafted rows only', () => {
  const list = buildPaymentConfirmationList({
    payments: [payment({ amount: 1000 }), payment({ amount: 500, voided: true })],
  });
  assert.equal(list.totalAmount, 1000);
});

test('list preserves remaining balance rounded, null when absent', () => {
  const list = buildPaymentConfirmationList({
    payments: [
      payment({ id: 'p1', remainingBalance: 2500.4 }),
      payment({ id: 'p2' }),
    ],
  });
  assert.equal(list.rows.find((r) => r.paymentId === 'p1').remainingBalance, 2500);
  assert.equal(list.rows.find((r) => r.paymentId === 'p2').remainingBalance, null);
});

test('list handles empty and non-array input as zero rows', () => {
  assert.deepEqual(buildPaymentConfirmationList({ payments: [] }).rows, []);
  assert.deepEqual(buildPaymentConfirmationList({}).rows, []);
  assert.deepEqual(buildPaymentConfirmationList().rows, []);
});

test('builders never mutate the payment records or add keys to them', () => {
  const original = payment({ remainingBalance: 500 });
  const frozen = Object.freeze({ ...original });
  const draft = buildPaymentConfirmationDraft(frozen);
  assert.notEqual(draft, null);
  assert.deepEqual(Object.keys(frozen).sort(), Object.keys(original).sort());
  const list = buildPaymentConfirmationList({ payments: [frozen] });
  assert.equal(list.rows.length, 1);
  assert.equal(frozen.remainingBalance, 500);
  assert.equal('draft' in frozen, false);
});

// ---- send log ----

test('send log appends a new array and leaves the old log untouched', () => {
  const log = [{ paymentId: 'p0', sentAt: '2026-11-02T10:00:00.000Z', channel: 'whatsapp' }];
  const next = logConfirmationSent(log, { paymentId: 'p1', customerId: 'c1', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' });
  assert.equal(log.length, 1);
  assert.equal(next.length, 2);
  assert.equal(next[1].paymentId, 'p1');
  assert.equal(next[1].customerId, 'c1');
  assert.equal(next[1].channel, 'whatsapp');
});

test('send log defaults the channel to whatsapp', () => {
  const next = logConfirmationSent([], { paymentId: 'p1', sentAt: '2026-11-03T10:00:00.000Z' });
  assert.equal(next[0].channel, 'whatsapp');
});

test('send log rejects entries without a payment id or a send time', () => {
  assert.deepEqual(logConfirmationSent([], { sentAt: '2026-11-03T10:00:00.000Z' }), []);
  assert.deepEqual(logConfirmationSent([], { paymentId: 'p1' }), []);
  assert.deepEqual(logConfirmationSent([], { paymentId: '', sentAt: '2026-11-03T10:00:00.000Z' }), []);
});

test('confirmationSentAt returns the last send time for a payment', () => {
  const log = [
    { paymentId: 'p1', sentAt: '2026-11-02T10:00:00.000Z' },
    { paymentId: 'p1', sentAt: '2026-11-03T10:00:00.000Z' },
    { paymentId: 'p2', sentAt: '2026-11-03T11:00:00.000Z' },
  ];
  assert.equal(confirmationSentAt(log, 'p1'), '2026-11-03T10:00:00.000Z');
  assert.equal(confirmationSentAt(log, 'p9'), null);
  assert.equal(confirmationSentAt(null, 'p1'), null);
});

// ---- summary, filename, html, csv ----

test('summary text states ready count, total and voided exclusions', () => {
  const list = buildPaymentConfirmationList({
    payments: [payment({ id: 'p1' }), payment({ id: 'p2', voided: true })],
  });
  const text = paymentConfirmationSummaryText(list);
  assert.match(text, /1 payment confirmation/);
  assert.match(text, /PKR 1,500/);
  assert.match(text, /1 voided payment/);
});

test('summary text covers the empty cases', () => {
  assert.equal(
    paymentConfirmationSummaryText(buildPaymentConfirmationList({ payments: [payment({ voided: true })] })),
    'No confirmations ready — 1 voided payment correctly have no draft.',
  );
  assert.equal(
    paymentConfirmationSummaryText(buildPaymentConfirmationList({ payments: [] })),
    'No recorded payments to confirm.',
  );
  assert.equal(paymentConfirmationSummaryText(null), 'Payment confirmations unavailable.');
});

test('filename uses the given day and falls back for an invalid day', () => {
  assert.equal(paymentConfirmationFilename('2026-11-03'), 'payment-confirmations-2026-11-03.csv');
  assert.equal(paymentConfirmationFilename('not-a-date'), 'payment-confirmations-unknown-date.csv');
  assert.equal(paymentConfirmationFilename(), 'payment-confirmations-unknown-date.csv');
});

test('html escapes names and methods and marks sent versus unsent rows', () => {
  const list = buildPaymentConfirmationList({
    payments: [payment({ customerName: '<script>alert(1)</script>', method: 'Cash & Carry' })],
  });
  const html = paymentConfirmationHtml(list, []);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Cash &amp; Carry/);
  assert.match(html, /Not sent/);
  assert.match(html, /payment-confirmation-send-btn/);
  const sentHtml = paymentConfirmationHtml(list, [{ paymentId: 'p1', sentAt: '2026-11-03T10:00:00.000Z' }]);
  assert.match(sentHtml, /Sent 2026-11-03 10:00 UTC/);
});

test('html handles empty and unavailable lists', () => {
  assert.match(paymentConfirmationHtml(buildPaymentConfirmationList({ payments: [] })), /No recorded payments/);
  assert.match(paymentConfirmationHtml(null), /unavailable/);
});

test('csv quotes names with commas and carries sent info', () => {
  const list = buildPaymentConfirmationList({
    payments: [payment({ customerName: 'Ahmed, Jr.', remainingBalance: 200 })],
  });
  const csv = paymentConfirmationCsv(list, [{ paymentId: 'p1', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' }]);
  assert.match(csv, /"Ahmed, Jr\."/);
  assert.match(csv, /1500,2026-11-03,Cash,200,2026-11-03T10:00:00\.000Z,whatsapp/);
});

test('csv uses the last send entry per payment', () => {
  const list = buildPaymentConfirmationList({ payments: [payment()] });
  const csv = paymentConfirmationCsv(list, [
    { paymentId: 'p1', sentAt: '2026-11-02T10:00:00.000Z', channel: 'whatsapp' },
    { paymentId: 'p1', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' },
  ]);
  assert.match(csv, /2026-11-03T10:00:00\.000Z/);
  assert.doesNotMatch(csv, /2026-11-02T10:00:00\.000Z/);
});
