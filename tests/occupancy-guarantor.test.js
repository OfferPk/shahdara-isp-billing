// SISP-143: Tenant vs. Homeowner Tag & Guarantor/Deposit Guard.
// Pins: the occupancy sanitizers (enum coerces to absent, never throws),
// the addCustomer / updateCustomerProfile / readState / backup choke
// points, the tenant deposit-risk truth table, guarantor search through
// BOTH search seams (core searchCustomers + the roster field filter),
// and the en+ur i18n audit for every occ_* key the phase adds.
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addCustomer, createInitialState, createJsonBackup, persistState,
  previewJsonBackupMerge, readState, searchCustomers, updateCustomerProfile
} from '../core.js';
import {
  RESIDENCE_TYPES, normalizeOccupancyFields, sanitizeLandlordOrGuarantorName,
  sanitizeLandlordPhone, sanitizeResidenceType, tenantDepositRisk,
  holdsIspOwnedHardware, hasOccupancyRecord
} from '../occupancy-guarantor.js';
import { customerMatchesSearchField } from '../customer-search-filter.js';
import { occupancyPresentation } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-29T12:00:00+05:00');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

function stateWithTenant() {
  let state = createInitialState();
  state = addCustomer(state, 'Synthetic Tenant', REF, {
    phone: '0300-5551234',
    residenceType: 'tenant',
    landlordOrGuarantorName: 'Synthetic Landlord',
    landlordPhone: '0321-7778899',
    routerOwnership: 'isp-owned',
    securityDeposit: 0
  });
  return state;
}

test('sanitizers: residence enum is exact — junk normalizes to absent, never throws', () => {
  assert.deepEqual([...RESIDENCE_TYPES], ['owner', 'tenant', 'commercial_shop']);
  assert.equal(sanitizeResidenceType('owner'), 'owner');
  assert.equal(sanitizeResidenceType('tenant'), 'tenant');
  assert.equal(sanitizeResidenceType('commercial_shop'), 'commercial_shop');
  assert.equal(sanitizeResidenceType('Tenant'), '');
  assert.equal(sanitizeResidenceType('villa'), '');
  assert.equal(sanitizeResidenceType(''), '');
  assert.equal(sanitizeResidenceType(null), '');
  assert.equal(sanitizeResidenceType(undefined), '');
  assert.equal(sanitizeResidenceType(42), '');
});

test('sanitizers: guarantor texts trim, flatten to one line and cap (name 100, phone 40)', () => {
  assert.equal(sanitizeLandlordOrGuarantorName('  Haji Sahib  '), 'Haji Sahib');
  assert.equal(sanitizeLandlordOrGuarantorName('Line one\nLine two'), 'Line one Line two');
  assert.equal(sanitizeLandlordOrGuarantorName('x'.repeat(150)).length, 100);
  assert.equal(sanitizeLandlordPhone('0321-777 8899'), '0321-777 8899');
  assert.equal(sanitizeLandlordPhone('0'.repeat(60)).length, 40);
  assert.equal(sanitizeLandlordOrGuarantorName(12345), '');
  assert.equal(sanitizeLandlordPhone(null), '');
  assert.deepEqual(normalizeOccupancyFields(null), { residenceType: '', landlordOrGuarantorName: '', landlordPhone: '' });
  assert.deepEqual(normalizeOccupancyFields({ residenceType: 'junk', landlordOrGuarantorName: 7 }),
    { residenceType: '', landlordOrGuarantorName: '', landlordPhone: '' });
});

test('addCustomer carries the three fields; a junk residence type coerces to absent', () => {
  const state = stateWithTenant();
  const tenant = state.customers[0];
  assert.equal(tenant.residenceType, 'tenant');
  assert.equal(tenant.landlordOrGuarantorName, 'Synthetic Landlord');
  assert.equal(tenant.landlordPhone, '0321-7778899');

  let plain = createInitialState();
  plain = addCustomer(plain, 'Synthetic Plain', REF, { residenceType: 'villa' });
  assert.equal(plain.customers[0].residenceType, '');
  assert.equal(plain.customers[0].landlordOrGuarantorName, '');
  assert.equal(plain.customers[0].landlordPhone, '');
});

test('addCustomer refuses an over-length guarantor name (house cleanText cap behaviour)', () => {
  assert.throws(
    () => addCustomer(createInitialState(), 'Synthetic Long', REF, { landlordOrGuarantorName: 'y'.repeat(101) }),
    /100 characters or fewer/
  );
});

