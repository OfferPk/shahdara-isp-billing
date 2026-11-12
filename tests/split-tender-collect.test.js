// SISP-121: Split-Tender Cash + Digital Wallet Checkout.
// Pure-function tests on synthetic data only. Pins the spec criterion:
// recording Rs 2,000 Cash + Rs 1,000 Easypaisa on a Rs 3,000 bill clears
// the bill in full, adds Rs 2,000 to Cash Roznamcha, adds Rs 1,000 to the
// Easypaisa Wallet Ledger, and prints one combined receipt — verified
// through the REAL quick-collection recorder, the REAL allocation
// engine, the REAL roznamcha/wallet derivations and the REAL Khata
// Doctor. Also pins: the two-leg model (two ordinary payments linked by
// splitGroupId/splitLeg stamps), all-or-nothing atomicity, per-leg void
// (SISP-34), waada composition (SISP-3/34), backup + readState +
// correctPayment stamp survival, and the i18n/wiring audit.
// FU-SISP121-SENDER pins (bottom): each DIGITAL leg also carries the
// SISP-63 sender proof metadata (senderTitle + senderDigits, name +
// last-4 only) under the exact single-payment contract, so wallet
// statement matching works on split legs unchanged; cash legs store
// no sender fields; the combined receipt model is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  saveBillMonth, calculatePaymentAllocations, derivedBillStatus,
  createInitialState, createJsonBackup, previewJsonBackupMerge,
  readState, correctPayment, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, applyLateFeeToBill,
  addManualBaqayaEntry
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import {
  executeSplitTenderCollection, validateSplitTender, splitTenderOf,
  splitPaymentsOf, buildSplitTenderReceipt, formatSplitTenderWhatsAppText,
  generateSplitTenderReceiptHtml, renderSplitReceiptCardHtml, splitBadgeMarkup
} from '../split-tender-collect.js';
// Sharafat 1: the readers for the fields a split used to drop — the
// same defensive readers the combined receipt and the Transactions
// rows already use, so the tests assert what the ledger actually
// recorded, never the form's intent.
import { lateFeeWaiverOf } from '../late-fee-waiver.js';
import { overpaymentChoiceOf } from '../overpayment-choice.js';
import { excessCashNoteOf } from '../excess-cash-note.js';
import { remainderWaadaOf, REMAINDER_WAADA_NOTE } from '../waada-queue.js';
import { collectDirectCashPayments } from '../roznamcha.js';
import { buildWalletReconciliation } from '../wallet-reconciliation.js';
import { collectShopPayments } from '../shop-settlement.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { voidPayment } from '../payment-void-audit.js';
import { TRANSLATIONS } from '../nav-language.js';
// Sharafat 2: the charge fixtures — the same shapes the settlement
// cascade pins use (tests/qc-settlement-cascade-pin.test.js): a
// resolved+billed ticket via the real ticket writers, a boost via
// the real boost writer, a baqaya entry via the real core writer.
import { createTicket, resolveTicket, billedTicketChargesPending } from '../complaint-tickets.js';
import { addSpeedBoost } from '../speed-addon.js';

const NOW = new Date('2026-10-29T12:00:00+05:00');
const MONTH = '2026-10';
const DATE = '2026-10-29';

const customer = (id, n, extra = {}) => ({
  id, customerNumber: n, name: `Customer ${n}`, phone: `0300000000${n}`,
  area: 'Shahdara', archived: false, bills: [], ...extra
});

function fixture({ due = 3000, extra = {} } = {}) {
  let s = { version: 1, nextCustomerNumber: 2, customers: [customer('a', 1, extra)] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: due, status: 'pending' }, NOW);
  return s;
}

const SPEC_SPEC = {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 2000, method: 'Cash' },
    { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
};
const run = (state, spec = SPEC_SPEC) => executeSplitTenderCollection(state, spec, { execute: executeQuickCollection, referenceDate: NOW });
const billOf = (state) => state.customers[0].bills.find(b => b.month === MONTH);
const totalDueCents = (state) => {
  const allocations = calculatePaymentAllocations(state);
  let total = 0;
  for (const bill of state.customers[0].bills) {
    const s = allocations.forMonth('a', bill.month);
    if (s?.balanceDueCents > 0) total += s.balanceDueCents;
  }
  return total;
};

test('SPEC PIN: Rs 2,000 Cash + Rs 1,000 Easypaisa on a Rs 3,000 bill clears it, routes each leg to its own ledger, one combined receipt', () => {
  const { nextState, receipts, splitGroupId, combinedReceipt } = run(fixture());
  const bill = billOf(nextState);

  // Bill cleared in full through the real engine.
  assert.equal(calculatePaymentAllocations(nextState).forMonth('a', MONTH).balanceDueCents, 0);
  assert.equal(derivedBillStatus(nextState.customers[0], bill), 'paid');

  // Exactly two ordinary payment records, linked by the split stamps.
  assert.equal(bill.payments.length, 2);
  const [p1, p2] = bill.payments;
  assert.equal(p1.amount, 2000);
  assert.equal(p1.method, 'Cash');
  assert.equal(p2.amount, 1000);
  assert.equal(p2.method, 'Easypaisa');
  assert.equal(p2.transactionId, 'EP99887766');
  assert.deepEqual(splitTenderOf(p1), { groupId: splitGroupId, leg: 1 });
  assert.deepEqual(splitTenderOf(p2), { groupId: splitGroupId, leg: 2 });
  assert.equal(splitPaymentsOf(nextState, 'a', splitGroupId).length, 2);
  assert.equal(receipts.length, 2);

  // Cash leg lands in the Roznamcha drawer derivation, and ONLY there.
  const cash = collectDirectCashPayments(nextState, DATE);
  assert.equal(cash.reduce((sum, row) => sum + row.amount, 0), 2000);
  // Digital leg lands in the Easypaisa wallet ledger with its TID.
  const wallet = buildWalletReconciliation(nextState.customers, MONTH);
  assert.equal(wallet.byWallet['Easypaisa'].amount, 1000);
  assert.equal(wallet.byWallet['Easypaisa'].count, 1);
  assert.equal(wallet.payments[0].transactionId, 'EP99887766');
  assert.equal(wallet.cash.amount, 2000);

  // ONE combined receipt: both legs, their REAL (distinct) receipt
  // numbers, the tendered total, PAID.
  assert.equal(combinedReceipt.legs.length, 2);
  assert.equal(combinedReceipt.totalReceived, 3000);
  assert.equal(combinedReceipt.totalReceivedCents, 300000);
  assert.equal(combinedReceipt.status, 'PAID');
  assert.equal(combinedReceipt.balanceDueCents, 0);
  assert.ok(combinedReceipt.legs[0].receiptNumber);
  assert.ok(combinedReceipt.legs[1].receiptNumber);
  assert.notEqual(combinedReceipt.legs[0].receiptNumber, combinedReceipt.legs[1].receiptNumber);

  // Khata Doctor still agrees with the engine afterwards.
  assert.equal(computeLedgerBalance(nextState.customers[0]).balanceCents, totalDueCents(nextState));
});

