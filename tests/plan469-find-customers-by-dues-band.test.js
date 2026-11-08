// Plan 469 — Find customers by dues band: one filter on the fast
// customer search sheet (owes nothing, up to Rs 1,000, Rs 1,001–
// 2,000, over Rs 2,000) that lists exactly the customers whose dues
// fall inside the chosen band, with name, mohalla, and dues in PKR
// — and never changes any record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DUES_BAND_FILTERS,
  normalizeDuesBandFilter,
  duesBandFilterLabel,
  duesBandForCents,
  duesBandFilterMatches,
  filterCustomersByDuesBand,
  duesBandTotalCents,
} from '../dues-band-filter.js';
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
// family, never real customer data. Dues are the allocation
// engine's balances, exactly as the Plan 452 fixtures compute them.
function customers() {
  return [
    // #101 owes nothing: November bill fully paid.
    { id: 'seed-001', name: 'Raja One', customerNumber: 101, phone: '03012345678', mohalla: 'Mohalla Bani', addedOn: '2026-08-15', bills: [bill('2026-11', 1500, '2026-11-10', [payment('p1', 1500, '2026-11-05')])] },
    // #102 owes Rs 1,500: November bill unpaid, due 10 Nov.
    { id: 'seed-002', name: 'Rani Two', customerNumber: 102, phone: '03012345679', mohalla: 'Mohalla Bani', addedOn: '2026-09-01', bills: [bill('2026-11', 1500, '2026-11-10')] },
    // #103 owes exactly Rs 2,000: October bill unpaid, due 10 Oct.
    { id: 'seed-003', name: 'Sara Three', customerNumber: 103, phone: '03012345670', mohalla: 'Mohalla Dhok', addedOn: '2026-09-20', bills: [bill('2026-10', 2000, '2026-10-10')] },
    // #104 owes exactly Rs 1,000: October bill unpaid.
    { id: 'seed-004', name: 'Ali Four', customerNumber: 104, phone: '03012345671', mohalla: 'Mohalla Bani', addedOn: '2026-07-11', bills: [bill('2026-10', 1000, '2026-10-10')] },
    // #105 owes Rs 1,500: November bill unpaid.
    { id: 'seed-005', name: 'Bilal Five', customerNumber: 105, phone: '03012345672', mohalla: 'Mohalla Bani', addedOn: '2026-11-03', bills: [bill('2026-11', 1500, '2026-11-10')] },
    // #106 owes nothing: added 1 Nov, no bills at all.
    { id: 'seed-006', name: 'Hina Six', customerNumber: 106, phone: '03012345673', mohalla: 'Mohalla Bani', addedOn: '2026-11-01', bills: [] },
    // #107 owes Rs 1,500: November bill half paid (2000 − 500).
    { id: 'seed-007', name: 'Omar Seven', customerNumber: 107, phone: '03012345674', mohalla: 'Mohalla Bani', addedOn: '2026-10-02', bills: [bill('2026-11', 2000, '2026-11-10', [payment('p7', 500, '2026-11-06')])] },
    // #108 owes Rs 1,200: November bill unpaid, due today.
    { id: 'seed-008', name: 'Nadia Eight', customerNumber: 108, phone: '03012345675', mohalla: 'Mohalla Bani', addedOn: '2026-08-30', bills: [bill('2026-11', 1200, '2026-11-07')] },
    // #109 owes exactly Rs 1,000: October bill, no explicit due date.
    { id: 'seed-009', name: 'Zaid Nine', customerNumber: 109, phone: '03012345676', mohalla: 'Mohalla Dhok', addedOn: '2026-06-14', bills: [{ month: '2026-10', dueAmount: 1000, status: 'pending', payments: [] }] },
    // #110 owes Rs 2,500: November bill unpaid — the big due.
    { id: 'seed-010', name: 'Tariq Ten', customerNumber: 110, phone: '03012345677', mohalla: 'Mohalla Bani', addedOn: '2026-05-12', bills: [bill('2026-11', 2500, '2026-11-10')] },
    // #111 owes Rs 1,000.50: a half-rupee above Rs 1,000.
    { id: 'seed-011', name: 'Meena Eleven', customerNumber: 111, phone: '03012345670', mohalla: 'Mohalla Dhok', addedOn: '2026-04-08', bills: [bill('2026-11', 1000.5, '2026-11-10')] },
  ];
}

