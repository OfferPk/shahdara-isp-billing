// Transaction payer name note (Plan 378): the person who actually
// handed over the cash — a father, a son, a neighbour — recorded with
// the payment in plain words. The note names the payer only; it never
// changes any bill, payment total, or customer record by itself.
//
// The payer name is already recorded with the payment (the payment
// record's paid-by field, typed on the transaction entry form and on
// the profile payment form) and already shown on the transaction list,
// the profile payment history, the Quick Collect receipt card, and the
// WhatsApp receipt draft. The missing piece was the printed receipt:
// the receipt object never carried the payer name, so no printed
// layout showed it. This module normalizes the name and builds the
// receipt field for it; the receipt builder carries it, every printed
// layout prints it where given, and the slip model carries it on its
// method line. A transaction without one shows only the customer —
// no line at all, on any layout.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const TRANSACTION_PAYER_NAME_MAX_LENGTH = 100;

function escapeTransactionPayerHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The payer name as plain words: line breaks folded to spaces,
 * trimmed, capped at 100 characters (the same cap the payment record
 * enforces). '' when there is no name to show.
 */
export function normalizeTransactionPayerName(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim().slice(0, TRANSACTION_PAYER_NAME_MAX_LENGTH);
}

/** The payer name recorded on a payment, or '' when none was given. */
export function transactionPayerNameOf(payment) {
  if (!payment || typeof payment !== 'object') return '';
  return normalizeTransactionPayerName(payment.paidBy);
}

/**
 * The payer field for the A4 receipt's fields array: [] when the
 * receipt carries no payer name, else one [label, name] entry to
 * spread into the array, right after the sender entry.
 */
export function transactionPayerReceiptField(receipt) {
  const name = transactionPayerNameOf(receipt);
  if (!name) return [];
  return [['Paid by / ادا کنندہ', name]];
}

/**
 * The payer field for the thermal receipt layouts: '' when the receipt
 * carries no payer name, else the receipt-field div with the caller's
 * label (thermal-58 passes 'Paid by', thermal-80 passes the bilingual
 * label). The name is always escaped.
 */
export function transactionPayerReceiptFieldHtml(receipt, label) {
  const name = transactionPayerNameOf(receipt);
  if (!name) return '';
  return `<div class="receipt-field"><dt>${escapeTransactionPayerHtml(label)}:</dt><dd>${escapeTransactionPayerHtml(name)}</dd></div>`;
}
