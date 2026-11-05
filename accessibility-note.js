// Plan 323 (Plan 203-350) — Accessibility note per screen.
//
// A screen that is hard to use for an operator with poor
// eyesight or shaky hands is only known by complaint, with
// no record of which screens have problems. This module
// adds only the missing piece: one accessibility note per
// screen — the screen name, the issue in plain words, a
// workaround, and the date it was noted — so a screen
// list shows which screens carry notes and which are
// clear, and known difficult screens are visible before
// they slow a collection round.
//
// What this module is NOT, stated plainly:
//   - It is not the accessibility foundations (Plan C),
//     which make screens usable in the first place.
//     Those foundations already exist and are neither
//     read nor rewritten here; this module only records
//     issues, it never changes a screen.
//   - It is not the app feedback inbox (Plan 322),
//     which collects complaints about the app itself.
//     That inbox already exists and is neither read nor
//     rewritten here; a note here is about a screen
//     being hard to use, never a general app complaint.
//   - It is not the mobile and operator-phone work
//     (Plan D), which keeps the shop's one operator
//     phone usable in the field. That work already
//     exists and is neither read nor rewritten here;
//     a note only records the issue, it never changes
//     the phone or any screen.
//   - It is not a bill, payment, or customer change.
//     Recording or removing a note never changes any
//     screen, bill, payment, or customer record by
//     itself: the note only lists the issue and its
//     workaround.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every note and every screen name, and the module
//     never reads storage, the clock, or the network,
//     and never mutates an input.
//   - A note with no id, no screen, no issue in plain
//     words, or no strict date is refused outright. A
//     workaround is welcome but optional, so a note can
//     be recorded before anyone has found one. Unknown
//     fields are dropped, so a note can never grow a
//     bill, payment, or customer field.
//   - A duplicate id is never rewritten: the first
//     note stays.
//   - The screen list is caller-supplied. A screen
//     with no note reads clear; the module invents no
//     screen names and no notes of its own.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validAccessibilityNoteDay(value) {
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
 * One accessibility note, or null when half-formed.
 * A note needs an id, a screen, an issue in plain
 * words, and a strict date. The workaround is optional
 * and reads empty until one is found. Unknown fields
 * are dropped; the input is never mutated.
 */
export function normalizeAccessibilityNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const screen = text(raw.screen);
  const issue = text(raw.issue);
  const workaround = text(raw.workaround);
  const date = text(raw.date);
  if (!id) return null;
  if (!screen) return null;
  if (!issue) return null;
  if (!validAccessibilityNoteDay(date)) return null;
  return { id, screen, issue, workaround, date };
}

