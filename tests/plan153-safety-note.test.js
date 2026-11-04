import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeSafetyNote,
  normalizeSafetyNoteList,
  findSafetyNote,
  upsertSafetyNote,
  removeSafetyNote,
  notesForLocation,
  safetyNoteLocations,
  safetyNoteSummaryText,
  safetyNoteLocationHtml,
  safetyNoteAllHtml,
  safetyNoteCsv,
  safetyNoteFilename,
} from '../safety-note.js';

const dir = dirname(fileURLToPath(import.meta.url));

const note = (over = {}) => ({
  id: 'S-1',
  location: 'Mohalla A',
  hazard: 'Risky pole leaning over the lane',
  dateNoted: '2026-10-01',
  precaution: 'Do not climb; call the supervisor first',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(normalizeSafetyNote(note({ dateNoted: '2026-08-31' })).dateNoted, '2026-08-31');
  assert.equal(normalizeSafetyNote(note({ dateNoted: '2026-10-31' })).dateNoted, '2026-10-31');
  assert.equal(normalizeSafetyNote(note({ dateNoted: '2026-12-31' })).dateNoted, '2026-12-31');
  assert.equal(normalizeSafetyNote(note({ dateNoted: '2026-02-30' })), null);
  assert.equal(normalizeSafetyNote(note({ dateNoted: '2026-04-31' })), null);
  assert.equal(normalizeSafetyNote(note({ dateNoted: '2026-02-29' })), null);
  assert.equal(normalizeSafetyNote(note({ dateNoted: '2024-02-29' })).dateNoted, '2024-02-29');
});

test('half-formed notes refused: no location or no hazard refused', () => {
  assert.equal(normalizeSafetyNote(note({ location: '  ' })), null);
  assert.equal(normalizeSafetyNote(note({ hazard: '' })), null);
  assert.equal(normalizeSafetyNote(note({ dateNoted: '' })), null);
  assert.equal(normalizeSafetyNote(note({ id: '' })), null);
  assert.equal(normalizeSafetyNote(null), null);
  assert.deepEqual(normalizeSafetyNoteList([note(), note({ location: '' }), note({ id: 'S-2', location: 'Mohalla B' })]).map((row) => row.id), ['S-1', 'S-2']);
});

test('precaution is optional: a note without one still records', () => {
  const clean = normalizeSafetyNote(note({ precaution: '' }));
  assert.equal(clean.precaution, '');
  assert.equal(normalizeSafetyNote(note({ precaution: undefined })).precaution, '');
});

test('unknown fields dropped, so no visit-outcome, ticket, bill, or payment field can creep in', () => {
  const clean = normalizeSafetyNote(note({ visitOutcome: 'done', ticketId: 'T-1', billId: 'B-1', payment: 500, status: 'closed' }));
  assert.deepEqual(Object.keys(clean).sort(), ['dateNoted', 'hazard', 'id', 'location', 'precaution']);
});

test('duplicate ids never rewritten: identical re-save unchanged, different figures refused', () => {
  const base = upsertSafetyNote([], note());
  assert.equal(upsertSafetyNote(base, note()).length, 1);
  assert.equal(upsertSafetyNote(base, note({ hazard: 'Different hazard' })).length, 1);
  assert.equal(upsertSafetyNote(base, note({ hazard: 'Different hazard' }))[0].hazard, 'Risky pole leaning over the lane');
  assert.equal(upsertSafetyNote(base, note({ id: 'S-2', location: 'Mohalla B' })).length, 2);
});

test('find and remove', () => {
  const list = [note(), note({ id: 'S-2', location: 'Mohalla B' })];
  assert.equal(findSafetyNote(list, 'S-2').location, 'Mohalla B');
  assert.equal(findSafetyNote(list, 'S-9'), null);
  assert.deepEqual(removeSafetyNote(list, 'S-1').map((row) => row.id), ['S-2']);
  assert.equal(removeSafetyNote(list, 'S-9').length, 2);
});

test('location view: case-insensitive match, newest first, empty filter gives nothing', () => {
  const list = [
    note({ id: 'S-1', dateNoted: '2026-10-01' }),
    note({ id: 'S-2', dateNoted: '2026-10-05', hazard: 'Exposed wiring at the junction box' }),
    note({ id: 'S-3', location: 'Mohalla B', dateNoted: '2026-10-03' }),
    note({ id: 'S-4', dateNoted: '2026-10-05', hazard: 'Aggressive dog at the corner house' }),
  ];
  assert.deepEqual(notesForLocation(list, 'mohalla a').map((row) => row.id), ['S-2', 'S-4', 'S-1']);
  assert.deepEqual(notesForLocation(list, 'Mohalla B').map((row) => row.id), ['S-3']);
  assert.deepEqual(notesForLocation(list, 'Nowhere'), []);
  assert.deepEqual(notesForLocation(list, '  '), []);
});

test('locations list and summary text', () => {
  const list = [note(), note({ id: 'S-2', location: 'Mohalla B' }), note({ id: 'S-3', location: 'mohalla a' })];
  assert.deepEqual(safetyNoteLocations(list), ['Mohalla A', 'Mohalla B', 'mohalla a']);
  assert.equal(safetyNoteSummaryText(list), '3 safety notes recorded across 3 locations.');
  assert.equal(safetyNoteSummaryText([note()]), '1 safety note recorded across 1 location.');
  assert.equal(safetyNoteSummaryText([]), '0 safety notes recorded across 0 locations.');
});

test('location HTML surfaces notes before a visit, with precaution and escaping', () => {
  const list = [note({ hazard: '<script>alert(1)</script>', precaution: 'Stay & wait' })];
  const html = safetyNoteLocationHtml(list, 'Mohalla A');
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('Stay &amp; wait'));
  assert.ok(html.includes('read before the visit'));
  assert.ok(safetyNoteLocationHtml(list, 'Mohalla B').includes('No safety notes for this location'));
});

test('full list HTML newest first, empty list says so', () => {
  const list = [note({ id: 'S-1', dateNoted: '2026-10-01' }), note({ id: 'S-2', location: 'Mohalla B', dateNoted: '2026-10-05' })];
  const html = safetyNoteAllHtml(list);
  assert.ok(html.indexOf('S-2') < html.indexOf('S-1'));
  assert.ok(safetyNoteAllHtml([]).includes('No safety notes recorded yet'));
});

test('CSV and filename', () => {
  const list = [note({ hazard: 'Dog, aggressive', precaution: 'Carry a "stick"' })];
  const csv = safetyNoteCsv(list);
  assert.ok(csv.startsWith('id,location,hazard,dateNoted,precaution'));
  assert.ok(csv.includes('"Dog, aggressive"'));
  assert.ok(csv.includes('"Carry a ""stick"""'));
  assert.equal(safetyNoteFilename(), 'field-safety-notes.csv');
});

test('inputs never mutated', () => {
  const raw = note();
  const before = JSON.stringify(raw);
  upsertSafetyNote([], raw);
  normalizeSafetyNoteList([raw]);
  assert.equal(JSON.stringify(raw), before);
});

test('purity fence: module never imports, reads storage, or touches the clock', () => {
  const src = readFileSync(join(dir, '..', 'safety-note.js'), 'utf8');
  assert.ok(!/^import /m.test(src));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('Date.now'));
  assert.ok(!src.includes('fetch('));
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['safetyLocation', 'safetyHazard', 'safetyDate', 'safetyPrecaution', 'safetySaveBtn', 'safetyRemoveId', 'safetyRemoveBtn', 'safetyFilter', 'safetyBody', 'safetySummary', 'safetyExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
