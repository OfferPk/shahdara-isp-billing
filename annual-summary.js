// Plan 71 (Plan 1-100) — Annual owner summary (composition only,
// from the twelve monthly closes).
//
// COMPOSITION ONLY. This module computes NOTHING new about what was
// collected, spent, joined, or left, and changes no monthly pack and
// no live record. It assembles one read-only year view from figures
// the app already produces, in the same spirit as Plans 6 + 10 (period
// variants of one composition, not separate engines) and Plan R (the
// monthly pack): the caller supplies one row per month carrying the
// month's collections and expenses (Plan 10 net-position figures,
// or the frozen Plan 70 snapshot's collections and expense total),
// its new activations, departures, and churn rate (Plan 60), and
// whether that month has a frozen closed snapshot (Plan 70). This
// module only adds those twelve rows up and reconciles them.
//
// Honesty rules, stated plainly rather than hidden:
//   - A month with no row at all, or a month whose frozen snapshot
//     is missing, is flagged as incomplete — never estimated, never
//     filled with a guessed figure. Totals then cover only the months
//     that supplied a usable figure, and the summary text says so in
//     plain words ("partial: covers N of 12 months").
//   - A caller may instead supply live figures for an unfrozen month
//     (Owner 5-part fix): the row carries live: true, the month is
//     listed in liveMonths, and the summary text and table say so
//     plainly ("Includes live/unfrozen months"). A live figure never
//     rewrites a frozen month — a frozen snapshot always wins where
//     one exists, and the live row is only the caller's fallback.
//   - An unusable figure (blank, boolean, negative, non-finite, or a
//     fractional customer count) contributes nothing to its total and
//     is named in `unusable`, never silently zero-filled.
//   - Year start is the customers-at-start figure of January, or of
//     the earliest supplied month that carries one; year end is the
//     customers-at-end figure of December, or of the latest supplied
//     month that carries one. Growth is end minus start, and the
//     annual churn rate is total departures divided by year-start
//     customers — both null when their inputs are missing, never
//     computed against a guessed zero.
//   - Reconciliation is checked, never forced: year start plus total
//     new minus total departed must equal year end; a mismatch shows
//     its difference plainly, and each month's own start + new -
//     departed = end check is carried the same way.
//   - Money sums in integer cents, so no float drift. A churn rate
//     is carried verbatim from the caller (Plan 60's figure); this
//     module never recounts customers to re-derive a monthly rate.
//
// The summary is READ-ONLY: buildAnnualSummary is a pure function of
// its input. It writes nothing, stores nothing, and mutates no input.
// Printable / exportable forms are annualSummaryHtml and
// annualSummaryCsv. The module holds no bill, payment, snapshot, or
// customer record of its own — only the monthly aggregate figures
// the caller supplies.

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function csvCell(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** A valid calendar year (four digits), or '' when invalid. */
export function validAnnualYear(value) {
  const year = text(value);
  return YEAR_RE.test(year) ? year : '';
}

/** The twelve months of a year, in order, or [] for an invalid year. */
export function monthsOfYear(year) {
  const clean = validAnnualYear(year);
  if (!clean) return [];
  return Array.from({ length: 12 }, (_, i) => `${clean}-${String(i + 1).padStart(2, '0')}`);
}

function toCents(amount) {
  if (amount === null || amount === undefined || amount === '' || typeof amount === 'boolean') return null;
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function fromCents(cents) {
  if (cents === null || cents === undefined) return null;
  return cents / 100;
}

function toCount(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

function toRate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

function normalizeMonthRow(raw, year) {
  if (!raw || typeof raw !== 'object') return null;
  const month = text(raw.month);
  if (!MONTH_RE.test(month) || !month.startsWith(`${year}-`)) return null;
  return {
    month,
    collectionsCents: toCents(raw.collections),
    expensesCents: toCents(raw.expenses),
    newCustomers: toCount(raw.newCustomers),
    departed: toCount(raw.departed),
    customersStart: toCount(raw.customersStart),
    customersEnd: toCount(raw.customersEnd),
    churnRate: toRate(raw.churnRate),
    snapshotClosed: raw.snapshotClosed === true,
    snapshotCloseDate: text(raw.snapshotCloseDate) || null,
    // Owner 5-part fix: live is a caller-supplied flag — the month's
    // figures come from the live ledger, not a frozen snapshot.
    live: raw.live === true,
    raw,
  };
}

/**
 * Pure: builds the annual summary for `year` from caller-supplied
 * monthly rows. Returns null for an invalid year. Every monthly
 * figure is carried verbatim; nothing is estimated for a missing
 * month or a missing snapshot — both are flagged instead.
 */
export function buildAnnualSummary({ year, months = [] } = {}) {
  const cleanYear = validAnnualYear(year);
  if (!cleanYear) return null;
  const expected = monthsOfYear(cleanYear);
  const byMonth = new Map();
  const ignored = [];
  for (const raw of Array.isArray(months) ? months : []) {
    const row = normalizeMonthRow(raw, cleanYear);
    if (!row) { ignored.push(text(raw && raw.month) || '(no month)'); continue; }
    if (byMonth.has(row.month)) { ignored.push(row.month); continue; }
    byMonth.set(row.month, row);
  }

  const unusable = [];
  const rows = expected.map((month) => {
    const row = byMonth.get(month);
    if (!row) {
      return {
        month, present: false, snapshotClosed: false, live: false,
        collections: null, expenses: null, net: null,
        newCustomers: null, departed: null,
        customersStart: null, customersEnd: null,
        churnRate: null, reconciles: null, difference: null,
      };
    }
    if (row.collectionsCents === null) unusable.push(`${month}: collections`);
    if (row.expensesCents === null) unusable.push(`${month}: expenses`);
    if (row.newCustomers === null) unusable.push(`${month}: new customers`);
    if (row.departed === null) unusable.push(`${month}: departures`);
    const netCents = row.collectionsCents !== null && row.expensesCents !== null
      ? row.collectionsCents - row.expensesCents : null;
    const reconciles = row.customersStart !== null && row.newCustomers !== null
      && row.departed !== null && row.customersEnd !== null
      ? row.customersStart + row.newCustomers - row.departed === row.customersEnd : null;
    const difference = reconciles === false
      ? (row.customersStart + row.newCustomers - row.departed) - row.customersEnd : null;
    return {
      month, present: true, snapshotClosed: row.snapshotClosed,
      live: row.live === true,
      collections: fromCents(row.collectionsCents),
      expenses: fromCents(row.expensesCents),
      net: fromCents(netCents),
      newCustomers: row.newCustomers,
      departed: row.departed,
      customersStart: row.customersStart,
      customersEnd: row.customersEnd,
      churnRate: row.churnRate,
      churnRatePercent: row.churnRate === null ? null : Math.round(row.churnRate * 1000) / 10,
      reconciles, difference,
    };
  });

  const sumCents = (key) => rows.reduce(
    (total, row) => total + (row[key] === null ? 0 : Math.round(row[key] * 100)), 0);
  const monthsWith = (key) => rows.filter((row) => row[key] !== null).length;
  const sumCounts = (key) => rows.reduce(
    (total, row) => total + (row[key] === null ? 0 : row[key]), 0);

  const collectionsTotal = fromCents(sumCents('collections'));
  const expensesTotal = fromCents(sumCents('expenses'));
  const netTotal = collectionsTotal !== null && expensesTotal !== null
    ? collectionsTotal - expensesTotal : null;
  const newTotal = sumCounts('newCustomers');
  const departedTotal = sumCounts('departed');

  const firstStart = rows.find((row) => row.customersStart !== null);
  const lastEnd = [...rows].reverse().find((row) => row.customersEnd !== null);
  const yearStart = firstStart ? firstStart.customersStart : null;
  const yearEnd = lastEnd ? lastEnd.customersEnd : null;
  const growth = yearStart !== null && yearEnd !== null ? yearEnd - yearStart : null;
  const annualChurnRate = yearStart !== null && yearStart > 0 ? departedTotal / yearStart : null;
  const reconciles = yearStart !== null && yearEnd !== null
    ? yearStart + newTotal - departedTotal === yearEnd : null;
  const difference = reconciles === false
    ? (yearStart + newTotal - departedTotal) - yearEnd : null;

  const missingMonths = rows.filter((row) => !row.present).map((row) => row.month);
  const snapshotMissingMonths = rows.filter((row) => !row.snapshotClosed).map((row) => row.month);
  // Owner 5-part fix: months whose figures come from the live ledger
  // (no frozen snapshot) are listed, so the text, table, and CSV can
  // all say plainly which months are live. A frozen month never
  // counts as live, even if a caller also sets the live flag.
  const liveMonths = rows.filter((row) => row.present && row.live && !row.snapshotClosed).map((row) => row.month);
  const complete = missingMonths.length === 0 && snapshotMissingMonths.length === 0
    && unusable.length === 0;
  const monthsCovered = rows.filter((row) => row.present).length;

  return {
    year: cleanYear,
    months: rows,
    collectionsTotal,
    expensesTotal,
    netTotal,
    collectionsMonths: monthsWith('collections'),
    expensesMonths: monthsWith('expenses'),
    newTotal,
    departedTotal,
    yearStart,
    yearEnd,
    growth,
    annualChurnRate,
    annualChurnRatePercent: annualChurnRate === null ? null : Math.round(annualChurnRate * 1000) / 10,
    reconciles,
    difference,
    complete,
    monthsCovered,
    missingMonths,
    snapshotMissingMonths,
    liveMonths,
    unusable,
    ignored,
    basis: 'Annual figures are the sum of the twelve monthly figures supplied by the caller ' +
      '(collections and expenses from the Plan 10 net-position figures or the frozen Plan 70 ' +
      'snapshots; new activations, departures, and churn from the Plan 60 monthly summaries). ' +
      'No new metric is calculated and no monthly pack or live record is changed. A month with ' +
      'no row, or with no frozen snapshot, is flagged incomplete rather than estimated.',
  };
}

/** Plain-words summary of one annual view. */
export function annualSummaryText(view) {
  if (!view) return '';
  const money = (value) => (value === null ? 'not recorded' : `Rs. ${value.toLocaleString('en-PK')}`);
  const lines = [
    `${view.year}: collections ${money(view.collectionsTotal)}, expenses ${money(view.expensesTotal)}, ` +
    `net ${money(view.netTotal)}; new ${view.newTotal}, departed ${view.departedTotal}, ` +
    `customers ${view.yearStart ?? 'not recorded'} → ${view.yearEnd ?? 'not recorded'} ` +
    `(growth ${view.growth ?? 'not recorded'}); annual churn ` +
    (view.annualChurnRatePercent === null ? 'not recorded' : `${view.annualChurnRatePercent}%`) + '.',
  ];
  if (view.reconciles === false) {
    lines.push(`Does not reconcile: year start + new − departed differs from year end by ${view.difference}.`);
  }
  if (!view.complete) {
    lines.push(
      `Incomplete — not estimated: covers ${view.monthsCovered} of 12 months` +
      (view.missingMonths.length ? `; missing months: ${view.missingMonths.join(', ')}` : '') +
      (view.snapshotMissingMonths.length ? `; months without a frozen snapshot: ${view.snapshotMissingMonths.join(', ')}` : '') +
      (view.unusable.length ? `; unusable figures named, not zero-filled: ${view.unusable.join(', ')}` : '') + '.',
    );
  } else {
    lines.push('Complete: all twelve months supplied with frozen snapshots.');
  }
  // Owner 5-part fix: say plainly which months are live, so a year
  // total built from live figures is never mistaken for frozen ones.
  if (view.liveMonths && view.liveMonths.length) {
    lines.push(`Includes live/unfrozen months: ${view.liveMonths.join(', ')} — figures for those months come from the live ledger, not a frozen snapshot.`);
  }
  return lines.join(' ');
}

/** Printable HTML table for one annual view. */
export function annualSummaryHtml(view) {
  if (!view) return '';
  const money = (value) => (value === null ? '—' : `Rs. ${Number(value).toLocaleString('en-PK')}`);
  const num = (value) => (value === null ? '—' : String(value));
  const pct = (value) => (value === null ? '—' : `${value}%`);
  const body = view.months.map((row) => `<tr><td>${escapeHtml(row.month)}</td>` +
    `<td>${money(row.collections)}</td><td>${money(row.expenses)}</td><td>${money(row.net)}</td>` +
    `<td>${num(row.newCustomers)}</td><td>${num(row.departed)}</td>` +
    `<td>${num(row.customersStart)} → ${num(row.customersEnd)}</td>` +
    `<td>${pct(row.churnRatePercent)}</td>` +
    `<td>${row.snapshotClosed ? 'Frozen' : row.live ? 'Live' : 'No snapshot'}</td>` +
    `<td>${row.reconciles === null ? '—' : row.reconciles ? 'Yes' : `No (${row.difference})`}</td></tr>`).join('');
  // Owner 5-part fix: a live badge names the fallback where the owner
  // reads it, and the ten-column table scrolls inside its own card
  // on a phone instead of clipping the right-side columns.
  const liveBadge = view.liveMonths && view.liveMonths.length
    ? `<p style="font-size: 12px;"><span class="local-only-badge">Includes live/unfrozen months</span></p>` : '';
  return `<p style="font-size: 12px;">${escapeHtml(annualSummaryText(view))}</p>` + liveBadge +
    '<div class="table-scroll"><table style="font-size: 12px; border-collapse: collapse;"><thead><tr>' +
    '<th>Month</th><th>Collections</th><th>Expenses</th><th>Net</th><th>New</th><th>Departed</th>' +
    '<th>Customers start → end</th><th>Churn</th><th>Snapshot</th><th>Reconciles</th></tr></thead>' +
    `<tbody>${body}</tbody><tfoot><tr><td><strong>Year ${escapeHtml(view.year)}</strong></td>` +
    `<td><strong>${money(view.collectionsTotal)}</strong></td>` +
    `<td><strong>${money(view.expensesTotal)}</strong></td>` +
    `<td><strong>${money(view.netTotal)}</strong></td>` +
    `<td><strong>${view.newTotal}</strong></td><td><strong>${view.departedTotal}</strong></td>` +
    `<td><strong>${num(view.yearStart)} → ${num(view.yearEnd)}</strong></td>` +
    `<td><strong>${pct(view.annualChurnRatePercent)}</strong></td><td></td>` +
    `<td><strong>${view.reconciles === null ? '—' : view.reconciles ? 'Yes' : `No (${view.difference})`}</strong></td>` +
    '</tr></tfoot></table></div>';
}

/** CSV export for one annual view: one row per month plus a year total row. */
export function annualSummaryCsv(view) {
  if (!view) return '';
  const lines = [
    ['Month', 'Collections', 'Expenses', 'Net', 'New', 'Departed', 'Customers start', 'Customers end', 'Churn %', 'Snapshot frozen', 'Live', 'Reconciles'].map(csvCell).join(','),
  ];
  for (const row of view.months) {
    lines.push([
      row.month, row.collections ?? '', row.expenses ?? '', row.net ?? '',
      row.newCustomers ?? '', row.departed ?? '', row.customersStart ?? '', row.customersEnd ?? '',
      row.churnRatePercent ?? '', row.snapshotClosed ? 'yes' : 'no', row.live ? 'yes' : 'no',
      row.reconciles === null ? '' : row.reconciles ? 'yes' : 'no',
    ].map(csvCell).join(','));
  }
  lines.push([
    `Year ${view.year}`, view.collectionsTotal ?? '', view.expensesTotal ?? '', view.netTotal ?? '',
    view.newTotal, view.departedTotal, view.yearStart ?? '', view.yearEnd ?? '',
    view.annualChurnRatePercent ?? '', '', (view.liveMonths && view.liveMonths.length) ? 'yes' : 'no', view.reconciles === null ? '' : view.reconciles ? 'yes' : 'no',
  ].map(csvCell).join(','));
  return `${lines.join('\n')}\n`;
}

/** Export filename for one year. */
export function annualSummaryFilename(year) {
  const clean = validAnnualYear(year);
  return clean ? `annual-owner-summary-${clean}.csv` : 'annual-owner-summary.csv';
}
