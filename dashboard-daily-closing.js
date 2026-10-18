/**
 * dashboard-daily-closing.js
 * Comprehensive Daily Cash Closing, Shop/Collector Reconciliation & Till Audit Suite.
 *
 * Implements:
 * - calculateDailyClosingSummary: calculates total collections today, breakdown by payment method,
 *   breakdown by shop/collector (Cash at Waseem Abbasi shop, Cash at Hassan shop, Paid by, Direct Cash),
 *   expenses paid today, net physical cash in hand (drawer float), and daily target attainment.
 * - generateDailyClosingSlipText: formatted executive text slip for quick clipboard and WhatsApp dispatch.
 * - generateDailyClosingWhatsApp: bilingual Urdu & English WhatsApp summary dispatch.
 * - generateDailyClosingPrintHtml: dual printable layouts (A4 Daily Register Closing Statement & 80mm POS Thermal Slip).
 * - generateDailyClosingCsv: RFC-4180 compliant CSV export with UTF-8 BOM.
 * - renderDailyClosingSvg: pure-vector responsive SVG visualizer with cash vs digital breakdown and till status.
 * - setupDailyClosingCard: wires the billing dashboard summary card and quick actions.
 * - setupDailyClosingModal: accessible interactive modal controller for detailed day-end closing audits.
 */

import {
  formatPKR
} from './core.js';

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
 * Distinguishes physical cash (Cash, Cash at Waseem Abbasi shop, Cash at Hassan shop)
 * from digital wallets (JazzCash, Easypaisa, Bank Transfer).
 *
 * @param {string} method
 * @returns {boolean}
 */
export function isPhysicalCashMethod(method) {
  if (!method) return true; // Default fallback is physical cash
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
 * Resolves shop location attribution from payment method or paidBy string.
 * @param {string} method
 * @param {string} [paidBy='']
 * @returns {string}
 */
export function resolveShopLocation(method, paidBy = '') {
  const m = String(method || '').toLowerCase();
  const p = String(paidBy || '').toLowerCase();

  if (m.includes('waseem') || p.includes('waseem')) {
    return 'Waseem Abbasi Shop';
  }
  if (m.includes('hassan') || p.includes('hassan')) {
    return 'Hassan Shop';
  }
  if (isPhysicalCashMethod(method)) {
    return 'Direct Field / Doorstep Cash';
  }
  return 'Digital & Online Wallets';
}

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
 * Calculates end-of-day register closing metrics, comparing today's collected receipts
 * against average daily revenue benchmark run rate, breakdown by payment channel,
 * shop/collector totals, expenses paid today, and net cash in hand.
 *
 * @param {Object} state - Application state
 * @param {Date} [referenceDate=new Date()] - Reference date
 * @param {Object} [options={}] - Optional overrides (e.g. { selectedDate: 'YYYY-MM-DD' })
 * @returns {Object} Comprehensive daily closing summary
 */
export function calculateDailyClosingSummary(state = {}, referenceDate = new Date(), options = {}) {
  const todayStr = (options.selectedDate && typeof options.selectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(options.selectedDate))
    ? options.selectedDate
    : (referenceDate instanceof Date ? referenceDate.toISOString().slice(0, 10) : formatDateYmd(referenceDate));

  const currentMonth = todayStr.slice(0, 7);
  const [yearStr, monthNumStr] = currentMonth.split('-');
  const year = parseInt(yearStr, 10) || 2026;
  const monthNum = parseInt(monthNumStr, 10) || 10;
  const daysInMonth = new Date(year, monthNum, 0).getDate() || 30;

  // Calculate month billed revenue to derive daily target benchmark
  let monthBilledCents = 0;
  for (const customer of (state.customers ?? [])) {
    if (customer.archived) continue;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      if (bill.month === currentMonth && bill.dueAmount !== null && bill.dueAmount !== undefined) {
        monthBilledCents += Math.round(Number(bill.dueAmount) * 100);
      }
    }
  }
  const monthBilled = Math.round(monthBilledCents / 100);
  const dailyTarget = monthBilled > 0 ? Math.round(monthBilled / daysInMonth) : 0;

  let todayCollectedCents = 0;
  let todayCount = 0;
  let cashCollectedCents = 0;
  let digitalCollectedCents = 0;

  const methodMap = new Map();
  const methodCountMap = new Map();
  const shopMap = new Map();
  const collectorMap = new Map();
  const receipts = [];

  for (const customer of (state.customers ?? [])) {
    if (customer.archived) continue;
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      for (const p of payments) {
        if (p.date === todayStr) {
          const amt = Number(p.amount) || 0;
          if (amt > 0) {
            const amtCents = Math.round(amt * 100);
            todayCollectedCents += amtCents;
            todayCount++;

            const method = (p.method && String(p.method).trim()) ? String(p.method).trim() : 'Cash';
            methodMap.set(method, (methodMap.get(method) || 0) + amt);
            methodCountMap.set(method, (methodCountMap.get(method) || 0) + 1);

            const isCash = isPhysicalCashMethod(method);
            if (isCash) {
              cashCollectedCents += amtCents;
            } else {
              digitalCollectedCents += amtCents;
            }

            const shopName = resolveShopLocation(method, p.paidBy);
            const prevShop = shopMap.get(shopName) || { amount: 0, count: 0, isCash };
            shopMap.set(shopName, {
              amount: prevShop.amount + amt,
              count: prevShop.count + 1,
              isCash
            });

            const collectorName = resolveCollectorName(method, p.paidBy);
            const prevCollector = collectorMap.get(collectorName) || { amount: 0, count: 0 };
            collectorMap.set(collectorName, {
              amount: prevCollector.amount + amt,
              count: prevCollector.count + 1
            });

            receipts.push({
              id: p.id,
              customerId: customer.id,
              customerNumber: customer.customerNumber,
              customerName: customer.name,
              mohalla: customer.mohalla || customer.zone || 'Shahdara',
              billMonth: bill.month,
              amount: amt,
              method,
              paidBy: p.paidBy || '',
              date: p.date,
              isCash,
              shopName,
              collectorName
            });
          }
        }
      }
    }
  }

  const todayCollected = Math.round(todayCollectedCents / 100);
  const cashCollected = Math.round(cashCollectedCents / 100);
  const digitalCollected = Math.round(digitalCollectedCents / 100);

  const targetAttainment = dailyTarget > 0
    ? Math.round((todayCollected / dailyTarget) * 100)
    : (todayCollected > 0 ? 100 : 0);

  const averageTicket = todayCount > 0 ? Math.round(todayCollected / todayCount) : 0;

  const methods = [...methodMap.entries()].map(([method, amount]) => ({
    method,
    amount,
    count: methodCountMap.get(method) || 1,
    percent: todayCollected > 0 ? Math.round((amount / todayCollected) * 100) : 0,
    isCash: isPhysicalCashMethod(method)
  })).sort((a, b) => b.amount - a.amount);

  const shops = [...shopMap.entries()].map(([name, data]) => ({
    name,
    amount: data.amount,
    count: data.count,
    percent: todayCollected > 0 ? Math.round((data.amount / todayCollected) * 100) : 0,
    isCash: data.isCash
  })).sort((a, b) => b.amount - a.amount);

  const collectors = [...collectorMap.entries()].map(([name, data]) => ({
    name,
    amount: data.amount,
    count: data.count,
    percent: todayCollected > 0 ? Math.round((data.amount / todayCollected) * 100) : 0
  })).sort((a, b) => b.amount - a.amount);

  // Expenses recorded today
  let todayExpensesCents = 0;
  const expenseCategoryMap = new Map();
  const expensesList = [];

  for (const exp of (state.expenses ?? [])) {
    if (exp.date === todayStr) {
      const expAmt = Number(exp.amount) || 0;
      if (expAmt > 0) {
        todayExpensesCents += Math.round(expAmt * 100);
        const cat = exp.category || 'General';
        expenseCategoryMap.set(cat, (expenseCategoryMap.get(cat) || 0) + expAmt);
        expensesList.push({
          id: exp.id,
          category: cat,
          amount: expAmt,
          notes: exp.notes || '',
          date: exp.date
        });
      }
    }
  }

  const todayExpenses = Math.round(todayExpensesCents / 100);
  const todayExpenseCount = expensesList.length;

  const expenseCategories = [...expenseCategoryMap.entries()].map(([category, amount]) => ({
    category,
    amount,
    count: expensesList.filter(e => e.category === category).length,
    percent: todayExpenses > 0 ? Math.round((amount / todayExpenses) * 100) : 0
  })).sort((a, b) => b.amount - a.amount);

  // Net Cash in Hand (Physical cash collections minus expenses paid from till)
  const netCashInHand = cashCollected - todayExpenses;
  const netDayBalance = todayCollected - todayExpenses;

  const cashSharePct = todayCollected > 0 ? Math.round((cashCollected / todayCollected) * 100) : 0;
  const digitalSharePct = todayCollected > 0 ? Math.round((digitalCollected / todayCollected) * 100) : 0;

  let closingStatus = 'no-activity';
  let statusLabel = 'No Activity Today';
  if (todayCount > 0) {
    if (targetAttainment >= 100) {
      closingStatus = 'exceeded';
      statusLabel = 'Target Met (100%+)';
    } else if (targetAttainment >= 60) {
      closingStatus = 'on-track';
      statusLabel = 'On Track';
    } else {
      closingStatus = 'below-target';
      statusLabel = 'Below Target';
    }
  }

  return {
    todayStr,
    currentMonth,
    todayCollected,
    todayCount,
    dailyTarget,
    targetAttainment,
    averageTicket,
    methods,
    shops,
    collectors,
    cashCollected,
    digitalCollected,
    cashSharePct,
    digitalSharePct,
    todayExpenses,
    todayExpenseCount,
    expensesList,
    expenseCategories,
    netCashInHand,
    netDayBalance,
    receipts,
    closingStatus,
    statusLabel
  };
}

