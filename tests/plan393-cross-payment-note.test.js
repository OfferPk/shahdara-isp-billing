// Plan 393 — Transaction paying for another customer's account:
// one person pays for a relative's or neighbour's connection, and
// the payment is recorded with a cross-payment note saying who paid,
// for whose account, and their relationship in plain words, so both
// records stay honest about whose money settled whose bill. The note
// rides the payment record itself (like the payer name, the
// correction note, and the Urdu-script note before it), so it needs
// no store of its own: the record is the note. A normal payment —
// the account holder paying for their own connection — carries no
// note and shows nothing extra. The note never changes any bill,
// payment total, credit transfer, or customer record by itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CROSS_PAYMENT_PAYER_MAX_LENGTH,
  CROSS_PAYMENT_RELATIONSHIP_MAX_LENGTH,
  normalizeCrossPaymentNote,
  crossPaymentNoteOf,
  crossPaymentNoteLineText,
  crossPaymentNoteMarkup,
  crossPaymentsMadeBy,
  crossPaymentsMadeSectionHtml,
} from '../cross-payment-note.js';
import {
  addPayment,
  correctPayment,
  listTransactions,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';

const SEP_5 = new Date('2026-09-05T12:00:00Z');

function stateWithBills(monthlySellingAmount = 3000) {
  let state = createInitialState(['Customer One', 'Customer Two']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: String(monthlySellingAmount) }, SEP_5);
  return generateMonthlyBillsThroughCurrentMonth(state, SEP_5);
}

function pay(state, customerId, month, options = {}) {
  return addPayment(state, customerId, month, {
    amount: 3000,
    date: '2026-09-05',
    method: 'Cash',
    ...options,
  }, SEP_5);
}

function totalDuesCents(state, customerId = 'seed-001') {
  const customer = state.customers.find((entry) => entry.id === customerId);
  return (customer?.bills ?? []).reduce((sum, bill) => sum + (bill.balanceDueCents ?? 0), 0);
}

const CROSS_NOTE = { payerName: 'Ahmed', payerCustomerId: 'seed-002', relationship: 'son' };

// --- The module: caps ---

test('Plan 393: the payer name caps at 100 characters and the relationship at 60', () => {
  assert.equal(CROSS_PAYMENT_PAYER_MAX_LENGTH, 100);
  assert.equal(CROSS_PAYMENT_RELATIONSHIP_MAX_LENGTH, 60);
});

// --- The module: normalize ---

test('Plan 393: normalize keeps a full note — payer name, payer link, relationship — trimmed', () => {
  assert.deepEqual(
    normalizeCrossPaymentNote({ payerName: '  Ahmed  ', payerCustomerId: '  seed-002 ', relationship: '  son ' }),
    { payerName: 'Ahmed', payerCustomerId: 'seed-002', relationship: 'son' },
  );
});

test('Plan 393: normalize reads a plain string as the payer name only', () => {
  assert.deepEqual(normalizeCrossPaymentNote('Ahmed'), { payerName: 'Ahmed' });
});

test('Plan 393: a note with no usable payer name reads as no note', () => {
  for (const value of [null, undefined, 42, true, [], {}, { payerName: '' }, { payerName: '   ' }, { relationship: 'son' }, { payerCustomerId: 'seed-002' }]) {
    assert.equal(normalizeCrossPaymentNote(value), null, JSON.stringify(value));
  }
});

test('Plan 393: normalize folds line breaks in the name and the relationship to spaces', () => {
  assert.deepEqual(
    normalizeCrossPaymentNote({ payerName: 'Ahmed\nAli', relationship: 'son\r\nof the house' }),
    { payerName: 'Ahmed Ali', relationship: 'son of the house' },
  );
});

test('Plan 393: normalize caps a longer payer name at 100 and a longer relationship at 60', () => {
  const note = normalizeCrossPaymentNote({ payerName: 'A'.repeat(150), relationship: 'R'.repeat(90) });
  assert.equal(note.payerName.length, 100);
  assert.equal(note.relationship.length, 60);
});

test('Plan 393: normalize drops a blank payer link and trims a kept one', () => {
  assert.deepEqual(
    normalizeCrossPaymentNote({ payerName: 'Ahmed', payerCustomerId: '   ' }),
    { payerName: 'Ahmed' },
  );
  assert.equal(normalizeCrossPaymentNote({ payerName: 'Ahmed', payerCustomerId: ' seed-002 ' }).payerCustomerId, 'seed-002');
});

