/*
 * QC-6 — Collection insights card: one card on the main dashboard,
 * right after the QC-5 Today's Field Recovery card, showing the three
 * collection-insight figures the audit found missing:
 *
 * 1. Collection success rate — ONE named rate, collected ÷ billed
 *    for the current month. It is the area-collections overall rate
 *    (dashboard-area-collections.js), reused here, not re-derived:
 *    the card reads summary.totalBilled / totalCollected /
 *    overallCollectionRate from calculateAreaWiseCollections, so the
 *    rate on this card can never disagree with the area-collections
 *    surface on the same fixture. Billed is this month's bills;
 *    collected is every payment dated this month, including old-
 *    balance receipts — so the rate can honestly exceed 100% when
 *    old balances are paid. The existing area-collections rule is
 *    kept: billed 0 with collections reads 100%. One display rule is
 *    added here only: billed 0 AND collected 0 reads no rate at all
 *    (an em dash), never a guessed 0% or 100%. The area-collections
 *    summary rounds its totals to whole rupees (3300.50 reads as
 *    3301 there), so the card's "Collected X of Y billed" line shows
 *    the same whole-rupee figures the area-collections surface
 *    shows — the ratio on the card always matches its rate.
 * 2. Average collected per visit — today's collected ÷ the distinct
 *    customers visited today. Both figures come from the same daily-
 *    closing receipts the today card and the QC-5 card already use
 *    (calculateDashboardTodayCard for the collected amount,
 *    calculateDailyClosingSummary receipts for the visited
 *    customers), so this average can never disagree with either card.
 *    A customer with two receipts today counts as one visit. A day
 *    with no visits reads no average, never a guessed zero.
 * 3. Day-over-day recovery — today's collected vs yesterday's
 *    collected, from the same daily-closing source (the summary is
 *    asked for yesterday's date, one day back from the caller's
 *    reference date). When yesterday had no receipts at all, the
 *    card says so plainly ("No collections yesterday") and shows no
 *    change — a missing yesterday is never zero-filled into a
 *    fabricated percent. When yesterday did have receipts, the change
 *    is shown in PKR with its percent, including a real −100% when
 *    today is empty.
 *
 * The audit's "+ prior-days trend" (a multi-day trend line) is
 * deliberately NOT built here: the brief's three figures are the
 * whole surface, and a trend needs a longer window than today vs
 * yesterday. Nothing here invents a figure, a target, or a store.
 *
 * Pure: the caller owns the clock (referenceDate) and the state.
 * Yesterday is computed by shifting the caller's date, never by
 * reading the clock. This module never touches storage directly,
 * never mutates its inputs, and never edits a bill, a payment, or
 * a customer.
 */

import { calculateDashboardTodayCard } from './dashboard-today-card.js';
import { calculateDailyClosingSummary, formatDateYmd } from './dashboard-daily-closing.js';
import { calculateAreaWiseCollections } from './dashboard-area-collections.js';
import { formatPKR } from './core.js';
import { t } from './nav-language.js';

function toCents(rupees) {
  return Math.round(Number(rupees || 0) * 100);
}

/**
 * Calculates the collection-insights figures for one day.
 *
 * @param {Object} state - Application state
 * @param {Date} referenceDate - The day to report on (required; the
 *   caller owns the clock, this module never reads it)
 * @returns {Object} { today, month, successRatePct, monthBilledCents,
 *   monthCollectedCents, avgPerVisitCents, customersVisitedCount,
 *   todayCollectedCents, todayPaymentCount, yesterday,
 *   yesterdayCollectedCents, yesterdayPaymentCount, hasYesterdayData,
 *   dayOverDayChangeCents, dayOverDayChangePct } — money in integer
 *   cents; the three "no data" figures are null, never a guessed 0
 */