/** Normalised accessibility notes only; a duplicate id is never rewritten, the first stays. */
export function normalizeAccessibilityNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeAccessibilityNote(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function findAccessibilityNote(list, id) {
  const clean = normalizeAccessibilityNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record an accessibility note. Refused when
 * half-formed or when its id is already recorded — the
 * first note for an id always stays.
 */
export function recordAccessibilityNote(list, raw) {
  const clean = normalizeAccessibilityNoteList(list);
  const note = normalizeAccessibilityNote(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removeAccessibilityNote(list, id) {
  const clean = normalizeAccessibilityNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

function byDateThenId(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function byScreenThenDate(a, b) {
  const screenA = a.screen.toLowerCase();
  const screenB = b.screen.toLowerCase();
  if (screenA !== screenB) return screenA < screenB ? -1 : 1;
  return byDateThenId(a, b);
}

/** Every note for one screen, in date order; the match is case-insensitive. */
export function accessibilityNotesForScreen(list, screen) {
  const wanted = text(screen).toLowerCase();
  if (!wanted) return [];
  return normalizeAccessibilityNoteList(list)
    .filter((note) => note.screen.toLowerCase() === wanted)
    .sort(byDateThenId);
}

/** Notes grouped by screen, screens in A-Z order, entries in date order. */
export function accessibilityNotesByScreen(list) {
  const clean = normalizeAccessibilityNoteList(list);
  const groups = [];
  const byScreen = new Map();
  for (const note of clean) {
    const key = note.screen.toLowerCase();
    if (!byScreen.has(key)) {
      const group = { screen: note.screen, items: [] };
      byScreen.set(key, group);
      groups.push(group);
    }
    byScreen.get(key).items.push(note);
  }
  groups.sort((a, b) => {
    const nameA = a.screen.toLowerCase();
    const nameB = b.screen.toLowerCase();
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
  });
  for (const group of groups) group.items.sort(byDateThenId);
  return groups;
}

/** Screens that carry at least one note, A-Z, in plain words. */
export function accessibilityNoteScreensWithNotes(list) {
  return accessibilityNotesByScreen(list).map((group) => group.screen);
}

/**
 * The caller-supplied screen list, each screen marked
 * with whether it carries notes and how many. A screen
 * with no note reads clear. Screen names are matched
 * case-insensitively and repeated names collapse to the
 * first spelling; the list is returned in A-Z order.
 */
export function accessibilityNoteScreenStatus(list, screens) {
  if (!Array.isArray(screens)) return [];
  const groups = accessibilityNotesByScreen(list);
  const counts = new Map();
  for (const group of groups) counts.set(group.screen.toLowerCase(), group.items.length);
  const seen = new Map();
  for (const raw of screens) {
    const name = text(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()]
    .sort((a, b) => {
      const nameA = a.toLowerCase();
      const nameB = b.toLowerCase();
      return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    })
    .map((screen) => {
      const count = counts.get(screen.toLowerCase()) ?? 0;
      return { screen, hasNote: count > 0, noteCount: count };
    });
}

/** Plain-words summary: how many notes are recorded and on how many screens. */
export function accessibilityNoteSummaryText(list) {
  const clean = normalizeAccessibilityNoteList(list);
  if (!clean.length) return 'No accessibility notes recorded.';
  const screens = accessibilityNoteScreensWithNotes(list).length;
  const noteWord = clean.length === 1 ? '1 accessibility note recorded' : `${clean.length} accessibility notes recorded`;
  const screenWord = screens === 1 ? 'on 1 screen' : `on ${screens} screens`;
  return `${noteWord} ${screenWord}.`;
}

/** One line naming an accessibility note, for lists and messages. */
export function accessibilityNoteEntryText(note) {
  const clean = normalizeAccessibilityNote(note);
  if (!clean) return '';
  const base = `${clean.date} — ${clean.screen}: ${clean.issue}`;
  if (!clean.workaround) return `${base}.`;
  return `${base} (workaround: ${clean.workaround}).`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function accessibilityNoteEntryHtml(note) {
  const clean = normalizeAccessibilityNote(note);
  if (!clean) return '';
  return `<li>${escapeHtml(accessibilityNoteEntryText(clean))}</li>`;
}

/** Notes grouped by screen, with each note's workaround shown; an empty list says so plainly. */
export function accessibilityNotesByScreenHtml(list) {
  const groups = accessibilityNotesByScreen(list);
  if (!groups.length) return '<p>No accessibility notes recorded.</p>';
  return groups
    .map(
      (group) =>
        `<h4>${escapeHtml(group.screen)}</h4><ul>${group.items
          .map((note) => accessibilityNoteEntryHtml(note))
          .join('')}</ul>`,
    )
    .join('');
}

export function accessibilityNoteAllHtml(list) {
  const clean = normalizeAccessibilityNoteList(list);
  if (!clean.length) return '<p>No accessibility notes recorded.</p>';
  const sorted = [...clean].sort(byScreenThenDate);
  return `<ul>${sorted.map((note) => accessibilityNoteEntryHtml(note)).join('')}</ul>`;
}

/** One line per screen: which screens carry notes and which are clear. */
export function accessibilityNoteScreenStatusHtml(list, screens) {
  const status = accessibilityNoteScreenStatus(list, screens);
  if (!status.length) return '<p>No screens listed.</p>';
  return `<ul>${status
    .map((row) => {
      const label = row.hasNote
        ? `${row.noteCount === 1 ? '1 note' : `${row.noteCount} notes`}`
        : 'clear';
      return `<li>${escapeHtml(row.screen)}: ${escapeHtml(label)}</li>`;
    })
    .join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function accessibilityNoteCsv(list) {
  const clean = normalizeAccessibilityNoteList(list);
  const sorted = [...clean].sort(byScreenThenDate);
  const header = ['id', 'screen', 'issue', 'workaround', 'date'].join(',');
  const rows = sorted.map((note) =>
    [note.id, note.screen, note.issue, note.workaround, note.date].map(csvCell).join(','),
  );
  return [header, ...rows].join('\n');
}

export function accessibilityNoteFilename() {
  return 'accessibility-notes.csv';
}
