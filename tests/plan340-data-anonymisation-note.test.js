import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validAnonymisationNoteDay,
  normalizeAnonymisationNoteFields,
  normalizeAnonymisationNote,
  normalizeAnonymisationNoteList,
  recordAnonymisationNote,
  anonymisationNoteForCopy,
  anonymisationNotesForHolder,
  normalizeAnonymisationNoteCopyRefs,
  unapprovedAnonymisationCopies,
  anonymisationNoteCoverage,
  anonymisationNoteCounts,
  anonymisationNoteSummaryText,
  anonymisationNoteText,
  anonymisationNotesText,
  anonymisationNoteHtml,
  anonymisationNotesHtml,
  anonymisationNoteUnapprovedHtml,
  anonymisationNoteCsv,
  anonymisationNoteFilename,
} from '../data-anonymisation-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'data-anonymisation-note.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const NOTE_A = { id: 'DAN-1', copyRef: 'COPY-1', fields: ['name', 'phone'], method: 'replaced with fake values', dateMade: '2026-11-05', holder: 'Saad' };
const NOTE_B = { id: 'DAN-2', copyRef: 'COPY-2', fields: 'name, phone, address', method: 'shuffled and masked', dateMade: '2026-11-04', holder: 'Bike' };
const NOTE_C = { id: 'DAN-3', copyRef: 'COPY-3', fields: ['package'], method: 'kept, no customer data', dateMade: '2026-11-05', holder: 'Saad' };

test('valid day accepts strict dates and refuses bad ones', () => {
  assert.equal(validAnonymisationNoteDay('2026-11-05'), true);
  assert.equal(validAnonymisationNoteDay('2028-02-29'), true);
  assert.equal(validAnonymisationNoteDay('2026-02-29'), false);
  assert.equal(validAnonymisationNoteDay('2026-04-31'), false);
  assert.equal(validAnonymisationNoteDay('2026-13-01'), false);
  assert.equal(validAnonymisationNoteDay('2026-00-10'), false);
  assert.equal(validAnonymisationNoteDay('2026-11-5'), false);
  assert.equal(validAnonymisationNoteDay('05-11-2026'), false);
  assert.equal(validAnonymisationNoteDay(''), false);
  assert.equal(validAnonymisationNoteDay(null), false);
  assert.equal(validAnonymisationNoteDay(20261105), false);
});

test('fields normalize from an array or a comma string, trimmed and deduped', () => {
  assert.deepEqual(normalizeAnonymisationNoteFields(['name', ' phone ', 'NAME', '', '  ']), ['name', 'phone']);
  assert.deepEqual(normalizeAnonymisationNoteFields('name, phone, name, address'), ['name', 'phone', 'address']);
  assert.deepEqual(normalizeAnonymisationNoteFields('  name  '), ['name']);
  assert.deepEqual(normalizeAnonymisationNoteFields(''), []);
  assert.deepEqual(normalizeAnonymisationNoteFields(null), []);
  assert.deepEqual(normalizeAnonymisationNoteFields(42), []);
});

test('normalize trims fields and drops unknown fields', () => {
  const note = normalizeAnonymisationNote({ ...NOTE_A, extra: 'ignored', holder: '  Saad  ', fields: [' name ', 'phone', 'name'] });
  assert.deepEqual(note, { ...NOTE_A, fields: ['name', 'phone'] });
});

test('normalize accepts a comma string of fields', () => {
  const note = normalizeAnonymisationNote(NOTE_B);
  assert.deepEqual(note, { ...NOTE_B, fields: ['name', 'phone', 'address'] });
});

test('normalize refuses half-formed notes', () => {
  assert.equal(normalizeAnonymisationNote({ ...NOTE_A, id: '' }), null);
  assert.equal(normalizeAnonymisationNote({ ...NOTE_A, copyRef: '   ' }), null);
  assert.equal(normalizeAnonymisationNote({ ...NOTE_A, fields: [] }), null);
  assert.equal(normalizeAnonymisationNote({ ...NOTE_A, fields: ' , ' }), null);
  assert.equal(normalizeAnonymisationNote({ ...NOTE_A, method: '' }), null);
  assert.equal(normalizeAnonymisationNote({ ...NOTE_A, dateMade: '2026-02-29' }), null);
  assert.equal(normalizeAnonymisationNote({ ...NOTE_A, holder: '' }), null);
  assert.equal(normalizeAnonymisationNote(null), null);
  assert.equal(normalizeAnonymisationNote('note'), null);
});

test('normalize list keeps only well-formed notes', () => {
  assert.deepEqual(normalizeAnonymisationNoteList([NOTE_A, { ...NOTE_B, holder: '' }, NOTE_C]), [NOTE_A, NOTE_C]);
  assert.deepEqual(normalizeAnonymisationNoteList(null), []);
  assert.deepEqual(normalizeAnonymisationNoteList('nope'), []);
});

