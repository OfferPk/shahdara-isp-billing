// SISP-172: Private Local Roster Import & Bulk Setup Incomplete Customers grid.
//
// PRIVACY: every fixture below is SYNTHETIC (invented "Test ..." names and
// fake 0300-11x numbers). The owner's real roster is never in this repo —
// the import exists so the owner can pick his own private file on his own
// device at runtime; nothing here reads or embeds any real customer data.
//
// Pins: roster JSON/CSV parsing with malformed-row skip reporting,
// planner-fed idempotent import (same file twice adds 0), FREE
// (isFreeConnection) preservation through import AND the grid, incomplete
// filtering (!package || !phone in the record's real fields), the
// canonical-Mohalla filter, and bulk save through the real seams
// (core updateCustomerProfile + customer-plan applyCustomerPlan —
// package history and this month's bill prove the seam).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parsePrivateRosterJson,
  parsePrivateRosterCsv,
  parsePrivateRoster,
  importPrivateRoster,
  customerHasPackage,
  isIncompleteCustomer,
  incompleteCustomers,
  incompleteMohallaGroups,
  applyBulkSetup
} from '../bulk-onboarding-grid.js';
import { createInitialState, addCustomer } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-10-15T12:00:00Z');
const blankState = () => createInitialState([]);

// ---------- JSON parsing ----------

test('json parse: bare array form, forgiving keys, free + phone + package honoured', () => {
  const { entries, skipped, error } = parsePrivateRosterJson(JSON.stringify([
    { name: 'Test Customer Alpha', mohalla: 'BARRIAN', phone: '03001112233', package: '15Mbps Unlimited' },
    { customerName: 'Test Customer Beta', area: 'THALII', isFreeConnection: true },
    { name: 'Test Customer Gamma', mohalla: 'CHARYAA', packageId: '5mbps-150gb' }
  ]));
  assert.equal(error, null);
  assert.deepEqual(skipped, []);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].phone, '+923001112233');
  assert.deepEqual(entries[0].package, { packageId: '15mbps-unlimited', packageLabel: '15Mbps Unlimited', fee: 3000 });
  assert.equal(entries[1].free, true);
  assert.equal(entries[1].mohalla, 'THALII');
  assert.deepEqual(entries[2].package, { packageId: '5mbps-150gb', packageLabel: '5Mbps / 150GB', fee: 1500 });
});

test('json parse: object wrapper forms (roster / customers / entries)', () => {
  for (const key of ['roster', 'customers', 'entries']) {
    const { entries, error } = parsePrivateRosterJson(JSON.stringify({ [key]: [{ name: 'Test Wrapper', mohalla: 'SODAA' }] }));
    assert.equal(error, null);
    assert.equal(entries.length, 1);
  }
});

test('json parse: malformed rows are skipped with reasons, valid rows still parse', () => {
  const { entries, skipped, error } = parsePrivateRosterJson(JSON.stringify([
    { name: 'Test Good Row', mohalla: 'BARRIAN' },
    { mohalla: 'BARRIAN' },
    'not an object',
    { name: 'Test Bad Phone', mohalla: 'BARRIAN', phone: '12345' },
    { name: 'Test Bad Package', mohalla: 'BARRIAN', packageId: 'no-such-package' },
    { name: 'Test Also Good', mohalla: 'THALII' }
  ]));
  assert.equal(error, null);
  assert.deepEqual(entries.map(e => e.name), ['Test Good Row', 'Test Also Good']);
  assert.equal(skipped.length, 4);
  assert.equal(skipped[0].ref, 2);
  assert.match(skipped[1].reason, /not an object/);
  assert.match(skipped[2].reason, /Invalid phone/);
  assert.match(skipped[3].reason, /Unknown package/);
});

test('json parse: unreadable JSON and list-less JSON import nothing and report an error', () => {
  assert.deepEqual(parsePrivateRosterJson('{oops'), { entries: [], skipped: [], error: 'invalid-json' });
  assert.deepEqual(parsePrivateRosterJson('{"hello": 1}'), { entries: [], skipped: [], error: 'no-list' });
});

// ---------- CSV parsing ----------

test('csv parse: header form maps name/mohalla/phone/package/free columns', () => {
  const csv = [
    'Name,Mohalla,Phone,Package,Free',
    'Test Csv Alpha,BARRIAN,03001112233,15Mbps Unlimited,',
    'Test Csv Free,THALII,,,true',
    'Test Csv Bad,NAKAR,999,'
  ].join('\n');
  const { entries, skipped, error } = parsePrivateRosterCsv(csv);
  assert.equal(error, null);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].package.packageId, '15mbps-unlimited');
  assert.equal(entries[1].free, true);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].ref, 4);
  assert.match(skipped[0].reason, /Invalid phone/);
});

