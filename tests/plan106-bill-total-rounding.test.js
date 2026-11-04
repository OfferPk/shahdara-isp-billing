import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validRoundingMonth,
  validRoundingDate,
  roundingCents,
  roundBillTotalCents,
  normalizeRoundingRecord,
  normalizeRoundingRecordList,
  findRoundingRecord,
  upsertRoundingRecord,
  writeOffRoundingRecord,
  roundingRecordsForCustomer,
  roundingRemainderTotals,
  reconcileRounding,
  roundingRecordLineText,
  roundingSummaryText,
  roundingRecordHtml,
  roundingRecordCsv,
  roundingRecordFilename,
} from '../bill-total-rounding.js';

const here = dirname(fileURLToPath(import.meta.url));

const record = (overrides = {}) => ({
  id: 'BR-1',
  customerId: 'C-76',
  customerName: 'Orient school',
  billMonth: '2026-11',
  issueDate: '2026-11-01',
  unroundedCents: 200049,
  ...overrides,
});

test('validRoundingMonth accepts YYYY-MM only', () => {
  assert.equal(validRoundingMonth('2026-11'), true);
  assert.equal(validRoundingMonth('2026-13'), false);
  assert.equal(validRoundingMonth('2026-1'), false);
  assert.equal(validRoundingMonth('Nov 2026'), false);
});

test('validRoundingDate rejects impossible dates', () => {
  assert.equal(validRoundingDate('2026-11-01'), true);
  assert.equal(validRoundingDate('2026-02-30'), false);
  assert.equal(validRoundingDate('2024-02-29'), true);
  assert.equal(validRoundingDate('2026-02-29'), false);
  assert.equal(validRoundingDate('2026-11-31'), false);
});

test('roundingCents keeps integer cents as-is and converts rupees once', () => {
  assert.equal(roundingCents({ unroundedCents: 200049 }), 200049);
  assert.equal(roundingCents({ unrounded: 2000.49 }), 200049);
  assert.equal(roundingCents({ unroundedCents: 200049, unrounded: 1 }), 200049);
  assert.equal(roundingCents({ unrounded: -5 }), null);
  assert.equal(roundingCents({ unrounded: '2000' }), null);
  assert.equal(roundingCents({}), null);
});

test('roundBillTotalCents rounds to the nearest whole rupee, half up', () => {
  assert.deepEqual(roundBillTotalCents(200049), { unroundedCents: 200049, adjustmentCents: -49, finalCents: 200000 });
  assert.deepEqual(roundBillTotalCents(200050), { unroundedCents: 200050, adjustmentCents: 50, finalCents: 200100 });
  assert.deepEqual(roundBillTotalCents(200051), { unroundedCents: 200051, adjustmentCents: 49, finalCents: 200100 });
  assert.deepEqual(roundBillTotalCents(200000), { unroundedCents: 200000, adjustmentCents: 0, finalCents: 200000 });
  assert.deepEqual(roundBillTotalCents(0), { unroundedCents: 0, adjustmentCents: 0, finalCents: 0 });
  assert.equal(roundBillTotalCents(-100), null);
  assert.equal(roundBillTotalCents(2000.5), null);
});

test('normalizeRoundingRecord refuses half-formed records and drops unknown fields', () => {
  assert.equal(normalizeRoundingRecord(record({ id: '' })), null);
  assert.equal(normalizeRoundingRecord(record({ customerId: '' })), null);
  assert.equal(normalizeRoundingRecord(record({ billMonth: '2026-13' })), null);
  assert.equal(normalizeRoundingRecord(record({ issueDate: '2026-02-30' })), null);
  assert.equal(normalizeRoundingRecord(record({ unroundedCents: -1 })), null);
  const clean = normalizeRoundingRecord(record({ packagePrice: 999, paymentAmount: 1, stray: true }));
  assert.equal(clean.packagePrice, undefined);
  assert.equal(clean.paymentAmount, undefined);
  assert.equal(clean.stray, undefined);
  assert.equal(clean.adjustmentCents, -49);
  assert.equal(clean.finalCents, 200000);
});

test('normalizeRoundingRecord refuses a trio that does not reconcile', () => {
  assert.equal(normalizeRoundingRecord(record({ adjustmentCents: 99 })), null);
  assert.equal(normalizeRoundingRecord(record({ finalCents: 200100 })), null);
  // Supplying the matching trio explicitly is accepted.
  const ok = normalizeRoundingRecord(record({ adjustmentCents: -49, finalCents: 200000 }));
  assert.equal(ok.finalCents, 200000);
});

test('written-off records need a reason and a valid date', () => {
  assert.equal(normalizeRoundingRecord(record({ status: 'written-off' })), null);
  assert.equal(normalizeRoundingRecord(record({ status: 'written-off', writtenOffReason: 'Agreed', writtenOffDate: '2026-02-30' })), null);
  const ok = normalizeRoundingRecord(record({ status: 'written-off', writtenOffReason: 'Agreed with owner', writtenOffDate: '2026-11-05' }));
  assert.equal(ok.status, 'written-off');
  assert.equal(ok.writtenOffReason, 'Agreed with owner');
  // An open record carries no write-off fields even if supplied.
  const open = normalizeRoundingRecord(record({ writtenOffReason: 'x', writtenOffDate: '2026-11-05' }));
  assert.equal(open.status, 'open');
  assert.equal(open.writtenOffReason, '');
});

