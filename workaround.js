// Plan 152 (Plan 101-202) — Temporary Workaround Record.
//
// A temporary bypass or jumper fix is forgotten, stays in place
// for months, and later causes a confusing fault. This module is
// the record that stops that: one workaround record per temporary
// fix, with a linked ticket or segment, the date it was fitted, a
// description, and a planned removal date. Overdue workarounds
// appear on an open list sorted by planned removal date, and
// recording a removal clears the item — so a temporary fix stays
// temporary, with a dated removal that nobody has to remember.
//
// What this module is NOT, stated plainly:
//   - It is not a fault ticket. Recording a workaround never
//     opens, closes, rewrites, or otherwise changes any fault
//     ticket status by itself, and it never changes any bill or
//     payment. The linked ticket or segment is a reference only.
//   - It is not a repair order and not a permanent fix. A
//     workaround record does not schedule a repair, order a part,
//     or change any service state; it only tracks the temporary
//     fix until its removal is recorded.
//   - It is not a copy of any existing temporary-fix log. No
//     such module existed when this plan was checked: the
//     SISP/MD modules for this area were checked first and
//     nothing matching a dated temporary-fix record with a
//     planned removal date was found, so only this missing piece
//     is added here, and no existing module is read or written.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, a linked ticket or
//     segment, a real fitted date, a description, and a real
//     planned removal date. Unknown fields are dropped, so a
//     record can never grow a ticket-status, bill, or payment
//     field.
//   - A duplicate id is never rewritten: an identical re-save
//     leaves the list unchanged, and a re-save with different
//     figures is refused outright. There is no edit function;
//     the only later changes are recording a removal or removal
//     of the record itself.
//   - Recording a removal sets the removal date only on an open
//     record: an unknown id, an already-removed record, an
//     invalid removal date, or a removal date before the fitted
//     date is refused outright.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass).
//   - The overdue list holds only open workarounds whose planned
//     removal date is before the reference date, sorted by
//     planned removal date earliest first (then id A-Z), so the
//     most overdue temporary fix is always at the top. An
//     invalid reference date gives an empty list, never a
//     guessed order.

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

/** Normalize one workaround record, or null when half-formed. */
export function normalizeWorkaround(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const link = cleanText(record.link);
  const fittedDate = strictDate(record.fittedDate);
  const description = cleanText(record.description);
  const plannedRemovalDate = strictDate(record.plannedRemovalDate);
  if (!id || !link || !fittedDate || !description || !plannedRemovalDate) return null;
  let removalDate = '';
  if (record.removalDate !== undefined && record.removalDate !== null && String(record.removalDate).trim() !== '') {
    removalDate = strictDate(record.removalDate);
    if (!removalDate) return null;
    if (removalDate < fittedDate) return null;
  }
  return { id, link, fittedDate, description, plannedRemovalDate, removalDate };
}

/** Normalize a list: half-formed records dropped, order kept. */
export function normalizeWorkaroundList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const record of list) {
    const clean = normalizeWorkaround(record);
    if (clean) out.push(clean);
  }
  return out;
}

/** Find one workaround by id, or null. */
export function findWorkaround(list, id) {
  const clean = normalizeWorkaroundList(list);
  const want = cleanText(id);
  return clean.find((item) => item.id === want) || null;
}

/**
 * Add a workaround, or leave the list unchanged when the record
 * is half-formed or a duplicate id carries different figures.
 * An identical re-save leaves the list unchanged.
 */
export function upsertWorkaround(list, record) {
  const clean = normalizeWorkaroundList(list);
  const next = normalizeWorkaround(record);
  if (!next) return clean;
  const existing = clean.find((item) => item.id === next.id);
  if (existing) {
    const same = existing.link === next.link
      && existing.fittedDate === next.fittedDate
      && existing.description === next.description
      && existing.plannedRemovalDate === next.plannedRemovalDate
      && existing.removalDate === next.removalDate;
    return same ? clean : clean;
  }
  return [...clean, next];
}

/** Remove a workaround by id; unknown ids leave the list unchanged. */
export function removeWorkaround(list, id) {
  const clean = normalizeWorkaroundList(list);
  const want = cleanText(id);
  return clean.filter((item) => item.id !== want);
}

