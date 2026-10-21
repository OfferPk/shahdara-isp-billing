/**
 * dashboard-staff-performance.js
 * Comprehensive Collector & Staff Collection Performance, Channel Attribution & Ticket Analysis Suite.
 *
 * Implements:
 * - calculateStaffPerformance: aggregates collections per collector/staff member, payment methods,
 *   customers collected, transaction count, average ticket size, cash vs digital split,
 *   primary collection areas, peak collection days, and performance tier classification.
 * - resolveCollectorIdentity: extracts collector/staff member from payment details (paidBy attribute,
 *   shop attribution 'Cash at Waseem Abbasi shop', 'Cash at Hassan shop', Counter till, or digital gateway).
 * - filterStaffCollectors: filters collectors by search term (name, area) and channel (all, cash, digital).
 * - sortStaffCollectors: sortable by collections, receipts, customers, avg ticket, cash, digital, or collector name.
 * - renderStaffPerformanceSvg: pure-vector responsive SVG visualizer (horizontal bar chart with KPI HUD and badges).
 * - generateStaffPerformanceCsv: RFC-4180 compliant CSV export with UTF-8 BOM.
 * - generateStaffPerformancePrintHtml: dual printable layouts (A4 Executive Review Statement & 80mm POS Thermal Slip).
 * - generateStaffPerformanceBriefing: bilingual Urdu & English WhatsApp executive summary briefing dispatch.
 * - setupStaffPerformanceModal: accessible interactive modal dialog controller with month picker, search filter,
 *   sorting, receipts drill-down roster, and export actions.
 */

import {
  formatPKR
} from './core.js';
import {
  pktMonth
} from './phase3.js';

