/**
 * recent-payments.js — Owner feature (2026-10-29): Dashboard "Recent
 * Payments" card.
 *
 * The owner asked for a Recent Payments option on the Dashboard showing
 * the LAST 5 users who paid: receipt reference (bold), customer name ·
 * payment method underneath, and the amount right-aligned, with an
 * "All →" link to the Transactions view.
 *
 * This module is a PURE builder: it reads the ledger and returns row
 * models. It writes nothing, mutates nothing, and adds no storage keys.
 *
 * Rules (pinned by tests/recent-payments.test.js):
 *   1. Payments are collected across ALL customers and bills, including
 *      archived customers — a payment received is received, and the
 *      Transactions view counts it too.
 *   2. Voided payments (SISP-34, payment.voided === true) are EXCLUDED —
 *      the app-wide rule is that voided payments are skipped everywhere.
 *   3. Ordering is by the payment record's own `date` (YYYY-MM-DD),
 *      newest first.
 *   4. Payments with a missing or malformed date cannot be ranked and
 *      are skipped (never guessed).
 *   5. `receiptRef` is the reference the record itself carries —
 *      payment.receiptNumber, else payment.permanentReceiptNumber, else
 *      ''. NO reference is ever generated here: inventing an RCP/REC
 *      number for a payment that has none would fabricate ledger data.
 *      The renderer falls back to the payment's readable date instead.
 *   6. SISP-174 — same-date tie-break by ENTRY time when the record
 *      carries one: SISP-146 stamps `recordedAt` (ISO string) in
 *      core.addPayment at the moment a payment is entered; payments
 *      recorded before that carry no stamp. Within one date, stamped
 *      payments rank by recordedAt, newest entry first; a payment with
 *      no stamp ranks below the stamped ones of the same date (its
 *      entry time is unknown, and stamps only exist for payments
 *      entered after the stamp shipped). Unstamped payments keep the
 *      traversal rule among themselves: the payment recorded later in
 *      the ledger (later customer / bill / payments array position) is
 *      treated as the more recent one. When NO payment carries a stamp
 *      (the whole pre-SISP-146 ledger) the ordering is exactly the old
 *      date + traversal rule — the default list is unchanged.
 *   7. SISP-174 — filter pills DERIVE from the payment pool itself,
 *      never from a hardcoded shop or method list: a payment collected
 *      at a shop (resolveShopCollector over method/paidBy — the same
 *      derivation shop-settlement uses) belongs to that shop's pill;
 *      any other payment belongs to its recorded method's pill. A pill
 *      exists only when at least one pool payment matches it, and its
 *      count is the number of matches in the same pool.
 *   8. SISP-174 — pool: the card builds a wider pool
 *      (RECENT_PAYMENTS_FILTER_POOL) so a selected filter can reach
 *      matching payments beyond the global top 5, then shows the
 *      newest RECENT_PAYMENTS_LIMIT matches. With no filter selected,
 *      the visible rows are the pool's first RECENT_PAYMENTS_LIMIT —
 *      identical to buildRecentPayments(state) with the default limit.
 *
 * Tests use synthetic data only.
 */

import { isVoidedPayment } from './payment-void-audit.js';
import { resolveShopCollector } from './shop-settlement.js';

export const RECENT_PAYMENTS_LIMIT = 5;
export const RECENT_PAYMENTS_FILTER_POOL = 25;
export const RECENT_PAYMENTS_ALL_FILTER = 'all';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Entry-time of a payment in epoch ms, from the SISP-146 `recordedAt`
 * stamp (ISO string; a finite number is also accepted). Returns null
 * when the record carries no usable stamp — nothing is ever invented.
 */
