// Plan 286 (Plan 203-350) — Customer birthday month list.
//
// Birthdays are only usable as greeting drafts, so the operator cannot
// see at a glance whose birthday falls in a given month. This module
// is the BIRTHDAY-MONTH VIEW for that question: one list per month,
// composed from caller-supplied birth-date rows only — customer,
// birth day, and mohalla. Each month's list shows exactly the
// customers whose birth dates fall in that month, and a month with
// no birthdays says so plainly.
//
// What this module is NOT, stated plainly:
//   - It is not the birthday greeting draft (Plan 163). That draft
//     is the message itself, with its own record, sent-date marking,
//     and upcoming-seven-days list; it is neither read nor written
//     here. The caller supplies every birth-date row, and this
//     module imports nothing — it only reads the rows it is given.
//   - It is not a record. There is no record, edit, or remove
//     function here at all: no birth date is stored, changed, or
//     deleted by viewing a month's list.
//   - It is not a greeting. Viewing a list never sends any message
//     and never marks anything sent.
//   - It is not proof that a birth date is real. The view says what
//     the supplied rows say; the module verifies format and
//     ordering, not truth.
//   - Viewing a list never changes any customer record, bill, or
//     payment.
//
// How the module keeps those fences:
//   - It is pure and import-free: no storage, no clock, no network.
//   - A row is a customer plus a strict birth date; mohalla is
//     optional and reads blank when unknown. Bad rows are dropped,
//     never guessed at, and the caller's list is never mutated.
//   - A row whose kind is given and is not a birthday is dropped,
//     so an anniversary date can never appear in a birthday list.
//   - One birth date per customer: a second row for the same
//     customer (case-insensitive) is dropped, keeping the first.
//   - A month's list is sorted by birth day, then customer A-Z, so
//     the same rows always give the same list.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
  if (month < 1 || month > 12 || day < 1) return null;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** True when value is a real calendar date in YYYY-MM-DD form. */
export function validBirthdayDate(value) {
  return strictDate(value) !== null;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** True when month is a whole month number 1-12 (number or numeric string). */
export function validBirthdayMonth(month) {
  if (typeof month === 'number') return Number.isInteger(month) && month >= 1 && month <= 12;
  if (typeof month === 'string' && /^\d+$/.test(month.trim())) {
    const n = Number(month.trim());
    return n >= 1 && n <= 12;
  }
  return false;
}

/** Month number 1-12, or null for a bad month. */
function monthNumber(month) {
  return validBirthdayMonth(month) ? Number(month) : null;
}

/** Month name for a month number 1-12, or '' for a bad month. */
export function monthName(month) {
  const n = monthNumber(month);
  return n === null ? '' : MONTH_NAMES[n - 1];
}

/**
 * One birth-date row, or null when half-formed. Never mutates its
 * input. A row with a kind other than birthday is dropped, so an
 * anniversary date can never appear in a birthday list.
 */
export function normalizeBirthdayRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const customer = text(row.customer);
  const date = strictDate(row.date);
  if (!customer || !date) return null;
  if (row.kind !== undefined && row.kind !== null) {
    if (text(row.kind).toLowerCase() !== 'birthday') return null;
  }
  const month = Number(date.slice(5, 7));
  const birthDay = Number(date.slice(8, 10));
  return { customer, date, month, birthDay, mohalla: text(row.mohalla) };
}

/**
 * Normalised birth-date rows only; bad rows are dropped, and a second
 * row for the same customer (case-insensitive) is dropped, keeping
 * the first. Order is kept.
 */
