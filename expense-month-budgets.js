// Plan 42 (Plan 1-100) — Expense category budgets with a
// budget-versus-actual view.
//
// Expenses are recorded but never compared against a plan, so the
// owner only learns a category has overspent when the month's cash
// is already gone. This module writes the plan down: one budget per
// (expense category, month), and a read-only view that compares that
// month's budget against the month's recorded expenses, category by
// category.
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies every budget and every
//     expense row, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - Budgets are targets, never caps: setting a budget never blocks
//     a payment, never changes any total, and never rewrites a past
//     expense. Changing a budget only changes this view.
//   - A category with no budget for the month shows as "Unbudgeted"
//     with a null budget, null remaining, and null variance — never
//     as a zero budget, so an unbudgeted category can never look
//     like a category that planned to spend nothing.
//   - This is NOT the SISP-134 expense-budget-caps system, and it
//     neither reads nor writes that store. SISP-134 keeps one cap
//     per category (a single { category: cap } object) that applies
//     to whichever month its P&L modal shows, and surfaces it only
//     as progress bars for capped categories plus a warn/over
//     callout. What SISP-134 cannot express is a different target
//     for a different month, and it has no standalone view showing
//     budget, actual, remaining, and variance for every category
//     including the unbudgeted ones. Those two gaps are exactly
//     what this module adds; the two stores stay separate so
//     neither system can silently overwrite the other.
//   - Actuals follow the expense ledger's own month rule (a row
//     counts for the month its payment date falls in), with two
//     honesty rules on top: a row with an impossible date
//     (2026-02-30) is excluded, never counted for a month it is
//     not really in, and a row with a non-finite or negative
//     amount is excluded, never counted as zero. Excluded rows
//     are counted in the totals, never hidden. A blank category
//     falls back to "Other expenses", the same fallback the
//     ledger's own category totals use. Money is summed in
//     integer cents, so no float drift.
//   - The module holds no payment, bill, or customer field, and
//     it never writes into the ledger.

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const OTHER_EXPENSES = 'Other expenses';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function toCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function fromCents(cents) {
  return Math.round(cents) / 100;
}

