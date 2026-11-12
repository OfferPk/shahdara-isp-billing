import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  CUSTOMER_SEARCH_FIELDS,
  normalizeCustomerSearchField,
  customerMatchesSearchField,
  filterCustomersBySearchField,
  buildMohallaUserCounts,
} from '../customer-search-filter.js';
import {
  filterCustomersByArea,
  NO_AREA_FILTER_VALUE,
  groupAreasWithCounts,
} from '../form-validation.js';
import { identitySearchMatches } from '../core.js';

// Plan L — Customer findability (folds in CP-05, CP-09).
//
// (1) The Customers area filter gains a counted "No area set" option
//     listing exactly the blank-area customers. The counting/filtering
//     lives in filterCustomersByArea (sentinel value) and in
//     renderCustomers, which builds the option only when the active
//     count is above zero; the dashboard mohalla cards are unchanged
//     (a card still exists only where users are — see Plan T scope).
// (2) The field selector gains an Identity option that reuses
//     core.js identitySearchMatches unchanged (PPPoE, static IP, MAC,
//     router serial, separator-insensitive MAC). No search logic is
//     changed in this plan, and the other fields are unchanged.

const here = path.dirname(fileURLToPath(import.meta.url));
const readRepoFile = (name) => readFileSync(path.join(here, '..', name), 'utf8');

// One customer per identity channel, plus a plain customer with no
// identity values at all. Names, phones and areas are deliberately
// distinct from the identity values so field isolation can be proven.
const identified = [
  { id: 'c-pppoe', customerNumber: 1, name: 'Pppoe Owner', phone: '03001110001', mohalla: 'BARRIAN', pppoeUsername: 'ali.pppoe', staticIp: '', macAddress: '', serialNumber: '' },
  { id: 'c-ip', customerNumber: 2, name: 'Ip Owner', phone: '03001110002', mohalla: 'BANII', pppoeUsername: '', staticIp: '10.10.1.55', macAddress: '', serialNumber: '' },
  { id: 'c-mac', customerNumber: 3, name: 'Mac Owner', phone: '03001110003', mohalla: 'PALALIYAA', pppoeUsername: '', staticIp: '', macAddress: 'AA:BB:CC:DD:EE:FF', serialNumber: '' },
  { id: 'c-serial', customerNumber: 4, name: 'Serial Owner', phone: '03001110004', mohalla: 'BARRIAN', pppoeUsername: '', staticIp: '', macAddress: '', serialNumber: 'ZTE-9876' },
  { id: 'c-plain', customerNumber: 5, name: 'Plain Owner', phone: '03001110005', mohalla: 'BARRIAN', pppoeUsername: '', staticIp: '', macAddress: '', serialNumber: '' },
];

const ids = (field, query, list = identified) => filterCustomersBySearchField(list, field, query).map((c) => c.id);

test('field catalogue is Name / Mobile / User ID / Area / Identity, in that order', () => {
  assert.deepEqual(CUSTOMER_SEARCH_FIELDS.map((field) => field.id), ['name', 'mobile', 'userid', 'area', 'identity']);
  assert.deepEqual(CUSTOMER_SEARCH_FIELDS.map((field) => field.label), ['Name', 'Mobile', 'User ID', 'Area', 'Identity']);
});

test('normalizeCustomerSearchField accepts identity and still falls back to name for unknowns', () => {
  assert.equal(normalizeCustomerSearchField('identity'), 'identity');
  assert.equal(normalizeCustomerSearchField(' IDENTITY '), 'identity');
  assert.equal(normalizeCustomerSearchField('bogus'), 'name');
  assert.equal(normalizeCustomerSearchField(''), 'name');
  assert.equal(normalizeCustomerSearchField(undefined), 'name');
});

test('identity: PPPoE username matches, partial and case-insensitive', () => {
  assert.deepEqual(ids('identity', 'ali.pppoe'), ['c-pppoe']);
  assert.deepEqual(ids('identity', 'ALI.PP'), ['c-pppoe']);
  assert.deepEqual(ids('identity', 'pppoe'), ['c-pppoe']);
  assert.deepEqual(ids('identity', 'no.such.user'), []);
});

test('identity: static IP matches, partial and exact', () => {
  assert.deepEqual(ids('identity', '10.10.1.55'), ['c-ip']);
  assert.deepEqual(ids('identity', '10.10.1'), ['c-ip']);
  assert.deepEqual(ids('identity', '10.10.9.99'), []);
});