export function monthName(month) {
  if (!month) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${month}-01T00:00:00Z`));
  } catch {
    return String(month);
  }
}


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
 * Formats a Date object as YYYY-MM-DD in Pakistan Standard Time (Asia/Karachi).
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
 * Checks whether a given payment method string is physical cash.
 * @param {string} method
 * @returns {boolean}
 */
export function isPhysicalCashMethod(method) {
  if (!method) return true;
  const m = String(method).trim().toLowerCase();
  if (
    m.includes('jazzcash') ||
    m.includes('easypaisa') ||
    m.includes('bank transfer') ||
    m.includes('online') ||
    m.includes('portal')
  ) {
    return false;
  }
  return m.includes('cash') || m === '';
}

/**
 * Performance tier standards for staff collectors.
 */
export const STAFF_PERFORMANCE_CONSTANTS = Object.freeze({
  TIERS: {
    STAR: { minPct: 35, label: 'Star Collector', badgeClass: 'badge-star', color: '#0e5b4d' },
    HIGH: { minPct: 20, label: 'High Performer', badgeClass: 'badge-high', color: '#0284c7' },
    STEADY: { minPct: 10, label: 'Steady Collector', badgeClass: 'badge-steady', color: '#16a34a' },
    DEVELOPING: { minPct: 0, label: 'Developing / Entry', badgeClass: 'badge-developing', color: '#64748b' }
  },
  CATEGORIES: {
    FIELD: 'Field Collector',
    SHOP: 'Shop Register',
    COUNTER: 'Counter Till',
    DIGITAL: 'Digital Gateway'
  }
});

/**
 * Resolves collector name from payment details.
 * @param {string} method
 * @param {string} [paidBy='']
 * @returns {string}
 */
export function resolveCollectorName(method, paidBy = '') {
  if (paidBy && String(paidBy).trim()) {
    return String(paidBy).trim();
  }
  const m = String(method || '').toLowerCase();
  if (m.includes('waseem')) return 'Waseem Abbasi';
  if (m.includes('hassan')) return 'Hassan';
  if (isPhysicalCashMethod(method)) return 'Direct / Counter Till';
  return 'Online / Digital Settlement';
}

/**
 * Categorizes collector role / channel type.
 * @param {string} collectorName
 * @param {string} method
 * @returns {string}
 */
export function resolveCollectorCategory(collectorName, method) {
  const name = String(collectorName || '').toLowerCase();
  const m = String(method || '').toLowerCase();

  if (name.includes('waseem') || name.includes('hassan') || m.includes('waseem') || m.includes('hassan')) {
    return STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.SHOP;
  }
  if (name === 'direct / counter till' || (isPhysicalCashMethod(method) && !name)) {
    return STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.COUNTER;
  }
  if (name === 'online / digital settlement' || !isPhysicalCashMethod(method)) {
    return STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.DIGITAL;
  }
  return STAFF_PERFORMANCE_CONSTANTS.CATEGORIES.FIELD;
}

/**
 * Assigns performance tier based on share of total portfolio collections.
 * @param {number} sharePct
 * @returns {Object} Tier definition
 */
export function resolveCollectorTier(sharePct) {
  const { STAR, HIGH, STEADY, DEVELOPING } = STAFF_PERFORMANCE_CONSTANTS.TIERS;
  if (sharePct >= STAR.minPct) return STAR;
  if (sharePct >= HIGH.minPct) return HIGH;
  if (sharePct >= STEADY.minPct) return STEADY;
  return DEVELOPING;
}

/**
 * Calculates staff and collector collections performance metrics.
 *
 * @param {Object} state - Full application state
 * @param {Object} [options={}] - Query options
 * @param {string} [options.selectedMonth] - YYYY-MM month or 'all'
 * @param {string} [options.selectedDay] - Optional YYYY-MM-DD day filter
 * @param {string} [options.channelFilter='all'] - 'all' | 'cash' | 'digital'
 * @param {string} [options.collectorSearch=''] - Search term
 * @param {string} [options.sortBy='collections'] - Sort criteria
 * @param {string} [options.sortOrder='desc'] - 'desc' | 'asc'
 * @param {Date} [options.referenceDate=new Date()] - Reference date
 * @returns {Object} Comprehensive staff performance analytics
 */
export function calculateStaffPerformance(state = {}, {
  selectedMonth,
  selectedDay,
  channelFilter = 'all',
  collectorSearch = '',
  sortBy = 'collections',
  sortOrder = 'desc',
  referenceDate = new Date()
} = {}) {
  const currentMonth = pktMonth(referenceDate);
  const customers = Array.isArray(state.customers) ? state.customers : [];

  // Extract all historical months available in recorded receipts
  const availableMonthsSet = new Set();
  for (const customer of customers) {
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const p of payments) {
        if (p.date && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
          availableMonthsSet.add(p.date.slice(0, 7));
        } else if (bill.month && typeof bill.month === 'string') {
          availableMonthsSet.add(bill.month);
        }
      }
    }
  }

  const availableMonths = Array.from(availableMonthsSet).sort().reverse();
  if (!availableMonths.includes(currentMonth)) {
    availableMonths.unshift(currentMonth);
  }

  const activeMonth = (selectedMonth && (selectedMonth === 'all' || /^\d{4}-\d{2}$/.test(selectedMonth)))
    ? selectedMonth
    : (availableMonths[0] || currentMonth);

  const activeDay = (selectedDay && typeof selectedDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(selectedDay))
    ? selectedDay
    : null;

  // Process all matching payments
  let totalCollectedCents = 0;
  let totalReceipts = 0;
  let cashCollectedCents = 0;
  let digitalCollectedCents = 0;
  const uniqueCustomersSet = new Set();

  /** @type {Map<string, {
   *   collectorName: string,
   *   category: string,
   *   totalCents: number,
   *   receiptsCount: number,
   *   customerIds: Set<string>,
   *   cashCents: number,
   *   digitalCents: number,
   *   areaMap: Map<string, { count: number, cents: number }>,
   *   dailyMap: Map<string, { count: number, cents: number }>,
   *   receipts: Array<Object>
   * }>} */
  const collectorMap = new Map();

  for (const customer of customers) {
    if (customer.archived) continue;
    const customerId = customer.id || '';
    const customerName = customer.name || 'Unnamed Customer';
    const customerNumber = customer.customerNumber || '';
    const customerArea = customer.mohalla || customer.area || 'Shahdara Central';

    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const p of payments) {
        const pDate = p.date || '';
        const pMonth = pDate.slice(0, 7) || bill.month;

        // Apply month and optional day filters
        if (activeMonth !== 'all' && pMonth !== activeMonth) continue;
        if (activeDay && pDate !== activeDay) continue;

        const amt = Number(p.amount) || 0;
        if (amt <= 0) continue;
        const amtCents = Math.round(amt * 100);

        const isCash = isPhysicalCashMethod(p.method);

        // Apply channel filter
        if (channelFilter === 'cash' && !isCash) continue;
        if (channelFilter === 'digital' && isCash) continue;

        totalCollectedCents += amtCents;
        totalReceipts += 1;
        uniqueCustomersSet.add(customerId);

        if (isCash) {
          cashCollectedCents += amtCents;
        } else {
          digitalCollectedCents += amtCents;
        }

        const collectorName = resolveCollectorName(p.method, p.paidBy);
        const category = resolveCollectorCategory(collectorName, p.method);

        if (!collectorMap.has(collectorName)) {
          collectorMap.set(collectorName, {
            collectorName,
            category,
            totalCents: 0,
            receiptsCount: 0,
            customerIds: new Set(),
            cashCents: 0,
            digitalCents: 0,
            areaMap: new Map(),
            dailyMap: new Map(),
            receipts: []
          });
        }

        const cData = collectorMap.get(collectorName);
        cData.totalCents += amtCents;
        cData.receiptsCount += 1;
        cData.customerIds.add(customerId);

        if (isCash) {
          cData.cashCents += amtCents;
        } else {
          cData.digitalCents += amtCents;
        }

        // Track area distribution
        if (!cData.areaMap.has(customerArea)) {
          cData.areaMap.set(customerArea, { count: 0, cents: 0 });
        }
        const aData = cData.areaMap.get(customerArea);
        aData.count += 1;
        aData.cents += amtCents;

        // Track daily collection velocity
        if (pDate) {
          if (!cData.dailyMap.has(pDate)) {
            cData.dailyMap.set(pDate, { count: 0, cents: 0 });
          }
          const dData = cData.dailyMap.get(pDate);
          dData.count += 1;
          dData.cents += amtCents;
        }

        // Store individual receipt for detailed drilldown
        cData.receipts.push({
          id: p.id || `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: pDate,
          customerId,
          customerName,
          customerNumber,
          area: customerArea,
          amount: amt,
          amountCents: amtCents,
          method: p.method || 'Cash',
          paidBy: p.paidBy || '',
          discount: Number(p.discount) || 0,
          discountReason: p.discountReason || ''
        });
      }
    }
  }

  const totalCollected = Math.round(totalCollectedCents / 100);
  const cashTotal = Math.round(cashCollectedCents / 100);
  const digitalTotal = Math.round(digitalCollectedCents / 100);
  const overallAverageTicket = totalReceipts > 0 ? Math.round(totalCollected / totalReceipts) : 0;
  const cashRatioPct = totalCollected > 0 ? Math.round((cashTotal / totalCollected) * 100) : 0;
  const digitalRatioPct = totalCollected > 0 ? Math.round((digitalTotal / totalCollected) * 100) : 0;

  // Build structured collector records
  const collectors = Array.from(collectorMap.values()).map(cData => {
    const totalColl = Math.round(cData.totalCents / 100);
    const cashAmt = Math.round(cData.cashCents / 100);
    const digitalAmt = Math.round(cData.digitalCents / 100);
    const avgTicket = cData.receiptsCount > 0 ? Math.round(totalColl / cData.receiptsCount) : 0;
    const portfolioSharePct = totalCollected > 0 ? Number(((totalColl / totalCollected) * 100).toFixed(1)) : 0;
    const cashSharePct = totalColl > 0 ? Math.round((cashAmt / totalColl) * 100) : 0;
    const digitalSharePct = totalColl > 0 ? Math.round((digitalAmt / totalColl) * 100) : 0;

    // Identify top area
    let topArea = 'None';
    let maxAreaCents = -1;
    const areasCovered = [];
    for (const [areaName, aStats] of cData.areaMap.entries()) {
      areasCovered.push({
        area: areaName,
        count: aStats.count,
        amount: Math.round(aStats.cents / 100)
      });
      if (aStats.cents > maxAreaCents) {
        maxAreaCents = aStats.cents;
        topArea = areaName;
      }
    }
    areasCovered.sort((a, b) => b.amount - a.amount);

    // Identify busiest date
    let busiestDate = 'None';
    let maxDailyCents = -1;
    for (const [dateStr, dStats] of cData.dailyMap.entries()) {
      if (dStats.cents > maxDailyCents) {
        maxDailyCents = dStats.cents;
        busiestDate = dateStr;
      }
    }

    // Sort receipts date descending
    cData.receipts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const tier = resolveCollectorTier(portfolioSharePct);

    return {
      collectorName: cData.collectorName,
      category: cData.category,
      totalCollected: totalColl,
      totalCollectedCents: cData.totalCents,
      receiptsCount: cData.receiptsCount,
      uniqueCustomersCount: cData.customerIds.size,
      averageTicket: avgTicket,
      cashAmount: cashAmt,
      digitalAmount: digitalAmt,
      cashSharePct,
      digitalSharePct,
      portfolioSharePct,
      topArea,
      areasCovered,
      busiestDate,
      tier,
      receipts: cData.receipts
    };
  });

  // Filter and sort collectors
  const filteredCollectors = filterStaffCollectors(collectors, collectorSearch, channelFilter);
  const sortedCollectors = sortStaffCollectors(filteredCollectors, sortBy, sortOrder);

  // Determine top performers
  const sortedByVolume = [...collectors].sort((a, b) => b.totalCollected - a.totalCollected);
  const topCollector = sortedByVolume[0] || null;

  const sortedByTicket = [...collectors].sort((a, b) => b.averageTicket - a.averageTicket);
  const highestTicketCollector = sortedByTicket[0] || null;

  let selectedMonthLabel = 'All Historical Periods';
  if (activeMonth !== 'all') {
    selectedMonthLabel = monthName(activeMonth);
  }

  return {
    selectedMonth: activeMonth,
    selectedMonthLabel,
    selectedDay: activeDay,
    channelFilter,
    availableMonths,
    totalCollected,
    totalCollectedCents,
    totalReceipts,
    uniqueCustomers: uniqueCustomersSet.size,
    overallAverageTicket,
    activeCollectorsCount: collectors.length,
    cashTotal,
    digitalTotal,
    cashRatioPct,
    digitalRatioPct,
    topCollector,
    highestTicketCollector,
    collectors: sortedCollectors,
    allCollectorsUnfiltered: collectors
  };
}

