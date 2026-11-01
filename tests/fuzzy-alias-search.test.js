import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createInitialState,
  addCustomer,
  updateCustomerProfile,
  readState,
  persistState,
  searchCustomers,
  createJsonBackup,
  previewJsonBackupMerge,
} from '../core.js';
import {
  FATHER_OR_REFERENCE_NAME_MAX_LENGTH,
  SEARCH_ALIAS_MAX_LENGTH,
  SEARCH_ALIASES_MAX_COUNT,
  sanitizeFatherOrReferenceName,
  sanitizeSearchAliases,
  formatSearchAliasesInput,
  romanUrduNameKey,
  fuzzyCustomerNameMatches,
} from '../fuzzy-alias-search.js';
import { filterCustomersBySearchField } from '../customer-search-filter.js';
import { fieldModeSearchMatches } from '../field-mode.js';
import { TRANSLATIONS, t } from '../nav-language.js';

// SISP-165: father / reference name + search aliases on the profile, and a
// Roman-Urdu phonetic matcher so "Fesal" finds "Faisal", "Wasim" finds
// "Waseem", and "M. Aslam" finds "Muhammad Aslam". All fixtures are
// synthetic — no real customer names.

const today = new Date('2026-10-30T12:00:00+05:00');
const here = path.dirname(fileURLToPath(import.meta.url));
const readRepoFile = (name) => readFileSync(path.join(here, '..', name), 'utf8');
const store = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

function fixtureState() {
  let state = createInitialState([]);
  state = addCustomer(state, 'Faisal Raza', today, {
    fatherOrReferenceName: 'Muhammad Aslam',
    searchAliases: ['Haji Sahab'],
    phone: '0300 1112233',
    mohalla: 'BARRIAN',
  });
  state = addCustomer(state, 'Waseem Akhtar', today, { phone: '0321 4445556', mohalla: 'BANII' });
  state = addCustomer(state, 'Riaz Ahmed', today, {
    searchAliases: 'Corner Medical Store, Haji Sahab',
    phone: '0333 7778899',
    mohalla: 'BARRIAN',
  });
  state = addCustomer(state, 'Hussain Tariq', today, { phone: '0345 0001112', mohalla: 'THALII' });
  return state;
}
const byName = (state, name) => state.customers.find((c) => c.name === name);

test('canonicalizer: the spec pairs key EQUAL, transforms apply in order', () => {
  assert.equal(romanUrduNameKey('Fesal'), romanUrduNameKey('Faisal'));
  assert.equal(romanUrduNameKey('Faisal'), 'fesal');
  assert.equal(romanUrduNameKey('Wasim'), romanUrduNameKey('Waseem'));
  assert.equal(romanUrduNameKey('Waseem'), 'wasim');
  // Double-letter collapse (after the ai->e fold) joins Hussain / Husain.
  assert.equal(romanUrduNameKey('Hussain'), romanUrduNameKey('Husain'));
  // Punctuation becomes a token boundary; the initial stays a lone token —
  // "M. Aslam" deliberately does NOT key equal to "Muhammad Aslam"
  // (the token matcher's initial rule bridges it instead).
  assert.equal(romanUrduNameKey('M. Aslam'), 'm aslam');
  assert.notEqual(romanUrduNameKey('M. Aslam'), romanUrduNameKey('Muhammad Aslam'));
  assert.equal(romanUrduNameKey('  Waseem   Akhtar '), 'wasim akhtar');
  assert.equal(romanUrduNameKey("Qur'ban Ali"), 'qurban ali');
  assert.equal(romanUrduNameKey(''), '');
  assert.equal(romanUrduNameKey(null), '');
});

