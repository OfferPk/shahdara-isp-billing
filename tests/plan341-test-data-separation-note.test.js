import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validTestDataSeparationDay,
  normalizeTestDataSeparationRecords,
  normalizeTestDataSeparationNote,
  normalizeTestDataSeparationNoteList,
  recordTestDataSeparationNote,
  testDataSeparationNoteForSet,
  openTestDataSeparationNotes,
  clearTestDataSeparationNote,
  normalizeTestDataSeparationLedgerRecords,
  splitTestDataRecords,
  testDataSeparationNoteCounts,
  testDataSeparationNoteSummaryText,
  testDataSeparationNoteText,
  testDataSeparationNotesText,
  testDataSeparationNoteHtml,
  testDataSeparationNotesHtml,
  testDataSeparationOpenHtml,
  testDataSeparationNoteCsv,
  testDataSeparationNoteFilename,
} from '../test-data-separation-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'test-data-separation-note.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const NOTE_A = { id: 'TDS-1', setRef: 'SET-1', records: ['CUST-T1', 'BILL-T1'], method: 'marked with TEST prefix', dateCreated: '2026-11-05', dateCleared: '' };
const NOTE_B = { id: 'TDS-2', setRef: 'SET-2', records: 'CUST-T2, BILL-T2', method: 'kept in a separate test list', dateCreated: '2026-11-04', dateCleared: '' };
const NOTE_C = { id: 'TDS-3', setRef: 'SET-3', records: ['CUST-T3'], method: 'marked with TEST prefix', dateCreated: '2026-11-05', dateCleared: '2026-11-06' };

test('valid day accepts strict dates and refuses bad ones', () => {
  assert.equal(validTestDataSeparationDay('2026-11-05'), true);
  assert.equal(validTestDataSeparationDay('2028-02-29'), true);
  assert.equal(validTestDataSeparationDay('2026-02-29'), false);
  assert.equal(validTestDataSeparationDay('2026-04-31'), false);
  assert.equal(validTestDataSeparationDay('2026-13-01'), false);
  assert.equal(validTestDataSeparationDay('2026-00-10'), false);
  assert.equal(validTestDataSeparationDay('2026-11-5'), false);
  assert.equal(validTestDataSeparationDay('05-11-2026'), false);
  assert.equal(validTestDataSeparationDay(''), false);
  assert.equal(validTestDataSeparationDay(null), false);
  assert.equal(validTestDataSeparationDay(20261105), false);
});

test('records normalize from an array or a comma string, trimmed and deduped', () => {
  assert.deepEqual(normalizeTestDataSeparationRecords(['CUST-T1', ' bill-t1 ', 'cust-t1', '', '  ']), ['CUST-T1', 'bill-t1']);
  assert.deepEqual(normalizeTestDataSeparationRecords('CUST-T1, BILL-T1, cust-t1'), ['CUST-T1', 'BILL-T1']);
  assert.deepEqual(normalizeTestDataSeparationRecords('  CUST-T1  '), ['CUST-T1']);
  assert.deepEqual(normalizeTestDataSeparationRecords(''), []);
  assert.deepEqual(normalizeTestDataSeparationRecords(null), []);
  assert.deepEqual(normalizeTestDataSeparationRecords(42), []);
});

test('normalize trims fields and drops unknown fields', () => {
  const note = normalizeTestDataSeparationNote({ ...NOTE_A, extra: 'ignored', method: '  marked with TEST prefix  ', records: [' cust-t1 ', 'BILL-T1', 'CUST-T1'] });
  assert.deepEqual(note, { ...NOTE_A, records: ['cust-t1', 'BILL-T1'] });
});

test('normalize accepts a comma string of records and an empty cleared date', () => {
  const note = normalizeTestDataSeparationNote(NOTE_B);
  assert.deepEqual(note, { ...NOTE_B, records: ['CUST-T2', 'BILL-T2'] });
});

test('normalize refuses half-formed notes', () => {
  assert.equal(normalizeTestDataSeparationNote({ ...NOTE_A, id: '' }), null);
  assert.equal(normalizeTestDataSeparationNote({ ...NOTE_A, setRef: '   ' }), null);
  assert.equal(normalizeTestDataSeparationNote({ ...NOTE_A, records: [] }), null);
  assert.equal(normalizeTestDataSeparationNote({ ...NOTE_A, records: ' , ' }), null);
  assert.equal(normalizeTestDataSeparationNote({ ...NOTE_A, method: '' }), null);
  assert.equal(normalizeTestDataSeparationNote({ ...NOTE_A, dateCreated: '2026-02-29' }), null);
  assert.equal(normalizeTestDataSeparationNote(null), null);
  assert.equal(normalizeTestDataSeparationNote('note'), null);
});

