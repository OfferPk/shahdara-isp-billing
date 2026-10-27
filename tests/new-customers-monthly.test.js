// New customers by month: join-month derivation, monthly counts and
// onboarding totals, and the new optional customer fields. All
// aggregation is view-only — these tests never touch billing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  addCustomer,
  updateCustomerProfile,
  readState,
  customerJoinMonth,
  buildNewCustomerReport,
  filterNewCustomerMonths,
  newCustomerQuickRanges
} from '../core.js';

const OCT = new Date('2026-10-15T00:00:00Z'); // 2026-10 in Asia/Karachi
const SEP = new Date('2026-09-15T00:00:00Z');
const AUG = new Date('2026-08-15T00:00:00Z');

function stateWith(names) {
  let state = createInitialState([]);
  for (const { name, date, options } of names) {
    state = addCustomer(state, name, date, options ?? {});
  }
  return state;
}

test('join month prefers addedOn, then connection date, billing month, earliest bill', () => {
  assert.equal(customerJoinMonth({ addedOn: '2026-10-05', connectionDate: '2026-09-01', billingStartMonth: '2026-08', bills: [{ month: '2026-07' }] }), '2026-10');
  assert.equal(customerJoinMonth({ addedOn: null, connectionDate: '2026-09-20', billingStartMonth: '2026-08', bills: [{ month: '2026-07' }] }), '2026-09');
  assert.equal(customerJoinMonth({ connectionDate: null, billingStartMonth: '2026-08', bills: [{ month: '2026-07' }] }), '2026-08');
  assert.equal(customerJoinMonth({ bills: [{ month: '2026-07' }, { month: '2026-05' }] }), '2026-05');
  assert.equal(customerJoinMonth({}), null);
  assert.equal(customerJoinMonth({ addedOn: 'not-a-date', connectionDate: '2026-13-40' }), null);
  assert.equal(customerJoinMonth(null), null);
});

test('report groups newest month first with per-month totals', () => {
  const state = stateWith([
    { name: 'A', date: OCT, options: { connectionFee: 5000, routerModel: 'Huawei HG6245D', routerPrice: 3500, fiberMeters: 85 } },
    { name: 'B', date: OCT, options: { connectionFee: 3000, fiberMeters: 40.5 } },
    { name: 'C', date: SEP, options: { routerModel: 'ZTE F660', routerPrice: 2800 } },
    { name: 'D', date: AUG, options: {} }
  ]);
  const report = buildNewCustomerReport(state.customers, OCT);
  assert.deepEqual(report.months.map(m => m.month), ['2026-10', '2026-09', '2026-08']);
  assert.equal(report.months[0].totals.count, 2);
  assert.equal(report.months[0].totals.connectionFees, 8000);
  assert.equal(report.months[0].totals.routersIssued, 1);
  assert.equal(report.months[0].totals.routerTotal, 3500);
  assert.equal(report.months[0].totals.fiberMeters, 125.5);
  assert.equal(report.months[1].totals.routersIssued, 1);
  assert.equal(report.months[1].totals.routerTotal, 2800);
  assert.equal(report.months[2].totals.count, 1);
  assert.equal(report.undatedCount, 0);
});

test('customers without any join date are counted as undated, never forced into a month', () => {
  const report = buildNewCustomerReport([{ id: 'x', customerNumber: 1, name: 'Old', bills: [] }], OCT);
  assert.deepEqual(report.months, []);
  assert.equal(report.undatedCount, 1);
});

test('archived customers still count as joined in their month', () => {
  const state = stateWith([{ name: 'Gone', date: SEP, options: {} }]);
  const archived = { ...state.customers[0], archived: true, archivedAt: '2026-10-01' };
  const report = buildNewCustomerReport([archived], OCT);
  assert.equal(report.months[0].month, '2026-09');
  assert.equal(report.months[0].totals.count, 1);
});

test('quick ranges cover this month, last month, last 3 and last 6 months', () => {
  const ranges = newCustomerQuickRanges(OCT);
  assert.deepEqual([ranges.thisMonth.start, ranges.thisMonth.end], ['2026-10', '2026-10']);
  assert.deepEqual([ranges.lastMonth.start, ranges.lastMonth.end], ['2026-09', '2026-09']);
  assert.deepEqual([ranges.last3Months.start, ranges.last3Months.end], ['2026-08', '2026-10']);
  assert.deepEqual([ranges.last6Months.start, ranges.last6Months.end], ['2026-05', '2026-10']);
});

test('month-window filter keeps only months inside the range', () => {
  const state = stateWith([
    { name: 'A', date: OCT, options: {} },
    { name: 'B', date: SEP, options: {} },
    { name: 'C', date: AUG, options: {} }
  ]);
  const report = buildNewCustomerReport(state.customers, OCT);
  const last3 = filterNewCustomerMonths(report.months, '2026-08', '2026-10');
  assert.deepEqual(last3.map(m => m.month), ['2026-10', '2026-09', '2026-08']);
  const lastMonth = filterNewCustomerMonths(report.months, '2026-09', '2026-09');
  assert.deepEqual(lastMonth.map(m => m.month), ['2026-09']);
});

test('profile update saves and validates the onboarding fields', () => {
  let state = stateWith([{ name: 'A', date: OCT, options: {} }]);
  const id = state.customers[0].id;
  state = updateCustomerProfile(state, id, {
    connectionFee: 4500, routerModel: '  Huawei HG6245D  ', routerPrice: 3200, fiberMeters: 120.25
  });
  const customer = state.customers[0];
  assert.equal(customer.connectionFee, 4500);
  assert.equal(customer.routerModel, 'Huawei HG6245D');
  assert.equal(customer.routerPrice, 3200);
  assert.equal(customer.fiberMeters, 120.3);
  assert.throws(() => updateCustomerProfile(state, id, { connectionFee: -100 }), /cannot be negative/);
  assert.throws(() => updateCustomerProfile(state, id, { routerPrice: -5 }), /cannot be negative/);
  assert.throws(() => updateCustomerProfile(state, id, { fiberMeters: -1 }), /cannot be negative/);
  assert.throws(() => updateCustomerProfile(state, id, { routerModel: 'x'.repeat(101) }), /100 characters or fewer/);
  state = updateCustomerProfile(state, id, { connectionFee: '', routerPrice: '', fiberMeters: '', routerModel: '' });
  assert.equal(state.customers[0].connectionFee, null);
  assert.equal(state.customers[0].routerPrice, null);
  assert.equal(state.customers[0].fiberMeters, null);
  assert.equal(state.customers[0].routerModel, '');
});

test('addCustomer accepts onboarding options and readState normalizes corrupt values', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'New', OCT, { connectionFee: 2000, routerModel: 'TP-Link', routerPrice: 2500, fiberMeters: 60 });
  const added = state.customers[0];
  assert.equal(added.connectionFee, 2000);
  assert.equal(added.routerModel, 'TP-Link');
  assert.equal(added.fiberMeters, 60);
  const storage = { getItem: () => JSON.stringify({ ...state, customers: [{ ...added, connectionFee: -50, routerPrice: 'bad', fiberMeters: -3, routerModel: '  Model X  ' }] }), setItem: () => {} };
  const restored = readState(storage).customers[0];
  assert.equal(restored.connectionFee, null);
  assert.equal(restored.routerPrice, null);
  assert.equal(restored.fiberMeters, null);
  assert.equal(restored.routerModel, 'Model X');
});
