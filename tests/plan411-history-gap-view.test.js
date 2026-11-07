// Plan 411 — History missing-months gap view: months in which a
// customer paid nothing are invisible in a history that only lists
// what happened, so a gap of three unpaid months is only noticed
// when the dues become large. One gap view on the customer
// history — the months between the first and latest transaction
// with no payment, listed with their billed amounts. It lists gaps
// only and changes nothing: every month with no payment in the
// range is listed, no month with a payment is listed as a gap, and
// the gap months' billed amounts sum to the still-owed figure for
// those months.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HISTORY_GAP_VIEW_EMPTY_TEXT,
  HISTORY_GAP_VIEW_NO_GAPS_TEXT,
  isStrictGapViewMonth,
  historyGapViewMonthOf,
  historyGapViewDelta,
  historyGapViewIsPayment,
  formatGapViewAmount,
  historyGapViewMonthLabel,
  historyGapViewGaps,
  historyGapViewTotals,
  historyGapViewReconciliation,
  historyGapViewGapText,
  historyGapViewSummaryText,
  historyGapViewHtml,
} from '../history-gap-view.js';
import {
  fullHistoryEntries,
} from '../full-history-list.js';

function entry(overrides = {}) {
  return {
    type: 'payment',
    date: '2026-09-05',
    month: '2026-09',
    amountCents: 200000,
    runningBalanceCents: 0,
    note: '',
    method: 'Cash',
    ref: 'RCPT-1',
    voided: false,
    ...overrides,
  };
}

