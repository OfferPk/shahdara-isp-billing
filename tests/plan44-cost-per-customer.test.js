/**
 * plan44-cost-per-customer.test.js — Plan 44: cost per customer and
 * margin per package (read-only).
 * Pins:
 * - cost per customer computes exactly from the month's recurring
 *   expenses and active-customer count on the same fixture;
 * - per-package margins match package price minus cost per
 *   customer on the same fixture;
 * - one-off capital rows are totalled separately and NEVER folded
 *   into the recurring figure, and the summary names both lists;
 * - a package with no price gets a null margin, never a guessed
 *   price; zero active customers gives a null cost, never a
 *   division by zero;
 * - impossible dates (2026-02-30) and negative/non-finite amounts
 *   are excluded and counted, never totalled or zero-filled;
 * - inputs are never mutated; the module holds no bill, payment,
 *   or ledger field and changes no record.
 * Synthetic data only; no ledger figure is ever changed by this
 * plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidCostMonth,
  isValidCostDate,
  parseCapitalCategories,
  normalizeCostPackage,
  normalizeCostPackages,
  buildCostPerCustomer,
  costPerCustomerSummaryText,
  costPerCustomerHtml,
  costPerCustomerCsv,
  costPerCustomerFilename,
} from '../cost-per-customer.js';

const MONTH = '2026-11';

const expenses = [
  { date: '2026-11-03', amount: 45000, category: 'Nayatel bill' },
  { date: '2026-11-05', amount: 8000, category: 'Electricity' },
  { date: '2026-11-07', amount: 8000, category: 'Electricity' },
  { date: '2026-11-09', amount: 3000, category: 'Repairs' },
  { date: '2026-11-11', amount: 150000, category: 'OLT' },
  { date: '2026-10-28', amount: 99999, category: 'Nayatel bill' },
  { date: '2026-02-30', amount: 5000, category: 'Electricity' },
  { date: '2026-11-13', amount: -100, category: 'Repairs' },
  { date: '2026-11-15', amount: 'not a number', category: 'Repairs' },
];

const packages = [
  { name: '3Mbps / 100GB', price: 1000 },
  { name: '15Mbps Unlimited', price: 3000 },
  { name: 'No price package', price: null },
];

function view(overrides = {}) {
  return buildCostPerCustomer({
    month: MONTH, expenses, capitalCategories: ['OLT'],
    activeCustomerCount: 100, packages, ...overrides,
  });
}

test('month and date validation rejects bad months and impossible dates', () => {
  assert.equal(isValidCostMonth('2026-11'), true);
  assert.equal(isValidCostMonth('2026-13'), false);
  assert.equal(isValidCostMonth('2026-1'), false);
  assert.equal(isValidCostMonth(''), false);
  assert.notEqual(isValidCostDate('2026-11-03'), null);
  assert.equal(isValidCostDate('2026-02-30'), null);
  assert.equal(isValidCostDate('2026-11-31'), null);
});

test('invalid month returns an invalid view with null cost', () => {
  const bad = buildCostPerCustomer({ month: '2026-13', expenses, activeCustomerCount: 100, packages });
  assert.equal(bad.valid, false);
  assert.equal(bad.costPerCustomer, null);
  assert.deepEqual(bad.packages, []);
});

test('recurring total excludes capital, other months, and bad rows', () => {
  const v = view();
  assert.equal(v.recurringTotal, 64000);
  assert.equal(v.capitalTotal, 150000);
  assert.equal(v.entries, 5);
  assert.equal(v.excluded, 3);
  assert.deepEqual(
    v.recurringByCategory.map((row) => [row.category, row.amount]),
    [['Electricity', 16000], ['Nayatel bill', 45000], ['Repairs', 3000]],
  );
  assert.deepEqual(
    v.capitalByCategory.map((row) => [row.category, row.amount]),
    [['OLT', 150000]],
  );
});

test('cost per customer divides recurring exactly by active customers', () => {
  assert.equal(view().costPerCustomer, 640);
  assert.equal(view({ activeCustomerCount: 3 }).costPerCustomer, 21333.33);
});

test('zero active customers gives null cost, never a division by zero', () => {
  const v = view({ activeCustomerCount: 0 });
  assert.equal(v.costPerCustomer, null);
  assert.ok(v.packages.every((pkg) => pkg.margin === null));
});

test('per-package margins match price minus cost per customer', () => {
  const v = view();
  assert.deepEqual(
    v.packages.map((pkg) => [pkg.name, pkg.price, pkg.margin, pkg.status]),
    [
      ['3Mbps / 100GB', 1000, 360, 'profitable'],
      ['15Mbps Unlimited', 3000, 2360, 'profitable'],
      ['No price package', null, null, 'unknown'],
    ],
  );
  assert.equal(v.packages[0].marginPercent, 36);
});

test('a loss package and a break-even package get the right status', () => {
  const v = view({ packages: [
    { name: 'Cheap', price: 500 },
    { name: 'Exact', price: 640 },
  ] });
  assert.deepEqual(
    v.packages.map((pkg) => [pkg.name, pkg.margin, pkg.status]),
    [['Cheap', -140, 'loss'], ['Exact', 0, 'break-even']],
  );
});

test('capital matching is case-insensitive and trims duplicates', () => {
  assert.deepEqual(parseCapitalCategories('olt, OLT , ,Routers'), ['olt', 'Routers']);
  assert.deepEqual(parseCapitalCategories(['  OLT ', 'olt']), ['OLT']);
  const v = view({ capitalCategories: 'olt' });
  assert.equal(v.recurringTotal, 64000);
  assert.equal(v.capitalTotal, 150000);
});

test('no capital category marked means every expense counts as recurring, said plainly', () => {
  const v = view({ capitalCategories: [] });
  assert.equal(v.recurringTotal, 214000);
  assert.equal(v.capitalTotal, 0);
  assert.match(costPerCustomerSummaryText(v), /no category was marked as one-off capital/);
});

test('blank category falls back to Other expenses', () => {
  const v = view({ expenses: [{ date: '2026-11-02', amount: 700, category: '' }] });
  assert.deepEqual(
    v.recurringByCategory.map((row) => [row.category, row.amount]),
    [['Other expenses', 700]],
  );
});

test('package normalisation rejects nameless rows and nulls bad prices', () => {
  assert.equal(normalizeCostPackage({ price: 1000 }), null);
  assert.deepEqual(normalizeCostPackage({ name: ' 5Mbps ', price: 'abc' }), { name: '5Mbps', price: null });
  assert.deepEqual(normalizeCostPackage({ name: 'A', price: 0 }), { name: 'A', price: null });
  assert.equal(normalizeCostPackages([{ name: 'A', price: 100 }, { name: 'a', price: 200 }]).length, 1);
  assert.equal(normalizeCostPackages([{ name: 'A', price: 100 }, { name: 'a', price: 200 }])[0].price, 200);
});

test('inputs are never mutated', () => {
  const snapshot = JSON.stringify({ expenses, packages });
  view();
  assert.equal(JSON.stringify({ expenses, packages }), snapshot);
});

test('summary text names included and excluded lists in plain words', () => {
  const text = costPerCustomerSummaryText(view());
  assert.match(text, /Cost per customer: PKR 640\.00/);
  assert.match(text, /Included in the recurring figure: Electricity/);
  assert.match(text, /Set aside as one-off capital, never folded into the monthly figure: OLT/);
  assert.match(text, /3 expense row\(s\) were excluded/);
});

test('HTML escapes package names and states capital separately', () => {
  const html = costPerCustomerHtml(view({ packages: [{ name: '<b>Bad</b>', price: 1000 }] }));
  assert.doesNotMatch(html, /<b>Bad<\/b>/);
  assert.match(html, /&lt;b&gt;Bad&lt;\/b&gt;/);
  assert.match(html, /One-off capital set aside/);
  assert.match(html, /150,000\.00/);
});

test('CSV carries cost, margins, and both category lists', () => {
  const csv = costPerCustomerCsv(view());
  assert.match(csv, /2026-11,640,64000,150000,100,3Mbps \/ 100GB,1000,360,profitable/);
  assert.match(csv, /recurring: Electricity,16000/);
  assert.match(csv, /capital: OLT,150000/);
});

test('filename uses the month and falls back for a bad month', () => {
  assert.equal(costPerCustomerFilename('2026-11'), 'cost-per-customer-2026-11.csv');
  assert.equal(costPerCustomerFilename('2026-13'), 'cost-per-customer.csv');
});
