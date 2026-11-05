// Plan 288 (Plan 203-350) — Supplier performance note.
//
// Suppliers are reordered from habit, with no written record of who
// delivered on time and whose goods failed, so a bad supplier keeps
// getting orders. This module adds only the missing piece: one
// performance note per delivery — the supplier, the item, the
// promised date, the delivered date, a quality note in plain words,
// and who recorded it. Notes are listed per supplier with on-time
// and quality visible, so the next order is a decision, not a habit.
//
// What this module is NOT, stated plainly:
//   - It is not the vendor register. That register holds the
//     suppliers themselves; this module only names a supplier in
//     plain words as a reference, and the register is neither read
//     nor rewritten here.
//   - It is not the warranty and supplier-return log. That log
//     tracks faulty goods sent back; this module only records how
//     a delivery performed, and the return log is neither read nor
//     rewritten here.
//   - It is not a stock record. A note never changes any stock
//     total, bill, payment, or vendor record by itself; creating a
//     note writes one record and nothing else.
//   - It is not a live note. A past note is read-only: there is
//     no edit function, only record, find, and remove, so a wrong
//     note is removed and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every note,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id, no supplier, no item, no strict promised
//     date, no strict delivered date, or no recorder is refused
//     outright. Unknown fields are dropped, so a note can never
//     grow a bill, payment, stock, or vendor field.
//   - A duplicate id is never rewritten.
//   - On time is a plain date comparison: delivered on or before
//     the promised date is on time, anything later is late, and
//     the days late are plain calendar days.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validSupplierPerformanceDate(value) {
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

function parseStrictDate(value) {
  if (!validSupplierPerformanceDate(value)) return null;
  const parts = value.split('-');
  return { year: Number(parts[0]), month: Number(parts[1]), day: Number(parts[2]) };
}

/**
 * Plain calendar day count for a strict date, by integer arithmetic
 * only — no clock, no calendar object. Two dates on the same day
 * give the same count, so their difference is the days between them.
 */
export function supplierPerformanceDayCount(value) {
  const parsed = parseStrictDate(value);
  if (!parsed) return null;
  const y = parsed.month <= 2 ? parsed.year - 1 : parsed.year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = parsed.month > 2 ? parsed.month - 3 : parsed.month + 9;
  const doy = Math.floor((153 * mp + 2) / 5) + parsed.day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/**
 * One performance note, or null when half-formed. A note needs an
 * id, a supplier, an item, a strict promised date, a strict
 * delivered date, and a recorder. The quality note is plain words
 * and optional; unknown fields are dropped and the input is never
 * mutated.
 */
export function normalizeSupplierPerformanceNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const supplier = text(raw.supplier);
  const item = text(raw.item);
  const promisedDate = text(raw.promisedDate);
  const deliveredDate = text(raw.deliveredDate);
  const recordedBy = text(raw.recordedBy);
  if (!id || !supplier || !item || !recordedBy) return null;
  if (!validSupplierPerformanceDate(promisedDate)) return null;
  if (!validSupplierPerformanceDate(deliveredDate)) return null;
  return { id, supplier, item, promisedDate, deliveredDate, quality: text(raw.quality), recordedBy };
}

