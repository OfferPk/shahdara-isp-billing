// M13: Quick Collect Settlement Cascade Pin (test-only).
//
// One Quick Collect payment (nav-quick-collect.js executeQuickCollection
// -> core addPayment) settles a stack of dues in a fixed cascade:
//   1. the customer's BILL dues are senior — the carve-out plans are
//      computed from the remainder (amount - total bill balance due);
//   2. from that remainder, manual baqaya (OWNER-LOAN) settles FIRST,
//      FIFO by entry date, part-settling the last entry reached
//      (core planManualBaqayaSettlement);
//   3. then billed ticket charges (SISP-43) settle — WHOLE charges
//      only, oldest first (complaint-tickets planTicketChargeSettlement);
//   4. then speed-boost add-on fees (SISP-106) settle from what the
//      ticket plan left — whole fees only, oldest first
//      (speed-addon planAddonChargeSettlement);
//   5. whatever bill money remains after the bill itself is full
//      becomes advance credit in the allocation engine — never the
//      stamped carve-out portions, which are consumed by their own
//      ledgers and are never bill money and never credit.
// The settled lines ride the payment as stamps (manualBaqayaSettlements
// / ticketCharges / addonCharges); core's allocation engine and the
// billing-cycle FIFO mirror both exclude exactly those stamped
// portions (and skip SISP-34 voided payments entirely).
// Rounding (SISP-131 + the Rs 50 toggle) happens at STAMP time only —
// a concession is stamped at its rounded figure and every downstream
// figure derives from the stamp; allocation itself never rounds, it
// moves paisa-exact amounts.
//
// Per-feature tests pinned each carve-out in isolation; no test drove
// ONE payment through the whole cascade with all three carve-outs
// pending at once. Any divergence = STOP and report — never fix money
// behaviour inside a pin phase.
//
// Synthetic data only; zero shipped files changed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addManualBaqayaEntry,
  addPayment,
  applyConcessionToBill,
  calculatePaymentAllocations,
  manualBaqayaOutstanding,
  saveBillMonth
} from '../core.js';
import {
  executeQuickCollection,
  getCustomerPaymentDefaults
} from '../nav-quick-collect.js';
import {
  billedTicketChargesPending,
  createTicket,
  resolveTicket,
  unsettleTicketChargesForPayment
} from '../complaint-tickets.js';
import {
  addSpeedBoost,
  addonChargesPending,
  speedBoostsOf,
  unsettleAddonChargesForPayment
} from '../speed-addon.js';
import {
  allocateFifoForBill,
  fifoAllocationForPayment
} from '../billing-cycle.js';
import { voidPayment } from '../payment-void-audit.js';
import {
  roundedConcessionSuggestion,
  suggestConcession
} from '../concession-helper.js';
import {
  roundToNearest50,
  roundedAmountFor
} from '../bill-rounding-helper.js';

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';

// The full stack used by the cascade cases:
//   bill 3,000 + baqaya 1,500 + tickets 500/300 + boosts 200/150 = 5,650.
const BILL = 3000;
const BAQAYA = 1500;
const TICKET_1 = 500;
const TICKET_2 = 300;
const BOOST_1 = 200;
const BOOST_2 = 150;

function baseCustomer() {
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
    installmentPlans: []
  };
}

/**
 * State with the October bill (3,000), one manual baqaya entry (1,500,
 * MBQ-101) and two pending boost fees (BST-101: 200, BST-102: 150).
 * With billPaid, the bill is already settled by an earlier plain
 * payment, so the collect under test faces carve-outs only.
 */
function cascadeState({ billPaid = false } = {}) {
  let state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: BILL, status: 'pending' }, REF);
  if (billPaid) {
    state = addPayment(state, 'cust-1', MONTH, { date: '2026-10-05', amount: BILL, method: 'Cash' }, REF);
  }
  state = addManualBaqayaEntry(state, 'cust-1', { amount: BAQAYA, date: '2026-09-10', note: 'Last month balance' }, REF);
  ({ state } = addSpeedBoost(state, 'cust-1', { boostMbps: 15, durationDays: 10, addonFeePKR: BOOST_1, startDate: '2026-10-05' }, REF));
  ({ state } = addSpeedBoost(state, 'cust-1', { boostMbps: 25, durationDays: 5, addonFeePKR: BOOST_2, startDate: '2026-10-06' }, REF));
  return state;
}

