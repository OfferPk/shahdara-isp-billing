// Plan 143 (Plan 101-202) — Equipment calibration/replacement cycle.
//
// Testers, meters, and site equipment drift or age with no cycle
// that says when each item is due a check or replacement. This
// module is that cycle: one cycle record per equipment item, with
// an item name, the last check date, the cycle length in days,
// and the next due date computed from those two. Overdue and
// due-soon items appear on a dated list, and recording a check
// moves the next due date forward by exactly the cycle, so field
// readings stay trustworthy and ageing gear is replaced on a
// plan, not after a failure.
//
// What this module is NOT, stated plainly:
//   - It is not a stock record. Plan 136's spare-parts reorder,
//     the stock register, and the field-bag stock are neither
//     read nor written here: recording a check never adds,
//     removes, orders, or otherwise changes any stock count.
//   - It is not a warranty record. The warranty-returns module
//     is neither read nor written here: a cycle never opens,
//     extends, or closes a warranty claim.
//   - It is not a payment record. Nothing here touches any bill
//     or payment, and it is not a calibration certificate either:
//     the ONU DDMI telemetry certification module checks live
//     transceiver readings and is neither read nor written here.
//     A cycle record only says when an item is next due a check.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock, or
//     the network, never imports another module, and never
//     mutates an input. Every function returns a new list or
//     new rows.
//   - Half-formed records are refused outright, never stored
//     half-formed: a record needs an id, an item name, a real
//     calendar last-check date, and a positive whole number of
//     cycle days. A record with no item or no cycle is refused,
//     and so is one with an impossible date. Unknown fields are
//     dropped, so a record can never grow a stock, warranty, or
//     payment field. The next due date is always computed here
//     (last check + cycle days), never taken from the input.
//   - One cycle record per equipment item: an item cannot gain
//     a second record under a different id. A duplicate id is
//     never rewritten: an identical re-save leaves the list
//     unchanged, and a re-save with different figures is refused
//     outright. There is no edit function; the only later
//     changes are recording a check and removal.
//   - Recording a check moves forward only: the check date must
//     be a real date on or after the last check date, and the
//     next due date becomes the check date plus the cycle days.
//     A check dated before the last check is refused outright.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed; 2026-08-31, 2026-10-31 and
//     2026-12-31 are real and pass). Day arithmetic is done in
//     UTC so the due date never shifts with a timezone.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or null. */
export function validEquipmentCycleDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Positive whole cycle days: a number or a numeric string, or null. */
export function cleanEquipmentCycleDays(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!/^\d+$/.test(text)) return null;
    const days = Number(text);
    return days > 0 ? days : null;
  }
  return null;
}

/** Add whole days to a YYYY-MM-DD date, in UTC. Returns YYYY-MM-DD. */
export function addEquipmentCycleDays(date, days) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (n) => String(n).padStart(2, '0');
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize one cycle record, or null when half-formed. */
export function normalizeEquipmentCycleRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id);
  const item = cleanText(raw.item);
  const lastCheck = validEquipmentCycleDate(raw.lastCheck);
  const cycleDays = cleanEquipmentCycleDays(raw.cycleDays);
  if (!id || !item || !lastCheck || cycleDays === null) return null;
  return {
    id,
    item,
    lastCheck,
    cycleDays,
    nextDue: addEquipmentCycleDays(lastCheck, cycleDays),
    note: cleanText(raw.note),
  };
}

/** Normalize a list: drop half-formed records and duplicate ids (first wins). */
export function normalizeEquipmentCycleList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeEquipmentCycleRecord(raw);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

/** Find one record by id, or null. */
export function findEquipmentCycleRecord(list, id) {
  const clean = cleanText(id);
  if (!clean) return null;
  return normalizeEquipmentCycleList(list).find((item) => item.id === clean) || null;
}

/**
 * Save one record. Returns a new list, or the input unchanged when
 * the record is half-formed, repeats an id with different figures,
 * or would give an item a second cycle record.
 */
export function upsertEquipmentCycleRecord(list, raw) {
  const clean = normalizeEquipmentCycleList(list);
  const record = normalizeEquipmentCycleRecord(raw);
  if (!record) return clean;
  const existing = clean.find((item) => item.id === record.id);
  if (existing) return clean;
  const sameItem = clean.some(
    (item) => item.item.toLowerCase() === record.item.toLowerCase(),
  );
  if (sameItem) return clean;
  return [...clean, record];
}

/** Remove one record by id. Returns a new list. */
export function removeEquipmentCycleRecord(list, id) {
  const clean = cleanText(id);
  if (!clean) return normalizeEquipmentCycleList(list);
  return normalizeEquipmentCycleList(list).filter((item) => item.id !== clean);
}