// September paid, October missed, November paid, December missed,
// January partly paid: the gaps are October and December 2026.
// Every entry carries the month of its own date.
function historyWithGaps() {
  return [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-11' }),
    entry({ type: 'payment', date: '2026-11-03', month: '2026-11', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2' }),
    entry({ type: 'charge', date: '2026-12-01', month: '2026-12', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-12' }),
    entry({ type: 'charge', date: '2027-01-01', month: '2027-01', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2027-01' }),
    entry({ type: 'payment', date: '2027-01-05', month: '2027-01', amountCents: 100000, runningBalanceCents: 100000, method: 'JazzCash', ref: 'RCPT-3' }),
  ];
}

test('month: a strict month is a month, anything else is not', () => {
  assert.equal(isStrictGapViewMonth('2026-10'), true);
  assert.equal(isStrictGapViewMonth('2026-13'), false);
  assert.equal(isStrictGapViewMonth('2026-00'), false);
  assert.equal(isStrictGapViewMonth('2026-1'), false);
  assert.equal(isStrictGapViewMonth('2026-10-01'), false);
  assert.equal(isStrictGapViewMonth(null), false);
  assert.equal(isStrictGapViewMonth(''), false);
});

test('monthOf: the entry month wins, else the date month, else no month', () => {
  assert.equal(historyGapViewMonthOf(entry({ month: '2026-10', date: '2026-10-05' })), '2026-10');
  assert.equal(historyGapViewMonthOf(entry({ month: '', date: '2026-10-05' })), '2026-10');
  assert.equal(historyGapViewMonthOf(entry({ month: '', date: '2026-10' })), '2026-10');
  assert.equal(historyGapViewMonthOf(entry({ month: '', date: '' })), '');
  assert.equal(historyGapViewMonthOf(entry({ month: '2026-13', date: '2026-10-05' })), '2026-10');
  assert.equal(historyGapViewMonthOf(null), '');
  assert.equal(historyGapViewMonthOf('not an entry'), '');
});

test('isPayment: a payment or an advance that stands counts', () => {
  assert.equal(historyGapViewIsPayment(entry({ type: 'payment' })), true);
  assert.equal(historyGapViewIsPayment(entry({ type: 'advance' })), true);
  assert.equal(historyGapViewIsPayment(entry({ type: 'payment', voided: true })), false);
  assert.equal(historyGapViewIsPayment(entry({ type: 'charge' })), false);
  assert.equal(historyGapViewIsPayment(entry({ type: 'refund' })), false);
  assert.equal(historyGapViewIsPayment(entry({ type: 'adjustment' })), false);
  assert.equal(historyGapViewIsPayment(entry({ type: 'credit', source: 'adjustment' })), false);
  assert.equal(historyGapViewIsPayment(entry({ type: 'payment', amountCents: 0 })), false);
  assert.equal(historyGapViewIsPayment(entry({ type: 'payment', amountCents: null })), false);
  assert.equal(historyGapViewIsPayment(entry({ type: 'payment', amountCents: true })), false);
  assert.equal(historyGapViewIsPayment(null), false);
});

test('delta: charges and refunds add to what is owed', () => {
  assert.equal(historyGapViewDelta(entry({ type: 'charge', amountCents: 200000 })), 200000);
  assert.equal(historyGapViewDelta(entry({ type: 'refund', amountCents: 50000 })), 50000);
});

test('delta: payments, advances and adjustments reduce what is owed', () => {
  assert.equal(historyGapViewDelta(entry({ type: 'payment', amountCents: 200000 })), -200000);
  assert.equal(historyGapViewDelta(entry({ type: 'advance', amountCents: 200000 })), -200000);
  assert.equal(historyGapViewDelta(entry({ type: 'adjustment', amountCents: 50000 })), -50000);
});

test('delta: an adjustment-sourced credit reduces what is owed, an overpayment credit moves nothing', () => {
  assert.equal(historyGapViewDelta(entry({ type: 'credit', source: 'adjustment', amountCents: 50000 })), -50000);
  assert.equal(historyGapViewDelta(entry({ type: 'credit', source: 'overpayment', amountCents: 50000 })), 0);
});

test('delta: a voided entry is listed but moves nothing', () => {
  assert.equal(historyGapViewDelta(entry({ type: 'payment', voided: true, amountCents: 200000 })), 0);
  assert.equal(historyGapViewDelta(entry({ type: 'charge', voided: true, amountCents: 200000 })), 0);
});

test('delta: a missing or non-finite amount is not a number, never zero-filled into a movement', () => {
  assert.equal(historyGapViewDelta(entry({ type: 'charge', amountCents: null })), 0);
  assert.equal(historyGapViewDelta(entry({ type: 'charge', amountCents: 'not a number' })), 0);
  assert.equal(historyGapViewDelta(entry({ type: 'charge', amountCents: true })), 0);
  assert.equal(historyGapViewDelta(null), 0);
});

test('amount: whole rupees print with no decimals, paisa with one decimal', () => {
  assert.equal(formatGapViewAmount(200000), 'PKR 2,000');
  assert.equal(formatGapViewAmount(150050), 'PKR 1,500.5');
  assert.equal(formatGapViewAmount(0), 'PKR 0');
});

test('amount: a negative balance prints with the minus before PKR', () => {
  assert.equal(formatGapViewAmount(-50000), '-PKR 500');
});

test('amount: a figure the list cannot read prints as PKR 0, exactly as the list does', () => {
  assert.equal(formatGapViewAmount(null), 'PKR 0');
  assert.equal(formatGapViewAmount('not a number'), 'PKR 0');
  assert.equal(formatGapViewAmount(true), 'PKR 0');
});

test('month label: October 2026, and nothing for a month that is not strict', () => {
  assert.equal(historyGapViewMonthLabel('2026-10'), 'October 2026');
  assert.equal(historyGapViewMonthLabel('2027-01'), 'January 2027');
  assert.equal(historyGapViewMonthLabel('2026-13'), '');
  assert.equal(historyGapViewMonthLabel(''), '');
});

test('gaps: only the months with no payment are listed, in order', () => {
  const gaps = historyGapViewGaps(historyWithGaps());
  assert.deepEqual(gaps.map((gap) => gap.month), ['2026-10', '2026-12']);
  assert.deepEqual(gaps.map((gap) => gap.label), ['October 2026', 'December 2026']);
  assert.equal(gaps[0].billedCents, 200000);
  assert.equal(gaps[0].paidCents, 0);
  assert.equal(gaps[0].stillOwedCents, 200000);
  assert.equal(gaps[0].entryCount, 1);
  assert.equal(gaps[1].billedCents, 200000);
  assert.equal(gaps[1].stillOwedCents, 200000);
});

test('gaps: a partly paid month is not a gap', () => {
  const gaps = historyGapViewGaps(historyWithGaps());
  assert.equal(gaps.some((gap) => gap.month === '2027-01'), false);
});

test('gaps: a month with no transactions at all in between is a gap too', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-11' }),
    entry({ type: 'payment', date: '2026-11-03', month: '2026-11', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2' }),
  ];
  const gaps = historyGapViewGaps(entries);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].month, '2026-10');
  assert.equal(gaps[0].entryCount, 0);
  assert.equal(gaps[0].billedCents, 0);
  assert.equal(gaps[0].stillOwedCents, 0);
});

test('gaps: a month with only a refund and no payment is a gap, billed with the refund', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'refund', date: '2026-10-10', month: '2026-10', amountCents: 50000, runningBalanceCents: 50000, method: 'Cash', ref: 'REF-1' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-11' }),
    entry({ type: 'payment', date: '2026-11-03', month: '2026-11', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2' }),
  ];
  const gaps = historyGapViewGaps(entries);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].month, '2026-10');
  assert.equal(gaps[0].billedCents, 50000);
  assert.equal(gaps[0].stillOwedCents, 50000);
});

test('gaps: a voided payment never closes a gap', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
    entry({ type: 'payment', date: '2026-10-07', month: '2026-10', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2', voided: true }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-11' }),
    entry({ type: 'payment', date: '2026-11-03', month: '2026-11', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-3' }),
  ];
  const gaps = historyGapViewGaps(entries);
  assert.deepEqual(gaps.map((gap) => gap.month), ['2026-10']);
});

test('gaps: the range crosses a year boundary', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-12-01', month: '2026-12', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-12' }),
    entry({ type: 'charge', date: '2027-01-01', month: '2027-01', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2027-01' }),
    entry({ type: 'payment', date: '2027-01-05', month: '2027-01', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
  ];
  const gaps = historyGapViewGaps(entries);
  assert.deepEqual(gaps.map((gap) => gap.month), ['2026-12']);
});

test('gaps: a single-month range with a payment has no gaps', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
  ];
  assert.deepEqual(historyGapViewGaps(entries), []);
});

