// Plan 400 — Transaction daily entry summary on the entry screen:
// during a busy day the operator has no running sense of how much
// has been taken today, so the day's total is only discovered at
// settlement time. One live daily summary on the transaction entry
// screen — today's transaction count and total amount on this
// device, updated after each save. It summarises only: it settles
// nothing and never changes any bill, payment, digest, or
// settlement record.
//
// What already exists, and what this plan does NOT rebuild: the
// owner digest (the daily and weekly collection digest for the
// owner) and the collector settlement statement both already exist
// and are left alone; the offline queue view already lists today's
// recorded transactions, but it is a list, not a count and total.
// This module adds only the summary, derived from the transaction
// rows the app already projects — no store of its own, because the
// payments already recorded on this device ARE the day's takings.
// "Today" is the payment date, the same day the Transactions list
// groups by; a voided row is history, not a taking, so it counts
// for neither the count nor the total. A reversal (a negative
// payment) is a recorded transaction today, so it counts and nets
// into the total.

const STRICT_SUMMARY_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Whether the value is a strict YYYY-MM-DD calendar date (month
 * 01-12, a real day for that month, leap-aware). A blank, a typo, a
 * month outside 01-12, or a day that month never has — 30 February,
 * 31 April, 29 February in a common year — is never a summary date.
 */
export function isStrictSummaryDate(value) {
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

// PKR in the plan modules' own shape: min-0 decimals, never more
// than two (PKR 3,000 · PKR 1,500.5). A null/undefined/empty/boolean
// figure is "not a number", never zero — a missing amount must never
// be printed as PKR 0.
export function formatSummaryAmount(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `PKR ${formatter.format(amount)}`;
}

/**
 * Today's transaction count and total amount from the transaction
 * rows the app already projects. Only rows dated todayKey count,
 * and only when todayKey is a strict date; a voided row counts for
 * neither the count nor the total. Only finite amounts count toward
 * the total, so a missing amount never counts as zero — the row
 * still counts as a recorded transaction. Pure: the caller supplies
 * the rows and the day, and the module never reads storage, the
 * clock, or the network, and never mutates an input.
 */
export function dailyEntrySummary(rows, todayKey) {
  const date = isStrictSummaryDate(todayKey) ? todayKey : '';
  if (!date || !Array.isArray(rows)) return { date, count: 0, total: 0 };
  let count = 0;
  let total = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (!isStrictSummaryDate(row.date) || row.date !== todayKey) continue;
    if (row.voided === true) continue;
    count += 1;
    const amount = Number(row.amount);
    if (Number.isFinite(amount)) total += amount;
  }
  return { date, count, total };
}

/**
 * "Today: 3 payments · PKR 9,000" for the entry-screen line, or
 * "Today: no payments yet" for an empty day — said plainly, never
 * hidden behind a blank. Plain English, like the other live lines
 * on that screen.
 */
export function dailyEntrySummaryText(summary) {
  const count = Number(summary?.count);
  const total = Number(summary?.total);
  if (!Number.isFinite(count) || count <= 0) return 'Today: no payments yet';
  const word = count === 1 ? 'payment' : 'payments';
  return `Today: ${count} ${word} · ${formatSummaryAmount(Number.isFinite(total) ? total : 0)}`;
}
