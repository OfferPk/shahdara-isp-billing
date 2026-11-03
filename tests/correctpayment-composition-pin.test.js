// M11: correctPayment Composition Golden Pin (TEST-ONLY).
// core.js `correctPayment` is the canonical payment-correction seam,
// composed of ordered blocks, each carrying one feature's stamp over the
// validatePayment rewrite verbatim:
//   SISP-43 ticket block (ticketCharges, amount must stay above the
//     settled ticket total)
//   -> SISP-146 recordedAt carry-over (a legacy unstamped payment stays
//     unstamped — no time is ever fabricated)
//   -> SISP-121 split stamps (splitGroupId / splitLeg)
//   -> SISP-106 boost carry-over (addonCharges, same amount floor)
//   -> OWNER-LOAN baqaya block (manualBaqayaSettlements, amount must
//     stay above ticket + baqaya + addon combined)
//   -> SISP-126 remainderWaada carry-over
//   -> SISP-156 method/shop blocks (shop settlement stamps verbatim,
//     settled receipts are channel-locked, receiptNumber identity,
//     methodCorrections audit appended on a channel change only)
//   -> assertDiscountWithinRemainingPayable (runs last)
// plus the mergedFields carry-overs that ride validatePayment itself:
// SISP-158 paidByContributor, SISP-63 sender pair, SISP-21
// walletVerified, the payment-proof screenshot, the discount pair and
// the paidBy fallback. Per-feature tests pin each block in isolation;
// NO single test drove ONE payment carrying ALL of these stamps through
// a correction. This file does: a synthetic mega-payment carrying every
// stamp is corrected on amount + method + date, and the corrected
// record is pinned field-for-field against a hand-written golden
// object, with the re-derived dues pinned to the cent against
// hand-computed figures. Pure-function tests on synthetic data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { correctPayment, calculatePaymentAllocations } from '../core.js';

const REF = new Date('2026-10-10T00:00:00Z');
const MONTH = '2026-10';
const CUSTOMER_ID = 'cust-mega';

// The mega-payment, in the canonical stored shapes every writer emits
// (sanitizers round to { id, amount } line pairs; sender digits are
// already last-4 per SISP-63; the contributor stamp is an exact
// { id, name } pair per SISP-158).
const MEGA_PAYMENT = {
  id: 'p-mega',
  date: '2026-10-06',
  amount: 2000,
  method: 'Easypaisa',
  paidBy: 'Test Payer',
  discount: 100,
  discountReason: 'Test discount',
  transactionId: 'TID-MEGA-001',
  reference: 'TID-MEGA-001',
  senderTitle: 'Test Sender',
  senderDigits: '3456',
  walletVerified: true,
  screenshot: 'data:image/png;base64,TESTPROOF',
  ticketCharges: [{ ticketId: 'TKT-101', amount: 250 }],
  addonCharges: [{ boostId: 'BST-101', amount: 150 }],
  manualBaqayaSettlements: [{ entryId: 'MBQ-101', amount: 400 }],
  recordedAt: '2026-10-06T05:30:00.000Z',
  splitGroupId: 'split-00000000-0000-4000-8000-000000000101',
  splitLeg: 1,
  remainderWaada: { promiseDate: '2026-10-20', promiseAmount: 500 },
  clearedWaada: { promiseDate: '2026-10-05', promiseAmount: 2000 },
  settlementIds: ['STL-101'],
  receiptNumber: 'RCP-TEST-900',
  permanentReceiptNumber: 'RCP-TEST-900',
  paidByContributor: { id: 'SC-1', name: 'Hamsaya Test' },
  methodCorrections: [
    { fromMethod: 'Cash', toMethod: 'Easypaisa', correctedAt: '2026-10-07T00:00:00.000Z' }
  ]
};

// Settled carve-outs on the mega-payment: 250 + 150 + 400 = Rs 800.
const CARVE_OUT_CENTS = 25000 + 15000 + 40000;

const megaState = () => ({
  customers: [{
    id: CUSTOMER_ID,
    customerNumber: 901,
    name: 'Test Mega Customer',
    bills: [{ month: MONTH, dueAmount: 3000, payments: [structuredClone(MEGA_PAYMENT)] }]
  }]
});

const getPayment = (state, cid, month, pid) =>
  state.customers.find((c) => c.id === cid).bills.find((b) => b.month === month).payments.find((p) => p.id === pid);

// What the profile correction form submits: a new date, a new amount, a
// new (digital) channel and the receipt's own TID re-typed by the form.
// paidBy, the discount pair and the sender pair are deliberately NOT
// submitted, so the mergedFields carry-over rules are what must save
// them.
const CORRECTION = { date: '2026-10-09', amount: 2600, method: 'JazzCash', transactionId: 'TID-MEGA-001' };

