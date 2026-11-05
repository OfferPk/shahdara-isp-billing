// Plan 297 (Plan 203-350) — Shop visitor log.
//
// Who visited the shop, when, and why is never recorded, so a later
// question about a visit — a supplier, a customer, an official — has
// no answer. This module adds only the missing piece: one dated log
// entry per shop visit — the date, the visitor name, the purpose in
// plain words, the person met, and the time in and out — so the shop
// can answer "who came and when" without relying on memory.
//
// What this module is NOT, stated plainly:
//   - It is not a customer, staff, or appointment record. Logging a
//     visit creates no customer, staff, or appointment record, and
//     never changes any bill, payment, customer, or staff record by
//     itself; it only records that a person came to the shop.
//   - It is not the field contractor visit record, the customer
//     signature acknowledgement, the welcome visit outcome, the
//     appointment no-show note, the callback queue, or the access
//     register. Each of those records already exists and is neither
//     read nor rewritten here; this module only covers visits to
//     the shop itself.
//   - It is not a live record. A visit entry, once written, is
//     never silently edited: there is no edit function, only
//     record, find, and remove, so a wrong entry is removed and
//     recorded again.
//   - It is not a clock. Times are plain HH:MM strings supplied
//     by the caller, and the visit length is plain integer
//     arithmetic on those strings.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every visit,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A visit with no id, no strict date, no visitor name, or no
//     purpose in plain words is refused outright. Unknown fields
//     are dropped, so a visit can never grow a bill, payment,
//     customer, or staff field.
//   - A duplicate id is never rewritten: the first visit stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validVisitorLogDate(value) {
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

/** Strict 24-hour time: HH:MM, or false. */
export function validVisitorLogTime(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function minutesOf(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * One shop visit, or null when half-formed. A visit needs an id, a
 * strict date, a visitor name, and a purpose in plain words. The
 * person met is optional. Times in and out are optional, but when
 * given they must be strict HH:MM, and a time out before the time
 * in is refused. Unknown fields are dropped; the input is never
 * mutated.
 */
export function normalizeVisitorLog(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const visitorName = text(raw.visitorName);
  const purpose = text(raw.purpose);
  const personMet = text(raw.personMet);
  const timeIn = text(raw.timeIn);
  const timeOut = text(raw.timeOut);
  if (!id) return null;
  if (!validVisitorLogDate(date)) return null;
  if (!visitorName) return null;
  if (!purpose) return null;
  if (timeIn && !validVisitorLogTime(timeIn)) return null;
  if (timeOut && !validVisitorLogTime(timeOut)) return null;
  if (timeIn && timeOut && minutesOf(timeOut) < minutesOf(timeIn)) return null;
  return { id, date, visitorName, purpose, personMet, timeIn, timeOut };
}

/** Normalised visits only; a duplicate id is never rewritten, the first stays. */
export function normalizeVisitorLogList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const visit = normalizeVisitorLog(raw);
    if (!visit || seen.has(visit.id)) continue;
    seen.add(visit.id);
    out.push(visit);
  }
  return out;
}

export function findVisitorLog(list, id) {
  const clean = normalizeVisitorLogList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((visit) => visit.id === wanted) ?? null;
}

/**
 * Record a visit. Refused when half-formed or when its id is
 * already recorded — the first visit for an id always stays.
 */
export function recordVisitorLog(list, raw) {
  const clean = normalizeVisitorLogList(list);
  const visit = normalizeVisitorLog(raw);
  if (!visit) return clean;
  if (clean.some((item) => item.id === visit.id)) return clean;
  return [...clean, visit];
}

export function removeVisitorLog(list, id) {
  const clean = normalizeVisitorLogList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((visit) => visit.id !== wanted);
}

/** Visit length in whole minutes, or null when either time is missing. */
export function visitorLogDurationMinutes(visit) {
  const clean = normalizeVisitorLog(visit);
  if (!clean || !clean.timeIn || !clean.timeOut) return null;
  return minutesOf(clean.timeOut) - minutesOf(clean.timeIn);
}

