// Profile "Clear dues" (2026-11-10): one green button per profile pays
// the customer's FULL due in one Cash payment. "Due" is the
// payableTotal from getCustomerPaymentDefaults — open bills PLUS
// pending ticket charges, add-on charges and unpaid manual baqaya —
// never just the profile's displayed outstanding (bills + baqaya
// only). The confirm dialog shows the total with its breakdown, and
// the result line shows the receipt's honest remainder.
// Synthetic data only — no real customer names anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, setManualBaqayaOutstanding } from '../core.js';
import { getCustomerPaymentDefaults } from '../nav-quick-collect.js';
import { buildClearDuesConfirm, clearDuesRemainderLine } from '../profile-clear-dues.js';

const formatAmount = (value) => `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
const today = new Date('2026-10-07T12:00:00+05:00');

function read(rel) {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

test('clear-dues dialog shows the bills-only total and the Pay label', () => {
  const confirm = buildClearDuesConfirm({
    customerNumber: 42,
    name: 'Test Name',
    totalDues: 3000,
    ticketChargesPending: 0,
    addonChargesPending: 0,
    manualBaqayaPending: 0,
    payableTotal: 3000
  }, { formatAmount, title: 'Clear dues' });
  assert.equal(confirm.title, 'Clear dues');
  assert.equal(confirm.subject, '#42 Test Name');
  assert.equal(confirm.message, 'Bills: PKR 3,000 · Total due: PKR 3,000. One Cash payment settles the full due, oldest months first.');
  assert.equal(confirm.confirmLabel, 'Pay PKR 3,000');
});

test('clear-dues dialog breaks the full due into bills, ticket, add-on and baqaya', () => {
  const confirm = buildClearDuesConfirm({
    customerNumber: 7,
    name: 'Test Name',
    totalDues: 3000,
    ticketChargesPending: 500,
    addonChargesPending: 250,
    manualBaqayaPending: 200,
    payableTotal: 3950
  }, { formatAmount, title: 'Clear dues' });
  assert.equal(confirm.message, 'Bills: PKR 3,000 · Ticket charges: PKR 500 · Add-on charges: PKR 250 · Additional (baqaya): PKR 200 · Total due: PKR 3,950. One Cash payment settles the full due, oldest months first.');
  assert.equal(confirm.confirmLabel, 'Pay PKR 3,950');
});

test('clear-dues dialog tolerates a missing customer number and name', () => {
  const confirm = buildClearDuesConfirm({ totalDues: 100, payableTotal: 100 }, { formatAmount });
  assert.equal(confirm.title, 'Clear dues');
  assert.equal(confirm.subject, '');
});

test('clear-dues remainder line is honest about what is still owed', () => {
  assert.equal(clearDuesRemainderLine({ payableRemaining: 250 }, formatAmount), 'Still owes PKR 250.');
  assert.equal(clearDuesRemainderLine({ payableRemaining: 0 }, formatAmount), 'Fully paid.');
  assert.equal(clearDuesRemainderLine({ payableRemaining: Number.NaN }, formatAmount), 'Remainder unclear — check the ledger.');
  assert.equal(clearDuesRemainderLine({}, formatAmount), 'Remainder unclear — check the ledger.');
});

test('clear-dues defaults fold unpaid manual baqaya into the payable total', () => {
  let state = createInitialState(['Ali', 'Bina']);
  state = saveBillMonth(state, 'seed-001', { month: '2026-10', dueAmount: '1000', status: 'pending' }, today);
  state = setManualBaqayaOutstanding(state, 'seed-001', { amount: 500, date: '2026-10-01', note: 'test baqaya' }, today);
  const defaults = getCustomerPaymentDefaults(state, 'seed-001', today, []);
  assert.equal(defaults.totalDues, 1000);
  assert.equal(defaults.manualBaqayaPending, 500);
  assert.equal(defaults.payableTotal, 1500);
  const confirm = buildClearDuesConfirm(defaults, { formatAmount, title: 'Clear dues' });
  assert.match(confirm.message, /Bills: PKR 1,000/);
  assert.match(confirm.message, /Additional \(baqaya\): PKR 500/);
  assert.match(confirm.message, /Total due: PKR 1,500/);
  assert.equal(confirm.confirmLabel, 'Pay PKR 1,500');
});

test('clear-dues wiring is present: green button after Edit, i18n both languages, 6-column action group', () => {
  const html = read('../index.html');
  assert.ok(html.indexOf('id="editProfileButton"') !== -1, 'Edit button exists');
  assert.ok(html.indexOf('id="clearDuesButton"') > html.indexOf('id="editProfileButton"'), 'Clear dues sits after Edit in Row 1');
  const buttonLine = html.split('\n').find((line) => line.includes('id="clearDuesButton"'));
  assert.ok(buttonLine.includes('primary-button'), 'Clear dues uses the green primary-button class');
  assert.ok(buttonLine.includes('data-i18n="prof_action_clear_dues"'), 'Clear dues label is i18n keyed');
  const language = read('../nav-language.js');
  assert.ok(language.includes("prof_action_clear_dues: 'Clear dues'"), 'EN label present');
  assert.ok(language.includes("prof_action_clear_dues: 'بقایا صاف کریں'"), 'UR label present');
  const styles = read('../styles.css');
  // Profile Archive Button Visibility (user report 2026-11-13):
  // Row 1 grows from five buttons to six (Edit / Clear dues / Delete
  // / Wada / Record payment / Archive), so the grid grows from five
  // columns to six — one column per Row 1 button. Without the sixth
  // column Archive wraps alone onto row 2 at desktop widths.
  assert.ok(styles.includes('.profile-action-group{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto auto;'), 'action group has six columns for the six Row 1 buttons');
});

test('profile tickets section does not shadow the i18n t with the ticket variable', () => {
  // Harness-found (2026-11-11): customerTickets.map((t) => ...) shadowed
  // the imported i18n t, so opening a profile WITH field tickets threw
  // "t is not a function" inside renderCustomerProfileView — and a Clear
  // dues record after it showed "Payment not saved" although the payment
  // had recorded. The callback param is now `ticket`; the i18n calls
  // inside it stay t('...').
  const app = read('../app.js');
  assert.ok(app.includes('customerTickets.map((ticket) =>'), 'tickets map uses a non-shadowing param');
  assert.ok(!app.includes('customerTickets.map((t) =>'), 'no shadowing tickets map remains');
  assert.ok(app.includes("t('prof_ticket_lineman'"), 'lineman label still uses the i18n t');
});

test('clear-dues controller reuses the shared record path with its guards', () => {
  const app = read('../app.js');
  assert.ok(app.includes('const clearDuesSaveGuard = createDoubleTapSaveGuard();'), 'Plan 437 double-submit guard');
  assert.ok(app.includes('doubleTapSaveGuardSetDisabled } from \'./double-tap-save-guard.js\''), 'button disable helper is imported, not just used');
  assert.ok(app.includes('getCustomerPaymentDefaults(state, customer.id, new Date(), tickets)'), 'due read from the shared defaults');
  assert.ok(app.includes('findRecentDuplicate(state, { customerId: customer.id, amount: payableTotal, method: \'Cash\' })'), '5-minute duplicate detector');
  assert.ok(app.includes('requiresLargeCashApproval(true, Math.round(payableTotal * 100), LARGE_CASH_DEFAULT_THRESHOLD_CENTS)'), 'large-cash approval gate');
  assert.ok(app.includes('executeQuickCollection(state, {'), 'record path reuses executeQuickCollection');
  assert.ok(app.includes('if (result.nextTickets) saveTickets(result.nextTickets);'), 'settled tickets are persisted (SISP-43)');
  assert.ok(app.includes("$('#clearDuesButton').hidden = customer.archived;"), 'button hides for archived customers');
});
