// Plan 488 — Add payment: the customer picker shows dues beside
// each name. The two live lookup lists on the Quick Collect pick
// step (name-prefix and last-four-digits) used to show names only,
// so each row now carries its customer's dues in PKR and status in
// plain words, read from that customer's own records — and never
// changes any record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  finitePickerDuesCents,
  formatPickerDuesAmount,
  pickerDuesEnrichment,
  pickerDuesText,
  pickerDuesLineHtml,
  pickerDuesTextForMatches,
} from '../picker-dues.js';
import { customerStatusDuesCents } from '../customer-status-filter.js';
import { searchResultAccountStatusLabels } from '../search-result-enrichment.js';
import { calculatePaymentAllocations } from '../core.js';
import {
  searchFastCustomers,
} from '../nav-customer-search.js';
import {
  namePrefixLookupMatches,
  namePrefixLookupHtml,
} from '../name-prefix-lookup.js';
import {
  findCustomersByLastFourDigits,
  lastFourDigitsHtml,
} from '../last-four-digits-search.js';

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
    // #301 paid up: November bill fully paid on 5 Nov.
    { id: 'seed-488-01', name: 'Adeel One', customerNumber: 301, phone: '03012345671', mohalla: 'Mohalla Bani', addedOn: '2026-08-15', bills: [bill('2026-11', 1500, '2026-11-10', [payment('p1', 1500, '2026-11-05')])] },
    // #302 due: November bill unpaid, due 10 Nov — not past due yet.
    { id: 'seed-488-02', name: 'Bisma Two', customerNumber: 302, phone: '03012345672', mohalla: 'Mohalla Bani', addedOn: '2026-09-01', bills: [bill('2026-11', 1500, '2026-11-10')] },
    // #303 overdue: October bill unpaid, due 10 Oct — plus a manual
    // baqaya record, which the picker row does not display.
    { id: 'seed-488-03', name: 'Danish Three', customerNumber: 303, phone: '03012345673', mohalla: 'Mohalla Dhok', addedOn: '2026-09-20', bills: [bill('2026-10', 2000, '2026-10-10')], manualBaqaya: [{ id: 'mb-1', amount: 500, month: '2026-09', note: 'test' }] },
    // #304 suspended AND overdue: October bill unpaid, open suspension.
    { id: 'seed-488-04', name: 'Eman Four', customerNumber: 304, phone: '03012345674', mohalla: 'Mohalla Bani', addedOn: '2026-07-11', bills: [bill('2026-10', 1000, '2026-10-10')] },
    // #305 new AND due: added 3 Nov, November bill unpaid.
    { id: 'seed-488-05', name: 'Fahad Five', customerNumber: 305, phone: '03012345675', mohalla: 'Mohalla Bani', addedOn: '2026-11-03', bills: [bill('2026-11', 1500, '2026-11-10')] },
    // #306 new AND paid up: added 1 Nov, no bills at all.
    { id: 'seed-488-06', name: 'Gul Six', customerNumber: 306, phone: '03012345676', mohalla: 'Mohalla Bani', addedOn: '2026-11-01', bills: [] },
    // #307 partial and due: November bill half paid on 6 Nov.
    { id: 'seed-488-07', name: 'Hassan Seven', customerNumber: 307, phone: '03012345677', mohalla: 'Mohalla Bani', addedOn: '2026-10-02', bills: [bill('2026-11', 2000, '2026-11-10', [payment('p7', 500, '2026-11-06')])] },
    // #308 due, not overdue: bill due today, 7 Nov.
    { id: 'seed-488-08', name: 'Iqra Eight', customerNumber: 308, phone: '03012345678', mohalla: 'Mohalla Bani', addedOn: '2026-08-30', bills: [bill('2026-11', 1200, '2026-11-07')] },
    // #309 paisa dues: November bill of 1500.50 unpaid.
    { id: 'seed-488-09', name: 'Junaid Nine', customerNumber: 309, phone: '03012345679', mohalla: 'Mohalla Dhok', addedOn: '2026-06-14', bills: [bill('2026-11', 1500.50, '2026-11-10')] },
    // #310 second 'Ad' name, due: November bill of 1000 unpaid.
    { id: 'seed-488-10', name: 'Adeel Ten', customerNumber: 310, phone: '03012345670', mohalla: 'Mohalla Bani', addedOn: '2026-08-20', bills: [bill('2026-11', 1000, '2026-11-10')] },
  ];
}

function pickerState() {
  return {
    customers: customers().map((customer) => ({ ...customer, area: customer.mohalla, archived: false })),
  };
}

