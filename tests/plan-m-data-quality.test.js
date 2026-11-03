import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  createInitialState,
  updateCustomerProfile,
  addCustomer,
  normalizePhoneKey,
  findPhoneConflicts
} from '../core.js';

// Plan M — Customer data quality: duplicate-phone warning (warn-only).
// A phone is never a block: family/shared phones are legitimate, so core
// never throws for a duplicate phone — the app save flows ask the
// operator with an explicit "Save anyway". What core guarantees is the
// normalised comparison itself: 03…, +92…, 0092… and bare national
// spellings of one Pakistani mobile are the same number, archived
// holders never warn, blank phones never warn, and a value the record
// already had is not a new assignment.

const today = new Date('2026-10-29T12:00:00+05:00');
const here = path.dirname(fileURLToPath(import.meta.url));
const readRepoFile = (name) => readFileSync(path.join(here, '..', name), 'utf8');
const A = 'seed-001';
const B = 'seed-002';

function pairState() {
  return createInitialState(['Customer A', 'Customer B']);
}

function phoneState() {
  let state = pairState();
  state = updateCustomerProfile(state, A, { phone: '03001234567' }, today);
  return state;
}

// --- normalizePhoneKey: one number, many spellings -----------------------

test('normalizePhoneKey: 03… local form gives the 10 national digits', () => {
  assert.equal(normalizePhoneKey('03001234567'), '3001234567');
});

test('normalizePhoneKey: +92… international form gives the same key', () => {
  assert.equal(normalizePhoneKey('+923001234567'), '3001234567');
});

test('normalizePhoneKey: 0092… form gives the same key', () => {
  assert.equal(normalizePhoneKey('00923001234567'), '3001234567');
});

test('normalizePhoneKey: bare national digits give the same key', () => {
  assert.equal(normalizePhoneKey('3001234567'), '3001234567');
});

test('normalizePhoneKey: all four spellings of one number are equal', () => {
  const keys = new Set([
    normalizePhoneKey('03001234567'),
    normalizePhoneKey('+923001234567'),
    normalizePhoneKey('00923001234567'),
    normalizePhoneKey('3001234567')
  ]);
  assert.equal(keys.size, 1);
  assert.equal([...keys][0], '3001234567');
});

test('normalizePhoneKey: spaces, dashes, dots and parentheses are formatting only', () => {
  assert.equal(normalizePhoneKey('0300 1234567'), '3001234567');
  assert.equal(normalizePhoneKey('0300-1234567'), '3001234567');
  assert.equal(normalizePhoneKey('0300.1234567'), '3001234567');
  assert.equal(normalizePhoneKey('+92 (300) 123-4567'), '3001234567');
  assert.equal(normalizePhoneKey('0092 300 1234567'), '3001234567');
});

test('normalizePhoneKey: Arabic-Indic digits fold to the same key', () => {
  assert.equal(normalizePhoneKey('٠٣٠٠١٢٣٤٥٦٧'), '3001234567');
});

test('normalizePhoneKey: blank, null and undefined never warn', () => {
  assert.equal(normalizePhoneKey(''), '');
  assert.equal(normalizePhoneKey('   '), '');
  assert.equal(normalizePhoneKey(null), '');
  assert.equal(normalizePhoneKey(undefined), '');
});

test('normalizePhoneKey: junk and short numbers never warn', () => {
  assert.equal(normalizePhoneKey('0300'), '');
  assert.equal(normalizePhoneKey('123'), '');
  assert.equal(normalizePhoneKey('abc'), '');
  assert.equal(normalizePhoneKey('0300123456'), '');
});

test('normalizePhoneKey: a non-Pakistani shape never warns', () => {
  assert.equal(normalizePhoneKey('+442071234567'), '');
  assert.equal(normalizePhoneKey('442071234567'), '');
});

test('normalizePhoneKey: different numbers give different keys', () => {
  assert.notEqual(normalizePhoneKey('03001234567'), normalizePhoneKey('03007654321'));
  assert.notEqual(normalizePhoneKey('+923001234567'), normalizePhoneKey('+923007654321'));
});

