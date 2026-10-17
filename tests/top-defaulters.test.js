import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createInitialState, addCustomer, saveBillMonth, addPayment } from '../core.js';
import {
  calculateTopDefaulters,
  buildDefaulterWhatsAppMessage,
  renderTopDefaultersSvg,
  generateTopDefaultersCsv,
  generateTopDefaultersPrintHtml,
  generateTopDefaultersBriefing,
  setupTopDefaultersModal
} from '../dashboard-top-defaulters.js';
import * as dashboardExports from '../dashboard.js';

function createSampleBillingState() {
  const refDate = new Date('2026-04-01T12:00:00Z');
  let state = createInitialState([]);

  // Customer 1: Critical defaulter - 3 unpaid months, 0 payments
  state = addCustomer(state, 'Muhammad Tariq', refDate, {
    phone: '03001234567',
    mohalla: 'Main Bazaar'
  });
  const c1 = state.customers[state.customers.length - 1];
  c1.area = 'Shahdara Town';
  c1.packageSpeed = '15 Mbps';
  state = saveBillMonth(state, c1.id, { month: '2026-01', dueAmount: 2000, status: 'pending' }, refDate);
  state = saveBillMonth(state, c1.id, { month: '2026-02', dueAmount: 2000, status: 'pending' }, refDate);
  state = saveBillMonth(state, c1.id, { month: '2026-03', dueAmount: 2500, status: 'pending' }, refDate);
  // Total due: 6500, paid: 0, outstanding: 6500, 3 months

  // Customer 2: High defaulter - 2 unpaid months, has partial payment
  state = addCustomer(state, 'Abdul Rehman', refDate, {
    phone: '03217654321',
    mohalla: 'Gulshan Colony'
  });
  const c2 = state.customers[state.customers.length - 1];
  c2.area = 'Baradari';
  c2.packageSpeed = '25 Mbps';
  state = saveBillMonth(state, c2.id, { month: '2026-02', dueAmount: 2500, status: 'pending' }, refDate);
  state = saveBillMonth(state, c2.id, { month: '2026-03', dueAmount: 2500, status: 'pending' }, refDate);
  state = addPayment(state, c2.id, '2026-02', {
    amount: 1000,
    date: '2026-02-15',
    method: 'JazzCash'
  }, refDate);
  // Total due: 5000, paid: 1000, outstanding: 4000, 2 months

  // Customer 3: Moderate defaulter - 1 unpaid month
  state = addCustomer(state, 'Zahid Hussain', refDate, {
    phone: '03339988776',
    mohalla: 'Station Road'
  });
  const c3 = state.customers[state.customers.length - 1];
  c3.area = 'Shahdara Town';
  c3.packageSpeed = '10 Mbps';
  state = saveBillMonth(state, c3.id, { month: '2026-03', dueAmount: 1800, status: 'pending' }, refDate);
  state = addPayment(state, c3.id, '2026-03', {
    amount: 300,
    date: '2026-03-10',
    method: 'Cash'
  }, refDate);
  // Total due: 1800, paid: 300, outstanding: 1500, 1 month

  // Customer 4: Fully paid customer (0 dues)
  state = addCustomer(state, 'Usman Ghani', refDate, {
    phone: '03451122334',
    mohalla: 'Street 4'
  });
  const c4 = state.customers[state.customers.length - 1];
  c4.area = 'Saeed Park';
  c4.packageSpeed = '20 Mbps';
  state = saveBillMonth(state, c4.id, { month: '2026-03', dueAmount: 2200, status: 'pending' }, refDate);
  state = addPayment(state, c4.id, '2026-03', {
    amount: 2200,
    date: '2026-03-05',
    method: 'Easypaisa'
  }, refDate);
  // Total due: 2200, paid: 2200, outstanding: 0

  return state;
}

