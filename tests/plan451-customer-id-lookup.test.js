// Plan 451 — Search customer by customer ID or connection ID:
// a full ID typed at the counter returns that one customer and no
// other, and an unknown ID says so plainly. The lookup reads IDs
// only and changes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeCustomerIdQuery,
  customerIdLookupIsConnectionId,
  customerIdLookupMatches,
  findCustomerById,
  customerIdLookupIsIdQuery,
  customerIdLookupUnknownText,
  customerIdLookupOpensProfileDirectly,
} from '../customer-id-lookup.js';
import {
  searchFastCustomers,
  renderFastCustomerSearchResultsHtml,
} from '../nav-customer-search.js';

function customers() {
  return [
    { id: 'seed-001', name: 'Raja One', customerNumber: 102, phone: '03012345678', mohalla: 'Mohalla Bani' },
    { id: 'seed-002', name: 'Rani Two', customerNumber: 1021, phone: '03012345679', mohalla: 'Mohalla Bani' },
    { id: 'seed-003', name: 'Sara Three', customerNumber: 2102, phone: '03012345670', mohalla: 'Mohalla Dhok' },
    { id: '3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d', name: 'Ali Four', customerNumber: 103, phone: '03012345671', mohalla: 'Mohalla Dhok' },
  ];
}

function sheetState() {
  return {
    customers: customers().map((customer) => ({ ...customer, area: customer.mohalla, archived: false, bills: [] })),
  };
}

const REF_DATE = new Date('2026-11-07T10:00:00Z');

test('the query is normalized: "#" and spaces stripped, case folded', () => {
  assert.equal(normalizeCustomerIdQuery('#102'), '102');
  assert.equal(normalizeCustomerIdQuery('  # 102 '), '102');
  assert.equal(normalizeCustomerIdQuery('SEED-001'), 'seed-001');
  assert.equal(normalizeCustomerIdQuery(''), '');
  assert.equal(normalizeCustomerIdQuery(null), '');
  assert.equal(normalizeCustomerIdQuery(undefined), '');
});

test('a digits-only query is a connection-ID query', () => {
  assert.equal(customerIdLookupIsConnectionId('102'), true);
  assert.equal(customerIdLookupIsConnectionId('#102'), true);
  assert.equal(customerIdLookupIsConnectionId('seed-001'), false);
  assert.equal(customerIdLookupIsConnectionId(''), false);
  assert.equal(customerIdLookupIsConnectionId('102a'), false);
});

test('a connection ID matches only the customer whose number equals it', () => {
  const [one, two, three] = customers();
  assert.equal(customerIdLookupMatches(one, '102'), true);
  assert.equal(customerIdLookupMatches(one, '#102'), true);
  assert.equal(customerIdLookupMatches(one, ' 102 '), true);
  assert.equal(customerIdLookupMatches(one, '10'), false);
  assert.equal(customerIdLookupMatches(one, '1021'), false);
  assert.equal(customerIdLookupMatches(one, '2102'), false);
  assert.equal(customerIdLookupMatches(two, '102'), false);
  assert.equal(customerIdLookupMatches(three, '102'), false);
});

test('a customer ID matches only the record whose id equals it', () => {
  const [one, , , four] = customers();
  assert.equal(customerIdLookupMatches(one, 'seed-001'), true);
  assert.equal(customerIdLookupMatches(one, 'SEED-001'), true);
  assert.equal(customerIdLookupMatches(one, ' seed-001 '), true);
  assert.equal(customerIdLookupMatches(one, 'seed-00'), false);
  assert.equal(customerIdLookupMatches(one, 'seed-0012'), false);
  assert.equal(customerIdLookupMatches(one, 'seed-002'), false);
  assert.equal(customerIdLookupMatches(four, '3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d'), true);
  assert.equal(customerIdLookupMatches(four, '3F8A2C1E-7B4D-4A1E-9C2D-5E6F7A8B9C0D'), true);
});

test('the lookup never matches a blank query, a missing record, or a missing number', () => {
  const [one] = customers();
  assert.equal(customerIdLookupMatches(one, ''), false);
  assert.equal(customerIdLookupMatches(one, null), false);
  assert.equal(customerIdLookupMatches(null, '102'), false);
  assert.equal(customerIdLookupMatches(undefined, 'seed-001'), false);
  assert.equal(customerIdLookupMatches({ id: 'seed-009', name: 'No Number' }, '0'), false);
  assert.equal(customerIdLookupMatches({ customerNumber: 102, name: 'No Id' }, 'seed-001'), false);
});

