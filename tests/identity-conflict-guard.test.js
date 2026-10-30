import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createInitialState,
  addCustomer,
  updateCustomerProfile,
  archiveCustomer,
  searchCustomers,
  findIdentityConflicts,
  normalizeIdentityValue,
  identitySearchMatches
} from '../core.js';
import { searchFastCustomers } from '../nav-customer-search.js';
import { TRANSLATIONS, t } from '../nav-language.js';

// SISP-74: IP / MAC / PPPoE username / router serial conflict guard +
// global search extension. Severity per field risk: PPPoE username and
// static IP hard-block (they feed the MikroTik export — duplicates break
// the router config), MAC and serial only warn (operator confirms in the
// profile save flow). Only OTHER active (non-archived) customers count,
// a record never conflicts with itself, blank values never conflict, and
// a value the record already had is not a new assignment.

const today = new Date('2026-10-29T12:00:00+05:00');
const here = path.dirname(fileURLToPath(import.meta.url));
const readRepoFile = (name) => readFileSync(path.join(here, '..', name), 'utf8');

function pairState() {
  return createInitialState(['Customer A', 'Customer B']);
}
const A = 'seed-001';
const B = 'seed-002';

test('spec pin: assigning staticIp 10.10.1.55 to Customer B when active Customer A holds it throws, naming Customer A', () => {
  let state = pairState();
  state = updateCustomerProfile(state, A, { staticIp: '10.10.1.55' }, today);
  assert.throws(
    () => updateCustomerProfile(state, B, { staticIp: '10.10.1.55' }, today),
    (error) => {
      assert.match(error.message, /10\.10\.1\.55/);
      assert.match(error.message, /Customer A/);
      assert.match(error.message, /#1/);
      return true;
    }
  );
  // The failed save changed nothing: B still has no static IP.
  assert.equal(state.customers.find(c => c.id === B).staticIp ?? '', '');
});

test('PPPoE username duplicates hard-block too, case-insensitively, naming the holder', () => {
  let state = pairState();
  state = updateCustomerProfile(state, A, { pppoeUsername: 'ali.pppoe' }, today);
  assert.throws(
    () => updateCustomerProfile(state, B, { pppoeUsername: 'ALI.PPPOE' }, today),
    /already assigned to Customer A \(#1\)/
  );
});

test('addCustomer hard-blocks a duplicate static IP / PPPoE username at creation, naming the holder', () => {
  let state = pairState();
  state = updateCustomerProfile(state, A, { staticIp: '10.10.1.55', pppoeUsername: 'ali.pppoe' }, today);
  assert.throws(() => addCustomer(state, 'Customer C', today, { staticIp: '10.10.1.55' }), /Customer A/);
  assert.throws(() => addCustomer(state, 'Customer C', today, { pppoeUsername: 'ali.pppoe' }), /Customer A/);
  const grown = addCustomer(state, 'Customer C', today, { staticIp: '10.10.1.56', pppoeUsername: 'c.pppoe' });
  assert.equal(grown.customers.length, 3);
});

test('MAC duplicates are warnings, not blocks: finder names the holder across separator/case styles, core save still succeeds', () => {
  let state = pairState();
  state = updateCustomerProfile(state, A, { macAddress: 'AA:BB:CC:DD:EE:FF' }, today);
  const conflicts = findIdentityConflicts(state.customers, { macAddress: 'aabb.ccdd.eeff' }, { excludeCustomerId: B, previous: state.customers.find(c => c.id === B) });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].field, 'macAddress');
  assert.equal(conflicts[0].severity, 'warn');
  assert.equal(conflicts[0].customerName, 'Customer A');
  assert.equal(conflicts[0].customerNumber, 1);
  // The save itself is allowed — the operator decides via the confirm.
  const saved = updateCustomerProfile(state, B, { macAddress: 'aabb.ccdd.eeff' }, today);
  assert.equal(saved.customers.find(c => c.id === B).macAddress, 'aabb.ccdd.eeff');
});

