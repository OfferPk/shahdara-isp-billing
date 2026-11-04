import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validFaultPartDate,
  normalizeFaultPart,
  normalizeFaultPartList,
  findFaultPart,
  upsertFaultPart,
  removeFaultPart,
  partsForTicket,
  sumPartsForPeriod,
  faultPartSummaryText,
  faultPartHtml,
  faultPartCsv,
  faultPartFilename,
} from '../fault-parts.js';

const entry = (over = {}) => ({
  id: 'FP-1',
  ticketId: 'T-101',
  part: 'ONU',
  quantity: 2,
  date: '2026-11-05',
  note: '',
  ...over,
});

test('strict dates: real values pass, impossible values refused', () => {
  assert.equal(validFaultPartDate('2026-11-05'), '2026-11-05');
  assert.equal(validFaultPartDate('2026-08-31'), '2026-08-31');
  assert.equal(validFaultPartDate('2026-10-31'), '2026-10-31');
  assert.equal(validFaultPartDate('2026-12-31'), '2026-12-31');
  assert.equal(validFaultPartDate('2024-02-29'), '2024-02-29');
  assert.equal(validFaultPartDate('2026-02-30'), null);
  assert.equal(validFaultPartDate('2026-04-31'), null);
  assert.equal(validFaultPartDate('2026-09-31'), null);
  assert.equal(validFaultPartDate('2026-11-31'), null);
  assert.equal(validFaultPartDate('2026-13-01'), null);
  assert.equal(validFaultPartDate('05-11-2026'), null);
  assert.equal(validFaultPartDate(''), null);
  assert.equal(validFaultPartDate(null), null);
});

test('half-formed refusal: no ticket link or no quantity is refused', () => {
  assert.equal(normalizeFaultPart(entry({ ticketId: '' })), null);
  assert.equal(normalizeFaultPart(entry({ ticketId: '   ' })), null);
  assert.equal(normalizeFaultPart(entry({ quantity: undefined })), null);
  assert.equal(normalizeFaultPart(entry({ quantity: 0 })), null);
  assert.equal(normalizeFaultPart(entry({ quantity: -1 })), null);
  assert.equal(normalizeFaultPart(entry({ quantity: 1.5 })), null);
  assert.equal(normalizeFaultPart(entry({ quantity: '2' })), null);
  assert.equal(normalizeFaultPart(entry({ part: '' })), null);
  assert.equal(normalizeFaultPart(entry({ id: '' })), null);
  assert.equal(normalizeFaultPart(entry({ date: '2026-02-30' })), null);
  assert.equal(normalizeFaultPart(null), null);
  assert.equal(normalizeFaultPart('nope'), null);
  assert.deepEqual(normalizeFaultPart(entry()), entry());
});

test('unknown fields dropped, note defaults to blank', () => {
  const item = normalizeFaultPart(entry({ stockCount: 9, billId: 'B-1', paymentId: 'P-1' }));
  assert.deepEqual(Object.keys(item).sort(), ['date', 'id', 'note', 'part', 'quantity', 'ticketId']);
  assert.equal(normalizeFaultPart(entry({ note: undefined })).note, '');
});

test('duplicate id never rewritten: identical unchanged, different refused', () => {
  const base = [entry()];
  assert.deepEqual(upsertFaultPart(base, entry()), base);
  assert.deepEqual(upsertFaultPart(base, entry({ quantity: 5 })), base);
  assert.deepEqual(upsertFaultPart(base, entry({ part: 'Router' })), base);
  assert.equal(upsertFaultPart(base, entry({ id: 'FP-2' })).length, 2);
  assert.deepEqual(upsertFaultPart(base, entry({ quantity: 0 })), base);
});

test('partsForTicket: oldest first, then part A-Z, unknown ticket empty', () => {
  const list = [
    entry({ id: 'FP-3', date: '2026-11-06', part: 'Router' }),
    entry({ id: 'FP-1', date: '2026-11-05', part: 'Splitter' }),
    entry({ id: 'FP-2', date: '2026-11-05', part: 'ONU' }),
    entry({ id: 'FP-4', ticketId: 'T-102', date: '2026-11-05', part: 'ONU' }),
  ];
  assert.deepEqual(partsForTicket(list, 'T-101').map((row) => row.id), ['FP-2', 'FP-1', 'FP-3']);
  assert.deepEqual(partsForTicket(list, 'T-999'), []);
  assert.deepEqual(partsForTicket(list, ''), []);
});

