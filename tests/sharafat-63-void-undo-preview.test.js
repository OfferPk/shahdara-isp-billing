// Sharafat 63 — Void confirmation names the amount but not what voiding
// will undo. Tests for describeVoidUndo (payment-void-audit.js): the
// pure "what would this void undo" helper behind the void dialog.
//
// Pinned rule (R3): every predicate here is checked against the REAL
// voidPayment voidRecord / the REAL unsettle helpers on the SAME
// fixtures, so a one-clause drift between the preview and the void
// fails loudly here instead of lying to the operator in the dialog.
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';

import { voidPayment, describeVoidUndo } from '../payment-void-audit.js';
import {
  createTicket,
  resolveTicket,
  settleTicketCharges,
  unsettleTicketChargesForPayment
} from '../complaint-tickets.js';
import {
  settleAddonCharges,
  unsettleAddonChargesForPayment
} from '../speed-addon.js';

const MONTH = '2026-10';
const REF = new Date('2026-10-15T10:00:00Z');
const REMAINDER_NOTE = 'Remainder waada — partial payment';

function basePayment(overrides = {}) {
  return {
    id: 'pay-1',
    date: '2026-10-02',
    amount: 3000,
    method: 'Cash',
    ...overrides
  };
}

function stateWith(customerOverrides = {}, paymentOverrides = {}) {
  const customer = {
    id: 'cust-1',
    customerNumber: 1,
    name: 'Test Customer',
    bills: [{
      id: 'b1',
      month: MONTH,
      status: 'received',
      dueAmount: 3000,
      payments: [basePayment(paymentOverrides)]
    }],
    ...customerOverrides
  };
  return { customers: [customer] };
}

function customerBillPayment(state) {
  const customer = state.customers[0];
  const bill = customer.bills.find((b) => b.month === MONTH);
  return { customer, bill, payment: bill.payments[0] };
}

// One billed ticket (sisp43 pattern), settled by the given payment.
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

function settledTickets(paymentId = 'pay-1') {
  const tickets = billedTicket('cust-1', 500);
  return settleTicketCharges(tickets, [{ ticketId: 'TKT-101', amount: 500 }], paymentId, REF);
}

// One boost (all sanitizer fields present), settled by the given payment.
function settledBoostCustomer(paymentId = 'pay-1') {
  const customer = {
    id: 'cust-1',
    customerNumber: 1,
    name: 'Test Customer',
    speedBoosts: [{
      boostId: 'BST-101',
      boostMbps: 15,
      durationDays: 10,
      addonFeePKR: 500,
      startDate: '2026-10-05',
      expiryDate: '2026-10-15'
    }]
  };
  return settleAddonCharges(customer, [{ boostId: 'BST-101', amount: 500 }], paymentId, '2026-10-15');
}

// A payment loaded with every side effect the void can undo.
function loadedPayment(overrides = {}) {
  return basePayment({
    clearedWaada: { promiseDate: '2026-11-13', promiseAmount: 3000, promiseNote: 'Pay on Friday' },
    lateFeeWaived: true,
    waivedLateFee: {
      month: MONTH, lateFee: 150, lateFeeAppliedAt: '2026-10-01T09:00', lateFeeReason: 'Goodwill'
    },
    ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }],
    addonCharges: [{ boostId: 'BST-101', amount: 500 }],
    ...overrides
  });
}

function kinds(effects) {
  return effects.map((e) => e.kind);
}

test('loaded payment lists every undo in void order, matching the real void record + unsettle counts', () => {
  const state = stateWith({}, loadedPayment());
  const { customer, bill, payment } = customerBillPayment(state);
  const tickets = settledTickets('pay-1');
  const boosted = settledBoostCustomer('pay-1');
  const withBoost = { ...customer, speedBoosts: boosted.speedBoosts };

  const effects = describeVoidUndo(withBoost, bill, payment, { tickets });
  assert.deepEqual(kinds(effects), [
    'waada-restore', 'late-fee-restore', 'ticket-reopen', 'addon-reopen'
  ]);
  assert.equal(effects[0].text, 'Will restore the waada of 2026-11-13 (PKR 3000)');
  assert.equal(effects[0].promiseDate, '2026-11-13');
  assert.equal(effects[0].promiseAmount, 3000);
  assert.equal(effects[1].text, 'Will restore the waived late fee of PKR 150');
  assert.equal(effects[1].amount, 150);
  assert.equal(effects[2].text, 'Will reopen 1 ticket charge');
  assert.equal(effects[2].count, 1);
  assert.equal(effects[3].text, 'Will reopen 1 speed boost charge');
  assert.equal(effects[3].count, 1);

  // Same fixture, real void: the record says the same things.
  const { voidRecord } = voidPayment(state, 'cust-1', MONTH, 'pay-1', {
    voidReason: 'Entered twice', voidedAt: '2026-10-16T09:00:00.000Z'
  });
  assert.equal(voidRecord.promiseRestored, true);
  assert.equal(voidRecord.restoredPromiseDate, '2026-11-13');
  assert.equal(voidRecord.lateFeeRestored, true);
  assert.equal(voidRecord.restoredLateFeeAmount, 150);
  // Same fixture, real unsettle helpers: the same counts.
  assert.deepEqual(unsettleTicketChargesForPayment(tickets, payment).reopened, ['TKT-101']);
  assert.deepEqual(unsettleAddonChargesForPayment(boosted, payment).reopened, ['BST-101']);
});

