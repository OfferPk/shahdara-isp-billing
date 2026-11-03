// Plan 44 (Plan 1-100) — Cost per customer and margin per package
// (read-only).
//
// The owner knows total collections and total expenses but not
// whether a low-price package actually covers its share of running
// costs, so pricing decisions are made on revenue alone. This module
// answers that one question, and nothing else:
//
//   monthly recurring costs ÷ active customers = cost per customer
//   package price − cost per customer = margin per package
//
// Scope fence, stated plainly:
//   - It is import-free: the caller supplies the month, every
//     expense row, the active-customer count, the package list, and
//     the list of capital categories, and the module never reads
//     storage, the clock, or the network, and never mutates an input.
//   - It is read-only: no allocation rule is stored as accounting
//     policy, no customer bill changes, and no total anywhere is
//     rewritten. The view only reports.
//   - Recurring versus one-off capital is decided by the caller, in
//     the open: the caller names the categories that count as
//     one-off capital (for example a new OLT purchase). Capital
//     rows are totalled separately and shown separately, and are
//     NEVER folded into the monthly recurring figure — not even
//     silently, because the summary text names exactly which
//     categories were included in the recurring figure and which
//     were set aside as capital. When the caller marks no capital
//     category, the summary says so in plain words, so an empty
//     capital list can never look like a checked one.
//   - Actuals follow the expense ledger's own month rule (a row
//     counts for the month its payment date falls in), with the same
//     honesty rules as Plan 42: a row with an impossible date
//     (2026-02-30) is excluded, never counted for a month it is
//     not really in, and a row with a non-finite or negative amount
//     is excluded, never counted as zero. Excluded rows are counted
//     in the totals, never hidden. A blank category falls back to
//     "Other expenses", the same fallback the ledger's own category
//     totals use. Money is summed in integer cents, so no float
//     drift.
//   - A package with no recorded price gets a null margin, never a
//     guessed price; a month with no active customers gets a null
//     cost per customer, never a division by zero. Package prices
//     come from the caller (the app passes the catalogue prices),
//     and a customer's own monthly selling amount may differ —
//     this view does not re-price any customer.
//   - The module holds no bill, payment, or customer field beyond
//     the counts and package prices the caller supplies, and it
//     never writes into the ledger.

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
export function isValidCostMonth(value) {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

// A real calendar date only: 2026-02-30 is rejected, never guessed.
export function isValidCostDate(value) {
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

// Capital categories: a comma-separated string or an array of names,
// matched case-insensitively and trimmed, duplicates dropped. An
// empty list is a real answer ("nothing marked as capital"), not an
// error — the summary text says so.
export function parseCapitalCategories(value) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const name = text(item);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

// One package: a name and a monthly price. A missing, non-finite, or
// non-positive price becomes null ("price not set"), never a guessed
// price. A row with no name is rejected outright.
export function normalizeCostPackage(value) {
  if (!value || typeof value !== 'object') return null;
  const name = text(value.name ?? value.label);
  if (!name) return null;
  const price = typeof value.price === 'string' && value.price.trim() !== ''
    ? Number(value.price)
    : value.price;
  return {
    name,
    price: typeof price === 'number' && Number.isFinite(price) && price > 0
      ? Math.round(price * 100) / 100
      : null,
  };
}

export function normalizeCostPackages(list) {
  if (!Array.isArray(list)) return [];
  const byName = new Map();
  for (const row of list) {
    const clean = normalizeCostPackage(row);
    if (clean) byName.set(clean.name.toLowerCase(), clean);
  }
  return [...byName.values()];
}

// The view. Inputs are all caller-supplied:
//   month: 'YYYY-MM'
//   expenses: [{ date, amount, category }]
//   capitalCategories: string or array of category names treated as
//     one-off capital (shown separately, never in the recurring total)
//   activeCustomerCount: number of active (non-archived) customers
//   packages: [{ name, price }]
export function buildCostPerCustomer(input) {
  const month = text(input?.month);
  if (!isValidCostMonth(month)) {
    return {
      valid: false, month: '', recurringTotal: 0, capitalTotal: 0,
      recurringByCategory: [], capitalByCategory: [],
      capitalCategories: [], activeCustomerCount: null,
      costPerCustomer: null, packages: [], entries: 0, excluded: 0,
    };
  }
  const capitalKeys = new Set(parseCapitalCategories(input?.capitalCategories).map((name) => name.toLowerCase()));
  const capitalCategories = parseCapitalCategories(input?.capitalCategories);
  const count = input?.activeCustomerCount;
  const activeCustomerCount = typeof count === 'number' && Number.isInteger(count) && count >= 0 ? count : null;

  const recurringByCategory = new Map();
  const capitalByCategory = new Map();
  let recurringCents = 0;
  let capitalCents = 0;
  let entries = 0;
  let excluded = 0;
  for (const row of Array.isArray(input?.expenses) ? input.expenses : []) {
    if (!row || typeof row !== 'object') { excluded += 1; continue; }
    if (!isValidCostDate(row.date) || text(row.date).slice(0, 7) !== month) {
      // A row dated to another month is simply not this month; only
      // a row that cannot be attributed at all counts as excluded.
      if (!isValidCostDate(row.date)) excluded += 1;
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
    const bucket = capitalKeys.has(category.toLowerCase()) ? capitalByCategory : recurringByCategory;
    const current = bucket.get(category) ?? { cents: 0, entries: 0 };
    current.cents += cents;
    current.entries += 1;
    bucket.set(category, current);
    if (bucket === capitalByCategory) capitalCents += cents;
    else recurringCents += cents;
    entries += 1;
  }
  const byCategory = (map) => [...map.entries()]
    .map(([category, data]) => ({ category, amount: fromCents(data.cents), entries: data.entries }))
    .sort((a, b) => a.category.localeCompare(b.category));

  const recurringTotal = fromCents(recurringCents);
  const capitalTotal = fromCents(capitalCents);
  const costPerCustomer = activeCustomerCount !== null && activeCustomerCount > 0
    ? Math.round(recurringCents / activeCustomerCount) / 100
    : null;
  const packages = normalizeCostPackages(input?.packages).map((pkg) => {
    const margin = pkg.price !== null && costPerCustomer !== null
      ? Math.round((pkg.price - costPerCustomer) * 100) / 100
      : null;
    return {
      name: pkg.name,
      price: pkg.price,
      margin,
      marginPercent: margin !== null && pkg.price > 0
        ? Math.round((margin / pkg.price) * 10000) / 100
        : null,
      status: margin === null ? 'unknown' : margin > 0 ? 'profitable' : margin === 0 ? 'break-even' : 'loss',
    };
  });

  return {
    valid: true, month, recurringTotal, capitalTotal,
    recurringByCategory: byCategory(recurringByCategory),
    capitalByCategory: byCategory(capitalByCategory),
    capitalCategories, activeCustomerCount, costPerCustomer,
    packages, entries, excluded,
  };
}

// Plain-words statement of what the figure includes and excludes.
// This is the guard against silent folding: the reader always sees
// both lists, even when one of them is empty.
export function costPerCustomerSummaryText(view) {
  if (!view || !view.valid) return 'Pick a valid month to see the cost per customer.';
  const included = view.recurringByCategory.length
    ? view.recurringByCategory.map((row) => `${row.category} (${formatAmount(row.amount)})`).join(', ')
    : 'no recurring expense recorded this month';
  const excluded = view.capitalByCategory.length
    ? view.capitalByCategory.map((row) => `${row.category} (${formatAmount(row.amount)})`).join(', ')
    : (view.capitalCategories.length
      ? 'none of the marked capital categories had a row this month'
      : 'no category was marked as one-off capital, so every expense in the month counts as recurring');
  const head = view.costPerCustomer === null
    ? (view.activeCustomerCount === 0
      ? 'No active customers this month, so no cost per customer can be computed.'
      : 'Cost per customer cannot be computed (active-customer count not supplied).')
    : `Cost per customer: ${formatAmount(view.costPerCustomer)} (${formatAmount(view.recurringTotal)} recurring ÷ ${view.activeCustomerCount} active customers).`;
  const margins = view.packages.length
    ? ` Margins: ${view.packages.map((pkg) => (pkg.margin === null
      ? `${pkg.name}: price not set`
      : `${pkg.name}: ${formatAmount(pkg.margin)}`)).join('; ')}.`
    : '';
  const tail = view.excluded ? ` ${view.excluded} expense row(s) were excluded (impossible date or bad amount) and counted, never totalled.` : '';
  return `${head} Included in the recurring figure: ${included}. Set aside as one-off capital, never folded into the monthly figure: ${excluded}.${margins}${tail}`;
}

export function costPerCustomerHtml(view) {
  if (!view || !view.valid) return '<p>Pick a valid month to see the cost per customer.</p>';
  const included = view.recurringByCategory.length
    ? `<ul>${view.recurringByCategory.map((row) => `<li>${escapeHtml(row.category)}: ${escapeHtml(formatAmount(row.amount))} (${row.entries} entr${row.entries === 1 ? 'y' : 'ies'})</li>`).join('')}</ul>`
    : '<p>No recurring expense recorded this month.</p>';
  const excluded = view.capitalByCategory.length
    ? `<ul>${view.capitalByCategory.map((row) => `<li>${escapeHtml(row.category)}: ${escapeHtml(formatAmount(row.amount))} (${row.entries} entr${row.entries === 1 ? 'y' : 'ies'})</li>`).join('')}</ul>`
    : (view.capitalCategories.length
      ? '<p>None of the marked capital categories had a row this month.</p>'
      : '<p>No category was marked as one-off capital, so every expense in the month counts as recurring.</p>');
  const packageRows = view.packages.length
    ? `<table><thead><tr><th>Package</th><th>Monthly price</th><th>Margin per customer</th><th>Status</th></tr></thead><tbody>${view.packages.map((pkg) => `<tr><td>${escapeHtml(pkg.name)}</td><td>${escapeHtml(formatAmount(pkg.price))}</td><td>${escapeHtml(formatAmount(pkg.margin))}</td><td>${escapeHtml(pkg.status)}</td></tr>`).join('')}</tbody></table>`
    : '<p>No packages supplied.</p>';
  return `<p><strong>Cost per customer: ${escapeHtml(formatAmount(view.costPerCustomer))}</strong> — ${escapeHtml(formatAmount(view.recurringTotal))} recurring ÷ ${view.activeCustomerCount === null ? 'count not supplied' : `${view.activeCustomerCount} active customers`}.</p>`
    + `<p>One-off capital set aside (never in the monthly figure): ${escapeHtml(formatAmount(view.capitalTotal))}.</p>`
    + `<h4>Included (recurring)</h4>${included}<h4>Excluded (one-off capital)</h4>${excluded}<h4>Margin per package</h4>${packageRows}`
    + (view.excluded ? `<p>${view.excluded} expense row(s) were excluded (impossible date or bad amount) and counted, never totalled.</p>` : '');
}

export function costPerCustomerCsv(view) {
  if (!view || !view.valid) return 'month,cost_per_customer,recurring_total,capital_total,active_customers\n';
  const lines = ['month,cost_per_customer,recurring_total,capital_total,active_customers,package,package_price,margin_per_customer,status'];
  for (const pkg of view.packages) {
    lines.push([
      view.month, view.costPerCustomer ?? '', view.recurringTotal, view.capitalTotal,
      view.activeCustomerCount ?? '', pkg.name, pkg.price ?? '', pkg.margin ?? '', pkg.status,
    ].map(csvCell).join(','));
  }
  if (!view.packages.length) {
    lines.push([view.month, view.costPerCustomer ?? '', view.recurringTotal, view.capitalTotal, view.activeCustomerCount ?? '', '', '', '', ''].map(csvCell).join(','));
  }
  for (const row of view.recurringByCategory) {
    lines.push([view.month, '', '', '', '', `recurring: ${row.category}`, row.amount, '', ''].map(csvCell).join(','));
  }
  for (const row of view.capitalByCategory) {
    lines.push([view.month, '', '', '', '', `capital: ${row.category}`, row.amount, '', ''].map(csvCell).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function costPerCustomerFilename(month) {
  return isValidCostMonth(text(month)) ? `cost-per-customer-${text(month)}.csv` : 'cost-per-customer.csv';
}
