// Transaction note in Urdu script (Plan 389):
// one optional note on the transaction, written in Urdu script and
// shown exactly as written alongside the transaction — on the
// transaction itself and on its history line — so a note written the
// way the operator and the customer actually speak is read back
// correctly at the next visit, with no translation mistakes. It is a
// note only: it never changes any bill, payment total, or customer
// record by itself, and it changes no receipt format (the Urdu
// receipt option is Plan 168's, untouched).
//
// The note rides the payment record itself (the same field the
// payment validator keeps), so it needs no store of its own: the
// record is the note. A note is folded to one line, trimmed, and
// capped at 200 characters (the same cap as the generic payment
// note); a transaction without one shows nothing extra.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

export const URDU_NOTE_MAX_LENGTH = 200;

function cleanUrduNoteText(value) {
  return typeof value === 'string' ? value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim() : '';
}

/**
 * Normalize one Urdu-script note. A note with no usable text reads
 * as '', so a transaction without one shows nothing extra; a longer
 * note is kept to its first 200 characters, never stored raw.
 */
export function normalizeUrduNote(value) {
  return cleanUrduNoteText(value).slice(0, URDU_NOTE_MAX_LENGTH);
}

/**
 * The Urdu-script note on a payment record, or '' when the payment
 * carries none. Reads the same field the payment validator keeps,
 * so a note recorded with the payment is the note shown.
 */
export function urduNoteOf(payment) {
  if (!payment || typeof payment !== 'object') return '';
  return normalizeUrduNote(payment.urduNote);
}

/**
 * The note in plain words — exactly as written. The returned text is
 * unescaped: callers that put it in HTML must escape it, as the
 * markup helper below does.
 */
export function urduNoteLineText(note) {
  return normalizeUrduNote(note);
}

function escapeUrduNoteHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * The note as it appears on the transaction: a ' · …' suffix for the
 * payment-meta line, or '' when the payment carries no note, so a
 * transaction without one shows nothing extra. The note is always
 * escaped, and it is wrapped in an rtl Urdu span so the script reads
 * right-to-left inside the otherwise left-to-right line.
 */
export function urduNoteMarkup(payment) {
  const text = urduNoteLineText(urduNoteOf(payment));
  return text ? ` · <span dir="rtl" lang="ur">${escapeUrduNoteHtml(text)}</span>` : '';
}
