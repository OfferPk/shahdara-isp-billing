// M19: Rounding Seam Interaction Pin (test-only).
//
// SISP-131 made rounding a STAMP-time-only event: the [Round to Rs. 50]
// toggle (bill-rounding-helper.js roundedAmountFor) rewrites a computed
// credit once, when it is stamped, and the unrounded figure survives
// only in the audit tag { rawAmount, roundedAmount, mode }. Everything
// downstream — the allocation engine, the Khata Doctor, arrears — must
// consume the STAMPED figure exactly, to the cent, and never round a
// second time. M13 pinned the seam inside the Quick Collect cascade
// (helper figures + cascade remainder + a paisa-exact payment). This
// pin covers the three-way interaction M13 did not drive:
//
//   (1) BOTH real suggestion builders (SISP-30 complaint register via
//       buildConcessionSuggestion, SISP-181 uptime bridge via
//       buildUptimeConcessionSuggestion) produce the canonical spec
//       case — 31-day month (2026-10), 54h offline, Rs. 3,000 package
//       -> round(3000 / 720 * 54) = Rs. 225 raw — and the toggle acts
//       identically on both: ON/'nearest' -> 250 with tag
//       { 225, 250, 'nearest' }, OFF -> 225 with no tag, ON/'exact' ->
//       225 with no tag, ON/'down' -> 200 with tag { 225, 200, 'down' }.
//   (2) The stamped figure flows through the FULL money path unchanged:
//       applyConcessionToBill -> calculatePaymentAllocations ->
//       Khata Doctor computeLedgerBalance -> arrearsAndAdvance, and a
//       payment of the net due settles the bill exactly (receipt PAID,
//       balance 0), with re-derivation byte-stable — no second rounding
//       at allocation time, ever.
//   (3) A paisa-exact concession (Rs. 100.37) with the toggle OFF passes
//       the seam untouched and is consumed as exactly 10,037 cents.
//
// FINDING (pinned as shipped, flagged for the parent): the billing-
// cycle FIFO split (allocateFifoForBill / fifoAllocationForPayment) is
// a GROSS-bucket view by construction — fifoBillContext reads dueAmount
// only and nets NONE of the six bill-level waiver credits (deposit
// offset, credit transfer, bad-debt write-off, referral, concession,
// feeder-host). On a concession-settled bill its package remainder is
// therefore exactly the stamped concession (Rs. 250), while the engine
// balance is 0; the identity FIFO-remaining − engine-balance == stamped
// concession holds to the cent in both the plain and the arrears
// shapes, and the split is hidden (show: false) unless the bill carries
// arrears or kist. Receipts net the credits in their own due line and
// print the concession separately. The money of record (engine, Doctor,
// arrears) is net and exact — see tests (2) and (5). No figure is
// rounded twice anywhere on the path; the toggle is honoured in every
// mode. Any divergence from the above = STOP and report — never fix
// money behaviour inside a pin phase.
//
// Synthetic data only; zero shipped files changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addPayment,
  applyConcessionToBill,
  calculatePaymentAllocations,
  saveBillMonth
} from '../core.js';
import {
  buildConcessionSuggestion,
  buildUptimeConcessionSuggestion,
  netDueAfterConcession,
  roundedConcessionSuggestion
} from '../concession-helper.js';
import { roundedAmountFor } from '../bill-rounding-helper.js';
import {
  allocateFifoForBill,
  arrearsAndAdvance,
  fifoAllocationForPayment
} from '../billing-cycle.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { buildPaymentReceipt } from '../receipt.js';

const MONTH = '2026-10'; // a 31-day month
const REF = new Date('2026-10-15T12:00:00+05:00');
const UPTIME_REF = new Date('2026-11-10T12:00:00+05:00'); // after October ends
const BILL = 3000;

