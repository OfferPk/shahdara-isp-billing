// Plan 463 — Search results show dues and status inline: one
// enrichment per fast-sheet result row (the sheet's own dues figure
// in cents, the account status in plain words, and the last payment
// date), read from that customer's own records — and never changing
// any record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  searchResultDuesCents,
  searchResultLastPaymentDate,
  searchResultAccountStatusLabels,
  searchResultEnrichment,
  searchResultEnrichmentHtml,
} from '../search-result-enrichment.js';
import { customerStatusDuesCents } from '../customer-status-filter.js';
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

function payment(id, amount, date, extra = {}) {
  return { id, amount, date, ...extra };
}

// Generic fixtures only — pattern-fake numbers from the 03012345678
// family, never real customer data.
function customers() {
  return [
    // #201 paid up: November bill fully paid on 5 Nov.
    { id: 'seed-463-01', name: 'Adeel One', customerNumber: 201, phone: '03012345678', mohalla: 'Mohalla Bani', addedOn: '2026-08-15', bills: [bill('2026-11', 1500, '2026-11-10', [payment('p1', 1500, '2026-11-05')])] },
    // #202 due: November bill unpaid, due 10 Nov — not past due yet.
    { id: 'seed-463-02', name: 'Bisma Two', customerNumber: 202, phone: '03012345679', mohalla: 'Mohalla Bani', addedOn: '2026-09-01', bills: [bill('2026-11', 1500, '2026-11-10')] },
    // #203 overdue: October bill unpaid, due 10 Oct — plus a manual
    // baqaya record, which the sheet does not display.
    { id: 'seed-463-03', name: 'Danish Three', customerNumber: 203, phone: '03012345670', mohalla: 'Mohalla Dhok', addedOn: '2026-09-20', bills: [bill('2026-10', 2000, '2026-10-10')], manualBaqaya: [{ id: 'mb-1', amount: 500, month: '2026-09', note: 'test' }] },
    // #204 suspended AND overdue: October bill unpaid, open suspension.
    { id: 'seed-463-04', name: 'Eman Four', customerNumber: 204, phone: '03012345671', mohalla: 'Mohalla Bani', addedOn: '2026-07-11', bills: [bill('2026-10', 1000, '2026-10-10')] },
    // #205 new AND due: added 3 Nov, November bill unpaid.
    { id: 'seed-463-05', name: 'Fahad Five', customerNumber: 205, phone: '03012345672', mohalla: 'Mohalla Bani', addedOn: '2026-11-03', bills: [bill('2026-11', 1500, '2026-11-10')] },
    // #206 new AND paid up: added 1 Nov, no bills at all.
    { id: 'seed-463-06', name: 'Gul Six', customerNumber: 206, phone: '03012345673', mohalla: 'Mohalla Bani', addedOn: '2026-11-01', bills: [] },
    // #207 partial and due: November bill half paid on 6 Nov.
    { id: 'seed-463-07', name: 'Hassan Seven', customerNumber: 207, phone: '03012345674', mohalla: 'Mohalla Bani', addedOn: '2026-10-02', bills: [bill('2026-11', 2000, '2026-11-10', [payment('p7', 500, '2026-11-06')])] },
    // #208 due, not overdue: bill due today, 7 Nov.
    { id: 'seed-463-08', name: 'Iqra Eight', customerNumber: 208, phone: '03012345675', mohalla: 'Mohalla Bani', addedOn: '2026-08-30', bills: [bill('2026-11', 1200, '2026-11-07')] },
    // #209 overdue with no explicit due date: October bill falls back
    // to the 10th of its month.
    { id: 'seed-463-09', name: 'Junaid Nine', customerNumber: 209, phone: '03012345676', mohalla: 'Mohalla Dhok', addedOn: '2026-06-14', bills: [{ month: '2026-10', dueAmount: 1000, status: 'pending', payments: [] }] },
    // #210 last-payment edges: the latest payment is voided, a zero
    // payment and an impossible date also sit on the bill — only the
    // 2 Nov payment qualifies.
    { id: 'seed-463-10', name: 'Kiran Ten', customerNumber: 210, phone: '03012345677', mohalla: 'Mohalla Bani', addedOn: '2026-08-01', bills: [bill('2026-11', 2000, '2026-11-10', [
      payment('p10a', 1000, '2026-11-02'),
      payment('p10b', 500, '2026-11-06', { voided: true }),
      payment('p10c', 0, '2026-11-07'),
      payment('p10d', 100, '2026-02-30'),
    ])] },
    // #211 suspended AND paid up: open suspension, no bills at all.
    { id: 'seed-463-11', name: 'Laila Eleven', customerNumber: 211, phone: '03012345678', mohalla: 'Mohalla Bani', addedOn: '2026-05-01', bills: [] },
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
    suspendedCustomerIds: ['seed-463-04', 'seed-463-11'],
    currentMonth: CURRENT_MONTH,
    referenceDate: REF_DATE,
  };
}

