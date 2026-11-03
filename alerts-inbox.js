// Plan 8 (Plan 1-100) — Owner alerts inbox.
//
// READ-ONLY. This module builds a list of threshold alerts from figures
// the caller already has — long-overdue Waada promises, long-unclaimed
// suspense items, and large single outstanding balances — so the
// biggest risks are seen first instead of being found by browsing.
//
// It changes nothing: no record is created, edited, or cleared by an
// alert, no message is sent, and no automatic action is taken. An
// alert only names the item, the threshold it crossed, and the
// existing screen that already handles that item. "Clearing" an alert
// is a UI-only act (the caller keeps the cleared ids); the underlying
// record is untouched, and cleared alerts can be restored.
//
// This is deliberately NOT Plan 56 (at-risk signals): Plan 56 is about
// predicting which customers may go bad; this inbox is about thresholds
// already crossed on existing records. The two share the idea of one
// visible thresholds store, not one engine — the thresholds here are
// the inbox's own, visible and editable in one place.
//
// The module is import-free by design (like owner-digest.js and
// receivables-ageing.js), so it can be used without pulling in the
// app graph. The caller supplies the items and the thresholds; the
// module never reads a record, never reads the clock, and never
// mutates its inputs.
//
// Input item shapes:
//   waadaItems:      { customerId, customerName, promiseDate, amount }
//   suspenseItems:   { suspenseId, amount, ageDays }
//   outstandingItems:{ customerId, customerName, amount }
// Thresholds: { waadaOverdueDays, suspenseUnclaimedDays,
//               largeOutstandingAmount } — all caller-editable, all
// normalised here (invalid values fall back to the defaults, never
// to a zero threshold that would alert on everything).

export const ALERT_TYPES = Object.freeze({
  WAADA_OVERDUE: 'waada_overdue',
  SUSPENSE_UNCLAIMED: 'suspense_unclaimed',
  LARGE_OUTSTANDING: 'large_outstanding',
});

export const ALERT_SEVERITIES = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
});

export const DEFAULT_ALERT_THRESHOLDS = Object.freeze({
  waadaOverdueDays: 7,
  suspenseUnclaimedDays: 30,
  largeOutstandingAmount: 10000,
});

// Action screens are real destinations, not invented ones: there is no
// standalone Waada-queue view route in the app — Waada promises live
// on customer profiles (reached from the Customers view, as do Top
// Defaulters) — while the Suspense register is a real modal.
export const ALERT_ACTION_SCREENS = Object.freeze({
  [ALERT_TYPES.WAADA_OVERDUE]: 'Customer profile (Waada promise)',
  [ALERT_TYPES.SUSPENSE_UNCLAIMED]: 'Suspense register',
  [ALERT_TYPES.LARGE_OUTSTANDING]: 'Customers (Top Defaulters)',
});

const HIGH_WAADA_DAYS = 15;
const HIGH_SUSPENSE_DAYS = 90;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Strict YYYY-MM-DD calendar-date check (no timezones, no rollover:
// 2026-02-30 is not a date, and neither is 2026-13-01).
export function isValidAlertDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const built = new Date(Date.UTC(year, month - 1, day));
  return (
    built.getUTCFullYear() === year &&
    built.getUTCMonth() === month - 1 &&
    built.getUTCDate() === day
  );
}

function alertDateParts(dateStr) {
  if (!isValidAlertDate(dateStr)) return null;
  const [year, month, day] = dateStr.trim().split('-').map(Number);
  return { year, month, day };
}

// Whole UTC calendar days between two valid dates (later minus
// earlier); null when either date is invalid.
function alertDaysBetween(earlierStr, laterStr) {
  const earlier = alertDateParts(earlierStr);
  const later = alertDateParts(laterStr);
  if (!earlier || !later) return null;
  const earlierMs = Date.UTC(earlier.year, earlier.month - 1, earlier.day);
  const laterMs = Date.UTC(later.year, later.month - 1, later.day);
  return Math.round((laterMs - earlierMs) / 86400000);
}

// Whole days a promise is overdue as of today: 0 when due today or
// in the future, null for an invalid promiseDate.
export function alertWaadaOverdueDays(promiseDate, today) {
  const days = alertDaysBetween(promiseDate, today);
  if (days === null) return null;
  return Math.max(0, days);
}

