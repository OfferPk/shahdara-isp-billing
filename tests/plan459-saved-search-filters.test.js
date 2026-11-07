// Plan 459 — Saved search filters: one on-device list of the
// searches the operator chose to keep, each with a name in plain
// words plus the search text and the filters it holds; saving one
// saves the filter definition only, never copies of the results —
// running it re-applies the definition to the live customer list.
// Removing one removes only the saved definition, and saving never
// changes any customer, bill, or payment record.
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
  SAVED_SEARCH_FILTERS_STORE_KEY,
  SAVED_SEARCH_FILTERS_MAX,
  SAVED_SEARCH_FILTER_NAME_MAX,
  normalizeSavedSearchFilter,
  normalizeSavedSearchFilterList,
  savedSearchFilterKey,
  saveSavedSearchFilter,
  removeSavedSearchFilter,
  savedSearchFilterDefinition,
  savedSearchFilterLabel,
  savedSearchFilterRowText,
  savedSearchFilterTitle,
  savedSearchFilterHtml,
} from '../saved-search-filters.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'saved-search-filters.js'), 'utf8');
const sheetSrc = readFileSync(join(dir, '..', 'nav-customer-search.js'), 'utf8');
const indexSrc = readFileSync(join(dir, '..', 'index.html'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function filter(overrides = {}) {
  return {
    name: 'Overdue Shahdara',
    text: 'raja',
    statusFilter: 'all',
    customerStatus: 'overdue',
    mohalla: 'Shahdara',
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

test('normalize: a valid saved filter keeps its name, text, and every filter', () => {
  assert.deepEqual(normalizeSavedSearchFilter(filter()), {
    name: 'Overdue Shahdara',
    text: 'raja',
    statusFilter: 'all',
    customerStatus: 'overdue',
    mohalla: 'Shahdara',
  });
});

test('normalize: the name and text are trimmed, the filters fold to their own lists, and a long name caps at sixty', () => {
  const longName = 'a'.repeat(80);
  assert.deepEqual(normalizeSavedSearchFilter(filter({ name: '  Overdue Shahdara  ', text: '  Raja  ', statusFilter: 'PENDING', customerStatus: 'bogus', mohalla: '  Dhok ' })), {
    name: 'Overdue Shahdara',
    text: 'Raja',
    statusFilter: 'pending',
    customerStatus: 'all',
    mohalla: 'Dhok',
  });
  assert.equal(SAVED_SEARCH_FILTER_NAME_MAX, 60);
  assert.equal(normalizeSavedSearchFilter(filter({ name: longName })).name.length, 60);
});

test('normalize: a filter-only saved filter (no text, overdue list) counts', () => {
  assert.deepEqual(normalizeSavedSearchFilter({ name: 'Overdue list', text: '', statusFilter: 'all', customerStatus: 'overdue', mohalla: '' }), {
    name: 'Overdue list',
    text: '',
    statusFilter: 'all',
    customerStatus: 'overdue',
    mohalla: '',
  });
  assert.deepEqual(normalizeSavedSearchFilter({ name: 'Shahdara round', text: '   ', statusFilter: 'all', customerStatus: 'all', mohalla: 'Shahdara' }), {
    name: 'Shahdara round',
    text: '',
    statusFilter: 'all',
    customerStatus: 'all',
    mohalla: 'Shahdara',
  });
});

test('normalize: a filter without a name, or a name with nothing behind it, is not a filter', () => {
  assert.equal(normalizeSavedSearchFilter(filter({ name: '' })), null);
  assert.equal(normalizeSavedSearchFilter(filter({ name: '   ' })), null);
  assert.equal(normalizeSavedSearchFilter(filter({ name: 'All customers', text: '', statusFilter: 'all', customerStatus: 'all', mohalla: '' })), null);
  assert.equal(normalizeSavedSearchFilter({}), null);
  assert.equal(normalizeSavedSearchFilter(null), null);
  assert.equal(normalizeSavedSearchFilter('Overdue Shahdara'), null);
});

test('normalize list: duplicates keep the first (newest), the list caps at twelve, non-lists give an empty list', () => {
  assert.equal(SAVED_SEARCH_FILTERS_MAX, 12);
  const list = normalizeSavedSearchFilterList([filter(), filter({ name: 'Cash today' }), filter({ name: 'overdue shahdara' })]);
  assert.deepEqual(list.map(e => e.name), ['Overdue Shahdara', 'Cash today']);
  const many = Array.from({ length: 14 }, (_, i) => filter({ name: `Filter ${i + 1}` }));
  assert.equal(normalizeSavedSearchFilterList(many).length, 12);
  assert.deepEqual(normalizeSavedSearchFilterList(null), []);
  assert.deepEqual(normalizeSavedSearchFilterList('nope'), []);
});

// --- key ---

test('key: the same name has the same key whatever the case or spacing', () => {
  assert.equal(savedSearchFilterKey(filter({ name: '  Overdue Shahdara ' })), savedSearchFilterKey(filter({ name: 'OVERDUE SHAHDARA' })));
  assert.notEqual(savedSearchFilterKey(filter()), savedSearchFilterKey(filter({ name: 'Cash today' })));
  assert.equal(savedSearchFilterKey(null), '');
});

// --- save ---

test('save: a fresh filter goes on top of an empty list', () => {
  assert.deepEqual(saveSavedSearchFilter([], filter()).map(e => e.name), ['Overdue Shahdara']);
});

test('save: saving the same name again replaces its definition and moves it to the top, never a second button', () => {
  const before = [filter({ name: 'Cash today', text: 'ahmed' }), filter(), filter({ name: 'Due list', text: 'bilal' })];
  const after = saveSavedSearchFilter(before, filter({ name: 'OVERDUE SHAHDARA', text: 'saad', mohalla: '' }));
  // The name keeps the case the operator typed — only the dedupe is
  // case-insensitive, so the display never rewrites what was typed.
  assert.deepEqual(after.map(e => e.name), ['OVERDUE SHAHDARA', 'Cash today', 'Due list']);
  assert.equal(after[0].text, 'saad');
  assert.equal(after[0].mohalla, '');
});

test('save: the list caps at twelve and drops the oldest filters', () => {
  const before = Array.from({ length: 13 }, (_, i) => filter({ name: `Filter ${i + 1}` }));
  const after = saveSavedSearchFilter(before, filter({ name: 'Newest' }));
  assert.equal(after.length, 12);
  assert.equal(after[0].name, 'Newest');
  assert.equal(after.some(e => e.name === 'Filter 12'), false);
  assert.equal(after.some(e => e.name === 'Filter 13'), false);
});

test('save: an invalid filter leaves the list unchanged, and inputs are never mutated', () => {
  const before = deepFreeze([filter({ name: 'Cash today' }), filter()]);
  const fresh = deepFreeze({ name: '', text: 'raja', statusFilter: 'all', customerStatus: 'all', mohalla: '' });
  assert.deepEqual(saveSavedSearchFilter(before, fresh).map(e => e.name), ['Cash today', 'Overdue Shahdara']);
  assert.deepEqual(saveSavedSearchFilter(before, filter({ name: 'Due list' })).map(e => e.name), ['Due list', 'Cash today', 'Overdue Shahdara']);
  assert.deepEqual(before.map(e => e.name), ['Cash today', 'Overdue Shahdara']);
});

// --- remove ---

test('remove: removing by index takes out only that filter', () => {
  const before = [filter({ name: 'Cash today' }), filter(), filter({ name: 'Due list' })];
  assert.deepEqual(removeSavedSearchFilter(before, 1).map(e => e.name), ['Cash today', 'Due list']);
});

test('remove: removing by name is case-insensitive and takes out only that filter', () => {
  const before = [filter({ name: 'Cash today' }), filter(), filter({ name: 'Due list' })];
  assert.deepEqual(removeSavedSearchFilter(before, 'OVERDUE SHAHDARA').map(e => e.name), ['Cash today', 'Due list']);
});

test('remove: an out-of-range index or an unknown name leaves the list unchanged', () => {
  const before = [filter({ name: 'Cash today' }), filter()];
  assert.deepEqual(removeSavedSearchFilter(before, 5).map(e => e.name), ['Cash today', 'Overdue Shahdara']);
  assert.deepEqual(removeSavedSearchFilter(before, -1).map(e => e.name), ['Cash today', 'Overdue Shahdara']);
  assert.deepEqual(removeSavedSearchFilter(before, 'No such filter').map(e => e.name), ['Cash today', 'Overdue Shahdara']);
  assert.deepEqual(removeSavedSearchFilter(before, '').map(e => e.name), ['Cash today', 'Overdue Shahdara']);
});

// --- definition ---

test('definition: a saved filter hands back only its search definition, never its name', () => {
  assert.deepEqual(savedSearchFilterDefinition(filter()), {
    text: 'raja',
    statusFilter: 'all',
    customerStatus: 'overdue',
    mohalla: 'Shahdara',
  });
  assert.equal(savedSearchFilterDefinition(null), null);
  assert.equal(savedSearchFilterDefinition(filter({ name: '' })), null);
});

// --- label, row text, title ---

test('label: billing chip, account-state chip, and mohalla read in plain words', () => {
  // The filter() fixture defaults to overdue + Shahdara, so each
  // single-chip case clears the other two first.
  assert.equal(savedSearchFilterLabel(filter({ statusFilter: 'pending', customerStatus: 'all', mohalla: '' })), 'Pending Dues');
  assert.equal(savedSearchFilterLabel(filter({ statusFilter: 'partial', customerStatus: 'all', mohalla: '' })), 'Partial Paid');
  assert.equal(savedSearchFilterLabel(filter({ statusFilter: 'paid', customerStatus: 'all', mohalla: '' })), 'Settled (Paid)');
  assert.equal(savedSearchFilterLabel(filter({ customerStatus: 'paid-up', mohalla: '' })), 'Paid up');
  assert.equal(savedSearchFilterLabel(filter({ customerStatus: 'due', mohalla: '' })), 'Due');
  assert.equal(savedSearchFilterLabel(filter({ customerStatus: 'overdue', mohalla: 'Shahdara' })), 'Overdue · Shahdara');
  assert.equal(savedSearchFilterLabel(filter({ customerStatus: 'suspended', mohalla: '' })), 'Suspended');
  assert.equal(savedSearchFilterLabel(filter({ customerStatus: 'new', mohalla: '' })), 'New');
  assert.equal(savedSearchFilterLabel(filter({ customerStatus: 'all', mohalla: '' })), '');
});

test('row text and title: the chip reads the name, and its title carries the definition in plain words', () => {
  assert.equal(savedSearchFilterRowText(filter()), 'Overdue Shahdara');
  assert.equal(savedSearchFilterTitle(filter()), '"raja" — Overdue · Shahdara');
  assert.equal(savedSearchFilterTitle(filter({ text: 'ahmed', customerStatus: 'all', mohalla: '' })), '"ahmed"');
  assert.equal(savedSearchFilterTitle({ name: 'Overdue list', text: '', statusFilter: 'all', customerStatus: 'overdue', mohalla: '' }), 'All customers — Overdue');
  assert.equal(savedSearchFilterRowText(null), '');
  assert.equal(savedSearchFilterTitle(null), '');
});

// --- html ---

test('html: rows carry the name and the definition, one tap runs the filter, and each row has its own remove button', () => {
  const html = savedSearchFilterHtml([filter(), filter({ name: 'Cash today', text: 'ahmed', customerStatus: 'all', mohalla: '' })]);
  assert.ok(html.includes('>Overdue Shahdara</button>'), 'row shows the name');
  assert.ok(html.includes('&quot;raja&quot; — Overdue · Shahdara'), 'row title carries the definition');
  assert.ok(html.includes('data-saved-filter-index="0"'), 'first row runs the first filter');
  assert.ok(html.includes('data-saved-filter-index="1"'), 'second row runs the second filter');
  assert.ok(html.includes('data-saved-filter-remove-index="0"'), 'first row has its own remove button');
  assert.ok(html.includes('data-saved-filter-remove-index="1"'), 'second row has its own remove button');
});

test('html: markup in the name is escaped, never rendered', () => {
  const html = savedSearchFilterHtml([filter({ name: '<script>alert(1)</script>' })]);
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;'), 'script tag is escaped');
});

test('html: an empty list reads as no saved filters yet', () => {
  assert.equal(savedSearchFilterHtml([]), '<p>No saved filters yet.</p>');
  assert.equal(savedSearchFilterHtml(null), '<p>No saved filters yet.</p>');
});

// --- store key, purity, fence ---

test('store key: the list has its own on-device key, shared with nobody', () => {
  assert.equal(SAVED_SEARCH_FILTERS_STORE_KEY, 'shahdara_saved_filters_v1');
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

test('storage: saving, reading, and removing a filter through the sheet helpers', async () => {
  const { saveSearchFilterRun, getSavedSearchFilters, removeSavedSearchFilterRun } = await import('../nav-customer-search.js');
  const storage = mockStorage();

  assert.deepEqual(getSavedSearchFilters(storage), []);
  saveSearchFilterRun('Overdue Shahdara', { text: 'raja', statusFilter: 'all', customerStatus: 'overdue', mohalla: 'Shahdara' }, storage);
  saveSearchFilterRun('Cash today', { text: 'ahmed', statusFilter: 'all', customerStatus: 'all', mohalla: '' }, storage);
  const list = getSavedSearchFilters(storage);
  assert.equal(list.length, 2);
  assert.equal(list[0].name, 'Cash today');
  assert.equal(list[1].customerStatus, 'overdue');

  // Saving the same name again replaces the definition, no duplicate —
  // the name keeps the case the operator typed.
  saveSearchFilterRun('OVERDUE SHAHDARA', { text: 'saad', statusFilter: 'all', customerStatus: 'overdue', mohalla: '' }, storage);
  const replaced = getSavedSearchFilters(storage);
  assert.equal(replaced.length, 2);
  assert.equal(replaced[0].name, 'OVERDUE SHAHDARA');
  assert.equal(replaced[0].text, 'saad');

  // Removing by index takes out only that filter.
  removeSavedSearchFilterRun(1, storage);
  const kept = getSavedSearchFilters(storage);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].name, 'OVERDUE SHAHDARA');
});

test('storage: a blank name or a blank definition saves nothing, and a corrupt store reads as empty', async () => {
  const { saveSearchFilterRun, getSavedSearchFilters } = await import('../nav-customer-search.js');
  const storage = mockStorage();

  saveSearchFilterRun('', { text: 'raja', statusFilter: 'all', customerStatus: 'overdue', mohalla: 'Shahdara' }, storage);
  saveSearchFilterRun('   ', { text: 'raja', statusFilter: 'all', customerStatus: 'overdue', mohalla: 'Shahdara' }, storage);
  saveSearchFilterRun('All customers', { text: '', statusFilter: 'all', customerStatus: 'all', mohalla: '' }, storage);
  assert.deepEqual(getSavedSearchFilters(storage), []);
  assert.equal(storage.store[SAVED_SEARCH_FILTERS_STORE_KEY], undefined);

  storage.store[SAVED_SEARCH_FILTERS_STORE_KEY] = 'not json{';
  assert.deepEqual(getSavedSearchFilters(storage), []);
  storage.store[SAVED_SEARCH_FILTERS_STORE_KEY] = JSON.stringify('a string, not a list');
  assert.deepEqual(getSavedSearchFilters(storage), []);
});

// --- wiring into the sheet and the page ---

test('wiring: the sheet imports the module and the storage helpers use its key', () => {
  assert.ok(sheetSrc.includes("from './saved-search-filters.js'"), 'sheet imports the saved filters module');
  assert.ok(sheetSrc.includes('SAVED_SEARCH_FILTERS_STORE_KEY'), 'sheet uses the saved filters store key');
  assert.ok(sheetSrc.includes('storage.getItem(SAVED_SEARCH_FILTERS_STORE_KEY)'), 'read goes through the shared key');
  assert.ok(sheetSrc.includes('storage.setItem(SAVED_SEARCH_FILTERS_STORE_KEY, JSON.stringify(list))'), 'save writes the shared key');
});

test('wiring: the save button saves the search that is running, with the name from its own box', () => {
  assert.ok(sheetSrc.includes('fastCustomerSaveFilterBtn'), 'the save button is wired');
  assert.ok(sheetSrc.includes('fastCustomerSaveFilterName'), 'the name box is wired');
  assert.ok(sheetSrc.includes('saveSearchFilterRun('), 'tapping save stores the filter');
  assert.ok(sheetSrc.includes("onToast('Type a name for the filter first.')"), 'a blank name is refused plainly');
  const saveStart = sheetSrc.indexOf("saveFilterBtn?.addEventListener('click'");
  const saveEnd = sheetSrc.indexOf('// Plan 458: tapping a recent search runs it again', saveStart);
  const saveBody = sheetSrc.slice(saveStart, saveEnd);
  assert.ok(saveBody.includes('text: searchInput?.value'), 'the saved filter carries the typed text');
  assert.ok(saveBody.includes('customerStatus: activeCustomerStatus'), 'the saved filter carries the account-state chip');
  assert.ok(saveBody.includes('mohalla: mohallaSelect?.value'), 'the saved filter carries the mohalla filter');
});

test('wiring: tapping a saved filter runs it again from the sheet', () => {
  assert.ok(sheetSrc.includes('data-saved-filter-index'), 'rows carry their list index');
  assert.ok(sheetSrc.includes('applySearchDefinition(saved[index])'), 'tapping a row re-runs that filter');
  const applyStart = sheetSrc.indexOf('function applySearchDefinition(');
  const applyEnd = sheetSrc.indexOf('recentSearchesContainer?.addEventListener', applyStart);
  const applyBody = sheetSrc.slice(applyStart, applyEnd);
  assert.ok(applyBody.includes('searchInput.value = entry.text'), 'the text comes back into the box');
  assert.ok(applyBody.includes("chip.getAttribute('data-status') === activeStatusFilter"), 'the billing chip comes back');
  assert.ok(applyBody.includes("chip.getAttribute('data-account-status') === activeCustomerStatus"), 'the account-state chip comes back');
  assert.ok(applyBody.includes('mohallaSelect.value = entry.mohalla'), 'the mohalla comes back');
  assert.ok(applyBody.includes('render();'), 'the results render again');
});

test('wiring: removing a saved filter takes out only that filter', () => {
  assert.ok(sheetSrc.includes('data-saved-filter-remove-index'), 'each row has its own remove button');
  assert.ok(sheetSrc.includes('removeSavedSearchFilterRun(index)'), 'tapping remove takes it out');
  assert.ok(sheetSrc.includes('render();'), 'the list renders again after removing');
});

test('wiring: the sheet shows the saved filters while nothing is searched and hides them while a search runs', () => {
  assert.ok(sheetSrc.includes('savedSearchFilterHtml(saved)'), 'the section renders the list');
  assert.ok(sheetSrc.includes('`Saved Filters (${saved.length})`'), 'the section counts the list');
  assert.ok(sheetSrc.includes("savedFiltersHeader.style.display = showSaved ? '' : 'none'"), 'the section hides when the list is empty');
  assert.ok(sheetSrc.includes("savedFiltersHeader.style.display = 'none'"), 'the section hides while a search runs');
});

test('wiring: the save row shows only while a search is running', () => {
  assert.ok(sheetSrc.includes("saveFilterRow.style.display = showSaveRow ? '' : 'none'"), 'the save row hides when nothing is searched');
  assert.ok(sheetSrc.includes("saveFilterRow.style.display = 'none'"), 'the save row hides in the recents branch');
});

test('wiring: the page carries the save row and the saved filters section in the right places', () => {
  for (const id of ['fastCustomerSaveFilterRow', 'fastCustomerSaveFilterName', 'fastCustomerSaveFilterBtn', 'fastCustomerSavedFiltersHeader', 'fastCustomerSavedFiltersTitle', 'fastCustomerSavedFilters']) {
    assert.ok(indexSrc.includes(`id="${id}"`), `page carries ${id}`);
  }
  assert.ok(indexSrc.indexOf('id="fcsAccountChips"') < indexSrc.indexOf('id="fastCustomerSaveFilterRow"'), 'save row sits after the account chips');
  assert.ok(indexSrc.indexOf('id="fastCustomerSaveFilterRow"') < indexSrc.indexOf('id="fastCustomerRecentSearchesHeader"'), 'save row sits before the recent searches section');
  assert.ok(indexSrc.indexOf('id="fastCustomerRecentSearches"') < indexSrc.indexOf('id="fastCustomerSavedFiltersHeader"'), 'saved filters sit after the recent searches');
  assert.ok(indexSrc.indexOf('id="fastCustomerSavedFilters"') < indexSrc.indexOf('id="fastCustomerSearchSectionTitle"'), 'saved filters sit before the results header');
  assert.ok(indexSrc.includes('Saved Filters'), 'section is titled for the operator');
  assert.ok(indexSrc.includes('Name this filter'), 'the name box tells the operator what to type');
});
