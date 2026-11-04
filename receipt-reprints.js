// Plan 121 (Plan 101-202) — Receipt reprint control.
//
// A receipt can be reprinted any number of times, and without a
// mark a reprint looks exactly like a second payment. This module
// is that mark, and nothing more: every reprint is recorded with
// the original receipt number, the original amount, and the
// reprint date, and reprints are listed per receipt. An original
// receipt shows its reprint count, and a reprint copy always
// carries the REPRINT mark with the original receipt number and
// the original amount.
//
// The fences, stated plainly:
//   - Reprinting never creates a payment, changes a total, or
//     issues a new receipt number. There is no payment, bill, or
//     total field anywhere in a record, and no edit function and
//     no remove function: a reprint record is audit evidence,
//     not a draft.
//   - Receipt content and receipt-number rules are unchanged.
//     This module records reprints only; it never opens, reads,
//     or rewrites any receipt, payment, or numbering record.
//   - Money is integer cents throughout. A plain rupees figure
//     converts exactly once on the way in; a figure already in
//     cents passes through as-is. An unusable figure refuses the
//     whole record instead of being guessed.
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
export function validReprintDate(value) {
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

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

// One money figure: a cents field passes through as-is; otherwise a
// plain rupees figure converts exactly once. Anything else is
// unusable (null), never guessed.
function moneyCents(raw, key) {
  const centsValue = raw[`${key}Cents`];
  if (Number.isInteger(centsValue)) return centsValue;
  const plain = raw[key];
  if (isFiniteNumber(plain)) return Math.round(plain * 100);
  return null;
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

function formatRs(cents) {
  if (!Number.isInteger(cents)) return 'not recorded';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}Rs. ${(abs / 100).toFixed(2)}`;
}

// Normalise one reprint record, or null when half-formed. Unknown
// fields are dropped, so a reprint can never grow a payment, bill,
// or total field. The operator and note are optional text; the
// receipt number, the original amount, and the reprint date are
// mandatory, because a reprint without them proves nothing.
export function normalizeReceiptReprint(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const receiptNumber = text(raw.receiptNumber);
  const reprintDate = validReprintDate(raw.reprintDate ?? raw.date);
  if (!id || !receiptNumber || !reprintDate) return null;
  const amountCents = moneyCents(raw, 'amount');
  if (amountCents === null || amountCents <= 0) return null;
  return Object.freeze({
    id,
    receiptNumber,
    amountCents,
    reprintDate,
    operator: text(raw.operator),
    note: text(raw.note),
  });
}

export function normalizeReceiptReprintList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const reprint = normalizeReceiptReprint(raw);
    if (reprint && !seen.has(reprint.id)) {
      seen.add(reprint.id);
      out.push(reprint);
    }
  }
  return out;
}

function sameReprint(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function byDateThenId(a, b) {
  if (a.reprintDate !== b.reprintDate) return a.reprintDate < b.reprintDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Record a reprint. A duplicate id is never rewritten: an
// identical re-save leaves the list unchanged, and different
// figures for an existing id are refused with the list exactly
// unchanged. There is deliberately no edit or remove function.
export function addReceiptReprint(list, raw) {
  const base = normalizeReceiptReprintList(list);
  const reprint = normalizeReceiptReprint(raw);
  if (!reprint) return base;
  const existing = base.find((item) => item.id === reprint.id);
  if (existing) return sameReprint(existing, reprint) ? base : base;
  return [...base, reprint];
}

export function findReceiptReprint(list, id) {
  return normalizeReceiptReprintList(list).find((item) => item.id === id) ?? null;
}

// All reprints for one receipt number, oldest first. The number
// is matched exactly after trimming, never guessed or normalised
// into a different number.
export function reprintsForReceipt(list, receiptNumber) {
  const number = text(receiptNumber);
  if (!number) return [];
  return normalizeReceiptReprintList(list)
    .filter((item) => item.receiptNumber === number)
    .sort(byDateThenId);
}

export function reprintCountForReceipt(list, receiptNumber) {
  return reprintsForReceipt(list, receiptNumber).length;
}

// Normalise an original receipt as supplied by the caller: its
// number and its amount, nothing else. Null when half-formed, so
// a view can never be built on a guessed number or amount.
export function normalizeOriginalReceipt(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const receiptNumber = text(raw.receiptNumber);
  if (!receiptNumber) return null;
  const amountCents = moneyCents(raw, 'amount');
  if (amountCents === null || amountCents <= 0) return null;
  return Object.freeze({ receiptNumber, amountCents });
}

// The original receipt with its reprint count: the view the
// acceptance asks for. The original number and amount are carried
// verbatim from the caller-supplied original, never from a
// reprint record, so a reprint can never restate the original.
export function originalReceiptView(original, list) {
  const clean = normalizeOriginalReceipt(original);
  if (!clean) return null;
  const reprints = reprintsForReceipt(list, clean.receiptNumber);
  return {
    receiptNumber: clean.receiptNumber,
    amountCents: clean.amountCents,
    reprintCount: reprints.length,
    lastReprintDate: reprints.length ? reprints[reprints.length - 1].reprintDate : null,
    reprints,
  };
}

// A reprint copy: always marked REPRINT, always carrying the
// original receipt number and the original amount, plus the
// reprint count and the latest reprint date. It issues no new
// number and creates no payment; it is a marked copy, nothing
// more. Null when the original is half-formed.
export function reprintCopy(original, list) {
  const view = originalReceiptView(original, list);
  if (!view) return null;
  return {
    mark: 'REPRINT',
    receiptNumber: view.receiptNumber,
    amountCents: view.amountCents,
    reprintCount: view.reprintCount,
    lastReprintDate: view.lastReprintDate,
  };
}

export function receiptReprintSummary(list) {
  const reprints = normalizeReceiptReprintList(list);
  const receipts = new Set(reprints.map((item) => item.receiptNumber));
  return { total: reprints.length, receiptCount: receipts.size };
}

export function receiptReprintSummaryText(list) {
  const summary = receiptReprintSummary(list);
  if (summary.total === 0) return 'No receipt reprint recorded yet.';
  return `${summary.total} reprint(s) recorded for ${summary.receiptCount} receipt(s).`;
}

export function receiptReprintHtml(reprint) {
  const clean = normalizeReceiptReprint(reprint);
  if (!clean) return '';
  return `<div class="receipt-reprint-row"><strong>REPRINT</strong> — receipt ` +
    `${escapeHtml(clean.receiptNumber)} — ${formatRs(clean.amountCents)} — ` +
    `reprinted ${escapeHtml(clean.reprintDate)}` +
    `${clean.operator ? ` by ${escapeHtml(clean.operator)}` : ''}` +
    `${clean.note ? ` — ${escapeHtml(clean.note)}` : ''}</div>`;
}

export function originalReceiptHtml(view) {
  if (!view) return '';
  const rows = view.reprints.map((item) => receiptReprintHtml(item)).join('');
  return `<div class="receipt-original-row">Original receipt ` +
    `${escapeHtml(view.receiptNumber)} — ${formatRs(view.amountCents)} — ` +
    `${view.reprintCount} reprint(s)` +
    `${view.lastReprintDate ? `, last reprinted ${escapeHtml(view.lastReprintDate)}` : ', never reprinted'}</div>${rows}`;
}

export function receiptReprintCsv(list) {
  const reprints = normalizeReceiptReprintList(list);
  const header = 'id,receipt_number,amount_cents,reprint_date,operator,note';
  const rows = reprints.map((item) => [
    item.id, item.receiptNumber, item.amountCents, item.reprintDate,
    item.operator, item.note,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function receiptReprintFilename() {
  return 'receipt-reprints.csv';
}