// Normalise operator thresholds. A missing, non-numeric, fractional
// (for day counts), or non-positive value falls back to the default
// for that threshold — a zero or negative threshold would alert on
// every record, so it is never accepted. Returns a fresh object.
export function normalizeAlertThresholds(input) {
  const source = isPlainObject(input) ? input : {};
  const days = (value, fallback) => {
    const n = asFiniteNumber(value);
    if (n === null || n < 1) return fallback;
    return Math.max(1, Math.floor(n));
  };
  const amount = (value, fallback) => {
    const n = asFiniteNumber(value);
    if (n === null || n <= 0) return fallback;
    return Math.max(1, Math.round(n));
  };
  return {
    waadaOverdueDays: days(source.waadaOverdueDays, DEFAULT_ALERT_THRESHOLDS.waadaOverdueDays),
    suspenseUnclaimedDays: days(source.suspenseUnclaimedDays, DEFAULT_ALERT_THRESHOLDS.suspenseUnclaimedDays),
    largeOutstandingAmount: amount(source.largeOutstandingAmount, DEFAULT_ALERT_THRESHOLDS.largeOutstandingAmount),
  };
}

function asText(value, fallback = '—') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function asPositiveAmount(value) {
  const n = asFiniteNumber(value);
  if (n === null || n <= 0) return null;
  return Math.round(n);
}

function escapeAlertHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAlertAmount(amount) {
  return `Rs. ${amount.toLocaleString('en-PK')}`;
}

function severityRank(severity) {
  return severity === ALERT_SEVERITIES.HIGH ? 0 : 1;
}

function compareAlerts(a, b) {
  if (severityRank(a.severity) !== severityRank(b.severity)) {
    return severityRank(a.severity) - severityRank(b.severity);
  }
  if (b.metricValue !== a.metricValue) return b.metricValue - a.metricValue;
  const nameCmp = a.title.localeCompare(b.title);
  if (nameCmp !== 0) return nameCmp;
  return a.id.localeCompare(b.id);
}

// Build the inbox. `clearedIds` is the caller's UI-only set of alert
// ids the operator has cleared; cleared alerts are reported in
// `cleared`, not dropped silently, so the UI can offer to restore
// them. Inputs are never mutated.
export function buildAlertsInbox({
  today,
  thresholds,
  waadaItems,
  suspenseItems,
  outstandingItems,
  clearedIds,
} = {}) {
  const normalizedThresholds = normalizeAlertThresholds(thresholds);
  if (!isValidAlertDate(today)) {
    return {
      valid: false,
      reason: 'invalid-today',
      today: typeof today === 'string' ? today : '',
      thresholds: normalizedThresholds,
      alerts: [],
      cleared: [],
      summary: { total: 0, high: 0, medium: 0, clearedCount: 0, byType: {} },
    };
  }
  const clearedSet = new Set(
    Array.isArray(clearedIds) ? clearedIds.filter((id) => typeof id === 'string') : [],
  );
  const all = [];

  for (const item of Array.isArray(waadaItems) ? waadaItems : []) {
    if (!isPlainObject(item)) continue;
    const daysOverdue = alertWaadaOverdueDays(item.promiseDate, today);
    if (daysOverdue === null || daysOverdue < normalizedThresholds.waadaOverdueDays) continue;
    const amount = asPositiveAmount(item.amount);
    all.push({
      id: `waada:${asText(item.customerId, 'unknown')}`,
      type: ALERT_TYPES.WAADA_OVERDUE,
      severity: daysOverdue >= HIGH_WAADA_DAYS ? ALERT_SEVERITIES.HIGH : ALERT_SEVERITIES.MEDIUM,
      title: asText(item.customerName),
      detail:
        `Waada promise dated ${String(item.promiseDate).trim()} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue` +
        (amount !== null ? ` · ${formatAlertAmount(amount)} promised` : ''),
      thresholdText: `Threshold: Waada overdue ${normalizedThresholds.waadaOverdueDays} days or more`,
      actionScreen: ALERT_ACTION_SCREENS[ALERT_TYPES.WAADA_OVERDUE],
      metricLabel: 'days overdue',
      metricValue: daysOverdue,
    });
  }

  for (const item of Array.isArray(suspenseItems) ? suspenseItems : []) {
    if (!isPlainObject(item)) continue;
    const ageDays = asFiniteNumber(item.ageDays);
    if (ageDays === null || Math.floor(ageDays) < normalizedThresholds.suspenseUnclaimedDays) continue;
    const amount = asPositiveAmount(item.amount);
    const age = Math.floor(ageDays);
    all.push({
      id: `suspense:${asText(item.suspenseId, 'unknown')}`,
      type: ALERT_TYPES.SUSPENSE_UNCLAIMED,
      severity: age >= HIGH_SUSPENSE_DAYS ? ALERT_SEVERITIES.HIGH : ALERT_SEVERITIES.MEDIUM,
      title: `Suspense ${asText(item.suspenseId, 'unknown')}`,
      detail:
        `Unclaimed for ${age} day${age === 1 ? '' : 's'}` +
        (amount !== null ? ` · ${formatAlertAmount(amount)} unclaimed` : ''),
      thresholdText: `Threshold: suspense unclaimed ${normalizedThresholds.suspenseUnclaimedDays} days or more`,
      actionScreen: ALERT_ACTION_SCREENS[ALERT_TYPES.SUSPENSE_UNCLAIMED],
      metricLabel: 'days unclaimed',
      metricValue: age,
    });
  }

  for (const item of Array.isArray(outstandingItems) ? outstandingItems : []) {
    if (!isPlainObject(item)) continue;
    const amount = asPositiveAmount(item.amount);
    if (amount === null || amount < normalizedThresholds.largeOutstandingAmount) continue;
    all.push({
      id: `outstanding:${asText(item.customerId, 'unknown')}`,
      type: ALERT_TYPES.LARGE_OUTSTANDING,
      severity: amount >= 2 * normalizedThresholds.largeOutstandingAmount ? ALERT_SEVERITIES.HIGH : ALERT_SEVERITIES.MEDIUM,
      title: asText(item.customerName),
      detail: `${formatAlertAmount(amount)} outstanding in a single balance`,
      thresholdText: `Threshold: single outstanding ${formatAlertAmount(normalizedThresholds.largeOutstandingAmount)} or more`,
      actionScreen: ALERT_ACTION_SCREENS[ALERT_TYPES.LARGE_OUTSTANDING],
      metricLabel: 'outstanding',
      metricValue: amount,
    });
  }

  all.sort(compareAlerts);
  const alerts = [];
  const cleared = [];
  for (const alert of all) {
    if (clearedSet.has(alert.id)) cleared.push(alert);
    else alerts.push(alert);
  }
  const byType = {};
  for (const alert of alerts) byType[alert.type] = (byType[alert.type] || 0) + 1;
  return {
    valid: true,
    reason: null,
    today,
    thresholds: normalizedThresholds,
    alerts,
    cleared,
    summary: {
      total: alerts.length,
      high: alerts.filter((a) => a.severity === ALERT_SEVERITIES.HIGH).length,
      medium: alerts.filter((a) => a.severity === ALERT_SEVERITIES.MEDIUM).length,
      clearedCount: cleared.length,
      byType,
    },
  };
}

