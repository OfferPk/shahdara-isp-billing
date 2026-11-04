import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validVisitDate,
  VISIT_DAY_PARTS,
  VISIT_SCHEDULE_STATUSES,
  normalizeVisitSchedule,
  normalizeVisitScheduleList,
  upsertVisitSchedule,
  removeVisitSchedule,
  findVisitSchedule,
  dayPartSchedule,
  doubleBookingFlags,
  missedVisits,
  markVisitDone,
  markVisitMissed,
  rescheduleVisit,
  visitScheduleSummaryText,
  visitScheduleHtml,
  visitScheduleCsv,
  visitScheduleFilename,
} from '../visit-day-part.js';

const rec = (over = {}) => ({
  id: 'VS-1',
  customer: 'Ahmed',
  collector: 'Saad',
  date: '2026-11-05',
  dayPart: 'morning',
  jobType: 'New connection',
  status: 'booked',
  note: '',
  ...over,
});

test('strict dates: real values pass, impossible values refused', () => {
  assert.equal(validVisitDate('2026-11-05'), '2026-11-05');
  assert.equal(validVisitDate('2026-08-31'), '2026-08-31');
  assert.equal(validVisitDate('2026-10-31'), '2026-10-31');
  assert.equal(validVisitDate('2026-12-31'), '2026-12-31');
  assert.equal(validVisitDate('2024-02-29'), '2024-02-29');
  assert.equal(validVisitDate('2026-02-30'), null);
  assert.equal(validVisitDate('2026-04-31'), null);
  assert.equal(validVisitDate('2026-09-31'), null);
  assert.equal(validVisitDate('2026-11-31'), null);
  assert.equal(validVisitDate('2026-13-01'), null);
  assert.equal(validVisitDate('05-11-2026'), null);
  assert.equal(validVisitDate(''), null);
  assert.equal(validVisitDate(null), null);
});

test('catalogues: three day parts in day order, four statuses', () => {
  assert.deepEqual([...VISIT_DAY_PARTS], ['morning', 'afternoon', 'evening']);
  assert.deepEqual([...VISIT_SCHEDULE_STATUSES], ['booked', 'done', 'missed', 'rescheduled']);
});

test('half-formed bookings refused, unknown fields dropped', () => {
  assert.equal(normalizeVisitSchedule(rec({ id: '' })), null);
  assert.equal(normalizeVisitSchedule(rec({ customer: '  ' })), null);
  assert.equal(normalizeVisitSchedule(rec({ date: '2026-02-30' })), null);
  assert.equal(normalizeVisitSchedule(rec({ dayPart: 'night' })), null);
  assert.equal(normalizeVisitSchedule(rec({ dayPart: 'Morning' })), null);
  assert.equal(normalizeVisitSchedule(rec({ jobType: '' })), null);
  assert.equal(normalizeVisitSchedule(null), null);
  assert.equal(normalizeVisitSchedule('VS-1'), null);
  const kept = normalizeVisitSchedule(rec({ paymentAmount: 5000, billId: 'B-9' }));
  assert.equal(kept.paymentAmount, undefined);
  assert.equal(kept.billId, undefined);
  assert.equal(kept.customer, 'Ahmed');
});

test('status: missing defaults to booked, unknown refused', () => {
  const { status, ...noStatus } = rec();
  assert.equal(normalizeVisitSchedule(noStatus).status, 'booked');
  assert.equal(normalizeVisitSchedule(rec({ status: 'pending' })), null);
  assert.equal(normalizeVisitSchedule(rec({ status: 'done' })).status, 'done');
});

test('duplicate id never rewritten', () => {
  const first = upsertVisitSchedule([], rec());
  const identical = upsertVisitSchedule(first, rec());
  assert.deepEqual(identical, first);
  const changed = upsertVisitSchedule(first, rec({ dayPart: 'evening' }));
  assert.deepEqual(changed, first);
  assert.equal(first.length, 1);
  assert.equal(first[0].dayPart, 'morning');
});

test('day-part list: booked only, day-part order then customer A-Z', () => {
  const list = [
    rec({ id: 'VS-3', customer: 'Bilal', dayPart: 'evening' }),
    rec({ id: 'VS-1', customer: 'Zain', dayPart: 'morning' }),
    rec({ id: 'VS-2', customer: 'Ahmed', dayPart: 'morning' }),
    rec({ id: 'VS-4', customer: 'Ahmed', dayPart: 'morning', status: 'done' }),
    rec({ id: 'VS-5', customer: 'Ahmed', dayPart: 'morning', status: 'missed' }),
    rec({ id: 'VS-6', customer: 'Ahmed', date: '2026-11-06', dayPart: 'morning' }),
  ];
  const rows = dayPartSchedule(list, '2026-11-05');
  assert.deepEqual(rows.map((r) => r.id), ['VS-2', 'VS-1', 'VS-3']);
  assert.deepEqual(dayPartSchedule(list, '2026-11-05', 'morning').map((r) => r.id), ['VS-2', 'VS-1']);
  assert.deepEqual(dayPartSchedule(list, '2026-11-05', 'all').map((r) => r.id), ['VS-2', 'VS-1', 'VS-3']);
  assert.deepEqual(dayPartSchedule(list, '2026-11-05', 'night'), []);
  assert.deepEqual(dayPartSchedule(list, '2026-02-30'), []);
  assert.deepEqual(dayPartSchedule(list, '2026-11-07'), []);
});