/**
 * Filters collector list by search query and channel.
 *
 * @param {Array<Object>} collectors
 * @param {string} [searchQuery='']
 * @param {string} [channel='all']
 * @returns {Array<Object>}
 */
export function filterStaffCollectors(collectors = [], searchQuery = '', channel = 'all') {
  let list = Array.isArray(collectors) ? [...collectors] : [];
  const q = String(searchQuery || '').trim().toLowerCase();

  if (q) {
    list = list.filter(c => {
      const name = (c.collectorName || '').toLowerCase();
      const area = (c.topArea || '').toLowerCase();
      const cat = (c.category || '').toLowerCase();
      return name.includes(q) || area.includes(q) || cat.includes(q);
    });
  }

  if (channel === 'cash') {
    list = list.filter(c => c.cashAmount > 0);
  } else if (channel === 'digital') {
    list = list.filter(c => c.digitalAmount > 0);
  }

  return list;
}

/**
 * Sorts collector records by designated column and order.
 *
 * @param {Array<Object>} collectors
 * @param {string} [sortBy='collections']
 * @param {string} [sortOrder='desc']
 * @returns {Array<Object>}
 */
export function sortStaffCollectors(collectors = [], sortBy = 'collections', sortOrder = 'desc') {
  const list = Array.isArray(collectors) ? [...collectors] : [];
  const isDesc = sortOrder !== 'asc';

  list.sort((a, b) => {
    let comp = 0;
    switch (sortBy) {
      case 'collector':
        comp = (a.collectorName || '').localeCompare(b.collectorName || '');
        break;
      case 'receipts':
        comp = a.receiptsCount - b.receiptsCount;
        break;
      case 'customers':
        comp = a.uniqueCustomersCount - b.uniqueCustomersCount;
        break;
      case 'avgTicket':
        comp = a.averageTicket - b.averageTicket;
        break;
      case 'cash':
        comp = a.cashAmount - b.cashAmount;
        break;
      case 'digital':
        comp = a.digitalAmount - b.digitalAmount;
        break;
      case 'collections':
      default:
        comp = a.totalCollected - b.totalCollected;
        break;
    }
    return isDesc ? -comp : comp;
  });

  return list;
}

