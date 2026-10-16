import { monthsForHistory, buildMonthlyClosingSnapshot, calculatePaymentAllocations, formatPKR, calculateDashboard, derivedBillStatus, listTransactions } from './core.js';
import { calculateDashboardKpis, calculateCustomerHealthBreakdown, calculatePaymentMethodBreakdown, calculateChurnRiskAnalysis, calculateCustomerLtvCohorts, setupLtvCohortModal, calculateIncidentImpactMatrix, setupIncidentImpactModal, calculateCashflowProjections, setupProjectionScenarioModal, calculateUpstreamGatewayMetrics, setupUpstreamGatewayModal, calculateAcquisitionRoiMetrics, setupAcquisitionRoiModal, calculateBandwidthShapingMetrics, setupBandwidthShapingModal, calculateFiberDistributionMetrics, setupFiberDistributionModal, calculateDelinquencyRecoveryPipeline, setupDelinquencyPipelineModal, calculateCpeAssetMetrics, setupCpeAssetModal, calculatePowerBackupMetrics, setupPowerBackupModal, calculateRouteDensityMetrics, setupRouteDensityModal } from './dashboard.js';
import { calculateOtdrFaultMetrics, setupOtdrModal, renderOtdrTraceSvg } from './dashboard-otdr.js';
import { calculateSolarInverterMetrics, setupSolarModal, renderSolarInverterSvg } from './dashboard-solar.js';
import { calculateAerialTensionMetrics, setupAerialTensionModal, renderAerialTensionSvg } from './dashboard-aerial.js';
import { calculateMicrowaveLinkBudget, setupMicrowaveModal, renderMicrowaveLinkSvg } from './dashboard-microwave.js';
import { calculateSpliceClosureMetrics, setupSpliceClosureModal, renderSpliceClosureSvg } from './dashboard-splice.js';
import { calculateDuctJettingMetrics, setupDuctJettingModal, renderDuctJettingSvg } from './dashboard-jetting.js';

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const PKG_PALETTE = ['#0e5b4d', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export const METHOD_COLORS = {
  'Cash': '#0e5b4d',
  'JazzCash': '#dc2626',
  'Easypaisa': '#16a34a',
  'Bank Transfer': '#2563eb',
  'Cash at Waseem Abbasi shop': '#d97706',
  'Cash at Hassan shop': '#7c3aed',
  'Other': '#64748b'
};

export function getMethodColor(methodName, index = 0) {
  if (METHOD_COLORS[methodName]) return METHOD_COLORS[methodName];
  for (const [key, color] of Object.entries(METHOD_COLORS)) {
    if (String(methodName).toLowerCase().includes(key.toLowerCase())) return color;
  }
  const fallback = ['#0891b2', '#4f46e5', '#ca8a04', '#059669', '#9333ea', '#e11d48'];
  return fallback[index % fallback.length];
}

let currentTrendMonths = 6;
let currentMethodPeriod = 'currentMonth';
let currentHeatmapFilter = 'all';

export function setTrendChartDuration(months) {
  const m = Number(months);
  if ([3, 6, 12].includes(m)) {
    currentTrendMonths = m;
  }
}

export function getTrendChartDuration() {
  return currentTrendMonths;
}

export function setMethodChartPeriod(period) {
  if (['currentMonth', '30days', 'all'].includes(period)) {
    currentMethodPeriod = period;
  }
}

export function getMethodChartPeriod() {
  return currentMethodPeriod;
}

export function setHeatmapFilter(filter) {
  if (['all', 'high', 'moderate', 'lagging'].includes(filter)) {
    currentHeatmapFilter = filter;
  }
}

export function getHeatmapFilter() {
  return currentHeatmapFilter;
}

let currentSeasonalMetric = 'collections';
let currentMarginCostPerMbps = 50;

export function setSeasonalMetric(metric) {
  if (['collections', 'billed'].includes(metric)) {
    currentSeasonalMetric = metric;
  }
}

export function getSeasonalMetric() {
  return currentSeasonalMetric;
}

export function setMarginSimulatorCostPerMbps(cost) {
  const c = Number(cost);
  if (Number.isFinite(c) && c >= 0) {
    currentMarginCostPerMbps = c;
  }
}

export function getMarginSimulatorCostPerMbps() {
  return currentMarginCostPerMbps;
}

let currentLtvMetric = 'averageLtv';

export function setLtvMetric(metric) {
  if (['averageLtv', 'totalLtv'].includes(metric)) {
    currentLtvMetric = metric;
  }
}

export function getLtvMetric() {
  return currentLtvMetric;
}

let currentProjectionScenario = 'baseline';

export function setProjectionScenario(scenario) {
  if (['baseline', 'optimistic', 'conservative'].includes(scenario)) {
    currentProjectionScenario = scenario;
  }
}

export function getProjectionScenario() {
  return currentProjectionScenario;
}

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Calculates historical monthly billed revenue vs actual cash collection trends
 * for the requested number of recent months (default: 6, or 3, 12).
 */
export function calculateMonthlyTrends(state, referenceDate = new Date(), monthsCount = 6) {
  const allMonths = monthsForHistory(referenceDate);
  const selectedMonths = allMonths.slice(0, monthsCount).reverse();

  return selectedMonths.map(month => {
    const parts = month.split('-');
    const mIdx = parseInt(parts[1], 10) - 1;
    const yearShort = parts[0].slice(2);
    const monthLabel = monthsCount > 6 ? MONTH_SHORT_NAMES[mIdx] : `${MONTH_SHORT_NAMES[mIdx]} '${yearShort}`;

    const snapshot = buildMonthlyClosingSnapshot(state, month, referenceDate);
    return {
      month,
      monthLabel,
      billed: Number(snapshot.billedAmount) || 0,
      collected: Number(snapshot.collection) || 0
    };
  });
}

/**
 * Groups and sums outstanding unpaid balances across retained bills by customer area.
 * Returns top areas sorted descending by total dues.
 */
export function calculateDuesByArea(state, referenceDate = new Date(), maxAreas = 5) {
  const allocations = calculatePaymentAllocations(state);
  const retainedMonths = new Set(monthsForHistory(referenceDate));
  const areaMap = new Map();

  for (const customer of (state.customers ?? [])) {
    if (customer.archived) continue;
    const areaName = customer.area && String(customer.area).trim() ? String(customer.area).trim() : 'Unassigned';

    if (!areaMap.has(areaName)) {
      areaMap.set(areaName, { area: areaName, totalDueCents: 0, customerCount: 0, seenCustomers: new Set() });
    }
    const group = areaMap.get(areaName);
    if (!group.seenCustomers.has(customer.id)) {
      group.seenCustomers.add(customer.id);
      group.customerCount++;
    }

    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      if (!retainedMonths.has(bill.month)) continue;
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || Number(amount) <= 0) continue;

      const summary = allocations.forMonth?.(customer.id, bill.month);
      const balanceDueCents = summary?.balanceDueCents ?? Math.round(Number(amount) * 100);
      if (balanceDueCents > 0) {
        group.totalDueCents += balanceDueCents;
      }
    }
  }

  const result = [...areaMap.values()]
    .map(g => ({
      area: g.area,
      totalDue: Math.round(g.totalDueCents / 100),
      customerCount: g.customerCount
    }))
    .filter(g => g.totalDue > 0)
    .sort((a, b) => b.totalDue - a.totalDue);

  return result.slice(0, maxAreas);
}

/**
 * Computes a detailed area breakdown across all active customers, subscriber counts,
 * active vs offline counts, and total outstanding dues.
 */
export function calculateAreaDetailedBreakdown(state, referenceDate = new Date()) {
  const allocations = calculatePaymentAllocations(state);
  const retainedMonths = new Set(monthsForHistory(referenceDate));
  const areaMap = new Map();

  for (const customer of (state.customers ?? [])) {
    if (customer.archived) continue;
    const areaName = (customer.area && String(customer.area).trim()) ? String(customer.area).trim() : 'Unassigned';

    if (!areaMap.has(areaName)) {
      areaMap.set(areaName, {
        area: areaName,
        customerCount: 0,
        activeCount: 0,
        offlineCount: 0,
        unsetCount: 0,
        totalDueCents: 0
      });
    }

    const group = areaMap.get(areaName);
    group.customerCount++;
    if (customer.serviceStatus === 'active') group.activeCount++;
    else if (customer.serviceStatus === 'offline') group.offlineCount++;
    else group.unsetCount++;

    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      if (!retainedMonths.has(bill.month)) continue;
      const amount = bill.dueAmount;
      if (amount === null || amount === undefined || amount === '' || Number(amount) <= 0) continue;

      const summary = allocations.forMonth?.(customer.id, bill.month);
      const balanceDueCents = summary?.balanceDueCents ?? Math.round(Number(amount) * 100);
      if (balanceDueCents > 0) {
        group.totalDueCents += balanceDueCents;
      }
    }
  }

  return [...areaMap.values()]
    .map(g => ({
      area: g.area,
      customerCount: g.customerCount,
      activeCount: g.activeCount,
      offlineCount: g.offlineCount,
      unsetCount: g.unsetCount,
      totalDue: Math.round(g.totalDueCents / 100)
    }))
    .sort((a, b) => b.totalDue - a.totalDue || b.customerCount - a.customerCount);
}

/**
 * Computes geographic collection heatmap and recovery rates by area.
 * Evaluates current-month billed snapshot amounts, cash collections,
 * recovery percentage, ARPU, and efficiency status tiers.
 */
export function calculateAreaCollectionHeatmap(state, referenceDate = new Date()) {
  const currentSnapshot = calculateDashboard(state, referenceDate);
  const currentMonth = currentSnapshot.currentMonth;
  const allocations = calculatePaymentAllocations(state);
  const retainedMonths = new Set(monthsForHistory(referenceDate));

  const areaMap = new Map();

  for (const customer of (state.customers ?? [])) {
    if (customer.archived) continue;
    const areaName = (customer.area && String(customer.area).trim()) ? String(customer.area).trim() : 'Unassigned';

    if (!areaMap.has(areaName)) {
      areaMap.set(areaName, {
        area: areaName,
        customerCount: 0,
        activeCount: 0,
        offlineCount: 0,
        currentBilledCents: 0,
        currentCollectedCents: 0,
        totalDueCents: 0,
        paidBillsCount: 0,
        unpaidBillsCount: 0,
        partialBillsCount: 0
      });
    }

    const group = areaMap.get(areaName);
    group.customerCount++;
    if (customer.serviceStatus === 'active') group.activeCount++;
    else if (customer.serviceStatus === 'offline') group.offlineCount++;

    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      if (!retainedMonths.has(bill.month)) continue;
      const amount = bill.dueAmount;
      const hasPrice = amount !== null && amount !== undefined && amount !== '' && Number(amount) > 0;

      // Outstanding dues across retained history
      if (hasPrice) {
        const summary = allocations.forMonth?.(customer.id, bill.month);
        const balanceDueCents = summary?.balanceDueCents ?? Math.round(Number(amount) * 100);
        if (balanceDueCents > 0) {
          group.totalDueCents += balanceDueCents;
        }
      }

      // Current month billed revenue and status
      if (bill.month === currentMonth) {
        if (hasPrice) {
          const billedCents = Math.round(Number(amount) * 100);
          group.currentBilledCents += billedCents;
          const status = derivedBillStatus(customer, bill, allocations);
          if (status === 'PAID') group.paidBillsCount++;
          else if (status === 'PARTIAL') group.partialBillsCount++;
          else group.unpaidBillsCount++;
        }
      }

      // Actual cash receipts dated in current month for this customer
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const p of payments) {
        if (typeof p.date === 'string' && p.date.startsWith(currentMonth)) {
          const amt = Number(p.amount) || 0;
          if (amt > 0) {
            group.currentCollectedCents += Math.round(amt * 100);
          }
        }
      }
    }
  }

  let totalBilled = 0;
  let totalCollected = 0;
  let totalOutstanding = 0;

  const areas = [...areaMap.values()].map(g => {
    const billed = Math.round(g.currentBilledCents / 100);
    const collected = Math.round(g.currentCollectedCents / 100);
    const totalDue = Math.round(g.totalDueCents / 100);

    totalBilled += billed;
    totalCollected += collected;
    totalOutstanding += totalDue;

    const recoveryRate = billed > 0 ? Math.round((collected / billed) * 100) : (collected > 0 ? 100 : 0);

    let tier = 'neutral';
    let tierLabel = 'No Activity';
    let heatColor = '#64748b'; // slate
    if (billed > 0 || collected > 0) {
      if (recoveryRate >= 85) {
        tier = 'high';
        tierLabel = 'Optimal Recovery';
        heatColor = '#10b981'; // emerald
      } else if (recoveryRate >= 60) {
        tier = 'moderate';
        tierLabel = 'Moderate Recovery';
        heatColor = '#f59e0b'; // amber
      } else {
        tier = 'lagging';
        tierLabel = 'Lagging Collection';
        heatColor = '#ef4444'; // rose
      }
    }

    const arpu = g.activeCount > 0 ? Math.round(billed / g.activeCount) : 0;

    return {
      area: g.area,
      customerCount: g.customerCount,
      activeCount: g.activeCount,
      offlineCount: g.offlineCount,
      billed,
      collected,
      totalDue,
      recoveryRate,
      tier,
      tierLabel,
      heatColor,
      arpu,
      paidBillsCount: g.paidBillsCount,
      partialBillsCount: g.partialBillsCount,
      unpaidBillsCount: g.unpaidBillsCount
    };
  }).sort((a, b) => b.billed - a.billed || b.totalDue - a.totalDue || b.customerCount - a.customerCount);

  const highRecoveryCount = areas.filter(a => a.tier === 'high').length;
  const moderateRecoveryCount = areas.filter(a => a.tier === 'moderate').length;
  const laggingCount = areas.filter(a => a.tier === 'lagging').length;
  const overallRecoveryRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  const topPerformingArea = [...areas].filter(a => a.billed > 0).sort((a, b) => b.recoveryRate - a.recoveryRate)[0] || null;
  const highestDueArea = [...areas].sort((a, b) => b.totalDue - a.totalDue)[0] || null;

  return {
    currentMonth,
    areas,
    summary: {
      totalAreas: areas.length,
      highRecoveryCount,
      moderateRecoveryCount,
      laggingCount,
      totalBilled,
      totalCollected,
      totalOutstanding,
      overallRecoveryRate,
      topPerformingArea: topPerformingArea ? { area: topPerformingArea.area, rate: topPerformingArea.recoveryRate } : null,
      highestDueArea: highestDueArea && highestDueArea.totalDue > 0 ? { area: highestDueArea.area, due: highestDueArea.totalDue } : null
    }
  };
}

/**
 * Calculates customer count and expected monthly recurring revenue per package tier.
 */
