// Plan 317 (Plan 203-350) — Monthly audit trail summary view.
//
// The operator action audit log (Plan 31) grows long, so the owner
// cannot see at a glance what kind of actions happened in a month.
// This module adds only the missing piece: a monthly summary
// composed from the existing audit log only — counts by action type
// and by operator, for one month. It is a composition, not a second
// log, and it never writes to the log.
//
// What this module is NOT, stated plainly:
//   - It is not the audit log. The log itself already exists and
//     is neither read nor rewritten here in storage terms; the
//     caller supplies every entry, and composing a summary never
//     adds, edits, or removes a log entry.
//   - It is not a monthly KPI record sheet (Plan 318 is a
//     different plan and is not implemented here): a summary
//     counts operator actions only, never collections, customers,
//     faults, or dues.
//   - It is not a device backup schedule record (Plan 316) and
//     not an export verification checklist (Plan 315); those
//     already exist and are neither read nor rewritten here.
//   - It is not a bill, payment, or staff record change.
//     Composing a summary never changes any log entry, bill,
//     payment, or staff record by itself.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every log
//     entry and every month, and the module never reads storage,
//     the clock, or the network, and never mutates an input.
//   - A summary shows no action detail beyond counts and operator
//     names: no record reference, no customer name, no detail
//     text, and no single entry date ever appears in it.
//   - An entry counts only when it has a known-shaped action and
//     a real calendar date in the requested month; anything else
//     is left out of the counts, never repaired or guessed.
//   - The operator is the entry's own recorded name; a blank
//     operator reads as "Not recorded", never as an invented name.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Plain-words labels for the action values the audit log records.
// Unknown action values are shown as written, never relabelled.
const ACTION_LABELS = {
  payment_recorded: 'Payment recorded',
  payment_voided: 'Payment voided',
  payment_corrected: 'Payment corrected',
  customer_archived: 'Customer archived',
  customer_unarchived: 'Customer unarchived',
  waada_set: 'Waada set',
  concession_applied: 'Concession applied',
  mode_switched: 'Operator mode switched',
  emergency_contact_edited: 'Emergency contact edited',
  month_close_reopened: 'Month close reopened',
  // QC-8: every field visit outcome leaves a field_visit audit
  // entry, so the monthly summary must label it too — otherwise
  // the summary would show the raw action value.
  field_visit: 'Field visit recorded',
  // Mohalla Seed: the Clear All payment-records wipe leaves a
  // payment_records_cleared audit entry, so the monthly summary
  // must label it too — otherwise the summary would show the raw
  // action value.
  payment_records_cleared: 'Payment records cleared',
};

const KNOWN_ACTION_ORDER = [
  'payment_recorded',
  'payment_voided',
  'payment_corrected',
  'customer_archived',
  'customer_unarchived',
  'waada_set',
  'concession_applied',
  'mode_switched',
  'emergency_contact_edited',
  'month_close_reopened',
  // QC-8: the field_visit action sorts last, after the older
  // actions, in the monthly summary's known-action order.
  'field_visit',
  // Mohalla Seed: the payment_records_cleared action sorts last,
  // after field_visit, in the monthly summary's known-action order.
  'payment_records_cleared',
];

const NOT_RECORDED = 'Not recorded';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar day: YYYY-MM-DD that really exists, or false. */
export function validMonthlyAuditSummaryDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

/** A month in YYYY-MM form with a real month number, or false. */
export function validMonthlyAuditSummaryMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return Boolean(match);
}

