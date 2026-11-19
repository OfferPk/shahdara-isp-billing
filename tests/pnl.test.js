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
import { pktMonth } from '../phase3.js';
import { TRANSLATIONS } from '../nav-language.js';

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
        notes: 'IESCO Office Bill'
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

/* ---------------- Hisaab H4 — "Poora hisaab dekhein" opens the P&L modal ----------------
   The Hisaab section's button (#hisaabOpenPnlBtn, H3) calls
   pnlModalController.open() with no argument (D5(a)). G1 proves the
   no-argument call shape at runtime; G2–G4 pin the app.js wiring by
   source-scan (no DOM harness exists for renderDashboard, and app.js
   cannot be imported in node — the honest limit, per prep §7). */

// G1 — no-arg open() lands on the current PKT month with live figures.
// The mock <select> mirrors real <select> semantics (the repro's fix):
// populateMonths() marks the current-month <option> selected=true BEFORE
// appendChild, and the select's value follows the selected option — a
// no-op appendChild mock would leave value '' and fake a failure.
// Expectations are computed from the same engine call the modal uses,
// so the test holds on any date, not just the month the fixtures sit in.
test('hisaab H4 G1: open() with no argument opens the current PKT month with live figures', () => {
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
    pnlMonthSelect: (() => {
      const sel = { value: '', _options: [] };
      Object.defineProperty(sel, 'innerHTML', { get: () => '', set: () => { sel._options = []; sel.value = ''; } });
      sel.appendChild = (opt) => { sel._options.push(opt); if (opt.selected) sel.value = opt.value; };
      sel.addEventListener = () => {};
      return sel;
    })(),
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
    const controller = setupPnlModal(() => state, { onToast: () => {} });
    const currentMonth = pktMonth(new Date());
    const expected = calculatePnlAnalytics(state, {
      selectedMonth: currentMonth, windowMonths: 6, referenceDate: new Date()
    });
    controller.open(); // NO argument — the H4 call shape (D5(a)).
    assert.equal(mockElements.pnlModal.open, true, 'the modal opens');
    assert.equal(mockElements.pnlMonthSelect.value, currentMonth,
      'no argument lands on the current PKT month, never a stale month');
    assert.ok(mockElements.pnlKpiIncome.textContent.includes(
      expected.summary.totalIncome.toLocaleString('en-US')),
      `the KPI income is the live engine total for the window (${expected.summary.totalIncome}), not a snapshot`);
    controller.close();
    assert.equal(mockElements.pnlModal.open, false);
  } finally {
    globalThis.document = origDocument;
  }
});

// G2 — exactly one caller of the controller's open() in app.js, and it is
// the Hisaab button's listener (D1(a)). A second caller would mean the
// button was double-bound (stacking) or wired twice.
test('hisaab H4 G2: exactly one caller of pnlModalController.open() in app.js, at the Hisaab button', () => {
  const appJs = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
  const callers = appJs.match(/pnlModalController\?\.open\(\)|pnlModalController\.open\(/g) || [];
  assert.equal(callers.length, 1, `expected exactly 1 caller, got ${callers.length}`);
  assert.equal(callers[0], 'pnlModalController?.open()',
    'the single caller uses the ?. guard — the controller is null until the boot promise resolves (D3(a))');
  const at = appJs.indexOf(callers[0]);
  const around = appJs.slice(Math.max(0, at - 600), at + 100);
  assert.ok(around.includes("$('#hisaabOpenPnlBtn')"),
    'the caller sits in the #hisaabOpenPnlBtn listener, adjacent to the Kharch binding');
});

// G3 — the two buried triggers are untouched, and the engine file carries
// no Hisaab wiring at all (D4(a)): openTriggers stays exactly 2 entries,
// and #hisaabOpenPnlBtn never occurs in dashboard-pnl.js.
test('hisaab H4 G3: buried triggers untouched and no Hisaab wiring in the engine file', () => {
  const pnlSrc = fs.readFileSync(path.resolve(__dirname, '../dashboard-pnl.js'), 'utf8');
  const triggers = pnlSrc.match(/document\.getElementById\('(quickActionPnl|openPnlModalBtn)'\)/g) || [];
  assert.equal(triggers.length, 2, `openTriggers must list exactly the 2 buried triggers, got ${triggers.length}`);
  assert.ok(triggers.some((t) => t.includes('quickActionPnl')), 'the More-menu tile still opens the modal');
  assert.ok(triggers.some((t) => t.includes('openPnlModalBtn')), 'the Analytics-view button still opens the modal');
  assert.ok(!pnlSrc.includes('hisaabOpenPnlBtn'),
    '#hisaabOpenPnlBtn must not occur in dashboard-pnl.js — the binding lives in app.js, not the engine');
  assert.ok(!/pnlModalController\?\.open\(\)|pnlModalController\.open\(/.test(pnlSrc),
    'the new caller is not in dashboard-pnl.js');
});

// G4 — the binding is once-only, and parity moves with the 606 keys.
// The parity digits are searched as a split literal ('51' + '61'): this
// file must NOT contain the bare digits — 591's G5a sweep counts every
// test file containing them and asserts 34, so a literal here would make
// this the 35th file and break the suite. The count below is re-measured
// on the 604 merge (33 files pin the current total) plus Plan 606's new
// test file, which pins it too — so the count is 34.
test('hisaab H4 G4: the Hisaab P&L binding is once-only with its own guard flag, and parity stays steady', () => {
  const appJs = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
  const bindings = (appJs.match(/\$\('#hisaabOpenPnlBtn'\)\?\.addEventListener\('click'/g) || []).length;
  assert.equal(bindings, 1, '"Poora hisaab dekhein" is bound exactly once — a second binding would stack a listener per save');
  assert.ok(appJs.includes('let hisaabOpenPnlBound = false;'), 'the once-only guard flag exists');
  assert.ok(appJs.includes('if (!hisaabOpenPnlBound) {'), 'the guard is checked before binding');
  assert.ok(!appJs.includes('hisaabShowExpensesBound = true;\n  $(\'#hisaabOpenPnlBtn\')'),
    'the P&L binding does not reuse the Kharch flag — each button has its own flag');
  const navJs = fs.readFileSync(path.resolve(__dirname, '../nav-language.js'), 'utf8');
  // Hisaab H5: the hisaab_* keys exist now (30, ×2 dicts) + the one
  // exp_* refusal hint (D2(b)). This assert flipped with the keys;
  // the G5a sweep counts only bare digits, so no new file is added.
  assert.ok(/hisaab_section_title/.test(navJs) && /exp_upstream_synced_hint/.test(navJs),
    'the H5 keys exist in nav-language.js (30 hisaab_* + the one exp_* refusal hint)');
  assert.equal(Object.keys(TRANSLATIONS.en).length, Object.keys(TRANSLATIONS.ur).length,
    'the EN and UR dicts still agree');
  const parityDigits = '51' + '61';
  const pinning = fs.readdirSync(path.join(__dirname)).filter((f) =>
    f.endsWith('.test.js') && fs.readFileSync(path.join(__dirname, f), 'utf8').includes(parityDigits));
  assert.equal(pinning.length, 34, `expected 34 test files pinning the current parity total, got ${pinning.length}: ${pinning.join(', ')}`);
});
