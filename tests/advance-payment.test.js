/**
 * advance-payment.test.js — Owner feature (2026-10-29): explicit Advance
 * Payment recording.
 *
 * The owner's case: on 29 October a customer's October bill is already
 * Paid (PKR 3,000/3,000, net due 0) and the customer sends next month's
 * money early. The app must record it NOW, tagged as advance, so it
 * adjusts against the November bill when generated — while a NORMAL
 * payment must never double-record against a fully paid bill.
 *
 * Pins:
 *  - the tag rides validatePayment -> addPayment (only the exact
 *    'advance' kind is kept; legacy/untagged records stay byte-identical
 *    in shape) and survives storage + backup-style revalidation;
 *  - the end-to-end engine flow: October paid -> advance 3,000 recorded
 *    on 29 Oct -> November bill generated -> November net due reduced by
 *    the full 3,000 through the EXISTING allocation/billing-cycle engine
 *    (arrearsAndAdvance advanceCredit + carry-forward credit);
 *  - the guard: normalPaymentBlockReason flags a fully paid bill (and
 *    only that) for the operator entry points — the profile payment form
 *    and the Quick Collect sheet refuse an untagged payment there and
 *    direct the operator to this tagged path. The engine deliberately
 *    keeps its excess-recording semantics (pinned by core/SISP-43
 *    tests), so the guard lives at the entry points, not in addPayment;
 *  - the FIFO split of an advance recorded while some due remains
 *    (dues portion first, remainder is advance credit);
 *  - SISP-34 void interplay: voiding the advance before consumption
 *    removes the credit; voiding it after the November bill consumed it
 *    reopens November's balance (the engine's existing rule — voided
 *    payments are excluded from allocations);
 *  - Quick Collect passes the tag through and hits the same guard;
 *  - every new UI string exists in BOTH language dictionaries, and the
 *    static wiring (dialog, buttons, build entry) is present.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  addPayment, validatePayment, calculatePaymentAllocations, calculateDashboard,
  listTransactions, persistState, readState, isAdvancePayment
} from '../core.js';
import { recordAdvancePayment, advanceBalance, advanceBalanceCents, normalPaymentBlockReason } from '../advance-payment.js';
import { arrearsAndAdvance, planCustomerCycleLine } from '../billing-cycle.js';
import { voidPayment } from '../payment-void-audit.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { TRANSLATIONS } from '../nav-language.js';

const OCT_29 = new Date(2026, 9, 29, 12);
const NOV_2 = new Date(2026, 10, 2, 12);
const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

/** One synthetic customer, PKR 3,000/month, October 2026 bill generated. */
function octoberState() {
  let state = createInitialState(['Advance Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  return state;
}

/** October bill fully paid with one ordinary payment on 5 October. */
function octoberPaidState() {
  return addPayment(octoberState(), 'seed-001', '2026-10', { date: '2026-10-05', amount: '3000', method: 'Cash' }, OCT_29);
}

const octoberBill = (state) => state.customers[0].bills.find(b => b.month === '2026-10');

test('validatePayment keeps only the exact advance kind and sanitizes the note', () => {
  const tagged = validatePayment({ date: '2026-10-29', amount: '3000', method: 'Cash', kind: 'advance', note: '  November\npaid early  ' }, OCT_29);
  assert.equal(tagged.kind, 'advance');
  assert.equal(tagged.note, 'November paid early');
  const bogus = validatePayment({ date: '2026-10-29', amount: '3000', method: 'Cash', kind: 'ADVANCE' }, OCT_29);
  assert.equal('kind' in bogus, false);
  const plain = validatePayment({ date: '2026-10-29', amount: '3000', method: 'Cash' }, OCT_29);
  assert.equal('kind' in plain, false);
  assert.equal('note' in plain, false);
  assert.throws(() => validatePayment({ date: '2026-10-29', amount: '3000', method: 'Cash', kind: 'advance', note: 'x'.repeat(201) }, OCT_29), /200 characters/);
});

test('owner case end-to-end: paid October -> advance on 29 Oct -> November bill consumes it', () => {
  let state = octoberPaidState();
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', '2026-10').balanceDueCents, 0);

  const { nextState, payment, month } = recordAdvancePayment(state, 'seed-001', { amount: 3000, date: '2026-10-29', method: 'JazzCash', note: 'November paid early' }, OCT_29);
  state = nextState;
  assert.equal(month, '2026-10');
  assert.equal(payment.kind, 'advance');
  assert.equal(isAdvancePayment(payment), true);
  assert.equal(payment.note, 'November paid early');
  // Recorded on the CURRENT (October) bill through the ordinary pipeline.
  assert.ok(octoberBill(state).payments.some(p => p.id === payment.id));
  // October stays settled; the full 3,000 waits as advance credit.
  let allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(allocations.forMonth('seed-001', '2026-10').pendingCreditCents, 300000);
  assert.equal(advanceBalanceCents(state, 'seed-001'), 300000);
  assert.equal(advanceBalance(state, 'seed-001'), 3000);
  // The billing-cycle engine sees the same figure as advanceCredit, and a
  // November cycle plan applies it in full: net due 0 before generation.
  const customer = state.customers[0];
  assert.equal(arrearsAndAdvance(customer, '2026-11').advanceCredit, 3000);
  const planLine = planCustomerCycleLine(customer, '2026-11');
  assert.equal(planLine.advanceApplied, 3000);
  assert.equal(planLine.netDue, 0);

  // November arrives; the bill is generated and the advance adjusts it.
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  allocations = calculatePaymentAllocations(state);
  const november = allocations.forMonth('seed-001', '2026-11');
  assert.equal(november.billAmountCents, 300000);
  assert.equal(november.creditAppliedCents, 300000);
  assert.equal(november.balanceDueCents, 0);
  assert.equal(november.creditSources[0].paymentId, payment.id);
  assert.equal(advanceBalance(state, 'seed-001'), 0);

  // Single-entry accounting: two receipts total, cash counted once each.
  const transactions = listTransactions(state, {}, NOV_2);
  assert.equal(transactions.length, 2);
  assert.equal(transactions.find(row => row.paymentId === payment.id).isAdvance, true);
  assert.equal(transactions.find(row => row.paymentId !== payment.id).isAdvance, false);
  assert.equal(calculateDashboard(state, OCT_29).totalCollection, 6000);
});

test('guard: block reason flags exactly the fully-paid bill, nothing else', () => {
  // Fully paid October bill -> blocked for normal payments.
  assert.equal(normalPaymentBlockReason(octoberPaidState(), 'seed-001', '2026-10'), 'fully-paid');
  // Balance still due -> recordable.
  let due = octoberState();
  due = addPayment(due, 'seed-001', '2026-10', { date: '2026-10-05', amount: '1000', method: 'Cash' }, OCT_29);
  assert.equal(normalPaymentBlockReason(due, 'seed-001', '2026-10'), null);
  // Unpriced bill (no package price): balance unknown, never blocked —
  // the receipt is held as credit (advance-before-pricing behaviour).
  let unpriced = createInitialState(['Unpriced Tester']);
  unpriced = addPayment(unpriced, 'seed-001', '2026-10', { date: '2026-10-05', amount: '500', method: 'Cash' }, OCT_29);
  assert.equal(normalPaymentBlockReason(unpriced, 'seed-001', '2026-10'), null);
  const summary = calculatePaymentAllocations(unpriced).forMonth('seed-001', '2026-10');
  assert.equal(summary.balanceDueCents, null);
  assert.equal(summary.pendingCreditCents, 50000);
  // No bill for the month / unknown customer -> never blocked.
  assert.equal(normalPaymentBlockReason(octoberPaidState(), 'seed-001', '2026-08'), null);
  assert.equal(normalPaymentBlockReason(octoberPaidState(), 'nobody', '2026-10'), null);
});

test('engine truth: an untagged engine-level payment on a paid bill stays ordinary credit (guard lives at entry points)', () => {
  // This is the long-standing, separately pinned engine behaviour
  // (core overpayment tests; SISP-43's post-settlement collection):
  // addPayment itself never refuses — the operator paths do. Pinning it
  // here so the entry-point guard is never "fixed" into the engine.
  const state = octoberPaidState();
  const next = addPayment(state, 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '500', method: 'Cash',
    ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }]
  }, OCT_29);
  const payment = octoberBill(next).payments.at(-1);
  assert.equal(payment.amount, 500);
  assert.equal('kind' in payment, false);
});