/** Visits by date, then time in, then visitor name, then id, so the same list always reads the same way. */
export function visitorLogSorted(list) {
  const clean = normalizeVisitorLogList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const aTime = a.timeIn || '99:99';
    const bTime = b.timeIn || '99:99';
    if (aTime !== bTime) return aTime < bTime ? -1 : 1;
    const aName = a.visitorName.toLowerCase();
    const bName = b.visitorName.toLowerCase();
    if (aName !== bName) return aName < bName ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Visits on one date, in time order. */
export function visitorLogForDate(list, date) {
  const clean = normalizeVisitorLogList(list);
  if (!validVisitorLogDate(text(date))) return [];
  return visitorLogSorted(clean.filter((visit) => visit.date === text(date)));
}

/** Visits whose visitor name contains the query, case-insensitive, in date order. */
export function visitorLogSearch(list, query) {
  const clean = normalizeVisitorLogList(list);
  const needle = text(query).toLowerCase();
  if (!needle) return [];
  return visitorLogSorted(
    clean.filter((visit) => visit.visitorName.toLowerCase().includes(needle)),
  );
}

/** Visitor names in the log, first spelling kept, A-Z. */
export function visitorLogVisitors(list) {
  const clean = normalizeVisitorLogList(list);
  const seen = new Map();
  for (const visit of clean) {
    const key = visit.visitorName.toLowerCase();
    if (!seen.has(key)) seen.set(key, visit.visitorName);
  }
  return [...seen.values()].sort((a, b) => {
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();
    return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : 0;
  });
}

/** The newest visit, or null when none is recorded. */
export function visitorLogLatest(list) {
  const sorted = visitorLogSorted(list);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

export function visitorLogSummaryText(list) {
  const clean = normalizeVisitorLogList(list);
  if (clean.length === 0) return 'No shop visits recorded.';
  const word = clean.length === 1 ? 'visit' : 'visits';
  const latest = visitorLogLatest(clean);
  return `${clean.length} shop ${word} recorded. Latest visit on ${latest.date}: ${latest.visitorName}, ${latest.purpose}.`;
}

/** Plain-words text for one visit: date, visitor, purpose, person met, and times. */
export function visitorLogEntryText(visit) {
  const clean = normalizeVisitorLog(visit);
  if (!clean) return 'No shop visit recorded.';
  const met = clean.personMet ? `, met ${clean.personMet}` : '';
  const times = clean.timeIn
    ? `, ${clean.timeIn}${clean.timeOut ? `–${clean.timeOut}` : ''}`
    : '';
  return `${clean.date} — ${clean.visitorName}, ${clean.purpose}${met}${times}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function visitorLogEntryHtml(visit) {
  const clean = normalizeVisitorLog(visit);
  if (!clean) return '<p>No shop visit recorded.</p>';
  return `<p>${escapeHtml(visitorLogEntryText(clean))}</p>`;
}

export function visitorLogAllHtml(list) {
  const rows = visitorLogSorted(list);
  if (!rows.length) return '<p>No shop visits recorded.</p>';
  return `<ul>${rows.map((visit) => `<li>${escapeHtml(visitorLogEntryText(visit))}</li>`).join('')}</ul>`;
}

export function visitorLogSearchHtml(list, query) {
  const rows = visitorLogSearch(list, query);
  if (!text(query)) return '<p>Type a visitor name to search.</p>';
  if (!rows.length) return '<p>No shop visits match that name.</p>';
  return `<ul>${rows.map((visit) => `<li>${escapeHtml(visitorLogEntryText(visit))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function visitorLogCsv(list) {
  const rows = visitorLogSorted(list);
  const lines = ['"id","date","visitor name","purpose","person met","time in","time out"'];
  for (const visit of rows) {
    lines.push([
      csvCell(visit.id),
      csvCell(visit.date),
      csvCell(visit.visitorName),
      csvCell(visit.purpose),
      csvCell(visit.personMet),
      csvCell(visit.timeIn),
      csvCell(visit.timeOut),
    ].join(','));
  }
  return lines.join('\n');
}

export function visitorLogFilename() {
  return 'visitor-log.csv';
}
