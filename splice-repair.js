// Plan 145 (Plan 101-202) — Splice/joint repair record.
//
// Splice and joint repairs are buried inside general fault notes, so a
// weak joint that keeps failing cannot be tracked. This module is that
// record: one record per repair, with a segment, a joint location note,
// a date, a repair type, and a linked ticket. A joint location then
// lists its repairs newest first with a repeat count, so repeat joint
// failures point to a proper rework instead of another quick patch.
//
// What this module is NOT, stated plainly:
//   - It is not a fault ticket and not a second copy of one. A record
//     names a ticket by id only; recording it never opens, closes,
//     rewrites, or otherwise changes any fault ticket, any fault
//     record, any bill, or any payment.
//   - It is not the SISP-78 splice-closure map. That module records
//     which core of a joint closure goes where (an asset map); this
//     module records that a repair happened at a joint on a date.
//     The closure map is neither read nor written here, and a repair
//     record never changes a core assignment.
//   - It is not a repair order. Recording a repair does not schedule
//     a fix, order a part, or change any service state; it only
//     makes the joint's repair history visible.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every record,
//     and the module never reads storage, the clock, or the network,
//     never imports another module, and never mutates an input.
//     Every function returns a new list or new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a segment, a joint
//     location note, and a real calendar date. A record with no
//     segment or no date is refused, and so is one with an
//     impossible date or no joint location. Unknown fields are
//     dropped, so a record can never grow a ticket-status, bill,
//     or payment field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function; the
//     only later change is removal.
//   - Repair type is one of re-splice, re-terminate,
//     closure-replaced, or other; anything else is recorded as
//     other, never stored as a fifth type.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - A joint location's repairs list newest first, and its repeat
//     count is simply how many repairs that joint location has. A
//     joint location with no repair is not hidden, it is reported
//     as having none.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validSpliceRepairDate(value) {
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

const REPAIR_TYPES = ['re-splice', 're-terminate', 'closure-replaced', 'other'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanRepairType(value) {
  const type = cleanText(value);
  return REPAIR_TYPES.includes(type) ? type : 'other';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one splice/joint repair record, or null when half-formed. */
export function normalizeSpliceRepairRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const segment = cleanText(raw.segment);
  const joint = cleanText(raw.joint);
  const date = validSpliceRepairDate(raw.date);
  if (!id || !segment || !joint || !date) return null;
  return {
    id,
    segment,
    joint,
    date,
    repairType: cleanRepairType(raw.repairType),
    ticket: cleanText(raw.ticket),
  };
}

/** Normalize a list: drop half-formed records and duplicate ids (first wins). */
export function normalizeSpliceRepairList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeSpliceRepairRecord(raw);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

/** Find one record by id, or null. */
export function findSpliceRepairRecord(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeSpliceRepairList(list).find((item) => item.id === clean) || null;
}

/**
 * Save one record. Returns a new list, or the input unchanged when
 * the record is half-formed or repeats an id.
 */
export function upsertSpliceRepairRecord(list, raw) {
  const clean = normalizeSpliceRepairList(list);
  const record = normalizeSpliceRepairRecord(raw);
  if (!record) return clean;
  const existing = clean.find((item) => item.id === record.id);
  if (existing) return clean;
  return [...clean, record];
}

/** Remove one record by id. Returns a new list. */
export function removeSpliceRepairRecord(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeSpliceRepairList(list);
  return normalizeSpliceRepairList(list).filter((item) => item.id !== clean);
}

function matchesPair(item, segment, joint) {
  const segmentKey = cleanText(segment).toLowerCase();
  const jointKey = cleanText(joint).toLowerCase();
  if (!segmentKey || !jointKey) return false;
  return item.segment.toLowerCase() === segmentKey
    && item.joint.toLowerCase() === jointKey;
}

/** A joint location's repairs, newest first (then id A-Z for a stable order). */
export function repairsForJoint(list, segment, joint) {
  const clean = normalizeSpliceRepairList(list);
  return clean
    .filter((item) => matchesPair(item, segment, joint))
    .sort((a, b) => compareText(b.date, a.date) || compareText(a.id, b.id));
}

/** How many times a joint location has been repaired (0 when never). */
export function jointRepeatCount(list, segment, joint) {
  return repairsForJoint(list, segment, joint).length;
}

/** Every joint location in a segment with its repair count and latest date, joint A-Z. */
export function jointsForSegment(list, segment) {
  const clean = normalizeSpliceRepairList(list);
  const key = cleanText(segment).toLowerCase();
  if (!key) return [];
  const byJoint = new Map();
  for (const item of clean) {
    if (item.segment.toLowerCase() !== key) continue;
    const jointKey = item.joint.toLowerCase();
    const row = byJoint.get(jointKey);
    if (!row) {
      byJoint.set(jointKey, { joint: item.joint, count: 1, latestDate: item.date });
    } else {
      row.count += 1;
      if (item.date > row.latestDate) row.latestDate = item.date;
    }
  }
  return [...byJoint.values()].sort((a, b) => compareText(a.joint.toLowerCase(), b.joint.toLowerCase()));
}

/** One-line summary of all splice/joint repairs. */
export function spliceRepairSummaryText(list) {
  const clean = normalizeSpliceRepairList(list);
  if (clean.length === 0) return 'No splice/joint repair recorded yet.';
  const segments = new Set(clean.map((item) => item.segment.toLowerCase())).size;
  const joints = new Set(clean.map((item) => `${item.segment.toLowerCase()}|${item.joint.toLowerCase()}`)).size;
  return `${clean.length} repair${clean.length === 1 ? '' : 's'} across ${joints} joint location${joints === 1 ? '' : 's'} in ${segments} segment${segments === 1 ? '' : 's'}.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function repairRowHtml(item) {
  return `<tr><td>${esc(item.date)}</td><td>${esc(item.repairType)}</td>`
    + `<td>${esc(item.ticket)}</td><td>${esc(item.id)}</td></tr>`;
}

/**
 * A joint location page: its repairs newest first with the repeat
 * count prominent. A joint location with no repair says so plainly.
 */
export function spliceRepairHtml(list, segment, joint) {
  const rows = repairsForJoint(list, segment, joint);
  if (rows.length === 0) return '<p>No splice/joint repair recorded for this joint location.</p>';
  const heading = `<p><strong>Repeat count: ${rows.length}</strong> `
    + `repair${rows.length === 1 ? '' : 's'} at ${esc(rows[0].joint)} `
    + `(${esc(rows[0].segment)}), latest on ${esc(rows[0].date)}.</p>`;
  const body = rows.map(repairRowHtml).join('');
  return `${heading}<table><thead><tr><th>Date</th><th>Repair type</th>`
    + '<th>Linked ticket</th><th>Record id</th></tr></thead><tbody>' + body + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of splice/joint repair records. */
export function spliceRepairCsv(list) {
  const rows = normalizeSpliceRepairList(list);
  const lines = ['id,segment,joint,date,repairType,ticket'];
  for (const item of rows) {
    lines.push([item.id, item.segment, item.joint, item.date, item.repairType, item.ticket].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for splice/joint repairs. */
export function spliceRepairFilename() {
  return 'splice-joint-repairs.csv';
}
