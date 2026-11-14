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

  // Plan T (intentional change): the area filter now uses the shared
  // canonical-mohalla rule (mohalla || area), the same rule the
  // Customers list uses. Abdul Rehman's mohalla is 'Gulshan Colony'
  // and his saved area is 'Baradari', so the 'Gulshan Colony' filter
  // finds him and the 'Baradari' filter no longer does.
  const areaFilter = calculateTopDefaulters(state, {
    area: 'Gulshan Colony',
    referenceDate: refDate
  });
  assert.equal(areaFilter.accounts.length, 1);
  assert.equal(areaFilter.accounts[0].name, 'Abdul Rehman');
  const oldAreaFilter = calculateTopDefaulters(state, {
    area: 'Baradari',
    referenceDate: refDate
  });
  assert.equal(oldAreaFilter.accounts.length, 0);

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

  // Top Defaulters polish (2026-11-13): the chart is a narrower 380-wide
  // viewBox so labels render legibly on a phone, with a 1-line risk
  // legend between the last bar and the telemetry divider. The risk
  // colours come from tokens.css (--td-risk-*) via inline style — var()
  // is invalid in SVG presentation attributes, so style="" is required
  // and raw hex must NOT appear in the amount/gradient/legend fills.
  assert.ok(svg.includes('viewBox="0 0 380 '), 'chart viewBox must be 380 wide');
  assert.ok(svg.includes('Critical (3m+ / 60d+)'), 'legend must name the Critical tier');
  assert.ok(svg.includes('High (2m / 30d+)'), 'legend must name the High tier');
  assert.ok(svg.includes('Moderate (1m)'), 'legend must name the Moderate tier');
  assert.ok(svg.includes('var(--td-risk-critical)'), 'critical risk colour must come from the token');
  assert.ok(svg.includes('var(--td-risk-high)'), 'high risk colour must come from the token');
  assert.ok(svg.includes('var(--td-risk-moderate)'), 'moderate risk colour must come from the token');
  assert.ok(!svg.includes('#10b981'), 'moderate bars must not stay green');
  assert.ok(!svg.includes('#059669'), 'moderate gradient must not stay green');
  // The Crit/High gradient stops stay raw hex by design (they sit
  // outside both hex tests) — the token rule pins the amount text, the
  // legend swatches and the telemetry tspan, which used fill="#…".
  assert.ok(!svg.includes('fill="#ef4444"'), 'amount/telemetry fills must use the critical token, not raw hex');
  assert.ok(!svg.includes('fill="#f97316"'), 'amount fills must use the high token, not raw hex');
  assert.ok(!svg.includes('fill="#10b981"'), 'amount fills must use the moderate token, not raw hex');

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
    // Top Defaulters Modal Fix item 1 (2026-11-13): the wide table is
    // gone — the list host is now the card list, not a tbody.
    topDefaultersList: {
      innerHTML: '',
      addEventListener: (evt, cb) => { mockElements._listClickCb = cb; }
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
    assert.ok(mockElements.topDefaultersList.innerHTML.includes('Muhammad Tariq'));

    // 2. Test search filter trigger
    mockElements.topDefaultersSearchInput.value = 'Tariq';
    mockElements._searchCb();
    assert.ok(mockElements.topDefaultersList.innerHTML.includes('Muhammad Tariq'));
    assert.ok(!mockElements.topDefaultersList.innerHTML.includes('Abdul Rehman'));

    // Reset search
    mockElements.topDefaultersSearchInput.value = '';
    mockElements._searchCb();

    // 3. Test View Profile click
    const c1Id = state.customers[0].id;
    mockElements._listClickCb({
      target: {
        closest: (sel) => sel === '.defaulter-view-btn' ? { dataset: { custId: c1Id } } : null
      }
    });
    assert.equal(filteredCustomerId, c1Id);

    // 4. Test Polite Reminder click — opens the 'overdue' wa.me draft.
    // Top Defaulters Modal Fix item 1 (2026-11-13): the generic
    // WhatsApp button is replaced by the two stage buttons.
    mockElements._listClickCb({
      target: {
        closest: (sel) => sel === '.defaulter-reminder-polite' ? { dataset: { custId: c1Id } } : null
      }
    });
    assert.ok(openedUrl.includes('api.whatsapp.com') || openedUrl.includes('wa.me'));
    assert.ok(decodeURIComponent(openedUrl).includes('Overdue Payment Notice'), 'Polite Reminder opens the overdue draft');

    // 5. Test Final Notice click — opens the 'disconnection' wa.me draft.
    mockElements._listClickCb({
      target: {
        closest: (sel) => sel === '.defaulter-reminder-final' ? { dataset: { custId: c1Id } } : null
      }
    });
    assert.ok(openedUrl.includes('api.whatsapp.com') || openedUrl.includes('wa.me'));
    assert.ok(decodeURIComponent(openedUrl).includes('FINAL NOTICE'), 'Final Notice opens the final-notice draft');

    // 6. Test Copy Briefing
    await mockElements._copyBriefingCb();
    assert.ok(clipboardText.includes('SHAHDARA BROADBAND - TOP DEFAULTERS EXECUTIVE BRIEFING'));
    assert.equal(toastMsg, 'Executive defaulters briefing copied to clipboard!');

    // 7. Close modal
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
  assert.ok(html.includes('id="topDefaultersWaadaSelect"'));
  assert.ok(html.includes('id="topDefaultersKpiTopDues"'));
  assert.ok(html.includes('id="topDefaultersChartContainer"'));
  // Top Defaulters Modal Fix item 1 (2026-11-13): the wide table is
  // gone — the list host is the card list, not a tbody.
  assert.ok(html.includes('id="topDefaultersList"'));
  assert.ok(html.includes('id="topDefaultersExportCsvBtn"'));
  assert.ok(html.includes('id="topDefaultersPrintA4Btn"'));
  assert.ok(html.includes('id="topDefaultersPrintThermalBtn"'));
  assert.ok(html.includes('id="topDefaultersCopyBriefingBtn"'));
  // Top Defaulters Modal Fix item 2 (2026-11-13): the header close is
  // the clean neutral ✕ (shared .close-btn class + Close aria-label,
  // scoped .td-close-btn hook) — the bottom green Close is gone.
  assert.match(html, /<button id="closeTopDefaultersModalBtn" class="close-btn td-close-btn"[^>]*>✕<\/button>/);
  assert.ok(!html.includes('id="closeTopDefaultersSecondaryBtn"'), 'bottom Close must be removed');

  const css = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(css.includes('.top-defaulters-modal'));
  assert.ok(css.includes('.defaulters-kpi-grid'));
  assert.ok(css.includes('.defaulters-chart-wrapper'));
  assert.ok(css.includes('.unpaid-month-tag'));
  // Top Defaulters Modal Fix item 1 (2026-11-13): the generic WhatsApp
  // button class is gone with the table — the card's action classes
  // pin the new markup instead.
  assert.ok(css.includes('.defaulter-card'));
  assert.ok(css.includes('.defaulter-reminder-polite'));
  assert.ok(css.includes('.defaulter-reminder-final'));
  assert.ok(css.includes('.defaulter-collect-btn'));
  assert.ok(css.includes('.defaulter-filter-grid'));
  assert.ok(css.includes('.defaulters-action-group'));
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

// Dues-list tile live fix (2026-11-12): a <dialog> throws
// InvalidStateError when showModal() is called while it is already
// open, so a second tap on the Dues list tile (or a tap while the
// modal was still up from another path) made the tile look dead.
// REPRO: this test FAILS at base (the second open() throws) and
// passes with the fix (re-open is a no-op that re-renders the list).
test('setupTopDefaultersModal - re-opening an already-open dialog does not throw', () => {
  const state = createSampleBillingState();

  // A mock <dialog> that behaves like a real one: showModal() throws
  // when the dialog is already open.
  const mockModal = {
    open: false,
    hidden: true,
    showModalCalls: 0,
    showModal() {
      this.showModalCalls++;
      if (this.open) throw new Error("Failed to execute 'showModal' on 'HTMLDialogElement': The element already has an 'open' attribute, and therefore cannot be opened.");
      this.open = true;
    },
    close() { this.open = false; }
  };
  const stub = (extra = {}) => ({ addEventListener: () => {}, ...extra });
  const mockElements = {
    topDefaultersModal: mockModal,
    dashboardOpenTopDefaultersBtn: { addEventListener: (evt, cb) => { mockElements._openCb = cb; } },
    quickActionTopDefaulters: { addEventListener: (evt, cb) => { mockElements._quickOpenCb = cb; } },
    closeTopDefaultersModalBtn: stub(),
    topDefaultersSearchInput: stub({ value: '' }),
    topDefaultersAreaSelect: stub({ value: 'all', options: [{ value: 'all' }], appendChild: () => {} }),
    topDefaultersLimitSelect: stub({ value: '20' }),
    topDefaultersRiskSelect: stub({ value: 'all' }),
    topDefaultersWaadaSelect: stub({ value: 'all' }),
    topDefaultersKpiTopDues: { textContent: '' },
    topDefaultersKpiConcentration: { textContent: '' },
    topDefaultersKpiTotalDebt: { textContent: '' },
    topDefaultersKpiCriticalCount: { textContent: '' },
    topDefaultersList: { innerHTML: '', addEventListener: () => {} },
    topDefaultersEmptyState: { hidden: true },
    topDefaultersChartContainer: { innerHTML: '' },
    topDefaultersExportCsvBtn: stub(),
    topDefaultersPrintA4Btn: stub(),
    topDefaultersPrintThermalBtn: stub(),
    topDefaultersCopyBriefingBtn: stub(),
    // syncLockDueBtn / syncHideContactedBtn (called by renderContent)
    // toggle a class and an aria-pressed attribute on these buttons.
    topDefaultersLockDueBtn: stub({ textContent: '', classList: { toggle: () => {} }, setAttribute: () => {} }),
    topDefaultersPrelockNoticeBtn: stub(),
    topDefaultersHideContactedBtn: stub({ classList: { toggle: () => {} }, setAttribute: () => {} }),
    topDefaultersMikrotikLockBtn: stub(),
    topDefaultersMikrotikRestoreBtn: stub(),
    topDefaultersZoneSheetBtn: stub(),
    topDefaultersMikrotikCopyBtn: stub()
  };

  const originalDocument = globalThis.document;
  try {
    globalThis.document = {
      getElementById: (id) => mockElements[id] || null,
      createElement: (tag) => ({ tag, options: [], appendChild: () => {} })
    };

    const controller = setupTopDefaultersModal(() => state, {});
    assert.ok(controller);

    // 1. First open: shows the modal and renders the dues list.
    controller.open();
    assert.equal(mockModal.open, true);
    assert.equal(mockModal.showModalCalls, 1);
    assert.ok(mockElements.topDefaultersList.innerHTML.includes('Muhammad Tariq'));

    // 2. Second open while already open: must NOT throw, must NOT call
    // showModal again, and must still re-render the list.
    assert.doesNotThrow(() => controller.open());
    assert.equal(mockModal.showModalCalls, 1);
    assert.ok(mockElements.topDefaultersList.innerHTML.includes('Muhammad Tariq'));

    // 3. The open-trigger buttons are safe on a second click too.
    assert.doesNotThrow(() => mockElements._openCb());
    assert.doesNotThrow(() => mockElements._quickOpenCb());
    assert.equal(mockModal.showModalCalls, 1);

    // 4. After closing, opening again works and calls showModal once more.
    controller.close();
    assert.equal(mockModal.open, false);
    controller.open();
    assert.equal(mockModal.showModalCalls, 2);
    assert.ok(mockElements.topDefaultersList.innerHTML.includes('Muhammad Tariq'));
  } finally {
    globalThis.document = originalDocument;
  }
});

// Top Defaulters Modal Fix (2026-11-13): the wide 8-column table is
// replaced by full-width stacked cards, the 4 filter selects sit in a
// 2×2 grid, the bottom green Close is removed (the header ✕ is the
// only close), and the ten action buttons are grouped under 3
// mini-labels in a compact 2-column grid. This test replaces the old
// 'table first, actions collapsed' pin: the card list is the primary
// content, the actions stay collapsed in the footer, and the removed
// elements stay removed.
test('HTML - card list is the primary content: filters first, actions grouped and collapsed, no bottom Close', () => {
  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  const modalStart = html.indexOf('id="topDefaultersModal"');
  assert.ok(modalStart >= 0, 'missing topDefaultersModal');
  const modalHtml = html.slice(modalStart, html.indexOf('id="prelockNoticeModal"', modalStart));

  // The filter toolbar and the card list come before the KPI grid and
  // the chart, so they are the first thing visible when the modal opens.
  assert.ok(modalHtml.indexOf('id="topDefaultersSearchInput"') < modalHtml.indexOf('id="topDefaultersList"'), 'filters must precede the card list');
  assert.ok(modalHtml.indexOf('id="topDefaultersList"') < modalHtml.indexOf('id="topDefaultersKpiTopDues"'), 'card list must precede the KPI grid');
  assert.ok(modalHtml.indexOf('id="topDefaultersList"') < modalHtml.indexOf('id="topDefaultersChartContainer"'), 'card list must precede the chart');

  // The 4 filter selects sit in a 2×2 grid below the full-width search.
  assert.ok(modalHtml.includes('class="defaulter-filter-grid"'), 'filters must use the 2×2 grid');
  const gridStart = modalHtml.indexOf('class="defaulter-filter-grid"');
  for (const id of ['topDefaultersAreaSelect', 'topDefaultersLimitSelect', 'topDefaultersRiskSelect', 'topDefaultersWaadaSelect']) {
    assert.ok(modalHtml.indexOf(`id="${id}"`) > gridStart, `${id} must be inside the filter grid`);
  }

  // The ten action buttons live in a collapsed <details> (no open
  // attribute), so they never push the list off the phone viewport.
  const detailsStart = modalHtml.indexOf('<details class="defaulters-actions-details"');
  assert.ok(detailsStart >= 0, 'actions must be inside a <details>');
  const detailsTag = modalHtml.slice(detailsStart, modalHtml.indexOf('>', detailsStart));
  assert.ok(!detailsTag.includes(' open'), 'actions <details> must start collapsed');
  const detailsEnd = modalHtml.indexOf('</details>', detailsStart);
  assert.ok(detailsEnd > detailsStart, 'actions <details> must close');
  for (const id of [
    'topDefaultersExportCsvBtn', 'topDefaultersCopyBriefingBtn',
    'topDefaultersLockDueBtn', 'topDefaultersPrelockNoticeBtn',
    'topDefaultersHideContactedBtn', 'topDefaultersMikrotikLockBtn',
    'topDefaultersMikrotikRestoreBtn', 'topDefaultersPrintA4Btn',
    'topDefaultersPrintThermalBtn', 'topDefaultersZoneSheetBtn'
  ]) {
    const pos = modalHtml.indexOf(`id="${id}"`);
    assert.ok(pos > detailsStart && pos < detailsEnd, `${id} must be inside the actions <details>`);
  }

  // The drawer is grouped under 3 mini-labels in a compact 2-column
  // grid: Follow-up + Print/Export side by side, Router Scripts
  // full-width below.
  for (const label of ['Follow-up', 'Print / Export', 'Router Scripts']) {
    assert.ok(modalHtml.includes(`>${label}<`), `missing Actions group label "${label}"`);
  }
  assert.ok(modalHtml.includes('class="defaulters-action-groups"'), 'missing 2-column groups grid');
  assert.ok(modalHtml.includes('defaulters-action-group--wide'), 'Router Scripts group must span both columns');
  // Follow-up group order is Prelock, Hide Contacted, Lock Due.
  assert.ok(modalHtml.indexOf('id="topDefaultersPrelockNoticeBtn"') < modalHtml.indexOf('id="topDefaultersHideContactedBtn"'));
  assert.ok(modalHtml.indexOf('id="topDefaultersHideContactedBtn"') < modalHtml.indexOf('id="topDefaultersLockDueBtn"'));

  // The bottom green Close is removed: the header ✕ is the only close.
  assert.ok(!modalHtml.includes('id="closeTopDefaultersSecondaryBtn"'), 'bottom Close must be removed');
  assert.match(modalHtml, /<button id="closeTopDefaultersModalBtn" class="close-btn td-close-btn"[^>]*>✕<\/button>/, 'header ✕ is the only close');
  assert.ok(modalHtml.includes('defaulters-actions-summary'), 'actions toggle must exist');

  // The card + grouped-actions styles exist and introduce no new hex.
  const css = fs.readFileSync(path.resolve('./styles.css'), 'utf-8');
  assert.ok(css.includes('.defaulters-actions-details'), 'missing .defaulters-actions-details CSS');
  assert.ok(css.includes('.defaulters-actions-summary'), 'missing .defaulters-actions-summary CSS');
  assert.ok(css.includes('.defaulter-card'), 'missing .defaulter-card CSS');
  assert.ok(css.includes('.defaulter-filter-grid'), 'missing .defaulter-filter-grid CSS');
  assert.ok(css.includes('.defaulters-action-groups'), 'missing .defaulters-action-groups CSS');
  assert.ok(css.includes('/* Top Defaulters Modal Fix'), 'missing Top Defaulters Modal Fix CSS block marker');
  const blockStart = css.indexOf('/* Dues-list tile live fix');
  const tdBlockStart = css.indexOf('/* Top Defaulters Modal Fix');
  assert.ok(blockStart >= 0 && tdBlockStart > blockStart, 'missing CSS block markers');
  // The Dues-list tile block stays hex-free (its original discipline).
  const duesBlock = css.slice(blockStart, tdBlockStart);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(duesBlock), 'Dues-list tile CSS must reuse tokens only, no new hex');
  // The Top Defaulters block reuses only hex already present elsewhere
  // in styles.css — no new colour (the 614-hex ratchet is the
  // backstop, and this pins the block itself: every hex in it must
  // occur outside it).
  const tdBlock = css.slice(tdBlockStart, css.indexOf('/* Dark Mode Overrides */', tdBlockStart));
  const restCss = css.slice(0, tdBlockStart) + css.slice(css.indexOf('/* Dark Mode Overrides */', tdBlockStart));
  const restHex = new Set(restCss.match(/#[0-9a-fA-F]{3,8}\b/g) || []);
  for (const hex of tdBlock.match(/#[0-9a-fA-F]{3,8}\b/g) || []) {
    assert.ok(restHex.has(hex), `Top Defaulters CSS must reuse existing hex only, found new ${hex}`);
  }

  // Top Defaulters polish (2026-11-13) — the structural pins for the
  // one-screen compact modal. The scroll trap is gone: the list scroll
  // box has no inline max-height/overflow cap (the dialog itself owns
  // the scroll); the summary bar is the slim 44px collapsed bar; an
  // open Actions drawer can never eat more than ~45% of the dialog.
  assert.ok(!/class="defaulter-list-scroll"[^>]*max-height/.test(modalHtml), 'list scroll box must not cap its own height');
  assert.ok(!/class="defaulter-list-scroll"[^>]*overflow-y/.test(modalHtml), 'list scroll box must not own its own scroll');
  assert.ok(css.includes('min-height: 44px'), 'Actions summary bar must be the slim 44px bar');
  assert.ok(css.includes('max-height: 45dvh'), 'open Actions drawer must be capped at 45dvh');
  // Compact header: 16px title beats the ≤640px clamp, and the Urdu
  // subtitle is a block box so nowrap + ellipsis actually applies.
  assert.ok(css.includes('.top-defaulters-modal .billing-modal-header h2'), 'compact header h2 rule must exist');
  assert.ok(css.includes('font-size: 16px !important'), 'compact header h2 must be 16px');
  assert.ok(css.includes('.top-defaulters-modal .urdu-subtitle'), 'subtitle one-line rule must exist');
  // KPI grid is a compact 2×2 on phones; the area select spans both
  // filter columns so "All Areas / Mohallas" is never truncated.
  assert.ok(css.includes('grid-template-columns: 1fr 1fr'), 'KPI grid must be 2×2 on phones');
  assert.ok(css.includes('.defaulter-filter-grid .defaulter-select-box:first-child'), 'area select must span both columns');
  // Short KPI labels (D-A: 'Critical (3m+)' follows the code/tier rule,
  // not the spec's '(2M+)').
  assert.ok(modalHtml.includes('>Filtered Top<'), 'KPI label must be Filtered Top');
  assert.ok(modalHtml.includes('>Concentration<'), 'KPI label must be Concentration');
  assert.ok(modalHtml.includes('>Total Portfolio<'), 'KPI label must be Total Portfolio');
  assert.ok(modalHtml.includes('>Critical (3m+)<'), 'KPI label must be Critical (3m+)');
  assert.ok(modalHtml.includes('>All Areas / Mohallas<'), 'filter label must be All Areas / Mohallas');
  assert.ok(!modalHtml.includes('All Areas / Sectors'), 'old Sectors label must be gone from this modal');
  // Secondary row is one 3-column grid; the Lock Due count stays inline.
  assert.ok(css.includes('.defaulter-card-actions-secondary {\n  display: grid;'), 'secondary row must be a 3-column grid');
  assert.ok(css.includes('grid-template-columns: 1fr 1fr 1fr'), 'secondary row must be 1fr 1fr 1fr');
  assert.ok(css.includes('.lock-due-toggle {\n  white-space: nowrap;'), 'Lock Due label must not wrap');
});

// Top Defaulters Modal Fix item 1 (2026-11-13): one full-width stacked
// card per defaulter replaces the wide 8-column table. The card's top
// row is '#rank · #ID NAME (Mohalla)' left with the bold red due +
// overdue days right; the Waada status pill and the escalation stage ride
// inline in the meta row (only when a promise exists / a stage applies);
// the bottom row is Polite / Final Notice / Collect, and the retained
// Waada / Contacted / Profile actions ride in a secondary row.
test('Card markup - stacked card renders rank, name, mohalla, red due, Waada pill and the 3-button bottom row', () => {
  const state = createSampleBillingState();
  // Far-future promise → 'promised' tier; long-past promise → 'broken'
  // tier. Both dates are placeholders for the tier, not real promises.
  state.customers[0].promiseDate = '2099-01-05';
  state.customers[1].promiseDate = '2020-01-05';
  // No mohalla recorded → the card must omit the parens entirely
  // (never '(Shahdara)' — that is the redundant city column being
  // removed).
  state.customers[2].mohalla = '';

  const stub = (extra = {}) => ({ addEventListener: () => {}, ...extra });
  const mockElements = {
    topDefaultersModal: { showModal: () => { mockElements.topDefaultersModal.open = true; }, close: () => { mockElements.topDefaultersModal.open = false; }, open: false, hidden: true },
    dashboardOpenTopDefaultersBtn: { addEventListener: () => {} },
    quickActionTopDefaulters: { addEventListener: () => {} },
    closeTopDefaultersModalBtn: stub(),
    topDefaultersSearchInput: stub({ value: '' }),
    topDefaultersAreaSelect: stub({ value: 'all', options: [{ value: 'all' }], appendChild: () => {} }),
    topDefaultersLimitSelect: stub({ value: '20' }),
    topDefaultersRiskSelect: stub({ value: 'all' }),
    topDefaultersWaadaSelect: stub({ value: 'all' }),
    topDefaultersKpiTopDues: { textContent: '' },
    topDefaultersKpiConcentration: { textContent: '' },
    topDefaultersKpiTotalDebt: { textContent: '' },
    topDefaultersKpiCriticalCount: { textContent: '' },
    topDefaultersList: { innerHTML: '', addEventListener: () => {} },
    topDefaultersEmptyState: { hidden: true },
    topDefaultersChartContainer: { innerHTML: '' },
    topDefaultersExportCsvBtn: stub(),
    topDefaultersPrintA4Btn: stub(),
    topDefaultersPrintThermalBtn: stub(),
    topDefaultersCopyBriefingBtn: stub(),
    topDefaultersLockDueBtn: stub({ textContent: '', classList: { toggle: () => {} }, setAttribute: () => {} }),
    topDefaultersPrelockNoticeBtn: stub(),
    topDefaultersHideContactedBtn: stub({ classList: { toggle: () => {} }, setAttribute: () => {} }),
    topDefaultersMikrotikLockBtn: stub(),
    topDefaultersMikrotikRestoreBtn: stub(),
    topDefaultersZoneSheetBtn: stub(),
    topDefaultersMikrotikCopyBtn: stub()
  };

  const originalDocument = globalThis.document;
  try {
    globalThis.document = {
      getElementById: (id) => mockElements[id] || null,
      createElement: (tag) => ({ tag, options: [], appendChild: () => {} })
    };

    const controller = setupTopDefaultersModal(() => state, {});
    assert.ok(controller);
    controller.open();
    const html = mockElements.topDefaultersList.innerHTML;

    // No table rows any more — one card per defaulter. With the real
    // today as the reference date all three fixture customers are
    // critical (the KPI test pins criticalCount 3), so every card
    // carries the critical class.
    assert.ok(!html.includes('<tr'), 'card list must not render table rows');
    assert.equal((html.match(/class="defaulter-card /g) || []).length, 3, 'one card per defaulter');
    assert.ok(html.includes('class="defaulter-card critical"'), 'critical customer renders a card');
    assert.ok(html.includes('Muhammad Tariq') && html.includes('Abdul Rehman') && html.includes('Zahid Hussain'), 'all three defaulters render cards');

    // Top row: '#rank · #ID NAME (Mohalla)' left, red due + days right.
    assert.ok(html.includes('#1'), 'rank renders');
    assert.ok(html.includes('#1</strong> Muhammad Tariq'), 'customer number + name render');
    assert.ok(html.includes('(Main Bazaar)'), 'mohalla renders in parens');
    assert.ok(html.includes('PKR 6,500'), 'outstanding renders');
    assert.ok(html.includes('d overdue'), 'overdue days render');
    // Months and last payment survive in the meta line.
    assert.ok(html.includes('unpaid-month-tag'), 'unpaid month tags render');
    assert.ok(html.includes('Last: 2026-02-15'), 'last payment renders');

    // The redundant 'Shahdara' city is gone: no parens fallback, no
    // Area cell at all.
    assert.ok(!html.includes('(Shahdara)'), 'empty mohalla must not print (Shahdara)');
    assert.ok(!html.includes('Shahdara Town'), 'area column must be gone');

    // Meta row: Waada pill only when a promise exists (it rides inline
    // in the meta row with the escalation stage, not on its own row).
    assert.ok(html.includes('Waada: 2099-01-05'), 'promised Waada pill renders');
    assert.ok(html.includes('Waada Expired: 2020-01-05'), 'broken Waada pill renders');

    // Bottom row: Polite / Final Notice / Collect.
    assert.ok(html.includes('defaulter-reminder-polite'), 'Polite Reminder button renders');
    assert.ok(html.includes('defaulter-reminder-final'), 'Final Notice button renders');
    assert.ok(html.includes('defaulter-collect-btn'), 'Collect button renders');
    // Top Defaulters polish (2026-11-13): the Polite label is shortened
    // to '🟢 Polite' — the long label ellipsized by design at 360px (three
    // flex:1 buttons share ~308px; 'Polite Reminder' alone needs ~130px).
    // The Polite action is pinned by class + the click test, not by the
    // long label; the risk-segment chip was the only other source of the
    // long string and is no longer rendered on the card.
    assert.ok(html.includes('🟢 Polite'), 'Polite label renders');
    assert.ok(html.includes('🟠 Final Notice'), 'Final Notice label renders');
    assert.ok(html.includes('💵 Collect'), 'Collect label renders');

    // Secondary row: the retained Waada / Contacted / Profile.
    assert.ok(html.includes('defaulter-waada-btn'), 'Waada button survives');
    assert.ok(html.includes('defaulter-contact-btn'), 'Contacted button survives');
    assert.ok(html.includes('defaulter-view-btn'), 'Profile button survives');
    // Top Defaulters polish (2026-11-13): 'Mark contacted' is now the
    // shorter 'Contacted' (new cct_contacted key — cct_mark_contacted is
    // shared with Field Mode and is untouched), and Profile carries 👤.
    assert.ok(html.includes('✓ Contacted'), 'Contacted label renders');
    assert.ok(html.includes('👤 Profile'), 'Profile label carries the icon');
  } finally {
    globalThis.document = originalDocument;
  }
});

// Top Defaulters Modal Fix item 1 (2026-11-13): Collect closes this
// modal FIRST (the Profile-button precedent), then opens Quick Collect
// for the customer via selectAndOpen. When the QC controller is not
// available the operator gets a toast instead of a dead tap.
test('Collect - closes the modal first, then opens Quick Collect for the customer', () => {
  const state = createSampleBillingState();
  const c1Id = state.customers[0].id;

  const stub = (extra = {}) => ({ addEventListener: () => {}, ...extra });
  let closeCalls = 0;
  let selectedId = null;
  let toastMsg = '';
  const mockElements = {
    topDefaultersModal: {
      showModal: () => { mockElements.topDefaultersModal.open = true; },
      close: () => { closeCalls += 1; mockElements.topDefaultersModal.open = false; },
      open: false,
      hidden: true
    },
    dashboardOpenTopDefaultersBtn: { addEventListener: () => {} },
    quickActionTopDefaulters: { addEventListener: () => {} },
    closeTopDefaultersModalBtn: stub(),
    topDefaultersSearchInput: stub({ value: '' }),
    topDefaultersAreaSelect: stub({ value: 'all', options: [{ value: 'all' }], appendChild: () => {} }),
    topDefaultersLimitSelect: stub({ value: '20' }),
    topDefaultersRiskSelect: stub({ value: 'all' }),
    topDefaultersWaadaSelect: stub({ value: 'all' }),
    topDefaultersKpiTopDues: { textContent: '' },
    topDefaultersKpiConcentration: { textContent: '' },
    topDefaultersKpiTotalDebt: { textContent: '' },
    topDefaultersKpiCriticalCount: { textContent: '' },
    topDefaultersList: {
      innerHTML: '',
      addEventListener: (evt, cb) => { mockElements._listClickCb = cb; }
    },
    topDefaultersEmptyState: { hidden: true },
    topDefaultersChartContainer: { innerHTML: '' },
    topDefaultersExportCsvBtn: stub(),
    topDefaultersPrintA4Btn: stub(),
    topDefaultersPrintThermalBtn: stub(),
    topDefaultersCopyBriefingBtn: stub(),
    topDefaultersLockDueBtn: stub({ textContent: '', classList: { toggle: () => {} }, setAttribute: () => {} }),
    topDefaultersPrelockNoticeBtn: stub(),
    topDefaultersHideContactedBtn: stub({ classList: { toggle: () => {} }, setAttribute: () => {} }),
    topDefaultersMikrotikLockBtn: stub(),
    topDefaultersMikrotikRestoreBtn: stub(),
    topDefaultersZoneSheetBtn: stub(),
    topDefaultersMikrotikCopyBtn: stub()
  };

  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  try {
    globalThis.document = {
      getElementById: (id) => mockElements[id] || null,
      createElement: (tag) => ({ tag, options: [], appendChild: () => {} })
    };
    globalThis.window = {
      quickCollectModalController: { selectAndOpen: (id) => { selectedId = id; } }
    };

    const controller = setupTopDefaultersModal(() => state, {
      onToast: (msg) => { toastMsg = msg; }
    });
    controller.open();
    assert.equal(mockElements.topDefaultersModal.open, true);

    mockElements._listClickCb({
      target: {
        closest: (sel) => sel === '.defaulter-collect-btn' ? { dataset: { custId: c1Id } } : null
      }
    });
    assert.equal(closeCalls, 1, 'Collect closes this modal first');
    assert.equal(mockElements.topDefaultersModal.open, false, 'modal is closed');
    assert.equal(selectedId, c1Id, 'Quick Collect opens for the tapped customer');

    // No QC controller → a toast, not a dead tap.
    delete globalThis.window.quickCollectModalController;
    mockElements.topDefaultersModal.open = true;
    mockElements._listClickCb({
      target: {
        closest: (sel) => sel === '.defaulter-collect-btn' ? { dataset: { custId: c1Id } } : null
      }
    });
    assert.equal(toastMsg, 'Payment screen unavailable — try again.');
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});
