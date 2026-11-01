// SISP-133: Customer Preferred Collection Time-of-Day Window.
// Pure-function + core round-trip tests on synthetic data only.
//
// Spec test criteria (verbatim intent): unit tests for time-window
// filtering and "Now Match" sorting — pinned below at fixed PKT
// moments (Tuesday 10:30 -> morning set; Tuesday 18:00 -> evening
// set; Saturday 10:30 -> weekend set + morning set), plus the enum
// sanitizer (junk -> anytime behaviour) and a backup round-trip that
// preserves a set window.
//
// Storage choice pinned here: preferredVisitWindow exists on the
// record ONLY when a non-anytime preference is stored; 'anytime',
// absent and junk are indistinguishable and never persisted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VISIT_WINDOWS,
  VISIT_SHIFT_FILTERS,
  VISIT_WINDOW_LABEL_KEYS,
  sanitizePreferredVisitWindow,
  customerVisitWindow,
  isWeekendDate,
  visitWindowMatchesAt,
  visitWindowMatchesNow,
  currentVisitShift,
  filterByVisitShift,
  sortByVisitWindowNowMatch
} from '../visit-time-window.js';
import {
  STORAGE_KEY,
  createInitialState,
  addCustomer,
  updateCustomerProfile,
  readState,
  createJsonBackup,
  previewJsonBackupMerge
} from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

// Fixed local moments (constructed in local time, so getHours/getDay
// are the pinned values on any machine): 2026-10-27 is a Tuesday and
// 2026-10-31 is a Saturday.
const TUE_1030 = new Date(2026, 9, 27, 10, 30);
const TUE_1800 = new Date(2026, 9, 27, 18, 0);
const SAT_1030 = new Date(2026, 9, 31, 10, 30);

const windowOf = (customer) => customerVisitWindow(customer);
const ids = (list) => list.map((c) => c.id);

function fixtureCustomers() {
  return [
    { id: 'a-any', name: 'TEST ANY' },
    { id: 'b-morn', name: 'TEST MORN', preferredVisitWindow: 'morning_9_1' },
    { id: 'c-eve', name: 'TEST EVE', preferredVisitWindow: 'evening_after_5' },
    { id: 'd-wknd', name: 'TEST WKND', preferredVisitWindow: 'weekend_only' },
    { id: 'e-morn', name: 'TEST MORN TWO', preferredVisitWindow: 'morning_9_1' }
  ];
}

test('sanitizer: the four non-anytime enum values are storable, everything else is no-preference', () => {
  assert.deepEqual(VISIT_WINDOWS, ['anytime', 'morning_9_1', 'afternoon_1_5', 'evening_after_5', 'weekend_only']);
  assert.equal(sanitizePreferredVisitWindow('morning_9_1'), 'morning_9_1');
  assert.equal(sanitizePreferredVisitWindow('afternoon_1_5'), 'afternoon_1_5');
  assert.equal(sanitizePreferredVisitWindow('evening_after_5'), 'evening_after_5');
  assert.equal(sanitizePreferredVisitWindow('weekend_only'), 'weekend_only');
  assert.equal(sanitizePreferredVisitWindow('anytime'), null);
  assert.equal(sanitizePreferredVisitWindow('morning'), null);
  assert.equal(sanitizePreferredVisitWindow(''), null);
  assert.equal(sanitizePreferredVisitWindow(undefined), null);
  assert.equal(sanitizePreferredVisitWindow(null), null);
  assert.equal(sanitizePreferredVisitWindow(9), null);
});

test('customerVisitWindow: absent or junk stored values behave exactly as anytime', () => {
  assert.equal(customerVisitWindow({}), 'anytime');
  assert.equal(customerVisitWindow({ preferredVisitWindow: 'morning_9_1' }), 'morning_9_1');
  assert.equal(customerVisitWindow({ preferredVisitWindow: 'whenever' }), 'anytime');
  assert.equal(customerVisitWindow({ preferredVisitWindow: 'anytime' }), 'anytime');
  assert.equal(customerVisitWindow(null), 'anytime');
  assert.equal(customerVisitWindow(undefined), 'anytime');
});

