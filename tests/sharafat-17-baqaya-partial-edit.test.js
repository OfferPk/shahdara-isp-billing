// Sharafat 17: a partially-settled manual baqaya entry can be corrected
// again — note/date edits are allowed (the amount stays locked, remove
// stays locked), and a partially-adjusted entry shows its own status
// instead of reading as 'pending'.
//
// Parent decisions (2026-11-13): new status key
// 'baqaya_status_adjusted_partial', EN 'Partly adjusted', UR
// 'جزوی ایڈجسٹ شدہ'; the locked-note wording is updated for partial
// rows (note/date are now editable — "void the payment to change it"
// no longer applies to them).
//
// Fixture mirrors tests/manual-baqaya.test.js (same helpers, same
// shape). Synthetic data only — no real customer names anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addManualBaqayaEntry,
  addPayment,
  manualBaqayaEntriesWithRemaining,
  removeManualBaqayaEntry,
  saveBillMonth,
  setManualBaqayaOutstanding,
  updateManualBaqayaEntry
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { manualBaqayaSectionMarkup } from '../manual-baqaya.js';
import { voidPayment } from '../payment-void-audit.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';

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

/** Customer whose October bill (3,000) is already paid in full. */
function stateWithPaidBill() {
  let state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: 3000, status: 'pending' }, REF);
  state = addPayment(state, 'cust-1', MONTH, { date: '2026-10-05', amount: 3000, method: 'Cash' }, REF);
  return state;
}

function withBaqaya(state, amount = 1500, date = '2026-09-10', note = 'Last month balance') {
  return addManualBaqayaEntry(state, 'cust-1', { amount, date, note }, REF);
}

function collect(state, amount, month = MONTH) {
  return executeQuickCollection(state, {
    customerId: 'cust-1', month, amount, date: '2026-10-15', method: 'Cash'
  }, REF);
}

function entryOf(state) {
  return manualBaqayaEntriesWithRemaining(state.customers[0])[0];
}

function sectionOf(state) {
  return manualBaqayaSectionMarkup(state.customers[0]);
}

test('status matrix: fresh entry reads pending (Unpaid)', () => {
  const state = withBaqaya(stateWithPaidBill());
  const entry = entryOf(state);
  assert.equal(entry.settledCents, 0);
  assert.equal(entry.adjustedCents, 0);
  assert.equal(entry.remainingCents, 150000);
  assert.match(sectionOf(state), /manual-baqaya-status-pending/);
  assert.match(sectionOf(state), />Unpaid</);
});

test('status matrix: partially paid entry reads partial', () => {
  const { nextState } = collect(withBaqaya(stateWithPaidBill()), 500);
  const entry = entryOf(nextState);
  assert.equal(entry.settledCents, 50000);
  assert.equal(entry.remainingCents, 100000);
  assert.match(sectionOf(nextState), /manual-baqaya-status-partial/);
  assert.match(sectionOf(nextState), />Partial</);
});

test('status matrix: partially adjusted (not paid) entry reads adjusted-partial, not pending', () => {
  let state = withBaqaya(stateWithPaidBill());
  state = setManualBaqayaOutstanding(state, 'cust-1', { amount: 1000, date: '2026-10-14', note: 'Owner adjustment' }, REF);
  const entry = entryOf(state);
  assert.equal(entry.settledCents, 0);
  assert.equal(entry.adjustedCents, 50000);
  assert.equal(entry.remainingCents, 100000);
  assert.match(sectionOf(state), /manual-baqaya-status-adjusted_partial/);
  assert.match(sectionOf(state), /Partly adjusted/);
  assert.doesNotMatch(sectionOf(state), /manual-baqaya-status-pending/);
});

test('status matrix: fully paid entry reads paid', () => {
  const { nextState } = collect(withBaqaya(stateWithPaidBill()), 1500);
  const entry = entryOf(nextState);
  assert.equal(entry.settledCents, 150000);
  assert.equal(entry.remainingCents, 0);
  assert.match(sectionOf(nextState), /manual-baqaya-status-paid/);
  assert.match(sectionOf(nextState), />Paid</);
});

