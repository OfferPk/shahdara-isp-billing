import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validSegmentFaultDate,
  normalizeSegmentFault,
  normalizeSegmentFaultList,
  findSegmentFault,
  upsertSegmentFault,
  removeSegmentFault,
  faultsForSegment,
  segmentFaultCount,
  segmentFaultCounts,
  segmentFaultSummaryText,
  segmentFaultHtml,
  segmentFaultCsv,
  segmentFaultFilename,
} from '../segment-fault-history.js';

const entry = (over = {}) => ({
  id: 'SF-1',
  segment: 'Barrian Main',
  segmentId: 'SPL-Barrian-02',
  affectedCustomers: 8,
  date: '2026-11-05',
  note: '',
  ...over,
});

test('strict dates: real values pass, impossible values refused', () => {
  assert.equal(validSegmentFaultDate('2026-11-05'), '2026-11-05');
  assert.equal(validSegmentFaultDate('2026-08-31'), '2026-08-31');
  assert.equal(validSegmentFaultDate('2026-10-31'), '2026-10-31');
  assert.equal(validSegmentFaultDate('2026-12-31'), '2026-12-31');
  assert.equal(validSegmentFaultDate('2024-02-29'), '2024-02-29');
  assert.equal(validSegmentFaultDate('2026-02-30'), null);
  assert.equal(validSegmentFaultDate('2026-04-31'), null);
  assert.equal(validSegmentFaultDate('2026-09-31'), null);
  assert.equal(validSegmentFaultDate('2026-11-31'), null);
  assert.equal(validSegmentFaultDate('2026-13-01'), null);
  assert.equal(validSegmentFaultDate('05-11-2026'), null);
  assert.equal(validSegmentFaultDate(''), null);
  assert.equal(validSegmentFaultDate(null), null);
});

test('half-formed refusal: no segment, no identifier, or no count is refused', () => {
  assert.equal(normalizeSegmentFault(entry({ segment: '' })), null);
  assert.equal(normalizeSegmentFault(entry({ segment: '   ' })), null);
  assert.equal(normalizeSegmentFault(entry({ segmentId: '' })), null);
  assert.equal(normalizeSegmentFault(entry({ id: '' })), null);
  assert.equal(normalizeSegmentFault(entry({ date: '2026-02-30' })), null);
  assert.equal(normalizeSegmentFault(entry({ affectedCustomers: undefined })), null);
  assert.equal(normalizeSegmentFault(entry({ affectedCustomers: -1 })), null);
  assert.equal(normalizeSegmentFault(entry({ affectedCustomers: 2.5 })), null);
  assert.equal(normalizeSegmentFault(entry({ affectedCustomers: '8' })), null);
  assert.equal(normalizeSegmentFault(null), null);
  assert.equal(normalizeSegmentFault('nope'), null);
});

test('zero affected customers is a real count; unknown fields are dropped', () => {
  const item = normalizeSegmentFault(entry({ affectedCustomers: 0, bill: 500, ticketId: 'T-1' }));
  assert.equal(item.affectedCustomers, 0);
  assert.equal('bill' in item, false);
  assert.equal('ticketId' in item, false);
  assert.equal(normalizeSegmentFault(entry({ note: '  cut found  ' })).note, 'cut found');
});

test('duplicate id: identical re-save leaves the list unchanged', () => {
  const before = [entry()];
  const next = upsertSegmentFault(before, entry());
  assert.equal(next.length, 1);
  assert.deepEqual(next, before);
});

test('duplicate id: re-save with different figures is refused outright', () => {
  const before = [entry()];
  assert.deepEqual(upsertSegmentFault(before, entry({ affectedCustomers: 9 })), before);
  assert.deepEqual(upsertSegmentFault(before, entry({ date: '2026-11-06' })), before);
  assert.deepEqual(upsertSegmentFault(before, entry({ segmentId: 'SPL-Other-01' })), before);
});

test('remove drops only the named entry', () => {
  const list = [entry(), entry({ id: 'SF-2', date: '2026-11-06' })];
  assert.deepEqual(removeSegmentFault(list, 'SF-1').map((row) => row.id), ['SF-2']);
  assert.equal(removeSegmentFault(list, 'SF-9').length, 2);
});

test('segment page lists its faults newest first', () => {
  const list = [
    entry({ id: 'SF-1', date: '2026-11-01' }),
    entry({ id: 'SF-2', date: '2026-11-09' }),
    entry({ id: 'SF-3', date: '2026-11-05' }),
    entry({ id: 'SF-4', segmentId: 'SPL-Other-01', segment: 'Other', date: '2026-11-10' }),
  ];
  assert.deepEqual(faultsForSegment(list, 'SPL-Barrian-02').map((row) => row.id), ['SF-2', 'SF-3', 'SF-1']);
});

