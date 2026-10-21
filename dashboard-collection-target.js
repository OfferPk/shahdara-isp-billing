/**
 * dashboard-collection-target.js
 * Monthly Collection vs Target Analytics & Run-Rate Forecasting Suite.
 *
 * Implements:
 * - Persistent target configuration per calendar month stored under `shahdara_collection_targets`.
 * - Real-time collection tracking against monthly target (collected vs remaining).
 * - Required daily run-rate for remaining days to hit target.
 * - Current daily pace & projected month-end collection.
 * - Historical past months target achievement (Hit vs Missed) & variance ledger.
 * - Pure-vector SVG visualizer (`renderCollectionTargetGaugeSvg`).
 * - Formal A4 & 80mm thermal POS printable performance slips.
 * - Bilingual Urdu & English WhatsApp technician/owner summary.
 * - RFC-4180 compliant CSV export with UTF-8 BOM.
 */


import {
  buildMonthlyClosingSnapshot,
  monthsForHistory
} from './core.js';

export function monthKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  return `${y}-${m}`;
}

export function currentDayInPKT(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 1;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    day: 'numeric'
  }).formatToParts(d);
  return Number(parts.find(p => p.type === 'day')?.value || 1);
}

export function formatAmount(value) {
  if (value === null || value === undefined || value === '') return '0';
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function monthName(month) {
  if (!month) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${month}-01T00:00:00Z`));
  } catch {
    return String(month);
  }
}

export const COLLECTION_TARGETS_STORAGE_KEY = 'shahdara_collection_targets';

/**
 * Retrieves all saved collection targets from storage.
 * @param {Storage} [storage=localStorage]
 * @returns {Record<string, number>}
 */
export function getCollectionTargets(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(COLLECTION_TARGETS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const sanitized = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(key) && Number.isFinite(Number(val)) && Number(val) > 0) {
          sanitized[key] = Math.round(Number(val));
        }
      }
      return sanitized;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Retrieves the target amount for a specific month.
 * @param {string} month - e.g. "2026-10"
 * @param {Storage} [storage=localStorage]
 * @returns {number|null}
 */
export function getCollectionTarget(month, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const targets = getCollectionTargets(storage);
  return targets[month] ?? null;
}

/**
 * Saves a collection target for a specific month.
 * @param {string} month - e.g. "2026-10"
 * @param {number} amount - positive number
 * @param {Storage} [storage=localStorage]
 * @returns {Record<string, number>}
 */
export function setCollectionTarget(month, amount, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month ?? ''))) {
    throw new Error('Invalid month format. Expected YYYY-MM.');
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Target amount must be a positive numeric value in PKR.');
  }
  const targets = getCollectionTargets(storage);
  targets[month] = Math.round(numericAmount);
  if (storage) {
    storage.setItem(COLLECTION_TARGETS_STORAGE_KEY, JSON.stringify(targets));
  }
  return targets;
}

/**
 * Removes a collection target for a specific month.
 * @param {string} month
 * @param {Storage} [storage=localStorage]
 * @returns {Record<string, number>}
 */
export function removeCollectionTarget(month, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const targets = getCollectionTargets(storage);
  delete targets[month];
  if (storage) {
    storage.setItem(COLLECTION_TARGETS_STORAGE_KEY, JSON.stringify(targets));
  }
  return targets;
}

/**
 * Clears all saved collection targets.
 * @param {Storage} [storage=localStorage]
 */
export function clearCollectionTargets(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (storage) {
    storage.removeItem(COLLECTION_TARGETS_STORAGE_KEY);
  }
}

/**
 * Calculates calendar day metrics for a given month.
 * @param {string} month - YYYY-MM
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ daysInMonth: number, currentDay: number, daysRemaining: number, isCurrentMonth: boolean, isPastMonth: boolean, isFutureMonth: boolean }}
 */
export function calculateMonthDaysMetrics(month, referenceDate = new Date()) {
  const [yearNum, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();

  const currentMonthStr = monthKey(referenceDate);
  const isCurrentMonth = month === currentMonthStr;
  const isPastMonth = month < currentMonthStr;
  const isFutureMonth = month > currentMonthStr;

  let currentDay = 0;
  if (isCurrentMonth) {
    currentDay = Math.max(1, Math.min(referenceDate.getDate(), daysInMonth));
  } else if (isPastMonth) {
    currentDay = daysInMonth;
  } else {
    currentDay = 0;
  }

  const daysRemaining = Math.max(0, daysInMonth - currentDay);

  return {
    daysInMonth,
    currentDay,
    daysRemaining,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth
  };
}

/**
 * Computes complete Monthly Collection vs Target analysis for a selected month.
 * @param {Object} state - Application state
 * @param {string} [month] - YYYY-MM, defaults to current month
 * @param {Object} [options]
 * @param {number} [options.target] - Override target amount
 * @param {Date} [options.referenceDate] - Date context
 * @param {Storage} [options.storage] - Storage context
 * @returns {Object} Target metrics
 */
export function calculateCollectionTargetMetrics(state, month = null, options = {}) {
  const referenceDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();
  const selectedMonth = month || monthKey(referenceDate);
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);

  const daysInfo = calculateMonthDaysMetrics(selectedMonth, referenceDate);
  const closing = buildMonthlyClosingSnapshot(state, selectedMonth, referenceDate);

  const collected = Number(closing.collection) || 0;
  const billedAmount = Number(closing.billedAmount) || 0;

  const targetAmount = options.target !== undefined
    ? (options.target !== null ? Math.round(Number(options.target)) : null)
    : getCollectionTarget(selectedMonth, storage);

  const hasTarget = targetAmount !== null && targetAmount > 0;
  const target = hasTarget ? targetAmount : null;

  if (!hasTarget) {
    return {
      month: selectedMonth,
      monthLabel: monthName(selectedMonth),
      hasTarget: false,
      target: null,
      collected,
      billedAmount,
      remaining: null,
      progressPercent: null,
      isHit: false,
      surplusDeficit: null,
      requiredDailyRunRate: null,
      actualDailyRunRate: daysInfo.currentDay > 0 ? Math.round(collected / daysInfo.currentDay) : 0,
      projectedMonthEnd: null,
      projectedVariance: null,
      projectedStatus: 'NO_TARGET',
      statusBadge: 'No Target Set',
      expectedPacePercent: Number(((daysInfo.currentDay / daysInfo.daysInMonth) * 100).toFixed(1)),
      paceDeltaPercent: null,
      ...daysInfo
    };
  }

  const remaining = Math.max(0, target - collected);
  const progressPercent = Number(((collected / target) * 100).toFixed(1));
  const isHit = collected >= target;
  const surplusDeficit = collected - target;

  let requiredDailyRunRate = 0;
  let actualDailyRunRate = 0;
  let projectedMonthEnd = collected;
  let projectedVariance = surplusDeficit;
  let projectedStatus = 'NO_TARGET';
  let statusBadge = 'No Target';

  const expectedPacePercent = Number(((daysInfo.currentDay / daysInfo.daysInMonth) * 100).toFixed(1));
  const paceDeltaPercent = Number((progressPercent - expectedPacePercent).toFixed(1));

  if (daysInfo.isCurrentMonth) {
    actualDailyRunRate = daysInfo.currentDay > 0 ? Math.round(collected / daysInfo.currentDay) : 0;
    requiredDailyRunRate = daysInfo.daysRemaining > 0 ? Math.ceil(remaining / daysInfo.daysRemaining) : remaining;
    projectedMonthEnd = Math.round(collected + (actualDailyRunRate * daysInfo.daysRemaining));
    projectedVariance = projectedMonthEnd - target;

    if (isHit) {
      projectedStatus = 'TARGET_ACHIEVED';
      statusBadge = 'Target Reached (Hit!)';
    } else if (projectedMonthEnd >= target) {
      projectedStatus = 'ON_TRACK';
      statusBadge = `On Track (+${paceDeltaPercent}% Pace)`;
    } else {
      projectedStatus = 'AT_RISK';
      statusBadge = `At Risk (${paceDeltaPercent}% Pace)`;
    }
  } else if (daysInfo.isPastMonth) {
    actualDailyRunRate = Math.round(collected / daysInfo.daysInMonth);
    requiredDailyRunRate = 0;
    projectedMonthEnd = collected;
    projectedVariance = surplusDeficit;
    projectedStatus = isHit ? 'TARGET_HIT' : 'TARGET_MISSED';
    statusBadge = isHit ? 'Target Hit' : 'Target Missed';
  } else {
    // Future month
    actualDailyRunRate = 0;
    requiredDailyRunRate = Math.ceil(target / daysInfo.daysInMonth);
    projectedMonthEnd = 0;
    projectedVariance = -target;
    projectedStatus = 'PLANNED';
    statusBadge = 'Planned';
  }

  return {
    month: selectedMonth,
    monthLabel: monthName(selectedMonth),
    hasTarget: true,
    target,
    collected,
    billedAmount,
    remaining,
    progressPercent,
    isHit,
    surplusDeficit,
    requiredDailyRunRate,
    actualDailyRunRate,
    projectedMonthEnd,
    projectedVariance,
    projectedStatus,
    statusBadge,
    expectedPacePercent,
    paceDeltaPercent,
    ...daysInfo
  };
}

/**
 * Calculates multi-month target hit/miss history.
 * @param {Object} state
 * @param {Object} [options]
 * @param {number} [options.monthsCount=12]
 * @param {Date} [options.referenceDate]
 * @param {Storage} [options.storage]
 * @returns {{ rows: Array<Object>, summary: Object }}
 */
export function calculateCollectionTargetHistory(state, options = {}) {
  const referenceDate = options.referenceDate instanceof Date ? options.referenceDate : new Date();
  const count = options.monthsCount ?? 12;
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const months = monthsForHistory(referenceDate).slice(0, count);

  const rows = [];
  let targetedMonthsCount = 0;
  let targetHitCount = 0;
  let targetMissCount = 0;
  let totalTargetedPkr = 0;
  let totalCollectedPkr = 0;

  for (const m of months) {
    const metrics = calculateCollectionTargetMetrics(state, m, { referenceDate, storage });
    rows.push(metrics);

    if (metrics.hasTarget) {
      targetedMonthsCount++;
      totalTargetedPkr += metrics.target;
      totalCollectedPkr += metrics.collected;
      if (metrics.isHit) {
        targetHitCount++;
      } else if (metrics.isPastMonth) {
        targetMissCount++;
      }
    }
  }

  const netVariancePkr = totalCollectedPkr - totalTargetedPkr;
  const hitRatePercent = targetedMonthsCount > 0 ? Math.round((targetHitCount / targetedMonthsCount) * 100) : null;
  const overallAchievementPercent = totalTargetedPkr > 0 ? Math.round((totalCollectedPkr / totalTargetedPkr) * 100) : null;

  return {
    rows,
    summary: {
      totalMonths: rows.length,
      targetedMonthsCount,
      targetHitCount,
      targetMissCount,
      hitRatePercent,
      totalTargetedPkr,
      totalCollectedPkr,
      netVariancePkr,
      overallAchievementPercent
    }
  };
}

/**
 * Renders a pure-vector SVG target radial gauge and pace indicator.
 * @param {Object} metrics - Target metrics
 * @returns {string} SVG markup
 */
export function renderCollectionTargetGaugeSvg(metrics) {
  const width = 420;
  const height = 250;
  const cx = 210;
  const cy = 180;
  const r = 130;
  const strokeWidth = 20;

  if (!metrics || !metrics.hasTarget) {
    return `
      <svg class="target-gauge-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Target not set">
        <rect width="${width}" height="${height}" rx="12" fill="var(--card-bg, #ffffff)" />
        <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="var(--border-color, #e2e8f0)" stroke-width="${strokeWidth}" stroke-linecap="round" />
        <text x="${cx}" y="${cy - 30}" text-anchor="middle" font-size="14" font-weight="600" fill="var(--text-muted, #64748b)">No Collection Target Set</text>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="12" fill="var(--text-muted, #94a3b8)">Set an owner monthly target to enable pace & run-rate tracking</text>
        <text x="${cx}" y="${cy + 36}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text-color, #1e293b)">Actual Collected: PKR ${formatAmount(metrics?.collected ?? 0)}</text>
      </svg>
    `;
  }

  const progress = Math.max(0, Math.min(150, metrics.progressPercent || 0));
  const progressRatio = Math.min(1.0, progress / 100);

  // Angle calculations for 180 degree semi-circle: from 180 deg (PI) to 0 deg (0)
  // angle in radians = PI - (progressRatio * PI)
  const sweepAngle = progressRatio * Math.PI;
  const startX = cx - r;
  const startY = cy;
  const endX = cx - r * Math.cos(sweepAngle);
  const endY = cy - r * Math.sin(sweepAngle);
  const largeArcFlag = sweepAngle > Math.PI ? 1 : 0;

  // Expected pace angle
  const paceRatio = Math.max(0, Math.min(1.0, (metrics.expectedPacePercent || 0) / 100));
  const paceAngle = paceRatio * Math.PI;
  const paceX = cx - (r - 2) * Math.cos(paceAngle);
  const paceY = cy - (r - 2) * Math.sin(paceAngle);
  const paceOuterX = cx - (r + strokeWidth + 6) * Math.cos(paceAngle);
  const paceOuterY = cy - (r + strokeWidth + 6) * Math.sin(paceAngle);

  // Status coloration
  let strokeColor = '#0284c7'; // Cyan/sky for on-track
  let badgeBg = '#e0f2fe';
  let badgeColor = '#0369a1';

  if (metrics.isHit) {
    strokeColor = '#10b981'; // Emerald
    badgeBg = '#d1fae5';
    badgeColor = '#065f46';
  } else if (metrics.projectedStatus === 'AT_RISK') {
    strokeColor = '#f59e0b'; // Amber
    badgeBg = '#fef3c7';
    badgeColor = '#92400e';
  }

  const arcPath = progress > 0
    ? `M ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY}`
    : '';

  return `
    <svg class="target-gauge-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Collection target progress: ${metrics.progressPercent}%">
      <defs>
        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.8" />
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="1" />
        </linearGradient>
      </defs>

      <!-- Background card -->
      <rect width="${width}" height="${height}" rx="12" fill="var(--card-bg, #ffffff)" />

      <!-- Background Track -->
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="var(--border-color, #e2e8f0)" stroke-width="${strokeWidth}" stroke-linecap="round" />

      <!-- Progress Arc -->
      ${arcPath ? `<path d="${arcPath}" fill="none" stroke="url(#gaugeGradient)" stroke-width="${strokeWidth}" stroke-linecap="round" />` : ''}

      <!-- Target Marker at 100% -->
      <line x1="${cx + r - 6}" y1="${cy - 12}" x2="${cx + r + 6}" y2="${cy + 12}" stroke="#64748b" stroke-width="2.5" />
      <text x="${cx + r + 14}" y="${cy + 4}" font-size="10" font-weight="700" fill="var(--text-muted, #64748b)">100%</text>

      <!-- Today's Expected Pace Indicator -->
      ${metrics.isCurrentMonth ? `
        <line x1="${paceX}" y1="${paceY}" x2="${paceOuterX}" y2="${paceOuterY}" stroke="#dc2626" stroke-width="3" stroke-linecap="round" />
        <circle cx="${paceOuterX}" cy="${paceOuterY}" r="3" fill="#dc2626" />
        <text x="${cx}" y="28" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-muted, #64748b)">Day ${metrics.currentDay} of ${metrics.daysInMonth} (${metrics.daysRemaining} days remaining)</text>
      ` : `
        <text x="${cx}" y="28" text-anchor="middle" font-size="11" font-weight="600" fill="var(--text-muted, #64748b)">${metrics.monthLabel} (${metrics.daysInMonth} days total)</text>
      `}

      <!-- Center Typography -->
      <text x="${cx}" y="${cy - 52}" text-anchor="middle" font-size="32" font-weight="800" fill="${strokeColor}">${metrics.progressPercent}%</text>
      <text x="${cx}" y="${cy - 24}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text-color, #0f172a)">
        PKR ${formatAmount(metrics.collected)} <tspan font-size="12" font-weight="500" fill="var(--text-muted, #64748b)">/ PKR ${formatAmount(metrics.target)}</tspan>
      </text>

      <!-- Status Pill -->
      <rect x="${cx - 85}" y="${cy - 10}" width="170" height="22" rx="11" fill="${badgeBg}" />
      <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="11" font-weight="700" fill="${badgeColor}">${metrics.statusBadge}</text>

      <!-- Bottom Mini Telemetry Grid -->
      <g transform="translate(15, 205)">
        <rect x="0" y="0" width="92" height="36" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--border-color, #e2e8f0)" stroke-width="1" />
        <text x="46" y="14" text-anchor="middle" font-size="9" font-weight="600" fill="var(--text-muted, #64748b)">REQUIRED RUN-RATE</text>
        <text x="46" y="28" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-color, #0f172a)">PKR ${formatAmount(metrics.requiredDailyRunRate)}/d</text>

        <rect x="100" y="0" width="92" height="36" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--border-color, #e2e8f0)" stroke-width="1" />
        <text x="146" y="14" text-anchor="middle" font-size="9" font-weight="600" fill="var(--text-muted, #64748b)">CURRENT PACE</text>
        <text x="146" y="28" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-color, #0f172a)">PKR ${formatAmount(metrics.actualDailyRunRate)}/d</text>

        <rect x="200" y="0" width="92" height="36" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--border-color, #e2e8f0)" stroke-width="1" />
        <text x="246" y="14" text-anchor="middle" font-size="9" font-weight="600" fill="var(--text-muted, #64748b)">PROJECTED END</text>
        <text x="246" y="28" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-color, #0f172a)">PKR ${formatAmount(metrics.projectedMonthEnd)}</text>

        <rect x="300" y="0" width="90" height="36" rx="6" fill="var(--bg-subtle, #f8fafc)" stroke="var(--border-color, #e2e8f0)" stroke-width="1" />
        <text x="345" y="14" text-anchor="middle" font-size="9" font-weight="600" fill="var(--text-muted, #64748b)">REMAINING</text>
        <text x="345" y="28" text-anchor="middle" font-size="10" font-weight="700" fill="${metrics.remaining > 0 ? '#ea580c' : '#10b981'}">PKR ${formatAmount(metrics.remaining)}</text>
      </g>
    </svg>
  `;
}

/**
 * Formats a bilingual Urdu & English WhatsApp summary for the owner / team.
 * @param {Object} metrics
 * @param {Object} [history]
 * @returns {string} WhatsApp message text
 */
export function formatCollectionTargetWhatsApp(metrics, history = null) {
  const lines = [
    `🎯 *SHAHDARA ISP — MONTHLY COLLECTION TARGET REPORT*`,
    `📅 *Month:* ${metrics.monthLabel}`,
    `━━━━━━━━━━━━━━━━━━━━`
  ];

  if (!metrics.hasTarget) {
    lines.push(`⚠️ *Status:* No target set for this month.`);
    lines.push(`💰 *Actual Collected Cash:* PKR ${formatAmount(metrics.collected)}`);
    lines.push(`📋 *Billed Volume:* PKR ${formatAmount(metrics.billedAmount)}`);
    lines.push(`\n🇵🇰 *ہدایت:* ماہانہ وصولی کے ہدف کا تعین کریں تاکہ روزانہ کا رن ریٹ معلوم ہو سکے۔`);
    return lines.join('\n');
  }

  lines.push(`🎯 Monthly Target: PKR ${formatAmount(metrics.target)}`);
  lines.push(`💵 Actual Collected Cash: PKR ${formatAmount(metrics.collected)} (${metrics.progressPercent}%)`);
  lines.push(`⏳ Remaining to Collect: PKR ${formatAmount(metrics.remaining)}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);

  if (metrics.isCurrentMonth) {
    lines.push(`📆 Days Left: ${metrics.daysRemaining} days (Day ${metrics.currentDay} of ${metrics.daysInMonth})`);
    lines.push(`⚡ Required Daily Run-Rate: PKR ${formatAmount(metrics.requiredDailyRunRate)} / day`);
    lines.push(`📊 Current Daily Pace: PKR ${formatAmount(metrics.actualDailyRunRate)} / day`);
    lines.push(`🔮 Projected Month-End: PKR ${formatAmount(metrics.projectedMonthEnd)} (${metrics.projectedStatus})`);
    lines.push(`🚦 Pace Status: ${metrics.statusBadge}`);
  } else {
    lines.push(`🏁 Final Result: ${metrics.isHit ? 'TARGET HIT' : 'TARGET MISSED'}`);
    lines.push(`📈 Variance: PKR ${metrics.surplusDeficit >= 0 ? '+' : ''}${formatAmount(metrics.surplusDeficit)}`);
  }

  if (history?.summary && history.summary.targetedMonthsCount > 1) {
    lines.push(`━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🏆 *Annual Target Hit Rate:* ${history.summary.hitRatePercent}% (${history.summary.targetHitCount}/${history.summary.targetedMonthsCount} months hit)`);
  }

  lines.push(`\n🇵🇰 *اردو خلاصہ:*`);
  if (metrics.isHit) {
    lines.push(`ماشاءاللہ! ماہانہ ہدف کامیابی سے حاصل کر لیا گیا ہے۔`);
  } else if (metrics.projectedStatus === 'ON_TRACK') {
    lines.push(`وصولی کی رفتار تسلی بخش ہے۔ موجودہ رفتار برقرار رکھیں تاکہ ہدف پورا ہو۔`);
  } else {
    lines.push(`توجہ درکار: ہدف حاصل کرنے کے لیے روزانہ کم از کم PKR ${formatAmount(metrics.requiredDailyRunRate)} وصول کرنا ضروری ہے۔`);
  }

  return lines.join('\n');
}

