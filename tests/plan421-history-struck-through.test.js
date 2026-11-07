import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  historyStruckThroughOf,
  historyShownHasStruckThrough,
  historyStruckThroughListHtml,
  struckReversalLinkOf,
  struckReversalEntryOf,
  struckReversalLineText,
  struckReceiptRef,
  struckCorrectionTextOf,
  formatHistoryStruckThroughAmount,
  historyStruckThroughRunningNote,
  isStrictHistoryStruckThroughDate,
} from '../history-struck-through.js';
import {
  fullHistoryEntries,
  fullHistoryListHtml,
} from '../full-history-list.js';
import { historyDisputedFlagListHtml } from '../history-disputed-flag.js';
import { historyAnnotatedListHtml } from '../history-entry-annotation.js';

function plainEntriesFixture() {
  return [
    { type: 'charge', date: '2026-09-05', month: '2026-09', amountCents: 100000, runningBalanceCents: 100000, note: '', method: '', ref: 'BILL-1', voided: false },
    { type: 'payment', date: '2026-09-06', month: '2026-09', amountCents: 100000, runningBalanceCents: 0, note: '', method: 'Cash', ref: 'PAY-1', voided: false },
    { type: 'charge', date: '2026-10-05', month: '2026-10', amountCents: 150000, runningBalanceCents: 150000, note: '', method: '', ref: 'BILL-2', voided: false },
    { type: 'payment', date: '2026-10-06', month: '2026-10', amountCents: 150000, runningBalanceCents: 0, note: '', method: 'JazzCash', ref: 'PAY-2', voided: false },
  ];
}

function entriesFixture() {
  return [
    ...plainEntriesFixture(),
    { type: 'payment', date: '2026-10-07', month: '2026-10', amountCents: 50000, runningBalanceCents: 0, note: '', method: 'Cash', ref: 'PAY-3', voided: true },
  ];
}

function flaggedEntriesFixture() {
  return plainEntriesFixture().map((entry) => (entry.ref === 'PAY-2'
    ? { ...entry, disputedCaseRef: 'CASE-1' }
    : entry));
}

function paymentsFixture() {
  return [
    { id: 'PAY-1', amount: 1000, date: '2026-09-06', method: 'Cash' },
    {
      id: 'PAY-2', amount: 1500, date: '2026-10-06', method: 'JazzCash',
      correctionHistory: [{ previousAmount: 2000, previousDate: '2026-10-06', newAmount: 1500, newDate: '2026-10-06', correctedAt: '2026-10-08T09:00:00.000Z' }],
    },
    {
      id: 'PAY-3', amount: 500, date: '2026-10-07', method: 'Cash',
      voided: true, voidReason: 'duplicate receipt', voidedAt: '2026-10-09T10:30:00.000Z',
    },
    {
      id: 'PAY-4', amount: -500, date: '2026-10-09', method: 'Cash', receiptNumber: 'RCPT-99',
      reversalLink: { reversesPaymentId: 'PAY-3', reason: 'voided duplicate', operator: 'Operator', date: '2026-10-09' },
    },
  ];
}

function annotationFixture() {
  return {
    id: 'hea-1',
    customerId: 'CUST-1',
    entryKey: 'payment:PAY-2',
    entryType: 'payment',
    entryRef: 'PAY-2',
    text: 'customer says this was for his brother',
    date: '2026-11-07',
    by: 'Operator',
  };
}

function billsFixture() {
  return [
    { id: 'BILL-1', month: '2026-09', dueAmount: 1000, dueDate: '2026-09-05', payments: [{ id: 'PAY-1', amount: 1000, date: '2026-09-06', method: 'Cash' }] },
    {
      id: 'BILL-2', month: '2026-10', dueAmount: 1500, dueDate: '2026-10-05',
      payments: [
        {
          id: 'PAY-2', amount: 1500, date: '2026-10-06', method: 'JazzCash',
          correctionHistory: [{ previousAmount: 2000, previousDate: '2026-10-06', newAmount: 1500, newDate: '2026-10-06', correctedAt: '2026-10-08T09:00:00.000Z' }],
        },
        {
          id: 'PAY-3', amount: 500, date: '2026-10-07', method: 'Cash',
          voided: true, voidReason: 'duplicate receipt', voidedAt: '2026-10-09T10:30:00.000Z',
        },
        {
          id: 'PAY-4', amount: -500, date: '2026-10-09', method: 'Cash', receiptNumber: 'RCPT-99',
          reversalLink: { reversesPaymentId: 'PAY-3', reason: 'voided duplicate', operator: 'Operator', date: '2026-10-09' },
        },
      ],
    },
  ];
}

