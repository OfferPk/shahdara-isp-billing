import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validVisitorLogDate,
  validVisitorLogTime,
  normalizeVisitorLog,
  normalizeVisitorLogList,
  findVisitorLog,
  recordVisitorLog,
  removeVisitorLog,
  visitorLogDurationMinutes,
  visitorLogSorted,
  visitorLogForDate,
  visitorLogSearch,
  visitorLogVisitors,
  visitorLogSummaryText,
  visitorLogEntryText,
  visitorLogEntryHtml,
  visitorLogAllHtml,
  visitorLogSearchHtml,
  visitorLogCsv,
  visitorLogFilename,
} from '../visitor-log.js';

const first = {
  id: 'SV-1',
  date: '2026-11-04',
  visitorName: 'Ahmed Raza',
  purpose: 'Supplier delivery',
  personMet: 'Saad',
  timeIn: '10:15',
  timeOut: '10:45',
};
const second = {
  id: 'SV-2',
  date: '2026-11-05',
  visitorName: 'Fibre House Lahore',
  purpose: 'Price list drop-off',
  personMet: 'Owner',
  timeIn: '09:00',
  timeOut: '',
};
const third = {
  id: 'SV-3',
  date: '2026-11-04',
  visitorName: 'ahmed raza',
  purpose: 'Bill query',
  personMet: '',
  timeIn: '11:30',
  timeOut: '11:50',
};
const fixture = [second, first, third];

test('half-formed visits are refused', () => {
  assert.equal(normalizeVisitorLog(null), null);
  assert.equal(normalizeVisitorLog([]), null);
  assert.equal(normalizeVisitorLog({ ...first, id: '  ' }), null);
  assert.equal(normalizeVisitorLog({ ...first, date: '2026-02-30' }), null);
  assert.equal(normalizeVisitorLog({ ...first, date: '2026-13-01' }), null);
  assert.equal(normalizeVisitorLog({ ...first, visitorName: '' }), null);
  assert.equal(normalizeVisitorLog({ ...first, purpose: '   ' }), null);
  assert.equal(normalizeVisitorLog({ ...first, timeIn: '25:00' }), null);
  assert.equal(normalizeVisitorLog({ ...first, timeOut: '9:00' }), null);
  assert.equal(normalizeVisitorLog({ ...first, timeIn: '11:00', timeOut: '10:00' }), null);
  // A visit with no times at all is fine: the visitor may still be in the shop.
  assert.deepEqual(normalizeVisitorLog({ ...first, timeIn: '', timeOut: '' }), {
    ...first,
    timeIn: '',
    timeOut: '',
  });
  // Person met is optional.
  assert.deepEqual(normalizeVisitorLog({ ...first, personMet: '' }), { ...first, personMet: '' });
});

test('strict dates and times', () => {
  assert.equal(validVisitorLogDate('2024-02-29'), true);
  assert.equal(validVisitorLogDate('2025-02-29'), false);
  assert.equal(validVisitorLogDate('2026-11-31'), false);
  assert.equal(validVisitorLogDate('2026-11-05'), true);
  assert.equal(validVisitorLogDate('05-11-2026'), false);
  assert.equal(validVisitorLogDate(''), false);
  assert.equal(validVisitorLogTime('00:00'), true);
  assert.equal(validVisitorLogTime('23:59'), true);
  assert.equal(validVisitorLogTime('24:00'), false);
  assert.equal(validVisitorLogTime('10:60'), false);
  assert.equal(validVisitorLogTime('10:5'), false);
  assert.equal(validVisitorLogTime(''), false);
});