test('plain payment lists nothing', () => {
  const state = stateWith();
  const { customer, bill, payment } = customerBillPayment(state);
  assert.deepEqual(describeVoidUndo(customer, bill, payment, { tickets: [] }), []);
  const { voidRecord } = voidPayment(state, 'cust-1', MONTH, 'pay-1', {
    voidReason: 'Entered twice', voidedAt: '2026-10-16T09:00:00.000Z'
  });
  assert.equal(voidRecord.promiseRestored, false);
  assert.equal(voidRecord.lateFeeRestored, undefined);
});

test('remainder waada with a previous waada lists the restore of the previous waada', () => {
  const state = stateWith({
    promiseDate: '2026-11-05',
    promiseAmount: 2000,
    promiseNote: REMAINDER_NOTE
  }, {
    remainderWaada: {
      promiseDate: '2026-11-05',
      promiseAmount: 2000,
      previousWaada: { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: 'Original promise' }
    }
  });
  const { customer, bill, payment } = customerBillPayment(state);
  const effects = describeVoidUndo(customer, bill, payment, { tickets: [] });
  assert.deepEqual(kinds(effects), ['remainder-waada-revert']);
  assert.equal(effects[0].text, 'Will restore the previous waada of 2026-10-20');
  assert.equal(effects[0].previousPromiseDate, '2026-10-20');

  const { voidRecord, state: next } = voidPayment(state, 'cust-1', MONTH, 'pay-1', {
    voidReason: 'Wrong remainder', voidedAt: '2026-10-16T09:00:00.000Z'
  });
  assert.equal(voidRecord.remainderWaadaReverted, true);
  assert.equal(next.customers[0].promiseDate, '2026-10-20');
});

test('remainder waada with no previous waada lists the clear', () => {
  const state = stateWith({
    promiseDate: '2026-11-05',
    promiseAmount: 2000,
    promiseNote: REMAINDER_NOTE
  }, {
    remainderWaada: { promiseDate: '2026-11-05', promiseAmount: 2000 }
  });
  const { customer, bill, payment } = customerBillPayment(state);
  const effects = describeVoidUndo(customer, bill, payment, { tickets: [] });
  assert.deepEqual(kinds(effects), ['remainder-waada-revert']);
  assert.equal(effects[0].text, 'Will clear the remainder waada of 2026-11-05');

  const { voidRecord, state: next } = voidPayment(state, 'cust-1', MONTH, 'pay-1', {
    voidReason: 'Wrong remainder', voidedAt: '2026-10-16T09:00:00.000Z'
  });
  assert.equal(voidRecord.remainderWaadaReverted, true);
  assert.equal(next.customers[0].promiseDate, undefined);
});

test('waada is NOT listed when a newer promise exists — and the real void agrees', () => {
  const state = stateWith({ promiseDate: '2026-11-20', promiseAmount: 3000 }, loadedPayment());
  const { customer, bill, payment } = customerBillPayment(state);
  const tickets = settledTickets('pay-1');
  const boosted = settledBoostCustomer('pay-1');
  const withBoost = { ...customer, speedBoosts: boosted.speedBoosts };
  const effects = describeVoidUndo(withBoost, bill, payment, { tickets });
  assert.ok(!kinds(effects).includes('waada-restore'));
  // The fee + charges are still listed: only the waada leg is blocked.
  assert.deepEqual(kinds(effects), ['late-fee-restore', 'ticket-reopen', 'addon-reopen']);

  const { voidRecord } = voidPayment(state, 'cust-1', MONTH, 'pay-1', {
    voidReason: 'Entered twice', voidedAt: '2026-10-16T09:00:00.000Z'
  });
  assert.equal(voidRecord.promiseRestored, false);
});

