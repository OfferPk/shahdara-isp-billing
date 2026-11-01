import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createInitialState, updateCustomerProfile, archiveCustomer, calculatePaymentAllocations } from '../core.js';
import {
  CUSTOMER_SEARCH_FIELDS,
  normalizeCustomerSearchField,
  normalizePhoneDigits,
  customerMatchesSearchField,
  filterCustomersBySearchField,
  buildMohallaUserCounts,
  buildMohallaCardStats,
} from '../customer-search-filter.js';
import {
  filterFieldModeEntriesByMohalla,
  fieldModeCollectedTodayForMohalla,
  setupFieldMode,
} from '../field-mode.js';
import { getPendingCollectionCustomers } from '../nav-quick-collect.js';
import { DEFAULT_MOHALLAS } from '../phase3.js';

// Owner feature (2026-10-29): the Customers list search gets a field filter
// (Name / Mobile / User ID / Area) and the Dashboard gets Mohalla cards —
// one card per mohalla WITH users, no card for a zero-user mohalla. All
// area logic flows through canonicalMohalla (PR #428): "Bani" === "BANII".

const today = new Date('2026-10-29T12:00:00+05:00');
const here = path.dirname(fileURLToPath(import.meta.url));
const readRepoFile = (name) => readFileSync(path.join(here, '..', name), 'utf8');

function searchState() {
  let state = createInitialState(['Ali Raza', 'Bilal Ahmed', 'Chaudhry Aslam', 'Danish Iqbal']);
  // Ali: BARRIAN, mobile stored with dashes/spaces.
  state = updateCustomerProfile(state, 'seed-001', { mohalla: 'BARRIAN', phone: '0341-527 7081' }, today);
  // Bilal: BANII spelled "Bani".
  state = updateCustomerProfile(state, 'seed-002', { mohalla: 'Bani', phone: '0300 9998877' }, today);
  // Chaudhry: BANII in canonical spelling.
  state = updateCustomerProfile(state, 'seed-003', { mohalla: 'BANII', phone: '0321 5551234' }, today);
  // Danish: PALALIYAA.
  state = updateCustomerProfile(state, 'seed-004', { mohalla: 'PALALIYAA', phone: '0333 4445556' }, today);
  return state;
}

test('field catalogue is exactly Name / Mobile / User ID / Area, unknown fields fall back to name', () => {
  assert.deepEqual(CUSTOMER_SEARCH_FIELDS.map((field) => field.id), ['name', 'mobile', 'userid', 'area']);
  assert.deepEqual(CUSTOMER_SEARCH_FIELDS.map((field) => field.label), ['Name', 'Mobile', 'User ID', 'Area']);
  assert.equal(normalizeCustomerSearchField('mobile'), 'mobile');
  assert.equal(normalizeCustomerSearchField(' AREA '), 'area');
  assert.equal(normalizeCustomerSearchField('bogus'), 'name');
  assert.equal(normalizeCustomerSearchField(''), 'name');
  assert.equal(normalizeCustomerSearchField(undefined), 'name');
});

test('mobile filter: partial digits match the right customer only, formatting is ignored', () => {
  const state = searchState();
  const byPartial = filterCustomersBySearchField(state.customers, 'mobile', '5277');
  assert.deepEqual(byPartial.map((c) => c.id), ['seed-001']);
  const byTail = filterCustomersBySearchField(state.customers, 'mobile', '9998877');
  assert.deepEqual(byTail.map((c) => c.id), ['seed-002']);
  // Stored "0341-527 7081" matches an unformatted full-number query.
  const byFull = filterCustomersBySearchField(state.customers, 'mobile', '03415277081');
  assert.deepEqual(byFull.map((c) => c.id), ['seed-001']);
  // A digit string in nobody's phone matches nobody, and letters never match a phone.
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'mobile', '777000'), []);
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'mobile', 'Ali'), []);
  assert.equal(normalizePhoneDigits('+92 (341) 527-7081'), '923415277081');
});

test('user ID filter: numeric part and full record ID each find exactly that customer', () => {
  const state = searchState();
  // Customer numbers are 1..4 in creation order; #3 is Chaudhry only.
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'userid', '3').map((c) => c.id), ['seed-003']);
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'userid', '#3').map((c) => c.id), ['seed-003']);
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'userid', 'seed-002').map((c) => c.id), ['seed-002']);
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'userid', '99'), []);
  // Field isolation: a name typed into the User ID field matches nobody.
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'userid', 'Bilal'), []);
});