test('the input state is never mutated by a split recording', () => {
  const s0 = fixture();
  const snapshot = JSON.stringify(s0);
  run(s0);
  assert.equal(JSON.stringify(s0), snapshot);
});

test('an ordinary single Quick Collect payment carries NO split stamp (legacy behaviour unchanged)', () => {
  const { nextState } = executeQuickCollection(fixture(), {
    customerId: 'a', month: MONTH, amount: 3000, date: DATE, method: 'Cash'
  }, NOW);
  const [payment] = billOf(nextState).payments;
  assert.equal(splitTenderOf(payment), null);
  assert.equal(splitBadgeMarkup(payment), '');
});

test('validation refusals: nothing is recorded for a bad leg, a same-method split, or a bad customer', () => {
  const s0 = fixture();
  const snapshot = JSON.stringify(s0);
  const bad = (legs, extra = {}) => () => run(s0, { customerId: 'a', month: MONTH, date: DATE, legs, ...extra });
  assert.throws(bad([{ amount: 0, method: 'Cash' }, { amount: 1000, method: 'Easypaisa', transactionId: 'X1' }]), /Leg 1: enter a valid amount/);
  assert.throws(bad([{ amount: 2000, method: 'Cash' }, { amount: -5, method: 'Easypaisa', transactionId: 'X1' }]), /Leg 2: enter a valid amount/);
  assert.throws(bad([{ amount: 2000, method: 'Cash' }, { amount: 1000, method: 'Cash' }]), /same method/);
  assert.throws(bad([{ amount: 2000, method: 'Cash' }, { amount: 1000, method: 'Bitcoin' }]), /Leg 2: choose a valid payment method/);
  assert.throws(bad([{ amount: 3000, method: 'Cash' }]), /exactly two legs/);
  assert.throws(bad([{ amount: 1000, method: 'Cash' }, { amount: 1000, method: 'Easypaisa', transactionId: 'X1' }, { amount: 1000, method: 'Raast', transactionId: 'X2' }]), /exactly two legs/);
  assert.throws(() => run(s0, { ...SPEC_SPEC, customerId: 'missing' }), /not found/);
  assert.equal(JSON.stringify(s0), snapshot);
  assert.equal(billOf(s0).payments.length, 0);

  // Archived AFTER the bill exists (an archived customer cannot be
  // billed, so the flag is flipped on the built fixture instead).
  const built = fixture();
  const archived = { ...built, customers: [{ ...built.customers[0], archived: true }] };
  assert.throws(() => run(archived), /Archived customers/);
});

test('one wallet transfer can never pay twice: the same normalized TID on both legs is refused before recording', () => {
  const s0 = fixture();
  assert.throws(() => run(s0, {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [
      { amount: 1500, method: 'Easypaisa', transactionId: 'EP 123456' },
      { amount: 1500, method: 'JazzCash', transactionId: 'ep123456' }
    ]
  }), /same Transaction ID/);
  assert.equal(billOf(s0).payments.length, 0);
});

test('strict digital rule: a digital leg without TID is refused in pre-validation (nothing recorded)', () => {
  const s0 = fixture();
  assert.throws(() => run(s0, {
    customerId: 'a', month: MONTH, date: DATE, strictDigitalReference: true,
    legs: [{ amount: 2000, method: 'Cash' }, { amount: 1000, method: 'Easypaisa' }]
  }), /Transaction ID/);
  assert.equal(billOf(s0).payments.length, 0);
  // validateSplitTender alone reaches the same verdict.
  assert.throws(() => validateSplitTender(s0, {
    customerId: 'a', month: MONTH, date: DATE, strictDigitalReference: true,
    legs: [{ amount: 2000, method: 'Cash' }, { amount: 1000, method: 'Raast' }]
  }, NOW), /Transaction ID/);
});

test('atomicity: when leg 2 fails after leg 1 succeeded, the whole split is discarded — error says NOT saved', () => {
  const s0 = fixture();
  let calls = 0;
  const flakyExecute = (state, fields, ref) => {
    calls += 1;
    if (calls === 2) throw new Error('simulated leg-2 recorder failure');
    return executeQuickCollection(state, fields, ref);
  };
  assert.throws(
    () => executeSplitTenderCollection(s0, SPEC_SPEC, { execute: flakyExecute, referenceDate: NOW }),
    /Split payment was NOT saved[\s\S]*Nothing was recorded/
  );
  assert.equal(calls, 2);
  // The caller's state is the untouched input — the leg-1 nextState was
  // dropped, never returned or merged.
  assert.equal(billOf(s0).payments.length, 0);
});

