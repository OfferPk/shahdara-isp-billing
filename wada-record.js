// Profile polish #5 — Wada record: one promise per customer promise.
//
// The app already holds a single live promise on the customer record
// (promise date, amount, note) with its own chip dialog, and the
// earlier promise-history store keeps a separate history that
// requires an amount and records only a paid date. Neither of those
// covers what this module adds, and this module never reads or writes
// either of them, nor any bill, payment, or customer record:
//
//   - a wada may carry NO amount at all ("pay on the 7th" promises
//     the whole bill, not a figure), so the amount is optional here;
//   - a wada closes with an explicit outcome — kept (closed on or
//     before the promised date), kept late (closed after it), or
//     broken (overdue and explicitly marked not kept);
//   - the customer's wada health (kept on time / kept late / broken)
//     is counted from these outcomes, in plain words, with no scores
//     and no percentages;
//   - every promised date carries its weekday, computed from the
//     calendar alone, so a promised "7th" can never again be read as
//     a Monday when it is a Saturday.
//
// A record is { id, customer, promisedDate, amountPromised, note,
// status, closedDate }. status is 'pending' while the wada is open
// and 'kept' | 'keptLate' | 'broken' once closed. Past wadas are
// read-only: there is no edit function, only record, find, close,
// and remove. Closing a wada changes only that wada's own status
// and closed date. This module is pure and import-free: the caller
// supplies every record, and the module never reads storage, the
// clock, or the network, and never mutates an input. Dates compare
// as YYYY-MM-DD strings, and the weekday comes from integer
// arithmetic on the calendar (Zeller's congruence), so no clock
// object is ever used.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_NAMES = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const WADA_STATUSES = Object.freeze({
  PENDING: 'pending',
  KEPT: 'kept',
  KEPT_LATE: 'keptLate',
  BROKEN: 'broken'
});

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isStrictWadaDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day >= 1 && day <= limit;
}

function parseWadaDateParts(dateStr) {
  if (!isStrictWadaDate(dateStr)) return null;
  const [year, month, day] = dateStr.trim().split('-').map(Number);
  return { year, month, day };
}

/**
 * Weekday name for a strict date, from integer calendar arithmetic
 * only (Zeller's congruence for the Gregorian calendar). Returns
 * 'Monday' .. 'Sunday', or null for an invalid date.
 */
export function wadaWeekdayName(dateStr) {
  const parts = parseWadaDateParts(dateStr);
  if (!parts) return null;
  let month = parts.month;
  let year = parts.year;
  if (month < 3) {
    month += 12;
    year -= 1;
  }
  const k = year % 100;
  const j = Math.floor(year / 100);
  const h = (parts.day + Math.floor(13 * (month + 1) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) + 5 * j) % 7;
  return WEEKDAY_NAMES[h];
}

/**
 * A promised date with its weekday, e.g. "7 Nov 2026 — Saturday".
 * Returns '' for an invalid date.
 */
export function formatWadaDate(dateStr) {
  const parts = parseWadaDateParts(dateStr);
  if (!parts) return '';
  const weekday = wadaWeekdayName(dateStr);
  return `${parts.day} ${MONTH_NAMES[parts.month - 1]} ${parts.year} — ${weekday}`;
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function cleanKey(value) {
  return cleanText(value).toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A promised amount in whole rupees, or null when none was given.
 * Returns undefined when an amount was given but is not a whole
 * positive number of rupees — such a wada is refused.
 */
function cleanWholeRupees(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) return undefined;
  return amount;
}

function cleanStatus(value) {
  const status = cleanText(value);
  if (status === WADA_STATUSES.KEPT) return WADA_STATUSES.KEPT;
  if (status === WADA_STATUSES.KEPT_LATE) return WADA_STATUSES.KEPT_LATE;
  if (status === WADA_STATUSES.BROKEN) return WADA_STATUSES.BROKEN;
  return WADA_STATUSES.PENDING;
}

export function normalizeWadaRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const id = cleanText(record.id);
  const customer = cleanText(record.customer);
  const promisedDate = cleanText(record.promisedDate);
  if (!id || !customer || !isStrictWadaDate(promisedDate)) return null;
  const amountPromised = cleanWholeRupees(record.amountPromised);
  if (amountPromised === undefined) return null;
  const status = cleanStatus(record.status);
  const closedRaw = cleanText(record.closedDate);
  const closedDate = closedRaw && isStrictWadaDate(closedRaw) ? closedRaw : '';
  if (status !== WADA_STATUSES.PENDING && !closedDate) return null;
  if (status === WADA_STATUSES.PENDING && closedDate) return null;
  return {
    id,
    customer,
    promisedDate,
    amountPromised,
    note: cleanText(record.note),
    status,
    closedDate
  };
}

