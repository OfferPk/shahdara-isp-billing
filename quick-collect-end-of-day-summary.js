// Plan 448 — Quick Collect end-of-day summary from the payment screen:
// at the end of the day the operator leaves Quick Collect and hunts
// through digests and settlements to learn what today brought in,
// because the payment screen itself never summarises the day. One
// end-of-day summary reachable from the Quick Collect screen —
// today's payments count and total, by method, with the cash total
// shown separately. It summarises only and it settles nothing.
//
// What already exists, and what this plan does NOT rebuild: the live
// daily entry summary (Plan 400) already gives today's count and
// total on the entry screen, the daily target progress (Plan 445)
// already sets that total against the day target, and the round
// total (Plan 439) already totals this round. The dashboard daily
// closing already gives the full closing — month benchmark, shop and
// collector splits, receipts, handovers, slips and exports — and
// the owner digest and the collector settlement statement both
// already exist and are left alone. None of those gives the
// operator, on the Quick Collect screen itself, today's payments
// broken down by method with the cash total shown separately, so
// the handover starts from figures already seen at the counter.
// This module adds only that summary, derived from the transaction
// rows the app already projects — no store of its own, because the
// payments already recorded on this device ARE the day's takings.
//
// "Today" is the payment date, the same day the Transactions list
// groups by and the same day the daily entry summary uses; a voided
// row is history, not a taking, so it counts for neither the count
// nor the total. A reversal (a negative payment) is a recorded
// transaction today, so it counts and nets into the total. The
// method parts sum exactly to the day total, because every part
// uses the same finite-amount rule: only finite amounts move a
// total, while a row with no usable amount still counts as a
// recorded payment.
//
// Cash rule: cash is whatever is not digital, mirroring the app's
// own cash/digital split — a method counts as digital when it names
// JazzCash, Easypaisa, NayaPay, a bank, Raast, or an online payment,
// and anything else counts as cash, including a payment with no
// method recorded (the shop's rule: an unrecorded method is cash
// taken at the counter). The method breakdown still labels a
// missing method "Method not recorded", so the breakdown never
// invents a method name; that row's amount counts toward the cash
// total, pinned by test. Pure: the caller supplies the rows and the
// day, and the module never reads storage, the clock, or the
// network, and never mutates an input.

const STRICT_SUMMARY_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const END_OF_DAY_SUMMARY_UNRECORDED_METHOD = 'Method not recorded';

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Whether the value is a strict YYYY-MM-DD calendar date (month
 * 01-12, a real day for that month, leap-aware). A blank, a typo, a
 * month outside 01-12, or a day that month never has — 30 February,
 * 31 April, 29 February in a common year — is never a summary date.
 */
export function isStrictEndOfDaySummaryDate(value) {
  if (typeof value !== 'string') return false;
  const match = STRICT_SUMMARY_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value) {
  return value == null ? '' : String(value);
}

