// Plan 287 (Plan 203-350) — Second-OLT readiness scorecard record.
//
// Readiness for a second OLT is discussed from memory, so nobody can
// later show what was ready and what was still missing on a given
// date. This module adds only the missing piece: one dated scorecard
// record per check — the date, the checklist items with done or
// not-done against each, and who recorded it. A scorecard shows its
// plain checked-item count only; it computes no percentage and no
// score, and it never auto-triggers anything.
//
// What this module is NOT, stated plainly:
//   - It is not the capacity forecast. That forecast looks ahead at
//     how full the first unit is getting; this module only records
//     what was ready on one date, and the forecast is neither read
//     nor rewritten here.
//   - It is not the migration checklist. That checklist is the
//     step-by-step move itself; this module only records readiness
//     before any move, and the migration record is neither read nor
//     rewritten here.
//   - It is not the milestone tracker. That tracker follows growth
//     milestones toward the second unit; this module only records a
//     dated readiness check, and the milestone record is neither
//     read nor rewritten here.
//   - It is not a live checklist. A past scorecard is read-only:
//     there is no edit function, only record, find, and remove, so
//     a wrong scorecard is removed and recorded again.
//   - It never changes any bill, payment, customer, port, or unit
//     record by itself. Creating a scorecard writes one record and
//     nothing else; this module holds no bill, payment, customer,
//     port, or unit field, so there is nothing here that could
//     rewrite one.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     scorecard, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A scorecard with no id, no strict date, no recorder, or no
//     checklist item is refused outright. Unknown fields are
//     dropped, so a scorecard can never grow a bill, payment,
//     customer, port, or unit field.
//   - A duplicate id is never rewritten.
//   - The checked count is a plain count of done items — never a
//     percentage, never a score.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validReadinessScorecardDate(value) {
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

function splitLines(value) {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split('\n').map((line) => text(line)).filter(Boolean);
  }
  return [];
}

/** Done folds from yes/true/done/checked spellings; anything else reads as not done. */
export function foldReadinessDone(value) {
  if (value === true) return true;
  if (typeof value === 'string') {
    const word = value.trim().toLowerCase();
    return word === 'true' || word === 'yes' || word === 'done' || word === 'checked' || word === 'x';
  }
  return false;
}

/**
 * One checklist item, or null when it has no label. A plain string
 * reads as a not-done item; an object takes its label and folds its
 * done flag. Unknown fields are dropped and the input is never
 * mutated.
 */
export function normalizeReadinessItem(raw) {
  if (typeof raw === 'string') {
    const label = text(raw);
    return label ? { label, done: false } : null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const label = text(raw.label);
  if (!label) return null;
  return { label, done: foldReadinessDone(raw.done) };
}

/** Normalised checklist items only; entries with no label are dropped. */
export function normalizeReadinessItems(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const raw of value) {
    const item = normalizeReadinessItem(raw);
    if (item) out.push(item);
  }
  return out;
}

/**
 * One scorecard record, or null when half-formed. A scorecard needs
 * an id, a strict date, a recorder, and at least one checklist item.
 */
export function normalizeReadinessScorecard(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const recordedBy = text(raw.recordedBy);
  if (!id || !recordedBy) return null;
  if (!validReadinessScorecardDate(date)) return null;
  const items = normalizeReadinessItems(raw.items);
  if (!items.length) return null;
  return { id, date, recordedBy, items };
}

/** Normalised scorecards only; a duplicate id is never rewritten, the first stays. */
export function normalizeReadinessScorecardList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeReadinessScorecard(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findReadinessScorecard(list, id) {
  const clean = normalizeReadinessScorecardList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordReadinessScorecard(list, raw) {
  const clean = normalizeReadinessScorecardList(list);
  const entry = normalizeReadinessScorecard(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeReadinessScorecard(list, id) {
  const clean = normalizeReadinessScorecardList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

/** Scorecards in date order, then by id, so the same list always reads the same way. */
export function readinessScorecardSorted(list) {
  const clean = normalizeReadinessScorecardList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Plain count of checked items in one scorecard — a count only, never a percentage or a score. */
export function checkedItemCount(entry) {
  const clean = normalizeReadinessScorecard(entry);
  if (!clean) return 0;
  return clean.items.filter((item) => item.done).length;
}

/** Total checklist items in one scorecard, or 0 for a half-formed entry. */
export function totalItemCount(entry) {
  const clean = normalizeReadinessScorecard(entry);
  return clean ? clean.items.length : 0;
}

export function readinessScorecardSummaryText(list) {
  const clean = normalizeReadinessScorecardList(list);
  if (clean.length === 0) return 'No readiness scorecards recorded.';
  const word = clean.length === 1 ? 'scorecard' : 'scorecards';
  const latest = readinessScorecardSorted(clean).at(-1);
  const checked = checkedItemCount(latest);
  const total = totalItemCount(latest);
  return `${clean.length} readiness ${word} recorded. Latest ${latest.date}: ${checked} of ${total} items checked.`;
}

/** Plain-words text for one scorecard: date, recorder, and the plain checked-item count. */
export function readinessScorecardText(entry) {
  const clean = normalizeReadinessScorecard(entry);
  if (!clean) return 'No readiness scorecard recorded.';
  const checked = checkedItemCount(clean);
  const lines = clean.items.map((item) => `${item.done ? '[x]' : '[ ]'} ${item.label}`).join('; ');
  return `${clean.date} — recorded by ${clean.recordedBy} — ${checked} of ${clean.items.length} items checked: ${lines}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function readinessScorecardHtml(entry) {
  const clean = normalizeReadinessScorecard(entry);
  if (!clean) return '<p>No readiness scorecard recorded.</p>';
  const checked = checkedItemCount(clean);
  const items = clean.items.map((item) => `<li>${item.done ? '[x]' : '[ ]'} ${escapeHtml(item.label)}</li>`).join('');
  return `<p>${escapeHtml(clean.date)} — recorded by ${escapeHtml(clean.recordedBy)} — ${checked} of ${clean.items.length} items checked.</p><ul>${items}</ul>`;
}

export function readinessScorecardAllHtml(list) {
  const rows = readinessScorecardSorted(list);
  if (!rows.length) return '<p>No readiness scorecards recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(readinessScorecardText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function readinessScorecardCsv(list) {
  const rows = readinessScorecardSorted(list);
  const lines = ['"id","date","recorded by","items checked","items total","items"'];
  for (const entry of rows) {
    const items = entry.items.map((item) => `${item.done ? '[x]' : '[ ]'} ${item.label}`).join('; ');
    lines.push([
      csvCell(entry.id),
      csvCell(entry.date),
      csvCell(entry.recordedBy),
      csvCell(checkedItemCount(entry)),
      csvCell(entry.items.length),
      csvCell(items),
    ].join(','));
  }
  return lines.join('\n');
}

export function readinessScorecardFilename() {
  return 'readiness-scorecards.csv';
}
