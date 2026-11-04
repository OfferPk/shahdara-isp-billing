import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validDropCableDate,
  cleanDropCableCondition,
  normalizeDropCableRecord,
  normalizeDropCableList,
  findDropCableRecord,
  upsertDropCableRecord,
  removeDropCableRecord,
  historyForDropCableCustomer,
  latestDropCableCondition,
  customerLatestDropCableConditions,
  poorDropCableWatchList,
  dropCableSummaryText,
  dropCableCustomerHtml,
  dropCableWatchHtml,
  dropCableCsv,
  dropCableFilename,
} from '../drop-cable.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'DC-1',
  customer: 'Ahmed',
  date: '2026-11-01',
  condition: 'good',
  routeNote: 'Pole 4 to house, slight sag',
  ...over,
});

test('strict dates: real dates pass, impossible dates fail', () => {
  assert.equal(validDropCableDate('2026-08-31'), '2026-08-31');
  assert.equal(validDropCableDate('2026-10-31'), '2026-10-31');
  assert.equal(validDropCableDate('2026-12-31'), '2026-12-31');
  assert.equal(validDropCableDate('2024-02-29'), '2024-02-29');
  assert.equal(validDropCableDate('2026-02-30'), null);
  assert.equal(validDropCableDate('2026-04-31'), null);
  assert.equal(validDropCableDate('2026-09-31'), null);
  assert.equal(validDropCableDate('2026-11-31'), null);
  assert.equal(validDropCableDate('2026-13-01'), null);
  assert.equal(validDropCableDate('not-a-date'), null);
  assert.equal(validDropCableDate(null), null);
});

test('half-formed records are refused: no customer, no date, or no id', () => {
  assert.equal(normalizeDropCableRecord(record({ customer: '  ' })), null);
  assert.equal(normalizeDropCableRecord(record({ customer: '' })), null);
  assert.equal(normalizeDropCableRecord(record({ date: '' })), null);
  assert.equal(normalizeDropCableRecord(record({ date: '2026-02-30' })), null);
  assert.equal(normalizeDropCableRecord(record({ id: '' })), null);
  assert.equal(normalizeDropCableRecord(null), null);
  assert.equal(normalizeDropCableRecord('nope'), null);
  assert.deepEqual(upsertDropCableRecord([], record({ customer: '' })), []);
});

test('condition normalization: unknown becomes watch, never a fourth state', () => {
  assert.equal(cleanDropCableCondition('good'), 'good');
  assert.equal(cleanDropCableCondition('watch'), 'watch');
  assert.equal(cleanDropCableCondition('poor'), 'poor');
  assert.equal(cleanDropCableCondition('bad'), 'watch');
  assert.equal(cleanDropCableCondition(''), 'watch');
  assert.equal(cleanDropCableCondition(null), 'watch');
  assert.equal(normalizeDropCableRecord(record({ condition: 'frayed' })).condition, 'watch');
});

test('unknown fields are dropped, never stored', () => {
  const clean = normalizeDropCableRecord(record({ bill: 'B-9', payment: 500, ticket: 'T-1' }));
  assert.deepEqual(Object.keys(clean).sort(), ['condition', 'customer', 'date', 'id', 'routeNote']);
});

test('duplicate ids are never rewritten', () => {
  const base = [record()];
  assert.deepEqual(upsertDropCableRecord(base, record()), base);
  assert.deepEqual(upsertDropCableRecord(base, record({ condition: 'poor' })), base);
  assert.equal(upsertDropCableRecord(base, record({ id: 'DC-2' })).length, 2);
});

test('list normalization drops half-formed records and later duplicate ids', () => {
  const list = normalizeDropCableList([record(), record({ condition: 'poor' }), record({ customer: '' })]);
  assert.equal(list.length, 1);
  assert.equal(list[0].condition, 'good');
  assert.deepEqual(normalizeDropCableList(null), []);
  assert.deepEqual(normalizeDropCableList('nope'), []);
});

test('find and remove by id', () => {
  const list = [record(), record({ id: 'DC-2', date: '2026-11-05' })];
  assert.equal(findDropCableRecord(list, 'DC-2').date, '2026-11-05');
  assert.equal(findDropCableRecord(list, 'DC-9'), null);
  assert.equal(findDropCableRecord(list, ''), null);
  assert.equal(removeDropCableRecord(list, 'DC-1').length, 1);
  assert.equal(removeDropCableRecord(list, 'DC-9').length, 2);
  assert.equal(removeDropCableRecord(list, '').length, 2);
});

test('customer history is newest first, then id A-Z', () => {
  const list = [
    record({ id: 'DC-2', date: '2026-11-09' }),
    record({ id: 'DC-1', date: '2026-11-01' }),
    record({ id: 'DC-3', date: '2026-11-09', customer: 'Bilal' }),
    record({ id: 'DC-4', date: '2026-11-09' }),
  ];
  const rows = historyForDropCableCustomer(list, 'ahmed');
  assert.deepEqual(rows.map((row) => row.id), ['DC-2', 'DC-4', 'DC-1']);
  assert.deepEqual(historyForDropCableCustomer(list, 'Nobody'), []);
});

