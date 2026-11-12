/*
 * QC-2 — Priority indicator on collection cards + oldest-first sort +
 * high-balance tiers. Surfacing only: the 0–100 buildSmartDuesRecovery
 * score already exists (owner-insights.js — High ≥75 / Medium 35–74 /
 * Low <35, with verbatim reasons; the Dues Recovery Overhaul raised
 * High from ≥65 and added the 75-point floor for arrears, 2+ unpaid
 * bills or an overdue Waada, so a card that was High at 65–74 without
 * one of those signals is Medium now), but it is shown only in the
 * owner view, never where collection happens. This module is the shared
 * read-only layer the Quick Collect picker cards and the Field Mode
 * cards both use to surface that score unchanged: tier + first reason
 * + high-balance tier labels. It invents no scoring, changes no
 * score, and re-ranks nothing the score does not already rank.
 *
 * High-balance tiers (audit MISSING #4) use figures already in the
 * code, not invented thresholds: 2+ months arrears is the
 * dueMonthCount >= 2 arrears definition (roster-quick-filters.js),
 * 90+ days overdue is the 90+ aging bucket (dashboard-dues-aging.js).
 * Both inputs come from the scorer row (openBillCount /
 * longestOverdueDays), so a card with no scorer row — no open priced
 * bill, e.g. baqaya-only — gets no tier at all: missing data is
 * never shown as a value.
 *
 * Oldest-first sort orders by the oldest unpaid bill month, then by
 * amount desc, then by customer number asc — the
 * dashboard-overdue-list.js tie-break. Entries with no unpaid month
 * (null earliestUnpaidMonth, e.g. baqaya-only) sort last. The sort
 * returns a new array and never mutates its input.
 *
 * Pure: no DOM, no clock, no storage, no mutation of its inputs.
 * The caller owns the scorer call and passes the result in.
 */

export const QC2_SORT_AMOUNT = 'amount';
export const QC2_SORT_OLDEST = 'oldest';

/** Scorer group strings, as buildSmartDuesRecovery emits them. */
export const QC2_PRIORITY_GROUPS = Object.freeze({
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
});

/** Tier -> i18n key for the badge label (renderers resolve via t()). */
export const QC2_PRIORITY_LABEL_KEYS = Object.freeze({
  high: 'qc2_priority_high',
  medium: 'qc2_priority_medium',
  low: 'qc2_priority_low',
});

/** Tier -> badge classes, reusing the existing .ds-chip variants. */
export const QC2_PRIORITY_BADGE_CLASSES = Object.freeze({
  high: 'ds-chip ds-chip--danger',
  medium: 'ds-chip ds-chip--warning',
  low: 'ds-chip',
});

/** High-balance tier key -> i18n key for the tier label. */
export const QC2_HIGH_BALANCE_TIER_LABEL_KEYS = Object.freeze({
  'multi-month': 'qc2_tier_multi_month',
  'long-overdue': 'qc2_tier_long_overdue',
});

/** Open-bill-month count at which a balance is multi-month arrears. */
export const QC2_MULTI_MONTH_MIN_MONTHS = 2;

/** Overdue days at which a balance is long overdue (90+ bucket). */
export const QC2_LONG_OVERDUE_MIN_DAYS = 90;

/**
 * Maps a sort control value to a sort order. Only 'oldest' selects
 * the oldest-first order; anything else — including unknown values —
 * falls back to the default highest-dues-first order, so a stray
 * value can never silently re-order the list.
 */
export function qc2SortOrderFromValue(value) {
  return value === QC2_SORT_OLDEST ? QC2_SORT_OLDEST : QC2_SORT_AMOUNT;
}

/**
 * Flattens a buildSmartDuesRecovery result into a Map keyed by
 * customer id. A missing or malformed result reads as an empty map,
 * so a card with no scorer row simply finds nothing.
 */
export function qc2PriorityByCustomerId(recoveryResult) {
  const byId = new Map();
  const groups = recoveryResult?.groups;
  if (!Array.isArray(groups)) return byId;
  for (const group of groups) {
    if (!group || !Array.isArray(group.customers)) continue;
    for (const row of group.customers) {
      if (row && typeof row.customerId === 'string') byId.set(row.customerId, row);
    }
  }
  return byId;
}

