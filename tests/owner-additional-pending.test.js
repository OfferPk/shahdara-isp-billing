// OWNER-ADDPEND (2026-11-01): editable "Additional Pending" amount on
// the customer card + profile. Owner's words: the card shows "Pending
// · Rs 3000" for the bill; if the customer also has a previous amount
// or a loan, the owner types it right there (e.g. 1,500), saves, and
// the pending shows the TOTAL 4,500.
//
// Design pinned here: there is NO second store. The additional amount
// IS the outstanding manual baqaya (OWNER-LOAN, MBQ-101+ entries on
// the customer record). This feature adds (a) a combined display —
// total + "Bill X + Additional Y" breakdown from the ONE shared
// helper totalOutstandingFigures — and (b) a quick editor whose write
// path is core.setManualBaqayaOutstanding: an increase creates ONE new
// entry for the difference; a decrease stamps auditable adjustments
// ({amount, date, note}) against the NEWEST open entries first (LIFO),
// subtracted in the same remaining derivation as settlement stamps
// but NEVER restored by a payment void (owner decision ≠ cash).
// The allocation engine is untouched; the editor creates no payments.
//
// Synthetic data only — no real customer names anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addManualBaqayaEntry,
  calculatePaymentAllocations,
  createJsonBackup,
  manualBaqayaEntriesWithRemaining,
  manualBaqayaOutstanding,
  persistState,
  previewJsonBackupMerge,
  readState,
  saveBillMonth,
  setManualBaqayaOutstanding
} from '../core.js';
import {
  additionalPendingControlsMarkup,
  manualBaqayaCardBadgeMarkup,
  manualBaqayaSectionMarkup,
  totalOutstandingFigures
} from '../manual-baqaya.js';
import {
  executeQuickCollection,
  getCustomerPaymentDefaults
} from '../nav-quick-collect.js';
import { voidPayment } from '../payment-void-audit.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

function baseCustomer(overrides = {}) {
  return {
    id: 'cust-1',
    customerNumber: 101,
    name: 'Synthetic Subscriber',
    phone: '03001234567',
    area: 'Test Area',
    archived: false,
    isFreeConnection: false,
    monthlyPriceSchedule: [],
    relocationLog: [],
    pauseSkippedMonths: [],
    bills: [],
    incidents: [],
    installmentPlans: [],
    ...overrides
  };
}

/** Customer with an unpaid October bill of Rs 3,000. */
function stateWithDueBill() {
  let state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: 3000, status: 'pending' }, REF);
  return state;
}

function setAdditional(state, amount, note = 'Additional pending') {
  return setManualBaqayaOutstanding(state, 'cust-1', { amount, date: '2026-10-15', note }, REF);
}

function collect(state, amount, month = MONTH) {
  return executeQuickCollection(state, {
    customerId: 'cust-1', month, amount, date: '2026-10-15', method: 'Cash'
  }, REF);
}

function paymentCount(customer) {
  return (customer.bills ?? []).reduce((sum, bill) => sum + (bill.payments ?? []).length, 0);
}

test('spec pin: bill due 3,000 + additional 1,500 → total 4,500 with breakdown on card + profile figures', () => {
  let state = stateWithDueBill();
  state = setAdditional(state, 1500);
  const customer = state.customers[0];

  const figures = totalOutstandingFigures(customer, calculatePaymentAllocations(state));
  assert.equal(figures.billDues, 3000);
  assert.equal(figures.manualBaqaya, 1500);
  assert.equal(figures.total, 4500);

  const markup = additionalPendingControlsMarkup(customer, calculatePaymentAllocations(state));
  assert.match(markup, /Total pending PKR 4,500/);
  assert.match(markup, /Bill PKR 3,000 \+ Additional PKR 1,500/);
  assert.match(markup, /data-additional-pending="cust-1"/);
  // The pre-existing baqaya badge still renders alongside (unchanged).
  assert.match(manualBaqayaCardBadgeMarkup(customer), /PKR 1,500/);
});