export function normalizeBirthdayRows(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const row = normalizeBirthdayRow(raw);
    if (!row) continue;
    const key = row.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function sortByDayThenCustomer(a, b) {
  return (a.birthDay - b.birthDay)
    || (a.customer.toLowerCase() < b.customer.toLowerCase() ? -1 : a.customer.toLowerCase() > b.customer.toLowerCase() ? 1 : 0)
    || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

/**
 * One month's birthday list, or null for a bad month. The entries are
 * exactly the customers whose birth dates fall in that month, sorted
 * by birth day then customer A-Z. A month with no birthdays has an
 * empty list and hasBirthdays false.
 */
export function birthdaysForMonth(rows, month) {
  const n = monthNumber(month);
  if (n === null) return null;
  const entries = normalizeBirthdayRows(rows)
    .filter((row) => row.month === n)
    .sort(sortByDayThenCustomer);
  return {
    month: n,
    monthName: MONTH_NAMES[n - 1],
    entries,
    count: entries.length,
    hasBirthdays: entries.length > 0,
  };
}

/** All twelve month lists in calendar order, each with its own entries. */
export function birthdaysByMonth(rows) {
  const list = normalizeBirthdayRows(rows);
  return MONTH_NAMES.map((name, index) => {
    const n = index + 1;
    const entries = list.filter((row) => row.month === n).sort(sortByDayThenCustomer);
    return { month: n, monthName: name, entries, count: entries.length, hasBirthdays: entries.length > 0 };
  });
}

/** Plain-words summary for a set of birth-date rows. */
export function birthdayMonthSummaryText(rows) {
  const list = normalizeBirthdayRows(rows);
  if (!list.length) return 'No birthdays recorded.';
  const months = new Set(list.map((row) => row.month)).size;
  const customerWord = list.length === 1 ? 'birthday' : 'birthdays';
  const monthWord = months === 1 ? 'month' : 'months';
  return `${list.length} ${customerWord} recorded across ${months} ${monthWord}.`;
}

/** Plain-words text for one month's list; an empty month says so plainly. */
export function birthdayMonthText(monthView) {
  if (!monthView) return 'Give a month from 1 to 12 to see its birthdays.';
  if (!monthView.hasBirthdays) return `No birthdays in ${monthView.monthName}.`;
  const lines = monthView.entries.map((entry) => {
    const place = entry.mohalla ? ` — ${entry.mohalla}` : '';
    return `${entry.customer} — day ${entry.birthDay} (${entry.date})${place}`;
  });
  return `${monthView.monthName}: ${monthView.count} birthday${monthView.count === 1 ? '' : 's'}\n${lines.join('\n')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escaped HTML for one month's list; an empty month says so plainly. */
export function birthdayMonthHtml(monthView) {
  if (!monthView) return '<p>Give a month from 1 to 12 to see its birthdays.</p>';
  if (!monthView.hasBirthdays) return `<p>No birthdays in ${escapeHtml(monthView.monthName)}.</p>`;
  const rows = monthView.entries.map((entry) => `<tr><td>${escapeHtml(entry.customer)}</td>`
    + `<td>${entry.birthDay}</td><td>${escapeHtml(entry.date)}</td>`
    + `<td>${escapeHtml(entry.mohalla || 'Mohalla not recorded')}</td></tr>`).join('');
  return `<table><thead><tr><th>Customer</th><th>Birth day</th><th>Birth date</th><th>Mohalla</th></tr></thead>`
    + `<tbody>${rows}</tbody></table>`;
}

/** Escaped HTML for all twelve month lists in calendar order. */
export function birthdayMonthsHtml(monthViews) {
  if (!Array.isArray(monthViews) || !monthViews.length) return '<p>No birthdays recorded.</p>';
  return monthViews.map((view) => `<h5>${escapeHtml(view.monthName)} (${view.count})</h5>${birthdayMonthHtml(view)}`).join('');
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** CSV for one month's list, one row per birthday. */
export function birthdayMonthCsv(monthView) {
  const lines = ['month,customer,birth day,birth date,mohalla'];
  if (monthView) {
    for (const entry of monthView.entries) {
      lines.push([monthView.monthName, entry.customer, entry.birthDay, entry.date, entry.mohalla]
        .map(csvCell).join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}

/** CSV for all twelve months, one row per birthday. */
export function birthdayMonthsCsv(rows) {
  const lines = ['month,customer,birth day,birth date,mohalla'];
  for (const view of birthdaysByMonth(rows)) {
    for (const entry of view.entries) {
      lines.push([view.monthName, entry.customer, entry.birthDay, entry.date, entry.mohalla]
        .map(csvCell).join(','));
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Filename for one month's CSV, e.g. birthdays-january.csv. */
export function birthdayMonthFilename(month) {
  const name = monthName(month);
  return name ? `birthdays-${name.toLowerCase()}.csv` : 'birthdays.csv';
}

export function birthdayMonthsFilename() {
  return 'birthdays-all-months.csv';
}
