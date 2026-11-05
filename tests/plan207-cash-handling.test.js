import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validCashHandlingDate,
  normalizeCashHandlingRecord,
  normalizeCashHandlingList,
  findCashHandlingRecord,
  recordCashHandling,
  removeCashHandling,
  cashHandlingSorted,
  cashHandlingForDate,
  cashHandlingForCounter,
  cashHandlingForLocation,
  cashHandlingFlags,
  cashHandlingIsFlagged,
  cashHandlingIsSinglePerson,
  cashHandlingFlagged,
  cashHandlingSinglePerson,
  compareCashHandlingToDaySheet,
  cashHandlingDaySheetText,
  cashHandlingRecordText,
  cashHandlingSummaryText,
  cashHandlingRecordHtml,
  cashHandlingAllHtml,
  cashHandlingCsv,
  cashHandlingFilename,
} from '../cash-handling.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'cash-handling.js'), 'utf8');

const countA = { id: 'CH-1', date: '2026-11-02', amount: 12500, countedBy: 'Saad', witnessedBy: 'Aqib', location: 'Shop safe', note: 'Day close' };
const countB = { id: 'CH-2', date: '2026-11-02', amount: 8300, countedBy: 'Aqib', witnessedBy: '', location: 'Front till' };
const countC = { id: 'CH-3', date: '2026-11-03', amount: 0, countedBy: 'Saad', witnessedBy: 'Aqib', location: '' };

test('half-formed counts are refused', () => {
  assert.equal(normalizeCashHandlingRecord({ date: '2026-11-02', amount: 100, countedBy: 'Saad' }), null);
  assert.equal(normalizeCashHandlingRecord({ id: 'CH-9', date: '2026-11-02', amount: 100 }), null);
  assert.equal(normalizeCashHandlingRecord({ id: 'CH-9', date: '2026-11-02', countedBy: 'Saad' }), null);
  assert.equal(normalizeCashHandlingRecord({ id: 'CH-9', date: '2026-11-02', amount: -50, countedBy: 'Saad' }), null);
  assert.equal(normalizeCashHandlingRecord({ id: 'CH-9', date: '2026-11-02', amount: 'lots', countedBy: 'Saad' }), null);
  assert.equal(normalizeCashHandlingRecord(null), null);
});

test('strict dates: real calendar days only, leap years honoured', () => {
  assert.equal(validCashHandlingDate('2026-11-02'), true);
  assert.equal(validCashHandlingDate('2026-08-31'), true);
  assert.equal(validCashHandlingDate('2026-10-31'), true);
  assert.equal(validCashHandlingDate('2026-12-31'), true);
  assert.equal(validCashHandlingDate('2024-02-29'), true);
  assert.equal(validCashHandlingDate('2026-02-29'), false);
  assert.equal(validCashHandlingDate('2026-02-30'), false);
  assert.equal(validCashHandlingDate('2026-04-31'), false);
  assert.equal(validCashHandlingDate('2026-13-01'), false);
  assert.equal(validCashHandlingDate('2026-1-02'), false);
  assert.equal(validCashHandlingDate('not a date'), false);
  assert.equal(normalizeCashHandlingRecord({ ...countA, date: '2026-02-30' }), null);
});

test('unknown fields are dropped and missing witness/location default to empty', () => {
  const clean = normalizeCashHandlingRecord({ ...countB, surpriseField: 'nope', denominationBreakdown: { 'note-1000': 8 } });
  assert.deepEqual(clean, { id: 'CH-2', date: '2026-11-02', amount: 8300, countedBy: 'Aqib', witnessedBy: '', location: 'Front till', note: '' });
});

test('duplicate ids are never rewritten', () => {
  const list = recordCashHandling([countA], { ...countA, amount: 99999 });
  assert.deepEqual(list, [normalizeCashHandlingRecord(countA)]);
  assert.equal(recordCashHandling([countA], countA).length, 1);
});

test('find and remove work by id', () => {
  assert.deepEqual(findCashHandlingRecord([countA, countB], 'CH-2'), normalizeCashHandlingRecord(countB));
  assert.equal(findCashHandlingRecord([countA], 'CH-9'), null);
  assert.deepEqual(removeCashHandling([countA, countB], 'CH-1'), [normalizeCashHandlingRecord(countB)]);
  assert.deepEqual(removeCashHandling([countA], ''), [normalizeCashHandlingRecord(countA)]);
});

test('counts sort by date, then counter, then id', () => {
  assert.deepEqual(cashHandlingSorted([countC, countB, countA]).map((r) => r.id), ['CH-2', 'CH-1', 'CH-3']);
});

test('filters by date, counter, and location are case-insensitive substrings', () => {
  const list = [countA, countB, countC];
  assert.deepEqual(cashHandlingForDate(list, '2026-11-02').map((r) => r.id), ['CH-2', 'CH-1']);
  assert.deepEqual(cashHandlingForDate(list, '2026-11-09'), []);
  assert.deepEqual(cashHandlingForCounter(list, 'saad').map((r) => r.id), ['CH-1', 'CH-3']);
  assert.deepEqual(cashHandlingForLocation(list, 'SAFE').map((r) => r.id), ['CH-1']);
  assert.deepEqual(cashHandlingForCounter(list, '').map((r) => r.id), ['CH-2', 'CH-1', 'CH-3']);
});