test('Plan 393: normalize never mutates its input', () => {
  const note = { payerName: '  Ahmed  ', relationship: 'son' };
  normalizeCrossPaymentNote(note);
  assert.deepEqual(note, { payerName: '  Ahmed  ', relationship: 'son' });
});

// --- The module: reading the note off a payment ---

test('Plan 393: crossPaymentNoteOf reads the note on the payment, or null when there is none', () => {
  assert.equal(crossPaymentNoteOf(null), null);
  assert.equal(crossPaymentNoteOf({}), null);
  assert.equal(crossPaymentNoteOf({ crossPayment: { payerName: '  ' } }), null);
  assert.deepEqual(crossPaymentNoteOf({ crossPayment: CROSS_NOTE }), CROSS_NOTE);
  assert.deepEqual(crossPaymentNoteOf({ crossPayment: 'Ahmed' }), { payerName: 'Ahmed' });
  assert.equal(crossPaymentNoteOf({ crossPayment: { payerName: 'A'.repeat(150) } }).payerName.length, 100);
});

// --- The module: plain words and markup ---

test('Plan 393: the line reads "Paid by Ahmed (son)" with a relationship and "Paid by Ahmed" without one', () => {
  assert.equal(crossPaymentNoteLineText(CROSS_NOTE), 'Paid by Ahmed (son)');
  assert.equal(crossPaymentNoteLineText({ payerName: 'Ahmed' }), 'Paid by Ahmed');
  assert.equal(crossPaymentNoteLineText(null), '');
  assert.equal(crossPaymentNoteLineText({ payerName: '  ' }), '');
});

test('Plan 393: the markup is a " · …" suffix, and empty when the payment carries no note', () => {
  assert.equal(crossPaymentNoteMarkup({ crossPayment: CROSS_NOTE }), ' · Paid by Ahmed (son)');
  assert.equal(crossPaymentNoteMarkup({ crossPayment: { payerName: 'Ahmed' } }), ' · Paid by Ahmed');
  assert.equal(crossPaymentNoteMarkup({}), '');
  assert.equal(crossPaymentNoteMarkup(null), '');
});

test('Plan 393: the markup always escapes the payer name and the relationship', () => {
  const markup = crossPaymentNoteMarkup({ crossPayment: { payerName: '<script>Ahmed</script>', relationship: 'son & heir' } });
  assert.equal(markup.includes('<script>'), false);
  assert.equal(markup.includes('&lt;script&gt;Ahmed&lt;/script&gt;'), true);
  assert.equal(markup.includes('son &amp; heir'), true);
});

// --- The module: payments one customer made for others ---

function madeRows() {
  return [
    { customerId: 'seed-001', customerNumber: 1, customerName: 'Customer One', amount: 3000, date: '2026-09-05', crossPayment: CROSS_NOTE },
    { customerId: 'seed-001', customerNumber: 1, customerName: 'Customer One', amount: 1500, date: '2026-09-06', crossPayment: { payerName: 'Ahmed', payerCustomerId: 'seed-002' } },
    { customerId: 'seed-002', customerNumber: 2, customerName: 'Customer Two', amount: 3000, date: '2026-09-05', crossPayment: { payerName: 'Ahmed', payerCustomerId: 'seed-002' } },
    { customerId: 'seed-001', customerNumber: 1, customerName: 'Customer One', amount: 3000, date: '2026-09-05', crossPayment: { payerName: 'Someone Else', payerCustomerId: 'seed-003' } },
    { customerId: 'seed-001', customerNumber: 1, customerName: 'Customer One', amount: 3000, date: '2026-09-05' },
  ];
}

test('Plan 393: crossPaymentsMadeBy keeps only the payments that payer made for other customers', () => {
  const made = crossPaymentsMadeBy(madeRows(), 'seed-002');
  assert.equal(made.length, 2);
  assert.deepEqual(made.map((row) => row.amount), [3000, 1500]);
});

