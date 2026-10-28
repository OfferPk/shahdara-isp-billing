import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalMohalla, DEFAULT_MOHALLAS, buildPhase3Analytics } from '../phase3.js';
import { createInitialState, addCustomer, updateCustomerProfile } from '../core.js';
import { filterCustomersByArea } from '../form-validation.js';
import { resolveCustomerLocation } from '../dashboard-area-collections.js';

// Mohalla de-duplication: the same mohalla used to appear twice in Area
// cards ("Bani" and "Banii" as separate areas) because names were free-typed
// on the new-customer form and the old suggestion list itself carried variant
// spellings ("MOHALAA BANI", single-i "KISHTI"). One mohalla must now be one
// area everywhere: the owner's 15 default names are the standard, the leading
// generic "Mohalla" word is not part of a mohalla's identity, and only
// evidenced spelling variants fold into a default.

test('owner default mohallas are the standard list', () => {
  assert.equal(DEFAULT_MOHALLAS.length, 15);
  for (const name of ['CHARYAA', 'GANGALL', 'KISHTII', 'BARRIAN', 'THALII', 'CHAMYAAA', 'PALALIYAA', 'MALLA', 'NAKAR', 'BANII', 'SODAA', 'PULL SIDE', 'JABBIYAA', 'MOHALLA CHUDRIYAA', 'MOHALLA end side farm house']) assert.ok(DEFAULT_MOHALLAS.includes(name), `${name} is a default mohalla`);
});

test('spelling variants fold into the same canonical mohalla', () => {
  for (const variant of ['Bani', 'BANII', 'MOHALAA BANI', 'MOHALLA BANI', '  banii  ']) {
    const canon = canonicalMohalla(variant);
    assert.equal(canon.key, 'banii', `${variant} keys as banii`);
    assert.equal(canon.label, 'Banii', `${variant} labels as Banii`);
    assert.equal(canon.stored, 'BANII', `${variant} stores as BANII`);
  }
  assert.equal(canonicalMohalla('Kishti').stored, 'KISHTII');
  assert.equal(canonicalMohalla('MOHALLA KISHTI').stored, 'KISHTII');
  assert.equal(canonicalMohalla('Chamyaa').stored, 'CHAMYAAA');
  assert.equal(canonicalMohalla('MOHALLA CHAMYAA').stored, 'CHAMYAAA');
});

test('case, prefix and spacing differences do not split a mohalla', () => {
  assert.equal(canonicalMohalla('BARRIAN').key, canonicalMohalla('Barrian').key);
  assert.equal(canonicalMohalla('MOHALLA CHUDRIYAA').key, canonicalMohalla('Chudriyaa').key);
  assert.equal(canonicalMohalla('MOHALLA CHUDRIYAA').label, 'Mohalla Chudriyaa');
  assert.equal(canonicalMohalla('MOHALLA end side farm house').key, 'end side farm house');
  assert.equal(canonicalMohalla('MOHALLA end side farm house').label, 'Mohalla End Side Farm House');
});

test('unknown mohallas keep their own key and their stored spelling', () => {
  assert.deepEqual(canonicalMohalla('Haveli'), { key: 'haveli', label: 'Haveli', stored: 'Haveli' });
  assert.deepEqual(canonicalMohalla('MOHALLA HAVELI'), { key: 'haveli', label: 'Haveli', stored: 'MOHALLA HAVELI' });
  assert.equal(canonicalMohalla(''), null);
  assert.equal(canonicalMohalla(null), null);
});

test('saving a customer stores the standard spelling for variants', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Variant Saver', new Date(), { mohalla: 'bani' });
  assert.equal(state.customers.at(-1).mohalla, 'BANII');
  state = addCustomer(state, 'Custom Saver', new Date(), { mohalla: 'Haveli' });
  assert.equal(state.customers.at(-1).mohalla, 'Haveli');
  let edited = createInitialState(['Ali']);
  edited = updateCustomerProfile(edited, 'seed-001', { mohalla: 'MOHALLA KISHTI' });
  assert.equal(edited.customers.find(c => c.id === 'seed-001').mohalla, 'KISHTII');
});

test('old variant spellings group into one area row in analytics', () => {
  let state = createInitialState(['A', 'B', 'C']);
  const spellings = { 'seed-001': 'Bani', 'seed-002': 'BANII', 'seed-003': 'MOHALAA BANI' };
  state = { ...state, customers: state.customers.map(customer => spellings[customer.id] ? { ...customer, mohalla: spellings[customer.id] } : customer) };
  const rows = buildPhase3Analytics(state, new Date()).areaRows;
  const banii = rows.filter(row => row.level === 'area');
  assert.equal(banii.length, 1, 'one area row, not three');
  assert.equal(banii[0].area, 'Area: Banii');
  assert.equal(banii[0].customerCount, 3);
});

test('roster filtering by a mohalla finds every spelling variant', () => {
  const customers = [
    { mohalla: 'Bani' }, { mohalla: 'BANII' }, { mohalla: 'MOHALLA BANI' }, { mohalla: 'Kishtii' },
  ];
  assert.equal(filterCustomersByArea(customers, 'Banii').length, 3);
  assert.equal(filterCustomersByArea(customers, 'MOHALLA BANI').length, 3);
  assert.equal(filterCustomersByArea(customers, 'Kishtii').length, 1);
  assert.equal(filterCustomersByArea(customers, 'all').length, 4);
});

test('collections location resolves variants to the same area', () => {
  const loc = resolveCustomerLocation({ mohalla: 'Bani', zone: 'North' });
  assert.equal(loc.area.key, 'banii');
  assert.equal(loc.area.label, 'Banii');
});
