/**
 * sms-fallback.js — SISP-76: 1-Tap Native SIM SMS Slip for
 * non-WhatsApp / keypad customers.
 *
 * WhatsApp drafts (wa.me) are useless for customers on keypad phones
 * or without WhatsApp. This module builds a native `sms:` URI whose
 * body is a short Roman Urdu receipt or reminder that always fits a
 * single SMS segment budget of 160 characters:
 *
 *   sms:+923001234567?body=Shahdara%20Fiber%20Net%3A%20...
 *
 * Rules:
 * - Phone normalization REUSES the house normalizer
 *   (normalizePakistaniWhatsAppPhone in form-validation.js) so SMS
 *   and WhatsApp agree on what a valid number is. Only Pakistani
 *   mobiles (923xxxxxxxxx) are accepted — an `sms:` slip is a local
 *   SIM message, never an international guess.
 * - An invalid phone yields NO url (''), never a malformed link, so
 *   callers simply omit the button.
 * - Body builders are pure. The amount paid and the remaining
 *   balance are the core of the message and are NEVER truncated
 *   away: when a body would exceed 160 characters the builders shed
 *   optional segments in a fixed order (receipt number, greeting,
 *   long brand) and shorten the customer name before ever touching
 *   the money figures.
 * - Nothing is sent automatically: the URI only opens the phone's
 *   SMS composer with the draft, exactly like the WhatsApp drafts.
 */

import { normalizePakistaniWhatsAppPhone } from './form-validation.js';

export const SMS_BODY_MAX_LENGTH = 160;

const BRAND_FULL = 'Shahdara Fiber Net';
const BRAND_SHORT = 'SFN';

/** House-consistent SMS phone check: valid Pakistani mobile or nothing. */
export function normalizeSmsPhone(phoneStr) {
  const norm = normalizePakistaniWhatsAppPhone(phoneStr);
  if (!norm.valid || !/^923\d{9}$/.test(norm.intlDigits)) {
    return {
      valid: false,
      intlDigits: '',
      formattedPhone: typeof phoneStr === 'string' ? phoneStr.trim() : '',
      error: norm.valid ? 'SMS slips need a Pakistani mobile number (03xx-xxxxxxx)' : norm.error
    };
  }
  return { valid: true, intlDigits: norm.intlDigits, formattedPhone: norm.formattedPhone, error: '' };
}

const formatSmsAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`;
};

const cleanName = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

/** Progressively shorter name forms: full, first token, truncated. */
function nameForms(name) {
  const full = cleanName(name);
  if (!full) return [''];
  const first = full.split(' ')[0];
  const forms = [full];
  if (first && first !== full) forms.push(first);
  for (const limit of [12, 8, 4]) {
    if (full.length > limit) forms.push(full.slice(0, limit).trim());
  }
  return [...new Set(forms.filter(Boolean))];
}

/**
 * Pick the richest candidate that fits the SMS budget. Candidates are
 * supplied richest-first; the last one must be the untouchable core
 * (money figures only), which always fits.
 */
function fitSmsBody(candidates) {
  for (const candidate of candidates) {
    if (candidate && candidate.length <= SMS_BODY_MAX_LENGTH) return candidate;
  }
  return candidates[candidates.length - 1] ?? '';
}

/**
 * Roman Urdu payment-receipt body (<= 160 chars). `amount` and
 * `balanceDue` (rupees) are always preserved when provided;
 * `balanceDue: null` omits the balance segment entirely.
 */
export function buildSmsReceiptBody({ customerName = '', amount = null, balanceDue = null, receiptNumber = '' } = {}) {
  const amountText = formatSmsAmount(amount);
  const balanceText = balanceDue === null || balanceDue === undefined ? '' : formatSmsAmount(balanceDue);
  const core = [
    amountText ? `${amountText} wasool ho gaye.` : 'Payment wasool ho gayi.',
    balanceText ? `Baqaya: ${balanceText}.` : ''
  ].filter(Boolean).join(' ');
  const receiptText = String(receiptNumber ?? '').trim();
  const candidates = [];
  for (const name of nameForms(customerName)) {
    const greeting = name ? `Assalam-o-Alaikum ${name}, ` : '';
    candidates.push(`${BRAND_FULL}: ${greeting}${core}${receiptText ? ` Receipt: ${receiptText}.` : ''} Shukriya!`);
    candidates.push(`${BRAND_FULL}: ${greeting}${core} Shukriya!`);
    candidates.push(`${BRAND_FULL}: ${core} Shukriya!`);
  }
  candidates.push(`${BRAND_SHORT}: ${core}`);
  candidates.push(core);
  return fitSmsBody(candidates);
}

/**
 * Roman Urdu bill-reminder body (<= 160 chars). With a balance the
 * amount is the untouchable core; without one a generic reminder is
 * produced (used by the profile contact shortcut).
 */
export function buildSmsReminderBody({ customerName = '', balanceDue = null, dueText = '' } = {}) {
  const balanceText = balanceDue === null || balanceDue === undefined ? '' : formatSmsAmount(balanceDue);
  const due = String(dueText ?? '').trim();
  if (!balanceText) {
    const candidates = [];
    for (const name of nameForms(customerName)) {
      const greeting = name ? `Assalam-o-Alaikum ${name}, ` : '';
      candidates.push(`${BRAND_FULL}: ${greeting}apne internet bill ki adaigi ki yaad dehani hai. Shukriya!`);
    }
    candidates.push(`${BRAND_SHORT}: Internet bill ki adaigi ki yaad dehani hai. Shukriya!`);
    return fitSmsBody(candidates);
  }
  const core = `aap ka internet bill ${balanceText} baqaya hai.`;
  const candidates = [];
  for (const name of nameForms(customerName)) {
    const who = name ? `${name}, ` : '';
    candidates.push(`${BRAND_FULL}: ${who}${core}${due ? ` Last date: ${due}.` : ''} Meharbani kar ke jald ada kar dein. Shukriya!`);
    candidates.push(`${BRAND_FULL}: ${who}${core} Meharbani kar ke jald ada kar dein. Shukriya!`);
    candidates.push(`${BRAND_FULL}: ${core} Shukriya!`);
  }
  candidates.push(`${BRAND_SHORT}: ${core}`);
  candidates.push(core);
  return fitSmsBody(candidates);
}

/** Build the sms: URI. Invalid phone -> { url: '', valid: false }. */
export function buildSmsUrl(phoneStr, body = '') {
  const norm = normalizeSmsPhone(phoneStr);
  const safeBody = typeof body === 'string' ? body : '';
  if (!norm.valid) {
    return { url: '', valid: false, intlDigits: '', formattedPhone: norm.formattedPhone, body: safeBody, error: norm.error };
  }
  return {
    url: `sms:+${norm.intlDigits}${safeBody ? `?body=${encodeURIComponent(safeBody)}` : ''}`,
    valid: true,
    intlDigits: norm.intlDigits,
    formattedPhone: norm.formattedPhone,
    body: safeBody,
    error: ''
  };
}

/** Receipt slip for a recorded payment. Amounts are rupees. */
export function buildSmsReceiptUrl({ phone = '', customerName = '', amount = null, balanceDue = null, receiptNumber = '' } = {}) {
  return buildSmsUrl(phone, buildSmsReceiptBody({ customerName, amount, balanceDue, receiptNumber }));
}

/** Reminder slip for an unpaid balance. Amounts are rupees. */
export function buildSmsReminderUrl({ phone = '', customerName = '', balanceDue = null, dueText = '' } = {}) {
  return buildSmsUrl(phone, buildSmsReminderBody({ customerName, balanceDue, dueText }));
}

/** SISP-76: the customer's recorded contact preference. */
export function customerPrefersSms(customer) {
  return customer?.prefersSms === true;
}
