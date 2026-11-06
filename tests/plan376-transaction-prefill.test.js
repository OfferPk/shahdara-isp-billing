import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isStrictTransactionPrefillMonth,
  oldestOpenBillPrefill,
  transactionPrefillLineText,
  transactionPrefillLineHtml,
} from '../transaction-prefill.js';
import { addManualBaqayaEntry, calculatePaymentAllocations } from '../core.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'transaction-prefill.js'), 'utf8');
const quickCollectSrc = readFileSync(join(dir, '..', 'nav-quick-collect.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');
const langSrc = readFileSync(join(dir, '..', 'nav-language.js'), 'utf8');
const testSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');

const REF = new Date('2026-10-15T10:00:00Z');

// Generic fixtures only — clearly made-up names, never a real customer.
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

function payment(date, amount, method = 'Cash') {
  return { id: `P-${date}`, date, amount, method };
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

// The mobile-nav fixture shape: August paid in full, September
// partially paid (2,500 billed, 1,000 received), October unpaid.
function mixedDuesCustomer() {
  return customerWithBills([
    bill('2026-08', 2500, [payment('2026-08-05', 2500)]),
    bill('2026-09', 2500, [payment('2026-09-07', 1000, 'JazzCash')]),
    bill('2026-10', 3000),
  ]);
}

// ---------------------------------------------------------------------------
// Strict months
// ---------------------------------------------------------------------------

test('months: strict YYYY-MM, 01–12 only', () => {
  assert.equal(isStrictTransactionPrefillMonth('2026-09'), true);
  assert.equal(isStrictTransactionPrefillMonth('2026-01'), true);
  assert.equal(isStrictTransactionPrefillMonth('2026-12'), true);
  assert.equal(isStrictTransactionPrefillMonth('2026-13'), false);
  assert.equal(isStrictTransactionPrefillMonth('2026-00'), false);
  assert.equal(isStrictTransactionPrefillMonth('2026-9'), false);
  assert.equal(isStrictTransactionPrefillMonth('2026/09'), false);
  assert.equal(isStrictTransactionPrefillMonth(''), false);
  assert.equal(isStrictTransactionPrefillMonth(null), false);
  assert.equal(isStrictTransactionPrefillMonth(202609), false);
});

// ---------------------------------------------------------------------------
// Oldest open bill — against the real allocation engine
// ---------------------------------------------------------------------------

test('prefill: the oldest open bill wins, with its remaining balance', () => {
  const state = stateWith(mixedDuesCustomer());
  const prefill = oldestOpenBillPrefill(state.customers[0], calculatePaymentAllocations(state));
  assert.deepEqual(prefill, { amount: 1500, month: '2026-09', billAmount: 2500 });
});

test('prefill: a fully unpaid oldest bill offers its full amount', () => {
  const state = stateWith(customerWithBills([
    bill('2026-09', 3000),
    bill('2026-10', 1000),
  ]));
  const prefill = oldestOpenBillPrefill(state.customers[0], calculatePaymentAllocations(state));
  assert.deepEqual(prefill, { amount: 3000, month: '2026-09', billAmount: 3000 });
});

test('prefill: bills out of order still resolve to the oldest month', () => {
  const state = stateWith(customerWithBills([
    bill('2026-10', 3000),
    bill('2026-08', 2000, [payment('2026-08-05', 500)]),
    bill('2026-09', 2500, [payment('2026-09-07', 2500)]),
  ]));
  const prefill = oldestOpenBillPrefill(state.customers[0], calculatePaymentAllocations(state));
  assert.deepEqual(prefill, { amount: 1500, month: '2026-08', billAmount: 2000 });
});

test('prefill: a partial payment offers the remainder, never the full bill', () => {
  const state = stateWith(customerWithBills([
    bill('2026-09', 2000, [payment('2026-09-02', 1750)]),
  ]));
  const prefill = oldestOpenBillPrefill(state.customers[0], calculatePaymentAllocations(state));
  assert.deepEqual(prefill, { amount: 250, month: '2026-09', billAmount: 2000 });
});

test('prefill: all bills paid offers nothing', () => {
  const state = stateWith(customerWithBills([
    bill('2026-08', 2500, [payment('2026-08-05', 2500)]),
    bill('2026-09', 2500, [payment('2026-09-07', 2500)]),
  ]));
  assert.equal(oldestOpenBillPrefill(state.customers[0], calculatePaymentAllocations(state)), null);
});

test('prefill: no bills offers nothing', () => {
  const state = stateWith(customerWithBills([]));
  assert.equal(oldestOpenBillPrefill(state.customers[0], calculatePaymentAllocations(state)), null);
});

test('prefill: an unpriced bill never offers an invented amount', () => {
  const state = stateWith(customerWithBills([
    { id: 'B-2026-09', month: '2026-09', dueAmount: null, status: 'pending', payments: [] },
  ]));
  assert.equal(oldestOpenBillPrefill(state.customers[0], calculatePaymentAllocations(state)), null);
});

test('prefill: an unpriced oldest bill is skipped for the next priced open bill', () => {
  const state = stateWith(customerWithBills([
    { id: 'B-2026-08', month: '2026-08', dueAmount: null, status: 'pending', payments: [] },
    bill('2026-09', 1500),
  ]));
  const prefill = oldestOpenBillPrefill(state.customers[0], calculatePaymentAllocations(state));
  assert.deepEqual(prefill, { amount: 1500, month: '2026-09', billAmount: 1500 });
});

test('prefill: missing customer, missing id, or no allocation lookup offers nothing', () => {
  const state = stateWith(mixedDuesCustomer());
  const allocations = calculatePaymentAllocations(state);
  assert.equal(oldestOpenBillPrefill(null, allocations), null);
  assert.equal(oldestOpenBillPrefill('CUST-1', allocations), null);
  assert.equal(oldestOpenBillPrefill({ bills: [] }, allocations), null);
  assert.equal(oldestOpenBillPrefill(state.customers[0], null), null);
  assert.equal(oldestOpenBillPrefill(state.customers[0], {}), null);
  assert.equal(oldestOpenBillPrefill(state.customers[0], { forMonth: 'not-a-function' }), null);
});

test('prefill: a bill with an invalid month string is skipped', () => {
  const state = stateWith(customerWithBills([
    { id: 'B-bad', month: 'Sept 2026', dueAmount: 9999, status: 'pending', payments: [] },
    bill('2026-09', 1200),
  ]));
  const prefill = oldestOpenBillPrefill(state.customers[0], calculatePaymentAllocations(state));
  assert.deepEqual(prefill, { amount: 1200, month: '2026-09', billAmount: 1200 });
});

// ---------------------------------------------------------------------------
// Pre-fill line text and HTML
// ---------------------------------------------------------------------------

test('line: plain-words text names the month and the amount still open', () => {
  assert.equal(
    transactionPrefillLineText({ amount: 1500, month: '2026-09', billAmount: 2500 }),
    'Oldest open bill 2026-09: PKR 1,500 still open — offered as the starting amount.'
  );
});

test('line: a caller template with both placeholders is honoured', () => {
  assert.equal(
    transactionPrefillLineText(
      { amount: 250, month: '2026-10', billAmount: 2000 },
      'Bill {month} · {amount} PKR baqi'
    ),
    'Bill 2026-10 · 250 PKR baqi'
  );
});

test('line: a template without both placeholders falls back to the default', () => {
  assert.equal(
    transactionPrefillLineText({ amount: 1500, month: '2026-09', billAmount: 2500 }, 'no placeholders here'),
    'Oldest open bill 2026-09: PKR 1,500 still open — offered as the starting amount.'
  );
});

test('line: no pre-fill, bad month, or non-positive amount gives an empty line', () => {
  assert.equal(transactionPrefillLineText(null), '');
  assert.equal(transactionPrefillLineText({}), '');
  assert.equal(transactionPrefillLineText({ amount: 1500, month: '2026-13', billAmount: 2500 }), '');
  assert.equal(transactionPrefillLineText({ amount: 0, month: '2026-09', billAmount: 2500 }), '');
  assert.equal(transactionPrefillLineText({ amount: -5, month: '2026-09', billAmount: 2500 }), '');
});

test('line html: escaped line in the pre-fill class, empty when nothing is offered', () => {
  const html = transactionPrefillLineHtml({ amount: 1500, month: '2026-09', billAmount: 2500 });
  assert.match(html, /class="txp-prefill-line"/);
  assert.match(html, /Oldest open bill 2026-09: PKR 1,500 still open/);
  assert.equal(transactionPrefillLineHtml(null), '');
  const escaped = transactionPrefillLineHtml(
    { amount: 1500, month: '2026-09', billAmount: 2500 },
    { line: 'Bill {month} <b>{amount}</b> & co.' }
  );
  assert.ok(!escaped.includes('<b>'), 'template markup must be escaped');
  assert.ok(escaped.includes('&lt;b&gt;'), 'escaped template markup');
});

// ---------------------------------------------------------------------------
// Wiring — the transaction entry form offers the pre-fill
// ---------------------------------------------------------------------------

test('wiring: defaults offer the oldest open bill as the starting amount', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  const state = stateWith(mixedDuesCustomer());
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF);
  assert.equal(defaults.targetMonth, '2026-09');
  assert.equal(defaults.balanceDue, 1500);
  assert.equal(defaults.suggestedAmount, 1500);
  assert.deepEqual(defaults.prefill, { amount: 1500, month: '2026-09', billAmount: 2500 });
});

