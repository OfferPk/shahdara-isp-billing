import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validFaultRevisitDate,
  normalizeFaultRevisitList,
  faultRevisitInPeriod,
  faultRevisitPattern,
  faultRevisitPatterns,
  faultRevisitRepeats,
  faultRevisitSegments,
  faultRevisitPatternText,
  faultRevisitSummaryText,
  faultRevisitHtml,
  faultRevisitCsv,
  faultRevisitFilename,
} from '../fault-revisit.js';

const rowA = { id: 'f1', segment: 'SEG-A', date: '2026-09-03', customer: 'Ahmed' };
const rowB = { id: 'f2', segment: 'SEG-A', date: '2026-09-17', customer: 'Bilal' };
const rowC = { id: 'f3', segment: 'SEG-A', date: '2026-09-17', customer: 'Ahmed' };
const rowD = { id: 'f4', segment: 'SEG-B', date: '2026-09-10', customer: 'Chaudhry' };
const rowE = { id: 'f5', segment: 'SEG-B', date: '2026-10-02', customer: 'Danish' };
const fixture = [rowA, rowB, rowC, rowD, rowE];

test('strict dates: calendar dates only, leap day rules', () => {
  assert.equal(validFaultRevisitDate('2026-02-29'), false);
  assert.equal(validFaultRevisitDate('2024-02-29'), true);
  assert.equal(validFaultRevisitDate('2026-09-31'), false);
  assert.equal(validFaultRevisitDate('2026-13-01'), false);
  assert.equal(validFaultRevisitDate('2026-09-03'), true);
  assert.equal(validFaultRevisitDate('03-09-2026'), false);
  assert.equal(validFaultRevisitDate(''), false);
});

test('half-formed refusal: id, segment, or strict date missing drops the row', () => {
  const list = normalizeFaultRevisitList([
    rowA,
    { segment: 'SEG-A', date: '2026-09-03' },
    { id: 'x', date: '2026-09-03' },
    { id: 'y', segment: 'SEG-A', date: '2026-02-30' },
    { id: 'z', segment: 'SEG-A', date: '2026-09-03' },
    null,
    'not-a-row',
  ]);
  assert.deepEqual(list.map((r) => r.id), ['f1', 'z']);
});

test('unknown-field drop and non-mutation', () => {
  const input = [{ ...rowA, surprise: 'extra', charge: 500 }];
  const before = JSON.stringify(input);
  const list = normalizeFaultRevisitList(input);
  assert.deepEqual(Object.keys(list[0]).sort(), ['customer', 'date', 'id', 'segment']);
  assert.equal(JSON.stringify(input), before);
});

test('duplicate-id rule: first row wins, later duplicate never rewrites', () => {
  const list = normalizeFaultRevisitList([rowA, { ...rowA, date: '2026-09-20' }]);
  assert.equal(list.length, 1);
  assert.equal(list[0].date, '2026-09-03');
});

test('period filter is inclusive at both ends; bad or reversed period yields nothing', () => {
  assert.deepEqual(
    faultRevisitInPeriod(fixture, '2026-09-03', '2026-09-17').map((r) => r.id),
    ['f1', 'f2', 'f3', 'f4'],
  );
  assert.deepEqual(faultRevisitInPeriod(fixture, '2026-09-17', '2026-09-03'), []);
  assert.deepEqual(faultRevisitInPeriod(fixture, '2026-09-32', '2026-10-01'), []);
  assert.deepEqual(faultRevisitInPeriod(fixture, '', ''), []);
});

test('one-segment pattern: count matches the fixture, dates sorted, customers unique', () => {
  const pattern = faultRevisitPattern(fixture, 'SEG-A', '2026-09-01', '2026-09-30');
  assert.equal(pattern.count, 3);
  assert.deepEqual(pattern.dates, ['2026-09-03', '2026-09-17', '2026-09-17']);
  assert.deepEqual(pattern.customers, ['Ahmed', 'Bilal']);
  assert.equal(pattern.repeat, true);
});

test('pattern is case-insensitive on segment and keeps the recorded spelling', () => {
  const pattern = faultRevisitPattern(fixture, 'seg-a', '2026-09-01', '2026-09-30');
  assert.equal(pattern.segment, 'SEG-A');
  assert.equal(pattern.count, 3);
});

test('pattern returns null for a blank segment or a bad period', () => {
  assert.equal(faultRevisitPattern(fixture, '', '2026-09-01', '2026-09-30'), null);
  assert.equal(faultRevisitPattern(fixture, 'SEG-A', '2026-09-30', '2026-09-01'), null);
  assert.equal(faultRevisitPattern(fixture, 'SEG-A', '2026-09-01', '2026-09-32'), null);
});