function sheetState() {
  return {
    customers: customers().map((customer) => ({ ...customer, area: customer.mohalla, archived: false })),
  };
}

function context() {
  return { allocations: calculatePaymentAllocations(sheetState()) };
}

test('the filter normalizes: unknown or blank means the full list', () => {
  assert.equal(normalizeDuesBandFilter('none'), 'none');
  assert.equal(normalizeDuesBandFilter('UP-TO-1000'), 'up-to-1000');
  assert.equal(normalizeDuesBandFilter('  1001-2000 '), '1001-2000');
  assert.equal(normalizeDuesBandFilter('over-2000'), 'over-2000');
  assert.equal(normalizeDuesBandFilter('bogus'), 'all');
  assert.equal(normalizeDuesBandFilter(''), 'all');
  assert.equal(normalizeDuesBandFilter(null), 'all');
  assert.equal(normalizeDuesBandFilter(undefined), 'all');
  assert.deepEqual(DUES_BAND_FILTERS, ['none', 'up-to-1000', '1001-2000', 'over-2000']);
});

test('labels are the words the sheet shows', () => {
  assert.equal(duesBandFilterLabel('none'), 'Owes nothing');
  assert.equal(duesBandFilterLabel('up-to-1000'), 'Up to Rs 1,000');
  assert.equal(duesBandFilterLabel('1001-2000'), 'Rs 1,001–2,000');
  assert.equal(duesBandFilterLabel('over-2000'), 'Over Rs 2,000');
  assert.equal(duesBandFilterLabel('all'), 'All');
  assert.equal(duesBandFilterLabel('bogus'), 'All');
});

test('band edges are exact cents: Rs 1,000 and Rs 2,000 sit in the lower band', () => {
  assert.equal(duesBandForCents(0), 'none');
  assert.equal(duesBandForCents(-5000), 'none');
  assert.equal(duesBandForCents(1), 'up-to-1000');
  assert.equal(duesBandForCents(100000), 'up-to-1000');
  assert.equal(duesBandForCents(100001), '1001-2000');
  assert.equal(duesBandForCents(200000), '1001-2000');
  assert.equal(duesBandForCents(200001), 'over-2000');
  // A half-rupee above Rs 1,000 is not in the up-to-1000 band.
  assert.equal(duesBandForCents(100050), '1001-2000');
  assert.equal(duesBandForCents(null), 'none');
  assert.equal(duesBandForCents(undefined), 'none');
  assert.equal(duesBandForCents('1500'), 'none');
  assert.equal(duesBandForCents(NaN), 'none');
});

test('each band lists exactly its customers', () => {
  const list = customers();
  const ctx = context();
  const numbers = (filter) => filterCustomersByDuesBand(list, filter, ctx).map((c) => c.customerNumber);
  assert.deepEqual(numbers('none'), [101, 106]);
  assert.deepEqual(numbers('up-to-1000'), [104, 109]);
  assert.deepEqual(numbers('1001-2000'), [102, 103, 105, 107, 108, 111]);
  assert.deepEqual(numbers('over-2000'), [110]);
  assert.deepEqual(numbers('all'), [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]);
  // Unknown filter is the full list.
  assert.deepEqual(numbers('bogus'), [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]);
  // The boundary customers sit in the lower band, never the higher one.
  assert.equal(duesBandFilterMatches(list[3], 'up-to-1000', ctx), true);
  assert.equal(duesBandFilterMatches(list[3], '1001-2000', ctx), false);
  assert.equal(duesBandFilterMatches(list[2], '1001-2000', ctx), true);
  assert.equal(duesBandFilterMatches(list[2], 'over-2000', ctx), false);
  // The half-rupee due sits above Rs 1,000.
  assert.equal(duesBandFilterMatches(list[10], '1001-2000', ctx), true);
  assert.equal(duesBandFilterMatches(list[10], 'up-to-1000', ctx), false);
  assert.equal(duesBandFilterMatches(null, 'over-2000', ctx), false);
  assert.deepEqual(filterCustomersByDuesBand(null, 'over-2000', ctx), []);
  assert.deepEqual(filterCustomersByDuesBand('not-a-list', 'over-2000', ctx), []);
});