function baseCustomer() {
  return {
    id: 'cust-1',
    customerNumber: 101,
    name: 'Synthetic Subscriber',
    phone: '03001234567',
    area: 'Test Area',
    archived: false,
    isFreeConnection: false,
    monthlyPriceSchedule: [{ effectiveMonth: MONTH, amount: BILL, recordedAt: '2026-10-01T00:00' }],
    relocationLog: [],
    pauseSkippedMonths: [],
    bills: [],
    incidents: [],
    installmentPlans: []
  };
}

function billState() {
  let state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: BILL, status: 'pending' }, REF);
  return state;
}

const billOf = (state) => state.customers[0].bills.find((b) => b.month === MONTH);
const engineBalance = (state, month = MONTH) =>
  calculatePaymentAllocations(state).forMonth('cust-1', month).balanceDueCents;

// Two October complaints totalling exactly 54h of logged downtime.
const complaint = (overrides = {}) => ({
  id: 'CMP-101',
  customerId: 'cust-1',
  customerName: 'Synthetic Subscriber',
  zone: 'Test Area',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-10-05T10:00',
  resolvedAt: '2026-10-06T16:00',
  downtimeHours: 30,
  downtimeManual: false,
  status: 'Resolved',
  resolutionNote: '',
  createdAt: '',
  ...overrides
});
const COMPLAINTS_54H = [
  complaint({ id: 'CMP-101', downtimeHours: 30 }),
  complaint({ id: 'CMP-102', downtimeHours: 24, reportedAt: '2026-10-20T10:00', resolvedAt: '2026-10-21T10:00' })
];

// The same 54h recorded as one uptime incident: 2026-10-05 10:00 ->
// 2026-10-07 16:00 = 2 days 6 hours = 3,240 minutes offline.
const incident54h = () => ({
  id: 'inc-54',
  reportedAt: '2026-10-05T10:05',
  offlineAt: '2026-10-05T10:00',
  restoredAt: '2026-10-07T16:00',
  note: 'Fiber cut on the main road',
  createdAt: '2026-10-05T10:05',
  corrections: []
});

function uptimeCustomer() {
  return {
    id: 'cust-1',
    customerNumber: 101,
    name: 'Synthetic Subscriber',
    packageSpeed: '5 Mbps',
    connectionDate: '2026-08-01',
    addedOn: '2026-08-01',
    serviceStatus: 'active',
    serviceStatusHistory: [],
    incidents: [incident54h()],
    monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: BILL, recordedAt: '2026-08-01T00:00' }],
    bills: [{ id: 'bill-2026-10', month: MONTH, dueAmount: BILL, status: 'pending', payments: [], amountHistory: [] }]
  };
}

test('spec case via the real builders: 31-day month, 54h offline, Rs 3,000 -> raw Rs 225 from BOTH downtime sources', () => {
  const state = billState();
  const customer = state.customers[0];
  const fromComplaints = buildConcessionSuggestion(customer, billOf(state), COMPLAINTS_54H);
  assert.equal(fromComplaints.downtimeHours, 54);
  assert.equal(fromComplaints.complaintCount, 2);
  assert.equal(fromComplaints.packageRate, BILL);
  assert.equal(fromComplaints.eligible, true);
  // Hand-computed: round(3000 / 720 * 54) = round(225) = 225.
  assert.equal(fromComplaints.suggestedAmount, 225);
  assert.equal(fromComplaints.reason, 'Outage Reaayat: 54h offline');

  const up = uptimeCustomer();
  const fromUptime = buildUptimeConcessionSuggestion(up, up.bills[0], { referenceDate: UPTIME_REF });
  assert.equal(fromUptime.offlineMinutes, 3240);
  assert.equal(fromUptime.downtimeHours, 54);
  assert.equal(fromUptime.eligible, true);
  assert.equal(fromUptime.suggestedAmount, 225, 'the uptime bridge feeds the SAME formula — the raw figure cannot drift by source');
});

