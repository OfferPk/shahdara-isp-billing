import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validFormatDate,
  normalizeFormatVersionList,
  normalizeBillFormatStampList,
  formatVersionsSorted,
  billFormatStampsSorted,
  findFormatVersion,
  recordFormatVersion,
  removeFormatVersion,
  stampBillFormat,
  removeBillFormatStamp,
  flaggedBillFormatStamps,
  billFormatStampText,
  formatVersionEntryText,
  buildFormatVersionSummary,
  formatVersionSummaryText,
  formatVersionEntryHtml,
  billFormatStampHtml,
  formatVersionCsv,
  formatVersionFilename,
} from '../bill-format-version.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'bill-format-version.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const v1 = { id: 'FV-1', version: '1', dateEffective: '2026-01-01', description: 'First printed layout.' };
const v2 = { id: 'FV-2', version: '2', dateEffective: '2026-10-01', description: 'Larger total box.' };
const stamp1 = { id: 'BS-1', billRef: 'B-101', version: '1', dateStamped: '2026-02-05' };
const stamp2 = { id: 'BS-2', billRef: 'B-205', version: '2', dateStamped: '2026-10-12' };

test('half-formed version refusal', () => {
  assert.equal(recordFormatVersion([], { version: '3', dateEffective: '2026-11-01', description: 'No id.' }), null);
  assert.equal(recordFormatVersion([], { id: 'FV-9', dateEffective: '2026-11-01', description: 'No version.' }), null);
  assert.equal(recordFormatVersion([], { id: 'FV-9', version: '3', description: 'No date.' }), null);
  assert.equal(recordFormatVersion([], { id: 'FV-9', version: '3', dateEffective: '2026-11-01' }), null);
});

test('strict dates', () => {
  assert.equal(validFormatDate('2026-02-30'), false);
  assert.equal(validFormatDate('2024-02-29'), true);
  assert.equal(validFormatDate('2026-02-29'), false);
  assert.equal(validFormatDate('2026-13-01'), false);
  assert.equal(validFormatDate('2026-1-1'), false);
  assert.equal(recordFormatVersion([], { id: 'FV-9', version: '3', dateEffective: '2026-02-30', description: 'Bad date.' }), null);
});

test('unknown-field drop and non-mutation', () => {
  const raw = { ...v1, amount: 500, customer: 'Someone' };
  const recorded = recordFormatVersion([], raw);
  assert.deepEqual(Object.keys(recorded[0]).sort(), ['dateEffective', 'description', 'id', 'version']);
  assert.equal(raw.amount, 500);
  const frozen = Object.freeze([Object.freeze({ ...v1 })]);
  assert.equal(recordFormatVersion(frozen, v2).length, 2);
});

test('duplicate id and duplicate version rules', () => {
  assert.equal(recordFormatVersion([v1], { ...v1, description: 'Rewritten.' }), null);
  assert.equal(recordFormatVersion([v1], { id: 'FV-9', version: '1', dateEffective: '2026-03-01', description: 'Same version twice.' }), null);
  assert.equal(recordFormatVersion([v1], v2).length, 2);
});

test('find and remove', () => {
  assert.equal(findFormatVersion([v1, v2], '2').id, 'FV-2');
  assert.equal(findFormatVersion([v1, v2], '9'), null);
  assert.deepEqual(removeFormatVersion([v1, v2], 'FV-1'), [v2]);
  assert.deepEqual(removeFormatVersion([v1, v2], 'FV-9'), [v1, v2]);
});

test('version list sorted by effective date', () => {
  assert.deepEqual(formatVersionsSorted([v2, v1]).map((item) => item.version), ['1', '2']);
});

test('bill stamp refusal and duplicate bill rule', () => {
  assert.equal(stampBillFormat([], { billRef: 'B-1', version: '1', dateStamped: '2026-02-05' }), null);
  assert.equal(stampBillFormat([], { id: 'BS-9', version: '1', dateStamped: '2026-02-05' }), null);
  assert.equal(stampBillFormat([], { id: 'BS-9', billRef: 'B-1', dateStamped: '2026-02-30' }), null);
  assert.equal(stampBillFormat([stamp1], { id: 'BS-9', billRef: 'B-101', version: '2', dateStamped: '2026-10-12' }), null);
  assert.equal(stampBillFormat([stamp1], stamp2).length, 2);
  assert.deepEqual(removeBillFormatStamp([stamp1, stamp2], 'BS-1'), [stamp2]);
});

