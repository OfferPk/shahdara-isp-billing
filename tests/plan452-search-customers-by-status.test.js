// Plan 452 — Search customers by status: one filter on the fast
// customer search sheet (paid up, due, overdue, suspended, new)
// that lists exactly the customers in the chosen state, with name,
// mohalla, and dues — and never changes any record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CUSTOMER_STATUS_FILTERS,
  normalizeCustomerStatusFilter,
  customerStatusFilterLabel,
  customerStatusDuesCents,
  customerHasOverdueBill,
  customerIsSuspended,
  customerIsNew,
  customerStatusFilterMatches,
  filterCustomersByStatus,
} from '../customer-status-filter.js';
import {
  searchFastCustomers,
  renderFastCustomerSearchResultsHtml,
} from '../nav-customer-search.js';
import { calculatePaymentAllocations } from '../core.js';

const REF_DATE = new Date('2026-11-07T10:00:00Z');
const CURRENT_MONTH = '2026-11';

function bill(month, dueAmount, dueDate, payments = []) {
  return { month, dueAmount, dueDate, status: 'pending', payments };
}

function payment(id, amount, date) {
  return { id, amount, date };
}

// Generic fixtures only — pattern-fake numbers from the 03012345678
// family, never real customer data.
function customers() {
  return [
    // #101 paid up: November bill fully paid.
    { id: 'seed-001', name: 'Raja One', customerNumber: 101, phone: '03012345678', mohalla: 'Mohalla Bani', addedOn: '2026-08-15', bills: [bill('2026-11', 1500, '2026-11-10', [payment('p1', 1500, '2026-11-05')])] },
    // #102 due: November bill unpaid, due 10 Nov — not past due yet.
    { id: 'seed-002', name: 'Rani Two', customerNumber: 102, phone: '03012345679', mohalla: 'Mohalla Bani', addedOn: '2026-09-01', bills: [bill('2026-11', 1500, '2026-11-10')] },
    // #103 overdue: October bill unpaid, due 10 Oct.
    { id: 'seed-003', name: 'Sara Three', customerNumber: 103, phone: '03012345670', mohalla: 'Mohalla Dhok', addedOn: '2026-09-20', bills: [bill('2026-10', 2000, '2026-10-10')] },
    // #104 suspended AND overdue: October bill unpaid, open suspension.
    { id: 'seed-004', name: 'Ali Four', customerNumber: 104, phone: '03012345671', mohalla: 'Mohalla Bani', addedOn: '2026-07-11', bills: [bill('2026-10', 1000, '2026-10-10')] },
    // #105 new AND due: added 3 Nov, November bill unpaid.
    { id: 'seed-005', name: 'Bilal Five', customerNumber: 105, phone: '03012345672', mohalla: 'Mohalla Bani', addedOn: '2026-11-03', bills: [bill('2026-11', 1500, '2026-11-10')] },
    // #106 new AND paid up: added 1 Nov, no bills at all.
    { id: 'seed-006', name: 'Hina Six', customerNumber: 106, phone: '03012345673', mohalla: 'Mohalla Bani', addedOn: '2026-11-01', bills: [] },
    // #107 partial and due: November bill half paid, due 10 Nov.
    { id: 'seed-007', name: 'Omar Seven', customerNumber: 107, phone: '03012345674', mohalla: 'Mohalla Bani', addedOn: '2026-10-02', bills: [bill('2026-11', 2000, '2026-11-10', [payment('p7', 500, '2026-11-06')])] },
    // #108 due, not overdue: bill due today, 7 Nov.
    { id: 'seed-008', name: 'Nadia Eight', customerNumber: 108, phone: '03012345675', mohalla: 'Mohalla Bani', addedOn: '2026-08-30', bills: [bill('2026-11', 1200, '2026-11-07')] },
    // #109 overdue with no explicit due date: October bill falls back
    // to the 10th of its month.
    { id: 'seed-009', name: 'Zaid Nine', customerNumber: 109, phone: '03012345676', mohalla: 'Mohalla Dhok', addedOn: '2026-06-14', bills: [{ month: '2026-10', dueAmount: 1000, status: 'pending', payments: [] }] },
  ];
}

function sheetState() {
  return {
    customers: customers().map((customer) => ({ ...customer, area: customer.mohalla, archived: false })),
  };
}

