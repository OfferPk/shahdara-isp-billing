// Plan 392 — Find a transaction by receipt number: one search that
// finds the transaction carrying a typed receipt number and opens
// it with customer, amount, date, and method — or says plainly that
// no such receipt exists. Search only; it never changes any bill,
// payment, or receipt record. A voided payment's number is still
// found, so a number from a returned series resolves like any
// other. The receipt verification lookup already answers "is this
// receipt genuine" in its own dialog; this plan adds only the
// missing piece — a search on the Transactions view that opens the
// transaction itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECEIPT_NUMBER_MAX_LENGTH,
  normalizeReceiptNumber,
  receiptNumberOfRow,
  findTransactionByReceiptNumber,
  formatReceiptSearchAmount,
  receiptNumberSearchLineText,
  receiptNumberSearchRowMarkup,
} from '../receipt-number-search.js';
import { listTransactions } from '../core.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'receipt-number-search.js'), 'utf8');
const coreSrc = readFileSync(join(dir, '..', 'core.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

// Generic fixtures only — clearly made-up names, never a real person.
const ROW_ONE = {
  paymentId: 'p-1',
  id: 'p-1',
  receiptNumber: 'RCPT-41-202611-01',
  customerNumber: 41,
  customerName: 'Customer One',
  amount: 3000,
  date: '2026-11-05',
  method: 'Cash',
  month: '2026-11',
  voided: false,
};
const ROW_VOIDED = {
  paymentId: 'p-2',
  id: 'p-2',
  receiptNumber: 'RCPT-41-202611-02',
  customerNumber: 41,
  customerName: 'Customer One',
  amount: 1500.5,
  date: '2026-11-06',
  method: 'Easypaisa',
  month: '2026-11',
  voided: true,
};
const ROW_PERMANENT = {
  paymentId: 'p-3',
  id: 'p-3',
  permanentReceiptNumber: 'RCPT-42-202611-01',
  customerNumber: 42,
  customerName: 'Customer Two',
  amount: 1000,
  date: '2026-11-07',
  method: 'Cash',
  month: '2026-11',
  voided: false,
};
const ROW_UNNUMBERED = {
  paymentId: 'p-4',
  id: 'p-4',
  customerNumber: 43,
  customerName: 'Customer Three',
  amount: 500,
  date: '2026-11-08',
  method: 'JazzCash',
  month: '2026-11',
  voided: false,
};

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
    customerNumber: 41,
    name: 'Customer One',
    mohalla: 'Mohalla A',
    archived: false,
    monthlySellingAmount: 2500,
    bills,
    ...overrides,
  };
}

function stateWith(customer) {
  return { version: 1, nextCustomerNumber: 42, customers: [customer] };
}

test('Plan 392: normalizeReceiptNumber passes a printed number through unchanged', () => {
  assert.equal(RECEIPT_NUMBER_MAX_LENGTH, 64);
  assert.equal(normalizeReceiptNumber('RCPT-41-202611-01'), 'RCPT-41-202611-01');
  assert.equal(normalizeReceiptNumber('R'.repeat(100)).length, 64);
});

test('Plan 392: normalizeReceiptNumber uppercases a lowercase number', () => {
  assert.equal(normalizeReceiptNumber('rcpt-41-202611-01'), 'RCPT-41-202611-01');
});

test('Plan 392: normalizeReceiptNumber strips surrounding and inner spaces', () => {
  assert.equal(normalizeReceiptNumber('  RCPT-41-2026 11-01  '), 'RCPT-41-202611-01');
});

test('Plan 392: normalizeReceiptNumber returns empty for nothing usable', () => {
  assert.equal(normalizeReceiptNumber(''), '');
  assert.equal(normalizeReceiptNumber('   '), '');
  assert.equal(normalizeReceiptNumber(null), '');
  assert.equal(normalizeReceiptNumber(undefined), '');
  assert.equal(normalizeReceiptNumber(123), '123');
});

test('Plan 392: receiptNumberOfRow prefers the stored receipt number', () => {
  assert.equal(receiptNumberOfRow(ROW_ONE), 'RCPT-41-202611-01');
});

test('Plan 392: receiptNumberOfRow falls back to the permanent number', () => {
  assert.equal(receiptNumberOfRow(ROW_PERMANENT), 'RCPT-42-202611-01');
});

test('Plan 392: receiptNumberOfRow derives when nothing is stored', () => {
  const seen = [];
  const derived = receiptNumberOfRow(ROW_UNNUMBERED, (args) => {
    seen.push(args);
    return 'RCPT-43-202611-01';
  });
  assert.equal(derived, 'RCPT-43-202611-01');
  assert.deepEqual(seen, [{
    customerNumber: 43,
    paymentDate: '2026-11-08',
    paymentId: 'p-4',
    billMonth: '2026-11',
  }]);
});

