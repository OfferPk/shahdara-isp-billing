// Plan 3 (Plan 1-100) — Field day target and progress tracker.
//
// DAY VIEW ONLY. This module computes one day's progress from figures
// the app already produces and from one operator-set number (the day
// target amount). It changes no collection rule, no commission figure,
// no handover figure, and no payment, Waada, or billing record:
//
//   * Visit counts are carried verbatim from the route builder
//     (calculateFieldCollectionRoutes in nav-collection-rounds.js):
//     planned = totalStops, done = collectedStops,
//     remaining = pendingStops. This module never recounts stops
//     from customers or payments, so the day view can never drift
//     from the route list on the same fixture. `visitsConsistent`
//     reports whether planned equals done + remaining, instead of
//     silently "fixing" a route builder that disagrees with itself.
//   * "Collected" for target progress is cash collected so far.
//     The route sheet's collected figure (dues marked collected on
//     this route view) and the day's cash receipts (handover
//     expected, dashboard-daily-closing.js) measure different
//     things — see the Plan S note in field-day-flow.js. The
//     caller passes cash receipts explicitly when it has them
//     (`cashCollected`); when it does not, the route collected
//     amount is used and `collectedSource` says so. Both figures
//     are always exposed, never blended into one invented total.
//   * The operator target is a single amount for one date, stored
//     date-indexed like the route progress record. When no target
//     is set, the route's total dues for the day are shown as the
//     target and `targetSource` is 'route', so the view is still
//     meaningful — but it never pretends an operator target exists
//     when none was set (`targetSet` is false in that case).
//
// The module is import-free by design (like route-sequencing.js,
// visit-outcomes.js and field-day-flow.js), so the route sheet can
// use it without pulling in the app graph. It never mutates its
// inputs, never reads the clock, and never touches storage except
// through the explicit get/set/clear helpers below, which take a
// storage object (the route sheet passes its own).

export const DAY_TARGET_STORAGE_KEY = 'shahdara_field_day_target';

export const DAY_TARGET_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  TARGET_REACHED: 'target_reached',
  COMPLETE: 'complete',
});

export const DAY_TARGET_STATUS_LABELS = Object.freeze({
  not_started: 'Not started',
  in_progress: 'In progress',
  target_reached: 'Target reached',
  complete: 'Day complete',
});

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value) {
  return value == null ? '' : String(value);
}

