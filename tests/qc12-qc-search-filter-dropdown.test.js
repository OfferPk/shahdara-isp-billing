// QC-12 — Quick Collect search: the bill-status dropdown ABOVE the
// picker search (Unpaid / Paid / All) is RETIRED by the QC True
// 1-Row Tightening (item A, user instruction 2026-11-14). The
// dropdown was the ONLY control reaching the paid pool, so the
// merge keeps the function: the filter chips below the search are
// now the only status control, with a 4th pill 'Paid' reaching the
// paid pool (setFilter already accepts 'paid'). The "one pool, two
// controls" design is gone — one pool, one control (the chips).
// The pool behaviour itself is unchanged: Unpaid is the pending
// pool (all-dues), Paid is its complement — customers with at
// least one bill who are settled in full (Sharafat 9: never-billed
// customers are in neither pool) — All is everyone. Chip counts
// stay ledger-wide, as they are today, and the Paid pill shows its
// pool count like its three siblings. The name-prefix / last-four
// lookups under the search are untouched (query-driven,
// independent of the pool).
//
// Stylesheet-value approach (polish #17/#21/#25/#27 pattern): read
// the HTML/CSS/JS as text and assert the values; no browser needed.
// Fixture data only — pattern-fake phones (0301234567n family), no
// real customer data of any kind in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveBillMonth, addPayment } from '../core.js';
import {
  getPendingCollectionCustomers,
  renderQuickCollectPickerHtml,
} from '../nav-quick-collect.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const html = read('index.html');
const wiringSrc = read('nav-quick-collect.js');
const stylesSrc = read('styles.css');
const en = TRANSLATIONS.en;
const ur = TRANSLATIONS.ur;

const URDU = /[\u0600-\u06FF]/;
const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7);

// A billed state: three customers with dues (a 2000, b 3000,
// c 1500), one settled in full (d paid 1000 of 1000), one with no
// bill at all (e — nothing outstanding).
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
    ],
  };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 1500, status: 'pending' });
  s = saveBillMonth(s, 'd', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'd', month, { date: `${month}-01`, amount: 1000, method: 'Cash' });
  return s;
}

function ids(list) {
  return list.map((entry) => entry.id).sort();
}

// --- Behaviour: the Paid pool ---
// Sharafat 9: the Paid pool is only customers with at least one bill
// who are settled in full. The tests below moved with that behaviour:
// the no-bill customer (e) is no longer in the pool, and Paid and
// Unpaid no longer partition All — a never-billed customer is in
// neither pool, and stays visible under All.

test('paid pool returns exactly the settled customers, never one with dues or no bill', () => {
  const paid = getPendingCollectionCustomers(billedState(), '', 'paid');
  assert.deepEqual(ids(paid), ['d']);
  for (const entry of paid) assert.equal(entry.totalDues, 0);
});

test('paid and unpaid no longer partition All: the never-billed customer is in neither pool', () => {
  const state = billedState();
  const paid = getPendingCollectionCustomers(state, '', 'paid');
  const unpaid = getPendingCollectionCustomers(state, '', 'all-dues');
  const all = getPendingCollectionCustomers(state, '', 'all');
  assert.deepEqual(ids(paid), ['d']);
  assert.deepEqual(ids(unpaid), ['a', 'b', 'c']);
  assert.deepEqual(ids(all), ['a', 'b', 'c', 'd', 'e']);
  assert.ok(!ids(paid).includes('e') && !ids(unpaid).includes('e'), 'the no-bill customer is in neither pool');
  assert.equal(new Set([...ids(paid), ...ids(unpaid)]).size, all.length - 1);
});

test('unpaid pool is unchanged: all-dues, high-dues and all return what they returned before', () => {
  const state = billedState();
  assert.deepEqual(ids(getPendingCollectionCustomers(state, '', 'all-dues')), ['a', 'b', 'c']);
  assert.deepEqual(ids(getPendingCollectionCustomers(state, '', 'high-dues')), ['a', 'b']);
  assert.deepEqual(ids(getPendingCollectionCustomers(state, '', 'all')), ['a', 'b', 'c', 'd', 'e']);
});

