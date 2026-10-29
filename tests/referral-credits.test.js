// SISP-40: Customer Neighbor Referral ("Hamsaya Referral") Credit &
// Promotional Discount Engine. Pure-function tests on synthetic data only.
// Spec test criterion (verbatim): "Linking Customer B as referred by
// Customer A queues a Rs. 500 credit when B pays their first bill and
// reduces A's next monthly bill by Rs. 500."
// Also pins: no payment -> no credit; voided first payment -> no credit
// (and a queued credit cancels when its trigger payment is voided);
// second payment -> no second credit; self-referral ignored; deleted
// referrer cancels a queued credit; credit capped at the bill gross
// (floor Rs. 0) with the remainder staying queued; receipt shows the
// credit and settles against the reduced due; backup safe-merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCustomer, createInitialState, createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import {
  applyBillingCycle, arrearsBreakdownTextLines, planBillingCycle, runBillingCycle
} from '../billing-cycle.js';
import { buildPaymentReceipt } from '../receipt.js';
import { referralBillingSummary } from '../profile-ui.js';
import {
  DEFAULT_REFERRAL_CREDIT_AMOUNT, REFERRAL_CREDITS_KEY,
  applyReferralApplications, firstValidPayment, loadReferralCredits,
  nextReferralId, queuedReferralTotalFor, reconcileReferralCredits,
  referralRemaining, sanitizeReferralCredits, saveReferralCredits
} from '../referral-credits.js';

const bill = (month, overrides) => ({
  id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending',
  payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z',
  amountHistory: [], ...overrides
});
const payment = (id, overrides) => ({ id, date: '2026-09-06', amount: 3000, method: 'Cash', ...overrides });

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); }
  };
}

/** A (referrer) + B (referred by A), both on a Rs. 3,000 schedule. */
function baseState(price = 3000) {
  let state = createInitialState([]);
  state = addCustomer(state, 'Referrer Ahmed');
  const aId = state.customers.at(-1).id;
  state = addCustomer(state, 'Neighbour Bilal', new Date(), { referredByCustomerId: aId });
  const bId = state.customers.at(-1).id;
  state = {
    ...state,
    customers: state.customers.map((c) => ({ ...c, monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: price }] }))
  };
  return { state, aId, bId };
}

function withBills(state, customerId, bills) {
  return {
    ...state,
    customers: state.customers.map((c) => (c.id === customerId ? { ...c, bills } : c))
  };
}

const customerOf = (state, id) => state.customers.find((c) => c.id === id);

/** B has a September bill fully paid — the pinned trigger. */
function paidSeptember(state, bId, payments = [payment('p1')]) {
  return withBills(state, bId, [bill('2026-09', { payments })]);
}

test('addCustomer stores referredByCustomerId and rejects an unknown referrer', () => {
  const { state, aId, bId } = baseState();
  assert.equal(customerOf(state, bId).referredByCustomerId, aId);
  assert.equal(customerOf(state, aId).referredByCustomerId, null);
  assert.throws(
    () => addCustomer(state, 'Ghost Referred', new Date(), { referredByCustomerId: 'no-such-id' }),
    /Referrer not found/
  );
});

