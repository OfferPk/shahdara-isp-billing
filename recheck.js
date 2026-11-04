// Plan 158 (Plan 101-202) — Fault Closure Quality Re-Check.
//
// A fault marked closed is never re-checked, so a poor fix is only
// found when the customer complains again. This module is the
// re-check: one re-check record per closed fault with a ticket
// link, a re-check date, a result (holding or failed), and a note.
// Failed re-checks put the ticket back on the follow-up list, so
// fix quality is verified by the operator's own sample instead of
// by waiting for a repeat complaint.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of any neighbouring module.
//     No existing module records a quality re-check of a closed
//     fault: the second-visit rule (second-visit.js) is a due
//     date and outcome for an UNRESOLVED ticket, the dispute
//     follow-up queue (dispute-followups.js) follows disputes,
//     the escalation timer (escalation-timer.js) ages open
//     tickets, and the SISP-104 post-repair check-in
//     (post-repair-checkin.js) is a customer-satisfaction
//     WhatsApp queue that reads complaint records and stamps
//     them — and none of them is read or written here. A
//     re-check names a ticket by id only.
//   - It is not an action on any other record. A failed
//     re-check puts the ticket on this module's own follow-up
//     list; it never rewrites the ticket's closure, never
//     reopens the ticket itself, and never changes any bill,
//     payment, or original ticket outcome anywhere else.
//   - It is not proof that a fix held or failed. The record
//     says what the operator recorded; the module verifies
//     format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a ticket link, a real
//     re-check date, and a result of exactly holding or
//     failed. A re-check with no ticket or no result is
//     refused outright, as is any impossible date or any other
//     result word. Unknown fields are dropped, so a record
//     can never grow a field from any other record type.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal of the record itself.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
function strictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  if (day < 1 || day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one re-check record, or null when half-formed. */
export function normalizeRecheck(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const ticketId = cleanText(record.ticketId);
  const recheckDate = strictDate(record.recheckDate);
  const result = cleanText(record.result).toLowerCase();
  if (!id || !ticketId || !recheckDate) return null;
  if (result !== 'holding' && result !== 'failed') return null;
  return { id, ticketId, recheckDate, result, note: cleanText(record.note) };
}

/** Normalize a list: half-formed records dropped, order kept. */
export function normalizeRecheckList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const clean = normalizeRecheck(record);
    if (clean) out.push(clean);
  }
  return out;
}

/** Find one re-check record by id, or null. */
export function findRecheck(list, id) {
  const clean = normalizeRecheckList(list);
  const want = cleanText(id);
  return clean.find((item) => item.id === want) || null;
}

/**
 * Add a re-check record, or leave the list unchanged when the
 * record is half-formed or a duplicate id carrying different
 * figures. An identical re-save leaves the list unchanged.
 */
export function upsertRecheck(list, record) {
  const clean = normalizeRecheckList(list);
  const next = normalizeRecheck(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) {
    const same = existing.ticketId === next.ticketId
      && existing.recheckDate === next.recheckDate
      && existing.result === next.result
      && existing.note === next.note;
    return same ? clean : clean;
  }
  return [...clean, next];
}

/** Remove a re-check record by id; unknown ids leave the list unchanged. */
export function removeRecheck(list, id) {
  const clean = normalizeRecheckList(list);
  const want = cleanText(id);
  return clean.filter((item) => item.id !== want);
}

/** Re-checks for one ticket, newest first, then id A-Z. */
export function ticketRechecks(list, ticketId) {
  const want = cleanText(ticketId);
  if (!want) return [];
  const clean = normalizeRecheckList(list).filter((item) => item.ticketId === want);
  clean.sort((a, b) => compareText(b.recheckDate, a.recheckDate) || compareText(a.id, b.id));
  return clean;
}

/** Every ticket id present, A-Z. */
export function recheckTickets(list) {
  const clean = normalizeRecheckList(list);
  const seen = new Set();
  for (const item of clean) seen.add(item.ticketId);
  return [...seen].sort(compareText);
}