function context() {
  return {
    allocations: calculatePaymentAllocations(pickerState()),
    suspendedCustomerIds: ['seed-488-04'],
    currentMonth: CURRENT_MONTH,
    referenceDate: REF_DATE,
  };
}

test('the dues amount formats in PKR, min-0 decimals, and never guesses', () => {
  assert.equal(formatPickerDuesAmount(0), 'PKR 0');
  assert.equal(formatPickerDuesAmount(150000), 'PKR 1,500');
  assert.equal(formatPickerDuesAmount(150050), 'PKR 1,500.5');
  assert.equal(formatPickerDuesAmount(200000), 'PKR 2,000');
  assert.equal(formatPickerDuesAmount(null), null);
  assert.equal(formatPickerDuesAmount(undefined), null);
  assert.equal(formatPickerDuesAmount('1500'), null);
  assert.equal(formatPickerDuesAmount(true), null);
  assert.equal(formatPickerDuesAmount(NaN), null);
  assert.equal(finitePickerDuesCents(150050.4), 150050);
});

test('dues are the status filter figure, in cents — a manual baqaya is never part of it', () => {
  const list = customers();
  const ctx = context();
  // The same figure the filter computes, on the same fixture.
  for (const customer of list) {
    assert.equal(
      pickerDuesEnrichment(customer, ctx).duesCents,
      customerStatusDuesCents(customer, ctx.allocations),
    );
  }
  assert.equal(pickerDuesEnrichment(list[0], ctx).duesCents, 0);
  assert.equal(pickerDuesEnrichment(list[1], ctx).duesCents, 150000);
  // #303 carries a Rs 500 manual baqaya record — the picker row
  // does not display it, so the enrichment does not count it either.
  assert.equal(pickerDuesEnrichment(list[2], ctx).duesCents, 200000);
  assert.equal(pickerDuesEnrichment(list[5], ctx).duesCents, 0);
  assert.equal(pickerDuesEnrichment(list[6], ctx).duesCents, 150000);
  assert.equal(pickerDuesEnrichment(list[8], ctx).duesCents, 150050);
  assert.equal(pickerDuesEnrichment(null, ctx).duesCents, 0);
  assert.equal(pickerDuesEnrichment(list[1], {}).duesCents, 0);
});

test('status labels are the search enrichment labels, in plain words', () => {
  const list = customers();
  const ctx = context();
  for (const customer of list) {
    assert.deepEqual(
      pickerDuesEnrichment(customer, ctx).statusLabels,
      searchResultAccountStatusLabels(customer, ctx),
    );
  }
  assert.deepEqual(pickerDuesEnrichment(list[0], ctx).statusLabels, ['Paid up']);
  assert.deepEqual(pickerDuesEnrichment(list[1], ctx).statusLabels, ['Due']);
  assert.deepEqual(pickerDuesEnrichment(list[2], ctx).statusLabels, ['Overdue']);
  assert.deepEqual(pickerDuesEnrichment(list[3], ctx).statusLabels, ['Overdue', 'Suspended']);
  assert.deepEqual(pickerDuesEnrichment(list[4], ctx).statusLabels, ['Due', 'New']);
  assert.deepEqual(pickerDuesEnrichment(list[5], ctx).statusLabels, ['Paid up', 'New']);
  // A bill due today is due, not overdue.
  assert.deepEqual(pickerDuesEnrichment(list[7], ctx).statusLabels, ['Due']);
  assert.deepEqual(pickerDuesEnrichment(null, ctx).statusLabels, []);
});

test('the dues text is dues in PKR, then the status — zero, never blank', () => {
  const ctx = context();
  const list = customers();
  assert.equal(pickerDuesText(pickerDuesEnrichment(list[0], ctx)), 'PKR 0 · Paid up');
  assert.equal(pickerDuesText(pickerDuesEnrichment(list[1], ctx)), 'PKR 1,500 · Due');
  assert.equal(pickerDuesText(pickerDuesEnrichment(list[2], ctx)), 'PKR 2,000 · Overdue');
  assert.equal(pickerDuesText(pickerDuesEnrichment(list[3], ctx)), 'PKR 1,000 · Overdue · Suspended');
  assert.equal(pickerDuesText(pickerDuesEnrichment(list[4], ctx)), 'PKR 1,500 · Due · New');
  assert.equal(pickerDuesText(pickerDuesEnrichment(list[5], ctx)), 'PKR 0 · Paid up · New');
  assert.equal(pickerDuesText(pickerDuesEnrichment(list[8], ctx)), 'PKR 1,500.5 · Due');
  assert.equal(pickerDuesText(pickerDuesEnrichment(null, ctx)), 'PKR 0');
  assert.equal(pickerDuesText(null), 'PKR 0');
  assert.equal(pickerDuesText({}), 'PKR 0');
  // A row with no status labels at all shows the amount on its own.
  assert.equal(pickerDuesText({ duesCents: 150000, statusLabels: [] }), 'PKR 1,500');
});

