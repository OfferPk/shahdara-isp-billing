/* QC-8 — Route visit history (append-only visit log).
 *
 * The route sheet's outcome/note/progress stores are date-scoped and
 * single-slot: re-marking a stop overwrites the earlier mark, and
 * yesterday's marks are gone at midnight. This module is the history
 * beside them: every non-pending field outcome appends one entry
 * (date, customer, outcome, note, timestamp) that is never edited or
 * deleted, kept 90 days. The single-slot stores stay exactly as they
 * are — they are the round's current state; this log is the record of
 * what happened.
 *
 * Scope fence, stated plainly:
 *   - This is a log only. It never changes any money total, never
 *     writes, edits, or voids a payment, bill, Waada, or customer
 *     record, and never re-derives a balance. The caller supplies
 *     every entry; the module only validates, appends, prunes, and
 *     filters.
 *   - Entries are append-only by construction: there is no remove,
 *     no edit, and no rewrite helper in this module.
 *   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
 *     rejected, never guessed). A timestamp is an ISO-style string
 *     as produced by Date.toISOString(); the display time is taken
 *     from it, never from a second, possibly disagreeing, field.
 *   - The module is import-free: it never reads storage, the clock,
 *     or the network except through the storage object the caller
 *     passes to the load/save/record helpers, and never mutates an
 *     input.
 */

export const FIELD_ROUTE_VISIT_LOG_KEY = 'shahdara_field_route_visit_log_v1';

// How long the history is kept: entries dated within the last 90
// days including today survive; older entries are pruned on write.
export const VISIT_LOG_RETENTION_DAYS = 90;

// The route sheet's outcome vocabulary (the same values the route
// sheet and the QC-1 Field Mode marks write). 'pending' is not a
// visit and is never logged.
export const VISIT_LOG_OUTCOMES = Object.freeze([
  'paid',
  'partial',
  'promised',
  'not_home',
  'refused',
  'dispute',
  'no_answer',
  'call_later',
]);

export const VISIT_LOG_OUTCOME_LABELS = Object.freeze({
  paid: 'Paid',
  partial: 'Partial payment',
  promised: 'Payment promised',
  not_home: 'Not home',
  refused: 'Refused to pay',
  dispute: 'Dispute',
  no_answer: 'No answer',
  call_later: 'Call later',
});

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validVisitLogDate(value) {
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

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Normalise one raw entry. Returns a fresh entry object, or null when
// the entry cannot honestly be logged (bad date, blank customer, or
// an outcome outside the vocabulary). A missing timestamp is
// tolerated (the display falls back), never invented. Inputs are
// never mutated.
export function normalizeVisitLogEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = cleanText(raw.date);
  if (!validVisitLogDate(date)) return null;
  const customerId = cleanText(raw.customerId);
  if (!customerId) return null;
  const outcome = cleanText(raw.outcome).toLowerCase();
  if (!VISIT_LOG_OUTCOMES.includes(outcome)) return null;
  const number = raw.customerNumber;
  return {
    id: cleanText(raw.id),
    date,
    customerId,
    customerNumber: number == null || String(number).trim() === '' ? '' : String(number).trim(),
    customerName: cleanText(raw.customerName),
    outcome,
    note: cleanText(raw.note),
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp.trim() : '',
    source: cleanText(raw.source),
  };
}

export function normalizeVisitLog(list) {
  if (!Array.isArray(list)) return [];
  return list.map((row) => normalizeVisitLogEntry(row)).filter(Boolean);
}

// Append one entry. A rejected entry leaves the list unchanged (the
// same array is returned); a valid entry returns a new array with
// the entry appended, so the log stays in the order visits happened.
export function appendVisitLogEntry(list, entry) {
  const base = Array.isArray(list) ? list : [];
  const normalised = normalizeVisitLogEntry(entry);
  if (!normalised) return base;
  return [...base, normalised];
}

// Pure YYYY-MM-DD arithmetic (UTC, so no timezone can shift a day).
// Returns '' for an invalid input instead of guessing a date.
export function dateStringDaysAgo(dateStr, days) {
  if (!validVisitLogDate(dateStr) || !Number.isFinite(days)) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, day) - Math.trunc(days) * 24 * 60 * 60 * 1000;
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Drop entries older than the retention window. `todayStr` is the
// reference day (usually the visit's own date); entries dated within
// the last `keepDays` days including today are kept.
export function pruneVisitLogEntries(list, todayStr, keepDays = VISIT_LOG_RETENTION_DAYS) {
  const rows = normalizeVisitLog(list);
  const cutoff = dateStringDaysAgo(todayStr, keepDays - 1);
  if (!cutoff) return rows;
  return rows.filter((row) => row.date >= cutoff);
}