test('Plan 393: a payment for one\'s own account is never a cross-payment, even on a damaged record', () => {
  const own = crossPaymentsMadeBy(madeRows(), 'seed-002');
  assert.equal(own.some((row) => row.customerId === 'seed-002'), false);
  assert.deepEqual(crossPaymentsMadeBy([], 'seed-002'), []);
  assert.deepEqual(crossPaymentsMadeBy(madeRows(), ''), []);
  assert.deepEqual(crossPaymentsMadeBy(null, 'seed-002'), []);
});

// --- The module: the payer's own profile section ---

test('Plan 393: the payer section is empty when the customer made no cross-payments', () => {
  const payer = { id: 'seed-002', customerNumber: 2, name: 'Customer Two' };
  assert.equal(crossPaymentsMadeSectionHtml(null, madeRows(), (amount) => `PKR ${amount}`), '');
  assert.equal(crossPaymentsMadeSectionHtml(payer, [], (amount) => `PKR ${amount}`), '');
  assert.equal(crossPaymentsMadeSectionHtml(payer, madeRows().filter((row) => row.customerId === 'seed-002'), (amount) => `PKR ${amount}`), '');
});

test('Plan 393: the payer section lists each payment made for another account — amount, account, relationship, date', () => {
  const payer = { id: 'seed-002', customerNumber: 2, name: 'Customer Two' };
  const html = crossPaymentsMadeSectionHtml(payer, madeRows(), (amount) => `PKR ${amount}`);
  assert.equal(html.includes('Payments made for others'), true);
  assert.equal(html.includes('PKR 3000 for #1 Customer One (son) — 2026-09-05'), true);
  assert.equal(html.includes('PKR 1500 for #1 Customer One — 2026-09-06'), true);
  assert.equal(html.includes('no dues moved between the two customers'), true);
});

test('Plan 393: the payer section escapes account-holder names and falls back to plain PKR without a formatter', () => {
  const payer = { id: 'seed-002', customerNumber: 2, name: 'Customer Two' };
  const rows = [{ customerId: 'seed-001', customerNumber: 1, customerName: '<b>Customer One</b>', amount: 3000, date: '2026-09-05', crossPayment: CROSS_NOTE }];
  const html = crossPaymentsMadeSectionHtml(payer, rows);
  assert.equal(html.includes('<b>Customer One</b>'), false);
  assert.equal(html.includes('&lt;b&gt;Customer One&lt;/b&gt;'), true);
  assert.equal(html.includes('PKR 3000'), true);
});

// --- Core: recording the note with the payment ---

test('Plan 393: addPayment stores the cross-payment note on the recorded payment', () => {
  const state = pay(stateWithBills(), 'seed-001', '2026-09', { crossPayment: CROSS_NOTE });
  const payment = state.customers[0].bills.find((bill) => bill.month === '2026-09').payments[0];
  assert.deepEqual(payment.crossPayment, CROSS_NOTE);
});

test('Plan 393: a payment without a note stores no cross-payment field at all', () => {
  const state = pay(stateWithBills(), 'seed-001', '2026-09');
  const payment = state.customers[0].bills.find((bill) => bill.month === '2026-09').payments[0];
  assert.equal('crossPayment' in payment, false);
  assert.equal(crossPaymentNoteOf(payment), null);
});

test('Plan 393: a payment with an empty payer name stores no note', () => {
  const state = pay(stateWithBills(), 'seed-001', '2026-09', { crossPayment: { payerName: '   ', relationship: 'son' } });
  const payment = state.customers[0].bills.find((bill) => bill.month === '2026-09').payments[0];
  assert.equal('crossPayment' in payment, false);
});

test('Plan 393: validatePayment normalizes the note — caps the name, trims the link, drops a blank name', () => {
  const state = pay(stateWithBills(), 'seed-001', '2026-09', { crossPayment: { payerName: `  ${'A'.repeat(150)}  `, payerCustomerId: ' seed-002 ', relationship: 'son' } });
  const payment = state.customers[0].bills.find((bill) => bill.month === '2026-09').payments[0];
  assert.equal(payment.crossPayment.payerName.length, 100);
  assert.equal(payment.crossPayment.payerCustomerId, 'seed-002');
  assert.equal(payment.crossPayment.relationship, 'son');
});

// --- Core: the correction form carries the note over ---