test('sanitizers: caps, comma-string input, case-insensitive dedupe, junk dropped', () => {
  assert.equal(SEARCH_ALIAS_MAX_LENGTH, 40);
  assert.equal(SEARCH_ALIASES_MAX_COUNT, 5);
  assert.equal(FATHER_OR_REFERENCE_NAME_MAX_LENGTH, 100);
  assert.deepEqual(
    sanitizeSearchAliases(' Haji Sahab , haji sahab, Corner Medical Store,, '),
    ['Haji Sahab', 'Corner Medical Store']
  );
  assert.deepEqual(sanitizeSearchAliases(['  Corner   Store ', 42, '', null, 'corner store']), ['Corner Store']);
  assert.equal(sanitizeSearchAliases(['a', 'b', 'c', 'd', 'e', 'f']).length, 5, 'list capped at 5');
  assert.equal(sanitizeSearchAliases(['x'.repeat(60)])[0].length, 40, 'each alias capped at 40 chars');
  assert.deepEqual(sanitizeSearchAliases(undefined), []);
  assert.deepEqual(sanitizeSearchAliases({ nope: true }), []);
  assert.equal(sanitizeFatherOrReferenceName('  Muhammad Aslam  '), 'Muhammad Aslam');
  assert.equal(sanitizeFatherOrReferenceName('x'.repeat(150)).length, 100);
  assert.equal(sanitizeFatherOrReferenceName(42), '');
  assert.equal(formatSearchAliasesInput(['Haji Sahab', 'Corner Medical Store']), 'Haji Sahab, Corner Medical Store');
});

test('matcher: phonetic equivalence both directions + every-token rule', () => {
  const state = fixtureState();
  const faisal = byName(state, 'Faisal Raza');
  const waseem = byName(state, 'Waseem Akhtar');
  const hussain = byName(state, 'Hussain Tariq');
  assert.equal(fuzzyCustomerNameMatches(faisal, 'fesal'), true, '"Fesal" finds "Faisal"');
  assert.equal(fuzzyCustomerNameMatches({ name: 'Fesal Raza' }, 'faisal'), true, '"Faisal" finds "Fesal"');
  assert.equal(fuzzyCustomerNameMatches(waseem, 'wasim'), true, '"Wasim" finds "Waseem"');
  assert.equal(fuzzyCustomerNameMatches({ name: 'Wasim Akhtar' }, 'waseem'), true, '"Waseem" finds "Wasim"');
  assert.equal(fuzzyCustomerNameMatches(hussain, 'husain'), true, '"Husain" finds "Hussain"');
  assert.equal(fuzzyCustomerNameMatches(hussain, 'hussain'), true);
  // Initial rule: "m aslam" finds the father name "Muhammad Aslam".
  assert.equal(fuzzyCustomerNameMatches(faisal, 'm aslam'), true);
  assert.equal(fuzzyCustomerNameMatches(faisal, 'Muhammad Aslam'), true);
  // Prefix tolerance at 3+ letters.
  assert.equal(fuzzyCustomerNameMatches(waseem, 'wase'), true);
  // EVERY query token must match: a missing token fails the whole query.
  assert.equal(fuzzyCustomerNameMatches(faisal, 'fesal ahmed'), false, '"Fesal Ahmed" must not match "Faisal Raza"');
  assert.equal(fuzzyCustomerNameMatches(faisal, 'zzzz'), false);
  assert.equal(fuzzyCustomerNameMatches(faisal, ''), false);
  assert.equal(fuzzyCustomerNameMatches(null, 'fesal'), false);
});

