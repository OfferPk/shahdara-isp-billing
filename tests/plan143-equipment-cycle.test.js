import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validEquipmentCycleDate,
  cleanEquipmentCycleDays,
  addEquipmentCycleDays,
  normalizeEquipmentCycleRecord,
  normalizeEquipmentCycleList,
  findEquipmentCycleRecord,
  upsertEquipmentCycleRecord,
  removeEquipmentCycleRecord,
  recordEquipmentCycleCheck,
  overdueEquipmentCycleItems,
  dueSoonEquipmentCycleItems,
  equipmentCycleSummaryText,
  equipmentCycleDueHtml,
  equipmentCycleCsv,
  equipmentCycleFilename,
} from '../equipment-cycle.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'EQ-1',
  item: 'Optical power meter',
  lastCheck: '2026-10-01',
  cycleDays: 90,
  note: 'Field kit A',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validEquipmentCycleDate('2026-08-31'), '2026-08-31');
  assert.equal(validEquipmentCycleDate('2026-10-31'), '2026-10-31');
  assert.equal(validEquipmentCycleDate('2026-12-31'), '2026-12-31');
  assert.equal(validEquipmentCycleDate('2024-02-29'), '2024-02-29');
  assert.equal(validEquipmentCycleDate('2026-02-30'), null);
  assert.equal(validEquipmentCycleDate('2026-04-31'), null);
  assert.equal(validEquipmentCycleDate('2026-09-31'), null);
  assert.equal(validEquipmentCycleDate('2026-11-31'), null);
  assert.equal(validEquipmentCycleDate('2026-13-01'), null);
  assert.equal(validEquipmentCycleDate('01-10-2026'), null);
  assert.equal(validEquipmentCycleDate(''), null);
  assert.equal(validEquipmentCycleDate(null), null);
});

test('half-formed records refused: no item, no cycle, no id, no date', () => {
  assert.equal(normalizeEquipmentCycleRecord(record({ item: '' })), null);
  assert.equal(normalizeEquipmentCycleRecord(record({ item: '   ' })), null);
  assert.equal(normalizeEquipmentCycleRecord(record({ cycleDays: undefined })), null);
  assert.equal(normalizeEquipmentCycleRecord(record({ cycleDays: 0 })), null);
  assert.equal(normalizeEquipmentCycleRecord(record({ cycleDays: -30 })), null);
  assert.equal(normalizeEquipmentCycleRecord(record({ cycleDays: 90.5 })), null);
  assert.equal(normalizeEquipmentCycleRecord(record({ cycleDays: 'abc' })), null);
  assert.equal(normalizeEquipmentCycleRecord(record({ id: '' })), null);
  assert.equal(normalizeEquipmentCycleRecord(record({ lastCheck: '2026-02-30' })), null);
  assert.equal(normalizeEquipmentCycleRecord(record({ lastCheck: '' })), null);
  assert.equal(normalizeEquipmentCycleRecord(null), null);
  assert.equal(normalizeEquipmentCycleRecord('nope'), null);
});

test('cycle days accept a numeric string, next due is always computed', () => {
  const row = normalizeEquipmentCycleRecord(record({ cycleDays: '90' }));
  assert.equal(row.cycleDays, 90);
  assert.equal(row.nextDue, '2026-12-30');
  // An input nextDue is ignored: the due date is computed, never taken.
  const forced = normalizeEquipmentCycleRecord(record({ nextDue: '2030-01-01' }));
  assert.equal(forced.nextDue, '2026-12-30');
});

test('unknown fields dropped, so no stock, warranty, or payment field creeps in', () => {
  const row = normalizeEquipmentCycleRecord(record({
    stockCount: 5, warrantyClaim: 'W-9', paymentId: 'PAY-1', billTotal: 100,
  }));
  assert.equal('stockCount' in row, false);
  assert.equal('warrantyClaim' in row, false);
  assert.equal('paymentId' in row, false);
  assert.equal('billTotal' in row, false);
  assert.deepEqual(Object.keys(row).sort(),
    ['cycleDays', 'id', 'item', 'lastCheck', 'nextDue', 'note']);
});

test('day arithmetic crosses months, years, and leap day in UTC', () => {
  assert.equal(addEquipmentCycleDays('2026-12-30', 5), '2027-01-04');
  assert.equal(addEquipmentCycleDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addEquipmentCycleDays('2026-01-31', 30), '2026-03-02');
  assert.equal(addEquipmentCycleDays('2026-10-01', 90), '2026-12-30');
});

