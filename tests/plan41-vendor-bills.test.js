/**
 * plan41-vendor-bills.test.js — Plan 41: recurring vendor bill
 * schedule and due queue.
 * Pins:
 * - one vendor record per recurring bill (vendor, bill type,
 *   expected amount, due day); a schedule with no vendor, no bill
 *   type, or no usable due day is rejected, never stored
 *   half-formed; an unknown expected amount stays null, never a
 *   guessed zero; bad dates (2026-02-30) are rejected;
 * - each scheduled bill appears exactly once per month with its
 *   due date, the due day clamped to the month's length;
 * - marking one paid records the date and amount paid and clears
 *   it from the due queue; an unpaid bill past its due date stays
 *   visible as overdue until paid or operator-cancelled with a
 *   reason (cancelling without a reason is refused);
 * - this records and reminds only: the module holds no customer,
 *   payment-ledger, or money-movement field, and Plan 10's own
 *   snapshot is never rewritten.
 * Synthetic data only; no customer record or ledger figure is ever
 * changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidVendorDate,
  isValidVendorMonth,
  vendorDaysBetween,
  normalizeVendorSchedule,
  normalizeVendorSchedules,
  findVendorSchedule,
  upsertVendorSchedule,
  removeVendorSchedule,
  vendorDueDateForMonth,
  normalizeVendorOccurrence,
  buildMonthOccurrences,
  vendorOccurrenceDisplayStatus,
  markVendorOccurrencePaid,
  cancelVendorOccurrence,
  buildVendorDueQueue,
  vendorMonthOutflow,
  vendorBillsSummaryText,
  vendorBillsHtml,
  vendorBillsCsv,
  vendorBillsFilename,
} from '../vendor-bills.js';

const TODAY = '2026-11-10';

const upstream = {
  id: 'vb-1', vendor: 'Upstream ISP', billType: 'bandwidth',
  expectedAmount: 45000, dueDay: 5, note: '', active: true,
};
const rent = {
  id: 'vb-2', vendor: 'Shop Owner', billType: 'rent',
  expectedAmount: 12000, dueDay: 1, note: '', active: true,
};
const power = {
  id: 'vb-3', vendor: 'Electricity Dept', billType: 'electricity',
  expectedAmount: null, dueDay: 15, note: 'bill varies', active: true,
};
const schedules = [upstream, rent, power];

test('date and month validation rejects impossible dates', () => {
  assert.equal(isValidVendorDate('2026-11-10'), true);
  assert.equal(isValidVendorDate('2026-02-30'), false);
  assert.equal(isValidVendorDate('2026-02-29'), false);
  assert.equal(isValidVendorDate('2024-02-29'), true);
  assert.equal(isValidVendorDate('10-11-2026'), false);
  assert.equal(isValidVendorMonth('2026-11'), true);
  assert.equal(isValidVendorMonth('2026-13'), false);
  assert.equal(isValidVendorMonth('2026-11-10'), false);
});

test('day arithmetic counts whole days', () => {
  assert.equal(vendorDaysBetween('2026-11-01', '2026-11-10'), 9);
  assert.equal(vendorDaysBetween('2026-11-10', '2026-11-01'), -9);
  assert.equal(vendorDaysBetween('2026-11-10', '2026-02-30'), null);
});

test('schedule normalisation rejects half-formed rows', () => {
  assert.equal(normalizeVendorSchedule({ id: '', vendor: 'X', billType: 'rent', dueDay: 1 }), null);
  assert.equal(normalizeVendorSchedule({ id: 'a', vendor: '', billType: 'rent', dueDay: 1 }), null);
  assert.equal(normalizeVendorSchedule({ id: 'a', vendor: 'X', billType: '', dueDay: 1 }), null);
  assert.equal(normalizeVendorSchedule({ id: 'a', vendor: 'X', billType: 'rent', dueDay: 0 }), null);
  assert.equal(normalizeVendorSchedule({ id: 'a', vendor: 'X', billType: 'rent', dueDay: 32 }), null);
  assert.equal(normalizeVendorSchedule({ id: 'a', vendor: 'X', billType: 'rent', dueDay: 1.5 }), null);
  assert.equal(normalizeVendorSchedule({ id: 'a', vendor: 'X', billType: 'rent', dueDay: 1, expectedAmount: -5 }), null);
  assert.equal(normalizeVendorSchedule({ id: 'a', vendor: 'X', billType: 'rent', dueDay: 1, expectedAmount: 0 }), null);
  const ok = normalizeVendorSchedule({ id: 'a', vendor: ' X ', billType: ' rent ', dueDay: '15', expectedAmount: '12000', note: ' n ' });
  assert.deepEqual(ok, { id: 'a', vendor: 'X', billType: 'rent', expectedAmount: 12000, dueDay: 15, note: 'n', active: true });
  const unknown = normalizeVendorSchedule({ id: 'a', vendor: 'X', billType: 'rent', dueDay: 1 });
  assert.equal(unknown.expectedAmount, null);
});

test('upsert is last-wins per schedule and find/remove work', () => {
  const list = upsertVendorSchedule(schedules, { ...upstream, expectedAmount: 47000 });
  assert.equal(list.length, 3);
  assert.equal(findVendorSchedule(list, 'vb-1').expectedAmount, 47000);
  assert.equal(removeVendorSchedule(list, 'vb-1').length, 2);
  assert.equal(findVendorSchedule(list, 'missing'), null);
  assert.deepEqual(upsertVendorSchedule(schedules, { id: 'x', vendor: '', billType: 'rent', dueDay: 1 }), schedules);
});

test('due date clamps the due day to the month length', () => {
  assert.equal(vendorDueDateForMonth(31, '2026-02'), '2026-02-28');
  assert.equal(vendorDueDateForMonth(31, '2024-02'), '2024-02-29');
  assert.equal(vendorDueDateForMonth(31, '2026-04'), '2026-04-30');
  assert.equal(vendorDueDateForMonth(15, '2026-11'), '2026-11-15');
  assert.equal(vendorDueDateForMonth(0, '2026-11'), null);
  assert.equal(vendorDueDateForMonth(5, '2026-13'), null);
});

test('month occurrences list exactly one row per active schedule', () => {
  const rows = buildMonthOccurrences(schedules, [], '2026-11');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.scheduleId), ['vb-2', 'vb-1', 'vb-3']);
  assert.equal(rows[0].dueDate, '2026-11-01');
  assert.equal(rows[1].dueDate, '2026-11-05');
  assert.equal(rows.every((r) => r.status === 'unpaid'), true);
  assert.equal(buildMonthOccurrences(schedules, [], '2026-13').length, 0);
});

test('a stored paid occurrence still shows when its schedule is deactivated', () => {
  const stored = [{ scheduleId: 'vb-1', month: '2026-10', status: 'paid', paidDate: '2026-10-04', paidAmount: 45000, cancelReason: '' }];
  const rows = buildMonthOccurrences([{ ...upstream, active: false }, rent], stored, '2026-10');
  assert.equal(rows.find((r) => r.scheduleId === 'vb-1').status, 'paid');
  assert.equal(rows.find((r) => r.scheduleId === 'vb-2').status, 'unpaid');
});

test('occurrence normalisation rejects unknown status and bad paid dates', () => {
  assert.equal(normalizeVendorOccurrence({ scheduleId: 'vb-1', month: '2026-11', status: 'done' }), null);
  assert.equal(normalizeVendorOccurrence({ scheduleId: 'vb-1', month: '2026-11', status: 'paid', paidDate: '2026-02-30', paidAmount: 100 }), null);
  assert.equal(normalizeVendorOccurrence({ scheduleId: 'vb-1', month: '2026-11', status: 'paid', paidDate: '2026-11-04', paidAmount: -1 }), null);
  const ok = normalizeVendorOccurrence({ scheduleId: 'vb-1', month: '2026-11', status: 'paid', paidDate: '2026-11-04', paidAmount: '45000', cancelReason: '' });
  assert.equal(ok.paidAmount, 45000);
});

test('display status separates overdue, due-soon, and due', () => {
  const base = { scheduleId: 'vb-1', month: '2026-11', status: 'unpaid', dueDate: '2026-11-05' };
  assert.equal(vendorOccurrenceDisplayStatus({ ...base, status: 'paid' }, TODAY), 'paid');
  assert.equal(vendorOccurrenceDisplayStatus({ ...base, status: 'cancelled' }, TODAY), 'cancelled');
  assert.equal(vendorOccurrenceDisplayStatus(base, TODAY), 'overdue');
  assert.equal(vendorOccurrenceDisplayStatus({ ...base, dueDate: '2026-11-15' }, TODAY), 'due-soon');
  assert.equal(vendorOccurrenceDisplayStatus({ ...base, dueDate: '2026-11-25' }, TODAY), 'due');
  assert.equal(vendorOccurrenceDisplayStatus({ ...base, dueDate: '2026-11-17' }, TODAY, 7), 'due-soon');
  assert.equal(vendorOccurrenceDisplayStatus({ ...base, dueDate: '2026-11-18' }, TODAY, 7), 'due');
});

test('marking paid records date and amount and is refused twice', () => {
  const first = markVendorOccurrencePaid(schedules, [], 'vb-1', '2026-11', { paidDate: '2026-11-04', paidAmount: 45000, today: TODAY });
  assert.equal(first.applied, true);
  assert.equal(first.occurrences.length, 1);
  assert.equal(first.occurrences[0].status, 'paid');
  assert.equal(first.occurrences[0].paidDate, '2026-11-04');
  const second = markVendorOccurrencePaid(schedules, first.occurrences, 'vb-1', '2026-11', { paidDate: '2026-11-05', paidAmount: 45000, today: TODAY });
  assert.equal(second.applied, false);
  assert.deepEqual(second.occurrences, first.occurrences);
  const blankDate = markVendorOccurrencePaid(schedules, [], 'vb-2', '2026-11', { paidAmount: 12000, today: TODAY });
  assert.equal(blankDate.applied, true);
  assert.equal(blankDate.occurrences[0].paidDate, TODAY);
});

test('marking paid refuses unknown schedules, bad dates, and non-positive amounts', () => {
  assert.equal(markVendorOccurrencePaid(schedules, [], 'missing', '2026-11', { paidAmount: 100, today: TODAY }).applied, false);
  assert.equal(markVendorOccurrencePaid(schedules, [], 'vb-1', '2026-13', { paidAmount: 100, today: TODAY }).applied, false);
  assert.equal(markVendorOccurrencePaid(schedules, [], 'vb-1', '2026-11', { paidDate: '2026-02-30', paidAmount: 100, today: TODAY }).applied, false);
  assert.equal(markVendorOccurrencePaid(schedules, [], 'vb-1', '2026-11', { paidDate: '2026-11-04', paidAmount: 0, today: TODAY }).applied, false);
  assert.equal(markVendorOccurrencePaid(schedules, [], 'vb-1', '2026-11', { paidAmount: 100 }).applied, false);
});

test('cancelling needs a reason and cannot follow a payment', () => {
  assert.equal(cancelVendorOccurrence(schedules, [], 'vb-1', '2026-11', '').applied, false);
  assert.equal(cancelVendorOccurrence(schedules, [], 'vb-1', '2026-11', '  ').applied, false);
  const cancelled = cancelVendorOccurrence(schedules, [], 'vb-1', '2026-11', 'supplier waived it');
  assert.equal(cancelled.applied, true);
  assert.equal(cancelled.occurrences[0].status, 'cancelled');
  assert.equal(cancelled.occurrences[0].cancelReason, 'supplier waived it');
  const paid = markVendorOccurrencePaid(schedules, [], 'vb-1', '2026-11', { paidDate: '2026-11-04', paidAmount: 45000, today: TODAY });
  assert.equal(cancelVendorOccurrence(schedules, paid.occurrences, 'vb-1', '2026-11', 'too late').applied, false);
});

test('due queue keeps overdue bills first and drops paid and far-future rows', () => {
  const stored = [
    { scheduleId: 'vb-1', month: '2026-10', status: 'unpaid', paidDate: null, paidAmount: null, cancelReason: '' },
    { scheduleId: 'vb-2', month: '2026-11', status: 'paid', paidDate: '2026-11-01', paidAmount: 12000, cancelReason: '' },
  ];
  const queue = buildVendorDueQueue(schedules, stored, { today: TODAY, dueSoonDays: 7 });
  assert.equal(queue.some((r) => r.scheduleId === 'vb-2'), false);
  assert.equal(queue[0].scheduleId, 'vb-1');
  assert.equal(queue[0].displayStatus, 'overdue');
  assert.equal(queue[0].daysOverdue, 36);
  assert.ok(queue.some((r) => r.scheduleId === 'vb-3' && r.displayStatus === 'due-soon'));
  assert.equal(buildVendorDueQueue(schedules, stored, { today: 'not-a-date' }).length, 0);
});

test('an unpaid bill past its due date stays overdue until paid or cancelled', () => {
  const stored = [{ scheduleId: 'vb-2', month: '2026-10', status: 'unpaid', paidDate: null, paidAmount: null, cancelReason: '' }];
  const queue = buildVendorDueQueue(schedules, stored, { today: TODAY });
  const row = queue.find((r) => r.scheduleId === 'vb-2' && r.month === '2026-10');
  assert.equal(row.displayStatus, 'overdue');
  const paid = markVendorOccurrencePaid(schedules, stored, 'vb-2', '2026-10', { paidDate: TODAY, paidAmount: 12000, today: TODAY });
  assert.equal(buildVendorDueQueue(schedules, paid.occurrences, { today: TODAY }).some((r) => r.scheduleId === 'vb-2' && r.month === '2026-10'), false);
  const cancelled = cancelVendorOccurrence(schedules, stored, 'vb-2', '2026-10', 'shop closed');
  assert.equal(buildVendorDueQueue(schedules, cancelled.occurrences, { today: TODAY }).some((r) => r.scheduleId === 'vb-2' && r.month === '2026-10'), false);
});

test('month outflow totals expected, paid, and unpaid without folding unknowns to zero', () => {
  const stored = [{ scheduleId: 'vb-1', month: '2026-11', status: 'paid', paidDate: '2026-11-04', paidAmount: 45000, cancelReason: '' }];
  const outflow = vendorMonthOutflow(schedules, stored, '2026-11');
  assert.equal(outflow.expectedTotal, 57000);
  assert.equal(outflow.paidTotal, 45000);
  assert.equal(outflow.unpaidTotal, 12000);
  assert.equal(outflow.unknownAmountCount, 1);
  assert.equal(outflow.count, 3);
});

test('no money-movement, customer, or ledger field exists on a schedule or occurrence', () => {
  const schedule = normalizeVendorSchedule(upstream);
  assert.deepEqual(Object.keys(schedule).sort(), ['active', 'billType', 'dueDay', 'expectedAmount', 'id', 'note', 'vendor']);
  const occurrence = normalizeVendorOccurrence({ scheduleId: 'vb-1', month: '2026-11', status: 'paid', paidDate: '2026-11-04', paidAmount: 45000, cancelReason: '' });
  assert.deepEqual(Object.keys(occurrence).sort(), ['cancelReason', 'month', 'paidAmount', 'paidDate', 'scheduleId', 'status']);
});

test('summary, html, csv, and filename helpers', () => {
  const queue = buildVendorDueQueue(schedules, [], { today: TODAY });
  const outflow = vendorMonthOutflow(schedules, [], '2026-11');
  const summary = vendorBillsSummaryText(queue, outflow);
  assert.match(summary, /overdue/);
  assert.match(summary, /2026-11 expected vendor outgo 57000 PKR/);
  const html = vendorBillsHtml(queue, outflow);
  assert.match(html, /Upstream ISP/);
  assert.match(html, /data-vendor-pay="vb-1:2026-11"/);
  const escaped = vendorBillsHtml([{ scheduleId: 'vb-1', vendor: '<b>&</b>', billType: 'rent', month: '2026-11', dueDate: '2026-11-05', expectedAmount: 100, note: '', displayStatus: 'overdue', daysOverdue: 5, daysUntilDue: 0 }], null);
  assert.doesNotMatch(escaped, /<b>&<\/b>/);
  const csv = vendorBillsCsv(queue, outflow);
  assert.match(csv, /^vendor,bill_type,month,due_date,expected_amount,status,paid_date,paid_amount,cancel_reason/);
  assert.match(csv, /Upstream ISP,bandwidth,2026-11,2026-11-05,45000,unpaid/);
  assert.equal(vendorBillsFilename('2026-11'), 'vendor-bills-2026-11.csv');
  assert.equal(vendorBillsFilename('bad'), 'vendor-bills-month.csv');
});

test('normalisation never mutates its inputs', () => {
  const frozen = Object.freeze({ ...upstream, note: 'x' });
  const out = normalizeVendorSchedule(frozen);
  assert.equal(out.note, 'x');
  assert.equal(frozen.note, 'x');
  const list = [upstream];
  upsertVendorSchedule(list, { ...upstream, expectedAmount: 1 });
  assert.equal(list[0].expectedAmount, 45000);
});
