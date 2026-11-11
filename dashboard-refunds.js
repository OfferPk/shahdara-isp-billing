/*
 * Dashboard refunds this month — one plain strip on the billing
 * dashboard, so the owner sees at a glance, in rupees, how much
 * money went back to customers as refunds during the month that
 * is still running, and how many refunds that was. Refunds used
 * to sit quietly in the records until the month-end
 * reconciliation, so an unusual pattern was spotted late; this
 * strip surfaces them while the month is still running.
 *
 * The strip is composed from the refund records the app already
 * keeps (Plan 116) — nothing here edits a bill, a payment, or a
 * customer. One refund record per refund, each naming the
 * customer, the amount, the reason, the method, and the date, so
 * the count and total for the month are read straight from the
 * records: a refund counts when its date falls in the
 * dashboard's own month, read in Pakistan time, and the total
 * is the sum of the refund amounts in integer cents. A refund
 * is ledger evidence of money that already left the shop, so a
 * refund given to a customer who is archived now still counts,
 * and a refund naming a customer no longer on record still
 * counts — the record itself is the authority, never a guessed
 * amount. A month with no refunds shows zero, never a blank.
 * All money is PKR only, never converted to any other currency.
 * The caller passes the refund records and the reference date
 * in, so this module reads no store, clock, or page itself.
 */

import { normalizeRefundList } from './refund-records.js';
import { formatPKR } from './core.js';
import { t } from './nav-language.js';
import { pktMonth } from './phase3.js';

/**
 * Reads the refunds for the dashboard's own month, in integer
 * cents: the refunds whose date falls in the month, plus the
 * count behind them.
 *
 * @param {Array} refunds - The refund records, read the way the
 *   refund screen reads them
 * @param {Date} referenceDate - The dashboard's own day; the
 *   month is read from it in Pakistan time
 * @returns {Object} { month, amountCents, count } — money in
 *   integer cents; count is the number of refunds this month
 */
export function calculateRefundsThisMonth(refunds, referenceDate) {
  const month = pktMonth(referenceDate);
  const summary = { month, amountCents: 0, count: 0 };
  for (const refund of normalizeRefundList(refunds)) {
    if (refund.refundDate.slice(0, 7) !== month) continue;
    summary.amountCents += refund.amountCents;
    summary.count += 1;
  }
  return summary;
}

/**
 * Reads the count line in plain words: how many refunds were
 * given this month.
 *
 * @param {Object} summary - Output of calculateRefundsThisMonth
 * @returns {string} The plain-word count line
 */
export function refundsCountText(summary) {
  const count = summary?.count ?? 0;
  return t(count === 1 ? 'dash_refunds_count_sing' : 'dash_refunds_count_plur', null, { count });
}

/**
 * Renders the refunds strip into the billing dashboard.
 *
 * @param {Document} doc - The host page for the view
 * @param {Object} summary - Output of calculateRefundsThisMonth
 */
export function renderDashboardRefunds(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('rfdRefundTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.amountCents ?? 0) / 100);
  const lineEl = doc.getElementById('rfdRefundLine');
  if (lineEl) lineEl.textContent = refundsCountText(summary);
  const emptyEl = doc.getElementById('rfdRefundEmpty');
  if (emptyEl) emptyEl.hidden = (summary.count ?? 0) > 0;
  // Home Dashboard overhaul: a zero card hides itself — with no
  // refunds this month there is no refund figure to show, so the
  // whole section stays out of the Collect tab until a refund is
  // actually given.
  const sectionEl = doc.getElementById('refundsSection');
  if (sectionEl) sectionEl.hidden = (summary.count ?? 0) === 0;
}
