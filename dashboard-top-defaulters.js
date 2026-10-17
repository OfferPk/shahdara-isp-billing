/**
 * dashboard-top-defaulters.js
 * High-Risk Defaulters & Delinquent Accounts Management Suite.
 *
 * Implements:
 * - Ranked Top Defaulters by outstanding balance with real cash-allocation derivation.
 * - Multi-month unpaid tracking with individual overdue month tags and oldest overdue days.
 * - Last recorded payment tracking (date, amount, method) to identify abandoned vs active accounts.
 * - Portfolio debt concentration analytics (% of total receivables held in top accounts).
 * - Risk cohort classification: Critical (3+ months / 60+ days), High (2 months / 30+ days), Moderate.
 * - One-tap bilingual Urdu & English WhatsApp payment reminder drafts (draft-only, never auto-sent).
 * - Pure-vector SVG visualizer (renderTopDefaultersSvg) with horizontal bars and concentration HUD.
 * - Formal RFC-4180 CSV export with UTF-8 BOM.
 * - Dual printable formats: A4 Executive Recovery Manifest and 80mm POS field collector slip.
 * - Accessible modal dialog controller (setupTopDefaultersModal) with filters and direct customer profile navigation.
 */

import {
  calculatePaymentAllocations,
  formatPKR,
  monthsForHistory
} from './core.js';
import {
  formatWhatsAppUrl,
  buildPaymentReminderMessage
} from './form-validation.js';

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
 * Calculates calendar day difference between two YYYY-MM-DD dates in Pakistan Standard Time.
 * @param {string} dateStrA
 * @param {string} dateStrB
 * @returns {number} Days difference (dateStrA - dateStrB)
 */
