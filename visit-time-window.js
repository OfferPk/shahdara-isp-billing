/**
 * visit-time-window.js — SISP-133: Customer Preferred Collection
 * Time-of-Day Window (ملاقات کا وقت).
 *
 * A customer may record WHEN a collection visit suits them:
 *   'anytime'        — no preference (the default; also what every
 *                      legacy record without the field means)
 *   'morning_9_1'    — 09:00–13:00 local time
 *   'afternoon_1_5'  — 13:00–17:00 local time
 *   'evening_after_5'— 17:00–24:00 local time (evening runs to the end
 *                      of the day; there is no timed window between
 *                      midnight and 09:00)
 *   'weekend_only'   — all day Saturday and Sunday (the Pakistan
 *                      weekend), never on a weekday
 *
 * STORAGE CHOICE (stated): the field `preferredVisitWindow` is stored
 * on the customer record ONLY when it holds one of the four non-anytime
 * values. 'anytime', an absent key, and any junk value are all the same
 * thing — no preference — and sanitizePreferredVisitWindow() returns
 * null for them, which every writer (addCustomer,
 * updateCustomerProfile, readState, backup validation) turns into "no
 * key stored" (an undefined value, which JSON persistence drops). No
 * migration ever writes the field onto legacy records.
 *
 * Times are read from the Date's LOCAL wall clock (getHours/getDay):
 * the app runs on the owner's device in Pakistan, so local time IS
 * PKT. Helpers take the moment as an argument so tests can pin fixed
 * clocks; nothing here reads the system clock itself.
 *
 * Everything in this module is pure and import-free: filtering and
 * sorting allocate new arrays and never mutate their inputs, and no
 * helper writes any record — the only stored fact is the preference
 * itself, written through core.js.
 */

export const VISIT_WINDOW_ANYTIME = 'anytime';

/** Every accepted value of preferredVisitWindow, in display order. */
export const VISIT_WINDOWS = Object.freeze([
  'anytime',
  'morning_9_1',
  'afternoon_1_5',
  'evening_after_5',
  'weekend_only'
]);

/** The four shift filters offered in Field Mode (plus 'all'). */
export const VISIT_SHIFT_FILTERS = Object.freeze([
  'all',
  'morning_9_1',
  'afternoon_1_5',
  'evening_after_5',
  'weekend_only'
]);

/**
 * nav-language.js key for each window's UI label. Call sites resolve
 * the label with t(VISIT_WINDOW_LABEL_KEYS[window]) so this module
 * stays import-free (core.js imports the sanitizer from here).
 */
export const VISIT_WINDOW_LABEL_KEYS = Object.freeze({
  anytime: 'visitwin_anytime',
  morning_9_1: 'visitwin_morning',
  afternoon_1_5: 'visitwin_afternoon',
  evening_after_5: 'visitwin_evening',
  weekend_only: 'visitwin_weekend'
});

/**
 * The storable form of a raw preferredVisitWindow value: one of the
 * four non-anytime enum strings, or null when the value means "no
 * preference" ('anytime', absent, or anything unrecognized).
 */
export function sanitizePreferredVisitWindow(value) {
  return typeof value === 'string' && value !== VISIT_WINDOW_ANYTIME && VISIT_WINDOWS.includes(value)
    ? value
    : null;
}

/** A customer's effective window: the stored preference, else 'anytime'. */
export function customerVisitWindow(customer) {
  return sanitizePreferredVisitWindow(customer?.preferredVisitWindow) ?? VISIT_WINDOW_ANYTIME;
}

/** Saturday (6) and Sunday (0) — the Pakistan weekend. */
export function isWeekendDate(date) {
  const day = date?.getDay?.();
  return day === 0 || day === 6;
}

/**
 * Does `window` include the moment `date`? An unrecognized window
 * behaves as 'anytime' (no preference can never exclude a visit).
 * Timed windows are half-open: morning is [09:00, 13:00), afternoon
 * [13:00, 17:00), evening [17:00, 24:00). weekend_only is all day on
 * Saturday/Sunday regardless of the hour, and never on a weekday —
 * it is orthogonal to the timed windows, so a Saturday 10:30 moment
 * matches BOTH weekend_only and morning_9_1.
 */
export function visitWindowMatchesAt(window, date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const effective = VISIT_WINDOWS.includes(window) ? window : VISIT_WINDOW_ANYTIME;
  if (effective === VISIT_WINDOW_ANYTIME) return true;
  if (effective === 'weekend_only') return isWeekendDate(date);
  const hour = date.getHours();
  if (effective === 'morning_9_1') return hour >= 9 && hour < 13;
  if (effective === 'afternoon_1_5') return hour >= 13 && hour < 17;
  if (effective === 'evening_after_5') return hour >= 17;
  return true;
}

/** Does this customer's preferred window include the moment `date`? */
export function visitWindowMatchesNow(customer, date) {
  return visitWindowMatchesAt(customerVisitWindow(customer), date);
}

/**
 * The named time-of-day shift a moment falls in, or null between
 * midnight and 09:00 (no timed window covers those hours). Weekend is
 * deliberately NOT reported here — it is a day property, not a shift;
 * use isWeekendDate() alongside.
 */
export function currentVisitShift(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const hour = date.getHours();
  if (hour >= 9 && hour < 13) return 'morning_9_1';
  if (hour >= 13 && hour < 17) return 'afternoon_1_5';
  if (hour >= 17) return 'evening_after_5';
  return null;
}

/**
 * The Field Mode 1-tap shift filter. `windowOf(item)` must return the
 * item's NORMALIZED window (customerVisitWindow). Rule (pinned):
 * 'anytime' customers appear under EVERY shift filter — "any time"
 * means any shift works for them — plus under 'all'. Any other
 * customer appears only under their own shift (and 'all'). An unknown
 * shift behaves as 'all'. Returns a new array; the input is untouched.
 */
export function filterByVisitShift(items, windowOf, shift) {
  const list = Array.isArray(items) ? items : [];
  if (!VISIT_SHIFT_FILTERS.includes(shift) || shift === 'all') return [...list];
  return list.filter((item) => {
    const window = windowOf(item);
    return window === shift || window === VISIT_WINDOW_ANYTIME;
  });
}

/**
 * "Now Match" sort: items whose window matches the moment `date` float
 * to the top; both groups keep their original relative order (stable).
 * Returns a new array; the input is untouched.
 */
export function sortByVisitWindowNowMatch(items, windowOf, date) {
  const list = Array.isArray(items) ? items : [];
  const matching = [];
  const rest = [];
  for (const item of list) {
    (visitWindowMatchesAt(windowOf(item), date) ? matching : rest).push(item);
  }
  return [...matching, ...rest];
}