export function calculateCollectionInsights(state, referenceDate) {
  const today = formatDateYmd(referenceDate);
  const summary = {
    today,
    month: today ? today.slice(0, 7) : '',
    successRatePct: null,
    monthBilledCents: 0,
    monthCollectedCents: 0,
    avgPerVisitCents: null,
    customersVisitedCount: 0,
    todayCollectedCents: 0,
    todayPaymentCount: 0,
    yesterday: '',
    yesterdayCollectedCents: 0,
    yesterdayPaymentCount: 0,
    hasYesterdayData: false,
    dayOverDayChangeCents: null,
    dayOverDayChangePct: null,
  };
  if (!today) return summary;

  // Today: the same source as the today card and the QC-5 card, so
  // the collected figure and the visited count always agree with
  // both. The today card sums the daily-closing receipts; the
  // visited count is the distinct customers among those receipts.
  const todayCard = calculateDashboardTodayCard(state ?? {}, referenceDate);
  summary.todayCollectedCents = todayCard.todayCollectedCents ?? 0;
  summary.todayPaymentCount = todayCard.todayPaymentCount ?? 0;
  const daily = calculateDailyClosingSummary(state ?? {}, referenceDate, { selectedDate: today });
  const visited = new Set();
  for (const receipt of (Array.isArray(daily.receipts) ? daily.receipts : [])) {
    const customerId = receipt?.customerId;
    if (typeof customerId === 'string' && customerId !== '') visited.add(customerId);
  }
  summary.customersVisitedCount = visited.size;
  summary.avgPerVisitCents = visited.size > 0
    ? Math.round(summary.todayCollectedCents / visited.size)
    : null;

  // Yesterday: the same daily-closing source, asked for one day back.
  // The date is shifted from the caller's reference date — the clock
  // is never read here.
  const yesterdayDate = new Date(referenceDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatDateYmd(yesterdayDate);
  summary.yesterday = yesterday;
  const yesterdayDaily = calculateDailyClosingSummary(state ?? {}, yesterdayDate, { selectedDate: yesterday });
  const yesterdayReceipts = Array.isArray(yesterdayDaily.receipts) ? yesterdayDaily.receipts : [];
  summary.yesterdayCollectedCents = yesterdayReceipts.reduce((sum, receipt) => sum + toCents(receipt?.amount), 0);
  summary.yesterdayPaymentCount = Number(yesterdayDaily.todayCount) || 0;
  summary.hasYesterdayData = summary.yesterdayPaymentCount > 0;
  if (summary.hasYesterdayData && summary.yesterdayCollectedCents > 0) {
    summary.dayOverDayChangeCents = summary.todayCollectedCents - summary.yesterdayCollectedCents;
    summary.dayOverDayChangePct = Math.round(
      (summary.dayOverDayChangeCents / summary.yesterdayCollectedCents) * 100,
    );
  }

  // Success rate: this month, collected ÷ billed, from the
  // area-collections summary — the same definition and the same
  // numbers the area-collections surface already shows.
  const area = calculateAreaWiseCollections(state ?? {}, { month: summary.month, referenceDate });
  summary.monthBilledCents = Math.round(Number(area?.summary?.totalBilled ?? 0) * 100);
  summary.monthCollectedCents = Math.round(Number(area?.summary?.totalCollected ?? 0) * 100);
  summary.successRatePct = (summary.monthBilledCents === 0 && summary.monthCollectedCents === 0)
    ? null
    : (area?.summary?.overallCollectionRate ?? null);
  return summary;
}

/**
 * Renders the collection-insights card's figures into the billing
 * dashboard. The card is found by class and its fields by class —
 * no element ids are introduced.
 *
 * @param {Document} doc - The host page for the card
 * @param {Object} summary - Output of calculateCollectionInsights
 */
export function renderCollectionInsightsCard(doc, summary) {
  if (!doc || !summary) return;
  const card = doc.querySelector('.qc6-collection-insights-card');
  if (!card) return;
  const setText = (selector, value) => {
    const el = card.querySelector(selector);
    if (el) el.textContent = value;
  };
  setText('.qc6-rate', summary.successRatePct === null || summary.successRatePct === undefined
    ? '—'
    : `${summary.successRatePct}%`);
  setText('.qc6-rate-detail', summary.successRatePct === null || summary.successRatePct === undefined
    ? t('qc6_no_rate')
    : t('qc6_rate_detail', null, {
      collected: formatPKR((summary.monthCollectedCents ?? 0) / 100),
      billed: formatPKR((summary.monthBilledCents ?? 0) / 100),
    }));
  setText('.qc6-avg', summary.avgPerVisitCents === null || summary.avgPerVisitCents === undefined
    ? '—'
    : formatPKR((summary.avgPerVisitCents ?? 0) / 100));
  setText('.qc6-avg-sub', (summary.customersVisitedCount ?? 0) > 0
    ? t('qc6_avg_sub', null, { count: String(summary.customersVisitedCount) })
    : t('qc6_no_visits'));
  if (!summary.hasYesterdayData) {
    setText('.qc6-dod', '—');
    setText('.qc6-dod-badge', '');
    setText('.qc6-dod-sub', t('qc6_no_yesterday'));
  } else {
    const pct = summary.dayOverDayChangePct ?? 0;
    const signedPct = (pct > 0 ? '+' : '') + String(pct);
    // Collect Tab polish: the percent leaves the nowrap value (it
    // clipped to "(+18...") and becomes a compact green badge under
    // it, so the percent never truncates.
    setText('.qc6-dod', formatPKR((summary.dayOverDayChangeCents ?? 0) / 100));
    setText('.qc6-dod-badge', `${signedPct}%`);
    setText('.qc6-dod-sub', t('qc6_dod_sub', null, {
      today: formatPKR((summary.todayCollectedCents ?? 0) / 100),
      yesterday: formatPKR((summary.yesterdayCollectedCents ?? 0) / 100),
    }));
  }
}
