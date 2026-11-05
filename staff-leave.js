// Plan 291 (Plan 203-350) — Staff leave record.
//
// Staff leave is agreed verbally, so later nobody can prove how
// many days were taken, when, or whether they were approved. This
// module adds only the missing piece: one leave record per entry
// — the staff member, the leave dates, the leave type in plain
// words, the approver, and the status — so leave is listed per
// staff member and per month with dates and approver visible.
//
// What this module is NOT, stated plainly:
//   - It is not a bill, payment, customer, or duty-roster
//     change. Recording leave never changes any bill, payment,
//     customer record, or duty roster by itself; it only records
//     that leave was taken or approved, by whom, and when.
//   - It is not the on-call rota. Leave and on-call duty are
//     separate records; the rota itself is neither read nor
//     rewritten here, and recording leave never assigns or
//     removes anyone from a rota.
//   - It is not the annual leave planner. This module records
//     leave actually taken or approved only; it never plans the
//     year ahead, and a planned block is never treated as taken.
//   - It is not a live record. A past leave entry is read-only:
//     there is no edit function, only record, find, and remove,
//     so a wrong entry is removed and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     entry, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - An entry with no id, no staff member, no strict leave
//     dates, no leave type, or no approver is refused outright.
//     Unknown fields are dropped, so an entry can never grow a
//     bill, payment, customer, or roster field.
//   - A duplicate id is never rewritten.
//   - Status folds from plain spellings, and an entry with no
//     status, or an unclear one, reads as pending, because
//     leave that is only agreed verbally is not approved yet.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validStaffLeaveDate(value) {
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

/** Strict calendar month: YYYY-MM that really exists, or false. */
export function validStaffLeaveMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/**
 * Status in plain words: 'approved', 'approve', 'yes', or 'true'
 * read as approved; 'taken' reads as taken; 'declined',
 * 'decline', 'rejected', 'no', or 'false' read as declined;
 * 'pending', 'requested', or 'awaiting' read as pending. A
 * missing or unclear status reads as pending, because leave that
 * is only agreed verbally is not approved yet.
 */
export function foldStaffLeaveStatus(value) {
  const raw = text(value).toLowerCase();
  if (raw === 'approved' || raw === 'approve' || raw === 'yes' || raw === 'true') return 'approved';
  if (raw === 'taken') return 'taken';
  if (raw === 'declined' || raw === 'decline' || raw === 'rejected' || raw === 'no' || raw === 'false') return 'declined';
  return 'pending';
}

function daysInMonth(year, month) {
  return month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
}

/** Whole days from 0001-01-01 to the given strict date, by integer arithmetic only. */
function daysSinceEpoch(date) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const yearsBefore = year - 1;
  let days = yearsBefore * 365
    + Math.floor(yearsBefore / 4)
    - Math.floor(yearsBefore / 100)
    + Math.floor(yearsBefore / 400);
  for (let m = 1; m < month; m += 1) days += daysInMonth(year, m);
  return days + (day - 1);
}

/**
 * Inclusive whole days between two strict dates (a one-day leave
 * counts as 1), or null when either date is bad or the end falls
 * before the start. Integer arithmetic only: no clock, no
 * calendar object.
 */
export function staffLeaveDaysBetween(startDate, endDate) {
  const start = text(startDate);
  const end = text(endDate);
  if (!validStaffLeaveDate(start) || !validStaffLeaveDate(end)) return null;
  const span = daysSinceEpoch(end) - daysSinceEpoch(start);
  if (span < 0) return null;
  return span + 1;
}

/**
 * One staff leave entry, or null when half-formed. An entry needs
 * an id, a staff member, strict start and end dates with the end
 * on or after the start, a leave type in plain words, and an
 * approver. Status folds from plain spellings and defaults to
 * pending; unknown fields are dropped; the input is never mutated.
 */
export function normalizeStaffLeave(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const staffMember = text(raw.staffMember);
  const startDate = text(raw.startDate);
  const endDate = text(raw.endDate);
  const leaveType = text(raw.leaveType);
  const approver = text(raw.approver);
  if (!id || !staffMember || !leaveType || !approver) return null;
  if (staffLeaveDaysBetween(startDate, endDate) === null) return null;
  return {
    id,
    staffMember,
    startDate,
    endDate,
    leaveType,
    approver,
    status: foldStaffLeaveStatus(raw.status),
  };
}

