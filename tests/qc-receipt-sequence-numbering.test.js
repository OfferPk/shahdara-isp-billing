// QC receipt numbering — one global sequential receipt number (1, 2, 3, ...).
// Every payment recorded through addPayment gets the next number of the
// single counter, across all customers and all months. The number is a NEW
// field, receiptSequence, on the payment — the stored RCPT-/REC- numbers
// are untouched, VER still derives from REC- only, and the gap audit /
// receipt-book filter never see the sequence (a plain integer in
// payment.receiptNumber would be misattributed to a collector's book
// and would invent gaps in the audit's plain run).
// Generic fixtures only — no real customer data. No parity literals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addPayment, correctPayment, createInitialState } from '../core.js';
import {
  RECEIPT_SEQUENCE_KEY,
  allReceiptSequences,
  backfillReceiptSequences,
  computeReceiptSequenceSeed,
  ensureReceiptSequences,
  maxReceiptSequence,
  nextReceiptSequence,
  readReceiptSequenceCounter,
  writeReceiptSequenceCounter,
} from '../receipt-sequence.js';
import { receiptCodeForReceipt } from '../receipt-verifier.js';
import { receiptShareDraftFor, receiptShareDraftLineText } from '../receipt-share-draft.js';
import { findTransactionByReceiptNumber } from '../receipt-number-search.js';

const REF = new Date('2026-10-29T12:00:00Z');
const FIELDS = { date: '2026-10-05', amount: '3000', method: 'Cash' };
const MONTH = '2026-10';

function store() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}
function stateWithSeqs(seqs) {
  return { customers: [{ bills: [{ payments: seqs.map((s) => ({ receiptSequence: s })) }] }] };
}
function paymentsOf(state) {
  return state.customers[0].bills.find((b) => b.month === MONTH).payments;
}

test('counter: empty state issues 1, highest assigned + 1 otherwise', () => {
  assert.equal(nextReceiptSequence({ customers: [] }), 1);
  assert.equal(nextReceiptSequence(stateWithSeqs([1, 2, 5])), 6);
  assert.equal(nextReceiptSequence({ receiptSequenceNext: 4, customers: [] }), 4);
});

test('counter: the stored key holds the NEXT number to issue (ticket pattern)', () => {
  const storage = store();
  storage.setItem(RECEIPT_SEQUENCE_KEY, '10');
  assert.equal(nextReceiptSequence(stateWithSeqs([1, 2, 5]), storage), 10);
  // A stale key loses to the list floor — never re-issues.
  assert.equal(nextReceiptSequence(stateWithSeqs([1, 2, 12]), storage), 13);
});

test('counter: writes never rewind; corrupt values read as absent', () => {
  const storage = store();
  assert.equal(writeReceiptSequenceCounter(storage, 5), 5);
  assert.equal(writeReceiptSequenceCounter(storage, 3), 5);
  assert.equal(readReceiptSequenceCounter(storage), 5);
  storage.setItem(RECEIPT_SEQUENCE_KEY, 'not-a-number');
  assert.equal(readReceiptSequenceCounter(storage), null);
  assert.equal(nextReceiptSequence(stateWithSeqs([1, 2]), storage), 3);
});

test('addPayment stamps 1, 2, 3 in order and ignores a caller-passed sequence', () => {
  let state = createInitialState(['Test Customer']);
  state = addPayment(state, 'seed-001', MONTH, FIELDS, REF);
  state = addPayment(state, 'seed-001', MONTH, { ...FIELDS, date: '2026-10-06' }, REF);
  state = addPayment(state, 'seed-001', MONTH, { ...FIELDS, date: '2026-10-07', receiptSequence: 999 }, REF);
  assert.deepEqual(paymentsOf(state).map((p) => p.receiptSequence), [1, 2, 3]);
  assert.equal(state.receiptSequenceNext, 4);
});

test('correction keeps the original sequence and burns no number', () => {
  let state = createInitialState(['Test Customer']);
  state = addPayment(state, 'seed-001', MONTH, FIELDS, REF);
  const paymentId = paymentsOf(state)[0].id;
  state = correctPayment(state, 'seed-001', MONTH, paymentId, { date: '2026-10-05', amount: '2500', method: 'Cash' }, REF);
  assert.equal(paymentsOf(state)[0].receiptSequence, 1);
  state = addPayment(state, 'seed-001', MONTH, { ...FIELDS, date: '2026-10-08' }, REF);
  assert.deepEqual(paymentsOf(state).map((p) => p.receiptSequence), [1, 2]);
});

test('backfill assigns 1..N in (date, ledger) order, dateless last, idempotent', () => {
  const state = {
    customers: [
      { bills: [{ month: '2026-11', payments: [
        { id: 'p-late', date: '2026-11-09', amount: 1000 },
        { id: 'p-early', date: '2026-11-02', amount: 1000 },
        { id: 'p-nodate', amount: 1000 },
      ] }] },
      { bills: [{ month: '2026-10', payments: [{ id: 'p-oct', date: '2026-10-20', amount: 1000 }] }] },
    ],
  };
  assert.equal(backfillReceiptSequences(state), 4);
  const byId = {};
  for (const customer of state.customers) {
    for (const bill of customer.bills) {
      for (const payment of bill.payments) byId[payment.id] = payment.receiptSequence;
    }
  }
  assert.deepEqual(byId, { 'p-oct': 1, 'p-early': 2, 'p-late': 3, 'p-nodate': 4 });
  assert.equal(state.receiptSequenceNext, 5);
  assert.equal(backfillReceiptSequences(state), 0);
});

