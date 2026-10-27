// Area, zone & package breakdowns for the Analytics screen (#361).
// Every helper here is pure and tested on synthetic data only. The
// breakdowns group saved priced bills by the customer's current area /
// zone / recorded bill package; billed, collected, outstanding and
// overdue totals must reconcile across all three breakdowns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAreaBreakdowns } from '../owner-insights.js';
import { calculatePaymentAllocations } from '../core.js';

// 2026-10-27 12:00 PKT: asOf 2026-10-27, current month 2026-10.
const ref = new Date(Date.UTC(2026, 9, 27, 7));
const bill = (overrides) => ({ payments: [], ...overrides });
const customer = (id, fields, bills) => ({ id, customerNumber: id, name: `Customer ${id}`, archived: false, ...fields, bills });

function fixture() {
  return {
    customers: [
      customer('c1', { area: 'Shahdara', zone: 'Zone 1' }, [
        bill({ month: '2026-09', dueAmount: 1000, dueDate: '2026-09-05', payments: [{ date: '2026-09-06', amount: 1000, method: 'Cash' }], packageSnapshot: { label: '10 Mbps' } }),
        bill({ month: '2026-10', dueAmount: 2000, dueDate: '2026-10-05', payments: [{ date: '2026-10-06', amount: 500, method: 'Easypaisa' }], packageSnapshot: { label: '10 Mbps' } }),
      ]),
      customer('c2', { mohalla: 'Shahdara', zone: 'Zone 2' }, [
        bill({ month: '2026-10', dueAmount: 500, dueDate: '2026-11-05', packageSnapshot: { label: '20 Mbps' } }),
      ]),
      customer('c3', { mohalla: 'Margalla', packageHistory: [{ date: '2026-09-01', newPackage: '15 Mbps' }] }, [
        bill({ month: '2026-10', dueAmount: 300, dueDate: '2026-10-10' }),
      ]),
      customer('c4', {}, [
        bill({ month: '2026-10', dueAmount: '', dueDate: '2026-10-05' }),
        bill({ month: '2026-10', dueAmount: 700, dueDate: '2026-10-20', payments: [{ date: '2026-10-21', amount: 800, method: 'Cash' }], packageSnapshot: { label: '10 Mbps' } }),
      ]),
      customer('c5', { area: 'Shahdara', zone: 'Zone 1', archived: true }, [
        bill({ month: '2026-09', dueAmount: 400, dueDate: '2026-09-05', packageSnapshot: { label: '10 Mbps' } }),
      ]),
      customer('c6', { area: 'Shahdara' }, [
        bill({ month: '2026-11', dueAmount: 9000, dueDate: '2026-11-05' }),
      ]),
      customer('c7', { area: 'Shahdara' }, [
        bill({ month: '2026-13', dueAmount: 9000, dueDate: '2026-10-05' }),
      ]),
      customer('c8', { mohalla: 'Margalla' }, [
        bill({ month: '2026-10', dueAmount: 600, dueDate: '2026-10-27', packageSnapshot: { label: '15 Mbps' } }),
      ]),
      customer('c9', { area: 'Shahdara' }, [
        bill({ month: '2026-10', dueAmount: 100, dueDate: '2026-10-15' }),
      ]),
    ],
  };
}

function byName(rows) {
  return new Map(rows.map((row) => [row.name, row]));
}

test('area breakdown groups by saved area/mohalla with collection rate and overdue', () => {
  const result = buildAreaBreakdowns(fixture(), ref, calculatePaymentAllocations(fixture()));
  assert.equal(result.asOf, '2026-10-27');
  assert.equal(result.currentMonth, '2026-10');
  assert.equal(result.pricedBillCount, 8);
  assert.equal(result.unpricedBillCount, 1);
  const areas = byName(result.areas);
  assert.deepEqual(areas.get('Shahdara'), { name: 'Shahdara', customers: 4, billed: 4000, collected: 1500, outstanding: 2500, collectionRate: 37.5, overdueBills: 3, overdueCustomers: 3 });
  assert.deepEqual(areas.get('Margalla'), { name: 'Margalla', customers: 2, billed: 900, collected: 0, outstanding: 900, collectionRate: 0, overdueBills: 1, overdueCustomers: 1 });
  assert.deepEqual(areas.get('Area not recorded'), { name: 'Area not recorded', customers: 1, billed: 700, collected: 800, outstanding: 0, collectionRate: 114.3, overdueBills: 0, overdueCustomers: 0 });
  assert.deepEqual(result.areas.map((row) => row.name), ['Shahdara', 'Margalla', 'Area not recorded']);
});

