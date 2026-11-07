import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_JUMP_TO_RECEIPT_NO_RECEIPT_TEXT,
  HISTORY_JUMP_TO_RECEIPT_BUTTON_TEXT,
  HISTORY_JUMP_TO_RECEIPT_BUTTON_CLASS,
  HISTORY_JUMP_TO_RECEIPT_PAYMENT_TYPES,
  historyJumpToReceiptIsPaymentEntry,
  historyJumpToReceiptShownEntry,
  historyJumpToReceiptNumber,
  historyJumpToReceiptReprintCount,
  historyJumpToReceiptTarget,
  historyJumpToReceiptButtonText,
} from '../history-jump-to-receipt.js';
import {
  fullHistoryEntries,
  fullHistoryListHtml,
} from '../full-history-list.js';
import { historyDisputedFlagListHtml } from '../history-disputed-flag.js';
import { historyAnnotatedListHtml, historyEntryAnnotationKey } from '../history-entry-annotation.js';
import { historyStruckThroughListHtml } from '../history-struck-through.js';

function billsFixture() {
  return [
    {
      id: 'BILL-2026-09', month: '2026-09', dueAmount: 1000,
      payments: [
        { id: 'PAY-SEP-1', amount: 1000, date: '2026-09-06', method: 'Cash' },
      ],
    },
    {
      id: 'BILL-2026-10', month: '2026-10', dueAmount: 3000,
      payments: [
        { id: 'PAY-OCT-1', amount: 3000, date: '2026-10-06', method: 'JazzCash' },
        { id: 'PAY-OCT-2', amount: -500, date: '2026-10-10', method: 'Cash' },
        { id: 'PAY-OCT-3', amount: 1500, date: '2026-10-11', method: 'Cash', kind: 'advance' },
        { id: 'PAY-OCT-4', amount: 200, date: '2026-10-12', method: 'Cash', categoryTag: 'adjustment' },
        { id: 'PAY-OCT-5', amount: 2500, date: '2026-10-13', method: 'Cash', receiptNumber: 'REC-STORED-1' },
        { id: 'PAY-OCT-6', amount: 1200, date: '2026-10-14', method: 'Cash', permanentReceiptNumber: 'REC-KEPT-2' },
        { id: 'PAY-OCT-7', amount: 900, method: 'Cash' },
      ],
    },
  ];
}

function reprintsFixture() {
  return [
    { id: 'RR-1', receiptNumber: 'REC-2610-0036-OCT1', amount: 3000, reprintDate: '2026-10-20' },
    { id: 'RR-2', receiptNumber: 'REC-2610-0036-OCT1', amount: 3000, reprintDate: '2026-10-21' },
    { id: 'RR-3', receiptNumber: 'REC-2610-0036-SEP1', amount: 1000, reprintDate: '2026-09-20' },
  ];
}

function paymentEntry(overrides = {}) {
  return {
    type: 'payment', date: '2026-10-06', month: '2026-10',
    amountCents: 300000, runningBalanceCents: 0, note: '', method: 'JazzCash',
    ref: 'PAY-OCT-1', voided: false, ...overrides,
  };
}

function countPaymentRows(html) {
  return (html.match(/<li class="payment-row"/g) || []).length;
}

// --- Target resolution ---

test('payment entry jumps to exactly its receipt, derived when none is stored', () => {
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry(), billsFixture(), [], 36),
    { month: '2026-10', paymentId: 'PAY-OCT-1', receiptNumber: 'REC-2610-0036-OCT1', reprintCount: 0 },
  );
});

test('September payment jumps to its own receipt, not the October one', () => {
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry({ month: '2026-09', ref: 'PAY-SEP-1' }), billsFixture(), [], 36),
    { month: '2026-09', paymentId: 'PAY-SEP-1', receiptNumber: 'REC-2609-0036-SEP1', reprintCount: 0 },
  );
});

