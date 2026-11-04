import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validOnuSignalDate,
  cleanOnuDbm,
  normalizeOnuSignalReading,
  normalizeOnuSignalReadingList,
  findOnuSignalReading,
  upsertOnuSignalReading,
  removeOnuSignalReading,
  onuSignalsForCustomer,
  onuSignalTrend,
  onuSignalTrendForCustomer,
  onuSignalTrendFlags,
  onuSignalSummaryText,
  onuSignalHtml,
  onuSignalCsv,
  onuSignalFilename,
  ONU_TREND_MIN_FALL_DB,
} from '../onu-signal-trend.js';

const dir = dirname(fileURLToPath(import.meta.url));

const reading = (over = {}) => ({
  id: 'OS-1',
  customer: 'Ahmed',
  date: '2026-11-05',
  dbm: -19.0,
  note: 'Visit reading.',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validOnuSignalDate('2026-08-31'), '2026-08-31');
  assert.equal(validOnuSignalDate('2026-10-31'), '2026-10-31');
  assert.equal(validOnuSignalDate('2026-12-31'), '2026-12-31');
  assert.equal(validOnuSignalDate('2026-02-30'), null);
  assert.equal(validOnuSignalDate('2026-04-31'), null);
  assert.equal(validOnuSignalDate('2026-09-31'), null);
  assert.equal(validOnuSignalDate('2026-11-31'), null);
  assert.equal(validOnuSignalDate('not-a-date'), null);
  assert.equal(validOnuSignalDate(20261105), null);
});

test('non-numeric dBm refused, numeric strings accepted and rounded', () => {
  assert.equal(cleanOnuDbm(''), null);
  assert.equal(cleanOnuDbm('abc'), null);
  assert.equal(cleanOnuDbm(NaN), null);
  assert.equal(cleanOnuDbm(Infinity), null);
  assert.equal(cleanOnuDbm(-61), null);
  assert.equal(cleanOnuDbm(11), null);
  assert.equal(cleanOnuDbm(-19.44), -19.4);
  assert.equal(cleanOnuDbm('-21.25'), -21.2);
  assert.equal(cleanOnuDbm(-60), -60);
  assert.equal(cleanOnuDbm(10), 10);
  assert.equal(normalizeOnuSignalReading(reading({ dbm: 'weak' })), null);
});

test('half-formed readings refused: no id, no customer, no date', () => {
  assert.equal(normalizeOnuSignalReading(reading({ id: '  ' })), null);
  assert.equal(normalizeOnuSignalReading(reading({ customer: '' })), null);
  assert.equal(normalizeOnuSignalReading(reading({ date: '2026-02-30' })), null);
  assert.equal(normalizeOnuSignalReading(null), null);
  assert.equal(normalizeOnuSignalReading('nope'), null);
});

test('unknown fields dropped, so a reading can never grow a status, bill, or payment field', () => {
  const item = normalizeOnuSignalReading(reading({ status: 'disconnected', billTotal: 3000, paymentId: 'P-1', lastRxDbm: -15 }));
  assert.deepEqual(Object.keys(item).sort(), ['customer', 'date', 'dbm', 'id', 'note']);
});

test('duplicate ids never rewritten: identical re-save unchanged, different figures refused', () => {
  const base = [reading()];
  assert.equal(upsertOnuSignalReading(base, reading()).length, 1);
  assert.equal(upsertOnuSignalReading(base, reading({ dbm: -22 })).length, 1);
  assert.equal(upsertOnuSignalReading(base, reading({ dbm: -22 }))[0].dbm, -19);
  assert.equal(upsertOnuSignalReading(base, reading({ id: 'OS-2', dbm: -22 })).length, 2);
});

test('find and remove by id', () => {
  const list = [reading(), reading({ id: 'OS-2', dbm: -22 })];
  assert.equal(findOnuSignalReading(list, 'OS-2').dbm, -22);
  assert.equal(findOnuSignalReading(list, 'OS-9'), null);
  assert.deepEqual(removeOnuSignalReading(list, 'OS-1').map((row) => row.id), ['OS-2']);
});