/**
 * Renders pure-vector SVG horizontal bar chart depicting staff performance.
 *
 * @param {Object} data - Output of calculateStaffPerformance
 * @param {Object} [options={}] - Render options
 * @returns {string} Pure vector SVG markup
 */
export function renderStaffPerformanceSvg(data = {}, options = {}) {
  const collectors = Array.isArray(data.collectors) ? data.collectors : [];
  const totalColl = data.totalCollected || 0;
  const width = 800;

  if (collectors.length === 0) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 240" width="100%" height="240" class="staff-perf-svg" role="img" aria-label="No staff collections recorded">
        <rect width="800" height="240" fill="var(--chart-bg, rgba(248, 250, 252, 0.6))" rx="8" />
        <circle cx="400" cy="100" r="32" fill="#cbd5e1" opacity="0.4" />
        <path d="M388 95 L400 107 L412 95" stroke="#64748b" stroke-width="3" stroke-linecap="round" fill="none" />
        <text x="400" y="160" text-anchor="middle" fill="#64748b" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600">No collector payments recorded in this period</text>
        <text x="400" y="185" text-anchor="middle" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="12">Record customer payments with 'Paid by' or shop method to populate telemetry.</text>
      </svg>
    `.trim();
  }

  const topCollectors = collectors.slice(0, 8);
  const maxVolume = Math.max(...topCollectors.map(c => c.totalCollected), 1);
  const rowHeight = 44;
  const startY = 85;
  const height = startY + (topCollectors.length * rowHeight) + 35;
  const barStartX = 230;
  const barMaxWidth = 420;

  let barsSvg = '';
  topCollectors.forEach((c, idx) => {
    const y = startY + (idx * rowHeight);
    const barWidth = Math.max(Math.round((c.totalCollected / maxVolume) * barMaxWidth), 6);
    const rank = idx + 1;
    const isStar = rank === 1;
    const barFill = isStar ? 'url(#staffStarGrad)' : (c.cashSharePct > 70 ? 'url(#staffCashGrad)' : 'url(#staffMixGrad)');

    barsSvg += `
      <g class="staff-perf-row" data-collector="${escapeXml(c.collectorName)}">
        <!-- Rank pill -->
        <rect x="24" y="${y + 6}" width="22" height="22" rx="4" fill="${isStar ? '#f59e0b' : 'rgba(100, 116, 139, 0.15)'}" />
        <text x="35" y="${y + 21}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="${isStar ? '#ffffff' : 'var(--text-muted, #64748b)'}">${rank}</text>

        <!-- Collector Name & Category -->
        <text x="56" y="${y + 18}" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="var(--text-primary, #0f172a)">${escapeXml(c.collectorName.length > 20 ? c.collectorName.slice(0, 19) + '…' : c.collectorName)}</text>
        <text x="56" y="${y + 32}" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--text-muted, #64748b)">${escapeXml(c.category)} · ${c.receiptsCount} rcpts</text>

        <!-- Background Track -->
        <rect x="${barStartX}" y="${y + 10}" width="${barMaxWidth}" height="18" rx="4" fill="rgba(203, 213, 225, 0.25)" />

        <!-- Actual Bar -->
        <rect x="${barStartX}" y="${y + 10}" width="${barWidth}" height="18" rx="4" fill="${barFill}" />

        <!-- Value Label -->
        <text x="${barStartX + barWidth + 10}" y="${y + 24}" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="var(--text-primary, #0f172a)">${formatPKR(c.totalCollected)}</text>
        <text x="${barStartX + barWidth + 85}" y="${y + 24}" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="var(--text-muted, #64748b)">(${c.portfolioSharePct}%)</text>
      </g>
    `;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" class="staff-perf-svg" role="img" aria-label="Collector and Staff Collections Performance Chart">
      <defs>
        <linearGradient id="staffStarGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0e5b4d" />
          <stop offset="100%" stop-color="#10b981" />
        </linearGradient>
        <linearGradient id="staffCashGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#38bdf8" />
        </linearGradient>
        <linearGradient id="staffMixGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#6366f1" />
          <stop offset="100%" stop-color="#a855f7" />
        </linearGradient>
      </defs>

      <!-- Panel Background -->
      <rect width="${width}" height="${height}" fill="var(--chart-bg, rgba(248, 250, 252, 0.6))" rx="10" />

      <!-- Top Telemetry Banner -->
      <rect x="20" y="16" width="${width - 40}" height="48" rx="6" fill="rgba(14, 91, 77, 0.08)" />
      <g transform="translate(36, 45)">
        <text font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#0e5b4d" letter-spacing="0.05em">TOTAL RECOVERY</text>
        <text x="120" font-family="system-ui, sans-serif" font-size="15" font-weight="800" fill="var(--text-primary, #0f172a)">${formatPKR(totalColl)}</text>

        <text x="270" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#0e5b4d" letter-spacing="0.05em">ACTIVE CREW</text>
        <text x="365" font-family="system-ui, sans-serif" font-size="15" font-weight="800" fill="var(--text-primary, #0f172a)">${data.activeCollectorsCount || 0}</text>

        <text x="440" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#0e5b4d" letter-spacing="0.05em">AVG TICKET</text>
        <text x="525" font-family="system-ui, sans-serif" font-size="15" font-weight="800" fill="var(--text-primary, #0f172a)">${formatPKR(data.overallAverageTicket || 0)}</text>

        <text x="615" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#0e5b4d" letter-spacing="0.05em">CASH SPLIT</text>
        <text x="695" font-family="system-ui, sans-serif" font-size="15" font-weight="800" fill="var(--text-primary, #0f172a)">${data.cashRatioPct || 0}%</text>
      </g>

      <!-- Collector Rows -->
      ${barsSvg}
    </svg>
  `.trim();
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM.
 *
 * @param {Object} data - Output of calculateStaffPerformance
 * @returns {string} CSV text
 */
export function generateStaffPerformanceCsv(data = {}) {
  const collectors = Array.isArray(data.collectors) ? data.collectors : [];
  const lines = [];

  // UTF-8 BOM for Microsoft Excel compatibility
  const BOM = '\uFEFF';

  // Header row
  lines.push([
    'Collector Name',
    'Category',
    'Total Collected (PKR)',
    'Receipts Count',
    'Unique Customers',
    'Average Ticket (PKR)',
    'Cash Amount (PKR)',
    'Digital Amount (PKR)',
    'Cash Share %',
    'Digital Share %',
    'Portfolio Share %',
    'Top Area',
    'Busiest Date'
  ].map(h => `"${h.replace(/"/g, '""')}"`).join(','));

  for (const c of collectors) {
    const row = [
      c.collectorName,
      c.category,
      c.totalCollected,
      c.receiptsCount,
      c.uniqueCustomersCount,
      c.averageTicket,
      c.cashAmount,
      c.digitalAmount,
      c.cashSharePct,
      c.digitalSharePct,
      c.portfolioSharePct,
      c.topArea,
      c.busiestDate
    ];
    lines.push(row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','));
  }

  return BOM + lines.join('\r\n');
}

