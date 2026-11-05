// Plan 250 (Plan 203-350) — Field cabinet key access note.
//
// Field cabinets are opened by different people, but there was no
// note of who opened which cabinet and when, so a cabinet left
// unlocked or disturbed could not be traced. This module adds only
// the missing piece: one access note per field cabinet opening —
// the cabinet reference, the date, who opened it, the reason, and
// whether it was confirmed locked again.
//
// The fences, stated plainly:
//   - This records field cabinet openings only. It does not
//     replace the shop keys register (Plan 196), which covers
//     shop keys: no shop key record is read nor rewritten here,
//     and this module imports nothing.
//   - It is not an inspection record: the pole and cabinet
//     inspection round records inspection results, and no
//     inspection record is read nor rewritten here. A note names
//     a cabinet by reference only and changes no cabinet,
//     inspection, or route record.
//   - Openings list by cabinet and by date, and openings without
//     a locked-again confirmation are flagged, so a disturbed
//     cabinet can be traced to a visit instead of becoming a
//     mystery.
//   - A note is never edited, only annotated: there is no edit
//     function, only record, annotate, and remove. An annotation
//     never rewrites the cabinet, the date, who opened it, the
//     reason, or the locked-again confirmation.
//   - Recording access never changes any bill, payment, customer,
//     cabinet, or staff record by itself: the module takes no
//     bill, payment, customer, cabinet, or staff object in,
//     edits none, and returns none. It holds cabinet access
//     notes only.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const CABINET_ACCESS_STORE = 'shahdara_cabinet_access_v1';
export const CABINET_ACCESS_FILENAME = 'cabinet-access-notes.csv';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validCabinetAccessDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

// Locked again is a plain yes or no: only an explicit yes counts
// as confirmed, so an opening that never says so stays flagged.
function cleanLockedAgain(value) {
  if (value === true) return true;
  const word = text(value).toLowerCase();
  return word === 'yes' || word === 'true' || word === 'y' || word === 'locked';
}

function cleanAnnotations(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const date = text(item.date);
    const note = text(item.note);
    if (!validCabinetAccessDate(date) || !note) continue;
    out.push({ date, note });
  }
  return out;
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = text(entry.id);
  const cabinet = text(entry.cabinet);
  const date = text(entry.date);
  const openedBy = text(entry.openedBy);
  const reason = text(entry.reason);
  if (!id || !cabinet || !date || !openedBy || !reason) return null;
  if (!validCabinetAccessDate(date)) return null;
  return {
    id,
    cabinet,
    date,
    openedBy,
    reason,
    lockedAgain: cleanLockedAgain(entry.lockedAgain),
    annotations: cleanAnnotations(entry.annotations),
  };
}

export function normalizeCabinetAccessList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const entry of list) {
    const clean = normalizeEntry(entry);
    if (!clean) continue;
    if (seenIds.has(clean.id)) continue;
    seenIds.add(clean.id);
    out.push(clean);
  }
  return out;
}

// One note per opening: the same cabinet may be opened many
// times, so only a repeated id is refused, never a repeated
// cabinet.
export function recordCabinetAccess(list, entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return null;
  const base = normalizeCabinetAccessList(list);
  if (base.some((item) => item.id === clean.id)) return base;
  return [...base, clean];
}

export function removeCabinetAccess(list, id) {
  const base = normalizeCabinetAccessList(list);
  return base.filter((item) => item.id !== text(id));
}

export function findCabinetAccess(list, id) {
  const base = normalizeCabinetAccessList(list);
  return base.find((item) => item.id === text(id)) || null;
}