test('visit length is whole minutes by integer arithmetic', () => {
  assert.equal(visitorLogDurationMinutes(first), 30);
  assert.equal(visitorLogDurationMinutes(third), 20);
  assert.equal(visitorLogDurationMinutes(second), null);
  assert.equal(visitorLogDurationMinutes({ ...first, timeIn: '10:00', timeOut: '10:00' }), 0);
  assert.equal(visitorLogDurationMinutes(null), null);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, bill: 'B-1', payment: 500, customer: 'C-1', staff: 'S-1', extra: 'x' };
  const clean = normalizeVisitorLog(raw);
  assert.equal(clean.bill, undefined);
  assert.equal(clean.payment, undefined);
  assert.equal(clean.customer, undefined);
  assert.equal(clean.staff, undefined);
  assert.equal(clean.extra, undefined);
  assert.deepEqual(raw, { ...first, bill: 'B-1', payment: 500, customer: 'C-1', staff: 'S-1', extra: 'x' });
});

test('duplicate ids are never rewritten', () => {
  const list = recordVisitorLog([first], { ...first, purpose: 'Changed purpose' });
  assert.equal(list.length, 1);
  assert.equal(list[0].purpose, 'Supplier delivery');
  assert.equal(recordVisitorLog([first], { ...first, id: '' }).length, 1);
});

test('find and remove', () => {
  assert.deepEqual(findVisitorLog(fixture, 'SV-2'), second);
  assert.equal(findVisitorLog(fixture, 'SV-9'), null);
  assert.equal(findVisitorLog(fixture, ''), null);
  assert.deepEqual(removeVisitorLog(fixture, 'SV-1').map((visit) => visit.id), ['SV-2', 'SV-3']);
  assert.equal(removeVisitorLog(fixture, 'SV-9').length, 3);
});

test('visits sort by date, then time in, then visitor name', () => {
  assert.deepEqual(visitorLogSorted(fixture).map((visit) => visit.id), ['SV-1', 'SV-3', 'SV-2']);
  assert.deepEqual(visitorLogSorted([third, first]).map((visit) => visit.id), ['SV-1', 'SV-3']);
});

test('visits for one date are listed in time order', () => {
  assert.deepEqual(visitorLogForDate(fixture, '2026-11-04').map((visit) => visit.id), ['SV-1', 'SV-3']);
  assert.deepEqual(visitorLogForDate(fixture, '2026-11-05').map((visit) => visit.id), ['SV-2']);
  assert.deepEqual(visitorLogForDate(fixture, '2026-11-06'), []);
  assert.deepEqual(visitorLogForDate(fixture, 'not-a-date'), []);
});

test('visits are searchable by visitor name', () => {
  assert.deepEqual(visitorLogSearch(fixture, 'ahmed').map((visit) => visit.id), ['SV-1', 'SV-3']);
  assert.deepEqual(visitorLogSearch(fixture, 'AHMED RAZA').map((visit) => visit.id), ['SV-1', 'SV-3']);
  assert.deepEqual(visitorLogSearch(fixture, 'Fibre').map((visit) => visit.id), ['SV-2']);
  assert.deepEqual(visitorLogSearch(fixture, 'Raza').map((visit) => visit.id), ['SV-1', 'SV-3']);
  assert.deepEqual(visitorLogSearch(fixture, 'Nobody'), []);
  assert.deepEqual(visitorLogSearch(fixture, ''), []);
  assert.deepEqual(visitorLogSearch(fixture, '   '), []);
  assert.deepEqual(visitorLogVisitors(fixture), ['Ahmed Raza', 'Fibre House Lahore']);
  assert.deepEqual(visitorLogVisitors([]), []);
});

test('summary text names the count and the latest visit', () => {
  assert.equal(visitorLogSummaryText([]), 'No shop visits recorded.');
  assert.equal(
    visitorLogSummaryText([first]),
    '1 shop visit recorded. Latest visit on 2026-11-04: Ahmed Raza, Supplier delivery.',
  );
  assert.equal(
    visitorLogSummaryText(fixture),
    '3 shop visits recorded. Latest visit on 2026-11-05: Fibre House Lahore, Price list drop-off.',
  );
});