test('overpay: legs above the due flow to derived advance credit through the engine, exactly like a normal overpay', () => {
  const { nextState, combinedReceipt } = run(fixture(), {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [{ amount: 2000, method: 'Cash' }, { amount: 1500, method: 'Easypaisa', transactionId: 'EP111222' }]
  });
  const summary = calculatePaymentAllocations(nextState).forMonth('a', MONTH);
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(summary.excessGeneratedCents, 50000);
  assert.equal(summary.pendingCreditCents, 50000);
  assert.equal(combinedReceipt.totalReceived, 3500);
  assert.equal(combinedReceipt.status, 'PAID');
});

test('underpay: a split below the due leaves a normal partial balance', () => {
  const { nextState, combinedReceipt } = run(fixture(), {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [{ amount: 1000, method: 'Cash' }, { amount: 500, method: 'Easypaisa', transactionId: 'EP333444' }]
  });
  assert.equal(calculatePaymentAllocations(nextState).forMonth('a', MONTH).balanceDueCents, 150000);
  assert.equal(derivedBillStatus(nextState.customers[0], billOf(nextState)), 'partial');
  assert.equal(combinedReceipt.status, 'PARTIAL');
  assert.equal(combinedReceipt.balanceDueCents, 150000);
});

test('shop leg: a "Cash at Hassan shop" leg routes to shop settlement, the Cash leg to the drawer', () => {
  const { nextState } = run(fixture(), {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [{ amount: 1000, method: 'Cash at Hassan shop' }, { amount: 2000, method: 'Cash' }]
  });
  const shopPayments = collectShopPayments(nextState);
  assert.equal(shopPayments.length, 1);
  // Merge composition (OWNER-CASH-SHOP, merged after this phase was
  // built): the legacy 'Cash at Hassan shop' method now resolves to the
  // ONE canonical collector 'Hassan Balla Shop' — same routing, new name.
  assert.equal(shopPayments[0].shop, 'Hassan Balla Shop');
  assert.equal(shopPayments[0].amount, 1000);
  assert.equal(shopPayments[0].remaining, 1000);
  const cash = collectDirectCashPayments(nextState, DATE);
  assert.equal(cash.reduce((sum, row) => sum + row.amount, 0), 2000);
  assert.equal(totalDueCents(nextState), 0);
});

test('VOID: voiding one leg reopens exactly that leg; the combined receipt reprint marks it and excludes it', () => {
  const { nextState, splitGroupId } = run(fixture());
  const leg2 = billOf(nextState).payments[1];
  const { state: afterVoid } = voidPayment(nextState, 'a', MONTH, leg2.id, { voidReason: 'Wrong wallet' });

  assert.equal(totalDueCents(afterVoid), 100000);
  const rebuilt = buildSplitTenderReceipt(afterVoid, 'a', splitGroupId);
  assert.equal(rebuilt.totalReceived, 2000);
  assert.equal(rebuilt.status, 'PARTIAL');
  assert.equal(rebuilt.legs[1].voided, true);
  assert.equal(rebuilt.legs[0].voided, false);
  // The surviving cash leg still counts in the drawer.
  assert.equal(collectDirectCashPayments(afterVoid, DATE).reduce((sum, row) => sum + row.amount, 0), 2000);
  // Reprint surfaces mark the voided leg.
  assert.match(formatSplitTenderWhatsAppText(rebuilt), /VOIDED/);
  assert.match(generateSplitTenderReceiptHtml(rebuilt), /VOIDED/);

  const leg1 = billOf(afterVoid).payments[0];
  const { state: afterBoth } = voidPayment(afterVoid, 'a', MONTH, leg1.id, { voidReason: 'Full reversal' });
  const rebuiltBoth = buildSplitTenderReceipt(afterBoth, 'a', splitGroupId);
  assert.equal(rebuiltBoth.status, 'VOID');
  assert.equal(rebuiltBoth.totalReceived, 0);
  assert.equal(totalDueCents(afterBoth), 300000);
});

test('waada composition: the leg that completes the split clears the promise (SISP-3); voiding THAT leg restores it (SISP-34)', () => {
  const s0 = fixture({ extra: { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: 'Friday tak' } });
  const { nextState } = run(s0);
  const customer = nextState.customers[0];
  assert.equal(customer.promiseDate, undefined);
  const [p1, p2] = billOf(nextState).payments;
  assert.equal(p1.clearedWaada, undefined);
  assert.equal(p2.clearedWaada?.promiseDate, '2026-10-20');

  const { state: afterVoid, voidRecord } = voidPayment(nextState, 'a', MONTH, p2.id, { voidReason: 'Wallet reversed' });
  assert.equal(voidRecord.promiseRestored, true);
  assert.equal(afterVoid.customers[0].promiseDate, '2026-10-20');
  assert.equal(totalDueCents(afterVoid), 100000);
});

test('the split stamps survive a JSON backup round-trip (validate + merge)', () => {
  const { nextState, splitGroupId } = run(fixture());
  const backupText = createJsonBackup(nextState, NOW);
  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  const mergedBill = preview.state.customers.find(c => c.id === 'a').bills.find(b => b.month === MONTH);
  assert.equal(mergedBill.payments.length, 2);
  assert.deepEqual(
    mergedBill.payments.map(p => splitTenderOf(p)),
    [{ groupId: splitGroupId, leg: 1 }, { groupId: splitGroupId, leg: 2 }]
  );
});

test('the split stamps survive a localStorage readState round-trip', () => {
  const { nextState, splitGroupId } = run(fixture());
  const storage = { getItem: (key) => (key === 'k' ? JSON.stringify(nextState) : null) };
  const loaded = readState(storage, 'k');
  const loadedBill = loaded.customers[0].bills.find(b => b.month === MONTH);
  assert.deepEqual(
    loadedBill.payments.map(p => splitTenderOf(p)),
    [{ groupId: splitGroupId, leg: 1 }, { groupId: splitGroupId, leg: 2 }]
  );
});

