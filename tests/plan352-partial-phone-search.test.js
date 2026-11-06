import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  partialPhoneDigits,
  partialPhoneNationalDigits,
  partialPhoneQueryDigits,
  partialPhoneMatches,
  findCustomersByPartialPhone,
  partialPhoneSearchSummaryText,
} from '../partial-phone-search.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'partial-phone-search.js'), 'utf8');
const sheetSrc = readFileSync(join(dir, '..', 'nav-customer-search.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Ayesha Test',
    phone: '03415277081',
    customerPhone: '',
    landlordPhone: '',
    mohalla: 'Shahdara',
    archived: false,
    ...overrides,
  };
}

// --- partialPhoneDigits ---

test('digits: separators, spaces, parentheses and "+" are stripped', () => {
  assert.equal(partialPhoneDigits('0341-527 7081'), '03415277081');
  assert.equal(partialPhoneDigits('+92 (341) 527-7081'), '923415277081');
  assert.equal(partialPhoneDigits('0341.527.7081'), '03415277081');
});

test('digits: Arabic-Indic digits fold to ASCII', () => {
  assert.equal(partialPhoneDigits('٠٣٤١٥٢٧٧٠٨١'), '03415277081');
  assert.equal(partialPhoneDigits('۰۳۴۱۵۲۷۷۰۸۱'), '03415277081');
});

test('digits: blank or missing values give an empty string', () => {
  assert.equal(partialPhoneDigits(''), '');
  assert.equal(partialPhoneDigits(null), '');
  assert.equal(partialPhoneDigits(undefined), '');
  assert.equal(partialPhoneDigits('---'), '');
});

// --- partialPhoneNationalDigits ---

test('national: the 03 form collapses to the 10 national digits', () => {
  assert.equal(partialPhoneNationalDigits('03415277081'), '3415277081');
  assert.equal(partialPhoneNationalDigits('03001234567'), '3001234567');
});

test('national: +92 and 0092 forms collapse to the same digits', () => {
  assert.equal(partialPhoneNationalDigits('+92 341 5277081'), '3415277081');
  assert.equal(partialPhoneNationalDigits('00923415277081'), '3415277081');
  assert.equal(partialPhoneNationalDigits('923415277081'), '3415277081');
});

test('national: a bare 10-digit mobile starting with 3 is already national', () => {
  assert.equal(partialPhoneNationalDigits('3415277081'), '3415277081');
});

test('national: non-mobile shapes give an empty string', () => {
  assert.equal(partialPhoneNationalDigits('12345'), '');
  assert.equal(partialPhoneNationalDigits('0511234567'), '');
  assert.equal(partialPhoneNationalDigits(''), '');
});

// --- partialPhoneQueryDigits ---

test('query digits: three or more digits are a phone search', () => {
  assert.equal(partialPhoneQueryDigits('527'), '527');
  assert.equal(partialPhoneQueryDigits('527 7081'), '5277081');
  assert.equal(partialPhoneQueryDigits('0341-5277081'), '03415277081');
});

test('query digits: fewer than three digits, or no digits, is not a phone search', () => {
  assert.equal(partialPhoneQueryDigits('52'), '');
  assert.equal(partialPhoneQueryDigits('3'), '');
  assert.equal(partialPhoneQueryDigits('abc'), '');
  assert.equal(partialPhoneQueryDigits(''), '');
  assert.equal(partialPhoneQueryDigits(null), '');
});

// --- partialPhoneMatches ---

test('matches: the last digits find the customer', () => {
  assert.equal(partialPhoneMatches(customer(), '7081'), true);
  assert.equal(partialPhoneMatches(customer(), '277081'), true);
});

test('matches: middle digits find the customer', () => {
  assert.equal(partialPhoneMatches(customer(), '5277'), true);
  assert.equal(partialPhoneMatches(customer(), '15277'), true);
});

test('matches: the full number finds the customer', () => {
  assert.equal(partialPhoneMatches(customer(), '03415277081'), true);
  assert.equal(partialPhoneMatches(customer(), '3415277081'), true);
});

test('matches: separators in the stored number never hide a match', () => {
  const stored = customer({ phone: '0341-527 7081' });
  assert.equal(partialPhoneMatches(stored, '5277081'), true);
  assert.equal(partialPhoneMatches(stored, '03415277081'), true);
});

test('matches: separators in the typed query never hide a match', () => {
  assert.equal(partialPhoneMatches(customer(), '527-7081'), true);
  assert.equal(partialPhoneMatches(customer(), '0341 5277081'), true);
});

test('matches: a +92 stored number matches a query typed with the leading zero', () => {
  const stored = customer({ phone: '+92 341 5277081' });
  assert.equal(partialPhoneMatches(stored, '03415277081'), true);
  assert.equal(partialPhoneMatches(stored, '5277081'), true);
});

test('matches: a zero stored number matches a query typed with the country code', () => {
  assert.equal(partialPhoneMatches(customer(), '923415277081'), true);
  assert.equal(partialPhoneMatches(customer(), '+92 341 5277081'), true);
});

test('matches: fewer than three digits never match', () => {
  assert.equal(partialPhoneMatches(customer(), '52'), false);
  assert.equal(partialPhoneMatches(customer(), '0'), false);
  assert.equal(partialPhoneMatches(customer(), ''), false);
});