test('advance entry jumps to its receipt', () => {
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry({ type: 'advance', ref: 'PAY-OCT-3' }), billsFixture(), [], 36),
    { month: '2026-10', paymentId: 'PAY-OCT-3', receiptNumber: 'REC-2610-0036-OCT3', reprintCount: 0 },
  );
});

test('adjustment entry jumps to its receipt', () => {
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry({ type: 'adjustment', ref: 'PAY-OCT-4' }), billsFixture(), [], 36),
    { month: '2026-10', paymentId: 'PAY-OCT-4', receiptNumber: 'REC-2610-0036-OCT4', reprintCount: 0 },
  );
});

test('negative-payment refund entry jumps to the receipt of its own payment', () => {
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry({ type: 'refund', ref: 'PAY-OCT-2' }), billsFixture(), [], 36),
    { month: '2026-10', paymentId: 'PAY-OCT-2', receiptNumber: 'REC-2610-0036-OCT2', reprintCount: 0 },
  );
});

test('stored receipt number wins over the derived one', () => {
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry({ ref: 'PAY-OCT-5' }), billsFixture(), [], 36),
    { month: '2026-10', paymentId: 'PAY-OCT-5', receiptNumber: 'REC-STORED-1', reprintCount: 0 },
  );
});

test('permanent receipt number wins when no stored number is recorded', () => {
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry({ ref: 'PAY-OCT-6' }), billsFixture(), [], 36),
    { month: '2026-10', paymentId: 'PAY-OCT-6', receiptNumber: 'REC-KEPT-2', reprintCount: 0 },
  );
});

test('refund-record entry has no receipt: its reference names no payment', () => {
  assert.equal(
    historyJumpToReceiptTarget(paymentEntry({ type: 'refund', month: '', ref: 'REF-1' }), billsFixture(), [], 36),
    null,
  );
});

test('charge entry has no receipt: a charge is the bill itself, not a payment', () => {
  assert.equal(
    historyJumpToReceiptTarget(paymentEntry({ type: 'charge', ref: 'BILL-2026-10' }), billsFixture(), [], 36),
    null,
  );
});

test('credit entry has no receipt: a credit belongs to no bill', () => {
  assert.equal(
    historyJumpToReceiptTarget(paymentEntry({ type: 'credit', ref: 'CR-1' }), billsFixture(), [], 36),
    null,
  );
});

test('entry with no reference has no receipt', () => {
  assert.equal(historyJumpToReceiptTarget(paymentEntry({ ref: '' }), billsFixture(), [], 36), null);
  assert.equal(historyJumpToReceiptTarget(paymentEntry({ ref: '   ' }), billsFixture(), [], 36), null);
});

test('payment id matches exactly: a different case is a different payment', () => {
  assert.equal(
    historyJumpToReceiptTarget(paymentEntry({ ref: 'pay-oct-1' }), billsFixture(), [], 36),
    null,
  );
});

test('reference matches after trimming', () => {
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry({ ref: ' PAY-OCT-1 ' }), billsFixture(), [], 36),
    { month: '2026-10', paymentId: 'PAY-OCT-1', receiptNumber: 'REC-2610-0036-OCT1', reprintCount: 0 },
  );
});

test('non-object entries and missing bills have no receipt', () => {
  assert.equal(historyJumpToReceiptTarget(null, billsFixture(), [], 36), null);
  assert.equal(historyJumpToReceiptTarget('PAY-OCT-1', billsFixture(), [], 36), null);
  assert.equal(historyJumpToReceiptTarget(paymentEntry(), null, [], 36), null);
  assert.equal(historyJumpToReceiptTarget(paymentEntry(), 'not a list', [], 36), null);
  assert.equal(
    historyJumpToReceiptTarget(paymentEntry(), [{ id: 'BILL-2026-10', month: '2026-10' }], [], 36),
    null,
  );
});

test('target carries the reprint count for a receipt already reprinted twice', () => {
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry(), billsFixture(), reprintsFixture(), 36),
    { month: '2026-10', paymentId: 'PAY-OCT-1', receiptNumber: 'REC-2610-0036-OCT1', reprintCount: 2 },
  );
});

