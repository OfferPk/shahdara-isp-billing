// Plan 426 — Quick Collect one-screen payment flow:
// one single screen for the whole quick payment (customer, amount,
// method, save) with no navigation in between. The screen only
// collects the four fields and validates them into a draft; the
// payment itself is recorded by the normal submit path, so a payment
// recorded on the one screen appears in the ledger exactly as a
// payment recorded the normal way, and leaving the screen without
// saving records nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUICK_COLLECT_ONE_SCREEN_CHOOSE_CUSTOMER_TEXT,
  QUICK_COLLECT_ONE_SCREEN_CHOOSE_METHOD_TEXT,
  QUICK_COLLECT_ONE_SCREEN_SAVE_TEXT,
  QUICK_COLLECT_ONE_SCREEN_BACK_TEXT,
  QUICK_COLLECT_ONE_SCREEN_NO_CUSTOMER_TEXT,
  QUICK_COLLECT_ONE_SCREEN_NO_AMOUNT_TEXT,
  QUICK_COLLECT_ONE_SCREEN_NO_METHOD_TEXT,
  QUICK_COLLECT_ONE_SCREEN_BAD_DATE_TEXT,
  QUICK_COLLECT_ONE_SCREEN_BAD_MONTH_TEXT,
  quickCollectOneScreenCustomerOptions,
  quickCollectOneScreenMethodOptions,
  quickCollectOneScreenAmountCents,
  quickCollectOneScreenFormatAmount,
  quickCollectOneScreenDuesText,
  quickCollectOneScreenIsStrictDate,
  quickCollectOneScreenIsStrictMonth,
  quickCollectOneScreenDraft,
  quickCollectOneScreenHtml,
} from '../quick-collect-one-screen.js';

const METHODS = ['Cash', 'JazzCash', 'Easypaisa', 'Bank Transfer', 'Raast'];

function customers() {
  return [
    { id: 'CUST-2', name: 'Customer Two', customerNumber: 2 },
    { id: 'CUST-1', name: 'Customer One', customerNumber: 1 },
    { id: 'CUST-3', name: 'customer three', customerNumber: 3 },
  ];
}

function draft(overrides = {}) {
  return quickCollectOneScreenDraft({
    customerId: 'CUST-1',
    amountText: '1500',
    method: 'Cash',
    methods: METHODS,
    dateText: '',
    month: '',
    ...overrides,
  });
}

test('customer options are sorted by name and labelled with the customer number', () => {
  const options = quickCollectOneScreenCustomerOptions(customers());
  assert.deepEqual(options.map((option) => option.value), ['CUST-1', 'CUST-3', 'CUST-2']);
  assert.equal(options[0].label, 'Customer One (#1)');
  assert.equal(options[1].label, 'customer three (#3)');
});

test('customer options skip entries without a usable id or name', () => {
  const options = quickCollectOneScreenCustomerOptions([
    { id: 'CUST-1', name: 'Customer One', customerNumber: 1 },
    { id: '', name: 'No Id' },
    { id: 'CUST-9', name: '' },
    { name: 'No Id At All' },
    null,
    'not-an-object',
  ]);
  assert.deepEqual(options, [{ value: 'CUST-1', label: 'Customer One (#1)' }]);
});

test('a customer without a number is labelled by name alone, never a guessed number', () => {
  const options = quickCollectOneScreenCustomerOptions([{ id: 'CUST-1', name: 'Customer One' }]);
  assert.deepEqual(options, [{ value: 'CUST-1', label: 'Customer One' }]);
});

test('customer options accept the alternate name and number fields', () => {
  const options = quickCollectOneScreenCustomerOptions([
    { id: 'CUST-1', customerName: 'Customer One', number: 7 },
  ]);
  assert.deepEqual(options, [{ value: 'CUST-1', label: 'Customer One (#7)' }]);
});

test('customer options are empty for an empty or missing list', () => {
  assert.deepEqual(quickCollectOneScreenCustomerOptions([]), []);
  assert.deepEqual(quickCollectOneScreenCustomerOptions(), []);
  assert.deepEqual(quickCollectOneScreenCustomerOptions(null), []);
});

