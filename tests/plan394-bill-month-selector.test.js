// Plan 394 — Transaction bill-month selector at entry time: on
// the transaction entry form, the operator picks which month's bill
// this payment is for — "this is for last month" — together with
// the customer, and the payment is recorded on that month's bill.
// The choice is recorded only: picking a month settles nothing,
// changes no bill, no payment total, and no customer record by
// itself; the save is what records the payment, on the chosen bill,
// exactly as the entry form already records a payment on its own
// month when no choice is made. A payment with no choice goes on
// the form's own month, so the allocation rules apply exactly as
// before. A choice that is not a strict YYYY-MM month reads as no
// choice, so a damaged value can never invent a bill month.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isStrictBillMonth,
  normalizeBillMonthChoice,
  billMonthChoiceOf,
  billMonthLabel,
  billMonthSelectOptions,
  billMonthChoiceLineText,
} from '../bill-month-selector.js';
import {
  addPayment,
  listTransactions,
  calculatePaymentAllocations,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
} from '../core.js';
import { billMonthDiffers } from '../payments-list.js';

const SEP_5 = new Date('2026-09-05T12:00:00Z');
const NOV_5 = new Date('2026-11-05T12:00:00Z');

function stateWithBills(monthlySellingAmount = 3000) {
  let state = createInitialState(['Customer One', 'Customer Two']);
  // Priced from September so the fixture carries Sep, Oct and Nov
  // 2026 bills (the Plan 385 pattern): a November-only pricing
  // leaves October unpriced, and a payment for October would create
  // an unpriced bill instead of settling a priced one.
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: String(monthlySellingAmount) }, SEP_5);
  return generateMonthlyBillsThroughCurrentMonth(state, NOV_5);
}

function payOnMonth(state, customerId, month, options = {}) {
  return addPayment(state, customerId, month, {
    amount: 3000,
    date: '2026-11-05',
    method: 'Cash',
    ...options,
  }, NOV_5);
}

function billOf(state, customerId, month) {
  return state.customers.find((entry) => entry.id === customerId)?.bills.find((bill) => bill.month === month);
}

// --- Strict month ---

test('Plan 394: isStrictBillMonth accepts only YYYY-MM with month 01-12', () => {
  for (const month of ['2026-01', '2026-06', '2026-11', '2026-12', '1999-06']) {
    assert.equal(isStrictBillMonth(month), true, month);
  }
  for (const bad of ['2026-00', '2026-13', '2026-1', '2026/11', 'Nov 2026', '', '2026-11-05', ' 2026-11', '2026-11 ', null, undefined, 202611, {}, []]) {
    assert.equal(isStrictBillMonth(bad), false, String(bad));
  }
});

// --- Choice normalization ---

test('Plan 394: normalizeBillMonthChoice keeps a strict choice, falls back otherwise', () => {
  assert.equal(normalizeBillMonthChoice('2026-10', '2026-11'), '2026-10');
  assert.equal(normalizeBillMonthChoice('', '2026-11'), '2026-11');
  assert.equal(normalizeBillMonthChoice('2026-13', '2026-11'), '2026-11');
  assert.equal(normalizeBillMonthChoice(null, '2026-11'), '2026-11');
  assert.equal(normalizeBillMonthChoice(undefined, '2026-11'), '2026-11');
  assert.equal(normalizeBillMonthChoice(202610, '2026-11'), '2026-11');
  assert.equal(normalizeBillMonthChoice('2026-10', 'bad'), '2026-10');
  assert.equal(normalizeBillMonthChoice('', ''), '');
  assert.equal(normalizeBillMonthChoice('bad', 'also-bad'), '');
  assert.equal(normalizeBillMonthChoice(undefined, undefined), '');
});

// --- Reading the choice from a form ---

test('Plan 394: billMonthChoiceOf reads FormData-like and plain objects', () => {
  const formData = { get: (key) => (key === 'billMonth' ? '2026-09' : null) };
  assert.equal(billMonthChoiceOf(formData, '2026-11'), '2026-09');
  assert.equal(billMonthChoiceOf({ billMonth: '2026-09' }, '2026-11'), '2026-09');
  assert.equal(billMonthChoiceOf({}, '2026-11'), '2026-11');
  assert.equal(billMonthChoiceOf({ billMonth: '' }, '2026-11'), '2026-11');
  assert.equal(billMonthChoiceOf({ billMonth: '2026-13' }, '2026-11'), '2026-11');
  assert.equal(billMonthChoiceOf(null, '2026-11'), '2026-11');
  assert.equal(billMonthChoiceOf(undefined, '2026-11'), '2026-11');
  assert.equal(billMonthChoiceOf({ billMonth: '2026-09' }, 'bad'), '2026-09');
});

