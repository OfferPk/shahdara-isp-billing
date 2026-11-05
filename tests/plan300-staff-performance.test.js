import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  normalizeStaffPerformanceNote,
  normalizeStaffPerformanceNoteList,
  findStaffPerformanceNote,
  recordStaffPerformanceNote,
  removeStaffPerformanceNote,
  staffPerformanceNotesSorted,
  staffPerformanceNotesForStaff,
  staffPerformanceStaff,
  staffPerformanceNoteSummaryText,
  staffPerformanceNoteEntryText,
  staffPerformanceNoteEntryHtml,
  staffPerformanceNoteAllHtml,
  staffPerformanceNotesForStaffHtml,
  staffPerformanceNoteCsv,
  staffPerformanceNoteFilename,
} from '../staff-performance.js';

const first = {
  id: 'SPN-1',
  staff: 'Saad',
  period: '2026-11',
  strengths: 'Knows every street and is trusted by customers',
  areasToImprove: 'Write the collection note the same day',
  reviewer: 'Owner',
};
const second = {
  id: 'SPN-2',
  staff: 'Saad',
  period: '2026-10',
  strengths: 'Calm with difficult customers',
  areasToImprove: 'Start the route earlier in the morning',
  reviewer: 'Owner',
};
const third = {
  id: 'SPN-3',
  staff: 'Bilal',
  period: '2026-11',
  strengths: 'Quick to learn the billing screen',
  areasToImprove: 'Double-check the amount before saving',
  reviewer: 'Owner',
};
const fixture = [first, second, third];

test('half-formed notes are refused', () => {
  assert.equal(normalizeStaffPerformanceNote(null), null);
  assert.equal(normalizeStaffPerformanceNote({}), null);
  assert.equal(normalizeStaffPerformanceNote({ ...first, id: '' }), null);
  assert.equal(normalizeStaffPerformanceNote({ ...first, staff: '' }), null);
  assert.equal(normalizeStaffPerformanceNote({ ...first, period: '' }), null);
  assert.equal(normalizeStaffPerformanceNote({ ...first, strengths: '' }), null);
  assert.equal(normalizeStaffPerformanceNote({ ...first, areasToImprove: '' }), null);
  assert.equal(normalizeStaffPerformanceNote({ ...first, reviewer: '' }), null);
  assert.deepEqual(normalizeStaffPerformanceNote({ ...first, staff: '  Saad  ' }), { ...first, staff: 'Saad' });
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 5000, paymentId: 'P-1', customer: 'Ali', visits: 12, cash: 90000, extra: 'x' };
  const clean = normalizeStaffPerformanceNote(raw);
  assert.equal(clean.billAmount, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.customer, undefined);
  assert.equal(clean.visits, undefined);
  assert.equal(clean.cash, undefined);
  assert.equal(clean.extra, undefined);
  assert.deepEqual(raw, { ...first, billAmount: 5000, paymentId: 'P-1', customer: 'Ali', visits: 12, cash: 90000, extra: 'x' });
  const list = [{ ...first, billAmount: 1 }];
  const out = normalizeStaffPerformanceNoteList(list);
  assert.equal(out[0].billAmount, undefined);
  assert.deepEqual(list, [{ ...first, billAmount: 1 }]);
});

test('duplicate ids are never rewritten', () => {
  const next = recordStaffPerformanceNote(fixture, { ...second, id: 'SPN-1', period: '2026-09', strengths: 'Other' });
  assert.deepEqual(next, normalizeStaffPerformanceNoteList(fixture));
  assert.equal(findStaffPerformanceNote(fixture, 'SPN-1').strengths, 'Knows every street and is trusted by customers');
});

test('find and remove', () => {
  assert.deepEqual(findStaffPerformanceNote(fixture, 'SPN-2'), second);
  assert.equal(findStaffPerformanceNote(fixture, 'SPN-9'), null);
  assert.equal(findStaffPerformanceNote(fixture, ''), null);
  assert.equal(removeStaffPerformanceNote(fixture, 'SPN-2').length, 2);
  assert.equal(removeStaffPerformanceNote(fixture, 'SPN-9').length, 3);
});

test('sorting by staff A-Z, then period, then id', () => {
  const sorted = staffPerformanceNotesSorted([third, first, second]);
  assert.deepEqual(sorted.map((n) => n.id), ['SPN-3', 'SPN-2', 'SPN-1']);
});

