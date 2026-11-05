import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validNoShowNoteDate,
  normalizeNoShowNote,
  normalizeNoShowNoteList,
  findNoShowNote,
  recordNoShowNote,
  removeNoShowNote,
  noShowNoteSorted,
  noShowNotesForCustomer,
  noShowNotesInPeriod,
  noShowNoteCustomers,
  noShowNoteSummaryText,
  noShowNoteText,
  noShowNoteHtml,
  noShowNoteAllHtml,
  noShowNoteCsv,
  noShowNoteFilename,
} from '../no-show-note.js';

const first = { id: 'NS-1', appointmentId: 'APT-101', customer: 'Ahmed Raza', date: '2026-11-08', reason: 'Not at home when Saad arrived.', nextStep: 'Call again tomorrow morning.' };
const second = { id: 'NS-2', appointmentId: 'APT-102', customer: 'Ahmed Raza', date: '2026-11-10', reason: '', nextStep: '' };
const third = { id: 'NS-3', appointmentId: 'APT-103', customer: 'Bilal Khan', date: '2026-11-09', reason: 'Out of town for a wedding.', nextStep: 'Rebook next week.' };

test('half-formed notes are refused', () => {
  assert.deepEqual(recordNoShowNote([], { ...first, id: '' }), []);
  assert.deepEqual(recordNoShowNote([], { ...first, appointmentId: '' }), []);
  assert.deepEqual(recordNoShowNote([], { ...first, appointmentId: '   ' }), []);
  assert.deepEqual(recordNoShowNote([], { ...first, date: '' }), []);
  assert.deepEqual(recordNoShowNote([], { ...first, date: '2026-02-30' }), []);
  // Reason and next step are optional: a no-show is often unexplained at first.
  const recorded = recordNoShowNote([], second);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].reason, '');
  assert.equal(recorded[0].nextStep, '');
  const noCustomer = recordNoShowNote([], { id: 'NS-9', appointmentId: 'APT-109', date: '2026-11-11' });
  assert.equal(noCustomer.length, 1);
  assert.equal(noCustomer[0].customer, '');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validNoShowNoteDate('2026-08-31'), true);
  assert.equal(validNoShowNoteDate('2026-10-31'), true);
  assert.equal(validNoShowNoteDate('2026-12-31'), true);
  assert.equal(validNoShowNoteDate('2026-02-29'), false);
  assert.equal(validNoShowNoteDate('2028-02-29'), true);
  assert.equal(validNoShowNoteDate('2026-04-31'), false);
  assert.equal(validNoShowNoteDate('2026-13-01'), false);
  assert.equal(validNoShowNoteDate('10-11-2026'), false);
  assert.equal(validNoShowNoteDate(''), false);
  assert.equal(validNoShowNoteDate(null), false);
  assert.deepEqual(recordNoShowNote([], { ...first, date: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, visitOutcome: 'done', billAmount: 1500, surprise: 'x' };
  const recorded = recordNoShowNote([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('visitOutcome' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.visitOutcome, 'done');
  assert.deepEqual(Object.keys(raw).sort(), ['appointmentId', 'billAmount', 'customer', 'date', 'id', 'nextStep', 'reason', 'surprise', 'visitOutcome']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordNoShowNote([], first);
  assert.deepEqual(recordNoShowNote(list, { ...first, reason: 'Changed.' }), list);
  assert.deepEqual(recordNoShowNote(list, { ...second, id: 'NS-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordNoShowNote(acc, item), []);
  assert.equal(findNoShowNote(list, 'NS-2').appointmentId, 'APT-102');
  assert.equal(findNoShowNote(list, 'NS-9'), null);
  assert.equal(findNoShowNote(list, ''), null);
  assert.deepEqual(removeNoShowNote(list, 'NS-2').map((item) => item.id), ['NS-1', 'NS-3']);
  assert.deepEqual(removeNoShowNote(list, ''), list);
});

test('sorting is by date then customer then id', () => {
  const list = [second, third, first].reduce((acc, item) => recordNoShowNote(acc, item), []);
  assert.deepEqual(noShowNoteSorted(list).map((item) => item.id), ['NS-1', 'NS-3', 'NS-2']);
});

test('no-shows list per customer in date order', () => {
  const list = [second, first, third].reduce((acc, item) => recordNoShowNote(acc, item), []);
  assert.deepEqual(noShowNotesForCustomer(list, 'ahmed raza').map((item) => item.id), ['NS-1', 'NS-2']);
  assert.deepEqual(noShowNotesForCustomer(list, 'Bilal Khan').map((item) => item.id), ['NS-3']);
  assert.deepEqual(noShowNotesForCustomer(list, ''), []);
  assert.deepEqual(noShowNotesForCustomer(list, 'Nobody'), []);
});

test('no-shows list per period is inclusive and bad periods give nothing', () => {
  const list = [first, second, third].reduce((acc, item) => recordNoShowNote(acc, item), []);
  assert.deepEqual(noShowNotesInPeriod(list, '2026-11-08', '2026-11-09').map((item) => item.id), ['NS-1', 'NS-3']);
  assert.deepEqual(noShowNotesInPeriod(list, '2026-11-09', '2026-11-09').map((item) => item.id), ['NS-3']);
  assert.deepEqual(noShowNotesInPeriod(list, '2026-11-10', '2026-11-08'), []);
  assert.deepEqual(noShowNotesInPeriod(list, '2026-02-30', '2026-11-09'), []);
  assert.deepEqual(noShowNotesInPeriod(list, '', ''), []);
});

test('customer list keeps the first spelling', () => {
  const list = [
    { id: 'NS-1', appointmentId: 'APT-101', customer: 'Ahmed Raza', date: '2026-11-08' },
    { id: 'NS-2', appointmentId: 'APT-102', customer: 'AHMED RAZA', date: '2026-11-09' },
    { id: 'NS-3', appointmentId: 'APT-103', customer: 'Bilal Khan', date: '2026-11-09' },
  ].reduce((acc, item) => recordNoShowNote(acc, item), []);
  assert.deepEqual(noShowNoteCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
});

test('summary and entry text name the appointment, date, and reason plainly', () => {
  assert.equal(noShowNoteSummaryText([]), 'No appointment no-show notes recorded.');
  assert.equal(noShowNoteSummaryText([first, second]), '2 appointment no-show notes recorded, 1 with a reason given.');
  assert.equal(noShowNoteSummaryText([first]), '1 appointment no-show note recorded, 1 with a reason given.');
  const text = noShowNoteText(first);
  assert.equal(text.includes('APT-101'), true);
  assert.equal(text.includes('2026-11-08'), true);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('Not at home'), true);
  assert.equal(text.includes('Call again tomorrow morning.'), true);
  assert.equal(noShowNoteText(second).includes('reason not known'), true);
  assert.equal(noShowNoteText(null), 'No appointment no-show note recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, reason: '<script>alert(1)</script>' };
  const html = noShowNoteHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(noShowNoteHtml(null), '<p>No appointment no-show note recorded.</p>');
  assert.equal(noShowNoteAllHtml([]), '<p>No appointment no-show notes recorded.</p>');
  assert.equal(noShowNoteAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = noShowNoteCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","appointment","customer","date","reason","next step"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('NS-1'), true);
  assert.equal(lines[1].includes('Not at home'), true);
  assert.equal(noShowNoteFilename(), 'no-show-notes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'NS-9', appointmentId: '', customer: 'Nobody', date: '2026-11-10' };
  const out = normalizeNoShowNoteList([bad, first, { ...first, reason: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['NS-1', 'NS-2']);
  assert.equal(out[0].reason, first.reason);
  assert.deepEqual(normalizeNoShowNoteList('nope'), []);
  assert.deepEqual(normalizeNoShowNoteList(null), []);
  assert.equal(normalizeNoShowNote(null), null);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../no-show-note.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the day-part scheduling and preferred visit time window records are untouched', () => {
  const source = readFileSync(new URL('../no-show-note.js', import.meta.url), 'utf8');
  assert.equal(source.includes('visit-day-part.js'), false, 'module must not reference the day-part scheduling module');
  assert.equal(source.includes('visit-time-window.js'), false, 'module must not reference the preferred visit time window module');
  assert.equal(source.includes('visit-window.js'), false, 'module must not reference the visit window module');
  assert.equal(existsSync(new URL('../visit-day-part.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../visit-time-window.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'nsHeading', 'nsSummary', 'nsList', 'nsExportBtn',
    'nsAppointment', 'nsCustomer', 'nsDate', 'nsReason', 'nsNextStep', 'nsRecordBtn',
    'nsRemoveId', 'nsRemoveBtn',
    'nsFilterCustomer', 'nsFilterBtn', 'nsCustomerBody',
    'nsFilterFrom', 'nsFilterTo', 'nsPeriodBtn', 'nsPeriodBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the no-show note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './no-show-note.js'"), true);
  assert.equal(source.includes('renderNoShowNotes()'), true);
  assert.equal(source.includes('NO_SHOW_NOTE_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