test('matcher: alias + father-name search, Urdu script takes the contains path', () => {
  const state = fixtureState();
  const riaz = byName(state, 'Riaz Ahmed');
  const faisal = byName(state, 'Faisal Raza');
  assert.equal(fuzzyCustomerNameMatches(riaz, 'haji sahab'), true, 'alias "Haji Sahab" finds a differently-named customer');
  assert.equal(fuzzyCustomerNameMatches(riaz, 'corner medical store'), true);
  assert.equal(fuzzyCustomerNameMatches(riaz, 'corner store'), true, 'every-token rule still allows a subset of an alias\u2019 tokens');
  // Searching the father's name finds the son's record.
  assert.equal(fuzzyCustomerNameMatches(faisal, 'aslam'), true);
  // Urdu-script father name: plain contains, canonicalizer untouched.
  const urduFather = { name: 'Aslam Mehmood', fatherOrReferenceName: 'محمد اسلم' };
  assert.equal(fuzzyCustomerNameMatches(urduFather, 'محمد اسلم'), true);
  assert.equal(fuzzyCustomerNameMatches(urduFather, 'محمد'), true);
  assert.equal(fuzzyCustomerNameMatches(urduFather, 'aslam'), true, 'Latin query still matches the Latin name');
});

test('record plumbing: addCustomer + updateCustomerProfile sanitize and store both fields', () => {
  const state = fixtureState();
  const faisal = byName(state, 'Faisal Raza');
  assert.equal(faisal.fatherOrReferenceName, 'Muhammad Aslam');
  assert.deepEqual(faisal.searchAliases, ['Haji Sahab']);
  // Comma-string input through addCustomer options is split + sanitized.
  assert.deepEqual(byName(state, 'Riaz Ahmed').searchAliases, ['Corner Medical Store', 'Haji Sahab']);
  // Absent-by-default: a customer created without the options carries
  // the empty shapes, never invented data.
  const waseem = byName(state, 'Waseem Akhtar');
  assert.equal(waseem.fatherOrReferenceName, '');
  assert.deepEqual(waseem.searchAliases, []);
  // Profile updates flow through the same sanitizers (form posts the
  // comma-joined string; core splits it back).
  let next = updateCustomerProfile(state, waseem.id, { searchAliases: 'Pehlwan Ji, pehlwan ji , Bakery Wala' }, today);
  assert.deepEqual(byName(next, 'Waseem Akhtar').searchAliases, ['Pehlwan Ji', 'Bakery Wala']);
  next = updateCustomerProfile(next, waseem.id, { fatherOrReferenceName: '  Akhtar Mehmood ' }, today);
  assert.equal(byName(next, 'Waseem Akhtar').fatherOrReferenceName, 'Akhtar Mehmood');
  // Clearing works: empty string / empty input clear both fields.
  next = updateCustomerProfile(next, waseem.id, { fatherOrReferenceName: '', searchAliases: '' }, today);
  assert.equal(byName(next, 'Waseem Akhtar').fatherOrReferenceName, '');
  assert.deepEqual(byName(next, 'Waseem Akhtar').searchAliases, []);
  // Overlong father name is refused at the write choke point.
  assert.throws(
    () => updateCustomerProfile(state, waseem.id, { fatherOrReferenceName: 'x'.repeat(101) }, today),
    /100 characters or fewer/
  );
});

test('readState: round-trip preserves both fields; legacy + corrupt values load clean', () => {
  const storage = store();
  const state = fixtureState();
  persistState(state, storage);
  const loaded = readState(storage);
  assert.equal(byName(loaded, 'Faisal Raza').fatherOrReferenceName, 'Muhammad Aslam');
  assert.deepEqual(byName(loaded, 'Faisal Raza').searchAliases, ['Haji Sahab']);
  // Legacy record without the fields + a corrupt one: no invention.
  const legacy = JSON.parse(JSON.stringify(state));
  delete legacy.customers[0].fatherOrReferenceName;
  delete legacy.customers[0].searchAliases;
  legacy.customers[1].searchAliases = 'not-an-array';
  legacy.customers[1].fatherOrReferenceName = 42;
  storage.setItem('shahdara-isp-billing-v1', JSON.stringify(legacy));
  const reloaded = readState(storage);
  assert.equal(reloaded.customers[0].fatherOrReferenceName, '');
  assert.deepEqual(reloaded.customers[0].searchAliases, []);
  assert.deepEqual(reloaded.customers[1].searchAliases, ['not-an-array'], 'a stored comma string still sanitizes into a list');
  assert.equal(reloaded.customers[1].fatherOrReferenceName, '');
});

