// Plan 255 (Plan 203-350) — Service restoration time record per ticket.
//
// Fault tickets close, but the actual time service came back is not
// recorded, so nobody can say how long customers were really without
// service. This module adds only the missing piece: one restoration
// record per ticket — the ticket reference, the fault reported time,
// the service restored time, who restored it, and a note. The
// restoration time is always after the reported time, and the
// outage length is counted from those two times, so it can never
// disagree with them.
//
// The fences, stated plainly:
//   - This records times only. It does not replace the post-outage
//     restoration verification sweep (Plan 55), which checks
//     customers segment by segment after an outage, or the
//     escalation timer for ageing tickets (Plan 141), which stages
//     open tickets by age. Neither of those is read or rewritten
//     here, and this module imports nothing.
//   - A record is never edited, only corrected by a dated
//     follow-up note. There is no edit function: only record,
//     follow up, and remove. A follow-up never rewrites the ticket
//     reference, the reported time, the restored time, who restored
//     it, or the note.
//   - One record per ticket: a second record for the same ticket
//     reference is refused, so a ticket never shows two different
//     restoration times.
//   - Recording a restoration never changes any bill, payment,
//     customer, or ticket record by itself: the module takes no
//     bill, payment, customer, or ticket object in, edits none,
//     and returns none. Ticket references, times, and people arrive
//     as plain text, and closed tickets are supplied by the caller
//     as plain references for the exceptions list.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const RESTORATION_TIME_STORE = 'shahdara_restoration_times_v1';
export const RESTORATION_TIME_FILENAME = 'restoration-times.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validRestorationTimeDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

// A strict datetime in the form YYYY-MM-DDTHH:MM, the shape a
// datetime-local input gives. The date half uses the same 12-entry
// days-in-month table as the strict date above; the time half must
// be a real clock time, 00:00 to 23:59.
export function validRestorationTimeDatetime(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  if (!validRestorationTimeDate(`${match[1]}-${match[2]}-${match[3]}`)) return false;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function datetimeToMinutes(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  ) / 60000;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validRestorationTimeDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const ticketRef = text(raw.ticketRef);
  const reportedAt = text(raw.reportedAt);
  const restoredAt = text(raw.restoredAt);
  const restoredBy = text(raw.restoredBy);
  const note = text(raw.note);
  if (!id || !ticketRef || !restoredBy || !note) return null;
  if (!validRestorationTimeDatetime(reportedAt)) return null;
  if (!validRestorationTimeDatetime(restoredAt)) return null;
  // The restoration time must fall after the reported time: a
  // service cannot come back before the fault was reported.
  if (datetimeToMinutes(restoredAt) <= datetimeToMinutes(reportedAt)) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, ticketRef, reportedAt, restoredAt, restoredBy, note, followups };
}

export function normalizeRestorationTimeList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenTickets = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    if (seenTickets.has(entry.ticketRef.toLowerCase())) continue;
    seenIds.add(entry.id);
    seenTickets.add(entry.ticketRef.toLowerCase());
    out.push(entry);
  }
  return out;
}

export function recordRestorationTime(list, raw) {
  const clean = normalizeRestorationTimeList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.ticketRef.toLowerCase() === entry.ticketRef.toLowerCase())) return clean;
  return [...clean, entry];
}

export function removeRestorationTime(list, id) {
  const clean = normalizeRestorationTimeList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findRestorationTime(list, id) {
  const clean = normalizeRestorationTimeList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addRestorationTimeFollowup(list, id, date, note) {
  const clean = normalizeRestorationTimeList(list);
  const wanted = text(id);
  const followup = cleanFollowup({ date, note });
  if (!wanted || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.restoredAt !== b.restoredAt) return a.restoredAt < b.restoredAt ? -1 : 1;
  if (a.ticketRef !== b.ticketRef) return a.ticketRef < b.ticketRef ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function restorationTimeSorted(list) {
  return normalizeRestorationTimeList(list).sort(compareEntries);
}

export function restorationTimesForTicket(list, ticketRef) {
  const wanted = text(ticketRef).toLowerCase();
  if (!wanted) return [];
  return restorationTimeSorted(list).filter((item) => item.ticketRef.toLowerCase() === wanted);
}

export function restorationTimeTickets(list) {
  const seen = new Set();
  const out = [];
  for (const item of restorationTimeSorted(list)) {
    const key = item.ticketRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.ticketRef);
  }
  return out;
}

// The outage length is counted from the two times on the record,
// never stored apart from them, so it can never disagree with them.
export function restorationDurationMinutes(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return null;
  return datetimeToMinutes(clean.restoredAt) - datetimeToMinutes(clean.reportedAt);
}

export function restorationDurationText(entry) {
  const minutes = restorationDurationMinutes(entry);
  if (minutes === null) return 'No restoration time recorded.';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${hours} hour${hours === 1 ? '' : 's'} ${rest} minute${rest === 1 ? '' : 's'}`;
}

// Closed tickets the caller supplies as plain references (a string,
// or an object carrying a ticketRef) with no restoration record are
// listed as exceptions: a closed ticket should be able to say how
// long the customer was without service. Bad rows are dropped and
// a reference is listed once, keeping its first spelling.
export function ticketsWithoutRestorationTime(closedTickets, list) {
  if (!Array.isArray(closedTickets)) return [];
  const covered = new Set(
    normalizeRestorationTimeList(list).map((item) => item.ticketRef.toLowerCase()),
  );
  const seen = new Set();
  const out = [];
  for (const raw of closedTickets) {
    const ref = typeof raw === 'string' ? text(raw) : text(raw && raw.ticketRef);
    if (!ref) continue;
    const key = ref.toLowerCase();
    if (seen.has(key) || covered.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

export function restorationTimeSummaryText(list) {
  const clean = normalizeRestorationTimeList(list);
  const tickets = restorationTimeTickets(list).length;
  if (!clean.length) return 'No service restoration times recorded.';
  return `${clean.length} restoration record${clean.length === 1 ? '' : 's'} across ${tickets} ticket${tickets === 1 ? '' : 's'}.`;
}

export function restorationTimeText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No service restoration time recorded.';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Ticket ${clean.ticketRef}: fault reported ${clean.reportedAt}, service restored ${clean.restoredAt} (${restorationDurationText(clean)}), restored by ${clean.restoredBy}. ${clean.note}${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function restorationTimeHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No service restoration time recorded.</p>';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Ticket <strong>${escapeHtml(clean.ticketRef)}</strong>: fault reported ${escapeHtml(clean.reportedAt)}, service restored ${escapeHtml(clean.restoredAt)} (${escapeHtml(restorationDurationText(clean))}), restored by ${escapeHtml(clean.restoredBy)}. ${escapeHtml(clean.note)}${notes}</p>`;
}

export function restorationTimeAllHtml(list) {
  const sorted = restorationTimeSorted(list);
  if (!sorted.length) return '<p>No service restoration times recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(restorationTimeText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function restorationTimeCsv(list) {
  const sorted = restorationTimeSorted(list);
  const header = ['id', 'ticket reference', 'fault reported', 'service restored', 'outage minutes', 'restored by', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.ticketRef,
    item.reportedAt,
    item.restoredAt,
    restorationDurationMinutes(item),
    item.restoredBy,
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function restorationTimeFilename() {
  return 'restoration-times.csv';
}
