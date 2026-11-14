// Plan 446 — Quick Collect mohalla filter for the customer list:
// one mohalla filter on the picker — choose a mohalla, list only
// its customers with dues, in name order; clearing it returns the
// full list. It filters only and it changes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  quickCollectMohallaFilterKey,
  resolveQuickCollectMohallaFilter,
  quickCollectMohallaFilterMatches,
  filterQuickCollectByMohalla,
  quickCollectMohallaFilterSummaryText,
  quickCollectMohallaFilterOptionsHtml,
} from '../quick-collect-mohalla-filter.js';
import { DEFAULT_MOHALLAS } from '../phase3.js';
import { saveBillMonth, addPayment } from '../core.js';
import { renderQuickCollectPickerHtml } from '../nav-quick-collect.js';

const moduleSrc = readFileSync(new URL('../quick-collect-mohalla-filter.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7);
const MOHALLAS = ['BANII', 'GANGALL', 'KISHTII'];

// Picker-shaped entries, deliberately in dues order (not name
// order), so the name-order tests prove the re-sort.
function pickerEntries() {
  return [
    { id: 'CUST-2', name: 'Zara Nine', customerNumber: 2, mohalla: 'BANII', area: 'BANII', totalDues: 2000 },
    { id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'BANII', area: 'BANII', totalDues: 3000 },
    { id: 'CUST-3', name: 'Bilal Two', customerNumber: 3, mohalla: 'GANGALL', area: 'GANGALL', totalDues: 1500 },
    { id: 'CUST-4', name: 'Danish Four', customerNumber: 4, area: 'GANGALL', totalDues: 1000 },
    { id: 'CUST-5', name: 'Amina Five', customerNumber: 5, totalDues: 500 },
  ];
}

// A billed state: two mohallas with dues, one settled customer, and
// one customer recorded under the legacy area field only.
function billedState() {
  const customer = (id, n, name, extra = {}) => ({
    id, customerNumber: n, name, phone: `0301234567${n}`, archived: false, bills: [], ...extra,
  });
  let s = {
    customers: [
      customer('a', 9, 'Zara Nine', { mohalla: 'BANII' }),
      customer('b', 1, 'Ali One', { mohalla: 'BANII' }),
      customer('c', 2, 'Bilal Two', { mohalla: 'GANGALL' }),
      customer('d', 3, 'Chanda Three', { mohalla: 'BANII' }),
      customer('e', 4, 'Danish Four', { area: 'GANGALL' }),
    ],
  };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2000, status: 'pending' });
  s = saveBillMonth(s, 'b', { month, dueAmount: 3000, status: 'pending' });
  s = saveBillMonth(s, 'c', { month, dueAmount: 1500, status: 'pending' });
  s = saveBillMonth(s, 'd', { month, dueAmount: 1000, status: 'pending' });
  s = addPayment(s, 'd', month, { date: `${month}-01`, amount: 1000, method: 'Cash' });
  s = saveBillMonth(s, 'e', { month, dueAmount: 1000, status: 'pending' });
  return s;
}

// --- Key ---

test('key: a blank mohalla keys to empty, never to a guessed mohalla', () => {
  for (const bad of ['', '   ', null, undefined]) {
    assert.equal(quickCollectMohallaFilterKey(bad), '', `expected empty key for ${String(bad)}`);
  }
});

test('key: case, whitespace, and the leading Mohalla word fold away', () => {
  assert.equal(quickCollectMohallaFilterKey('BANII'), 'banii');
  assert.equal(quickCollectMohallaFilterKey('  banii  '), 'banii');
  assert.equal(quickCollectMohallaFilterKey('Mohalla Bani'), 'banii');
  assert.equal(quickCollectMohallaFilterKey('MOHALLA BANI'), 'banii');
  assert.equal(quickCollectMohallaFilterKey('Mohalaa Bani'), 'banii');
  assert.equal(quickCollectMohallaFilterKey('Pull   Side'), 'pull side');
});

test('key: old spellings fold into the canonical key', () => {
  assert.equal(quickCollectMohallaFilterKey('Bani'), 'banii');
  assert.equal(quickCollectMohallaFilterKey('Kishti'), 'kishtii');
  assert.equal(quickCollectMohallaFilterKey('Chamyaa'), 'chamyaaa');
  assert.equal(quickCollectMohallaFilterKey('KISHTII'), 'kishtii');
});