test('normalizePhoneKey: a leading-zero national number is not a mobile key', () => {
  assert.equal(normalizePhoneKey('03001234567'), '3001234567');
  assert.equal(normalizePhoneKey('02134567890'), '');
});

// --- findPhoneConflicts: holder, archive, self, blank, unchanged --------

test('findPhoneConflicts: +92 candidate conflicts with the 03 holder, naming holder #number and name', () => {
  const state = phoneState();
  const conflicts = findPhoneConflicts(state.customers, '+923001234567', { excludeCustomerId: B });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].customerId, A);
  assert.equal(conflicts[0].customerNumber, 1);
  assert.equal(conflicts[0].customerName, 'Customer A');
  assert.equal(conflicts[0].field, 'phone');
  assert.equal(conflicts[0].severity, 'warn');
  assert.equal(conflicts[0].normalizedKey, '3001234567');
});

test('findPhoneConflicts: 0092 candidate conflicts with the same holder', () => {
  const state = phoneState();
  const conflicts = findPhoneConflicts(state.customers, '00923001234567', { excludeCustomerId: B });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].customerId, A);
});

test('findPhoneConflicts: no holder means no conflict', () => {
  const state = pairState();
  assert.deepEqual(findPhoneConflicts(state.customers, '03001234567'), []);
});

test('findPhoneConflicts: an archived holder never warns', () => {
  let state = phoneState();
  state = {
    ...state,
    customers: state.customers.map(customer => customer.id === A ? { ...customer, archived: true } : customer)
  };
  assert.deepEqual(findPhoneConflicts(state.customers, '+923001234567', { excludeCustomerId: B }), []);
});

test('findPhoneConflicts: an archived holder never warns even when an active holder also exists', () => {
  let state = phoneState();
  state = updateCustomerProfile(state, B, { phone: '03007654321' }, today);
  state = {
    ...state,
    customers: state.customers.map(customer => customer.id === A ? { ...customer, archived: true } : customer)
  };
  const conflicts = findPhoneConflicts(state.customers, '03007654321');
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].customerId, B);
});

test('findPhoneConflicts: a record never conflicts with itself', () => {
  const state = phoneState();
  assert.deepEqual(findPhoneConflicts(state.customers, '03001234567', { excludeCustomerId: A }), []);
});

test('findPhoneConflicts: blank candidates never warn', () => {
  const state = phoneState();
  assert.deepEqual(findPhoneConflicts(state.customers, ''), []);
  assert.deepEqual(findPhoneConflicts(state.customers, '   '), []);
  assert.deepEqual(findPhoneConflicts(state.customers, null), []);
});

test('findPhoneConflicts: an unchanged phone (previous record) never warns', () => {
  const state = phoneState();
  const current = state.customers.find(customer => customer.id === A);
  assert.deepEqual(findPhoneConflicts(state.customers, '+923001234567', { excludeCustomerId: A, previous: current }), []);
});

test('findPhoneConflicts: an unchanged phone given as a raw previous value never warns', () => {
  const state = phoneState();
  assert.deepEqual(findPhoneConflicts(state.customers, '+923001234567', { excludeCustomerId: A, previous: '03001234567' }), []);
});

test('findPhoneConflicts: a changed phone (previous differs) does warn', () => {
  const state = phoneState();
  const current = state.customers.find(customer => customer.id === B);
  const conflicts = findPhoneConflicts(state.customers, '+923001234567', { excludeCustomerId: B, previous: current });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].customerId, A);
});

test('findPhoneConflicts: every active holder is reported, not just the first', () => {
  let state = phoneState();
  state = updateCustomerProfile(state, B, { phone: '+923001234567' }, today);
  const conflicts = findPhoneConflicts(state.customers, '03001234567');
  assert.equal(conflicts.length, 2);
  assert.deepEqual(conflicts.map(conflict => conflict.customerId).sort(), [A, B]);
});

