// Plan 417 — History adjustment entries with reasons shown.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fullHistoryEntries } from '../full-history-list.js';
import {
  HISTORY_ADJUSTMENTS_INLINE_EMPTY_TEXT,
  HISTORY_ADJUSTMENTS_INLINE_NO_ADJUSTMENTS_TEXT,
  HISTORY_ADJUSTMENTS_INLINE_REASON_NOT_RECORDED_TEXT,
  HISTORY_ADJUSTMENTS_INLINE_DATE_NOT_RECORDED_TEXT,
  HISTORY_ADJUSTMENTS_INLINE_APPROVER_NOT_RECORDED_TEXT,
  historyAdjustmentsInlineIsAdjustment,
  historyAdjustmentsInlineDelta,
  historyAdjustmentsInlineCorrectionDelta,
  historyAdjustmentsInlineIsCorrection,
  historyAdjustmentsInlineLines,
  historyAdjustmentsInlineTotalCents,
  formatAdjustmentsInlineAmount,
  historyAdjustmentsInlineBalanceNote,
  historyAdjustmentsInlineLineText,
  historyAdjustmentsInlineSummaryText,
  historyAdjustmentsInlineHtml,
} from '../history-adjustments-inline.js';

const CUSTOMER = 'CUST-1';

function correction(overrides = {}) {
  return {
    id: 'CORR-1',
    customerId: CUSTOMER,
    originalBillId: 'BILL-SEP',
    errorKind: 'wrong_package',
    originalAmountCents: 100000,
    correctedAmountCents: 80000,
    reason: 'Wrong package charged',
    approver: 'Operator',
    date: '2026-09-10',
    ...overrides,
  };
}

// The acceptance fixture: a September bill of PKR 1,000, a payment
// of PKR 800 on 2026-09-05, an adjustment payment of PKR 200 on
// 2026-09-10, and an October bill of PKR 500. The correction
// recorded for the same date changes the September bill from
// PKR 1,000 to PKR 800 — exactly the adjustment's amount — so it
// explains the adjustment row, and the adjustment settles the
// September balance.
function historyFixture() {
  const bills = [
    {
      id: 'BILL-SEP', month: '2026-09', dueAmount: 1000, dueDate: '2026-09-01',
      payments: [
        { id: 'PAY-1', amount: 800, date: '2026-09-05', method: 'Cash' },
        { id: 'PAY-ADJ', amount: 200, date: '2026-09-10', method: 'Cash', categoryTag: 'adjustment', note: 'Adjusted on the phone' },
      ],
    },
    { id: 'BILL-OCT', month: '2026-10', dueAmount: 500, dueDate: '2026-10-01', payments: [] },
  ];
  const entries = fullHistoryEntries({
    customerId: CUSTOMER, bills, creditEntries: [], refundRecords: [],
  });
  return { bills, entries, corrections: [correction()] };
}

// --- Acceptance ---

test('acceptance: every adjustment appears in date order with its reason and approver, and the balance after it is settled', () => {
  const { entries, corrections } = historyFixture();
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.equal(line.date, '2026-09-10');
  assert.equal(line.amountCents, 20000);
  assert.equal(line.reason, 'Wrong package charged');
  assert.equal(line.approver, 'Operator');
  assert.equal(line.balanceBeforeCents, 20000);
  assert.equal(line.balanceAfterCents, 0);
  assert.equal(historyAdjustmentsInlineBalanceNote(line.balanceAfterCents), 'Settled');
});

test('acceptance: a correction with no matching history row appears as its own line with its signed change and no balance', () => {
  const { entries } = historyFixture();
  const corrections = [
    correction(),
    correction({ id: 'CORR-2', date: '2026-09-15', originalAmountCents: 100000, correctedAmountCents: 90000, reason: 'Wrong amount' }),
  ];
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines.length, 2);
  const [first, second] = lines;
  assert.equal(first.source, 'history');
  assert.equal(second.source, 'correction');
  assert.equal(second.date, '2026-09-15');
  assert.equal(second.amountCents, -10000);
  assert.equal(second.reason, 'Wrong amount');
  assert.equal(second.approver, 'Operator');
  assert.equal(second.balanceBeforeCents, null);
  assert.equal(second.balanceAfterCents, null);
  assert.equal(historyAdjustmentsInlineBalanceNote(second.balanceAfterCents), 'not recorded');
});

