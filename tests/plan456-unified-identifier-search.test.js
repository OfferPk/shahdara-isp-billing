import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UNIFIED_IDENTIFIER_FIELD_ID,
  unifiedIdentifierIsExplicitId,
  unifiedIdentifierMatches,
  filterCustomersByUnifiedIdentifier,
  unifiedIdentifierEmptyText,
} from '../unified-identifier-search.js';

// Plan 456 — One search box for any identifier.
//
// Fixtures are invented and pattern-fake only: names are "First
// Last" fixtures (never a real customer), phones are the 03012345678
// family the PII ratchet allows, record ids are seed-*/UUID fixtures.
const CUSTOMERS = [
  { id: 'seed-001', customerNumber: 102, name: 'Faisal Ahmed', phone: '03012345678', mohalla: 'Shahdara', area: 'Shahdara' },
  { id: 'seed-002', customerNumber: 1021, name: 'Bilal Hussain', phone: '03012345679', mohalla: 'Shahdara', area: 'Shahdara' },
  { id: 'seed-003', customerNumber: 2102, name: 'Sara Khan', phone: '03012345670', mohalla: 'Dhok', area: 'Dhok' },
  { id: '3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d', customerNumber: 103, name: 'Ali Raza', phone: '03012345671', mohalla: 'Dhok', area: 'Dhok' },
  { id: 'seed-004', customerNumber: 123, name: 'Kamran Six', phone: '03012345673', mohalla: 'Shahdara', area: 'Shahdara' },
  { id: 'seed-005', customerNumber: 104, name: 'Usman Ghani', phone: '03012345672', mohalla: 'Shahdara', area: 'Shahdara', archived: true },
];

const ids = (list) => list.map((c) => c.id);

test('explicit IDs: a leading # or a dashed id with a digit names an ID only', () => {
  assert.equal(unifiedIdentifierIsExplicitId('#102'), true);
  assert.equal(unifiedIdentifierIsExplicitId('# 102'), true);
  assert.equal(unifiedIdentifierIsExplicitId('seed-001'), true);
  assert.equal(unifiedIdentifierIsExplicitId('SEED-001'), true);
  assert.equal(unifiedIdentifierIsExplicitId('3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d'), true);
  assert.equal(unifiedIdentifierIsExplicitId('abc-123'), true);
  assert.equal(unifiedIdentifierIsExplicitId('102'), false);
  assert.equal(unifiedIdentifierIsExplicitId('0301-2345678'), false);
  assert.equal(unifiedIdentifierIsExplicitId('0341 5277081'), false);
  assert.equal(unifiedIdentifierIsExplicitId('Faisal'), false);
  assert.equal(unifiedIdentifierIsExplicitId('123-456'), false);
  assert.equal(unifiedIdentifierIsExplicitId('#'), false);
  assert.equal(unifiedIdentifierIsExplicitId(''), false);
  assert.equal(unifiedIdentifierIsExplicitId(null), false);
});

test('a full ID returns that one customer alone — never look-alikes', () => {
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '102')), ['seed-001']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '#102')), ['seed-001']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, ' 102 ')), ['seed-001']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '1021')), ['seed-002']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'seed-001')), ['seed-001']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'SEED-001')), ['seed-001']);
  assert.deepEqual(
    ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '3F8A2C1E-7B4D-4A1E-9C2D-5E6F7A8B9C0D')),
    ['3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d'],
  );
});

test('an exact ID wins over a phone that contains the same digits', () => {
  // Every fixture phone contains "123", so without the exact-ID
  // rule "123" would drag in the whole list; with it, #123 alone.
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '123')), ['seed-004']);
  // The predicate alone answers per customer, so it may match a
  // phone too — the list filter is what returns the hit alone.
  assert.equal(unifiedIdentifierMatches(CUSTOMERS[0], '123'), true);
  assert.equal(unifiedIdentifierMatches(CUSTOMERS[4], '123'), true);
});

test('an explicit ID with no exact hit returns nobody — the box never guesses a phone', () => {
  // "1234" sits in every fixture phone, so a fall-through would
  // return the whole list; the "#" marks it as an ID instead.
  assert.deepEqual(filterCustomersByUnifiedIdentifier(CUSTOMERS, '#1234'), []);
  assert.deepEqual(filterCustomersByUnifiedIdentifier(CUSTOMERS, '#999'), []);
  assert.deepEqual(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'seed-999'), []);
  assert.deepEqual(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'abc-999'), []);
});

test('a bare ID-shaped query with no exact hit falls through to phone digits', () => {
  // No customer #1234 exists, so "1234" is read as phone digits —
  // every fixture phone contains them, archived included (the
  // filter never excludes archived; callers split them).
  assert.deepEqual(
    ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '1234')),
    ['seed-001', 'seed-002', 'seed-003', '3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d', 'seed-004', 'seed-005'],
  );
});

test('any digits of a phone number find the customer, whatever the formatting', () => {
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '5678')), ['seed-001']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '5679')), ['seed-002']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '5670')), ['seed-003']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '0301 234 5679')), ['seed-002']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '+92 301 2345670')), ['seed-003']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '03012345671')), ['3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d']);
  // Middle digits match every fixture phone that contains them.
  assert.deepEqual(
    ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '34567')),
    ['seed-001', 'seed-002', 'seed-003', '3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d', 'seed-004', 'seed-005'],
  );
});

