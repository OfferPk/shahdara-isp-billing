// Plan 408 — History yearly summary per customer.
//
// A customer who wants "how much did I pay this year?" must add up
// twelve months by hand, because the history has no yearly view.
// This module adds only the missing piece: one yearly summary per
// customer — year, total billed, total paid, total still owed,
// number of payments — composed from the entries the full history
// list already composed, in the same date order. It summarises
// only and changes nothing: it reads those entries and writes to
// no store. It never changes any bill, payment, annual summary, or
// customer record, and it never touches the roll-forward proof
// view. The yearly figures are the sum of that year's monthly
// figures, so a year reads as one line of the same story the
// monthly grouping tells. A year with no transactions shows zeros,
// not a blank, so an empty year is a fact, not a gap. Entries with
// no year at all sit in a final "Year not recorded" row, so no
// entry is ever dropped.

export const HISTORY_YEARLY_SUMMARY_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_YEARLY_SUMMARY_UNDATED_LABEL = 'Year not recorded';

function cleanYearlySummaryKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function finiteYearlySummaryCents(value) {
  // A missing, boolean or blank figure is not a number, never zero:
  // Number(null) is 0 and Number(true) is 1, and both would invent
  // a subtotal out of nothing.
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

export function isStrictYearlySummaryYear(value) {
  return typeof value === 'string' && /^\d{4}$/.test(value);
}

export function isStrictYearlySummaryMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function isStrictYearlySummaryDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// The year an entry belongs to: the year of the entry's own month
// when it is a strict YYYY-MM month, else the year of its strict
// date, else no year at all. A month-only date (YYYY-MM) is its
// own year.
export function historyYearlySummaryYearOf(entry) {
  if (!entry || typeof entry !== 'object') return '';
  if (isStrictYearlySummaryMonth(entry.month)) return entry.month.slice(0, 4);
  if (isStrictYearlySummaryDate(entry.date)) return entry.date.slice(0, 4);
  if (isStrictYearlySummaryMonth(entry.date)) return entry.date.slice(0, 4);
  return '';
}

// The signed movement of one entry, in cents — the same rule the
// full history list uses for its running balance and the monthly
// grouping uses for its subtotals. Charges and refunds add to what
// is owed; payments, advances and adjustments reduce it. A credit
// entry that came from an overpayment is already counted inside its
// source payment, so it moves nothing; a credit entry from an
// approved adjustment reduces what is owed. A voided entry is
// listed but moves nothing. A missing or non-finite amount is not
// a number, never zero-filled into a movement: it moves nothing.
export function historyYearlySummaryDelta(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (entry.voided === true) return 0;
  const amountCents = finiteYearlySummaryCents(entry.amountCents);
  if (amountCents === null) return 0;
  const type = cleanYearlySummaryKey(entry.type);
  if (type === 'charge' || type === 'refund') return amountCents;
  if (type === 'payment' || type === 'advance' || type === 'adjustment') return -amountCents;
  if (type === 'credit') {
    return cleanYearlySummaryKey(entry.source) === 'adjustment' ? -amountCents : 0;
  }
  return 0;
}

// A payment made: a payment entry, or an advance entry (money paid
// in advance is still a payment), that was not voided. A voided
// payment was recorded and then undone, so it never counts.
function isYearlySummaryPayment(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.voided === true) return false;
  const type = cleanYearlySummaryKey(entry.type);
  return type === 'payment' || type === 'advance';
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and
// one decimal for a paisa remainder (PKR 1,500.5), the same shape
// the entry-screen formatters use.
export function formatYearlySummaryAmount(cents) {
  const amount = finiteYearlySummaryCents(cents);
  if (amount === null) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function historyYearlySummaryYearLabel(year) {
  if (!isStrictYearlySummaryYear(year)) return HISTORY_YEARLY_SUMMARY_UNDATED_LABEL;
  return year;
}

function yearlySummaryFromAccumulator(accumulator) {
  return {
    year: accumulator.year,
    label: historyYearlySummaryYearLabel(accumulator.year),
    billedCents: accumulator.billedCents,
    paidCents: accumulator.paidCents,
    stillOwedCents: accumulator.billedCents - accumulator.paidCents,
    paymentCount: accumulator.paymentCount,
    entryCount: accumulator.entryCount,
  };
}

function yearlySummaryAccumulate(accumulator, entry) {
  const delta = historyYearlySummaryDelta(entry);
  if (delta > 0) accumulator.billedCents += delta;
  if (delta < 0) accumulator.paidCents += -delta;
  if (isYearlySummaryPayment(entry)) accumulator.paymentCount += 1;
  accumulator.entryCount += 1;
  return accumulator;
}

function yearlySummaryEmptyAccumulator(year) {
  return {
    year,
    billedCents: 0,
    paidCents: 0,
    paymentCount: 0,
    entryCount: 0,
  };
}

// One year's summary on the entries given: the year's total
// billed, total paid, total still owed, and number of payments. A
// year with no transactions shows zeros, not a blank. A year that
// is not a strict four-digit year has no summary: it returns null,
// never a guessed year.
export function historyYearlySummary(entries, year) {
  if (!isStrictYearlySummaryYear(year)) return null;
  const accumulator = yearlySummaryEmptyAccumulator(year);
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (historyYearlySummaryYearOf(entry) !== year) continue;
      yearlySummaryAccumulate(accumulator, entry);
    }
  }
  return yearlySummaryFromAccumulator(accumulator);
}

