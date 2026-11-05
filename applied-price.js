// Plan 204 (Plan 203-350) — Tariff change history per customer:
// the applied-price record.
//
// Problem: when a package price changes, nobody can later prove which
// price was actually applied to a given customer's bill, because the
// price history (Plan 34) is global and the advance notice (Plan 94)
// is only a draft. This module records, per customer per bill, the
// package, the price actually applied, the effective date of that
// price, and the bill it appears on — so a customer who questions a
// new figure can be shown the exact price applied and the date it
// took effect.
//
// Scope fence, stated plainly:
//   - This is an applied-price record only. It sets no price and it
//     never re-prices a bill: recording an applied price never
//     changes any bill, payment, or customer record by itself.
//   - It neither reads nor writes Plan 34's price history, the
//     SISP-81 bulk tariff updater, or any bill's price snapshot:
//     those modules are checked first and left untouched. The
//     history check below takes a history list the caller supplies
//     and only compares against it; it never stores or edits it.
//     The effective-date rule it mirrors is Plan 34's rule — the
//     latest revision effective on or before the bill date, else
//     the caller-supplied baseline price — so a record can never
//     disagree with Plan 34 about which price applies on a date.
//   - It is import-free (like package-price-history.js): the caller
//     supplies every record and every history list, and the module
//     never reads storage, the clock, or the network, and never
//     mutates an input.
//   - Dates are real YYYY-MM-DD calendar dates (2026-02-30 is
//     rejected, never guessed). A bill month (YYYY-MM) counts as
//     its first day, exactly as Plan 34 treats it. Amounts are
//     finite numbers (numeric strings accepted, as the ledger
//     stores some amounts as text); a negative or non-finite
//     amount is never stored as zero — the record is rejected
//     outright.

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validAppliedDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

// A bill month (YYYY-MM) counts as its first day; a full date passes
// through unchanged; anything else is null, never guessed.
export function billDateForApplied(value) {
  if (validAppliedDate(value)) return value;
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
// a catalogue id and a stored label that differ only in case or
// spacing still resolve to the same package history.
export function normalizeAppliedPackageKey(value) {
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

export function normalizeAppliedPrice(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const id = cleanText(input.id);
  if (!id) return null;
  const customerId = cleanText(input.customerId ?? input.customer);
  if (!customerId) return null;
  const billId = cleanText(input.billId ?? input.bill ?? input.billMonth);
  if (!billId) return null;
  const packageKey = normalizeAppliedPackageKey(input.packageKey ?? input.packageId ?? input.label ?? input.packageLabel ?? input.package);
  if (!packageKey) return null;
  const priceApplied = finiteAmount(input.priceApplied ?? input.price ?? input.amount);
  if (priceApplied === null || priceApplied < 0) return null;
  const effectiveDate = cleanText(input.effectiveDate ?? input.date);
  if (!validAppliedDate(effectiveDate)) return null;
  const billDate = billDateForApplied(input.billDate ?? input.billMonth ?? input.month);
  if (!billDate) return null;
  return {
    id,
    customerId,
    billId,
    packageKey,
    packageLabel: cleanText(input.packageLabel ?? input.label ?? input.packageKey ?? input.packageId ?? input.package),
    priceApplied,
    effectiveDate,
    billDate,
  };
}

function sortApplied(a, b) {
  return (
    a.billDate.localeCompare(b.billDate)
    || a.customerId.localeCompare(b.customerId)
    || a.billId.localeCompare(b.billId)
    || a.id.localeCompare(b.id)
  );
}

export function normalizeAppliedPriceList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const record = normalizeAppliedPrice(item);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  out.sort(sortApplied);
  return out;
}

export function findAppliedPrice(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return null;
  return normalizeAppliedPriceList(list).find((record) => record.id === wanted) ?? null;
}

// Recording an applied price never alters an existing bill, payment,
// or customer record: it only appends to this record list. An invalid
// record, or one whose id is already recorded, leaves the list
// unchanged (a fresh copy, so callers cannot observe an aliasing
// surprise, and a duplicate id is never rewritten).
export function recordAppliedPrice(list, record) {
  const current = normalizeAppliedPriceList(list);
  const next = normalizeAppliedPrice(record);
  if (!next) return current;
  if (current.some((item) => item.id === next.id)) return current;
  current.push(next);
  current.sort(sortApplied);
  return current;
}

export function removeAppliedPrice(list, id) {
  const wanted = cleanText(id);
  if (!wanted) return normalizeAppliedPriceList(list);
  return normalizeAppliedPriceList(list).filter((record) => record.id !== wanted);
}

export function appliedPricesSorted(list) {
  return normalizeAppliedPriceList(list);
}

export function appliedPricesForCustomer(list, customerId) {
  const wanted = cleanText(customerId);
  if (!wanted) return [];
  return normalizeAppliedPriceList(list).filter((record) => record.customerId === wanted);
}

export function appliedPricesForBill(list, billId) {
  const wanted = cleanText(billId);
  if (!wanted) return [];
  return normalizeAppliedPriceList(list).filter((record) => record.billId === wanted);
}

// The price Plan 34's history says applies to a bill on `billDate`:
// the latest revision effective on or before that date, else the
// caller-supplied baseline price, else null — never a guessed price.
// The history list is only read, never stored or edited.
function expectedPriceFromHistory(history, packageKey, billDate, baseline) {
  const date = billDateForApplied(billDate);
  if (!date) return null;
  const key = normalizeAppliedPackageKey(packageKey);
  if (!key) return null;
  const revisions = [];
  if (Array.isArray(history)) {
    for (const item of history) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const revisionKey = normalizeAppliedPackageKey(item.packageKey ?? item.packageId ?? item.label ?? item.packageLabel);
      if (revisionKey !== key) continue;
      const amount = finiteAmount(item.amount ?? item.price ?? item.newAmount);
      const effectiveDate = cleanText(item.effectiveDate ?? item.date);
      if (amount === null || amount < 0 || !validAppliedDate(effectiveDate)) continue;
      revisions.push({ amount, effectiveDate });
    }
  }
  revisions.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.amount - b.amount);
  let applicable = null;
  for (const revision of revisions) {
    if (revision.effectiveDate <= date) applicable = revision;
    else break;
  }
  if (applicable) return applicable.amount;
  const base = finiteAmount(baseline);
  return base !== null && base >= 0 ? base : null;
}