test('advance with partial due: FIFO split settles dues first, remainder becomes credit', () => {
  let state = octoberState();
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-05', amount: '2000', method: 'Cash' }, OCT_29);
  const { nextState, payment } = recordAdvancePayment(state, 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash' }, OCT_29);
  const ledger = calculatePaymentAllocations(nextState).byPaymentId.get(payment.id);
  assert.deepEqual(ledger.allocations, [{ month: '2026-10', amountCents: 100000, kind: 'same-month' }]);
  assert.equal(ledger.excessCents, 200000);
  assert.equal(ledger.unappliedCreditCents, 200000);
  assert.equal(calculatePaymentAllocations(nextState).forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(advanceBalance(nextState, 'seed-001'), 2000);
});

test('void before consumption removes the advance credit cleanly', () => {
  const { nextState, payment } = recordAdvancePayment(octoberPaidState(), 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash' }, OCT_29);
  assert.equal(advanceBalance(nextState, 'seed-001'), 3000);
  const { state: voided } = voidPayment(nextState, 'seed-001', '2026-10', payment.id, { voidReason: 'Sent back to customer' });
  assert.equal(advanceBalance(voided, 'seed-001'), 0);
  assert.equal(calculatePaymentAllocations(voided).forMonth('seed-001', '2026-10').balanceDueCents, 0);
  const row = listTransactions(voided, {}, OCT_29).find(r => r.paymentId === payment.id);
  assert.equal(row.voided, true);
  assert.equal(row.isAdvance, true);
});

test('void after the next bill consumed the advance reopens that bill (existing engine rule)', () => {
  const { nextState, payment } = recordAdvancePayment(octoberPaidState(), 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash' }, OCT_29);
  let state = generateMonthlyBillsThroughCurrentMonth(nextState, NOV_2);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', '2026-11').balanceDueCents, 0);
  const { state: voided } = voidPayment(state, 'seed-001', '2026-10', payment.id, { voidReason: 'Advance was refunded' });
  const allocations = calculatePaymentAllocations(voided);
  // The voided receipt no longer exists for the engine, so November's
  // bill is owed again in full; October (paid by its own receipt) is
  // untouched.
  assert.equal(allocations.forMonth('seed-001', '2026-11').balanceDueCents, 300000);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(advanceBalance(voided, 'seed-001'), 0);
});

test('tag and note survive a storage round-trip and backup-style revalidation', () => {
  const storage = store();
  const { nextState, payment } = recordAdvancePayment(octoberPaidState(), 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash', note: 'November paid early' }, OCT_29);
  persistState(nextState, storage);
  const restored = readState(storage);
  const stored = octoberBill(restored).payments.find(p => p.id === payment.id);
  assert.equal(stored.kind, 'advance');
  assert.equal(stored.note, 'November paid early');
  // Backup import revalidates payments through validatePayment
  // ({ ...payment, ...validatePayment(payment) }) — the tag must ride it.
  const revalidated = { ...stored, ...validatePayment(stored, OCT_29) };
  assert.equal(revalidated.kind, 'advance');
  assert.equal(revalidated.note, 'November paid early');
});

test('Quick Collect: kind passes through to the record; the sheet guard is the entry point, not the engine', () => {
  const state = octoberPaidState();
  const { nextState, receipt } = executeQuickCollection(state, { customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-29', method: 'Cash', kind: 'advance' }, OCT_29);
  const payment = octoberBill(nextState).payments.find(p => p.id === receipt.paymentId);
  assert.equal(payment.kind, 'advance');
  assert.equal(advanceBalance(nextState, 'seed-001'), 3000);
  // Without the tag the pure collection still records (SISP-43's pinned
  // post-settlement behaviour) — the modal's submit handler is what
  // refuses it, via normalPaymentBlockReason.
  const plain = executeQuickCollection(state, { customerId: 'seed-001', month: '2026-10', amount: 100, date: '2026-10-29', method: 'Cash' }, OCT_29);
  const plainPayment = octoberBill(plain.nextState).payments.find(p => p.id === plain.receipt.paymentId);
  assert.equal('kind' in plainPayment, false);
});

test('i18n: every advance string exists in both dictionaries', () => {
  const keys = ['prof_action_advance', 'adv_dialog_title', 'adv_dialog_help', 'adv_summary_label', 'adv_current_balance', 'adv_amount_label', 'adv_note_label', 'adv_note_ph', 'adv_save', 'adv_badge', 'adv_recorded', 'adv_qc_label', 'adv_blocked_paid', 'adv_date_label', 'adv_method_label', 'adv_paidby_label', 'adv_paidby_ph', 'adv_cancel'];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  assert.ok(TRANSLATIONS.en.adv_current_balance.includes('{amount}'));
  assert.ok(TRANSLATIONS.ur.adv_current_balance.includes('{amount}'));
});

test('wiring: dialog, buttons, badge style and build entry are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="advancePaymentDialog"'));
  assert.ok(html.includes('id="advancePaymentButton"'));
  assert.ok(html.includes('id="advancePaymentForm"'));
  assert.ok(html.includes('id="quickCollectAdvanceCheckbox"'));
  assert.ok(html.includes('data-i18n="prof_action_advance"'));
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './advance-payment.js'"));
  assert.ok(app.includes('setupAdvancePaymentDialog'));
  assert.ok(app.includes("t('adv_badge')"));
  // Both operator entry points enforce the guard through the one helper.
  assert.ok(app.includes("normalPaymentBlockReason(state, customerId, form.dataset.month)"), 'profile payment form guard wired');
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes("from './advance-payment.js'"));
  assert.ok(qc.includes("normalPaymentBlockReason(state, activeCustomerId, monthVal)"), 'quick collect guard wired');
  assert.ok(qc.includes("kind: advanceCheckbox?.checked ? 'advance' : undefined"), 'quick collect tag passthrough wired');
  const build = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.ok(build.includes("'advance-payment.js'"));
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const badgeRule = css.match(/\.advance-badge \{[^}]*\}/);
  assert.ok(badgeRule, 'advance-badge rule exists');
  assert.ok(badgeRule[0].includes('var(--color-paid)'));
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(badgeRule[0]), 'advance-badge uses tokens only, no hex');
});
