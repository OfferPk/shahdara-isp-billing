import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validSupplierPerformanceDate,
  supplierPerformanceDayCount,
  normalizeSupplierPerformanceNote,
  normalizeSupplierPerformanceList,
  findSupplierPerformanceNote,
  recordSupplierPerformanceNote,
  removeSupplierPerformanceNote,
  supplierPerformanceSorted,
  supplierPerformanceOnTime,
  supplierPerformanceDaysLate,
  supplierPerformancesForSupplier,
  supplierPerformanceSuppliers,
  supplierPerformanceSummaryText,
  supplierPerformanceText,
  supplierPerformanceHtml,
  supplierPerformanceAllHtml,
  supplierPerformancesForSupplierHtml,
  supplierPerformanceCsv,
  supplierPerformanceFilename,
} from '../supplier-performance.js';

const first = {
  id: 'SP-1',
  supplier: 'Fibre House',
  item: 'Drop cable drums',
  promisedDate: '2026-11-01',
  deliveredDate: '2026-11-01',
  quality: 'Good, no damage',
  recordedBy: 'Saad',
};
const second = {
  id: 'SP-2',
  supplier: 'Fibre House',
  item: 'ONU units',
  promisedDate: '2026-11-03',
  deliveredDate: '2026-11-05',
  quality: 'Two units faulty',
  recordedBy: 'Aqib',
};
const third = {
  id: 'SP-3',
  supplier: 'Cable Traders',
  item: 'Connectors',
  promisedDate: '2026-11-02',
  deliveredDate: '2026-10-31',
  quality: '',
  recordedBy: 'Saad',
};
const fixture = [first, second, third];

test('half-formed notes are refused', () => {
  assert.equal(normalizeSupplierPerformanceNote(null), null);
  assert.equal(normalizeSupplierPerformanceNote('nope'), null);
  assert.equal(normalizeSupplierPerformanceNote({ ...first, id: '  ' }), null);
  assert.equal(normalizeSupplierPerformanceNote({ ...first, supplier: '' }), null);
  assert.equal(normalizeSupplierPerformanceNote({ ...first, item: '' }), null);
  assert.equal(normalizeSupplierPerformanceNote({ ...first, promisedDate: '' }), null);
  assert.equal(normalizeSupplierPerformanceNote({ ...first, promisedDate: '2026-02-30' }), null);
  assert.equal(normalizeSupplierPerformanceNote({ ...first, promisedDate: '01-11-2026' }), null);
  assert.equal(normalizeSupplierPerformanceNote({ ...first, deliveredDate: '' }), null);
  assert.equal(normalizeSupplierPerformanceNote({ ...first, deliveredDate: '2026-04-31' }), null);
  assert.equal(normalizeSupplierPerformanceNote({ ...first, recordedBy: '' }), null);
  const entry = normalizeSupplierPerformanceNote(first);
  assert.deepEqual(entry, {
    id: 'SP-1',
    supplier: 'Fibre House',
    item: 'Drop cable drums',
    promisedDate: '2026-11-01',
    deliveredDate: '2026-11-01',
    quality: 'Good, no damage',
    recordedBy: 'Saad',
  });
  // Quality is optional plain words: a note without one still records.
  assert.equal(normalizeSupplierPerformanceNote({ ...third, quality: undefined }).quality, '');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validSupplierPerformanceDate('2026-08-31'), true);
  assert.equal(validSupplierPerformanceDate('2026-10-31'), true);
  assert.equal(validSupplierPerformanceDate('2026-12-31'), true);
  assert.equal(validSupplierPerformanceDate('2026-02-29'), false);
  assert.equal(validSupplierPerformanceDate('2028-02-29'), true);
  assert.equal(validSupplierPerformanceDate('2024-02-29'), true);
  assert.equal(validSupplierPerformanceDate('2026-04-31'), false);
  assert.equal(validSupplierPerformanceDate('2026-13-01'), false);
  assert.equal(validSupplierPerformanceDate('02-11-2026'), false);
  assert.equal(validSupplierPerformanceDate(''), false);
  assert.equal(validSupplierPerformanceDate(null), false);
  assert.equal(validSupplierPerformanceDate(20261101), false);
});

test('on time means delivered on or before the promised date', () => {
  assert.equal(supplierPerformanceOnTime(first), true);
  assert.equal(supplierPerformanceOnTime(second), false);
  assert.equal(supplierPerformanceOnTime(third), true);
  assert.equal(supplierPerformanceOnTime(null), false);
  assert.equal(supplierPerformanceOnTime({ ...first, deliveredDate: '' }), false);
});

