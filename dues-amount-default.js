// Quick Collect amount default (Plan 429): the amount field defaults
// to the customer's FULL current dues — every open bill's remaining
// balance, from the allocation engine's own figures, plus unpaid
// manual baqaya — filled in as soon as the customer is chosen, still
// editable before saving. The default only offers; it posts nothing
// by itself and it changes no bill, payment, or customer record.
//
// What already exists, and what this plan does NOT rebuild: the
// oldest-bill pre-fill offers the oldest open bill only, and the
// picker already shows the shared total (bill dues plus unpaid manual
// baqaya). The missing piece is only the amount default itself: the
// field used to start at the oldest bill alone, so a customer with
// two open bills made the operator look up the rest and type it.
// Ticket and boost charges are NOT dues — they stay on the
// charge-settling override in the wiring, which lifts the suggested
// amount to the full payable when charges are pending; this module
// never adds them.
//
// A customer with no dues defaults to nothing: the default is null
// and the field starts blank, exactly as before. Only a bill the
// engine still shows as open counts: a bill whose balance is zero or
// negative is not open, and a bill with no usable month is skipped.
//
// The module is standalone: it reads no storage, clock, network, or
// page. Inputs are never mutated.

const DUES_AMOUNT_DEFAULT_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

/** Strict YYYY-MM month (01–12). */
export function isStrictDuesAmountDefaultMonth(value) {
  if (typeof value !== 'string') return false;
  const match = DUES_AMOUNT_DEFAULT_MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function cleanDuesAmountDefaultText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// A figure counts as cents only when it is a finite number: null,
// undefined, an empty string, or a boolean is "not a number", never
// zero — a null figure must never invent a zero-cent due, and a
// boolean must never read as one cent. (Same defensive rule as the
// overpayment choice.)
function finiteDuesAmountDefaultCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
}

/**
 * The customer's full current dues, in whole cents: every open bill's
 * remaining balance from the allocation engine, plus unpaid manual
 * baqaya in cents as supplied by the caller. 0 when the customer has
 * no dues, no usable id, or no allocation lookup — a figure that
 * cannot be worked out is never guessed.
 *
 * @param {Object} customer - the customer record ({ id, bills }).
 * @param {Object} allocations - the allocation engine result for the
 *   state, with a forMonth(customerId, month) lookup.
 * @param {number} manualBaqayaCents - unpaid manual baqaya, in cents.
 * @returns {number} whole cents of full dues, 0 when none.
 */
export function duesAmountDefaultCents(customer, allocations, manualBaqayaCents) {
  if (!customer || typeof customer !== 'object') return 0;
  const customerId = cleanDuesAmountDefaultText(customer.id);
  if (!customerId) return 0;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const forMonth = allocations && typeof allocations.forMonth === 'function'
    ? allocations.forMonth
    : null;
  if (!forMonth) return 0;
  let totalCents = 0;
  const ordered = bills
    .filter((bill) => bill && typeof bill === 'object' && isStrictDuesAmountDefaultMonth(bill.month))
    .sort((a, b) => a.month.localeCompare(b.month));
  for (const bill of ordered) {
    let summary = null;
    try {
      summary = forMonth(customerId, bill.month);
    } catch {
      return 0;
    }
    const balanceCents = finiteDuesAmountDefaultCents(summary?.balanceDueCents);
    if (balanceCents === null || balanceCents <= 0) continue;
    totalCents += balanceCents;
  }
  const baqayaCents = finiteDuesAmountDefaultCents(manualBaqayaCents);
  if (baqayaCents !== null && baqayaCents > 0) totalCents += baqayaCents;
  return Math.max(0, totalCents);
}

/**
 * The Quick Collect amount default, in PKR — the customer's full
 * current dues — or null when the customer has no dues, so the field
 * starts blank. The operator can change the filled amount freely
 * before saving; the default itself posts nothing.
 *
 * @param {Object} customer - the customer record ({ id, bills }).
 * @param {Object} allocations - the allocation engine result for the
 *   state, with a forMonth(customerId, month) lookup.
 * @param {number} manualBaqayaCents - unpaid manual baqaya, in cents.
 * @returns {number|null} full dues in PKR, or null when there are none.
 */
export function duesAmountDefault(customer, allocations, manualBaqayaCents) {
  const cents = duesAmountDefaultCents(customer, allocations, manualBaqayaCents);
  if (cents <= 0) return null;
  return cents / 100;
}

/** Format a default amount the way the app shows money (min-0 decimals). */
export function formatDuesAmountDefault(amount) {
  return Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