test('area filter: "bani" returns BANII customers including the one stored as "Bani"', () => {
  const state = searchState();
  const bani = filterCustomersBySearchField(state.customers, 'area', 'bani');
  assert.deepEqual(bani.map((c) => c.id), ['seed-002', 'seed-003']);
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'area', 'BANII').map((c) => c.id), ['seed-002', 'seed-003']);
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'area', 'Mohalla Bani').map((c) => c.id), ['seed-002', 'seed-003']);
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'area', 'barrian').map((c) => c.id), ['seed-001']);
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'area', 'CHARYAA'), []);
});

test('name filter keeps name matching (incl. Urdu name) and an empty query returns everyone', () => {
  const state = searchState();
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'name', 'bilal').map((c) => c.id), ['seed-002']);
  assert.deepEqual(filterCustomersBySearchField(state.customers, 'name', '5277'), []);
  const urduNamed = { ...state.customers[0], nameUrdu: 'علی رضا' };
  assert.equal(customerMatchesSearchField(urduNamed, 'name', 'علی'), true);
  for (const field of ['name', 'mobile', 'userid', 'area']) {
    assert.equal(filterCustomersBySearchField(state.customers, field, '   ').length, 4, `${field}: blank query is unfiltered`);
    assert.equal(filterCustomersBySearchField(state.customers, field, '').length, 4);
  }
});