function escapeHtml(value) {
  return str(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// PKR in the plan modules' own shape: min-0 decimals, never more
// than two (PKR 3,000 · PKR 1,500.5). A null/undefined/empty/boolean
// figure is "not a number", never zero — a missing amount must never
// be printed as PKR 0.
export function formatEndOfDaySummaryAmount(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `PKR ${formatter.format(amount)}`;
}

// The digital words the app's own cash/digital split uses: a method
// naming one of these is digital, and anything else — including a
// missing or blank method — is cash taken at the counter.
const DIGITAL_METHOD_WORDS = ['jazzcash', 'easypaisa', 'nayapay', 'bank', 'raast', 'online'];

/**
 * Whether a payment method counts as cash for the end-of-day
 * handover. Mirrors the app's own cash/digital split: a method is
 * digital when it names JazzCash, Easypaisa, NayaPay, a bank, Raast,
 * or an online payment; anything else is cash, and a missing or
 * blank method is cash too, as the shop's rule reads it.
 */
export function isEndOfDayCashMethod(method) {
  if (method === null || method === undefined) return true;
  const m = String(method).trim().toLowerCase();
  if (m === '') return true;
  return !DIGITAL_METHOD_WORDS.some((word) => m.includes(word));
}

function methodLabel(method) {
  if (method === null || method === undefined) return END_OF_DAY_SUMMARY_UNRECORDED_METHOD;
  const label = String(method).trim();
  return label === '' ? END_OF_DAY_SUMMARY_UNRECORDED_METHOD : label;
}

/**
 * Today's payments count and total, by method, with the cash total
 * shown separately, from the transaction rows the app already
 * projects. Only rows dated todayKey count, and only when todayKey
 * is a strict date; a voided row counts for neither the count nor
 * the total. Only finite amounts count toward a total, so a missing
 * amount never counts as zero — the row still counts as a recorded
 * payment. The method parts sum exactly to the day total. Pure: the
 * caller supplies the rows and the day, and the module never reads
 * storage, the clock, or the network, and never mutates an input.
 */
export function quickCollectEndOfDaySummary(rows, todayKey) {
  const date = isStrictEndOfDaySummaryDate(todayKey) ? todayKey : '';
  const empty = { date, count: 0, total: 0, cashTotal: 0, cashCount: 0, methods: [] };
  if (!date || !Array.isArray(rows)) return empty;
  const byMethod = new Map();
  let count = 0;
  let total = 0;
  let cashTotal = 0;
  let cashCount = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (!isStrictEndOfDaySummaryDate(row.date) || row.date !== date) continue;
    if (row.voided === true) continue;
    count += 1;
    const amount = Number(row.amount);
    const usable = Number.isFinite(amount);
    if (usable) total += amount;
    const label = methodLabel(row.method);
    const part = byMethod.get(label) || { method: label, count: 0, total: 0 };
    part.count += 1;
    if (usable) part.total += amount;
    byMethod.set(label, part);
    if (isEndOfDayCashMethod(row.method)) {
      cashCount += 1;
      if (usable) cashTotal += amount;
    }
  }
  const methods = [...byMethod.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.method < b.method ? -1 : a.method > b.method ? 1 : 0;
  });
  return { date, count, total, cashTotal, cashCount, methods };
}

/**
 * "End of day — today: 3 payments · PKR 9,000" for the summary
 * headline, or "End of day — today: no payments yet" for an empty
 * day — said plainly, never hidden behind a blank. Plain English,
 * like the other live lines on that screen.
 */
export function quickCollectEndOfDaySummaryText(summary) {
  const count = Number(summary?.count);
  const total = Number(summary?.total);
  if (!Number.isFinite(count) || count <= 0) return 'End of day — today: no payments yet';
  const word = count === 1 ? 'payment' : 'payments';
  return `End of day — today: ${count} ${word} · ${formatEndOfDaySummaryAmount(Number.isFinite(total) ? total : 0)}`;
}

/**
 * The end-of-day summary panel: the headline, one row per method
 * with its count and total, the cash total on its own line, and a
 * Close button. Amounts are formatted here, never recomputed, so
 * the panel cannot drift from the summary object the tests pin.
 * Method names come from recorded data, so every name is escaped.
 * An empty day shows the headline and the Close button only — no
 * method list and no cash line, so an empty day never reads as a
 * taking of nothing.
 */
export function quickCollectEndOfDaySummaryHtml(summary) {
  const s = summary && typeof summary === 'object' ? summary : {};
  const line = `<p class="eds-summary-line">${escapeHtml(quickCollectEndOfDaySummaryText(s))}</p>`;
  const close = '<button type="button" id="edsEndOfDaySummaryClose" class="secondary-button eds-close-button">Close</button>';
  const count = Number(s.count);
  if (!Number.isFinite(count) || count <= 0 || !Array.isArray(s.methods) || s.methods.length === 0) {
    return `<div class="eds-summary-panel" role="region" aria-label="End-of-day summary">${line}${close}</div>`;
  }
  const rows = s.methods.map((part) => {
    const partCount = Number(part.count);
    const word = partCount === 1 ? 'payment' : 'payments';
    return `<li><span class="eds-method-name">${escapeHtml(part.method)}</span> — ${Number.isFinite(partCount) ? partCount : 0} ${word} · ${escapeHtml(formatEndOfDaySummaryAmount(Number(part.total)))}</li>`;
  }).join('');
  const cash = `<p class="eds-cash-line">Cash in hand: ${escapeHtml(formatEndOfDaySummaryAmount(Number(s.cashTotal)))}</p>`;
  return `<div class="eds-summary-panel" role="region" aria-label="End-of-day summary">${line}<ul class="eds-summary-methods">${rows}</ul>${cash}${close}</div>`;
}
