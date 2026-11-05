// Plan 300 (Plan 203-350) — Staff performance note.
//
// How a staff member is doing is discussed but never written down,
// so feedback is forgotten and later judgements have no basis. This
// module adds only the missing piece: one qualitative performance
// note per staff member per period — the staff member, the period,
// strengths, areas to improve, and the reviewer, all in plain
// words — so notes are listed per staff member by period with the
// reviewer visible.
//
// What this module is NOT, stated plainly:
//   - It is not the measured performance view. That view shows
//     measured visits, promises kept, and cash; this module only
//     records a qualitative note in plain words and never reads
//     or rewrites any measured figure.
//   - It is not the training record. Training after onboarding
//     already has its own record and is neither read nor rewritten
//     here; this module only records how a staff member is doing,
//     which the owner may later use as a basis for training.
//   - It is not a judgement that changes anything. Recording a
//     note never changes any bill, payment, customer record, or
//     staff record by itself.
//   - It is not an editable record. A performance note, once
//     written, is never silently edited: there is no edit
//     function, only record, find, and remove, so a wrong note
//     is removed and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every note,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id, no staff member, no period, no
//     strengths, no areas to improve, or no reviewer is refused
//     outright. Unknown fields are dropped, so a note can never
//     grow a bill, payment, customer, or staff field.
//   - A duplicate id is never rewritten: the first note stays.

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

/**
 * One staff performance note, or null when half-formed. A note needs
 * an id, a staff member, a period in plain words, strengths in plain
 * words, areas to improve in plain words, and a reviewer. Unknown
 * fields are dropped; the input is never mutated.
 */
export function normalizeStaffPerformanceNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const staff = text(raw.staff);
  const period = text(raw.period);
  const strengths = text(raw.strengths);
  const areasToImprove = text(raw.areasToImprove);
  const reviewer = text(raw.reviewer);
  if (!id) return null;
  if (!staff) return null;
  if (!period) return null;
  if (!strengths) return null;
  if (!areasToImprove) return null;
  if (!reviewer) return null;
  return {
    id,
    staff,
    period,
    strengths,
    areasToImprove,
    reviewer,
  };
}

/** Normalised notes only. A duplicate id is never rewritten: the first note stays. */
export function normalizeStaffPerformanceNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeStaffPerformanceNote(raw);
    if (!note) continue;
    if (seenIds.has(note.id)) continue;
    seenIds.add(note.id);
    out.push(note);
  }
  return out;
}

export function findStaffPerformanceNote(list, id) {
  const clean = normalizeStaffPerformanceNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record a performance note. Refused when half-formed or when its
 * id is already recorded — the first note for an id always stays.
 */
export function recordStaffPerformanceNote(list, raw) {
  const clean = normalizeStaffPerformanceNoteList(list);
  const note = normalizeStaffPerformanceNote(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removeStaffPerformanceNote(list, id) {
  const clean = normalizeStaffPerformanceNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

/** Notes by staff member A-Z, then period, then id, so the same list always reads the same way. */
export function staffPerformanceNotesSorted(list) {
  const clean = normalizeStaffPerformanceNoteList(list);
  return [...clean].sort((a, b) => {
    if (lower(a.staff) !== lower(b.staff)) return lower(a.staff) < lower(b.staff) ? -1 : 1;
    if (a.period !== b.period) return a.period < b.period ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Notes for one staff member, in period order; the staff match is case-insensitive. */
export function staffPerformanceNotesForStaff(list, staff) {
  const wanted = lower(staff);
  if (!wanted) return [];
  return staffPerformanceNotesSorted(list).filter((note) => lower(note.staff) === wanted);
}

/** Staff members with a note, first spelling kept, A-Z. */
export function staffPerformanceStaff(list) {
  const clean = normalizeStaffPerformanceNoteList(list);
  const seen = new Map();
  for (const note of clean) {
    const key = lower(note.staff);
    if (!seen.has(key)) seen.set(key, note.staff);
  }
  return [...seen.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

export function staffPerformanceNoteSummaryText(list) {
  const clean = normalizeStaffPerformanceNoteList(list);
  if (clean.length === 0) return 'No staff performance notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  const sorted = staffPerformanceNotesSorted(clean);
  const latest = sorted[sorted.length - 1];
  return `${clean.length} staff performance ${word} recorded. Latest: ${latest.staff}, ${latest.period}, reviewed by ${latest.reviewer}.`;
}

/** Plain-words text for one note: strengths and areas to improve with the reviewer visible. */
export function staffPerformanceNoteEntryText(note) {
  const clean = normalizeStaffPerformanceNote(note);
  if (!clean) return 'No staff performance note recorded.';
  return `${clean.staff} — ${clean.period}: Strengths: ${clean.strengths}. Areas to improve: ${clean.areasToImprove}. Reviewed by ${clean.reviewer}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function staffPerformanceNoteEntryHtml(note) {
  const clean = normalizeStaffPerformanceNote(note);
  if (!clean) return '<p>No staff performance note recorded.</p>';
  return `<p>${escapeHtml(staffPerformanceNoteEntryText(clean))}</p>`;
}

export function staffPerformanceNoteAllHtml(list) {
  const rows = staffPerformanceNotesSorted(list);
  if (!rows.length) return '<p>No staff performance notes recorded.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(staffPerformanceNoteEntryText(note))}</li>`).join('')}</ul>`;
}

export function staffPerformanceNotesForStaffHtml(list, staff) {
  const rows = staffPerformanceNotesForStaff(list, staff);
  if (!rows.length) return '<p>No staff performance notes recorded for this staff member.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(staffPerformanceNoteEntryText(note))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function staffPerformanceNoteCsv(list) {
  const rows = staffPerformanceNotesSorted(list);
  const lines = ['"id","staff","period","strengths","areas to improve","reviewer"'];
  for (const note of rows) {
    lines.push([
      csvCell(note.id),
      csvCell(note.staff),
      csvCell(note.period),
      csvCell(note.strengths),
      csvCell(note.areasToImprove),
      csvCell(note.reviewer),
    ].join(','));
  }
  return lines.join('\n');
}

export function staffPerformanceNoteFilename() {
  return 'staff-performance-notes.csv';
}
