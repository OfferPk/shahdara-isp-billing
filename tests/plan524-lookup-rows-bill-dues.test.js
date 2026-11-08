// Plan 524 — Lookup rows label their figure "bill dues". The picker's
// main list shows the shared total (bill dues plus unpaid manual
// baqaya), while the two live lookup lists (name-prefix and
// last-four-digits) show bill dues only (Plan 488, pinned) — so the
// same customer used to read "PKR 2,000 · Due" in a lookup row and
// "PKR 3,000 DUE" in the list below it. The lookup line now names
// its figure "bill dues" — the same label the form header uses for
// the bill-only figure — so the two figures are visibly different
// kinds of figure rather than contradictory ones. No figure changes
// anywhere: the lookup figure stays bill-only and the main list
// stays the shared total.
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaymentAllocations } from '../core.js';
import {
  formatPickerDuesAmount,
  pickerDuesText,
  pickerDuesEnrichment,
  pickerDuesTextForMatches,
} from '../picker-dues.js';
import {
  namePrefixLookupMatches,
  namePrefixLookupHtml,
} from '../name-prefix-lookup.js';
import {
  findCustomersByLastFourDigits,
  lastFourDigitsHtml,
} from '../last-four-digits-search.js';
import {
  getPendingCollectionCustomers,
  renderQuickCollectCustomerListHtml,
} from '../nav-quick-collect.js';

const REF_DATE = new Date('2026-11-07T10:00:00Z');
const CURRENT_MONTH = '2026-11';

function bill(month, dueAmount, dueDate, payments = []) {
  return { month, dueAmount, dueDate, status: 'pending', payments };
}

// Generic fixtures only — pattern-fake numbers from the 03012345678
// family, never real customer data.
function customers() {
  return [
    // Bill dues Rs 2,000 (October bill unpaid, overdue) plus a Rs 1,000
    // manual baqaya record, which the lookup row never counts.
    { id: 'seed-524-01', name: 'Danish Baqaya', customerNumber: 401, phone: '03012345671', mohalla: 'Mohalla Bani', addedOn: '2026-08-15', bills: [bill('2026-10', 2000, '2026-10-10')], manualBaqaya: [{ id: 'MBQ-5241', amount: 1000, date: '2026-09-15', month: '2026-09', note: 'test' }] },
    // Same bill dues, no baqaya: the two figures agree exactly.
    { id: 'seed-524-02', name: 'Bisma Plain', customerNumber: 402, phone: '03012345672', mohalla: 'Mohalla Bani', addedOn: '2026-09-01', bills: [bill('2026-11', 2000, '2026-11-10')] },
    // Last-four fixture: November bill of 1,200 unpaid, due today, no baqaya.
    { id: 'seed-524-03', name: 'Iqra Four', customerNumber: 403, phone: '03012345678', mohalla: 'Mohalla Dhok', addedOn: '2026-08-30', bills: [bill('2026-11', 1200, '2026-11-07')] },
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
    suspendedCustomerIds: [],
    currentMonth: CURRENT_MONTH,
    referenceDate: REF_DATE,
  };
}

test('the lookup line names its figure bill dues', () => {
  const ctx = context();
  const list = customers();
  assert.equal(pickerDuesText(pickerDuesEnrichment(list[0], ctx)), 'PKR 2,000 bill dues · Overdue');
  assert.equal(pickerDuesText(pickerDuesEnrichment(list[1], ctx)), 'PKR 2,000 bill dues · Due');
  // A row with no status labels at all still names its figure.
  assert.equal(pickerDuesText({ duesCents: 150000, statusLabels: [] }), 'PKR 1,500 bill dues');
  // A missing figure still reads as zero, never blank — with the qualifier.
  assert.equal(pickerDuesText(null), 'PKR 0 bill dues');
  assert.equal(pickerDuesText({}), 'PKR 0 bill dues');
});

