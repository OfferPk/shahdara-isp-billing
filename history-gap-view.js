// Plan 411 — History missing-months gap view.
//
// Months in which a customer paid nothing are invisible in a
// history that only lists what happened, so a gap of three unpaid
// months is only noticed when the dues become large. This module
// adds only the missing piece: one gap view on the customer
// history — the months between the first and the latest
// transaction with no payment, listed with their billed amounts.
// It lists gaps only and changes nothing: it reads the entries
// the full history list already composed, in the same date order,
// and it writes to no store. It never changes any bill, payment,
// or customer record, and it never touches the roll-forward proof
// view. A month with no payment is a gap whether it holds a
// charge, a refund, or no transaction at all; a month with a
// payment is never a gap. A voided payment is listed in the
// history but moves nothing, so it never counts as a payment
// here either. Entries with no month and no date at all take no
// part in the range, so they can neither open a gap nor close
// one. The receipt-number audit is a different surface — it
// watches receipt numbers, not payment months — and is left
// alone.
export const HISTORY_GAP_VIEW_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_GAP_VIEW_NO_GAPS_TEXT = 'No missing months';

const HISTORY_GAP_VIEW_MONTH_NAMES = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]);

function cleanGapViewKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function finiteGapViewCents(value) {
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

export function isStrictGapViewMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function isStrictGapViewDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// The month an entry belongs to: the entry's own month when it is a
// strict YYYY-MM month, else the month of its strict date, else no
// month at all. A month-only date (YYYY-MM) is its own month.
export function historyGapViewMonthOf(entry) {
  if (!entry || typeof entry !== 'object') return '';
  if (isStrictGapViewMonth(entry.month)) return entry.month;
  if (isStrictGapViewDate(entry.date)) return entry.date.slice(0, 7);
  if (isStrictGapViewMonth(entry.date)) return entry.date;
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
export function historyGapViewDelta(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (entry.voided === true) return 0;
  const amountCents = finiteGapViewCents(entry.amountCents);
  if (amountCents === null) return 0;
  const type = cleanGapViewKey(entry.type);
  if (type === 'charge' || type === 'refund') return amountCents;
  if (type === 'payment' || type === 'advance' || type === 'adjustment') return -amountCents;
  if (type === 'credit') {
    return cleanGapViewKey(entry.source) === 'adjustment' ? -amountCents : 0;
  }
  return 0;
}

// Whether one entry counts as a payment for gap purposes: a
// payment or an advance that stands. A voided payment moves
// nothing, so it never closes a gap; a credit or an adjustment
// is not a payment either, and an entry with no usable amount
// never counts as one.
export function historyGapViewIsPayment(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.voided === true) return false;
  const type = cleanGapViewKey(entry.type);
  if (type !== 'payment' && type !== 'advance') return false;
  const amountCents = finiteGapViewCents(entry.amountCents);
  return amountCents !== null && amountCents > 0;
}

function gapViewMonthIndex(month) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return year * 12 + (monthNumber - 1);
}