test('method options keep the caller order and skip empty entries', () => {
  assert.deepEqual(quickCollectOneScreenMethodOptions(['Cash', '', 'JazzCash', null, 'Easypaisa']), [
    { value: 'Cash', label: 'Cash' },
    { value: 'JazzCash', label: 'JazzCash' },
    { value: 'Easypaisa', label: 'Easypaisa' },
  ]);
  assert.deepEqual(quickCollectOneScreenMethodOptions([]), []);
});

test('amount cents: a null, undefined, empty, or boolean figure is not a number, never zero', () => {
  assert.equal(quickCollectOneScreenAmountCents(null), null);
  assert.equal(quickCollectOneScreenAmountCents(undefined), null);
  assert.equal(quickCollectOneScreenAmountCents(''), null);
  assert.equal(quickCollectOneScreenAmountCents('   '), null);
  assert.equal(quickCollectOneScreenAmountCents(true), null);
  assert.equal(quickCollectOneScreenAmountCents(false), null);
});

test('amount cents: whole rupees and paisa both convert exactly', () => {
  assert.equal(quickCollectOneScreenAmountCents('1500'), 150000);
  assert.equal(quickCollectOneScreenAmountCents('1500.5'), 150050);
  assert.equal(quickCollectOneScreenAmountCents(1500), 150000);
  assert.equal(quickCollectOneScreenAmountCents(' 2000 '), 200000);
});

test('amount cents: zero, negative, and non-numeric figures are not amounts', () => {
  assert.equal(quickCollectOneScreenAmountCents('0'), null);
  assert.equal(quickCollectOneScreenAmountCents('-5'), null);
  assert.equal(quickCollectOneScreenAmountCents('abc'), null);
  assert.equal(quickCollectOneScreenAmountCents('1,500'), null);
});

test('amount formatting uses min-0 decimals, like the rest of the app', () => {
  assert.equal(quickCollectOneScreenFormatAmount(150000), 'PKR 1,500');
  assert.equal(quickCollectOneScreenFormatAmount(150050), 'PKR 1,500.5');
  assert.equal(quickCollectOneScreenFormatAmount(0), 'PKR 0');
  assert.equal(quickCollectOneScreenFormatAmount(null), '');
  assert.equal(quickCollectOneScreenFormatAmount(true), '');
});

test('dues text names the dues in plain words and stays empty without a usable figure', () => {
  // Plan 525: the line names the payable figure — the same figure the
  // amount field prefills — so a pending charge never makes the line
  // disagree with the amount above it. The figure itself is unchanged
  // (the caller passes it); only the label changed.
  assert.equal(quickCollectOneScreenDuesText(150000), 'Total payable: PKR 1,500');
  assert.equal(quickCollectOneScreenDuesText(0), 'Total payable: PKR 0');
  assert.equal(quickCollectOneScreenDuesText(null), '');
  assert.equal(quickCollectOneScreenDuesText(-100), '');
});

test('strict dates accept real days and refuse impossible ones, including leap rules', () => {
  assert.equal(quickCollectOneScreenIsStrictDate('2026-11-07'), true);
  assert.equal(quickCollectOneScreenIsStrictDate('2000-02-29'), true);
  assert.equal(quickCollectOneScreenIsStrictDate('2026-02-29'), false);
  assert.equal(quickCollectOneScreenIsStrictDate('2026-02-30'), false);
  assert.equal(quickCollectOneScreenIsStrictDate('2026-13-01'), false);
  assert.equal(quickCollectOneScreenIsStrictDate('2026-11'), false);
  assert.equal(quickCollectOneScreenIsStrictDate('2026-11-07T00:00'), false);
  assert.equal(quickCollectOneScreenIsStrictDate(null), false);
});

test('strict months accept YYYY-MM and refuse anything else', () => {
  assert.equal(quickCollectOneScreenIsStrictMonth('2026-11'), true);
  assert.equal(quickCollectOneScreenIsStrictMonth('2026-13'), false);
  assert.equal(quickCollectOneScreenIsStrictMonth('2026-1'), false);
  assert.equal(quickCollectOneScreenIsStrictMonth('2026-11-07'), false);
  assert.equal(quickCollectOneScreenIsStrictMonth(''), false);
});