// The golden record: the corrected payment, written out in full. Only
// date / amount / method change; the methodCorrections history gains
// exactly one entry; every other key is the original stamp, once.
const GOLDEN_CORRECTED = {
  id: 'p-mega',
  date: '2026-10-09',
  amount: 2600,
  method: 'JazzCash',
  transactionId: 'TID-MEGA-001',
  reference: 'TID-MEGA-001',
  senderTitle: 'Test Sender',
  senderDigits: '3456',
  walletVerified: true,
  screenshot: 'data:image/png;base64,TESTPROOF',
  discount: 100,
  discountReason: 'Test discount',
  paidBy: 'Test Payer',
  paidByContributor: { id: 'SC-1', name: 'Hamsaya Test' },
  ticketCharges: [{ ticketId: 'TKT-101', amount: 250 }],
  recordedAt: '2026-10-06T05:30:00.000Z',
  splitGroupId: 'split-00000000-0000-4000-8000-000000000101',
  splitLeg: 1,
  addonCharges: [{ boostId: 'BST-101', amount: 150 }],
  manualBaqayaSettlements: [{ entryId: 'MBQ-101', amount: 400 }],
  remainderWaada: { promiseDate: '2026-10-20', promiseAmount: 500 },
  settlementIds: ['STL-101'],
  clearedWaada: { promiseDate: '2026-10-05', promiseAmount: 2000 },
  receiptNumber: 'RCP-TEST-900',
  permanentReceiptNumber: 'RCP-TEST-900',
  methodCorrections: [
    { fromMethod: 'Cash', toMethod: 'Easypaisa', correctedAt: '2026-10-07T00:00:00.000Z' },
    { fromMethod: 'Easypaisa', toMethod: 'JazzCash', correctedAt: '2026-10-10T00:00:00.000Z' }
  ],
  // Plan K: the amount+date correction also appends a correctionHistory
  // entry (previous values + correctedAt), carried like methodCorrections.
  correctionHistory: [
    { previousAmount: 2000, previousDate: '2026-10-06', newAmount: 2600, newDate: '2026-10-09', correctedAt: '2026-10-10T00:00:00.000Z' }
  ]
};

test('mega-payment: the full golden pin — every stamp survives an amount+method+date correction exactly once', () => {
  const state = megaState();
  const next = correctPayment(state, CUSTOMER_ID, MONTH, 'p-mega', CORRECTION, REF);
  const corrected = getPayment(next, CUSTOMER_ID, MONTH, 'p-mega');
  assert.deepEqual(corrected, GOLDEN_CORRECTED);
  // The input state is never mutated: the original record is untouched.
  assert.deepEqual(getPayment(state, CUSTOMER_ID, MONTH, 'p-mega'), MEGA_PAYMENT);
});

test('mega-payment: each composition block stamp, pinned individually', () => {
  const state = megaState();
  const original = getPayment(state, CUSTOMER_ID, MONTH, 'p-mega');
  const corrected = getPayment(correctPayment(state, CUSTOMER_ID, MONTH, 'p-mega', CORRECTION, REF), CUSTOMER_ID, MONTH, 'p-mega');

  // SISP-43 ticket block: lines carried verbatim, exactly once.
  assert.deepEqual(corrected.ticketCharges, [{ ticketId: 'TKT-101', amount: 250 }]);
  assert.equal(corrected.ticketCharges.length, 1);
  // SISP-146: the original entry moment survives verbatim — the
  // correction restates the receipt, not when it was first logged.
  assert.equal(corrected.recordedAt, '2026-10-06T05:30:00.000Z');
  // SISP-121: the split link is never unlinked by correcting one leg.
  assert.equal(corrected.splitGroupId, 'split-00000000-0000-4000-8000-000000000101');
  assert.equal(corrected.splitLeg, 1);
  // SISP-106 boost carry-over.
  assert.deepEqual(corrected.addonCharges, [{ boostId: 'BST-101', amount: 150 }]);
  assert.equal(corrected.addonCharges.length, 1);
  // OWNER-LOAN baqaya block.
  assert.deepEqual(corrected.manualBaqayaSettlements, [{ entryId: 'MBQ-101', amount: 400 }]);
  assert.equal(corrected.manualBaqayaSettlements.length, 1);
  // SISP-126: the remainder waada rides verbatim — the same object,
  // not a re-derived copy.
  assert.deepEqual(corrected.remainderWaada, { promiseDate: '2026-10-20', promiseAmount: 500 });
  assert.equal(corrected.remainderWaada, original.remainderWaada);
  // SISP-34: the cleared-waada stamp a later void restores from.
  assert.deepEqual(corrected.clearedWaada, { promiseDate: '2026-10-05', promiseAmount: 2000 });
  // SISP-156: shop settlement link + permanent receipt identity.
  assert.deepEqual(corrected.settlementIds, ['STL-101']);
  assert.notEqual(corrected.settlementIds, original.settlementIds, 'settlement ids are carried as a copy, never aliased');
  assert.equal(corrected.receiptNumber, 'RCP-TEST-900');
  assert.equal(corrected.permanentReceiptNumber, 'RCP-TEST-900');
  // SISP-158: the contributor stamp inside mergedFields.
  assert.deepEqual(corrected.paidByContributor, { id: 'SC-1', name: 'Hamsaya Test' });
  // SISP-63: the sender pair, carried because the form never sent it
  // and the new channel is still digital.
  assert.equal(corrected.senderTitle, 'Test Sender');
  assert.equal(corrected.senderDigits, '3456');
  // SISP-21 + owner proof: verification and screenshot survive.
  assert.equal(corrected.walletVerified, true);
  assert.equal(corrected.screenshot, 'data:image/png;base64,TESTPROOF');
  // The discount pair and paidBy fallbacks in mergedFields.
  assert.equal(corrected.discount, 100);
  assert.equal(corrected.discountReason, 'Test discount');
  assert.equal(corrected.paidBy, 'Test Payer');
  // The three fields the correction actually changed.
  assert.equal(corrected.date, '2026-10-09');
  assert.equal(corrected.amount, 2600);
  assert.equal(corrected.method, 'JazzCash');
  assert.equal(corrected.transactionId, 'TID-MEGA-001');
  assert.equal(corrected.reference, 'TID-MEGA-001');
});

