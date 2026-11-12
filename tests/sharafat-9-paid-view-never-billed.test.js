// Sharafat 9 — Quick Collect "Paid" view lists never-billed
// customers as paid-up.
//
// The Paid pool used to keep every customer with zero dues, which
// included customers with no bill at all and free connections —
// they were never "paid up", they were never billed. The pool is
// now only customers with at least one bill who are settled in
// full; the never-billed customers are excluded, with a count, and
// the paid-empty state's "Everyone still has a bill to collect"
// claim (false whenever a never-billed customer exists) is gone.
//
// Fixture data only — pattern-fake phones (0301234567n family), no
// real customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveBillMonth, addPayment } from '../core.js';
import {
  getPendingCollectionCustomers,
  renderQuickCollectPickerHtml,
  countNeverBilledCustomers,
} from '../nav-quick-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const wiringSrc = read('nav-quick-collect.js');
const stylesSrc = read('styles.css');

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7);

// Three customers with dues (a 2000, b 3000, c 1500), one settled
// in full (d paid 1000 of 1000), one with no bill at all (e), one
// free connection with no bills (f), and one free connection that
// carries a settled bill from before it went free (g).
function billedState() {
  const customer = (id, n, name, extra = {}) => ({
    id, customerNumber: n, name, phone: `0301234567${n}`, archived: false, bills: [], ...extra,
  });
  let s = {
    customers: [
      customer('a', 1, 'Ali One', { mohalla: 'BANII' }),
      customer('b', 2, 'Bilal Two', { mohalla: 'BANII' }),
      customer('c', 3, 'Chanda Three', { mohalla: 'GANGALL' }),
      customer('d', 4, 'Danish Four', { mohalla: 'BANII' }),
      customer('e', 5, 'Esha Five', { area: 'GANGALL' }),
      customer('f', 6, 'Free Six', { isFreeConnection: true }),
      customer('g', 7, 'Free Seven', { isFreeConnection: true }),
    ],
  };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 1500, status: 'pending' });
  s = saveBillMonth(s, 'd', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'd', month, { date: `${month}-01`, amount: 1000, method: 'Cash' });
  s = saveBillMonth(s, 'g', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'g', month, { date: `${month}-01`, amount: 1000, method: 'Cash' });
  return s;
}

function ids(list) {
  return list.map((entry) => entry.id).sort();
}

// --- Behaviour: the Paid pool ---

test('paid pool contains only customers with at least one bill who are settled in full', () => {
  const paid = getPendingCollectionCustomers(billedState(), '', 'paid');
  assert.deepEqual(ids(paid), ['d']);
  for (const entry of paid) assert.equal(entry.totalDues, 0);
});

test('a customer with no bill at all is excluded from paid', () => {
  const paid = getPendingCollectionCustomers(billedState(), '', 'paid');
  assert.ok(!ids(paid).includes('e'), 'a never-billed customer is not paid-up');
});

test('a free connection is excluded from paid, with or without settled bills', () => {
  const paid = getPendingCollectionCustomers(billedState(), '', 'paid');
  assert.ok(!ids(paid).includes('f'), 'a free connection with no bills is not paid-up');
  assert.ok(!ids(paid).includes('g'), 'a free connection is not paid-up even with settled bills');
});

test('never-billed count counts every customer with no bill at all, archived excluded', () => {
  const state = billedState();
  assert.equal(countNeverBilledCustomers(state), 2, 'e and f have no bills; g has one');
  const withArchived = {
    customers: [...state.customers, {
      id: 'h', customerNumber: 8, name: 'Archived Eight', phone: '03012345678', archived: true, bills: [],
    }],
  };
  assert.equal(countNeverBilledCustomers(withArchived), 2, 'an archived no-bill customer is not counted');
  assert.equal(countNeverBilledCustomers(null), 0);
  assert.equal(countNeverBilledCustomers({ customers: [] }), 0);
});

