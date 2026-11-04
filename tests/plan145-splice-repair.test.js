import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validSpliceRepairDate,
  normalizeSpliceRepairRecord,
  normalizeSpliceRepairList,
  findSpliceRepairRecord,
  upsertSpliceRepairRecord,
  removeSpliceRepairRecord,
  repairsForJoint,
  jointRepeatCount,
  jointsForSegment,
  spliceRepairSummaryText,
  spliceRepairHtml,
  spliceRepairCsv,
  spliceRepairFilename,
} from '../splice-repair.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'SPL-1',
  segment: 'Mohalla A feeder',
  joint: 'Pole 12 joint box',
  date: '2026-11-01',
  repairType: 're-splice',
  ticket: 'T-101',
  ...over,
});

test('strict dates: real dates pass, impossible dates fail', () => {
  assert.equal(validSpliceRepairDate('2026-08-31'), '2026-08-31');
  assert.equal(validSpliceRepairDate('2026-10-31'), '2026-10-31');
  assert.equal(validSpliceRepairDate('2026-12-31'), '2026-12-31');
  assert.equal(validSpliceRepairDate('2026-02-30'), null);
  assert.equal(validSpliceRepairDate('2026-11-31'), null);
  assert.equal(validSpliceRepairDate('2026-11-1'), null);
  assert.equal(validSpliceRepairDate(''), null);
  assert.equal(validSpliceRepairDate(null), null);
});

test('half-formed records are refused outright', () => {
  assert.equal(normalizeSpliceRepairRecord(record({ id: '' })), null);
  assert.equal(normalizeSpliceRepairRecord(record({ segment: '  ' })), null);
  assert.equal(normalizeSpliceRepairRecord(record({ joint: '' })), null);
  assert.equal(normalizeSpliceRepairRecord(record({ date: '' })), null);
  assert.equal(normalizeSpliceRepairRecord(record({ date: '2026-02-30' })), null);
  assert.equal(normalizeSpliceRepairRecord(null), null);
  assert.equal(normalizeSpliceRepairRecord('nope'), null);
});

test('repair type is one of the four types; anything else becomes other', () => {
  assert.equal(normalizeSpliceRepairRecord(record({ repairType: 're-terminate' })).repairType, 're-terminate');
  assert.equal(normalizeSpliceRepairRecord(record({ repairType: 'closure-replaced' })).repairType, 'closure-replaced');
  assert.equal(normalizeSpliceRepairRecord(record({ repairType: 'full-rebuild' })).repairType, 'other');
  assert.equal(normalizeSpliceRepairRecord(record({ repairType: '' })).repairType, 'other');
});

test('unknown fields are dropped, so a record can never grow a bill or payment field', () => {
  const clean = normalizeSpliceRepairRecord(record({ bill: 'B-1', payment: 500, ticketStatus: 'closed' }));
  assert.equal(clean.bill, undefined);
  assert.equal(clean.payment, undefined);
  assert.equal(clean.ticketStatus, undefined);
  assert.equal(clean.ticket, 'T-101');
});

test('duplicate ids are never rewritten', () => {
  const before = [record()];
  assert.deepEqual(upsertSpliceRepairRecord(before, record()), before);
  assert.deepEqual(upsertSpliceRepairRecord(before, record({ date: '2026-11-02' })), before);
  const next = upsertSpliceRepairRecord(before, record({ id: 'SPL-2' }));
  assert.equal(next.length, 2);
});

test('normalize list drops half-formed records and duplicate ids, first wins', () => {
  const list = normalizeSpliceRepairList([
    record(),
    record({ segment: '' }),
    record({ id: 'SPL-1', date: '2026-11-05' }),
    record({ id: 'SPL-2', date: '2026-11-03' }),
  ]);
  assert.deepEqual(list.map((item) => item.id), ['SPL-1', 'SPL-2']);
  assert.equal(list[0].date, '2026-11-01');
});

test('find and remove by id', () => {
  const list = [record(), record({ id: 'SPL-2' })];
  assert.equal(findSpliceRepairRecord(list, 'SPL-2').joint, 'Pole 12 joint box');
  assert.equal(findSpliceRepairRecord(list, 'SPL-9'), null);
  assert.equal(findSpliceRepairRecord(list, ''), null);
  assert.deepEqual(removeSpliceRepairRecord(list, 'SPL-1').map((item) => item.id), ['SPL-2']);
  assert.deepEqual(removeSpliceRepairRecord(list, 'SPL-9'), list);
});

