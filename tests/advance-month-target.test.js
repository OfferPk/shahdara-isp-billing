/**
 * advance-month-target.test.js — Owner feature (2026-10-29): Advance
 * Payment month targeting + auto-adjust (the SISP-61 core).
 *
 * The owner's words: when recording an advance, the operator SELECTS
 * the month it is for ("ye 3,000 November ka hai") and the advance
 * AUTO-ADJUSTS on the 5th of that month with no operator action. This
 * app is an offline PWA — nothing runs while it is closed — so the
 * auto-adjust truth pinned here is the derived-allocation one: the
 * moment the target month's bill exists (the owner's routine
 * generates bills on the 5th), the live-computed allocation already
 * shows the advance applied to that bill. No scheduler exists.
 *
 * Rules under test:
 *  - schema: targetMonth rides the payment record ONLY on the exact
 *    'advance' kind and ONLY as a strict 'YYYY-MM' (validatePayment);
 *    legacy/untargeted records are byte-identical in shape and keep
 *    the PR #488 FIFO behaviour (those pins live, unmodified, in
 *    tests/advance-payment.test.js);
 *  - reservation: a targeted credit never settles an earlier bill and
 *    never spills into a later bill before its own month is billed —
 *    including a credit created by the FIFO split of a larger advance;
 *  - release + remainder: the first priced bill at or after the
 *    target month releases the reservation; the credit applies there,
 *    and any remainder flows onward as ordinary credit (the money was
 *    FOR that month, not locked to it — a stranded remainder while a
 *    later month shows a due would be false accounting);
 *  - availability: arrearsAndAdvance counts a targeted credit only
 *    for its own month onward, so a billing cycle never nets a bill
 *    with money reserved for a later month; advanceBalanceCents (and
 *    the PR #495 dashboard held figure built on it) counts ALL held
 *    money, reserved included;
 *  - void interplay (SISP-34): voiding before the target month bills
 *    removes the held credit; voiding after consumption reopens the
 *    target bill — the engine's existing recomputation;
 *  - correction carry-over: editing a targeted advance never silently
 *    strips its kind or its target (the walletVerified precedent);
 *  - entry points: profile dialog, Quick Collect and the Field Mode
 *    sheet all pass the chosen month through to the record.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  addPayment, validatePayment, correctPayment, calculatePaymentAllocations,
  listTransactions, persistState, readState, advancePaymentTargetMonth
} from '../core.js';
import {
  recordAdvancePayment, advanceBalanceCents, defaultAdvanceTargetMonth, advanceTargetMonthOptions
} from '../advance-payment.js';
import { arrearsAndAdvance, planCustomerCycleLine } from '../billing-cycle.js';
import { buildAdvanceDashboard } from '../advance-dashboard.js';
import { voidPayment } from '../payment-void-audit.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { collectFieldModeAdvance } from '../field-mode.js';
import { TRANSLATIONS } from '../nav-language.js';

const OCT_29 = new Date(2026, 9, 29, 12);
const NOV_2 = new Date(2026, 10, 2, 12);
const DEC_2 = new Date(2026, 11, 2, 12);
const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

/** One synthetic customer, PKR 3,000/month, October 2026 bill generated. */
function octoberState() {
  let state = createInitialState(['Target Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  return state;
}

/** October bill fully paid with one ordinary payment on 5 October. */
function octoberPaidState() {
  return addPayment(octoberState(), 'seed-001', '2026-10', { date: '2026-10-05', amount: '3000', method: 'Cash' }, OCT_29);
}

const octoberBill = (state) => state.customers[0].bills.find(b => b.month === '2026-10');

test('schema: validatePayment keeps a strict target only on the advance kind', () => {
  const tagged = validatePayment({ date: '2026-10-29', amount: '3000', method: 'Cash', kind: 'advance', targetMonth: '2026-11' }, OCT_29);
  assert.equal(tagged.kind, 'advance');
  assert.equal(tagged.targetMonth, '2026-11');
  // A target on an untagged payment is meaningless and never stored.
  const plain = validatePayment({ date: '2026-10-29', amount: '3000', method: 'Cash', targetMonth: '2026-11' }, OCT_29);
  assert.equal('targetMonth' in plain, false);
  assert.equal('kind' in plain, false);
  // Malformed targets are dropped, never stored raw.
  for (const bad of ['2026-13', '2026-00', '2026-1', 'Nov 2026', '2026-11-01', 202611, '', null]) {
    const cleaned = validatePayment({ date: '2026-10-29', amount: '3000', method: 'Cash', kind: 'advance', targetMonth: bad }, OCT_29);
    assert.equal('targetMonth' in cleaned, false, `target ${JSON.stringify(bad)} must be dropped`);
    assert.equal(advancePaymentTargetMonth(cleaned), null);
  }
  // The reader sanitizes too: a corrupt stored value reads untargeted.
  assert.equal(advancePaymentTargetMonth({ kind: 'advance', targetMonth: 'garbage' }), null);
  assert.equal(advancePaymentTargetMonth({ kind: 'advance', targetMonth: '2026-11' }), '2026-11');
  assert.equal(advancePaymentTargetMonth({ targetMonth: '2026-11' }), null);
  assert.equal(advancePaymentTargetMonth(null), null);
});

test('owner case: advance marked for November adjusts itself when the November bill exists', () => {
  let state = octoberPaidState();
  const { nextState, payment } = recordAdvancePayment(state, 'seed-001', { amount: 3000, date: '2026-10-29', method: 'JazzCash', targetMonth: '2026-11' }, OCT_29);
  state = nextState;
  assert.equal(payment.targetMonth, '2026-11');
  // (a) October is untouched; the full 3,000 is held.
  let allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(advanceBalanceCents(state, 'seed-001'), 300000);
  // The November cycle itself sees the money as its advanceCredit.
  const customer = state.customers[0];
  assert.equal(arrearsAndAdvance(customer, '2026-11').advanceCredit, 3000);
  const planLine = planCustomerCycleLine(customer, '2026-11');
  assert.equal(planLine.advanceApplied, 3000);
  assert.equal(planLine.netDue, 0);
  // Dashboard held figure counts the reserved money, with its target.
  const dashboard = buildAdvanceDashboard(state, '2026-10');
  assert.equal(dashboard.heldTotalCents, 300000);
  assert.equal(dashboard.collectedThisMonthCents, 300000);
  assert.deepEqual(dashboard.holders[0].targets, [{ month: '2026-11', amountCents: 300000 }]);
  // Transactions carry the target for the "Advance · for November" line.
  const row = listTransactions(state, {}, OCT_29).find(r => r.paymentId === payment.id);
  assert.equal(row.isAdvance, true);
  assert.equal(row.targetMonth, '2026-11');

  // (b) The November bill is generated (the owner's 5th-of-month
  // routine) — with zero further operator action the allocation
  // already shows the advance applied to it.
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  allocations = calculatePaymentAllocations(state);
  const november = allocations.forMonth('seed-001', '2026-11');
  assert.equal(november.billAmountCents, 300000);
  assert.equal(november.creditAppliedCents, 300000);
  assert.equal(november.creditSources[0].paymentId, payment.id);
  assert.equal(november.balanceDueCents, 0);
  assert.equal(advanceBalanceCents(state, 'seed-001'), 0);
  assert.deepEqual(buildAdvanceDashboard(state, '2026-11').holders, []);
});

test('a December advance is NOT consumed by the November bill', () => {
  let state = octoberPaidState();
  const { nextState, payment } = recordAdvancePayment(state, 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash', targetMonth: '2026-12' }, OCT_29);
  state = nextState;
  // The November cycle must not net its bill with December's money.
  const customer = state.customers[0];
  assert.equal(arrearsAndAdvance(customer, '2026-11').advanceCredit, 0);
  assert.equal(planCustomerCycleLine(customer, '2026-11').netDue, 3000);
  assert.equal(arrearsAndAdvance(customer, '2026-12').advanceCredit, 3000);
  // Held money is still held — the dashboard total stays truthful.
  assert.equal(advanceBalanceCents(state, 'seed-001'), 300000);
  assert.deepEqual(buildAdvanceDashboard(state, '2026-10').holders[0].targets, [{ month: '2026-12', amountCents: 300000 }]);

  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  let allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('seed-001', '2026-11').creditAppliedCents, 0);
  assert.equal(allocations.forMonth('seed-001', '2026-11').balanceDueCents, 300000);
  assert.equal(advanceBalanceCents(state, 'seed-001'), 300000);

  // December's bill consumes exactly the December advance (November's
  // own balance stays owed — credit never flows backward either).
  state = generateMonthlyBillsThroughCurrentMonth(state, DEC_2);
  allocations = calculatePaymentAllocations(state);
  const december = allocations.forMonth('seed-001', '2026-12');
  assert.equal(december.creditAppliedCents, 300000);
  assert.equal(december.creditSources[0].paymentId, payment.id);
  assert.equal(december.balanceDueCents, 0);
  assert.equal(allocations.forMonth('seed-001', '2026-11').balanceDueCents, 300000);
  assert.equal(advanceBalanceCents(state, 'seed-001'), 0);
});

test('untargeted advance keeps the legacy FIFO behaviour (no target stored)', () => {
  let state = octoberPaidState();
  const { nextState, payment } = recordAdvancePayment(state, 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash' }, OCT_29);
  state = nextState;
  assert.equal('targetMonth' in payment, false);
  assert.equal(advancePaymentTargetMonth(payment), null);
  assert.equal(arrearsAndAdvance(state.customers[0], '2026-11').advanceCredit, 3000);
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  const november = calculatePaymentAllocations(state).forMonth('seed-001', '2026-11');
  assert.equal(november.creditAppliedCents, 300000);
  assert.equal(november.balanceDueCents, 0);
  assert.deepEqual(buildAdvanceDashboard(state, '2026-10').holders, []);
});

test('partial: targeted 5,000 vs a 3,000 November bill — remainder is released and flows onward', () => {
  // The documented remainder rule: the reservation ends at the target
  // month's bill. What that bill does not need becomes ordinary
  // credit for later months — stranding it while December showed a
  // due would be false accounting.
  let state = octoberPaidState();
  state = recordAdvancePayment(state, 'seed-001', { amount: 5000, date: '2026-10-29', method: 'Cash', targetMonth: '2026-11' }, OCT_29).nextState;
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  let allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('seed-001', '2026-11').creditAppliedCents, 300000);
  assert.equal(allocations.forMonth('seed-001', '2026-11').balanceDueCents, 0);
  assert.equal(advanceBalanceCents(state, 'seed-001'), 200000);
  state = generateMonthlyBillsThroughCurrentMonth(state, DEC_2);
  allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('seed-001', '2026-12').creditAppliedCents, 200000);
  assert.equal(allocations.forMonth('seed-001', '2026-12').balanceDueCents, 100000);
  assert.equal(advanceBalanceCents(state, 'seed-001'), 0);
});

test('reservation holds for a credit created by the FIFO split of a larger advance', () => {
  // October is UNPAID (3,000 due). A 6,000 December advance recorded
  // on 29 Oct: the receipt itself settles October (the PR #488 split —
  // targeting steers credit, it does not un-pay the bill the money
  // was handed against); the 3,000 excess is December's credit and
  // must skip November entirely.
  let state = octoberState();
  state = recordAdvancePayment(state, 'seed-001', { amount: 6000, date: '2026-10-29', method: 'Cash', targetMonth: '2026-12' }, OCT_29).nextState;
  let allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(advanceBalanceCents(state, 'seed-001'), 300000);
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('seed-001', '2026-11').creditAppliedCents, 0);
  assert.equal(allocations.forMonth('seed-001', '2026-11').balanceDueCents, 300000);
  state = generateMonthlyBillsThroughCurrentMonth(state, DEC_2);
  allocations = calculatePaymentAllocations(state);
  assert.equal(allocations.forMonth('seed-001', '2026-12').creditAppliedCents, 300000);
  assert.equal(allocations.forMonth('seed-001', '2026-12').balanceDueCents, 0);
});

