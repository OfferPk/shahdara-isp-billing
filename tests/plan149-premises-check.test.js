import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validPremisesCheckDate,
  cleanPremisesCondition,
  normalizePremisesCheckRecord,
  normalizePremisesCheckList,
  findPremisesCheckRecord,
  upsertPremisesCheckRecord,
  removePremisesCheckRecord,
  checksForPremisesCustomer,
  poorPremisesItems,
  premisesCheckSummaryText,
  premisesCustomerChecksHtml,
  premisesCheckCsv,
  premisesCheckFilename,
} from '../premises-check.js';

const dir = dirname(fileURLToPath(import.meta.url));

const check = (over = {}) => ({
  id: 'CHK-1',
  customer: 'Ahmed',
  date: '2026-11-01',
  onu: 'good',
  router: 'watch',
  adapter: 'good',
  note: 'Warm ONU, still fine',
  ...over,
});

test('strict dates: real dates pass, impossible dates fail', () => {
  assert.equal(validPremisesCheckDate('2026-08-31'), '2026-08-31');
  assert.equal(validPremisesCheckDate('2026-10-31'), '2026-10-31');
  assert.equal(validPremisesCheckDate('2026-12-31'), '2026-12-31');
  assert.equal(validPremisesCheckDate('2024-02-29'), '2024-02-29');
  assert.equal(validPremisesCheckDate('2026-02-30'), null);
  assert.equal(validPremisesCheckDate('2026-04-31'), null);
  assert.equal(validPremisesCheckDate('2026-09-31'), null);
  assert.equal(validPremisesCheckDate('2026-11-31'), null);
  assert.equal(validPremisesCheckDate('not-a-date'), null);
  assert.equal(validPremisesCheckDate(''), null);
});

test('half-formed checks are refused: no customer, no date, no id', () => {
  assert.equal(normalizePremisesCheckRecord(check({ customer: '' })), null);
  assert.equal(normalizePremisesCheckRecord(check({ customer: '   ' })), null);
  assert.equal(normalizePremisesCheckRecord(check({ date: '' })), null);
  assert.equal(normalizePremisesCheckRecord(check({ date: '2026-02-30' })), null);
  assert.equal(normalizePremisesCheckRecord(check({ id: '' })), null);
  assert.equal(normalizePremisesCheckRecord(null), null);
  assert.equal(normalizePremisesCheckRecord('nope'), null);
});

test('condition normalization: unknown becomes watch, never a fourth state', () => {
  assert.equal(cleanPremisesCondition('good'), 'good');
  assert.equal(cleanPremisesCondition('poor'), 'poor');
  assert.equal(cleanPremisesCondition('watch'), 'watch');
  assert.equal(cleanPremisesCondition('broken'), 'watch');
  assert.equal(cleanPremisesCondition(''), 'watch');
  assert.equal(cleanPremisesCondition(undefined), 'watch');
  const row = normalizePremisesCheckRecord(check({ onu: 'dead', router: 'GOOD' }));
  assert.equal(row.onu, 'watch');
  assert.equal(row.router, 'watch');
});

test('unknown fields are dropped, never stored', () => {
  const row = normalizePremisesCheckRecord(check({
    deviceId: 'DEV-9', warrantyClaim: 'W-1', billId: 'B-1', payment: 500,
  }));
  assert.equal(row.deviceId, undefined);
  assert.equal(row.warrantyClaim, undefined);
  assert.equal(row.billId, undefined);
  assert.equal(row.payment, undefined);
  assert.deepEqual(Object.keys(row).sort(),
    ['adapter', 'customer', 'date', 'id', 'note', 'onu', 'router']);
});

test('duplicate ids are never rewritten', () => {
  const base = [check()];
  assert.deepEqual(upsertPremisesCheckRecord(base, check()), base);
  assert.deepEqual(upsertPremisesCheckRecord(base, check({ adapter: 'poor' })), base);
  assert.deepEqual(upsertPremisesCheckRecord(base, check({ id: 'CHK-2' })).length, 2);
});

test('normalize list drops half-formed rows and later duplicate ids', () => {
  const list = normalizePremisesCheckList([
    check(),
    check({ customer: '' }),
    check({ id: 'CHK-1', adapter: 'poor' }),
    check({ id: 'CHK-2', customer: 'Bilal' }),
    'junk',
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].adapter, 'good');
});