test('spec criterion: B referred by A pays first bill -> Rs. 500 queued -> A next bill reduced by exactly Rs. 500, once', () => {
  const { state, aId, bId } = baseState();
  const withPayment = paidSeptember(state, bId);

  // Queue: exactly one Rs. 500 entry for A, stamped with B's first payment.
  const sync1 = reconcileReferralCredits(withPayment, []);
  assert.equal(sync1.created.length, 1);
  const entry = sync1.created[0];
  assert.equal(entry.referralId, 'REF-101');
  assert.equal(entry.referrerCustomerId, aId);
  assert.equal(entry.referredCustomerId, bId);
  assert.equal(entry.amount, DEFAULT_REFERRAL_CREDIT_AMOUNT);
  assert.equal(entry.amount, 500);
  assert.equal(entry.status, 'queued');
  assert.equal(entry.triggerPaymentId, 'p1');
  assert.equal(entry.triggerMonth, '2026-09');
  assert.equal(queuedReferralTotalFor(sync1.credits, aId), 500);

  // Reconcile is idempotent — no duplicate queueing.
  const sync2 = reconcileReferralCredits(withPayment, sync1.credits);
  assert.equal(sync2.created.length, 0);
  assert.equal(sync2.credits.length, 1);

  // Next SISP-2 cycle: A's October bill is reduced by exactly Rs. 500.
  const run = runBillingCycle(withPayment, '2026-10', [], new Date('2026-10-01T00:00:00Z'), { referralCredits: sync1.credits });
  const aLine = run.cycle.lines.find((line) => line.customerId === aId);
  assert.equal(aLine.referralCreditApplied, 500);
  assert.equal(aLine.netDue, 2500);
  assert.equal(run.cycle.totals.totalReferralCredit, 500);
  assert.equal(run.referralApplications.length, 1);
  const aOctober = customerOf(run.state, aId).bills.find((row) => row.month === '2026-10');
  assert.equal(aOctober.dueAmount, 3000); // bill amount itself never rewritten
  assert.equal(aOctober.referralCreditAmount, 500);
  assert.equal(aOctober.referralCreditReason, 'Hamsaya Referral Credit');
  assert.ok(aOctober.amountHistory.some((row) => row.type === 'referral_credit_applied' && row.referralCredit === 500));

  // Marking the application consumes the credit exactly once.
  const afterApply = applyReferralApplications(sync1.credits, run.referralApplications, '2026-10');
  assert.equal(afterApply[0].status, 'applied');
  assert.equal(afterApply[0].appliedAmount, 500);
  assert.equal(queuedReferralTotalFor(afterApply, aId), 0);

  // The following cycle gets nothing more — consumed once, never twice.
  const sync3 = reconcileReferralCredits(run.state, afterApply);
  assert.equal(sync3.created.length, 0);
  const november = planBillingCycle(run.state, '2026-11', { referralCredits: sync3.credits });
  assert.equal(november.lines.find((line) => line.customerId === aId).referralCreditApplied, 0);
  assert.equal(november.totals.totalReferralCredit, 0);
});

test('no payment yet -> no credit is queued', () => {
  const { state, bId } = baseState();
  const unpaid = withBills(state, bId, [bill('2026-09')]);
  const sync = reconcileReferralCredits(unpaid, []);
  assert.equal(sync.created.length, 0);
  assert.equal(sync.credits.length, 0);
});

test('a voided first payment never queues a credit', () => {
  const { state, bId } = baseState();
  const voidedOnly = paidSeptember(state, bId, [payment('p1', { voided: true })]);
  assert.equal(firstValidPayment(customerOf(voidedOnly, bId)), null);
  const sync = reconcileReferralCredits(voidedOnly, []);
  assert.equal(sync.created.length, 0);
});

test('voiding the trigger payment cancels a queued credit; paying again re-queues a fresh one', () => {
  const { state, aId, bId } = baseState();
  const paid = paidSeptember(state, bId);
  const sync1 = reconcileReferralCredits(paid, []);
  assert.equal(sync1.credits.length, 1);

  const voided = withBills(paid, bId, [bill('2026-09', { payments: [payment('p1', { voided: true })] })]);
  const sync2 = reconcileReferralCredits(voided, sync1.credits);
  assert.equal(sync2.cancelled.length, 1);
  assert.equal(sync2.credits[0].status, 'cancelled');
  assert.equal(sync2.credits[0].cancelledReason, 'trigger-payment-voided');
  assert.equal(queuedReferralTotalFor(sync2.credits, aId), 0);

  const repaid = withBills(paid, bId, [bill('2026-09', { payments: [payment('p1', { voided: true }), payment('p2', { date: '2026-09-20' })] })]);
  const sync3 = reconcileReferralCredits(repaid, sync2.credits);
  assert.equal(sync3.created.length, 1);
  assert.equal(sync3.created[0].referralId, 'REF-102');
  assert.equal(sync3.created[0].triggerPaymentId, 'p2');
  assert.equal(sync3.created[0].status, 'queued');
});

test('a second payment by B never queues a second credit', () => {
  const { state, bId } = baseState();
  const paidTwice = paidSeptember(state, bId, [payment('p1', { amount: 1500 }), payment('p2', { amount: 1500, date: '2026-09-21' })]);
  const sync = reconcileReferralCredits(paidTwice, []);
  assert.equal(sync.credits.length, 1);
  assert.equal(sync.credits[0].triggerPaymentId, 'p1');
});

test('self-referral and dangling links never earn', () => {
  const { state, aId } = baseState();
  const selfState = {
    ...state,
    customers: state.customers.map((c) => (c.id === aId
      ? { ...c, referredByCustomerId: aId, bills: [bill('2026-09', { payments: [payment('p1')] })] }
      : c))
  };
  assert.equal(reconcileReferralCredits(selfState, []).created.length, 0);
  const danglingState = {
    ...state,
    customers: state.customers.map((c) => (c.id === aId
      ? { ...c, referredByCustomerId: 'ghost-id', bills: [bill('2026-09', { payments: [payment('p1')] })] }
      : c))
  };
  assert.equal(reconcileReferralCredits(danglingState, []).created.length, 0);
});