// One summary per year, in ascending year order, over the entries
// given. Entries with no year at all sit in a final summary
// labelled "Year not recorded", so no entry is ever dropped. The
// input entries are never mutated and never reordered.
export function historyYearlySummaries(entries) {
  if (!Array.isArray(entries)) return [];
  const byYear = new Map();
  let undated = null;
  for (const entry of entries) {
    const year = historyYearlySummaryYearOf(entry);
    if (year === '') {
      if (undated === null) undated = yearlySummaryEmptyAccumulator('');
      yearlySummaryAccumulate(undated, entry);
      continue;
    }
    if (!byYear.has(year)) byYear.set(year, yearlySummaryEmptyAccumulator(year));
    yearlySummaryAccumulate(byYear.get(year), entry);
  }
  const summaries = [...byYear.keys()].sort().map((year) => yearlySummaryFromAccumulator(byYear.get(year)));
  if (undated !== null) summaries.push(yearlySummaryFromAccumulator(undated));
  return summaries;
}

// Totals over the entries given: billed, paid, still owed, and
// number of payments, including any undated entries.
export function historyYearlySummaryTotals(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { entryCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0, paymentCount: 0 };
  }
  const accumulator = yearlySummaryEmptyAccumulator('');
  for (const entry of entries) yearlySummaryAccumulate(accumulator, entry);
  const summary = yearlySummaryFromAccumulator(accumulator);
  return {
    entryCount: summary.entryCount,
    billedCents: summary.billedCents,
    paidCents: summary.paidCents,
    stillOwedCents: summary.stillOwedCents,
    paymentCount: summary.paymentCount,
  };
}

// Verifies the summaries reconcile: the yearly figures summed over
// the summaries must equal the totals over the entries given.
// Returns the figures on both sides so a mismatch names the gap.
export function historyYearlySummaryReconciliation(summaries, entries) {
  const totals = historyYearlySummaryTotals(entries);
  let billedCents = 0;
  let paidCents = 0;
  let stillOwedCents = 0;
  let paymentCount = 0;
  if (Array.isArray(summaries)) {
    for (const summary of summaries) {
      billedCents += finiteYearlySummaryCents(summary?.billedCents) ?? 0;
      paidCents += finiteYearlySummaryCents(summary?.paidCents) ?? 0;
      stillOwedCents += finiteYearlySummaryCents(summary?.stillOwedCents) ?? 0;
      paymentCount += finiteYearlySummaryCents(summary?.paymentCount) ?? 0;
    }
  }
  const ok = billedCents === totals.billedCents
    && paidCents === totals.paidCents
    && stillOwedCents === totals.stillOwedCents
    && paymentCount === totals.paymentCount;
  return {
    ok,
    billedCents,
    paidCents,
    stillOwedCents,
    paymentCount,
    expectedBilledCents: totals.billedCents,
    expectedPaidCents: totals.paidCents,
    expectedStillOwedCents: totals.stillOwedCents,
    expectedPaymentCount: totals.paymentCount,
    message: ok
      ? `Yearly subtotals reconcile: billed ${formatYearlySummaryAmount(billedCents)}, paid ${formatYearlySummaryAmount(paidCents)}, still owed ${formatYearlySummaryAmount(stillOwedCents)}, ${paymentCount} payment${paymentCount === 1 ? '' : 's'}`
      : `Yearly subtotals do not reconcile: summaries sum to billed ${formatYearlySummaryAmount(billedCents)} and paid ${formatYearlySummaryAmount(paidCents)}, expected billed ${formatYearlySummaryAmount(totals.billedCents)} and paid ${formatYearlySummaryAmount(totals.paidCents)}`,
  };
}

export function historyYearlySummaryText(summary) {
  if (!summary || typeof summary !== 'object') return '';
  const label = historyYearlySummaryYearLabel(summary.year);
  const billedCents = finiteYearlySummaryCents(summary.billedCents) ?? 0;
  const paidCents = finiteYearlySummaryCents(summary.paidCents) ?? 0;
  const stillOwedCents = finiteYearlySummaryCents(summary.stillOwedCents) ?? billedCents - paidCents;
  const paymentCount = finiteYearlySummaryCents(summary.paymentCount) ?? 0;
  return `${label} · Billed ${formatYearlySummaryAmount(billedCents)} · Paid ${formatYearlySummaryAmount(paidCents)} · Still owed ${formatYearlySummaryAmount(stillOwedCents)} · ${paymentCount} payment${paymentCount === 1 ? '' : 's'}`;
}

