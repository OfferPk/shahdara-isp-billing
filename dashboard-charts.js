import { monthsForHistory, buildMonthlyClosingSnapshot, calculatePaymentAllocations, formatPKR, calculateDashboard, derivedBillStatus } from './core.js';
import { calculateDashboardKpis, calculateCustomerHealthBreakdown, calculatePaymentMethodBreakdown, calculateChurnRiskAnalysis } from './dashboard.js';

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

  setupDashboardChartsEvents(state, referenceDate);
}
