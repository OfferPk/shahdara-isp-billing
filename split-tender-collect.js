/**
 * split-tender-collect.js — SISP-121: Split-Tender Cash + Digital Wallet
 * Checkout for Quick Collect.
 *
 * One bill payment tendered across TWO methods in a single checkout
 * (e.g. Leg 1: Cash Rs 2,000 + Leg 2: Easypaisa Rs 1,000 with TID).
 *
 * MODEL (deliberate — do not "simplify" into a multi-method payment):
 * a split is TWO ordinary payment records, one per leg, each recorded
 * through the EXISTING Quick Collect recorder (executeQuickCollection,
 * injected by the caller exactly like group-billing.js injects it).
 * Every aggregate in the app keys off ONE method per payment — method
 * totals, the Roznamcha drawer, wallet reconciliation, shop
 * settlements — so each leg flows through all of them NATURALLY, with
 * zero changes to those engines. The two records are linked only by a
 * stamp on each record: `splitGroupId` (shared) + `splitLeg` (1 | 2).
 * The stamp survives every persistence path the house already has:
 * readState (bills ride as-is), JSON backup (validateBackupState's
 * raw-spread keeps later fields on purpose), backup merge, and
 * correctPayment (core carries the stamp over verbatim, SISP-121).
 *
 * ATOMICITY: the recorder chain is pure — execute() returns a new
 * state and the CALLER decides whether to persist it. This module
 * validates BOTH legs completely BEFORE recording either (the same
 * validatePayment the recorder itself will run, plus split rules), and
 * if leg 2 still throws, the whole chain is discarded and the error
 * says nothing was recorded — because nothing was: the input state is
 * never mutated and the leg-1 nextState is dropped, not saved. (The
 * recorder also appends to a device-local recent-collects display log;
 * that log is not the ledger and never feeds a balance.)
 *
 * VOID (SISP-34): each leg is an ordinary payment, so each voids
 * individually under the existing rules — voiding one leg reopens
 * exactly that leg's amount; the other leg stands. The combined
 * receipt is DERIVED from the saved records, so a reprint after a void
 * shows the voided leg marked VOID and excludes it from the total.
 *
 * SENDER (SISP-63, FU-SISP121-SENDER): each leg also carries the
 * sender proof metadata (senderTitle + senderDigits, name + last-4
 * only) under the exact SISP-63 contract — the recorder stamps it on
 * digital legs, cash legs store nothing — so wallet statement
 * matching treats a split's digital leg like any digital payment.
 *
 * Imported ONLY by nav-quick-collect.js (an existing build entry), so
 * the module inlines into the existing bundle graph — dist stays at
 * the 25-file perf budget (pinned by tests/split-tender-collect.test.js
 * via the build-output suite).
 */
import {
  PAYMENT_METHODS,
  isDigitalPaymentMethod,
  validatePayment,
  calculatePaymentAllocations,
  monthsForHistory
} from './core.js';
import { buildPaymentReceipt, RECEIPT_URDU_NOTE } from './receipt.js';
import { receiptTermsNoteHtml, receiptTermsNoteText } from './receipt-terms.js';
import { isVoidedPayment } from './payment-void-audit.js';
import { normalizeTid } from './wallet-reconciliation.js';
import { t } from './nav-language.js';
import {
  SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT,
  SUCCESS_NEXT_STEPS_STILL_OWED_TEXT,
  SUCCESS_NEXT_STEPS_STILL_OWED_CHARGES_TEXT,
  SUCCESS_NEXT_STEPS_NO_DUE_DATE_TEXT,
} from './success-next-steps.js';
import { formatReceiptMoney, formatReceiptMoneyFigure } from './receipt-money.js';
import { SALES_TAX_RECEIPT_LABEL } from './package-sales-tax.js';
// Sharafat 1: the form-level fields a split used to drop, read back
// off the SAVED leg records for the combined receipt — every one of
// these modules is import-free (no cycle risk), and every one is
// already in the bundle through core.js / app.js, so the 25-file
// perf budget is untouched.
import { planLateFeeWaiver, lateFeeWaiverOf } from './late-fee-waiver.js';
import { remainderWaadaOf } from './waada-queue.js';
import { normalizeCollectionPlace, collectionNoteOf, collectionNoteLineText } from './collection-place-note.js';
import { urduNoteLineText } from './urdu-note.js';
import { normalizeTransactionCategoryTag, categoryTagLineText } from './transaction-category-tag.js';
import { promisePaymentLinkOf, promisePaymentLinkLineText } from './promise-payment-link.js';
import { overpaymentChoiceOf, overpaymentChoiceLineText } from './overpayment-choice.js';
import { excessCashNoteOf, excessCashNoteLineText } from './excess-cash-note.js';
import { brandHeaderContentHtml, documentFooterHtml } from './document-branding.js';
import { receiptCodeForReceipt, verificationStampText } from './receipt-verifier.js';

export const SPLIT_TENDER_LEG_COUNT = 2;

const centsOf = (value) => Math.round(Number(value) * 100);
const moneyOf = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Unique split-group id (mirrors payment-void-audit's voidId pattern). */
export function newSplitGroupId() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return `split-${globalThis.crypto.randomUUID()}`;
    }
  } catch { /* fall through */ }
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * True only for a payment record that is one leg of a split tender.
 * Legacy records (no stamp) always read false — the stamp is the only
 * source of truth, exactly like the SISP-34 void stamp.
 */
export function splitTenderOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  const groupId = typeof payment.splitGroupId === 'string' ? payment.splitGroupId.trim() : '';
  const leg = Number(payment.splitLeg);
  if (!groupId || (leg !== 1 && leg !== 2)) return null;
  return { groupId, leg };
}

function cleanLeg(rawLeg, index) {
  const leg = rawLeg && typeof rawLeg === 'object' ? rawLeg : {};
  return {
    leg: index + 1,
    amount: Number(leg.amount),
    method: typeof leg.method === 'string' ? leg.method.trim() : '',
    transactionId: String(leg.transactionId ?? '').trim().slice(0, 64),
    // FU-SISP121-SENDER: SISP-63 sender proof metadata rides each leg
    // exactly as the single-payment path hands it to the recorder —
    // trimmed pass-through here; core's validatePayment is the single
    // sanitization point (single-line title, <= 100 chars or throw,
    // digits reduced to digits-only LAST 4, kept for digital methods
    // only — a cash leg's values are dropped there, never stored).
    senderTitle: String(leg.senderTitle ?? '').trim(),
    senderDigits: String(leg.senderDigits ?? '').trim(),
    referenceOverrideReason: String(leg.referenceOverrideReason ?? '').trim().slice(0, 100),
    // A proof screenshot may ride ONE leg only (the caller puts it on
    // leg 1); validatePayment applies its own data-URL rules later.
    screenshot: index === 0 && typeof leg.screenshot === 'string' ? leg.screenshot : undefined
  };
}