test('sumPartsForPeriod: per-part sums, case-insensitive, inclusive ends', () => {
  const list = [
    entry({ id: 'FP-1', part: 'ONU', quantity: 2, date: '2026-11-01' }),
    entry({ id: 'FP-2', part: 'onu', quantity: 3, date: '2026-11-30' }),
    entry({ id: 'FP-3', part: 'Router', quantity: 1, date: '2026-11-15' }),
    entry({ id: 'FP-4', part: 'ONU', quantity: 9, date: '2026-10-31' }),
    entry({ id: 'FP-5', part: 'ONU', quantity: 9, date: '2026-12-01' }),
  ];
  assert.deepEqual(sumPartsForPeriod(list, '2026-11-01', '2026-11-30'), [
    { part: 'ONU', quantity: 5 },
    { part: 'Router', quantity: 1 },
  ]);
  assert.deepEqual(sumPartsForPeriod(list, '2026-11-15', '2026-11-15'), [{ part: 'Router', quantity: 1 }]);
  assert.equal(sumPartsForPeriod(list, '2026-02-30', '2026-11-30'), null);
  assert.equal(sumPartsForPeriod(list, '2026-11-01', 'not-a-date'), null);
  assert.equal(sumPartsForPeriod(list, '2026-11-30', '2026-11-01'), null);
  assert.deepEqual(sumPartsForPeriod([], '2026-11-01', '2026-11-30'), []);
});

test('find and remove: known ids work, unknown ids leave the list alone', () => {
  const list = [entry(), entry({ id: 'FP-2', part: 'Router' })];
  assert.equal(findFaultPart(list, 'FP-2').part, 'Router');
  assert.equal(findFaultPart(list, 'FP-9'), null);
  assert.equal(findFaultPart(list, ''), null);
  assert.deepEqual(removeFaultPart(list, 'FP-1').map((row) => row.id), ['FP-2']);
  assert.deepEqual(removeFaultPart(list, 'FP-9'), list);
  assert.deepEqual(removeFaultPart(list, ''), list);
});

test('inputs never mutated by upsert or remove', () => {
  const list = [entry()];
  const snapshot = JSON.stringify(list);
  upsertFaultPart(list, entry({ id: 'FP-2' }));
  removeFaultPart(list, 'FP-1');
  assert.equal(JSON.stringify(list), snapshot);
});

test('summary text: empty, singular, and plural wordings', () => {
  assert.equal(faultPartSummaryText([]), 'No fault part recorded yet.');
  assert.equal(faultPartSummaryText([entry({ quantity: 1 })]), '1 parts-used entry across 1 ticket; 1 unit in total.');
  assert.equal(
    faultPartSummaryText([entry(), entry({ id: 'FP-2', ticketId: 'T-102', quantity: 3 })]),
    '2 parts-used entries across 2 tickets; 5 units in total.',
  );
});

test('html escapes text and csv quotes cells, filename fixed', () => {
  const rows = [entry({ part: 'ONU <b>', note: 'says "hi", ok' })];
  const html = faultPartHtml(rows);
  assert.match(html, /ONU &lt;b&gt;/);
  assert.ok(!html.includes('<b>'));
  assert.equal(faultPartHtml([]), '<p>No fault part recorded.</p>');
  const csv = faultPartCsv(rows);
  assert.ok(csv.startsWith('id,ticket_id,part,quantity,date,note'));
  assert.match(csv, /"says ""hi"", ok"/);
  assert.equal(faultPartFilename(), 'fault-parts-used.csv');
});

test('purity fence: no imports, no storage/DOM/network, no other record store', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'fault-parts.js'), 'utf8');
  assert.ok(!/^import\s/m.test(source));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('fetch('));
  for (const forbidden of ['shahdara_stock', 'shahdara_ticket', 'shahdara_bill', 'shahdara_payment', 'shahdara_visit']) {
    assert.ok(!source.includes(forbidden), `module must not name ${forbidden}`);
  }
});

test('panel ids present in index.html', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  for (const id of ['faultPartTicket', 'faultPartName', 'faultPartQty', 'faultPartDate', 'faultPartNote', 'faultPartSaveBtn', 'faultPartBody', 'faultPartSummary', 'faultPartExportBtn', 'faultPartFilter', 'faultPartRemoveId', 'faultPartRemoveBtn', 'faultPartPeriodStart', 'faultPartPeriodEnd', 'faultPartPeriodBtn', 'faultPartPeriodBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