test('entry text shows date, visitor, purpose, person met, and times', () => {
  assert.equal(visitorLogEntryText(null), 'No shop visit recorded.');
  assert.equal(
    visitorLogEntryText(first),
    '2026-11-04 — Ahmed Raza, Supplier delivery, met Saad, 10:15–10:45.',
  );
  assert.equal(
    visitorLogEntryText(second),
    '2026-11-05 — Fibre House Lahore, Price list drop-off, met Owner, 09:00.',
  );
  assert.equal(
    visitorLogEntryText(third),
    '2026-11-04 — ahmed raza, Bill query, 11:30–11:50.',
  );
});

test('HTML escapes input', () => {
  const nasty = { ...second, visitorName: 'Fibre & House <b>bold</b>' };
  assert.equal(visitorLogEntryHtml(nasty).includes('<b>'), false);
  assert.equal(visitorLogEntryHtml(nasty).includes('Fibre &amp; House &lt;b&gt;bold&lt;/b&gt;'), true);
  assert.equal(visitorLogEntryHtml(null), '<p>No shop visit recorded.</p>');
  const html = visitorLogAllHtml(fixture);
  assert.equal(html.includes('2026-11-05'), true);
  assert.equal(html.includes('Ahmed Raza'), true);
  assert.equal(visitorLogAllHtml([]), '<p>No shop visits recorded.</p>');
  assert.equal(visitorLogSearchHtml(fixture, 'ahmed').includes('Ahmed Raza'), true);
  assert.equal(visitorLogSearchHtml(fixture, 'Nobody'), '<p>No shop visits match that name.</p>');
  assert.equal(visitorLogSearchHtml(fixture, ''), '<p>Type a visitor name to search.</p>');
});

test('CSV export and filename', () => {
  const csv = visitorLogCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","date","visitor name","purpose","person met","time in","time out"');
  assert.equal(csv.includes('"SV-1","2026-11-04","Ahmed Raza","Supplier delivery","Saad","10:15","10:45"'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"SV-1"'), true);
  assert.equal(visitorLogFilename(), 'visitor-log.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeVisitorLogList(null), []);
  assert.deepEqual(normalizeVisitorLogList('nope'), []);
  assert.deepEqual(normalizeVisitorLogList([first, null, { ...first, id: '' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../visitor-log.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: field visit, acknowledgement, welcome, no-show, callback, and access records are untouched', () => {
  const source = readFileSync(new URL('../visitor-log.js', import.meta.url), 'utf8');
  assert.equal(source.includes('contractor-visit.js'), false, 'module must not reference the contractor visit record');
  assert.equal(source.includes('visit-acknowledgement.js'), false, 'module must not reference the visit acknowledgement record');
  assert.equal(source.includes('welcome-visit-outcome.js'), false, 'module must not reference the welcome visit outcome record');
  assert.equal(source.includes('no-show-note.js'), false, 'module must not reference the no-show note');
  assert.equal(source.includes('callback-queue.js'), false, 'module must not reference the callback queue');
  assert.equal(source.includes('access-register.js'), false, 'module must not reference the access register');
  assert.equal(existsSync(new URL('../contractor-visit.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../visit-acknowledgement.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../welcome-visit-outcome.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../no-show-note.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../callback-queue.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../access-register.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'vsHeading', 'vsSummary', 'vsExportBtn', 'vsDate', 'vsVisitorName',
    'vsPurpose', 'vsPersonMet', 'vsTimeIn', 'vsTimeOut', 'vsRecordBtn',
    'vsRemoveId', 'vsRemoveBtn', 'vsSearch', 'vsSearchBtn', 'vsSearchBody',
    'vsDateInput', 'vsDateBtn', 'vsDateBody', 'vsBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the shop visitor log panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './visitor-log.js'"), true);
  assert.equal(source.includes('renderVisitorLog()'), true);
  assert.equal(source.includes('loadVisitorLog()'), true);
  assert.equal(source.includes('shahdara_visitor_log_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
