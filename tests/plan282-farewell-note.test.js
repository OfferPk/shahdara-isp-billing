import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validFarewellNoteDate,
  foldReturnInvited,
  normalizeFarewellNote,
  normalizeFarewellNoteList,
  findFarewellNote,
  recordFarewellNote,
  removeFarewellNote,
  farewellNoteSorted,
  farewellNotesForCustomer,
  latestFarewellNote,
  farewellNoteCustomers,
  farewellNoteSummaryText,
  farewellNoteText,
  farewellNoteHtml,
  farewellNoteAllHtml,
  farewellNoteCsv,
  farewellNoteFilename,
} from '../farewell-note.js';

const first = { id: 'FW-1', customer: 'Ahmed Raza', date: '2026-11-08', message: 'Thanked him for three good years and wished the family well in Lahore.', returnInvited: 'yes' };
const second = { id: 'FW-2', customer: 'Ahmed Raza', date: '2026-11-10', message: 'Called to say the door is open if they move back.', returnInvited: true };
const third = { id: 'FW-3', customer: 'Bilal Khan', date: '2026-11-09', message: 'Left a kind word at the door and the shop number.', returnInvited: 'no' };

test('half-formed notes are refused', () => {
  assert.deepEqual(recordFarewellNote([], { ...first, id: '' }), []);
  assert.deepEqual(recordFarewellNote([], { ...first, customer: '' }), []);
  assert.deepEqual(recordFarewellNote([], { ...first, customer: '   ' }), []);
  assert.deepEqual(recordFarewellNote([], { ...first, date: '' }), []);
  assert.deepEqual(recordFarewellNote([], { ...first, date: '2026-02-30' }), []);
  assert.deepEqual(recordFarewellNote([], { ...first, message: '' }), []);
  assert.deepEqual(recordFarewellNote([], { ...first, message: '   ' }), []);
  // A missing or unclear return answer reads as yes: the farewell itself is the invitation.
  const recorded = recordFarewellNote([], { id: 'FW-9', customer: 'Sara Bibi', date: '2026-11-11', message: 'Wished her well.' });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].returnInvited, true);
  const unclear = recordFarewellNote([], { ...first, id: 'FW-8', returnInvited: 'maybe' });
  assert.equal(unclear.length, 1);
  assert.equal(unclear[0].returnInvited, true);
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validFarewellNoteDate('2026-08-31'), true);
  assert.equal(validFarewellNoteDate('2026-10-31'), true);
  assert.equal(validFarewellNoteDate('2026-12-31'), true);
  assert.equal(validFarewellNoteDate('2026-02-29'), false);
  assert.equal(validFarewellNoteDate('2028-02-29'), true);
  assert.equal(validFarewellNoteDate('2026-04-31'), false);
  assert.equal(validFarewellNoteDate('2026-13-01'), false);
  assert.equal(validFarewellNoteDate('10-11-2026'), false);
  assert.equal(validFarewellNoteDate(''), false);
  assert.equal(validFarewellNoteDate(null), false);
  assert.deepEqual(recordFarewellNote([], { ...first, date: '2026-02-30' }), []);
});