test('the band total equals the sum of the listed dues, in cents', () => {
  const list = customers();
  const ctx = context();
  assert.equal(duesBandTotalCents(list, 'none', ctx), 0);
  assert.equal(duesBandTotalCents(list, 'up-to-1000', ctx), 200000);
  assert.equal(duesBandTotalCents(list, '1001-2000', ctx), 870050);
  assert.equal(duesBandTotalCents(list, 'over-2000', ctx), 250000);
  assert.equal(duesBandTotalCents(list, 'all', ctx), 1320050);
  // A band with nobody in it totals zero, never a blank.
  assert.equal(duesBandTotalCents(list.slice(0, 9), 'over-2000', ctx), 0);
  assert.equal(duesBandTotalCents(null, 'over-2000', ctx), 0);
  // The total agrees with the listed dues customer by customer:
  // totalling the listed customers on their own gives the same sum.
  const listed = filterCustomersByDuesBand(list, '1001-2000', ctx);
  assert.equal(duesBandTotalCents(listed, 'all', ctx), 870050);
});

test('the sheet: each band lists exactly its customers', () => {
  const state = sheetState();
  const numbers = (options) => searchFastCustomers(state, options, REF_DATE).map((c) => c.customerNumber);
  // The sheet sorts by dues first, then customer number — so the
  // 1001-2000 band reads Rs 2,000 first, then the Rs 1,500s in
  // number order, then Rs 1,200, then Rs 1,000.50.
  assert.deepEqual(numbers({ duesBand: 'none' }), [101, 106]);
  assert.deepEqual(numbers({ duesBand: 'up-to-1000' }), [104, 109]);
  assert.deepEqual(numbers({ duesBand: '1001-2000' }), [103, 102, 105, 107, 108, 111]);
  assert.deepEqual(numbers({ duesBand: 'over-2000' }), [110]);
  assert.deepEqual(numbers({ duesBand: 'all' }).length, 11);
  assert.deepEqual(numbers({}).length, 11);
});

