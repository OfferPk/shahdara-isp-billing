// Plan 134 (Plan 101-202) — Planned vs unplanned outage distinction.
//
// Planned maintenance and sudden faults were recorded the same way,
// so nobody could tell what was announced and what was a surprise.
// This module is that distinction: one outage record with a type
// (planned or unplanned), the mohallas it hit, a start date and an
// optional end date, and whether notice was given plus a note.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of any outage record. No record from
//     Plan 22's outage grouping, Plan 93's outage credits, or the
//     feeder-impact view is read or written here: an outage here
//     names its own type and mohallas, and recording it never
//     rewrites, closes, reopens, or otherwise changes any other
//     outage, ticket, or impact record.
//   - It is not a goodwill credit, a bill, or a payment. Recording
//     an outage here creates no credit, no bill, no charge, and no
//     payment figure of any kind, and it never changes one: Plan
//     93's outage credits are left exactly as they are, and a
//     planned outage that was announced is still only a record —
//     it grants nothing by itself.
//   - It is not a promise that notice reached anyone. The record
//     says only whether notice was given and what the note says;
//     the module verifies the shape of the note, not its delivery.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the
//     network, never imports another module, and never mutates an
//     input. Every function returns a new list or new rows.
//   - Half-formed entries are refused outright, never stored
//     half-formed: an entry needs an id, a type of planned or
//     unplanned, at least one mohalla, and a real calendar start
//     date. An end date, when given, must be a real calendar date
//     on or after the start date. An entry with no id, no type,
//     no mohalla, or no start date is refused, and so is one with
//     an impossible date or an end before its start. Unknown
//     fields are dropped, so an entry can never grow a credit,
//     bill, or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function; the
//     only later change is removal.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - Filters keep the two kinds apart: planned and unplanned
//     outages filter separately, newest first. An unplanned
//     outage never requires a notice note. A planned outage with
//     no notice note is flagged, never hidden: the flag is a
//     label on the record, not a block, and flagging changes no
//     other record.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validOutageTypeDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function cleanMohallas(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const name = cleanText(item);
    if (name && !out.some((row) => row.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out;
}

function sameMohallas(a, b) {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

/** Normalise one entry, or null when it is half-formed. */
export function normalizeOutageType(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const type = cleanText(record.type).toLowerCase();
  const mohallas = cleanMohallas(record.mohallas);
  const startDate = validOutageTypeDate(record.startDate);
  if (!id || (type !== 'planned' && type !== 'unplanned') || mohallas.length === 0 || !startDate) return null;
  let endDate = '';
  if (record.endDate !== undefined && record.endDate !== null && cleanText(record.endDate) !== '') {
    endDate = validOutageTypeDate(record.endDate);
    if (!endDate || compareText(endDate, startDate) < 0) return null;
  }
  return {
    id,
    type,
    mohallas,
    startDate,
    endDate,
    noticeGiven: record.noticeGiven === true,
    noticeNote: cleanText(record.noticeNote),
  };
}

/** Normalise a list, dropping half-formed entries. */
export function normalizeOutageTypeList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const item = normalizeOutageType(record);
    if (item && !out.some((row) => row.id === item.id)) out.push(item);
  }
  return out;
}

/** Find one entry by id, or null. */
export function findOutageType(list, id) {
  const base = normalizeOutageTypeList(list);
  return base.find((item) => item.id === cleanText(id)) ?? null;
}

/**
 * Save one entry. An identical re-save leaves the list unchanged;
 * a re-save of the same id with different figures is refused.
 * A half-formed entry is refused. Returns a new list.
 */
export function upsertOutageType(list, record) {
  const base = normalizeOutageTypeList(list);
  const item = normalizeOutageType(record);
  if (!item) return base;
  const at = base.findIndex((row) => row.id === item.id);
  if (at === -1) return [...base, item];
  const existing = base[at];
  const same = existing.type === item.type
    && sameMohallas(existing.mohallas, item.mohallas)
    && existing.startDate === item.startDate
    && existing.endDate === item.endDate
    && existing.noticeGiven === item.noticeGiven
    && existing.noticeNote === item.noticeNote;
  if (same) return base;
  return base;
}