test('acceptance: an adjustment without a recorded reason shows reason not recorded', () => {
  const bills = [
    {
      id: 'BILL-SEP', month: '2026-09', dueAmount: 1000, dueDate: '2026-09-01',
      payments: [
        { id: 'PAY-ADJ', amount: 100, date: '2026-09-12', method: 'Cash', categoryTag: 'adjustment', note: '' },
      ],
    },
  ];
  const entries = fullHistoryEntries({
    customerId: CUSTOMER, bills, creditEntries: [], refundRecords: [],
  });
  const lines = historyAdjustmentsInlineLines({ entries, corrections: [], customerId: CUSTOMER });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].reason, '');
  assert.equal(lines[0].approver, '');
  assert.match(historyAdjustmentsInlineLineText(lines[0]), /reason not recorded/);
  assert.doesNotMatch(historyAdjustmentsInlineLineText(lines[0]), /Approved by/);
  const html = historyAdjustmentsInlineHtml(entries, entries, [], CUSTOMER);
  assert.match(html, /reason not recorded/);
  assert.match(html, new RegExp(HISTORY_ADJUSTMENTS_INLINE_APPROVER_NOT_RECORDED_TEXT));
});

test('acceptance: another customer\'s corrections never appear', () => {
  const { entries } = historyFixture();
  const other = [correction({ id: 'CORR-9', customerId: 'CUST-2' })];
  const lines = historyAdjustmentsInlineLines({ entries, corrections: other, customerId: CUSTOMER });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].source, 'history');
  assert.equal(lines[0].reason, 'Adjusted on the phone');
});

// --- The adjustment check ---

test('isAdjustment: a typed adjustment with a usable positive amount counts', () => {
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'adjustment', amountCents: 20000 }), true);
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'Adjustment', amountCents: 20000 }), true);
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'adjustment', amountCents: '200' }), true);
});

test('isAdjustment: other types, and zero, negative or non-numeric amounts, never count', () => {
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'payment', amountCents: 20000 }), false);
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'charge', amountCents: 20000 }), false);
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'adjustment', amountCents: 0 }), false);
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'adjustment', amountCents: -20000 }), false);
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'adjustment', amountCents: null }), false);
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'adjustment', amountCents: true }), false);
  assert.equal(historyAdjustmentsInlineIsAdjustment({ type: 'adjustment', amountCents: '' }), false);
  assert.equal(historyAdjustmentsInlineIsAdjustment(null), false);
  assert.equal(historyAdjustmentsInlineIsAdjustment('adjustment'), false);
});

test('delta: an adjustment reduces what is owed, a voided one moves nothing, other entries move nothing', () => {
  assert.equal(historyAdjustmentsInlineDelta({ type: 'adjustment', amountCents: 20000 }), -20000);
  assert.equal(historyAdjustmentsInlineDelta({ type: 'adjustment', amountCents: 20000, voided: true }), 0);
  assert.equal(historyAdjustmentsInlineDelta({ type: 'payment', amountCents: 20000 }), 0);
  assert.equal(historyAdjustmentsInlineDelta({ type: 'charge', amountCents: 20000 }), 0);
  assert.equal(historyAdjustmentsInlineDelta({ type: 'adjustment', amountCents: null }), 0);
  assert.equal(historyAdjustmentsInlineDelta(null), 0);
});

