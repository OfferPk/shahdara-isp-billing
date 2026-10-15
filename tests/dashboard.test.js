import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addCustomer, saveBillMonth, addPayment } from '../core.js';
import {
  calculateDashboardKpis,
  calculateCollectionVelocity,
  calculateCustomerHealthBreakdown,
  calculatePaymentMethodBreakdown,
  calculateChurnRiskAnalysis,
  setupDashboardQuickActions,
  generateDashboardBriefingText,
  generateDashboardBriefingHtml,
  setupDashboardBriefingButton,
  setupDashboardBriefingModal,
  setupCustomerHealthActions,
  setupAreaDrilldownModal,
  setupChurnRiskModal,
  setupAreaHeatmapEvents
} from '../dashboard.js';
import {
  calculateMonthlyTrends,
  calculateDuesByArea,
  calculateAreaDetailedBreakdown,
  calculateAreaCollectionHeatmap,
  calculatePackageDistribution,
  renderMonthlyTrendSvg,
  renderBillStatusDonutSvg,
  renderAreaDuesSvg,
  renderPackageDistributionSvg,
  renderCustomerHealthSvg,
  renderPaymentMethodSvg,
  renderChurnRiskGaugeSvg,
  renderAreaCollectionHeatmapSvg,
  renderDashboardCharts,
  setTrendChartDuration,
  getTrendChartDuration,
  setMethodChartPeriod,
  getMethodChartPeriod,
  setHeatmapFilter,
  getHeatmapFilter,
  setupDashboardChartsEvents,
  METHOD_COLORS
} from '../dashboard-charts.js';

test('calculateDashboardKpis returns accurate subscriber breakdown and percentages', () => {
  let state = createInitialState(['Alice', 'Bob', 'Charlie', 'David']);
  state.customers[0].serviceStatus = 'active';
  state.customers[1].serviceStatus = 'active';
  state.customers[2].serviceStatus = 'offline';
  state.customers[3].serviceStatus = 'not-set';

  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const kpis = calculateDashboardKpis(state, refDate);

  assert.equal(kpis.totalCustomers, 4);
  assert.equal(kpis.activeSubscribers, 2);
  assert.equal(kpis.offlineSubscribers, 1);
  assert.equal(kpis.unsetSubscribers, 1);
  assert.equal(kpis.activePercent, 50); // 2 out of 4 = 50%
});

test('calculateDashboardKpis accurately counts paid, partial, and unpaid bills for current month', () => {
  let state = createInitialState(['Customer One', 'Customer Two', 'Customer Three', 'Customer Four']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const currentMonth = '2026-10';

  // Customer 1: Paid bill (1000 due, 1000 paid)
  state = saveBillMonth(state, state.customers[0].id, { month: currentMonth, dueAmount: '1000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, currentMonth, { amount: '1000', date: '2026-10-05', method: 'Cash' }, refDate);

  // Customer 2: Partial bill (1000 due, 400 paid)
  state = saveBillMonth(state, state.customers[1].id, { month: currentMonth, dueAmount: '1000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, currentMonth, { amount: '400', date: '2026-10-06', method: 'Cash' }, refDate);

  // Customer 3: Unpaid bill (1000 due, 0 paid)
  state = saveBillMonth(state, state.customers[2].id, { month: currentMonth, dueAmount: '1000', status: 'pending' }, refDate);

  // Customer 4: Bill from previous month (should not be counted in current month)
  state = saveBillMonth(state, state.customers[3].id, { month: '2026-09', dueAmount: '1000', status: 'pending' }, refDate);

  const kpis = calculateDashboardKpis(state, refDate);

  assert.equal(kpis.paidBillsCount, 1);
  assert.equal(kpis.partialBillsCount, 1);
  assert.equal(kpis.unpaidBillsCount, 1);
  assert.equal(kpis.totalCurrentMonthBills, 3);
  assert.equal(kpis.currentMonthBilled, 3000);
  assert.equal(kpis.currentMonthCollection, 1400);
  assert.equal(kpis.collectionRate, 47); // 1400 / 3000 = 46.67% -> 47%
});

test('calculateDashboardKpis detects new connections for the current month', () => {
  let state = createInitialState(['Old Customer']);
  state.customers[0].connectionDate = '2026-01-15';

  const refDate = new Date('2026-10-15T12:00:00+05:00');
  // Add customer with connectionDate in current month
  state = addCustomer(state, 'New Connected Customer', refDate, { connectionDate: '2026-10-02' });
  // Add customer with addedOn in current month but no explicit connectionDate
  state = addCustomer(state, 'New Added Customer', refDate);

  const kpis = calculateDashboardKpis(state, refDate);
  assert.equal(kpis.newConnectionsCount, 2);
});

test('calculateDashboardKpis handles zero customer state gracefully', () => {
  const emptyState = { version: 1, nextCustomerNumber: 1, customers: [], inventoryItems: [], inventoryMovements: [], expenses: [], saadAttendanceDays: [], umairWorkdays: [], monthlyClosings: [] };
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const kpis = calculateDashboardKpis(emptyState, refDate);

  assert.equal(kpis.totalCustomers, 0);
  assert.equal(kpis.activeSubscribers, 0);
  assert.equal(kpis.activePercent, 0);
  assert.equal(kpis.paidBillsCount, 0);
  assert.equal(kpis.unpaidBillsCount, 0);
  assert.equal(kpis.partialBillsCount, 0);
  assert.equal(kpis.collectionRate, null);
  assert.equal(kpis.newConnectionsCount, 0);
});

test('setupDashboardQuickActions wires event handlers to DOM buttons', () => {
  const mockElements = new Map();
  const listeners = new Map();

  const fakeDoc = {
    getElementById(id) {
      if (!mockElements.has(id)) {
        mockElements.set(id, {
          id,
          dataset: {},
          addEventListener(event, fn) {
            listeners.set(`${id}:${event}`, fn);
          }
        });
      }
      return mockElements.get(id);
    }
  };

  const originalDoc = globalThis.document;
  globalThis.document = fakeDoc;

  try {
    let paymentCalled = false;
    let customerCalled = false;
    let expenseCalled = false;
    let reportCalled = false;
    let analyticsCalled = false;
    let backupCalled = false;

    setupDashboardQuickActions({
      onReceivePayment: () => { paymentCalled = true; },
      onAddCustomer: () => { customerCalled = true; },
      onRecordExpense: () => { expenseCalled = true; },
      onMonthlyReport: () => { reportCalled = true; },
      onAnalytics: () => { analyticsCalled = true; },
      onBackup: () => { backupCalled = true; }
    });

    listeners.get('quickActionReceivePayment:click')();
    listeners.get('quickActionAddCustomer:click')();
    listeners.get('quickActionRecordExpense:click')();
    listeners.get('quickActionMonthlyReports:click')();
    listeners.get('quickActionAnalytics:click')();
    listeners.get('quickActionBackupData:click')();

    assert.ok(paymentCalled);
    assert.ok(customerCalled);
    assert.ok(expenseCalled);
    assert.ok(reportCalled);
    assert.ok(analyticsCalled);
    assert.ok(backupCalled);
  } finally {
    globalThis.document = originalDoc;
  }
});

test('calculateMonthlyTrends produces 6-month historical trends array with labels and amounts', () => {
  let state = createInitialState(['Trend Customer']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Add bill and payment in October
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '2000', date: '2026-10-05', method: 'Cash' }, refDate);

  // Add bill and partial payment in September
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-09', dueAmount: '1500', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-09', { amount: '1000', date: '2026-09-03', method: 'Cash' }, refDate);

  const trends = calculateMonthlyTrends(state, refDate, 6);

  assert.equal(trends.length, 6);
  assert.equal(trends[5].month, '2026-10');
  assert.equal(trends[5].monthLabel, "Oct '26");
  assert.equal(trends[5].billed, 2000);
  assert.equal(trends[5].collected, 2000);

  assert.equal(trends[4].month, '2026-09');
  assert.equal(trends[4].monthLabel, "Sep '26");
  assert.equal(trends[4].billed, 1500);
  assert.equal(trends[4].collected, 1000);
});

test('calculateDuesByArea groups unpaid balances by area correctly and sorts descending', () => {
  let state = createInitialState(['Area Cust 1', 'Area Cust 2', 'Area Cust 3', 'Archived Cust']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  state.customers[0].area = 'Model Town';
  state.customers[1].area = 'Model Town';
  state.customers[2].area = 'Main Market';
  state.customers[3].area = 'Model Town';
  state.customers[3].archived = true; // should be ignored

  // Cust 1: 3000 due
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  // Cust 2: 1500 due
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '1500', status: 'pending' }, refDate);
  // Cust 3: 5000 due
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '5000', status: 'pending' }, refDate);

  const areas = calculateDuesByArea(state, refDate, 5);

  assert.equal(areas.length, 2);
  // Main Market has 5000, Model Town has 4500 (3000 + 1500)
  assert.equal(areas[0].area, 'Main Market');
  assert.equal(areas[0].totalDue, 5000);
  assert.equal(areas[0].customerCount, 1);

  assert.equal(areas[1].area, 'Model Town');
  assert.equal(areas[1].totalDue, 4500);
  assert.equal(areas[1].customerCount, 2);
});