test('the sheet: the band composes with the billing chips, the query, the mohalla, and the status filter', () => {
  const state = sheetState();
  const suspended = ['seed-004'];
  // Partial-paid this month AND in the 1001-2000 band: only #107.
  assert.deepEqual(
    searchFastCustomers(state, { statusFilter: 'partial', duesBand: '1001-2000', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber),
    [107],
  );
  // Name query AND the over-2000 band: only #110.
  assert.deepEqual(
    searchFastCustomers(state, { query: 'tariq', duesBand: 'over-2000', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber),
    [110],
  );
  // Mohalla Dhok AND the 1001-2000 band: #103 and #111.
  assert.deepEqual(
    searchFastCustomers(state, { duesBand: '1001-2000', mohalla: 'Mohalla Dhok', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber).sort((a, b) => a - b),
    [103, 111],
  );
  // Overdue AND the up-to-1000 band: #104 and #109.
  assert.deepEqual(
    searchFastCustomers(state, { customerStatus: 'overdue', duesBand: 'up-to-1000', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber).sort((a, b) => a - b),
    [104, 109],
  );
  // Paid up AND owes nothing: #101 and #106.
  assert.deepEqual(
    searchFastCustomers(state, { customerStatus: 'paid-up', duesBand: 'none', suspendedCustomerIds: suspended }, REF_DATE)
      .map((c) => c.customerNumber),
    [101, 106],
  );
});

test('the sheet: an exact-ID hit still has to pass the band', () => {
  const state = sheetState();
  // #110 owes Rs 2,500 — no exact hit under the up-to-1000 band.
  assert.deepEqual(
    searchFastCustomers(state, { query: '110', duesBand: 'up-to-1000' }, REF_DATE),
    [],
  );
  // Under its own band the exact hit stands alone.
  assert.deepEqual(
    searchFastCustomers(state, { query: '110', duesBand: 'over-2000' }, REF_DATE)
      .map((c) => c.customerNumber),
    [110],
  );
});

test('the sheet: an archived customer is never listed, in any band', () => {
  const state = sheetState();
  state.customers[9].archived = true;
  assert.deepEqual(
    searchFastCustomers(state, { duesBand: 'over-2000' }, REF_DATE),
    [],
  );
});

test('the sheet: filtered cards show name, mohalla, and dues in PKR', () => {
  const state = sheetState();
  const results = searchFastCustomers(state, { duesBand: 'over-2000' }, REF_DATE);
  const html = renderFastCustomerSearchResultsHtml(results);
  assert.ok(html.includes('Tariq Ten'));
  assert.ok(html.includes('Mohalla Bani'));
  assert.ok(html.includes('PKR 2,500'));
  const empty = renderFastCustomerSearchResultsHtml(
    searchFastCustomers(state, { duesBand: 'over-2000', mohalla: 'Mohalla Dhok' }, REF_DATE),
  );
  assert.ok(empty.includes('No matching customers found'));
});

test('wiring: the sheet imports the band filter and the chips carry the band', () => {
  const sheet = readFileSync(new URL('../nav-customer-search.js', import.meta.url), 'utf8');
  assert.ok(sheet.includes("from './dues-band-filter.js'"), 'sheet imports the Plan 469 module');
  assert.ok(sheet.includes('duesBandFilterMatches(customer, duesBand,'), 'filter is applied in searchFastCustomers');
  assert.ok(sheet.includes("modal.querySelectorAll('#fcsDuesBandChips .fcs-status-chip')"), 'band chips are wired separately');
  assert.ok(sheet.includes('data-dues-band'), 'band chips carry their own data attribute');
  assert.ok(sheet.includes('duesBand: activeDuesBand'), 'the modal passes the chosen band into the search');
  assert.ok(sheet.includes("modal.querySelectorAll('#fcsBillingChips .fcs-status-chip')"), 'billing chips stay scoped to their row');
  assert.ok(sheet.includes("modal.querySelectorAll('#fcsAccountChips .fcs-status-chip')"), 'account chips stay scoped to their row');
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="fcsDuesBandChips"'), 'band chip row exists in the sheet');
  assert.ok(page.includes('id="fcsBillingChips"'), 'billing chip row is scoped');
  assert.ok(page.includes('id="fcsAccountChips"'), 'account chip row is scoped');
  for (const band of ['all', 'none', 'up-to-1000', '1001-2000', 'over-2000']) {
    assert.ok(page.includes(`data-dues-band="${band}"`), `chip for ${band} exists`);
  }
  assert.ok(page.includes('Up to Rs 1,000'), 'up-to-1000 chip label exists');
  assert.ok(page.includes('Over Rs 2,000'), 'over-2000 chip label exists');
});

test('the new module names no fenced module file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../dues-band-filter.js', import.meta.url), 'utf8');
  assert.equal(module.includes('customer-search-filter.js'), false);
  assert.equal(module.includes('nav-customer-search.js'), false);
  assert.equal(module.includes('fuzzy-alias-search.js'), false);
  assert.equal(module.includes('customer-id-lookup.js'), false);
  assert.equal(module.includes('partial-phone-search.js'), false);
  assert.equal(module.includes('suspension-records.js'), false);
  assert.equal(module.includes('localStorage'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});