test('correctPayment carries the split stamp over verbatim (a correction never unlinks a leg)', () => {
  const { nextState, splitGroupId } = run(fixture());
  const leg1 = billOf(nextState).payments[0];
  const corrected = correctPayment(nextState, 'a', MONTH, leg1.id, { date: DATE, amount: 1900, method: 'Cash' }, NOW);
  const fixed = billOf(corrected).payments.find(p => p.id === leg1.id);
  assert.equal(fixed.amount, 1900);
  assert.deepEqual(splitTenderOf(fixed), { groupId: splitGroupId, leg: 1 });
});

test('combined receipt surfaces: WhatsApp text and the HTML sheet list both legs, TIDs, real numbers and the total', () => {
  const { combinedReceipt } = run(fixture());
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.match(text, /Cash/);
  assert.match(text, /Easypaisa/);
  assert.match(text, /EP99887766/);
  assert.match(text, /PKR 3,000/);
  assert.ok(text.includes(combinedReceipt.legs[0].receiptNumber));
  assert.ok(text.includes(combinedReceipt.legs[1].receiptNumber));

  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.match(html, /split-tender-receipt/);
  assert.ok(html.includes(combinedReceipt.legs[0].receiptNumber));
  assert.ok(html.includes(combinedReceipt.legs[1].receiptNumber));
  assert.match(html, /PKR 2,000/);
  assert.match(html, /PKR 1,000/);
  assert.match(html, /PKR 3,000/);
});

test('split badge markup: legs are badged, ordinary payments are untouched', () => {
  const { nextState } = run(fixture());
  const [p1] = billOf(nextState).payments;
  const badge = splitBadgeMarkup(p1);
  assert.match(badge, /split-badge/);
  assert.match(badge, /Leg 1 of 2/);
});

