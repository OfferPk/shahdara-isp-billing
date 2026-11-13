// Sharafat 10 — One damaged customer record can break the whole
// Quick Collect picker.
//
// A nameless customer throws the picker the moment the operator
// searches (`customer.name.toLowerCase()` with no guard); a payment
// without a date (or without an id) throws the payment sort; a
// missing customer number makes the final sort return NaN and
// silently scrambles the order. Worse, the allocation engine runs
// before the picker loop and sorts payments by date with no guard
// of its own — so a dateless payment throws before the loop ever
// runs. Parent decision (2026-11-13): damaged records are SKIPPED
// from the picker pool, never sorted last, never thrown — and the
// picker surfaces how many it skipped (Sharafat 9's count+note
// precedent).
//
// Out of scope, stated not silent: a bill with no month still throws
// in the engine and in the pool loop's month sort (:421) — that sort
// is the same crash class but not fixed in this PR (flagged in the PR
// body). getCustomerPaymentDefaults still sorts the same way when the
// operator OPENS a damaged customer (:617/:677) — that is the payment
// screen's own crash class, not the picker's.
//
// Fixture data only — pattern-fake phones (0301234567n family), no
// real customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getPendingCollectionCustomers,
  renderQuickCollectPickerHtml,
  countSkippedDamagedCustomers,
} from '../nav-quick-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const wiringSrc = read('nav-quick-collect.js');

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7);

// A healthy customer with one priced bill for `month` (dues = amount).
function healthy(id, n, name, dueAmount, extra = {}) {
  return {
    id, customerNumber: n, name, phone: `0301234567${n}`, archived: false,
    bills: [{ month, dueAmount, status: 'pending', payments: [] }],
    ...extra,
  };
}

function ids(list) {
  return list.map((entry) => entry.id);
}

// One damaged record of each class, plus two healthy customers.
function damagedState() {
  const nameless = healthy('x-name', 9, null, 2000);
  const dateless = healthy('x-date', 10, 'Dateless Ten', 2000);
  dateless.bills[0].payments = [{ id: 'p-dateless', amount: 500, method: 'Cash' }];
  const idless = healthy('x-id', 11, 'Idless Eleven', 2000);
  idless.bills[0].payments = [{ date: `${month}-01`, amount: 500, method: 'Cash' }];
  const numberless = healthy('x-num', undefined, 'Numberless Thirteen', 3000);
  delete numberless.customerNumber;
  return {
    customers: [
      healthy('a', 2, 'Ali One', 2000),
      healthy('b', 5, 'Bilal Two', 2000),
      nameless,
      dateless,
      idless,
      numberless,
    ],
  };
}

// --- Behaviour: the pool skips damaged records, never throws ---

test('pool with a nameless customer returns the healthy list without throwing', () => {
  assert.deepEqual(ids(getPendingCollectionCustomers(damagedState(), '', 'all')), ['a', 'b']);
  assert.deepEqual(ids(getPendingCollectionCustomers(damagedState(), '', 'all-dues')), ['a', 'b']);
});

test('pool with a nameless customer still searches — the name guard only fires with a query', () => {
  // The :485 throw only fires when the operator types a search, so a
  // query-less test would leave it untested.
  const found = getPendingCollectionCustomers(damagedState(), 'ali', 'all');
  assert.deepEqual(ids(found), ['a']);
});

test('pool with a payment without a date returns the healthy list without throwing', () => {
  const state = { customers: [healthy('a', 1, 'Ali One', 2000), damagedState().customers[3]] };
  assert.deepEqual(ids(getPendingCollectionCustomers(state, '', 'all')), ['a']);
});

test('pool with a payment without an id returns the healthy list without throwing', () => {
  const state = { customers: [healthy('a', 1, 'Ali One', 2000), damagedState().customers[4]] };
  assert.deepEqual(ids(getPendingCollectionCustomers(state, '', 'all')), ['a']);
});

test('pool with a numberless customer returns the healthy list in number order, not NaN order', () => {
  // A missing number makes the final sort return NaN — silent order
  // corruption, not a throw — so this pins the ORDER, not just no-throw.
  // Both healthy customers owe the same 2000, so number asc decides.
  const pool = getPendingCollectionCustomers(damagedState(), '', 'all');
  assert.deepEqual(ids(pool), ['a', 'b']);
  assert.ok(pool[0].customerNumber < pool[1].customerNumber, 'equal dues must sort by customer number ascending');
});

test('blank and whitespace-only names count as nameless', () => {
  const state = {
    customers: [
      healthy('a', 1, 'Ali One', 2000),
      healthy('x-blank', 2, '', 2000),
      healthy('x-space', 3, '   ', 2000),
    ],
  };
  assert.deepEqual(ids(getPendingCollectionCustomers(state, '', 'all')), ['a']);
  assert.equal(countSkippedDamagedCustomers(state), 2);
});