test('updateCustomerProfile sets the fields, preserves them on unrelated saves, and coerces junk', () => {
  let state = createInitialState();
  state = addCustomer(state, 'Synthetic Mover', REF, {});
  const id = state.customers[0].id;
  state = updateCustomerProfile(state, id, {
    residenceType: 'tenant', landlordOrGuarantorName: 'Synthetic Guarantor', landlordPhone: '0300-9998877'
  }, REF);
  let customer = state.customers[0];
  assert.equal(customer.residenceType, 'tenant');
  assert.equal(customer.landlordOrGuarantorName, 'Synthetic Guarantor');
  assert.equal(customer.landlordPhone, '0300-9998877');

  state = updateCustomerProfile(state, id, { zone: 'Zone 9' }, REF);
  customer = state.customers[0];
  assert.equal(customer.residenceType, 'tenant');
  assert.equal(customer.landlordOrGuarantorName, 'Synthetic Guarantor');
  assert.equal(customer.landlordPhone, '0300-9998877');

  state = updateCustomerProfile(state, id, { residenceType: 'penthouse' }, REF);
  assert.equal(state.customers[0].residenceType, '');
});

test('storage round-trip: fields survive persistState + readState; junk in storage loads as absent', () => {
  const storage = memoryStorage();
  persistState(stateWithTenant(), storage);
  const restored = readState(storage);
  assert.equal(restored.customers[0].residenceType, 'tenant');
  assert.equal(restored.customers[0].landlordOrGuarantorName, 'Synthetic Landlord');
  assert.equal(restored.customers[0].landlordPhone, '0321-7778899');

  const junkState = stateWithTenant();
  junkState.customers[0] = { ...junkState.customers[0], residenceType: 'villa', landlordOrGuarantorName: 42 };
  const junkStorage = memoryStorage();
  persistState(junkState, junkStorage);
  const junkRestored = readState(junkStorage);
  assert.equal(junkRestored.customers[0].residenceType, '');
  assert.equal(junkRestored.customers[0].landlordOrGuarantorName, '');
});

test('backup round-trip: fields travel through createJsonBackup + preview merge (new device and fill-in)', () => {
  const source = stateWithTenant();
  const backupText = createJsonBackup(source, REF);

  // New device: the customer arrives whole, fields validated in.
  const fresh = previewJsonBackupMerge(createInitialState(), backupText);
  const arrived = fresh.state.customers.find((c) => c.name === 'Synthetic Tenant');
  assert.ok(arrived);
  assert.equal(arrived.residenceType, 'tenant');
  assert.equal(arrived.landlordOrGuarantorName, 'Synthetic Landlord');
  assert.equal(arrived.landlordPhone, '0321-7778899');

  // Same customer already on the device WITHOUT the fields: merge fills
  // them in (never a conflict, never an overwrite of local values).
  // (Deep copy of the SAME state so id/number/name identity matches.)
  const local = JSON.parse(JSON.stringify(source));
  local.customers[0] = { ...local.customers[0], residenceType: '', landlordOrGuarantorName: '', landlordPhone: '' };
  const filled = previewJsonBackupMerge(local, backupText);
  const merged = filled.state.customers.find((c) => c.name === 'Synthetic Tenant');
  assert.equal(merged.residenceType, 'tenant');
  assert.equal(merged.landlordOrGuarantorName, 'Synthetic Landlord');
  assert.equal(merged.landlordPhone, '0321-7778899');
  assert.ok(filled.counts.filledProfileFields >= 3);
});

test('backup validation: a junk residence type inside a backup imports as absent, not as an error', () => {
  const source = stateWithTenant();
  source.customers[0] = { ...source.customers[0], residenceType: 'villa' };
  const preview = previewJsonBackupMerge(createInitialState(), createJsonBackup(source, REF));
  const arrived = preview.state.customers.find((c) => c.name === 'Synthetic Tenant');
  assert.ok(arrived);
  assert.equal(arrived.residenceType, '');
});

test('tenant deposit risk: the full truth table', () => {
  // tenant + ISP router + zero deposit → RISK
  assert.equal(tenantDepositRisk({ residenceType: 'tenant', routerOwnership: 'isp-owned', securityDeposit: 0 }), true);
  // tenant + ISP media converter + deposit absent → RISK
  assert.equal(tenantDepositRisk({ residenceType: 'tenant', mediaConverterOwnership: 'isp-owned' }), true);
  // tenant + ISP hardware + a recorded deposit → no risk
  assert.equal(tenantDepositRisk({ residenceType: 'tenant', routerOwnership: 'isp-owned', securityDeposit: 1500 }), false);
  // homeowner + ISP hardware + zero deposit → no risk (tenant-specific rule)
  assert.equal(tenantDepositRisk({ residenceType: 'owner', routerOwnership: 'isp-owned', securityDeposit: 0 }), false);
  // commercial + ISP hardware + zero deposit → no risk
  assert.equal(tenantDepositRisk({ residenceType: 'commercial_shop', routerOwnership: 'isp-owned', securityDeposit: 0 }), false);
  // tenant + only customer-owned hardware + zero deposit → no risk
  assert.equal(tenantDepositRisk({ residenceType: 'tenant', routerOwnership: 'customer-owned', mediaConverterOwnership: 'customer-owned', securityDeposit: 0 }), false);
  // tenant + no hardware recorded → no risk
  assert.equal(tenantDepositRisk({ residenceType: 'tenant', securityDeposit: 0 }), false);
  // legacy record with nothing recorded → no risk
  assert.equal(tenantDepositRisk({}), false);
  assert.equal(tenantDepositRisk(null), false);
  // helpers agree with the derivation
  assert.equal(holdsIspOwnedHardware({ mediaConverterOwnership: 'isp-owned' }), true);
  assert.equal(holdsIspOwnedHardware({ routerOwnership: 'customer-owned' }), false);
  assert.equal(hasOccupancyRecord({ landlordPhone: '0300-1' }), true);
  assert.equal(hasOccupancyRecord({}), false);
});

