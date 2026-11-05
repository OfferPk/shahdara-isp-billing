// Plan 253 — Material return-to-shop log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validMaterialReturnDate,
  normalizeMaterialReturnList,
  recordMaterialReturn,
  removeMaterialReturn,
  findMaterialReturn,
  addMaterialReturnFollowup,
  materialReturnSorted,
  materialReturnsForJob,
  materialReturnsForItem,
  materialReturnItems,
  materialReturnJobs,
  materialReturnTotalForItem,
  materialReturnSummaryText,
  materialReturnReconciliation,
  materialReturnReconciliationText,
  materialReturnText,
  materialReturnHtml,
  materialReturnCsv,
  materialReturnFilename,
} from '../material-return.js';

const first = {
  id: 'MR-1',
  jobRef: 'JOB-101',
  item: 'Drop cable',
  quantityReturned: 30,
  condition: 'Unused, good',
  dateReturned: '2026-11-01',
  receivedBy: 'Saad',
};

const second = {
  id: 'MR-2',
  jobRef: 'JOB-101',
  item: 'drop Cable',
  quantityReturned: 10,
  condition: 'Unused, good',
  dateReturned: '2026-11-02',
  receivedBy: 'Saad',
};

const third = {
  id: 'MR-3',
  jobRef: 'JOB-102',
  item: 'Splitter 1x8',
  quantityReturned: 2,
  condition: 'Box opened, unused',
  dateReturned: '2026-11-03',
  receivedBy: 'Owner',
};

test('half-formed return is refused', () => {
  const base = { ...first };
  for (const field of ['id', 'jobRef', 'item', 'condition', 'dateReturned', 'receivedBy']) {
    assert.deepEqual(recordMaterialReturn([], { ...base, [field]: '  ' }), []);
  }
  assert.deepEqual(recordMaterialReturn([], { ...base, quantityReturned: 0 }), []);
  assert.deepEqual(recordMaterialReturn([], { ...base, quantityReturned: -5 }), []);
  assert.deepEqual(recordMaterialReturn([], { ...base, quantityReturned: 'many' }), []);
  assert.deepEqual(recordMaterialReturn([], { ...base, dateReturned: '2026-02-30' }), []);
});

test('strict dates: leap day only in leap years', () => {
  assert.equal(validMaterialReturnDate('2024-02-29'), true);
  assert.equal(validMaterialReturnDate('2026-02-29'), false);
  assert.equal(validMaterialReturnDate('2026-04-31'), false);
  assert.equal(validMaterialReturnDate('2026-12-31'), true);
  assert.equal(validMaterialReturnDate('2026-13-01'), false);
  assert.equal(validMaterialReturnDate('01-11-2026'), false);
  assert.equal(validMaterialReturnDate(''), false);
  assert.equal(validMaterialReturnDate(null), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, stockTotal: 99, billRef: 'B-1', surprise: 'x' };
  const snapshot = JSON.parse(JSON.stringify(raw));
  const list = recordMaterialReturn([], raw);
  assert.equal(list.length, 1);
  assert.equal('stockTotal' in list[0], false);
  assert.equal('billRef' in list[0], false);
  assert.equal('surprise' in list[0], false);
  assert.deepEqual(raw, snapshot);
  const listInput = [first, second];
  const listSnapshot = JSON.parse(JSON.stringify(listInput));
  normalizeMaterialReturnList(listInput);
  assert.deepEqual(listInput, listSnapshot);
});

test('duplicate ids are never rewritten', () => {
  const list = recordMaterialReturn([first], { ...first, quantityReturned: 99 });
  assert.equal(list.length, 1);
  assert.equal(list[0].quantityReturned, 30);
});

test('find and remove', () => {
  const list = [first, second, third];
  assert.equal(findMaterialReturn(list, 'MR-2').item, 'drop Cable');
  assert.equal(findMaterialReturn(list, 'MR-9'), null);
  assert.equal(findMaterialReturn(list, ''), null);
  assert.deepEqual(removeMaterialReturn(list, 'MR-2').map((item) => item.id), ['MR-1', 'MR-3']);
  assert.deepEqual(removeMaterialReturn(list, 'MR-9').map((item) => item.id), ['MR-1', 'MR-2', 'MR-3']);
});