export function normalizeWadaRecordList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const record = normalizeWadaRecord(item);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

export function findWadaRecord(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return null;
  return normalizeWadaRecordList(list).find((record) => record.id === wanted) || null;
}

export function recordWadaRecord(list, record) {
  const base = normalizeWadaRecordList(list);
  const next = normalizeWadaRecord(record);
  if (!next) return base;
  if (base.some((record) => record.id === next.id)) return base;
  return [...base, next];
}

export function removeWadaRecord(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return normalizeWadaRecordList(list);
  return normalizeWadaRecordList(list).filter((record) => record.id !== wanted);
}

function closeWadaRecord(list, id, closedDate, outcome) {
  const base = normalizeWadaRecordList(list);
  const wanted = cleanText(id);
  const closed = cleanText(closedDate);
  if (!wanted || !isStrictWadaDate(closed)) return base;
  return base.map((record) => {
    if (record.id !== wanted || record.status !== WADA_STATUSES.PENDING) return record;
    const status = outcome === 'kept'
      ? (closed <= record.promisedDate ? WADA_STATUSES.KEPT : WADA_STATUSES.KEPT_LATE)
      : WADA_STATUSES.BROKEN;
    return { ...record, status, closedDate: closed };
  });
}

/**
 * Mark a pending wada kept. The outcome is derived from the closed
 * date against the promised date: closed on or before the promised
 * date reads as kept, closed after it reads as kept late. A wada
 * that is already closed, or a bad closed date, leaves the list
 * unchanged.
 */
export function markWadaRecordKept(list, id, closedDate) {
  return closeWadaRecord(list, id, closedDate, 'kept');
}

/**
 * Mark a pending wada broken (overdue and explicitly not kept).
 * A wada that is already closed, or a bad closed date, leaves the
 * list unchanged.
 */
export function markWadaRecordBroken(list, id, closedDate) {
  return closeWadaRecord(list, id, closedDate, 'broken');
}