test('toggle ON (nearest): both sources round 225 -> 250 exactly once, tag {225, 250, nearest}; the stamp is consumed to the cent by engine + Doctor', () => {
  const state = billState();
  const fromComplaints = buildConcessionSuggestion(state.customers[0], billOf(state), COMPLAINTS_54H);
  const up = uptimeCustomer();
  const fromUptime = buildUptimeConcessionSuggestion(up, up.bills[0], { referenceDate: UPTIME_REF });

  const effectiveShape = (s) => {
    const e = roundedConcessionSuggestion(s, { enabled: true, mode: 'nearest' });
    return { suggestedAmount: e.suggestedAmount, rawSuggestedAmount: e.rawSuggestedAmount, rounding: e.rounding };
  };
  const expected = { suggestedAmount: 250, rawSuggestedAmount: 225, rounding: { rawAmount: 225, roundedAmount: 250, mode: 'nearest' } };
  assert.deepEqual(effectiveShape(fromComplaints), expected);
  assert.deepEqual(effectiveShape(fromUptime), expected, 'the toggle acts identically whichever source suggested the figure');

  const effective = roundedConcessionSuggestion(fromComplaints, { enabled: true, mode: 'nearest' });
  const stamped = applyConcessionToBill(state, 'cust-1', MONTH, {
    amount: effective.suggestedAmount,
    reason: effective.reason,
    rounding: effective.rounding
  }, REF);
  const bill = billOf(stamped);
  assert.equal(bill.concessionAmount, 250, 'the stamped figure IS the rounded figure');
  assert.equal(bill.dueAmount, BILL, 'the bill amount itself is never rewritten');
  assert.deepEqual(bill.amountHistory.at(-1).rounding, { rawAmount: 225, roundedAmount: 250, mode: 'nearest' });
  assert.equal(engineBalance(stamped), 275000, 'engine consumes the stamp: 300,000 - 25,000 = 275,000 cents');
  assert.equal(computeLedgerBalance(stamped.customers[0]).balanceCents, 275000, 'Khata Doctor mirrors the stamped figure exactly');
  assert.equal(netDueAfterConcession(BILL, bill.concessionAmount), 2750);
});

test('toggle OFF and mode exact: the raw 225 is the stamp and no rounding tag is written anywhere', () => {
  const state = billState();
  const suggestion = buildConcessionSuggestion(state.customers[0], billOf(state), COMPLAINTS_54H);

  const off = roundedConcessionSuggestion(suggestion, { enabled: false, mode: 'nearest' });
  assert.equal(off.suggestedAmount, 225);
  assert.equal(off.rawSuggestedAmount, 225);
  assert.equal(off.rounding, null);

  const exact = roundedConcessionSuggestion(suggestion, { enabled: true, mode: 'exact' });
  assert.equal(exact.suggestedAmount, 225, "mode 'exact' with the toggle on is a pass-through, not a rounding");
  assert.equal(exact.rounding, null);

  const stamped = applyConcessionToBill(state, 'cust-1', MONTH, {
    amount: off.suggestedAmount,
    reason: off.reason,
    rounding: off.rounding
  }, REF);
  const bill = billOf(stamped);
  assert.equal(bill.concessionAmount, 225);
  assert.equal('rounding' in bill.amountHistory.at(-1), false, 'no tag is written when nothing was rounded');
  assert.equal(engineBalance(stamped), 277500, '300,000 - 22,500 = 277,500 cents — the raw figure, unrounded, to the cent');
  assert.equal(computeLedgerBalance(stamped.customers[0]).balanceCents, 277500);
});