test('window matching at fixed moments (spec fixtures)', () => {
  assert.equal(TUE_1030.getDay(), 2, 'fixture sanity: 2026-10-27 is a Tuesday');
  assert.equal(SAT_1030.getDay(), 6, 'fixture sanity: 2026-10-31 is a Saturday');
  // Tuesday 10:30 -> morning set.
  assert.equal(visitWindowMatchesAt('morning_9_1', TUE_1030), true);
  assert.equal(visitWindowMatchesAt('afternoon_1_5', TUE_1030), false);
  assert.equal(visitWindowMatchesAt('evening_after_5', TUE_1030), false);
  assert.equal(visitWindowMatchesAt('weekend_only', TUE_1030), false);
  assert.equal(visitWindowMatchesAt('anytime', TUE_1030), true);
  // Tuesday 18:00 -> evening set.
  assert.equal(visitWindowMatchesAt('evening_after_5', TUE_1800), true);
  assert.equal(visitWindowMatchesAt('morning_9_1', TUE_1800), false);
  assert.equal(visitWindowMatchesAt('weekend_only', TUE_1800), false);
  // Saturday 10:30 -> weekend set AND morning set (orthogonal rules).
  assert.equal(visitWindowMatchesAt('weekend_only', SAT_1030), true);
  assert.equal(visitWindowMatchesAt('morning_9_1', SAT_1030), true);
  assert.equal(visitWindowMatchesAt('evening_after_5', SAT_1030), false);
  // Per-customer helper agrees.
  assert.equal(visitWindowMatchesNow({ preferredVisitWindow: 'weekend_only' }, SAT_1030), true);
  assert.equal(visitWindowMatchesNow({}, TUE_1800), true);
  assert.equal(visitWindowMatchesNow({ preferredVisitWindow: 'morning_9_1' }, TUE_1800), false);
});

test('window boundaries are half-open and evening ends at midnight', () => {
  const at = (h, m = 0) => new Date(2026, 9, 27, h, m); // a Tuesday
  assert.equal(visitWindowMatchesAt('morning_9_1', at(8, 59)), false);
  assert.equal(visitWindowMatchesAt('morning_9_1', at(9, 0)), true);
  assert.equal(visitWindowMatchesAt('morning_9_1', at(12, 59)), true);
  assert.equal(visitWindowMatchesAt('morning_9_1', at(13, 0)), false);
  assert.equal(visitWindowMatchesAt('afternoon_1_5', at(13, 0)), true);
  assert.equal(visitWindowMatchesAt('afternoon_1_5', at(16, 59)), true);
  assert.equal(visitWindowMatchesAt('afternoon_1_5', at(17, 0)), false);
  assert.equal(visitWindowMatchesAt('evening_after_5', at(17, 0)), true);
  assert.equal(visitWindowMatchesAt('evening_after_5', at(23, 59)), true);
  assert.equal(visitWindowMatchesAt('evening_after_5', at(0, 30)), false);
  // Weekend spans the whole day, both days, and never a weekday.
  assert.equal(visitWindowMatchesAt('weekend_only', new Date(2026, 9, 31, 0, 30)), true);
  assert.equal(visitWindowMatchesAt('weekend_only', new Date(2026, 10, 1, 23, 30)), true); // Sunday
  assert.equal(visitWindowMatchesAt('weekend_only', new Date(2026, 10, 2, 10, 30)), false); // Monday
  assert.equal(isWeekendDate(SAT_1030), true);
  assert.equal(isWeekendDate(TUE_1030), false);
  // Bad inputs never match a timed/weekend window; a junk window is anytime.
  assert.equal(visitWindowMatchesAt('morning_9_1', new Date(NaN)), false);
  assert.equal(visitWindowMatchesAt('whenever', TUE_1030), true);
});

test('currentVisitShift derives the named shift of a moment', () => {
  assert.equal(currentVisitShift(TUE_1030), 'morning_9_1');
  assert.equal(currentVisitShift(new Date(2026, 9, 27, 14, 0)), 'afternoon_1_5');
  assert.equal(currentVisitShift(TUE_1800), 'evening_after_5');
  assert.equal(currentVisitShift(new Date(2026, 9, 27, 3, 0)), null);
  assert.equal(currentVisitShift(new Date(NaN)), null);
});