test('csv parse: headerless rows use the SISP-53 name-first positional layout', () => {
  const csv = 'Test Positional Alpha,03001112233,5Mbps / 150GB,1500,BARRIAN\n\nTest Positional Beta,,, ,CHARYAA';
  const { entries, skipped } = parsePrivateRosterCsv(csv);
  assert.deepEqual(skipped, []);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].package, { packageId: '5mbps-150gb', packageLabel: '5Mbps / 150GB', fee: 1500 });
  assert.equal(entries[0].mohalla, 'BARRIAN');
  assert.equal(entries[1].package, null);
  assert.equal(entries[1].mohalla, 'CHARYAA');
});

test('parse dispatch: extension wins, otherwise content sniffing', () => {
  const json = '[{"name":"Test Sniff","mohalla":"SODAA"}]';
  assert.equal(parsePrivateRoster(json, 'roster.json').entries.length, 1);
  assert.equal(parsePrivateRoster(json).entries.length, 1);
  assert.equal(parsePrivateRoster('Name,Mohalla\nTest Sniff,SODAA', 'roster.csv').entries.length, 1);
  assert.equal(parsePrivateRoster('Name,Mohalla\nTest Sniff,SODAA').entries.length, 1);
});

// ---------- Import (planner-fed, idempotent) ----------

const ROSTER = [
  { name: 'Test Import Alpha', mohalla: 'BARRIAN', free: false, phone: '', package: null },
  { name: 'Test Import Beta', mohalla: 'BARRIAN', free: false, phone: '', package: null },
  { name: 'Test Import Alpha', mohalla: 'CHARYAA', free: false, phone: '', package: null },
  { name: 'Test Import Free', mohalla: 'THALII', free: true, phone: '', package: null }
];

test('import: blank store gains the roster through the real creation path', () => {
  const res = importPrivateRoster(blankState(), ROSTER, { referenceDate: REF_DATE });
  assert.equal(res.added, 4);
  assert.equal(res.alreadyPresent, 0);
  assert.deepEqual(res.failed, []);
  assert.equal(res.nextState.customers.length, 4);
  const numbers = new Set(res.nextState.customers.map(c => c.customerNumber));
  assert.equal(numbers.size, 4);
  for (const customer of res.nextState.customers) {
    assert.equal(customer.phone, '');
    assert.equal(customer.packageSpeed, '');
    assert.equal(customer.monthlySellingAmount, null);
    assert.deepEqual(customer.bills, []);
  }
});

test('import: importing the same roster twice adds ZERO the second time (idempotent)', () => {
  const first = importPrivateRoster(blankState(), ROSTER, { referenceDate: REF_DATE });
  const second = importPrivateRoster(first.nextState, ROSTER, { referenceDate: REF_DATE });
  assert.equal(second.added, 0);
  assert.equal(second.alreadyPresent, ROSTER.length);
  assert.equal(second.nextState.customers.length, 4);
});

test('import: a hand-typed existing customer satisfies the roster — only the shortfall is added', () => {
  const hand = addCustomer(blankState(), 'Test Import Alpha', REF_DATE, { mohalla: 'BARRIAN' });
  const res = importPrivateRoster(hand, ROSTER, { referenceDate: REF_DATE });
  assert.equal(res.added, 3);
  assert.equal(res.alreadyPresent, 1);
  assert.equal(res.nextState.customers.length, 4);
  assert.equal(res.nextState.customers[0].name, 'Test Import Alpha');
});

test('import: phone + package columns land through the real seams (plan applied, bill created)', () => {
  const { entries } = parsePrivateRosterJson(JSON.stringify([
    { name: 'Test Full Row', mohalla: 'BARRIAN', phone: '03001112233', package: '15Mbps Unlimited' }
  ]));
  const res = importPrivateRoster(blankState(), entries, { referenceDate: REF_DATE });
  assert.equal(res.added, 1);
  const customer = res.nextState.customers[0];
  assert.equal(customer.phone, '+923001112233');
  assert.equal(customer.packageSpeed, '15Mbps Unlimited');
  assert.equal(customer.monthlySellingAmount, 3000);
  assert.equal(customer.packageHistory.length, 1);
  assert.ok(customer.bills.some(bill => bill.month === '2026-10'), 'current-month bill created by applyCustomerPlan');
  assert.equal(isIncompleteCustomer(customer), false);
});

test('import: a failing row is reported in failed and never loses the rest of the batch', () => {
  const longMohalla = 'X'.repeat(150);
  const res = importPrivateRoster(blankState(), [
    { name: 'Test Survives', mohalla: 'BARRIAN', free: false, phone: '', package: null },
    { name: 'Test Too Long Mohalla', mohalla: longMohalla, free: false, phone: '', package: null }
  ], { referenceDate: REF_DATE });
  assert.equal(res.added, 1);
  assert.equal(res.failed.length, 1);
  assert.equal(res.failed[0].name, 'Test Too Long Mohalla');
  assert.equal(res.nextState.customers.length, 1);
});