/** Two resolved+billed ticket charges: TKT-101 (500), TKT-102 (300). */
function billedTickets() {
  let tickets = [];
  const add = (amount) => {
    const created = createTicket({
      customerId: 'cust-1',
      customerName: 'Synthetic Subscriber',
      faultPreset: 'Fiber Cut / Splice Loss',
      technician: 'Test Lineman'
    }, tickets);
    tickets = resolveTicket([...tickets, created], created.id, {
      materialsUsed: [{ key: 'patch-cord', qty: 1, amount }],
      billingType: 'billed',
      referenceDate: REF
    });
  };
  add(TICKET_1);
  add(TICKET_2);
  return tickets;
}

function collect(state, amount, tickets) {
  return executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
}

function billOf(state) {
  return state.customers[0].bills.find((b) => b.month === MONTH);
}

function lastPayment(state) {
  const bill = billOf(state);
  return bill.payments[bill.payments.length - 1];
}

test('setup pin: the collect surface joins bill + baqaya + tickets + boosts exactly once', () => {
  const state = cascadeState();
  const tickets = billedTickets();
  const defaults = getCustomerPaymentDefaults(state, 'cust-1', REF, tickets);
  assert.equal(defaults.totalDues, BILL);
  assert.equal(defaults.manualBaqayaPending, BAQAYA);
  assert.equal(defaults.ticketChargesPending, TICKET_1 + TICKET_2);
  assert.equal(defaults.addonChargesPending, BOOST_1 + BOOST_2);
  assert.equal(defaults.payableTotal, 5650);
  assert.equal(defaults.suggestedAmount, 5650);
});

test('cascade (a): a payment smaller than the baqaya alone part-settles baqaya only', () => {
  // Bill already paid in full, so the whole 500 faces the carve-outs;
  // baqaya is first in the cascade and absorbs it as a partial stamp.
  const state = cascadeState({ billPaid: true });
  const tickets = billedTickets();
  const { nextState, receipt } = collect(state, 500, tickets);

  const payment = lastPayment(nextState);
  assert.equal(payment.amount, 500);
  assert.deepEqual(payment.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: 500 }]);
  assert.equal(payment.ticketCharges, undefined);
  assert.equal(payment.addonCharges, undefined);

  // Baqaya drops by exactly the stamp; tickets and boosts untouched.
  const customer = nextState.customers[0];
  assert.equal(manualBaqayaOutstanding(customer), BAQAYA - 500);
  assert.equal(billedTicketChargesPending(tickets, 'cust-1'), TICKET_1 + TICKET_2);
  assert.equal(addonChargesPending(customer), BOOST_1 + BOOST_2);
  assert.equal(receipt.manualBaqayaSettledTotal, 500);
  assert.equal(receipt.manualBaqayaPending, BAQAYA - 500);
  assert.equal(receipt.ticketChargesTotal, 0);
  assert.equal(receipt.addonChargesTotal, 0);
  assert.equal(receipt.payableRemaining, 1000 + 800 + 350);

  // Bill allocation: the stamped 500 is baqaya money, never bill money —
  // the payment's ledger row carries it as a carve-out and applies
  // nothing anywhere; the (already paid) bill stays at zero due.
  const allocations = calculatePaymentAllocations(nextState);
  assert.equal(allocations.forMonth('cust-1', MONTH).balanceDueCents, 0);
  const ledger = allocations.byPaymentId.get(payment.id);
  assert.equal(ledger.manualBaqayaCents, 50000);
  assert.equal(ledger.ticketChargeCents, 0);
  assert.equal(ledger.addonChargeCents, 0);
  assert.deepEqual(ledger.allocations, []);
  assert.equal(ledger.excessCents, 0);
  assert.equal(ledger.unappliedCreditCents, 0);
  assert.equal(receipt.advanceCreditGenerated, 0);

  // FIFO mirror: the payment's effective bill money is 500 - 500 = 0,
  // so its split is all zeros and the earlier full payment's split is
  // undisturbed.
  const fifo = fifoAllocationForPayment(customer, billOf(nextState), payment.id);
  assert.equal(fifo.allocation.toArrears, 0);
  assert.equal(fifo.allocation.toPackage, 0);
  assert.equal(fifo.allocation.toKist, 0);
  assert.equal(fifo.remaining.package, 0);
});