test('renderMonthlyTrendSvg produces valid SVG with data and empty state', () => {
  // Empty state
  const emptySvg = renderMonthlyTrendSvg([
    { month: '2026-09', monthLabel: "Sep '26", billed: 0, collected: 0 },
    { month: '2026-10', monthLabel: "Oct '26", billed: 0, collected: 0 }
  ]);
  assert.ok(emptySvg.includes('<svg class="chart-svg"'));
  assert.ok(emptySvg.includes('No billing or collection activity'));

  // Active state
  const activeSvg = renderMonthlyTrendSvg([
    { month: '2026-09', monthLabel: "Sep '26", billed: 1500, collected: 1000 },
    { month: '2026-10', monthLabel: "Oct '26", billed: 2000, collected: 2000 }
  ]);
  assert.ok(activeSvg.includes('chart-trend-svg'));
  assert.ok(activeSvg.includes('Billed Revenue'));
  assert.ok(activeSvg.includes('Collected Cash'));
  assert.ok(activeSvg.includes('bar-billed'));
  assert.ok(activeSvg.includes('bar-collected'));
  assert.ok(activeSvg.includes("Sep '26"));
  assert.ok(activeSvg.includes("Oct '26"));
});

test('renderBillStatusDonutSvg produces accessible donut SVG with correct slices and empty state', () => {
  // Empty state
  const emptySvg = renderBillStatusDonutSvg({ total: 0 });
  assert.ok(emptySvg.includes('0 Bills'));
  assert.ok(emptySvg.includes('No bill entries created yet'));

  // Normal state
  const donutSvg = renderBillStatusDonutSvg({ paid: 8, partial: 2, unpaid: 10, total: 20 });
  assert.ok(donutSvg.includes('chart-donut-svg'));
  assert.ok(donutSvg.includes('40%')); // 8/20 = 40%
  assert.ok(donutSvg.includes('Paid: 8'));
  assert.ok(donutSvg.includes('Partial: 2'));
  assert.ok(donutSvg.includes('Unpaid: 10'));
});

test('renderAreaDuesSvg produces horizontal bar SVG with empty state and area bars', () => {
  // Empty state
  const emptySvg = renderAreaDuesSvg([]);
  assert.ok(emptySvg.includes('No outstanding dues across areas'));

  // Active state
  const activeSvg = renderAreaDuesSvg([
    { area: 'Chungi Amar Sidhu', totalDue: 15000, customerCount: 12 },
    { area: 'Main Market', totalDue: 8500, customerCount: 7 }
  ]);
  assert.ok(activeSvg.includes('chart-area-svg'));
  assert.ok(activeSvg.includes('Chungi Amar S…'));
  assert.ok(activeSvg.includes('Main Market'));
  assert.ok(activeSvg.includes('PKR 15,000'));
});

test('renderDashboardCharts populates HTML chart containers correctly', () => {
  let state = createInitialState(['Test User']);

  const fakeContainers = new Map();
  fakeContainers.set('dashboardTrendChart', { innerHTML: '' });
  fakeContainers.set('dashboardStatusChart', { innerHTML: '' });
  fakeContainers.set('dashboardAreaChart', { innerHTML: '' });

  const fakeDoc = {
    getElementById(id) {
      return fakeContainers.get(id) || null;
    }
  };

  const origDoc = globalThis.document;
  globalThis.document = fakeDoc;
  try {
    renderDashboardCharts(state, new Date('2026-10-15T12:00:00+05:00'));
    assert.ok(fakeContainers.get('dashboardTrendChart').innerHTML.includes('<svg'));
    assert.ok(fakeContainers.get('dashboardStatusChart').innerHTML.includes('<svg'));
    assert.ok(fakeContainers.get('dashboardAreaChart').innerHTML.includes('<svg'));
  } finally {
    globalThis.document = origDoc;
  }
});