test('deleting the referrer cancels a still-queued credit (audit kept)', () => {
  const { state, aId, bId } = baseState();
  const paid = paidSeptember(state, bId);
  const sync1 = reconcileReferralCredits(paid, []);
  const withoutReferrer = { ...paid, customers: paid.customers.filter((c) => c.id !== aId) };
  const sync2 = reconcileReferralCredits(withoutReferrer, sync1.credits);
  assert.equal(sync2.credits.length, 1);
  assert.equal(sync2.credits[0].status, 'cancelled');
  assert.equal(sync2.credits[0].cancelledReason, 'referrer-removed');
});

test('credit is capped at the bill gross (floor Rs. 0) and the remainder stays queued for the next cycle', () => {
  const { state, aId, bId } = baseState(300); // Rs. 300 package, Rs. 500 queued
  const paid = paidSeptember(state, bId, [payment('p1', { amount: 300 })]);
  const sync = reconcileReferralCredits(paid, []);
  assert.equal(queuedReferralTotalFor(sync.credits, aId), 500);

  const october = runBillingCycle(paid, '2026-10', [], new Date('2026-10-01T00:00:00Z'), { referralCredits: sync.credits });
  const aLine = october.cycle.lines.find((line) => line.customerId === aId);
  assert.equal(aLine.referralCreditApplied, 300);
  assert.equal(aLine.netDue, 0);
  const afterOctober = applyReferralApplications(sync.credits, october.referralApplications, '2026-10');
  assert.equal(afterOctober[0].status, 'queued');
  assert.equal(afterOctober[0].appliedAmount, 300);
  assert.equal(referralRemaining(afterOctober[0]), 200);

  const november = runBillingCycle(october.state, '2026-11', [october.cycle], new Date('2026-11-01T00:00:00Z'), { referralCredits: afterOctober });
  const aNovLine = november.cycle.lines.find((line) => line.customerId === aId);
  assert.equal(aNovLine.referralCreditApplied, 200);
  // November gross = Rs. 300 new bill + Rs. 300 unpaid October arrears;
  // the remaining Rs. 200 credit deducts from that total.
  assert.equal(aNovLine.netDue, 400);
  const afterNovember = applyReferralApplications(afterOctober, november.referralApplications, '2026-11');
  assert.equal(afterNovember[0].status, 'applied');
  assert.equal(afterNovember[0].appliedAmount, 500);
});

test('an adopted (already generated) bill receives the credit; a bill already credited is never credited twice', () => {
  const { state, aId, bId } = baseState();
  const paid = paidSeptember(state, bId);
  const withOctober = withBills(paid, aId, [bill('2026-10')]); // auto-generated before the cycle
  const sync = reconcileReferralCredits(withOctober, []);
  const applied = applyBillingCycle(withOctober, '2026-10', new Date('2026-10-01T00:00:00Z'), { referralCredits: sync.credits });
  const aOctober = customerOf(applied.state, aId).bills.find((row) => row.month === '2026-10');
  assert.equal(aOctober.referralCreditAmount, 500);
  assert.equal(aOctober.dueAmount, 3000);
  // Re-applying the same cycle (backstop path) does not stack the credit.
  const reapplied = applyBillingCycle(applied.state, '2026-10', new Date('2026-10-01T00:00:00Z'), { referralCredits: sync.credits });
  const aOctoberAgain = customerOf(reapplied.state, aId).bills.find((row) => row.month === '2026-10');
  assert.equal(aOctoberAgain.referralCreditAmount, 500);
  assert.equal(reapplied.referralApplications.length, 0);
});

test('receipt: the credit shows on the receipt and a Rs. 2,500 payment settles the Rs. 3,000 bill as PAID', () => {
  const { state, aId, bId } = baseState();
  const paid = paidSeptember(state, bId);
  const sync = reconcileReferralCredits(paid, []);
  const run = runBillingCycle(paid, '2026-10', [], new Date('2026-10-01T00:00:00Z'), { referralCredits: sync.credits });
  const settlingPayment = payment('pA1', { date: '2026-10-06', amount: 2500 });
  const settledState = {
    ...run.state,
    customers: run.state.customers.map((c) => (c.id === aId
      ? { ...c, bills: c.bills.map((row) => (row.month === '2026-10' ? { ...row, payments: [settlingPayment] } : row)) }
      : c))
  };
  const aAfter = customerOf(settledState, aId);
  const settledBill = aAfter.bills.find((row) => row.month === '2026-10');
  const receipt = buildPaymentReceipt(aAfter, settledBill, settlingPayment);
  assert.equal(receipt.referralCreditAmount, 500);
  assert.equal(receipt.referralCreditReason, 'Hamsaya Referral Credit');
  assert.equal(receipt.status, 'PAID');
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.arrearsBreakdown.referralCreditAmount, 500);
  assert.ok(arrearsBreakdownTextLines(receipt.arrearsBreakdown).some((line) => line.startsWith('Hamsaya Referral Credit: -')));
});

