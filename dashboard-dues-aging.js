/**
 * dashboard-dues-aging.js
 * Outstanding Dues Aging Analytics & Receivables Report Suite.
 *
 * Implements:
 * - Dues aging bucketed into 0-30 / 31-60 / 61-90 / 90+ days past due date from saved bills.
 * - Integration with real cash allocations via calculatePaymentAllocations.
 * - Customer counts + PKR volume per bucket + % share of total receivables.
 * - Multi-bill per-customer bucket distribution (0-30, 31-60, 61-90, 90+).
 * - Pure-vector SVG visualizer (renderDuesAgingSvg) with responsive bars and KPI telemetry.
 * - Customer drill-down list with dynamic filtering (by bucket, area, search query) and direct profile navigation.
 * - RFC-4180 compliant CSV export with UTF-8 BOM.
 * - Formal clipboard briefing summary for management and WhatsApp recovery dispatch.
 * - Accessible dialog modal (setupDuesAgingModal) with keyboard and print support.
 */

import {
  calculatePaymentAllocations,
  formatPKR,
  monthsForHistory
} from './core.js';

export const DUES_AGING_BUCKETS = [
  {
    key: 'b0_30',
    label: '0–30 Days',
    shortLabel: '0–30d',
    rangeLabel: '0 to 30 days overdue',
    minDays: 0,
    maxDays: 30,
    color: '#10b981', // Emerald green
    statusLabel: 'Current / Mild',
    badgeClass: 'aging-badge-mild'
  },
  {
    key: 'b31_60',
    label: '31–60 Days',
    shortLabel: '31–60d',
    rangeLabel: '31 to 60 days overdue',
    minDays: 31,
    maxDays: 60,
    color: '#f59e0b', // Amber
    statusLabel: 'Moderate Overdue',
    badgeClass: 'aging-badge-moderate'
  },
  {
    key: 'b61_90',
    label: '61–90 Days',
    shortLabel: '61–90d',
    rangeLabel: '61 to 90 days overdue',
    minDays: 61,
    maxDays: 90,
    color: '#f97316', // Orange
    statusLabel: 'Severe Overdue',
    badgeClass: 'aging-badge-severe'
  },
  {
    key: 'b90_plus',
    label: '90+ Days',
    shortLabel: '90+d',
    rangeLabel: 'Over 90 days overdue',
    minDays: 91,
    maxDays: Infinity,
    color: '#ef4444', // Red
    statusLabel: 'Critical Delinquency',
    badgeClass: 'aging-badge-critical'
  }
];

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(str) {
  return escapeHtml(str);
}

/**
 * Formats a Date object as YYYY-MM-DD using Pakistan Standard Time (Asia/Karachi) calendar date.
 * @param {Date} date
 * @returns {string}
 */