test('the dues line reuses the row meta styling and escapes markup', () => {
  const html = pickerDuesLineHtml({ duesCents: 200000, statusLabels: ['Overdue', 'Suspended'] });
  assert.ok(html.includes('class="qc-cust-meta"'), 'the line reuses the row meta styling');
  assert.ok(html.includes('PKR 2,000 · Overdue · Suspended'), 'the line reads dues then status');
  const escaped = pickerDuesLineHtml({ duesCents: 0, statusLabels: ['<b>Due</b>'] });
  assert.ok(escaped.includes('&lt;b&gt;Due&lt;/b&gt;'), 'a label is escaped, never raw HTML');
  assert.equal(escaped.includes('<b>Due</b>'), false);
  assert.equal(pickerDuesLineHtml(null), '');
  assert.equal(pickerDuesLineHtml({}), '<span class="qc-cust-meta">PKR 0</span>');
});

test('the per-match text covers each listed customer and skips unknown ids', () => {
  const state = pickerState();
  const ctx = context();
  const matches = namePrefixLookupMatches(state.customers, 'ad');
  assert.deepEqual(matches.map((m) => m.id), ['seed-488-01', 'seed-488-10']);
  const lines = pickerDuesTextForMatches(state.customers, matches, ctx);
  assert.equal(lines.size, 2);
  assert.equal(lines.get('seed-488-01'), 'PKR 0 · Paid up');
  assert.equal(lines.get('seed-488-10'), 'PKR 1,000 · Due');
  // An unknown id gets no entry — its row renders as before, never
  // with a guessed figure.
  const unknown = pickerDuesTextForMatches(state.customers, [{ id: 'no-such-customer' }], ctx);
  assert.equal(unknown.size, 0);
  assert.equal(pickerDuesTextForMatches([], matches, ctx).size, 0);
  assert.equal(pickerDuesTextForMatches(null, null, ctx).size, 0);
});

test('the per-match text never mutates its inputs', () => {
  const state = pickerState();
  const before = JSON.parse(JSON.stringify(state.customers));
  const matches = namePrefixLookupMatches(state.customers, 'ad');
  const matchesBefore = JSON.parse(JSON.stringify(matches));
  pickerDuesTextForMatches(state.customers, matches, context());
  assert.deepEqual(state.customers, before);
  assert.deepEqual(matches, matchesBefore);
});

test('the enrichment dues agree with the fast sheet row total on the same fixture', () => {
  const state = pickerState();
  const rows = searchFastCustomers(state, { query: '' }, REF_DATE);
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const customer of state.customers) {
    const row = byId.get(customer.id);
    const enrichment = pickerDuesEnrichment(customer, context());
    // The row shows rupees; the enrichment carries cents — the same
    // figure, so a customer with no dues shows zero, not a blank.
    assert.equal(enrichment.duesCents, Math.round(row.totalDues * 100));
  }
});

test('name-prefix rows show dues and status beside the name and mohalla', () => {
  const state = pickerState();
  const matches = namePrefixLookupMatches(state.customers, 'ad');
  const lines = pickerDuesTextForMatches(state.customers, matches, context());
  const html = namePrefixLookupHtml(matches, lines);
  assert.ok(html.includes('Adeel One'), 'the paid-up row is listed');
  assert.ok(html.includes('Adeel Ten'), 'the due row is listed');
  assert.ok(html.includes('PKR 0 · Paid up'), 'no dues reads as zero with its status');
  assert.ok(html.includes('PKR 1,000 · Due'), 'the due row shows its dues and status');
  assert.ok(html.includes('aria-label="Pick Adeel One — Mohalla Bani · PKR 0 · Paid up"'), 'the pick label carries the dues line');
  assert.equal((html.match(/qc-cust-meta/g) || []).length, 4, 'one mohalla line and one dues line per row');
});

test('name-prefix rows without the dues map render exactly as before', () => {
  const state = pickerState();
  const html = namePrefixLookupHtml(namePrefixLookupMatches(state.customers, 'ad'));
  assert.ok(html.includes('Adeel One'));
  assert.ok(html.includes('Mohalla Bani'));
  assert.equal(html.includes('PKR'), false, 'no dues line without the map');
  assert.equal((html.match(/qc-cust-meta/g) || []).length, 2, 'one meta line per row, as before');
});