test('a damaged record is skipped from every filter type, not just all-dues', () => {
  const state = damagedState();
  for (const filterType of ['all-dues', 'high-dues', 'all', 'paid']) {
    const poolIds = ids(getPendingCollectionCustomers(state, '', filterType));
    for (const damagedId of ['x-name', 'x-date', 'x-id', 'x-num']) {
      assert.ok(!poolIds.includes(damagedId), `${damagedId} must not appear under ${filterType}`);
    }
  }
});

// --- Behaviour: the skipped count ---

test('skipped-damaged count counts one per damaged record, zero when the roster is clean', () => {
  assert.equal(countSkippedDamagedCustomers(damagedState()), 4, 'one nameless, one dateless, one id-less, one numberless');
  const clean = { customers: [healthy('a', 1, 'Ali One', 2000), healthy('b', 2, 'Bilal Two', 2000)] };
  assert.equal(countSkippedDamagedCustomers(clean), 0);
  assert.equal(countSkippedDamagedCustomers(null), 0);
  assert.equal(countSkippedDamagedCustomers({ customers: [] }), 0);
});

test('an archived damaged record is not counted — archiving already hides it', () => {
  const state = damagedState();
  const archivedDamaged = healthy('x-arch', 20, null, 2000, { archived: true });
  state.customers.push(archivedDamaged);
  assert.equal(countSkippedDamagedCustomers(state), 4, 'the archived nameless record adds nothing to the count');
});

// --- Behaviour: the picker renders the pool, with the count note ---

test('picker renders the healthy list with the skipped-damaged note', () => {
  const state = damagedState();
  const picked = renderQuickCollectPickerHtml(state, '', 'all-dues');
  assert.deepEqual(ids(picked.customers), ['a', 'b']);
  assert.ok(picked.html.includes('Ali One'), 'picker must show the healthy customer');
  assert.ok(picked.html.includes('Bilal Two'), 'picker must show the healthy customer');
  assert.ok(!picked.html.includes('Dateless Ten'), 'picker must not show the dateless-payment customer');
  assert.ok(!picked.html.includes('Idless Eleven'), 'picker must not show the id-less-payment customer');
  assert.ok(!picked.html.includes('Numberless Thirteen'), 'picker must not show the numberless customer');
  assert.ok(picked.html.includes('qc-paid-note'), 'the skipped-damaged note must render above the list');
  assert.ok(picked.html.includes('4 damaged customer records were skipped'), 'the note must count the excluded records');
  assert.ok(picked.html.includes('not shown in this list'), 'the note must say why they are missing');
});

test('picker shows the singular note for exactly one skipped record, and none when clean', () => {
  const one = { customers: [healthy('a', 1, 'Ali One', 2000), healthy('x-name', 9, null, 2000)] };
  const picked = renderQuickCollectPickerHtml(one, '', 'all-dues');
  assert.ok(picked.html.includes('1 damaged customer record was skipped'), 'the singular count must read right');
  const clean = { customers: [healthy('a', 1, 'Ali One', 2000)] };
  const cleanPicked = renderQuickCollectPickerHtml(clean, '', 'all-dues');
  assert.ok(!cleanPicked.html.includes('damaged customer record'), 'no note when nobody was skipped');
  assert.ok(!cleanPicked.html.includes('qc-paid-note'), 'no note element when nobody was skipped');
});

test('picker still surfaces the skipped count when the pool is empty', () => {
  // Every customer is damaged, so the pool is empty — the all-collected
  // empty state must still say records were skipped, not "all collected"
  // with no explanation.
  const state = { customers: [healthy('x-name', 9, null, 2000)] };
  const picked = renderQuickCollectPickerHtml(state, '', 'all-dues');
  assert.deepEqual(picked.customers, []);
  assert.ok(picked.html.includes('1 damaged customer record was skipped'), 'the note must ride along on the empty state');
});

test('skipped-damaged note does not render on a narrowed list, like the Sharafat 9 note', () => {
  const state = damagedState();
  const searched = renderQuickCollectPickerHtml(state, 'ali', 'all-dues');
  assert.ok(!searched.html.includes('damaged customer record'), 'a searched list must not carry the ledger-wide count');
});

// --- Pins: wiring ---

test('damaged records are skipped before the engine runs, and the render scores the healthy roster', () => {
  assert.ok(wiringSrc.includes('function isDamagedPickerCustomer(customer)'), 'the damage predicate must exist');
  assert.ok(wiringSrc.includes('export function countSkippedDamagedCustomers(state)'), 'the skipped count must be exported');
  assert.ok(wiringSrc.includes('calculatePaymentAllocations({ ...state, customers: healthyCustomers })'),
    'the pool must run allocations on the healthy roster only — the engine sorts by month/date with no guard');
  assert.ok(wiringSrc.includes('buildSmartDuesRecovery(healthyState, new Date())'),
    'the picker render must score the healthy roster — the scorer runs the same engine over its state');
  assert.ok(wiringSrc.includes('skippedDamagedNoteText(skippedDamaged)'), 'the render must surface the skipped count');
});