test('mega-payment: methodCorrections keeps prior history and appends exactly one entry for the channel change', () => {
  const corrected = getPayment(
    correctPayment(megaState(), CUSTOMER_ID, MONTH, 'p-mega', CORRECTION, REF),
    CUSTOMER_ID, MONTH, 'p-mega');
  assert.equal(corrected.methodCorrections.length, 2);
  assert.deepEqual(corrected.methodCorrections[0],
    { fromMethod: 'Cash', toMethod: 'Easypaisa', correctedAt: '2026-10-07T00:00:00.000Z' },
    'the prior correction entry is carried across, never reset');
  assert.deepEqual(corrected.methodCorrections[1],
    { fromMethod: 'Easypaisa', toMethod: 'JazzCash', correctedAt: '2026-10-10T00:00:00.000Z' },
    'exactly one new entry, stamped from the correction reference date');
});

test('mega-payment: a second, date-only correction adds no channel audit entry, but appends its own correctionHistory entry', () => {
  const once = correctPayment(megaState(), CUSTOMER_ID, MONTH, 'p-mega', CORRECTION, REF);
  const twice = correctPayment(once, CUSTOMER_ID, MONTH, 'p-mega',
    { date: '2026-10-10', amount: 2600, method: 'JazzCash', transactionId: 'TID-MEGA-001' }, REF);
  const corrected = getPayment(twice, CUSTOMER_ID, MONTH, 'p-mega');
  // Plan K: the date change is itself audited — the first entry is
  // carried and a second, chained entry is appended.
  assert.deepEqual(corrected, {
    ...GOLDEN_CORRECTED,
    date: '2026-10-10',
    correctionHistory: [
      { previousAmount: 2000, previousDate: '2026-10-06', newAmount: 2600, newDate: '2026-10-09', correctedAt: '2026-10-10T00:00:00.000Z' },
      { previousAmount: 2600, previousDate: '2026-10-09', newAmount: 2600, newDate: '2026-10-10', correctedAt: '2026-10-10T00:00:00.000Z' }
    ]
  });
  assert.equal(corrected.methodCorrections.length, 2, 'no channel change, no new channel entry — history is carried, not reset');
});