export function diffCalendarDays(dateStrA, dateStrB) {
  if (!dateStrA || !dateStrB) return 0;
  const parseYmd = s => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const msA = parseYmd(dateStrA);
  const msB = parseYmd(dateStrB);
  return Math.round((msA - msB) / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates full defaulters list ranked by outstanding balance.
 *
 * @param {Object} state - Full application state
 * @param {Object} [options]
 * @param {Date} [options.referenceDate=new Date()]
 * @param {number|null} [options.limit=20] - Top N accounts (null or 0 for all)
 * @param {string} [options.area='all'] - Area filter
 * @param {string} [options.riskLevel='all'] - 'all', 'critical', 'high', 'moderate'
 * @param {string} [options.search=''] - Search query (name, number, phone, mohalla)
 * @param {number} [options.minOutstanding=1] - Minimum PKR outstanding
 * @returns {Object} Defaulter data and portfolio concentration metrics
 */
export function calculateTopDefaulters(state, {
  referenceDate = new Date(),
  limit = 20,
  area = 'all',
  riskLevel = 'all',
  search = '',
  minOutstanding = 1
} = {}) {
  const refYmd = formatDateYmd(referenceDate);
  const allocations = calculatePaymentAllocations(state || { customers: [] });
  const customers = Array.isArray(state?.customers) ? state.customers : [];

  let totalReceivablesDues = 0;
  let allDefaulters = [];

  for (const c of customers) {
    if (c.archived) continue;

    let customerDuesCents = 0;
    const unpaidMonthsList = [];
    let oldestDueDateYmd = null;
    let maxOverdueDays = 0;

    // Collect all historical payments to find the most recent one
    let latestPayment = null;

    const bills = Array.isArray(c.bills) ? c.bills : [];
    for (const bill of bills) {
      if (Array.isArray(bill.payments)) {
        for (const p of bill.payments) {
          if (!latestPayment || (p.date && p.date.localeCompare(latestPayment.date) > 0)) {
            latestPayment = p;
          }
        }
      }

      // Check remaining balance for this bill from allocations
      const allocSummary = allocations.forMonth?.(c.id, bill.month);
      const balanceDueCents = allocSummary?.balanceDueCents !== null && allocSummary?.balanceDueCents !== undefined
        ? allocSummary.balanceDueCents
        : Math.round(Number(bill.dueAmount || bill.amount || 0) * 100);

      if (balanceDueCents > 0) {
        customerDuesCents += balanceDueCents;
        const dueYmd = bill.dueDate || `${bill.month}-05`;
        const daysOverdue = Math.max(0, diffCalendarDays(refYmd, dueYmd));

        unpaidMonthsList.push({
          month: bill.month,
          dueYmd,
          daysOverdue,
          balanceDue: Math.round(balanceDueCents / 100)
        });

        if (!oldestDueDateYmd || dueYmd.localeCompare(oldestDueDateYmd) < 0) {
          oldestDueDateYmd = dueYmd;
        }
        if (daysOverdue > maxOverdueDays) {
          maxOverdueDays = daysOverdue;
        }
      }
    }

    const totalOutstanding = Math.round(customerDuesCents / 100);
    if (totalOutstanding > 0) {
      totalReceivablesDues += totalOutstanding;

      // Determine risk category based on unpaid months and age
      let riskCategory = 'moderate';
      if (unpaidMonthsList.length >= 3 || maxOverdueDays >= 60) {
        riskCategory = 'critical';
      } else if (unpaidMonthsList.length >= 2 || maxOverdueDays >= 30) {
        riskCategory = 'high';
      }

      allDefaulters.push({
        id: c.id,
        customerNumber: c.customerNumber,
        name: c.name || 'Unnamed Subscriber',
        phone: c.phone || '',
        area: c.area || 'Shahdara',
        mohalla: c.mohalla || '',
        address: c.address || '',
        serviceStatus: c.serviceStatus || 'active',
        package: c.packageSpeed || c.package || 'Standard',
        totalOutstanding,
        unpaidMonths: unpaidMonthsList.sort((a, b) => a.month.localeCompare(b.month)),
        unpaidMonthsCount: unpaidMonthsList.length,
        oldestDueDate: oldestDueDateYmd || 'N/A',
        oldestOverdueDays: maxOverdueDays,
        lastPaymentDate: latestPayment?.date || null,
        lastPaymentAmount: latestPayment?.amount ? Number(latestPayment.amount) : null,
        lastPaymentMethod: latestPayment?.method || null,
        riskCategory
      });
    }
  }

  // Sort descending by total outstanding; tie-break by oldest overdue days then customer number
  allDefaulters.sort((a, b) =>
    b.totalOutstanding - a.totalOutstanding ||
    b.oldestOverdueDays - a.oldestOverdueDays ||
    a.customerNumber - b.customerNumber
  );

  const totalDefaultersCount = allDefaulters.length;

  // Apply filters
  let filtered = allDefaulters;

  if (minOutstanding > 1) {
    filtered = filtered.filter(item => item.totalOutstanding >= minOutstanding);
  }

  if (area && area !== 'all') {
    const areaLower = area.toLowerCase().trim();
    filtered = filtered.filter(item => item.area && item.area.toLowerCase().trim() === areaLower);
  }

  if (riskLevel && riskLevel !== 'all') {
    filtered = filtered.filter(item => item.riskCategory === riskLevel);
  }

  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(item =>
      String(item.customerNumber).includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.mohalla && item.mohalla.toLowerCase().includes(q)) ||
      (item.area && item.area.toLowerCase().includes(q))
    );
  }

  // Assign rankings before slicing
  const ranked = filtered.map((item, index) => ({
    ...item,
    rank: index + 1
  }));

  // Slice to limit if specified
  const limitNum = Number(limit);
  const accounts = (limitNum && limitNum > 0) ? ranked.slice(0, limitNum) : ranked;

  // Metrics for the active set
  const topDefaultersDues = accounts.reduce((sum, item) => sum + item.totalOutstanding, 0);
  const topConcentrationPercent = totalReceivablesDues > 0
    ? Math.round((topDefaultersDues / totalReceivablesDues) * 100)
    : 0;
  const criticalDefaultersCount = accounts.filter(item => item.riskCategory === 'critical').length;
  const highDefaultersCount = accounts.filter(item => item.riskCategory === 'high').length;
  const moderateDefaultersCount = accounts.filter(item => item.riskCategory === 'moderate').length;
  const maxSingleDues = accounts.length ? accounts[0].totalOutstanding : 0;
  const averageDues = accounts.length ? Math.round(topDefaultersDues / accounts.length) : 0;

  const summaryByArea = {};
  const summaryByRisk = {
    critical: { count: criticalDefaultersCount, dues: 0 },
    high: { count: highDefaultersCount, dues: 0 },
    moderate: { count: moderateDefaultersCount, dues: 0 }
  };
  accounts.forEach(item => {
    const a = item.area || 'Shahdara';
    if (!summaryByArea[a]) summaryByArea[a] = { accounts: 0, totalDues: 0 };
    summaryByArea[a].accounts++;
    summaryByArea[a].totalDues += item.totalOutstanding;
    if (summaryByRisk[item.riskCategory]) {
      summaryByRisk[item.riskCategory].dues += item.totalOutstanding;
    }
  });

  return {
    accounts,
    summaryByArea,
    summaryByRisk,
    metrics: {
      totalReceivablesDues,
      totalDefaultersCount,
      topDefaultersCount: accounts.length,
      topDefaultersDues,
      topConcentrationPercent,
      criticalDefaultersCount,
      highDefaultersCount,
      moderateDefaultersCount,
      maxSingleDues,
      averageDues,
      limit: limitNum || totalDefaultersCount,
      areaFilter: area,
      riskFilter: riskLevel,
      searchQuery: search,
      referenceDateYmd: refYmd
    }
  };
}

