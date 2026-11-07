// Plan 407 — History monthly grouping with subtotals.
//
// A flat history list hides the shape of a customer's year, so the
// operator cannot say which month was the heaviest or which month
// had no payment at all. This module adds only the missing piece:
// one monthly grouping of the customer history — the transactions
// grouped by month, each month with a billed subtotal, a paid
// subtotal, and a still-owed figure. It groups only and changes
// nothing: it reads the entries the full history list already
// composed, in the same date order, and it writes to no store. It
// never changes any bill, payment, or customer record, and it never
// touches the roll-forward proof view. A month between the first
// and the last month with no transactions is shown as empty, not
// skipped, so a missed month stays visible. Entries with no month
// and no date at all sit in a final "Month not recorded" group, so
// the monthly subtotals still sum exactly to the full history
// totals.
export const HISTORY_MONTHLY_GROUPING_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_MONTHLY_GROUPING_UNDATED_LABEL = 'Month not recorded';

const HISTORY_MONTH_NAMES = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]);

function cleanMonthlyGroupingKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanMonthlyGroupingText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function finiteMonthlyGroupingCents(value) {
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

export function isStrictMonthlyGroupingMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function isStrictMonthlyGroupingDate(value) {
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
export function historyMonthlyGroupingMonthOf(entry) {
  if (!entry || typeof entry !== 'object') return '';
  if (isStrictMonthlyGroupingMonth(entry.month)) return entry.month;
  if (isStrictMonthlyGroupingDate(entry.date)) return entry.date.slice(0, 7);
  if (isStrictMonthlyGroupingMonth(entry.date)) return entry.date;
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
export function historyMonthlyGroupingDelta(entry) {
  if (!entry || typeof entry !== 'object') return 0;
  if (entry.voided === true) return 0;
  const amountCents = finiteMonthlyGroupingCents(entry.amountCents);
  if (amountCents === null) return 0;
  const type = cleanMonthlyGroupingKey(entry.type);
  if (type === 'charge' || type === 'refund') return amountCents;
  if (type === 'payment' || type === 'advance' || type === 'adjustment') return -amountCents;
  if (type === 'credit') {
    return cleanMonthlyGroupingKey(entry.source) === 'adjustment' ? -amountCents : 0;
  }
  return 0;
}

function monthlyGroupingMonthIndex(month) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return year * 12 + (monthNumber - 1);
}

function monthlyGroupingMonthFromIndex(index) {
  const year = Math.floor(index / 12);
  const monthNumber = (index % 12) + 1;
  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and one
// decimal for a paisa remainder (PKR 1,500.5), the same shape the
// entry-screen formatters use.
export function formatMonthlyGroupingAmount(cents) {
  const amount = finiteMonthlyGroupingCents(cents);
  if (amount === null) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

export function historyMonthlyGroupingMonthLabel(month) {
  if (!isStrictMonthlyGroupingMonth(month)) return HISTORY_MONTHLY_GROUPING_UNDATED_LABEL;
  const monthNumber = Number(month.slice(5, 7));
  return `${HISTORY_MONTH_NAMES[monthNumber - 1]} ${month.slice(0, 4)}`;
}

function monthlyGroupingGroup(month, entries, carriedBalanceCents) {
  let billedCents = 0;
  let paidCents = 0;
  let closingBalanceCents = carriedBalanceCents;
  for (const entry of entries) {
    const delta = historyMonthlyGroupingDelta(entry);
    if (delta > 0) billedCents += delta;
    if (delta < 0) paidCents += -delta;
    const recorded = entry && typeof entry === 'object'
      ? finiteMonthlyGroupingCents(entry.runningBalanceCents)
      : null;
    if (recorded !== null) closingBalanceCents = recorded;
  }
  return {
    month,
    label: historyMonthlyGroupingMonthLabel(month),
    entries,
    entryCount: entries.length,
    billedCents,
    paidCents,
    stillOwedCents: billedCents - paidCents,
    closingBalanceCents,
  };
}

// One group per month, in ascending month order, from the earliest
// month to the latest month among the dated entries. A month in
// between with no transactions is an empty group, never skipped:
// it carries zero subtotals and the balance carried from the month
// before it. Entries with no month at all sit in a final group
// labelled "Month not recorded", so no entry is ever dropped. The
// input entries are never mutated and never reordered inside a
// month.
export function historyMonthlyGroupingGroups(entries) {
  if (!Array.isArray(entries)) return [];
  const byMonth = new Map();
  const undated = [];
  for (const entry of entries) {
    const month = historyMonthlyGroupingMonthOf(entry);
    if (month === '') {
      undated.push(entry);
      continue;
    }
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(entry);
  }
  const groups = [];
  if (byMonth.size > 0) {
    const months = Array.from(byMonth.keys()).sort();
    const firstIndex = monthlyGroupingMonthIndex(months[0]);
    const lastIndex = monthlyGroupingMonthIndex(months[months.length - 1]);
    let carriedBalanceCents = 0;
    for (let index = firstIndex; index <= lastIndex; index += 1) {
      const month = monthlyGroupingMonthFromIndex(index);
      const group = monthlyGroupingGroup(month, byMonth.get(month) ?? [], carriedBalanceCents);
      carriedBalanceCents = group.closingBalanceCents;
      groups.push(group);
    }
  }
  if (undated.length > 0) {
    const lastClosing = groups.length > 0
      ? groups[groups.length - 1].closingBalanceCents
      : 0;
    groups.push(monthlyGroupingGroup('', undated, lastClosing));
  }
  return groups;
}

// Totals over the entries given: billed is what increased what is
// owed, paid is what reduced it, still owed is billed minus paid,
// and the final balance is the running balance after the last
// entry. The still-owed total always equals the final balance,
// because every movement is either a billed amount or a paid one.
export function historyMonthlyGroupingTotals(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { entryCount: 0, billedCents: 0, paidCents: 0, stillOwedCents: 0, finalBalanceCents: 0 };
  }
  let billedCents = 0;
  let paidCents = 0;
  for (const entry of entries) {
    const delta = historyMonthlyGroupingDelta(entry);
    if (delta > 0) billedCents += delta;
    if (delta < 0) paidCents += -delta;
  }
  const last = entries[entries.length - 1];
  const final = last && typeof last === 'object'
    ? finiteMonthlyGroupingCents(last.runningBalanceCents)
    : null;
  return {
    entryCount: entries.length,
    billedCents,
    paidCents,
    stillOwedCents: billedCents - paidCents,
    finalBalanceCents: final === null ? 0 : final,
  };
}

// Verifies the grouping reconciles: the monthly subtotals summed
// over the groups must equal the totals over the entries given,
// and the summed still-owed must equal the final balance. Returns
// the figures on both sides so a mismatch names the gap.
export function historyMonthlyGroupingReconciliation(groups, entries) {
  const totals = historyMonthlyGroupingTotals(entries);
  let billedCents = 0;
  let paidCents = 0;
  let stillOwedCents = 0;
  if (Array.isArray(groups)) {
    for (const group of groups) {
      billedCents += finiteMonthlyGroupingCents(group?.billedCents) ?? 0;
      paidCents += finiteMonthlyGroupingCents(group?.paidCents) ?? 0;
      stillOwedCents += finiteMonthlyGroupingCents(group?.stillOwedCents) ?? 0;
    }
  }
  const ok = billedCents === totals.billedCents
    && paidCents === totals.paidCents
    && stillOwedCents === totals.stillOwedCents
    && stillOwedCents === totals.finalBalanceCents;
  return {
    ok,
    billedCents,
    paidCents,
    stillOwedCents,
    expectedBilledCents: totals.billedCents,
    expectedPaidCents: totals.paidCents,
    expectedStillOwedCents: totals.stillOwedCents,
    finalBalanceCents: totals.finalBalanceCents,
    message: ok
      ? `Monthly subtotals reconcile: billed ${formatMonthlyGroupingAmount(billedCents)}, paid ${formatMonthlyGroupingAmount(paidCents)}, still owed ${formatMonthlyGroupingAmount(stillOwedCents)}`
      : `Monthly subtotals do not reconcile: groups sum to billed ${formatMonthlyGroupingAmount(billedCents)} and paid ${formatMonthlyGroupingAmount(paidCents)}, expected billed ${formatMonthlyGroupingAmount(totals.billedCents)} and paid ${formatMonthlyGroupingAmount(totals.paidCents)}`,
  };
}

export function historyMonthlyGroupingGroupText(group) {
  if (!group || typeof group !== 'object') return '';
  const label = group.label || historyMonthlyGroupingMonthLabel(group.month || '');
  const billed = formatMonthlyGroupingAmount(group.billedCents);
  const paid = formatMonthlyGroupingAmount(group.paidCents);
  const owed = formatMonthlyGroupingAmount(group.stillOwedCents);
  if (group.entryCount === 0) {
    return `${label} · No transactions · Billed ${billed} · Paid ${paid} · Still owed ${owed}`;
  }
  const count = group.entryCount === 1 ? '1 entry' : `${group.entryCount} entries`;
  return `${label} · ${count} · Billed ${billed} · Paid ${paid} · Still owed ${owed}`;
}

export function historyMonthlyGroupingSummaryText(shownEntries, allEntries) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) {
    return HISTORY_MONTHLY_GROUPING_EMPTY_TEXT;
  }
  const groups = historyMonthlyGroupingGroups(shownEntries);
  const totals = historyMonthlyGroupingTotals(shownEntries);
  const months = groups.length === 1 ? '1 month' : `${groups.length} months`;
  const line = `${months} · Billed ${formatMonthlyGroupingAmount(totals.billedCents)} · Paid ${formatMonthlyGroupingAmount(totals.paidCents)} · Still owed ${formatMonthlyGroupingAmount(totals.stillOwedCents)}`;
  const full = Array.isArray(allEntries) ? allEntries : shownEntries;
  if (full.length === shownEntries.length) return line;
  const fullTotals = historyMonthlyGroupingTotals(full);
  return `${line} · Full history: Billed ${formatMonthlyGroupingAmount(fullTotals.billedCents)} · Paid ${formatMonthlyGroupingAmount(fullTotals.paidCents)} · Still owed ${formatMonthlyGroupingAmount(fullTotals.stillOwedCents)}`;
}

function escapeMonthlyGroupingHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The monthly grouping: one table over the shown entries, one row
// per month in ascending order — month, entries, billed, paid,
// still owed — plus a totals footer taken from the shown months,
// so a filtered view still totals only what it shows. When the
// view is filtered, a second footer row carries the full-history
// totals, so the whole year stays checkable. The table reuses the
// statement table classes the app already ships, so it adds no new
// styles. An empty shown list renders nothing.
export function historyMonthlyGroupingHtml(shownEntries, allEntries) {
  if (!Array.isArray(shownEntries) || shownEntries.length === 0) return '';
  const groups = historyMonthlyGroupingGroups(shownEntries);
  const totals = historyMonthlyGroupingTotals(shownEntries);
  const body = groups.map((group) => {
    const label = group.entryCount === 0
      ? `${group.label} · No transactions`
      : group.label;
    const count = group.entryCount === 0 ? '0' : String(group.entryCount);
    const owedClass = group.stillOwedCents > 0 ? 'is-due' : 'is-settled';
    return `<tr><td>${escapeMonthlyGroupingHtml(label)}</td><td class="col-num">${escapeMonthlyGroupingHtml(count)}</td><td class="col-num">${escapeMonthlyGroupingHtml(formatMonthlyGroupingAmount(group.billedCents))}</td><td class="col-num">${escapeMonthlyGroupingHtml(formatMonthlyGroupingAmount(group.paidCents))}</td><td class="col-num balance-num ${owedClass}">${escapeMonthlyGroupingHtml(formatMonthlyGroupingAmount(group.stillOwedCents))}</td></tr>`;
  }).join('');
  const totalsOwedClass = totals.stillOwedCents > 0 ? 'is-due' : 'is-settled';
  let footer = `<tr><td colspan="2"><strong>Totals</strong></td><td class="col-num"><strong>${escapeMonthlyGroupingHtml(formatMonthlyGroupingAmount(totals.billedCents))}</strong></td><td class="col-num"><strong>${escapeMonthlyGroupingHtml(formatMonthlyGroupingAmount(totals.paidCents))}</strong></td><td class="col-num balance-num ${totalsOwedClass}"><strong>${escapeMonthlyGroupingHtml(formatMonthlyGroupingAmount(totals.stillOwedCents))}</strong></td></tr>`;
  const full = Array.isArray(allEntries) ? allEntries : shownEntries;
  if (full.length !== shownEntries.length) {
    const fullTotals = historyMonthlyGroupingTotals(full);
    const fullOwedClass = fullTotals.stillOwedCents > 0 ? 'is-due' : 'is-settled';
    footer += `<tr><td colspan="2"><strong>Full history</strong></td><td class="col-num"><strong>${escapeMonthlyGroupingHtml(formatMonthlyGroupingAmount(fullTotals.billedCents))}</strong></td><td class="col-num"><strong>${escapeMonthlyGroupingHtml(formatMonthlyGroupingAmount(fullTotals.paidCents))}</strong></td><td class="col-num balance-num ${fullOwedClass}"><strong>${escapeMonthlyGroupingHtml(formatMonthlyGroupingAmount(fullTotals.stillOwedCents))}</strong></td></tr>`;
  }
  return `<table class="statement-table"><thead><tr><th>Month</th><th class="col-num">Entries</th><th class="col-num">Billed</th><th class="col-num">Paid</th><th class="col-num">Still owed</th></tr></thead><tbody>${body}</tbody><tfoot>${footer}</tfoot></table>`;
}