test('findPhoneConflicts: the legacy customerPhone alias counts as the holder phone', () => {
  const customers = [{ id: 'alias-1', customerNumber: 9, name: 'Alias Holder', phone: '', customerPhone: '03001112222', archived: false }];
  const conflicts = findPhoneConflicts(customers, '+923001112222');
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].customerName, 'Alias Holder');
});

test('findPhoneConflicts: non-array customer lists and junk candidates are safe', () => {
  assert.deepEqual(findPhoneConflicts(null, '03001234567'), []);
  assert.deepEqual(findPhoneConflicts(undefined, '03001234567'), []);
  assert.deepEqual(findPhoneConflicts([], '03001234567'), []);
});

test('findPhoneConflicts: the finder is pure — it changes no existing record', () => {
  const state = phoneState();
  const before = JSON.stringify(state.customers);
  findPhoneConflicts(state.customers, '+923001234567', { excludeCustomerId: B });
  assert.equal(JSON.stringify(state.customers), before);
});

// --- Core saves stay warn-only: no throw, no record rewritten -----------

test('core addCustomer never blocks on a duplicate phone (warn lives in the app flow)', () => {
  const state = phoneState();
  const grown = addCustomer(state, 'Customer C', today, { phone: '+923001234567' });
  assert.equal(grown.customers.length, 3);
  assert.equal(grown.customers.at(-1).phone, '+923001234567');
  assert.equal(grown.customers.find(customer => customer.id === A).phone, '03001234567');
});

test('core updateCustomerProfile never blocks when assigning another active customer phone', () => {
  const state = phoneState();
  const updated = updateCustomerProfile(state, B, { phone: '00923001234567' }, today);
  assert.equal(updated.customers.find(customer => customer.id === B).phone, '00923001234567');
});

test('core updateCustomerProfile on an unrelated field never rewrites a legacy duplicate phone', () => {
  let state = phoneState();
  state = updateCustomerProfile(state, B, { phone: '03001234567' }, today);
  const updated = updateCustomerProfile(state, B, { mohalla: 'New Mohalla' }, today);
  assert.equal(updated.customers.find(customer => customer.id === B).phone, '03001234567');
  assert.equal(updated.customers.find(customer => customer.id === B).mohalla, 'New Mohalla');
});

// --- App wiring pins (app.js cannot run under node --test: DOM) ---------

test('app wiring: app.js imports findPhoneConflicts from core', () => {
  const app = readRepoFile('app.js');
  assert.match(app, /findPhoneConflicts,\s*paymentSenderLabel/);
  assert.match(app, /from '\.\/core\.js\?v=1\.11\.0'/);
});

test('app wiring: add flow folds cross-format phone conflicts into the duplicate review', () => {
  const app = readRepoFile('app.js');
  assert.match(app, /findPhoneConflicts\(state\.customers, details\.phone\)/);
  assert.match(app, /Phone number matches another customer after normalising the country code/);
  assert.match(app, /matches\.push\(\{ customer: holder, reasons: \[reason\] \}\)/);
});

test('app wiring: profile save flow asks "Save anyway?" naming the phone holder', () => {
  const app = readRepoFile('app.js');
  assert.match(app, /Possible duplicate phone number/);
  assert.match(app, /This phone number matches that existing customer after normalising the country code\. Save anyway\?/);
  assert.match(app, /findPhoneConflicts\(state\.customers, phoneVal, \{ excludeCustomerId: current\.id, previous: current \}\)/);
});

test('app wiring: profile phone warning skips holders the exact check already named', () => {
  const app = readRepoFile('app.js');
  assert.match(app, /!exactDuplicates\.some\(dup => dup\.customer\.id === conflict\.customerId\)/);
});

test('scope pin: import duplicate-phone rules and identity block rules are untouched by Plan M', () => {
  const importer = readRepoFile('bulk-customer-import.js');
  assert.match(importer, /duplicate-phone/);
  const core = readRepoFile('core.js');
  assert.match(core, /assertNoBlockingIdentityConflicts\(state\.customers, \{ pppoeUsername, staticIp, macAddress, serialNumber \}\)/);
});