test('calculatePackageDistribution groups customers by packageSpeed, revenue, and active counts', () => {
  let state = createInitialState(['Cust A', 'Cust B', 'Cust C', 'Cust D', 'Archived Cust']);
  state.customers[0].packageSpeed = '5 Mbps / 150GB';
  state.customers[0].monthlySellingAmount = '1500';
  state.customers[0].serviceStatus = 'active';

  state.customers[1].packageSpeed = '5 Mbps / 150GB';
  state.customers[1].monthlySellingAmount = '1500';
  state.customers[1].serviceStatus = 'offline';

  state.customers[2].packageSpeed = '15 Mbps Unlimited';
  state.customers[2].monthlySellingAmount = '3000';
  state.customers[2].serviceStatus = 'active';

  state.customers[3].packageSpeed = '';
  state.customers[3].serviceStatus = 'not-set';

  state.customers[4].packageSpeed = '15 Mbps Unlimited';
  state.customers[4].archived = true;

  const result = calculatePackageDistribution(state);

  assert.equal(result.totalTracked, 4);
  assert.equal(result.totalMonthlyRevenue, 6000); // 1500 + 1500 + 3000
  assert.equal(result.packages.length, 3);

  // Top package is 5 Mbps (2 customers)
  const topPkg = result.packages[0];
  assert.equal(topPkg.packageName, '5 Mbps / 150GB');
  assert.equal(topPkg.count, 2);
  assert.equal(topPkg.activeCount, 1);
  assert.equal(topPkg.monthlyRevenue, 3000);
  assert.equal(topPkg.percent, 50);

  // Unassigned package exists
  const unassigned = result.packages.find(p => p.packageName === 'Unassigned');
  assert.ok(unassigned);
  assert.equal(unassigned.count, 1);
});

test('renderPackageDistributionSvg generates valid SVG with donut arcs, percentage, and empty state', () => {
  // Empty state
  const emptySvg = renderPackageDistributionSvg({ packages: [], totalTracked: 0 });
  assert.ok(emptySvg.includes('chart-pkg-svg'));
  assert.ok(emptySvg.includes('0 Packages'));
  assert.ok(emptySvg.includes('No customer package tiers assigned'));

  // Active state
  const activeSvg = renderPackageDistributionSvg({
    packages: [
      { packageName: '5 Mbps', count: 10, activeCount: 8, monthlyRevenue: 15000, percent: 50 },
      { packageName: '15 Mbps', count: 10, activeCount: 9, monthlyRevenue: 30000, percent: 50 }
    ],
    totalTracked: 20,
    totalMonthlyRevenue: 45000
  });

  assert.ok(activeSvg.includes('chart-pkg-svg'));
  assert.ok(activeSvg.includes('50%'));
  assert.ok(activeSvg.includes('5 Mbps'));
  assert.ok(activeSvg.includes('15 Mbps'));
  assert.ok(activeSvg.includes('PKR 45,000'));
});

test('calculateAreaDetailedBreakdown counts total, active, offline subscribers and sums total dues', () => {
  let state = createInitialState(['Area A1', 'Area A2', 'Area B1', 'Archived User']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  state.customers[0].area = 'Gulshan Ravi';
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);

  state.customers[1].area = 'Gulshan Ravi';
  state.customers[1].serviceStatus = 'offline';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '1000', status: 'pending' }, refDate);

  state.customers[2].area = 'Shahdara Town';
  state.customers[2].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '5000', status: 'pending' }, refDate);

  state.customers[3].area = 'Shahdara Town';
  state.customers[3].archived = true;

  const breakdown = calculateAreaDetailedBreakdown(state, refDate);

  assert.equal(breakdown.length, 2);
  // Shahdara Town has 5000 dues (rank 1), Gulshan Ravi has 3000 dues (rank 2)
  assert.equal(breakdown[0].area, 'Shahdara Town');
  assert.equal(breakdown[0].totalDue, 5000);
  assert.equal(breakdown[0].customerCount, 1);
  assert.equal(breakdown[0].activeCount, 1);

  assert.equal(breakdown[1].area, 'Gulshan Ravi');
  assert.equal(breakdown[1].totalDue, 3000);
  assert.equal(breakdown[1].customerCount, 2);
  assert.equal(breakdown[1].activeCount, 1);
  assert.equal(breakdown[1].offlineCount, 1);
});

test('generateDashboardBriefingText generates formatted multi-line summary string', () => {
  let state = createInitialState(['User A', 'User B']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state.customers[0].serviceStatus = 'active';
  state.customers[0].area = 'Main Market';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '1500', status: 'pending' }, refDate);

  const text = generateDashboardBriefingText(state, refDate);

  assert.ok(text.includes('SHAHDARA ISP — EXECUTIVE SUMMARY'));
  assert.ok(text.includes('Month: 2026-10'));
  assert.ok(text.includes('Total Profiles: 2'));
  assert.ok(text.includes('Active Subscribers: 1'));
  assert.ok(text.includes('Billed Snapshot Revenue: PKR 1,500'));
  assert.ok(text.includes('TOP OUTSTANDING AREAS'));
  assert.ok(text.includes('Main Market: PKR 1,500'));
});

test('setTrendChartDuration and getTrendChartDuration manage duration limits', () => {
  setTrendChartDuration(3);
  assert.equal(getTrendChartDuration(), 3);

  setTrendChartDuration(12);
  assert.equal(getTrendChartDuration(), 12);

  // Invalid duration is rejected
  setTrendChartDuration(45);
  assert.equal(getTrendChartDuration(), 12);

  // Reset to default 6
  setTrendChartDuration(6);
  assert.equal(getTrendChartDuration(), 6);
});

test('calculateMonthlyTrends respects custom month counts (3, 6, 12)', () => {
  let state = createInitialState(['Test User']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  const trends3 = calculateMonthlyTrends(state, refDate, 3);
  assert.equal(trends3.length, 3);

  const trends6 = calculateMonthlyTrends(state, refDate, 6);
  assert.equal(trends6.length, 6);

  const trends12 = calculateMonthlyTrends(state, refDate, 12);
  assert.equal(trends12.length, 12);
});

test('setupAreaDrilldownModal populates table and invokes filter roster callback', () => {
  let state = createInitialState(['Cust One']);
  state.customers[0].area = 'Baghbanpura';
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  const listeners = new Map();
  const mockTableBody = { innerHTML: '', querySelectorAll: () => [] };
  const mockModal = {
    showModalCalled: false,
    closeCalled: false,
    showModal() { this.showModalCalled = true; },
    close() { this.closeCalled = true; },
    addEventListener(event, fn) { listeners.set(`modal:${event}`, fn); }
  };
  const mockOpenBtn = {
    dataset: {},
    addEventListener(event, fn) { listeners.set(`openBtn:${event}`, fn); }
  };
  const mockCloseBtn = {
    dataset: {},
    addEventListener(event, fn) { listeners.set(`closeBtn:${event}`, fn); }
  };

  const fakeDoc = {
    getElementById(id) {
      if (id === 'dashboardOpenAreaModalBtn') return mockOpenBtn;
      if (id === 'dashboardAreaModal') return mockModal;
      if (id === 'dashboardAreaModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardAreaModalTableBody') return mockTableBody;
      return null;
    }
  };

  const origDoc = globalThis.document;
  globalThis.document = fakeDoc;

  try {
    let filteredArea = null;
    setupAreaDrilldownModal(state, refDate, {
      onFilterRoster: (area) => { filteredArea = area; }
    });

    // Simulate clicking open button
    listeners.get('openBtn:click')();
    assert.ok(mockModal.showModalCalled);
    assert.ok(mockTableBody.innerHTML.includes('Baghbanpura'));
  } finally {
    globalThis.document = origDoc;
  }
});

test('calculateCollectionVelocity calculates daily run rate and month-end projection accurately', () => {
  let state = createInitialState(['Velocity Cust 1', 'Velocity Cust 2']);
  const refDate = new Date('2026-10-15T12:00:00+05:00'); // day 15 of 31

  // 4000 billed, 1500 collected by day 15
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '1500', date: '2026-10-10', method: 'Cash' }, refDate);

  const velocity = calculateCollectionVelocity(state, refDate);

  assert.equal(velocity.currentMonth, '2026-10');
  assert.equal(velocity.daysInMonth, 31);
  assert.equal(velocity.currentDay, 15);
  assert.equal(velocity.daysRemaining, 16);
  assert.equal(velocity.collectedSoFar, 1500);
  assert.equal(velocity.billedAmount, 4000);
  assert.equal(velocity.dailyRunRate, 100); // 1500 / 15 = 100
  assert.equal(velocity.projectedMonthEnd, 3100); // 1500 + 100 * 16 = 3100
  assert.equal(velocity.currentRate, 38); // 1500 / 4000 = 37.5% -> 38%
  assert.equal(velocity.projectedRate, 78); // 3100 / 4000 = 77.5% -> 78%
});

