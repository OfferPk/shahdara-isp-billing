/*
 * Dashboard one-page printable summary — the billing dashboard on
 * one clean page, for a quick look away from the screen or to show
 * someone: today's collections, this month's collections, total
 * dues, the overdue total, and cash in hand, all in PKR, with a
 * single print action.
 *
 * The five figures are composed from the records the app already
 * keeps — nothing here edits a bill, a payment, or a customer.
 * Each figure is read through the same helper the live dashboard
 * section already uses, so the printed page can never disagree
 * with the screen on the same fixture:
 *   - today's collections: the today card's collected figure for
 *     the dashboard's own day (voided receipts are history,
 *     never collected cash, and archived customers never
 *     appear);
 *   - this month's collections: the month comparison's current
 *     figure, the ledger's own monthly total for the dashboard's
 *     month — the monthly snapshot counts every recorded
 *     payment by its date, so a payment from a customer who is
 *     archived now still counts here, exactly as the monthly
 *     report counts it;
 *   - total dues: the dashboard's own total-due figure, the
 *     outstanding balances of the retained bills through the
 *     allocation engine — the same figure the summary grid
 *     already shows, quirks included, so the page and the grid
 *     can never disagree;
 *   - overdue total: the overdue list's total, the positive
 *     remaining balances of bills already past due;
 *   - cash in hand: the cash-in-hand figure, the cash collected
 *     and not yet handed over.
 * A business with nothing to show reads zero, never a blank.
 *
 * The module only calculates and renders the five figures into
 * the summary section on the page. The print action itself lives
 * with the page: one tap adds the print-only class and opens the
 * print dialog, and the print rules show only the summary
 * section, so the printed page is the summary and nothing else.
 * Plan 328's monthly report pack checklist is about assembling a
 * month's pack of reports and never prints a dashboard page, and
 * the owner report pack is a monthly pack of analytics sections,
 * not a one-page dashboard summary — so this module is the
 * missing piece. All money is PKR only, never converted to any
 * other currency. The caller owns the clock — the reference date
 * is a required parameter — and passes the record store the
 * handovers were saved in, so this module reads no store, clock,
 * or page itself.
 */

import { calculateDashboard, formatPKR } from './core.js';
import { calculateDashboardTodayCard } from './dashboard-today-card.js';
import { calculateMonthComparison } from './dashboard-month-comparison.js';
import { calculateOverdueList } from './dashboard-overdue-list.js';
import { calculateCashInHand } from './dashboard-cash-in-hand.js';
import { formatDateYmd } from './dashboard-daily-closing.js';
import { pktMonth } from './phase3.js';
import { t } from './nav-language.js';

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Calculates the one-page summary's five figures for the
 * dashboard's own day, in integer cents.
 *
 * @param {Object} state - Application state
 * @param {Date} referenceDate - The dashboard's own day; the
 *   month is read from it in Pakistan time
 * @param {Object|null} [storage=null] - The record store the
 *   handovers were saved in; null means no handover record is
 *   read, so every cash receipt counts as still in hand
 * @returns {Object} { today, month, todayCollectedCents,
 *   monthCollectedCents, totalDuesCents, overdueTotalCents,
 *   cashInHandCents } — money in integer cents
 */
export function calculatePrintSummary(state, referenceDate, storage = null) {
  const today = formatDateYmd(referenceDate);
  const month = pktMonth(referenceDate);
  const summary = {
    today,
    month,
    todayCollectedCents: 0,
    monthCollectedCents: 0,
    totalDuesCents: 0,
    overdueTotalCents: 0,
    cashInHandCents: 0
  };
  if (!today || !month) return summary;
  // Each figure comes from the helper its live section already
  // uses, so the printed page and the screen always agree.
  summary.todayCollectedCents = calculateDashboardTodayCard(state, referenceDate).todayCollectedCents ?? 0;
  summary.monthCollectedCents = calculateMonthComparison(state, referenceDate).currentCents ?? 0;
  summary.totalDuesCents = toCents(calculateDashboard(state, referenceDate).totalDue);
  summary.overdueTotalCents = calculateOverdueList(state, referenceDate).totalCents ?? 0;
  summary.cashInHandCents = calculateCashInHand(state, referenceDate, storage).amountCents ?? 0;
  return summary;
}

/**
 * Renders the summary's five figures into the billing dashboard.
 *
 * @param {Object} doc - The host page for the view
 * @param {Object} summary - Output of calculatePrintSummary
 */
export function renderPrintSummary(doc, summary) {
  if (!doc || !summary) return;
  const dateEl = doc.getElementById('ppsPrintDate');
  if (dateEl) dateEl.textContent = t('dash_printsummary_date', null, { date: summary.today ?? '' });
  const todayEl = doc.getElementById('ppsTodayCollected');
  if (todayEl) todayEl.textContent = formatPKR((summary.todayCollectedCents ?? 0) / 100);
  const monthEl = doc.getElementById('ppsMonthCollected');
  if (monthEl) monthEl.textContent = formatPKR((summary.monthCollectedCents ?? 0) / 100);
  const duesEl = doc.getElementById('ppsTotalDues');
  if (duesEl) duesEl.textContent = formatPKR((summary.totalDuesCents ?? 0) / 100);
  const overdueEl = doc.getElementById('ppsOverdueTotal');
  if (overdueEl) overdueEl.textContent = formatPKR((summary.overdueTotalCents ?? 0) / 100);
  const cashEl = doc.getElementById('ppsCashInHand');
  if (cashEl) cashEl.textContent = formatPKR((summary.cashInHandCents ?? 0) / 100);
}
