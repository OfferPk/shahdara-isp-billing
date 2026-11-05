// Plan 255 — Service restoration time record per ticket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validRestorationTimeDate,
  validRestorationTimeDatetime,
  normalizeRestorationTimeList,
  recordRestorationTime,
  removeRestorationTime,
  findRestorationTime,
  addRestorationTimeFollowup,
  restorationTimeSorted,
  restorationTimesForTicket,
  restorationTimeTickets,
  restorationDurationMinutes,
  restorationDurationText,
  ticketsWithoutRestorationTime,
  restorationTimeSummaryText,
  restorationTimeText,
  restorationTimeHtml,
  restorationTimeCsv,
  restorationTimeFilename,
} from '../restoration-time.js';

const first = {
  id: 'RT-1',
  ticketRef: 'TKT-101',
  reportedAt: '2026-11-01T09:00',
  restoredAt: '2026-11-01T12:20',
  restoredBy: 'Saad',
  note: 'Splice repaired at the pole.',
};

const second = {
  id: 'RT-2',
  ticketRef: 'TKT-102',
  reportedAt: '2026-11-02T18:30',
  restoredAt: '2026-11-02T19:15',
  restoredBy: 'Saad',
  note: 'ONU power supply swapped.',
};

const third = {
  id: 'RT-3',
  ticketRef: 'tkt-101',
  reportedAt: '2026-11-03T08:00',
  restoredAt: '2026-11-03T10:00',
  restoredBy: 'Owner',
  note: 'Second record for the same ticket.',
};

test('half-formed records are refused', () => {
  assert.deepEqual(recordRestorationTime([], { ...first, id: '' }), []);
  assert.deepEqual(recordRestorationTime([], { ...first, ticketRef: '' }), []);
  assert.deepEqual(recordRestorationTime([], { ...first, restoredBy: '' }), []);
  assert.deepEqual(recordRestorationTime([], { ...first, note: '' }), []);
  assert.deepEqual(recordRestorationTime([], { ...first, reportedAt: '' }), []);
  assert.deepEqual(recordRestorationTime([], { ...first, restoredAt: '' }), []);
  assert.deepEqual(recordRestorationTime([], { ...first, extraField: 'dropped' }).length, 1);
  assert.equal(recordRestorationTime([], { ...first, extraField: 'dropped' })[0].extraField, undefined);
});

test('strict datetimes: bad dates, bad times, and restored-before-reported are refused', () => {
  assert.equal(validRestorationTimeDatetime('2026-02-29T10:00'), false);
  assert.equal(validRestorationTimeDatetime('2024-02-29T10:00'), true);
  assert.equal(validRestorationTimeDatetime('2026-11-31T10:00'), false);
  assert.equal(validRestorationTimeDatetime('2026-11-01T24:00'), false);
  assert.equal(validRestorationTimeDatetime('2026-11-01T10:60'), false);
  assert.equal(validRestorationTimeDatetime('2026-11-01 10:00'), false);
  assert.equal(validRestorationTimeDatetime('2026-11-01T10:00'), true);
  assert.equal(validRestorationTimeDate('2026-02-29'), false);
  assert.equal(validRestorationTimeDate('2024-02-29'), true);
  // Restored at or before the reported time is not a restoration.
  assert.deepEqual(recordRestorationTime([], { ...first, restoredAt: '2026-11-01T09:00' }), []);
  assert.deepEqual(recordRestorationTime([], { ...first, restoredAt: '2026-11-01T08:00' }), []);
  assert.equal(recordRestorationTime([], first).length, 1);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, unknown: 'x', followups: [{ date: '2026-11-02', note: 'Checked again.' }] };
  const frozen = JSON.parse(JSON.stringify(raw));
  const recorded = recordRestorationTime([], raw);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].unknown, undefined);
  assert.deepEqual(raw, frozen);
  assert.deepEqual(recordRestorationTime([], { ...first, followups: [{ date: '2026-02-30', note: 'bad date' }] })[0].followups, []);
});