test('returns sort by date, then job, then id', () => {
  const sorted = materialReturnSorted([third, first, second]);
  assert.deepEqual(sorted.map((item) => item.id), ['MR-1', 'MR-2', 'MR-3']);
  const sameDate = [
    { ...third, id: 'MR-9', jobRef: 'JOB-100', dateReturned: '2026-11-01' },
    first,
  ];
  assert.deepEqual(materialReturnSorted(sameDate).map((item) => item.id), ['MR-9', 'MR-1']);
});

test('returns list by job, case-insensitive', () => {
  const rows = materialReturnsForJob([first, second, third], 'job-101');
  assert.deepEqual(rows.map((item) => item.id), ['MR-1', 'MR-2']);
  assert.deepEqual(materialReturnsForJob([first, second, third], ''), []);
  assert.deepEqual(materialReturnsForJob([first, second, third], 'JOB-999'), []);
});

test('returns list by item, substring and case-insensitive', () => {
  const rows = materialReturnsForItem([first, second, third], 'cable');
  assert.deepEqual(rows.map((item) => item.id), ['MR-1', 'MR-2']);
  assert.deepEqual(materialReturnsForItem([first, second, third], 'SPLITTER').map((item) => item.id), ['MR-3']);
  assert.deepEqual(materialReturnsForItem([first, second, third], ''), []);
});

test('item and job lists keep the first spelling', () => {
  assert.deepEqual(materialReturnItems([first, second, third]), ['Drop cable', 'Splitter 1x8']);
  assert.deepEqual(materialReturnJobs([third, second, first]), ['JOB-101', 'JOB-102']);
});

test('total returned per item sums its entries', () => {
  assert.equal(materialReturnTotalForItem([first, second, third], 'drop cable'), 40);
  assert.equal(materialReturnTotalForItem([first, second, third], 'Splitter 1x8'), 2);
  assert.equal(materialReturnTotalForItem([first, second, third], 'ONU'), 0);
});

test('reconciliation: returned shown separately from issued', () => {
  const check = materialReturnReconciliation(100, [first, second]);
  assert.deepEqual(check, { issued: 100, totalReturned: 40, remainingOut: 60, reconciles: true });
  const over = materialReturnReconciliation(30, [first, second]);
  assert.equal(over.reconciles, false);
  assert.equal(over.remainingOut, -10);
  assert.equal(materialReturnReconciliation(0, [first]), null);
  assert.equal(materialReturnReconciliation('many', [first]), null);
  assert.equal(materialReturnReconciliation(100, []), null);
  assert.equal(materialReturnReconciliation(100, [{ ...first, quantityReturned: 'bad' }]), null);
});

test('reconciliation text states both figures', () => {
  assert.match(materialReturnReconciliationText(100, [first, second]), /40 returned of 100 issued, 60 still out/);
  assert.match(materialReturnReconciliationText(30, [first, second]), /Does not reconcile/);
  assert.match(materialReturnReconciliationText(100, []), /No reconciliation/);
});

test('follow-up only: an entry is never edited', () => {
  const before = recordMaterialReturn([], first);
  const next = addMaterialReturnFollowup(before, 'MR-1', '2026-11-05', 'Checked on shelf, counted.');
  assert.equal(next.length, 1);
  assert.equal(next[0].quantityReturned, 30);
  assert.equal(next[0].condition, 'Unused, good');
  assert.equal(next[0].dateReturned, '2026-11-01');
  assert.equal(next[0].receivedBy, 'Saad');
  assert.deepEqual(next[0].followups, [{ date: '2026-11-05', note: 'Checked on shelf, counted.' }]);
  assert.deepEqual(addMaterialReturnFollowup(before, 'MR-1', '2026-02-30', 'Bad date.'), before);
  assert.deepEqual(addMaterialReturnFollowup(before, 'MR-1', '2026-11-05', '  '), before);
  assert.deepEqual(addMaterialReturnFollowup(before, 'MR-9', '2026-11-05', 'Unknown id.'), before);
});

