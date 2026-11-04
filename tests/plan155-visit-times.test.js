import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeVisitTime,
  normalizeVisitTimeList,
  findVisitTime,
  upsertVisitTime,
  removeVisitTime,
  travelMinutes,
  visitMinutes,
  visitTimesForDate,
  routeDayTotals,
  allRouteDayTotals,
  formatMinutes,
  visitTimeSummaryText,
  visitTimeAllHtml,
  routeDayHtml,
  routeDayTotalsHtml,
  visitTimeCsv,
  visitTimeFilename,
} from '../visit-times.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'T-1',
  visitId: 'V-101',
  date: '2026-11-04',
  departureTime: '09:00',
  arrivalTime: '09:40',
  finishTime: '10:10',
  travelNote: 'Mohalla A to Mohalla B',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(normalizeVisitTime(record({ date: '2026-08-31' })).date, '2026-08-31');
  assert.equal(normalizeVisitTime(record({ date: '2026-10-31' })).date, '2026-10-31');
  assert.equal(normalizeVisitTime(record({ date: '2026-12-31' })).date, '2026-12-31');
  assert.equal(normalizeVisitTime(record({ date: '2024-02-29' })).date, '2024-02-29');
  assert.equal(normalizeVisitTime(record({ date: '2026-02-30' })), null);
  assert.equal(normalizeVisitTime(record({ date: '2026-04-31' })), null);
  assert.equal(normalizeVisitTime(record({ date: '2026-09-31' })), null);
  assert.equal(normalizeVisitTime(record({ date: '2026-11-31' })), null);
  assert.equal(normalizeVisitTime(record({ date: '2026-02-29' })), null);
});

test('strict times: real HH:MM pass, impossible times refused', () => {
  assert.equal(normalizeVisitTime(record({ departureTime: '00:00', arrivalTime: '00:00', finishTime: '00:00' })).departureTime, '00:00');
  assert.equal(normalizeVisitTime(record({ departureTime: '23:00', arrivalTime: '23:30', finishTime: '23:59' })).finishTime, '23:59');
  assert.equal(normalizeVisitTime(record({ departureTime: '24:00' })), null);
  assert.equal(normalizeVisitTime(record({ arrivalTime: '12:60' })), null);
  assert.equal(normalizeVisitTime(record({ finishTime: '9:30' })), null);
  assert.equal(normalizeVisitTime(record({ departureTime: 'abc' })), null);
});

test('half-formed refusal: missing id, visit link, date, or any time', () => {
  assert.equal(normalizeVisitTime(record({ id: '' })), null);
  assert.equal(normalizeVisitTime(record({ visitId: '  ' })), null);
  assert.equal(normalizeVisitTime(record({ date: '' })), null);
  assert.equal(normalizeVisitTime(record({ departureTime: '' })), null);
  assert.equal(normalizeVisitTime(record({ arrivalTime: '' })), null);
  assert.equal(normalizeVisitTime(record({ finishTime: '' })), null);
  assert.equal(normalizeVisitTime({}), null);
  assert.equal(normalizeVisitTime(null), null);
});

test('impossible ordering refused: finish before arrival, arrival before departure', () => {
  assert.equal(normalizeVisitTime(record({ arrivalTime: '10:10', finishTime: '10:00' })), null);
  assert.equal(normalizeVisitTime(record({ departureTime: '09:50', arrivalTime: '09:40' })), null);
});

test('equal times pass: zero travel and zero visit are real measurements', () => {
  const clean = normalizeVisitTime(record({ departureTime: '09:00', arrivalTime: '09:00', finishTime: '09:00' }));
  assert.ok(clean);
  assert.equal(travelMinutes(clean), 0);
  assert.equal(visitMinutes(clean), 0);
});

test('unknown fields dropped, never stored', () => {
  const clean = normalizeVisitTime(record({ outcome: 'done', billId: 'B-1', payment: 500 }));
  assert.ok(clean);
  assert.equal('outcome' in clean, false);
  assert.equal('billId' in clean, false);
  assert.equal('payment' in clean, false);
});