function byPromisedThenId(a, b) {
  if (a.promisedDate !== b.promisedDate) return a.promisedDate < b.promisedDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function wadaRecordsSorted(list) {
  return normalizeWadaRecordList(list).sort(byPromisedThenId);
}

export function wadaRecordsForCustomer(list, customerId) {
  const wanted = cleanKey(customerId);
  if (!wanted) return [];
  return wadaRecordsSorted(list).filter((record) => cleanKey(record.customer) === wanted);
}

/** A customer's still-open wadas, earliest due date first. */
export function activeWadaRecordsForCustomer(list, customerId) {
  return wadaRecordsForCustomer(list, customerId)
    .filter((record) => record.status === WADA_STATUSES.PENDING);
}

/**
 * Banner state of one wada against a caller-supplied today date:
 * 'onTrack' when pending and due today or later, 'overdue' when
 * pending and the due date has passed, '' when already closed.
 */
export function wadaRecordBannerState(record, today) {
  const normalized = normalizeWadaRecord(record);
  if (!normalized) return '';
  if (normalized.status !== WADA_STATUSES.PENDING) return '';
  const day = cleanText(today);
  if (!isStrictWadaDate(day)) return 'onTrack';
  return normalized.promisedDate < day ? 'overdue' : 'onTrack';
}

/** Wada health for one customer: counts only, in plain words, no scores. */
export function wadaHealthForCustomer(list, customerId) {
  const records = wadaRecordsForCustomer(list, customerId);
  const health = { kept: 0, keptLate: 0, broken: 0, pending: 0, total: records.length };
  for (const record of records) {
    if (record.status === WADA_STATUSES.KEPT) health.kept += 1;
    else if (record.status === WADA_STATUSES.KEPT_LATE) health.keptLate += 1;
    else if (record.status === WADA_STATUSES.BROKEN) health.broken += 1;
    else health.pending += 1;
  }
  return health;
}

export function wadaHealthText(list, customerId) {
  const health = wadaHealthForCustomer(list, customerId);
  if (!health.total) return 'No wadas recorded for this customer.';
  return `Wada health: ${health.kept} kept on time · ${health.keptLate} kept late · ${health.broken} broken · ${health.pending} still open.`;
}

export function wadaRecordText(record, today) {
  const normalized = normalizeWadaRecord(record);
  if (!normalized) return '';
  const amountPart = normalized.amountPromised !== null ? `Rs ${normalized.amountPromised} ` : '';
  const notePart = normalized.note ? ` — “${normalized.note}”` : '';
  const state = wadaRecordBannerState(normalized, today);
  if (normalized.status === WADA_STATUSES.KEPT) {
    return `${amountPart}promised by ${formatWadaDate(normalized.promisedDate)} — kept on ${normalized.closedDate}${notePart}.`;
  }
  if (normalized.status === WADA_STATUSES.KEPT_LATE) {
    return `${amountPart}promised by ${formatWadaDate(normalized.promisedDate)} — kept late on ${normalized.closedDate}${notePart}.`;
  }
  if (normalized.status === WADA_STATUSES.BROKEN) {
    return `${amountPart}promised by ${formatWadaDate(normalized.promisedDate)} — broken${notePart}.`;
  }
  const overdue = state === 'overdue' ? ' — overdue' : '';
  return `${amountPart}promised by ${formatWadaDate(normalized.promisedDate)}${overdue}${notePart}.`;
}

export function wadaRecordHtml(record, today) {
  const normalized = normalizeWadaRecord(record);
  if (!normalized) return '';
  const state = wadaRecordBannerState(normalized, today);
  const stateClass = state === 'overdue' ? 'wada-banner-overdue' : state === 'onTrack' ? 'wada-banner-on-track' : '';
  const stateLabel = state === 'overdue' ? ' · Overdue' : '';
  const amountPart = normalized.amountPromised !== null ? `Rs ${normalized.amountPromised} ` : '';
  const notePart = normalized.note ? ` — “${escapeHtml(normalized.note)}”` : '';
  const outcomePart = normalized.status === WADA_STATUSES.KEPT
    ? ` — kept on ${escapeHtml(normalized.closedDate)}`
    : normalized.status === WADA_STATUSES.KEPT_LATE
      ? ` — kept late on ${escapeHtml(normalized.closedDate)}`
      : normalized.status === WADA_STATUSES.BROKEN
        ? ' — broken'
        : '';
  return `<p class="wada-banner-row ${stateClass}"><span>${escapeHtml(amountPart)}promised by ${escapeHtml(formatWadaDate(normalized.promisedDate))}${escapeHtml(stateLabel)}${escapeHtml(outcomePart)}${notePart}</span></p>`;
}

/**
 * Banner rows for a customer's still-open wadas, earliest due first.
 * Each row carries its own Poora hua / Wada toota actions; the host
 * wires those buttons and re-renders after each close.
 */
export function wadaBannerHtml(records, today) {
  const active = (Array.isArray(records) ? records : [])
    .map((record) => normalizeWadaRecord(record))
    .filter((record) => record && record.status === WADA_STATUSES.PENDING)
    .sort(byPromisedThenId);
  return active.map((record) => {
    const state = wadaRecordBannerState(record, today);
    const stateClass = state === 'overdue' ? 'wada-banner-overdue' : 'wada-banner-on-track';
    const stateLabel = state === 'overdue' ? ' · Overdue' : '';
    const amountPart = record.amountPromised !== null ? `Rs ${record.amountPromised} ` : '';
    const notePart = record.note ? ` — “${escapeHtml(record.note)}”` : '';
    return `<div class="wada-banner-row ${stateClass}"><span>${escapeHtml(amountPart)}promised by ${escapeHtml(formatWadaDate(record.promisedDate))}${escapeHtml(stateLabel)}${notePart}</span><span class="wada-banner-actions"><button type="button" class="wada-banner-kept" data-wada-kept="${escapeHtml(record.id)}">Poora hua</button><button type="button" class="wada-banner-broken" data-wada-broken="${escapeHtml(record.id)}">Wada toota</button></span></div>`;
  }).join('');
}

/** History rows for a customer's closed wadas, with each outcome named. */
export function wadaHistoryHtml(records, today) {
  const closed = (Array.isArray(records) ? records : [])
    .map((record) => normalizeWadaRecord(record))
    .filter((record) => record && record.status !== WADA_STATUSES.PENDING)
    .sort(byPromisedThenId);
  if (!closed.length) return '';
  return `<ul class="wada-history">${closed.map((record) => `<li>${escapeHtml(wadaRecordText(record, today))} <button type="button" class="wada-history-remove" data-wada-remove="${escapeHtml(record.id)}">Remove</button></li>`).join('')}</ul>`;
}

export function wadaRecordCsv(list) {
  const rows = [['id', 'customer', 'promised_date', 'amount_promised', 'note', 'status', 'closed_date']];
  for (const record of wadaRecordsSorted(list)) {
    rows.push([
      record.id,
      record.customer,
      record.promisedDate,
      record.amountPromised !== null ? String(record.amountPromised) : '',
      record.note,
      record.status,
      record.closedDate
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function wadaRecordFilename() {
  return 'wada-records.csv';
}