test('unpaid and all pools are unchanged by the paid restriction', () => {
  const state = billedState();
  assert.deepEqual(ids(getPendingCollectionCustomers(state, '', 'all-dues')), ['a', 'b', 'c']);
  assert.deepEqual(ids(getPendingCollectionCustomers(state, '', 'high-dues')), ['a', 'b']);
  assert.deepEqual(ids(getPendingCollectionCustomers(state, '', 'all')), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
});

test('paid and unpaid no longer partition All: the never-billed customer is in neither pool', () => {
  const state = billedState();
  const paid = getPendingCollectionCustomers(state, '', 'paid');
  const unpaid = getPendingCollectionCustomers(state, '', 'all-dues');
  const all = getPendingCollectionCustomers(state, '', 'all');
  assert.deepEqual(ids(paid), ['d']);
  assert.deepEqual(ids(unpaid), ['a', 'b', 'c']);
  assert.equal(all.length, 7);
  for (const id of ['e', 'f', 'g']) {
    assert.ok(!ids(paid).includes(id) && !ids(unpaid).includes(id), `${id} is in neither pool`);
    assert.ok(ids(all).includes(id), `${id} stays visible under All`);
  }
});

// --- Behaviour: the picker renders the pool ---

test('picker renders the paid list without the never-billed customers, with the count note', () => {
  const state = billedState();
  const paid = renderQuickCollectPickerHtml(state, '', 'paid');
  assert.deepEqual(ids(paid.customers), ['d']);
  assert.ok(paid.html.includes('Danish Four'), 'paid list must show the settled customer');
  assert.ok(!paid.html.includes('Esha Five'), 'paid list must not show the no-bill customer');
  assert.ok(!paid.html.includes('Free Six'), 'paid list must not show the free connection');
  assert.ok(!paid.html.includes('Free Seven'), 'paid list must not show the free connection with settled bills');
  assert.ok(paid.html.includes('qc-paid-note'), 'the never-billed note must render above the paid list');
  assert.ok(paid.html.includes('2 customers have never been billed'), 'the note must count the excluded customers');
  assert.ok(paid.html.includes('not shown as paid-up'), 'the note must say why they are missing');
});

test('paid empty state no longer claims everyone has a bill to collect', () => {
  // Every billed customer has dues, so the paid pool is empty — but
  // one never-billed customer exists, which is exactly when the old
  // claim was false.
  const customer = (id, n, name, extra = {}) => ({
    id, customerNumber: n, name, phone: `0301234567${n}`, archived: false, bills: [], ...extra,
  });
  let s = {
    customers: [
      customer('a', 1, 'Ali One', { mohalla: 'BANII' }),
      customer('b', 2, 'Bilal Two', { mohalla: 'BANII' }),
      customer('e', 5, 'Esha Five', { area: 'GANGALL' }),
    ],
  };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  const paid = renderQuickCollectPickerHtml(s, '', 'paid');
  assert.deepEqual(paid.customers, []);
  assert.ok(paid.html.includes('No paid-up customers yet'), 'paid-empty heading must show');
  assert.ok(!paid.html.includes('Everyone still has a bill to collect'), 'the false claim must be gone');
  assert.ok(paid.html.includes('Nobody has a bill settled in full yet'), 'the honest line must show');
  assert.ok(paid.html.includes('1 customer has never been billed'), 'the singular count must ride along');
  assert.ok(paid.html.includes('data-qc-show-unpaid'), 'paid-empty state must offer the one-tap return to Unpaid');
});

test('no never-billed note renders when nobody is never-billed', () => {
  const customer = (id, n, name, extra = {}) => ({
    id, customerNumber: n, name, phone: `0301234567${n}`, archived: false, bills: [], ...extra,
  });
  let s = {
    customers: [
      customer('a', 1, 'Ali One', { mohalla: 'BANII' }),
      customer('d', 4, 'Danish Four', { mohalla: 'BANII' }),
    ],
  };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'd', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'd', month, { date: `${month}-01`, amount: 1000, method: 'Cash' });
  const paid = renderQuickCollectPickerHtml(s, '', 'paid');
  assert.deepEqual(ids(paid.customers), ['d']);
  assert.ok(!paid.html.includes('never been billed'), 'no note when there is nobody to count');
  assert.ok(!paid.html.includes('qc-paid-note'), 'no note element when there is nobody to count');
});

// --- Pins: wiring ---

test('paid filter excludes by bill count and free connection, and the note uses the muted token', () => {
  assert.ok(wiringSrc.includes("if (filterType === 'paid' && bills.length === 0) continue;"),
    'paid pool must skip customers with no bill at all');
  assert.ok(wiringSrc.includes("if (filterType === 'paid' && customer.isFreeConnection === true) continue;"),
    'paid pool must skip free connections');
  assert.ok(wiringSrc.includes('countNeverBilledCustomers'), 'the never-billed count helper must exist');
  const start = stylesSrc.indexOf('.qc-paid-note {');
  assert.ok(start >= 0, 'missing .qc-paid-note rule');
  const block = stylesSrc.slice(start, stylesSrc.indexOf('}', start));
  assert.ok(block.includes('var(--text-muted'), 'note must use the muted text token');
  // The only hex allowed is the token's existing fallback — the same
  // #64748b the empty state next to it already uses. No new colour.
  const hexes = [...block.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
  assert.deepEqual(hexes, ['#64748b'], 'the added rule must introduce no new hex colour');
});