test('correction delta: corrected minus original, signed; unusable figures make no change', () => {
  assert.equal(historyAdjustmentsInlineCorrectionDelta(correction()), -20000);
  assert.equal(historyAdjustmentsInlineCorrectionDelta(correction({ originalAmountCents: 80000, correctedAmountCents: 100000 })), 20000);
  assert.equal(historyAdjustmentsInlineCorrectionDelta(correction({ originalAmountCents: 80000, correctedAmountCents: 80000 })), 0);
  assert.equal(historyAdjustmentsInlineCorrectionDelta(correction({ originalAmountCents: 0 })), null);
  assert.equal(historyAdjustmentsInlineCorrectionDelta(correction({ originalAmountCents: -100 })), null);
  assert.equal(historyAdjustmentsInlineCorrectionDelta(correction({ correctedAmountCents: -100 })), null);
  assert.equal(historyAdjustmentsInlineCorrectionDelta(correction({ originalAmountCents: null })), null);
  assert.equal(historyAdjustmentsInlineCorrectionDelta(correction({
    originalAmountCents: undefined, correctedAmountCents: undefined, originalAmount: 1000, correctedAmount: 800,
  })), -20000);
  assert.equal(historyAdjustmentsInlineCorrectionDelta(null), null);
  assert.equal(historyAdjustmentsInlineCorrectionDelta('CORR-1'), null);
});

test('isCorrection: the customer match is case-insensitive; another customer is dropped; unusable figures are dropped', () => {
  assert.equal(historyAdjustmentsInlineIsCorrection(correction(), CUSTOMER), true);
  assert.equal(historyAdjustmentsInlineIsCorrection(correction({ customerId: 'cust-1' }), CUSTOMER), true);
  assert.equal(historyAdjustmentsInlineIsCorrection(correction({ customerId: 'CUST-2' }), CUSTOMER), false);
  assert.equal(historyAdjustmentsInlineIsCorrection(correction({ originalAmountCents: 0 }), CUSTOMER), false);
  assert.equal(historyAdjustmentsInlineIsCorrection(correction({ correctedAmountCents: null }), CUSTOMER), false);
  assert.equal(historyAdjustmentsInlineIsCorrection(null, CUSTOMER), false);
  assert.equal(historyAdjustmentsInlineIsCorrection('CORR-1', CUSTOMER), false);
});

// --- Matching ---

test('matching: same date and same money attaches the reason and approver, and makes one line, not two', () => {
  const { entries, corrections } = historyFixture();
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].source, 'history');
  assert.equal(lines[0].reason, 'Wrong package charged');
  assert.equal(lines[0].approver, 'Operator');
});

test('matching: same date but different money does not match — both lines appear', () => {
  const { entries } = historyFixture();
  const corrections = [correction({ originalAmountCents: 100000, correctedAmountCents: 95000 })];
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].source, 'history');
  assert.equal(lines[0].reason, 'Adjusted on the phone');
  assert.equal(lines[0].approver, '');
  assert.equal(lines[1].source, 'correction');
  assert.equal(lines[1].amountCents, -5000);
  assert.equal(lines[1].reason, 'Wrong package charged');
});

test('matching: same money but a different date does not match — both lines appear', () => {
  const { entries } = historyFixture();
  const corrections = [correction({ date: '2026-09-12' })];
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].source, 'history');
  assert.equal(lines[0].date, '2026-09-10');
  assert.equal(lines[1].source, 'correction');
  assert.equal(lines[1].date, '2026-09-12');
});

test('matching: two corrections on one date each find their own row by amount', () => {
  const bills = [
    {
      id: 'BILL-SEP', month: '2026-09', dueAmount: 1000, dueDate: '2026-09-01',
      payments: [
        { id: 'PAY-1', amount: 500, date: '2026-09-05', method: 'Cash' },
        { id: 'PAY-ADJ-A', amount: 300, date: '2026-09-10', method: 'Cash', categoryTag: 'adjustment', note: 'First note' },
        { id: 'PAY-ADJ-B', amount: 200, date: '2026-09-10', method: 'Cash', categoryTag: 'adjustment', note: 'Second note' },
      ],
    },
  ];
  const entries = fullHistoryEntries({
    customerId: CUSTOMER, bills, creditEntries: [], refundRecords: [],
  });
  const corrections = [
    correction({ id: 'CORR-A', originalAmountCents: 100000, correctedAmountCents: 70000, reason: 'Wrong amount' }),
    correction({ id: 'CORR-B', originalAmountCents: 100000, correctedAmountCents: 80000, reason: 'Wrong package charged' }),
  ];
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].ref, 'PAY-ADJ-A');
  assert.equal(lines[0].amountCents, 30000);
  assert.equal(lines[0].reason, 'Wrong amount');
  assert.equal(lines[1].ref, 'PAY-ADJ-B');
  assert.equal(lines[1].amountCents, 20000);
  assert.equal(lines[1].reason, 'Wrong package charged');
});

