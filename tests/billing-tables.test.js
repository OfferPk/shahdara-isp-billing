import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sortCustomerRoster,
  filterCustomersByArea,
  getUniqueCustomerAreas,
  sortMonthlyReportRows,
  sortTransactionsList,
  renderCustomerTableRowMarkup,
  getCustomerMonthBalance,
  getCustomerTotalCollections,
  paginateRows
} from '../form-validation.js';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('app.js');
const styles = read('styles.css');

test('sortCustomerRoster - sorts roster by customer number ascending and descending', () => {
  const customers = [
    { id: 'c3', customerNumber: 42, name: 'Zahid Khan' },
    { id: 'c1', customerNumber: 3, name: 'Ali Raza' },
    { id: 'c2', customerNumber: 15, name: 'Bilal Ahmed' }
  ];

  const asc = sortCustomerRoster(customers, { sortBy: 'number-asc' });
  assert.deepEqual(asc.map(c => c.customerNumber), [3, 15, 42]);

  const desc = sortCustomerRoster(customers, { sortBy: 'number-desc' });
  assert.deepEqual(desc.map(c => c.customerNumber), [42, 15, 3]);
});

test('sortCustomerRoster - sorts roster by customer name ascending and descending', () => {
  const customers = [
    { id: 'c1', customerNumber: 1, name: 'Zahid Khan' },
    { id: 'c2', customerNumber: 2, name: 'Ali Raza' },
    { id: 'c3', customerNumber: 3, name: 'Bilal Ahmed' }
  ];

  const asc = sortCustomerRoster(customers, { sortBy: 'name-asc' });
  assert.deepEqual(asc.map(c => c.name), ['Ali Raza', 'Bilal Ahmed', 'Zahid Khan']);

  const desc = sortCustomerRoster(customers, { sortBy: 'name-desc' });
  assert.deepEqual(desc.map(c => c.name), ['Zahid Khan', 'Bilal Ahmed', 'Ali Raza']);
});

test('sortCustomerRoster - sorts roster by area/mohalla and package speed', () => {
  const customers = [
    { id: 'c1', customerNumber: 1, name: 'A', mohalla: 'Vandala Road', packageSpeed: '30 Mbps' },
    { id: 'c2', customerNumber: 2, name: 'B', mohalla: 'Baradari', packageSpeed: '10 Mbps' },
    { id: 'c3', customerNumber: 3, name: 'C', mohalla: 'Begum Kot', packageSpeed: '50 Mbps' }
  ];

  const byArea = sortCustomerRoster(customers, { sortBy: 'mohalla-asc' });
  assert.deepEqual(byArea.map(c => c.mohalla), ['Baradari', 'Begum Kot', 'Vandala Road']);

  const byPlan = sortCustomerRoster(customers, { sortBy: 'package-asc' });
  assert.deepEqual(byPlan.map(c => c.packageSpeed), ['10 Mbps', '30 Mbps', '50 Mbps']);
});

test('sortCustomerRoster - sorts roster by outstanding balance and total collections', () => {
  const customers = [
    {
      id: 'c1', customerNumber: 1, name: 'Customer Low Due',
      bills: [
        { month: '2026-10', dueAmount: 1500, payments: [{ amount: 1500 }] }
      ]
    },
    {
      id: 'c2', customerNumber: 2, name: 'Customer High Due',
      bills: [
        { month: '2026-10', dueAmount: 3000, payments: [{ amount: 500 }] }
      ]
    },
    {
      id: 'c3', customerNumber: 3, name: 'Customer Med Due',
      bills: [
        { month: '2026-10', dueAmount: 2000, payments: [] }
      ]
    }
  ];

  const byBalanceDesc = sortCustomerRoster(customers, { sortBy: 'balance-desc', billingMonth: '2026-10' });
  assert.deepEqual(byBalanceDesc.map(c => c.customerNumber), [2, 3, 1]); // 2500, 2000, 0

  const byBalanceAsc = sortCustomerRoster(customers, { sortBy: 'balance-asc', billingMonth: '2026-10' });
  assert.deepEqual(byBalanceAsc.map(c => c.customerNumber), [1, 3, 2]); // 0, 2000, 2500

  const byReceivedDesc = sortCustomerRoster(customers, { sortBy: 'received-desc' });
  assert.deepEqual(byReceivedDesc.map(c => c.customerNumber), [1, 2, 3]); // 1500, 500, 0
});

test('filterCustomersByArea and getUniqueCustomerAreas - handles exact and case-insensitive area filtering', () => {
  const customers = [
    { id: 'c1', name: 'A', mohalla: 'Baradari' },
    { id: 'c2', name: 'B', mohalla: 'Vandala Road' },
    { id: 'c3', name: 'C', area: 'Baradari' },
    { id: 'c4', name: 'D', mohalla: 'Begum Kot' },
    { id: 'c5', name: 'E', mohalla: '' }
  ];

  const areas = getUniqueCustomerAreas(customers);
  assert.deepEqual(areas, ['Baradari', 'Begum Kot', 'Vandala Road']);

  const all = filterCustomersByArea(customers, 'all');
  assert.equal(all.length, 5);

  const baradari = filterCustomersByArea(customers, 'baradari');
  assert.equal(baradari.length, 2);
  assert.deepEqual(baradari.map(c => c.id), ['c1', 'c3']);

  const begumKot = filterCustomersByArea(customers, 'Begum Kot');
  assert.equal(begumKot.length, 1);
});

