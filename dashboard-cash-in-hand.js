/*
 * Dashboard cash in hand now — one plain figure on the billing
 * dashboard, so the owner sees at any moment, in rupees, how
 * much cash collected is still sitting with the collector until
 * handover, and how many payments that cash came from.
 *
 * The figure is composed from the records the app already keeps
 * — nothing here edits a bill, a payment, or a customer. Cash
 * receipts are read through the daily closing summary, asked
 * once per payment date, so the cash rule is the ledger's own
 * rule verbatim: a voided receipt is history, never collected
 * cash; archived customers never appear; a payment counts on
 * its recorded date, in full, and only with a positive amount;
 * a payment with no method recorded reads as cash, exactly as
 * the closing register reads it. A handover record for a date
 * covers that date's cash — the same rule the collector
 * cash-in-hand prompt and the pre-close sweep already use — so
 * the figure is the sum of cash receipts on dates with no
 * handover record at all. Cash collected after the dashboard's
 * own day is not in hand yet, so dates after that day never
 * count. A day with no cash in hand shows zero, never a blank.
 * All money is PKR only, never converted to any other currency.
 * The caller owns the clock — the reference date is a required
 * parameter — and passes the record store the handovers were
 * saved in, so this module reads no store, clock, or page
 * itself.
 */

import { calculateDailyClosingSummary, getDailyCashHandovers, formatDateYmd } from './dashboard-daily-closing.js';
import { formatPKR } from './core.js';
import { t } from './nav-language.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

// Every distinct payment date in the state, in order — the
// customer bills first, then the legacy billing list the daily
// closing summary itself falls back to, so no date the summary
// would count is ever missed.
function paymentDates(state) {
  const dates = new Set();
  for (const customer of state?.customers ?? []) {
    for (const bill of customer?.bills ?? []) {
      for (const payment of bill?.payments ?? []) {
        const date = typeof payment?.date === 'string' ? payment.date.slice(0, 10) : '';
        if (DATE_RE.test(date)) dates.add(date);
      }
    }
  }
  for (const entry of state?.billing ?? []) {
    const payments = Array.isArray(entry?.payments)
      ? entry.payments
      : (entry?.amount && entry?.date ? [entry] : []);
    for (const payment of payments) {
      const date = typeof payment?.date === 'string' ? payment.date.slice(0, 10) : '';
      if (DATE_RE.test(date)) dates.add(date);
    }
  }
  return [...dates].sort();
}

/**
 * Reads the cash in hand now, in integer cents: the physical
 * cash receipts on dates with no handover record, up to the
 * dashboard's own day, plus the count of payments behind it.
 *
 * @param {Object} state - The app state
 * @param {Date} referenceDate - The day "now" is (required; the
 *   caller owns the clock, this module never reads it)
 * @param {Object|null} [storage=null] - The record store the
 *   handovers were saved in; null means no handover record is
 *   read, so every cash receipt counts as still in hand
 * @returns {Object} { today, amountCents, count } — money in
 *   integer cents; count is the number of cash payments behind
 *   the figure
 */
export function calculateCashInHand(state, referenceDate, storage = null) {
  const today = formatDateYmd(referenceDate);
  const summary = { today, amountCents: 0, count: 0 };
  if (!today) return summary;
  const safeState = {
    ...(state ?? {}),
    customers: Array.isArray(state?.customers) ? state.customers : []
  };
  const handedOverDates = new Set();
  for (const handover of getDailyCashHandovers(storage)) {
    const date = typeof handover?.date === 'string' ? handover.date.slice(0, 10) : '';
    if (DATE_RE.test(date)) handedOverDates.add(date);
  }
  for (const date of paymentDates(safeState)) {
    if (date > today) continue;
    if (handedOverDates.has(date)) continue;
    const daily = calculateDailyClosingSummary(safeState, referenceDate, { selectedDate: date });
    for (const receipt of daily?.receipts ?? []) {
      if (!receipt?.isCash) continue;
      summary.amountCents += toCents(receipt.amount);
      summary.count += 1;
    }
  }
  return summary;
}

/**
 * Reads the count line in plain words: how many payments the
 * cash in hand came from.
 *
 * @param {Object} summary - Output of calculateCashInHand
 * @returns {string} The plain-word count line
 */
export function cashInHandCountText(summary) {
  const count = summary?.count ?? 0;
  return t(count === 1 ? 'dash_cashinhand_count_sing' : 'dash_cashinhand_count_plur', null, { count });
}

/**
 * Renders the cash-in-hand figure into the billing dashboard.
 *
 * @param {Document} doc - The host page for the view
 * @param {Object} summary - Output of calculateCashInHand
 */
export function renderDashboardCashInHand(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('cihCashTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.amountCents ?? 0) / 100);
  const lineEl = doc.getElementById('cihCashLine');
  if (lineEl) lineEl.textContent = cashInHandCountText(summary);
  const emptyEl = doc.getElementById('cihCashEmpty');
  if (emptyEl) emptyEl.hidden = (summary.count ?? 0) > 0;
}