test('calculateCollectionVelocity handles zero collections gracefully', () => {
  let state = createInitialState(['Zero Cust']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const velocity = calculateCollectionVelocity(state, refDate);

  assert.equal(velocity.collectedSoFar, 0);
  assert.equal(velocity.dailyRunRate, 0);
  assert.equal(velocity.projectedMonthEnd, 0);
  assert.equal(velocity.currentRate, null);
  assert.equal(velocity.projectedRate, null);
});

test('calculateCustomerHealthBreakdown accurately categorizes Good Standing, Watchlist, Delinquent, and Offline', () => {
  let state = createInitialState(['Good Cust', 'Watch Cust', 'Delinquent Cust', 'Offline Cust', 'Archived Cust']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Customer 0: Good Standing (paid in full, 0 balance)
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '1000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '1000', date: '2026-10-05', method: 'Cash' }, refDate);

  // Customer 1: Watchlist (1 pending bill)
  state.customers[1].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '1200', status: 'pending' }, refDate);

  // Customer 2: Delinquent (2 overdue bills)
  state.customers[2].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-09', dueAmount: '1500', status: 'pending' }, refDate);
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '1500', status: 'pending' }, refDate);

  // Customer 3: Offline (serviceStatus === 'offline')
  state.customers[3].serviceStatus = 'offline';
  state = saveBillMonth(state, state.customers[3].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);

  // Customer 4: Archived (should be excluded)
  state.customers[4].archived = true;

  const health = calculateCustomerHealthBreakdown(state, refDate);

  assert.equal(health.totalTracked, 4);
  assert.equal(health.goodStanding.count, 1);
  assert.equal(health.goodStanding.percent, 25);
  assert.equal(health.goodStanding.totalDue, 0);

  assert.equal(health.watchlist.count, 1);
  assert.equal(health.watchlist.percent, 25);
  assert.equal(health.watchlist.totalDue, 1200);

  assert.equal(health.delinquent.count, 1);
  assert.equal(health.delinquent.percent, 25);
  assert.equal(health.delinquent.totalDue, 3000);

  assert.equal(health.offline.count, 1);
  assert.equal(health.offline.percent, 25);
  assert.equal(health.offline.totalDue, 2000);
});

test('calculateCustomerHealthBreakdown handles empty state gracefully', () => {
  const emptyState = { customers: [] };
  const health = calculateCustomerHealthBreakdown(emptyState, new Date('2026-10-15'));

  assert.equal(health.totalTracked, 0);
  assert.equal(health.goodStanding.count, 0);
  assert.equal(health.goodStanding.percent, 0);
  assert.equal(health.watchlist.count, 0);
  assert.equal(health.delinquent.count, 0);
  assert.equal(health.offline.count, 0);
});

test('generateDashboardBriefingHtml produces semantic printable slip markup with health matrix', () => {
  let state = createInitialState(['Briefing Cust 1', 'Briefing Cust 2']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state.customers[0].serviceStatus = 'active';
  state.customers[0].area = 'Main Bazaar';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);

  const html = generateDashboardBriefingHtml(state, refDate);

  assert.ok(html.includes('EXECUTIVE LEDGER BRIEFING'));
  assert.ok(html.includes('SHAHDARA ISP OPERATIONS'));
  assert.ok(html.includes('SUBSCRIBER HEALTH MATRIX'));
  assert.ok(html.includes('MONTHLY FINANCIAL PERFORMANCE'));
  assert.ok(html.includes('Good Standing:'));
  assert.ok(html.includes('Watchlist (1 Due):'));
  assert.ok(html.includes('Main Bazaar'));
  assert.ok(html.includes('Authorized Signature:'));
});

test('renderCustomerHealthSvg renders accessible SVG progress bar and metric cells', () => {
  const healthData = {
    totalTracked: 10,
    goodStanding: { category: 'goodStanding', label: 'Good Standing', count: 6, percent: 60, totalDue: 0 },
    watchlist: { category: 'watchlist', label: 'Watchlist', count: 2, percent: 20, totalDue: 2400 },
    delinquent: { category: 'delinquent', label: 'Delinquent', count: 1, percent: 10, totalDue: 3000 },
    offline: { category: 'offline', label: 'Offline', count: 1, percent: 10, totalDue: 1500 }
  };

  const svg = renderCustomerHealthSvg(healthData);

  assert.ok(svg.includes('chart-health-svg'));
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('aria-label="Customer Health and Delinquency Distribution Chart'));
  assert.ok(svg.includes('fill="#10b981"'));
  assert.ok(svg.includes('fill="#f59e0b"'));
  assert.ok(svg.includes('fill="#ef4444"'));
  assert.ok(svg.includes('fill="#64748b"'));
  assert.ok(svg.includes('Good Standing'));
  assert.ok(svg.includes('Watchlist'));
  assert.ok(svg.includes('Delinquent'));
  assert.ok(svg.includes('Offline'));
  assert.ok(svg.includes('Total 10 tracked unarchived customer accounts'));
});

test('renderCustomerHealthSvg renders empty state when zero customers exist', () => {
  const emptyHealth = { totalTracked: 0 };
  const svg = renderCustomerHealthSvg(emptyHealth);

  assert.ok(svg.includes('chart-health-svg'));
  assert.ok(svg.includes('No customer accounts found'));
  assert.ok(svg.includes('Add customers to see health standing distribution'));
});

test('renderMonthlyTrendSvg renders milestone target line and legend badge when targetRevenue is specified', () => {
  const trends = [
    { month: '2026-08', monthLabel: "Aug '26", billed: 10000, collected: 8500 },
    { month: '2026-09', monthLabel: "Sep '26", billed: 12000, collected: 11000 },
    { month: '2026-10', monthLabel: "Oct '26", billed: 15000, collected: 12500 }
  ];

  const svgWithTarget = renderMonthlyTrendSvg(trends, { targetRevenue: 14000 });

  assert.ok(svgWithTarget.includes('chart-target-line'));
  assert.ok(svgWithTarget.includes('chart-target-label'));
  assert.ok(svgWithTarget.includes('Target:'));
  assert.ok(svgWithTarget.includes('Target Milestone'));

  const svgWithoutTarget = renderMonthlyTrendSvg(trends);
  assert.ok(!svgWithoutTarget.includes('chart-target-line'));
  assert.ok(!svgWithoutTarget.includes('Target Milestone'));
});

