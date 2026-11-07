// Plan 418 — History this-month versus last-month comparison.
//
// The history never answers "did this customer pay more or less
// than last month?", so a sudden drop in payments is only noticed
// when the dues pile up. The monthly grouping already totals what
// was paid in each month, but no line ever sets this month beside
// last month in plain words. This module adds only the missing
// piece: one comparison line on the customer history — this
// month's paid total versus last month's paid total, in plain
// words: more, less, or the same, with both figures.
//
// "Paid" follows the monthly grouping's paid exactly: what reduced
// what is owed in that month — payments, advances, adjustments,
// and credits from an approved adjustment. A charge or a refund
// adds to what is owed, so it is never paid; a credit from an
// overpayment is already counted inside its source payment, so it
// moves nothing; a voided entry is listed but moves nothing. An
// entry belongs to the month its record names first, else the
// month of its date — the same month the monthly grouping assigns
// it — so a payment dated November on an October bill counts in
// October, exactly as the monthly grouping shows it. Both figures
// therefore match the history's monthly totals on the same
// fixture, and a test pins that match.
//
// The comparison is a whole-history fact, like the first-dates
// line: it is drawn from the full entries, never the shown rows,
// so a filter can never rewrite whether the customer paid more or
// less than last month, or claim no payment while payments are
// only hidden. "This month" is the month the caller supplies —
// the app passes the current month — and when the caller passes
// none, the latest month among the entries is used. "Last month"
// is the calendar month before it.
//
// It compares only and changes nothing: it reads the entries the
// full history list already composed and writes to no store. It
// never changes any bill, payment, or customer record.

export const HISTORY_MONTH_COMPARISON_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_MONTH_COMPARISON_MONTH_NOT_RECORDED_TEXT = 'Month not recorded';

const HISTORY_MONTH_COMPARISON_MONTH_NAMES = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]);

function cleanMonthComparisonKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanMonthComparisonText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function finiteMonthComparisonCents(value) {
  // A missing, boolean or blank figure is not a number, never zero:
  // Number(null) is 0 and Number(true) is 1, and both would invent
  // a paid total out of nothing.
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

export function isStrictMonthComparisonMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function isStrictMonthComparisonDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// The calendar month before the month given, in YYYY-MM form.
// January steps back to December of the previous year. A month
// that is not strict has no month before it.
export function historyMonthComparisonPreviousMonth(month) {
  if (!isStrictMonthComparisonMonth(month)) return '';
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  if (monthNumber === 1) return `${year - 1}-12`;
  return `${year}-${String(monthNumber - 1).padStart(2, '0')}`;
}

// The month an entry belongs to: the entry's own month when it is
// a strict YYYY-MM month, else the month of its strict date, else
// no month at all. A month-only date (YYYY-MM) is its own month.
// This is the same assignment the monthly grouping uses, so the
// two views can never disagree about which month a payment fell in.
export function historyMonthComparisonMonthOf(entry) {
  if (!entry || typeof entry !== 'object') return '';
  if (isStrictMonthComparisonMonth(entry.month)) return entry.month;
  if (isStrictMonthComparisonDate(entry.date)) return entry.date.slice(0, 7);
  if (isStrictMonthComparisonMonth(entry.date)) return entry.date;
  return '';
}

// The signed movement of one entry, in cents — the same rule the
// full history list uses for its running balance. Charges and
// refunds add to what is owed; payments, advances and adjustments
// reduce it. A credit entry that came from an overpayment is
// already counted inside its source payment, so it moves nothing;
// a credit entry from an approved adjustment reduces what is owed.
// A voided entry is listed but moves nothing. A missing or
// non-finite amount is not a number, never zero-filled into a
// movement: it moves nothing.
export function historyMonthComparisonDelta(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (entry.voided === true) return 0;
  const amountCents = finiteMonthComparisonCents(entry.amountCents);
  if (amountCents === null) return 0;
  const type = cleanMonthComparisonKey(entry.type);
  if (type === 'charge' || type === 'refund') return amountCents;
  if (type === 'payment' || type === 'advance' || type === 'adjustment') return -amountCents;
  if (type === 'credit') {
    return cleanMonthComparisonKey(entry.source) === 'adjustment' ? -amountCents : 0;
  }
  return 0;
}

// What was paid in one month, in cents: the entries of that month
// whose movement reduced what is owed, summed. A month with no
// payment at all is zero, never a guessed figure.
export function historyMonthComparisonPaidCents(entries, month) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  if (!isStrictMonthComparisonMonth(month)) return 0;
  let paidCents = 0;
  for (const entry of entries) {
    if (historyMonthComparisonMonthOf(entry) !== month) continue;
    const delta = historyMonthComparisonDelta(entry);
    if (delta < 0) paidCents += -delta;
  }
  return paidCents;
}

