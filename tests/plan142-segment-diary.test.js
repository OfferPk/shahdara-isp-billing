import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validSegmentDiaryDate,
  normalizeSegmentDiaryEntry,
  normalizeSegmentDiaryList,
  findSegmentDiaryEntry,
  upsertSegmentDiaryEntry,
  removeSegmentDiaryEntry,
  diaryForSegment,
  latestSegmentCondition,
  segmentLatestConditions,
  segmentDiarySummaryText,
  segmentDiaryHtml,
  segmentDiaryCsv,
  segmentDiaryFilename,
} from '../segment-diary.js';

const dir = dirname(fileURLToPath(import.meta.url));

const entry = (over = {}) => ({
  id: 'DIARY-1',
  segment: 'Mohalla A feeder',
  date: '2026-11-01',
  condition: 'good',
  symptom: 'No dropouts reported',
  ...over,
});

test('strict dates: real dates pass, impossible dates fail', () => {
  assert.equal(validSegmentDiaryDate('2026-08-31'), '2026-08-31');
  assert.equal(validSegmentDiaryDate('2026-10-31'), '2026-10-31');
  assert.equal(validSegmentDiaryDate('2026-12-31'), '2026-12-31');
  assert.equal(validSegmentDiaryDate('2026-02-30'), null);
  assert.equal(validSegmentDiaryDate('2026-11-31'), null);
  assert.equal(validSegmentDiaryDate('2026-11-1'), null);
  assert.equal(validSegmentDiaryDate(''), null);
  assert.equal(validSegmentDiaryDate(null), null);
});

test('half-formed entries are refused outright', () => {
  assert.equal(normalizeSegmentDiaryEntry(entry({ id: '' })), null);
  assert.equal(normalizeSegmentDiaryEntry(entry({ segment: '  ' })), null);
  assert.equal(normalizeSegmentDiaryEntry(entry({ date: '' })), null);
  assert.equal(normalizeSegmentDiaryEntry(entry({ date: '2026-02-30' })), null);
  assert.equal(normalizeSegmentDiaryEntry(null), null);
  assert.equal(normalizeSegmentDiaryEntry('nope'), null);
});

test('condition is one of good, watch, poor; anything else becomes watch', () => {
  assert.equal(normalizeSegmentDiaryEntry(entry({ condition: 'poor' })).condition, 'poor');
  assert.equal(normalizeSegmentDiaryEntry(entry({ condition: 'watch' })).condition, 'watch');
  assert.equal(normalizeSegmentDiaryEntry(entry({ condition: 'excellent' })).condition, 'watch');
  assert.equal(normalizeSegmentDiaryEntry(entry({ condition: '' })).condition, 'watch');
});

test('unknown fields are dropped, so no ticket, bill, or payment field can creep in', () => {
  const clean = normalizeSegmentDiaryEntry(entry({ ticket: 'T-1', bill: 500, payment: 'PAY-1' }));
  assert.equal(clean.ticket, undefined);
  assert.equal(clean.bill, undefined);
  assert.equal(clean.payment, undefined);
  assert.deepEqual(Object.keys(clean).sort(), ['condition', 'date', 'id', 'segment', 'symptom']);
});

test('duplicate ids are never rewritten', () => {
  const base = [entry()];
  assert.deepEqual(upsertSegmentDiaryEntry(base, entry()), base);
  const changed = upsertSegmentDiaryEntry(base, entry({ condition: 'poor' }));
  assert.deepEqual(changed, base);
  assert.equal(changed.length, 1);
});

test('one entry per segment per date; other dates and segments are fine', () => {
  const base = [entry()];
  assert.equal(upsertSegmentDiaryEntry(base, entry({ id: 'DIARY-2' })).length, 1);
  assert.equal(upsertSegmentDiaryEntry(base, entry({ id: 'DIARY-2', segment: 'mohalla a feeder' })).length, 1);
  assert.equal(upsertSegmentDiaryEntry(base, entry({ id: 'DIARY-2', date: '2026-11-02' })).length, 2);
  assert.equal(upsertSegmentDiaryEntry(base, entry({ id: 'DIARY-2', segment: 'Mohalla B feeder' })).length, 2);
});

test('normalize list drops half-formed rows and duplicate ids; non-array is empty', () => {
  const clean = normalizeSegmentDiaryList([entry(), entry({ id: '' }), entry(), null, entry({ id: 'DIARY-2', date: '2026-11-02' })]);
  assert.deepEqual(clean.map((row) => row.id), ['DIARY-1', 'DIARY-2']);
  assert.deepEqual(normalizeSegmentDiaryList(null), []);
  assert.deepEqual(normalizeSegmentDiaryList('nope'), []);
});

test('find and remove work by id', () => {
  const base = [entry(), entry({ id: 'DIARY-2', date: '2026-11-02', condition: 'watch' })];
  assert.equal(findSegmentDiaryEntry(base, 'DIARY-2').condition, 'watch');
  assert.equal(findSegmentDiaryEntry(base, 'MISSING'), null);
  assert.deepEqual(removeSegmentDiaryEntry(base, 'DIARY-1').map((row) => row.id), ['DIARY-2']);
  assert.deepEqual(removeSegmentDiaryEntry(base, 'MISSING'), normalizeSegmentDiaryList(base));
});

