// SISP-43: Billed Ticket Charges (pendingTicketCharges) Collect Modal &
// Receipt Integration. Spec test criterion (verbatim): "A customer with
// Rs. 3,000 monthly bill + Rs. 500 billed ticket charge shows Rs. 3,500
// payable in Collect, and paying Rs. 3,500 clears both and prints both
// lines."
//
// Design pinned here: ONE payment through the standard path
// (executeQuickCollection -> core addPayment). The settled ticket lines
// ride the payment as a `ticketCharges` stamp; core's allocation engine
// keeps that portion out of bill allocation and advance credit. Tickets
// settle whole, oldest first, only from the amount left after ALL bill
// dues. Void (SISP-34) excludes the payment everywhere as before and
// reopens exactly the charges its stamp settled.
//
// Synthetic data only — no real customer names anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addPayment,
  calculatePaymentAllocations,
  correctPayment,
  deletePayment,
  saveBillMonth,
  validatePayment
} from '../core.js';
import {
  billedTicketChargesPending,
  createTicket,
  loadTickets,
  markTicketChargePaid,
  pendingTicketChargeLines,
  planTicketChargeSettlement,
  resolveTicket,
  saveTickets,
  settleTicketCharges,
  unsettleTicketChargesForPayment
} from '../complaint-tickets.js';
import {
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  getCustomerPaymentDefaults,
  renderQuickCollectReceiptCardHtml
} from '../nav-quick-collect.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { buildEscPosReceipt, escPosFieldsFromPaymentReceipt } from '../thermal-printer.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';
import { voidPayment } from '../payment-void-audit.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { fifoAllocationForPayment } from '../billing-cycle.js';

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

function stateWithBill(dueAmount = 3000) {
  let state = {
    customers: [{
      id: 'cust-1',
      customerNumber: 101,
      name: 'Synthetic Subscriber',
      phone: '03001234567',
      area: 'Test Area',
      archived: false,
      bills: []
    }]
  };
  if (dueAmount !== null) {
    state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount, status: 'pending' }, REF);
  }
  return state;
}

function billedTicket(customerId = 'cust-1', amount = 500, existing = []) {
  const created = createTicket({
    customerId,
    customerName: 'Synthetic Subscriber',
    faultPreset: 'Fiber Cut / Splice Loss',
    technician: 'Test Lineman'
  }, existing);
  return resolveTicket([...existing, created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount }],
    billingType: 'billed',
    referenceDate: REF
  });
}

test('planner: pending lines are resolved+billed+unpaid only, oldest first; plan takes whole charges within budget', () => {
  let tickets = billedTicket('cust-1', 500);
  tickets = billedTicket('cust-1', 300, tickets);
  assert.deepEqual(pendingTicketChargeLines(tickets, 'cust-1'), [
    { ticketId: 'TKT-101', amount: 500 },
    { ticketId: 'TKT-102', amount: 300 }
  ]);
  // Budget covers only the oldest -> strictly the oldest, never a later smaller one first.
  assert.deepEqual(planTicketChargeSettlement(tickets, 'cust-1', 40000), { lines: [], totalCents: 0 });
  assert.deepEqual(planTicketChargeSettlement(tickets, 'cust-1', 50000), {
    lines: [{ ticketId: 'TKT-101', amount: 500 }],
    totalCents: 50000
  });
  assert.deepEqual(planTicketChargeSettlement(tickets, 'cust-1', 80000).totalCents, 80000);
  assert.deepEqual(planTicketChargeSettlement(tickets, 'other', 80000), { lines: [], totalCents: 0 });
});

test('settle/unsettle: payment id stamped, already-paid and foreign settlements are never touched twice', () => {
  const tickets = billedTicket('cust-1', 500);
  const settled = settleTicketCharges(tickets, [{ ticketId: 'TKT-101', amount: 500 }], 'pay-1', REF);
  assert.equal(settled[0].chargePaid, true);
  assert.equal(settled[0].chargePaymentId, 'pay-1');
  assert.ok(settled[0].chargePaidAt);
  // Second settle attempt (same lines, another payment) changes nothing.
  const again = settleTicketCharges(settled, [{ ticketId: 'TKT-101', amount: 500 }], 'pay-2', REF);
  assert.equal(again[0].chargePaymentId, 'pay-1');
  // A mismatched amount never settles.
  const fresh = billedTicket('cust-1', 500);
  const mismatch = settleTicketCharges(fresh, [{ ticketId: 'TKT-101', amount: 400 }], 'pay-3', REF);
  assert.equal(mismatch[0].chargePaid, false);
  // Unsettle by the owning payment reopens exactly its charge.
  const payment = { id: 'pay-1', ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }] };
  const { tickets: reopenedList, reopened } = unsettleTicketChargesForPayment(settled, payment);
  assert.deepEqual(reopened, ['TKT-101']);
  assert.equal(reopenedList[0].chargePaid, false);
  assert.equal(reopenedList[0].chargePaymentId, '');
  // Unsettle naming a different payment leaves the settlement alone.
  const foreign = unsettleTicketChargesForPayment(settled, { id: 'pay-9', ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }] });
  assert.deepEqual(foreign.reopened, []);
  assert.equal(foreign.tickets[0].chargePaid, true);
});

