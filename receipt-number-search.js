// Plan 392 — Find a transaction by receipt number: one search that
// finds the transaction carrying a typed receipt number and opens
// it with customer, amount, date, and method — or says plainly that
// no such receipt exists. Search only: it never changes any bill,
// payment, or receipt record. A voided payment's number is still
// found, because voided rows stay in history, so a number from a
// returned series resolves like any other. Pure and import-free;
// no store.
export const RECEIPT_NUMBER_MAX_LENGTH = 64;

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

// The typed number as printed: surrounding space gone, uppercased,
// inner spaces dropped, capped. '' when nothing usable was typed.
export function normalizeReceiptNumber(value) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').replace(/\s+/g, '').toUpperCase().slice(0, RECEIPT_NUMBER_MAX_LENGTH);
}

// The receipt number a transaction row carries: the stored number
// first, then the stored permanent number, then — only when the
// caller supplies one — the caller's deterministic derivation
// (same shape the receipt verification lookup uses). '' when the
// row carries no number at all. A throwing deriver never breaks
// the search; it just means no derived number.
export function receiptNumberOfRow(row, deriveReceiptNumber) {
  if (!row || typeof row !== 'object') return '';
  const stored = text(row.receiptNumber) || text(row.permanentReceiptNumber);
  if (stored.trim()) return stored.trim().slice(0, RECEIPT_NUMBER_MAX_LENGTH);
  if (typeof deriveReceiptNumber === 'function') {
    try {
      const derived = text(deriveReceiptNumber({
        customerNumber: row.customerNumber,
        paymentDate: row.date,
        paymentId: row.paymentId ?? row.id,
        billMonth: row.month
      }));
      if (derived.trim()) return derived.trim().slice(0, RECEIPT_NUMBER_MAX_LENGTH);
    } catch {
      return '';
    }
  }
  return '';
}

// The first transaction whose receipt number equals the typed
// number (case and spacing ignored), or null. Voided rows are
// searched like any other — a voided payment is still found.
// The input list is never changed.
export function findTransactionByReceiptNumber(transactions, query, { deriveReceiptNumber } = {}) {
  const wanted = normalizeReceiptNumber(query);
  if (!wanted) return null;
  if (!Array.isArray(transactions)) return null;
  for (const row of transactions) {
    const ref = receiptNumberOfRow(row, deriveReceiptNumber);
    if (ref && normalizeReceiptNumber(ref) === wanted) return row;
  }
  return null;
}

// PKR in the plan modules' own shape: min-0 decimals, never more
// than two (PKR 3,000 · PKR 1,500.5) — the Plan 385/386 convention.
export function formatReceiptSearchAmount(value) {
  // A null/undefined/empty/boolean figure is "not a number", never
  // zero — Number(null) is 0, and a missing amount must never be
  // printed as PKR 0 (the Plan 386 finiteCents lesson).
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `PKR ${formatter.format(amount)}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The result line for the search: the found transaction with its
// customer, amount, date, and method (VOID flagged when voided),
// or the plain not-found line. '' query asks for a number first.
export function receiptNumberSearchLineText(query, row) {
  const wanted = normalizeReceiptNumber(query);
  if (!wanted) return 'Type a receipt number.';
  if (!row || typeof row !== 'object') return `No receipt ${wanted} exists.`;
  const ref = receiptNumberOfRow(row) || wanted;
  const who = `#${text(row.customerNumber) || '?'} ${text(row.customerName) || 'Customer'}`;
  const found = `Receipt ${ref} — ${who}, ${formatReceiptSearchAmount(row.amount)}, ${text(row.date) || 'no date'}, ${text(row.method) || 'no method'}`;
  return row.voided === true ? `${found} · VOID` : found;
}

// The receipt line on a transaction row's details: '' when the row
// carries no receipt number, so a row without one shows nothing
// extra. Always escaped.
export function receiptNumberSearchRowMarkup(row) {
  const ref = receiptNumberOfRow(row);
  if (!ref) return '';
  return ` · Receipt ${escapeHtml(ref)}`;
}
