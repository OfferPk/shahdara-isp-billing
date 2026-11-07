/**
 * Plan 454 — Search ledger for one single day.
 *
 * At closing time the owner asks one simple question — "what came in
 * yesterday, and how much in total?" — but the Transactions screen
 * only had an exact-date filter that narrowed the list: the day's
 * total had to be read off the generic "Filtered total", which
 * changes meaning with every filter combination, and a day with no
 * entries only said "No recorded payments match these filters."
 *
 * This module is the missing piece for the single-day search. It does
 * not replace the exact-date filter — that filter already returns
 * exactly one day's entries and no other day's, and this module keeps
 * that strict match. It adds what was missing around it: the day's
 * entries in time order (the order the day's work happened, by the
 * time each payment was recorded), the day line that names the day
 * with its count and total in PKR, and the plain message for a day
 * with no entries.
 *
 * The search reads entries only and changes nothing: it never changes
 * any bill, payment, or customer record, and the input list and its
 * entries are never mutated. All money is PKR only (Rs), never
 * converted — the day total is shown as PKR, the same currency the
 * ledger itself shows.
 *
 * A day is one strict date (YYYY-MM-DD). An entry belongs to the day
 * when its recorded date equals it exactly, the same strict match the
 * Transactions list already uses. The day line's count and total
 * follow the ledger's own rule (SISP-34) that voided rows are
 * history, not collected cash, so a voided entry on the day stays
 * listed but counts towards neither the count nor the total — the
 * same rule Plan 453 uses for its range line, so the two lines agree
 * with each other and with the sum of the listed non-voided entries.
 */