test('return-invited answer folds to yes or no', () => {
  assert.equal(foldReturnInvited('yes'), true);
  assert.equal(foldReturnInvited('invited'), true);
  assert.equal(foldReturnInvited('TRUE'), true);
  assert.equal(foldReturnInvited('1'), true);
  assert.equal(foldReturnInvited(true), true);
  assert.equal(foldReturnInvited('no'), false);
  assert.equal(foldReturnInvited('not invited'), false);
  assert.equal(foldReturnInvited('FALSE'), false);
  assert.equal(foldReturnInvited('0'), false);
  assert.equal(foldReturnInvited(false), false);
  assert.equal(foldReturnInvited(''), true);
  assert.equal(foldReturnInvited(null), true);
  const recorded = recordFarewellNote([], third);
  assert.equal(recorded[0].returnInvited, false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, exitReason: 'moved away', billAmount: 1500, surprise: 'x' };
  const recorded = recordFarewellNote([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('exitReason' in recorded[0], false);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.exitReason, 'moved away');
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'customer', 'date', 'exitReason', 'id', 'message', 'returnInvited', 'surprise']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordFarewellNote([], first);
  assert.deepEqual(recordFarewellNote(list, { ...first, message: 'Changed.' }), list);
  assert.deepEqual(recordFarewellNote(list, { ...second, id: 'FW-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordFarewellNote(acc, item), []);
  assert.equal(findFarewellNote(list, 'FW-2').customer, 'Ahmed Raza');
  assert.equal(findFarewellNote(list, 'FW-9'), null);
  assert.equal(findFarewellNote(list, ''), null);
  assert.deepEqual(removeFarewellNote(list, 'FW-2').map((item) => item.id), ['FW-1', 'FW-3']);
  assert.deepEqual(removeFarewellNote(list, ''), list);
});

test('sorting is by date then customer then id', () => {
  const list = [second, third, first].reduce((acc, item) => recordFarewellNote(acc, item), []);
  assert.deepEqual(farewellNoteSorted(list).map((item) => item.id), ['FW-1', 'FW-3', 'FW-2']);
});

test('a moved-out customer shows their farewell notes with dates', () => {
  const list = [second, first, third].reduce((acc, item) => recordFarewellNote(acc, item), []);
  assert.deepEqual(farewellNotesForCustomer(list, 'ahmed raza').map((item) => item.id), ['FW-1', 'FW-2']);
  assert.deepEqual(farewellNotesForCustomer(list, 'Bilal Khan').map((item) => item.id), ['FW-3']);
  assert.deepEqual(farewellNotesForCustomer(list, ''), []);
  assert.deepEqual(farewellNotesForCustomer(list, 'Nobody'), []);
  assert.equal(latestFarewellNote(list, 'Ahmed Raza').id, 'FW-2');
  assert.equal(latestFarewellNote(list, 'Bilal Khan').id, 'FW-3');
  assert.equal(latestFarewellNote(list, 'Nobody'), null);
});

test('customer list keeps the first spelling', () => {
  const list = [
    { id: 'FW-1', customer: 'Ahmed Raza', date: '2026-11-08', message: 'Wished him well.' },
    { id: 'FW-2', customer: 'AHMED RAZA', date: '2026-11-09', message: 'Called again.' },
    { id: 'FW-3', customer: 'Bilal Khan', date: '2026-11-09', message: 'Left a kind word.' },
  ].reduce((acc, item) => recordFarewellNote(acc, item), []);
  assert.deepEqual(farewellNoteCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
});

test('summary and entry text name the customer, date, and message plainly', () => {
  assert.equal(farewellNoteSummaryText([]), 'No move-out farewell notes recorded.');
  assert.equal(farewellNoteSummaryText([first, second]), '2 move-out farewell notes recorded, 2 inviting a return.');
  assert.equal(farewellNoteSummaryText([first, third]), '2 move-out farewell notes recorded, 1 inviting a return.');
  assert.equal(farewellNoteSummaryText([first]), '1 move-out farewell note recorded, 1 inviting a return.');
  const text = farewellNoteText(first);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('2026-11-08'), true);
  assert.equal(text.includes('three good years'), true);
  assert.equal(text.includes('return invited'), true);
  assert.equal(farewellNoteText(third).includes('return not invited'), true);
  assert.equal(farewellNoteText(null), 'No move-out farewell note recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, message: '<script>alert(1)</script>' };
  const html = farewellNoteHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(farewellNoteHtml(null), '<p>No move-out farewell note recorded.</p>');
  assert.equal(farewellNoteAllHtml([]), '<p>No move-out farewell notes recorded.</p>');
  assert.equal(farewellNoteAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = farewellNoteCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","move-out date","farewell message","return invited"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('FW-1'), true);
  assert.equal(lines[1].includes('three good years'), true);
  assert.equal(lines[1].includes('"yes"'), true);
  assert.equal(farewellNoteFilename(), 'farewell-notes.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'FW-9', customer: '', date: '2026-11-10', message: 'No customer.' };
  const out = normalizeFarewellNoteList([bad, first, { ...first, message: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['FW-1', 'FW-2']);
  assert.equal(out[0].message, first.message);
  assert.deepEqual(normalizeFarewellNoteList('nope'), []);
  assert.deepEqual(normalizeFarewellNoteList(null), []);
  assert.equal(normalizeFarewellNote(null), null);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../farewell-note.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the exit reason log and move-house transfer record are untouched', () => {
  const source = readFileSync(new URL('../farewell-note.js', import.meta.url), 'utf8');
  assert.equal(source.includes('exit-reasons.js'), false, 'module must not reference the exit reason log module');
  assert.equal(source.includes('move-transfers.js'), false, 'module must not reference the move-house transfer module');
  assert.equal(source.includes('relocation-log.js'), false, 'module must not reference the relocation log module');
  assert.equal(existsSync(new URL('../exit-reasons.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../move-transfers.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'fwHeading', 'fwSummary', 'fwList', 'fwExportBtn',
    'fwCustomer', 'fwDate', 'fwMessage', 'fwReturnInvited', 'fwRecordBtn',
    'fwRemoveId', 'fwRemoveBtn',
    'fwFilterCustomer', 'fwFilterBtn', 'fwCustomerBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the farewell note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './farewell-note.js'"), true);
  assert.equal(source.includes('renderFarewellNotes()'), true);
  assert.equal(source.includes('FAREWELL_NOTE_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
