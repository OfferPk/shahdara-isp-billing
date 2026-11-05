import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validStaffRecognitionDay,
  normalizeStaffRecognitionNote,
  normalizeStaffRecognitionNoteList,
  findStaffRecognitionNote,
  recordStaffRecognitionNote,
  removeStaffRecognitionNote,
  staffRecognitionNotesSorted,
  staffRecognitionNotesForStaff,
  staffRecognitionStaffMembers,
  staffRecognitionSummaryText,
  staffRecognitionNoteText,
  staffRecognitionNoteHtml,
  staffRecognitionAllHtml,
  staffRecognitionNotesForStaffHtml,
  staffRecognitionCsv,
  staffRecognitionFilename,
} from '../staff-recognition.js';

const saadFirst = {
  id: 'SRN-1', staffMember: 'Saad', achievement: 'Stayed late to fix the fibre cut on Eid night',
  date: '2026-11-04', recognisedBy: 'Owner',
};
const saadSecond = {
  id: 'SRN-2', staffMember: 'Saad', achievement: 'Walked a new customer through the package choice',
  date: '2026-11-05', recognisedBy: 'Owner',
};
const ayesha = {
  id: 'SRN-3', staffMember: 'Ayesha', achievement: 'Collected every due bill in her mohalla before the 5th',
  date: '2026-11-03', recognisedBy: 'Saad',
};

test('strict day accepts a real date and refuses impossible or malformed days', () => {
  assert.equal(validStaffRecognitionDay('2026-11-04'), true);
  assert.equal(validStaffRecognitionDay('2028-02-29'), true);
  assert.equal(validStaffRecognitionDay('2027-02-29'), false);
  assert.equal(validStaffRecognitionDay('2026-11-31'), false);
  assert.equal(validStaffRecognitionDay('04-11-2026'), false);
  assert.equal(validStaffRecognitionDay(''), false);
  assert.equal(validStaffRecognitionDay(null), false);
});

test('normalising trims fields and drops unknown fields', () => {
  const note = normalizeStaffRecognitionNote({ ...saadFirst, staffMember: '  Saad  ', bonus: 500, billId: 'B-1' });
  assert.deepEqual(note, saadFirst);
});

test('normalising refuses a note missing any required field', () => {
  assert.equal(normalizeStaffRecognitionNote({ ...saadFirst, id: '' }), null);
  assert.equal(normalizeStaffRecognitionNote({ ...saadFirst, staffMember: '   ' }), null);
  assert.equal(normalizeStaffRecognitionNote({ ...saadFirst, achievement: '' }), null);
  assert.equal(normalizeStaffRecognitionNote({ ...saadFirst, date: '2026-11-31' }), null);
  assert.equal(normalizeStaffRecognitionNote({ ...saadFirst, recognisedBy: '' }), null);
  assert.equal(normalizeStaffRecognitionNote(null), null);
  assert.equal(normalizeStaffRecognitionNote([saadFirst]), null);
});

test('recording adds a note and refuses a duplicate id or a bad note', () => {
  const after = recordStaffRecognitionNote([saadFirst], saadSecond);
  assert.equal(after.length, 2);
  assert.equal(recordStaffRecognitionNote(after, { ...saadSecond, achievement: 'Different words' }).length, 2);
  assert.equal(recordStaffRecognitionNote([saadFirst], { ...saadSecond, date: 'not a date' }).length, 1);
});

test('removing takes out only that note and an unknown id changes nothing', () => {
  assert.deepEqual(removeStaffRecognitionNote([saadFirst, saadSecond], 'SRN-1'), [saadSecond]);
  assert.deepEqual(removeStaffRecognitionNote([saadFirst], 'SRN-9'), [saadFirst]);
});

test('finding returns the note or null', () => {
  assert.deepEqual(findStaffRecognitionNote([saadFirst, ayesha], 'SRN-3'), ayesha);
  assert.equal(findStaffRecognitionNote([saadFirst], 'SRN-9'), null);
});

test('notes sort earliest date first', () => {
  assert.deepEqual(
    staffRecognitionNotesSorted([saadSecond, ayesha, saadFirst]).map((note) => note.id),
    ['SRN-3', 'SRN-1', 'SRN-2'],
  );
});

test('notes for one staff member list by date and match regardless of capital letters', () => {
  assert.deepEqual(
    staffRecognitionNotesForStaff([saadSecond, ayesha, saadFirst], 'saad').map((note) => note.id),
    ['SRN-1', 'SRN-2'],
  );
  assert.deepEqual(staffRecognitionNotesForStaff([saadFirst], 'Ayesha'), []);
  assert.deepEqual(staffRecognitionNotesForStaff([saadFirst], ''), []);
});

test('staff members list is distinct in first-recorded order', () => {
  assert.deepEqual(
    staffRecognitionStaffMembers([saadFirst, ayesha, saadSecond]),
    ['Saad', 'Ayesha'],
  );
  assert.deepEqual(staffRecognitionStaffMembers([]), []);
});

