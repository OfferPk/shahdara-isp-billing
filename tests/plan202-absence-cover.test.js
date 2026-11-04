import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validCoverDate,
  normalizeCoverPeriod,
  normalizeCoverList,
  findCoverPeriod,
  recordCoverPeriod,
  removeCoverPeriod,
  coverPeriodsSorted,
  coverPeriodsForPerson,
  coverPeriodsForDate,
  coverOverlaps,
  coverGaps,
  coverSummaryText,
  coverGapsText,
  coverPeriodText,
  coverPeriodHtml,
  coverAllHtml,
  coverOverlapText,
  coverCsv,
  coverFilename,
} from '../absence-cover.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'absence-cover.js'), 'utf8');

const periodA = { id: 'AC-1', coverPerson: 'Saad', fromDate: '2026-11-02', toDate: '2026-11-06', scope: 'Shop decisions', handoverNoteRef: 'HN-1' };
const periodB = { id: 'AC-2', coverPerson: 'Ayesha', fromDate: '2026-11-05', toDate: '2026-11-08', scope: 'Supervision' };
const periodC = { id: 'AC-3', coverPerson: 'Saad', fromDate: '2026-11-12', toDate: '2026-11-13', scope: 'Shop decisions' };

test('half-formed cover periods are refused', () => {
  assert.equal(normalizeCoverPeriod({ id: 'AC-9', fromDate: '2026-11-02', toDate: '2026-11-06' }), null);
  assert.equal(normalizeCoverPeriod({ id: 'AC-9', coverPerson: 'Saad', toDate: '2026-11-06' }), null);
  assert.equal(normalizeCoverPeriod({ id: 'AC-9', coverPerson: 'Saad', fromDate: '2026-11-02' }), null);
  assert.equal(normalizeCoverPeriod({ coverPerson: 'Saad', fromDate: '2026-11-02', toDate: '2026-11-06' }), null);
  assert.equal(normalizeCoverPeriod({ ...periodA, toDate: '2026-11-01' }), null);
  assert.equal(normalizeCoverPeriod({ ...periodA, toDate: '2026-11-02' }).toDate, '2026-11-02');
});

test('strict calendar dates: 31-day months, Feb 29 leap and non-leap', () => {
  assert.equal(validCoverDate('2026-08-31'), true);
  assert.equal(validCoverDate('2026-08-32'), false);
  assert.equal(validCoverDate('2026-02-30'), false);
  assert.equal(validCoverDate('2024-02-29'), true);
  assert.equal(validCoverDate('2026-02-29'), false);
  assert.equal(validCoverDate('2026-11-02'), true);
  assert.equal(validCoverDate('2026-13-01'), false);
  assert.equal(validCoverDate('2026-1-02'), false);
  assert.equal(normalizeCoverPeriod({ ...periodA, fromDate: '2026-02-30' }), null);
});

test('unknown fields are dropped, so no permission, route, or sending field can creep in', () => {
  const clean = normalizeCoverPeriod({ ...periodA, grantsAccess: true, routeId: 'R-1', billId: 'B-1', sendMessage: true });
  assert.deepEqual(Object.keys(clean).sort(), ['coverPerson', 'fromDate', 'handoverNoteRef', 'id', 'scope', 'toDate']);
});

test('duplicate ids are never rewritten', () => {
  const list = [periodA];
  assert.deepEqual(recordCoverPeriod(list, { ...periodA, coverPerson: 'Someone Else' }), [periodA]);
  assert.equal(recordCoverPeriod(list, { ...periodA, id: 'AC-2' }).length, 2);
});

test('find and remove by id', () => {
  const list = [periodA, periodB];
  assert.equal(findCoverPeriod(list, 'AC-2').coverPerson, 'Ayesha');
  assert.equal(findCoverPeriod(list, 'AC-9'), null);
  assert.equal(findCoverPeriod(list, ''), null);
  assert.deepEqual(removeCoverPeriod(list, 'AC-1'), [{ ...periodB, handoverNoteRef: '' }]);
  assert.deepEqual(removeCoverPeriod(list, ''), [periodA, { ...periodB, handoverNoteRef: '' }]);
});

test('periods sort by from date, then to date, then person, then id', () => {
  const sorted = coverPeriodsSorted([periodC, periodB, periodA]);
  assert.deepEqual(sorted.map((p) => p.id), ['AC-1', 'AC-2', 'AC-3']);
  const sameFrom = coverPeriodsSorted([
    { id: 'AC-9', coverPerson: 'Zaid', fromDate: '2026-11-02', toDate: '2026-11-03' },
    { id: 'AC-8', coverPerson: 'Ayesha', fromDate: '2026-11-02', toDate: '2026-11-03' },
  ]);
  assert.deepEqual(sameFrom.map((p) => p.id), ['AC-8', 'AC-9']);
});

test('person filter is case-insensitive', () => {
  const list = [periodA, periodB, periodC];
  assert.deepEqual(coverPeriodsForPerson(list, 'saad').map((p) => p.id), ['AC-1', 'AC-3']);
  assert.deepEqual(coverPeriodsForPerson(list, '').map((p) => p.id), ['AC-1', 'AC-2', 'AC-3']);
});

test('cover for a date is inclusive at both ends', () => {
  const list = [periodA, periodB, periodC];
  assert.deepEqual(coverPeriodsForDate(list, '2026-11-02').map((p) => p.id), ['AC-1']);
  assert.deepEqual(coverPeriodsForDate(list, '2026-11-06').map((p) => p.id), ['AC-1', 'AC-2']);
  assert.deepEqual(coverPeriodsForDate(list, '2026-11-09'), []);
  assert.deepEqual(coverPeriodsForDate(list, '2026-02-30'), []);
});

