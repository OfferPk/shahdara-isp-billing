/**
 * dashboard-pnl.js
 * Income vs Expense (Profit & Loss Statement) Suite.
 *
 * Implements:
 * - 6-month and 12-month multi-period financial analysis of actual cash income vs dated expenses.
 * - Net cash profit line and profit margin % tracking over time.
 * - Expense category breakdown for the selected billing month with percentages and top categories.
 * - Pure-vector SVG dual-bar and net profit line visualization (renderPnlChartSvg).
 * - Pure-vector SVG expense category distribution chart (renderExpenseCategoryDonutSvg).
 * - RFC-4180 CSV export with UTF-8 BOM (generatePnlCsv).
 * - Dual printable formats: A4 Executive P&L Financial Statement and 80mm Thermal POS slip.
 * - Bilingual Urdu & English WhatsApp executive briefing dispatch (generatePnlBriefing).
 * - Accessible modal dialog controller (setupPnlModal) with month selector, window toggle,
 *   sortable table headers, and responsive layout.
 */

import {
  formatPKR,
  monthsForHistory
} from './core.js';
import {
  pktDate,
  pktMonth,
  addMonths,
  EXPENSE_CATEGORIES
} from './phase3.js';
import { isVoidedPayment } from './payment-void-audit.js';

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

/** Palette for expense categories */
export const PNL_CATEGORY_PALETTE = [
  '#ef4444', // Red (Nayatel / Upstream)
  '#f59e0b', // Amber (Electricity / Generator)
  '#3b82f6', // Blue (Salary Saad)
  '#8b5cf6', // Violet (Salary Umair)
  '#10b981', // Emerald (Fiber Cable)
  '#06b6d4', // Cyan (ONU)
  '#ec4899', // Pink (Routers)
  '#64748b', // Slate (Repairs)
  '#14b8a6', // Teal (OLT / Hardware)
  '#f97316', // Orange (Tools)
  '#6366f1', // Indigo (RADIUS / Server)
  '#84cc16', // Lime (Other expenses)
  '#a855f7'  // Purple (Unallocated)
];

/**
 * Calculates comprehensive Income vs Expense (P&L) analytics for a state and selected period.
 * 
 * @param {Object} state - Full application state with customers and expenses
 * @param {Object} [options={}] - Analytics parameters
 * @param {string} [options.selectedMonth] - YYYY-MM formatted month (default current PKT month)
 * @param {number} [options.windowMonths=6] - Number of months to analyze (6 or 12)
 * @param {Date} [options.referenceDate=new Date()] - Reference date for current time calculations
 * @returns {Object} Comprehensive P&L calculation results
 */