test('duplicate ids and a second record for the same ticket are never rewritten', () => {
  const one = recordRestorationTime([], first);
  assert.deepEqual(recordRestorationTime(one, { ...first, note: 'Changed.' }), one);
  assert.deepEqual(recordRestorationTime(one, third), one);
  assert.deepEqual(normalizeRestorationTimeList([first, third]).map((item) => item.id), ['RT-1']);
});

test('find and remove', () => {
  const list = normalizeRestorationTimeList([first, second]);
  assert.equal(findRestorationTime(list, 'RT-2').ticketRef, 'TKT-102');
  assert.equal(findRestorationTime(list, 'RT-9'), null);
  assert.equal(findRestorationTime(list, ''), null);
  assert.deepEqual(removeRestorationTime(list, 'RT-1').map((item) => item.id), ['RT-2']);
  assert.deepEqual(removeRestorationTime(list, 'RT-9'), list);
});

test('sorting is by restored time, then ticket, then id', () => {
  const list = normalizeRestorationTimeList([second, first]);
  assert.deepEqual(restorationTimeSorted(list).map((item) => item.id), ['RT-1', 'RT-2']);
  const sameTime = normalizeRestorationTimeList([
    { ...second, id: 'RT-9', ticketRef: 'TKT-100', reportedAt: '2026-11-01T08:00', restoredAt: '2026-11-01T12:20' },
    first,
  ]);
  assert.deepEqual(restorationTimeSorted(sameTime).map((item) => item.id), ['RT-9', 'RT-1']);
});

test('per-ticket listing is case-insensitive and the ticket list keeps the first spelling', () => {
  const list = normalizeRestorationTimeList([first, second]);
  assert.deepEqual(restorationTimesForTicket(list, 'tkt-101').map((item) => item.id), ['RT-1']);
  assert.deepEqual(restorationTimesForTicket(list, ''), []);
  assert.deepEqual(restorationTimeTickets(list), ['TKT-101', 'TKT-102']);
});

test('outage length is counted from the two times and can never disagree with them', () => {
  assert.equal(restorationDurationMinutes(first), 200);
  assert.equal(restorationDurationMinutes(second), 45);
  assert.equal(restorationDurationText(first), '3 hours 20 minutes');
  assert.equal(restorationDurationText(second), '45 minutes');
  assert.equal(restorationDurationText({ ...first, restoredAt: '2026-11-01T10:00' }), '1 hour');
  assert.equal(restorationDurationText({ ...first, restoredAt: '2026-11-01T09:01' }), '1 minute');
  assert.equal(restorationDurationMinutes({ ...first, restoredAt: '2026-11-01T08:00' }), null);
  // A leap-year span counts the real calendar days.
  const leap = { ...first, reportedAt: '2024-02-28T10:00', restoredAt: '2024-03-01T10:00' };
  assert.equal(restorationDurationMinutes(leap), 2880);
});

test('closed tickets without a restoration record are listed as exceptions', () => {
  const list = normalizeRestorationTimeList([first, second]);
  assert.deepEqual(ticketsWithoutRestorationTime(['TKT-101', 'TKT-103', 'TKT-102'], list), ['TKT-103']);
  assert.deepEqual(ticketsWithoutRestorationTime(['tkt-101', 'TKT-101', 'TKT-104'], list), ['TKT-104']);
  assert.deepEqual(ticketsWithoutRestorationTime([{ ticketRef: 'TKT-105' }, null, { ticketRef: '' }], list), ['TKT-105']);
  assert.deepEqual(ticketsWithoutRestorationTime([], list), []);
  assert.deepEqual(ticketsWithoutRestorationTime('not a list', list), []);
  assert.deepEqual(ticketsWithoutRestorationTime(['TKT-101'], []), ['TKT-101']);
});