test('Plan 393: correctPayment keeps the note when the correction says nothing about it, replaces it explicitly, and clears it on null', () => {
  const recorded = pay(stateWithBills(), 'seed-001', '2026-09', { crossPayment: CROSS_NOTE });
  const payment = recorded.customers[0].bills.find((bill) => bill.month === '2026-09').payments[0];
  const kept = correctPayment(recorded, 'seed-001', '2026-09', payment.id, { date: '2026-09-05', amount: 2500, method: 'Cash' }, SEP_5);
  assert.deepEqual(kept.customers[0].bills.find((bill) => bill.month === '2026-09').payments[0].crossPayment, CROSS_NOTE);
  const replaced = correctPayment(recorded, 'seed-001', '2026-09', payment.id, { date: '2026-09-05', amount: 3000, method: 'Cash', crossPayment: { payerName: 'Bilal', relationship: 'neighbour' } }, SEP_5);
  assert.deepEqual(replaced.customers[0].bills.find((bill) => bill.month === '2026-09').payments[0].crossPayment, { payerName: 'Bilal', relationship: 'neighbour' });
  const cleared = correctPayment(recorded, 'seed-001', '2026-09', payment.id, { date: '2026-09-05', amount: 3000, method: 'Cash', crossPayment: null }, SEP_5);
  assert.equal('crossPayment' in cleared.customers[0].bills.find((bill) => bill.month === '2026-09').payments[0], false);
});

// --- Core: the note on the transaction list ---

test('Plan 393: listTransactions carries the note on the row, and null for a normal payment', () => {
  const withNote = pay(stateWithBills(), 'seed-001', '2026-09', { crossPayment: CROSS_NOTE });
  const rows = listTransactions(withNote);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].crossPayment, CROSS_NOTE);
  const normal = pay(stateWithBills(), 'seed-001', '2026-09');
  assert.equal(listTransactions(normal)[0].crossPayment, null);
});

// --- Core: the note never changes any bill, total, or other customer ---

test('Plan 393: the note never changes the dues — the same payment with and without a note leaves the same dues', () => {
  const withNote = pay(stateWithBills(), 'seed-001', '2026-09', { crossPayment: CROSS_NOTE });
  const without = pay(stateWithBills(), 'seed-001', '2026-09');
  assert.equal(totalDuesCents(withNote), totalDuesCents(without));
  assert.equal(withNote.customers[0].bills.find((bill) => bill.month === '2026-09').payments[0].amount, 3000);
});

test('Plan 393: the note never moves dues between customers — the payer\'s record gains no payment and no bill change', () => {
  const state = pay(stateWithBills(), 'seed-001', '2026-09', { crossPayment: CROSS_NOTE });
  const payer = state.customers.find((entry) => entry.id === 'seed-002');
  assert.deepEqual(payer.bills, []);
  assert.equal(listTransactions(state).some((row) => row.customerId === 'seed-002'), false);
  assert.equal(listTransactions(state).length, 1);
});

// --- Quick Collect: the note rides the single-payment path ---

test('Plan 393: executeQuickCollection records the cross-payment note on the payment it saves', () => {
  const { nextState, receipt } = executeQuickCollection(stateWithBills(), {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-05', method: 'Cash',
    crossPayment: CROSS_NOTE,
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.deepEqual(payment.crossPayment, CROSS_NOTE);
});

test('Plan 393: executeQuickCollection without a note records no cross-payment field', () => {
  const { nextState, receipt } = executeQuickCollection(stateWithBills(), {
    customerId: 'seed-001', month: '2026-09', amount: 3000, date: '2026-09-05', method: 'Cash',
  }, SEP_5);
  const payment = nextState.customers[0].bills.find((bill) => bill.month === '2026-09').payments.find((entry) => entry.id === receipt.paymentId);
  assert.equal('crossPayment' in payment, false);
});

// --- Wiring: the note appears on the transaction and on both customers' views ---

const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const navQcSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const indexSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Plan 393: app.js imports the note helpers and shows the note on both profile history rows and the Transactions card', () => {
  assert.equal(appSrc.includes("from './cross-payment-note.js'"), true);
  assert.equal(appSrc.includes('crossPaymentNoteMarkup'), true);
  const rowCount = appSrc.split('${profileUrduNoteMarkup(payment)}${profileCrossPaymentMarkup(payment)}').length - 1;
  assert.equal(rowCount, 2);
  assert.equal(appSrc.includes('${urduNoteMarkup(transaction)}${crossPaymentNoteMarkup(transaction)}'), true);
});

