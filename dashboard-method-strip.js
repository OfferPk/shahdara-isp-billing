/*
 * Dashboard collections by method today — one strip on the billing
 * dashboard that closes the shop in a glance: today's collections
 * split by how the money arrived — cash, JazzCash, Easypaisa,
 * NayaPay, bank transfer, and other — each in PKR, with the day
 * total in PKR.
 *
 * The strip is composed from the records the app already keeps —
 * nothing here edits a bill, a payment, or a customer. The figures
 * come from the daily closing summary asked for the dashboard's
 * own day, so the strip total always agrees with the today card's
 * collections for the same day, and the strip count agrees with
 * its payment count. A payment counts on its recorded date, in
 * full, exactly as the closing register counts it; voided receipts
 * are history, never collected cash, and archived customers never
 * appear. Methods are folded the way the ledger's own method
 * filter folds them: cash is Cash and every "Cash at … shop"
 * variant, bank transfer is Bank Transfer and Raast, JazzCash,
 * Easypaisa, and NayaPay each keep their own figure, and anything
 * else reads as other — so the six figures always partition the
 * day's collections and the strip total always equals them. A
 * cheque is not a payment method the app records — a cheque or a
 * bank transfer is tracked for clearance, not recorded as a
 * method — so a cheque payment recorded in the app arrives as a
 * bank transfer and lands in the bank transfer figure, and a
 * cheque-labelled entry from an older or imported record reads as
 * other, never forced into a group it does not belong to. A day
 * with no payments yet reads zero, never a blank. All money is
 * PKR only, never converted to any other currency.
 */

import { calculateDailyClosingSummary, formatDateYmd, escapeHtml } from './dashboard-daily-closing.js';
import { LEDGER_METHOD_FILTERS, LEDGER_METHOD_LABELS, ledgerMethodGroup } from './ledger-payment-method.js';
import { formatPKR } from './core.js';
import { t } from './nav-language.js';

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Calculates the method strip for the reference day: today's
 * collections split by the ledger's method groups, in the
 * filter's own order, plus the day total.
 *
 * @param {Object} state - Application state
 * @param {Date} referenceDate - The day "today" is (required; the
 *   caller owns the clock, this module never reads it)
 * @returns {Object} { today, methods, totalCents, totalCount } —
 *   money in integer cents; methods carry group, label,
 *   amountCents, and count, one entry per method group
 */
export function calculateMethodStrip(state, referenceDate) {
  const today = formatDateYmd(referenceDate);
  const summary = {
    today,
    methods: LEDGER_METHOD_FILTERS.map((group) => ({
      group,
      label: LEDGER_METHOD_LABELS[group],
      amountCents: 0,
      count: 0
    })),
    totalCents: 0,
    totalCount: 0
  };
  if (!today) return summary;

  // The daily closing summary is asked for the dashboard's own
  // day, exactly as the today card asks it, so the strip total
  // and count always agree with the card for the same day. Its
  // receipts carry the exact amounts, so the figures keep paisa
  // precision.
  const daily = calculateDailyClosingSummary(state ?? {}, referenceDate, { selectedDate: today });
  const receipts = Array.isArray(daily.receipts) ? daily.receipts : [];
  const byGroup = new Map(summary.methods.map((method) => [method.group, method]));
  for (const receipt of receipts) {
    const slot = byGroup.get(ledgerMethodGroup(receipt?.method));
    if (!slot) continue;
    const cents = toCents(receipt?.amount);
    slot.amountCents += cents;
    slot.count += 1;
    summary.totalCents += cents;
    summary.totalCount += 1;
  }
  return summary;
}

/**
 * Builds the strip rows HTML: one row per method group, in the
 * filter's own order, with the method label, the PKR amount, and
 * the payment count. A group with no payments today still reads
 * PKR 0, never a blank.
 *
 * @param {Object} summary - Output of calculateMethodStrip
 * @returns {string} The row items HTML
 */
export function methodStripSectionHtml(summary) {
  const methods = Array.isArray(summary?.methods) ? summary.methods : [];
  return methods.map((method) => {
    const countText = t(method.count === 1 ? 'dash_methodstrip_payments_sing' : 'dash_methodstrip_payments_plur', null, { count: method.count });
    return `<li><span class="provider-breakdown-name">${escapeHtml(method.label)}</span><strong>${escapeHtml(formatPKR((method.amountCents ?? 0) / 100))}</strong><span class="provider-breakdown-meta">${escapeHtml(countText)}</span></li>`;
  }).join('');
}

/**
 * Renders the method strip into the billing dashboard.
 *
 * @param {Document} doc - The host page for the strip
 * @param {Object} summary - Output of calculateMethodStrip
 */
export function renderMethodStrip(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('dmsMethodTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.totalCents ?? 0) / 100);
  const lineEl = doc.getElementById('dmsMethodLine');
  if (lineEl) {
    const count = summary.totalCount ?? 0;
    lineEl.textContent = t(count === 1 ? 'dash_methodstrip_count_sing' : 'dash_methodstrip_count_plur', null, { count });
  }
  const rowsEl = doc.getElementById('dmsMethodRows');
  if (rowsEl) rowsEl.innerHTML = methodStripSectionHtml(summary);
  const emptyEl = doc.getElementById('dmsMethodEmpty');
  if (emptyEl) emptyEl.hidden = (summary.totalCount ?? 0) > 0;
}
