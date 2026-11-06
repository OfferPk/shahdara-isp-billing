// Plan 399: Transaction linked to the collection promise it fulfils.
//
// A customer promises to pay by a date and then pays, but the
// payment is never linked to the promise, so the promise stays open
// and the collector chases a customer who already paid. One link
// record joins a transaction to the promise it fulfils (promise
// reference, transaction reference, date), recorded when the payment
// is entered; it links only and it closes nothing by itself. A
// fulfilled promise shows its payment and the payment shows its
// promise; an unlinked promise stays open; the link never changes
// any bill, payment total, promise record, or customer record by
// itself.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROMISE_PAYMENT_LINK_PROMISE_ID_MAX_LENGTH,
  isStrictPromisePaymentLinkDate,
  normalizePromisePaymentLink,
  promisePaymentLinkOf,
  openPromisesForCustomer,
  promisePaymentLinkSelectOptions,
  paymentFulfillingPromise,
  promisePaymentLinkLineText,
  promisePaymentLinkMarkup,
  promiseFulfilmentLineHtml,
} from '../promise-payment-link.js';

import {
  addPayment,
  correctPayment,
  listTransactions,
  validatePayment,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';

import { executeQuickCollection } from '../nav-quick-collect.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (file) => fs.readFileSync(path.join(ROOT, '..', file), 'utf8');
const moduleSrc = readSrc('promise-payment-link.js');
const testSrc = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
const coreSrc = readSrc('core.js');
const appSrc = readSrc('app.js');
const indexSrc = readSrc('index.html');
const navSrc = readSrc('nav-quick-collect.js');
const stylesSrc = readSrc('styles.css');
const langSrc = readSrc('nav-language.js');

const NOV_6 = new Date('2026-11-06T12:00:00+05:00');
const SEP_5 = new Date('2026-09-05T12:00:00+05:00');
const PAYMENT_DATE = '2026-10-15';
const PROMISE_ID = 'CP-1001';

// The promise record shape the collection-promise panel stores:
// an operator-typed customer field, the amount promised, the date
// promised, and a paid date that stays empty until the promise is
// paid through its own panel action.
function promiseRecord(overrides = {}) {
  return {
    id: PROMISE_ID,
    customer: 'Customer One',
    amountPromised: 3000,
    promisedDate: '2026-11-10',
    paidDate: '',
    amountPaid: null,
    collector: 'Collector One',
    ...overrides,
  };
}

function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

function pay(state, month, amount, date, referenceDate, options = {}) {
  return addPayment(state, 'seed-001', month, { amount, date, method: 'Cash', ...options }, referenceDate);
}

function recordedPayment(state, month) {
  const customer = state.customers.find((c) => c.id === 'seed-001');
  const bill = customer.bills.find((b) => b.month === month);
  return bill.payments[bill.payments.length - 1];
}

// ---- Module units: dates and normalization ----

test('Plan 399: the promise-id cap is 64', () => {
  assert.equal(PROMISE_PAYMENT_LINK_PROMISE_ID_MAX_LENGTH, 64);
});

test('Plan 399: strict link dates are leap-aware', () => {
  assert.equal(isStrictPromisePaymentLinkDate('2028-02-29'), true, '2028 is a leap year');
  assert.equal(isStrictPromisePaymentLinkDate('2027-02-29'), false);
  assert.equal(isStrictPromisePaymentLinkDate('2026-11-31'), false, 'November has 30 days');
  assert.equal(isStrictPromisePaymentLinkDate('2026-11-10'), true);
  assert.equal(isStrictPromisePaymentLinkDate('2026-1-10'), false, 'month must be two digits');
  assert.equal(isStrictPromisePaymentLinkDate(''), false);
  assert.equal(isStrictPromisePaymentLinkDate(null), false);
});

test('Plan 399: normalize keeps an object link with its promise and date', () => {
  assert.deepEqual(
    normalizePromisePaymentLink({ promiseId: PROMISE_ID, date: '2026-11-10' }, '2026-10-15'),
    { promiseId: PROMISE_ID, date: '2026-11-10' },
  );
});

test('Plan 399: normalize accepts a plain string — the promise id only, dated by the payment day', () => {
  assert.deepEqual(
    normalizePromisePaymentLink(PROMISE_ID, '2026-10-15'),
    { promiseId: PROMISE_ID, date: '2026-10-15' },
  );
});

test('Plan 399: normalize falls back to the payment day when the link date is not strict', () => {
  assert.deepEqual(
    normalizePromisePaymentLink({ promiseId: PROMISE_ID, date: '2026-02-30' }, '2026-10-15'),
    { promiseId: PROMISE_ID, date: '2026-10-15' },
  );
  assert.deepEqual(
    normalizePromisePaymentLink({ promiseId: PROMISE_ID }, '2026-10-15'),
    { promiseId: PROMISE_ID, date: '2026-10-15' },
  );
});

test('Plan 399: normalize refuses a link with no promise id, or with no strict date anywhere', () => {
  assert.equal(normalizePromisePaymentLink({ promiseId: '', date: '2026-11-10' }, '2026-10-15'), null);
  assert.equal(normalizePromisePaymentLink({ date: '2026-11-10' }, '2026-10-15'), null);
  assert.equal(normalizePromisePaymentLink({ promiseId: PROMISE_ID, date: '2026-02-30' }, 'not-a-date'), null);
  assert.equal(normalizePromisePaymentLink(null, '2026-10-15'), null);
  assert.equal(normalizePromisePaymentLink(undefined, '2026-10-15'), null);
});

test('Plan 399: normalize caps the promise id at 64 characters and folds line breaks', () => {
  const longId = 'CP-' + '9'.repeat(70);
  const normalized = normalizePromisePaymentLink({ promiseId: longId, date: '2026-11-10' }, '2026-10-15');
  assert.equal(normalized.promiseId.length, 64);
  assert.equal(normalized.promiseId, longId.slice(0, 64));
  assert.deepEqual(
    normalizePromisePaymentLink({ promiseId: 'CP-\n1001', date: '2026-11-10' }, '2026-10-15'),
    { promiseId: 'CP- 1001', date: '2026-11-10' },
  );
});

test('Plan 399: the reader returns the link on the payment, or null when there is none', () => {
  assert.deepEqual(
    promisePaymentLinkOf({ promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' }, date: '2026-10-15' }),
    { promiseId: PROMISE_ID, date: '2026-11-10' },
  );
  assert.deepEqual(
    promisePaymentLinkOf({ promiseLink: PROMISE_ID, date: '2026-10-15' }),
    { promiseId: PROMISE_ID, date: '2026-10-15' },
  );
  assert.equal(promisePaymentLinkOf({ date: '2026-10-15' }), null);
  assert.equal(promisePaymentLinkOf({ promiseLink: { promiseId: '' }, date: '2026-10-15' }), null);
  assert.equal(promisePaymentLinkOf(null), null);
});

// ---- Module units: the open promises a payment can fulfil ----

test('Plan 399: open promises are the unpaid ones for the customer, earliest promised first', () => {
  const promises = [
    promiseRecord({ id: 'CP-1003', promisedDate: '2026-11-20' }),
    promiseRecord({ id: 'CP-1002', promisedDate: '2026-11-05' }),
    promiseRecord({ id: 'CP-1004', promisedDate: '2026-11-05' }),
  ];
  const open = openPromisesForCustomer(promises, { id: 'seed-001', name: 'Customer One' });
  assert.deepEqual(open.map((p) => p.id), ['CP-1002', 'CP-1004', 'CP-1003']);
});

test('Plan 399: a promise already carrying a paid date is never offered', () => {
  const promises = [
    promiseRecord({ id: 'CP-1001', paidDate: '2026-11-09' }),
    promiseRecord({ id: 'CP-1002', promisedDate: '2026-11-12' }),
  ];
  assert.deepEqual(
    openPromisesForCustomer(promises, { id: 'seed-001', name: 'Customer One' }).map((p) => p.id),
    ['CP-1002'],
  );
});

test('Plan 399: the promise matches by the customer name or the customer id, case-insensitively', () => {
  const byName = promiseRecord({ customer: 'customer one' });
  const byId = promiseRecord({ id: 'CP-1002', customer: 'SEED-001' });
  const other = promiseRecord({ id: 'CP-1003', customer: 'Customer Two' });
  const open = openPromisesForCustomer(
    [byName, byId, other],
    { id: 'seed-001', name: 'Customer One' },
  );
  assert.deepEqual(open.map((p) => p.id), [PROMISE_ID, 'CP-1002']);
  // A plain id string works too.
  assert.deepEqual(
    openPromisesForCustomer([byId], 'seed-001').map((p) => p.id),
    ['CP-1002'],
  );
});

test('Plan 399: damaged promise records can never offer themselves', () => {
  const promises = [
    promiseRecord({ id: '' }),
    promiseRecord({ id: 'CP-1002', customer: '' }),
    promiseRecord({ id: 'CP-1003', promisedDate: '2026-02-30' }),
    promiseRecord({ id: 'CP-1004', amountPromised: 0 }),
    promiseRecord({ id: 'CP-1005', amountPromised: 'not a number' }),
    promiseRecord({ id: 'CP-1006' }),
  ];
  assert.deepEqual(
    openPromisesForCustomer(promises, { id: 'seed-001', name: 'Customer One' }).map((p) => p.id),
    ['CP-1006'],
  );
  assert.deepEqual(openPromisesForCustomer(null, { id: 'seed-001', name: 'Customer One' }), []);
  assert.deepEqual(openPromisesForCustomer([promiseRecord()], null), []);
  assert.deepEqual(openPromisesForCustomer([promiseRecord()], ''), []);
});

test('Plan 399: the open list never mutates its input', () => {
  const promises = [
    promiseRecord({ id: 'CP-1003', promisedDate: '2026-11-20' }),
    promiseRecord({ id: 'CP-1002', promisedDate: '2026-11-05' }),
  ];
  const before = JSON.parse(JSON.stringify(promises));
  openPromisesForCustomer(promises, { id: 'seed-001', name: 'Customer One' });
  assert.deepEqual(promises, before);
});

// ---- Module units: the entry-form options ----

test('Plan 399: the picker offers a blank no-promise option first, then one per open promise', () => {
  const options = promisePaymentLinkSelectOptions(
    [promiseRecord(), promiseRecord({ id: 'CP-1002', amountPromised: 1500, promisedDate: '2026-11-12' })],
    '',
  );
  assert.equal(options.startsWith('<option value="" selected>No promise</option>'), true);
  assert.equal(options.includes('<option value="CP-1001">Rs 3000 promised by 2026-11-10 (CP-1001)</option>'), true);
  assert.equal(options.includes('<option value="CP-1002">Rs 1500 promised by 2026-11-12 (CP-1002)</option>'), true);
});

test('Plan 399: the picker honours the selected promise and escapes the id', () => {
  const options = promisePaymentLinkSelectOptions(
    [promiseRecord({ id: 'CP-<1001>' })],
    'CP-<1001>',
  );
  assert.equal(options.includes('<option value="CP-&lt;1001&gt;" selected>'), true);
  assert.equal(options.includes('Rs 3000 promised by 2026-11-10 (CP-&lt;1001&gt;)'), true);
  assert.equal(options.startsWith('<option value="">No promise</option>'), true);
  assert.equal(promisePaymentLinkSelectOptions([], ''), '<option value="" selected>No promise</option>');
});

// ---- Module units: finding the payment that fulfils a promise ----

test('Plan 399: the fulfilling payment is the earliest non-voided row naming the promise', () => {
  const rows = [
    { paymentId: 'p2', amount: 3000, date: '2026-11-10', promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' }, voided: true },
    { paymentId: 'p3', amount: 3000, date: '2026-11-11', promiseLink: { promiseId: PROMISE_ID, date: '2026-11-11' } },
    { paymentId: 'p1', amount: 3000, date: '2026-11-09', promiseLink: { promiseId: PROMISE_ID, date: '2026-11-09' } },
    { paymentId: 'p4', amount: 3000, date: '2026-11-09', promiseLink: { promiseId: PROMISE_ID, date: '2026-11-09' } },
  ];
  const found = paymentFulfillingPromise(PROMISE_ID, rows);
  assert.equal(found.paymentId, 'p1', 'the earliest dated non-voided row wins; the voided one never counts');
  assert.equal(paymentFulfillingPromise(PROMISE_ID, [rows[0]]), null);
  assert.equal(paymentFulfillingPromise('CP-9999', rows), null);
  assert.equal(paymentFulfillingPromise(PROMISE_ID, null), null);
  assert.equal(paymentFulfillingPromise('', rows), null);
});

// ---- Module units: the line, the markup, and the promise-panel line ----

test('Plan 399: the link line names the promise, with the payment beside it when supplied', () => {
  assert.equal(promisePaymentLinkLineText({ promiseId: PROMISE_ID, date: '2026-11-10' }), `Fulfils promise ${PROMISE_ID}`);
  assert.equal(
    promisePaymentLinkLineText({ promiseId: PROMISE_ID, date: '2026-11-10' }, { amount: 3000, date: '2026-11-10' }),
    `Fulfils promise ${PROMISE_ID} — Rs 3000 on 2026-11-10`,
  );
  assert.equal(promisePaymentLinkLineText(null), '');
  assert.equal(promisePaymentLinkLineText({ promiseId: '' }), '');
});

test('Plan 399: the markup is a dot suffix on the payment, or nothing when there is no link', () => {
  assert.equal(
    promisePaymentLinkMarkup({ promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' }, date: '2026-10-15' }),
    ` · Fulfils promise ${PROMISE_ID}`,
  );
  assert.equal(promisePaymentLinkMarkup({ date: '2026-10-15' }), '');
  assert.equal(promisePaymentLinkMarkup({ promiseLink: { promiseId: 'CP-<1001>', date: '2026-11-10' } }), ' · Fulfils promise CP-&lt;1001&gt;');
});

test('Plan 399: the promise panel shows the linked payment; an unlinked promise shows nothing', () => {
  const rows = [
    { paymentId: 'p1', amount: 3000, date: '2026-11-10', receiptNumber: 'RCPT-41-202611-01', promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' } },
  ];
  const formatAmount = (amount) => `PKR ${amount.toLocaleString('en-PK')}`;
  assert.equal(
    promiseFulfilmentLineHtml(promiseRecord(), rows, formatAmount),
    '<p>Linked payment: PKR 3,000 on 2026-11-10 (receipt RCPT-41-202611-01).</p>',
  );
  assert.equal(promiseFulfilmentLineHtml(promiseRecord(), [], formatAmount), '');
  assert.equal(promiseFulfilmentLineHtml(promiseRecord({ id: 'CP-9999' }), rows, formatAmount), '');
  // Without a formatter the amount reads as plain Rs.
  assert.equal(
    promiseFulfilmentLineHtml(promiseRecord(), rows),
    '<p>Linked payment: Rs 3000 on 2026-11-10 (receipt RCPT-41-202611-01).</p>',
  );
});

test('Plan 399: the promise-panel line never counts a voided payment and never implies closure', () => {
  const rows = [
    { paymentId: 'p1', amount: 3000, date: '2026-11-10', voided: true, promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' } },
  ];
  assert.equal(promiseFulfilmentLineHtml(promiseRecord(), rows, (amount) => `PKR ${amount}`), '');
  const line = promiseFulfilmentLineHtml(promiseRecord(), [
    { paymentId: 'p1', amount: 3000, date: '2026-11-10', promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' } },
  ], (amount) => `PKR ${amount}`);
  assert.equal(line.includes('kept'), false, 'the line says linked, never kept');
  assert.equal(line.includes('paid'), false, 'the line says linked, never paid');
  assert.equal(line.includes('Linked payment'), true);
});

// ---- Core wiring: the link rides the payment record ----

test('Plan 399: validatePayment stores the link on the payment', () => {
  const payment = validatePayment(
    { amount: '3000', date: PAYMENT_DATE, method: 'Cash', promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' } },
    NOV_6,
  );
  assert.deepEqual(payment.promiseLink, { promiseId: PROMISE_ID, date: '2026-11-10' });
  const byString = validatePayment(
    { amount: '3000', date: PAYMENT_DATE, method: 'Cash', promiseLink: PROMISE_ID },
    NOV_6,
  );
  assert.deepEqual(byString.promiseLink, { promiseId: PROMISE_ID, date: PAYMENT_DATE });
});

test('Plan 399: validatePayment stores nothing without a promise id', () => {
  const payment = validatePayment({ amount: '3000', date: PAYMENT_DATE, method: 'Cash' }, NOV_6);
  assert.equal('promiseLink' in payment, false);
  const empty = validatePayment(
    { amount: '3000', date: PAYMENT_DATE, method: 'Cash', promiseLink: { promiseId: '' } },
    NOV_6,
  );
  assert.equal('promiseLink' in empty, false);
});

test('Plan 399: addPayment records the link with the transaction, and no link means no field', () => {
  const state = stateWithBills(NOV_6);
  const linked = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, {
    promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' },
  });
  assert.deepEqual(recordedPayment(linked, '2026-10').promiseLink, { promiseId: PROMISE_ID, date: '2026-11-10' });
  const plain = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6);
  assert.equal('promiseLink' in recordedPayment(plain, '2026-10'), false);
});

test('Plan 399: listTransactions projects the link onto the transaction row', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, {
    promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' },
  });
  const row = listTransactions(next, {}, NOV_6).find((entry) => entry.promiseLink?.promiseId === PROMISE_ID);
  assert.equal(row !== undefined, true);
  assert.deepEqual(row.promiseLink, { promiseId: PROMISE_ID, date: '2026-11-10' });
});

test('Plan 399: correctPayment carries the link over, replaces it explicitly, and clears it on null', () => {
  const state = stateWithBills(NOV_6);
  const linked = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, {
    promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' },
  });
  const payment = recordedPayment(linked, '2026-10');
  const silent = correctPayment(linked, 'seed-001', '2026-10', payment.id, {
    amount: '3000', date: PAYMENT_DATE, method: 'Cash', reference: payment.reference,
  }, NOV_6);
  assert.deepEqual(recordedPayment(silent, '2026-10').promiseLink, { promiseId: PROMISE_ID, date: '2026-11-10' });
  const replaced = correctPayment(linked, 'seed-001', '2026-10', payment.id, {
    amount: '3000', date: PAYMENT_DATE, method: 'Cash', reference: payment.reference,
    promiseLink: { promiseId: 'CP-1002', date: '2026-11-12' },
  }, NOV_6);
  assert.deepEqual(recordedPayment(replaced, '2026-10').promiseLink, { promiseId: 'CP-1002', date: '2026-11-12' });
  const cleared = correctPayment(linked, 'seed-001', '2026-10', payment.id, {
    amount: '3000', date: PAYMENT_DATE, method: 'Cash', reference: payment.reference,
    promiseLink: null,
  }, NOV_6);
  assert.equal('promiseLink' in recordedPayment(cleared, '2026-10'), false);
});

test('Plan 399: acceptance — the link never changes any bill, payment total, or promise record by itself', () => {
  const base = stateWithBills(NOV_6);
  const promises = [promiseRecord()];
  const withLink = pay(base, '2026-10', '3000', PAYMENT_DATE, NOV_6, {
    promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' },
  });
  const withoutLink = pay(base, '2026-10', '3000', PAYMENT_DATE, NOV_6);
  // Every month's remaining balance is identical with and without it.
  for (const month of ['2026-09', '2026-10', '2026-11']) {
    assert.equal(
      calculatePaymentAllocations(withLink).forMonth('seed-001', month).balanceDueCents,
      calculatePaymentAllocations(withoutLink).forMonth('seed-001', month).balanceDueCents,
      `${month} balance must not move because a link was recorded`,
    );
  }
  // The recorded payment is identical except for the link itself
  // (and the random id every payment carries).
  const linked = recordedPayment(withLink, '2026-10');
  const plain = recordedPayment(withoutLink, '2026-10');
  const { promiseLink: _linked, id: _linkedId, ...linkedRest } = linked;
  const { promiseLink: _plain, id: _plainId, ...plainRest } = plain;
  assert.deepEqual(linkedRest, plainRest);
  // The promise record is untouched: still open, no paid date filled.
  assert.deepEqual(promises, [promiseRecord()], 'recording the link must not write the promise record');
});

test('Plan 399: the link and the category tag are independent notes on one payment', () => {
  const state = stateWithBills(NOV_6);
  const next = pay(state, '2026-10', '3000', PAYMENT_DATE, NOV_6, {
    promiseLink: { promiseId: PROMISE_ID, date: '2026-11-10' },
    categoryTag: 'collection',
  });
  const recorded = recordedPayment(next, '2026-10');
  assert.deepEqual(recorded.promiseLink, { promiseId: PROMISE_ID, date: '2026-11-10' });
  assert.equal(recorded.categoryTag, 'collection');
});

// ---- Quick Collect end to end ----

test('Plan 399: executeQuickCollection records the link on the payment it saves', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-05', method: 'Cash',
    promiseLink: { promiseId: PROMISE_ID, date: '2026-09-05' },
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.deepEqual(payment.promiseLink, { promiseId: PROMISE_ID, date: '2026-09-05' });
  assert.equal(payment.amount, 3000);
});

test('Plan 399: executeQuickCollection without a link records no link field', () => {
  const state = stateWithBills(SEP_5);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-05', method: 'Cash',
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.equal('promiseLink' in payment, false);
});

// ---- Wiring: the link appears on the transaction and on the promise ----

test('Plan 399: app.js imports the link helpers and shows the link on both profile history rows and the Transactions card', () => {
  assert.equal(appSrc.includes("from './promise-payment-link.js'"), true);
  assert.equal(appSrc.includes('promisePaymentLinkMarkup'), true);
  const rowCount = appSrc.split('${profileCategoryTagMarkup(payment)}${profilePromisePaymentLinkMarkup(payment)}').length - 1;
  assert.equal(rowCount, 2, 'the link must sit beside the category tag on both profile history rows');
  assert.equal(appSrc.includes('${transactionCategoryTagMarkup(transaction)}${transactionPromisePaymentLinkMarkup(transaction)}'), true);
});

test('Plan 399: core.js validates, carries, and projects the link', () => {
  assert.equal(coreSrc.includes("from './promise-payment-link.js'"), true);
  assert.equal(coreSrc.includes('normalizePromisePaymentLink(promiseLink, date)'), true);
  assert.equal(coreSrc.includes('promiseLink: fields.promiseLink !== undefined ? fields.promiseLink : existingPayment.promiseLink'), true);
  assert.equal(coreSrc.includes('promiseLink: promisePaymentLinkOf(payment)'), true);
});

test('Plan 399: the profile payment form offers the promise picker and the submit carries it', () => {
  assert.equal(appSrc.includes('promisePaymentLinkFieldMarkup'), true);
  assert.equal(appSrc.includes('ppl-${month}'), true);
  assert.equal(appSrc.includes('name="promiseLink"'), true);
  assert.equal(appSrc.includes("promiseLink: data.get('promiseLink') || undefined,"), true);
});

test('Plan 399: the Quick Collect form offers the promise picker and the submit carries it', () => {
  assert.equal(indexSrc.includes('id="quickCollectPromiseLinkSelect"'), true);
  assert.equal(indexSrc.includes('<option value="">No promise</option>'), true);
  assert.equal(navSrc.includes('promiseLinkSelect?.value'), true);
  assert.equal(navSrc.includes('promiseLink: promiseLinkVal ? { promiseId: promiseLinkVal } : undefined,'), true);
  assert.equal(navSrc.includes('promiseLink: promiseLink || undefined,'), true);
  assert.equal(navSrc.includes('if (promiseLinkSelect) {'), true);
  assert.equal(navSrc.includes("promiseLinkSelect.value = '';"), true);
});

test('Plan 399: the promise panel shows the linked payment beside each promise', () => {
  assert.equal(appSrc.includes('promiseFulfilmentLineHtml(p, rows, formatAmount)'), true);
  assert.equal(appSrc.includes('promisePaymentLinkSelectOptions'), true);
  assert.equal(appSrc.includes('openPromisesForCustomer'), true);
});

// ---- Fences: the promise record, neighbours, receipts ----

test('Plan 399: the module header never names a fenced filename literally', () => {
  const promiseModule = 'collection-' + 'promise.js';
  const trackerModule = 'promise-' + 'tracker.js';
  const deliveryModule = 'promise-delivery-' + 'check.js';
  const crossModule = 'cross-payment-' + 'note.js';
  const queueModule = 'offline-queue-' + 'status.js';
  for (const fenced of [promiseModule, trackerModule, deliveryModule, crossModule, queueModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(testSrc.includes(fenced), false, fenced);
  }
});

test('Plan 399: the promise record module never reads the link — untouched', () => {
  const promiseModule = 'collection-' + 'promise.js';
  const src = fs.readFileSync(path.join(ROOT, '..', promiseModule), 'utf8');
  assert.equal(src.includes('promiseLink'), false, promiseModule);
  assert.equal(src.includes('promisePaymentLink'), false, promiseModule);
});

test('Plan 399: the link path never writes a promise record — it never calls the promise payment recorder', () => {
  const recorder = 'recordCollection' + 'PromisePayment';
  assert.equal(moduleSrc.includes(recorder), false, 'the module must never call the promise payment recorder');
  assert.equal(coreSrc.includes(recorder), false, 'the core must never call the promise payment recorder from the link path');
  assert.equal(navSrc.includes(recorder), false, 'Quick Collect must never call the promise payment recorder from the link path');
});

test('Plan 399: the receipt never reads the link — receipts are untouched', () => {
  const receiptModule = 'receipt-' + 'script.js';
  for (const file of ['receipt.js', receiptModule, 'png-receipt.js']) {
    const src = fs.readFileSync(path.join(ROOT, '..', file), 'utf8');
    assert.equal(src.includes('promisePaymentLinkOf'), false, file);
    assert.equal(src.includes('normalizePromisePaymentLink'), false, file);
  }
});

test('Plan 399: no new store — the link rides the payment record', () => {
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('shahdara_'), false);
  assert.equal(coreSrc.includes('shahdara_promise_link'), false);
});

test('Plan 399: no new styling and no new language keys', () => {
  assert.equal(stylesSrc.includes('.ppl-'), false);
  assert.equal(stylesSrc.includes('promise-payment-link'), false);
  assert.equal(langSrc.includes('promiseLink'), false);
  assert.equal(indexSrc.includes('quickCollectPromiseLinkSelect'), true);
});

test('Plan 399: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.ok(!mobilePattern.test(testSrc), 'test carries a realistic phone number');
  assert.ok(!testSrc.includes(fakeFamily), 'test carries a phone-like number');
  for (const name of ['Ki' + 'ran', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Ahmed ' + 'Khan']) {
    assert.ok(!testSrc.includes(name), `test carries a real customer name: ${name}`);
  }
});