test('Plan 393: the profile payment form carries the three cross-payment fields, and the submit passes the note', () => {
  assert.equal(appSrc.includes('${crossPaymentNoteFieldsMarkup(`xpn-${month}`, customer.id, state.customers)}'), true);
  assert.equal(appSrc.includes('name="crossPayerCustomerId"'), true);
  assert.equal(appSrc.includes('name="crossPayerName"'), true);
  assert.equal(appSrc.includes('name="crossRelationship"'), true);
  assert.equal(appSrc.includes("crossPayment: { payerName: data.get('crossPayerName'), payerCustomerId: data.get('crossPayerCustomerId'), relationship: data.get('crossRelationship') }"), true);
});

test('Plan 393: the payer picker never lists the account holder as their own cross-payer', () => {
  assert.equal(appSrc.includes('entry.id !== currentCustomerId'), true);
});

test('Plan 393: the payer\'s own profile shows the payments they made for others, after the profile info groups', () => {
  assert.equal(appSrc.includes('${profileInfoGroupsHtml}${crossPaymentsMadeSectionMarkup}'), true);
  assert.equal(appSrc.includes('crossPaymentsMadeSectionHtml(customer, crossPaymentsMadeBy(listTransactions(state), customer.id), formatAmount)'), true);
});

test('Plan 393: nav-quick-collect.js reads the three fields, resolves the payer name, and passes the note on the single-payment path', () => {
  assert.equal(navQcSrc.includes("document.getElementById('quickCollectCrossPayerSelect')"), true);
  assert.equal(navQcSrc.includes("document.getElementById('quickCollectCrossPayerNameInput')"), true);
  assert.equal(navQcSrc.includes("document.getElementById('quickCollectCrossRelationshipInput')"), true);
  assert.equal(navQcSrc.includes('crossPayerNameVal'), true);
  assert.equal(navQcSrc.includes('crossPayment: crossPaymentVal || undefined'), true);
  assert.equal(navQcSrc.includes('crossPayment: crossPayment ?? undefined'), true);
});

test('Plan 393: index.html carries the three Quick Collect cross-payment fields', () => {
  assert.equal(indexSrc.includes('id="quickCollectCrossPayerSelect"'), true);
  assert.equal(indexSrc.includes('id="quickCollectCrossPayerNameInput"'), true);
  assert.equal(indexSrc.includes('id="quickCollectCrossRelationshipInput"'), true);
});

// --- Guards: fences, purity, and no new styling ---

test('Plan 393: the module is pure — no clock, storage, network, or page access', () => {
  const moduleSrc = readFileSync(new URL('../cross-payment-note.js', import.meta.url), 'utf8');
  for (const forbidden of ['new Date(', 'Date.now(', 'document.', 'localStorage', 'fetch(', 'import ']) {
    assert.equal(moduleSrc.includes(forbidden), false, forbidden);
  }
});

test('Plan 393: the module header never names a fenced filename literally', () => {
  const moduleSrc = readFileSync(new URL('../cross-payment-note.js', import.meta.url), 'utf8');
  const creditTransferModule = 'connection-credit-' + 'transfer.js';
  const payerNameModule = 'transaction-payer-' + 'name.js';
  const receiptScriptModule = 'receipt-' + 'script.js';
  for (const fenced of [creditTransferModule, payerNameModule, receiptScriptModule]) {
    assert.equal(moduleSrc.includes(fenced), false, fenced);
    assert.equal(readFileSync(new URL(import.meta.url), 'utf8').includes(fenced), false, fenced);
  }
});

test('Plan 393: the receipt never reads the cross-payment note — receipts are untouched', () => {
  const receiptModule = 'receipt-' + 'script.js';
  for (const file of ['receipt.js', receiptModule, 'png-receipt.js']) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.equal(src.includes('crossPaymentNoteOf'), false, file);
    assert.equal(src.includes('normalizeCrossPaymentNote'), false, file);
  }
});

test('Plan 393: no new styling — styles.css carries no cross-payment selector', () => {
  const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal(stylesSrc.includes('.xpn-'), false);
  assert.equal(stylesSrc.includes('cross-payment'), false);
  assert.equal(stylesSrc.includes('.profile-cross-payments'), false);
});

test('Plan 393: fixtures stay generic — no real customer names or phone numbers in this file', () => {
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