test('shift filter: anytime customers appear under every shift (pinned rule)', () => {
  const customers = fixtureCustomers();
  assert.deepEqual(ids(filterByVisitShift(customers, windowOf, 'all')), ['a-any', 'b-morn', 'c-eve', 'd-wknd', 'e-morn']);
  assert.deepEqual(ids(filterByVisitShift(customers, windowOf, 'morning_9_1')), ['a-any', 'b-morn', 'e-morn']);
  assert.deepEqual(ids(filterByVisitShift(customers, windowOf, 'afternoon_1_5')), ['a-any']);
  assert.deepEqual(ids(filterByVisitShift(customers, windowOf, 'evening_after_5')), ['a-any', 'c-eve']);
  assert.deepEqual(ids(filterByVisitShift(customers, windowOf, 'weekend_only')), ['a-any', 'd-wknd']);
  assert.deepEqual(ids(filterByVisitShift(customers, windowOf, 'bogus')), ['a-any', 'b-morn', 'c-eve', 'd-wknd', 'e-morn']);
  assert.ok(VISIT_SHIFT_FILTERS.includes('weekend_only'));
});

test('"Now Match" sort floats matching customers first, stable, input untouched', () => {
  const customers = fixtureCustomers();
  const shuffled = [customers[2], customers[1], customers[3], customers[0], customers[4]];
  const before = JSON.stringify(shuffled);
  // Tuesday 10:30: morning + anytime match -> b-morn, a-any, e-morn in
  // their original relative order, then c-eve and d-wknd in theirs.
  const sorted = sortByVisitWindowNowMatch(shuffled, windowOf, TUE_1030);
  assert.deepEqual(ids(sorted), ['b-morn', 'a-any', 'e-morn', 'c-eve', 'd-wknd']);
  // Tuesday 18:00: evening + anytime match.
  assert.deepEqual(ids(sortByVisitWindowNowMatch(shuffled, windowOf, TUE_1800)), ['c-eve', 'a-any', 'b-morn', 'd-wknd', 'e-morn']);
  // Saturday 10:30: weekend + morning + anytime match.
  assert.deepEqual(ids(sortByVisitWindowNowMatch(shuffled, windowOf, SAT_1030)), ['b-morn', 'd-wknd', 'a-any', 'e-morn', 'c-eve']);
  assert.equal(JSON.stringify(shuffled), before, 'input array is never mutated');
  assert.notEqual(sorted, shuffled, 'a new array is returned');
});

test('filter/sort are pure: a serialized ledger is byte-identical afterwards', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'TEST PURE ONE', new Date(2026, 9, 1), { preferredVisitWindow: 'evening_after_5' });
  state = addCustomer(state, 'TEST PURE TWO', new Date(2026, 9, 1), {});
  const before = JSON.stringify(state);
  filterByVisitShift(state.customers, windowOf, 'morning_9_1');
  sortByVisitWindowNowMatch(state.customers, windowOf, TUE_1030);
  assert.equal(JSON.stringify(state), before);
});

test('addCustomer stores only a non-anytime preference', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'TEST ADD WIN', new Date(2026, 9, 1), { preferredVisitWindow: 'morning_9_1' });
  state = addCustomer(state, 'TEST ADD NONE', new Date(2026, 9, 1), {});
  state = addCustomer(state, 'TEST ADD JUNK', new Date(2026, 9, 1), { preferredVisitWindow: 'whenever' });
  const [withWin, without, junk] = state.customers;
  assert.equal(withWin.preferredVisitWindow, 'morning_9_1');
  assert.ok(!('preferredVisitWindow' in JSON.parse(JSON.stringify(without))), 'no key persisted when unset');
  assert.ok(!('preferredVisitWindow' in JSON.parse(JSON.stringify(junk))), 'junk option stores nothing');
});

test('updateCustomerProfile sets, preserves and clears the preference', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'TEST EDIT WIN', new Date(2026, 9, 1), {});
  const id = state.customers[0].id;
  state = updateCustomerProfile(state, id, { preferredVisitWindow: 'weekend_only' });
  assert.equal(state.customers[0].preferredVisitWindow, 'weekend_only');
  // An unrelated save through the same choke point preserves it.
  state = updateCustomerProfile(state, id, { phone: '03001234567' });
  assert.equal(state.customers[0].preferredVisitWindow, 'weekend_only');
  // Choosing Any time clears the stored key.
  state = updateCustomerProfile(state, id, { preferredVisitWindow: 'anytime' });
  assert.ok(!('preferredVisitWindow' in JSON.parse(JSON.stringify(state.customers[0]))), 'anytime clears the stored key');
  assert.equal(customerVisitWindow(state.customers[0]), 'anytime');
});

