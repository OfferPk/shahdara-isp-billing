import test from 'node:test';
import assert from 'node:assert/strict';

import {
  archivedRosterPage,
  buildRetentionView,
  retentionYearCsv,
  retentionViewHtml,
} from '../roster-scale.js';
import { paginateRows } from '../form-validation.js';

const archived = (ids) => ids.map((id) => ({ id, customerNumber: id, name: `C${id}` }));

// ---- archivedRosterPage ----

test('archived page 1 slices the first page', () => {
  const paged = archivedRosterPage(archived([1, 2, 3, 4, 5]), 1, 2);
  assert.deepEqual(paged.items.map((c) => c.id), [1, 2]);
  assert.equal(paged.page, 1);
  assert.equal(paged.totalPages, 3);
  assert.equal(paged.totalItems, 5);
});

test('archived page 2 slices the second page', () => {
  const paged = archivedRosterPage(archived([1, 2, 3, 4, 5]), 2, 2);
  assert.deepEqual(paged.items.map((c) => c.id), [3, 4]);
});

test('archived last page holds only the remainder', () => {
  const paged = archivedRosterPage(archived([1, 2, 3, 4, 5]), 3, 2);
  assert.deepEqual(paged.items.map((c) => c.id), [5]);
  assert.equal(paged.startIndex, 4);
  assert.equal(paged.endIndex, 5);
});

test('archived page beyond the end clamps to the last page', () => {
  const paged = archivedRosterPage(archived([1, 2, 3]), 99, 2);
  assert.equal(paged.page, 2);
  assert.deepEqual(paged.items.map((c) => c.id), [3]);
});

test('archived page below 1 clamps to page 1', () => {
  const paged = archivedRosterPage(archived([1, 2, 3]), 0, 2);
  assert.equal(paged.page, 1);
  assert.deepEqual(paged.items.map((c) => c.id), [1, 2]);
});

test('archived non-numeric page clamps to page 1', () => {
  const paged = archivedRosterPage(archived([1, 2]), 'nope', 2);
  assert.equal(paged.page, 1);
});

test('archived page size all returns every row on one page', () => {
  const paged = archivedRosterPage(archived([1, 2, 3]), 1, 'all');
  assert.deepEqual(paged.items.map((c) => c.id), [1, 2, 3]);
  assert.equal(paged.totalPages, 1);
});

test('archived page size zero or negative returns every row', () => {
  assert.deepEqual(archivedRosterPage(archived([1, 2]), 1, 0).items.length, 2);
  assert.deepEqual(archivedRosterPage(archived([1, 2]), 1, -5).items.length, 2);
});

test('archived page size larger than the list returns one page', () => {
  const paged = archivedRosterPage(archived([1, 2]), 1, 60);
  assert.equal(paged.totalPages, 1);
  assert.deepEqual(paged.items.map((c) => c.id), [1, 2]);
});

test('archived empty list gives one empty page', () => {
  const paged = archivedRosterPage([], 1, 15);
  assert.deepEqual(paged.items, []);
  assert.equal(paged.totalPages, 1);
  assert.equal(paged.totalItems, 0);
});

test('archived non-array input gives an empty page, never throws', () => {
  assert.deepEqual(archivedRosterPage(null, 1, 15).items, []);
  assert.deepEqual(archivedRosterPage(undefined, 1, 15).items, []);
});

test('archived paging does not mutate the input list', () => {
  const list = archived([1, 2, 3]);
  archivedRosterPage(list, 2, 2);
  assert.deepEqual(list.map((c) => c.id), [1, 2, 3]);
});

test('archived and active pages are independent numbers', () => {
  const active = archivedRosterPage(archived([1, 2, 3, 4, 5, 6]), 2, 2);
  const archivedPage = archivedRosterPage(archived([9, 8, 7]), 1, 2);
  assert.deepEqual(active.items.map((c) => c.id), [3, 4]);
  assert.deepEqual(archivedPage.items.map((c) => c.id), [9, 8]);
});

test('archived paging agrees with paginateRows on the same inputs', () => {
  const list = archived([1, 2, 3, 4, 5, 6, 7]);
  for (const [page, size] of [[1, 3], [2, 3], [3, 3], [99, 3], [0, 3], [1, 'all'], [1, 60]]) {
    assert.deepEqual(archivedRosterPage(list, page, size), paginateRows(list, page, size));
  }
});

test('unarchive candidates on any archived page are the paged rows only', () => {
  // The render attaches unarchive buttons to the paged rows; a customer
  // on page 2 must appear when page 2 is requested, not page 1.
  const page2 = archivedRosterPage(archived([1, 2, 3, 4]), 2, 2);
  assert.deepEqual(page2.items.map((c) => c.id), [3, 4]);
  const page1 = archivedRosterPage(archived([1, 2, 3, 4]), 1, 2);
  assert.deepEqual(page1.items.map((c) => c.id), [1, 2]);
});

// ---- buildRetentionView ----

const customer = (overrides = {}) => ({
  id: 'c1', customerNumber: 1, name: 'Aamir', archived: false, archivedAt: null, bills: [], ...overrides,
});

