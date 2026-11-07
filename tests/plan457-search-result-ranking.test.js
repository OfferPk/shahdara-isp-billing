import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SEARCH_RESULT_RANK_EXACT,
  SEARCH_RESULT_RANK_PREFIX,
  SEARCH_RESULT_RANK_CONTAINS,
  SEARCH_RESULT_RANK_NICKNAME,
  SEARCH_RESULT_RANK_OTHER,
  customerSearchRank,
  rankCustomerSearchResults,
} from '../search-result-ranking.js';

// Plan 457 — Search results ranked best match first.
//
// Fixtures are invented and pattern-fake only: names are "First
// Last" fixtures (never a real customer), phones are the 03012345678
// family the PII ratchet allows, record ids are seed-* fixtures.
const CUSTOMERS = [
  { id: 'seed-457-01', customerNumber: 205, name: 'Ahmed Raza', phone: '03012345678', mohalla: 'Shahdara', area: 'Shahdara' },
  { id: 'seed-457-02', customerNumber: 201, name: 'Ahmed', phone: '03012345679', mohalla: 'Shahdara', area: 'Shahdara' },
  { id: 'seed-457-03', customerNumber: 203, name: 'Faisal Ahmed', phone: '03012345670', mohalla: 'Dhok', area: 'Dhok' },
  { id: 'seed-457-04', customerNumber: 202, name: 'Bilal Hussain', fatherOrReferenceName: 'Ahmed Khan', phone: '03012345671', mohalla: 'Dhok', area: 'Dhok' },
  { id: 'seed-457-05', customerNumber: 204, name: 'Usman Ghani', searchAliases: ['Ahmed'], phone: '03012345672', mohalla: 'Shahdara', area: 'Shahdara' },
];

const ids = (list) => list.map((c) => c.id);

test('the tiers are ordered exact, prefix, contains, nickname, other', () => {
  assert.equal(SEARCH_RESULT_RANK_EXACT, 0);
  assert.equal(SEARCH_RESULT_RANK_PREFIX, 1);
  assert.equal(SEARCH_RESULT_RANK_CONTAINS, 2);
  assert.equal(SEARCH_RESULT_RANK_NICKNAME, 3);
  assert.equal(SEARCH_RESULT_RANK_OTHER, 4);
});

test('exact name first, then prefix, then contains, then nickname', () => {
  assert.equal(customerSearchRank(CUSTOMERS[1], 'ahmed'), SEARCH_RESULT_RANK_EXACT);
  assert.equal(customerSearchRank(CUSTOMERS[0], 'ahmed'), SEARCH_RESULT_RANK_PREFIX);
  assert.equal(customerSearchRank(CUSTOMERS[2], 'ahmed'), SEARCH_RESULT_RANK_CONTAINS);
  assert.equal(customerSearchRank(CUSTOMERS[3], 'ahmed'), SEARCH_RESULT_RANK_NICKNAME);
  assert.equal(customerSearchRank(CUSTOMERS[4], 'ahmed'), SEARCH_RESULT_RANK_NICKNAME);
  assert.deepEqual(ids(rankCustomerSearchResults(CUSTOMERS, 'ahmed')), [
    'seed-457-02',
    'seed-457-01',
    'seed-457-03',
    'seed-457-04',
    'seed-457-05',
  ]);
});

test('the exact match appears first even when it sorts last any other way', () => {
  // 'Ahmed' carries the highest customer number of the fixture, so
  // number order and any dues order would bury it; relevance puts
  // it first on the same fixture every time.
  const shuffled = [CUSTOMERS[0], CUSTOMERS[2], CUSTOMERS[4], CUSTOMERS[3], CUSTOMERS[1]];
  assert.equal(rankCustomerSearchResults(shuffled, 'ahmed')[0].id, 'seed-457-02');
  assert.equal(rankCustomerSearchResults(shuffled, '  AHMED  ')[0].id, 'seed-457-02');
});

