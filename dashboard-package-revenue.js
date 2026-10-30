/**
 * dashboard-package-revenue.js
 * Package Revenue Mix, Donut Visualization & Portfolio ARPU Suite.
 *
 * Implements:
 * - Granular package-level financial tracking for any selected billing month.
 * - Per-package metrics: Customers (total & active), Billed PKR, Cash Collected PKR,
 *   Outstanding PKR, ARPU (PKR / active sub), Revenue Share %, and Collection Rate %.
 * - Pure-vector SVG donut chart (renderPackageRevenueDonutSvg) with interactive
 *   metric toggle (Billed Revenue vs Subscribed Profiles), center KPI, and color-coded legend.
 * - RFC-4180 CSV export with UTF-8 BOM.
 * - Dual printable formats: A4 Executive Tariff Manifest and 80mm POS thermal field slip.
 * - Bilingual Urdu & English executive briefing generator with one-tap clipboard copy.
 * - Accessible modal dialog controller (setupPackageRevenueModal) with month selector,
 *   search filter, sortable columns, and one-tap customer roster filtering.
 */

import {
  monthsForHistory,
  formatPKR,
  derivedBillStatus,
  calculatePaymentAllocations
} from './core.js';
import {
  canonicalPackage,
  pktDate,
  pktMonth,
  monthEnd,
  outstandingAtMonthEnd,
  isActiveSubscription
} from './phase3.js';
import {
  BILL_PACKAGES,
  billPackageById,
  billPackageByLabel
} from './package-catalog.js';

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
 * @param {Date} [date=new Date()]
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

/** Harmonic accessible color palette for package slices */
export const PACKAGE_PALETTE = [
  '#2563eb', // Vibrant Royal Blue (Primary Tier)
  '#10b981', // Emerald Green (Unlimited / High Tier)
  '#f59e0b', // Amber Orange (Standard Tier)
  '#8b5cf6', // Violet Purple (Mid-tier)
  '#ec4899', // Pink (Fast/Fiber Tier)
  '#06b6d4', // Cyan (Starter Tier)
  '#14b8a6', // Teal (Custom Plan 1)
  '#f97316', // Bright Orange (Custom Plan 2)
  '#6366f1', // Indigo (Custom Plan 3)
  '#64748b'  // Slate Grey (Unassigned / Not set)
];

/**
 * Resolves a customer's package into a structured descriptor.
 * @param {Object} customer
 * @returns {Object} { key, label, catalogPlan, nominalPrice, speedMbps, dataLimit }
 */
export function resolvePackageForCustomer(customer) {
  const raw = String(customer?.packageSpeed ?? '').trim();
  if (!raw) {
    return {
      key: '__package_not_set__',
      label: 'Package not set',
      catalogPlan: null,
      nominalPrice: null,
      speedMbps: null,
      dataLimit: ''
    };
  }

  // Check preset catalog
  const catalog = billPackageByLabel(raw);
  if (catalog) {
    return {
      key: catalog.id,
      label: catalog.label,
      catalogPlan: catalog,
      nominalPrice: catalog.price,
      speedMbps: catalog.speedMbps,
      dataLimit: catalog.dataLimit || 'Unlimited'
    };
  }

  // Canonical package
  const canonical = canonicalPackage(raw);
  const key = canonical?.key ?? raw.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const label = canonical?.label ?? raw;

  // Try to parse speed from label
  const speedMatch = raw.match(/(\d+(?:\.\d+)?)\s*mbps/i);
  const speedMbps = speedMatch ? parseFloat(speedMatch[1]) : null;

  return {
    key,
    label,
    catalogPlan: null,
    nominalPrice: null,
    speedMbps,
    dataLimit: ''
  };
}

/**
 * Resolves package for a specific bill snapshot.
 * Uses bill.packageSnapshot or bill.packageSpeed, then customer packageHistory, then current package.
 * @param {Object} customer
 * @param {Object} bill
 * @param {string} currentMonth
 * @returns {Object} Package descriptor
 */
export function resolvePackageForBill(customer, bill, currentMonth) {
  // 1. Direct snapshot on bill
  if (bill?.packageSnapshot && typeof bill.packageSnapshot === 'object') {
    const snap = bill.packageSnapshot;
    const catalog = snap.packageId ? billPackageById(snap.packageId) : null;
    return {
      key: snap.packageId || (snap.label ? canonicalPackage(snap.label)?.key : '__package_not_set__') || '__package_not_set__',
      label: snap.label || catalog?.label || 'Package not set',
      catalogPlan: catalog,
      nominalPrice: snap.nominalPrice ?? catalog?.price ?? null,
      speedMbps: snap.speedMbps ?? catalog?.speedMbps ?? null,
      dataLimit: snap.dataLimit || (snap.packageType === 'Unlimited' ? 'Unlimited' : '')
    };
  }

  // 2. Saved packageSpeed string on bill
  const savedSpeed = String(bill?.packageSpeed ?? '').trim();
  if (savedSpeed) {
    const catalog = billPackageByLabel(savedSpeed);
    const canonical = canonicalPackage(savedSpeed);
    return {
      key: catalog?.id ?? canonical?.key ?? savedSpeed.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      label: catalog?.label ?? canonical?.label ?? savedSpeed,
      catalogPlan: catalog,
      nominalPrice: catalog?.price ?? null,
      speedMbps: catalog?.speedMbps ?? null,
      dataLimit: catalog?.dataLimit || ''
    };
  }

  // 3. Dated packageHistory on or before bill month
  const history = Array.isArray(customer?.packageHistory) ? customer.packageHistory : [];
  const validHistory = history
    .filter(row => typeof row?.date === 'string' && row.date.slice(0, 7) <= bill.month)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (validHistory.length && String(validHistory[0]?.newPackage ?? '').trim()) {
    const histRaw = String(validHistory[0].newPackage).trim();
    const catalog = billPackageByLabel(histRaw);
    const canonical = canonicalPackage(histRaw);
    return {
      key: catalog?.id ?? canonical?.key ?? histRaw.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      label: catalog?.label ?? canonical?.label ?? histRaw,
      catalogPlan: catalog,
      nominalPrice: (catalog?.price ?? Number(validHistory[0]?.newPrice)) || null,
      speedMbps: catalog?.speedMbps ?? null,
      dataLimit: catalog?.dataLimit || ''
    };
  }

  // 4. If current month, fall back to customer current package
  if (bill.month === currentMonth) {
    return resolvePackageForCustomer(customer);
  }

  // Otherwise fallback to customer package
  return resolvePackageForCustomer(customer);
}

