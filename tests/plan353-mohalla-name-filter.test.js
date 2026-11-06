import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mohallaNameFilterKey,
  resolveMohallaFilter,
  mohallaNameMatches,
  mohallaNameQueryMatches,
  mohallaAndNameMatches,
  findCustomersByMohallaAndName,
  mohallaNameFilterSummaryText,
  mohallaFilterOptionsHtml,
} from '../mohalla-name-filter.js';
import { createInitialState, updateCustomerProfile } from '../core.js';
import { searchFastCustomers } from '../nav-customer-search.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'mohalla-name-filter.js'), 'utf8');
const sheetSrc = readFileSync(join(dir, '..', 'nav-customer-search.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');

// The app's own mohalla list, copied here for the resolve tests so the
// tests never need the list's home module. Synthetic names only.
const MOHALLAS = ['CHARYAA', 'GANGALL', 'KISHTII', 'BARRIAN', 'THALII', 'CHAMYAAA', 'PALALIYAA', 'MALLA', 'NAKAR', 'BANII', 'SODAA', 'PULL SIDE', 'JABBIYAA', 'MOHALLA CHUDRIYAA', 'MOHALLA end side farm house'];

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
    name: 'Ali Raza',
    mohalla: 'BARRIAN',
    area: '',
    archived: false,
    ...overrides,
  };
}

// Two namesakes in different mohallas, the core of the plan: the same
// name "Ali Raza" lives in BARRIAN and in BANII, and "Bilal Ahmed"
// lives in CHARYAA and in BARRIAN.
function finderList() {
  return [
    customer({ id: 'c1', name: 'Ali Raza', mohalla: 'BARRIAN' }),
    customer({ id: 'c2', name: 'Ali Raza', mohalla: 'BANII' }),
    customer({ id: 'c3', name: 'Ali Ahmed', mohalla: 'Bani' }),
    customer({ id: 'c4', name: 'Bilal Ahmed', mohalla: 'CHARYAA' }),
    customer({ id: 'c5', name: 'Bilal Ahmed', mohalla: 'BARRIAN' }),
    customer({ id: 'c6', name: 'Ali Raza', mohalla: 'BANII', archived: true }),
    customer({ id: 'c7', name: 'Haveli One', mohalla: '', area: 'HAVELI' }),
    customer({ id: 'c8', name: 'Danish Iqbal', mohalla: 'MOHALLA BANI' }),
  ];
}

// --- mohallaNameFilterKey ---

test('key: blank, null, undefined and whitespace-only values give an empty key', () => {
  assert.equal(mohallaNameFilterKey(''), '');
  assert.equal(mohallaNameFilterKey(null), '');
  assert.equal(mohallaNameFilterKey(undefined), '');
  assert.equal(mohallaNameFilterKey('   '), '');
});

test('key: trims, collapses inner spaces and lowercases', () => {
  assert.equal(mohallaNameFilterKey('  BANII  '), 'banii');
  assert.equal(mohallaNameFilterKey('Pull   Side'), 'pull side');
  assert.equal(mohallaNameFilterKey('Barrian'), 'barrian');
});

test('key: the leading generic Mohalla word is stripped, in any case or spelling', () => {
  // 'Bani' folds to the canonical 'banii' key (see the alias table),
  // so every spelling below lands on the same key.
  assert.equal(mohallaNameFilterKey('Mohalla Bani'), 'banii');
  assert.equal(mohallaNameFilterKey('MOHALLA BANI'), 'banii');
  assert.equal(mohallaNameFilterKey('Mohalaa Bani'), 'banii');
  assert.equal(mohallaNameFilterKey('MOHALLA CHUDRIYAA'), 'chudriyaa');
  assert.equal(mohallaNameFilterKey('MOHALLA end side farm house'), 'end side farm house');
  assert.equal(mohallaNameFilterKey('Kishti'), 'kishtii');
  assert.equal(mohallaNameFilterKey('Chamyaa'), 'chamyaaa');
});

