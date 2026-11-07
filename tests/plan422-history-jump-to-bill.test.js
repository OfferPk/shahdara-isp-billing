import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_JUMP_TO_BILL_NO_BILL_TEXT,
  HISTORY_JUMP_TO_BILL_HIGHLIGHT_CLASS,
  HISTORY_JUMP_TO_BILL_PAYMENT_TYPES,
  isStrictHistoryJumpMonth,
  historyJumpToBillIsPaymentEntry,
  historyJumpToBillTarget,
  historyJumpToBillShownEntry,
} from '../history-jump-to-bill.js';
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
      ],
    },
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

test('payment entry jumps to exactly the bill carrying that payment', () => {
  assert.deepEqual(
    historyJumpToBillTarget(paymentEntry(), billsFixture()),
    { month: '2026-10', paymentId: 'PAY-OCT-1' },
  );
});

test('September payment jumps to the September bill, not the October one', () => {
  assert.deepEqual(
    historyJumpToBillTarget(paymentEntry({ month: '2026-09', ref: 'PAY-SEP-1' }), billsFixture()),
    { month: '2026-09', paymentId: 'PAY-SEP-1' },
  );
});

test('advance entry jumps to its bill', () => {
  assert.deepEqual(
    historyJumpToBillTarget(paymentEntry({ type: 'advance', ref: 'PAY-OCT-3' }), billsFixture()),
    { month: '2026-10', paymentId: 'PAY-OCT-3' },
  );
});

test('adjustment entry jumps to its bill', () => {
  assert.deepEqual(
    historyJumpToBillTarget(paymentEntry({ type: 'adjustment', ref: 'PAY-OCT-4' }), billsFixture()),
    { month: '2026-10', paymentId: 'PAY-OCT-4' },
  );
});

test('negative-payment refund entry jumps to the bill its payment sits on', () => {
  assert.deepEqual(
    historyJumpToBillTarget(paymentEntry({ type: 'refund', ref: 'PAY-OCT-2' }), billsFixture()),
    { month: '2026-10', paymentId: 'PAY-OCT-2' },
  );
});

test('charge entry never jumps: a charge is the bill itself, not a payment', () => {
  assert.equal(
    historyJumpToBillTarget(paymentEntry({ type: 'charge', ref: 'BILL-2026-10' }), billsFixture()),
    null,
  );
});

test('credit entry never jumps: a credit belongs to no bill', () => {
  assert.equal(
    historyJumpToBillTarget(paymentEntry({ type: 'credit', ref: 'CR-1' }), billsFixture()),
    null,
  );
});

test('refund-record entry never jumps: it carries no bill month', () => {
  assert.equal(
    historyJumpToBillTarget(paymentEntry({ type: 'refund', month: '', ref: 'REF-1' }), billsFixture()),
    null,
  );
});

test('payment whose month names no bill has no single bill to open', () => {
  assert.equal(
    historyJumpToBillTarget(paymentEntry({ month: '2026-08', ref: 'PAY-OCT-1' }), billsFixture()),
    null,
  );
});

test('payment whose month names two bills has no single bill to open', () => {
  const bills = [...billsFixture(), { id: 'BILL-2026-10-B', month: '2026-10', payments: [] }];
  assert.equal(historyJumpToBillTarget(paymentEntry(), bills), null);
});

test('payment whose bill carries no payment with that reference has no target', () => {
  assert.equal(
    historyJumpToBillTarget(paymentEntry({ ref: 'PAY-NOPE' }), billsFixture()),
    null,
  );
});

test('entry with no reference has no target', () => {
  assert.equal(historyJumpToBillTarget(paymentEntry({ ref: '' }), billsFixture()), null);
  assert.equal(historyJumpToBillTarget(paymentEntry({ ref: '   ' }), billsFixture()), null);
});

test('reference and month match after trimming', () => {
  assert.deepEqual(
    historyJumpToBillTarget(paymentEntry({ month: ' 2026-10 ', ref: ' PAY-OCT-1 ' }), billsFixture()),
    { month: '2026-10', paymentId: 'PAY-OCT-1' },
  );
});

test('payment id matches exactly: a different case is a different payment', () => {
  assert.equal(
    historyJumpToBillTarget(paymentEntry({ ref: 'pay-oct-1' }), billsFixture()),
    null,
  );
});

