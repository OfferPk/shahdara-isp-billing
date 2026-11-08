/*
 * Dashboard today card — one-glance today figures for the billing
 * dashboard: collections so far today in PKR, the count of payments
 * today, and the dues falling due today in PKR.
 *
 * The three figures are composed from the records the app already
 * keeps — nothing here edits a bill, a payment, or a customer.
 * Today's collections and payment count come from the daily closing
 * summary for the dashboard's own day (voided receipts are history,
 * never collected cash, and archived customers never appear), and
 * the dues due today are the positive remaining balances of the
 * bills whose due date is today, read through the allocation
 * engine, so a bill already paid in full counts for nothing. A day
 * with no payments yet reads zero, never a blank. All money is PKR
 * only, never converted to any other currency.
 */

import { calculateDailyClosingSummary, formatDateYmd } from './dashboard-daily-closing.js';
import { calculatePaymentAllocations, formatPKR } from './core.js';
import { t } from './nav-language.js';

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Calculates the today card's three figures for one day.
 *
 * @param {Object} state - Application state
 * @param {Date} referenceDate - The day to report on (required; the
 *   caller owns the clock, this module never reads it)
 * @returns {Object} { today, todayCollectedCents, todayPaymentCount,
 *   duesDueTodayCents, duesDueTodayCount } — money in integer cents
 */
export function calculateDashboardTodayCard(state, referenceDate) {
  const today = formatDateYmd(referenceDate);
  const summary = {
    today,
    todayCollectedCents: 0,
    todayPaymentCount: 0,
    duesDueTodayCents: 0,
    duesDueTodayCount: 0
  };
  if (!today) return summary;

  // The daily closing summary is asked for the dashboard's own day,
  // so the count and the amount below always agree on which day is
  // "today". Its receipts carry the exact amounts, so the collected
  // figure keeps paisa precision.
  const daily = calculateDailyClosingSummary(state ?? {}, referenceDate, { selectedDate: today });
  const receipts = Array.isArray(daily.receipts) ? daily.receipts : [];
  summary.todayCollectedCents = receipts.reduce((sum, receipt) => sum + toCents(receipt?.amount), 0);
  summary.todayPaymentCount = Number(daily.todayCount) || 0;

  const allocations = calculatePaymentAllocations(state ?? {});
  for (const customer of (state?.customers ?? [])) {
    if (customer.archived) continue;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      if (bill.dueDate !== today) continue;
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount))) continue;
      const allocation = allocations.forMonth(customer.id, bill.month);
      const balanceCents = allocation?.balanceDueCents ?? toCents(amount);
      if (balanceCents > 0) {
        summary.duesDueTodayCents += balanceCents;
        summary.duesDueTodayCount += 1;
      }
    }
  }
  return summary;
}

/**
 * Renders the today card's figures into the billing dashboard.
 *
 * @param {Document} doc - The host page for the card
 * @param {Object} summary - Output of calculateDashboardTodayCard
 */
export function renderDashboardTodayCard(doc, summary) {
  if (!doc || !summary) return;
  const collectedEl = doc.getElementById('dtcTodayCollected');
  if (collectedEl) collectedEl.textContent = formatPKR((summary.todayCollectedCents ?? 0) / 100);
  const countEl = doc.getElementById('dtcTodayCount');
  if (countEl) countEl.textContent = String(summary.todayPaymentCount ?? 0);
  const dueEl = doc.getElementById('dtcDuesDueToday');
  if (dueEl) dueEl.textContent = formatPKR((summary.duesDueTodayCents ?? 0) / 100);
  const periodEl = doc.getElementById('dtcTodayPeriod');
  if (periodEl) periodEl.textContent = t('dash_todaycard_period', null, { date: summary.today ?? '' });
}
