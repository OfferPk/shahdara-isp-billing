import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validPriceDate,
  billDateForPrice,
  normalizePackageKey,
  normalizePriceRevision,
  normalizePriceHistory,
  recordPriceRevision,
  priceHistoryForPackage,
  priceOnDate,
  currentPrice,
  priceHistorySummaryText,
  priceHistoryHtml,
  priceHistoryCsv,
  priceHistoryFilename,
} from '../package-price-history.js';

const revision = (overrides = {}) => ({
  packageKey: '5mbps-500gb',
  packageLabel: '5Mbps / 500GB',
  amount: 2500,
  effectiveDate: '2026-11-01',
  note: 'Annual revision',
  ...overrides,
});

test('validPriceDate accepts real dates and rejects impossible ones', () => {
  assert.equal(validPriceDate('2026-11-01'), '2026-11-01');
  assert.equal(validPriceDate('2024-02-29'), '2024-02-29');
  assert.equal(validPriceDate('2026-02-30'), null);
  assert.equal(validPriceDate('2026-13-01'), null);
  assert.equal(validPriceDate('2026-11'), null);
  assert.equal(validPriceDate(20261101), null);
});

test('billDateForPrice treats a bill month as its first day', () => {
  assert.equal(billDateForPrice('2026-11-15'), '2026-11-15');
  assert.equal(billDateForPrice('2026-11'), '2026-11-01');
  assert.equal(billDateForPrice('2026-13'), null);
  assert.equal(billDateForPrice('not-a-date'), null);
});

test('normalizePackageKey collapses case and spacing', () => {
  assert.equal(normalizePackageKey('  5Mbps  /  500GB '), '5mbps / 500gb');
  assert.equal(normalizePackageKey(''), '');
  assert.equal(normalizePackageKey(null), '');
});

test('normalizePriceRevision keeps a valid revision verbatim', () => {
  assert.deepEqual(normalizePriceRevision(revision()), {
    packageKey: '5mbps-500gb',
    packageLabel: '5Mbps / 500GB',
    amount: 2500,
    effectiveDate: '2026-11-01',
    note: 'Annual revision',
  });
});

test('normalizePriceRevision accepts a numeric string amount and a label key', () => {
  const out = normalizePriceRevision({ label: '5Mbps / 500GB', price: '2700', date: '2026-12-01' });
  assert.equal(out.packageKey, '5mbps / 500gb');
  assert.equal(out.amount, 2700);
  assert.equal(out.effectiveDate, '2026-12-01');
});

test('normalizePriceRevision rejects missing key, bad amount, and bad date', () => {
  assert.equal(normalizePriceRevision(revision({ packageKey: '' })), null);
  assert.equal(normalizePriceRevision(revision({ amount: -100 })), null);
  assert.equal(normalizePriceRevision(revision({ amount: 'not-a-number' })), null);
  assert.equal(normalizePriceRevision(revision({ amount: Number.NaN })), null);
  assert.equal(normalizePriceRevision(revision({ effectiveDate: '2026-02-30' })), null);
  assert.equal(normalizePriceRevision(null), null);
  assert.equal(normalizePriceRevision('revision'), null);
});

test('normalizePriceRevision keeps a zero price and drops a missing note to empty', () => {
  const out = normalizePriceRevision(revision({ amount: 0, note: undefined }));
  assert.equal(out.amount, 0);
  assert.equal(out.note, '');
});

test('normalizePriceHistory drops invalid entries and sorts by effective date', () => {
  const list = normalizePriceHistory([
    revision({ effectiveDate: '2026-12-01', amount: 2700 }),
    revision({ effectiveDate: '2026-02-30' }),
    revision({ effectiveDate: '2026-11-01', amount: 2500 }),
  ]);
  assert.deepEqual(list.map((item) => item.effectiveDate), ['2026-11-01', '2026-12-01']);
  assert.equal(normalizePriceHistory(null).length, 0);
  assert.equal(normalizePriceHistory('nope').length, 0);
});

test('recordPriceRevision appends sorted and never mutates its inputs', () => {
  const before = [revision({ effectiveDate: '2026-12-01', amount: 2700 })];
  const after = recordPriceRevision(before, revision({ effectiveDate: '2026-11-01', amount: 2500 }));
  assert.deepEqual(after.map((item) => item.effectiveDate), ['2026-11-01', '2026-12-01']);
  assert.equal(before.length, 1);
  assert.equal(before[0].effectiveDate, '2026-12-01');
});

test('recordPriceRevision leaves the list unchanged for an invalid revision', () => {
  const before = [revision()];
  const after = recordPriceRevision(before, revision({ effectiveDate: '2026-02-30' }));
  assert.deepEqual(after, normalizePriceHistory(before));
  assert.notEqual(after, before);
});

