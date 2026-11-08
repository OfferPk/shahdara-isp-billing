/*
 * Dashboard month target progress line — one plain line on the
 * billing dashboard, so the owner sees mid-month, in rupees,
 * how far along this month's collection target is: the target
 * itself, what has been collected so far, and the amount still
 * to collect, in plain words.
 *
 * The line is composed from the existing monthly target record
 * and the ledger's own monthly totals — the same source the
 * dashboard and the monthly report already show — so the
 * collected figure can never disagree with them. The target
 * suite behind its modal is a gauge, run-rate forecast, history,
 * CSV export, WhatsApp summary and printable slips, not a plain
 * dashboard line, so this module is the missing piece. The
 * remaining figure follows the target suite's own rule verbatim:
 * target minus collected, never below zero — when the collected
 * figure reaches the target, the line says so in plain words
 * instead of showing a negative remainder. A voided receipt is
 * history, never collected cash, and a payment counts in the
 * month of its date, never its bill month.
 *
 * The line is read-only: it edits no bill, payment, or customer
 * record. All money is PKR only, never converted to any other
 * currency. The caller owns the clock — the reference date is a
 * required parameter and the month is read from it in Pakistan
 * time — and the caller passes the record store the target was
 * saved in, so this module reads no store, clock, or page
 * itself.
 */

import { calculateCollectionTargetMetrics } from './dashboard-collection-target.js?v=1.11.0';
import { formatPKR } from './core.js?v=1.11.0';
import { t } from './nav-language.js?v=1.11.0';
import { pktMonth } from './phase3.js?v=1.11.0';

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Reads this month's target progress in integer cents, from the
 * existing target record and the ledger's own monthly totals.
 *
 * @param {Object} state - The app state
 * @param {Date} referenceDate - The dashboard's own day; the
 *   month is read from it in Pakistan time
 * @param {Object|null} [storage=null] - The record store the
 *   target was saved in; null means no target record is read
 * @returns {Object} The month, whether a target is set, the
 *   target, collected, and remaining figures in cents, the
 *   progress percent, and whether the target is reached
 */
export function calculateMonthTargetProgress(state, referenceDate, storage = null) {
  const safeState = {
    ...(state ?? {}),
    customers: Array.isArray(state?.customers) ? state.customers : []
  };
  const month = pktMonth(referenceDate);
  const metrics = calculateCollectionTargetMetrics(safeState, month, { referenceDate, storage });
  const hasTarget = metrics?.hasTarget === true;
  const targetCents = hasTarget ? toCents(metrics.target) : null;
  const collectedCents = toCents(metrics?.collected);
  const remainingCents = hasTarget ? Math.max(0, targetCents - collectedCents) : null;
  const isHit = hasTarget ? collectedCents >= targetCents : false;
  return {
    month,
    hasTarget,
    targetCents,
    collectedCents,
    remainingCents,
    progressPercent: metrics?.progressPercent ?? null,
    isHit
  };
}

/**
 * Reads the remaining amount in plain words: how much is still
 * to collect, that the target is reached, or that no target is
 * set for this month.
 *
 * @param {Object} summary - Output of calculateMonthTargetProgress
 * @returns {string} The plain-word remaining line
 */
export function monthTargetRemainingText(summary) {
  if (!summary?.hasTarget) return t('dash_monthtarget_notset');
  if (summary.isHit) return t('dash_monthtarget_reached');
  return t('dash_monthtarget_remaining', null, { amount: formatPKR((summary.remainingCents ?? 0) / 100) });
}

/**
 * Renders the month-target progress line into the billing
 * dashboard.
 *
 * @param {Document} doc - The host page for the view
 * @param {Object} summary - Output of calculateMonthTargetProgress
 */
export function renderMonthTarget(doc, summary) {
  if (!doc || !summary) return;
  const totalEl = doc.getElementById('mtpTargetTotal');
  if (totalEl) totalEl.textContent = summary.hasTarget ? formatPKR((summary.targetCents ?? 0) / 100) : t('dash_not_set');
  const lineEl = doc.getElementById('mtpTargetLine');
  if (lineEl) {
    lineEl.textContent = summary.hasTarget
      ? t('dash_monthtarget_line', null, {
          collected: formatPKR((summary.collectedCents ?? 0) / 100),
          target: formatPKR((summary.targetCents ?? 0) / 100)
        })
      : t('dash_monthtarget_collected', null, { collected: formatPKR((summary.collectedCents ?? 0) / 100) });
  }
  const remainingEl = doc.getElementById('mtpTargetRemaining');
  if (remainingEl) remainingEl.textContent = monthTargetRemainingText(summary);
}
