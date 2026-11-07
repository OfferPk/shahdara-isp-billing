// Plan 413 — History first payment and first bill dates:
// one first-dates line on the customer history (date of first
// bill, date of first payment, in plain words), drawn from
// existing records. It displays only and it changes nothing: it
// reads the entries the full history list already composes and
// writes to no store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_FIRST_DATES_NO_BILL_TEXT,
  HISTORY_FIRST_DATES_NO_PAYMENT_TEXT,
  HISTORY_FIRST_DATES_DATE_NOT_RECORDED_TEXT,
  historyFirstDatesIsCharge,
  historyFirstDatesIsPayment,
  historyFirstDates,
  historyFirstDatesText,
  historyFirstDatesHtml,
} from '../history-first-dates.js';
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

test('a charge counts as a bill', () => {
  assert.equal(historyFirstDatesIsCharge(entry({ type: 'charge' })), true);
});

test('a payment is not a bill', () => {
  assert.equal(historyFirstDatesIsCharge(entry()), false);
});

test('an advance is not a bill', () => {
  assert.equal(historyFirstDatesIsCharge(entry({ type: 'advance' })), false);
});

test('a credit, a refund and an adjustment are not bills', () => {
  assert.equal(historyFirstDatesIsCharge(entry({ type: 'credit' })), false);
  assert.equal(historyFirstDatesIsCharge(entry({ type: 'refund' })), false);
  assert.equal(historyFirstDatesIsCharge(entry({ type: 'adjustment' })), false);
});

test('a charge with no positive amount is not a bill', () => {
  assert.equal(historyFirstDatesIsCharge(entry({ type: 'charge', amountCents: 0 })), false);
  assert.equal(historyFirstDatesIsCharge(entry({ type: 'charge', amountCents: -5000 })), false);
  assert.equal(historyFirstDatesIsCharge(entry({ type: 'charge', amountCents: '3000' })), false);
});

test('a missing or non-object entry is never a bill', () => {
  assert.equal(historyFirstDatesIsCharge(null), false);
  assert.equal(historyFirstDatesIsCharge('charge'), false);
  assert.equal(historyFirstDatesIsCharge({}), false);
});

test('a payment counts as a payment that stands', () => {
  assert.equal(historyFirstDatesIsPayment(entry()), true);
});

test('an advance counts, because an advance is money paid in advance', () => {
  assert.equal(historyFirstDatesIsPayment(entry({ type: 'advance' })), true);
});

test('a charge, a credit, a refund and an adjustment are not payments', () => {
  assert.equal(historyFirstDatesIsPayment(entry({ type: 'charge' })), false);
  assert.equal(historyFirstDatesIsPayment(entry({ type: 'credit' })), false);
  assert.equal(historyFirstDatesIsPayment(entry({ type: 'refund' })), false);
  assert.equal(historyFirstDatesIsPayment(entry({ type: 'adjustment' })), false);
});

test('a voided payment never counts', () => {
  assert.equal(historyFirstDatesIsPayment(entry({ voided: true })), false);
});

test('a voided advance never counts', () => {
  assert.equal(historyFirstDatesIsPayment(entry({ type: 'advance', voided: true })), false);
});

test('a zero, negative or non-numeric amount never counts as a payment', () => {
  assert.equal(historyFirstDatesIsPayment(entry({ amountCents: 0 })), false);
  assert.equal(historyFirstDatesIsPayment(entry({ amountCents: -5000 })), false);
  assert.equal(historyFirstDatesIsPayment(entry({ amountCents: '3000' })), false);
  assert.equal(historyFirstDatesIsPayment(entry({ amountCents: Number.NaN })), false);
});

test('a missing or non-object entry never counts as a payment', () => {
  assert.equal(historyFirstDatesIsPayment(null), false);
  assert.equal(historyFirstDatesIsPayment('payment'), false);
  assert.equal(historyFirstDatesIsPayment({}), false);
});

test('the earliest bill wins, even when the entries arrive out of order', () => {
  const dates = historyFirstDates([
    entry({ type: 'charge', ref: 'BILL-3', date: '2026-11-05', amountCents: 200000 }),
    entry({ type: 'charge', ref: 'BILL-1', date: '2026-09-05', amountCents: 100000 }),
    entry({ type: 'charge', ref: 'BILL-2', date: '2026-10-05', amountCents: 300000 }),
  ]);
  assert.equal(dates.firstBillDate, '2026-09-05');
  assert.equal(dates.hasBill, true);
});

test('the earliest payment wins, even when the entries arrive out of order', () => {
  const dates = historyFirstDates([
    entry({ ref: 'PAY-3', date: '2026-11-06' }),
    entry({ ref: 'PAY-1', date: '2026-09-06' }),
    entry({ ref: 'PAY-2', date: '2026-10-06' }),
  ]);
  assert.equal(dates.firstPaymentDate, '2026-09-06');
  assert.equal(dates.hasPayment, true);
});

