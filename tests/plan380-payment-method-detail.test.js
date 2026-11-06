// Plan 380 — Transaction payment-method detail note.
// One method-detail note on the transaction (wallet or bank reference
// as given, last digits of the sending account where the customer
// offers them, in plain words), recorded with the payment. The note
// records the reference only and clears nothing: it never changes
// any bill, payment total, clearance status, or unmatched-credit
// record by itself. A transaction without a reference shows only
// the method.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAYMENT_METHOD_DETAIL_REFERENCE_MAX_LENGTH,
  PAYMENT_METHOD_DETAIL_SENDER_TITLE_MAX_LENGTH,
  paymentMethodReferenceOf,
  paymentMethodSenderTitleOf,
  paymentMethodSenderDigitsOf,
  paymentMethodSenderLabelOf,
  normalizePaymentMethodDetail,
  paymentMethodDetailOf,
  paymentMethodDetailLineText,
  paymentMethodDetailMarkup,
  paymentMethodReferenceMarkup,
} from '../payment-method-detail.js';
import { validatePayment, addPayment, correctPayment, listTransactions, calculatePaymentAllocations, paymentSenderLabel } from '../core.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'payment-method-detail.js'), 'utf8');
const coreSrc = readFileSync(join(dir, '..', 'core.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

const REF = new Date('2026-10-15T10:00:00Z');

// Generic fixtures only — clearly made-up references, never a real
// transaction id, account number, or phone number.
const REF_ONE = 'REF-0001';
const REF_TWO = 'REF-0002';
const SENDER_ONE = 'Sender One';
const SENDER_TWO = 'Sender Two';

function bill(month, dueAmount, payments = []) {
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return {
    id: `B-${month}`,
    month,
    dueAmount,
    status: paid >= dueAmount ? 'paid' : paid > 0 ? 'partial' : 'pending',
    payments,
  };
}

function customerWithBills(bills, overrides = {}) {
  return {
    id: 'CUST-1',
    customerNumber: 1,
    name: 'Customer One',
    mohalla: 'Mohalla A',
    archived: false,
    monthlySellingAmount: 2500,
    bills,
    ...overrides,
  };
}

function stateWith(customer) {
  return { version: 1, nextCustomerNumber: 2, customers: [customer] };
}

function recordedPayment(state, month = '2026-09') {
  const customer = state.customers.find(c => c.id === 'CUST-1');
  const found = (customer.bills ?? []).find(b => b.month === month);
  return (found.payments ?? [])[0];
}

// ---------------------------------------------------------------------------
// Normalizing the note
// ---------------------------------------------------------------------------

test('normalize: a plain note keeps the reference and the sender parts', () => {
  assert.deepEqual(
    normalizePaymentMethodDetail({ transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' }),
    { reference: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' },
  );
  assert.deepEqual(
    normalizePaymentMethodDetail({ reference: REF_TWO, senderTitle: SENDER_TWO, senderDigits: '4421' }),
    { reference: REF_TWO, senderTitle: SENDER_TWO, senderDigits: '4421' },
  );
});

test('normalize: the transaction id wins, the older reference field is the fallback', () => {
  assert.equal(paymentMethodReferenceOf({ transactionId: REF_ONE, reference: REF_TWO }), REF_ONE);
  assert.equal(paymentMethodReferenceOf({ reference: REF_TWO }), REF_TWO);
  // An explicitly empty transaction id reads as no reference — the
  // same ?? rule the payment validator uses, never a fallback guess.
  assert.equal(paymentMethodReferenceOf({ transactionId: '', reference: REF_TWO }), '');
  assert.equal(paymentMethodReferenceOf({}), '');
  assert.equal(paymentMethodReferenceOf(null), '');
  assert.equal(paymentMethodReferenceOf(undefined), '');
});

test('normalize: line breaks fold to spaces, blanks are dropped', () => {
  assert.equal(paymentMethodReferenceOf({ transactionId: 'REF\n0001' }), 'REF 0001');
  assert.equal(paymentMethodReferenceOf({ transactionId: '  REF-0001  ' }), REF_ONE);
  assert.equal(paymentMethodSenderTitleOf({ senderTitle: 'Sender\nOne' }), 'Sender One');
  assert.deepEqual(
    normalizePaymentMethodDetail({ transactionId: ' ', senderTitle: '', senderDigits: '' }),
    null,
  );
});

test('normalize: nothing at all is not a note', () => {
  assert.equal(normalizePaymentMethodDetail({}), null);
  assert.equal(normalizePaymentMethodDetail({ transactionId: '', senderTitle: '', senderDigits: '' }), null);
  assert.equal(normalizePaymentMethodDetail(null), null);
  assert.equal(normalizePaymentMethodDetail(undefined), null);
  assert.equal(normalizePaymentMethodDetail('REF-0001'), null);
  assert.equal(normalizePaymentMethodDetail(42), null);
});

test('normalize: the reference caps at 64 chars, the sender title at 100', () => {
  assert.equal(PAYMENT_METHOD_DETAIL_REFERENCE_MAX_LENGTH, 64);
  assert.equal(PAYMENT_METHOD_DETAIL_SENDER_TITLE_MAX_LENGTH, 100);
  const longRef = 'R'.repeat(70);
  const note = normalizePaymentMethodDetail({ transactionId: longRef });
  assert.equal(note.reference.length, 64);
  const longTitle = 'S'.repeat(120);
  const titled = normalizePaymentMethodDetail({ senderTitle: longTitle });
  assert.equal(titled.senderTitle.length, 100);
});

test('normalize: sender digits are digits only and only the last 4 survive', () => {
  assert.equal(paymentMethodSenderDigitsOf({ senderDigits: '3310' }), '3310');
  assert.equal(paymentMethodSenderDigitsOf({ senderDigits: '03310' }), '3310');
  assert.equal(paymentMethodSenderDigitsOf({ senderDigits: 'AB12CD34' }), '1234');
  assert.equal(paymentMethodSenderDigitsOf({ senderDigits: '03012345678' }), '5678');
  assert.equal(paymentMethodSenderDigitsOf({}), '');
  assert.equal(paymentMethodSenderDigitsOf(null), '');
});

test('normalize: the input is never mutated', () => {
  const raw = { transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' };
  normalizePaymentMethodDetail(raw);
  assert.deepEqual(raw, { transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' });
});

test('detailOf: reads the fields the validator keeps', () => {
  assert.deepEqual(
    paymentMethodDetailOf({ id: 'P-1', date: '2026-10-06', amount: 1500, method: 'Easypaisa', transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' }),
    { reference: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' },
  );
  assert.equal(paymentMethodDetailOf({ id: 'P-1', date: '2026-10-06', amount: 1500, method: 'Cash' }), null);
});

// ---------------------------------------------------------------------------
// The sender label — parity with the payment record's own reader
// ---------------------------------------------------------------------------

test('sender label: title and digits together, each alone, or nothing', () => {
  assert.equal(paymentMethodSenderLabelOf({ senderTitle: SENDER_ONE, senderDigits: '3310' }), 'Sender One (…3310)');
  assert.equal(paymentMethodSenderLabelOf({ senderTitle: SENDER_ONE }), SENDER_ONE);
  assert.equal(paymentMethodSenderLabelOf({ senderDigits: '3310' }), '…3310');
  assert.equal(paymentMethodSenderLabelOf({}), '');
  assert.equal(paymentMethodSenderLabelOf(null), '');
});

test('sender label: matches the payment record reader on every fixture', () => {
  const fixtures = [
    { senderTitle: SENDER_ONE, senderDigits: '3310' },
    { senderTitle: SENDER_ONE },
    { senderDigits: '3310' },
    { senderTitle: 'Sender\nTwo', senderDigits: 'AB12CD34' },
    {},
  ];
  for (const fixture of fixtures) {
    assert.equal(paymentMethodSenderLabelOf(fixture), paymentSenderLabel(fixture));
  }
});

// ---------------------------------------------------------------------------
// Line text and markup
// ---------------------------------------------------------------------------

test('line text: reference and sender joined in plain words', () => {
  assert.equal(
    paymentMethodDetailLineText({ reference: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' }),
    'Ref REF-0001 · Sender: Sender One (…3310)',
  );
  assert.equal(
    paymentMethodDetailLineText({ reference: REF_ONE }),
    'Ref REF-0001',
  );
  assert.equal(
    paymentMethodDetailLineText({ senderTitle: SENDER_ONE, senderDigits: '3310' }),
    'Sender: Sender One (…3310)',
  );
});

test('line text: no note, no words', () => {
  assert.equal(paymentMethodDetailLineText(null), '');
  assert.equal(paymentMethodDetailLineText({}), '');
  assert.equal(paymentMethodDetailLineText({ reference: '', senderTitle: '', senderDigits: '' }), '');
});

test('line text: caller-supplied labels are used', () => {
  assert.equal(
    paymentMethodDetailLineText(
      { reference: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' },
      { reference: 'حوالہ {reference}', senderRow: 'بھیجنے والا: {label}' },
    ),
    'حوالہ REF-0001 · بھیجنے والا: Sender One (…3310)',
  );
  assert.equal(
    paymentMethodDetailLineText({ reference: REF_ONE }, { reference: 'Reference {reference}' }),
    'Reference REF-0001',
  );
});

test('markup: a note reads as a dot suffix; no note reads as nothing', () => {
  assert.equal(
    paymentMethodDetailMarkup({ transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' }),
    ' · Ref REF-0001 · Sender: Sender One (…3310)',
  );
  assert.equal(paymentMethodDetailMarkup({ transactionId: REF_ONE }), ' · Ref REF-0001');
  assert.equal(paymentMethodDetailMarkup({ method: 'Cash' }), '');
  assert.equal(paymentMethodDetailMarkup(null), '');
});

test('markup: the reference alone reads as a dot suffix; no reference reads as nothing', () => {
  assert.equal(
    paymentMethodReferenceMarkup({ transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310' }),
    ' · Ref REF-0001',
  );
  assert.equal(paymentMethodReferenceMarkup({ senderTitle: SENDER_ONE }), '');
  assert.equal(paymentMethodReferenceMarkup(null), '');
  assert.equal(
    paymentMethodReferenceMarkup({ transactionId: REF_ONE }, { reference: 'حوالہ {reference}' }),
    ' · حوالہ REF-0001',
  );
});

test('markup: the reference and the sender name are always escaped', () => {
  const markup = paymentMethodDetailMarkup({ transactionId: '<b>REF</b>', senderTitle: 'Sender <script>', senderDigits: '3310' });
  assert.ok(!markup.includes('<b>REF</b>'), 'markup must be escaped');
  assert.ok(!markup.includes('<script>'), 'markup must be escaped');
  assert.ok(markup.includes('&lt;b&gt;REF&lt;/b&gt;'), 'escaped reference');
  assert.ok(markup.includes('Sender &lt;script&gt;'), 'escaped sender name');
  const refOnly = paymentMethodReferenceMarkup({ transactionId: '<b>REF</b>' });
  assert.ok(!refOnly.includes('<b>REF</b>'), 'reference markup must be escaped');
  assert.ok(refOnly.includes('&lt;b&gt;REF&lt;/b&gt;'), 'escaped reference alone');
});

// ---------------------------------------------------------------------------
// Recording — the note rides the payment, and changes nothing else
// ---------------------------------------------------------------------------

test('validatePayment: keeps the reference and the sender parts when given', () => {
  const kept = validatePayment({
    date: '2026-10-06',
    amount: 1500,
    method: 'Easypaisa',
    transactionId: REF_ONE,
    senderTitle: SENDER_ONE,
    senderDigits: '3310',
  }, REF);
  assert.equal(kept.transactionId, REF_ONE);
  assert.equal(kept.reference, REF_ONE);
  assert.equal(kept.senderTitle, SENDER_ONE);
  assert.equal(kept.senderDigits, '3310');
  assert.equal(kept.amount, 1500);
});

test('validatePayment: a payment without a reference keeps no reference fields', () => {
  const kept = validatePayment({
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
  }, REF);
  assert.equal('transactionId' in kept, false);
  assert.equal('reference' in kept, false);
  assert.equal('senderTitle' in kept, false);
  assert.equal('senderDigits' in kept, false);
});

test('addPayment: the reference rides the recorded payment and changes no total', () => {
  const plain = stateWith(customerWithBills([bill('2026-09', 3000)]));
  const withRef = stateWith(customerWithBills([bill('2026-09', 3000)]));
  const plainNext = addPayment(plain, 'CUST-1', '2026-09', {
    date: '2026-10-06', amount: 1500, method: 'Easypaisa',
  }, REF);
  const refNext = addPayment(withRef, 'CUST-1', '2026-09', {
    date: '2026-10-06', amount: 1500, method: 'Easypaisa',
    transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310',
  }, REF);
  const recorded = recordedPayment(refNext);
  assert.equal(recorded.transactionId, REF_ONE);
  assert.equal(recorded.reference, REF_ONE);
  assert.equal(recorded.senderTitle, SENDER_ONE);
  assert.equal(recorded.senderDigits, '3310');
  // Same bill, same totals, with or without the note.
  const plainAlloc = calculatePaymentAllocations(plainNext);
  const refAlloc = calculatePaymentAllocations(refNext);
  assert.equal(
    refAlloc.forMonth('CUST-1', '2026-09')?.balanceDueCents,
    plainAlloc.forMonth('CUST-1', '2026-09')?.balanceDueCents,
  );
  assert.equal(recordedPayment(refNext).amount, recordedPayment(plainNext).amount);
  // The note adds no clearance or unmatched-credit field of its own.
  assert.ok(!Object.keys(recorded).some(k => k.startsWith('clearance') || k.startsWith('unmatched')));
});

test('correctPayment: a correction that says nothing about the note keeps it', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06', amount: 1500, method: 'Easypaisa',
    transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310',
  }, REF);
  const id = recordedPayment(state).id;
  const next = correctPayment(state, 'CUST-1', '2026-09', id, {
    date: '2026-10-07', amount: 1500, method: 'Easypaisa',
  }, REF);
  const corrected = recordedPayment(next);
  assert.equal(corrected.transactionId, REF_ONE);
  assert.equal(corrected.senderTitle, SENDER_ONE);
  assert.equal(corrected.senderDigits, '3310');
  assert.equal(corrected.date, '2026-10-07');
});

test('correctPayment: a correction that supplies the note replaces it', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06', amount: 1500, method: 'Easypaisa',
    transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310',
  }, REF);
  const id = recordedPayment(state).id;
  const next = correctPayment(state, 'CUST-1', '2026-09', id, {
    date: '2026-10-06', amount: 1500, method: 'Easypaisa',
    transactionId: REF_TWO, senderTitle: SENDER_TWO, senderDigits: '4421',
  }, REF);
  const corrected = recordedPayment(next);
  assert.equal(corrected.transactionId, REF_TWO);
  assert.equal(corrected.senderTitle, SENDER_TWO);
  assert.equal(corrected.senderDigits, '4421');
});

test('correctPayment: a correction that clears the note clears it', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06', amount: 1500, method: 'Easypaisa',
    transactionId: REF_ONE, senderTitle: SENDER_ONE, senderDigits: '3310',
  }, REF);
  const id = recordedPayment(state).id;
  const next = correctPayment(state, 'CUST-1', '2026-09', id, {
    date: '2026-10-06', amount: 1500, method: 'Easypaisa',
    transactionId: '', senderTitle: '', senderDigits: '',
  }, REF);
  const corrected = recordedPayment(next);
  assert.equal('transactionId' in corrected, false);
  assert.equal('reference' in corrected, false);
  assert.equal('senderTitle' in corrected, false);
  assert.equal('senderDigits' in corrected, false);
});

test('listTransactions: the note rides the transaction row', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06',
    amount: 1500,
    method: 'Easypaisa',
    transactionId: REF_ONE,
    senderTitle: SENDER_ONE,
    senderDigits: '3310',
  }, REF);
  const rows = listTransactions(state, {}, REF);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].transactionId, REF_ONE);
  assert.equal(rows[0].senderTitle, SENDER_ONE);
  assert.equal(rows[0].senderDigits, '3310');
  assert.equal(
    paymentMethodDetailLineText(rows[0]),
    'Ref REF-0001 · Sender: Sender One (…3310)',
  );
});

test('listTransactions: a row without a note carries empty detail fields', () => {
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addPayment(state, 'CUST-1', '2026-09', {
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash',
  }, REF);
  const rows = listTransactions(state, {}, REF);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].transactionId, '');
  assert.equal(rows[0].senderTitle, '');
  assert.equal(rows[0].senderDigits, '');
  assert.equal(paymentMethodDetailMarkup(rows[0]), '');
});

// ---------------------------------------------------------------------------
// Wiring — the transaction shows the note where it is listed
// ---------------------------------------------------------------------------

test('wiring: the entry form already records the reference and sender', () => {
  assert.ok(indexSrc.includes('id="quickCollectTransactionIdInput"'), 'quick collect reference input');
  assert.ok(indexSrc.includes('id="quickCollectSenderNameInput"'), 'quick collect sender name input');
  assert.ok(indexSrc.includes('id="quickCollectSenderDigitsInput"'), 'quick collect sender digits input');
  assert.ok(appSrc.includes("name=\"transactionId\""), 'profile payment form carries the reference field');
  assert.ok(appSrc.includes("name=\"senderTitle\""), 'profile payment form carries the sender name field');
  assert.ok(appSrc.includes("name=\"senderDigits\""), 'profile payment form carries the sender digits field');
  assert.ok(appSrc.includes("from './payment-method-detail.js'"), 'app imports the module');
  assert.ok(appSrc.includes('paymentMethodDetailMarkup('), 'transactions list shows the note');
  assert.ok(appSrc.includes('profilePaymentMethodDetailMarkup('), 'profile history shows the reference');
});

test('wiring: both profile history rows show the reference after the method', () => {
  const hits = appSrc.split("${escapeHtml(payment.method)}${profilePaymentMethodDetailMarkup(payment)}${profilePaymentPayerMarkup(payment)}").length - 1;
  assert.equal(hits, 2, 'voided and normal profile rows both carry the reference');
  assert.ok(appSrc.includes('function profilePaymentMethodDetailMarkup(payment)'), 'profile wrapper defined');
  assert.ok(appSrc.includes('paymentMethodReferenceMarkup(payment, { reference: t(\'prof_pmd_ref\') })'), 'profile wrapper passes the translated label');
  assert.ok(appSrc.includes('Method: ${escapeHtml(transaction.method)}${paymentMethodDetailMarkup(transaction)}${paymentPayerMarkup(transaction)}'), 'transactions card shows the full note after the method');
});

test('wiring: the reference label exists in both language tables', () => {
  const hits = langSrc.split('prof_pmd_ref:').length - 1;
  assert.equal(hits, 2, 'one key in en, one in ur');
  assert.ok(langSrc.includes("prof_pmd_ref: 'Ref {reference}'"), 'english label');
  assert.ok(langSrc.includes("prof_pmd_ref: 'حوالہ {reference}'"), 'urdu label');
  assert.ok(!stylesSrc.includes('payment-method-detail'), 'no styles change for this plan');
});

// ---------------------------------------------------------------------------
// Guards — purity, fences, no real names
// ---------------------------------------------------------------------------

test('guard: the module is pure — no store, no DOM, no clock, no network', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'no store key');
  assert.ok(!moduleSrc.includes('localStorage'), 'no storage');
  assert.ok(!moduleSrc.includes('document.'), 'no document access');
  assert.ok(!moduleSrc.includes('window.'), 'no window access');
  assert.ok(!moduleSrc.includes('new Date('), 'no clock read');
  assert.ok(!moduleSrc.includes('Date.now('), 'no clock read');
  assert.ok(!moduleSrc.includes('fetch('), 'no network');
  assert.ok(!moduleSrc.includes('import '), 'no imports — pure module');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'no standalone OLT word');
});

test('guard: the module never names a fenced neighbour module', () => {
  // Neighbour modules are checked by filename only and left untouched:
  // the clearance-status module and the unmatched-credit matching
  // queue. This plan records the reference only and must not
  // re-implement either. Filenames are built from fragments so this
  // very test never contains them literally either.
  const fenced = [
    'payment-clear' + 'ance.js',
    'bank-cred' + 'its.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
  assert.ok(!coreSrc.includes('paymentMethodDetail'), 'core keeps no detail of its own');
});

test('guard: no real person or customer name anywhere in this file', () => {
  // Names are built from fragments so the list itself never contains
  // one literally.
  const forbidden = [
    'Sa' + 'ad',
    'Ki' + 'ran',
    'Hai' + 'der',
    'Shu' + 'naid',
    'Kha' + 'zer',
    'Mo' + 'hsin',
    'Shar' + 'jell',
    'No' + 'mi',
    'Aq' + 'ib',
    'Ej' + 'az',
  ];
  for (const name of forbidden) {
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});
