/**
 * sender-proof-metadata.test.js — SISP-63: Digital Payment Sender Proof
 * Metadata (senderTitle + senderDigits) on statements & receipts.
 *
 * The IMAGE path is PR #506 (payment-proof.test.js); this phase is the
 * metadata next to it: WHO sent a digital payment and the last 4 digits
 * of the account/mobile it came from, recorded alongside the TID
 * (SISP-21) so a wallet payment can be matched to its sender without
 * opening the screenshot. Pins:
 *  - validatePayment keeps both fields for digital methods (Easypaisa /
 *    JazzCash / NayaPay / Bank Transfer / Raast), cleans the title
 *    (single line, <= 100 chars, longer throws) and reduces the digits
 *    to digits-only LAST 4 (a full account number is never stored);
 *  - cash methods drop both fields — the record keeps its exact legacy
 *    shape (no senderTitle / senderDigits keys);
 *  - SPEC PIN: a NayaPay payment with tid "NP-998877", senderTitle
 *    "Hamza", senderDigits "3310" persists all three fields, survives a
 *    createJsonBackup -> previewJsonBackupMerge round-trip, and renders
 *    on the customer statement and on every receipt layout (A4,
 *    thermal-80, thermal-58, PNG model, Quick Collect receipt);
 *  - a backup carrying sender fields on a CASH payment imports with
 *    them dropped (validatePayment is the sanitizer; the raw spread in
 *    backup import must not resurrect them);
 *  - correction never silently strips the metadata (carry-over rule,
 *    same as walletVerified / screenshot), and a correction that passes
 *    new sender values updates them;
 *  - Quick Collect passes the fields through executeQuickCollection
 *    into the stored payment and its receipt;
 *  - the wallet reconciliation entry carries the sender label;
 *  - payments without sender metadata render exactly as before (no
 *    Sender row on receipts, legacy statement description);
 *  - every new UI string exists in BOTH language dictionaries, and the
 *    static wiring (profile form fields, Quick Collect inputs) is
 *    present.
 * Synthetic data only — names, TIDs and digits are invented fixtures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  addPayment, validatePayment, correctPayment,
  createJsonBackup, previewJsonBackupMerge,
  paymentSenderTitle, paymentSenderDigits, paymentSenderLabel
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { formatCustomerStatement } from '../form-validation.js';
import { buildWalletReconciliation } from '../wallet-reconciliation.js';
import { TRANSLATIONS } from '../nav-language.js';

const OCT_29 = new Date(2026, 9, 29, 12);

function octoberState() {
  let state = createInitialState(['Metadata Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  return state;
}
const octoberBill = (state) => state.customers[0].bills.find(b => b.month === '2026-10');

/** The SPEC PIN payment: NayaPay, tid NP-998877, Hamza, …3310. */
function pinState() {
  return addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '3000', method: 'NayaPay',
    transactionId: 'NP-998877', senderTitle: 'Hamza', senderDigits: '3310'
  }, OCT_29);
}
const pinPayment = (state) => octoberBill(state).payments[0];

// ------------------------------------------------------------ sanitize ----
test('validatePayment keeps sender metadata for digital methods, cleaned', () => {
  const v = validatePayment({
    date: '2026-10-29', amount: 3000, method: 'NayaPay',
    transactionId: 'NP-998877', senderTitle: '  Hamza\nKhan ', senderDigits: '0300-1233310'
  }, OCT_29);
  assert.equal(v.transactionId, 'NP-998877');
  assert.equal(v.senderTitle, 'Hamza Khan');
  // Digits are reduced to the LAST 4 — the full number is never stored.
  assert.equal(v.senderDigits, '3310');
});

test('validatePayment keeps sender metadata for every digital method', () => {
  for (const method of ['Easypaisa', 'JazzCash', 'NayaPay', 'Bank Transfer', 'Raast']) {
    const v = validatePayment({ date: '2026-10-29', amount: 100, method, senderTitle: 'Hamza', senderDigits: '3310' }, OCT_29);
    assert.equal(v.senderTitle, 'Hamza', method);
    assert.equal(v.senderDigits, '3310', method);
  }
});

test('cash payments drop sender metadata — legacy record shape kept', () => {
  const v = validatePayment({
    date: '2026-10-29', amount: 3000, method: 'Cash',
    senderTitle: 'Hamza', senderDigits: '3310'
  }, OCT_29);
  assert.equal('senderTitle' in v, false);
  assert.equal('senderDigits' in v, false);
});