// --- Labels and option lists ---

test('Plan 394: billMonthLabel names the month in plain words', () => {
  assert.equal(billMonthLabel('2026-11'), 'November 2026');
  assert.equal(billMonthLabel('2026-01'), 'January 2026');
  assert.equal(billMonthLabel('2026-12'), 'December 2026');
  assert.equal(billMonthLabel('2026-13'), '');
  assert.equal(billMonthLabel(''), '');
  assert.equal(billMonthLabel(null), '');
});

test('Plan 394: billMonthSelectOptions builds labelled options, selected marked', () => {
  const html = billMonthSelectOptions(['2026-09', '2026-10', '2026-11'], '2026-10');
  assert.equal(html, '<option value="2026-09">September 2026</option><option value="2026-10" selected>October 2026</option><option value="2026-11">November 2026</option>');
});

test('Plan 394: billMonthSelectOptions drops bad months and duplicates', () => {
  const html = billMonthSelectOptions(['2026-10', '2026-13', '', '2026-10', null, '2026-11'], '2026-11');
  assert.equal(html, '<option value="2026-10">October 2026</option><option value="2026-11" selected>November 2026</option>');
});

test('Plan 394: billMonthSelectOptions offers a strict selected month missing from the list, first and selected', () => {
  const html = billMonthSelectOptions(['2026-09', '2026-11'], '2026-10');
  assert.equal(html, '<option value="2026-10" selected>October 2026</option><option value="2026-09">September 2026</option><option value="2026-11">November 2026</option>');
});

test('Plan 394: billMonthSelectOptions returns empty for an empty list with no selected month', () => {
  assert.equal(billMonthSelectOptions([], ''), '');
  assert.equal(billMonthSelectOptions(null, ''), '');
  assert.equal(billMonthSelectOptions('2026-11', ''), '');
  assert.equal(billMonthSelectOptions([], '2026-10'), '<option value="2026-10" selected>October 2026</option>');
});

// --- Live line ---

test('Plan 394: billMonthChoiceLineText names the month the payment will be recorded for', () => {
  assert.equal(billMonthChoiceLineText('2026-10'), 'This payment will be recorded for October 2026.');
  assert.equal(billMonthChoiceLineText('2026-11'), 'This payment will be recorded for November 2026.');
  assert.equal(billMonthChoiceLineText('2026-13'), '');
  assert.equal(billMonthChoiceLineText(''), '');
  assert.equal(billMonthChoiceLineText(null), '');
});

// --- The choice lands the payment on the chosen bill ---

test('Plan 394: a payment recorded for last month sits on last month\'s bill', () => {
  const state = payOnMonth(stateWithBills(), 'seed-001', '2026-10');
  const october = billOf(state, 'seed-001', '2026-10');
  const november = billOf(state, 'seed-001', '2026-11');
  assert.equal(october.payments.length, 1);
  assert.equal(october.payments[0].amount, 3000);
  assert.equal(october.payments[0].date, '2026-11-05');
  assert.equal(november.payments.length, 0);
});

test('Plan 394: the chosen month appears on the transaction — the bill month differs from the payment month', () => {
  const state = payOnMonth(stateWithBills(), 'seed-001', '2026-10');
  const paymentId = billOf(state, 'seed-001', '2026-10').payments[0].id;
  const row = listTransactions(state, {}, NOV_5).find((entry) => entry.paymentId === paymentId);
  assert.ok(row, 'transaction row found');
  assert.equal(row.month, '2026-10');
  assert.equal(row.date, '2026-11-05');
  assert.equal(billMonthDiffers(row), true);
});

test('Plan 394: the chosen month appears on the transaction\'s allocation — applied to the selected month', () => {
  const state = payOnMonth(stateWithBills(), 'seed-001', '2026-10');
  const paymentId = billOf(state, 'seed-001', '2026-10').payments[0].id;
  const row = listTransactions(state, {}, NOV_5).find((entry) => entry.paymentId === paymentId);
  const sameMonth = (row.allocation?.allocations ?? []).filter((item) => item.kind === 'same-month');
  assert.equal(sameMonth.length, 1);
  assert.equal(sameMonth[0].month, '2026-10');
  assert.equal(sameMonth[0].amountCents, 300000);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', '2026-10')?.balanceDueCents, 0);
});