/** Plain-words label for a month, for example "November 2026"; empty for a bad month. */
export function monthlyAuditSummaryMonthLabel(month) {
  if (!validMonthlyAuditSummaryMonth(month)) return '';
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

/** Plain-words label for an action value; unknown actions are shown as written. */
export function monthlyAuditSummaryActionLabel(action) {
  return ACTION_LABELS[text(action)] ?? text(action);
}

/**
 * The calendar date of one audit log entry, or an empty string.
 * The entry's own date is used when it is a real day; otherwise
 * the date is taken from the start of its timestamp, when that
 * start is a real day. Nothing is guessed from a bad value.
 */
function entryDate(entry) {
  if (!entry || typeof entry !== 'object') return '';
  if (validMonthlyAuditSummaryDay(entry.date)) return entry.date;
  const fromTimestamp = typeof entry.timestamp === 'string' ? entry.timestamp.slice(0, 10) : '';
  return validMonthlyAuditSummaryDay(fromTimestamp) ? fromTimestamp : '';
}

/**
 * One log entry reduced to the two facts a monthly summary
 * counts — its action and its operator — plus its month, or
 * null when the entry has no action or no real calendar date.
 * Record references, customer names, detail text, and times
 * are dropped here, so they can never reach a summary.
 */
function monthlyAuditSummaryRow(entry) {
  const action = text(entry?.action);
  const date = entryDate(entry);
  if (!action || !date) return null;
  return { month: date.slice(0, 7), action, by: text(entry.by) || NOT_RECORDED };
}

/** Months present in the log, earliest first; months with no valid entry never appear. */
export function monthlyAuditMonths(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  for (const entry of list) {
    const row = monthlyAuditSummaryRow(entry);
    if (row) seen.add(row.month);
  }
  return [...seen].sort();
}

/**
 * The summary for one month: the total, the count per action
 * type, and the count per operator. Entries from other months
 * and entries with no action or no real date are left out, so
 * the counts reconcile exactly to the log entries of that
 * month. Returns null for a month that is not YYYY-MM.
 * The input list is never changed.
 */
export function monthlyAuditSummary(list, month) {
  if (!validMonthlyAuditSummaryMonth(month)) return null;
  const rows = Array.isArray(list) ? list : [];
  const byAction = {};
  const byOperator = {};
  let total = 0;
  for (const entry of rows) {
    const row = monthlyAuditSummaryRow(entry);
    if (!row || row.month !== month) continue;
    total += 1;
    byAction[row.action] = (byAction[row.action] ?? 0) + 1;
    byOperator[row.by] = (byOperator[row.by] ?? 0) + 1;
  }
  const orderedByAction = {};
  for (const action of KNOWN_ACTION_ORDER) {
    if (byAction[action]) orderedByAction[action] = byAction[action];
  }
  for (const action of Object.keys(byAction).sort()) {
    if (!(action in orderedByAction)) orderedByAction[action] = byAction[action];
  }
  const orderedByOperator = {};
  for (const operator of Object.keys(byOperator).sort()) {
    orderedByOperator[operator] = byOperator[operator];
  }
  return { month, total, byAction: orderedByAction, byOperator: orderedByOperator };
}

/** One summary per month present in the log, earliest month first. */
export function monthlyAuditSummaries(list) {
  return monthlyAuditMonths(list).map((month) => monthlyAuditSummary(list, month));
}

/**
 * Whether a summary reconciles to the log entries of its month:
 * the per-action counts and the per-operator counts each add up
 * to the summary total, which equals the number of valid entries
 * dated in that month. False for a missing summary.
 */
export function monthlyAuditSummaryReconciles(list, summary) {
  if (!summary || !validMonthlyAuditSummaryMonth(summary.month)) return false;
  const rows = Array.isArray(list) ? list : [];
  let inMonth = 0;
  for (const entry of rows) {
    const row = monthlyAuditSummaryRow(entry);
    if (row && row.month === summary.month) inMonth += 1;
  }
  const byActionTotal = Object.values(summary.byAction ?? {}).reduce((sum, count) => sum + count, 0);
  const byOperatorTotal = Object.values(summary.byOperator ?? {}).reduce((sum, count) => sum + count, 0);
  return summary.total === inMonth && byActionTotal === summary.total && byOperatorTotal === summary.total;
}

/** Plain-words summary: the month, the total, and the counts by action type and by operator. */
export function monthlyAuditSummaryText(summary) {
  if (!summary || !validMonthlyAuditSummaryMonth(summary.month)) return 'Choose a month to see its audit summary.';
  const label = monthlyAuditSummaryMonthLabel(summary.month);
  if (summary.total === 0) return `${label} — no operator actions logged.`;
  const actionParts = Object.entries(summary.byAction)
    .map(([action, count]) => `${monthlyAuditSummaryActionLabel(action)}: ${count}`);
  const operatorParts = Object.entries(summary.byOperator)
    .map(([operator, count]) => `${operator}: ${count}`);
  const actionWord = summary.total === 1 ? 'action' : 'actions';
  return `${label} — ${summary.total} ${actionWord}: ${actionParts.join(' · ')} — By operator: ${operatorParts.join(' · ')}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A summary as counts only: one table of counts by action type
 * and one list of counts by operator. No record reference, no
 * customer name, no detail text, and no entry date appears.
 */
export function monthlyAuditSummaryHtml(summary) {
  if (!summary || !validMonthlyAuditSummaryMonth(summary.month)) return '<p>Choose a month to see its audit summary.</p>';
  const label = monthlyAuditSummaryMonthLabel(summary.month);
  if (summary.total === 0) return `<p>${escapeHtml(label)} — no operator actions logged.</p>`;
  const actionRows = Object.entries(summary.byAction)
    .map(([action, count]) => `<tr><td>${escapeHtml(monthlyAuditSummaryActionLabel(action))}</td><td>${count}</td></tr>`)
    .join('');
  const operatorItems = Object.entries(summary.byOperator)
    .map(([operator, count]) => `<li>${escapeHtml(operator)} — ${count} action${count === 1 ? '' : 's'}</li>`)
    .join('');
  return `<h4>${escapeHtml(label)} — ${summary.total} action${summary.total === 1 ? '' : 's'}</h4>`
    + `<table class="audit-log-table"><thead><tr><th>Action</th><th>Count</th></tr></thead><tbody>${actionRows}</tbody></table>`
    + `<h4>By operator</h4><ul>${operatorItems}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** A summary as CSV: one count row per action type and per operator, with a fixed header. */
export function monthlyAuditSummaryCsv(summary) {
  const lines = ['month,section,name,count'];
  if (!summary || !validMonthlyAuditSummaryMonth(summary.month)) return lines.join('\n');
  for (const [action, count] of Object.entries(summary.byAction)) {
    lines.push([summary.month, 'action', monthlyAuditSummaryActionLabel(action), count].map(csvCell).join(','));
  }
  for (const [operator, count] of Object.entries(summary.byOperator)) {
    lines.push([summary.month, 'operator', operator, count].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** Fixed filename for one month's summary CSV; empty for a bad month. */
export function monthlyAuditSummaryFilename(month) {
  if (!validMonthlyAuditSummaryMonth(month)) return '';
  return `monthly-audit-summary-${month}.csv`;
}
