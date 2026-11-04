// Plan 133 (Plan 101-202) — Cable/splitter segment fault history.
//
// The same cable run or splitter keeps failing, but faults are only
// logged per customer, so the weak segment stays hidden. This module
// is that history: one entry per segment fault incident, with a
// segment name, a splitter/cable identifier, an affected-customers
// count, and a fault date. A segment page then lists its faults
// newest first with a repeat count, and a segment with no faults
// says so plainly.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of any customer fault ticket. No
//     ticket record is read or written here: an incident names a
//     segment, not a ticket, and recording it never rewrites,
//     closes, reopens, or otherwise changes any customer fault
//     ticket. Plan 24's repeat-fault flag (per customer, derived
//     from the ticket log) and SISP-24's splitter port map (ports
//     derived from customer records) are both left exactly as they
//     are; this history adds the missing segment-level view only.
//   - It is not a stock movement and not a charge. Recording a
//     segment fault moves no stock count and creates no bill, no
//     payment, and no cost figure of any kind.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the
//     network, never imports another module, and never mutates an
//     input. Every function returns a new list or new rows.
//   - Half-formed entries are refused outright, never stored
//     half-formed: an entry needs an id, a segment name, a
//     splitter/cable identifier, a whole affected-customers count
//     of zero or more, and a real calendar date. An entry with no
//     segment, no identifier, or no count is refused, and so is
//     one with a negative or fractional count. Unknown fields are
//     dropped, so an entry can never grow a ticket, count, bill,
//     or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function; the
//     only later change is removal.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - A segment's faults list newest first, and its repeat count
//     is simply how many incidents that segment has: a segment
//     with no faults is not hidden, it is reported as having none.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validSegmentFaultDate(value) {
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

/** Normalise one entry, or null when it is half-formed. */
export function normalizeSegmentFault(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const segment = cleanText(record.segment);
  const segmentId = cleanText(record.segmentId);
  const date = validSegmentFaultDate(record.date);
  const affectedCustomers = record.affectedCustomers;
  if (!id || !segment || !segmentId || !date) return null;
  if (typeof affectedCustomers !== 'number' || !Number.isInteger(affectedCustomers) || affectedCustomers < 0) return null;
  return {
    id,
    segment,
    segmentId,
    affectedCustomers,
    date,
    note: cleanText(record.note),
  };
}

/** Normalise a list, dropping half-formed entries. */
export function normalizeSegmentFaultList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const item = normalizeSegmentFault(record);
    if (item && !out.some((row) => row.id === item.id)) out.push(item);
  }
  return out;
}

/** Find one entry by id, or null. */
export function findSegmentFault(list, id) {
  const base = normalizeSegmentFaultList(list);
  return base.find((item) => item.id === cleanText(id)) ?? null;
}

/**
 * Save one entry. An identical re-save leaves the list unchanged;
 * a re-save of the same id with different figures is refused.
 * A half-formed entry is refused. Returns a new list.
 */
export function upsertSegmentFault(list, record) {
  const base = normalizeSegmentFaultList(list);
  const item = normalizeSegmentFault(record);
  if (!item) return base;
  const at = base.findIndex((row) => row.id === item.id);
  if (at === -1) return [...base, item];
  const existing = base[at];
  const same = existing.segment === item.segment
    && existing.segmentId === item.segmentId
    && existing.affectedCustomers === item.affectedCustomers
    && existing.date === item.date
    && existing.note === item.note;
  if (same) return base;
  return base;
}

/** Remove one entry by id. Returns a new list. */
export function removeSegmentFault(list, id) {
  const base = normalizeSegmentFaultList(list);
  const key = cleanText(id);
  return base.filter((item) => item.id !== key);
}

function matchesSegment(item, segmentId) {
  const key = cleanText(segmentId).toLowerCase();
  if (!key) return false;
  return item.segmentId.toLowerCase() === key || item.segment.toLowerCase() === key;
}

/** A segment's faults, newest first (then id A-Z for a stable order). */
export function faultsForSegment(list, segmentId) {
  const base = normalizeSegmentFaultList(list);
  return base
    .filter((item) => matchesSegment(item, segmentId))
    .sort((a, b) => compareText(b.date, a.date) || compareText(a.id, b.id));
}

/** Repeat count: how many incidents one segment has. */
export function segmentFaultCount(list, segmentId) {
  return faultsForSegment(list, segmentId).length;
}

/** Per-segment counts, most faults first, then segment name A-Z. */
export function segmentFaultCounts(list) {
  const base = normalizeSegmentFaultList(list);
  const byKey = new Map();
  for (const item of base) {
    const key = item.segmentId.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, { segment: item.segment, segmentId: item.segmentId, count: 0 });
    byKey.get(key).count += 1;
  }
  return [...byKey.values()].sort((a, b) => (b.count - a.count) || compareText(a.segment.toLowerCase(), b.segment.toLowerCase()));
}

/** One-line summary of the whole history. */
export function segmentFaultSummaryText(list) {
  const base = normalizeSegmentFaultList(list);
  if (base.length === 0) return 'No segment fault recorded yet.';
  const segments = segmentFaultCounts(base);
  const worst = segments[0];
  return `${base.length} segment fault${base.length === 1 ? '' : 's'} across ${segments.length} segment${segments.length === 1 ? '' : 's'}; most repeated: ${worst.segment} (${worst.count}).`;
}

/** A segment page: its faults newest first with its repeat count. */
export function segmentFaultHtml(list, segmentId) {
  const rows = faultsForSegment(list, segmentId);
  if (rows.length === 0) return '<p>No fault recorded for this segment.</p>';
  const heading = `<p>${rows.length} fault${rows.length === 1 ? '' : 's'} recorded for this segment (repeat count: ${rows.length}).</p>`;
  const body = rows
    .map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.segment)}</td><td>${escapeHtml(item.segmentId)}</td><td>${item.affectedCustomers}</td><td>${escapeHtml(item.note)}</td></tr>`)
    .join('');
  return `${heading}<table><thead><tr><th>Date</th><th>Segment</th><th>Splitter / cable</th><th>Customers affected</th><th>Note</th></tr></thead><tbody>${body}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of entries. */
export function segmentFaultCsv(list) {
  const base = normalizeSegmentFaultList(list);
  const header = 'id,segment,segment_id,affected_customers,date,note';
  const rows = base.map((item) => [item.id, item.segment, item.segmentId, item.affectedCustomers, item.date, item.note].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

/** CSV filename for the history. */
export function segmentFaultFilename() {
  return 'segment-fault-history.csv';
}