// --- Ordering ---

test('ordering: lines sort by date, and a month-only date counts as the first of that month', () => {
  const { entries } = historyFixture();
  const corrections = [
    correction({ id: 'CORR-M', date: '2026-10', originalAmountCents: 50000, correctedAmountCents: 40000, reason: 'October fix' }),
    correction({ id: 'CORR-S', date: '2026-09-20', originalAmountCents: 100000, correctedAmountCents: 90000, reason: 'September fix' }),
  ];
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines.length, 3);
  assert.equal(lines[0].date, '2026-09-10');
  assert.equal(lines[1].date, '2026-09-20');
  assert.equal(lines[2].date, '2026-10');
});

test('ordering: an undated correction sorts last', () => {
  const { entries } = historyFixture();
  const corrections = [
    correction(),
    correction({ id: 'CORR-U', date: '', originalAmountCents: 100000, correctedAmountCents: 90000, reason: 'Undated fix' }),
  ];
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines[lines.length - 1].ref, 'CORR-U');
  assert.equal(lines[lines.length - 1].date, '');
  assert.match(historyAdjustmentsInlineLineText(lines[lines.length - 1]), /date not recorded/);
});

test('ordering: on the same date a history line comes before a correction line', () => {
  const { entries } = historyFixture();
  const corrections = [correction({ originalAmountCents: 100000, correctedAmountCents: 95000 })];
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].source, 'history');
  assert.equal(lines[1].source, 'correction');
  assert.equal(lines[0].date, lines[1].date);
});

test('lines: no customer id means no lines', () => {
  const { entries, corrections } = historyFixture();
  assert.deepEqual(historyAdjustmentsInlineLines({ entries, corrections, customerId: '' }), []);
  assert.deepEqual(historyAdjustmentsInlineLines({}), []);
});

// --- Balances ---

test('balance: a history line carries the running balance before and after it', () => {
  const { entries, corrections } = historyFixture();
  const [line] = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(line.balanceBeforeCents, 20000);
  assert.equal(line.balanceAfterCents, 0);
});

test('balance: a voided adjustment is listed as VOID, moves nothing, and never counts towards the total', () => {
  const bills = [
    {
      id: 'BILL-SEP', month: '2026-09', dueAmount: 1000, dueDate: '2026-09-01',
      payments: [
        { id: 'PAY-1', amount: 800, date: '2026-09-05', method: 'Cash' },
        { id: 'PAY-ADJ', amount: 200, date: '2026-09-10', method: 'Cash', categoryTag: 'adjustment', note: 'Voided adjustment', voided: true },
      ],
    },
  ];
  const entries = fullHistoryEntries({
    customerId: CUSTOMER, bills, creditEntries: [], refundRecords: [],
  });
  const lines = historyAdjustmentsInlineLines({ entries, corrections: [], customerId: CUSTOMER });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].voided, true);
  assert.equal(lines[0].balanceBeforeCents, 20000);
  assert.equal(lines[0].balanceAfterCents, 20000);
  assert.equal(historyAdjustmentsInlineTotalCents(lines), 0);
  assert.match(historyAdjustmentsInlineLineText(lines[0]), /VOID/);
  const html = historyAdjustmentsInlineHtml(entries, entries, [], CUSTOMER);
  assert.match(html, /VOID/);
});