/**
 * Generates rich semantic HTML printable statement (A4 Executive Sheet or 80mm POS Slip).
 *
 * @param {Object} data - Output of calculateStaffPerformance
 * @param {Object} [options={}] - Options e.g. { format: 'a4' | 'thermal' }
 * @returns {string} Printable HTML
 */
export function generateStaffPerformancePrintHtml(data = {}, options = {}) {
  const format = options.format === 'thermal' ? 'thermal' : 'a4';
  const monthLabel = data.selectedMonthLabel || 'All Periods';
  const totalColl = data.totalCollected || 0;
  const collectors = Array.isArray(data.collectors) ? data.collectors : [];
  const generatedAt = formatDateYmd(new Date());

  if (format === 'thermal') {
    let rowsHtml = '';
    collectors.forEach((c, i) => {
      rowsHtml += `
        <tr>
          <td style="padding: 3px 0; border-bottom: 1px dashed #cbd5e1;">${i + 1}. ${escapeHtml(c.collectorName)}<br><small style="color:#64748b;">${c.category} · ${c.receiptsCount} bills</small></td>
          <td style="padding: 3px 0; text-align: right; border-bottom: 1px dashed #cbd5e1; font-weight: bold;">${formatPKR(c.totalCollected)}<br><small style="color:#64748b;">Avg ${formatPKR(c.averageTicket)}</small></td>
        </tr>
      `;
    });

    return `
      <div class="thermal-receipt" style="font-family: 'Courier New', monospace; width: 280px; margin: 0 auto; padding: 10px; color: #000; font-size: 12px; line-height: 1.35;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
          <div style="font-size: 14px; font-weight: bold;">SHAHDARA ISP BILLING</div>
          <div style="font-size: 11px;">STAFF &amp; COLLECTOR TILL REPORT</div>
          <div style="font-size: 10px;">Period: ${escapeHtml(monthLabel)}</div>
        </div>

        <div style="margin-bottom: 8px; font-size: 11px;">
          <div>Generated: ${generatedAt} PKT</div>
          <div>Total Collection: <strong>${formatPKR(totalColl)}</strong></div>
          <div>Receipts Count: <strong>${data.totalReceipts || 0}</strong></div>
          <div>Avg Ticket: <strong>${formatPKR(data.overallAverageTicket || 0)}</strong></div>
          <div>Cash / Digital: ${data.cashRatioPct || 0}% / ${data.digitalRatioPct || 0}%</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left; padding-bottom: 4px;">Collector / Role</th>
              <th style="text-align: right; padding-bottom: 4px;">PKR / Avg</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="border-top: 1px dashed #000; padding-top: 8px; margin-top: 10px; font-size: 10px; text-align: center;">
          <div>*** SHIFT AUDIT VERIFIED ***</div>
          <div style="margin-top: 16px;">Supervisor Sig: __________________</div>
        </div>
      </div>
    `.trim();
  }

  // Standard A4 Layout
  let tableRows = '';
  collectors.forEach((c, idx) => {
    tableRows += `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
        <td style="padding: 8px; font-weight: 600;">${idx + 1}. ${escapeHtml(c.collectorName)}</td>
        <td style="padding: 8px; color: #475569;">${escapeHtml(c.category)}</td>
        <td style="padding: 8px; text-align: right; font-weight: 700; color: #0e5b4d;">${formatPKR(c.totalCollected)}</td>
        <td style="padding: 8px; text-align: center;">${c.receiptsCount}</td>
        <td style="padding: 8px; text-align: center;">${c.uniqueCustomersCount}</td>
        <td style="padding: 8px; text-align: right;">${formatPKR(c.averageTicket)}</td>
        <td style="padding: 8px; text-align: right;">${formatPKR(c.cashAmount)} (${c.cashSharePct}%)</td>
        <td style="padding: 8px; text-align: right;">${formatPKR(c.digitalAmount)} (${c.digitalSharePct}%)</td>
        <td style="padding: 8px; text-align: center; font-weight: 600;">${c.portfolioSharePct}%</td>
        <td style="padding: 8px;">${escapeHtml(c.topArea)}</td>
      </tr>
    `;
  });

  return `
    <div class="print-statement a4-statement" style="font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 24px; max-width: 900px; margin: 0 auto; line-height: 1.4;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0e5b4d; padding-bottom: 14px; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0; color: #0e5b4d; font-size: 22px;">SHAHDARA BROADBAND NETWORK</h2>
          <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Collector &amp; Staff Collection Performance Statement</div>
        </div>
        <div style="text-align: right; font-size: 12px; color: #64748b;">
          <div><strong>Billing Period:</strong> ${escapeHtml(monthLabel)}</div>
          <div><strong>Report Date:</strong> ${generatedAt} PKT</div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Collected</div>
          <div style="font-size: 18px; font-weight: 800; color: #0e5b4d; margin-top: 4px;">${formatPKR(totalColl)}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Receipts</div>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${data.totalReceipts || 0} bills</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Average Ticket</div>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatPKR(data.overallAverageTicket || 0)}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
          <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Cash / Digital Ratio</div>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${data.cashRatioPct || 0}% / ${data.digitalRatioPct || 0}%</div>
        </div>
      </div>

      <!-- Performance Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background: #0e5b4d; color: #ffffff; font-size: 11px; text-transform: uppercase;">
            <th style="padding: 8px; text-align: left;">Collector</th>
            <th style="padding: 8px; text-align: left;">Role</th>
            <th style="padding: 8px; text-align: right;">Total Collected</th>
            <th style="padding: 8px; text-align: center;">Bills</th>
            <th style="padding: 8px; text-align: center;">Cust</th>
            <th style="padding: 8px; text-align: right;">Avg Ticket</th>
            <th style="padding: 8px; text-align: right;">Cash</th>
            <th style="padding: 8px; text-align: right;">Digital</th>
            <th style="padding: 8px; text-align: center;">Share %</th>
            <th style="padding: 8px; text-align: left;">Top Area</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 16px; border-top: 1px solid #cbd5e1; font-size: 12px; color: #475569;">
        <div>
          <div>Prepared By: __________________________</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Billing Desk Operator / Cashier</div>
        </div>
        <div style="text-align: right;">
          <div>Approved By: __________________________</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">General Manager / ISP Owner</div>
        </div>
      </div>
    </div>
  `.trim();
}