test('double-booking flagged, never silently blocked or hidden', () => {
  const list = [
    rec({ id: 'VS-1', customer: 'Ahmed', date: '2026-11-05', dayPart: 'morning' }),
    rec({ id: 'VS-2', customer: 'Bilal', date: '2026-11-05', dayPart: 'morning' }),
    rec({ id: 'VS-3', customer: 'Chand', date: '2026-11-05', dayPart: 'afternoon' }),
    rec({ id: 'VS-4', customer: 'Danish', date: '2026-11-05', dayPart: 'morning', collector: 'Nasir' }),
    rec({ id: 'VS-5', customer: 'Ehsan', date: '2026-11-05', dayPart: 'morning', collector: '' }),
    rec({ id: 'VS-6', customer: 'Faraz', date: '2026-11-05', dayPart: 'morning', collector: '' }),
    rec({ id: 'VS-7', customer: 'Gul', date: '2026-11-05', dayPart: 'morning', status: 'done' }),
  ];
  // Recording the clash is allowed: the booking is not refused.
  const stored = list.reduce((acc, item) => upsertVisitSchedule(acc, item), []);
  assert.equal(stored.length, 7);
  const flags = doubleBookingFlags(stored);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].collector, 'Saad');
  assert.equal(flags[0].date, '2026-11-05');
  assert.equal(flags[0].dayPart, 'morning');
  assert.deepEqual(flags[0].visitIds, ['VS-1', 'VS-2']);
  const rows = dayPartSchedule(stored, '2026-11-05', 'morning');
  assert.equal(rows.find((r) => r.id === 'VS-1').doubleBooked, true);
  assert.equal(rows.find((r) => r.id === 'VS-2').doubleBooked, true);
  assert.equal(rows.find((r) => r.id === 'VS-4').doubleBooked, false);
  assert.equal(rows.find((r) => r.id === 'VS-5').doubleBooked, false);
});

test('missed visits stay visible for rebooking, oldest first', () => {
  const list = [
    rec({ id: 'VS-1', customer: 'Bilal', date: '2026-11-06', dayPart: 'evening', status: 'missed' }),
    rec({ id: 'VS-2', customer: 'Ahmed', date: '2026-11-05', dayPart: 'afternoon', status: 'missed' }),
    rec({ id: 'VS-3', customer: 'Chand', date: '2026-11-05', dayPart: 'morning', status: 'missed' }),
    rec({ id: 'VS-4', customer: 'Danish', date: '2026-11-04', dayPart: 'morning', status: 'booked' }),
    rec({ id: 'VS-5', customer: 'Ehsan', date: '2026-11-03', dayPart: 'morning', status: 'done' }),
  ];
  assert.deepEqual(missedVisits(list).map((r) => r.id), ['VS-3', 'VS-2', 'VS-1']);
});

test('status moves: booked to done or missed, done is terminal', () => {
  const list = upsertVisitSchedule([], rec());
  const done = markVisitDone(list, 'VS-1');
  assert.equal(done[0].status, 'done');
  assert.deepEqual(markVisitMissed(done, 'VS-1'), done);
  assert.deepEqual(markVisitDone(done, 'VS-1'), done);
  assert.deepEqual(markVisitDone(list, 'VS-9'), list);
  const missed = markVisitMissed(list, 'VS-1');
  assert.equal(missed[0].status, 'missed');
  assert.deepEqual(markVisitDone(missed, 'VS-1'), missed);
});

