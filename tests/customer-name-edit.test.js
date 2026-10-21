// Customer rename: updateCustomerProfile accepts an explicit name
// (profile header Edit name editor + profile form name field).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, updateCustomerProfile, searchCustomers } from '../core.js';

const referenceDate = new Date(2026, 9, 21, 12);

test('rename: name changes, everything else is untouched', () => {
  const state = createInitialState();
  const aliShah = state.customers.find(c => c.name === 'ALI SHAH');
  assert.ok(aliShah, 'seed has ALI SHAH (the user example)');
  const next = updateCustomerProfile(state, aliShah.id, { name: 'ALI MNA' }, referenceDate);
  const renamed = next.customers.find(c => c.id === aliShah.id);
  assert.equal(renamed.name, 'ALI MNA');
  assert.equal(renamed.customerNumber, aliShah.customerNumber);
  assert.deepEqual(renamed.bills, aliShah.bills);
  // The old state is not mutated.
  assert.equal(state.customers.find(c => c.id === aliShah.id).name, 'ALI SHAH');
  // Search finds the customer by the new name.
  const found = searchCustomers(next, 'ALI MNA');
  assert.ok(found.some(c => c.id === aliShah.id));
});

test('rename: trims surrounding whitespace', () => {
  const state = createInitialState();
  const first = state.customers[0];
  const next = updateCustomerProfile(state, first.id, { name: '  NAZEER AHMAD  ' }, referenceDate);
  assert.equal(next.customers[0].name, 'NAZEER AHMAD');
});

test('rename: empty or over-long names are rejected, profile updates without name keep the old one', () => {
  const state = createInitialState();
  const first = state.customers[0];
  assert.throws(() => updateCustomerProfile(state, first.id, { name: '   ' }, referenceDate), /cannot be empty/);
  assert.throws(() => updateCustomerProfile(state, first.id, { name: 'x'.repeat(101) }, referenceDate), /100 characters or fewer/);
  const next = updateCustomerProfile(state, first.id, { mohalla: 'MOHALLA PULL' }, referenceDate);
  assert.equal(next.customers[0].name, first.name);
  assert.equal(next.customers[0].mohalla, 'MOHALLA PULL');
});
