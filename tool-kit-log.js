// Plan 148 (Plan 101-202) — Field tool kit issue log.
//
// Field tools go out with a collector and nobody records who holds
// them, so losses and shortages surface late. This module is the
// issue log that stops that guess: one kit issue record per tool,
// with the tool name, who it was issued to, the issue date, and
// the return date. An outstanding-tools list shows unreturned
// items by holder and age, and returning a tool clears it from
// that list at once.
//
// What this module is NOT, stated plainly:
//   - It is not the tool custody register. The SISP-82 custody
//     register (tool-custody-register.js, store sisp_field_tools_v1)
//     tracks each expensive reusable tool as an asset — its type,
//     serial, condition, splice/cleave counters, and append-only
//     history — and it is neither read nor written here. This log
//     records issue events only: a tool name, a holder, and two
//     dates. It never creates, assigns, conditions, counts, or
//     rewrites any custody record.
//   - It is not a stock register. Recording an issue or a return
//     never changes any stock register count, any spare reorder,
//     any warranty record, or any payment record.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a tool name, a holder,
//     and a real calendar date. A record with no tool, no
//     holder, or no date is refused, and so is one with an
//     impossible date or a return date before its issue date.
//     Unknown fields are dropped, so a record can never grow a
//     stock, custody, warranty, or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later changes are returning and removal.
//   - One outstanding issue per tool: a tool that is already out
//     (same name, case-insensitive, with no return date) cannot
//     gain a second outstanding record. Once it is returned, a
//     fresh issue for the same tool is allowed.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validToolKitDate(value) {
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

function daysSinceEpoch(date) {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

/** Normalize one kit issue record, or null when half-formed. */
export function normalizeToolKitRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const tool = cleanText(raw.tool);
  const issuedTo = cleanText(raw.issuedTo);
  const issueDate = validToolKitDate(raw.issueDate);
  if (!id || !tool || !issuedTo || !issueDate) return null;
  let returnDate = '';
  if (raw.returnDate !== undefined && raw.returnDate !== null && String(raw.returnDate).trim() !== '') {
    returnDate = validToolKitDate(raw.returnDate);
    if (!returnDate || returnDate < issueDate) return null;
  }
  return {
    id,
    tool,
    issuedTo,
    issueDate,
    returnDate,
    note: cleanText(raw.note),
  };
}

/** Normalize a list: drop half-formed records and duplicate ids (first wins). */
export function normalizeToolKitList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeToolKitRecord(raw);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

/** Find one record by id, or null. */
export function findToolKitRecord(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeToolKitList(list).find((item) => item.id === clean) || null;
}

/** True when the record is still out (no return date). */
export function isToolKitOutstanding(item) {
  return item.returnDate === '';
}

/**
 * Save one issue record. Returns a new list, or the input unchanged
 * when the record is half-formed, repeats an id, or would put a
 * second outstanding issue on the same tool.
 */
export function upsertToolKitIssue(list, raw) {
  const clean = normalizeToolKitList(list);
  const record = normalizeToolKitRecord(raw);
  if (!record) return clean;
  if (clean.some((item) => item.id === record.id)) return clean;
  if (record.returnDate === '') {
    const clash = clean.some(
      (item) => item.returnDate === '' && item.tool.toLowerCase() === record.tool.toLowerCase(),
    );
    if (clash) return clean;
  }
  return [...clean, record];
}

/**
 * Record a return: set the return date on an outstanding record.
 * Returns a new list, or the input unchanged when the id is
 * unknown, the record is already returned, or the date is invalid
 * or before the issue date.
 */
export function returnToolKitIssue(list, id, returnDate) {
  const clean = normalizeToolKitList(list);
  const date = validToolKitDate(returnDate);
  const target = clean.find((item) => item.id === cleanText(id));
  if (!target || target.returnDate !== '' || !date || date < target.issueDate) return clean;
  return clean.map((item) => (item.id === target.id ? { ...item, returnDate: date } : item));
}

