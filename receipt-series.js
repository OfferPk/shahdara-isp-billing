// Plan 122 (Plan 101-202) — Receipt series per collector.
//
// Receipt numbers used to come from one shared pool, so a missing
// number could not be traced to the collector who held that book.
// This module assigns number ranges only: one series record per
// collector, with a start number, an end number, the date issued,
// and the date returned. Every receipt number falls inside exactly
// one issued series, because a new series that overlaps any
// existing range is refused outright. A returned series shows its
// used, void, and unused numbers, and an unused number from a
// returned series is never reissued to another collector without
// a recorded reason.
//
// The fences, stated plainly:
//   - This module assigns ranges only. It never changes receipt
//     content, payment rules, or the gap audit (Plan 91): that
//     module is neither read nor rewritten, and no receipt,
//     payment, or gap record is ever opened here. Used and void
//     numbers arrive as caller-supplied lists, never by reading
//     another record.
//   - A series range is never edited in place. The only later
//     change to a series is its return date, recorded once; a
//     returned series can never be un-returned or re-dated.
//   - Numbers are plain integers. A range with a non-positive
//     start, an end below its start, or an impossible date is
//     refused outright, never repaired.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Strict YYYY-MM-DD calendar date, or null (2026-02-30 is not a date). */
export function validSeriesDate(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  const max = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > max) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Normalise one series record, or null when half-formed. Unknown
// fields are dropped, so a series can never grow a receipt,
// payment, or gap field. The return date is optional; when present
// it must be a real date on or after the issue date, because a
// book cannot come back before it went out.
export function normalizeReceiptSeries(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const collector = text(raw.collector);
  const startNumber = raw.startNumber;
  const endNumber = raw.endNumber;
  const dateIssued = validSeriesDate(raw.dateIssued ?? raw.issuedDate);
  if (!id || !collector || !isPositiveInt(startNumber) || !isPositiveInt(endNumber)) return null;
  if (endNumber < startNumber) return null;
  if (!dateIssued) return null;
  let dateReturned = null;
  if (raw.dateReturned !== undefined && raw.dateReturned !== null && text(raw.dateReturned) !== '') {
    dateReturned = validSeriesDate(raw.dateReturned);
    if (!dateReturned || dateReturned < dateIssued) return null;
  }
  return Object.freeze({
    id,
    collector,
    startNumber,
    endNumber,
    dateIssued,
    dateReturned,
  });
}

export function normalizeReceiptSeriesList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const series = normalizeReceiptSeries(raw);
    if (series && !seen.has(series.id)) {
      seen.add(series.id);
      out.push(series);
    }
  }
  return out;
}

export function findReceiptSeries(list, id) {
  const clean = normalizeReceiptSeriesList(list);
  return clean.find((item) => item.id === id) ?? null;
}

export function seriesForCollector(list, collector) {
  const name = text(collector);
  if (!name) return [];
  return normalizeReceiptSeriesList(list).filter((item) => item.collector === name);
}

// True when two ranges share at least one number. Ranges are
// inclusive on both ends, so touching at one number is an overlap.
export function seriesOverlap(a, b) {
  return a.startNumber <= b.endNumber && b.startNumber <= a.endNumber;
}

// The one series containing a number, or null. Because overlapping
// series are refused at add time, there is never more than one.
export function seriesForNumber(list, number) {
  if (!isPositiveInt(number)) return null;
  return normalizeReceiptSeriesList(list).find(
    (item) => number >= item.startNumber && number <= item.endNumber,
  ) ?? null;
}

// Add a series, or return the list unchanged when refused: a
// duplicate id, or a range overlapping any existing series. A
// refused add never rewrites anything, and an identical re-save
// is simply unchanged.
export function addReceiptSeries(list, raw) {
  const clean = normalizeReceiptSeriesList(list);
  const series = normalizeReceiptSeries(raw);
  if (!series) return clean;
  if (clean.some((item) => item.id === series.id)) return clean;
  if (clean.some((item) => seriesOverlap(item, series))) return clean;
  return [...clean, series];
}

// Record a series as returned, or return the list unchanged when
// refused: unknown series, already returned, or a bad return date
// (impossible, or before the issue date). There is no un-return
// and no re-date: a returned series stays returned.
export function returnReceiptSeries(list, id, dateReturned) {
  const clean = normalizeReceiptSeriesList(list);
  const date = validSeriesDate(dateReturned);
  if (!date) return clean;
  const index = clean.findIndex((item) => item.id === id);
  if (index < 0) return clean;
  const series = clean[index];
  if (series.dateReturned) return clean;
  if (date < series.dateIssued) return clean;
  const next = [...clean];
  next[index] = Object.freeze({ ...series, dateReturned: date });
  return next;
}

