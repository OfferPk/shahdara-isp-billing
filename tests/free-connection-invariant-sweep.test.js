// M20: FREE-Connection Invariant Sweep (test-only).
// The owner's FREE rule (2026-10-29, the FREE-3 roster pattern — AQIB 1,
// AQIB 999, FREE ID LINE MAN): a connection with isFreeConnection: true
// gets NO bill, NO fee and NO pending amount, ever. Individual paths
// carry their own guards (billing generator, billing cycle, baqaya,
// boosts, defaulter surfaces), and earlier pins touched two of them in
// passing (M18: the cycle's no-bill rule inside a group; M17/M13: none).
// This sweep drives ONE synthetic FREE customer through EVERY money
// path in a single fixture family and asserts zero bills, zero dues
// and zero queue presence everywhere, with priced-twin controls proving
// each path really would have charged a normal customer.
//
// Two paths are RECORD-ALLOWED but derive zero due, pinned as shipped:
//  - Advance: recordAdvancePayment lands the money on an unpriced shell
//    bill (dueAmount null — core addPayment's shell), the engine holds
//    the full amount as advance credit, and because bill generation
//    never prices a FREE bill the credit is NEVER consumed.
//  - Kist: an installment-plan RECORD can sit on a FREE customer (the
//    plan factory is customer-blind), but the billing cycle — the only
//    consumer that turns a plan into a due — skips the customer with
//    reason 'free-connection', so no kist line ever reaches a bill and
//    the plan never advances.
//
// ⭐ P0 FINDING (documented here, deliberately NOT pinned as correct —
// reported to the owner for a decision; do NOT read this file as
// blessing it): the SISP-43 TICKET CHARGE path has no FREE guard
// anywhere. complaint-tickets.js is customer-record-blind (tickets
// link by customerId only), so resolving a FREE customer's ticket with
// billingType 'billed' and Rs. 250 of materials (createTicket →
// resolveTicket, complaint-tickets.js:347/418) derives
// billedTicketChargesPending(tickets, freeId) === 250 and
// pendingTicketChargeLines === [{ ticketId: 'TKT-101', amount: 250 }]
// (complaint-tickets.js:566/574) — a real pending amount that the
// profile renders as "Ticket charges pending" (app.js
// renderCurrentBillSummary), Quick Collect's payable total includes
// (nav-quick-collect.js getCustomerPaymentDefaults), and the clearance
// NOC treats as a blocker (clearance-noc-slip.js assessClearanceNoc).
// Every other money path refuses or zeroes a FREE connection; this one
// silently accepts the resolver's "Billed to Customer" choice. The
// FREE-safe ticket routes ARE pinned below (an open ticket, and a
// ticket resolved 'free' — the default and the only route the
// complaint-register sync ever takes, complaint-ticket-sync.js — both
// derive exactly 0). The billed route's current derivation is recorded
// in this header only, so a future guard changes no pin in this file
// and the fix lands as its own phase.
// Pure-function tests on synthetic data only, through the REAL core
// engine and the REAL shipped derivations of every surface named.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addManualBaqayaEntry,
  applyLateFeeToBill,
  calculatePaymentAllocations,
  generateMonthlyBillsThroughCurrentMonth,
  manualBaqayaOutstandingCents,
  saveBillMonth,
  setManualBaqayaOutstanding
} from '../core.js';
import { applyBillingCycle, arrearsAndAdvance, planCustomerCycleLine } from '../billing-cycle.js';
import { buildKistProgress, createInstallmentPlan, dueKistLines } from '../installment-plan.js';
import { addSpeedBoost, addonChargesPending } from '../speed-addon.js';
import {
  TICKET_PRESETS, billedTicketChargesPending, createTicket, pendingTicketChargeLines, resolveTicket
} from '../complaint-tickets.js';
import { advanceBalanceCents, recordAdvancePayment } from '../advance-payment.js';
import { addBillingGroup, buildGroupDue } from '../group-billing.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';
import { buildZoneDefaulterSheet } from '../lineman-sheet-print.js';
import { classifyCustomerDefaulter } from '../defaulter-risk-segment.js';
import {
  getEscalationStage, isLockDueCustomer, isPrelockNoticeEligible
} from '../reminder-queue.js';
import { getPendingCollectionCustomers } from '../nav-quick-collect.js';
import { additionalPendingControlsMarkup, totalOutstandingFigures } from '../manual-baqaya.js';
import { buildMohallaCardStats } from '../customer-search-filter.js';
import { t } from '../nav-language.js';