test('identity: MAC matches with colons, dashes and without separators', () => {
  assert.deepEqual(ids('identity', 'AA:BB:CC'), ['c-mac']);
  assert.deepEqual(ids('identity', 'aa-bb-cc'), ['c-mac']);
  assert.deepEqual(ids('identity', 'aabbcc'), ['c-mac']);
  assert.deepEqual(ids('identity', 'aabbccddeeff'), ['c-mac']);
  assert.deepEqual(ids('identity', '112233'), []);
});

test('identity: router serial matches, partial and case-insensitive', () => {
  assert.deepEqual(ids('identity', 'zte-9876'), ['c-serial']);
  assert.deepEqual(ids('identity', 'ZTE'), ['c-serial']);
  assert.deepEqual(ids('identity', '9876'), ['c-serial']);
  assert.deepEqual(ids('identity', 'zte-0000'), []);
});

test('identity: the field matches ONLY identity values, never name/phone/area/user id', () => {
  assert.deepEqual(ids('identity', 'Pppoe Owner'), []);
  assert.deepEqual(ids('identity', '03001110001'), []);
  assert.deepEqual(ids('identity', 'BARRIAN'), []);
  assert.deepEqual(ids('identity', '#2'), []);
  // A name query that is also a substring of nothing identity-like
  // must not leak through the other fields' matchers.
  assert.equal(customerMatchesSearchField(identified[0], 'identity', 'Pppoe Owner'), false);
});

test('identity: blank query is unfiltered, exactly like the other fields', () => {
  assert.deepEqual(ids('identity', ''), identified.map((c) => c.id));
  assert.deepEqual(ids('identity', '   '), identified.map((c) => c.id));
});

test('identity: short hex queries do not match a MAC (existing SISP-74 rule, unchanged)', () => {
  // identitySearchMatches requires at least 4 hex chars on the
  // separator-insensitive path; a 3-char query must not match.
  assert.equal(identitySearchMatches(identified[2], 'aab'), false);
  assert.equal(customerMatchesSearchField(identified[2], 'identity', 'aab'), false);
});

test('identity: archived customers are still found by the helper (archived handling unchanged)', () => {
  const archived = { ...identified[0], archived: true };
  const list = [archived, identified[4]];
  assert.deepEqual(ids('identity', 'ali.pppoe', list), ['c-pppoe']);
  assert.deepEqual(ids('identity', 'ali.pppoe', list.filter((c) => !c.archived)), []);
});

test('other fields are unchanged: name, mobile, user id and area still behave as before', () => {
  assert.deepEqual(ids('name', 'Mac Owner'), ['c-mac']);
  assert.deepEqual(ids('name', '03001110003'), []);
  assert.deepEqual(ids('mobile', '03001110003'), ['c-mac']);
  assert.deepEqual(ids('mobile', '1110003'), ['c-mac']);
  assert.deepEqual(ids('userid', '3'), ['c-mac']);
  assert.deepEqual(ids('userid', '#3'), ['c-mac']);
  assert.deepEqual(ids('area', 'barrian'), ['c-pppoe', 'c-serial', 'c-plain']);
  assert.deepEqual(ids('area', 'BANII'), ['c-ip']);
  // Identity values must not leak into the other fields.
  assert.deepEqual(ids('name', 'ali.pppoe'), []);
  assert.deepEqual(ids('mobile', '10.10.1.55'), []);
  assert.deepEqual(ids('area', 'AA:BB:CC'), []);
});

const areaList = [
  { id: 'a-blank', customerNumber: 1, name: 'No Mohalla', mohalla: '', area: '' },
  { id: 'a-spaces', customerNumber: 2, name: 'Spaces Only', mohalla: '   ', area: '' },
  { id: 'a-unset', customerNumber: 3, name: 'Nothing Set', area: '' },
  { id: 'a-area-only', customerNumber: 4, name: 'Area Only', mohalla: '', area: 'BARRIAN' },
  { id: 'a-named', customerNumber: 5, name: 'Named', mohalla: 'BARRIAN', area: '' },
  { id: 'a-named-2', customerNumber: 6, name: 'Named Two', mohalla: 'BANII', area: '' },
];

test('no-area filter: sentinel lists exactly the blank-area customers', () => {
  assert.deepEqual(
    filterCustomersByArea(areaList, NO_AREA_FILTER_VALUE).map((c) => c.id),
    ['a-blank', 'a-spaces', 'a-unset'],
  );
});

test('no-area filter: a customer with an area set is not no-area, even with a blank mohalla', () => {
  const filtered = filterCustomersByArea(areaList, NO_AREA_FILTER_VALUE);
  assert.ok(!filtered.some((c) => c.id === 'a-area-only'));
  assert.ok(!filtered.some((c) => c.id === 'a-named'));
});

