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
 *      newest first. Payments carry no time-of-day, so same-date ties
 *      break deterministically by traversal sequence DESC: the payment
 *      recorded later in the ledger (later customer / bill / payments
 *      array position) is treated as the more recent one.
 *   4. Payments with a missing or malformed date cannot be ranked and
 *      are skipped (never guessed).
 *   5. `receiptRef` is the reference the record itself carries —
 *      payment.receiptNumber, else payment.permanentReceiptNumber, else
 *      ''. NO reference is ever generated here: inventing an RCP/REC
 *      number for a payment that has none would fabricate ledger data.
 *      The renderer falls back to the payment's readable date instead.
 *
 * Tests use synthetic data only.
 */

import { isVoidedPayment } from './payment-void-audit.js';

export const RECENT_PAYMENTS_LIMIT = 5;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Build the most recent payment rows for the Dashboard card.
 *
 * @param {object} state - the app ledger state ({ customers: [...] }).
 * @param {number} [limit] - max rows to return (default 5).
 * @returns {Array<{customerId, customerNumber, customerName, paymentId,
 *   month, date, amount, method, receiptRef}>} newest first.
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
        ranked.push({
          customerId: customer.id ?? '',
          customerNumber: customer.customerNumber ?? null,
          customerName: text(customer.name),
          paymentId: payment.id ?? '',
          month: text(bill.month),
          date,
          amount: Number.isFinite(amount) ? amount : 0,
          method: text(payment.method),
          receiptRef: text(payment.receiptNumber) || text(payment.permanentReceiptNumber),
          sequence
        });
      }
    }
  }
  ranked.sort((a, b) => b.date.localeCompare(a.date) || b.sequence - a.sequence);
  return ranked.slice(0, cap).map(({ sequence: _sequence, ...row }) => row);
}
