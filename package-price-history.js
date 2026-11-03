// Plan 34 (Plan 1-100) — Package price revision history (effective-dated prices).
//
// Problem: when a package price changes, nobody can tell which customers
// were billed at the old price and from which date the new price applies,
// so old bills look wrong in hindsight. This module records each price
// change — new amount, effective date, note — and resolves which price
// applies to a bill raised on a given date: a bill raised before the
// effective date shows the old price, one raised on or after it shows
// the new price.
//
// Scope fence, stated plainly:
//   - This is a price-history record only. It never writes, edits, or
//     rewrites any bill, payment, or total, and it never changes how a
//     bill is presented (Plan P is untouched). Past bills stay exactly
//     as they were raised; this history only explains them.
//   - It is NOT Plan U's lifecycle timeline: Plan U presents a
//     customer's package changes (old package -> new package, with the
//     rates at the time). Plan 34 is the tariff rule underneath — the
//     dated price of one package over time, shared by every customer
//     on that package. Neither module reads or rewrites the other:
//     Plan U's packageHistory entries are per-customer, while these
//     revisions are per-package.
//   - It is import-free (like audit-log.js and export-pack.js): the
//     caller supplies every revision and every baseline price, and the
//     module never reads storage, the clock, or the network, and never
//     mutates an input.
//   - A bill date may be a full YYYY-MM-DD date or a bill month
//     YYYY-MM. A month is treated as its first day: a price that takes
//     effect mid-month therefore applies to bills raised from the
//     following month, never retroactively to a bill already raised.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). Amounts are finite numbers (numeric
//     strings accepted, as the ledger stores some amounts as text);
//     a negative or non-finite amount is never stored as zero — the
//     revision is rejected outright.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validPriceDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 30, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth ? value : null;
}

// A bill month (YYYY-MM) counts as its first day; a full date passes
// through unchanged; anything else is null, never guessed.
export function billDateForPrice(value) {
  if (validPriceDate(value)) return value;
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (match) {
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) return `${match[1]}-${match[2]}-01`;
    }
  }
  return null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Package keys match case-insensitively with collapsed whitespace, so
// a catalogue id and a stored label that differ only in case or spacing
// still resolve to the same package history.
export function normalizePackageKey(value) {
  const text = cleanText(value);
  if (!text) return '';
  return text.replace(/\s+/g, ' ').toLowerCase();
}

function finiteAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : null;
  }
  return null;
}

export function normalizePriceRevision(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const key = normalizePackageKey(input.packageKey ?? input.packageId ?? input.label ?? input.packageLabel);
  if (!key) return null;
  const amount = finiteAmount(input.amount ?? input.price ?? input.newAmount);
  if (amount === null || amount < 0) return null;
  const effectiveDate = validPriceDate(input.effectiveDate ?? input.date);
  if (!effectiveDate) return null;
  return {
    packageKey: key,
    packageLabel: cleanText(input.packageLabel ?? input.label ?? input.packageKey ?? input.packageId),
    amount,
    effectiveDate,
    note: cleanText(input.note),
  };
}

export function normalizePriceHistory(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const revision = normalizePriceRevision(item);
    if (revision) out.push(revision);
  }
  // Sorted by effective date, then by amount, then by label, so the
  // history reads in the order prices actually took effect.
  out.sort((a, b) => (
    a.effectiveDate.localeCompare(b.effectiveDate)
    || a.packageKey.localeCompare(b.packageKey)
    || a.amount - b.amount
  ));
  return out;
}

// Recording a revision never alters an existing bill: it only appends
// to the history. An invalid revision leaves the list unchanged (a
// fresh copy, so callers cannot observe an aliasing surprise).
export function recordPriceRevision(history, revision) {
  const current = normalizePriceHistory(history);
  const next = normalizePriceRevision(revision);
  if (!next) return current;
  current.push(next);
  current.sort((a, b) => (
    a.effectiveDate.localeCompare(b.effectiveDate)
    || a.packageKey.localeCompare(b.packageKey)
    || a.amount - b.amount
  ));
  return current;
}

export function priceHistoryForPackage(history, packageKey) {
  const key = normalizePackageKey(packageKey);
  if (!key) return [];
  return normalizePriceHistory(history).filter((revision) => revision.packageKey === key);
}

// The price that applies to a bill raised on `billDate` (or in bill
// month `billDate`): the latest revision effective on or before that
// date. Before the first revision, the caller-supplied baseline — the
// catalogue price — applies; with no baseline and no revision, null,
// never a guessed price.
export function priceOnDate(history, packageKey, billDate, baseline = null) {
  const date = billDateForPrice(billDate);
  if (!date) return null;
  const revisions = priceHistoryForPackage(history, packageKey);
  let applicable = null;
  for (const revision of revisions) {
    if (revision.effectiveDate <= date) applicable = revision;
    else break;
  }
  if (applicable) return applicable.amount;
  const base = finiteAmount(baseline);
  return base !== null && base >= 0 ? base : null;
}

// The latest recorded price for a package, regardless of date (the
// price a new bill would use once its effective date arrives is the
// latest revision; callers that need a date use priceOnDate instead).
export function currentPrice(history, packageKey, baseline = null) {
  const revisions = priceHistoryForPackage(history, packageKey);
  if (revisions.length > 0) return revisions[revisions.length - 1].amount;
  const base = finiteAmount(baseline);
  return base !== null && base >= 0 ? base : null;
}

export function priceHistorySummaryText(history) {
  const list = normalizePriceHistory(history);
  if (list.length === 0) return 'No package price revisions recorded yet.';
  const packages = new Set(list.map((revision) => revision.packageKey)).size;
  const latest = list[list.length - 1];
  return `${list.length} price revision${list.length === 1 ? '' : 's'} across ${packages} package${packages === 1 ? '' : 's'}; latest ${latest.effectiveDate}.`;
}

function escapeHtmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function priceHistoryHtml(history) {
  const list = normalizePriceHistory(history);
  if (list.length === 0) return '<p>No package price revisions recorded yet. Record a revision when a package price changes, with its effective date — past bills are never rewritten.</p>';
  const rows = list.map((revision) => `<tr><td>${escapeHtmlText(revision.packageLabel || revision.packageKey)}</td><td>${escapeHtmlText(revision.effectiveDate)}</td><td>PKR ${escapeHtmlText(revision.amount.toLocaleString())}</td><td>${escapeHtmlText(revision.note || '—')}</td></tr>`).join('');
  return `<table><thead><tr><th>Package</th><th>Effective date</th><th>New price</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function priceHistoryCsv(history) {
  const list = normalizePriceHistory(history);
  const lines = ['package,effective_date,new_price,note'];
  for (const revision of list) {
    lines.push([revision.packageLabel || revision.packageKey, revision.effectiveDate, revision.amount, revision.note].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function priceHistoryFilename() {
  return 'package-price-history.csv';
}