test('segment match is case-insensitive and also accepts the segment name', () => {
  const list = [entry()];
  assert.equal(faultsForSegment(list, 'spl-barrian-02').length, 1);
  assert.equal(faultsForSegment(list, 'Barrian Main').length, 1);
  assert.equal(faultsForSegment(list, 'barrian main').length, 1);
  assert.deepEqual(faultsForSegment(list, ''), []);
  assert.deepEqual(faultsForSegment(list, 'SPL-Other-01'), []);
});

test('repeat count is the number of incidents for the segment', () => {
  const list = [entry(), entry({ id: 'SF-2', date: '2026-11-06' }), entry({ id: 'SF-3', segmentId: 'SPL-Other-01', segment: 'Other' })];
  assert.equal(segmentFaultCount(list, 'SPL-Barrian-02'), 2);
  assert.equal(segmentFaultCount(list, 'SPL-Other-01'), 1);
  assert.equal(segmentFaultCount(list, 'SPL-None-00'), 0);
});

test('per-segment counts: most faults first, then segment name A-Z', () => {
  const list = [
    entry({ id: 'SF-1', segment: 'Zebra', segmentId: 'SPL-Z-01' }),
    entry({ id: 'SF-2', segment: 'Barrian Main', segmentId: 'SPL-Barrian-02' }),
    entry({ id: 'SF-3', segment: 'Barrian Main', segmentId: 'SPL-Barrian-02', date: '2026-11-06' }),
    entry({ id: 'SF-4', segment: 'Alpha', segmentId: 'SPL-A-01' }),
  ];
  const counts = segmentFaultCounts(list);
  assert.deepEqual(counts.map((row) => [row.segmentId, row.count]), [['SPL-Barrian-02', 2], ['SPL-A-01', 1], ['SPL-Z-01', 1]]);
});

test('summary text: empty history and a history with a most-repeated segment', () => {
  assert.equal(segmentFaultSummaryText([]), 'No segment fault recorded yet.');
  const list = [entry(), entry({ id: 'SF-2', date: '2026-11-06' })];
  assert.equal(segmentFaultSummaryText(list), '2 segment faults across 1 segment; most repeated: Barrian Main (2).');
  assert.equal(segmentFaultSummaryText([entry()]), '1 segment fault across 1 segment; most repeated: Barrian Main (1).');
});

test('segment page with no faults says so plainly', () => {
  assert.equal(segmentFaultHtml([], 'SPL-None-00'), '<p>No fault recorded for this segment.</p>');
  assert.equal(segmentFaultHtml([entry()], 'SPL-Other-01'), '<p>No fault recorded for this segment.</p>');
});

test('segment page html lists newest first with the repeat count', () => {
  const list = [entry({ id: 'SF-1', date: '2026-11-01' }), entry({ id: 'SF-2', date: '2026-11-09' })];
  const html = segmentFaultHtml(list, 'SPL-Barrian-02');
  assert.match(html, /2 faults recorded for this segment \(repeat count: 2\)/);
  assert.ok(html.indexOf('2026-11-09') < html.indexOf('2026-11-01'));
  const escaped = segmentFaultHtml([entry({ note: '<b>cut</b>' })], 'SPL-Barrian-02');
  assert.doesNotMatch(escaped, /<b>cut<\/b>/);
  assert.match(escaped, /&lt;b&gt;cut&lt;\/b&gt;/);
});

test('csv: header and rows, with quoting for commas and quotes', () => {
  const csv = segmentFaultCsv([entry({ note: 'cut, "bad" joint' })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,segment,segment_id,affected_customers,date,note');
  assert.equal(lines[1], 'SF-1,Barrian Main,SPL-Barrian-02,8,2026-11-05,"cut, ""bad"" joint"');
  assert.equal(segmentFaultCsv([]), 'id,segment,segment_id,affected_customers,date,note');
});

test('filename is stable', () => {
  assert.equal(segmentFaultFilename(), 'segment-fault-history.csv');
});

test('list normalisation drops half-formed entries and duplicate ids', () => {
  const list = normalizeSegmentFaultList([entry(), entry({ segmentId: '' }), entry(), entry({ id: 'SF-2', date: '2026-11-06' })]);
  assert.deepEqual(list.map((row) => row.id), ['SF-1', 'SF-2']);
  assert.deepEqual(normalizeSegmentFaultList(null), []);
  assert.equal(findSegmentFault([entry()], 'SF-1').segment, 'Barrian Main');
  assert.equal(findSegmentFault([entry()], 'SF-9'), null);
});

test('inputs are never mutated by upsert or remove', () => {
  const before = [entry()];
  const snapshot = JSON.stringify(before);
  upsertSegmentFault(before, entry({ id: 'SF-2', date: '2026-11-06' }));
  removeSegmentFault(before, 'SF-1');
  assert.equal(JSON.stringify(before), snapshot);
});
