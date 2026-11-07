// Plan 458 — Recent searches list: one on-device list of the
// searches the operator just ran, latest first, with the search text
// and the filter shown; tapping one runs it again, and the operator
// clears the whole list with one tap. It records searching only and
// never changes any customer, bill, or payment record.
//
// Fixtures are invented and pattern-fake only: names are "First
// Last" fixtures (never a real customer), mohallas are the app's own
// list values, record ids are seed-* fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECENT_SEARCHES_STORE_KEY,
  RECENT_SEARCHES_MAX,
  normalizeRecentSearch,
  normalizeRecentSearchList,
  recentSearchKey,
  recordRecentSearch,
  recentSearchFilterLabel,
  recentSearchRowText,
  recentSearchHtml,
} from '../recent-searches.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'recent-searches.js'), 'utf8');
const sheetSrc = readFileSync(join(dir, '..', 'nav-customer-search.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function search(overrides = {}) {
  return {
    text: 'raja',
    statusFilter: 'all',
    customerStatus: 'all',
    mohalla: '',
    ...overrides,
  };
}

function mockStorage() {
  const store = {};
  return {
    store,
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}

// --- normalize ---

test('normalize: a valid search keeps the text and every filter', () => {
  assert.deepEqual(normalizeRecentSearch(search({ customerStatus: 'overdue', mohalla: 'Shahdara' })), {
    text: 'raja',
    statusFilter: 'all',
    customerStatus: 'overdue',
    mohalla: 'Shahdara',
  });
});

test('normalize: the text is trimmed and the filters fold to their own lists', () => {
  assert.deepEqual(normalizeRecentSearch(search({ text: '  Raja  ', statusFilter: 'PENDING', customerStatus: 'bogus', mohalla: '  Dhok ' })), {
    text: 'Raja',
    statusFilter: 'pending',
    customerStatus: 'all',
    mohalla: 'Dhok',
  });
});

test('normalize: a filter-only search (no text, overdue list) is a search worth remembering', () => {
  assert.deepEqual(normalizeRecentSearch({ text: '', statusFilter: 'all', customerStatus: 'overdue', mohalla: '' }), {
    text: '',
    statusFilter: 'all',
    customerStatus: 'overdue',
    mohalla: '',
  });
  assert.deepEqual(normalizeRecentSearch({ text: '   ', statusFilter: 'all', customerStatus: 'all', mohalla: 'Shahdara' }), {
    text: '',
    statusFilter: 'all',
    customerStatus: 'all',
    mohalla: 'Shahdara',
  });
});

test('normalize: a blank box with every filter cleared is not a search', () => {
  assert.equal(normalizeRecentSearch({ text: '', statusFilter: 'all', customerStatus: 'all', mohalla: '' }), null);
  assert.equal(normalizeRecentSearch({ text: '   ', statusFilter: 'all', customerStatus: 'all', mohalla: '  ' }), null);
  assert.equal(normalizeRecentSearch({}), null);
  assert.equal(normalizeRecentSearch(null), null);
  assert.equal(normalizeRecentSearch('raja'), null);
});

test('normalize list: duplicates keep the first (newest), the list caps at twelve, non-lists give an empty list', () => {
  assert.equal(RECENT_SEARCHES_MAX, 12);
  const list = normalizeRecentSearchList([search(), search({ text: 'ahmed' }), search({ text: 'RAJA' })]);
  assert.deepEqual(list.map(e => e.text), ['raja', 'ahmed']);
  const many = Array.from({ length: 14 }, (_, i) => search({ text: `q${i + 1}` }));
  assert.equal(normalizeRecentSearchList(many).length, 12);
  assert.deepEqual(normalizeRecentSearchList(null), []);
  assert.deepEqual(normalizeRecentSearchList('nope'), []);
});

// --- record ---

test('record: a fresh search goes on top of an empty list', () => {
  assert.deepEqual(recordRecentSearch([], search()).map(e => e.text), ['raja']);
});

test('record: running a search again moves it to the top with no duplicates', () => {
  const before = [search({ text: 'ahmed' }), search(), search({ text: 'bilal' })];
  const after = recordRecentSearch(before, search({ text: 'BILAL' }));
  assert.deepEqual(after.map(e => e.text), ['BILAL', 'ahmed', 'raja']);
});

test('record: the same text with a different filter is a different search', () => {
  const before = [search({ customerStatus: 'overdue' })];
  const after = recordRecentSearch(before, search({ customerStatus: 'due' }));
  assert.equal(after.length, 2);
  assert.equal(after[0].customerStatus, 'due');
  assert.equal(after[1].customerStatus, 'overdue');
});

test('record: the list caps at twelve and drops the oldest searches', () => {
  const before = Array.from({ length: 13 }, (_, i) => search({ text: `q${i + 1}` }));
  const after = recordRecentSearch(before, search({ text: 'newest' }));
  assert.equal(after.length, 12);
  assert.equal(after[0].text, 'newest');
  assert.equal(after.some(e => e.text === 'q12'), false);
  assert.equal(after.some(e => e.text === 'q13'), false);
});

test('record: an invalid search leaves the list unchanged, and inputs are never mutated', () => {
  const before = deepFreeze([search({ text: 'ahmed' }), search()]);
  const fresh = deepFreeze({ text: '', statusFilter: 'all', customerStatus: 'all', mohalla: '' });
  assert.deepEqual(recordRecentSearch(before, fresh).map(e => e.text), ['ahmed', 'raja']);
  assert.deepEqual(recordRecentSearch(before, search({ text: 'bilal' })).map(e => e.text), ['bilal', 'ahmed', 'raja']);
  assert.deepEqual(before.map(e => e.text), ['ahmed', 'raja']);
});

// --- key ---

test('key: the same search has the same key whatever the case or spacing', () => {
  assert.equal(recentSearchKey(search({ text: '  Raja ' })), recentSearchKey(search({ text: 'RAJA' })));
  assert.notEqual(recentSearchKey(search()), recentSearchKey(search({ customerStatus: 'overdue' })));
  assert.equal(recentSearchKey(null), '');
});

// --- filter label and row text ---

test('filter label: billing chip, account-state chip, and mohalla read in plain words', () => {
  assert.equal(recentSearchFilterLabel(search({ statusFilter: 'pending' })), 'Pending Dues');
  assert.equal(recentSearchFilterLabel(search({ statusFilter: 'partial' })), 'Partial Paid');
  assert.equal(recentSearchFilterLabel(search({ statusFilter: 'paid' })), 'Settled (Paid)');
  assert.equal(recentSearchFilterLabel(search({ customerStatus: 'paid-up' })), 'Paid up');
  assert.equal(recentSearchFilterLabel(search({ customerStatus: 'due' })), 'Due');
  assert.equal(recentSearchFilterLabel(search({ customerStatus: 'overdue' })), 'Overdue');
  assert.equal(recentSearchFilterLabel(search({ customerStatus: 'suspended' })), 'Suspended');
  assert.equal(recentSearchFilterLabel(search({ customerStatus: 'new' })), 'New');
  assert.equal(recentSearchFilterLabel(search({ customerStatus: 'overdue', mohalla: 'Shahdara' })), 'Overdue · Shahdara');
  assert.equal(recentSearchFilterLabel(search()), '');
});

test('row text: the search text and the filter read in plain words', () => {
  assert.equal(recentSearchRowText(search({ customerStatus: 'overdue', mohalla: 'Shahdara' })), '"raja" — Overdue · Shahdara');
  assert.equal(recentSearchRowText(search()), '"raja"');
  assert.equal(recentSearchRowText({ text: '', statusFilter: 'all', customerStatus: 'overdue', mohalla: '' }), 'All customers — Overdue');
  assert.equal(recentSearchRowText(null), '');
});

// --- html ---

test('html: rows carry the text and the filter, and each row re-runs its search', () => {
  const html = recentSearchHtml([search({ customerStatus: 'overdue', mohalla: 'Shahdara' }), search({ text: 'ahmed' })]);
  // The row text quotes the search text, and the quotes escape to
  // &quot; in the markup — the operator still reads "raja".
  assert.ok(html.includes('&quot;raja&quot; — Overdue · Shahdara'), 'row shows the text and the filter');
  assert.ok(html.includes('&quot;ahmed&quot;'), 'row shows the second search');
  assert.ok(html.includes('data-recent-search-index="0"'), 'first row re-runs the first search');
  assert.ok(html.includes('data-recent-search-index="1"'), 'second row re-runs the second search');
});

test('html: markup in the search text is escaped, never rendered', () => {
  const html = recentSearchHtml([search({ text: '<script>alert(1)</script>' })]);
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'), 'script tag is escaped');
});

test('html: an empty list reads as no recent searches yet', () => {
  assert.equal(recentSearchHtml([]), '<p>No recent searches yet.</p>');
  assert.equal(recentSearchHtml(null), '<p>No recent searches yet.</p>');
});

// --- store key, purity, fence ---

test('store key: the list has its own on-device key, shared with nobody', () => {
  assert.equal(RECENT_SEARCHES_STORE_KEY, 'shahdara_recent_searches_v1');
});

test('purity: the module is pure and import-free — no storage, clock, network, or neighbour names', () => {
  for (const forbidden of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'window.', 'import ', 'OLT']) {
    assert.equal(moduleSrc.includes(forbidden), false, `module must not contain ${forbidden}`);
  }
  // The sheet module that owns the search sheet was checked by filename
  // first and is neither read nor rewritten here, so this module never
  // names it — the name is built from fragments so the literal
  // filename appears nowhere in this module either.
  const sheetModule = 'nav-customer-' + 'search';
  assert.equal(moduleSrc.includes(`${sheetModule}.js`), false, 'module must not name the sheet module file');
});

// --- storage helpers on the sheet (functional, mock storage) ---

test('storage: recording, reading, and clearing the list through the sheet helpers', async () => {
  const { recordRecentSearchRun, getRecentSearches, clearRecentSearches } = await import('../nav-customer-search.js');
  const storage = mockStorage();

  assert.deepEqual(getRecentSearches(storage), []);
  recordRecentSearchRun(search({ customerStatus: 'overdue' }), storage);
  recordRecentSearchRun(search({ text: 'ahmed' }), storage);
  const list = getRecentSearches(storage);
  assert.equal(list.length, 2);
  assert.equal(list[0].text, 'ahmed');
  assert.equal(list[1].customerStatus, 'overdue');

  // Running the overdue search again moves it to the top, no duplicate.
  recordRecentSearchRun(search({ customerStatus: 'overdue' }), storage);
  const moved = getRecentSearches(storage);
  assert.equal(moved.length, 2);
  assert.equal(moved[0].customerStatus, 'overdue');

  // Clearing removes the whole list.
  clearRecentSearches(storage);
  assert.deepEqual(getRecentSearches(storage), []);
});

test('storage: a blank search records nothing, and a corrupt store reads as empty', async () => {
  const { recordRecentSearchRun, getRecentSearches } = await import('../nav-customer-search.js');
  const storage = mockStorage();

  recordRecentSearchRun({ text: '', statusFilter: 'all', customerStatus: 'all', mohalla: '' }, storage);
  assert.deepEqual(getRecentSearches(storage), []);
  assert.equal(storage.store[RECENT_SEARCHES_STORE_KEY], undefined);

  storage.store[RECENT_SEARCHES_STORE_KEY] = 'not json{';
  assert.deepEqual(getRecentSearches(storage), []);
  storage.store[RECENT_SEARCHES_STORE_KEY] = JSON.stringify('a string, not a list');
  assert.deepEqual(getRecentSearches(storage), []);
});

// --- wiring into the sheet and the page ---

test('wiring: the sheet imports the module and records the search when it closes', () => {
  assert.ok(sheetSrc.includes("from './recent-searches.js'"), 'sheet imports the recent searches module');
  assert.ok(sheetSrc.includes('RECENT_SEARCHES_STORE_KEY'), 'sheet uses the recent searches store key');
  assert.ok(sheetSrc.includes('storage.getItem(RECENT_SEARCHES_STORE_KEY)'), 'read goes through the shared key');
  assert.ok(sheetSrc.includes('storage.setItem(RECENT_SEARCHES_STORE_KEY, JSON.stringify(list))'), 'save writes the shared key');
  assert.ok(sheetSrc.includes('storage.removeItem(RECENT_SEARCHES_STORE_KEY)'), 'clear removes the shared key');
  const closeStart = sheetSrc.indexOf('function closeModal(');
  const closeEnd = sheetSrc.indexOf('// Wire search input', closeStart);
  const closeBody = sheetSrc.slice(closeStart, closeEnd);
  assert.ok(closeBody.includes('recordRecentSearchRun({'), 'closing the sheet records the search that was running');
  assert.ok(closeBody.includes('text: searchInput?.value'), 'the recorded search carries the typed text');
  assert.ok(closeBody.includes('customerStatus: activeCustomerStatus'), 'the recorded search carries the account-state chip');
  assert.ok(closeBody.includes('mohalla: mohallaSelect?.value'), 'the recorded search carries the mohalla filter');
});

test('wiring: tapping a recent search runs it again from the sheet', () => {
  assert.ok(sheetSrc.includes('data-recent-search-index'), 'rows carry their list index');
  assert.ok(sheetSrc.includes('applyRecentSearch(searches[index])'), 'tapping a row re-runs that search');
  const applyStart = sheetSrc.indexOf('function applyRecentSearch(');
  const applyEnd = sheetSrc.indexOf('recentSearchesContainer?.addEventListener', applyStart);
  const applyBody = sheetSrc.slice(applyStart, applyEnd);
  assert.ok(applyBody.includes('searchInput.value = entry.text'), 'the text comes back into the box');
  assert.ok(applyBody.includes("chip.getAttribute('data-status') === activeStatusFilter"), 'the billing chip comes back');
  assert.ok(applyBody.includes("chip.getAttribute('data-account-status') === activeCustomerStatus"), 'the account-state chip comes back');
  assert.ok(applyBody.includes('mohallaSelect.value = entry.mohalla'), 'the mohalla comes back');
  assert.ok(applyBody.includes('render();'), 'the results render again');
});

test('wiring: the sheet shows the list while nothing is searched and hides it while a search runs', () => {
  assert.ok(sheetSrc.includes('recentSearchHtml(searches)'), 'the section renders the list');
  assert.ok(sheetSrc.includes('`Recent Searches (${searches.length})`'), 'the section counts the list');
  assert.ok(sheetSrc.includes("recentSearchesHeader.style.display = showSearches ? '' : 'none'"), 'the section hides when the list is empty');
  assert.ok(sheetSrc.includes("recentSearchesHeader.style.display = 'none'"), 'the section hides while a search runs');
});

test('wiring: the clear button clears the whole list', () => {
  assert.ok(sheetSrc.includes('fastCustomerClearRecentSearchesBtn'), 'the clear button is wired');
  assert.ok(sheetSrc.includes('clearRecentSearches();'), 'clearing removes the list');
  assert.ok(sheetSrc.includes("onToast('Recent searches cleared.')"), 'clearing tells the operator');
});

test('wiring: the page carries the recent searches section after the account chips and before the results header', () => {
  for (const id of ['fastCustomerRecentSearchesHeader', 'fastCustomerRecentSearchesTitle', 'fastCustomerRecentSearches', 'fastCustomerClearRecentSearchesBtn']) {
    assert.ok(indexSrc.includes(`id="${id}"`), `page carries ${id}`);
  }
  assert.ok(indexSrc.indexOf('id="fcsAccountChips"') < indexSrc.indexOf('id="fastCustomerRecentSearchesHeader"'), 'section sits after the account chips');
  assert.ok(indexSrc.indexOf('id="fastCustomerRecentSearches"') < indexSrc.indexOf('id="fastCustomerSearchSectionTitle"'), 'section sits before the results header');
  assert.ok(indexSrc.includes('Recent Searches'), 'section is titled for the operator');
});