export function formatDateYmd(date) {
  if (!date || isNaN(date.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Resolves bill due date.
 * If bill has explicit dueDate string, uses that.
 * If bill only has month (YYYY-MM), defaults to 10th of that month (standard ISP due date).
 * @param {object} bill
 * @returns {Date|null}
 */
export function parseBillDueDate(bill) {
  if (!bill) return null;
  if (bill.dueDate) {
    const parts = String(bill.dueDate).split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      const d = Number(parts[2]);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        return new Date(Date.UTC(y, m, d, 7, 0, 0));
      }
    }
    const d = new Date(bill.dueDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (bill.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(bill.month)) {
    const [y, m] = bill.month.split('-');
    return new Date(Date.UTC(Number(y), Number(m) - 1, 10, 7, 0, 0));
  }
  return null;
}

/**
 * Calculates days overdue from bill due date relative to reference date.
 * If due date is in the future, returns 0.
 * Invariant across all execution environments by comparing calendar days in Pakistan time.
 * @param {Date} dueDate
 * @param {Date} referenceDate
 * @returns {number}
 */
export function calculateDaysOverdue(dueDate, referenceDate = new Date()) {
  if (!dueDate || isNaN(dueDate.getTime())) return 0;
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (isNaN(ref.getTime())) return 0;

  const dueYmd = formatDateYmd(dueDate);
  const refYmd = formatDateYmd(ref);
  if (!dueYmd || !refYmd) return 0;

  const [dy, dm, dd] = dueYmd.split('-').map(Number);
  const [ry, rm, rd] = refYmd.split('-').map(Number);

  const dueUtc = Date.UTC(dy, dm - 1, dd);
  const refUtc = Date.UTC(ry, rm - 1, rd);

  const diffDays = Math.floor((refUtc - dueUtc) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Determines which aging bucket key a given overdue day count belongs to.
 * @param {number} daysOverdue
 * @returns {string} 'b0_30' | 'b31_60' | 'b61_90' | 'b90_plus'
 */
export function resolveAgingBucketKey(daysOverdue) {
  if (daysOverdue <= 30) return 'b0_30';
  if (daysOverdue <= 60) return 'b31_60';
  if (daysOverdue <= 90) return 'b61_90';
  return 'b90_plus';
}

/**
 * Calculates comprehensive Dues Aging breakdown across all customer bills.
 *
 * @param {object} state - App state with customers, areas, packages, etc.
 * @param {Date} [referenceDate=new Date()] - Reference calculation date
 * @returns {object} Dues aging breakdown data
 */
export function calculateDuesAgingBreakdown(state, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const refTime = ref.getTime();
  const allocations = calculatePaymentAllocations(state || { customers: [] });
  const retainedMonths = new Set(monthsForHistory(ref));

  const buckets = DUES_AGING_BUCKETS.map(def => ({
    ...def,
    customerCount: 0,
    totalOverdue: 0,
    percentOfTotal: 0,
    customerIds: new Set(),
    unpaidBillsCount: 0
  }));

  const bucketMap = new Map();
  for (const b of buckets) {
    bucketMap.set(b.key, b);
  }

  const customers = [];
  const areaAggregationMap = new Map();

  let totalOutstanding = 0;
  let totalWeightedDayAmount = 0;

  for (const c of (state?.customers ?? [])) {
    if (c.archived) continue;

    let customerDueCents = 0;
    let customerOldestDueDate = null;
    let customerMaxOverdueDays = 0;
    const unpaidBills = [];

    const customerBucketCents = {
      b0_30: 0,
      b31_60: 0,
      b61_90: 0,
      b90_plus: 0
    };

    for (const bill of (c.bills ?? [])) {
      if (!retainedMonths.has(bill.month)) continue;
      const alloc = allocations.forMonth?.(c.id, bill.month);
      const balanceDueCents = alloc?.balanceDueCents ?? Math.round(Number(bill.amount || 0) * 100);

      if (balanceDueCents > 0) {
        customerDueCents += balanceDueCents;
        const bDueDate = parseBillDueDate(bill);
        const daysOverdue = bDueDate ? calculateDaysOverdue(bDueDate, ref) : 0;

        if (daysOverdue > customerMaxOverdueDays) {
          customerMaxOverdueDays = daysOverdue;
        }
        if (bDueDate && (!customerOldestDueDate || bDueDate < customerOldestDueDate)) {
          customerOldestDueDate = bDueDate;
        }

        const bucketKey = resolveAgingBucketKey(daysOverdue);
        customerBucketCents[bucketKey] += balanceDueCents;

        unpaidBills.push({
          month: bill.month,
          dueAmount: Number(bill.dueAmount || bill.amount || 0),
          balanceDue: Math.round(balanceDueCents / 100),
          dueDate: bill.dueDate || (bill.month ? `${bill.month}-10` : ''),
          daysOverdue,
          bucketKey
        });

        const bRef = bucketMap.get(bucketKey);
        if (bRef) {
          bRef.unpaidBillsCount++;
        }
      }
    }

    const totalDue = Math.round(customerDueCents / 100);
    if (totalDue <= 0) continue;

    const b0_30 = Math.round(customerBucketCents.b0_30 / 100);
    const b31_60 = Math.round(customerBucketCents.b31_60 / 100);
    const b61_90 = Math.round(customerBucketCents.b61_90 / 100);
    const b90_plus = Math.round(customerBucketCents.b90_plus / 100);

    // Primary bucket is determined by the oldest bucket containing an unpaid balance
    let primaryBucket = 'b0_30';
    if (b90_plus > 0) primaryBucket = 'b90_plus';
    else if (b61_90 > 0) primaryBucket = 'b61_90';
    else if (b31_60 > 0) primaryBucket = 'b31_60';

    const customerSummary = {
      id: c.id,
      customerNumber: c.customerNumber || '',
      name: c.name || 'Unnamed',
      area: c.area || c.mohalla || 'Unassigned',
      mohalla: c.mohalla || '',
      phone: c.phone || '',
      package: c.packageSpeed || 'Unassigned',
      serviceStatus: c.serviceStatus || 'active',
      totalDue,
      oldestOverdueDays: customerMaxOverdueDays,
      oldestDueDate: customerOldestDueDate ? formatDateYmd(customerOldestDueDate) : '',
      primaryBucket,
      b0_30,
      b31_60,
      b61_90,
      b90_plus,
      unpaidBills
    };

    customers.push(customerSummary);
    totalOutstanding += totalDue;
    totalWeightedDayAmount += (totalDue * customerMaxOverdueDays);

    // Update bucket counts
    if (b0_30 > 0) {
      const b = bucketMap.get('b0_30');
      b.totalOverdue += b0_30;
      b.customerIds.add(c.id);
    }
    if (b31_60 > 0) {
      const b = bucketMap.get('b31_60');
      b.totalOverdue += b31_60;
      b.customerIds.add(c.id);
    }
    if (b61_90 > 0) {
      const b = bucketMap.get('b61_90');
      b.totalOverdue += b61_90;
      b.customerIds.add(c.id);
    }
    if (b90_plus > 0) {
      const b = bucketMap.get('b90_plus');
      b.totalOverdue += b90_plus;
      b.customerIds.add(c.id);
    }

    // Area aggregation
    const areaKey = customerSummary.area;
    if (!areaAggregationMap.has(areaKey)) {
      areaAggregationMap.set(areaKey, {
        areaName: areaKey,
        totalDue: 0,
        customerCount: 0,
        b0_30: 0,
        b31_60: 0,
        b61_90: 0,
        b90_plus: 0
      });
    }
    const areaStats = areaAggregationMap.get(areaKey);
    areaStats.totalDue += totalDue;
    areaStats.customerCount++;
    areaStats.b0_30 += b0_30;
    areaStats.b31_60 += b31_60;
    areaStats.b61_90 += b61_90;
    areaStats.b90_plus += b90_plus;
  }

  // Finalize bucket metrics
  for (const b of buckets) {
    b.customerCount = b.customerIds.size;
    b.percentOfTotal = totalOutstanding > 0
      ? Number(((b.totalOverdue / totalOutstanding) * 100).toFixed(1))
      : 0;
  }

  const criticalOverduePkr = (bucketMap.get('b61_90')?.totalOverdue || 0) + (bucketMap.get('b90_plus')?.totalOverdue || 0);
  const criticalOverduePercent = totalOutstanding > 0
    ? Number(((criticalOverduePkr / totalOutstanding) * 100).toFixed(1))
    : 0;

  const weightedAverageDays = totalOutstanding > 0
    ? Math.round(totalWeightedDayAmount / totalOutstanding)
    : 0;

  let portfolioRiskStatus = 'Low Risk (Healthy Ledger)';
  let portfolioRiskBadgeClass = 'badge-expansion';
  if (totalOutstanding === 0) {
    portfolioRiskStatus = 'Clean Ledger (Zero Receivables)';
    portfolioRiskBadgeClass = 'badge-expansion';
  } else if (criticalOverduePercent >= 40) {
    portfolioRiskStatus = 'High Risk (Severe Aging)';
    portfolioRiskBadgeClass = 'badge-contraction';
  } else if (criticalOverduePercent >= 20) {
    portfolioRiskStatus = 'Moderate Risk (Aging Attention)';
    portfolioRiskBadgeClass = 'badge-stable';
  }

  // Sort customers descending by totalDue, then oldestOverdueDays
  customers.sort((a, b) => b.totalDue - a.totalDue || b.oldestOverdueDays - a.oldestOverdueDays);

  const areas = Array.from(areaAggregationMap.values())
    .sort((a, b) => b.totalDue - a.totalDue || b.customerCount - a.customerCount);

  return {
    referenceDateStr: ref.toISOString().slice(0, 10),
    totalOutstanding,
    totalAccounts: customers.length,
    criticalOverduePkr,
    criticalOverduePercent,
    weightedAverageDays,
    portfolioRiskStatus,
    portfolioRiskBadgeClass,
    buckets,
    customers,
    areas
  };
}

/**
 * Renders pure vector SVG aging breakdown chart.
 * Accessible, responsive, and light/dark theme compatible.
 *
 * @param {object} agingData - Data from calculateDuesAgingBreakdown
 * @param {object} [options={}]
 * @returns {string} SVG markup
 */
export function renderDuesAgingSvg(agingData, options = {}) {
  const width = options.width || 640;
  const height = options.height || 260;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };

  if (!agingData || agingData.totalOutstanding === 0) {
    return `<svg class="chart-svg dues-aging-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="Dues Aging Report: Clean Ledger">
      <rect width="100%" height="100%" rx="8" fill="var(--surface, #1e2624)" fill-opacity="0.2"/>
      <g transform="translate(${width / 2}, ${height / 2})">
        <circle r="26" fill="#10b981" fill-opacity="0.15" stroke="#10b981" stroke-width="2"/>
        <path d="M-8 0 L-2 6 L8 -6" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <text y="42" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="var(--text, #f0f4f2)">Clean Ledger — Zero Overdue Receivables</text>
        <text y="60" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" fill="var(--muted, #71817c)">All subscriber accounts are fully settled with zero aging debt</text>
      </g>
    </svg>`;
  }

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const maxOverdue = Math.max(...agingData.buckets.map(b => b.totalOverdue), 1);
  const numBuckets = agingData.buckets.length;
  const colWidth = plotW / numBuckets;
  const barWidth = Math.min(colWidth * 0.58, 64);

  // Y axis ticks (3 ticks)
  const yTicks = [0, Math.round(maxOverdue * 0.5), maxOverdue];

  let gridMarkup = '';
  yTicks.forEach(tick => {
    const y = padding.top + plotH - (tick / maxOverdue) * plotH;
    gridMarkup += `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border, #2a3834)" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
      <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-family="'DM Sans', monospace" font-size="10" fill="var(--muted, #71817c)">${formatPKR(tick).replace('PKR ', '')}</text>
    `;
  });

  let barsMarkup = '';
  agingData.buckets.forEach((b, idx) => {
    const cx = padding.left + (idx + 0.5) * colWidth;
    const barX = cx - barWidth / 2;
    const barH = Math.max(4, (b.totalOverdue / maxOverdue) * plotH);
    const barY = padding.top + plotH - barH;

    barsMarkup += `
      <g class="aging-bar-group" data-bucket-key="${b.key}">
        <!-- Bar shadow / track -->
        <rect x="${barX}" y="${padding.top}" width="${barWidth}" height="${plotH}" rx="4" fill="var(--border, #2a3834)" fill-opacity="0.12"/>
        <!-- Value Bar -->
        <rect class="aging-bar" x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" rx="4" fill="${b.color}">
          <title>${escapeXml(b.label)}: ${formatPKR(b.totalOverdue)} (${b.customerCount} accounts, ${b.percentOfTotal}%)</title>
        </rect>
        <!-- Amount Label above bar -->
        <text x="${cx}" y="${barY - 8}" text-anchor="middle" font-family="'DM Sans', monospace" font-size="11" font-weight="700" fill="var(--text, #f0f4f2)">${formatPKR(b.totalOverdue)}</text>
        <!-- Percent badge -->
        <text x="${cx}" y="${barY - 22}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="${b.color}">${b.percentOfTotal}%</text>
        <!-- X Axis Label -->
        <text x="${cx}" y="${height - padding.bottom + 18}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="var(--text, #f0f4f2)">${escapeXml(b.label)}</text>
        <!-- Account count label -->
        <text x="${cx}" y="${height - padding.bottom + 32}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">${b.customerCount} accounts</text>
      </g>
    `;
  });

  return `<svg class="chart-svg dues-aging-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="Dues Aging Breakdown Chart: Total Outstanding ${formatPKR(agingData.totalOutstanding)} across ${agingData.totalAccounts} accounts">
    <rect width="100%" height="100%" rx="8" fill="var(--surface, #1e2624)" fill-opacity="0.1"/>
    ${gridMarkup}
    <!-- Base axis line -->
    <line x1="${padding.left}" y1="${padding.top + plotH}" x2="${width - padding.right}" y2="${padding.top + plotH}" stroke="var(--border, #2a3834)" stroke-width="1.5"/>
    ${barsMarkup}
  </svg>`;
}

/**
 * Generates RFC-4180 compliant CSV export for Dues Aging report.
 * Includes UTF-8 BOM, executive bucket summary, and customer drill-down rows.
 *
 * @param {object} agingData - Data from calculateDuesAgingBreakdown
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} CSV content
 */
export function generateDuesAgingCsv(agingData, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);

  function csvEscape(val) {
    if (val === null || val === undefined) return '""';
    const s = String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return `"${s}"`;
  }

  const rows = [];
  rows.push(['SHAHDARA ISP - DUES AGING & RECEIVABLES REPORT', `As of ${dateStr} PKT`].map(csvEscape).join(','));
  rows.push(['Portfolio Status', agingData.portfolioRiskStatus, 'Total Accounts', agingData.totalAccounts, 'Total Receivables (PKR)', agingData.totalOutstanding].map(csvEscape).join(','));
  rows.push(['Critical Overdue 61+ Days (PKR)', agingData.criticalOverduePkr, 'Critical Overdue %', `${agingData.criticalOverduePercent}%`, 'Weighted Avg Overdue Days', agingData.weightedAverageDays].map(csvEscape).join(','));
  rows.push('');

  rows.push(['--- AGING BUCKETS EXECUTIVE SUMMARY ---'].map(csvEscape).join(','));
  rows.push(['Aging Bucket', 'Days Window', 'Subscriber Accounts', 'Unpaid Bills Count', 'Overdue Balance (PKR)', 'Portfolio Share (%)'].map(csvEscape).join(','));

  for (const b of agingData.buckets) {
    rows.push([
      b.label,
      b.rangeLabel,
      b.customerCount,
      b.unpaidBillsCount,
      b.totalOverdue,
      `${b.percentOfTotal}%`
    ].map(csvEscape).join(','));
  }

  rows.push([
    'TOTAL OVERDUE',
    'All Aging Periods',
    agingData.totalAccounts,
    agingData.buckets.reduce((acc, b) => acc + b.unpaidBillsCount, 0),
    agingData.totalOutstanding,
    '100.0%'
  ].map(csvEscape).join(','));
  rows.push('');

  rows.push(['--- SUBSCRIBER RECEIVABLES DRILL-DOWN LEDGER ---'].map(csvEscape).join(','));
  rows.push([
    'Customer ID',
    'Account Number',
    'Customer Name',
    'Area / Sector',
    'Mohalla',
    'Phone',
    'Package Speed',
    'Service Status',
    '0-30 Days (PKR)',
    '31-60 Days (PKR)',
    '61-90 Days (PKR)',
    '90+ Days (PKR)',
    'Total Outstanding (PKR)',
    'Max Overdue Days',
    'Oldest Due Date',
    'Unpaid Bills Count'
  ].map(csvEscape).join(','));

  for (const c of agingData.customers) {
    rows.push([
      c.id,
      c.customerNumber,
      c.name,
      c.area,
      c.mohalla || '',
      c.phone || '',
      c.package,
      c.serviceStatus,
      c.b0_30,
      c.b31_60,
      c.b61_90,
      c.b90_plus,
      c.totalDue,
      c.oldestOverdueDays,
      c.oldestDueDate,
      c.unpaidBills.length
    ].map(csvEscape).join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Formats a clean briefing text summary for clipboard copying or WhatsApp dispatch.
 *
 * @param {object} agingData
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} Formatted plain text briefing
 */
export function generateDuesAgingBriefing(agingData, referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const dateStr = ref.toISOString().slice(0, 10);

  const lines = [
    `📊 SHAHDARA ISP - DUES AGING & RECEIVABLES BRIEFING`,
    `As of: ${dateStr} PKT`,
    `--------------------------------------------------`,
    `[ RECEIVABLES OVERVIEW ]`,
    `  Portfolio Risk Status: ${agingData.portfolioRiskStatus}`,
    `  Total Overdue Receivables: ${formatPKR(agingData.totalOutstanding)}`,
    `  Delinquent Accounts: ${agingData.totalAccounts}`,
    `  Critical Dues (61+ Days): ${formatPKR(agingData.criticalOverduePkr)} (${agingData.criticalOverduePercent}%)`,
    `  Weighted Average Aging: ${agingData.weightedAverageDays} days overdue`,
    ``,
    `[ AGING BUCKETS BREAKDOWN ]`
  ];

  for (const b of agingData.buckets) {
    lines.push(`  • ${b.label} (${b.rangeLabel}):`);
    lines.push(`    Accounts: ${b.customerCount} | Total: ${formatPKR(b.totalOverdue)} (${b.percentOfTotal}%)`);
  }

  lines.push(``);
  lines.push(`[ TOP PRIORITY DELINQUENT SUBSCRIBERS ]`);
  if (agingData.customers.length === 0) {
    lines.push(`  No delinquent accounts recorded`);
  } else {
    agingData.customers.slice(0, 10).forEach((c, idx) => {
      lines.push(`  ${idx + 1}. ${c.name} (${c.area}) - ${formatPKR(c.totalDue)} [${c.oldestOverdueDays}d overdue, ${c.phone || 'No phone'}]`);
    });
  }

  lines.push(``);
  lines.push(`[ AREA AGING CONCENTRATION ]`);
  if (agingData.areas.length === 0) {
    lines.push(`  No area data`);
  } else {
    agingData.areas.slice(0, 5).forEach((a, idx) => {
      lines.push(`  ${idx + 1}. ${a.areaName}: ${formatPKR(a.totalDue)} across ${a.customerCount} accounts`);
    });
  }

  lines.push(`--------------------------------------------------`);
  lines.push(`Shahdara ISP Business Accounting & Cashflow Protection`);
  return lines.join('\n');
}

/**
 * Controller for Dues Aging Dialog Modal.
 * Wires events, live filtering, SVG chart rendering, CSV export, and customer navigation.
 *
 * @param {object} state - App state
 * @param {object} [options={}]
 * @returns {object} Controller interface
 */
export function setupDuesAgingModal(state, options = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
    return {
      open: () => {},
      close: () => {},
      refresh: () => {}
    };
  }

  const modal = document.getElementById('duesAgingModal');
  if (!modal) return { open: () => {}, close: () => {}, refresh: () => {} };

  const openBtns = typeof document.querySelectorAll === 'function'
    ? Array.from(document.querySelectorAll('#dashboardOpenDuesAgingBtn, #openDuesAgingBtn, #delinquencyOpenAgingModalBtn'))
    : [document.getElementById('dashboardOpenDuesAgingBtn'), document.getElementById('openDuesAgingBtn'), document.getElementById('delinquencyOpenAgingModalBtn')].filter(Boolean);
  const closeBtn = document.getElementById('closeDuesAgingModalBtn');
  const secondaryCloseBtn = document.getElementById('closeDuesAgingSecondaryBtn');

  const chartEl = document.getElementById('duesAgingSvgChart');
  const tableBody = document.getElementById('duesAgingTableBody');
  const searchInput = document.getElementById('duesAgingSearchInput');
  const areaSelect = document.getElementById('duesAgingAreaSelect');
  const bucketFilterContainer = document.getElementById('duesAgingBucketFilters');
  const exportCsvBtn = document.getElementById('duesAgingExportCsvBtn');
  const copyBriefingBtn = document.getElementById('duesAgingCopyBriefingBtn');
  const printBtn = document.getElementById('duesAgingPrintBtn');

  // KPI elements
  const totalOutstandingEl = document.getElementById('duesAgingTotalOutstandingVal');
  const totalAccountsEl = document.getElementById('duesAgingTotalAccountsVal');
  const criticalDuesEl = document.getElementById('duesAgingCriticalDuesVal');
  const weightedDaysEl = document.getElementById('duesAgingWeightedDaysVal');
  const riskStatusBadge = document.getElementById('duesAgingRiskStatusBadge');

  let activeBucketFilter = 'all';
  let activeSearchQuery = '';
  let activeAreaFilter = 'all';
  let activeSortField = 'totalDue';
  let activeSortDirection = 'desc';

  function getLatestData() {
    return calculateDuesAgingBreakdown(state, options.referenceDate || new Date());
  }

  function renderTable(agingData) {
    if (!tableBody) return;

    let filtered = [...agingData.customers];

    // Filter by bucket
    if (activeBucketFilter !== 'all') {
      filtered = filtered.filter(c => {
        if (activeBucketFilter === 'b0_30') return c.b0_30 > 0;
        if (activeBucketFilter === 'b31_60') return c.b31_60 > 0;
        if (activeBucketFilter === 'b61_90') return c.b61_90 > 0;
        if (activeBucketFilter === 'b90_plus') return c.b90_plus > 0;
        return true;
      });
    }

    // Filter by area
    if (activeAreaFilter !== 'all') {
      filtered = filtered.filter(c => c.area === activeAreaFilter);
    }

    // Filter by search query
    if (activeSearchQuery.trim()) {
      const q = activeSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.customerNumber.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let valA = a[activeSortField];
      let valB = b[activeSortField];
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return activeSortDirection === 'asc' ? cmp : -cmp;
      }
      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return activeSortDirection === 'asc' ? valA - valB : valB - valA;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="10" class="empty-cell" style="text-align: center; padding: 24px; color: var(--muted, #71817c);">
        No subscriber accounts match the selected aging filter.
      </td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map(c => {
      const statusPillClass = c.oldestOverdueDays >= 90
        ? 'aging-pill-critical'
        : (c.oldestOverdueDays >= 60
          ? 'aging-pill-severe'
          : (c.oldestOverdueDays >= 30 ? 'aging-pill-moderate' : 'aging-pill-mild'));

      return `
        <tr data-customer-row-id="${escapeHtml(c.id)}">
          <td>
            <strong>${escapeHtml(c.name)}</strong>
            ${c.customerNumber ? `<span class="text-muted" style="display: block; font-size: 11px;">#${escapeHtml(c.customerNumber)}</span>` : ''}
          </td>
          <td>${escapeHtml(c.area)}</td>
          <td>
            ${c.phone ? `<a href="tel:${escapeHtml(c.phone)}" class="table-link">${escapeHtml(c.phone)}</a>` : '<span class="text-muted">—</span>'}
          </td>
          <td class="num-cell" style="${c.b0_30 > 0 ? 'color: #10b981; font-weight: 600;' : 'color: var(--muted);'}">
            ${c.b0_30 > 0 ? formatPKR(c.b0_30) : '—'}
          </td>
          <td class="num-cell" style="${c.b31_60 > 0 ? 'color: #f59e0b; font-weight: 600;' : 'color: var(--muted);'}">
            ${c.b31_60 > 0 ? formatPKR(c.b31_60) : '—'}
          </td>
          <td class="num-cell" style="${c.b61_90 > 0 ? 'color: #f97316; font-weight: 600;' : 'color: var(--muted);'}">
            ${c.b61_90 > 0 ? formatPKR(c.b61_90) : '—'}
          </td>
          <td class="num-cell" style="${c.b90_plus > 0 ? 'color: #ef4444; font-weight: 700;' : 'color: var(--muted);'}">
            ${c.b90_plus > 0 ? formatPKR(c.b90_plus) : '—'}
          </td>
          <td class="num-cell" style="font-weight: 700; color: #b91c1c;">
            ${formatPKR(c.totalDue)}
          </td>
          <td>
            <span class="status-pill ${statusPillClass}">${c.oldestOverdueDays}d overdue</span>
          </td>
          <td style="text-align: right;">
            <button class="small-action-btn dues-view-profile-btn" type="button" data-dues-customer-id="${escapeHtml(c.id)}">
              View Profile
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire drill-down profile buttons
    const profileBtns = tableBody.querySelectorAll('[data-dues-customer-id]');
    profileBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const customerId = btn.getAttribute('data-dues-customer-id');
        if (typeof options.onFilterCustomer === 'function' && customerId) {
          options.onFilterCustomer(customerId);
          closeModal();
        }
      });
    });
  }

  function populateModal() {
    const data = getLatestData();

    if (totalOutstandingEl) totalOutstandingEl.textContent = formatPKR(data.totalOutstanding);
    if (totalAccountsEl) totalAccountsEl.textContent = String(data.totalAccounts);
    if (criticalDuesEl) {
      criticalDuesEl.textContent = formatPKR(data.criticalOverduePkr);
      const sub = document.getElementById('duesAgingCriticalSub');
      if (sub) sub.textContent = `${data.criticalOverduePercent}% of total receivables`;
    }
    if (weightedDaysEl) weightedDaysEl.textContent = `${data.weightedAverageDays} days`;

    if (riskStatusBadge) {
      riskStatusBadge.textContent = data.portfolioRiskStatus;
      riskStatusBadge.className = `sim-delta-badge ${data.portfolioRiskBadgeClass}`;
    }

    // Populate SVG chart
    if (chartEl) {
      chartEl.innerHTML = renderDuesAgingSvg(data);
    }

    // Populate Area dropdown if needed
    if (areaSelect && areaSelect.options && areaSelect.options.length <= 1 && typeof document.createElement === 'function') {
      const existingAreas = data.areas.map(a => a.areaName);
      existingAreas.forEach(aName => {
        const opt = document.createElement('option');
        opt.value = aName;
        opt.textContent = aName;
        areaSelect.appendChild(opt);
      });
    }

    // Update bucket tabs count badges
    if (bucketFilterContainer) {
      const tabAllBadge = bucketFilterContainer.querySelector('[data-bucket-filter="all"] .bucket-count-badge');
      if (tabAllBadge) tabAllBadge.textContent = String(data.totalAccounts);

      data.buckets.forEach(b => {
        const badge = bucketFilterContainer.querySelector(`[data-bucket-filter="${b.key}"] .bucket-count-badge`);
        if (badge) badge.textContent = String(b.customerCount);
      });
    }

    renderTable(data);
  }

  function openModal() {
    populateModal();
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function closeModal() {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  // Event wiring for open buttons
  openBtns.forEach(btn => {
    if (!btn.dataset?.wired) {
      if (btn.dataset) btn.dataset.wired = 'true';
      btn.addEventListener('click', openModal);
    }
  });

  // Event wiring for close buttons
  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    closeBtn.addEventListener('click', closeModal);
  }
  if (secondaryCloseBtn && !secondaryCloseBtn.dataset?.wired) {
    if (secondaryCloseBtn.dataset) secondaryCloseBtn.dataset.wired = 'true';
    secondaryCloseBtn.addEventListener('click', closeModal);
  }

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Bucket filter tabs
  if (bucketFilterContainer && !bucketFilterContainer.dataset?.wired) {
    if (bucketFilterContainer.dataset) bucketFilterContainer.dataset.wired = 'true';
    bucketFilterContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-bucket-filter]');
      if (!tab) return;
      bucketFilterContainer.querySelectorAll('[data-bucket-filter]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeBucketFilter = tab.getAttribute('data-bucket-filter') || 'all';
      renderTable(getLatestData());
    });
  }

  // Search input
  if (searchInput && !searchInput.dataset?.wired) {
    if (searchInput.dataset) searchInput.dataset.wired = 'true';
    searchInput.addEventListener('input', (e) => {
      activeSearchQuery = e.target.value || '';
      renderTable(getLatestData());
    });
  }

  // Area select
  if (areaSelect && !areaSelect.dataset?.wired) {
    if (areaSelect.dataset) areaSelect.dataset.wired = 'true';
    areaSelect.addEventListener('change', (e) => {
      activeAreaFilter = e.target.value || 'all';
      renderTable(getLatestData());
    });
  }

  // Export CSV
  if (exportCsvBtn && !exportCsvBtn.dataset?.wired) {
    if (exportCsvBtn.dataset) exportCsvBtn.dataset.wired = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const data = getLatestData();
      const csv = generateDuesAgingCsv(data, options.referenceDate || new Date());
      const dateStr = (options.referenceDate || new Date()).toISOString().slice(0, 10);
      const filename = `shahdara-dues-aging-${dateStr}.csv`;

      if (typeof window !== 'undefined' && typeof document.createElement === 'function') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      if (typeof options.onToast === 'function') {
        options.onToast(`Exported ${filename}`);
      }
    });
  }

  // Copy Briefing
  if (copyBriefingBtn && !copyBriefingBtn.dataset?.wired) {
    if (copyBriefingBtn.dataset) copyBriefingBtn.dataset.wired = 'true';
    copyBriefingBtn.addEventListener('click', async () => {
      const data = getLatestData();
      const briefing = generateDuesAgingBriefing(data, options.referenceDate || new Date());
      const clip = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(briefing);
          if (typeof options.onToast === 'function') {
            options.onToast('Dues Aging summary copied to clipboard');
          }
        } catch {
          // Fallback
        }
      }
    });
  }

  // Print
  if (printBtn && !printBtn.dataset?.wired) {
    if (printBtn.dataset) printBtn.dataset.wired = 'true';
    printBtn.addEventListener('click', () => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
    });
  }

  return {
    open: openModal,
    close: closeModal,
    refresh: populateModal
  };
}