test('ties fall back to name order, then the lower customer number', () => {
  const ties = [
    { id: 'seed-457-11', customerNumber: 209, name: 'Ahmedabad Khan', phone: '03012345678' },
    { id: 'seed-457-10', customerNumber: 208, name: 'Ahmed Raza', phone: '03012345679' },
    { id: 'seed-457-12', customerNumber: 207, name: 'Ahmed Raza', phone: '03012345670' },
  ];
  // 'Ahmed Raza' sorts before 'Ahmedabad Khan' (the space sorts
  // before 'a'); the two 'Ahmed Raza' rows list the lower number
  // first. All three are prefix matches for 'ahmed'.
  assert.deepEqual(ids(rankCustomerSearchResults(ties, 'ahmed')), [
    'seed-457-12',
    'seed-457-10',
    'seed-457-11',
  ]);
});

test('a phonetic name match is a name match, never an exact match', () => {
  // "Fesal" finds "Faisal" through the phonetic matcher, but only
  // as a contains-tier name match; a literal "Fesal" outranks it.
  assert.equal(customerSearchRank(CUSTOMERS[2], 'fesal'), SEARCH_RESULT_RANK_CONTAINS);
  const literalFirst = [
    CUSTOMERS[2],
    { id: 'seed-457-13', customerNumber: 206, name: 'Fesal Raza', phone: '03012345673' },
  ];
  assert.deepEqual(ids(rankCustomerSearchResults(literalFirst, 'fesal')), [
    'seed-457-13',
    'seed-457-03',
  ]);
  // "M. Aslam" finds "Muhammad Aslam" the same way.
  assert.equal(
    customerSearchRank({ id: 'seed-457-14', customerNumber: 210, name: 'Muhammad Aslam' }, 'M. Aslam'),
    SEARCH_RESULT_RANK_CONTAINS,
  );
});

test('a nickname match needs the father name, an alias, or the landlord name', () => {
  assert.equal(
    customerSearchRank({ id: 'seed-457-15', customerNumber: 211, name: 'Zubair Khan', landlordOrGuarantorName: 'Ahmed Raza' }, 'ahmed'),
    SEARCH_RESULT_RANK_NICKNAME,
  );
  // A query that matches nothing on the record carries no relevance.
  assert.equal(customerSearchRank(CUSTOMERS[0], 'zubair'), SEARCH_RESULT_RANK_OTHER);
  assert.equal(customerSearchRank(CUSTOMERS[0], ''), SEARCH_RESULT_RANK_OTHER);
  assert.equal(customerSearchRank(null, 'ahmed'), SEARCH_RESULT_RANK_OTHER);
  assert.equal(customerSearchRank(undefined, 'ahmed'), SEARCH_RESULT_RANK_OTHER);
});

test('Urdu names rank by the same tiers', () => {
  const urdu = [
    { id: 'seed-457-20', customerNumber: 220, name: 'فیصل احمد', phone: '03012345678' },
    { id: 'seed-457-21', customerNumber: 221, name: 'احمد رضا', phone: '03012345679' },
    { id: 'seed-457-22', customerNumber: 222, name: 'احمد', phone: '03012345670' },
  ];
  assert.equal(customerSearchRank(urdu[2], 'احمد'), SEARCH_RESULT_RANK_EXACT);
  assert.equal(customerSearchRank(urdu[1], 'احمد'), SEARCH_RESULT_RANK_PREFIX);
  assert.equal(customerSearchRank(urdu[0], 'احمد'), SEARCH_RESULT_RANK_CONTAINS);
  assert.deepEqual(ids(rankCustomerSearchResults(urdu, 'احمد')), [
    'seed-457-22',
    'seed-457-21',
    'seed-457-20',
  ]);
});

test('results that matched by another field keep the order they arrived in', () => {
  // Every fixture phone contains '0301234567', so a phone query
  // matches them all by phone only — no name relevance — and the
  // ranking must not shuffle the caller's own order.
  const shuffled = [CUSTOMERS[4], CUSTOMERS[1], CUSTOMERS[3], CUSTOMERS[0], CUSTOMERS[2]];
  assert.deepEqual(ids(rankCustomerSearchResults(shuffled, '0301234567')), ids(shuffled));
});