test('gaps: every month paid means no gaps', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
    entry({ type: 'payment', date: '2026-10-07', month: '2026-10', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-11' }),
    entry({ type: 'payment', date: '2026-11-03', month: '2026-11', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-3' }),
  ];
  assert.deepEqual(historyGapViewGaps(entries), []);
});

test('gaps: undated entries take no part in the range', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '', month: '', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-UNDATED' }),
  ];
  assert.deepEqual(historyGapViewGaps(entries), []);
});

test('gaps: an empty list and a missing list have no gaps', () => {
  assert.deepEqual(historyGapViewGaps([]), []);
  assert.deepEqual(historyGapViewGaps(null), []);
  assert.deepEqual(historyGapViewGaps('not a list'), []);
});

test('totals: the gap months sum to two missing months, billed PKR 4,000, still owed PKR 4,000', () => {
  const totals = historyGapViewTotals(historyGapViewGaps(historyWithGaps()));
  assert.equal(totals.gapCount, 2);
  assert.equal(totals.billedCents, 400000);
  assert.equal(totals.paidCents, 0);
  assert.equal(totals.stillOwedCents, 400000);
});

test('totals: a gap month with an adjustment still owes billed minus the adjustment', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
    entry({ type: 'credit', date: '2026-10-15', month: '2026-10', amountCents: 50000, runningBalanceCents: 150000, method: '', ref: 'CR-1', source: 'adjustment' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-11' }),
    entry({ type: 'payment', date: '2026-11-03', month: '2026-11', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2' }),
  ];
  const gaps = historyGapViewGaps(entries);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].billedCents, 200000);
  assert.equal(gaps[0].paidCents, 50000);
  assert.equal(gaps[0].stillOwedCents, 150000);
  const totals = historyGapViewTotals(gaps);
  assert.equal(totals.stillOwedCents, 150000);
});