test('target carries the reprint count for a stored receipt number too', () => {
  const reprints = [{ id: 'RR-9', receiptNumber: 'REC-STORED-1', amount: 2500, reprintDate: '2026-10-22' }];
  assert.deepEqual(
    historyJumpToReceiptTarget(paymentEntry({ ref: 'PAY-OCT-5' }), billsFixture(), reprints, 36),
    { month: '2026-10', paymentId: 'PAY-OCT-5', receiptNumber: 'REC-STORED-1', reprintCount: 1 },
  );
});

// --- Receipt number derivation ---

test('derived receipt number follows the builder rule: REC-YYMM-CCCC-XXXX', () => {
  assert.equal(
    historyJumpToReceiptNumber({ id: 'PAY-OCT-1', date: '2026-10-06' }, 36, '2026-10'),
    'REC-2610-0036-OCT1',
  );
});

test('derived number uses the bill month when the payment carries no date', () => {
  assert.equal(
    historyJumpToReceiptNumber({ id: 'PAY-OCT-7' }, 36, '2026-10'),
    'REC-2610-0036-OCT7',
  );
});

test('derived number falls back to 2601 when neither date nor month is usable', () => {
  assert.equal(
    historyJumpToReceiptNumber({ id: 'PAY-OCT-7' }, 36, ''),
    'REC-2601-0036-OCT7',
  );
});

test('derived number pads the customer number to four digits', () => {
  assert.equal(
    historyJumpToReceiptNumber({ id: 'PAY-OCT-1', date: '2026-10-06' }, 7, '2026-10'),
    'REC-2610-0007-OCT1',
  );
  assert.equal(
    historyJumpToReceiptNumber({ id: 'PAY-OCT-1', date: '2026-10-06' }, 0, '2026-10'),
    'REC-2610-0000-OCT1',
  );
});

test('derived number keeps only the last four alphanumeric id characters, upper-cased', () => {
  assert.equal(
    historyJumpToReceiptNumber({ id: 'PAY/1', date: '2026-10-06' }, 36, '2026-10'),
    'REC-2610-0036-PAY1',
  );
});

test('derived number uses 1001 when the payment carries no id', () => {
  assert.equal(
    historyJumpToReceiptNumber({ date: '2026-10-06' }, 36, '2026-10'),
    'REC-2610-0036-1001',
  );
});

test('stored number is returned trimmed, and a non-object payment has no number', () => {
  assert.equal(
    historyJumpToReceiptNumber({ id: 'PAY-OCT-5', receiptNumber: '  REC-STORED-1  ' }, 36, '2026-10'),
    'REC-STORED-1',
  );
  assert.equal(historyJumpToReceiptNumber(null, 36, '2026-10'), '');
  assert.equal(historyJumpToReceiptNumber('PAY-OCT-1', 36, '2026-10'), '');
});

// --- Reprint count ---

test('reprint count counts only entries carrying exactly that receipt number', () => {
  assert.equal(historyJumpToReceiptReprintCount(reprintsFixture(), 'REC-2610-0036-OCT1'), 2);
  assert.equal(historyJumpToReceiptReprintCount(reprintsFixture(), 'REC-2610-0036-SEP1'), 1);
  assert.equal(historyJumpToReceiptReprintCount(reprintsFixture(), 'REC-2610-0036-OCT2'), 0);
});

test('reprint count is zero without a number or without a list', () => {
  assert.equal(historyJumpToReceiptReprintCount(reprintsFixture(), ''), 0);
  assert.equal(historyJumpToReceiptReprintCount(reprintsFixture(), '   '), 0);
  assert.equal(historyJumpToReceiptReprintCount(null, 'REC-2610-0036-OCT1'), 0);
  assert.equal(historyJumpToReceiptReprintCount('not a list', 'REC-2610-0036-OCT1'), 0);
  assert.equal(historyJumpToReceiptReprintCount([null, 'nope', { receiptNumber: '' }], 'REC-2610-0036-OCT1'), 0);
});

