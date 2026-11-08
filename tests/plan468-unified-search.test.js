// Plan 468 — Unified search across customers and ledger: one typed
// query answers the whole counter question — the matching customers
// and their matching payments together, in two labelled groups —
// instead of two separate searches on two screens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UNIFIED_SEARCH_MIN_CHARS,
  searchUnifiedPayments,
  unifiedPaymentsEmptyText,
  unifiedPaymentsSectionHtml,
} from '../unified-search.js';
import { LIVE_LEDGER_SEARCH_MIN_CHARS } from '../ledger-live-search.js';
import {
  searchFastCustomers,
} from '../nav-customer-search.js';

const REF_DATE = new Date('2026-11-07T10:00:00Z');
const TODAY = '2026-11-07';

function bill(month, dueAmount, dueDate, payments = []) {
  return { month, dueAmount, dueDate, status: 'pending', payments };
}

function payment(id, amount, date, extra = {}) {
  return { id, amount, date, ...extra };
}

// Generic fixtures only — pattern-fake numbers from the 03012345678
// family, never real customer data.
function customers() {
  return [
    // #401 Ahmed Raza: one Cash payment, 5 Nov.
    { id: 'seed-468-01', name: 'Ahmed Raza', customerNumber: 401, phone: '03012345678', mohalla: 'Mohalla Bani', area: 'Mohalla Bani', addedOn: '2026-08-15', bills: [bill('2026-11', 1500, '2026-11-10', [payment('p401a', 1500, '2026-11-05', { method: 'Cash' })])] },
    // #402 Faisal Ahmed: two payments — JazzCash 6 Nov, Bank Transfer 3 Nov.
    { id: 'seed-468-02', name: 'Faisal Ahmed', customerNumber: 402, phone: '03012345679', mohalla: 'Mohalla Bani', area: 'Mohalla Bani', addedOn: '2026-08-20', bills: [bill('2026-11', 2000, '2026-11-10', [payment('p402a', 1000, '2026-11-06', { method: 'JazzCash' }), payment('p402b', 2000, '2026-11-03', { method: 'Bank Transfer' })])] },
    // #403 Bilal Hussain: one voided Cash payment, 28 Oct.
    { id: 'seed-468-03', name: 'Bilal Hussain', customerNumber: 403, phone: '03012345670', mohalla: 'Mohalla Dhok', area: 'Mohalla Dhok', addedOn: '2026-09-01', bills: [bill('2026-10', 2500, '2026-10-10', [payment('p403a', 2500, '2026-10-28', { method: 'Cash', voided: true })])] },
    // #404 archived on purpose: his customer row never appears in
    // the customers group, but his payment is ledger history.
    { id: 'seed-468-04', name: 'Ahmed Archived', customerNumber: 404, phone: '03012345671', mohalla: 'Mohalla Bani', area: 'Mohalla Bani', addedOn: '2026-07-01', archived: true, bills: [bill('2026-11', 1000, '2026-11-10', [payment('p404a', 500, '2026-11-04', { method: 'Cash' })])] },
    // #405 no payments at all.
    { id: 'seed-468-05', name: 'No Payments Nadia', customerNumber: 405, phone: '03012345672', mohalla: 'Mohalla Bani', area: 'Mohalla Bani', addedOn: '2026-10-01', bills: [bill('2026-11', 1000, '2026-11-10')] },
    // #406 a name carrying markup, so the row proves its escaping.
    { id: 'seed-468-06', name: 'Test <b>Bold</b>', customerNumber: 406, phone: '03012345673', mohalla: 'Mohalla Bani', area: 'Mohalla Bani', addedOn: '2026-10-05', bills: [bill('2026-11', 700, '2026-11-10', [payment('p406a', 700, '2026-11-02', { method: 'Cash' })])] },
  ];
}

function sheetState() {
  return { customers: customers() };
}

function paymentIds(entries) {
  return entries.map((entry) => entry.paymentId);
}

test('the payments threshold matches the ledger live search threshold', () => {
  assert.equal(UNIFIED_SEARCH_MIN_CHARS, 3);
  assert.equal(UNIFIED_SEARCH_MIN_CHARS, LIVE_LEDGER_SEARCH_MIN_CHARS);
});

test('an inactive query returns no payments and no section', () => {
  const state = sheetState();
  for (const query of ['', '   ', 'ab', 'a1', null, undefined, 42]) {
    assert.deepEqual(searchUnifiedPayments(state, query), []);
    assert.equal(unifiedPaymentsSectionHtml([], query, TODAY), '');
    assert.equal(unifiedPaymentsEmptyText(query), '');
  }
  assert.deepEqual(searchUnifiedPayments(null, 'ahmed'), []);
  assert.deepEqual(searchUnifiedPayments({ customers: null }, 'ahmed'), []);
});

test('one query returns the matching ledger entries, in ledger order', () => {
  const state = sheetState();
  // "ahmed" matches by name: Faisal Ahmed's two payments, Ahmed
  // Raza's one, and the archived Ahmed's one — newest first, the
  // ledger's own order.
  assert.deepEqual(paymentIds(searchUnifiedPayments(state, 'ahmed')), ['p402a', 'p401a', 'p404a', 'p402b']);
  // The phonetic matcher finds Faisal's payments for "Fesal".
  assert.deepEqual(paymentIds(searchUnifiedPayments(state, 'Fesal')), ['p402a', 'p402b']);
  // An amount fragment finds the payment of that amount only.
  assert.deepEqual(paymentIds(searchUnifiedPayments(state, '1500')), ['p401a']);
  // A phone fragment finds that customer's payments only.
  assert.deepEqual(paymentIds(searchUnifiedPayments(state, '5679')), ['p402a', 'p402b']);
  // The customer number finds that customer's payments.
  assert.deepEqual(paymentIds(searchUnifiedPayments(state, '#403')), ['p403a']);
  // The method is not searched here — each method already has its
  // own filter on the ledger screen — so "cash" matches nothing.
  assert.deepEqual(searchUnifiedPayments(state, 'cash'), []);
  assert.deepEqual(searchUnifiedPayments(state, 'zzzqqq'), []);
});

