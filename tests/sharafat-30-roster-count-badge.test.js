// Sharafat 30 — Roster count badge denominator is a search-only total,
// not the roster total.
//
// The badge in renderCustomers showed `${active.length}/${activeTotal}`
// where activeTotal was the SEARCH-only count, and its plain-number
// branch fired whenever the three checked filters were 'all' — even
// with a search typed, when the plain number was the search-match
// count, not the roster total. Parent decision: shape (a) — the
// denominator is the full active roster.
//
// Tests are source-scan tests in the established pattern
// (plan-f-runtime-performance.test.js `extractFunction`, Sharafat 29
// precedent): renderCustomers is unexported inside the app.js bundle
// and there is no jsdom anywhere in the repo, so the badge lines are
// asserted over the extracted function text. No customer fixtures —
// no numbers here are customer data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const app = read('app.js');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in app.js`);
  const next = source.indexOf('\nfunction ', start + 1);
  return next === -1 ? source.slice(start) : source.slice(start, next);
}

const renderCustomers = extractFunction(app, 'renderCustomers');

function badgeLine(source, id) {
  const line = source.split('\n').find(l => l.includes(`$('#${id}').textContent`));
  assert.ok(line, `#${id} assignment not found in renderCustomers`);
  return line;
}

function plainBranch(line) {
  const q = line.indexOf('?');
  assert.ok(q > 0, 'badge line is not a ternary');
  return line.slice(0, q);
}

// ---- the denominator ------------------------------------------------

test('Sharafat 30: activeTotal is the full active roster, not the search-only pool', () => {
  assert.ok(
    renderCustomers.includes('const activeTotal = countActiveCustomers(state.customers);'),
    'activeTotal must count the whole roster (countActiveCustomers(state.customers))'
  );
  assert.ok(
    !renderCustomers.includes('countActiveCustomers(searched)'),
    'the badge denominator must never be the search-only pool'
  );
});

test('Sharafat 30: archivedTotal is the full archived roster', () => {
  assert.ok(
    renderCustomers.includes('const archivedTotal = state.customers.filter(customer => customer.archived).length;'),
    'archivedTotal must count the whole archived roster'
  );
  assert.ok(
    !renderCustomers.includes('searched.filter(customer => customer.archived)'),
    'the archived denominator must never be the search-only pool'
  );
});

// ---- the plain branch (Lie 2: the condition, not just the denominator) ----

test('Sharafat 30: active badge shows the plain total only with no search typed', () => {
  // A search that happens to match every customer must still show the
  // fraction — otherwise the plain number is a search count wearing
  // the roster total's clothes. A denominator-only fix FAILS this test.
  const line = badgeLine(renderCustomers, 'customerCount');
  assert.ok(
    plainBranch(line).includes("customerQuery.trim() === ''"),
    'plain branch must require an empty query (list box or global query)'
  );
  assert.ok(
    line.includes('`${active.length}/${activeTotal}`'),
    'filtered view shows the fraction against the full roster'
  );
});

test('Sharafat 30: active badge shows the plain total only with no pill', () => {
  const line = badgeLine(renderCustomers, 'customerCount');
  assert.ok(
    plainBranch(line).includes("customerRosterPill === 'all'"),
    'plain branch must require no pill filter'
  );
});

test('Sharafat 30: active badge shows the plain total only when all three checked filters are all', () => {
  const line = badgeLine(renderCustomers, 'customerCount');
  const cond = plainBranch(line);
  assert.ok(cond.includes("selectedServiceFilter === 'all'"), 'service filter must be all');
  assert.ok(cond.includes("selectedBillingFilter === 'all'"), 'billing filter must be all');
  assert.ok(cond.includes("customerAreaFilter === 'all'"), 'area filter must be all');
  assert.ok(cond.includes('active.length === activeTotal'), 'plain branch still requires the counts to agree');
});

// ---- the archived badge twin ----------------------------------------

test('Sharafat 30: archived badge shows the plain total only when unfiltered, and never consults the pill', () => {
  const line = badgeLine(renderCustomers, 'archivedCustomerCount');
  const cond = plainBranch(line);
  assert.ok(cond.includes("customerQuery.trim() === ''"), 'archived plain branch must require an empty query');
  assert.ok(cond.includes("selectedServiceFilter === 'all'"), 'archived plain branch must require service all');
  assert.ok(cond.includes("selectedBillingFilter === 'all'"), 'archived plain branch must require billing all');
  assert.ok(cond.includes("customerAreaFilter === 'all'"), 'archived plain branch must require area all');
  assert.ok(cond.includes('archived.length === archivedTotal'), 'archived plain branch still requires the counts to agree');
  assert.ok(
    !line.includes('customerRosterPill'),
    'the archived panel is not pill-filtered, so its badge must never reference the pill'
  );
  assert.ok(
    line.includes('`${archived.length}/${archivedTotal}`'),
    'filtered archived view shows the fraction against the full archived roster'
  );
});

// ---- what must NOT change -------------------------------------------

test('Sharafat 30: the search-only pool still feeds the empty-search text (searched is not deleted)', () => {
  assert.ok(renderCustomers.includes('const searched ='), 'searched must survive — it feeds unifiedEmptyText');
  assert.ok(
    renderCustomers.includes('searched.length === 0'),
    'unifiedEmptyText still decides from the search-only pool'
  );
});

test('Sharafat 30: welcomeCount is unchanged — it already was the full active roster count', () => {
  assert.ok(
    renderCustomers.includes("$('#welcomeCount').textContent = countActiveCustomers(state.customers);"),
    'welcomeCount keeps its existing full-roster expression'
  );
});
