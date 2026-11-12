// QC-12 — Quick Collect search: a bill-status dropdown ABOVE the
// picker search (Unpaid / Paid / All). The user asked for dropdown
// filters above the search, easy to select, so the list of users
// whose bill is still outstanding shows at once. Verified at the
// QC-11 head 6b66cce8: the picker today has Pending / High Dues
// ≥ 2k / All as CHIPS BELOW the search (data-filter all-dues /
// high-dues / all, pool from getPendingCollectionCustomers) and no
// dropdown above the search, no explicit Paid-only view (Pending
// ≈ unpaid; All includes paid-up).
//
// One pool, two controls: the dropdown and the chips set the same
// picker pool, so they can never disagree. Unpaid is the pending
// pool (all-dues), Paid is its complement — customers with nothing
// outstanding (settled in full, or no bill yet) — All is everyone.
// The chips stay and keep working; when the pool is Paid no chip
// is active (chips are dues-based). Chip counts stay ledger-wide,
// as they are today. The name-prefix / last-four lookups under the
// search are untouched (query-driven, independent of the pool).
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

// --- Behaviour: dropdown <-> chip mapping ---

test('dropdown values map to the picker pool, with unknown values falling back to Unpaid', async () => {
  const mod = await import('../nav-quick-collect.js');
  assert.equal(typeof mod.qcStatusFilterFromDropdown, 'function', 'missing qcStatusFilterFromDropdown export');
  assert.equal(mod.qcStatusFilterFromDropdown('unpaid'), 'all-dues');
  assert.equal(mod.qcStatusFilterFromDropdown('paid'), 'paid');
  assert.equal(mod.qcStatusFilterFromDropdown('all'), 'all');
  for (const bad of ['', '  ', 'PENDING', 'dues', null, undefined]) {
    assert.equal(mod.qcStatusFilterFromDropdown(bad), 'all-dues', `expected all-dues fallback for ${String(bad)}`);
  }
});

test('chip filters map back to the dropdown value, so the two controls never disagree', async () => {
  const mod = await import('../nav-quick-collect.js');
  assert.equal(typeof mod.qcStatusFilterForChip, 'function', 'missing qcStatusFilterForChip export');
  assert.equal(mod.qcStatusFilterForChip('all-dues'), 'unpaid');
  assert.equal(mod.qcStatusFilterForChip('high-dues'), 'unpaid');
  assert.equal(mod.qcStatusFilterForChip('all'), 'all');
  assert.equal(mod.qcStatusFilterForChip('paid'), 'paid');
  assert.equal(mod.qcStatusFilterForChip('bogus'), 'unpaid');
});

// --- Pins: the dropdown in the picker ---

test('dropdown sits directly above the search, inside the picker step, default Unpaid', () => {
  const step = html.indexOf('id="quickCollectStepPick"');
  assert.ok(step >= 0, 'missing picker step');
  const selectTags = [...html.matchAll(/<select[^>]*>/g)].map((m) => m[0]);
  const selectTag = selectTags.find((tag) => tag.includes('data-qc-status-filter'));
  assert.ok(selectTag, 'missing status-filter select');
  const selectIdx = html.indexOf(selectTag);
  assert.ok(selectIdx > step, 'dropdown must sit inside the picker step');
  const search = html.indexOf('id="quickCollectSearchInput"');
  assert.ok(selectIdx < search, 'dropdown must sit ABOVE the search input');
  assert.ok(!/id="/.test(selectTag), 'dropdown must be class/data-attribute wired — no new element id');
  assert.ok(html.includes('value="unpaid" selected'), 'Unpaid must be the selected default');
  for (const value of ['unpaid', 'paid', 'all']) {
    assert.ok(html.includes(`value="${value}"`), `missing dropdown option ${value}`);
  }
  const label = html.indexOf('qc12_status_label');
  assert.ok(label > step && label < search, 'dropdown label must sit above the search too');
});

test('chips still render below the search, and the mohalla select still sits below them', () => {
  const search = html.indexOf('id="quickCollectSearchInput"');
  const pills = html.indexOf('class="qc-filter-pills"');
  assert.ok(pills > search, 'filter pills must stay below the search');
  for (const filter of ['all-dues', 'high-dues', 'all']) {
    assert.ok(html.includes(`data-filter="${filter}"`), `missing chip ${filter}`);
  }
  const mohalla = html.indexOf('id="mhfMohallaFilter"');
  assert.ok(mohalla > pills, 'mohalla select must stay below the chips');
});

test('picker still opens on the pending view by default', () => {
  assert.ok(wiringSrc.includes("setFilter('all-dues')"), 'opening the picker must still default to the pending pool');
});

// --- Pins: wiring ---

test('dropdown change sets the same pool the chips set, and setFilter keeps the dropdown in sync', () => {
  assert.ok(wiringSrc.includes("querySelector('[data-qc-status-filter]')"), 'missing class-found lookup for the dropdown');
  assert.ok(wiringSrc.includes('qcStatusFilterFromDropdown('), 'dropdown change must map its value to the picker pool');
  assert.ok(wiringSrc.includes('qcStatusFilterForChip(activeFilter)'), 'setFilter must sync the dropdown to the active pool');
  assert.ok(wiringSrc.includes("addEventListener('change'"), 'dropdown must listen for change');
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

test('status-filter row is a full-width flex row, no new hex in the added rules', () => {
  const start = stylesSrc.indexOf('.qsf-status-filter-row {');
  assert.ok(start >= 0, 'missing .qsf-status-filter-row rule');
  const block = stylesSrc.slice(start, stylesSrc.indexOf('}', start));
  assert.ok(block.includes('display: flex'), 'row must be flex (label + select side by side)');
  assert.ok(block.includes('width: 100%') || stylesSrc.includes('.qsf-status-filter-row,'),
    'row must be full width at 360px (own rule or the 620px media-query list)');
  const added = stylesSrc.slice(start, stylesSrc.indexOf('/* Plan 440', start));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(added), 'added QC-12 rules must introduce no new hex colour');
});