test('dues are the sheet\'s own bill-balance figure, in cents', () => {
  const list = customers();
  const allocations = calculatePaymentAllocations(sheetState());
  assert.equal(searchResultDuesCents(list[0], allocations), 0);
  assert.equal(searchResultDuesCents(list[1], allocations), 150000);
  assert.equal(searchResultDuesCents(list[2], allocations), 200000);
  assert.equal(searchResultDuesCents(list[5], allocations), 0);
  assert.equal(searchResultDuesCents(list[6], allocations), 150000);
  assert.equal(searchResultDuesCents(list[7], allocations), 120000);
  assert.equal(searchResultDuesCents(null, allocations), 0);
  assert.equal(searchResultDuesCents(list[1], null), 0);
});

test('dues are the status filter\'s figure, and a manual baqaya is never part of it', () => {
  const list = customers();
  const allocations = calculatePaymentAllocations(sheetState());
  // The same figure the filter computes, on the same fixture.
  for (const customer of list) {
    assert.equal(searchResultDuesCents(customer, allocations), customerStatusDuesCents(customer, allocations));
  }
  // #203 carries a Rs 500 manual baqaya record — the sheet does not
  // display it, so the enrichment does not count it either.
  assert.equal(searchResultDuesCents(list[2], allocations), 200000);
});

test('the enrichment dues agree with the sheet\'s row total on the same fixture', () => {
  const state = sheetState();
  const rows = searchFastCustomers(state, { query: '' }, REF_DATE);
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const customer of state.customers) {
    const row = byId.get(customer.id);
    const enrichment = searchResultEnrichment(customer, context());
    // The row shows rupees; the enrichment carries cents — the same
    // figure, so a customer with no dues shows zero, not a blank.
    assert.equal(enrichment.duesCents, Math.round(row.totalDues * 100));
  }
});

test('status labels: the dues state in plain words', () => {
  const list = customers();
  const ctx = context();
  assert.deepEqual(searchResultAccountStatusLabels(list[0], ctx), ['Paid up']);
  assert.deepEqual(searchResultAccountStatusLabels(list[1], ctx), ['Due']);
  assert.deepEqual(searchResultAccountStatusLabels(list[2], ctx), ['Overdue']);
  assert.deepEqual(searchResultAccountStatusLabels(list[6], ctx), ['Due']);
  assert.deepEqual(searchResultAccountStatusLabels(list[8], ctx), ['Overdue']);
  assert.deepEqual(searchResultAccountStatusLabels(null, ctx), []);
});

test('status labels: suspended and new ride beside the dues state, never instead of it', () => {
  const list = customers();
  const ctx = context();
  assert.deepEqual(searchResultAccountStatusLabels(list[3], ctx), ['Overdue', 'Suspended']);
  assert.deepEqual(searchResultAccountStatusLabels(list[4], ctx), ['Due', 'New']);
  assert.deepEqual(searchResultAccountStatusLabels(list[5], ctx), ['Paid up', 'New']);
  assert.deepEqual(searchResultAccountStatusLabels(list[10], ctx), ['Paid up', 'Suspended']);
});

test('status labels: a bill due today is due, not overdue', () => {
  const list = customers();
  assert.deepEqual(searchResultAccountStatusLabels(list[7], context()), ['Due']);
});

test('last payment date: the latest qualifying payment on any bill', () => {
  const list = customers();
  assert.equal(searchResultLastPaymentDate(list[0]), '2026-11-05');
  assert.equal(searchResultLastPaymentDate(list[6]), '2026-11-06');
  assert.equal(searchResultLastPaymentDate(list[1]), null);
  assert.equal(searchResultLastPaymentDate(list[5]), null);
  assert.equal(searchResultLastPaymentDate(null), null);
  assert.equal(searchResultLastPaymentDate({ id: 'x', bills: [] }), null);
});

test('last payment date skips voided, zero, dateless, and impossible payments', () => {
  const list = customers();
  // #210: the 6 Nov payment is voided, the 7 Nov one is zero, and
  // 30 Feb never happened — only the 2 Nov payment qualifies.
  assert.equal(searchResultLastPaymentDate(list[9]), '2026-11-02');
  const dateless = { id: 'x', bills: [{ month: '2026-11', payments: [{ id: 'p', amount: 100 }] }] };
  assert.equal(searchResultLastPaymentDate(dateless), null);
  const zeroOnly = { id: 'x', bills: [{ month: '2026-11', payments: [{ id: 'p', amount: 0, date: '2026-11-01' }] }] };
  assert.equal(searchResultLastPaymentDate(zeroOnly), null);
});