test('a month-only date counts as the first of that month for ordering', () => {
  const dates = historyFirstDates([
    entry({ type: 'charge', ref: 'BILL-2', date: '2026-10-05' }),
    entry({ type: 'charge', ref: 'BILL-1', date: '2026-09' }),
  ]);
  assert.equal(dates.firstBillDate, '2026-09');
});

test('an undated bill never wins the earliest spot, but still proves a bill exists', () => {
  const dates = historyFirstDates([
    entry({ type: 'charge', ref: 'BILL-1', date: '' }),
    entry({ type: 'charge', ref: 'BILL-2', date: '2026-10-05' }),
  ]);
  assert.equal(dates.firstBillDate, '2026-10-05');
  assert.equal(dates.hasBill, true);
});

test('a bill with no date at all reads as date not recorded, not a guessed date', () => {
  const dates = historyFirstDates([entry({ type: 'charge', ref: 'BILL-1', date: '' })]);
  assert.equal(dates.firstBillDate, '');
  assert.equal(dates.hasBill, true);
  assert.equal(
    historyFirstDatesText(dates),
    'First bill: date not recorded · First payment: no payment yet',
  );
});

test('an undated payment never wins the earliest spot, but still proves a payment exists', () => {
  const dates = historyFirstDates([
    entry({ ref: 'PAY-1', date: '' }),
    entry({ ref: 'PAY-2', date: '2026-10-06' }),
  ]);
  assert.equal(dates.firstPaymentDate, '2026-10-06');
  assert.equal(dates.hasPayment, true);
});

test('a payment with no date at all reads as date not recorded, not a guessed date', () => {
  const dates = historyFirstDates([entry({ ref: 'PAY-1', date: '' })]);
  assert.equal(dates.firstPaymentDate, '');
  assert.equal(dates.hasPayment, true);
  assert.equal(
    historyFirstDatesText(dates),
    'First bill: No bill yet · First payment: date not recorded',
  );
});

test('a voided earliest payment is skipped for the next payment', () => {
  const dates = historyFirstDates([
    entry({ ref: 'PAY-1', date: '2026-09-06', voided: true }),
    entry({ ref: 'PAY-2', date: '2026-10-06' }),
  ]);
  assert.equal(dates.firstPaymentDate, '2026-10-06');
});

test('a larger charge never counts as a payment', () => {
  const dates = historyFirstDates([
    entry({ type: 'charge', ref: 'BILL-1', date: '2026-09-05', amountCents: 900000 }),
    entry({ ref: 'PAY-1', date: '2026-11-06' }),
  ]);
  assert.equal(dates.firstBillDate, '2026-09-05');
  assert.equal(dates.firstPaymentDate, '2026-11-06');
});

test('an advance can be the first payment', () => {
  const dates = historyFirstDates([
    entry({ type: 'advance', ref: 'PAY-1', date: '2026-09-06' }),
    entry({ ref: 'PAY-2', date: '2026-10-06' }),
  ]);
  assert.equal(dates.firstPaymentDate, '2026-09-06');
});

test('no bill at all means no first bill date', () => {
  const dates = historyFirstDates([entry({ ref: 'PAY-1', date: '2026-09-06' })]);
  assert.equal(dates.firstBillDate, '');
  assert.equal(dates.hasBill, false);
});

test('no payment at all means no first payment date', () => {
  const dates = historyFirstDates([entry({ type: 'charge', ref: 'BILL-1', date: '2026-09-05' })]);
  assert.equal(dates.firstPaymentDate, '');
  assert.equal(dates.hasPayment, false);
});

test('a non-list input reads as no bill and no payment', () => {
  assert.deepEqual(historyFirstDates(null), {
    firstBillDate: '',
    firstPaymentDate: '',
    hasBill: false,
    hasPayment: false,
  });
  assert.deepEqual(historyFirstDates('not a list'), {
    firstBillDate: '',
    firstPaymentDate: '',
    hasBill: false,
    hasPayment: false,
  });
});

test('the first dates never change any entry', () => {
  const entries = [
    entry({ type: 'charge', ref: 'BILL-1', date: '2026-09-05' }),
    entry({ ref: 'PAY-1', date: '2026-09-06' }),
  ];
  const before = JSON.stringify(entries);
  historyFirstDates(entries);
  historyFirstDatesHtml(entries);
  assert.equal(JSON.stringify(entries), before);
});

test('the line carries both dates in plain words', () => {
  const text = historyFirstDatesText(historyFirstDates([
    entry({ type: 'charge', ref: 'BILL-1', date: '2026-09-05' }),
    entry({ ref: 'PAY-1', date: '2026-09-06' }),
  ]));
  assert.equal(text, 'First bill: 2026-09-05 · First payment: 2026-09-06');
});

test('a customer with no payment yet shows no payment yet', () => {
  const text = historyFirstDatesText(historyFirstDates([
    entry({ type: 'charge', ref: 'BILL-1', date: '2026-09-05' }),
  ]));
  assert.equal(text, 'First bill: 2026-09-05 · First payment: no payment yet');
  assert.equal(HISTORY_FIRST_DATES_NO_PAYMENT_TEXT, 'no payment yet');
});