test('matches: digits the number does not contain never match', () => {
  assert.equal(partialPhoneMatches(customer(), '9999'), false);
  assert.equal(partialPhoneMatches(customer(), '03419999999'), false);
});

test('matches: the legacy customerPhone field matches too, but the landlord phone does not', () => {
  const alias = customer({ phone: '', customerPhone: '03001234567' });
  assert.equal(partialPhoneMatches(alias, '1234567'), true);
  const landlord = customer({ phone: '', landlordPhone: '03001234567' });
  assert.equal(partialPhoneMatches(landlord, '1234567'), false);
});

test('matches: a missing number or a missing customer never matches', () => {
  assert.equal(partialPhoneMatches(customer({ phone: '', customerPhone: '' }), '5277'), false);
  assert.equal(partialPhoneMatches(null, '5277'), false);
  assert.equal(partialPhoneMatches('not-an-object', '5277'), false);
});

// --- findCustomersByPartialPhone ---

test('finder: every match returns, in name order, with no customer missing', () => {
  const list = deepFreeze([
    customer({ id: 'CUST-3', name: 'Zara Test', phone: '03335277081' }),
    customer({ id: 'CUST-1', name: 'Ayesha Test', phone: '03415277081' }),
    customer({ id: 'CUST-2', name: 'Bilal Test', phone: '03005277081' }),
    customer({ id: 'CUST-4', name: 'Danish Test', phone: '03009998888' }),
  ]);
  const found = findCustomersByPartialPhone(list, '5277081');
  assert.deepEqual(found.map((entry) => entry.id), ['CUST-1', 'CUST-2', 'CUST-3']);
  assert.equal(found[0].name, 'Ayesha Test');
  assert.equal(found[0].mohalla, 'Shahdara');
});

test('finder: no match returns an empty list', () => {
  assert.deepEqual(findCustomersByPartialPhone([customer()], '9999'), []);
  assert.deepEqual(findCustomersByPartialPhone([], '5277'), []);
  assert.deepEqual(findCustomersByPartialPhone(null, '5277'), []);
});

test('finder: fewer than three digits returns an empty list', () => {
  assert.deepEqual(findCustomersByPartialPhone([customer()], '52'), []);
});

test('finder: archived customers never appear', () => {
  const list = [
    customer({ id: 'CUST-1', name: 'Ayesha Test', phone: '03415277081', archived: true }),
    customer({ id: 'CUST-2', name: 'Bilal Test', phone: '03005277081' }),
  ];
  assert.deepEqual(findCustomersByPartialPhone(list, '5277081').map((entry) => entry.id), ['CUST-2']);
});

test('finder: the input list is never mutated and names tie-break by id', () => {
  const list = [
    customer({ id: 'CUST-2', name: 'Same Test', phone: '03005277081' }),
    customer({ id: 'CUST-1', name: 'Same Test', phone: '03415277081' }),
  ];
  const before = list.map((entry) => entry.id);
  const found = findCustomersByPartialPhone(list, '5277081');
  assert.deepEqual(found.map((entry) => entry.id), ['CUST-1', 'CUST-2']);
  assert.deepEqual(list.map((entry) => entry.id), before);
});

// --- partialPhoneSearchSummaryText ---

test('summary: plain-words counts for none, one and many matches', () => {
  assert.equal(
    partialPhoneSearchSummaryText([], '5277'),
    'No customer found for phone digits 5277 — no phone number contains those digits.',
  );
  assert.equal(partialPhoneSearchSummaryText([customer()], '5277'), '1 customer found for phone digits 5277.');
  assert.equal(partialPhoneSearchSummaryText([customer(), customer()], '5277'), '2 customers found for phone digits 5277.');
});

test('summary: a query too short to search says so plainly', () => {
  assert.equal(partialPhoneSearchSummaryText([], '52'), 'Type at least 3 digits to search by phone.');
  assert.equal(partialPhoneSearchSummaryText([], ''), 'Type at least 3 digits to search by phone.');
});

// --- wiring, fences, purity ---

test('wiring: the fast customer search sheet uses the partial phone matcher', () => {
  assert.equal(sheetSrc.includes("from './partial-phone-search.js'"), true, 'sheet must import the partial phone module');
  assert.equal(sheetSrc.includes('partialPhoneMatches(customer, query)'), true, 'sheet phone branch must call the matcher');
  assert.equal(
    sheetSrc.includes('customer.phone.toLowerCase().includes(normalized)'),
    true,
    'the sheet keeps its existing plain-text phone branch too',
  );
});

test('fences: the module never names a fenced module file literally', () => {
  for (const fenced of ['customer-search-filter', 'nav-customer-search', 'duplicate-detection', 'core.js', 'fuzzy-alias-search', 'bulk-customer-import']) {
    assert.equal(moduleSrc.includes(fenced), false, `module must never contain ${fenced}`);
  }
});

test('purity: no clock, storage, network or page access, no store key, no forbidden word', () => {
  for (const banned of ['new Date(', 'Date.now(', 'document.', 'localStorage', 'fetch(', 'window.', 'import ', 'shahdara_']) {
    assert.equal(moduleSrc.includes(banned), false, `module must never contain ${banned}`);
  }
  assert.equal(/\bOLT\b/.test(moduleSrc), false, 'module must never contain the standalone word OLT');
});