/**
 * Maps a scorer group string to its tier: 'high' | 'medium' |
 * 'low', or null for anything else (including a missing row).
 */
export function qc2PriorityTier(group) {
  if (group === QC2_PRIORITY_GROUPS.high) return 'high';
  if (group === QC2_PRIORITY_GROUPS.medium) return 'medium';
  if (group === QC2_PRIORITY_GROUPS.low) return 'low';
  return null;
}

/**
 * The scorer's own first reason, verbatim — or null when the row
 * carries no reasons. Dynamic sentences with amounts stay in the
 * scorer's English, exactly as the owner view shows them.
 */
export function qc2TopReason(scoreRow) {
  const reasons = scoreRow?.reasons;
  if (!Array.isArray(reasons) || reasons.length === 0) return null;
  return typeof reasons[0] === 'string' ? reasons[0] : null;
}

/**
 * High-balance tier keys for one scorer row, in display order:
 * 'multi-month' when the customer owes 2+ open bill months,
 * 'long-overdue' when the oldest due is 90+ days overdue. Either,
 * both, or neither — and none at all when the row is missing.
 */
export function qc2HighBalanceTiers(scoreRow) {
  if (!scoreRow || typeof scoreRow !== 'object') return [];
  const tiers = [];
  if (typeof scoreRow.openBillCount === 'number' && scoreRow.openBillCount >= QC2_MULTI_MONTH_MIN_MONTHS) {
    tiers.push('multi-month');
  }
  if (typeof scoreRow.longestOverdueDays === 'number' && scoreRow.longestOverdueDays >= QC2_LONG_OVERDUE_MIN_DAYS) {
    tiers.push('long-overdue');
  }
  return tiers;
}

/**
 * The full priority presentation for one collection card, or null
 * when the scorer has no row for the customer — the caller renders
 * nothing in that case, never a guessed tier.
 */
export function qc2CardPriority(scoreRow) {
  const tier = qc2PriorityTier(scoreRow?.group);
  if (!tier) return null;
  return {
    tier,
    badgeClass: QC2_PRIORITY_BADGE_CLASSES[tier],
    labelKey: QC2_PRIORITY_LABEL_KEYS[tier],
    reason: qc2TopReason(scoreRow),
    tierKeys: qc2HighBalanceTiers(scoreRow),
  };
}

/**
 * Oldest-first order: oldest unpaid bill month first; entries with
 * no unpaid month (null earliestUnpaidMonth) sort last; ties break
 * by amount desc, then customer number asc. Returns a new array —
 * the input pool is shared with Bulk Collect, Field Mode and the
 * dashboard, and is never re-ordered in place.
 */
export function qc2SortByOldestFirst(entries) {
  const list = Array.isArray(entries) ? [...entries] : [];
  return list.sort((a, b) => {
    const aMonth = a?.earliestUnpaidMonth;
    const bMonth = b?.earliestUnpaidMonth;
    if (aMonth && bMonth && aMonth !== bMonth) return aMonth < bMonth ? -1 : 1;
    if (aMonth && !bMonth) return -1;
    if (!aMonth && bMonth) return 1;
    const aDues = typeof a?.totalDues === 'number' ? a.totalDues : 0;
    const bDues = typeof b?.totalDues === 'number' ? b.totalDues : 0;
    if (aDues !== bDues) return bDues - aDues;
    const aNum = typeof a?.customerNumber === 'number' ? a.customerNumber : 0;
    const bNum = typeof b?.customerNumber === 'number' ? b.customerNumber : 0;
    return aNum - bNum;
  });
}

/**
 * Applies the chosen sort order to a collection pool. 'oldest'
 * returns the oldest-first order; any other order returns the pool
 * itself, untouched — the default (highest dues first) is the
 * pool's own order and is never rebuilt.
 */
export function qc2SortCollectionEntries(entries, sortOrder) {
  return qc2SortOrderFromValue(sortOrder) === QC2_SORT_OLDEST
    ? qc2SortByOldestFirst(entries)
    : entries;
}