test('setupCustomerHealthActions wires click handler to health filter buttons', () => {
  const listeners = [];
  const fakeGoodBtn = {
    getAttribute: (attr) => (attr === 'data-filter-health' ? 'goodStanding' : null),
    dataset: {},
    addEventListener: (evt, fn) => listeners.push({ btn: 'good', fn })
  };
  const fakeOfflineBtn = {
    getAttribute: (attr) => (attr === 'data-filter-health' ? 'offline' : null),
    dataset: {},
    addEventListener: (evt, fn) => listeners.push({ btn: 'offline', fn })
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    querySelectorAll: (sel) => (sel === '[data-filter-health]' ? [fakeGoodBtn, fakeOfflineBtn] : [])
  };

  try {
    let capturedCategory = null;
    let capturedData = null;
    const state = createInitialState(['Alice']);

    setupCustomerHealthActions(state, new Date('2026-10-15'), {
      onFilterHealth: (cat, data) => {
        capturedCategory = cat;
        capturedData = data;
      }
    });

    assert.equal(listeners.length, 2);
    // Trigger good button click
    listeners[0].fn();
    assert.equal(capturedCategory, 'goodStanding');
    assert.ok(capturedData !== null);
    assert.equal(capturedData.totalTracked, 1);

    // Trigger offline button click
    listeners[1].fn();
    assert.equal(capturedCategory, 'offline');
  } finally {
    globalThis.document = originalDocument;
  }
});

