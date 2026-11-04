// Plan 153 (Plan 101-202) — Field Safety Note.
//
// Field hazards such as a risky pole, exposed wiring, or an
// aggressive dog are rediscovered by each new visitor. This module
// is the memory that stops that: one safety note per location,
// with a mohalla/location note, a hazard description, the date it
// was noted, and a precaution. A location or route view surfaces
// its safety notes before a visit, so collectors arrive warned
// about known hazards instead of learning about them on site.
//
// What this module is NOT, stated plainly:
//   - It is not a visit outcome, a ticket, a bill, or a payment.
//     Recording a safety note never changes any visit outcome,
//     ticket, bill, or payment. The location is a note only; no
//     visit, ticket, or billing record is read or written.
//   - It is not a copy of any existing safety module. No such
//     module existed when this plan was checked: the SISP/MD
//     modules for this area were checked first and nothing
//     matching a dated per-location hazard note with a
//     precaution was found (the "safety" hits in the codebase
//     are storage/backup safety snapshots, a different thing),
//     so only this missing piece is added here, and no existing
//     module is read or written.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed notes are refused outright, never stored
//     half-formed: a note needs an id, a location, a hazard,
//     and a real date noted. A note with no location or no
//     hazard is refused. Unknown fields are dropped, so a note
//     can never grow a visit-outcome, ticket, bill, or payment
//     field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later change is removal of the note itself.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - A location view surfaces that location's notes newest
//     first (then id A-Z), with the precaution shown beside
//     each hazard, so the warning is read before the visit.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
function strictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  if (day < 1 || day > limit) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one safety note, or null when half-formed. */
export function normalizeSafetyNote(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const location = cleanText(record.location);
  const hazard = cleanText(record.hazard);
  const dateNoted = strictDate(record.dateNoted);
  if (!id || !location || !hazard || !dateNoted) return null;
  const precaution = cleanText(record.precaution);
  return { id, location, hazard, dateNoted, precaution };
}

/** Normalize a list: half-formed notes dropped, order kept. */
export function normalizeSafetyNoteList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const clean = normalizeSafetyNote(record);
    if (clean) out.push(clean);
  }
  return out;
}

/** Find one safety note by id, or null. */
export function findSafetyNote(list, id) {
  const clean = normalizeSafetyNoteList(list);
  const want = cleanText(id);
  return clean.find((item) => item.id === want) || null;
}

/**
 * Add a safety note, or leave the list unchanged when the note
 * is half-formed or a duplicate id carries different figures.
 * An identical re-save leaves the list unchanged.
 */
export function upsertSafetyNote(list, record) {
  const clean = normalizeSafetyNoteList(list);
  const next = normalizeSafetyNote(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) {
    const same = existing.location === next.location
      && existing.hazard === next.hazard
      && existing.dateNoted === next.dateNoted
      && existing.precaution === next.precaution;
    return same ? clean : clean;
  }
  return [...clean, next];
}

/** Remove a safety note by id; unknown ids leave the list unchanged. */
export function removeSafetyNote(list, id) {
  const clean = normalizeSafetyNoteList(list);
  const want = cleanText(id);
  return clean.filter((item) => item.id !== want);
}

/**
 * Notes for one location (case-insensitive match), newest first
 * (then id A-Z) — the view a collector reads before a visit.
 * An empty location filter gives an empty list, never all notes.
 */
export function notesForLocation(list, location) {
  const want = cleanText(location).toLowerCase();
  if (!want) return [];
  const clean = normalizeSafetyNoteList(list)
    .filter((item) => item.location.toLowerCase() === want);
  clean.sort((a, b) => compareText(b.dateNoted, a.dateNoted) || compareText(a.id, b.id));
  return clean;
}

/** All locations that have at least one note, A-Z. */
export function safetyNoteLocations(list) {
  const seen = new Set();
  for (const item of normalizeSafetyNoteList(list)) seen.add(item.location);
  return [...seen].sort(compareText);
}

/** Summary text: notes / locations counts. */
export function safetyNoteSummaryText(list) {
  const clean = normalizeSafetyNoteList(list);
  const locations = safetyNoteLocations(list).length;
  return `${clean.length} safety note${clean.length === 1 ? '' : 's'} recorded across ${locations} location${locations === 1 ? '' : 's'}.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safetyNoteRowHtml(item) {
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.location)}</td>`
    + `<td>${esc(item.hazard)}</td><td>${esc(item.dateNoted)}</td>`
    + `<td>${esc(item.precaution || '—')}</td></tr>`;
}

function safetyNoteTableHtml(rows, intro) {
  const body = rows.map(safetyNoteRowHtml).join('');
  return `<p>${intro}</p>`
    + '<table><thead><tr><th>Id</th><th>Location</th>'
    + '<th>Hazard</th><th>Noted</th><th>Precaution</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

/**
 * Location view as HTML: that location's notes newest first, so
 * the warning is read before the visit. No match says so plainly.
 */
export function safetyNoteLocationHtml(list, location) {
  const rows = notesForLocation(list, location);
  if (rows.length === 0) return '<p>No safety notes for this location. Nothing known to warn about yet.</p>';
  return safetyNoteTableHtml(rows, `Safety notes for ${esc(cleanText(location))}, newest first — read before the visit.`);
}

/** Full list as HTML, newest first overall (then location A-Z, then id A-Z). */
export function safetyNoteAllHtml(list) {
  const clean = normalizeSafetyNoteList(list);
  if (clean.length === 0) return '<p>No safety notes recorded yet.</p>';
  clean.sort((a, b) => compareText(b.dateNoted, a.dateNoted) || compareText(a.location, b.location) || compareText(a.id, b.id));
  return safetyNoteTableHtml(clean, 'All safety notes, newest first.');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of safety notes. */
export function safetyNoteCsv(list) {
  const rows = normalizeSafetyNoteList(list);
  const lines = ['id,location,hazard,dateNoted,precaution'];
  for (const item of rows) {
    lines.push([item.id, item.location, item.hazard, item.dateNoted, item.precaution].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for safety notes. */
export function safetyNoteFilename() {
  return 'field-safety-notes.csv';
}