export function calculatePackageDistribution(state) {
  const map = new Map();
  let totalTracked = 0;
  let totalMonthlyRevenue = 0;

  for (const customer of (state.customers ?? [])) {
    if (customer.archived) continue;
    totalTracked++;
    const pkg = (customer.packageSpeed && String(customer.packageSpeed).trim())
      ? String(customer.packageSpeed).trim()
      : 'Unassigned';

    if (!map.has(pkg)) {
      map.set(pkg, {
        packageName: pkg,
        count: 0,
        activeCount: 0,
        monthlyRevenue: 0
      });
    }

    const item = map.get(pkg);
    item.count++;
    if (customer.serviceStatus === 'active') {
      item.activeCount++;
    }
    const rate = Number(customer.monthlySellingAmount) || 0;
    item.monthlyRevenue += rate;
    totalMonthlyRevenue += rate;
  }

  const packages = [...map.values()]
    .map(p => ({
      ...p,
      percent: totalTracked > 0 ? Math.round((p.count / totalTracked) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count || b.monthlyRevenue - a.monthlyRevenue);

  return {
    packages,
    totalTracked,
    totalMonthlyRevenue
  };
}

/**
 * Generates an accessible, theme-aware pure SVG bar chart comparing billed revenue to cash collections.
 * Optionally displays a milestone target revenue marker line.
 */
export function renderMonthlyTrendSvg(trends, { targetRevenue = null } = {}) {
  const maxVal = Math.max(...trends.flatMap(t => [t.billed, t.collected]), 0);
  const width = 560;
  const height = 240;

  if (maxVal === 0 && (!targetRevenue || targetRevenue <= 0)) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Monthly Revenue and Collections Trend: No data recorded yet">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, ${height / 2 - 12})" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-8 -6 L-8 -22 L8 -22 L8 -6 Z M-3 -10 L3 -10" stroke="#0e5b4d" stroke-width="2" fill="none" stroke-linejoin="round" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No billing or collection activity</text>
        <text y="42" class="chart-empty-sub" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Past months show zero recorded entries</text>
      </g>
    </svg>`;
  }

  const plotX = 64;
  const plotY = 38;
  const plotW = 466;
  const plotH = 152;
  const effectiveMax = Math.max(maxVal, Number(targetRevenue) || 0);
  const yCeil = Math.ceil((effectiveMax * 1.15) / 1000) * 1000 || 1000;

  // Grid lines (4 steps)
  const gridSteps = 4;
  let gridLinesSvg = '';
  for (let s = 0; s <= gridSteps; s++) {
    const val = Math.round((yCeil / gridSteps) * s);
    const yPos = plotY + plotH - (s / gridSteps) * plotH;
    const label = val >= 1000 ? `${Math.round(val / 1000)}k` : String(val);
    gridLinesSvg += `
      <line x1="${plotX}" y1="${yPos}" x2="${plotX + plotW}" y2="${yPos}" stroke="var(--line, #e2ece7)" stroke-width="1" stroke-dasharray="${s > 0 ? '4 3' : 'none'}" />
      <text x="${plotX - 8}" y="${yPos + 4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">${label}</text>
    `;
  }

  // Milestone Target line
  let targetSvg = '';
  if (targetRevenue && Number(targetRevenue) > 0) {
    const targetVal = Number(targetRevenue);
    const targetY = plotY + plotH - (targetVal / yCeil) * plotH;
    targetSvg = `
      <line class="chart-target-line" x1="${plotX}" y1="${targetY}" x2="${plotX + plotW}" y2="${targetY}" stroke="#6366f1" stroke-width="1.5" stroke-dasharray="5 3" />
      <text class="chart-target-label" x="${plotX + plotW}" y="${targetY - 5}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="700" fill="#6366f1">Target: ${formatPKR(targetVal)}</text>
    `;
  }

  // Bars for each month
  const barSlotW = plotW / trends.length;
  const barW = Math.max(8, Math.min(22, (barSlotW - 12) / 2));
  let barsSvg = '';

  trends.forEach((t, i) => {
    const slotCenter = plotX + i * barSlotW + barSlotW / 2;
    const billedH = Math.max(0, (t.billed / yCeil) * plotH);
    const collectedH = Math.max(0, (t.collected / yCeil) * plotH);

    const billedX = slotCenter - barW - 1.5;
    const billedY = plotY + plotH - billedH;
    const collectedX = slotCenter + 1.5;
    const collectedY = plotY + plotH - collectedH;

    barsSvg += `
      <g class="chart-month-group" tabindex="0" role="graphics-symbol" aria-label="${t.monthLabel}: Billed ${formatPKR(t.billed)}, Collected ${formatPKR(t.collected)}">
        <rect class="bar-billed" x="${billedX}" y="${billedY}" width="${barW}" height="${billedH}" rx="3" fill="#3b82f6">
          <title>${t.monthLabel} Billed: ${formatPKR(t.billed)}</title>
        </rect>
        <rect class="bar-collected" x="${collectedX}" y="${collectedY}" width="${barW}" height="${collectedH}" rx="3" fill="#10b981">
          <title>${t.monthLabel} Collected: ${formatPKR(t.collected)}</title>
        </rect>
        <text x="${slotCenter}" y="${plotY + plotH + 18}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="${trends.length > 8 ? 9.5 : 11}" font-weight="600" fill="var(--ink, #182e2a)">${t.monthLabel}</text>
      </g>
    `;
  });

  // Legend at top
  const legendSvg = `
    <g class="chart-legend" transform="translate(${plotX}, 16)">
      <rect x="0" y="0" width="10" height="10" rx="2" fill="#3b82f6" />
      <text x="14" y="9" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--ink, #182e2a)">Billed Revenue</text>
      <rect x="115" y="0" width="10" height="10" rx="2" fill="#10b981" />
      <text x="129" y="9" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--ink, #182e2a)">Collected Cash</text>
      ${targetRevenue && Number(targetRevenue) > 0 ? `
        <line x1="230" y1="5" x2="245" y2="5" stroke="#6366f1" stroke-width="2" stroke-dasharray="3 2" />
        <text x="250" y="9" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--ink, #182e2a)">Target Milestone</text>
      ` : ''}
    </g>
  `;

  return `<svg class="chart-svg chart-trend-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Monthly Revenue and Collections Trend Bar Chart">
    ${legendSvg}
    ${gridLinesSvg}
    ${targetSvg}
    ${barsSvg}
  </svg>`;
}

/**
 * Generates an accessible, theme-aware pure SVG donut chart showing the Paid, Partial, and Unpaid bill breakdown.
 */
export function renderBillStatusDonutSvg({ paid = 0, unpaid = 0, partial = 0, total = 0 } = {}) {
  const width = 280;
  const height = 240;

  if (total === 0) {
    return `<svg class="chart-svg chart-donut-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Current Month Bill Status: No bills recorded">
      <circle cx="${width / 2}" cy="100" r="50" fill="none" stroke="var(--line, #e2ece7)" stroke-width="20" />
      <text x="${width / 2}" y="98" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--muted, #71817c)">0 Bills</text>
      <text x="${width / 2}" y="115" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">This month</text>
      <text x="${width / 2}" y="200" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">No bill entries created yet</text>
    </svg>`;
  }

  const cx = width / 2;
  const cy = 96;
  const r = 52;
  const strokeW = 22;
  const C = 2 * Math.PI * r;

  const paidLen = (paid / total) * C;
  const partialLen = (partial / total) * C;
  const unpaidLen = (unpaid / total) * C;

  const paidOffset = 0;
  const partialOffset = -paidLen;
  const unpaidOffset = -(paidLen + partialLen);

  const percentPaid = Math.round((paid / total) * 100);

  return `<svg class="chart-svg chart-donut-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Current Month Bill Payment Breakdown: ${paid} paid, ${partial} partial, ${unpaid} unpaid out of ${total} total bills">
    <g transform="rotate(-90 ${cx} ${cy})">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line, #e2ece7)" stroke-width="${strokeW}" />
      ${paid > 0 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#10b981" stroke-width="${strokeW}" stroke-dasharray="${paidLen} ${C}" stroke-dashoffset="${paidOffset}"><title>Paid: ${paid} (${percentPaid}%)</title></circle>` : ''}
      ${partial > 0 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#3b82f6" stroke-width="${strokeW}" stroke-dasharray="${partialLen} ${C}" stroke-dashoffset="${partialOffset}"><title>Partial: ${partial}</title></circle>` : ''}
      ${unpaid > 0 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ef4444" stroke-width="${strokeW}" stroke-dasharray="${unpaidLen} ${C}" stroke-dashoffset="${unpaidOffset}"><title>Unpaid: ${unpaid}</title></circle>` : ''}
    </g>
    <g class="donut-center" text-anchor="middle">
      <text x="${cx}" y="${cy + 2}" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="20" fill="var(--ink, #182e2a)">${percentPaid}%</text>
      <text x="${cx}" y="${cy + 17}" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">PAID</text>
    </g>
    <!-- Legend -->
    <g class="donut-legend" transform="translate(24, 182)">
      <g transform="translate(0, 0)">
        <circle cx="6" cy="6" r="4" fill="#10b981" />
        <text x="14" y="9" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="600" fill="var(--ink, #182e2a)">Paid: ${paid}</text>
      </g>
      <g transform="translate(82, 0)">
        <circle cx="6" cy="6" r="4" fill="#3b82f6" />
        <text x="14" y="9" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="600" fill="var(--ink, #182e2a)">Partial: ${partial}</text>
      </g>
      <g transform="translate(162, 0)">
        <circle cx="6" cy="6" r="4" fill="#ef4444" />
        <text x="14" y="9" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="600" fill="var(--ink, #182e2a)">Unpaid: ${unpaid}</text>
      </g>
      <text x="116" y="28" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">${total} total bill snapshots</text>
    </g>
  </svg>`;
}

/**
 * Generates an accessible, theme-aware pure SVG horizontal bar chart for top areas with outstanding dues.
 */
export function renderAreaDuesSvg(areas) {
  const width = 460;
  const height = 220;

  if (!areas || areas.length === 0) {
    return `<svg class="chart-svg chart-area-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Outstanding Dues by Area: All areas clear">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, ${height / 2 - 8})" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(16, 185, 129, 0.1)" />
        <path d="M-8 -14 L-3 -9 L8 -20" stroke="#10b981" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <text y="22" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No outstanding dues across areas</text>
        <text y="40" class="chart-empty-sub" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">All current and historical bills are settled</text>
      </g>
    </svg>`;
  }

  const maxVal = Math.max(...areas.map(a => a.totalDue), 1000);
  const rowH = 34;
  const startY = 16;
  const labelX = 110;
  const barStartX = 116;
  const maxBarW = 200;

  let rowsSvg = '';
  areas.forEach((item, idx) => {
    const y = startY + idx * rowH;
    const barW = Math.max(6, (item.totalDue / maxVal) * maxBarW);
    const areaName = item.area.length > 14 ? item.area.slice(0, 13) + '…' : item.area;

    rowsSvg += `
      <g class="chart-area-row" tabindex="0" role="graphics-symbol" aria-label="${escapeXml(item.area)}: Due ${formatPKR(item.totalDue)}, ${item.customerCount} customers">
        <text x="${labelX}" y="${y + 13}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--ink, #182e2a)">${escapeXml(areaName)}</text>
        <rect x="${barStartX}" y="${y}" width="${barW}" height="18" rx="4" fill="url(#areaDuesGradient)">
          <title>${escapeXml(item.area)}: ${formatPKR(item.totalDue)} (${item.customerCount} customers)</title>
        </rect>
        <text x="${barStartX + barW + 8}" y="${y + 13}" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">${formatPKR(item.totalDue)}</text>
      </g>
    `;
  });

  return `<svg class="chart-svg chart-area-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Outstanding Dues by Area Bar Chart">
    <defs>
      <linearGradient id="areaDuesGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#d97706" />
      </linearGradient>
    </defs>
    ${rowsSvg}
  </svg>`;
}

/**
 * Generates an accessible, theme-aware pure SVG donut chart showing customer package tier distribution.
 */
export function renderPackageDistributionSvg(packageData) {
  const { packages = [], totalTracked = 0, totalMonthlyRevenue = 0 } = packageData || {};
  const width = 340;
  const height = 240;

  if (!packages || packages.length === 0 || totalTracked === 0) {
    return `<svg class="chart-svg chart-pkg-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Package Tier Distribution: No packages recorded">
      <circle cx="${width / 2}" cy="96" r="50" fill="none" stroke="var(--line, #e2ece7)" stroke-width="20" />
      <text x="${width / 2}" y="98" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--muted, #71817c)">0 Packages</text>
      <text x="${width / 2}" y="115" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">No data</text>
      <text x="${width / 2}" y="195" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">No customer package tiers assigned</text>
    </svg>`;
  }

  const cx = 86;
  const cy = 96;
  const r = 50;
  const strokeW = 20;
  const C = 2 * Math.PI * r;

  let currentOffset = 0;
  let circlesSvg = '';
  packages.slice(0, 6).forEach((pkg, idx) => {
    const color = PKG_PALETTE[idx % PKG_PALETTE.length];
    const sliceLen = (pkg.count / totalTracked) * C;
    const offset = currentOffset;
    currentOffset -= sliceLen;

    circlesSvg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-dasharray="${sliceLen} ${C}" stroke-dashoffset="${offset}">
      <title>${escapeXml(pkg.packageName)}: ${pkg.count} customers (${pkg.percent}%) · ${formatPKR(pkg.monthlyRevenue)}/mo</title>
    </circle>`;
  });

  const dominant = packages[0];
  const dominantPercent = dominant?.percent ?? 0;

  let legendSvg = '';
  packages.slice(0, 5).forEach((pkg, idx) => {
    const color = PKG_PALETTE[idx % PKG_PALETTE.length];
    const yPos = 24 + idx * 28;
    const label = pkg.packageName.length > 13 ? pkg.packageName.slice(0, 12) + '…' : pkg.packageName;
    legendSvg += `
      <g class="chart-pkg-item" transform="translate(172, ${yPos})" tabindex="0" role="graphics-symbol" aria-label="${escapeXml(pkg.packageName)}: ${pkg.count} customers, ${pkg.percent}%">
        <circle cx="5" cy="5" r="4" fill="${color}" />
        <text x="14" y="8" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--ink, #182e2a)">${escapeXml(label)}</text>
        <text x="14" y="20" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">${pkg.count} cust (${pkg.percent}%) · ${formatPKR(pkg.monthlyRevenue)}</text>
      </g>
    `;
  });

  return `<svg class="chart-svg chart-pkg-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Package Tier Distribution Donut Chart: ${totalTracked} subscribers">
    <g transform="rotate(-90 ${cx} ${cy})">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line, #e2ece7)" stroke-width="${strokeW}" />
      ${circlesSvg}
    </g>
    <g class="donut-center" text-anchor="middle">
      <text x="${cx}" y="${cy + 2}" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="19" fill="var(--ink, #182e2a)">${dominantPercent}%</text>
      <text x="${cx}" y="${cy + 16}" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">TOP TIER</text>
    </g>
    <g class="pkg-legend">
      ${legendSvg}
    </g>
    <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">Total Revenue: ${formatPKR(totalMonthlyRevenue)}/mo across ${packages.length} tier${packages.length === 1 ? '' : 's'}</text>
  </svg>`;
}

/**
 * Generates an accessible, theme-aware pure SVG chart for Customer Account Health & Delinquency Matrix.
 */
export function renderCustomerHealthSvg(healthData) {
  const { totalTracked = 0, goodStanding = {}, watchlist = {}, delinquent = {}, offline = {} } = healthData || {};
  const width = 460;
  const height = 210;

  if (totalTracked === 0) {
    return `<svg class="chart-svg chart-health-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Customer Health Matrix: No customer accounts">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, ${height / 2 - 8})" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-10 -14 L-4 -8 L10 -20" stroke="#0e5b4d" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <text y="22" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No customer accounts found</text>
        <text y="40" class="chart-empty-sub" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Add customers to see health standing distribution</text>
      </g>
    </svg>`;
  }

  const plotX = 30;
  const plotY = 24;
  const barW = 400;
  const barH = 22;

  const categories = [
    { key: 'goodStanding', label: 'Good Standing', count: goodStanding.count || 0, percent: goodStanding.percent || 0, totalDue: 0, color: '#10b981' },
    { key: 'watchlist', label: 'Watchlist', count: watchlist.count || 0, percent: watchlist.percent || 0, totalDue: watchlist.totalDue || 0, color: '#f59e0b' },
    { key: 'delinquent', label: 'Delinquent', count: delinquent.count || 0, percent: delinquent.percent || 0, totalDue: delinquent.totalDue || 0, color: '#ef4444' },
    { key: 'offline', label: 'Offline', count: offline.count || 0, percent: offline.percent || 0, totalDue: offline.totalDue || 0, color: '#64748b' }
  ];

  let currentX = plotX;
  let segmentsSvg = '';

  categories.forEach((cat, idx) => {
    if (cat.count === 0) return;
    const isFirst = idx === 0 || currentX === plotX;
    const isLast = idx === categories.length - 1 || (currentX + (cat.count / totalTracked) * barW >= plotX + barW - 1);
    const segW = Math.max(6, (cat.count / totalTracked) * barW);

    segmentsSvg += `
      <rect x="${currentX}" y="${plotY}" width="${segW}" height="${barH}" fill="${cat.color}" rx="${isFirst || isLast ? 4 : 0}">
        <title>${cat.label}: ${cat.count} customers (${cat.percent}%) · Due: ${formatPKR(cat.totalDue)}</title>
      </rect>
    `;
    currentX += segW;
  });

  // Metric cards grid below the bar (2 rows of 2 columns)
  const gridStartX = 30;
  const colW = 195;
  const rowH = 56;
  const row1Y = 64;
  const row2Y = 126;

  const cardsSvg = categories.map((cat, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = gridStartX + col * (colW + 10);
    const y = row === 0 ? row1Y : row2Y;

    const subText = cat.key === 'goodStanding'
      ? 'Zero balance · up to date'
      : `${formatPKR(cat.totalDue)} total dues`;

    return `
      <g class="health-card-cell" transform="translate(${x}, ${y})" tabindex="0" role="graphics-symbol" aria-label="${cat.label}: ${cat.count} (${cat.percent}%), ${subText}">
        <rect width="${colW}" height="${rowH - 6}" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1" />
        <circle cx="16" cy="18" r="6" fill="${cat.color}" />
        <text x="30" y="21" font-family="'DM Sans', system-ui, sans-serif" font-size="11.5" font-weight="700" fill="var(--ink, #182e2a)">${cat.label}</text>
        <text x="${colW - 12}" y="22" text-anchor="end" font-family="Manrope, system-ui, sans-serif" font-size="13" font-weight="800" fill="${cat.color}">${cat.count} <tspan font-size="10" font-weight="600" fill="var(--muted, #71817c)">(${cat.percent}%)</tspan></text>
        <text x="30" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">${subText}</text>
      </g>
    `;
  }).join('');

  return `<svg class="chart-svg chart-health-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Customer Health and Delinquency Distribution Chart: ${goodStanding.count || 0} in good standing, ${watchlist.count || 0} in watchlist, ${delinquent.count || 0} delinquent, ${offline.count || 0} offline out of ${totalTracked} total subscribers">
    <g class="health-bar-container">
      <rect x="${plotX}" y="${plotY}" width="${barW}" height="${barH}" rx="4" fill="var(--line, #e2ece7)" />
      ${segmentsSvg}
    </g>
    ${cardsSvg}
    <text x="${width / 2}" y="${height - 6}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">Total ${totalTracked} tracked unarchived customer accounts</text>
  </svg>`;
}

/**
 * Generates an accessible, theme-aware pure SVG donut chart and legend
 * illustrating payment channel distribution (Cash vs Digital methods).
 */
export function renderPaymentMethodSvg(data, { width = 480, height = 240 } = {}) {
  if (!data || !Array.isArray(data.methods) || data.totalCount === 0 || data.totalAmount === 0) {
    return `<svg class="chart-svg chart-methods-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Payment Methods: No recorded payments for this period">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, ${height / 2 - 10})" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-12 -6 L12 -6 M-12 2 L12 2 M-6 10 L6 10" stroke="#0e5b4d" stroke-width="2" stroke-linecap="round" />
        <text y="28" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="600" fill="var(--ink, #182e2a)">No Payment Receipts Recorded</text>
        <text y="46" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">No receipts found for the selected time filter</text>
      </g>
    </svg>`;
  }

  const cx = 110;
  const cy = 110;
  const R = 72;
  const r = 44;
  const total = data.totalAmount;

  let cumulativeAngle = -Math.PI / 2;
  const slices = data.methods.map((m, idx) => {
    const fraction = total > 0 ? (m.amount / total) : 0;
    const angle = fraction * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    const x1 = cx + R * Math.cos(startAngle);
    const y1 = cy + R * Math.sin(startAngle);
    const x2 = cx + R * Math.cos(endAngle);
    const y2 = cy + R * Math.sin(endAngle);

    const ix1 = cx + r * Math.cos(endAngle);
    const iy1 = cy + r * Math.sin(endAngle);
    const ix2 = cx + r * Math.cos(startAngle);
    const iy2 = cy + r * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;
    const color = getMethodColor(m.method, idx);

    const pathD = fraction >= 0.999
      ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} L ${cx - 0.01} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy - r} Z`
      : `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;

    return {
      ...m,
      color,
      pathD
    };
  });

  const slicesSvg = slices.map(s => `
    <path class="donut-slice" d="${s.pathD}" fill="${s.color}" tabindex="0" role="graphics-symbol" aria-label="${escapeXml(s.method)}: ${formatPKR(s.amount)} (${s.percent}%, ${s.count} transactions)">
      <title>${escapeXml(s.method)}: ${formatPKR(s.amount)} (${s.percent}%, ${s.count} txs)</title>
    </path>
  `).join('');

  const legendX = 224;
  const visibleMethods = data.methods.slice(0, 5);
  const legendSvg = visibleMethods.map((m, idx) => {
    const y = 30 + idx * 36;
    const color = getMethodColor(m.method, idx);
    return `
      <g class="method-legend-row" transform="translate(${legendX}, ${y})" tabindex="0" role="graphics-symbol" aria-label="${escapeXml(m.method)}: ${formatPKR(m.amount)} (${m.percent}%)">
        <circle cx="6" cy="6" r="5" fill="${color}" />
        <text x="18" y="9" font-family="'DM Sans', system-ui, sans-serif" font-size="11.5" font-weight="600" fill="var(--ink, #182e2a)">${escapeXml(m.method)}</text>
        <text x="18" y="22" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">${m.count} tx${m.count === 1 ? '' : 's'} · avg ${formatPKR(m.avgAmount)}</text>
        <text x="${width - legendX - 12}" y="10" text-anchor="end" font-family="Manrope, system-ui, sans-serif" font-size="11.5" font-weight="700" fill="var(--ink, #182e2a)">${formatPKR(m.amount)}</text>
        <text x="${width - legendX - 12}" y="22" text-anchor="end" font-family="Manrope, system-ui, sans-serif" font-size="10" font-weight="600" fill="${color}">${m.percent}%</text>
      </g>
    `;
  }).join('');

  return `<svg class="chart-svg chart-methods-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Payment Methods Settlement Distribution: Total collected ${formatPKR(data.totalAmount)} across ${data.totalCount} receipts. Physical cash: ${data.cashPercent}%, digital mobile: ${data.digitalPercent}%">
    <g class="donut-slices-group">
      ${slicesSvg}
      <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="var(--surface, #ffffff)" />
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="12.5" font-weight="800" fill="var(--ink, #182e2a)">${formatPKR(data.totalAmount)}</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="var(--muted, #71817c)">${data.totalCount} receipt${data.totalCount === 1 ? '' : 's'}</text>
    </g>
    <g class="methods-legend-group">
      ${legendSvg}
    </g>
    <g class="methods-macro-split" transform="translate(18, ${height - 28})">
      <rect width="184" height="20" rx="4" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1" />
      <rect width="${Math.round(184 * (data.cashPercent / 100))}" height="20" rx="4" fill="#0e5b4d" opacity="0.85" />
      <text x="8" y="14" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${data.cashPercent > 30 ? '#ffffff' : 'var(--ink, #182e2a)'}">Cash ${data.cashPercent}%</text>
      <text x="176" y="14" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${data.digitalPercent > 30 ? 'var(--ink, #182e2a)' : 'var(--muted, #71817c)'}">Digital ${data.digitalPercent}%</text>
    </g>
    <text x="${width - 12}" y="${height - 14}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">Filter: ${escapeXml(data.period)}</text>
  </svg>`;
}

/**
 * Generates an accessible, theme-aware pure SVG semicircular risk gauge
 * and subscriber cohort breakdown for churn risk & retention forecast.
 */
export function renderChurnRiskGaugeSvg(riskData, { width = 480, height = 240 } = {}) {
  if (!riskData || riskData.totalCustomers === 0) {
    return `<svg class="chart-svg chart-churn-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Customer Retention and Churn Risk: No customer profiles">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, ${height / 2 - 10})" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-8 0 L8 0 M0 -8 L0 8" stroke="#0e5b4d" stroke-width="2" stroke-linecap="round" />
        <text y="28" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="600" fill="var(--ink, #182e2a)">No Customer Profiles in Ledger</text>
        <text y="46" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Add subscriber connections to view retention risk analytics</text>
      </g>
    </svg>`;
  }

  const cx = 115;
  const cy = 135;
  const R = 78;
  const r = 54;

  function arcPath(fStart, fEnd) {
    const a1 = Math.PI * (1 - fStart);
    const a2 = Math.PI * (1 - fEnd);

    const x1 = cx - R * Math.cos(fStart * Math.PI);
    const y1 = cy - R * Math.sin(fStart * Math.PI);
    const x2 = cx - R * Math.cos(fEnd * Math.PI);
    const y2 = cy - R * Math.sin(fEnd * Math.PI);

    const ix1 = cx - r * Math.cos(fEnd * Math.PI);
    const iy1 = cy - r * Math.sin(fEnd * Math.PI);
    const ix2 = cx - r * Math.cos(fStart * Math.PI);
    const iy2 = cy - r * Math.sin(fStart * Math.PI);

    return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 0 0 ${ix2} ${iy2} Z`;
  }

  const greenArc = arcPath(0, 0.15);
  const amberArc = arcPath(0.15, 0.35);
  const redArc = arcPath(0.35, 1.0);

  const score = Math.min(100, Math.max(0, riskData.churnRiskScore));
  const scoreFrac = score / 100;
  const pointerAngle = scoreFrac * Math.PI;
  const pointerX = cx - (R - 6) * Math.cos(pointerAngle);
  const pointerY = cy - (R - 6) * Math.sin(pointerAngle);

  let riskColor = '#10b981';
  if (riskData.riskTier === 'high') riskColor = '#ef4444';
  else if (riskData.riskTier === 'moderate') riskColor = '#f59e0b';

  const cardW = 224;
  const cardX = 236;

  return `<svg class="chart-svg chart-churn-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Customer Retention and Churn Risk Gauge: Score ${score}%, ${escapeXml(riskData.riskTierLabel)}. ${riskData.highRisk.count} high-risk accounts (${formatPKR(riskData.highRisk.totalDue)} dues), ${riskData.moderateRisk.count} moderate-risk accounts (${formatPKR(riskData.moderateRisk.totalDue)} dues)">
    <!-- Semicircle track zones -->
    <g class="gauge-zones">
      <path d="${greenArc}" fill="#10b981" opacity="0.85">
        <title>Healthy &amp; Low Risk (0-15%)</title>
      </path>
      <path d="${amberArc}" fill="#f59e0b" opacity="0.85">
        <title>Moderate Risk (15-35%)</title>
      </path>
      <path d="${redArc}" fill="#ef4444" opacity="0.85">
        <title>High Delinquency Risk (35-100%)</title>
      </path>
    </g>

    <!-- Gauge needle pointer -->
    <g class="gauge-pointer">
      <line x1="${cx}" y1="${cy}" x2="${pointerX}" y2="${pointerY}" stroke="var(--ink, #182e2a)" stroke-width="3" stroke-linecap="round" />
      <circle cx="${cx}" cy="${cy}" r="6" fill="var(--ink, #182e2a)" />
      <circle cx="${pointerX}" cy="${pointerY}" r="4" fill="${riskColor}" stroke="var(--surface, #ffffff)" stroke-width="1.5" />
    </g>

    <!-- Center readout -->
    <g class="gauge-center-text" text-anchor="middle">
      <text x="${cx}" y="${cy - 10}" font-family="Manrope, system-ui, sans-serif" font-size="22" font-weight="800" fill="${riskColor}">${score}%</text>
      <text x="${cx}" y="${cy + 8}" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${riskColor}">${escapeXml(riskData.riskTierLabel)}</text>
      <text x="${cx}" y="${cy + 24}" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" fill="var(--muted, #71817c)">Weighted Risk Score</text>
    </g>

    <!-- Right cohort summary cards -->
    <g class="churn-cohort-cards" transform="translate(${cardX}, 18)">
      <!-- High Risk -->
      <g class="cohort-card cohort-high" tabindex="0" role="graphics-symbol" aria-label="High Risk: ${riskData.highRisk.count} accounts (${riskData.highRisk.percent}%), ${formatPKR(riskData.highRisk.totalDue)} overdue">
        <rect width="${cardW}" height="42" rx="6" fill="rgba(239, 68, 68, 0.08)" stroke="rgba(239, 68, 68, 0.25)" stroke-width="1" />
        <circle cx="14" cy="21" r="5" fill="#ef4444" />
        <text x="26" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="#b91c1c">High Risk</text>
        <text x="26" y="32" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">Dues: ${formatPKR(riskData.highRisk.totalDue)}</text>
        <text x="${cardW - 10}" y="24" text-anchor="end" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="#b91c1c">${riskData.highRisk.count} <tspan font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">(${riskData.highRisk.percent}%)</tspan></text>
      </g>

      <!-- Moderate Risk -->
      <g class="cohort-card cohort-mod" transform="translate(0, 48)" tabindex="0" role="graphics-symbol" aria-label="Moderate Risk: ${riskData.moderateRisk.count} accounts (${riskData.moderateRisk.percent}%), ${formatPKR(riskData.moderateRisk.totalDue)} dues">
        <rect width="${cardW}" height="42" rx="6" fill="rgba(245, 158, 11, 0.08)" stroke="rgba(245, 158, 11, 0.25)" stroke-width="1" />
        <circle cx="14" cy="21" r="5" fill="#f59e0b" />
        <text x="26" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="#b45309">Moderate Risk</text>
        <text x="26" y="32" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">Dues: ${formatPKR(riskData.moderateRisk.totalDue)}</text>
        <text x="${cardW - 10}" y="24" text-anchor="end" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="#b45309">${riskData.moderateRisk.count} <tspan font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">(${riskData.moderateRisk.percent}%)</tspan></text>
      </g>

      <!-- Healthy -->
      <g class="cohort-card cohort-low" transform="translate(0, 96)" tabindex="0" role="graphics-symbol" aria-label="Healthy Accounts: ${riskData.lowRisk.count} (${riskData.lowRisk.percent}%)">
        <rect width="${cardW}" height="42" rx="6" fill="rgba(16, 185, 129, 0.08)" stroke="rgba(16, 185, 129, 0.25)" stroke-width="1" />
        <circle cx="14" cy="21" r="5" fill="#10b981" />
        <text x="26" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="#047857">Healthy Retained</text>
        <text x="26" y="32" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">Zero overdue balance</text>
        <text x="${cardW - 10}" y="24" text-anchor="end" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="#047857">${riskData.lowRisk.count} <tspan font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">(${riskData.lowRisk.percent}%)</tspan></text>
      </g>

      <!-- At-Risk Revenue Callout -->
      <g transform="translate(0, 146)">
        <text x="0" y="14" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">Total Revenue at Risk:</text>
        <text x="${cardW}" y="14" text-anchor="end" font-family="Manrope, system-ui, sans-serif" font-size="11.5" font-weight="800" fill="#b91c1c">${formatPKR(riskData.atRiskRevenue)}</text>
      </g>
    </g>

    <!-- Bottom subtitle -->
    <text x="115" y="${height - 12}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">Based on offline service &amp; consecutive dues</text>
  </svg>`;
}

/**
 * Renders an accessible, theme-aware pure SVG geographic collection heatmap.
 * Shows operational recovery status chips, area recovery progress tracks,
 * collected vs billed metrics, and outstanding dues.
 */
export function renderAreaCollectionHeatmapSvg(heatmapData, { filter = 'all', width = 520, height = 270 } = {}) {
  if (!heatmapData || !Array.isArray(heatmapData.areas) || heatmapData.areas.length === 0) {
    return `<svg class="chart-svg chart-heatmap-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Geographic Collection Heatmap: No area data available">
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="12" fill="var(--muted, #71817c)">No area collection data recorded for this period.</text>
    </svg>`;
  }

  const { areas, summary } = heatmapData;
  const visibleAreas = areas.filter(a => filter === 'all' || a.tier === filter);

  const headerY = 16;
  const pillW = Math.floor((width - 40) / 3);

  // Status Summary Chips at top
  const headerMarkup = `
    <g class="heatmap-summary-chips" transform="translate(10, ${headerY})">
      <!-- Optimal Chip -->
      <g transform="translate(0, 0)">
        <rect width="${pillW}" height="28" rx="6" fill="rgba(16, 185, 129, 0.08)" stroke="rgba(16, 185, 129, 0.28)" stroke-width="1"/>
        <circle cx="12" cy="14" r="4" fill="#10b981"/>
        <text x="22" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">Optimal: <tspan fill="#047857">${summary.highRecoveryCount}</tspan></text>
      </g>
      <!-- Moderate Chip -->
      <g transform="translate(${pillW + 10}, 0)">
        <rect width="${pillW}" height="28" rx="6" fill="rgba(245, 158, 11, 0.08)" stroke="rgba(245, 158, 11, 0.28)" stroke-width="1"/>
        <circle cx="12" cy="14" r="4" fill="#f59e0b"/>
        <text x="22" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">Moderate: <tspan fill="#b45309">${summary.moderateRecoveryCount}</tspan></text>
      </g>
      <!-- Lagging Chip -->
      <g transform="translate(${(pillW + 10) * 2}, 0)">
        <rect width="${pillW}" height="28" rx="6" fill="rgba(239, 68, 68, 0.08)" stroke="rgba(239, 68, 68, 0.28)" stroke-width="1"/>
        <circle cx="12" cy="14" r="4" fill="#ef4444"/>
        <text x="22" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">Lagging: <tspan fill="#b91c1c">${summary.laggingCount}</tspan></text>
      </g>
    </g>
  `;

  if (visibleAreas.length === 0) {
    return `<svg class="chart-svg chart-heatmap-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Geographic Collection Heatmap: No matching areas">
      ${headerMarkup}
      <text x="${width / 2}" y="${height / 2 + 20}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="12" fill="var(--muted, #71817c)">No operational areas match the "${escapeXml(filter)}" recovery filter.</text>
    </svg>`;
  }

  const displayAreas = visibleAreas.slice(0, 5);
  const rowStartY = 58;
  const rowHeight = 36;
  const barX = 140;
  const barWidth = width - barX - 110;

  const rowsMarkup = displayAreas.map((item, idx) => {
    const y = rowStartY + idx * rowHeight;
    const ratePercent = Math.min(100, Math.max(0, item.recoveryRate));
    const fillW = Math.round((ratePercent / 100) * barWidth);

    return `
      <g class="heatmap-area-row" transform="translate(10, ${y})" tabindex="0" role="graphics-symbol" aria-label="${escapeXml(item.area)}: Recovery ${item.recoveryRate}%, Collected ${formatPKR(item.collected)} of ${formatPKR(item.billed)}, Total Due ${formatPKR(item.totalDue)}">
        <!-- Area Title and Sub Count -->
        <text x="0" y="14" font-family="'DM Sans', system-ui, sans-serif" font-size="11.5" font-weight="700" fill="var(--ink, #182e2a)">${escapeXml(item.area)}</text>
        <text x="0" y="27" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">${item.customerCount} subs (${item.activeCount} active)</text>

        <!-- Progress Track and Heat Fill -->
        <g transform="translate(${barX}, 6)">
          <rect width="${barWidth}" height="10" rx="5" fill="var(--surface-sunken, #e2ece7)" opacity="0.8"/>
          ${fillW > 0 ? `<rect width="${fillW}" height="10" rx="5" fill="${item.heatColor}"/>` : ''}
          <text x="0" y="21" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">Coll: ${formatPKR(item.collected)} / ${formatPKR(item.billed)}</text>
          ${item.totalDue > 0 ? `<text x="${barWidth}" y="21" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="#b91c1c">Due: ${formatPKR(item.totalDue)}</text>` : ''}
        </g>

        <!-- Recovery Rate & Tier Badge -->
        <g transform="translate(${width - 20}, 14)">
          <text x="0" y="0" text-anchor="end" font-family="Manrope, system-ui, sans-serif" font-size="12.5" font-weight="800" fill="${item.heatColor}">${item.recoveryRate}%</text>
          <text x="0" y="13" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${item.heatColor}">${escapeXml(item.tierLabel.split(' ')[0])}</text>
        </g>
      </g>
    `;
  }).join('');

  const footerY = height - 12;
  const footerText = `Overall Collection Efficiency: ${summary.overallRecoveryRate}% · ${summary.totalAreas} Operational Zones`;

  return `<svg class="chart-svg chart-heatmap-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Geographic Collection Heatmap: Overall recovery ${summary.overallRecoveryRate}%, ${summary.highRecoveryCount} optimal, ${summary.moderateRecoveryCount} moderate, ${summary.laggingCount} lagging zones">
    ${headerMarkup}
    ${rowsMarkup}
    <text x="${width / 2}" y="${footerY}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">${escapeXml(footerText)}</text>
  </svg>`;
}

/**
 * Calculates multi-year seasonal cashflow comparison across 12 calendar months (Jan-Dec)
 * comparing the current year against the prior year (or custom years).
 * Evaluates monthly collections or billed amounts, YoY growth deltas, and seasonal indices.
 */
export function calculateSeasonalCashflowComparison(state, referenceDate = new Date(), options = {}) {
  const metric = options.metric === 'billed' ? 'billed' : 'collections';
  const refYear = (referenceDate instanceof Date && !isNaN(referenceDate.getTime()))
    ? referenceDate.getFullYear()
    : new Date().getFullYear();
  const currentYear = options.currentYear ?? refYear;
  const priorYear = options.priorYear ?? (currentYear - 1);
  const currentMonthIdx = (referenceDate instanceof Date && !isNaN(referenceDate.getTime()))
    ? referenceDate.getMonth()
    : 11;

  const months = MONTH_SHORT_NAMES.map((name, idx) => ({
    monthIndex: idx,
    monthName: name,
    currentYearAmount: 0,
    currentYearCount: 0,
    priorYearAmount: 0,
    priorYearCount: 0,
    yoyGrowthPercent: null,
    seasonalIndex: 100
  }));

  if (metric === 'collections') {
    const txs = listTransactions(state, { recencyDays: null }, referenceDate);
    for (const t of txs) {
      const amt = Number(t.amount) || 0;
      if (amt <= 0 || !t.date || typeof t.date !== 'string') continue;
      const y = parseInt(t.date.slice(0, 4), 10);
      const mIdx = parseInt(t.date.slice(5, 7), 10) - 1;
      if (isNaN(y) || isNaN(mIdx) || mIdx < 0 || mIdx > 11) continue;

      if (y === currentYear) {
        months[mIdx].currentYearAmount += amt;
        months[mIdx].currentYearCount++;
      } else if (y === priorYear) {
        months[mIdx].priorYearAmount += amt;
        months[mIdx].priorYearCount++;
      }
    }
  } else {
    for (const c of (state?.customers ?? [])) {
      if (c.archived) continue;
      const billList = Array.isArray(c.bills) ? c.bills : (c.bills ? Object.values(c.bills) : []);
      for (const bill of billList) {
        const amt = Number(bill?.dueAmount) || 0;
        if (amt <= 0 || !bill?.month || typeof bill.month !== 'string') continue;
        const y = parseInt(bill.month.slice(0, 4), 10);
        const mIdx = parseInt(bill.month.slice(5, 7), 10) - 1;
        if (isNaN(y) || isNaN(mIdx) || mIdx < 0 || mIdx > 11) continue;

        if (y === currentYear) {
          months[mIdx].currentYearAmount += amt;
          months[mIdx].currentYearCount++;
        } else if (y === priorYear) {
          months[mIdx].priorYearAmount += amt;
          months[mIdx].priorYearCount++;
        }
      }
    }
  }

  let currentYearYtdTotal = 0;
  let priorYearYtdTotal = 0;
  let currentYearAnnualTotal = 0;
  let priorYearAnnualTotal = 0;

  for (let i = 0; i < 12; i++) {
    const m = months[i];
    currentYearAnnualTotal += m.currentYearAmount;
    priorYearAnnualTotal += m.priorYearAmount;

    if (i <= currentMonthIdx) {
      currentYearYtdTotal += m.currentYearAmount;
      priorYearYtdTotal += m.priorYearAmount;
    }

    if (m.priorYearAmount > 0) {
      m.yoyGrowthPercent = Math.round(((m.currentYearAmount - m.priorYearAmount) / m.priorYearAmount) * 1000) / 10;
    } else if (m.currentYearAmount > 0) {
      m.yoyGrowthPercent = 100;
    } else {
      m.yoyGrowthPercent = null;
    }
  }

  const activeElapsedMonths = Math.max(currentMonthIdx + 1, 1);
  const avgMonthlyRunRate = currentYearYtdTotal / activeElapsedMonths;

  for (let i = 0; i < 12; i++) {
    const m = months[i];
    m.seasonalIndex = avgMonthlyRunRate > 0
      ? Math.round((m.currentYearAmount / avgMonthlyRunRate) * 100)
      : 100;
  }

  let ytdGrowthPercent = null;
  if (priorYearYtdTotal > 0) {
    ytdGrowthPercent = Math.round(((currentYearYtdTotal - priorYearYtdTotal) / priorYearYtdTotal) * 1000) / 10;
  } else if (currentYearYtdTotal > 0) {
    ytdGrowthPercent = 100;
  }

  let peakMonth = null;
  let maxAmt = -1;
  for (let i = 0; i <= currentMonthIdx; i++) {
    if (months[i].currentYearAmount > maxAmt && months[i].currentYearAmount > 0) {
      maxAmt = months[i].currentYearAmount;
      peakMonth = months[i];
    }
  }

  let troughMonth = null;
  let minAmt = Infinity;
  for (let i = 0; i <= currentMonthIdx; i++) {
    if (months[i].currentYearAmount > 0 && months[i].currentYearAmount < minAmt) {
      minAmt = months[i].currentYearAmount;
      troughMonth = months[i];
    }
  }

  let velocityStatus = 'Baseline Period';
  if (priorYearYtdTotal > 0) {
    if (ytdGrowthPercent >= 10) velocityStatus = 'Accelerating';
    else if (ytdGrowthPercent >= 0) velocityStatus = 'Stable Growth';
    else velocityStatus = 'Contraction';
  }

  return {
    metric,
    currentYear,
    priorYear,
    currentMonthIndex: currentMonthIdx,
    months,
    currentYearYtdTotal,
    priorYearYtdTotal,
    currentYearAnnualTotal,
    priorYearAnnualTotal,
    ytdGrowthPercent,
    peakMonth,
    troughMonth,
    velocityStatus,
    hasPriorYearData: priorYearAnnualTotal > 0,
    hasCurrentYearData: currentYearAnnualTotal > 0
  };
}

/**
 * Renders an accessible, theme-aware dual-series SVG line chart comparing
 * seasonal cashflow trajectories between current and prior years across Jan-Dec.
 */
export function renderSeasonalCashflowSvg(seasonalData, options = {}) {
  const width = 600;
  const height = 240;
  const padding = { top: 40, right: 30, bottom: 42, left: 65 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  if (!seasonalData || (!seasonalData.hasCurrentYearData && !seasonalData.hasPriorYearData)) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Seasonal Cashflow Comparison: No historical multi-year records">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, ${height / 2 - 12})" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-10 -4 L-4 -14 L4 -8 L10 -20" stroke="#0e5b4d" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No seasonal cashflow history yet</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Comparative YoY velocity curves will populate as payments across calendar cycles are logged</text>
      </g>
    </svg>`;
  }

  const allAmounts = seasonalData.months.flatMap(m => [m.currentYearAmount, m.priorYearAmount]);
  const rawMax = Math.max(...allAmounts, 1000);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const maxVal = Math.ceil(rawMax / magnitude) * magnitude;

  const getX = (idx) => padding.left + (idx / 11) * plotWidth;
  const getY = (val) => padding.top + plotHeight - (val / maxVal) * plotHeight;

  const gridTicks = [
    { val: maxVal, y: getY(maxVal), label: formatPKR(maxVal) },
    { val: maxVal / 2, y: getY(maxVal / 2), label: formatPKR(maxVal / 2) },
    { val: 0, y: getY(0), label: '0' }
  ];

  const gridLines = gridTicks.map(t => `
    <line x1="${padding.left}" y1="${t.y}" x2="${width - padding.right}" y2="${t.y}" stroke="var(--border, rgba(0,0,0,0.08))" stroke-dasharray="3,3" />
    <text x="${padding.left - 8}" y="${t.y + 4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">${t.label}</text>
  `).join('');

  const xLabels = seasonalData.months.map((m, idx) => `
    <text x="${getX(idx)}" y="${height - 18}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="${idx === seasonalData.currentMonthIndex ? '700' : '500'}" fill="${idx === seasonalData.currentMonthIndex ? 'var(--green, #0e5b4d)' : 'var(--muted, #71817c)'}">${m.monthName}</text>
  `).join('');

  let priorYearSvg = '';
  if (seasonalData.hasPriorYearData) {
    const priorPoints = seasonalData.months.map((m, idx) => `${getX(idx).toFixed(1)},${getY(m.priorYearAmount).toFixed(1)}`).join(' ');
    const priorDots = seasonalData.months.map((m, idx) => `
      <circle cx="${getX(idx).toFixed(1)}" cy="${getY(m.priorYearAmount).toFixed(1)}" r="3" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5">
        <title>${m.monthName} ${seasonalData.priorYear}: ${formatPKR(m.priorYearAmount)}</title>
      </circle>
    `).join('');
    priorYearSvg = `
      <polyline points="${priorPoints}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4,4" />
      ${priorDots}
    `;
  }

  const activeMonths = seasonalData.months.slice(0, seasonalData.currentMonthIndex + 1);
  const currentPoints = activeMonths.map((m, idx) => `${getX(idx).toFixed(1)},${getY(m.currentYearAmount).toFixed(1)}`).join(' ');
  const areaPoints = `${getX(0).toFixed(1)},${getY(0).toFixed(1)} ${currentPoints} ${getX(activeMonths.length - 1).toFixed(1)},${getY(0).toFixed(1)}`;

  const currentDots = activeMonths.map((m, idx) => `
    <circle cx="${getX(idx).toFixed(1)}" cy="${getY(m.currentYearAmount).toFixed(1)}" r="4" fill="#0e5b4d" stroke="#ffffff" stroke-width="2">
      <title>${m.monthName} ${seasonalData.currentYear}: ${formatPKR(m.currentYearAmount)} (${m.currentYearCount} txs)${m.yoyGrowthPercent !== null ? ` | YoY: ${m.yoyGrowthPercent > 0 ? '+' : ''}${m.yoyGrowthPercent}%` : ''}</title>
    </circle>
  `).join('');

  let peakCallout = '';
  if (seasonalData.peakMonth && seasonalData.peakMonth.currentYearAmount > 0) {
    const peakX = getX(seasonalData.peakMonth.monthIndex);
    const peakY = getY(seasonalData.peakMonth.currentYearAmount);
    const calloutY = Math.max(peakY - 14, padding.top - 10);
    peakCallout = `
      <g transform="translate(${peakX}, ${calloutY})" text-anchor="middle">
        <rect x="-42" y="-12" width="84" height="15" rx="3.5" fill="#0e5b4d" />
        <text y="-2" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#ffffff">Peak: ${seasonalData.peakMonth.monthName} (${formatPKR(seasonalData.peakMonth.currentYearAmount)})</text>
      </g>
    `;
  }

  const ytdStr = seasonalData.ytdGrowthPercent !== null
    ? `${seasonalData.ytdGrowthPercent >= 0 ? '+' : ''}${seasonalData.ytdGrowthPercent}%`
    : 'N/A';

  return `<svg class="chart-svg seasonal-chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Seasonal Cashflow Trend: ${seasonalData.currentYear} vs ${seasonalData.priorYear}">
    <defs>
      <linearGradient id="seasonalGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0e5b4d" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#0e5b4d" stop-opacity="0.0" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(${padding.left}, 20)" font-family="'DM Sans', system-ui, sans-serif" font-size="10">
      <circle cx="5" cy="-3" r="4" fill="#0e5b4d" />
      <text x="14" y="0" font-weight="700" fill="var(--ink, #182e2a)">${seasonalData.currentYear} YTD: ${formatPKR(seasonalData.currentYearYtdTotal)}</text>

      ${seasonalData.hasPriorYearData ? `
        <line x1="170" y1="-3" x2="190" y2="-3" stroke="#94a3b8" stroke-width="2" stroke-dasharray="3,3" />
        <circle cx="180" cy="-3" r="2.5" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" />
        <text x="196" y="0" fill="var(--muted, #71817c)">${seasonalData.priorYear} YTD: ${formatPKR(seasonalData.priorYearYtdTotal)}</text>
      ` : ''}

      <text x="${plotWidth}" y="0" text-anchor="end" font-weight="700" fill="${seasonalData.velocityStatus === 'Accelerating' ? '#047857' : (seasonalData.velocityStatus === 'Contraction' ? '#b91c1c' : '#b45309')}">
        YoY: ${ytdStr} (${seasonalData.velocityStatus})
      </text>
    </g>

    ${gridLines}
    ${priorYearSvg}
    <polygon points="${areaPoints}" fill="url(#seasonalGrad)" />
    <polyline points="${currentPoints}" fill="none" stroke="#0e5b4d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    ${currentDots}
    ${peakCallout}
    ${xLabels}
  </svg>`;
}

/**
 * Analyzes subscriber package portfolio profitability, direct upstream bandwidth cost,
 * and net gross profit margins across active customer profiles.
 * Supports simulation parameters (e.g. custom wholesale transit cost per Mbps or retail price delta).
 */
export function calculatePackageMarginBreakdown(state, options = {}) {
  const costPerMbps = Number(options.costPerMbps ?? currentMarginCostPerMbps) || 50;
  const simulatedMultiplier = Number(options.simulatedMultiplier ?? 1.0) || 1.0;
  const retailPriceDeltaPercent = Number(options.retailPriceDeltaPercent ?? 0) || 0;
  const customPackageCosts = options.customPackageCosts ?? {};

  const map = new Map();
  let totalSubscribers = 0;
  let totalRevenue = 0;
  let totalUpstreamCost = 0;

  for (const c of (state?.customers ?? [])) {
    if (c.archived) continue;
    totalSubscribers++;

    const pkgName = (c.packageSpeed && String(c.packageSpeed).trim())
      ? String(c.packageSpeed).trim()
      : 'Unassigned';

    let speedMbps = 5;
    const speedMatch = pkgName.match(/(\d+(?:\.\d+)?)\s*(?:Mbps|M\b|G\b)/i);
    if (speedMatch) {
      speedMbps = parseFloat(speedMatch[1]);
    } else if (pkgName.toLowerCase().includes('3mbps')) {
      speedMbps = 3;
    } else if (pkgName.toLowerCase().includes('15mbps')) {
      speedMbps = 15;
    }

    let retailPrice = Number(c.monthlySellingAmount) || 0;
    if (retailPriceDeltaPercent !== 0) {
      retailPrice = Math.round(retailPrice * (1 + retailPriceDeltaPercent / 100));
    }

    let upstreamCost = 0;
    if (customPackageCosts[pkgName] != null) {
      upstreamCost = Number(customPackageCosts[pkgName]) * simulatedMultiplier;
    } else if (c.monthlyPurchaseCost && Number(c.monthlyPurchaseCost) > 0) {
      upstreamCost = Number(c.monthlyPurchaseCost) * simulatedMultiplier;
    } else {
      upstreamCost = Math.round(speedMbps * costPerMbps * simulatedMultiplier);
    }

    if (!map.has(pkgName)) {
      map.set(pkgName, {
        packageName: pkgName,
        speedMbps,
        subscriberCount: 0,
        activeCount: 0,
        totalRevenue: 0,
        totalUpstreamCost: 0,
        grossProfit: 0,
        grossMarginPercent: 0,
        arpu: 0,
        avgCostPerSub: 0
      });
    }

    const item = map.get(pkgName);
    item.subscriberCount++;
    if (c.serviceStatus === 'active') item.activeCount++;
    item.totalRevenue += retailPrice;
    item.totalUpstreamCost += upstreamCost;

    totalRevenue += retailPrice;
    totalUpstreamCost += upstreamCost;
  }

  const packages = [...map.values()].map(p => {
    const grossProfit = p.totalRevenue - p.totalUpstreamCost;
    const grossMarginPercent = p.totalRevenue > 0
      ? Math.round((grossProfit / p.totalRevenue) * 100)
      : 0;
    const arpu = p.subscriberCount > 0
      ? Math.round(p.totalRevenue / p.subscriberCount)
      : 0;
    const avgCostPerSub = p.subscriberCount > 0
      ? Math.round(p.totalUpstreamCost / p.subscriberCount)
      : 0;

    return {
      ...p,
      grossProfit,
      grossMarginPercent,
      arpu,
      avgCostPerSub
    };
  }).sort((a, b) => b.grossProfit - a.grossProfit || b.subscriberCount - a.subscriberCount);

  const totalGrossProfit = totalRevenue - totalUpstreamCost;
  const blendedMarginPercent = totalRevenue > 0
    ? Math.round((totalGrossProfit / totalRevenue) * 100)
    : 0;

  const topMarginPackage = packages.length > 0 ? packages[0] : null;
  const tightestMarginPackage = packages.length > 0
    ? [...packages].sort((a, b) => a.grossMarginPercent - b.grossMarginPercent)[0]
    : null;

  return {
    costPerMbps,
    simulatedMultiplier,
    retailPriceDeltaPercent,
    totalSubscribers,
    totalRevenue,
    totalUpstreamCost,
    totalGrossProfit,
    blendedMarginPercent,
    topMarginPackage,
    tightestMarginPackage,
    packages
  };
}

/**
 * Simulates financial margin impacts of upstream wholesale bandwidth rate changes
 * or retail price revisions against baseline package distributions.
 */
export function simulateMarginAdjustment(state, { costPerMbps = 50, simulatedMultiplier = 1.0, retailPriceDeltaPercent = 0 } = {}) {
  const baseline = calculatePackageMarginBreakdown(state, { costPerMbps: 50, simulatedMultiplier: 1.0, retailPriceDeltaPercent: 0 });
  const simulated = calculatePackageMarginBreakdown(state, { costPerMbps, simulatedMultiplier, retailPriceDeltaPercent });

  const monthlyProfitDelta = simulated.totalGrossProfit - baseline.totalGrossProfit;
  const annualizedImpact = monthlyProfitDelta * 12;
  const marginDeltaPercent = simulated.blendedMarginPercent - baseline.blendedMarginPercent;

  return {
    baseline,
    simulated,
    monthlyProfitDelta,
    annualizedImpact,
    marginDeltaPercent
  };
}

/**
 * Renders an accessible pure SVG horizontal stacked bar chart showing
 * wholesale transit cost vs gross profit margin contribution across top packages.
 */
export function renderPackageMarginSvg(marginData, options = {}) {
  const width = 560;
  const rowHeight = 36;
  const topPad = 32;
  const bottomPad = 48;
  const maxPkgs = 5;
  const displayPackages = (marginData?.packages ?? []).slice(0, maxPkgs);
  const height = topPad + Math.max(displayPackages.length, 1) * rowHeight + bottomPad;

  if (!marginData || marginData.totalSubscribers === 0 || displayPackages.length === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} 220" width="100%" height="auto" role="img" aria-label="Package Margin & Bandwidth Cost: No subscribers configured">
      <rect width="${width}" height="220" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 98)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-10 6 L10 6 M-6 -4 L6 -4 M-2 -14 L2 -14" stroke="#0e5b4d" stroke-width="2" stroke-linecap="round" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No package distribution data</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Margin optimization metrics will appear once customer package plans are assigned</text>
      </g>
    </svg>`;
  }

  const barX = 175;
  const barMaxW = 240;
  const maxRevenue = Math.max(...displayPackages.map(p => p.totalRevenue), 1);

  const rows = displayPackages.map((pkg, idx) => {
    const y = topPad + idx * rowHeight;
    const totalW = Math.max((pkg.totalRevenue / maxRevenue) * barMaxW, 10);
    const costRatio = pkg.totalRevenue > 0 ? (pkg.totalUpstreamCost / pkg.totalRevenue) : 0;
    const costW = Math.min(Math.max(totalW * costRatio, 2), totalW - 2);
    const marginW = totalW - costW;

    return `
      <g class="margin-row" transform="translate(0, ${y})">
        <text x="165" y="18" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="600" fill="var(--ink, #182e2a)">
          ${escapeXml(pkg.packageName)} <tspan font-weight="400" fill="var(--muted, #71817c)">(${pkg.subscriberCount})</tspan>
        </text>

        <rect x="${barX}" y="6" width="${costW}" height="18" rx="3" fill="#f87171">
          <title>${escapeXml(pkg.packageName)}: Upstream Transit Cost ${formatPKR(pkg.totalUpstreamCost)}</title>
        </rect>

        <rect x="${barX + costW}" y="6" width="${marginW}" height="18" rx="3" fill="#10b981">
          <title>${escapeXml(pkg.packageName)}: Gross Profit ${formatPKR(pkg.grossProfit)} (${pkg.grossMarginPercent}% margin)</title>
        </rect>

        <text x="${barX + totalW + 10}" y="19" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${pkg.grossMarginPercent >= 50 ? '#047857' : (pkg.grossMarginPercent >= 30 ? '#b45309' : '#b91c1c')}">
          ${pkg.grossMarginPercent}% · ${formatPKR(pkg.grossProfit)}
        </text>
      </g>
    `;
  }).join('');

  const footerY = height - 16;

  return `<svg class="chart-svg margin-chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Package Margin and Bandwidth Cost Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(175, 18)" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5">
      <rect x="0" y="-8" width="10" height="10" rx="2" fill="#f87171" />
      <text x="14" y="0" fill="var(--muted, #71817c)">Upstream Cost (${formatPKR(marginData.totalUpstreamCost)})</text>

      <rect x="155" y="-8" width="10" height="10" rx="2" fill="#10b981" />
      <text x="169" y="0" font-weight="600" fill="var(--ink, #182e2a)">Gross Profit (${formatPKR(marginData.totalGrossProfit)})</text>
    </g>

    ${rows}

    <g transform="translate(${width / 2}, ${footerY})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">
        Blended Margin: <tspan font-weight="700" fill="var(--ink, #182e2a)">${marginData.blendedMarginPercent}%</tspan> · Total Gross Margin: <tspan font-weight="700" fill="#047857">${formatPKR(marginData.totalGrossProfit)}/mo</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders an accessible pure SVG chart displaying Customer Lifetime Value (LTV)
 * and retention progression across subscriber tenure cohorts.
 */
export function renderCustomerLtvCohortsSvg(ltvData, { metric = currentLtvMetric } = {}) {
  const width = 560;
  const height = 240;

  if (!ltvData || ltvData.totalTrackedCustomers === 0 || ltvData.overallTotalLtv === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Customer Lifetime Value Cohorts: No payment data">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 105)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-8 4 L-2 -2 L4 4 L10 -4" stroke="#0e5b4d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No customer payment history recorded</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">LTV cohort analytics will display once customer receipts are registered</text>
      </g>
    </svg>`;
  }

  const isAvg = metric === 'averageLtv';
  const cohorts = ltvData.cohorts ?? [];
  const maxVal = Math.max(...cohorts.map(c => isAvg ? c.averageLtv : c.totalLtv), 1);

  const topPad = 38;
  const rowHeight = 32;
  const labelX = 140;
  const barX = 150;
  const barMaxW = 230;

  const rows = cohorts.map((c, idx) => {
    const y = topPad + idx * rowHeight;
    const val = isAvg ? c.averageLtv : c.totalLtv;
    const barW = Math.max(Math.round((val / maxVal) * barMaxW), val > 0 ? 6 : 0);

    const retColor = c.retentionRate >= 80 ? '#10b981' : (c.retentionRate >= 50 ? '#f59e0b' : '#ef4444');

    return `
      <g class="ltv-cohort-row" transform="translate(0, ${y})">
        <text x="${labelX}" y="15" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--ink, #182e2a)">
          ${escapeXml(c.label)} <tspan font-weight="400" font-size="10" fill="var(--muted, #71817c)">(${c.customerCount})</tspan>
        </text>

        <rect x="${barX}" y="4" width="${barMaxW}" height="16" rx="4" fill="rgba(14, 91, 77, 0.06)" />

        <rect x="${barX}" y="4" width="${barW}" height="16" rx="4" fill="url(#ltvBarGrad)">
          <title>${escapeXml(c.label)}: ${isAvg ? 'Avg LTV' : 'Total Revenue'} ${formatPKR(val)} · ${c.retentionRate}% Active (${c.activeCount}/${c.customerCount})</title>
        </rect>

        <text x="${barX + barW + 8}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">
          ${formatPKR(val)}
        </text>

        <rect x="${width - 80}" y="3" width="48" height="18" rx="9" fill="${retColor}" fill-opacity="0.15" />
        <text x="${width - 56}" y="15" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${retColor}">
          ${c.retentionRate}% ret
        </text>
      </g>
    `;
  }).join('');

  const footerY = height - 14;

  return `<svg class="chart-svg ltv-chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Customer Lifetime Value Cohorts Chart">
    <defs>
      <linearGradient id="ltvBarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0e5b4d" />
        <stop offset="100%" stop-color="#10b981" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(150, 20)" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5">
      <text x="0" y="0" font-weight="600" fill="var(--muted, #71817c)">
        Mode: <tspan fill="var(--ink, #182e2a)">${isAvg ? 'Average Customer LTV' : 'Total Cohort Revenue'}</tspan>
      </text>
      <text x="${width - 240}" y="0" text-anchor="end" font-weight="600" fill="var(--muted, #71817c)">
        Multiplier: <tspan font-weight="700" fill="#0e5b4d">${ltvData.ltvMultiplier}x ARPU</tspan>
      </text>
    </g>

    ${rows}

    <g transform="translate(${width / 2}, ${footerY})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">
        Avg LTV: <tspan font-weight="700" fill="var(--ink, #182e2a)">${formatPKR(ltvData.overallAverageLtv)}</tspan> · Avg Tenure: <tspan font-weight="700" fill="var(--ink, #182e2a)">${ltvData.overallAverageTenure} mos</tspan> · Total Portfolio Value: <tspan font-weight="700" fill="#047857">${formatPKR(ltvData.overallTotalLtv)}</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders an accessible pure SVG chart displaying operational incident frequency,
 * MTTR metrics, and active outages across network areas.
 */
export function renderIncidentImpactSvg(matrixData) {
  const width = 560;
  const height = 240;

  if (!matrixData || matrixData.totalRecordedIncidents === 0 || (matrixData.areaBreakdown ?? []).length === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Network Incident and Outage Matrix: No incidents logged">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 105)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(16, 185, 129, 0.08)" />
        <path d="M-8 -14 L-2 -8 L8 -18" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">Zero network incidents logged</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">All subscriber connections are healthy with zero open or historical outages</text>
      </g>
    </svg>`;
  }

  const topAreas = (matrixData.areaBreakdown ?? []).slice(0, 5);
  const maxIncidents = Math.max(...topAreas.map(a => a.totalIncidents), 1);

  const topPad = 38;
  const rowHeight = 32;
  const labelX = 140;
  const barX = 150;
  const barMaxW = 230;

  const rows = topAreas.map((a, idx) => {
    const y = topPad + idx * rowHeight;
    const barW = Math.max(Math.round((a.totalIncidents / maxIncidents) * barMaxW), 6);
    const hasOutages = a.activeOutages > 0;
    const barFill = hasOutages ? '#f87171' : (a.totalIncidents >= 3 ? '#fbbf24' : '#34d399');

    return `
      <g class="incident-area-row" transform="translate(0, ${y})">
        <text x="${labelX}" y="15" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--ink, #182e2a)">
          ${escapeXml(a.area)} <tspan font-weight="400" font-size="10" fill="var(--muted, #71817c)">(${a.subscribersAffected} subs)</tspan>
        </text>

        <rect x="${barX}" y="4" width="${barMaxW}" height="16" rx="4" fill="rgba(0, 0, 0, 0.04)" />

        <rect x="${barX}" y="4" width="${barW}" height="16" rx="4" fill="${barFill}">
          <title>${escapeXml(a.area)}: ${a.totalIncidents} incidents, ${a.activeOutages} active outages, MTTR ${a.meanTimeToRestoreHours} hrs</title>
        </rect>

        <text x="${barX + barW + 8}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">
          ${a.totalIncidents} inc
        </text>

        ${hasOutages ? `
          <rect x="${width - 90}" y="3" width="60" height="18" rx="9" fill="#ef4444" fill-opacity="0.15" />
          <text x="${width - 60}" y="15" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="#dc2626">
            ${a.activeOutages} open
          </text>
        ` : `
          <rect x="${width - 90}" y="3" width="60" height="18" rx="9" fill="#10b981" fill-opacity="0.15" />
          <text x="${width - 60}" y="15" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="#047857">
            Resolved
          </text>
        `}
      </g>
    `;
  }).join('');

  const footerY = height - 14;

  return `<svg class="chart-svg incident-chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Network Incident and Outage Matrix Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(150, 20)" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5">
      <text x="0" y="0" font-weight="600" fill="var(--muted, #71817c)">
        MTTR: <tspan font-weight="700" fill="var(--ink, #182e2a)">${matrixData.meanTimeToRestoreHours} hrs</tspan>
      </text>
      <text x="${width - 240}" y="0" text-anchor="end" font-weight="600" fill="var(--muted, #71817c)">
        Active Outages: <tspan font-weight="700" fill="${matrixData.activeOutagesCount > 0 ? '#dc2626' : '#047857'}">${matrixData.activeOutagesCount}</tspan>
      </text>
    </g>

    ${rows}

    <g transform="translate(${width / 2}, ${footerY})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">
        Total Incidents: <tspan font-weight="700" fill="var(--ink, #182e2a)">${matrixData.totalRecordedIncidents}</tspan> · Affected Subs: <tspan font-weight="700" fill="var(--ink, #182e2a)">${matrixData.affectedSubscribersCount}</tspan> · Incident Rate: <tspan font-weight="700" fill="#0e5b4d">${matrixData.incidentRatePercent}%</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders an accessible pure SVG chart displaying 6-month forward cashflow projections,
 * recurring gross billed MRR, expected collections, and churn drag across scenarios.
 */
export function renderCashflowProjectionSvg(projectionData) {
  const width = 560;
  const height = 240;

  if (!projectionData || !projectionData.monthlyForecasts || projectionData.monthlyForecasts.length === 0 || projectionData.totalProjectedBilled === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Forward Cashflow Projections: No recurring subscribers configured">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 105)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-8 -6 L-2 -18 L4 -12 L10 -22" stroke="#0e5b4d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No active subscriber recurring revenue</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Configure selling amounts on customer profiles to project forward recurring cashflow</text>
      </g>
    </svg>`;
  }

  const forecasts = projectionData.monthlyForecasts;
  const maxBilled = Math.max(...forecasts.map(m => m.projectedBilled), 1);

  const baselineY = 175;
  const chartHeight = 115;
  const startX = 35;
  const totalChartW = width - 70; // 490
  const colWidth = totalChartW / forecasts.length; // ~81.6

  const barW = 28;
  const billedBarW = 38;

  const bars = forecasts.map((m, idx) => {
    const x = startX + idx * colWidth + (colWidth / 2);
    const billedH = Math.max(Math.round((m.projectedBilled / maxBilled) * chartHeight), 4);
    const billedY = baselineY - billedH;

    const colH = Math.max(Math.round((m.projectedCollection / maxBilled) * chartHeight), 3);
    const colY = baselineY - colH;

    const churnH = m.churnDragRevenue > 0
      ? Math.max(Math.round((m.churnDragRevenue / maxBilled) * chartHeight), 3)
      : 0;

    return `
      <g class="projection-col-group">
        <!-- Gross Billed background bar -->
        <rect x="${x - billedBarW / 2}" y="${billedY}" width="${billedBarW}" height="${billedH}" rx="5" fill="rgba(14, 91, 77, 0.12)">
          <title>${escapeXml(m.label)} (${m.month}): Gross Billed ${formatPKR(m.projectedBilled)}</title>
        </rect>

        <!-- Projected Cash Collection bar -->
        <rect x="${x - barW / 2}" y="${colY}" width="${barW}" height="${colH}" rx="4" fill="#0e5b4d">
          <title>${escapeXml(m.label)}: Projected Cash ${formatPKR(m.projectedCollection)} (${projectionData.recoveryRate}% recovery)</title>
        </rect>

        <!-- Churn drag marker if applicable -->
        ${churnH > 0 ? `
          <rect x="${x + barW / 2 - 3}" y="${baselineY - churnH}" width="4" height="${churnH}" rx="2" fill="#ef4444">
            <title>Churn Drag: -${formatPKR(m.churnDragRevenue)} (-${m.churnedSubscribers} subs)</title>
          </rect>
        ` : ''}

        <!-- Top value label (Projected Collection) -->
        <text x="${x}" y="${colY - 6}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--ink, #182e2a)">
          ${formatPKR(m.projectedCollection).replace('PKR ', '')}
        </text>

        <!-- Month label -->
        <text x="${x}" y="${baselineY + 16}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">
          ${escapeXml(m.label)}
        </text>

        <!-- Active subs -->
        <text x="${x}" y="${baselineY + 28}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">
          ${m.activeSubscribers} subs
        </text>
      </g>
    `;
  }).join('');

  // Trajectory connection line between months for collections
  const linePoints = forecasts.map((m, idx) => {
    const x = startX + idx * colWidth + (colWidth / 2);
    const colH = Math.max(Math.round((m.projectedCollection / maxBilled) * chartHeight), 3);
    const colY = baselineY - colH;
    return `${x},${colY}`;
  }).join(' ');

  const footerY = height - 10;

  return `<svg class="chart-svg projection-chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Forward Cashflow Projections &amp; Scenario Modeler Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <!-- Chart Legend & Scenario Header -->
    <g transform="translate(25, 20)" font-family="'DM Sans', system-ui, sans-serif" font-size="10">
      <rect x="0" y="-8" width="10" height="10" rx="2" fill="#0e5b4d" />
      <text x="14" y="0" font-weight="600" fill="var(--ink, #182e2a)">Projected Cash</text>

      <rect x="110" y="-8" width="10" height="10" rx="2" fill="rgba(14, 91, 77, 0.25)" />
      <text x="124" y="0" font-weight="600" fill="var(--muted, #71817c)">Gross Billed</text>

      <rect x="200" y="-8" width="6" height="10" rx="2" fill="#ef4444" />
      <text x="210" y="0" font-weight="600" fill="var(--muted, #71817c)">Churn Drag</text>

      <text x="${width - 50}" y="0" text-anchor="end" font-weight="700" fill="${projectionData.trajectoryStatus === 'Expansion' ? '#047857' : (projectionData.trajectoryStatus === 'Contraction Risk' ? '#dc2626' : '#2563eb')}">
        ${escapeXml(projectionData.scenario.toUpperCase())} · ${escapeXml(projectionData.trajectoryStatus)}
      </text>
    </g>

    <!-- Grid baseline -->
    <line x1="${startX}" y1="${baselineY}" x2="${width - startX}" y2="${baselineY}" stroke="var(--line, #e2ece7)" stroke-width="1" />

    ${bars}

    <!-- Trajectory Trend Curve -->
    <polyline points="${linePoints}" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.65" stroke-dasharray="3,3" />

    <!-- Bottom summary footer -->
    <g transform="translate(${width / 2}, ${footerY})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">
        6-Mo Cash: <tspan font-weight="700" fill="#047857">${formatPKR(projectionData.totalProjectedCashflow)}</tspan> · Monthly Run-Rate: <tspan font-weight="700" fill="var(--ink, #182e2a)">${formatPKR(projectionData.averageMonthlyCollection)}</tspan> · Churn Drag: <tspan font-weight="700" fill="#dc2626">${formatPKR(projectionData.totalProjectedChurnLoss)}</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders an accessible pure SVG chart displaying upstream wholesale transit gateways,
 * latency indicators, bandwidth allocation, and multi-ISP failover status.
 */
export function renderUpstreamGatewaySvg(gatewayData) {
  const width = 560;
  const height = 240;

  if (!gatewayData || gatewayData.gateways.length === 0 || gatewayData.totalBandwidthCapacityMbps === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Upstream ISP Transit: No gateways assigned">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 105)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-10 -14 C-10 -20 10 -20 10 -14 C10 -10 -10 -10 -10 -6 C-10 0 10 0 10 -6" stroke="#0e5b4d" stroke-width="2" fill="none" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No upstream ISP provider assigned</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Assign ISP providers on subscriber profiles to track upstream wholesale gateways and failover routes</text>
      </g>
    </svg>`;
  }

  const gateways = gatewayData.gateways.slice(0, 4);
  const maxCapacity = Math.max(...gateways.map(g => g.allocatedBandwidthMbps), 1);

  const topPad = 38;
  const rowHeight = 36;
  const labelX = 140;
  const barX = 150;
  const barMaxW = 230;

  const rows = gateways.map((g, idx) => {
    const y = topPad + idx * rowHeight;
    const barW = Math.max(Math.round((g.allocatedBandwidthMbps / maxCapacity) * barMaxW), 10);
    const meterColor = g.latencyMs < 20 ? '#10b981' : (g.latencyMs < 30 ? '#3b82f6' : (g.latencyMs < 40 ? '#f59e0b' : '#ef4444'));

    return `
      <g class="upstream-gateway-row" transform="translate(0, ${y})">
        <text x="${labelX}" y="15" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">
          ${escapeXml(g.provider)}
          <tspan font-weight="400" font-size="9.5" fill="var(--muted, #71817c)"> (${g.activeSubscribers} subs)</tspan>
        </text>

        <!-- Background bar -->
        <rect x="${barX}" y="4" width="${barMaxW}" height="16" rx="4" fill="rgba(0, 0, 0, 0.05)" />

        <!-- Bandwidth / capacity fill -->
        <rect x="${barX}" y="4" width="${barW}" height="16" rx="4" fill="${meterColor}">
          <title>${escapeXml(g.provider)}: ${g.allocatedBandwidthMbps} Mbps, ${g.latencyMs}ms latency (±${g.jitterMs}ms), SLA ${g.slaPercent}%</title>
        </rect>

        <text x="${barX + barW + 8}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--ink, #182e2a)">
          ${g.allocatedBandwidthMbps}M <tspan font-weight="400" fill="var(--muted, #71817c)">· ${g.latencyMs}ms</tspan>
        </text>

        <!-- Failover role pill -->
        <rect x="${width - 105}" y="3" width="75" height="18" rx="9" fill="${g.failoverRole === 'Primary Active' ? 'rgba(16, 185, 129, 0.15)' : (g.failoverRole === 'Secondary Standby' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(100, 116, 139, 0.12)')}" />
        <text x="${width - 67}" y="15" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="700" fill="${g.failoverRole === 'Primary Active' ? '#047857' : (g.failoverRole === 'Secondary Standby' ? '#2563eb' : '#64748b')}">
          ${g.failoverRole === 'Primary Active' ? 'PRIMARY' : (g.failoverRole === 'Secondary Standby' ? 'STANDBY' : 'READY')}
        </text>
      </g>
    `;
  }).join('');

  const footerY = height - 12;

  return `<svg class="chart-svg upstream-chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Upstream ISP Transit &amp; Multi-Homed Failover Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(150, 20)" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5">
      <text x="0" y="0" font-weight="600" fill="var(--muted, #71817c)">
        Primary Gateway: <tspan font-weight="700" fill="var(--ink, #182e2a)">${escapeXml(gatewayData.primaryGateway)}</tspan>
      </text>
      <text x="${width - 240}" y="0" text-anchor="end" font-weight="600" fill="var(--muted, #71817c)">
        Redundancy: <tspan font-weight="700" fill="${gatewayData.failoverRedundancyStatus === 'Multi-Homed Redundant' ? '#047857' : '#d97706'}">${escapeXml(gatewayData.failoverRedundancyStatus)}</tspan>
      </text>
    </g>

    ${rows}

    <g transform="translate(${width / 2}, ${footerY})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">
        Total Capacity: <tspan font-weight="700" fill="var(--ink, #182e2a)">${gatewayData.totalBandwidthCapacityMbps} Mbps</tspan> · Wholesale Cost: <tspan font-weight="700" fill="#dc2626">${formatPKR(gatewayData.totalWholesaleCost)}</tspan> · Active Links: <tspan font-weight="700" fill="#047857">${gatewayData.configuredGatewaysCount}</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders an accessible pure SVG horizontal bar chart comparing subscriber acquisition
 * channel payback duration, unit CAC, and marketing ROI.
 */
export function renderAcquisitionRoiSvg(roiData) {
  const width = 560;
  const height = 240;

  if (!roiData || roiData.totalPortfolioAcquisitions === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Acquisition ROI: No subscribers tracked">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 105)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-8 -6 L0 -14 L8 -6 M0 -14 L0 4" stroke="#0e5b4d" stroke-width="2" fill="none" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No subscriber acquisition data available</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Add customers to evaluate acquisition channel payback velocity, CAC unit economics, and marketing ROI</text>
      </g>
    </svg>`;
  }

  const topPad = 38;
  const rowHeight = 36;
  const labelX = 140;
  const barX = 150;
  const barMaxW = 230;

  const displayChannels = [...roiData.channels]
    .sort((a, b) => b.totalAcquisitions - a.totalAcquisitions)
    .slice(0, 4);

  const maxMonths = Math.max(...displayChannels.map(c => c.paybackMonths), 6);

  const rows = displayChannels.map((ch, idx) => {
    const y = topPad + idx * rowHeight;
    const normalizedWidth = Math.min(barMaxW, Math.max(12, Math.round((ch.paybackMonths / maxMonths) * barMaxW)));
    const pillColor = ch.velocityStatus === 'Rapid Payback'
      ? { bg: 'rgba(16, 185, 129, 0.15)', text: '#047857', label: 'RAPID' }
      : (ch.velocityStatus === 'Standard Payback'
        ? { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563eb', label: 'STANDARD' }
        : { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706', label: 'LAGGING' });

    return `
      <g class="acquisition-roi-row" transform="translate(0, ${y})">
        <text x="${labelX}" y="15" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">
          ${escapeXml(ch.name)}
          <tspan font-weight="400" font-size="9.5" fill="var(--muted, #71817c)"> (${ch.totalAcquisitions} subs)</tspan>
        </text>

        <!-- Background bar -->
        <rect x="${barX}" y="4" width="${barMaxW}" height="16" rx="4" fill="rgba(0, 0, 0, 0.05)" />

        <!-- Payback fill -->
        <rect x="${barX}" y="4" width="${normalizedWidth}" height="16" rx="4" fill="${ch.color}">
          <title>${escapeXml(ch.name)}: ${ch.paybackMonths} mo payback, CAC PKR ${ch.blendedCac}, ROI ${ch.netRoiPercent}%</title>
        </rect>

        <text x="${barX + normalizedWidth + 8}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--ink, #182e2a)">
          ${ch.paybackMonths}m <tspan font-weight="400" fill="var(--muted, #71817c)">· ${ch.netRoiPercent > 0 ? '+' : ''}${ch.netRoiPercent}% ROI</tspan>
        </text>

        <!-- Status pill -->
        <rect x="${width - 105}" y="3" width="75" height="18" rx="9" fill="${pillColor.bg}" />
        <text x="${width - 67}" y="15" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="700" fill="${pillColor.text}">
          ${pillColor.label}
        </text>
      </g>
    `;
  }).join('');

  const footerY = height - 12;

  return `<svg class="chart-svg acquisition-chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Acquisition Channel ROI and Payback Velocity Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(150, 20)" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5">
      <text x="0" y="0" font-weight="600" fill="var(--muted, #71817c)">
        Fastest Channel: <tspan font-weight="700" fill="var(--ink, #182e2a)">${escapeXml(roiData.fastestPaybackChannel)}</tspan>
      </text>
      <text x="${width - 240}" y="0" text-anchor="end" font-weight="600" fill="var(--muted, #71817c)">
        Portfolio Net ROI: <tspan font-weight="700" fill="${roiData.portfolioNetRoiPercent >= 0 ? '#047857' : '#dc2626'}">${roiData.portfolioNetRoiPercent > 0 ? '+' : ''}${roiData.portfolioNetRoiPercent}%</tspan>
      </text>
    </g>

    ${rows}

    <g transform="translate(${width / 2}, ${footerY})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">
        Total CAC: <tspan font-weight="700" fill="#dc2626">${formatPKR(roiData.totalPortfolioCac)}</tspan> · Realized Rev: <tspan font-weight="700" fill="#047857">${formatPKR(roiData.totalPortfolioRealizedRevenue)}</tspan> · Avg Payback: <tspan font-weight="700" fill="var(--ink, #182e2a)">${roiData.portfolioAvgPaybackMonths} mo</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders an accessible pure SVG chart displaying 24-hour diurnal bandwidth demand curve,
 * upstream capacity threshold, and peak-hour subscriber shaping metrics.
 */
export function renderBandwidthShapingSvg(metrics) {
  const width = 560;
  const height = 240;

  if (!metrics || metrics.totalProvisionedBandwidthMbps === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Bandwidth Shaping: No active subscribers">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 105)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-12 4 L-4 -8 L4 0 L12 -12" stroke="#0e5b4d" stroke-width="2" fill="none" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No active bandwidth demand detected</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Provision subscriber packages to forecast peak hour contention, link saturation, and shaping headroom</text>
      </g>
    </svg>`;
  }

  const topPad = 38;
  const bottomPad = 36;
  const leftPad = 48;
  const rightPad = 24;
  const plotWidth = width - leftPad - rightPad;
  const plotHeight = height - topPad - bottomPad;

  const maxScale = Math.max(metrics.upstreamCapacityMbps * 1.15, metrics.peakDemandMbps * 1.25, 100);

  const capacityY = Math.round(topPad + plotHeight - (metrics.upstreamCapacityMbps / maxScale) * plotHeight);

  const barWidth = Math.max(8, Math.floor(plotWidth / 24) - 3);
  const bars = (metrics.hourlyProfile ?? []).map((pt, i) => {
    const x = leftPad + i * (plotWidth / 24) + 2;
    const barH = Math.max(4, Math.round((pt.demandMbps / maxScale) * plotHeight));
    const y = topPad + plotHeight - barH;
    const isPeak = pt.isPeakHour;
    const fill = isPeak ? '#f59e0b' : '#3b82f6';

    return `
      <g class="diurnal-bar-group">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="2" fill="${fill}" opacity="${isPeak ? '0.9' : '0.65'}">
          <title>${pt.label} PKT: ${pt.demandMbps} Mbps (${pt.utilizationPercent}% link capacity)${isPeak ? ' [PEAK HOUR]' : ''}</title>
        </rect>
      </g>
    `;
  }).join('');

  const labelHours = [0, 4, 8, 12, 16, 20, 23];
  const axisLabels = labelHours.map(h => {
    const x = leftPad + h * (plotWidth / 24) + barWidth / 2;
    return `<text x="${x}" y="${topPad + plotHeight + 14}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="${h === 20 ? '700' : '500'}" fill="${h === 20 ? '#d97706' : 'var(--muted, #71817c)'}">${String(h).padStart(2, '0')}:00</text>`;
  }).join('');

  const statusColor = metrics.congestionStatus === 'Healthy Bandwidth Headroom' ? '#047857' : (metrics.congestionStatus === 'Moderate Congestion' ? '#d97706' : '#dc2626');

  return `<svg class="chart-svg shaping-chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Peak Bandwidth Utilization and Diurnal Traffic Curve">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(${leftPad}, 20)" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5">
      <text x="0" y="0" font-weight="600" fill="var(--muted, #71817c)">
        Peak Demand: <tspan font-weight="700" fill="var(--ink, #182e2a)">${metrics.peakDemandMbps} Mbps</tspan>
      </text>
      <text x="${plotWidth / 2}" y="0" text-anchor="middle" font-weight="600" fill="var(--muted, #71817c)">
        Capacity: <tspan font-weight="700" fill="var(--ink, #182e2a)">${metrics.upstreamCapacityMbps} Mbps</tspan>
      </text>
      <text x="${plotWidth}" y="0" text-anchor="end" font-weight="600" fill="var(--muted, #71817c)">
        Peak Utilization: <tspan font-weight="700" fill="${statusColor}">${metrics.peakUtilizationPercent}%</tspan>
      </text>
    </g>

    <line x1="${leftPad}" y1="${capacityY}" x2="${leftPad + plotWidth}" y2="${capacityY}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="4 3" />
    <text x="${leftPad + plotWidth}" y="${capacityY - 4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#dc2626">UPSTREAM CEILING (${metrics.upstreamCapacityMbps}M)</text>

    <line x1="${leftPad}" y1="${topPad + plotHeight}" x2="${leftPad + plotWidth}" y2="${topPad + plotHeight}" stroke="rgba(0,0,0,0.1)" stroke-width="1" />

    ${bars}
    ${axisLabels}

    <g transform="translate(${width / 2}, ${height - 6})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">
        Peak Surge: <tspan font-weight="700" fill="#d97706">19:00 - 23:00 PKT</tspan> · Headroom: <tspan font-weight="700" fill="var(--ink, #182e2a)">${metrics.headroomMbps} Mbps</tspan> · Ratio: <tspan font-weight="700" fill="var(--ink, #182e2a)">1:${metrics.oversubscriptionRatio}</tspan> · Status: <tspan font-weight="700" fill="${statusColor}">${metrics.congestionStatus}</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders an offline SVG chart displaying Fiber Distribution Hub (FDH) port capacity,
 * active vs offline drops, and available dark fiber headroom across key areas.
 */
export function renderFiberDistributionSvg(metrics) {
  const width = 560;
  const height = 240;

  if (!metrics || !metrics.hubs || metrics.hubs.length === 0 || metrics.totalDeployedPorts === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Fiber Distribution Hub: No active drops">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 105)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-12 0 L-4 -8 L4 8 L12 0" stroke="#0e5b4d" stroke-width="2" fill="none" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No fiber distribution hubs or drops recorded</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Assign customers to areas to map optical splitter utilization, attenuation, and dark fiber headroom</text>
      </g>
    </svg>`;
  }

  const topPad = 36;
  const bottomPad = 36;
  const leftPad = 130;
  const rightPad = 100;
  const plotWidth = width - leftPad - rightPad;

  // Display top 5 hubs
  const displayHubs = metrics.hubs.slice(0, 5);
  const rowHeight = Math.floor((height - topPad - bottomPad) / Math.max(displayHubs.length, 1));
  const barHeight = Math.min(18, Math.max(12, rowHeight - 12));

  let statusColor = '#047857';
  if (metrics.overallSaturationPercent >= 85) statusColor = '#ef4444';
  else if (metrics.overallSaturationPercent >= 70) statusColor = '#d97706';

  const rowsSvg = displayHubs.map((hub, idx) => {
    const yCenter = topPad + idx * rowHeight + rowHeight / 2;
    const barY = Math.round(yCenter - barHeight / 2);

    const activeRatio = hub.totalPorts > 0 ? hub.activeSubscribers / hub.totalPorts : 0;
    const offlineRatio = hub.totalPorts > 0 ? hub.offlineSubscribers / hub.totalPorts : 0;

    const activeW = Math.round(activeRatio * plotWidth);
    const offlineW = Math.round(offlineRatio * plotWidth);
    const spareW = Math.max(0, plotWidth - activeW - offlineW);

    const activeX = leftPad;
    const offlineX = activeX + activeW;
    const spareX = offlineX + offlineW;

    const satColor = hub.saturationPercent >= 85 ? '#ef4444' : (hub.saturationPercent >= 70 ? '#d97706' : '#10b981');

    return `
      <text x="${leftPad - 12}" y="${yCenter + 4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--ink, #182e2a)">
        ${escapeXml(hub.areaName.length > 16 ? hub.areaName.slice(0, 15) + '…' : hub.areaName)}
      </text>

      <rect x="${leftPad}" y="${barY}" width="${plotWidth}" height="${barHeight}" rx="4" fill="var(--bg-soft, #f1f5f3)" />

      ${activeW > 0 ? `<rect x="${activeX}" y="${barY}" width="${activeW}" height="${barHeight}" rx="${offlineW === 0 && spareW === 0 ? 4 : 0}" fill="#0e5b4d" />` : ''}

      ${offlineW > 0 ? `<rect x="${offlineX}" y="${barY}" width="${offlineW}" height="${barHeight}" rx="${activeW === 0 && spareW === 0 ? 4 : 0}" fill="#f59e0b" />` : ''}

      ${spareW > 0 ? `<rect x="${spareX}" y="${barY}" width="${spareW}" height="${barHeight}" rx="${activeW === 0 && offlineW === 0 ? 4 : 0}" fill="rgba(148, 163, 184, 0.4)" />` : ''}

      <text x="${leftPad + plotWidth + 8}" y="${yCenter + 4}" text-anchor="start" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="${satColor}">
        ${hub.assignedPorts}/${hub.totalPorts} (${hub.saturationPercent}%)
      </text>
    `;
  }).join('');

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Fiber Distribution Hub & Optical Splitter Capacity Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(${leftPad}, 20)">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">
        Markaz-e-Taqseem-e-Fiber (FDH)
      </text>
      <text x="${plotWidth + rightPad - 10}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">
        Total Ports: <tspan font-weight="700" fill="var(--ink, #182e2a)">${metrics.totalDeployedPorts}</tspan> · Dark Headroom: <tspan font-weight="700" fill="#047857">${metrics.totalSparePorts}</tspan> · Saturation: <tspan font-weight="700" fill="${statusColor}">${metrics.overallSaturationPercent}%</tspan>
      </text>
    </g>

    ${rowsSvg}

    <g transform="translate(${width / 2}, ${height - 10})" text-anchor="middle">
      <rect x="-180" y="-8" width="10" height="10" rx="2" fill="#0e5b4d" />
      <text x="-164" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)" text-anchor="start">Active Drops</text>

      <rect x="-70" y="-8" width="10" height="10" rx="2" fill="#f59e0b" />
      <text x="-54" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)" text-anchor="start">Offline Drops</text>

      <rect x="40" y="-8" width="10" height="10" rx="2" fill="rgba(148, 163, 184, 0.5)" />
      <text x="56" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)" text-anchor="start">Dark Headroom (Spare)</text>
    </g>
  </svg>`;
}

/**
 * Generates an executive plain-text report of the margin simulation.
 */
export function generateMarginSimulationReportText(simResult) {
  const { simulated, monthlyProfitDelta, annualizedImpact, marginDeltaPercent } = simResult;
  const dateStr = new Date().toISOString().slice(0, 10);
  const deltaSign = monthlyProfitDelta >= 0 ? '+' : '';

  const lines = [
    `=========================================`,
    `SHAHDARA ISP - PACKAGE MARGIN SIMULATION`,
    `Generated: ${dateStr} PKT`,
    `=========================================`,
    `[ SIMULATION PARAMETERS ]`,
    `  Upstream Transit Rate: PKR ${simulated.costPerMbps}/Mbps`,
    `  Wholesale Cost Multiplier: ${simulated.simulatedMultiplier}x`,
    `  Retail Price Adjustment: ${simulated.retailPriceDeltaPercent > 0 ? '+' : ''}${simulated.retailPriceDeltaPercent}%`,
    ``,
    `[ NETWORK-WIDE MARGIN IMPACT ]`,
    `  Monthly Revenue: ${formatPKR(simulated.totalRevenue)}`,
    `  Upstream Wholesale Cost: ${formatPKR(simulated.totalUpstreamCost)}`,
    `  Net Gross Profit: ${formatPKR(simulated.totalGrossProfit)}`,
    `  Blended Margin: ${simulated.blendedMarginPercent}% (${deltaSign}${marginDeltaPercent}% vs baseline)`,
    `  Monthly Profit Delta: ${deltaSign}${formatPKR(monthlyProfitDelta)}/mo`,
    `  Annualized EBITDA Impact: ${deltaSign}${formatPKR(annualizedImpact)}/yr`,
    ``,
    `[ PACKAGE PROFITABILITY MATRIX ]`
  ];

  for (const pkg of simulated.packages) {
    lines.push(`  ${pkg.packageName} (${pkg.subscriberCount} subs):`);
    lines.push(`    Revenue: ${formatPKR(pkg.totalRevenue)} | Cost: ${formatPKR(pkg.totalUpstreamCost)}`);
    lines.push(`    Gross Profit: ${formatPKR(pkg.grossProfit)} (${pkg.grossMarginPercent}% margin)`);
  }

  lines.push(`=========================================`);
  return lines.join('\n');
}

/**
 * Wires the interactive Margin Simulator Modal dialog.
 */
export function setupMarginSimulatorModal(state, { referenceDate = new Date(), onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('dashboardMarginSimulatorModal');
  const openBtn = document.getElementById('dashboardOpenMarginSimulatorBtn');
  const closeBtn = document.getElementById('dashboardMarginModalCloseBtn');
  const costInput = document.getElementById('marginSimCostInput');
  const tableBody = document.getElementById('marginSimTableBody');
  const copyBtn = document.getElementById('marginSimCopyBtn');

  if (!modal) return;

  let currentSimOptions = {
    costPerMbps: currentMarginCostPerMbps,
    simulatedMultiplier: 1.0,
    retailPriceDeltaPercent: 0
  };

  function updateSimulation() {
    const simResult = simulateMarginAdjustment(state, currentSimOptions);
    const { simulated, monthlyProfitDelta, annualizedImpact, marginDeltaPercent } = simResult;

    const revEl = document.getElementById('marginSimRevenueVal');
    const costEl = document.getElementById('marginSimCostVal');
    const profitEl = document.getElementById('marginSimProfitVal');
    const marginEl = document.getElementById('marginSimMarginVal');
    const deltaEl = document.getElementById('marginSimDeltaBadge');

    if (revEl) revEl.textContent = formatPKR(simulated.totalRevenue);
    if (costEl) costEl.textContent = formatPKR(simulated.totalUpstreamCost);
    if (profitEl) profitEl.textContent = formatPKR(simulated.totalGrossProfit);
    if (marginEl) marginEl.textContent = `${simulated.blendedMarginPercent}%`;

    if (deltaEl) {
      const sign = monthlyProfitDelta >= 0 ? '+' : '';
      deltaEl.textContent = `${sign}${formatPKR(monthlyProfitDelta)}/mo (${sign}${formatPKR(annualizedImpact)}/yr)`;
      deltaEl.className = `sim-delta-badge ${monthlyProfitDelta >= 0 ? 'delta-positive' : 'delta-negative'}`;
    }

    if (tableBody) {
      if (simulated.packages.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="empty-cell">No package distribution data found.</td></tr>';
      } else {
        tableBody.innerHTML = simulated.packages.map(pkg => `
          <tr>
            <td>
              <strong>${escapeXml(pkg.packageName)}</strong>
              <div class="cust-sub-meta">${pkg.speedMbps} Mbps</div>
            </td>
            <td>${pkg.subscriberCount}</td>
            <td>${formatPKR(pkg.arpu)}</td>
            <td>${formatPKR(pkg.avgCostPerSub)}</td>
            <td><strong class="text-success">${formatPKR(pkg.grossProfit)}</strong></td>
            <td>
              <span class="status-pill ${pkg.grossMarginPercent >= 50 ? 'status-good' : (pkg.grossMarginPercent >= 30 ? 'status-watchlist' : 'status-delinquent')}">
                ${pkg.grossMarginPercent}%
              </span>
            </td>
          </tr>
        `).join('');
      }
    }

    return simResult;
  }

  function populateAndOpen() {
    if (costInput) costInput.value = currentSimOptions.costPerMbps;
    updateSimulation();
    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
  }

  if (openBtn && !openBtn.dataset?.wired) {
    if (openBtn.dataset) openBtn.dataset.wired = 'true';
    else if (openBtn.setAttribute) openBtn.setAttribute('data-wired', 'true');
    openBtn.addEventListener('click', populateAndOpen);
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired', 'true');
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  });

  if (costInput && !costInput.dataset?.wired) {
    if (costInput.dataset) costInput.dataset.wired = 'true';
    else if (costInput.setAttribute) costInput.setAttribute('data-wired', 'true');
    costInput.addEventListener('input', () => {
      const val = parseFloat(costInput.value);
      if (!isNaN(val) && val >= 0) {
        currentSimOptions.costPerMbps = val;
        setMarginSimulatorCostPerMbps(val);
        updateSimulation();
      }
    });
  }

  const presetBtns = modal.querySelectorAll?.('[data-margin-preset]') ?? [];
  presetBtns.forEach(btn => {
    if (!btn.dataset?.wired) {
      if (btn.dataset) btn.dataset.wired = 'true';
      else if (btn.setAttribute) btn.setAttribute('data-wired', 'true');
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-margin-preset');
        if (preset === 'default') {
          currentSimOptions.costPerMbps = 50;
          currentSimOptions.simulatedMultiplier = 1.0;
          currentSimOptions.retailPriceDeltaPercent = 0;
        } else if (preset === 'discount') {
          currentSimOptions.costPerMbps = 40;
          currentSimOptions.simulatedMultiplier = 1.0;
        } else if (preset === 'inflation') {
          currentSimOptions.costPerMbps = 60;
          currentSimOptions.simulatedMultiplier = 1.15;
        } else if (preset === 'retailHike') {
          currentSimOptions.retailPriceDeltaPercent = 10;
        }
        if (costInput) costInput.value = currentSimOptions.costPerMbps;
        setMarginSimulatorCostPerMbps(currentSimOptions.costPerMbps);
        updateSimulation();
      });
    }
  });

  if (copyBtn && !copyBtn.dataset?.wired) {
    if (copyBtn.dataset) copyBtn.dataset.wired = 'true';
    else if (copyBtn.setAttribute) copyBtn.setAttribute('data-wired', 'true');
    copyBtn.addEventListener('click', async () => {
      const res = updateSimulation();
      const text = generateMarginSimulationReportText(res);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Margin simulation report copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard API unavailable');
      }
    });
  }
}

export function setupDashboardChartsEvents(state, referenceDate = new Date()) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const trendGroup = document.getElementById('dashboardTrendRangeGroup');
  if (trendGroup && !trendGroup.dataset?.wired) {
    if (trendGroup.dataset) trendGroup.dataset.wired = 'true';
    else if (trendGroup.setAttribute) trendGroup.setAttribute('data-wired', 'true');
    trendGroup.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.chart-range-btn');
      if (!btn) return;
      const m = parseInt(btn.dataset?.months || btn.getAttribute?.('data-months'), 10);
      if ([3, 6, 12].includes(m)) {
        setTrendChartDuration(m);
        renderDashboardCharts(state, referenceDate);
      }
    });
  }

  const seasonalGroup = document.getElementById('dashboardSeasonalActions');
  if (seasonalGroup && !seasonalGroup.dataset?.wired) {
    if (seasonalGroup.dataset) seasonalGroup.dataset.wired = 'true';
    else if (seasonalGroup.setAttribute) seasonalGroup.setAttribute('data-wired', 'true');
    seasonalGroup.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.chart-range-btn');
      if (!btn) return;
      const m = btn.dataset?.seasonalMetric || btn.getAttribute?.('data-seasonal-metric');
      if (['collections', 'billed'].includes(m)) {
        setSeasonalMetric(m);
        renderDashboardCharts(state, referenceDate);
      }
    });
  }

  const methodGroup = document.getElementById('dashboardMethodRangeGroup');
  if (methodGroup && !methodGroup.dataset?.wired) {
    if (methodGroup.dataset) methodGroup.dataset.wired = 'true';
    else if (methodGroup.setAttribute) methodGroup.setAttribute('data-wired', 'true');
    methodGroup.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.chart-range-btn');
      if (!btn) return;
      const period = btn.dataset?.period || btn.getAttribute?.('data-period');
      if (['currentMonth', '30days', 'all'].includes(period)) {
        setMethodChartPeriod(period);
        renderDashboardCharts(state, referenceDate);
      }
    });
  }

  const heatmapGroup = document.getElementById('dashboardHeatmapActions');
  if (heatmapGroup && !heatmapGroup.dataset?.wired) {
    if (heatmapGroup.dataset) heatmapGroup.dataset.wired = 'true';
    else if (heatmapGroup.setAttribute) heatmapGroup.setAttribute('data-wired', 'true');
    heatmapGroup.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.heatmap-filter-btn');
      if (!btn) return;
      const f = btn.dataset?.filterHeat || btn.getAttribute?.('data-filter-heat');
      if (['all', 'high', 'moderate', 'lagging'].includes(f)) {
        setHeatmapFilter(f);
        renderDashboardCharts(state, referenceDate);
      }
    });
  }

  const ltvGroup = document.getElementById('dashboardLtvMetricGroup');
  if (ltvGroup && !ltvGroup.dataset?.wired) {
    if (ltvGroup.dataset) ltvGroup.dataset.wired = 'true';
    else if (ltvGroup.setAttribute) ltvGroup.setAttribute('data-wired', 'true');
    ltvGroup.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.chart-range-btn');
      if (!btn) return;
      const m = btn.dataset?.ltvMetric || btn.getAttribute?.('data-ltv-metric');
      if (['averageLtv', 'totalLtv'].includes(m)) {
        setLtvMetric(m);
        renderDashboardCharts(state, referenceDate);
      }
    });
  }

  const projectionGroup = document.getElementById('dashboardProjectionScenarioGroup');
  if (projectionGroup && !projectionGroup.dataset?.wired) {
    if (projectionGroup.dataset) projectionGroup.dataset.wired = 'true';
    else if (projectionGroup.setAttribute) projectionGroup.setAttribute('data-wired', 'true');
    projectionGroup.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.chart-range-btn');
      if (!btn) return;
      const s = btn.dataset?.chartProjectionScenario || btn.getAttribute?.('data-chart-projection-scenario');
      if (['baseline', 'optimistic', 'conservative'].includes(s)) {
        setProjectionScenario(s);
        renderDashboardCharts(state, referenceDate);
      }
    });
  }
}

/**
 * Renders an offline SVG funnel/aging escalation chart displaying delinquency stages,
 * volume, expected recovery %, and pacing status.
 */
export function renderDelinquencyPipelineSvg(pipelineData, options = {}) {
  const width = 560;
  const height = 240;

  if (!pipelineData || pipelineData.totalDelinquentAccounts === 0 || pipelineData.totalDelinquentDues === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Delinquency Recovery Pipeline: Clean Ledger">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 105)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-8 -2 L-2 4 L8 -6" stroke="#0e5b4d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No delinquent subscriber accounts</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">All active customer accounts are settled with zero overdue aging receivables</text>
      </g>
    </svg>`;
  }

  const topPad = 36;
  const bottomPad = 36;
  const leftPad = 140;
  const rightPad = 120;
  const plotWidth = width - leftPad - rightPad;

  const stages = pipelineData.stages || [];
  const maxDues = Math.max(...stages.map(s => s.totalOverdueAmount), 1);
  const rowHeight = Math.floor((height - topPad - bottomPad) / Math.max(stages.length, 1));
  const barHeight = Math.min(20, Math.max(14, rowHeight - 12));

  let statusColor = '#047857';
  if (pipelineData.pipelineHealthStatus.includes('Critical')) statusColor = '#dc2626';
  else if (pipelineData.pipelineHealthStatus.includes('Moderate')) statusColor = '#d97706';

  const rowsSvg = stages.map((s, idx) => {
    const yCenter = topPad + idx * rowHeight + rowHeight / 2;
    const barY = Math.round(yCenter - barHeight / 2);

    const barW = Math.max(8, Math.round((s.totalOverdueAmount / maxDues) * plotWidth));
    const recoveryW = Math.round(barW * s.recoveryProbability);

    return `
      <text x="${leftPad - 12}" y="${yCenter + 4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="600" fill="var(--ink, #182e2a)">
        ${escapeXml(s.shortLabel)}
      </text>

      <rect x="${leftPad}" y="${barY}" width="${plotWidth}" height="${barHeight}" rx="4" fill="var(--bg-soft, #f1f5f3)" />

      ${s.totalOverdueAmount > 0 ? `
        <rect x="${leftPad}" y="${barY}" width="${barW}" height="${barHeight}" rx="4" fill="${s.color}" opacity="0.3" />
        <rect x="${leftPad}" y="${barY}" width="${recoveryW}" height="${barHeight}" rx="4" fill="${s.color}" />
      ` : ''}

      <text x="${leftPad + barW + 8}" y="${yCenter + 4}" text-anchor="start" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--ink, #182e2a)">
        ${s.subscriberCount} (${formatPKR(s.totalOverdueAmount)})
      </text>
    `;
  }).join('');

  const topArea = pipelineData.topDelinquentAreas[0];
  const topAreaText = topArea ? `${escapeXml(topArea.areaName)} (${formatPKR(topArea.totalOverdue)})` : 'None';

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Subscriber Delinquency Recovery &amp; Escalation Pipeline Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(${leftPad}, 20)">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">
        Khata Wusooli &amp; Aging Pipeline
      </text>
      <text x="${plotWidth + rightPad - 10}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">
        Delinquent: <tspan font-weight="700" fill="var(--ink, #182e2a)">${pipelineData.totalDelinquentAccounts}</tspan> · Overdue: <tspan font-weight="700" fill="#dc2626">${formatPKR(pipelineData.totalDelinquentDues)}</tspan> · Net Exp: <tspan font-weight="700" fill="#047857">${formatPKR(pipelineData.totalExpectedRecovery)}</tspan>
      </text>
    </g>

    ${rowsSvg}

    <g transform="translate(${width / 2}, ${height - 10})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">
        Pacing Target: <tspan font-weight="700" fill="var(--ink, #182e2a)">${formatPKR(pipelineData.dailyPacingTarget)}/day</tspan> · Status: <tspan font-weight="700" fill="${statusColor}">${escapeXml(pipelineData.pipelineHealthStatus)}</tspan> · Highest Dues Sector: <tspan font-weight="700" fill="var(--ink, #182e2a)">${topAreaText}</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders an offline SVG chart displaying CPE / ONU equipment asset lifecycle distribution,
 * active field deployment, dormant capital at risk, and spares runway.
 */
export function renderCpeAssetLifecycleSvg(cpeData, options = {}) {
  const width = 560;
  const height = 240;

  if (!cpeData || cpeData.totalCpeFleet === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Customer Premises Equipment CPE and ONU Asset Lifecycle: No equipment tracked">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <g transform="translate(${width / 2}, 105)" text-anchor="middle">
        <circle cx="0" cy="-14" r="24" fill="rgba(14, 91, 77, 0.08)" />
        <path d="M-10 4 L10 4 M-6 -4 L6 -4 M-2 -12 L2 -12" stroke="#0e5b4d" stroke-width="2" stroke-linecap="round" fill="none" />
        <text y="24" class="chart-empty-title" font-family="'DM Sans', system-ui, sans-serif" font-weight="700" font-size="13" fill="var(--ink, #182e2a)">No customer premises equipment tracked</text>
        <text y="42" class="chart-empty-subtitle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">Customer ONU and router asset deployments appear here</text>
      </g>
    </svg>`;
  }

  const leftPad = 24;
  const rightPad = 24;
  const plotWidth = width - leftPad - rightPad;

  let statusColor = '#047857';
  if (cpeData.fleetHealthStatus.includes('High')) statusColor = '#ef4444';
  else if (cpeData.fleetHealthStatus.includes('Moderate')) statusColor = '#d97706';

  const total = cpeData.totalCpeFleet;
  const activeW = Math.round((cpeData.activeDeployedCount / total) * plotWidth);
  const dormantW = Math.round((cpeData.dormantFieldCount / total) * plotWidth);
  const warehouseW = Math.round((cpeData.warehouseStock / total) * plotWidth);
  const damagedW = Math.max(0, plotWidth - activeW - dormantW - warehouseW);

  const barY = 46;
  const barH = 26;

  const cardW = 160;
  const cardH = 68;
  const cardY = 94;
  const cardGap = (plotWidth - cardW * 3) / 2;

  const activeCardX = leftPad;
  const dormantCardX = leftPad + cardW + cardGap;
  const sparesCardX = leftPad + (cardW + cardGap) * 2;

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Customer Premises Equipment CPE and ONU Asset Lifecycle Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(${leftPad}, 22)">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">
        CPE &amp; ONU Asset Fleet
      </text>
      <text x="${plotWidth}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">
        Fleet: <tspan font-weight="700" fill="var(--ink, #182e2a)">${cpeData.totalCpeFleet} Units</tspan> · Book: <tspan font-weight="700" fill="#047857">${formatPKR(cpeData.totalFleetValuePkr)}</tspan> · Active: <tspan font-weight="700" fill="#0e5b4d">${cpeData.activeUtilizationPercent}%</tspan>
      </text>
    </g>

    <!-- Horizontal Fleet Distribution Stack -->
    <rect x="${leftPad}" y="${barY}" width="${plotWidth}" height="${barH}" rx="6" fill="var(--bg-soft, #f1f5f3)" />
    ${activeW > 0 ? `<rect x="${leftPad}" y="${barY}" width="${activeW}" height="${barH}" rx="${dormantW === 0 && warehouseW === 0 ? 6 : 0}" fill="#0e5b4d" />` : ''}
    ${dormantW > 0 ? `<rect x="${leftPad + activeW}" y="${barY}" width="${dormantW}" height="${barH}" fill="#f59e0b" />` : ''}
    ${warehouseW > 0 ? `<rect x="${leftPad + activeW + dormantW}" y="${barY}" width="${warehouseW}" height="${barH}" fill="#0284c7" />` : ''}
    ${damagedW > 0 ? `<rect x="${leftPad + activeW + dormantW + warehouseW}" y="${barY}" width="${damagedW}" height="${barH}" rx="6" fill="#ef4444" />` : ''}

    <!-- Stat Tiles -->
    <!-- Active Card -->
    <g transform="translate(${activeCardX}, ${cardY})">
      <rect width="${cardW}" height="${cardH}" rx="8" fill="var(--bg-soft, #f8faf9)" stroke="var(--line, #e2ece7)" />
      <circle cx="16" cy="18" r="5" fill="#0e5b4d" />
      <text x="28" y="21" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">Active Deployed</text>
      <text x="16" y="44" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="800" fill="#0e5b4d">${cpeData.activeDeployedCount} Units</text>
      <text x="16" y="58" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">Value: ${formatPKR(cpeData.activeFleetValuePkr)}</text>
    </g>

    <!-- Dormant Card -->
    <g transform="translate(${dormantCardX}, ${cardY})">
      <rect width="${cardW}" height="${cardH}" rx="8" fill="var(--bg-soft, #f8faf9)" stroke="var(--line, #e2ece7)" />
      <circle cx="16" cy="18" r="5" fill="#f59e0b" />
      <text x="28" y="21" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">Dormant in Field</text>
      <text x="16" y="44" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="800" fill="#b45309">${cpeData.dormantFieldCount} Units</text>
      <text x="16" y="58" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">At Risk: ${formatPKR(cpeData.dormantCapitalAtRiskPkr)}</text>
    </g>

    <!-- Spares Card -->
    <g transform="translate(${sparesCardX}, ${cardY})">
      <rect width="${cardW}" height="${cardH}" rx="8" fill="var(--bg-soft, #f8faf9)" stroke="var(--line, #e2ece7)" />
      <circle cx="16" cy="18" r="5" fill="#0284c7" />
      <text x="28" y="21" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">Warehouse Spares</text>
      <text x="16" y="44" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="800" fill="#0369a1">${cpeData.warehouseStock} Tested</text>
      <text x="16" y="58" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">Runway: ${cpeData.sparesRunwayWeeks} weeks</text>
    </g>

    <!-- Bottom Footer -->
    <g transform="translate(${width / 2}, ${height - 10})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">
        Fleet Health: <tspan font-weight="700" fill="${statusColor}">${escapeXml(cpeData.fleetHealthStatus)}</tspan> · Retrieval Candidates: <tspan font-weight="700" fill="var(--ink, #182e2a)">${cpeData.retrievalCandidates.length}</tspan> · Spares Inventory: <tspan font-weight="700" fill="#0284c7">${formatPKR(cpeData.warehouseValuePkr)}</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders pure SVG chart showing distribution POP battery bank charge levels,
 * generator fuel reserve gauges, and load-shedding backup runways.
 */
export function renderPowerBackupSvg(powerData, options = {}) {
  const width = options.width || 640;
  const height = options.height || 260;

  if (!powerData || !Array.isArray(powerData.hubs) || powerData.hubs.length === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Power Outage and OLT Battery Health Chart">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="13" fill="var(--muted, #71817c)">
        No distribution hub power telemetry recorded
      </text>
    </svg>`;
  }

  const leftPad = 20;
  const rightPad = 20;
  const plotWidth = width - leftPad - rightPad;

  let statusColor = '#047857';
  if (powerData.criticalHubsCount > 0) statusColor = '#ef4444';
  else if (powerData.activeOutagesCount > 0) statusColor = '#d97706';

  const rows = powerData.hubs.slice(0, 4);
  const rowStartY = 42;
  const rowH = 46;

  const renderedRows = rows.map((h, i) => {
    const y = rowStartY + i * rowH;
    const battColor = h.batteryLevelPercent >= 70 ? '#047857' : (h.batteryLevelPercent >= 35 ? '#d97706' : '#ef4444');
    const fuelColor = h.fuelReservePercent >= 50 ? '#0284c7' : (h.fuelReservePercent >= 25 ? '#d97706' : '#ef4444');

    const battBarWidth = 140;
    const battFillW = Math.max(4, Math.round((h.batteryLevelPercent / 100) * battBarWidth));

    const fuelBarWidth = 110;
    const fuelFillW = Math.max(4, Math.round((h.fuelReservePercent / 100) * fuelBarWidth));

    const pwrClass = h.powerSource.includes('Mains') ? '#047857' : (h.powerSource.includes('Battery') ? '#d97706' : '#b91c1c');
    const pwrBg = h.powerSource.includes('Mains') ? 'rgba(4, 120, 87, 0.12)' : (h.powerSource.includes('Battery') ? 'rgba(217, 119, 6, 0.12)' : 'rgba(185, 28, 28, 0.12)');

    const shortName = escapeXml(h.name.replace('Shahdara Core NOC (Vandala Road)', 'Core NOC (Vandala)').replace('Distribution Hub', 'Hub').replace('Remote OLT Node', 'Node').replace('Sub-POP Node', 'Sub-POP'));

    return `
      <!-- Hub Row ${i + 1} -->
      <g transform="translate(${leftPad}, ${y})">
        <!-- Row Background Card -->
        <rect width="${plotWidth}" height="38" rx="6" fill="var(--bg-soft, #f8faf9)" stroke="var(--line, #e2ece7)" />

        <!-- Hub Title & Subs -->
        <text x="10" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">
          ${shortName}
        </text>
        <text x="10" y="29" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">
          ${h.activeSubscribers} Active Subs · ${h.inverterLoadWatts}W Load
        </text>

        <!-- Power Source Tag -->
        <rect x="175" y="10" width="70" height="18" rx="4" fill="${pwrBg}" />
        <text x="210" y="22" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="${pwrClass}">
          ${escapeXml(h.powerSource.replace(' (LESCO)', ''))}
        </text>

        <!-- Battery Bar -->
        <g transform="translate(255, 8)">
          <text x="0" y="8" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="600" fill="var(--muted, #71817c)">
            BATT: ${h.batteryVoltage}V (${h.batteryLevelPercent}%) ~${h.batteryRunwayHours}h
          </text>
          <rect y="11" width="${battBarWidth}" height="10" rx="3" fill="var(--line, #e2ece7)" />
          <rect y="11" width="${battFillW}" height="10" rx="3" fill="${battColor}" />
        </g>

        <!-- Fuel Bar -->
        <g transform="translate(410, 8)">
          <text x="0" y="8" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="600" fill="var(--muted, #71817c)">
            GEN: ${h.generatorFuelLiters}L (${h.fuelReservePercent}%) ~${h.generatorRunwayHours}h
          </text>
          <rect y="11" width="${fuelBarWidth}" height="10" rx="3" fill="var(--line, #e2ece7)" />
          <rect y="11" width="${fuelFillW}" height="10" rx="3" fill="${fuelColor}" />
        </g>

        <!-- Total Runway Pill -->
        <rect x="530" y="9" width="62" height="20" rx="4" fill="var(--surface-sunken, #edf3f0)" />
        <text x="561" y="22" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="var(--ink, #182e2a)">
          ${h.totalOutageRunwayHours}h Total
        </text>
      </g>
    `;
  }).join('');

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Power Outage and OLT Battery Health Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(${leftPad}, 20)">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">
        Distribution POP Power &amp; Telecom Battery Telemetry
      </text>
      <text x="${plotWidth}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">
        Fleet Battery: <tspan font-weight="700" fill="#047857">${powerData.totalBatteryCapacityKwh} kWh</tspan> · Fuel: <tspan font-weight="700" fill="#0284c7">${powerData.totalFuelReservesLiters}L</tspan> · Runway: <tspan font-weight="700" fill="${statusColor}">${powerData.combinedFleetRunwayHours}h</tspan>
      </text>
    </g>

    ${renderedRows}

    <!-- Bottom Legend & Health Status -->
    <g transform="translate(${width / 2}, ${height - 10})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">
        Grid Status: <tspan font-weight="700" fill="${statusColor}">${escapeXml(powerData.gridResilienceStatus)}</tspan> · Outages: <tspan font-weight="700" fill="var(--ink, #182e2a)">${powerData.activeOutagesCount}/${powerData.totalHubsMonitored}</tspan> · Emergency Burn: <tspan font-weight="700" fill="#b45309">${formatPKR(powerData.totalHourlyFuelCostPkr)}/hr</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Renders pure SVG visualization for area collection route density,
 * stop clustering yield, and collector pacing.
 */
export function renderRouteDensityMatrixSvg(densityData, options = {}) {
  const width = options.width || 640;
  const height = options.height || 260;

  if (!densityData || !Array.isArray(densityData.areas) || densityData.areas.length === 0) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Area Collection Route Density and Collector Pacing Chart">
      <rect width="${width}" height="${height}" rx="10" fill="transparent" />
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="13" fill="var(--muted, #71817c)">
        No delinquent collection route stops recorded
      </text>
    </svg>`;
  }

  const leftPad = 20;
  const rightPad = 20;
  const plotWidth = width - leftPad - rightPad;

  let statusColor = '#047857';
  if (densityData.fleetRoutingStatus.includes('Urgent')) statusColor = '#ef4444';
  else if (densityData.fleetRoutingStatus.includes('Active')) statusColor = '#d97706';

  const rows = densityData.areas.slice(0, 4);
  const rowStartY = 42;
  const rowH = 46;

  const maxDues = Math.max(1, ...densityData.areas.map(a => a.totalOverdueAmount));
  const maxStops = Math.max(1, ...densityData.areas.map(a => a.overdueCount));

  const renderedRows = rows.map((a, i) => {
    const y = rowStartY + i * rowH;

    const duesBarWidth = 140;
    const duesFillW = Math.max(4, Math.round((a.totalOverdueAmount / maxDues) * duesBarWidth));

    const stopsBarWidth = 100;
    const stopsFillW = Math.max(4, Math.round((a.overdueCount / maxStops) * stopsBarWidth));

    const tierColor = a.priorityTier.includes('High') ? '#b91c1c' : (a.priorityTier.includes('Quick') ? '#047857' : '#64748b');
    const tierBg = a.priorityTier.includes('High') ? 'rgba(185, 28, 28, 0.12)' : (a.priorityTier.includes('Quick') ? 'rgba(4, 120, 87, 0.12)' : 'rgba(100, 116, 139, 0.12)');

    return `
      <!-- Route Row ${i + 1} -->
      <g transform="translate(${leftPad}, ${y})">
        <!-- Row Background Card -->
        <rect width="${plotWidth}" height="38" rx="6" fill="var(--bg-soft, #f8faf9)" stroke="var(--line, #e2ece7)" />

        <!-- Area Title & Subs -->
        <text x="10" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">
          ${escapeXml(a.areaName)}
        </text>
        <text x="10" y="29" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">
          ${a.overdueCount} Stops · ~${formatPKR(a.avgTicketPerStop)}/stop
        </text>

        <!-- Density Tag -->
        <rect x="175" y="10" width="75" height="18" rx="4" fill="${tierBg}" />
        <text x="212" y="22" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="${tierColor}">
          ${escapeXml(a.densityRating)}
        </text>

        <!-- Uncollected Dues Bar -->
        <g transform="translate(260, 8)">
          <text x="0" y="8" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="600" fill="var(--muted, #71817c)">
            TARGET: ${formatPKR(a.totalOverdueAmount)}
          </text>
          <rect y="11" width="${duesBarWidth}" height="10" rx="3" fill="var(--line, #e2ece7)" />
          <rect y="11" width="${duesFillW}" height="10" rx="3" fill="#b91c1c" />
        </g>

        <!-- Stop Density Bar -->
        <g transform="translate(415, 8)">
          <text x="0" y="8" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="600" fill="var(--muted, #71817c)">
            DENSITY: ${a.overdueCount} accounts
          </text>
          <rect y="11" width="${stopsBarWidth}" height="10" rx="3" fill="var(--line, #e2ece7)" />
          <rect y="11" width="${stopsFillW}" height="10" rx="3" fill="#047857" />
        </g>

        <!-- Dispatch Crew Pill -->
        <rect x="525" y="9" width="67" height="20" rx="4" fill="var(--surface-sunken, #edf3f0)" />
        <text x="558" y="22" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="var(--ink, #182e2a)">
          ${a.recommendedCollectors} Crew (${a.estimatedRouteDays}d)
        </text>
      </g>
    `;
  }).join('');

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Area Collection Route Density and Collector Pacing Chart">
    <rect width="${width}" height="${height}" rx="10" fill="transparent" />

    <g transform="translate(${leftPad}, 20)">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="700" fill="var(--ink, #182e2a)">
        Field Route Density &amp; Collector Pacing Matrix
      </text>
      <text x="${plotWidth}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">
        Stops: <tspan font-weight="700" fill="var(--ink, #182e2a)">${densityData.totalDelinquentAccounts}</tspan> · Target: <tspan font-weight="700" fill="#b91c1c">${formatPKR(densityData.totalUncollectedDues)}</tspan> · Fleet: <tspan font-weight="700" fill="#047857">${densityData.totalRecommendedCollectors} Crew</tspan>
      </text>
    </g>

    ${renderedRows}

    <!-- Bottom Legend & Health Status -->
    <g transform="translate(${width / 2}, ${height - 10})" text-anchor="middle">
      <text font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="var(--muted, #71817c)">
        Dispatch Status: <tspan font-weight="700" fill="${statusColor}">${escapeXml(densityData.fleetRoutingStatus)}</tspan> · Sectors: <tspan font-weight="700" fill="var(--ink, #182e2a)">${densityData.totalAreasTargeted}</tspan> · Daily Pacing: <tspan font-weight="700" fill="#047857">${formatPKR(densityData.dailyFleetRecoveryTargetPkr)}/day</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Orchestrates dashboard charts rendering into their DOM containers.
 */
export function renderDashboardCharts(state, referenceDate = new Date(), options = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const trendMonths = options.trendMonths ?? currentTrendMonths;
  const trendEl = document.getElementById('dashboardTrendChart');
  if (trendEl) {
    const trends = calculateMonthlyTrends(state, referenceDate, trendMonths);
    const kpis = calculateDashboardKpis(state, referenceDate);
    const targetRevenue = options.targetRevenue ?? (kpis.currentMonthBilled > 0 ? kpis.currentMonthBilled : null);
    trendEl.innerHTML = renderMonthlyTrendSvg(trends, { targetRevenue });
  }

  // update trend range buttons active state
  const rangeBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('#dashboardTrendRangeGroup .chart-range-btn')
    : [];
  rangeBtns.forEach(btn => {
    const m = parseInt(btn.dataset?.months || btn.getAttribute?.('data-months'), 10);
    const isActive = m === trendMonths;
    if (btn.classList?.toggle) btn.classList.toggle('is-active', isActive);
    if (btn.setAttribute) btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const statusEl = document.getElementById('dashboardStatusChart');
  if (statusEl) {
    const kpis = calculateDashboardKpis(state, referenceDate);
    statusEl.innerHTML = renderBillStatusDonutSvg({
      paid: kpis.paidBillsCount,
      unpaid: kpis.unpaidBillsCount,
      partial: kpis.partialBillsCount,
      total: kpis.totalCurrentMonthBills
    });
  }

  const areaEl = document.getElementById('dashboardAreaChart');
  if (areaEl) {
    const areas = calculateDuesByArea(state, referenceDate, 5);
    areaEl.innerHTML = renderAreaDuesSvg(areas);
  }

  const pkgEl = document.getElementById('dashboardPackageChart');
  if (pkgEl) {
    const pkgData = calculatePackageDistribution(state);
    pkgEl.innerHTML = renderPackageDistributionSvg(pkgData);
  }

  const healthEl = document.getElementById('dashboardHealthChart');
  if (healthEl) {
    const healthData = calculateCustomerHealthBreakdown(state, referenceDate);
    healthEl.innerHTML = renderCustomerHealthSvg(healthData);
  }

  const methodsEl = document.getElementById('dashboardMethodsChart');
  if (methodsEl) {
    const methodData = calculatePaymentMethodBreakdown(state, referenceDate, { period: currentMethodPeriod });
    methodsEl.innerHTML = renderPaymentMethodSvg(methodData);
  }

  // update method range buttons active state
  const methodRangeBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('#dashboardMethodRangeGroup .chart-range-btn')
    : [];
  methodRangeBtns.forEach(btn => {
    const p = btn.dataset?.period || btn.getAttribute?.('data-period');
    const isActive = p === currentMethodPeriod;
    if (btn.classList?.toggle) btn.classList.toggle('is-active', isActive);
    if (btn.setAttribute) btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const churnEl = document.getElementById('dashboardChurnChart');
  if (churnEl) {
    const churnData = calculateChurnRiskAnalysis(state, referenceDate);
    churnEl.innerHTML = renderChurnRiskGaugeSvg(churnData);
  }

  const heatmapEl = document.getElementById('dashboardHeatmapChart');
  if (heatmapEl) {
    const heatmapData = calculateAreaCollectionHeatmap(state, referenceDate);
    heatmapEl.innerHTML = renderAreaCollectionHeatmapSvg(heatmapData, { filter: currentHeatmapFilter });
  }

  // update heatmap filter buttons active state
  const heatmapBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('#dashboardHeatmapActions .heatmap-filter-btn')
    : [];
  heatmapBtns.forEach(btn => {
    const f = btn.dataset?.filterHeat || btn.getAttribute?.('data-filter-heat');
    const isActive = f === currentHeatmapFilter;
    if (btn.classList?.toggle) btn.classList.toggle('is-active', isActive);
    if (btn.setAttribute) btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const seasonalEl = document.getElementById('dashboardSeasonalChart');
  if (seasonalEl) {
    const seasonalData = calculateSeasonalCashflowComparison(state, referenceDate, { metric: currentSeasonalMetric });
    seasonalEl.innerHTML = renderSeasonalCashflowSvg(seasonalData);
  }

  const seasonalBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('#dashboardSeasonalActions .chart-range-btn')
    : [];
  seasonalBtns.forEach(btn => {
    const m = btn.dataset?.seasonalMetric || btn.getAttribute?.('data-seasonal-metric');
    const isActive = m === currentSeasonalMetric;
    if (btn.classList?.toggle) btn.classList.toggle('is-active', isActive);
    if (btn.setAttribute) btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  const marginEl = document.getElementById('dashboardPackageMarginChart');
  if (marginEl) {
    const marginData = calculatePackageMarginBreakdown(state, { costPerMbps: currentMarginCostPerMbps });
    marginEl.innerHTML = renderPackageMarginSvg(marginData);
  }

  setupMarginSimulatorModal(state, { referenceDate, onToast: options.onToast });

  const ltvEl = document.getElementById('dashboardLtvChart');
  if (ltvEl) {
    const ltvData = calculateCustomerLtvCohorts(state, referenceDate);
    ltvEl.innerHTML = renderCustomerLtvCohortsSvg(ltvData, { metric: currentLtvMetric });
  }

  const ltvBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('#dashboardLtvMetricGroup .chart-range-btn')
    : [];
  ltvBtns.forEach(btn => {
    const m = btn.dataset?.ltvMetric || btn.getAttribute?.('data-ltv-metric');
    const isActive = m === currentLtvMetric;
    if (btn.classList?.toggle) btn.classList.toggle('is-active', isActive);
    if (btn.setAttribute) btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  setupLtvCohortModal(state, { referenceDate, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const incidentEl = document.getElementById('dashboardIncidentChart');
  if (incidentEl) {
    const incidentData = calculateIncidentImpactMatrix(state, referenceDate);
    incidentEl.innerHTML = renderIncidentImpactSvg(incidentData);
  }

  setupIncidentImpactModal(state, { referenceDate, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const projectionEl = document.getElementById('dashboardProjectionChart');
  if (projectionEl) {
    const projectionData = calculateCashflowProjections(state, referenceDate, { scenario: currentProjectionScenario });
    projectionEl.innerHTML = renderCashflowProjectionSvg(projectionData);
  }

  const projectionBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('#dashboardProjectionScenarioGroup .chart-range-btn')
    : [];
  projectionBtns.forEach(btn => {
    const s = btn.dataset?.chartProjectionScenario || btn.getAttribute?.('data-chart-projection-scenario');
    const isActive = s === currentProjectionScenario;
    if (btn.classList?.toggle) btn.classList.toggle('is-active', isActive);
    if (btn.setAttribute) btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  setupProjectionScenarioModal(state, { referenceDate, onToast: options.onToast });

  const upstreamEl = document.getElementById('dashboardUpstreamChart');
  if (upstreamEl) {
    const upstreamData = calculateUpstreamGatewayMetrics(state, referenceDate);
    upstreamEl.innerHTML = renderUpstreamGatewaySvg(upstreamData);
  }

  setupUpstreamGatewayModal(state, { referenceDate, onToast: options.onToast });

  const acqEl = document.getElementById('dashboardAcquisitionChart');
  if (acqEl) {
    const acqData = calculateAcquisitionRoiMetrics(state, referenceDate);
    acqEl.innerHTML = renderAcquisitionRoiSvg(acqData);
  }

  setupAcquisitionRoiModal(state, { referenceDate, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const shapingEl = document.getElementById('dashboardShapingChart');
  if (shapingEl) {
    const shapingData = calculateBandwidthShapingMetrics(state, referenceDate);
    shapingEl.innerHTML = renderBandwidthShapingSvg(shapingData);
  }

  setupBandwidthShapingModal(state, { referenceDate, onToast: options.onToast });

  const fiberEl = document.getElementById('dashboardFiberChart');
  if (fiberEl) {
    const fiberData = calculateFiberDistributionMetrics(state, { targetSplitterSize: 8 });
    fiberEl.innerHTML = renderFiberDistributionSvg(fiberData);
  }

  setupFiberDistributionModal(state, { referenceDate, onToast: options.onToast });

  const delinquencyEl = document.getElementById('dashboardDelinquencyChart');
  if (delinquencyEl) {
    const delinquencyData = calculateDelinquencyRecoveryPipeline(state, referenceDate);
    delinquencyEl.innerHTML = renderDelinquencyPipelineSvg(delinquencyData);
  }

  setupDelinquencyPipelineModal(state, { referenceDate, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const cpeEl = document.getElementById('dashboardCpeChart');
  if (cpeEl) {
    const cpeData = calculateCpeAssetMetrics(state, { referenceDate });
    cpeEl.innerHTML = renderCpeAssetLifecycleSvg(cpeData);
  }

  setupCpeAssetModal(state, { referenceDate, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const powerEl = document.getElementById('dashboardPowerChart');
  if (powerEl) {
    const powerData = calculatePowerBackupMetrics(state, { referenceDate });
    powerEl.innerHTML = renderPowerBackupSvg(powerData);
  }

  setupPowerBackupModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const routeDensityEl = document.getElementById('dashboardRouteDensityChart');
  if (routeDensityEl) {
    const routeDensityData = calculateRouteDensityMetrics(state, { referenceDate });
    routeDensityEl.innerHTML = renderRouteDensityMatrixSvg(routeDensityData);
  }

  setupRouteDensityModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const otdrEl = document.getElementById('dashboardOtdrChart');
  if (otdrEl) {
    const otdrData = calculateOtdrFaultMetrics(state, { referenceDate });
    otdrEl.innerHTML = renderOtdrTraceSvg(otdrData);
  }

  setupOtdrModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const solarEl = document.getElementById('dashboardSolarChart');
  if (solarEl) {
    const solarData = calculateSolarInverterMetrics(state, { referenceDate });
    solarEl.innerHTML = renderSolarInverterSvg(solarData);
  }

  setupSolarModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const aerialEl = document.getElementById('dashboardAerialChart');
  if (aerialEl) {
    const aerialData = calculateAerialTensionMetrics(state, { referenceDate });
    aerialEl.innerHTML = renderAerialTensionSvg(aerialData);
  }

  setupAerialTensionModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const mwEl = document.getElementById('dashboardMicrowaveChart');
  if (mwEl) {
    const mwData = calculateMicrowaveLinkBudget(state, { referenceDate });
    mwEl.innerHTML = renderMicrowaveLinkSvg(mwData);
  }

  setupMicrowaveModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const spliceEl = document.getElementById('dashboardSpliceChart');
  if (spliceEl) {
    const spliceData = calculateSpliceClosureMetrics(state, { referenceDate });
    spliceEl.innerHTML = renderSpliceClosureSvg(spliceData);
  }

  setupSpliceClosureModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const jettingEl = document.getElementById('dashboardJettingChart');
  if (jettingEl) {
    const jettingData = calculateDuctJettingMetrics(state, { referenceDate });
    jettingEl.innerHTML = renderDuctJettingSvg(jettingData);
  }

  setupDuctJettingModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  setupDashboardChartsEvents(state, referenceDate);
}

export { renderOtdrTraceSvg, renderSolarInverterSvg, renderAerialTensionSvg, renderMicrowaveLinkSvg, renderSpliceClosureSvg, renderDuctJettingSvg };