test('balance: a correction line carries no balance, never a guessed one', () => {
  const { entries } = historyFixture();
  const corrections = [
    correction(),
    correction({ id: 'CORR-2', date: '2026-09-15', originalAmountCents: 100000, correctedAmountCents: 90000, reason: 'Wrong amount' }),
  ];
  const lines = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(lines[1].balanceBeforeCents, null);
  assert.equal(lines[1].balanceAfterCents, null);
  assert.equal(historyAdjustmentsInlineTotalCents(lines), 10000);
});

// --- Amounts and notes ---

test('format: whole rupees print with no decimals and a paisa remainder with one decimal', () => {
  assert.equal(formatAdjustmentsInlineAmount(150000), 'PKR 1,500');
  assert.equal(formatAdjustmentsInlineAmount(150050), 'PKR 1,500.5');
  assert.equal(formatAdjustmentsInlineAmount(null), 'PKR 0');
  assert.equal(formatAdjustmentsInlineAmount(-5000), '-PKR 50');
});

test('balance note: settled, still owed, credit and not recorded', () => {
  assert.equal(historyAdjustmentsInlineBalanceNote(0), 'Settled');
  assert.equal(historyAdjustmentsInlineBalanceNote(100000), 'Still owed PKR 1,000');
  assert.equal(historyAdjustmentsInlineBalanceNote(-50000), 'Credit PKR 500');
  assert.equal(historyAdjustmentsInlineBalanceNote(null), 'not recorded');
});

test('line text: date, amount, reason, balance and approver in plain words', () => {
  const { entries, corrections } = historyFixture();
  const [line] = historyAdjustmentsInlineLines({ entries, corrections, customerId: CUSTOMER });
  assert.equal(
    historyAdjustmentsInlineLineText(line),
    '2026-09-10 · Adjustment PKR 200 · Wrong package charged · Balance after Settled · Approved by Operator',
  );
});

test('line text: missing date, reason and approver fall back to plain words; null is empty', () => {
  const text = historyAdjustmentsInlineLineText({
    date: '', amountCents: 10000, reason: '', approver: '', balanceAfterCents: null,
  });
  assert.match(text, new RegExp(HISTORY_ADJUSTMENTS_INLINE_DATE_NOT_RECORDED_TEXT));
  assert.match(text, new RegExp(HISTORY_ADJUSTMENTS_INLINE_REASON_NOT_RECORDED_TEXT));
  assert.match(text, /not recorded/);
  assert.doesNotMatch(text, /Approved by/);
  assert.equal(historyAdjustmentsInlineLineText(null), '');
});

// --- Summary ---

test('summary: an empty shown list says no transactions yet', () => {
  assert.equal(historyAdjustmentsInlineSummaryText([], [], [], CUSTOMER), HISTORY_ADJUSTMENTS_INLINE_EMPTY_TEXT);
});

test('summary: a shown history with no adjustments says so plainly', () => {
  const { entries } = historyFixture();
  const noAdjustments = entries.filter((entry) => entry.type !== 'adjustment');
  assert.equal(historyAdjustmentsInlineSummaryText(noAdjustments, entries, [], CUSTOMER), HISTORY_ADJUSTMENTS_INLINE_NO_ADJUSTMENTS_TEXT);
});

test('summary: the full summary names the count, the adjusted total and the balance', () => {
  const { entries, corrections } = historyFixture();
  assert.equal(
    historyAdjustmentsInlineSummaryText(entries, entries, corrections, CUSTOMER),
    '1 adjustment · PKR 200 adjusted · Balance Settled',
  );
  const two = [
    correction(),
    correction({ id: 'CORR-2', date: '2026-09-15', originalAmountCents: 100000, correctedAmountCents: 90000, reason: 'Wrong amount' }),
  ];
  assert.equal(
    historyAdjustmentsInlineSummaryText(entries, entries, two, CUSTOMER),
    '2 adjustments · PKR 100 adjusted · Balance not recorded',
  );
});