test('duplicate ids never rewritten', () => {
  const list = [record()];
  const same = upsertVisitTime(list, record());
  assert.equal(same.length, 1);
  const changed = upsertVisitTime(list, record({ finishTime: '11:00' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].finishTime, '10:10');
});

test('find and remove by id', () => {
  const list = [record(), record({ id: 'T-2', visitId: 'V-102' })];
  assert.equal(findVisitTime(list, 'T-2').visitId, 'V-102');
  assert.equal(findVisitTime(list, 'nope'), null);
  assert.equal(removeVisitTime(list, 'T-1').length, 1);
  assert.equal(removeVisitTime(list, 'nope').length, 2);
});

test('travel and visit minutes computed from the three times', () => {
  assert.equal(travelMinutes(record()), 40);
  assert.equal(visitMinutes(record()), 30);
  assert.equal(travelMinutes(record({ departureTime: '08:15', arrivalTime: '09:05' })), 50);
  assert.equal(travelMinutes(null), null);
});

test('route-day records ordered by departure then id; invalid date gives empty list', () => {
  const list = [
    record({ id: 'T-3', departureTime: '11:00', arrivalTime: '11:20', finishTime: '11:50' }),
    record({ id: 'T-1', departureTime: '09:00', arrivalTime: '09:40', finishTime: '10:10' }),
    record({ id: 'T-2', date: '2026-11-05', departureTime: '09:00', arrivalTime: '09:10', finishTime: '09:30' }),
    record({ id: 'T-4', departureTime: '09:00', arrivalTime: '09:05', finishTime: '09:20' }),
  ];
  const day = visitTimesForDate(list, '2026-11-04');
  assert.deepEqual(day.map((item) => item.id), ['T-1', 'T-4', 'T-3']);
  assert.deepEqual(visitTimesForDate(list, '2026-02-30'), []);
});

test('route-day totals add travel and visit minutes; invalid date gives null', () => {
  const list = [
    record(),
    record({ id: 'T-2', departureTime: '11:00', arrivalTime: '11:20', finishTime: '12:00' }),
  ];
  const totals = routeDayTotals(list, '2026-11-04');
  assert.equal(totals.travelMinutes, 60);
  assert.equal(totals.visitMinutes, 70);
  assert.equal(totals.totalMinutes, 130);
  assert.equal(totals.records.length, 2);
  const empty = routeDayTotals(list, '2026-11-05');
  assert.equal(empty.travelMinutes, 0);
  assert.equal(empty.records.length, 0);
  assert.equal(routeDayTotals(list, 'bad-date'), null);
});

test('all route-day totals newest date first', () => {
  const list = [
    record(),
    record({ id: 'T-2', date: '2026-11-05', departureTime: '09:00', arrivalTime: '09:10', finishTime: '09:30' }),
  ];
  const days = allRouteDayTotals(list);
  assert.deepEqual(days.map((day) => day.date), ['2026-11-05', '2026-11-04']);
  assert.equal(days[0].travelMinutes, 10);
});

test('format minutes: plain minutes and hours', () => {
  assert.equal(formatMinutes(0), '0 min');
  assert.equal(formatMinutes(45), '45 min');
  assert.equal(formatMinutes(60), '1h');
  assert.equal(formatMinutes(90), '1h 30m');
});

test('summary text counts records, days, travel, and visit time', () => {
  const list = [record(), record({ id: 'T-2', date: '2026-11-05', departureTime: '09:00', arrivalTime: '09:10', finishTime: '09:30' })];
  assert.equal(visitTimeSummaryText(list), '2 time records across 2 route days: 50 min travel, 50 min on visits.');
  assert.equal(visitTimeSummaryText([record()]), '1 time record across 1 route day: 40 min travel, 30 min on visits.');
});

test('all-records HTML newest first, with escaping', () => {
  const list = [
    record({ visitId: '<script>alert(1)</script>' }),
    record({ id: 'T-2', date: '2026-11-05', visitId: 'V-102', departureTime: '09:00', arrivalTime: '09:10', finishTime: '09:30' }),
  ];
  const html = visitTimeAllHtml(list);
  assert.ok(html.indexOf('2026-11-05') < html.indexOf('2026-11-04'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(visitTimeAllHtml([]), '<p>No visit times recorded yet.</p>');
});

test('route-day HTML shows totals, empty day, and invalid date plainly', () => {
  const html = routeDayHtml([record()], '2026-11-04');
  assert.ok(html.includes('40 min travel'));
  assert.ok(html.includes('30 min on visits'));
  assert.ok(routeDayHtml([], '2026-11-04').includes('No time records for 2026-11-04'));
  assert.ok(routeDayHtml([], 'bad-date').includes('real route-day date'));
});

test('route-day totals HTML newest first with totals', () => {
  const list = [record(), record({ id: 'T-2', date: '2026-11-05', departureTime: '09:00', arrivalTime: '09:10', finishTime: '09:30' })];
  const html = routeDayTotalsHtml(list);
  assert.ok(html.indexOf('2026-11-05') < html.indexOf('2026-11-04'));
  assert.ok(html.includes('10 min'));
  assert.ok(html.includes('40 min'));
  assert.equal(routeDayTotalsHtml([]), '<p>No route days recorded yet.</p>');
});

test('CSV and filename', () => {
  const csv = visitTimeCsv([record({ travelNote: 'a, "quoted" note' })]);
  assert.ok(csv.startsWith('id,visitId,date,departureTime,arrivalTime,finishTime,travelNote'));
  assert.ok(csv.includes('"a, ""quoted"" note"'));
  assert.equal(visitTimeFilename(), 'visit-times.csv');
});

test('inputs never mutated', () => {
  const input = record({ travelNote: '  padded note  ' });
  const before = JSON.stringify(input);
  upsertVisitTime([], input);
  normalizeVisitTimeList([input]);
  assert.equal(JSON.stringify(input), before);
});

test('purity fence: module never imports, reads storage, or touches the clock', () => {
  const src = readFileSync(join(dir, '..', 'visit-times.js'), 'utf8');
  assert.ok(!/^import /m.test(src));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('Date.now'));
  assert.ok(!src.includes('fetch('));
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['visitTimeVisitId', 'visitTimeDate', 'visitTimeDeparture', 'visitTimeArrival', 'visitTimeFinish', 'visitTimeNote', 'visitTimeSaveBtn', 'visitTimeRemoveId', 'visitTimeRemoveBtn', 'visitTimeRouteDate', 'visitTimeBody', 'visitTimeDayBody', 'visitTimeTotalsBody', 'visitTimeSummary', 'visitTimeExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