/**
 * Builds high-priority bilingual Urdu & English WhatsApp payment reminder draft.
 * @param {Object} params
 * @param {Object} params.customer
 * @param {Object} params.defaulterRow
 * @param {string} [params.customNote]
 * @returns {string} Text of message
 */
export function buildDefaulterWhatsAppMessage({
  customer,
  defaulterRow,
  customNote = ''
}) {
  const monthsStr = defaulterRow.unpaidMonths.map(m => m.month).join(', ');
  const lastPayText = defaulterRow.lastPaymentDate
    ? `Last payment: PKR ${defaulterRow.lastPaymentAmount} on ${defaulterRow.lastPaymentDate}`
    : 'No recent payments on record';
  const lastPayUrdu = defaulterRow.lastPaymentDate
    ? `آخری ادائیگی: PKR ${defaulterRow.lastPaymentAmount} بروز ${defaulterRow.lastPaymentDate}`
    : 'پچھلے کسی ریکارڈ پر ادائیگی نہیں ملی';

  return [
    `*🚨 SHAH DARA BROADBAND - OVERDUE RECOVERY NOTICE / بل ادائیگی کا حتمی نوٹس*`,
    `----------------------------------------`,
    `محترم صارف: *${customer.name || defaulterRow.name}* (ID: #${customer.customerNumber || defaulterRow.customerNumber})`,
    `علاقہ / محلہ: ${customer.mohalla || customer.area || defaulterRow.area || 'Shahdara'}`,
    `پیکیج: *${customer.packageSpeed || customer.package || defaulterRow.package || 'Internet'}*`,
    ``,
    `*کل واجب الادا بقایا جات / Total Outstanding Dues:*`,
    `💰 *PKR ${defaulterRow.totalOutstanding.toLocaleString()}*`,
    ``,
    `غیر ادا شدہ مہینے / Unpaid Months: *${monthsStr}* (${defaulterRow.unpaidMonthsCount} months)`,
    `تاخیر کی مدت / Overdue Period: *${defaulterRow.oldestOverdueDays} days*`,
    `${lastPayUrdu} (${lastPayText})`,
    ``,
    `⚠️ *اہم انتباہ / Disconnection Notice:*`,
    `آپ کا کنکشن واجب الادا بل کی عدم ادائیگی کی وجہ سے معطل کیا جا سکتا ہے۔ بلاتفطل انٹرنیٹ سروس کے لیے آج ہی بقایا رقم جمع کروائیں۔`,
    `Kindly settle your outstanding balance immediately to avoid service suspension.`,
    customNote ? `\nنوٹ: ${customNote}` : '',
    ``,
    `ادائیگی کے ذرائع / Payment Options:`,
    `• JazzCash / Easypaisa: 0300-1234567 (Shahdara Broadband)`,
    `• برائے مہربانی رسید کا سکرین شاٹ اسی نمبر پر بھیجیں۔`,
    `• فیلڈ کلکٹر وزٹ پر نقد رسید حاصل کریں۔`,
    `شکریہ · شاہدرہ براڈبینڈ کسٹمر کیئر`
  ].filter(Boolean).join('\n');
}

/**
 * Renders pure vector SVG horizontal bar visualizer for top defaulters.
 * @param {Object} defaulterData - Output of calculateTopDefaulters
 * @returns {string} SVG markup string
 */