export function historyYearlySummarySummaryText(shownEntries, allEntries) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) {
    return HISTORY_YEARLY_SUMMARY_EMPTY_TEXT;
  }
  const summaries = historyYearlySummaries(shownEntries);
  const totals = historyYearlySummaryTotals(shownEntries);
  const years = summaries.filter((summary) => summary.year !== '').length;
  const yearWord = years === 1 ? '1 year' : `${years} years`;
  const line = `${yearWord} · Billed ${formatYearlySummaryAmount(totals.billedCents)} · Paid ${formatYearlySummaryAmount(totals.paidCents)} · Still owed ${formatYearlySummaryAmount(totals.stillOwedCents)} · ${totals.paymentCount} payment${totals.paymentCount === 1 ? '' : 's'}`;
  const full = Array.isArray(allEntries) ? allEntries : shownEntries;
  if (full.length === shownEntries.length) return line;
  const fullTotals = historyYearlySummaryTotals(full);
  return `${line} · Full history: Billed ${formatYearlySummaryAmount(fullTotals.billedCents)} · Paid ${formatYearlySummaryAmount(fullTotals.paidCents)} · Still owed ${formatYearlySummaryAmount(fullTotals.stillOwedCents)} · ${fullTotals.paymentCount} payment${fullTotals.paymentCount === 1 ? '' : 's'}`;
}

function escapeYearlySummaryHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The yearly summary: one table over the shown entries, one row
// per year in ascending order — year, payments, billed, paid,
// still owed — plus a totals footer taken from the shown years,
// so a filtered view still totals only what it shows. When the
// view is filtered, a second footer row carries the full-history
// totals, so the whole history stays checkable. The table reuses
// the statement table classes the app already ships, so it adds no
// new styles. An empty shown list renders nothing.
export function historyYearlySummaryHtml(shownEntries, allEntries) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) return '';
  const summaries = historyYearlySummaries(shownEntries);
  const totals = historyYearlySummaryTotals(shownEntries);
  const body = summaries.map((summary) => {
    const owedClass = summary.stillOwedCents > 0 ? 'is-due' : 'is-settled';
    return `<tr><td>${escapeYearlySummaryHtml(summary.label)}</td><td class="col-num">${escapeYearlySummaryHtml(String(summary.paymentCount))}</td><td class="col-num">${escapeYearlySummaryHtml(formatYearlySummaryAmount(summary.billedCents))}</td><td class="col-num">${escapeYearlySummaryHtml(formatYearlySummaryAmount(summary.paidCents))}</td><td class="col-num balance-num ${owedClass}">${escapeYearlySummaryHtml(formatYearlySummaryAmount(summary.stillOwedCents))}</td></tr>`;
  }).join('');
  const totalsOwedClass = totals.stillOwedCents > 0 ? 'is-due' : 'is-settled';
  let footer = `<tr><td><strong>Totals</strong></td><td class="col-num"><strong>${escapeYearlySummaryHtml(String(totals.paymentCount))}</strong></td><td class="col-num"><strong>${escapeYearlySummaryHtml(formatYearlySummaryAmount(totals.billedCents))}</strong></td><td class="col-num"><strong>${escapeYearlySummaryHtml(formatYearlySummaryAmount(totals.paidCents))}</strong></td><td class="col-num balance-num ${totalsOwedClass}"><strong>${escapeYearlySummaryHtml(formatYearlySummaryAmount(totals.stillOwedCents))}</strong></td></tr>`;
  const full = Array.isArray(allEntries) ? allEntries : shownEntries;
  if (full.length !== shownEntries.length) {
    const fullTotals = historyYearlySummaryTotals(full);
    const fullOwedClass = fullTotals.stillOwedCents > 0 ? 'is-due' : 'is-settled';
    footer += `<tr><td><strong>Full history</strong></td><td class="col-num"><strong>${escapeYearlySummaryHtml(String(fullTotals.paymentCount))}</strong></td><td class="col-num"><strong>${escapeYearlySummaryHtml(formatYearlySummaryAmount(fullTotals.billedCents))}</strong></td><td class="col-num"><strong>${escapeYearlySummaryHtml(formatYearlySummaryAmount(fullTotals.paidCents))}</strong></td><td class="col-num balance-num ${fullOwedClass}"><strong>${escapeYearlySummaryHtml(formatYearlySummaryAmount(fullTotals.stillOwedCents))}</strong></td></tr>`;
  }
  return `<table class="statement-table"><thead><tr><th>Year</th><th class="col-num">Payments</th><th class="col-num">Billed</th><th class="col-num">Paid</th><th class="col-num">Still owed</th></tr></thead><tbody>${body}</tbody><tfoot>${footer}</tfoot></table>`;
}