test('normalize refuses a cleared date before the created date', () => {
  assert.equal(normalizeTestDataSeparationNote({ ...NOTE_A, dateCleared: '2026-11-04' }), null);
  assert.equal(normalizeTestDataSeparationNote({ ...NOTE_A, dateCleared: 'bad' }), null);
  assert.deepEqual(normalizeTestDataSeparationNote({ ...NOTE_A, dateCleared: '2026-11-05' }), { ...NOTE_A, dateCleared: '2026-11-05' });
});

test('normalize list keeps only well-formed notes', () => {
  assert.deepEqual(normalizeTestDataSeparationNoteList([NOTE_A, { ...NOTE_B, method: '' }, NOTE_C]), [NOTE_A, NOTE_C]);
  assert.deepEqual(normalizeTestDataSeparationNoteList(null), []);
  assert.deepEqual(normalizeTestDataSeparationNoteList('nope'), []);
});

test('record appends a note and never rewrites a duplicate id', () => {
  const next = recordTestDataSeparationNote([NOTE_A], NOTE_B);
  assert.deepEqual(next, [NOTE_A, { ...NOTE_B, records: ['CUST-T2', 'BILL-T2'] }]);
  assert.deepEqual(recordTestDataSeparationNote([NOTE_A], { ...NOTE_A, method: 'different' }), [NOTE_A]);
});

test('record refuses a half-formed note and leaves the list alone', () => {
  assert.deepEqual(recordTestDataSeparationNote([NOTE_A], { ...NOTE_B, dateCreated: 'bad' }), [NOTE_A]);
  assert.deepEqual(recordTestDataSeparationNote([NOTE_A], null), [NOTE_A]);
});

test('record never mutates its input', () => {
  const frozen = deepFreeze([NOTE_A]);
  const next = recordTestDataSeparationNote(frozen, NOTE_B);
  assert.equal(frozen.length, 1);
  assert.equal(next.length, 2);
  assert.notEqual(next, frozen);
});

test('lookup by set reference is case-insensitive', () => {
  assert.deepEqual(testDataSeparationNoteForSet([NOTE_A, NOTE_B], 'set-1'), NOTE_A);
  assert.deepEqual(testDataSeparationNoteForSet([NOTE_A, NOTE_B], ' SET-2 '), { ...NOTE_B, records: ['CUST-T2', 'BILL-T2'] });
  assert.equal(testDataSeparationNoteForSet([NOTE_A], 'SET-9'), null);
  assert.equal(testDataSeparationNoteForSet([NOTE_A], ''), null);
});

test('open list shows only uncleared sets, oldest created first', () => {
  assert.deepEqual(openTestDataSeparationNotes([NOTE_C, NOTE_B, NOTE_A]), [{ ...NOTE_B, records: ['CUST-T2', 'BILL-T2'] }, NOTE_A]);
  assert.deepEqual(openTestDataSeparationNotes([NOTE_C]), []);
  assert.deepEqual(openTestDataSeparationNotes([]), []);
});

test('clearing sets only the cleared date on only that note', () => {
  const cleared = clearTestDataSeparationNote([NOTE_A, NOTE_B], 'TDS-1', '2026-11-06');
  assert.deepEqual(cleared, [{ ...NOTE_A, dateCleared: '2026-11-06' }, { ...NOTE_B, records: ['CUST-T2', 'BILL-T2'] }]);
  assert.deepEqual(openTestDataSeparationNotes(cleared), [{ ...NOTE_B, records: ['CUST-T2', 'BILL-T2'] }]);
});

test('clearing refuses a missing note, a bad date, an early date, or an already cleared note', () => {
  assert.deepEqual(clearTestDataSeparationNote([NOTE_A], 'TDS-9', '2026-11-06'), [NOTE_A]);
  assert.deepEqual(clearTestDataSeparationNote([NOTE_A], 'TDS-1', 'bad'), [NOTE_A]);
  assert.deepEqual(clearTestDataSeparationNote([NOTE_A], 'TDS-1', '2026-11-04'), [NOTE_A]);
  assert.deepEqual(clearTestDataSeparationNote([NOTE_C], 'TDS-3', '2026-11-07'), [NOTE_C]);
});

