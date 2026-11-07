// Plan 409 — History export to CSV per customer.
//
// A customer or the owner wants the history in a file — for their
// own records or for an accountant — but the history exists only on
// screen. This module adds only the missing piece: one CSV export
// of a customer's history — date, type, amount, method, reference,
// running balance — generated on the device from the entries the
// history list already composed, in the same order. It exports only
// and changes nothing: it reads those entries and writes to no
// store. The exported rows match the on-screen history exactly:
// the wiring passes the same shown rows the list displays, so a
// filter that hides a row hides it from the file too, and the file
// name names the customer and the export date. The monthly billing
// history already has its own text export, and the transactions
// view already exports its own list; neither is touched, and this
// export covers only the per-customer history list.

export const HISTORY_CSV_EXPORT_EMPTY_TEXT = 'No transactions yet';

export const HISTORY_CSV_EXPORT_HEADERS = Object.freeze([
  'Date',
  'Type',
  'Amount (PKR)',
  'Method',
  'Reference',
  'Running balance (PKR)',
]);

export const HISTORY_CSV_EXPORT_UNDATED_LABEL = 'date not recorded';

const HISTORY_CSV_EXPORT_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
});

function cleanHistoryCsvKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cleanHistoryCsvText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// A missing, boolean or blank figure is not a number, never zero:
// Number(null) is 0 and Number(true) is 1, and both would invent
// an amount out of nothing.
function finiteHistoryCsvCents(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount);
}

function isStrictHistoryCsvDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

// Amounts print as plain numbers a spreadsheet can add — whole
// rupees with no decimals (2000), a paisa remainder with up to two
// (1500.5) — never grouped, never prefixed, never guessed. A figure
// that is not a number stays blank, never zero.
export function formatHistoryCsvAmount(cents) {
  const amount = finiteHistoryCsvCents(cents);
  if (amount === null) return '';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  return `${sign}${text}`;
}

// The type label the list shows, with a voided entry marked plainly
// so the file never hides that the payment was voided. An unknown
// type reads as a payment, never a guessed type.
export function historyCsvExportTypeLabel(type, voided) {
  const label = HISTORY_CSV_EXPORT_TYPE_LABELS[cleanHistoryCsvKey(type)] || 'Payment';
  return voided === true ? `${label} (voided)` : label;
}

// One row for one entry, in the six columns of the scope: date,
// type, amount, method, reference, running balance. The date falls
// back to the same plain words the list shows when no date was
// recorded, and a missing method or reference stays blank.
export function historyCsvExportRow(entry) {
  if (!entry || typeof entry !== 'object') {
    return [HISTORY_CSV_EXPORT_UNDATED_LABEL, 'Payment', '', '', '', ''];
  }
  return [
    entry.date ? cleanHistoryCsvText(entry.date) : HISTORY_CSV_EXPORT_UNDATED_LABEL,
    historyCsvExportTypeLabel(entry.type, entry.voided),
    formatHistoryCsvAmount(entry.amountCents),
    cleanHistoryCsvText(entry.method),
    cleanHistoryCsvText(entry.ref),
    formatHistoryCsvAmount(entry.runningBalanceCents),
  ];
}

// The rows for the entries given, in the order given: the caller
// passes the shown rows, so the file matches the on-screen history
// exactly. The input entries are never mutated and never reordered.
export function historyCsvExportRows(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => historyCsvExportRow(entry));
}

// One cell, quoted only when it must be: a comma, a quote, or a
// line break forces quotes, and a quote inside doubles — the same
// contract the app's shared CSV helper uses.
export function historyCsvEscapeCell(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// The whole file: a UTF-8 BOM, the header line, then one line per
// row, joined with CRLF. An empty history still exports the header,
// so the file is never a blank.
export function historyCsvExportText(entries) {
  const rows = historyCsvExportRows(entries);
  const lines = [HISTORY_CSV_EXPORT_HEADERS, ...rows].map((row) =>
    row.map((cell) => historyCsvEscapeCell(cell)).join(','),
  );
  return `\uFEFF${lines.join('\r\n')}`;
}

function historyCsvSlug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// The file name names the customer and the export date. The name is
// the customer name with spaces and stray marks folded to dashes,
// falling back to the customer number, then the id, then the plain
// word customer; a date that is not a strict YYYY-MM-DD date reads
// as undated, never a guessed date.
export function historyCsvExportFilename(customer, dateKey) {
  const slug = historyCsvSlug(customer?.name)
    || historyCsvSlug(customer?.customerNumber)
    || historyCsvSlug(customer?.id)
    || 'customer';
  const date = isStrictHistoryCsvDate(dateKey) ? dateKey : 'undated';
  return `history-${slug}-${date}.csv`;
}

// The button the profile history section shows, beside the yearly
// summary. It carries no behaviour itself: the wiring in the app
// attaches the download to it.
export function historyCsvExportButtonMarkup() {
  return '<button id="hxeHistoryCsvExport" class="secondary-button export-button" type="button">Export history CSV</button>';
}
