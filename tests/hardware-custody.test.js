// SISP-19: Customer Hardware Custody and Returnable Equipment Log.
// Pure-function + core-integration tests on synthetic data only.
// Spec test criterion (verbatim): marking a customer with an ISP-owned
// Media Converter as Disconnected flags them in the "Pending Hardware
// Recovery" list until marked recovered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  custodyItems,
  disconnectionChecklist,
  isDisconnected,
  isPendingHardwareRecovery,
  markAllHardwareRecovered,
  markHardwareRecovered,
  normalizeCustodyFields,
  pendingHardwareRecovery,
  pendingRecoveryItems,
  recoveryStockMovement,
  recoveryStockMovements
} from '../hardware-custody.js';
import {
  addCustomer,
  archiveCustomer,
  createInitialState,
  createJsonBackup,
  previewJsonBackupMerge,
  updateCustomerProfile
} from '../core.js';

const base = (overrides = {}) => ({
  id: 'c1',
  customerNumber: 42,
  name: 'Test Customer 34',
  mohalla: 'Shahdara Town',
  archived: false,
  archivedAt: null,
  ...overrides
});

test('legacy customers normalize to unknown ownership, no deposit, nothing recovered', () => {
  const fields = normalizeCustodyFields({ id: 'c9' });
  assert.equal(fields.routerOwnership, '');
  assert.equal(fields.mediaConverterOwnership, '');
  assert.equal(fields.serialNumber, '');
  assert.equal(fields.securityDeposit, null);
  assert.deepEqual(fields.hardwareRecovered, { router: null, mediaConverter: null });
});

test('invalid ownership values normalize to not recorded, never throw', () => {
  const fields = normalizeCustodyFields({ routerOwnership: 'leased', mediaConverterOwnership: 7 });
  assert.equal(fields.routerOwnership, '');
  assert.equal(fields.mediaConverterOwnership, '');
});

test('disconnected means archived — offline service status alone is not disconnection', () => {
  assert.equal(isDisconnected(base({ archived: true })), true);
  assert.equal(isDisconnected(base({ archived: false, serviceStatus: 'offline' })), false);
  assert.equal(isDisconnected(base({})), false);
});

test('verbatim criterion: ISP-owned media converter + disconnected = pending until recovered', () => {
  const customer = base({ archived: true, mediaConverterOwnership: 'isp-owned' });
  assert.equal(isPendingHardwareRecovery(customer), true);
  assert.deepEqual(pendingRecoveryItems(customer).map(item => item.key), ['mediaConverter']);
  assert.equal(pendingHardwareRecovery([customer]).length, 1);
  const recovered = markHardwareRecovered(customer, 'mediaConverter', '2026-10-28');
  assert.equal(isPendingHardwareRecovery(recovered), false);
  assert.deepEqual(pendingHardwareRecovery([recovered]), []);
  assert.equal(recovered.hardwareRecovered.mediaConverter, '2026-10-28');
});

test('customer-owned items never pend, even when disconnected', () => {
  const customer = base({ archived: true, routerOwnership: 'customer-owned', mediaConverterOwnership: 'customer-owned' });
  assert.deepEqual(pendingRecoveryItems(customer), []);
  assert.equal(isPendingHardwareRecovery(customer), false);
});

test('connected customers never pend, even with ISP-owned hardware installed', () => {
  const customer = base({ archived: false, routerOwnership: 'isp-owned', mediaConverterOwnership: 'isp-owned' });
  assert.deepEqual(pendingRecoveryItems(customer), []);
});

test('checklist lists only ISP-owned items, with recovered state', () => {
  const customer = base({
    routerOwnership: 'isp-owned',
    mediaConverterOwnership: 'customer-owned',
    hardwareRecovered: { router: '2026-10-20', mediaConverter: null }
  });
  const list = disconnectionChecklist(customer);
  assert.equal(list.length, 1);
  assert.equal(list[0].key, 'router');
  assert.equal(list[0].recovered, true);
  assert.equal(list[0].recoveredAt, '2026-10-20');
});

test('mark recovered is pure and idempotent — first recovery date is kept', () => {
  const customer = base({ archived: true, routerOwnership: 'isp-owned' });
  const once = markHardwareRecovered(customer, 'router', '2026-10-20');
  assert.equal(customer.hardwareRecovered, undefined);
  const twice = markHardwareRecovered(once, 'router', '2026-10-25');
  assert.equal(twice.hardwareRecovered.router, '2026-10-20');
});

test('mark recovered throws on unknown item or invalid date', () => {
  const customer = base({ archived: true, routerOwnership: 'isp-owned' });
  assert.throws(() => markHardwareRecovered(customer, 'dish', '2026-10-28'), /Unknown custody item/);
  assert.throws(() => markHardwareRecovered(customer, 'router', '2026-13-40'), /valid recovery date/);
  assert.throws(() => markHardwareRecovered(customer, 'router', ''), /valid recovery date/);
});