test("toggle granularity: mode 'down' stamps 200; re-rounding an already-stamped figure is a no-op (never rounded twice at the seam)", () => {
  const state = billState();
  const suggestion = buildConcessionSuggestion(state.customers[0], billOf(state), COMPLAINTS_54H);

  const down = roundedConcessionSuggestion(suggestion, { enabled: true, mode: 'down' });
  assert.equal(down.suggestedAmount, 200, 'floor to the note below: 225 -> 200');
  assert.deepEqual(down.rounding, { rawAmount: 225, roundedAmount: 200, mode: 'down' });
  const stamped = applyConcessionToBill(state, 'cust-1', MONTH, {
    amount: down.suggestedAmount,
    reason: down.reason,
    rounding: down.rounding
  }, REF);
  assert.equal(billOf(stamped).concessionAmount, 200);
  assert.deepEqual(billOf(stamped).amountHistory.at(-1).rounding, { rawAmount: 225, roundedAmount: 200, mode: 'down' });
  assert.equal(engineBalance(stamped), 280000);

  // A figure already on a note boundary cannot be moved by a second
  // pass through the toggle — the seam is idempotent at the stamp.
  assert.deepEqual(roundedAmountFor(250, { enabled: true, mode: 'nearest' }), { amount: 250, rounding: null });
  assert.deepEqual(roundedAmountFor(200, { enabled: true, mode: 'down' }), { amount: 200, rounding: null });
  const secondPass = roundedConcessionSuggestion({ ...suggestion, suggestedAmount: 250 }, { enabled: true, mode: 'nearest' });
  assert.equal(secondPass.suggestedAmount, 250);
  assert.equal(secondPass.rounding, null, 'no second tag, no second rounding');
});

test('full path, toggle ON: paying the net 2,750 settles the stamped bill exactly — engine 0, Doctor 0, arrears 0, receipt PAID; re-derivation is stable', () => {
  let state = billState();
  const suggestion = buildConcessionSuggestion(state.customers[0], billOf(state), COMPLAINTS_54H);
  const effective = roundedConcessionSuggestion(suggestion, { enabled: true, mode: 'nearest' });
  state = applyConcessionToBill(state, 'cust-1', MONTH, {
    amount: effective.suggestedAmount,
    reason: effective.reason,
    rounding: effective.rounding
  }, REF);
  state = addPayment(state, 'cust-1', MONTH, { date: '2026-10-14', amount: 2750, method: 'Cash' }, REF);

  const customer = state.customers[0];
  const bill = billOf(state);
  assert.equal(bill.concessionAmount, 250, 'recording a payment never rewrites the stamp');
  assert.equal(engineBalance(state), 0);
  const ledger = calculatePaymentAllocations(state).byPaymentId.get(bill.payments.at(-1).id);
  assert.deepEqual(ledger.allocations, [{ month: MONTH, amountCents: 275000, kind: 'same-month' }]);
  assert.equal(ledger.excessCents, 0, 'no excess — the payment matched the STAMPED due to the cent, so nothing was rounded downstream');
  assert.equal(computeLedgerBalance(customer).balanceCents, 0);
  assert.deepEqual(arrearsAndAdvance(customer, '2026-11'), { previousArrears: 0, advanceCredit: 0, arrearsMonths: 0 },
    'no phantom arrears: the waived 250 never re-enters the next cycle');

  // Re-deriving from the same state yields the identical figure — the
  // stamped amount is read, never recomputed or re-rounded.
  assert.deepEqual(
    calculatePaymentAllocations(state).forMonth('cust-1', MONTH),
    calculatePaymentAllocations(state).forMonth('cust-1', MONTH)
  );

  const receipt = buildPaymentReceipt(customer, bill, bill.payments.at(-1));
  assert.equal(receipt.concessionAmount, 250);
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.status, 'PAID');
  assert.equal(receipt.fifoShow, false, 'a plain package-only bill hides the gross FIFO split');
});

test('paisa-exact concession, toggle OFF: Rs 100.37 passes the seam untouched and is consumed as exactly 10,037 cents', () => {
  const handSuggestion = { suggestedAmount: 100.37, reason: 'Outage Reaayat: manual figure' };
  const off = roundedConcessionSuggestion(handSuggestion, { enabled: false, mode: 'nearest' });
  assert.equal(off.suggestedAmount, 100.37);
  assert.equal(off.rawSuggestedAmount, 100.37);
  assert.equal(off.rounding, null);
  const exact = roundedConcessionSuggestion(handSuggestion, { enabled: true, mode: 'exact' });
  assert.equal(exact.suggestedAmount, 100.37);
  assert.equal(exact.rounding, null);

  let state = billState();
  state = applyConcessionToBill(state, 'cust-1', MONTH, { amount: off.suggestedAmount, reason: off.reason, rounding: off.rounding }, REF);
  assert.equal(billOf(state).concessionAmount, 100.37, 'the sanitizer keeps the paisa figure at 2dp — it is not note-rounded at stamp time');
  assert.equal(engineBalance(state), 289963, '300,000 - 10,037 = 289,963 cents exactly');
  assert.equal(computeLedgerBalance(state.customers[0]).balanceCents, 289963);
});