test('ledger records keep only whole-rupee amounts with a reference', () => {
  assert.deepEqual(normalizeTestDataSeparationLedgerRecords([
    { ref: 'CUST-T1', amount: 3000 },
    { ref: 'BILL-T1', amount: 0 },
    { ref: 'CUST-L1', amount: -5 },
    { ref: 'BILL-L1', amount: 10.5 },
    { ref: '', amount: 100 },
    { ref: 'BILL-L2', amount: '100' },
    null,
  ]), [{ ref: 'CUST-T1', amount: 3000 }, { ref: 'BILL-T1', amount: 0 }]);
  assert.deepEqual(normalizeTestDataSeparationLedgerRecords(null), []);
});

test('split lists test records separately and excludes them from the live total', () => {
  const records = [
    { ref: 'CUST-T1', amount: 3000 },
    { ref: 'bill-t1', amount: 1500 },
    { ref: 'CUST-L1', amount: 2000 },
    { ref: 'BILL-L2', amount: 500 },
  ];
  const split = splitTestDataRecords([NOTE_A, NOTE_B], records);
  assert.deepEqual(split.test, [{ ref: 'CUST-T1', amount: 3000 }, { ref: 'bill-t1', amount: 1500 }]);
  assert.deepEqual(split.live, [{ ref: 'CUST-L1', amount: 2000 }, { ref: 'BILL-L2', amount: 500 }]);
  assert.equal(split.testTotal, 4500);
  assert.equal(split.liveTotal, 2500);
  assert.equal(split.testTotal + split.liveTotal, 7000);
});

test('split never counts a cleared set as test data', () => {
  const records = [
    { ref: 'CUST-T3', amount: 3000 },
    { ref: 'CUST-L1', amount: 2000 },
  ];
  const split = splitTestDataRecords([NOTE_C], records);
  assert.deepEqual(split.test, []);
  assert.deepEqual(split.live, records);
  assert.equal(split.liveTotal, 5000);
  assert.equal(split.testTotal, 0);
});

test('split never mutates its inputs', () => {
  const notes = deepFreeze([NOTE_A]);
  const records = deepFreeze([{ ref: 'CUST-T1', amount: 3000 }, { ref: 'CUST-L1', amount: 2000 }]);
  const split = splitTestDataRecords(notes, records);
  assert.equal(notes.length, 1);
  assert.equal(records.length, 2);
  assert.equal(split.liveTotal, 2000);
});

test('counts count notes, distinct sets, and open sets', () => {
  assert.deepEqual(testDataSeparationNoteCounts([NOTE_A, NOTE_B, NOTE_C]), { total: 3, sets: 3, open: 2 });
  assert.deepEqual(testDataSeparationNoteCounts([NOTE_A, { ...NOTE_A, id: 'TDS-9' }]), { total: 2, sets: 1, open: 2 });
  assert.deepEqual(testDataSeparationNoteCounts([]), { total: 0, sets: 0, open: 0 });
});

test('summary text names notes, sets, and open sets', () => {
  assert.equal(testDataSeparationNoteSummaryText([]), 'No test data separation notes.');
  assert.equal(testDataSeparationNoteSummaryText([NOTE_A]), '1 separation note covering 1 test set. 1 set still open.');
  assert.equal(testDataSeparationNoteSummaryText([NOTE_A, NOTE_B, NOTE_C]), '3 separation notes covering 3 test sets. 2 sets still open.');
  assert.equal(testDataSeparationNoteSummaryText([NOTE_C]), '1 separation note covering 1 test set.');
});

test('plain text names the set, its records, and whether it is still open', () => {
  assert.equal(testDataSeparationNoteText(NOTE_A), 'SET-1 — records: CUST-T1, BILL-T1; method: marked with TEST prefix; created 2026-11-05; still open');
  assert.equal(testDataSeparationNoteText(NOTE_C), 'SET-3 — records: CUST-T3; method: marked with TEST prefix; created 2026-11-05; cleared 2026-11-06');
  assert.equal(testDataSeparationNoteText({ ...NOTE_A, method: '' }), '');
  assert.equal(testDataSeparationNotesText([]), 'No test data separation notes.');
  assert.equal(testDataSeparationNotesText([NOTE_B, NOTE_A]), 'SET-2 — records: CUST-T2, BILL-T2; method: kept in a separate test list; created 2026-11-04; still open\nSET-1 — records: CUST-T1, BILL-T1; method: marked with TEST prefix; created 2026-11-05; still open');
});

