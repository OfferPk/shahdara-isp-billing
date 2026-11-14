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

test('sortCustomerRoster - sorts roster by package speed descending and area descending (Sharafat 29)', () => {
  const customers = [
    { id: 'c1', customerNumber: 1, name: 'A', mohalla: 'Vandala Road', packageSpeed: '30 Mbps' },
    { id: 'c2', customerNumber: 2, name: 'B', mohalla: 'Baradari', packageSpeed: '10 Mbps' },
    { id: 'c3', customerNumber: 3, name: 'C', mohalla: 'Begum Kot', packageSpeed: '50 Mbps' }
  ];

  const byPlanDesc = sortCustomerRoster(customers, { sortBy: 'package-desc' });
  assert.deepEqual(byPlanDesc.map(c => c.packageSpeed), ['50 Mbps', '30 Mbps', '10 Mbps']);
  // Regression proof: on pristine code package-desc fell through to the
  // default number-asc sort, which would order the numbers [1, 2, 3].
  assert.deepEqual(byPlanDesc.map(c => c.customerNumber), [3, 1, 2]);

  const byAreaDesc = sortCustomerRoster(customers, { sortBy: 'mohalla-desc' });
  assert.deepEqual(byAreaDesc.map(c => c.mohalla), ['Vandala Road', 'Begum Kot', 'Baradari']);
  // mohalla-desc is the exact reverse of mohalla-asc (also pinned in
  // mohalla-numbering.test.js).
  const byAreaAsc = sortCustomerRoster(customers, { sortBy: 'mohalla-asc' });
  assert.deepEqual(byAreaDesc.map(c => c.id), [...byAreaAsc.map(c => c.id)].reverse());
});

test('sortCustomerRoster - sorts roster by total collections ascending (Sharafat 29)', () => {
  // Same fixtures as the balance/received test above: received 1500/500/0.
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

  const byReceivedAsc = sortCustomerRoster(customers, { sortBy: 'received-asc' });
  assert.deepEqual(byReceivedAsc.map(c => c.customerNumber), [3, 2, 1]); // 0, 500, 1500
});