test('findCustomerById returns the one exact customer, or null', () => {
  const list = customers();
  assert.equal(findCustomerById(list, '102').id, 'seed-001');
  assert.equal(findCustomerById(list, '#1021').id, 'seed-002');
  assert.equal(findCustomerById(list, 'seed-003').customerNumber, 2102);
  assert.equal(findCustomerById(list, '999'), null);
  assert.equal(findCustomerById(list, 'seed-999'), null);
  assert.equal(findCustomerById(list, ''), null);
  assert.equal(findCustomerById(list, '  '), null);
  assert.equal(findCustomerById(null, '102'), null);
  assert.equal(findCustomerById('not-a-list', '102'), null);
});

test('an ID-shaped query is a short number or a dashed id — never a name or a phone number', () => {
  assert.equal(customerIdLookupIsIdQuery('102'), true);
  assert.equal(customerIdLookupIsIdQuery('#1021'), true);
  assert.equal(customerIdLookupIsIdQuery('5678'), true);
  assert.equal(customerIdLookupIsIdQuery('seed-001'), true);
  assert.equal(customerIdLookupIsIdQuery('3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d'), true);
  assert.equal(customerIdLookupIsIdQuery('ali'), false);
  assert.equal(customerIdLookupIsIdQuery('raja one'), false);
  assert.equal(customerIdLookupIsIdQuery('03012345678'), false);
  assert.equal(customerIdLookupIsIdQuery('0301-2345678'), false);
  assert.equal(customerIdLookupIsIdQuery('+92 301 2345678'), false);
  assert.equal(customerIdLookupIsIdQuery(''), false);
});

test('an unknown ID says so plainly, with the "#" the app uses for a connection ID', () => {
  assert.equal(
    customerIdLookupUnknownText('102'),
    'No customer with ID #102 found. Check the ID and try again.',
  );
  assert.equal(
    customerIdLookupUnknownText('#102'),
    'No customer with ID #102 found. Check the ID and try again.',
  );
  assert.equal(
    customerIdLookupUnknownText('seed-999'),
    'No customer with ID seed-999 found. Check the ID and try again.',
  );
});

test('Enter opens the profile directly only for a single exact-ID result', () => {
  const [one, two] = customers();
  assert.equal(customerIdLookupOpensProfileDirectly('102', [one]), true);
  assert.equal(customerIdLookupOpensProfileDirectly('#102', [one]), true);
  assert.equal(customerIdLookupOpensProfileDirectly('seed-001', [one]), true);
  assert.equal(customerIdLookupOpensProfileDirectly('102', [two]), false);
  assert.equal(customerIdLookupOpensProfileDirectly('raja', [one]), false);
  assert.equal(customerIdLookupOpensProfileDirectly('102', [one, two]), false);
  assert.equal(customerIdLookupOpensProfileDirectly('102', []), false);
});

test('the sheet: a full connection ID returns that one customer and no other', () => {
  const results = searchFastCustomers(sheetState(), { query: '102' }, REF_DATE);
  assert.deepEqual(results.map((customer) => customer.customerNumber), [102]);
  const hashed = searchFastCustomers(sheetState(), { query: '#102' }, REF_DATE);
  assert.deepEqual(hashed.map((customer) => customer.customerNumber), [102]);
  const spaced = searchFastCustomers(sheetState(), { query: ' 102 ' }, REF_DATE);
  assert.deepEqual(spaced.map((customer) => customer.customerNumber), [102]);
});

test('the sheet: a full customer ID returns that one customer and no other', () => {
  const results = searchFastCustomers(sheetState(), { query: 'seed-001' }, REF_DATE);
  assert.deepEqual(results.map((customer) => customer.id), ['seed-001']);
  const upper = searchFastCustomers(sheetState(), { query: 'SEED-001' }, REF_DATE);
  assert.deepEqual(upper.map((customer) => customer.id), ['seed-001']);
  const uuid = searchFastCustomers(sheetState(), { query: '3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d' }, REF_DATE);
  assert.deepEqual(uuid.map((customer) => customer.customerNumber), [103]);
});