test('a blank query returns the list unchanged, and ranking never mutates', () => {
  const before = CUSTOMERS.map((c) => ({ ...c }));
  const ranked = rankCustomerSearchResults(CUSTOMERS, '   ');
  assert.deepEqual(ids(ranked), ids(CUSTOMERS));
  assert.notEqual(ranked, CUSTOMERS);
  assert.deepEqual(ranked[0], CUSTOMERS[0]);
  // The ranked list holds the same record references, in a new array.
  assert.equal(rankCustomerSearchResults(CUSTOMERS, 'ahmed')[0], CUSTOMERS[1]);
  // The input list and its records are untouched by ranking.
  assert.deepEqual(CUSTOMERS, before);
  assert.deepEqual(rankCustomerSearchResults([], 'ahmed'), []);
  assert.deepEqual(rankCustomerSearchResults(null, 'ahmed'), []);
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../search-result-ranking.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false);
  assert.equal(module.includes('localStorage'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches pure helpers, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});

test('wiring: the fast sheet ranks a name query and keeps dues order without one', async () => {
  const { searchFastCustomers } = await import('../nav-customer-search.js');
  const state = {
    customers: [
      {
        id: 'seed-457-30', customerNumber: 205, name: 'Ahmed Raza', phone: '03012345678',
        area: 'Shahdara', mohalla: 'Shahdara', archived: false,
        bills: [{ month: '2026-10', dueAmount: 3000, payments: [] }],
      },
      {
        id: 'seed-457-31', customerNumber: 201, name: 'Ahmed', phone: '03012345679',
        area: 'Shahdara', mohalla: 'Shahdara', archived: false,
        bills: [{ month: '2026-10', dueAmount: 2000, payments: [{ id: 'p-1', amount: 2000, date: '2026-10-02', method: 'JazzCash' }] }],
      },
      {
        id: 'seed-457-32', customerNumber: 203, name: 'Faisal Ahmed', phone: '03012345670',
        area: 'Dhok', mohalla: 'Dhok', archived: false,
        bills: [{ month: '2026-10', dueAmount: 2500, payments: [{ id: 'p-2', amount: 1000, date: '2026-10-05', method: 'Cash' }] }],
      },
    ],
  };
  const refDate = new Date('2026-10-15T10:00:00Z');

  // The old order was dues first — Ahmed Raza (3000) on top, the
  // exact 'Ahmed' (paid, 0) at the bottom. Relevance puts the exact
  // match first, then the prefix, then the contains.
  const ranked = searchFastCustomers(state, { query: 'ahmed' }, refDate);
  assert.deepEqual(ranked.map((r) => r.name), ['Ahmed', 'Ahmed Raza', 'Faisal Ahmed']);

  // With no query the dues order stands exactly as before.
  const unranked = searchFastCustomers(state, {}, refDate);
  assert.deepEqual(unranked.map((r) => r.name), ['Ahmed Raza', 'Faisal Ahmed', 'Ahmed']);

  // A phone query matches by another field only, so the dues order
  // stands there too.
  const byPhone = searchFastCustomers(state, { query: '0301234567' }, refDate);
  assert.deepEqual(byPhone.map((r) => r.name), ['Ahmed Raza', 'Faisal Ahmed', 'Ahmed']);
});

test('wiring: the fast sheet and the list import the ranking module', () => {
  const sheet = readFileSync(new URL('../nav-customer-search.js', import.meta.url), 'utf8');
  assert.ok(sheet.includes("from './search-result-ranking.js'"), 'the sheet imports the ranking module');
  assert.ok(sheet.includes('rankCustomerSearchResults(ordered, query)'), 'the sheet ranks a typed query');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './search-result-ranking.js?v=1.11.0'"), 'app.js imports the ranking module');
  assert.ok(app.includes('rankCustomerSearchResults(active, customerQuery)'), 'the list ranks name-search results');
  assert.ok(app.includes('rankCustomerSearchResults(archived, customerQuery)'), 'the archived panel ranks too');
});