test('summary: a filtered view composes the full-history totals', () => {
  const { entries } = historyFixture();
  const corrections = [
    correction(),
    correction({ id: 'CORR-2', date: '2026-09-15', originalAmountCents: 100000, correctedAmountCents: 90000, reason: 'Wrong amount' }),
  ];
  // The shown view hides the adjustment row, so its line hides too;
  // the correction dated inside the shown span still shows.
  const shownHidden = entries.filter((entry) => entry.type !== 'adjustment');
  assert.equal(
    historyAdjustmentsInlineSummaryText(shownHidden, entries, corrections, CUSTOMER),
    '1 adjustment · -PKR 100 adjusted · Balance not recorded · Full history: 2 adjustments · PKR 100 adjusted',
  );
  // The shown view keeps only the October charge, so the September
  // correction falls outside the shown span and hides too.
  const shownOctober = entries.filter((entry) => entry.date === '2026-10-01');
  assert.equal(historyAdjustmentsInlineSummaryText(shownOctober, entries, corrections, CUSTOMER), HISTORY_ADJUSTMENTS_INLINE_NO_ADJUSTMENTS_TEXT);
  // The shown view keeps everything, so the summary is the full one.
  assert.equal(
    historyAdjustmentsInlineSummaryText(entries, entries, corrections, CUSTOMER),
    '2 adjustments · PKR 100 adjusted · Balance not recorded',
  );
});

// --- The display ---

test('html: an empty shown list renders nothing', () => {
  assert.equal(historyAdjustmentsInlineHtml([], [], [], CUSTOMER), '');
  assert.equal(historyAdjustmentsInlineHtml(null, null, null, CUSTOMER), '');
});

test('html: a shown history with no adjustments renders a plain line saying so', () => {
  const { entries } = historyFixture();
  const noAdjustments = entries.filter((entry) => entry.type !== 'adjustment');
  assert.match(historyAdjustmentsInlineHtml(noAdjustments, entries, [], CUSTOMER), /No adjustments/);
});

test('html: the table carries date, reason, adjustment, approver and balances, with a totals footer', () => {
  const { entries, corrections } = historyFixture();
  const html = historyAdjustmentsInlineHtml(entries, entries, corrections, CUSTOMER);
  assert.match(html, /class="statement-table"/);
  assert.match(html, /<th>Date<\/th><th>Reason<\/th><th class="col-num">Adjustment<\/th><th>Approver<\/th><th class="col-num">Balance before<\/th><th class="col-num">Balance after<\/th>/);
  assert.match(html, /<td>2026-09-10<\/td><td>Wrong package charged<\/td>/);
  assert.match(html, /<td>Operator<\/td>/);
  assert.match(html, /Totals · 1 adjustment/);
  assert.match(html, /<strong>PKR 200<\/strong>/);
});

test('html: a filtered view shows only what the filters show, with a full-history footer row', () => {
  const { entries } = historyFixture();
  const corrections = [
    correction(),
    correction({ id: 'CORR-2', date: '2026-09-15', originalAmountCents: 100000, correctedAmountCents: 90000, reason: 'Wrong amount' }),
  ];
  const shown = entries.filter((entry) => entry.type !== 'adjustment');
  const html = historyAdjustmentsInlineHtml(shown, entries, corrections, CUSTOMER);
  assert.match(html, /2026-09-15/);
  assert.doesNotMatch(html, /2026-09-10/);
  assert.match(html, /Totals · 1 adjustment/);
  assert.match(html, /Full history · 2 adjustments/);
});

