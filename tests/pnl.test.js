/**
 * tests/pnl.test.js
 * Comprehensive unit and integration test suite for Income vs Expense (Profit & Loss Statement) Suite.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  calculatePnlAnalytics,
  renderPnlChartSvg,
  renderExpenseCategoryDonutSvg,
  generatePnlCsv,
  generatePnlPrintHtml,
  generatePnlBriefing,
  setupPnlModal,
  PNL_CATEGORY_PALETTE,
  escapeHtml,
  escapeXml,
  formatDateYmd
} from '../dashboard-pnl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMockState() {
  return {
    customers: [
      {
        id: 'cust-1',
        name: 'Muhammad Tariq',
        area: 'Jia Musa',
        bills: [
          {
            month: '2026-09',
            amount: 2500,
            payments: [
              { date: '2026-09-05', amount: 2500, method: 'Cash' }
            ]
          },
          {
            month: '2026-10',
            amount: 2500,
            payments: [
              { date: '2026-10-04', amount: 2500, method: 'JazzCash' }
            ]
          }
        ]
      },
      {
        id: 'cust-2',
        name: 'Waseem Akram',
        area: 'Baradari Road',
        bills: [
          {
            month: '2026-09',
            amount: 3000,
            payments: [
              { date: '2026-09-10', amount: 1500, method: 'Cash' },
              { date: '2026-09-20', amount: 1500, method: 'EasyPaisa' }
            ]
          },
          {
            month: '2026-10',
            amount: 3000,
            payments: [
              { date: '2026-10-06', amount: 3000, method: 'Bank Transfer' }
            ]
          }
        ]
      },
      {
        id: 'cust-3',
        name: 'Rashid Khan',
        area: 'Begum Kot',
        bills: [
          {
            month: '2026-08',
            amount: 1800,
            payments: [
              { date: '2026-08-12', amount: 1800, method: 'Cash' }
            ]
          }
        ]
      }
    ],
    expenses: [
      {
        id: 'exp-1',
        date: '2026-08-15',
        amount: 800,
        category: 'Electricity',
        notes: 'LESCO Office Bill'
      },
      {
        id: 'exp-2',
        date: '2026-09-02',
        amount: 2000,
        category: 'Nayatel bill',
        notes: 'Upstream Transit 100M'
      },
      {
        id: 'exp-3',
        date: '2026-09-15',
        amount: 1200,
        category: 'Electricity',
        notes: 'Generator Diesel'
      },
      {
        id: 'exp-4',
        date: '2026-09-25',
        amount: 500,
        category: 'Tools',
        notes: 'Fiber Cleaver Blades'
      },
      {
        id: 'exp-5',
        date: '2026-10-01',
        amount: 2200,
        category: 'Nayatel bill',
        notes: 'Upstream Transit Oct'
      },
      {
        id: 'exp-6',
        date: '2026-10-10',
        amount: 1500,
        category: 'Salary — Saad',
        notes: 'Staff monthly allowance'
      }
    ]
  };
}

test('calculatePnlAnalytics - calculates accurate 6-month and 12-month multi-period financial trajectory', () => {
  const state = createMockState();
  const refDate = new Date('2026-10-15T12:00:00Z');

  const pnl6 = calculatePnlAnalytics(state, {
    selectedMonth: '2026-10',
    windowMonths: 6,
    referenceDate: refDate
  });

  assert.equal(pnl6.selectedMonth, '2026-10');
  assert.equal(pnl6.windowMonths, 6);
  assert.equal(pnl6.months.length, 6);
  assert.equal(pnl6.months[5], '2026-10');
  assert.equal(pnl6.months[0], '2026-05');

  // Verify monthly calculations
  const oct = pnl6.monthlyData.find(m => m.month === '2026-10');
  assert.ok(oct);
  assert.equal(oct.income, 5500); // 2500 (Tariq) + 3000 (Waseem)
  assert.equal(oct.expenses, 3700); // 2200 (Nayatel) + 1500 (Saad)
  assert.equal(oct.netProfit, 1800);
  assert.equal(oct.profitMargin, 32.7); // (1800/5500)*100
  assert.equal(oct.incomeCount, 2);
  assert.equal(oct.expenseCount, 2);
  assert.equal(oct.status, 'PROFITABLE');

  const sep = pnl6.monthlyData.find(m => m.month === '2026-09');
  assert.ok(sep);
  assert.equal(sep.income, 5500); // 2500 (Tariq) + 1500 + 1500 (Waseem)
  assert.equal(sep.expenses, 3700); // 2000 (Nayatel) + 1200 (Electricity) + 500 (Tools)
  assert.equal(sep.netProfit, 1800);

  const aug = pnl6.monthlyData.find(m => m.month === '2026-08');
  assert.ok(aug);
  assert.equal(aug.income, 1800); // 1800 (Rashid)
  assert.equal(aug.expenses, 800); // 800 (Electricity)
  assert.equal(aug.netProfit, 1000);

  // Summary checks
  assert.equal(pnl6.summary.totalIncome, 12800); // 1800 + 5500 + 5500
  assert.equal(pnl6.summary.totalExpenses, 8200); // 800 + 3700 + 3700
  assert.equal(pnl6.summary.totalNetProfit, 4600);
  assert.equal(pnl6.summary.cumulativeMargin, 35.9);
  assert.equal(pnl6.summary.profitableMonthsCount, 3);
  assert.equal(pnl6.summary.healthStatus, 'HEALTHY_MARGIN');

  // 12-month window check
  const pnl12 = calculatePnlAnalytics(state, {
    selectedMonth: '2026-10',
    windowMonths: 12,
    referenceDate: refDate
  });
  assert.equal(pnl12.windowMonths, 12);
  assert.equal(pnl12.months.length, 12);
  assert.equal(pnl12.months[11], '2026-10');
  assert.equal(pnl12.months[0], '2025-11');
});

test('calculatePnlAnalytics - evaluates expense categories breakdown for selected month', () => {
  const state = createMockState();
  const pnl = calculatePnlAnalytics(state, { selectedMonth: '2026-09' });

  const breakdown = pnl.selectedMonthCategoryBreakdown;
  assert.ok(breakdown);
  assert.equal(breakdown.month, '2026-09');
  assert.equal(breakdown.totalExpenses, 3700);
  assert.equal(breakdown.categories.length, 3);

  // Top category should be Nayatel bill (2000 PKR, 54.1%)
  assert.equal(breakdown.topCategory.category, 'Nayatel bill');
  assert.equal(breakdown.topCategory.amount, 2000);
  assert.equal(breakdown.topCategory.share, 54.1);
  assert.equal(breakdown.topCategory.count, 1);
  assert.equal(breakdown.topCategory.largestItem.notes, 'Upstream Transit 100M');

  // Second category should be Electricity (1200 PKR, 32.4%)
  const elec = breakdown.categories.find(c => c.category === 'Electricity');
  assert.ok(elec);
  assert.equal(elec.amount, 1200);
  assert.equal(elec.share, 32.4);

  // Third category should be Tools (500 PKR, 13.5%)
  const tools = breakdown.categories.find(c => c.category === 'Tools');
  assert.ok(tools);
  assert.equal(tools.amount, 500);
  assert.equal(tools.share, 13.5);
});

test('calculatePnlAnalytics - handles zero income, net deficits, and empty states cleanly', () => {
  // Empty state
  const emptyPnl = calculatePnlAnalytics({}, { selectedMonth: '2026-10' });
  assert.equal(emptyPnl.hasRecords, false);
  assert.equal(emptyPnl.summary.totalIncome, 0);
  assert.equal(emptyPnl.summary.totalExpenses, 0);
  assert.equal(emptyPnl.summary.totalNetProfit, 0);
  assert.equal(emptyPnl.summary.cumulativeMargin, 0);
  assert.equal(emptyPnl.summary.healthStatus, 'NO_DATA');
  assert.equal(emptyPnl.selectedMonthCategoryBreakdown.totalExpenses, 0);
  assert.equal(emptyPnl.selectedMonthCategoryBreakdown.categories.length, 0);

  // Deficit state (Expenses > Income)
  const deficitState = {
    customers: [
      {
        bills: [
          {
            payments: [{ date: '2026-10-05', amount: 1000 }]
          }
        ]
      }
    ],
    expenses: [
      { date: '2026-10-02', amount: 4000, category: 'Nayatel bill' }
    ]
  };

  const deficitPnl = calculatePnlAnalytics(deficitState, { selectedMonth: '2026-10' });
  assert.equal(deficitPnl.summary.totalIncome, 1000);
  assert.equal(deficitPnl.summary.totalExpenses, 4000);
  assert.equal(deficitPnl.summary.totalNetProfit, -3000);
  assert.equal(deficitPnl.summary.cumulativeMargin, -300);
  assert.equal(deficitPnl.summary.healthStatus, 'CASH_DEFICIT');

  const oct = deficitPnl.monthlyData.find(m => m.month === '2026-10');
  assert.equal(oct.status, 'NET_DEFICIT');
  assert.equal(oct.isProfitable, false);
});

test('renderPnlChartSvg - generates valid SVG markup with dual bars and net profit line', () => {
  const state = createMockState();
  const pnlData = calculatePnlAnalytics(state, { selectedMonth: '2026-10' });

  const svg = renderPnlChartSvg(pnlData, { width: 720, height: 320 });
  assert.ok(svg.includes('class="pnl-chart-svg"'));
  assert.ok(svg.includes('class="pnl-bars"'));
  assert.ok(svg.includes('pnl-income-bar'));
  assert.ok(svg.includes('pnl-expense-bar'));
  assert.ok(svg.includes('class="pnl-profit-line"'));
  assert.ok(svg.includes('fill="#10b981"')); // Income bar emerald
  assert.ok(svg.includes('fill="#ef4444"')); // Expense bar red

  // Empty state test
  const emptySvg = renderPnlChartSvg({ monthlyData: [] });
  assert.ok(emptySvg.includes('No financial records in selected window'));
});

test('renderExpenseCategoryDonutSvg - generates pure-vector SVG donut chart', () => {
  const state = createMockState();
  const pnlData = calculatePnlAnalytics(state, { selectedMonth: '2026-09' });

  const svg = renderExpenseCategoryDonutSvg(pnlData.selectedMonthCategoryBreakdown, { width: 300, height: 240 });
  assert.ok(svg.includes('class="pnl-donut-svg"'));
  assert.ok(svg.includes('class="donut-slices"'));
  assert.ok(svg.includes('class="donut-center-kpi"'));
  assert.ok(svg.includes('class="donut-legend"'));
  assert.ok(svg.includes('Nayatel bill'));

  // Empty state test
  const emptyDonut = renderExpenseCategoryDonutSvg({ categories: [] });
  assert.ok(emptyDonut.includes('No expenses recorded for this month'));
});

test('generatePnlCsv - creates RFC-4180 compliant CSV with UTF-8 BOM', () => {
  const state = createMockState();
  const pnlData = calculatePnlAnalytics(state, { selectedMonth: '2026-10', windowMonths: 6 });

  const csv = generatePnlCsv(pnlData);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  assert.ok(csv.includes('"SHAHDARA ISP NETWORK - PROFIT & LOSS STATEMENT (P&L)"'));
  assert.ok(csv.includes('"Total Cash Inflow (Receipts)","PKR 12,800"'));
  assert.ok(csv.includes('"Total Cash Outflow (Expenses)","PKR 8,200"'));
  assert.ok(csv.includes('"Net Cash Profit / Loss","PKR 4,600"'));
  assert.ok(csv.includes('"2026-10","5500","3700","1800","32.7%"'));
  assert.ok(csv.includes('"Nayatel bill","2200","59.5%"'));
});

test('generatePnlPrintHtml - renders Executive A4 and 80mm POS thermal formats', () => {
  const state = createMockState();
  const pnlData = calculatePnlAnalytics(state, { selectedMonth: '2026-10' });

  // A4 layout
  const htmlA4 = generatePnlPrintHtml(pnlData, { format: 'a4', companyName: 'Shahdara Broadband' });
  assert.ok(htmlA4.includes('Executive Profit &amp; Loss Statement (P&amp;L)'));
  assert.ok(htmlA4.includes('Shahdara Broadband'));
  assert.ok(htmlA4.includes('Total Cash Inflow'));
  assert.ok(htmlA4.includes('Accountant / Finance Officer'));
  assert.ok(htmlA4.includes('Managing Director / Owner'));

  // 80mm POS Thermal layout
  const htmlThermal = generatePnlPrintHtml(pnlData, { format: '80mm', companyName: 'Shahdara Broadband' });
  assert.ok(htmlThermal.includes('@page { size: 80mm auto;'));
  assert.ok(htmlThermal.includes('INCOME VS EXPENSE (P&amp;L)'));
  assert.ok(htmlThermal.includes('*** END OF FINANCIAL SLIP ***'));
});

test('generatePnlBriefing - formats bilingual Urdu & English WhatsApp summary text', () => {
  const state = createMockState();
  const pnlData = calculatePnlAnalytics(state, { selectedMonth: '2026-10' });

  const briefing = generatePnlBriefing(pnlData);
  assert.ok(briefing.includes('SHAHDARA ISP - PROFIT & LOSS STATEMENT (P&L)'));
  assert.ok(briefing.includes('Total Cash Inflow: PKR 12,800'));
  assert.ok(briefing.includes('Total Expenses: PKR 8,200'));
  assert.ok(briefing.includes('Net Cash Profit: PKR 4,600'));
  assert.ok(briefing.includes('خلاصہ آمدن و اخراجات'));
});

test('setupPnlModal - handles DOM controller events, modal lifecycle and sorting', () => {
  const mockListeners = {};
  const mockElements = {
    pnlModal: {
      showModal: () => { mockElements.pnlModal.open = true; },
      close: () => { mockElements.pnlModal.open = false; },
      setAttribute: (k, v) => {},
      removeAttribute: (k) => {},
      addEventListener: (evt, cb) => { mockListeners[`modal_${evt}`] = cb; },
      querySelectorAll: (sel) => []
    },
    pnlMonthSelect: {
      value: '2026-10',
      innerHTML: '',
      appendChild: () => {},
      addEventListener: (evt, cb) => { mockListeners[`month_${evt}`] = cb; }
    },
    pnlWindow6Btn: {
      classList: { add: () => {}, remove: () => {} },
      addEventListener: (evt, cb) => { mockListeners[`win6_${evt}`] = cb; }
    },
    pnlWindow12Btn: {
      classList: { add: () => {}, remove: () => {} },
      addEventListener: (evt, cb) => { mockListeners[`win12_${evt}`] = cb; }
    },
    pnlChartContainer: { innerHTML: '', clientWidth: 600 },
    pnlCategoryDonutContainer: { innerHTML: '', clientWidth: 300 },
    pnlTableBody: { innerHTML: '' },
    pnlCategoriesList: { innerHTML: '' },
    pnlEmptyState: { hidden: true },
    pnlKpiIncome: { textContent: '' },
    pnlKpiExpenses: { textContent: '' },
    pnlKpiProfit: { textContent: '', style: {} },
    pnlKpiMargin: { textContent: '' },
    pnlKpiOer: { textContent: '' },
    pnlExportCsvBtn: { addEventListener: (evt, cb) => { mockListeners[`csv_${evt}`] = cb; } },
    pnlPrintA4Btn: { addEventListener: (evt, cb) => { mockListeners[`printA4_${evt}`] = cb; } },
    pnlPrintThermalBtn: { addEventListener: (evt, cb) => { mockListeners[`printThermal_${evt}`] = cb; } },
    pnlCopyBriefingBtn: { addEventListener: (evt, cb) => { mockListeners[`briefing_${evt}`] = cb; } },
    closePnlModalBtn: { addEventListener: (evt, cb) => { mockListeners[`close_${evt}`] = cb; } },
    closePnlSecondaryBtn: { addEventListener: (evt, cb) => { mockListeners[`closeSec_${evt}`] = cb; } },
    quickActionPnl: { addEventListener: (evt, cb) => { mockListeners[`trigger_quick`] = cb; } },
    openPnlModalBtn: { addEventListener: (evt, cb) => { mockListeners[`trigger_open`] = cb; } }
  };

  const origDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => mockElements[id] || null,
    createElement: (tag) => ({ value: '', textContent: '', selected: false }),
    documentElement: { getAttribute: () => 'light' }
  };

  try {
    const state = createMockState();
    let toastMessage = '';
    const controller = setupPnlModal(() => state, { onToast: (msg) => { toastMessage = msg; } });

    assert.ok(controller, 'setupPnlModal should return controller');
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');

    controller.open('2026-10');
    assert.equal(mockElements.pnlModal.open, true);
    assert.ok(mockElements.pnlKpiIncome.textContent.includes('12,800'));

    controller.close();
    assert.equal(mockElements.pnlModal.open, false);
  } finally {
    globalThis.document = origDocument;
  }
});

test('HTML and CSS integrity - verify P&L modal elements, ribbon tile, and styles exist', () => {
  const htmlPath = path.resolve(__dirname, '../index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('id="pnlModal"'), 'index.html must contain pnlModal dialog');
  assert.ok(html.includes('id="quickActionPnl"'), 'index.html must contain quickActionPnl ribbon button');
  assert.ok(html.includes('id="openPnlModalBtn"'), 'index.html must contain openPnlModalBtn chart button');
  assert.ok(html.includes('id="pnlChartContainer"'), 'index.html must contain pnlChartContainer');
  assert.ok(html.includes('id="pnlCategoryDonutContainer"'), 'index.html must contain pnlCategoryDonutContainer');
  assert.ok(html.includes('id="pnlMonthSelect"'), 'index.html must contain pnlMonthSelect');
  assert.ok(html.includes('id="pnlWindow6Btn"'), 'index.html must contain pnlWindow6Btn');
  assert.ok(html.includes('id="pnlWindow12Btn"'), 'index.html must contain pnlWindow12Btn');
  assert.ok(html.includes('id="pnlExportCsvBtn"'), 'index.html must contain pnlExportCsvBtn');

  const cssPath = path.resolve(__dirname, '../styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.pnl-modal'), 'styles.css must contain .pnl-modal rule');
  assert.ok(css.includes('.pnl-kpi-grid'), 'styles.css must contain .pnl-kpi-grid rule');
  assert.ok(css.includes('[data-theme="dark"] .pnl-modal'), 'styles.css must contain dark mode rule for pnl-modal');
});

test('helper functions - escapeHtml and formatDateYmd', () => {
  assert.equal(escapeHtml('<script>alert("1")</script>'), '&lt;script&gt;alert(&quot;1&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeXml('<tag>'), '&lt;tag&gt;');

  const formatted = formatDateYmd(new Date('2026-10-18T10:30:00Z'));
  assert.match(formatted, /^\d{4}-\d{2}-\d{2}$/);
});
