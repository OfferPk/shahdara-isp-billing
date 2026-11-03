// Plan I — Testing infrastructure and quality gates (Plan A-Z programme).
//
// Shared test fixtures for NEW tests. This file is a helper, not a test:
// it has no `.test.js` suffix, so `node --test` never counts it as a test,
// and it is never imported by app code (it lives with the Node-side test
// tooling, like tests/qa-manifest-check.js, and is not in build.mjs
// ENTRY_FILES, so it cannot enter the app bundle or the service worker
// precache).
//
// Why this exists: the same setup was copy-pasted across test files —
// most visibly the verbatim in-memory storage helper
//   const store = () => { const data = new Map(); return {
//     getItem: key => data.get(key) ?? null,
//     setItem: (key, value) => data.set(key, value) }; };
// which appears in advance-payment, advance-month-target,
// auto-package-from-payment, backdated-payment-helper and others, and
// hand-written customer/bill/payment literals in dozens of files. New
// tests should build their data with these builders instead of copying
// those literals. Existing tests are NOT migrated in this plan: moving
// them would churn hundreds of pinned assertions for no gate value.
//
// Every builder returns a FRESH object on every call. Mutating the
// result of one call never affects the next call, so tests stay
// independent even when they push into `bills` or `payments`.
//
// All names, phones and areas here are synthetic. No real customer
// record is used as a fixture, and no fixture value is ever written
// to the app's real storage — fixtures live only inside a test run.

import { createInitialState } from '../core.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

// A deep copy of any JSON-shaped fixture value. Use it when a test
// needs a second, independent copy of a value it already built.
export function cloneFixture(value) {
  return clone(value);
}

// One synthetic customer record in the shape createInitialState()
// seeds (see core.js). Overrides replace top-level fields only;
// `bills` and `incidents` are always fresh arrays, so pushing into
// one customer's bills never leaks into another fixture customer.
export function fixtureCustomer(overrides = {}) {
  const { bills, incidents, ...rest } = overrides;
  return {
    id: 'fixture-customer-001',
    customerNumber: 1,
    name: 'Fixture Customer',
    mohalla: 'BARRIAN',
    zone: '',
    address: '',
    phone: '03000000001',
    ispProvider: '',
    serviceStatus: 'active',
    serviceStatusHistory: [],
    packageSpeed: '',
    monthlyPurchaseCost: null,
    monthlySellingAmount: 2000,
    monthlyPriceSchedule: [],
    billingStartMonth: null,
    connectionDate: null,
    expiryDate: null,
    cancellationDate: null,
    packageHistory: [],
    relocationLog: [],
    archived: false,
    archivedAt: null,
    ...rest,
    bills: bills === undefined ? [] : clone(bills),
    incidents: incidents === undefined ? [] : clone(incidents),
  };
}

// One synthetic bill in the shape the billing screens read: a month,
// a PKR due amount, and the payments recorded against it.
export function fixtureBill(overrides = {}) {
  const { payments, ...rest } = overrides;
  return {
    month: '2026-10',
    dueAmount: 2000,
    status: 'pending',
    ...rest,
    payments: payments === undefined ? [] : clone(payments),
  };
}

// One synthetic payment in the shape the billing screens read.
// Amounts are PKR numbers, as in the billing-table and register tests
// (core.js validatePayment converts to cents internally; fixtures
// that go through addPayment should be built with validatePayment's
// field names instead — see fixtureState's note).
export function fixturePayment(overrides = {}) {
  return {
    id: 'fixture-payment-001',
    date: '2026-10-05',
    amount: 2000,
    method: 'Cash',
    ...overrides,
  };
}

// A full ledger state holding the given customers. Each entry is
// passed through fixtureCustomer, so a partial literal still gets a
// complete, well-shaped record. The state starts from
// createInitialState([]) so `version` and the collection fields
// always match the app's own initial state, and nextCustomerNumber
// follows the highest customer number present.
export function fixtureState(customers = [], overrides = {}) {
  const state = createInitialState([]);
  const { customers: overrideCustomers, nextCustomerNumber: overrideNext, ...rest } = overrides;
  const source = overrideCustomers === undefined ? customers : overrideCustomers;
  const built = source.map((customer) => fixtureCustomer(customer));
  const maxNumber = built.reduce((max, c) => Math.max(max, c.customerNumber || 0), 0);
  return {
    ...state,
    ...rest,
    customers: built,
    nextCustomerNumber: overrideNext === undefined ? maxNumber + 1 : overrideNext,
  };
}

// The in-memory storage every storage test used to hand-roll: a
// Map-backed object with the localStorage getItem/setItem contract
// (missing keys read back as null, never undefined). Each call
// returns an independent store. `seed` pre-fills key/value pairs.
export function inMemoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    clear: () => { data.clear(); },
  };
}
