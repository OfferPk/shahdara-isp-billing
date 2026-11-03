// Plan 31 (Plan 1-100) — Operator action audit log (who did what, when).
//
// When a record changes, nobody can answer who changed it and when, so
// a correction, void, or archive is argued from memory. This module is
// the cross-cutting who-did-it log: a read-only, append-only list of
// operator actions that already exist — payment recorded, voided,
// corrected, customer archived/unarchived, Waada set, concession
// applied — each with date, time, action, and the record affected.
//
// Scope fence, stated plainly:
//   - This is the log only. It never changes any money total, never
//     writes, edits, or voids a payment, bill, Waada, or customer
//     record, and never re-derives a balance. The caller supplies
//     every entry; the module only validates, appends, and filters.
//   - It is NOT Plan K's per-payment correctionHistory (the detailed
//     record of what changed on one payment) and NOT Plan H's markup
//     audit. A void or correction entry here points at its detailed
//     record (payment id + month) instead of replacing it: the detail
//     still lives where it always lived, and this entry says when
//     the action happened and which record it touched.
//   - It is import-free (like campaign-planner.js and
//     coverage-register.js): the caller supplies every entry and the
//     module never reads storage, the clock, or the network, and
//     never mutates an input.
//   - Entries are append-only by construction: there is no remove,
//     no edit, and no rewrite helper in this module. The wiring
//     exposes no edit or delete control either, so a logged action
//     cannot be edited or deleted from the app.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). A timestamp is an ISO-style
//     YYYY-MM-DDTHH:MM string, optionally with seconds, fractional
//     seconds, and a Z suffix (as produced by Date.toISOString()).
//     The entry's date and time are derived from that timestamp,
//     never from a second, possibly disagreeing, date field.
//   - An entry with an unknown action, a blank record reference, or
//     an invalid timestamp is rejected (null / list unchanged),
//     never silently repaired or stored half-formed. The operator
//     who acted is caller-supplied: when the app has no operator
//     identity to supply, it stays null and renders as
//     "Not recorded", never as an invented name.

export const AUDIT_ACTIONS = Object.freeze([
  { value: 'payment_recorded', label: 'Payment recorded' },
  { value: 'payment_voided', label: 'Payment voided' },
  { value: 'payment_corrected', label: 'Payment corrected' },
  { value: 'customer_archived', label: 'Customer archived' },
  { value: 'customer_unarchived', label: 'Customer unarchived' },
  { value: 'waada_set', label: 'Waada set' },
  { value: 'concession_applied', label: 'Concession applied' },
  // Plan 33 adds the eighth action: an operator-mode switch is an
  // operator action worth auditing, recorded by the mode wiring.
  { value: 'mode_switched', label: 'Operator mode switched' },
]);

const ACTION_LABELS = new Map(AUDIT_ACTIONS.map((a) => [a.value, a.label]));

export function auditActionLabel(action) {
  return ACTION_LABELS.get(action) ?? null;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validAuditDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z)?$/;

export function validAuditTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  if (!validAuditDate(match[1])) return false;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = match[4] === undefined ? 0 : Number(match[4]);
  return hour <= 23 && minute <= 59 && second <= 59;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Normalise one raw entry. Returns a fresh entry object, or null when
// the entry cannot honestly be logged (unknown action, blank record
// reference, invalid timestamp). Inputs are never mutated.
export function normalizeAuditEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const action = cleanText(raw.action);
  if (!ACTION_LABELS.has(action)) return null;
  const recordRef = cleanText(raw.recordRef);
  if (!recordRef) return null;
  const timestamp = cleanText(raw.timestamp);
  if (!validAuditTimestamp(timestamp)) return null;
  const date = timestamp.slice(0, 10);
  const time = timestamp.slice(11, 16);
  return {
    id: cleanText(raw.id),
    timestamp,
    date,
    time,
    action,
    recordRef,
    customerId: cleanText(raw.customerId),
    customerName: cleanText(raw.customerName),
    detail: cleanText(raw.detail),
    by: cleanText(raw.by),
  };
}

export function normalizeAuditLog(list) {
  if (!Array.isArray(list)) return [];
  return list.map((row) => normalizeAuditEntry(row)).filter(Boolean);
}

// Append one entry. A rejected entry leaves the list unchanged (the
// same array is returned); a valid entry returns a new array with the
// entry appended, so the log stays in the order actions happened.
export function appendAuditEntry(list, entry) {
  const base = Array.isArray(list) ? list : [];
  const normalised = normalizeAuditEntry(entry);
  if (!normalised) return base;
  return [...base, normalised];
}

// Filter by action type and/or date. An empty action means all
// actions; an invalid date filter is ignored rather than matching
// nothing, so a mistyped filter never hides the whole log. A date
// range is inclusive at both ends. Returns a new array.
export function filterAuditEntries(list, { action = '', date = '', fromDate = '', toDate = '' } = {}) {
  const rows = normalizeAuditLog(list);
  const wantedAction = cleanText(action);
  const wantedDate = validAuditDate(cleanText(date)) ? cleanText(date) : '';
  const from = validAuditDate(cleanText(fromDate)) ? cleanText(fromDate) : '';
  const to = validAuditDate(cleanText(toDate)) ? cleanText(toDate) : '';
  return rows.filter((row) => {
    if (wantedAction && row.action !== wantedAction) return false;
    if (wantedDate && row.date !== wantedDate) return false;
    if (from && row.date < from) return false;
    if (to && row.date > to) return false;
    return true;
  });
}

export function auditSummary(list) {
  const rows = normalizeAuditLog(list);
  const byAction = {};
  for (const action of ACTION_LABELS.keys()) byAction[action] = 0;
  for (const row of rows) byAction[row.action] += 1;
  return { total: rows.length, byAction };
}

export function auditSummaryText(summary) {
  if (!summary || summary.total === 0) return 'No operator actions logged yet.';
  const parts = AUDIT_ACTIONS.filter((a) => summary.byAction[a.value] > 0)
    .map((a) => `${a.label}: ${summary.byAction[a.value]}`);
  return `${summary.total} action${summary.total === 1 ? '' : 's'} logged — ${parts.join(' · ')}`;
}

function escapeAuditHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function auditHtml(entries) {
  const rows = normalizeAuditLog(entries);
  if (rows.length === 0) return '<p class="empty-state">No operator actions match these filters.</p>';
  return `<table class="audit-log-table"><thead><tr><th>Date</th><th>Time</th><th>Action</th><th>Record</th><th>Detail</th><th>By</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeAuditHtml(row.date)}</td><td>${escapeAuditHtml(row.time)}</td><td>${escapeAuditHtml(auditActionLabel(row.action))}</td><td>${escapeAuditHtml(row.recordRef)}${row.customerName ? ` · ${escapeAuditHtml(row.customerName)}` : ''}</td><td>${escapeAuditHtml(row.detail || '—')}</td><td>${escapeAuditHtml(row.by || 'Not recorded')}</td></tr>`).join('')}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function auditCsv(entries) {
  const rows = normalizeAuditLog(entries);
  const header = 'date,time,action,record,detail,by';
  const lines = rows.map((row) => [
    row.date,
    row.time,
    auditActionLabel(row.action),
    row.recordRef,
    row.detail,
    row.by,
  ].map(csvCell).join(','));
  return [header, ...lines].join('\n');
}

export function auditFilename() {
  return 'operator-audit-log.csv';
}