/**
 * Record a check for one item. Returns a new list, or the input
 * unchanged when the id is unknown, the check date is not real,
 * or the check date is before the last check date. A recorded
 * check moves the next due date forward by exactly the cycle.
 */
export function recordEquipmentCycleCheck(list, id, checkDate) {
  const clean = normalizeEquipmentCycleList(list);
  const date = validEquipmentCycleDate(checkDate);
  if (!date) return clean;
  return clean.map((item) => {
    if (item.id !== cleanText(id)) return item;
    if (date < item.lastCheck) return item;
    return {
      ...item,
      lastCheck: date,
      nextDue: addEquipmentCycleDays(date, item.cycleDays),
    };
  });
}

/** Sort helper: next due date first, then item A-Z, then id A-Z. */
function byDueDate(a, b) {
  return compareText(a.nextDue, b.nextDue)
    || compareText(a.item.toLowerCase(), b.item.toLowerCase())
    || compareText(a.id, b.id);
}

/**
 * Overdue items: next due date strictly before the reference date.
 * An invalid reference date gives an empty list, never a guess.
 */
export function overdueEquipmentCycleItems(list, referenceDate) {
  const ref = validEquipmentCycleDate(referenceDate);
  if (!ref) return [];
  return normalizeEquipmentCycleList(list)
    .filter((item) => item.nextDue < ref)
    .sort(byDueDate);
}

/**
 * Due-soon items: next due date on or after the reference date and
 * within windowDays of it (default 30 days). An invalid reference
 * date or window gives an empty list, never a guess.
 */
export function dueSoonEquipmentCycleItems(list, referenceDate, windowDays = 30) {
  const ref = validEquipmentCycleDate(referenceDate);
  const window = cleanEquipmentCycleDays(windowDays);
  if (!ref || window === null) return [];
  const horizon = addEquipmentCycleDays(ref, window);
  return normalizeEquipmentCycleList(list)
    .filter((item) => item.nextDue >= ref && item.nextDue <= horizon)
    .sort(byDueDate);
}

/** One-line summary of the whole cycle list. */
export function equipmentCycleSummaryText(list) {
  const clean = normalizeEquipmentCycleList(list);
  if (clean.length === 0) return 'No equipment cycle record yet.';
  return `${clean.length} equipment cycle record${clean.length === 1 ? '' : 's'}; `
    + `next due dates from ${clean.map((item) => item.nextDue).sort()[0]}.`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cycleRowHtml(item) {
  return `<tr><td>${esc(item.item)}</td><td>${esc(item.lastCheck)}</td>`
    + `<td>${esc(item.cycleDays)}</td><td>${esc(item.nextDue)}</td>`
    + `<td>${esc(item.note)}</td></tr>`;
}

function cycleTableHtml(rows) {
  return '<table><thead><tr><th>Item</th><th>Last check</th>'
    + '<th>Cycle (days)</th><th>Next due</th><th>Note</th></tr></thead><tbody>'
    + rows.map(cycleRowHtml).join('') + '</tbody></table>';
}

/**
 * The dated list for a reference date: overdue items first, then
 * due-soon items. An invalid reference date says so plainly.
 */
export function equipmentCycleDueHtml(list, referenceDate, windowDays = 30) {
  const ref = validEquipmentCycleDate(referenceDate);
  if (!ref) return '<p>Pick a real reference date to see what is overdue or due soon.</p>';
  const overdue = overdueEquipmentCycleItems(list, ref);
  const dueSoon = dueSoonEquipmentCycleItems(list, ref, windowDays);
  const overduePart = overdue.length === 0
    ? '<p>No item overdue.</p>'
    : `<p><strong>${overdue.length} overdue item${overdue.length === 1 ? '' : 's'}.</strong></p>`
      + cycleTableHtml(overdue);
  const dueSoonPart = dueSoon.length === 0
    ? '<p>No item due soon.</p>'
    : `<p><strong>${dueSoon.length} item${dueSoon.length === 1 ? '' : 's'} due within ${windowDays} days.</strong></p>`
      + cycleTableHtml(dueSoon);
  return `<h4>Overdue (before ${esc(ref)})</h4>${overduePart}`
    + `<h4>Due soon</h4>${dueSoonPart}`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV for a list of cycle records. */
export function equipmentCycleCsv(list) {
  const rows = normalizeEquipmentCycleList(list);
  const lines = ['id,item,lastCheck,cycleDays,nextDue,note'];
  for (const item of rows) {
    lines.push([item.id, item.item, item.lastCheck, item.cycleDays, item.nextDue, item.note].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** CSV filename for the cycle list. */
export function equipmentCycleFilename() {
  return 'equipment-cycle.csv';
}