/**
 * Generates bilingual Urdu and English WhatsApp summary briefing text.
 *
 * @param {Object} data - Output of calculateStaffPerformance
 * @returns {string} Plain text WhatsApp message
 */
export function generateStaffPerformanceBriefing(data = {}) {
  const monthLabel = data.selectedMonthLabel || 'All Periods';
  const totalColl = data.totalCollected || 0;
  const receipts = data.totalReceipts || 0;
  const customers = data.uniqueCustomers || 0;
  const avgTicket = data.overallAverageTicket || 0;
  const collectors = Array.isArray(data.collectors) ? data.collectors : [];

  const lines = [
    `📡 *SHAHDARA ISP — COLLECTOR & STAFF PERFORMANCE*`,
    `📅 Period: ${monthLabel}`,
    `-----------------------------------------`,
    `💰 *Total Collected:* ${formatPKR(totalColl)}`,
    `🧾 *Receipts:* ${receipts} bills from ${customers} customers`,
    `🎯 *Average Ticket:* ${formatPKR(avgTicket)}`,
    `💵 *Cash / Digital:* ${data.cashRatioPct || 0}% Cash · ${data.digitalRatioPct || 0}% Digital`,
    `👥 *Active Collectors:* ${data.activeCollectorsCount || 0}`,
    `-----------------------------------------`,
    `🏆 *COLLECTOR BREAKDOWN:*`
  ];

  collectors.slice(0, 6).forEach((c, idx) => {
    lines.push(`${idx + 1}. *${c.collectorName}* (${c.category})`);
    lines.push(`   • Total: ${formatPKR(c.totalCollected)} (${c.portfolioSharePct}%) · ${c.receiptsCount} bills`);
    lines.push(`   • Avg: ${formatPKR(c.averageTicket)} · Cash: ${c.cashSharePct}% · Area: ${c.topArea}`);
  });

  lines.push(`-----------------------------------------`);
  lines.push(`🇵🇰 *اردو خلاصہ (Urdu Briefing):*`);
  lines.push(`شاہدرہ انٹرنیٹ نیٹ ورک: ریکوری عملہ اور دکانوں کا کلوزنگ خلاصہ۔`);
  lines.push(`کل ریکوری: ${formatPKR(totalColl)} بمطابق ${receipts} بلات۔`);
  lines.push(`ٹاپ کلکٹر: ${data.topCollector ? data.topCollector.collectorName + ' (' + formatPKR(data.topCollector.totalCollected) + ')' : 'کوئی نہیں'}`);
  lines.push(`-----------------------------------------`);
  lines.push(`Generated: ${formatDateYmd(new Date())} PKT · Offline Local Ledger`);

  return lines.join('\n');
}

