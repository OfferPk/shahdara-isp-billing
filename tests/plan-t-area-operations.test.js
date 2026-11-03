import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areaFilterKey,
  resolveAreaFilter,
  customerAreaKey,
  customerInArea,
  customerMatchesAreaFilter,
  buildAreaOperationsView,
  areaOperationsViewHtml,
} from '../area-operations.js';
import { filterCustomersByArea } from '../form-validation.js';
import { customerMatchesSearchField, buildMohallaCardStats } from '../customer-search-filter.js';
import { createInitialState, addCustomer, saveBillMonth } from '../core.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';

// Fixture customers. Stub allocations map: `${customerId}|${month}` ->
// { balanceDueCents, billAmountCents } (null balance = unpriced bill).
function stubAllocations(entries) {
  const map = new Map(Object.entries(entries));
  return { forMonth: (id, month) => map.get(`${id}|${month}`) ?? null };
}

function fixture() {
  const customers = [
    { id: 'c1', customerNumber: 1, name: 'Aamir', phone: '03001', mohalla: 'Bani', bills: [
      { month: '2026-10', dueDate: '2026-10-05', payments: [] },
      { month: '2026-11', dueDate: '2026-11-05', payments: [
        { date: '2026-11-02', amount: 500, voided: false },
        { date: '2026-11-03', amount: 999, voided: true },
        { date: '2026-10-30', amount: 700, voided: false },
      ] },
    ] },
    { id: 'c2', customerNumber: 2, name: 'Bilal', phone: '03002', mohalla: 'BANII', promiseDate: '2026-11-01', promiseAmount: 1500, bills: [
      { month: '2026-09', dueDate: '2026-09-05', payments: [] },
      { month: '2026-10', dueDate: '2026-10-05', payments: [] },
      { month: '2026-11', dueDate: '2026-11-05', payments: [{ date: '2026-11-05', amount: 3000, voided: false }] },
    ] },
    { id: 'c3', customerNumber: 3, name: 'Far Away', phone: '03003', mohalla: 'Baradari', bills: [
      { month: '2026-11', dueDate: '2026-11-05', payments: [] },
    ] },
    { id: 'c4', customerNumber: 4, name: 'Free Connection', phone: '03004', mohalla: 'Bani', isFreeConnection: true, bills: [
      { month: '2026-11', dueDate: '2026-11-05', payments: [] },
    ] },
    { id: 'c5', customerNumber: 5, name: 'Archived', phone: '03005', mohalla: 'Bani', archived: true, bills: [
      { month: '2026-11', dueDate: '2026-11-05', payments: [] },
    ] },
    { id: 'c6', customerNumber: 6, name: 'Future Promise', phone: '03006', mohalla: 'Bani', promiseDate: '2026-11-20', promiseAmount: null, bills: [] },
    { id: 'c7', customerNumber: 7, name: 'Bad Promise', phone: '03007', mohalla: 'Bani', promiseDate: 'not-a-date', bills: [] },
    { id: 'c8', customerNumber: 8, name: 'No Area', phone: '03008', bills: [
      { month: '2026-11', dueDate: '2026-11-05', payments: [] },
    ] },
  ];
  const allocations = stubAllocations({
    'c1|2026-10': { balanceDueCents: 500000, billAmountCents: 500000 },
    'c1|2026-11': { balanceDueCents: 200000, billAmountCents: 250000 },
    'c2|2026-09': { balanceDueCents: 100000, billAmountCents: 100000 },
    'c2|2026-10': { balanceDueCents: 100000, billAmountCents: 100000 },
    'c2|2026-11': { balanceDueCents: 0, billAmountCents: 300000 },
    'c3|2026-11': { balanceDueCents: 400000, billAmountCents: 400000 },
    'c4|2026-11': { balanceDueCents: 900000, billAmountCents: 900000 },
    'c5|2026-11': { balanceDueCents: 800000, billAmountCents: 800000 },
    'c8|2026-11': { balanceDueCents: 600000, billAmountCents: 600000 },
  });
  return { customers, allocations };
}

function baniiView() {
  const { customers, allocations } = fixture();
  return buildAreaOperationsView({ customers, allocations, currentMonth: '2026-11', area: 'Bani', todayStr: '2026-11-10' });
}