export function calculatePnlAnalytics(state = {}, {
  selectedMonth,
  windowMonths = 6,
  referenceDate = new Date()
} = {}) {
  const currentMonth = pktMonth(referenceDate);
  const activeMonth = (selectedMonth && typeof selectedMonth === 'string' && /^\d{4}-\d{2}$/.test(selectedMonth))
    ? selectedMonth
    : currentMonth;

  const validWindow = (windowMonths === 12) ? 12 : 6;

  // Build the chronological array of months ending at activeMonth
  const months = Array.from({ length: validWindow }, (_, i) => {
    return addMonths(activeMonth, i - (validWindow - 1));
  });

  // Extract all recorded cash receipts/payments.
  // FU4: SISP-34 voided payments are excluded — a voided receipt is
  // history, not income, so it never inflates profit (or the partner
  // shares derived from the same ledger).
  const payments = (state.customers || []).flatMap(customer =>
    (customer.bills || []).flatMap(bill =>
      (bill.payments || []).filter(payment => !isVoidedPayment(payment)).map(payment => ({
        customer,
        bill,
        payment
      }))
    )
  );

  // Extract all dated expense entries
  const expenses = (state.expenses || []).map(exp => ({ ...exp }));

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalIncomeTransactions = 0;
  let totalExpenseEntries = 0;
  let profitableMonthsCount = 0;
  let deficitMonthsCount = 0;

  const monthlyData = months.map(month => {
    const matchingPayments = payments.filter(p => 
      p.payment && typeof p.payment.date === 'string' && p.payment.date.slice(0, 7) === month
    );
    const matchingExpenses = expenses.filter(e => 
      typeof e.date === 'string' && e.date.slice(0, 7) === month
    );

    const income = matchingPayments.reduce((sum, p) => sum + (Number(p.payment.amount) || 0), 0);
    const expensesTotal = matchingExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netProfit = Number((income - expensesTotal).toFixed(2));

    const incomeCount = matchingPayments.length;
    const expenseCount = matchingExpenses.length;

    let profitMargin = 0;
    if (income > 0) {
      profitMargin = Number(((netProfit / income) * 100).toFixed(1));
    } else if (expensesTotal > 0) {
      profitMargin = -100.0;
    }

    const expenseRatio = income > 0 ? Number(((expensesTotal / income) * 100).toFixed(1)) : 0;

    let status = 'NO_ACTIVITY';
    if (income > 0 || expensesTotal > 0) {
      if (netProfit > 0) {
        status = 'PROFITABLE';
        profitableMonthsCount++;
      } else if (netProfit === 0) {
        status = 'BREAK_EVEN';
      } else {
        status = 'NET_DEFICIT';
        deficitMonthsCount++;
      }
    }

    totalIncome += income;
    totalExpenses += expensesTotal;
    totalIncomeTransactions += incomeCount;
    totalExpenseEntries += expenseCount;

    return {
      month,
      income: Number(income.toFixed(2)),
      expenses: Number(expensesTotal.toFixed(2)),
      netProfit,
      profitMargin,
      expenseRatio,
      incomeCount,
      expenseCount,
      isProfitable: netProfit > 0,
      status,
      isCurrent: month === activeMonth
    };
  });

  const totalNetProfit = Number((totalIncome - totalExpenses).toFixed(2));
  const cumulativeMargin = totalIncome > 0 ? Number(((totalNetProfit / totalIncome) * 100).toFixed(1)) : 0;
  const overallOer = totalIncome > 0 ? Number(((totalExpenses / totalIncome) * 100).toFixed(1)) : 0;
  const avgMonthlyIncome = Number((totalIncome / validWindow).toFixed(2));
  const avgMonthlyExpenses = Number((totalExpenses / validWindow).toFixed(2));
  const avgMonthlyProfit = Number((totalNetProfit / validWindow).toFixed(2));

  // Find best and leanest months among active months
  const activeMonthsWithData = monthlyData.filter(m => m.incomeCount > 0 || m.expenseCount > 0);
  let bestMonth = null;
  let leanestMonth = null;

  if (activeMonthsWithData.length > 0) {
    bestMonth = activeMonthsWithData.reduce((best, m) => (!best || m.netProfit > best.netProfit) ? m : best, null);
    leanestMonth = activeMonthsWithData.reduce((worst, m) => (!worst || m.netProfit < worst.netProfit) ? m : worst, null);
  }

  let healthStatus = 'NO_DATA';
  if (totalIncome > 0 || totalExpenses > 0) {
    if (cumulativeMargin >= 30) {
      healthStatus = 'HEALTHY_MARGIN';
    } else if (cumulativeMargin > 0) {
      healthStatus = 'MODERATE_MARGIN';
    } else if (cumulativeMargin === 0) {
      healthStatus = 'BREAK_EVEN';
    } else {
      healthStatus = 'CASH_DEFICIT';
    }
  }

  // Calculate expense category breakdown for the selectedMonth
  const selectedMonthExpenses = expenses.filter(e => typeof e.date === 'string' && e.date.slice(0, 7) === activeMonth);
  const selectedMonthTotalExpenses = selectedMonthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const categoryMap = new Map();
  selectedMonthExpenses.forEach(exp => {
    const categoryName = (exp.category && typeof exp.category === 'string' && exp.category.trim())
      ? exp.category.trim()
      : 'Other expenses';
    const amount = Number(exp.amount) || 0;

    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, {
        category: categoryName,
        amount: 0,
        count: 0,
        items: []
      });
    }
    const cat = categoryMap.get(categoryName);
    cat.amount += amount;
    cat.count += 1;
    cat.items.push(exp);
  });

  const categories = Array.from(categoryMap.values()).map(cat => {
    const amount = Number(cat.amount.toFixed(2));
    const share = selectedMonthTotalExpenses > 0 ? Number(((amount / selectedMonthTotalExpenses) * 100).toFixed(1)) : 0;
    const largestItem = cat.items.reduce((max, item) => (!max || (Number(item.amount) || 0) > (Number(max.amount) || 0)) ? item : max, null);

    return {
      category: cat.category,
      amount,
      share,
      count: cat.count,
      largestItem: largestItem ? {
        amount: Number(largestItem.amount) || 0,
        notes: largestItem.notes || '',
        date: largestItem.date || ''
      } : null
    };
  }).sort((a, b) => b.amount - a.amount);

  const topCategory = categories.length > 0 ? categories[0] : null;

  return {
    selectedMonth: activeMonth,
    windowMonths: validWindow,
    months,
    monthlyData,
    summary: {
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      totalNetProfit,
      cumulativeMargin,
      overallOer,
      avgMonthlyIncome,
      avgMonthlyExpenses,
      avgMonthlyProfit,
      totalIncomeTransactions,
      totalExpenseEntries,
      profitableMonthsCount,
      deficitMonthsCount,
      bestMonth: bestMonth ? { month: bestMonth.month, netProfit: bestMonth.netProfit } : null,
      leanestMonth: leanestMonth ? { month: leanestMonth.month, netProfit: leanestMonth.netProfit } : null,
      healthStatus
    },
    selectedMonthCategoryBreakdown: {
      month: activeMonth,
      totalExpenses: Number(selectedMonthTotalExpenses.toFixed(2)),
      categories,
      topCategory
    },
    hasRecords: (totalIncome > 0 || totalExpenses > 0)
  };
}

/**
 * Renders pure vector SVG dual-bar and net profit line chart.
 * 
 * @param {Object} pnlData - Result from calculatePnlAnalytics
 * @param {Object} [options={}] - Render options
 * @returns {string} SVG markup string
 */