test('Plan 394: no choice means the form\'s own month — the allocation rules apply as before', () => {
  const chosen = normalizeBillMonthChoice('', '2026-11');
  assert.equal(chosen, '2026-11');
  const state = payOnMonth(stateWithBills(), 'seed-001', chosen);
  const paymentId = billOf(state, 'seed-001', '2026-11').payments[0].id;
  const row = listTransactions(state, {}, NOV_5).find((entry) => entry.paymentId === paymentId);
  assert.equal(row.month, '2026-11');
  assert.equal(billMonthDiffers(row), false);
  assert.equal(billOf(state, 'seed-001', '2026-10').payments.length, 0);
});

test('Plan 394: the choice settles only the chosen bill — other months stay exactly as due', () => {
  const state = payOnMonth(stateWithBills(), 'seed-001', '2026-10');
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', '2026-10')?.balanceDueCents, 0);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', '2026-11')?.balanceDueCents, 300000);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', '2026-09')?.balanceDueCents, 300000);
});

test('Plan 394: the choice never changes a payment total or a customer record by itself', () => {
  const before = stateWithBills();
  const customerBefore = before.customers.find((entry) => entry.id === 'seed-001');
  const after = payOnMonth(before, 'seed-001', '2026-10');
  const customerAfter = after.customers.find((entry) => entry.id === 'seed-001');
  assert.equal(customerAfter.name, customerBefore.name);
  assert.equal(customerAfter.monthlySellingAmount, customerBefore.monthlySellingAmount);
  assert.equal(customerAfter.bills.length, customerBefore.bills.length);
  const payment = billOf(after, 'seed-001', '2026-10').payments[0];
  assert.equal(Number(payment.amount), 3000);
});

// --- Fences and guards ---

test('Plan 394: the module header never names a fenced filename literally', () => {
  const moduleSrc = readFileSync(new URL('../bill-month-selector.js', import.meta.url), 'utf8');
  const allocationRulesModule = 'part-payment-' + 'rules.js';
  const previewModule = 'partial-settlement-' + 'preview.js';
  const overpaymentModule = 'overpayment-' + 'choice.js';
  for (const fenced of [allocationRulesModule, previewModule, overpaymentModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(readFileSync(new URL(import.meta.url), 'utf8').includes(fenced), false, fenced);
  }
});

test('Plan 394: the module never calls the allocator and imports nothing', () => {
  const moduleSrc = readFileSync(new URL('../bill-month-selector.js', import.meta.url), 'utf8');
  assert.equal(moduleSrc.includes('calculatePaymentAllocations'), false);
  assert.equal(moduleSrc.includes('allocatePartPayment'), false);
  assert.equal(/^\s*import\s/m.test(moduleSrc), false);
  assert.equal(moduleSrc.includes('localStorage'), false);
  assert.equal(moduleSrc.includes('new Date('), false);
  assert.equal(moduleSrc.includes('Date.now('), false);
  assert.equal(moduleSrc.includes('document.'), false);
  assert.equal(moduleSrc.includes('fetch('), false);
});

test('Plan 394: no new styling — styles.css carries no bill-month selector', () => {
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal(stylesSrc.includes('.bms-'), false);
  assert.equal(stylesSrc.includes('bill-month-selector'), false);
});

test('Plan 394: fixtures stay generic — no real customer names or phone numbers in this file', () => {
  const testSrc = readFileSync(new URL(import.meta.url), 'utf8');
  // The banned values are fragment-built so the guard's own literals
  // never trip the guard (a literal would trip its own check).
  const countryCode = '+' + '92';
  const mobilePattern = new RegExp('030' + '\\d{8}');
  const fakeFamily = '030' + '12345678';
  assert.ok(!testSrc.includes(countryCode), 'test carries a real phone number');
  assert.ok(!mobilePattern.test(testSrc), 'test carries a realistic phone number');
  assert.ok(!testSrc.includes(fakeFamily), 'test carries a phone-like number');
  for (const name of ['Ki' + 'ran', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Ahmed ' + 'Khan']) {
    assert.equal(testSrc.includes(name), false, name);
  }
});
