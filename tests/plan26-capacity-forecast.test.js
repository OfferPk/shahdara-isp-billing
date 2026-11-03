import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAPACITY_FORECAST_DEFAULT_THRESHOLD,
  normalizeCapacityThreshold,
  normalizeCapacityRecord,
  normalizeCapacityRecords,
  buildCapacityForecast,
  capacityForecastSummaryText,
  capacityForecastHtml,
  capacityForecastCsv,
  capacityForecastFilename,
} from '../capacity-forecast.js';

const rec = (customerId, unitId, ponPort, splitter, customerName) => ({
  customerId, unitId, ponPort, splitter, customerName: customerName ?? customerId,
});

test('threshold: default 80, valid values kept, invalid falls back as a whole', () => {
  assert.equal(CAPACITY_FORECAST_DEFAULT_THRESHOLD, 80);
  assert.equal(normalizeCapacityThreshold(undefined), 80);
  assert.equal(normalizeCapacityThreshold(50), 50);
  assert.equal(normalizeCapacityThreshold('90'), 90);
  assert.equal(normalizeCapacityThreshold(100), 100);
  for (const bad of [0, -10, 101, NaN, 'soon', null, {}, []]) {
    assert.equal(normalizeCapacityThreshold(bad), 80);
  }
});

test('record normalisation: no customer rejected, port upper-cased, blank unit kept', () => {
  assert.equal(normalizeCapacityRecord(null), null);
  assert.equal(normalizeCapacityRecord({ unitId: 'U1', ponPort: '3' }), null);
  assert.deepEqual(normalizeCapacityRecord(rec('c1', 'u1', 'p3', 's1')), {
    customerId: 'c1', customerName: 'c1', unitId: 'u1', ponPort: 'P3', splitter: 's1',
  });
  assert.equal(normalizeCapacityRecord(rec('c1', '', '2', '')).unitId, '');
});

test('records: last row per customer wins, sorted name A–Z, inputs never mutated', () => {
  const input = [rec('c2', 'U1', '2', 'S1', 'Zed'), rec('c1', 'U1', '1', 'S1', 'Amy'), rec('c2', 'U2', '5', 'S2', 'Zed')];
  const snapshot = JSON.stringify(input);
  const out = normalizeCapacityRecords(input);
  assert.deepEqual(out.map((r) => r.customerId), ['c1', 'c2']);
  assert.equal(out.find((r) => r.customerId === 'c2').unitId, 'U2');
  assert.equal(JSON.stringify(input), snapshot);
});

test('per-unit used/free: stated total gives free list and percent', () => {
  const f = buildCapacityForecast(
    [rec('c1', 'U1', '1', 'S1'), rec('c2', 'U1', '2', 'S1'), rec('c3', 'U1', '4', 'S2')],
    { U1: 5 },
    { threshold: 80 },
  );
  const u = f.units[0];
  assert.deepEqual(u.usedPorts, ['1', '2', '4']);
  assert.equal(u.usedCount, 3);
  assert.deepEqual(u.freePorts, ['3', '5']);
  assert.equal(u.freeCount, 2);
  assert.equal(u.usedPercent, 60);
  assert.equal(u.signal, false);
  assert.equal(f.totalUsed, 3);
});

test('per-unit used/free: unstated total means free and percent unknown, never guessed', () => {
  const f = buildCapacityForecast([rec('c1', 'U1', '1', 'S1')], {}, {});
  const u = f.units[0];
  assert.equal(u.totalPorts, null);
  assert.equal(u.freePorts, null);
  assert.equal(u.freeCount, null);
  assert.equal(u.usedPercent, null);
  assert.equal(u.signal, false);
});

test('per-unit used/free: non-numeric used port makes free unknown but used still counted', () => {
  const f = buildCapacityForecast([rec('c1', 'U1', 'A', 'S1'), rec('c2', 'U1', '2', 'S1')], { U1: 4 }, {});
  const u = f.units[0];
  assert.equal(u.usedCount, 2);
  assert.equal(u.freePorts, null);
  assert.equal(u.usedPercent, 50);
});

test('per-unit used/free: duplicate ports count once; a unit only in totals appears empty', () => {
  const f = buildCapacityForecast(
    [rec('c1', 'U1', '1', 'S1'), rec('c2', 'U1', '1', 'S1')],
    { U1: 3, U2: 2 },
    {},
  );
  assert.equal(f.units.find((u) => u.unitId === 'U1').usedCount, 1);
  const empty = f.units.find((u) => u.unitId === 'U2');
  assert.equal(empty.usedCount, 0);
  assert.equal(empty.freeCount, 2);
  assert.equal(empty.customerCount, 0);
});