test('calculateTopDefaulters - calculates accurate rankings, multi-month dues, and portfolio concentration', () => {
  const state = createSampleBillingState();
  const refDate = new Date('2026-04-01T12:00:00Z');

  const result = calculateTopDefaulters(state, { referenceDate: refDate });

  assert.ok(result);
  assert.equal(Array.isArray(result.accounts), true);
  // Only 3 delinquent customers (c4 has 0 balance)
  assert.equal(result.accounts.length, 3);

  // Check ranking (descending dues)
  const [first, second, third] = result.accounts;
  assert.equal(first.name, 'Muhammad Tariq');
  assert.equal(first.rank, 1);
  assert.equal(first.totalOutstanding, 6500);
  assert.equal(first.unpaidMonthsCount, 3);
  assert.equal(first.riskCategory, 'critical');
  assert.equal(first.lastPaymentDate, null);

  assert.equal(second.name, 'Abdul Rehman');
  assert.equal(second.rank, 2);
  assert.equal(second.totalOutstanding, 4000);
  assert.equal(second.unpaidMonthsCount, 2);
  assert.equal(second.riskCategory, 'high');
  assert.equal(second.lastPaymentDate, '2026-02-15');
  assert.equal(second.lastPaymentAmount, 1000);
  assert.equal(second.lastPaymentMethod, 'JazzCash');

  assert.equal(third.name, 'Zahid Hussain');
  assert.equal(third.rank, 3);
  assert.equal(third.totalOutstanding, 1500);
  assert.equal(third.unpaidMonthsCount, 1);
  assert.equal(third.riskCategory, 'moderate');
  assert.equal(third.lastPaymentDate, '2026-03-10');

  // Verify Metrics
  const { metrics } = result;
  assert.equal(metrics.totalDefaultersCount, 3);
  assert.equal(metrics.topDefaultersCount, 3);
  assert.equal(metrics.topDefaultersDues, 12000); // 6500 + 4000 + 1500
  assert.equal(metrics.totalReceivablesDues, 12000);
  assert.equal(metrics.topConcentrationPercent, 100);
  assert.equal(metrics.criticalDefaultersCount, 1);
  assert.equal(metrics.maxSingleDues, 6500);
  assert.equal(metrics.averageDues, 4000);

  // Verify Area Summary
  assert.ok(result.summaryByArea['Shahdara Town']);
  assert.equal(result.summaryByArea['Shahdara Town'].accounts, 2);
  assert.equal(result.summaryByArea['Shahdara Town'].totalDues, 8000);

  // Verify Risk Summary
  assert.equal(result.summaryByRisk.critical.count, 1);
  assert.equal(result.summaryByRisk.high.count, 1);
  assert.equal(result.summaryByRisk.moderate.count, 1);
});

test('calculateTopDefaulters - filters by area, search, riskLevel, and limit', () => {
  const state = createSampleBillingState();
  const refDate = new Date('2026-04-01T12:00:00Z');

  // Filter by Area: Baradari
  const areaFilter = calculateTopDefaulters(state, {
    area: 'Baradari',
    referenceDate: refDate
  });
  assert.equal(areaFilter.accounts.length, 1);
  assert.equal(areaFilter.accounts[0].name, 'Abdul Rehman');

  // Filter by Search: 'Tariq'
  const searchFilter = calculateTopDefaulters(state, {
    search: 'Tariq',
    referenceDate: refDate
  });
  assert.equal(searchFilter.accounts.length, 1);
  assert.equal(searchFilter.accounts[0].name, 'Muhammad Tariq');

  // Filter by Search Phone: '0333'
  const phoneFilter = calculateTopDefaulters(state, {
    search: '0333',
    referenceDate: refDate
  });
  assert.equal(phoneFilter.accounts.length, 1);
  assert.equal(phoneFilter.accounts[0].name, 'Zahid Hussain');

  // Filter by Risk Level: 'critical'
  const criticalFilter = calculateTopDefaulters(state, {
    riskLevel: 'critical',
    referenceDate: refDate
  });
  assert.equal(criticalFilter.accounts.length, 1);
  assert.equal(criticalFilter.accounts[0].name, 'Muhammad Tariq');

  // Filter by Limit: 2
  const limitFilter = calculateTopDefaulters(state, {
    limit: 2,
    referenceDate: refDate
  });
  assert.equal(limitFilter.accounts.length, 2);
  assert.equal(limitFilter.accounts[0].name, 'Muhammad Tariq');
  assert.equal(limitFilter.accounts[1].name, 'Abdul Rehman');
  assert.equal(limitFilter.metrics.topDefaultersDues, 10500);
  assert.equal(limitFilter.metrics.totalReceivablesDues, 12000);
  // (10500 / 12000) * 100 = 87.5% -> rounded to 87.5 or 88
  assert.ok(limitFilter.metrics.topConcentrationPercent >= 87);
});