test('notes for one staff member, in period order, first spelling kept', () => {
  assert.deepEqual(staffPerformanceNotesForStaff(fixture, 'saad').map((n) => n.id), ['SPN-2', 'SPN-1']);
  assert.deepEqual(staffPerformanceNotesForStaff(fixture, 'Bilal').map((n) => n.id), ['SPN-3']);
  assert.deepEqual(staffPerformanceNotesForStaff(fixture, 'Nobody'), []);
  assert.deepEqual(staffPerformanceNotesForStaff(fixture, ''), []);
  const mixed = [{ ...first, id: 'SPN-4', period: '2026-09', staff: 'saad' }];
  assert.deepEqual(staffPerformanceStaff([...fixture, ...mixed]), ['Bilal', 'Saad']);
});

test('entry text names strengths, areas to improve, and the reviewer', () => {
  assert.equal(
    staffPerformanceNoteEntryText(first),
    'Saad — 2026-11: Strengths: Knows every street and is trusted by customers. Areas to improve: Write the collection note the same day. Reviewed by Owner.',
  );
  assert.equal(staffPerformanceNoteEntryText(null), 'No staff performance note recorded.');
});

test('summary text names the latest note', () => {
  assert.equal(staffPerformanceNoteSummaryText([]), 'No staff performance notes recorded.');
  assert.equal(
    staffPerformanceNoteSummaryText(fixture),
    '3 staff performance notes recorded. Latest: Saad, 2026-11, reviewed by Owner.',
  );
  assert.equal(
    staffPerformanceNoteSummaryText([first]),
    '1 staff performance note recorded. Latest: Saad, 2026-11, reviewed by Owner.',
  );
});

test('HTML is escaped', () => {
  const nasty = { ...first, staff: '<b>Saad</b>', strengths: 'Kind & patient "always"' };
  const html = staffPerformanceNoteEntryHtml(nasty);
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('&lt;b&gt;Saad&lt;/b&gt;'), true);
  assert.equal(html.includes('Kind &amp; patient &quot;always&quot;'), true);
  assert.equal(staffPerformanceNoteEntryHtml(null), '<p>No staff performance note recorded.</p>');
  assert.equal(staffPerformanceNoteAllHtml([]), '<p>No staff performance notes recorded.</p>');
  assert.equal(staffPerformanceNotesForStaffHtml([], 'Saad'), '<p>No staff performance notes recorded for this staff member.</p>');
  assert.equal(staffPerformanceNoteAllHtml(fixture).includes('<li>'), true);
});

test('CSV export and filename', () => {
  const csv = staffPerformanceNoteCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","staff","period","strengths","areas to improve","reviewer"');
  assert.equal(csv.includes('"SPN-3","Bilal","2026-11","Quick to learn the billing screen","Double-check the amount before saving","Owner"'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"SPN-3"'), true);
  assert.equal(staffPerformanceNoteFilename(), 'staff-performance-notes.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeStaffPerformanceNoteList(null), []);
  assert.deepEqual(normalizeStaffPerformanceNoteList('nope'), []);
  assert.deepEqual(normalizeStaffPerformanceNoteList([first, null, { ...first, id: '' }]).length, 1);
  assert.deepEqual(normalizeStaffPerformanceNoteList([first, { ...second, id: 'SPN-1' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../staff-performance.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: measured performance view and training record are untouched', () => {
  const source = readFileSync(new URL('../staff-performance.js', import.meta.url), 'utf8');
  assert.equal(source.includes('collector-performance.js'), false, 'module must not reference the measured performance view');
  assert.equal(source.includes('staff-training.js'), false, 'module must not reference the training record');
  assert.equal(existsSync(new URL('../collector-performance.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../staff-training.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'spnHeading', 'spnSummary', 'spnExportBtn', 'spnStaff', 'spnPeriod',
    'spnStrengths', 'spnAreas', 'spnReviewer', 'spnRecordBtn',
    'spnRemoveId', 'spnRemoveBtn', 'spnStaffInput', 'spnStaffBtn',
    'spnStaffBody', 'spnBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the staff performance note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './staff-performance.js'"), true);
  assert.equal(source.includes('renderStaffPerformanceNotes()'), true);
  assert.equal(source.includes('loadStaffPerformanceNotes()'), true);
  assert.equal(source.includes('shahdara_staff_performance_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