test('blank or digit-less sender values are dropped, never stored raw', () => {
  const v = validatePayment({
    date: '2026-10-29', amount: 3000, method: 'JazzCash',
    senderTitle: '   ', senderDigits: 'no digits here'
  }, OCT_29);
  assert.equal('senderTitle' in v, false);
  assert.equal('senderDigits' in v, false);
});

test('an overlong sender title throws like the other name fields', () => {
  assert.throws(
    () => validatePayment({ date: '2026-10-29', amount: 100, method: 'NayaPay', senderTitle: 'x'.repeat(101) }, OCT_29),
    /Sender name must be 100 characters or fewer/
  );
});

test('sender readers re-sanitize defensively and build the display label', () => {
  assert.equal(paymentSenderTitle({ senderTitle: '  A\nB ' }), 'A B');
  assert.equal(paymentSenderDigits({ senderDigits: '03001233310' }), '3310');
  assert.equal(paymentSenderLabel({ senderTitle: 'Hamza', senderDigits: '3310' }), 'Hamza (…3310)');
  assert.equal(paymentSenderLabel({ senderTitle: 'Hamza' }), 'Hamza');
  assert.equal(paymentSenderLabel({ senderDigits: '3310' }), '…3310');
  assert.equal(paymentSenderLabel({}), '');
  assert.equal(paymentSenderLabel(null), '');
});

// ------------------------------------------------------------- SPEC PIN ----
test('SPEC PIN: NayaPay NP-998877 + Hamza + 3310 persists all three fields', () => {
  const payment = pinPayment(pinState());
  assert.equal(payment.transactionId, 'NP-998877');
  assert.equal(payment.senderTitle, 'Hamza');
  assert.equal(payment.senderDigits, '3310');
});

test('SPEC PIN: backup round-trip keeps tid + sender fields byte-identical', () => {
  const backupText = createJsonBackup(pinState(), OCT_29);
  const preview = previewJsonBackupMerge(createInitialState([]), backupText);
  assert.equal(preview.canApply, true);
  const imported = preview.state.customers[0].bills.find(b => b.month === '2026-10').payments[0];
  assert.equal(imported.transactionId, 'NP-998877');
  assert.equal(imported.senderTitle, 'Hamza');
  assert.equal(imported.senderDigits, '3310');
});

test('backup sanitize: sender fields on a cash payment import dropped', () => {
  const raw = octoberState();
  octoberBill(raw).payments.push({
    id: 'pay-sender-bad', date: '2026-10-29', amount: 3000, method: 'Cash',
    senderTitle: 'Hamza', senderDigits: '3310'
  });
  const preview = previewJsonBackupMerge(createInitialState([]), createJsonBackup(raw, OCT_29));
  assert.equal(preview.canApply, true);
  const imported = preview.state.customers[0].bills.find(b => b.month === '2026-10').payments.find(p => p.id === 'pay-sender-bad');
  assert.ok(imported, 'payment itself must import');
  assert.equal('senderTitle' in imported, false);
  assert.equal('senderDigits' in imported, false);
});

test('SPEC PIN: statement renders [Method • TID • Sender (…3310)]', () => {
  const state = pinState();
  const events = formatCustomerStatement(state.customers[0], { range: 'all' }).events;
  const paymentEvent = events.find(e => e.type === 'payment');
  assert.ok(paymentEvent, 'statement has a payment event');
  assert.equal(paymentEvent.method, 'NayaPay');
  assert.match(paymentEvent.description, /NayaPay/);
  assert.match(paymentEvent.description, /NP-998877/);
  assert.match(paymentEvent.description, /Sender: Hamza \(…3310\)/);
  assert.equal(paymentEvent.senderLabel, 'Hamza (…3310)');
});

test('SPEC PIN: every receipt layout renders the sender', () => {
  const state = pinState();
  const customer = state.customers[0];
  const receipt = buildPaymentReceipt(customer, octoberBill(state), pinPayment(state));
  assert.equal(receipt.senderLabel, 'Hamza (…3310)');
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.match(html, /Hamza \(…3310\)/, format);
  }
  const png = buildPngReceiptModel(receipt, customer);
  const methodLine = png.financial.find(f => /Payment Method/.test(f.label));
  assert.ok(methodLine, 'PNG model has a payment-method line');
  assert.match(methodLine.value, /Sender: Hamza \(…3310\)/);
});