test('zone breakdown nests zones under their parent area and keeps unzoned rows separate', () => {
  const result = buildAreaBreakdowns(fixture(), ref, calculatePaymentAllocations(fixture()));
  const zones = byName(result.zones);
  assert.deepEqual(zones.get('Shahdara · Zone 1'), { name: 'Shahdara · Zone 1', customers: 2, billed: 3400, collected: 1500, outstanding: 1900, collectionRate: 44.1, overdueBills: 2, overdueCustomers: 2 });
  assert.deepEqual(zones.get('Shahdara · Zone 2'), { name: 'Shahdara · Zone 2', customers: 1, billed: 500, collected: 0, outstanding: 500, collectionRate: 0, overdueBills: 0, overdueCustomers: 0 });
  assert.deepEqual(zones.get('Zone not recorded'), { name: 'Zone not recorded', customers: 4, billed: 1700, collected: 800, outstanding: 1000, collectionRate: 47.1, overdueBills: 2, overdueCustomers: 2 });
  assert.deepEqual(result.zones.map((row) => row.name), ['Shahdara · Zone 1', 'Zone not recorded', 'Shahdara · Zone 2']);
});

test('package breakdown uses the recorded bill package, with history fallback and a not-recorded group', () => {
  const result = buildAreaBreakdowns(fixture(), ref, calculatePaymentAllocations(fixture()));
  const packages = byName(result.packages);
  assert.deepEqual(packages.get('10 Mbps'), { name: '10 Mbps', customers: 3, billed: 4100, collected: 2300, outstanding: 1900, collectionRate: 56.1, overdueBills: 2, overdueCustomers: 2 });
  assert.deepEqual(packages.get('15 Mbps'), { name: '15 Mbps', customers: 2, billed: 900, collected: 0, outstanding: 900, collectionRate: 0, overdueBills: 1, overdueCustomers: 1 });
  assert.deepEqual(packages.get('20 Mbps'), { name: '20 Mbps', customers: 1, billed: 500, collected: 0, outstanding: 500, collectionRate: 0, overdueBills: 0, overdueCustomers: 0 });
  assert.deepEqual(packages.get('Package not recorded'), { name: 'Package not recorded', customers: 1, billed: 100, collected: 0, outstanding: 100, collectionRate: 0, overdueBills: 1, overdueCustomers: 1 });
});

test('totals reconcile across area, zone and package breakdowns', () => {
  const result = buildAreaBreakdowns(fixture(), ref, calculatePaymentAllocations(fixture()));
  const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
  assert.deepEqual(result.totals, { billed: 5600, collected: 2300, outstanding: 3400, overdueBills: 4 });
  for (const rows of [result.zones, result.packages]) {
    assert.equal(sum(rows, 'billed'), 5600);
    assert.equal(sum(rows, 'collected'), 2300);
    assert.equal(sum(rows, 'outstanding'), 3400);
    assert.equal(sum(rows, 'overdueBills'), 4);
  }
});

test('due today is not overdue, future and invalid months are excluded, and input is not mutated', () => {
  const state = fixture();
  const before = JSON.stringify(state);
  const result = buildAreaBreakdowns(state, ref, calculatePaymentAllocations(state));
  // c8's bill is due exactly on asOf: Margalla's only overdue bill is c3's.
  assert.equal(byName(result.areas).get('Margalla').overdueBills, 1);
  // c6 (future month) and c7 (invalid month) contribute nothing.
  assert.equal(result.pricedBillCount, 8);
  assert.equal(JSON.stringify(state), before);
});

test('empty ledger yields empty breakdowns and zero totals', () => {
  const result = buildAreaBreakdowns({ customers: [] }, ref, calculatePaymentAllocations({ customers: [] }));
  assert.deepEqual(result.areas, []);
  assert.deepEqual(result.zones, []);
  assert.deepEqual(result.packages, []);
  assert.deepEqual(result.totals, { billed: 0, collected: 0, outstanding: 0, overdueBills: 0 });
  assert.equal(result.pricedBillCount, 0);
});