/**
 * Calculates comprehensive package revenue mix, customer counts, cash collections,
 * ARPU and share percentages for a selected calendar month.
 *
 * @param {Object} state - Full application state
 * @param {Object} [options]
 * @param {string} [options.month] - YYYY-MM month string. Defaults to current PKT month.
 * @param {string} [options.search=''] - Search filter for package name
 * @param {string} [options.sortBy='billedAmount'] - Column to sort by
 * @param {string} [options.sortOrder='desc'] - 'asc' or 'desc'
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Object} Package revenue mix analytics data
 */
export function calculatePackageRevenueMix(state, {
  month = null,
  search = '',
  sortBy = 'billedAmount',
  sortOrder = 'desc',
  referenceDate = new Date()
} = {}) {
  const currentPktMonth = pktMonth(referenceDate);
  const selectedMonth = (month && /^\d{4}-\d{2}$/.test(month)) ? month : currentPktMonth;
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const todayYmd = pktDate(referenceDate);

  // Month date bounds
  const calculatedMonthEnd = monthEnd(selectedMonth);
  const cutoffDate = (selectedMonth === currentPktMonth && todayYmd < calculatedMonthEnd)
    ? todayYmd
    : calculatedMonthEnd;

  // Outstanding balances through this month end
  const cutoffDateTime = new Date(`${cutoffDate}T23:59:59+05:00`);
  const outstandingResult = outstandingAtMonthEnd({ customers }, selectedMonth, cutoffDateTime);
  const allocations = calculatePaymentAllocations(state || { customers: [] });

  // Map to hold package groups
  const packageMap = new Map();

  const ensurePackage = (desc) => {
    if (!packageMap.has(desc.key)) {
      packageMap.set(desc.key, {
        key: desc.key,
        label: desc.label,
        speedMbps: desc.speedMbps,
        dataLimit: desc.dataLimit || '',
        nominalPrice: desc.nominalPrice,
        customerIds: new Set(),
        activeCustomers: 0,
        offlineCustomers: 0,
        otherCustomers: 0,
        billedCents: 0,
        billCount: 0,
        billedCustomerIds: new Set(),
        collectedCents: 0,
        receiptCount: 0,
        collectedCustomerIds: new Set(),
        outstandingCents: 0,
        paidBillsCount: 0,
        partialBillsCount: 0,
        unpaidBillsCount: 0
      });
    }
    return packageMap.get(desc.key);
  };

  // 1. Group active/configured subscribers into packages
  for (const c of customers) {
    if (c.archived) continue;
    const pkgDesc = resolvePackageForCustomer(c);
    const grp = ensurePackage(pkgDesc);

    grp.customerIds.add(c.id);
    const active = isActiveSubscription(c, cutoffDate);
    if (active) {
      grp.activeCustomers++;
    } else if (c.serviceStatus === 'offline') {
      grp.offlineCustomers++;
    } else {
      grp.otherCustomers++;
    }

    // Customer outstanding balance mapped to their primary package
    const customerOutstanding = outstandingResult.byCustomer?.get(c.id) ?? 0;
    if (customerOutstanding > 0) {
      grp.outstandingCents += Math.round(customerOutstanding * 100);
    }
  }

  // 2. Accumulate billed revenue and cash collected for the selected month
  for (const c of customers) {
    if (c.archived) continue;
    const bills = Array.isArray(c.bills) ? c.bills : [];

    for (const bill of bills) {
      // Check if bill belongs to selected month
      if (bill.month === selectedMonth) {
        const amt = Number(bill.dueAmount);
        const hasPrice = Number.isFinite(amt) && amt > 0;
        const billPkgDesc = resolvePackageForBill(c, bill, selectedMonth);
        const billGrp = ensurePackage(billPkgDesc);

        if (hasPrice) {
          const centsVal = Math.round(amt * 100);
          billGrp.billedCents += centsVal;
          billGrp.billCount++;
          billGrp.billedCustomerIds.add(c.id);

          const status = derivedBillStatus(c, bill, allocations);
          if (status === 'PAID' || status === 'paid') billGrp.paidBillsCount++;
          else if (status === 'PARTIAL' || status === 'partial') billGrp.partialBillsCount++;
          else billGrp.unpaidBillsCount++;
        }
      }

      // Check payments dated within selected month
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const p of payments) {
        if (p?.voided === true) continue; // FU4: SISP-34 voided receipts are not collected cash.
        if (typeof p.date === 'string' && p.date.startsWith(selectedMonth)) {
          const pAmt = Number(p.amount) || 0;
          if (pAmt > 0) {
            const billPkgDesc = resolvePackageForBill(c, bill, selectedMonth);
            const billGrp = ensurePackage(billPkgDesc);
            billGrp.collectedCents += Math.round(pAmt * 100);
            billGrp.receiptCount++;
            billGrp.collectedCustomerIds.add(c.id);
          }
        }
      }
    }
  }

  // Portfolio-level aggregations
  let totalBilledCents = 0;
  let totalCollectedCents = 0;
  let totalOutstandingCents = 0;
  let totalActiveCustomers = 0;
  const allCustomerIds = new Set();

  for (const grp of packageMap.values()) {
    totalBilledCents += grp.billedCents;
    totalCollectedCents += grp.collectedCents;
    totalOutstandingCents += grp.outstandingCents;
    totalActiveCustomers += grp.activeCustomers;
    for (const id of grp.customerIds) allCustomerIds.add(id);
  }

  const totalBilled = Math.round(totalBilledCents / 100);
  const totalCollected = Math.round(totalCollectedCents / 100);
  const totalOutstanding = Math.round(totalOutstandingCents / 100);
  const totalCustomers = allCustomerIds.size;

  const overallCollectionRate = totalBilled > 0
    ? Math.round((totalCollected / totalBilled) * 100)
    : (totalCollected > 0 ? 100 : 0);

  const overallArpu = totalActiveCustomers > 0 && totalBilled > 0
    ? Math.round(totalBilled / totalActiveCustomers)
    : 0;

  // Format and finalize package rows
  const rawRows = [...packageMap.values()].map((grp, idx) => {
    const billedAmount = Math.round(grp.billedCents / 100);
    const collectedAmount = Math.round(grp.collectedCents / 100);
    const outstanding = Math.round(grp.outstandingCents / 100);
    const customerCount = grp.customerIds.size;

    // ARPU = Billed ÷ Active Subscriptions (with graceful fallback to nominal or collected)
    let arpu = null;
    if (grp.activeCustomers > 0 && billedAmount > 0) {
      arpu = Math.round(billedAmount / grp.activeCustomers);
    } else if (grp.activeCustomers > 0 && collectedAmount > 0) {
      arpu = Math.round(collectedAmount / grp.activeCustomers);
    } else if (grp.nominalPrice && grp.nominalPrice > 0) {
      arpu = grp.nominalPrice;
    } else if (grp.activeCustomers > 0) {
      arpu = 0;
    }

    // Share calculations
    const billedShare = totalBilled > 0
      ? Number(((billedAmount / totalBilled) * 100).toFixed(1))
      : 0;

    const collectedShare = totalCollected > 0
      ? Number(((collectedAmount / totalCollected) * 100).toFixed(1))
      : 0;

    const customerShare = totalCustomers > 0
      ? Number(((customerCount / totalCustomers) * 100).toFixed(1))
      : 0;

    // Collection rate
    const collectionRate = billedAmount > 0
      ? Math.round((collectedAmount / billedAmount) * 100)
      : (collectedAmount > 0 ? 100 : null);

    // Performance tier
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

    const color = grp.key === '__package_not_set__'
      ? '#64748b'
      : PACKAGE_PALETTE[idx % (PACKAGE_PALETTE.length - 1)];

    return {
      key: grp.key,
      label: grp.label,
      speedMbps: grp.speedMbps,
      dataLimit: grp.dataLimit,
      nominalPrice: grp.nominalPrice,
      color,
      totalCustomers: customerCount,
      activeCustomers: grp.activeCustomers,
      offlineCustomers: grp.offlineCustomers,
      otherCustomers: grp.otherCustomers,
      billedAmount,
      billCount: grp.billCount,
      collectedAmount,
      receiptCount: grp.receiptCount,
      outstanding,
      collectionGap: Math.max(0, billedAmount - collectedAmount),
      arpu,
      billedShare,
      collectedShare,
      customerShare,
      collectionRate,
      tier,
      tierLabel,
      tierColor
    };
  });

  // Top performers
  const topRevenuePkg = [...rawRows].sort((a, b) => b.billedAmount - a.billedAmount)[0] || null;
  const mostPopularPkg = [...rawRows].sort((a, b) => b.totalCustomers - a.totalCustomers)[0] || null;
  const highestArpuPkg = [...rawRows].filter(r => r.arpu !== null).sort((a, b) => (b.arpu || 0) - (a.arpu || 0))[0] || null;

  // Filter rows by search term
  let filteredRows = rawRows;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filteredRows = filteredRows.filter(r =>
      r.label.toLowerCase().includes(q) ||
      (r.dataLimit && r.dataLimit.toLowerCase().includes(q)) ||
      (r.speedMbps && `${r.speedMbps}mbps`.includes(q))
    );
  }

  // Sort rows
  filteredRows.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (aVal === null || aVal === undefined) aVal = sortOrder === 'desc' ? -Infinity : Infinity;
    if (bVal === null || bVal === undefined) bVal = sortOrder === 'desc' ? -Infinity : Infinity;

    if (typeof aVal === 'string') {
      return sortOrder === 'desc'
        ? bVal.localeCompare(aVal)
        : aVal.localeCompare(bVal);
    }
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  return {
    selectedMonth,
    cutoffDate,
    rows: filteredRows,
    allRows: rawRows,
    summary: {
      totalPackages: rawRows.length,
      totalCustomers,
      totalActiveCustomers,
      totalBilled,
      totalCollected,
      totalOutstanding,
      totalCollectionGap: Math.max(0, totalBilled - totalCollected),
      overallCollectionRate,
      overallArpu,
      topRevenuePackage: topRevenuePkg ? topRevenuePkg.label : 'None',
      topRevenueAmount: topRevenuePkg ? topRevenuePkg.billedAmount : 0,
      mostPopularPackage: mostPopularPkg ? mostPopularPkg.label : 'None',
      mostPopularCount: mostPopularPkg ? mostPopularPkg.totalCustomers : 0,
      highestArpuPackage: highestArpuPkg ? highestArpuPkg.label : 'None',
      highestArpuAmount: highestArpuPkg ? highestArpuPkg.arpu : 0
    }
  };
}