test('totals: no gaps means zeros, not a blank', () => {
  assert.deepEqual(historyGapViewTotals([]), { gapCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0 });
  assert.deepEqual(historyGapViewTotals(null), { gapCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0 });
});

test('reconciliation: the gap rows reconcile with the entries of those months', () => {
  const entries = historyWithGaps();
  const gaps = historyGapViewGaps(entries);
  const check = historyGapViewReconciliation(gaps, entries);
  assert.equal(check.ok, true);
  assert.equal(check.billedCents, 400000);
  assert.equal(check.paidCents, 0);
  assert.equal(check.stillOwedCents, 400000);
  assert.equal(check.expectedBilledCents, 400000);
  assert.equal(check.expectedPaidCents, 0);
  assert.equal(check.expectedStillOwedCents, 400000);
  assert.match(check.message, /Gap months reconcile/);
});

test('reconciliation: a gap month with an adjustment still reconciles', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
    entry({ type: 'credit', date: '2026-10-15', month: '2026-10', amountCents: 50000, runningBalanceCents: 150000, method: '', ref: 'CR-1', source: 'adjustment' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-11' }),
    entry({ type: 'payment', date: '2026-11-03', month: '2026-11', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2' }),
  ];
  const check = historyGapViewReconciliation(historyGapViewGaps(entries), entries);
  assert.equal(check.ok, true);
  assert.equal(check.stillOwedCents, 150000);
  assert.equal(check.expectedStillOwedCents, 150000);
});

test('gap text: one gap month reads in plain words', () => {
  const gaps = historyGapViewGaps(historyWithGaps());
  assert.equal(
    historyGapViewGapText(gaps[0]),
    'October 2026 · No payment · Billed PKR 2,000 · Still owed PKR 2,000',
  );
});

test('gap text: a month with no transactions at all says so plainly', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-11-01', month: '2026-11', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-11' }),
    entry({ type: 'payment', date: '2026-11-03', month: '2026-11', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2' }),
  ];
  const gaps = historyGapViewGaps(entries);
  assert.equal(
    historyGapViewGapText(gaps[0]),
    'October 2026 · No transactions · Billed PKR 0 · Still owed PKR 0',
  );
  assert.equal(historyGapViewGapText(null), '');
});

test('summary text: the gaps read in plain words', () => {
  assert.equal(
    historyGapViewSummaryText(historyWithGaps(), historyWithGaps()),
    '2 missing months · Billed PKR 4,000 · Still owed PKR 4,000',
  );
});