test('summary text', () => {
  assert.equal(materialReturnSummaryText([]), 'No material returns recorded.');
  assert.equal(materialReturnSummaryText([first]), '1 return entry across 1 item, 30 returned in total.');
  assert.equal(materialReturnSummaryText([first, second, third]), '3 return entries across 2 items, 42 returned in total.');
});

test('entry text names job, item, quantity, condition and receiver', () => {
  assert.equal(
    materialReturnText(first),
    'Job JOB-101 returned 30 Drop cable on 2026-11-01 (Unused, good), received by Saad.',
  );
  assert.equal(materialReturnText({ ...first, id: '' }), 'No material return recorded.');
  const noted = addMaterialReturnFollowup([first], 'MR-1', '2026-11-05', 'Counted.');
  assert.match(materialReturnText(noted[0]), /Follow-ups: 2026-11-05: Counted\./);
});

test('HTML is escaped', () => {
  const evil = { ...first, item: '<b>Drop cable</b>', receivedBy: 'Saad & Co' };
  const html = materialReturnHtml(evil);
  assert.equal(html.includes('<b>'), false);
  assert.match(html, /&lt;b&gt;Drop cable&lt;\/b&gt;/);
  assert.match(html, /Saad &amp; Co/);
  assert.equal(materialReturnHtml({ ...first, id: '' }), '<p>No material return recorded.</p>');
});

test('CSV export and filename', () => {
  const csv = materialReturnCsv([third, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","job reference","item","quantity returned","condition","date returned","received by","follow-ups"');
  assert.match(lines[1], /"MR-1","JOB-101","Drop cable","30"/);
  assert.match(lines[2], /"MR-3","JOB-102","Splitter 1x8","2"/);
  assert.equal(materialReturnFilename(), 'material-returns.csv');
});

test('list normalisation drops bad rows and keeps the first id', () => {
  const list = normalizeMaterialReturnList([
    first,
    { ...first, quantityReturned: 99 },
    { ...first, id: 'MR-X', dateReturned: '2026-02-30' },
    null,
    'not an entry',
    second,
  ]);
  assert.deepEqual(list.map((item) => item.id), ['MR-1', 'MR-2']);
  assert.deepEqual(normalizeMaterialReturnList('not a list'), []);
  assert.deepEqual(normalizeMaterialReturnList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../material-return.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: stock, parts, reorder, drum usage and supplier returns are untouched', () => {
  const source = readFileSync(new URL('../material-return.js', import.meta.url), 'utf8');
  for (const name of ['stock-register', 'fault-parts', 'spare-reorder', 'drum-usage', 'warranty-returns']) {
    assert.equal(source.includes(name), false, `module must not reference ${name}`);
  }
  assert.equal(existsSync(new URL('../stock-register.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../fault-parts.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../spare-reorder.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../drum-usage.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../warranty-returns.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'mrHeading', 'mrSummary', 'mrList', 'mrExportBtn',
    'mrJobRef', 'mrItem', 'mrQuantity', 'mrCondition', 'mrDate', 'mrReceivedBy', 'mrRecordBtn',
    'mrAnnotateId', 'mrAnnotateDate', 'mrAnnotateNote', 'mrAnnotateBtn',
    'mrRemoveId', 'mrRemoveBtn',
    'mrFilterJob', 'mrJobBtn', 'mrJobBody',
    'mrFilterItem', 'mrItemBtn', 'mrItemBody',
    'mrIssuedQty', 'mrReconcileBtn', 'mrReconcileBody',
  ];
  for (const id of ids) {
    assert.equal(html.includes(`id="${id}"`), true, `index.html must contain id="${id}"`);
  }
});

test('app.js wires the material return panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './material-return.js'"), true);
  assert.equal(source.includes('renderMaterialReturns()'), true);
  assert.equal(source.includes('MATERIAL_RETURN_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