test('customers per splitter: counts per segment, blank labelled, largest first', () => {
  const f = buildCapacityForecast(
    [rec('c1', 'U1', '1', 'S1'), rec('c2', 'U1', '2', 'S1'), rec('c3', 'U1', '3', ''), rec('c4', 'U1', '', 'S2')],
    { U1: 8 },
    {},
  );
  const u = f.units[0];
  assert.equal(u.customerCount, 4);
  assert.equal(u.customersWithoutPort, 1);
  assert.deepEqual(u.splitters.map((s) => [s.label, s.customerCount]), [
    ['S1', 2], ['No splitter recorded', 1], ['S2', 1],
  ]);
});

test('readiness signal: exactly at threshold signals, below does not', () => {
  const at = buildCapacityForecast(
    [rec('c1', 'U1', '1', ''), rec('c2', 'U1', '2', ''), rec('c3', 'U1', '3', ''), rec('c4', 'U1', '4', '')],
    { U1: 5 },
    { threshold: 80 },
  );
  assert.equal(at.units[0].signal, true);
  assert.deepEqual(at.units[0].trigger, { usedCount: 4, totalPorts: 5, usedPercent: 80, threshold: 80 });
  assert.equal(at.signalCount, 1);
  assert.equal(at.overallSignalUnit, 'U1');
  const below = buildCapacityForecast(
    [rec('c1', 'U1', '1', ''), rec('c2', 'U1', '2', ''), rec('c3', 'U1', '3', '')],
    { U1: 5 },
    { threshold: 80 },
  );
  assert.equal(below.units[0].signal, false);
  assert.equal(below.overallSignal, null);
});

test('readiness signal: changing the threshold never changes any record', () => {
  const records = [rec('c1', 'U1', '1', 'S1'), rec('c2', 'U1', '2', 'S1')];
  const low = buildCapacityForecast(records, { U1: 4 }, { threshold: 10 });
  const high = buildCapacityForecast(records, { U1: 4 }, { threshold: 90 });
  assert.equal(low.units[0].signal, true);
  assert.equal(high.units[0].signal, false);
  assert.deepEqual(low.units[0].usedPorts, high.units[0].usedPorts);
  assert.deepEqual(low.units[0].splitters, high.units[0].splitters);
  assert.equal(low.totalRecords, high.totalRecords);
});

test('unassigned unit: blank-unit records group together and never signal', () => {
  const f = buildCapacityForecast([rec('c1', '', '1', 'S1')], { U1: 4 }, { threshold: 10 });
  assert.equal(f.units.length, 2);
  const unassigned = f.units.find((u) => u.unitId === '');
  assert.equal(unassigned.label, 'Unassigned');
  assert.equal(unassigned.signal, false);
  assert.equal(unassigned.usedCount, 1);
});

test('summary text: units, ports used, signal note', () => {
  const f = buildCapacityForecast([rec('c1', 'U1', '1', '')], { U1: 1 }, {});
  assert.match(capacityForecastSummaryText(f), /1 unit · 1 port used · 1 readiness signal at 80%/);
  const none = buildCapacityForecast([rec('c1', 'U1', '1', '')], { U1: 10 }, {});
  assert.match(capacityForecastSummaryText(none), /no unit at the 80% threshold/);
  assert.match(capacityForecastSummaryText(buildCapacityForecast([], {}, {})), /0 units · 0 ports used/);
});

test('HTML: signal banner names the unit and the triggering count; names escaped', () => {
  const f = buildCapacityForecast(
    [rec('c1', 'U1', '1', '<S&>')],
    { U1: 1 },
    {},
  );
  const html = capacityForecastHtml(f);
  assert.match(html, /Readiness signal: U1 is at 1 of 1 ports used/);
  assert.match(html, /&lt;S&amp;&gt;/);
  assert.doesNotMatch(html, /<S&>/);
  assert.match(capacityForecastHtml(buildCapacityForecast([], {}, {})), /No unit has reached the readiness threshold yet/);
  assert.match(capacityForecastHtml(buildCapacityForecast([], {}, {})), /No connection records yet/);
});

test('CSV: header, unit row with splitter list, quoting', () => {
  const f = buildCapacityForecast([rec('c1', 'U,1', '1', 'S"1')], { 'U,1': 2 }, {});
  const csv = capacityForecastCsv(f);
  assert.ok(csv.startsWith('Unit,Used ports,Free ports,Total ports,Used %,Customers,Splitters,Signal'));
  assert.match(csv, /"U,1",1,1,2,50%,1,"S""1: 1",/);
  assert.equal(capacityForecastFilename(), 'capacity-forecast.csv');
});