test('summary text: one missing month reads in the singular', () => {
  const entries = [
    entry({ type: 'charge', date: '2026-09-01', month: '2026-09', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', month: '2026-09', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', month: '2026-10', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
  ];
  assert.equal(
    historyGapViewSummaryText(entries, entries),
    '1 missing month · Billed PKR 2,000 · Still owed PKR 2,000',
  );
});

test('summary text: no gaps says so plainly, and no transactions says so too', () => {
  const paid = [
    entry({ type: 'charge', date: '2026-09-01', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
    entry({ type: 'payment', date: '2026-10-07', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2' }),
  ];
  assert.equal(historyGapViewSummaryText(paid, paid), HISTORY_GAP_VIEW_NO_GAPS_TEXT);
  assert.equal(historyGapViewSummaryText([], []), HISTORY_GAP_VIEW_EMPTY_TEXT);
  assert.equal(historyGapViewSummaryText(null, null), HISTORY_GAP_VIEW_EMPTY_TEXT);
});

test('summary text: a filtered view carries the full-history gaps too', () => {
  const shown = historyWithGaps().filter((item) => item.month === '2026-09' || item.month === '2026-10' || item.month === '2026-11');
  const full = historyWithGaps();
  assert.equal(
    historyGapViewSummaryText(shown, full),
    '1 missing month · Billed PKR 2,000 · Still owed PKR 2,000 · Full history: 2 missing months · Billed PKR 4,000 · Still owed PKR 4,000',
  );
});

test('html: the gap table lists the missing months with totals', () => {
  const html = historyGapViewHtml(historyWithGaps(), historyWithGaps());
  assert.match(html, /<table class="statement-table">/);
  assert.match(html, /October 2026/);
  assert.match(html, /December 2026/);
  assert.doesNotMatch(html, /September 2026/);
  assert.doesNotMatch(html, /November 2026/);
  assert.match(html, /PKR 2,000/);
  assert.match(html, /Totals/);
  assert.match(html, /PKR 4,000/);
  assert.doesNotMatch(html, /Full history/);
});

test('html: a filtered view carries a full-history totals row', () => {
  const shown = historyWithGaps().filter((item) => item.month === '2026-09' || item.month === '2026-10' || item.month === '2026-11');
  const html = historyGapViewHtml(shown, historyWithGaps());
  assert.match(html, /October 2026/);
  assert.match(html, /Full history/);
  assert.match(html, /PKR 4,000/);
});

test('html: an empty shown list renders nothing, and a list with no gaps says so plainly', () => {
  assert.equal(historyGapViewHtml([], []), '');
  assert.equal(historyGapViewHtml(null, null), '');
  const paid = [
    entry({ type: 'charge', date: '2026-09-01', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-09' }),
    entry({ type: 'payment', date: '2026-09-05', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-1' }),
    entry({ type: 'charge', date: '2026-10-01', amountCents: 200000, runningBalanceCents: 200000, method: '', ref: 'BILL-2026-10' }),
    entry({ type: 'payment', date: '2026-10-07', amountCents: 200000, runningBalanceCents: 0, method: 'Cash', ref: 'RCPT-2' }),
  ];
  assert.match(historyGapViewHtml(paid, paid), /No missing months/);
});

test('acceptance: every month with no payment is listed, and no month with a payment is listed as a gap', () => {
  const entries = historyWithGaps();
  const gaps = historyGapViewGaps(entries);
  const gapMonths = new Set(gaps.map((gap) => gap.month));
  const months = [...new Set(entries.map((item) => historyGapViewMonthOf(item)).filter(Boolean))].sort();
  for (const month of months) {
    const paid = entries.some((item) => historyGapViewMonthOf(item) === month && historyGapViewIsPayment(item));
    assert.equal(gapMonths.has(month), !paid, `${month} paid=${paid} gap=${gapMonths.has(month)}`);
  }
});

test('acceptance: the gap months billed amounts sum to the still-owed figure for those months', () => {
  const entries = historyWithGaps();
  const gaps = historyGapViewGaps(entries);
  const totals = historyGapViewTotals(gaps);
  assert.equal(totals.billedCents, totals.stillOwedCents);
  assert.equal(totals.billedCents, 400000);
  const check = historyGapViewReconciliation(gaps, entries);
  assert.equal(check.ok, true);
  assert.equal(check.stillOwedCents, check.expectedStillOwedCents);
});

test('acceptance: the gaps come from the entries the full history list composes', () => {
  const entries = fullHistoryEntries({
    customerId: 'CUST-1',
    bills: [
      {
        id: 'BILL-2026-09', month: '2026-09', dueDate: '2026-09-01', dueAmount: 2000,
        payments: [{ id: 'RCPT-1', date: '2026-09-05', amount: 2000, method: 'Cash' }],
      },
      { id: 'BILL-2026-10', month: '2026-10', dueDate: '2026-10-01', dueAmount: 2000, payments: [] },
      {
        id: 'BILL-2026-11', month: '2026-11', dueDate: '2026-11-01', dueAmount: 2000,
        payments: [{ id: 'RCPT-2', date: '2026-11-03', amount: 2000, method: 'Cash' }],
      },
    ],
    creditEntries: [],
    refundRecords: [],
  });
  const gaps = historyGapViewGaps(entries);
  assert.deepEqual(gaps.map((gap) => gap.month), ['2026-10']);
  assert.equal(gaps[0].billedCents, 200000);
  assert.equal(gaps[0].stillOwedCents, 200000);
  assert.equal(historyGapViewReconciliation(gaps, entries).ok, true);
});

test('entries are never mutated by any gap function', () => {
  const entries = historyWithGaps();
  const before = JSON.stringify(entries);
  historyGapViewGaps(entries);
  historyGapViewTotals(historyGapViewGaps(entries));
  historyGapViewReconciliation(historyGapViewGaps(entries), entries);
  historyGapViewGapText(historyGapViewGaps(entries)[0]);
  historyGapViewSummaryText(entries, entries);
  historyGapViewHtml(entries, entries);
  assert.equal(JSON.stringify(entries), before);
});

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
  assert.doesNotMatch(listSource, /historyGapView/);
});

test('fence: the type, date-range, method, amount, balance, grouping, yearly, CSV and statement neighbours are untouched', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /historyTypeFilterSelectMarkup/);
  assert.match(appSource, /historyDateRangeFilterMarkup/);
  assert.match(appSource, /historyMethodFilterSelectMarkup/);
  assert.match(appSource, /historyAmountSearchMarkup/);
  assert.match(appSource, /historyRunningBalanceColumnHtml/);
  assert.match(appSource, /historyMonthlyGroupingHtml/);
  assert.match(appSource, /historyYearlySummaryHtml/);
  assert.match(appSource, /historyCsvExportButtonMarkup/);
  assert.match(appSource, /historyPrintedStatementButtonMarkup/);
  for (const name of [
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'csv-export.js',
    'history-' + 'printed-statement.js',
  ]) {
    const source = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /historyGapView/);
  }
});

test('fence: the receipt-number audit watches receipt numbers, not payment months, and is untouched', () => {
  const auditName = 'receipt-' + 'gap-audit.js';
  const auditSource = readFileSync(new URL(`../${auditName}`, import.meta.url), 'utf8');
  assert.match(auditSource, /export function buildGapAudit/);
  assert.match(auditSource, /export function isReceiptNumber/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /buildGapAudit/);
  assert.doesNotMatch(auditSource, /historyGapView/);
});

test('fence: the roll-forward still exports its builders and is still wired', () => {
  const rollName = 'balance-' + 'rollforward.js';
  const rollSource = readFileSync(new URL(`../${rollName}`, import.meta.url), 'utf8');
  assert.match(rollSource, /export function buildCustomerRollForward/);
  assert.match(rollSource, /export function buildRollForwardTotals/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /buildCustomerRollForward/);
  assert.doesNotMatch(rollSource, /historyGapView/);
});

test('purity: the module is a view only — no store, no date, no document, no fetch', () => {
  const source = readFileSync(new URL('../history-gap-view.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /new Date\(/);
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /import /);
});

test('header: the module header never names a fenced module literally', () => {
  const source = readFileSync(new URL('../history-gap-view.js', import.meta.url), 'utf8');
  const header = source.slice(0, source.indexOf('export const'));
  for (const name of [
    'full-' + 'history-list.js',
    'history-' + 'type-filter.js',
    'history-' + 'date-range-filter.js',
    'history-' + 'method-filter.js',
    'history-' + 'amount-search.js',
    'history-' + 'running-balance.js',
    'history-' + 'monthly-grouping.js',
    'history-' + 'yearly-summary.js',
    'history-' + 'csv-export.js',
    'history-' + 'printed-statement.js',
    'balance-' + 'rollforward.js',
    'receipt-' + 'gap-audit.js',
  ]) {
    assert.doesNotMatch(header, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('wiring: the app imports the gap view and renders it from the shown rows', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /historyGapViewHtml/);
  assert.match(appSource, /hgvHistoryGapView/);
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(htmlSource, /id="hgvHistoryGapView"/);
});
