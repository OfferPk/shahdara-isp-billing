// Plan 453 — Search ledger by amount range: one whole-rupee range
// search over the whole ledger (minimum and maximum, both
// inclusive) listing every matching entry with date, customer, and
// method, in date order, with the count and the total shown in PKR
// — and never changing any record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formatLedgerRupees,
  formatLedgerPkrTotal,
  normalizeLedgerAmount,
  normalizeLedgerAmountRange,
  ledgerAmountRangeActive,
  ledgerAmountRangeMatches,
  searchLedgerByAmountRange,
  ledgerAmountRangeSummary,
  ledgerAmountRangeText,
  ledgerAmountRangeSummaryText,
  ledgerAmountRangeEmptyText,
} from '../ledger-amount-range.js';

// Generic fixtures only — no real customer names, no phone numbers.
function entry(id, amount, date, customerName = 'Customer A', method = 'Cash', extra = {}) {
  return { id, paymentId: id, amount, date, customerName, customerNumber: 101, method, ...extra };
}

function ledger() {
  return [
    entry('t1', 500, '2026-11-01', 'Customer A', 'Cash'),
    entry('t2', 1000, '2026-11-02', 'Customer B', 'JazzCash'),
    entry('t3', 1500, '2026-11-03', 'Customer C', 'Cash'),
    entry('t4', 1500.5, '2026-11-04', 'Customer D', 'Easypaisa'),
    entry('t5', 2000, '2026-11-05', 'Customer E', 'Cash'),
    entry('t6', 2500, '2026-11-06', 'Customer F', 'Bank Transfer'),
    entry('t7', 2000, '2026-11-07', 'Customer G', 'Cash', { voided: true }),
    entry('t8', 1200, '', 'Customer H', 'Cash'),
  ];
}

test('one bound parses like the exact-amount search: Rs prefix, commas, spaces', () => {
  assert.equal(normalizeLedgerAmount('1,000'), 1000);
  assert.equal(normalizeLedgerAmount('Rs 1500'), 1500);
  assert.equal(normalizeLedgerAmount('Rs. 2,000'), 2000);
  assert.equal(normalizeLedgerAmount('PKR 3000'), 3000);
  assert.equal(normalizeLedgerAmount(' 2000 '), 2000);
  assert.equal(normalizeLedgerAmount(1500), 1500);
  assert.equal(normalizeLedgerAmount(''), null);
  assert.equal(normalizeLedgerAmount('   '), null);
  assert.equal(normalizeLedgerAmount('abc'), null);
  assert.equal(normalizeLedgerAmount('Rs'), null);
  assert.equal(normalizeLedgerAmount('1,500.5'), null);
  assert.equal(normalizeLedgerAmount('1,500.50'), null);
  assert.equal(normalizeLedgerAmount('-500'), null);
  assert.equal(normalizeLedgerAmount('0'), null);
  assert.equal(normalizeLedgerAmount(0), null);
  assert.equal(normalizeLedgerAmount(1.5), null);
  assert.equal(normalizeLedgerAmount(null), null);
  assert.equal(normalizeLedgerAmount(undefined), null);
});

test('the range normalizes: blank side is open, backwards is swapped, blank is inactive', () => {
  assert.deepEqual(normalizeLedgerAmountRange(1000, 2000), { min: 1000, max: 2000, active: true });
  assert.deepEqual(normalizeLedgerAmountRange('1,000', 'Rs 2,000'), { min: 1000, max: 2000, active: true });
  assert.deepEqual(normalizeLedgerAmountRange('', 2000), { min: null, max: 2000, active: true });
  assert.deepEqual(normalizeLedgerAmountRange(1000, ''), { min: 1000, max: null, active: true });
  assert.deepEqual(normalizeLedgerAmountRange(2000, 1000), { min: 1000, max: 2000, active: true });
  assert.deepEqual(normalizeLedgerAmountRange('', ''), { min: null, max: null, active: false });
  assert.deepEqual(normalizeLedgerAmountRange('abc', 'def'), { min: null, max: null, active: false });
  assert.deepEqual(normalizeLedgerAmountRange(null, null), { min: null, max: null, active: false });
  assert.equal(ledgerAmountRangeActive(1000, 2000), true);
  assert.equal(ledgerAmountRangeActive('', 2000), true);
  assert.equal(ledgerAmountRangeActive('', ''), false);
});