test('wiring: a customer with no open bill offers nothing, not the package price', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  const state = stateWith(customerWithBills([
    bill('2026-08', 2500, [payment('2026-08-05', 2500)]),
    bill('2026-09', 2500, [payment('2026-09-07', 2500)]),
  ]));
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF);
  assert.equal(defaults.prefill, null);
  assert.equal(defaults.suggestedAmount, 0);
  assert.equal(defaults.totalDues, 0);
});

test('wiring: hand-written dues still join the offered amount; the pre-fill stays the bill', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  let state = stateWith(customerWithBills([bill('2026-09', 3000)]));
  state = addManualBaqayaEntry(state, 'CUST-1', { amount: 500, date: '2026-09-10', note: 'Last month balance' }, REF);
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF);
  assert.equal(defaults.manualBaqayaPending, 500);
  assert.equal(defaults.payableTotal, 3500);
  assert.equal(defaults.suggestedAmount, 3500);
  assert.deepEqual(defaults.prefill, { amount: 3000, month: '2026-09', billAmount: 3000 });
});

test('wiring: hand-written dues alone still offer their total when no bill is open', async () => {
  const { getCustomerPaymentDefaults } = await import('../nav-quick-collect.js');
  let state = stateWith(customerWithBills([
    bill('2026-10', 3000, [payment('2026-10-05', 3000)]),
  ]));
  state = addManualBaqayaEntry(state, 'CUST-1', { amount: 1500, date: '2026-09-10', note: 'Last month balance' }, REF);
  const defaults = getCustomerPaymentDefaults(state, 'CUST-1', REF);
  assert.equal(defaults.prefill, null);
  assert.equal(defaults.manualBaqayaPending, 1500);
  assert.equal(defaults.payableTotal, 1500);
  assert.equal(defaults.suggestedAmount, 1500);
});