test('a complete draft carries exactly the fields the normal submit path records', () => {
  const result = draft({ dateText: '2026-11-07', month: '2026-11' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.draft, {
    customerId: 'CUST-1',
    amountCents: 150000,
    amount: 1500,
    method: 'Cash',
    date: '2026-11-07',
    month: '2026-11',
  });
});

test('an empty date and month in the draft mean today and the target month, supplied by the caller', () => {
  const result = draft();
  assert.equal(result.ok, true);
  assert.equal(result.draft.date, '');
  assert.equal(result.draft.month, '');
});

test('a draft with no customer names the customer field', () => {
  const result = draft({ customerId: '' });
  assert.equal(result.ok, false);
  assert.equal(result.field, 'customer');
  assert.equal(result.reason, QUICK_COLLECT_ONE_SCREEN_NO_CUSTOMER_TEXT);
});

test('a draft with no usable amount names the amount field', () => {
  for (const amountText of ['', '0', '-100', 'abc', null, true]) {
    const result = draft({ amountText });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'amount');
    assert.equal(result.reason, QUICK_COLLECT_ONE_SCREEN_NO_AMOUNT_TEXT);
  }
});

test('a draft with no method names the method field', () => {
  const result = draft({ method: '' });
  assert.equal(result.ok, false);
  assert.equal(result.field, 'method');
  assert.equal(result.reason, QUICK_COLLECT_ONE_SCREEN_NO_METHOD_TEXT);
});

test('a draft with a method outside the offered list names the method field', () => {
  const result = draft({ method: 'Barter' });
  assert.equal(result.ok, false);
  assert.equal(result.field, 'method');
  assert.equal(result.reason, QUICK_COLLECT_ONE_SCREEN_NO_METHOD_TEXT);
});

test('a draft with an impossible date names the date field', () => {
  const result = draft({ dateText: '2026-02-30' });
  assert.equal(result.ok, false);
  assert.equal(result.field, 'date');
  assert.equal(result.reason, QUICK_COLLECT_ONE_SCREEN_BAD_DATE_TEXT);
});

test('a draft with an impossible month names the month field', () => {
  const result = draft({ month: '2026-13' });
  assert.equal(result.ok, false);
  assert.equal(result.field, 'month');
  assert.equal(result.reason, QUICK_COLLECT_ONE_SCREEN_BAD_MONTH_TEXT);
});

test('the one-screen HTML carries customer, amount, method, and save on one screen', () => {
  const html = quickCollectOneScreenHtml({ customers: customers(), methods: METHODS });
  assert.match(html, /id="qosOneScreenCustomer"/);
  assert.match(html, /id="qosOneScreenAmount"/);
  assert.match(html, /id="qosOneScreenMethod"/);
  assert.match(html, /id="qosOneScreenSaveBtn"/);
  assert.match(html, /id="qosOneScreenBackBtn"/);
  assert.match(html, /id="qosOneScreenDues"/);
  assert.match(html, new RegExp(QUICK_COLLECT_ONE_SCREEN_SAVE_TEXT));
  assert.match(html, new RegExp(QUICK_COLLECT_ONE_SCREEN_BACK_TEXT));
});