test('joint repairs list newest first with a repeat count', () => {
  const list = [
    record({ id: 'SPL-1', date: '2026-11-01' }),
    record({ id: 'SPL-2', date: '2026-11-10' }),
    record({ id: 'SPL-3', date: '2026-11-05' }),
    record({ id: 'SPL-4', joint: 'Pole 20 joint box', date: '2026-11-12' }),
    record({ id: 'SPL-5', segment: 'Mohalla B feeder', date: '2026-11-12' }),
  ];
  assert.deepEqual(
    repairsForJoint(list, 'Mohalla A feeder', 'Pole 12 joint box').map((item) => item.id),
    ['SPL-2', 'SPL-3', 'SPL-1'],
  );
  assert.equal(jointRepeatCount(list, 'Mohalla A feeder', 'Pole 12 joint box'), 3);
  assert.equal(jointRepeatCount(list, 'Mohalla A feeder', 'Pole 20 joint box'), 1);
  assert.equal(jointRepeatCount(list, 'Mohalla A feeder', 'No such joint'), 0);
  assert.equal(jointRepeatCount(list, '', 'Pole 12 joint box'), 0);
});

test('joint matching is case-insensitive and trims whitespace', () => {
  const list = [record({ id: 'SPL-1' })];
  assert.equal(repairsForJoint(list, '  mohalla a feeder ', 'POLE 12 JOINT BOX').length, 1);
});

test('joints for a segment list joint A-Z with counts and latest dates', () => {
  const list = [
    record({ id: 'SPL-1', joint: 'Pole 20 joint box', date: '2026-11-01' }),
    record({ id: 'SPL-2', joint: 'Pole 12 joint box', date: '2026-11-10' }),
    record({ id: 'SPL-3', joint: 'Pole 12 joint box', date: '2026-11-03' }),
    record({ id: 'SPL-4', segment: 'Mohalla B feeder', joint: 'Pole 12 joint box' }),
  ];
  assert.deepEqual(jointsForSegment(list, 'Mohalla A feeder'), [
    { joint: 'Pole 12 joint box', count: 2, latestDate: '2026-11-10' },
    { joint: 'Pole 20 joint box', count: 1, latestDate: '2026-11-01' },
  ]);
  assert.deepEqual(jointsForSegment(list, 'No such segment'), []);
  assert.deepEqual(jointsForSegment(list, ''), []);
});

test('inputs are never mutated', () => {
  const raw = record({ repairType: 'bogus' });
  const snapshot = JSON.stringify(raw);
  normalizeSpliceRepairRecord(raw);
  upsertSpliceRepairRecord([raw], record({ id: 'SPL-2' }));
  assert.equal(JSON.stringify(raw), snapshot);
});

test('summary text counts repairs, joint locations, and segments', () => {
  assert.equal(spliceRepairSummaryText([]), 'No splice/joint repair recorded yet.');
  assert.equal(
    spliceRepairSummaryText([record(), record({ id: 'SPL-2', joint: 'Pole 20 joint box' })]),
    '2 repairs across 2 joint locations in 1 segment.',
  );
  assert.equal(
    spliceRepairSummaryText([record()]),
    '1 repair across 1 joint location in 1 segment.',
  );
});

test('joint page shows repeat count prominent and repairs newest first', () => {
  const list = [
    record({ id: 'SPL-1', date: '2026-11-01' }),
    record({ id: 'SPL-2', date: '2026-11-10', repairType: 'closure-replaced', ticket: 'T-102' }),
  ];
  const html = spliceRepairHtml(list, 'Mohalla A feeder', 'Pole 12 joint box');
  assert.ok(html.includes('Repeat count: 2'));
  assert.ok(html.indexOf('2026-11-10') < html.indexOf('2026-11-01'));
  assert.ok(html.includes('closure-replaced'));
  assert.ok(html.includes('T-102'));
  assert.equal(
    spliceRepairHtml(list, 'Mohalla A feeder', 'No such joint'),
    '<p>No splice/joint repair recorded for this joint location.</p>',
  );
});

test('html escapes user text', () => {
  const html = spliceRepairHtml(
    [record({ joint: '<b>Joint</b>', ticket: '<script>' })],
    'Mohalla A feeder',
    '<b>Joint</b>',
  );
  assert.ok(!html.includes('<b>Joint</b>'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;b&gt;Joint&lt;/b&gt;'));
});

test('csv and filename', () => {
  const csv = spliceRepairCsv([
    record({ joint: 'Pole, 12 "joint" box' }),
    record({ id: 'SPL-2', date: '2026-11-02' }),
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,segment,joint,date,repairType,ticket');
  assert.ok(lines[1].includes('"Pole, 12 ""joint"" box"'));
  assert.equal(lines[2], 'SPL-2,Mohalla A feeder,Pole 12 joint box,2026-11-02,re-splice,T-101');
  assert.equal(spliceRepairFilename(), 'splice-joint-repairs.csv');
});

test('module is pure and import-free', () => {
  const source = readFileSync(join(dir, '..', 'splice-repair.js'), 'utf8');
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
});

test('panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  const ids = [
    'spliceSegment', 'spliceJoint', 'spliceDate', 'spliceType', 'spliceTicket',
    'spliceSaveBtn', 'spliceFilterSegment', 'spliceFilterJoint', 'spliceBody',
    'spliceSummary', 'spliceRemoveId', 'spliceRemoveBtn', 'spliceExportBtn',
  ];
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