test('empty ledger gives no years and null month bounds', () => {
  const view = buildRetentionView([]);
  assert.deepEqual(view.years, []);
  assert.equal(view.totalBillMonths, 0);
  assert.equal(view.totalPayments, 0);
  assert.equal(view.oldestMonth, null);
  assert.equal(view.newestMonth, null);
});

test('non-array ledger gives an empty view, never throws', () => {
  assert.deepEqual(buildRetentionView(null).years, []);
  assert.deepEqual(buildRetentionView(undefined).years, []);
});

test('one bill month counts in its own year', () => {
  const view = buildRetentionView([customer({ bills: [{ month: '2025-03', payments: [] }] })]);
  assert.equal(view.years.length, 1);
  assert.equal(view.years[0].year, '2025');
  assert.equal(view.years[0].billMonths, 1);
  assert.equal(view.years[0].oldestMonth, '2025-03');
  assert.equal(view.years[0].newestMonth, '2025-03');
});

test('years sort newest first', () => {
  const view = buildRetentionView([customer({
    bills: [{ month: '2024-01', payments: [] }, { month: '2026-06', payments: [] }, { month: '2025-12', payments: [] }],
  })]);
  assert.deepEqual(view.years.map((y) => y.year), ['2026', '2025', '2024']);
});

test('a customer with several bills in one year counts once for that year', () => {
  const view = buildRetentionView([customer({
    bills: [{ month: '2025-01', payments: [] }, { month: '2025-02', payments: [] }, { month: '2025-03', payments: [] }],
  })]);
  assert.equal(view.years[0].customers, 1);
  assert.equal(view.years[0].billMonths, 3);
});

test('two customers in one year count as two', () => {
  const view = buildRetentionView([
    customer({ id: 'c1', bills: [{ month: '2025-01', payments: [] }] }),
    customer({ id: 'c2', customerNumber: 2, name: 'Bilal', bills: [{ month: '2025-05', payments: [] }] }),
  ]);
  assert.equal(view.years[0].customers, 2);
});

test('payment counts in its payment date year, not its bill year', () => {
  const view = buildRetentionView([customer({
    bills: [{ month: '2025-12', payments: [{ date: '2026-01-03', amount: 100 }] }],
  })]);
  const y2025 = view.years.find((y) => y.year === '2025');
  const y2026 = view.years.find((y) => y.year === '2026');
  assert.equal(y2025.billMonths, 1);
  assert.equal(y2025.payments, 0);
  assert.equal(y2026.payments, 1);
  assert.equal(y2026.billMonths, 0);
});

test('payment without a date counts in its bill month year', () => {
  const view = buildRetentionView([customer({
    bills: [{ month: '2025-04', payments: [{ amount: 50 }] }],
  })]);
  assert.equal(view.years[0].year, '2025');
  assert.equal(view.years[0].payments, 1);
});

test('payment with a non-date string counts in its bill month year', () => {
  const view = buildRetentionView([customer({
    bills: [{ month: '2025-04', payments: [{ date: 'not-a-date', amount: 50 }] }],
  })]);
  assert.equal(view.years[0].payments, 1);
});

test('archive counts in its archivedAt year and touches that year', () => {
  const view = buildRetentionView([customer({ archived: true, archivedAt: '2024-08-15T10:00:00.000Z' })]);
  assert.equal(view.years[0].year, '2024');
  assert.equal(view.years[0].archivedCustomers, 1);
  assert.equal(view.years[0].customers, 1);
});

test('archive without a date counts nowhere', () => {
  const view = buildRetentionView([customer({ archived: true, archivedAt: null })]);
  assert.deepEqual(view.years, []);
});

test('oldest and newest months span all bill months', () => {
  const view = buildRetentionView([customer({
    bills: [{ month: '2026-01', payments: [] }, { month: '2024-11', payments: [] }],
  })]);
  assert.equal(view.oldestMonth, '2024-11');
  assert.equal(view.newestMonth, '2026-01');
});

test('per-year month range is that year only', () => {
  const view = buildRetentionView([customer({
    bills: [{ month: '2025-02', payments: [] }, { month: '2025-11', payments: [] }, { month: '2024-06', payments: [] }],
  })]);
  const y2025 = view.years.find((y) => y.year === '2025');
  assert.equal(y2025.oldestMonth, '2025-02');
  assert.equal(y2025.newestMonth, '2025-11');
});

test('invalid bill months are ignored, never crash the view', () => {
  const view = buildRetentionView([customer({
    bills: [{ month: 'junk', payments: [] }, { month: null, payments: [] }, { payments: [] }, { month: '2025-07', payments: [] }],
  })]);
  assert.equal(view.totalBillMonths, 1);
  assert.equal(view.years[0].year, '2025');
});

test('null customers and null bills are skipped', () => {
  const view = buildRetentionView([null, undefined, customer({ bills: null }), customer({ id: 'c9', bills: [{ month: '2025-01', payments: null }] })]);
  assert.equal(view.totalBillMonths, 1);
  assert.equal(view.totalCustomers, 2);
});