test('reschedule keeps history and carries the visit forward', () => {
  const list = upsertVisitSchedule([], rec());
  const next = rescheduleVisit(list, 'VS-1', { newId: 'VS-2', newDate: '2026-11-07', newDayPart: 'afternoon' });
  assert.equal(next.length, 2);
  const original = next.find((r) => r.id === 'VS-1');
  const carried = next.find((r) => r.id === 'VS-2');
  assert.equal(original.status, 'rescheduled');
  assert.equal(original.date, '2026-11-05');
  assert.equal(original.dayPart, 'morning');
  assert.equal(carried.status, 'booked');
  assert.equal(carried.date, '2026-11-07');
  assert.equal(carried.dayPart, 'afternoon');
  assert.equal(carried.customer, 'Ahmed');
  assert.equal(carried.collector, 'Saad');
  assert.equal(carried.jobType, 'New connection');
  // A missed visit rebooks the same way.
  const missed = markVisitMissed(list, 'VS-1');
  const rebooked = rescheduleVisit(missed, 'VS-1', { newId: 'VS-3', newDate: '2026-11-08', newDayPart: 'evening' });
  assert.equal(rebooked.find((r) => r.id === 'VS-3').status, 'booked');
  // Refusals leave the list unchanged.
  assert.deepEqual(rescheduleVisit(list, 'VS-1', { newId: 'VS-1', newDate: '2026-11-07', newDayPart: 'afternoon' }), list);
  assert.deepEqual(rescheduleVisit(list, 'VS-1', { newId: 'VS-9', newDate: '2026-02-30', newDayPart: 'afternoon' }), list);
  assert.deepEqual(rescheduleVisit(list, 'VS-1', { newId: 'VS-9', newDate: '2026-11-07', newDayPart: 'night' }), list);
  assert.deepEqual(rescheduleVisit(list, 'VS-1', { newDate: '2026-11-07', newDayPart: 'afternoon' }), list);
  assert.deepEqual(rescheduleVisit(list, 'VS-9', { newId: 'VS-9', newDate: '2026-11-07', newDayPart: 'afternoon' }), list);
  const done = markVisitDone(list, 'VS-1');
  assert.deepEqual(rescheduleVisit(done, 'VS-1', { newId: 'VS-9', newDate: '2026-11-07', newDayPart: 'afternoon' }), done);
  const already = rescheduleVisit(list, 'VS-1', { newId: 'VS-2', newDate: '2026-11-07', newDayPart: 'afternoon' });
  assert.deepEqual(rescheduleVisit(already, 'VS-1', { newId: 'VS-9', newDate: '2026-11-09', newDayPart: 'morning' }), already);
});

test('remove and find', () => {
  const list = upsertVisitSchedule(upsertVisitSchedule([], rec()), rec({ id: 'VS-2', customer: 'Bilal' }));
  assert.equal(findVisitSchedule(list, 'VS-2').customer, 'Bilal');
  assert.equal(findVisitSchedule(list, 'VS-9'), null);
  assert.equal(removeVisitSchedule(list, 'VS-1').length, 1);
  assert.deepEqual(removeVisitSchedule(list, 'VS-9'), list);
});

test('inputs never mutated', () => {
  const first = [rec(), rec({ id: 'VS-2', customer: 'Bilal', dayPart: 'evening' })];
  const frozen = JSON.parse(JSON.stringify(first));
  const second = upsertVisitSchedule(first, rec({ id: 'VS-3', customer: 'Chand' }));
  assert.deepEqual(first, frozen);
  const rescheduled = rescheduleVisit(second, 'VS-1', { newId: 'VS-4', newDate: '2026-11-07', newDayPart: 'afternoon' });
  assert.deepEqual(second, JSON.parse(JSON.stringify(second)));
  assert.equal(rescheduled.find((r) => r.id === 'VS-1').status, 'rescheduled');
  assert.equal(second.find((r) => r.id === 'VS-1').status, 'booked');
});

test('summary, HTML escaping, CSV quoting', () => {
  assert.equal(visitScheduleSummaryText([]), 'No visit booked.');
  const list = [
    rec({ id: 'VS-1' }),
    rec({ id: 'VS-2', customer: 'Bilal', dayPart: 'morning' }),
    rec({ id: 'VS-3', customer: 'Chand', dayPart: 'morning', status: 'missed' }),
  ];
  assert.match(visitScheduleSummaryText(list), /3 visit bookings; 2 booked, 1 missed\./);
  assert.match(visitScheduleSummaryText(list), /1 double-booked clash flagged\./);
  const html = visitScheduleHtml([rec({ customer: '<b>Ahmed</b>', note: 'x' })]);
  assert.doesNotMatch(html, /<b>Ahmed<\/b>/);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /Morning/);
  const clashHtml = visitScheduleHtml(list);
  assert.match(clashHtml, /DOUBLE-BOOKED/);
  const csv = visitScheduleCsv([rec({ note: 'has, comma' })]);
  assert.match(csv, /^id,customer,collector,date,day_part,job_type,status,note\n/);
  assert.match(csv, /"has, comma"/);
  assert.equal(visitScheduleFilename(), 'visit-day-part-schedule.csv');
});

test('normalize list drops half-formed rows', () => {
  const list = normalizeVisitScheduleList([rec(), rec({ id: 'VS-2', date: '2026-02-30' }), null, 'junk']);
  assert.deepEqual(list.map((r) => r.id), ['VS-1']);
});

test('purity fence: module is import-free and names no other record system', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(dir, '..', 'visit-day-part.js'), 'utf8');
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /localStorage|document\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /visitOutcome|dispatchQueue|saadVisit|preferredVisitWindow|complaintTicket|fieldDispatch|ticketStore/);
});

test('panel ids present in index.html', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['visitBody', 'visitSummary', 'visitCustomer', 'visitCollector', 'visitDate', 'visitDayPart', 'visitJobType', 'visitSaveBtn', 'visitListDate', 'visitListPart', 'visitMissedBody', 'visitDoneId', 'visitDoneBtn', 'visitMissedId', 'visitMissedBtn', 'visitReschedId', 'visitReschedDate', 'visitReschedPart', 'visitReschedBtn', 'visitRemoveId', 'visitRemoveBtn', 'visitExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
