/**
 * receipt-terms.js — receipt terms phrase + technical-support line
 * (receipt polish 7).
 *
 * Every bill receipt carries the same two Urdu lines: the terms phrase
 * (pay by the 5th or the net is switched off temporarily, and it comes
 * back when the fee is paid) and the technical-support line with the
 * support contact. One module owns the exact wording so the receipt
 * card, the printed receipt, and every WhatsApp draft print the same
 * words — no surface re-types them, so they can never drift apart.
 *
 * The support number is the business's published technical-support
 * contact, printed on receipts at the owner's explicit request — it
 * is not a subscriber number. It is a disclosed exemption in the
 * privacy ratchet (the ratchet still scans every other shipped file
 * and still fails on any other realistic number).
 *
 * Pure and import-free: no storage, no clock, no network, no date
 * objects. The HTML helper escapes its own output with a local
 * escaper, so callers never need to escape it again.
 */

export const RECEIPT_TERMS_PHRASE =
  'شرائط و ضوابط کے تحت پانچ تاریخ تک اگر انٹرنیٹ کی فیس ادا نہ ہو تو عارضی نیٹ بند ہو گا، فیس ادا کرنے پہ نیٹ دوبارہ بحال ہو گا';

export const RECEIPT_SUPPORT_LINE =
  'ٹیکنیکل سپورٹ کے لیے سعد سے رابطہ کریں: +92 341 5277081';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

/**
 * The two lines as plain text for WhatsApp drafts and the clipboard
 * fallback: the terms phrase, then the support line. Callers add
 * their own blank lines around the block.
 *
 * @returns {string}
 */
export function receiptTermsNoteText() {
  return `${RECEIPT_TERMS_PHRASE}\n${RECEIPT_SUPPORT_LINE}`;
}

/**
 * The two lines as an escaped HTML block for receipt cards and the
 * printed receipt, in the same receipt-urdu-notice styling the
 * existing Urdu note uses. The lines never change any bill, payment,
 * or customer record — they are display text only.
 *
 * @returns {string}
 */
export function receiptTermsNoteHtml() {
  return `<div class="receipt-urdu-notice" dir="rtl" lang="ur"><p>${escapeHtml(RECEIPT_TERMS_PHRASE)}</p><p>${escapeHtml(RECEIPT_SUPPORT_LINE)}</p></div>`;
}
