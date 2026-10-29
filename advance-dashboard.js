/**
 * advance-dashboard.js — Owner feature (2026-10-29): Dashboard
 * "Advance Held" KPI card + advance holders dialog data.
 *
 * The owner asked for the advance money to show on the Home dashboard:
 * how much advance is being held right now, and how much advance was
 * collected this month. This module is a PURE builder: it reads the
 * ledger and returns the figures. It writes nothing, mutates nothing,
 * adds no storage keys, and changes NO money logic — recording and
 * consumption stay exactly where PR #488 put them (advance-payment.js
 * + the core allocation engine).
 *
 * Definitions (pinned by tests/advance-dashboard.test.js):
 *   1. heldTotalCents — the advance money held RIGHT NOW: the sum,
 *      across ALL customers, of advanceBalanceCents (the allocation
 *      engine's unapplied credit per customer). Consumed credit is
 *      excluded by construction: once a generated bill applies the
 *      credit, it is no longer "unapplied". Voided payments are
 *      excluded by the engine itself — calculatePaymentAllocations
 *      filters `voided !== true` before allocating, so a voided
 *      advance contributes no credit (verified in core.js and pinned
 *      in the tests below the builder).
 *   2. collectedThisMonthCents — the advance money RECEIVED in the
 *      given month: the sum of the amounts of payments tagged
 *      kind: 'advance' (isAdvancePayment) whose own `date` falls in
 *      that month, voided payments excluded. This counts receipts,
 *      whether or not a later bill has since consumed them — it is
 *      the month's advance intake, distinct from the held figure.
 *   3. holders — every customer whose held balance is above zero,
 *      sorted by amount descending (ties: customerNumber ascending,
 *      then name), carrying name + mohalla for the dialog rows.
 *
 * Tests use synthetic data only.
 */

import { calculatePaymentAllocations, isAdvancePayment } from './core.js';
import { advanceBalanceCents } from './advance-payment.js';
import { isVoidedPayment } from './payment-void-audit.js';

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Build the dashboard advance figures.
 *
 * @param {object} state - the app ledger state ({ customers: [...] }).
 * @param {string} currentMonth - 'YYYY-MM' month for the collected
 *   figure; anything else yields a collected figure of 0 (never guessed).
 * @returns {{heldTotalCents: number, collectedThisMonthCents: number,
 *   holders: Array<{customerId, customerNumber, customerName, mohalla,
 *   amountCents}>}}
 */
export function buildAdvanceDashboard(state, currentMonth) {
  const customers = (Array.isArray(state?.customers) ? state.customers : [])
    .filter(customer => customer && typeof customer === 'object');
  const month = typeof currentMonth === 'string' && MONTH_RE.test(currentMonth) ? currentMonth : '';
  // One allocation pass for the whole ledger, shared by every
  // per-customer balance lookup. The engine iterates state.customers
  // directly, so it receives the normalized list.
  const allocations = calculatePaymentAllocations({ customers });

  const holders = [];
  let heldTotalCents = 0;
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    const amountCents = advanceBalanceCents(state, customer.id, allocations);
    if (!(amountCents > 0)) continue;
    heldTotalCents += amountCents;
    holders.push({
      customerId: customer.id ?? '',
      customerNumber: customer.customerNumber ?? null,
      customerName: text(customer.name),
      mohalla: text(customer.mohalla),
      amountCents
    });
  }
  holders.sort((a, b) => b.amountCents - a.amountCents
    || (a.customerNumber ?? Number.MAX_SAFE_INTEGER) - (b.customerNumber ?? Number.MAX_SAFE_INTEGER)
    || a.customerName.localeCompare(b.customerName));

  let collectedThisMonthCents = 0;
  if (month) {
    for (const customer of customers) {
      if (!customer || typeof customer !== 'object') continue;
      for (const bill of (Array.isArray(customer.bills) ? customer.bills : [])) {
        if (!bill || typeof bill !== 'object') continue;
        for (const payment of (Array.isArray(bill.payments) ? bill.payments : [])) {
          if (!payment || typeof payment !== 'object') continue;
          if (!isAdvancePayment(payment)) continue;
          if (isVoidedPayment(payment)) continue;
          const date = text(payment.date);
          if (!DATE_RE.test(date) || date.slice(0, 7) !== month) continue;
          const amount = Number(payment.amount);
          if (Number.isFinite(amount)) collectedThisMonthCents += Math.round(amount * 100);
        }
      }
    }
  }

  return { heldTotalCents, collectedThisMonthCents, holders };
}