test('late fee is NOT listed when a fee was applied after the waiver — and the real void agrees', () => {
  const state = stateWith();
  state.customers[0].bills[0].lateFee = 150;
  state.customers[0].bills[0].payments[0] = loadedPayment();
  const { customer, bill, payment } = customerBillPayment(state);
  const effects = describeVoidUndo(customer, bill, payment, { tickets: [] });
  assert.ok(!kinds(effects).includes('late-fee-restore'));

  const { voidRecord } = voidPayment(state, 'cust-1', MONTH, 'pay-1', {
    voidReason: 'Entered twice', voidedAt: '2026-10-16T09:00:00.000Z'
  });
  assert.equal(voidRecord.lateFeeRestored, undefined);
});

test('remainder waada is NOT listed when the live promise has moved on — and the real void agrees', () => {
  const state = stateWith({
    promiseDate: '2026-11-20',
    promiseAmount: 3000,
    promiseNote: 'A newer promise'
  }, {
    remainderWaada: {
      promiseDate: '2026-11-05',
      promiseAmount: 2000,
      previousWaada: { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: 'Original promise' }
    }
  });
  const { customer, bill, payment } = customerBillPayment(state);
  assert.deepEqual(describeVoidUndo(customer, bill, payment, { tickets: [] }), []);

  const { voidRecord } = voidPayment(state, 'cust-1', MONTH, 'pay-1', {
    voidReason: 'Wrong remainder', voidedAt: '2026-10-16T09:00:00.000Z'
  });
  assert.equal(voidRecord.remainderWaadaReverted, undefined);
});

test('ticket count excludes an already-reopened charge and a charge settled by another payment', () => {
  const settled = settledTickets('pay-1');
  const unpaid = billedTicket('cust-1', 300, settled);
  const payment = basePayment({
    ticketCharges: [
      { ticketId: 'TKT-101', amount: 500 },
      { ticketId: 'TKT-102', amount: 300 }
    ]
  });
  const state = stateWith({}, payment);
  const { customer, bill } = customerBillPayment(state);
  // TKT-102 was never settled (chargePaid false) — reopens nothing.
  const effects = describeVoidUndo(customer, bill, payment, { tickets: unpaid });
  assert.deepEqual(effects.filter((e) => e.kind === 'ticket-reopen'), [
    { kind: 'ticket-reopen', count: 1, text: 'Will reopen 1 ticket charge' }
  ]);
  assert.deepEqual(unsettleTicketChargesForPayment(unpaid, payment).reopened, ['TKT-101']);

  // The same charge settled by a different payment reopens nothing.
  const foreign = describeVoidUndo(customer, bill, { ...payment, id: 'pay-9' }, { tickets: settled });
  assert.deepEqual(foreign.filter((e) => e.kind === 'ticket-reopen'), []);
  assert.deepEqual(
    unsettleTicketChargesForPayment(settled, { ...payment, id: 'pay-9' }).reopened, []
  );
});

test('ticket count ignores a malformed ticket id the real sanitizer drops', () => {
  const malformed = [{
    id: 'BAD', customerId: 'cust-1', chargePaid: true, chargePaymentId: 'pay-1'
  }];
  const payment = basePayment({ ticketCharges: [{ ticketId: 'BAD', amount: 100 }] });
  const state = stateWith({}, payment);
  const { customer, bill } = customerBillPayment(state);
  assert.deepEqual(describeVoidUndo(customer, bill, payment, { tickets: malformed }), []);
  assert.deepEqual(unsettleTicketChargesForPayment(malformed, payment).reopened, []);
});

test('addon count excludes an already-reopened boost and a boost settled by another payment', () => {
  const settled = settledBoostCustomer('pay-1');
  const payment = basePayment({ addonCharges: [{ boostId: 'BST-101', amount: 500 }] });
  const state = stateWith({}, payment);
  const { customer, bill } = customerBillPayment(state);

  // Settled by this payment: counts, and the real unsettle agrees.
  assert.deepEqual(
    describeVoidUndo(settled, bill, payment, { tickets: [] })
      .filter((e) => e.kind === 'addon-reopen'),
    [{ kind: 'addon-reopen', count: 1, text: 'Will reopen 1 speed boost charge' }]
  );
  assert.deepEqual(unsettleAddonChargesForPayment(settled, payment).reopened, ['BST-101']);

  // Already reopened (chargePaid false): counts nothing.
  const reopened = unsettleAddonChargesForPayment(settled, payment).customer;
  assert.deepEqual(
    describeVoidUndo(reopened, bill, payment, { tickets: [] })
      .filter((e) => e.kind === 'addon-reopen'),
    []
  );

  // Settled by a different payment: counts nothing.
  assert.deepEqual(
    describeVoidUndo(settled, bill, { ...payment, id: 'pay-9' }, { tickets: [] })
      .filter((e) => e.kind === 'addon-reopen'),
    []
  );
  assert.deepEqual(
    unsettleAddonChargesForPayment(settled, { ...payment, id: 'pay-9' }).reopened, []
  );
});