test('wiring: the form imports the module, shows the line, and the amount stays editable', () => {
  assert.ok(quickCollectSrc.includes("from './transaction-prefill.js'"));
  assert.ok(quickCollectSrc.includes('oldestOpenBillPrefill('));
  assert.ok(quickCollectSrc.includes('transactionPrefillLineHtml('));
  assert.ok(quickCollectSrc.includes('quickCollectPrefillLine'));
  assert.ok(quickCollectSrc.includes("t('txp_line')"));
  assert.ok(indexSrc.includes('id="quickCollectPrefillLine"'));
  const amountInput = indexSrc.match(/<input id="quickCollectAmountInput"[^>]*>/);
  assert.ok(amountInput, 'amount input exists');
  assert.ok(!/readonly|disabled/.test(amountInput[0]), 'the offered amount stays editable');
});

// ---------------------------------------------------------------------------
// Purity, fences, and the no-new-store rule
// ---------------------------------------------------------------------------

test('purity: the module reads nothing and stores nothing', () => {
  for (const token of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'shahdara_']) {
    assert.ok(!moduleSrc.includes(token), `module must not contain ${token}`);
  }
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not contain the standalone word OLT');
});

test('fences: the module and its tests never name a fenced file literally', () => {
  // The fenced neighbours are the batch-collect flow and the payments
  // inbox. Their filenames are built from fragments here so the test
  // itself never contains them either. The payment sheet controller
  // is the wiring host, not a fence — it is read and wired, never
  // re-implemented.
  const fenced = [
    ['bulk', '-collect', '.js'],
    ['payments', '-inbox', '.js'],
  ];
  for (const parts of fenced) {
    const name = parts.join('');
    assert.ok(!moduleSrc.includes(name), `module names fenced file ${name}`);
    assert.ok(!testSrc.includes(name), `test names fenced file ${name}`);
  }
});

test('no real customer names or phone numbers in the module or its tests', () => {
  // Pattern-based: an 11-digit Pakistani mobile shape, or a +92 number,
  // must never appear in the module or its tests. (Substring checks
  // would trip on the pattern itself, so the shape is tested by regex.)
  const phoneShape = /(?:\+92|03)\d[\d\s-]{8,}\d/;
  assert.ok(!phoneShape.test(moduleSrc));
  assert.ok(!phoneShape.test(testSrc));
  // The forbidden names are built from fragments so this test itself
  // never contains them literally.
  const forbiddenNames = [
    ['Kir', 'an'],
    ['Hai', 'der'],
    ['Shu', 'naid'],
    ['Kha', 'zer'],
    ['Moh', 'sin'],
    ['Shar', 'jell'],
    ['No', 'mi'],
  ].map((parts) => parts.join(''));
  for (const name of forbiddenNames) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});

// ---------------------------------------------------------------------------
// Styles and language
// ---------------------------------------------------------------------------

test('styles: the pre-fill line rule exists and adds no new hex colour', () => {
  assert.ok(stylesSrc.includes('.txp-prefill-line'), 'styles must define .txp-prefill-line');
  const stripped = stylesSrc.replace(/\.txp-prefill-line[^{]*\{[^}]*\}/g, '');
  const baselineHexes = new Set((stripped.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  const rules = stylesSrc.match(/\.txp-prefill-line[^{]*\{[^}]*\}/g) || [];
  assert.ok(rules.length > 0, 'pre-fill line styles exist');
  for (const rule of rules) {
    for (const hex of rule.match(/#[0-9a-fA-F]{3,8}/g) || []) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('language: both tables carry the pre-fill line label', () => {
  // Count `key:` (with the colon) so a key is not also counted inside
  // a longer key that starts with it.
  assert.equal(langSrc.split('txp_line:').length - 1, 2, 'txp_line must appear once per language table');
});