test('days late counts whole calendar days, zero when on time', () => {
  assert.equal(supplierPerformanceDaysLate(first), 0);
  assert.equal(supplierPerformanceDaysLate(second), 2);
  assert.equal(supplierPerformanceDaysLate(third), 0);
  assert.equal(supplierPerformanceDaysLate(null), 0);
  assert.equal(supplierPerformanceDaysLate({ ...second, deliveredDate: '2026-11-30' }), 27);
  assert.equal(supplierPerformanceDaysLate({ ...second, promisedDate: '2026-10-31', deliveredDate: '2026-11-01' }), 1);
  assert.equal(supplierPerformanceDaysLate({ ...second, promisedDate: '2028-02-28', deliveredDate: '2028-03-01' }), 2);
  assert.equal(supplierPerformanceDayCount('2026-11-01'), supplierPerformanceDayCount('2026-11-01'));
  assert.equal(supplierPerformanceDayCount('2026-11-02') - supplierPerformanceDayCount('2026-11-01'), 1);
  assert.equal(supplierPerformanceDayCount('bad'), null);
});

test('unknown fields drop and inputs are never mutated', () => {
  const raw = { ...first, bill: 1500, payment: 'cash', stock: 5, vendor: 'Fibre House' };
  const entry = normalizeSupplierPerformanceNote(raw);
  assert.equal('bill' in entry, false);
  assert.equal('payment' in entry, false);
  assert.equal('stock' in entry, false);
  assert.equal('vendor' in entry, false);
  assert.equal(raw.bill, 1500);
  assert.deepEqual(Object.keys(raw).sort(), ['bill', 'deliveredDate', 'id', 'item', 'payment', 'promisedDate', 'quality', 'recordedBy', 'stock', 'supplier', 'vendor']);
});

test('a duplicate id is never rewritten', () => {
  const next = recordSupplierPerformanceNote(fixture, { ...first, promisedDate: '2026-11-09', recordedBy: 'Someone else' });
  assert.equal(next.length, 3);
  assert.equal(next[0].promisedDate, '2026-11-01');
  assert.equal(next[0].recordedBy, 'Saad');
  assert.equal(recordSupplierPerformanceNote(fixture, { ...first, id: '' }).length, 3);
  assert.equal(recordSupplierPerformanceNote(fixture, { ...second, id: 'SP-4' }).length, 4);
});

test('find and remove work by id only', () => {
  assert.equal(findSupplierPerformanceNote(fixture, 'SP-1').recordedBy, 'Saad');
  assert.equal(findSupplierPerformanceNote(fixture, 'SP-9'), null);
  assert.equal(findSupplierPerformanceNote(fixture, ''), null);
  assert.deepEqual(removeSupplierPerformanceNote(fixture, 'SP-1').map((entry) => entry.id), ['SP-2', 'SP-3']);
  assert.equal(removeSupplierPerformanceNote(fixture, 'SP-9').length, 3);
  assert.equal(removeSupplierPerformanceNote(fixture, '').length, 3);
});

test('notes sort by promised date then supplier then id', () => {
  const rows = supplierPerformanceSorted([second, third, first, { ...second, id: 'SP-0', promisedDate: '2026-11-01' }]);
  assert.deepEqual(rows.map((entry) => entry.id), ['SP-0', 'SP-1', 'SP-3', 'SP-2']);
  assert.deepEqual(normalizeSupplierPerformanceList('nope'), []);
});

test('notes list per supplier, case-insensitive, with the first spelling kept', () => {
  assert.deepEqual(supplierPerformancesForSupplier(fixture, 'fibre house').map((entry) => entry.id), ['SP-1', 'SP-2']);
  assert.deepEqual(supplierPerformancesForSupplier(fixture, 'FIBRE HOUSE').map((entry) => entry.id), ['SP-1', 'SP-2']);
  assert.deepEqual(supplierPerformancesForSupplier(fixture, 'Nobody').map((entry) => entry.id), []);
  assert.deepEqual(supplierPerformancesForSupplier(fixture, ''), []);
  assert.deepEqual(supplierPerformanceSuppliers(fixture), ['Fibre House', 'Cable Traders']);
  assert.deepEqual(
    supplierPerformanceSuppliers([{ ...first, supplier: 'fibre house' }, first]),
    ['fibre house'],
  );
});

test('summary counts on-time and late notes', () => {
  assert.equal(supplierPerformanceSummaryText(fixture), '3 supplier performance notes recorded. 2 on time, 1 late.');
  assert.equal(supplierPerformanceSummaryText([first]), '1 supplier performance note recorded. 1 on time, 0 late.');
  assert.equal(supplierPerformanceSummaryText([]), 'No supplier performance notes recorded.');
});