test('serial duplicates are warnings: separators and case do not hide a duplicate device', () => {
  let state = pairState();
  state = updateCustomerProfile(state, A, { serialNumber: 'ZTE-9876-XY' }, today);
  const conflicts = findIdentityConflicts(state.customers, { serialNumber: 'zte 9876 xy' }, { excludeCustomerId: B });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].field, 'serialNumber');
  assert.equal(conflicts[0].severity, 'warn');
  assert.equal(conflicts[0].customerName, 'Customer A');
  const saved = updateCustomerProfile(state, B, { serialNumber: 'zte 9876 xy' }, today);
  assert.equal(saved.customers.find(c => c.id === B).serialNumber, 'zte 9876 xy');
});

test('a customer never conflicts with itself, and re-saving its own identifiers is not a new assignment', () => {
  let state = pairState();
  state = updateCustomerProfile(state, A, { staticIp: '10.10.1.55', pppoeUsername: 'ali.pppoe', macAddress: 'AA:BB:CC:DD:EE:FF' }, today);
  const holder = state.customers.find(c => c.id === A);
  assert.deepEqual(findIdentityConflicts(state.customers, holder, { excludeCustomerId: A, previous: holder }), []);
  // An unrelated edit on the holder's own profile saves cleanly.
  const saved = updateCustomerProfile(state, A, { phone: '0300 1112233' }, today);
  assert.equal(saved.customers.find(c => c.id === A).phone, '0300 1112233');
  assert.equal(saved.customers.find(c => c.id === A).staticIp, '10.10.1.55');
});

test('legacy duplicates created before the guard never freeze unrelated edits, but a fresh conflicting assignment still blocks', () => {
  let state = pairState();
  // Force the duplicate directly into the records (pre-guard data).
  state = {
    ...state,
    customers: state.customers.map(c => ({ ...c, staticIp: '10.10.1.55', pppoeUsername: 'shared.pppoe' }))
  };
  const edited = updateCustomerProfile(state, B, { phone: '0300 9998877' }, today);
  assert.equal(edited.customers.find(c => c.id === B).phone, '0300 9998877');
  // B newly taking a value only A holds still blocks (it is a fresh
  // assignment for B even though B's own legacy duplicates are tolerated).
  state = { ...state, customers: state.customers.map(c => c.id === A ? { ...c, pppoeUsername: 'a.only' } : c) };
  assert.throws(() => updateCustomerProfile(state, B, { staticIp: '10.10.1.99', pppoeUsername: 'a.only' }, today), /Customer A/);
});

test('archived customers free their identifiers: no block, no warning', () => {
  let state = pairState();
  state = updateCustomerProfile(state, A, { staticIp: '10.10.1.55', macAddress: 'AA:BB:CC:DD:EE:FF' }, today);
  state = archiveCustomer(state, A, today);
  assert.deepEqual(findIdentityConflicts(state.customers, { staticIp: '10.10.1.55', macAddress: 'AA:BB:CC:DD:EE:FF' }, { excludeCustomerId: B }), []);
  const saved = updateCustomerProfile(state, B, { staticIp: '10.10.1.55' }, today);
  assert.equal(saved.customers.find(c => c.id === B).staticIp, '10.10.1.55');
});

test('blank identifiers never conflict', () => {
  const state = pairState();
  assert.deepEqual(findIdentityConflicts(state.customers, { pppoeUsername: '', staticIp: '  ', macAddress: '', serialNumber: '' }, { excludeCustomerId: B }), []);
  assert.deepEqual(findIdentityConflicts(state.customers, {}, { excludeCustomerId: B }), []);
});

test('normalizeIdentityValue: house normalization per field', () => {
  assert.equal(normalizeIdentityValue('pppoeUsername', '  Ali.PPPoE '), 'ali.pppoe');
  assert.equal(normalizeIdentityValue('staticIp', ' 10.10.1.55 '), '10.10.1.55');
  assert.equal(normalizeIdentityValue('macAddress', 'aa-bb-cc-dd-ee-ff'), 'AABBCCDDEEFF');
  assert.equal(normalizeIdentityValue('macAddress', 'AA:BB:CC:DD:EE:FF'), 'AABBCCDDEEFF');
  assert.equal(normalizeIdentityValue('serialNumber', 'zte-9876 xy'), 'ZTE9876XY');
  assert.equal(normalizeIdentityValue('macAddress', ''), '');
  assert.equal(normalizeIdentityValue('staticIp', null), '');
});

