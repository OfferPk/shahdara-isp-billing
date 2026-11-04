import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validSeriesDate,
  normalizeReceiptSeries,
  normalizeReceiptSeriesList,
  findReceiptSeries,
  seriesForCollector,
  seriesOverlap,
  seriesForNumber,
  addReceiptSeries,
  returnReceiptSeries,
  normalizeReissue,
  normalizeReissueList,
  reissueUnusedNumber,
  reissueForNumber,
  returnedSeriesBreakdown,
  seriesCount,
  receiptSeriesSummaryText,
  receiptSeriesHtml,
  receiptSeriesCsv,
  receiptSeriesFilename,
} from '../receipt-series.js';

const dir = dirname(fileURLToPath(import.meta.url));

test('strict series dates: real dates pass, impossible dates fail', () => {
  assert.equal(validSeriesDate('2026-11-04'), '2026-11-04');
  assert.equal(validSeriesDate('2024-02-29'), '2024-02-29');
  assert.equal(validSeriesDate('2026-02-30'), null);
  assert.equal(validSeriesDate('2026-02-29'), null);
  assert.equal(validSeriesDate('2026-13-01'), null);
  assert.equal(validSeriesDate('04-11-2026'), null);
  assert.equal(validSeriesDate(''), null);
  assert.equal(validSeriesDate(null), null);
});