function context() {
  return {
    allocations: calculatePaymentAllocations(sheetState()),
    suspendedCustomerIds: ['seed-004'],
    currentMonth: CURRENT_MONTH,
    referenceDate: REF_DATE,
  };
}

test('the filter normalizes: unknown or blank means the full list', () => {
  assert.equal(normalizeCustomerStatusFilter('due'), 'due');
  assert.equal(normalizeCustomerStatusFilter('PAID-UP'), 'paid-up');
  assert.equal(normalizeCustomerStatusFilter('  overdue '), 'overdue');
  assert.equal(normalizeCustomerStatusFilter('suspended'), 'suspended');
  assert.equal(normalizeCustomerStatusFilter('new'), 'new');
  assert.equal(normalizeCustomerStatusFilter('bogus'), 'all');
  assert.equal(normalizeCustomerStatusFilter(''), 'all');
  assert.equal(normalizeCustomerStatusFilter(null), 'all');
  assert.equal(normalizeCustomerStatusFilter(undefined), 'all');
  assert.deepEqual(CUSTOMER_STATUS_FILTERS, ['paid-up', 'due', 'overdue', 'suspended', 'new']);
});

test('labels are the words the sheet shows', () => {
  assert.equal(customerStatusFilterLabel('paid-up'), 'Paid up');
  assert.equal(customerStatusFilterLabel('due'), 'Due');
  assert.equal(customerStatusFilterLabel('overdue'), 'Overdue');
  assert.equal(customerStatusFilterLabel('suspended'), 'Suspended');
  assert.equal(customerStatusFilterLabel('new'), 'New');
  assert.equal(customerStatusFilterLabel('all'), 'All');
  assert.equal(customerStatusFilterLabel('bogus'), 'All');
});

test('dues are the allocation engine balances, in cents', () => {
  const list = customers();
  const allocations = calculatePaymentAllocations(sheetState());
  assert.equal(customerStatusDuesCents(list[0], allocations), 0);
  assert.equal(customerStatusDuesCents(list[1], allocations), 150000);
  assert.equal(customerStatusDuesCents(list[2], allocations), 200000);
  assert.equal(customerStatusDuesCents(list[5], allocations), 0);
  assert.equal(customerStatusDuesCents(list[6], allocations), 150000);
  assert.equal(customerStatusDuesCents(null, allocations), 0);
  assert.equal(customerStatusDuesCents(list[1], null), 0);
});

test('overdue means a balance past its due date — today is due, not overdue', () => {
  const list = customers();
  const allocations = calculatePaymentAllocations(sheetState());
  assert.equal(customerHasOverdueBill(list[0], allocations, REF_DATE), false);
  assert.equal(customerHasOverdueBill(list[1], allocations, REF_DATE), false);
  assert.equal(customerHasOverdueBill(list[2], allocations, REF_DATE), true);
  assert.equal(customerHasOverdueBill(list[3], allocations, REF_DATE), true);
  // Due today: the day has not passed yet.
  assert.equal(customerHasOverdueBill(list[7], allocations, REF_DATE), false);
  // No explicit due date: the 10th of the bill month.
  assert.equal(customerHasOverdueBill(list[8], allocations, REF_DATE), true);
  // A fully paid October bill is never overdue.
  const paidOld = { id: 'seed-090', bills: [bill('2026-10', 1000, '2026-10-10', [payment('p9', 1000, '2026-10-09')])] };
  assert.equal(customerHasOverdueBill(paidOld, calculatePaymentAllocations({ customers: [paidOld] }), REF_DATE), false);
  assert.equal(customerHasOverdueBill(null, allocations, REF_DATE), false);
});

test('suspended means an open suspension id, list or Set', () => {
  const list = customers();
  assert.equal(customerIsSuspended(list[3], ['seed-004']), true);
  assert.equal(customerIsSuspended(list[3], new Set(['seed-004'])), true);
  assert.equal(customerIsSuspended(list[2], ['seed-004']), false);
  assert.equal(customerIsSuspended(list[3], []), false);
  assert.equal(customerIsSuspended(list[3], null), false);
  assert.equal(customerIsSuspended(list[3], 'seed-004'), false);
  assert.equal(customerIsSuspended(null, ['seed-004']), false);
});