// --- Resolve ---

test('resolve: a variant spelling resolves to the list\'s own spelling', () => {
  assert.equal(resolveQuickCollectMohallaFilter('bani', MOHALLAS), 'BANII');
  assert.equal(resolveQuickCollectMohallaFilter('MOHALLA BANI', MOHALLAS), 'BANII');
  assert.equal(resolveQuickCollectMohallaFilter('gangall', MOHALLAS), 'GANGALL');
});

test('resolve: blank, unknown, or unusable values resolve to null', () => {
  for (const bad of ['', '   ', 'Nowhere', null, undefined]) {
    assert.equal(resolveQuickCollectMohallaFilter(bad, MOHALLAS), null, `expected null for ${String(bad)}`);
  }
  assert.equal(resolveQuickCollectMohallaFilter('BANII', null), null);
  assert.equal(resolveQuickCollectMohallaFilter('BANII', 'BANII'), null);
});

// --- Matches ---

test('matches: a blank mohalla passes every entry', () => {
  for (const entry of pickerEntries()) {
    assert.equal(quickCollectMohallaFilterMatches(entry, ''), true);
    assert.equal(quickCollectMohallaFilterMatches(entry, null), true);
  }
});

test('matches: mohalla first, then the legacy area field', () => {
  assert.equal(quickCollectMohallaFilterMatches({ mohalla: 'BANII' }, 'BANII'), true);
  assert.equal(quickCollectMohallaFilterMatches({ mohalla: 'BANII' }, 'GANGALL'), false);
  assert.equal(quickCollectMohallaFilterMatches({ area: 'GANGALL' }, 'GANGALL'), true);
  assert.equal(quickCollectMohallaFilterMatches({ area: 'GANGALL' }, 'BANII'), false);
  // The mohalla field wins when both are recorded and disagree.
  assert.equal(quickCollectMohallaFilterMatches({ mohalla: 'BANII', area: 'GANGALL' }, 'BANII'), true);
  assert.equal(quickCollectMohallaFilterMatches({ mohalla: 'BANII', area: 'GANGALL' }, 'GANGALL'), false);
  // Spelling variants match.
  assert.equal(quickCollectMohallaFilterMatches({ mohalla: 'Mohalla Bani' }, 'BANII'), true);
});

test('matches: an entry with no recorded mohalla never matches a chosen one', () => {
  assert.equal(quickCollectMohallaFilterMatches({ totalDues: 500 }, 'BANII'), false);
  assert.equal(quickCollectMohallaFilterMatches({ area: 'Unassigned' }, 'BANII'), false);
  assert.equal(quickCollectMohallaFilterMatches({ mohalla: '' }, 'BANII'), false);
  assert.equal(quickCollectMohallaFilterMatches(null, 'BANII'), false);
  assert.equal(quickCollectMohallaFilterMatches('BANII', 'BANII'), false);
});

// --- Filter ---

test('filter: choosing a mohalla lists exactly its customers, in name order', () => {
  const filtered = filterQuickCollectByMohalla(pickerEntries(), 'BANII');
  assert.deepEqual(filtered.map((e) => e.id), ['CUST-1', 'CUST-2']);
  assert.deepEqual(filterQuickCollectByMohalla(pickerEntries(), 'GANGALL').map((e) => e.id), ['CUST-3', 'CUST-4']);
});

test('filter: same name twice lists both, the lower customer number first', () => {
  const list = [
    { id: 'CUST-9', name: 'Ali Nine', customerNumber: 9, mohalla: 'BANII', totalDues: 100 },
    { id: 'CUST-7', name: 'Sara Seven', customerNumber: 7, mohalla: 'BANII', totalDues: 100 },
    { id: 'CUST-8', name: 'Ali Nine', customerNumber: 8, mohalla: 'BANII', totalDues: 100 },
  ];
  assert.deepEqual(filterQuickCollectByMohalla(list, 'BANII').map((e) => e.id), ['CUST-8', 'CUST-9', 'CUST-7']);
});

test('filter: clearing the filter returns the full list in its own order', () => {
  const entries = pickerEntries();
  for (const cleared of ['', '   ', null, undefined]) {
    assert.deepEqual(
      filterQuickCollectByMohalla(entries, cleared).map((e) => e.id),
      ['CUST-2', 'CUST-1', 'CUST-3', 'CUST-4', 'CUST-5'],
      `cleared filter must keep the picker's own order for ${String(cleared)}`,
    );
  }
});

