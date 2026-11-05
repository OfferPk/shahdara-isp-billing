// Plan 301 (Plan 203-350) — Shop maintenance note.
//
// Shop repairs (a fan, a shutter, a shelf, wiring) are fixed and
// forgotten, so the same fault recurs with no history of what was
// done before. This module adds only the missing piece: one
// maintenance note per repair — the date, the item or area, the
// fault in plain words, the action taken, a cost note in plain
// words, and who did it — so maintenance is listed by date and
// item with the action taken visible.
//
// What this module is NOT, stated plainly:
//   - It is not the shop inventory audit cycle. That cycle
//     counts stock and is neither read nor rewritten here; this
//     module only records what was repaired on the shop
//     premises and shop equipment.
//   - It is not a bill, payment, or stock change. Recording a
//     note never changes any bill, payment, or stock record by
//     itself, and the repair itself happens outside this record.
//   - It is not a live record. A maintenance note, once
//     written, is never silently edited: there is no edit
//     function, only record, find, and remove, so a wrong note
//     is removed and recorded again.
//   - It is not a work order or a promise. A note records what
//     was done, not what will be done, and it never assigns
//     anyone a task.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     note, and the module never reads storage, the clock, or
//     the network, and never mutates an input.
//   - A note with no id, no strict date, no item, no fault, no
//     action taken, or no done-by person is refused outright.
//     The cost note is plain words and optional. Unknown
//     fields are dropped, so a note can never grow a bill,
//     payment, or stock field.
//   - A duplicate id is never rewritten: the first note stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validShopMaintenanceDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > limit) return false;
  return true;
}

/**
 * One shop maintenance note, or null when half-formed. A note needs
 * an id, a strict date, an item or area, a fault in plain words, an
 * action taken in plain words, and a done-by person. The cost note
 * is plain words and optional. Unknown fields are dropped; the
 * input is never mutated.
 */
export function normalizeShopMaintenanceNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const item = text(raw.item);
  const fault = text(raw.fault);
  const action = text(raw.action);
  const cost = text(raw.cost);
  const doneBy = text(raw.doneBy);
  if (!id) return null;
  if (!validShopMaintenanceDay(date)) return null;
  if (!item) return null;
  if (!fault) return null;
  if (!action) return null;
  if (!doneBy) return null;
  return {
    id,
    date,
    item,
    fault,
    action,
    cost,
    doneBy,
  };
}

/** Normalised notes only. A duplicate id is never rewritten: the first note stays. */
export function normalizeShopMaintenanceNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeShopMaintenanceNote(raw);
    if (!note) continue;
    if (seenIds.has(note.id)) continue;
    seenIds.add(note.id);
    out.push(note);
  }
  return out;
}

export function findShopMaintenanceNote(list, id) {
  const clean = normalizeShopMaintenanceNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record a maintenance note. Refused when half-formed or when its
 * id is already recorded — the first note for an id always stays.
 */
export function recordShopMaintenanceNote(list, raw) {
  const clean = normalizeShopMaintenanceNoteList(list);
  const note = normalizeShopMaintenanceNote(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removeShopMaintenanceNote(list, id) {
  const clean = normalizeShopMaintenanceNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

/** Notes by date, then item A-Z, then id, so the same list always reads the same way. */
export function shopMaintenanceNotesSorted(list) {
  const clean = normalizeShopMaintenanceNoteList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (lower(a.item) !== lower(b.item)) return lower(a.item) < lower(b.item) ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Notes for one item or area, in date order; the item match is case-insensitive. */
export function shopMaintenanceNotesForItem(list, item) {
  const wanted = lower(item);
  if (!wanted) return [];
  return shopMaintenanceNotesSorted(list).filter((note) => lower(note.item) === wanted);
}

/** Items or areas with a note, first spelling kept, A-Z. */
export function shopMaintenanceItems(list) {
  const clean = normalizeShopMaintenanceNoteList(list);
  const seen = new Map();
  for (const note of clean) {
    const key = lower(note.item);
    if (!seen.has(key)) seen.set(key, note.item);
  }
  return [...seen.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

export function shopMaintenanceNoteSummaryText(list) {
  const clean = normalizeShopMaintenanceNoteList(list);
  if (clean.length === 0) return 'No shop maintenance notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  const sorted = shopMaintenanceNotesSorted(clean);
  const latest = sorted[sorted.length - 1];
  return `${clean.length} shop maintenance ${word} recorded. Latest: ${latest.item}, ${latest.date}, ${latest.action}.`;
}

/** Plain-words text for one note: fault and action taken with who did it visible. */
export function shopMaintenanceNoteEntryText(note) {
  const clean = normalizeShopMaintenanceNote(note);
  if (!clean) return 'No shop maintenance note recorded.';
  const costPart = clean.cost ? ` Cost: ${clean.cost}.` : '';
  return `${clean.date} — ${clean.item}: Fault: ${clean.fault}. Action taken: ${clean.action}. Done by ${clean.doneBy}.${costPart}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function shopMaintenanceNoteEntryHtml(note) {
  const clean = normalizeShopMaintenanceNote(note);
  if (!clean) return '<p>No shop maintenance note recorded.</p>';
  return `<p>${escapeHtml(shopMaintenanceNoteEntryText(clean))}</p>`;
}

export function shopMaintenanceNoteAllHtml(list) {
  const rows = shopMaintenanceNotesSorted(list);
  if (!rows.length) return '<p>No shop maintenance notes recorded.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(shopMaintenanceNoteEntryText(note))}</li>`).join('')}</ul>`;
}

export function shopMaintenanceNotesForItemHtml(list, item) {
  const rows = shopMaintenanceNotesForItem(list, item);
  if (!rows.length) return '<p>No shop maintenance notes recorded for this item.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(shopMaintenanceNoteEntryText(note))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function shopMaintenanceNoteCsv(list) {
  const rows = shopMaintenanceNotesSorted(list);
  const lines = ['"id","date","item","fault","action taken","cost","done by"'];
  for (const note of rows) {
    lines.push([
      csvCell(note.id),
      csvCell(note.date),
      csvCell(note.item),
      csvCell(note.fault),
      csvCell(note.action),
      csvCell(note.cost),
      csvCell(note.doneBy),
    ].join(','));
  }
  return lines.join('\n');
}

export function shopMaintenanceNoteFilename() {
  return 'shop-maintenance-notes.csv';
}