test('i18n audit: every split_* key used by the module, the QC wiring and the dialog exists in en + ur with matching placeholders', () => {
  const moduleSource = readFileSync(new URL('../split-tender-collect.js', import.meta.url), 'utf8');
  const qcSource = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = new Set();
  for (const source of [moduleSource, qcSource]) {
    for (const match of source.matchAll(/t\('(split_[a-z0-9_]+)'/g)) keys.add(match[1]);
  }
  for (const match of htmlSource.matchAll(/data-i18n="(split_[a-z0-9_]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size >= 12, `expected at least 12 split_* keys, found ${keys.size}`);
  const placeholders = (value) => [...String(value).matchAll(/\{([a-z]+)\}/g)].map(m => m[1]).sort();
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder mismatch ${key}`);
  }
});

// ------------------------------------------------- FU-SISP121-SENDER ----
// SISP-63 sender proof metadata per leg. The split spec carries
// senderTitle/senderDigits per leg exactly as the single-payment path
// hands them to executeQuickCollection; core's validatePayment remains
// the single sanitization point (digital-only keep, single-line title
// <= 100 chars, digits reduced to the LAST 4 — a full account number
// is never stored).

test('SENDER: leg 2 digital carries senderTitle + last-4 digits; the cash leg stores NO sender fields', () => {
  const { nextState } = run(fixture(), {
    customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766', senderTitle: 'Hamza', senderDigits: '0300-1233310' }
    ]
  });
  const [p1, p2] = billOf(nextState).payments;
  assert.equal(p2.senderTitle, 'Hamza');
  // Digits reduced to the LAST 4 — the full number is never stored.
  assert.equal(p2.senderDigits, '3310');
  assert.equal('senderTitle' in p1, false);
  assert.equal('senderDigits' in p1, false);
  // The wallet reconciliation entry for the leg carries the sender —
  // this is the exact input SISP-63 statement matching consumes.
  const wallet = buildWalletReconciliation(nextState.customers, MONTH);
  assert.equal(wallet.payments[0].senderTitle, 'Hamza');
  assert.equal(wallet.payments[0].senderDigits, '3310');
});

test('SENDER: leg 1 digital + leg 2 cash — leg 1 is stamped, leg 2 stores nothing (even if values were passed)', () => {
  const { nextState } = run(fixture(), {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [
      { amount: 1000, method: 'Easypaisa', transactionId: 'EP111222', senderTitle: 'Ali Raza', senderDigits: '7788' },
      { amount: 2000, method: 'Cash', senderTitle: 'Should Be Dropped', senderDigits: '9999' }
    ]
  });
  const [p1, p2] = billOf(nextState).payments;
  assert.equal(p1.senderTitle, 'Ali Raza');
  assert.equal(p1.senderDigits, '7788');
  assert.equal('senderTitle' in p2, false);
  assert.equal('senderDigits' in p2, false);
});

test('SENDER: two digital legs each keep their OWN sender (no cross-leg bleed)', () => {
  const { nextState } = run(fixture(), {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [
      { amount: 1500, method: 'Easypaisa', transactionId: 'EP123456', senderTitle: 'Hamza', senderDigits: '3310' },
      { amount: 1500, method: 'JazzCash', transactionId: 'JC654321', senderTitle: 'Bilal', senderDigits: '4455' }
    ]
  });
  const [p1, p2] = billOf(nextState).payments;
  assert.equal(p1.senderTitle, 'Hamza');
  assert.equal(p1.senderDigits, '3310');
  assert.equal(p2.senderTitle, 'Bilal');
  assert.equal(p2.senderDigits, '4455');
});

test('SENDER: empty sender inputs store nothing on a digital leg (record shape unchanged)', () => {
  const { nextState } = run(fixture(), {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766', senderTitle: '   ', senderDigits: '' }
    ]
  });
  const [, p2] = billOf(nextState).payments;
  assert.equal('senderTitle' in p2, false);
  assert.equal('senderDigits' in p2, false);
});

test('SENDER: sanitization parity with the single-payment path (newline title cleaned, full number cut to last 4, overlong title refused pre-recording)', () => {
  const { nextState } = run(fixture(), {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1000, method: 'NayaPay', transactionId: 'NP-998877', senderTitle: '  Hamza\nKhan ', senderDigits: '0300-1233310' }
    ]
  });
  const [, p2] = billOf(nextState).payments;
  assert.equal(p2.senderTitle, 'Hamza Khan');
  assert.equal(p2.senderDigits, '3310');

  // Same refusal the single-payment path produces, raised by the
  // split pre-validation BEFORE anything is recorded.
  const s0 = fixture();
  assert.throws(() => run(s0, {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1000, method: 'Easypaisa', transactionId: 'EP000111', senderTitle: 'x'.repeat(101) }
    ]
  }), /Sender name must be 100 characters or fewer/);
  assert.equal(billOf(s0).payments.length, 0);
});

// Plan 559 DELIBERATE RULE CHANGE (why-comment): this test used to
// pin that no sender keys leak into the combined receipt model — the
// SISP-121 sender work kept sender metadata on the recorded payments
// only. Plan 559 reverses exactly that for the two display fields:
// the legs map now carries `senderLabel` (SISP-63, from the leg's own
// receipt) and `paidBy` (Plan 378, from the leg's own receipt) so the
// combined surfaces can identify who paid each leg and whose account
// sent it. The model gains exactly those two keys — nothing else —
// and the totals/status assertions below are unchanged.
test('SENDER: the combined receipt model carries the sender label and payer name (Plan 559)', () => {
  const { combinedReceipt } = run(fixture(), {
    customerId: 'a', month: MONTH, date: DATE,
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766', senderTitle: 'Hamza', senderDigits: '3310' }
    ]
  });
  assert.deepEqual(
    Object.keys(combinedReceipt.legs[1]).sort(),
    ['amount', 'date', 'leg', 'method', 'paidBy', 'paymentId', 'receiptNumber', 'senderLabel', 'transactionId', 'voided']
  );
  assert.equal(combinedReceipt.legs[1].senderLabel, 'Hamza (…3310)', 'the digital leg carries its SISP-63 sender label');
  assert.equal(combinedReceipt.legs[0].senderLabel, '', 'the cash leg carries no sender');
  assert.equal(combinedReceipt.legs[1].paidBy, '', 'no payer name was given on this spec');
  assert.equal(combinedReceipt.totalReceived, 3000);
  assert.equal(combinedReceipt.status, 'PAID');
});

test('wiring pins: dialog fields exist, the QC modal imports the module, app.js badges split legs', () => {
  const htmlSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'quickCollectSplitToggle', 'quickCollectSplitFields', 'quickCollectSplitAmountInput',
    'quickCollectSplitMethodSelect', 'quickCollectSplitDigitalFields',
    'quickCollectSplitTransactionIdInput', 'quickCollectSplitOverrideReasonInput',
    'quickCollectSplitSenderNameInput', 'quickCollectSplitSenderDigitsInput'
  ]) {
    assert.ok(htmlSource.includes(`id="${id}"`), `index.html missing #${id}`);
  }
  const qcSource = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(qcSource, /from '\.\/split-tender-collect\.js'/);
  assert.match(qcSource, /executeSplitTenderCollection/);
  // FU-SISP121-SENDER: the split submit reads BOTH sender input pairs —
  // the main SISP-63 inputs for leg 1, the split block's own for leg 2.
  assert.match(qcSource, /quickCollectSplitSenderNameInput/);
  assert.match(qcSource, /quickCollectSplitSenderDigitsInput/);
  assert.match(qcSource, /senderTitle: \(splitSenderNameInput\?\.value \|\| ''\)\.trim\(\)/);
  assert.match(qcSource, /senderDigits: \(splitSenderDigitsInput\?\.value \|\| ''\)\.trim\(\)/);
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(appSource, /splitBadgeMarkup/);
});

// --- Sharafat 1: split legs keep the collection note, category tag,
// promise link, waiver, overpayment choice, excess note and
// remainder waada — the fields a split used to drop silently. ---

// A bill carrying a late fee, built the same way the waiver tests
// build theirs (real profile + real monthly bill + real fee).
function feeFixture({ principal = 3000, fee = 150, secondDue = 0 } = {}) {
  const oct1 = new Date(2026, 9, 1, 12);
  let state = createInitialState(['Sharafat One']);
  const id = state.customers[0].id;
  state = updateCustomerProfile(state, id, { packageSpeed: '15Mbps Unlimited', monthlySellingAmount: principal }, oct1);
  state = generateMonthlyBillsThroughCurrentMonth(state, oct1);
  state = applyLateFeeToBill(state, id, MONTH, { amount: fee, reason: 'Late payment surcharge' }, oct1);
  if (secondDue > 0) {
    // The second bill is next month's, so it is priced against a
    // November reference — saveBillMonth only accepts months within
    // the last 24 months of the reference date.
    state = saveBillMonth(state, id, { month: '2026-11', dueAmount: secondDue, status: 'pending' }, new Date('2026-11-05T12:00:00+05:00'));
  }
  return { state, id };
}
const feeBillOf = (state, id, month = MONTH) => state.customers.find(c => c.id === id).bills.find(b => b.month === month);
const feeBalanceOf = (state, id, month = MONTH) => calculatePaymentAllocations(state).forMonth(id, month)?.balanceDueCents / 100;

test('Sharafat 1: a split with a collection note, a category tag and a promise link keeps all three on BOTH legs, the combined receipt and the shared drafts', () => {
  const { nextState, combinedReceipt } = run(fixture(), {
    ...SPEC_SPEC,
    collectedBy: 'Saad',
    collectionPlace: 'field',
    collectionMohalla: 'Gangall',
    urduNote: 'شکریہ',
    categoryTag: 'collection',
    promiseLink: { promiseId: 'p-1' }
  });
  const [p1, p2] = billOf(nextState).payments;

  // Both legs are indistinguishable from a normal single payment
  // carrying the same fields.
  for (const payment of [p1, p2]) {
    assert.equal(payment.collectedBy, 'Saad');
    assert.equal(payment.collectionPlace, 'field');
    assert.equal(payment.collectionMohalla, 'Gangall');
    assert.equal(payment.urduNote, 'شکریہ');
    assert.equal(payment.categoryTag, 'collection');
    assert.deepEqual(payment.promiseLink, { promiseId: 'p-1', date: '2026-10-29' });
  }

  // The combined receipt reads them off the saved records.
  assert.equal(combinedReceipt.collectedBy, 'Saad');
  assert.equal(combinedReceipt.collectionPlace, 'field');
  assert.equal(combinedReceipt.collectionMohalla, 'Gangall');
  assert.equal(combinedReceipt.urduNote, 'شکریہ');
  assert.equal(combinedReceipt.categoryTag, 'collection');
  assert.deepEqual(combinedReceipt.promiseLink, { promiseId: 'p-1', date: '2026-10-29' });

  // The shared drafts print them — the note in plain words, the
  // Urdu note, the tag, and the promise the COMBINED tender
  // fulfils (its total, its date).
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('Collected by Saad'), 'WhatsApp prints the collector');
  assert.ok(text.includes('Gangall'), 'WhatsApp prints the mohalla');
  assert.ok(text.includes('شکریہ'), 'WhatsApp prints the Urdu note');
  assert.ok(text.includes('Collection'), 'WhatsApp prints the tag');
  assert.ok(text.includes('Fulfils promise p-1 — Rs 3000 on 2026-10-29'), 'WhatsApp names the combined tender as the fulfilling payment');
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(html.includes('Saad'), 'HTML sheet prints the collector');
  assert.ok(html.includes('Gangall'), 'HTML sheet prints the mohalla');
  assert.ok(html.includes('شکریہ'), 'HTML sheet prints the Urdu note');
  assert.ok(html.includes('Fulfils promise p-1 — Rs 3000 on 2026-10-29'), 'HTML sheet prints the promise line');
});

test('Sharafat 1: a waiver rides leg 2 when leg 1 alone does not cover the principal but the combined tender does', () => {
  const { state, id } = feeFixture(); // Rs. 3,000 principal + Rs. 150 fee
  assert.equal(feeBalanceOf(state, id), 3150, 'precondition: 3,000 principal + 150 late fee due');
  const { nextState, combinedReceipt } = executeSplitTenderCollection(state, {
    customerId: id, month: MONTH, date: DATE, paidBy: 'Self',
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766' }
    ],
    waiveLateFee: true
  }, { execute: executeQuickCollection, referenceDate: NOW });

  // The fee is gone, exactly once, and the bill is settled.
  const bill = feeBillOf(nextState, id);
  assert.equal(bill.lateFee, 0);
  assert.equal(feeBalanceOf(nextState, id), 0);
  // Leg 1 carries no waiver; leg 2 — the leg that settled the bill —
  // carries the audit pair.
  const [p1, p2] = bill.payments;
  assert.equal(lateFeeWaiverOf(p1), null, 'leg 1 waived nothing');
  assert.equal(lateFeeWaiverOf(p2).waivedAmount, 150, 'leg 2 waived the whole remaining fee');
  assert.equal(p2.lateFeeWaived, true);
  // The combined receipt and the success card report the waiver.
  assert.equal(combinedReceipt.lateFeeWaived, true);
  assert.equal(combinedReceipt.waivedAmount, 150);
  const card = renderSplitReceiptCardHtml(combinedReceipt);
  assert.ok(card.includes('Late Fee'), 'card names the waived fee');
  assert.ok(card.includes('PKR 150'), 'card prints the waived amount');
});

