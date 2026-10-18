/**
 * dashboard-area-collections.js
 * Area-Wise Collections, Mohalla Billing & Recovery Performance Suite.
 *
 * Implements:
 * - Granular area & mohalla financial tracking for any selected calendar month.
 * - Per area/mohalla/zone metrics: Billed PKR, Cash Collected PKR, Outstanding PKR, Collection Rate %, Collection Gap PKR.
 * - Customer demographics per area: total profiles, active subscriptions, offline count.
 * - Recovery Performance Tiers: Optimal (85%+), Moderate (60-84%), Lagging (<60%), No Activity.
 * - Pure-vector SVG grouped bar chart (renderAreaCollectionsSvg) comparing Billed vs Collected vs Outstanding.
 * - RFC-4180 CSV export with UTF-8 BOM.
 * - Dual printable formats: A4 Executive Area Manifest and 80mm POS field collector slip.
 * - Bilingual Urdu & English executive briefing generator with one-tap clipboard copy.
 * - Accessible modal dialog controller (setupAreaCollectionsModal) with month selector, search, sortable table, and direct customer roster filtering.
 */

import {
  monthsForHistory,
  formatPKR,
  derivedBillStatus,
  calculatePaymentAllocations
} from './core.js';
import {
  canonicalLocation,
  pktDate,
  pktMonth,
  monthEnd,
  outstandingAtMonthEnd
} from './phase3.js';

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
 * Formats a Date object as YYYY-MM-DD using Pakistan Standard Time (Asia/Karachi).
 * @param {Date} date
 * @returns {string}
 */
