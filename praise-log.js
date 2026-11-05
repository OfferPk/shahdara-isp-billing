// Plan 278 (Plan 203-350) — Customer praise and compliment log.
//
// Complaints are logged carefully, but praise was not logged at
// all, so good work by the collector or the service had no record
// and no recognition. This module adds only the missing piece:
// one praise entry per compliment — the customer, the date, what
// was praised in plain words, and who or what it was about.
//
// What this module is NOT, stated plainly:
//   - It is not the complaint log. Complaints are the negative
//     counterpart; praise entries are never mixed into it, and
//     the complaint log is neither read nor rewritten here, and
//     this module imports nothing.
//   - It is not a testimonial. The testimonial consent note from
//     Plan 178 governs using praise publicly; this log only
//     records the compliment itself. No consent note is required
//     to record praise here, and praise recorded here is never
//     used publicly by this module.
//   - Recording praise never changes any customer, staff, bill,
//     or payment record. A praise entry only says who was pleased
//     and what pleased them.
//   - A praise entry is never edited: only record, find, and
//     remove. A wrong entry is removed and recorded again.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const PRAISE_LOG_STORE = 'shahdara_praise_log_v1';
export const PRAISE_LOG_FILENAME = 'praise-log.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validPraiseLogDate(value) {
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

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const date = text(raw.date);
  const description = text(raw.description);
  const subject = text(raw.subject);
  if (!id || !customer || !description) return null;
  if (!validPraiseLogDate(date)) return null;
  return { id, customer, date, description, subject };
}

export function normalizePraiseLogList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordPraiseLog(list, raw) {
  const clean = normalizePraiseLogList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removePraiseLog(list, id) {
  const clean = normalizePraiseLogList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findPraiseLog(list, id) {
  const clean = normalizePraiseLogList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function praiseLogSorted(list) {
  return normalizePraiseLogList(list).sort(compareEntries);
}

// A customer page: that customer's praise in date order, so the
// good work for one customer is read in the order it happened.
export function praiseLogsForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return praiseLogSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

// Praise for one praised subject — a person or a thing, named in
// plain words — in date order, so what is praised most is seen
// together.
export function praiseLogsForSubject(list, subject) {
  const wanted = text(subject).toLowerCase();
  if (!wanted) return [];
  return praiseLogSorted(list).filter((item) => item.subject.toLowerCase() === wanted);
}

export function praiseLogCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of praiseLogSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

export function praiseLogSubjects(list) {
  const seen = new Set();
  const out = [];
  for (const item of praiseLogSorted(list)) {
    if (!item.subject) continue;
    const key = item.subject.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.subject);
  }
  return out;
}

export function praiseLogSummaryText(list) {
  const clean = normalizePraiseLogList(list);
  if (!clean.length) return 'No praise recorded.';
  const subjects = praiseLogSubjects(clean).length;
  return `${clean.length} praise ${clean.length === 1 ? 'entry' : 'entries'} recorded, about ${subjects} subject${subjects === 1 ? '' : 's'}.`;
}

export function praiseLogText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No praise recorded.';
  const base = `${clean.customer} on ${clean.date}: ${clean.description.replace(/\.+$/, '')}.`;
  return clean.subject ? `${base} Praised: ${clean.subject}.` : base;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function praiseLogHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No praise recorded.</p>';
  return `<p>${escapeHtml(praiseLogText(entry))}</p>`;
}

export function praiseLogAllHtml(list) {
  const sorted = praiseLogSorted(list);
  if (!sorted.length) return '<p>No praise recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(praiseLogText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function praiseLogCsv(list) {
  const sorted = praiseLogSorted(list);
  const header = ['id', 'customer', 'date', 'description', 'subject'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.date,
    item.description,
    item.subject,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function praiseLogFilename() {
  return PRAISE_LOG_FILENAME;
}
