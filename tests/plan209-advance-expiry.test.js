import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validExpiryDate,
  normalizeExpiryNote,
  normalizeExpiryList,
  findExpiryNote,
  recordExpiryNote,
  removeExpiryNote,
  expiryNotesSorted,
  expiryNotesForAdvance,
  expiryNotesNearing,
  expiryNotesOverdue,
  expiryDaysLeft,
  expiryNoteText,
  expirySummaryText,
  expiryReviewText,
  expiryNoteHtml,
  expiryAllHtml,
  expiryCsv,
  expiryFilename,
} from '../advance-expiry.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'advance-expiry.js'), 'utf8');

const noteA = { id: 'AE-1', advanceRef: 'ADV-101', remainingAmount: 'Rs 2,000', termDate: '2026-12-31', note: 'Review with customer' };
const noteB = { id: 'AE-2', advanceRef: 'ADV-102', remainingAmount: 'Rs 500', termDate: '2026-11-20' };
const noteC = { id: 'AE-3', advanceRef: 'ADV-101', remainingAmount: 'Rs 750', termDate: '2026-11-10', note: 'Second advance note' };

test('half-formed expiry notes are refused', () => {
  assert.equal(normalizeExpiryNote({ advanceRef: 'ADV-1', remainingAmount: 'Rs 100', termDate: '2026-12-31' }), null);
  assert.equal(normalizeExpiryNote({ id: 'AE-9', remainingAmount: 'Rs 100', termDate: '2026-12-31' }), null);
  assert.equal(normalizeExpiryNote({ id: 'AE-9', advanceRef: 'ADV-1', termDate: '2026-12-31' }), null);
  assert.equal(normalizeExpiryNote({ id: 'AE-9', advanceRef: 'ADV-1', remainingAmount: 'Rs 100' }), null);
  assert.equal(normalizeExpiryNote({ ...noteA, termDate: '2026-02-30' }), null);
  assert.equal(normalizeExpiryNote({ ...noteA, termDate: 'not-a-date' }), null);
});

test('strict calendar dates: 31-day months, Feb 29 leap and non-leap', () => {
  assert.equal(validExpiryDate('2026-08-31'), true);
  assert.equal(validExpiryDate('2026-08-32'), false);
  assert.equal(validExpiryDate('2026-02-30'), false);
  assert.equal(validExpiryDate('2024-02-29'), true);
  assert.equal(validExpiryDate('2026-02-29'), false);
  assert.equal(validExpiryDate('2026-11-02'), true);
  assert.equal(validExpiryDate('2026-13-01'), false);
  assert.equal(validExpiryDate('2026-1-02'), false);
  assert.equal(normalizeExpiryNote({ ...noteA, termDate: '2026-02-30' }), null);
});