test('sortMonthlyReportRows - sorts monthly report rows across multiple keys', () => {
  const rows = [
    { customerNumber: 10, customerName: 'Zahid', billAmount: 2000, amountReceived: 1000, balanceDue: 1000, status: 'partial' },
    { customerNumber: 2, customerName: 'Ali', billAmount: 1500, amountReceived: 1500, balanceDue: 0, status: 'paid' },
    { customerNumber: 5, customerName: 'Bilal', billAmount: 3000, amountReceived: 0, balanceDue: 3000, status: 'pending' }
  ];

  const byNumAsc = sortMonthlyReportRows(rows, 'number-asc');
  assert.deepEqual(byNumAsc.map(r => r.customerNumber), [2, 5, 10]);

  const byNameAsc = sortMonthlyReportRows(rows, 'name-asc');
  assert.deepEqual(byNameAsc.map(r => r.customerName), ['Ali', 'Bilal', 'Zahid']);

  const byBalanceDesc = sortMonthlyReportRows(rows, 'balance-desc');
  assert.deepEqual(byBalanceDesc.map(r => r.customerNumber), [5, 10, 2]); // 3000, 1000, 0

  const byCollectedDesc = sortMonthlyReportRows(rows, 'collected-desc');
  assert.deepEqual(byCollectedDesc.map(r => r.customerNumber), [2, 10, 5]); // 1500, 1000, 0
});

test('sortTransactionsList - sorts transaction entries by date, amount, and customer number', () => {
  const transactions = [
    { date: '2026-10-05', amount: 1500, customerNumber: 3 },
    { date: '2026-10-12', amount: 500, customerNumber: 1 },
    { date: '2026-10-01', amount: 3000, customerNumber: 8 }
  ];

  const byDateDesc = sortTransactionsList(transactions, 'date-desc');
  assert.deepEqual(byDateDesc.map(t => t.date), ['2026-10-12', '2026-10-05', '2026-10-01']);

  const byDateAsc = sortTransactionsList(transactions, 'date-asc');
  assert.deepEqual(byDateAsc.map(t => t.date), ['2026-10-01', '2026-10-05', '2026-10-12']);

  const byAmountDesc = sortTransactionsList(transactions, 'amount-desc');
  assert.deepEqual(byAmountDesc.map(t => t.amount), [3000, 1500, 500]);
});

test('renderCustomerTableRowMarkup - generates valid HTML row markup with status, plan, balance and actions', () => {
  const customer = {
    id: 'c-test-01',
    customerNumber: 7,
    name: 'Muhammad Usman',
    phone: '03001234567',
    mohalla: 'Baradari',
    packageSpeed: '20 Mbps',
    serviceStatus: 'active',
    bills: [
      { month: '2026-10', dueAmount: 2000, payments: [{ amount: 2000 }] }
    ]
  };

  const html = renderCustomerTableRowMarkup(customer, {
    selectedCustomerId: 'c-test-01',
    selectedBillingMonth: '2026-10'
  });

  assert.match(html, /<tr class="customer-table-row is-selected/);
  assert.match(html, /#7/);
  assert.match(html, /Muhammad Usman/);
  assert.match(html, /03001234567/);
  assert.match(html, /Baradari/);
  assert.match(html, /20 Mbps/);
  assert.match(html, /service-active/);
  assert.match(html, /status-received/);
  assert.match(html, /text-clear/);
  assert.match(html, /data-customer-id="c-test-01"/);
});

test('HTML and CSS integrity - verifies billing tables, roster table, view toggle, and pagination elements exist', () => {
  assert.match(index, /id="customerFilterArea"/, 'index.html must have #customerFilterArea');
  assert.match(index, /id="customerSortSelect"/, 'index.html must have #customerSortSelect');
  assert.match(index, /id="customerViewCardsBtn"/, 'index.html must have #customerViewCardsBtn');
  assert.match(index, /id="customerViewTableBtn"/, 'index.html must have #customerViewTableBtn');
  assert.match(index, /id="customerRosterTable"/, 'index.html must have #customerRosterTable');
  assert.match(index, /id="customerRosterTableBody"/, 'index.html must have #customerRosterTableBody');
  assert.match(index, /id="customerPagination"/, 'index.html must have #customerPagination');
  assert.match(index, /id="reportSortSelect"/, 'index.html must have #reportSortSelect');
  assert.match(index, /id="transactionSortSelect"/, 'index.html must have #transactionSortSelect');

  assert.match(styles, /\.customer-roster-table/, 'styles.css must style .customer-roster-table');
  assert.match(styles, /position:\s*sticky;\s*top:\s*0;/, 'styles.css must support sticky table headers');
  assert.match(styles, /\.customer-view-toggle/, 'styles.css must style .customer-view-toggle');
  assert.match(styles, /\[data-theme="dark"\] \.customer-roster-table/, 'styles.css must have dark theme support for customer roster table');
});
