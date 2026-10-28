// SISP-8: Pro-Rata Package Upgrade & Temporary Vacation Hold (Freeze).
//
// Pure helpers for the vacation hold. This module imports nothing, so
// core.js and billing-cycle.js can both use it without a cycle.
//
// Model (flat fields on the customer record, backward compatible):
//   paused             boolean, default false
//   pauseStartDate     'YYYY-MM-DD' | null — first day of the hold
//   autoResumeDate     'YYYY-MM-DD' | null — optional auto-resume day
//   pauseSkippedMonths ['YYYY-MM', ...] — months an automatic billing
//     path skipped because of a hold. Recorded, never backfilled: a
//     skipped month stays unbilled even after the customer resumes, so
//     a frozen customer is never double-billed on resume.
//
// A month is billing-paused when it is recorded as skipped, or when the
// hold is active for it: month >= pause month and (no auto-resume, or
// month < auto-resume month). Months before the pause month are never
// paused, and a hold without a valid start date pauses nothing (the
// edit form rejects that state; billing never silently skips months it
// cannot bound).
//
// Pro-rata upgrades are NOT re-implemented here: the mid-month package
// change calculator (calculatePlanMigrationProration in
// form-validation.js, with the profile save-flow voucher) already exists
// and is pinned by tests. It charges by actual days-in-month rather
// than the spec's /30 shorthand — the more accurate of the two, and the
// preview and the saved voucher agree. SISP-8 wires the freeze into the
// billing paths and adds QA rules covering both the hold and the
// existing pro-rata history entries.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isRealCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

export function isValidPauseDate(value) {
  return isRealCalendarDate(value);
}

export function isValidPauseMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

// Normalize the four hold fields from any stored shape. Unknown or
// corrupt values fall back to the "no hold" defaults, so old saves load
// exactly as before.
export function sanitizePauseFields(customer) {
  const record = customer && typeof customer === 'object' ? customer : {};
  const skipped = Array.isArray(record.pauseSkippedMonths)
    ? [...new Set(record.pauseSkippedMonths.filter((month) => isValidPauseMonth(month)))].sort()
    : [];
  return {
    paused: record.paused === true,
    pauseStartDate: isValidPauseDate(record.pauseStartDate) ? record.pauseStartDate : null,
    autoResumeDate: isValidPauseDate(record.autoResumeDate) ? record.autoResumeDate : null,
    pauseSkippedMonths: skipped
  };
}

// Validate a hold as the profile edit form saves it. Returns an error
// message, or null when the hold is valid. Not paused => always valid.
export function validatePauseFields(fields) {
  const { paused, pauseStartDate, autoResumeDate } = fields || {};
  if (paused !== true) return null;
  if (!isValidPauseDate(pauseStartDate)) return 'Set a pause start date for the vacation hold.';
  if (autoResumeDate !== null && autoResumeDate !== undefined && autoResumeDate !== '' && !isValidPauseDate(autoResumeDate)) {
    return 'Auto-resume date is not a valid date.';
  }
  if (isValidPauseDate(autoResumeDate) && autoResumeDate <= pauseStartDate) {
    return 'Auto-resume date must be after the pause start date.';
  }
  return null;
}

function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + number - 1 + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

// Every month in [startMonth, endMonthExclusive). Empty when the range
// is empty or reversed; capped so a corrupt range cannot loop forever.
export function pauseMonthsBetween(startMonth, endMonthExclusive) {
  const months = [];
  if (!isValidPauseMonth(startMonth) || !isValidPauseMonth(endMonthExclusive)) return months;
  let current = startMonth;
  while (current < endMonthExclusive && months.length <= 120) {
    months.push(current);
    current = shiftMonth(current, 1);
  }
  return months;
}

// True when no new monthly charge may be generated for this customer in
// this month: a recorded skipped month, or a month inside the active
// hold window. A month with an existing bill is handled by the callers
// (existing bills are adopted, never rewritten), so this answers only
// the "may a NEW charge be created" question.
export function isBillingPaused(customer, month) {
  if (!isValidPauseMonth(month)) return false;
  const { paused, pauseStartDate, autoResumeDate, pauseSkippedMonths } = sanitizePauseFields(customer);
  if (pauseSkippedMonths.includes(month)) return true;
  if (paused !== true || !pauseStartDate) return false;
  const pauseMonth = pauseStartDate.slice(0, 7);
  if (month < pauseMonth) return false;
  if (autoResumeDate && month >= autoResumeDate.slice(0, 7)) return false;
  return true;
}

// One-line human label for the profile view and header badge.
export function pauseStatusLabel(customer) {
  const { paused, pauseStartDate, autoResumeDate } = sanitizePauseFields(customer);
  if (paused !== true || !pauseStartDate) return 'Not paused';
  if (autoResumeDate) return `Paused since ${pauseStartDate} · auto-resumes ${autoResumeDate}`;
  return `Paused since ${pauseStartDate} · until resumed`;
}

// Months to record as skipped when a hold ends (manual resume): every
// month from the pause month up to — but not including — the resume
// month, minus months that already have a bill (a bill created before
// the pause is legitimate and must never be flagged as a skipped month).
export function pauseSkippedMonthsOnResume(customer, resumeMonth) {
  const { paused, pauseStartDate, pauseSkippedMonths } = sanitizePauseFields(customer);
  if (paused !== true || !pauseStartDate || !isValidPauseMonth(resumeMonth)) return pauseSkippedMonths;
  const billedMonths = new Set(
    (Array.isArray(customer?.bills) ? customer.bills : []).map((bill) => bill?.month).filter((month) => isValidPauseMonth(month))
  );
  const newlySkipped = pauseMonthsBetween(pauseStartDate.slice(0, 7), resumeMonth)
    .filter((month) => !billedMonths.has(month));
  return [...new Set([...pauseSkippedMonths, ...newlySkipped])].sort();
}