test('record appends a note and never rewrites a duplicate id', () => {
  const next = recordAnonymisationNote([NOTE_A], NOTE_B);
  assert.deepEqual(next, [NOTE_A, { ...NOTE_B, fields: ['name', 'phone', 'address'] }]);
  assert.deepEqual(recordAnonymisationNote([NOTE_A], { ...NOTE_A, method: 'different' }), [NOTE_A]);
});

test('record refuses a half-formed note and leaves the list alone', () => {
  assert.deepEqual(recordAnonymisationNote([NOTE_A], { ...NOTE_B, dateMade: 'bad' }), [NOTE_A]);
  assert.deepEqual(recordAnonymisationNote([NOTE_A], null), [NOTE_A]);
});

test('record never mutates its input', () => {
  const frozen = deepFreeze([NOTE_A]);
  const next = recordAnonymisationNote(frozen, NOTE_B);
  assert.equal(frozen.length, 1);
  assert.equal(next.length, 2);
  assert.notEqual(next, frozen);
});

test('lookup by copy reference is case-insensitive', () => {
  assert.deepEqual(anonymisationNoteForCopy([NOTE_A, NOTE_B], 'copy-1'), NOTE_A);
  assert.deepEqual(anonymisationNoteForCopy([NOTE_A, NOTE_B], ' COPY-2 '), { ...NOTE_B, fields: ['name', 'phone', 'address'] });
  assert.equal(anonymisationNoteForCopy([NOTE_A], 'COPY-9'), null);
  assert.equal(anonymisationNoteForCopy([NOTE_A], ''), null);
});

test('notes for a holder list in date order, case-insensitive', () => {
  assert.deepEqual(anonymisationNotesForHolder([NOTE_B, NOTE_C, NOTE_A], 'saad'), [NOTE_A, NOTE_C]);
  assert.deepEqual(anonymisationNotesForHolder([NOTE_A], 'Bike'), []);
  assert.deepEqual(anonymisationNotesForHolder([NOTE_A], ''), []);
});

test('copy refs normalize like fields, deduped case-insensitively', () => {
  assert.deepEqual(normalizeAnonymisationNoteCopyRefs(['COPY-1', ' copy-1 ', 'COPY-2', '']), ['COPY-1', 'COPY-2']);
  assert.deepEqual(normalizeAnonymisationNoteCopyRefs('COPY-1, COPY-2, copy-1'), ['COPY-1', 'COPY-2']);
  assert.deepEqual(normalizeAnonymisationNoteCopyRefs(null), []);
});

test('copies with no note are flagged unapproved', () => {
  assert.deepEqual(unapprovedAnonymisationCopies([NOTE_A, NOTE_B], ['COPY-1', 'COPY-2', 'COPY-9']), ['COPY-9']);
  assert.deepEqual(unapprovedAnonymisationCopies([NOTE_A], 'COPY-1, COPY-2'), ['COPY-2']);
  assert.deepEqual(unapprovedAnonymisationCopies([NOTE_A], []), []);
  assert.deepEqual(unapprovedAnonymisationCopies([], ['COPY-1']), ['COPY-1']);
});

test('coverage counts reconcile to the copies listed', () => {
  const coverage = anonymisationNoteCoverage([NOTE_A, NOTE_B], ['COPY-1', 'COPY-2', 'COPY-9', 'COPY-10']);
  assert.deepEqual(coverage, { total: 4, noted: 2, unapproved: 2, unapprovedRefs: ['COPY-9', 'COPY-10'] });
  assert.equal(coverage.noted + coverage.unapproved, coverage.total);
  assert.deepEqual(anonymisationNoteCoverage([NOTE_A], []), { total: 0, noted: 0, unapproved: 0, unapprovedRefs: [] });
});

test('counts count notes and distinct copies', () => {
  assert.deepEqual(anonymisationNoteCounts([NOTE_A, NOTE_B, NOTE_C]), { total: 3, copies: 3 });
  assert.deepEqual(anonymisationNoteCounts([NOTE_A, { ...NOTE_A, id: 'DAN-9' }]), { total: 2, copies: 1 });
  assert.deepEqual(anonymisationNoteCounts([]), { total: 0, copies: 0 });
});

test('summary text names notes, copies, and unapproved copies', () => {
  assert.equal(anonymisationNoteSummaryText([], []), 'No anonymisation notes.');
  assert.equal(anonymisationNoteSummaryText([NOTE_A], ['COPY-1']), '1 anonymisation note covering 1 copy.');
  assert.equal(anonymisationNoteSummaryText([NOTE_A, NOTE_B], ['COPY-1', 'COPY-2', 'COPY-9']), '2 anonymisation notes covering 2 copies. 1 copy unapproved for training use.');
  assert.equal(anonymisationNoteSummaryText([NOTE_A], ['COPY-1', 'COPY-2', 'COPY-3']), '1 anonymisation note covering 1 copy. 2 copies unapproved for training use.');
});

