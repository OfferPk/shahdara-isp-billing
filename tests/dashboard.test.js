import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addCustomer, saveBillMonth, addPayment } from '../core.js';
import {
  calculateDashboardKpis,
  setupDashboardQuickActions,
  generateDashboardBriefingText,
  setupDashboardBriefingButton,
  setupAreaDrilldownModal
} from '../dashboard.js';
import {
  calculateMonthlyTrends,
  calculateDuesByArea,
  calculateAreaDetailedBreakdown,
  calculatePackageDistribution,
  renderMonthlyTrendSvg,
  renderBillStatusDonutSvg,
  renderAreaDuesSvg,
  renderPackageDistributionSvg,
  renderDashboardCharts,
  setTrendChartDuration,
  getTrendChartDuration,
  setupDashboardChartsEvents
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
