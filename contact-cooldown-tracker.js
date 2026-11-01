/**
 * contact-cooldown-tracker.js — SISP-138: Defaulter "Reminded Today"
 * Cooldown Badge & Filter.
 *
 * One small stamp pair lives on the customer record:
 *   lastContactedAt     — house local datetime string "YYYY-MM-DDTHH:MM"
 *                         (PKT wall clock, the localDateTimeValue style)
 *   lastContactChannel  — 'whatsapp' | 'call' | 'sms' | 'visit'
 *
 * Rules (pinned by tests/contact-cooldown-tracker.test.js):
 *   1. Absent-by-default: legacy customers carry neither field and read
 *      as never-contacted. No migration, no seeded values.
 *   2. The pair is written ONLY together, ONLY by stampContact() /
 *      stampContactInState(), and ONLY from a real operator contact
 *      action (a WhatsApp dispatch tap, or an explicit Mark-contacted
 *      tap). Rendering, filtering and dialog opens never stamp.
 *   3. Sanitizers never store raw junk: an invalid channel or an
 *      unparseable / impossible timestamp normalizes the WHOLE pair to
 *      absent (null / null), so a damaged record can never fake a
 *      contact or break the cooldown maths.
 *   4. Cooldown is a PKT calendar-day rule: contactedToday() is true
 *      exactly when the stamp's date part equals today's PKT date.
 *      Yesterday or older → no badge, never hidden.
 *   5. This module is pure: it never touches storage, never mutates its
 *      inputs, and imports nothing but the language dictionary (so
 *      core.js can import its sanitizer without a cycle).
 */

import { t } from './nav-language.js';

export const CONTACT_CHANNELS = Object.freeze(['whatsapp', 'call', 'sms', 'visit']);
export const CONTACT_TIME_ZONE = 'Asia/Karachi';

const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function pktParts(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CONTACT_TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value])
  );
  // Some environments report midnight as hour "24" even with h23.
  if (parts.hour === '24') parts.hour = '00';
  return parts;
}

function asValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** PKT calendar date ("YYYY-MM-DD") for a Date, or null when invalid. */
export function pktDateString(value = new Date()) {
  const date = asValidDate(value);
  if (!date) return null;
  const p = pktParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Formats a Date as the house local datetime string ("YYYY-MM-DDTHH:MM",
 * PKT wall clock) used for the lastContactedAt stamp. Null for an
 * invalid date — a stamp is never fabricated from a broken clock.
 */
export function formatContactTimestamp(value = new Date()) {
  const date = asValidDate(value);
  if (!date) return null;
  const p = pktParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Strictly validates a stored stamp: exact house format AND a real
 * calendar moment (2026-02-30T10:00 is rejected by UTC round-trip, the
 * same discipline as core.js parseLocalDateTime). Returns the string
 * unchanged when valid, null otherwise.
 */
export function sanitizeContactTimestamp(value) {
  if (typeof value !== 'string') return null;
  const match = TIMESTAMP_RE.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    wallClock.getUTCFullYear() !== year || wallClock.getUTCMonth() !== month - 1
    || wallClock.getUTCDate() !== day || wallClock.getUTCHours() !== hour
    || wallClock.getUTCMinutes() !== minute
  ) return null;
  return value.trim();
}

/** A channel is kept only when it is one of the four known channels. */
export function sanitizeContactChannel(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase();
  return CONTACT_CHANNELS.includes(cleaned) ? cleaned : null;
}

/**
 * The pair sanitizer used by core.js (readState + backup validation):
 * both fields survive only when BOTH are valid; anything else reads as
 * never-contacted (null / null).
 */
export function sanitizeContactPair(source) {
  const at = sanitizeContactTimestamp(source?.lastContactedAt);
  const channel = sanitizeContactChannel(source?.lastContactChannel);
  if (at === null || channel === null) return { lastContactedAt: null, lastContactChannel: null };
  return { lastContactedAt: at, lastContactChannel: channel };
}

/** The sanitized stamp on a customer, or null when never contacted. */
export function contactStampOf(customer) {
  const pair = sanitizeContactPair(customer);
  if (pair.lastContactedAt === null) return null;
  return { at: pair.lastContactedAt, channel: pair.lastContactChannel };
}

/**
 * Returns a NEW customer object carrying the contact stamp for `now`.
 * The pair is always written together. Throws on an unknown channel —
 * channels are chosen by the app's own buttons, so a bad one is a
 * programming error, never operator data. The input is never mutated.
 */
export function stampContact(customer, channel, now = new Date()) {
  const cleanChannel = sanitizeContactChannel(channel);
  if (cleanChannel === null) throw new Error(`Unknown contact channel: ${String(channel)}`);
  const at = formatContactTimestamp(now);
  if (at === null) throw new Error('Cannot stamp a contact from an invalid date.');
  if (!customer || typeof customer !== 'object') return customer;
  return { ...customer, lastContactedAt: at, lastContactChannel: cleanChannel };
}

/**
 * State-level stamp (markCustomerLastReminded precedent): returns a new
 * state with the one customer stamped; an unknown id returns the input
 * state reference unchanged, and every other customer object is reused
 * untouched.
 */
export function stampContactInState(state, customerId, channel, now = new Date()) {
  if (!state || !Array.isArray(state.customers)) return state;
  if (!state.customers.some(c => String(c?.id) === String(customerId))) return state;
  return {
    ...state,
    customers: state.customers.map(c => (String(c?.id) === String(customerId) ? stampContact(c, channel, now) : c))
  };
}

/**
 * The cooldown rule: true exactly when the customer's stamp falls on
 * today's PKT calendar date (relative to the injectable `now`).
 */
export function contactedToday(customer, now = new Date()) {
  const stamp = contactStampOf(customer);
  if (!stamp) return false;
  const today = pktDateString(now);
  return today !== null && stamp.at.slice(0, 10) === today;
}

/** "HH:MM" (24h) of the customer's stamp, or null when never contacted. */
export function contactTimeLabel(customer) {
  const stamp = contactStampOf(customer);
  return stamp ? stamp.at.slice(11, 16) : null;
}

/** Localized channel label ('WhatsApp' / 'Call' / 'SMS' / 'Visit'). */
export function contactChannelLabel(channel, lang = null) {
  const clean = sanitizeContactChannel(channel);
  return clean === null ? '' : t(`cct_channel_${clean}`, lang);
}

/** Localized "Contact marked: <channel>" confirmation message. */
export function contactMarkedMessage(channel, lang = null) {
  return t('cct_marked_toast', lang, { channel: contactChannelLabel(channel, lang) });
}

/** Localized label for the explicit mark-contacted affordance. */
export function markContactedLabel(lang = null) {
  return t('cct_mark_contacted', lang);
}

/**
 * The badge text for a customer contacted today — "✓ Reminded Today
 * HH:MM" with the stamp's own time — or '' when not contacted today
 * (no badge is ever rendered for yesterday or older).
 */
export function contactBadgeText(customer, now = new Date(), lang = null) {
  if (!contactedToday(customer, now)) return '';
  return t('cct_badge_reminded', lang, { time: contactTimeLabel(customer) });
}

const escapeBadgeText = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Badge HTML (shared span) or '' — safe: text is a dict string + HH:MM. */
export function contactBadgeHtml(customer, now = new Date(), lang = null) {
  const text = contactBadgeText(customer, now, lang);
  return text ? `<span class="contact-cooldown-badge">${escapeBadgeText(text)}</span>` : '';
}

/** Customers NOT contacted today (the "Hide Contacted Today" filter). */
export function filterCustomersNotContactedToday(customers, now = new Date()) {
  return (Array.isArray(customers) ? customers : []).filter(c => !contactedToday(c, now));
}

/** Reminder-queue items (each carrying `.customer`) minus today's contacts. */
export function filterQueueItemsNotContactedToday(items, now = new Date()) {
  return (Array.isArray(items) ? items : []).filter(item => !contactedToday(item?.customer ?? item, now));
}
