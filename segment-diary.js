// Plan 142 (Plan 101-202) — Segment health diary.
//
// A segment's condition is only known from memory, so gradual
// decline across a mohalla is missed. This module is that diary:
// one diary entry per segment per period, with a segment name, a
// date, a condition (good/watch/poor), and an observed symptom.
// A segment page then shows its diary newest first with the latest
// condition prominent, so a segment moving from good to watch to
// poor gets attention while a planned fix is still cheap.
//
// What this module is NOT, stated plainly:
//   - It is not a fault ticket and not a second copy of one.
//     Plan 133's segment fault history (fault incidents per
//     segment) is neither read nor written here: a diary entry
//     records a condition observation, not a fault, and recording
//     it never opens, closes, rewrites, or otherwise changes any
//     customer fault ticket, any fault record, any bill, or any
//     payment.
//   - It is not a repair order. A "poor" entry does not schedule
//     a fix, order a part, or change any service state; it only
//     makes the decline visible.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     entry, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed entries are refused outright, never stored
//     half-formed: an entry needs an id, a segment name, and a
//     real calendar date. An entry with no segment or no date
//     is refused, and so is one with an impossible date.
//     Unknown fields are dropped, so an entry can never grow a
//     ticket, bill, or payment field.
//   - One entry per segment per period: the period is the
//     entry's date, so a segment cannot gain a second entry
//     (under a different id) for the same date. A duplicate id
//     is never rewritten: an identical re-save leaves the list
//     unchanged, and a re-save with different figures is refused
//     outright. There is no edit function; the only later
//     change is removal.
//   - Condition is one of good, watch, or poor; anything else
//     is recorded as watch, never stored as a fourth state.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - A segment's diary lists newest first, and its latest
//     condition is simply the newest entry's condition. A
//     segment with no diary entry is not hidden, it is
//     reported as having none.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validSegmentDiaryDate(value) {
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

const CONDITIONS = ['good', 'watch', 'poor'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanCondition(value) {
  const condition = cleanText(value);
  return CONDITIONS.includes(condition) ? condition : 'watch';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one diary entry, or null when half-formed. */
export function normalizeSegmentDiaryEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const segment = cleanText(raw.segment);
  const date = validSegmentDiaryDate(raw.date);
  if (!id || !segment || !date) return null;
  return {
    id,
    segment,
    date,
    condition: cleanCondition(raw.condition),
    symptom: cleanText(raw.symptom),
  };
}

/** Normalize a list: drop half-formed entries and duplicate ids (first wins). */
export function normalizeSegmentDiaryList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeSegmentDiaryEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

/** Find one entry by id, or null. */
export function findSegmentDiaryEntry(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeSegmentDiaryList(list).find((item) => item.id === clean) || null;
}

/**
 * Save one entry. Returns a new list, or the input unchanged when
 * the entry is half-formed, repeats an id with different figures,
 * or would give a segment a second entry for the same date.
 */
export function upsertSegmentDiaryEntry(list, raw) {
  const clean = normalizeSegmentDiaryList(list);
  const entry = normalizeSegmentDiaryEntry(raw);
  if (!entry) return clean;
  const existing = clean.find((item) => item.id === entry.id);
  if (existing) return clean;
  const sameSegmentDay = clean.some(
    (item) => item.segment.toLowerCase() === entry.segment.toLowerCase()
      && item.date === entry.date,
  );
  if (sameSegmentDay) return clean;
  return [...clean, entry];
}

/** Remove one entry by id. Returns a new list. */
export function removeSegmentDiaryEntry(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeSegmentDiaryList(list);
  return normalizeSegmentDiaryList(list).filter((item) => item.id !== clean);
}

function matchesSegment(item, segment) {
  const key = cleanText(segment).toLowerCase();
  if (!key) return false;
  return item.segment.toLowerCase() === key;
}

/** A segment's diary, newest first (then id A-Z for a stable order). */
export function diaryForSegment(list, segment) {
  const clean = normalizeSegmentDiaryList(list);
  return clean
    .filter((item) => matchesSegment(item, segment))
    .sort((a, b) => compareText(b.date, a.date) || compareText(a.id, b.id));
}

/** Latest condition for a segment, or null when it has no diary entry. */
export function latestSegmentCondition(list, segment) {
  const rows = diaryForSegment(list, segment);
  return rows.length === 0 ? null : rows[0].condition;
}

/** Every segment with its latest condition, segment name A-Z. */
export function segmentLatestConditions(list) {
  const clean = normalizeSegmentDiaryList(list);
  const byKey = new Map();
  for (const item of clean) {
    const key = item.segment.toLowerCase();
    if (!byKey.has(key) || item.date > byKey.get(key).date) {
      byKey.set(key, { segment: item.segment, date: item.date, condition: item.condition });
    }
  }
  return [...byKey.values()].sort((a, b) => compareText(a.segment.toLowerCase(), b.segment.toLowerCase()));
}

/** One-line summary of the whole diary. */
export function segmentDiarySummaryText(list) {
  const clean = normalizeSegmentDiaryList(list);
  if (clean.length === 0) return 'No segment diary entry recorded yet.';
  const segments = segmentLatestConditions(clean);
  const poor = segments.filter((row) => row.condition === 'poor').length;
  const watch = segments.filter((row) => row.condition === 'watch').length;
  return `${clean.length} diary entr${clean.length === 1 ? 'y' : 'ies'} across ${segments.length} segment${segments.length === 1 ? '' : 's'}; ${poor} poor, ${watch} watch.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function diaryRowHtml(item) {
  return `<tr><td>${esc(item.date)}</td><td>${esc(item.condition)}</td>`
    + `<td>${esc(item.symptom)}</td></tr>`;
}

/**
 * A segment page: its diary newest first with the latest condition
 * prominent. A segment with no entry says so plainly.
 */
export function segmentDiaryHtml(list, segment) {
  const rows = diaryForSegment(list, segment);
  if (rows.length === 0) return '<p>No diary entry recorded for this segment.</p>';
  const heading = `<p><strong>Latest condition: ${esc(rows[0].condition)}</strong> `
    + `(as of ${esc(rows[0].date)}). ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} recorded.</p>`;
  const body = rows.map(diaryRowHtml).join('');
  return `${heading}<table><thead><tr><th>Date</th><th>Condition</th>`
    + '<th>Observed symptom</th></tr></thead><tbody>' + body + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of diary entries. */
export function segmentDiaryCsv(list) {
  const rows = normalizeSegmentDiaryList(list);
  const lines = ['id,segment,date,condition,symptom'];
  for (const item of rows) {
    lines.push([item.id, item.segment, item.date, item.condition, item.symptom].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the diary. */
export function segmentDiaryFilename() {
  return 'segment-diary.csv';
}