/**
 * Generates RFC-4180 compliant CSV export for monthly target history.
 * @param {Object} history - Result of calculateCollectionTargetHistory
 * @returns {string} CSV text with UTF-8 BOM
 */
export function generateCollectionTargetsCsv(history) {
  const escapeCell = val => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const headers = [
    'Month',
    'Month Name',
    'Target (PKR)',
    'Collected Cash (PKR)',
    'Billed Volume (PKR)',
    'Progress (%)',
    'Remaining (PKR)',
    'Status',
    'Variance (PKR)',
    'Daily Run-Rate Required (PKR)',
    'Actual Daily Pace (PKR)',
    'Projected Month-End (PKR)'
  ];

  const rows = (history?.rows ?? []).map(r => [
    escapeCell(r.month),
    escapeCell(r.monthLabel),
    escapeCell(r.hasTarget ? r.target : 'NOT_SET'),
    escapeCell(r.collected),
    escapeCell(r.billedAmount),
    escapeCell(r.hasTarget ? r.progressPercent : ''),
    escapeCell(r.hasTarget ? r.remaining : ''),
    escapeCell(r.hasTarget ? (r.isHit ? 'HIT' : (r.isPastMonth ? 'MISSED' : r.projectedStatus)) : 'NO_TARGET'),
    escapeCell(r.hasTarget ? r.surplusDeficit : ''),
    escapeCell(r.hasTarget ? r.requiredDailyRunRate : ''),
    escapeCell(r.actualDailyRunRate),
    escapeCell(r.hasTarget ? r.projectedMonthEnd : '')
  ].join(','));

  return '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\r\n');
}