test('customer page: readings in date order, customer match case-insensitive', () => {
  const list = [
    reading({ id: 'OS-3', date: '2026-11-07', dbm: -23 }),
    reading({ id: 'OS-1', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-2', date: '2026-11-06', dbm: -21 }),
    reading({ id: 'OS-4', customer: 'Bilal', date: '2026-11-05', dbm: -18 }),
  ];
  assert.deepEqual(onuSignalsForCustomer(list, 'ahmed').map((row) => row.id), ['OS-1', 'OS-2', 'OS-3']);
  assert.deepEqual(onuSignalsForCustomer(list, ''), []);
});

test('falling trend fires: strictly falling last three with total fall at least 3.0 dB', () => {
  assert.equal(ONU_TREND_MIN_FALL_DB, 3.0);
  const trend = onuSignalTrend([
    reading({ id: 'OS-1', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-2', date: '2026-11-06', dbm: -21 }),
    reading({ id: 'OS-3', date: '2026-11-07', dbm: -23 }),
  ]);
  assert.equal(trend.flagged, true);
  assert.equal(trend.totalDrop, 4.0);
  assert.deepEqual(trend.readings.map((row) => row.id), ['OS-1', 'OS-2', 'OS-3']);
});

test('falling trend boundary: exactly 3.0 dB fall fires', () => {
  const trend = onuSignalTrend([
    reading({ id: 'OS-1', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-2', date: '2026-11-06', dbm: -20 }),
    reading({ id: 'OS-3', date: '2026-11-07', dbm: -22 }),
  ]);
  assert.equal(trend.flagged, true);
  assert.equal(trend.totalDrop, 3.0);
});

test('no flag: flat step, a rise, a small fall, or fewer than three readings', () => {
  const flat = onuSignalTrend([
    reading({ id: 'OS-1', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-2', date: '2026-11-06', dbm: -21 }),
    reading({ id: 'OS-3', date: '2026-11-07', dbm: -21 }),
  ]);
  assert.equal(flat.flagged, false);
  const rising = onuSignalTrend([
    reading({ id: 'OS-1', date: '2026-11-05', dbm: -23 }),
    reading({ id: 'OS-2', date: '2026-11-06', dbm: -21 }),
    reading({ id: 'OS-3', date: '2026-11-07', dbm: -19 }),
  ]);
  assert.equal(rising.flagged, false);
  const small = onuSignalTrend([
    reading({ id: 'OS-1', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-2', date: '2026-11-06', dbm: -20 }),
    reading({ id: 'OS-3', date: '2026-11-07', dbm: -20.5 }),
  ]);
  assert.equal(small.flagged, false);
  assert.equal(small.totalDrop, 1.5);
  const few = onuSignalTrend([
    reading({ id: 'OS-1', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-2', date: '2026-11-06', dbm: -25 }),
  ]);
  assert.equal(few.flagged, false);
  assert.equal(few.totalDrop, null);
});

test('trend uses only the last three readings, and per-customer flags list flagged first', () => {
  const list = [
    reading({ id: 'OS-1', date: '2026-11-01', dbm: -30 }),
    reading({ id: 'OS-2', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-3', date: '2026-11-06', dbm: -20 }),
    reading({ id: 'OS-4', date: '2026-11-07', dbm: -21 }),
    reading({ id: 'OS-5', customer: 'Bilal', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-6', customer: 'Bilal', date: '2026-11-06', dbm: -21 }),
    reading({ id: 'OS-7', customer: 'Bilal', date: '2026-11-07', dbm: -24 }),
  ];
  const trend = onuSignalTrendForCustomer(list, 'Ahmed');
  assert.equal(trend.flagged, false);
  assert.equal(trend.totalDrop, 2.0);
  const flags = onuSignalTrendFlags(list);
  assert.deepEqual(flags.map((row) => [row.customer, row.flagged]), [['Bilal', true], ['Ahmed', false]]);
  assert.equal(onuSignalTrendForCustomer(list, 'Nobody'), null);
});

test('inputs never mutated by upsert or remove', () => {
  const list = [reading()];
  const snapshot = JSON.stringify(list);
  upsertOnuSignalReading(list, reading({ id: 'OS-2' }));
  removeOnuSignalReading(list, 'OS-1');
  assert.equal(JSON.stringify(list), snapshot);
});

test('summary text: empty log, counts, and flagged customers', () => {
  assert.equal(onuSignalSummaryText([]), 'No signal reading recorded yet.');
  const list = [
    reading({ id: 'OS-1', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-2', date: '2026-11-06', dbm: -21 }),
    reading({ id: 'OS-3', date: '2026-11-07', dbm: -23 }),
  ];
  assert.equal(onuSignalSummaryText(list), '3 signal readings across 1 customer; 1 customer showing a falling trend.');
});

test('customer page HTML: flag where the rule fires, plain text when no readings, escaped output', () => {
  const flagged = onuSignalHtml([
    reading({ id: 'OS-1', date: '2026-11-05', dbm: -19 }),
    reading({ id: 'OS-2', date: '2026-11-06', dbm: -21 }),
    reading({ id: 'OS-3', date: '2026-11-07', dbm: -23 }),
  ], 'Ahmed');
  assert.match(flagged, /Falling trend/);
  assert.match(flagged, /-19\.0 dBm → -21\.0 dBm → -23\.0 dBm/);
  assert.equal(onuSignalHtml([], 'Ahmed'), '<p>No signal reading recorded yet for Ahmed.</p>');
  assert.equal(onuSignalHtml([], ''), '<p>Pick a customer to see their signal readings.</p>');
  const escaped = onuSignalHtml([reading({ note: '<script>alert(1)</script>' })], 'Ahmed');
  assert.doesNotMatch(escaped, /<script>/);
});

test('CSV and filename', () => {
  const csv = onuSignalCsv([reading({ note: 'a, "quoted" note' })]);
  assert.equal(csv.split('\n')[0], 'id,customer,date,dbm,note');
  assert.match(csv, /"a, ""quoted"" note"/);
  assert.equal(onuSignalFilename(), 'onu-signal-trend.csv');
});

test('purity: module is import-free and touches no storage, DOM, or network', () => {
  const source = readFileSync(join(dir, '..', 'onu-signal-trend.js'), 'utf8');
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /XMLHttpRequest/);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['onuSignalCustomer', 'onuSignalDate', 'onuSignalDbm', 'onuSignalNote', 'onuSignalSaveBtn', 'onuSignalFilter', 'onuSignalRemoveId', 'onuSignalRemoveBtn', 'onuSignalBody', 'onuSignalSummary', 'onuSignalExportBtn', 'onuSignalFlagsBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
