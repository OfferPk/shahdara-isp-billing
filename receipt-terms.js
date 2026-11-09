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

// The support number's digit run, derived from the published support
// line — the single source for the display form and the contact links,
// so the number is never re-typed anywhere.
function supportDigits() {
  return RECEIPT_SUPPORT_LINE.replace(/\D/g, '');
}

// The number in its simple local form (no country code, no spaces),
// derived from the same digit run — the form the success screen shows.
function supportLocalForm() {
  const digits = supportDigits();
  return digits.startsWith('92') ? `0${digits.slice(2)}` : digits;
}

// The WhatsApp brand mark (speech bubble with handset, Google Material
// Icons, Apache 2.0) and a phone handset, as inline SVGs — the same
// inline-icon approach the app's other icons use; no external images.
const WHATSAPP_ICON_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91c0-2.65-1.03-5.14-2.9-7.01m-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18l-3.12.82l.83-3.04l-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24c2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.22 8.23m4.52-6.16c-.25-.12-1.47-.72-1.69-.81c-.23-.08-.39-.12-.56.12c-.17.25-.64.81-.78.97c-.14.17-.29.19-.54.06c-.25-.12-1.05-.39-1.99-1.23c-.74-.66-1.23-1.47-1.38-1.72c-.14-.25-.02-.38.11-.51c.11-.11.25-.29.37-.43s.17-.25.25-.41c.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31c-.22.25-.86.85-.86 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74c.59.26 1.05.41 1.41.52c.59.19 1.13.16 1.56.1c.48-.07 1.47-.6 1.67-1.18c.21-.58.21-1.07.14-1.18s-.22-.16-.47-.28"/></svg>';
const CALL_ICON_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

/**
 * The two lines as an escaped HTML block for receipt cards and the
 * printed receipt, in the same receipt-urdu-notice styling the
 * existing Urdu note uses. The lines never change any bill, payment,
 * or customer record — they are display text only.
 *
 * The support number sits in a non-breaking LTR span, so it never
 * splits across lines in the RTL terms. With
 * { contactActions: true } the success-screen rendering shows the
 * number in its simple local form with tappable WhatsApp + call icons
 * beside it on the same line; every other surface uses the default
 * rendering (international form, no icons).
 *
 * @param {{ contactActions?: boolean }} [options]
 * @returns {string}
 */
export function receiptTermsNoteHtml({ contactActions = false } = {}) {
  const numberMatch = RECEIPT_SUPPORT_LINE.match(/[+\d][\d ]*$/);
  const numberText = numberMatch ? numberMatch[0] : '';
  const labelText = numberMatch ? RECEIPT_SUPPORT_LINE.slice(0, numberMatch.index) : RECEIPT_SUPPORT_LINE;
  let numberHtml;
  if (contactActions) {
    const digits = supportDigits();
    numberHtml = `${escapeHtml(supportLocalForm())}<a class="receipt-support-action receipt-support-whatsapp" href="https://wa.me/${digits}" aria-label="WhatsApp">${WHATSAPP_ICON_SVG}</a><a class="receipt-support-action receipt-support-call" href="tel:+${digits}" aria-label="Call">${CALL_ICON_SVG}</a>`;
  } else {
    numberHtml = escapeHtml(numberText);
  }
  return `<div class="receipt-urdu-notice" dir="rtl" lang="ur"><p>${escapeHtml(RECEIPT_TERMS_PHRASE)}</p><p>${escapeHtml(labelText)}<span class="receipt-support-number" dir="ltr">${numberHtml}</span></p></div>`;
}