const now = new Date();
const pkt = new Date(now.getTime() + 5 * 3600 * 1000);
const month = pkt.toISOString().slice(0, 7); // PKT current month — same derivation as the M18 pin
const today = pkt.toISOString().slice(0, 10);

const freeCustomer = (extra = {}) => ({
  id: 'fr', customerNumber: 91, name: 'Free Sweep', phone: '03000000091',
  area: 'BARRIAN', mohalla: 'BARRIAN', archived: false, bills: [],
  monthlyPriceSchedule: [{ effectiveMonth: month, amount: 3000 }],
  isFreeConnection: true, manualBaqaya: [], installmentPlans: [], ...extra
});
const pricedCustomer = (extra = {}) => ({
  id: 'n1', customerNumber: 92, name: 'Priced Sweep', phone: '03000000092',
  area: 'BARRIAN', mohalla: 'BARRIAN', archived: false, bills: [],
  monthlyPriceSchedule: [{ effectiveMonth: month, amount: 3000 }],
  manualBaqaya: [], installmentPlans: [], ...extra
});
const sweepState = () => ({ customers: [freeCustomer(), pricedCustomer()] });

test('M20 PIN: the monthly cycle never bills a FREE connection — zero bills, zero dues, zero arrears', () => {
  const generated = generateMonthlyBillsThroughCurrentMonth(sweepState(), now);
  const free = generated.customers.find((c) => c.id === 'fr');
  const priced = generated.customers.find((c) => c.id === 'n1');
  assert.deepEqual(free.bills, [], 'no bill — no fee, no pending amount, ever');
  assert.deepEqual(priced.bills.map((b) => [b.month, b.dueAmount]), [[month, 3000]],
    'control: the identically priced twin IS billed Rs. 3,000');

  const allocations = calculatePaymentAllocations(generated);
  assert.equal(allocations.forMonth('fr', month), undefined,
    'the engine holds no summary at all for a bill-less FREE customer');
  assert.deepEqual(totalOutstandingFigures(free, allocations), {
    billDuesCents: 0, manualBaqayaCents: 0, totalCents: 0,
    billDues: 0, manualBaqaya: 0, total: 0
  });
  assert.deepEqual(arrearsAndAdvance(free, month), { previousArrears: 0, advanceCredit: 0, arrearsMonths: 0 });
});

test('M20 PIN: kist — a plan record may sit on a FREE customer, but the cycle never turns it into a due', () => {
  const planFields = { itemTitle: 'Router', totalAmount: 3000, totalMonths: 3, startDate: `${month}-01` };
  const freePlan = createInstallmentPlan(planFields);
  const state = { customers: [freeCustomer({ installmentPlans: [freePlan] }), pricedCustomer()] };
  // The plan-only derivation can see the line (Rs. 1,000) — it reads the
  // plan record alone. The pin is about the CONSUMER: the billing cycle.
  assert.equal(dueKistLines(state.customers[0], month).length, 1);
  const line = planCustomerCycleLine(state.customers[0], month);
  assert.equal(line.skipped, true);
  assert.equal(line.reason, 'free-connection');

  const applied = applyBillingCycle(state, month, now);
  const freeAfter = applied.state.customers.find((c) => c.id === 'fr');
  assert.deepEqual(freeAfter.bills, [], 'no bill was created, so no kist line could ride one');
  assert.equal(freeAfter.installmentPlans[0].monthsBilled, 0, 'the plan never advances for a FREE customer');
  assert.equal(buildKistProgress(freeAfter).totals.totalMonthlyKist, 1000,
    'the record still describes itself — it simply never becomes a due');

  // Control: the same plan on the priced twin IS billed by the same cycle.
  const pricedPlan = createInstallmentPlan(planFields);
  const control = applyBillingCycle({ customers: [pricedCustomer({ installmentPlans: [pricedPlan] })] }, month, now);
  const pricedAfter = control.state.customers[0];
  assert.deepEqual(pricedAfter.bills.map((b) => [b.dueAmount, b.kistTotal]), [[4000, 1000]],
    'control: Rs. 3,000 package + Rs. 1,000 kist on one bill');
  assert.equal(pricedAfter.installmentPlans[0].monthsBilled, 1);
});

test('M20 PIN: speed boosts — a paid boost is refused for a FREE connection and no fee ever pends', () => {
  const state = sweepState();
  assert.throws(
    () => addSpeedBoost(state, 'fr', { boostMbps: 20, durationDays: 7, addonFeePKR: 200, startDate: today }, now),
    /FREE connections are never billed/
  );
  const free = state.customers.find((c) => c.id === 'fr');
  assert.equal(free.speedBoosts ?? undefined, undefined, 'no boost record was written');
  assert.equal(addonChargesPending(free), 0);
  // Control: the same boost on the priced twin lands and pends Rs. 200.
  const boosted = addSpeedBoost(state, 'n1', { boostMbps: 20, durationDays: 7, addonFeePKR: 200, startDate: today }, now);
  assert.equal(addonChargesPending(boosted.state.customers.find((c) => c.id === 'n1')), 200);
});