test('filter: the input list is never mutated and the entries are fresh objects', () => {
  const entries = pickerEntries();
  const before = JSON.stringify(entries);
  const filtered = filterQuickCollectByMohalla(entries, 'BANII');
  assert.equal(JSON.stringify(entries), before);
  assert.notEqual(filtered[0], entries.find((e) => e.id === filtered[0].id));
  filtered[0].totalDues = 999999;
  assert.equal(JSON.stringify(entries), before);
});

test('filter: dues ride along unchanged, and it is not a dues filter', () => {
  const filtered = filterQuickCollectByMohalla(pickerEntries(), 'BANII');
  assert.deepEqual(filtered.map((e) => e.totalDues), [3000, 2000]);
  // A settled customer still appears when the caller lists them.
  const settled = [{ id: 'CUST-6', name: 'Sara Six', customerNumber: 6, mohalla: 'BANII', totalDues: 0 }];
  assert.deepEqual(filterQuickCollectByMohalla(settled, 'BANII').map((e) => e.id), ['CUST-6']);
});

test('filter: archived entries and entries without a usable id or name are skipped', () => {
  const list = [
    { id: 'CUST-1', name: 'Ali One', customerNumber: 1, mohalla: 'BANII', totalDues: 100 },
    { id: 'CUST-2', name: 'Zara Archived', customerNumber: 2, mohalla: 'BANII', totalDues: 100, archived: true },
    { id: '', name: 'No Id', customerNumber: 3, mohalla: 'BANII', totalDues: 100 },
    { id: 'CUST-4', name: '   ', customerNumber: 4, mohalla: 'BANII', totalDues: 100 },
    { id: 'CUST-5', name: null, customerNumber: 5, mohalla: 'BANII', totalDues: 100 },
  ];
  assert.deepEqual(filterQuickCollectByMohalla(list, 'BANII').map((e) => e.id), ['CUST-1']);
  assert.deepEqual(filterQuickCollectByMohalla(null, 'BANII'), []);
  assert.deepEqual(filterQuickCollectByMohalla('BANII', 'BANII'), []);
});

// --- Summary text ---

test('summary: counts read plainly, with the mohalla exactly as chosen', () => {
  assert.equal(quickCollectMohallaFilterSummaryText([], 'BANII'), 'No customers in BANII.');
  assert.equal(quickCollectMohallaFilterSummaryText([{}], 'BANII'), '1 customer in BANII.');
  assert.equal(quickCollectMohallaFilterSummaryText([{}, {}], 'BANII'), '2 customers in BANII.');
  assert.equal(quickCollectMohallaFilterSummaryText([{}, {}], ''), '2 customers.');
  assert.equal(quickCollectMohallaFilterSummaryText(null, 'BANII'), 'No customers in BANII.');
});

// --- Options markup ---

test('options: All mohallas first, then one option per list entry in list order', () => {
  const html = quickCollectMohallaFilterOptionsHtml(MOHALLAS, '');
  assert.ok(html.startsWith('<option value="">All mohallas</option>'), 'All mohallas must come first');
  assert.ok(html.includes('<option value="BANII">BANII</option>'), 'missing BANII option');
  assert.ok(html.includes('<option value="GANGALL">GANGALL</option>'), 'missing GANGALL option');
  assert.ok(html.includes('<option value="KISHTII">KISHTII</option>'), 'missing KISHTII option');
  assert.ok(html.indexOf('BANII') < html.indexOf('GANGALL') && html.indexOf('GANGALL') < html.indexOf('KISHTII'), 'options must follow the list order');
  assert.ok(!html.includes(' selected'), 'nothing is selected when nothing is chosen');
});

test('options: the chosen mohalla is selected by key, even as a variant spelling', () => {
  const html = quickCollectMohallaFilterOptionsHtml(MOHALLAS, 'bani');
  assert.ok(html.includes('<option value="BANII" selected>BANII</option>'), 'variant spelling must select the canonical entry');
  assert.equal(quickCollectMohallaFilterOptionsHtml(MOHALLAS, 'Nowhere').includes(' selected'), false);
});

