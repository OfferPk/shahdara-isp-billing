// Plan 470 — Share search results as a plain-text list: one share
// action on any customer search result that produces a plain-text
// list (name, mohalla, phone, dues in PKR, status) for the operator
// to carry or send onward — exactly the customers in the current
// search result, in the same order, with dues matching each
// customer's own record; a search with no results shares nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SEARCH_RESULTS_SHARE_EMPTY_TEXT,
  SEARCH_RESULTS_SHARE_DRAFT_HEADING_TEXT,
  SEARCH_RESULTS_SHARE_SEND_TEXT,
  SEARCH_RESULTS_SHARE_DISMISS_TEXT,
  SEARCH_RESULTS_SHARE_SENT_TEXT,
  searchResultsShareDuesCents,
  formatSearchResultsShareAmount,
  searchResultsShareLineText,
  searchResultsShareText,
  searchResultsShareDraftHtml,
} from '../search-results-share.js';
import { searchFastCustomers } from '../nav-customer-search.js';

const REF_DATE = new Date('2026-11-07T10:00:00Z');

function bill(month, dueAmount, dueDate, payments = []) {
  return { month, dueAmount, dueDate, status: 'pending', payments };
}

function payment(id, amount, date) {
  return { id, amount, date };
}

// Generic fixtures only — pattern-fake numbers from the 03012345678
// family, never real customer data. Dues are the allocation
// engine's balances, exactly as the Plan 469 fixtures compute them.
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

function fullResults() {
  return searchFastCustomers(sheetState(), {}, REF_DATE);
}

test('one line per customer: name, mohalla, phone, dues in PKR, status', () => {
  const results = fullResults();
  const byNumber = new Map(results.map((r) => [r.customerNumber, r]));
  assert.equal(
    searchResultsShareLineText(byNumber.get(110)),
    'Tariq Ten · Mohalla Bani · 03012345677 · PKR 2,500 · Due',
  );
  assert.equal(
    searchResultsShareLineText(byNumber.get(103)),
    'Sara Three · Mohalla Dhok · 03012345670 · PKR 2,000 · Overdue',
  );
  // Two labels join the way the row shows them; a half-rupee due
  // keeps its paisa remainder.
  assert.equal(
    searchResultsShareLineText(byNumber.get(105)),
    'Bilal Five · Mohalla Bani · 03012345672 · PKR 1,500 · Due · New',
  );
  assert.equal(
    searchResultsShareLineText(byNumber.get(111)),
    'Meena Eleven · Mohalla Dhok · 03012345670 · PKR 1,000.5 · Due',
  );
  // No dues shows PKR 0, never a blank.
  assert.equal(
    searchResultsShareLineText(byNumber.get(101)),
    'Raja One · Mohalla Bani · 03012345678 · PKR 0 · Paid up',
  );
  assert.equal(
    searchResultsShareLineText(byNumber.get(106)),
    'Hina Six · Mohalla Bani · 03012345673 · PKR 0 · Paid up · New',
  );
  assert.equal(searchResultsShareLineText(null), '');
  assert.equal(searchResultsShareLineText('not-a-row'), '');
});

test('the full list: exactly the search result, in the same order', () => {
  assert.equal(searchResultsShareText(fullResults()), [
    'Customer list (11 customers)',
    '1. Tariq Ten · Mohalla Bani · 03012345677 · PKR 2,500 · Due',
    '2. Sara Three · Mohalla Dhok · 03012345670 · PKR 2,000 · Overdue',
    '3. Rani Two · Mohalla Bani · 03012345679 · PKR 1,500 · Due',
    '4. Bilal Five · Mohalla Bani · 03012345672 · PKR 1,500 · Due · New',
    '5. Omar Seven · Mohalla Bani · 03012345674 · PKR 1,500 · Due',
    '6. Nadia Eight · Mohalla Bani · 03012345675 · PKR 1,200 · Due',
    '7. Meena Eleven · Mohalla Dhok · 03012345670 · PKR 1,000.5 · Due',
    '8. Ali Four · Mohalla Bani · 03012345671 · PKR 1,000 · Overdue',
    '9. Zaid Nine · Mohalla Dhok · 03012345676 · PKR 1,000 · Overdue',
    '10. Raja One · Mohalla Bani · 03012345678 · PKR 0 · Paid up',
    '11. Hina Six · Mohalla Bani · 03012345673 · PKR 0 · Paid up · New',
  ].join('\n'));
});