// ---------- FREE preservation ----------

test('free: roster free entry lands as isFreeConnection and is never given a priced plan', () => {
  const { entries } = parsePrivateRosterJson(JSON.stringify([
    { name: 'Test Synthetic Free', mohalla: 'THALII', free: true, package: '15Mbps Unlimited', phone: '03001112233' }
  ]));
  const res = importPrivateRoster(blankState(), entries, { referenceDate: REF_DATE });
  const customer = res.nextState.customers[0];
  assert.equal(customer.isFreeConnection, true);
  assert.equal(customer.phone, '+923001112233');
  assert.equal(customer.packageSpeed, '');
  assert.equal(customer.monthlySellingAmount, null);
  assert.deepEqual(customer.bills, []);
});

test('free: grid save completes the mobile but NEVER assigns a billable package', () => {
  const imported = importPrivateRoster(blankState(), [
    { name: 'Test Grid Free', mohalla: 'THALII', free: true, phone: '', package: null }
  ], { referenceDate: REF_DATE });
  const free = imported.nextState.customers[0];
  assert.equal(isIncompleteCustomer(free), true, 'free with no mobile is grid work');
  const res = applyBulkSetup(imported.nextState, [
    { customerId: free.id, packageId: '15mbps-unlimited', phone: '03009998877' }
  ], { referenceDate: REF_DATE });
  assert.deepEqual(res.failed, []);
  assert.equal(res.updated.length, 1);
  assert.equal(res.updated[0].freePackageSkipped, true);
  assert.deepEqual(res.updated[0].applied, ['phone']);
  const after = res.nextState.customers[0];
  assert.equal(after.isFreeConnection, true);
  assert.equal(after.phone, '+923009998877');
  assert.equal(after.packageSpeed, '');
  assert.equal(after.monthlySellingAmount, null);
  assert.deepEqual(after.bills, []);
  assert.equal(isIncompleteCustomer(after), false, 'free + mobile = complete; drops out of the grid');
});

// ---------- Incomplete filtering + Mohalla filter ----------

function fixtureState() {
  let state = blankState();
  const add = (name, opts) => { state = addCustomer(state, name, REF_DATE, opts); return state.customers.at(-1); };
  const complete = add('Test Complete', { mohalla: 'BARRIAN', phone: '03001110001' });
  state = applyBulkSetup(state, [{ customerId: complete.id, packageId: '5mbps-150gb', phone: '' }], { referenceDate: REF_DATE }).nextState;
  const noPhone = add('Test No Phone', { mohalla: 'BARRIAN' });
  const noPackage = add('Test No Package', { mohalla: 'Mohalla Bani', phone: '03001110002' });
  const noPackage2 = add('Test No Package Two', { mohalla: 'BANII', phone: '03001110003' });
  const freeDone = add('Test Free Done', { mohalla: 'THALII', phone: '03001110004', isFreeConnection: true });
  const archived = add('Test Archived', { mohalla: 'BARRIAN' });
  state = { ...state, customers: state.customers.map(c => c.id === archived.id ? { ...c, archived: true } : c) };
  return { state, complete, noPhone, noPackage, noPackage2, freeDone, archived };
}

test('incomplete: !package || !phone in real record fields; archived and complete excluded', () => {
  const { state, complete, noPhone, noPackage, freeDone, archived } = fixtureState();
  assert.equal(customerHasPackage(state.customers.find(c => c.id === complete.id)), true);
  assert.equal(isIncompleteCustomer(state.customers.find(c => c.id === complete.id)), false);
  assert.equal(isIncompleteCustomer(state.customers.find(c => c.id === noPhone.id)), true);
  assert.equal(isIncompleteCustomer(state.customers.find(c => c.id === noPackage.id)), true);
  assert.equal(isIncompleteCustomer(state.customers.find(c => c.id === freeDone.id)), false, 'free with a mobile is complete — package is N/A');
  assert.equal(isIncompleteCustomer(state.customers.find(c => c.id === archived.id)), false);
  const rows = incompleteCustomers(state.customers);
  assert.deepEqual(rows.map(c => c.name), ['Test No Phone', 'Test No Package', 'Test No Package Two']);
});