function recordedAtMsOf(payment) {
  const raw = payment.recordedAt;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * Filter-pill key for one row: shop payments group under their derived
 * shop, everything else under its recorded method. A row with neither
 * a shop nor a method gets 'method:' and simply never grows a pill
 * (it still shows under "All").
 */
function filterKeyOf(shop, method) {
  return shop ? `shop:${shop}` : `method:${method}`;
}

/**
 * Build the most recent payment rows for the Dashboard card.
 *
 * @param {object} state - the app ledger state ({ customers: [...] }).
 * @param {number} [limit] - max rows to return (default 5).
 * @returns {Array<{customerId, customerNumber, customerName, paymentId,
 *   month, date, amount, method, paidBy, receiptRef, recordedAtMs,
 *   shop, filterKey}>} newest first.
 */
export function buildRecentPayments(state, limit = RECENT_PAYMENTS_LIMIT) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const cap = Number.isSafeInteger(limit) && limit > 0 ? limit : RECENT_PAYMENTS_LIMIT;
  const ranked = [];
  let sequence = 0;
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
      if (!bill || typeof bill !== 'object') continue;
      for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
        sequence += 1;
        if (!payment || typeof payment !== 'object') continue;
        if (isVoidedPayment(payment)) continue;
        const date = text(payment.date);
        if (!DATE_RE.test(date)) continue;
        const amount = Number(payment.amount);
        const method = text(payment.method);
        const paidBy = text(payment.paidBy);
        const shop = resolveShopCollector(method, paidBy);
        ranked.push({
          customerId: customer.id ?? '',
          customerNumber: customer.customerNumber ?? null,
          customerName: text(customer.name),
          paymentId: payment.id ?? '',
          month: text(bill.month),
          date,
          amount: Number.isFinite(amount) ? amount : 0,
          method,
          paidBy,
          receiptRef: text(payment.receiptNumber) || text(payment.permanentReceiptNumber),
          recordedAtMs: recordedAtMsOf(payment),
          shop,
          filterKey: filterKeyOf(shop, method),
          sequence
        });
      }
    }
  }
  ranked.sort((a, b) =>
    b.date.localeCompare(a.date) ||
    (b.recordedAtMs ?? -1) - (a.recordedAtMs ?? -1) ||
    b.sequence - a.sequence);
  return ranked.slice(0, cap).map(({ sequence: _sequence, ...row }) => row);
}

/**
 * Derive the filter pills for a pool of recent-payment rows (rule 7).
 * Pills come back in first-appearance order (newest match first), each
 * with the count of matching rows in the SAME pool the pills were
 * derived from. The "All" pill is the renderer's own — it is not part
 * of this list.
 *
 * @param {Array} rows - rows from buildRecentPayments (any limit).
 * @returns {Array<{key, label, count}>}
 */
export function buildRecentPaymentPills(rows) {
  const pills = [];
  const byKey = new Map();
  for (const row of (Array.isArray(rows) ? rows : [])) {
    if (!row || typeof row !== 'object') continue;
    const key = text(row.filterKey);
    if (!key || key === 'method:') continue;
    let pill = byKey.get(key);
    if (!pill) {
      pill = { key, label: text(row.shop) || text(row.method), count: 0 };
      byKey.set(key, pill);
      pills.push(pill);
    }
    pill.count += 1;
  }
  return pills;
}

/**
 * Apply a filter-pill selection to a pool of recent-payment rows.
 * 'all' (or an empty/unknown selection shape) returns the pool's first
 * `limit` rows untouched — the card's default view. Any other key
 * keeps only the rows whose filterKey matches, newest first, capped
 * at `limit`. Figures are never recomputed: rows pass through as-is.
 *
 * @param {Array} rows - rows from buildRecentPayments (the pool).
 * @param {string} filterKey - RECENT_PAYMENTS_ALL_FILTER or a pill key.
 * @param {number} [limit] - max rows to return (default 5).
 */
export function filterRecentPayments(rows, filterKey, limit = RECENT_PAYMENTS_LIMIT) {
  const list = Array.isArray(rows) ? rows : [];
  const cap = Number.isSafeInteger(limit) && limit > 0 ? limit : RECENT_PAYMENTS_LIMIT;
  const key = text(filterKey);
  if (!key || key === RECENT_PAYMENTS_ALL_FILTER) return list.slice(0, cap);
  return list.filter(row => row && row.filterKey === key).slice(0, cap);
}
