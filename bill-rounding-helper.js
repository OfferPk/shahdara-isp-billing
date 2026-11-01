// SISP-131: Pro-Rata & Concession "Nearest Rs. 50" Note Rounding.
//
// Collectors settle in cash notes, so an odd computed credit — a SISP-30
// outage concession of Rs. 2,419, or a SISP-8 mid-month package-change
// pro-rata credit — is awkward to honour exactly. This module rounds such
// CREDIT computations to clean Rs. 50 notes, but only when the operator
// explicitly turns the [Round to Rs. 50] toggle on in the flow that stamps
// the credit. With the toggle off, nothing in this module is consulted and
// both flows behave exactly as before.
//
// The stamped figure IS the rounded figure: the concession stamp
// (bill.concessionAmount) and the recorded pro-rata credit are what the
// allocation engine, receipts and the Khata Doctor read, so rounding at
// stamp time needs zero engine changes and can never split the ledger.
// The unrounded figure survives in an audit tag — { rawAmount,
// roundedAmount, mode } — recorded on the bill's amountHistory entry
// (concession) or the customer's packageHistory entry (pro-rata). No tag
// is written when raw == rounded (nothing was actually rounded).
//
// Rounding NEVER applies to payments, package fees or kist amounts — the
// only callers are the two credit computations above.
//
// Pure helpers, no imports, synthetic data only in tests.

/** The three rounding modes accepted by roundToNearest50. */
export const ROUNDING_MODES = ['nearest', 'down', 'exact'];

/** Note step every rounded credit lands on. */
export const ROUNDING_STEP_PKR = 50;

export function isRoundingMode(mode) {
  return ROUNDING_MODES.includes(mode);
}

/**
 * Round a whole-rupee credit amount to a clean Rs. 50 note figure.
 *
 *   'nearest' — closest multiple of 50; an exact midpoint rounds UP
 *               (Rs. 2,425 -> Rs. 2,450), matching how a collector would
 *               settle a half-note in the customer's favour.
 *   'down'    — floor to a multiple of 50 (Rs. 2,499 -> Rs. 2,450).
 *   'exact'   — no rounding; the amount is returned unchanged.
 *
 * Amounts in this app's credit flows are whole rupees; a fractional input
 * is accepted and absorbed by the rounding for 'nearest'/'down' (the
 * result is always a whole multiple of 50), while 'exact' returns the
 * input untouched, fraction included.
 *
 * Credits are >= 0 by construction (the concession sanitizer and the
 * pro-rata credit magnitude both guarantee it), so invalid input is a
 * caller bug and fails loudly instead of being silently "fixed":
 *   - non-number or non-finite amount -> TypeError
 *   - negative amount                 -> RangeError
 *   - unknown mode                    -> Error
 */
export function roundToNearest50(amountPKR, mode = 'nearest') {
  if (typeof amountPKR !== 'number' || !Number.isFinite(amountPKR)) {
    throw new TypeError('Rounding amount must be a finite number.');
  }
  if (amountPKR < 0) {
    throw new RangeError('Rounding amount cannot be negative.');
  }
  if (!isRoundingMode(mode)) {
    throw new Error(`Unknown rounding mode: ${mode}.`);
  }
  if (mode === 'exact') return amountPKR;
  if (mode === 'down') return Math.floor(amountPKR / ROUNDING_STEP_PKR) * ROUNDING_STEP_PKR;
  // 'nearest': Math.round sends exact halves toward +Infinity, which for
  // these non-negative amounts is exactly "midpoints round up".
  return Math.round(amountPKR / ROUNDING_STEP_PKR) * ROUNDING_STEP_PKR;
}

/**
 * The audit tag for one rounding, or null when nothing was rounded
 * (raw == rounded, e.g. an exact multiple of 50, or mode 'exact') or
 * when the described rounding is not a valid one. The tag is the only
 * place the unrounded figure survives once the rounded figure is
 * stamped, so it carries exactly { rawAmount, roundedAmount, mode }.
 */
export function roundingTagFor(rawAmount, roundedAmount, mode) {
  if (!isRoundingMode(mode)) return null;
  const raw = Number(rawAmount);
  const rounded = Number(roundedAmount);
  if (!Number.isFinite(raw) || !Number.isFinite(rounded)) return null;
  if (raw === rounded) return null;
  return { rawAmount: raw, roundedAmount: rounded, mode };
}

/**
 * Validate a rounding tag arriving from a caller (profile save, collect
 * flow) before it is written into a ledger history entry. Returns a
 * clean { rawAmount, roundedAmount, mode } or null for anything
 * malformed or for a "rounding" that changed nothing.
 */
export function sanitizeRoundingTag(value) {
  if (!value || typeof value !== 'object') return null;
  return roundingTagFor(value.rawAmount, value.roundedAmount, value.mode);
}

/**
 * Apply the toggle to one computed credit amount.
 * Returns { amount, rounding } — with the toggle off (or mode 'exact',
 * or an amount already on a note boundary) amount is the input and
 * rounding is null; with rounding actually applied, amount is the
 * rounded figure and rounding is its audit tag.
 */
export function roundedAmountFor(amountPKR, { enabled = false, mode = 'nearest' } = {}) {
  if (enabled !== true) return { amount: amountPKR, rounding: null };
  const rounded = roundToNearest50(amountPKR, mode);
  return { amount: rounded, rounding: roundingTagFor(amountPKR, rounded, mode) };
}