function gapViewMonthFromIndex(index) {
  const year = Math.floor(index / 12);
  const monthNumber = (index % 12) + 1;
  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatGapViewAmount(cents) {
  const amount = finiteGapViewCents(cents);
  if (amount === null) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function historyGapViewMonthLabel(month) {
  if (!isStrictGapViewMonth(month)) return '';
  const monthNumber = Number(month.slice(5, 7));
  return `${HISTORY_GAP_VIEW_MONTH_NAMES[monthNumber - 1]} ${month.slice(0, 4)}`;
}

function gapViewGap(month, entries) {
  let billedCents = 0;
  let paidCents = 0;
  for (const entry of entries) {
    const delta = historyGapViewDelta(entry);
    if (delta > 0) billedCents += delta;
    if (delta < 0) paidCents += -delta;
  }
  return {
    month,
    label: historyGapViewMonthLabel(month),
    entries,
    entryCount: entries.length,
    billedCents,
    paidCents,
    stillOwedCents: billedCents - paidCents,
  };
}

// One gap row per month with no payment, in ascending month order,
// from the earliest month to the latest month among the dated
// entries. A month in between with no transactions at all is a gap
// too — it holds no payment — and is listed with zero subtotals,
// never skipped. Entries with no month at all take no part in the
// range. The input entries are never mutated and never reordered.
export function historyGapViewGaps(entries) {
  if (!Array.isArray(entries)) return [];
  const byMonth = new Map();
  for (const entry of entries) {
    const month = historyGapViewMonthOf(entry);
    if (month === '') continue;
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(entry);
  }
  if (byMonth.size === 0) return [];
  const months = Array.from(byMonth.keys()).sort();
  const firstIndex = gapViewMonthIndex(months[0]);
  const lastIndex = gapViewMonthIndex(months[months.length - 1]);
  const gaps = [];
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const month = gapViewMonthFromIndex(index);
    const monthEntries = byMonth.get(month) ?? [];
    if (monthEntries.some((entry) => historyGapViewIsPayment(entry))) continue;
    gaps.push(gapViewGap(month, monthEntries));
  }
  return gaps;
}

// Totals over the gap rows given: how many months are missing, and
// the billed, paid and still-owed sums across them. A month with no
// payment still owes what was billed in it, so the still-owed sum
// is the figure Saad needs before a visit.
export function historyGapViewTotals(gaps) {
  if (!Array.isArray(gaps) || gaps.length === 0) {
    return { gapCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0 };
  }
  let billedCents = 0;
  let paidCents = 0;
  let stillOwedCents = 0;
  for (const gap of gaps) {
    billedCents += finiteGapViewCents(gap?.billedCents) ?? 0;
    paidCents += finiteGapViewCents(gap?.paidCents) ?? 0;
    stillOwedCents += finiteGapViewCents(gap?.stillOwedCents) ?? 0;
  }
  return { gapCount: gaps.length, billedCents, paidCents, stillOwedCents };
}

// Verifies the gaps reconcile: the gap rows' billed, paid and
// still-owed sums must equal the same figures recomputed from the
// entries of those months, and the still-owed sum must equal the
// signed movements of those entries. Returns the figures on both
// sides so a mismatch names the gap.
export function historyGapViewReconciliation(gaps, entries) {
  let expectedBilledCents = 0;
  let expectedPaidCents = 0;
  let expectedStillOwedCents = 0;
  const gapMonths = new Set();
  if (Array.isArray(gaps)) {
    for (const gap of gaps) {
      if (gap && typeof gap === 'object' && isStrictGapViewMonth(gap.month)) {
        gapMonths.add(gap.month);
      }
    }
  }
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (!gapMonths.has(historyGapViewMonthOf(entry))) continue;
      const delta = historyGapViewDelta(entry);
      if (delta > 0) expectedBilledCents += delta;
      if (delta < 0) expectedPaidCents += -delta;
    }
  }
  expectedStillOwedCents = expectedBilledCents - expectedPaidCents;
  const totals = historyGapViewTotals(gaps);
  const ok = totals.billedCents === expectedBilledCents
    && totals.paidCents === expectedPaidCents
    && totals.stillOwedCents === expectedStillOwedCents;
  return {
    ok,
    billedCents: totals.billedCents,
    paidCents: totals.paidCents,
    stillOwedCents: totals.stillOwedCents,
    expectedBilledCents,
    expectedPaidCents,
    expectedStillOwedCents,
    message: ok
      ? `Gap months reconcile: billed ${formatGapViewAmount(totals.billedCents)}, paid ${formatGapViewAmount(totals.paidCents)}, still owed ${formatGapViewAmount(totals.stillOwedCents)}`
      : `Gap months do not reconcile: gaps sum to billed ${formatGapViewAmount(totals.billedCents)} and paid ${formatGapViewAmount(totals.paidCents)}, expected billed ${formatGapViewAmount(expectedBilledCents)} and paid ${formatGapViewAmount(expectedPaidCents)}`,
  };
}

export function historyGapViewGapText(gap) {
  if (!gap || typeof gap !== 'object') return '';
  const label = gap.label || historyGapViewMonthLabel(gap.month || '');
  const billed = formatGapViewAmount(gap.billedCents);
  const owed = formatGapViewAmount(gap.stillOwedCents);
  if (gap.entryCount === 0) {
    return `${label} · No transactions · Billed ${billed} · Still owed ${owed}`;
  }
  return `${label} · No payment · Billed ${billed} · Still owed ${owed}`;
}

