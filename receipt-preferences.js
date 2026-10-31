/**
 * receipt-preferences.js — SISP-91: Per-Customer Receipt Language &
 * Channel Preference.
 *
 * A customer may carry two OPTIONAL receipt preferences on the record:
 *
 *   preferredReceiptLang:    'urdu' | 'roman' | 'english'
 *   preferredReceiptChannel: 'wa_text' | 'wa_png' | 'sms' | 'thermal_58'
 *
 * Both default to null (unset) — a customer without a saved preference
 * gets exactly the pre-SISP-91 behaviour everywhere: the bilingual
 * WhatsApp/PNG slips and the English profile draft, in the default
 * action order. A saved preference WINS over the current UI language
 * and over the default channel wherever a receipt is generated (the
 * WhatsApp text drafts, the PNG slip model, the Field Mode receipt
 * card, and the profile receipt actions).
 *
 * SISP-76 composition (ONE mapping, in this module only): SISP-76
 * stored the SMS-first preference as the boolean `prefersSms`. The
 * channel preference generalizes it, and the two are kept in agreement
 * by exactly one rule, applied here:
 *
 *   - an explicit preferredReceiptChannel always wins;
 *   - with no explicit channel, prefersSms === true means 'sms';
 *   - when a profile save SETS an explicit channel, core.js rewrites
 *     prefersSms from it ('sms' -> true, any other channel -> false),
 *     so the legacy SISP-76 readers (customerPrefersSms) never disagree
 *     with the channel a receipt actually used.
 *
 * This module is deliberately dependency-free (no core.js import), so
 * core.js itself can use the sanitizers without an import cycle.
 */

export const RECEIPT_LANGS = ['urdu', 'roman', 'english'];
export const RECEIPT_CHANNELS = ['wa_text', 'wa_png', 'sms', 'thermal_58'];

/** Stored language preference, or null when unset/corrupt. */
export function sanitizeReceiptLang(value) {
  return RECEIPT_LANGS.includes(value) ? value : null;
}

/** Stored channel preference, or null when unset/corrupt. */
export function sanitizeReceiptChannel(value) {
  return RECEIPT_CHANNELS.includes(value) ? value : null;
}

/** The customer's saved receipt language ('urdu'|'roman'|'english'|null). */
export function receiptLangPreference(customer) {
  return sanitizeReceiptLang(customer?.preferredReceiptLang);
}

/**
 * The customer's effective receipt channel — THE SISP-76 mapping:
 * explicit channel first, else the legacy prefersSms flag means 'sms',
 * else null (no preference; callers keep their default order).
 */
export function receiptChannelPreference(customer) {
  const channel = sanitizeReceiptChannel(customer?.preferredReceiptChannel);
  if (channel) return channel;
  return customer?.prefersSms === true ? 'sms' : null;
}

/**
 * prefersSms value implied by a channel choice: 'sms' -> true, any
 * other explicit channel -> false, no channel -> the fallback stands.
 * core.js applies this on profile saves that set a channel, so the
 * stored boolean and the stored channel can never disagree.
 */
export function prefersSmsForChannel(channel, fallbackPrefersSms = false) {
  const clean = sanitizeReceiptChannel(channel);
  if (clean) return clean === 'sms';
  return fallbackPrefersSms === true;
}