test('duplicate ids never rewritten; identical re-save leaves list unchanged', () => {
  const list = upsertEquipmentCycleRecord([], record());
  assert.equal(list.length, 1);
  const same = upsertEquipmentCycleRecord(list, record());
  assert.equal(same.length, 1);
  assert.deepEqual(same, list);
  const changed = upsertEquipmentCycleRecord(list, record({ lastCheck: '2026-10-05' }));
  assert.equal(changed.length, 1);
  assert.deepEqual(changed, list);
});

test('one cycle record per equipment item, case-insensitive', () => {
  const list = upsertEquipmentCycleRecord([], record());
  const second = upsertEquipmentCycleRecord(list, record({ id: 'EQ-2', item: 'optical power meter' }));
  assert.equal(second.length, 1);
  const other = upsertEquipmentCycleRecord(list, record({ id: 'EQ-2', item: 'OTDR tester' }));
  assert.equal(other.length, 2);
});

test('find and remove by id', () => {
  const list = upsertEquipmentCycleRecord([], record());
  assert.equal(findEquipmentCycleRecord(list, 'EQ-1').item, 'Optical power meter');
  assert.equal(findEquipmentCycleRecord(list, 'EQ-9'), null);
  assert.equal(findEquipmentCycleRecord(list, ''), null);
  assert.deepEqual(removeEquipmentCycleRecord(list, 'EQ-1'), []);
  assert.equal(removeEquipmentCycleRecord(list, 'EQ-9').length, 1);
  // A removed item may gain a fresh record later.
  const fresh = upsertEquipmentCycleRecord(removeEquipmentCycleRecord(list, 'EQ-1'),
    record({ id: 'EQ-2', lastCheck: '2026-11-01' }));
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].nextDue, '2027-01-30');
});

test('recording a check moves next due forward by exactly the cycle', () => {
  const list = upsertEquipmentCycleRecord([], record());
  const next = recordEquipmentCycleCheck(list, 'EQ-1', '2026-12-30');
  assert.equal(next[0].lastCheck, '2026-12-30');
  assert.equal(next[0].nextDue, '2027-03-30');
  // A second check moves it forward again by the same cycle.
  const again = recordEquipmentCycleCheck(next, 'EQ-1', '2027-03-30');
  assert.equal(again[0].nextDue, '2027-06-28');
});

test('backward or invalid check dates refused; unknown id unchanged', () => {
  const list = upsertEquipmentCycleRecord([], record());
  assert.deepEqual(recordEquipmentCycleCheck(list, 'EQ-1', '2026-09-30'), list);
  assert.deepEqual(recordEquipmentCycleCheck(list, 'EQ-1', '2026-02-30'), list);
  assert.deepEqual(recordEquipmentCycleCheck(list, 'EQ-1', ''), list);
  assert.deepEqual(recordEquipmentCycleCheck(list, 'EQ-9', '2026-12-30'), list);
  // A check on the same date as the last check is a no-op, not a refusal error.
  const same = recordEquipmentCycleCheck(list, 'EQ-1', '2026-10-01');
  assert.deepEqual(same, list);
});

test('overdue list: strictly before the reference date, due-date order', () => {
  const list = normalizeEquipmentCycleList([
    record({ id: 'EQ-A', item: 'Meter A', lastCheck: '2026-09-01', cycleDays: 30 }),
    record({ id: 'EQ-B', item: 'Meter B', lastCheck: '2026-10-01', cycleDays: 90 }),
    record({ id: 'EQ-C', item: 'Meter C', lastCheck: '2026-08-01', cycleDays: 30 }),
  ]);
  // nextDue: A 2026-10-01, B 2026-12-30, C 2026-08-31.
  const overdue = overdueEquipmentCycleItems(list, '2026-10-01');
  assert.deepEqual(overdue.map((row) => row.id), ['EQ-C']);
  const wider = overdueEquipmentCycleItems(list, '2026-12-31');
  assert.deepEqual(wider.map((row) => row.id), ['EQ-C', 'EQ-A', 'EQ-B']);
  // Due exactly on the reference date is not overdue.
  assert.deepEqual(overdueEquipmentCycleItems(list, '2026-08-31'), []);
  // An invalid reference date gives an empty list, never a guess.
  assert.deepEqual(overdueEquipmentCycleItems(list, 'not-a-date'), []);
});