// --- Payment-line detection ---

test('payment, advance, adjustment and refund entries are payment lines', () => {
  for (const type of ['payment', 'advance', 'adjustment', 'refund']) {
    assert.equal(historyJumpToReceiptIsPaymentEntry({ type }), true, type);
  }
});

test('charge and credit entries are not payment lines', () => {
  assert.equal(historyJumpToReceiptIsPaymentEntry({ type: 'charge' }), false);
  assert.equal(historyJumpToReceiptIsPaymentEntry({ type: 'credit' }), false);
  assert.equal(historyJumpToReceiptIsPaymentEntry({}), false);
  assert.equal(historyJumpToReceiptIsPaymentEntry({ type: '' }), false);
  assert.equal(historyJumpToReceiptIsPaymentEntry(null), false);
  assert.equal(historyJumpToReceiptIsPaymentEntry('payment'), false);
});

test('payment-line type check ignores case', () => {
  assert.equal(historyJumpToReceiptIsPaymentEntry({ type: 'Payment' }), true);
});

test('payment types list is exactly the four bill-payment types', () => {
  assert.deepEqual(
    [...HISTORY_JUMP_TO_RECEIPT_PAYMENT_TYPES].sort(),
    ['adjustment', 'advance', 'payment', 'refund'],
  );
});

// --- Shown entry behind a row ---

test('shown entry lookup follows the row position', () => {
  const shown = [paymentEntry(), paymentEntry({ ref: 'PAY-SEP-1' })];
  assert.deepEqual(historyJumpToReceiptShownEntry(shown, 0), shown[0]);
  assert.deepEqual(historyJumpToReceiptShownEntry(shown, 1), shown[1]);
});

test('shown entry lookup outside the list yields no entry', () => {
  const shown = [paymentEntry()];
  assert.equal(historyJumpToReceiptShownEntry(shown, -1), null);
  assert.equal(historyJumpToReceiptShownEntry(shown, 1), null);
  assert.equal(historyJumpToReceiptShownEntry(shown, 1.5), null);
  assert.equal(historyJumpToReceiptShownEntry(shown, '0'), null);
  assert.equal(historyJumpToReceiptShownEntry(null, 0), null);
  assert.equal(historyJumpToReceiptShownEntry('not a list', 0), null);
  assert.equal(historyJumpToReceiptShownEntry([null], 0), null);
});

// --- Button text and plain words ---

test('no-receipt text says plainly that the payment has no receipt to open', () => {
  assert.equal(HISTORY_JUMP_TO_RECEIPT_NO_RECEIPT_TEXT, 'This payment has no receipt to open.');
});

test('button label is Receipt, and the button class is the hjr class', () => {
  assert.equal(HISTORY_JUMP_TO_RECEIPT_BUTTON_TEXT, 'Receipt');
  assert.equal(HISTORY_JUMP_TO_RECEIPT_BUTTON_CLASS, 'hjr-receipt-button');
});

test('button label carries the reprint mark and count where reprints apply', () => {
  assert.equal(historyJumpToReceiptButtonText({ reprintCount: 0 }), 'Receipt');
  assert.equal(historyJumpToReceiptButtonText({ reprintCount: 1 }), 'Receipt · REPRINT ×1');
  assert.equal(historyJumpToReceiptButtonText({ reprintCount: 2 }), 'Receipt · REPRINT ×2');
  assert.equal(historyJumpToReceiptButtonText(null), 'Receipt');
  assert.equal(historyJumpToReceiptButtonText({}), 'Receipt');
  assert.equal(historyJumpToReceiptButtonText({ reprintCount: -1 }), 'Receipt');
  assert.equal(historyJumpToReceiptButtonText({ reprintCount: 'twice' }), 'Receipt');
});

// --- Acceptance through the real history entries ---