test('half-formed series refused, unknown fields dropped', () => {
  assert.equal(normalizeReceiptSeries({ collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01' }), null);
  assert.equal(normalizeReceiptSeries({ id: 'S1', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01' }), null);
  assert.equal(normalizeReceiptSeries({ id: 'S1', collector: 'Saad', startNumber: 0, endNumber: 50, dateIssued: '2026-11-01' }), null);
  assert.equal(normalizeReceiptSeries({ id: 'S1', collector: 'Saad', startNumber: 51, endNumber: 50, dateIssued: '2026-11-01' }), null);
  assert.equal(normalizeReceiptSeries({ id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-02-30' }), null);
  assert.equal(normalizeReceiptSeries({ id: 'S1', collector: 'Saad', startNumber: 1.5, endNumber: 50, dateIssued: '2026-11-01' }), null);
  // A return date before the issue date is not a return at all.
  assert.equal(normalizeReceiptSeries({ id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-10', dateReturned: '2026-11-01' }), null);
  const sameDay = normalizeReceiptSeries({ id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-10', dateReturned: '2026-11-10' });
  assert.equal(sameDay.dateReturned, '2026-11-10');
  const clean = normalizeReceiptSeries({
    id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01',
    paymentId: 'P-9', gapNote: 'x', total: 999,
  });
  assert.equal(clean.collector, 'Saad');
  assert.equal('paymentId' in clean, false);
  assert.equal('gapNote' in clean, false);
  assert.equal('total' in clean, false);
});

test('overlap rule: touching at one number is an overlap', () => {
  const a = { startNumber: 1, endNumber: 50 };
  assert.equal(seriesOverlap(a, { startNumber: 50, endNumber: 99 }), true);
  assert.equal(seriesOverlap(a, { startNumber: 51, endNumber: 99 }), false);
  assert.equal(seriesOverlap(a, { startNumber: 10, endNumber: 20 }), true);
  assert.equal(seriesOverlap(a, { startNumber: 60, endNumber: 70 }), false);
});

test('add refuses duplicates and overlaps, never rewrites', () => {
  const first = addReceiptSeries([], { id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01' });
  assert.equal(first.length, 1);
  assert.equal(addReceiptSeries(first, { id: 'S1', collector: 'Other', startNumber: 100, endNumber: 150, dateIssued: '2026-11-02' }).length, 1);
  assert.equal(addReceiptSeries(first, { id: 'S2', collector: 'Other', startNumber: 50, endNumber: 99, dateIssued: '2026-11-02' }).length, 1);
  assert.equal(addReceiptSeries(first, { id: 'S2', collector: 'Other', startNumber: 25, endNumber: 30, dateIssued: '2026-11-02' }).length, 1);
  const second = addReceiptSeries(first, { id: 'S2', collector: 'Other', startNumber: 51, endNumber: 100, dateIssued: '2026-11-02' });
  assert.equal(second.length, 2);
  // The original list is untouched by every refused add.
  assert.equal(first.length, 1);
});

test('each number falls inside exactly one issued series', () => {
  const list = [
    { id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01' },
    { id: 'S2', collector: 'Ali', startNumber: 51, endNumber: 100, dateIssued: '2026-11-02' },
  ];
  assert.equal(seriesForNumber(list, 1).id, 'S1');
  assert.equal(seriesForNumber(list, 50).id, 'S1');
  assert.equal(seriesForNumber(list, 51).id, 'S2');
  assert.equal(seriesForNumber(list, 100).id, 'S2');
  assert.equal(seriesForNumber(list, 101), null);
  assert.equal(seriesForNumber(list, 0), null);
  assert.equal(seriesForNumber(list, '25'), null);
});

test('find and per-collector filter', () => {
  const list = [
    { id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01' },
    { id: 'S2', collector: 'Saad', startNumber: 51, endNumber: 100, dateIssued: '2026-11-02' },
    { id: 'S3', collector: 'Ali', startNumber: 101, endNumber: 150, dateIssued: '2026-11-03' },
  ];
  assert.equal(findReceiptSeries(list, 'S2').collector, 'Saad');
  assert.equal(findReceiptSeries(list, 'S9'), null);
  assert.equal(seriesForCollector(list, 'Saad').length, 2);
  assert.equal(seriesForCollector(list, 'Ali').length, 1);
  assert.equal(seriesForCollector(list, '').length, 0);
  assert.equal(seriesCount(list), 3);
});

test('return gates: unknown, already returned, bad date, early date', () => {
  const list = [{ id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01' }];
  assert.equal(returnReceiptSeries(list, 'S9', '2026-11-10').length, 1);
  assert.equal(returnReceiptSeries(list, 'S9', '2026-11-10')[0].dateReturned, null);
  const returned = returnReceiptSeries(list, 'S1', '2026-11-20');
  assert.equal(returned[0].dateReturned, '2026-11-20');
  // Already returned: never re-dated, never un-returned.
  assert.equal(returnReceiptSeries(returned, 'S1', '2026-11-25')[0].dateReturned, '2026-11-20');
  assert.equal(returnReceiptSeries(list, 'S1', '2026-02-30')[0].dateReturned, null);
  assert.equal(returnReceiptSeries(list, 'S1', '2026-10-31')[0].dateReturned, null);
  // The original list is untouched.
  assert.equal(list[0].dateReturned, undefined);
});

test('returned-series breakdown: used, void, unused', () => {
  const series = normalizeReceiptSeries({ id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 5, dateIssued: '2026-11-01', dateReturned: '2026-11-20' });
  const breakdown = returnedSeriesBreakdown(series, [1, 2], [4]);
  assert.equal(breakdown.total, 5);
  assert.deepEqual(breakdown.used, [1, 2]);
  assert.deepEqual(breakdown.voided, [4]);
  assert.deepEqual(breakdown.unused, [3, 5]);
  // A series still out with a collector has no breakdown.
  const out = normalizeReceiptSeries({ id: 'S2', collector: 'Ali', startNumber: 6, endNumber: 10, dateIssued: '2026-11-02' });
  assert.equal(returnedSeriesBreakdown(out, [6], []), null);
});

test('reissue gates: only unused numbers of returned series, reason mandatory', () => {
  const seriesList = [
    { id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 5, dateIssued: '2026-11-01', dateReturned: '2026-11-20' },
    { id: 'S2', collector: 'Ali', startNumber: 6, endNumber: 10, dateIssued: '2026-11-02' },
  ];
  const good = { id: 'R1', number: 3, fromSeriesId: 'S1', toCollector: 'Ali', reason: 'Book short, number never used', date: '2026-11-21' };
  assert.equal(reissueUnusedNumber(seriesList, [], [1, 2], [4], good).length, 1);
  // Used or void numbers are never reissued.
  assert.equal(reissueUnusedNumber(seriesList, [], [1, 2], [4], { ...good, id: 'R2', number: 1 }).length, 0);
  assert.equal(reissueUnusedNumber(seriesList, [], [1, 2], [4], { ...good, id: 'R2', number: 4 }).length, 0);
  // A number outside the series, or from a series still out, is refused.
  assert.equal(reissueUnusedNumber(seriesList, [], [], [], { ...good, id: 'R2', number: 9 }).length, 0);
  assert.equal(reissueUnusedNumber(seriesList, [], [], [], { ...good, id: 'R2', number: 7, fromSeriesId: 'S2' }).length, 0);
  // No reason, no reissue — even for a genuinely unused number.
  assert.equal(reissueUnusedNumber(seriesList, [], [], [], { ...good, id: 'R2', reason: '' }).length, 0);
  // A number already reissued is never reissued again.
  const once = reissueUnusedNumber(seriesList, [], [1, 2], [4], good);
  assert.equal(reissueUnusedNumber(seriesList, once, [1, 2], [4], { ...good, id: 'R2' }).length, 1);
  assert.equal(reissueForNumber(once, 3).toCollector, 'Ali');
  assert.equal(reissueForNumber(once, 2), null);
  // Half-formed reissue records refused.
  assert.equal(normalizeReissue({ id: 'R9', number: 3, fromSeriesId: 'S1', toCollector: 'Ali', date: '2026-11-21' }), null);
  assert.equal(normalizeReissue({ ...good, date: '2026-02-30' }), null);
});

test('non-mutation: inputs never change', () => {
  const list = [{ id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01' }];
  const snapshot = JSON.stringify(list);
  addReceiptSeries(list, { id: 'S2', collector: 'Ali', startNumber: 51, endNumber: 100, dateIssued: '2026-11-02' });
  returnReceiptSeries(list, 'S1', '2026-11-20');
  assert.equal(JSON.stringify(list), snapshot);
});

test('summary, HTML escaping, CSV, filename', () => {
  const list = [
    { id: 'S1', collector: 'Saad', startNumber: 1, endNumber: 50, dateIssued: '2026-11-01', dateReturned: '2026-11-20' },
    { id: 'S2', collector: 'Ali', startNumber: 51, endNumber: 100, dateIssued: '2026-11-02' },
  ];
  assert.equal(receiptSeriesSummaryText(list), '2 receipt series recorded, 1 returned.');
  const html = receiptSeriesHtml({ ...list[0], collector: '<b>Saad</b>' });
  assert.ok(!html.includes('<b>Saad</b>'));
  assert.ok(html.includes('&lt;b&gt;Saad&lt;/b&gt;'));
  const csv = receiptSeriesCsv(list);
  assert.ok(csv.includes('Saad,1,50,2026-11-01,2026-11-20'));
  assert.ok(csv.includes('Ali,51,100,2026-11-02,'));
  assert.equal(receiptSeriesFilename(), 'receipt-series.csv');
});

test('purity fence: no imports, no storage, DOM, network, or gap-audit identifiers', () => {
  const source = readFileSync(join(dir, '..', 'receipt-series.js'), 'utf8');
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('gap-audit'));
  assert.ok(!source.includes('gapAudit'));
  assert.ok(!source.includes('receipt-gap'));
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['receiptSeriesSummary', 'receiptSeriesCollector', 'receiptSeriesStart', 'receiptSeriesEnd', 'receiptSeriesIssued', 'receiptSeriesSaveBtn', 'receiptSeriesBody', 'receiptSeriesReturnId', 'receiptSeriesReturnDate', 'receiptSeriesReturnBtn', 'receiptSeriesReissueNumber', 'receiptSeriesReissueTo', 'receiptSeriesReissueReason', 'receiptSeriesReissueDate', 'receiptSeriesReissueBtn', 'receiptSeriesExportBtn', 'receiptSeriesBreakdownSeries', 'receiptSeriesBreakdownUsed', 'receiptSeriesBreakdownVoid', 'receiptSeriesBreakdownBtn', 'receiptSeriesBreakdownResult']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