// --- Voided entries ---

test('voided entry reads voided with its reason, void date and reversing entry', () => {
  const entry = entriesFixture()[4];
  const struck = historyStruckThroughOf(entry, paymentsFixture());
  assert.equal(struck.kind, 'voided');
  assert.equal(struck.text, 'Voided: duplicate receipt · 2026-10-09 · Reversed by RCPT-99 · voided duplicate — by Operator, 2026-10-09');
});

test('voided entry with no reason says no reason was recorded, never a guessed one', () => {
  const entry = entriesFixture()[4];
  const payments = paymentsFixture().map((payment) => (payment.id === 'PAY-3'
    ? { ...payment, voidReason: '' }
    : payment));
  const struck = historyStruckThroughOf(entry, payments);
  assert.equal(struck.kind, 'voided');
  assert.ok(struck.text.startsWith('Voided: No reason recorded'));
});

test('voided entry with no void date shows no date, and with no reversing entry shows no reversal', () => {
  const entry = entriesFixture()[4];
  const payments = paymentsFixture()
    .filter((payment) => payment.id !== 'PAY-4')
    .map((payment) => (payment.id === 'PAY-3' ? { ...payment, voidedAt: '' } : payment));
  const struck = historyStruckThroughOf(entry, payments);
  assert.equal(struck.text, 'Voided: duplicate receipt');
});

test('voided entry with no payment record still reads voided', () => {
  const entry = entriesFixture()[4];
  const struck = historyStruckThroughOf(entry, []);
  assert.equal(struck.kind, 'voided');
  assert.equal(struck.text, 'Voided: No reason recorded');
});

test('voided wins over corrected when a record claims both', () => {
  const entry = entriesFixture()[4];
  const payments = paymentsFixture().map((payment) => (payment.id === 'PAY-3'
    ? { ...payment, correctionHistory: [{ previousAmount: 600, previousDate: '2026-10-07', newAmount: 500, newDate: '2026-10-07', correctedAt: '2026-10-08T09:00:00.000Z' }] }
    : payment));
  const struck = historyStruckThroughOf(entry, payments);
  assert.equal(struck.kind, 'voided');
});

test('plain entry, unknown reference, charge row and null entry are never struck', () => {
  const payments = paymentsFixture();
  assert.equal(historyStruckThroughOf(plainEntriesFixture()[1], payments), null);
  assert.equal(historyStruckThroughOf({ ...plainEntriesFixture()[1], ref: 'PAY-UNKNOWN' }, payments), null);
  assert.equal(historyStruckThroughOf(plainEntriesFixture()[0], payments), null);
  assert.equal(historyStruckThroughOf(null, payments), null);
  assert.equal(historyStruckThroughOf('not an entry', payments), null);
});

// --- Corrected entries ---

test('corrected entry names its original and corrected figures with the correction date', () => {
  const entry = plainEntriesFixture()[3];
  const struck = historyStruckThroughOf(entry, paymentsFixture());
  assert.equal(struck.kind, 'corrected');
  assert.equal(struck.text, 'Corrected from PKR 2,000 to PKR 1,500 · 2026-10-08');
});