test('readState round-trip preserves a set window and normalizes junk away', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'TEST LOAD WIN', new Date(2026, 9, 1), { preferredVisitWindow: 'afternoon_1_5' });
  const storage = { getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(state) : null) };
  const loaded = readState(storage);
  assert.equal(loaded.customers[0].preferredVisitWindow, 'afternoon_1_5');

  const junkState = JSON.parse(JSON.stringify(state));
  junkState.customers[0].preferredVisitWindow = 'whenever';
  const junkStorage = { getItem: (key) => (key === STORAGE_KEY ? JSON.stringify(junkState) : null) };
  const loadedJunk = readState(junkStorage);
  assert.ok(!('preferredVisitWindow' in JSON.parse(JSON.stringify(loadedJunk.customers[0]))), 'junk in storage loads as no preference');
  assert.equal(customerVisitWindow(loadedJunk.customers[0]), 'anytime');
});

test('backup round-trip: a set window survives export + merge, in both directions', () => {
  let deviceA = createInitialState([]);
  deviceA = addCustomer(deviceA, 'TEST BACKUP WIN', new Date(2026, 9, 1), { preferredVisitWindow: 'morning_9_1' });
  const backupText = createJsonBackup(deviceA, new Date(2026, 9, 20));

  // Wholesale adopt: an empty device takes the customer WITH the window.
  const adopted = previewJsonBackupMerge(createInitialState([]), backupText);
  assert.equal(adopted.state.customers.length, 1);
  assert.equal(adopted.state.customers[0].preferredVisitWindow, 'morning_9_1');

  // Fill-merge: the same customer without a local window gains it.
  const local = JSON.parse(JSON.stringify(deviceA));
  delete local.customers[0].preferredVisitWindow;
  const filled = previewJsonBackupMerge(local, backupText);
  assert.equal(filled.state.customers[0].preferredVisitWindow, 'morning_9_1');

  // Reverse: a local window is never erased by a backup that lacks it.
  const bareBackup = JSON.parse(backupText);
  delete bareBackup.state.customers[0].preferredVisitWindow;
  const kept = previewJsonBackupMerge(deviceA, JSON.stringify(bareBackup));
  assert.equal(kept.state.customers[0].preferredVisitWindow, 'morning_9_1');
});

test('i18n: every visitwin_* key exists in English and Urdu and resolves via the label map', () => {
  const keys = [
    'visitwin_form_label', 'visitwin_form_note',
    ...Object.values(VISIT_WINDOW_LABEL_KEYS),
    'visitwin_all_shifts', 'visitwin_now_match'
  ];
  assert.equal(new Set(keys).size, 9, 'the feature adds exactly 9 keys');
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en ${key} must not resolve to the raw key`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur ${key} must not resolve to the raw key`);
  }
  // The label map covers exactly the five windows.
  assert.deepEqual(Object.keys(VISIT_WINDOW_LABEL_KEYS).sort(), [...VISIT_WINDOWS].sort());
});

test('wiring: profile form select, Field Mode shift row, and module seams exist', () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexHtml.includes('id="preferredVisitWindowInput"'), 'profile form select present');
  assert.ok(indexHtml.includes('id="fieldModeShiftFilters"'), 'field mode shift filter row present');
  for (const value of VISIT_WINDOWS) {
    assert.ok(indexHtml.includes(`<option value="${value}" data-i18n="${VISIT_WINDOW_LABEL_KEYS[value]}"`), `form option for ${value}`);
  }
  const fieldMode = readFileSync(new URL('../field-mode.js', import.meta.url), 'utf8');
  assert.ok(fieldMode.includes("from './visit-time-window.js'"), 'field-mode imports the pure helpers');
  assert.ok(fieldMode.includes('data-field-shift'), 'shift chips rendered');
  assert.ok(fieldMode.includes('data-field-now-match'), 'now-match toggle rendered');
  const core = readFileSync(new URL('../core.js', import.meta.url), 'utf8');
  assert.ok(core.includes("from './visit-time-window.js'"), 'core imports the sanitizer');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './visit-time-window.js'"), 'app imports the label seam');
  assert.ok(app.includes('preferredVisitWindowInput'), 'app populates + saves the form select');
});