test('dues: the engine balance equals the hand-computed dues before and after the correction, to the cent', () => {
  // Bill Rs 3,000. Carve-outs (ticket 250 + boost 150 + baqaya 400 =
  // Rs 800) are never bill money; the Rs 100 discount applies first.
  // Before: bill portion 2000 - 800 = 1200 -> due 3000 - 100 - 1200 = 1700.
  // After:  bill portion 2600 - 800 = 1800 -> due 3000 - 100 - 1800 = 1100.
  const before = calculatePaymentAllocations(megaState());
  const beforeSummary = before.forMonth(CUSTOMER_ID, MONTH);
  assert.equal(beforeSummary.billAmountCents, 300000);
  assert.equal(beforeSummary.discountAppliedCents, 10000);
  assert.equal(beforeSummary.sameMonthAppliedCents, 120000);
  assert.equal(beforeSummary.balanceDueCents, 170000);
  const beforeLedger = before.byPaymentId.get('p-mega');
  assert.equal(beforeLedger.ticketChargeCents, 25000);
  assert.equal(beforeLedger.addonChargeCents, 15000);
  assert.equal(beforeLedger.manualBaqayaCents, 40000);
  assert.equal(beforeLedger.ticketChargeCents + beforeLedger.addonChargeCents + beforeLedger.manualBaqayaCents, CARVE_OUT_CENTS);

  const after = calculatePaymentAllocations(
    correctPayment(megaState(), CUSTOMER_ID, MONTH, 'p-mega', CORRECTION, REF));
  const afterSummary = after.forMonth(CUSTOMER_ID, MONTH);
  assert.equal(afterSummary.billAmountCents, 300000);
  assert.equal(afterSummary.actualReceiptsCents, 260000);
  assert.equal(afterSummary.discountAppliedCents, 10000, 'the carried discount still applies exactly once');
  assert.equal(afterSummary.sameMonthAppliedCents, 180000);
  assert.equal(afterSummary.balanceDueCents, 110000);
  const afterLedger = after.byPaymentId.get('p-mega');
  assert.equal(afterLedger.ticketChargeCents, 25000, 'carve-outs are re-derived from the carried stamps, unchanged');
  assert.equal(afterLedger.addonChargeCents, 15000);
  assert.equal(afterLedger.manualBaqayaCents, 40000);
});

test('composition order: the settled-amount floors fire block by block (ticket first, baqaya last)', () => {
  // At exactly the ticket total the SISP-43 block refuses first.
  assert.throws(
    () => correctPayment(megaState(), CUSTOMER_ID, MONTH, 'p-mega', { ...CORRECTION, amount: 250 }, REF),
    /settled ticket charges/);
  // Above ticket + boost but at the combined non-bill total, the
  // OWNER-LOAN block (which runs after SISP-106) is the one that refuses.
  assert.throws(
    () => correctPayment(megaState(), CUSTOMER_ID, MONTH, 'p-mega', { ...CORRECTION, amount: 800 }, REF),
    /settled manual baqaya/);
  // One rupee above the combined floor the whole composition passes.
  const ok = correctPayment(megaState(), CUSTOMER_ID, MONTH, 'p-mega', { ...CORRECTION, amount: 801 }, REF);
  assert.equal(getPayment(ok, CUSTOMER_ID, MONTH, 'p-mega').amount, 801);
});

test('assertDiscount runs last: a discount above the remaining payable is refused after every block passed', () => {
  // With the corrected payment excluded, the month's remaining payable
  // is the full Rs 3,000 bill — Rs 3,001 of discount can never fit.
  assert.throws(
    () => correctPayment(megaState(), CUSTOMER_ID, MONTH, 'p-mega', { ...CORRECTION, discount: 3001 }, REF),
    /Discount cannot exceed remaining payable/);
});

test('settled receipt (SISP-156): the channel is locked, and a non-channel correction carries the settlement stamps verbatim', () => {
  const settledPayment = {
    id: 'p-settled',
    date: '2026-10-06',
    amount: 1500,
    method: 'Cash at Hassan Balla shop',
    shopSettled: true,
    shopSettledAmount: 1500,
    settlementIds: ['STL-202'],
    receiptNumber: 'RCP-TEST-901'
  };
  const state = {
    customers: [{
      id: 'cust-settled',
      customerNumber: 902,
      name: 'Test Settled Customer',
      bills: [{ month: MONTH, dueAmount: 3000, payments: [structuredClone(settledPayment)] }]
    }]
  };
  // Any settled amount, even on a receipt with no other stamps, locks
  // the channel until the handover is reversed.
  assert.throws(
    () => correctPayment(state, 'cust-settled', MONTH, 'p-settled', { method: 'Cash' }, REF),
    /already handed over from the shop/);
  // Amount + date stay editable (the correction form always submits
  // the full record, channel included and unchanged); the settlement
  // stamps ride verbatim — shopSettledAmount is NOT rescaled to the
  // corrected amount.
  const next = correctPayment(state, 'cust-settled', MONTH, 'p-settled',
    { date: '2026-10-08', amount: 1600, method: 'Cash at Hassan Balla shop' }, REF);
  const corrected = getPayment(next, 'cust-settled', MONTH, 'p-settled');
  // Plan K: the amount+date change mints a correctionHistory entry even
  // though the channel never moved (so no methodCorrections field).
  assert.deepEqual(corrected, {
    ...settledPayment,
    amount: 1600,
    date: '2026-10-08',
    correctionHistory: [
      { previousAmount: 1500, previousDate: '2026-10-06', newAmount: 1600, newDate: '2026-10-08', correctedAt: '2026-10-10T00:00:00.000Z' }
    ]
  });
  assert.equal(corrected.methodCorrections, undefined, 'no channel change and no prior history: no channel audit field is minted');
});
