// Transaction payment-method detail note (Plan 380):
// one method-detail note on the transaction — the wallet or bank
// reference as given, and the last digits of the sending account
// where the customer offers them — in plain words. The note records
// the reference only: it clears nothing, and it never changes any
// bill, payment total, clearance status, or unmatched-credit record
// by itself. A transaction without a reference shows only the method.
//
// The note rides the payment record itself — the reference and the
// sender proof are the fields the payment validator already keeps —
// so it needs no store of its own: the record is the note. The
// reference is kept exactly as given (trimmed, line breaks folded,
// capped at 64 characters, the validator's cap); the sender digits
// are digits only and only the last 4 survive, so a full account
// number typed by mistake is never shown whole. The sender title is
// capped at 100 characters, the payer-name cap.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const PAYMENT_METHOD_DETAIL_REFERENCE_MAX_LENGTH = 64;
export const PAYMENT_METHOD_DETAIL_SENDER_TITLE_MAX_LENGTH = 100;

function cleanPaymentMethodDetailText(value) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() : '';
}

/**
 * The wallet or bank reference on a payment, exactly as given:
 * the transaction id first, the older reference field second. A
 * payment without either reads as '' — never invented.
 */
export function paymentMethodReferenceOf(payment) {
  if (!payment || typeof payment !== 'object') return '';
  return cleanPaymentMethodDetailText(payment.transactionId ?? payment.reference)
    .slice(0, PAYMENT_METHOD_DETAIL_REFERENCE_MAX_LENGTH);
}

/** The sender title, trimmed and capped, or '' when absent. */
export function paymentMethodSenderTitleOf(payment) {
  if (!payment || typeof payment !== 'object') return '';
  return cleanPaymentMethodDetailText(payment.senderTitle)
    .slice(0, PAYMENT_METHOD_DETAIL_SENDER_TITLE_MAX_LENGTH);
}

/** The sender digits: digits only, only the last 4 survive. */
export function paymentMethodSenderDigitsOf(payment) {
  if (!payment || typeof payment !== 'object') return '';
  return String(payment.senderDigits ?? '').replace(/\D/g, '').slice(-4);
}

/**
 * The sender label: "Title (…digits)", "Title", "…digits", or ''
 * when absent — the same words the payment record's own sender
 * reader builds, so the two can never disagree.
 */
export function paymentMethodSenderLabelOf(payment) {
  const title = paymentMethodSenderTitleOf(payment);
  const digits = paymentMethodSenderDigitsOf(payment);
  if (title && digits) return `${title} (…${digits})`;
  return title || (digits ? `…${digits}` : '');
}

/**
 * Normalize one method-detail note. A note with no reference, no
 * sender title, and no sender digits is not a note at all and reads
 * as null, so a transaction without one shows only the method.
 * Accepts a payment record or a detail-shaped object.
 */
export function normalizePaymentMethodDetail(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const reference = paymentMethodReferenceOf(raw);
  const senderTitle = paymentMethodSenderTitleOf(raw);
  const senderDigits = paymentMethodSenderDigitsOf(raw);
  if (!reference && !senderTitle && !senderDigits) return null;
  return {
    ...(reference ? { reference } : {}),
    ...(senderTitle ? { senderTitle } : {}),
    ...(senderDigits ? { senderDigits } : {}),
  };
}

/**
 * The method-detail note on a payment record, or null when the
 * payment carries none. Reads the same fields the payment
 * validator keeps, so a note recorded with the payment is the note
 * shown.
 */
export function paymentMethodDetailOf(payment) {
  return normalizePaymentMethodDetail(payment);
}

const PAYMENT_METHOD_DETAIL_DEFAULT_LABELS = {
  reference: 'Ref {reference}',
  senderRow: 'Sender: {label}',
};

/**
 * The note in plain words — reference first, then the sender, each
 * shown only when given, joined with ' · '. Empty when the note has
 * nothing to say. The caller supplies labels (the profile passes a
 * translated reference label); the plain defaults are used otherwise.
 * The returned text is unescaped: callers that put it in HTML must
 * escape it, as the markup helpers below do.
 */
export function paymentMethodDetailLineText(detail, labels = {}) {
  const normalized = normalizePaymentMethodDetail(detail);
  if (!normalized) return '';
  const referenceLabel = typeof labels.reference === 'string' && labels.reference
    ? labels.reference : PAYMENT_METHOD_DETAIL_DEFAULT_LABELS.reference;
  const senderRowLabel = typeof labels.senderRow === 'string' && labels.senderRow
    ? labels.senderRow : PAYMENT_METHOD_DETAIL_DEFAULT_LABELS.senderRow;
  const parts = [];
  if (normalized.reference) parts.push(referenceLabel.replace('{reference}', normalized.reference));
  const senderLabel = paymentMethodSenderLabelOf(normalized);
  if (senderLabel) parts.push(senderRowLabel.replace('{label}', senderLabel));
  return parts.join(' · ');
}

function escapePaymentMethodDetailHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The note as it appears on the transaction: a ' · …' suffix for the
 * payment-meta line, or '' when the payment carries no note, so a
 * transaction without one shows only the method. The reference and
 * the sender name are always escaped.
 */
export function paymentMethodDetailMarkup(payment, labels = {}) {
  const text = paymentMethodDetailLineText(paymentMethodDetailOf(payment), labels);
  return text ? ` · ${escapePaymentMethodDetailHtml(text)}` : '';
}

/**
 * The reference alone as it appears on the transaction: a ' · …'
 * suffix, or '' when the payment carries no reference. The profile
 * history row uses this one — the sender label already shows beside
 * it there — so the sender is never shown twice.
 */
export function paymentMethodReferenceMarkup(payment, labels = {}) {
  const reference = paymentMethodReferenceOf(payment);
  if (!reference) return '';
  const referenceLabel = typeof labels.reference === 'string' && labels.reference
    ? labels.reference : PAYMENT_METHOD_DETAIL_DEFAULT_LABELS.reference;
  return ` · ${escapePaymentMethodDetailHtml(referenceLabel.replace('{reference}', reference))}`;
}