test('calculateTopDefaulters - handles empty state and zero delinquency safely', () => {
  const emptyState = createInitialState([]);
  const resEmpty = calculateTopDefaulters(emptyState);
  assert.equal(resEmpty.accounts.length, 0);
  assert.equal(resEmpty.metrics.topDefaultersDues, 0);
  assert.equal(resEmpty.metrics.topConcentrationPercent, 0);

  // State with customers but all zero balance
  const refDate = new Date('2026-04-01T12:00:00Z');
  let statePaid = createInitialState([]);
  statePaid = addCustomer(statePaid, 'Ali', refDate, { phone: '03001112233' });
  const cid = statePaid.customers[0].id;
  statePaid = saveBillMonth(statePaid, cid, { month: '2026-03', dueAmount: 1500, status: 'pending' }, refDate);
  statePaid = addPayment(statePaid, cid, '2026-03', { amount: 1500, date: '2026-03-01', method: 'Cash' }, refDate);

  const resPaid = calculateTopDefaulters(statePaid, { referenceDate: refDate });
  assert.equal(resPaid.accounts.length, 0);
  assert.equal(resPaid.metrics.totalReceivablesDues, 0);
});

test('buildDefaulterWhatsAppMessage - formats draft reminder notice in Urdu and English', () => {
  const state = createSampleBillingState();
  const data = calculateTopDefaulters(state);
  const row = data.accounts[0];
  const cust = state.customers.find(c => c.id === row.id);

  const msg = buildDefaulterWhatsAppMessage({
    customer: cust,
    defaulterRow: row,
    customNote: 'Please contact billing desk before Monday.'
  });

  assert.ok(msg.includes('SHAH DARA BROADBAND'));
  assert.ok(msg.includes('Muhammad Tariq'));
  assert.ok(msg.includes('PKR 6,500'));
  assert.ok(msg.includes('3 months'));
  assert.ok(msg.includes('JazzCash'));
  assert.ok(msg.includes('Please contact billing desk before Monday.'));
  assert.ok(msg.includes('بل ادائیگی کا حتمی نوٹس'));
});

test('renderTopDefaultersSvg - generates clean vector SVG with concentration badge and rows', () => {
  const state = createSampleBillingState();
  const data = calculateTopDefaulters(state);

  const svg = renderTopDefaultersSvg(data);

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('Top Defaulters Debt Concentration'));
  assert.ok(svg.includes('linearGradient id="defaulterCritGrad"'));
  assert.ok(svg.includes('Muhammad Tariq'));
  assert.ok(svg.includes('PKR 6,500'));
  assert.ok(svg.includes('Top Debt:'));

  // Handles empty data cleanly
  const emptySvg = renderTopDefaultersSvg({ accounts: [], metrics: {} });
  assert.ok(emptySvg.includes('No delinquent accounts on record'));
});

test('generateTopDefaultersCsv - creates RFC-4180 compliant CSV with UTF-8 BOM', () => {
  const state = createSampleBillingState();
  const data = calculateTopDefaulters(state);

  const csv = generateTopDefaultersCsv(data);

  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('Rank,Customer Number,Customer Name,Phone,Area,Mohalla'));
  assert.ok(csv.includes('Muhammad Tariq'));
  assert.ok(csv.includes('Shahdara Town'));
  assert.ok(csv.includes('6500'));
  assert.ok(csv.includes('Abdul Rehman'));
  assert.ok(csv.includes('JazzCash'));
});

test('generateTopDefaultersPrintHtml - supports standard A4 and 80mm thermal formats', () => {
  const state = createSampleBillingState();
  const data = calculateTopDefaulters(state);

  // A4 format
  const a4Html = generateTopDefaultersPrintHtml({ defaulterData: data, format: 'a4' });
  assert.ok(a4Html.includes('<!DOCTYPE html>'));
  assert.ok(a4Html.includes('Top Defaulters & High-Risk Receivables Recovery Manifest'));
  assert.ok(a4Html.includes('Muhammad Tariq'));
  assert.ok(a4Html.includes('Collector Assigned'));
  assert.ok(a4Html.includes('Owner Authorization'));

  // Thermal format
  const thermalHtml = generateTopDefaultersPrintHtml({ defaulterData: data, format: 'thermal' });
  assert.ok(thermalHtml.includes('<!DOCTYPE html>'));
  assert.ok(thermalHtml.includes('80mm'));
  assert.ok(thermalHtml.includes('TOP DEFAULTERS COLLECTION MANIFEST'));
  assert.ok(thermalHtml.includes('Muhammad Tariq'));
  assert.ok(thermalHtml.includes('PKR 6,500'));
});