test('html escapes user-entered text', () => {
  const risky = { ...NOTE_A, method: '<script>alert(1)</script>', setRef: 'SET-<1>' };
  const html = testDataSeparationNoteHtml(risky);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('SET-&lt;1&gt;'));
  assert.equal(testDataSeparationNoteHtml({ ...NOTE_A, method: '' }), '');
  assert.equal(testDataSeparationNotesHtml([]), '<p>No test data separation notes yet.</p>');
  assert.ok(testDataSeparationNotesHtml([NOTE_A]).includes('SET-1'));
});

test('open html lists only uncleared sets', () => {
  const html = testDataSeparationOpenHtml([NOTE_A, NOTE_C]);
  assert.ok(html.includes('SET-1'));
  assert.ok(!html.includes('SET-3'));
  assert.equal(testDataSeparationOpenHtml([NOTE_C]), '<p>No open test sets.</p>');
});

test('csv exports every field and the filename is fixed', () => {
  const csv = testDataSeparationNoteCsv([NOTE_A, NOTE_B]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,setRef,records,method,dateCreated,dateCleared');
  assert.equal(lines[1], 'TDS-1,SET-1,CUST-T1; BILL-T1,marked with TEST prefix,2026-11-05,');
  assert.equal(lines[2], 'TDS-2,SET-2,CUST-T2; BILL-T2,kept in a separate test list,2026-11-04,');
  assert.equal(testDataSeparationNoteCsv([]), 'id,setRef,records,method,dateCreated,dateCleared');
  assert.equal(testDataSeparationNoteFilename(), 'test-data-separation-notes.csv');
});

test('csv quotes a method containing a comma', () => {
  const csv = testDataSeparationNoteCsv([{ ...NOTE_A, method: 'marked, then listed' }]);
  assert.ok(csv.includes('"marked, then listed"'));
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

test('module never converts test data to live data and carries no OLT word', () => {
  assert.ok(!moduleSrc.includes('convertTestDataToLive'));
  assert.ok(!moduleSrc.includes('markTestDataLive'));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
});

test('app.js wires the panel: import, store key, render, and render-all call', () => {
  assert.ok(appJs.includes("from './test-data-separation-note.js'"));
  assert.ok(appJs.includes('shahdara_tds_notes_v1'));
  assert.ok(appJs.includes('function renderTestDataSeparationNotes()'));
  assert.ok(appJs.includes('renderTestDataSeparationNotes();'));
  assert.ok(appJs.includes('testDataSeparationNoteBound'));
});

test('app.js additions carry no standalone OLT word', () => {
  const start = appJs.indexOf("from './test-data-separation-note.js'");
  const end = appJs.indexOf('let duplicationCheckBound');
  const added = appJs.slice(start, end);
  assert.ok(added.length > 0);
  assert.ok(!/\bOLT\b/i.test(added));
});

test('index.html carries the panel with tds ids and a plain heading', () => {
  assert.ok(indexHtml.includes('id="tdsHeading"'));
  assert.ok(indexHtml.includes('Test data separation note'));
  assert.ok(indexHtml.includes('id="tdsBody"'));
  assert.ok(indexHtml.includes('id="tdsSummary"'));
  assert.ok(indexHtml.includes('id="tdsOpenBody"'));
  assert.ok(indexHtml.includes('id="tdsSaveBtn"'));
  assert.ok(indexHtml.includes('id="tdsClearBtn"'));
  assert.ok(indexHtml.includes('id="tdsExportBtn"'));
  assert.ok(indexHtml.includes('id="tdsSetRef"'));
  assert.ok(indexHtml.includes('id="tdsRecords"'));
  assert.ok(indexHtml.includes('id="tdsMethod"'));
  assert.ok(indexHtml.includes('id="tdsDateCreated"'));
  assert.ok(indexHtml.includes('id="tdsClearId"'));
  assert.ok(indexHtml.includes('id="tdsDateCleared"'));
});
