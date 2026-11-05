// Plan 322 (Plan 203-350) — App feedback inbox (operator-recorded).
//
// Complaints about the app itself — a confusing screen, a
// slow list — are mentioned in passing and lost, so the
// same app problem annoys every operator again the next
// week. This module adds only the missing piece: one
// inbox entry per app issue — the screen, the problem in
// plain words, the date, who reported it, and a status of
// noted, fixed, or declined — so open feedback lists by
// screen and small frustrations that slow field work get
// collected in one place instead of being re-explained.
//
// What this module is NOT, stated plainly:
//   - It is not the customer suggestion log (Plan 96),
//     which records what customers ask for. That log
//     already exists and is neither read nor rewritten
//     here; this inbox is about the app itself, as seen
//     by its operators, never about customer wishes.
//   - It is not customer feedback after a visit
//     (Plan 162), which records how a customer felt
//     after field work. That record already exists and
//     is neither read nor rewritten here; this inbox
//     never rates a visit or a customer.
//   - It is not the archive retrieval log (Plan 321),
//     which logs archives taken out and returned. That
//     log already exists and is neither read nor
//     rewritten here; a feedback entry retrieves
//     nothing and returns nothing.
//   - It is not the accessibility note per screen
//     (Plan 323), which is a different plan about
//     screens that are hard to use. That plan is not
//     implemented here; a feedback entry never claims
//     a screen is accessible or not.
//   - It is not a bill, payment, customer, or app
//     change. Recording feedback, or marking an item
//     fixed or declined, never changes any customer,
//     bill, payment, or app behaviour by itself: the
//     inbox only notes the issue and its outcome.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every entry, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - An entry with no id, no screen, no problem in
//     plain words, no strict date, or no reporter is
//     refused outright. Unknown fields are dropped, so
//     an entry can never grow a bill, payment, or
//     customer field.
//   - Marking an item fixed or declined requires a
//     dated note: the note in plain words and a strict
//     resolution date on or after the reported date.
//     A close with no note, no date, a date before the
//     reported date, or a status other than fixed or
//     declined leaves the entry exactly as it was.
//   - Only a noted item can be closed, and a closed
//     item is never closed a second time. Closing
//     changes only the status and the resolution note
//     and date of that one entry.
//   - A duplicate id is never rewritten: the first
//     entry stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const APP_FEEDBACK_STATUSES = Object.freeze(['noted', 'fixed', 'declined']);