test('sort states sync - every header sort has a dropdown option and every option is a sorter case (Sharafat 29)', () => {
  const formValidation = read('form-validation.js');
  const navLanguage = read('nav-language.js');

  // Header fields: every data-sort-cust value in the table headers.
  const headerFields = [...index.matchAll(/data-sort-cust="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual([...headerFields].sort(), ['balance', 'mohalla', 'name', 'number', 'package']);

  // Dropdown options: every <option value> inside #customerSortSelect.
  const selectStart = index.indexOf('id="customerSortSelect"');
  assert.ok(selectStart > -1, 'customerSortSelect exists');
  const selectEnd = index.indexOf('</select>', selectStart);
  const selectBlock = index.slice(selectStart, selectEnd);
  const optionValues = [...selectBlock.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);

  // Every header toggle must land on a sort the dropdown can show: the
  // select's .value assignment is a silent no-op for a missing option.
  for (const field of headerFields) {
    assert.ok(optionValues.includes(`${field}-asc`), `select has ${field}-asc`);
    assert.ok(optionValues.includes(`${field}-desc`), `select has ${field}-desc`);
  }

  // Every dropdown option must be a case sortCustomerRoster implements.
  // Scope the parse to the sortCustomerRoster body ONLY: the file holds
  // two more sorter switches (sortMonthlyReportRows with date-asc/amount-*
  // cases, sortTransactionsList), and a file-wide parse would wrongly
  // demand select options for those keys.
  const sorterStart = formValidation.indexOf('export function sortCustomerRoster(');
  assert.ok(sorterStart > -1, 'sortCustomerRoster exists');
  const sorterEnd = formValidation.indexOf('\n}\n', sorterStart);
  const sorterBody = formValidation.slice(sorterStart, sorterEnd);
  const sorterCases = [...sorterBody.matchAll(/case '([^']+)':/g)].map(m => m[1]);
  for (const value of optionValues) {
    assert.ok(sorterCases.includes(value), `sorter implements ${value}`);
  }

  // The full unified set: the 10 header-producible keys (5 headers x
  // asc/desc) + received-asc/received-desc, which are select-only by
  // design — there is no Received column in the table.
  assert.deepEqual([...optionValues].sort(), [
    'balance-asc', 'balance-desc', 'mohalla-asc', 'mohalla-desc',
    'name-asc', 'name-desc', 'number-asc', 'number-desc',
    'package-asc', 'package-desc', 'received-asc', 'received-desc'
  ]);

  // The four new i18n keys exist in BOTH dicts. EN and UR values differ,
  // so each exact string pins the dict its key lives in.
  for (const [key, en, ur] of [
    ['cust_sort_mohalla_desc', 'Area (12 → 1)', 'علاقہ (12 سے 1)'],
    ['cust_sort_package_asc', 'Plan (A → Z)', 'پلان (A سے Z)'],
    ['cust_sort_package_desc', 'Plan (Z → A)', 'پلان (Z سے A)'],
    ['cust_sort_received_asc', 'Collected (Low → High)', 'وصول شدہ (کم سے زیادہ)']
  ]) {
    assert.ok(navLanguage.includes(`${key}: '${en}',`), `${key} in EN dict`);
    assert.ok(navLanguage.includes(`${key}: '${ur}',`), `${key} in UR dict`);
  }
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

test('renderCustomerTableRowMarkup - archived rows carry the marker and an Unarchive button alongside Open (Sharafat 33)', () => {
  const archivedCustomer = {
    id: 'c-arch-01',
    customerNumber: 9,
    name: 'Archived Customer',
    phone: '03001234567',
    mohalla: 'Baradari',
    packageSpeed: '20 Mbps',
    serviceStatus: 'active',
    bills: [
      { month: '2026-10', dueAmount: 2000, payments: [{ amount: 2000 }] }
    ]
  };

  const html = renderCustomerTableRowMarkup(archivedCustomer, {
    selectedCustomerId: 'c-arch-01',
    selectedBillingMonth: '2026-10',
    archived: true
  });

  assert.match(html, /is-archived/);
  assert.match(html, /#9 \(Archived\)/);
  // Parent decision 33-(a): Unarchive sits ALONGSIDE Open in the Action
  // cell. Sharafat 36, shape (b): the name is plain text now, so the Open
  // button is the row's single profile opener — the Unarchive placement
  // (and this test's Unarchive assertions) are unchanged.
  assert.match(html, /data-unarchive-customer="c-arch-01"/);
  assert.match(html, /Unarchive/);
  assert.match(html, /data-customer-id="c-arch-01"/);

  // The default (archived: false) row is unchanged: no marker, no
  // Unarchive control — the active roster never offers it.
  const activeHtml = renderCustomerTableRowMarkup(archivedCustomer, {
    selectedCustomerId: 'c-arch-01',
    selectedBillingMonth: '2026-10'
  });
  assert.doesNotMatch(activeHtml, /is-archived/);
  assert.doesNotMatch(activeHtml, /\(Archived\)/);
  assert.doesNotMatch(activeHtml, /data-unarchive-customer/);
});

test('renderCustomerTableRowMarkup - exactly one profile-opening control per row; the name is plain text (Sharafat 36, shape (b))', () => {
  const customer = {
    id: 'c-one-01',
    customerNumber: 7,
    name: 'Single Opener Customer',
    phone: '03001234567',
    mohalla: 'Baradari',
    packageSpeed: '20 Mbps',
    serviceStatus: 'active',
    bills: [
      { month: '2026-10', dueAmount: 2000, payments: [{ amount: 2000 }] }
    ]
  };

  const html = renderCustomerTableRowMarkup(customer, {
    selectedCustomerId: 'c-one-01',
    selectedBillingMonth: '2026-10'
  });

  // One Tab stop per row: exactly one element carries data-customer-id,
  // and it is the Action column's Open button — the name cell is plain
  // text now (no button, no profile-open title).
  assert.equal((html.match(/data-customer-id="/g) || []).length, 1);
  assert.match(html, /<button class="secondary-button table-select-btn" type="button" data-customer-id="c-one-01">/);
  assert.doesNotMatch(html, /customer-row-btn/);
  assert.doesNotMatch(html, /Open profile for #7/);
  // The name and phone still render, as plain text.
  assert.match(html, /<span class="customer-name-text">/);
  assert.match(html, /<strong>Single Opener Customer<\/strong>/);
  assert.match(html, /03001234567/);

  // The archived row keeps exactly one opener PLUS exactly one Unarchive
  // control (Unarchive is not an opener and must not be counted as one).
  const archivedHtml = renderCustomerTableRowMarkup(customer, {
    selectedCustomerId: 'c-one-01',
    selectedBillingMonth: '2026-10',
    archived: true
  });
  assert.equal((archivedHtml.match(/data-customer-id="/g) || []).length, 1);
  assert.equal((archivedHtml.match(/data-unarchive-customer="/g) || []).length, 1);
  assert.match(archivedHtml, /Unarchive/);

  // Shape (b) keeps the Action column: the active thead still carries the
  // Action header, and the empty row is still colspan="8" (also pinned in
  // table-polish.test.js).
  assert.match(index, /<th scope="col" class="col-action"[^>]*><span data-i18n="cust_th_action">Action<\/span><\/th>/);

  // The surviving opener still selects: the [data-customer-id] bindings
  // in renderCustomers (active + archived tables) still call selectCustomer.
  // (The double-fire — direct bindings plus the delegated tbody listener —
  // is pre-existing and untouched by this change; see the PR body.)
  assert.ok(app.includes("querySelectorAll('[data-customer-id]')"), 'renderCustomers still binds [data-customer-id]');
  assert.ok(app.includes('selectCustomer(button.dataset.customerId)'), 'the binding still calls selectCustomer');
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

test('renderCustomerTableRowMarkup - a voided-only payment never reduces the balance or marks the bill paid (Sharafat 27)', () => {
  const voidedOnly = {
    id: 'c-void-01',
    customerNumber: 11,
    name: 'Voided Only Customer',
    phone: '03001234567',
    mohalla: 'Baradari',
    packageSpeed: '20 Mbps',
    serviceStatus: 'active',
    bills: [
      { month: '2026-10', dueAmount: 2000, payments: [{ amount: 2000, voided: true }] }
    ]
  };

  // The fallback (no allocations) is the honest gate: the engine path already
  // excludes voided payments, so the helpers are called WITHOUT allocations.
  assert.strictEqual(getCustomerMonthBalance(voidedOnly, '2026-10'), 2000);
  assert.strictEqual(getCustomerTotalCollections(voidedOnly), 0);

  const html = renderCustomerTableRowMarkup(voidedOnly, { selectedBillingMonth: '2026-10' });
  assert.match(html, /PKR 2,000/);
  assert.match(html, /text-due/);
  assert.match(html, /status-pending/);
  assert.doesNotMatch(html, /status-received/);

  // Mixed case: a real 500 plus a voided 1500 on a 2000 bill → balance 1500,
  // badge partial — the voided 1500 counts for neither.
  const mixed = {
    ...voidedOnly,
    id: 'c-void-02',
    customerNumber: 12,
    name: 'Mixed Payment Customer',
    bills: [
      { month: '2026-10', dueAmount: 2000, payments: [{ amount: 500 }, { amount: 1500, voided: true }] }
    ]
  };
  assert.strictEqual(getCustomerMonthBalance(mixed, '2026-10'), 1500);
  assert.strictEqual(getCustomerTotalCollections(mixed), 500);
  const mixedHtml = renderCustomerTableRowMarkup(mixed, { selectedBillingMonth: '2026-10' });
  assert.match(mixedHtml, /PKR 1,500/);
  assert.match(mixedHtml, /text-due/);
  assert.match(mixedHtml, /status-partial/);
  assert.doesNotMatch(mixedHtml, /status-received/);
});

test('sortCustomerRoster - a voided-only payment sorts as 0 collected and full due (Sharafat 27)', () => {
  const customers = [
    {
      id: 'c-void',
      customerNumber: 1,
      name: 'Voided Payer',
      bills: [{ month: '2026-10', dueAmount: 2000, payments: [{ amount: 2000, voided: true }] }]
    },
    {
      id: 'c-real',
      customerNumber: 2,
      name: 'Real Payer',
      bills: [{ month: '2026-10', dueAmount: 2000, payments: [{ amount: 2000 }] }]
    }
  ];

  // Equal-size payments, one voided, one real: the real payer collected 2000,
  // the voided-only customer collected 0.
  const byReceivedDesc = sortCustomerRoster(customers, { sortBy: 'received-desc' });
  assert.deepEqual(byReceivedDesc.map(c => c.customerNumber), [2, 1]); // 2000, 0

  // And the balance sort is the mirror image: the voided-only customer still
  // owes the full 2000, the real payer owes 0.
  const byBalanceDesc = sortCustomerRoster(customers, { sortBy: 'balance-desc', billingMonth: '2026-10' });
  assert.deepEqual(byBalanceDesc.map(c => c.customerNumber), [1, 2]); // 2000, 0
});

test('Balance column label - the header states its month scope and renderCustomers sets it (Sharafat 27, shape (a))', () => {
  // The static HTML keeps the bare data-i18n label for the first paint; the
  // month suffix is set from JS at render time (see the why-comment in
  // renderCustomers) because the i18n engine has no {month} param support in
  // static HTML.
  assert.match(index, /<span data-i18n="cust_th_balance">Balance Due<\/span>/, 'index.html must keep the bare cust_th_balance label for first paint');
  assert.ok(
    app.includes("t('cust_th_balance', null, { month: balanceMonthLabel })"),
    'renderCustomers must set the Balance header from cust_th_balance with the month'
  );
  assert.ok(
    app.includes('displayMonthName(selectedBillingMonth)'),
    'renderCustomers must derive the header month from the selected billing month'
  );
});