test('a filtered search shares exactly its own result, in its own order', () => {
  const state = sheetState();
  // Mohalla Dhok only: dues order, Rs 2,000 first, then Rs 1,000.50,
  // then Rs 1,000.
  assert.equal(
    searchResultsShareText(searchFastCustomers(state, { mohalla: 'Mohalla Dhok' }, REF_DATE)),
    [
      'Customer list (3 customers)',
      '1. Sara Three · Mohalla Dhok · 03012345670 · PKR 2,000 · Overdue',
      '2. Meena Eleven · Mohalla Dhok · 03012345670 · PKR 1,000.5 · Due',
      '3. Zaid Nine · Mohalla Dhok · 03012345676 · PKR 1,000 · Overdue',
    ].join('\n'),
  );
  // One customer only: the heading says so in the singular.
  assert.equal(
    searchResultsShareText(searchFastCustomers(state, { duesBand: 'over-2000' }, REF_DATE)),
    'Customer list (1 customer)\n1. Tariq Ten · Mohalla Bani · 03012345677 · PKR 2,500 · Due',
  );
  // A name query shares only its match.
  assert.equal(
    searchResultsShareText(searchFastCustomers(state, { query: 'tariq' }, REF_DATE)),
    'Customer list (1 customer)\n1. Tariq Ten · Mohalla Bani · 03012345677 · PKR 2,500 · Due',
  );
});

test('a search with no results shares nothing and says so', () => {
  assert.equal(searchResultsShareText([]), '');
  assert.equal(searchResultsShareText(null), '');
  assert.equal(searchResultsShareText('not-a-list'), '');
  const state = sheetState();
  assert.equal(searchResultsShareText(searchFastCustomers(state, { query: 'nobodyhere' }, REF_DATE)), '');
  assert.equal(SEARCH_RESULTS_SHARE_EMPTY_TEXT, 'No customers to share.');
  assert.equal(searchResultsShareDraftHtml(''), '');
  assert.equal(searchResultsShareDraftHtml('   '), '');
  assert.equal(searchResultsShareDraftHtml(null), '');
});

test('dues are the row figure in integer cents, never a guessed zero', () => {
  const row = { name: 'Test One', mohalla: 'Mohalla Bani', phone: '03012345678', totalDues: 1500, accountStatusLabels: ['Due'] };
  assert.equal(searchResultsShareDuesCents(row), 150000);
  assert.equal(searchResultsShareDuesCents({ ...row, totalDues: 1000.5 }), 100050);
  assert.equal(searchResultsShareDuesCents({ ...row, totalDues: '1500' }), 150000);
  assert.equal(searchResultsShareDuesCents({ ...row, totalDues: 0 }), 0);
  // A missing, boolean or blank figure is not a number, never zero.
  assert.equal(searchResultsShareDuesCents({ ...row, totalDues: null }), null);
  assert.equal(searchResultsShareDuesCents({ ...row, totalDues: undefined }), null);
  assert.equal(searchResultsShareDuesCents({ ...row, totalDues: true }), null);
  assert.equal(searchResultsShareDuesCents({ ...row, totalDues: '' }), null);
  assert.equal(searchResultsShareDuesCents({ ...row, totalDues: 'not-a-number' }), null);
  assert.equal(searchResultsShareDuesCents(null), null);
  assert.equal(
    searchResultsShareLineText({ ...row, totalDues: null }),
    'Test One · Mohalla Bani · 03012345678 · dues not recorded · Due',
  );
  assert.equal(formatSearchResultsShareAmount(250000), '2,500');
  assert.equal(formatSearchResultsShareAmount(100050), '1,000.5');
  assert.equal(formatSearchResultsShareAmount(0), '0');
});

