/**
 * dashboard-mom-growth.js
 * Month-over-Month (MoM) Growth, Business Momentum & Traction Suite.
 *
 * Implements:
 * - Multi-month trajectory tracking (3M, 6M, 12M) of active customers, new subscribers,
 *   churn/drops, net subscriber growth, billed revenue, actual cash receipts, operating expenses,
 *   net cash profit, and collection efficiency.
 * - Granular MoM deltas (absolute PKR and percentage change) with safe zero/missing baseline handling.
 * - Business momentum classification: Accelerating, Steady Growth, Stagnant, Contracting, or Starting.
 * - Pure-vector SVG multi-bar trend chart (renderMomGrowthSvg) with net customer pills and financial bars.
 * - RFC-4180 compliant CSV export with UTF-8 BOM (generateMomGrowthCsv).
 * - Dual printable formats: A4 Executive Momentum Review and 80mm POS thermal slip (generateMomGrowthPrintHtml).
 * - Bilingual Urdu & English WhatsApp executive briefing dispatch (generateMomGrowthBriefing).
 * - Accessible modal dialog controller (setupMomGrowthModal) with month picker, comparison window toggles,
 *   interactive KPI cards, sortable comparison table, and responsive mobile layout.
 */

import {
  formatPKR,
  monthsForHistory
} from './core.js';
import {
  pktMonth,
  addMonths
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

/**
 * Calculates Month-over-Month (MoM) growth metrics and business trajectory.
 *
 * @param {Object} state - Full application state with customers and expenses
 * @param {Object} [options={}] - Query options
 * @param {string} [options.selectedMonth] - YYYY-MM month (default current PKT month)
 * @param {number} [options.windowMonths=6] - Trailing window size: 3, 6, or 12 months
 * @param {Date} [options.referenceDate=new Date()] - Reference date for calculation
 * @returns {Object} Comprehensive MoM growth analytics
 */
export function calculateMomGrowth(state = {}, {
  selectedMonth,
  windowMonths = 6,
  referenceDate = new Date()
} = {}) {
  const currentMonth = pktMonth(referenceDate);
  const activeMonth = (selectedMonth && typeof selectedMonth === 'string' && /^\d{4}-\d{2}$/.test(selectedMonth))
    ? selectedMonth
    : currentMonth;

  const validWindow = (windowMonths === 3 || windowMonths === 12) ? windowMonths : 6;

  // We fetch validWindow + 1 months to compute the baseline delta for the earliest month in the window
  const totalMonthsNeeded = validWindow + 1;
  const rawMonths = Array.from({ length: totalMonthsNeeded }, (_, i) => {
    return addMonths(activeMonth, i - (totalMonthsNeeded - 1));
  });

  const customers = Array.isArray(state.customers) ? state.customers : [];
  const expenses = Array.isArray(state.expenses) ? state.expenses : [];

  // Pre-index customer joined and archived months for reliable cohort attribution
  const customerCohorts = customers.map(c => {
    const connMonth = typeof c.connectionDate === 'string' ? c.connectionDate.slice(0, 7) : null;
    const addedMonth = typeof c.addedOn === 'string' ? c.addedOn.slice(0, 7) : null;
    const regMonth = typeof c.registrationDate === 'string' ? c.registrationDate.slice(0, 7) : null;
    const createdMonth = typeof c.createdAt === 'string' ? c.createdAt.slice(0, 7) : null;

    // Earliest bill month
    const billMonths = (Array.isArray(c.bills) ? c.bills : [])
      .map(b => (b && typeof b.month === 'string' ? b.month : null))
      .filter(Boolean)
      .sort();
    const firstBillMonth = billMonths[0] || null;

    // Earliest payment month
    const paymentMonths = (Array.isArray(c.bills) ? c.bills : [])
      .flatMap(b => (Array.isArray(b.payments) ? b.payments : []))
      .map(p => (p && typeof p.date === 'string' ? p.date.slice(0, 7) : null))
      .filter(Boolean)
      .sort();
    const firstPaymentMonth = paymentMonths[0] || null;

    const joinedMonth = connMonth || addedMonth || regMonth || createdMonth || firstBillMonth || firstPaymentMonth || '1970-01';

    let archivedMonth = null;
    if (c.archived) {
      if (typeof c.archiveDate === 'string') archivedMonth = c.archiveDate.slice(0, 7);
      else if (typeof c.archivedAt === 'string') archivedMonth = c.archivedAt.slice(0, 7);
      else if (billMonths.length > 0) archivedMonth = billMonths[billMonths.length - 1];
      else archivedMonth = joinedMonth;
    }

    return {
      customer: c,
      joinedMonth,
      archivedMonth,
      isArchived: Boolean(c.archived)
    };
  });

  // Calculate monthly metrics for all totalMonthsNeeded
  const computedMonths = rawMonths.map(month => {
    // 1. Active customers: joined on or before this month, and not archived before this month
    const activeSubs = customerCohorts.filter(cohort => {
      const joinedBeforeOrIn = cohort.joinedMonth <= month;
      const notArchivedBefore = !cohort.isArchived || (cohort.archivedMonth && cohort.archivedMonth >= month);
      return joinedBeforeOrIn && notArchivedBefore;
    });

    // 2. New customers added this month
    const newSubs = customerCohorts.filter(cohort => cohort.joinedMonth === month);

    // 3. Churned customers dropped this month
    const churnedSubs = customerCohorts.filter(cohort => cohort.isArchived && cohort.archivedMonth === month);

    const netGrowth = newSubs.length - churnedSubs.length;

    // 4. Billed charges snapshot for this month
    let billedAmount = 0;
    let pricedBillsCount = 0;
    let totalBillsCount = 0;

    for (const c of customers) {
      const bills = Array.isArray(c.bills) ? c.bills : [];
      for (const b of bills) {
        if (b && b.month === month) {
          totalBillsCount++;
          const val = b.dueAmount !== undefined ? b.dueAmount : (b.amount !== undefined ? b.amount : b.billAmount);
          const due = Number(val);
          if (!isNaN(due) && due > 0) {
            billedAmount += due;
            pricedBillsCount++;
          }
        }
      }
    }
    billedAmount = Number(billedAmount.toFixed(2));

    // 5. Cash collections: actual receipts dated in this month
    let cashCollections = 0;
    let paymentCount = 0;

    for (const c of customers) {
      const bills = Array.isArray(c.bills) ? c.bills : [];
      for (const b of bills) {
        const payments = Array.isArray(b.payments) ? b.payments : [];
        for (const p of payments) {
          if (p && typeof p.date === 'string' && p.date.slice(0, 7) === month) {
            const amt = Number(p.amount);
            if (!isNaN(amt) && amt > 0) {
              cashCollections += amt;
              paymentCount++;
            }
          }
        }
      }
    }
    cashCollections = Number(cashCollections.toFixed(2));

    // 6. Operating expenses dated in this month
    let operatingExpenses = 0;
    let expenseCount = 0;

    for (const exp of expenses) {
      if (exp && typeof exp.date === 'string' && exp.date.slice(0, 7) === month) {
        const amt = Number(exp.amount);
        if (!isNaN(amt) && amt > 0) {
          operatingExpenses += amt;
          expenseCount++;
        }
      }
    }
    operatingExpenses = Number(operatingExpenses.toFixed(2));

    // 7. Net Cash Profit
    const netProfit = Number((cashCollections - operatingExpenses).toFixed(2));

    // 8. Collection efficiency & ARPU
    const collectionEfficiency = billedAmount > 0
      ? Number(((cashCollections / billedAmount) * 100).toFixed(1))
      : 0;

    const arpu = activeSubs.length > 0
      ? Math.round(billedAmount / activeSubs.length)
      : 0;

    return {
      month,
      activeSubscribers: activeSubs.length,
      newSubscribers: newSubs.length,
      churnedSubscribers: churnedSubs.length,
      netSubscriberGrowth: netGrowth,
      billedAmount,
      totalBillsCount,
      pricedBillsCount,
      cashCollections,
      paymentCount,
      operatingExpenses,
      expenseCount,
      netProfit,
      collectionEfficiency,
      arpu
    };
  });

  // Calculate MoM deltas against immediate predecessor month
  const monthlyDataWithDeltas = [];

  for (let i = 1; i < computedMonths.length; i++) {
    const cur = computedMonths[i];
    const prev = computedMonths[i - 1];

    // Subscriber deltas
    const subDelta = cur.activeSubscribers - prev.activeSubscribers;
    const subGrowthPct = prev.activeSubscribers > 0
      ? Number(((subDelta / prev.activeSubscribers) * 100).toFixed(1))
      : (cur.activeSubscribers > 0 ? 100 : 0);

    // Billed deltas
    const billedDelta = Number((cur.billedAmount - prev.billedAmount).toFixed(2));
    const billedGrowthPct = prev.billedAmount > 0
      ? Number(((billedDelta / prev.billedAmount) * 100).toFixed(1))
      : (cur.billedAmount > 0 ? 100 : 0);

    // Collection deltas
    const collectionDelta = Number((cur.cashCollections - prev.cashCollections).toFixed(2));
    const collectionGrowthPct = prev.cashCollections > 0
      ? Number(((collectionDelta / prev.cashCollections) * 100).toFixed(1))
      : (cur.cashCollections > 0 ? 100 : 0);

    // Expense deltas
    const expenseDelta = Number((cur.operatingExpenses - prev.operatingExpenses).toFixed(2));
    const expenseGrowthPct = prev.operatingExpenses > 0
      ? Number(((expenseDelta / prev.operatingExpenses) * 100).toFixed(1))
      : (cur.operatingExpenses > 0 ? 100 : 0);

    // Net profit deltas
    const profitDelta = Number((cur.netProfit - prev.netProfit).toFixed(2));
    const profitGrowthPct = prev.netProfit !== 0
      ? Number(((profitDelta / Math.abs(prev.netProfit)) * 100).toFixed(1))
      : (cur.netProfit !== 0 ? 100 : 0);

    monthlyDataWithDeltas.push({
      ...cur,
      mom: {
        subscriberDelta: subDelta,
        subscriberGrowthPct: subGrowthPct,
        billedDelta,
        billedGrowthPct,
        collectionDelta,
        collectionGrowthPct,
        expenseDelta,
        expenseGrowthPct,
        profitDelta,
        profitGrowthPct
      }
    });
  }

  // Active month focus item
  const activeItem = monthlyDataWithDeltas.find(m => m.month === activeMonth) || monthlyDataWithDeltas[monthlyDataWithDeltas.length - 1];

  // Business momentum evaluation
  let momentum = 'Steady Growth';
  let momentumUrdu = 'مستحکم رفتار';
  let momentumColor = '#10b981';

  if (activeItem) {
    const subPct = activeItem.mom.subscriberGrowthPct;
    const collPct = activeItem.mom.collectionGrowthPct;

    if (subPct > 5 && collPct > 5) {
      momentum = 'Accelerating';
      momentumUrdu = 'تیز ترین رفتار / تیز ترقی';
      momentumColor = '#059669';
    } else if (subPct < 0 || collPct < -5) {
      momentum = 'Contracting';
      momentumUrdu = 'سست رفتار / کمی کا رجحان';
      momentumColor = '#ef4444';
    } else if (Math.abs(subPct) <= 2 && Math.abs(collPct) <= 2) {
      momentum = 'Stagnant';
      momentumUrdu = 'جمود / یکساں رفتار';
      momentumColor = '#f59e0b';
    } else {
      momentum = 'Steady Growth';
      momentumUrdu = 'مستحکم رفتار';
      momentumColor = '#10b981';
    }
  }

  return {
    activeMonth,
    windowMonths: validWindow,
    monthlyData: monthlyDataWithDeltas,
    activeItem,
    momentum,
    momentumUrdu,
    momentumColor,
    totalTrackedCustomers: customers.length,
    activeSubscribers: activeItem ? activeItem.activeSubscribers : 0,
    billedAmount: activeItem ? activeItem.billedAmount : 0,
    cashCollections: activeItem ? activeItem.cashCollections : 0,
    operatingExpenses: activeItem ? activeItem.operatingExpenses : 0,
    netProfit: activeItem ? activeItem.netProfit : 0,
    collectionEfficiency: activeItem ? activeItem.collectionEfficiency : 0
  };
}

/**
 * Generates a pure-vector SVG visualization comparing Billed Revenue,
 * Cash Collections, and Operating Expenses with Net Subscriber indicators.
 *
 * @param {Object} momData - Calculation results from calculateMomGrowth
 * @param {Object} [options={}] - Render options
 * @param {number} [options.width=760] - SVG viewBox width
 * @param {number} [options.height=300] - SVG viewBox height
 * @returns {string} Pure vector SVG markup
 */
export function renderMomGrowthSvg(momData, { width = 760, height = 300 } = {}) {
  const months = (momData && Array.isArray(momData.monthlyData)) ? momData.monthlyData : [];
  if (months.length === 0) {
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="No data available"><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#64748b" font-size="14" font-family="system-ui">No Month-over-Month historical data available</text></svg>`;
  }

  const padding = { top: 40, right: 30, bottom: 45, left: 75 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Maximum value across all financial series
  const maxVal = Math.max(
    ...months.flatMap(m => [m.billedAmount, m.cashCollections, m.operatingExpenses]),
    1000
  );
  // Round up to clean ceiling
  const yCeil = Math.ceil(maxVal * 1.15 / 5000) * 5000 || 10000;

  const numMonths = months.length;
  const groupWidth = chartW / numMonths;
  const barWidth = Math.min(Math.max(groupWidth * 0.22, 12), 28);
  const barGap = 4;

  const yPos = val => padding.top + chartH - ((val / yCeil) * chartH);

  // Y-axis grid lines (4 intervals)
  const ySteps = 4;
  let gridLines = '';
  for (let i = 0; i <= ySteps; i++) {
    const val = (yCeil / ySteps) * i;
    const y = yPos(val);
    gridLines += `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="#64748b" font-size="10" font-family="system-ui">${(val / 1000).toFixed(0)}k</text>
    `;
  }

  // Draw month bars and net customer pills
  let groupsHtml = '';
  months.forEach((m, idx) => {
    const centerX = padding.left + (idx * groupWidth) + (groupWidth / 2);
    const startX = centerX - ((barWidth * 3 + barGap * 2) / 2);

    const xBilled = startX;
    const xColl = startX + barWidth + barGap;
    const xExp = startX + (barWidth + barGap) * 2;

    const yBilled = yPos(m.billedAmount);
    const hBilled = Math.max(chartH - (yBilled - padding.top), 2);

    const yColl = yPos(m.cashCollections);
    const hColl = Math.max(chartH - (yColl - padding.top), 2);

    const yExp = yPos(m.operatingExpenses);
    const hExp = Math.max(chartH - (yExp - padding.top), 2);

    const isCurrent = m.month === momData.activeMonth;
    const strokeHighlight = isCurrent ? 'stroke="#0f172a" stroke-width="1.5"' : '';

    // Net customer pill badge
    const netSign = m.netSubscriberGrowth > 0 ? `+${m.netSubscriberGrowth}` : `${m.netSubscriberGrowth}`;
    const pillColor = m.netSubscriberGrowth > 0 ? '#10b981' : m.netSubscriberGrowth < 0 ? '#ef4444' : '#64748b';
    const pillY = Math.min(yBilled, yColl, yExp) - 18;

    groupsHtml += `
      <g class="mom-month-group" data-month="${m.month}">
        <!-- Highlight background for active month -->
        ${isCurrent ? `<rect x="${padding.left + idx * groupWidth}" y="${padding.top}" width="${groupWidth}" height="${chartH}" fill="rgba(14, 91, 77, 0.05)" rx="4" />` : ''}

        <!-- Net Customer Badge Pill -->
        <rect x="${centerX - 18}" y="${pillY}" width="36" height="15" rx="7.5" fill="${pillColor}" />
        <text x="${centerX}" y="${pillY + 11}" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="700" font-family="system-ui">${netSign}</text>

        <!-- Billed Revenue Bar -->
        <rect x="${xBilled}" y="${yBilled}" width="${barWidth}" height="${hBilled}" fill="#6366f1" rx="3" ${strokeHighlight}>
          <title>${m.month} Billed: PKR ${m.billedAmount.toLocaleString()}</title>
        </rect>

        <!-- Cash Collections Bar -->
        <rect x="${xColl}" y="${yColl}" width="${barWidth}" height="${hColl}" fill="#10b981" rx="3" ${strokeHighlight}>
          <title>${m.month} Collected: PKR ${m.cashCollections.toLocaleString()}</title>
        </rect>

        <!-- Operating Expenses Bar -->
        <rect x="${xExp}" y="${yExp}" width="${barWidth}" height="${hExp}" fill="#f59e0b" rx="3" ${strokeHighlight}>
          <title>${m.month} Expenses: PKR ${m.operatingExpenses.toLocaleString()}</title>
        </rect>

        <!-- Month Label -->
        <text x="${centerX}" y="${height - padding.bottom + 18}" text-anchor="middle" fill="${isCurrent ? '#0e5b4d' : '#475569'}" font-size="${isCurrent ? '11' : '10'}" font-weight="${isCurrent ? '800' : '500'}" font-family="system-ui">${m.month}</text>
      </g>
    `;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Month-over-month growth chart" style="width: 100%; height: auto; display: block;">
      <defs>
        <linearGradient id="momBilledGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#818cf8" />
          <stop offset="100%" stop-color="#4f46e5" />
        </linearGradient>
      </defs>

      <!-- Background & Grid -->
      ${gridLines}

      <!-- Chart Bars & Data -->
      ${groupsHtml}

      <!-- Bottom Baseline Axis -->
      <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="#94a3b8" stroke-width="1.5" />

      <!-- Top Legend -->
      <g transform="translate(${padding.left}, 15)">
        <rect x="0" y="0" width="10" height="10" rx="2" fill="#6366f1" />
        <text x="14" y="9" font-size="10" font-weight="600" fill="#475569" font-family="system-ui">Billed (PKR)</text>

        <rect x="95" y="0" width="10" height="10" rx="2" fill="#10b981" />
        <text x="109" y="9" font-size="10" font-weight="600" fill="#475569" font-family="system-ui">Collected (PKR)</text>

        <rect x="205" y="0" width="10" height="10" rx="2" fill="#f59e0b" />
        <text x="219" y="9" font-size="10" font-weight="600" fill="#475569" font-family="system-ui">Expenses (PKR)</text>

        <rect x="315" y="0" width="10" height="10" rx="5" fill="#10b981" />
        <text x="329" y="9" font-size="10" font-weight="600" fill="#475569" font-family="system-ui">Net Subs (±)</text>
      </g>
    </svg>
  `;
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM.
 * @param {Object} momData - Calculation results
 * @returns {string} CSV string with UTF-8 BOM
 */
export function generateMomGrowthCsv(momData) {
  const months = (momData && Array.isArray(momData.monthlyData)) ? momData.monthlyData : [];
  const lines = [
    '\uFEFFMonth,Active Subscribers,New Subscribers,Churned,Net Growth,Billed Charges (PKR),Billed Delta (PKR),Billed MoM %,Cash Collections (PKR),Cash Delta (PKR),Cash MoM %,Collection Efficiency %,Operating Expenses (PKR),Expenses MoM %,Net Cash Profit (PKR),Net Profit MoM %'
  ];

  for (const m of months) {
    const row = [
      m.month,
      m.activeSubscribers,
      m.newSubscribers,
      m.churnedSubscribers,
      m.netSubscriberGrowth,
      m.billedAmount,
      m.mom ? m.mom.billedDelta : 0,
      m.mom ? `${m.mom.billedGrowthPct}%` : '0%',
      m.cashCollections,
      m.mom ? m.mom.collectionDelta : 0,
      m.mom ? `${m.mom.collectionGrowthPct}%` : '0%',
      `${m.collectionEfficiency}%`,
      m.operatingExpenses,
      m.mom ? `${m.mom.expenseGrowthPct}%` : '0%',
      m.netProfit,
      m.mom ? `${m.mom.profitGrowthPct}%` : '0%'
    ];
    lines.push(row.map(val => (typeof val === 'string' && val.includes(',')) ? `"${val}"` : String(val)).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Generates dual printable formats: A4 Executive Momentum Review and 80mm POS slip.
 * @param {Object} momData
 * @param {Object} [options={}]
 * @param {'a4'|'thermal-80'} [options.format='a4']
 * @returns {string} Printable HTML
 */
export function generateMomGrowthPrintHtml(momData, { format = 'a4' } = {}) {
  const active = momData?.activeItem;
  const months = momData?.monthlyData || [];
  const today = formatDateYmd(new Date());

  if (format === 'thermal-80') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Shahdara ISP - MoM Growth Slip - ${escapeHtml(momData?.activeMonth || '')}</title>
  <style>
    @page { size: 80mm auto; margin: 2mm; }
    body { margin: 0; padding: 0; background: #fff; color: #000; font-family: monospace; font-size: 11px; }
    .thermal-receipt { width: 76mm; padding: 4mm; }
  </style>
</head>
<body>
  <div class="thermal-receipt thermal-80">
    <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 6px;">
      <strong style="font-size: 13px;">SHAHDARA FIBER NET</strong><br>
      <span>MoM Business Momentum Slip</span><br>
      <small>Month: ${escapeHtml(momData?.activeMonth || '')} · Date: ${today}</small>
    </div>
    <div style="margin-bottom: 6px;">
      <strong>TRACTION SUMMARY:</strong><br>
      • Momentum: ${escapeHtml(momData?.momentum || 'Steady')}<br>
      • Active Subs: ${active?.activeSubscribers || 0} (${active?.mom?.subscriberGrowthPct >= 0 ? '+' : ''}${active?.mom?.subscriberGrowthPct || 0}%)<br>
      • Net Adds: ${active?.netSubscriberGrowth || 0}<br>
      • Billed: PKR ${Number(active?.billedAmount || 0).toLocaleString()}<br>
      • Collected: PKR ${Number(active?.cashCollections || 0).toLocaleString()} (${active?.mom?.collectionGrowthPct >= 0 ? '+' : ''}${active?.mom?.collectionGrowthPct || 0}%)<br>
      • Expenses: PKR ${Number(active?.operatingExpenses || 0).toLocaleString()}<br>
      • Net Profit: PKR ${Number(active?.netProfit || 0).toLocaleString()} (${active?.mom?.profitGrowthPct >= 0 ? '+' : ''}${active?.mom?.profitGrowthPct || 0}%)<br>
      • Efficiency: ${active?.collectionEfficiency || 0}%
    </div>
    <div style="border-top: 1px dashed #000; padding-top: 6px; text-align: center; font-size: 9px;">
      Generated offline by Shahdara ISP Billing
    </div>
  </div>
</body>
</html>`;
  }

  // Standard A4 Executive Format
  const rowsHtml = months.map(m => `
    <tr>
      <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: 700;">${m.month}</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${m.activeSubscribers} <small style="color: ${m.mom?.subscriberDelta >= 0 ? '#10b981' : '#ef4444'};">(${m.mom?.subscriberDelta >= 0 ? '+' : ''}${m.mom?.subscriberDelta || 0})</small></td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">PKR ${m.billedAmount.toLocaleString()}</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #10b981; font-weight: 700;">PKR ${m.cashCollections.toLocaleString()}</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: ${m.mom?.collectionGrowthPct >= 0 ? '#10b981' : '#ef4444'}; font-weight: 600;">${m.mom?.collectionGrowthPct >= 0 ? '+' : ''}${m.mom?.collectionGrowthPct || 0}%</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #f59e0b;">PKR ${m.operatingExpenses.toLocaleString()}</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700; color: ${m.netProfit >= 0 ? '#0e5b4d' : '#ef4444'};">PKR ${m.netProfit.toLocaleString()}</td>
      <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${m.collectionEfficiency}%</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Shahdara ISP - Month-over-Month Growth Statement - ${escapeHtml(momData?.activeMonth || '')}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; margin: 0; background: #fff; }
    .print-document { max-width: 900px; margin: 0 auto; }
  </style>
</head>
<body>
  <div class="print-document a4-report">
    <header style="border-bottom: 2px solid #0e5b4d; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <h1 style="margin: 0; font-size: 24px; color: #0e5b4d;">SHAHDARA FIBER NET</h1>
        <p style="margin: 4px 0 0 0; font-size: 14px; color: #475569;">MONTH-OVER-MONTH (MoM) GROWTH &amp; BUSINESS MOMENTUM STATEMENT</p>
      </div>
      <div style="text-align: right; font-size: 12px; color: #64748b;">
        <div>Report Month: <strong>${escapeHtml(momData?.activeMonth || '')}</strong></div>
        <div>Print Date: <strong>${today}</strong></div>
        <div>Momentum: <strong style="color: ${momData?.momentumColor || '#0e5b4d'};">${escapeHtml(momData?.momentum || 'Steady')}</strong></div>
      </div>
    </header>

    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
        <div style="font-size: 11px; color: #64748b; font-weight: 600;">ACTIVE SUBSCRIBERS</div>
        <div style="font-size: 18px; font-weight: 800; color: #0f172a;">${active?.activeSubscribers || 0}</div>
        <div style="font-size: 11px; color: ${active?.mom?.subscriberGrowthPct >= 0 ? '#10b981' : '#ef4444'};">${active?.mom?.subscriberGrowthPct >= 0 ? '▲ +' : '▼ '}${active?.mom?.subscriberGrowthPct || 0}% MoM</div>
      </div>
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
        <div style="font-size: 11px; color: #64748b; font-weight: 600;">BILLED CHARGES</div>
        <div style="font-size: 18px; font-weight: 800; color: #0f172a;">PKR ${Number(active?.billedAmount || 0).toLocaleString()}</div>
        <div style="font-size: 11px; color: ${active?.mom?.billedGrowthPct >= 0 ? '#10b981' : '#ef4444'};">${active?.mom?.billedGrowthPct >= 0 ? '▲ +' : '▼ '}${active?.mom?.billedGrowthPct || 0}% MoM</div>
      </div>
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
        <div style="font-size: 11px; color: #64748b; font-weight: 600;">CASH COLLECTIONS</div>
        <div style="font-size: 18px; font-weight: 800; color: #10b981;">PKR ${Number(active?.cashCollections || 0).toLocaleString()}</div>
        <div style="font-size: 11px; color: ${active?.mom?.collectionGrowthPct >= 0 ? '#10b981' : '#ef4444'};">${active?.mom?.collectionGrowthPct >= 0 ? '▲ +' : '▼ '}${active?.mom?.collectionGrowthPct || 0}% MoM</div>
      </div>
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc;">
        <div style="font-size: 11px; color: #64748b; font-weight: 600;">NET CASH PROFIT</div>
        <div style="font-size: 18px; font-weight: 800; color: #0e5b4d;">PKR ${Number(active?.netProfit || 0).toLocaleString()}</div>
        <div style="font-size: 11px; color: ${active?.mom?.profitGrowthPct >= 0 ? '#10b981' : '#ef4444'};">${active?.mom?.profitGrowthPct >= 0 ? '▲ +' : '▼ '}${active?.mom?.profitGrowthPct || 0}% MoM</div>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: left;">Month</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Subscribers</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Billed (PKR)</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Collected (PKR)</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Coll. Growth</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Expenses (PKR)</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Net Profit (PKR)</th>
          <th style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">Efficiency</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <footer style="margin-top: 40px; display: flex; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 12px;">
      <div style="width: 200px; text-align: center;">
        <div style="border-bottom: 1px solid #64748b; height: 35px; margin-bottom: 6px;"></div>
        <span>Accounts Officer</span>
      </div>
      <div style="width: 200px; text-align: center;">
        <div style="border-bottom: 1px solid #64748b; height: 35px; margin-bottom: 6px;"></div>
        <span>Managing Director / Owner</span>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Formats a concise bilingual Urdu & English WhatsApp summary briefing.
 * @param {Object} momData
 * @returns {string} Formatted WhatsApp text
 */
export function generateMomGrowthBriefing(momData) {
  if (!momData || !momData.activeItem) {
    return 'Month-over-month growth data is currently unavailable.';
  }

  const active = momData.activeItem;
  const mom = active.mom || {};
  const today = formatDateYmd(new Date());

  const lines = [
    `*Shahdara ISP - MoM Growth & Business Momentum*`,
    `*شاہدرہ انٹرنیٹ سروسز - ماہانہ ترقیاتی و کاروباری رپورٹ*`,
    `--------------------------------`,
    `📅 *Report Month / جائزہ ماہ:* ${momData.activeMonth}`,
    `🗓️ *Date / تاریخ:* ${today}`,
    `🚀 *Momentum / رفتار:* ${momData.momentum} (${momData.momentumUrdu})`,
    `--------------------------------`,
    `👥 *SUBSCRIBERS / صارفین:*`,
    `• Active Subscribers / کل فعال صارفین: *${active.activeSubscribers}*`,
    `• New Additions / نئے کنکشن: *+${active.newSubscribers}*`,
    `• Disconnections / منقطع: *${active.churnedSubscribers}*`,
    `• Net Growth / خالص اضافہ: *${active.netSubscriberGrowth >= 0 ? '+' : ''}${active.netSubscriberGrowth}* (${mom.subscriberGrowthPct >= 0 ? '+' : ''}${mom.subscriberGrowthPct || 0}% MoM)`,
    `--------------------------------`,
    `💰 *FINANCIAL TRACTION / مالیاتی کارکردگی:*`,
    `• Billed Revenue / ماہانہ بلنگ: *PKR ${Number(active.billedAmount).toLocaleString()}* (${mom.billedGrowthPct >= 0 ? '+' : ''}${mom.billedGrowthPct || 0}% MoM)`,
    `• Cash Collected / نقد وصولی: *PKR ${Number(active.cashCollections).toLocaleString()}* (${mom.collectionGrowthPct >= 0 ? '+' : ''}${mom.collectionGrowthPct || 0}% MoM)`,
    `• Operating Expenses / اخراجات: *PKR ${Number(active.operatingExpenses).toLocaleString()}* (${mom.expenseGrowthPct >= 0 ? '+' : ''}${mom.expenseGrowthPct || 0}% MoM)`,
    `• Net Cash Profit / خالص منافع: *PKR ${Number(active.netProfit).toLocaleString()}* (${mom.profitGrowthPct >= 0 ? '+' : ''}${mom.profitGrowthPct || 0}% MoM)`,
    `• Collection Efficiency / ریکوری شرح: *${active.collectionEfficiency}%*`,
    `• ARPU / فی صارف اوسط آمدن: *PKR ${Number(active.arpu).toLocaleString()}*`,
    `--------------------------------`,
    `_Generated locally on device via Shahdara ISP Billing System._`
  ];

  return lines.join('\n');
}

/**
 * Attaches event listeners and manages the lifecycle of the MoM Growth Modal Dialog.
 *
 * @param {Object} state - Full application state
 * @param {Object} [options={}]
 * @param {Function} [options.onFilterMonth]
 * @param {Function} [options.onToast]
 * @returns {Object} Controller interface
 */
export function setupMomGrowthModal(state = {}, {
  onFilterMonth = null,
  onToast = null
} = {}) {
  const modal = document.getElementById('momGrowthModal');
  const closeBtn = document.getElementById('closeMomGrowthModalBtn');
  const closeSecondaryBtn = document.getElementById('closeMomGrowthSecondaryBtn');
  const monthSelect = document.getElementById('momGrowthMonthSelect');
  const windowToggleContainer = document.getElementById('momGrowthWindowToggle');
  const svgContainer = document.getElementById('momGrowthSvgContainer');
  const tableBody = document.getElementById('momGrowthTableBody');
  const exportCsvBtn = document.getElementById('exportMomGrowthCsvBtn');
  const printA4Btn = document.getElementById('printMomGrowthA4Btn');
  const printPosBtn = document.getElementById('printMomGrowthPosBtn');
  const shareWhatsAppBtn = document.getElementById('shareMomGrowthWhatsAppBtn');

  // Metric KPI elements
  const kpiSubscribers = document.getElementById('momKpiSubscribers');
  const kpiSubscribersDelta = document.getElementById('momKpiSubscribersDelta');
  const kpiBilled = document.getElementById('momKpiBilled');
  const kpiBilledDelta = document.getElementById('momKpiBilledDelta');
  const kpiCollected = document.getElementById('momKpiCollected');
  const kpiCollectedDelta = document.getElementById('momKpiCollectedDelta');
  const kpiProfit = document.getElementById('momKpiProfit');
  const kpiProfitDelta = document.getElementById('momKpiProfitDelta');
  const kpiMomentumBadge = document.getElementById('momKpiMomentumBadge');

  const emptyState = document.getElementById('momGrowthEmptyState');
  const sortHeaders = modal ? modal.querySelectorAll('th[data-sort-mom]') : [];

  let currentWindow = 6;
  let currentMonth = pktMonth(new Date());
  let currentData = null;
  let currentSortCol = 'month';
  let currentSortAsc = false;

  function populateMonthSelect() {
    if (!monthSelect) return;
    const months = monthsForHistory();
    monthSelect.innerHTML = months.map(m => {
      const isSelected = m === currentMonth ? 'selected' : '';
      return `<option value="${m}" ${isSelected}>${m}</option>`;
    }).join('');
  }

  function renderContent() {
    const resolvedState = typeof state === 'function' ? state() : state;
    currentData = calculateMomGrowth(resolvedState, {
      selectedMonth: currentMonth,
      windowMonths: currentWindow
    });

    const active = currentData.activeItem;
    const mom = active?.mom || {};

    // Update KPI cards
    if (kpiSubscribers) kpiSubscribers.textContent = String(active?.activeSubscribers || 0);
    if (kpiSubscribersDelta) {
      const pct = mom.subscriberGrowthPct ?? 0;
      kpiSubscribersDelta.textContent = `${pct >= 0 ? '▲ +' : '▼ '}${pct}% MoM (${mom.subscriberDelta >= 0 ? '+' : ''}${mom.subscriberDelta || 0})`;
      kpiSubscribersDelta.style.color = pct >= 0 ? '#10b981' : '#ef4444';
    }

    if (kpiBilled) kpiBilled.textContent = `PKR ${Number(active?.billedAmount || 0).toLocaleString()}`;
    if (kpiBilledDelta) {
      const pct = mom.billedGrowthPct ?? 0;
      kpiBilledDelta.textContent = `${pct >= 0 ? '▲ +' : '▼ '}${pct}% MoM`;
      kpiBilledDelta.style.color = pct >= 0 ? '#10b981' : '#ef4444';
    }

    if (kpiCollected) kpiCollected.textContent = `PKR ${Number(active?.cashCollections || 0).toLocaleString()}`;
    if (kpiCollectedDelta) {
      const pct = mom.collectionGrowthPct ?? 0;
      kpiCollectedDelta.textContent = `${pct >= 0 ? '▲ +' : '▼ '}${pct}% MoM`;
      kpiCollectedDelta.style.color = pct >= 0 ? '#10b981' : '#ef4444';
    }

    if (kpiProfit) kpiProfit.textContent = `PKR ${Number(active?.netProfit || 0).toLocaleString()}`;
    if (kpiProfitDelta) {
      const pct = mom.profitGrowthPct ?? 0;
      kpiProfitDelta.textContent = `${pct >= 0 ? '▲ +' : '▼ '}${pct}% MoM`;
      kpiProfitDelta.style.color = pct >= 0 ? '#10b981' : '#ef4444';
    }

    if (kpiMomentumBadge) {
      kpiMomentumBadge.textContent = `${currentData.momentum} (${currentData.momentumUrdu})`;
      kpiMomentumBadge.style.background = currentData.momentumColor;
      kpiMomentumBadge.style.color = '#ffffff';
    }

    // Render SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderMomGrowthSvg(currentData, { width: 760, height: 300 });
    }

    // Render comparison table with sorting
    if (tableBody) {
      let monthsList = [...(currentData.monthlyData || [])];

      if (currentSortCol) {
        monthsList.sort((a, b) => {
          let valA = a[currentSortCol];
          let valB = b[currentSortCol];
          if (currentSortCol === 'collectionGrowthPct') {
            valA = a.mom?.collectionGrowthPct ?? 0;
            valB = b.mom?.collectionGrowthPct ?? 0;
          }
          if (typeof valA === 'string') {
            return currentSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return currentSortAsc ? (Number(valA || 0) - Number(valB || 0)) : (Number(valB || 0) - Number(valA || 0));
        });
      }

      if (emptyState) emptyState.hidden = monthsList.length > 0;

      // Update sort indicators on headers
      sortHeaders.forEach(th => {
        const col = th.getAttribute('data-sort-mom');
        const indicator = th.querySelector('.sort-indicator');
        if (indicator) {
          if (col === currentSortCol) {
            indicator.textContent = currentSortAsc ? '▲' : '▼';
            th.setAttribute('aria-sort', currentSortAsc ? 'ascending' : 'descending');
          } else {
            indicator.textContent = '⇅';
            th.setAttribute('aria-sort', 'none');
          }
        }
      });

      tableBody.innerHTML = monthsList.map(m => {
        const isCurrent = m.month === currentData.activeMonth;
        const subDeltaColor = (m.mom?.subscriberDelta || 0) >= 0 ? '#10b981' : '#ef4444';
        const collDeltaColor = (m.mom?.collectionGrowthPct || 0) >= 0 ? '#10b981' : '#ef4444';
        const profitColor = m.netProfit >= 0 ? '#0e5b4d' : '#ef4444';

        return `
          <tr class="${isCurrent ? 'is-active-month' : ''}" style="${isCurrent ? 'font-weight: 700; background: rgba(14, 91, 77, 0.05);' : ''}">
            <td style="padding: 10px 12px;"><strong>${m.month}</strong> ${isCurrent ? '<span style="font-size: 10px; background: #0e5b4d; color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">ACTIVE</span>' : ''}</td>
            <td style="padding: 10px 12px; text-align: right;">${m.activeSubscribers} <small style="color: ${subDeltaColor}; font-weight: 600;">(${m.mom?.subscriberDelta >= 0 ? '+' : ''}${m.mom?.subscriberDelta || 0})</small></td>
            <td style="padding: 10px 12px; text-align: right;">+${m.newSubscribers}</td>
            <td style="padding: 10px 12px; text-align: right; color: #ef4444;">-${m.churnedSubscribers}</td>
            <td style="padding: 10px 12px; text-align: right;">PKR ${m.billedAmount.toLocaleString()}</td>
            <td style="padding: 10px 12px; text-align: right; color: #10b981; font-weight: 600;">PKR ${m.cashCollections.toLocaleString()}</td>
            <td style="padding: 10px 12px; text-align: right; color: ${collDeltaColor}; font-weight: 600;">${m.mom?.collectionGrowthPct >= 0 ? '+' : ''}${m.mom?.collectionGrowthPct || 0}%</td>
            <td style="padding: 10px 12px; text-align: right; color: #f59e0b;">PKR ${m.operatingExpenses.toLocaleString()}</td>
            <td style="padding: 10px 12px; text-align: right; color: ${profitColor}; font-weight: 700;">PKR ${m.netProfit.toLocaleString()}</td>
            <td style="padding: 10px 12px; text-align: right;">${m.collectionEfficiency}%</td>
          </tr>
        `;
      }).join('');
    }
  }

  function open(month) {
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      currentMonth = month;
    }
    populateMonthSelect();
    if (monthSelect) monthSelect.value = currentMonth;
    renderContent();
    if (modal?.showModal) modal.showModal();
    else modal?.setAttribute('open', '');
  }

  function close() {
    if (modal?.close) modal.close();
    else modal?.removeAttribute('open');
  }

  // Event Listeners
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', close);
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) close();
    });
    modal.addEventListener('cancel', () => {
      close();
    });
  }

  // Table header sort
  sortHeaders.forEach(th => {
    const handleSort = () => {
      const col = th.getAttribute('data-sort-mom');
      if (currentSortCol === col) {
        currentSortAsc = !currentSortAsc;
      } else {
        currentSortCol = col;
        currentSortAsc = false;
      }
      renderContent();
    };

    th.addEventListener('click', handleSort);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSort();
      }
    });
  });

  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      currentMonth = monthSelect.value;
      renderContent();
      if (typeof onFilterMonth === 'function') onFilterMonth(currentMonth);
    });
  }

  if (windowToggleContainer) {
    windowToggleContainer.addEventListener('click', e => {
      const btn = e.target.closest('button[data-window]');
      if (!btn) return;
      windowToggleContainer.querySelectorAll('button[data-window]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentWindow = Number(btn.getAttribute('data-window')) || 6;
      renderContent();
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (!currentData) return;
      const csv = generateMomGrowthCsv(currentData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shahdara-mom-growth-${currentMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (typeof onToast === 'function') onToast(`Exported MoM growth report for ${currentMonth} to CSV.`);
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      if (!currentData) return;
      const html = generateMomGrowthPrintHtml(currentData, { format: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
      } else if (typeof onToast === 'function') {
        onToast('Pop-up blocked. Please allow pop-ups to print statement.');
      }
    });
  }

  if (printPosBtn) {
    printPosBtn.addEventListener('click', () => {
      if (!currentData) return;
      const html = generateMomGrowthPrintHtml(currentData, { format: 'thermal-80' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
      } else if (typeof onToast === 'function') {
        onToast('Pop-up blocked. Please allow pop-ups to print slip.');
      }
    });
  }

  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', async () => {
      if (!currentData) return;
      const text = generateMomGrowthBriefing(currentData);
      const encoded = encodeURIComponent(text);
      const waUrl = `https://wa.me/?text=${encoded}`;
      window.open(waUrl, '_blank');
      if (typeof onToast === 'function') onToast('Opening WhatsApp executive briefing draft...');
    });
  }

  const openTriggers = [
    document.getElementById('quickActionMomGrowth'),
    document.getElementById('openMomGrowthModalBtn')
  ].filter(Boolean);

  openTriggers.forEach(btn => {
    btn.addEventListener('click', () => open());
  });

  return {
    open,
    close,
    renderContent,
    getCurrentData: () => currentData
  };
}