test('spec scenario: 3,000 bill + 500 ticket charge -> 3,500 payable in Collect, one payment clears both', () => {
  const state = stateWithBill(3000);
  const tickets = billedTicket('cust-1', 500);

  const defaults = getCustomerPaymentDefaults(state, 'cust-1', REF, tickets);
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.ticketChargesPending, 500);
  assert.equal(defaults.payableTotal, 3500);
  assert.equal(defaults.suggestedAmount, 3500);

  const { nextState, receipt, nextTickets } = executeQuickCollection(state, {
    customerId: 'cust-1',
    month: MONTH,
    amount: 3500,
    date: '2026-10-15',
    method: 'Cash',
    tickets
  }, REF);

  // One real payment record through the standard path, carrying the stamp.
  const bill = nextState.customers[0].bills.find((b) => b.month === MONTH);
  assert.equal(bill.payments.length, 1);
  const payment = bill.payments[0];
  assert.equal(payment.amount, 3500);
  assert.deepEqual(payment.ticketCharges, [{ ticketId: 'TKT-101', amount: 500 }]);

  // Allocations: bill fully settled, and the ticket portion manufactured
  // NO advance credit.
  const allocations = calculatePaymentAllocations(nextState);
  assert.equal(allocations.forMonth('cust-1', MONTH).balanceDueCents, 0);
  const ledger = allocations.byPaymentId.get(payment.id);
  assert.equal(ledger.ticketChargeCents, 50000);
  assert.equal(ledger.excessCents, 0);
  assert.equal(ledger.unappliedCreditCents, 0);

  // Ticket side: settled against exactly this payment; nothing pending.
  assert.equal(nextTickets[0].chargePaid, true);
  assert.equal(nextTickets[0].chargePaymentId, payment.id);
  assert.equal(billedTicketChargesPending(nextTickets, 'cust-1'), 0);

  // Receipt object: settled in full only because charges cleared too.
  assert.equal(receipt.ticketChargesTotal, 500);
  assert.equal(receipt.payableRemaining, 0);
  assert.equal(receipt.isSettled, true);
});

test('spec scenario receipts: both lines print on HTML (3 formats), PNG model, ESC/POS and both WhatsApp drafts', () => {
  const state = stateWithBill(3000);
  const tickets = billedTicket('cust-1', 500);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3500, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  const customer = nextState.customers[0];
  const bill = customer.bills.find((b) => b.month === MONTH);
  const payment = bill.payments[0];

  const built = buildPaymentReceipt(customer, bill, payment);
  assert.deepEqual(built.ticketCharges, [{ ticketId: 'TKT-101', amount: 500 }]);
  assert.equal(built.ticketChargesTotal, 500);
  assert.equal(built.paidAmount, 3500);
  assert.equal(built.status, 'PAID');
  assert.equal(built.balanceDueCents, 0);

  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(built, { format });
    assert.ok(html.includes('Murammat / Material Charge (TKT-101)'), `${format} prints the ticket line`);
    assert.ok(html.includes('PKR 500'), `${format} prints the charge amount`);
    assert.ok(html.includes('PKR 3,500'), `${format} prints the total received`);
  }

  const pngModel = buildPngReceiptModel(built, customer);
  const chargeLine = pngModel.financial.find((line) => line.label === 'Murammat / Material Charge (TKT-101)');
  assert.ok(chargeLine, 'PNG model carries the ticket line');
  assert.ok(chargeLine.value.includes('500'));
  assert.equal(pngModel.seal.kind, 'PAID');

  const escpos = buildEscPosReceipt(escPosFieldsFromPaymentReceipt(built));
  assert.ok(escpos.text.includes('Murammat (TKT-101)'));
  assert.ok(escpos.text.includes('PKR 500'));

  const waQuick = formatQuickCollectWhatsAppReceipt(receipt);
  assert.ok(waQuick.text.includes('Murammat / Material Charge (TKT-101):* PKR 500'));
  assert.ok(waQuick.text.includes('PAID IN FULL'));

  const waProfile = createReceiptWhatsAppDraft('+923001234567', {
    customerId: 'cust-1',
    customerName: 'Synthetic Subscriber',
    customerNumber: 101,
    date: '2026-10-15',
    month: MONTH,
    amount: 3500,
    method: 'Cash',
    billStatus: 'paid',
    billAmount: 3000,
    balanceDueCents: 0,
    ticketCharges: built.ticketCharges
  });
  assert.ok(waProfile, 'profile WhatsApp draft builds');
  assert.ok(waProfile.message.includes('Murammat / Material Charge (TKT-101): PKR 500'));

  const card = renderQuickCollectReceiptCardHtml(receipt);
  assert.ok(card.includes('Murammat / Material Charge (TKT-101)'));
});