test('M20 PIN: manual baqaya — both write paths refuse a FREE connection; outstanding stays zero', () => {
  const state = sweepState();
  assert.throws(
    () => addManualBaqayaEntry(state, 'fr', { amount: 500, date: today }, now),
    /Free connections never owe anything/
  );
  assert.throws(
    () => setManualBaqayaOutstanding(state, 'fr', { amount: 500, date: today }, now),
    /Free connections never owe anything/
  );
  const free = state.customers.find((c) => c.id === 'fr');
  assert.deepEqual(free.manualBaqaya, []);
  assert.equal(manualBaqayaOutstandingCents(free), 0);
  assert.equal(additionalPendingControlsMarkup(free), '',
    'the Additional Pending affordance is not even offered for a FREE connection');
});

test('M20 PIN: tickets — the FREE-safe routes derive zero pending charges (billed route = header finding)', () => {
  const open = [createTicket(
    { customerId: 'fr', customerName: 'Free Sweep', faultPreset: TICKET_PRESETS[0], technician: 'Saad' }, [], now
  )];
  assert.equal(billedTicketChargesPending(open, 'fr'), 0, 'an open ticket charges nothing');
  assert.deepEqual(pendingTicketChargeLines(open, 'fr'), []);
  const resolvedFree = resolveTicket(open, open[0].id, {
    materialsUsed: [{ key: 'fiber', qty: 10, amount: 250 }], billingType: 'free'
  }, now);
  assert.equal(resolvedFree[0].billedAmount, 0,
    'resolved as a free visit (the default, and the complaint-sync route): materials recorded, charge zeroed');
  assert.equal(billedTicketChargesPending(resolvedFree, 'fr'), 0);
  assert.deepEqual(pendingTicketChargeLines(resolvedFree, 'fr'), []);
});

test('M20 PIN: late fees — no bill exists to fee, the fee write refuses, the derived fee total is zero', () => {
  const generated = generateMonthlyBillsThroughCurrentMonth(sweepState(), now);
  assert.throws(
    () => applyLateFeeToBill(generated, 'fr', month, { amount: 150 }, now),
    /Bill for month .* not found on customer #91/
  );
  const free = generated.customers.find((c) => c.id === 'fr');
  const lateFeeTotal = (free.bills ?? []).reduce((sum, b) => sum + (Number(b.lateFee) || 0), 0);
  assert.equal(lateFeeTotal, 0);
});

test('M20 PIN: advance — money recorded for a FREE customer is held in full and never consumed', () => {
  const recorded = recordAdvancePayment(sweepState(), 'fr', { amount: 1000, date: today, method: 'Cash' }, now);
  assert.equal(recorded.month, month);
  const free = recorded.nextState.customers.find((c) => c.id === 'fr');
  assert.equal(free.bills.length, 1, 'the payment lands on the addPayment shell bill');
  assert.equal(free.bills[0].dueAmount, null, 'the shell is unpriced — it is not a bill in any money sense');
  const allocations = calculatePaymentAllocations(recorded.nextState);
  const summary = allocations.forMonth('fr', month);
  assert.equal(summary.billAmountCents, null);
  assert.equal(summary.balanceDueCents, null, 'no due can be read off an unpriced shell');
  assert.equal(summary.pendingCreditCents, 100000);
  assert.equal(advanceBalanceCents(recorded.nextState, 'fr', allocations), 100000,
    'the full Rs. 1,000 sits held as advance credit');

  // Forty days and two more cycle runs later: still unpriced, still
  // fully held — bill generation never prices a FREE bill, so the
  // credit has nothing to consume against and simply stays held.
  const later = generateMonthlyBillsThroughCurrentMonth(recorded.nextState, new Date(now.getTime() + 40 * 86400 * 1000));
  const freeLater = later.customers.find((c) => c.id === 'fr');
  assert.deepEqual(freeLater.bills.map((b) => [b.month, b.dueAmount]), [[month, null]]);
  assert.equal(advanceBalanceCents(later, 'fr', calculatePaymentAllocations(later)), 100000);
});

