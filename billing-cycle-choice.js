// Plan 36 — Per-customer billing cycle and due-date choice.
//
// A billing-cycle record only: one due day per customer (for example the
// 1st or the 15th), with the date the choice changed. It is applied to
// bills raised after the change; past bills, existing due dates, payment
// totals and Waada promises are never rewritten by this module, and
// billing presentation (Plan P) is untouched.
//
// The app's shared rhythm is unchanged: a customer with no cycle record
// keeps the existing default — bills fall due on the 5th of the bill
// month, exactly as the auto-generator stamps them today. A cycle record
// only changes the due date of bills whose month is the change month or
// later; bills for earlier months keep whatever due date they already
// have (or the 5th default when they have none).
//
// The reminder queue (Plan 11) reads a bill's own dueDate, so a bill
// raised with a cycle due date is automatically reminded on the
// customer's own date — Plan 11 itself is neither duplicated nor
// rewritten here.
//
// Pure and import-free: every helper takes plain data and returns new
// data. The caller owns storage (the app keeps one record per customer
// in its own localStorage store); nothing here touches localStorage,
// a bill, a payment, or a Waada record.

/** The shared default: bills fall due on the 5th of the bill month. */
export const DEFAULT_BILL_DUE_DAY = 5;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/** True only for a real calendar date (2026-02-30 is rejected, never guessed). */
export function isValidBillingCycleDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidBillingCycleMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/**
 * A due day is an integer day-of-month, 1–31. Numeric strings are
 * accepted ("15" → 15); anything else — 0, 32, fractions, blanks,
 * non-numeric text — is null, never silently clamped or rounded.
 */
export function normalizeBillingDueDay(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 1 && value <= 31 ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value.trim());
    if (Number.isInteger(num) && num >= 1 && num <= 31) return num;
  }
  return null;
}

/**
 * One normalised cycle record, or null when it cannot be one: a missing
 * customer id or an invalid due day is rejected outright, never stored
 * half-formed. An invalid change date becomes null (the record then
 * applies to every bill month — the operator's current choice) rather
 * than a guessed date; a note is trimmed, never invented.
 */
export function normalizeBillingCycleChoice(value) {
  if (!value || typeof value !== 'object') return null;
  const customerId = text(value.customerId);
  const dueDay = normalizeBillingDueDay(value.dueDay);
  if (!customerId || dueDay === null) return null;
  return {
    customerId,
    dueDay,
    changedAt: isValidBillingCycleDate(value.changedAt) ? value.changedAt : null,
    note: text(value.note),
  };
}

/**
 * A caller-owned list, normalised: rejects dropped, one record per
 * customer with the last record winning, sorted by customer id so the
 * same input always yields the same list. Inputs are never mutated.
 */
export function normalizeBillingCycleChoices(list) {
  if (!Array.isArray(list)) return [];
  const byCustomer = new Map();
  for (const entry of list) {
    const choice = normalizeBillingCycleChoice(entry);
    if (choice) byCustomer.set(choice.customerId, choice);
  }
  return [...byCustomer.values()].sort((a, b) => (a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0));
}

export function findBillingCycleChoice(choices, customerId) {
  const id = text(customerId);
  if (!id) return null;
  return normalizeBillingCycleChoices(choices).find((choice) => choice.customerId === id) ?? null;
}

/** Upsert: one record per customer, last write wins, inputs never mutated. */
export function upsertBillingCycleChoice(choices, choice) {
  const next = normalizeBillingCycleChoices(choices);
  const clean = normalizeBillingCycleChoice(choice);
  if (!clean) return next;
  return normalizeBillingCycleChoices([...next.filter((entry) => entry.customerId !== clean.customerId), clean]);
}

/** Remove a customer's record; an unknown id leaves the list unchanged. */
export function removeBillingCycleChoice(choices, customerId) {
  const id = text(customerId);
  const next = normalizeBillingCycleChoices(choices);
  if (!id) return next;
  return next.filter((entry) => entry.customerId !== id);
}

/** Days in a bill month (leap-aware); null for an invalid month. */
export function daysInBillingMonth(month) {
  if (!isValidBillingCycleMonth(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

const padDay = (day) => String(day).padStart(2, '0');

/**
 * The due date a bill for `month` gets under `choice`: the due day,
 * clamped to the month's length (the 31st becomes the 28th/29th/30th in
 * a shorter month — never an invalid date). No choice means the shared
 * 5th default. An invalid month yields null, never a guessed date.
 */
export function dueDateForBillMonth(choice, month) {
  const days = daysInBillingMonth(month);
  if (days === null) return null;
  const clean = normalizeBillingCycleChoice(choice);
  const day = clean ? Math.min(clean.dueDay, days) : DEFAULT_BILL_DUE_DAY;
  return `${month}-${padDay(day)}`;
}

/**
 * The due date for one bill, honouring the change month:
 * - no cycle record → the bill's existing due date, or the 5th default;
 * - bill month before the change month → the bill's existing due date,
 *   or the 5th default (an earlier bill keeps its old date);
 * - bill month in or after the change month, or a record with no change
 *   date recorded → the cycle due date for that month.
 * Existing bills are therefore never repriced by this helper; only a
 * bill being raised (or explicitly re-resolved) moves to the new date.
 */
export function dueDateForBill({ choice = null, month = '', existingDueDate = null } = {}) {
  if (!isValidBillingCycleMonth(month)) return isValidBillingCycleDate(existingDueDate) ? existingDueDate : null;
  const clean = normalizeBillingCycleChoice(choice);
  if (!clean) return isValidBillingCycleDate(existingDueDate) ? existingDueDate : dueDateForBillMonth(null, month);
  const changeMonth = clean.changedAt ? clean.changedAt.slice(0, 7) : null;
  if (changeMonth && month < changeMonth) {
    return isValidBillingCycleDate(existingDueDate) ? existingDueDate : dueDateForBillMonth(null, month);
  }
  return dueDateForBillMonth(clean, month);
}

const ordinalSuffix = (day) => {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
  if (day % 10 === 1) return 'st';
  if (day % 10 === 2) return 'nd';
  if (day % 10 === 3) return 'rd';
  return 'th';
};

/** Plain-words summary for the profile: current cycle and change date. */
export function billingCycleChoiceSummaryText(choice) {
  const clean = normalizeBillingCycleChoice(choice);
  if (!clean) return 'No billing cycle choice recorded — bills fall due on the 5th of each month.';
  const changed = clean.changedAt ? `, changed on ${clean.changedAt}` : ', change date not recorded';
  const note = clean.note ? ` Note: ${clean.note}` : '';
  return `Due on the ${clean.dueDay}${ordinalSuffix(clean.dueDay)} of each month${changed}.${note}`;
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Escaped profile line for the current cycle; never throws on bad input. */
export function billingCycleChoiceHtml(choice) {
  return `<p>${escapeHtml(billingCycleChoiceSummaryText(choice))}</p>`;
}