test('options: a hostile list entry is escaped before it reaches the page', () => {
  const hostile = '"><img src=x onerror=alert(1)>';
  const html = quickCollectMohallaFilterOptionsHtml([hostile], '');
  assert.ok(!html.includes('<img'), 'raw markup must never reach the page');
  assert.ok(html.includes('&quot;&gt;&lt;img'), 'the value must be escaped');
});

// --- Acceptance on one shared billed fixture ---

test('acceptance: choosing a mohalla lists exactly its customers with dues, in name order', () => {
  const s = billedState();
  const view = renderQuickCollectPickerHtml(s, '', 'all-dues', null, 'BANII');
  assert.deepEqual(view.customers.map((c) => c.id), ['b', 'a']);
  assert.deepEqual(view.customers.map((c) => c.totalDues), [3000, 2000]);
  assert.ok(view.html.includes('Ali One'), 'missing Ali One');
  assert.ok(view.html.includes('Zara Nine'), 'missing Zara Nine');
  assert.ok(view.html.includes('PKR 3,000'), 'missing Ali One dues');
  assert.ok(view.html.includes('PKR 2,000'), 'missing Zara Nine dues');
  assert.ok(!view.html.includes('Bilal Two'), 'another mohalla must not leak in');
  assert.ok(!view.html.includes('Danish Four'), 'another mohalla must not leak in');
  assert.equal(view.allCollected, false);
});

test('acceptance: the legacy area field still finds its mohalla', () => {
  const s = billedState();
  const view = renderQuickCollectPickerHtml(s, '', 'all-dues', null, 'GANGALL');
  assert.deepEqual(view.customers.map((c) => c.id), ['c', 'e']);
});

test('acceptance: clearing the filter returns the full list, dues-first, unchanged', () => {
  const s = billedState();
  const view = renderQuickCollectPickerHtml(s, '', 'all-dues', null, '');
  assert.deepEqual(view.customers.map((c) => c.id), ['b', 'a', 'c', 'e']);
  assert.equal(view.allCollected, false);
});

test('acceptance: a mohalla with no dues shows no match, never the all-collected state', () => {
  const s = billedState();
  const view = renderQuickCollectPickerHtml(s, '', 'all-dues', null, 'MALLA');
  assert.deepEqual(view.customers, []);
  assert.equal(view.allCollected, false, 'an empty mohalla is not an all-collected round');
  // Plan 542 changed the message, not the intent: an empty mohalla
  // no longer falls through to the generic "No matching accounts"
  // line — it names the mohalla and offers to clear the filter.
  // The pin stays the same: a no-match message, never all-collected.
  assert.match(view.html, /No customers in MALLA/, 'empty mohalla must name the mohalla');
  assert.match(view.html, /Clear mohalla filter/, 'empty mohalla must offer to clear the filter');
  assert.ok(!view.html.includes('Sab ka bill wusool ho gaya'), 'empty mohalla must not claim all collected');
});

test('acceptance: the settled customer in the mohalla appears under the All filter', () => {
  const s = billedState();
  const view = renderQuickCollectPickerHtml(s, '', 'all', null, 'BANII');
  assert.deepEqual(view.customers.map((c) => c.id), ['b', 'd', 'a']);
});

test('acceptance: filtering never changes any bill, payment, or customer record', () => {
  const s = billedState();
  const before = JSON.stringify(s);
  renderQuickCollectPickerHtml(s, '', 'all-dues', null, 'BANII');
  renderQuickCollectPickerHtml(s, '', 'all-dues', null, '');
  renderQuickCollectPickerHtml(s, '', 'all', null, 'GANGALL');
  assert.equal(JSON.stringify(s), before);
});

// --- Wiring ---

test('wiring: the controller imports the mohalla filter view', () => {
  // QC-4: the counted options builder replaced the plain one — the
  // import still brings in the mohalla filter view, now with its
  // pending-counts builder alongside.
  assert.ok(wiringSrc.includes("import {\n  filterQuickCollectByMohalla,\n  quickCollectMohallaFilterKey,\n  quickCollectMohallaFilterCountOptionsHtml,\n  quickCollectMohallaFilterSummaryText,\n  quickCollectMohallaPendingCounts,\n  resolveQuickCollectMohallaFilter\n} from './quick-collect-mohalla-filter.js';"), 'missing mohalla filter import');
  assert.ok(wiringSrc.includes("document.getElementById('mhfMohallaFilter')"), 'missing filter select lookup');
  assert.ok(wiringSrc.includes("document.getElementById('mhfMohallaFilterSummary')"), 'missing filter summary lookup');
});