test('void before the target month bills removes the held targeted credit', () => {
  const { nextState, payment } = recordAdvancePayment(octoberPaidState(), 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash', targetMonth: '2026-11' }, OCT_29);
  assert.equal(advanceBalanceCents(nextState, 'seed-001'), 300000);
  const { state: voided } = voidPayment(nextState, 'seed-001', '2026-10', payment.id, { voidReason: 'Customer took the cash back' });
  assert.equal(advanceBalanceCents(voided, 'seed-001'), 0);
  assert.equal(arrearsAndAdvance(voided.customers[0], '2026-11').advanceCredit, 0);
  // The voided record keeps its target as history; the engine skips it.
  const stored = octoberBill(voided).payments.find(p => p.id === payment.id);
  assert.equal(stored.voided, true);
  assert.equal(stored.targetMonth, '2026-11');
  const grown = generateMonthlyBillsThroughCurrentMonth(voided, NOV_2);
  assert.equal(calculatePaymentAllocations(grown).forMonth('seed-001', '2026-11').balanceDueCents, 300000);
});

test('void after the target bill consumed the advance reopens that bill', () => {
  const { nextState, payment } = recordAdvancePayment(octoberPaidState(), 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash', targetMonth: '2026-11' }, OCT_29);
  let state = generateMonthlyBillsThroughCurrentMonth(nextState, NOV_2);
  assert.equal(calculatePaymentAllocations(state).forMonth('seed-001', '2026-11').balanceDueCents, 0);
  const { state: voided } = voidPayment(state, 'seed-001', '2026-10', payment.id, { voidReason: 'Advance was refunded' });
  const allocations = calculatePaymentAllocations(voided);
  assert.equal(allocations.forMonth('seed-001', '2026-11').balanceDueCents, 300000);
  assert.equal(allocations.forMonth('seed-001', '2026-10').balanceDueCents, 0);
  assert.equal(advanceBalanceCents(voided, 'seed-001'), 0);
});

test('target survives storage, backup-style revalidation and a payment correction', () => {
  const storage = store();
  const { nextState, payment } = recordAdvancePayment(octoberPaidState(), 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash', targetMonth: '2026-11' }, OCT_29);
  persistState(nextState, storage);
  const restored = readState(storage);
  const stored = octoberBill(restored).payments.find(p => p.id === payment.id);
  assert.equal(stored.kind, 'advance');
  assert.equal(stored.targetMonth, '2026-11');
  const revalidated = { ...stored, ...validatePayment(stored, OCT_29) };
  assert.equal(revalidated.kind, 'advance');
  assert.equal(revalidated.targetMonth, '2026-11');
  // The correction form carries no kind/target fields: correcting the
  // amount must not silently strip either (walletVerified precedent).
  const corrected = correctPayment(restored, 'seed-001', '2026-10', payment.id, { date: '2026-10-29', amount: '3500', method: 'Cash' }, OCT_29);
  const fixed = octoberBill(corrected).payments.find(p => p.id === payment.id);
  assert.equal(fixed.amount, 3500);
  assert.equal(fixed.kind, 'advance');
  assert.equal(fixed.targetMonth, '2026-11');
});

test('entry points: Quick Collect and Field Mode store the chosen target month', () => {
  const state = octoberPaidState();
  const qc = executeQuickCollection(state, { customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-29', method: 'Cash', kind: 'advance', advanceTargetMonth: '2026-12' }, OCT_29);
  const qcPayment = octoberBill(qc.nextState).payments.find(p => p.id === qc.receipt.paymentId);
  assert.equal(qcPayment.kind, 'advance');
  assert.equal(qcPayment.targetMonth, '2026-12');
  // A target offered without the advance tag is never stored.
  const plain = executeQuickCollection(state, { customerId: 'seed-001', month: '2026-10', amount: 100, date: '2026-10-29', method: 'Cash', advanceTargetMonth: '2026-12' }, OCT_29);
  const plainPayment = octoberBill(plain.nextState).payments.find(p => p.id === plain.receipt.paymentId);
  assert.equal('targetMonth' in plainPayment, false);
  // Field Mode's advance sheet passes its picker value through.
  const entry = { id: 'seed-001', targetMonth: '2026-10' };
  const fm = collectFieldModeAdvance(state, entry, { amount: 3000, method: 'Cash', targetMonth: '2026-11' }, OCT_29);
  const fmPayment = octoberBill(fm.nextState).payments.find(p => p.id === fm.receipt.paymentId);
  assert.equal(fmPayment.kind, 'advance');
  assert.equal(fmPayment.targetMonth, '2026-11');
});

test('month options: current month onward, next month is the default', () => {
  assert.equal(defaultAdvanceTargetMonth(OCT_29), '2026-11');
  assert.deepEqual(advanceTargetMonthOptions(OCT_29), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
  assert.deepEqual(advanceTargetMonthOptions(OCT_29, 2), ['2026-10', '2026-11']);
  const jan = new Date(2027, 0, 15, 12);
  assert.equal(defaultAdvanceTargetMonth(jan), '2027-02');
});

test('i18n: the target strings exist in both dictionaries', () => {
  for (const key of ['adv_target_label', 'adv_target_suffix']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  assert.ok(TRANSLATIONS.en.adv_target_suffix.includes('{month}'));
  assert.ok(TRANSLATIONS.ur.adv_target_suffix.includes('{month}'));
});

test('wiring: pickers in all three flows, badge + holders display, no new build entry', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="advancePaymentTargetMonth"'), 'profile dialog target picker');
  assert.ok(html.includes('name="targetMonth"'), 'profile dialog target field name');
  assert.ok(html.includes('id="quickCollectAdvanceTargetMonth"'), 'quick collect target picker');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('advanceTargetMonthOptions'), 'dialog options wired');
  assert.ok(app.includes('defaultAdvanceTargetMonth'), 'dialog default wired');
  assert.ok(app.includes("targetMonth: data.get('targetMonth') || undefined"), 'dialog submit passes the target');
  assert.ok(app.includes('advanceBadgeLabel'), 'badge label helper wired');
  assert.ok(app.includes('row.targets'), 'holders dialog shows targets');
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes("targetMonth: kind === 'advance' ? advanceTargetMonth : undefined"), 'quick collect stores the target only for advances');
  assert.ok(qc.includes('quickCollectAdvanceTargetMonth'), 'quick collect picker wired');
  const fm = readFileSync(new URL('../field-mode.js', import.meta.url), 'utf8');
  assert.ok(fm.includes('id="fieldModeAdvanceTargetMonth"'), 'field mode target picker');
  assert.ok(fm.includes('advanceTargetMonth: targetMonth'), 'field mode passes the target');
  // CSS: the field-mode picker uses theme tokens only (dark-mode safe).
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const rule = css.match(/\.field-mode-advance-target \{[^}]*\}/);
  assert.ok(rule, 'field-mode target picker rule exists');
  assert.ok(rule[0].includes('var(--surface)'));
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(rule[0]), 'picker rule uses tokens only, no hex');
});