test('areaFilterKey folds spelling variants into one canonical key', () => {
  assert.equal(areaFilterKey('Bani'), 'banii');
  assert.equal(areaFilterKey('BANII'), 'banii');
  assert.equal(areaFilterKey('MOHALLA BANI'), 'banii');
  assert.equal(areaFilterKey('Baradari'), 'baradari');
  assert.equal(areaFilterKey(''), null);
  assert.equal(areaFilterKey('   '), null);
  assert.equal(areaFilterKey(null), null);
});

test('resolveAreaFilter reports label, stored spelling and canonical flag', () => {
  assert.deepEqual(resolveAreaFilter('Bani'), { key: 'banii', label: 'Banii', stored: 'BANII', canonical: true });
  const other = resolveAreaFilter('Baradari');
  assert.equal(other.key, 'baradari');
  assert.equal(other.canonical, false);
  assert.equal(resolveAreaFilter(''), null);
});

test('customerInArea uses the canonical key of mohalla-or-area', () => {
  assert.equal(customerInArea({ mohalla: 'Bani' }, 'banii'), true);
  assert.equal(customerInArea({ mohalla: 'BANII' }, 'banii'), true);
  assert.equal(customerInArea({ area: 'Bani' }, 'banii'), true);
  assert.equal(customerInArea({ mohalla: 'Baradari' }, 'banii'), false);
  assert.equal(customerInArea({ mohalla: 'Bani' }, 'all'), true);
  assert.equal(customerInArea({ mohalla: 'Bani' }, null), true);
  assert.equal(customerInArea({}, 'banii'), false);
  assert.equal(customerInArea(null, 'banii'), false);
});

test('customerAreaKey prefers mohalla over area', () => {
  assert.equal(customerAreaKey({ mohalla: 'Bani', area: 'Shahdara Town' }), 'banii');
  assert.equal(customerAreaKey({ area: 'Baradari' }), 'baradari');
  assert.equal(customerAreaKey({}), null);
});

test('customerMatchesAreaFilter: canonical match, partial label, blanks', () => {
  assert.equal(customerMatchesAreaFilter({ mohalla: 'BANII' }, 'Bani'), true);
  assert.equal(customerMatchesAreaFilter({ mohalla: 'Baradari' }, 'bara'), true);
  assert.equal(customerMatchesAreaFilter({ mohalla: 'Baradari' }, 'zzz'), false);
  assert.equal(customerMatchesAreaFilter({ mohalla: 'Baradari' }, ''), true);
  assert.equal(customerMatchesAreaFilter({}, 'Bani'), false);
  assert.equal(customerMatchesAreaFilter({ area: 'Bani' }, 'banii'), true);
});

test('filterCustomersByArea agrees with customerInArea on every fixture row', () => {
  const { customers } = fixture();
  for (const area of ['Bani', 'BANII', 'MOHALLA BANI', 'Baradari']) {
    const viaFilter = filterCustomersByArea(customers, area).map((c) => c.id).sort();
    const viaHelper = customers.filter((c) => customerInArea(c, areaFilterKey(area))).map((c) => c.id).sort();
    assert.deepEqual(viaFilter, viaHelper, `area ${area}`);
  }
  assert.deepEqual(filterCustomersByArea(customers, 'all').map((c) => c.id).sort(), customers.map((c) => c.id).sort());
});

test('customerMatchesSearchField area case agrees with customerMatchesAreaFilter', () => {
  const { customers } = fixture();
  for (const query of ['Bani', 'BANII', 'bara', 'zzz', '']) {
    for (const customer of customers) {
      assert.equal(
        customerMatchesSearchField(customer, 'area', query),
        customerMatchesAreaFilter(customer, query),
        `query ${query} customer ${customer.id}`,
      );
    }
  }
});