/**
 * Record a removal: sets the removal date only on an open record.
 * Unknown ids, already-removed records, invalid dates, and
 * removal dates before the fitted date are refused outright
 * (the list is returned unchanged).
 */
export function recordWorkaroundRemoval(list, id, removalDate) {
  const clean = normalizeWorkaroundList(list);
  const want = cleanText(id);
  const date = strictDate(removalDate);
  if (!date) return clean;
  const target = clean.find((item) => item.id === want);
  if (!target || target.removalDate) return clean;
  if (date < target.fittedDate) return clean;
  return clean.map((item) => (item.id === want ? { ...item, removalDate: date } : item));
}

/** Open workarounds (no removal recorded), planned removal date first. */
export function openWorkarounds(list) {
  const clean = normalizeWorkaroundList(list).filter((item) => !item.removalDate);
  clean.sort((a, b) => compareText(a.plannedRemovalDate, b.plannedRemovalDate) || compareText(a.id, b.id));
  return clean;
}

/**
 * Overdue workarounds: open records whose planned removal date is
 * before the reference date, sorted by planned removal date
 * earliest first (then id A-Z). An invalid reference date gives
 * an empty list, never a guessed order.
 */
export function overdueWorkarounds(list, referenceDate) {
  const ref = strictDate(referenceDate);
  if (!ref) return [];
  return openWorkarounds(list).filter((item) => item.plannedRemovalDate < ref);
}

/** Summary text: open / overdue / removed counts. */
export function workaroundSummaryText(list, referenceDate) {
  const clean = normalizeWorkaroundList(list);
  const open = clean.filter((item) => !item.removalDate);
  const overdue = overdueWorkarounds(list, referenceDate);
  const removed = clean.length - open.length;
  return `${clean.length} workaround${clean.length === 1 ? '' : 's'} recorded; `
    + `${open.length} still open, ${overdue.length} overdue, ${removed} removed.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function workaroundRowHtml(item, overdue) {
  return `<tr><td>${esc(item.id)}</td><td>${esc(item.link)}</td>`
    + `<td>${esc(item.fittedDate)}</td><td>${esc(item.description)}</td>`
    + `<td>${esc(item.plannedRemovalDate)}</td>`
    + `<td>${overdue ? 'OVERDUE' : (item.removalDate || 'open')}</td></tr>`;
}

/** Open list as HTML, with overdue rows flagged. */
export function workaroundOpenHtml(list, referenceDate) {
  const open = openWorkarounds(list);
  if (open.length === 0) return '<p>No open temporary workarounds. Nothing temporary is waiting for removal.</p>';
  const overdueIds = new Set(overdueWorkarounds(list, referenceDate).map((item) => item.id));
  const body = open.map((item) => workaroundRowHtml(item, overdueIds.has(item.id))).join('');
  return '<p>Open temporary workarounds, planned removal date first; overdue rows are flagged.</p>'
    + '<table><thead><tr><th>Id</th><th>Ticket / segment</th>'
    + '<th>Fitted</th><th>Description</th><th>Planned removal</th><th>Status</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

/** Overdue list as HTML. */
export function workaroundOverdueHtml(list, referenceDate) {
  const overdue = overdueWorkarounds(list, referenceDate);
  if (overdue.length === 0) return '<p>No overdue temporary workarounds.</p>';
  const body = overdue.map((item) => workaroundRowHtml(item, true)).join('');
  return '<p>Overdue temporary workarounds, planned removal date first — these need removing first.</p>'
    + '<table><thead><tr><th>Id</th><th>Ticket / segment</th>'
    + '<th>Fitted</th><th>Description</th><th>Planned removal</th><th>Status</th></tr></thead><tbody>'
    + body + '</tbody></table>';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of workaround records. */
export function workaroundCsv(list) {
  const rows = normalizeWorkaroundList(list);
  const lines = ['id,link,fittedDate,description,plannedRemovalDate,removalDate'];
  for (const item of rows) {
    lines.push([item.id, item.link, item.fittedDate, item.description, item.plannedRemovalDate, item.removalDate].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for workaround records. */
export function workaroundFilename() {
  return 'temporary-workarounds.csv';
}