test('Plan 392: receiptNumberOfRow returns empty when the deriver throws', () => {
  assert.equal(receiptNumberOfRow(ROW_UNNUMBERED, () => { throw new Error('boom'); }), '');
});

test('Plan 392: receiptNumberOfRow returns empty for a non-row', () => {
  assert.equal(receiptNumberOfRow(null), '');
  assert.equal(receiptNumberOfRow('RCPT-41-202611-01'), '');
  assert.equal(receiptNumberOfRow(ROW_UNNUMBERED), '');
});

test('Plan 392: findTransactionByReceiptNumber returns the exact row', () => {
  const rows = [ROW_ONE, ROW_VOIDED, ROW_PERMANENT];
  assert.equal(findTransactionByReceiptNumber(rows, 'RCPT-41-202611-01'), ROW_ONE);
});

test('Plan 392: findTransactionByReceiptNumber ignores case and spaces in the query', () => {
  const rows = [ROW_ONE, ROW_VOIDED, ROW_PERMANENT];
  assert.equal(findTransactionByReceiptNumber(rows, '  rcpt-41-2026 11-01 '), ROW_ONE);
});

test('Plan 392: findTransactionByReceiptNumber still finds a voided payment', () => {
  const rows = [ROW_ONE, ROW_VOIDED, ROW_PERMANENT];
  assert.equal(findTransactionByReceiptNumber(rows, 'RCPT-41-202611-02'), ROW_VOIDED);
});

test('Plan 392: findTransactionByReceiptNumber returns null when nothing matches', () => {
  const rows = [ROW_ONE, ROW_VOIDED, ROW_PERMANENT];
  assert.equal(findTransactionByReceiptNumber(rows, 'RCPT-99-202611-01'), null);
});

test('Plan 392: findTransactionByReceiptNumber returns null for an empty query or a non-list', () => {
  assert.equal(findTransactionByReceiptNumber([ROW_ONE], ''), null);
  assert.equal(findTransactionByReceiptNumber([ROW_ONE], '   '), null);
  assert.equal(findTransactionByReceiptNumber(null, 'RCPT-41-202611-01'), null);
  assert.equal(findTransactionByReceiptNumber('nope', 'RCPT-41-202611-01'), null);
});

test('Plan 392: findTransactionByReceiptNumber takes the first match on duplicates', () => {
  const twin = { ...ROW_ONE, paymentId: 'p-9', id: 'p-9' };
  assert.equal(findTransactionByReceiptNumber([twin, ROW_ONE], 'RCPT-41-202611-01'), twin);
});

test('Plan 392: findTransactionByReceiptNumber never changes the input list', () => {
  const rows = [ROW_ONE, ROW_VOIDED, ROW_PERMANENT, ROW_UNNUMBERED];
  const before = JSON.stringify(rows);
  findTransactionByReceiptNumber(rows, 'RCPT-41-202611-01');
  findTransactionByReceiptNumber(rows, 'RCPT-99-202611-01');
  assert.equal(JSON.stringify(rows), before);
});

test('Plan 392: findTransactionByReceiptNumber uses the deriver for unnumbered rows', () => {
  const rows = [ROW_UNNUMBERED];
  assert.equal(
    findTransactionByReceiptNumber(rows, 'RCPT-43-202611-01', { deriveReceiptNumber: () => 'RCPT-43-202611-01' }),
    ROW_UNNUMBERED,
  );
  assert.equal(
    findTransactionByReceiptNumber(rows, 'RCPT-43-202611-02', { deriveReceiptNumber: () => 'RCPT-43-202611-01' }),
    null,
  );
});

test('Plan 392: formatReceiptSearchAmount follows the app min-0-decimals convention', () => {
  assert.equal(formatReceiptSearchAmount(3000), 'PKR 3,000');
  assert.equal(formatReceiptSearchAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatReceiptSearchAmount('2500'), 'PKR 2,500');
  assert.equal(formatReceiptSearchAmount(null), 'Not set');
  assert.equal(formatReceiptSearchAmount('abc'), 'Not set');
});

test('Plan 392: the found line carries receipt, customer, amount, date, and method', () => {
  const line = receiptNumberSearchLineText('RCPT-41-202611-01', ROW_ONE);
  assert.ok(line.includes('RCPT-41-202611-01'), line);
  assert.ok(line.includes('#41'), line);
  assert.ok(line.includes('Customer One'), line);
  assert.ok(line.includes('PKR 3,000'), line);
  assert.ok(line.includes('2026-11-05'), line);
  assert.ok(line.includes('Cash'), line);
  assert.ok(!line.includes('VOID'), line);
});

test('Plan 392: the found line flags a voided payment', () => {
  const line = receiptNumberSearchLineText('RCPT-41-202611-02', ROW_VOIDED);
  assert.ok(line.includes('RCPT-41-202611-02'), line);
  assert.ok(line.includes('PKR 1,500.5'), line);
  assert.ok(line.includes('VOID'), line);
});