test('the lookup figure is still bill dues only — the baqaya is never part of it', () => {
  const ctx = context();
  const list = customers();
  // Rs 2,000 of bill dues, not Rs 3,000: the Rs 1,000 manual baqaya
  // record is not counted, exactly as Plan 488 pinned it.
  assert.equal(pickerDuesEnrichment(list[0], ctx).duesCents, 200000);
  assert.equal(pickerDuesEnrichment(list[1], ctx).duesCents, 200000);
});

test('with baqaya, the lookup row and the main-list row are visibly different kinds of figure', () => {
  const state = pickerState();
  const matches = namePrefixLookupMatches(state.customers, 'da');
  assert.deepEqual(matches.map((m) => m.id), ['seed-524-01']);
  const lines = pickerDuesTextForMatches(state.customers, matches, context());
  const lookupHtml = namePrefixLookupHtml(matches, lines);
  assert.ok(lookupHtml.includes('PKR 2,000 bill dues · Overdue'), 'the lookup row names its figure bill dues');
  assert.ok(lookupHtml.includes('aria-label="Pick Danish Baqaya — Mohalla Bani · PKR 2,000 bill dues · Overdue"'), 'the pick label carries the qualifier');

  // The main list below it shows the shared total — bills plus the
  // unpaid manual baqaya — with its DUE tag, and no "bill dues" label.
  const mainHtml = renderQuickCollectCustomerListHtml(
    getPendingCollectionCustomers(state, '', 'all', REF_DATE),
  );
  assert.ok(mainHtml.includes('PKR 3,000'), 'the main list shows the shared total');
  assert.ok(mainHtml.includes('DUE'), 'the main list tags it DUE');
  assert.equal(mainHtml.includes('bill dues'), false, 'the main list carries no bill-dues qualifier');
});

test('without baqaya the two figures read identically', () => {
  const state = pickerState();
  const matches = namePrefixLookupMatches(state.customers, 'bi');
  assert.deepEqual(matches.map((m) => m.id), ['seed-524-02']);
  const lines = pickerDuesTextForMatches(state.customers, matches, context());
  const lookupHtml = namePrefixLookupHtml(matches, lines);
  assert.ok(lookupHtml.includes('PKR 2,000 bill dues · Due'), 'the lookup row names its figure bill dues');

  // The main list shows the same Rs 2,000 — with no baqaya the
  // shared total and the bill dues are the same figure.
  const mainHtml = renderQuickCollectCustomerListHtml(
    getPendingCollectionCustomers(state, '', 'all', REF_DATE),
  );
  assert.ok(mainHtml.includes('PKR 2,000'), 'the main list shows the same figure');
});

test('last-four rows carry the qualifier too', () => {
  const state = pickerState();
  const matches = findCustomersByLastFourDigits(state.customers, '5678');
  assert.deepEqual(matches.map((m) => m.id), ['seed-524-03']);
  const lines = pickerDuesTextForMatches(state.customers, matches, context());
  const html = lastFourDigitsHtml(matches, '5678', lines);
  assert.ok(html.includes('PKR 1,200 bill dues · Due'), 'the row names its figure bill dues');
  assert.ok(html.includes('aria-label="Pick Iqra Four — Mohalla Dhok · PKR 1,200 bill dues · Due"'), 'the pick label carries the qualifier');
});

test('the amount formatter itself is untouched — only the line gains the qualifier', () => {
  // The PKR amount is still formatted by the same helper, with no
  // qualifier of its own; pickerDuesText is the one place that
  // names the figure.
  assert.equal(formatPickerDuesAmount(200000), 'PKR 2,000');
  assert.equal(pickerDuesText({ duesCents: 200000, statusLabels: ['Overdue'] }), 'PKR 2,000 bill dues · Overdue');
  assert.equal(pickerDuesText({ duesCents: 200000, statusLabels: [] }), 'PKR 2,000 bill dues');
});