test('search query narrows the paid pool too', () => {
  const state = billedState();
  assert.deepEqual(ids(getPendingCollectionCustomers(state, 'Danish', 'paid')), ['d']);
  assert.deepEqual(ids(getPendingCollectionCustomers(state, 'Ali', 'paid')), []);
  // Sharafat 9: Esha has no bill at all, so she is no longer in the
  // paid pool — searching for her there finds nobody.
  assert.deepEqual(ids(getPendingCollectionCustomers(state, 'Esha', 'paid')), []);
});

// --- Behaviour: the picker renders the pool ---

test('picker renders the paid list, and switching back to unpaid restores the pending list', () => {
  const state = billedState();
  const paid = renderQuickCollectPickerHtml(state, '', 'paid');
  // Sharafat 9: the no-bill customer is no longer in the paid list;
  // the view says so, with a count, instead of showing her as paid-up.
  assert.deepEqual(ids(paid.customers), ['d']);
  assert.ok(paid.html.includes('Danish Four'), 'paid list must show the settled customer');
  assert.ok(!paid.html.includes('Esha Five'), 'paid list must not show the no-bill customer');
  assert.ok(paid.html.includes('1 customer has never been billed'), 'paid list must count the excluded customer');
  assert.ok(!paid.html.includes('Ali One'), 'paid list must not show a customer with dues');
  const unpaid = renderQuickCollectPickerHtml(state, '', 'all-dues');
  assert.deepEqual(ids(unpaid.customers), ['a', 'b', 'c']);
  assert.ok(!unpaid.html.includes('Danish Four'), 'unpaid list must not show the settled customer');
});

test('paid empty state: nobody paid up yet shows the paid message, never the all-collected celebration', () => {
  // A fresh state where every customer has dues, so the paid pool is empty.
  const customer = (id, n, name, extra = {}) => ({
    id, customerNumber: n, name, phone: `0301234567${n}`, archived: false, bills: [], ...extra,
  });
  let s = {
    customers: [
      customer('a', 1, 'Ali One', { mohalla: 'BANII' }),
      customer('b', 2, 'Bilal Two', { mohalla: 'BANII' }),
      customer('c', 3, 'Chanda Three', { mohalla: 'GANGALL' }),
    ],
  };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 1500, status: 'pending' });
  const paid = renderQuickCollectPickerHtml(s, '', 'paid');
  assert.deepEqual(paid.customers, []);
  assert.ok(paid.html.includes('No paid-up customers yet'), 'paid-empty message must show');
  assert.ok(!paid.html.includes('Sab ka bill wusool ho gaya'), 'all-collected celebration must NOT show for the Paid view');
  assert.ok(paid.html.includes('data-qc-show-unpaid'), 'paid-empty state must offer the one-tap return to Unpaid');
  const unpaid = renderQuickCollectPickerHtml(s, '', 'all-dues');
  assert.ok(!unpaid.html.includes('No paid-up customers yet'), 'unpaid view must not show the paid-empty message');
});

test('all-collected celebration still shows for the unpaid view when nothing is pending', () => {
  // A fresh state where the only billed customer paid in full, plus
  // one customer with no bill at all.
  const customer = (id, n, name, extra = {}) => ({
    id, customerNumber: n, name, phone: `0301234567${n}`, archived: false, bills: [], ...extra,
  });
  let s = {
    customers: [
      // Both carry a package fee, so the "no package yet" setup
      // state never masks the all-collected state below.
      customer('d', 4, 'Danish Four', { mohalla: 'BANII', monthlySellingAmount: 1000 }),
      customer('e', 5, 'Esha Five', { area: 'GANGALL', monthlySellingAmount: 1000 }),
    ],
  };
  s = saveBillMonth(s, 'd', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'd', month, { date: `${month}-01`, amount: 1000, method: 'Cash' });
  const unpaid = renderQuickCollectPickerHtml(s, '', 'all-dues');
  assert.equal(unpaid.allCollected, true);
  assert.ok(unpaid.html.includes('Sab ka bill wusool ho gaya'));
  const paid = renderQuickCollectPickerHtml(s, '', 'paid');
  // Sharafat 9: the no-bill customer is no longer in the paid pool.
  assert.deepEqual(ids(paid.customers), ['d']);
  assert.ok(!paid.html.includes('Sab ka bill wusool ho gaya'));
});