test('name-prefix dues text is escaped, never raw HTML', () => {
  const state = pickerState();
  const matches = namePrefixLookupMatches(state.customers, 'ad');
  const lines = new Map([['seed-488-01', 'PKR 0 · <b>Paid up</b>']]);
  const html = namePrefixLookupHtml(matches, lines);
  assert.ok(html.includes('&lt;b&gt;Paid up&lt;/b&gt;'));
  assert.equal(html.includes('<b>Paid up</b>'), false);
});

test('last-four rows show dues and status beside the name and mohalla', () => {
  const state = pickerState();
  const matches = findCustomersByLastFourDigits(state.customers, '5678');
  assert.deepEqual(matches.map((m) => m.id), ['seed-488-08']);
  const lines = pickerDuesTextForMatches(state.customers, matches, context());
  const html = lastFourDigitsHtml(matches, '5678', lines);
  assert.ok(html.includes('Iqra Eight'), 'the row is listed');
  assert.ok(html.includes('PKR 1,200 · Due'), 'the row shows its dues and status');
  assert.ok(html.includes('aria-label="Pick Iqra Eight — Mohalla Bani · PKR 1,200 · Due"'), 'the pick label carries the dues line');
});

test('last-four rows without the dues map render exactly as before', () => {
  const state = pickerState();
  const html = lastFourDigitsHtml(findCustomersByLastFourDigits(state.customers, '5678'), '5678');
  assert.ok(html.includes('Iqra Eight'));
  assert.equal(html.includes('PKR'), false, 'no dues line without the map');
  // Four digits with no match still render the plain no-match line.
  assert.ok(lastFourDigitsHtml([], '5678').includes('No customer phone ends with 5678.'));
});

// The module is pure: no document, no store, no clock, no network.
test('the module is pure and keeps no store', () => {
  const source = readFileSync(new URL('../picker-dues.js', import.meta.url), 'utf8');
  const header = source.slice(0, source.indexOf('*/'));
  assert.equal(header.includes('.js'), false, 'the header names no file literally');
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /new Date\(/);
  assert.doesNotMatch(source, /Date\.now\(/);
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /window\./);
  assert.doesNotMatch(source, /shahdara_/);
});

// Wiring: the Quick Collect controller passes the dues line to both
// lookup lists, and nothing else changes.
test('wiring: the controller imports the picker-dues module and passes the line to both lookup lists', () => {
  const wiring = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(wiring, /from '\.\/picker-dues\.js'/);
  assert.match(wiring, /pickerDuesTextForMatches/);
  assert.match(wiring, /pickerLookupDuesContext/);
  assert.match(wiring, /calculatePaymentAllocations\(state\)/);
  assert.match(wiring, /monthsForHistory\(referenceDate\)\[0\]/);
  const namePrefix = wiring.slice(wiring.indexOf('function renderNamePrefixList()'));
  assert.match(namePrefix.slice(0, 800), /namePrefixLookupHtml\(matches, pickerDuesTextForMatches\(state\?\.customers \?\? \[\], matches, pickerLookupDuesContext\(state\)\)\)/);
  const lastFour = wiring.slice(wiring.indexOf('function renderLastFourList()'));
  assert.match(lastFour.slice(0, 800), /lastFourDigitsHtml\(matches, query, pickerDuesTextForMatches\(state\?\.customers \?\? \[\], matches, pickerLookupDuesContext\(state\)\)\)/);
  // Exactly three uses of the map builder: the import and the two
  // lookup renders — the main list and the recent row are untouched,
  // so no third render ever picks the line up.
  assert.equal((wiring.match(/pickerDuesTextForMatches/g) || []).length, 3);
});

test('wiring: the lookup modules take the dues map, and the app shell does not', () => {
  const namePrefix = readFileSync(new URL('../name-prefix-lookup.js', import.meta.url), 'utf8');
  assert.match(namePrefix, /namePrefixLookupHtml\(matches, duesTextById\)/);
  const lastFour = readFileSync(new URL('../last-four-digits-search.js', import.meta.url), 'utf8');
  assert.match(lastFour, /lastFourDigitsHtml\(matches, query, duesTextById\)/);
  // Plan 488 wires the Quick Collect picker only — the app shell
  // and the main list renderer never import the picker-dues module.
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(app.includes('picker-dues'), false, 'the app shell does not import the picker-dues module');
  const recent = readFileSync(new URL('../recent-quick-pick.js', import.meta.url), 'utf8');
  assert.equal(recent.includes('pickerDues'), false, 'the recent row keeps its own dues display');
});