test('profile summary: B shows the referrer, A shows the queued credit', () => {
  const { state, aId, bId } = baseState();
  const paid = paidSeptember(state, bId);
  const sync = reconcileReferralCredits(paid, []);
  const bSummary = referralBillingSummary(customerOf(paid, bId), paid, sync.credits);
  assert.ok(bSummary.referredByLabel.includes('Referrer Ahmed'));
  assert.equal(bSummary.hasContent, true);
  const aSummary = referralBillingSummary(customerOf(paid, aId), paid, sync.credits);
  assert.equal(aSummary.queuedTotal, 500);
  assert.ok(aSummary.queuedLabel.includes('500'));
  assert.equal(aSummary.earned.length, 1);
  assert.equal(aSummary.earned[0].status, 'queued');
});

test('sanitize: malformed rows drop, duplicates keep the first, ids sequence from REF-101', () => {
  const good = {
    referralId: 'REF-101', referrerCustomerId: 'a', referredCustomerId: 'b', amount: 500,
    appliedAmount: 0, applications: [], status: 'queued', triggerPaymentId: 'p1', triggerMonth: '2026-09', queuedAt: '', cancelledReason: ''
  };
  const cleaned = sanitizeReferralCredits([
    good,
    { ...good, referralId: 'REF-102' }, // duplicate referred customer
    { ...good, referralId: 'XX-9', referredCustomerId: 'c' }, // bad id
    { ...good, referralId: 'REF-103', referredCustomerId: 'a' }, // self-referral
    { ...good, referralId: 'REF-104', referredCustomerId: 'd', amount: 0 }, // no amount
    'junk', null
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].referralId, 'REF-101');
  assert.equal(nextReferralId(cleaned), 'REF-102');
  assert.equal(nextReferralId([]), 'REF-101');
});

test('storage round-trip via the module key', () => {
  const storage = memoryStorage();
  const { state, bId } = baseState();
  const sync = reconcileReferralCredits(paidSeptember(state, bId), []);
  saveReferralCredits(sync.credits, storage);
  assert.ok(storage.getItem(REFERRAL_CREDITS_KEY));
  const loaded = loadReferralCredits(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].amount, 500);
  assert.deepEqual(loadReferralCredits({ getItem: () => '{broken', setItem: () => {} }), []);
});

test('backup safe-merge: referral credits travel in settings.referralCredits and restore only onto an empty device', () => {
  const { state, bId } = baseState();
  const entries = reconcileReferralCredits(paidSeptember(state, bId), []).credits;
  const backupText = createJsonBackup(createInitialState([]), new Date('2026-10-31T12:00:00+05:00'), { referralCredits: entries });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.referralCredits.length, 1);
  assert.equal(parsed.settings.referralCredits[0].referralId, 'REF-101');

  const preview = previewJsonBackupMerge(createInitialState([]), backupText);
  assert.equal(preview.referralCredits.length, 1);
  assert.equal(preview.referralCredits[0].amount, 500);

  const other = [{ ...entries[0], referralId: 'REF-140', referredCustomerId: 'someone-else' }];
  const clash = previewJsonBackupMerge(createInitialState([]), backupText, { currentReferralCredits: other, currentReferralCreditsStored: true });
  assert.equal(clash.referralCredits, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Referral credit records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState([]), backupText, { currentReferralCredits: entries, currentReferralCreditsStored: true });
  assert.equal(identical.referralCredits, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('Referral')).length, 0);
});

test('plans without credits are untouched: zero referral figures, advance math unchanged', () => {
  const { state, aId } = baseState();
  const plan = planBillingCycle(state, '2026-10');
  const aLine = plan.lines.find((line) => line.customerId === aId);
  assert.equal(aLine.referralCreditApplied, 0);
  assert.equal(aLine.netDue, 3000);
  assert.equal(aLine.remainingAdvance, 0);
  assert.equal(plan.totals.totalReferralCredit, 0);
});