test('backfill never rewrites stored receipt numbers', () => {
  const state = {
    customers: [{ bills: [{ month: '2026-11', payments: [
      { id: 'p1', date: '2026-11-02', amount: 1000, receiptNumber: 'RCPT-41-202611-01', permanentReceiptNumber: 'REC-2611-0041-ABCD' },
    ] }] }],
  };
  backfillReceiptSequences(state);
  const payment = state.customers[0].bills[0].payments[0];
  assert.equal(payment.receiptSequence, 1);
  assert.equal(payment.receiptNumber, 'RCPT-41-202611-01');
  assert.equal(payment.permanentReceiptNumber, 'REC-2611-0041-ABCD');
});

test('ensureReceiptSequences hydrates the state field and the key mirror', () => {
  const storage = store();
  const state = { customers: [{ bills: [{ month: '2026-11', payments: [{ id: 'p1', date: '2026-11-02', amount: 1000 }] }] }] };
  ensureReceiptSequences(state, storage);
  assert.equal(state.customers[0].bills[0].payments[0].receiptSequence, 1);
  assert.equal(state.receiptSequenceNext, 2);
  assert.equal(readReceiptSequenceCounter(storage), 2);
  assert.equal(computeReceiptSequenceSeed(state), 2);
  assert.deepEqual(allReceiptSequences(state), [1]);
  assert.equal(maxReceiptSequence(state), 1);
});

test('VER code is identical with and without a sequence on the receipt', () => {
  const base = { receiptNumber: 'REC-2611-0001-ABCD', customerId: 'c1', paidAmount: 3000, paymentDate: '2026-11-07' };
  const code = receiptCodeForReceipt(base);
  assert.notEqual(code, '');
  assert.equal(receiptCodeForReceipt({ ...base, receiptSequence: 7 }), code);
});

test('WhatsApp draft carries the sequence when present, stored number otherwise', () => {
  const base = {
    id: 'rcpt-1', receiptNumber: 'RCPT-41-202611-01', customerName: 'Customer One',
    customerNumber: 41, amount: 3000, method: 'Cash', date: '2026-11-07', month: '2026-11', phone: '03012345678',
  };
  const shareText = 'PAYMENT RECEIPT\nReceipt No: RCPT-41-202611-01';
  const withSeq = receiptShareDraftFor({ ...base, receiptSequence: 1 }, shareText);
  assert.equal(withSeq.receiptNumber, '1');
  assert.ok(receiptShareDraftLineText(withSeq).includes('Receipt 1'));
  const withoutSeq = receiptShareDraftFor(base, shareText);
  assert.equal(withoutSeq.receiptNumber, 'RCPT-41-202611-01');
  const split = receiptShareDraftFor({
    ...base, id: 'rcpt-2', amount: 5000,
    splitTender: {
      legs: [
      { leg: 1, method: 'Cash', amount: 2000, receiptSequence: 2, date: '2026-11-07', month: '2026-11' },
      { leg: 2, method: 'Easypaisa', amount: 3000, receiptSequence: 3, date: '2026-11-07', month: '2026-11' },
    ],
      totalReceivedCents: 500000,
      totalReceived: 5000,
      date: '2026-11-07',
      month: '2026-11',
    },
  }, shareText);
  assert.deepEqual(split.receiptNumbers, ['2', '3']);
});

test('finder matches a typed sequence, and the sequence wins over a stored book integer', () => {
  const rows = [
    { id: 'a', receiptNumber: '1', receiptSequence: null },
    { id: 'b', receiptNumber: 'RCPT-41-202611-01', receiptSequence: 1 },
    { id: 'c', receiptNumber: 'RCPT-41-202611-02', receiptSequence: 2 },
  ];
  assert.equal(findTransactionByReceiptNumber(rows, '1').id, 'b');
  assert.equal(findTransactionByReceiptNumber(rows, '2').id, 'c');
  assert.equal(findTransactionByReceiptNumber(rows, 'RCPT-41-202611-01').id, 'b');
  assert.equal(findTransactionByReceiptNumber(rows, '9'), null);
});

test('card shows the sequence as an Amount-Collected-style pill row; the header ref chip is gone', () => {
  const qcSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qcSrc.includes('qc-receipt-amount-row qc-amount-pill qc-receipt-number-row'), 'pill row reuses the Amount Collected classes');
  assert.ok(qcSrc.includes('<span class="qc-receipt-label">Receipt No.</span>'), 'pill row labels the number');
  assert.ok(!qcSrc.includes('data-full-receipt-number'), 'no header ref chip left');
  assert.ok(!qcSrc.includes('nextReceiptNumberFor'), 'the RCPT preview has no production caller left');
});

test('gap audit and receipt-book filter never read the sequence', () => {
  const gapSrc = readFileSync(new URL('../receipt-gap-audit.js', import.meta.url), 'utf8');
  const bookSrc = readFileSync(new URL('../ledger-receipt-book.js', import.meta.url), 'utf8');
  assert.ok(!gapSrc.includes('receiptSequence'));
  assert.ok(!bookSrc.includes('receiptSequence'));
});