test('priceHistoryForPackage filters by key, case-insensitively', () => {
  const history = [
    revision({ packageKey: '5mbps-500gb' }),
    revision({ packageKey: '3mbps-100gb', packageLabel: '3Mbps / 100GB', amount: 1000, effectiveDate: '2026-10-01' }),
  ];
  assert.equal(priceHistoryForPackage(history, '5MBPS-500GB').length, 1);
  assert.equal(priceHistoryForPackage(history, 'missing').length, 0);
});

test('priceOnDate: bill before the effective date shows the old price', () => {
  const history = [revision({ effectiveDate: '2026-11-01', amount: 2500 })];
  assert.equal(priceOnDate(history, '5mbps-500gb', '2026-10-15', 2000), 2000);
});

test('priceOnDate: bill on the effective date shows the new price', () => {
  const history = [revision({ effectiveDate: '2026-11-01', amount: 2500 })];
  assert.equal(priceOnDate(history, '5mbps-500gb', '2026-11-01', 2000), 2500);
});

test('priceOnDate: bill after the effective date shows the new price', () => {
  const history = [revision({ effectiveDate: '2026-11-01', amount: 2500 })];
  assert.equal(priceOnDate(history, '5mbps-500gb', '2026-12-20', 2000), 2500);
});

test('priceOnDate: later revisions win, in date order', () => {
  const history = [
    revision({ effectiveDate: '2026-11-01', amount: 2500 }),
    revision({ effectiveDate: '2027-01-01', amount: 2700 }),
  ];
  assert.equal(priceOnDate(history, '5mbps-500gb', '2026-12-01', 2000), 2500);
  assert.equal(priceOnDate(history, '5mbps-500gb', '2027-02-01', 2000), 2700);
});

test('priceOnDate: a bill month counts from its first day', () => {
  const history = [revision({ effectiveDate: '2026-11-15', amount: 2500 })];
  // The November bill is raised 1 November, before the 15th, so it
  // keeps the old price; the December bill takes the new price.
  assert.equal(priceOnDate(history, '5mbps-500gb', '2026-11', 2000), 2000);
  assert.equal(priceOnDate(history, '5mbps-500gb', '2026-12', 2000), 2500);
});

test('priceOnDate: no revision and no baseline is null, never guessed', () => {
  assert.equal(priceOnDate([], '5mbps-500gb', '2026-11-01'), null);
  assert.equal(priceOnDate([], '5mbps-500gb', '2026-11-01', 'not-a-number'), null);
  assert.equal(priceOnDate([], '5mbps-500gb', 'not-a-date', 2000), null);
});

test('priceOnDate: baseline is the catalogue price before the first revision', () => {
  assert.equal(priceOnDate([], '3mbps-100gb', '2026-10-01', 1000), 1000);
  assert.equal(priceOnDate([], '3mbps-100gb', '2026-10-01', '1000'), 1000);
});

test('currentPrice returns the latest revision, else the baseline', () => {
  const history = [
    revision({ effectiveDate: '2026-11-01', amount: 2500 }),
    revision({ effectiveDate: '2027-01-01', amount: 2700 }),
  ];
  assert.equal(currentPrice(history, '5mbps-500gb', 2000), 2700);
  assert.equal(currentPrice([], '5mbps-500gb', 2000), 2000);
  assert.equal(currentPrice([], '5mbps-500gb'), null);
});

test('recording a revision never alters an existing bill figure', () => {
  // The fixture: a bill raised in October at the old price.
  const history = [revision({ effectiveDate: '2026-11-01', amount: 2500 })];
  const bill = { month: '2026-10', amount: 2000 };
  assert.equal(priceOnDate(history, '5mbps-500gb', bill.month, 2000), bill.amount);
  assert.equal(priceOnDate(history, '5mbps-500gb', '2026-11', 2000), 2500);
});

test('priceHistorySummaryText covers empty and populated histories', () => {
  assert.equal(priceHistorySummaryText([]), 'No package price revisions recorded yet.');
  const history = [
    revision({ effectiveDate: '2026-11-01' }),
    revision({ packageKey: '3mbps-100gb', packageLabel: '3Mbps / 100GB', amount: 1000, effectiveDate: '2026-12-01' }),
  ];
  assert.match(priceHistorySummaryText(history), /2 price revisions across 2 packages/);
  assert.match(priceHistorySummaryText([revision()]), /1 price revision across 1 package/);
});

test('priceHistoryHtml escapes markup and shows effective dates', () => {
  const html = priceHistoryHtml([revision({ note: '<b>bold</b>' })]);
  assert.match(html, /2026-11-01/);
  assert.match(html, /2,500/);
  assert.doesNotMatch(html, /<b>bold<\/b>/);
  assert.match(priceHistoryHtml([]), /No package price revisions recorded yet/);
});

test('priceHistoryCsv quotes fields with commas', () => {
  const csv = priceHistoryCsv([revision({ note: 'Eid, festival' })]);
  assert.match(csv, /^package,effective_date,new_price,note\n/);
  assert.match(csv, /"Eid, festival"/);
});

test('priceHistoryFilename is stable', () => {
  assert.equal(priceHistoryFilename(), 'package-price-history.csv');
});
