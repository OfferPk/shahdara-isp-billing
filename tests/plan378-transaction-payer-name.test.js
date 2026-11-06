// Transaction payer name note (Plan 378): the person who actually
// handed over the cash — a father, a son, a neighbour — recorded with
// the payment in plain words. The payer name is already recorded on
// the payment (paidBy) and already shown on the transaction list, the
// profile payment history, the Quick Collect receipt card, and the
// WhatsApp draft. The missing piece was the printed receipt: the
// receipt object never carried the payer name, so no printed layout
// showed it. These tests pin the missing piece: the receipt object
// carries the name, all three printed layouts print it where given
// (and show only the customer when there is none), the Urdu-script
// print re-labels it, and the slip model carries it on its method
// line. Generic fixtures only — no real customer names.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  TRANSACTION_PAYER_NAME_MAX_LENGTH,
  normalizeTransactionPayerName,
  transactionPayerNameOf,
  transactionPayerReceiptField,
  transactionPayerReceiptFieldHtml,
} from '../transaction-payer-name.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { applyReceiptScript } from '../receipt-script.js';
import { buildPngReceiptModel } from '../png-receipt.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'transaction-payer-name.js'), 'utf8');
const testSrc = readFileSync(join(dir, 'plan378-transaction-payer-name.test.js'), 'utf8');

const PAYER = 'Payer One';

const customerWithBill = () => ({
  id: 'c1',
  customerNumber: 101,
  name: 'Synthetic Customer',
  packageSpeed: '5 Mbps',
  bills: [{ id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [], amountHistory: [] }],
  incidents: [],
});

const receiptFor = (paidBy) => {
  const payment = paidBy === undefined
    ? { id: 'pay-1', amount: 3000, date: '2026-10-20', method: 'Cash' }
    : { id: 'pay-1', amount: 3000, date: '2026-10-20', method: 'Cash', paidBy };
  const customer = customerWithBill();
  const bill = { ...customer.bills[0], payments: [payment] };
  customer.bills = [bill];
  return { customer, bill, payment, receipt: buildPaymentReceipt(customer, bill, payment) };
};

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

test('normalize: a plain name is trimmed, nothing else changes', () => {
  assert.equal(normalizeTransactionPayerName('  Payer One  '), 'Payer One');
  assert.equal(normalizeTransactionPayerName(PAYER), 'Payer One');
});

test('normalize: line breaks fold to spaces, like the payment record', () => {
  assert.equal(normalizeTransactionPayerName('Payer\nOne'), 'Payer One');
  assert.equal(normalizeTransactionPayerName('Payer\r\nOne'), 'Payer One');
  assert.equal(normalizeTransactionPayerName('Payer\u2028One'), 'Payer One');
  assert.equal(normalizeTransactionPayerName('Payer\u2029One'), 'Payer One');
});

test('normalize: empty, blank, and non-string values have no name', () => {
  assert.equal(normalizeTransactionPayerName(''), '');
  assert.equal(normalizeTransactionPayerName('   '), '');
  assert.equal(normalizeTransactionPayerName(null), '');
  assert.equal(normalizeTransactionPayerName(undefined), '');
  assert.equal(normalizeTransactionPayerName(42), '');
  assert.equal(normalizeTransactionPayerName({ name: PAYER }), '');
});

test('normalize: a name longer than the payment record cap is cut at 100', () => {
  assert.equal(TRANSACTION_PAYER_NAME_MAX_LENGTH, 100);
  const long = 'P'.repeat(150);
  assert.equal(normalizeTransactionPayerName(long).length, 100);
});

test('name of a payment: reads paidBy, empty when none was given', () => {
  assert.equal(transactionPayerNameOf({ paidBy: PAYER }), 'Payer One');
  assert.equal(transactionPayerNameOf({ paidBy: '  Payer One\n' }), 'Payer One');
  assert.equal(transactionPayerNameOf({}), '');
  assert.equal(transactionPayerNameOf({ paidBy: '' }), '');
  assert.equal(transactionPayerNameOf(null), '');
  assert.equal(transactionPayerNameOf(undefined), '');
});

