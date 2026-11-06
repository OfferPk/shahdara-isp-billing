import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as customerRecordMergeModule from '../customer-record-merge-note.js';
import {
  validCustomerRecordMergeDay,
  normalizeCustomerRecordMergeDues,
  normalizeCustomerRecordMerge,
  normalizeCustomerRecordMergeList,
  recordCustomerRecordMerge,
  customerRecordMergeForSurvivor,
  customerRecordMergedAway,
  customerRecordMergeMergedHistory,
  customerRecordMergeDuesReconciles,
  customerRecordMergeCountsAll,
  customerRecordMergeSummaryText,
  customerRecordMergeText,
  customerRecordMergesHtml,
  customerRecordMergedAwayHtml,
  customerRecordMergeCsv,
  customerRecordMergeFilename,
} from '../customer-record-merge-note.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'customer-record-merge-note.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function baseMerge(overrides = {}) {
  return {
    id: 'CRM-1',
    survivingRecord: 'CUST-1',
    mergedAwayRecord: 'CUST-2',
    recordsMerged: ['CUST-1', 'CUST-2'],
    fieldsCarriedOver: ['Phone', 'Mohalla'],
    operator: 'Saad',
    approver: 'Owner',
    mergeDate: '2026-11-06',
    mergedDues: 3000,
    ...overrides,
  };
}

function baseRecords() {
  return [
    { reference: 'CUST-1', dues: 2000, history: [{ date: '2026-10-05', text: 'Paid Rs 2000' }] },
    { reference: 'CUST-2', dues: 1000, history: [{ date: '2026-10-03', text: 'Bill Rs 1000' }] },
  ];
}

test('strict merge date: real calendar dates only, leap years handled', () => {
  assert.equal(validCustomerRecordMergeDay('2026-11-06'), true);
  assert.equal(validCustomerRecordMergeDay('2028-02-29'), true);
  assert.equal(validCustomerRecordMergeDay('2027-02-29'), false);
  assert.equal(validCustomerRecordMergeDay('2026-11-31'), false);
  assert.equal(validCustomerRecordMergeDay('2026-13-01'), false);
  assert.equal(validCustomerRecordMergeDay('2026-11-6'), false);
  assert.equal(validCustomerRecordMergeDay('06-11-2026'), false);
  assert.equal(validCustomerRecordMergeDay(20261106), false);
  assert.equal(validCustomerRecordMergeDay(''), false);
});

test('merged dues: whole rupees only, digit strings accepted', () => {
  assert.equal(normalizeCustomerRecordMergeDues(3000), 3000);
  assert.equal(normalizeCustomerRecordMergeDues('3000'), 3000);
  assert.equal(normalizeCustomerRecordMergeDues(0), 0);
  assert.equal(normalizeCustomerRecordMergeDues(-100), null);
  assert.equal(normalizeCustomerRecordMergeDues(10.5), null);
  assert.equal(normalizeCustomerRecordMergeDues('Rs 3000'), null);
  assert.equal(normalizeCustomerRecordMergeDues(''), null);
  assert.equal(normalizeCustomerRecordMergeDues(null), null);
});

test('record refuses a merge with no approver', () => {
  assert.equal(recordCustomerRecordMerge([], baseMerge({ approver: '' })).length, 0);
  assert.equal(recordCustomerRecordMerge([], baseMerge({ approver: '   ' })).length, 0);
});

test('record refuses a merge with no id', () => {
  assert.equal(recordCustomerRecordMerge([], baseMerge({ id: '' })).length, 0);
});

test('record refuses a merge with no surviving record', () => {
  assert.equal(recordCustomerRecordMerge([], baseMerge({ survivingRecord: '' })).length, 0);
});

test('record refuses a merge with no merged-away record', () => {
  assert.equal(recordCustomerRecordMerge([], baseMerge({ mergedAwayRecord: '' })).length, 0);
});

test('record refuses a merge where both records are the same', () => {
  assert.equal(recordCustomerRecordMerge([], baseMerge({ mergedAwayRecord: 'cust-1' })).length, 0);
});

test('record refuses a merge with no operator', () => {
  assert.equal(recordCustomerRecordMerge([], baseMerge({ operator: '' })).length, 0);
});

test('record refuses a merge with a bad merge date', () => {
  assert.equal(recordCustomerRecordMerge([], baseMerge({ mergeDate: '2026-02-30' })).length, 0);
});

test('record refuses a merge with bad merged dues', () => {
  assert.equal(recordCustomerRecordMerge([], baseMerge({ mergedDues: -50 })).length, 0);
  assert.equal(recordCustomerRecordMerge([], baseMerge({ mergedDues: 'Rs 3000' })).length, 0);
});

