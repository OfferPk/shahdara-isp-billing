import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createInitialState, updateCustomerProfile, archiveCustomer } from '../core.js';
import {
  CUSTOMER_SEARCH_FIELDS,
  normalizeCustomerSearchField,
  normalizePhoneDigits,
  customerMatchesSearchField,
  filterCustomersBySearchField,
  buildMohallaUserCounts,
} from '../customer-search-filter.js';
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
