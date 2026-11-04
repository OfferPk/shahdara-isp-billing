import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validBatteryRuntimeDate,
  normalizeBatteryRuntimeRecord,
  normalizeBatteryRuntimeList,
  findBatteryRuntimeRecord,
  upsertBatteryRuntimeRecord,
  removeBatteryRuntimeRecord,
  runtimesForUnit,
  latestBatteryRuntime,
  unitLatestRuntimes,
  formatBatteryRuntime,
  batteryRuntimeSummaryText,
  batteryRuntimeHtml,
  batteryRuntimeCsv,
  batteryRuntimeFilename,
} from '../battery-runtime.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'BAT-1',
  unit: 'Site A UPS',
  date: '2026-11-01',
  runtimeMinutes: 90,
  note: 'Held through the test',
  ...over,
});

test('strict dates: real dates pass, impossible dates fail', () => {
  assert.equal(validBatteryRuntimeDate('2026-08-31'), '2026-08-31');
  assert.equal(validBatteryRuntimeDate('2026-10-31'), '2026-10-31');
  assert.equal(validBatteryRuntimeDate('2026-12-31'), '2026-12-31');
  assert.equal(validBatteryRuntimeDate('2024-02-29'), '2024-02-29');
  assert.equal(validBatteryRuntimeDate('2026-02-30'), null);
  assert.equal(validBatteryRuntimeDate('2026-04-31'), null);
  assert.equal(validBatteryRuntimeDate('2026-09-31'), null);
  assert.equal(validBatteryRuntimeDate('2026-11-31'), null);
  assert.equal(validBatteryRuntimeDate('2026-13-01'), null);
  assert.equal(validBatteryRuntimeDate('01-11-2026'), null);
  assert.equal(validBatteryRuntimeDate(''), null);
  assert.equal(validBatteryRuntimeDate(null), null);
});

test('half-formed records refused: no unit, no date, no runtime', () => {
  assert.equal(normalizeBatteryRuntimeRecord(record({ unit: '' })), null);
  assert.equal(normalizeBatteryRuntimeRecord(record({ unit: '   ' })), null);
  assert.equal(normalizeBatteryRuntimeRecord(record({ date: '' })), null);
  assert.equal(normalizeBatteryRuntimeRecord(record({ date: '2026-02-30' })), null);
  assert.equal(normalizeBatteryRuntimeRecord(record({ runtimeMinutes: undefined })), null);
  assert.equal(normalizeBatteryRuntimeRecord(record({ runtimeMinutes: 0 })), null);
  assert.equal(normalizeBatteryRuntimeRecord(record({ runtimeMinutes: -5 })), null);
  assert.equal(normalizeBatteryRuntimeRecord(record({ runtimeMinutes: 'soon' })), null);
  assert.equal(normalizeBatteryRuntimeRecord(record({ runtimeMinutes: NaN })), null);
  assert.equal(normalizeBatteryRuntimeRecord(record({ id: '' })), null);
  assert.equal(normalizeBatteryRuntimeRecord(null), null);
  assert.equal(normalizeBatteryRuntimeRecord('nope'), null);
});

test('numeric-string runtime accepted, unknown fields dropped', () => {
  const clean = normalizeBatteryRuntimeRecord(record({
    runtimeMinutes: '75',
    ticketId: 'T-1',
    billId: 'B-1',
    payment: 500,
  }));
  assert.equal(clean.runtimeMinutes, 75);
  assert.equal('ticketId' in clean, false);
  assert.equal('billId' in clean, false);
  assert.equal('payment' in clean, false);
});

test('duplicate ids never rewritten', () => {
  const base = [record()];
  assert.deepEqual(upsertBatteryRuntimeRecord(base, record()), base);
  const changed = upsertBatteryRuntimeRecord(base, record({ runtimeMinutes: 30 }));
  assert.deepEqual(changed, base);
  assert.equal(changed.length, 1);
});

test('upsert adds a valid record and normalize drops half-formed and duplicate ids', () => {
  const list = upsertBatteryRuntimeRecord([], record());
  assert.equal(list.length, 1);
  const mixed = normalizeBatteryRuntimeList([
    record(),
    record({ id: 'BAT-2', date: '2026-02-30' }),
    record({ id: 'BAT-1', runtimeMinutes: 10 }),
    record({ id: 'BAT-3', unit: 'Site B UPS', date: '2026-11-02', runtimeMinutes: 45 }),
  ]);
  assert.deepEqual(mixed.map((item) => item.id), ['BAT-1', 'BAT-3']);
});

test('find and remove by id', () => {
  const list = [record(), record({ id: 'BAT-2', date: '2026-11-02' })];
  assert.equal(findBatteryRuntimeRecord(list, 'BAT-2').date, '2026-11-02');
  assert.equal(findBatteryRuntimeRecord(list, 'BAT-9'), null);
  assert.equal(findBatteryRuntimeRecord(list, ''), null);
  assert.deepEqual(removeBatteryRuntimeRecord(list, 'BAT-1').map((item) => item.id), ['BAT-2']);
  assert.deepEqual(removeBatteryRuntimeRecord(list, 'BAT-9'), list);
});

