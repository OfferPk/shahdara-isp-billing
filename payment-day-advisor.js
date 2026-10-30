/**
 * payment-day-advisor.js — SISP-79: Habitual Payment Day-of-Month
 * Analyzer & Field Mode Filter.
 *
 * The question this answers: "yeh customer aam tor par mahine ki kis
 * tareekh ko paisay deta hai?" A collector planning today's round (or
 * glancing at a profile before calling) does better visiting the
 * customer whose usual pay window contains TODAY than one who always
 * pays on the 25th.
 *
 * DERIVED, NEVER STORED: the habit is computed from the customer's
 * live payment records on every call. Nothing is written back onto
 * the customer record (no cached `typicalPaymentDayOfMonth` field),
 * so the figure can never go stale or disagree with the ledger, and
 * voiding a receipt (SISP-34) corrects the habit automatically.
 *
 * INCLUSION RULE (pinned by tests/payment-day-advisor.test.js):
 * a payment counts toward the habit iff it is a real receipt —
 *   - it sits on one of the customer's bills (customer.bills[].payments),
 *   - it is NOT voided (payment.voided !== true; SISP-34: a voided
 *     receipt is frozen history, not a receipt anymore),
 *   - its amount is a finite number > 0 (zero/negative rows are not
 *     money handed over), and
 *   - its `date` is a valid YYYY-MM-DD calendar date.
 * ALL payment kinds count — normal receipts and kind 'advance' alike:
 * the habit being measured is the day of the month this customer
 * hands over money, and an advance is a real handing-over on its
 * recorded date. A multi-month prepay (SISP-61) is ONE payment event
 * on its recorded date, never one event per covered month. Each
 * qualifying payment contributes exactly one day-of-month sample;
 * two payments on the 11th are two samples of 11.
 *
 * MINIMUM EVIDENCE: fewer than MIN_HABIT_PAYMENTS (2) qualifying
 * payments means NO habit is reported (null) — a single payment is
 * an event, not a habit, and this module never fabricates one.
 *
 * MEDIAN + WINDOW: samples are sorted; the median is the middle
 * sample (odd count) or Math.round of the average of the two middle
 * samples (even count), so it is always a whole day 1..31. The
 * "usual window" is median ± WINDOW_RADIUS_DAYS clamped to 1..31 —
 * a median of 11 reads "usually pays around 10th–12th".
 *
 * Pure and DOM-free; consumed by profile-ui.js (the profile's
 * "Usual pay day" line) and field-mode.js (the 🎯 "Likely to Pay
 * Today" filter + card marker).
 */

/** Minimum qualifying payments before a habit is reported at all. */
export const MIN_HABIT_PAYMENTS = 2;
/** Days either side of the median that form the "usual" window. */
export const WINDOW_RADIUS_DAYS = 1;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Day-of-month (1..31) of a strict YYYY-MM-DD calendar date, or null
 * for anything malformed or impossible (2026-02-31, '11/07/2026', …).
 */
export function paymentDayOfMonth(dateStr) {
  const match = DATE_PATTERN.exec(String(dateStr ?? ''));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return day;
}

/** One payment -> its day-of-month sample, or null when it does not qualify (see the header rule). */
function qualifyingDay(payment) {
  if (!payment || payment.voided === true) return null;
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return paymentDayOfMonth(payment.date);
}

/**
 * Every qualifying day-of-month sample on the customer, sorted
 * ascending (duplicates kept — each payment is one sample).
 */
export function qualifyingPaymentDays(customer) {
  const days = [];
  for (const bill of customer?.bills ?? []) {
    for (const payment of bill?.payments ?? []) {
      const day = qualifyingDay(payment);
      if (day !== null) days.push(day);
    }
  }
  return days.sort((a, b) => a - b);
}

/** Median of a sorted numeric list (whole number via Math.round on even counts), or null when empty. */
function medianOfSorted(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * The customer's payment habit, or null when there is not enough
 * evidence (< MIN_HABIT_PAYMENTS qualifying payments). Shape:
 *   { medianDay, windowStart, windowEnd, paymentCount, days }
 * `days` is the sorted sample list the median came from, so callers
 * and tests can audit the derivation.
 */
export function paymentDayHabit(customer) {
  const days = qualifyingPaymentDays(customer);
  if (days.length < MIN_HABIT_PAYMENTS) return null;
  const medianDay = medianOfSorted(days);
  return {
    medianDay,
    windowStart: Math.max(1, medianDay - WINDOW_RADIUS_DAYS),
    windowEnd: Math.min(31, medianDay + WINDOW_RADIUS_DAYS),
    paymentCount: days.length,
    days
  };
}

/**
 * The derived typicalPaymentDayOfMonth: the median habitual pay day
 * (1..31), or null when the customer has no proven habit yet.
 */
export function typicalPaymentDayOfMonth(customer) {
  return paymentDayHabit(customer)?.medianDay ?? null;
}

/** True when a habit's usual window contains the given day-of-month. */
export function habitCoversDay(habit, dayOfMonth) {
  const day = Number(dayOfMonth);
  if (!habit || !Number.isInteger(day) || day < 1 || day > 31) return false;
  return day >= habit.windowStart && day <= habit.windowEnd;
}

/** True when the customer's usual pay window contains the given day-of-month. */
export function isLikelyToPayOn(customer, dayOfMonth) {
  return habitCoversDay(paymentDayHabit(customer), dayOfMonth);
}

function customerById(customers, id) {
  if (customers instanceof Map) return customers.get(id) ?? null;
  if (Array.isArray(customers)) return customers.find(c => c?.id === id) ?? null;
  return null;
}

/**
 * Field Mode filter: the entries whose customer is likely to pay on
 * the given day-of-month (habit window contains it). Entries whose
 * customer record cannot be found, or who has no proven habit, are
 * excluded — the filter only ever surfaces evidence-backed names.
 * `customers` is the live customer array (or a Map keyed by id).
 */
export function filterLikelyToPayEntries(entries, customers, dayOfMonth) {
  const list = Array.isArray(entries) ? entries : [];
  return list.filter(entry => isLikelyToPayOn(customerById(customers, entry?.id), dayOfMonth));
}

/**
 * Field Mode sort: likely-to-pay entries first, everyone else after,
 * with the original relative order preserved inside each group
 * (stable), so the underlying pending-list ordering (oldest dues
 * first) still governs within a group.
 */
export function sortLikelyToPayFirst(entries, customers, dayOfMonth) {
  const list = Array.isArray(entries) ? entries : [];
  const likely = [];
  const rest = [];
  for (const entry of list) {
    (isLikelyToPayOn(customerById(customers, entry?.id), dayOfMonth) ? likely : rest).push(entry);
  }
  return [...likely, ...rest];
}