test('double collection is impossible: a settled charge never settles or stamps again', () => {
  const state = stateWithBill(3000);
  const tickets = billedTicket('cust-1', 500);
  const first = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3500, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  // A second collection against the settled ticket list has nothing to
  // settle: no stamp, and the extra cash behaves as ordinary bill money.
  const second = executeQuickCollection(first.nextState, {
    customerId: 'cust-1', month: MONTH, amount: 100, date: '2026-10-15', method: 'Cash', tickets: first.nextTickets
  }, REF);
  const bill = second.nextState.customers[0].bills.find((b) => b.month === MONTH);
  const secondPayment = bill.payments[bill.payments.length - 1];
  assert.equal(secondPayment.ticketCharges, undefined);
  assert.equal(second.receipt.ticketChargesTotal, 0);
  assert.equal(second.nextTickets, undefined);
  assert.equal(billedTicketChargesPending(first.nextTickets, 'cust-1'), 0);
});

test('no pending charges: defaults, execution and receipts are exactly the pre-SISP-43 behaviour', () => {
  const state = stateWithBill(3000);
  const defaults = getCustomerPaymentDefaults(state, 'cust-1', REF);
  assert.equal(defaults.ticketChargesPending, 0);
  assert.equal(defaults.payableTotal, 3000);
  assert.equal(defaults.suggestedAmount, 3000);

  const { nextState, receipt, nextTickets } = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3000, date: '2026-10-15', method: 'Cash', tickets: []
  }, REF);
  assert.equal(nextTickets, undefined);
  assert.deepEqual(receipt.ticketCharges, []);
  assert.equal(receipt.payableRemaining, 0);
  const payment = nextState.customers[0].bills.find((b) => b.month === MONTH).payments[0];
  assert.equal(payment.ticketCharges, undefined);
  const built = buildPaymentReceipt(nextState.customers[0], nextState.customers[0].bills[0], payment);
  assert.deepEqual(built.ticketCharges, []);
  assert.ok(!generatePaymentReceiptHtml(built, { format: 'a4' }).includes('Murammat'));
});

test('partial collections: bills first — a charge settles only from what remains after ALL bill dues', () => {
  const state = stateWithBill(3000);
  const tickets = billedTicket('cust-1', 500);

  // Paying exactly the bill clears the bill and leaves the charge pending.
  const billOnly = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3000, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  const billOnlyPayment = billOnly.nextState.customers[0].bills.find((b) => b.month === MONTH).payments[0];
  assert.equal(billOnlyPayment.ticketCharges, undefined);
  assert.equal(billOnly.receipt.ticketChargesPending, 500);
  assert.equal(billOnly.receipt.payableRemaining, 500);
  assert.equal(billOnly.receipt.isSettled, false);
  assert.equal(billedTicketChargesPending(tickets, 'cust-1'), 500);

  // 3,200: remainder 200 cannot settle the whole 500 charge, so nothing
  // settles and the 200 stays ordinary advance credit.
  const partial = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3200, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  const partialPayment = partial.nextState.customers[0].bills.find((b) => b.month === MONTH).payments[0];
  assert.equal(partialPayment.ticketCharges, undefined);
  const partialAlloc = calculatePaymentAllocations(partial.nextState);
  assert.equal(partialAlloc.forMonth('cust-1', MONTH).balanceDueCents, 0);
  assert.equal(partialAlloc.byPaymentId.get(partialPayment.id).unappliedCreditCents, 20000);
  assert.equal(partial.receipt.ticketChargesPending, 500);
});