test('wiring: the select is filled from the app\'s own mohalla list and a change re-renders the list', () => {
  // QC-4: the select is seeded with counted options from the same
  // app list — the options still come from the app's own mohalla
  // list, now carrying each mohalla's pending count. Mohalla
  // Numbering: the seed passes the list in the numbered order.
  assert.ok(wiringSrc.includes('mohallaFilterSelect.innerHTML = quickCollectMohallaFilterCountOptionsHtml(quickCollectMohallaPendingCounts([], sortMohallaNamesByNumberedOrder(DEFAULT_MOHALLAS)), \'\');'), 'options must come from the app\'s own mohalla list');
  const change = wiringSrc.match(/mohallaFilterSelect\?\.addEventListener\('change', \(\) => \{[\s\S]*?\n  \}\);/);
  assert.ok(change, 'missing mohalla filter change listener');
  assert.ok(change[0].includes('resolveQuickCollectMohallaFilter(mohallaFilterSelect.value, DEFAULT_MOHALLAS)'), 'change must resolve the chosen value against the app list');
  assert.ok(change[0].includes('renderList();'), 'change must re-render the list');
});

test('wiring: renderList passes the active mohalla to the picker and writes the count line', () => {
  const renderList = wiringSrc.match(/function renderList\(\) \{[\s\S]*?\n  \}/);
  assert.ok(renderList, 'renderList not found');
  // QC-2 added a 6th options argument (sort order) to the picker
  // call — the assertion tolerates it and still pins that the active
  // mohalla is passed as the 5th argument.
  assert.ok(/renderQuickCollectPickerHtml\(state, query, activeFilter, activeCustomerId, activeMohallaFilter(, \{[^}]*\})?\)/.test(renderList[0]), 'renderList must pass the active mohalla to the picker');
  assert.ok(renderList[0].includes('quickCollectMohallaFilterSummaryText(picked.customers, activeMohallaFilter)'), 'renderList must write the filtered count line');
});

test('wiring: the picker applies the filter and keeps the all-collected state for the whole round only', () => {
  const picker = wiringSrc.match(/export function renderQuickCollectPickerHtml\([\s\S]*?\n\}/);
  assert.ok(picker, 'renderQuickCollectPickerHtml not found');
  // QC-4 hoisted the pool into a const so the same pool feeds the
  // per-mohalla counts — the picker still filters the dues list by
  // mohalla from that pool.
  assert.ok(picker[0].includes('const pool = getPendingCollectionCustomers(state, query, filterType);'), 'picker must build the pool once');
  assert.ok(picker[0].includes('filterQuickCollectByMohalla(pool, mohallaFilter)'), 'picker must filter the dues list by mohalla');
  assert.ok(picker[0].includes('!quickCollectMohallaFilterKey(mohallaFilter)'), 'all-collected must stay false while a mohalla is chosen');
});

test('wiring: the name and last-four lookups compose with the mohalla filter', () => {
  assert.ok(wiringSrc.includes('filterQuickCollectByMohalla(namePrefixLookupMatches(state?.customers ?? [], query), activeMohallaFilter)'), 'name lookup must compose with the mohalla filter');
  assert.ok(wiringSrc.includes('filterQuickCollectByMohalla(findCustomersByLastFourDigits(state?.customers ?? [], query), activeMohallaFilter)'), 'last-four lookup must compose with the mohalla filter');
});

