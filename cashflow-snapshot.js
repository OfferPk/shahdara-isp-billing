// Plan 10 (Plan 1-100) — Month cash-flow snapshot (collections versus expenses).
//
// COMPOSITION ONLY. This module computes NOTHING new about what was
// collected or spent, and changes no total and no expense rule. It
// assembles one short, read-only month snapshot from figures the app
// already produces, so the owner sees the month's net position in one
// place instead of noticing expenses only after they have quietly
// eaten a healthy-looking collection month:
//
//   - collected in the month (receipt-date cash, as the Analytics
//     cash-collection figures use it; voided receipts are already
//     skipped by the payment-entries builder the caller uses),
//   - expenses in the month (dated expense records, as the P&L
//     screen sums them for the same month),
//   - net (collected minus expenses),
//   - a projected month-end figure from the current run rate.
//
// The module is import-free by design (like owner-digest.js and
// receivables-ageing.js), so it can be used without pulling in the
// app graph. The caller supplies every figure together with the name
// of the screen it came from (`sourceScreen`); the snapshot carries
// each figure verbatim and labels it with that source, so every
// figure traces to its home screen on the same fixture. It never
// recounts payments or expense entries itself.
//
// Projection rules, stated plainly rather than hidden:
//   - daysElapsed counts calendar days of the snapshot month up to
//     and including the as-of date, clamped to the month (an as-of
//     date before the month gives 0 elapsed days; one after the
//     month gives the whole month).
//   - The run rate is simply amount-so-far divided by daysElapsed,
//     projected over the month's total days at that same rate. It is
//     an arithmetic run-rate estimate, not a forecast and not a
//     promise: the snapshot's basis sentence always says, in plain
//     words, how many days have elapsed, how many the month has,
//     and what daily rate was used.
//   - With 0 days elapsed there is no run rate, so the projected
//     figures are null and the basis says so instead of inventing
//     a projection. When the month is complete, the projected
//     figures equal the actual figures.
//   - When an expense item list is supplied alongside a stated
//     expense total, the snapshot reports both the stated total and
//     the sum of the listed items, with a `consistent` flag. It
//     never silently "fixes" a source that disagrees with itself.
//
// The snapshot is READ-ONLY: buildCashflowSnapshot is a pure
// function of its input. It writes nothing, stores nothing, and
// mutates no input. Printable / exportable forms are
// cashflowSnapshotHtml (a section the caller can print) and
// cashflowSnapshotCsv (headline figures plus expense-category rows).

export const SNAPSHOT_STATUSES = Object.freeze({
  SURPLUS: 'surplus',
  DEFICIT: 'deficit',
  BREAK_EVEN: 'break_even',
  NO_ACTIVITY: 'no_activity',
});