// --- Behaviour: the mapping helpers are deleted, the Paid pill is the control ---

test('the QC-12 mapping helpers and constants are deleted with the dropdown', async () => {
  // QC True 1-Row Tightening (item A): the dropdown is gone, so
  // qcStatusFilterFromDropdown / qcStatusFilterForChip and the
  // QC_STATUS_FILTER_* constants go with it — there is nothing left
  // to map between. The pool itself is unchanged (the pool tests
  // above still pass), and the Paid pool is reached by the 4th
  // chip instead (data-filter="paid", setFilter already accepts it).
  const mod = await import('../nav-quick-collect.js');
  assert.equal(mod.qcStatusFilterFromDropdown, undefined, 'qcStatusFilterFromDropdown must be gone with the dropdown');
  assert.equal(mod.qcStatusFilterForChip, undefined, 'qcStatusFilterForChip must be gone with the dropdown');
  assert.equal(mod.QC_STATUS_FILTER_UNPAID, undefined, 'QC_STATUS_FILTER_UNPAID must be gone');
  assert.equal(mod.QC_STATUS_FILTER_PAID, undefined, 'QC_STATUS_FILTER_PAID must be gone');
  assert.equal(mod.QC_STATUS_FILTER_ALL, undefined, 'QC_STATUS_FILTER_ALL must be gone');
});

test('the Paid pill reaches the paid pool, with a live count like its siblings', () => {
  // The pill is the dropdown's replacement: same pool, same
  // counts. The count badge has an id (quickCollectPaidCount) and
  // the controller writes it in updateCounts, exactly like the
  // three older pills.
  assert.ok(html.includes('data-filter="paid"'), 'missing Paid pill');
  assert.ok(html.includes('id="quickCollectPaidCount"'), 'the Paid pill must carry its count badge id');
  assert.ok(wiringSrc.includes("getElementById('quickCollectPaidCount')"), 'the controller must look up the Paid count badge');
  assert.ok(wiringSrc.includes("getPendingCollectionCustomers(state, '', 'paid')"), 'the Paid count must come from the paid pool');
  assert.ok(wiringSrc.includes('paidCountEl.textContent = paid.length'), 'the Paid count must be written like the other three');
});

// --- Pins: the dropdown is gone, the Paid pill is the control ---

test('no Bill-status dropdown exists anywhere; the 4th pill Paid sits in the chips row', () => {
  // QC True 1-Row Tightening (item A): the dropdown is deleted —
  // no select, no label, no data attribute, no wiring reference.
  // The Paid pill (data-filter="paid") sits in the chips row below
  // the search, with its three siblings.
  assert.ok(!html.includes('data-qc-status-filter'), 'no status-filter select may remain in the page');
  assert.ok(!html.includes('qc12_status_label'), 'no Bill-status label may remain in the page');
  assert.ok(!wiringSrc.includes('data-qc-status-filter'), 'no status-filter lookup may remain in the controller');
  assert.ok(!wiringSrc.includes('qcStatusFilter'), 'no QC-12 mapping reference may remain in the controller');
  const search = html.indexOf('id="quickCollectSearchInput"');
  const pills = html.indexOf('class="qc-filter-pills"');
  assert.ok(pills > search, 'filter pills must stay below the search');
  for (const filter of ['all-dues', 'high-dues', 'all', 'paid']) {
    assert.ok(html.includes(`data-filter="${filter}"`), `missing chip ${filter}`);
  }
  const paidAt = html.indexOf('data-filter="paid"');
  assert.ok(paidAt > pills && paidAt < html.indexOf('</div>', pills), 'the Paid pill must sit inside the chips row');
});