test('non-object entries and missing bills never jump', () => {
  assert.equal(historyJumpToBillTarget(null, billsFixture()), null);
  assert.equal(historyJumpToBillTarget('PAY-OCT-1', billsFixture()), null);
  assert.equal(historyJumpToBillTarget(paymentEntry(), null), null);
  assert.equal(historyJumpToBillTarget(paymentEntry(), 'not a list'), null);
  assert.equal(
    historyJumpToBillTarget(paymentEntry(), [{ id: 'BILL-2026-10', month: '2026-10' }]),
    null,
  );
});

test('strict month: year-month only, month 01-12', () => {
  assert.equal(isStrictHistoryJumpMonth('2026-10'), true);
  assert.equal(isStrictHistoryJumpMonth('2026-01'), true);
  assert.equal(isStrictHistoryJumpMonth('2026-12'), true);
  assert.equal(isStrictHistoryJumpMonth(' 2026-10 '), true);
  assert.equal(isStrictHistoryJumpMonth('2026-13'), false);
  assert.equal(isStrictHistoryJumpMonth('2026-00'), false);
  assert.equal(isStrictHistoryJumpMonth('2026-6'), false);
  assert.equal(isStrictHistoryJumpMonth('2026/10'), false);
  assert.equal(isStrictHistoryJumpMonth('Oct 2026'), false);
  assert.equal(isStrictHistoryJumpMonth(''), false);
  assert.equal(isStrictHistoryJumpMonth(null), false);
  assert.equal(isStrictHistoryJumpMonth(202610), false);
});

test('non-strict month entries never jump', () => {
  assert.equal(historyJumpToBillTarget(paymentEntry({ month: '2026-13' }), billsFixture()), null);
  assert.equal(historyJumpToBillTarget(paymentEntry({ month: 'Oct 2026' }), billsFixture()), null);
  assert.equal(historyJumpToBillTarget(paymentEntry({ month: '' }), billsFixture()), null);
});

// --- Payment-line detection ---

test('payment, advance, adjustment and refund entries are payment lines', () => {
  for (const type of ['payment', 'advance', 'adjustment', 'refund']) {
    assert.equal(historyJumpToBillIsPaymentEntry({ type }), true, type);
  }
});

test('charge and credit entries are not payment lines', () => {
  assert.equal(historyJumpToBillIsPaymentEntry({ type: 'charge' }), false);
  assert.equal(historyJumpToBillIsPaymentEntry({ type: 'credit' }), false);
  assert.equal(historyJumpToBillIsPaymentEntry({}), false);
  assert.equal(historyJumpToBillIsPaymentEntry({ type: '' }), false);
  assert.equal(historyJumpToBillIsPaymentEntry(null), false);
  assert.equal(historyJumpToBillIsPaymentEntry('payment'), false);
});

test('payment-line type check ignores case', () => {
  assert.equal(historyJumpToBillIsPaymentEntry({ type: 'Payment' }), true);
});

test('payment types list is exactly the four bill-payment types', () => {
  assert.deepEqual(
    [...HISTORY_JUMP_TO_BILL_PAYMENT_TYPES].sort(),
    ['adjustment', 'advance', 'payment', 'refund'],
  );
});

// --- Shown entry behind a row ---

test('shown entry lookup follows the row position', () => {
  const shown = [paymentEntry(), paymentEntry({ ref: 'PAY-SEP-1' })];
  assert.deepEqual(historyJumpToBillShownEntry(shown, 0), shown[0]);
  assert.deepEqual(historyJumpToBillShownEntry(shown, 1), shown[1]);
});

test('shown entry lookup outside the list yields no entry', () => {
  const shown = [paymentEntry()];
  assert.equal(historyJumpToBillShownEntry(shown, -1), null);
  assert.equal(historyJumpToBillShownEntry(shown, 1), null);
  assert.equal(historyJumpToBillShownEntry(shown, 1.5), null);
  assert.equal(historyJumpToBillShownEntry(shown, '0'), null);
  assert.equal(historyJumpToBillShownEntry(null, 0), null);
  assert.equal(historyJumpToBillShownEntry('not a list', 0), null);
  assert.equal(historyJumpToBillShownEntry([null], 0), null);
});

// --- Plain words and highlight ---