test('wiring: the picker step carries the filter select and count line, select in the 2-column row above the search', () => {
  assert.ok(pageSrc.includes('<select id="mhfMohallaFilter"'), 'missing mohalla filter select');
  // Quick Collect CSS tightening (user instruction 2026-11-13,
  // parent decision D2): the picker's static fallback is the short
  // "All" now, so it fits the native picker on one line. The other
  // "All mohallas" options in the page (customer search, ticket
  // log, dispatch queue) are other surfaces and keep their label.
  const mhfSelect = pageSrc.slice(pageSrc.indexOf('id="mhfMohallaFilter"'), pageSrc.indexOf('</select>', pageSrc.indexOf('id="mhfMohallaFilter"')));
  assert.ok(mhfSelect.includes('<option value="">All</option>'), 'the picker fallback must read "All"');
  assert.ok(!mhfSelect.includes('All mohallas'), 'the picker fallback must not carry the long label');
  assert.ok(pageSrc.includes('<p id="mhfMohallaFilterSummary"'), 'missing filter count line');
  const pickStep = pageSrc.indexOf('id="quickCollectStepPick"');
  const pills = pageSrc.indexOf('class="qc-filter-pills"');
  const select = pageSrc.indexOf('id="mhfMohallaFilter"');
  const summary = pageSrc.indexOf('id="mhfMohallaFilterSummary"');
  const list = pageSrc.indexOf('id="quickCollectCustomerList"');
  assert.ok(pickStep !== -1 && pills !== -1 && select !== -1 && summary !== -1 && list !== -1, 'anchors missing');
  // QC True 1-Row Tightening (item A): the select MOVED — from its
  // own row below the pills into the 2-column filter row above the
  // search, beside Sort by. The count line stays below the pills.
  // The order is now: picker step < select < pills < summary < list.
  assert.ok(pickStep < select && select < pills && pills < summary && summary < list, 'filter select must sit in the 2-column row above the search, count line below the pills, all inside the picker step before the customer list');
});

// --- Fences ---

test('fences: the filter module is pure — no clock, no storage, no store key', () => {
  assert.ok(!moduleSrc.includes('new Date('), 'module must not read the clock');
  assert.ok(!moduleSrc.includes('Date.now('), 'module must not read the clock');
  assert.ok(!moduleSrc.includes('localStorage'), 'module must not touch storage');
  assert.ok(!moduleSrc.includes('sessionStorage'), 'module must not touch storage');
  assert.ok(!moduleSrc.includes('shahdara_'), 'module must not hold a store key');
  assert.ok(!moduleSrc.includes('import '), 'module must be import-free');
  assert.ok(!moduleSrc.includes('document'), 'module must not touch the page');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not name the OLT word');
});

test('fences: the module header never names a fenced file literally', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenced = [
    'mohalla-name-' + 'filter.js',
    'daily-target-' + 'progress.js',
    'daily-entry-' + 'summary.js',
    'quick-collect-round-' + 'totals.js',
    'name-prefix-' + 'lookup.js',
    'last-four-digits-' + 'search.js',
    'recent-quick-' + 'pick.js',
    'quick-collect-amount-' + 'keypad.js',
    'pending-clearance-' + 'flag.js',
    'receipt-share-' + 'draft.js',
    'quick-collect-still-' + 'owes.js',
    'quick-collect-one-' + 'screen.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
    'big-wallet-method-' + 'buttons.js',
    'double-tap-save-' + 'guard.js',
    'offline-saved-' + 'badge.js',
    'quick-collect-reversal-' + 'undo.js',
    'success-next-' + 'steps.js',
    'receipt-' + 'preview.js',
    'cash-change-' + 'calculator.js',
    'remembered-' + 'method.js',
    'monthly-kpi-' + 'target.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module header must not name ${name}`);
  }
});

test('fences: the fenced modules never reference the mohalla filter', () => {
  // Fragment-built so this test never trips on its own literals.
  const fenceFiles = [
    'daily-entry-' + 'summary.js',
    'quick-collect-round-' + 'totals.js',
    'daily-target-' + 'progress.js',
    'owner-' + 'digest.js',
    'collector-' + 'settlements.js',
    'dashboard-' + 'daily-closing.js',
    'big-wallet-method-' + 'buttons.js',
    'save-confirmation-' + 'summary.js',
    'full-history-' + 'list.js',
    'monthly-kpi-' + 'target.js',
  ];
  for (const file of fenceFiles) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('quickCollectMohallaFilter'), `${file} must not reference the mohalla filter`);
    assert.ok(!src.includes('mhfMohallaFilter'), `${file} must not reference the filter select`);
  }
});

// --- Styles ---

test('styles: the filter rules are layout-only — no new hex colour', () => {
  // QC True 1-Row Tightening (item A): the mohalla row rule and its
  // label rule are deleted with the select's own row (the select
  // moved into the 2-column row). Two .mhf- rules survive: the
  // sizing rule (not row-scoped) and the count-line rule.
  const rules = stylesSrc.match(/\.mhf-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 2, 'missing .mhf- filter rules');
  assert.ok(!stylesSrc.includes('.mhf-mohalla-filter-row {'), 'the mohalla row rule must be gone');
  const baseline = stylesSrc.replace(/\.mhf-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});