test('Sharafat 1: a waiver rides leg 1 when leg 1 alone already covers the principal', () => {
  const { state, id } = feeFixture({ secondDue: 2000 }); // Oct 3,000 + 150 fee, Nov 2,000
  const { nextState, combinedReceipt } = executeSplitTenderCollection(state, {
    customerId: id, month: MONTH, date: DATE, paidBy: 'Self',
    legs: [
      { amount: 3000, method: 'Cash' },
      { amount: 2000, method: 'Easypaisa', transactionId: 'EP99887766' }
    ],
    waiveLateFee: true
  }, { execute: executeQuickCollection, referenceDate: NOW });

  const octBill = feeBillOf(nextState, id);
  const novBill = feeBillOf(nextState, id, '2026-11');
  assert.equal(octBill.lateFee, 0, 'the October fee is waived');
  assert.equal(feeBalanceOf(nextState, id), 0, 'October settled');
  assert.equal(feeBalanceOf(nextState, id, '2026-11'), 0, 'leg 2 settled November');
  const [p1, p2] = octBill.payments;
  assert.equal(lateFeeWaiverOf(p1).waivedAmount, 150, 'leg 1 waived the fee — it settled the bill');
  assert.equal(lateFeeWaiverOf(p2), null, 'leg 2 waived nothing');
  assert.equal(combinedReceipt.lateFeeWaived, true);
  assert.equal(combinedReceipt.waivedAmount, 150);
});

test('Sharafat 1: a waiver the combined tender cannot honour refuses the whole split loudly and records nothing', () => {
  const { state, id } = feeFixture(); // Rs. 3,000 principal + Rs. 150 fee
  assert.throws(() => executeSplitTenderCollection(state, {
    customerId: id, month: MONTH, date: DATE, paidBy: 'Self',
    legs: [
      { amount: 1200, method: 'Cash' },
      { amount: 800, method: 'Easypaisa', transactionId: 'EP99887766' }
    ],
    waiveLateFee: true
  }, { execute: executeQuickCollection, referenceDate: NOW }), /full principal/);
  // All-or-nothing: the input state is untouched, leg 1 included.
  assert.equal(feeBillOf(state, id).payments.length, 0);
  assert.equal(feeBillOf(state, id).lateFee, 150);
  assert.equal(feeBalanceOf(state, id), 3150);
});