test('backup: fields travel in JSON backups; merge fills father name and unions aliases', () => {
  const state = fixtureState();
  const backupJson = createJsonBackup(state, new Date('2026-10-30T00:00:00Z'));
  const parsed = JSON.parse(backupJson);
  assert.equal(parsed.state.customers.find((c) => c.name === 'Faisal Raza').fatherOrReferenceName, 'Muhammad Aslam');
  // Restore into an empty ledger: the added customer carries both fields.
  const intoEmpty = previewJsonBackupMerge(createInitialState([]), backupJson);
  assert.equal(intoEmpty.canApply, true);
  assert.deepEqual(byName(intoEmpty.state, 'Riaz Ahmed').searchAliases, ['Corner Medical Store', 'Haji Sahab']);
  // Merge onto a local copy that knows one alias + no father name:
  // father name fills in, aliases union, nothing conflicts.
  const local = JSON.parse(JSON.stringify(state));
  const localFaisal = local.customers.find((c) => c.name === 'Faisal Raza');
  localFaisal.fatherOrReferenceName = '';
  localFaisal.searchAliases = ['Doctor Sahab'];
  const merged = previewJsonBackupMerge(local, backupJson);
  const mergedFaisal = merged.state.customers.find((c) => c.name === 'Faisal Raza');
  assert.equal(mergedFaisal.fatherOrReferenceName, 'Muhammad Aslam');
  assert.deepEqual(mergedFaisal.searchAliases, ['Doctor Sahab', 'Haji Sahab']);
  assert.equal(merged.conflicts.filter((c) => c.field === 'searchAliases').length, 0, 'alias union never conflicts');
  // A backup whose customer carries a malformed alias list is rejected.
  const bad = JSON.parse(backupJson);
  bad.state.customers[0].searchAliases = ['ok', 42];
  assert.throws(() => previewJsonBackupMerge(createInitialState([]), JSON.stringify(bad)), /invalid search alias list/);
});

test('integration: Customers Name mode finds father/alias/phonetic; other modes unchanged', () => {
  const state = fixtureState();
  const ids = (field, query) => filterCustomersBySearchField(state.customers, field, query).map((c) => c.name);
  assert.deepEqual(ids('name', 'haji sahab'), ['Faisal Raza', 'Riaz Ahmed'], 'alias search returns both alias holders, roster order kept');
  assert.deepEqual(ids('name', 'muhammad aslam'), ['Faisal Raza'], 'father name finds the son');
  assert.deepEqual(ids('name', 'm aslam'), ['Faisal Raza'], 'initial form finds the father name');
  assert.deepEqual(ids('name', 'fesal'), ['Faisal Raza'], 'phonetic spelling finds the record');
  assert.deepEqual(ids('name', 'wasim'), ['Waseem Akhtar']);
  assert.deepEqual(ids('name', 'corner medical'), ['Riaz Ahmed']);
  // The other field modes are byte-identical to their pre-SISP-165
  // behaviour on this fixture (same expected id sets as the shipped
  // customer-search-mohalla pins use).
  assert.deepEqual(ids('mobile', '4445556'), ['Waseem Akhtar']);
  assert.deepEqual(ids('mobile', 'fesal'), []);
  assert.deepEqual(ids('userid', '2'), ['Waseem Akhtar']);
  assert.deepEqual(ids('userid', 'Faisal'), []);
  assert.deepEqual(ids('area', 'bani'), ['Waseem Akhtar']);
  assert.deepEqual(ids('area', 'barrian'), ['Faisal Raza', 'Riaz Ahmed']);
  assert.deepEqual(ids('area', 'haji'), [], 'aliases never leak into Area mode');
});