test('the enrichment combines dues, status, and last payment — and never mutates its input', () => {
  const list = customers();
  const before = JSON.parse(JSON.stringify(list));
  const ctx = context();
  assert.deepEqual(searchResultEnrichment(list[0], ctx), {
    duesCents: 0,
    statusLabels: ['Paid up'],
    lastPaymentDate: '2026-11-05',
  });
  assert.deepEqual(searchResultEnrichment(list[3], ctx), {
    duesCents: 100000,
    statusLabels: ['Overdue', 'Suspended'],
    lastPaymentDate: null,
  });
  assert.deepEqual(searchResultEnrichment(list[4], ctx), {
    duesCents: 150000,
    statusLabels: ['Due', 'New'],
    lastPaymentDate: null,
  });
  assert.deepEqual(searchResultEnrichment(null, ctx), {
    duesCents: 0,
    statusLabels: [],
    lastPaymentDate: null,
  });
  assert.deepEqual(list, before);
});

test('the enrichment line shows the status and the last payment date in plain words', () => {
  const html = searchResultEnrichmentHtml({
    duesCents: 200000,
    statusLabels: ['Overdue', 'Suspended'],
    lastPaymentDate: '2026-11-05',
  });
  assert.ok(html.includes('Overdue'), 'the status is on the line');
  assert.ok(html.includes('Suspended'), 'the second label is on the line');
  assert.ok(html.includes('Last payment: 5 Nov 2026'), 'the date reads as a day, not a stamp');
  assert.ok(html.includes('class="fcs-meta-row"'), 'the line reuses the row meta styling');
  assert.equal(html.includes('class="fcs-dues'), false, 'the line adds no second dues column');

  const noPayment = searchResultEnrichmentHtml({
    duesCents: 150000,
    statusLabels: ['Due'],
    lastPaymentDate: null,
  });
  assert.ok(noPayment.includes('Due'), 'the status is on the line');
  assert.ok(noPayment.includes('No payment recorded'), 'no payment reads plainly, never blank');
});

test('the enrichment line escapes markup and renders nothing without a status', () => {
  const html = searchResultEnrichmentHtml({
    duesCents: 0,
    statusLabels: ['<b>Due</b>'],
    lastPaymentDate: null,
  });
  assert.ok(html.includes('&lt;b&gt;Due&lt;/b&gt;'), 'a label is escaped, never raw HTML');
  assert.equal(html.includes('<b>Due</b>'), false);
  assert.equal(searchResultEnrichmentHtml({ duesCents: 0, statusLabels: [], lastPaymentDate: null }), '');
  assert.equal(searchResultEnrichmentHtml(null), '');
  assert.equal(searchResultEnrichmentHtml({}), '');
});

test('the module header names no file literally and reads no storage or clock', () => {
  const module = readFileSync(new URL('../search-result-enrichment.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false);
  assert.equal(module.includes('localStorage'), false);
  // The clock check is `new Date(` / `Date.now` — a bare `Date(`
  // also matches pure helpers, which are not clock reads.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
});

test('wiring: the fast sheet rows carry the enrichment, and the row shows it', () => {
  const state = sheetState();
  const rows = searchFastCustomers(state, {
    query: '',
    suspendedCustomerIds: ['seed-463-04', 'seed-463-11'],
  }, REF_DATE);
  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.deepEqual(byId.get('seed-463-03').accountStatusLabels, ['Overdue']);
  assert.equal(byId.get('seed-463-03').lastPaymentDate, null);
  assert.deepEqual(byId.get('seed-463-01').accountStatusLabels, ['Paid up']);
  assert.equal(byId.get('seed-463-01').lastPaymentDate, '2026-11-05');

  const html = renderFastCustomerSearchResultsHtml(rows);
  assert.ok(html.includes('Overdue'), 'the overdue row shows its status');
  assert.ok(html.includes('Last payment: 5 Nov 2026'), 'the paid row shows its last payment');
  assert.ok(html.includes('No payment recorded'), 'a row with no payment says so plainly');
  assert.ok(html.includes('Paid up'), 'the paid-up row shows its status');
  // The dues column is the sheet's own figure — a customer with no
  // dues shows zero, not a blank.
  assert.ok(html.includes('PKR 0'), 'no dues reads as zero');
  assert.ok(html.includes('PKR 1,500'), 'the due figure reads in rupees');
});

test('wiring: the sheet imports the enrichment module; the list is untouched', () => {
  const sheet = readFileSync(new URL('../nav-customer-search.js', import.meta.url), 'utf8');
  assert.ok(sheet.includes("from './search-result-enrichment.js'"), 'the sheet imports the enrichment module');
  assert.ok(sheet.includes('searchResultEnrichment(customer, {'), 'the sheet enriches each result');
  assert.ok(sheet.includes('searchResultEnrichmentHtml({ statusLabels: c.accountStatusLabels, lastPaymentDate: c.lastPaymentDate })'), 'the row renders the enrichment line');
  // Plan 463 wires the fast customer search sheet only — the
  // Customers list roster is a different surface and is untouched.
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('search-result-enrichment'), false, 'the list does not import the enrichment module');
});