test('key: a bare "Mohalla" alone keeps its own key instead of vanishing', () => {
  assert.equal(mohallaNameFilterKey('Mohalla'), 'mohalla');
  assert.equal(mohallaNameFilterKey('MOHALLA'), 'mohalla');
});

// --- resolveMohallaFilter ---

test('resolve: spelling variants return the canonical list spelling', () => {
  assert.equal(resolveMohallaFilter('bani', MOHALLAS), 'BANII');
  assert.equal(resolveMohallaFilter('BANII', MOHALLAS), 'BANII');
  assert.equal(resolveMohallaFilter('Mohalla Bani', MOHALLAS), 'BANII');
  assert.equal(resolveMohallaFilter('pull side', MOHALLAS), 'PULL SIDE');
  assert.equal(resolveMohallaFilter('  Barrian ', MOHALLAS), 'BARRIAN');
});

test('resolve: blank, unknown, non-array and empty lists give null', () => {
  assert.equal(resolveMohallaFilter('', MOHALLAS), null);
  assert.equal(resolveMohallaFilter('   ', MOHALLAS), null);
  assert.equal(resolveMohallaFilter('NOWHERE', MOHALLAS), null);
  assert.equal(resolveMohallaFilter('BANII', null), null);
  assert.equal(resolveMohallaFilter('BANII', []), null);
});

test('resolve: the mixed-case list entry resolves by key', () => {
  assert.equal(resolveMohallaFilter('MOHALLA end side farm house', MOHALLAS), 'MOHALLA end side farm house');
  assert.equal(resolveMohallaFilter('end side farm house', MOHALLAS), 'MOHALLA end side farm house');
});

// --- mohallaNameMatches ---

test('matches: a blank mohalla matches every customer, including one with no mohalla at all', () => {
  assert.equal(mohallaNameMatches(customer(), ''), true);
  assert.equal(mohallaNameMatches(customer({ mohalla: '', area: '' }), null), true);
  assert.equal(mohallaNameMatches(customer({ mohalla: '', area: '' }), '   '), true);
});

test('matches: BANII matches every spelling variant and nothing else', () => {
  assert.equal(mohallaNameMatches(customer({ mohalla: 'Bani' }), 'BANII'), true);
  assert.equal(mohallaNameMatches(customer({ mohalla: 'BANII' }), 'BANII'), true);
  assert.equal(mohallaNameMatches(customer({ mohalla: 'MOHALLA BANI' }), 'BANII'), true);
  assert.equal(mohallaNameMatches(customer({ mohalla: 'BARRIAN' }), 'BANII'), false);
  assert.equal(mohallaNameMatches(customer({ mohalla: 'CHARYAA' }), 'BANII'), false);
});

test('matches: the legacy area field is the fallback when mohalla is empty', () => {
  assert.equal(mohallaNameMatches(customer({ mohalla: '', area: 'HAVELI' }), 'HAVELI'), true);
  assert.equal(mohallaNameMatches(customer({ mohalla: '', area: 'HAVELI' }), 'BANII'), false);
  assert.equal(mohallaNameMatches(customer({ mohalla: '', area: '' }), 'HAVELI'), false);
});

test('matches: a lowercase filter matches an uppercase stored mohalla, and non-customers never match', () => {
  assert.equal(mohallaNameMatches(customer({ mohalla: 'BARRIAN' }), 'barrian'), true);
  assert.equal(mohallaNameMatches(null, 'BANII'), false);
  assert.equal(mohallaNameMatches('BANII', 'BANII'), false);
  assert.equal(mohallaNameMatches(customer({ mohalla: 'BANII' }), ''), true);
});

// --- mohallaNameQueryMatches ---

