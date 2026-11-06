// Cross-payment note (Plan 393): one person pays for another
// customer's account — a son for his father's connection, a
// neighbour for the house next door — and the payment is recorded
// with a note saying who paid, for whose account, and their
// relationship in plain words, so both records stay honest about
// whose money it was and whose bill it settled.
//
// The note rides the payment record itself (the same field the
// payment validator keeps), so it needs no store of its own: the
// record is the note. A note is the payer's name in plain words,
// an optional link to the payer's own customer record, and an
// optional relationship in plain words. It is a note only: it moves
// no dues between customers, it never changes any bill, payment
// total, credit transfer, or customer record by itself, and it
// changes no receipt format.
//
// A normal payment — the account holder paying for their own
// connection — carries no note at all and shows nothing extra.
// The note appears on the transaction and on both customers'
// views where given: on the account holder's history row and on
// the Transactions list, and on the payer's own profile as a list
// of the payments they made for others.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const CROSS_PAYMENT_PAYER_MAX_LENGTH = 100;
export const CROSS_PAYMENT_RELATIONSHIP_MAX_LENGTH = 60;

function cleanCrossPaymentText(value) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() : '';
}

function escapeCrossPaymentHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * Normalize one cross-payment note. The value may be an object
 * { payerName, payerCustomerId, relationship } or a plain string
 * (the payer's name only). A note with no usable payer name reads
 * as null, so a normal payment stores nothing extra; a longer name
 * or relationship is kept to its cap, never stored raw. The payer
 * link is kept only as a non-empty string id.
 */
export function normalizeCrossPaymentNote(value) {
  if (typeof value === 'string') value = { payerName: value };
  if (!value || typeof value !== 'object') return null;
  const payerName = cleanCrossPaymentText(value.payerName).slice(0, CROSS_PAYMENT_PAYER_MAX_LENGTH);
  if (!payerName) return null;
  const payerCustomerId = typeof value.payerCustomerId === 'string' && value.payerCustomerId.trim()
    ? value.payerCustomerId.trim()
    : undefined;
  const relationship = cleanCrossPaymentText(value.relationship).slice(0, CROSS_PAYMENT_RELATIONSHIP_MAX_LENGTH);
  return {
    payerName,
    ...(payerCustomerId ? { payerCustomerId } : {}),
    ...(relationship ? { relationship } : {}),
  };
}

/**
 * The cross-payment note on a payment record, or null when the
 * payment carries none. Reads the same field the payment validator
 * keeps, so a note recorded with the payment is the note shown.
 */
export function crossPaymentNoteOf(payment) {
  if (!payment || typeof payment !== 'object') return null;
  return normalizeCrossPaymentNote(payment.crossPayment);
}

/**
 * The note in plain words — "Paid by Ahmed (son)", or "Paid by
 * Ahmed" when no relationship was given. The returned text is
 * unescaped: callers that put it in HTML must escape it, as the
 * markup helper below does.
 */
export function crossPaymentNoteLineText(note) {
  const clean = normalizeCrossPaymentNote(note);
  if (!clean) return '';
  return clean.relationship ? `Paid by ${clean.payerName} (${clean.relationship})` : `Paid by ${clean.payerName}`;
}

/**
 * The note as it appears on the transaction: a ' · …' suffix for
 * the payment-meta line, or '' when the payment carries no note,
 * so a normal payment shows nothing extra. The note is always
 * escaped.
 */
export function crossPaymentNoteMarkup(payment) {
  const text = crossPaymentNoteLineText(crossPaymentNoteOf(payment));
  return text ? ` · ${escapeCrossPaymentHtml(text)}` : '';
}

/**
 * The payments one customer made for other customers' accounts,
 * from transaction rows (the listTransactions projection, which
 * carries the normalized note). A row counts only when its note
 * links the payer by customer id and the account is not the
 * payer's own — a payment for one's own account is never a
 * cross-payment, even on a damaged record.
 */
export function crossPaymentsMadeBy(rows, payerCustomerId) {
  if (!Array.isArray(rows) || typeof payerCustomerId !== 'string' || !payerCustomerId) return [];
  return rows.filter((row) => {
    if (!row || typeof row !== 'object' || row.customerId === payerCustomerId) return false;
    const note = crossPaymentNoteOf(row);
    return note !== null && note.payerCustomerId === payerCustomerId;
  });
}

/**
 * The "payments made for others" section for the payer's own
 * profile: each payment this customer made for another customer's
 * account, with the amount, the account it settled, the
 * relationship, and the date. '' when the customer made none, so a
 * customer who never paid for anyone else shows nothing extra.
 * The amount formatter is the caller's (the app's PKR formatter);
 * without one the amount reads as plain "PKR <amount>".
 */
export function crossPaymentsMadeSectionHtml(customer, rows, formatAmount) {
  if (!customer || typeof customer !== 'object') return '';
  const made = crossPaymentsMadeBy(rows, customer.id);
  if (made.length === 0) return '';
  const fmt = typeof formatAmount === 'function' ? formatAmount : (amount) => `PKR ${amount}`;
  const items = made.map((row) => {
    const note = crossPaymentNoteOf(row);
    const who = `#${escapeCrossPaymentHtml(row.customerNumber ?? '?')} ${escapeCrossPaymentHtml(row.customerName ?? '')}`;
    const relationship = note && note.relationship ? ` (${escapeCrossPaymentHtml(note.relationship)})` : '';
    return `<li>${escapeCrossPaymentHtml(fmt(row.amount))} for ${who}${relationship} — ${escapeCrossPaymentHtml(row.date ?? '')}</li>`;
  }).join('');
  return `<section class="profile-cross-payments" aria-label="Payments made for others"><h4>Payments made for others</h4><p>This customer paid for another customer's account — the money settled the other account's bill, and no dues moved between the two customers.</p><ul>${items}</ul></section>`;
}