test('due-soon list: window boundaries inclusive, outside excluded', () => {
  const list = normalizeEquipmentCycleList([
    record({ id: 'EQ-A', item: 'Meter A', lastCheck: '2026-09-01', cycleDays: 30 }),
    record({ id: 'EQ-B', item: 'Meter B', lastCheck: '2026-10-01', cycleDays: 90 }),
  ]);
  // nextDue: A 2026-10-01, B 2026-12-30.
  const soon = dueSoonEquipmentCycleItems(list, '2026-10-01', 30);
  assert.deepEqual(soon.map((row) => row.id), ['EQ-A']);
  const horizon = dueSoonEquipmentCycleItems(list, '2026-11-30', 30);
  assert.deepEqual(horizon.map((row) => row.id), ['EQ-B']);
  // Due exactly on the reference date counts as due soon; past it does not.
  const outside = dueSoonEquipmentCycleItems(list, '2026-10-02', 10);
  assert.deepEqual(outside, []);
  assert.deepEqual(dueSoonEquipmentCycleItems(list, '2026-10-01', 0), []);
  assert.deepEqual(dueSoonEquipmentCycleItems(list, 'bad-date', 30), []);
});

test('inputs never mutated', () => {
  const raw = record();
  const snapshot = JSON.stringify(raw);
  normalizeEquipmentCycleRecord(raw);
  const list = [raw];
  upsertEquipmentCycleRecord(list, record({ id: 'EQ-2', item: 'OTDR tester' }));
  recordEquipmentCycleCheck(list, 'EQ-1', '2026-12-30');
  assert.equal(JSON.stringify(raw), snapshot);
  assert.equal(list.length, 1);
});

test('summary text', () => {
  assert.equal(equipmentCycleSummaryText([]), 'No equipment cycle record yet.');
  const list = normalizeEquipmentCycleList([
    record({ id: 'EQ-A', item: 'Meter A', lastCheck: '2026-09-01', cycleDays: 30 }),
    record({ id: 'EQ-B', item: 'Meter B', lastCheck: '2026-10-01', cycleDays: 90 }),
  ]);
  assert.equal(equipmentCycleSummaryText(list),
    '2 equipment cycle records; next due dates from 2026-10-01.');
});

test('due html: overdue and due-soon sections, plain messages when empty', () => {
  const list = normalizeEquipmentCycleList([
    record({ id: 'EQ-A', item: 'Meter A', lastCheck: '2026-09-01', cycleDays: 30 }),
  ]);
  const html = equipmentCycleDueHtml(list, '2026-10-15', 30);
  assert.ok(html.includes('1 overdue item'));
  assert.ok(html.includes('Meter A'));
  assert.ok(html.includes('No item due soon.'));
  const empty = equipmentCycleDueHtml([], '2026-10-15');
  assert.ok(empty.includes('No item overdue.'));
  const bad = equipmentCycleDueHtml(list, 'bad-date');
  assert.ok(bad.includes('Pick a real reference date'));
});

test('html escaping', () => {
  const list = normalizeEquipmentCycleList([
    record({ item: '<script>alert(1)</script>', note: 'A & B "quoted"' }),
  ]);
  // Reference date past the due date, so the row appears in the overdue section.
  const html = equipmentCycleDueHtml(list, '2027-01-15', 30);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; B &quot;quoted&quot;'));
});

test('csv and filename', () => {
  const list = normalizeEquipmentCycleList([
    record({ note: 'Drops, nightly' }),
  ]);
  const csv = equipmentCycleCsv(list);
  assert.equal(csv.split('\n')[0], 'id,item,lastCheck,cycleDays,nextDue,note');
  assert.ok(csv.includes('"Drops, nightly"'));
  assert.ok(csv.includes('2026-12-30'));
  assert.equal(equipmentCycleFilename(), 'equipment-cycle.csv');
});

test('module is pure and import-free', () => {
  const src = readFileSync(join(dir, '..', 'equipment-cycle.js'), 'utf8');
  assert.ok(!src.includes('import '));
  assert.ok(!src.includes('require('));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('fetch('));
});

test('panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['cycleSummary', 'cycleExportBtn', 'cycleItem', 'cycleLastCheck',
    'cycleDays', 'cycleNote', 'cycleSaveBtn', 'cycleRefDate', 'cycleWindow',
    'cycleDueBody', 'cycleCheckId', 'cycleCheckDate', 'cycleCheckBtn',
    'cycleRemoveId', 'cycleRemoveBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