test('additional 0 → legacy rendering: only the subtle ＋ Additional affordance, no total/breakdown', () => {
  const state = stateWithDueBill();
  const customer = state.customers[0];
  const markup = additionalPendingControlsMarkup(customer, calculatePaymentAllocations(state));
  assert.match(markup, /data-additional-pending="cust-1"/);
  assert.match(markup, /Additional/);
  assert.doesNotMatch(markup, /Total pending/);
  assert.doesNotMatch(markup, /additional-pending-breakdown/);
  assert.equal(manualBaqayaCardBadgeMarkup(customer), '');
});

test('editor increase creates exactly one MBQ entry for the difference; a second increase adds only its difference', () => {
  let state = stateWithDueBill();
  state = setAdditional(state, 1500);
  let entries = state.customers[0].manualBaqaya;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'MBQ-101');
  assert.equal(entries[0].amount, 1500);
  const firstEntrySnapshot = JSON.parse(JSON.stringify(entries[0]));

  state = setAdditional(state, 2500);
  entries = state.customers[0].manualBaqaya;
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], firstEntrySnapshot, 'first entry history is never rewritten');
  assert.equal(entries[1].id, 'MBQ-102');
  assert.equal(entries[1].amount, 1000);
  assert.equal(manualBaqayaOutstanding(state.customers[0]), 2500);
  // The editor never creates payment records.
  assert.equal(paymentCount(state.customers[0]), 0);
});

test('editor decrease stamps adjustments LIFO (newest open entry first); decrease to 0 clears', () => {
  let state = stateWithDueBill();
  state = addManualBaqayaEntry(state, 'cust-1', { amount: 1000, date: '2026-08-05', note: 'August' }, REF);
  state = addManualBaqayaEntry(state, 'cust-1', { amount: 800, date: '2026-09-05', note: 'September' }, REF);
  assert.equal(manualBaqayaOutstanding(state.customers[0]), 1800);

  state = setAdditional(state, 1200, 'Owner correction');
  let byId = Object.fromEntries(manualBaqayaEntriesWithRemaining(state.customers[0]).map(e => [e.id, e]));
  // The 600 reduction lands entirely on the NEWEST entry (MBQ-102).
  assert.equal(byId['MBQ-102'].adjustedCents, 60000);
  assert.equal(byId['MBQ-102'].remainingCents, 20000);
  assert.equal(byId['MBQ-101'].adjustedCents, 0);
  assert.equal(byId['MBQ-101'].remainingCents, 100000);
  assert.equal(manualBaqayaOutstanding(state.customers[0]), 1200);
  // Entry amounts (history) are untouched — only adjustments were stamped.
  assert.equal(state.customers[0].manualBaqaya.find(e => e.id === 'MBQ-102').amount, 800);
  assert.equal(state.customers[0].manualBaqaya.find(e => e.id === 'MBQ-102').adjustments[0].amount, 600);
  assert.equal(state.customers[0].manualBaqaya.find(e => e.id === 'MBQ-102').adjustments[0].note, 'Owner correction');

  state = setAdditional(state, 0);
  assert.equal(manualBaqayaOutstanding(state.customers[0]), 0);
  byId = Object.fromEntries(manualBaqayaEntriesWithRemaining(state.customers[0]).map(e => [e.id, e]));
  assert.equal(byId['MBQ-101'].remainingCents, 0);
  assert.equal(byId['MBQ-102'].remainingCents, 0);
  assert.equal(state.customers[0].manualBaqaya.length, 2, 'cleared entries stay as auditable history');

  // A fully adjusted (never paid) entry reads as Adjusted, not Paid.
  const section = manualBaqayaSectionMarkup(state.customers[0], { archived: false });
  assert.match(section, /Adjusted/);
});

test('decrease cannot go below zero: negative and NaN totals are refused with state byte-identical', () => {
  const state = setAdditional(stateWithDueBill(), 1500);
  const before = JSON.stringify(state);
  assert.throws(() => setManualBaqayaOutstanding(state, 'cust-1', { amount: -5, date: '2026-10-15' }, REF), /zero or more/);
  assert.throws(() => setManualBaqayaOutstanding(state, 'cust-1', { amount: NaN, date: '2026-10-15' }, REF), /zero or more/);
  assert.throws(() => setManualBaqayaOutstanding(state, 'cust-1', { amount: 'abc', date: '2026-10-15' }, REF), /zero or more/);
  assert.equal(JSON.stringify(state), before);
});