/**
 * Sharafat 1: which leg a ticked late-fee waiver rides — the leg that
 * settles the target bill. Leg 1 when leg 1 alone already covers the
 * full principal still owed on the target bill (the recorder's own
 * full-principal gate, evaluated here on the same pre-split state),
 * leg 2 otherwise — the recorder re-evaluates the gate on the
 * post-leg-1 state there, so a waiver the combined payment cannot
 * honour is refused by the recorder, never dropped. A missing bill
 * or a bill with no fee decides leg 2 as well: the recorder throws
 * the same refusal the single-payment path throws.
 */
function waiverLegFor(state, customerId, month, legs, referenceDate = new Date()) {
  const effectiveMonth = month || monthsForHistory(referenceDate)[0];
  const customer = (state && Array.isArray(state.customers) ? state.customers : []).find(c => c.id === customerId);
  const bill = customer?.bills?.find(b => b.month === effectiveMonth) ?? null;
  const summary = calculatePaymentAllocations(state).forMonth(customerId, effectiveMonth);
  const plan = planLateFeeWaiver({
    bill,
    balanceDueCents: summary?.balanceDueCents,
    lateFeeCents: summary?.lateFeeCents,
    paymentAmountCents: Math.round(Number(legs[0]?.amount || 0) * 100)
  });
  return plan.eligible ? 1 : 2;
}

/**
 * Validates a split-tender spec COMPLETELY, before anything is
 * recorded. Returns the cleaned { customerId, month, date, paidBy,
 * legs } on success; throws with a precise message otherwise. The
 * per-leg field validation runs the REAL core validatePayment with the
 * exact fields the recorder will pass to addPayment, so a spec that
 * passes here cannot fail inside leg recording for a field reason.
 */
