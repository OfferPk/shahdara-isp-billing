import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validReactivationNoteDate,
  normalizeReactivationNoteList,
  recordReactivationNote,
  removeReactivationNote,
  findReactivationNote,
  addReactivationNoteFollowup,
  reactivationNoteSorted,
  reactivationNotesForCustomer,
  reactivationNoteCustomers,
  latestReactivationNote,
  stillDormantCustomers,
  reactivationNoteSummaryText,
  reactivationNoteText,
  reactivationNoteHtml,
  reactivationNoteAllHtml,
  reactivationNoteCsv,
  reactivationNoteFilename,
} from '../reactivation-note.js';

const first = { id: 'RN-1', customer: 'Ahmed Raza', returnDate: '2026-11-08', reason: 'Missed the service and came back after the Eid holidays.', packageResumed: '5 Mbps / 200 GB' };
const second = { id: 'RN-2', customer: 'Ahmed Raza', returnDate: '2026-11-10', reason: 'Neighbour recommended us again.', packageResumed: '', followups: [{ date: '2026-11-10', note: 'Checked the line, all fine.' }] };
const third = { id: 'RN-3', customer: 'Bilal Khan', returnDate: '2026-11-09', reason: 'Work from home needs a stable connection.', packageResumed: '3 Mbps / 100 GB' };