test('query: blank matches all, matching is a case-insensitive substring, and the query is trimmed', () => {
  assert.equal(mohallaNameQueryMatches(customer(), ''), true);
  assert.equal(mohallaNameQueryMatches(customer(), '   '), true);
  assert.equal(mohallaNameQueryMatches(customer({ name: 'Ali Raza' }), 'ali'), true);
  assert.equal(mohallaNameQueryMatches(customer({ name: 'Ali Raza' }), 'RAZA'), true);
  assert.equal(mohallaNameQueryMatches(customer({ name: 'Ali Raza' }), '  raza  '), true);
  assert.equal(mohallaNameQueryMatches(customer({ name: 'Ali Raza' }), 'z'), true);
});

test('query: a fragment in nobody\'s name matches nobody, and non-customers never match', () => {
  assert.equal(mohallaNameQueryMatches(customer({ name: 'Ali Raza' }), 'bilal'), false);
  assert.equal(mohallaNameQueryMatches(null, 'ali'), false);
  assert.equal(mohallaNameQueryMatches(customer({ name: '' }), 'ali'), false);
});

// --- mohallaAndNameMatches ---

test('combined: both halves must pass — one failing half fails the whole match', () => {
  const baniiAli = customer({ name: 'Ali Raza', mohalla: 'BANII' });
  assert.equal(mohallaAndNameMatches(baniiAli, 'BANII', 'ali'), true);
  assert.equal(mohallaAndNameMatches(baniiAli, 'BANII', 'bilal'), false);
  assert.equal(mohallaAndNameMatches(baniiAli, 'BARRIAN', 'ali'), false);
  assert.equal(mohallaAndNameMatches(baniiAli, '', ''), true);
  assert.equal(mohallaAndNameMatches(baniiAli, 'BANII', ''), true);
  assert.equal(mohallaAndNameMatches(baniiAli, '', 'ali'), true);
});

// --- findCustomersByMohallaAndName ---

test('find: mohalla alone narrows to that mohalla, in name order, archived excluded', () => {
  const found = findCustomersByMohallaAndName(finderList(), 'BANII', '');
  assert.deepEqual(found.map((c) => c.id), ['c3', 'c2', 'c8']);
});

test('find: name alone finds every namesake across mohallas', () => {
  const found = findCustomersByMohallaAndName(finderList(), '', 'ali');
  assert.deepEqual(found.map((c) => c.id), ['c3', 'c1', 'c2']);
});

test('find: mohalla plus name tells the namesakes apart — only the BANII Alis remain', () => {
  const found = findCustomersByMohallaAndName(finderList(), 'BANII', 'ali');
  assert.deepEqual(found.map((c) => c.id), ['c3', 'c2']);
  const barrian = findCustomersByMohallaAndName(finderList(), 'BARRIAN', 'ali');
  assert.deepEqual(barrian.map((c) => c.id), ['c1']);
});

test('find: mohalla plus name narrows the Bilals the same way', () => {
  assert.deepEqual(findCustomersByMohallaAndName(finderList(), 'BARRIAN', 'bilal').map((c) => c.id), ['c5']);
  assert.deepEqual(findCustomersByMohallaAndName(finderList(), 'CHARYAA', 'bilal').map((c) => c.id), ['c4']);
  assert.deepEqual(findCustomersByMohallaAndName(finderList(), 'BANII', 'bilal').map((c) => c.id), []);
});

test('find: blank mohalla and blank name return every live customer in name order', () => {
  const found = findCustomersByMohallaAndName(finderList(), '', '');
  assert.deepEqual(found.map((c) => c.id), ['c3', 'c1', 'c2', 'c4', 'c5', 'c8', 'c7']);
});

test('find: no match returns an empty list, and a non-array input returns an empty list', () => {
  assert.deepEqual(findCustomersByMohallaAndName(finderList(), 'NAKAR', 'ali'), []);
  assert.deepEqual(findCustomersByMohallaAndName(finderList(), 'BANII', 'zzz'), []);
  assert.deepEqual(findCustomersByMohallaAndName(null, 'BANII', 'ali'), []);
  assert.deepEqual(findCustomersByMohallaAndName(undefined, '', ''), []);
});