test('a follow-up corrects only by a dated note and never rewrites the record', () => {
  const list = normalizeRestorationTimeList([first]);
  const noted = addRestorationTimeFollowup(list, 'RT-1', '2026-11-02', 'Customer confirmed service back.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].reportedAt, '2026-11-01T09:00');
  assert.equal(noted[0].restoredAt, '2026-11-01T12:20');
  assert.equal(noted[0].restoredBy, 'Saad');
  assert.equal(noted[0].note, 'Splice repaired at the pole.');
  assert.deepEqual(addRestorationTimeFollowup(list, 'RT-1', '2026-02-30', 'bad date'), list);
  assert.deepEqual(addRestorationTimeFollowup(list, 'RT-9', '2026-11-02', 'unknown id'), list);
  assert.deepEqual(addRestorationTimeFollowup(list, 'RT-1', '2026-11-02', ''), list);
});

test('summary and entry text name the ticket, both times, and the outage length', () => {
  assert.equal(restorationTimeSummaryText([]), 'No service restoration times recorded.');
  assert.equal(restorationTimeSummaryText([first]), '1 restoration record across 1 ticket.');
  assert.equal(restorationTimeSummaryText([first, second]), '2 restoration records across 2 tickets.');
  assert.equal(
    restorationTimeText(first),
    'Ticket TKT-101: fault reported 2026-11-01T09:00, service restored 2026-11-01T12:20 (3 hours 20 minutes), restored by Saad. Splice repaired at the pole.',
  );
  assert.equal(restorationTimeText({ ...first, note: '' }), 'No service restoration time recorded.');
});

test('HTML is escaped', () => {
  const nasty = { ...first, note: '<script>alert(1)</script>', restoredBy: 'A & B' };
  const html = restorationTimeHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('A &amp; B'), true);
  assert.equal(restorationTimeHtml({ ...first, note: '' }), '<p>No service restoration time recorded.</p>');
});

test('CSV export and filename', () => {
  const csv = restorationTimeCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], '"id","ticket reference","fault reported","service restored","outage minutes","restored by","note","follow-ups"');
  assert.equal(lines[1].includes('"TKT-101"'), true);
  assert.equal(lines[1].includes('"200"'), true);
  assert.equal(lines[2].includes('"45"'), true);
  assert.equal(restorationTimeCsv([]), '"id","ticket reference","fault reported","service restored","outage minutes","restored by","note","follow-ups"');
  assert.equal(restorationTimeFilename(), 'restoration-times.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const messy = [first, { ...first, note: 'Changed.' }, { id: 'RT-9' }, null, 'nope', second];
  assert.deepEqual(normalizeRestorationTimeList(messy).map((item) => item.id), ['RT-1', 'RT-2']);
  assert.deepEqual(normalizeRestorationTimeList('not a list'), []);
  assert.deepEqual(normalizeRestorationTimeList(undefined), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../restoration-time.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the restoration sweep and the escalation timer are untouched', () => {
  const source = readFileSync(new URL('../restoration-time.js', import.meta.url), 'utf8');
  assert.equal(source.includes('restoration-sweep'), false, 'module must not reference the sweep module');
  assert.equal(source.includes('escalation-timer'), false, 'module must not reference the escalation timer module');
  assert.equal(existsSync(new URL('../restoration-sweep.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../escalation-timer.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'rtHeading', 'rtSummary', 'rtList', 'rtExportBtn',
    'rtTicketRef', 'rtReportedAt', 'rtRestoredAt', 'rtRestoredBy', 'rtNote', 'rtRecordBtn',
    'rtAnnotateId', 'rtAnnotateDate', 'rtAnnotateNote', 'rtAnnotateBtn',
    'rtRemoveId', 'rtRemoveBtn',
    'rtFilterTicket', 'rtTicketBtn', 'rtTicketBody',
    'rtExceptionsInput', 'rtExceptionsBtn', 'rtExceptionsBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the restoration time panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './restoration-time.js'"), true);
  assert.equal(source.includes('renderRestorationTimes()'), true);
  assert.equal(source.includes('RESTORATION_TIME_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
