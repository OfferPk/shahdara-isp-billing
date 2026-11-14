/**
 * customer-card-style.js — Unpaid Cards: presentation helpers for the
 * customer card, kept PURE so the roster render and the tests share
 * the same rules. No DOM, no storage, no money math.
 *
 * The ID pill cycles colours by customer number — 1 black, 2 yellow,
 * 3 green, then blue, slate, red, teal, orange, and back to black
 * (an 8-colour rotation). The health value is coloured by SCORE band
 * (70+ green, 40–70 yellow, below 40 red), not by the category word:
 * the category text stays exactly as buildCustomerHealthScore
 * reports it. Every colour is one of the palettes already in
 * styles.css (health-good / health-risk / health-critical,
 * status-partial, status-received, the service badges) — no new hex.
 */

/** How many colours the ID pill rotates through. */
export const CUSTOMER_ID_PILL_CLASS_COUNT = 8;

/**
 * The rotation class for one customer number, or '' when the record
 * carries no usable number (the pill then keeps its default grey).
 * Customer 1 -> -0 (black), 2 -> -1 (yellow), 3 -> -2 (green),
 * 4 -> -3 (blue), 5 -> -4 (purple), 6 -> -5 (red), 7 -> -6 (teal),
 * 8 -> -7 (orange), 9 -> -0 again. A numeric string counts the
 * same as the number; 0, negatives and non-numbers get no class.
 */
export function customerIdPillClass(customerNumber) {
  const number = Number(customerNumber);
  if (!Number.isFinite(number)) return '';
  const whole = Math.floor(number);
  if (whole < 1) return '';
  return `customer-id-pill-${(whole - 1) % CUSTOMER_ID_PILL_CLASS_COUNT}`;
}

/**
 * The score-band class for one health score, or '' when there is no
 * score to band (null / undefined / non-numeric — the value then
 * reads "Insufficient history" with no band colour). Bands follow
 * the user's rule: 70+ green, 40–70 yellow, below 40 red.
 */
export function healthScoreBandClass(score) {
  // A null/undefined/empty/boolean score is "no score", never zero —
  // Number(null) is 0, and a missing score must never read as a red
  // low band (the money formatter's finiteCents lesson).
  if (score === null || score === undefined || score === '' || typeof score === 'boolean') return '';
  const value = Number(score);
  if (!Number.isFinite(value)) return '';
  if (value >= 70) return 'health-score-high';
  if (value >= 40) return 'health-score-mid';
  return 'health-score-low';
}

// Health reasons live in the profile's Billing tab only (Customers
// Cards Compact, B2) — the card's <details> element and this helper
// were deleted with it; do not re-add a card-side reasons pill.