export function renderPnlChartSvg(pnlData, {
  width = 720,
  height = 320,
  isDark = false
} = {}) {
  if (!pnlData || !pnlData.monthlyData || pnlData.monthlyData.length === 0) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" class="pnl-chart-svg" style="display:block;">
        <rect width="100%" height="100%" fill="transparent"/>
        <text x="${width / 2}" y="${height / 2}" fill="#64748b" font-size="14" font-family="sans-serif" text-anchor="middle">No financial records in selected window</text>
      </svg>
    `;
  }

  const { monthlyData } = pnlData;
  const count = monthlyData.length;

  const padLeft = 70;
  const padRight = 50;
  const padTop = 40;
  const padBottom = 50;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  // Find max value for positive bars and range for net profit
  let maxPos = 0;
  let minVal = 0; // can be negative for net profit
  monthlyData.forEach(d => {
    if (d.income > maxPos) maxPos = d.income;
    if (d.expenses > maxPos) maxPos = d.expenses;
    if (d.netProfit > maxPos) maxPos = d.netProfit;
    if (d.netProfit < minVal) minVal = d.netProfit;
  });

  if (maxPos <= 0) maxPos = 1000;
  // Add 15% headroom for aesthetic spacing and value tags
  const yMax = Math.ceil((maxPos * 1.15) / 500) * 500;
  const yMin = minVal < 0 ? Math.floor((minVal * 1.15) / 500) * 500 : 0;
  const ySpan = yMax - yMin;

  const scaleY = (val) => {
    return padTop + plotHeight - ((val - yMin) / ySpan) * plotHeight;
  };

  const zeroY = scaleY(0);

  // Colors
  const textColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const incomeColor = '#10b981'; // Emerald
  const expenseColor = '#ef4444'; // Red
  const profitLineColor = '#6366f1'; // Indigo
  const profitNodeFill = isDark ? '#1e1b4b' : '#ffffff';

  // Y-axis grid ticks (4-5 ticks)
  const tickCount = 4;
  let gridLines = '';
  for (let i = 0; i <= tickCount; i++) {
    const val = yMin + (ySpan * (i / tickCount));
    const yPos = scaleY(val);
    const formattedVal = Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${Math.round(val)}`;
    gridLines += `
      <line x1="${padLeft}" y1="${yPos.toFixed(1)}" x2="${padLeft + plotWidth}" y2="${yPos.toFixed(1)}" stroke="${gridColor}" stroke-dasharray="3,3" stroke-width="1"/>
      <text x="${padLeft - 10}" y="${(yPos + 4).toFixed(1)}" fill="${textColor}" font-size="11" font-family="sans-serif" text-anchor="end">${formattedVal}</text>
    `;
  }

  // Draw prominent zero line if yMin < 0
  let zeroLineSvg = '';
  if (yMin < 0) {
    zeroLineSvg = `
      <line x1="${padLeft}" y1="${zeroY.toFixed(1)}" x2="${padLeft + plotWidth}" y2="${zeroY.toFixed(1)}" stroke="${isDark ? '#94a3b8' : '#64748b'}" stroke-width="1.5"/>
    `;
  }

  // Column calculations
  const colWidth = plotWidth / count;
  const barWidth = Math.max(8, Math.min(22, (colWidth - 14) / 2));
  const barGap = 3;

  let barsSvg = '';
  const profitPoints = [];

  monthlyData.forEach((d, idx) => {
    const colCenterX = padLeft + (idx + 0.5) * colWidth;
    const incomeBarX = colCenterX - barWidth - (barGap / 2);
    const expenseBarX = colCenterX + (barGap / 2);

    // Income Bar (Emerald)
    const incomeY = scaleY(d.income);
    const incomeHeight = Math.max(0, zeroY - incomeY);
    barsSvg += `
      <rect class="pnl-bar pnl-income-bar" x="${incomeBarX.toFixed(1)}" y="${incomeY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${incomeHeight.toFixed(1)}" rx="3" fill="${incomeColor}" opacity="${d.isCurrent ? '1.0' : '0.85'}">
        <title>${d.month} Cash Income: PKR ${d.income.toLocaleString()}</title>
      </rect>
    `;

    // Expense Bar (Red)
    const expenseY = scaleY(d.expenses);
    const expenseHeight = Math.max(0, zeroY - expenseY);
    barsSvg += `
      <rect class="pnl-bar pnl-expense-bar" x="${expenseBarX.toFixed(1)}" y="${expenseY.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${expenseHeight.toFixed(1)}" rx="3" fill="${expenseColor}" opacity="${d.isCurrent ? '1.0' : '0.85'}">
        <title>${d.month} Recorded Expenses: PKR ${d.expenses.toLocaleString()}</title>
      </rect>
    `;

    // Month Label on X-axis
    const [yr, mo] = d.month.split('-');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const shortLabel = `${monthNames[Number(mo) - 1]} '${yr.slice(2)}`;
    barsSvg += `
      <text x="${colCenterX.toFixed(1)}" y="${(padTop + plotHeight + 20).toFixed(1)}" fill="${d.isCurrent ? (isDark ? '#38bdf8' : '#0284c7') : textColor}" font-size="11" font-weight="${d.isCurrent ? '700' : '400'}" font-family="sans-serif" text-anchor="middle">${shortLabel}</text>
    `;

    // Net profit point
    const profitY = scaleY(d.netProfit);
    profitPoints.push({ x: colCenterX, y: profitY, val: d.netProfit, month: d.month });
  });

  // Net Profit Path (connecting line)
  let lineD = '';
  profitPoints.forEach((pt, idx) => {
    if (idx === 0) {
      lineD += `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    } else {
      lineD += ` L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }
  });

  let profitLineSvg = `
    <path d="${lineD}" fill="none" stroke="${profitLineColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  `;

  // Draw markers & profit value tags
  let profitNodesSvg = '';
  profitPoints.forEach(pt => {
    const isProfit = pt.val >= 0;
    const nodeColor = isProfit ? profitLineColor : '#f97316';
    const tagText = Math.abs(pt.val) >= 1000 
      ? `${(pt.val / 1000).toFixed(1)}k` 
      : `${Math.round(pt.val)}`;

    profitNodesSvg += `
      <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4" fill="${profitNodeFill}" stroke="${nodeColor}" stroke-width="2">
        <title>${pt.month} Net Profit: PKR ${pt.val.toLocaleString()}</title>
      </circle>
      <text x="${pt.x.toFixed(1)}" y="${(pt.y - 8).toFixed(1)}" fill="${nodeColor}" font-size="10" font-weight="700" font-family="sans-serif" text-anchor="middle">${tagText}</text>
    `;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" class="pnl-chart-svg" style="display:block; overflow:visible;" role="img" aria-label="Income vs Expense P&L Chart">
      <defs>
        <filter id="pnlShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.15"/>
        </filter>
      </defs>
      <!-- Background -->
      <rect width="100%" height="100%" fill="transparent"/>
      
      <!-- Grid Lines -->
      <g class="pnl-grid">${gridLines}</g>
      
      <!-- Zero Line -->
      ${zeroLineSvg}
      
      <!-- Grouped Bars -->
      <g class="pnl-bars">${barsSvg}</g>
      
      <!-- Profit Line & Markers -->
      <g class="pnl-profit-line">${profitLineSvg}${profitNodesSvg}</g>
    </svg>
  `;
}

/**
 * Renders pure vector SVG donut chart for expense categories in the selected month.
 * 
 * @param {Object} categoryBreakdown - Breakdown object from calculatePnlAnalytics
 * @param {Object} [options={}] - Dimensions & theme
 * @returns {string} SVG markup
 */
export function renderExpenseCategoryDonutSvg(categoryBreakdown, {
  width = 300,
  height = 240,
  isDark = false
} = {}) {
  if (!categoryBreakdown || !categoryBreakdown.categories || categoryBreakdown.categories.length === 0) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" class="pnl-donut-svg" style="display:block;">
        <rect width="100%" height="100%" fill="transparent"/>
        <text x="${width / 2}" y="${height / 2}" fill="#64748b" font-size="12" font-family="sans-serif" text-anchor="middle">No expenses recorded for this month</text>
      </svg>
    `;
  }

  const { categories, totalExpenses } = categoryBreakdown;
  const centerX = width * 0.38;
  const centerY = height * 0.5;
  const outerRadius = Math.min(width, height) * 0.40;
  const innerRadius = outerRadius * 0.58;

  let currentAngle = -Math.PI / 2;
  let slicesSvg = '';

  categories.forEach((cat, index) => {
    const sliceAngle = (cat.amount / totalExpenses) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;
    const color = PNL_CATEGORY_PALETTE[index % PNL_CATEGORY_PALETTE.length];

    const x1 = centerX + outerRadius * Math.cos(currentAngle);
    const y1 = centerY + outerRadius * Math.sin(currentAngle);
    const x2 = centerX + outerRadius * Math.cos(endAngle);
    const y2 = centerY + outerRadius * Math.sin(endAngle);

    const ix1 = centerX + innerRadius * Math.cos(endAngle);
    const iy1 = centerY + innerRadius * Math.sin(endAngle);
    const ix2 = centerX + innerRadius * Math.cos(currentAngle);
    const iy2 = centerY + innerRadius * Math.sin(currentAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    const pathData = (categories.length === 1)
      ? `M ${centerX} ${centerY - outerRadius} A ${outerRadius} ${outerRadius} 0 1 0 ${centerX} ${centerY + outerRadius} A ${outerRadius} ${outerRadius} 0 1 0 ${centerX} ${centerY - outerRadius} M ${centerX} ${centerY - innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 ${centerX} ${centerY + innerRadius} A ${innerRadius} ${innerRadius} 0 1 1 ${centerX} ${centerY - innerRadius} Z`
      : `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix1.toFixed(2)} ${iy1.toFixed(2)} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)} Z`;

    slicesSvg += `
      <path d="${pathData}" fill="${color}" stroke="${isDark ? '#0f172a' : '#ffffff'}" stroke-width="1.5">
        <title>${cat.category}: PKR ${cat.amount.toLocaleString()} (${cat.share}%)</title>
      </path>
    `;

    currentAngle = endAngle;
  });

  // Center KPI text
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const centerTextSvg = `
    <text x="${centerX.toFixed(1)}" y="${(centerY - 4).toFixed(1)}" fill="${textColor}" font-size="12" font-weight="700" font-family="sans-serif" text-anchor="middle">PKR ${Math.round(totalExpenses).toLocaleString()}</text>
    <text x="${centerX.toFixed(1)}" y="${(centerY + 12).toFixed(1)}" fill="${subTextColor}" font-size="9" font-family="sans-serif" text-anchor="middle">Total Expenses</text>
  `;

  // Right-hand side legend for top 5 categories
  let legendSvg = '';
  const legendX = width * 0.72;
  const startY = 30;
  const itemHeight = 22;

  categories.slice(0, 6).forEach((cat, index) => {
    const color = PNL_CATEGORY_PALETTE[index % PNL_CATEGORY_PALETTE.length];
    const y = startY + index * itemHeight;
    const truncatedCat = cat.category.length > 15 ? cat.category.slice(0, 14) + '…' : cat.category;

    legendSvg += `
      <rect x="${legendX}" y="${y - 8}" width="10" height="10" rx="2" fill="${color}"/>
      <text x="${legendX + 16}" y="${y}" fill="${textColor}" font-size="10" font-family="sans-serif">${escapeXml(truncatedCat)}</text>
      <text x="${legendX + 16}" y="${y + 9}" fill="${subTextColor}" font-size="9" font-family="sans-serif">${cat.share}% (PKR ${cat.amount.toLocaleString()})</text>
    `;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" class="pnl-donut-svg" style="display:block; overflow:visible;" role="img" aria-label="Expense Category Distribution Donut">
      <rect width="100%" height="100%" fill="transparent"/>
      <g class="donut-slices">${slicesSvg}</g>
      <g class="donut-center-kpi">${centerTextSvg}</g>
      <g class="donut-legend">${legendSvg}</g>
    </svg>
  `;
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM.
 * 
 * @param {Object} pnlData - Result from calculatePnlAnalytics
 * @returns {string} CSV string with BOM
 */
export function generatePnlCsv(pnlData) {
  if (!pnlData) return '';
  const { selectedMonth, windowMonths, summary, monthlyData, selectedMonthCategoryBreakdown } = pnlData;

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = [];
  rows.push(['SHAHDARA ISP NETWORK - PROFIT & LOSS STATEMENT (P&L)'].map(escapeCsv).join(','));
  rows.push(['Generated Date', formatDateYmd()].map(escapeCsv).join(','));
  rows.push(['Selected Month', selectedMonth].map(escapeCsv).join(','));
  rows.push(['Window Duration', `${windowMonths} Months`].map(escapeCsv).join(','));
  rows.push([]);

  // Summary Metrics Section
  rows.push(['EXECUTIVE SUMMARY METRICS'].map(escapeCsv).join(','));
  rows.push(['Metric', 'Value'].map(escapeCsv).join(','));
  rows.push(['Total Cash Inflow (Receipts)', `PKR ${summary.totalIncome.toLocaleString()}`].map(escapeCsv).join(','));
  rows.push(['Total Cash Outflow (Expenses)', `PKR ${summary.totalExpenses.toLocaleString()}`].map(escapeCsv).join(','));
  rows.push(['Net Cash Profit / Loss', `PKR ${summary.totalNetProfit.toLocaleString()}`].map(escapeCsv).join(','));
  rows.push(['Cumulative Profit Margin', `${summary.cumulativeMargin}%`].map(escapeCsv).join(','));
  rows.push(['Operating Expense Ratio (OER)', `${summary.overallOer}%`].map(escapeCsv).join(','));
  rows.push(['Average Monthly Cash Income', `PKR ${summary.avgMonthlyIncome.toLocaleString()}`].map(escapeCsv).join(','));
  rows.push(['Average Monthly Expenses', `PKR ${summary.avgMonthlyExpenses.toLocaleString()}`].map(escapeCsv).join(','));
  rows.push(['Average Monthly Net Profit', `PKR ${summary.avgMonthlyProfit.toLocaleString()}`].map(escapeCsv).join(','));
  rows.push(['Total Payment Receipts Count', summary.totalIncomeTransactions].map(escapeCsv).join(','));
  rows.push(['Total Expense Entries Count', summary.totalExpenseEntries].map(escapeCsv).join(','));
  rows.push(['Profitable Months', summary.profitableMonthsCount].map(escapeCsv).join(','));
  rows.push(['Deficit Months', summary.deficitMonthsCount].map(escapeCsv).join(','));
  rows.push([]);

  // Monthly Breakdown Section
  rows.push(['MONTHLY FINANCIAL PERFORMANCE BREAKDOWN'].map(escapeCsv).join(','));
  rows.push([
    'Month',
    'Cash Income (PKR)',
    'Recorded Expenses (PKR)',
    'Net Cash Profit (PKR)',
    'Profit Margin %',
    'Expense Ratio %',
    'Income Receipts Count',
    'Expense Entries Count',
    'Status'
  ].map(escapeCsv).join(','));

  monthlyData.forEach(d => {
    rows.push([
      d.month,
      d.income,
      d.expenses,
      d.netProfit,
      `${d.profitMargin}%`,
      `${d.expenseRatio}%`,
      d.incomeCount,
      d.expenseCount,
      d.status
    ].map(escapeCsv).join(','));
  });

  rows.push([]);

  // Selected Month Expense Categories Section
  rows.push([`EXPENSE CATEGORIES BREAKDOWN FOR ${selectedMonth}`].map(escapeCsv).join(','));
  rows.push([
    'Category',
    'Expense Amount (PKR)',
    'Share % of Month Expenses',
    'Entries Count',
    'Largest Entry Amount (PKR)',
    'Largest Entry Notes'
  ].map(escapeCsv).join(','));

  if (selectedMonthCategoryBreakdown && selectedMonthCategoryBreakdown.categories) {
    selectedMonthCategoryBreakdown.categories.forEach(cat => {
      rows.push([
        cat.category,
        cat.amount,
        `${cat.share}%`,
        cat.count,
        cat.largestItem ? cat.largestItem.amount : 0,
        cat.largestItem ? cat.largestItem.notes : ''
      ].map(escapeCsv).join(','));
    });
  }

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Generates printable HTML for Executive A4 statement or 80mm POS slip.
 * 
 * @param {Object} pnlData - Result from calculatePnlAnalytics
 * @param {Object} [options={}] - Format options
 * @returns {string} Complete HTML string
 */
export function generatePnlPrintHtml(pnlData, {
  format = 'a4',
  companyName = 'Shahdara ISP Network'
} = {}) {
  if (!pnlData) return '<p>No data</p>';

  const { selectedMonth, windowMonths, summary, monthlyData, selectedMonthCategoryBreakdown } = pnlData;
  const isThermal = format === '80mm';

  if (isThermal) {
    // 80mm POS Thermal Slip
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>P&amp;L Financial Summary - ${selectedMonth}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; margin: 0; padding: 4px; }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          .flex-between { display: flex; justify-content: space-between; }
          .urdu { font-family: 'Nafees Nastaleeq', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', serif; direction: rtl; text-align: center; font-size: 13px; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { padding: 2px 0; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 14px;">${escapeHtml(companyName)}</div>
        <div class="center">INCOME VS EXPENSE (P&amp;L)</div>
        <div class="center">MONTH: ${selectedMonth} (${windowMonths}M WINDOW)</div>
        <div class="divider"></div>
        <div class="flex-between"><span>Generated:</span><span>${formatDateYmd()}</span></div>
        <div class="flex-between"><span>Status:</span><span class="bold">${summary.healthStatus}</span></div>
        <div class="double-divider"></div>
        <div class="bold" style="margin-bottom: 4px;">EXECUTIVE TOTALS (${windowMonths}M):</div>
        <div class="flex-between"><span>Total Inflow:</span><span class="bold">PKR ${summary.totalIncome.toLocaleString()}</span></div>
        <div class="flex-between"><span>Total Expenses:</span><span class="bold">PKR ${summary.totalExpenses.toLocaleString()}</span></div>
        <div class="flex-between"><span>Net Cash Profit:</span><span class="bold">PKR ${summary.totalNetProfit.toLocaleString()}</span></div>
        <div class="flex-between"><span>Margin:</span><span>${summary.cumulativeMargin}%</span></div>
        <div class="flex-between"><span>OER (Exp Ratio):</span><span>${summary.overallOer}%</span></div>
        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 4px;">RECENT MONTHS:</div>
        <table>
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th align="left">Month</th>
              <th align="right">Income</th>
              <th align="right">Exp</th>
              <th align="right">Net</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyData.map(d => `
              <tr>
                <td>${d.month}</td>
                <td align="right">${Math.round(d.income / 1000)}k</td>
                <td align="right">${Math.round(d.expenses / 1000)}k</td>
                <td align="right" class="bold">${Math.round(d.netProfit / 1000)}k</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 4px;">EXPENSE CATEGORIES (${selectedMonth}):</div>
        <table>
          <tbody>
            ${(selectedMonthCategoryBreakdown.categories || []).map(cat => `
              <tr>
                <td>${escapeHtml(cat.category.slice(0, 16))}</td>
                <td align="right">PKR ${cat.amount.toLocaleString()}</td>
                <td align="right">${cat.share}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="double-divider"></div>
        <div class="urdu">خالص نفع اور اخراجات کا مصدقہ ریکارڈ</div>
        <div class="center" style="font-size: 9px; margin-top: 6px;">*** END OF FINANCIAL SLIP ***</div>
      </body>
      </html>
    `;
  }

  // Standard A4 Executive Financial Statement
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Executive P&amp;L Statement - ${selectedMonth}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0e5b4d; padding-bottom: 12px; margin-bottom: 16px; }
        .company-title { font-size: 22px; font-weight: 800; color: #0e5b4d; margin: 0; }
        .statement-title { font-size: 16px; font-weight: 700; color: #334155; margin: 4px 0 0 0; }
        .urdu-title { font-family: 'Nafees Nastaleeq', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', serif; font-size: 15px; direction: rtl; color: #64748b; margin-top: 2px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; }
        .kpi-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
        .kpi-val { font-size: 18px; font-weight: 800; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .bold { font-weight: 700; }
        .section-heading { font-size: 14px; font-weight: 700; color: #0f172a; margin: 16px 0 8px 0; border-left: 4px solid #0e5b4d; padding-left: 8px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
        .sig-box { width: 200px; text-align: center; border-top: 1px solid #64748b; padding-top: 6px; font-size: 11px; color: #475569; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="company-title">${escapeHtml(companyName)}</h1>
          <div class="statement-title">Executive Profit &amp; Loss Statement (P&amp;L)</div>
          <div class="urdu-title">مالیاتی گوشوارہ آمدن و اخراجات و خالص منافع</div>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          <div><strong>Period:</strong> ${selectedMonth} (${windowMonths}-Month Window)</div>
          <div><strong>Generated:</strong> ${formatDateYmd()}</div>
          <div><strong>Ledger Ref:</strong> SHD-PNL-${selectedMonth}</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Total Cash Inflow</div>
          <div class="kpi-val" style="color: #10b981;">PKR ${summary.totalIncome.toLocaleString()}</div>
          <div style="font-size: 10px; color: #64748b;">${summary.totalIncomeTransactions} Payment receipts</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Cash Outflow</div>
          <div class="kpi-val" style="color: #ef4444;">PKR ${summary.totalExpenses.toLocaleString()}</div>
          <div style="font-size: 10px; color: #64748b;">${summary.totalExpenseEntries} Expense entries</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Net Cash Profit</div>
          <div class="kpi-val" style="color: ${summary.totalNetProfit >= 0 ? '#6366f1' : '#dc2626'};">PKR ${summary.totalNetProfit.toLocaleString()}</div>
          <div style="font-size: 10px; color: #64748b;">Profit Margin: ${summary.cumulativeMargin}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Operating Expense Ratio</div>
          <div class="kpi-val" style="color: #8b5cf6;">${summary.overallOer}%</div>
          <div style="font-size: 10px; color: #64748b;">Health: ${summary.healthStatus}</div>
        </div>
      </div>

      <div class="section-heading">Monthly Performance Trajectory (${windowMonths}-Month Comparison)</div>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th class="text-right">Cash Inflow (PKR)</th>
            <th class="text-right">Expenses (PKR)</th>
            <th class="text-right">Net Profit / Loss (PKR)</th>
            <th class="text-center">Margin %</th>
            <th class="text-center">OER %</th>
            <th class="text-center">Receipts / Entries</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyData.map(d => `
            <tr style="${d.isCurrent ? 'background: #f0fdf4; font-weight: 600;' : ''}">
              <td>${d.month} ${d.isCurrent ? '(Active)' : ''}</td>
              <td class="text-right">${d.income.toLocaleString()}</td>
              <td class="text-right">${d.expenses.toLocaleString()}</td>
              <td class="text-right bold" style="color: ${d.netProfit >= 0 ? '#059669' : '#dc2626'};">${d.netProfit >= 0 ? '+' : ''}${d.netProfit.toLocaleString()}</td>
              <td class="text-center">${d.profitMargin}%</td>
              <td class="text-center">${d.expenseRatio}%</td>
              <td class="text-center">${d.incomeCount} / ${d.expenseCount}</td>
              <td class="text-center">${d.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="section-heading">Expense Category Breakdown for ${selectedMonth} (Total: PKR ${selectedMonthCategoryBreakdown.totalExpenses.toLocaleString()})</div>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th class="text-right">Amount (PKR)</th>
            <th class="text-center">Share %</th>
            <th class="text-center">Entries</th>
            <th>Primary Expense Item / Note</th>
          </tr>
        </thead>
        <tbody>
          ${(selectedMonthCategoryBreakdown.categories || []).map(cat => `
            <tr>
              <td class="bold">${escapeHtml(cat.category)}</td>
              <td class="text-right bold">PKR ${cat.amount.toLocaleString()}</td>
              <td class="text-center">${cat.share}%</td>
              <td class="text-center">${cat.count}</td>
              <td>${cat.largestItem ? `${escapeHtml(cat.largestItem.notes || '—')} (PKR ${cat.largestItem.amount.toLocaleString()})` : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-box">Accountant / Finance Officer</div>
        <div class="sig-box">Network Operations Director</div>
        <div class="sig-box">Managing Director / Owner</div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Formats a bilingual executive summary briefing for WhatsApp / clipboard dispatch.
 * 
 * @param {Object} pnlData - Result from calculatePnlAnalytics
 * @returns {string} Plain text summary
 */
export function generatePnlBriefing(pnlData) {
  if (!pnlData) return '';
  const { selectedMonth, windowMonths, summary, selectedMonthCategoryBreakdown } = pnlData;

  const topCats = (selectedMonthCategoryBreakdown.categories || []).slice(0, 3).map(c => 
    `• ${c.category}: PKR ${c.amount.toLocaleString()} (${c.share}%)`
  ).join('\n');

  return `📊 *SHAHDARA ISP - PROFIT & LOSS STATEMENT (P&L)*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *Period:* ${selectedMonth} (${windowMonths}-Month Window)
⏰ *Generated:* ${formatDateYmd()}

📈 *EXECUTIVE TOTALS (${windowMonths}M Window):*
• Total Cash Inflow: PKR ${summary.totalIncome.toLocaleString()} (${summary.totalIncomeTransactions} receipts)
• Total Expenses: PKR ${summary.totalExpenses.toLocaleString()} (${summary.totalExpenseEntries} entries)
• Net Cash Profit: PKR ${summary.totalNetProfit.toLocaleString()}
• Profit Margin: ${summary.cumulativeMargin}%
• Operating Expense Ratio: ${summary.overallOer}%
• Health Status: ${summary.healthStatus}

🎯 *CURRENT MONTH (${selectedMonth}):*
• Monthly Inflow: PKR ${(pnlData.monthlyData.find(m => m.month === selectedMonth)?.income || 0).toLocaleString()}
• Monthly Outflow: PKR ${selectedMonthCategoryBreakdown.totalExpenses.toLocaleString()}
• Net Profit: PKR ${(pnlData.monthlyData.find(m => m.month === selectedMonth)?.netProfit || 0).toLocaleString()}

📑 *TOP EXPENSE CATEGORIES (${selectedMonth}):*
${topCats || '• No expenses recorded'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇵🇰 *خلاصہ آمدن و اخراجات:*
ماہانہ نقد وصولیوں اور اخراجات کا تفصیلی گوشوارہ۔ خالص نفع اور آپریٹنگ اخراجات کا مصدقہ ریکارڈ۔
Shahdara ISP Billing Management System`;
}

/**
 * Accessible Modal Controller for Income vs Expense P&L Dialog.
 * 
 * @param {Function} getState - Function returning latest state
 * @param {Object} [options={}] - Callbacks (onToast)
 * @returns {Object} Controller with .open() and .close() methods
 */
export function setupPnlModal(getState, { onToast = () => {} } = {}) {
  const modal = document.getElementById('pnlModal');
  if (!modal) return null;

  const monthSelect = document.getElementById('pnlMonthSelect');
  const window6Btn = document.getElementById('pnlWindow6Btn');
  const window12Btn = document.getElementById('pnlWindow12Btn');
  const chartContainer = document.getElementById('pnlChartContainer');
  const donutContainer = document.getElementById('pnlCategoryDonutContainer');
  const tableBody = document.getElementById('pnlTableBody');
  const categoriesList = document.getElementById('pnlCategoriesList');
  const emptyState = document.getElementById('pnlEmptyState');

  // KPI elements
  const kpiIncome = document.getElementById('pnlKpiIncome');
  const kpiExpenses = document.getElementById('pnlKpiExpenses');
  const kpiProfit = document.getElementById('pnlKpiProfit');
  const kpiMargin = document.getElementById('pnlKpiMargin');
  const kpiOer = document.getElementById('pnlKpiOer');

  // Action buttons
  const exportCsvBtn = document.getElementById('pnlExportCsvBtn');
  const printA4Btn = document.getElementById('pnlPrintA4Btn');
  const printThermalBtn = document.getElementById('pnlPrintThermalBtn');
  const copyBriefingBtn = document.getElementById('pnlCopyBriefingBtn');
  const closeBtn = document.getElementById('closePnlModalBtn');
  const closeSecondaryBtn = document.getElementById('closePnlSecondaryBtn');

  let currentWindow = 6;
  let currentMonth = pktMonth(new Date());
  let currentSortCol = 'month';
  let currentSortAsc = true;

  function populateMonths(state) {
    if (!monthSelect) return;
    const months = monthsForHistory(new Date());
    monthSelect.innerHTML = '';
    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === currentMonth) opt.selected = true;
      monthSelect.appendChild(opt);
    });
  }

  function render() {
    const state = getState();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const pnlData = calculatePnlAnalytics(state, {
      selectedMonth: currentMonth,
      windowMonths: currentWindow,
      referenceDate: new Date()
    });

    // Update KPIs
    if (kpiIncome) kpiIncome.textContent = `PKR ${pnlData.summary.totalIncome.toLocaleString()}`;
    if (kpiExpenses) kpiExpenses.textContent = `PKR ${pnlData.summary.totalExpenses.toLocaleString()}`;
    if (kpiProfit) {
      kpiProfit.textContent = `PKR ${pnlData.summary.totalNetProfit.toLocaleString()}`;
      kpiProfit.style.color = pnlData.summary.totalNetProfit >= 0 ? '#10b981' : '#ef4444';
    }
    if (kpiMargin) kpiMargin.textContent = `${pnlData.summary.cumulativeMargin}%`;
    if (kpiOer) kpiOer.textContent = `${pnlData.summary.overallOer}%`;

    // Render SVG Charts
    if (chartContainer) {
      chartContainer.innerHTML = renderPnlChartSvg(pnlData, {
        width: chartContainer.clientWidth || 700,
        height: 280,
        isDark
      });
    }

    if (donutContainer) {
      donutContainer.innerHTML = renderExpenseCategoryDonutSvg(pnlData.selectedMonthCategoryBreakdown, {
        width: donutContainer.clientWidth || 320,
        height: 220,
        isDark
      });
    }

    // Render Category Breakdown List/Table
    if (categoriesList) {
      const cats = pnlData.selectedMonthCategoryBreakdown.categories || [];
      if (cats.length === 0) {
        categoriesList.innerHTML = '<p class="empty-state" style="padding: 12px; font-size: 11px;">No recorded expenses in this month.</p>';
      } else {
        categoriesList.innerHTML = cats.map((cat, idx) => {
          const color = PNL_CATEGORY_PALETTE[idx % PNL_CATEGORY_PALETTE.length];
          return `
            <div class="pnl-cat-item" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-color, #e2e8f0); font-size: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${color};"></span>
                <span>${escapeHtml(cat.category)}</span>
                <span style="font-size: 10px; color: var(--text-muted, #64748b);">(${cat.count} ${cat.count === 1 ? 'entry' : 'entries'})</span>
              </div>
              <div style="text-align: right;">
                <strong>PKR ${cat.amount.toLocaleString()}</strong>
                <span style="font-size: 11px; color: var(--text-muted, #64748b); margin-left: 6px;">${cat.share}%</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render Monthly Table
    if (tableBody) {
      let rows = [...pnlData.monthlyData];
      rows.sort((a, b) => {
        let valA = a[currentSortCol];
        let valB = b[currentSortCol];
        if (typeof valA === 'string') {
          return currentSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return currentSortAsc ? (valA - valB) : (valB - valA);
      });

      if (rows.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        tableBody.innerHTML = rows.map(d => {
          const statusBadge = d.status === 'PROFITABLE'
            ? '<span class="status-badge" style="background: rgba(16,185,129,0.15); color: #059669; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px;">Profitable</span>'
            : d.status === 'NET_DEFICIT'
              ? '<span class="status-badge" style="background: rgba(239,68,68,0.15); color: #dc2626; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px;">Deficit</span>'
              : '<span class="status-badge" style="background: rgba(100,116,139,0.15); color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px;">No Activity</span>';

          return `
            <tr style="${d.isCurrent ? 'background: rgba(14,91,77,0.06); font-weight: 600;' : ''}">
              <td>${d.month} ${d.isCurrent ? '<span style="font-size: 10px; color: var(--accent, #0e5b4d); font-weight: 700;">(Selected)</span>' : ''}</td>
              <td style="text-align: right; color: #10b981;">PKR ${d.income.toLocaleString()}</td>
              <td style="text-align: right; color: #ef4444;">PKR ${d.expenses.toLocaleString()}</td>
              <td style="text-align: right; font-weight: 700; color: ${d.netProfit >= 0 ? '#10b981' : '#ef4444'};">${d.netProfit >= 0 ? '+' : ''}PKR ${d.netProfit.toLocaleString()}</td>
              <td style="text-align: center;">${d.profitMargin}%</td>
              <td style="text-align: center;">${d.expenseRatio}%</td>
              <td style="text-align: center;">${d.incomeCount} / ${d.expenseCount}</td>
              <td style="text-align: center;">${statusBadge}</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  // Event Listeners
  if (monthSelect) {
    monthSelect.addEventListener('change', (e) => {
      currentMonth = e.target.value;
      render();
    });
  }

  if (window6Btn) {
    window6Btn.addEventListener('click', () => {
      currentWindow = 6;
      window6Btn.classList.add('active');
      if (window12Btn) window12Btn.classList.remove('active');
      render();
    });
  }

  if (window12Btn) {
    window12Btn.addEventListener('click', () => {
      currentWindow = 12;
      window12Btn.classList.add('active');
      if (window6Btn) window6Btn.classList.remove('active');
      render();
    });
  }

  // Table header sort
  const sortHeaders = modal.querySelectorAll('th[data-sort-pnl]');
  sortHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort-pnl');
      if (currentSortCol === col) {
        currentSortAsc = !currentSortAsc;
      } else {
        currentSortCol = col;
        currentSortAsc = true;
      }
      render();
    });
  });

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const state = getState();
      const pnlData = calculatePnlAnalytics(state, {
        selectedMonth: currentMonth,
        windowMonths: currentWindow,
        referenceDate: new Date()
      });
      const csv = generatePnlCsv(pnlData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `shahdara-pnl-statement-${currentMonth}-${currentWindow}M.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast('P&L Statement CSV downloaded successfully.');
    });
  }

  // Copy Briefing
  if (copyBriefingBtn) {
    copyBriefingBtn.addEventListener('click', async () => {
      const state = getState();
      const pnlData = calculatePnlAnalytics(state, {
        selectedMonth: currentMonth,
        windowMonths: currentWindow,
        referenceDate: new Date()
      });
      const briefing = generatePnlBriefing(pnlData);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(briefing);
          onToast('P&L executive briefing copied to clipboard!');
        } else {
          onToast('Clipboard not supported in this browser environment.');
        }
      } catch (err) {
        onToast('Failed to copy to clipboard.');
      }
    });
  }

  // Print A4
  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const state = getState();
      const pnlData = calculatePnlAnalytics(state, {
        selectedMonth: currentMonth,
        windowMonths: currentWindow,
        referenceDate: new Date()
      });
      const html = generatePnlPrintHtml(pnlData, { format: 'a4' });
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      }
    });
  }

  // Print 80mm
  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const state = getState();
      const pnlData = calculatePnlAnalytics(state, {
        selectedMonth: currentMonth,
        windowMonths: currentWindow,
        referenceDate: new Date()
      });
      const html = generatePnlPrintHtml(pnlData, { format: '80mm' });
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      }
    });
  }

  function open(month) {
    const state = getState();
    populateMonths(state);
    if (month && typeof month === 'string') {
      currentMonth = month;
      if (monthSelect) monthSelect.value = month;
    }
    render();
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function close() {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  if (closeBtn) closeBtn.addEventListener('click', close);
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', close);

  // Backdrop click dismissal
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  const openTriggers = [
    document.getElementById('quickActionPnl'),
    document.getElementById('openPnlModalBtn')
  ].filter(Boolean);

  openTriggers.forEach(btn => {
    btn.addEventListener('click', () => open());
  });

  return {
    open,
    close,
    render,
    calculate: (month, win) => calculatePnlAnalytics(getState(), { selectedMonth: month || currentMonth, windowMonths: win || currentWindow })
  };
}