test('record keeps a well-formed merge and drops unknown fields', () => {
  const list = recordCustomerRecordMerge([], baseMerge({ billTotal: 9999, paymentId: 'P-1' }));
  assert.equal(list.length, 1);
  assert.equal(list[0].billTotal, undefined);
  assert.equal(list[0].paymentId, undefined);
  assert.equal(list[0].mergedDues, 3000);
});

test('record refuses a duplicate id and never rewrites the first merge', () => {
  const first = recordCustomerRecordMerge([], baseMerge());
  const second = recordCustomerRecordMerge(first, baseMerge({ mergedDues: 5000 }));
  assert.equal(second.length, 1);
  assert.equal(second[0].mergedDues, 3000);
});

test('record refuses to merge away a record already merged away', () => {
  const first = recordCustomerRecordMerge([], baseMerge());
  const second = recordCustomerRecordMerge(first, baseMerge({ id: 'CRM-2', survivingRecord: 'CUST-3', mergedAwayRecord: 'cust-2', recordsMerged: ['CUST-3', 'CUST-2'] }));
  assert.equal(second.length, 1);
});

test('records merged defaults to the two records when missing', () => {
  const list = recordCustomerRecordMerge([], baseMerge({ recordsMerged: undefined }));
  assert.deepEqual(list[0].recordsMerged, ['CUST-1', 'CUST-2']);
});

test('fields carried over: comma string accepted, trimmed, deduped, first spelling kept', () => {
  const list = recordCustomerRecordMerge([], baseMerge({ fieldsCarriedOver: 'Phone, mohalla, PHONE, Address' }));
  assert.deepEqual(list[0].fieldsCarriedOver, ['Phone', 'mohalla', 'Address']);
});

test('survivor lookup finds by surviving record, case-insensitive, null when missing', () => {
  const list = recordCustomerRecordMerge([], baseMerge());
  assert.equal(customerRecordMergeForSurvivor(list, 'cust-1').id, 'CRM-1');
  assert.equal(customerRecordMergeForSurvivor(list, 'CUST-9'), null);
  assert.equal(customerRecordMergeForSurvivor(list, ''), null);
});

test('merged-away list shows the merged-away record with its survivor, oldest first', () => {
  const first = recordCustomerRecordMerge([], baseMerge());
  const both = recordCustomerRecordMerge(first, baseMerge({ id: 'CRM-2', survivingRecord: 'CUST-3', mergedAwayRecord: 'CUST-4', recordsMerged: ['CUST-3', 'CUST-4'], mergeDate: '2026-11-05', mergedDues: 1500 }));
  const away = customerRecordMergedAway(both);
  assert.equal(away.length, 2);
  assert.equal(away[0].record, 'CUST-4');
  assert.equal(away[0].survivingRecord, 'CUST-3');
  assert.equal(away[1].record, 'CUST-2');
});

test('merged history combines both records in date order on the surviving record', () => {
  const history = customerRecordMergeMergedHistory(baseMerge(), baseRecords());
  assert.equal(history.survivingRecord, 'CUST-1');
  assert.equal(history.mergedAwayRecord, 'CUST-2');
  assert.equal(history.dues, 3000);
  assert.deepEqual(history.history.map((entry) => entry.text), ['Bill Rs 1000', 'Paid Rs 2000']);
  assert.equal(history.history[0].record, 'CUST-2');
});

test('merged dues reconcile to the sum of both records on the same fixture', () => {
  const ok = customerRecordMergeDuesReconciles(baseMerge(), baseRecords());
  assert.deepEqual(ok, { reconciles: true, expected: 3000, merged: 3000 });
  const bad = customerRecordMergeDuesReconciles(baseMerge({ mergedDues: 2900 }), baseRecords());
  assert.equal(bad.reconciles, false);
  assert.equal(bad.expected, 3000);
  assert.equal(bad.merged, 2900);
});

test('dues reconcile fails plainly when a record is missing from the fixture', () => {
  const result = customerRecordMergeDuesReconciles(baseMerge(), [baseRecords()[0]]);
  assert.equal(result.reconciles, false);
  assert.equal(result.expected, null);
  assert.equal(result.merged, 3000);
});

test('counts reconcile across merges; summary text matches', () => {
  const first = recordCustomerRecordMerge([], baseMerge());
  const both = recordCustomerRecordMerge(first, baseMerge({ id: 'CRM-2', survivingRecord: 'CUST-1', mergedAwayRecord: 'CUST-3', recordsMerged: ['CUST-1', 'CUST-3'], mergedDues: 500 }));
  const counts = customerRecordMergeCountsAll(both);
  assert.deepEqual(counts, { notes: 2, surviving: 1, mergedAway: 2 });
  assert.equal(customerRecordMergeSummaryText(both), '2 merge notes recorded, 1 surviving record, 2 records merged away.');
  assert.equal(customerRecordMergeSummaryText([]), 'No customer record merges recorded.');
});

