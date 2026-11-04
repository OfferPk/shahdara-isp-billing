// Plan 132 (Plan 101-202) — Fault parts-used log.
//
// A fault is fixed but nobody records which part was used, so the shop
// cannot see what faults actually consume and a repeat fault cannot be
// traced back to a part. This module is that log: one parts-used
// record per fault fix, with a ticket link, a part name, a quantity,
// and a date.
//
// What this module is NOT, stated plainly:
//   - It is not a stock movement. Recording a part here never changes
//     any on-hand, issued, or in-repair count anywhere: counts move
//     only through the normal stock-issue path, and this log only
//     names what was used. A part recorded here and never issued
//     through that path is visible as a mismatch for the operator
//     to chase, not silently reconciled.
//   - It is not a second copy of any ticket record. A ticket is
//     linked by its id only; the ticket itself — its status, its
//     customer, its outcome — is never read or written here.
//     Whether a ticket is closed is the ticket record's own fact;
//     this module lists parts for whatever ticket id it is given.
//   - It is not a charge. Recording a part creates no bill, no
//     payment, and no cost figure of any kind.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     never imports another module, and never mutates an input.
//     Every function returns a new list or new rows.
//   - Half-formed entries are refused outright, never stored
//     half-formed: an entry needs an id, a ticket link, a part
//     name, a positive whole quantity, and a real calendar date.
//     An entry with no ticket link or no quantity is refused, and
//     so is one with a zero, negative, or fractional quantity.
//     Unknown fields are dropped, so an entry can never grow a
//     count, bill, or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function; the
//     only later change is removal.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - Period sums group by part name case-insensitively, so "ONU"
//     and "onu" sum together, and the displayed name is the first
//     spelling the operator used. Sums are whole units only.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validFaultPartDate(value) {
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

/** Normalise one entry, or null when it is half-formed. */
export function normalizeFaultPart(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const ticketId = cleanText(record.ticketId);
  const part = cleanText(record.part);
  const date = validFaultPartDate(record.date);
  const quantity = record.quantity;
  if (!id || !ticketId || !part || !date) return null;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) return null;
  return {
    id,
    ticketId,
    part,
    quantity,
    date,
    note: cleanText(record.note),
  };
}

/** Normalise a list, dropping every unusable entry. */
export function normalizeFaultPartList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const item = normalizeFaultPart(record);
    if (item) out.push(item);
  }
  return out;
}

/** Find one entry by id, or null. */
export function findFaultPart(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return null;
  for (const item of normalizeFaultPartList(list)) {
    if (item.id === wanted) return item;
  }
  return null;
}

/**
 * Add one entry. A duplicate id is never rewritten: an identical
 * re-save returns the list unchanged, and a re-save with different
 * figures is refused, returning the list unchanged as well. A
 * half-formed entry is refused the same way.
 */
export function upsertFaultPart(list, record) {
  const base = normalizeFaultPartList(list);
  const item = normalizeFaultPart(record);
  if (!item) return base;
  const existing = base.find((row) => row.id === item.id);
  if (existing) return base;
  return [...base, item];
}

/** Remove one entry by id; unknown ids leave the list unchanged. */
export function removeFaultPart(list, id) {
  const wanted = cleanText(id);
  const base = normalizeFaultPartList(list);
  if (!wanted) return base;
  return base.filter((item) => item.id !== wanted);
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Every part used on one ticket, oldest date first, then part
 * name A-Z, then entry id. A ticket with no entry lists as empty,
 * never as a guessed part.
 */
export function partsForTicket(list, ticketId) {
  const wanted = cleanText(ticketId);
  if (!wanted) return [];
  return normalizeFaultPartList(list)
    .filter((item) => item.ticketId === wanted)
    .sort((a, b) => compareText(a.date, b.date) || compareText(a.part.toLowerCase(), b.part.toLowerCase()) || compareText(a.id, b.id));
}

/**
 * Quantities summed per part over a period, both end dates
 * inclusive. Returns null when either end date is unusable or the
 * start falls after the end — an empty sum would pretend nothing
 * was used. Rows carry the first spelling used for the part name
 * and sort part name A-Z (case-insensitive).
 */
export function sumPartsForPeriod(list, startDate, endDate) {
  const start = validFaultPartDate(startDate);
  const end = validFaultPartDate(endDate);
  if (!start || !end || start > end) return null;
  const grouped = new Map();
  for (const item of normalizeFaultPartList(list)) {
    if (item.date < start || item.date > end) continue;
    const key = item.part.toLowerCase();
    const row = grouped.get(key);
    if (row) row.quantity += item.quantity;
    else grouped.set(key, { part: item.part, quantity: item.quantity });
  }
  return [...grouped.values()].sort((a, b) => compareText(a.part.toLowerCase(), b.part.toLowerCase()));
}

/** One plain-words line about the whole log. */
export function faultPartSummaryText(list) {
  const base = normalizeFaultPartList(list);
  if (base.length === 0) return 'No fault part recorded yet.';
  const tickets = new Set(base.map((item) => item.ticketId)).size;
  const units = base.reduce((sum, item) => sum + item.quantity, 0);
  const entryWord = base.length === 1 ? 'entry' : 'entries';
  const ticketWord = tickets === 1 ? 'ticket' : 'tickets';
  const unitWord = units === 1 ? 'unit' : 'units';
  return `${base.length} parts-used ${entryWord} across ${tickets} ${ticketWord}; ${units} ${unitWord} in total.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HTML table for a list of entries, oldest date first. */
export function faultPartHtml(list) {
  const base = normalizeFaultPartList(list);
  if (base.length === 0) return '<p>No fault part recorded.</p>';
  const rows = [...base]
    .sort((a, b) => compareText(a.date, b.date) || compareText(a.ticketId, b.ticketId) || compareText(a.part.toLowerCase(), b.part.toLowerCase()) || compareText(a.id, b.id))
    .map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.ticketId)}</td><td>${escapeHtml(item.part)}</td><td>${item.quantity}</td><td>${escapeHtml(item.note)}</td></tr>`)
    .join('');
  return `<table><thead><tr><th>Date</th><th>Ticket</th><th>Part</th><th>Quantity</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of entries. */
export function faultPartCsv(list) {
  const base = normalizeFaultPartList(list);
  const header = 'id,ticket_id,part,quantity,date,note';
  const rows = base.map((item) => [item.id, item.ticketId, item.part, item.quantity, item.date, item.note].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function faultPartFilename() {
  return 'fault-parts-used.csv';
}