test('new means added in the current month', () => {
  const list = customers();
  assert.equal(customerIsNew(list[4], CURRENT_MONTH), true);
  assert.equal(customerIsNew(list[5], CURRENT_MONTH), true);
  assert.equal(customerIsNew(list[0], CURRENT_MONTH), false);
  assert.equal(customerIsNew(list[1], CURRENT_MONTH), false);
  assert.equal(customerIsNew({ id: 'seed-091' }, CURRENT_MONTH), false);
  assert.equal(customerIsNew(list[4], '2026-10'), false);
  assert.equal(customerIsNew(list[4], 'bogus'), false);
  assert.equal(customerIsNew(list[4], ''), false);
  assert.equal(customerIsNew(null, CURRENT_MONTH), false);
});

test('each state lists exactly its customers — and a customer can hold two states', () => {
  const list = customers();
  const ctx = context();
  const numbers = (filter) => filterCustomersByStatus(list, filter, ctx).map((c) => c.customerNumber);
  assert.deepEqual(numbers('paid-up'), [101, 106]);
  assert.deepEqual(numbers('due'), [102, 105, 107, 108]);
  assert.deepEqual(numbers('overdue'), [103, 104, 109]);
  assert.deepEqual(numbers('suspended'), [104]);
  assert.deepEqual(numbers('new'), [105, 106]);
  assert.deepEqual(numbers('all'), [101, 102, 103, 104, 105, 106, 107, 108, 109]);
  // Unknown filter is the full list.
  assert.deepEqual(numbers('bogus'), [101, 102, 103, 104, 105, 106, 107, 108, 109]);
  // States are independent: #104 is both suspended and overdue, #105
  // is both new and due, #106 is both new and paid up.
  assert.equal(customerStatusFilterMatches(list[3], 'suspended', ctx), true);
  assert.equal(customerStatusFilterMatches(list[3], 'overdue', ctx), true);
  assert.equal(customerStatusFilterMatches(list[3], 'paid-up', ctx), false);
  assert.equal(customerStatusFilterMatches(list[4], 'new', ctx), true);
  assert.equal(customerStatusFilterMatches(list[4], 'due', ctx), true);
  assert.equal(customerStatusFilterMatches(list[4], 'overdue', ctx), false);
  assert.equal(customerStatusFilterMatches(null, 'due', ctx), false);
  assert.deepEqual(filterCustomersByStatus(null, 'due', ctx), []);
  assert.deepEqual(filterCustomersByStatus('not-a-list', 'due', ctx), []);
});

test('the sheet: each status filter lists exactly its customers', () => {
  const state = sheetState();
  const suspended = ['seed-004'];
  const numbers = (options) => searchFastCustomers(state, { ...options, suspendedCustomerIds: suspended }, REF_DATE)
    .map((c) => c.customerNumber);
  assert.deepEqual(numbers({ customerStatus: 'paid-up' }), [101, 106]);
  assert.deepEqual(numbers({ customerStatus: 'due' }).sort((a, b) => a - b), [102, 105, 107, 108]);
  assert.deepEqual(numbers({ customerStatus: 'overdue' }).sort((a, b) => a - b), [103, 104, 109]);
  assert.deepEqual(numbers({ customerStatus: 'suspended' }), [104]);
  assert.deepEqual(numbers({ customerStatus: 'new' }), [105, 106]);
  assert.deepEqual(numbers({ customerStatus: 'all' }).length, 9);
  assert.deepEqual(numbers({}).length, 9);
});

test('the sheet: without suspension ids the suspended state matches nobody', () => {
  const state = sheetState();
  assert.deepEqual(
    searchFastCustomers(state, { customerStatus: 'suspended' }, REF_DATE).map((c) => c.customerNumber),
    [],
  );
});

