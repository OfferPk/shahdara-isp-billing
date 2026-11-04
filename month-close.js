// month-close.js — Plan 67 (Plan 1-100): month-end close checklist
// (ordered, ticked, never auto-closing).
//
// Month end used to be closed from memory, so a step — an unclosed
// day handover, an unclaimed suspense item, an unsent statement —
// was skipped and the next month started on an unchecked base.
// This module is the checklist only: one record per month, with the
// same six ordered steps every month, each ticked with a date and
// by whom, or explicitly waived with a reason. A month is marked
// "closed" only when every step is ticked or waived, and a closed
// month can be reopened only with an owner-recorded reason.
//
// The fences, stated plainly:
//   - Ticking, waiving, closing, or reopening a step never posts,
//     corrects, or closes any other record by itself. The module
//     holds no bill, payment, handover, suspense, wallet, vendor,
//     or owner-pack field of its own: it only records that the
//     operator ticked or waived each step, with a date, a name,
//     and (for a waiver or a reopen) a reason.
//   - This is the close routine, not the owner pack itself
//     (Plan R) and not the balance proof (Plan 68). It never
//     proves a balance and never prepares a pack.
//   - It is also not the SISP-130 month-end pre-flight wizard
//     (month-end-wizard.js), which checks gates before a new
//     billing cycle and writes nothing. That wizard is neither
//     read nor written here; this checklist is the operator's
//     own ticked record for the month, kept separately.
//   - Reopening is gated on a non-blank reason. The reason is
//     stored on the month record, and the app wiring also writes
//     it into the Plan 31 operator action audit log under the
//     month_close_reopened action, so the reopen is on the
//     record in two places, not just in this checklist.
//   - Dates are strict YYYY-MM-DD calendar dates (2026-02-30 is
//     not a date) and months are strict YYYY-MM. Inputs are
//     never mutated, and the module never reads storage, the
//     clock, or the network.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict YYYY-MM-DD calendar date, or false (2026-02-30 is not a date). */
export function validCloseDate(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

/** Strict YYYY-MM month key, or false. */
export function validCloseMonth(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

/** The six ordered close steps, identical for every month. */
export const CLOSE_STEPS = Object.freeze([
  { id: 'bills_raised', label: 'All bills raised' },
  { id: 'handovers_closed', label: 'All day handovers closed' },
  { id: 'suspense_reviewed', label: 'Suspense reviewed' },
  { id: 'wallet_reconciled', label: 'Wallet entries reconciled' },
  { id: 'vendor_bills_recorded', label: 'Vendor bills recorded' },
  { id: 'owner_pack_prepared', label: 'Owner pack prepared' },
]);

const STEP_IDS = new Set(CLOSE_STEPS.map((step) => step.id));

function stepLabel(stepId) {
  return CLOSE_STEPS.find((step) => step.id === stepId)?.label ?? stepId;
}

function normalizeStepState(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const stepId = cleanText(raw.stepId);
  if (!STEP_IDS.has(stepId)) return null;
  const state = cleanText(raw.state);
  if (state === 'pending') {
    return { stepId, state, date: '', by: '', reason: '' };
  }
  if (state === 'ticked') {
    if (!validCloseDate(raw.date) || !cleanText(raw.by)) return null;
    return { stepId, state, date: raw.date, by: cleanText(raw.by), reason: '' };
  }
  if (state === 'waived') {
    if (!validCloseDate(raw.date) || !cleanText(raw.by) || !cleanText(raw.reason)) return null;
    return { stepId, state, date: raw.date, by: cleanText(raw.by), reason: cleanText(raw.reason) };
  }
  return null;
}

/**
 * Normalise one month record, or null when it is half-formed.
 * A record with no month, an unknown step, a tick without a date
 * or a name, or a waiver without a reason is refused outright,
 * never stored half-formed. Steps not mentioned are pending.
 * A closed record keeps its close date/by; a reopened record
 * keeps its reopen reason, by, and date.
 */
export function normalizeMonthClose(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const month = cleanText(raw.month);
  if (!validCloseMonth(month)) return null;
  const steps = {};
  for (const step of CLOSE_STEPS) steps[step.id] = { stepId: step.id, state: 'pending', date: '', by: '', reason: '' };
  if (raw.steps && typeof raw.steps === 'object' && !Array.isArray(raw.steps)) {
    for (const [stepId, state] of Object.entries(raw.steps)) {
      if (!STEP_IDS.has(stepId)) return null;
      const normalised = normalizeStepState({ ...state, stepId });
      if (!normalised) return null;
      steps[stepId] = normalised;
    }
  } else if (Array.isArray(raw.steps)) {
    for (const state of raw.steps) {
      const normalised = normalizeStepState(state);
      if (!normalised) return null;
      steps[normalised.stepId] = normalised;
    }
  } else if (raw.steps !== undefined && raw.steps !== null) {
    return null;
  }
  const status = cleanText(raw.status);
  if (status !== '' && status !== 'open' && status !== 'closed') return null;
  const closedDate = cleanText(raw.closedDate);
  const closedBy = cleanText(raw.closedBy);
  if (status === 'closed' && (!validCloseDate(closedDate) || !closedBy)) return null;
  const reopenReason = cleanText(raw.reopenReason);
  const reopenedBy = cleanText(raw.reopenedBy);
  const reopenedDate = cleanText(raw.reopenedDate);
  if ((reopenReason || reopenedBy || reopenedDate) && (!reopenReason || !reopenedBy || !validCloseDate(reopenedDate))) return null;
  return {
    month,
    status: status === 'closed' ? 'closed' : 'open',
    steps,
    closedDate: status === 'closed' ? closedDate : '',
    closedBy: status === 'closed' ? closedBy : '',
    reopenReason,
    reopenedBy,
    reopenedDate,
  };
}

/** Normalise a list of month records, dropping half-formed rows. */
export function normalizeMonthCloseList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((row) => normalizeMonthClose(row)).filter(Boolean);
}

/** Find one month's record, or null. */
export function findMonthClose(list, month) {
  if (!validCloseMonth(month)) return null;
  return normalizeMonthCloseList(list).find((row) => row.month === month) ?? null;
}

/** A fresh, all-pending record for a month. */
export function blankMonthClose(month) {
  const record = normalizeMonthClose({ month, status: 'open', steps: {} });
  return record;
}

function replaceMonth(list, record) {
  const base = normalizeMonthCloseList(list).filter((row) => row.month !== record.month);
  return [...base, record].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

/**
 * Tick one step with a date and by whom. A tick without a date
 * or a name, an unknown step or month, or a tick on a closed
 * month leaves the list unchanged. Ticking never posts,
 * corrects, or closes any other record.
 */
export function tickCloseStep(list, { month, stepId, date, by } = {}) {
  const record = findMonthClose(list, month);
  if (!record || record.status === 'closed' || !STEP_IDS.has(stepId)) return Array.isArray(list) ? list : [];
  if (!validCloseDate(date) || !cleanText(by)) return Array.isArray(list) ? list : [];
  const next = { ...record, steps: { ...record.steps, [stepId]: { stepId, state: 'ticked', date, by: cleanText(by), reason: '' } } };
  return replaceMonth(list, next);
}

/**
 * Waive one step with a date, by whom, and a reason. A waiver
 * without a reason, date, or name, an unknown step or month,
 * or a waiver on a closed month leaves the list unchanged.
 */
export function waiveCloseStep(list, { month, stepId, date, by, reason } = {}) {
  const record = findMonthClose(list, month);
  if (!record || record.status === 'closed' || !STEP_IDS.has(stepId)) return Array.isArray(list) ? list : [];
  if (!validCloseDate(date) || !cleanText(by) || !cleanText(reason)) return Array.isArray(list) ? list : [];
  const next = { ...record, steps: { ...record.steps, [stepId]: { stepId, state: 'waived', date, by: cleanText(by), reason: cleanText(reason) } } };
  return replaceMonth(list, next);
}

/** Untick/unwaive one step back to pending (open months only). */
export function untickCloseStep(list, { month, stepId } = {}) {
  const record = findMonthClose(list, month);
  if (!record || record.status === 'closed' || !STEP_IDS.has(stepId)) return Array.isArray(list) ? list : [];
  const next = { ...record, steps: { ...record.steps, [stepId]: { stepId, state: 'pending', date: '', by: '', reason: '' } } };
  return replaceMonth(list, next);
}

/**
 * Close readiness: a month can be marked closed only when every
 * step is ticked or waived. `missing` names every step still
 * pending, so the operator sees exactly what is left.
 */
export function closeReadiness(record) {
  const normalised = normalizeMonthClose(record);
  if (!normalised) return { canClose: false, missing: CLOSE_STEPS.map((step) => step.label) };
  const missing = CLOSE_STEPS.filter((step) => normalised.steps[step.id].state === 'pending').map((step) => step.label);
  return { canClose: missing.length === 0, missing };
}

/**
 * Mark a month closed. Refused (list unchanged) when the month
 * has no record, is already closed, has a pending step, or the
 * close date/by is missing. Closing ticks nothing and changes
 * no bill, payment, handover, or suspense record.
 */
export function closeMonth(list, { month, date, by } = {}) {
  const record = findMonthClose(list, month);
  if (!record || record.status === 'closed') return Array.isArray(list) ? list : [];
  if (!closeReadiness(record).canClose) return Array.isArray(list) ? list : [];
  if (!validCloseDate(date) || !cleanText(by)) return Array.isArray(list) ? list : [];
  const next = { ...record, status: 'closed', closedDate: date, closedBy: cleanText(by) };
  return replaceMonth(list, next);
}

/**
 * Reopen a closed month. Refused (list unchanged) unless the
 * month is closed and a non-blank owner reason, by, and date
 * are given. The wiring also writes the same reason into the
 * Plan 31 audit log; this module stores it on the record too.
 */
export function reopenMonth(list, { month, reason, by, date } = {}) {
  const record = findMonthClose(list, month);
  if (!record || record.status !== 'closed') return Array.isArray(list) ? list : [];
  if (!cleanText(reason) || !cleanText(by) || !validCloseDate(date)) return Array.isArray(list) ? list : [];
  const next = {
    ...record,
    status: 'open',
    closedDate: '',
    closedBy: '',
    reopenReason: cleanText(reason),
    reopenedBy: cleanText(by),
    reopenedDate: date,
  };
  return replaceMonth(list, next);
}

/** Remove one month's record entirely. */
export function removeMonthClose(list, month) {
  if (!validCloseMonth(month)) return Array.isArray(list) ? list : [];
  return normalizeMonthCloseList(list).filter((row) => row.month !== month);
}

/** Summary counts and completion text for one month record. */
export function monthCloseSummary(record) {
  const normalised = normalizeMonthClose(record);
  if (!normalised) return null;
  const states = CLOSE_STEPS.map((step) => normalised.steps[step.id].state);
  const ticked = states.filter((state) => state === 'ticked').length;
  const waived = states.filter((state) => state === 'waived').length;
  const pending = states.filter((state) => state === 'pending').length;
  const readiness = closeReadiness(normalised);
  return {
    month: normalised.month,
    status: normalised.status,
    ticked,
    waived,
    pending,
    total: CLOSE_STEPS.length,
    canClose: readiness.canClose,
    missing: readiness.missing,
    text: normalised.status === 'closed'
      ? `${normalised.month} closed (${ticked} ticked, ${waived} waived).`
      : `${normalised.month}: ${ticked} ticked, ${waived} waived, ${pending} pending of ${CLOSE_STEPS.length} steps.`,
  };
}

/** Plain-text summary line for a month record, or '' when none. */
export function monthCloseSummaryText(record) {
  const summary = monthCloseSummary(record);
  return summary ? summary.text : '';
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** HTML table of one month's steps in their fixed order. */
export function monthCloseHtml(record) {
  const normalised = normalizeMonthClose(record);
  if (!normalised) return '';
  const rows = CLOSE_STEPS.map((step) => {
    const state = normalised.steps[step.id];
    const stateText = state.state === 'ticked' ? 'Ticked' : state.state === 'waived' ? `Waived — ${state.reason}` : 'Pending';
    return `<tr><td>${escapeHtml(step.label)}</td><td>${escapeHtml(stateText)}</td><td>${escapeHtml(state.date)}</td><td>${escapeHtml(state.by)}</td></tr>`;
  }).join('');
  const reopenNote = normalised.reopenReason
    ? `<p style="font-size: 12px;">Reopened ${escapeHtml(normalised.reopenedDate)} by ${escapeHtml(normalised.reopenedBy)}: ${escapeHtml(normalised.reopenReason)}</p>`
    : '';
  const closedNote = normalised.status === 'closed'
    ? `<p style="font-size: 12px;">Closed ${escapeHtml(normalised.closedDate)} by ${escapeHtml(normalised.closedBy)}.</p>`
    : '';
  return `<table><thead><tr><th>Step</th><th>State</th><th>Date</th><th>By</th></tr></thead><tbody>${rows}</tbody></table>${closedNote}${reopenNote}`;
}

/** CSV of month records: one row per step, in fixed step order. */
export function monthCloseCsv(list) {
  const rows = normalizeMonthCloseList(list);
  const lines = ['Month,Status,Step,State,Date,By,Reason'];
  for (const record of rows) {
    for (const step of CLOSE_STEPS) {
      const state = record.steps[step.id];
      lines.push([record.month, record.status, step.label, state.state, state.date, state.by, state.reason].map(csvCell).join(','));
    }
  }
  return lines.join('\n');
}

/** Export filename for one month, or for the whole checklist. */
export function monthCloseFilename(month) {
  return validCloseMonth(month) ? `month-close-${month}.csv` : 'month-close.csv';
}