export function formatDateYmd(date = new Date()) {
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
 * Normalizes customer location into structured hierarchy.
 * @param {Object} customer
 * @returns {Object} { area, separateMohalla, zone }
 */
export function resolveCustomerLocation(customer) {
  const explicitArea = canonicalLocation(customer.area);
  const mohalla = canonicalLocation(customer.mohalla);
  const area = explicitArea ?? mohalla;
  const separateMohalla = explicitArea && mohalla && explicitArea.key !== mohalla.key ? mohalla : null;
  const zone = canonicalLocation(customer.zone);
  return { area, separateMohalla, zone };
}

/**
 * Builds area descriptors for hierarchical or flat rollup.
 * @param {Object} path - output of resolveCustomerLocation
 * @returns {Array<Object>}
 */
export function getAreaDescriptors(path) {
  if (!path.area) {
    return [{
      id: 'unassigned',
      areaName: 'Unassigned',
      key: '__unassigned__',
      rootArea: 'Unassigned',
      level: 'unassigned',
      parentArea: '',
      depth: 0
    }];
  }

  const output = [];
  const areaId = `area:${path.area.key}`;
  const areaLabel = path.area.label;
  output.push({
    id: areaId,
    areaName: areaLabel,
    key: path.area.key,
    rootArea: areaLabel,
    level: 'area',
    parentArea: '',
    depth: 0
  });

  let parentId = areaId;
  let parentLabel = areaLabel;

  if (path.separateMohalla) {
    parentId = `mohalla:${path.area.key}:${path.separateMohalla.key}`;
    parentLabel = path.separateMohalla.label;
    output.push({
      id: parentId,
      areaName: parentLabel,
      key: path.separateMohalla.key,
      rootArea: areaLabel,
      level: 'mohalla',
      parentArea: areaLabel,
      depth: 1
    });
  }

  if (path.zone) {
    const zoneKey = path.zone.key;
    const zoneLabel = path.zone.label;
    output.push({
      id: `zone:${parentId}:${zoneKey}`,
      areaName: zoneLabel,
      key: zoneKey,
      rootArea: areaLabel,
      level: 'zone',
      parentArea: parentLabel,
      depth: path.separateMohalla ? 2 : 1
    });
  }

  return output;
}

/**
 * Evaluates area-wise collections, billings, and outstanding dues for a selected month.
 *
 * @param {Object} state - Full application state
 * @param {Object} [options]
 * @param {string} [options.month] - Calendar month (YYYY-MM). Defaults to current PKT month.
 * @param {string} [options.level='all'] - 'all', 'area', 'mohalla'
 * @param {string} [options.search=''] - Search term for area name
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object} Area collections data and summary metrics
 */
export function calculateAreaWiseCollections(state, {
  month = null,
  level = 'all',
  search = '',
  referenceDate = new Date()
} = {}) {
  const currentPktMonth = pktMonth(referenceDate);
  const selectedMonth = (month && /^\d{4}-\d{2}$/.test(month)) ? month : currentPktMonth;
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const todayYmd = pktDate(referenceDate);

  // Month date range
  const monthStart = `${selectedMonth}-01`;
  const calculatedMonthEnd = monthEnd(selectedMonth);
  const cutoffDate = selectedMonth === currentPktMonth && todayYmd < calculatedMonthEnd
    ? todayYmd
    : calculatedMonthEnd;

  // Outstanding balances through this month end
  const cutoffDateTime = new Date(`${cutoffDate}T23:59:59+05:00`);
  const outstandingResult = outstandingAtMonthEnd({ customers }, selectedMonth, cutoffDateTime);
  const allocations = calculatePaymentAllocations(state || { customers: [] });

  const groupsMap = new Map();

  const ensureGroup = (descriptor) => {
    if (!groupsMap.has(descriptor.id)) {
      groupsMap.set(descriptor.id, {
        ...descriptor,
        customerIds: new Set(),
        activeCustomers: 0,
        offlineCustomers: 0,
        unsetCustomers: 0,
        billedCents: 0,
        billCount: 0,
        collectedCents: 0,
        receiptCount: 0,
        outstandingCents: 0,
        paidBillsCount: 0,
        partialBillsCount: 0,
        unpaidBillsCount: 0
      });
    }
    return groupsMap.get(descriptor.id);
  };

  // Map customers into location groups
  const customerDescriptorsMap = new Map();
  for (const c of customers) {
    if (c.archived) continue;
    const path = resolveCustomerLocation(c);
    const descriptors = getAreaDescriptors(path);
    const ids = [];
    for (const d of descriptors) {
      const g = ensureGroup(d);
      g.customerIds.add(c.id);
      if (c.serviceStatus === 'active') g.activeCustomers++;
      else if (c.serviceStatus === 'offline') g.offlineCustomers++;
      else g.unsetCustomers++;
      ids.push(g.id);
    }
    customerDescriptorsMap.set(c.id, ids);
  }

  // Accumulate billed revenue for selected month
  for (const c of customers) {
    if (c.archived) continue;
    const groupIds = customerDescriptorsMap.get(c.id) || [];
    const bills = Array.isArray(c.bills) ? c.bills : [];

    for (const bill of bills) {
      if (bill.month === selectedMonth) {
        const amt = Number(bill.dueAmount);
        const hasPrice = Number.isFinite(amt) && amt > 0;
        if (hasPrice) {
          const centsVal = Math.round(amt * 100);
          const status = derivedBillStatus(c, bill, allocations);
          for (const gid of groupIds) {
            const g = groupsMap.get(gid);
            if (g) {
              g.billedCents += centsVal;
              g.billCount++;
              if (status === 'PAID' || status === 'paid') g.paidBillsCount++;
              else if (status === 'PARTIAL' || status === 'partial') g.partialBillsCount++;
              else g.unpaidBillsCount++;
            }
          }
        }
      }

      // Cash receipts dated within selected month
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const p of payments) {
        if (typeof p.date === 'string' && p.date.startsWith(selectedMonth)) {
          const pAmt = Number(p.amount) || 0;
          if (pAmt > 0) {
            const pCents = Math.round(pAmt * 100);
            for (const gid of groupIds) {
              const g = groupsMap.get(gid);
              if (g) {
                g.collectedCents += pCents;
                g.receiptCount++;
              }
            }
          }
        }
      }
    }

    // Cumulative outstanding through selected month
    const customerOutstanding = outstandingResult.byCustomer?.get(c.id) ?? 0;
    if (customerOutstanding > 0) {
      const outCents = Math.round(customerOutstanding * 100);
      for (const gid of groupIds) {
        const g = groupsMap.get(gid);
        if (g) {
          g.outstandingCents += outCents;
        }
      }
    }
  }

  // Finalize rows and calculate rates
  let rawRows = [...groupsMap.values()].map(g => {
    const totalCustomers = g.customerIds.size;
    const billedAmount = Math.round(g.billedCents / 100);
    const collectedAmount = Math.round(g.collectedCents / 100);
    const outstanding = Math.round(g.outstandingCents / 100);
    const collectionGap = Math.max(0, billedAmount - collectedAmount);

    let collectionRate = null;
    if (billedAmount > 0) {
      collectionRate = Math.round((collectedAmount / billedAmount) * 100);
    } else if (collectedAmount > 0) {
      collectionRate = 100;
    }

    let tier = 'no-billing';
    let tierLabel = 'No Activity';
    let tierColor = '#64748b';

    if (billedAmount > 0 || collectedAmount > 0) {
      if (collectionRate !== null && collectionRate >= 85) {
        tier = 'optimal';
        tierLabel = 'Optimal (85%+)';
        tierColor = '#10b981';
      } else if (collectionRate !== null && collectionRate >= 60) {
        tier = 'moderate';
        tierLabel = 'Moderate (60-84%)';
        tierColor = '#f59e0b';
      } else {
        tier = 'lagging';
        tierLabel = 'Lagging (<60%)';
        tierColor = '#ef4444';
      }
    }

    const arpu = g.activeCustomers > 0 && billedAmount > 0
      ? Math.round(billedAmount / g.activeCustomers)
      : 0;

    return {
      id: g.id,
      areaName: g.areaName,
      key: g.key,
      rootArea: g.rootArea,
      level: g.level,
      parentArea: g.parentArea,
      depth: g.depth,
      totalCustomers,
      activeCustomers: g.activeCustomers,
      offlineCustomers: g.offlineCustomers,
      unsetCustomers: g.unsetCustomers,
      billedAmount,
      billCount: g.billCount,
      collectedAmount,
      receiptCount: g.receiptCount,
      outstanding,
      collectionRate,
      collectionGap,
      tier,
      tierLabel,
      tierColor,
      arpu,
      paidBillsCount: g.paidBillsCount,
      partialBillsCount: g.partialBillsCount,
      unpaidBillsCount: g.unpaidBillsCount
    };
  });

  // Calculate summary statistics across primary areas (level === 'area' or 'unassigned')
  const primaryAreaRows = rawRows.filter(r => r.level === 'area' || r.level === 'unassigned');
  let sumBilled = 0;
  let sumCollected = 0;
  let sumOutstanding = 0;
  let optimalCount = 0;
  let moderateCount = 0;
  let laggingCount = 0;

  for (const r of primaryAreaRows) {
    sumBilled += r.billedAmount;
    sumCollected += r.collectedAmount;
    sumOutstanding += r.outstanding;
    if (r.tier === 'optimal') optimalCount++;
    else if (r.tier === 'moderate') moderateCount++;
    else if (r.tier === 'lagging') laggingCount++;
  }

  const overallCollectionRate = sumBilled > 0
    ? Math.round((sumCollected / sumBilled) * 100)
    : (sumCollected > 0 ? 100 : 0);

  const topPerforming = [...primaryAreaRows]
    .filter(r => r.billedAmount > 0 && r.collectionRate !== null)
    .sort((a, b) => b.collectionRate - a.collectionRate || b.collectedAmount - a.collectedAmount)[0] || null;

  const highestOutstanding = [...primaryAreaRows]
    .sort((a, b) => b.outstanding - a.outstanding)[0] || null;

  const highestBilled = [...primaryAreaRows]
    .sort((a, b) => b.billedAmount - a.billedAmount)[0] || null;

  // Filter rows by level if specified
  let filteredRows = rawRows;
  if (level === 'area') {
    filteredRows = rawRows.filter(r => r.level === 'area' || r.level === 'unassigned');
  } else if (level === 'mohalla') {
    filteredRows = rawRows.filter(r => r.level === 'mohalla' || (r.level === 'area' && !rawRows.some(sub => sub.parentArea === r.areaName)));
  }

  // Filter rows by search term
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filteredRows = filteredRows.filter(r =>
      r.areaName.toLowerCase().includes(q) ||
      (r.parentArea && r.parentArea.toLowerCase().includes(q)) ||
      (r.rootArea && r.rootArea.toLowerCase().includes(q))
    );
  }

  // Default sorting: primary area alphabetical, depth, then billed volume
  filteredRows.sort((a, b) =>
    (a.rootArea || '').localeCompare(b.rootArea || '') ||
    a.depth - b.depth ||
    b.billedAmount - a.billedAmount
  );

  return {
    selectedMonth,
    cutoffDate,
    rows: filteredRows,
    allRows: rawRows,
    summary: {
      totalAreas: primaryAreaRows.length,
      totalBilled: sumBilled,
      totalCollected: sumCollected,
      totalOutstanding: sumOutstanding,
      overallCollectionRate,
      totalCollectionGap: Math.max(0, sumBilled - sumCollected),
      optimalCount,
      moderateCount,
      laggingCount,
      topPerformingArea: topPerforming ? topPerforming.areaName : 'None',
      topPerformingRate: topPerforming ? topPerforming.collectionRate : 0,
      highestOutstandingArea: highestOutstanding ? highestOutstanding.areaName : 'None',
      highestOutstandingAmount: highestOutstanding ? highestOutstanding.outstanding : 0,
      highestBilledArea: highestBilled ? highestBilled.areaName : 'None',
      highestBilledAmount: highestBilled ? highestBilled.billedAmount : 0
    }
  };
}

