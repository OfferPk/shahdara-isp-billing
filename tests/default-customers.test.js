// Default customer roster import — PRIVACY SHAPE (2026-10-29 cleanup):
// the roster shipped in this public repo is EMPTY by the owner's order,
// so no real customer names are bundled with the app and the load-time
// import adds nobody. The planner/import machinery is still fully
// pinned here by injecting a small SYNTHETIC roster (fake names, real
// canonical mohalla labels, one free:true entry) through the roster
// parameter both public functions accept — the same code path a future
// private roster would use. FREE behaviour stays pinned too: a free
// entry lands as isFreeConnection, is never billed by load-time bill
// generation or the SISP-2 cycle, and never appears in
// defaulter/escalation outputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CUSTOMER_ROSTER,
  DEFAULT_ROSTER_VERSION,
  planDefaultCustomerAdditions,
  applyDefaultCustomerRoster
} from '../default-customers.js';
import {
  createInitialState,
  generateMonthlyBillsThroughCurrentMonth,
  persistState,
  readState
} from '../core.js';
import { applyBillingCycle, planCustomerCycleLine } from '../billing-cycle.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';
import { getEscalationStage, isLockDueCustomer } from '../reminder-queue.js';

const REF_DATE = new Date('2026-10-29T12:00:00Z');
const blankState = () => createInitialState([]);
const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
};
const priced = (customer, amount = 3000) => ({
  ...customer,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount }]
});
const unpaidBill = (month) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending',
  payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: []
});

// Synthetic mini-roster: 6 entries over 3 canonical mohallas. The same
// name appears in two mohallas on purpose (separate planner groups),
// and exactly one entry is free.
const TEST_ROSTER = Object.freeze([
  { name: 'Test Alpha', mohalla: 'CHARYAA' },
  { name: 'Test Beta', mohalla: 'CHARYAA' },
  { name: 'Test Gamma', mohalla: 'BARRIAN' },
  { name: 'Test Alpha', mohalla: 'BARRIAN' },
  { name: 'Test Delta', mohalla: 'THALII' },
  { name: 'Test Free Line', mohalla: 'THALII', free: true }
]);

// ---------- Shipped roster pins (privacy) ----------

test('shipped roster: EMPTY by design — no customer names bundled with the app', () => {
  assert.deepEqual(DEFAULT_CUSTOMER_ROSTER, []);
  assert.equal(DEFAULT_CUSTOMER_ROSTER.length, 0);
  assert.ok(DEFAULT_ROSTER_VERSION >= 2);
});

test('shipped roster: the default import on a blank store adds nobody and stamps the marker', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE);
  assert.equal(applied.customers.length, 0);
  assert.equal(applied.settings.defaultCustomersImport.rosterVersion, DEFAULT_ROSTER_VERSION);
  assert.equal(applied.settings.defaultCustomersImport.addedCount, 0);
  assert.equal(applyDefaultCustomerRoster(applied, REF_DATE), applied);
});

// ---------- Planner pins (injected synthetic roster) ----------

test('planner: empty store adds all 6 synthetic entries in roster order', () => {
  const additions = planDefaultCustomerAdditions([], TEST_ROSTER);
  assert.equal(additions.length, 6);
  assert.deepEqual(additions[0], { name: 'Test Alpha', mohalla: 'CHARYAA', free: false });
  assert.deepEqual(additions.at(-1), { name: 'Test Free Line', mohalla: 'THALII', free: true });
  assert.equal(additions.filter((item) => item.free).length, 1);
});

test('planner: when all 6 already exist it adds 0', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE, TEST_ROSTER);
  assert.deepEqual(planDefaultCustomerAdditions(applied.customers, TEST_ROSTER), []);
});

test('planner: same name in a different mohalla does not satisfy this mohalla', () => {
  const existing = [{ name: 'Test Alpha', mohalla: 'BARRIAN', archived: false }];
  const additions = planDefaultCustomerAdditions(existing, TEST_ROSTER);
  assert.equal(additions.length, 5);
  assert.ok(additions.some((item) => item.name === 'Test Alpha' && item.mohalla === 'CHARYAA'));
  assert.ok(!additions.some((item) => item.name === 'Test Alpha' && item.mohalla === 'BARRIAN'));
});