// Normalise one reissue record, or null when half-formed. A
// reissue names exactly one number, the series it came from, the
// collector it goes to, a recorded reason, and a real date.
// Without the reason there is no reissue at all.
export function normalizeReissue(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const number = raw.number;
  const fromSeriesId = text(raw.fromSeriesId);
  const toCollector = text(raw.toCollector);
  const reason = text(raw.reason);
  const date = validSeriesDate(raw.date ?? raw.reissueDate);
  if (!id || !isPositiveInt(number) || !fromSeriesId || !toCollector || !reason || !date) return null;
  return Object.freeze({ id, number, fromSeriesId, toCollector, reason, date });
}

export function normalizeReissueList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const record = normalizeReissue(raw);
    if (record && !seen.has(record.id)) {
      seen.add(record.id);
      out.push(record);
    }
  }
  return out;
}

// Reissue an unused number from a returned series to another
// collector, or return the reissue list unchanged when refused:
// the number is not inside a returned series, the number is
// already used or void (caller-supplied lists), the number was
// already reissued, or the record itself is half-formed. The
// series record is never touched: the reissue is its own record.
export function reissueUnusedNumber(seriesList, reissueList, usedNumbers, voidNumbers, raw) {
  const clean = normalizeReissueList(reissueList);
  const record = normalizeReissue(raw);
  if (!record) return clean;
  const series = findReceiptSeries(seriesList, record.fromSeriesId);
  if (!series || !series.dateReturned) return clean;
  if (record.number < series.startNumber || record.number > series.endNumber) return clean;
  const used = Array.isArray(usedNumbers) ? usedNumbers : [];
  const voided = Array.isArray(voidNumbers) ? voidNumbers : [];
  if (used.includes(record.number) || voided.includes(record.number)) return clean;
  if (clean.some((item) => item.number === record.number)) return clean;
  return [...clean, record];
}

export function reissueForNumber(list, number) {
  if (!isPositiveInt(number)) return null;
  return normalizeReissueList(list).find((item) => item.number === number) ?? null;
}

// The returned-series breakdown: used, void, and unused numbers
// for one returned series, from caller-supplied used/void lists.
// A series that has not been returned has no breakdown at all —
// its numbers are still out in the book, not settled.
export function returnedSeriesBreakdown(series, usedNumbers, voidNumbers) {
  if (!series || !series.dateReturned) return null;
  const usedSet = new Set(Array.isArray(usedNumbers) ? usedNumbers.filter(isPositiveInt) : []);
  const voidSet = new Set(Array.isArray(voidNumbers) ? voidNumbers.filter(isPositiveInt) : []);
  const used = [];
  const voided = [];
  const unused = [];
  for (let n = series.startNumber; n <= series.endNumber; n += 1) {
    if (usedSet.has(n)) used.push(n);
    else if (voidSet.has(n)) voided.push(n);
    else unused.push(n);
  }
  return Object.freeze({
    id: series.id,
    collector: series.collector,
    startNumber: series.startNumber,
    endNumber: series.endNumber,
    total: series.endNumber - series.startNumber + 1,
    used,
    voided,
    unused,
  });
}

export function seriesCount(list) {
  return normalizeReceiptSeriesList(list).length;
}

export function receiptSeriesSummaryText(list) {
  const clean = normalizeReceiptSeriesList(list);
  const returned = clean.filter((item) => item.dateReturned).length;
  return `${clean.length} receipt series recorded, ${returned} returned.`;
}

export function receiptSeriesHtml(item) {
  const status = item.dateReturned ? `Returned ${escapeHtml(item.dateReturned)}` : 'Out with collector';
  return `<div class="series-row"><strong>${escapeHtml(item.collector)}</strong> — numbers ${item.startNumber} to ${item.endNumber} — issued ${escapeHtml(item.dateIssued)} — ${status}</div>`;
}

export function reissueHtml(item) {
  return `<div class="series-row">Number ${item.number} reissued from series ${escapeHtml(item.fromSeriesId)} to ${escapeHtml(item.toCollector)} on ${escapeHtml(item.date)} — reason: ${escapeHtml(item.reason)}</div>`;
}

export function receiptSeriesCsv(list) {
  const rows = [['id', 'collector', 'start_number', 'end_number', 'date_issued', 'date_returned']];
  for (const item of normalizeReceiptSeriesList(list)) {
    rows.push([item.id, item.collector, item.startNumber, item.endNumber, item.dateIssued, item.dateReturned ?? '']);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function reissueCsv(list) {
  const rows = [['id', 'number', 'from_series', 'to_collector', 'reason', 'date']];
  for (const item of normalizeReissueList(list)) {
    rows.push([item.id, item.number, item.fromSeriesId, item.toCollector, item.reason, item.date]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function receiptSeriesFilename() {
  return 'receipt-series.csv';
}

export function reissueFilename() {
  return 'receipt-series-reissues.csv';
}
