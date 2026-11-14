import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KNOWN_AS_FATHER_LABEL_KEY,
  KNOWN_AS_ALIAS_LABEL_KEY,
  KNOWN_AS_FATHER_MAX_LENGTH,
  KNOWN_AS_ALIAS_MAX_LENGTH,
  knownAsNameFor,
  knownAsLabelKeyFor,
  hasKnownAsName,
} from '../known-as-name.js';
import { createInitialState, updateCustomerProfile } from '../core.js';
import { searchFastCustomers, renderFastCustomerSearchResultsHtml } from '../nav-customer-search.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'known-as-name.js'), 'utf8');
const appSrc = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const sheetSrc = readFileSync(join(dir, '..', 'nav-customer-search.js'), 'utf8');
const stylesSrc = readFileSync(join(dir, '..', 'styles.css'), 'utf8');

// Generic fixtures only — clearly made-up names, never a real customer.
function customer(overrides = {}) {
  return {
    id: 'CUST-1',
    name: 'Ali Raza',
    ...overrides,
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// --- knownAsNameFor ---

test('name: the father / reference name wins, trimmed', () => {
  assert.equal(knownAsNameFor(customer({ fatherOrReferenceName: '  Muhammad Aslam  ' })), 'Muhammad Aslam');
});

test('name: a whitespace-only father name falls through to the first nickname', () => {
  assert.equal(knownAsNameFor(customer({ fatherOrReferenceName: '   ', searchAliases: ['Haji Sahab'] })), 'Haji Sahab');
});

test('name: first nickname when there is no father name', () => {
  assert.equal(knownAsNameFor(customer({ searchAliases: ['Haji Sahab', 'Corner Store'] })), 'Haji Sahab');
});

test('name: the nickname list skips empty and whitespace-only entries', () => {
  assert.equal(knownAsNameFor(customer({ searchAliases: ['', '  ', 'Nickname One', 'Nickname Two'] })), 'Nickname One');
});

test('name: comma-separated string form of the nickname list works too', () => {
  assert.equal(knownAsNameFor(customer({ searchAliases: 'Haji Sahab, Corner Store' })), 'Haji Sahab');
});

test('name: no father name and no nicknames gives an empty string', () => {
  assert.equal(knownAsNameFor(customer({})), '');
  assert.equal(knownAsNameFor(customer({ fatherOrReferenceName: '', searchAliases: [] })), '');
  assert.equal(knownAsNameFor(customer({ searchAliases: [' ', ''] })), '');
});

test('name: null, undefined and non-object customers give an empty string', () => {
  assert.equal(knownAsNameFor(null), '');
  assert.equal(knownAsNameFor(undefined), '');
  assert.equal(knownAsNameFor('Ali Raza'), '');
});

test('name: a father name longer than the save-time cap renders capped', () => {
  const long = 'A'.repeat(KNOWN_AS_FATHER_MAX_LENGTH + 25);
  assert.equal(knownAsNameFor(customer({ fatherOrReferenceName: long })).length, KNOWN_AS_FATHER_MAX_LENGTH);
});

test('name: a nickname longer than the save-time cap renders capped', () => {
  const long = 'B'.repeat(KNOWN_AS_ALIAS_MAX_LENGTH + 25);
  assert.equal(knownAsNameFor(customer({ searchAliases: [long] })).length, KNOWN_AS_ALIAS_MAX_LENGTH);
});

test('name: the input is never mutated', () => {
  const input = deepFreeze(customer({ fatherOrReferenceName: 'Muhammad Aslam', searchAliases: ['Haji Sahab'] }));
  assert.equal(knownAsNameFor(input), 'Muhammad Aslam');
});

// --- knownAsLabelKeyFor ---

test('label: the father label key when the name came from the father field', () => {
  assert.equal(knownAsLabelKeyFor(customer({ fatherOrReferenceName: 'Muhammad Aslam' })), KNOWN_AS_FATHER_LABEL_KEY);
  assert.equal(KNOWN_AS_FATHER_LABEL_KEY, 'fas_field_father');
});

test('label: the also-known-as label key when the name came from a nickname', () => {
  assert.equal(knownAsLabelKeyFor(customer({ searchAliases: ['Haji Sahab'] })), KNOWN_AS_ALIAS_LABEL_KEY);
  assert.equal(KNOWN_AS_ALIAS_LABEL_KEY, 'fas_field_aliases');
});

test('label: empty key when there is no known-as name', () => {
  assert.equal(knownAsLabelKeyFor(customer({})), '');
  assert.equal(knownAsLabelKeyFor(customer({ fatherOrReferenceName: '  ', searchAliases: [] })), '');
});

test('label: whitespace-only father plus a nickname gives the nickname key', () => {
  assert.equal(knownAsLabelKeyFor(customer({ fatherOrReferenceName: ' ', searchAliases: ['Haji Sahab'] })), KNOWN_AS_ALIAS_LABEL_KEY);
});

// --- hasKnownAsName ---

test('has: true with a father name, true with a nickname, false with neither', () => {
  assert.equal(hasKnownAsName(customer({ fatherOrReferenceName: 'Muhammad Aslam' })), true);
  assert.equal(hasKnownAsName(customer({ searchAliases: ['Haji Sahab'] })), true);
  assert.equal(hasKnownAsName(customer({})), false);
  assert.equal(hasKnownAsName(customer({ fatherOrReferenceName: ' ', searchAliases: [''] })), false);
});

// --- the existing profile fields are the source: adding one changes only that field ---

test('profile: saving a father name through the profile update makes it the known-as name, billing name untouched', () => {
  const refDate = new Date('2026-11-06T12:00:00+05:00');
  let state = createInitialState(['Ali Raza']);
  const before = state.customers[0];
  state = updateCustomerProfile(state, 'seed-001', { fatherOrReferenceName: 'Muhammad Aslam' }, refDate);
  const after = state.customers[0];
  assert.equal(knownAsNameFor(after), 'Muhammad Aslam');
  assert.equal(knownAsLabelKeyFor(after), 'fas_field_father');
  assert.equal(after.name, before.name);
  assert.equal(after.monthlySellingAmount, before.monthlySellingAmount);
});

test('profile: saving nicknames through the profile update makes the first one the known-as name', () => {
  const refDate = new Date('2026-11-06T12:00:00+05:00');
  let state = createInitialState(['Ali Raza']);
  state = updateCustomerProfile(state, 'seed-001', { searchAliases: 'Haji Sahab, Corner Store' }, refDate);
  const after = state.customers[0];
  assert.equal(knownAsNameFor(after), 'Haji Sahab');
  assert.equal(knownAsLabelKeyFor(after), 'fas_field_aliases');
  assert.equal(after.name, 'Ali Raza');
});

// --- fast search sheet: known-as rides along with search results and recents ---

function stateWithKnownAs() {
  const refDate = new Date('2026-11-06T12:00:00+05:00');
  let state = createInitialState(['Ali Raza', 'Bilal Ahmed', 'Danish Iqbal']);
  state = updateCustomerProfile(state, 'seed-001', { fatherOrReferenceName: 'Muhammad Aslam' }, refDate);
  state = updateCustomerProfile(state, 'seed-002', { searchAliases: ['Haji Sahab'] }, refDate);
  return { state, refDate };
}

test('sheet: search results carry the known-as name and its label key', () => {
  const { state, refDate } = stateWithKnownAs();
  const results = searchFastCustomers(state, { query: '' }, refDate);
  const byId = new Map(results.map((c) => [c.id, c]));
  assert.equal(byId.get('seed-001').knownAs, 'Muhammad Aslam');
  assert.equal(byId.get('seed-001').knownAsLabelKey, 'fas_field_father');
  assert.equal(byId.get('seed-002').knownAs, 'Haji Sahab');
  assert.equal(byId.get('seed-002').knownAsLabelKey, 'fas_field_aliases');
  assert.equal(byId.get('seed-003').knownAs, '');
  assert.equal(byId.get('seed-003').knownAsLabelKey, '');
});

test('sheet: the rendered search card shows the known-as line beside the name', () => {
  const { state, refDate } = stateWithKnownAs();
  const results = searchFastCustomers(state, { query: '' }, refDate);
  const html = renderFastCustomerSearchResultsHtml(results, { isRecent: false });
  assert.ok(html.includes('Father / reference: Muhammad Aslam'), 'father line is shown');
  assert.ok(html.includes('Also known as: Haji Sahab'), 'nickname line is shown');
  assert.ok(html.includes('fcs-known-as'), 'known-as class is present');
  // The plain customer has no known-as line at all.
  const plain = results.filter((c) => c.id === 'seed-003');
  assert.ok(!renderFastCustomerSearchResultsHtml(plain, { isRecent: false }).includes('fcs-known-as'));
});

test('sheet: the rendered recent list shows the known-as line too', () => {
  const { state, refDate } = stateWithKnownAs();
  const results = searchFastCustomers(state, { query: '' }, refDate);
  const html = renderFastCustomerSearchResultsHtml(results, { isRecent: true });
  assert.ok(html.includes('Father / reference: Muhammad Aslam'));
  assert.ok(html.includes('Also known as: Haji Sahab'));
});

test('sheet: a known-as value with markup is escaped in the rendered card', () => {
  const { state, refDate } = stateWithKnownAs();
  const results = searchFastCustomers(state, { query: '' }, refDate);
  const dangerous = { ...results[0], knownAs: '<b>Nick</b>', knownAsLabelKey: 'fas_field_aliases' };
  const html = renderFastCustomerSearchResultsHtml([dangerous], { isRecent: false });
  assert.ok(html.includes('&lt;b&gt;Nick&lt;/b&gt;'), 'markup is escaped');
  assert.ok(!html.includes('<b>Nick</b>'), 'raw markup never reaches the page');
});

// --- purity, fence, wiring ---

test('purity: the module is pure and import-free — no storage, clock, network, or neighbour names', () => {
  for (const forbidden of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.equal(moduleSrc.includes(forbidden), false, `module must not contain ${forbidden}`);
  }
  // The existing alias module was checked by filename first and is
  // neither read nor rewritten here, so this module never names it —
  // the name is built from fragments so the literal filename appears
  // nowhere in this file either.
  const aliasModule = 'fuzzy-' + 'alias-' + 'search';
  const ownSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.equal(moduleSrc.includes(`${aliasModule}.js`), false, 'module must not name the alias module file');
  assert.equal(ownSrc.includes(`${aliasModule}.js`), false, 'test must not name the alias module file');
});

test('wiring: the app imports the module and shows the known-as name beside the formal name on cards and in global search', () => {
  assert.ok(appSrc.includes("from './known-as-name.js'"), 'app imports the known-as module');
  assert.ok(appSrc.includes('function knownAsInlineHtml(customer, className)'), 'app has the inline known-as helper');
  const cardStart = appSrc.indexOf('function customerCardMarkup(');
  const cardEnd = appSrc.indexOf('function ', cardStart + 10);
  // Customers Cards Compact retired the card's inline known-as line:
  // the name is a pill in the sub-line row, built from knownAsNameFor
  // with the Father/Ref or alias short label. Global search keeps the
  // inline helper (asserted below).
  assert.ok(appSrc.slice(cardStart, cardEnd).includes('knownAsNameFor(customer)'), 'customer card derives the known-as name from the module');
  assert.ok(appSrc.slice(cardStart, cardEnd).includes("'cust_card_father_ref_short'"), 'card pill uses the Father/Ref short label');
  assert.ok(appSrc.slice(cardStart, cardEnd).includes("'cust_card_alias_short'"), 'card pill uses the alias short label');
  assert.ok(!appSrc.slice(cardStart, cardEnd).includes("knownAsInlineHtml(customer, 'customer-known-as')"), 'card no longer renders the inline known-as line');
  const globalStart = appSrc.indexOf('function renderGlobalSearch(');
  const globalEnd = appSrc.indexOf('function ', globalStart + 10);
  assert.ok(appSrc.slice(globalStart, globalEnd).includes("knownAsInlineHtml(customer, 'global-result-known-as')"), 'global search result shows the known-as line');
});

test('wiring: the profile header shows the known-as line beside the formal name and hides it when there is none', () => {
  assert.ok(indexSrc.includes('<p id="detailKnownAs" class="detail-known-as" hidden></p>'), 'page carries the known-as line element');
  assert.ok(indexSrc.indexOf('id="detailKnownAs"') > indexSrc.indexOf('id="detailNameSub"'), 'known-as line sits after the name subtitle');
  assert.ok(appSrc.includes("$('#detailKnownAs')"), 'app writes the known-as line');
  assert.ok(appSrc.includes('knownAsNameFor(customer)'), 'app derives the line from the known-as module');
  assert.ok(appSrc.includes('t(knownAsLabelKeyFor(customer))'), 'app translates the known-as label');
  assert.ok(appSrc.includes('detailKnownAsEl.hidden = false'), 'app shows the line when a known-as name exists');
  assert.ok(appSrc.includes('detailKnownAsEl.hidden = true'), 'app hides the line when there is none');
});

test('wiring: the fast search sheet imports the module, carries the known-as fields, and renders them', () => {
  assert.ok(sheetSrc.includes("from './known-as-name.js'"), 'sheet imports the known-as module');
  assert.ok(sheetSrc.includes('knownAs: knownAsNameFor(customer)'), 'search results carry the known-as name');
  assert.ok(sheetSrc.includes('knownAsLabelKey: knownAsLabelKeyFor(customer)'), 'search results carry the known-as label key');
  assert.ok(sheetSrc.includes('fcs-known-as'), 'sheet renders the known-as line');
});

test('wiring: the stylesheet styles the known-as lines, including dark mode', () => {
  for (const cls of ['.detail-known-as', '.customer-known-as', '.global-result-known-as', '.fcs-known-as']) {
    assert.ok(stylesSrc.includes(cls), `stylesheet has ${cls}`);
  }
  assert.ok(stylesSrc.includes('[data-theme="dark"] .detail-known-as'), 'dark mode styles the profile known-as line');
});