test('generateTopDefaultersBriefing - produces concise executive briefing', () => {
  const state = createSampleBillingState();
  const data = calculateTopDefaulters(state);

  const briefing = generateTopDefaultersBriefing(data, new Date('2026-04-01'));

  assert.ok(briefing.includes('SHAHDARA BROADBAND - TOP DEFAULTERS EXECUTIVE BRIEFING'));
  assert.ok(briefing.includes('Total Delinquent Accounts: 3'));
  assert.ok(briefing.includes('Total Outstanding Receivables: PKR 12,000'));
  assert.ok(briefing.includes('Muhammad Tariq'));
  assert.ok(briefing.includes('Immediate Action:'));
});

test('setupTopDefaultersModal - handles simulated DOM controller events', async () => {
  const state = createSampleBillingState();

  // Mock DOM elements
  const mockElements = {
    topDefaultersModal: {
      showModal: () => { mockElements.topDefaultersModal.open = true; },
      close: () => { mockElements.topDefaultersModal.open = false; },
      open: false,
      hidden: true
    },
    dashboardOpenTopDefaultersBtn: { addEventListener: (evt, cb) => { mockElements._openCb = cb; } },
    closeTopDefaultersModalBtn: { addEventListener: (evt, cb) => { mockElements._closeCb = cb; } },
    closeSecondaryBtn: { addEventListener: () => {} },
    topDefaultersSearchInput: { value: '', addEventListener: (evt, cb) => { mockElements._searchCb = cb; } },
    topDefaultersAreaSelect: {
      value: 'all',
      options: [{ value: 'all', textContent: 'All Areas' }],
      appendChild: opt => mockElements.topDefaultersAreaSelect.options.push(opt),
      addEventListener: (evt, cb) => { mockElements._areaCb = cb; }
    },
    topDefaultersLimitSelect: { value: '20', addEventListener: (evt, cb) => { mockElements._limitCb = cb; } },
    topDefaultersRiskSelect: { value: 'all', addEventListener: (evt, cb) => { mockElements._riskCb = cb; } },
    topDefaultersKpiTopDues: { textContent: '' },
    topDefaultersKpiConcentration: { textContent: '' },
    topDefaultersKpiTotalDebt: { textContent: '' },
    topDefaultersKpiCriticalCount: { textContent: '' },
    topDefaultersTableBody: {
      innerHTML: '',
      addEventListener: (evt, cb) => { mockElements._tableClickCb = cb; }
    },
    topDefaultersEmptyState: { hidden: true },
    topDefaultersChartContainer: { innerHTML: '' },
    topDefaultersExportCsvBtn: { addEventListener: (evt, cb) => { mockElements._csvCb = cb; } },
    topDefaultersPrintA4Btn: { addEventListener: (evt, cb) => { mockElements._printA4Cb = cb; } },
    topDefaultersPrintThermalBtn: { addEventListener: (evt, cb) => { mockElements._printThermalCb = cb; } },
    topDefaultersCopyBriefingBtn: { addEventListener: (evt, cb) => { mockElements._copyBriefingCb = cb; } }
  };

  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  let toastMsg = '';
  let filteredCustomerId = null;
  let clipboardText = '';

  try {
    globalThis.document = {
      getElementById: (id) => mockElements[id] || null,
      createElement: (tag) => ({ tag, options: [], appendChild: () => {} })
    };

    let openedUrl = '';
    globalThis.window = {
      open: (url) => { openedUrl = url; return { document: { write: () => {}, close: () => {} }, focus: () => {}, print: () => {} }; }
    };

    const mockClipboard = {
      writeText: async (txt) => { clipboardText = txt; }
    };

    const controller = setupTopDefaultersModal(() => state, {
      onFilterCustomer: (id) => { filteredCustomerId = id; },
      onToast: (msg) => { toastMsg = msg; },
      clipboard: mockClipboard
    });

    assert.ok(controller);
    assert.equal(typeof controller.open, 'function');
    assert.equal(typeof controller.close, 'function');
    assert.equal(typeof controller.refresh, 'function');

    // 1. Open modal
    controller.open();
    assert.equal(mockElements.topDefaultersModal.open, true);
    assert.equal(mockElements.topDefaultersKpiTopDues.textContent, 'PKR 12,000');
    assert.equal(mockElements.topDefaultersKpiConcentration.textContent, '100%');
    assert.equal(mockElements.topDefaultersKpiCriticalCount.textContent, 3);
    assert.ok(mockElements.topDefaultersChartContainer.innerHTML.includes('<svg'));
    assert.ok(mockElements.topDefaultersTableBody.innerHTML.includes('Muhammad Tariq'));

    // 2. Test search filter trigger
    mockElements.topDefaultersSearchInput.value = 'Tariq';
    mockElements._searchCb();
    assert.ok(mockElements.topDefaultersTableBody.innerHTML.includes('Muhammad Tariq'));
    assert.ok(!mockElements.topDefaultersTableBody.innerHTML.includes('Abdul Rehman'));

    // Reset search
    mockElements.topDefaultersSearchInput.value = '';
    mockElements._searchCb();

    // 3. Test View Profile click
    const c1Id = state.customers[0].id;
    mockElements._tableClickCb({
      target: {
        closest: (sel) => sel === '.defaulter-view-btn' ? { dataset: { custId: c1Id } } : null
      }
    });
    assert.equal(filteredCustomerId, c1Id);

    // 4. Test WhatsApp reminder click
    mockElements._tableClickCb({
      target: {
        closest: (sel) => sel === '.defaulter-wa-btn' ? { dataset: { custId: c1Id } } : null
      }
    });
    assert.ok(openedUrl.includes('api.whatsapp.com') || openedUrl.includes('wa.me'));

    // 5. Test Copy Briefing
    await mockElements._copyBriefingCb();
    assert.ok(clipboardText.includes('SHAHDARA BROADBAND - TOP DEFAULTERS EXECUTIVE BRIEFING'));
    assert.equal(toastMsg, 'Executive defaulters briefing copied to clipboard!');

    // 6. Close modal
    controller.close();
    assert.equal(mockElements.topDefaultersModal.open, false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test('HTML and CSS - verify top defaulters modal elements and styles exist', () => {
  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('id="topDefaultersModal"'));
  assert.ok(html.includes('id="quickActionTopDefaulters"'));
  assert.ok(html.includes('id="dashboardOpenTopDefaultersBtn"'));
  assert.ok(html.includes('id="topDefaultersSearchInput"'));
  assert.ok(html.includes('id="topDefaultersAreaSelect"'));
  assert.ok(html.includes('id="topDefaultersLimitSelect"'));
  assert.ok(html.includes('id="topDefaultersRiskSelect"'));
  assert.ok(html.includes('id="topDefaultersKpiTopDues"'));
  assert.ok(html.includes('id="topDefaultersChartContainer"'));
  assert.ok(html.includes('id="topDefaultersTableBody"'));
  assert.ok(html.includes('id="topDefaultersExportCsvBtn"'));
  assert.ok(html.includes('id="topDefaultersPrintA4Btn"'));
  assert.ok(html.includes('id="topDefaultersPrintThermalBtn"'));
  assert.ok(html.includes('id="topDefaultersCopyBriefingBtn"'));

  const css = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(css.includes('.top-defaulters-modal'));
  assert.ok(css.includes('.defaulters-kpi-grid'));
  assert.ok(css.includes('.defaulters-chart-wrapper'));
  assert.ok(css.includes('.unpaid-month-tag'));
  assert.ok(css.includes('.defaulter-wa-btn'));
  assert.ok(css.includes('[data-theme="dark"] .top-defaulters-modal'));
});

test('dashboard.js - re-exports top defaulters functions correctly', () => {
  assert.equal(typeof dashboardExports.calculateTopDefaulters, 'function');
  assert.equal(typeof dashboardExports.buildDefaulterWhatsAppMessage, 'function');
  assert.equal(typeof dashboardExports.renderTopDefaultersSvg, 'function');
  assert.equal(typeof dashboardExports.generateTopDefaultersCsv, 'function');
  assert.equal(typeof dashboardExports.generateTopDefaultersPrintHtml, 'function');
  assert.equal(typeof dashboardExports.generateTopDefaultersBriefing, 'function');
  assert.equal(typeof dashboardExports.setupTopDefaultersModal, 'function');
});