test('text names supplier, item, dates, timing, quality, and recorder', () => {
  assert.equal(supplierPerformanceText(first),
    'Fibre House — Drop cable drums — promised 2026-11-01, delivered 2026-11-01 — on time — quality: Good, no damage — recorded by Saad');
  assert.equal(supplierPerformanceText(second),
    'Fibre House — ONU units — promised 2026-11-03, delivered 2026-11-05 — 2 days late — quality: Two units faulty — recorded by Aqib');
  assert.equal(supplierPerformanceText(third),
    'Cable Traders — Connectors — promised 2026-11-02, delivered 2026-10-31 — on time — quality: not noted — recorded by Saad');
  assert.equal(supplierPerformanceText(null), 'No supplier performance note recorded.');
  assert.equal(supplierPerformanceText({ ...first, deliveredDate: '' }), 'No supplier performance note recorded.');
});

test('html escapes input', () => {
  const evil = { id: 'SP-9', supplier: '<script>alert(1)</script>', item: '<b>bold</b>', promisedDate: '2026-11-05', deliveredDate: '2026-11-05', quality: '<i>bad</i>', recordedBy: 'Saad' };
  const html = supplierPerformanceHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('&lt;b&gt;bold&lt;/b&gt;'), true);
  assert.equal(html.includes('&lt;i&gt;bad&lt;/i&gt;'), true);
  assert.equal(html.includes('on time'), true);
  assert.equal(supplierPerformanceHtml(null), '<p>No supplier performance note recorded.</p>');
  const all = supplierPerformanceAllHtml([evil, first]);
  assert.equal(all.includes('&lt;script&gt;'), true);
  assert.equal(supplierPerformanceAllHtml([]), '<p>No supplier performance notes recorded.</p>');
  assert.equal(supplierPerformancesForSupplierHtml(fixture, 'Fibre House').includes('Drop cable drums'), true);
  assert.equal(supplierPerformancesForSupplierHtml(fixture, 'Nobody'), '<p>No performance notes for this supplier.</p>');
});

test('csv export and filename', () => {
  const csv = supplierPerformanceCsv(fixture);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","supplier","item","promised date","delivered date","on time","days late","quality","recorded by"');
  assert.equal(lines.length, 4);
  assert.equal(lines[1].includes('"SP-1"'), true);
  assert.equal(lines[1].includes('"Fibre House"'), true);
  assert.equal(lines[1].includes('"2026-11-01"'), true);
  assert.equal(lines[1].includes('"yes"'), true);
  assert.equal(lines[1].includes('"0"'), true);
  assert.equal(lines[3].includes('"SP-2"'), true);
  assert.equal(lines[3].includes('"no"'), true);
  assert.equal(lines[3].includes('"2"'), true);
  assert.equal(lines[3].includes('"Two units faulty"'), true);
  assert.equal(supplierPerformanceCsv([]), '"id","supplier","item","promised date","delivered date","on time","days late","quality","recorded by"');
  assert.equal(supplierPerformanceFilename(), 'supplier-performance.csv');
});

test('list normalisation drops bad notes and keeps the first duplicate', () => {
  const bad = { ...first, id: '' };
  const out = normalizeSupplierPerformanceList([bad, first, { ...first, promisedDate: '2026-11-09' }, second, 'nope', null]);
  assert.deepEqual(out.map((entry) => entry.id), ['SP-1', 'SP-2']);
  assert.equal(out[0].promisedDate, '2026-11-01');
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../supplier-performance.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the vendor register and the warranty return log are untouched', () => {
  const source = readFileSync(new URL('../supplier-performance.js', import.meta.url), 'utf8');
  assert.equal(source.includes('vendor-contracts.js'), false, 'module must not reference the vendor register module');
  assert.equal(source.includes('vendor-bills.js'), false, 'module must not reference the vendor bills module');
  assert.equal(source.includes('warranty-returns.js'), false, 'module must not reference the warranty return log module');
  assert.equal(existsSync(new URL('../vendor-contracts.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../vendor-bills.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../warranty-returns.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'spfHeading', 'spfSummary', 'spfExportBtn', 'spfSupplier', 'spfItem',
    'spfPromisedDate', 'spfDeliveredDate', 'spfQuality', 'spfRecordedBy',
    'spfRecordBtn', 'spfRemoveId', 'spfRemoveBtn', 'spfFilter', 'spfFilterBtn',
    'spfSupplierBody', 'spfBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the supplier performance panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './supplier-performance.js'"), true);
  assert.equal(source.includes('renderSupplierPerformance()'), true);
  assert.equal(source.includes('loadSupplierPerformanceNotes()'), true);
  assert.equal(source.includes('shahdara_supplier_performance_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