test('twice-corrected entry names the first original and the latest corrected figure', () => {
  const entry = plainEntriesFixture()[3];
  const payments = paymentsFixture().map((payment) => (payment.id === 'PAY-2'
    ? {
      ...payment,
      correctionHistory: [
        { previousAmount: 2000, previousDate: '2026-10-06', newAmount: 1800, newDate: '2026-10-06', correctedAt: '2026-10-07T09:00:00.000Z' },
        { previousAmount: 1800, previousDate: '2026-10-06', newAmount: 1500, newDate: '2026-10-06', correctedAt: '2026-10-08T09:00:00.000Z' },
      ],
    }
    : payment));
  const struck = historyStruckThroughOf(entry, payments);
  assert.equal(struck.text, 'Corrected from PKR 2,000 to PKR 1,500 · 2026-10-08');
});

test('date-only correction names its dates instead of amounts', () => {
  const entry = plainEntriesFixture()[3];
  const payments = paymentsFixture().map((payment) => (payment.id === 'PAY-2'
    ? {
      ...payment,
      correctionHistory: [{ previousAmount: 1500, previousDate: '2026-10-05', newAmount: 1500, newDate: '2026-10-06', correctedAt: '2026-10-08T09:00:00.000Z' }],
    }
    : payment));
  const struck = historyStruckThroughOf(entry, payments);
  assert.equal(struck.text, 'Corrected date from 2026-10-05 to 2026-10-06 · 2026-10-08');
});

test('paisa correction prints one decimal, like the other history formatters', () => {
  const entry = plainEntriesFixture()[3];
  const payments = paymentsFixture().map((payment) => (payment.id === 'PAY-2'
    ? {
      ...payment,
      correctionHistory: [{ previousAmount: 2000, previousDate: '2026-10-06', newAmount: 1500.5, newDate: '2026-10-06', correctedAt: '2026-10-08T09:00:00.000Z' }],
    }
    : payment));
  const struck = historyStruckThroughOf(entry, payments);
  assert.equal(struck.text, 'Corrected from PKR 2,000 to PKR 1,500.5 · 2026-10-08');
});

test('no correction trail, empty trail and non-object trail entries are not corrected', () => {
  const entry = plainEntriesFixture()[1];
  assert.equal(historyStruckThroughOf(entry, paymentsFixture()), null);
  const payments = paymentsFixture().map((payment) => (payment.id === 'PAY-2'
    ? { ...payment, correctionHistory: [] }
    : payment));
  assert.equal(historyStruckThroughOf(plainEntriesFixture()[3], payments), null);
  const junk = paymentsFixture().map((payment) => (payment.id === 'PAY-2'
    ? { ...payment, correctionHistory: ['not an entry', null] }
    : payment));
  assert.equal(historyStruckThroughOf(plainEntriesFixture()[3], junk), null);
});

test('unreadable correction amounts fall back to a plain corrected line, never a guessed zero', () => {
  const entry = plainEntriesFixture()[3];
  const payments = paymentsFixture().map((payment) => (payment.id === 'PAY-2'
    ? {
      ...payment,
      correctionHistory: [{ previousAmount: null, previousDate: '2026-10-06', newAmount: 1500, newDate: '2026-10-06', correctedAt: '2026-10-08T09:00:00.000Z' }],
    }
    : payment));
  const struck = historyStruckThroughOf(entry, payments);
  assert.equal(struck.kind, 'corrected');
  assert.equal(struck.text, 'Corrected · 2026-10-08');
  assert.equal(struckCorrectionTextOf({ correctionHistory: [{ previousAmount: true, previousDate: '2026-10-06', newAmount: 1500, newDate: '2026-10-06', correctedAt: '2026-10-08T09:00:00.000Z' }] }), 'Corrected · 2026-10-08');
});

test('struckCorrectionTextOf returns null without a payment or without a trail', () => {
  assert.equal(struckCorrectionTextOf(null), null);
  assert.equal(struckCorrectionTextOf({ id: 'PAY-1', amount: 1000 }), null);
  assert.equal(struckCorrectionTextOf({ correctionHistory: [] }), null);
});

// --- Reversal link resolution ---