/** Normalised notes only; a duplicate id is never rewritten, the first stays. */
export function normalizeSupplierPerformanceList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeSupplierPerformanceNote(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findSupplierPerformanceNote(list, id) {
  const clean = normalizeSupplierPerformanceList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordSupplierPerformanceNote(list, raw) {
  const clean = normalizeSupplierPerformanceList(list);
  const entry = normalizeSupplierPerformanceNote(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeSupplierPerformanceNote(list, id) {
  const clean = normalizeSupplierPerformanceList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

/** Notes in promised-date order, then supplier, then id, so the same list always reads the same way. */
export function supplierPerformanceSorted(list) {
  const clean = normalizeSupplierPerformanceList(list);
  return [...clean].sort((a, b) => {
    if (a.promisedDate !== b.promisedDate) return a.promisedDate < b.promisedDate ? -1 : 1;
    const aSupplier = a.supplier.toLowerCase();
    const bSupplier = b.supplier.toLowerCase();
    if (aSupplier !== bSupplier) return aSupplier < bSupplier ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** True when the delivery arrived on or before the promised date. */
export function supplierPerformanceOnTime(entry) {
  const clean = normalizeSupplierPerformanceNote(entry);
  if (!clean) return false;
  return clean.deliveredDate <= clean.promisedDate;
}

/** Whole calendar days late, or 0 when on time or half-formed. */
export function supplierPerformanceDaysLate(entry) {
  const clean = normalizeSupplierPerformanceNote(entry);
  if (!clean) return 0;
  const promised = supplierPerformanceDayCount(clean.promisedDate);
  const delivered = supplierPerformanceDayCount(clean.deliveredDate);
  if (promised === null || delivered === null) return 0;
  return Math.max(0, delivered - promised);
}

/** Notes for one supplier, case-insensitive, in promised-date order. */
export function supplierPerformancesForSupplier(list, supplier) {
  const wanted = text(supplier).toLowerCase();
  if (!wanted) return [];
  return supplierPerformanceSorted(list).filter((entry) => entry.supplier.toLowerCase() === wanted);
}

/** Supplier names in first-seen order, keeping the first spelling. */
export function supplierPerformanceSuppliers(list) {
  const clean = normalizeSupplierPerformanceList(list);
  const seen = new Map();
  for (const entry of clean) {
    const key = entry.supplier.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.supplier);
  }
  return [...seen.values()];
}

export function supplierPerformanceSummaryText(list) {
  const clean = normalizeSupplierPerformanceList(list);
  if (clean.length === 0) return 'No supplier performance notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  const onTime = clean.filter((entry) => supplierPerformanceOnTime(entry)).length;
  const late = clean.length - onTime;
  return `${clean.length} supplier performance ${word} recorded. ${onTime} on time, ${late} late.`;
}

/** Plain-words text for one note: supplier, item, both dates, on-time or days late, quality, recorder. */
export function supplierPerformanceText(entry) {
  const clean = normalizeSupplierPerformanceNote(entry);
  if (!clean) return 'No supplier performance note recorded.';
  const timing = supplierPerformanceOnTime(clean)
    ? 'on time'
    : `${supplierPerformanceDaysLate(clean)} days late`;
  const quality = clean.quality ? ` — quality: ${clean.quality}` : ' — quality: not noted';
  return `${clean.supplier} — ${clean.item} — promised ${clean.promisedDate}, delivered ${clean.deliveredDate} — ${timing}${quality} — recorded by ${clean.recordedBy}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function supplierPerformanceHtml(entry) {
  const clean = normalizeSupplierPerformanceNote(entry);
  if (!clean) return '<p>No supplier performance note recorded.</p>';
  return `<p>${escapeHtml(supplierPerformanceText(clean))}</p>`;
}

export function supplierPerformanceAllHtml(list) {
  const rows = supplierPerformanceSorted(list);
  if (!rows.length) return '<p>No supplier performance notes recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(supplierPerformanceText(entry))}</li>`).join('')}</ul>`;
}

export function supplierPerformancesForSupplierHtml(list, supplier) {
  const rows = supplierPerformancesForSupplier(list, supplier);
  if (!rows.length) return '<p>No performance notes for this supplier.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(supplierPerformanceText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function supplierPerformanceCsv(list) {
  const rows = supplierPerformanceSorted(list);
  const lines = ['"id","supplier","item","promised date","delivered date","on time","days late","quality","recorded by"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.supplier),
      csvCell(entry.item),
      csvCell(entry.promisedDate),
      csvCell(entry.deliveredDate),
      csvCell(supplierPerformanceOnTime(entry) ? 'yes' : 'no'),
      csvCell(supplierPerformanceDaysLate(entry)),
      csvCell(entry.quality),
      csvCell(entry.recordedBy),
    ].join(','));
  }
  return lines.join('\n');
}

export function supplierPerformanceFilename() {
  return 'supplier-performance.csv';
}