test('bill stamps sorted by stamped date', () => {
  assert.deepEqual(billFormatStampsSorted([stamp2, stamp1]).map((item) => item.billRef), ['B-101', 'B-205']);
});

test('flagged bills: version with no record', () => {
  const unknown = { id: 'BS-9', billRef: 'B-300', version: '9', dateStamped: '2026-11-02' };
  assert.deepEqual(flaggedBillFormatStamps([stamp1, stamp2, unknown], [v1, v2]), [unknown]);
  assert.deepEqual(flaggedBillFormatStamps([stamp1, stamp2], [v1, v2]), []);
});

test('stamp text: known and flagged', () => {
  assert.equal(billFormatStampText(stamp2, [v1, v2]), 'Bill B-205 uses format version 2 (effective 2026-10-01).');
  assert.equal(billFormatStampText({ id: 'BS-9', billRef: 'B-300', version: '9', dateStamped: '2026-11-02' }, [v1, v2]), 'Bill B-300 uses format version 9, which has no format record — flagged.');
  assert.equal(formatVersionEntryText(v2), 'Format version 2 (effective 2026-10-01): Larger total box.');
});

test('summary counts', () => {
  const unknown = { id: 'BS-9', billRef: 'B-300', version: '9', dateStamped: '2026-11-02' };
  assert.deepEqual(buildFormatVersionSummary([v1, v2], [stamp1, stamp2, unknown]), { versions: 2, billsStamped: 3, flaggedBills: 1 });
  assert.equal(formatVersionSummaryText([v1, v2], [stamp1, stamp2, unknown]), '2 format versions, 3 bills stamped, 1 bills flagged (version has no record).');
});

test('HTML escaping', () => {
  const nasty = { id: 'FV-9', version: '3', dateEffective: '2026-11-01', description: '<script>alert(1)</script>' };
  assert.equal(formatVersionEntryHtml(nasty).includes('<script>'), false);
  const nastyStamp = { id: 'BS-9', billRef: 'B-<1>', version: '3', dateStamped: '2026-11-02' };
  assert.equal(billFormatStampHtml(nastyStamp, [v1, v2]).includes('B-<1>'), false);
});

test('CSV and filename', () => {
  const csv = formatVersionCsv([v2, v1], [stamp2, stamp1]);
  assert.ok(csv.startsWith('type,id,reference,version,date,description'));
  assert.ok(csv.includes('B-101'));
  assert.ok(csv.includes('uses format version'));
  assert.equal(formatVersionFilename(), 'bill-format-versions.csv');
});

test('list normalisation drops duplicates', () => {
  assert.deepEqual(normalizeFormatVersionList([v1, v1, v2]), [v1, v2]);
  assert.deepEqual(normalizeBillFormatStampList([stamp1, stamp1, stamp2]), [stamp1, stamp2]);
  assert.deepEqual(normalizeFormatVersionList('not a list'), []);
});

test('purity fence: no clock, storage, or network', () => {
  assert.equal(/new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/.test(moduleSrc), false);
});

test('neighbour-module fence: no neighbour module read', () => {
  assert.equal(/from '\.\/(bill-reissue|version-log|bill-delivery)\.js'/.test(moduleSrc), false);
  assert.equal(/loadBillReissue|loadVersionLog|loadBillDelivery/.test(moduleSrc), false);
});

test('panel ids present in index.html', () => {
  for (const id of ['bfvVersion', 'bfvDateEffective', 'bfvDescription', 'bfvSaveBtn', 'bfvRemoveId', 'bfvRemoveBtn', 'bfvBillRef', 'bfvBillVersion', 'bfvDateStamped', 'bfvStampBtn', 'bfvRemoveStampId', 'bfvRemoveStampBtn', 'bfvBody', 'bfvStampBody', 'bfvSummary', 'bfvExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring', () => {
  assert.ok(appJs.includes("from './bill-format-version.js'"));
  assert.ok(appJs.includes('renderBillFormatVersion()'));
  assert.ok(appJs.includes('BFV_VERSIONS_KEY'));
});

test('deployment guard: no standalone OLT word in app.js', () => {
  assert.equal(/(^|[^A-Za-z])OLT([^A-Za-z]|$)/.test(appJs), false);
});