test('reversal link resolves only for a genuine negative reversing entry', () => {
  const payments = paymentsFixture();
  const link = struckReversalLinkOf(payments[3]);
  assert.equal(link.reversesPaymentId, 'PAY-3');
  assert.equal(link.reason, 'voided duplicate');
  assert.equal(link.operator, 'Operator');
  assert.equal(link.date, '2026-10-09');
  assert.equal(struckReversalLinkOf({ ...payments[3], amount: 500 }), null);
  assert.equal(struckReversalLinkOf({ ...payments[3], reversalLink: { reversesPaymentId: 'PAY-4', reason: '', operator: '', date: '2026-10-09' } }), null);
  assert.equal(struckReversalLinkOf({ ...payments[3], reversalLink: null }), null);
});

test('reversal link with no date falls back to the reversing payment date, and with neither is refused', () => {
  const payments = paymentsFixture();
  const noDate = struckReversalLinkOf({ ...payments[3], reversalLink: { reversesPaymentId: 'PAY-3', reason: '', operator: '', date: '' } });
  assert.equal(noDate.date, '2026-10-09');
  assert.equal(struckReversalLinkOf({ ...payments[3], date: 'not a date', reversalLink: { reversesPaymentId: 'PAY-3', reason: '', operator: '', date: '' } }), null);
});

test('reversal entry is found by scanning the payments for the link naming the original', () => {
  const payments = paymentsFixture();
  const entry = struckReversalEntryOf(payments[2], payments);
  assert.equal(entry.id, 'PAY-4');
  assert.equal(struckReversalEntryOf(payments[0], payments), null);
  assert.equal(struckReversalEntryOf(null, payments), null);
});

test('reversal line text names the receipt reference, and falls back to Reversed without one', () => {
  const payments = paymentsFixture();
  assert.equal(
    struckReversalLineText(struckReversalLinkOf(payments[3]), struckReceiptRef(payments[3])),
    'Reversed by RCPT-99 · voided duplicate — by Operator, 2026-10-09',
  );
  assert.equal(
    struckReversalLineText(struckReversalLinkOf(payments[3]), ''),
    'Reversed · voided duplicate — by Operator, 2026-10-09',
  );
  assert.equal(struckReversalLineText(null, 'RCPT-99'), '');
});

test('receipt reference prefers the stored number, then the permanent one, else blank', () => {
  assert.equal(struckReceiptRef({ receiptNumber: 'RCPT-1', permanentReceiptNumber: 'RCPT-2' }), 'RCPT-1');
  assert.equal(struckReceiptRef({ permanentReceiptNumber: 'RCPT-2' }), 'RCPT-2');
  assert.equal(struckReceiptRef({}), '');
  assert.equal(struckReceiptRef(null), '');
});

// --- Formatter and running note ---

test('amounts print with no decimals for whole rupees and one decimal for paisa', () => {
  assert.equal(formatHistoryStruckThroughAmount(150000), 'PKR 1,500');
  assert.equal(formatHistoryStruckThroughAmount(150050), 'PKR 1,500.5');
  assert.equal(formatHistoryStruckThroughAmount(-50000), '-PKR 500');
});

test('a null, undefined, empty, or boolean figure is not a number, never zero', () => {
  assert.equal(formatHistoryStruckThroughAmount(null), 'PKR 0');
  assert.equal(formatHistoryStruckThroughAmount(undefined), 'PKR 0');
  assert.equal(formatHistoryStruckThroughAmount(''), 'PKR 0');
  assert.equal(formatHistoryStruckThroughAmount(true), 'PKR 0');
  assert.equal(formatHistoryStruckThroughAmount(Number.NaN), 'PKR 0');
});

test('running note reads Settled, Still owed, or Credit, and settles on a missing balance', () => {
  assert.equal(historyStruckThroughRunningNote(0), 'Settled');
  assert.equal(historyStruckThroughRunningNote(150000), 'Still owed PKR 1,500');
  assert.equal(historyStruckThroughRunningNote(-50000), 'Credit PKR 500');
  assert.equal(historyStruckThroughRunningNote(null), 'Settled');
  assert.equal(historyStruckThroughRunningNote(true), 'Settled');
});