export const SNAPSHOT_STATUS_LABELS = Object.freeze({
  surplus: 'Surplus',
  deficit: 'Deficit',
  break_even: 'Break-even',
  no_activity: 'No activity yet',
});

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function count(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
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

function escapeCsv(value) {
  const s = str(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatAmount(value) {
  return `Rs. ${num(value).toLocaleString('en-US')}`;
}

/** Strict YYYY-MM validation against the real calendar. */
export function isValidSnapshotMonth(value) {
  if (!MONTH_RE.test(str(value))) return false;
  const month = Number(str(value).slice(5, 7));
  return month >= 1 && month <= 12;
}

/** Strict YYYY-MM-DD validation against the real calendar (leap-aware). */
export function isValidSnapshotDate(value) {
  if (!DATE_RE.test(str(value))) return false;
  const [y, m, d] = str(value).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Human label for a snapshot month, e.g. "November 2026". */
export function snapshotMonthLabel(month) {
  if (!isValidSnapshotMonth(month)) return '';
  const [y, m] = str(month).split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * The first day, last day, and day count of a snapshot month
 * (UTC calendar days, matching the app's date-string convention).
 * Returns { valid: false } for an invalid month.
 */
export function monthRange(month) {
  if (!isValidSnapshotMonth(month)) {
    return { valid: false, startDate: '', endDate: '', daysInMonth: 0 };
  }
  const [y, m] = str(month).split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return {
    valid: true,
    startDate: `${y}-${mm}-01`,
    endDate: `${y}-${mm}-${String(daysInMonth).padStart(2, '0')}`,
    daysInMonth,
  };
}

/**
 * Calendar days of the month elapsed up to and including `asOfDate`,
 * clamped to the month: 0 before the month starts, the whole month
 * once the as-of date is past its end.
 */
export function daysElapsedInMonth(month, asOfDate) {
  const range = monthRange(month);
  if (!range.valid || !isValidSnapshotDate(asOfDate)) return 0;
  if (str(asOfDate) < range.startDate) return 0;
  if (str(asOfDate) >= range.endDate) return range.daysInMonth;
  return Number(str(asOfDate).slice(8, 10));
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({ ...(item ?? {}) }));
}

function itemsTotal(items) {
  return items.reduce((sum, item) => sum + num(item?.amount), 0);
}

function expenseCategories(items) {
  const byCategory = new Map();
  for (const item of items) {
    const category = str(item?.category).trim() || 'Uncategorised';
    const entry = byCategory.get(category) ?? { category, amount: 0, count: 0 };
    entry.amount += num(item?.amount);
    entry.count += 1;
    byCategory.set(category, entry);
  }
  return [...byCategory.values()].sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

/**
 * Pure: builds one month cash-flow snapshot from caller-supplied
 * source figures.
 *
 * Input shape:
 *   {
 *     month: 'YYYY-MM',
 *     asOfDate: 'YYYY-MM-DD',          // "today" for the run rate
 *     collected: { amount, count, sourceScreen },
 *     expenses: { amount, count, items, sourceScreen },
 *       // items are optional expense records { amount, category }
 *   }
 *
 * An invalid month or as-of date yields { valid: false }. Amounts
 * are rounded to whole rupees, matching the owner digest's
 * convention; the app's amounts are whole rupees in practice.
 */
export function buildCashflowSnapshot(input = {}) {
  const month = str(input.month);
  const asOfDate = str(input.asOfDate);
  const range = monthRange(month);
  const invalid = {
    valid: false, month, monthLabel: snapshotMonthLabel(month),
    asOfDate, startDate: range.startDate, endDate: range.endDate,
    daysInMonth: range.daysInMonth, daysElapsed: 0,
    collected: null, expenses: null, net: 0, status: SNAPSHOT_STATUSES.NO_ACTIVITY,
    collectedRunRate: 0, expensesRunRate: 0,
    projectedCollected: null, projectedExpenses: null, projectedNet: null,
    projectionBasis: '', expenseCategories: [], expensesConsistent: true,
    sources: [], summary: '',
  };
  if (!range.valid || !isValidSnapshotDate(asOfDate)) return invalid;

  const collectedIn = input.collected && typeof input.collected === 'object' ? input.collected : {};
  const expensesIn = input.expenses && typeof input.expenses === 'object' ? input.expenses : {};
  const collectedAmount = num(collectedIn.amount);
  const collectedCount = count(collectedIn.count);
  const expensesAmount = num(expensesIn.amount);
  const expensesCount = count(expensesIn.count);
  const expenseItems = normalizeItems(expensesIn.items);
  const expenseItemsTotal = itemsTotal(expenseItems);
  const expensesConsistent = expenseItems.length === 0 || expenseItemsTotal === expensesAmount;
  const categories = expenseCategories(expenseItems).map((row) => ({
    ...row,
    sharePercent: expensesAmount > 0 ? Math.round((row.amount / expensesAmount) * 1000) / 10 : 0,
  }));

  const daysElapsed = daysElapsedInMonth(month, asOfDate);
  const net = collectedAmount - expensesAmount;
  const status = collectedAmount === 0 && expensesAmount === 0
    ? SNAPSHOT_STATUSES.NO_ACTIVITY
    : net > 0 ? SNAPSHOT_STATUSES.SURPLUS
    : net < 0 ? SNAPSHOT_STATUSES.DEFICIT
    : SNAPSHOT_STATUSES.BREAK_EVEN;

  let collectedRunRate = 0;
  let expensesRunRate = 0;
  let projectedCollected = null;
  let projectedExpenses = null;
  let projectedNet = null;
  let projectionBasis = '';
  if (daysElapsed === 0) {
    projectionBasis = `No days of ${snapshotMonthLabel(month)} have elapsed yet (as of ${asOfDate}), so there is no run rate to project from — the projected month-end figure is not shown.`;
  } else if (daysElapsed >= range.daysInMonth) {
    collectedRunRate = collectedAmount / range.daysInMonth;
    expensesRunRate = expensesAmount / range.daysInMonth;
    projectedCollected = collectedAmount;
    projectedExpenses = expensesAmount;
    projectedNet = net;
    projectionBasis = `Month complete: all ${range.daysInMonth} days of ${snapshotMonthLabel(month)} have elapsed, so the projected month-end figure is the actual figure.`;
  } else {
    collectedRunRate = collectedAmount / daysElapsed;
    expensesRunRate = expensesAmount / daysElapsed;
    projectedCollected = Math.round(collectedRunRate * range.daysInMonth);
    projectedExpenses = Math.round(expensesRunRate * range.daysInMonth);
    projectedNet = projectedCollected - projectedExpenses;
    projectionBasis = `Projection: ${daysElapsed} of ${range.daysInMonth} days of ${snapshotMonthLabel(month)} have elapsed (as of ${asOfDate}); collected run rate ${formatAmount(collectedRunRate)}/day and expenses run rate ${formatAmount(expensesRunRate)}/day, projected to month-end at the same run rate. This is a run-rate estimate, not a promise.`;
  }

  const collectedSource = str(collectedIn.sourceScreen);
  const expensesSource = str(expensesIn.sourceScreen);
  const sources = [];
  if (collectedSource) sources.push(collectedSource);
  if (expensesSource && expensesSource !== collectedSource) sources.push(expensesSource);

  const snapshot = {
    valid: true, month, monthLabel: snapshotMonthLabel(month),
    asOfDate, startDate: range.startDate, endDate: range.endDate,
    daysInMonth: range.daysInMonth, daysElapsed,
    collected: { amount: collectedAmount, count: collectedCount, sourceScreen: collectedSource },
    expenses: {
      amount: expensesAmount, count: expensesCount, sourceScreen: expensesSource,
      itemsTotal: expenseItemsTotal, itemsCount: expenseItems.length,
    },
    net, status, statusLabel: SNAPSHOT_STATUS_LABELS[status],
    collectedRunRate, expensesRunRate,
    projectedCollected, projectedExpenses, projectedNet,
    projectionBasis, expenseCategories: categories,
    expensesConsistent, sources,
    summary: '',
  };
  snapshot.summary = cashflowSnapshotSummary(snapshot);
  return snapshot;
}

/** One-line summary of a snapshot ('' for an invalid snapshot). */
export function cashflowSnapshotSummary(snapshot) {
  if (!snapshot || !snapshot.valid) return '';
  const projected = snapshot.projectedNet === null
    ? 'no projection yet'
    : `projected month-end net ${formatAmount(snapshot.projectedNet)}`;
  return `${snapshot.monthLabel}: collected ${formatAmount(snapshot.collected.amount)}, expenses ${formatAmount(snapshot.expenses.amount)}, net ${formatAmount(snapshot.net)} (${snapshot.statusLabel.toLowerCase()}), ${projected}.`;
}

/** File name for a snapshot export, e.g. cashflow-snapshot-2026-11.csv. */
export function cashflowSnapshotFilename(snapshot) {
  if (!snapshot || !snapshot.valid) return 'cashflow-snapshot.csv';
  return `cashflow-snapshot-${snapshot.month}.csv`;
}

/** Printable HTML section for a snapshot. */
export function cashflowSnapshotHtml(snapshot) {
  if (!snapshot || !snapshot.valid) return '<p class="empty-state">Cash-flow snapshot unavailable.</p>';
  const rows = [
    ['Collected', formatAmount(snapshot.collected.amount), `${snapshot.collected.count} receipt${snapshot.collected.count === 1 ? '' : 's'}`, snapshot.collected.sourceScreen],
    ['Expenses', formatAmount(snapshot.expenses.amount), `${snapshot.expenses.count} entr${snapshot.expenses.count === 1 ? 'y' : 'ies'}`, snapshot.expenses.sourceScreen],
    ['Net', formatAmount(snapshot.net), snapshot.statusLabel, 'Collected minus expenses'],
  ];
  if (snapshot.projectedNet !== null) {
    rows.push(['Projected month-end net', formatAmount(snapshot.projectedNet), `Projected collected ${formatAmount(snapshot.projectedCollected)}, projected expenses ${formatAmount(snapshot.projectedExpenses)}`, 'Run rate, see basis below']);
  }
  const categoryRows = snapshot.expenseCategories.map((row) => (
    `<tr><td>${escapeHtml(row.category)}</td><td>${formatAmount(row.amount)}</td><td>${row.count}</td><td>${row.sharePercent}%</td></tr>`
  )).join('');
  return `<div class="cashflow-snapshot"><h4>${escapeHtml(snapshot.monthLabel)} cash-flow snapshot</h4>`
    + `<table><thead><tr><th>Figure</th><th>Amount</th><th>Detail</th><th>Source</th></tr></thead><tbody>`
    + rows.map(([label, amount, detail, source]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(amount)}</td><td>${escapeHtml(detail)}</td><td>${escapeHtml(source)}</td></tr>`).join('')
    + `</tbody></table><p class="foot">${escapeHtml(snapshot.projectionBasis)}</p>`
    + (snapshot.expensesConsistent ? '' : `<p class="foot">Note: the listed expense items sum to ${formatAmount(snapshot.expenses.itemsTotal)}, which differs from the stated expense total ${formatAmount(snapshot.expenses.amount)} — the stated total is shown, not silently fixed.</p>`)
    + (categoryRows
      ? `<table><thead><tr><th>Expense category</th><th>Amount</th><th>Entries</th><th>Share of expenses</th></tr></thead><tbody>${categoryRows}</tbody></table>`
      : '<p class="empty-state">No expense items listed for this month.</p>')
    + '</div>';
}

/** CSV export: headline figures, basis, then one row per expense category. */
export function cashflowSnapshotCsv(snapshot) {
  if (!snapshot || !snapshot.valid) return '';
  const lines = [
    'figure,amount,detail,source',
    ['Collected', snapshot.collected.amount, `${snapshot.collected.count} receipts`, snapshot.collected.sourceScreen].map(escapeCsv).join(','),
    ['Expenses', snapshot.expenses.amount, `${snapshot.expenses.count} entries`, snapshot.expenses.sourceScreen].map(escapeCsv).join(','),
    ['Net', snapshot.net, snapshot.statusLabel, 'Collected minus expenses'].map(escapeCsv).join(','),
  ];
  if (snapshot.projectedNet !== null) {
    lines.push(['Projected month-end net', snapshot.projectedNet, `Projected collected ${snapshot.projectedCollected}, projected expenses ${snapshot.projectedExpenses}`, 'Run rate'].map(escapeCsv).join(','));
  }
  lines.push(['Projection basis', '', snapshot.projectionBasis, ''].map(escapeCsv).join(','));
  lines.push('expense category,amount,entries,share of expenses');
  for (const row of snapshot.expenseCategories) {
    lines.push([row.category, row.amount, row.count, `${row.sharePercent}%`].map(escapeCsv).join(','));
  }
  return `${lines.join('\n')}\n`;
}