test('cascade (b): bill + full baqaya + the oldest ticket charge only', () => {
  // 5,000 = 3,000 bill + 1,500 baqaya + 500 oldest ticket. The second
  // ticket (300) and both boosts stay pending: the remainder is spent.
  const state = cascadeState();
  const tickets = billedTickets();
  const { nextState, receipt, nextTickets } = collect(state, 5000, tickets);

  const payment = lastPayment(nextState);
  assert.deepEqual(payment.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: BAQAYA }]);
  assert.deepEqual(payment.ticketCharges, [{ ticketId: 'TKT-101', amount: TICKET_1 }]);
  assert.equal(payment.addonCharges, undefined);

  const customer = nextState.customers[0];
  assert.equal(manualBaqayaOutstanding(customer), 0);
  assert.equal(nextTickets[0].chargePaid, true);
  assert.equal(nextTickets[0].chargePaymentId, payment.id);
  assert.equal(nextTickets[1].chargePaid, false);
  assert.equal(billedTicketChargesPending(nextTickets, 'cust-1'), TICKET_2);
  assert.equal(addonChargesPending(customer), BOOST_1 + BOOST_2);

  // Bill allocation to the cent: exactly the 3,000 bill portion applied,
  // no excess, no manufactured credit.
  const allocations = calculatePaymentAllocations(nextState);
  assert.equal(allocations.forMonth('cust-1', MONTH).balanceDueCents, 0);
  const ledger = allocations.byPaymentId.get(payment.id);
  assert.equal(ledger.manualBaqayaCents, BAQAYA * 100);
  assert.equal(ledger.ticketChargeCents, TICKET_1 * 100);
  assert.equal(ledger.addonChargeCents, 0);
  assert.deepEqual(ledger.allocations, [{ month: MONTH, amountCents: BILL * 100, kind: 'same-month' }]);
  assert.equal(ledger.excessCents, 0);
  assert.equal(ledger.unappliedCreditCents, 0);

  assert.equal(receipt.manualBaqayaSettledTotal, BAQAYA);
  assert.equal(receipt.ticketChargesTotal, TICKET_1);
  assert.equal(receipt.addonChargesTotal, 0);
  assert.equal(receipt.payableRemaining, TICKET_2 + BOOST_1 + BOOST_2);
  assert.equal(receipt.isSettled, false);
  assert.equal(receipt.advanceCreditGenerated, 0);

  // FIFO mirror sees only the 3,000 bill portion of the 5,000 receipt.
  const fifo = fifoAllocationForPayment(customer, billOf(nextState), payment.id);
  assert.equal(fifo.allocation.toPackage, BILL);
  assert.equal(fifo.remaining.package, 0);
});