test('Plan 392: the not-found line says plainly that no such receipt exists', () => {
  assert.equal(
    receiptNumberSearchLineText('RCPT-99-202611-01', null),
    'No receipt RCPT-99-202611-01 exists.',
  );
});

test('Plan 392: an empty query asks for a number first', () => {
  assert.equal(receiptNumberSearchLineText('', null), 'Type a receipt number.');
  assert.equal(receiptNumberSearchLineText('   ', ROW_ONE), 'Type a receipt number.');
});

test('Plan 392: the row markup shows the receipt number on the transaction', () => {
  assert.equal(receiptNumberSearchRowMarkup(ROW_ONE), ' · Receipt RCPT-41-202611-01');
});

test('Plan 392: the row markup escapes a crafted receipt number', () => {
  const crafted = { ...ROW_ONE, receiptNumber: 'RCPT-<41>&' };
  assert.equal(receiptNumberSearchRowMarkup(crafted), ' · Receipt RCPT-&lt;41&gt;&amp;');
});

test('Plan 392: the row markup shows nothing extra without a receipt number', () => {
  assert.equal(receiptNumberSearchRowMarkup(ROW_UNNUMBERED), '');
  assert.equal(receiptNumberSearchRowMarkup(null), '');
});

test('Plan 392: listTransactions carries the receipt number on the row', () => {
  const payment = {
    id: 'P-1', date: '2026-11-05', amount: 3000, method: 'Cash',
    receiptNumber: 'RCPT-41-202611-01',
  };
  const state = stateWith(customerWithBills([bill('2026-11', 3000, [payment])]));
  const rows = listTransactions(state);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].receiptNumber, 'RCPT-41-202611-01');
});

test('Plan 392: listTransactions carries the receipt number on a voided row too', () => {
  const payment = {
    id: 'P-2', date: '2026-11-06', amount: 1500, method: 'Easypaisa',
    receiptNumber: 'RCPT-41-202611-02', voided: true,
  };
  const state = stateWith(customerWithBills([bill('2026-11', 3000, [payment])]));
  const rows = listTransactions(state);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].receiptNumber, 'RCPT-41-202611-02');
  assert.equal(rows[0].voided, true);
});

test('Plan 392: listTransactions gives an empty receipt number when the payment has none', () => {
  const payment = { id: 'P-3', date: '2026-11-07', amount: 1000, method: 'Cash' };
  const state = stateWith(customerWithBills([bill('2026-11', 3000, [payment])]));
  const rows = listTransactions(state);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].receiptNumber, '');
});

test('Plan 392: the module keeps no store', () => {
  assert.ok(!moduleSrc.includes('shahdara_'), 'module must not name a store key');
  assert.ok(!moduleSrc.includes('localStorage'), 'module must not touch storage');
});

test('Plan 392: the module never names a fenced neighbour', () => {
  // Fragment-built so this test itself never spells the fenced names.
  const fenced = [
    'next' + '-receipt-number',
    'reversal' + '-link',
    'payment' + '-void-audit',
    'receipt' + '-verifier',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('Plan 392: fixtures are generic — no real customer name in the module or test', () => {
  // Fragment-built so this test itself never spells the real names.
  const real = ['Ki' + 'ran', 'Bi' + 'lal', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Sa' + 'ad'];
  for (const name of real) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

test('Plan 392: no hex colour new to styles.css', () => {
  const hexes = (src) => new Set(src.match(/#[0-9a-fA-F]{3,6}\b/g) || []);
  const stripped = stylesSrc.replace(/\.rns-[^{]*\{[^}]*\}/g, '');
  assert.deepEqual([...hexes(stylesSrc)].sort(), [...hexes(stripped)].sort());
});

test('Plan 392: the module never contains the standalone word OLT', () => {
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not contain the standalone word OLT');
});

test('Plan 392: the search is wired into the Transactions view', () => {
  assert.ok(indexSrc.includes('id="rnsReceiptSearchForm"'), 'index.html must carry the receipt search form');
  assert.ok(indexSrc.includes('id="rnsReceiptInput"'), 'index.html must carry the receipt search input');
  assert.ok(indexSrc.includes('id="rnsReceiptResult"'), 'index.html must carry the receipt search result');
  assert.ok(appSrc.includes("from './receipt-number-search.js'"), 'app.js must import the search module');
  assert.ok(appSrc.includes('findTransactionByReceiptNumber'), 'app.js must call the finder');
  assert.ok(appSrc.includes('receiptSearchPaymentId'), 'app.js must track the found payment');
  assert.ok(appSrc.includes('receiptNumberSearchRowMarkup'), 'app.js must show the receipt number on the row');
});

test('Plan 392: the receipt number rides the transaction row in core.js', () => {
  assert.ok(coreSrc.includes('receiptNumber:'), 'core.js projection must carry receiptNumber');
});