/**
 * The follow-up list: one entry per ticket with at least one
 * failed re-check. This list only names tickets for attention;
 * it never rewrites any ticket's closure. Entries carry the
 * failed count and the latest failed date, most recently
 * failed first, then ticket id A-Z.
 */
export function failedFollowUp(list) {
  const clean = normalizeRecheckList(list);
  const byTicket = new Map();
  for (const item of clean) {
    if (item.result !== 'failed') continue;
    const entry = byTicket.get(item.ticketId) || { ticketId: item.ticketId, failedCount: 0, latestFailedDate: item.recheckDate };
    entry.failedCount += 1;
    if (compareText(item.recheckDate, entry.latestFailedDate) > 0) entry.latestFailedDate = item.recheckDate;
    byTicket.set(item.ticketId, entry);
  }
  const out = [...byTicket.values()];
  out.sort((a, b) => compareText(b.latestFailedDate, a.latestFailedDate) || compareText(a.ticketId, b.ticketId));
  return out;
}

/** Summary text: records / tickets / failed-follow-up counts. */
export function recheckSummaryText(list) {
  const clean = normalizeRecheckList(list);
  const tickets = recheckTickets(list).length;
  const failed = failedFollowUp(list).length;
  return `${clean.length} re-check${clean.length === 1 ? '' : 's'} across ${tickets} ticket${tickets === 1 ? '' : 's'}, ${failed} ticket${failed === 1 ? '' : 's'} on the failed follow-up list.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recheckRowHtml(item) {
  const flag = item.result === 'failed' ? ' ⚠ failed' : '';
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.ticketId)}</td>`
    + `<td>${esc(item.recheckDate)}</td><td>${esc(item.result)}${flag}</td><td>${esc(item.note || '—')}</td></tr>`;
}

function recheckTableHtml(rows, intro) {
  const body = rows.map((item) => recheckRowHtml(item)).join('');
  return `<p>${intro}</p>`
    + '<table><thead><tr><th>Id</th><th>Ticket</th>'
    + '<th>Re-check date</th><th>Result</th><th>Note</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

/** All re-check records as HTML, newest first (then id A-Z). */
export function recheckAllHtml(list) {
  const clean = normalizeRecheckList(list);
  if (clean.length === 0) return '<p>No fault re-checks recorded yet.</p>';
  clean.sort((a, b) => compareText(b.recheckDate, a.recheckDate) || compareText(a.id, b.id));
  return recheckTableHtml(clean, 'All fault closure re-checks, newest first.');
}

/** One ticket as HTML: its re-checks newest first, failed flagged. */
export function recheckTicketHtml(list, ticketId) {
  const records = ticketRechecks(list, ticketId);
  if (records.length === 0) return '<p>No re-checks for this ticket yet.</p>';
  return recheckTableHtml(records, `Re-checks for ticket ${esc(ticketId)}, newest first. Failed re-checks put this ticket on the follow-up list.`);
}

/** The failed follow-up list as HTML. */
export function recheckFollowUpHtml(list) {
  const entries = failedFollowUp(list);
  if (entries.length === 0) return '<p>No ticket on the failed follow-up list.</p>';
  const rows = entries.map((entry) => `<tr><td>${esc(entry.ticketId)}</td><td>${entry.failedCount}</td><td>${esc(entry.latestFailedDate)}</td></tr>`).join('');
  return '<p>Tickets whose fix failed a re-check — attention reopened, closure untouched.</p>'
    + '<table><thead><tr><th>Ticket</th><th>Failed re-checks</th><th>Latest failed</th></tr></thead><tbody>'
    + rows + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** All re-check records as CSV text. */
export function recheckCsv(list) {
  const rows = normalizeRecheckList(list);
  const lines = ['id,ticketId,recheckDate,result,note'];
  for (const item of rows) {
    lines.push([item.id, item.ticketId, item.recheckDate, item.result, item.note].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the re-check export. */
export function recheckFilename() {
  return 'fault-rechecks.csv';
}