test('no-area filter: whitespace-only mohalla counts as no area', () => {
  assert.ok(filterCustomersByArea(areaList, NO_AREA_FILTER_VALUE).some((c) => c.id === 'a-spaces'));
});

test('no-area filter: sentinel never collides with a real area value', () => {
  const tricky = [{ id: 't-1', mohalla: NO_AREA_FILTER_VALUE }, { id: 't-2', mohalla: '' }];
  assert.deepEqual(filterCustomersByArea(tricky, NO_AREA_FILTER_VALUE).map((c) => c.id), ['t-2']);
});

test('no-area filter: all and named areas still behave exactly as before', () => {
  assert.deepEqual(filterCustomersByArea(areaList, 'all').map((c) => c.id), areaList.map((c) => c.id));
  assert.deepEqual(filterCustomersByArea(areaList, 'BARRIAN').map((c) => c.id), ['a-area-only', 'a-named']);
  assert.deepEqual(filterCustomersByArea(areaList, 'BANII').map((c) => c.id), ['a-named-2']);
  assert.deepEqual(filterCustomersByArea(areaList, 'nowhere'), []);
});

test('no-area filter: the helper does not exclude archived customers (callers filter active, as before)', () => {
  const archivedBlank = { id: 'a-arch', mohalla: '', archived: true };
  assert.deepEqual(filterCustomersByArea([archivedBlank], NO_AREA_FILTER_VALUE).map((c) => c.id), ['a-arch']);
  // The roster count is active-only because renderCustomers builds
  // its options from active customers — the same input the named
  // areas are counted from.
  assert.deepEqual(
    filterCustomersByArea([archivedBlank].filter((c) => !c.archived), NO_AREA_FILTER_VALUE),
    [],
  );
});

test('no-area filter: empty and non-array inputs stay safe', () => {
  assert.deepEqual(filterCustomersByArea([], NO_AREA_FILTER_VALUE), []);
  assert.deepEqual(filterCustomersByArea(null, NO_AREA_FILTER_VALUE), []);
  assert.deepEqual(filterCustomersByArea(undefined, 'all'), []);
});

test('groupAreasWithCounts still skips blank areas (dashboard cards unchanged by Plan L)', () => {
  const groups = groupAreasWithCounts(areaList);
  // Mohalla Numbering: BARRIAN is #3 and BANII is #9, so BARRIAN
  // reads first — the counts themselves are unchanged.
  assert.deepEqual(groups, [
    { value: 'BARRIAN', count: 2, label: 'BARRIAN (2)' },
    { value: 'BANII', count: 1, label: 'BANII (1)' },
  ]);
});

test('buildMohallaUserCounts still counts no-mohalla customers nowhere (dashboard unchanged)', () => {
  const rows = buildMohallaUserCounts(areaList);
  assert.ok(rows.every((row) => row.count > 0));
  assert.equal(rows.reduce((sum, row) => sum + row.count, 0), 3);
});

test('wiring: search field select offers Identity and the language file carries its keys', () => {
  const index = readRepoFile('index.html');
  assert.ok(index.includes('<option value="identity"'), 'field select offers identity');
  assert.ok(index.includes('data-i18n="cust_search_field_identity"'), 'identity option is localised');
  const language = readRepoFile('nav-language.js');
  for (const key of ['cust_search_field_identity', 'cust_area_filter_no_area']) {
    assert.ok(language.includes(`${key}:`), `nav-language.js carries ${key}`);
  }
  assert.ok(language.includes("cust_area_filter_no_area: 'No area set'"), 'English no-area label');
});

test('wiring: app.js renders a counted no-area option only from active customers', () => {
  const app = readRepoFile('app.js');
  assert.ok(app.includes('NO_AREA_FILTER_VALUE'), 'app.js imports the no-area sentinel');
  assert.ok(app.includes('noAreaCount'), 'app.js counts blank-area customers');
  assert.ok(app.includes("t('cust_area_filter_no_area')"), 'app.js labels the option');
  assert.ok(app.includes('noAreaCount > 0'), 'option is built only when the count is above zero');
  assert.ok(app.includes('allAreaOptions'), 'sentinel participates in the current-value check');
});

test('wiring: app.js roster CSV export honours the no-area filter too', () => {
  const app = readRepoFile('app.js');
  assert.ok(app.includes('customerAreaFilter === NO_AREA_FILTER_VALUE'), 'CSV export handles the sentinel');
});