// One record checked against the supplied history: 'matches' when the
// applied price equals the history price for the bill date,
// 'disagrees' when it does not (the flag the operator must see), and
// 'unverifiable' when the history and the baseline say nothing about
// that package on that date — an unknown price is never called a
// disagreement.
export function checkAppliedPrice(record, history, baseline = null) {
  const clean = normalizeAppliedPrice(record);
  if (!clean) return null;
  const expected = expectedPriceFromHistory(history, clean.packageKey, clean.billDate, baseline);
  if (expected === null) return { record: clean, expected: null, status: 'unverifiable' };
  return { record: clean, expected, status: expected === clean.priceApplied ? 'matches' : 'disagrees' };
}

// Every record whose applied price disagrees with the history for its
// bill date. `baselines` is an optional plain object mapping a
// package key (case-insensitive) to its catalogue price, used only
// where the history has no revision on or before the bill date.
export function flaggedAppliedPrices(list, history, baselines = null) {
  const records = normalizeAppliedPriceList(list);
  const out = [];
  for (const record of records) {
    let baseline = null;
    if (baselines && typeof baselines === 'object' && !Array.isArray(baselines)) {
      for (const key of Object.keys(baselines)) {
        if (normalizeAppliedPackageKey(key) === record.packageKey) { baseline = baselines[key]; break; }
      }
    }
    const check = checkAppliedPrice(record, history, baseline);
    if (check && check.status === 'disagrees') out.push(record);
  }
  return out;
}

export function appliedPriceText(record, check = null) {
  const clean = normalizeAppliedPrice(record);
  if (!clean) return '';
  const base = `Customer ${clean.customerId} · bill ${clean.billId} · ${clean.packageLabel || clean.packageKey} · PKR ${clean.priceApplied.toLocaleString()} applied, effective ${clean.effectiveDate}`;
  if (!check) return base;
  if (check.status === 'disagrees') return `${base} — ⚠ disagrees with price history (history says PKR ${check.expected.toLocaleString()})`;
  if (check.status === 'unverifiable') return `${base} — history does not cover this package on this date`;
  return `${base} — matches price history`;
}

export function appliedPriceSummaryText(list) {
  const records = normalizeAppliedPriceList(list);
  if (records.length === 0) return 'No applied prices recorded yet.';
  const customers = new Set(records.map((record) => record.customerId)).size;
  return `${records.length} applied price${records.length === 1 ? '' : 's'} across ${customers} customer${customers === 1 ? '' : 's'}.`;
}

function escapeHtmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The bill-facing view: each record shows the price applied and its
// effective date, plus the history check, so a disagreement is
// visible on the record itself rather than hidden in a separate list.
export function appliedPriceHtml(list, history = null, baselines = null) {
  const records = normalizeAppliedPriceList(list);
  if (records.length === 0) return '<p>No applied prices recorded yet. Record the price applied to a bill, with the date that price took effect — recording it never changes the bill itself.</p>';
  const rows = records.map((record) => {
    const check = history === null && baselines === null ? null : checkAppliedPrice(record, history, checkBaseline(baselines, record.packageKey));
    const checkCell = !check ? '—' : check.status === 'matches' ? 'Matches history' : check.status === 'disagrees' ? `⚠ Disagrees — history says PKR ${escapeHtmlText(check.expected.toLocaleString())}` : 'Not covered by history';
    return `<tr><td>${escapeHtmlText(record.customerId)}</td><td>${escapeHtmlText(record.billId)}</td><td>${escapeHtmlText(record.packageLabel || record.packageKey)}</td><td>PKR ${escapeHtmlText(record.priceApplied.toLocaleString())}</td><td>${escapeHtmlText(record.effectiveDate)}</td><td>${checkCell}</td></tr>`;
  }).join('');
  return `<table><thead><tr><th>Customer</th><th>Bill</th><th>Package</th><th>Price applied</th><th>Effective date</th><th>History check</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function checkBaseline(baselines, packageKey) {
  if (!baselines || typeof baselines !== 'object' || Array.isArray(baselines)) return null;
  for (const key of Object.keys(baselines)) {
    if (normalizeAppliedPackageKey(key) === packageKey) return baselines[key];
  }
  return null;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function appliedPriceCsv(list) {
  const records = normalizeAppliedPriceList(list);
  const lines = ['customer,bill,package,price_applied,effective_date,bill_date'];
  for (const record of records) {
    lines.push([record.customerId, record.billId, record.packageLabel || record.packageKey, record.priceApplied, record.effectiveDate, record.billDate].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function appliedPriceFilename() {
  return 'applied-prices.csv';
}