function formatAmount(value) {
  if (value === null || value === undefined) return 'Not set';
  return `PKR ${Number(value).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// A real calendar month only: 2026-13 is rejected, never repaired.
export function isValidBudgetMonth(value) {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

// A real calendar date only: 2026-02-30 is rejected, never guessed.
export function isValidBudgetDate(value) {
  const match = DATE_PATTERN.exec(text(value));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

// One budget: a category, a month, and a target amount. A zero
// amount is a real target ("spend nothing on this category this
// month"); a missing category, a bad month, or a negative or
// non-finite amount is rejected outright, never stored half-formed.
export function normalizeMonthBudget(value) {
  if (!value || typeof value !== 'object') return null;
  const category = text(value.category);
  const month = text(value.month);
  if (!category || !isValidBudgetMonth(month)) return null;
  const amount = typeof value.amount === 'string' && value.amount.trim() !== ''
    ? Number(value.amount)
    : value.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
  return { category, month, amount: Math.round(amount * 100) / 100 };
}

export function normalizeMonthBudgets(list) {
  if (!Array.isArray(list)) return [];
  const byKey = new Map();
  for (const row of list) {
    const clean = normalizeMonthBudget(row);
    if (clean) byKey.set(`${clean.month}\n${clean.category}`, clean);
  }
  return [...byKey.values()];
}

export function findMonthBudget(budgets, category, month) {
  const wantedCategory = text(category);
  const wantedMonth = text(month);
  if (!wantedCategory || !isValidBudgetMonth(wantedMonth)) return null;
  return normalizeMonthBudgets(budgets).find(
    (row) => row.category === wantedCategory && row.month === wantedMonth,
  ) ?? null;
}

// Last budget wins per (category, month). An invalid budget leaves
// the list exactly as it was — it is rejected, never stored.
export function upsertMonthBudget(budgets, budget) {
  const clean = normalizeMonthBudget(budget);
  const list = normalizeMonthBudgets(budgets);
  if (!clean) return list;
  const next = list.filter(
    (row) => !(row.category === clean.category && row.month === clean.month),
  );
  next.push(clean);
  return next;
}

export function removeMonthBudget(budgets, category, month) {
  const wantedCategory = text(category);
  const wantedMonth = text(month);
  return normalizeMonthBudgets(budgets).filter(
    (row) => !(row.category === wantedCategory && row.month === wantedMonth),
  );
}

const STATUS_ORDER = { over: 0, at: 1, within: 2, unbudgeted: 3 };

// The view for one month: every budgeted category for that month,
// plus every category with recorded spend that month. Rows sort
// over-budget first (the creeping costs the owner needs to see),
// then at budget, then within budget, then unbudgeted; category
// A–Z inside each group. Inputs are never mutated.
export function buildBudgetVersusActual(budgets, expenses, month) {
  const cleanMonth = text(month);
  if (!isValidBudgetMonth(cleanMonth)) {
    return {
      valid: false, month: '', rows: [],
      totals: {
        budgetedCategories: 0, unbudgetedCategories: 0, overCategories: 0,
        totalBudget: null, totalActual: 0, totalRemaining: null,
        totalVariance: null, entries: 0, excluded: 0,
      },
    };
  }
  const cleanBudgets = normalizeMonthBudgets(budgets)
    .filter((row) => row.month === cleanMonth);
  const actualByCategory = new Map();
  let entries = 0;
  let excluded = 0;
  for (const row of Array.isArray(expenses) ? expenses : []) {
    if (!row || typeof row !== 'object') { excluded += 1; continue; }
    if (!isValidBudgetDate(row.date) || text(row.date).slice(0, 7) !== cleanMonth) {
      // A row dated to another month is simply not this month; only
      // a row that cannot be attributed at all counts as excluded.
      if (!isValidBudgetDate(row.date)) excluded += 1;
      continue;
    }
    const amount = typeof row.amount === 'string' && row.amount.trim() !== ''
      ? Number(row.amount)
      : row.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      excluded += 1;
      continue;
    }
    const category = text(row.category) || OTHER_EXPENSES;
    const cents = toCents(amount);
    const current = actualByCategory.get(category) ?? { cents: 0, entries: 0 };
    current.cents += cents;
    current.entries += 1;
    actualByCategory.set(category, current);
    entries += 1;
  }
  const budgetByCategory = new Map(cleanBudgets.map((row) => [row.category, row.amount]));
  const categories = new Set([...budgetByCategory.keys(), ...actualByCategory.keys()]);
  const rows = [...categories].map((category) => {
    const budget = budgetByCategory.has(category) ? budgetByCategory.get(category) : null;
    const actual = fromCents(actualByCategory.get(category)?.cents ?? 0);
    const rowEntries = actualByCategory.get(category)?.entries ?? 0;
    let status;
    let remaining = null;
    let variance = null;
    if (budget === null) {
      status = 'unbudgeted';
    } else {
      remaining = Math.round((budget - actual) * 100) / 100;
      variance = Math.round((actual - budget) * 100) / 100;
      status = actual > budget ? 'over' : actual === budget ? 'at' : 'within';
    }
    return { category, budget, actual, entries: rowEntries, remaining, variance, status };
  });
  rows.sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
    || a.category.localeCompare(b.category));
  const budgetedRows = rows.filter((row) => row.budget !== null);
  const totalBudgetCents = budgetedRows.reduce((sum, row) => sum + toCents(row.budget), 0);
  const totalActualCents = rows.reduce((sum, row) => sum + toCents(row.actual), 0);
  const totals = {
    budgetedCategories: budgetedRows.length,
    unbudgetedCategories: rows.length - budgetedRows.length,
    overCategories: rows.filter((row) => row.status === 'over').length,
    totalBudget: budgetedRows.length ? fromCents(totalBudgetCents) : null,
    totalActual: fromCents(totalActualCents),
    totalRemaining: budgetedRows.length
      ? fromCents(totalBudgetCents - rows.filter((row) => row.budget !== null)
        .reduce((sum, row) => sum + toCents(row.actual), 0))
      : null,
    totalVariance: budgetedRows.length
      ? fromCents(rows.filter((row) => row.budget !== null)
        .reduce((sum, row) => sum + toCents(row.actual), 0) - totalBudgetCents)
      : null,
    entries,
    excluded,
  };
  return { valid: true, month: cleanMonth, rows, totals };
}

export function budgetVersusActualSummaryText(view) {
  if (!view || !view.valid) return 'Budget-versus-actual needs a valid month (YYYY-MM).';
  const { totals } = view;
  if (view.rows.length === 0) return `No budgets and no recorded expenses for ${view.month}.`;
  const over = totals.overCategories
    ? ` ${totals.overCategories} categor${totals.overCategories === 1 ? 'y' : 'ies'} over budget.`
    : '';
  const budgetPart = totals.totalBudget === null
    ? 'No category budgeted'
    : `Budget ${formatAmount(totals.totalBudget)}, remaining ${formatAmount(totals.totalRemaining)}`;
  return `${view.month}: ${budgetPart} · actual ${formatAmount(totals.totalActual)} · ${totals.budgetedCategories} budgeted, ${totals.unbudgetedCategories} unbudgeted.${over}${totals.excluded ? ` ${totals.excluded} expense row(s) excluded (bad date or amount).` : ''}`;
}

export function budgetVersusActualHtml(view) {
  if (!view || !view.valid) return '<p class="empty-state">Budget-versus-actual needs a valid month (YYYY-MM).</p>';
  if (view.rows.length === 0) return `<p class="empty-state">No budgets and no recorded expenses for ${escapeHtml(view.month)}.</p>`;
  const rows = view.rows.map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${row.budget === null ? 'Unbudgeted' : formatAmount(row.budget)}</td><td>${formatAmount(row.actual)}</td><td>${row.remaining === null ? '—' : formatAmount(row.remaining)}</td><td>${row.variance === null ? '—' : formatAmount(row.variance)}</td><td>${escapeHtml(row.status)}</td><td>${row.entries}</td></tr>`).join('');
  return `<table><thead><tr><th scope="col">Category</th><th scope="col">Budget</th><th scope="col">Actual</th><th scope="col">Remaining</th><th scope="col">Variance</th><th scope="col">Status</th><th scope="col">Entries</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function budgetVersusActualCsv(view) {
  if (!view || !view.valid) return 'month,category,budget,actual,remaining,variance,status,entries\n';
  const lines = ['month,category,budget,actual,remaining,variance,status,entries'];
  for (const row of view.rows) {
    lines.push([
      view.month, csvCell(row.category),
      row.budget === null ? '' : row.budget, row.actual,
      row.remaining === null ? '' : row.remaining,
      row.variance === null ? '' : row.variance,
      row.status, row.entries,
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function budgetVersusActualFilename(month) {
  return `expense-budgets-${isValidBudgetMonth(text(month)) ? text(month) : 'month'}.csv`;
}