test('upsert appends, keeps an identical re-save, and refuses changed figures', () => {
  const first = upsertRoundingRecord([], record());
  assert.equal(first.length, 1);
  const same = upsertRoundingRecord(first, record());
  assert.deepEqual(same, first);
  assert.equal(upsertRoundingRecord(first, record({ unroundedCents: 200000 })), null);
  assert.deepEqual(upsertRoundingRecord(first, record({ unroundedCents: 200000 })), null);
  const second = upsertRoundingRecord(first, record({ id: 'BR-2', unroundedCents: 150000 }));
  assert.equal(second.length, 2);
});

test('writeOff moves only an open record, only with reason and date', () => {
  const list = upsertRoundingRecord([], record());
  assert.equal(writeOffRoundingRecord(list, 'BR-1', '', '2026-11-05'), null);
  assert.equal(writeOffRoundingRecord(list, 'BR-1', 'Agreed', '2026-02-30'), null);
  assert.equal(writeOffRoundingRecord(list, 'NOPE', 'Agreed', '2026-11-05'), null);
  const off = writeOffRoundingRecord(list, 'BR-1', 'Agreed with owner', '2026-11-05');
  assert.equal(off[0].status, 'written-off');
  assert.equal(off[0].writtenOffReason, 'Agreed with owner');
  assert.equal(off[0].adjustmentCents, -49);
  // Already written off: a second write-off is refused.
  assert.equal(writeOffRoundingRecord(off, 'BR-1', 'Again', '2026-11-06'), null);
  // Original list untouched.
  assert.equal(list[0].status, 'open');
});

test('per-customer filter and remainder totals', () => {
  let list = upsertRoundingRecord([], record());
  list = upsertRoundingRecord(list, record({ id: 'BR-2', customerId: 'C-77', customerName: 'Other', unroundedCents: 100025 }));
  list = upsertRoundingRecord(list, record({ id: 'BR-3', unroundedCents: 50000 }));
  assert.equal(roundingRecordsForCustomer(list, 'C-76').length, 2);
  assert.equal(findRoundingRecord(list, 'BR-2').customerId, 'C-77');
  const totals = roundingRemainderTotals(list, 'C-76');
  assert.equal(totals.count, 2);
  assert.equal(totals.unroundedCents, 250049);
  assert.equal(totals.adjustmentCents, -49);
  assert.equal(totals.finalCents, 250000);
  assert.equal(totals.openRemainderCents, -49);
  const off = writeOffRoundingRecord(list, 'BR-1', 'Agreed', '2026-11-05');
  const after = roundingRemainderTotals(off, 'C-76');
  assert.equal(after.openCount, 1);
  assert.equal(after.writtenOffCount, 1);
  assert.equal(after.openRemainderCents, 0);
  assert.equal(after.adjustmentCents, -49);
});

test('reconcileRounding sums bills plus remainders to final totals', () => {
  let list = upsertRoundingRecord([], record());
  list = upsertRoundingRecord(list, record({ id: 'BR-2', unroundedCents: 100025 }));
  const check = reconcileRounding(list);
  assert.equal(check.unroundedCents, 300074);
  assert.equal(check.adjustmentCents, -49 + -25);
  assert.equal(check.finalCents, 300000);
  assert.equal(check.unroundedCents + check.adjustmentCents, check.finalCents);
  assert.equal(check.reconciles, true);
  assert.equal(check.recordCount, 2);
  // An empty list reconciles trivially and never zero-fills a story.
  const empty = reconcileRounding([]);
  assert.deepEqual(empty, { recordCount: 0, unroundedCents: 0, adjustmentCents: 0, finalCents: 0, reconciles: true });
  // A written-off remainder still reconciles: it stays in the totals.
  const off = writeOffRoundingRecord(list, 'BR-1', 'Agreed', '2026-11-05');
  assert.equal(reconcileRounding(off).reconciles, true);
});

test('normalizeRoundingRecordList drops invalid and duplicate ids', () => {
  const list = normalizeRoundingRecordList([record(), record({ unroundedCents: 1 }), record(), null, 'x']);
  assert.equal(list.length, 1);
  assert.equal(normalizeRoundingRecordList('nope').length, 0);
});

test('summary, line text, HTML escaping, CSV quoting and filename', () => {
  const list = upsertRoundingRecord([], record({ customerName: 'A <b> & "Co"' }));
  const line = roundingRecordLineText(list[0]);
  assert.match(line, /Unrounded Rs\. 2000\.49/);
  assert.match(line, /final Rs\. 2000\.00/);
  const html = roundingRecordHtml(list[0]);
  assert.match(html, /A &lt;b&gt; &amp; &quot;Co&quot;/);
  assert.match(html, /open, carried as a remainder line/);
  const summary = roundingSummaryText(list);
  assert.match(summary, /1 rounding record/);
  assert.match(summary, /unrounded Rs\. 2000\.49 \+ adjustments -Rs\. 0\.49 = final Rs\. 2000\.00/);
  const csv = roundingRecordCsv(upsertRoundingRecord(list, record({ id: 'BR-2', note: 'says "hi", ok' })));
  assert.match(csv, /id,customerId,customerName,billMonth,issueDate,unroundedCents,adjustmentCents,finalCents,status,writtenOffReason,writtenOffDate,note/);
  assert.match(csv, /"says ""hi"", ok"/);
  assert.equal(roundingRecordFilename(), 'bill-rounding-records.csv');
});

test('purity fence: no imports, storage, DOM, or earlier credit-rounding identifiers', () => {
  const source = readFileSync(join(here, '..', 'bill-total-rounding.js'), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /bill-rounding-helper/);
  assert.doesNotMatch(source, /roundToNearest50/);
  assert.doesNotMatch(source, /ROUNDING_STEP/);
  assert.doesNotMatch(source, /packagePrice/);
});