test('status matrix: entry closed purely by adjustment reads adjusted', () => {
  let state = withBaqaya(stateWithPaidBill());
  state = setManualBaqayaOutstanding(state, 'cust-1', { amount: 0, date: '2026-10-14', note: 'Written off' }, REF);
  const entry = entryOf(state);
  assert.equal(entry.settledCents, 0);
  assert.equal(entry.adjustedCents, 150000);
  assert.equal(entry.remainingCents, 0);
  assert.match(sectionOf(state), /manual-baqaya-status-adjusted"/);
  assert.match(sectionOf(state), />Adjusted</);
});

test('status matrix: an entry both paid and adjusted reads partial (settled wins)', () => {
  let state = withBaqaya(stateWithPaidBill());
  const { nextState } = collect(state, 500);
  state = setManualBaqayaOutstanding(nextState, 'cust-1', { amount: 700, date: '2026-10-14', note: 'Owner adjustment' }, REF);
  const entry = entryOf(state);
  assert.equal(entry.settledCents, 50000);
  assert.equal(entry.adjustedCents, 30000);
  assert.equal(entry.remainingCents, 70000);
  assert.match(sectionOf(state), /manual-baqaya-status-partial/);
  assert.doesNotMatch(sectionOf(state), /adjusted_partial/);
});

test('edit-note allowed on a partially-settled entry; amount stays as stored', () => {
  const { nextState } = collect(withBaqaya(stateWithPaidBill()), 500);
  const edited = updateManualBaqayaEntry(nextState, 'cust-1', 'MBQ-101', { amount: 1500, date: '2026-09-11', note: 'Corrected note' }, REF);
  const [entry] = edited.customers[0].manualBaqaya;
  assert.equal(entry.amount, 1500);
  assert.equal(entry.date, '2026-09-11');
  assert.equal(entry.note, 'Corrected note');
  assert.equal(entryOf(edited).settledCents, 50000);
});

test('edit-amount refused on a partially-settled entry, with the distinct lock message', () => {
  const { nextState } = collect(withBaqaya(stateWithPaidBill()), 500);
  assert.throws(
    () => updateManualBaqayaEntry(nextState, 'cust-1', 'MBQ-101', { amount: 100, date: '2026-09-10' }, REF),
    /amount is locked/
  );
  // Even a one-paisa tamper is refused — the guard compares against the
  // STORED amount in cents, it never trusts the form value.
  assert.throws(
    () => updateManualBaqayaEntry(nextState, 'cust-1', 'MBQ-101', { amount: 1500.01, date: '2026-09-10' }, REF),
    /amount is locked/
  );
  // The refusals leave the stored entry untouched.
  assert.equal(entryOf(nextState).amount, 1500);
  assert.equal(entryOf(nextState).remainingCents, 100000);
});

test('edit refused on a fully settled entry — note/date as well as amount', () => {
  const { nextState } = collect(withBaqaya(stateWithPaidBill()), 1500);
  assert.equal(entryOf(nextState).remainingCents, 0);
  assert.throws(
    () => updateManualBaqayaEntry(nextState, 'cust-1', 'MBQ-101', { amount: 1500, date: '2026-09-11', note: 'Typo' }, REF),
    /cannot be changed/
  );
  assert.throws(() => removeManualBaqayaEntry(nextState, 'cust-1', 'MBQ-101'), /Void the payment first/);
});

test('remove stays refused on a partially-settled entry', () => {
  const { nextState } = collect(withBaqaya(stateWithPaidBill()), 500);
  assert.throws(() => removeManualBaqayaEntry(nextState, 'cust-1', 'MBQ-101'), /Void the payment first/);
  assert.equal(nextState.customers[0].manualBaqaya.length, 1);
});

test('section markup on a partial entry: Edit only, no Remove, amount-locked note', () => {
  const { nextState } = collect(withBaqaya(stateWithPaidBill()), 500);
  const section = sectionOf(nextState);
  assert.match(section, /data-edit-baqaya="MBQ-101"/);
  assert.doesNotMatch(section, /data-remove-baqaya/);
  assert.match(section, /amount is locked/);
});

test('section markup on a fully settled entry: locked note, no Edit button', () => {
  const { nextState } = collect(withBaqaya(stateWithPaidBill()), 1500);
  const section = sectionOf(nextState);
  assert.doesNotMatch(section, /data-edit-baqaya/);
  assert.doesNotMatch(section, /data-remove-baqaya/);
  assert.match(section, /void the payment to change it/);
});

test('i18n: the new adjusted-partial label carries the parent-decided strings in both dictionaries', () => {
  assert.equal(TRANSLATIONS.en.baqaya_status_adjusted_partial, 'Partly adjusted');
  assert.equal(TRANSLATIONS.ur.baqaya_status_adjusted_partial, 'جزوی ایڈجسٹ شدہ');
  assert.equal(typeof TRANSLATIONS.en.baqaya_amount_locked_note, 'string');
  assert.equal(typeof TRANSLATIONS.ur.baqaya_amount_locked_note, 'string');
});

test('a void restores full edit on a partially-settled entry', () => {
  const { nextState } = collect(withBaqaya(stateWithPaidBill()), 500);
  const payment = nextState.customers[0].bills.find(b => b.month === MONTH).payments.at(-1);
  const { state: voidedState } = voidPayment(nextState, 'cust-1', MONTH, payment.id, { voidReason: 'Recorded twice' });
  assert.equal(entryOf(voidedState).settledCents, 0);
  const edited = updateManualBaqayaEntry(voidedState, 'cust-1', 'MBQ-101', { amount: 1600, date: '2026-09-12', note: 'Corrected after void' }, REF);
  assert.equal(edited.customers[0].manualBaqaya[0].amount, 1600);
});