test('fewer than three digits is never a phone search', () => {
  // "99" matches no name and no phone (under three digits), and no
  // customer #99 exists — so the box finds nobody.
  assert.deepEqual(filterCustomersByUnifiedIdentifier(CUSTOMERS, '99'), []);
  assert.equal(unifiedIdentifierMatches(CUSTOMERS[0], '99'), false);
});

test('a name finds its customer, case-insensitively and phonetically', () => {
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'faisal')), ['seed-001']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'FAISAL AHMED')), ['seed-001']);
  // SISP-165: Roman-Urdu spelling variants match phonetically.
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'Fesal')), ['seed-001']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'bilal')), ['seed-002']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'sara khan')), ['seed-003']);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'ali')), ['3f8a2c1e-7b4d-4a1e-9c2d-5e6f7a8b9c0d']);
});

test('a blank query returns the list unchanged — same order, new array', () => {
  const out = filterCustomersByUnifiedIdentifier(CUSTOMERS, '');
  assert.deepEqual(ids(out), ids(CUSTOMERS));
  assert.notEqual(out, CUSTOMERS);
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, '   ')), ids(CUSTOMERS));
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, null)), ids(CUSTOMERS));
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, undefined)), ids(CUSTOMERS));
});

test('robust inputs: a missing record never matches, a non-list is empty', () => {
  assert.deepEqual(filterCustomersByUnifiedIdentifier(null, 'faisal'), []);
  assert.deepEqual(filterCustomersByUnifiedIdentifier(undefined, 'faisal'), []);
  assert.deepEqual(filterCustomersByUnifiedIdentifier('nope', 'faisal'), []);
  assert.equal(unifiedIdentifierMatches(null, 'faisal'), false);
  assert.equal(unifiedIdentifierMatches(undefined, 'faisal'), false);
  assert.equal(unifiedIdentifierMatches('nope', 'faisal'), false);
  const mixed = [null, CUSTOMERS[0], undefined, CUSTOMERS[1]];
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(mixed, 'faisal')), ['seed-001']);
});

test('archived customers are not excluded by the filter — callers split them', () => {
  assert.deepEqual(ids(filterCustomersByUnifiedIdentifier(CUSTOMERS, 'usman')), ['seed-005']);
});

test('searching never changes any record or the input list', () => {
  const before = JSON.stringify(CUSTOMERS);
  const orderBefore = ids(CUSTOMERS);
  filterCustomersByUnifiedIdentifier(CUSTOMERS, 'faisal');
  filterCustomersByUnifiedIdentifier(CUSTOMERS, '5678');
  filterCustomersByUnifiedIdentifier(CUSTOMERS, '#999');
  assert.equal(JSON.stringify(CUSTOMERS), before);
  assert.deepEqual(ids(CUSTOMERS), orderBefore);
});

test('an empty search says so plainly — an ID earns the unknown-ID text', () => {
  assert.equal(
    unifiedIdentifierEmptyText('999'),
    'No customer with ID #999 found. Check the ID and try again.',
  );
  assert.equal(
    unifiedIdentifierEmptyText('#999'),
    'No customer with ID #999 found. Check the ID and try again.',
  );
  assert.equal(
    unifiedIdentifierEmptyText('seed-999'),
    'No customer with ID seed-999 found. Check the ID and try again.',
  );
  assert.equal(unifiedIdentifierEmptyText('unknownname'), '');
  assert.equal(unifiedIdentifierEmptyText('5678'), 'No customer with ID #5678 found. Check the ID and try again.');
  assert.equal(unifiedIdentifierEmptyText(''), '');
  assert.equal(unifiedIdentifierEmptyText(null), '');
});

test('the unified field id is the Any identifier option', () => {
  assert.equal(UNIFIED_IDENTIFIER_FIELD_ID, 'any');
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../unified-identifier-search.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false);
  assert.equal(module.includes('localStorage'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches pure helpers, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});

test('wiring: the list offers Any identifier first and defaults to it', () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(index.includes('id="customerSearchField"'), 'field select exists');
  assert.ok(index.includes('<option value="any" selected'), 'Any identifier is the selected option');
  assert.ok(index.includes('data-i18n="cust_search_field_any"'), 'Any identifier option is localised');
  const language = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
  assert.ok(language.includes('cust_search_field_any:'), 'nav-language.js carries the Any identifier label');
  assert.ok(language.includes('Any identifier'), 'the English label is present');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './unified-identifier-search.js?v=1.11.0'"), 'app.js imports the unified module');
  assert.ok(app.includes('let customerSearchField = UNIFIED_IDENTIFIER_FIELD_ID'), 'the list defaults to the unified box');
  assert.ok(app.includes('filterCustomersByUnifiedIdentifier'), 'roster render applies the unified filter');
  assert.ok(app.includes('unifiedIdentifierEmptyText'), 'roster render shows the plain empty text');
  const formValidation = readFileSync(new URL('../form-validation.js', import.meta.url), 'utf8');
  assert.ok(formValidation.includes('renderCustomerTableEmptyMarkup(query = \'\', area = \'all\', emptyText = \'\')'), 'table empty markup takes an override message');
});