test('planner: a roster name missing entirely is added exactly once', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE, TEST_ROSTER);
  const withoutBeta = applied.customers.filter((customer) => customer.name !== 'Test Beta');
  assert.deepEqual(planDefaultCustomerAdditions(withoutBeta, TEST_ROSTER), [
    { name: 'Test Beta', mohalla: 'CHARYAA', free: false }
  ]);
});

test('planner: archived records do not count, and matching is case/space-insensitive', () => {
  const archivedOnly = [{ name: 'Test Alpha', mohalla: 'CHARYAA', archived: true }];
  assert.equal(planDefaultCustomerAdditions(archivedOnly, TEST_ROSTER).length, 6);
  const messy = [{ name: '  test alpha ', mohalla: 'Mohalla Charyaa', archived: false }];
  const additions = planDefaultCustomerAdditions(messy, TEST_ROSTER);
  assert.equal(additions.length, 5);
  assert.ok(!additions.some((item) => item.name === 'Test Alpha' && item.mohalla === 'CHARYAA'));
});

// ---------- Import / apply pins ----------

test('import: blank store gains 6 blank customers through the real creation path', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE, TEST_ROSTER);
  assert.equal(applied.customers.length, 6);
  assert.deepEqual(
    applied.customers.map((customer) => customer.name).sort(),
    TEST_ROSTER.map((item) => item.name).sort()
  );
  const numbers = new Set(applied.customers.map((customer) => customer.customerNumber));
  assert.equal(numbers.size, 6);
  assert.equal(applied.nextCustomerNumber, 7);
  for (const customer of applied.customers) {
    // Blank roster entry: no package, no mobile, no bills, no balance —
    // exactly the app's own addCustomer defaults, nothing invented.
    assert.equal(customer.phone, '');
    assert.equal(customer.packageSpeed, '');
    assert.equal(customer.monthlySellingAmount, null);
    assert.deepEqual(customer.monthlyPriceSchedule, []);
    assert.deepEqual(customer.bills, []);
    assert.equal(customer.serviceStatus, 'not-set');
    assert.equal(customer.archived, false);
    assert.ok(customer.mohalla, 'mohalla recorded');
  }
  const byName = new Map(applied.customers.map((customer) => [`${customer.name}|${customer.mohalla}`, customer]));
  assert.equal(byName.get('Test Gamma|BARRIAN').mohalla, 'BARRIAN');
  assert.equal(byName.get('Test Delta|THALII').mohalla, 'THALII');
});

test('import: the free entry lands with the persistent isFreeConnection field', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE, TEST_ROSTER);
  const free = applied.customers.filter((customer) => customer.isFreeConnection === true);
  assert.deepEqual(free.map((customer) => customer.name), ['Test Free Line']);
  assert.ok(free.every((customer) => customer.mohalla === 'THALII'));
  assert.ok(applied.customers.every((customer) => customer.isFreeConnection === true || customer.isFreeConnection === false));
});

test('import: marker is stamped and a second run is a no-op (idempotent)', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE, TEST_ROSTER);
  const marker = applied.settings.defaultCustomersImport;
  assert.equal(marker.rosterVersion, DEFAULT_ROSTER_VERSION);
  assert.equal(marker.addedCount, 6);
  const again = applyDefaultCustomerRoster(applied, REF_DATE, TEST_ROSTER);
  assert.equal(again, applied);
  assert.equal(again.customers.length, 6);
});

test('import: pre-existing customers are never modified and only the shortfall is added', () => {
  const existing = {
    id: 'hand-1', customerNumber: 7, name: 'Test Beta', mohalla: 'CHARYAA', archived: false, bills: []
  };
  const state = { ...blankState(), customers: [existing], nextCustomerNumber: 8 };
  const applied = applyDefaultCustomerRoster(state, REF_DATE, TEST_ROSTER);
  assert.equal(applied.customers.length, 6);
  assert.equal(applied.customers[0], existing);
  assert.equal(applied.settings.defaultCustomersImport.addedCount, 5);
});