test('matching is inclusive on both ends, and open sides are unbounded', () => {
  const atMin = entry('a', 1000, '2026-11-02');
  const atMax = entry('b', 2000, '2026-11-03');
  const below = entry('c', 999, '2026-11-02');
  const above = entry('d', 2001, '2026-11-03');
  assert.equal(ledgerAmountRangeMatches(atMin, 1000, 2000), true);
  assert.equal(ledgerAmountRangeMatches(atMax, 1000, 2000), true);
  assert.equal(ledgerAmountRangeMatches(below, 1000, 2000), false);
  assert.equal(ledgerAmountRangeMatches(above, 1000, 2000), false);
  // One open side: only the other bound applies.
  assert.equal(ledgerAmountRangeMatches(above, 1000, ''), true);
  assert.equal(ledgerAmountRangeMatches(below, '', 2000), true);
  assert.equal(ledgerAmountRangeMatches(below, 1000, ''), false);
  assert.equal(ledgerAmountRangeMatches(above, '', 2000), false);
  // No usable bound: everything matches.
  assert.equal(ledgerAmountRangeMatches(atMin, '', ''), true);
  assert.equal(ledgerAmountRangeMatches(atMin, 'abc', ''), true);
});

test('matching: a string amount counts, a non-numeric amount never matches', () => {
  assert.equal(ledgerAmountRangeMatches(entry('a', '1500', '2026-11-02'), 1000, 2000), true);
  assert.equal(ledgerAmountRangeMatches(entry('a', null, '2026-11-02'), 1000, 2000), false);
  assert.equal(ledgerAmountRangeMatches(entry('a', undefined, '2026-11-02'), 1000, 2000), false);
  assert.equal(ledgerAmountRangeMatches(entry('a', 'abc', '2026-11-02'), 1000, 2000), false);
  assert.equal(ledgerAmountRangeMatches(null, 1000, 2000), false);
  assert.equal(ledgerAmountRangeMatches(undefined, 1000, 2000), false);
});