/**
 * Renders a pure vector SVG grouped bar chart comparing Billed vs Collected vs Outstanding.
 *
 * @param {Object} collectionsData - Output of calculateAreaWiseCollections
 * @param {Object} [options]
 * @param {number} [options.width=700]
 * @returns {string} SVG markup
 */
export function renderAreaCollectionsSvg(collectionsData, {
  width = 700
} = {}) {
  // Use top areas by billed volume or outstanding (up to 8)
  const allRows = collectionsData?.allRows || collectionsData?.rows || [];
  const primaryRows = allRows
    .filter(r => r.level === 'area' || r.level === 'unassigned')
    .sort((a, b) => b.billedAmount - a.billedAmount || b.outstanding - a.outstanding)
    .slice(0, 8);

  const summary = collectionsData?.summary || {};
  const month = collectionsData?.selectedMonth || '';

  const svgWidth = Math.max(500, width);
  const startY = 82;
  const areaBlockHeight = 44;
  const barGap = 4;
  const singleBarHeight = 8;
  const labelWidth = 140;
  const maxBarWidth = svgWidth - labelWidth - 110;
  const height = Math.max(220, startY + (primaryRows.length * areaBlockHeight) + 40);

  // Maximum value for scale
  let maxVal = 1000;
  for (const r of primaryRows) {
    if (r.billedAmount > maxVal) maxVal = r.billedAmount;
    if (r.collectedAmount > maxVal) maxVal = r.collectedAmount;
    if (r.outstanding > maxVal) maxVal = r.outstanding;
  }

  const areaElements = primaryRows.map((r, index) => {
    const y = startY + index * areaBlockHeight;
    const billedW = Math.max(4, Math.round((r.billedAmount / maxVal) * maxBarWidth));
    const collectedW = Math.max(4, Math.round((r.collectedAmount / maxVal) * maxBarWidth));
    const outstandingW = Math.max(4, Math.round((r.outstanding / maxVal) * maxBarWidth));

    const rateText = r.collectionRate !== null ? `${r.collectionRate}%` : 'N/A';
    const safeName = escapeXml(r.areaName.length > 17 ? r.areaName.slice(0, 16) + '…' : r.areaName);

    return `
      <g class="area-svg-group" data-area="${escapeXml(r.areaName)}">
        <!-- Area Name & Customer Count -->
        <text x="18" y="${y + 14}" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #1e293b)">
          ${safeName}
        </text>
        <text x="18" y="${y + 26}" font-family="system-ui, sans-serif" font-size="9" fill="var(--text-muted, #64748b)">
          ${r.totalCustomers} sub (${r.activeCustomers} act)
        </text>

        <!-- Billed Bar (Indigo/Blue) -->
        <rect x="${labelWidth}" y="${y + 2}" width="${billedW}" height="${singleBarHeight}" rx="2" fill="url(#areaBilledGrad)"/>

        <!-- Collected Bar (Emerald) -->
        <rect x="${labelWidth}" y="${y + 13}" width="${collectedW}" height="${singleBarHeight}" rx="2" fill="url(#areaCollectedGrad)"/>

        <!-- Outstanding Bar (Amber) -->
        <rect x="${labelWidth}" y="${y + 24}" width="${outstandingW}" height="${singleBarHeight}" rx="2" fill="url(#areaOutstandingGrad)"/>

        <!-- Collection Rate Badge -->
        <rect x="${svgWidth - 90}" y="${y + 6}" width="72" height="20" rx="4" fill="${r.tierColor}" fill-opacity="0.15" stroke="${r.tierColor}" stroke-width="1"/>
        <text x="${svgWidth - 54}" y="${y + 19}" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${r.tierColor}" text-anchor="middle">
          ${rateText}
        </text>
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${svgWidth} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Area-Wise Collections vs Billing Chart">
      <defs>
        <linearGradient id="areaBilledGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
        <linearGradient id="areaCollectedGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
        <linearGradient id="areaOutstandingGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#d97706"/>
        </linearGradient>
      </defs>

      <!-- Card Background -->
      <rect x="0" y="0" width="${svgWidth}" height="${height}" rx="8" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5"/>

      <!-- Header Title & Legend -->
      <text x="20" y="26" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="var(--text-color, #1e293b)">
        Area Collections Breakdown · ${escapeXml(month)}
      </text>
      <text x="20" y="42" font-family="system-ui, sans-serif" font-size="10" fill="var(--text-muted, #64748b)">
        Grouped revenue comparison: Billed vs Cash Collected vs Outstanding
      </text>

      <!-- Legend items -->
      <g transform="translate(${svgWidth - 275}, 18)">
        <rect x="0" y="3" width="8" height="8" rx="2" fill="#3b82f6"/>
        <text x="12" y="10" font-family="system-ui, sans-serif" font-size="9" fill="var(--text-color, #334155)">Billed</text>

        <rect x="65" y="3" width="8" height="8" rx="2" fill="#10b981"/>
        <text x="77" y="10" font-family="system-ui, sans-serif" font-size="9" fill="var(--text-color, #334155)">Collected</text>

        <rect x="145" y="3" width="8" height="8" rx="2" fill="#f59e0b"/>
        <text x="157" y="10" font-family="system-ui, sans-serif" font-size="9" fill="var(--text-color, #334155)">Outstanding</text>
      </g>

      <!-- Header Divider -->
      <line x1="20" y1="56" x2="${svgWidth - 20}" y2="56" stroke="var(--border-color, #e2e8f0)" stroke-width="1"/>

      <!-- Rows -->
      ${primaryRows.length ? areaElements : `
        <text x="${svgWidth / 2}" y="${height / 2}" font-family="system-ui, sans-serif" font-size="12" fill="var(--text-muted, #64748b)" text-anchor="middle">
          No area billing or customer records available for ${escapeXml(month)}.
        </text>
      `}

      <!-- Bottom Telemetry Ribbon -->
      <line x1="20" y1="${height - 30}" x2="${svgWidth - 20}" y2="${height - 30}" stroke="var(--border-color, #e2e8f0)" stroke-width="1"/>
      <text x="24" y="${height - 12}" font-family="system-ui, sans-serif" font-size="9.5" fill="var(--text-muted, #64748b)">
        Total Billed: <tspan font-weight="700" fill="#2563eb">PKR ${(summary.totalBilled || 0).toLocaleString()}</tspan> ·
        Collected: <tspan font-weight="700" fill="#059669">PKR ${(summary.totalCollected || 0).toLocaleString()}</tspan> ·
        Recovery Rate: <tspan font-weight="700" fill="var(--text-color, #0f172a)">${summary.overallCollectionRate || 0}%</tspan>
      </text>
    </svg>
  `;
}

/**
 * Generates RFC-4180 CSV export content with UTF-8 BOM.
 * @param {Object} collectionsData - Output of calculateAreaWiseCollections
 * @returns {string} CSV text
 */
export function generateAreaCollectionsCsv(collectionsData) {
  const rows = collectionsData?.rows || [];
  const month = collectionsData?.selectedMonth || '';

  const headers = [
    'Month',
    'Area Name',
    'Level',
    'Parent Area',
    'Total Subscribers',
    'Active Subscribers',
    'Offline Subscribers',
    'Billed Revenue (PKR)',
    'Bill Count',
    'Collected Cash (PKR)',
    'Receipt Count',
    'Outstanding Dues (PKR)',
    'Collection Rate (%)',
    'Collection Gap (PKR)',
    'Performance Tier',
    'ARPU (PKR)'
  ];

  const escapeCsv = val => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csvRows = rows.map(r => [
    month,
    r.areaName,
    r.level.toUpperCase(),
    r.parentArea || 'None',
    r.totalCustomers,
    r.activeCustomers,
    r.offlineCustomers,
    r.billedAmount,
    r.billCount,
    r.collectedAmount,
    r.receiptCount,
    r.outstanding,
    r.collectionRate !== null ? `${r.collectionRate}%` : 'N/A',
    r.collectionGap,
    r.tierLabel,
    r.arpu
  ].map(escapeCsv).join(','));

  return '\uFEFF' + [headers.join(','), ...csvRows].join('\r\n');
}

/**
 * Generates printable HTML recovery report (A4 or 80mm thermal receipt slip).
 * @param {Object} params
 * @param {Object} params.data - Output of calculateAreaWiseCollections
 * @param {string} [params.format='a4'] - 'a4' or 'thermal'
 * @param {Date} [params.referenceDate=new Date()]
 * @returns {string} HTML markup string
 */
export function generateAreaCollectionsPrintHtml({
  data,
  format = 'a4',
  referenceDate = new Date()
}) {
  const rows = data?.rows || [];
  const summary = data?.summary || {};
  const month = data?.selectedMonth || '';
  const dateStr = formatDateYmd(referenceDate);

  if (format === 'thermal') {
    const items = rows.map(r => `
      <div style="border-bottom:1px dashed #444; padding:3px 0; font-size:10px;">
        <div style="display:flex; justify-content:space-between; font-weight:bold;">
          <span>${escapeHtml(r.areaName)}</span>
          <span>${r.collectionRate !== null ? `${r.collectionRate}%` : '—'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:9px; color:#333;">
          <span>B: PKR ${r.billedAmount.toLocaleString()}</span>
          <span>C: PKR ${r.collectedAmount.toLocaleString()}</span>
          <span>Due: PKR ${r.outstanding.toLocaleString()}</span>
        </div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Area Collections Slip</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: monospace; width: 80mm; margin: 0; padding: 6px; font-size: 11px; color:#000; }
          .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
          .kpi { display: flex; justify-content: space-between; font-weight: bold; margin: 2px 0; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="head">
          <h3 style="margin:0;">SHAHDARA BROADBAND</h3>
          <div style="font-weight:bold;">AREA RECOVERY SLIP · ${escapeHtml(month)}</div>
          <div>Printed: ${dateStr}</div>
        </div>
        <div class="kpi"><span>Total Billed:</span><span>PKR ${(summary.totalBilled || 0).toLocaleString()}</span></div>
        <div class="kpi"><span>Collected:</span><span>PKR ${(summary.totalCollected || 0).toLocaleString()}</span></div>
        <div class="kpi"><span>Outstanding:</span><span>PKR ${(summary.totalOutstanding || 0).toLocaleString()}</span></div>
        <div class="kpi"><span>Overall Rate:</span><span>${summary.overallCollectionRate || 0}%</span></div>
        <div style="border-top:1px solid #000; margin:4px 0;"></div>
        <div>
          ${items || '<div style="text-align:center;">No area records</div>'}
        </div>
        <div style="text-align:center; margin-top:8px; font-size:9px; border-top:1px solid #000; padding-top:4px;">
          *** FIELD COLLECTOR RUN SHEET ***
        </div>
      </body>
      </html>
    `;
  }

  // Formal A4 Report
  const tableRows = rows.map(r => {
    const badgeColor = r.tier === 'optimal'
      ? '#10b981'
      : r.tier === 'moderate'
        ? '#f59e0b'
        : r.tier === 'lagging'
          ? '#ef4444'
          : '#64748b';

    return `
      <tr>
        <td style="font-weight:600;">
          ${escapeHtml(r.areaName)}
          ${r.parentArea ? `<br><small style="color:#64748b;">${escapeHtml(r.parentArea)}</small>` : ''}
        </td>
        <td style="text-align:center;">${r.totalCustomers} (${r.activeCustomers})</td>
        <td style="text-align:right;">PKR ${r.billedAmount.toLocaleString()}</td>
        <td style="text-align:right; font-weight:bold; color:#059669;">PKR ${r.collectedAmount.toLocaleString()}</td>
        <td style="text-align:right; color:#dc2626;">PKR ${r.outstanding.toLocaleString()}</td>
        <td style="text-align:center;">
          <span style="font-weight:bold; color:${badgeColor}; font-size:12px;">
            ${r.collectionRate !== null ? `${r.collectionRate}%` : 'N/A'}
          </span>
        </td>
        <td style="text-align:right;">PKR ${r.collectionGap.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Area-Wise Collections & Recovery Report - ${escapeHtml(month)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 15mm; color: #1e293b; font-size: 11px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
        .brand { font-size: 18px; font-weight: 800; color: #2563eb; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; }
        .kpi-card span { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; }
        .kpi-card strong { font-size: 15px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; }
        th { background: #f1f5f9; font-size: 10px; font-weight: 700; }
        .footer { margin-top: 18px; border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; }
        .signature-block { display: flex; justify-content: space-between; margin-top: 24px; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SHAHDARA BROADBAND ISP</div>
          <div style="font-size:13px; font-weight:600; color:#334155;">Area-Wise Collections & Recovery Performance Manifest</div>
          <div style="font-size:10px; color:#64748b;">Month: ${escapeHtml(month)} · Local ledger accounting</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Printed:</strong> ${dateStr} PKT</div>
          <div><strong>Areas Listed:</strong> ${rows.length}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><span>Total Billed</span><strong style="color:#2563eb;">PKR ${(summary.totalBilled || 0).toLocaleString()}</strong></div>
        <div class="kpi-card"><span>Total Collected</span><strong style="color:#059669;">PKR ${(summary.totalCollected || 0).toLocaleString()}</strong></div>
        <div class="kpi-card"><span>Outstanding</span><strong style="color:#dc2626;">PKR ${(summary.totalOutstanding || 0).toLocaleString()}</strong></div>
        <div class="kpi-card"><span>Recovery Rate</span><strong style="color:#0f172a;">${summary.overallCollectionRate || 0}%</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Area / Mohalla</th>
            <th style="text-align:center;">Subscribers</th>
            <th style="text-align:right;">Billed Revenue</th>
            <th style="text-align:right;">Cash Collected</th>
            <th style="text-align:right;">Outstanding</th>
            <th style="text-align:center;">Recovery %</th>
            <th style="text-align:right;">Collection Gap</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="7" style="text-align:center; padding:12px;">No area data available.</td></tr>'}
        </tbody>
      </table>

      <div class="signature-block">
        <div>Prepared by: _______________________ (Billing Desk)</div>
        <div>Field Supervisor: _______________________</div>
        <div>Owner Signature: _______________________</div>
      </div>

      <div class="footer">
        <span>Shahdara ISP Offline Billing & Business Engine · Local Data Only</span>
        <span>Generated offline · No external server telemetry</span>
      </div>
    </body>
    </html>
  `;
}

/**
 * Builds clipboard-ready executive summary text.
 * @param {Object} collectionsData - Output of calculateAreaWiseCollections
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} Text summary
 */
export function generateAreaCollectionsBriefing(collectionsData, referenceDate = new Date()) {
  const summary = collectionsData?.summary || {};
  const month = collectionsData?.selectedMonth || '';
  const rows = collectionsData?.rows || [];
  const dateStr = formatDateYmd(referenceDate);

  const lines = [
    `📍 SHAHDARA BROADBAND - AREA-WISE COLLECTIONS BRIEFING (${month})`,
    `Generated: ${dateStr} PKT`,
    `--------------------------------------------------`,
    `• Total Billed Revenue: PKR ${(summary.totalBilled || 0).toLocaleString()}`,
    `• Cash Collected: PKR ${(summary.totalCollected || 0).toLocaleString()}`,
    `• Cumulative Outstanding: PKR ${(summary.totalOutstanding || 0).toLocaleString()}`,
    `• Overall Recovery Rate: ${summary.overallCollectionRate || 0}%`,
    `• Collection Gap (Uncollected): PKR ${(summary.totalCollectionGap || 0).toLocaleString()}`,
    `• Top Performer: ${summary.topPerformingArea} (${summary.topPerformingRate}% recovery)`,
    `• Highest Outstanding: ${summary.highestOutstandingArea} (PKR ${(summary.highestOutstandingAmount || 0).toLocaleString()})`,
    `• Performance Breakdown: ${summary.optimalCount} Optimal (85%+), ${summary.moderateCount} Moderate (60-84%), ${summary.laggingCount} Lagging (<60%)`,
    ``,
    `TOP RECOVERY AREAS:`,
    ...rows.slice(0, 5).map(r =>
      `• ${r.areaName}: Billed PKR ${r.billedAmount.toLocaleString()} | Collected PKR ${r.collectedAmount.toLocaleString()} (${r.collectionRate !== null ? `${r.collectionRate}%` : 'N/A'})`
    ),
    ``,
    `Action: Field collectors should prioritize lagging collection sectors for recovery visits.`
  ];

  return lines.join('\n');
}

/**
 * Controller to wire and manage the Area Collections modal dialog and UI actions.
 * @param {Function} getState - Returns current application state
 * @param {Object} [options]
 * @param {Function} [options.onFilterCustomerArea] - Callback when user clicks to filter customer list by area
 * @param {Function} [options.onToast] - Toast notification function
 * @returns {Object} Controller object with open() and close()
 */
export function setupAreaCollectionsModal(getState, {
  onFilterCustomerArea = null,
  onToast = () => {}
} = {}) {
  const modal = document.getElementById('areaCollectionsModal');
  if (!modal) return null;

  const monthSelect = document.getElementById('areaCollectionsMonthSelect');
  const levelSelect = document.getElementById('areaCollectionsLevelSelect');
  const searchInput = document.getElementById('areaCollectionsSearchInput');

  const kpiBilled = document.getElementById('areaCollectionsKpiBilled');
  const kpiCollected = document.getElementById('areaCollectionsKpiCollected');
  const kpiOutstanding = document.getElementById('areaCollectionsKpiOutstanding');
  const kpiRate = document.getElementById('areaCollectionsKpiRate');

  const chartContainer = document.getElementById('areaCollectionsChartContainer');
  const tableBody = document.getElementById('areaCollectionsTableBody');
  const emptyState = document.getElementById('areaCollectionsEmptyState');

  const exportCsvBtn = document.getElementById('areaCollectionsExportCsvBtn');
  const copyBriefingBtn = document.getElementById('areaCollectionsCopyBriefingBtn');
  const printA4Btn = document.getElementById('areaCollectionsPrintA4Btn');
  const printThermalBtn = document.getElementById('areaCollectionsPrintThermalBtn');
  const closeBtn = document.getElementById('closeAreaCollectionsModalBtn');
  const closeSecondaryBtn = document.getElementById('closeAreaCollectionsSecondaryBtn');

  const openTriggers = [
    document.getElementById('quickActionAreaCollections'),
    document.getElementById('openAreaCollectionsModalBtn')
  ].filter(Boolean);

  let currentSortKey = 'billedAmount';
  let currentSortAsc = false;
  let cachedData = null;

  const populateMonths = () => {
    if (!monthSelect) return;
    const months = monthsForHistory();
    const currentVal = monthSelect.value;
    monthSelect.replaceChildren();
    months.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = idx === 0 ? `${m} (Current)` : m;
      if ((!currentVal && idx === 0) || currentVal === m) {
        opt.selected = true;
      }
      monthSelect.appendChild(opt);
    });
  };

  const renderData = () => {
    const state = typeof getState === 'function' ? getState() : getState;
    const selectedMonth = monthSelect?.value || pktMonth();
    const selectedLevel = levelSelect?.value || 'all';
    const query = searchInput?.value || '';

    cachedData = calculateAreaWiseCollections(state, {
      month: selectedMonth,
      level: selectedLevel,
      search: query
    });

    const summary = cachedData.summary;

    // Update KPIs
    if (kpiBilled) kpiBilled.textContent = `PKR ${(summary.totalBilled || 0).toLocaleString()}`;
    if (kpiCollected) kpiCollected.textContent = `PKR ${(summary.totalCollected || 0).toLocaleString()}`;
    if (kpiOutstanding) kpiOutstanding.textContent = `PKR ${(summary.totalOutstanding || 0).toLocaleString()}`;
    if (kpiRate) kpiRate.textContent = `${summary.overallCollectionRate || 0}%`;

    // Render SVG Chart
    if (chartContainer) {
      chartContainer.innerHTML = renderAreaCollectionsSvg(cachedData);
    }

    // Sort rows
    const rows = [...cachedData.rows];
    rows.sort((a, b) => {
      let vA = a[currentSortKey];
      let vB = b[currentSortKey];
      if (typeof vA === 'string') {
        const cmp = vA.localeCompare(vB || '');
        return currentSortAsc ? cmp : -cmp;
      }
      vA = vA === null || vA === undefined ? -1 : vA;
      vB = vB === null || vB === undefined ? -1 : vB;
      return currentSortAsc ? vA - vB : vB - vA;
    });

    // Render Table
    if (tableBody) {
      tableBody.replaceChildren();
      if (rows.length === 0) {
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        rows.forEach(r => {
          const tr = document.createElement('tr');
          tr.className = `area-col-row area-col-${r.level}`;

          const rateStr = r.collectionRate !== null ? `${r.collectionRate}%` : 'N/A';
          const badgeClass = r.tier === 'optimal'
            ? 'badge-success'
            : r.tier === 'moderate'
              ? 'badge-warning'
              : r.tier === 'lagging'
                ? 'badge-danger'
                : 'badge-muted';

          tr.innerHTML = `
            <td>
              <div style="font-weight: 600; color: var(--text-color, #0f172a);">
                ${escapeHtml(r.areaName)}
              </div>
              ${r.parentArea ? `<div style="font-size: 10px; color: var(--text-muted, #64748b);">${escapeHtml(r.parentArea)}</div>` : ''}
            </td>
            <td style="text-align: center;">
              ${r.totalCustomers}
              <div style="font-size: 10px; color: var(--text-muted, #64748b);">${r.activeCustomers} active</div>
            </td>
            <td style="text-align: right; font-weight: 500;">
              PKR ${r.billedAmount.toLocaleString()}
            </td>
            <td style="text-align: right; font-weight: 600; color: #10b981;">
              PKR ${r.collectedAmount.toLocaleString()}
            </td>
            <td style="text-align: right; font-weight: 600; color: #ef4444;">
              PKR ${r.outstanding.toLocaleString()}
            </td>
            <td style="text-align: center;">
              <span class="badge ${badgeClass}" style="padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                ${rateStr}
              </span>
            </td>
            <td style="text-align: right;">
              <button class="secondary-button btn-sm filter-area-cust-btn" type="button" data-area-name="${escapeHtml(r.areaName)}" style="padding: 2px 8px; font-size: 11px;">
                📍 Subscribers
              </button>
            </td>
          `;

          const filterBtn = tr.querySelector('.filter-area-cust-btn');
          if (filterBtn) {
            filterBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const aName = filterBtn.getAttribute('data-area-name');
              modal.close();
              if (typeof onFilterCustomerArea === 'function') {
                onFilterCustomerArea(aName);
              }
            });
          }

          tableBody.appendChild(tr);
        });
      }
    }
  };

  // Setup listeners
  openTriggers.forEach(btn => {
    btn.addEventListener('click', () => {
      populateMonths();
      renderData();
      modal.showModal();
    });
  });

  monthSelect?.addEventListener('change', renderData);
  levelSelect?.addEventListener('change', renderData);
  searchInput?.addEventListener('input', renderData);

  // Table header sort handlers
  modal.querySelectorAll('[data-sort-area-col]').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.getAttribute('data-sort-area-col');
      if (currentSortKey === sortKey) {
        currentSortAsc = !currentSortAsc;
      } else {
        currentSortKey = sortKey;
        currentSortAsc = false;
      }
      renderData();
    });
  });

  // Export CSV
  exportCsvBtn?.addEventListener('click', () => {
    if (!cachedData) return;
    const csv = generateAreaCollectionsCsv(cachedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara-area-collections-${cachedData.selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('📥 Area collections CSV exported.');
  });

  // Copy Briefing
  copyBriefingBtn?.addEventListener('click', async () => {
    if (!cachedData) return;
    const text = generateAreaCollectionsBriefing(cachedData);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        onToast('📋 Area collections briefing copied to clipboard.');
      } else {
        onToast('Clipboard not supported in this browser.');
      }
    } catch {
      onToast('Unable to copy briefing to clipboard.');
    }
  });

  // Print A4
  printA4Btn?.addEventListener('click', () => {
    if (!cachedData) return;
    const html = generateAreaCollectionsPrintHtml({ data: cachedData, format: 'a4' });
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 300);
    }
  });

  // Print Thermal 80mm
  printThermalBtn?.addEventListener('click', () => {
    if (!cachedData) return;
    const html = generateAreaCollectionsPrintHtml({ data: cachedData, format: 'thermal' });
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => printWin.print(), 300);
    }
  });

  closeBtn?.addEventListener('click', () => modal.close());
  closeSecondaryBtn?.addEventListener('click', () => modal.close());

  // Close on outside backdrop click
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.close();
    }
  });

  return {
    open: (initialMonth = null) => {
      populateMonths();
      if (initialMonth && monthSelect) {
        monthSelect.value = initialMonth;
      }
      renderData();
      modal.showModal();
    },
    close: () => modal.close()
  };
}