test('addon count ignores a boost that fails sanitization (missing fee fields)', () => {
  // No addonFeePKR / dates: the real sanitizer drops it, so the void
  // could never reopen it — and neither may the preview count it.
  const customer = {
    id: 'cust-1',
    customerNumber: 1,
    name: 'Test Customer',
    speedBoosts: [{ boostId: 'BST-101', chargePaid: true, chargePaymentId: 'pay-1' }]
  };
  const payment = basePayment({ addonCharges: [{ boostId: 'BST-101', amount: 500 }] });
  const state = stateWith({}, payment);
  const { bill } = customerBillPayment(state);
  assert.deepEqual(
    describeVoidUndo(customer, bill, payment, { tickets: [] })
      .filter((e) => e.kind === 'addon-reopen'),
    []
  );
  assert.deepEqual(unsettleAddonChargesForPayment(customer, payment).reopened, []);
});

test('helper never throws: shop-settled payment still predicts, voided payment lists nothing', () => {
  const state = stateWith({}, loadedPayment({ shopSettledAmount: 3000 }));
  const { customer, bill, payment } = customerBillPayment(state);
  // voidPayment refuses this payment outright…
  assert.throws(
    () => voidPayment(state, 'cust-1', MONTH, 'pay-1', {
      voidReason: 'Entered twice', voidedAt: '2026-10-16T09:00:00.000Z'
    }),
    /handed over from the shop/
  );
  // …but the preview still lists what a void WOULD undo, without throwing.
  const effects = describeVoidUndo(customer, bill, payment, { tickets: [] });
  assert.ok(kinds(effects).includes('waada-restore'));

  // A voided payment lists nothing and never throws.
  const voided = basePayment({ voided: true, clearedWaada: { promiseDate: '2026-11-13', promiseAmount: 3000 } });
  assert.deepEqual(describeVoidUndo(customer, bill, voided, { tickets: [] }), []);
});

test('helper never throws on malformed input', () => {
  assert.deepEqual(describeVoidUndo(null, null, null), []);
  assert.deepEqual(describeVoidUndo(undefined, undefined, undefined), []);
  assert.deepEqual(describeVoidUndo(null, null, basePayment(), { tickets: 'not-a-list' }), []);
  assert.deepEqual(describeVoidUndo(null, null, {}, { tickets: [] }), []);
  const state = stateWith();
  const { customer, bill, payment } = customerBillPayment(state);
  assert.deepEqual(describeVoidUndo(customer, null, payment, { tickets: [] }), []);
  assert.deepEqual(describeVoidUndo(customer, bill, payment, {}), []);
});

test('waada without an amount still lists the restore, without the PKR figure', () => {
  const payment = basePayment({
    clearedWaada: { promiseDate: '2026-11-13', promiseNote: 'Pay on Friday' }
  });
  const state = stateWith({}, payment);
  const { customer, bill } = customerBillPayment(state);
  const effects = describeVoidUndo(customer, bill, payment, { tickets: [] });
  assert.deepEqual(kinds(effects), ['waada-restore']);
  assert.equal(effects[0].text, 'Will restore the waada of 2026-11-13');
  assert.equal(effects[0].promiseAmount, null);
});

test('two ticket charges reopen together and the plural reads right', () => {
  let tickets = billedTicket('cust-1', 500);
  tickets = billedTicket('cust-1', 300, tickets);
  const settled = settleTicketCharges(tickets, [
    { ticketId: 'TKT-101', amount: 500 },
    { ticketId: 'TKT-102', amount: 300 }
  ], 'pay-1', REF);
  const payment = basePayment({
    ticketCharges: [
      { ticketId: 'TKT-101', amount: 500 },
      { ticketId: 'TKT-102', amount: 300 }
    ]
  });
  const state = stateWith({}, payment);
  const { customer, bill } = customerBillPayment(state);
  const effects = describeVoidUndo(customer, bill, payment, { tickets: settled });
  assert.deepEqual(effects.filter((e) => e.kind === 'ticket-reopen'), [
    { kind: 'ticket-reopen', count: 2, text: 'Will reopen 2 ticket charges' }
  ]);
  assert.deepEqual(unsettleTicketChargesForPayment(settled, payment).reopened, ['TKT-101', 'TKT-102']);
});