test('profile presentation: risk tenant shows the warning data; legacy profiles stay invisible', () => {
  const risky = occupancyPresentation({ residenceType: 'tenant', routerOwnership: 'isp-owned', securityDeposit: 0, landlordOrGuarantorName: 'Synthetic Landlord', landlordPhone: '0321-7778899' });
  assert.equal(risky.visible, true);
  assert.equal(risky.risk, true);
  assert.ok(risky.riskLabel.length > 0 && !risky.riskLabel.startsWith('occ_'));
  assert.ok(risky.residenceLabel.includes('Tenant'));
  assert.equal(risky.guarantorName, 'Synthetic Landlord');

  const legacy = occupancyPresentation({ name: 'Legacy' });
  assert.equal(legacy.visible, false);
  assert.equal(legacy.risk, false);

  const owner = occupancyPresentation({ residenceType: 'owner', routerOwnership: 'isp-owned', securityDeposit: 0 });
  assert.equal(owner.visible, true);
  assert.equal(owner.risk, false);
});

test('guarantor search (core searchCustomers): name and phone digits find the tenant', () => {
  let state = stateWithTenant();
  state = addCustomer(state, 'Synthetic Neighbour', REF, { phone: '0300-1110000' });

  const byName = searchCustomers(state, 'Synthetic Landlord');
  assert.deepEqual(byName.map((c) => c.name), ['Synthetic Tenant']);

  // Digit-normalized partial match against the guarantor phone, typed
  // with different spacing than it was stored with.
  const byPhone = searchCustomers(state, '777 8899');
  assert.deepEqual(byPhone.map((c) => c.name), ['Synthetic Tenant']);

  assert.equal(searchCustomers(state, 'Nonexistent Person').length, 0);
  assert.equal(searchCustomers(state, '666555').length, 0);
});

test('guarantor search (roster field filter): Name field matches guarantor name, Mobile field matches guarantor phone', () => {
  const tenant = stateWithTenant().customers[0];
  assert.equal(customerMatchesSearchField(tenant, 'name', 'Landlord'), true);
  assert.equal(customerMatchesSearchField(tenant, 'name', 'synthetic landlord'), true);
  assert.equal(customerMatchesSearchField(tenant, 'mobile', '7778899'), true);
  assert.equal(customerMatchesSearchField(tenant, 'mobile', '0321 777'), true);
  assert.equal(customerMatchesSearchField(tenant, 'mobile', '666555'), false);
  assert.equal(customerMatchesSearchField(tenant, 'name', 'Neighbour'), false);
  // Customers without guarantor data simply never match on it.
  const plain = { name: 'Synthetic Plain', phone: '0300-1110000' };
  assert.equal(customerMatchesSearchField(plain, 'name', 'Landlord'), false);
  assert.equal(customerMatchesSearchField(plain, 'mobile', '7778899'), false);
});

test('i18n audit: every occ_* key used by the phase resolves in en AND ur; dict parity kept', () => {
  const used = new Set();
  for (const file of ['app.js', 'profile-ui.js', 'index.html']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of source.matchAll(/(?:t\(|data-i18n(?:-placeholder)?=)"(occ_[a-z0-9_]+)"/g)) used.add(match[1]);
    for (const match of source.matchAll(/t\('(occ_[a-z0-9_]+)'/g)) used.add(match[1]);
  }
  assert.ok(used.size >= 8, `expected at least 8 occ_* keys in use, found ${used.size}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `en missing ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `ur missing ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key, `en ${key} is a raw key`);
    assert.notEqual(TRANSLATIONS.ur[key], key, `ur ${key} is a raw key`);
  }
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length, 'en/ur dictionary parity');
});

test('wiring: form fields exist, app.js fills + saves them, warning CSS uses theme tokens only', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['residenceTypeInput', 'landlordOrGuarantorNameInput', 'landlordPhoneInput']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("$('#residenceTypeInput')"), 'app.js does not reference the residence select');
  assert.ok(app.includes('occupancyPresentation(customer)'), 'app.js does not render the occupancy presentation');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const rule = css.match(/\.occupancy-risk-warning\s*\{[^}]*\}/);
  assert.ok(rule, 'components.css missing .occupancy-risk-warning');
  assert.ok(rule[0].includes('var(--amber'), 'warning must use the amber theme tokens');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(rule[0]), 'warning CSS must not introduce hex colours');
});