test('cascade order: tickets drain the remainder before boosts; a boost fee settles whole or not at all', () => {
  // 5,500 = bill + baqaya + both tickets + exactly the oldest boost.
  const state = cascadeState();
  const tickets = billedTickets();
  const { nextState, receipt } = collect(state, 5500, tickets);

  const payment = lastPayment(nextState);
  assert.deepEqual(payment.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: BAQAYA }]);
  assert.deepEqual(payment.ticketCharges, [
    { ticketId: 'TKT-101', amount: TICKET_1 },
    { ticketId: 'TKT-102', amount: TICKET_2 }
  ]);
  assert.deepEqual(payment.addonCharges, [{ boostId: 'BST-101', amount: BOOST_1 }]);

  const customer = nextState.customers[0];
  const boosts = speedBoostsOf(customer);
  assert.equal(boosts[0].chargePaid, true);
  assert.equal(boosts[0].chargePaymentId, payment.id);
  assert.equal(boosts[1].chargePaid, false);
  assert.equal(addonChargesPending(customer), BOOST_2);
  assert.equal(receipt.addonChargesTotal, BOOST_1);
  assert.equal(receipt.addonChargesPending, BOOST_2);
  assert.equal(receipt.payableRemaining, BOOST_2);

  const ledger = calculatePaymentAllocations(nextState).byPaymentId.get(payment.id);
  assert.equal(ledger.ticketChargeCents, (TICKET_1 + TICKET_2) * 100);
  assert.equal(ledger.addonChargeCents, BOOST_1 * 100);
  assert.equal(ledger.manualBaqayaCents, BAQAYA * 100);
  assert.equal(ledger.excessCents, 0);
  assert.equal(ledger.unappliedCreditCents, 0);
});

test('cascade order: a remainder too small for the oldest boost fee settles no boost at all', () => {
  // 5,400 = bill + baqaya + both tickets + 100 spare. The oldest boost
  // fee is 200 and boost fees never split, so the spare 100 cannot
  // settle any boost; it stays bill-side money and becomes credit.
  const state = cascadeState();
  const tickets = billedTickets();
  const { nextState, receipt } = collect(state, 5400, tickets);

  const payment = lastPayment(nextState);
  assert.deepEqual(payment.ticketCharges, [
    { ticketId: 'TKT-101', amount: TICKET_1 },
    { ticketId: 'TKT-102', amount: TICKET_2 }
  ]);
  assert.equal(payment.addonCharges, undefined);
  assert.equal(receipt.addonChargesTotal, 0);
  assert.equal(receipt.addonChargesPending, BOOST_1 + BOOST_2);
  assert.equal(receipt.ticketChargesPending, 0);

  const ledger = calculatePaymentAllocations(nextState).byPaymentId.get(payment.id);
  assert.equal(ledger.addonChargeCents, 0);
  // Bill portion is 5,400 - 1,500 - 800 = 3,100 against a 3,000 bill:
  // the un-split 100 is ordinary excess credit, to the cent.
  assert.equal(ledger.excessCents, 10000);
  assert.equal(ledger.unappliedCreditCents, 10000);
  assert.equal(receipt.advanceCreditGenerated, 100);
});

test('cascade (c): everything settles and the overpay spills into advance credit', () => {
  // Total payable is 5,650; paying 6,000 leaves exactly 350 of credit.
  const state = cascadeState();
  const tickets = billedTickets();
  const { nextState, receipt, nextTickets } = collect(state, 6000, tickets);

  const payment = lastPayment(nextState);
  assert.deepEqual(payment.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: BAQAYA }]);
  assert.deepEqual(payment.ticketCharges, [
    { ticketId: 'TKT-101', amount: TICKET_1 },
    { ticketId: 'TKT-102', amount: TICKET_2 }
  ]);
  assert.deepEqual(payment.addonCharges, [
    { boostId: 'BST-101', amount: BOOST_1 },
    { boostId: 'BST-102', amount: BOOST_2 }
  ]);

  const customer = nextState.customers[0];
  assert.equal(manualBaqayaOutstanding(customer), 0);
  assert.equal(billedTicketChargesPending(nextTickets, 'cust-1'), 0);
  assert.equal(addonChargesPending(customer), 0);
  for (const boost of speedBoostsOf(customer)) {
    assert.equal(boost.chargePaid, true);
    assert.equal(boost.chargePaymentId, payment.id);
  }

  // Bill allocation to the cent: bill portion 6,000 - 2,650 stamps =
  // 3,350; 3,000 settles the bill, exactly 350 becomes advance credit.
  const allocations = calculatePaymentAllocations(nextState);
  assert.equal(allocations.forMonth('cust-1', MONTH).balanceDueCents, 0);
  const ledger = allocations.byPaymentId.get(payment.id);
  assert.equal(ledger.manualBaqayaCents, BAQAYA * 100);
  assert.equal(ledger.ticketChargeCents, (TICKET_1 + TICKET_2) * 100);
  assert.equal(ledger.addonChargeCents, (BOOST_1 + BOOST_2) * 100);
  assert.deepEqual(ledger.allocations, [{ month: MONTH, amountCents: BILL * 100, kind: 'same-month' }]);
  assert.equal(ledger.excessCents, 35000);
  assert.equal(ledger.unappliedCreditCents, 35000);

  assert.equal(receipt.isSettled, true);
  assert.equal(receipt.payableRemaining, 0);
  assert.equal(receipt.advanceCreditGenerated, 350);

  // FIFO mirror: the split caps at the bill buckets; the stamped
  // portions and the credit never enter it.
  const fifo = fifoAllocationForPayment(customer, billOf(nextState), payment.id);
  assert.equal(fifo.allocation.toPackage, BILL);
  assert.deepEqual(fifo.remaining, { arrears: 0, package: 0, kist: 0 });
  assert.equal(allocateFifoForBill(customer, billOf(nextState)).remaining.total, 0);
});

