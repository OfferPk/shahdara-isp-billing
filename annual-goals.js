/**
 * annual-goals.js — Plan 198: owner annual goals tracker.
 *
 * The year's intentions stay visible and reviewable, separate from
 * the day-to-day numbers. One record per goal: year, goal in plain
 * words, target exactly as the owner entered it, status
 * not-started/in-progress/done, a review note, and dated progress
 * notes. Past years stay as history — nothing here ever drops a
 * past year, and recording or completing a goal never changes any
 * bill, payment, customer, or route record.
 *
 * How the module keeps those fences:
 *   - It is pure and import-free: the caller supplies every
 *     record, and the module never reads storage, the clock,
 *     or the network, and never touches another record type.
 *   - Unknown fields are dropped, so no bill, payment,
 *     customer, route, or sending field can ever creep into a
 *     goal.
 *   - Duplicate ids are never rewritten.
 *   - There is no edit function at all: only record, remove,
 *     set-status, and add-note. A goal's year, goal text, and
 *     target never move once recorded.
 *   - Targets are kept exactly as entered, never parsed or
 *     totalled: no progress percentage and no score exist here.
 *   - Inputs are never mutated: every function returns new
 *     records.
 *   - dashboard-collection-target.js (the monthly collection
 *     target) and collection-forecaster.js are neither read nor
 *     written here — those are monthly operational targets,
 *     not the owner's annual intentions.
 */

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function normalizeDate(value) {
  const date = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  if (month < 1 || month > 12) return null;
  const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > maxDay) return null;
  return date;
}

// A year is a whole calendar year, 1900-2100, entered as a number
// or a four-digit string. Anything else is refused, never mapped
// onto a neighbouring year.
function normalizeYear(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 1900 && value <= 2100 ? value : null;
  }
  const raw = text(value);
  if (!/^\d{4}$/.test(raw)) return null;
  const year = Number(raw);
  return year >= 1900 && year <= 2100 ? year : null;
}

const STATUSES = ['not-started', 'in-progress', 'done'];

function normalizeStatus(value) {
  const status = text(value).toLowerCase();
  return STATUSES.includes(status) ? status : 'not-started';
}

function normalizeNote(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const date = normalizeDate(entry.date);
  const note = text(entry.note);
  if (!date || !note) return null;
  return { date, note };
}

function normalizeAnnualGoal(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const goal = text(entry.goal);
  const year = normalizeYear(entry.year);
  if (!id || !goal || year === null) return null;
  const notes = Array.isArray(entry.progressNotes)
    ? entry.progressNotes.map(normalizeNote).filter(Boolean)
    : [];
  return {
    id,
    year,
    goal,
    target: text(entry.target),
    status: normalizeStatus(entry.status),
    reviewNote: text(entry.reviewNote),
    progressNotes: notes,
  };
}

function normalizeAnnualGoalList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of list) {
    const goal = normalizeAnnualGoal(entry);
    if (!goal || seen.has(goal.id)) continue;
    seen.add(goal.id);
    out.push(goal);
  }
  return out;
}

function findAnnualGoal(list, id) {
  const goals = normalizeAnnualGoalList(list);
  return goals.find((goal) => goal.id === text(id)) || null;
}

function recordAnnualGoal(list, entry) {
  const goals = normalizeAnnualGoalList(list);
  const goal = normalizeAnnualGoal(entry);
  if (!goal) return goals;
  if (goals.some((item) => item.id === goal.id)) return goals;
  return [...goals, goal];
}

function removeAnnualGoal(list, id) {
  return normalizeAnnualGoalList(list).filter((goal) => goal.id !== text(id));
}

// Setting a status changes only the status marker. An unknown
// status leaves the list unchanged, never hidden behind a fallback.
function setAnnualGoalStatus(list, id, status) {
  const wanted = text(status).toLowerCase();
  if (!STATUSES.includes(wanted)) return normalizeAnnualGoalList(list);
  return normalizeAnnualGoalList(list).map((goal) =>
    goal.id === text(id) ? { ...goal, status: wanted } : goal,
  );
}