export function renderTopDefaultersSvg(defaulterData) {
  const accounts = defaulterData?.accounts ? defaulterData.accounts.slice(0, 10) : [];
  const metrics = defaulterData?.metrics || {};

  const svgWidth = 600;
  const barHeight = 22;
  const barGap = 10;
  const startY = 85;
  const labelWidth = 145;
  const maxBarWidth = 330;
  const height = Math.max(220, startY + (accounts.length * (barHeight + barGap)) + 45);

  const maxDues = accounts.length ? Math.max(...accounts.map(a => a.totalOutstanding)) : 1000;

  const barElements = accounts.map((acc, index) => {
    const y = startY + index * (barHeight + barGap);
    const width = Math.max(12, Math.round((acc.totalOutstanding / maxDues) * maxBarWidth));
    const isCritical = acc.riskCategory === 'critical';
    const isHigh = acc.riskCategory === 'high';
    const barFill = isCritical ? 'url(#defaulterCritGrad)' : isHigh ? 'url(#defaulterHighGrad)' : 'url(#defaulterModGrad)';
    const safeName = escapeXml(acc.name.length > 18 ? acc.name.slice(0, 17) + '…' : acc.name);
    const safeArea = escapeXml(acc.area || 'Shahdara');

    return `
      <g class="defaulter-svg-row" data-cust-id="${escapeXml(acc.id)}">
        <!-- Rank and Name -->
        <text x="18" y="${y + 15}" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-color, #1e293b)">
          #${acc.rank} ${safeName}
        </text>
        <text x="18" y="${y + 26}" font-family="system-ui, sans-serif" font-size="9" fill="var(--text-muted, #64748b)">
          ${safeArea} · ${acc.unpaidMonthsCount}m
        </text>

        <!-- Bar Container and Bar -->
        <rect x="${labelWidth}" y="${y}" width="${width}" height="${barHeight}" rx="4" fill="${barFill}"/>

        <!-- Amount Value Label -->
        <text x="${labelWidth + width + 8}" y="${y + 15}" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${isCritical ? '#ef4444' : isHigh ? '#f97316' : '#10b981'}">
          PKR ${acc.totalOutstanding.toLocaleString()}
        </text>
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${svgWidth} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Top Defaulters Debt Concentration Chart">
      <defs>
        <linearGradient id="defaulterCritGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#dc2626"/>
        </linearGradient>
        <linearGradient id="defaulterHighGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#f97316"/>
          <stop offset="100%" stop-color="#ea580c"/>
        </linearGradient>
        <linearGradient id="defaulterModGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
      </defs>

      <!-- Background Card -->
      <rect x="0" y="0" width="${svgWidth}" height="${height}" rx="8" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" stroke-width="1.5"/>

      <!-- Header Title -->
      <text x="20" y="28" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="var(--text-color, #1e293b)">Top Defaulters Debt Concentration</text>
      <text x="20" y="44" font-family="system-ui, sans-serif" font-size="11" fill="var(--text-muted, #64748b)">Leading outstanding subscriber accounts ranked by total cumulative overdue</text>

      <!-- Concentration Badge -->
      <rect x="${svgWidth - 170}" y="14" width="150" height="28" rx="6" fill="rgba(239, 68, 68, 0.1)"/>
      <text x="${svgWidth - 95}" y="32" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#dc2626" text-anchor="middle">
        Top Debt: ${metrics.topConcentrationPercent || 0}% of Receivables
      </text>

      <!-- Subheader divider -->
      <line x1="20" y1="58" x2="${svgWidth - 20}" y2="58" stroke="var(--border-color, #e2e8f0)" stroke-width="1"/>

      <!-- Bars -->
      ${accounts.length ? barElements : `
        <text x="${svgWidth / 2}" y="${height / 2}" font-family="system-ui, sans-serif" font-size="13" fill="var(--text-muted, #64748b)" text-anchor="middle">
          No delinquent accounts on record. All subscriber balances are fully settled!
        </text>
      `}

      <!-- Bottom telemetry banner -->
      <line x1="20" y1="${height - 35}" x2="${svgWidth - 20}" y2="${height - 35}" stroke="var(--border-color, #e2e8f0)" stroke-width="1"/>
      <text x="24" y="${height - 15}" font-family="system-ui, sans-serif" font-size="10" fill="var(--text-muted, #64748b)">
        Top Accounts Dues: <tspan font-weight="700" fill="#ef4444">PKR ${(metrics.topDefaultersDues || 0).toLocaleString()}</tspan> · Total Portfolio: <tspan font-weight="700" fill="var(--text-color, #0f172a)">PKR ${(metrics.totalReceivablesDues || 0).toLocaleString()}</tspan>
      </text>
    </svg>
  `;
}

/**
 * Generates RFC-4180 CSV content with UTF-8 BOM.
 * @param {Object} defaulterData - Output of calculateTopDefaulters
 * @returns {string} CSV string
 */
export function generateTopDefaultersCsv(defaulterData) {
  const accounts = defaulterData?.accounts || [];
  const headers = [
    'Rank',
    'Customer Number',
    'Customer Name',
    'Phone',
    'Area',
    'Mohalla',
    'Package',
    'Service Status',
    'Total Outstanding (PKR)',
    'Unpaid Months Count',
    'Unpaid Months List',
    'Oldest Due Date',
    'Days Overdue',
    'Last Payment Date',
    'Last Payment Amount (PKR)',
    'Last Payment Method',
    'Risk Level'
  ];

  const escapeCsv = val => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = accounts.map(acc => [
    acc.rank,
    acc.customerNumber,
    acc.name,
    acc.phone || 'None',
    acc.area,
    acc.mohalla || 'None',
    acc.package,
    acc.serviceStatus,
    acc.totalOutstanding,
    acc.unpaidMonthsCount,
    acc.unpaidMonths.map(m => m.month).join('; '),
    acc.oldestDueDate,
    acc.oldestOverdueDays,
    acc.lastPaymentDate || 'Never',
    acc.lastPaymentAmount !== null ? acc.lastPaymentAmount : 0,
    acc.lastPaymentMethod || 'None',
    acc.riskCategory.toUpperCase()
  ].map(escapeCsv).join(','));

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Generates printable HTML recovery report (A4 or 80mm thermal receipt slip).
 * @param {Object} params
 * @param {Object} params.defaulterData
 * @param {string} [params.format='a4'] - 'a4' or 'thermal'
 * @param {Date} [params.referenceDate=new Date()]
 * @returns {string} HTML markup string
 */
export function generateTopDefaultersPrintHtml({
  defaulterData,
  format = 'a4',
  referenceDate = new Date()
}) {
  const accounts = defaulterData?.accounts || [];
  const metrics = defaulterData?.metrics || {};
  const dateStr = formatDateYmd(referenceDate);

  if (format === 'thermal') {
    const items = accounts.map(acc => `
      <div style="border-bottom:1px dashed #444; padding:4px 0; font-size:11px;">
        <div style="display:flex; justify-content:space-between; font-weight:bold;">
          <span>#${acc.rank} ID:${acc.customerNumber} ${escapeHtml(acc.name)}</span>
          <span>PKR ${acc.totalOutstanding.toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:10px; color:#333;">
          <span>Ph: ${escapeHtml(acc.phone || 'None')}</span>
          <span>${acc.unpaidMonthsCount}m overdue (${acc.oldestOverdueDays}d)</span>
        </div>
        <div style="font-size:9px; color:#555;">
          ${escapeHtml(acc.mohalla || acc.area || 'Shahdara')}
        </div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Top Defaulters Field Slip</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: monospace; width: 80mm; margin: 0; padding: 6px; font-size: 11px; color:#000; }
          .head { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
          .kpi { display: flex; justify-content: space-between; font-weight: bold; margin: 2px 0; }
        </style>
      </head>
      <body>
        <div class="head">
          <h3 style="margin:0;">SHAHDARA BROADBAND</h3>
          <div style="font-weight:bold;">TOP DEFAULTERS COLLECTION MANIFEST</div>
          <div>Date: ${dateStr}</div>
        </div>
        <div class="kpi"><span>Top Accounts:</span><span>${accounts.length}</span></div>
        <div class="kpi"><span>Total Top Dues:</span><span>PKR ${metrics.topDefaultersDues.toLocaleString()}</span></div>
        <div class="kpi"><span>Debt Concentration:</span><span>${metrics.topConcentrationPercent}%</span></div>
        <div style="border-top:1px solid #000; margin:6px 0;"></div>
        <div>
          ${items || '<div style="text-align:center;">No defaulters on record</div>'}
        </div>
        <div style="text-align:center; margin-top:8px; font-size:9px; border-top:1px solid #000; padding-top:4px;">
          *** FIELD RECOVERY RUN SHEET ***
        </div>
      </body>
      </html>
    `;
  }

  // Formal A4 Report
  const tableRows = accounts.map(acc => {
    const riskBadge = acc.riskCategory === 'critical'
      ? '<span style="background:#f8d7da; color:#721c24; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">CRITICAL</span>'
      : acc.riskCategory === 'high'
        ? '<span style="background:#fff3cd; color:#856404; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">HIGH</span>'
        : '<span style="background:#d4edda; color:#155724; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">MODERATE</span>';

    const monthsBadges = acc.unpaidMonths.map(m =>
      `<span style="background:#e2e8f0; padding:1px 4px; border-radius:3px; font-size:9px; margin-right:2px;">${m.month}</span>`
    ).join('');

    return `
      <tr>
        <td style="text-align:center; font-weight:bold;">#${acc.rank}</td>
        <td>
          <strong>#${acc.customerNumber} ${escapeHtml(acc.name)}</strong><br>
          <small style="color:#64748b;">${escapeHtml(acc.mohalla || acc.area || 'Shahdara')}</small>
        </td>
        <td>${escapeHtml(acc.phone || '—')}</td>
        <td>${escapeHtml(acc.area)}</td>
        <td>${monthsBadges}<br><small style="color:#d9534f;">${acc.oldestOverdueDays} days overdue</small></td>
        <td><small>${acc.lastPaymentDate ? `${acc.lastPaymentDate}<br>PKR ${acc.lastPaymentAmount}` : 'Never'}</small></td>
        <td style="font-weight:bold; color:#dc2626; font-size:13px;">PKR ${acc.totalOutstanding.toLocaleString()}</td>
        <td style="text-align:center;">${riskBadge}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Top Defaulters & Receivables Recovery Ledger - A4</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 15mm; color: #1e293b; font-size: 12px; line-height: 1.4; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 14px; }
        .brand { font-size: 20px; font-weight: 800; color: #0056b3; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
        .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
        .kpi-card span { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; display: block; }
        .kpi-card strong { font-size: 16px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
        th { background: #f1f5f9; font-size: 11px; font-weight: 700; }
        .footer { margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
        .signature-block { display: flex; justify-content: space-between; margin-top: 30px; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SHAHDARA BROADBAND ISP</div>
          <div style="font-size:14px; font-weight:600; color:#334155;">Top Defaulters & High-Risk Receivables Recovery Manifest</div>
          <div style="font-size:11px; color:#64748b;">Prioritized recovery triage for field collectors & billing management</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Report Date:</strong> ${dateStr} PKT</div>
          <div><strong>Accounts Listed:</strong> ${accounts.length}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><span>Top Accounts Dues</span><strong style="color:#dc2626;">PKR ${metrics.topDefaultersDues.toLocaleString()}</strong></div>
        <div class="kpi-card"><span>Total Portfolio Debt</span><strong style="color:#0056b3;">PKR ${metrics.totalReceivablesDues.toLocaleString()}</strong></div>
        <div class="kpi-card"><span>Debt Concentration</span><strong style="color:#ea580c;">${metrics.topConcentrationPercent}%</strong></div>
        <div class="kpi-card"><span>Critical Accounts (3m+)</span><strong style="color:#dc2626;">${metrics.criticalDefaultersCount}</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Subscriber</th>
            <th>Phone</th>
            <th>Area</th>
            <th>Unpaid Months & Overdue</th>
            <th>Last Payment</th>
            <th>Total Outstanding</th>
            <th>Risk</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="8" style="text-align:center; padding:15px;">No delinquent accounts found.</td></tr>'}
        </tbody>
      </table>

      <div class="signature-block">
        <div>Prepared by: _______________________ (Billing Desk)</div>
        <div>Collector Assigned: _______________________</div>
        <div>Owner Authorization: _______________________</div>
      </div>

      <div class="footer">
        <span>Shahdara ISP Offline Billing & Business Engine · Confidential Internal Recovery Document</span>
        <span>Generated from local storage · Zero third-party cloud dependency</span>
      </div>
    </body>
    </html>
  `;
}

/**
 * Builds clipboard-ready executive summary text.
 * @param {Object} defaulterData
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} Text summary
 */
export function generateTopDefaultersBriefing(defaulterData, referenceDate = new Date()) {
  const accounts = defaulterData?.accounts || [];
  const metrics = defaulterData?.metrics || {};
  const dateStr = formatDateYmd(referenceDate);

  const lines = [
    `📊 SHAHDARA BROADBAND - TOP DEFAULTERS EXECUTIVE BRIEFING`,
    `Generated: ${dateStr} PKT`,
    `--------------------------------------------------`,
    `• Total Delinquent Accounts: ${metrics.totalDefaultersCount}`,
    `• Total Outstanding Receivables: PKR ${metrics.totalReceivablesDues.toLocaleString()}`,
    `• Top ${accounts.length} Accounts Debt Volume: PKR ${metrics.topDefaultersDues.toLocaleString()}`,
    `• Debt Concentration: ${metrics.topConcentrationPercent}% of all debt is in top ${accounts.length} accounts`,
    `• Critical Risk Accounts (3+ months): ${metrics.criticalDefaultersCount}`,
    `• Highest Single Debt: PKR ${metrics.maxSingleDues.toLocaleString()}`,
    `• Average Top Debt: PKR ${metrics.averageDues.toLocaleString()}`,
    ``,
    `TOP ${accounts.length} ACCOUNTS ROSTER:`
  ];

  accounts.forEach(acc => {
    lines.push(
      `#${acc.rank} [ID #${acc.customerNumber}] ${acc.name} (${acc.area}): PKR ${acc.totalOutstanding.toLocaleString()} - ${acc.unpaidMonthsCount} mos unpaid (Ph: ${acc.phone || 'None'})`
    );
  });

  lines.push(``);
  lines.push(`Immediate Action: Dispatch WhatsApp disconnection warnings & field recovery visits.`);
  return lines.join('\n');
}

/**
 * Controller to wire and manage the Top Defaulters modal dialog and UI actions.
 * @param {Object} state - Application state
 * @param {Object} [options]
 * @param {Function} [options.onFilterCustomer] - Callback when viewing customer profile
 * @param {Function} [options.onToast] - Toast notification function
 * @param {Object} [options.clipboard] - Optional navigator.clipboard override for testing
 * @returns {Object} Controller interface
 */
export function setupTopDefaultersModal(state, {
  onFilterCustomer = null,
  onToast = null,
  clipboard = null
} = {}) {
  if (typeof document === 'undefined') return null;

  const modal = document.getElementById('topDefaultersModal');
  if (!modal) return null;

  let activeState = state;
  const getState = () => (typeof activeState === 'function' ? activeState() : activeState);

  const openBtn = document.getElementById('dashboardOpenTopDefaultersBtn') ||
                  document.getElementById('quickActionTopDefaulters');
  const closeBtn = document.getElementById('closeTopDefaultersModalBtn');
  const closeSecondaryBtn = document.getElementById('closeTopDefaultersSecondaryBtn');

  const searchInput = document.getElementById('topDefaultersSearchInput');
  const areaSelect = document.getElementById('topDefaultersAreaSelect');
  const limitSelect = document.getElementById('topDefaultersLimitSelect');
  const riskSelect = document.getElementById('topDefaultersRiskSelect');

  const kpiTopDues = document.getElementById('topDefaultersKpiTopDues');
  const kpiConcentration = document.getElementById('topDefaultersKpiConcentration');
  const kpiTotalDebt = document.getElementById('topDefaultersKpiTotalDebt');
  const kpiCriticalCount = document.getElementById('topDefaultersKpiCriticalCount');

  const tableBody = document.getElementById('topDefaultersTableBody');
  const emptyState = document.getElementById('topDefaultersEmptyState');
  const chartContainer = document.getElementById('topDefaultersChartContainer');

  const exportCsvBtn = document.getElementById('topDefaultersExportCsvBtn');
  const printA4Btn = document.getElementById('topDefaultersPrintA4Btn');
  const printThermalBtn = document.getElementById('topDefaultersPrintThermalBtn');
  const copyBriefingBtn = document.getElementById('topDefaultersCopyBriefingBtn');

  let currentData = null;

  const getFilterOptions = () => ({
    search: searchInput ? searchInput.value : '',
    area: areaSelect ? areaSelect.value : 'all',
    limit: limitSelect ? Number(limitSelect.value) || 20 : 20,
    riskLevel: riskSelect ? riskSelect.value : 'all',
    referenceDate: new Date()
  });

  const renderContent = () => {
    const opts = getFilterOptions();
    currentData = calculateTopDefaulters(getState(), opts);
    const { accounts, metrics } = currentData;

    // Update KPI summary cards
    if (kpiTopDues) kpiTopDues.textContent = `PKR ${metrics.topDefaultersDues.toLocaleString()}`;
    if (kpiConcentration) kpiConcentration.textContent = `${metrics.topConcentrationPercent}%`;
    if (kpiTotalDebt) kpiTotalDebt.textContent = `PKR ${metrics.totalReceivablesDues.toLocaleString()}`;
    if (kpiCriticalCount) kpiCriticalCount.textContent = metrics.criticalDefaultersCount;

    // Update SVG chart
    if (chartContainer) {
      chartContainer.innerHTML = renderTopDefaultersSvg(currentData);
    }

    // Populate area options if empty
    if (areaSelect && areaSelect.options.length <= 1) {
      const areas = Array.from(new Set(
        (getState().customers || []).map(c => c.area).filter(Boolean)
      )).sort();
      areas.forEach(ar => {
        const opt = document.createElement('option');
        opt.value = ar;
        opt.textContent = ar;
        areaSelect.appendChild(opt);
      });
    }

    // Populate table rows
    if (tableBody) {
      if (!accounts.length) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        tableBody.innerHTML = accounts.map(acc => {
          const riskBadge = acc.riskCategory === 'critical'
            ? `<span class="badge badge-danger">Critical</span>`
            : acc.riskCategory === 'high'
              ? `<span class="badge badge-warning">High</span>`
              : `<span class="badge badge-info">Moderate</span>`;

          const monthsList = acc.unpaidMonths.map(m =>
            `<span class="unpaid-month-tag">${escapeHtml(m.month)}</span>`
          ).join('');

          return `
            <tr data-cust-id="${escapeHtml(acc.id)}" class="defaulter-row ${acc.riskCategory}">
              <td class="defaulter-rank-cell">#${acc.rank}</td>
              <td class="defaulter-cust-cell">
                <strong>#${acc.customerNumber}</strong> ${escapeHtml(acc.name)}
                <div class="defaulter-subtext">${escapeHtml(acc.mohalla || acc.address || 'Shahdara')}</div>
              </td>
              <td>${escapeHtml(acc.area)}</td>
              <td class="defaulter-months-cell">
                <div class="defaulter-months-tags">${monthsList}</div>
                <small class="text-danger">${acc.oldestOverdueDays}d overdue</small>
              </td>
              <td class="defaulter-lastpay-cell">
                ${acc.lastPaymentDate ? `${escapeHtml(acc.lastPaymentDate)}<br><small>PKR ${acc.lastPaymentAmount}</small>` : '<small class="text-muted">Never</small>'}
              </td>
              <td class="defaulter-dues-cell">
                <strong>PKR ${acc.totalOutstanding.toLocaleString()}</strong>
              </td>
              <td class="defaulter-risk-cell">${riskBadge}</td>
              <td class="table-actions-cell">
                <button type="button" class="btn-xs whatsapp-btn defaulter-wa-btn" data-cust-id="${escapeHtml(acc.id)}" title="Open WhatsApp reminder draft">
                  WhatsApp
                </button>
                <button type="button" class="btn-xs secondary-button defaulter-view-btn" data-cust-id="${escapeHtml(acc.id)}" title="View subscriber profile">
                  Profile
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  };

  // Event Listeners for Filters
  if (searchInput) searchInput.addEventListener('input', renderContent);
  if (areaSelect) areaSelect.addEventListener('change', renderContent);
  if (limitSelect) limitSelect.addEventListener('change', renderContent);
  if (riskSelect) riskSelect.addEventListener('change', renderContent);

  // Table action clicks (WhatsApp & View Profile)
  if (tableBody) {
    tableBody.addEventListener('click', e => {
      const waBtn = e.target.closest('.defaulter-wa-btn');
      if (waBtn) {
        const custId = waBtn.dataset.custId;
        const customer = (getState().customers || []).find(c => c.id === custId);
        const row = currentData?.accounts.find(a => a.id === custId);
        if (customer && row) {
          const msg = buildDefaulterWhatsAppMessage({ customer, defaulterRow: row });
          const phoneRes = formatWhatsAppUrl(customer.phone, msg);
          if (phoneRes.validPhone && phoneRes.url) {
            window.open(phoneRes.url, '_blank');
          } else {
            onToast?.(`Invalid or missing phone number for #${customer.customerNumber}.`);
          }
        }
        return;
      }

      const viewBtn = e.target.closest('.defaulter-view-btn');
      if (viewBtn) {
        const custId = viewBtn.dataset.custId;
        if (modal.close) modal.close();
        else modal.hidden = true;
        if (typeof onFilterCustomer === 'function') {
          onFilterCustomer(custId);
        }
      }
    });
  }

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (!currentData) currentData = calculateTopDefaulters(getState(), getFilterOptions());
      const csv = generateTopDefaultersCsv(currentData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara-top-defaulters-${formatDateYmd(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast?.('Top defaulters list exported to CSV.');
    });
  }

  // Print A4
  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      if (!currentData) currentData = calculateTopDefaulters(getState(), getFilterOptions());
      const html = generateTopDefaultersPrintHtml({ defaulterData: currentData, format: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      }
    });
  }

  // Print Thermal
  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      if (!currentData) currentData = calculateTopDefaulters(getState(), getFilterOptions());
      const html = generateTopDefaultersPrintHtml({ defaulterData: currentData, format: 'thermal' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      }
    });
  }

  // Copy Executive Briefing
  if (copyBriefingBtn) {
    copyBriefingBtn.addEventListener('click', async () => {
      if (!currentData) currentData = calculateTopDefaulters(getState(), getFilterOptions());
      const text = generateTopDefaultersBriefing(currentData, new Date());
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          onToast?.('Executive defaulters briefing copied to clipboard!');
        } catch {
          onToast?.('Failed to write to clipboard.');
        }
      }
    });
  }

  // Open & Close
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (modal.showModal) modal.showModal();
      else modal.hidden = false;
      renderContent();
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', () => { modal.close?.() || (modal.hidden = true); });
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', () => { modal.close?.() || (modal.hidden = true); });

  return {
    open: () => {
      if (modal.showModal) modal.showModal();
      else modal.hidden = false;
      renderContent();
    },
    close: () => {
      modal.close?.() || (modal.hidden = true);
    },
    refresh: renderContent,
    updateState: (newState) => {
      activeState = newState;
      renderContent();
    },
    getData: () => currentData
  };
}