test('find and remove', () => {
  const list = [check(), check({ id: 'CHK-2', customer: 'Bilal' })];
  assert.equal(findPremisesCheckRecord(list, 'CHK-2').customer, 'Bilal');
  assert.equal(findPremisesCheckRecord(list, 'CHK-9'), null);
  assert.deepEqual(removePremisesCheckRecord(list, 'CHK-1').map((r) => r.id), ['CHK-2']);
});

test('customer page: newest first, case-insensitive customer match', () => {
  const list = [
    check({ id: 'CHK-1', date: '2026-10-01' }),
    check({ id: 'CHK-2', date: '2026-11-05' }),
    check({ id: 'CHK-3', date: '2026-11-05' }),
    check({ id: 'CHK-4', customer: 'Bilal', date: '2026-11-09' }),
  ];
  const rows = checksForPremisesCustomer(list, 'ahmed');
  assert.deepEqual(rows.map((r) => r.id), ['CHK-2', 'CHK-3', 'CHK-1']);
  assert.deepEqual(checksForPremisesCustomer(list, ''), []);
  assert.deepEqual(checksForPremisesCustomer(list, 'Nobody'), []);
});

test('poor items flagged per check', () => {
  assert.deepEqual(poorPremisesItems(check()), []);
  assert.deepEqual(poorPremisesItems(check({ onu: 'poor', adapter: 'poor' })), ['ONU', 'Adapter']);
  assert.deepEqual(poorPremisesItems(check({ router: 'poor' })), ['Router']);
  assert.deepEqual(poorPremisesItems(null), []);
});

test('customer html flags poor items and says so plainly when empty', () => {
  const html = premisesCustomerChecksHtml(
    [check({ adapter: 'poor' }), check({ id: 'CHK-2', date: '2026-11-09' })], 'Ahmed');
  assert.ok(html.includes('newest first'));
  assert.ok(html.includes('⚠ Poor: Adapter'));
  assert.ok(html.indexOf('2026-11-09') < html.indexOf('2026-11-01'));
  assert.ok(premisesCustomerChecksHtml([], 'Ahmed').includes('No premises check recorded for Ahmed yet.'));
  assert.ok(premisesCustomerChecksHtml([check()], '').includes('Pick a customer'));
});

test('summary text counts checks, customers, and poor flags', () => {
  assert.equal(premisesCheckSummaryText([]), 'No premises check recorded yet.');
  assert.equal(
    premisesCheckSummaryText([check(), check({ id: 'CHK-2', adapter: 'poor' }), check({ id: 'CHK-3', customer: 'Bilal' })]),
    '3 premises checks across 2 customers; 1 with a poor item flagged.');
});

test('inputs are never mutated', () => {
  const raw = check();
  const snapshot = JSON.stringify(raw);
  normalizePremisesCheckRecord(raw);
  upsertPremisesCheckRecord([raw], check({ id: 'CHK-2' }));
  assert.equal(JSON.stringify(raw), snapshot);
});

test('html escaping: markup in note and customer never renders', () => {
  const html = premisesCustomerChecksHtml(
    [check({ customer: '<b>Ahmed</b>', note: '<script>alert(1)</script>' })], '<b>Ahmed</b>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;b&gt;Ahmed&lt;/b&gt;'));
});

test('csv and filename', () => {
  const csv = premisesCheckCsv([check({ note: 'says "hi", ok' })]);
  assert.ok(csv.startsWith('id,customer,date,onu,router,adapter,note'));
  assert.ok(csv.includes('"says ""hi"", ok"'));
  assert.equal(premisesCheckFilename(), 'premises-checks.csv');
});

test('module is pure and import-free', () => {
  const src = readFileSync(join(dir, '..', 'premises-check.js'), 'utf8');
  assert.ok(!src.includes('import '));
  assert.ok(!src.includes('require('));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('fetch('));
});

test('panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['premisesSummary', 'premisesExportBtn', 'premisesCustomer',
    'premisesDate', 'premisesOnu', 'premisesRouter', 'premisesAdapter',
    'premisesNote', 'premisesSaveBtn', 'premisesFilter', 'premisesBody',
    'premisesRemoveId', 'premisesRemoveBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
