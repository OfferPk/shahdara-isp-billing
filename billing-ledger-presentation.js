// Billing & Ledger redesign (2026-11-11) — presentation-only helpers
// for the profile Billing & Ledger tab. Pure: no storage, no DOM, no
// network, no clock. The helpers decide WHAT the redesign shows; the
// renderers in app.js decide WHERE it goes.
//
// - Payment-method groups (§3): which form fields a method shows,
//   and which submitted values survive when the operator switches
//   method mid-form (a Cash payment never carries a stale TID from
//   an earlier Digital attempt, and vice versa).
// - Filtered history summary + type legend (§1): figures over the
//   already-filtered shown rows, using the same signed-movement rule
//   the monthly grouping uses (charges + refunds billed; payments,
//   advances and adjustments paid; overpayment credit moves nothing;
//   adjustment credit paid; voided moves nothing).
// - Short entry reference (§2): a receipt-shaped ref prints whole;
//   internal ids (UUIDs, the makeId shape) stay hidden.
//
// Settlement rule (binding, §2.7): per-row settlement is the running
// balance after that entry (fullHistoryRunningNote); account
// settlement is the last entry's running balance; bill settlement is
// derivedBillStatus. Never derive one from another.
import { isDigitalPaymentMethod } from './core.js';
import { FULL_HISTORY_TYPE_LABELS, fullHistoryRunningNote } from './full-history-list.js';
import { formatMonthlyGroupingAmount, historyMonthlyGroupingTotals } from './history-monthly-grouping.js';

// A receipt-shaped reference: RCPT-<customer number>-<YYYYMM>-<seq>,
// the only entry reference the operator can read back. Anything
// else (UUIDs from makeId, blank, malformed) is an internal id.
const RECEIPT_REF_PATTERN = /^RCPT-\d+-\d{6}-\d+$/;

/** The form group a payment method belongs to: 'digital' for the
 *  wallet/bank methods, 'cash' for Cash, the four shop-cash methods,
 *  and a blank method (the form opens on the Cash group until a
 *  method is picked). */
export function paymentMethodGroup(method) {
  return isDigitalPaymentMethod(method) ? 'digital' : 'cash';
}

/** True when the operator actually chose a cross-payer: a customer
 *  picked in the select, or a payer name typed in the text field.
 *  An untouched third-party group (blank select, blank name) rides
 *  nothing, whatever the method. */
export function paymentFormCrossPayerChosen(crossPayment) {
  if (!crossPayment || typeof crossPayment !== 'object') return false;
  return Boolean(
    String(crossPayment.payerCustomerId ?? '').trim()
    || String(crossPayment.payerName ?? '').trim(),
  );
}

/**
 * Submit-time group filter (§3.3): drop the values whose group does
 * not match the chosen method, and drop an unchosen cross-payer
 * note. Hidden fields keep their DOM values while the operator
 * toggles (nothing is cleared on hide); the drop happens here, at
 * submit, so a mis-tap never loses a typed value and a saved payment
 * never carries a stale value from another group. The input object
 * is never mutated; fields that do not survive read as undefined,
 * the same "absent" shape addPayment already accepts. Always-visible
 * fields (amount, method, date, bill month, discount, category,
 * promise, Urdu note) always survive.
 */
export function filterPaymentFormFieldsForMethod(method, input) {
  const fields = { ...(input || {}) };
  const group = paymentMethodGroup(method);
  if (group === 'digital') {
    // A digital payment never carries Cash-group notes from an
    // earlier Cash attempt (paid-by, collected-by/place/mohalla,
    // large-cash approval — the validator needs none of it for a
    // non-cash method).
    fields.paidBy = undefined;
    fields.collectedBy = undefined;
    fields.collectionPlace = undefined;
    fields.collectionMohalla = undefined;
    fields.largeCashApproval = undefined;
  } else {
    // A cash payment never carries a TID, sender name/digits or
    // proof screenshot from an earlier Digital attempt.
    fields.transactionId = undefined;
    fields.senderTitle = undefined;
    fields.senderDigits = undefined;
    fields.screenshot = undefined;
  }
  if (!paymentFormCrossPayerChosen(fields.crossPayment)) {
    fields.crossPayment = undefined;
  }
  return fields;
}

// The owed wording, shared by the filtered summary and the legend:
// a negative still-owed is a credit month, never "Still owed -PKR X"
// (the same wording the monthly grouping table uses after §6.3).
export function historyOwedText(stillOwedCents) {
  const owed = Number(stillOwedCents);
  if (!Number.isFinite(owed) || owed >= 0) return `Still owed ${formatMonthlyGroupingAmount(owed || 0)}`;
  return `Credit ${formatMonthlyGroupingAmount(-owed)}`;
}

/**
 * Filtered summary headline (§1.4): totals over the shown rows only
 * — "N entries · Billed PKR X · Paid PKR Y · Still owed PKR Z".
 * When nothing is filtered the shown rows ARE the full history, so
 * the line equals the monthly table's Totals footer by construction.
 * The first summary line (full-history account figure) is untouched;
 * this line is additive, below it.
 */
export function filteredHistorySummaryText(shown) {
  const list = Array.isArray(shown) ? shown : [];
  const totals = historyMonthlyGroupingTotals(list);
  const count = list.length === 1 ? '1 entry' : `${list.length} entries`;
  return `${count} · Billed ${formatMonthlyGroupingAmount(totals.billedCents)} · Paid ${formatMonthlyGroupingAmount(totals.paidCents)} · ${historyOwedText(totals.stillOwedCents)}`;
}

/**
 * Type + status legend (§1.5): the six type words with their counts
 * over the shown rows, in the list's own type order. A voided count
 * is appended only when > 0 — voided rows stay struck-through and
 * move nothing.
 */
export function historyTypeLegendText(shown) {
  const list = Array.isArray(shown) ? shown : [];
  const counts = {};
  let voided = 0;
  for (const entry of list) {
    const type = typeof entry?.type === 'string' ? entry.type : 'payment';
    counts[type] = (counts[type] ?? 0) + 1;
    if (entry?.voided === true) voided += 1;
  }
  const parts = ['charge', 'payment', 'advance', 'credit', 'refund', 'adjustment'].map(
    (type) => `${FULL_HISTORY_TYPE_LABELS[type]} ${counts[type] ?? 0}`,
  );
  if (voided > 0) parts.push(`Voided: ${voided} — shown struck-through, moves nothing`);
  return parts.join(' · ');
}

/**
 * Short entry reference (§2.3): a receipt-shaped ref prints whole;
 * an internal id prints nothing. The annotation key ({type}:{ref})
 * and the receipt-number search already use the same ref, so the
 * rule stays in one place.
 */
export function historyEntryShortRef(entry) {
  const ref = String(entry?.ref ?? '').trim();
  return RECEIPT_REF_PATTERN.test(ref) ? ref : '';
}

/** The running-balance note for one entry, for the annotation
 *  form's option text (§7.2): the same note the list row already
 *  carries ("Settled" / "Still owed PKR X" / "Credit PKR X"), so
 *  two same-amount entries tell apart. */
export function historyEntryRunningNoteText(entry) {
  return fullHistoryRunningNote(entry?.runningBalanceCents);
}

/** The type class for one history row (§2.1): the left border and
 *  type word take the type's token colour in CSS. Unknown types
 *  read as payment. */
export function historyEntryTypeClass(entry) {
  const type = typeof entry?.type === 'string' ? entry.type : 'payment';
  return ['charge', 'payment', 'advance', 'credit', 'refund', 'adjustment'].includes(type)
    ? `hist-type-${type}`
    : 'hist-type-payment';
}