test('wiring: customer-search-filter reuses core identity logic, it does not reimplement it', () => {
  const module = readRepoFile('customer-search-filter.js');
  assert.ok(module.includes("from './core.js'"), 'filter module imports from core.js');
  assert.ok(module.includes('identitySearchMatches'), 'filter module uses identitySearchMatches');
  assert.ok(module.includes("case 'identity'"), 'identity case exists in the field switch');
});

test('identity: MAC matching is case-insensitive across separators', () => {
  assert.deepEqual(ids('identity', 'Aa:Bb:Cc'), ['c-mac']);
  assert.deepEqual(ids('identity', 'aa:bb:cc:dd:ee:ff'), ['c-mac']);
});

test('identity: only the four SISP-74 fields match — wifi and passwords do not', () => {
  const customer = { id: 'c-wifi', name: 'Wifi Owner', wifiSsid: 'mywifi', pppoePassword: 'secret123', pppoeUsername: '', staticIp: '', macAddress: '', serialNumber: '' };
  assert.deepEqual(ids('identity', 'mywifi', [customer]), []);
  assert.deepEqual(ids('identity', 'secret123', [customer]), []);
});

test('identity: customers with missing identity fields do not crash and do not match', () => {
  const bare = { id: 'c-bare', name: 'Bare Owner' };
  assert.equal(customerMatchesSearchField(bare, 'identity', 'anything'), false);
  assert.deepEqual(ids('identity', 'aabbcc', [bare]), []);
});

test('identity: serial matching is separator-insensitive too (existing core rule)', () => {
  const customer = { id: 'c-ser2', serialNumber: 'AA-BB-99' };
  assert.equal(customerMatchesSearchField(customer, 'identity', 'aabb99'), true);
  assert.equal(customerMatchesSearchField(customer, 'identity', 'AA-BB'), true);
  assert.equal(customerMatchesSearchField(customer, 'identity', 'cc99'), false);
});

test('identity: PPPoE partial matches across dots and dashes', () => {
  assert.deepEqual(ids('identity', 'ali.'), ['c-pppoe']);
  assert.deepEqual(ids('identity', '.pppoe'), ['c-pppoe']);
});

test('identity: surrounding whitespace on the query is trimmed', () => {
  assert.deepEqual(ids('identity', '  ali.pppoe  '), ['c-pppoe']);
  assert.deepEqual(ids('identity', '  aabbcc  '), ['c-mac']);
});

test('composition: area filter and identity field search AND together (roster pipeline)', () => {
  const pool = filterCustomersByArea(identified, 'BARRIAN');
  assert.deepEqual(ids('identity', 'ali.pppoe', pool), ['c-pppoe']);
  assert.deepEqual(ids('identity', '10.10.1.55', pool), []);
  const noAreaPool = filterCustomersByArea(
    [...identified, { id: 'c-blank-id', pppoeUsername: 'blank.pppoe', mohalla: '' }],
    NO_AREA_FILTER_VALUE,
  );
  assert.deepEqual(ids('identity', 'blank.pppoe', noAreaPool), ['c-blank-id']);
});

test('area field: canonical spelling variants still resolve (Bani found by BANII)', () => {
  const list = [{ id: 'v-1', mohalla: 'Bani' }, { id: 'v-2', mohalla: 'BARRIAN' }];
  assert.deepEqual(ids('area', 'BANII', list), ['v-1']);
  assert.deepEqual(ids('area', 'bani', list), ['v-1']);
});

test('no-area filter: a customer object with no mohalla/area keys at all counts as no-area', () => {
  const list = [{ id: 'k-1', name: 'Keyless' }, { id: 'k-2', name: 'Named', mohalla: 'BARRIAN' }];
  assert.deepEqual(filterCustomersByArea(list, NO_AREA_FILTER_VALUE).map((c) => c.id), ['k-1']);
});

test('wiring: the field help text documents the Identity field', () => {
  const language = readRepoFile('nav-language.js');
  assert.ok(language.includes('Identity matches the PPPoE username'), 'English help mentions Identity');
  assert.ok(language.includes('PPPoE'), 'Urdu help mentions PPPoE');
});

test('wiring: core search logic itself is untouched by Plan L', () => {
  const core = readRepoFile('core.js');
  assert.ok(core.includes('export function identitySearchMatches'), 'identitySearchMatches still exported from core');
  // The field-scoped module must not have duplicated the MAC hex
  // logic — reuse is the contract, so the hex path lives in core only.
  const module = readRepoFile('customer-search-filter.js');
  assert.ok(!module.includes('replace(/[^0-9a-f]/g'), 'no duplicated MAC hex logic in the filter module');
});
