// Plan 412 — History largest payment highlight:
// one highlight on the customer history — the single largest
// payment, with its date and method, shown at the top of the
// history. It highlights only and it changes nothing: it reads the
// entries the full history list already composes and writes to no
// store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  historyLargestPaymentIsPayment,
  historyLargestPayment,
  formatLargestPaymentAmount,
  historyLargestPaymentText,
  historyLargestPaymentHtml,
} from '../history-largest-payment.js';
import { fullHistoryEntries } from '../full-history-list.js';

function entry(overrides = {}) {
  return {
    type: 'payment',
    date: '2026-11-06',
    month: '2026-11',
    amountCents: 300000,
    runningBalanceCents: 0,
    note: '',
    method: 'Cash',
    ref: 'PAY-1',
    voided: false,
    ...overrides,
  };
}

function bill(overrides = {}) {
  return {
    id: 'BILL-1',
    month: '2026-11',
    dueDate: '2026-11-05',
    dueAmount: 3000,
    status: 'pending',
    payments: [],
    ...overrides,
  };
}

function payment(overrides = {}) {
  return { id: 'PAY-1', amount: 3000, date: '2026-11-06', method: 'Cash', ...overrides };
}

test('a payment counts as a payment that stands', () => {
  assert.equal(historyLargestPaymentIsPayment(entry()), true);
});

test('an advance counts, because an advance is money paid in advance', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ type: 'advance' })), true);
});

test('a charge is not a payment', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ type: 'charge' })), false);
});

test('a credit entry is not a payment', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ type: 'credit' })), false);
});

test('a refund is not a payment', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ type: 'refund' })), false);
});

test('an adjustment is not a payment', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ type: 'adjustment' })), false);
});

test('a voided payment never counts', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ voided: true })), false);
});

test('a voided advance never counts', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ type: 'advance', voided: true })), false);
});

test('a zero-amount payment never counts', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ amountCents: 0 })), false);
});

test('a negative amount never counts', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ amountCents: -5000 })), false);
});

test('a non-numeric amount never counts', () => {
  assert.equal(historyLargestPaymentIsPayment(entry({ amountCents: '3000' })), false);
  assert.equal(historyLargestPaymentIsPayment(entry({ amountCents: Number.NaN })), false);
});

test('a missing or non-object entry never counts', () => {
  assert.equal(historyLargestPaymentIsPayment(null), false);
  assert.equal(historyLargestPaymentIsPayment('payment'), false);
  assert.equal(historyLargestPaymentIsPayment({}), false);
});

test('the largest payment wins over smaller payments', () => {
  const entries = [
    entry({ ref: 'PAY-1', amountCents: 100000, date: '2026-09-06', method: 'Cash' }),
    entry({ ref: 'PAY-2', amountCents: 300000, date: '2026-11-06', method: 'JazzCash' }),
    entry({ ref: 'PAY-3', amountCents: 200000, date: '2026-10-06', method: 'Easypaisa' }),
  ];
  const largest = historyLargestPayment(entries);
  assert.equal(largest.ref, 'PAY-2');
  assert.equal(largest.amountCents, 300000);
  assert.equal(largest.date, '2026-11-06');
  assert.equal(largest.method, 'JazzCash');
});

test('a customer with one payment shows that one', () => {
  const only = entry({ ref: 'PAY-9', amountCents: 150000, method: 'Cash' });
  assert.equal(historyLargestPayment([only]), only);
});

test('no payment in the history means no highlight', () => {
  assert.equal(historyLargestPayment([]), null);
  assert.equal(historyLargestPayment([entry({ type: 'charge', amountCents: 900000 })]), null);
  assert.equal(historyLargestPayment(null), null);
  assert.equal(historyLargestPayment('not a list'), null);
});

test('a voided largest payment is skipped for the next largest', () => {
  const entries = [
    entry({ ref: 'PAY-1', amountCents: 500000, voided: true }),
    entry({ ref: 'PAY-2', amountCents: 300000 }),
  ];
  assert.equal(historyLargestPayment(entries).ref, 'PAY-2');
});