test('import: marker and free flags survive a persist/readState round-trip', () => {
  const storage = memoryStorage();
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE, TEST_ROSTER);
  persistState(applied, storage);
  const loaded = readState(storage);
  assert.equal(loaded.customers.length, 6);
  assert.equal(loaded.customers.find((customer) => customer.name === 'Test Free Line').isFreeConnection, true);
  assert.equal(loaded.customers.find((customer) => customer.name === 'Test Alpha' && customer.mohalla === 'CHARYAA').isFreeConnection, false);
  assert.equal(loaded.settings.defaultCustomersImport.rosterVersion, DEFAULT_ROSTER_VERSION);
  assert.equal(applyDefaultCustomerRoster(loaded, REF_DATE, TEST_ROSTER), loaded);
});

// ---------- FREE: no bill, no dues, ever ----------

test('free: load-time bill generation never bills a free customer, even after a package is set', () => {
  const applied = applyDefaultCustomerRoster(blankState(), REF_DATE, TEST_ROSTER);
  const withPrices = {
    ...applied,
    customers: applied.customers.map((customer) =>
      customer.name === 'Test Free Line' || customer.name === 'Test Delta' ? priced(customer) : customer)
  };
  const generated = generateMonthlyBillsThroughCurrentMonth(withPrices, new Date('2026-10-15T12:00:00Z'));
  const free = generated.customers.find((customer) => customer.name === 'Test Free Line');
  const normal = generated.customers.find((customer) => customer.name === 'Test Delta');
  assert.equal(free.bills.length, 0);
  assert.ok(normal.bills.length > 0);
});

test('free: the SISP-2 billing cycle skips a free customer and bills a normal one', () => {
  const freeFixture = {
    id: 'free-1', customerNumber: 1, name: 'Test Free Line', archived: false, isFreeConnection: true,
    billingStartMonth: null, monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }], bills: []
  };
  const normalFixture = {
    id: 'norm-1', customerNumber: 2, name: 'Test Delta', archived: false,
    billingStartMonth: null, monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }], bills: []
  };
  const line = planCustomerCycleLine(freeFixture, '2026-10');
  assert.equal(line.skipped, true);
  assert.equal(line.reason, 'free-connection');
  const { state: next } = applyBillingCycle({ customers: [freeFixture, normalFixture] }, '2026-10', new Date('2026-10-01T00:00:00Z'));
  assert.equal(next.customers[0].bills.length, 0);
  assert.equal(next.customers[1].bills.filter((bill) => bill.month === '2026-10').length, 1);
});

test('free: a free customer never appears in top-defaulters or escalation outputs', () => {
  const freeFixture = {
    id: 'free-1', customerNumber: 1, name: 'Test Free Line', mohalla: 'THALII', archived: false,
    isFreeConnection: true, bills: [unpaidBill('2026-09')]
  };
  const normalFixture = {
    id: 'norm-1', customerNumber: 2, name: 'Test Delta', mohalla: 'THALII', archived: false,
    bills: [unpaidBill('2026-09')]
  };
  const result = calculateTopDefaulters({ customers: [freeFixture, normalFixture] }, { referenceDate: new Date('2026-10-20T12:00:00Z') });
  assert.equal(result.metrics.totalDefaultersCount, 1);
  assert.equal(result.metrics.totalReceivablesDues, 3000);
  assert.ok(!JSON.stringify(result.accounts).includes('Test Free Line'));
  // Grace / final-notice / lock-due escalation excludes free connections
  // even if a stray balance were ever presented for one.
  assert.equal(getEscalationStage(freeFixture, 3000, '2026-10-20'), null);
  assert.equal(isLockDueCustomer(freeFixture, 3000, '2026-10-20'), false);
  const normalStage = getEscalationStage(normalFixture, 3000, '2026-10-20');
  assert.equal(normalStage.stage, 'lock-due');
});