test('Sharafat 1: the overpayment choice rides the LAST leg only, with the extra over the COMBINED dues', () => {
  const { nextState, combinedReceipt } = run(fixture(), {
    ...SPEC_SPEC,
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1500, method: 'Easypaisa', transactionId: 'EP99887766' }
    ],
    overpaymentChoice: 'advance',
    overpaymentDuesCents: 300000
  });
  const [p1, p2] = billOf(nextState).payments;
  // Leg 1 (Rs. 2,000 of Rs. 3,000 dues) carries no choice; leg 2
  // carries the combined extra — Rs. 3,500 tendered minus Rs. 3,000
  // dues — not its own Rs. 500 over the Rs. 1,000 left after leg 1.
  assert.equal(overpaymentChoiceOf(p1), null, 'leg 1 carries no choice');
  assert.deepEqual(overpaymentChoiceOf(p2), { choice: 'advance', extraCents: 50000 });
  assert.deepEqual(combinedReceipt.overpaymentChoice, { choice: 'advance', extraCents: 50000 });
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('Extra PKR 500 as advance'), 'WhatsApp prints the combined extra and its disposition');
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(html.includes('Extra PKR 500 as advance'), 'HTML sheet prints the combined extra and its disposition');
});

test('Sharafat 1: the excess-cash note rides the LAST leg only, with the extra over the COMBINED dues', () => {
  const { nextState, combinedReceipt } = run(fixture(), {
    ...SPEC_SPEC,
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1500, method: 'Easypaisa', transactionId: 'EP99887766' }
    ],
    excessCashNote: 'change',
    excessCashDuesCents: 300000
  });
  const [p1, p2] = billOf(nextState).payments;
  assert.equal(excessCashNoteOf(p1), null, 'leg 1 carries no note');
  assert.deepEqual(excessCashNoteOf(p2), { purpose: 'change', extraCents: 50000 });
  assert.deepEqual(combinedReceipt.excessCashNote, { purpose: 'change', extraCents: 50000 });
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('Extra PKR 500 — change to return'), 'WhatsApp prints the combined extra and its purpose');
});

test('Sharafat 1: the remainder-waada date rides the LAST leg, with the post-split remainder', () => {
  const { nextState, combinedReceipt } = run(fixture(), {
    ...SPEC_SPEC,
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 500, method: 'Easypaisa', transactionId: 'EP99887766' }
    ],
    remainderWaadaDate: '2026-11-05'
  });
  const [p1, p2] = billOf(nextState).payments;
  assert.equal(remainderWaadaOf(p1), null, 'leg 1 carries no waada');
  assert.deepEqual(remainderWaadaOf(p2), { promiseDate: '2026-11-05', promiseAmount: 500 });
  // The waada persists with the payment, through the real SISP-3
  // fields, with the remainder after BOTH legs (3,000 − 2,500).
  const customer = nextState.customers[0];
  assert.equal(customer.promiseDate, '2026-11-05');
  assert.equal(customer.promiseAmount, 500);
  assert.equal(customer.promiseNote, REMAINDER_WAADA_NOTE);
  assert.deepEqual(combinedReceipt.remainderWaada, { promiseDate: '2026-11-05', promiseAmount: 500 });
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('Baqi Rs. 500 • Waada: 2026-11-05'), 'WhatsApp prints the remainder waada beside the balance');
  const card = renderSplitReceiptCardHtml(combinedReceipt);
  assert.ok(card.includes('Baqi Rs. 500 • Waada: 2026-11-05'), 'card prints the remainder waada');
});

test('Sharafat 1: a split with none of the fields records and renders exactly as before', () => {
  const { nextState, combinedReceipt } = run(fixture());
  const [p1, p2] = billOf(nextState).payments;
  // No leg carries any of the fields.
  for (const payment of [p1, p2]) {
    assert.equal(payment.collectedBy, undefined);
    assert.equal(payment.collectionPlace, undefined);
    assert.equal(payment.collectionMohalla, undefined);
    assert.equal(payment.urduNote, undefined);
    assert.equal(payment.categoryTag, undefined);
    assert.equal(payment.promiseLink, undefined);
    assert.equal(lateFeeWaiverOf(payment), null);
    assert.equal(overpaymentChoiceOf(payment), null);
    assert.equal(excessCashNoteOf(payment), null);
    assert.equal(remainderWaadaOf(payment), null);
  }
  // The combined receipt defaults to empty / null / false / 0.
  assert.equal(combinedReceipt.collectedBy, '');
  assert.equal(combinedReceipt.collectionPlace, '');
  assert.equal(combinedReceipt.collectionMohalla, '');
  assert.equal(combinedReceipt.urduNote, '');
  assert.equal(combinedReceipt.categoryTag, '');
  assert.equal(combinedReceipt.promiseLink, null);
  assert.equal(combinedReceipt.lateFeeWaived, false);
  assert.equal(combinedReceipt.waivedAmount, 0);
  assert.equal(combinedReceipt.overpaymentChoice, null);
  assert.equal(combinedReceipt.excessCashNote, null);
  assert.equal(combinedReceipt.remainderWaada, null);
  // No collection block on any surface.
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(!text.includes('Collection / وصولی'), 'WhatsApp prints no collection line');
  assert.ok(!text.includes('Note / نوٹ'), 'WhatsApp prints no note line');
  assert.ok(!text.includes('Category / زمرہ'), 'WhatsApp prints no tag line');
  assert.ok(!text.includes('Fulfils promise'), 'WhatsApp prints no promise line');
  assert.ok(!text.includes('🎟️'), 'WhatsApp prints no waiver line');
  assert.ok(!text.includes('🪙'), 'WhatsApp prints no extra line');
  assert.ok(!text.includes('Waada:'), 'WhatsApp prints no waada line');
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(!html.includes('Collection / وصولی'), 'HTML sheet prints no collection row');
  assert.ok(!html.includes('Note / نوٹ'), 'HTML sheet prints no note row');
  assert.ok(!html.includes('Category / زمرہ'), 'HTML sheet prints no tag row');
  assert.ok(!html.includes('Promise / وعدہ'), 'HTML sheet prints no promise row');
  assert.ok(!html.includes('Late Fee Waived'), 'HTML sheet prints no waiver row');
  assert.ok(!html.includes('Waada / وعدہ'), 'HTML sheet prints no waada row');
  const card = renderSplitReceiptCardHtml(combinedReceipt);
  assert.ok(!card.includes('🎟️'), 'card prints no waiver row');
  assert.ok(!card.includes('🤝'), 'card prints no waada row');
});