/**
 * Generates an executive daily closing summary text snippet for quick WhatsApp or clipboard dispatch.
 * Backwards compatible with existing unit tests while providing upgraded shop and cash in hand details.
 *
 * @param {Object} state - Application state
 * @param {Date} [referenceDate=new Date()] - Reference date
 * @param {Object} [options={}] - Calculation options
 * @returns {string} Formatted plain text daily register closing slip
 */
export function generateDailyClosingSlipText(state, referenceDate = new Date(), options = {}) {
  const summary = calculateDailyClosingSummary(state, referenceDate, options);
  const lines = [
    `💰 SHAHDARA ISP — DAILY REGISTER CLOSING`,
    `Date: ${summary.todayStr} PKT`,
    `-----------------------------------------`,
    `• Total Collections Today: ${formatPKR(summary.todayCollected)} (${summary.todayCount} transactions)`,
    `• Daily Benchmark Target: ${formatPKR(summary.dailyTarget)} (${summary.targetAttainment}% attainment)`,
    `• Average Ticket Size: ${formatPKR(summary.averageTicket)}`,
    `• Closing Status: ${summary.statusLabel}`,
    ``,
    `[ CASH RECONCILIATION & TILL ]`,
    `• Physical Cash In: ${formatPKR(summary.cashCollected)} (${summary.cashSharePct}%)`,
    `• Digital / Online In: ${formatPKR(summary.digitalCollected)} (${summary.digitalSharePct}%)`,
    `• Expenses Paid Today: ${formatPKR(summary.todayExpenses)} (${summary.todayExpenseCount} items)`,
    `• 💵 Net Cash in Hand: ${formatPKR(summary.netCashInHand)}`,
    `• 📊 Net Day Balance: ${formatPKR(summary.netDayBalance)}`,
    ``,
    `[ PAYMENT METHODS TODAY ]`
  ];

  if (summary.methods.length > 0) {
    summary.methods.forEach(m => {
      lines.push(`• ${m.method}: ${formatPKR(m.amount)} (${m.percent}%)`);
    });
  } else {
    lines.push(`• No receipts recorded for ${summary.todayStr}`);
  }

  if (summary.shops.length > 0) {
    lines.push(``, `[ SHOP & COLLECTOR TOTALS ]`);
    summary.shops.forEach(s => {
      lines.push(`• ${s.name}: ${formatPKR(s.amount)} (${s.count} receipts · ${s.percent}%)`);
    });
    if (summary.collectors.length > 0) {
      const collStr = summary.collectors.map(c => `${c.name}: ${formatPKR(c.amount)} (${c.count})`).join(' | ');
      lines.push(`• Collectors / Handlers: ${collStr}`);
    }
  }

  if (summary.expensesList.length > 0) {
    lines.push(``, `[ EXPENSES PAID TODAY ]`);
    summary.expensesList.forEach(e => {
      lines.push(`• ${e.category}: ${formatPKR(e.amount)}${e.notes ? ` (${e.notes})` : ''}`);
    });
  }

  lines.push(`-----------------------------------------`, `Verified Local Device Register · Shahdara ISP`);
  return lines.join('\n');
}

/**
 * Generates an executive bilingual Urdu & English WhatsApp summary dispatch.
 *
 * @param {Object} state - Application state
 * @param {Date} [referenceDate=new Date()] - Reference date
 * @param {Object} [options={}] - Options
 * @returns {string} WhatsApp-ready text with emojis and markdown bold tags
 */