export function alertsInboxSummaryText(view) {
  if (!view || !view.valid) return 'Alerts unavailable';
  if (view.summary.total === 0) {
    return view.summary.clearedCount > 0
      ? `No open alerts · ${view.summary.clearedCount} cleared`
      : 'No open alerts';
  }
  const highPart = view.summary.high > 0 ? ` · ${view.summary.high} high` : '';
  const clearedPart = view.summary.clearedCount > 0 ? ` · ${view.summary.clearedCount} cleared` : '';
  return `${view.summary.total} alert${view.summary.total === 1 ? '' : 's'}${highPart}${clearedPart}`;
}

export function alertsInboxHtml(view) {
  if (!view || !view.valid) {
    return '<p class="empty-state">Alerts unavailable — the inbox needs a valid today date.</p>';
  }
  if (view.alerts.length === 0) {
    return '<p class="empty-state">No open alerts at the current thresholds. Clearing an alert never clears its record — use Restore cleared to bring cleared alerts back.</p>';
  }
  const rows = view.alerts.map((alert) => {
    const badge = alert.severity === ALERT_SEVERITIES.HIGH ? '🔴 High' : '🟡 Medium';
    return `<li class="alerts-inbox-row" data-alert-type="${escapeAlertHtml(alert.type)}">` +
      `<div><strong>${escapeAlertHtml(alert.title)}</strong> <span>${escapeAlertHtml(badge)}</span></div>` +
      `<div>${escapeAlertHtml(alert.detail)}</div>` +
      `<div>${escapeAlertHtml(alert.thresholdText)} · Action screen: ${escapeAlertHtml(alert.actionScreen)}</div>` +
      `<div><button type="button" class="secondary-button btn-sm alerts-inbox-action-btn" data-alert-action="${escapeAlertHtml(alert.type)}" data-alert-id="${escapeAlertHtml(alert.id)}">Open ${escapeAlertHtml(alert.actionScreen)}</button> ` +
      `<button type="button" class="secondary-button btn-sm alerts-inbox-clear-btn" data-alert-id="${escapeAlertHtml(alert.id)}">Clear alert</button></div>` +
      `</li>`;
  }).join('');
  return `<p>${escapeAlertHtml(alertsInboxSummaryText(view))} — highest risk first. An alert changes nothing by itself; open its action screen to act.</p><ul class="alerts-inbox-list">${rows}</ul>`;
}