test('a larger charge never beats a payment', () => {
  const entries = [
    entry({ type: 'charge', ref: 'BILL-1', amountCents: 900000 }),
    entry({ ref: 'PAY-1', amountCents: 300000 }),
  ];
  assert.equal(historyLargestPayment(entries).ref, 'PAY-1');
});

test('a larger refund never beats a payment', () => {
  const entries = [
    entry({ type: 'refund', ref: 'RF-1', amountCents: 900000, method: 'Cash' }),
    entry({ ref: 'PAY-1', amountCents: 300000 }),
  ];
  assert.equal(historyLargestPayment(entries).ref, 'PAY-1');
});

test('a tied largest payment resolves to the earliest dated one', () => {
  const entries = [
    entry({ ref: 'PAY-2', amountCents: 300000, date: '2026-11-06' }),
    entry({ ref: 'PAY-1', amountCents: 300000, date: '2026-09-06' }),
  ];
  assert.equal(historyLargestPayment(entries).ref, 'PAY-1');
});

test('a tied largest payment with no date loses to a dated one', () => {
  const entries = [
    entry({ ref: 'PAY-1', amountCents: 300000, date: '' }),
    entry({ ref: 'PAY-2', amountCents: 300000, date: '2026-09-06' }),
  ];
  assert.equal(historyLargestPayment(entries).ref, 'PAY-2');
});

test('a tie on amount and date resolves to the smallest ref', () => {
  const entries = [
    entry({ ref: 'PAY-2', amountCents: 300000, date: '2026-11-06' }),
    entry({ ref: 'PAY-1', amountCents: 300000, date: '2026-11-06' }),
  ];
  assert.equal(historyLargestPayment(entries).ref, 'PAY-1');
});

test('an advance can be the largest payment', () => {
  const entries = [
    entry({ ref: 'PAY-1', amountCents: 200000 }),
    entry({ type: 'advance', ref: 'PAY-2', amountCents: 400000 }),
  ];
  assert.equal(historyLargestPayment(entries).ref, 'PAY-2');
});

test('the highlight never changes any entry', () => {
  const entries = [
    entry({ ref: 'PAY-1', amountCents: 100000 }),
    entry({ ref: 'PAY-2', amountCents: 300000 }),
  ];
  const before = JSON.stringify(entries);
  historyLargestPayment(entries);
  historyLargestPaymentHtml(entries);
  assert.equal(JSON.stringify(entries), before);
});

test('the highlighted entry is the entry itself, not a copy', () => {
  const only = entry();
  assert.equal(historyLargestPayment([only]), only);
});

test('whole rupees print with no decimals', () => {
  assert.equal(formatLargestPaymentAmount(300000), 'PKR 3,000');
  assert.equal(formatLargestPaymentAmount(150000), 'PKR 1,500');
});

test('a paisa remainder prints with one decimal', () => {
  assert.equal(formatLargestPaymentAmount(150050), 'PKR 1,500.5');
});

test('a value that is not a number is never treated as zero', () => {
  assert.equal(formatLargestPaymentAmount('not a number'), 'PKR 0');
  assert.equal(formatLargestPaymentAmount(undefined), 'PKR 0');
});

test('the highlight line carries amount, date and method', () => {
  const text = historyLargestPaymentText(entry({ amountCents: 300000, date: '2026-11-06', method: 'JazzCash' }));
  assert.equal(text, 'Largest payment · PKR 3,000 · 2026-11-06 · JazzCash');
});

test('an undated payment says the date was not recorded', () => {
  const text = historyLargestPaymentText(entry({ date: '' }));
  assert.match(text, /date not recorded/);
});

test('a payment with no method says the method was not recorded', () => {
  const text = historyLargestPaymentText(entry({ method: '' }));
  assert.match(text, /method not recorded/);
});

test('no largest payment means no highlight text', () => {
  assert.equal(historyLargestPaymentText(null), '');
  assert.equal(historyLargestPaymentText(undefined), '');
});

test('the highlight html carries the largest payment line', () => {
  const html = historyLargestPaymentHtml([
    entry({ ref: 'PAY-1', amountCents: 100000, method: 'Cash' }),
    entry({ ref: 'PAY-2', amountCents: 300000, date: '2026-11-06', method: 'JazzCash' }),
  ]);
  assert.match(html, /Largest payment · PKR 3,000 · 2026-11-06 · JazzCash/);
  assert.match(html, /class="notice"/);
});