test('the sheet: the status filter composes with the billing chips, the query, and the mohalla', () => {
  const state = sheetState();
  const suspended = ['seed-004'];
  // Partial-paid this month AND due: only #107.
  assert.deepEqual(
    searchFastCustomers(state, { statusFilter: 'partial', customerStatus: 'due', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber),
    [107],
  );
  // Settled this month AND paid up: only #101 (#106 has no bill).
  assert.deepEqual(
    searchFastCustomers(state, { statusFilter: 'paid', customerStatus: 'paid-up', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber),
    [101],
  );
  // Name query AND the new state: only #105.
  assert.deepEqual(
    searchFastCustomers(state, { query: 'five', customerStatus: 'new', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber),
    [105],
  );
  // Mohalla Dhok AND overdue: #103 and #109.
  assert.deepEqual(
    searchFastCustomers(state, { customerStatus: 'overdue', mohalla: 'Mohalla Dhok', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber).sort((a, b) => a - b),
    [103, 109],
  );
});

test('the sheet: an exact-ID hit still has to pass the status filter', () => {
  const state = sheetState();
  const suspended = ['seed-004'];
  // #104 is overdue, not paid up — no exact hit under paid-up.
  assert.deepEqual(
    searchFastCustomers(state, { query: '104', customerStatus: 'paid-up', suspendedCustomerIds: suspended }, REF_DATE),
    [],
  );
  // Under its own state the exact hit stands alone.
  assert.deepEqual(
    searchFastCustomers(state, { query: '104', customerStatus: 'suspended', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber),
    [104],
  );
});

test('the sheet: an archived customer is never listed, in any state', () => {
  const state = sheetState();
  state.customers[1].archived = true;
  assert.deepEqual(
    searchFastCustomers(state, { customerStatus: 'due', suspendedCustomerIds: ['seed-004'] }, REF_DATE)
      .map((c) => c.customerNumber).sort((a, b) => a - b),
    [105, 107, 108],
  );
});

test('the sheet: filtered cards show name, mohalla, and dues in PKR', () => {
  const state = sheetState();
  const results = searchFastCustomers(state, { customerStatus: 'overdue', suspendedCustomerIds: ['seed-004'] }, REF_DATE);
  const html = renderFastCustomerSearchResultsHtml(results);
  assert.ok(html.includes('Sara Three'));
  assert.ok(html.includes('Mohalla Dhok'));
  assert.ok(html.includes('PKR 2,000'));
  assert.ok(html.includes('Ali Four'));
  const empty = renderFastCustomerSearchResultsHtml(
    searchFastCustomers(state, { customerStatus: 'suspended' }, REF_DATE),
  );
  assert.ok(empty.includes('No matching customers found'));
});

test('wiring: the sheet imports the status filter and the modal passes the open suspensions', () => {
  const sheet = readFileSync(new URL('../nav-customer-search.js', import.meta.url), 'utf8');
  assert.ok(sheet.includes("from './customer-status-filter.js'"), 'sheet imports the Plan 452 module');
  assert.ok(sheet.includes('customerStatusFilterMatches(customer, customerStatus,'), 'filter is applied in searchFastCustomers');
  assert.ok(sheet.includes('getSuspendedCustomerIds'), 'modal accepts the suspension ids supplier');
  assert.ok(sheet.includes("modal.querySelectorAll('#fcsAccountChips .fcs-status-chip')"), 'account chips are wired separately');
  assert.ok(sheet.includes('data-account-status'), 'account chips carry their own data attribute');
  assert.ok(sheet.includes("modal.querySelectorAll('#fcsBillingChips .fcs-status-chip')"), 'billing chips stay scoped to their row');
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="fcsAccountChips"'), 'account chip row exists in the sheet');
  assert.ok(page.includes('id="fcsBillingChips"'), 'billing chip row is scoped');
  for (const state of ['paid-up', 'due', 'overdue', 'suspended', 'new']) {
    assert.ok(page.includes(`data-account-status="${state}"`), `chip for ${state} exists`);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('getSuspendedCustomerIds: () => loadSuspensions()'), 'app passes the open suspensions');
  assert.ok(app.includes("s?.status === 'open'"), 'only open suspensions count');
});

test('the new module names no fenced module file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../customer-status-filter.js', import.meta.url), 'utf8');
  assert.equal(module.includes('customer-search-filter.js'), false);
  assert.equal(module.includes('nav-customer-search.js'), false);
  assert.equal(module.includes('fuzzy-alias-search.js'), false);
  assert.equal(module.includes('customer-id-lookup.js'), false);
  assert.equal(module.includes('partial-phone-search.js'), false);
  assert.equal(module.includes('suspension-records.js'), false);
  assert.equal(module.includes('localStorage'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches the dues-aging helper parseBillDueDate,
  // which is a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});