test('M20 PIN: group billing — a FREE member reads no-bill / 0 and never enters the group total', () => {
  const generated = generateMonthlyBillsThroughCurrentMonth(sweepState(), now);
  const group = addBillingGroup([], { groupTitle: 'Sweep Family', memberIds: ['fr', 'n1'] })[0];
  const due = buildGroupDue(group, generated.customers, month, calculatePaymentAllocations(generated));
  const freeEntry = due.members.find((m) => m.customerId === 'fr');
  assert.equal(freeEntry.status, 'no-bill');
  assert.equal(freeEntry.dueCents, 0);
  assert.equal(due.totalCents, 300000, 'the group total is the priced member alone');
  assert.equal(due.payableCount, 1);
});

test('M20 PIN: defaulter surfaces — a FREE customer appears in none of them', () => {
  const generated = generateMonthlyBillsThroughCurrentMonth(sweepState(), now);
  const free = generated.customers.find((c) => c.id === 'fr');

  const top = calculateTopDefaulters(generated, { referenceDate: now });
  assert.deepEqual(top.accounts.map((a) => a.id), ['n1'], 'Top Defaulters lists the priced twin only');
  assert.equal(top.metrics.totalDefaultersCount, 1);
  assert.equal(top.metrics.totalReceivablesDues, 3000, 'receivables are the twin’s Rs. 3,000 alone');

  const sheet = buildZoneDefaulterSheet(generated, { referenceDate: now, month });
  assert.deepEqual(sheet.zones.flatMap((z) => z.rows).map((r) => r.id), ['n1'],
    'the zone defaulter sheet carries the twin only');
  assert.equal(sheet.totals.count, 1);

  assert.equal(classifyCustomerDefaulter(free, generated, today), null,
    'the defaulter risk segment refuses to classify a FREE customer');
  assert.equal(getEscalationStage(free, 0, today), null);
  assert.equal(isLockDueCustomer(free, 0, today), false);
  assert.equal(isPrelockNoticeEligible(free, 0, today), false,
    'never in the pre-lock notice queue');

  const pending = getPendingCollectionCustomers(generated, '', 'all-dues', now);
  assert.deepEqual(pending.map((p) => p.id), ['n1'],
    'the collection picker (Quick Collect / Field Mode / Bulk Collect) never lists the FREE customer');
});

test('M20 PIN: defaulter guards are explicit — they hold even for a drifted FREE record carrying an old priced bill', () => {
  // Data-drift shape: a priced bill forced onto the FREE record through
  // the generic bill write (e.g. priced before the connection was
  // marked FREE). The defaulter surfaces do not rely on the no-bills
  // invariant — each checks isFreeConnection itself.
  let state = sweepState();
  state = saveBillMonth(state, 'fr', { month, dueAmount: 3000, status: 'pending' });
  const free = state.customers.find((c) => c.id === 'fr');
  assert.equal(free.bills.length, 1, 'fixture check: the drifted bill is on the record');

  const top = calculateTopDefaulters(state, { referenceDate: now });
  assert.deepEqual(top.accounts.map((a) => a.id), [], 'still excluded from Top Defaulters despite the bill');
  const sheet = buildZoneDefaulterSheet(state, { referenceDate: now, month });
  assert.deepEqual(sheet.zones.flatMap((z) => z.rows).map((r) => r.id), []);
  assert.equal(classifyCustomerDefaulter(free, state, today), null);
  assert.equal(getEscalationStage(free, 3000, today), null,
    'escalation refuses even when handed a Rs. 3,000 outstanding figure');
  assert.equal(isLockDueCustomer(free, 3000, today), false);
  assert.equal(isPrelockNoticeEligible(free, 3000, today), false);
});

test('M20 PIN: the FREE tag still renders — badge keys resolve in both languages, mohalla stats count FREE separately', () => {
  assert.equal(t('cust_free_badge', 'en'), 'FREE');
  assert.equal(t('cust_free_badge', 'ur'), 'مفت FREE');
  assert.equal(t('prof_free_badge', 'en'), 'FREE');
  assert.equal(t('prof_free_badge', 'ur'), 'مفت FREE');

  const generated = generateMonthlyBillsThroughCurrentMonth(sweepState(), now);
  const stats = buildMohallaCardStats(generated.customers, calculatePaymentAllocations(generated), month);
  assert.equal(stats.length, 1);
  const barrian = stats[0];
  assert.equal(barrian.count, 2, 'the FREE customer still counts as a customer of the mohalla');
  assert.equal(barrian.freeCount, 1, '…counted in the FREE bucket');
  assert.equal(barrian.billedCount, 1, '…but never among the billed');
  assert.equal(barrian.unpaidPKR, 3000, '…and contributes nothing to unpaid — the twin’s bill alone');
});