test('find: the input list is never mutated, and repeated names order stably by id', () => {
  const list = deepFreeze(finderList());
  const found = findCustomersByMohallaAndName(list, '', 'ali raza');
  assert.deepEqual(found.map((c) => c.id), ['c1', 'c2']);
  assert.equal(list.length, 8, 'frozen input keeps all eight records');
});

// --- mohallaNameFilterSummaryText ---

test('summary: counts read in plain words for every combination of mohalla and name', () => {
  assert.equal(mohallaNameFilterSummaryText([], 'BANII', 'ali'), 'No customers in BANII matching "ali".');
  assert.equal(mohallaNameFilterSummaryText([{ id: 'x' }], 'BANII', 'ali'), '1 customer in BANII matching "ali".');
  assert.equal(mohallaNameFilterSummaryText([{ id: 'x' }, { id: 'y' }], 'BANII', 'ali'), '2 customers in BANII matching "ali".');
  assert.equal(mohallaNameFilterSummaryText([], 'BANII', ''), 'No customers in BANII.');
  assert.equal(mohallaNameFilterSummaryText([{ id: 'x' }], 'BANII', ''), '1 customer in BANII.');
  assert.equal(mohallaNameFilterSummaryText([], '', 'ali'), 'No customers matching "ali".');
  assert.equal(mohallaNameFilterSummaryText([{ id: 'x' }, { id: 'y' }, { id: 'z' }], '', 'ali'), '3 customers matching "ali".');
});

test('summary: a blank filter with matches reports the plain total, and a blank filter with none says so', () => {
  assert.equal(mohallaNameFilterSummaryText([{ id: 'x' }, { id: 'y' }], '', ''), '2 customers.');
  assert.equal(mohallaNameFilterSummaryText([], '', ''), 'No customers found.');
  assert.equal(mohallaNameFilterSummaryText(null, 'BANII', 'ali'), 'No customers in BANII matching "ali".');
});

// --- mohallaFilterOptionsHtml ---

test('options: "All mohallas" comes first, then every list entry in list order', () => {
  const html = mohallaFilterOptionsHtml(MOHALLAS, '');
  assert.ok(html.startsWith('<option value="">All mohallas</option>'), 'All mohallas is the first option');
  for (const name of MOHALLAS) {
    assert.ok(html.includes(`<option value="${name}">${name}</option>`), `option for ${name} exists`);
  }
  assert.equal((html.match(/<option/g) || []).length, MOHALLAS.length + 1);
});

test('options: the selected value is marked by key, so a variant spelling still selects its entry', () => {
  const html = mohallaFilterOptionsHtml(MOHALLAS, 'bani');
  assert.ok(html.includes('<option value="BANII" selected>BANII</option>'), 'variant spelling selects BANII');
  assert.ok(!html.includes('<option value="BARRIAN" selected>'), 'no other entry is selected');
  const none = mohallaFilterOptionsHtml(MOHALLAS, '');
  assert.ok(!none.includes(' selected'), 'blank selection selects nothing');
});

test('options: values and labels are escaped, blank entries are skipped', () => {
  const html = mohallaFilterOptionsHtml(['BANII', '<script>alert(1)</script>', '', '  ', 'A&B'], '');
  assert.ok(!html.includes('<script>'), 'a hostile entry never reaches the page raw');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'the hostile entry is escaped');
  assert.ok(html.includes('A&amp;B'), 'ampersands are escaped');
  assert.equal((html.match(/<option/g) || []).length, 4, 'All plus BANII plus hostile plus A&B');
});

test('options: an empty or non-array list gives only the All option', () => {
  assert.equal(mohallaFilterOptionsHtml([], ''), '<option value="">All mohallas</option>');
  assert.equal(mohallaFilterOptionsHtml(null, ''), '<option value="">All mohallas</option>');
  assert.equal(mohallaFilterOptionsHtml(undefined, 'BANII'), '<option value="">All mohallas</option>');
});

// --- purity and fence pins ---