test('integration: core searchCustomers (plain roster search) finds father/alias names', () => {
  const state = fixtureState();
  assert.deepEqual(searchCustomers(state, 'Muhammad Aslam').map((c) => c.name), ['Faisal Raza']);
  assert.deepEqual(searchCustomers(state, 'haji sahab').map((c) => c.name), ['Faisal Raza', 'Riaz Ahmed']);
  assert.deepEqual(searchCustomers(state, 'fesal').map((c) => c.name), ['Faisal Raza']);
  assert.deepEqual(searchCustomers(state, 'corner medical store').map((c) => c.name), ['Riaz Ahmed']);
});

test('integration: Field Mode search finds by alias, father name and phonetic spelling', () => {
  const state = fixtureState();
  const riaz = byName(state, 'Riaz Ahmed');
  const faisal = byName(state, 'Faisal Raza');
  const entryOf = (c) => ({ id: c.id, name: c.name, customerNumber: c.customerNumber, phone: c.phone, mohalla: c.mohalla });
  assert.equal(fieldModeSearchMatches(entryOf(riaz), riaz, 'haji sahab'), true);
  assert.equal(fieldModeSearchMatches(entryOf(riaz), riaz, 'corner medical'), true);
  assert.equal(fieldModeSearchMatches(entryOf(faisal), faisal, 'fesal'), true);
  assert.equal(fieldModeSearchMatches(entryOf(faisal), faisal, 'm aslam'), true);
  assert.equal(fieldModeSearchMatches(entryOf(faisal), faisal, 'muhammad aslam'), true);
  assert.equal(fieldModeSearchMatches(entryOf(riaz), riaz, 'fesal'), false, 'no cross-customer leakage');
});

test('wiring: profile form fields, app.js hooks, i18n keys in both languages', () => {
  const index = readRepoFile('index.html');
  assert.ok(index.includes('id="fatherOrReferenceNameInput"'), 'profile form has the father/reference input');
  assert.ok(index.includes('id="searchAliasesInput"'), 'profile form has the comma-joined aliases input');
  assert.ok(index.includes('data-i18n="fas_form_father"'));
  assert.ok(index.includes('data-i18n="fas_form_aliases"'));
  const app = readRepoFile('app.js');
  assert.ok(app.includes("fatherOrReferenceName: $('#fatherOrReferenceNameInput').value"), 'save handler posts the father name');
  assert.ok(app.includes("searchAliases: $('#searchAliasesInput').value"), 'save handler posts the aliases string');
  assert.ok(app.includes("$('#fatherOrReferenceNameInput').value = customer.fatherOrReferenceName"), 'edit form is filled from the record');
  assert.ok(app.includes("$('#searchAliasesInput').value = (customer.searchAliases ?? []).join(', ')"), 'aliases render back comma-joined');
  assert.ok(app.includes("t('fas_field_father')"), 'profile view shows the father name when recorded');
  for (const key of ['fas_form_father', 'fas_form_father_note', 'fas_form_aliases', 'fas_form_aliases_note', 'fas_form_aliases_ph', 'fas_field_father', 'fas_field_aliases']) {
    assert.ok(Object.hasOwn(TRANSLATIONS.en, key), `en dictionary carries ${key}`);
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur dictionary carries ${key}`);
    assert.notEqual(t(key, 'en'), key, `${key} never renders raw in English`);
    assert.notEqual(t(key, 'ur'), key, `${key} never renders raw in Urdu`);
  }
  // Every data-i18n key used by the new inputs exists in both dicts
  // (mechanical audit of the keys this phase adds).
  for (const key of ['fas_form_father', 'fas_form_father_note', 'fas_form_aliases', 'fas_form_aliases_note', 'fas_form_aliases_ph']) {
    assert.ok(index.includes(`data-i18n${key.startsWith('fas_form_aliases_ph') ? '-placeholder' : ''}="${key}"`), `index.html references ${key}`);
  }
});