test('acceptance: a payment from the composed history opens exactly its receipt', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: billsFixture(),
    creditEntries: [],
    refundRecords: [{ id: 'REF-1', customerId: 'CUST-1', amountCents: 500, refundDate: '2026-10-15', reason: 'Overcharged', method: 'Cash' }],
  });
  const octoberPayment = entries.find((entry) => entry.ref === 'PAY-OCT-1');
  assert.ok(octoberPayment);
  assert.equal(octoberPayment.type, 'payment');
  assert.deepEqual(
    historyJumpToReceiptTarget(octoberPayment, billsFixture(), reprintsFixture(), 36),
    { month: '2026-10', paymentId: 'PAY-OCT-1', receiptNumber: 'REC-2610-0036-OCT1', reprintCount: 2 },
  );
  const octoberCharge = entries.find((entry) => entry.type === 'charge' && entry.month === '2026-10');
  assert.ok(octoberCharge);
  assert.equal(historyJumpToReceiptTarget(octoberCharge, billsFixture(), [], 36), null);
  const refundRecord = entries.find((entry) => entry.ref === 'REF-1');
  assert.ok(refundRecord);
  assert.equal(refundRecord.type, 'refund');
  assert.equal(historyJumpToReceiptTarget(refundRecord, billsFixture(), [], 36), null);
});

// --- Row mapping: one row per shown entry, in order, in every list view ---

test('plain list renders one row per shown entry', () => {
  const shown = [
    paymentEntry(),
    paymentEntry({ type: 'charge', ref: 'BILL-2026-10', method: '' }),
    paymentEntry({ ref: 'PAY-OCT-3', type: 'advance' }),
  ];
  assert.equal(countPaymentRows(fullHistoryListHtml(shown)), shown.length);
});

test('disputed-flag list renders one row per shown entry', () => {
  const shown = [
    paymentEntry(),
    { ...paymentEntry({ ref: 'PAY-OCT-3', type: 'advance' }), disputedCaseRef: 'CASE-1' },
  ];
  assert.equal(countPaymentRows(historyDisputedFlagListHtml(shown)), shown.length);
});

test('annotated list renders one row per shown entry', () => {
  const shown = [paymentEntry(), paymentEntry({ ref: 'PAY-OCT-3', type: 'advance' })];
  const annotations = [{
    id: 'hea-1', customerId: 'CUST-1',
    entryKey: historyEntryAnnotationKey(shown[0]),
    text: 'Operator note', date: '2026-10-07', by: 'Operator',
  }];
  assert.equal(countPaymentRows(historyAnnotatedListHtml(shown, annotations, 'CUST-1')), shown.length);
});

test('struck-through list renders one row per shown entry', () => {
  const shown = [
    paymentEntry(),
    { ...paymentEntry({ ref: 'PAY-OCT-2', type: 'refund' }), voided: true },
  ];
  const payments = [
    { id: 'PAY-OCT-1', amount: 3000, date: '2026-10-06', method: 'JazzCash' },
    {
      id: 'PAY-OCT-2', amount: -500, date: '2026-10-10', method: 'Cash',
      voided: true, voidReason: 'duplicate receipt', voidedAt: '2026-10-11T10:00:00.000Z',
    },
  ];
  assert.equal(
    countPaymentRows(historyStruckThroughListHtml(shown, payments, [], 'CUST-1')),
    shown.length,
  );
});

// --- Purity: the module navigates only — no clock, storage, page, or network ---