test('half-formed notes are refused', () => {
  assert.deepEqual(recordReactivationNote([], { ...first, id: '' }), []);
  assert.deepEqual(recordReactivationNote([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordReactivationNote([], { ...first, returnDate: '' }), []);
  assert.deepEqual(recordReactivationNote([], { ...first, reason: '' }), []);
  assert.deepEqual(recordReactivationNote([], { ...first, reason: '   ' }), []);
  const recorded = recordReactivationNote([], { ...first, packageResumed: '' });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].packageResumed, '');
  const recordedNoPackage = recordReactivationNote([], { id: 'RN-9', customer: 'Sara Bibi', returnDate: '2026-11-11', reason: 'Came back on her own.' });
  assert.equal(recordedNoPackage.length, 1);
  assert.equal(recordedNoPackage[0].packageResumed, '');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validReactivationNoteDate('2026-08-31'), true);
  assert.equal(validReactivationNoteDate('2026-10-31'), true);
  assert.equal(validReactivationNoteDate('2026-12-31'), true);
  assert.equal(validReactivationNoteDate('2026-02-29'), false);
  assert.equal(validReactivationNoteDate('2028-02-29'), true);
  assert.equal(validReactivationNoteDate('2026-04-31'), false);
  assert.equal(validReactivationNoteDate('2026-13-01'), false);
  assert.equal(validReactivationNoteDate('10-11-2026'), false);
  assert.equal(validReactivationNoteDate(''), false);
  assert.equal(validReactivationNoteDate(null), false);
  assert.deepEqual(recordReactivationNote([], { ...first, returnDate: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, customerStatus: 'active', billAmount: 1500, surprise: 'x' };
  const recorded = recordReactivationNote([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('customerStatus' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.customerStatus, 'active');
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'customer', 'customerStatus', 'id', 'packageResumed', 'reason', 'returnDate', 'surprise']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordReactivationNote([], first);
  assert.deepEqual(recordReactivationNote(list, { ...first, reason: 'Changed.' }), list);
  assert.deepEqual(recordReactivationNote(list, { ...second, id: 'RN-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordReactivationNote(acc, item), []);
  assert.equal(findReactivationNote(list, 'RN-2').customer, 'Ahmed Raza');
  assert.equal(findReactivationNote(list, 'RN-9'), null);
  assert.equal(findReactivationNote(list, ''), null);
  assert.deepEqual(removeReactivationNote(list, 'RN-2').map((item) => item.id), ['RN-1', 'RN-3']);
  assert.deepEqual(removeReactivationNote(list, ''), list);
});

test('adding a follow-up never rewrites the note', () => {
  const list = [first];
  const added = addReactivationNoteFollowup(list, 'RN-1', '2026-11-09', 'Called to check the speed.');
  assert.equal(added[0].followups.length, 1);
  assert.equal(added[0].followups[0].date, '2026-11-09');
  assert.equal(added[0].followups[0].note, 'Called to check the speed.');
  assert.equal(added[0].returnDate, '2026-11-08');
  assert.equal(added[0].customer, 'Ahmed Raza');
  assert.equal(added[0].reason, first.reason);
  assert.equal(added[0].packageResumed, '5 Mbps / 200 GB');
  const unchanged = [{ ...first, followups: [] }];
  assert.deepEqual(addReactivationNoteFollowup(list, 'RN-1', '', 'No date'), unchanged);
  assert.deepEqual(addReactivationNoteFollowup(list, 'RN-1', '2026-11-09', ''), unchanged);
  assert.deepEqual(addReactivationNoteFollowup(list, 'RN-9', '2026-11-09', 'Nope'), unchanged);
});

test('a customer page lists notes in date order', () => {
  const list = [second, first, third].reduce((acc, item) => recordReactivationNote(acc, item), []);
  assert.deepEqual(reactivationNotesForCustomer(list, 'ahmed raza').map((item) => item.id), ['RN-1', 'RN-2']);
  assert.deepEqual(reactivationNotesForCustomer(list, 'Bilal Khan').map((item) => item.id), ['RN-3']);
  assert.deepEqual(reactivationNotesForCustomer(list, ''), []);
  assert.deepEqual(reactivationNotesForCustomer(list, 'Nobody'), []);
  assert.deepEqual(reactivationNoteSorted(list).map((item) => item.id), ['RN-1', 'RN-3', 'RN-2']);
});

test('reactivated customers leave the dormant list', () => {
  const list = [first, third].reduce((acc, item) => recordReactivationNote(acc, item), []);
  assert.deepEqual(stillDormantCustomers(list, ['Ahmed Raza', 'Bilal Khan', 'Sara Bibi']), ['Sara Bibi']);
  assert.deepEqual(stillDormantCustomers(list, ['ahmed raza', 'AHMED RAZA', 'Sara Bibi', '', '  ']), ['Sara Bibi']);
  assert.deepEqual(stillDormantCustomers([], ['Ahmed Raza', 'Bilal Khan']), ['Ahmed Raza', 'Bilal Khan']);
  assert.deepEqual(stillDormantCustomers(list, []), []);
  assert.deepEqual(stillDormantCustomers(list, 'nope'), []);
  assert.equal(latestReactivationNote(list, 'Ahmed Raza').id, 'RN-1');
  assert.equal(latestReactivationNote(list, 'Bilal Khan').id, 'RN-3');
  assert.equal(latestReactivationNote(list, 'Sara Bibi'), null);
});

test('customer list keeps the first spelling', () => {
  const list = [
    { id: 'RN-1', customer: 'Ahmed Raza', returnDate: '2026-11-08', reason: 'Came back.' },
    { id: 'RN-2', customer: 'AHMED RAZA', returnDate: '2026-11-09', reason: 'Came back again.' },
    { id: 'RN-3', customer: 'Bilal Khan', returnDate: '2026-11-09', reason: 'Came back too.' },
  ].reduce((acc, item) => recordReactivationNote(acc, item), []);
  assert.deepEqual(reactivationNoteCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
});

test('summary and entry text name the customer, date, and reason plainly', () => {
  assert.equal(reactivationNoteSummaryText([]), 'No reactivation notes recorded.');
  assert.equal(reactivationNoteSummaryText([first, second]), '2 reactivation notes recorded, 1 with a package resumed.');
  assert.equal(reactivationNoteSummaryText([first]), '1 reactivation note recorded, 1 with a package resumed.');
  const text = reactivationNoteText(first);
  assert.equal(text.includes('2026-11-08'), true);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('Missed the service'), true);
  assert.equal(text.includes('5 Mbps / 200 GB'), true);
  assert.equal(reactivationNoteText(second).includes('Package resumed'), false);
  assert.equal(reactivationNoteText(second).includes('Checked the line, all fine.'), true);
  assert.equal(reactivationNoteText(null), 'No reactivation note recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, reason: '<script>alert(1)</script>' };
  const html = reactivationNoteHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(reactivationNoteHtml(null), '<p>No reactivation note recorded.</p>');
  assert.equal(reactivationNoteAllHtml([]), '<p>No reactivation notes recorded.</p>');
  assert.equal(reactivationNoteAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = reactivationNoteCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","return date","reason","package resumed","follow-ups"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('RN-1'), true);
  assert.equal(lines[1].includes('Missed the service'), true);
  assert.equal(reactivationNoteFilename(), 'reactivation-notes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'RN-9', customer: '', returnDate: '2026-11-10', reason: 'No customer.' };
  const out = normalizeReactivationNoteList([bad, first, { ...first, reason: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['RN-1', 'RN-2']);
  assert.equal(out[0].reason, first.reason);
  assert.deepEqual(normalizeReactivationNoteList('nope'), []);
  assert.deepEqual(normalizeReactivationNoteList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../reactivation-note.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the dormant check-in list and winback queue are untouched', () => {
  const source = readFileSync(new URL('../reactivation-note.js', import.meta.url), 'utf8');
  assert.equal(source.includes('dormant-checkin.js'), false, 'module must not reference the dormant check-in list module');
  assert.equal(source.includes('winback-queue.js'), false, 'module must not reference the winback queue module');
  assert.equal(source.includes('winback-cadence.js'), false, 'module must not reference the winback cadence module');
  assert.equal(source.includes('winback-outcome.js'), false, 'module must not reference the winback outcome log module');
  assert.equal(existsSync(new URL('../dormant-checkin.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../winback-queue.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'rnHeading', 'rnSummary', 'rnList', 'rnExportBtn',
    'rnCustomer', 'rnDate', 'rnReason', 'rnPackage', 'rnRecordBtn',
    'rnAddId', 'rnAddDate', 'rnAddNote', 'rnAddBtn',
    'rnRemoveId', 'rnRemoveBtn',
    'rnFilterCustomer', 'rnFilterBtn', 'rnCustomerBody',
    'rnDormantNames', 'rnDormantBtn', 'rnDormantBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the reactivation note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './reactivation-note.js'"), true);
  assert.equal(source.includes('renderReactivationNotes()'), true);
  assert.equal(source.includes('REACTIVATION_NOTE_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