test('no-bill text says plainly that the payment settles no single bill', () => {
  assert.equal(HISTORY_JUMP_TO_BILL_NO_BILL_TEXT, 'This payment settles no single bill.');
});

test('highlight class is the hjb class', () => {
  assert.equal(HISTORY_JUMP_TO_BILL_HIGHLIGHT_CLASS, 'hjb-highlight');
});

// --- Acceptance through the real history entries ---

test('acceptance: a payment from the composed history jumps to exactly its bill', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: billsFixture(),
    creditEntries: [],
    refundRecords: [],
  });
  const octoberPayment = entries.find((entry) => entry.ref === 'PAY-OCT-1');
  assert.ok(octoberPayment);
  assert.equal(octoberPayment.type, 'payment');
  assert.deepEqual(
    historyJumpToBillTarget(octoberPayment, billsFixture()),
    { month: '2026-10', paymentId: 'PAY-OCT-1' },
  );
  const octoberCharge = entries.find((entry) => entry.type === 'charge' && entry.month === '2026-10');
  assert.ok(octoberCharge);
  assert.equal(historyJumpToBillTarget(octoberCharge, billsFixture()), null);
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
  const source = readFileSync(new URL('../history-jump-to-bill.js', import.meta.url), 'utf8');
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
  const source = readFileSync(new URL('../history-jump-to-bill.js', import.meta.url), 'utf8');
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
  ].map((name) => `${name}.js`);
  for (const name of fenced) {
    assert.ok(!source.includes(name), `header must not name ${name}`);
  }
});

// --- Wiring in app.js ---

test('wiring: app.js imports the jump module and resolves the target in the history render', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './history-jump-to-bill.js'"), 'imports the module');
  assert.ok(app.includes('historyJumpToBillTarget'), 'resolves the target');
  assert.ok(app.includes('historyJumpToBillShownEntry'), 'maps the tapped row to its entry');
  assert.ok(app.includes('historyJumpToBillIsPaymentEntry'), 'only payment lines jump');
  assert.ok(app.includes('HISTORY_JUMP_TO_BILL_NO_BILL_TEXT'), 'says plainly when there is no single bill');
  assert.ok(app.includes('HISTORY_JUMP_TO_BILL_HIGHLIGHT_CLASS'), 'highlights the payment on its bill');
  assert.ok(app.includes('details.month-card[data-month-card="'), 'opens the bill month card');
  assert.ok(app.includes('scrollIntoView'), 'scrolls the payment into view');
  assert.ok(app.includes('card.open = true'), 'opens the closed month card');
});

test('wiring: the jump changes nothing — no record is written from the tap', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('// Plan 422');
  const end = app.indexOf('// Plan 406', start);
  assert.ok(start !== -1 && end !== -1 && end > start, 'Plan 422 wiring block found');
  const block = app.slice(start, end);
  assert.ok(block.includes("toast(HISTORY_JUMP_TO_BILL_NO_BILL_TEXT)"), 'plain no-bill message');
  for (const forbidden of ['addPayment', 'correctPayment', 'updateCustomer', 'saveHistory', 'recordHistory', 'removeHistory', 'localStorage']) {
    assert.ok(!block.includes(forbidden), `jump wiring must not contain ${forbidden}`);
  }
});

// --- Styles: tappable rows and the highlight, with no new hex colour ---

test('styles: history rows look tappable and the landed payment is highlighted', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(styles.includes('#fhlFullHistoryList .payment-row'), 'history rows carry the pointer');
  assert.ok(styles.includes('.payment-row.hjb-highlight'), 'highlight rule exists');
  assert.ok(styles.includes('background: var(--amber-bg)'), 'highlight reuses the amber background token');
});

test('styles: the Plan 422 rules introduce no new hex colour', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const start = styles.indexOf('/* Plan 422');
  assert.ok(start !== -1, 'Plan 422 styles block found');
  const end = styles.indexOf('}', styles.indexOf('.payment-row.hjb-highlight', start)) + 1;
  const block = styles.slice(start, end);
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), 'no hard-coded hex in the new rules');
  const hexes = (text) => new Set(text.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  const stripped = styles.slice(0, start) + styles.slice(end);
  assert.deepEqual([...hexes(styles)].sort(), [...hexes(stripped)].sort());
});
