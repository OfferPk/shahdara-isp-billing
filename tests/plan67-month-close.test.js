/**
 * plan67-month-close.test.js — Plan 67: month-end close checklist
 * (ordered, ticked, never auto-closing).
 * Pins:
 * - the same six ordered steps for every month, ticked with a
 *   date and by whom, or waived with a reason;
 * - a month cannot be marked closed while a required step is
 *   unticked and unwaived, and the missing steps are named;
 * - ticking, waiving, closing, or reopening never changes any
 *   bill, payment, handover, or suspense record — the module
 *   holds no such field;
 * - a closed month can be reopened only with an owner-recorded
 *   reason (plus by and date); reopening without one, or
 *   reopening an open month, leaves the list unchanged;
 * - impossible dates (2026-02-30) are never stored as a date,
 *   and half-formed records are refused outright.
 * Synthetic data only; no ledger record is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOSE_STEPS,
  validCloseDate,
  validCloseMonth,
  normalizeMonthClose,
  normalizeMonthCloseList,
  findMonthClose,
  blankMonthClose,
  tickCloseStep,
  waiveCloseStep,
  untickCloseStep,
  closeReadiness,
  closeMonth,
  reopenMonth,
  removeMonthClose,
  monthCloseSummary,
  monthCloseSummaryText,
  monthCloseHtml,
  monthCloseCsv,
  monthCloseFilename,
} from '../month-close.js';

const MONTH = '2026-10';

function tickedRecord() {
  let list = [blankMonthClose(MONTH)];
  for (const step of CLOSE_STEPS) {
    list = tickCloseStep(list, { month: MONTH, stepId: step.id, date: '2026-10-31', by: 'Owner' });
  }
  return list;
}

test('strict dates and months, including impossible dates', () => {
  assert.equal(validCloseDate('2026-02-30'), false);
  assert.equal(validCloseDate('2026-02-28'), true);
  assert.equal(validCloseDate('2024-02-29'), true);
  assert.equal(validCloseDate('2026-13-01'), false);
  assert.equal(validCloseDate('31-10-2026'), false);
  assert.equal(validCloseMonth('2026-10'), true);
  assert.equal(validCloseMonth('2026-13'), false);
  assert.equal(validCloseMonth('2026-1'), false);
});

test('the same six ordered steps for every month', () => {
  assert.deepEqual(CLOSE_STEPS.map((step) => step.id), [
    'bills_raised',
    'handovers_closed',
    'suspense_reviewed',
    'wallet_reconciled',
    'vendor_bills_recorded',
    'owner_pack_prepared',
  ]);
  const record = blankMonthClose(MONTH);
  assert.equal(record.status, 'open');
  assert.ok(CLOSE_STEPS.every((step) => record.steps[step.id].state === 'pending'));
});

test('half-formed records are refused outright', () => {
  assert.equal(normalizeMonthClose(null), null);
  assert.equal(normalizeMonthClose({ month: '2026-13' }), null);
  assert.equal(normalizeMonthClose({ month: MONTH, steps: { bills_raised: { state: 'ticked', date: '', by: 'Owner' } } }), null);
  assert.equal(normalizeMonthClose({ month: MONTH, steps: { bills_raised: { state: 'ticked', date: '2026-10-31', by: '' } } }), null);
  assert.equal(normalizeMonthClose({ month: MONTH, steps: { bills_raised: { state: 'waived', date: '2026-10-31', by: 'Owner', reason: '' } } }), null);
  assert.equal(normalizeMonthClose({ month: MONTH, steps: { bills_raised: { state: 'waived', date: '2026-02-30', by: 'Owner', reason: 'No vendors' } } }), null);
  assert.equal(normalizeMonthClose({ month: MONTH, steps: { unknown_step: { state: 'ticked', date: '2026-10-31', by: 'Owner' } } }), null);
  assert.equal(normalizeMonthCloseList([blankMonthClose(MONTH), null, { month: 'bad' }]).length, 1);
});

test('tick and waive rules, including refusals that leave the list unchanged', () => {
  const base = [blankMonthClose(MONTH)];
  assert.equal(tickCloseStep(base, { month: MONTH, stepId: 'bills_raised', date: '2026-10-31', by: 'Owner' })[0].steps.bills_raised.state, 'ticked');
  assert.deepEqual(tickCloseStep(base, { month: MONTH, stepId: 'bills_raised', date: '', by: 'Owner' }), base);
  assert.deepEqual(tickCloseStep(base, { month: MONTH, stepId: 'bills_raised', date: '2026-10-31', by: '' }), base);
  assert.deepEqual(tickCloseStep(base, { month: MONTH, stepId: 'bills_raised', date: '2026-02-30', by: 'Owner' }), base);
  assert.deepEqual(tickCloseStep(base, { month: MONTH, stepId: 'nope', date: '2026-10-31', by: 'Owner' }), base);
  assert.deepEqual(tickCloseStep(base, { month: '2026-11', stepId: 'bills_raised', date: '2026-10-31', by: 'Owner' }), base);
  assert.equal(waiveCloseStep(base, { month: MONTH, stepId: 'vendor_bills_recorded', date: '2026-10-31', by: 'Owner', reason: 'No vendor bills this month' })[0].steps.vendor_bills_recorded.state, 'waived');
  assert.deepEqual(waiveCloseStep(base, { month: MONTH, stepId: 'vendor_bills_recorded', date: '2026-10-31', by: 'Owner', reason: '' }), base);
  const ticked = tickCloseStep(base, { month: MONTH, stepId: 'bills_raised', date: '2026-10-31', by: 'Owner' });
  assert.equal(untickCloseStep(ticked, { month: MONTH, stepId: 'bills_raised' })[0].steps.bills_raised.state, 'pending');
});

test('close gate names every missing step and refuses a partial month', () => {
  const base = [blankMonthClose(MONTH)];
  const readiness = closeReadiness(base[0]);
  assert.equal(readiness.canClose, false);
  assert.equal(readiness.missing.length, 6);
  assert.deepEqual(closeMonth(base, { month: MONTH, date: '2026-10-31', by: 'Owner' }), base);
  let list = tickCloseStep(base, { month: MONTH, stepId: 'bills_raised', date: '2026-10-31', by: 'Owner' });
  assert.equal(closeReadiness(list[0]).missing.length, 5);
  assert.equal(closeReadiness(list[0]).missing[0], 'All day handovers closed');
});

test('a fully ticked or waived month closes, and only once', () => {
  const list = tickedRecord();
  const closed = closeMonth(list, { month: MONTH, date: '2026-10-31', by: 'Owner' });
  assert.equal(closed[0].status, 'closed');
  assert.equal(closed[0].closedDate, '2026-10-31');
  assert.equal(closed[0].closedBy, 'Owner');
  assert.deepEqual(closeMonth(closed, { month: MONTH, date: '2026-11-01', by: 'Owner' }), closed);
  assert.deepEqual(tickCloseStep(closed, { month: MONTH, stepId: 'bills_raised', date: '2026-11-01', by: 'Owner' }), closed);
  assert.deepEqual(waiveCloseStep(closed, { month: MONTH, stepId: 'bills_raised', date: '2026-11-01', by: 'Owner', reason: 'x' }), closed);
  // A waived step counts toward closing, exactly like a ticked one.
  let waived = [blankMonthClose(MONTH)];
  for (const step of CLOSE_STEPS) {
    waived = step.id === 'vendor_bills_recorded'
      ? waiveCloseStep(waived, { month: MONTH, stepId: step.id, date: '2026-10-31', by: 'Owner', reason: 'No vendor bills this month' })
      : tickCloseStep(waived, { month: MONTH, stepId: step.id, date: '2026-10-31', by: 'Owner' });
  }
  assert.equal(closeMonth(waived, { month: MONTH, date: '2026-10-31', by: 'Owner' })[0].status, 'closed');
  // Close without a date or by is refused even when all steps are done.
  assert.deepEqual(closeMonth(list, { month: MONTH, date: '', by: 'Owner' }), list);
});

test('reopen needs a closed month plus a reason, by, and date', () => {
  const open = [blankMonthClose(MONTH)];
  assert.deepEqual(reopenMonth(open, { month: MONTH, reason: 'Found a gap', by: 'Owner', date: '2026-11-02' }), open);
  const closed = closeMonth(tickedRecord(), { month: MONTH, date: '2026-10-31', by: 'Owner' });
  assert.deepEqual(reopenMonth(closed, { month: MONTH, reason: '', by: 'Owner', date: '2026-11-02' }), closed);
  assert.deepEqual(reopenMonth(closed, { month: MONTH, reason: 'Found a gap', by: '', date: '2026-11-02' }), closed);
  assert.deepEqual(reopenMonth(closed, { month: MONTH, reason: 'Found a gap', by: 'Owner', date: '2026-02-30' }), closed);
  const reopened = reopenMonth(closed, { month: MONTH, reason: 'Suspense item found after close', by: 'Owner', date: '2026-11-02' });
  assert.equal(reopened[0].status, 'open');
  assert.equal(reopened[0].closedDate, '');
  assert.equal(reopened[0].reopenReason, 'Suspense item found after close');
  assert.equal(reopened[0].reopenedBy, 'Owner');
  assert.equal(reopened[0].reopenedDate, '2026-11-02');
  // Steps survive the reopen, so the month can be re-closed after fixing the gap.
  assert.equal(reopened[0].steps.bills_raised.state, 'ticked');
});

test('find, remove, and summary counts', () => {
  const list = tickedRecord();
  assert.equal(findMonthClose(list, MONTH).month, MONTH);
  assert.equal(findMonthClose(list, '2026-11'), null);
  assert.equal(findMonthClose(list, 'bad'), null);
  assert.deepEqual(removeMonthClose(list, MONTH), []);
  const summary = monthCloseSummary(list[0]);
  assert.deepEqual([summary.ticked, summary.waived, summary.pending, summary.total], [6, 0, 0, 6]);
  assert.equal(summary.canClose, true);
  assert.equal(monthCloseSummaryText(list[0]), '2026-10: 6 ticked, 0 waived, 0 pending of 6 steps.');
  const closedText = monthCloseSummaryText(closeMonth(list, { month: MONTH, date: '2026-10-31', by: 'Owner' })[0]);
  assert.equal(closedText, '2026-10 closed (6 ticked, 0 waived).');
  assert.equal(monthCloseSummary(null), null);
  assert.equal(monthCloseSummaryText(null), '');
});

test('no bill, payment, handover, or suspense field is ever held, and inputs are never mutated', () => {
  const snapshot = JSON.stringify([blankMonthClose(MONTH)]);
  const list = JSON.parse(snapshot);
  const next = tickCloseStep(list, { month: MONTH, stepId: 'bills_raised', date: '2026-10-31', by: 'Owner' });
  assert.equal(JSON.stringify(list), snapshot);
  assert.notEqual(next, list);
  // Field names only: the step id "handovers_closed" names a
  // checklist step, it is not a handover record.
  assert.deepEqual(Object.keys(next[0]).sort(), ['closedBy', 'closedDate', 'month', 'reopenReason', 'reopenedBy', 'reopenedDate', 'status', 'steps']);
  assert.deepEqual(Object.keys(next[0].steps.bills_raised).sort(), ['by', 'date', 'reason', 'state', 'stepId']);
});

test('HTML escaping, CSV quoting, and filenames', () => {
  const list = waiveCloseStep([blankMonthClose(MONTH)], {
    month: MONTH, stepId: 'vendor_bills_recorded', date: '2026-10-31', by: 'Owner <b>', reason: 'No "vendor" bills, none',
  });
  const html = monthCloseHtml(list[0]);
  assert.ok(html.includes('Owner &lt;b&gt;'));
  assert.ok(html.includes('Waived — No &quot;vendor&quot; bills, none'));
  assert.ok(html.includes('All bills raised'));
  assert.equal(monthCloseHtml(null), '');
  const csv = monthCloseCsv(list);
  assert.ok(csv.startsWith('Month,Status,Step,State,Date,By,Reason'));
  assert.ok(csv.includes('"No ""vendor"" bills, none"'));
  assert.equal(monthCloseFilename(MONTH), 'month-close-2026-10.csv');
  assert.equal(monthCloseFilename('bad'), 'month-close.csv');
  // One row per step, in fixed step order.
  assert.equal(csv.split('\n').length, 7);
  assert.ok(csv.indexOf('All bills raised') < csv.indexOf('Owner pack prepared'));
});