function escapeHtml(value) {
  return str(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAmount(value) {
  return `Rs. ${Math.round(num(value)).toLocaleString('en-US')}`;
}

// Normalises an operator-set target amount. A positive finite
// number is kept (rounded to whole rupees, as the app formats
// money); anything else — zero, negative, NaN, text — is unset,
// never coerced into a target of 0 that would read as "target
// reached" the moment a rupee is collected.
export function normalizeDayTargetAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function readStoredTarget(store, dateStr) {
  if (!store || typeof store.getItem !== 'function') return null;
  try {
    const raw = store.getItem(DAY_TARGET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.date === dateStr) {
      return normalizeDayTargetAmount(parsed.amount);
    }
    return null;
  } catch {
    return null;
  }
}

// Returns { date, amount } where amount is the operator-set target
// for that date, or null when none is set. The date defaults to
// today's date in Pakistan time, matching the route sheet's
// getTodayDateString; callers that already know the route date
// should pass it so the target never belongs to another day.
export function getDayTarget(storage, dateStr) {
  const date = str(dateStr) || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return { date, amount: readStoredTarget(storage, date) };
}

export function setDayTarget(storage, dateStr, amount) {
  const date = str(dateStr);
  const normalized = normalizeDayTargetAmount(amount);
  const payload = { date, amount: normalized };
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(DAY_TARGET_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }
  return payload;
}

export function clearDayTarget(storage, dateStr) {
  return setDayTarget(storage, dateStr, null);
}

/**
 * Pure: builds one day's target-and-progress view.
 *
 * @param {object} input
 * @param {object} [input.routeData] calculateFieldCollectionRoutes output
 * @param {number} [input.cashCollected] cash receipts recorded for
 *   the day, when the caller has them; otherwise the route
 *   collected amount is the progress basis (see module header).
 * @param {number|null} [input.targetAmount] operator-set target
 *   amount for the day; null/omitted means "no target set".
 * @param {string} [input.date] the day this view is for.
 */
export function buildDayTargetProgress(input = {}) {
  const routeData = input && typeof input.routeData === 'object' && input.routeData !== null
    ? input.routeData
    : {};
  const routeCollectedAmount = num(routeData.collectedAmount);
  const hasCash = input && input.cashCollected !== undefined && input.cashCollected !== null
    && Number.isFinite(Number(input.cashCollected));
  const cashCollected = hasCash ? num(input.cashCollected) : null;
  // Progress is measured on cash when the caller supplies it, and
  // on the route collected figure otherwise — never on a sum of
  // the two, which would double-count the same money.
  const collectedAmount = hasCash ? cashCollected : routeCollectedAmount;

  const visitsPlanned = num(routeData.totalStops);
  const visitsDone = num(routeData.collectedStops);
  const visitsRemaining = num(routeData.pendingStops);
  const visitCompletionRate = visitsPlanned > 0
    ? Math.round((visitsDone / visitsPlanned) * 100)
    : 0;

  const operatorTarget = normalizeDayTargetAmount(input?.targetAmount);
  const targetSet = operatorTarget !== null;
  const routeTotalDue = num(routeData.totalDue);
  const targetAmount = targetSet ? operatorTarget : routeTotalDue;
  const remainingToTarget = Math.max(targetAmount - collectedAmount, 0);
  const overTarget = Math.max(collectedAmount - targetAmount, 0);
  const amountProgressPct = targetAmount > 0
    ? Math.min(100, Math.round((collectedAmount / targetAmount) * 100))
    : 0;
  const targetReached = targetAmount > 0 && collectedAmount >= targetAmount;

  let status = DAY_TARGET_STATUSES.NOT_STARTED;
  if (visitsPlanned > 0 && visitsDone === visitsPlanned) {
    status = DAY_TARGET_STATUSES.COMPLETE;
  } else if (targetReached) {
    status = DAY_TARGET_STATUSES.TARGET_REACHED;
  } else if (visitsDone > 0 || collectedAmount > 0) {
    status = DAY_TARGET_STATUSES.IN_PROGRESS;
  }

  return {
    date: str(input?.date) || str(routeData.date),
    visitsPlanned,
    visitsDone,
    visitsRemaining,
    visitCompletionRate,
    visitsConsistent: visitsPlanned === visitsDone + visitsRemaining,
    targetAmount,
    targetSet,
    targetSource: targetSet ? 'operator' : 'route',
    collectedAmount,
    collectedSource: hasCash ? 'cash' : 'route',
    routeCollectedAmount,
    cashCollected,
    routeTotalDue,
    pendingAmount: num(routeData.pendingAmount),
    remainingToTarget,
    overTarget,
    amountProgressPct,
    targetReached,
    status,
    statusLabel: DAY_TARGET_STATUS_LABELS[status],
  };
}

// One-line plain-text summary, for the route manifest and for
// tests that should not depend on HTML markup.
export function dayTargetSummary(progress = {}) {
  const p = progress && typeof progress === 'object' ? progress : {};
  return `Day target ${formatAmount(p.targetAmount)} · collected ${formatAmount(p.collectedAmount)} · ` +
    `remaining to target ${formatAmount(p.remainingToTarget)} · visits ${num(p.visitsDone)}/${num(p.visitsPlanned)} ` +
    `(${num(p.visitsRemaining)} remaining) · ${str(p.statusLabel) || 'Not started'}`;
}

// The day view strip, rendered from one progress object. Amounts
// are formatted here, never recomputed, so the strip cannot drift
// from the progress object the tests pin.
export function dayTargetHtml(progress = {}) {
  const p = progress && typeof progress === 'object' ? progress : {};
  const targetNote = p.targetSet
    ? 'Operator-set day target.'
    : 'No operator target set — showing the route total dues as the target.';
  const collectedNote = p.collectedSource === 'cash' && p.routeCollectedAmount !== undefined
    && num(p.routeCollectedAmount) !== num(p.collectedAmount)
    ? 'Cash receipts recorded for the day; route collected may differ (see day-flow note).'
    : 'Collected on this route view.';
  return `<div class="day-target-strip" role="region" aria-label="Field day target and progress">` +
    `<div><strong>🎯 Day target:</strong> ${escapeHtml(formatAmount(p.targetAmount))}</div>` +
    `<div><strong>Collected:</strong> ${escapeHtml(formatAmount(p.collectedAmount))}</div>` +
    `<div><strong>Remaining to target:</strong> ${escapeHtml(formatAmount(p.remainingToTarget))}</div>` +
    `<div><strong>Visits:</strong> ${num(p.visitsDone)}/${num(p.visitsPlanned)} done, ` +
    `${num(p.visitsRemaining)} remaining (${num(p.visitCompletionRate)}%)</div>` +
    `<div class="day-target-progress-track"><div class="day-target-progress-fill" style="width: ${num(p.amountProgressPct)}%;"></div></div>` +
    `<div><strong>Status:</strong> ${escapeHtml(str(p.statusLabel) || 'Not started')}</div>` +
    `<div class="day-target-note">${escapeHtml(targetNote)} ${escapeHtml(collectedNote)}</div>` +
    `</div>`;
}