test('module is pure: no clock, storage, page, network, or imports', () => {
  const source = readFileSync(new URL('../history-jump-to-receipt.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('new Date('), 'no new Date(');
  assert.ok(!source.includes('Date.now('), 'no Date.now(');
  assert.ok(!source.includes('localStorage'), 'no localStorage');
  assert.ok(!source.includes('document'), 'no document');
  assert.ok(!source.includes('fetch('), 'no fetch(');
  assert.ok(!source.includes('window.'), 'no window.');
  assert.ok(!source.includes('import '), 'no imports');
  assert.ok(!source.includes('shahdara_'), 'no store key: the jump is derived, not stored');
});

test('module header names no fenced module file literally', () => {
  const source = readFileSync(new URL('../history-jump-to-receipt.js', import.meta.url), 'utf8');
  const fenced = [
    'full' + '-history-list',
    'history' + '-type-filter',
    'history' + '-date-range-filter',
    'history' + '-method-filter',
    'history' + '-amount-search',
    'history' + '-running-balance',
    'history' + '-monthly-grouping',
    'history' + '-yearly-summary',
    'history' + '-csv-export',
    'history' + '-printed-statement',
    'history' + '-gap-view',
    'history' + '-largest-payment',
    'history' + '-first-dates',
    'history' + '-disputed-flag',
    'history' + '-refunds-inline',
    'history' + '-credit-inline',
    'history' + '-adjustments-inline',
    'history' + '-month-comparison',
    'history' + '-connection-filter',
    'history' + '-entry-annotation',
    'history' + '-struck-through',
    'history' + '-jump-to-bill',
    'receipt' + '-reprints',
    'receipt' + '-number-search',
  ].map((name) => `${name}.js`);
  for (const name of fenced) {
    assert.ok(!source.includes(name), `header must not name ${name}`);
  }
});

// --- Wiring in app.js ---

test('wiring: app.js imports the jump module and opens the receipt from the history render', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './history-jump-to-receipt.js'"), 'imports the module');
  assert.ok(app.includes('historyJumpToReceiptTarget'), 'resolves the target');
  assert.ok(app.includes('historyJumpToReceiptShownEntry'), 'maps the tapped row to its entry');
  assert.ok(app.includes('historyJumpToReceiptIsPaymentEntry'), 'only payment lines get a button');
  assert.ok(app.includes('HISTORY_JUMP_TO_RECEIPT_NO_RECEIPT_TEXT'), 'says plainly when there is no receipt');
  assert.ok(app.includes('HISTORY_JUMP_TO_RECEIPT_BUTTON_CLASS'), 'button carries the hjr class');
  assert.ok(app.includes('historyJumpToReceiptButtonText'), 'button carries the reprint mark and count');
  assert.ok(app.includes('printPaymentReceipt(customer.id, target.month, target.paymentId)'), 'opens exactly that receipt');
  assert.ok(app.includes('loadReceiptReprints()'), 'reads the recorded reprints for the count');
  assert.ok(app.includes('row.appendChild(button)'), 'button sits on the payment line');
});

test('wiring: the jump changes nothing — no record is written from the tap', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('// Plan 423');
  const end = app.indexOf('// Plan 406', start);
  assert.ok(start !== -1 && end !== -1 && end > start, 'Plan 423 wiring block found');
  const block = app.slice(start, end);
  assert.ok(block.includes('toast(HISTORY_JUMP_TO_RECEIPT_NO_RECEIPT_TEXT)'), 'plain no-receipt message');
  for (const forbidden of ['addPayment', 'correctPayment', 'updateCustomer', 'saveHistory', 'recordHistory', 'removeHistory', 'localStorage', 'saveReceiptReprints', 'addReceiptReprint', 'window.print']) {
    assert.ok(!block.includes(forbidden), `jump wiring must not contain ${forbidden}`);
  }
});

// --- Styles: the Receipt button, with no new hex colour ---

test('styles: the Receipt button rule exists on history payment lines', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(styles.includes('#fhlFullHistoryList .hjr-receipt-button'), 'button rule exists');
});

test('styles: the Plan 423 rules introduce no new hex colour', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const start = styles.indexOf('/* Plan 423');
  assert.ok(start !== -1, 'Plan 423 styles block found');
  const end = styles.indexOf('}', styles.indexOf('.hjr-receipt-button', start)) + 1;
  const block = styles.slice(start, end);
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), 'no hard-coded hex in the new rules');
  const hexes = (text) => new Set(text.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  const stripped = styles.slice(0, start) + styles.slice(end);
  assert.deepEqual([...hexes(styles)].sort(), [...hexes(stripped)].sort());
});