test('strict dates are leap-aware', () => {
  assert.equal(isStrictHistoryStruckThroughDate('2024-02-29'), true);
  assert.equal(isStrictHistoryStruckThroughDate('2025-02-29'), false);
  assert.equal(isStrictHistoryStruckThroughDate('2026-13-01'), false);
  assert.equal(isStrictHistoryStruckThroughDate('2026-10-08'), true);
});

test('historyShownHasStruckThrough is true only when a shown entry is voided or corrected', () => {
  assert.equal(historyShownHasStruckThrough(entriesFixture(), paymentsFixture()), true);
  assert.equal(historyShownHasStruckThrough(plainEntriesFixture(), []), false);
  assert.equal(historyShownHasStruckThrough(plainEntriesFixture(), paymentsFixture()), true);
  assert.equal(historyShownHasStruckThrough([], paymentsFixture()), false);
  assert.equal(historyShownHasStruckThrough(null, paymentsFixture()), false);
});

// --- List HTML: byte-identical when nothing is struck ---

test('list is byte-identical to the full history list when nothing is struck', () => {
  const entries = plainEntriesFixture();
  assert.equal(historyStruckThroughListHtml(entries, [], [], 'CUST-1'), fullHistoryListHtml(entries));
});

test('list is byte-identical to the disputed-flag view when only flags are present', () => {
  const entries = flaggedEntriesFixture();
  assert.equal(historyStruckThroughListHtml(entries, [], [], 'CUST-1'), historyDisputedFlagListHtml(entries));
});

test('list is byte-identical to the annotated list when only notes are present', () => {
  const entries = plainEntriesFixture();
  assert.equal(
    historyStruckThroughListHtml(entries, [], [annotationFixture()], 'CUST-1'),
    historyAnnotatedListHtml(entries, [annotationFixture()], 'CUST-1'),
  );
});

test('list is empty for an empty or missing list', () => {
  assert.equal(historyStruckThroughListHtml([], paymentsFixture(), [], 'CUST-1'), '');
  assert.equal(historyStruckThroughListHtml(null, paymentsFixture(), [], 'CUST-1'), '');
});

// --- List HTML: struck rows ---

test('voided row is struck through with its reversal beside it, other rows unchanged', () => {
  const entries = entriesFixture();
  const payments = paymentsFixture();
  const html = historyStruckThroughListHtml(entries, payments, [], 'CUST-1');
  const plain = fullHistoryListHtml(entries);
  assert.ok(html.includes('<li class="payment-row"><span class="payment-main"><span class="payment-amount">Payment · PKR 1,000</span><span class="payment-meta">2026-09-06 · Cash · Settled</span></span></li>'));
  assert.ok(html.includes('<s><span class="payment-amount">Payment · PKR 500 · VOID</span>'));
  assert.ok(html.includes('<span class="payment-meta hst-struck-note">Voided: duplicate receipt · 2026-10-09 · Reversed by RCPT-99 · voided duplicate — by Operator, 2026-10-09</span>'));
  assert.ok(!plain.includes('<s>'));
});

test('corrected row is struck through with its correction beside it', () => {
  const entries = plainEntriesFixture();
  const html = historyStruckThroughListHtml(entries, paymentsFixture(), [], 'CUST-1');
  assert.ok(html.includes('<s><span class="payment-amount">Payment · PKR 1,500</span>'));
  assert.ok(html.includes('<span class="payment-meta hst-struck-note">Corrected from PKR 2,000 to PKR 1,500 · 2026-10-08</span>'));
});

test('struck row keeps its disputed flag inside the struck figures', () => {
  const entries = flaggedEntriesFixture();
  const html = historyStruckThroughListHtml(entries, paymentsFixture(), [], 'CUST-1');
  assert.ok(html.includes('Disputed · CASE-1</span></s>'));
});