test('summary text counts notes and staff members in plain words', () => {
  assert.equal(staffRecognitionSummaryText([]), 'No staff recognition notes recorded.');
  assert.equal(staffRecognitionSummaryText([saadFirst]), '1 recognition note for 1 staff member.');
  assert.equal(
    staffRecognitionSummaryText([saadFirst, saadSecond, ayesha]),
    '3 recognition notes for 2 staff members.',
  );
});

test('one note reads as a plain-words line with achievement and recogniser visible', () => {
  assert.equal(
    staffRecognitionNoteText(saadFirst),
    'Saad — Stayed late to fix the fibre cut on Eid night — 2026-11-04 — recognised by Owner.',
  );
  assert.equal(staffRecognitionNoteText({ ...saadFirst, date: 'bad' }), '');
});

test('html escapes user text so a note cannot break the page', () => {
  const html = staffRecognitionNoteHtml({ ...saadFirst, achievement: 'Fixed <b>the</b> cut & stayed' });
  assert.match(html, /Fixed &lt;b&gt;the&lt;\/b&gt; cut &amp; stayed/);
  assert.equal(html.includes('<b>'), false);
});

test('all html groups notes by staff member with each group by date', () => {
  const html = staffRecognitionAllHtml([saadSecond, ayesha, saadFirst]);
  assert.match(html, /<h4>Saad<\/h4>/);
  assert.match(html, /<h4>Ayesha<\/h4>/);
  assert.ok(html.indexOf('SRN-1') === -1, 'ids stay out of the display html');
  assert.ok(html.indexOf('Stayed late to fix the fibre cut') < html.indexOf('Walked a new customer'));
  assert.equal(staffRecognitionAllHtml([]), '<p>No staff recognition notes recorded.</p>');
});

test('per-staff html lists that member only and says so when there is nothing', () => {
  const html = staffRecognitionNotesForStaffHtml([saadFirst, saadSecond, ayesha], 'Saad');
  assert.match(html, /Stayed late to fix the fibre cut/);
  assert.match(html, /Walked a new customer/);
  assert.equal(html.includes('Collected every due bill'), false);
  assert.equal(
    staffRecognitionNotesForStaffHtml([saadFirst], 'Ayesha'),
    '<p>No recognition notes for that staff member.</p>',
  );
});

test('csv lists notes earliest date first with a header and the fixed filename', () => {
  const csv = staffRecognitionCsv([saadSecond, ayesha, saadFirst]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,staffMember,achievement,date,recognisedBy');
  assert.match(lines[1], /^SRN-3,Ayesha,Collected every due bill in her mohalla before the 5th,2026-11-03,Saad$/);
  assert.match(lines[2], /^SRN-1,Saad,Stayed late to fix the fibre cut on Eid night,2026-11-04,Owner$/);
  assert.equal(staffRecognitionFilename(), 'staff-recognition-notes.csv');
});

test('csv quotes an achievement that contains a comma', () => {
  const csv = staffRecognitionCsv([{ ...saadFirst, achievement: 'Fixed the cut, then checked every house' }]);
  assert.match(csv, /"Fixed the cut, then checked every house"/);
});

test('recording a note leaves the input list untouched', () => {
  const before = [saadFirst];
  const after = recordStaffRecognitionNote(before, saadSecond);
  assert.equal(before.length, 1);
  assert.equal(after.length, 2);
});

test('a note grants nothing on its own: no amount, bonus, bill, or customer field survives', () => {
  const note = normalizeStaffRecognitionNote({
    ...saadFirst, amount: 5000, bonus: 'Rs 500', billId: 'B-1', customerId: 'C-1',
  });
  assert.deepEqual(Object.keys(note).sort(), ['achievement', 'date', 'id', 'recognisedBy', 'staffMember']);
});

test('module is pure and import-free', () => {
  const source = readFileSync(new URL('../staff-recognition.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: customer recognition, leave planner, duty roster, and performance note are untouched', () => {
  const source = readFileSync(new URL('../staff-recognition.js', import.meta.url), 'utf8');
  assert.equal(source.includes('loyalty-recognition'), false, 'module must not reference the customer recognition list module');
  assert.equal(source.includes('annual-leave-plan'), false, 'module must not reference the annual leave planner module');
  assert.equal(source.includes('duty-roster'), false, 'module must not reference the duty roster module');
  assert.equal(source.includes('staff-performance'), false, 'module must not reference the staff performance note module');
  assert.equal(existsSync(new URL('../loyalty-recognition.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../annual-leave-plan.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../duty-roster.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../staff-performance.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'srnHeading', 'srnSummary', 'srnBody', 'srnExportBtn',
    'srnId', 'srnStaff', 'srnAchievement', 'srnDate', 'srnRecognisedBy', 'srnRecordBtn',
    'srnRemoveId', 'srnRemoveBtn',
    'srnStaffSelect', 'srnStaffBody',
  ];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `index.html is missing ${id}`);
});