/**
 * Helper to compute an SVG arc path between two angles on an annular ring (donut).
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} r - Inner radius
 * @param {number} R - Outer radius
 * @param {number} startAngle - Start angle in degrees (0 = 12 o'clock)
 * @param {number} endAngle - End angle in degrees
 * @returns {string} SVG path data string
 */
export function describeDonutArc(cx, cy, r, R, startAngle, endAngle) {
  // Convert 0 at top (12 o'clock) to radians
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  const x1_outer = cx + R * Math.cos(startRad);
  const y1_outer = cy + R * Math.sin(startRad);
  const x2_outer = cx + R * Math.cos(endRad);
  const y2_outer = cy + R * Math.sin(endRad);

  const x1_inner = cx + r * Math.cos(startRad);
  const y1_inner = cy + r * Math.sin(startRad);
  const x2_inner = cx + r * Math.cos(endRad);
  const y2_inner = cy + r * Math.sin(endRad);

  const angleDiff = endAngle - startAngle;
  const largeArcFlag = angleDiff > 180 ? 1 : 0;

  return [
    `M ${x1_outer.toFixed(2)} ${y1_outer.toFixed(2)}`,
    `A ${R} ${R} 0 ${largeArcFlag} 1 ${x2_outer.toFixed(2)} ${y2_outer.toFixed(2)}`,
    `L ${x2_inner.toFixed(2)} ${y2_inner.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${x1_inner.toFixed(2)} ${y1_inner.toFixed(2)}`,
    'Z'
  ].join(' ');
}