/**
 * Wires the interactive Staff & Collector Performance modal dialog.
 *
 * @param {Object} state - Application state
 * @param {Object} [options={}] - Options
 * @returns {Object} Modal controller
 */
export function setupStaffPerformanceModal(stateInput = {}, options = {}) {
  const modal = document.getElementById('staffPerformanceModal');
  if (!modal) return null;

  const getState = () => (typeof stateInput === 'function' ? stateInput() : (stateInput || (typeof window !== 'undefined' ? window.appState : null) || {}));

  let currentMonth = options.initialMonth || 'all';
  let currentSearch = '';
  let currentChannel = 'all';
  let currentSortBy = 'collections';
  let currentSortOrder = 'desc';

  function renderView() {
    const currentState = getState();
    const data = calculateStaffPerformance(currentState, {
      selectedMonth: currentMonth,
      channelFilter: currentChannel,
      collectorSearch: currentSearch,
      sortBy: currentSortBy,
      sortOrder: currentSortOrder
    });

    // Update KPI tiles
    const kpiTotalEl = document.getElementById('staffPerfTotalCollected');
    const kpiReceiptsEl = document.getElementById('staffPerfTotalReceipts');
    const kpiCustomersEl = document.getElementById('staffPerfUniqueCustomers');
    const kpiAvgTicketEl = document.getElementById('staffPerfAvgTicket');
    const kpiActiveCrewEl = document.getElementById('staffPerfActiveCrew');
    const kpiCashDigitalEl = document.getElementById('staffPerfCashDigitalRatio');

    if (kpiTotalEl) kpiTotalEl.textContent = formatPKR(data.totalCollected);
    if (kpiReceiptsEl) kpiReceiptsEl.textContent = `${data.totalReceipts} bills`;
    if (kpiCustomersEl) kpiCustomersEl.textContent = `${data.uniqueCustomers} cust`;
    if (kpiAvgTicketEl) kpiAvgTicketEl.textContent = formatPKR(data.overallAverageTicket);
    if (kpiActiveCrewEl) kpiActiveCrewEl.textContent = `${data.activeCollectorsCount} active`;
    if (kpiCashDigitalEl) kpiCashDigitalEl.textContent = `${data.cashRatioPct}% / ${data.digitalRatioPct}%`;

    // Render SVG chart
    const svgContainer = document.getElementById('staffPerfSvgContainer');
    if (svgContainer) {
      svgContainer.innerHTML = renderStaffPerformanceSvg(data);
    }

    // Render table rows
    const tbody = document.getElementById('staffPerfTableBody');
    const countBadge = document.getElementById('staffPerfCountBadge');
    if (countBadge) countBadge.textContent = `${data.collectors.length} collectors`;

    if (tbody) {
      if (data.collectors.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 32px 16px; color: var(--text-muted, #64748b);">
              <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
              <div style="font-weight: 600;">No collectors match the current filter or search criteria.</div>
              <div style="font-size: 12px; margin-top: 4px;">Try clearing the search query or selecting 'All Historical Periods'.</div>
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = data.collectors.map((c, i) => `
          <tr data-collector-name="${escapeHtml(c.collectorName)}">
            <td style="font-weight: 700; color: var(--text-primary, #0f172a);">
              <span class="collector-rank-tag">${i + 1}</span>
              ${escapeHtml(c.collectorName)}
            </td>
            <td><span class="collector-role-badge ${c.category.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(c.category)}</span></td>
            <td style="text-align: right; font-weight: 800; color: var(--accent, #0e5b4d);">${formatPKR(c.totalCollected)}</td>
            <td style="text-align: center;">${c.receiptsCount}</td>
            <td style="text-align: center;">${c.uniqueCustomersCount}</td>
            <td style="text-align: right; font-weight: 600;">${formatPKR(c.averageTicket)}</td>
            <td style="text-align: right;"><span class="cash-stat">${formatPKR(c.cashAmount)}</span> <small class="text-muted">(${c.cashSharePct}%)</small></td>
            <td style="text-align: right;"><span class="digital-stat">${formatPKR(c.digitalAmount)}</span> <small class="text-muted">(${c.digitalSharePct}%)</small></td>
            <td style="text-align: left; font-size: 11px;">${escapeHtml(c.topArea)}</td>
          </tr>
        `).join('');
      }
    }

    // Update sort headers aria-sort
    const headers = modal.querySelectorAll('th[data-sort-staff]');
    headers.forEach(th => {
      const field = th.getAttribute('data-sort-staff');
      if (field === currentSortBy) {
        th.setAttribute('aria-sort', currentSortOrder === 'asc' ? 'ascending' : 'descending');
      } else {
        th.setAttribute('aria-sort', 'none');
      }
    });

    return data;
  }

  // Populate month select dropdown if empty
  const monthSelect = document.getElementById('staffPerfMonthSelect');
  if (monthSelect && monthSelect.options.length <= 1) {
    const rawData = calculateStaffPerformance(getState(), { selectedMonth: 'all' });
    monthSelect.innerHTML = '<option value="all">All Historical Periods</option>' +
      rawData.availableMonths.map(m => `<option value="${m}">${monthName(m)} (${m})</option>`).join('');
  }

  // Event handlers
  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      currentMonth = monthSelect.value;
      renderView();
    });
  }

  const searchInput = document.getElementById('staffPerfSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value;
      renderView();
    });
  }

  const channelSelect = document.getElementById('staffPerfChannelSelect');
  if (channelSelect) {
    channelSelect.addEventListener('change', () => {
      currentChannel = channelSelect.value;
      renderView();
    });
  }

  // Table sort header clicks
  const headers = modal.querySelectorAll('th[data-sort-staff]');
  headers.forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort-staff');
      if (currentSortBy === field) {
        currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        currentSortBy = field;
        currentSortOrder = (field === 'collector') ? 'asc' : 'desc';
      }
      renderView();
    });
    th.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        th.click();
      }
    });
  });

  // CSV Export action
  const csvBtn = document.getElementById('exportStaffPerfCsvBtn');
  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      const data = calculateStaffPerformance(getState(), {
        selectedMonth: currentMonth,
        channelFilter: currentChannel,
        collectorSearch: currentSearch,
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
      });
      const csv = generateStaffPerformanceCsv(data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara-staff-performance-${currentMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (typeof options.onToast === 'function') {
        options.onToast('Staff Performance CSV exported successfully');
      }
    });
  }

  // Print A4 action
  const printA4Btn = document.getElementById('printStaffPerfA4Btn');
  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const data = calculateStaffPerformance(getState(), {
        selectedMonth: currentMonth,
        channelFilter: currentChannel,
        collectorSearch: currentSearch,
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
      });
      const html = generateStaffPerformancePrintHtml(data, { format: 'a4' });
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Staff Collection Review - ${escapeHtml(data.selectedMonthLabel)}</title>
              <style>
                body { margin: 0; background: #fff; }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
              </style>
            </head>
            <body>${html}</body>
          </html>
        `);
        printWin.document.close();
        printWin.focus();
        printWin.print();
      }
    });
  }

  // Print 80mm Thermal Slip
  const printSlipBtn = document.getElementById('printStaffPerfThermalBtn');
  if (printSlipBtn) {
    printSlipBtn.addEventListener('click', () => {
      const data = calculateStaffPerformance(getState(), {
        selectedMonth: currentMonth,
        channelFilter: currentChannel,
        collectorSearch: currentSearch,
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
      });
      const html = generateStaffPerformancePrintHtml(data, { format: 'thermal' });
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>POS Slip - Staff Performance</title>
              <style>
                body { margin: 0; background: #fff; }
                @page { size: 80mm auto; margin: 0; }
                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
              </style>
            </head>
            <body>${html}</body>
          </html>
        `);
        printWin.document.close();
        printWin.focus();
        printWin.print();
      }
    });
  }

  // WhatsApp / Clipboard Briefing action
  const waBtn = document.getElementById('shareStaffPerfWhatsAppBtn');
  if (waBtn) {
    waBtn.addEventListener('click', () => {
      const data = calculateStaffPerformance(getState(), {
        selectedMonth: currentMonth,
        channelFilter: currentChannel,
        collectorSearch: currentSearch,
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
      });
      const text = generateStaffPerformanceBriefing(data);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Staff Performance summary copied to clipboard');
      }
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    });
  }

  // Close handlers
  const closeBtn = document.getElementById('closeStaffPerfModalBtn');
  const closeSecBtn = document.getElementById('closeStaffPerfSecondaryBtn');

  function closeModal() {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (closeSecBtn) closeSecBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });

  const controller = {
    open(month = null) {
      if (month) currentMonth = month;
      if (monthSelect) monthSelect.value = currentMonth;
      renderView();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    },
    close: closeModal,
    refresh: renderView,
    getData: () => calculateStaffPerformance(getState(), {
      selectedMonth: currentMonth,
      channelFilter: currentChannel,
      collectorSearch: currentSearch,
      sortBy: currentSortBy,
      sortOrder: currentSortOrder
    })
  };

  const openBtn = document.getElementById('openStaffPerfModalBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => controller.open());
  }

  const openFromClosingBtn = document.getElementById('openStaffPerfFromClosingBtn');
  if (openFromClosingBtn) {
    openFromClosingBtn.addEventListener('click', () => controller.open());
  }

  return controller;
}