const LEDGER_DAY_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Whole rupees, formatted the way the owner types them. */
export function formatLedgerDayRupees(rupees) {
  return `Rs ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/** The total, formatted the way the ledger's summary bar shows it. */
export function formatLedgerDayPkrTotal(rupees) {
  return `PKR ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/**
 * Days in a month, with the leap-year rule. The table must list 31
 * for January, March, May, July, August, October, and December —
 * a short table here once rejected 31 August, October, and December
 * (Plan 128, fixed inside Plan 130), so the table is pinned by
 * tests for every month.
 */
function ledgerDayDaysInMonth(year, month) {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return days[month - 1];
}

/**
 * One strict date (YYYY-MM-DD) as typed by the date input, or null
 * when the value is blank, malformed, or not a real calendar day.
 * No Date object is built — the check is pure arithmetic, so a date
 * like 2026-02-30 or 2027-02-29 never slips through.
 */
export function normalizeLedgerDay(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > ledgerDayDaysInMonth(year, month)) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** True when the value is one usable strict date. */
export function ledgerDayActive(value) {
  return normalizeLedgerDay(value) !== null;
}

/**
 * The day as the screen shows it — "5 Nov 2026", the same shape the
 * app's own date display uses — or '' when the value is not a usable
 * date.
 */
export function formatLedgerDay(value) {
  const day = normalizeLedgerDay(value);
  if (!day) return '';
  const parts = day.split('-');
  const monthName = LEDGER_DAY_MONTH_NAMES[Number(parts[1]) - 1] || parts[1];
  return `${Number(parts[2])} ${monthName} ${parts[0]}`;
}

/**
 * Does one ledger entry belong to the day? The recorded date must
 * equal the day exactly — the same strict match the Transactions
 * list already uses, so no neighbouring day ever leaks in.
 */
export function ledgerDayMatches(entry, date) {
  const day = normalizeLedgerDay(date);
  if (!day) return false;
  return String(entry?.date ?? '') === day;
}

/**
 * A usable recorded-at stamp: the instant a payment was logged, as
 * an ISO string ("2026-11-05T09:30:00.000Z") or the local
 * "YYYY-MM-DDTHH:mm" shape. Only the prefix is compared, so both
 * shapes sort in time order; anything else reads as unstamped.
 */
function ledgerDayRecordedAt(entry) {
  const stamp = String(entry?.recordedAt ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(stamp) ? stamp : null;
}

/**
 * The entries of one day, in time order — the order the day's work
 * happened, oldest first, by the time each payment was recorded. An
 * entry logged later (for example a backdated payment recorded days
 * after its date) sorts after the ones logged on the day. Entries
 * with no usable recorded-at stamp keep their list order after the
 * stamped ones. With no usable date every entry is kept, in the
 * same order. The input list and its entries are never mutated —
 * the result is a new array.
 */
export function searchLedgerByDay(transactions, date) {
  const list = Array.isArray(transactions) ? transactions : [];
  const day = normalizeLedgerDay(date);
  if (!day) return [...list];
  const matched = list
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => ledgerDayMatches(entry, day));
  matched.sort((a, b) => {
    const timeA = ledgerDayRecordedAt(a.entry);
    const timeB = ledgerDayRecordedAt(b.entry);
    if (timeA !== null && timeB !== null) {
      if (timeA !== timeB) return timeA < timeB ? -1 : 1;
    } else if (timeA !== null) {
      return -1;
    } else if (timeB !== null) {
      return 1;
    }
    const nameA = String(a.entry?.customerName ?? '');
    const nameB = String(b.entry?.customerName ?? '');
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    const idA = String(a.entry?.paymentId ?? a.entry?.id ?? '');
    const idB = String(b.entry?.paymentId ?? b.entry?.id ?? '');
    if (idA !== idB) return idA < idB ? -1 : 1;
    return a.index - b.index;
  });
  return matched.map(({ entry }) => entry);
}

/**
 * Count and total of the entries, following the ledger's own rule:
 * voided rows are history, not collected cash, so they count
 * towards neither. A non-numeric amount contributes nothing to the
 * total. The total is in rupees.
 */
export function ledgerDaySummary(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let count = 0;
  let total = 0;
  for (const entry of list) {
    if (entry?.voided === true) continue;
    count += 1;
    total += Number(entry?.amount) || 0;
  }
  return { count, total };
}

/**
 * The day line for the summary bar: the day, the count, and the
 * total in PKR — "5 Nov 2026: 3 entries · PKR 4,500 total". The
 * count and total are over the entries passed in, so on the screen
 * they are the listed entries' own count and total. With no usable
 * date the line is empty.
 */
export function ledgerDaySummaryText(entries, date) {
  const label = formatLedgerDay(date);
  if (!label) return '';
  const summary = ledgerDaySummary(entries);
  const entriesWord = summary.count === 1 ? 'entry' : 'entries';
  return `${label}: ${summary.count} ${entriesWord} · ${formatLedgerDayPkrTotal(summary.total)} total`;
}

/** The plain message for a day that has no entries. */
export function ledgerDayEmptyText(date) {
  const label = formatLedgerDay(date);
  if (!label) return 'No recorded payments match these filters.';
  return `No entries on ${label}.`;
}

/**
 * One bound of an amount range, parsed the same way Plan 453 parses
 * its bounds: a whole-rupee amount, or null when the side is blank
 * or unusable. A number input must be a positive safe integer; a
 * string may carry an Rs/PKR prefix, commas, and spaces. Zero or
 * less is null.
 */
function normalizeLedgerDayRangeBound(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) return null;
    return value;
  }
  if (typeof value !== 'string') return null;
  let text = value.trim().toLowerCase();
  if (text === '') return null;
  text = text.replace(/^(rs\.?|pkr)\s*/, '');
  text = text.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(text)) return null;
  const rupees = Number(text);
  if (!Number.isSafeInteger(rupees) || rupees <= 0) return null;
  return rupees;
}

/**
 * The plain message for a day that has no entries inside the
 * amount range — the day and the range both named, so the owner can
 * tell a quiet day apart from a range that matches nothing. With no
 * usable bound it reads as the plain day message; with no usable
 * date it reads as the generic message.
 */
export function ledgerDayRangeEmptyText(date, min, max) {
  const label = formatLedgerDay(date);
  if (!label) return 'No recorded payments match these filters.';
  const low = normalizeLedgerDayRangeBound(min);
  const high = normalizeLedgerDayRangeBound(max);
  if (low !== null && high !== null) {
    const from = Math.min(low, high);
    const to = Math.max(low, high);
    return `No entries on ${label} between ${formatLedgerDayRupees(from)} and ${formatLedgerDayRupees(to)}.`;
  }
  if (low !== null) return `No entries on ${label} of ${formatLedgerDayRupees(low)} or more.`;
  if (high !== null) return `No entries on ${label} up to ${formatLedgerDayRupees(high)}.`;
  return `No entries on ${label}.`;
}
