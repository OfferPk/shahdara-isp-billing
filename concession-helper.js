// SISP-30: Outage-Linked Bill Concession (Reaayat) Calculator & Dispute Guard.
//
// Problem: subscribers with multi-hour / multi-day fiber cuts (logged in the
// SISP-15 complaint register, summarized by SISP-16 downtime analytics) ask
// collectors for a bill discount, and collectors guess the number. This module
// computes the suggestion from logged downtime only — it never invents hours
// and never touches SISP-2 cycle math or SISP-16 analytics math.
//
// Formula (spec): suggested concession = round((packageRate / 720) * downtimeHours),
// where 720 = 30 days x 24 hours in a billing month. A customer is eligible
// when the month's logged downtime meets the threshold (default >= 12 hours).
//
// Dispute Guard: a concession is a bill field (concessionAmount +
// concessionReason + concessionAppliedAt), never a silent price edit. Applying
// SETS the amount (never adds to an existing one, so re-applying cannot stack),
// clamps it to the bill's gross amount (dueAmount + lateFee, never negative),
// and is recorded in the bill's amountHistory by core.js. Removing it clears
// the fields; the bill amount itself is never rewritten.
//
// All helpers are pure except buildConcessionSuggestion's reads of the passed
// complaints list. Tests use synthetic data only.

import { buildCustomerDowntimeSummary } from './downtime-analytics.js';
import { applicablePriceForMonth } from './billing-cycle.js';
import { roundedAmountFor } from './bill-rounding-helper.js';

/** Downtime hours in a billed month at/above which a concession is suggested. */
export const CONCESSION_THRESHOLD_HOURS = 12;
/** Hours in a billing month used for the pro-rata formula (30 days x 24h). */
export const CONCESSION_HOURS_PER_MONTH = 720;

const positiveNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Clamp a concession amount to a finite, non-negative, 2-decimal number. */
export function sanitizeConcessionAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Pro-rata concession for a package rate and logged downtime hours.
 * Returns 0 for missing, zero or negative inputs — never a negative number.
 */
export function concessionAmountFor(packageRate, downtimeHours) {
  const rate = positiveNumber(packageRate);
  const hours = Number(downtimeHours);
  if (rate === null || !Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round((rate / CONCESSION_HOURS_PER_MONTH) * hours);
}

/** Audit reason stored on the bill, e.g. "Outage Reaayat: 72h offline". */
export function concessionReasonFor(downtimeHours) {
  const hours = Number(downtimeHours);
  const shown = Number.isFinite(hours) ? hours : 0;
  return `Outage Reaayat: ${shown}h offline`;
}

/**
 * Pure suggestion from a package rate + downtime hours. Eligible only at or
 * above the threshold; below it the suggested amount is still computed for
 * display but eligible is false and no apply button should render.
 */
export function suggestConcession({ packageRate = null, downtimeHours = 0, thresholdHours = CONCESSION_THRESHOLD_HOURS } = {}) {
  const hours = Number(downtimeHours);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const rate = positiveNumber(packageRate);
  const threshold = Number.isFinite(Number(thresholdHours)) && Number(thresholdHours) > 0
    ? Number(thresholdHours)
    : CONCESSION_THRESHOLD_HOURS;
  const suggestedAmount = rate === null ? 0 : concessionAmountFor(rate, safeHours);
  const eligible = safeHours >= threshold && suggestedAmount > 0;
  return {
    eligible,
    downtimeHours: safeHours,
    packageRate: rate,
    thresholdHours: threshold,
    suggestedAmount,
    reason: eligible ? concessionReasonFor(safeHours) : ''
  };
}

/**
 * Full suggestion for one bill: downtime from SISP-16 (complaints in the
 * bill's month only), rate from the SISP-2 price-schedule rule, falling back
 * to the bill's own due amount when no price-schedule entry applies.
 * Returns the stored concession alongside, so callers can render the applied
 * state instead of a second suggestion.
 */
export function buildConcessionSuggestion(customer, bill, complaints, { thresholdHours = CONCESSION_THRESHOLD_HOURS } = {}) {
  if (!customer || !bill || !bill.month) {
    return { ...suggestConcession({ packageRate: null, downtimeHours: 0, thresholdHours }), month: bill?.month ?? '', customerId: customer?.id ?? null, existingAmount: 0, existingReason: '', alreadyApplied: false };
  }
  const summary = buildCustomerDowntimeSummary(Array.isArray(complaints) ? complaints : [], customer.id, bill.month);
  const scheduled = applicablePriceForMonth(customer, bill.month);
  const fallback = positiveNumber(bill.dueAmount);
  const suggestion = suggestConcession({ packageRate: scheduled ?? fallback, downtimeHours: summary.totalDowntime, thresholdHours });
  const existingAmount = sanitizeConcessionAmount(bill.concessionAmount);
  return {
    ...suggestion,
    month: bill.month,
    customerId: customer.id,
    complaintCount: summary.complaintCount,
    existingAmount,
    existingReason: typeof bill.concessionReason === 'string' ? bill.concessionReason : '',
    alreadyApplied: existingAmount > 0
  };
}

/**
 * Net due after a concession. Never increases the due and never goes below
 * zero — the guard that makes a concession a reduction only.
 */
export function netDueAfterConcession(netDue, concessionAmount) {
  const due = Number(netDue);
  const safeDue = Number.isFinite(due) && due > 0 ? due : 0;
  return Math.max(0, Math.round((safeDue - sanitizeConcessionAmount(concessionAmount)) * 100) / 100);
}

/**
 * SISP-131: apply the operator's [Round to Rs. 50] toggle to a
 * suggestion. Returns the suggestion with suggestedAmount replaced by
 * the rounded figure, the original kept as rawSuggestedAmount, and the
 * audit tag (or null) as rounding — ready to hand to
 * applyConcessionToBill. With the toggle off (the default) the
 * suggestion is returned unchanged apart from the two bookkeeping
 * fields, so callers can route every apply through here safely.
 */
export function roundedConcessionSuggestion(suggestion, { enabled = false, mode = 'nearest' } = {}) {
  if (!suggestion || typeof suggestion !== 'object') return suggestion;
  const raw = Number(suggestion.suggestedAmount) || 0;
  const { amount, rounding } = roundedAmountFor(raw, { enabled, mode });
  return { ...suggestion, rawSuggestedAmount: raw, suggestedAmount: amount, rounding };
}

/** Exact badge text required by the spec for the Collect / Profile surfaces. */
export function concessionBadgeText(suggestion) {
  const hours = suggestion?.downtimeHours ?? 0;
  const amount = suggestion?.suggestedAmount ?? 0;
  return `Monthly Downtime: ${hours} hrs • Suggested Pro-Rata Concession: Rs. ${amount}`;
}
