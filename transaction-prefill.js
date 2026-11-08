// Transaction entry pre-fill (Plan 376): the transaction entry form
// names the customer's oldest open bill — its amount and its month —
// as a reference under the amount field, so the operator sees which
// bill is oldest and what is still open on it. The offered amount
// is the amount still open on that bill, taken from the allocation
// engine's own figures, so it comes from the bill itself and never
// from memory — and never an invented figure for an unpriced bill.
// (Plan 429 / Plan 522: the field's starting amount is the
// customer's FULL dues, not the oldest bill alone — the line says so
// plainly and never claims the oldest bill is the starting amount.)
// A customer with no open bill offers nothing: the pre-fill is null
// and the form starts blank. The pre-fill only offers; it posts
// nothing by itself and it changes no bill, payment, or customer
// record.
//
// The module never reads storage, the clock, the network, or the page.
// Inputs are never mutated.

const TRANSACTION_PREFILL_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

const TRANSACTION_PREFILL_LINE_TEMPLATE =
  'Oldest open bill {month}: PKR {amount} still open — the amount field starts with your full dues.';

function cleanTransactionPrefillText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Strict YYYY-MM month (01–12). */
export function isStrictTransactionPrefillMonth(value) {
  if (typeof value !== 'string') return false;
  const match = TRANSACTION_PREFILL_MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function escapeTransactionPrefillHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function formatTransactionPrefillAmount(amount) {
  return Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * The pre-fill for the transaction entry form: the customer's oldest
 * open bill — the earliest bill month whose remaining balance (from
 * the allocation engine) is still positive.
 *
 * @param {Object} customer - the customer record ({ id, bills }).
 * @param {Object} allocations - the allocation engine result for the
 *   state, with a forMonth(customerId, month) lookup.
 * @returns {{ amount: number, month: string, billAmount: number|null } | null}
 *   amount is the amount still open on that bill, in PKR; month is
 *   the bill's month; billAmount is the bill's full due amount (null
 *   when the bill is unpriced). Null when the customer has no open
 *   bill — an unpriced bill never offers an amount, and a bill whose
 *   balance is zero or negative is not open.
 */
export function oldestOpenBillPrefill(customer, allocations) {
  if (!customer || typeof customer !== 'object') return null;
  const customerId = cleanTransactionPrefillText(customer.id);
  if (!customerId) return null;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const forMonth = allocations && typeof allocations.forMonth === 'function'
    ? allocations.forMonth
    : null;
  if (!forMonth) return null;
  const ordered = bills
    .filter((bill) => bill && typeof bill === 'object' && isStrictTransactionPrefillMonth(bill.month))
    .sort((a, b) => a.month.localeCompare(b.month));
  for (const bill of ordered) {
    let summary = null;
    try {
      summary = forMonth(customerId, bill.month);
    } catch {
      return null;
    }
    const balanceCents = summary?.balanceDueCents;
    if (typeof balanceCents !== 'number' || !Number.isFinite(balanceCents) || balanceCents <= 0) continue;
    const dueAmount = typeof bill.dueAmount === 'number' && Number.isFinite(bill.dueAmount) && bill.dueAmount > 0
      ? bill.dueAmount
      : null;
    return { amount: balanceCents / 100, month: bill.month, billAmount: dueAmount };
  }
  return null;
}

/**
 * Plain-words line for the offered pre-fill, e.g.
 * "Oldest open bill 2026-09: PKR 1,500 still open — the amount
 * field starts with your full dues." The oldest bill is named as a
 * reference; the line never claims it is the starting amount — the
 * field holds full dues (Plan 429). Returns '' when there is no
 * pre-fill to offer.
 * `template` may carry {month} and {amount} placeholders; a template
 * without both placeholders falls back to the plain default.
 */
export function transactionPrefillLineText(prefill, template) {
  if (!prefill || typeof prefill !== 'object') return '';
  if (!isStrictTransactionPrefillMonth(prefill.month)) return '';
  const amount = Number(prefill.amount);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const text = typeof template === 'string' && template.includes('{month}') && template.includes('{amount}')
    ? template
    : TRANSACTION_PREFILL_LINE_TEMPLATE;
  return text
    .replaceAll('{month}', prefill.month)
    .replaceAll('{amount}', formatTransactionPrefillAmount(amount));
}

/**
 * The pre-fill line as escaped HTML for the transaction entry form,
 * or '' when there is no pre-fill to offer. `labels.line` is the
 * template for the line (plain default when omitted).
 */
export function transactionPrefillLineHtml(prefill, labels = {}) {
  const text = transactionPrefillLineText(prefill, labels.line);
  if (!text) return '';
  return `<p class="txp-prefill-line">${escapeTransactionPrefillHtml(text)}</p>`;
}