test('unit page newest first, latest runtime prominent', () => {
  const list = [
    record({ id: 'BAT-1', date: '2026-11-01', runtimeMinutes: 90 }),
    record({ id: 'BAT-2', date: '2026-11-05', runtimeMinutes: 60 }),
    record({ id: 'BAT-3', date: '2026-11-03', runtimeMinutes: 75 }),
    record({ id: 'BAT-4', unit: 'Site B UPS', date: '2026-11-06', runtimeMinutes: 120 }),
  ];
  assert.deepEqual(runtimesForUnit(list, 'Site A UPS').map((item) => item.id), ['BAT-2', 'BAT-3', 'BAT-1']);
  assert.deepEqual(runtimesForUnit(list, 'site a ups').map((item) => item.id), ['BAT-2', 'BAT-3', 'BAT-1']);
  assert.deepEqual(runtimesForUnit(list, 'No such unit'), []);
  assert.equal(latestBatteryRuntime(list, 'Site A UPS').runtimeMinutes, 60);
  assert.equal(latestBatteryRuntime(list, 'No such unit'), null);
});

test('unit latest runtimes list is unit A-Z', () => {
  const list = [
    record({ id: 'BAT-1', unit: 'Site B UPS', date: '2026-11-01', runtimeMinutes: 120 }),
    record({ id: 'BAT-2', unit: 'Site A UPS', date: '2026-11-02', runtimeMinutes: 45 }),
    record({ id: 'BAT-3', unit: 'Site A UPS', date: '2026-11-05', runtimeMinutes: 40 }),
  ];
  const latest = unitLatestRuntimes(list);
  assert.deepEqual(latest.map((row) => row.unit), ['Site A UPS', 'Site B UPS']);
  assert.equal(latest[0].runtimeMinutes, 40);
});

test('runtime formatting', () => {
  assert.equal(formatBatteryRuntime(45), '45 min');
  assert.equal(formatBatteryRuntime(60), '1h');
  assert.equal(formatBatteryRuntime(90), '1h 30m');
  assert.equal(formatBatteryRuntime(125), '2h 05m');
  assert.equal(formatBatteryRuntime(0), '');
  assert.equal(formatBatteryRuntime(-10), '');
  assert.equal(formatBatteryRuntime('90'), '');
});

test('summary text names counts and shortest latest runtime', () => {
  assert.equal(batteryRuntimeSummaryText([]), 'No battery runtime record yet.');
  const list = [
    record({ id: 'BAT-1', unit: 'Site A UPS', runtimeMinutes: 90 }),
    record({ id: 'BAT-2', unit: 'Site B UPS', runtimeMinutes: 35 }),
  ];
  const summary = batteryRuntimeSummaryText(list);
  assert.ok(summary.includes('2 runtime records'));
  assert.ok(summary.includes('2 units'));
  assert.ok(summary.includes('35 min'));
  assert.ok(summary.includes('Site B UPS'));
});

test('unit page html: latest prominent, empty unit says so plainly', () => {
  const html = batteryRuntimeHtml([
    record({ id: 'BAT-1', date: '2026-11-01', runtimeMinutes: 90 }),
    record({ id: 'BAT-2', date: '2026-11-05', runtimeMinutes: 60 }),
  ], 'Site A UPS');
  assert.ok(html.includes('Latest runtime: 1h'));
  assert.ok(html.includes('2026-11-05'));
  assert.ok(html.indexOf('2026-11-05') < html.indexOf('2026-11-01'));
  assert.equal(batteryRuntimeHtml([], 'Site A UPS'), '<p>No runtime record for this unit.</p>');
});

test('html escapes markup in unit and note text', () => {
  const html = batteryRuntimeHtml([record({ note: '<script>alert(1)</script>' })], 'Site A UPS');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('csv and filename', () => {
  const csv = batteryRuntimeCsv([record({ note: 'Drops, nightly' })]);
  assert.equal(csv.split('\n')[0], 'id,unit,date,runtimeMinutes,note');
  assert.ok(csv.includes('"Drops, nightly"'));
  assert.equal(batteryRuntimeFilename(), 'battery-runtime.csv');
});

test('inputs are never mutated', () => {
  const raw = record({ runtimeMinutes: '90' });
  const before = JSON.stringify(raw);
  normalizeBatteryRuntimeRecord(raw);
  upsertBatteryRuntimeRecord([raw], record({ id: 'BAT-2' }));
  assert.equal(JSON.stringify(raw), before);
});

test('module is pure and import-free', () => {
  const src = readFileSync(join(dir, '..', 'battery-runtime.js'), 'utf8');
  assert.ok(!src.includes('import '));
  assert.ok(!src.includes('require('));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('fetch('));
});

test('panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['batterySummary', 'batteryExportBtn', 'batteryUnit', 'batteryDate',
    'batteryRuntime', 'batteryNote', 'batterySaveBtn', 'batteryFilter', 'batteryBody',
    'batteryRemoveId', 'batteryRemoveBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