test('setupDashboardBriefingModal wires modal open, slip rendering, copy, print, and whatsapp', async () => {
  let modalOpened = false;
  let printCalled = false;
  let windowOpenUrl = null;
  let copiedText = null;
  let slipHtml = null;

  const fakeModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    dataset: {},
    addEventListener: () => {}
  };
  const fakeSlip = {
    set innerHTML(val) { slipHtml = val; }
  };
  const fakeOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { fakeOpenBtn.onClick = fn; }
  };
  const fakeCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { fakeCloseBtn.onClick = fn; }
  };
  const fakePrintBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { fakePrintBtn.onClick = fn; }
  };
  const fakeCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { fakeCopyBtn.onClick = fn; }
  };
  const fakeWhatsappBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { fakeWhatsappBtn.onClick = fn; }
  };

  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'dashboardBriefingModal': return fakeModal;
        case 'dashboardBriefingSlipContent': return fakeSlip;
        case 'quickActionExecutiveBriefing': return fakeOpenBtn;
        case 'dashboardBriefingModalCloseBtn': return fakeCloseBtn;
        case 'dashboardBriefingPrintBtn': return fakePrintBtn;
        case 'dashboardBriefingCopyBtn': return fakeCopyBtn;
        case 'dashboardBriefingWhatsappBtn': return fakeWhatsappBtn;
        default: return null;
      }
    }
  };

  globalThis.window = {
    print: () => { printCalled = true; },
    open: (url) => { windowOpenUrl = url; }
  };

  try {
    const state = createInitialState(['Briefing Cust']);
    let toastMessage = null;

    setupDashboardBriefingModal(state, new Date('2026-10-15'), {
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    // Test open tile click
    fakeOpenBtn.onClick();
    assert.equal(modalOpened, true);
    assert.ok(slipHtml.includes('EXECUTIVE LEDGER BRIEFING'));

    // Test print button click
    fakePrintBtn.onClick();
    assert.equal(printCalled, true);

    // Test whatsapp button click
    fakeWhatsappBtn.onClick();
    assert.ok(windowOpenUrl.startsWith('https://api.whatsapp.com/send?text='));

    // Test copy button click
    await fakeCopyBtn.onClick();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA ISP'));
    assert.equal(toastMessage, 'Briefing text copied to clipboard!');

    // Test close button
    fakeCloseBtn.onClick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test('calculatePaymentMethodBreakdown accurately classifies cash and digital methods, calculates percentages and ticket averages', () => {
  let state = createInitialState(['User Cash', 'User JazzCash', 'User Shop']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const month = '2026-10';

  // Add payments: 1000 Cash, 2000 JazzCash, 1000 Cash at Waseem Abbasi shop
  state = saveBillMonth(state, state.customers[0].id, { month, dueAmount: '1000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, month, { amount: '1000', date: '2026-10-02', method: 'Cash' }, refDate);

  state = saveBillMonth(state, state.customers[1].id, { month, dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, month, { amount: '2000', date: '2026-10-03', method: 'JazzCash' }, refDate);

  state = saveBillMonth(state, state.customers[2].id, { month, dueAmount: '1000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[2].id, month, { amount: '1000', date: '2026-10-04', method: 'Cash at Waseem Abbasi shop' }, refDate);

  const breakdown = calculatePaymentMethodBreakdown(state, refDate, { period: 'currentMonth' });

  assert.equal(breakdown.totalAmount, 4000);
  assert.equal(breakdown.totalCount, 3);
  assert.equal(breakdown.cashTotal, 2000); // 1000 Cash + 1000 shop
  assert.equal(breakdown.digitalTotal, 2000); // 2000 JazzCash
  assert.equal(breakdown.cashPercent, 50);
  assert.equal(breakdown.digitalPercent, 50);

  assert.equal(breakdown.methods.length, 3);
  const jazz = breakdown.methods.find(m => m.method === 'JazzCash');
  assert.ok(jazz);
  assert.equal(jazz.amount, 2000);
  assert.equal(jazz.percent, 50);
  assert.equal(jazz.count, 1);
  assert.equal(jazz.isDigital, true);
});

test('calculatePaymentMethodBreakdown filters by period and handles empty state gracefully', () => {
  let state = createInitialState(['User Old', 'User Recent']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Payment in 2026-08 (older than 30 days)
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-08', dueAmount: '1500', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-08', { amount: '1500', date: '2026-08-10', method: 'Bank Transfer' }, refDate);

  // Payment in 2026-10 (current month)
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '2500', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-10', { amount: '2500', date: '2026-10-10', method: 'Easypaisa' }, refDate);

  // Current month filter: should only return 2026-10 payment
  const currentMonthData = calculatePaymentMethodBreakdown(state, refDate, { period: 'currentMonth' });
  assert.equal(currentMonthData.totalAmount, 2500);
  assert.equal(currentMonthData.totalCount, 1);
  assert.equal(currentMonthData.methods[0].method, 'Easypaisa');

  // All time filter: should return both payments
  const allData = calculatePaymentMethodBreakdown(state, refDate, { period: 'all' });
  assert.equal(allData.totalAmount, 4000);
  assert.equal(allData.totalCount, 2);

  // Empty state test
  const emptyState = { version: 1, nextCustomerNumber: 1, customers: [], inventoryItems: [], inventoryMovements: [], expenses: [], saadAttendanceDays: [], umairWorkdays: [], monthlyClosings: [] };
  const emptyData = calculatePaymentMethodBreakdown(emptyState, refDate, { period: 'currentMonth' });
  assert.equal(emptyData.totalAmount, 0);
  assert.equal(emptyData.totalCount, 0);
  assert.equal(emptyData.methods.length, 0);
});

test('renderPaymentMethodSvg returns accessible empty state SVG when no receipts exist', () => {
  const emptyData = { methods: [], totalAmount: 0, totalCount: 0, cashTotal: 0, digitalTotal: 0, cashPercent: 0, digitalPercent: 0, period: 'currentMonth' };
  const svg = renderPaymentMethodSvg(emptyData);

  assert.ok(svg.includes('<svg class="chart-svg chart-methods-svg"'));
  assert.ok(svg.includes('No Payment Receipts Recorded'));
  assert.ok(svg.includes('No receipts found for the selected time filter'));
});

test('renderPaymentMethodSvg generates valid SVG donut chart with slices, center total PKR, and method legend', () => {
  const data = {
    methods: [
      { method: 'Cash', amount: 3000, count: 2, percent: 60, avgAmount: 1500, isDigital: false },
      { method: 'JazzCash', amount: 2000, count: 1, percent: 40, avgAmount: 2000, isDigital: true }
    ],
    totalAmount: 5000,
    totalCount: 3,
    cashTotal: 3000,
    digitalTotal: 2000,
    cashPercent: 60,
    digitalPercent: 40,
    period: 'currentMonth'
  };

  const svg = renderPaymentMethodSvg(data);

  assert.ok(svg.includes('<svg class="chart-svg chart-methods-svg"'));
  assert.ok(svg.includes('donut-slice'));
  assert.ok(svg.includes('PKR 5,000'));
  assert.ok(svg.includes('3 receipts'));
  assert.ok(svg.includes('Cash 60%'));
  assert.ok(svg.includes('Digital 40%'));
  assert.ok(svg.includes('JazzCash'));
});

test('calculateChurnRiskAnalysis identifies high, moderate, and low risk accounts based on offline status and delinquency', () => {
  let state = createInitialState(['Healthy Cust', 'Offline Overdue', 'Consecutive Dues', 'Moderate Cust']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Customer 0: Healthy (Active, no overdue dues)
  state.customers[0].serviceStatus = 'active';
  state.customers[0].packageSpeed = '15Mbps';

  // Customer 1: High Risk (Offline with overdue balance)
  state.customers[1].serviceStatus = 'offline';
  state.customers[1].packageSpeed = '15Mbps';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '1200', status: 'pending' }, refDate);

  // Customer 2: High Risk (2 overdue bills)
  state.customers[2].serviceStatus = 'active';
  state.customers[2].packageSpeed = '25Mbps';
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-09', dueAmount: '2000', status: 'pending' }, refDate);
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);

  // Customer 3: Moderate Risk (1 unpaid bill, active)
  state.customers[3].serviceStatus = 'active';
  state.customers[3].packageSpeed = '10Mbps';
  state = saveBillMonth(state, state.customers[3].id, { month: '2026-10', dueAmount: '1000', status: 'pending' }, refDate);

  const analysis = calculateChurnRiskAnalysis(state, refDate);

  assert.equal(analysis.totalCustomers, 4);
  assert.equal(analysis.highRisk.count, 2); // Customer 1 & 2
  assert.equal(analysis.moderateRisk.count, 1); // Customer 3
  assert.equal(analysis.lowRisk.count, 1); // Customer 0

  assert.equal(analysis.highRisk.totalDue, 5200); // 1200 + 4000
  assert.equal(analysis.moderateRisk.totalDue, 1000);
  assert.equal(analysis.atRiskRevenue, 6200);

  // Churn risk score: (2 * 1.0 + 1 * 0.5) / 4 = 2.5 / 4 = 62.5% -> 63%
  assert.equal(analysis.churnRiskScore, 63);
  assert.equal(analysis.riskTier, 'high');
  assert.equal(analysis.riskTierLabel, 'High Churn Risk');

  // Top at-risk customers sorted descending by totalDue
  assert.equal(analysis.topAtRiskCustomers.length, 3);
  assert.equal(analysis.topAtRiskCustomers[0].name, 'Consecutive Dues');
  assert.equal(analysis.topAtRiskCustomers[0].totalDue, 4000);
});

test('renderChurnRiskGaugeSvg returns accessible empty state when no customers exist', () => {
  const emptyAnalysis = { totalCustomers: 0, churnRiskScore: 0, riskTier: 'low', riskTierLabel: 'Low Churn Risk', atRiskRevenue: 0, highRisk: { count: 0, percent: 0, totalDue: 0, customers: [] }, moderateRisk: { count: 0, percent: 0, totalDue: 0, customers: [] }, lowRisk: { count: 0, percent: 0, customers: [] }, topAtRiskCustomers: [] };
  const svg = renderChurnRiskGaugeSvg(emptyAnalysis);

  assert.ok(svg.includes('<svg class="chart-svg chart-churn-svg"'));
  assert.ok(svg.includes('No Customer Profiles in Ledger'));
});

test('renderChurnRiskGaugeSvg generates valid semicircular gauge with score needle and cohort summary cards', () => {
  const analysis = {
    totalCustomers: 10,
    churnRiskScore: 40,
    riskTier: 'high',
    riskTierLabel: 'High Churn Risk',
    atRiskRevenue: 15000,
    highRisk: { count: 3, percent: 30, totalDue: 10000, customers: [] },
    moderateRisk: { count: 2, percent: 20, totalDue: 5000, customers: [] },
    lowRisk: { count: 5, percent: 50, customers: [] },
    topAtRiskCustomers: []
  };

  const svg = renderChurnRiskGaugeSvg(analysis);

  assert.ok(svg.includes('<svg class="chart-svg chart-churn-svg"'));
  assert.ok(svg.includes('gauge-zones'));
  assert.ok(svg.includes('gauge-pointer'));
  assert.ok(svg.includes('40%'));
  assert.ok(svg.includes('High Churn Risk'));
  assert.ok(svg.includes('High Risk'));
  assert.ok(svg.includes('Moderate Risk'));
  assert.ok(svg.includes('Healthy Retained'));
  assert.ok(svg.includes('PKR 15,000'));
});

test('setupChurnRiskModal opens dialog, renders at-risk subscriber list, wires filter roster action, and handles close', () => {
  let modalOpened = false;
  let tableHtml = '';
  let filterCustomerCalled = null;

  const fakeModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    dataset: {},
    addEventListener: () => {}
  };
  const fakeTableBody = {
    set innerHTML(val) { tableHtml = val; },
    querySelectorAll: () => [
      {
        getAttribute: (attr) => attr === 'data-filter-customer' ? 'At-Risk Subscriber' : null,
        addEventListener: (evt, fn) => { fakeTableBody.onBtnClick = fn; }
      }
    ]
  };
  const fakeOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { fakeOpenBtn.onClick = fn; }
  };
  const fakeCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { fakeCloseBtn.onClick = fn; }
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'dashboardChurnRiskModal': return fakeModal;
        case 'dashboardOpenChurnModalBtn': return fakeOpenBtn;
        case 'dashboardChurnModalCloseBtn': return fakeCloseBtn;
        case 'dashboardChurnModalTableBody': return fakeTableBody;
        default: return null;
      }
    }
  };

  try {
    let state = createInitialState(['At-Risk Subscriber']);
    state.customers[0].serviceStatus = 'offline';
    state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, new Date('2026-10-15'));

    setupChurnRiskModal(state, new Date('2026-10-15'), {
      onFilterCustomer: (name) => { filterCustomerCalled = name; }
    });

    // Test open button click
    fakeOpenBtn.onClick();
    assert.equal(modalOpened, true);
    assert.ok(tableHtml.includes('At-Risk Subscriber'));
    assert.ok(tableHtml.includes('PKR 3,000'));

    // Test filter roster button click
    fakeTableBody.onBtnClick();
    assert.equal(filterCustomerCalled, 'At-Risk Subscriber');
    assert.equal(modalOpened, false);

    // Test close button click
    fakeCloseBtn.onClick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('setupDashboardChartsEvents handles payment method period toggle clicks', () => {
  let periodChangeHandler = null;

  const fakeMethodGroup = {
    dataset: {},
    addEventListener: (evt, fn) => { periodChangeHandler = fn; }
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardMethodRangeGroup') return fakeMethodGroup;
      return null;
    },
    querySelectorAll: () => []
  };

  try {
    setMethodChartPeriod('currentMonth');
    assert.equal(getMethodChartPeriod(), 'currentMonth');

    setupDashboardChartsEvents({}, new Date('2026-10-15'));
    assert.ok(periodChangeHandler !== null);

    // Simulate clicking 30D button
    periodChangeHandler({
      target: {
        closest: (sel) => ({
          dataset: { period: '30days' },
          getAttribute: () => '30days'
        })
      }
    });

    assert.equal(getMethodChartPeriod(), '30days');
  } finally {
    globalThis.document = originalDocument;
    setMethodChartPeriod('currentMonth');
  }
});

test('generateDashboardBriefingText and generateDashboardBriefingHtml include payment method settlement and churn risk sections', () => {
  let state = createInitialState(['Briefing Cust']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '2000', date: '2026-10-05', method: 'JazzCash' }, refDate);

  const text = generateDashboardBriefingText(state, refDate);
  assert.ok(text.includes('[ RETENTION & CHURN RISK ]'));
  assert.ok(text.includes('Churn Risk Score:'));
  assert.ok(text.includes('[ PAYMENT SETTLEMENT CHANNELS (2026-10) ]'));
  assert.ok(text.includes('JazzCash:'));

  const html = generateDashboardBriefingHtml(state, refDate);
  assert.ok(html.includes('RETENTION &amp; CHURN RISK'));
  assert.ok(html.includes('PAYMENT SETTLEMENT CHANNELS (2026-10)'));
  assert.ok(html.includes('JazzCash'));
  assert.ok(text.includes('[ GEOGRAPHIC COLLECTION HEATMAP (2026-10) ]'));
  assert.ok(text.includes('Overall Area Recovery:'));
  assert.ok(html.includes('GEOGRAPHIC COLLECTION HEATMAP (2026-10)'));
  assert.ok(html.includes('Overall Recovery:'));
});

test('calculateAreaCollectionHeatmap accurately calculates recovery rates, billed and collected amounts, and assigns efficiency tiers', () => {
  let state = createInitialState(['AreaCust A', 'AreaCust B', 'AreaCust C']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Customer A in Shahdara Town: Billed 2000, Paid 2000 -> 100% (high/optimal)
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '2000', date: '2026-10-02', method: 'Cash' }, refDate);

  // Customer B in Kot Abdul Malik: Billed 3000, Paid 2100 -> 70% (moderate)
  state.customers[1].area = 'Kot Abdul Malik';
  state.customers[1].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-10', { amount: '2100', date: '2026-10-04', method: 'JazzCash' }, refDate);

  // Customer C in Begum Kot: Billed 2000, Paid 800 -> 40% (lagging)
  state.customers[2].area = 'Begum Kot';
  state.customers[2].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[2].id, '2026-10', { amount: '800', date: '2026-10-06', method: 'Easypaisa' }, refDate);

  const heatmap = calculateAreaCollectionHeatmap(state, refDate);
  assert.equal(heatmap.currentMonth, '2026-10');
  assert.equal(heatmap.areas.length, 3);

  const shahdara = heatmap.areas.find(a => a.area === 'Shahdara Town');
  assert.ok(shahdara);
  assert.equal(shahdara.billed, 2000);
  assert.equal(shahdara.collected, 2000);
  assert.equal(shahdara.totalDue, 0);
  assert.equal(shahdara.recoveryRate, 100);
  assert.equal(shahdara.tier, 'high');
  assert.equal(shahdara.tierLabel, 'Optimal Recovery');
  assert.equal(shahdara.heatColor, '#10b981');

  const kot = heatmap.areas.find(a => a.area === 'Kot Abdul Malik');
  assert.ok(kot);
  assert.equal(kot.billed, 3000);
  assert.equal(kot.collected, 2100);
  assert.equal(kot.totalDue, 900);
  assert.equal(kot.recoveryRate, 70);
  assert.equal(kot.tier, 'moderate');
  assert.equal(kot.tierLabel, 'Moderate Recovery');
  assert.equal(kot.heatColor, '#f59e0b');

  const begum = heatmap.areas.find(a => a.area === 'Begum Kot');
  assert.ok(begum);
  assert.equal(begum.billed, 2000);
  assert.equal(begum.collected, 800);
  assert.equal(begum.totalDue, 1200);
  assert.equal(begum.recoveryRate, 40);
  assert.equal(begum.tier, 'lagging');
  assert.equal(begum.tierLabel, 'Lagging Collection');
  assert.equal(begum.heatColor, '#ef4444');

  // Summary assertions
  assert.equal(heatmap.summary.totalAreas, 3);
  assert.equal(heatmap.summary.highRecoveryCount, 1);
  assert.equal(heatmap.summary.moderateRecoveryCount, 1);
  assert.equal(heatmap.summary.laggingCount, 1);
  assert.equal(heatmap.summary.totalBilled, 7000);
  assert.equal(heatmap.summary.totalCollected, 4900);
  assert.equal(heatmap.summary.totalOutstanding, 2100);
  assert.equal(heatmap.summary.overallRecoveryRate, 70);
  assert.equal(heatmap.summary.topPerformingArea.area, 'Shahdara Town');
  assert.equal(heatmap.summary.topPerformingArea.rate, 100);
  assert.equal(heatmap.summary.highestDueArea.area, 'Begum Kot');
  assert.equal(heatmap.summary.highestDueArea.due, 1200);
});

