import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validAppliedDate,
  billDateForApplied,
  normalizeAppliedPackageKey,
  normalizeAppliedPrice,
  normalizeAppliedPriceList,
  findAppliedPrice,
  recordAppliedPrice,
  removeAppliedPrice,
  appliedPricesSorted,
  appliedPricesForCustomer,
  appliedPricesForBill,
  checkAppliedPrice,
  flaggedAppliedPrices,
  appliedPriceText,
  appliedPriceSummaryText,
  appliedPriceHtml,
  appliedPriceCsv,
  appliedPriceFilename,
} from '../applied-price.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'applied-price.js'), 'utf8');

const recordA = { id: 'AP-1', customerId: 'C-1', billId: '2026-11', packageKey: '10 Mbps', packageLabel: '10 Mbps', priceApplied: 1500, effectiveDate: '2026-10-01', billDate: '2026-11' };
const recordB = { id: 'AP-2', customerId: 'C-2', billId: '2026-11', packageKey: '10 Mbps', packageLabel: '10 Mbps', priceApplied: 1500, effectiveDate: '2026-10-01', billDate: '2026-11-05' };
const recordC = { id: 'AP-3', customerId: 'C-1', billId: '2026-09', packageKey: '10 Mbps', packageLabel: '10 Mbps', priceApplied: 1200, effectiveDate: '2026-09-01', billDate: '2026-09-15' };
const history = [
  { packageKey: '10 Mbps', amount: 1200, effectiveDate: '2026-09-01' },
  { packageKey: '10 Mbps', amount: 1500, effectiveDate: '2026-10-01' },
];

test('half-formed applied-price records are refused', () => {
  assert.equal(normalizeAppliedPrice({ customerId: 'C-1', billId: '2026-11', packageKey: '10 Mbps', priceApplied: 1500, effectiveDate: '2026-10-01', billDate: '2026-11' }), null);
  assert.equal(normalizeAppliedPrice({ ...recordA, customerId: '' }), null);
  assert.equal(normalizeAppliedPrice({ ...recordA, billId: '' }), null);
  assert.equal(normalizeAppliedPrice({ ...recordA, packageKey: '' }), null);
  assert.equal(normalizeAppliedPrice({ ...recordA, priceApplied: -5 }), null);
  assert.equal(normalizeAppliedPrice({ ...recordA, priceApplied: 'not a number' }), null);
  assert.equal(normalizeAppliedPrice({ ...recordA, effectiveDate: '2026-10-32' }), null);
  assert.equal(normalizeAppliedPrice({ ...recordA, billDate: '2026-13' }), null);
  assert.equal(normalizeAppliedPrice({ ...recordA, priceApplied: '1500' }).priceApplied, 1500);
});

test('strict calendar dates: 31-day months, Feb 29 leap and non-leap', () => {
  assert.equal(validAppliedDate('2026-08-31'), true);
  assert.equal(validAppliedDate('2026-08-32'), false);
  assert.equal(validAppliedDate('2026-02-30'), false);
  assert.equal(validAppliedDate('2024-02-29'), true);
  assert.equal(validAppliedDate('2026-02-29'), false);
  assert.equal(validAppliedDate('2026-1-02'), false);
  assert.equal(normalizeAppliedPrice({ ...recordA, effectiveDate: '2026-02-30' }), null);
});

test('a bill month counts as its first day, exactly like Plan 34', () => {
  assert.equal(billDateForApplied('2026-11'), '2026-11-01');
  assert.equal(billDateForApplied('2026-11-05'), '2026-11-05');
  assert.equal(billDateForApplied('Nov 2026'), null);
  assert.equal(normalizeAppliedPrice(recordA).billDate, '2026-11-01');
});

test('unknown fields are dropped, so no bill, payment, or permission field can creep in', () => {
  const clean = normalizeAppliedPrice({ ...recordA, dueAmount: 1500, paymentId: 'P-1', grantsAccess: true, routeId: 'R-1', priceSnapshot: 9999, sendMessage: true });
  assert.deepEqual(Object.keys(clean).sort(), ['billDate', 'billId', 'customerId', 'effectiveDate', 'id', 'packageKey', 'packageLabel', 'priceApplied']);
  assert.equal(clean.priceApplied, 1500);
});

test('duplicate ids are never rewritten', () => {
  const list = recordAppliedPrice([], recordA);
  assert.deepEqual(recordAppliedPrice(list, { ...recordA, priceApplied: 9999 }), list);
  assert.equal(recordAppliedPrice(list, { ...recordA, priceApplied: 9999 })[0].priceApplied, 1500);
});

test('find and remove work by id', () => {
  const list = recordAppliedPrice(recordAppliedPrice([], recordA), recordB);
  assert.equal(findAppliedPrice(list, 'AP-2').customerId, 'C-2');
  assert.equal(findAppliedPrice(list, 'AP-9'), null);
  assert.deepEqual(removeAppliedPrice(list, 'AP-1').map((r) => r.id), ['AP-2']);
  assert.deepEqual(removeAppliedPrice(list, 'AP-9'), list);
});

test('records sort by bill date, then customer, then bill, then id', () => {
  const sorted = appliedPricesSorted([recordB, recordC, recordA]);
  assert.deepEqual(sorted.map((r) => r.id), ['AP-3', 'AP-1', 'AP-2']);
});