test('a range returns exactly the entries inside it, in date order', () => {
  const ids = (min, max) => searchLedgerByAmountRange(ledger(), min, max).map((tx) => tx.id);
  // Rs 1,000–Rs 2,000: t2, t3, t4 (paisa inside the range), t5, t7
  // (voided — still a listed entry), t8 (undated, last).
  assert.deepEqual(ids(1000, 2000), ['t2', 't3', 't4', 't5', 't7', 't8']);
  assert.deepEqual(ids('Rs 1,000', 'Rs 2,000'), ['t2', 't3', 't4', 't5', 't7', 't8']);
  // Backwards typing reads as the same interval.
  assert.deepEqual(ids(2000, 1000), ['t2', 't3', 't4', 't5', 't7', 't8']);
  // One open side.
  assert.deepEqual(ids(2000, ''), ['t5', 't6', 't7']);
  assert.deepEqual(ids('', 1000), ['t1', 't2']);
  // A single amount: only that amount, in date order.
  assert.deepEqual(ids(2000, 2000), ['t5', 't7']);
  // Nothing in range.
  assert.deepEqual(ids(3000, 4000), []);
  // No usable bound: the whole list, in its original order.
  assert.deepEqual(ids('', ''), ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']);
  assert.deepEqual(ids('abc', ''), ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']);
  assert.deepEqual(searchLedgerByAmountRange(null, 1000, 2000), []);
  assert.deepEqual(searchLedgerByAmountRange('not-a-list', 1000, 2000), []);
});

test('the search sorts by date, oldest first, undated last — and never mutates', () => {
  const list = [
    entry('a', 1500, '2026-11-05'),
    entry('b', 1500, '2026-11-01'),
    entry('c', 1500, ''),
    entry('d', 1500, '2026-11-03'),
  ];
  const before = JSON.stringify(list);
  const result = searchLedgerByAmountRange(list, 1000, 2000);
  assert.deepEqual(result.map((tx) => tx.id), ['b', 'd', 'a', 'c']);
  assert.equal(JSON.stringify(list), before);
  assert.notEqual(result, list);
  // Equal dates keep their list order.
  const tied = [
    entry('x', 1500, '2026-11-02'),
    entry('y', 1500, '2026-11-02'),
  ];
  assert.deepEqual(searchLedgerByAmountRange(tied, 1000, 2000).map((tx) => tx.id), ['x', 'y']);
});

test('the summary counts and totals the matches — voided rows count for neither', () => {
  const matches = searchLedgerByAmountRange(ledger(), 1000, 2000);
  // t2 1000 + t3 1500 + t4 1500.5 + t5 2000 + t8 1200 = 7200.5; t7
  // (voided, 2000) is listed but counts for neither.
  assert.deepEqual(ledgerAmountRangeSummary(matches), { count: 5, total: 7200.5 });
  assert.deepEqual(ledgerAmountRangeSummary([]), { count: 0, total: 0 });
  assert.deepEqual(ledgerAmountRangeSummary(null), { count: 0, total: 0 });
  // A voided-only list has no count and no total.
  assert.deepEqual(
    ledgerAmountRangeSummary([entry('v', 2000, '2026-11-07', 'Customer G', 'Cash', { voided: true })]),
    { count: 0, total: 0 },
  );
  // A non-numeric amount contributes nothing to the total.
  assert.deepEqual(
    ledgerAmountRangeSummary([entry('n', 'abc', '2026-11-02'), entry('m', 1000, '2026-11-02')]),
    { count: 2, total: 1000 },
  );
});

test('money is PKR only: Rs bounds, PKR total, whole rupees', () => {
  assert.equal(formatLedgerRupees(1000), 'Rs 1,000');
  assert.equal(formatLedgerRupees(1500.5), 'Rs 1,501');
  assert.equal(formatLedgerRupees(0), 'Rs 0');
  assert.equal(formatLedgerPkrTotal(7200.5), 'PKR 7,201');
  assert.equal(formatLedgerPkrTotal(4500), 'PKR 4,500');
  assert.equal(ledgerAmountRangeText(1000, 2000), 'Rs 1,000 – Rs 2,000');
  assert.equal(ledgerAmountRangeText(1000, ''), 'Rs 1,000 and above');
  assert.equal(ledgerAmountRangeText('', 2000), 'Up to Rs 2,000');
  assert.equal(ledgerAmountRangeText('', ''), '');
});

test('the range line shows the range, the count, and the total', () => {
  const matches = searchLedgerByAmountRange(ledger(), 1000, 2000);
  assert.equal(
    ledgerAmountRangeSummaryText(matches, 1000, 2000),
    'Rs 1,000 – Rs 2,000: 5 entries · PKR 7,201 total',
  );
  assert.equal(
    ledgerAmountRangeSummaryText(searchLedgerByAmountRange(ledger(), 2000, ''), 2000, ''),
    'Rs 2,000 and above: 2 entries · PKR 4,500 total',
  );
  assert.equal(
    ledgerAmountRangeSummaryText(searchLedgerByAmountRange(ledger(), '', 1000), '', 1000),
    'Up to Rs 1,000: 2 entries · PKR 1,500 total',
  );
  // One entry reads as "entry", and an empty range reads 0.
  const one = searchLedgerByAmountRange(ledger(), 500, 500);
  assert.equal(ledgerAmountRangeSummaryText(one, 500, 500), 'Rs 500 – Rs 500: 1 entry · PKR 500 total');
  assert.equal(
    ledgerAmountRangeSummaryText(searchLedgerByAmountRange(ledger(), 3000, 4000), 3000, 4000),
    'Rs 3,000 – Rs 4,000: 0 entries · PKR 0 total',
  );
});

test('an empty range says so plainly', () => {
  assert.equal(ledgerAmountRangeEmptyText(1000, 2000), 'No entries between Rs 1,000 and Rs 2,000.');
  assert.equal(ledgerAmountRangeEmptyText(1000, ''), 'No entries of Rs 1,000 or more.');
  assert.equal(ledgerAmountRangeEmptyText('', 2000), 'No entries up to Rs 2,000.');
  assert.equal(ledgerAmountRangeEmptyText('', ''), 'No recorded payments match these filters.');
  assert.equal(ledgerAmountRangeEmptyText(2000, 1000), 'No entries between Rs 1,000 and Rs 2,000.');
});

test('wiring: the Transactions screen imports the range search and filters the list', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './ledger-amount-range.js'"), 'app imports the Plan 453 module');
  assert.ok(app.includes('normalizeLedgerAmountRange'), 'app normalizes the typed range');
  assert.ok(app.includes('searchLedgerByAmountRange(transactions'), 'the range filters the ledger list');
  assert.ok(app.includes('ledgerAmountRangeSummaryText'), 'the range line is shown');
  assert.ok(app.includes('ledgerAmountRangeEmptyText'), 'an empty range says so plainly');
  assert.ok(app.includes("$('#transactionAmountMin')"), 'min input is read');
  assert.ok(app.includes("$('#transactionAmountMax')"), 'max input is read');
  assert.ok(app.includes("transactionAmountMin = '';"), 'clearing the filters clears the min');
  assert.ok(app.includes("transactionAmountMax = '';"), 'clearing the filters clears the max');
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="transactionAmountMin"'), 'min input exists on the Transactions screen');
  assert.ok(page.includes('id="transactionAmountMax"'), 'max input exists on the Transactions screen');
  assert.ok(page.includes('id="larRangeSummary"'), 'range summary line exists in the summary bar');
  assert.ok(page.includes('Amount from (Rs)'), 'min label is in rupees');
  assert.ok(page.includes('Amount to (Rs)'), 'max label is in rupees');
});

test('the new module names no fenced module file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../ledger-amount-range.js', import.meta.url), 'utf8');
  for (const fenced of [
    'payments-list.js',
    'history-amount-search.js',
    'full-history-list.js',
    'history-type-filter.js',
    'history-date-range-filter.js',
    'history-method-filter.js',
    'form-validation.js',
    'nav-customer-search.js',
    'customer-id-lookup.js',
    'customer-status-filter.js',
    'core.js',
  ]) {
    assert.equal(module.includes(fenced), false, `module must not name ${fenced}`);
  }
  assert.equal(module.includes('localStorage'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches pure function calls, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});
