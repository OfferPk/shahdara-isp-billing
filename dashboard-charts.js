import { monthsForHistory, buildMonthlyClosingSnapshot, calculatePaymentAllocations, formatPKR } from './core.js';
import { calculateDashboardKpis } from './dashboard.js';

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const PKG_PALETTE = ['#0e5b4d', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

let currentTrendMonths = 6;

export function setTrendChartDuration(months) {
  const m = Number(months);
  if ([3, 6, 12].includes(m)) {
    currentTrendMonths = m;
  }
}

export function getTrendChartDuration() {
  return currentTrendMonths;
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
 */
export function renderMonthlyTrendSvg(trends) {
  const maxVal = Math.max(...trends.flatMap(t => [t.billed, t.collected]), 0);
  const width = 560;
  const height = 240;

  if (maxVal === 0) {
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
  const yCeil = Math.ceil((maxVal * 1.15) / 1000) * 1000 || 1000;

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
    </g>
  `;

  return `<svg class="chart-svg chart-trend-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="Monthly Revenue and Collections Trend Bar Chart">
    ${legendSvg}
    ${gridLinesSvg}
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

export function setupDashboardChartsEvents(state, referenceDate = new Date()) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  const group = document.getElementById('dashboardTrendRangeGroup');
  if (group && !group.dataset?.wired) {
    if (group.dataset) group.dataset.wired = 'true';
    else if (group.setAttribute) group.setAttribute('data-wired', 'true');
    group.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.chart-range-btn');
      if (!btn) return;
      const m = parseInt(btn.dataset?.months || btn.getAttribute?.('data-months'), 10);
      if ([3, 6, 12].includes(m)) {
        setTrendChartDuration(m);
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
    trendEl.innerHTML = renderMonthlyTrendSvg(trends);
  }

  // update range buttons active state
  const rangeBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('.chart-range-btn')
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

  setupDashboardChartsEvents(state, referenceDate);
}