export function loadVisitLog(storage) {
  const store = storage || null;
  if (!store || typeof store.getItem !== 'function') return [];
  try {
    const raw = store.getItem(FIELD_ROUTE_VISIT_LOG_KEY);
    if (!raw) return [];
    return normalizeVisitLog(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveVisitLog(storage, list) {
  const store = storage || null;
  if (!store || typeof store.setItem !== 'function') return normalizeVisitLog(list);
  const rows = normalizeVisitLog(list);
  try {
    store.setItem(FIELD_ROUTE_VISIT_LOG_KEY, JSON.stringify(rows));
  } catch {}
  return rows;
}

// Record one visit: load, append, prune, persist. Returns the
// appended entry, or null when the entry cannot honestly be logged
// or storage is unavailable. The id is derived from the visit's own
// date + customer + position in the log, so two marks for one
// customer on one day still get distinct ids.
export function recordVisitLogEntry(storage, fields, todayStr) {
  const store = storage || null;
  if (!store || typeof store.getItem !== 'function' || typeof store.setItem !== 'function') return null;
  try {
    const pruned = pruneVisitLogEntries(loadVisitLog(store), todayStr);
    const entry = normalizeVisitLogEntry(fields);
    if (!entry) return null;
    if (!entry.id) entry.id = `visit-${entry.date}-${entry.customerId}-${pruned.length}`;
    const next = [...pruned, entry];
    store.setItem(FIELD_ROUTE_VISIT_LOG_KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

// Unique dates in the log, newest first — the day picker.
export function visitLogDates(list) {
  const dates = [...new Set(normalizeVisitLog(list).map((row) => row.date))];
  return dates.sort().reverse();
}

// Entries for one day, in recorded order.
export function visitLogEntriesForDate(list, dateStr) {
  if (!validVisitLogDate(dateStr)) return [];
  return normalizeVisitLog(list).filter((row) => row.date === dateStr);
}

function escapeVisitHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function visitTimeText(timestamp) {
  if (typeof timestamp !== 'string') return '—';
  const match = /T(\d{2}):(\d{2})/.exec(timestamp);
  return match ? `${match[1]}:${match[2]}` : '—';
}

// <option> list for the day picker. With no dates at all the picker
// still offers the selected day (usually today), so the section is
// never an empty control.
export function visitHistoryDateOptionsHtml(dates, selectedDate) {
  const list = Array.isArray(dates) ? dates.filter((d) => validVisitLogDate(d)) : [];
  const selected = validVisitLogDate(selectedDate) ? selectedDate : (list[0] || '');
  const options = list.length > 0 ? list : (selected ? [selected] : []);
  return options.map((d) => `<option value="${escapeVisitHtml(d)}"${d === selected ? ' selected' : ''}>${escapeVisitHtml(d)}</option>`).join('');
}

// One day's visits as rows. `nameFor` resolves the display name for
// an entry (the route sheet passes a live-state lookup so a mark
// shows the customer's current name); by default the stored name is
// used, falling back to the customer id — never a blank row. The
// note renders only when the visit carries one. All user text is
// escaped.
export function visitHistoryDayHtml(entries, dateStr, nameFor) {
  const rows = normalizeVisitLog(entries).filter((row) => !dateStr || row.date === dateStr);
  if (rows.length === 0) {
    const day = validVisitLogDate(dateStr) ? dateStr : '';
    return `<p class="empty-state">No visits recorded${day ? ` on ${escapeVisitHtml(day)}` : ''}.</p>`;
  }
  const resolveName = typeof nameFor === 'function' ? nameFor : (row) => row.customerName || row.customerId;
  return rows.map((row) => {
    const name = resolveName(row) || row.customerId;
    const who = row.customerNumber ? `#${escapeVisitHtml(row.customerNumber)} · ${escapeVisitHtml(name)}` : escapeVisitHtml(name);
    const note = row.note ? `<span class="route-visit-note">${escapeVisitHtml(row.note)}</span>` : '';
    return `<div class="route-visit-row" role="listitem"><span class="route-visit-time">${escapeVisitHtml(visitTimeText(row.timestamp))}</span><span class="route-visit-name">${who}</span><span class="route-visit-outcome">${escapeVisitHtml(VISIT_LOG_OUTCOME_LABELS[row.outcome] || row.outcome)}</span>${note}</div>`;
  }).join('');
}