test('unknown fields are dropped, so no forfeiture, bill, or payment field can creep in', () => {
  const clean = normalizeExpiryNote({ ...noteA, forfeit: true, expireNow: true, billId: 'B-1', paymentId: 'P-1', creditBalance: 500 });
  assert.deepEqual(Object.keys(clean).sort(), ['advanceRef', 'id', 'note', 'remainingAmount', 'termDate']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordExpiryNote([noteA], { ...noteA, remainingAmount: 'Rs 9,999' });
  assert.equal(list.length, 1);
  assert.equal(list[0].remainingAmount, 'Rs 2,000');
});

test('list normalization drops bad entries and non-arrays', () => {
  assert.deepEqual(normalizeExpiryList(null), []);
  assert.deepEqual(normalizeExpiryList('nope'), []);
  assert.deepEqual(normalizeExpiryList([noteA, { id: 'AE-9' }, noteB]).map((n) => n.id), ['AE-1', 'AE-2']);
});

test('find and remove by id', () => {
  assert.equal(findExpiryNote([noteA, noteB], 'AE-2').advanceRef, 'ADV-102');
  assert.equal(findExpiryNote([noteA, noteB], 'AE-9'), null);
  assert.equal(findExpiryNote([noteA, noteB], ''), null);
  assert.deepEqual(removeExpiryNote([noteA, noteB], 'AE-1').map((n) => n.id), ['AE-2']);
  assert.equal(removeExpiryNote([noteA, noteB], '').length, 2);
});

test('review list is ordered by term date, then advance reference, then id', () => {
  const sorted = expiryNotesSorted([noteA, noteB, noteC]);
  assert.deepEqual(sorted.map((n) => n.id), ['AE-3', 'AE-2', 'AE-1']);
  const tied = expiryNotesSorted([
    { id: 'AE-9', advanceRef: 'ADV-200', remainingAmount: 'Rs 10', termDate: '2026-12-01' },
    { id: 'AE-8', advanceRef: 'ADV-100', remainingAmount: 'Rs 10', termDate: '2026-12-01' },
  ]);
  assert.deepEqual(tied.map((n) => n.id), ['AE-8', 'AE-9']);
});

test('filter by advance reference is case-insensitive substring', () => {
  assert.deepEqual(expiryNotesForAdvance([noteA, noteB, noteC], 'adv-101').map((n) => n.id), ['AE-3', 'AE-1']);
  assert.deepEqual(expiryNotesForAdvance([noteA, noteB], '').map((n) => n.id), ['AE-2', 'AE-1']);
});

test('nearing list: boundaries inclusive, overdue excluded, window honoured', () => {
  const list = [noteA, noteB, noteC];
  const nearing = expiryNotesNearing(list, '2026-11-01', 30);
  assert.deepEqual(nearing.map((n) => n.id), ['AE-3', 'AE-2']);
  assert.deepEqual(expiryNotesNearing(list, '2026-11-10', 30).map((n) => n.id), ['AE-3', 'AE-2']);
  assert.deepEqual(expiryNotesNearing(list, '2026-11-01', 5), []);
  assert.deepEqual(expiryNotesNearing(list, 'not-a-date', 30), []);
  assert.deepEqual(expiryNotesNearing(list, '2026-11-01', 0).map((n) => n.id), []);
});

test('overdue list holds only terms before the reference date', () => {
  assert.deepEqual(expiryNotesOverdue([noteA, noteB, noteC], '2026-11-15').map((n) => n.id), ['AE-3']);
  assert.deepEqual(expiryNotesOverdue([noteA, noteB, noteC], '2026-11-10'), []);
  assert.deepEqual(expiryNotesOverdue([noteA], 'bad-date'), []);
});

test('days left: positive, zero, negative, and bad inputs', () => {
  assert.equal(expiryDaysLeft(noteB, '2026-11-01'), 19);
  assert.equal(expiryDaysLeft(noteB, '2026-11-20'), 0);
  assert.equal(expiryDaysLeft(noteB, '2026-11-25'), -5);
  assert.equal(expiryDaysLeft(noteB, 'bad-date'), null);
  assert.equal(expiryDaysLeft({ id: 'AE-9' }, '2026-11-01'), null);
});

test('note text names the advance, its remaining amount, and its term', () => {
  assert.equal(expiryNoteText(noteA), 'Advance ADV-101 · Remaining: Rs 2,000 · Term: 2026-12-31 — Review with customer');
  assert.equal(expiryNoteText(noteB), 'Advance ADV-102 · Remaining: Rs 500 · Term: 2026-11-20 — No note.');
  assert.equal(expiryNoteText({ id: 'AE-9' }), '');
});

test('summary text for zero, one, and many notes', () => {
  assert.equal(expirySummaryText([]), 'No advance expiry notes recorded.');
  assert.equal(expirySummaryText([noteA]), '1 advance expiry note recorded.');
  assert.equal(expirySummaryText([noteA, noteB]), '2 advance expiry notes recorded.');
});

test('review text separates overdue from nearing and handles quiet days', () => {
  const text = expiryReviewText([noteA, noteB, noteC], '2026-11-15', 30);
  assert.match(text, /Overdue: Advance ADV-101/);
  assert.match(text, /Nearing term: Advance ADV-102/);
  assert.equal(expiryReviewText([noteA], '2026-11-01', 30), 'No advances nearing their term from 2026-11-01.');
  assert.equal(expiryReviewText([noteA], 'bad-date', 30), '');
});

test('HTML escapes operator text', () => {
  const html = expiryNoteHtml({ ...noteA, note: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.equal(expiryNoteHtml({ id: 'AE-9' }), '');
  assert.match(expiryAllHtml([noteB, noteA]), /ADV-102[\s\S]*ADV-101/);
});

test('CSV export and filename', () => {
  const csv = expiryCsv([noteB, noteA]);
  assert.ok(csv.startsWith('id,advance_ref,remaining_amount,term_date,note'));
  assert.match(csv, /AE-2,ADV-102,Rs 500,2026-11-20,/);
  assert.equal(expiryFilename(), 'advance-expiry.csv');
});

test('inputs are never mutated', () => {
  const raw = { ...noteA };
  const before = JSON.stringify(raw);
  recordExpiryNote([], raw);
  normalizeExpiryNote(raw);
  expiryNotesSorted([raw]);
  assert.equal(JSON.stringify(raw), before);
});

test('purity fence: the module is import-free and touches no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /^import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['aeSummary', 'aeExportBtn', 'aeRef', 'aeAmount', 'aeTerm', 'aeNote', 'aeSaveBtn', 'aeRemoveId', 'aeRemoveBtn', 'aeRefFilter', 'aeReviewDate', 'aeReviewBtn', 'aeReviewBody', 'aeBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the advance-expiry store and render function', () => {
  assert.match(appJs, /shahdara_advance_expiry_v1/);
  assert.match(appJs, /renderAdvanceExpiry\(\)/);
  assert.match(appJs, /advance-expiry\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Z])OLT(?![A-Z])/g) || [];
  assert.equal(matches.length, 0);
});