export const APP_FEEDBACK_STATUS_LABELS = Object.freeze({
  noted: 'noted',
  fixed: 'fixed',
  declined: 'declined',
});

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validAppFeedbackDay(value) {
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

/** Day number for a strict date, by integer arithmetic only. */
function dayNumber(value) {
  const parts = value.split('-').map(Number);
  let year = parts[0];
  const month = parts[1];
  const day = parts[2];
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const monthShifted = month > 2 ? month - 3 : month + 9;
  const dayOfYear = Math.floor((153 * monthShifted + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function foldStatus(value) {
  const clean = text(value).toLowerCase();
  return APP_FEEDBACK_STATUSES.includes(clean) ? clean : 'noted';
}

export function appFeedbackStatusLabel(status) {
  return APP_FEEDBACK_STATUS_LABELS[foldStatus(status)] ?? 'noted';
}

/**
 * One app feedback entry, or null when half-formed.
 * An entry needs an id, a screen, a problem in plain
 * words, a strict date, and a reporter. A noted entry
 * carries no resolution note or date; a fixed or
 * declined entry carries both, with the resolution date
 * on or after the reported date. Unknown fields are
 * dropped; the input is never mutated.
 */
export function normalizeAppFeedback(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const screen = text(raw.screen);
  const problem = text(raw.problem);
  const date = text(raw.date);
  const reporter = text(raw.reporter);
  if (!id) return null;
  if (!screen) return null;
  if (!problem) return null;
  if (!validAppFeedbackDay(date)) return null;
  if (!reporter) return null;
  const status = foldStatus(raw.status);
  const resolutionNote = text(raw.resolutionNote);
  const resolutionDate = text(raw.resolutionDate);
  if (status === 'noted') return { id, screen, problem, date, reporter, status, resolutionNote: '', resolutionDate: '' };
  if (!resolutionNote) return null;
  if (!validAppFeedbackDay(resolutionDate)) return null;
  if (dayNumber(resolutionDate) < dayNumber(date)) return null;
  return { id, screen, problem, date, reporter, status, resolutionNote, resolutionDate };
}

/** Normalised feedback entries only; a duplicate id is never rewritten, the first stays. */
export function normalizeAppFeedbackList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeAppFeedback(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findAppFeedback(list, id) {
  const clean = normalizeAppFeedbackList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

/**
 * Record feedback. Refused when half-formed or when its
 * id is already recorded — the first entry for an id
 * always stays.
 */
export function recordAppFeedback(list, raw) {
  const clean = normalizeAppFeedbackList(list);
  const entry = normalizeAppFeedback(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeAppFeedback(list, id) {
  const clean = normalizeAppFeedbackList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

function byScreenThenDate(a, b) {
  const screenA = a.screen.toLowerCase();
  const screenB = b.screen.toLowerCase();
  if (screenA !== screenB) return screenA < screenB ? -1 : 1;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function byDateThenId(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Close one noted entry as fixed or declined. Refused
 * when the entry is missing, already closed, the status
 * is not fixed or declined, the note is empty, or the
 * resolution date is not a strict date on or after the
 * reported date. Closing changes only the status and
 * the resolution note and date of that one entry.
 */
export function closeAppFeedback(list, id, status, resolution = {}) {
  const clean = normalizeAppFeedbackList(list);
  const wanted = text(id);
  const nextStatus = text(status).toLowerCase();
  if (!wanted) return clean;
  if (nextStatus !== 'fixed' && nextStatus !== 'declined') return clean;
  const note = text(resolution && resolution.note);
  const date = text(resolution && resolution.date);
  if (!note) return clean;
  if (!validAppFeedbackDay(date)) return clean;
  return clean.map((entry) => {
    if (entry.id !== wanted) return entry;
    if (entry.status !== 'noted') return entry;
    if (dayNumber(date) < dayNumber(entry.date)) return entry;
    return { ...entry, status: nextStatus, resolutionNote: note, resolutionDate: date };
  });
}

/** Open (noted) feedback, listed by screen, then by date. */
export function appFeedbackOpen(list) {
  const clean = normalizeAppFeedbackList(list);
  return clean.filter((entry) => entry.status === 'noted').sort(byScreenThenDate);
}

/** Open feedback grouped by screen, screens in A-Z order, entries in date order. */
export function appFeedbackOpenByScreen(list) {
  const open = appFeedbackOpen(list);
  const groups = [];
  const byScreen = new Map();
  for (const entry of open) {
    const key = entry.screen.toLowerCase();
    if (!byScreen.has(key)) {
      const group = { screen: entry.screen, items: [] };
      byScreen.set(key, group);
      groups.push(group);
    }
    byScreen.get(key).items.push(entry);
  }
  groups.sort((a, b) => {
    const nameA = a.screen.toLowerCase();
    const nameB = b.screen.toLowerCase();
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
  });
  for (const group of groups) group.items.sort(byDateThenId);
  return groups;
}

/** Every entry for one screen, any status, in date order; the match is case-insensitive. */
export function appFeedbackForScreen(list, screen) {
  const wanted = text(screen).toLowerCase();
  if (!wanted) return [];
  return normalizeAppFeedbackList(list)
    .filter((entry) => entry.screen.toLowerCase() === wanted)
    .sort(byDateThenId);
}

/** Screens that carry open feedback, A-Z, in plain words. */
export function appFeedbackOpenScreens(list) {
  return appFeedbackOpenByScreen(list).map((group) => group.screen);
}

/** Plain-words summary: how many are recorded, still open, fixed, and declined. */
export function appFeedbackSummaryText(list) {
  const clean = normalizeAppFeedbackList(list);
  if (!clean.length) return 'No app feedback recorded.';
  const open = clean.filter((entry) => entry.status === 'noted').length;
  const fixed = clean.filter((entry) => entry.status === 'fixed').length;
  const declined = clean.filter((entry) => entry.status === 'declined').length;
  const totalWord = clean.length === 1 ? '1 app feedback note recorded' : `${clean.length} app feedback notes recorded`;
  const openWord = open === 1 ? '1 still open' : `${open} still open`;
  const fixedWord = fixed === 1 ? '1 fixed' : `${fixed} fixed`;
  const declinedWord = declined === 1 ? '1 declined' : `${declined} declined`;
  return `${totalWord}: ${openWord}, ${fixedWord}, ${declinedWord}.`;
}

/** One line naming a feedback entry, for lists and messages. */
export function appFeedbackEntryText(entry) {
  const clean = normalizeAppFeedback(entry);
  if (!clean) return '';
  const base = `${clean.date} — ${clean.screen}: ${clean.problem} (reported by ${clean.reporter})`;
  if (clean.status === 'noted') return `${base}, noted.`;
  return `${base}, ${clean.status} ${clean.resolutionDate} — ${clean.resolutionNote}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function appFeedbackEntryHtml(entry) {
  const clean = normalizeAppFeedback(entry);
  if (!clean) return '';
  return `<li>${escapeHtml(appFeedbackEntryText(clean))}</li>`;
}

/** The open list grouped by screen, with each entry's status shown; an empty list says so plainly. */
export function appFeedbackOpenHtml(list) {
  const groups = appFeedbackOpenByScreen(list);
  if (!groups.length) return '<p>No open app feedback.</p>';
  return groups
    .map(
      (group) =>
        `<h4>${escapeHtml(group.screen)}</h4><ul>${group.items
          .map((entry) => appFeedbackEntryHtml(entry))
          .join('')}</ul>`,
    )
    .join('');
}

export function appFeedbackAllHtml(list) {
  const clean = normalizeAppFeedbackList(list);
  if (!clean.length) return '<p>No app feedback recorded.</p>';
  const sorted = [...clean].sort(byScreenThenDate);
  return `<ul>${sorted.map((entry) => appFeedbackEntryHtml(entry)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function appFeedbackCsv(list) {
  const clean = normalizeAppFeedbackList(list);
  const sorted = [...clean].sort(byScreenThenDate);
  const header = ['id', 'screen', 'problem', 'date', 'reporter', 'status', 'resolution_note', 'resolution_date'].join(',');
  const rows = sorted.map((entry) =>
    [entry.id, entry.screen, entry.problem, entry.date, entry.reporter, entry.status, entry.resolutionNote, entry.resolutionDate]
      .map(csvCell)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

export function appFeedbackFilename() {
  return 'app-feedback-inbox.csv';
}