test('merge text names date, records, approver, and merged dues', () => {
  assert.equal(
    customerRecordMergeText(baseMerge()),
    '2026-11-06 — CUST-2 merged into CUST-1, approved by Owner, merged dues Rs 3000, fields carried over: Phone, Mohalla.',
  );
});

test('HTML escapes markup in operator, approver, and record references', () => {
  const list = recordCustomerRecordMerge([], baseMerge({ approver: '<b>Owner</b>', survivingRecord: 'CUST-<1>', recordsMerged: ['CUST-<1>', 'CUST-2'] }));
  const html = customerRecordMergesHtml(list);
  assert.ok(html.includes('&lt;b&gt;Owner&lt;/b&gt;'));
  assert.ok(html.includes('CUST-&lt;1&gt;'));
  assert.ok(!html.includes('<b>Owner</b>'));
  const awayHtml = customerRecordMergedAwayHtml(list);
  assert.ok(awayHtml.includes('CUST-2'));
  assert.ok(awayHtml.includes('kept as merged, never deleted'));
});

test('CSV has one row per merge with reconciled figures, and the filename is fixed', () => {
  const list = recordCustomerRecordMerge([], baseMerge());
  const csv = customerRecordMergeCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,mergeDate,survivingRecord,mergedAwayRecord,recordsMerged,fieldsCarriedOver,operator,approver,mergedDues');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('CRM-1,2026-11-06,CUST-1,CUST-2'));
  assert.ok(lines[1].includes('3000'));
  assert.equal(customerRecordMergeFilename(), 'customer-record-merge-notes.csv');
});

test('inputs are never mutated, even on deep-frozen fixtures', () => {
  const merge = deepFreeze(baseMerge());
  const records = deepFreeze(baseRecords());
  const list = recordCustomerRecordMerge([], merge);
  assert.equal(list.length, 1);
  const history = customerRecordMergeMergedHistory(merge, records);
  assert.equal(history.dues, 3000);
  const check = customerRecordMergeDuesReconciles(merge, records);
  assert.equal(check.reconciles, true);
  assert.equal(merge.mergedDues, 3000);
  assert.equal(records[0].dues, 2000);
});

test('normalize list drops invalid entries and keeps valid ones', () => {
  const list = normalizeCustomerRecordMergeList([baseMerge(), baseMerge({ id: '' }), baseMerge({ id: 'CRM-2', survivingRecord: 'CUST-5', mergedAwayRecord: 'CUST-6', recordsMerged: ['CUST-5', 'CUST-6'] })]);
  assert.equal(list.length, 2);
  assert.equal(normalizeCustomerRecordMergeList('not a list').length, 0);
});

test('purity: no storage, clock, network, page, or version-changing access', () => {
  assert.ok(!/new Date\(/.test(moduleSrc));
  assert.ok(!/Date\.now\(/.test(moduleSrc));
  assert.ok(!/document\./.test(moduleSrc));
  assert.ok(!/localStorage/.test(moduleSrc));
  assert.ok(!/fetch\(/.test(moduleSrc));
  assert.ok(!/window\./.test(moduleSrc));
  assert.ok(!/import /.test(moduleSrc));
  assert.ok(!/\bOLT\b/.test(moduleSrc));
  const exported = Object.keys(customerRecordMergeModule);
  assert.ok(!exported.some((name) => /install|rollback|apply|change|send/i.test(name)));
});

test('fence: module never names the fenced modules', () => {
  assert.ok(!moduleSrc.includes('combined-dues'));
  assert.ok(!moduleSrc.includes('pattern-watch'));
});

test('wiring: app.js imports the module, renders it, and stores it under the crm key', () => {
  assert.ok(appJs.includes("from './customer-record-merge-note.js'"));
  assert.ok(appJs.includes('renderCustomerRecordMerges()'));
  assert.ok(appJs.includes('shahdara_crm_merges_v1'));
  assert.ok(appJs.includes('customerRecordMergeSummaryText'));
  assert.ok(!/renderCustomerRecordMerges\(\)\s*;\s*renderCustomerRecordMerges\(\)/.test(appJs));
});

test('wiring: index.html carries the crm panel after the Plan 347 panel', () => {
  assert.ok(indexHtml.includes('id="crmHeading"'));
  assert.ok(indexHtml.includes('id="crmBody"'));
  assert.ok(indexHtml.includes('id="crmSummary"'));
  assert.ok(indexHtml.includes('id="crmSaveBtn"'));
  assert.ok(indexHtml.includes('id="crmMergedAwayBody"'));
  assert.ok(indexHtml.indexOf('id="dqrHeading"') < indexHtml.indexOf('id="crmHeading"'));
});