test('mark all recovered marks every pending item and nothing else', () => {
  const customer = base({
    archived: true,
    routerOwnership: 'isp-owned',
    mediaConverterOwnership: 'isp-owned',
    hardwareRecovered: { router: '2026-10-20', mediaConverter: null }
  });
  const updated = markAllHardwareRecovered(customer, '2026-10-28');
  assert.equal(updated.hardwareRecovered.router, '2026-10-20');
  assert.equal(updated.hardwareRecovered.mediaConverter, '2026-10-28');
  assert.equal(isPendingHardwareRecovery(updated), false);
});

test('pending list sorts by customer number', () => {
  const a = base({ id: 'c2', customerNumber: 9, archived: true, routerOwnership: 'isp-owned' });
  const b = base({ id: 'c1', customerNumber: 3, archived: true, mediaConverterOwnership: 'isp-owned' });
  const list = pendingHardwareRecovery([a, b]);
  assert.deepEqual(list.map(entry => entry.customer.customerNumber), [3, 9]);
});

test('recovery stock movement shape for SISP-18 merge-time wiring', () => {
  const recovered = base({
    archived: true, name: 'Test Customer 34', customerNumber: 42,
    routerOwnership: 'isp-owned',
    hardwareRecovered: { router: '2026-10-28', mediaConverter: null }
  });
  assert.deepEqual(recoveryStockMovement(recovered, 'router'), {
    itemId: 'router',
    kind: 'in',
    qty: 1,
    date: '2026-10-28',
    customerName: 'Test Customer 34',
    note: 'Hardware recovered — Router (customer #42)'
  });
  assert.equal(recoveryStockMovement(recovered, 'mediaConverter'), null);
  const customerOwned = base({ archived: true, routerOwnership: 'customer-owned', hardwareRecovered: { router: '2026-10-28', mediaConverter: null } });
  assert.equal(recoveryStockMovement(customerOwned, 'router'), null);
  assert.equal(recoveryStockMovement(recovered, 'dish'), null);
});

test('core: addCustomer and updateCustomerProfile carry custody fields; invalid ownership rejected', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 34', new Date('2026-10-28'), {
    routerOwnership: 'isp-owned',
    mediaConverterOwnership: 'customer-owned',
    serialNumber: 'SN-1234',
    securityDeposit: 2000
  });
  const customer = state.customers[0];
  assert.equal(customer.routerOwnership, 'isp-owned');
  assert.equal(customer.mediaConverterOwnership, 'customer-owned');
  assert.equal(customer.serialNumber, 'SN-1234');
  assert.equal(customer.securityDeposit, 2000);
  assert.deepEqual(customer.hardwareRecovered, { router: null, mediaConverter: null });
  state = updateCustomerProfile(state, customer.id, { routerOwnership: 'customer-owned', securityDeposit: 1500 });
  const updated = state.customers[0];
  assert.equal(updated.routerOwnership, 'customer-owned');
  assert.equal(updated.securityDeposit, 1500);
  assert.throws(() => updateCustomerProfile(state, customer.id, { routerOwnership: 'leased' }), /ownership/);
  assert.throws(() => updateCustomerProfile(state, customer.id, { securityDeposit: -5 }), /negative/);
});

test('core: profile saves can never fake a recovery date', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 34', new Date('2026-10-28'), { routerOwnership: 'isp-owned' });
  const customer = state.customers[0];
  state = updateCustomerProfile(state, customer.id, { hardwareRecovered: { router: '2026-10-28', mediaConverter: null } });
  assert.deepEqual(state.customers[0].hardwareRecovered, { router: null, mediaConverter: null });
});