test('void: a voided cascade payment contributes nothing — engine, baqaya and FIFO all roll back', () => {
  const state = cascadeState();
  const tickets = billedTickets();
  const { nextState, nextTickets } = collect(state, 6000, tickets);
  const payment = lastPayment(nextState);

  const { state: voidedState } = voidPayment(nextState, 'cust-1', MONTH, payment.id, { voidReason: 'Recorded against the wrong customer' });
  const voidedCustomer = voidedState.customers[0];
  const voidedPayment = billOf(voidedState).payments.find((p) => p.id === payment.id);
  assert.equal(voidedPayment.voided, true);

  // Engine: the whole bill is due again and the payment has no ledger
  // row at all — no allocation, no credit, no carve-out figures.
  const allocations = calculatePaymentAllocations(voidedState);
  assert.equal(allocations.forMonth('cust-1', MONTH).balanceDueCents, BILL * 100);
  assert.equal(allocations.byPaymentId.get(payment.id), undefined);

  // Baqaya: the settled-by-stamp derivation skips voided payments, so
  // the full 1,500 is outstanding again.
  assert.equal(manualBaqayaOutstanding(voidedCustomer), BAQAYA);

  // FIFO mirror: the voided payment leaves no split entry and consumes
  // no bucket; a per-payment lookup finds nothing.
  const derived = allocateFifoForBill(voidedCustomer, billOf(voidedState));
  assert.deepEqual(derived.payments, []);
  assert.equal(derived.remaining.total, BILL);
  assert.equal(fifoAllocationForPayment(voidedCustomer, billOf(voidedState), payment.id), null);

  // The side ledgers reopen exactly the lines this payment settled.
  const reopenedTickets = unsettleTicketChargesForPayment(nextTickets, voidedPayment);
  assert.deepEqual(reopenedTickets.reopened, ['TKT-101', 'TKT-102']);
  assert.equal(billedTicketChargesPending(reopenedTickets.tickets, 'cust-1'), TICKET_1 + TICKET_2);
  const reopenedBoosts = unsettleAddonChargesForPayment(nextState.customers[0], voidedPayment);
  assert.deepEqual(reopenedBoosts.reopened, ['BST-101', 'BST-102']);
  assert.equal(addonChargesPending(reopenedBoosts.customer), BOOST_1 + BOOST_2);
});