// A progress note is dated, always: a bad date or an empty note
// leaves the record unchanged.
function addAnnualGoalNote(list, id, date, note) {
  const dated = normalizeNote({ date, note });
  if (!dated) return normalizeAnnualGoalList(list);
  return normalizeAnnualGoalList(list).map((goal) =>
    goal.id === text(id)
      ? { ...goal, progressNotes: [...goal.progressNotes, dated] }
      : goal,
  );
}

// Listed by year, newest year first, then goal A-Z, then id A-Z,
// so past years stay readable as history below the current year.
function annualGoalsSorted(list) {
  return normalizeAnnualGoalList(list).sort((a, b) =>
    b.year - a.year
    || a.goal.toLowerCase().localeCompare(b.goal.toLowerCase())
    || a.id.localeCompare(b.id),
  );
}

function annualGoalsForYear(list, year) {
  const wanted = normalizeYear(year);
  if (wanted === null) return [];
  return annualGoalsSorted(list).filter((goal) => goal.year === wanted);
}

function annualGoalsByStatus(list, status) {
  const wanted = text(status).toLowerCase();
  if (!STATUSES.includes(wanted)) return [];
  return annualGoalsSorted(list).filter((goal) => goal.status === wanted);
}

function annualGoalSummaryText(list) {
  const goals = normalizeAnnualGoalList(list);
  if (!goals.length) return 'No annual goals recorded.';
  const years = new Set(goals.map((goal) => goal.year)).size;
  const done = goals.filter((goal) => goal.status === 'done').length;
  const inProgress = goals.filter((goal) => goal.status === 'in-progress').length;
  return `${goals.length} annual goal${goals.length === 1 ? '' : 's'} across ${years} year${years === 1 ? '' : 's'}: ${done} done, ${inProgress} in progress, ${goals.length - done - inProgress} not started.`;
}

function annualGoalText(goal) {
  const entry = normalizeAnnualGoal(goal);
  if (!entry) return '';
  const lines = [
    `${entry.year} — ${entry.goal}`,
    `Target: ${entry.target || 'No target entered.'}`,
    `Status: ${entry.status}`,
  ];
  if (entry.reviewNote) lines.push(`Review note: ${entry.reviewNote}`);
  for (const note of entry.progressNotes) {
    lines.push(`${note.date}: ${note.note}`);
  }
  return lines.join('\n');
}

function annualGoalHtml(goal) {
  const entry = normalizeAnnualGoal(goal);
  if (!entry) return '';
  const notes = entry.progressNotes
    .map((note) => `<li>${escapeHtml(note.date)}: ${escapeHtml(note.note)}</li>`)
    .join('');
  return `<article><h4>${escapeHtml(entry.year)} — ${escapeHtml(entry.goal)}</h4>`
    + `<p>Target: ${escapeHtml(entry.target || 'No target entered.')} | Status: ${escapeHtml(entry.status)}</p>`
    + (entry.reviewNote ? `<p>Review note: ${escapeHtml(entry.reviewNote)}</p>` : '')
    + (notes ? `<ul>${notes}</ul>` : '')
    + `<p><small>Id: ${escapeHtml(entry.id)}</small></p></article>`;
}

function annualGoalsAllHtml(list) {
  return annualGoalsSorted(list).map(annualGoalHtml).join('');
}

function annualGoalsCsv(list) {
  const rows = [['id', 'year', 'goal', 'target', 'status', 'reviewNote', 'progressNotes']];
  for (const goal of annualGoalsSorted(list)) {
    rows.push([
      goal.id,
      String(goal.year),
      goal.goal,
      goal.target,
      goal.status,
      goal.reviewNote,
      goal.progressNotes.map((note) => `${note.date}: ${note.note}`).join(' | '),
    ]);
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function annualGoalsFilename() {
  return 'annual-goals.csv';
}

export {
  normalizeDate,
  normalizeYear,
  normalizeStatus,
  normalizeAnnualGoal,
  normalizeAnnualGoalList,
  findAnnualGoal,
  recordAnnualGoal,
  removeAnnualGoal,
  setAnnualGoalStatus,
  addAnnualGoalNote,
  annualGoalsSorted,
  annualGoalsForYear,
  annualGoalsByStatus,
  annualGoalSummaryText,
  annualGoalText,
  annualGoalHtml,
  annualGoalsAllHtml,
  annualGoalsCsv,
  annualGoalsFilename,
};
