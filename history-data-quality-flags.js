// Plan 425 — History data quality flags per customer.
// History entries with a missing method, a missing reference, or a
// missing date sit unnoticed, so the history slowly fills with lines
// nobody can fully explain. This module adds the missing piece: one
// quality flag per incomplete entry, in plain words, listed on a
// per-customer quality view. It flags only and fixes nothing: it
// reads the entries the full history list already composes, writes
// to no store, and never touches any bill, payment, error log, or
// customer record. A method is only missing where one is expected —
// a bill or a credit entry never carries one, so neither is ever
// flagged for it. A month-only date counts as a date; only a blank
// date is missing. The flags are whole-history facts, so a filter
// can never hide an incomplete entry. Amounts print with no decimals
// for whole rupees and one decimal for a paisa remainder, the same
// shape the entry-screen formatters use.

export const HISTORY_DATA_QUALITY_FIELDS = Object.freeze(['method', 'reference', 'date']);

export const HISTORY_DATA_QUALITY_COMPLETE_TEXT = 'All entries complete';

const HISTORY_DATA_QUALITY_METHOD_TYPES = new Set(['payment', 'advance', 'refund', 'adjustment']);

const HISTORY_DATA_QUALITY_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
});

function isBlankHistoryQuality(value) {
  return typeof value !== 'string' || value.trim() === '';
}

// A null, undefined, empty or boolean figure is not a number, never
// zero: it means the amount was not recorded, not that nothing moved.
function finiteHistoryQualityCents(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

function historyDataQualityAmountText(cents) {
  const amount = finiteHistoryQualityCents(cents);
  if (amount === null) return 'amount not recorded';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

function escapeHistoryQualityHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The missing fields of one entry, in fixed order: method, then
// reference, then date. A bill or a credit entry never carries a
// method, so neither is ever flagged for one.
export function historyDataQualityMissing(entry) {
  if (!entry || typeof entry !== 'object') return [];
  const missing = [];
  if (HISTORY_DATA_QUALITY_METHOD_TYPES.has(entry.type) && isBlankHistoryQuality(entry.method)) {
    missing.push('method');
  }
  if (isBlankHistoryQuality(entry.ref)) missing.push('reference');
  if (isBlankHistoryQuality(entry.date)) missing.push('date');
  return missing;
}

export function historyDataQualityMissingText(missing) {
  const list = (Array.isArray(missing) ? missing : []).filter((field) => HISTORY_DATA_QUALITY_FIELDS.includes(field));
  if (list.length === 0) return '';
  if (list.length === 1) return `Missing ${list[0]}`;
  if (list.length === 2) return `Missing ${list[0]} and ${list[1]}`;
  return `Missing ${list[0]}, ${list[1]} and ${list[2]}`;
}

// One flag for one entry, or null when the entry is complete. The
// flag carries the entry's own identity — its type, date, amount and
// reference — plus what is missing, in plain words.
export function historyDataQualityFlag(entry) {
  const missing = historyDataQualityMissing(entry);
  if (missing.length === 0) return null;
  return {
    type: entry.type,
    date: typeof entry.date === 'string' ? entry.date : '',
    amountCents: finiteHistoryQualityCents(entry.amountCents),
    ref: typeof entry.ref === 'string' ? entry.ref.trim() : '',
    missing,
    text: historyDataQualityMissingText(missing),
  };
}

// Every incomplete entry flagged, in entry order; complete entries
// never appear.
export function historyDataQualityFlags(entries) {
  if (!Array.isArray(entries)) return [];
  const flags = [];
  for (const entry of entries) {
    const flag = historyDataQualityFlag(entry);
    if (flag) flags.push(flag);
  }
  return flags;
}

// '' with no history to check; the complete line when every entry is
// whole; otherwise how many of how many entries are incomplete.
export function historyDataQualitySummaryText(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const flags = historyDataQualityFlags(entries);
  if (flags.length === 0) return HISTORY_DATA_QUALITY_COMPLETE_TEXT;
  const total = entries.length;
  const totalWord = total === 1 ? 'entry' : 'entries';
  return `${flags.length} of ${total} ${totalWord} incomplete`;
}

export function historyDataQualityEntryLineText(flag) {
  if (!flag || typeof flag !== 'object') return '';
  const label = HISTORY_DATA_QUALITY_TYPE_LABELS[flag.type] || 'Payment';
  const date = flag.date ? flag.date : 'date not recorded';
  const amount = historyDataQualityAmountText(flag.amountCents);
  const text = flag.text || historyDataQualityMissingText(flag.missing);
  return `${date} · ${label} · ${amount} · ${text}`;
}

// The per-customer quality view: the summary line, then one row per
// flagged entry with its date, type, amount, reference and what is
// missing. '' with no history; the complete line with no table when
// every entry is whole. Reuses the statement-table and notice
// classes, so no new styles are needed.
export function historyDataQualityViewHtml(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';
  const flags = historyDataQualityFlags(entries);
  const summary = historyDataQualitySummaryText(entries);
  if (flags.length === 0) {
    return `<div class="hdq-history-quality"><p class="notice">${escapeHistoryQualityHtml(summary)}</p></div>`;
  }
  const rows = flags.map((flag) => {
    const label = HISTORY_DATA_QUALITY_TYPE_LABELS[flag.type] || 'Payment';
    const date = flag.date ? flag.date : 'date not recorded';
    const amount = historyDataQualityAmountText(flag.amountCents);
    const ref = flag.ref ? flag.ref : 'not recorded';
    return `<tr><td>${escapeHistoryQualityHtml(date)}</td><td>${escapeHistoryQualityHtml(label)}</td><td class="col-num">${escapeHistoryQualityHtml(amount)}</td><td>${escapeHistoryQualityHtml(ref)}</td><td>${escapeHistoryQualityHtml(flag.text)}</td></tr>`;
  }).join('');
  return `<div class="hdq-history-quality"><p class="notice">${escapeHistoryQualityHtml(summary)}</p><table class="statement-table"><thead><tr><th>Date</th><th>Entry</th><th>Amount</th><th>Reference</th><th>Missing</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