export function historyGapViewSummaryText(shownEntries, allEntries) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) {
    return HISTORY_GAP_VIEW_EMPTY_TEXT;
  }
  const gaps = historyGapViewGaps(shownEntries);
  if (gaps.length === 0) return HISTORY_GAP_VIEW_NO_GAPS_TEXT;
  const totals = historyGapViewTotals(gaps);
  const months = totals.gapCount === 1 ? '1 missing month' : `${totals.gapCount} missing months`;
  const line = `${months} · Billed ${formatGapViewAmount(totals.billedCents)} · Still owed ${formatGapViewAmount(totals.stillOwedCents)}`;
  const full = Array.isArray(allEntries) ? allEntries : shownEntries;
  if (full.length === shownEntries.length) return line;
  const fullGaps = historyGapViewGaps(full);
  const fullTotals = historyGapViewTotals(fullGaps);
  const fullMonths = fullTotals.gapCount === 1 ? '1 missing month' : `${fullTotals.gapCount} missing months`;
  return `${line} · Full history: ${fullMonths} · Billed ${formatGapViewAmount(fullTotals.billedCents)} · Still owed ${formatGapViewAmount(fullTotals.stillOwedCents)}`;
}

function escapeGapViewHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The gap view: one table over the shown entries, one row per
// missing month in ascending order — month, billed, still owed —
// plus a totals footer taken from the shown gaps, so a filtered
// view still totals only what it shows. When the view is filtered,
// a second footer row carries the full-history totals, so the whole
// history stays checkable. The table reuses the statement table
// classes the app already ships, so it adds no new styles. An
// empty shown list renders nothing; a shown list with no gaps
// renders a plain line saying so.
export function historyGapViewHtml(shownEntries, allEntries) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) return '';
  const gaps = historyGapViewGaps(shownEntries);
  if (gaps.length === 0) {
    return `<p class="notice">${escapeGapViewHtml(HISTORY_GAP_VIEW_NO_GAPS_TEXT)}</p>`;
  }
  const totals = historyGapViewTotals(gaps);
  const body = gaps.map((gap) => {
    const label = gap.entryCount === 0
      ? `${gap.label} · No transactions`
      : gap.label;
    const owedClass = gap.stillOwedCents > 0 ? 'is-due' : 'is-settled';
    return `<tr><td>${escapeGapViewHtml(label)}</td><td class="col-num">${escapeGapViewHtml(formatGapViewAmount(gap.billedCents))}</td><td class="col-num balance-num ${owedClass}">${escapeGapViewHtml(formatGapViewAmount(gap.stillOwedCents))}</td></tr>`;
  }).join('');
  const totalsOwedClass = totals.stillOwedCents > 0 ? 'is-due' : 'is-settled';
  let footer = `<tr><td><strong>Totals</strong></td><td class="col-num"><strong>${escapeGapViewHtml(formatGapViewAmount(totals.billedCents))}</strong></td><td class="col-num balance-num ${totalsOwedClass}"><strong>${escapeGapViewHtml(formatGapViewAmount(totals.stillOwedCents))}</strong></td></tr>`;
  const full = Array.isArray(allEntries) ? allEntries : shownEntries;
  if (full.length !== shownEntries.length) {
    const fullGaps = historyGapViewGaps(full);
    const fullTotals = historyGapViewTotals(fullGaps);
    const fullOwedClass = fullTotals.stillOwedCents > 0 ? 'is-due' : 'is-settled';
    footer += `<tr><td><strong>Full history</strong></td><td class="col-num"><strong>${escapeGapViewHtml(formatGapViewAmount(fullTotals.billedCents))}</strong></td><td class="col-num balance-num ${fullOwedClass}"><strong>${escapeGapViewHtml(formatGapViewAmount(fullTotals.stillOwedCents))}</strong></td></tr>`;
  }
  return `<table class="statement-table"><thead><tr><th>Month</th><th class="col-num">Billed</th><th class="col-num">Still owed</th></tr></thead><tbody>${body}</tbody><tfoot>${footer}</tfoot></table>`;
}