test('the sheet: an unknown ID returns nobody', () => {
  assert.deepEqual(searchFastCustomers(sheetState(), { query: '999' }, REF_DATE), []);
  assert.deepEqual(searchFastCustomers(sheetState(), { query: 'seed-999' }, REF_DATE), []);
  assert.deepEqual(searchFastCustomers(sheetState(), { query: '#999' }, REF_DATE), []);
});

test('the sheet: a partial number with no exact hit still matches the old way', () => {
  // "10" is nobody's full number, so the sheet's partial matching
  // stands: every number containing "10" is listed.
  const results = searchFastCustomers(sheetState(), { query: '10' }, REF_DATE);
  assert.deepEqual(results.map((customer) => customer.customerNumber).sort((a, b) => a - b), [102, 103, 1021, 2102]);
});

test('the sheet: name and phone search are unchanged by the ID lookup', () => {
  const byName = searchFastCustomers(sheetState(), { query: 'raja' }, REF_DATE);
  assert.deepEqual(byName.map((customer) => customer.name), ['Raja One']);
  const byPhone = searchFastCustomers(sheetState(), { query: '45678' }, REF_DATE);
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].name, 'Raja One');
});

test('the sheet: an exact ID hit still respects the mohalla filter', () => {
  const state = sheetState();
  // #102 lives in Mohalla Bani, so under a Mohalla Dhok filter there
  // is no exact hit — and the partial matching inside that mohalla
  // finds only #2102, never the filtered-out #102.
  const otherMohalla = searchFastCustomers(state, { query: '102', mohalla: 'Mohalla Dhok' }, REF_DATE);
  assert.deepEqual(otherMohalla.map((customer) => customer.customerNumber), [2102]);
  // Under its own mohalla the exact hit wins over #1021, which is in
  // the same mohalla and would match partially.
  const ownMohalla = searchFastCustomers(state, { query: '102', mohalla: 'Mohalla Bani' }, REF_DATE);
  assert.deepEqual(ownMohalla.map((customer) => customer.customerNumber), [102]);
});

test('the sheet: an archived customer is never returned, even by exact ID', () => {
  const state = sheetState();
  state.customers[0].archived = true;
  // With #102 archived there is no exact hit; the partial matching
  // finds #1021 and #2102, never the archived record — and a record
  // id has no partial path at all, so it finds nobody.
  assert.deepEqual(
    searchFastCustomers(state, { query: '102' }, REF_DATE).map((customer) => customer.customerNumber).sort((a, b) => a - b),
    [1021, 2102],
  );
  assert.deepEqual(searchFastCustomers(state, { query: 'seed-001' }, REF_DATE), []);
});

test('the sheet: an unknown ID gets the plain message, anything else keeps the generic hint', () => {
  const unknownId = renderFastCustomerSearchResultsHtml([], {
    isRecent: false,
    emptyText: customerIdLookupUnknownText('999'),
  });
  assert.ok(unknownId.includes('No customer with ID #999 found. Check the ID and try again.'));
  const generic = renderFastCustomerSearchResultsHtml([], { isRecent: false });
  assert.ok(generic.includes('No matching customers found'));
  assert.ok(generic.includes('Try searching with a shorter name, phone digits, or area.'));
  const recent = renderFastCustomerSearchResultsHtml([], { isRecent: true });
  assert.ok(recent.includes('No recent customers'));
});

test('wiring: the sheet imports the ID lookup and uses it for the exact hit, the plain message, and Enter', () => {
  const sheet = readFileSync(new URL('../nav-customer-search.js', import.meta.url), 'utf8');
  assert.ok(sheet.includes("from './customer-id-lookup.js'"), 'sheet imports the Plan 451 module');
  assert.ok(sheet.includes('customerIdLookupMatches(customer, query)'), 'exact hit is checked in searchFastCustomers');
  assert.ok(sheet.includes('customerIdLookupIsIdQuery(query)'), 'unknown-ID shape is checked when rendering');
  assert.ok(sheet.includes('customerIdLookupUnknownText(query)'), 'plain unknown-ID text is rendered');
  assert.ok(sheet.includes('customerIdLookupOpensProfileDirectly'), 'Enter opens the profile directly on an exact-ID hit');
});

test('the new module names no fenced module file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../customer-id-lookup.js', import.meta.url), 'utf8');
  assert.equal(module.includes('customer-search-filter.js'), false);
  assert.equal(module.includes('nav-customer-search.js'), false);
  assert.equal(module.includes('fuzzy-alias-search.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('Date('), false);
  assert.equal(module.includes('Date.now'), false);
});
