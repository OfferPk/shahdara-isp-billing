// Plan 120 (Plan 101-202) — Bank deposit slip record.
//
// Cash handed to the bank has no link back to the collections it
// came from, so a deposit that does not arrive cannot be traced to
// a day's takings. This module is that link, and nothing more: one
// record per bank deposit, naming the slip or reference number, the
// collector, the date, the amount, and the collection days it
// covers. It records the deposit only.
//
// The fences, stated plainly:
//   - A slip never changes a payment or a handover figure. There
//     is no edit function and no remove function, and no payment,
//     handover, bill, or total field anywhere in a record.
//   - Slips for a period sum to a deposited total, and that sum is
//     checked against a caller-supplied deposited figure — the
//     figure from the month-end record is typed or supplied by
//     the caller, never opened, read, or rewritten here. A
//     mismatch is reported plainly, never corrected.
//   - A slip number cannot be reused silently: a second slip
//     carrying a slip number already on record is refused unless
//     it carries a recorded explanation for the reuse, stored on
//     the second slip itself.
//   - Money is integer cents throughout. A plain rupees figure
//     converts exactly once on the way in; a figure already in
//     cents passes through as-is. An unusable figure refuses the
//     whole record instead of being guessed.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Strict YYYY-MM-DD calendar date, or null (2026-02-30 is not a date). */
export function validDepositSlipDate(value) {
  if (typeof value !== 'string') return null;
  const m = DATE_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const max = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day < 1 || day > max) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Strict YYYY-MM month, or null. */
export function validDepositSlipMonth(value) {
  if (typeof value !== 'string') return null;
  const m = MONTH_RE.exec(value.trim());
  return m ? `${m[1]}-${m[2]}` : null;
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

// Covered collection days: an array of strict dates, deduped and
// sorted, or null when the input carries no usable day at all. A
// slip with no covered day is half-formed, never assumed.
function coveredDays(raw) {
  const input = raw.coveredDates ?? raw.coveredDays;
  if (!Array.isArray(input)) return null;
  const days = [];
  const seen = new Set();
  for (const value of input) {
    const date = validDepositSlipDate(value);
    if (date && !seen.has(date)) {
      seen.add(date);
      days.push(date);
    }
  }
  if (days.length === 0) return null;
  return days.sort();
}

// Normalise one slip, or null when half-formed. Unknown fields
// are dropped, so a slip can never grow a payment, handover, bill,
// or total field.
export function normalizeDepositSlip(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = validDepositSlipDate(raw.date);
  const slipNumber = text(raw.slipNumber);
  const collector = text(raw.collector);
  if (!id || !date || !slipNumber || !collector) return null;
  const amountCents = moneyCents(raw, 'amount');
  if (amountCents === null || amountCents <= 0) return null;
  const covered = coveredDays(raw);
  if (!covered) return null;
  return Object.freeze({
    id,
    date,
    month: date.slice(0, 7),
    amountCents,
    slipNumber,
    collector,
    coveredDates: covered,
    bank: text(raw.bank),
    reuseExplanation: text(raw.reuseExplanation),
  });
}

export function normalizeDepositSlipList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of list) {
    const slip = normalizeDepositSlip(raw);
    if (slip && !seen.has(slip.id)) {
      seen.add(slip.id);
      out.push(slip);
    }
  }
  return out;
}

function sameSlip(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Add a slip. A duplicate id is never rewritten: an identical
// re-save leaves the list unchanged, and different figures for an
// existing id are refused with the list exactly unchanged. A slip
// number already on record needs a recorded reuse explanation on
// the new slip itself, or the slip is refused outright.
export function addDepositSlip(list, raw) {
  const base = normalizeDepositSlipList(list);
  const slip = normalizeDepositSlip(raw);
  if (!slip) return base;
  const existing = base.find((item) => item.id === slip.id);
  if (existing) return sameSlip(existing, slip) ? base : base;
  const reused = base.find((item) => item.slipNumber === slip.slipNumber);
  if (reused && !slip.reuseExplanation) return base;
  return [...base, slip];
}

export function findDepositSlip(list, id) {
  return normalizeDepositSlipList(list).find((item) => item.id === id) ?? null;
}

export function depositSlipsForMonth(list, month) {
  const valid = validDepositSlipMonth(month);
  if (!valid) return [];
  return normalizeDepositSlipList(list).filter((item) => item.month === valid);
}

// Slips for a period sum to one deposited total, in integer cents.
export function depositedTotalForMonth(list, month) {
  return depositSlipsForMonth(list, month)
    .reduce((sum, item) => sum + item.amountCents, 0);
}

// Check a month's slips against a caller-supplied deposited
// figure. Agreement is reported plainly; a mismatch is never
// corrected here, and an unusable figure gives no answer at all
// rather than a guessed one.
export function verifyAgainstDepositedTotal(list, month, depositedCents) {
  const valid = validDepositSlipMonth(month);
  if (!valid) return null;
  if (!Number.isInteger(depositedCents)) return null;
  const slipsTotalCents = depositedTotalForMonth(list, month);
  const differenceCents = depositedCents - slipsTotalCents;
  return {
    month: valid,
    slipsTotalCents,
    depositedCents,
    differenceCents,
    agrees: differenceCents === 0,
    slipCount: depositSlipsForMonth(list, month).length,
  };
}

export function depositSlipSummary(list) {
  const slips = normalizeDepositSlipList(list);
  const reused = slips.filter((item) => item.reuseExplanation).length;
  const totalCents = slips.reduce((sum, item) => sum + item.amountCents, 0);
  return { total: slips.length, totalCents, reused };
}

export function depositSlipSummaryText(list) {
  const summary = depositSlipSummary(list);
  if (summary.total === 0) return 'No bank deposit slip recorded yet.';
  return `${summary.total} deposit slip(s) totalling ${formatRs(summary.totalCents)}` +
    `${summary.reused ? `, ${summary.reused} with a recorded slip-number reuse explanation` : ''}.`;
}

export function depositSlipHtml(slip) {
  const clean = normalizeDepositSlip(slip);
  if (!clean) return '';
  const reuse = clean.reuseExplanation
    ? ` — slip number reused, explained: ${escapeHtml(clean.reuseExplanation)}` : '';
  return `<div class="deposit-slip-row"><strong>${escapeHtml(clean.slipNumber)}</strong> — ` +
    `${formatRs(clean.amountCents)} on ${escapeHtml(clean.date)} by ${escapeHtml(clean.collector)}` +
    `${clean.bank ? ` at ${escapeHtml(clean.bank)}` : ''} — covers ` +
    `${clean.coveredDates.map((d) => escapeHtml(d)).join(', ')}${reuse}</div>`;
}

export function depositSlipCsv(list) {
  const slips = normalizeDepositSlipList(list);
  const header = 'id,date,month,amount_cents,slip_number,collector,covered_dates,bank,reuse_explanation';
  const rows = slips.map((item) => [
    item.id, item.date, item.month, item.amountCents, item.slipNumber,
    item.collector, item.coveredDates.join(';'), item.bank, item.reuseExplanation,
  ].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function depositSlipFilename() {
  return 'bank-deposit-slips.csv';
}
