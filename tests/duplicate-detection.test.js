import test from 'node:test';
import assert from 'node:assert/strict';
import { findPossibleDuplicateCustomers } from '../duplicate-detection.js';
import { addCustomer, createInitialState } from '../core.js';

const saved = (overrides = {}) => ({
  id: 'fixture-1', customerNumber: 101, name: 'Fixture Customer', phone: '', address: '',
  mohalla: '', zone: '', archived: false, bills: [], ...overrides
});

test('phone formatting and Urdu/Arabic numerals normalize to the same digits without guessing prefixes', () => {
  const result = findPossibleDuplicateCustomers([
    saved({ phone: '+92 (300) 123-4567' }),
    saved({ id: 'fixture-2', customerNumber: 102, phone: '03001234568' })
  ], { name: 'Different Person', phone: ' +92-300-1234567 ' });
  assert.equal(result.length, 1);
  assert.equal(result[0].customer.id, 'fixture-1');
  assert.ok(result[0].reasons.some(reason => reason.field === 'phone' && reason.type === 'exact'));
  assert.equal(findPossibleDuplicateCustomers([saved({ phone: '03001234567' })], { name: 'Other', phone: '+92 300 1234567' }).length, 0,
    'the matcher does not infer a country-code/local-number equivalence');
  assert.equal(findPossibleDuplicateCustomers([saved({ phone: '+92 300 1234567' })], { name: 'Other', phone: '+۹۲ (۳۰۰) ۱۲۳-۴۵۶۷' }).length, 1);
});

test('name normalization finds case, punctuation, and spacing variants', () => {
  const result = findPossibleDuplicateCustomers([saved({ name: 'M. Ali-Khan' })], { name: '  m ali khan ' });
  assert.equal(result.length, 1);
  assert.ok(result[0].reasons.some(reason => reason.field === 'name' && reason.type === 'exact'));
});

test('address normalization finds punctuation and case variants and labels a shared address as advisory', () => {
  const result = findPossibleDuplicateCustomers([saved({ name: 'Someone Else', address: 'House 12, Main Road.' })], {
    name: 'Fixture New Customer', address: ' house 12 main road '
  });
  assert.equal(result.length, 1);
  assert.ok(result[0].reasons.some(reason => reason.field === 'address' && reason.type === 'exact'));
  assert.match(result[0].reasons.find(reason => reason.field === 'address').label, /separate customers/);
});

test('partial names and addresses are advisory; matching area alone is not enough', () => {
  const partialName = findPossibleDuplicateCustomers([saved({ name: 'Nazeer Ahmed' })], { name: 'Nazeer' });
  assert.equal(partialName.length, 1);
  assert.equal(partialName[0].reasons[0].type, 'partial');
  const partialAddress = findPossibleDuplicateCustomers([saved({ name: 'Old Name', address: 'Flat 8, Shahdara Market, Lahore' })], {
    name: 'New Name', address: 'Shahdara Market'
  });
  assert.equal(partialAddress.length, 1);
  assert.ok(partialAddress[0].reasons.some(reason => reason.field === 'address' && reason.type === 'partial'));
  assert.equal(findPossibleDuplicateCustomers([saved({ name: 'Other Name', mohalla: 'North' })], {
    name: 'New Person', mohalla: ' north '
  }).length, 0);
});

test('empty optional identifiers do not match, and phone partials are not treated as duplicates', () => {
  assert.deepEqual(findPossibleDuplicateCustomers([
    saved({ phone: '', address: '', name: '' }), saved({ phone: '03001234567', name: 'Unrelated' })
  ], { name: 'Unique Name', phone: '', address: '' }), []);
  assert.deepEqual(findPossibleDuplicateCustomers([saved({ phone: '+92 300 1234567' })], {
    name: 'Different Person', phone: '3001234567'
  }), []);
});

test('archived records and legacy contact aliases are checked without mutating saved records', () => {
  const archived = Object.freeze(saved({ id: 'archived-fixture', archived: true, customerPhone: '0300-555-0101', customerAddress: 'Unit 4, Fixture Street' }));
  const customers = Object.freeze([archived]);
  const result = findPossibleDuplicateCustomers(customers, { name: 'Different', phone: '03005550101', address: 'different address' });
  assert.equal(result.length, 1);
  assert.equal(result[0].customer, archived);
  assert.equal(archived.archived, true);
  assert.equal(archived.customerPhone, '0300-555-0101');
});

test('owner can add a same-name customer only with an explicit duplicate override', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Fixture Customer', new Date('2026-10-07T12:00:00+05:00'), {
    phone: '+92 300 555 0100', address: 'Original Fixture Road'
  });
  const original = state.customers[0];
  assert.throws(() => addCustomer(state, original.name), /already in the list/);
  const next = addCustomer(state, original.name, new Date('2026-10-07T12:00:00+05:00'), {
    allowDuplicateName: true, phone: '+92 300 555 0199', address: 'Synthetic Fixture Road', mohalla: 'Fixture Area'
  });
  assert.equal(next.customers.length, 2);
  assert.equal(next.customers.at(-1).name, original.name);
  assert.notEqual(next.customers.at(-1).id, original.id);
  assert.equal(next.customers.at(-1).phone, '+92 300 555 0199');
  assert.equal(next.customers.at(-1).address, 'Synthetic Fixture Road');
  assert.equal(next.customers.at(-1).mohalla, 'Fixture Area');
  assert.equal(state.customers.length, 1, 'the prior immutable state is unchanged');
  assert.equal(original.address, 'Original Fixture Road', 'the matched record is not overwritten');
});