test('chips still render below the search, and the mohalla select moved into the 2-column row above it', () => {
  // QC True 1-Row Tightening (item A): the Mohalla select moved
  // from its own row below the pills into the 2-column filter row
  // above the search, beside Sort by (same id + class, so its
  // wiring and the #1399 dues-first option order are untouched).
  const search = html.indexOf('id="quickCollectSearchInput"');
  const pills = html.indexOf('class="qc-filter-pills"');
  assert.ok(pills > search, 'filter pills must stay below the search');
  for (const filter of ['all-dues', 'high-dues', 'all', 'paid']) {
    assert.ok(html.includes(`data-filter="${filter}"`), `missing chip ${filter}`);
  }
  const mohalla = html.indexOf('id="mhfMohallaFilter"');
  assert.ok(mohalla > 0 && mohalla < search, 'mohalla select must sit above the search now, in the 2-column row');
  const row = html.indexOf('class="qc-filter-row-2col"');
  assert.ok(row > 0 && mohalla > row, 'mohalla select must sit inside the 2-column row wrapper');
  const sort = html.indexOf('data-qc-sort-order');
  assert.ok(sort > row && sort < mohalla, 'Sort by must sit first in the row, Mohalla second');
  assert.ok(!html.includes('mhf-mohalla-filter-row'), 'the mohalla select must not keep its own row wrapper');
});

test('picker still opens on the pending view by default', () => {
  assert.ok(wiringSrc.includes("setFilter('all-dues')"), 'opening the picker must still default to the pending pool');
});

// --- Pins: wiring ---

test('no dropdown wiring remains; the chips are the only status control', () => {
  // QC True 1-Row Tightening (item A): setFilter takes 'paid'
  // from the chips (the data-filter wiring below) — there is no
  // dropdown left to sync, and no mapping helper to call.
  assert.ok(!wiringSrc.includes("querySelector('[data-qc-status-filter]')"), 'no dropdown lookup may remain');
  assert.ok(!wiringSrc.includes('qcStatusFilterFromDropdown'), 'no dropdown-to-pool mapping may remain');
  assert.ok(!wiringSrc.includes('qcStatusFilterForChip'), 'no chip-to-dropdown mapping may remain');
  assert.ok(wiringSrc.includes("setFilter('all-dues')"), 'opening the picker must still default to the pending pool');
  assert.ok(wiringSrc.includes('data-qc-show-unpaid'), 'paid-empty state must offer a one-tap return to Unpaid');
});

// --- Pins: i18n ---

test('qc12_ keys exist in EN and UR, with Urdu script in the Urdu values', () => {
  assert.equal(en.qc12_status_label, 'Bill status');
  assert.equal(en.qc12_status_unpaid, 'Unpaid');
  assert.equal(en.qc12_status_paid, 'Paid');
  assert.equal(en.qc12_status_all, 'All');
  for (const key of ['qc12_status_label', 'qc12_status_unpaid', 'qc12_status_paid', 'qc12_status_all']) {
    assert.ok(typeof ur[key] === 'string' && ur[key].length > 0, `missing UR value for ${key}`);
    assert.ok(URDU.test(ur[key]), `UR value for ${key} must carry Urdu script`);
  }
});

// --- Pins: CSS ---

test('the 2-column row holds Sort + Mohalla as bare selects, no labels, no new hex', () => {
  // QC True 1-Row Tightening (item A): the labels above the
  // selects are gone (each select keeps its aria-label) — the row
  // is just the two selects side by side. The label rules are
  // deleted with them, and the added rules introduce no new hex.
  const row = stylesSrc.indexOf('.qc-filter-row-2col {');
  assert.ok(row >= 0, 'missing .qc-filter-row-2col rule');
  const block = stylesSrc.slice(row, stylesSrc.indexOf('}', row));
  assert.ok(block.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'), 'the filter row must be two equal columns');
  assert.ok(!stylesSrc.includes('.qsf-status-filter-label {'), 'no filter-label rule may remain');
  assert.ok(!stylesSrc.includes('.qc-filter-row-2col .qsf-status-filter-label {'), 'no 2-column label rule may remain');
  assert.ok(!stylesSrc.includes('.mhf-mohalla-filter-row {'), 'no mohalla row rule may remain');
  const added = stylesSrc.slice(row, stylesSrc.indexOf('/* QC Cash Modal Overhaul — Bulk Collect', row));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(added), 'added 1-Row rules must introduce no new hex colour');
});