test('FREE and archived customers are refused; no state write', () => {
  const freeState = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer({ isFreeConnection: true })] };
  assert.throws(() => setManualBaqayaOutstanding(freeState, 'cust-1', { amount: 100, date: '2026-10-15' }, REF), /Free connections never owe/);
  assert.equal(additionalPendingControlsMarkup(freeState.customers[0]), '');

  let archivedState = setAdditional(stateWithDueBill(), 500);
  archivedState = { ...archivedState, customers: archivedState.customers.map(c => ({ ...c, archived: true, archivedAt: '2026-10-14T00:00:00.000Z' })) };
  assert.throws(() => setManualBaqayaOutstanding(archivedState, 'cust-1', { amount: 900, date: '2026-10-15' }, REF), /Archived customers cannot/);
  assert.equal(additionalPendingControlsMarkup(archivedState.customers[0]), '');
  assert.equal(manualBaqayaOutstanding(archivedState.customers[0]), 500, 'existing baqaya stays readable on archived profiles');
});

test('no-op save (same total) returns the identical state reference — nothing is written', () => {
  const state = setAdditional(stateWithDueBill(), 1500);
  const result = setManualBaqayaOutstanding(state, 'cust-1', { amount: 1500, date: '2026-10-15', note: 'ignored' }, REF);
  assert.equal(result, state);
  const empty = stateWithDueBill();
  assert.equal(setManualBaqayaOutstanding(empty, 'cust-1', { amount: 0, date: '2026-10-15' }, REF), empty);
});

test('collection consistency: QC figure is 4,500; a full collection settles bill + additional; receipt carries the MBQ line', () => {
  let state = stateWithDueBill();
  state = setAdditional(state, 1500);

  const defaults = getCustomerPaymentDefaults(state, 'cust-1', REF);
  assert.equal(defaults.manualBaqayaPending, 1500);
  assert.equal(defaults.payableTotal, 4500);

  const { nextState, receipt } = collect(state, 4500);
  assert.equal(receipt.manualBaqayaSettledTotal, 1500);
  assert.deepEqual(receipt.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: 1500 }]);
  assert.equal(receipt.payableRemaining, 0);
  assert.equal(manualBaqayaOutstanding(nextState.customers[0]), 0);
  assert.equal(calculatePaymentAllocations(nextState).forMonth('cust-1', MONTH).balanceDueCents, 0);
});

test('collection consistency: a 2,000 part-collection settles bill first and leaves the additional whole', () => {
  let state = stateWithDueBill();
  state = setAdditional(state, 1500);
  const { nextState, receipt } = collect(state, 2000);
  assert.equal(receipt.manualBaqayaSettledTotal, 0);
  assert.equal(calculatePaymentAllocations(nextState).forMonth('cust-1', MONTH).balanceDueCents, 100000);
  assert.equal(manualBaqayaOutstanding(nextState.customers[0]), 1500);
  const figures = totalOutstandingFigures(nextState.customers[0]);
  assert.equal(figures.total, 2500);
});

test('void restores the additional exactly; an owner adjustment is NOT restored by a void', () => {
  let state = stateWithDueBill();
  state = setAdditional(state, 1500);
  const { nextState } = collect(state, 4500);
  const payment = nextState.customers[0].bills.find(b => b.month === MONTH).payments.at(-1);
  const { state: voidedState } = voidPayment(nextState, 'cust-1', MONTH, payment.id, { voidReason: 'Wrong amount recorded' });
  assert.equal(manualBaqayaOutstanding(voidedState.customers[0]), 1500);
  assert.equal(calculatePaymentAllocations(voidedState).forMonth('cust-1', MONTH).balanceDueCents, 300000);

  // Settle 500 of the baqaya, reduce the total by adjustment, then void:
  // the 500 settlement unwinds, the 600 adjustment stays.
  let s2 = stateWithDueBill();
  s2 = setAdditional(s2, 1500);
  const paidBill = collect(s2, 3000).nextState; // bill settled, baqaya untouched
  const settled = collect(paidBill, 500).nextState; // baqaya 1,500 → 1,000
  assert.equal(manualBaqayaOutstanding(settled.customers[0]), 1000);
  const reduced = setAdditional(settled, 400, 'Owner wrote off 600');
  assert.equal(manualBaqayaOutstanding(reduced.customers[0]), 400);
  const settlingPayment = reduced.customers[0].bills.find(b => b.month === MONTH).payments.at(-1);
  const { state: afterVoid } = voidPayment(reduced, 'cust-1', MONTH, settlingPayment.id, { voidReason: 'Recorded twice' });
  assert.equal(manualBaqayaOutstanding(afterVoid.customers[0]), 900, 'settlement restored (500), adjustment kept (600): 1500 − 600 = 900');
});