test('inputs are never mutated', () => {
  const raw = entry();
  const snapshot = JSON.stringify(raw);
  normalizeSegmentDiaryEntry(raw);
  upsertSegmentDiaryEntry([raw], entry({ id: 'DIARY-2', date: '2026-11-02' }));
  assert.equal(JSON.stringify(raw), snapshot);
});

test('segment diary is newest first, then id A-Z', () => {
  const list = [
    entry({ id: 'DIARY-3', date: '2026-11-03', condition: 'poor' }),
    entry({ id: 'DIARY-1', date: '2026-11-01', condition: 'good' }),
    entry({ id: 'DIARY-2', date: '2026-11-02', condition: 'watch' }),
    entry({ id: 'DIARY-9', segment: 'Other segment', date: '2026-11-04' }),
  ];
  assert.deepEqual(diaryForSegment(list, 'Mohalla A feeder').map((row) => row.id), ['DIARY-3', 'DIARY-2', 'DIARY-1']);
  assert.deepEqual(diaryForSegment(list, 'mohalla a feeder').map((row) => row.id), ['DIARY-3', 'DIARY-2', 'DIARY-1']);
  assert.deepEqual(diaryForSegment(list, 'Missing segment'), []);
});

test('latest condition is the newest entry, or null when there is none', () => {
  const list = [entry({ date: '2026-11-01', condition: 'good' }), entry({ id: 'DIARY-2', date: '2026-11-03', condition: 'poor' })];
  assert.equal(latestSegmentCondition(list, 'Mohalla A feeder'), 'poor');
  assert.equal(latestSegmentCondition(list, 'Missing segment'), null);
  assert.equal(latestSegmentCondition([], 'Mohalla A feeder'), null);
});

test('latest conditions cover every segment, segment name A-Z', () => {
  const list = [
    entry({ segment: 'Zulu segment', date: '2026-11-01', condition: 'good' }),
    entry({ id: 'DIARY-2', segment: 'Alpha segment', date: '2026-11-02', condition: 'poor' }),
    entry({ id: 'DIARY-3', segment: 'Zulu segment', date: '2026-11-03', condition: 'watch' }),
  ];
  assert.deepEqual(segmentLatestConditions(list).map((row) => [row.segment, row.condition]), [['Alpha segment', 'poor'], ['Zulu segment', 'watch']]);
});

test('summary text counts entries, segments, poor and watch', () => {
  assert.equal(segmentDiarySummaryText([]), 'No segment diary entry recorded yet.');
  assert.equal(segmentDiarySummaryText([entry()]), '1 diary entry across 1 segment; 0 poor, 0 watch.');
  const list = [entry(), entry({ id: 'DIARY-2', segment: 'B segment', date: '2026-11-02', condition: 'poor' }), entry({ id: 'DIARY-3', segment: 'C segment', date: '2026-11-02', condition: 'watch' })];
  assert.equal(segmentDiarySummaryText(list), '3 diary entries across 3 segments; 1 poor, 1 watch.');
});

test('segment page shows latest condition prominent and entries newest first', () => {
  const list = [entry({ date: '2026-11-01', condition: 'good' }), entry({ id: 'DIARY-2', date: '2026-11-03', condition: 'poor', symptom: 'Frequent drops' })];
  const html = segmentDiaryHtml(list, 'Mohalla A feeder');
  assert.ok(html.includes('Latest condition: poor'));
  assert.ok(html.indexOf('2026-11-03') < html.indexOf('2026-11-01'));
  assert.ok(html.includes('Frequent drops'));
  assert.equal(segmentDiaryHtml(list, 'Missing segment'), '<p>No diary entry recorded for this segment.</p>');
});

test('html escapes markup in segment, symptom, and condition text', () => {
  const html = segmentDiaryHtml([entry({ symptom: '<script>alert(1)</script>' })], 'Mohalla A feeder');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('csv and filename', () => {
  const csv = segmentDiaryCsv([entry({ symptom: 'Drops, nightly' })]);
  assert.equal(csv.split('\n')[0], 'id,segment,date,condition,symptom');
  assert.ok(csv.includes('"Drops, nightly"'));
  assert.equal(segmentDiaryFilename(), 'segment-diary.csv');
});

test('module is pure and import-free', () => {
  const src = readFileSync(join(dir, '..', 'segment-diary.js'), 'utf8');
  assert.ok(!src.includes('import '));
  assert.ok(!src.includes('require('));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('fetch('));
});

test('panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['diarySummary', 'diaryExportBtn', 'diarySegment', 'diaryDate',
    'diaryCondition', 'diarySymptom', 'diarySaveBtn', 'diaryFilter', 'diaryBody',
    'diaryRemoveId', 'diaryRemoveBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