// ---------------------------------------------------------------------------
// Receipt field builders
// ---------------------------------------------------------------------------

test('A4 field: one entry to spread, [] when there is no payer name', () => {
  assert.deepEqual(transactionPayerReceiptField({ paidBy: PAYER }), [['Paid by / ادا کنندہ', 'Payer One']]);
  assert.deepEqual(transactionPayerReceiptField({}), []);
  assert.deepEqual(transactionPayerReceiptField({ paidBy: '   ' }), []);
  assert.deepEqual(transactionPayerReceiptField(null), []);
});

test('thermal field HTML: the div with the caller label and the escaped name', () => {
  const html = transactionPayerReceiptFieldHtml({ paidBy: PAYER }, 'Paid by');
  assert.equal(html, '<div class="receipt-field"><dt>Paid by:</dt><dd>Payer One</dd></div>');
  const bilingual = transactionPayerReceiptFieldHtml({ paidBy: PAYER }, 'Paid by / ادا کنندہ');
  assert.equal(bilingual, '<div class="receipt-field"><dt>Paid by / ادا کنندہ:</dt><dd>Payer One</dd></div>');
  assert.equal(transactionPayerReceiptFieldHtml({}, 'Paid by'), '');
  assert.equal(transactionPayerReceiptFieldHtml({ paidBy: '' }, 'Paid by'), '');
});

test('thermal field HTML: a hostile payer name is escaped, never raw', () => {
  const html = transactionPayerReceiptFieldHtml({ paidBy: '<script>alert(1)</script>' }, 'Paid by');
  assert.ok(!html.includes('<script>'), 'no raw script tag in the receipt');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'name escaped');
});

// ---------------------------------------------------------------------------
// Receipt object: buildPaymentReceipt carries the payer name
// ---------------------------------------------------------------------------

test('receipt object: paidBy is carried when the payment records one', () => {
  const { receipt } = receiptFor(PAYER);
  assert.equal(receipt.paidBy, 'Payer One');
  assert.equal(receipt.status, 'PAID');
  assert.equal(receipt.balanceDueCents, 0);
});

test('receipt object: paidBy is empty when the payment records none', () => {
  const { receipt } = receiptFor(undefined);
  assert.equal(receipt.paidBy, '');
});

test('receipt object: the payer name is normalized on the way in', () => {
  const { receipt } = receiptFor('  Payer\nOne  ');
  assert.equal(receipt.paidBy, 'Payer One');
});

test('receipt object: building the receipt changes no bill, payment, or customer record', () => {
  const { customer, bill, payment } = receiptFor(PAYER);
  const before = JSON.stringify({ customer, bill, payment });
  buildPaymentReceipt(customer, bill, payment);
  assert.equal(JSON.stringify({ customer, bill, payment }), before, 'inputs never mutated');
});

// ---------------------------------------------------------------------------
// Printed layouts: all three show the payer name where given
// ---------------------------------------------------------------------------

test('printed receipt: A4 shows the payer name, and only the customer without one', () => {
  const { receipt } = receiptFor(PAYER);
  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.match(a4, /Paid by \/ ادا کنندہ/);
  assert.match(a4, /Payer One/);
  const plain = generatePaymentReceiptHtml(receiptFor(undefined).receipt, { format: 'a4' });
  assert.ok(!plain.includes('Paid by'), 'no payer line without a payer name');
});

test('printed receipt: thermal-80 shows the bilingual payer line', () => {
  const { receipt } = receiptFor(PAYER);
  const t80 = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  assert.match(t80, /Paid by \/ ادا کنندہ:/);
  assert.match(t80, /Payer One/);
  const plain = generatePaymentReceiptHtml(receiptFor(undefined).receipt, { format: 'thermal-80' });
  assert.ok(!plain.includes('Paid by'), 'no payer line without a payer name');
});