/**
 * Renders a pure vector SVG donut chart with center KPI and responsive legend.
 * Supports both Billed Revenue and Subscriber count distribution.
 *
 * @param {Object} packageData - Output of calculatePackageRevenueMix
 * @param {Object} [options]
 * @param {number} [options.width=700]
 * @param {string} [options.metric='billed'] - 'billed' or 'subscribers'
 * @returns {string} SVG markup string
 */
export function renderPackageRevenueDonutSvg(packageData, {
  width = 700,
  metric = 'billed'
} = {}) {
  const allRows = packageData?.allRows || packageData?.rows || [];
  const summary = packageData?.summary || {};
  const month = packageData?.selectedMonth || '';

  const svgWidth = Math.max(500, width);
  const svgHeight = 280;

  // Donut geometry
  const cx = 145;
  const cy = 140;
  const outerR = 105;
  const innerR = 66;

  // Metric evaluation
  const isBilled = metric === 'billed';
  const totalValue = isBilled ? (summary.totalBilled || 0) : (summary.totalCustomers || 0);

  // Map all rows with numeric value for selected metric
  const evaluatedRows = allRows.map(r => ({
    ...r,
    value: isBilled ? Number(r.billedAmount || 0) : Number(r.totalCustomers || 0)
  }));

  // Filter rows with positive values and sort descending
  const activeRows = evaluatedRows
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);

  // SVG segments
  const pathElements = [];
  let currentAngle = 0;

  if (totalValue > 0 && activeRows.length > 0) {
    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i];
      const sliceAngle = (row.value / totalValue) * 360;

      // In case of a single 360 slice, slightly subtract to avoid zero-arc degenerate path
      const endAngle = currentAngle + (sliceAngle >= 359.99 ? 359.99 : sliceAngle);

      const pathData = describeDonutArc(cx, cy, innerR, outerR, currentAngle, endAngle);
      const titleText = `${row.label}: ${isBilled ? `PKR ${row.value.toLocaleString()}` : `${row.value} subscribers`} (${((row.value / totalValue) * 100).toFixed(1)}%)`;

      pathElements.push(`
        <path d="${pathData}" fill="${row.color}" stroke="var(--card-bg, #ffffff)" stroke-width="2" class="donut-slice" data-pkg-key="${escapeXml(row.key)}">
          <title>${escapeXml(titleText)}</title>
        </path>
      `);

      currentAngle += sliceAngle;
    }
  } else {
    // Empty state ring
    const emptyRing = describeDonutArc(cx, cy, innerR, outerR, 0, 359.99);
    pathElements.push(`
      <path d="${emptyRing}" fill="var(--border-color, #e2e8f0)" stroke="none" opacity="0.4">
        <title>No package billing recorded for ${escapeXml(month)}</title>
      </path>
    `);
  }

  // Center display texts
  const centerEyebrow = isBilled ? 'TOTAL BILLED' : 'TOTAL SUBS';
  const centerMainValue = isBilled
    ? (totalValue >= 1000000 ? `PKR ${(totalValue / 1000000).toFixed(2)}M` : `PKR ${(totalValue / 1000).toFixed(1)}k`)
    : `${totalValue} subs`;
  const centerSub = escapeXml(month);

  // Legend rows (right-hand column)
  const legendX = 295;
  const legendStartY = 38;
  const legendRowHeight = 24;
  const maxLegendItems = 8;
  const legendItems = (activeRows.length ? activeRows : evaluatedRows).slice(0, maxLegendItems);

  const legendElements = legendItems.map((r, idx) => {
    const y = legendStartY + idx * legendRowHeight;
    const numVal = Number(r.value || 0);
    const sharePct = totalValue > 0 ? ((numVal / totalValue) * 100).toFixed(1) : '0.0';
    const valStr = isBilled ? `PKR ${numVal.toLocaleString()}` : `${numVal} subs`;

    return `
      <g transform="translate(${legendX}, ${y})" class="donut-legend-item">
        <circle cx="6" cy="6" r="5" fill="${r.color}" />
        <text x="18" y="9" font-size="11" font-weight="600" fill="var(--text-color, #0f172a)">
          ${escapeXml(r.label.length > 20 ? r.label.slice(0, 18) + '…' : r.label)}
        </text>
        <text x="185" y="9" font-size="11" font-weight="700" text-anchor="end" fill="var(--text-color, #0f172a)">
          ${escapeXml(valStr)}
        </text>
        <text x="235" y="9" font-size="10" font-weight="600" text-anchor="end" fill="${r.color}">
          ${sharePct}%
        </text>
      </g>
    `;
  }).join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="${svgHeight}" class="package-revenue-donut-svg" style="display:block; overflow:visible;">
      <defs>
        <filter id="pkgDonutShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08" />
        </filter>
      </defs>

      <!-- Background Card Backdrop -->
      <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" rx="8" fill="var(--card-bg, #ffffff)" opacity="0.6" />

      <!-- Donut Group -->
      <g class="donut-slices-group" filter="url(#pkgDonutShadow)">
        ${pathElements.join('')}
      </g>

      <!-- Center Hole Cutout Background -->
      <circle cx="${cx}" cy="${cy}" r="${innerR - 1}" fill="var(--card-bg, #ffffff)" />

      <!-- Center Telemetry Text -->
      <text x="${cx}" y="${cy - 12}" text-anchor="middle" font-size="10" font-weight="700" letter-spacing="0.05em" fill="var(--text-muted, #64748b)">
        ${centerEyebrow}
      </text>
      <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="15" font-weight="800" fill="var(--text-color, #0f172a)">
        ${escapeXml(centerMainValue)}
      </text>
      <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--accent, #0e5b4d)">
        ${centerSub}
      </text>

      <!-- Legend Header -->
      <text x="${legendX}" y="20" font-size="10" font-weight="700" letter-spacing="0.05em" fill="var(--text-muted, #64748b)">
        PACKAGE TIER
      </text>
      <text x="${legendX + 185}" y="20" font-size="10" font-weight="700" letter-spacing="0.05em" text-anchor="end" fill="var(--text-muted, #64748b)">
        ${isBilled ? 'BILLED' : 'SUBS'}
      </text>
      <text x="${legendX + 235}" y="20" font-size="10" font-weight="700" letter-spacing="0.05em" text-anchor="end" fill="var(--text-muted, #64748b)">
        SHARE
      </text>
      <line x1="${legendX}" y1="26" x2="${legendX + 240}" y2="26" stroke="var(--border-color, #e2e8f0)" stroke-width="1" />

      <!-- Legend Items -->
      ${legendElements}
    </svg>
  `;
}

/**
 * Generates RFC-4180 compliant CSV string with UTF-8 BOM.
 * @param {Object} packageData - Output of calculatePackageRevenueMix
 * @returns {string} CSV string
 */
export function generatePackageRevenueCsv(packageData) {
  const rows = packageData?.rows || [];
  const month = packageData?.selectedMonth || '';

  const headers = [
    'Month',
    'Package Label',
    'Speed (Mbps)',
    'Data Limit',
    'Subscribers Total',
    'Active Subscriptions',
    'Offline Subscriptions',
    'Billed Revenue (PKR)',
    'Bill Count',
    'Cash Collected (PKR)',
    'Receipt Count',
    'Outstanding Dues (PKR)',
    'Collection Gap (PKR)',
    'ARPU (PKR)',
    'Revenue Share (%)',
    'Collection Rate (%)',
    'Performance Tier'
  ];

  const escapeCsv = val => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csvRows = rows.map(r => [
    month,
    r.label,
    r.speedMbps ?? '',
    r.dataLimit || '',
    r.totalCustomers,
    r.activeCustomers,
    r.offlineCustomers,
    r.billedAmount,
    r.billCount,
    r.collectedAmount,
    r.receiptCount,
    r.outstanding,
    r.collectionGap,
    r.arpu ?? '',
    `${r.billedShare}%`,
    r.collectionRate !== null ? `${r.collectionRate}%` : 'N/A',
    r.tierLabel
  ].map(escapeCsv).join(','));

  return '\uFEFF' + [headers.join(','), ...csvRows].join('\r\n');
}

/**
 * Generates printable HTML recovery report (A4 or 80mm thermal receipt slip).
 * @param {Object} params
 * @param {Object} params.data - Output of calculatePackageRevenueMix
 * @param {string} [params.format='a4'] - 'a4' or 'thermal'
 * @param {Date} [params.referenceDate=new Date()]
 * @returns {string} HTML markup string
 */
export function generatePackageRevenuePrintHtml({
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
          <span>${escapeHtml(r.label)}</span>
          <span>${r.billedShare}% share</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:9px; color:#333;">
          <span>Subs: ${r.totalCustomers} (${r.activeCustomers} act)</span>
          <span>ARPU: PKR ${(r.arpu || 0).toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:9px; color:#333;">
          <span>Billed: PKR ${r.billedAmount.toLocaleString()}</span>
          <span>Coll: PKR ${r.collectedAmount.toLocaleString()} (${r.collectionRate !== null ? `${r.collectionRate}%` : '—'})</span>
        </div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Package Revenue Mix Slip</title>
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
          <div style="font-weight:bold;">PACKAGE REVENUE MIX · ${escapeHtml(month)}</div>
          <div>Printed: ${dateStr}</div>
        </div>
        <div class="kpi"><span>Total Billed:</span><span>PKR ${(summary.totalBilled || 0).toLocaleString()}</span></div>
        <div class="kpi"><span>Cash Collected:</span><span>PKR ${(summary.totalCollected || 0).toLocaleString()}</span></div>
        <div class="kpi"><span>Outstanding:</span><span>PKR ${(summary.totalOutstanding || 0).toLocaleString()}</span></div>
        <div class="kpi"><span>Portfolio ARPU:</span><span>PKR ${(summary.overallArpu || 0).toLocaleString()}</span></div>
        <div class="kpi"><span>Recovery Rate:</span><span>${summary.overallCollectionRate || 0}%</span></div>
        <div style="border-top:1px solid #000; margin:4px 0;"></div>
        <div>
          ${items || '<div style="text-align:center;">No package records</div>'}
        </div>
        <div style="text-align:center; margin-top:8px; font-size:9px; border-top:1px solid #000; padding-top:4px;">
          *** MANAGEMENT TARIFF SUMMARY ***
        </div>
      </body>
      </html>
    `;
  }

  // Formal A4 Report
  const tableRows = rows.map(r => `
    <tr>
      <td style="font-weight:600;">
        ${escapeHtml(r.label)}
        ${r.dataLimit ? `<br><small style="color:#64748b;">${escapeHtml(r.dataLimit)}</small>` : ''}
      </td>
      <td style="text-align:center;">${r.totalCustomers} (${r.activeCustomers})</td>
      <td style="text-align:right;">PKR ${r.billedAmount.toLocaleString()}</td>
      <td style="text-align:right; font-weight:bold; color:#059669;">PKR ${r.collectedAmount.toLocaleString()}</td>
      <td style="text-align:right; color:#dc2626;">PKR ${r.outstanding.toLocaleString()}</td>
      <td style="text-align:right; font-weight:600;">PKR ${(r.arpu || 0).toLocaleString()}</td>
      <td style="text-align:center; font-weight:bold;">${r.billedShare}%</td>
      <td style="text-align:center;">
        <span style="font-weight:bold; color:${r.tierColor};">
          ${r.collectionRate !== null ? `${r.collectionRate}%` : 'N/A'}
        </span>
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Package Revenue Mix & Portfolio ARPU - ${escapeHtml(month)}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #0f172a; margin: 0; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0e5b4d; padding-bottom: 10px; margin-bottom: 12px; }
        .title { font-size: 18px; font-weight: 800; color: #0e5b4d; margin: 0; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
        .kpi-card span { font-size: 10px; color: #64748b; display: block; font-weight: 600; text-transform: uppercase; }
        .kpi-card strong { font-size: 15px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
        th { background: #f1f5f9; padding: 7px 8px; text-align: left; border: 1px solid #cbd5e1; font-weight: 700; }
        td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: middle; }
        tr:nth-child(even) { background: #f8fafc; }
        .signature-block { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 10px; }
        .footer { font-size: 9px; color: #64748b; text-align: center; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="title">SHAHDARA TELECOM &amp; BROADBAND</h1>
          <div style="font-weight: 600; color: #475569; font-size: 12px;">Package Revenue Mix &amp; Portfolio ARPU Statement</div>
          <div style="font-size: 10px; color: #64748b;">Billing Cycle: ${escapeHtml(month)} · Generated on ${dateStr} PKT</div>
        </div>
        <div style="text-align: right; font-size: 10px; color: #64748b;">
          <div>Offline Billing System</div>
          <div>Report ID: PKG-${escapeHtml(month.replace('-', ''))}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><span>Total Billed</span><strong style="color:#2563eb;">PKR ${(summary.totalBilled || 0).toLocaleString()}</strong></div>
        <div class="kpi-card"><span>Total Collected</span><strong style="color:#059669;">PKR ${(summary.totalCollected || 0).toLocaleString()}</strong></div>
        <div class="kpi-card"><span>Outstanding</span><strong style="color:#dc2626;">PKR ${(summary.totalOutstanding || 0).toLocaleString()}</strong></div>
        <div class="kpi-card"><span>Portfolio ARPU</span><strong style="color:#8b5cf6;">PKR ${(summary.overallArpu || 0).toLocaleString()}</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Package / Tier</th>
            <th style="text-align:center;">Subscribers (Active)</th>
            <th style="text-align:right;">Billed Revenue</th>
            <th style="text-align:right;">Cash Collected</th>
            <th style="text-align:right;">Outstanding</th>
            <th style="text-align:right;">ARPU</th>
            <th style="text-align:center;">Share %</th>
            <th style="text-align:center;">Recovery %</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="8" style="text-align:center; padding:12px;">No package data available.</td></tr>'}
        </tbody>
      </table>

      <div class="signature-block">
        <div>Prepared by: _______________________ (Billing Ops)</div>
        <div>Network Operations: _______________________</div>
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
 * Builds clipboard-ready bilingual executive summary text.
 * @param {Object} packageData - Output of calculatePackageRevenueMix
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} Text summary
 */
export function generatePackageRevenueBriefing(packageData, referenceDate = new Date()) {
  const summary = packageData?.summary || {};
  const month = packageData?.selectedMonth || '';
  const rows = packageData?.rows || [];
  const dateStr = formatDateYmd(referenceDate);

  const lines = [
    `📦 SHAHDARA BROADBAND - PACKAGE REVENUE MIX BRIEFING (${month})`,
    `Generated: ${dateStr} PKT`,
    `--------------------------------------------------`,
    `• Total Billed Revenue: PKR ${(summary.totalBilled || 0).toLocaleString()}`,
    `• Cash Collected: PKR ${(summary.totalCollected || 0).toLocaleString()}`,
    `• Outstanding Balance: PKR ${(summary.totalOutstanding || 0).toLocaleString()}`,
    `• Portfolio Blended ARPU: PKR ${(summary.overallArpu || 0).toLocaleString()} per active user`,
    `• Overall Recovery Rate: ${summary.overallCollectionRate || 0}%`,
    `• Top Revenue Driver: ${summary.topRevenuePackage} (PKR ${(summary.topRevenueAmount || 0).toLocaleString()})`,
    `• Most Subscribed: ${summary.mostPopularPackage} (${summary.mostPopularCount} subscribers)`,
    `• Highest ARPU Plan: ${summary.highestArpuPackage} (PKR ${(summary.highestArpuAmount || 0).toLocaleString()})`,
    ``,
    `PACKAGE TIER BREAKDOWN:`,
    ...rows.slice(0, 6).map(r =>
      `• ${r.label}: Billed PKR ${r.billedAmount.toLocaleString()} (${r.billedShare}% share) | ARPU PKR ${(r.arpu || 0).toLocaleString()} | ${r.totalCustomers} subs (${r.activeCustomers} active)`
    ),
    ``,
    `اردو خلاصہ:`,
    `مجموعی آمدن: PKR ${(summary.totalBilled || 0).toLocaleString()} | وصولی: PKR ${(summary.totalCollected || 0).toLocaleString()} | اوسط آمدن فی صارف (ARPU): PKR ${(summary.overallArpu || 0).toLocaleString()}`,
    `سب سے مقبول پیکج: ${summary.mostPopularPackage} (${summary.mostPopularCount} صارفین)`
  ];

  return lines.join('\n');
}

/**
 * Controller to wire and manage the Package Revenue modal dialog and UI actions.
 * @param {Function} getState - Returns current application state
 * @param {Object} [options]
 * @param {Function} [options.onFilterPackageCustomers] - Callback when user clicks to filter customer list by package
 * @param {Function} [options.onToast] - Toast notification function
 * @returns {Object} Controller object with open() and close()
 */
export function setupPackageRevenueModal(getState, {
  onFilterPackageCustomers = null,
  onToast = () => {}
} = {}) {
  const modal = document.getElementById('packageRevenueModal');
  if (!modal) return null;

  const monthSelect = document.getElementById('packageRevenueMonthSelect');
  const searchInput = document.getElementById('packageRevenueSearchInput');
  const modeBilledBtn = document.getElementById('packageRevenueModeBilledBtn');
  const modeSubsBtn = document.getElementById('packageRevenueModeSubsBtn');

  const kpiBilled = document.getElementById('packageRevenueKpiBilled');
  const kpiCollected = document.getElementById('packageRevenueKpiCollected');
  const kpiOutstanding = document.getElementById('packageRevenueKpiOutstanding');
  const kpiArpu = document.getElementById('packageRevenueKpiArpu');

  const chartContainer = document.getElementById('packageRevenueChartContainer');
  const tableBody = document.getElementById('packageRevenueTableBody');
  const emptyState = document.getElementById('packageRevenueEmptyState');

  const closeBtn = document.getElementById('closePackageRevenueModalBtn');
  const closeSecondaryBtn = document.getElementById('closePackageRevenueSecondaryBtn');
  const exportCsvBtn = document.getElementById('packageRevenueExportCsvBtn');
  const copyBriefingBtn = document.getElementById('packageRevenueCopyBriefingBtn');
  const printA4Btn = document.getElementById('packageRevenuePrintA4Btn');
  const printThermalBtn = document.getElementById('packageRevenuePrintThermalBtn');

  // State inside controller
  let currentMonth = pktMonth(new Date());
  let currentSearch = '';
  let currentSortBy = 'billedAmount';
  let currentSortOrder = 'desc';
  let currentMetric = 'billed';
  let currentData = null;

  function populateMonths() {
    if (!monthSelect) return;
    const months = monthsForHistory() || [];
    const currentPkt = pktMonth(new Date());

    if (!months.includes(currentPkt)) {
      months.unshift(currentPkt);
    }

    monthSelect.innerHTML = months.map(m =>
      `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${m} (${m === currentPkt ? 'Current' : 'Historical'})</option>`
    ).join('');
  }

  function render() {
    const state = getState() || {};
    currentData = calculatePackageRevenueMix(state, {
      month: currentMonth,
      search: currentSearch,
      sortBy: currentSortBy,
      sortOrder: currentSortOrder,
      referenceDate: new Date()
    });

    const summary = currentData.summary;

    // Update KPI values
    if (kpiBilled) kpiBilled.textContent = `PKR ${summary.totalBilled.toLocaleString()}`;
    if (kpiCollected) kpiCollected.textContent = `PKR ${summary.totalCollected.toLocaleString()}`;
    if (kpiOutstanding) kpiOutstanding.textContent = `PKR ${summary.totalOutstanding.toLocaleString()}`;
    if (kpiArpu) kpiArpu.textContent = `PKR ${summary.overallArpu.toLocaleString()}`;

    // Render Donut Chart
    if (chartContainer) {
      chartContainer.innerHTML = renderPackageRevenueDonutSvg(currentData, {
        width: chartContainer.clientWidth || 700,
        metric: currentMetric
      });
    }

    // Render Table rows
    const rows = currentData.rows;
    if (tableBody) {
      if (!rows || rows.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        tableBody.innerHTML = rows.map(r => {
          const badgeClass = r.tier === 'optimal'
            ? 'badge-success'
            : r.tier === 'moderate'
              ? 'badge-warning'
              : r.tier === 'lagging'
                ? 'badge-danger'
                : 'badge-secondary';

          return `
            <tr class="pkg-revenue-row" data-pkg-key="${escapeHtml(r.key)}">
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${r.color}; flex-shrink:0;"></span>
                  <div>
                    <strong>${escapeHtml(r.label)}</strong>
                    ${r.dataLimit ? `<br><small style="color:var(--text-muted, #64748b); font-size:10px;">${escapeHtml(r.dataLimit)}</small>` : ''}
                  </div>
                </div>
              </td>
              <td style="text-align:center;">
                <span class="user-badge" style="font-weight:600;">${r.totalCustomers}</span>
                <small style="color:var(--text-muted, #64748b); font-size:10px;">(${r.activeCustomers} active)</small>
              </td>
              <td style="text-align:right; font-weight:600; color:#2563eb;">PKR ${r.billedAmount.toLocaleString()}</td>
              <td style="text-align:right; font-weight:600; color:#10b981;">PKR ${r.collectedAmount.toLocaleString()}</td>
              <td style="text-align:right; color:#ef4444;">PKR ${r.outstanding.toLocaleString()}</td>
              <td style="text-align:right; font-weight:600; color:#8b5cf6;">PKR ${(r.arpu || 0).toLocaleString()}</td>
              <td style="text-align:center;">
                <div style="display:flex; align-items:center; gap:6px; justify-content:center;">
                  <div style="flex:1; max-width:44px; height:6px; background:var(--border-color, #e2e8f0); border-radius:3px; overflow:hidden;">
                    <div style="width:${Math.min(100, r.billedShare)}%; height:100%; background:${r.color};"></div>
                  </div>
                  <span style="font-size:11px; font-weight:700;">${r.billedShare}%</span>
                </div>
              </td>
              <td style="text-align:center;">
                <span class="status-badge ${badgeClass}" style="font-size:10px; padding:2px 6px;">
                  ${r.collectionRate !== null ? `${r.collectionRate}%` : 'N/A'}
                </span>
              </td>
              <td style="text-align:right;">
                <button type="button" class="btn-sm secondary-button filter-pkg-cust-btn" data-pkg-label="${escapeHtml(r.label)}" style="font-size:10px; padding:2px 6px;" title="Filter customers in this package">
                  🔍 Filter
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  // Event Listeners
  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      currentMonth = monthSelect.value;
      render();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value;
      render();
    });
  }

  if (modeBilledBtn && modeSubsBtn) {
    modeBilledBtn.addEventListener('click', () => {
      currentMetric = 'billed';
      modeBilledBtn.style.background = 'var(--accent, #0e5b4d)';
      modeBilledBtn.style.color = '#fff';
      modeSubsBtn.style.background = 'var(--card-bg, #fff)';
      modeSubsBtn.style.color = 'var(--text-color, #0f172a)';
      render();
    });

    modeSubsBtn.addEventListener('click', () => {
      currentMetric = 'subscribers';
      modeSubsBtn.style.background = 'var(--accent, #0e5b4d)';
      modeSubsBtn.style.color = '#fff';
      modeBilledBtn.style.background = 'var(--card-bg, #fff)';
      modeBilledBtn.style.color = 'var(--text-color, #0f172a)';
      render();
    });
  }

  // Sorting header clicks
  const headers = modal.querySelectorAll('th[data-sort-pkg]');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort-pkg');
      if (currentSortBy === col) {
        currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        currentSortBy = col;
        currentSortOrder = 'desc';
      }
      render();
    });
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        th.click();
      }
    });
  });

  // Filter roster by package button clicks
  if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-pkg-cust-btn');
      if (btn) {
        const pkgLabel = btn.getAttribute('data-pkg-label');
        if (typeof onFilterPackageCustomers === 'function' && pkgLabel) {
          modal.close();
          onFilterPackageCustomers(pkgLabel);
        }
      }
    });
  }

  // CSV Export
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (!currentData) return;
      const csv = generatePackageRevenueCsv(currentData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `shahdara-package-revenue-${currentMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast(`Package Revenue CSV for ${currentMonth} exported successfully.`);
    });
  }

  // Briefing Copy
  if (copyBriefingBtn) {
    copyBriefingBtn.addEventListener('click', async () => {
      if (!currentData) return;
      const text = generatePackageRevenueBriefing(currentData);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          onToast('Executive briefing copied to clipboard.');
        } else {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          onToast('Executive briefing copied to clipboard.');
        }
      } catch (err) {
        onToast('Failed to copy briefing.');
      }
    });
  }

  // Print Handlers
  function openPrintView(format) {
    if (!currentData) return;
    const html = generatePackageRevenuePrintHtml({
      data: currentData,
      format,
      referenceDate: new Date()
    });
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
      setTimeout(() => {
        try {
          printWin.print();
        } catch (_) {}
      }, 250);
    }
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => openPrintView('a4'));
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => openPrintView('thermal'));
  }

  // Close handlers
  const handleClose = () => {
    if (modal.open) modal.close();
  };

  if (closeBtn) closeBtn.addEventListener('click', handleClose);
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', handleClose);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) handleClose();
  });

  const openTriggers = [
    document.getElementById('quickActionPackageRevenue'),
    document.getElementById('openPackageRevenueModalBtn')
  ].filter(Boolean);

  function openModal(monthOverride = null) {
    populateMonths();
    if (monthOverride && /^\d{4}-\d{2}$/.test(monthOverride)) {
      currentMonth = monthOverride;
      if (monthSelect) monthSelect.value = monthOverride;
    }
    render();
    if (!modal.open) {
      modal.showModal();
    }
  }

  openTriggers.forEach(btn => {
    btn.addEventListener('click', () => {
      openModal();
    });
  });

  return {
    open(monthOverride = null) {
      openModal(monthOverride);
    },
    close() {
      handleClose();
    },
    refresh() {
      if (modal.open) render();
    }
  };
}