test('calculateAreaCollectionHeatmap handles empty states, unassigned areas, and archived customers', () => {
  let state = createInitialState(['Unassigned Cust', 'Archived Cust']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Customer 0 has no area set
  state.customers[0].area = '';
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '1500', status: 'pending' }, refDate);

  // Customer 1 is archived
  state.customers[1].area = 'Hidden Area';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '2500', status: 'pending' }, refDate);
  state.customers[1].archived = true;

  const heatmap = calculateAreaCollectionHeatmap(state, refDate);
  assert.equal(heatmap.areas.length, 1);
  assert.equal(heatmap.areas[0].area, 'Unassigned');
  assert.equal(heatmap.areas[0].billed, 1500);
  assert.equal(heatmap.areas[0].collected, 0);
  assert.equal(heatmap.areas[0].recoveryRate, 0);
  assert.equal(heatmap.areas[0].tier, 'lagging');

  // Completely empty state
  const emptyHeatmap = calculateAreaCollectionHeatmap({ customers: [] }, refDate);
  assert.equal(emptyHeatmap.areas.length, 0);
  assert.equal(emptyHeatmap.summary.totalAreas, 0);
  assert.equal(emptyHeatmap.summary.overallRecoveryRate, 0);
  assert.equal(emptyHeatmap.summary.topPerformingArea, null);
  assert.equal(emptyHeatmap.summary.highestDueArea, null);
});