test('Top Defaulters area filter now uses the canonical mohalla rule', () => {
  const refDate = new Date('2026-04-01T12:00:00Z');
  let state = createInitialState([]);
  state = addCustomer(state, 'Mohalla Variant', refDate, { phone: '03001', mohalla: 'BANII' });
  const a = state.customers[state.customers.length - 1];
  a.area = 'Shahdara Town';
  a.packageSpeed = '15 Mbps';
  state = saveBillMonth(state, a.id, { month: '2026-03', dueAmount: 2000, status: 'pending' }, refDate);
  state = addCustomer(state, 'Area Only', refDate, { phone: '03002', mohalla: '' });
  const b = state.customers[state.customers.length - 1];
  b.area = 'Bani';
  b.packageSpeed = '15 Mbps';
  state = saveBillMonth(state, b.id, { month: '2026-03', dueAmount: 1000, status: 'pending' }, refDate);
  state = addCustomer(state, 'Elsewhere', refDate, { phone: '03003', mohalla: 'Baradari' });
  const c = state.customers[state.customers.length - 1];
  c.area = 'Baradari';
  c.packageSpeed = '15 Mbps';
  state = saveBillMonth(state, c.id, { month: '2026-03', dueAmount: 3000, status: 'pending' }, refDate);

  const result = calculateTopDefaulters(state, { area: 'Bani', referenceDate: refDate });
  assert.deepEqual(result.accounts.map((row) => row.name).sort(), ['Area Only', 'Mohalla Variant']);
});

test('blank area returns an invalid view with empty sections', () => {
  const { customers, allocations } = fixture();
  const view = buildAreaOperationsView({ customers, allocations, currentMonth: '2026-11', area: '', todayStr: '2026-11-10' });
  assert.equal(view.validArea, false);
  assert.equal(view.duesPKR, 0);
  assert.deepEqual(view.defaulters, []);
  assert.deepEqual(view.promises, []);
  assert.match(areaOperationsViewHtml(view), /Choose an area/);
});

test('area with no customers returns a valid empty view', () => {
  const { customers, allocations } = fixture();
  const view = buildAreaOperationsView({ customers, allocations, currentMonth: '2026-11', area: 'No Such Mohalla', todayStr: '2026-11-10' });
  assert.equal(view.validArea, true);
  assert.equal(view.customerCount, 0);
  assert.equal(view.duesPKR, 0);
  assert.equal(view.paidPct, null);
});

test('view roster counts: variants merged, archived and no-area excluded, free counted', () => {
  const view = baniiView();
  assert.equal(view.customerCount, 5);
  assert.equal(view.freeCount, 1);
});

test('view dues sum free and archived out, null balance as zero', () => {
  const view = baniiView();
  // c1 5000 + 2000, c2 1000 + 1000 + 0; free c4 (9000) and archived c5 excluded.
  assert.equal(view.duesPKR, 9000);
});

test('view dues, billed, paid and paidPct agree with the Mohalla card row', () => {
  const { customers, allocations } = fixture();
  const view = buildAreaOperationsView({ customers, allocations, currentMonth: '2026-11', area: 'Bani', todayStr: '2026-11-10' });
  const row = buildMohallaCardStats(customers, allocations, '2026-11').find((r) => r.key === 'banii');
  assert.ok(row);
  assert.equal(view.duesPKR, row.unpaidPKR);
  assert.equal(view.billedCount, row.billedCount);
  assert.equal(view.paidCount, row.paidCount);
  assert.equal(view.paidPct, row.paidPct);
  assert.equal(view.freeCount, row.freeCount);
  assert.equal(view.customerCount, row.count);
});

test('paidPct is null when nobody is billed for the month', () => {
  const { customers, allocations } = fixture();
  const view = buildAreaOperationsView({ customers, allocations, currentMonth: '2026-12', area: 'Bani', todayStr: '2026-11-10' });
  assert.equal(view.billedCount, 0);
  assert.equal(view.paidPct, null);
});

test('defaulters are ranked, carry unpaid months and risk, and exclude free and settled', () => {
  const view = baniiView();
  assert.equal(view.defaulterCount, 2);
  const [first, second] = view.defaulters;
  assert.equal(first.name, 'Aamir');
  assert.equal(first.totalOutstandingPKR, 7000);
  assert.equal(first.unpaidMonthsCount, 2);
  assert.equal(first.oldestDueDate, '2026-10-05');
  assert.equal(first.oldestOverdueDays, 36);
  assert.equal(first.riskCategory, 'high');
  assert.equal(second.name, 'Bilal');
  assert.equal(second.totalOutstandingPKR, 2000);
  assert.equal(second.oldestOverdueDays, 66);
  assert.equal(second.riskCategory, 'critical');
  assert.ok(!view.defaulters.some((row) => row.name === 'Free Connection'));
});