test('latest condition is the newest record, or null with no record', () => {
  const list = [record(), record({ id: 'DC-2', date: '2026-11-09', condition: 'poor' })];
  assert.equal(latestDropCableCondition(list, 'Ahmed'), 'poor');
  assert.equal(latestDropCableCondition(list, 'Bilal'), null);
});

test('latest conditions per customer are customer A-Z', () => {
  const list = [
    record({ customer: 'Bilal', date: '2026-11-02', condition: 'watch' }),
    record({ date: '2026-11-01', condition: 'good' }),
    record({ id: 'DC-3', date: '2026-11-09', condition: 'poor' }),
  ];
  assert.deepEqual(
    customerLatestDropCableConditions(list).map((row) => [row.customer, row.condition]),
    [['Ahmed', 'poor'], ['Bilal', 'watch']],
  );
});

test('watch list holds only premises whose latest condition is poor', () => {
  const list = [
    record({ condition: 'poor' }),
    record({ id: 'DC-2', date: '2026-11-09', condition: 'good' }),
    record({ id: 'DC-3', customer: 'Bilal', date: '2026-11-03', condition: 'poor' }),
    record({ id: 'DC-4', customer: 'Sara', date: '2026-11-03', condition: 'watch' }),
  ];
  assert.deepEqual(poorDropCableWatchList(list).map((row) => row.customer), ['Bilal']);
  assert.deepEqual(poorDropCableWatchList([]), []);
  assert.deepEqual(poorDropCableWatchList(null), []);
});

test('summary text counts records, customers, poor, and watch', () => {
  assert.equal(dropCableSummaryText([]), 'No drop cable record recorded yet.');
  assert.equal(
    dropCableSummaryText([
      record(),
      record({ id: 'DC-2', date: '2026-11-09', condition: 'poor' }),
      record({ id: 'DC-3', customer: 'Bilal', condition: 'watch' }),
    ]),
    '3 drop cable records across 2 customers; 1 poor on the watch list, 1 watch.',
  );
  assert.equal(
    dropCableSummaryText([record()]),
    '1 drop cable record across 1 customer; 0 poor on the watch list, 0 watch.',
  );
});

test('customer html shows history newest first with latest condition prominent', () => {
  const html = dropCableCustomerHtml(
    [record(), record({ id: 'DC-2', date: '2026-11-09', condition: 'poor' })], 'Ahmed');
  assert.ok(html.includes('Latest condition: poor'));
  assert.ok(html.includes('newest first'));
  assert.ok(html.indexOf('2026-11-09') < html.indexOf('2026-11-01'));
  assert.ok(dropCableCustomerHtml([], 'Ahmed').includes('No drop cable record recorded for Ahmed yet.'));
  assert.ok(dropCableCustomerHtml([record()], '').includes('Pick a customer'));
});

test('watch html lists poor premises and says so plainly when empty', () => {
  const html = dropCableWatchHtml([record({ condition: 'poor' }), record({ id: 'DC-2', customer: 'Bilal' })]);
  assert.ok(html.includes('Ahmed'));
  assert.ok(!html.includes('Bilal'));
  assert.ok(dropCableWatchHtml([]).includes('No premises on the poor-condition watch list.'));
});

test('inputs are never mutated', () => {
  const raw = record();
  const snapshot = JSON.stringify(raw);
  normalizeDropCableRecord(raw);
  upsertDropCableRecord([raw], record({ id: 'DC-2' }));
  assert.equal(JSON.stringify(raw), snapshot);
});

test('html escaping: markup in route note and customer never renders', () => {
  const html = dropCableCustomerHtml(
    [record({ customer: '<b>Ahmed</b>', routeNote: '<script>alert(1)</script>' })], '<b>Ahmed</b>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(dropCableCustomerHtml([], '<b>Ahmed</b>').includes('&lt;b&gt;Ahmed&lt;/b&gt;'));
});

test('csv and filename', () => {
  const csv = dropCableCsv([record({ routeNote: 'says "hi", ok' })]);
  assert.ok(csv.startsWith('id,customer,date,condition,routeNote'));
  assert.ok(csv.includes('"says ""hi"", ok"'));
  assert.equal(dropCableFilename(), 'drop-cable-records.csv');
});

test('module is pure and import-free', () => {
  const src = readFileSync(join(dir, '..', 'drop-cable.js'), 'utf8');
  assert.ok(!src.includes('import '));
  assert.ok(!src.includes('require('));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('fetch('));
});

test('panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['dropCableSummary', 'dropCableExportBtn', 'dropCableCustomer',
    'dropCableDate', 'dropCableCondition', 'dropCableRouteNote',
    'dropCableSaveBtn', 'dropCableFilter', 'dropCableBody',
    'dropCableRemoveId', 'dropCableRemoveBtn', 'dropCableWatchBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
