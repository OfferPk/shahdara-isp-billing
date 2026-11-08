/*
 * Dashboard this month versus last month — one plain comparison
 * line on the billing dashboard, so the owner sees at a glance
 * whether this month is better or worse than last, without
 * opening any report: this month's collections in PKR beside
 * last month's collections in PKR, with the difference in plain
 * words — more, less, or the same.
 *
 * Both figures are read from the monthly closing snapshot, the
 * ledger's own monthly totals — the same source the dashboard
 * and the monthly report already show — so the line can never
 * disagree with them. Collections are non-voided payments
 * grouped by their payment date, never by bill month, so a
 * payment dated this month on last month's bill counts this
 * month, and a voided receipt is history, never collected cash.
 * A closed previous month reads its saved closing snapshot —
 * the closed month's official total — while the current month
 * always reads the live ledger. The multi-month momentum suite
 * behind its modal is charts, CSV, print and a briefing over
 * many months, not a plain dashboard line, and the per-customer
 * history comparison is a history line, not a dashboard line,
 * so this module is the missing piece.
 *
 * The line is read-only: it edits no bill, payment, or customer
 * record. All money is PKR only, never converted to any other
 * currency. The caller owns the clock — the reference date is a
 * required parameter and the month is read from it in Pakistan
 * time.
 */

import { buildMonthlyClosingSnapshot, formatPKR } from './core.js?v=1.11.0';
import { t } from './nav-language.js?v=1.11.0';
import { pktMonth } from './phase3.js?v=1.11.0';

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Compares this month's collections with last month's, in
 * integer cents, from the ledger's own monthly totals.
 *
 * @param {Object} state - The app state
 * @param {Date} referenceDate - The dashboard's own day; the
 *   month is read from it in Pakistan time
 * @returns {Object} The two months, both figures in cents, the
 *   signed difference in cents, and its plain-word direction
 */
export function calculateMonthComparison(state, referenceDate) {
  const safeState = {
    ...(state ?? {}),
    customers: Array.isArray(state?.customers) ? state.customers : []
  };
  const currentMonth = pktMonth(referenceDate);
  const snapshot = buildMonthlyClosingSnapshot(safeState, currentMonth, referenceDate);
  const currentCents = toCents(snapshot?.collection);
  const previousMonth = snapshot?.previousMonthComparison?.month ?? '';
  const previousCents = toCents(snapshot?.previousMonthComparison?.collection);
  const differenceCents = currentCents - previousCents;
  const direction = differenceCents > 0 ? 'more' : differenceCents < 0 ? 'less' : 'same';
  return {
    currentMonth,
    previousMonth,
    currentCents,
    previousCents,
    differenceCents,
    direction
  };
}

/**
 * Reads the difference in plain words: how much more, how much
 * less, or the same as last month, in PKR.
 *
 * @param {Object} summary - Output of calculateMonthComparison
 * @returns {string} The plain-word difference line
 */
export function monthComparisonDifferenceText(summary) {
  const differenceCents = summary?.differenceCents ?? 0;
  const direction = summary?.direction ?? 'same';
  if (direction === 'more') {
    return t('dash_monthcompare_more', null, { amount: formatPKR(Math.abs(differenceCents) / 100) });
  }
  if (direction === 'less') {
    return t('dash_monthcompare_less', null, { amount: formatPKR(Math.abs(differenceCents) / 100) });
  }
  return t('dash_monthcompare_same');
}

/**
 * Renders the month-versus-month comparison line into the
 * billing dashboard.
 *
 * @param {Document} doc - The host page for the view
 * @param {Object} summary - Output of calculateMonthComparison
 */
export function renderMonthComparison(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('mvcMonthTotal');
  if (totalEl) totalEl.textContent = formatPKR((summary.currentCents ?? 0) / 100);
  const lineEl = doc.getElementById('mvcMonthLine');
  if (lineEl) {
    lineEl.textContent = t('dash_monthcompare_line', null, {
      current: formatPKR((summary.currentCents ?? 0) / 100),
      previous: formatPKR((summary.previousCents ?? 0) / 100)
    });
  }
  const diffEl = doc.getElementById('mvcMonthDiff');
  if (diffEl) diffEl.textContent = monthComparisonDifferenceText(summary);
}