test('defaulter risk thresholds: 3 months, 60 days, 30 days, moderate', () => {
  const customers = [
    { id: 'r1', customerNumber: 1, name: 'Three Months', mohalla: 'Bani', bills: [
      { month: '2026-08', dueDate: '2026-08-05', payments: [] },
      { month: '2026-09', dueDate: '2026-09-05', payments: [] },
      { month: '2026-10', dueDate: '2026-10-05', payments: [] },
    ] },
    { id: 'r2', customerNumber: 2, name: 'Sixty Days', mohalla: 'Bani', bills: [
      { month: '2026-09', dueDate: '2026-09-05', payments: [] },
    ] },
    { id: 'r3', customerNumber: 3, name: 'Thirty Days', mohalla: 'Bani', bills: [
      { month: '2026-10', dueDate: '2026-10-05', payments: [] },
    ] },
    { id: 'r4', customerNumber: 4, name: 'Fresh', mohalla: 'Bani', bills: [
      { month: '2026-11', dueDate: '2026-11-05', payments: [] },
    ] },
  ];
  const allocations = stubAllocations({
    'r1|2026-08': { balanceDueCents: 100000, billAmountCents: 100000 },
    'r1|2026-09': { balanceDueCents: 100000, billAmountCents: 100000 },
    'r1|2026-10': { balanceDueCents: 100000, billAmountCents: 100000 },
    'r2|2026-09': { balanceDueCents: 100000, billAmountCents: 100000 },
    'r3|2026-10': { balanceDueCents: 100000, billAmountCents: 100000 },
    'r4|2026-11': { balanceDueCents: 100000, billAmountCents: 100000 },
  });
  const view = buildAreaOperationsView({ customers, allocations, currentMonth: '2026-11', area: 'Bani', todayStr: '2026-11-10' });
  const byName = new Map(view.defaulters.map((row) => [row.name, row]));
  assert.equal(byName.get('Three Months').riskCategory, 'critical');
  assert.equal(byName.get('Sixty Days').riskCategory, 'critical');
  assert.equal(byName.get('Thirty Days').riskCategory, 'high');
  assert.equal(byName.get('Fresh').riskCategory, 'moderate');
});

test('promises are overdue-first with age bands; future and invalid promises handled', () => {
  const view = baniiView();
  assert.equal(view.promiseCount, 2);
  const [first, second] = view.promises;
  assert.equal(first.name, 'Bilal');
  assert.equal(first.overdueDays, 9);
  assert.equal(first.ageBand, '8-14');
  assert.equal(first.isOverdue, true);
  assert.equal(second.name, 'Future Promise');
  assert.equal(second.overdueDays, 0);
  assert.equal(second.ageBand, null);
  assert.equal(second.isOverdue, false);
  assert.ok(!view.promises.some((row) => row.name === 'Bad Promise'));
  assert.equal(view.promisedPKR, 1500);
});

test('collections count only non-voided payments dated in the month', () => {
  const view = baniiView();
  assert.equal(view.collectionsPKR, 3500);
  assert.equal(view.collectionReceiptCount, 2);
});

test('view build does not mutate its inputs', () => {
  const { customers, allocations } = fixture();
  const before = JSON.stringify(customers);
  buildAreaOperationsView({ customers, allocations, currentMonth: '2026-11', area: 'Bani', todayStr: '2026-11-10' });
  assert.equal(JSON.stringify(customers), before);
});

test('view HTML escapes names and shows empty states', () => {
  const { allocations } = fixture();
  const customers = [{ id: 'x1', customerNumber: 9, name: '<script>alert(1)</script>', mohalla: 'Bani', bills: [
    { month: '2026-11', dueDate: '2026-11-05', payments: [] },
  ] }];
  const view = buildAreaOperationsView({ customers, allocations: stubAllocations({ 'x1|2026-11': { balanceDueCents: 100000, billAmountCents: 100000 } }), currentMonth: '2026-11', area: 'Bani', todayStr: '2026-11-10' });
  const html = areaOperationsViewHtml(view);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.match(html, /No promises recorded/);
  const empty = buildAreaOperationsView({ customers: [], allocations, currentMonth: '2026-11', area: 'Bani', todayStr: '2026-11-10' });
  assert.match(areaOperationsViewHtml(empty), /No defaulters in this area/);
});
