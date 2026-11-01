/**
 * backdated-payment-helper.js — SISP-161: Backdated Receipt paymentDate
 * Chips (Today / Yesterday / Prev Month End) & Month Attribution Guard.
 *
 * Late-entered shop or night collections belong to the day the money was
 * actually received, not the day the operator got around to typing them
 * in. Every month-attribution surface in the app (Roznamcha drawer and
 * month-end cash, Owner Khata, P&L paymentEntries, daily closing) already
 * keys off `payment.date`, so the whole feature is a 1-tap date-entry
 * affordance on the Quick Collect sheet: the chips only set the existing
 * #quickCollectDateInput value, and the chosen date flows through the
 * EXISTING recorder path (executeQuickCollection -> core addPayment)
 * unchanged. Bill-month allocation is deliberately untouched — allocations
 * key off the bill month, never the payment date.
 *
 * The future-date guard itself already lives at the recorder:
 * core validatePayment refuses `date > dateKey(referenceDate)` (the PKT
 * calendar day of the entry moment) with 'Payment date cannot be in the
 * future.' — this module only mirrors that rule for the sheet's inline
 * pre-check so the operator gets the localized message before submit.
 *
 * Pure functions only: the "today" input is a PKT 'YYYY-MM-DD' string
 * (getPakistanLocalDate in nav-quick-collect.js), so chip math is plain
 * calendar arithmetic and unit-testable with an injectable today. The
 * shape mirrors the SISP-3 precedent, computeWaadaChipDate in
 * waada-queue.js.
 *
 * Imported only by nav-quick-collect.js (itself an existing build entry),
 * so this module stays inside the existing chunk graph and the dist
 * bundle count is unchanged (perf budget #219).
 */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict 'YYYY-MM-DD' that is also a real calendar date. */
export function isValidPaymentDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateKeyFromUtc(date) {
  return date.toISOString().slice(0, 10);
}

function utcMidnight(dateKey) {
  return new Date(`${dateKey}T00:00:00Z`);
}

/**
 * The three chip target dates for a given PKT today.
 * - yesterday: today - 1 calendar day (month/year boundaries handled by
 *   UTC date arithmetic: 2026-01-01 -> 2025-12-31).
 * - prevMonthEnd: the last calendar day of the previous month, computed
 *   as "day 0 of the current month" (2026-03-01 -> 2026-02-28;
 *   2024-03-01 -> 2024-02-29).
 * Returns null when todayStr is not a valid date key.
 */
export function paymentDateChipTargets(todayStr) {
  if (!isValidPaymentDateKey(todayStr)) return null;
  const today = utcMidnight(todayStr);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const prevMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  return {
    today: todayStr,
    yesterday: dateKeyFromUtc(yesterday),
    prevMonthEnd: dateKeyFromUtc(prevMonthEnd)
  };
}

/**
 * Resolve a chip tap to the payment date it selects.
 * chip: 'today' | 'yesterday' | 'prev-month-end' | 'custom'.
 * 'custom' returns the operator's own typed date (validated) — the chip
 * itself never invents a date. Anything unknown/invalid returns null.
 */
export function computePaymentDateChip(chip, todayStr, customDate = null) {
  const targets = paymentDateChipTargets(todayStr);
  if (!targets) return null;
  if (chip === 'today') return targets.today;
  if (chip === 'yesterday') return targets.yesterday;
  if (chip === 'prev-month-end') return targets.prevMonthEnd;
  if (chip === 'custom') return isValidPaymentDateKey(customDate) ? customDate : null;
  return null;
}

/**
 * The month-attribution guard, mirrored for UI pre-checks: a payment date
 * after the PKT entry day is refused (core validatePayment enforces the
 * same rule at record time). String comparison is exact for valid
 * 'YYYY-MM-DD' keys. Invalid inputs are not "future" — the recorder's own
 * date validation reports those.
 */
export function isFuturePaymentDate(dateStr, todayStr) {
  if (!isValidPaymentDateKey(dateStr) || !isValidPaymentDateKey(todayStr)) return false;
  return dateStr > todayStr;
}