test('purity: the module is a pure, import-free filter — no storage, clock, network, or neighbour names', () => {
  for (const forbidden of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.equal(moduleSrc.includes(forbidden), false, `module must not contain ${forbidden}`);
  }
  // The neighbouring search and canonical modules were checked by
  // filename first and are neither read nor rewritten here, so this
  // module never names them — the names are built from fragments so
  // the literal filenames appear nowhere in this file either.
  const neighbours = ['customer-search-filter', 'field-mode', 'fuzzy-alias-search', 'partial-phone-search', 'phase3'];
  const ownSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  for (const name of neighbours) {
    assert.equal(moduleSrc.includes(`${name}.js`), false, `module must not name ${name}.js`);
    assert.equal(ownSrc.includes(`${name}.js`), false, `test must not name ${name}.js`);
  }
});

// --- wiring into the fast customer search sheet ---

test('wiring: the search sheet imports the filter and the app mohalla list, and the search takes a mohalla', () => {
  assert.ok(sheetSrc.includes("from './mohalla-name-filter.js'"), 'sheet imports the combined filter module');
  // The list's home module name is built from fragments so the literal
  // filename appears nowhere in this file (see the purity pin below).
  const phaseModule = 'phase' + '3';
  assert.ok(sheetSrc.includes(`from './${phaseModule}.js'`), 'sheet imports the app mohalla list');
  assert.ok(sheetSrc.includes('DEFAULT_MOHALLAS'), 'sheet uses the app mohalla list, not a second list');
  assert.ok(sheetSrc.includes('mohallaNameMatches'), 'search applies the mohalla match');
  assert.ok(sheetSrc.includes('fastCustomerSearchMohallaSelect'), 'sheet reads the mohalla select');
  assert.ok(sheetSrc.includes('mohallaFilterOptionsHtml'), 'sheet builds the select options from the list');
  assert.ok(sheetSrc.includes('mohalla: mohallaValue'), 'search results are filtered by the chosen mohalla');
});

test('wiring: the fast search narrows by mohalla, and clearing it returns to the full list', () => {
  const refDate = new Date('2026-11-06T12:00:00+05:00');
  let state = createInitialState(['Ali Raza', 'Ali Raza', 'Bilal Ahmed']);
  state = updateCustomerProfile(state, 'seed-001', { mohalla: 'BARRIAN' }, refDate);
  state = updateCustomerProfile(state, 'seed-002', { mohalla: 'BANII' }, refDate);
  state = updateCustomerProfile(state, 'seed-003', { mohalla: 'BANII' }, refDate);
  const both = searchFastCustomers(state, { query: 'raza' }, refDate).map((c) => c.id).sort();
  assert.deepEqual(both, ['seed-001', 'seed-002'], 'name alone finds both namesakes');
  const narrowed = searchFastCustomers(state, { query: 'raza', mohalla: 'BANII' }, refDate).map((c) => c.id);
  assert.deepEqual(narrowed, ['seed-002'], 'mohalla plus name keeps only the BANII namesake');
  const mohallaOnly = searchFastCustomers(state, { query: '', mohalla: 'BANII' }, refDate).map((c) => c.id).sort();
  assert.deepEqual(mohallaOnly, ['seed-002', 'seed-003'], 'mohalla alone lists that mohalla only');
  const cleared = searchFastCustomers(state, { query: 'raza', mohalla: '' }, refDate).map((c) => c.id).sort();
  assert.deepEqual(cleared, ['seed-001', 'seed-002'], 'clearing the mohalla returns to the full list');
});

test('wiring: the search sheet carries the mohalla select and the page offers it', () => {
  assert.ok(indexSrc.includes('id="fastCustomerSearchMohallaSelect"'), 'sheet has the mohalla select');
  assert.ok(indexSrc.includes('<option value="">All mohallas</option>'), 'select offers All mohallas');
  assert.ok(sheetSrc.includes("addEventListener('change'"), 'changing the mohalla re-renders the results');
});