// Sharafat 2: the combined receipt's status is the canonical payable
// remainder (Plan 565) — bill dues plus pending ticket/addon/baqaya
// charges — never bill dues alone. A split that pays every bill while
// a charge is pending used to print PAID on the card, the HTML sheet
// and the WhatsApp text; it now reads PARTIAL on all three, and only
// a split with nothing left pending reads PAID.

/** One resolved+billed ticket charge for customer 'a' (PKR rupees). */
function billedTickets(amount = 500) {
  let tickets = [];
  const created = createTicket({
    customerId: 'a',
    customerName: 'Customer 1',
    faultPreset: 'Fiber Cut / Splice Loss',
    technician: 'Test Lineman'
  }, tickets);
  tickets = resolveTicket([...tickets, created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount }],
    billingType: 'billed',
    referenceDate: NOW
  });
  return tickets;
}

test('Sharafat 2: a split that pays every bill with a ticket charge still pending reads PARTIAL on the card, the HTML sheet and the WhatsApp text', () => {
  const tickets = billedTickets(500);
  const { combinedReceipt, nextTickets } = run(fixture(), { ...SPEC_SPEC, tickets });
  // Bills settled in full — the old bill-only status derivation
  // printed PAID here.
  assert.equal(combinedReceipt.balanceDueCents, 0);
  assert.equal(combinedReceipt.totalReceived, 3000);
  // The ticket was never settled: the split exactly covered the bill
  // dues, so the remainder the cascade settles charges from was 0.
  assert.equal(billedTicketChargesPending(nextTickets ?? tickets, 'a'), 500);
  assert.equal(combinedReceipt.payableRemainingCents, 50000);
  assert.equal(combinedReceipt.status, 'PARTIAL');
  // Every surface reads the same PARTIAL, never PAID.
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.match(text, /Partially Paid \/ جزوی ادا شدہ/);
  assert.doesNotMatch(text, /Paid in Full/);
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.match(html, /receipt-status-partial/);
  assert.match(html, />PARTIAL</);
  const card = renderSplitReceiptCardHtml(combinedReceipt, '', { chargesPending: true });
  assert.match(card, /Still owed \(incl\. pending charges\)/);
  assert.match(card, /PKR 500/);
  assert.doesNotMatch(card, /Fully paid/);
});

test('Sharafat 2: a split that pays every bill with a speed-boost fee still pending reads PARTIAL', () => {
  let state = fixture();
  ({ state } = addSpeedBoost(state, 'a', { boostMbps: 15, durationDays: 10, addonFeePKR: 200, startDate: '2026-10-25' }, NOW));
  const { combinedReceipt } = run(state);
  assert.equal(combinedReceipt.balanceDueCents, 0);
  assert.equal(combinedReceipt.payableRemainingCents, 20000);
  assert.equal(combinedReceipt.status, 'PARTIAL');
  const card = renderSplitReceiptCardHtml(combinedReceipt, '', { chargesPending: true });
  assert.match(card, /Still owed \(incl\. pending charges\)/);
  assert.match(card, /PKR 200/);
  assert.doesNotMatch(card, /Fully paid/);
});

test('Sharafat 2: a split that pays every bill with manual baqaya still pending reads PARTIAL', () => {
  let state = fixture();
  state = addManualBaqayaEntry(state, 'a', { amount: 1500, date: '2026-09-10', note: 'Last month balance' }, NOW);
  const { combinedReceipt } = run(state);
  assert.equal(combinedReceipt.balanceDueCents, 0);
  assert.equal(combinedReceipt.payableRemainingCents, 150000);
  assert.equal(combinedReceipt.status, 'PARTIAL');
  // The live card wiring derives chargesPending from the leg
  // receipt's ticket/addon fields only, so a baqaya-only remainder
  // reads the plain "Still owed" label — the figure is what states
  // PARTIAL, and it is never "Fully paid".
  const card = renderSplitReceiptCardHtml(combinedReceipt);
  assert.match(card, /Still owed/);
  assert.match(card, /PKR 1,500/);
  assert.doesNotMatch(card, /Fully paid/);
});

test('Sharafat 2: a split that also settles the pending ticket charge still reads PAID', () => {
  const tickets = billedTickets(500);
  const overpaySpec = {
    ...SPEC_SPEC,
    tickets,
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1500, method: 'Easypaisa', transactionId: 'EP99887766' }
    ]
  };
  const { combinedReceipt, nextTickets } = run(fixture(), overpaySpec);
  // Leg 2's remainder after the bill (500) settles the ticket whole.
  assert.equal(billedTicketChargesPending(nextTickets ?? tickets, 'a'), 0);
  assert.equal(combinedReceipt.balanceDueCents, 0);
  assert.equal(combinedReceipt.payableRemainingCents, 0);
  assert.equal(combinedReceipt.status, 'PAID');
  const card = renderSplitReceiptCardHtml(combinedReceipt);
  assert.match(card, /Fully paid/);
});

test('Sharafat 2: the builder counts a ticket charge only when the caller passes the ticket list', () => {
  const tickets = billedTickets(500);
  const { nextState, splitGroupId, nextTickets } = run(fixture(), { ...SPEC_SPEC, tickets });
  // No list, no ticket term: the builder can only see what is in
  // state (bills + addon + baqaya), so it reads PAID here — the
  // recorder always passes the post-settlement list, so the live
  // combined receipt never takes this path.
  assert.equal(buildSplitTenderReceipt(nextState, 'a', splitGroupId).status, 'PAID');
  // The same state rebuilt WITH the post-settlement list reads PARTIAL.
  assert.equal(buildSplitTenderReceipt(nextState, 'a', splitGroupId, nextTickets ?? tickets).status, 'PARTIAL');
});