test('multiple charges: oldest settles first, whole charges only, leftover becomes credit', () => {
  const state = stateWithBill(3000);
  let tickets = billedTicket('cust-1', 300);
  tickets = billedTicket('cust-1', 500, tickets);
  const { nextState, receipt, nextTickets } = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3400, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  const payment = nextState.customers[0].bills.find((b) => b.month === MONTH).payments[0];
  // Remainder after dues is 400: TKT-101 (300) settles, TKT-102 (500) cannot.
  assert.deepEqual(payment.ticketCharges, [{ ticketId: 'TKT-101', amount: 300 }]);
  assert.equal(billedTicketChargesPending(nextTickets, 'cust-1'), 500);
  assert.equal(receipt.payableRemaining, 500);
  const allocations = calculatePaymentAllocations(nextState);
  assert.equal(allocations.byPaymentId.get(payment.id).unappliedCreditCents, 10000);
});

test('charge-only customer (no bill yet): the charge settles through a normal payment and creates no credit', () => {
  const state = stateWithBill(null);
  const tickets = billedTicket('cust-1', 500);
  const { nextState, receipt, nextTickets } = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 500, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  const bill = nextState.customers[0].bills.find((b) => b.month === MONTH);
  assert.ok(bill, 'a bill row carries the payment, as with any collection');
  assert.deepEqual(bill.payments[0].ticketCharges, [{ ticketId: 'TKT-101', amount: 500 }]);
  const allocations = calculatePaymentAllocations(nextState);
  assert.equal(allocations.byPaymentId.get(bill.payments[0].id).unappliedCreditCents, 0);
  assert.equal(billedTicketChargesPending(nextTickets, 'cust-1'), 0);
  assert.equal(receipt.isSettled, true);
});

test('validatePayment: the stamp is sanitized and can never exceed the collected amount', () => {
  const base = { date: '2026-10-15', amount: 3500, method: 'Cash' };
  const ok = validatePayment({ ...base, ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }] }, REF);
  assert.deepEqual(ok.ticketCharges, [{ ticketId: 'TKT-101', amount: 500 }]);
  assert.throws(() => validatePayment({ ...base, amount: 400, ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }] }, REF), /cannot exceed/);
  assert.throws(() => validatePayment({ ...base, ticketCharges: [{ ticketId: 'XX-1', amount: 500 }] }, REF), /TKT-101/);
  assert.throws(() => validatePayment({ ...base, ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }, { ticketId: 'TKT-101', amount: 100 }] }, REF), /twice/);
  assert.throws(() => validatePayment({ ...base, ticketCharges: [{ ticketId: 'TKT-101', amount: 0 }] }, REF), /greater than zero/);
  const plain = validatePayment(base, REF);
  assert.equal(plain.ticketCharges, undefined);
});

test('void (SISP-34): the payment is excluded everywhere and its ticket charges reopen', () => {
  const state = stateWithBill(3000);
  const tickets = billedTicket('cust-1', 500);
  const { nextState, nextTickets } = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3500, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  const payment = nextState.customers[0].bills.find((b) => b.month === MONTH).payments[0];

  const { state: voidedState, voidRecord } = voidPayment(nextState, 'cust-1', MONTH, payment.id, { voidReason: 'Wrong amount recorded' });
  assert.equal(voidRecord.amount, 3500);
  const voidedPayment = voidedState.customers[0].bills.find((b) => b.month === MONTH).payments[0];
  assert.equal(voidedPayment.voided, true);
  // The ledger rolls back exactly: the whole 3,000 bill is due again.
  const allocations = calculatePaymentAllocations(voidedState);
  assert.equal(allocations.forMonth('cust-1', MONTH).balanceDueCents, 300000);
  // And the ticket side reopens exactly the settled charge.
  const { tickets: reopenedTickets, reopened } = unsettleTicketChargesForPayment(nextTickets, voidedPayment);
  assert.deepEqual(reopened, ['TKT-101']);
  assert.equal(billedTicketChargesPending(reopenedTickets, 'cust-1'), 500);
});