test('status falls back to the billing tag in plain words, never a guess', () => {
  const base = { name: 'Test One', mohalla: 'Mohalla Bani', phone: '03012345678', totalDues: 100 };
  assert.equal(
    searchResultsShareLineText({ ...base, billingStatus: 'pending' }),
    'Test One · Mohalla Bani · 03012345678 · PKR 100 · Pending',
  );
  assert.equal(
    searchResultsShareLineText({ ...base, billingStatus: 'partial' }),
    'Test One · Mohalla Bani · 03012345678 · PKR 100 · Partial',
  );
  assert.equal(
    searchResultsShareLineText({ ...base, billingStatus: 'paid' }),
    'Test One · Mohalla Bani · 03012345678 · PKR 100 · Paid',
  );
  assert.equal(
    searchResultsShareLineText({ ...base, billingStatus: 'not-set' }),
    'Test One · Mohalla Bani · 03012345678 · PKR 100 · Not set',
  );
  assert.equal(
    searchResultsShareLineText({ ...base, billingStatus: 'bogus' }),
    'Test One · Mohalla Bani · 03012345678 · PKR 100 · Not set',
  );
  assert.equal(
    searchResultsShareLineText({ ...base }),
    'Test One · Mohalla Bani · 03012345678 · PKR 100 · status not recorded',
  );
  // Empty labels fall back the same way as missing labels.
  assert.equal(
    searchResultsShareLineText({ ...base, accountStatusLabels: [], billingStatus: 'pending' }),
    'Test One · Mohalla Bani · 03012345678 · PKR 100 · Pending',
  );
});

test('missing name, mohalla, and phone read plainly, never blank', () => {
  const base = { totalDues: 100, accountStatusLabels: ['Due'] };
  assert.equal(
    searchResultsShareLineText({ ...base, name: '', mohalla: '', area: '', phone: '' }),
    'Customer · Unassigned · no phone · PKR 100 · Due',
  );
  assert.equal(
    searchResultsShareLineText({ ...base, name: 'Test One', mohalla: '', area: 'Mohalla Bani', phone: '' }),
    'Test One · Mohalla Bani · no phone · PKR 100 · Due',
  );
  // Stray whitespace can never split one customer over two lines.
  assert.equal(
    searchResultsShareLineText({ ...base, name: 'Ali   Raza\nKhan', mohalla: 'Mohalla  Bani', phone: '03012345678' }),
    'Ali Raza Khan · Mohalla Bani · 03012345678 · PKR 100 · Due',
  );
});

test('sharing never mutates the result it was given', () => {
  const results = fullResults();
  const frozen = results.map((row) => Object.freeze({ ...row }));
  Object.freeze(frozen);
  const before = JSON.stringify(frozen);
  const text = searchResultsShareText(frozen);
  assert.ok(text.startsWith('Customer list (11 customers)\n1. Tariq Ten'));
  assert.equal(JSON.stringify(frozen), before);
  assert.deepEqual(frozen.map((r) => r.customerNumber), [110, 103, 102, 105, 107, 108, 111, 104, 109, 101, 106]);
});

test('the draft shows the list exactly as it will go out, with Send and Dismiss', () => {
  const text = 'Customer list (1 customer)\n1. Ali <Test> & Sons · Mohalla Bani · 03012345678 · PKR 100 · Due';
  const html = searchResultsShareDraftHtml(text);
  assert.ok(html.includes(SEARCH_RESULTS_SHARE_DRAFT_HEADING_TEXT), 'draft heading shown');
  assert.ok(html.includes('Ali &lt;Test&gt; &amp; Sons'), 'list text is escaped in the draft');
  assert.equal(html.includes('Ali <Test>'), false, 'no raw angle brackets leak into the draft');
  assert.ok(html.includes('data-srs-send'), 'Send button present');
  assert.ok(html.includes('data-srs-dismiss'), 'Dismiss button present');
  assert.ok(html.includes(SEARCH_RESULTS_SHARE_SEND_TEXT), 'Send reads Send on WhatsApp');
  assert.ok(html.includes(SEARCH_RESULTS_SHARE_DISMISS_TEXT), 'Dismiss reads Dismiss');
  assert.ok(html.includes('primary-button'), 'Send uses the primary button');
  assert.ok(html.includes('secondary-button'), 'Dismiss uses the secondary button');
  assert.equal(SEARCH_RESULTS_SHARE_SEND_TEXT, 'Send on WhatsApp');
  assert.equal(SEARCH_RESULTS_SHARE_DISMISS_TEXT, 'Dismiss');
  assert.equal(SEARCH_RESULTS_SHARE_SENT_TEXT, 'List ready to send.');
});