test('filters by customer and by bill', () => {
  const list = [recordA, recordB, recordC];
  assert.deepEqual(appliedPricesForCustomer(list, 'C-1').map((r) => r.id), ['AP-3', 'AP-1']);
  assert.deepEqual(appliedPricesForBill(list, '2026-11').map((r) => r.id), ['AP-1', 'AP-2']);
  assert.deepEqual(appliedPricesForCustomer(list, 'C-9'), []);
});

test('history check matches when the applied price equals the history price for the bill date', () => {
  const checkA = checkAppliedPrice(recordA, history);
  assert.equal(checkA.status, 'matches');
  assert.equal(checkA.expected, 1500);
  const checkC = checkAppliedPrice(recordC, history);
  assert.equal(checkC.status, 'matches');
  assert.equal(checkC.expected, 1200);
});

test('a bill whose applied price disagrees with the history is flagged', () => {
  const wrong = { ...recordA, id: 'AP-9', priceApplied: 1200 };
  const check = checkAppliedPrice(wrong, history);
  assert.equal(check.status, 'disagrees');
  assert.equal(check.expected, 1500);
  assert.deepEqual(flaggedAppliedPrices([recordA, wrong, recordC], history).map((r) => r.id), ['AP-9']);
  assert.ok(appliedPriceText(wrong, check).includes('disagrees with price history'));
});

test('a mid-month revision applies only from the following month, never retroactively', () => {
  const midMonth = [{ packageKey: '10 Mbps', amount: 1200, effectiveDate: '2026-09-01' }, { packageKey: '10 Mbps', amount: 1500, effectiveDate: '2026-10-15' }];
  const octoberBill = { ...recordA, id: 'AP-10', billDate: '2026-10', priceApplied: 1200 };
  assert.equal(checkAppliedPrice(octoberBill, midMonth).status, 'matches');
  const octoberWrong = { ...octoberBill, priceApplied: 1500 };
  assert.equal(checkAppliedPrice(octoberWrong, midMonth).status, 'disagrees');
});

test('baseline applies before the first revision; no history and no baseline is unverifiable, never a disagreement', () => {
  const early = { ...recordC, id: 'AP-11', billDate: '2026-08-01', priceApplied: 1000 };
  assert.equal(checkAppliedPrice(early, history, 1000).status, 'matches');
  assert.equal(checkAppliedPrice(early, history).status, 'unverifiable');
  assert.deepEqual(flaggedAppliedPrices([early], history), []);
  assert.equal(checkAppliedPrice(recordA, history, 9999).status, 'matches');
});

test('package keys match case-insensitively, and baselines map by package key', () => {
  assert.equal(normalizeAppliedPackageKey('  10   Mbps '), '10 mbps');
  const lower = { ...recordA, id: 'AP-12', packageKey: '10 mbps' };
  assert.equal(checkAppliedPrice(lower, history).status, 'matches');
  const flagged = flaggedAppliedPrices([{ ...recordA, id: 'AP-13', priceApplied: 1300 }], [], { '10 MBPS': 1500 });
  assert.deepEqual(flagged.map((r) => r.id), ['AP-13']);
});

test('summary text, record text, and HTML show price, effective date, and the flag', () => {
  assert.equal(appliedPriceSummaryText([]), 'No applied prices recorded yet.');
  assert.equal(appliedPriceSummaryText([recordA, recordB, recordC]), '3 applied prices across 2 customers.');
  assert.ok(appliedPriceText(recordA).includes('PKR 1,500 applied, effective 2026-10-01'));
  const html = appliedPriceHtml([recordA, { ...recordA, id: 'AP-14', priceApplied: 1200 }], history);
  assert.match(html, /Price applied/);
  assert.match(html, /Effective date/);
  assert.match(html, /Disagrees/);
  assert.match(html, /Matches history/);
  const escaped = appliedPriceHtml([{ ...recordA, customerId: '<b>&' }]);
  assert.doesNotMatch(escaped, /<b>/);
});

test('CSV export and filename', () => {
  const csv = appliedPriceCsv([recordA, recordC]);
  assert.ok(csv.startsWith('customer,bill,package,price_applied,effective_date,bill_date'));
  assert.ok(csv.includes('C-1,2026-11,10 Mbps,1500,2026-10-01,2026-11-01'));
  assert.equal(appliedPriceFilename(), 'applied-prices.csv');
});

test('inputs are never mutated', () => {
  const input = [recordA, recordB];
  const snapshot = JSON.stringify(input);
  recordAppliedPrice(input, recordC);
  removeAppliedPrice(input, 'AP-1');
  appliedPricesSorted(input);
  checkAppliedPrice(recordA, history);
  flaggedAppliedPrices(input, history);
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad entries and later duplicates', () => {
  assert.deepEqual(normalizeAppliedPriceList(null), []);
  assert.deepEqual(normalizeAppliedPriceList([null, recordA, { ...recordA, priceApplied: 9999 }, recordB]).map((r) => r.id), ['AP-1', 'AP-2']);
});

test('purity fence: the module is import-free and touches no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /^import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['apSummary', 'apExportBtn', 'apCustomer', 'apBill', 'apPackage', 'apPrice', 'apEffective', 'apBillDate', 'apSaveBtn', 'apRemoveId', 'apRemoveBtn', 'apCustomerFilter', 'apBillFilter', 'apFlaggedBody', 'apBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the applied-price store and render function', () => {
  assert.match(appJs, /shahdara_applied_prices_v1/);
  assert.match(appJs, /renderAppliedPrices\(\)/);
  assert.match(appJs, /applied-price\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Z])OLT(?![A-Z])/g) || [];
  assert.equal(matches.length, 0);
});