test('delete/correct guards: a charge-settling payment cannot silently lose its stamp', () => {
  const state = stateWithBill(3000);
  const tickets = billedTicket('cust-1', 500);
  const { nextState, nextTickets } = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3500, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  const payment = nextState.customers[0].bills.find((b) => b.month === MONTH).payments[0];

  // Plain delete is refused (it would orphan the paid flag on the ticket).
  assert.throws(() => deletePayment(nextState, 'cust-1', MONTH, payment.id), /settled a ticket charge/);
  // The undo route — reopen first, then delete with the flag — succeeds.
  const { tickets: reverted } = unsettleTicketChargesForPayment(nextTickets, payment);
  assert.equal(billedTicketChargesPending(reverted, 'cust-1'), 500);
  const afterDelete = deletePayment(nextState, 'cust-1', MONTH, payment.id, REF, { ticketChargesReverted: true });
  assert.equal(afterDelete.customers[0].bills.find((b) => b.month === MONTH).payments.length, 0);

  // Correction keeps the stamp; an amount that no longer covers the
  // settled charges is refused outright.
  const corrected = correctPayment(nextState, 'cust-1', MONTH, payment.id, { date: '2026-10-14', amount: 3500, method: 'JazzCash' }, REF);
  const correctedPayment = corrected.customers[0].bills.find((b) => b.month === MONTH).payments[0];
  assert.equal(correctedPayment.method, 'JazzCash');
  assert.deepEqual(correctedPayment.ticketCharges, [{ ticketId: 'TKT-101', amount: 500 }]);
  assert.throws(() => correctPayment(nextState, 'cust-1', MONTH, payment.id, { date: '2026-10-14', amount: 500, method: 'Cash' }, REF), /settled ticket charges/);
});

test('receipt balance math counts only the bill portion of a stamped payment', () => {
  let state = stateWithBill(3000);
  state = addPayment(state, 'cust-1', MONTH, {
    date: '2026-10-15', amount: 2000, method: 'Cash',
    ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }]
  }, REF);
  const customer = state.customers[0];
  const bill = customer.bills.find((b) => b.month === MONTH);
  const built = buildPaymentReceipt(customer, bill, bill.payments[0]);
  // 2,000 cash = 1,500 to the bill + 500 to the ticket -> 1,500 still due.
  assert.equal(built.balanceDueCents, 150000);
  assert.equal(built.status, 'PARTIAL');
  assert.equal(built.paidAmount, 2000);
});

test('khata doctor stays in lockstep: no phantom credit and no false balance after a combined payment', () => {
  const state = stateWithBill(3000);
  const tickets = billedTicket('cust-1', 500);
  const full = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3500, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  const fullBalance = computeLedgerBalance(full.nextState.customers[0]);
  assert.equal(fullBalance.balanceCents, 0);
  assert.equal(fullBalance.creditCents, 0);
  assert.equal(fullBalance.paymentsCents, 350000);

  const partial = executeQuickCollection(state, {
    customerId: 'cust-1', month: MONTH, amount: 3200, date: '2026-10-15', method: 'Cash', tickets
  }, REF);
  const partialBalance = computeLedgerBalance(partial.nextState.customers[0]);
  assert.equal(partialBalance.balanceCents, 0);
  assert.equal(partialBalance.creditCents, 20000);
});

test('FIFO split (SISP-33) attributes only the bill portion of a stamped payment', () => {
  let state = {
    customers: [{
      id: 'cust-1', customerNumber: 101, name: 'Synthetic Subscriber',
      phone: '03001234567', area: 'Test Area', archived: false, bills: []
    }]
  };
  state = saveBillMonth(state, 'cust-1', { month: '2026-09', dueAmount: 1000, status: 'pending' }, REF);
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount: 3000, status: 'pending' }, REF);
  state = addPayment(state, 'cust-1', MONTH, {
    date: '2026-10-15', amount: 3500, method: 'Cash',
    ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }]
  }, REF);
  const customer = state.customers[0];
  const bill = customer.bills.find((b) => b.month === MONTH);
  const fifo = fifoAllocationForPayment(customer, bill, bill.payments[0].id);
  assert.ok(fifo);
  assert.equal(fifo.show, true);
  // Bill portion is 3,000: 1,000 arrears + 2,000 of the package.
  assert.equal(fifo.allocation.toArrears, 1000);
  assert.equal(fifo.allocation.toPackage, 2000);
  assert.equal(fifo.remaining.package, 1000);
});

test('ticket storage round-trip keeps the payment link; the manual toggle clears it', () => {
  const storage = memoryStorage();
  const tickets = billedTicket('cust-1', 500);
  const settled = settleTicketCharges(tickets, [{ ticketId: 'TKT-101', amount: 500 }], 'pay-xyz', REF);
  saveTickets(settled, storage);
  const loaded = loadTickets(storage);
  assert.equal(loaded[0].chargePaid, true);
  assert.equal(loaded[0].chargePaymentId, 'pay-xyz');
  const toggled = markTicketChargePaid(loaded, 'TKT-101', false);
  assert.equal(toggled[0].chargePaymentId, '');
  assert.equal(billedTicketChargesPending(toggled, 'cust-1'), 500);
});