test('plain text names the copy and every anonymised field', () => {
  assert.equal(anonymisationNoteText(NOTE_A), 'COPY-1 — fields: name, phone; method: replaced with fake values; made 2026-11-05; holder Saad');
  assert.equal(anonymisationNoteText({ ...NOTE_A, holder: '' }), '');
  assert.equal(anonymisationNotesText([]), 'No anonymisation notes.');
  assert.equal(anonymisationNotesText([NOTE_B, NOTE_A]), 'COPY-2 — fields: name, phone, address; method: shuffled and masked; made 2026-11-04; holder Bike\nCOPY-1 — fields: name, phone; method: replaced with fake values; made 2026-11-05; holder Saad');
});

test('html escapes user-entered text', () => {
  const risky = { ...NOTE_A, method: '<script>alert(1)</script>', holder: 'Saad & Bike' };
  const html = anonymisationNoteHtml(risky);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Saad &amp; Bike'));
  assert.equal(anonymisationNoteHtml({ ...NOTE_A, holder: '' }), '');
  assert.equal(anonymisationNotesHtml([]), '<p>No anonymisation notes yet.</p>');
  assert.ok(anonymisationNotesHtml([NOTE_A]).includes('COPY-1'));
});

test('unapproved html lists flagged copies and escapes them', () => {
  const html = anonymisationNoteUnapprovedHtml([NOTE_A], ['COPY-1', 'COPY-<9>']);
  assert.ok(html.includes('COPY-&lt;9&gt;'));
  assert.ok(html.includes('no anonymisation note'));
  assert.equal(anonymisationNoteUnapprovedHtml([NOTE_A], ['COPY-1']), '<p>No copies unapproved for training use.</p>');
});

test('csv exports every field and the filename is fixed', () => {
  const csv = anonymisationNoteCsv([NOTE_A, NOTE_B]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,copyRef,fields,method,dateMade,holder');
  assert.equal(lines[1], 'DAN-1,COPY-1,name; phone,replaced with fake values,2026-11-05,Saad');
  assert.equal(lines[2], 'DAN-2,COPY-2,name; phone; address,shuffled and masked,2026-11-04,Bike');
  assert.equal(anonymisationNoteCsv([]), 'id,copyRef,fields,method,dateMade,holder');
  assert.equal(anonymisationNoteFilename(), 'data-anonymisation-notes.csv');
});

test('csv quotes a method containing a comma', () => {
  const csv = anonymisationNoteCsv([{ ...NOTE_A, method: 'masked, then shuffled' }]);
  assert.ok(csv.includes('"masked, then shuffled"'));
});

test('module is pure: no page, storage, clock, or network access', () => {
  assert.ok(!/document\./.test(moduleSrc));
  assert.ok(!/localStorage/.test(moduleSrc));
  assert.ok(!/new Date\(/.test(moduleSrc));
  assert.ok(!/Date\.now\(/.test(moduleSrc));
  assert.ok(!/fetch\(/.test(moduleSrc));
  assert.ok(!/window\./.test(moduleSrc));
  assert.ok(!/import /.test(moduleSrc));
});

test('module never mentions the fenced backup check by filename', () => {
  assert.ok(!moduleSrc.includes('backup-verification'));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
});

test('app.js wires the panel: import, store key, render, and render-all call', () => {
  assert.ok(appJs.includes("from './data-anonymisation-note.js'"));
  assert.ok(appJs.includes("shahdara_dan_notes_v1"));
  assert.ok(appJs.includes('function renderDataAnonymisationNotes()'));
  assert.ok(appJs.includes('renderDataAnonymisationNotes();'));
  assert.ok(appJs.includes('anonymisationNoteBound'));
});

test('app.js additions carry no standalone OLT word', () => {
  const start = appJs.indexOf("from './data-anonymisation-note.js'");
  const end = appJs.indexOf('let duplicationCheckBound');
  const added = appJs.slice(start, end);
  assert.ok(added.length > 0);
  assert.ok(!/\bOLT\b/i.test(added));
});

test('index.html carries the panel with dan ids and a plain heading', () => {
  assert.ok(indexHtml.includes('id="danHeading"'));
  assert.ok(indexHtml.includes('Data anonymisation note'));
  assert.ok(indexHtml.includes('id="danBody"'));
  assert.ok(indexHtml.includes('id="danSummary"'));
  assert.ok(indexHtml.includes('id="danUnapprovedBody"'));
  assert.ok(indexHtml.includes('id="danSaveBtn"'));
  assert.ok(indexHtml.includes('id="danExportBtn"'));
  assert.ok(indexHtml.includes('id="danCopyRef"'));
  assert.ok(indexHtml.includes('id="danFields"'));
  assert.ok(indexHtml.includes('id="danMethod"'));
  assert.ok(indexHtml.includes('id="danDateMade"'));
  assert.ok(indexHtml.includes('id="danHolder"'));
  assert.ok(indexHtml.includes('id="danCheckRefs"'));
  assert.ok(indexHtml.includes('id="danCheckBtn"'));
});
