// Plan 445 — Quick Collect daily target progress bar: while
// collecting, the operator cannot see how close the day is to its
// target, so the day ends short without anyone noticing it was
// short until settlement. One progress bar on the Quick Collect
// screen — today's collected total against today's target, in plain
// words and figures. It shows progress only and it sets no target.
//
// What already exists, and what this plan does NOT rebuild: the
// field day target itself already exists (the operator-set amount
// for one date, stored date-indexed), and the day's collected total
// already exists (today's recorded payments on this device). This
// module adds only the missing piece: the progress view that puts
// those two figures together — collected, target, percentage, and
// what is left to go. A day with no target shows the collected
// total without a bar, never a bar against an invented target.
// The bar never changes any bill, payment, target, or customer
// record by itself: it reads two figures and renders them, and it
// holds no store of its own. Pure: the caller supplies the
// collected total and the target amount, and the module never
// reads storage, the clock, or the network, and never mutates an
// input.
//
// Target rule: only a positive finite amount counts as a target.
// Zero, negative, missing, or unusable target figures mean no
// target is set, never a target of zero that would read as reached
// the moment a rupee is collected. Progress is capped at 100, so
// collecting past the target fills the bar without overflowing it.

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

// PKR in the plan modules' own shape: min-0 decimals, never more
// than two (PKR 3,000 · PKR 1,500.5). A null/undefined/empty/boolean
// figure is "not a number", never zero — a missing amount must never
// be printed as PKR 0.
export function formatDailyTargetProgressAmount(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return 'Not set';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Not set';
  const formatter = new Intl.NumberFormat('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `PKR ${formatter.format(amount)}`;
}

// Normalises a day-target amount the same way the field day target
// does: a positive finite number is kept (rounded to whole rupees,
// as the app formats money); anything else — zero, negative, NaN,
// text — is unset, never coerced into a target of 0.
export function normalizeDailyTargetProgressTarget(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * Whether the value is a usable collected figure. A null,
 * undefined, empty, boolean, or non-numeric value is "not a
 * number", never zero — a missing figure must never be read as a
 * taking of nothing recorded.
 */
function isUsableCollectedFigure(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return false;
  return Number.isFinite(Number(value));
}

/**
 * Today's collected total against today's target, as one progress
 * view. Only finite collected figures count toward the total, so a
 * missing collected figure never counts as a taking — the total
 * starts at zero and only recorded payments move it. Pure: the
 * caller supplies both figures, and the module never reads
 * storage, the clock, or the network, and never mutates an input.
 */
export function dailyTargetProgress(collectedTotal, targetAmount) {
  const collected = isUsableCollectedFigure(collectedTotal) ? num(collectedTotal) : 0;
  const target = normalizeDailyTargetProgressTarget(targetAmount);
  const targetSet = target !== null;
  const targetValue = targetSet ? target : 0;
  const progressPct = targetSet
    ? Math.min(100, Math.round((collected / targetValue) * 100))
    : 0;
  const remaining = targetSet ? Math.max(targetValue - collected, 0) : 0;
  const overTarget = targetSet ? Math.max(collected - targetValue, 0) : 0;
  return {
    collected,
    target: targetValue,
    targetSet,
    progressPct,
    remaining,
    overTarget,
    targetReached: targetSet && collected >= targetValue,
  };
}

/**
 * "Day target PKR 50,000 · collected PKR 12,000 · PKR 38,000 to go
 * (24%)" when a target is set, or "Today collected: PKR 12,000 ·
 * no day target set" when none is — said plainly, never hidden
 * behind a blank. Plain English, like the other live lines on that
 * screen.
 */
export function dailyTargetProgressText(progress) {
  const p = progress && typeof progress === 'object' ? progress : {};
  const collected = formatDailyTargetProgressAmount(num(p.collected));
  if (!p.targetSet) return `Today collected: ${collected} · no day target set`;
  const target = formatDailyTargetProgressAmount(num(p.target));
  if (p.targetReached) {
    return `Day target ${target} · collected ${collected} · target reached (${num(p.progressPct)}%)`;
  }
  return `Day target ${target} · collected ${collected} · ` +
    `${formatDailyTargetProgressAmount(num(p.remaining))} to go (${num(p.progressPct)}%)`;
}

// The progress bar, rendered from one progress object. Amounts are
// formatted here, never recomputed, so the bar cannot drift from
// the progress object the tests pin. With no target set there is
// no bar at all — only the collected total line — so the screen
// never shows progress against a target nobody set. The bar track
// and fill reuse the route progress classes, so no new bar styling
// is introduced here.
export function dailyTargetProgressHtml(progress) {
  const p = progress && typeof progress === 'object' ? progress : {};
  const line = `<p class="dtp-line">${escapeHtml(dailyTargetProgressText(p))}</p>`;
  if (!p.targetSet) {
    return `<div class="dtp-daily-target-progress" role="region" aria-label="Daily target progress">${line}</div>`;
  }
  return `<div class="dtp-daily-target-progress" role="region" aria-label="Daily target progress">${line}` +
    `<div class="route-progress-track"><div class="route-progress-fill" style="width: ${num(p.progressPct)}%;"></div></div>` +
    `</div>`;
}