test('core: archive + custody fields flow through JSON backup merge; recovery dates merge per item', () => {
  let source = createInitialState([]);
  source = addCustomer(source, 'Test Customer 34', new Date('2026-10-28'), {
    routerOwnership: 'isp-owned',
    mediaConverterOwnership: 'isp-owned',
    serialNumber: 'SN-1234',
    securityDeposit: 2000
  });
  const sourceCustomer = source.customers[0];
  source = archiveCustomer(source, sourceCustomer.id, new Date('2026-10-28'));
  const backup = createJsonBackup(source, new Date('2026-10-28'));
  const parsed = JSON.parse(backup);
  assert.equal(parsed.state.customers[0].routerOwnership, 'isp-owned');
  assert.equal(parsed.state.customers[0].securityDeposit, 2000);

  // Device holds the same customer with empty custody fields: merge fills them.
  let device = createInitialState([]);
  device = addCustomer(device, 'Test Customer 34', new Date('2026-10-28'), {});
  device.customers[0].id = sourceCustomer.id;
  const preview = previewJsonBackupMerge(device, backup);
  const merged = preview.state.customers.find(c => c.id === sourceCustomer.id);
  assert.equal(merged.routerOwnership, 'isp-owned');
  assert.equal(merged.mediaConverterOwnership, 'isp-owned');
  assert.equal(merged.serialNumber, 'SN-1234');
  assert.equal(merged.securityDeposit, 2000);
  // Note: archived is NOT asserted here — the existing merge keeps the
  // device value when both sides hold conflicting nonblank values, so a
  // device-side archived:false correctly wins over the backup's true.
  // (The pending-recovery derivation reads archived from the device.)

  // Recovery-date merge: device date wins when both sides hold one (first
  // date kept); a device-side null adopts the backup date.
  let device2 = createInitialState([]);
  device2 = addCustomer(device2, 'Test Customer 34', new Date('2026-10-28'), { routerOwnership: 'isp-owned', mediaConverterOwnership: 'isp-owned' });
  device2.customers[0].id = sourceCustomer.id;
  device2.customers[0].hardwareRecovered = { router: '2026-10-20', mediaConverter: null };
  const recoveredSource = markHardwareRecovered(
    markHardwareRecovered({ ...sourceCustomer, archived: true }, 'router', '2026-10-25'),
    'mediaConverter',
    '2026-10-26'
  );
  let source2 = { ...source, customers: source.customers.map(c => c.id === sourceCustomer.id ? recoveredSource : c) };
  const backup2 = createJsonBackup(source2, new Date('2026-10-28'));
  const preview2 = previewJsonBackupMerge(device2, backup2);
  const merged2 = preview2.state.customers.find(c => c.id === sourceCustomer.id);
  assert.equal(merged2.hardwareRecovered.router, '2026-10-20');
  assert.equal(merged2.hardwareRecovered.mediaConverter, '2026-10-26');
});

test('core: archived customer with ISP-owned media converter appears in pending list (end to end)', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 34', new Date('2026-10-28'), { mediaConverterOwnership: 'isp-owned' });
  const customer = state.customers[0];
  assert.equal(pendingHardwareRecovery(state.customers).length, 0);
  state = archiveCustomer(state, customer.id, new Date('2026-10-28'));
  const archived = state.customers[0];
  assert.equal(pendingHardwareRecovery(state.customers).length, 1);
  const recovered = markHardwareRecovered(archived, 'mediaConverter', '2026-10-28');
  assert.equal(pendingHardwareRecovery([{ ...archived, ...recovered }]).length, 0);
  assert.deepEqual(custodyItems(recovered).find(item => item.key === 'mediaConverter'), {
    key: 'mediaConverter',
    label: 'Media Converter / ONU',
    ownership: 'isp-owned',
    ownershipLabel: 'ISP Owned — Returnable',
    recoveredAt: '2026-10-28'
  });
});

test('wiring: recovered router yields exactly one stock-in movement for router', () => {
  const before = base({ archived: true, routerOwnership: 'isp-owned' });
  const after = markHardwareRecovered(before, 'router', '2026-10-28');
  const movements = recoveryStockMovements(before, after);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].itemId, 'router');
  assert.equal(movements[0].kind, 'in');
  assert.equal(movements[0].qty, 1);
  assert.equal(movements[0].date, '2026-10-28');
  assert.equal(movements[0].customerName, 'Test Customer 34');
});

test('wiring: recovered media converter maps to media-converter stock id', () => {
  const before = base({ archived: true, mediaConverterOwnership: 'isp-owned' });
  const after = markHardwareRecovered(before, 'mediaConverter', '2026-10-28');
  const movements = recoveryStockMovements(before, after);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].itemId, 'media-converter');
});

test('wiring: mark-all yields one movement per newly recovered item', () => {
  const before = base({
    archived: true,
    routerOwnership: 'isp-owned',
    mediaConverterOwnership: 'isp-owned',
    hardwareRecovered: { router: '2026-10-20', mediaConverter: null }
  });
  const after = markAllHardwareRecovered(before, '2026-10-28');
  const movements = recoveryStockMovements(before, after);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].itemId, 'media-converter');
});

test('wiring: re-marking an already-recovered item yields zero movements (no double stock)', () => {
  const before = base({
    archived: true,
    routerOwnership: 'isp-owned',
    hardwareRecovered: { router: '2026-10-20', mediaConverter: null }
  });
  const after = markHardwareRecovered(before, 'router', '2026-10-28');
  assert.equal(after.hardwareRecovered.router, '2026-10-20');
  assert.deepEqual(recoveryStockMovements(before, after), []);
});

test('wiring: customer-owned item transition yields no movement', () => {
  const before = base({ archived: true, routerOwnership: 'customer-owned' });
  const after = markHardwareRecovered(before, 'router', '2026-10-28');
  assert.deepEqual(recoveryStockMovements(before, after), []);
});

test('wiring: no transition (nothing newly recovered) yields no movements', () => {
  const before = base({ archived: true, routerOwnership: 'isp-owned' });
  assert.deepEqual(recoveryStockMovements(before, before), []);
});