// ------------------------------------------------------- legacy unchanged ----
test('payments without sender metadata render exactly as before', () => {
  const state = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '3000', method: 'NayaPay', transactionId: 'NP-998877'
  }, OCT_29);
  const customer = state.customers[0];
  const receipt = buildPaymentReceipt(customer, octoberBill(state), octoberBill(state).payments[0]);
  assert.equal(receipt.senderLabel, '');
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    assert.doesNotMatch(generatePaymentReceiptHtml(receipt, { format }), /Sender/, format);
  }
  const events = formatCustomerStatement(customer, { range: 'all' }).events;
  const paymentEvent = events.find(e => e.type === 'payment');
  assert.equal(paymentEvent.description, 'Payment Received · NayaPay (Ref: NP-998877)');
  assert.equal(paymentEvent.senderLabel, '');
});

// ------------------------------------------------------------- correction ----
test('correction preserves sender metadata unless new values are passed', () => {
  let state = pinState();
  const id = pinPayment(state).id;
  state = correctPayment(state, 'seed-001', '2026-10', id, {
    date: '2026-10-29', amount: '2500', method: 'NayaPay', transactionId: 'NP-998877'
  }, OCT_29);
  let payment = octoberBill(state).payments.find(p => p.id === id);
  assert.equal(payment.senderTitle, 'Hamza');
  assert.equal(payment.senderDigits, '3310');

  state = correctPayment(state, 'seed-001', '2026-10', id, {
    date: '2026-10-29', amount: '2500', method: 'NayaPay', transactionId: 'NP-998877',
    senderTitle: 'Ali Raza', senderDigits: '9999'
  }, OCT_29);
  payment = octoberBill(state).payments.find(p => p.id === id);
  assert.equal(payment.senderTitle, 'Ali Raza');
  assert.equal(payment.senderDigits, '9999');
});

// ----------------------------------------------------------- quick collect ----
test('Quick Collect stores sender metadata and its receipt carries the label', () => {
  const state = octoberState();
  const customer = state.customers[0];
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: customer.id, month: '2026-10', amount: 3000, date: '2026-10-29',
    method: 'NayaPay', transactionId: 'NP-998877', senderTitle: 'Hamza', senderDigits: '3310'
  }, OCT_29);
  const stored = octoberBill(nextState).payments[0];
  assert.equal(stored.senderTitle, 'Hamza');
  assert.equal(stored.senderDigits, '3310');
  assert.equal(receipt.senderLabel, 'Hamza (…3310)');
});

// ----------------------------------------------------- wallet reconciliation ----
test('wallet reconciliation entries carry the sender metadata', () => {
  const report = buildWalletReconciliation(pinState().customers, '2026-10', []);
  assert.equal(report.payments.length, 1);
  assert.equal(report.payments[0].transactionId, 'NP-998877');
  assert.equal(report.payments[0].senderTitle, 'Hamza');
  assert.equal(report.payments[0].senderDigits, '3310');
  assert.equal(report.payments[0].senderLabel, 'Hamza (…3310)');
});

// ------------------------------------------------------------------ i18n ----
test('every new UI string exists in BOTH language dictionaries', () => {
  for (const key of ['spay_sender_name_label', 'spay_sender_name_ph', 'spay_sender_digits_label', 'spay_sender_digits_ph', 'spay_sender_row']) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
  }
  assert.match(TRANSLATIONS.en.spay_sender_row, /\{label\}/);
  assert.match(TRANSLATIONS.ur.spay_sender_row, /\{label\}/);
});

test('static wiring: profile form + Quick Collect expose the sender fields', () => {
  const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appJs, /name="senderTitle"/);
  assert.match(appJs, /name="senderDigits"/);
  assert.match(appJs, /profilePaymentSenderMarkup/);
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(indexHtml, /id="quickCollectSenderNameInput"/);
  assert.match(indexHtml, /id="quickCollectSenderDigitsInput"/);
  const qcJs = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(qcJs, /quickCollectSenderNameInput/);
  assert.match(qcJs, /quickCollectSenderDigitsInput/);
});
