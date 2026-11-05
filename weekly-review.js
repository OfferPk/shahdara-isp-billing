// Plan 293 (Plan 203-350) — Owner weekly review note.
//
// The week's collections, faults, and decisions are reviewed in
// the owner's head, so the same issues return the next week with
// no record of what was decided. This module adds only the
// missing piece: one short note per week — the week, a
// collections note, a faults note, the decisions taken, and the
// actions for next week — listed newest first, with the actions
// for next week visible, so a 100-customer business is steered
// week by week instead of waiting for a month-end review to
// notice a drift.
//
// What this module is NOT, stated plainly:
//   - It is not a bill, payment, customer, or staff-record
//     change. Writing a note never changes any bill, payment,
//     customer, or staff record by itself; it only records
//     what the owner reviewed and decided that week.
//   - It is not the monthly business review. That composes
//     the whole month; this note only covers one week and
//     never reads or rewrites that record.
//   - It is not a live record. A past weekly note is
//     read-only: there is no edit function, only record, find,
//     and remove, so a wrong note is removed and recorded again.
//   - One note per week: a second note for a week already
//     recorded is refused, so the week's decisions can never
//     be quietly replaced by a second version.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     note, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A note with no id, no strict week date, or nothing
//     written in any of its four note fields is refused
//     outright. Unknown fields are dropped, so a note can
//     never grow a bill, payment, customer, or staff field.
//   - A duplicate id, and a duplicate week, are never
//     rewritten: the first note stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validWeeklyReviewDate(value) {
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

/**
 * One owner weekly review note, or null when half-formed. A note
 * needs an id, a strict week date, and something written in at
 * least one of its four note fields (collections, faults,
 * decisions, actions for next week). Unknown fields are dropped;
 * the input is never mutated.
 */
export function normalizeWeeklyReview(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const week = text(raw.week);
  const collectionsNote = text(raw.collectionsNote);
  const faultsNote = text(raw.faultsNote);
  const decisions = text(raw.decisions);
  const actions = text(raw.actions);
  if (!id) return null;
  if (!validWeeklyReviewDate(week)) return null;
  if (!collectionsNote && !faultsNote && !decisions && !actions) return null;
  return {
    id,
    week,
    collectionsNote,
    faultsNote,
    decisions,
    actions,
  };
}

/** Normalised notes only; a duplicate id is never rewritten, the first stays. */
export function normalizeWeeklyReviewList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeWeeklyReview(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function findWeeklyReview(list, id) {
  const clean = normalizeWeeklyReviewList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record a note. Refused when half-formed, when its id is already
 * recorded, and when its week is already recorded — one note per
 * week, so the first note for a week always stays.
 */
export function recordWeeklyReview(list, raw) {
  const clean = normalizeWeeklyReviewList(list);
  const note = normalizeWeeklyReview(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  if (clean.some((item) => item.week === note.week)) return clean;
  return [...clean, note];
}

export function removeWeeklyReview(list, id) {
  const clean = normalizeWeeklyReviewList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

/** Notes newest first, then id, so the same list always reads the same way. */
export function weeklyReviewSorted(list) {
  const clean = normalizeWeeklyReviewList(list);
  return [...clean].sort((a, b) => {
    if (a.week !== b.week) return a.week < b.week ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** The newest weekly review note, or null when none is recorded. */
export function weeklyReviewLatest(list) {
  const sorted = weeklyReviewSorted(list);
  return sorted.length ? sorted[0] : null;
}

/** The actions for next week from the newest note, or '' when none are written. */
export function weeklyReviewNextWeekActions(list) {
  const latest = weeklyReviewLatest(list);
  return latest ? latest.actions : '';
}

export function weeklyReviewSummaryText(list) {
  const clean = normalizeWeeklyReviewList(list);
  if (clean.length === 0) return 'No weekly review notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  const latest = weeklyReviewLatest(clean);
  return `${clean.length} weekly review ${word} recorded. Latest review for week of ${latest.week}.`;
}

/** Plain-words text for one note: the week, then each note field that is written. */
export function weeklyReviewEntryText(note) {
  const clean = normalizeWeeklyReview(note);
  if (!clean) return 'No weekly review note recorded.';
  const parts = [`Week of ${clean.week}`];
  if (clean.collectionsNote) parts.push(`Collections: ${clean.collectionsNote}`);
  if (clean.faultsNote) parts.push(`Faults: ${clean.faultsNote}`);
  if (clean.decisions) parts.push(`Decisions: ${clean.decisions}`);
  if (clean.actions) parts.push(`Actions for next week: ${clean.actions}`);
  return parts.join(' — ');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function weeklyReviewEntryHtml(note) {
  const clean = normalizeWeeklyReview(note);
  if (!clean) return '<p>No weekly review note recorded.</p>';
  return `<p>${escapeHtml(weeklyReviewEntryText(clean))}</p>`;
}

export function weeklyReviewActionsHtml(list) {
  const actions = weeklyReviewNextWeekActions(list);
  if (!actions) return '<p>No actions for next week written in the latest review.</p>';
  return `<p>Actions for next week: ${escapeHtml(actions)}</p>`;
}

export function weeklyReviewAllHtml(list) {
  const rows = weeklyReviewSorted(list);
  if (!rows.length) return '<p>No weekly review notes recorded.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(weeklyReviewEntryText(note))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function weeklyReviewCsv(list) {
  const rows = weeklyReviewSorted(list);
  const lines = ['"id","week","collections note","faults note","decisions","actions for next week"'];
  for (const note of rows) {
    lines.push([
      csvCell(note.id),
      csvCell(note.week),
      csvCell(note.collectionsNote),
      csvCell(note.faultsNote),
      csvCell(note.decisions),
      csvCell(note.actions),
    ].join(','));
  }
  return lines.join('\n');
}

export function weeklyReviewFilename() {
  return 'weekly-reviews.csv';
}