// An annotation is a dated note added after the opening, never a
// rewrite: the cabinet, the date, who opened it, the reason, and
// the locked-again confirmation all stay exactly as recorded.
export function annotateCabinetAccess(list, id, annotation) {
  const base = normalizeCabinetAccessList(list);
  const target = text(id);
  if (!annotation || typeof annotation !== 'object') return list;
  const date = text(annotation.date);
  const note = text(annotation.note);
  if (!validCabinetAccessDate(date) || !note) return list;
  if (!base.some((item) => item.id === target)) return list;
  return base.map((item) =>
    item.id === target
      ? { ...item, annotations: [...item.annotations, { date, note }] }
      : item,
  );
}

export function cabinetAccessSorted(list) {
  const base = normalizeCabinetAccessList(list);
  return [...base].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const byCabinet = a.cabinet
      .toLowerCase()
      .localeCompare(b.cabinet.toLowerCase());
    if (byCabinet !== 0) return byCabinet;
    return a.id.localeCompare(b.id);
  });
}

export function cabinetAccessByCabinet(list, cabinet) {
  const wanted = text(cabinet).toLowerCase();
  return cabinetAccessSorted(list).filter(
    (item) => item.cabinet.toLowerCase() === wanted,
  );
}

export function cabinetAccessByDate(list, date) {
  const wanted = text(date);
  return cabinetAccessSorted(list).filter((item) => item.date === wanted);
}

export function cabinetAccessCabinets(list) {
  const base = normalizeCabinetAccessList(list);
  const seen = new Set();
  const out = [];
  for (const item of base) {
    const key = item.cabinet.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.cabinet);
  }
  return out;
}

// Openings without a locked-again confirmation are flagged: a
// cabinet that was never confirmed locked again is the first
// place to check when something looks disturbed.
export function unconfirmedCabinetAccess(list) {
  return cabinetAccessSorted(list).filter((item) => !item.lockedAgain);
}

export function cabinetAccessSummaryText(list) {
  const base = normalizeCabinetAccessList(list);
  const confirmed = base.filter((item) => item.lockedAgain).length;
  const unconfirmed = base.length - confirmed;
  const openingWord = base.length === 1 ? 'opening' : 'openings';
  const unconfirmedText =
    unconfirmed === 0
      ? 'Every opening was confirmed locked again.'
      : `${unconfirmed} opening${unconfirmed === 1 ? '' : 's'} without a locked-again confirmation.`;
  return (
    `${base.length} ${openingWord}: ${confirmed} confirmed locked again, ` +
    `${unconfirmed} not confirmed. ${unconfirmedText}`
  );
}

export function cabinetAccessText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '';
  const annotations =
    clean.annotations.length === 0
      ? 'No dated annotations yet.'
      : `${clean.annotations.length} dated annotation${clean.annotations.length === 1 ? '' : 's'}, latest ${clean.annotations[clean.annotations.length - 1].date}.`;
  const reasonText = clean.reason.endsWith('.')
    ? clean.reason
    : `${clean.reason}.`;
  return (
    `Cabinet ${clean.cabinet} opened by ${clean.openedBy} on ${clean.date} ` +
    `for ${reasonText} Locked again: ${clean.lockedAgain ? 'yes' : 'no'}. ${annotations}`
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function cabinetAccessHtml(list) {
  const rows = cabinetAccessSorted(list);
  if (rows.length === 0) return '<p>No cabinet access notes recorded.</p>';
  const items = rows
    .map((item) => `<li>${escapeHtml(cabinetAccessText(item))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function cabinetAccessCsv(list) {
  const rows = cabinetAccessSorted(list);
  const header = [
    'id',
    'cabinet',
    'date',
    'opened by',
    'reason',
    'locked again',
    'dated annotations',
  ]
    .map(csvCell)
    .join(',');
  const lines = rows.map((item) =>
    [
      item.id,
      item.cabinet,
      item.date,
      item.openedBy,
      item.reason,
      item.lockedAgain ? 'yes' : 'no',
      item.annotations.map((a) => `${a.date}: ${a.note}`).join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}

export function cabinetAccessFilename() {
  return CABINET_ACCESS_FILENAME;
}