/** Remove one record by id. Returns a new list. */
export function removeToolKitIssue(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeToolKitList(list);
  return normalizeToolKitList(list).filter((item) => item.id !== clean);
}

/**
 * Whole days a tool has been out at the reference date, or null
 * when either date is invalid. Never negative: a reference date
 * before the issue date counts as 0 days.
 */
export function toolKitAgeDays(issueDate, referenceDate) {
  const from = validToolKitDate(issueDate);
  const to = validToolKitDate(referenceDate);
  if (!from || !to) return null;
  return Math.max(0, daysSinceEpoch(to) - daysSinceEpoch(from));
}

function matchesHolder(item, holder) {
  const key = cleanText(holder).toLowerCase();
  if (!key) return true;
  return item.issuedTo.toLowerCase() === key;
}

/**
 * Outstanding tools at the reference date: unreturned records,
 * sorted by holder A-Z, then age descending (oldest out first),
 * then id A-Z. An invalid reference date gives an empty list,
 * never a guessed order.
 */
export function outstandingToolKitList(list, referenceDate, holder) {
  if (validToolKitDate(referenceDate) === null) return [];
  const clean = normalizeToolKitList(list);
  return clean
    .filter((item) => item.returnDate === '' && matchesHolder(item, holder))
    .sort((a, b) => {
      const byHolder = compareText(a.issuedTo.toLowerCase(), b.issuedTo.toLowerCase());
      if (byHolder !== 0) return byHolder;
      const ageA = toolKitAgeDays(a.issueDate, referenceDate);
      const ageB = toolKitAgeDays(b.issueDate, referenceDate);
      if (ageB !== ageA) return ageB - ageA;
      return compareText(a.id, b.id);
    });
}

/** One-line summary of the whole log. */
export function toolKitSummaryText(list) {
  const clean = normalizeToolKitList(list);
  if (clean.length === 0) return 'No tool kit issue record yet.';
  const outstanding = clean.filter((item) => item.returnDate === '').length;
  const holders = new Set(clean.map((item) => item.issuedTo.toLowerCase())).size;
  return `${clean.length} issue record${clean.length === 1 ? '' : 's'} across ${holders} holder${holders === 1 ? '' : 's'}; `
    + `${outstanding} still outstanding.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function outstandingRowHtml(item, referenceDate) {
  const age = toolKitAgeDays(item.issueDate, referenceDate);
  return `<tr><td>${esc(item.tool)}</td><td>${esc(item.issuedTo)}</td><td>${esc(item.issueDate)}</td>`
    + `<td>${age} day${age === 1 ? '' : 's'}</td><td>${esc(item.note)}</td></tr>`;
}

/**
 * Outstanding-tools list at the reference date, by holder and age.
 * A missing reference date says so plainly instead of guessing.
 */
export function toolKitOutstandingHtml(list, referenceDate, holder) {
  if (validToolKitDate(referenceDate) === null) {
    return '<p>Give a valid reference date to list outstanding tools.</p>';
  }
  const rows = outstandingToolKitList(list, referenceDate, holder);
  if (rows.length === 0) return '<p>No outstanding tools.</p>';
  const body = rows.map((item) => outstandingRowHtml(item, referenceDate)).join('');
  return '<table><thead><tr><th>Tool</th><th>Issued to</th><th>Issue date</th>'
    + '<th>Age</th><th>Note</th></tr></thead><tbody>' + body + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of kit issue records. */
export function toolKitCsv(list) {
  const rows = normalizeToolKitList(list);
  const lines = ['id,tool,issuedTo,issueDate,returnDate,note'];
  for (const item of rows) {
    lines.push([item.id, item.tool, item.issuedTo, item.issueDate, item.returnDate, item.note].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the log. */
export function toolKitFilename() {
  return 'tool-kit-log.csv';
}