test('printed receipt: thermal-58 shows the short payer line', () => {
  const { receipt } = receiptFor(PAYER);
  const t58 = generatePaymentReceiptHtml(receipt, { format: 'thermal-58' });
  assert.match(t58, /Paid by:/);
  assert.match(t58, /Payer One/);
  const plain = generatePaymentReceiptHtml(receiptFor(undefined).receipt, { format: 'thermal-58' });
  assert.ok(!plain.includes('Paid by'), 'no payer line without a payer name');
});

test('printed receipt: a hostile payer name is escaped on every layout', () => {
  const { receipt } = receiptFor('<b>&"Payer"');
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(!html.includes('<b>&"Payer"'), `no raw name on ${format}`);
    assert.ok(html.includes('&lt;b&gt;&amp;&quot;Payer&quot;'), `name escaped on ${format}`);
  }
});

test('printed receipt: Urdu script re-labels the payer line, the name stays as typed', () => {
  const { receipt } = receiptFor(PAYER);
  const urdu = applyReceiptScript(generatePaymentReceiptHtml(receipt, { format: 'a4' }), 'urdu');
  assert.ok(!urdu.includes('Paid by'), 'Roman label replaced in Urdu script');
  assert.match(urdu, /<dt>ادا کنندہ<\/dt>/);
  assert.match(urdu, /Payer One/);
  const urdu80 = applyReceiptScript(generatePaymentReceiptHtml(receipt, { format: 'thermal-80' }), 'urdu');
  assert.match(urdu80, /<dt>ادا کنندہ:<\/dt>/);
});

// ---------------------------------------------------------------------------
// Slip model: the payer name rides the PNG slip method line
// ---------------------------------------------------------------------------

test('slip model: the method line carries the payer name where given', () => {
  const { customer, receipt } = receiptFor(PAYER);
  const model = buildPngReceiptModel(receipt, customer);
  const methodRow = model.financial.find((row) => String(row.label).startsWith('Payment Method'));
  assert.ok(methodRow, 'payment method row exists');
  assert.match(methodRow.value, /· Paid by: Payer One/);
});

test('slip model: no payer name, no payer suffix on the method line', () => {
  const { customer, receipt } = receiptFor(undefined);
  const model = buildPngReceiptModel(receipt, customer);
  const methodRow = model.financial.find((row) => String(row.label).startsWith('Payment Method'));
  assert.ok(methodRow, 'payment method row exists');
  assert.equal(methodRow.value, 'Cash');
});

// ---------------------------------------------------------------------------
// Purity, fences, fixtures
// ---------------------------------------------------------------------------

test('module: no store, no page, no clock, no network, no import', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'display only: no store key');
  assert.ok(!moduleSrc.includes('document.'), 'no page access');
  assert.ok(!moduleSrc.includes('new Date('), 'no clock read');
  assert.ok(!moduleSrc.includes('Date.now('), 'no clock read');
  assert.ok(!moduleSrc.includes('fetch('), 'no network');
  assert.ok(!moduleSrc.includes('window.'), 'no page access');
  assert.ok(!moduleSrc.includes('localStorage'), 'no storage');
  assert.ok(!moduleSrc.includes('import'), 'import-free pure module');
});

test('module: no standalone OLT in the module', () => {
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'deployment guard: no standalone OLT');
});

test('module: the header never names a fenced module literally', () => {
  // The payer name is already recorded by the payment record and
  // already shown by the entry form, the history rows, and the draft
  // builder — those modules were checked by filename only, neither
  // read nor rewritten, and this module must not re-implement them.
  // The names are built from fragments so this test itself never
  // contains a fenced filename literally.
  const fenced = [
    ['co', 're'].join('') + '.js',
    ['nav-quick-', 'collect'].join('') + '.js',
    ['prof', 'ile-ui'].join('') + '.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `header must not name ${name} literally`);
  }
});

test('fixtures: no real customer names anywhere in this test file', () => {
  // Built from fragments so the list itself never contains a
  // forbidden name literally (Plan 375 lesson).
  const forbidden = ['Ki' + 'ran', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer'];
  for (const name of forbidden) {
    assert.ok(!testSrc.includes(name), `test file must not contain the real name ${name}`);
  }
});