test('the highlight html is empty when no payment stands', () => {
  assert.equal(historyLargestPaymentHtml([]), '');
  assert.equal(historyLargestPaymentHtml([entry({ type: 'charge' })]), '');
});

test('a hostile method is escaped before it reaches the page', () => {
  const html = historyLargestPaymentHtml([entry({ method: '<script>alert(1)</script>' })]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('the highlight agrees with the full history list on the same fixture', () => {
  const bills = [
    bill({
      id: 'BILL-1', month: '2026-09', dueDate: '2026-09-05', dueAmount: 1000,
      payments: [payment({ id: 'PAY-1', amount: 1000, date: '2026-09-06', method: 'Cash' })],
    }),
    bill({
      id: 'BILL-2', month: '2026-10', dueDate: '2026-10-05', dueAmount: 3000,
      payments: [payment({ id: 'PAY-2', amount: 3000, date: '2026-10-06', method: 'JazzCash' })],
    }),
    bill({
      id: 'BILL-3', month: '2026-11', dueDate: '2026-11-05', dueAmount: 2000,
      payments: [payment({ id: 'PAY-3', amount: 2000, date: '2026-11-06', method: 'Easypaisa' })],
    }),
  ];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: [] });
  const largest = historyLargestPayment(entries);
  assert.equal(largest.ref, 'PAY-2');
  assert.equal(largest.amountCents, 300000);
  assert.equal(historyLargestPaymentText(largest), 'Largest payment · PKR 3,000 · 2026-10-06 · JazzCash');
});

test('the highlight on one-payment history from the full list shows that one', () => {
  const bills = [bill({ payments: [payment({ id: 'PAY-1', amount: 2500, date: '2026-11-06', method: 'Cash' })] })];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: [] });
  const largest = historyLargestPayment(entries);
  assert.equal(largest.ref, 'PAY-1');
  assert.equal(historyLargestPaymentHtml(entries), '<p class="notice">Largest payment · PKR 2,500 · 2026-11-06 · Cash</p>');
});

test('the module is pure: no dates from the clock, no storage, no network', () => {
  const src = readFileSync(new URL('../history-largest-payment.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /new Date\(/);
  assert.doesNotMatch(src, /Date\.now\(/);
  assert.doesNotMatch(src, /localStorage/);
  assert.doesNotMatch(src, /sessionStorage/);
  assert.doesNotMatch(src, /fetch\(/);
  assert.doesNotMatch(src, /shahdara_[a-z_]+_v\d/);
});

test('the module header never names a fenced module file literally', () => {
  const src = readFileSync(new URL('../history-largest-payment.js', import.meta.url), 'utf8');
  const fenced = [
    'full-history-' + 'list.js',
    'history-type-' + 'filter.js',
    'history-date-range-' + 'filter.js',
    'history-method-' + 'filter.js',
    'history-amount-' + 'search.js',
    'history-running-' + 'balance.js',
    'history-monthly-' + 'grouping.js',
    'history-yearly-' + 'summary.js',
    'history-csv-' + 'export.js',
    'history-printed-' + 'statement.js',
    'history-gap-' + 'view.js',
  ];
  for (const name of fenced) assert.doesNotMatch(src, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('the history wires the highlight at the top, over the shown rows', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSrc, /import \{ historyLargestPaymentHtml \} from '\.\/history-largest-payment\.js';/);
  assert.match(appSrc, /#hlpHistoryLargestPayment/);
  assert.match(appSrc, /historyLargestPaymentHtml\(shown\)/);
  const htmlSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(htmlSrc, /id="hlpHistoryLargestPayment"/);
  assert.ok(
    htmlSrc.indexOf('id="hlpHistoryLargestPayment"') < htmlSrc.indexOf('id="fhlFullHistoryList"'),
    'the highlight sits above the history list',
  );
  assert.ok(
    htmlSrc.indexOf('id="hlpHistoryLargestPayment"') < htmlSrc.indexOf('id="htfHistoryTypeFilterHost"'),
    'the highlight sits at the top of the history, before the filters',
  );
});