test('renderAreaCollectionHeatmapSvg generates accessible SVG with summary chips and filters correctly', () => {
  const dummyData = {
    currentMonth: '2026-10',
    areas: [
      {
        area: 'Shahdara Town',
        customerCount: 10,
        activeCount: 8,
        offlineCount: 2,
        billed: 16000,
        collected: 15000,
        totalDue: 1000,
        recoveryRate: 94,
        tier: 'high',
        tierLabel: 'Optimal Recovery',
        heatColor: '#10b981',
        arpu: 2000
      },
      {
        area: 'Vandala Dial Shah',
        customerCount: 6,
        activeCount: 5,
        offlineCount: 1,
        billed: 10000,
        collected: 4000,
        totalDue: 6000,
        recoveryRate: 40,
        tier: 'lagging',
        tierLabel: 'Lagging Collection',
        heatColor: '#ef4444',
        arpu: 2000
      }
    ],
    summary: {
      totalAreas: 2,
      highRecoveryCount: 1,
      moderateRecoveryCount: 0,
      laggingCount: 1,
      totalBilled: 26000,
      totalCollected: 19000,
      totalOutstanding: 7000,
      overallRecoveryRate: 73,
      topPerformingArea: { area: 'Shahdara Town', rate: 94 },
      highestDueArea: { area: 'Vandala Dial Shah', due: 6000 }
    }
  };

  // 'all' filter renders both areas and status chips
  const svgAll = renderAreaCollectionHeatmapSvg(dummyData, { filter: 'all' });
  assert.ok(svgAll.includes('<svg class="chart-svg chart-heatmap-svg"'));
  assert.ok(svgAll.includes('Optimal: <tspan fill="#047857">1</tspan>'));
  assert.ok(svgAll.includes('Lagging: <tspan fill="#b91c1c">1</tspan>'));
  assert.ok(svgAll.includes('Shahdara Town'));
  assert.ok(svgAll.includes('Vandala Dial Shah'));
  assert.ok(svgAll.includes('94%'));
  assert.ok(svgAll.includes('40%'));

  // 'high' filter renders only optimal areas
  const svgHigh = renderAreaCollectionHeatmapSvg(dummyData, { filter: 'high' });
  assert.ok(svgHigh.includes('Shahdara Town'));
  assert.ok(!svgHigh.includes('Vandala Dial Shah'));

  // 'moderate' filter has 0 areas, renders filter empty state
  const svgMod = renderAreaCollectionHeatmapSvg(dummyData, { filter: 'moderate' });
  assert.ok(svgMod.includes('No operational areas match the "moderate" recovery filter.'));

  // empty data fallback
  const svgEmpty = renderAreaCollectionHeatmapSvg(null);
  assert.ok(svgEmpty.includes('No area collection data recorded'));
});

test('setHeatmapFilter and getHeatmapFilter validate and manage filter states', () => {
  setHeatmapFilter('all');
  assert.equal(getHeatmapFilter(), 'all');

  setHeatmapFilter('high');
  assert.equal(getHeatmapFilter(), 'high');

  setHeatmapFilter('moderate');
  assert.equal(getHeatmapFilter(), 'moderate');

  setHeatmapFilter('lagging');
  assert.equal(getHeatmapFilter(), 'lagging');

  // Invalid value should be rejected
  setHeatmapFilter('invalid-heat');
  assert.equal(getHeatmapFilter(), 'lagging');

  // Reset to 'all'
  setHeatmapFilter('all');
});

test('setupDashboardChartsEvents handles heatmap filter button clicks', () => {
  let filterClickHandler = null;

  const fakeHeatmapGroup = {
    dataset: {},
    addEventListener: (evt, fn) => { filterClickHandler = fn; }
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardHeatmapActions') return fakeHeatmapGroup;
      return null;
    },
    querySelectorAll: () => []
  };

  try {
    setHeatmapFilter('all');
    assert.equal(getHeatmapFilter(), 'all');

    setupDashboardChartsEvents({}, new Date('2026-10-15'));
    assert.ok(filterClickHandler !== null);

    // Simulate clicking 'high' button
    filterClickHandler({
      target: {
        closest: (sel) => ({
          dataset: { filterHeat: 'high' },
          getAttribute: () => 'high'
        })
      }
    });

    assert.equal(getHeatmapFilter(), 'high');
  } finally {
    globalThis.document = originalDocument;
    setHeatmapFilter('all');
  }
});

test('setupAreaHeatmapEvents wires click on area row to onFilterArea callback', () => {
  let clickHandler = null;
  let clickedArea = null;

  const fakeContainer = {
    dataset: {},
    addEventListener: (evt, fn) => { clickHandler = fn; }
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardHeatmapChart') return fakeContainer;
      return null;
    }
  };

  try {
    setupAreaHeatmapEvents({}, new Date('2026-10-15'), {
      onFilterArea: (name) => { clickedArea = name; }
    });

    assert.ok(clickHandler !== null);

    // Simulate clicking an area row
    clickHandler({
      target: {
        closest: (sel) => ({
          getAttribute: (attr) => (attr === 'aria-label' ? 'Begum Kot: Recovery 75%, Collected 1500, Due 500' : '')
        })
      }
    });

    assert.equal(clickedArea, 'Begum Kot');
  } finally {
    globalThis.document = originalDocument;
  }
});