test('incomplete: Mohalla filter is canonical — "Mohalla Bani" and "BANII" are one group', () => {
  const { state } = fixtureState();
  const groups = incompleteMohallaGroups(state.customers);
  const banii = groups.find(g => g.key === 'banii');
  assert.ok(banii, 'canonical BANII group exists');
  assert.equal(banii.count, 2);
  const filtered = incompleteCustomers(state.customers, { mohalla: 'banii' });
  assert.deepEqual(filtered.map(c => c.name), ['Test No Package', 'Test No Package Two']);
  const barrian = incompleteCustomers(state.customers, { mohalla: 'barrian' });
  assert.deepEqual(barrian.map(c => c.name), ['Test No Phone']);
});

// ---------- Bulk save through the real seams ----------

test('bulk save: package + mobile land via updateCustomerProfile/applyCustomerPlan and the row drops out', () => {
  const { state, noPhone } = fixtureState();
  const res = applyBulkSetup(state, [
    { customerId: noPhone.id, packageId: '15mbps-unlimited', phone: '03001112233' }
  ], { referenceDate: REF_DATE });
  assert.deepEqual(res.failed, []);
  assert.deepEqual(res.updated[0].applied, ['phone', 'package']);
  const after = res.nextState.customers.find(c => c.id === noPhone.id);
  assert.equal(after.phone, '+923001112233');
  assert.equal(after.packageSpeed, '15Mbps Unlimited');
  assert.equal(after.monthlySellingAmount, 3000);
  assert.equal(after.packageHistory.length, 1, 'package history proves the updateCustomerProfile seam');
  assert.ok(after.bills.some(bill => bill.month === '2026-10'), 'bill proves the applyCustomerPlan seam');
  assert.ok(!incompleteCustomers(res.nextState.customers).some(c => c.id === noPhone.id), 'completed row drops out of the grid');
});

test('bulk save: phone-only edit works; a format-only phone difference is not a change', () => {
  const { state, noPackage } = fixtureState();
  const res = applyBulkSetup(state, [
    { customerId: noPackage.id, packageId: '', phone: '+923001110002' }
  ], { referenceDate: REF_DATE });
  assert.deepEqual(res.failed, []);
  assert.equal(res.unchanged.length, 1, 'same number in +92 form vs stored 03 form = unchanged');
  const res2 = applyBulkSetup(state, [
    { customerId: noPackage.id, packageId: '', phone: '03215556677' }
  ], { referenceDate: REF_DATE });
  assert.deepEqual(res2.updated[0].applied, ['phone']);
  assert.equal(res2.nextState.customers.find(c => c.id === noPackage.id).phone, '+923215556677');
});

test('bulk save: invalid phone and unknown package are reported failed, records untouched', () => {
  const { state, noPhone, noPackage } = fixtureState();
  const res = applyBulkSetup(state, [
    { customerId: noPhone.id, packageId: '', phone: '12345' },
    { customerId: noPackage.id, packageId: 'no-such-package', phone: '' }
  ], { referenceDate: REF_DATE });
  assert.equal(res.failed.length, 2);
  assert.match(res.failed[0].error, /Invalid phone/);
  assert.match(res.failed[1].error, /Unknown package/);
  assert.equal(res.nextState.customers.find(c => c.id === noPhone.id).phone, '');
  assert.equal(res.nextState.customers.find(c => c.id === noPackage.id).packageSpeed, '');
});

test('bulk save: an archived customer edit is refused and reported', () => {
  const { state, archived } = fixtureState();
  const res = applyBulkSetup(state, [
    { customerId: archived.id, packageId: '5mbps-150gb', phone: '03001112233' }
  ], { referenceDate: REF_DATE });
  assert.equal(res.failed.length, 1);
  assert.match(res.failed[0].error, /archived/);
});

// ---------- i18n audit (every bog_ key the phase uses, en + ur) ----------

test('i18n: every bog_ key used by the module and the index.html markup exists in en and ur with matching placeholders', () => {
  const moduleSource = readFileSync(new URL('../bulk-onboarding-grid.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of moduleSource.matchAll(/t\('([a-z0-9_]+)'/g)) if (match[1].startsWith('bog_')) used.add(match[1]);
  for (const match of moduleSource.matchAll(/'(bog_[a-z0-9_]+)'/g)) used.add(match[1]);
  for (const match of html.matchAll(/data-i18n(?:-[a-z-]+)?="(bog_[a-z0-9_]+)"/g)) used.add(match[1]);
  assert.ok(used.size >= 15, `expected the phase's bog_ keys, got ${used.size}`);
  const placeholders = text => [...String(text).matchAll(/\{([a-zA-Z]+)\}/g)].map(m => m[1]).sort();
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder parity ${key}`);
  }
  const enKeys = Object.keys(TRANSLATIONS.en).filter(k => k.startsWith('bog_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter(k => k.startsWith('bog_')).sort();
  assert.deepEqual(urKeys, enKeys, 'bog_ key sets identical in en and ur');
});