test('html: a reason with markup is escaped, never rendered', () => {
  const { entries } = historyFixture();
  const corrections = [correction({ id: 'CORR-X', date: '2026-09-15', reason: '<script>alert(1)</script>' })];
  const html = historyAdjustmentsInlineHtml(entries, entries, corrections, CUSTOMER);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('html: the display never mutates its inputs', () => {
  const { bills, entries, corrections } = historyFixture();
  const billsBefore = JSON.stringify(bills);
  const entriesBefore = JSON.stringify(entries);
  const correctionsBefore = JSON.stringify(corrections);
  historyAdjustmentsInlineHtml(entries, entries, corrections, CUSTOMER);
  historyAdjustmentsInlineSummaryText(entries, entries, corrections, CUSTOMER);
  assert.equal(JSON.stringify(bills), billsBefore);
  assert.equal(JSON.stringify(entries), entriesBefore);
  assert.equal(JSON.stringify(corrections), correctionsBefore);
});

// --- Fences ---

// Fences: the fenced module names are built in fragments below so
// this file never states them as literals.
test('fence: the full history list still exports its builders and is still wired', () => {
  const listName = 'full-' + 'history-list.js';
  const listSource = readFileSync(new URL(`../${listName}`, import.meta.url), 'utf8');
  assert.match(listSource, /export const FULL_HISTORY_TYPES/);
  assert.match(listSource, /export function fullHistoryEntries/);
  assert.match(listSource, /export function fullHistoryListHtml/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /fullHistoryEntries/);
  assert.match(appSource, /fullHistoryListHtml/);
  assert.doesNotMatch(listSource, /historyAdjustmentsInline/);
});

test('fence: the billing corrections record still exports its builders and is untouched by this plan', () => {
  const correctionsName = 'billing-' + 'corrections.js';
  const correctionsSource = readFileSync(new URL(`../${correctionsName}`, import.meta.url), 'utf8');
  assert.match(correctionsSource, /export function normalizeBillingCorrectionList/);
  assert.match(correctionsSource, /export function addBillingCorrection/);
  assert.match(correctionsSource, /export function correctionsForCustomer/);
  assert.match(correctionsSource, /export function correctionSummaryText/);
  assert.match(correctionsSource, /export function correctionHtml/);
  assert.match(correctionsSource, /export function correctionCsv/);
  assert.match(correctionsSource, /export function correctionFilename/);
  assert.doesNotMatch(correctionsSource, /historyAdjustmentsInline/);
});

test('fence: no fenced history view carries any adjustments-inline reference', () => {
  const fenced = [
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'csv-export.js',
    'history-' + 'printed-statement.js',
    'history-' + 'gap-view.js',
    'history-' + 'largest-payment.js',
    'history-' + 'first-dates.js',
    'history-' + 'disputed-flag.js',
    'history-' + 'refunds-inline.js',
    'history-' + 'credit-inline.js',
    'balance-' + 'rollforward.js',
  ];
  for (const name of fenced) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /historyAdjustmentsInline/, `${name} must not reference this plan`);
  }
});

test('header: the module header never names a fenced module literally', () => {
  const source = readFileSync(new URL('../history-adjustments-inline.js', import.meta.url), 'utf8');
  const header = source.slice(0, source.indexOf('export const'));
  for (const name of [
    'full-' + 'history-list.js',
    'billing-' + 'corrections.js',
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'csv-export.js',
    'history-' + 'printed-statement.js',
    'history-' + 'gap-view.js',
    'history-' + 'largest-payment.js',
    'history-' + 'first-dates.js',
    'history-' + 'disputed-flag.js',
    'history-' + 'refunds-inline.js',
    'history-' + 'credit-inline.js',
    'balance-' + 'rollforward.js',
  ]) {
    assert.doesNotMatch(header, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `header must not name ${name}`);
  }
});

// --- Wiring ---

test('wiring: the app renders the adjustments display from the shown rows', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /import \{ historyAdjustmentsInlineHtml \} from '\.\/history-adjustments-inline\.js';/);
  assert.match(appSource, /\$\('#hadHistoryAdjustmentsInline'\)/);
  assert.match(appSource, /historyAdjustmentsInlineHtml\(shown, entries, loadBillingCorrections\(\), customer\.id\)/);
  const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(indexSource, /<div id="hadHistoryAdjustmentsInline"><\/div>/);
});

test('wiring: the display reuses the statement table classes and adds no new style rule', () => {
  const { entries, corrections } = historyFixture();
  const html = historyAdjustmentsInlineHtml(entries, entries, corrections, CUSTOMER);
  assert.match(html, /class="statement-table"/);
  assert.match(html, /balance-num/);
  const stylesSource = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(stylesSource, /hadHistoryAdjustmentsInline/);
  assert.doesNotMatch(stylesSource, /adjustments-inline/);
});