// The plain word for the comparison: more, less, or the same.
export function historyMonthComparisonDirection(thisMonthPaidCents, lastMonthPaidCents) {
  const thisPaid = finiteMonthComparisonCents(thisMonthPaidCents);
  const lastPaid = finiteMonthComparisonCents(lastMonthPaidCents);
  if (thisPaid === null || lastPaid === null) return 'same';
  if (thisPaid > lastPaid) return 'more';
  if (thisPaid < lastPaid) return 'less';
  return 'same';
}

export function historyMonthComparisonMonthLabel(month) {
  if (!isStrictMonthComparisonMonth(month)) return HISTORY_MONTH_COMPARISON_MONTH_NOT_RECORDED_TEXT;
  const monthNumber = Number(month.slice(5, 7));
  return `${HISTORY_MONTH_COMPARISON_MONTH_NAMES[monthNumber - 1]} ${month.slice(0, 4)}`;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatMonthComparisonAmount(cents) {
  const amount = finiteMonthComparisonCents(cents);
  if (amount === null) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

// The latest month among the entries given, or no month when none
// of them carries one.
function monthComparisonLatestMonth(entries) {
  let latest = '';
  for (const entry of entries) {
    const month = historyMonthComparisonMonthOf(entry);
    if (month !== '' && (latest === '' || month > latest)) latest = month;
  }
  return latest;
}

// The comparison for one customer: this month's paid total
// against last month's, with the plain word between them. The
// reference month is the month the caller supplies; when it is
// not a strict month, the latest month among the entries is used.
// No comparison can be drawn when neither names a month.
export function historyMonthComparison(referenceMonth, entries) {
  if (!Array.isArray(entries)) return null;
  const thisMonth = isStrictMonthComparisonMonth(referenceMonth)
    ? referenceMonth
    : monthComparisonLatestMonth(entries);
  if (thisMonth === '') return null;
  const lastMonth = historyMonthComparisonPreviousMonth(thisMonth);
  const thisMonthPaidCents = historyMonthComparisonPaidCents(entries, thisMonth);
  const lastMonthPaidCents = historyMonthComparisonPaidCents(entries, lastMonth);
  return {
    thisMonth,
    lastMonth,
    thisMonthPaidCents,
    lastMonthPaidCents,
    direction: historyMonthComparisonDirection(thisMonthPaidCents, lastMonthPaidCents),
  };
}

export function historyMonthComparisonText(referenceMonth, entries) {
  const comparison = historyMonthComparison(referenceMonth, entries);
  if (comparison === null) return '';
  const thisLabel = historyMonthComparisonMonthLabel(comparison.thisMonth);
  const lastLabel = historyMonthComparisonMonthLabel(comparison.lastMonth);
  const thisAmount = formatMonthComparisonAmount(comparison.thisMonthPaidCents);
  const lastAmount = formatMonthComparisonAmount(comparison.lastMonthPaidCents);
  if (comparison.direction === 'more') {
    return `Paid ${thisAmount} in ${thisLabel} · more than ${lastLabel} (${lastAmount})`;
  }
  if (comparison.direction === 'less') {
    return `Paid ${thisAmount} in ${thisLabel} · less than ${lastLabel} (${lastAmount})`;
  }
  return `Paid ${thisAmount} in ${thisLabel} · the same as ${lastLabel} (${lastAmount})`;
}

function escapeMonthComparisonHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The comparison line: one plain-words line naming this month's
// paid total beside last month's. The line is drawn from the full
// entries, never the shown rows, so a filter can never rewrite
// whether the customer paid more or less than last month. An
// empty history renders nothing; a history with no month to
// compare against renders nothing rather than a guessed line.
export function historyMonthComparisonHtml(referenceMonth, entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const text = historyMonthComparisonText(referenceMonth, entries);
  if (text === '') return '';
  return `<p class="notice">${escapeMonthComparisonHtml(text)}</p>`;
}
