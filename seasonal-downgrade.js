// SISP-153: Seasonal CCTV / Keep-Alive Package Downgrade & Auto-Restore
// (موسمی پیکج تبدیلی).
//
// Pure helpers for the seasonal keep-alive rate. This module imports
// nothing, so core.js and billing-cycle.js can both use it without a
// cycle (the pause-billing.js precedent).
//
// Model (flat fields on the customer record, backward compatible):
//   seasonalRatePKR       number | null — temporary keep-alive rate
//   seasonalUntilMonth    'YYYY-MM' | null — last month at that rate
//   restorePackageRatePKR number | null — regular rate billed again
//                         from the month after seasonalUntilMonth
//
// The triple is ALL-OR-NOTHING: if any part is missing or invalid the
// whole triple is inert and pricing falls back to the monthly price
// schedule exactly as before. Records that never had the fields price
// exactly as they always have — there is no migration.
//
// The seasonal rule lives at the ONE price seam (applicablePriceForMonth
// in billing-cycle.js, plus the auto-generator's bill creation in
// core.js, which prices new bills through the same helper):
//   billingMonth <= seasonalUntilMonth -> seasonalRatePKR
//   billingMonth >  seasonalUntilMonth -> restorePackageRatePKR
// The second line IS the auto-restore, and it is purely derived from
// the month: no job runs at expiry, no record is rewritten, and the
// fields stay on the record as history. Only the PRICE changes — the
// package name/speed never does, and no packageHistory entry is ever
// written for a seasonal set or restore (a seasonal rate is not a
// package change; changeCustomerPackage is a different flow).
//
// Retroactivity guard: this helper only ever prices a month when a
// bill for it does not exist yet. Already-generated bills keep their
// stamped dueAmount/priceSnapshot — the cycle planner adopts existing
// bills untouched and the auto-generator skips months that already
// have one — so setting a seasonal rate can never reprice history.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidSeasonalMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

const isEmpty = (value) => value === null || value === undefined || value === '';

// A seasonal money field: a finite number above zero, rounded to
// paisa. Anything else (zero, negative, text, NaN) is not a rate.
function seasonalMoneyOrNull(value) {
  if (isEmpty(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100) / 100;
}

// Normalize the three seasonal fields from any stored shape. A partial
// or corrupt triple sanitizes to all-null (inert), so old saves and
// hand-edited backups load exactly as if no seasonal rate were set.
export function sanitizeSeasonalFields(source) {
  const record = source && typeof source === 'object' ? source : {};
  const seasonalRatePKR = seasonalMoneyOrNull(record.seasonalRatePKR);
  const seasonalUntilMonth = isValidSeasonalMonth(record.seasonalUntilMonth) ? record.seasonalUntilMonth : null;
  const restorePackageRatePKR = seasonalMoneyOrNull(record.restorePackageRatePKR);
  if (seasonalRatePKR === null || seasonalUntilMonth === null || restorePackageRatePKR === null) {
    return { seasonalRatePKR: null, seasonalUntilMonth: null, restorePackageRatePKR: null };
  }
  return { seasonalRatePKR, seasonalUntilMonth, restorePackageRatePKR };
}

export function hasSeasonalTriple(customer) {
  return sanitizeSeasonalFields(customer).seasonalRatePKR !== null;
}

// Validate a seasonal triple as the profile edit form saves it.
// Returns an error message, or null when valid. The window is defined
// by rate + until month: both empty is a valid CLEAR (no seasonal
// rate — a lone restore value is inert and clears with them, which is
// what lets the form pre-fill the restore rate without forcing a
// seasonal rate onto every profile save). Once either window field is
// present, all three must be valid, so the form can never save half
// a rule.
export function validateSeasonalFields(fields) {
  const record = fields && typeof fields === 'object' ? fields : {};
  const { seasonalRatePKR, seasonalUntilMonth, restorePackageRatePKR } = record;
  if (isEmpty(seasonalRatePKR) && isEmpty(seasonalUntilMonth)) return null;
  if (seasonalMoneyOrNull(seasonalRatePKR) === null) return 'Enter a seasonal keep-alive rate above zero, or clear the seasonal rate and until month.';
  if (!isValidSeasonalMonth(seasonalUntilMonth)) return 'Choose the last month billed at the seasonal rate, or clear the seasonal rate and until month.';
  if (seasonalMoneyOrNull(restorePackageRatePKR) === null) return 'Enter the regular rate to restore after the seasonal months.';
  return null;
}

// The price a valid seasonal triple assigns to a month, or null when
// the customer carries no valid triple (or the month is unreadable) —
// null means "not seasonal business: use the price schedule".
export function seasonalPriceFor(customer, month) {
  if (!isValidSeasonalMonth(month)) return null;
  const { seasonalRatePKR, seasonalUntilMonth, restorePackageRatePKR } = sanitizeSeasonalFields(customer);
  if (seasonalRatePKR === null) return null;
  return month <= seasonalUntilMonth ? seasonalRatePKR : restorePackageRatePKR;
}

// Window state of a valid triple for one month: 'active' while the
// month is inside the seasonal window, 'expired' after it. Null when
// there is no valid triple or the month is unreadable.
export function seasonalStateForMonth(customer, month) {
  if (!isValidSeasonalMonth(month)) return null;
  const { seasonalRatePKR, seasonalUntilMonth } = sanitizeSeasonalFields(customer);
  if (seasonalRatePKR === null) return null;
  return month <= seasonalUntilMonth ? 'active' : 'expired';
}
