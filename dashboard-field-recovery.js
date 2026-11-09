/*
 * QC-5 — Today's Field Recovery card: one card on the main dashboard
 * composing the day's recovery figures that already exist in five
 * different places — today's recovered and payment count (the today
 * card), the day target (the field day target), the progress bar
 * (the Quick Collect daily-target bar), and the pending customers
 * (the QC picker pool) — plus the one figure that is new, distinct
 * customers visited today, derived from today's receipts. Composition,
 * not new computation: every figure is read from the module that
 * already owns it, so this card can never disagree with the today
 * card, the QC target bar, or the picker on the same fixture.
 *
 * Target rule: the operator-set day target (day-target.js, stored
 * date-indexed under its own key) is used when one is set for today.
 * When none is set, the target is derived honestly from existing
 * data — today's total pending dues at day start, which is the
 * pending dues still outstanding now plus what has already been
 * collected today (the only thing that changes outstanding dues
 * intraday is today's collections; the current month's bills already
 * exist at day start). The card always says which target it is
 * showing (operator / today's pending dues), and it never invents a
 * target-setting UI or a hardcoded target. Remaining is target minus
 * collected, never negative; the bar is capped at 100%, so collecting
 * past the target fills it without overflowing it. A day with nothing
 * pending and nothing collected reads zero, never a blank.
 *
 * Pure: the caller owns the clock (referenceDate) and the storage
 * (passed through to getDayTarget). This module never reads the
 * clock, never touches storage directly, never mutates its inputs,
 * and never edits a bill, a payment, or a customer.
 */

import { calculateDashboardTodayCard } from './dashboard-today-card.js';
import { calculateDailyClosingSummary, formatDateYmd } from './dashboard-daily-closing.js';
import { getDayTarget } from './day-target.js';
import { getPendingCollectionCustomers } from './nav-quick-collect.js';
import { formatPKR } from './core.js';
import { t } from './nav-language.js';

function toCents(rupees) {
  return Math.round(Number(rupees || 0) * 100);
}

/**
 * Calculates the field recovery card's figures for one day.
 *
 * @param {Object} state - Application state
 * @param {Date} referenceDate - The day to report on (required; the
 *   caller owns the clock, this module never reads it)
 * @param {Object|null} storage - Storage object for the operator day
 *   target (localStorage in the app, a fake in tests); null reads as
 *   "no operator target set"
 * @returns {Object} { today, todayCollectedCents, todayPaymentCount,
 *   customersVisitedCount, pendingCustomersCount, pendingDuesCents,
 *   operatorTargetCents, targetCents, targetSource, progressPct,
 *   remainingCents, targetReached } — money in integer cents
 */
export function calculateFieldRecoveryToday(state, referenceDate, storage = null) {
  const today = formatDateYmd(referenceDate);
  const summary = {
    today,
    todayCollectedCents: 0,
    todayPaymentCount: 0,
    customersVisitedCount: 0,
    pendingCustomersCount: 0,
    pendingDuesCents: 0,
    operatorTargetCents: null,
    targetCents: 0,
    targetSource: 'pending',
    progressPct: 0,
    remainingCents: 0,
    targetReached: false,
  };
  if (!today) return summary;

  // Collected and payment count come from the today card itself, so
  // this card and the today card always agree on the same day.
  const todayCard = calculateDashboardTodayCard(state ?? {}, referenceDate);
  summary.todayCollectedCents = todayCard.todayCollectedCents ?? 0;
  summary.todayPaymentCount = todayCard.todayPaymentCount ?? 0;

  // Customers visited is the one new figure: distinct customers
  // among today's receipts, from the same daily closing summary the
  // today card sums. A customer with two receipts today counts once;
  // a receipt with no customer id counts for nobody. Voided receipts
  // and archived customers never appear in the summary's receipts.
  const daily = calculateDailyClosingSummary(state ?? {}, referenceDate, { selectedDate: today });
  const receipts = Array.isArray(daily.receipts) ? daily.receipts : [];
  const visited = new Set();
  for (const receipt of receipts) {
    const customerId = receipt?.customerId;
    if (typeof customerId === 'string' && customerId !== '') visited.add(customerId);
  }
  summary.customersVisitedCount = visited.size;

  // Pending customers and pending dues come from the QC picker pool,
  // so the card's pending count always agrees with the picker.
  const pending = getPendingCollectionCustomers(state ?? {}, '', 'all-dues', referenceDate);
  summary.pendingCustomersCount = pending.length;
  summary.pendingDuesCents = pending.reduce((sum, entry) => sum + toCents(entry?.totalDues), 0);

  // The target: the operator-set day target when one is set for
  // today, otherwise today's pending dues at day start (pending now
  // plus collected today — see the module header).
  const operatorTarget = getDayTarget(storage, today).amount;
  summary.operatorTargetCents = operatorTarget === null || operatorTarget === undefined
    ? null
    : toCents(operatorTarget);
  if (summary.operatorTargetCents !== null) {
    summary.targetSource = 'operator';
    summary.targetCents = summary.operatorTargetCents;
  } else {
    summary.targetSource = 'pending';
    summary.targetCents = summary.pendingDuesCents + summary.todayCollectedCents;
  }

  // Progress and remaining follow the daily-target-progress rule:
  // capped at 100%, remaining never negative.
  summary.progressPct = summary.targetCents > 0
    ? Math.min(100, Math.round((summary.todayCollectedCents / summary.targetCents) * 100))
    : 0;
  summary.remainingCents = Math.max(summary.targetCents - summary.todayCollectedCents, 0);
  summary.targetReached = summary.targetCents > 0 && summary.todayCollectedCents >= summary.targetCents;
  return summary;
}

/**
 * Renders the field recovery card's figures into the billing
 * dashboard. The card is found by class and its fields by class —
 * no element ids are introduced.
 *
 * @param {Document} doc - The host page for the card
 * @param {Object} summary - Output of calculateFieldRecoveryToday
 */
export function renderFieldRecoveryTodayCard(doc, summary) {
  if (!doc || !summary) return;
  const card = doc.querySelector('.qc5-field-recovery-card');
  if (!card) return;
  const setText = (selector, value) => {
    const el = card.querySelector(selector);
    if (el) el.textContent = value;
  };
  setText('.qc5-recovered', formatPKR((summary.todayCollectedCents ?? 0) / 100));
  setText('.qc5-target', formatPKR((summary.targetCents ?? 0) / 100));
  setText('.qc5-target-source', summary.targetSource === 'operator'
    ? t('qc5_target_source_operator')
    : t('qc5_target_source_pending'));
  setText('.qc5-payments', String(summary.todayPaymentCount ?? 0));
  setText('.qc5-visited', String(summary.customersVisitedCount ?? 0));
  setText('.qc5-remaining', formatPKR((summary.remainingCents ?? 0) / 100));
  setText('.qc5-pending', String(summary.pendingCustomersCount ?? 0));
  const pct = Math.max(0, Math.min(100, Number(summary.progressPct) || 0));
  const fill = card.querySelector('.qc5-progress-fill');
  if (fill) fill.style.width = `${pct}%`;
  const track = card.querySelector('.qc5-progress-track');
  if (track && typeof track.setAttribute === 'function') track.setAttribute('aria-valuenow', String(pct));
  setText('.qc5-progress-text', (summary.targetCents ?? 0) <= 0
    ? t('qc5_nothing_pending')
    : t('qc5_progress_text', null, {
      collected: formatPKR((summary.todayCollectedCents ?? 0) / 100),
      target: formatPKR((summary.targetCents ?? 0) / 100),
      pct: String(pct),
    }));
}