test('totals add up across years', () => {
  const view = buildRetentionView([customer({
    bills: [
      { month: '2024-01', payments: [{ date: '2024-01-05', amount: 1 }] },
      { month: '2025-01', payments: [{ date: '2025-01-05', amount: 1 }, { date: '2025-01-06', amount: 1 }] },
    ],
  })]);
  assert.equal(view.totalBillMonths, 2);
  assert.equal(view.totalPayments, 3);
  assert.equal(view.years.reduce((s, y) => s + y.billMonths, 0), 2);
  assert.equal(view.years.reduce((s, y) => s + y.payments, 0), 3);
});

test('retention policy says nothing is deleted automatically', () => {
  const view = buildRetentionView([]);
  assert.match(view.policy, /No data is deleted automatically/);
  assert.match(view.policy, /prompted to back up/);
});

test('retention view does not mutate customers or bills', () => {
  const bills = [{ month: '2025-01', payments: [{ date: '2025-01-05', amount: 10 }] }];
  const list = [customer({ bills })];
  buildRetentionView(list);
  assert.equal(list[0].bills, bills);
  assert.equal(bills[0].payments.length, 1);
});

// ---- retentionYearCsv ----

test('year CSV has a header and one row per bill month in that year', () => {
  const csv = retentionYearCsv([customer({
    bills: [
      { month: '2025-01', dueAmount: 1000, payments: [{ date: '2025-01-05', amount: 1000 }] },
      { month: '2024-12', dueAmount: 900, payments: [] },
    ],
  })], '2025');
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Customer number,Customer name,Month,Bill amount,Payments,Payments total');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /2025-01/);
  assert.doesNotMatch(lines[1], /2024-12/);
});

test('year CSV totals payments per bill', () => {
  const csv = retentionYearCsv([customer({
    bills: [{ month: '2025-03', dueAmount: 500, payments: [{ amount: 200 }, { amount: 300 }] }],
  })], '2025');
  assert.match(csv, /,2,500$/);
});

test('year CSV with no rows for the year is header only', () => {
  const csv = retentionYearCsv([customer({ bills: [{ month: '2024-01', payments: [] }] })], '2025');
  assert.equal(csv.split('\n').length, 1);
});

test('year CSV escapes commas and quotes in names', () => {
  const csv = retentionYearCsv([customer({
    name: 'Aamir, "The" Khan',
    bills: [{ month: '2025-01', dueAmount: 10, payments: [] }],
  })], '2025');
  assert.match(csv, /"Aamir, ""The"" Khan"/);
});

test('year CSV treats the year as a string', () => {
  const csv = retentionYearCsv([customer({ bills: [{ month: '2025-01', payments: [] }] })], 2025);
  assert.equal(csv.split('\n').length, 2);
});

test('year CSV ignores invalid bill months', () => {
  const csv = retentionYearCsv([customer({
    bills: [{ month: 'junk', payments: [] }, { month: '2025-01', payments: [] }],
  })], '2025');
  assert.equal(csv.split('\n').length, 2);
});

test('year CSV uses empty bill amount, never the word undefined', () => {
  const csv = retentionYearCsv([customer({ bills: [{ month: '2025-01', payments: [] }] })], '2025');
  assert.doesNotMatch(csv, /undefined/);
});

// ---- retentionViewHtml ----

test('retention HTML lists every year with an export button', () => {
  const view = buildRetentionView([customer({
    bills: [{ month: '2025-01', payments: [] }, { month: '2024-01', payments: [] }],
  })]);
  const html = retentionViewHtml(view);
  assert.match(html, /2025/);
  assert.match(html, /2024/);
  assert.match(html, /data-retention-export-year="2025"/);
  assert.match(html, /data-retention-export-year="2024"/);
});

test('retention HTML states the no-automatic-deletion policy', () => {
  const html = retentionViewHtml(buildRetentionView([]));
  assert.match(html, /No data is deleted automatically/);
});

test('retention HTML for an empty view is an empty state, not a table', () => {
  const html = retentionViewHtml(buildRetentionView([]));
  assert.match(html, /No dated ledger data yet/);
  assert.doesNotMatch(html, /<table/);
});

test('retention HTML escapes year-adjacent text and never throws on a bare view', () => {
  const html = retentionViewHtml({ years: [{ year: '2025"><script', customers: 1, billMonths: 1, payments: 0, archivedCustomers: 0, oldestMonth: '2025-01', newestMonth: '2025-01' }], policy: 'p' });
  assert.doesNotMatch(html, /"><script/);
  assert.equal(retentionViewHtml(null).includes('Data retention'), true);
});

test('retention HTML shows per-year counts', () => {
  const view = buildRetentionView([customer({
    archived: true, archivedAt: '2025-06-01',
    bills: [{ month: '2025-01', payments: [{ date: '2025-01-05', amount: 5 }] }, { month: '2025-02', payments: [] }],
  })]);
  const html = retentionViewHtml(view);
  assert.match(html, /2025-01 – 2025-02/);
});