test('mohalla counts: variant spellings merge, exactly the populated mohallas get cards, zero-user mohallas get none', () => {
  let state = createInitialState(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  state = updateCustomerProfile(state, 'seed-001', { mohalla: 'BARRIAN' }, today);
  state = updateCustomerProfile(state, 'seed-002', { mohalla: 'Barrian' }, today);
  state = updateCustomerProfile(state, 'seed-003', { mohalla: 'Bani' }, today);
  state = updateCustomerProfile(state, 'seed-004', { mohalla: 'BANII' }, today);
  state = updateCustomerProfile(state, 'seed-005', { mohalla: 'PALALIYAA' }, today);
  // seed-006 lives in MALLA but is archived — archived users earn no card.
  state = updateCustomerProfile(state, 'seed-006', { mohalla: 'MALLA' }, today);
  state = archiveCustomer(state, 'seed-006', today);
  // seed-007 has no mohalla at all — counted nowhere.
  const counts = buildMohallaUserCounts(state.customers);
  assert.equal(counts.length, 3, 'exactly 3 mohallas have active users');
  const byStored = new Map(counts.map((row) => [row.stored, row.count]));
  assert.equal(byStored.get('BARRIAN'), 2);
  assert.equal(byStored.get('BANII'), 2, '"Bani" + "BANII" merge into one BANII count');
  assert.equal(byStored.get('PALALIYAA'), 1);
  assert.ok(!byStored.has('MALLA'), 'archived-only mohalla renders no card');
  for (const empty of DEFAULT_MOHALLAS.filter((name) => !byStored.has(name))) {
    assert.ok(!counts.some((row) => row.stored === empty), `${empty} has zero users and must not produce a card`);
  }
  assert.ok(counts.every((row) => row.count > 0 && row.canonical));
});

test('mohalla counts: a non-canonical area with real users still gets its own card', () => {
  let state = createInitialState(['Haveli One', 'Haveli Two']);
  state = updateCustomerProfile(state, 'seed-001', { mohalla: 'HAVELI' }, today);
  // Legacy/imported records may carry only the `area` field (no `mohalla`);
  // the app reads `mohalla || area` everywhere, and so do the counts.
  const legacyAreaOnly = { ...state.customers[1], mohalla: '', area: 'HAVELI' };
  const counts = buildMohallaUserCounts([state.customers[0], legacyAreaOnly]);
  assert.equal(counts.length, 1);
  assert.equal(counts[0].stored, 'HAVELI');
  assert.equal(counts[0].count, 2, 'mohalla and area fields both feed the count');
  assert.equal(counts[0].canonical, false);
  assert.deepEqual(buildMohallaUserCounts([]), []);
  assert.deepEqual(buildMohallaUserCounts(undefined), []);
});

// ---------------------------------------------------------------------------
// SISP-175: Mohalla card enrichment — live Unpaid PKR, Paid %, FREE count,
// and the 🏍️ Field Collect launch into Field Mode scoped to the mohalla.
// Synthetic data only. Fixtures are plain records (the collection-
// forecaster pattern) fed through the REAL allocation engine.
// ---------------------------------------------------------------------------

let seq = 0;
const nid = (prefix) => `${prefix}${String(++seq).padStart(4, '0')}`;
const pay = (date, amount) => ({ id: nid('p'), date, amount, method: 'Cash' });
const bill = (month, dueAmount, payments = []) => ({ month, dueAmount, payments });
const cust = (name, mohalla, bills, extra = {}) => ({ id: nid('c'), customerNumber: seq, name, mohalla, bills, ...extra });
const CURRENT_MONTH = '2026-10';

function statsState() {
  return {
    customers: [
      // BARRIAN: one settled, one partial, one arrears-only, one FREE.
      cust('Alpha Paid', 'BARRIAN', [bill(CURRENT_MONTH, 3000, [pay('2026-10-03', 3000)])]),
      cust('Bravo Partial', 'BARRIAN', [bill(CURRENT_MONTH, 3000, [pay('2026-10-04', 1000)])]),
      cust('Charlie Arrears', 'BARRIAN', [bill('2026-09', 2500, [])]),
      // A FREE connection never gets billed in the real app (bill
      // generation skips it); the priced bill here is a defensive legacy
      // anomaly pinning that FREE is skipped for dues/billed regardless —
      // the same explicit skip Top Defaulters make.
      cust('Delta Free', 'BARRIAN', [bill(CURRENT_MONTH, 3000, [])], { isFreeConnection: true }),
      // BANII: both spelling variants, both fully paid this cycle.
      cust('Echo Bani', 'Bani', [bill(CURRENT_MONTH, 2000, [pay('2026-10-05', 2000)])]),
      cust('Foxtrot Banii', 'BANII', [bill(CURRENT_MONTH, 2000, [pay('2026-10-06', 2000)])]),
      // PALALIYAA: one billed-and-unpaid, one archived (excluded everywhere).
      cust('Golf Unpaid', 'PALALIYAA', [bill(CURRENT_MONTH, 1500, [])]),
      cust('Hotel Archived', 'PALALIYAA', [bill(CURRENT_MONTH, 1500, [])], { archived: true }),
      // NAKAR: a lone FREE connection — card shows, but nobody is billed.
      cust('India Free Only', 'NAKAR', [], { isFreeConnection: true }),
    ],
  };
}

test('SISP-175 stats: unpaid PKR sums the engine balanceDueCents across all bills, per mohalla', () => {
  const state = statsState();
  const stats = buildMohallaCardStats(state.customers, calculatePaymentAllocations(state), CURRENT_MONTH);
  const byStored = new Map(stats.map((row) => [row.stored, row]));
  // BARRIAN: partial 2,000 + arrears 2,500 = 4,500. The FREE customer's
  // anomaly bill contributes nothing; the settled customer contributes 0.
  assert.equal(byStored.get('BARRIAN').unpaidPKR, 4500);
  assert.equal(byStored.get('BANII').unpaidPKR, 0);
  assert.equal(byStored.get('PALALIYAA').unpaidPKR, 1500, 'archived customer dues never counted');
  assert.equal(byStored.get('NAKAR').unpaidPKR, 0);
});

test('SISP-175 stats: paid % counts only this month\'s billed customers; FREE enter neither side', () => {
  const state = statsState();
  const stats = buildMohallaCardStats(state.customers, calculatePaymentAllocations(state), CURRENT_MONTH);
  const byStored = new Map(stats.map((row) => [row.stored, row]));
  const barrian = byStored.get('BARRIAN');
  // Billed this month: Alpha (paid) + Bravo (partial) = 2. Charlie has no
  // current bill; Delta is FREE — neither is in the denominator.
  assert.equal(barrian.billedCount, 2);
  assert.equal(barrian.paidCount, 1);
  assert.equal(barrian.paidPct, 50);
  assert.equal(byStored.get('BANII').paidPct, 100, 'all billed paid → 100');
  assert.equal(byStored.get('PALALIYAA').paidPct, 0, 'none billed paid → 0');
  assert.equal(byStored.get('NAKAR').billedCount, 0);
  assert.equal(byStored.get('NAKAR').paidPct, null, 'nobody billed → no honest percentage');
});

test('SISP-175 stats: FREE count is its own figure and card visibility/count rules are unchanged', () => {
  const state = statsState();
  const stats = buildMohallaCardStats(state.customers, calculatePaymentAllocations(state), CURRENT_MONTH);
  const counts = buildMohallaUserCounts(state.customers);
  assert.deepEqual(stats.map((row) => [row.key, row.count]), counts.map((row) => [row.key, row.count]),
    'stats rows are exactly the user-count rows, same order and counts');
  const byStored = new Map(stats.map((row) => [row.stored, row]));
  assert.equal(byStored.get('BARRIAN').count, 4, 'FREE users still count as users, as before');
  assert.equal(byStored.get('BARRIAN').freeCount, 1);
  assert.equal(byStored.get('BANII').freeCount, 0);
  assert.equal(byStored.get('NAKAR').count, 1, 'a FREE-only mohalla still earns its card');
  assert.equal(byStored.get('NAKAR').freeCount, 1);
  assert.ok(!byStored.has('CHAMYAAA'), 'zero-user mohalla stays hidden');
  assert.equal(stats.length, 4);
});

test('SISP-175 field filter: spelling variants of one mohalla unite under the card rule', () => {
  const entries = [
    { id: 'e1', name: 'One', mohalla: 'Bani', area: 'Unassigned', totalDues: 100 },
    { id: 'e2', name: 'Two', mohalla: 'BANII', area: 'Unassigned', totalDues: 200 },
    { id: 'e3', name: 'Three', mohalla: 'MOHALLA BANI', area: 'Unassigned', totalDues: 300 },
    { id: 'e4', name: 'Four', mohalla: 'BARRIAN', area: 'Unassigned', totalDues: 400 },
    { id: 'e5', name: 'Five', mohalla: '', area: 'HAVELI', totalDues: 500 },
  ];
  // Field Mode zones would split e1/e2/e3 into separate chips (raw
  // canonicalLocation keys); the card scope must NOT — the card counts
  // all three as BANII, so Field Collect shows all three.
  assert.deepEqual(filterFieldModeEntriesByMohalla(entries, [], 'BANII').map((e) => e.id), ['e1', 'e2', 'e3']);
  assert.deepEqual(filterFieldModeEntriesByMohalla(entries, [], 'bani').map((e) => e.id), ['e1', 'e2', 'e3'], 'any spelling resolves to the same mohalla');
  assert.deepEqual(filterFieldModeEntriesByMohalla(entries, [], 'HAVELI').map((e) => e.id), ['e5'], 'non-canonical areas scope by their stored name');
  assert.deepEqual(filterFieldModeEntriesByMohalla(entries, [], ''), []);
  assert.deepEqual(filterFieldModeEntriesByMohalla(entries, [], 'CHAMYAAA'), []);
});

test('SISP-175 field filter: the live customer record wins over the entry snapshot', () => {
  const entries = [
    { id: 'e1', name: 'Moved', mohalla: 'Bani', area: 'Unassigned', totalDues: 100 },
    { id: 'e4', name: 'Four', mohalla: 'BARRIAN', area: 'Unassigned', totalDues: 400 },
  ];
  const live = [{ id: 'e1', mohalla: 'BARRIAN' }];
  assert.deepEqual(filterFieldModeEntriesByMohalla(entries, live, 'BANII'), []);
  assert.deepEqual(filterFieldModeEntriesByMohalla(entries, live, 'BARRIAN').map((e) => e.id), ['e1', 'e4']);
});

test('SISP-175 field filter: real pending-collection entries carry the mohalla scope', () => {
  const state = {
    customers: [
      cust('Bani Due', 'Bani', [bill(CURRENT_MONTH, 2000, [])]),
      cust('Barrian Due', 'BARRIAN', [bill(CURRENT_MONTH, 2000, [])]),
      cust('Banii Paid', 'BANII', [bill(CURRENT_MONTH, 2000, [pay('2026-10-05', 2000)])]),
    ],
  };
  const ref = new Date('2026-10-15T12:00:00+05:00');
  const dues = getPendingCollectionCustomers(state, '', 'all-dues', ref);
  assert.equal(dues.length, 2, 'only the two customers with dues are in the default Field Mode list');
  const scoped = filterFieldModeEntriesByMohalla(dues, state.customers, 'BANII');
  assert.deepEqual(scoped.map((e) => e.name), ['Bani Due'], 'the card launch lands exactly on the mohalla\'s dues');
});

test('SISP-175 collected today (mohalla scope): only that mohalla\'s today payments count', () => {
  const state = {
    customers: [
      cust('Payer Bani', 'Bani', [bill(CURRENT_MONTH, 2000, [pay('2026-10-30', 2000)])]),
      cust('Payer Barrian', 'BARRIAN', [bill(CURRENT_MONTH, 2000, [pay('2026-10-30', 1500)])]),
      cust('Old Banii', 'BANII', [bill('2026-09', 2000, [pay('2026-09-30', 2000)])]),
    ],
  };
  assert.deepEqual(fieldModeCollectedTodayForMohalla(state, 'BANII', '2026-10-30'), { houses: 1, cash: 2000 });
  assert.deepEqual(fieldModeCollectedTodayForMohalla(state, 'BARRIAN', '2026-10-30'), { houses: 1, cash: 1500 });
  assert.deepEqual(fieldModeCollectedTodayForMohalla(state, '', '2026-10-30'), { houses: 0, cash: 0 });
});

test('SISP-175 wiring: controller seam, card markup hooks, i18n keys and token styles exist', () => {
  const controller = setupFieldMode();
  assert.equal(typeof controller.openForMohalla, 'function', 'field-mode controller exposes the mohalla launch');
  const app = readRepoFile('app.js');
  assert.ok(app.includes('buildMohallaCardStats'), 'dashboard render builds the mohalla card stats');
  assert.ok(app.includes('data-mohalla-collect'), 'card renders the Field Collect button as its own target');
  assert.ok(app.includes('openForMohalla'), 'collect button launches Field Mode for that mohalla');
  for (const key of ['dash_mohalla_unpaid', 'dash_mohalla_paid', 'dash_mohalla_free', 'dash_mohalla_collect']) {
    assert.ok(app.includes(`t('${key}')`), `app.js renders ${key} through t()`);
  }
  const fieldMode = readRepoFile('field-mode.js');
  assert.ok(fieldMode.includes('filterFieldModeEntriesByMohalla'), 'controller scopes its list through the mohalla filter seam');
  const language = readRepoFile('nav-language.js');
  for (const key of ['dash_mohalla_unpaid', 'dash_mohalla_paid', 'dash_mohalla_free', 'dash_mohalla_collect']) {
    assert.equal((language.match(new RegExp(`${key}:`, 'g')) || []).length, 2, `${key} exists in BOTH dictionaries`);
  }
  const css = readRepoFile('components.css');
  assert.ok(css.includes('.mohalla-card-main'), 'card main button styled');
  assert.ok(css.includes('.mohalla-card-stat'), 'stat lines styled');
  assert.ok(css.includes('.mohalla-card-collect'), 'collect button styled');
});

test('wiring: search field select, mohalla dashboard section and app.js hooks exist', () => {
  const index = readRepoFile('index.html');
  assert.ok(index.includes('id="customerSearchField"'), 'field select is in the customers search control');
  for (const value of ['name', 'mobile', 'userid', 'area']) {
    assert.ok(index.includes(`<option value="${value}"`), `field select offers ${value}`);
  }
  assert.ok(index.includes('id="mohallaDashboardCards"'), 'dashboard has the mohalla cards grid');
  assert.ok(index.includes('id="mohallaDashboardSection"'), 'dashboard has the mohalla section');
  const app = readRepoFile('app.js');
  assert.ok(app.includes("from './customer-search-filter.js?v=1.11.0'"), 'app.js imports the search-filter module');
  assert.ok(app.includes('filterCustomersBySearchField'), 'roster render applies the field filter');
  assert.ok(app.includes('buildMohallaUserCounts'), 'dashboard render builds mohalla counts');
  const language = readRepoFile('nav-language.js');
  for (const key of ['cust_search_field_name', 'cust_search_field_mobile', 'cust_search_field_userid', 'cust_search_field_area', 'dash_mohalla_title', 'dash_mohalla_users']) {
    assert.ok(language.includes(`${key}:`), `nav-language.js carries ${key}`);
  }
});