export function validateSplitTender(state, spec, referenceDate = new Date()) {
  const { customerId, month, date, paidBy, legs } = spec ?? {};
  if (!customerId) throw new Error('Customer ID is required.');
  const customer = (state && Array.isArray(state.customers) ? state.customers : []).find(c => c.id === customerId);
  if (!customer) throw new Error(`Customer ${customerId} not found.`);
  if (customer.archived) throw new Error('Archived customers cannot receive payments. Unarchive the customer first.');
  if (month !== undefined && month !== null && month !== '' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) {
    throw new Error('Choose a valid billing month for the split payment.');
  }
  if (!Array.isArray(legs) || legs.length !== SPLIT_TENDER_LEG_COUNT) {
    throw new Error('A split payment needs exactly two legs.');
  }
  const cleaned = legs.map((leg, index) => cleanLeg(leg, index));
  for (const leg of cleaned) {
    if (!Number.isFinite(leg.amount) || leg.amount <= 0) {
      throw new Error(`Leg ${leg.leg}: enter a valid amount greater than zero.`);
    }
    if (!PAYMENT_METHODS.includes(leg.method)) {
      throw new Error(`Leg ${leg.leg}: choose a valid payment method.`);
    }
  }
  if (cleaned[0].method === cleaned[1].method) {
    throw new Error('Both legs use the same method — record it as one normal payment instead of a split.');
  }
  // One wallet transfer can never pay twice: the same normalized TID on
  // both legs would double-count a single digital receipt.
  const tid0 = normalizeTid(cleaned[0].transactionId);
  const tid1 = normalizeTid(cleaned[1].transactionId);
  if (tid0 && tid1 && tid0 === tid1) {
    throw new Error('Both legs carry the same Transaction ID — one transfer cannot pay twice. Give each digital leg its own TID.');
  }
  // Strict digital-reference rule, mirrored from the recorder BEFORE
  // anything is written (the recorder enforces it per leg as well).
  if ((spec?.strictDigitalReference || spec?.enforceDigitalReference)) {
    for (const leg of cleaned) {
      if (isDigitalPaymentMethod(leg.method) && !leg.transactionId && !leg.referenceOverrideReason) {
        throw new Error(`Leg ${leg.leg}: Transaction ID / last 6 digits is required for digital payments (or provide an override reason).`);
      }
    }
  }
  // Sharafat 1: the form-level fields a split used to drop — the
  // collection note (who collected it, where, in which mohalla, and
  // the Urdu-script note), the category tag, the promise link, the
  // late-fee waiver, the overpayment choice, the excess-cash note and
  // the remainder-waada date. They ride the spec exactly as the
  // single-payment submit hands them to the recorder, so the
  // recorder stays the single sanitization point for every one of
  // them; this module only decides WHICH leg each field lands on.
  // (The large-cash approval, cross-payment note, contributor pick
  // and second-connection tag are NOT threaded here — the design
  // names the fields above only; those stay single-path fields.)
  const shared = {
    collectedBy: String(spec?.collectedBy ?? '').trim(),
    collectionPlace: String(spec?.collectionPlace ?? '').trim(),
    collectionMohalla: String(spec?.collectionMohalla ?? '').trim(),
    urduNote: String(spec?.urduNote ?? '').trim(),
    categoryTag: String(spec?.categoryTag ?? '').trim(),
    promiseLink: spec?.promiseLink,
    waiveLateFee: spec?.waiveLateFee === true
  };
  // The waiver rides the leg that settles the target bill (see
  // waiverLegFor above).
  const waiverLeg = shared.waiveLateFee ? waiverLegFor(state, customerId, month, cleaned, referenceDate) : null;
  // The overpayment choice and the excess-cash note describe the
  // extra over the dues of the COMBINED tender, so they ride the
  // last leg with the dues still outstanding after leg 1 — the
  // recorder's own extra is then exactly the combined extra
  // (last-leg amount minus remaining dues). The remaining dues can
  // go negative when leg 1 alone already exceeds the dues; the
  // validators only use the dues for that check and never store
  // them, so the arithmetic stays exact.
  const leg1Cents = Math.round(Number(cleaned[0].amount) * 100);
  const remainingDuesCents = (dues) => (Number.isFinite(Number(dues)) ? Math.round(Number(dues)) - leg1Cents : undefined);
  const leg2OverpaymentDuesCents = spec?.overpaymentChoice ? remainingDuesCents(spec?.overpaymentDuesCents) : undefined;
  const leg2ExcessCashDuesCents = spec?.excessCashNote ? remainingDuesCents(spec?.excessCashDuesCents) : undefined;
  // Field-level pre-validation through the real payment sanitizer, with
  // the same field set executeQuickCollection hands to addPayment. The
  // fallback date mirrors the recorder's own default (Pakistan-local
  // today — the same Intl computation as nav-quick-collect's
  // getPakistanLocalDate, mirrored here to keep this module cycle-free).
  const pDate = date || undefined;
  const fallbackDate = (() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(referenceDate);
    const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${p.year}-${p.month}-${p.day}`;
  })();
  for (const [index, leg] of cleaned.entries()) {
    validatePayment({
      date: pDate ?? fallbackDate,
      amount: leg.amount,
      method: leg.method,
      paidBy: paidBy ? String(paidBy).trim() : undefined,
      // Sharafat 1: the shared collection fields ride every leg —
      // the per-leg call mirrors exactly what the recorder will pass
      // to addPayment for that leg (see legFields in
      // executeSplitTenderCollection).
      collectedBy: shared.collectedBy || undefined,
      collectionPlace: shared.collectionPlace || undefined,
      collectionMohalla: shared.collectionMohalla || undefined,
      urduNote: shared.urduNote || undefined,
      categoryTag: shared.categoryTag || undefined,
      promiseLink: shared.promiseLink || undefined,
      transactionId: leg.transactionId || undefined,
      senderTitle: leg.senderTitle || undefined,
      senderDigits: leg.senderDigits || undefined,
      referenceOverrideReason: leg.referenceOverrideReason || undefined,
      screenshot: leg.screenshot,
      // Sharafat 1: the choice / excess note ride the LAST leg only,
      // with the dues still outstanding after leg 1 (see above) —
      // the first leg's call carries neither, exactly as its
      // recording will not.
      ...(index === cleaned.length - 1 && spec?.overpaymentChoice ? { overpaymentChoice: spec.overpaymentChoice, overpaymentDuesCents: leg2OverpaymentDuesCents } : {}),
      ...(index === cleaned.length - 1 && spec?.excessCashNote ? { excessCashNote: spec.excessCashNote, excessCashDuesCents: leg2ExcessCashDuesCents } : {})
    }, referenceDate, {
      strictDigitalReference: spec?.strictDigitalReference,
      enforceDigitalReference: spec?.enforceDigitalReference
    });
  }
  return {
    customerId,
    month: month || undefined,
    date: pDate,
    paidBy: paidBy ? String(paidBy).trim() : '',
    legs: cleaned,
    // Sharafat 1: the threaded form-level fields, the leg the waiver
    // rides, and the last leg's remaining dues (see above).
    shared,
    waiverLeg,
    leg2OverpaymentDuesCents,
    leg2ExcessCashDuesCents,
    overpaymentChoice: spec?.overpaymentChoice,
    excessCashNote: spec?.excessCashNote,
    remainderWaadaDate: spec?.remainderWaadaDate,
    totalAmount: Math.round(cleaned.reduce((sum, leg) => sum + centsOf(leg.amount), 0)) / 100
  };
}

/** Stamps the split link onto the two recorded payments (immutable). */
function stampSplitLegs(state, customerId, month, groupId, paymentIds) {
  return {
    ...state,
    customers: (state.customers ?? []).map(c => {
      if (c.id !== customerId) return c;
      return {
        ...c,
        bills: (c.bills ?? []).map(b => {
          if (b.month !== month) return b;
          let touched = false;
          const payments = (b.payments ?? []).map(p => {
            const legIndex = paymentIds.indexOf(p.id);
            if (legIndex < 0) return p;
            touched = true;
            return { ...p, splitGroupId: groupId, splitLeg: legIndex + 1 };
          });
          return touched ? { ...b, payments } : b;
        })
      };
    })
  };
}

/**
 * Records a split tender: validates both legs, then records leg 1 and
 * leg 2 through the injected recorder (executeQuickCollection) exactly
 * as two sequential collections — FIFO allocation, waada clearing,
 * ticket-charge settlement (threaded: leg 2 receives leg 1's settled
 * ticket list), auto-package follow, all unchanged. Both legs share
 * the same date/month/paidBy and the same collection note, category
 * tag and promise link (Sharafat 1); each keeps its own method + TID,
 * and the last leg also carries the overpayment choice, the
 * excess-cash note and the remainder-waada date, while the leg that
 * settles the target bill carries a ticked late-fee waiver.
 *
 * All-or-nothing at the ledger level: the input state is never
 * mutated, and if leg 2 fails the leg-1 state is DISCARDED (the
 * caller never receives it), so no half-split can be saved.
 *
 * @returns {{ nextState, receipts: [object, object], nextTickets,
 *   splitGroupId, combinedReceipt }}
 */
export function executeSplitTenderCollection(state, spec, { execute, referenceDate = new Date() } = {}) {
  if (typeof execute !== 'function') throw new Error('A payment executor is required.');
  const clean = validateSplitTender(state, spec, referenceDate);
  const groupId = newSplitGroupId();
  const shared = {
    customerId: clean.customerId,
    month: clean.month,
    date: clean.date,
    paidBy: clean.paidBy || undefined,
    strictDigitalReference: spec?.strictDigitalReference,
    enforceDigitalReference: spec?.enforceDigitalReference,
    // Sharafat 1: the collection note, the category tag and the
    // promise link ride BOTH legs — they describe the collection,
    // not one leg — so each leg's record is indistinguishable from
    // a normal single payment carrying them, and the Transactions
    // rows show them on either leg.
    collectedBy: clean.shared.collectedBy || undefined,
    collectionPlace: clean.shared.collectionPlace || undefined,
    collectionMohalla: clean.shared.collectionMohalla || undefined,
    urduNote: clean.shared.urduNote || undefined,
    categoryTag: clean.shared.categoryTag || undefined,
    promiseLink: clean.shared.promiseLink || undefined
  };
  const legFields = (leg, index) => {
    const legNo = index + 1;
    return {
      ...shared,
      amount: leg.amount,
      method: leg.method,
      transactionId: leg.transactionId || undefined,
      // FU-SISP121-SENDER: the recorder (executeQuickCollection) already
      // accepts senderTitle/senderDigits and stamps them via addPayment —
      // the split spec now carries them per leg, so a digital leg's
      // recorded payment is indistinguishable in shape from a normal
      // digital payment and SISP-63 statement matching works on it
      // unchanged (the matcher reads the record fields directly).
      senderTitle: leg.senderTitle || undefined,
      senderDigits: leg.senderDigits || undefined,
      referenceOverrideReason: leg.referenceOverrideReason || undefined,
      screenshot: leg.screenshot,
      // Sharafat 1: the waiver rides the leg that settles the target
      // bill (decided in validation); the recorder's own gate
      // decides there whether it is honoured or the whole split is
      // refused loudly — never dropped silently.
      ...(clean.shared.waiveLateFee && clean.waiverLeg === legNo ? { waiveLateFee: true } : {}),
      // Sharafat 1: the overpayment choice, the excess-cash note and
      // the remainder-waada date ride the LAST leg only — the extra
      // and the remainder exist only once the whole tender is in.
      // The choice / note carry the dues still outstanding after
      // leg 1, so the recorder's extra is exactly the combined extra.
      ...(legNo === clean.legs.length && clean.overpaymentChoice ? { overpaymentChoice: clean.overpaymentChoice, overpaymentDuesCents: clean.leg2OverpaymentDuesCents } : {}),
      ...(legNo === clean.legs.length && clean.excessCashNote ? { excessCashNote: clean.excessCashNote, excessCashDuesCents: clean.leg2ExcessCashDuesCents } : {}),
      ...(legNo === clean.legs.length && clean.remainderWaadaDate ? { remainderWaadaDate: clean.remainderWaadaDate } : {})
    };
  };

  const first = execute(state, { ...legFields(clean.legs[0], 0), tickets: spec?.tickets }, referenceDate);
  let second;
  try {
    second = execute(first.nextState, {
      ...legFields(clean.legs[1], 1),
      tickets: first.nextTickets ?? spec?.tickets
    }, referenceDate);
  } catch (error) {
    // The leg-1 result lives only in first.nextState, which is dropped
    // here — the saved ledger never sees either leg.
    throw new Error(`Split payment was NOT saved: leg 2 (${clean.legs[1].method} ${clean.legs[1].amount}) failed — ${error.message} Nothing was recorded; no part of the split reached the ledger.`);
  }

  const month = second.receipt.month;
  const stamped = stampSplitLegs(second.nextState, clean.customerId, month, groupId, [
    first.receipt.paymentId,
    second.receipt.paymentId
  ]);
  // The stamp must land on BOTH records — if a payment id cannot be
  // found, the records and the link disagree, so refuse the whole
  // split rather than save an unlinked half.
  const check = splitPaymentsOf(stamped, clean.customerId, groupId);
  if (check.length !== SPLIT_TENDER_LEG_COUNT) {
    throw new Error('Split payment was NOT saved: the split link could not be stamped on both payments. Nothing was recorded.');
  }

  return {
    nextState: stamped,
    receipts: [first.receipt, second.receipt],
    nextTickets: second.nextTickets ?? first.nextTickets,
    splitGroupId: groupId,
    combinedReceipt: buildSplitTenderReceipt(stamped, clean.customerId, groupId)
  };
}

/**
 * Finds the recorded legs of one split group for a customer, in leg
 * order: [{ leg, payment, bill }]. Searches every bill — the two legs
 * are recorded against the same month, but the group id is the link,
 * not the month.
 */
export function splitPaymentsOf(state, customerId, groupId) {
  const customer = (state && Array.isArray(state.customers) ? state.customers : []).find(c => c.id === customerId);
  if (!customer || !groupId) return [];
  const found = [];
  for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
    for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
      const split = splitTenderOf(payment);
      if (split && split.groupId === groupId) found.push({ leg: split.leg, payment, bill });
    }
  }
  return found.sort((a, b) => a.leg - b.leg);
}

/**
 * Builds the ONE combined receipt for a split group from the SAVED
 * records — per-leg lines carry each leg's REAL permanent receipt
 * number (buildPaymentReceipt), method, amount and TID; no combined
 * receipt number is ever fabricated. Voided legs stay listed, marked
 * voided, and are excluded from the total (SISP-34 rule). The balance
 * is the allocation engine's live total dues across the customer's
 * bills, so a reprint always reflects the ledger as saved NOW.
 */
export function buildSplitTenderReceipt(state, customerId, groupId) {
  const customer = (state && Array.isArray(state.customers) ? state.customers : []).find(c => c.id === customerId);
  if (!customer) throw new Error(`Customer ${customerId} not found.`);
  const entries = splitPaymentsOf(state, customerId, groupId);
  if (!entries.length) throw new Error('No split payment found for this group.');

  const allocations = calculatePaymentAllocations(state);
  let totalDuesCents = 0;
  for (const bill of (customer.bills ?? [])) {
    const summary = allocations.forMonth(customerId, bill.month);
    if (summary?.balanceDueCents && summary.balanceDueCents > 0) totalDuesCents += summary.balanceDueCents;
  }

  const legTaxes = [];
  const legs = entries.map(({ leg, payment, bill }) => {
    const receipt = buildPaymentReceipt(customer, bill, payment);
    // Plan 557: the tax on the bill this leg settled, read off the
    // leg's own receipt — never recomputed. Carried alongside the leg
    // so the combined tax below is derived from the legs' receipts.
    legTaxes.push({ month: bill.month, salesTaxCents: receipt.salesTaxCents ?? null });
    return {
      leg,
      paymentId: payment.id,
      receiptNumber: receipt.permanentReceiptNumber || receipt.receiptNumber,
      method: receipt.paymentMethod || payment.method || '',
      amount: moneyOf(payment.amount),
      transactionId: receipt.transactionId || '',
      date: receipt.paymentDate || payment.date || '',
      voided: isVoidedPayment(payment),
      // Plan 559: the sender proof and payer name the leg's own
      // receipt already computes (SISP-63 senderLabel, Plan 378
      // paidBy) — carried onto the leg so the combined surfaces can
      // identify who paid each leg and whose account sent it. ''
      // when absent, so legs without either render exactly as before.
      senderLabel: receipt.senderLabel || '',
      paidBy: receipt.paidBy || ''
    };
  });
  const liveLegs = legs.filter(leg => !leg.voided);
  const totalReceivedCents = liveLegs.reduce((sum, leg) => sum + centsOf(leg.amount), 0);
  const firstReceipt = buildPaymentReceipt(customer, entries[0].bill, entries[0].payment);
  // Plan 557: the combined tax line is the tax on the bill(s) the legs
  // settled, summed over DISTINCT bills — never recomputed. Both legs
  // of a normal split settle the SAME bill, so each leg receipt carries
  // the same salesTaxCents; a naive sum across legs would print double
  // tax (PKR 390 for a PKR 195 bill tax). Null when no leg's bill
  // carries tax, so untaxed splits show no line, never PKR 0.
  const salesTaxByBill = new Map();
  for (const { month, salesTaxCents } of legTaxes) {
    if (salesTaxByBill.has(month)) continue;
    if (typeof salesTaxCents !== 'number' || !Number.isFinite(salesTaxCents) || salesTaxCents <= 0) continue;
    salesTaxByBill.set(month, salesTaxCents);
  }
  const combinedSalesTaxCents = [...salesTaxByBill.values()].reduce((sum, cents) => sum + cents, 0);

  // Sharafat 1: the form-level fields the legs carry, read off the
  // SAVED records — the combined receipt shows what the ledger
  // actually recorded, never the form's intent. The note, the tag
  // and the promise are identical on both legs by construction, so
  // they read off leg 1; the waiver, the overpayment choice, the
  // excess note and the remainder waada live on exactly one leg, so
  // they read off whichever leg carries each one. Every reader is
  // the defensive one the Transactions rows already use, so a
  // damaged record reads as no field, never as a wrong one.
  const firstLegPayment = entries[0].payment;
  const waiverEntry = entries.find(({ payment }) => lateFeeWaiverOf(payment) !== null);
  const waiver = waiverEntry ? lateFeeWaiverOf(waiverEntry.payment) : null;
  const choiceEntry = entries.find(({ payment }) => overpaymentChoiceOf(payment) !== null);
  const excessEntry = entries.find(({ payment }) => excessCashNoteOf(payment) !== null);
  const remainderWaadaEntry = entries.find(({ payment }) => remainderWaadaOf(payment) !== null);

  return {
    splitGroupId: groupId,
    customerId: String(customer.customerNumber ?? ''),
    customerNumber: customer.customerNumber,
    customerName: firstReceipt.customerName,
    customerNameUrdu: firstReceipt.customerNameUrdu,
    phone: customer.phone || '',
    // Polish 4: same display alignment as the ordinary receipt — the
    // profile area (mohalla) first, the legacy area field as fallback.
    area: customer.mohalla || customer.area || 'Unassigned',
    month: entries[0].bill.month,
    date: legs[0]?.date || '',
    package: firstReceipt.package,
    // Plan 557: the bill tax, in integer cents (null when untaxed —
    // the combined surfaces print no tax line then, never PKR 0).
    // Every combined surface reads it from here.
    salesTaxCents: combinedSalesTaxCents > 0 ? combinedSalesTaxCents : null,
    // Sharafat 1: the collection note, the Urdu-script note, the
    // category tag and the promise link — '' / null when the split
    // carries none, so a split without them renders exactly as
    // before. The waiver (bool + rupees), the overpayment choice,
    // the excess note and the remainder waada read off the leg that
    // carries each one.
    collectedBy: String(firstLegPayment.collectedBy ?? '').trim(),
    collectionPlace: normalizeCollectionPlace(firstLegPayment.collectionPlace),
    collectionMohalla: String(firstLegPayment.collectionMohalla ?? '').trim(),
    urduNote: String(firstLegPayment.urduNote ?? '').trim(),
    categoryTag: normalizeTransactionCategoryTag(firstLegPayment.categoryTag) || '',
    promiseLink: promisePaymentLinkOf(firstLegPayment),
    lateFeeWaived: waiver !== null,
    waivedAmount: waiver ? waiver.waivedAmount : 0,
    overpaymentChoice: choiceEntry ? overpaymentChoiceOf(choiceEntry.payment) : null,
    excessCashNote: excessEntry ? excessCashNoteOf(excessEntry.payment) : null,
    remainderWaada: remainderWaadaEntry ? remainderWaadaOf(remainderWaadaEntry.payment) : null,
    legs,
    totalReceivedCents,
    totalReceived: totalReceivedCents / 100,
    balanceDueCents: totalDuesCents,
    status: legs.every(leg => leg.voided) ? 'VOID' : (totalDuesCents <= 0 ? 'PAID' : 'PARTIAL')
  };
}

// Plan 555: the ONE shared receipt money format (receipt-money.js,
// modelled on formatPKR in core.js) — en-PK min-0/max-2, so 292.5
// prints as PKR 292.50 everywhere, and a missing figure renders as
// "—", never an invented PKR 0.
const formatAmount = (value) => formatReceiptMoney(value);

/**
 * Polish #14: the area line on the combined receipt. The combined
 * object already carries `area` (mohalla first, legacy area second,
 * 'Unassigned' when neither is set), so the render sites only translate
 * the builder's placeholder into the receipt convention 'Not recorded'
 * (polish #12) — never a blank, never a guessed mohalla.
 */
function splitAreaDisplay(area) {
  const value = String(area ?? '').trim();
  return value && value !== 'Unassigned' ? value : 'Not recorded';
}

// Plan 557: the package line shows the package the legs settled
// (firstReceipt.package, carried on the combined object). Empty when
// the bill carries no package, so unpackaged splits show no line.
// The combined object may also be hand-built (see the Plan 557 pin
// test), so the field is read defensively here.
function splitPackageDisplay(combined) {
  const value = typeof combined?.package === 'string' ? combined.package.trim() : '';
  return value;
}

// Plan 560: each leg's VER stamp, re-derived from the leg's own
// receipt facts — the receipt.js:688 pattern (re-derive from a
// hand-built receipt's own fields), so the split sheet carries exactly
// the code the leg's own receipt carries. '' when the leg has no
// receipt number, so hand-built legs without one render exactly as
// before. The derivation is deterministic — same facts, same code on
// every device — never recomputed from a rate.
function splitLegVerificationStamp(leg, customerId) {
  const code = receiptCodeForReceipt({
    receiptNumber: leg?.receiptNumber,
    customerId,
    paidAmount: leg?.amount,
    paymentDate: leg?.date
  });
  return verificationStampText(code);
}

// Plan 557: the combined tax in integer cents — the bill tax, read
// off the legs' receipts and summed over distinct bills by the
// builder (never recomputed). 0 when the split is untaxed, so the
// surfaces print no tax line then, never PKR 0.
function splitSalesTaxCents(combined) {
  const cents = Number(combined?.salesTaxCents);
  return Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0;
}

// Sharafat 1: the collection fields the split recorded, in plain
// words — the same lines the Transactions rows already print for a
// single payment, read through the same defensive readers, so a
// combined object without a field yields '' for it and renders
// exactly as before. The promise line names the COMBINED tender as
// the fulfilling payment (its total, its date), because the promise
// is fulfilled by the split as a whole, not by one leg alone. The
// remainder-waada line is the single receipt's own wording
// ("Baqi Rs. X • Waada: YYYY-MM-DD"). All values are unescaped —
// callers that put them in HTML must escape them.
function splitCollectionFields(combined) {
  if (!combined || typeof combined !== 'object') {
    return { collectionNote: '', urduNote: '', category: '', promise: '', choice: '', excess: '', waivedAmount: 0, remainderWaada: null };
  }
  const remainderWaada = remainderWaadaOf(combined);
  return {
    collectionNote: collectionNoteLineText(collectionNoteOf(combined)),
    urduNote: urduNoteLineText(combined.urduNote || ''),
    category: categoryTagLineText(combined),
    promise: combined.promiseLink
      ? promisePaymentLinkLineText(combined.promiseLink, { amount: combined.totalReceived, date: combined.date })
      : '',
    choice: overpaymentChoiceLineText(combined.overpaymentChoice),
    excess: excessCashNoteLineText(combined.excessCashNote),
    waivedAmount: Number(combined.waivedAmount) > 0 ? Number(combined.waivedAmount) : 0,
    remainderWaada
  };
}

function splitRemainderWaadaLine(combined) {
  const stamp = splitCollectionFields(combined).remainderWaada;
  if (!stamp) return '';
  return `Baqi Rs. ${formatReceiptMoneyFigure(stamp.promiseAmount)} • Waada: ${stamp.promiseDate}`;
}

/** WhatsApp / plain-text combined receipt (house receipt text style). */
export function formatSplitTenderWhatsAppText(combined) {
  const legLines = combined.legs.map(leg => {
    const tid = leg.transactionId ? ` · TID ${leg.transactionId}` : '';
    const voided = leg.voided ? ` (${t('split_voided_leg')})` : '';
    // Plan 559: who paid this leg and whose account sent it — the
    // leg's own sender proof (SISP-63) and payer name (Plan 378),
    // only when present, so legs without either read exactly as
    // before. Appended to the leg line (same ' · ' grammar) so each
    // leg stays one identifiable block.
    const sender = leg.senderLabel ? ` · Sender / بھیجنے والا: ${leg.senderLabel}` : '';
    const paidBy = leg.paidBy ? ` · Paid by / ادا کنندہ: ${leg.paidBy}` : '';
    return `${t('split_leg_label', null, { leg: leg.leg })}: ${leg.method} — ${formatAmount(leg.amount)}${tid} · ${t('split_receipt_no')}: ${leg.receiptNumber}${voided}${sender}${paidBy}`;
  });
  // Plan 557: the package the legs settled, then the bill tax — in
  // the same field order as the single receipt, so the two surfaces
  // read alike. No package line when the bill carries no package,
  // no tax line when the split is untaxed.
  const splitPackage = splitPackageDisplay(combined);
  const taxCents = splitSalesTaxCents(combined);
  // Sharafat 1: the collection fields the split recorded, each only
  // when the split carries it — a split without them reads exactly
  // as before. The remainder waada reads beside the balance below,
  // like the single receipt.
  const fields = splitCollectionFields(combined);
  const splitRemainderWaada = splitRemainderWaadaLine(combined);
  // Plan 559: the status line is bilingual for every status, the
  // same pattern as the PAID line — the raw code ('PARTIAL', 'VOID')
  // never reaches the customer. The Urdu words are the app's own
  // dictionary values (status_partial 'جزوی ادا شدہ',
  // split_voided_leg 'منسوخ'). An unknown status falls through to
  // the raw value, exactly as before.
  const splitStatusText = combined.status === 'PAID' ? 'Paid in Full / مکمل ادا شدہ'
    : combined.status === 'PARTIAL' ? 'Partially Paid / جزوی ادا شدہ'
    : combined.status === 'VOID' ? 'Void / منسوخ'
    : combined.status;
  const lines = [
    '*SHAHDARA FIBER NETWORK & ISP BILLING*',
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    `*${t('split_receipt_title')}*`,
    '',
    `👤 *Customer:* ${combined.customerName} (#${combined.customerNumber})`,
    `📍 *Area:* ${splitAreaDisplay(combined.area)}`,
    `🗓️ *Billing Month:* ${combined.month}`,
    `📅 *Date:* ${combined.date}`,
    ...(splitPackage ? [`📦 *Package / پیکیج:* ${splitPackage}`] : []),
    ...(taxCents > 0 ? [`🧾 *${SALES_TAX_RECEIPT_LABEL}:* ${formatAmount(taxCents / 100)}`] : []),
    '',
    ...legLines,
    // Sharafat 1: the collection block — who collected it and where,
    // the Urdu-script note, the category tag, the promise this split
    // fulfils, the waived fee, and the extra's disposition — each
    // only when the split carries it.
    ...(fields.collectionNote ? [`🧾 *Collection / وصولی:* ${fields.collectionNote}`] : []),
    ...(fields.urduNote ? [`📝 *Note / نوٹ:* ${fields.urduNote}`] : []),
    ...(fields.category ? [`🏷️ *Category / زمرہ:* ${fields.category}`] : []),
    ...(fields.promise ? [`🤝 *${fields.promise}*`] : []),
    ...(fields.waivedAmount > 0 ? [`🎟️ *${t('lfw_whatsapp', null, { amount: formatAmount(fields.waivedAmount) })}*`] : []),
    ...(fields.choice ? [`🪙 *${fields.choice}*`] : []),
    ...(fields.excess ? [`🪙 *${fields.excess}*`] : []),
    '',
    `💵 *${t('split_total_received')}:* ${formatAmount(combined.totalReceived)}`,
    `⚖️ *${t('split_balance_due')}:* ${formatAmount(combined.balanceDueCents / 100)}`,
    ...(splitRemainderWaada ? [`🤝 *${splitRemainderWaada}*`] : []),
    `📌 *Status:* ${splitStatusText}`,
    '',
    'Shukriya! Thank you for your prompt payment.',
    '',
    receiptTermsNoteText(),
    '━━━━━━━━━━━━━━━━━━━━━━━━'
  ];
  return lines.join('\n');
}

/**
 * Printable combined receipt sheet (receipt.js CSS classes, so the
 * existing print styles apply). One sheet lists both legs with their
 * real receipt numbers — there is deliberately no combined number.
 */
export function generateSplitTenderReceiptHtml(combined, {
  businessName = 'Shahdara ISP',
  businessPhone = '0300-1234567',
  areaName = 'Shahdara, Islamabad',
  // Plan 560: the owner-configured studio footer, like the other
  // generators (receipt.js, buildDownPaymentKistReceiptHtml). Null
  // when unconfigured — the sheet then renders no footer block.
  receiptFooter = null
} = {}) {
  if (!combined) return '';
  const displayName = combined.customerNameUrdu && combined.customerNameUrdu !== combined.customerName
    ? `${combined.customerNameUrdu} (${combined.customerName})`
    : combined.customerName;
  const statusClass = combined.status === 'PAID' ? 'receipt-status-paid' : combined.status === 'PARTIAL' ? 'receipt-status-partial' : '';
  // Plan 557: the package the legs settled and the bill tax, in the
  // same field order as the single receipt (receipt.js). No package
  // row when the bill carries no package, no tax row when untaxed.
  const splitPackage = splitPackageDisplay(combined);
  const taxCents = splitSalesTaxCents(combined);
  // Plan 560: the shared footer (thank-you + studio footer block).
  // Called with no thank-you, so with nothing configured it returns
  // '' and the unconfigured sheet is byte-identical below the terms
  // note; the footer block appears only when a studio footer is set.
  const splitFooter = documentFooterHtml(receiptFooter);
  // Plan 559: each TID row carries its leg (same t('split_leg_label')
  // pattern as the receipt-number row), and each leg shows its sender
  // proof and payer name when present — the single receipt's labels
  // ('Sender / بھیجنے والا', 'Paid by / ادا کنندہ', payer right after
  // sender), only when present, so legs without either read exactly
  // as before. Voided legs keep their rows (they stay listed).
  const legRows = combined.legs.map(leg => {
    // Plan 560: this leg's VER stamp (re-derived from the leg's own
    // receipt facts), qualified with the leg label — the Plan 559 TID
    // pattern — so two digital legs have distinguishable stamps, each
    // independently verifiable. No row when the leg carries no receipt
    // number, so hand-built legs without one render exactly as before.
    const legVerStamp = splitLegVerificationStamp(leg, combined.customerId);
    return `
    <div class="receipt-field"><dt>${escapeHtml(t('split_leg_label', null, { leg: leg.leg }))} — ${escapeHtml(leg.method)}:</dt><dd>${formatAmount(leg.amount)}${leg.voided ? ` (${escapeHtml(t('split_voided_leg'))})` : ''}</dd></div>
    <div class="receipt-field"><dt>${escapeHtml(t('split_receipt_no'))} (${escapeHtml(t('split_leg_label', null, { leg: leg.leg }))}):</dt><dd>${escapeHtml(leg.receiptNumber)}</dd></div>
    ${leg.transactionId ? `<div class="receipt-field"><dt>Transaction ID (${escapeHtml(t('split_leg_label', null, { leg: leg.leg }))}):</dt><dd>${escapeHtml(leg.transactionId)}</dd></div>` : ''}
    ${leg.senderLabel ? `<div class="receipt-field"><dt>Sender / بھیجنے والا:</dt><dd>${escapeHtml(leg.senderLabel)}</dd></div>` : ''}
    ${leg.paidBy ? `<div class="receipt-field"><dt>Paid by / ادا کنندہ:</dt><dd>${escapeHtml(leg.paidBy)}</dd></div>` : ''}
    ${legVerStamp ? `<div class="receipt-field"><dt>Verify (${escapeHtml(t('split_leg_label', null, { leg: leg.leg }))}) / تصدیق:</dt><dd><strong>${escapeHtml(legVerStamp)}</strong></dd></div>` : ''}`;
  }).join('');
  // Sharafat 1: the collection rows — the same plain-words lines the
  // WhatsApp text uses, escaped like every other row, each only
  // when the split carries it, so a split without them renders
  // exactly as before.
  const fields = splitCollectionFields(combined);
  const splitRemainderWaada = splitRemainderWaadaLine(combined);
  const splitCollectionRows = [
    ...(fields.collectionNote ? [`<div class="receipt-field"><dt>Collection / وصولی:</dt><dd>${escapeHtml(fields.collectionNote)}</dd></div>`] : []),
    ...(fields.urduNote ? [`<div class="receipt-field"><dt>Note / نوٹ:</dt><dd dir="rtl" lang="ur">${escapeHtml(fields.urduNote)}</dd></div>`] : []),
    ...(fields.category ? [`<div class="receipt-field"><dt>Category / زمرہ:</dt><dd>${escapeHtml(fields.category)}</dd></div>`] : []),
    ...(fields.promise ? [`<div class="receipt-field"><dt>Promise / وعدہ:</dt><dd>${escapeHtml(fields.promise)}</dd></div>`] : []),
    ...(fields.waivedAmount > 0 ? [`<div class="receipt-field"><dt>Late Fee Waived / لیٹ فیس معاف:</dt><dd>-${escapeHtml(formatAmount(fields.waivedAmount))}</dd></div>`] : []),
    ...(fields.choice ? [`<div class="receipt-field"><dt>Extra / اضافی:</dt><dd>${escapeHtml(fields.choice)}</dd></div>`] : []),
    ...(fields.excess ? [`<div class="receipt-field"><dt>Extra / اضافی:</dt><dd>${escapeHtml(fields.excess)}</dd></div>`] : []),
    ...(splitRemainderWaada ? [`<div class="receipt-field"><dt>Waada / وعدہ:</dt><dd>${escapeHtml(splitRemainderWaada)}</dd></div>`] : [])
  ].join('');
  return `<article class="receipt-sheet a4-receipt split-tender-receipt" data-receipt-format="a4">
  <header class="receipt-head">
    ${brandHeaderContentHtml({ businessName, businessPhone, areaName }, {
    // Plan 560: the shared A4 header — the same builder and the same
    // metaPrefix the main A4 receipt uses, so the meta line reads
    // "Tel:" (the canonical label; "Phone:" is retired) and the sheet
    // no longer looks like it came from a different business. The
    // title is passed as explicit overrides (t('split_receipt_title')
    // + the 'رسید ادائیگی' the old h1 already printed), NOT as a new
    // DOCUMENT_TITLES entry, so the rendered title is byte-identical
    // to before in every language mode. No combined number — there is
    // deliberately no combined receipt number, so no number line.
    titleEn: t('split_receipt_title'), titleUr: 'رسید ادائیگی',
    metaPrefix: 'Official Customer Record', variant: 'a4'
  })}
    <span class="receipt-mark ${statusClass}">${escapeHtml(combined.status)}</span>
  </header>
  <dl class="receipt-fields">
    <div class="receipt-field"><dt>Customer Name / صارف کا نام:</dt><dd>${escapeHtml(displayName)}</dd></div>
    <div class="receipt-field"><dt>Area / علاقہ:</dt><dd>${escapeHtml(splitAreaDisplay(combined.area))}</dd></div>
    <div class="receipt-field"><dt>Account / Customer ID:</dt><dd>#${escapeHtml(combined.customerId)}</dd></div>
    <div class="receipt-field"><dt>Billing Month / بل کا مہینہ:</dt><dd>${escapeHtml(combined.month)}</dd></div>
    <div class="receipt-field"><dt>Payment Date / تاریخ ادائیگی:</dt><dd>${escapeHtml(combined.date)}</dd></div>
    ${splitPackage ? `<div class="receipt-field"><dt>Package / پیکیج:</dt><dd>${escapeHtml(splitPackage)}</dd></div>` : ''}
    ${taxCents > 0 ? `<div class="receipt-field"><dt>${escapeHtml(SALES_TAX_RECEIPT_LABEL)}:</dt><dd>+${formatAmount(taxCents / 100)}</dd></div>` : ''}
    ${legRows}
    ${splitCollectionRows}
    <div class="receipt-field receipt-paid-field"><dt><strong>${escapeHtml(t('split_total_received'))}:</strong></dt><dd><strong>${formatAmount(combined.totalReceived)}</strong></dd></div>
    <div class="receipt-field receipt-balance-field"><dt><strong>${escapeHtml(t('split_balance_due'))}:</strong></dt><dd class="${statusClass}"><strong>${formatAmount(combined.balanceDueCents / 100)}</strong></dd></div>
  </dl>
  <div class="receipt-urdu-notice" dir="rtl" lang="ur">
    <strong>اہم معلوماتی نوٹ:</strong> ${escapeHtml(RECEIPT_URDU_NOTE)}
  </div>
  ${receiptTermsNoteHtml()}
  ${splitFooter ? `<footer class="receipt-terms">
    ${splitFooter}
  </footer>` : ''}
</article>`;
}

/**
 * Badge for one split leg on payment rows (profile history +
 * Transactions), mirroring payment-void-audit's voidBadgeMarkup.
 * Empty string for ordinary payments, so non-split rows render
 * byte-identically to before.
 */
export function splitBadgeMarkup(payment) {
  const split = splitTenderOf(payment);
  if (!split) return '';
  return `<span class="split-badge">${escapeHtml(t('split_badge', null, { leg: split.leg }))}</span>`;
}

/**
 * Quick Collect success-step card for a combined split receipt —
 * same qc-receipt-* classes as renderQuickCollectReceiptCardHtml, so
 * the existing styles (and print behaviour) apply unchanged. Shows the
 * total received, BOTH legs with their real receipt numbers, and the
 * remaining balance. When the caller passes the Area select markup
 * (polish 6, part B — the same select the ordinary card uses), the
 * Area row shows that select instead of plain text; without it the
 * row stays plain text, exactly as before.
 */
export function renderSplitReceiptCardHtml(combined, areaSelectHtml = '', { nextDueDateText, chargesPending } = {}) {
  if (!combined) return '';
  const remaining = combined.balanceDueCents / 100;
  const legRows = combined.legs.map(leg => `
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">${escapeHtml(t('split_leg_label', null, { leg: leg.leg }))} · ${escapeHtml(leg.method)}${leg.voided ? ` (${escapeHtml(t('split_voided_leg'))})` : ''}</span>
          <strong class="qc-meta-val">PKR ${Number(leg.amount).toLocaleString('en-PK')} · ${escapeHtml(leg.receiptNumber)}${leg.transactionId ? ` · TID ${escapeHtml(leg.transactionId)}` : ''}</strong>
        </div>`).join('');
  // Sharafat 1: the waived-fee and remainder-waada rows, in the single
  // card's exact shape (same labels, same dictionary keys) — each
  // only when the split carries it, so the ordinary card renders
  // exactly as before.
  const splitRemainderWaada = splitRemainderWaadaLine(combined);
  const splitCardExtraRows = [
    ...(splitRemainderWaada ? [`
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">${escapeHtml(t('remwaada_receipt_label'))}</span>
          <strong class="qc-meta-val">🤝 ${escapeHtml(splitRemainderWaada)}</strong>
        </div>`] : []),
    ...(Number(combined.waivedAmount) > 0 ? [`
        <div class="qc-receipt-item full-width">
          <span class="qc-meta-label">Late Fee</span>
          <strong class="qc-meta-val">🎟️ ${escapeHtml(t('lfw_card', null, { amount: `PKR ${formatReceiptMoneyFigure(combined.waivedAmount)}` }))}</strong>
        </div>`] : [])
  ].join('');
  return `
    <div class="qc-receipt-card" role="region" aria-label="Split Payment Receipt Slip">
      <div class="qc-receipt-header">
        <!-- Polish 21 (Req 6): the settle/partial badge moved out of the
             card header — and the QC receipt-modal overhaul removed it
             entirely (the merged Still-owed row + the still-owes pill
             state the settled/partial state now) — so the header keeps
             only the receipt id, on one line. -->
        <span class="qc-receipt-id">${escapeHtml(t('split_receipt_title'))}</span>
      </div>

      <div class="qc-receipt-amount-row">
        <span class="qc-receipt-label">${escapeHtml(t('split_total_received'))}</span>
        <strong class="qc-receipt-amount">PKR ${Number(combined.totalReceived).toLocaleString('en-PK')}</strong>
      </div>

      <div class="qc-receipt-grid">
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Customer</span>
          <strong class="qc-meta-val">${escapeHtml(combined.customerName)} (#${escapeHtml(String(combined.customerNumber))})</strong>
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Area / Location</span>
          ${areaSelectHtml ? areaSelectHtml : `<strong class="qc-meta-val">${escapeHtml(combined.area)}</strong>`}
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">${escapeHtml(remaining > 0 && chargesPending ? SUCCESS_NEXT_STEPS_STILL_OWED_CHARGES_TEXT : SUCCESS_NEXT_STEPS_STILL_OWED_TEXT)}</span>
          <strong class="qc-meta-val ${remaining > 0 ? 'has-balance' : 'zero-balance'}">${remaining > 0 ? `PKR ${Number(remaining).toLocaleString('en-PK')}` : escapeHtml(SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT)}</strong>
        </div>
        <div class="qc-receipt-item">
          <span class="qc-meta-label">Next due date</span>
          <strong class="qc-meta-val">${escapeHtml(nextDueDateText || SUCCESS_NEXT_STEPS_NO_DUE_DATE_TEXT)}</strong>
        </div>
        ${legRows}
        ${splitCardExtraRows}
      </div>
      ${receiptTermsNoteHtml({ contactActions: true }).replace('class="receipt-urdu-notice"', 'class="receipt-urdu-notice qc-urdu-nastaliq qc-urdu-gradient"')}
    </div>
  `;
}