/** Normalised entries only; a duplicate id is never rewritten, the first stays. */
export function normalizeStaffLeaveList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeStaffLeave(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findStaffLeave(list, id) {
  const clean = normalizeStaffLeaveList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordStaffLeave(list, raw) {
  const clean = normalizeStaffLeaveList(list);
  const entry = normalizeStaffLeave(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeStaffLeave(list, id) {
  const clean = normalizeStaffLeaveList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

/** Inclusive whole days of one leave entry, or null when the entry is half-formed. */
export function staffLeaveDays(entry) {
  const clean = normalizeStaffLeave(entry);
  if (!clean) return null;
  return staffLeaveDaysBetween(clean.startDate, clean.endDate);
}

/** Entries in start-date order, then staff member A-Z, then id, so the same list always reads the same way. */
export function staffLeaveSorted(list) {
  const clean = normalizeStaffLeaveList(list);
  return [...clean].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    const aStaff = a.staffMember.toLowerCase();
    const bStaff = b.staffMember.toLowerCase();
    if (aStaff !== bStaff) return aStaff < bStaff ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Leave for one staff member, in start-date order; the match is case-insensitive. */
export function staffLeaveForStaff(list, staffMember) {
  const wanted = text(staffMember).toLowerCase();
  if (!wanted) return [];
  return staffLeaveSorted(list).filter((entry) => entry.staffMember.toLowerCase() === wanted);
}

/** Staff members with leave recorded, first spelling kept, A-Z. */
export function staffLeaveStaffList(list) {
  const clean = normalizeStaffLeaveList(list);
  const seen = new Map();
  for (const entry of clean) {
    const key = entry.staffMember.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.staffMember);
  }
  return [...seen.values()].sort((a, b) => {
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();
    return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : 0;
  });
}

/**
 * Leave overlapping one calendar month (YYYY-MM): an entry counts
 * when any of its leave days fall in that month, so a leave that
 * starts in one month and ends in the next is visible in both.
 * Returns [] for a month that is not a real calendar month.
 */
export function staffLeaveForMonth(list, month) {
  if (!validStaffLeaveMonth(month)) return [];
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const firstDay = `${month}-01`;
  const lastDay = `${month}-${String(daysInMonth(year, monthNumber)).padStart(2, '0')}`;
  return staffLeaveSorted(list).filter((entry) => entry.startDate <= lastDay && entry.endDate >= firstDay);
}

/** Whole leave days recorded for one staff member, across every entry. */
export function staffLeaveTotalDays(list, staffMember) {
  return staffLeaveForStaff(list, staffMember)
    .reduce((total, entry) => total + staffLeaveDaysBetween(entry.startDate, entry.endDate), 0);
}

export function staffLeaveSummaryText(list) {
  const clean = normalizeStaffLeaveList(list);
  if (clean.length === 0) return 'No staff leave recorded.';
  const word = clean.length === 1 ? 'entry' : 'entries';
  const latest = staffLeaveSorted(clean).at(-1);
  return `${clean.length} staff leave ${word} recorded. Latest leave starts ${latest.startDate}.`;
}

/** Plain-words text for one entry: who, when, what type, who approved it, and its status. */
export function staffLeaveEntryText(entry) {
  const clean = normalizeStaffLeave(entry);
  if (!clean) return 'No staff leave recorded.';
  const days = staffLeaveDaysBetween(clean.startDate, clean.endDate);
  const dayWord = days === 1 ? 'day' : 'days';
  const range = clean.startDate === clean.endDate
    ? clean.startDate
    : `${clean.startDate} to ${clean.endDate}`;
  return `${clean.staffMember} — ${range} (${days} ${dayWord}), ${clean.leaveType} — approved by ${clean.approver} — ${clean.status}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function staffLeaveEntryHtml(entry) {
  const clean = normalizeStaffLeave(entry);
  if (!clean) return '<p>No staff leave recorded.</p>';
  return `<p>${escapeHtml(staffLeaveEntryText(clean))}</p>`;
}

export function staffLeaveStaffHtml(list, staffMember) {
  const rows = staffLeaveForStaff(list, staffMember);
  if (!rows.length) return `<p>No leave recorded for ${escapeHtml(text(staffMember))}.</p>`;
  const total = staffLeaveTotalDays(list, staffMember);
  const dayWord = total === 1 ? 'day' : 'days';
  return `<p>${escapeHtml(rows[0].staffMember)} — ${total} ${dayWord} of leave recorded.</p><ul>${rows.map((entry) => `<li>${escapeHtml(staffLeaveEntryText(entry))}</li>`).join('')}</ul>`;
}

export function staffLeaveMonthHtml(list, month) {
  if (!validStaffLeaveMonth(month)) return '<p>No leave recorded for this month.</p>';
  const rows = staffLeaveForMonth(list, month);
  if (!rows.length) return `<p>No leave recorded for ${escapeHtml(month)}.</p>`;
  return `<p>Leave in ${escapeHtml(month)}:</p><ul>${rows.map((entry) => `<li>${escapeHtml(staffLeaveEntryText(entry))}</li>`).join('')}</ul>`;
}

export function staffLeaveAllHtml(list) {
  const rows = staffLeaveSorted(list);
  if (!rows.length) return '<p>No staff leave recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(staffLeaveEntryText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function staffLeaveCsv(list) {
  const rows = staffLeaveSorted(list);
  const lines = ['"id","staff member","start date","end date","days","leave type","approver","status"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.staffMember),
      csvCell(entry.startDate),
      csvCell(entry.endDate),
      csvCell(staffLeaveDaysBetween(entry.startDate, entry.endDate)),
      csvCell(entry.leaveType),
      csvCell(entry.approver),
      csvCell(entry.status),
    ].join(','));
  }
  return lines.join('\n');
}

export function staffLeaveFilename() {
  return 'staff-leave.csv';
}