// QC Modal Fix: the native selects are gone — the customers are
// combobox options and the methods are 1-tap pills. The HTML still
// lists every customer and every method, only the controls changed.
test('the one-screen HTML lists every customer as a combobox option and every method as a pill', () => {
  const html = quickCollectOneScreenHtml({ customers: customers(), methods: METHODS });
  assert.match(html, /Customer One \(#1\)/);
  assert.match(html, /Customer Two \(#2\)/);
  assert.match(html, /customer three \(#3\)/);
  assert.match(html, /data-qos-customer-id="CUST-1"/);
  assert.match(html, /data-qos-customer-id="CUST-2"/);
  assert.match(html, /data-qos-customer-id="CUST-3"/);
  for (const method of METHODS) {
    assert.match(html, new RegExp(`data-qos-method="${method}"`));
  }
  assert.doesNotMatch(html, /<select/);
  assert.doesNotMatch(html, /<option/);
});

test('the one-screen HTML honours a selected customer, amount, and method', () => {
  const html = quickCollectOneScreenHtml({
    customers: customers(),
    methods: METHODS,
    selectedCustomerId: 'CUST-2',
    amountText: '2000',
    method: 'JazzCash',
  });
  assert.match(html, /id="qosOneScreenCustomer" type="hidden" value="CUST-2"/);
  assert.match(html, /value="Customer Two \(#2\)"/);
  assert.match(html, /data-qos-method="JazzCash"[^>]*aria-checked="true"|aria-checked="true"[^>]*data-qos-method="JazzCash"/);
  assert.match(html, /value="2000"/);
  assert.match(html, /✓ Save Payment \(PKR 2,000\)/);
});

test('the one-screen HTML escapes customer names, never raw markup', () => {
  const html = quickCollectOneScreenHtml({
    customers: [{ id: 'CUST-1', name: '<script>alert(1)</script>', customerNumber: 1 }],
    methods: METHODS,
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('the one-screen HTML with no customers still offers the save screen, not a guessed customer', () => {
  const html = quickCollectOneScreenHtml({ customers: [], methods: METHODS });
  assert.match(html, /id="qosOneScreenCustomer"/);
  assert.match(html, /id="qosOneScreenCustomer" type="hidden" value=""/);
  assert.doesNotMatch(html, /data-qos-customer-id="CUST-/);
});

// The module records nothing itself: it is import-free, touches no
// store, date, document, or network, and never calls the recorder.
test('the module is pure: no imports, no store, no date, no document, no recorder call', () => {
  const source = readFileSync(new URL('../quick-collect-one-screen.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\s/);
  assert.doesNotMatch(source, /require\(/);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /new Date\(/);
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /addPayment/);
});

// The module header never names a fenced module's filename literally
// (each name below is built from fragments so the test itself does
// not carry the literal either).
test('the module header names no fenced filename literally', () => {
  const source = readFileSync(new URL('../quick-collect-one-screen.js', import.meta.url), 'utf8');
  const fenced = [
    ['nav', '-', 'quick', '-', 'collect', '.', 'js'].join(''),
    ['full', '-', 'history', '-', 'list', '.', 'js'].join(''),
    ['transaction', '-', 'prefill', '.', 'js'].join(''),
    ['save', '-', 'confirmation', '-', 'summary', '.', 'js'].join(''),
  ];
  for (const name of fenced) {
    assert.doesNotMatch(source, new RegExp(name.replace('.', '\\.')));
  }
});

// Wiring: the one-screen step lives in the Quick Collect modal and
// its save drives the normal payment form submit, so the ledger
// cannot tell the payment came from the one screen.
test('wiring: the one-screen step is wired into the Quick Collect flow', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(wiring, /quick-collect-one-screen\.js/);
  assert.match(wiring, /quickCollectOneScreenHtml/);
  assert.match(wiring, /quickCollectOneScreenDraft/);
  assert.match(wiring, /stepOneScreen/);
  assert.match(wiring, /showStep\('one-screen'\)/);
  assert.match(wiring, /openOneScreen/);
  assert.match(wiring, /paymentForm\.requestSubmit\(\)/);
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(index, /id="quickCollectStepOneScreen"/);
  assert.match(index, /id="quickCollectOpenOneScreenBtn"/);
});

test('wiring: the one-screen save never records a payment by itself', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const start = wiring.indexOf('function submitOneScreenPayment');
  assert.notEqual(start, -1);
  const end = wiring.indexOf('function openOneScreen', start);
  assert.notEqual(end, -1);
  const saveBlock = wiring.slice(start, end);
  assert.doesNotMatch(saveBlock, /addPayment\(/);
  assert.match(saveBlock, /requestSubmit\(\)/);
});

test('wiring: leaving the one screen without saving records nothing', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const start = wiring.indexOf('function openOneScreen');
  assert.notEqual(start, -1);
  const block = wiring.slice(start, start + 1200);
  assert.doesNotMatch(block, /onSaveState\(/);
  assert.doesNotMatch(block, /addPayment\(/);
});