test('rounding (SISP-131): the Rs 50 toggle rounds at stamp time only; allocation never rounds', () => {
  // The helper seam: raw suggestion for 54h offline on a 3,000 package
  // is 225; the toggle stamps 250 and keeps 225 only in the audit tag.
  const suggestion = suggestConcession({ packageRate: 3000, downtimeHours: 54 });
  assert.equal(suggestion.suggestedAmount, 225);
  assert.equal(roundToNearest50(225, 'nearest'), 250);
  assert.deepEqual(roundedAmountFor(225, { enabled: false, mode: 'nearest' }), { amount: 225, rounding: null });
  const rounded = roundedConcessionSuggestion(suggestion, { enabled: true, mode: 'nearest' });
  assert.equal(rounded.suggestedAmount, 250);
  assert.equal(rounded.rawSuggestedAmount, 225);
  assert.deepEqual(rounded.rounding, { rawAmount: 225, roundedAmount: 250, mode: 'nearest' });

  // Stamp the rounded figure on the bill through the real apply path:
  // the audit tag rides the amount-history entry, and every downstream
  // figure derives from the stamp (3,000 - 250 = 2,750 due).
  let state = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: BILL, status: 'pending' }, REF);
  state = addManualBaqayaEntry(state, 'cust-1', { amount: BAQAYA, date: '2026-09-10', note: 'Last month balance' }, REF);
  state = applyConcessionToBill(state, 'cust-1', MONTH, {
    amount: rounded.suggestedAmount,
    reason: rounded.reason,
    rounding: rounded.rounding
  }, REF);
  const stampedBill = billOf(state);
  assert.equal(stampedBill.concessionAmount, 250);
  assert.deepEqual(stampedBill.amountHistory.at(-1).rounding, { rawAmount: 225, roundedAmount: 250, mode: 'nearest' });
  assert.equal(calculatePaymentAllocations(state).forMonth('cust-1', MONTH).balanceDueCents, 275000);

  // The cascade remainder derives from the STAMPED due: paying
  // 2,750 + 1,500 settles the bill and the full baqaya, to the cent,
  // with no excess — proof no second rounding happens downstream.
  const { nextState, receipt } = collect(state, 4250, []);
  const payment = lastPayment(nextState);
  assert.deepEqual(payment.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: BAQAYA }]);
  const allocations = calculatePaymentAllocations(nextState);
  assert.equal(allocations.forMonth('cust-1', MONTH).balanceDueCents, 0);
  const ledger = allocations.byPaymentId.get(payment.id);
  assert.deepEqual(ledger.allocations, [{ month: MONTH, amountCents: 275000, kind: 'same-month' }]);
  assert.equal(ledger.excessCents, 0);
  assert.equal(ledger.unappliedCreditCents, 0);
  assert.equal(receipt.advanceCreditGenerated, 0);

  // Toggle off: the raw 225 is stamped and the due is 2,775 exactly.
  let rawState = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  rawState = saveBillMonth(rawState, 'cust-1', { month: MONTH, dueAmount: BILL, status: 'pending' }, REF);
  rawState = applyConcessionToBill(rawState, 'cust-1', MONTH, { amount: 225, reason: suggestion.reason }, REF);
  assert.equal(billOf(rawState).concessionAmount, 225);
  assert.equal(billOf(rawState).amountHistory.at(-1).rounding, undefined);
  assert.equal(calculatePaymentAllocations(rawState).forMonth('cust-1', MONTH).balanceDueCents, 277500);

  // Allocation itself never note-rounds a payment: a paisa-exact
  // 100.37 collection applies 10,037 cents and leaves 289,963 due.
  let paisaState = { version: 1, nextCustomerNumber: 102, customers: [baseCustomer()] };
  paisaState = saveBillMonth(paisaState, 'cust-1', { month: MONTH, dueAmount: BILL, status: 'pending' }, REF);
  const paisa = collect(paisaState, 100.37, []);
  const paisaLedger = calculatePaymentAllocations(paisa.nextState).byPaymentId.get(lastPayment(paisa.nextState).id);
  assert.deepEqual(paisaLedger.allocations, [{ month: MONTH, amountCents: 10037, kind: 'same-month' }]);
  assert.equal(calculatePaymentAllocations(paisa.nextState).forMonth('cust-1', MONTH).balanceDueCents, 289963);
});