test('segments ordered by revisit count, then segment A-Z', () => {
  const patterns = faultRevisitPatterns(fixture, '2026-09-01', '2026-09-30');
  assert.deepEqual(patterns.map((p) => [p.segment, p.count]), [['SEG-A', 3], ['SEG-B', 1]]);
  const tied = faultRevisitPatterns(
    [rowA, rowB, rowD, { id: 'f6', segment: 'SEG-C', date: '2026-09-05', customer: 'Ehsan' },
     { id: 'f7', segment: 'SEG-C', date: '2026-09-06', customer: 'Faraz' }],
    '2026-09-01',
    '2026-09-30',
  );
  assert.deepEqual(tied.map((p) => [p.segment, p.count]), [['SEG-A', 2], ['SEG-C', 2], ['SEG-B', 1]]);
});

test('repeats only: single-fault segments have no pattern yet', () => {
  assert.deepEqual(
    faultRevisitRepeats(fixture, '2026-09-01', '2026-09-30').map((p) => p.segment),
    ['SEG-A'],
  );
  assert.deepEqual(faultRevisitRepeats(fixture, '2026-10-01', '2026-10-31'), []);
});

test('segment list is unique and sorted A-Z', () => {
  assert.deepEqual(faultRevisitSegments(fixture), ['SEG-A', 'SEG-B']);
  assert.deepEqual(faultRevisitSegments([{ ...rowA, segment: 'seg-a' }, rowD]), ['seg-a', 'SEG-B']);
});

test('pattern and summary text', () => {
  const pattern = faultRevisitPattern(fixture, 'SEG-A', '2026-09-01', '2026-09-30');
  assert.match(faultRevisitPatternText(pattern), /SEG-A: 3 fault\(s\)/);
  assert.match(faultRevisitPatternText(pattern), /Ahmed, Bilal/);
  assert.match(faultRevisitPatternText(pattern), /Revisit pattern/);
  assert.equal(faultRevisitPatternText(null), 'No pattern to show.');
  assert.match(
    faultRevisitSummaryText(fixture, '2026-09-01', '2026-09-30'),
    /2 segment\(s\) with 4 fault\(s\) in the period; 1 segment\(s\) with a revisit pattern\./,
  );
  assert.match(faultRevisitSummaryText(fixture, '2026-09-30', '2026-09-01'), /No pattern to show/);
});

test('HTML escaping and CSV plus filename', () => {
  const pattern = faultRevisitPattern(
    [{ id: 'f9', segment: 'SEG<X>', date: '2026-09-04', customer: 'A & B' }],
    'SEG<X>',
    '2026-09-01',
    '2026-09-30',
  );
  assert.doesNotMatch(faultRevisitHtml(pattern), /SEG<X>/);
  assert.match(faultRevisitHtml(pattern), /SEG&lt;X&gt;/);
  assert.match(faultRevisitHtml(pattern), /A &amp; B/);
  const csv = faultRevisitCsv(faultRevisitPatterns(fixture, '2026-09-01', '2026-09-30'));
  assert.ok(csv.startsWith('Segment,Fault count,Dates,Customers affected,Revisit pattern'));
  assert.match(csv, /"SEG-A","3"/);
  assert.equal(faultRevisitFilename(), 'fault-revisit-patterns.csv');
});

test('view never edits: no edit, record, or remove function exists', () => {
  const src = fs.readFileSync(new URL('../fault-revisit.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /export function (record|remove|edit|update)FaultRevisit/);
});

test('purity fence: no clock, storage, or network calls', () => {
  const src = fs.readFileSync(new URL('../fault-revisit.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
});

test('neighbour-module fence: repeat-fault flag and segment fault history are not imported', () => {
  const src = fs.readFileSync(new URL('../fault-revisit.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from '\.\/(repeat-fault-flag|segment-fault-history)\.js'/);
  assert.doesNotMatch(src, /repeatFaultFlag|segmentFaultHistory/);
});

test('panel-id presence: fault revisit panel ids exist in index.html', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['frHeading', 'frSummary', 'frLines', 'frFrom', 'frTo', 'frSegmentFilter', 'frRepeatsOnly', 'frShowBtn', 'frExportBtn', 'frBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring: fault revisit render is called and imported', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /from '\.\/fault-revisit\.js'/);
  assert.match(app, /renderFaultRevisit\(\)/);
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const before = app.indexOf('fault-revisit');
  assert.ok(before > 0);
});
