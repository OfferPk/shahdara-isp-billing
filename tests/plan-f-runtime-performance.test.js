// Plan F — Runtime performance: startup and list rendering.
//
// Tests are in the established style: pure helpers are tested
// directly, and app.js wiring is pinned by contract tests over
// the source text (app.js is a browser script, not a Node
// import). No test here claims a measured browser paint time —
// there is no browser in this environment — each test pins the
// mechanism that produces the cost: one index build per render
// instead of one roster scan per visible row.
// A PNG receipt lazy loader was built and measured, then
// reverted because it pushed dist to 26 files against the
// 25-file budget (see docs/performance.md); no lazy test is
// kept for code that does not ship.
//
// What is deliberately NOT claimed: aggregation (counts, totals,
// full-day header totals) still scans the filtered list, because
// shrinking it to the page would change the numbers on screen;
// the archived panel is still unbounded here, because how many
// rows a page holds is Plan Y's scope, not Plan F's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  indexCustomers,
  resolveTransactionCustomer,
  resolveVisibleTransactions,
} from '../list-rendering.js';
import { paginateRows } from '../form-validation.js';
import { PERF_BUDGET } from '../build.mjs';
import { fixtureCustomer, fixtureBill, fixturePayment } from './test-fixtures.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');
const perfDoc = read('docs/performance.md');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in app.js`);
  const next = source.indexOf('\nfunction ', start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

// A Map that counts .get() calls, so tests can prove lookup
// cost is proportional to the visible page, not the roster.
class CountingMap extends Map {
  constructor(entries) { super(entries); this.gets = 0; }
  get(key) { this.gets += 1; return super.get(key); }
}

function roster(size) {
  return Array.from({ length: size }, (_, i) => fixtureCustomer({
    id: `customer-${i}`,
    customerNumber: i + 1,
    name: `Customer ${i}`,
    bills: [fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: `pay-${i}` })] })],
  }));
}

function txFor(i) {
  return { customerId: `customer-${i}`, month: '2026-10', paymentId: `pay-${i}` };
}

// ---- indexCustomers ------------------------------------------------

test('indexCustomers of an empty roster is an empty map', () => {
  assert.equal(indexCustomers([]).size, 0);
  assert.equal(indexCustomers().size, 0);
});

test('indexCustomers keeps the first record for a duplicate id, like Array.find', () => {
  const first = fixtureCustomer({ id: 'dup', name: 'First' });
  const second = fixtureCustomer({ id: 'dup', name: 'Second' });
  const index = indexCustomers([first, second]);
  assert.equal(index.size, 1);
  assert.equal(index.get('dup'), first);
});

test('indexCustomers skips records with no id', () => {
  const index = indexCustomers([null, undefined, fixtureCustomer({ id: undefined }), fixtureCustomer({ id: null }), fixtureCustomer({ id: 'ok' })]);
  assert.equal(index.size, 1);
  assert.ok(index.has('ok'));
});

test('indexCustomers preserves record identity (no copies)', () => {
  const customer = fixtureCustomer({ id: 'one' });
  assert.equal(indexCustomers([customer]).get('one'), customer);
});

test('indexCustomers handles numeric ids', () => {
  const index = indexCustomers([fixtureCustomer({ id: 42 })]);
  assert.equal(index.get(42).id, 42);
});

test('indexCustomers does not mutate the input array', () => {
  const customers = roster(5);
  const snapshot = customers.map(c => c.id);
  indexCustomers(customers);
  assert.deepEqual(customers.map(c => c.id), snapshot);
});

test('indexCustomers over a 1000-customer roster finds the last customer', () => {
  const customers = roster(1000);
  const index = indexCustomers(customers);
  assert.equal(index.size, 1000);
  assert.equal(index.get('customer-999').name, 'Customer 999');
});

// ---- resolveTransactionCustomer -------------------------------------

test('resolveTransactionCustomer resolves customer, bill and payment', () => {
  const customers = roster(3);
  const index = indexCustomers(customers);
  const { customer, bill, payment } = resolveTransactionCustomer(txFor(1), index);
  assert.equal(customer.id, 'customer-1');
  assert.equal(bill.month, '2026-10');
  assert.equal(payment.id, 'pay-1');
});

test('resolveTransactionCustomer returns nulls for a missing customer', () => {
  const { customer, bill, payment } = resolveTransactionCustomer(txFor(9), indexCustomers(roster(3)));
  assert.equal(customer, null);
  assert.equal(bill, null);
  assert.equal(payment, null);
});

test('resolveTransactionCustomer returns the customer but null bill/payment for a missing bill month', () => {
  const customers = roster(2);
  const index = indexCustomers(customers);
  const { customer, bill, payment } = resolveTransactionCustomer({ customerId: 'customer-0', month: '2026-11', paymentId: 'pay-0' }, index);
  assert.equal(customer.id, 'customer-0');
  assert.equal(bill, null);
  assert.equal(payment, null);
});

test('resolveTransactionCustomer returns bill but null payment for a missing payment', () => {
  const customers = roster(2);
  const index = indexCustomers(customers);
  const { customer, bill, payment } = resolveTransactionCustomer({ customerId: 'customer-0', month: '2026-10', paymentId: 'nope' }, index);
  assert.equal(customer.id, 'customer-0');
  assert.equal(bill.month, '2026-10');
  assert.equal(payment, null);
});

test('resolveTransactionCustomer still resolves a voided payment', () => {
  const customer = fixtureCustomer({ id: 'v', bills: [fixtureBill({ month: '2026-10', payments: [fixturePayment({ id: 'void-1', voided: true })] })] });
  const index = indexCustomers([customer]);
  const { payment } = resolveTransactionCustomer({ customerId: 'v', month: '2026-10', paymentId: 'void-1' }, index);
  assert.equal(payment.voided, true);
});

test('resolveTransactionCustomer picks the first bill for a month', () => {
  const customer = fixtureCustomer({ id: 'm', bills: [fixtureBill({ month: '2026-10', dueAmount: 1000 }), fixtureBill({ month: '2026-10', dueAmount: 2000 })] });
  const index = indexCustomers([customer]);
  const { bill } = resolveTransactionCustomer({ customerId: 'm', month: '2026-10', paymentId: 'x' }, index);
  assert.equal(bill.dueAmount, 1000);
});

test('resolveTransactionCustomer returns nulls for a null transaction', () => {
  const { customer, bill, payment } = resolveTransactionCustomer(null, indexCustomers(roster(2)));
  assert.equal(customer, null);
  assert.equal(bill, null);
  assert.equal(payment, null);
});

test('resolveTransactionCustomer returns nulls for a null index', () => {
  const { customer, bill, payment } = resolveTransactionCustomer(txFor(0), null);
  assert.equal(customer, null);
  assert.equal(bill, null);
  assert.equal(payment, null);
});

test('resolving a visible page performs one index lookup per row, not one roster scan per row', () => {
  const counting = new CountingMap(indexCustomers(roster(1000)));
  const visible = Array.from({ length: 15 }, (_, i) => txFor(i));
  const resolved = resolveVisibleTransactions(visible, counting);
  assert.equal(resolved.length, 15);
  assert.equal(counting.gets, 15, 'lookups must equal visible rows, not roster size');
});

// ---- visible-page composition ----------------------------------------

test('paginate + index + resolve over 1000 customers resolves only the page', () => {
  const customers = roster(1000);
  const counting = new CountingMap(indexCustomers(customers));
  const paged = paginateRows(customers.map((_, i) => txFor(i)), 1, 15);
  assert.equal(paged.items.length, 15);
  const resolved = resolveVisibleTransactions(paged.items, counting);
  assert.equal(resolved.length, 15);
  assert.equal(counting.gets, 15);
  assert.equal(resolved[0].customer.id, 'customer-0');
  assert.equal(resolved[14].customer.id, 'customer-14');
});

test('page 2 of a 1000-customer roster resolves a different page with the same lookup count', () => {
  const customers = roster(1000);
  const counting = new CountingMap(indexCustomers(customers));
  const paged = paginateRows(customers.map((_, i) => txFor(i)), 2, 15);
  const resolved = resolveVisibleTransactions(paged.items, counting);
  assert.equal(resolved[0].customer.id, 'customer-15');
  assert.equal(counting.gets, 15);
});

test('resolveVisibleTransactions preserves order and length, including an empty page', () => {
  const index = indexCustomers(roster(5));
  const resolved = resolveVisibleTransactions([txFor(2), txFor(0), txFor(4)], index);
  assert.deepEqual(resolved.map(r => r.customer.id), ['customer-2', 'customer-0', 'customer-4']);
  assert.deepEqual(resolveVisibleTransactions([], index), []);
});

test('paginateRows "all" still composes, with lookups equal to the full list (not a cost claim)', () => {
  const customers = roster(10);
  const counting = new CountingMap(indexCustomers(customers));
  const paged = paginateRows(customers.map((_, i) => txFor(i)), 1, 'all');
  assert.equal(paged.items.length, 10);
  assert.equal(resolveVisibleTransactions(paged.items, counting).length, 10);
  assert.equal(counting.gets, 10);
});

// ---- app.js wiring contracts ------------------------------------------

test('png-receipt.js stays a static import: the lazy split was measured and reverted (see docs/performance.md)', () => {
  assert.match(app, /import\s*\{\s*generateReceiptPNG,\s*shareOrDownloadPng\s*\}\s*from\s*['"]\.\/png-receipt\.js\?v=/);
  // No lazy loader import: note "downloadPngReceipt" (the function
  // name) contains "loadPngReceipt" as a substring, so match the
  // import statement, not the bare word.
  assert.doesNotMatch(app, /import\s*\{[^}]*\bloadPngReceipt\b/);
  assert.doesNotMatch(app, /from\s*['"]\.\/lazy-receipt\.js['"]/);
});

test('downloadPngReceipt still generates and shares the PNG from the static import', () => {
  const fn = extractFunction(app, 'downloadPngReceipt');
  assert.match(fn, /await\s+generateReceiptPNG\(/);
  assert.match(fn, /await\s+shareOrDownloadPng\(/);
});

test('renderTransactions builds one customer index per render', () => {
  const fn = extractFunction(app, 'renderTransactions');
  assert.match(fn, /const\s+customerIndex\s*=\s*indexCustomers\(state\.customers\)/);
  assert.match(fn, /resolveTransactionCustomer\(transaction,\s*customerIndex\)/);
});

test('renderTransactions performs no roster scan per visible row', () => {
  const fn = extractFunction(app, 'renderTransactions');
  assert.doesNotMatch(fn, /state\.customers\.find\(/);
});

test('renderTransactions builds its rows from paged.items only', () => {
  const fn = extractFunction(app, 'renderTransactions');
  // Collect Tab polish: the row callback is the named renderFeedRow
  // now (the feed wraps it in day-group <details> accordions), so
  // the pin matches the named calls instead of the inline arrow.
  // The invariant is unchanged: rows are built from paged.items
  // only — the day groups come from groupByDay(paged.items) and the
  // flat path maps paged.items itself, never the full list. (The
  // full-list groupByDay(transactions) above is the day HEADER
  // totals, which must scan the full list — unchanged.)
  assert.match(fn, /groupByDay\(paged\.items\)/);
  assert.match(fn, /dayTxs\.map\(renderFeedRow\)/);
  assert.match(fn, /paged\.items\.map\(renderFeedRow\)/);
  assert.doesNotMatch(fn, /transactions\.map\(renderFeedRow\)/);
});

test('renderCustomers builds active cards from paged.items only', () => {
  const fn = extractFunction(app, 'renderCustomers');
  assert.match(fn, /paged\.items\.map\(customer\s*=>\s*customerCardMarkup/);
  assert.match(fn, /paged\.items\.map\(customer\s*=>\s*renderCustomerTableRowMarkup/);
});

test('app.js imports the list-rendering helpers', () => {
  assert.match(app, /import\s*\{\s*indexCustomers,\s*resolveTransactionCustomer\s*\}\s*from\s*['"]\.\/list-rendering\.js['"]/);
});

test('performance doc states the Plan Y boundary, the rejected allocation cache, and the reverted lazy split', () => {
  assert.match(perfDoc, /Plan Y/);
  assert.match(perfDoc, /archived/);
  assert.match(perfDoc, /allocation/i);
  assert.match(perfDoc, /reverted/);
  assert.match(perfDoc, /26 dist files/);
});

test('the first-load request budget is still 25, not loosened', () => {
  assert.equal(PERF_BUDGET.maxFirstLoadRequests, 25);
});

test('list-rendering.js exports exactly the helpers app.js uses', () => {
  const src = read('list-rendering.js');
  assert.match(src, /export function indexCustomers/);
  assert.match(src, /export function resolveTransactionCustomer/);
  assert.match(src, /export function resolveVisibleTransactions/);
});
