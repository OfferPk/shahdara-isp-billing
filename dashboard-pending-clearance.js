/*
 * Dashboard pending clearance total — one plain total on the
 * billing dashboard, so the owner sees at a glance, in rupees,
 * how much cheque and bank-transfer money has been recorded
 * but has not cleared yet, and how many payments that money
 * came from. A pending payment still sits inside the collected
 * total, so without this line the dashboard overstates the
 * money that is truly available.
 *
 * The total is composed from the records the app already keeps
 * — nothing here edits a bill, a payment, or a customer. The
 * clearance record is the authority for "not yet cleared":
 * only a record whose status is pending counts, and the list
 * is read the way the clearance screen reads it, so a cleared
 * or bounced payment never appears. The payment record is the
 * authority for the amount: the total is the sum of the
 * recorded amounts of the payments those pending records
 * name. A payment whose record is voided is history, never
 * collected cash, so it counts towards neither the total nor
 * the count; a pending record naming a payment that is no
 * longer there contributes nothing, never a guessed amount;
 * archived customers never appear; one payment counts once,
 * however many records name it. A cheque recorded in the app
 * arrives as a bank transfer, so the payment's own method
 * spelling is never the test — the clearance record's method
 * already says cheque or bank transfer. The total has no month
 * scope: a cheque from last month that still has not cleared
 * is still money that is not truly available, so it counts
 * until it clears. A business with nothing pending shows zero,
 * never a blank. All money is PKR only, never converted to any
 * other currency. The caller passes the clearance records in,
 * so this module reads no store, clock, or page itself.
 */

import { pendingClearances } from './payment-clearance.js';
import { formatPKR } from './core.js';
import { t } from './nav-language.js';

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

// The recorded payments of the state, by payment id: amount in
// integer cents and whether the receipt is voided. Archived
// customers never appear, and a payment with no usable positive
// amount contributes nothing.
function paymentAmountsById(state) {
  const byId = new Map();
  for (const customer of state?.customers ?? []) {
    if (customer?.archived) continue;
    for (const bill of customer?.bills ?? []) {
      for (const payment of bill?.payments ?? []) {
        const id = typeof payment?.id === 'string' ? payment.id.trim() : '';
        if (!id || byId.has(id)) continue;
        const cents = toCents(payment?.amount);
        byId.set(id, { cents, voided: payment?.voided === true });
      }
    }
  }
  return byId;
}

/**
 * Reads the pending-clearance total, in integer cents: the
 * recorded amounts of the cheque and transfer payments whose
 * clearance record is still pending, plus the count of
 * payments behind it.
 *
 * @param {Object} state - The app state
 * @param {Array} clearanceList - The clearance records, read
 *   the way the clearance screen reads them
 * @returns {Object} { amountCents, count } — money in integer
 *   cents; count is the number of pending payments behind the
 *   total
 */
export function calculatePendingClearance(state, clearanceList) {
  const summary = { amountCents: 0, count: 0 };
  const safeState = {
    ...(state ?? {}),
    customers: Array.isArray(state?.customers) ? state.customers : []
  };
  const payments = paymentAmountsById(safeState);
  const seen = new Set();
  for (const record of pendingClearances(clearanceList)) {
    const paymentId = typeof record?.paymentId === 'string' ? record.paymentId.trim() : '';
    if (!paymentId || seen.has(paymentId)) continue;
    seen.add(paymentId);
    const payment = payments.get(paymentId);
    if (!payment || payment.voided) continue;
    if (payment.cents <= 0) continue;
    summary.amountCents += payment.cents;
    summary.count += 1;
  }
  return summary;
}

/**
 * Reads the count line in plain words: how many payments the
 * pending total came from.
 *
 * @param {Object} summary - Output of calculatePendingClearance
 * @returns {string} The plain-word count line
 */
export function pendingClearanceCountText(summary) {
  const count = summary?.count ?? 0;
  return t(count === 1 ? 'dash_pendingclear_count_sing' : 'dash_pendingclear_count_plur', null, { count });
}

/**
 * Renders the pending-clearance total into the billing dashboard.
 *
 * @param {Document} doc - The host page for the view
 * @param {Object} summary - Output of calculatePendingClearance
 */
export function renderDashboardPendingClearance(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('pclPendingTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.amountCents ?? 0) / 100);
  const lineEl = doc.getElementById('pclPendingLine');
  if (lineEl) lineEl.textContent = pendingClearanceCountText(summary);
  const emptyEl = doc.getElementById('pclPendingEmpty');
  if (emptyEl) emptyEl.hidden = (summary.count ?? 0) > 0;
  // Home Dashboard overhaul: a zero card hides itself — with
  // nothing pending there is no clearance figure to show, so the
  // whole section stays out of the Collect tab until a payment is
  // actually waiting on clearance.
  const sectionEl = doc.getElementById('pendingClearanceSection');
  if (sectionEl) sectionEl.hidden = (summary.count ?? 0) === 0;
}