export function generateDailyClosingWhatsApp(state, referenceDate = new Date(), options = {}) {
  const summary = calculateDailyClosingSummary(state, referenceDate, options);
  const lines = [
    `*💰 شاہدرہ آئی ایس پی — یومیہ رجسٹر کلوزنگ*`,
    `*SHAHDARA ISP — DAILY REGISTER CLOSING*`,
    `📅 تاریخ / Date: *${summary.todayStr} PKT*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `• کل وصولیاں / Collections: *${formatPKR(summary.todayCollected)}* (${summary.todayCount} رسیدیں / txs)`,
    `• یومیہ ٹارگٹ / Benchmark Target: ${formatPKR(summary.dailyTarget)} (${summary.targetAttainment}% attainment)`,
    `• اوسط فی کسٹمر / Average Ticket: ${formatPKR(summary.averageTicket)}`,
    `• یومیہ کیفیت / Status: *${summary.statusLabel}*`,
    ``,
    `*💵 کیش اور دراز کا کھاتہ / Cash in Till*`,
    `• نقد کیش وصولی / Cash In: *${formatPKR(summary.cashCollected)}* (${summary.cashSharePct}%)`,
    `• ڈیجیٹل و آن لائن / Digital In: *${formatPKR(summary.digitalCollected)}* (${summary.digitalSharePct}%)`,
    `• آج کے اخراجات / Expenses Paid: *${formatPKR(summary.todayExpenses)}* (${summary.todayExpenseCount} items)`,
    `• 🟢 *خالص نقد کیش دراز میں / Net Cash in Hand: ${formatPKR(summary.netCashInHand)}*`,
    `• 📊 مجموعی یومیہ بیلنس / Net Day Balance: *${formatPKR(summary.netDayBalance)}*`,
    ``,
    `*🏪 دوکان و کلیکشن پوائنٹس / Shops & Points*`
  ];

  if (summary.shops.length > 0) {
    summary.shops.forEach(s => {
      lines.push(`• ${s.name}: ${formatPKR(s.amount)} (${s.count} txs)`);
    });
  } else {
    lines.push(`• کوئی وصولی درج نہیں / No collections recorded`);
  }

  if (summary.expensesList.length > 0) {
    lines.push(``, `*📋 آج کے ادا شدہ اخراجات / Expenses Paid*`);
    summary.expensesList.forEach(e => {
      lines.push(`• ${e.category}: ${formatPKR(e.amount)}${e.notes ? ` (${e.notes})` : ''}`);
    });
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`, `_تصدیق شدہ آف لائن رجسٹر · شاہدرہ نیٹ ورک_`);
  return lines.join('\n');
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM.
 *
 * @param {Object} summary - Output of calculateDailyClosingSummary
 * @returns {string} CSV text with BOM
 */
export function generateDailyClosingCsv(summary) {
  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  }

  const rows = [];
  rows.push(['SHAHDARA ISP — DAILY CASH REGISTER & CLOSING AUDIT']);
  rows.push(['Date', summary.todayStr, 'Month', summary.currentMonth]);
  rows.push(['Total Collections (PKR)', summary.todayCollected, 'Receipts Count', summary.todayCount]);
  rows.push(['Daily Target (PKR)', summary.dailyTarget, 'Target Attainment %', `${summary.targetAttainment}%`]);
  rows.push(['Physical Cash In (PKR)', summary.cashCollected, 'Digital Collections (PKR)', summary.digitalCollected]);
  rows.push(['Expenses Paid Today (PKR)', summary.todayExpenses, 'Net Cash in Hand (PKR)', summary.netCashInHand]);
  rows.push(['Net Day Balance (PKR)', summary.netDayBalance, 'Closing Status', summary.statusLabel]);
  rows.push([]);

  // Section 2: Payment Methods & Channels
  rows.push(['--- PAYMENT METHODS & CHANNELS ---']);
  rows.push(['Method Name', 'Type', 'Amount (PKR)', 'Count', 'Share %']);
  for (const m of (summary.methods ?? [])) {
    rows.push([m.method, m.isCash ? 'Physical Cash' : 'Digital/Bank', m.amount, m.count, `${m.percent}%`]);
  }
  rows.push([]);

  // Section 3: Shop & Collector Breakdowns
  rows.push(['--- SHOP & POINT ATTRIBUTION ---']);
  rows.push(['Shop / Point Name', 'Amount (PKR)', 'Count', 'Share %']);
  for (const s of (summary.shops ?? [])) {
    rows.push([s.name, s.amount, s.count, `${s.percent}%`]);
  }
  rows.push([]);

  // Section 4: Operating Expenses Today
  rows.push(['--- OPERATING EXPENSES TODAY ---']);
  rows.push(['Expense ID', 'Date', 'Category', 'Amount (PKR)', 'Description / Notes']);
  for (const e of (summary.expensesList ?? [])) {
    rows.push([e.id, e.date, e.category, e.amount, e.notes]);
  }
  if ((summary.expensesList ?? []).length === 0) {
    rows.push(['None', summary.todayStr, 'N/A', 0, 'No operational expenses recorded today']);
  }
  rows.push([]);

  // Section 5: Customer Receipts Ledger Today
  rows.push(['--- CUSTOMER RECEIPTS RECORDED TODAY ---']);
  rows.push(['Customer #', 'Subscriber Name', 'Mohalla / Area', 'Bill Month', 'Amount (PKR)', 'Payment Method', 'Paid By / Collector', 'Shop Attribution']);
  for (const r of (summary.receipts ?? [])) {
    rows.push([r.customerNumber, r.customerName, r.mohalla, r.billMonth, r.amount, r.method, r.paidBy, r.shopName]);
  }
  if ((summary.receipts ?? []).length === 0) {
    rows.push(['N/A', 'No receipts', 'N/A', 'N/A', 0, 'N/A', 'N/A', 'N/A']);
  }

  return '\uFEFF' + rows.map(cols => cols.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * Generates standalone printable HTML for A4 statement or 80mm POS thermal printer.
 *
 * @param {Object} summary - Output of calculateDailyClosingSummary
 * @param {Object} [options={}] - Layout options
 * @param {string} [options.format='a4'] - 'a4' or 'pos'
 * @param {string} [options.title='Shahdara ISP Daily Closing'] - Slip title
 * @param {string} [options.ispName='Shahdara ISP Network Operations'] - ISP brand name
 * @returns {string} Standalone HTML document string
 */
export function generateDailyClosingPrintHtml(summary, {
  format = 'a4',
  title = 'Shahdara ISP Daily Closing',
  ispName = 'Shahdara ISP Network Operations'
} = {}) {
  const isPos = format === 'pos' || format === 'thermal';

  if (isPos) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - 80mm POS</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 4px;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .header h1 { font-size: 14px; margin: 0 0 2px 0; text-transform: uppercase; }
    .header p { margin: 1px 0; font-size: 10px; }
    .flex-row { display: flex; justify-content: space-between; margin: 2px 0; }
    .table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .table th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; font-size: 10px; }
    .table td { padding: 2px 0; font-size: 10px; }
    .highlight-box { border: 1px solid #000; padding: 4px; margin: 6px 0; text-align: center; }
    .highlight-val { font-size: 15px; font-weight: bold; }
    .signature-area { margin-top: 15px; text-align: center; font-size: 9px; }
  </style>
</head>
<body>
  <div class="header text-center">
    <h1 class="bold">${escapeHtml(ispName)}</h1>
    <p class="bold">DAILY REGISTER CLOSING (روزنامچہ)</p>
    <p>Date: ${escapeHtml(summary.todayStr)} PKT</p>
    <p>Status: ${escapeHtml(summary.statusLabel)}</p>
  </div>

  <div class="divider"></div>

  <div class="flex-row">
    <span>Total Collections:</span>
    <span class="bold">${escapeHtml(formatPKR(summary.todayCollected))}</span>
  </div>
  <div class="flex-row">
    <span>Receipts Count:</span>
    <span>${summary.todayCount} txs</span>
  </div>
  <div class="flex-row">
    <span>Daily Target:</span>
    <span>${escapeHtml(formatPKR(summary.dailyTarget))} (${summary.targetAttainment}%)</span>
  </div>
  <div class="flex-row">
    <span>Average Ticket:</span>
    <span>${escapeHtml(formatPKR(summary.averageTicket))}</span>
  </div>

  <div class="divider"></div>

  <div class="bold" style="margin-bottom: 3px;">TILL & CASH RECONCILIATION:</div>
  <div class="flex-row">
    <span>• Physical Cash In:</span>
    <span class="bold">${escapeHtml(formatPKR(summary.cashCollected))}</span>
  </div>
  <div class="flex-row">
    <span>• Digital / Online In:</span>
    <span>${escapeHtml(formatPKR(summary.digitalCollected))}</span>
  </div>
  <div class="flex-row">
    <span>• Expenses Paid Today:</span>
    <span>-${escapeHtml(formatPKR(summary.todayExpenses))}</span>
  </div>

  <div class="highlight-box">
    <div style="font-size: 10px;">NET CASH IN HAND (DRAWER FLOAT)</div>
    <div class="highlight-val">${escapeHtml(formatPKR(summary.netCashInHand))}</div>
    <div style="font-size: 9px;">Net Day Balance: ${escapeHtml(formatPKR(summary.netDayBalance))}</div>
  </div>

  <div class="divider"></div>

  <div class="bold" style="margin-bottom: 3px;">SHOP / POINT BREAKDOWN:</div>
  ${(summary.shops ?? []).map(s => `
    <div class="flex-row">
      <span>${escapeHtml(s.name)}:</span>
      <span class="bold">${escapeHtml(formatPKR(s.amount))} (${s.count})</span>
    </div>
  `).join('')}

  ${(summary.expensesList ?? []).length > 0 ? `
    <div class="divider"></div>
    <div class="bold" style="margin-bottom: 3px;">EXPENSES PAID TODAY:</div>
    ${(summary.expensesList ?? []).map(e => `
      <div class="flex-row">
        <span>${escapeHtml(e.category)}:</span>
        <span>${escapeHtml(formatPKR(e.amount))}</span>
      </div>
    `).join('')}
  ` : ''}

  <div class="double-divider"></div>

  <div class="signature-area">
    <p>Cashier / Drawer Checked: ________________</p>
    <p style="margin-top: 10px;">Manager / Proprietor Sign: ________________</p>
    <p style="margin-top: 6px; font-size: 8px;">Offline Local Device Record · Shahdara ISP</p>
  </div>
</body>
</html>`;
  }

  // Format: A4 Statement
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - A4 Register Closing Statement</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 12px;
      color: #1e293b;
      background: #fff;
      margin: 0;
      padding: 0;
    }
    .header-table { width: 100%; border-bottom: 2px solid #0e5b4d; padding-bottom: 8px; margin-bottom: 12px; }
    .header-logo { font-size: 20px; font-weight: 800; color: #0e5b4d; margin: 0; }
    .header-subtitle { font-size: 11px; color: #64748b; margin: 2px 0 0 0; }
    .meta-box { text-align: right; font-size: 11px; color: #475569; }
    .kpi-grid { display: flex; gap: 8px; margin-bottom: 14px; }
    .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; background: #f8fafc; }
    .kpi-card.highlight { background: #f0fdf4; border-color: #86efac; }
    .kpi-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 2px; }
    .kpi-value { font-size: 16px; font-weight: 800; color: #0f172a; }
    .kpi-card.highlight .kpi-value { color: #0e5b4d; }
    .kpi-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
    .section-title { font-size: 12px; font-weight: 700; color: #0e5b4d; margin: 12px 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    .side-by-side { display: flex; gap: 12px; margin-bottom: 10px; }
    .half-col { flex: 1; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
    th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 5px 8px; border: 1px solid #cbd5e1; }
    td { padding: 4px 8px; border: 1px solid #cbd5e1; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; }
    .badge-cash { background: #dcfce7; color: #166534; }
    .badge-digital { background: #dbeafe; color: #1e40af; }
    .signatures { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; }
    .sig-line { width: 45%; border-top: 1px solid #000; text-align: center; font-size: 10px; padding-top: 4px; }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td>
        <h1 class="header-logo">${escapeHtml(ispName)}</h1>
        <p class="header-subtitle">Executive Daily Cash Register &amp; Till Closing Statement (یومیہ روزنامچہ)</p>
      </td>
      <td class="meta-box">
        <div><strong>Closing Date:</strong> ${escapeHtml(summary.todayStr)} PKT</div>
        <div><strong>Register Month:</strong> ${escapeHtml(summary.currentMonth)}</div>
        <div><strong>Closing Status:</strong> ${escapeHtml(summary.statusLabel)}</div>
      </td>
    </tr>
  </table>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Collections</div>
      <div class="kpi-value">${escapeHtml(formatPKR(summary.todayCollected))}</div>
      <div class="kpi-sub">${summary.todayCount} total receipts</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Physical Cash In</div>
      <div class="kpi-value">${escapeHtml(formatPKR(summary.cashCollected))}</div>
      <div class="kpi-sub">${summary.cashSharePct}% of day collections</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Expenses Paid Today</div>
      <div class="kpi-value" style="color: #b91c1c;">${escapeHtml(formatPKR(summary.todayExpenses))}</div>
      <div class="kpi-sub">${summary.todayExpenseCount} expense vouchers</div>
    </div>
    <div class="kpi-card highlight">
      <div class="kpi-label">Net Cash in Hand (Till)</div>
      <div class="kpi-value">${escapeHtml(formatPKR(summary.netCashInHand))}</div>
      <div class="kpi-sub">Drawer physical balance</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Target Attainment</div>
      <div class="kpi-value">${summary.targetAttainment}%</div>
      <div class="kpi-sub">Target: ${escapeHtml(formatPKR(summary.dailyTarget))}/day</div>
    </div>
  </div>

  <div class="side-by-side">
    <div class="half-col">
      <div class="section-title">Shop &amp; Channel Attribution</div>
      <table>
        <thead>
          <tr>
            <th>Shop / Method</th>
            <th>Type</th>
            <th class="text-right">Receipts</th>
            <th class="text-right">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${(summary.shops ?? []).map(s => `
            <tr>
              <td><strong>${escapeHtml(s.name)}</strong></td>
              <td><span class="badge ${s.isCash ? 'badge-cash' : 'badge-digital'}">${s.isCash ? 'Cash' : 'Online'}</span></td>
              <td class="text-right">${s.count}</td>
              <td class="text-right"><strong>${escapeHtml(formatPKR(s.amount))}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="half-col">
      <div class="section-title">Today's Operating Expenses</div>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Notes / Details</th>
            <th class="text-right">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${(summary.expensesList ?? []).length > 0 ? (summary.expensesList ?? []).map(e => `
            <tr>
              <td><strong>${escapeHtml(e.category)}</strong></td>
              <td>${escapeHtml(e.notes || '-')}</td>
              <td class="text-right" style="color: #b91c1c;"><strong>${escapeHtml(formatPKR(e.amount))}</strong></td>
            </tr>
          `).join('') : `
            <tr>
              <td colspan="3" class="text-center" style="color: #64748b; padding: 10px;">No operational expenses paid today.</td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  </div>

  <div class="section-title">Customer Receipts Ledger (${summary.todayCount} entries today)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 50px;">Cust #</th>
        <th>Customer Name</th>
        <th>Area / Mohalla</th>
        <th>Bill Month</th>
        <th>Method</th>
        <th>Paid By / Collector</th>
        <th class="text-right">Amount (PKR)</th>
      </tr>
    </thead>
    <tbody>
      ${(summary.receipts ?? []).length > 0 ? (summary.receipts ?? []).map(r => `
        <tr>
          <td>#${r.customerNumber}</td>
          <td><strong>${escapeHtml(r.customerName)}</strong></td>
          <td>${escapeHtml(r.mohalla)}</td>
          <td>${escapeHtml(r.billMonth)}</td>
          <td><span class="badge ${r.isCash ? 'badge-cash' : 'badge-digital'}">${escapeHtml(r.method)}</span></td>
          <td>${escapeHtml(r.paidBy || '-')}</td>
          <td class="text-right"><strong>${escapeHtml(formatPKR(r.amount))}</strong></td>
        </tr>
      `).join('') : `
        <tr>
          <td colspan="7" class="text-center" style="color: #64748b; padding: 12px;">No payment receipts recorded for this date.</td>
        </tr>
      `}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-line">
      Cashier / Till Reconciler Signature<br>
      <span style="font-size: 9px; color: #64748b;">(Verified physical cash in register drawer)</span>
    </div>
    <div class="sig-line">
      Proprietor / Operations Manager Signature<br>
      <span style="font-size: 9px; color: #64748b;">(Approved closing &amp; register ledger)</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Renders a pure-vector SVG graphic representing the day-end closing telemetry.
 *
 * @param {Object} summary - Output of calculateDailyClosingSummary
 * @returns {string} Pure SVG markup
 */
export function renderDailyClosingSvg(summary) {
  const width = 640;
  const height = 180;

  const total = summary.todayCollected || 0;
  const cash = summary.cashCollected || 0;
  const digital = summary.digitalCollected || 0;
  const expenses = summary.todayExpenses || 0;
  const netCash = summary.netCashInHand;

  // Breakdown bar proportions (width 400px, x=20, y=75, h=22)
  const barWidth = 380;
  const cashW = total > 0 ? Math.max(2, Math.round((cash / total) * barWidth)) : 0;
  const digitalW = total > 0 ? Math.max(0, barWidth - cashW) : 0;

  // Target attainment progress bar (width 380px, x=20, y=135, h=12)
  const target = summary.dailyTarget || 1;
  const targetPct = Math.min(100, summary.targetAttainment || 0);
  const targetFillW = Math.round((targetPct / 100) * barWidth);

  // Status color
  const statusColor = summary.closingStatus === 'exceeded'
    ? '#10b981'
    : summary.closingStatus === 'on-track'
    ? '#3b82f6'
    : summary.closingStatus === 'below-target'
    ? '#f59e0b'
    : '#94a3b8';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" class="daily-closing-svg" role="img" aria-label="Daily register closing visualization" style="height: auto; max-width: 100%; display: block;">
  <defs>
    <linearGradient id="dcCashGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <linearGradient id="dcDigitalGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="dcCardGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#f1f5f9"/>
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" rx="10" fill="var(--card-bg, #ffffff)" stroke="var(--border-color, #e2e8f0)" stroke-width="1"/>

  <!-- Title & Date -->
  <text x="20" y="28" font-size="13" font-weight="700" fill="var(--text-primary, #0f172a)">Daily Register &amp; Till Status</text>
  <text x="20" y="44" font-size="11" fill="var(--text-muted, #64748b)">Date: ${escapeXml(summary.todayStr)} PKT · ${summary.todayCount} Receipts</text>

  <!-- Right Till Telemetry Card -->
  <rect x="420" y="16" width="200" height="148" rx="8" fill="url(#dcCardGrad)" stroke="var(--border-color, #cbd5e1)" stroke-width="1"/>
  <text x="432" y="38" font-size="10" font-weight="700" fill="#64748b" letter-spacing="0.05em">NET CASH IN HAND (TILL)</text>
  <text x="432" y="66" font-size="18" font-weight="800" fill="${netCash >= 0 ? '#0e5b4d' : '#b91c1c'}">${escapeXml(formatPKR(netCash))}</text>
  <text x="432" y="86" font-size="10" fill="#64748b">Physical cash left in drawer</text>

  <line x1="432" y1="96" x2="608" y2="96" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3,3"/>

  <text x="432" y="112" font-size="10" fill="#475569">Expenses Paid: <tspan font-weight="700" fill="#b91c1c">-${escapeXml(formatPKR(expenses))}</tspan></text>
  <text x="432" y="128" font-size="10" fill="#475569">Net Day Balance: <tspan font-weight="700" fill="#0f172a">${escapeXml(formatPKR(summary.netDayBalance))}</tspan></text>
  
  <rect x="432" y="136" width="100" height="18" rx="4" fill="${statusColor}" opacity="0.2"/>
  <text x="440" y="149" font-size="9" font-weight="700" fill="${statusColor}">${escapeXml(summary.statusLabel)}</text>

  <!-- Collections Stacked Bar -->
  <text x="20" y="68" font-size="10" font-weight="700" fill="var(--text-muted, #64748b)">COLLECTIONS MIX (${escapeXml(formatPKR(total))})</text>
  <rect x="20" y="76" width="${barWidth}" height="20" rx="4" fill="#e2e8f0"/>
  ${total > 0 ? `
    <rect x="20" y="76" width="${cashW}" height="20" rx="4" fill="url(#dcCashGrad)"/>
    <rect x="${20 + cashW}" y="76" width="${digitalW}" height="20" rx="4" fill="url(#dcDigitalGrad)"/>
  ` : ''}

  <!-- Legend -->
  <circle cx="25" cy="108" r="4" fill="#10b981"/>
  <text x="33" y="112" font-size="10" fill="var(--text-primary, #334155)">Cash In: ${escapeXml(formatPKR(cash))} (${summary.cashSharePct}%)</text>

  <circle cx="210" cy="108" r="4" fill="#3b82f6"/>
  <text x="218" y="112" font-size="10" fill="var(--text-primary, #334155)">Digital / Online: ${escapeXml(formatPKR(digital))} (${summary.digitalSharePct}%)</text>

  <!-- Benchmark Run Rate Gauge -->
  <text x="20" y="134" font-size="10" font-weight="700" fill="var(--text-muted, #64748b)">DAILY TARGET ATTAINMENT (${summary.targetAttainment}%)</text>
  <rect x="20" y="142" width="${barWidth}" height="10" rx="5" fill="#e2e8f0"/>
  <rect x="20" y="142" width="${targetFillW}" height="10" rx="5" fill="${statusColor}"/>
  <text x="20" y="164" font-size="9" fill="var(--text-muted, #64748b)">Benchmark: ${escapeXml(formatPKR(summary.dailyTarget))}/day · ${summary.todayCount} receipts</text>
</svg>`;
}

/**
 * Sets up and updates the daily closing card on the billing dashboard.
 *
 * @param {Object} state - Current application state
 * @param {Date} [referenceDate=new Date()] - Reference date
 * @param {Object} [options={}] - Options (e.g. { onToast, clipboard })
 */
export function setupDailyClosingCard(state, referenceDate = new Date(), options = {}) {
  const onToast = options.onToast;
  const clipboard = options.clipboard;
  const getState = typeof options.getState === 'function' ? options.getState : (typeof state === 'function' ? state : () => state);
  const activeState = getState() || state;
  const activeRefDate = options.getReferenceDate ? options.getReferenceDate() : (referenceDate || new Date());

  const summary = calculateDailyClosingSummary(activeState, activeRefDate);
  const valueEl = document.getElementById('dashboardDailyClosingValue');
  const periodEl = document.getElementById('dashboardDailyClosingPeriod');
  const badgeEl = document.getElementById('dashboardClosingStatusBadge');
  const slipBtn = document.getElementById('quickActionDailyClosingSlip');

  if (valueEl) {
    valueEl.textContent = summary.todayCount > 0
      ? `${formatPKR(summary.todayCollected)} (${summary.todayCount} txs)`
      : 'No payment entries';
  }

  if (periodEl) {
    if (summary.todayCount > 0 || summary.todayExpenses > 0) {
      periodEl.textContent = `Target: ${formatPKR(summary.dailyTarget)}/day (${summary.targetAttainment}%) · Net Cash: ${formatPKR(summary.netCashInHand)}`;
    } else {
      periodEl.textContent = `Target: ${formatPKR(summary.dailyTarget)} / day · ${summary.targetAttainment}% attainment`;
    }
  }

  if (badgeEl) {
    badgeEl.textContent = summary.statusLabel;
    badgeEl.className = `closing-badge badge-${summary.closingStatus}`;
  }

  if (slipBtn) {
    const isWired = slipBtn.dataset ? slipBtn.dataset.wired : slipBtn.getAttribute?.('data-wired');
    if (!isWired) {
      if (slipBtn.dataset) slipBtn.dataset.wired = 'true';
      else if (slipBtn.setAttribute) slipBtn.setAttribute('data-wired', 'true');

      slipBtn.addEventListener('click', async () => {
        const liveState = getState() || state;
        const liveDate = new Date();
        const text = generateDailyClosingSlipText(liveState, liveDate);
        let copied = false;
        const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
        if (clip && typeof clip.writeText === 'function') {
          try {
            await clip.writeText(text);
            copied = true;
          } catch {
            copied = false;
          }
        }
        if (!copied && typeof document !== 'undefined') {
          try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            copied = document.execCommand('copy');
            document.body.removeChild(ta);
          } catch {
            copied = false;
          }
        }
        if (typeof onToast === 'function') {
          onToast(copied ? 'Daily closing slip copied to clipboard!' : 'Daily closing summary ready.');
        }

        // Open daily closing modal for interactive review with Copy, WhatsApp, and Print (#238)
        const modal = document.getElementById('dailyClosingModal');
        if (modal && typeof modal.showModal === 'function' && !modal.open) {
          modal.showModal();
        }
      });
    }
  }
}

/**
 * Filters a list of customer receipts for the daily closing register by search query.
 *
 * @param {Array<Object>} receipts - Array of receipts
 * @param {string} query - Search term
 * @returns {Array<Object>} Filtered receipts
 */
export function filterDailyClosingReceipts(receipts = [], query = '') {
  if (!Array.isArray(receipts)) return [];
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [...receipts];

  return receipts.filter(r => {
    if (!r) return false;
    const custNum = String(r.customerNumber || '').toLowerCase();
    const name = String(r.customerName || '').toLowerCase();
    const mohalla = String(r.mohalla || '').toLowerCase();
    const month = String(r.billMonth || '').toLowerCase();
    const method = String(r.method || '').toLowerCase();
    const paidBy = String(r.paidBy || '').toLowerCase();
    const amount = String(r.amount || '');

    return custNum.includes(q) ||
      name.includes(q) ||
      mohalla.includes(q) ||
      month.includes(q) ||
      method.includes(q) ||
      paidBy.includes(q) ||
      amount.includes(q);
  });
}

/**
 * Sorts customer receipts for the daily closing register.
 *
 * @param {Array<Object>} receipts - Array of receipts
 * @param {string} col - Column key to sort by
 * @param {boolean} [asc=true] - Sort ascending
 * @returns {Array<Object>} Sorted array
 */
export function sortDailyClosingReceipts(receipts = [], col = 'customerNumber', asc = true) {
  if (!Array.isArray(receipts)) return [];
  const list = [...receipts];
  return list.sort((a, b) => {
    let valA = a ? a[col] : undefined;
    let valB = b ? b[col] : undefined;

    if (col === 'customerNumber' || col === 'amount') {
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return asc ? numA - numB : numB - numA;
    }

    const strA = String(valA || '').toLowerCase();
    const strB = String(valB || '').toLowerCase();
    const cmp = strA.localeCompare(strB);
    return asc ? cmp : -cmp;
  });
}

/**
 * Controller for the detailed interactive Daily Cash Closing Modal dialog.
 *
 * @param {Function} getState - State accessor
 * @param {Object} [options={}] - Options
 * @returns {Object} Controller object with open, close, and render methods
 */
export function setupDailyClosingModal(getState, {
  onToast
} = {}) {
  const modal = document.getElementById('dailyClosingModal');
  if (!modal) return null;

  const dateInput = document.getElementById('dailyClosingDateInput');
  const prevDateBtn = document.getElementById('dailyClosingPrevDateBtn');
  const nextDateBtn = document.getElementById('dailyClosingNextDateBtn');
  const todayDateBtn = document.getElementById('dailyClosingTodayDateBtn');

  // KPI elements
  const kpiTotalEl = document.getElementById('dcKpiTotal');
  const kpiCountEl = document.getElementById('dcKpiCount');
  const kpiCashEl = document.getElementById('dcKpiCash');
  const kpiDigitalEl = document.getElementById('dcKpiDigital');
  const kpiExpensesEl = document.getElementById('dcKpiExpenses');
  const kpiNetCashEl = document.getElementById('dcKpiNetCash');
  const kpiNetBalanceEl = document.getElementById('dcKpiNetBalance');
  const kpiAttainmentEl = document.getElementById('dcKpiAttainment');

  // Containers
  const svgContainer = document.getElementById('dailyClosingSvgContainer');
  const shopsTableBody = document.getElementById('dailyClosingShopsTableBody');
  const expensesTableBody = document.getElementById('dailyClosingExpensesTableBody');
  const receiptsTableBody = document.getElementById('dailyClosingReceiptsTableBody');
  const receiptsEmptyEl = document.getElementById('dailyClosingReceiptsEmpty');
  const expensesEmptyEl = document.getElementById('dailyClosingExpensesEmpty');

  // Receipts Table Filter & Sort Controls
  let receiptsSortCol = 'customerNumber';
  let receiptsSortAsc = true;
  let receiptsSearchQuery = '';

  const receiptsSearchInput = document.getElementById('dailyClosingReceiptsSearch');
  const receiptsCountEl = document.getElementById('dailyClosingReceiptsCount');
  const receiptsResetBtn = document.getElementById('resetDailyClosingReceiptsBtn');
  const receiptsHeaders = modal && typeof modal.querySelectorAll === 'function'
    ? modal.querySelectorAll('th[data-sort-dcr]')
    : [];

  // Action buttons
  const copySlipBtn = document.getElementById('dcCopySlipBtn');
  const shareWhatsAppBtn = document.getElementById('dcShareWhatsAppBtn');
  const printA4Btn = document.getElementById('dcPrintA4Btn');
  const printPosBtn = document.getElementById('dcPrintPosBtn');
  const exportCsvBtn = document.getElementById('dcExportCsvBtn');

  // Close triggers
  const closeBtn = document.getElementById('closeDailyClosingModalBtn');
  const closeSecondaryBtn = document.getElementById('closeDailyClosingSecondaryBtn');
  const openTriggerBtn = document.getElementById('openDailyClosingModalBtn');
  const quickActionBtn = document.getElementById('quickActionDailyClosing');

  let activeDateStr = formatDateYmd(new Date());

  function render() {
    const state = typeof getState === 'function' ? getState() : {};
    const summary = calculateDailyClosingSummary(state, new Date(), { selectedDate: activeDateStr });

    if (dateInput) {
      dateInput.value = activeDateStr;
    }

    if (kpiTotalEl) kpiTotalEl.textContent = formatPKR(summary.todayCollected);
    if (kpiCountEl) kpiCountEl.textContent = `${summary.todayCount} Receipts`;
    if (kpiCashEl) kpiCashEl.textContent = `${formatPKR(summary.cashCollected)} (${summary.cashSharePct}%)`;
    if (kpiDigitalEl) kpiDigitalEl.textContent = `${formatPKR(summary.digitalCollected)} (${summary.digitalSharePct}%)`;
    if (kpiExpensesEl) kpiExpensesEl.textContent = `-${formatPKR(summary.todayExpenses)}`;
    if (kpiNetCashEl) {
      kpiNetCashEl.textContent = formatPKR(summary.netCashInHand);
      kpiNetCashEl.style.color = summary.netCashInHand >= 0 ? '#0e5b4d' : '#b91c1c';
    }
    if (kpiNetBalanceEl) kpiNetBalanceEl.textContent = formatPKR(summary.netDayBalance);
    if (kpiAttainmentEl) kpiAttainmentEl.textContent = `${summary.targetAttainment}% (${summary.statusLabel})`;

    // Render SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderDailyClosingSvg(summary);
    }

    // Render Shops Table
    if (shopsTableBody) {
      if (summary.shops.length > 0) {
        shopsTableBody.innerHTML = summary.shops.map(s => `
          <tr>
            <td style="padding: 8px 10px; font-weight: 600;">${escapeHtml(s.name)}</td>
            <td style="padding: 8px 10px; text-align: center;">
              <span class="badge ${s.isCash ? 'badge-cash' : 'badge-digital'}" style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: ${s.isCash ? '#dcfce7' : '#dbeafe'}; color: ${s.isCash ? '#166534' : '#1e40af'};">
                ${s.isCash ? 'Physical Cash' : 'Digital/Bank'}
              </span>
            </td>
            <td style="padding: 8px 10px; text-align: right;">${s.count}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 700;">${escapeHtml(formatPKR(s.amount))}</td>
            <td style="padding: 8px 10px; text-align: right; color: #64748b;">${s.percent}%</td>
          </tr>
        `).join('');
      } else {
        shopsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 16px; color: #64748b;">No collections recorded on ${escapeHtml(activeDateStr)}.</td></tr>`;
      }
    }

    // Render Expenses Table
    if (expensesTableBody) {
      if (summary.expensesList.length > 0) {
        if (expensesEmptyEl) expensesEmptyEl.hidden = true;
        expensesTableBody.innerHTML = summary.expensesList.map(e => `
          <tr>
            <td style="padding: 8px 10px; font-weight: 600; color: #b91c1c;">${escapeHtml(e.category)}</td>
            <td style="padding: 8px 10px;">${escapeHtml(e.notes || '-')}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #b91c1c;">${escapeHtml(formatPKR(e.amount))}</td>
          </tr>
        `).join('');
      } else {
        if (expensesEmptyEl) expensesEmptyEl.hidden = false;
        expensesTableBody.innerHTML = '';
      }
    }

    // Render Receipts Table with live search and sorting
    if (receiptsTableBody) {
      const filteredReceipts = filterDailyClosingReceipts(summary.receipts, receiptsSearchQuery);
      const sortedReceipts = sortDailyClosingReceipts(filteredReceipts, receiptsSortCol, receiptsSortAsc);

      if (receiptsCountEl) {
        if (summary.receipts.length === 0) {
          receiptsCountEl.textContent = '0 Receipts';
        } else if (receiptsSearchQuery) {
          receiptsCountEl.textContent = `${filteredReceipts.length} of ${summary.receipts.length} Receipts`;
        } else {
          receiptsCountEl.textContent = `${summary.receipts.length} Receipts`;
        }
      }

      if (receiptsResetBtn) {
        receiptsResetBtn.style.display = receiptsSearchQuery ? 'inline-block' : 'none';
      }

      if (receiptsHeaders && receiptsHeaders.length) {
        receiptsHeaders.forEach(th => {
          const col = th.getAttribute('data-sort-dcr');
          const indicator = th.querySelector('.sort-indicator');
          if (col === receiptsSortCol) {
            th.setAttribute('aria-sort', receiptsSortAsc ? 'ascending' : 'descending');
            if (indicator) indicator.textContent = receiptsSortAsc ? '▲' : '▼';
          } else {
            th.setAttribute('aria-sort', 'none');
            if (indicator) indicator.textContent = '⇅';
          }
        });
      }

      if (sortedReceipts.length > 0) {
        if (receiptsEmptyEl) receiptsEmptyEl.hidden = true;
        receiptsTableBody.innerHTML = sortedReceipts.map(r => `
          <tr>
            <td style="padding: 8px 10px; font-family: monospace;">#${r.customerNumber}</td>
            <td style="padding: 8px 10px; font-weight: 600;">${escapeHtml(r.customerName)}</td>
            <td style="padding: 8px 10px; color: #64748b;">${escapeHtml(r.mohalla)}</td>
            <td style="padding: 8px 10px; font-family: monospace;">${escapeHtml(r.billMonth)}</td>
            <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #0e5b4d;">${escapeHtml(formatPKR(r.amount))}</td>
            <td style="padding: 8px 10px;">
              <span class="badge ${r.isCash ? 'badge-cash' : 'badge-digital'}" style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: ${r.isCash ? '#dcfce7' : '#dbeafe'}; color: ${r.isCash ? '#166534' : '#1e40af'};">
                ${escapeHtml(r.method)}
              </span>
            </td>
            <td style="padding: 8px 10px; color: #475569;">${escapeHtml(r.paidBy || '-')}</td>
          </tr>
        `).join('');
      } else {
        if (receiptsEmptyEl) {
          receiptsEmptyEl.hidden = false;
          if (summary.receipts.length > 0) {
            receiptsEmptyEl.innerHTML = `No receipts matching &ldquo;<strong>${escapeHtml(receiptsSearchQuery)}</strong>&rdquo; on this date. <button type="button" id="dailyClosingReceiptsClearInlineBtn" class="link-btn" style="background:none; border:none; color:#0e5b4d; text-decoration:underline; cursor:pointer; font-size:11px; padding:0; margin-left:4px;">Clear search</button>`;
            const inlineClearBtn = document.getElementById('dailyClosingReceiptsClearInlineBtn');
            if (inlineClearBtn) {
              inlineClearBtn.addEventListener('click', () => {
                receiptsSearchQuery = '';
                if (receiptsSearchInput) receiptsSearchInput.value = '';
                render();
                if (receiptsSearchInput) receiptsSearchInput.focus();
              });
            }
          } else {
            receiptsEmptyEl.textContent = 'No customer receipts recorded for this date.';
          }
        }
        receiptsTableBody.innerHTML = '';
      }
    }
  }

  function open() {
    activeDateStr = formatDateYmd(new Date());
    receiptsSearchQuery = '';
    if (receiptsSearchInput) receiptsSearchInput.value = '';
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

  // Event wiring
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (closeSecondaryBtn) closeSecondaryBtn.addEventListener('click', close);
  if (openTriggerBtn) openTriggerBtn.addEventListener('click', open);
  if (quickActionBtn) quickActionBtn.addEventListener('click', open);

  // Backdrop dismiss
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  // Date Navigation
  if (dateInput) {
    dateInput.addEventListener('change', () => {
      if (dateInput.value) {
        activeDateStr = dateInput.value;
        render();
      }
    });
  }

  if (prevDateBtn) {
    prevDateBtn.addEventListener('click', () => {
      const d = new Date(`${activeDateStr}T12:00:00+05:00`);
      d.setDate(d.getDate() - 1);
      activeDateStr = formatDateYmd(d);
      render();
    });
  }

  if (nextDateBtn) {
    nextDateBtn.addEventListener('click', () => {
      const d = new Date(`${activeDateStr}T12:00:00+05:00`);
      d.setDate(d.getDate() + 1);
      activeDateStr = formatDateYmd(d);
      render();
    });
  }

  if (todayDateBtn) {
    todayDateBtn.addEventListener('click', () => {
      activeDateStr = formatDateYmd(new Date());
      render();
    });
  }

  // Copy Slip Action
  if (copySlipBtn) {
    copySlipBtn.addEventListener('click', async () => {
      const state = typeof getState === 'function' ? getState() : {};
      const text = generateDailyClosingSlipText(state, new Date(), { selectedDate: activeDateStr });
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          if (onToast) onToast('Daily closing slip copied to clipboard!');
        } else if (onToast) {
          onToast('Clipboard unavailable.');
        }
      } catch {
        if (onToast) onToast('Copy failed.');
      }
    });
  }

  // WhatsApp Action
  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const msg = generateDailyClosingWhatsApp(state, new Date(), { selectedDate: activeDateStr });
      const encoded = encodeURIComponent(msg);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
      if (onToast) onToast('Opened WhatsApp daily closing briefing draft.');
    });
  }

  // Print A4 Action
  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const summary = calculateDailyClosingSummary(state, new Date(), { selectedDate: activeDateStr });
      const html = generateDailyClosingPrintHtml(summary, { format: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      }
    });
  }

  // Print POS Action
  if (printPosBtn) {
    printPosBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const summary = calculateDailyClosingSummary(state, new Date(), { selectedDate: activeDateStr });
      const html = generateDailyClosingPrintHtml(summary, { format: 'pos' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      }
    });
  }

  // Export CSV Action
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : {};
      const summary = calculateDailyClosingSummary(state, new Date(), { selectedDate: activeDateStr });
      const csv = generateDailyClosingCsv(summary);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara_daily_closing_${activeDateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (onToast) onToast(`Exported daily closing CSV for ${activeDateStr}`);
    });
  }

  // Receipts Search and Clear Wiring
  if (receiptsSearchInput) {
    receiptsSearchInput.addEventListener('input', () => {
      receiptsSearchQuery = receiptsSearchInput.value || '';
      render();
    });
  }

  if (receiptsResetBtn) {
    receiptsResetBtn.addEventListener('click', () => {
      receiptsSearchQuery = '';
      if (receiptsSearchInput) receiptsSearchInput.value = '';
      render();
      if (receiptsSearchInput) receiptsSearchInput.focus();
    });
  }

  // Receipts Table Column Sorting Wiring
  if (receiptsHeaders && receiptsHeaders.length) {
    receiptsHeaders.forEach(th => {
      const handleSort = () => {
        const col = th.getAttribute('data-sort-dcr');
        if (!col) return;
        if (receiptsSortCol === col) {
          receiptsSortAsc = !receiptsSortAsc;
        } else {
          receiptsSortCol = col;
          receiptsSortAsc = col === 'amount' ? false : true;
        }
        render();
      };

      th.addEventListener('click', handleSort);
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSort();
        }
      });
    });
  }

  return {
    open,
    close,
    render
  };
}