test('overlaps are flagged, including shared boundary days; adjacent days are not overlaps', () => {
  assert.deepEqual(coverOverlaps([periodA, periodB]).map((p) => [p.first.id, p.second.id]), [['AC-1', 'AC-2']]);
  assert.deepEqual(coverOverlaps([periodA, periodC]), []);
  const touching = [
    { id: 'AC-1', coverPerson: 'Saad', fromDate: '2026-11-02', toDate: '2026-11-06' },
    { id: 'AC-2', coverPerson: 'Ayesha', fromDate: '2026-11-06', toDate: '2026-11-08' },
  ];
  assert.equal(coverOverlaps(touching).length, 1);
  const adjacent = [
    { id: 'AC-1', coverPerson: 'Saad', fromDate: '2026-11-02', toDate: '2026-11-06' },
    { id: 'AC-2', coverPerson: 'Ayesha', fromDate: '2026-11-07', toDate: '2026-11-08' },
  ];
  assert.equal(coverOverlaps(adjacent).length, 0);
});

test('gaps inside a range are plainly listed, including edges and month boundaries', () => {
  const list = [periodA, periodB, periodC];
  assert.deepEqual(coverGaps(list, '2026-11-01', '2026-11-15'), [
    { fromDate: '2026-11-01', toDate: '2026-11-01' },
    { fromDate: '2026-11-09', toDate: '2026-11-11' },
    { fromDate: '2026-11-14', toDate: '2026-11-15' },
  ]);
  assert.deepEqual(coverGaps(list, '2026-11-02', '2026-11-08'), []);
  assert.deepEqual(coverGaps([], '2026-11-01', '2026-11-03'), [{ fromDate: '2026-11-01', toDate: '2026-11-03' }]);
  assert.deepEqual(coverGaps(list, '2026-11-15', '2026-11-01'), []);
  assert.deepEqual(coverGaps(list, '2026-02-30', '2026-03-05'), []);
  assert.deepEqual(coverGaps(list, '2026-10-30', '2026-11-02'), [{ fromDate: '2026-10-30', toDate: '2026-11-01' }]);
});

test('summary and gaps text', () => {
  assert.equal(coverSummaryText([]), 'No cover periods recorded.');
  assert.equal(coverSummaryText([periodA, periodB, periodC]), '3 cover periods across 2 people, 1 overlap flagged.');
  assert.equal(coverGapsText([periodA, periodB], '2026-11-02', '2026-11-08'), 'No cover gaps from 2026-11-02 to 2026-11-08.');
  assert.equal(coverGapsText([], '2026-11-01', '2026-11-03'), 'Cover gaps from 2026-11-01 to 2026-11-03: 2026-11-01 to 2026-11-03.');
  assert.equal(coverGapsText([periodA], '2026-02-30', '2026-03-05'), '');
});

test('period text states a missing handover reference plainly', () => {
  assert.equal(coverPeriodText(periodA), 'Saad · 2026-11-02 to 2026-11-06 · Shop decisions — Handover note: HN-1');
  assert.equal(coverPeriodText(periodB), 'Ayesha · 2026-11-05 to 2026-11-08 · Supervision — No handover note reference.');
  assert.equal(coverPeriodText({ ...periodA, scope: '' }), 'Saad · 2026-11-02 to 2026-11-06 — Handover note: HN-1');
  assert.equal(coverPeriodText(null), '');
  assert.match(coverOverlapText({ first: periodA, second: periodB }), /Overlap:/);
});

test('HTML escapes operator input', () => {
  const html = coverPeriodHtml({ ...periodA, scope: '<b>&"x"</b>' });
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&lt;b&gt;&amp;&quot;x&quot;&lt;\/b&gt;/);
  assert.equal(coverAllHtml([periodB, periodA]).indexOf('2026-11-02') < coverAllHtml([periodB, periodA]).indexOf('2026-11-05'), true);
});

test('CSV columns and filename', () => {
  const csv = coverCsv([periodB, periodA]);
  assert.equal(csv.split('\n')[0], 'id,cover_person,from_date,to_date,scope,handover_note_ref');
  assert.match(csv, /AC-1,Saad,2026-11-02,2026-11-06,Shop decisions,HN-1/);
  assert.equal(coverFilename(), 'absence-cover.csv');
});

test('inputs are never mutated', () => {
  const input = [periodA, periodB];
  const snapshot = JSON.stringify(input);
  recordCoverPeriod(input, periodC);
  removeCoverPeriod(input, 'AC-1');
  coverPeriodsSorted(input);
  coverOverlaps(input);
  coverGaps(input, '2026-11-01', '2026-11-15');
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad entries and later duplicates', () => {
  assert.deepEqual(normalizeCoverList(null), []);
  assert.deepEqual(normalizeCoverList([null, periodA, { ...periodA, coverPerson: 'Other' }, periodB]), [periodA, { ...periodB, handoverNoteRef: '' }]);
});

test('purity fence: the module is import-free and touches no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /^import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['acSummary', 'acExportBtn', 'acPerson', 'acFrom', 'acTo', 'acScope', 'acRef', 'acSaveBtn', 'acRemoveId', 'acRemoveBtn', 'acPersonFilter', 'acRangeStart', 'acRangeEnd', 'acGapsBtn', 'acGapsBody', 'acOverlapsBody', 'acBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the absence-cover store and render function', () => {
  assert.match(appJs, /shahdara_absence_cover_v1/);
  assert.match(appJs, /renderAbsenceCover\(\)/);
  assert.match(appJs, /absence-cover\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Z])OLT(?![A-Z])/g) || [];
  assert.equal(matches.length, 0);
});