test('FIFO split (as shipped): gross-bucket view — its remainder on a concession-settled bill equals exactly the stamped concession; the money of record stays net', () => {
  // Plain shape: no arrears, no kist — the split exists but is hidden.
  let state = billState();
  const suggestion = buildConcessionSuggestion(state.customers[0], billOf(state), COMPLAINTS_54H);
  const effective = roundedConcessionSuggestion(suggestion, { enabled: true, mode: 'nearest' });
  state = applyConcessionToBill(state, 'cust-1', MONTH, {
    amount: effective.suggestedAmount,
    reason: effective.reason,
    rounding: effective.rounding
  }, REF);
  state = addPayment(state, 'cust-1', MONTH, { date: '2026-10-14', amount: 2750, method: 'Cash' }, REF);
  const customer = state.customers[0];
  const bill = billOf(state);
  const derived = allocateFifoForBill(customer, bill);
  assert.equal(derived.context.totalDue, BILL, 'FIFO context is the GROSS dueAmount by construction');
  assert.equal(derived.payments[0].toPackage, 2750, 'the split attributes the cash portion only');
  assert.equal(derived.remaining.total, 250);
  assert.equal(derived.remaining.total * 100 - engineBalance(state), bill.concessionAmount * 100,
    'FIFO remainder − engine balance == the stamped concession, to the cent');
  assert.equal(fifoAllocationForPayment(customer, bill, bill.payments.at(-1).id).show, false);

  // Arrears shape: the split IS shown on receipts — pin the same
  // identity there, and that the arrears bucket itself is net-exact
  // (October carries no concession, so its arrears stay a full 3,000
  // in both the engine and the FIFO context).
  const NOV_REF = new Date('2026-11-15T12:00:00+05:00');
  let s2 = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  s2 = saveBillMonth(s2, 'cust-1', { month: MONTH, dueAmount: BILL, status: 'pending' }, REF);
  s2 = saveBillMonth(s2, 'cust-1', { month: '2026-11', dueAmount: BILL, status: 'pending' }, NOV_REF);
  s2 = applyConcessionToBill(s2, 'cust-1', '2026-11', {
    amount: effective.suggestedAmount,
    reason: effective.reason,
    rounding: effective.rounding
  }, NOV_REF);
  // One combined collection: 3,000 of October arrears + November's net
  // 2,750. FIFO attributes oldest-first (arrears, then package).
  s2 = addPayment(s2, 'cust-1', '2026-11', { date: '2026-11-14', amount: 5750, method: 'Cash' }, NOV_REF);
  const cust2 = s2.customers[0];
  const novBill = cust2.bills.find((b) => b.month === '2026-11');
  const fifo = fifoAllocationForPayment(cust2, novBill, novBill.payments.at(-1).id);
  assert.equal(fifo.show, true, 'arrears present — the split is shown in this shape');
  assert.equal(fifo.allocation.toArrears, 3000);
  assert.equal(fifo.allocation.toPackage, 2750);
  assert.equal(fifo.remaining.package, 250);
  assert.equal(engineBalance(s2, '2026-11'), 0, 'the engine settles November in full: 2,750 cash + 250 stamped concession');
  assert.equal(fifo.remaining.package * 100 - engineBalance(s2, '2026-11'), novBill.concessionAmount * 100,
    'the identity holds in the shown shape too: the only difference is the stamped concession itself');
  assert.equal(arrearsAndAdvance(cust2, '2026-11').previousArrears, BILL, 'October arrears are gross in both views — October has no concession');
  assert.equal(engineBalance(s2, MONTH), 300000);
});