test('a voided entry still lists as history, labelled Voided', () => {
  const entries = searchUnifiedPayments(sheetState(), 'bilal');
  assert.deepEqual(paymentIds(entries), ['p403a']);
  assert.equal(entries[0].voided, true);
  const html = unifiedPaymentsSectionHtml(entries, 'bilal', TODAY);
  assert.match(html, /Voided/);
  assert.match(html, /PKR 2,500/);
  assert.match(html, /28 Oct 2026/);
  assert.match(html, /Cash/);
});

test('the search never mutates the state or the entries', () => {
  const state = sheetState();
  const before = JSON.stringify(state);
  const entries = searchUnifiedPayments(state, 'ahmed');
  assert.equal(JSON.stringify(state), before);
  assert.notEqual(entries, searchUnifiedPayments(state, 'ahmed'));
  const entryBefore = JSON.stringify(entries[0]);
  searchUnifiedPayments(state, 'ahmed');
  assert.equal(JSON.stringify(entries[0]), entryBefore);
});

test('the section is a labelled Payments group with one row per entry', () => {
  const html = unifiedPaymentsSectionHtml(searchUnifiedPayments(sheetState(), 'ahmed'), 'ahmed', TODAY);
  assert.match(html, /Payments/);
  assert.match(html, /4 payments/);
  assert.match(html, /#402/);
  assert.match(html, /Faisal Ahmed/);
  // 6 Nov is yesterday against the fixed today; 5 Nov reads as a date.
  assert.match(html, /Yesterday/);
  assert.match(html, /5 Nov 2026/);
  assert.match(html, /JazzCash/);
  assert.match(html, /PKR 1,000/);
  assert.match(html, /PKR 1,500/);
  // The rows are read-only display: no customer id and no action
  // buttons ride them, so the sheet's click delegation never
  // touches a payment row.
  assert.equal(html.includes('data-customer-id'), false);
  assert.equal(html.includes('data-fcs-action'), false);

  const single = unifiedPaymentsSectionHtml(searchUnifiedPayments(sheetState(), 'bilal'), 'bilal', TODAY);
  assert.match(single, /1 payment/);
});

test('an active search with no match says so plainly', () => {
  assert.equal(unifiedPaymentsEmptyText('zzzqqq'), 'No payments match "zzzqqq".');
  const html = unifiedPaymentsSectionHtml([], 'zzzqqq', TODAY);
  assert.match(html, /Payments/);
  assert.match(html, /0 payments/);
  assert.match(html, /No payments match &quot;zzzqqq&quot;\./);
});

test('names and methods are escaped in the rows', () => {
  const html = unifiedPaymentsSectionHtml(searchUnifiedPayments(sheetState(), 'test'), 'test', TODAY);
  assert.match(html, /Test &lt;b&gt;Bold&lt;\/b&gt;/);
  assert.equal(html.includes('<b>Bold</b>'), false);
});

test('one query fills both groups, and no entry lands in the wrong group', () => {
  const state = sheetState();
  const foundCustomers = searchFastCustomers(state, { query: 'ahmed' }, REF_DATE);
  const foundPayments = searchUnifiedPayments(state, 'ahmed');
  // Customers group: the two live Ahmeds, never the archived one.
  assert.deepEqual(foundCustomers.map((c) => c.id).sort(), ['seed-468-01', 'seed-468-02']);
  // Payments group: the ledger entries of every Ahmed, archived
  // included — the ledger lists history, the sheet lists people.
  assert.deepEqual(paymentIds(foundPayments), ['p402a', 'p401a', 'p404a', 'p402b']);
  // The groups hold different kinds of records entirely.
  assert.equal(foundCustomers.every((c) => c.paymentId === undefined), true);
  assert.equal(foundPayments.every((e) => e.customerNumber !== undefined && e.amount !== undefined), true);

  // "bilal" matches in both groups; "2500" matches only payments.
  assert.deepEqual(searchFastCustomers(state, { query: 'bilal' }, REF_DATE).map((c) => c.id), ['seed-468-03']);
  assert.deepEqual(paymentIds(searchUnifiedPayments(state, 'bilal')), ['p403a']);
  assert.deepEqual(searchFastCustomers(state, { query: '2500' }, REF_DATE), []);
  assert.deepEqual(paymentIds(searchUnifiedPayments(state, '2500')), ['p403a']);
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../unified-search.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
  assert.equal(module.includes('document'), false);
});

test('wiring: the sheet composes the payments section under the customers', () => {
  const sheet = readFileSync(new URL('../nav-customer-search.js', import.meta.url), 'utf8');
  assert.ok(sheet.includes("from './unified-search.js'"));
  assert.ok(sheet.includes('searchUnifiedPayments(state, query)'));
  assert.ok(sheet.includes('unifiedPaymentsSectionHtml(payments, query)'));
  assert.ok(sheet.includes("getElementById('fastCustomerSearchPayments')"));
  // The customers group is labelled Customers once the payments
  // group sits below it.
  assert.ok(sheet.includes('Customers (${results.length})'));

  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="fastCustomerSearchPayments"'));
  // The payments region sits after the customer results region.
  assert.ok(html.indexOf('id="fastCustomerSearchPayments"') > html.indexOf('id="fastCustomerSearchResults"'));

  // The wiring lives in the sheet, not in app.js.
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('unified-search.js'), false);
});