test('a count with only one person is flagged, not refused', () => {
  assert.deepEqual(cashHandlingFlags(countB), ['single-person']);
  assert.equal(cashHandlingIsSinglePerson(countB), true);
  assert.equal(cashHandlingIsFlagged(countB), true);
  assert.deepEqual(cashHandlingFlags({ ...countA, witnessedBy: 'saad' }), ['single-person']);
  assert.deepEqual(cashHandlingFlags(countA), []);
  assert.equal(recordCashHandling([], countB).length, 1);
});

test('a count with no location is flagged separately', () => {
  assert.deepEqual(cashHandlingFlags(countC), ['no-location']);
  assert.equal(cashHandlingIsFlagged(countC), true);
  assert.equal(cashHandlingIsSinglePerson(countC), false);
  assert.deepEqual(cashHandlingFlagged([countA, countB, countC]).map((r) => r.id), ['CH-2', 'CH-3']);
  assert.deepEqual(cashHandlingSinglePerson([countA, countB, countC]).map((r) => r.id), ['CH-2']);
});

test('day-sheet comparison reports match and signed mismatch, never rewrites', () => {
  assert.deepEqual(compareCashHandlingToDaySheet(countA, 12500), {
    id: 'CH-1', date: '2026-11-02', recordAmount: 12500, daySheetAmount: 12500, difference: 0, status: 'matched', statusLabel: 'Matched',
  });
  const mismatch = compareCashHandlingToDaySheet(countA, 12000);
  assert.equal(mismatch.status, 'mismatch');
  assert.equal(mismatch.difference, 500);
  assert.match(cashHandlingDaySheetText(countA, 12000), /MISMATCH/);
  assert.match(cashHandlingDaySheetText(countA, 12500), /MATCHED/);
  assert.equal(compareCashHandlingToDaySheet(countA, null).status, 'unchecked');
  assert.match(cashHandlingDaySheetText(countA, null), /unchecked/);
  assert.equal(compareCashHandlingToDaySheet(null, 100), null);
});

test('summary text counts flagged and single-person counts', () => {
  assert.equal(cashHandlingSummaryText([]), 'No cash-handling counts recorded.');
  assert.match(cashHandlingSummaryText([countA]), /1 count recorded/);
  assert.match(cashHandlingSummaryText([countA, countB, countC]), /3 counts recorded/);
  assert.match(cashHandlingSummaryText([countA, countB, countC]), /2 flagged \(1 single-person\)/);
});

test('record text names both people and the location, or says plainly when missing', () => {
  assert.match(cashHandlingRecordText(countA), /counted by Saad/);
  assert.match(cashHandlingRecordText(countA), /witnessed by Aqib/);
  assert.match(cashHandlingRecordText(countA), /kept at Shop safe/);
  assert.match(cashHandlingRecordText(countB), /No witness named/);
  assert.match(cashHandlingRecordText(countC), /No location noted/);
  assert.match(cashHandlingRecordText(countB), /flagged: single-person/);
  assert.equal(cashHandlingRecordText(null), 'No cash-handling record.');
});

test('html escapes user text and the list view handles empty', () => {
  const html = cashHandlingRecordHtml({ ...countA, countedBy: '<b>Saad</b>' });
  assert.doesNotMatch(html, /<b>Saad<\/b>/);
  assert.match(html, /&lt;b&gt;Saad&lt;\/b&gt;/);
  assert.match(cashHandlingAllHtml([]), /No cash-handling counts recorded/);
  assert.match(cashHandlingAllHtml([countA]), /CH-1/);
});

test('csv export and filename', () => {
  const csv = cashHandlingCsv([countA, countB]);
  assert.ok(csv.startsWith('id,date,amount,counted_by,witnessed_by,location,note,flags'));
  assert.match(csv, /CH-1,2026-11-02,12500\.00,Saad,Aqib,Shop safe,Day close,/);
  assert.match(csv, /CH-2,2026-11-02,8300\.00,Aqib,,Front till,,single-person/);
  assert.equal(cashHandlingFilename(), 'cash-handling.csv');
});

test('inputs are never mutated', () => {
  const input = { ...countA };
  const snapshot = JSON.stringify(input);
  normalizeCashHandlingRecord(input);
  recordCashHandling([countA], countB);
  cashHandlingSorted([countC, countA]);
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad entries and later duplicates', () => {
  assert.deepEqual(normalizeCashHandlingList(null), []);
  assert.deepEqual(normalizeCashHandlingList([null, countA, { ...countA, amount: 1 }, countB]), [normalizeCashHandlingRecord(countA), normalizeCashHandlingRecord(countB)]);
});

test('purity fence: the module is import-free and touches no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /^import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['chSummary', 'chExportBtn', 'chDate', 'chAmount', 'chCounter', 'chWitness', 'chLocation', 'chNote', 'chSaveBtn', 'chRemoveId', 'chRemoveBtn', 'chCounterFilter', 'chLocationFilter', 'chFlaggedBody', 'chDaySheetId', 'chDaySheetAmount', 'chDaySheetBtn', 'chDaySheetBody', 'chBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the cash-handling store and render function', () => {
  assert.match(appJs, /shahdara_cash_handling_v1/);
  assert.match(appJs, /renderCashHandling\(\)/);
  assert.match(appJs, /cash-handling\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Z])OLT(?![A-Z])/g) || [];
  assert.equal(matches.length, 0);
});