test('backup round-trip: editor-created entries AND adjustment stamps survive persist/read and JSON backup merge', () => {
  let state = stateWithDueBill();
  state = setAdditional(state, 1500);
  state = setAdditional(state, 900, 'Reduced by owner');

  const storage = memoryStorage();
  persistState(state, storage);
  const reloaded = readState(storage);
  assert.equal(manualBaqayaOutstanding(reloaded.customers[0]), 900);
  const [entry] = reloaded.customers[0].manualBaqaya;
  assert.equal(entry.id, 'MBQ-101');
  assert.equal(entry.amount, 1500);
  assert.equal(entry.adjustments.length, 1);
  assert.equal(entry.adjustments[0].amount, 600);

  const backupJson = createJsonBackup(state, REF);
  const parsed = JSON.parse(backupJson);
  assert.equal(parsed.state.customers[0].manualBaqaya[0].adjustments[0].amount, 600);
  const localOnly = stateWithDueBill();
  const preview = previewJsonBackupMerge(localOnly, backupJson);
  assert.equal(preview.canApply, true);
  const adopted = preview.state.customers[0];
  assert.equal(adopted.manualBaqaya.length, 1);
  assert.equal(adopted.manualBaqaya[0].adjustments[0].amount, 600);
  assert.equal(manualBaqayaOutstanding(adopted), 900);
});

test('legacy entries without adjustments stay byte-identical through the sanitizer', () => {
  let state = stateWithDueBill();
  state = addManualBaqayaEntry(state, 'cust-1', { amount: 1500, date: '2026-09-10', note: 'Last month balance' }, REF);
  const storage = memoryStorage();
  persistState(state, storage);
  const reloaded = readState(storage);
  assert.deepEqual(reloaded.customers[0].manualBaqaya, state.customers[0].manualBaqaya);
  assert.equal('adjustments' in reloaded.customers[0].manualBaqaya[0], false);
  const [withRemaining] = manualBaqayaEntriesWithRemaining(reloaded.customers[0]);
  assert.equal(withRemaining.adjustedCents, 0);
  assert.equal(withRemaining.remainingCents, 150000);
});

test('wiring: dialog + controls are mounted in index.html / app.js and every new key exists in both dictionaries', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  for (const id of ['additionalPendingDialog', 'additionalPendingForm', 'additionalPendingBillDue', 'additionalPendingAmount', 'additionalPendingTotal', 'additionalPendingWarning', 'additionalPendingNote']) {
    assert.ok(html.includes(`id="${id}"`), `index.html missing #${id}`);
    assert.ok(app.includes(`#${id}`), `app.js never references #${id}`);
  }
  assert.match(html, /data-help="additional_pending"/);
  assert.ok(app.includes('setManualBaqayaOutstanding'), 'app.js must write through the core editor path');
  assert.ok(app.includes('data-additional-pending'), 'app.js must bind the card/profile editor buttons');

  const newKeys = [
    'addpend_add', 'addpend_edit', 'addpend_total_label', 'addpend_breakdown',
    'addpend_dialog_title', 'addpend_bill_label', 'addpend_amount_label',
    'addpend_total_live', 'addpend_warning', 'addpend_default_note',
    'addpend_save', 'addpend_saved', 'addpend_invalid',
    'baqaya_status_adjusted', 'baqaya_entry_adjusted_part',
    'help_additional_pending_title', 'help_additional_pending_body'
  ];
  for (const key of newKeys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `missing en key ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `missing ur key ${key}`);
    assert.notEqual(TRANSLATIONS.en[key], key);
    assert.notEqual(TRANSLATIONS.ur[key], key);
  }
});