test('wiring: the sheet shares the current result from the Share list button', () => {
  const sheet = readFileSync(new URL('../nav-customer-search.js', import.meta.url), 'utf8');
  assert.ok(sheet.includes("from './search-results-share.js'"), 'sheet imports the Plan 470 module');
  assert.ok(sheet.includes("document.getElementById('fastCustomerShareListRow')"), 'share row is looked up');
  assert.ok(sheet.includes("document.getElementById('fastCustomerShareListBtn')"), 'share button is looked up');
  assert.ok(sheet.includes("document.getElementById('fastCustomerShareListResult')"), 'draft region is looked up');
  assert.ok(sheet.includes('searchResultsShareText(lastResults)'), 'the list is built from the current result');
  assert.equal(sheet.includes('searchResultsShareText(payments'), false, 'payments are never shared as customers');
  assert.ok(sheet.includes('searchResultsShareDraftHtml(text)'), 'the draft shows the list as it will go out');
  assert.ok(sheet.includes('shareListRow.style.display = showSaveRow'), 'the share row shows only while a search is running');
  assert.ok(sheet.includes("if (shareListRow) shareListRow.style.display = 'none';"), 'the share row hides on the recents view');
  assert.ok(sheet.includes('onToast(SEARCH_RESULTS_SHARE_EMPTY_TEXT)'), 'an empty search says so instead of sharing');
  assert.ok(sheet.includes('onToast(SEARCH_RESULTS_SHARE_SENT_TEXT)'), 'Send confirms the list is ready');
  assert.ok(sheet.includes('https://wa.me/?text=${encodeURIComponent(text)}'), 'Send opens the recipient-less share link');
  assert.ok(sheet.includes("e.target.closest('[data-srs-send]')"), 'Send is the draft button tap');
  assert.ok(sheet.includes("e.target.closest('[data-srs-dismiss]')"), 'Dismiss is the draft button tap');
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="fastCustomerShareListRow"'), 'share row exists in the sheet');
  assert.ok(page.includes('id="fastCustomerShareListBtn"'), 'share button exists in the sheet');
  assert.ok(page.includes('id="fastCustomerShareListResult"'), 'draft region exists in the sheet');
  assert.ok(page.includes('>Share list<'), 'share button reads Share list');
  assert.ok(page.includes('Names, dues in PKR and status, as text.'), 'share hint names the list contents');
});

test('the new module names no fenced module file literally and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../search-results-share.js', import.meta.url), 'utf8');
  assert.equal(module.includes('customer-search-filter.js'), false);
  assert.equal(module.includes('nav-customer-search.js'), false);
  assert.equal(module.includes('fuzzy-alias-search.js'), false);
  assert.equal(module.includes('customer-id-lookup.js'), false);
  assert.equal(module.includes('partial-phone-search.js'), false);
  assert.equal(module.includes('suspension-records.js'), false);
  assert.equal(module.includes('receipt-share-draft.js'), false);
  assert.equal(module.includes('history-share-summary.js'), false);
  assert.equal(module.includes('import '), false, 'import-free pure module');
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document'), false);
  assert.equal(module.includes('window'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
  // The header is a /* */ block, never // line comments.
  assert.ok(module.startsWith('/*'), 'header is a block comment');
});