/**
 * Generates formal printable A4 and 80mm POS slip HTML.
 * @param {Object} metrics
 * @param {Object} history
 * @param {'a4'|'pos'} [format='a4']
 * @returns {string} Complete HTML string
 */
export function generateCollectionTargetReportHtml(metrics, history, format = 'a4') {
  const esc = str => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const printedAt = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });

  if (format === 'pos') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Collection Target Slip - ${esc(metrics.monthLabel)}</title>
  <style>
    @page { size: 80mm auto; margin: 3mm; }
    body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: 74mm; margin: 0 auto; line-height: 1.3; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .badge { border: 1px solid #000; padding: 2px 4px; text-align: center; margin: 4px 0; font-weight: bold; }
    @media print { body { width: 100%; } }
  </style>
</head>
<body onload="window.print()">
  <div class="center bold" style="font-size: 13px;">SHAHDARA ISP BILLING</div>
  <div class="center">Collection Target Slip</div>
  <div class="divider"></div>
  <div class="row"><span>Month:</span><span class="bold">${esc(metrics.monthLabel)}</span></div>
  <div class="row"><span>Printed:</span><span>${esc(printedAt)}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Target:</span><span class="bold">PKR ${formatAmount(metrics.target ?? 0)}</span></div>
  <div class="row"><span>Collected:</span><span class="bold">PKR ${formatAmount(metrics.collected)}</span></div>
  <div class="row"><span>Progress:</span><span class="bold">${metrics.progressPercent ?? 0}%</span></div>
  <div class="row"><span>Remaining:</span><span>PKR ${formatAmount(metrics.remaining ?? 0)}</span></div>
  <div class="divider"></div>
  <div class="row"><span>Req. Run-Rate:</span><span class="bold">PKR ${formatAmount(metrics.requiredDailyRunRate ?? 0)}/d</span></div>
  <div class="row"><span>Current Pace:</span><span>PKR ${formatAmount(metrics.actualDailyRunRate)}/d</span></div>
  <div class="row"><span>Projected End:</span><span>PKR ${formatAmount(metrics.projectedMonthEnd ?? 0)}</span></div>
  <div class="badge">${esc(metrics.statusBadge)}</div>
  <div class="divider"></div>
  <div class="center" style="font-size: 9px;">Daily collection velocity directly impacts business health. Keep the pace!</div>
</body>
</html>`;
  }

  // A4 Format
  const historyRows = (history?.rows ?? []).map(r => `
    <tr>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">${esc(r.monthLabel)}</td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${r.hasTarget ? 'PKR ' + formatAmount(r.target) : 'Not Set'}</td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold;">PKR ${formatAmount(r.collected)}</td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${r.hasTarget ? r.progressPercent + '%' : '-'}</td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">
        <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${r.isHit ? '#d1fae5; color: #065f46;' : (r.isPastMonth ? '#fee2e2; color: #991b1b;' : '#e0f2fe; color: #0369a1;')}">
          ${esc(r.hasTarget ? (r.isHit ? 'HIT' : (r.isPastMonth ? 'MISSED' : r.projectedStatus)) : 'NO TARGET')}
        </span>
      </td>
      <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; color: ${r.surplusDeficit >= 0 ? '#166534' : '#991b1b'};">
        ${r.hasTarget ? (r.surplusDeficit >= 0 ? '+' : '') + 'PKR ' + formatAmount(r.surplusDeficit) : '-'}
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Monthly Collection Target Performance Certificate - ${esc(metrics.monthLabel)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #0f172a; line-height: 1.5; margin: 0; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
    .kpi-label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; }
    .kpi-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569; }
    .footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body onload="window.print()">
  <div class="header">
    <div>
      <h1 class="title">SHAHDARA ISP BILLING SYSTEM</h1>
      <div class="subtitle">Monthly Collection Target &amp; Daily Run-Rate Performance Audit</div>
    </div>
    <div style="text-align: right; font-size: 11px;">
      <div><strong>Report Month:</strong> ${esc(metrics.monthLabel)}</div>
      <div><strong>Printed:</strong> ${esc(printedAt)}</div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Monthly Target</div>
      <div class="kpi-val">${metrics.hasTarget ? 'PKR ' + formatAmount(metrics.target) : 'Not Set'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Actual Collected</div>
      <div class="kpi-val" style="color: #0284c7;">PKR ${formatAmount(metrics.collected)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Progress Achieved</div>
      <div class="kpi-val" style="color: ${metrics.isHit ? '#166534' : '#d97706'};">${metrics.hasTarget ? metrics.progressPercent + '%' : '-'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Req. Daily Run-Rate</div>
      <div class="kpi-val" style="color: #ea580c;">${metrics.hasTarget ? 'PKR ' + formatAmount(metrics.requiredDailyRunRate) + '/d' : '-'}</div>
    </div>
  </div>

  <h3 style="font-size: 13px; text-transform: uppercase; margin: 16px 0 6px 0; color: #334155;">Historical Monthly Target Ledger</h3>
  <table>
    <thead>
      <tr>
        <th style="text-align: left;">Month</th>
        <th style="text-align: right;">Target</th>
        <th style="text-align: right;">Collected</th>
        <th>Progress</th>
        <th>Verdict</th>
        <th style="text-align: right;">Variance</th>
      </tr>
    </thead>
    <tbody>
      ${historyRows}
    </tbody>
  </table>

  <div class="footer">
    Verified Offline ISP Accounting Ledger Snapshot · Pure Client-Side Computation · Shahdara ISP Billing
  </div>
</body>
</html>`;
}

/**
 * Controller to manage the Collection Target Dialog Modal and Dashboard Card.
 * @param {Object} state
 * @param {Object} [options]
 * @returns {Object} Controller interface
 */
export function setupCollectionTargetModal(state, options = {}) {
  const modal = document.getElementById('collectionTargetModal');
  const openBtn = document.getElementById('openCollectionTargetBtn');
  const closeBtn = document.getElementById('closeCollectionTargetModalBtn');
  const monthSelect = document.getElementById('targetMonthSelect');
  const targetInput = document.getElementById('targetAmountInput');
  const saveBtn = document.getElementById('saveTargetAmountBtn');
  const removeBtn = document.getElementById('removeTargetAmountBtn');
  const quickPkrBtns = document.querySelectorAll('[data-quick-target]');
  const gaugeContainer = document.getElementById('targetGaugeContainer');
  const historyTbody = document.getElementById('targetHistoryTableBody');
  const exportCsvBtn = document.getElementById('exportTargetCsvBtn');
  const shareWhatsAppBtn = document.getElementById('shareTargetWhatsAppBtn');
  const printA4Btn = document.getElementById('printTargetA4Btn');
  const printPosBtn = document.getElementById('printTargetPosBtn');
  const dashboardPreviewContainer = document.getElementById('dashboardTargetChart');

  let selectedMonth = monthKey(new Date());

  function render() {
    const metrics = calculateCollectionTargetMetrics(state, selectedMonth);
    const history = calculateCollectionTargetHistory(state, { monthsCount: 12 });

    // Render SVG Gauge in modal
    if (gaugeContainer) {
      gaugeContainer.innerHTML = renderCollectionTargetGaugeSvg(metrics);
    }

    // Render Preview in dashboard chart card if element exists
    if (dashboardPreviewContainer) {
      dashboardPreviewContainer.innerHTML = renderCollectionTargetGaugeSvg(metrics);
    }

    // Update target input value
    if (targetInput) {
      targetInput.value = metrics.hasTarget ? metrics.target : '';
    }

    // Update KPIs in modal
    const targetValEl = document.getElementById('modalTargetVal');
    const collectedValEl = document.getElementById('modalTargetCollectedVal');
    const remainingValEl = document.getElementById('modalTargetRemainingVal');
    const runRateValEl = document.getElementById('modalTargetRunRateVal');

    if (targetValEl) targetValEl.textContent = metrics.hasTarget ? `PKR ${formatAmount(metrics.target)}` : 'Not Set';
    if (collectedValEl) collectedValEl.textContent = `PKR ${formatAmount(metrics.collected)}`;
    if (remainingValEl) remainingValEl.textContent = metrics.hasTarget ? `PKR ${formatAmount(metrics.remaining)}` : 'Not Set';
    if (runRateValEl) runRateValEl.textContent = metrics.hasTarget ? `PKR ${formatAmount(metrics.requiredDailyRunRate)}/d` : 'Not Set';

    // Populate history table
    if (historyTbody) {
      historyTbody.innerHTML = history.rows.map(r => `
        <tr>
          <td><strong>${r.monthLabel}</strong></td>
          <td class="font-mono">${r.hasTarget ? 'PKR ' + formatAmount(r.target) : '<span class="text-muted">Not Set</span>'}</td>
          <td class="font-mono"><strong>PKR ${formatAmount(r.collected)}</strong></td>
          <td>${r.hasTarget ? r.progressPercent + '%' : '-'}</td>
          <td>
            <span class="target-status-badge badge-${r.isHit ? 'hit' : (r.isPastMonth ? 'missed' : 'pending')}">
              ${r.hasTarget ? (r.isHit ? 'Hit' : (r.isPastMonth ? 'Missed' : r.projectedStatus)) : 'No Target'}
            </span>
          </td>
        </tr>
      `).join('');
    }
  }

  // Populate month select
  if (monthSelect) {
    const months = monthsForHistory(new Date(), 24);
    monthSelect.innerHTML = months.map(m => `
      <option value="${m}" ${m === selectedMonth ? 'selected' : ''}>${monthName(m)} (${m})</option>
    `).join('');

    monthSelect.addEventListener('change', e => {
      selectedMonth = e.target.value;
      render();
    });
  }

  // Quick target buttons
  quickPkrBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.quickTarget;
      if (val === 'billed') {
        const metrics = calculateCollectionTargetMetrics(state, selectedMonth);
        if (targetInput) targetInput.value = metrics.billedAmount || 150000;
      } else if (targetInput && val) {
        targetInput.value = val;
      }
    });
  });

  // Save target button
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const val = targetInput?.value;
      if (!val || Number(val) <= 0) {
        alert('Please enter a valid positive target amount in PKR.');
        return;
      }
      setCollectionTarget(selectedMonth, Number(val));
      render();
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast(`Monthly target for ${monthName(selectedMonth)} saved!`);
      }
    });
  }

  // Remove target button
  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      const ask = typeof window !== 'undefined' && typeof window.appConfirm === 'function'
        ? await window.appConfirm({
            tone: 'danger',
            title: 'Remove this collection target?',
            subject: `Target · ${monthName(selectedMonth)}`,
            message: `The collection target for ${monthName(selectedMonth)} will be removed from this device.`,
            confirmLabel: 'Remove target'
          })
        : (typeof confirm === 'function' ? confirm(`Remove the target for ${monthName(selectedMonth)}?`) : true);

      if (ask) {
        removeCollectionTarget(selectedMonth);
        render();
        if (typeof window !== 'undefined' && typeof window.toast === 'function') {
          window.toast(`Monthly target for ${monthName(selectedMonth)} removed.`);
        }
      }
    });
  }

  // CSV Export
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const history = calculateCollectionTargetHistory(state, { monthsCount: 24 });
      const csv = generateCollectionTargetsCsv(history);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara-collection-targets-${selectedMonth}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // WhatsApp share
  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', () => {
      const metrics = calculateCollectionTargetMetrics(state, selectedMonth);
      const history = calculateCollectionTargetHistory(state);
      const text = formatCollectionTargetWhatsApp(metrics, history);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    });
  }

  // Print A4
  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const metrics = calculateCollectionTargetMetrics(state, selectedMonth);
      const history = calculateCollectionTargetHistory(state);
      const html = generateCollectionTargetReportHtml(metrics, history, 'a4');
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    });
  }

  // Print POS
  if (printPosBtn) {
    printPosBtn.addEventListener('click', () => {
      const metrics = calculateCollectionTargetMetrics(state, selectedMonth);
      const history = calculateCollectionTargetHistory(state);
      const html = generateCollectionTargetReportHtml(metrics, history, 'pos');
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    });
  }

  // Modal open / close
  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      selectedMonth = monthKey(new Date());
      if (monthSelect) monthSelect.value = selectedMonth;
      render();
      modal.showModal();
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.close());
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        const rect = modal.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY &&
          e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX &&
          e.clientX <= rect.left + rect.width
        );
        if (!isInDialog && typeof modal.close === 'function') {
          modal.close();
        }
      }
    });
  }

  // Initial render for dashboard chart
  render();

  return {
    open: () => {
      if (modal) {
        render();
        modal.showModal();
      }
    },
    close: () => {
      if (modal) modal.close();
    },
    refresh: render,
    setMonth: m => {
      selectedMonth = m;
      if (monthSelect) monthSelect.value = m;
      render();
    },
    getData: () => ({
      metrics: calculateCollectionTargetMetrics(state, selectedMonth),
      history: calculateCollectionTargetHistory(state)
    })
  };
}