test('a customer with no bill yet shows no bill yet', () => {
  const text = historyFirstDatesText(historyFirstDates([
    entry({ ref: 'PAY-1', date: '2026-09-06' }),
  ]));
  assert.equal(text, 'First bill: No bill yet · First payment: 2026-09-06');
  assert.equal(HISTORY_FIRST_DATES_NO_BILL_TEXT, 'No bill yet');
});

test('a month-only first bill date is shown exactly as recorded', () => {
  const text = historyFirstDatesText(historyFirstDates([
    entry({ type: 'charge', ref: 'BILL-1', date: '2026-09' }),
  ]));
  assert.equal(text, 'First bill: 2026-09 · First payment: no payment yet');
});

test('no first dates means no line text', () => {
  assert.equal(historyFirstDatesText(null), '');
  assert.equal(historyFirstDatesText(undefined), '');
  assert.equal(HISTORY_FIRST_DATES_DATE_NOT_RECORDED_TEXT, 'date not recorded');
});

test('the line html carries both dates', () => {
  const html = historyFirstDatesHtml([
    entry({ type: 'charge', ref: 'BILL-1', date: '2026-09-05' }),
    entry({ ref: 'PAY-1', date: '2026-09-06' }),
  ]);
  assert.equal(html, '<p class="notice">First bill: 2026-09-05 · First payment: 2026-09-06</p>');
});

test('the line html is empty when the history holds no entries at all', () => {
  assert.equal(historyFirstDatesHtml([]), '');
  assert.equal(historyFirstDatesHtml(null), '');
  assert.equal(historyFirstDatesHtml('not a list'), '');
});

test('the first dates agree with the full history list on the same fixture', () => {
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
  const dates = historyFirstDates(entries);
  assert.equal(dates.firstBillDate, '2026-09-05');
  assert.equal(dates.firstPaymentDate, '2026-09-06');
  assert.equal(
    historyFirstDatesText(dates),
    'First bill: 2026-09-05 · First payment: 2026-09-06',
  );
});

test('the line on a one-payment history from the full list shows that one payment', () => {
  const bills = [bill({
    id: 'BILL-1', month: '2026-11', dueDate: '2026-11-05', dueAmount: 2500,
    payments: [payment({ id: 'PAY-1', amount: 2500, date: '2026-11-06', method: 'Cash' })],
  })];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: [] });
  assert.equal(
    historyFirstDatesHtml(entries),
    '<p class="notice">First bill: 2026-11-05 · First payment: 2026-11-06</p>',
  );
});

test('the line on a bills-only history from the full list shows no payment yet', () => {
  const bills = [bill({ id: 'BILL-1', month: '2026-09', dueDate: '2026-09-05', dueAmount: 1000 })];
  const entries = fullHistoryEntries({ customerId: 'CUST-1', bills, creditEntries: [], refundRecords: [] });
  assert.equal(
    historyFirstDatesHtml(entries),
    '<p class="notice">First bill: 2026-09-05 · First payment: no payment yet</p>',
  );
});

test('the module is pure: no dates from the clock, no storage, no network', () => {
  const src = readFileSync(new URL('../history-first-dates.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /new Date\(/);
  assert.doesNotMatch(src, /Date\.now\(/);
  assert.doesNotMatch(src, /localStorage/);
  assert.doesNotMatch(src, /sessionStorage/);
  assert.doesNotMatch(src, /fetch\(/);
  assert.doesNotMatch(src, /shahdara_[a-z_]+_v\d/);
});

test('the module header never names a fenced module file literally', () => {
  const src = readFileSync(new URL('../history-first-dates.js', import.meta.url), 'utf8');
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
    'history-largest-' + 'payment.js',
  ];
  for (const name of fenced) assert.doesNotMatch(src, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('the history wires the first-dates line at the top, over the full history', () => {
  const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSrc, /import \{ historyFirstDatesHtml \} from '\.\/history-first-dates\.js';/);
  assert.match(appSrc, /#hfdHistoryFirstDates/);
  assert.match(appSrc, /historyFirstDatesHtml\(entries\)/);
  const htmlSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(htmlSrc, /id="hfdHistoryFirstDates"/);
  assert.ok(
    htmlSrc.indexOf('id="hfdHistoryFirstDates"') < htmlSrc.indexOf('id="fhlFullHistoryList"'),
    'the line sits above the history list',
  );
  assert.ok(
    htmlSrc.indexOf('id="hfdHistoryFirstDates"') > htmlSrc.indexOf('id="hlpHistoryLargestPayment"'),
    'the line sits after the largest-payment highlight, at the top of the history',
  );
  assert.ok(
    htmlSrc.indexOf('id="hfdHistoryFirstDates"') < htmlSrc.indexOf('id="htfHistoryTypeFilterHost"'),
    'the line sits at the top of the history, before the filters',
  );
});