function identifiedState() {
  let state = pairState();
  state = updateCustomerProfile(state, A, {
    pppoeUsername: 'ali.pppoe',
    staticIp: '10.10.1.55',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    serialNumber: 'ZTE-9876-XY'
  }, today);
  return state;
}

test('global search (core) matches IP, PPPoE username, MAC and serial — exact and partial', () => {
  const state = identifiedState();
  const ids = (query) => searchCustomers(state, query).map(c => c.id);
  assert.deepEqual(ids('10.10.1.55'), [A]);
  assert.deepEqual(ids('10.10.1'), [A]);
  assert.deepEqual(ids('ali.pppoe'), [A]);
  assert.deepEqual(ids('ALI.PP'), [A]);
  assert.deepEqual(ids('AA:BB:CC'), [A]);
  assert.deepEqual(ids('9876'), [A]);
  assert.deepEqual(ids('10.10.9.99'), []);
});

test('global search finds a MAC typed without separators', () => {
  const state = identifiedState();
  assert.deepEqual(searchCustomers(state, 'aabbcc').map(c => c.id), [A]);
  assert.deepEqual(searchCustomers(state, 'aabbccddeeff').map(c => c.id), [A]);
  assert.equal(identitySearchMatches(state.customers[0], 'aabbcc'), true);
  assert.equal(identitySearchMatches(state.customers[1], 'aabbcc'), false);
});

test('fast global search sheet matches the identity fields too', () => {
  const state = identifiedState();
  const byIp = searchFastCustomers(state, { query: '10.10.1.55' }, today);
  assert.deepEqual(byIp.map(r => r.id), [A]);
  const bySerial = searchFastCustomers(state, { query: 'zte-9876' }, today);
  assert.deepEqual(bySerial.map(r => r.id), [A]);
  const byMacHex = searchFastCustomers(state, { query: 'aabbccdd' }, today);
  assert.deepEqual(byMacHex.map(r => r.id), [A]);
  const byUsername = searchFastCustomers(state, { query: 'ali.pppoe' }, today);
  assert.deepEqual(byUsername.map(r => r.id), [A]);
});

test('i18n: every idguard_* key exists in both dictionaries and interpolates', () => {
  const keys = Object.keys(TRANSLATIONS.en).filter(key => key.startsWith('idguard_'));
  assert.ok(keys.length >= 4, `expected idguard_* keys, got ${keys.length}`);
  for (const key of keys) {
    assert.ok(Object.hasOwn(TRANSLATIONS.ur, key), `ur missing ${key}`);
    assert.notEqual(t(key, 'en'), key);
    assert.notEqual(t(key, 'ur'), key);
  }
  const message = t('idguard_warn_message', 'en', { label: 'MAC address', value: 'AA:BB' });
  assert.match(message, /MAC address/);
  assert.match(message, /AA:BB/);
  assert.doesNotMatch(message, /\{label\}|\{value\}/);
});

test('wiring: profile save warns via findIdentityConflicts + appConfirm before updateCustomerProfile; dark-mode tokens untouched', () => {
  const app = readRepoFile('app.js');
  assert.match(app, /findIdentityConflicts\(state\.customers, \{/);
  assert.match(app, /idguard_warn_title/);
  assert.match(app, /severity === 'warn'/);
  const core = readRepoFile('core.js');
  assert.match(core, /assertNoBlockingIdentityConflicts\(state\.customers, fields, \{ excludeCustomerId: customerId, previous: current \}\)/);
  assert.match(core, /assertNoBlockingIdentityConflicts\(state\.customers, \{ pppoeUsername, staticIp, macAddress, serialNumber \}\)/);
});