test('struck row keeps its operator note and Remove button readable beside it', () => {
  const entries = plainEntriesFixture();
  const html = historyStruckThroughListHtml(entries, paymentsFixture(), [annotationFixture()], 'CUST-1');
  assert.ok(html.includes('data-hea-remove="hea-1"'));
  assert.ok(html.includes('Note: customer says this was for his brother · 2026-11-07 · by Operator'));
  assert.ok(html.indexOf('hst-struck-note') < html.indexOf('hea-annotation'));
});

test('user-entered void reason is escaped, never printed raw', () => {
  const entries = entriesFixture();
  const payments = paymentsFixture().map((payment) => (payment.id === 'PAY-3'
    ? { ...payment, voidReason: '<script>alert(1)</script>' }
    : payment));
  const html = historyStruckThroughListHtml(entries, payments, [], 'CUST-1');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

// --- Acceptance: composed from the full history entries ---

test('acceptance: voided and corrected entries are struck with their beside-lines, figures unchanged', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: billsFixture(),
    creditEntries: [],
    refundRecords: [],
  });
  assert.equal(entries.length, 6);
  const html = historyStruckThroughListHtml(entries, billsFixture().flatMap((bill) => bill.payments), [], 'CUST-1');
  assert.ok(html.includes('Corrected from PKR 2,000 to PKR 1,500 · 2026-10-08'));
  assert.ok(html.includes('Voided: duplicate receipt · 2026-10-09 · Reversed by RCPT-99 · voided duplicate — by Operator, 2026-10-09'));
  assert.ok(html.includes('Payment · PKR 1,500</span>'));
  assert.ok(!html.includes('PKR 2,000</span>'));
  const voided = entries.find((entry) => entry.ref === 'PAY-3');
  assert.equal(voided.voided, true);
  assert.equal(voided.runningBalanceCents, 0);
});

test('acceptance: a customer with no voided or corrected entry sees the ordinary list', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: [{ id: 'BILL-1', month: '2026-09', dueAmount: 1000, dueDate: '2026-09-05', payments: [{ id: 'PAY-1', amount: 1000, date: '2026-09-06', method: 'Cash' }] }],
    creditEntries: [],
    refundRecords: [],
  });
  const html = historyStruckThroughListHtml(entries, [], [], 'CUST-1');
  assert.equal(html, fullHistoryListHtml(entries));
  assert.ok(!html.includes('<s>'));
});

// --- Fences: module is pure, import-free, and names no fenced file ---

test('module names no fenced file literally in its header or body', () => {
  const source = readFileSync(new URL('../history-struck-through.js', import.meta.url), 'utf8');
  const fenced = [
    'full-' + 'history-list.js',
    'billing-' + 'corrections.js',
    'reversal-' + 'link.js',
    'payment-' + 'void-audit.js',
    'history-' + 'disputed-flag.js',
    'history-' + 'entry-annotation.js',
  ];
  for (const name of fenced) assert.ok(!source.includes(name), `module names ${name}`);
});

test('module is import-free and touches no clock, storage, page or network', () => {
  const source = readFileSync(new URL('../history-struck-through.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('window.'));
});

test('module adds no store, no new styles rule, and no OLT word', () => {
  const source = readFileSync(new URL('../history-struck-through.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('shahdara_'));
  assert.ok(!/\bOLT\b/.test(source));
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(!styles.includes('hst-struck-note'));
});

// --- Wiring in app.js ---

test('app.js wires the struck-through list into the full history render', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("import { historyShownHasStruckThrough, historyStruckThroughListHtml } from './history-struck-through.js';"));
  assert.ok(app.includes('const historyPayments = (customer.bills ?? []).flatMap((bill) => Array.isArray(bill?.payments) ? bill.payments : []);'));
  assert.ok(app.includes('historyShownHasStruckThrough(shown, historyPayments)'));
  assert.ok(app.includes('historyStruckThroughListHtml(shown, historyPayments, entryAnnotations, customer.id)'));
  assert.ok(app.includes('historyAnnotatedListHtml(shown, entryAnnotations, customer.id)'));
  assert.ok(app.includes('historyDisputedFlagListHtml(shown)'));
  assert.ok(app.includes('fullHistoryListHtml(shown)'));
});