/** Remove one entry by id. Returns a new list. */
export function removeOutageType(list, id) {
  const base = normalizeOutageTypeList(list);
  const key = cleanText(id);
  return base.filter((item) => item.id !== key);
}

function sortNewestFirst(rows) {
  return [...rows].sort((a, b) => compareText(b.startDate, a.startDate) || compareText(a.id, b.id));
}

/** Outages of one type only (planned or unplanned), newest first. */
export function outagesByType(list, type) {
  const base = normalizeOutageTypeList(list);
  const key = cleanText(type).toLowerCase();
  if (key !== 'planned' && key !== 'unplanned') return [];
  return sortNewestFirst(base.filter((item) => item.type === key));
}

/** Outages in one mohalla (case-insensitive), newest first. */
export function outagesForMohalla(list, mohalla) {
  const base = normalizeOutageTypeList(list);
  const key = cleanText(mohalla).toLowerCase();
  if (!key) return [];
  return sortNewestFirst(base.filter((item) => item.mohallas.some((name) => name.toLowerCase() === key)));
}

/**
 * A planned outage with no notice note is flagged. An unplanned
 * outage is never flagged for missing a note: a surprise needs no
 * announcement. Flagging is only a label; it changes nothing else.
 */
export function isMissingNotice(item) {
  if (!item || item.type !== 'planned') return false;
  return cleanText(item.noticeNote) === '';
}

/** Planned outages with no notice note, newest first. */
export function missingNoticeOutages(list) {
  const base = normalizeOutageTypeList(list);
  return sortNewestFirst(base.filter((item) => isMissingNotice(item)));
}

/** Counts per type, planned first. */
export function outageTypeCounts(list) {
  const base = normalizeOutageTypeList(list);
  const planned = base.filter((item) => item.type === 'planned').length;
  const unplanned = base.length - planned;
  return { planned, unplanned, total: base.length, missingNotice: missingNoticeOutages(base).length };
}

/** One-line summary of the whole record. */
export function outageTypeSummaryText(list) {
  const base = normalizeOutageTypeList(list);
  if (base.length === 0) return 'No outage recorded yet.';
  const counts = outageTypeCounts(base);
  const flag = counts.missingNotice === 0
    ? 'no planned outage missing its notice note'
    : `${counts.missingNotice} planned outage${counts.missingNotice === 1 ? '' : 's'} missing ${counts.missingNotice === 1 ? 'its' : 'their'} notice note`;
  return `${counts.total} outage${counts.total === 1 ? '' : 's'}: ${counts.planned} planned, ${counts.unplanned} unplanned; ${flag}.`;
}

/** A filtered list: one type's outages, newest first, with the notice flag. */
export function outageTypeHtml(list, type) {
  const rows = outagesByType(list, type);
  const key = cleanText(type).toLowerCase();
  if (key !== 'planned' && key !== 'unplanned') return '<p>Pick planned or unplanned to see that kind of outage.</p>';
  if (rows.length === 0) return `<p>No ${key} outage recorded yet.</p>`;
  const heading = `<p>${rows.length} ${key} outage${rows.length === 1 ? '' : 's'} recorded, newest first.</p>`;
  const body = rows
    .map((item) => `<tr><td>${escapeHtml(item.id)}</td><td>${escapeHtml(item.startDate)}</td><td>${escapeHtml(item.endDate || '—')}</td><td>${escapeHtml(item.mohallas.join(', '))}</td><td>${item.noticeGiven ? 'Yes' : 'No'}</td><td>${escapeHtml(item.noticeNote)}</td><td>${isMissingNotice(item) ? '⚠️ Missing notice note' : '—'}</td></tr>`)
    .join('');
  return `${heading}<table><thead><tr><th>Id</th><th>Start</th><th>End</th><th>Mohallas</th><th>Notice given</th><th>Notice note</th><th>Flag</th></tr></thead><tbody>${body}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of entries. */
export function outageTypeCsv(list) {
  const base = normalizeOutageTypeList(list);
  const header = 'id,type,mohallas,start_date,end_date,notice_given,notice_note';
  const rows = base.map((item) => [item.id, item.type, item.mohallas.join('; '), item.startDate, item.endDate, item.noticeGiven ? 'yes' : 'no', item.noticeNote].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

/** CSV filename for the record. */
export function outageTypeFilename() {
  return 'outage-type-record.csv';
}
