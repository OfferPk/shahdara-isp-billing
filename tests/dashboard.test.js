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
  setupAreaHeatmapEvents,
  calculateDailyClosingSummary,
  generateDailyClosingSlipText,
  setupDailyClosingCard,
  calculateSeasonalCashflowComparison,
  renderSeasonalCashflowSvg,
  calculatePackageMarginBreakdown,
  simulateMarginAdjustment,
  renderPackageMarginSvg,
  generateMarginSimulationReportText,
  setupMarginSimulatorModal,
  calculateCustomerLtvCohorts,
  generateLtvBriefingReport,
  setupLtvCohortModal,
  renderCustomerLtvCohortsSvg,
  calculateIncidentImpactMatrix,
  generateIncidentBriefingReport,
  setupIncidentImpactModal,
  renderIncidentImpactSvg,
  calculateCashflowProjections,
  generateProjectionBriefingText,
  setupProjectionScenarioModal,
  renderCashflowProjectionSvg,
  renderUpstreamGatewaySvg,
  calculateUpstreamGatewayMetrics,
  generateUpstreamBriefingReport,
  setupUpstreamGatewayModal,
  calculateAcquisitionRoiMetrics,
  generateAcquisitionBriefingReport,
  setupAcquisitionRoiModal,
  renderAcquisitionRoiSvg,
  resolveCustomerAcquisitionChannel,
  ACQUISITION_CHANNELS,
  calculateBandwidthShapingMetrics,
  generateBandwidthShapingReport,
  setupBandwidthShapingModal,
  renderBandwidthShapingSvg,
  calculateFiberDistributionMetrics,
  generateFiberDistributionReport,
  setupFiberDistributionModal,
  renderFiberDistributionSvg,
  DELINQUENCY_STAGES,
  calculateDelinquencyRecoveryPipeline,
  generateDelinquencyPipelineReport,
  setupDelinquencyPipelineModal,
  renderDelinquencyPipelineSvg,
  CPE_STANDARD_MODELS,
  resolveSubscriberCpeModel,
  calculateCpeAssetMetrics,
  generateCpeAssetBriefing,
  setupCpeAssetModal,
  renderCpeAssetLifecycleSvg,
  SHAHDARA_POWER_HUBS,
  calculatePowerBackupMetrics,
  generatePowerBriefingReport,
  setupPowerBackupModal,
  renderPowerBackupSvg,
  calculateRouteDensityMetrics,
  generateRouteDensityReport,
  setupRouteDensityModal,
  renderRouteDensityMatrixSvg,
  setProjectionScenario,
  getProjectionScenario,
  setLtvMetric,
  getLtvMetric,
  setSeasonalMetric,
  getSeasonalMetric,
  setMarginSimulatorCostPerMbps,
  getMarginSimulatorCostPerMbps,
  SHAHDARA_FIBER_ROUTES,
  calculateOtdrFaultMetrics,
  generateOtdrReport,
  setupOtdrModal,
  getOtdrSelectedRoute,
  setOtdrSelectedRoute,
  getOtdrWavelength,
  setOtdrWavelength,
  getOtdrSimulatedDistance,
  setOtdrSimulatedDistance,
  renderOtdrTraceSvg,
  SHAHDARA_SOLAR_HUBS,
  calculateSolarInverterMetrics,
  generateSolarReport,
  setupSolarModal,
  getSolarSelectedHub,
  setSolarSelectedHub,
  getSolarMode,
  setSolarMode,
  getSolarIrradiance,
  setSolarIrradiance,
  renderSolarInverterSvg,
  SHAHDARA_AERIAL_SECTORS,
  SHAHDARA_CABLE_TYPES,
  calculateAerialTensionMetrics,
  generateAerialTensionReport,
  setupAerialTensionModal,
  getAerialSelectedSector,
  setAerialSelectedSector,
  getAerialWindSpeed,
  setAerialWindSpeed,
  getAerialTemperature,
  setAerialTemperature,
  getAerialCableType,
  setAerialCableType,
  renderAerialTensionSvg,
  SHAHDARA_MICROWAVE_LINKS,
  calculateMicrowaveLinkBudget,
  generateMicrowaveBriefingReport,
  setupMicrowaveModal,
  getMicrowaveSelectedLink,
  setMicrowaveSelectedLink,
  getMicrowaveRainRate,
  setMicrowaveRainRate,
  getMicrowaveFrequencyOverride,
  setMicrowaveFrequencyOverride,
  renderMicrowaveLinkSvg,
  SHAHDARA_SPLICE_CLOSURES,
  calculateBendAttenuation,
  calculateSpliceClosureMetrics,
  generateSpliceClosureReport,
  setupSpliceClosureModal,
  getSpliceSelectedClosure,
  setSpliceSelectedClosure,
  getSpliceBendRadius,
  setSpliceBendRadius,
  getSpliceAddedTrays,
  setSpliceAddedTrays,
  renderSpliceClosureSvg
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

test('calculateDailyClosingSummary computes accurate collections, benchmark targets, and status today', () => {
  let state = createInitialState(['Closing Cust A', 'Closing Cust B']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Customer A: Billed 3100 in 2026-10 (October has 31 days -> dailyTarget = 6200 / 31 = 200)
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3100', status: 'pending' }, refDate);
  // Payment today
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '2000', date: '2026-10-15', method: 'Cash' }, refDate);
  // Payment earlier in month
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '1000', date: '2026-10-05', method: 'Cash' }, refDate);

  // Customer B: Billed 3100
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '3100', status: 'pending' }, refDate);
  // Payment today
  state = addPayment(state, state.customers[1].id, '2026-10', { amount: '1500', date: '2026-10-15', method: 'JazzCash' }, refDate);

  const summary = calculateDailyClosingSummary(state, refDate);
  assert.equal(summary.todayStr, '2026-10-15');
  assert.equal(summary.todayCollected, 3500);
  assert.equal(summary.todayCount, 2);
  assert.equal(summary.averageTicket, 1750);
  assert.equal(summary.dailyTarget, 200); // 6200 / 31 = 200
  assert.ok(summary.targetAttainment > 100);
  assert.equal(summary.closingStatus, 'exceeded');
  assert.equal(summary.statusLabel, 'Target Met (100%+)');

  assert.equal(summary.methods.length, 2);
  const cash = summary.methods.find(m => m.method === 'Cash');
  assert.ok(cash);
  assert.equal(cash.amount, 2000);
  const jc = summary.methods.find(m => m.method === 'JazzCash');
  assert.ok(jc);
  assert.equal(jc.amount, 1500);

  // Empty day
  const emptyDaySummary = calculateDailyClosingSummary(state, new Date('2026-10-16T12:00:00+05:00'));
  assert.equal(emptyDaySummary.todayCollected, 0);
  assert.equal(emptyDaySummary.todayCount, 0);
  assert.equal(emptyDaySummary.closingStatus, 'no-activity');
});

test('generateDailyClosingSlipText formats complete daily closing text', () => {
  let state = createInitialState(['Slip Cust']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '2000', date: '2026-10-15', method: 'Easypaisa' }, refDate);

  const text = generateDailyClosingSlipText(state, refDate);
  assert.ok(text.includes('DAILY REGISTER CLOSING'));
  assert.ok(text.includes('Date: 2026-10-15 PKT'));
  assert.ok(text.includes('Total Collections Today:'));
  assert.ok(text.includes('Easypaisa:'));
});

test('setupDailyClosingCard populates DOM elements and wires clipboard copy', async () => {
  let state = createInitialState(['Card Cust']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3100', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '1200', date: '2026-10-15', method: 'Cash' }, refDate);

  const mockValue = { textContent: '' };
  const mockPeriod = { textContent: '' };
  const mockBadge = { textContent: '', className: '' };
  let clickHandler = null;
  const mockBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { clickHandler = fn; }
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardDailyClosingValue') return mockValue;
      if (id === 'dashboardDailyClosingPeriod') return mockPeriod;
      if (id === 'dashboardClosingStatusBadge') return mockBadge;
      if (id === 'quickActionDailyClosingSlip') return mockBtn;
      return null;
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (str) => { copiedText = str; }
  };

  try {
    setupDailyClosingCard(state, refDate, {
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(mockValue.textContent.includes('1 tx'));
    assert.ok(mockPeriod.textContent.includes('Target:'));
    assert.ok(mockBadge.className.includes('closing-badge'));

    assert.ok(clickHandler !== null);
    await clickHandler();
    assert.ok(copiedText.includes('DAILY REGISTER CLOSING'));
    assert.equal(toastMessage, 'Daily closing slip copied to clipboard!');
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateSeasonalCashflowComparison handles empty state gracefully', () => {
  const state = createInitialState([]);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const res = calculateSeasonalCashflowComparison(state, refDate);

  assert.equal(res.currentYear, 2026);
  assert.equal(res.priorYear, 2025);
  assert.equal(res.months.length, 12);
  assert.equal(res.currentYearAnnualTotal, 0);
  assert.equal(res.priorYearAnnualTotal, 0);
  assert.equal(res.hasPriorYearData, false);
  assert.equal(res.hasCurrentYearData, false);
  assert.equal(res.velocityStatus, 'Baseline Period');
});

test('calculateSeasonalCashflowComparison computes monthly and YoY metrics from transactions', () => {
  let state = createInitialState(['Customer Alpha', 'Customer Beta']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Prior year 2025 payments
  state = saveBillMonth(state, state.customers[0].id, { month: '2025-05', dueAmount: '3000', status: 'pending' }, new Date('2025-05-10T12:00:00+05:00'));
  state = addPayment(state, state.customers[0].id, '2025-05', { amount: '2500', date: '2025-05-15', method: 'Cash' }, new Date('2025-05-15T12:00:00+05:00'));

  // Current year 2026 payments
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-05', dueAmount: '3500', status: 'pending' }, new Date('2026-05-10T12:00:00+05:00'));
  state = addPayment(state, state.customers[0].id, '2026-05', { amount: '3500', date: '2026-05-12', method: 'Cash' }, new Date('2026-05-12T12:00:00+05:00'));

  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '5000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-10', { amount: '5000', date: '2026-10-05', method: 'JazzCash' }, refDate);

  const res = calculateSeasonalCashflowComparison(state, refDate, { metric: 'collections' });

  assert.equal(res.hasPriorYearData, true);
  assert.equal(res.hasCurrentYearData, true);
  assert.equal(res.priorYearAnnualTotal, 2500);
  assert.equal(res.currentYearAnnualTotal, 8500);

  // Month 4 (May) comparison
  const may = res.months[4];
  assert.equal(may.monthName, 'May');
  assert.equal(may.priorYearAmount, 2500);
  assert.equal(may.currentYearAmount, 3500);
  assert.equal(may.yoyGrowthPercent, 40);

  // October is peak
  assert.equal(res.peakMonth.monthName, 'Oct');
  assert.equal(res.peakMonth.currentYearAmount, 5000);
  assert.equal(res.velocityStatus, 'Accelerating');
});

test('calculateSeasonalCashflowComparison supports billed metric', () => {
  let state = createInitialState(['Customer Gamma']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-03', dueAmount: '4000', status: 'pending' }, refDate);

  const res = calculateSeasonalCashflowComparison(state, refDate, { metric: 'billed' });
  assert.equal(res.metric, 'billed');
  assert.equal(res.months[2].monthName, 'Mar');
  assert.equal(res.months[2].currentYearAmount, 4000);
});

test('renderSeasonalCashflowSvg renders empty state and populated chart', () => {
  const emptyRes = calculateSeasonalCashflowComparison(createInitialState([]), new Date('2026-10-15'));
  const emptySvg = renderSeasonalCashflowSvg(emptyRes);
  assert.ok(emptySvg.includes('No seasonal cashflow history yet'));

  const populatedData = {
    metric: 'collections',
    currentYear: 2026,
    priorYear: 2025,
    currentMonthIndex: 9,
    months: [
      { monthIndex: 0, monthName: 'Jan', currentYearAmount: 1000, priorYearAmount: 800, yoyGrowthPercent: 25 },
      { monthIndex: 1, monthName: 'Feb', currentYearAmount: 1200, priorYearAmount: 900, yoyGrowthPercent: 33.3 },
      { monthIndex: 2, monthName: 'Mar', currentYearAmount: 1100, priorYearAmount: 1000, yoyGrowthPercent: 10 },
      { monthIndex: 3, monthName: 'Apr', currentYearAmount: 1500, priorYearAmount: 1200, yoyGrowthPercent: 25 },
      { monthIndex: 4, monthName: 'May', currentYearAmount: 1800, priorYearAmount: 1300, yoyGrowthPercent: 38.5 },
      { monthIndex: 5, monthName: 'Jun', currentYearAmount: 1400, priorYearAmount: 1200, yoyGrowthPercent: 16.7 },
      { monthIndex: 6, monthName: 'Jul', currentYearAmount: 1600, priorYearAmount: 1400, yoyGrowthPercent: 14.3 },
      { monthIndex: 7, monthName: 'Aug', currentYearAmount: 1900, priorYearAmount: 1500, yoyGrowthPercent: 26.7 },
      { monthIndex: 8, monthName: 'Sep', currentYearAmount: 2100, priorYearAmount: 1700, yoyGrowthPercent: 23.5 },
      { monthIndex: 9, monthName: 'Oct', currentYearAmount: 2500, priorYearAmount: 1900, yoyGrowthPercent: 31.6 },
      { monthIndex: 10, monthName: 'Nov', currentYearAmount: 0, priorYearAmount: 1800, yoyGrowthPercent: null },
      { monthIndex: 11, monthName: 'Dec', currentYearAmount: 0, priorYearAmount: 2000, yoyGrowthPercent: null }
    ],
    currentYearYtdTotal: 16100,
    priorYearYtdTotal: 12900,
    currentYearAnnualTotal: 16100,
    priorYearAnnualTotal: 16700,
    ytdGrowthPercent: 24.8,
    peakMonth: { monthIndex: 9, monthName: 'Oct', currentYearAmount: 2500 },
    troughMonth: { monthIndex: 0, monthName: 'Jan', currentYearAmount: 1000 },
    velocityStatus: 'Accelerating',
    hasPriorYearData: true,
    hasCurrentYearData: true
  };

  const svg = renderSeasonalCashflowSvg(populatedData);
  assert.ok(svg.includes('seasonal-chart-svg'));
  assert.ok(svg.includes('Peak: Oct'));
  assert.ok(svg.includes('2026 YTD:'));
  assert.ok(svg.includes('2025 YTD:'));
  assert.ok(svg.includes('Accelerating'));
});

test('calculatePackageMarginBreakdown analyzes package profitability correctly', () => {
  let state = createInitialState(['Sub 1', 'Sub 2', 'Sub 3']);
  state.customers[0].packageSpeed = '15Mbps Unlimited';
  state.customers[0].monthlySellingAmount = '3000';
  state.customers[0].serviceStatus = 'active';

  state.customers[1].packageSpeed = '15Mbps Unlimited';
  state.customers[1].monthlySellingAmount = '3000';
  state.customers[1].serviceStatus = 'active';

  state.customers[2].packageSpeed = '5Mbps / 150GB';
  state.customers[2].monthlySellingAmount = '1500';
  state.customers[2].serviceStatus = 'active';

  const breakdown = calculatePackageMarginBreakdown(state, { costPerMbps: 50 });

  assert.equal(breakdown.totalSubscribers, 3);
  assert.equal(breakdown.totalRevenue, 7500);
  assert.equal(breakdown.totalUpstreamCost, 1750);
  assert.equal(breakdown.totalGrossProfit, 5750);
  assert.equal(breakdown.blendedMarginPercent, 77);

  assert.equal(breakdown.packages.length, 2);
  const p15 = breakdown.packages.find(p => p.packageName === '15Mbps Unlimited');
  assert.equal(p15.subscriberCount, 2);
  assert.equal(p15.totalRevenue, 6000);
  assert.equal(p15.grossProfit, 4500);
  assert.equal(p15.grossMarginPercent, 75);
});

test('simulateMarginAdjustment simulates wholesale price changes and delta impact', () => {
  let state = createInitialState(['Sub 1']);
  state.customers[0].packageSpeed = '10 Mbps';
  state.customers[0].monthlySellingAmount = '2000';

  const sim = simulateMarginAdjustment(state, { costPerMbps: 40 });

  assert.equal(sim.baseline.totalGrossProfit, 1500);
  assert.equal(sim.simulated.totalGrossProfit, 1600);
  assert.equal(sim.monthlyProfitDelta, 100);
  assert.equal(sim.annualizedImpact, 1200);
});

test('renderPackageMarginSvg renders empty state and rows', () => {
  const emptySvg = renderPackageMarginSvg({ totalSubscribers: 0 });
  assert.ok(emptySvg.includes('No package distribution data'));

  const populatedData = {
    totalSubscribers: 10,
    totalRevenue: 20000,
    totalUpstreamCost: 6000,
    totalGrossProfit: 14000,
    blendedMarginPercent: 70,
    packages: [
      {
        packageName: '15Mbps Unlimited',
        subscriberCount: 6,
        totalRevenue: 15000,
        totalUpstreamCost: 4500,
        grossProfit: 10500,
        grossMarginPercent: 70
      }
    ]
  };

  const svg = renderPackageMarginSvg(populatedData);
  assert.ok(svg.includes('margin-chart-svg'));
  assert.ok(svg.includes('15Mbps Unlimited'));
  assert.ok(svg.includes('70%'));
  assert.ok(svg.includes('Blended Margin:'));
});

test('generateMarginSimulationReportText produces structured text report', () => {
  let state = createInitialState(['Sim Cust']);
  state.customers[0].packageSpeed = '15Mbps';
  state.customers[0].monthlySellingAmount = '3000';

  const sim = simulateMarginAdjustment(state, { costPerMbps: 50 });
  const text = generateMarginSimulationReportText(sim);

  assert.ok(text.includes('SHAHDARA ISP - PACKAGE MARGIN SIMULATION'));
  assert.ok(text.includes('Upstream Transit Rate: PKR 50/Mbps'));
  assert.ok(text.includes('Net Gross Profit:'));
  assert.ok(text.includes('15Mbps'));
});

test('setupMarginSimulatorModal wires interactive dialog controls and clipboard', async () => {
  let state = createInitialState(['Modal Cust']);
  state.customers[0].packageSpeed = '15Mbps';
  state.customers[0].monthlySellingAmount = '3000';

  let openHandler = null;
  let closeHandler = null;
  let inputHandler = null;
  let copyHandler = null;
  let presetHandlers = [];

  const mockRev = { textContent: '' };
  const mockCost = { textContent: '' };
  const mockProfit = { textContent: '' };
  const mockMargin = { textContent: '' };
  const mockDelta = { textContent: '', className: '' };
  const mockTableBody = { innerHTML: '' };
  const mockInput = {
    value: '50',
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'input') inputHandler = fn; }
  };
  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') openHandler = fn; }
  };
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') closeHandler = fn; }
  };
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') copyHandler = fn; }
  };
  const mockPresetBtn = {
    dataset: {},
    getAttribute: (attr) => attr === 'data-margin-preset' ? 'discount' : null,
    addEventListener: (evt, fn) => { if (evt === 'click') presetHandlers.push(fn); }
  };
  let modalOpened = false;
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {},
    querySelectorAll: (sel) => sel === '[data-margin-preset]' ? [mockPresetBtn] : []
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardMarginSimulatorModal') return mockModal;
      if (id === 'dashboardOpenMarginSimulatorBtn') return mockOpenBtn;
      if (id === 'dashboardMarginModalCloseBtn') return mockCloseBtn;
      if (id === 'marginSimCostInput') return mockInput;
      if (id === 'marginSimTableBody') return mockTableBody;
      if (id === 'marginSimCopyBtn') return mockCopyBtn;
      if (id === 'marginSimRevenueVal') return mockRev;
      if (id === 'marginSimCostVal') return mockCost;
      if (id === 'marginSimProfitVal') return mockProfit;
      if (id === 'marginSimMarginVal') return mockMargin;
      if (id === 'marginSimDeltaBadge') return mockDelta;
      return null;
    }
  };

  let toastMsg = null;
  let copiedContent = null;
  const mockClipboard = {
    writeText: async (t) => { copiedContent = t; }
  };

  try {
    setupMarginSimulatorModal(state, {
      onToast: (msg) => { toastMsg = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);
    assert.ok(mockRev.textContent.includes('3,000'));
    assert.ok(mockTableBody.innerHTML.includes('15Mbps'));

    mockInput.value = '40';
    inputHandler();
    assert.ok(mockCost.textContent.includes('600'));

    assert.equal(presetHandlers.length, 1);
    presetHandlers[0]();
    assert.equal(mockInput.value, 40);

    await copyHandler();
    assert.ok(copiedContent.includes('SHAHDARA ISP - PACKAGE MARGIN SIMULATION'));
    assert.equal(toastMsg, 'Margin simulation report copied to clipboard!');

    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateCustomerLtvCohorts handles empty customer roster gracefully', () => {
  const state = { customers: [] };
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const res = calculateCustomerLtvCohorts(state, refDate);

  assert.equal(res.totalTrackedCustomers, 0);
  assert.equal(res.overallTotalLtv, 0);
  assert.equal(res.overallAverageLtv, 0);
  assert.equal(res.overallAverageTenure, 0);
  assert.equal(res.ltvMultiplier, 0);
  assert.equal(res.cohorts.length, 5);
  assert.equal(res.topLtvCustomers.length, 0);
  assert.equal(res.packageLtvList.length, 0);
});

test('calculateCustomerLtvCohorts groups subscribers by tenure and calculates LTV and retention', () => {
  let state = createInitialState(['Customer New', 'Customer Mid', 'Customer Loyal', 'Customer Veteran']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Customer 0: New (< 3m: connected 2026-09-01 -> 2 months tenure)
  state.customers[0].connectionDate = '2026-09-01';
  state.customers[0].serviceStatus = 'active';
  state.customers[0].packageSpeed = '10 Mbps';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-09', dueAmount: '1500', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-09', { amount: '1500', date: '2026-09-05', method: 'Cash' }, refDate);

  // Customer 1: Mid (3-6m: connectionDate 2026-06-01 -> 5 months tenure)
  state.customers[1].connectionDate = '2026-06-01';
  state.customers[1].serviceStatus = 'offline';
  state.customers[1].packageSpeed = '15 Mbps';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-06', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-06', { amount: '2000', date: '2026-06-05', method: 'Cash' }, refDate);
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-07', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-07', { amount: '2000', date: '2026-07-05', method: 'Cash' }, refDate);

  // Customer 2: Loyal (12-24m: addedOn 2025-08-01 -> 15 months tenure)
  state.customers[2].addedOn = '2025-08-01';
  state.customers[2].serviceStatus = 'active';
  state.customers[2].packageSpeed = '20 Mbps';
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-08', dueAmount: '2500', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[2].id, '2026-08', { amount: '2500', date: '2026-08-05', method: 'Cash' }, refDate);
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-09', dueAmount: '2500', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[2].id, '2026-09', { amount: '2500', date: '2026-09-05', method: 'Cash' }, refDate);

  // Customer 3: Veteran (24+m: connectionDate 2024-01-01 -> 34 months tenure)
  state.customers[3].connectionDate = '2024-01-01';
  state.customers[3].serviceStatus = 'active';
  state.customers[3].packageSpeed = '20 Mbps';
  state = saveBillMonth(state, state.customers[3].id, { month: '2026-09', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[3].id, '2026-09', { amount: '3000', date: '2026-09-05', method: 'Cash' }, refDate);
  state = saveBillMonth(state, state.customers[3].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[3].id, '2026-10', { amount: '3000', date: '2026-10-05', method: 'Cash' }, refDate);

  const res = calculateCustomerLtvCohorts(state, refDate);

  assert.equal(res.totalTrackedCustomers, 4);
  assert.equal(res.overallTotalLtv, 1500 + 4000 + 5000 + 6000); // 16,500
  assert.equal(res.overallAverageLtv, Math.round(16500 / 4)); // 4125

  // Cohort < 3m
  const cNew = res.cohorts.find(c => c.key === '0-3');
  assert.equal(cNew.customerCount, 1);
  assert.equal(cNew.totalLtv, 1500);
  assert.equal(cNew.averageLtv, 1500);
  assert.equal(cNew.activeCount, 1);
  assert.equal(cNew.retentionRate, 100);

  // Cohort 3-6m
  const cMid = res.cohorts.find(c => c.key === '3-6');
  assert.equal(cMid.customerCount, 1);
  assert.equal(cMid.totalLtv, 4000);
  assert.equal(cMid.offlineCount, 1);
  assert.equal(cMid.retentionRate, 0);

  // Cohort 1-2y
  const cLoyal = res.cohorts.find(c => c.key === '12-24');
  assert.equal(cLoyal.customerCount, 1);
  assert.equal(cLoyal.totalLtv, 5000);
  assert.equal(cLoyal.activeCount, 1);
  assert.equal(cLoyal.retentionRate, 100);

  // Cohort 2+y
  const cVet = res.cohorts.find(c => c.key === '24+');
  assert.equal(cVet.customerCount, 1);
  assert.equal(cVet.totalLtv, 6000);

  // Top LTV accounts leaderboard
  assert.equal(res.topLtvCustomers[0].name, 'Customer Veteran');
  assert.equal(res.topLtvCustomers[0].totalLtv, 6000);
  assert.equal(res.topLtvCustomers[1].name, 'Customer Loyal');
  assert.equal(res.topLtvCustomers[1].totalLtv, 5000);

  // Package LTV
  const pkg20 = res.packageLtvList.find(p => p.package === '20 Mbps');
  assert.ok(pkg20);
  assert.equal(pkg20.customerCount, 2);
  assert.equal(pkg20.totalLtv, 11000);
  assert.equal(pkg20.averageLtv, 5500);
});

test('renderCustomerLtvCohortsSvg renders empty state when no data exists', () => {
  const emptySvg = renderCustomerLtvCohortsSvg({ totalTrackedCustomers: 0, overallTotalLtv: 0 });
  assert.ok(emptySvg.includes('No customer payment history recorded'));
  assert.ok(emptySvg.includes('aria-label="Customer Lifetime Value Cohorts: No payment data"'));
});

test('renderCustomerLtvCohortsSvg renders bars, mode, and footer stats when data is present', () => {
  const mockData = {
    totalTrackedCustomers: 10,
    overallTotalLtv: 50000,
    overallAverageLtv: 5000,
    overallAverageTenure: 8.5,
    ltvMultiplier: 3.2,
    cohorts: [
      { key: '0-3', label: '< 3 Months', customerCount: 3, activeCount: 3, totalLtv: 6000, averageLtv: 2000, retentionRate: 100 },
      { key: '3-6', label: '3 - 6 Months', customerCount: 2, activeCount: 1, totalLtv: 8000, averageLtv: 4000, retentionRate: 50 },
      { key: '6-12', label: '6 - 12 Months', customerCount: 5, activeCount: 4, totalLtv: 36000, averageLtv: 7200, retentionRate: 80 }
    ]
  };

  const svgAvg = renderCustomerLtvCohortsSvg(mockData, { metric: 'averageLtv' });
  assert.ok(svgAvg.includes('Average Customer LTV'));
  assert.ok(svgAvg.includes('3.2x ARPU'));
  assert.ok(svgAvg.includes('&lt; 3 Months'));
  assert.ok(svgAvg.includes('100% ret'));
  assert.ok(svgAvg.includes('50% ret'));
  assert.ok(svgAvg.includes('Total Portfolio Value'));

  const svgTotal = renderCustomerLtvCohortsSvg(mockData, { metric: 'totalLtv' });
  assert.ok(svgTotal.includes('Total Cohort Revenue'));
});

test('generateLtvBriefingReport generates formatted text report with metrics and accounts', () => {
  const mockData = {
    totalTrackedCustomers: 25,
    overallTotalLtv: 125000,
    overallAverageLtv: 5000,
    overallAverageTenure: 11.2,
    currentMonthArpu: 1500,
    ltvMultiplier: 3.3,
    cohorts: [
      { label: '< 3 Months', customerCount: 5, retentionRate: 100, totalLtv: 10000, averageLtv: 2000, averageTenureMonths: 1.8 }
    ],
    topLtvCustomers: [
      { customerNumber: 12, name: 'Haji Aslam', area: 'Main Bazaar', totalLtv: 25000, tenureMonths: 24, package: '20 Mbps' }
    ]
  };

  const report = generateLtvBriefingReport(mockData, new Date('2026-10-15T12:00:00+05:00'));
  assert.ok(report.includes('SHAHDARA ISP - CUSTOMER LTV & COHORT REPORT'));
  assert.ok(report.includes('Total Lifetime Revenue: PKR 125,000'));
  assert.ok(report.includes('LTV / ARPU Multiplier: 3.3x'));
  assert.ok(report.includes('< 3 Months (5 subs, 100% active):'));
  assert.ok(report.includes('#12 Haji Aslam (Main Bazaar): PKR 25,000'));
});

test('setLtvMetric and getLtvMetric validate allowed metric options', () => {
  setLtvMetric('totalLtv');
  assert.equal(getLtvMetric(), 'totalLtv');

  setLtvMetric('averageLtv');
  assert.equal(getLtvMetric(), 'averageLtv');

  setLtvMetric('invalidMetric');
  assert.equal(getLtvMetric(), 'averageLtv'); // maintains previous valid state
});

test('setupLtvCohortModal correctly initializes, populates tables, filters customer roster, and copies report', async () => {
  let state = createInitialState(['Subscriber One', 'Subscriber Two']);
  state.customers[0].connectionDate = '2026-08-01';
  state.customers[0].serviceStatus = 'active';
  state.customers[0].packageSpeed = '15 Mbps';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-08', dueAmount: '2000', status: 'pending' });
  state = addPayment(state, state.customers[0].id, '2026-08', { amount: '2000', date: '2026-08-10', method: 'Cash' });

  let openHandler = null;
  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') openHandler = fn; }
  };
  let closeHandler = null;
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') closeHandler = fn; }
  };
  let copyHandler = null;
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') copyHandler = fn; }
  };

  const mockAvgVal = { textContent: '' };
  const mockTotalVal = { textContent: '' };
  const mockTenureVal = { textContent: '' };
  const mockMultiVal = { textContent: '' };

  const rosterListeners = [];
  const mockCohortTable = { innerHTML: '' };
  const mockTopAccountsTable = {
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(val) {
      this._html = val;
    },
    querySelectorAll: (sel) => {
      if (sel === '[data-filter-customer]') {
        return [{
          getAttribute: (attr) => attr === 'data-filter-customer' ? 'Subscriber One' : null,
          addEventListener: (evt, fn) => { if (evt === 'click') rosterListeners.push(fn); }
        }];
      }
      return [];
    }
  };

  let modalOpened = false;
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardLtvModal') return mockModal;
      if (id === 'dashboardOpenLtvModalBtn') return mockOpenBtn;
      if (id === 'dashboardLtvModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardLtvCohortTableBody') return mockCohortTable;
      if (id === 'dashboardLtvTopAccountsTableBody') return mockTopAccountsTable;
      if (id === 'dashboardCopyLtvReportBtn') return mockCopyBtn;
      if (id === 'dashboardLtvAvgVal') return mockAvgVal;
      if (id === 'dashboardLtvTotalVal') return mockTotalVal;
      if (id === 'dashboardLtvTenureVal') return mockTenureVal;
      if (id === 'dashboardLtvMultiplierVal') return mockMultiVal;
      return null;
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };
  let filteredCustomer = null;

  try {
    setupLtvCohortModal(state, {
      referenceDate: new Date('2026-10-15T12:00:00+05:00'),
      onFilterCustomer: (name) => { filteredCustomer = name; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.ok(mockTotalVal.textContent.includes('2,000'));
    assert.ok(mockCohortTable.innerHTML.includes('3 - 6 Months'));
    assert.ok(mockTopAccountsTable.innerHTML.includes('Subscriber One'));

    assert.equal(rosterListeners.length, 1);
    rosterListeners[0]();
    assert.equal(filteredCustomer, 'Subscriber One');
    assert.equal(modalOpened, false); // modal closes on customer select

    await copyHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - CUSTOMER LTV & COHORT REPORT'));
    assert.equal(toastMessage, 'Customer LTV cohort report copied to clipboard!');

    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateIncidentImpactMatrix handles customer base with zero incidents gracefully', () => {
  const state = { customers: [{ id: 'c1', incidents: [] }, { id: 'c2', incidents: [] }] };
  const res = calculateIncidentImpactMatrix(state, new Date('2026-10-15T12:00:00+05:00'));

  assert.equal(res.totalRecordedIncidents, 0);
  assert.equal(res.activeOutagesCount, 0);
  assert.equal(res.resolvedIncidentsCount, 0);
  assert.equal(res.meanTimeToRestoreHours, 0);
  assert.equal(res.affectedSubscribersCount, 0);
  assert.equal(res.incidentRatePercent, 0);
  assert.equal(res.areaBreakdown.length, 0);
  assert.equal(res.highIncidentAccounts.length, 0);
});

test('calculateIncidentImpactMatrix accurately calculates MTTR, area correlation, and active outages', () => {
  const state = {
    customers: [
      {
        id: 'c1',
        customerNumber: 1,
        name: 'Tariq Mehmood',
        area: 'Main Bazaar',
        monthlySellingAmount: '2000',
        incidents: [
          {
            id: 'inc-1',
            reportedAt: '2026-10-10T10:00',
            offlineAt: '2026-10-10T09:00',
            restoredAt: '2026-10-10T13:00' // 4 hours
          },
          {
            id: 'inc-2',
            reportedAt: '2026-10-12T14:00',
            offlineAt: '2026-10-12T13:00',
            restoredAt: null // active outage!
          }
        ]
      },
      {
        id: 'c2',
        customerNumber: 2,
        name: 'Rashid Khan',
        area: 'Model Town',
        monthlySellingAmount: '1500',
        incidents: [
          {
            id: 'inc-3',
            reportedAt: '2026-10-05T08:00',
            offlineAt: '2026-10-05T07:00',
            restoredAt: '2026-10-05T09:00' // 2 hours
          }
        ]
      },
      {
        id: 'c3',
        customerNumber: 3,
        name: 'Usman Ghani',
        area: 'Model Town',
        incidents: []
      }
    ]
  };

  const res = calculateIncidentImpactMatrix(state, new Date('2026-10-15T12:00:00+05:00'));

  assert.equal(res.totalRecordedIncidents, 3);
  assert.equal(res.activeOutagesCount, 1);
  assert.equal(res.resolvedIncidentsCount, 2);
  assert.equal(res.meanTimeToRestoreHours, 3.0); // (4 + 2) / 2 = 3.0 hrs
  assert.equal(res.affectedSubscribersCount, 2);
  assert.equal(res.incidentRatePercent, 66.7); // 2 out of 3 = 66.7%

  // Area breakdown
  const mainBazaar = res.areaBreakdown.find(a => a.area === 'Main Bazaar');
  assert.ok(mainBazaar);
  assert.equal(mainBazaar.totalIncidents, 2);
  assert.equal(mainBazaar.activeOutages, 1);
  assert.equal(mainBazaar.revenueAtRisk, 2000);
  assert.equal(mainBazaar.healthStatus, 'critical');

  const modelTown = res.areaBreakdown.find(a => a.area === 'Model Town');
  assert.ok(modelTown);
  assert.equal(modelTown.totalIncidents, 1);
  assert.equal(modelTown.activeOutages, 0);
  assert.equal(modelTown.healthStatus, 'stable');

  // High incident accounts
  assert.equal(res.highIncidentAccounts[0].name, 'Tariq Mehmood');
  assert.equal(res.highIncidentAccounts[0].activeOutages, 1);
  assert.equal(res.highIncidentAccounts[0].totalIncidents, 2);
});

test('renderIncidentImpactSvg renders empty and populated SVG states correctly', () => {
  const emptySvg = renderIncidentImpactSvg({ totalRecordedIncidents: 0, areaBreakdown: [] });
  assert.ok(emptySvg.includes('Zero network incidents logged'));
  assert.ok(emptySvg.includes('aria-label="Network Incident and Outage Matrix: No incidents logged"'));

  const populatedData = {
    totalRecordedIncidents: 5,
    activeOutagesCount: 2,
    resolvedIncidentsCount: 3,
    meanTimeToRestoreHours: 2.5,
    affectedSubscribersCount: 4,
    incidentRatePercent: 8.0,
    areaBreakdown: [
      { area: 'Station Road', totalIncidents: 3, activeOutages: 1, subscribersAffected: 2, meanTimeToRestoreHours: 2.0 },
      { area: 'Chungi Amar Sidhu', totalIncidents: 2, activeOutages: 0, subscribersAffected: 2, meanTimeToRestoreHours: 3.0 }
    ]
  };

  const svg = renderIncidentImpactSvg(populatedData);
  assert.ok(svg.includes('MTTR:'));
  assert.ok(svg.includes('2.5 hrs'));
  assert.ok(svg.includes('Active Outages:'));
  assert.ok(svg.includes('Station Road'));
  assert.ok(svg.includes('1 open'));
  assert.ok(svg.includes('Resolved'));
});

test('generateIncidentBriefingReport outputs structured operational report', () => {
  const mockData = {
    totalRecordedIncidents: 6,
    activeOutagesCount: 1,
    resolvedIncidentsCount: 5,
    meanTimeToRestoreHours: 3.2,
    affectedSubscribersCount: 5,
    incidentRatePercent: 12.5,
    areaBreakdown: [
      { area: 'Main Bazaar', healthStatus: 'critical', totalIncidents: 4, activeOutages: 1, subscribersAffected: 3, meanTimeToRestoreHours: 3.5, revenueAtRisk: 6000 }
    ],
    highIncidentAccounts: [
      { customerNumber: 15, name: 'Shahid Iqbal', area: 'Main Bazaar', totalIncidents: 3, activeOutages: 1 }
    ]
  };

  const report = generateIncidentBriefingReport(mockData, new Date('2026-10-15T12:00:00+05:00'));
  assert.ok(report.includes('SHAHDARA ISP - NETWORK INCIDENT & OUTAGE MATRIX'));
  assert.ok(report.includes('Mean Time to Restore (MTTR): 3.2 hours'));
  assert.ok(report.includes('Main Bazaar (CRITICAL):'));
  assert.ok(report.includes('Revenue At Risk: PKR 6,000'));
  assert.ok(report.includes('#15 Shahid Iqbal (Main Bazaar): 3 incidents'));
});

test('setupIncidentImpactModal wires dialog controls, tables, roster filter, and report copy', async () => {
  const state = {
    customers: [
      {
        id: 'cust-x',
        customerNumber: 10,
        name: 'Imran Ashraf',
        area: 'Bara Dari',
        packageSpeed: '15 Mbps',
        monthlySellingAmount: '2000',
        incidents: [
          { id: 'i-1', reportedAt: '2026-10-11T12:00', offlineAt: '2026-10-11T11:00', restoredAt: null }
        ]
      }
    ]
  };

  let openHandler = null;
  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') openHandler = fn; }
  };
  let closeHandler = null;
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') closeHandler = fn; }
  };
  let copyHandler = null;
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') copyHandler = fn; }
  };

  const mockMttrVal = { textContent: '' };
  const mockActiveVal = { textContent: '', className: '' };
  const mockAffectedVal = { textContent: '' };
  const mockRateVal = { textContent: '' };

  const rosterListeners = [];
  const mockAreaTable = { innerHTML: '' };
  const mockAccountsTable = {
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(val) { this._html = val; },
    querySelectorAll: (sel) => {
      if (sel === '[data-filter-customer]') {
        return [{
          getAttribute: (attr) => attr === 'data-filter-customer' ? 'Imran Ashraf' : null,
          addEventListener: (evt, fn) => { if (evt === 'click') rosterListeners.push(fn); }
        }];
      }
      return [];
    }
  };

  let modalOpened = false;
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardIncidentModal') return mockModal;
      if (id === 'dashboardOpenIncidentModalBtn') return mockOpenBtn;
      if (id === 'dashboardIncidentModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardIncidentAreaTableBody') return mockAreaTable;
      if (id === 'dashboardIncidentAccountsTableBody') return mockAccountsTable;
      if (id === 'dashboardCopyIncidentReportBtn') return mockCopyBtn;
      if (id === 'dashboardIncidentMttrVal') return mockMttrVal;
      if (id === 'dashboardIncidentActiveVal') return mockActiveVal;
      if (id === 'dashboardIncidentAffectedVal') return mockAffectedVal;
      if (id === 'dashboardIncidentRateVal') return mockRateVal;
      return null;
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };
  let filteredCustomer = null;

  try {
    setupIncidentImpactModal(state, {
      referenceDate: new Date('2026-10-15T12:00:00+05:00'),
      onFilterCustomer: (name) => { filteredCustomer = name; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.ok(mockActiveVal.textContent.includes('1'));
    assert.ok(mockAreaTable.innerHTML.includes('Bara Dari'));
    assert.ok(mockAccountsTable.innerHTML.includes('Imran Ashraf'));

    assert.equal(rosterListeners.length, 1);
    rosterListeners[0]();
    assert.equal(filteredCustomer, 'Imran Ashraf');
    assert.equal(modalOpened, false);

    await copyHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - NETWORK INCIDENT & OUTAGE MATRIX'));
    assert.equal(toastMessage, 'Incident operations report copied to clipboard!');

    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateCashflowProjections computes baseline, optimistic, and conservative forward curves', () => {
  let state = createInitialState(['User A', 'User B', 'User C', 'User D']);
  for (let i = 0; i < 4; i++) {
    state.customers[i].serviceStatus = 'active';
    state.customers[i].monthlySellingAmount = 2000;
  }
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Baseline
  const baseline = calculateCashflowProjections(state, refDate, { scenario: 'baseline' });
  assert.equal(baseline.scenario, 'baseline');
  assert.equal(baseline.baseSubscribers, 4);
  assert.equal(baseline.arpu, 2000);
  assert.equal(baseline.monthlyForecasts.length, 6);
  assert.ok(baseline.totalProjectedCashflow > 0);
  assert.ok(baseline.totalProjectedBilled > 0);
  assert.ok(baseline.monthlyForecasts[0].month.includes('2026-11'));
  assert.ok(baseline.monthlyForecasts[5].month.includes('2027-04'));

  // Optimistic
  const optimistic = calculateCashflowProjections(state, refDate, { scenario: 'optimistic' });
  assert.equal(optimistic.scenario, 'optimistic');
  assert.equal(optimistic.monthlyChurnRate, 1.0);
  assert.equal(optimistic.monthlyNetAdds, 5);
  assert.equal(optimistic.trajectoryStatus, 'Expansion');
  assert.ok(optimistic.endingSubscribers > baseline.endingSubscribers);
  assert.ok(optimistic.totalProjectedCashflow > baseline.totalProjectedCashflow);

  // Conservative
  const conservative = calculateCashflowProjections(state, refDate, { scenario: 'conservative' });
  assert.equal(conservative.scenario, 'conservative');
  assert.equal(conservative.monthlyChurnRate, 6.0);
  assert.equal(conservative.monthlyNetAdds, 0);
  assert.equal(conservative.trajectoryStatus, 'Contraction Risk');
  assert.ok(conservative.endingSubscribers < baseline.endingSubscribers);
  assert.ok(conservative.totalProjectedCashflow < baseline.totalProjectedCashflow);
});

test('calculateCashflowProjections respects custom parameter overrides and handles empty state', () => {
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const emptyState = createInitialState([]);
  const emptyRes = calculateCashflowProjections(emptyState, refDate);
  assert.equal(emptyRes.baseSubscribers, 0);
  assert.equal(emptyRes.totalProjectedBilled, 0);
  assert.equal(emptyRes.totalProjectedCashflow, 0);

  let state = createInitialState(['Sub 1', 'Sub 2']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].monthlySellingAmount = 1800;
  state.customers[1].serviceStatus = 'active';
  state.customers[1].monthlySellingAmount = 1800;

  const customRes = calculateCashflowProjections(state, refDate, {
    horizonMonths: 4,
    customRecoveryRate: 95,
    customMonthlyChurnRate: 0,
    customMonthlyNetAdds: 3
  });

  assert.equal(customRes.horizonMonths, 4);
  assert.equal(customRes.recoveryRate, 95);
  assert.equal(customRes.monthlyChurnRate, 0);
  assert.equal(customRes.monthlyNetAdds, 3);
  assert.equal(customRes.monthlyForecasts.length, 4);
  assert.equal(customRes.endingSubscribers, 2 + (3 * 4)); // 14
  assert.equal(customRes.trajectoryStatus, 'Expansion');
});

test('generateProjectionBriefingText formats executive forward cashflow report accurately', () => {
  let state = createInitialState(['Sub A', 'Sub B']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].monthlySellingAmount = 1500;
  state.customers[1].serviceStatus = 'active';
  state.customers[1].monthlySellingAmount = 1500;

  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const data = calculateCashflowProjections(state, refDate, { scenario: 'baseline' });
  const text = generateProjectionBriefingText(data, refDate);

  assert.ok(text.includes('SHAHDARA ISP - FORWARD CASHFLOW & CHURN FORECAST'));
  assert.ok(text.includes('SCENARIO CONFIGURATION: BASELINE'));
  assert.ok(text.includes('Cumulative Projected Cash:'));
  assert.ok(text.includes('MONTH-BY-MONTH FORWARD TRAJECTORY'));
  assert.ok(text.includes('2026-11'));
});

test('renderCashflowProjectionSvg renders clean SVG and handles empty state', () => {
  const emptySvg = renderCashflowProjectionSvg(null);
  assert.ok(emptySvg.includes('No active subscriber recurring revenue'));

  let state = createInitialState(['Sub Alpha']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].monthlySellingAmount = 2500;
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  const data = calculateCashflowProjections(state, refDate, { scenario: 'baseline' });

  const svg = renderCashflowProjectionSvg(data);
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('Forward Cashflow Projections &amp; Scenario Modeler Chart'));
  assert.ok(svg.includes('Projected Cash'));
  assert.ok(svg.includes('Gross Billed'));
  assert.ok(svg.includes('polyline'));
  assert.ok(svg.includes('6-Mo Cash:'));
});

test('setProjectionScenario and getProjectionScenario validate and persist scenario state', () => {
  setProjectionScenario('optimistic');
  assert.equal(getProjectionScenario(), 'optimistic');

  setProjectionScenario('conservative');
  assert.equal(getProjectionScenario(), 'conservative');

  setProjectionScenario('invalid-mode');
  assert.equal(getProjectionScenario(), 'conservative');

  setProjectionScenario('baseline');
  assert.equal(getProjectionScenario(), 'baseline');
});

test('setupProjectionScenarioModal wires up dialog, presets, custom inputs, and clipboard export', async () => {
  let state = createInitialState(['Sub Alpha', 'Sub Beta']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].monthlySellingAmount = 2000;
  state.customers[1].serviceStatus = 'active';
  state.customers[1].monthlySellingAmount = 2000;

  let openHandler = null;
  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') openHandler = fn; }
  };
  let closeHandler = null;
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') closeHandler = fn; }
  };
  let copyHandler = null;
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') copyHandler = fn; }
  };

  const presetHandlers = {};
  const mockPresetBtns = ['baseline', 'optimistic', 'conservative'].map(s => ({
    dataset: {},
    getAttribute: (attr) => attr === 'data-projection-preset' ? s : null,
    classList: { toggle: () => {} },
    setAttribute: () => {},
    addEventListener: (evt, fn) => { if (evt === 'click') presetHandlers[s] = fn; }
  }));

  const inputHandlers = {};
  const mockRecoveryInput = {
    dataset: {},
    value: '85',
    addEventListener: (evt, fn) => { if (evt === 'input') inputHandlers.recovery = fn; }
  };
  const mockChurnInput = {
    dataset: {},
    value: '2.5',
    addEventListener: (evt, fn) => { if (evt === 'input') inputHandlers.churn = fn; }
  };
  const mockNetAddsInput = {
    dataset: {},
    value: '2',
    addEventListener: (evt, fn) => { if (evt === 'input') inputHandlers.netAdds = fn; }
  };

  const mockTotalCashflowVal = { textContent: '' };
  const mockMonthlyRunRateVal = { textContent: '' };
  const mockChurnDragVal = { textContent: '' };
  const mockEndingBaseVal = { textContent: '' };
  const mockTrajectoryBadge = { textContent: '', className: '' };
  const mockTableBody = { innerHTML: '' };

  let modalOpened = false;
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {},
    querySelectorAll: (sel) => sel === '[data-projection-preset]' ? mockPresetBtns : []
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardProjectionModal') return mockModal;
      if (id === 'dashboardOpenProjectionModalBtn') return mockOpenBtn;
      if (id === 'dashboardProjectionModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyProjectionReportBtn') return mockCopyBtn;
      if (id === 'projectionRecoveryInput') return mockRecoveryInput;
      if (id === 'projectionChurnInput') return mockChurnInput;
      if (id === 'projectionNetAddsInput') return mockNetAddsInput;
      if (id === 'projectionTotalCashflowVal') return mockTotalCashflowVal;
      if (id === 'projectionMonthlyRunRateVal') return mockMonthlyRunRateVal;
      if (id === 'projectionChurnDragVal') return mockChurnDragVal;
      if (id === 'projectionEndingBaseVal') return mockEndingBaseVal;
      if (id === 'projectionTrajectoryBadge') return mockTrajectoryBadge;
      if (id === 'dashboardProjectionTableBody') return mockTableBody;
      return null;
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };

  try {
    setupProjectionScenarioModal(state, {
      referenceDate: new Date('2026-10-15T12:00:00+05:00'),
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.ok(mockTotalCashflowVal.textContent.includes('PKR'));
    assert.ok(mockTableBody.innerHTML.includes('2026-11'));

    // Trigger optimistic preset
    assert.ok(presetHandlers.optimistic !== undefined);
    presetHandlers.optimistic();
    assert.equal(mockRecoveryInput.value, 93);
    assert.equal(mockChurnInput.value, 1.0);
    assert.equal(mockNetAddsInput.value, 5);
    assert.equal(mockTrajectoryBadge.textContent, 'Expansion');

    // Trigger custom net adds input
    mockNetAddsInput.value = '10';
    assert.ok(inputHandlers.netAdds !== undefined);
    inputHandlers.netAdds();
    assert.ok(mockEndingBaseVal.textContent.includes('+'));

    // Test copy briefing
    await copyHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - FORWARD CASHFLOW & CHURN FORECAST'));
    assert.equal(toastMessage, 'Cashflow forecast report copied to clipboard!');

    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateUpstreamGatewayMetrics groups subscribers by carrier, determines primary route and failover status', () => {
  let state = createInitialState(['Cust 1', 'Cust 2', 'Cust 3', 'Cust 4']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].ispProvider = 'Nayatel';
  state.customers[0].packageSpeed = '20 Mbps';
  state.customers[0].monthlyPurchaseCost = 1200;
  state.customers[0].monthlySellingAmount = 2500;

  state.customers[1].serviceStatus = 'active';
  state.customers[1].ispProvider = 'Nayatel';
  state.customers[1].packageSpeed = '10 Mbps';
  state.customers[1].monthlyPurchaseCost = 800;
  state.customers[1].monthlySellingAmount = 1800;

  state.customers[2].serviceStatus = 'active';
  state.customers[2].ispProvider = 'PTCL';
  state.customers[2].packageSpeed = '15 Mbps';
  state.customers[2].monthlyPurchaseCost = 900;
  state.customers[2].monthlySellingAmount = 1900;

  state.customers[3].serviceStatus = 'offline';
  state.customers[3].ispProvider = 'StormFiber';
  state.customers[3].packageSpeed = '30 Mbps';

  const data = calculateUpstreamGatewayMetrics(state, new Date('2026-10-15T12:00:00+05:00'));

  assert.equal(data.totalGatewaysCount, 3);
  assert.equal(data.configuredGatewaysCount, 2); // Nayatel (2 active) and PTCL (1 active)
  assert.equal(data.primaryGateway, 'Nayatel');
  assert.equal(data.primaryLatencyMs, 18);
  assert.equal(data.failoverRedundancyStatus, 'Multi-Homed Redundant');
  assert.equal(data.totalBandwidthCapacityMbps, 75); // 20 + 10 + 15 + 30
  assert.equal(data.totalWholesaleCost, 2900); // 1200 + 800 + 900

  const nayatel = data.gateways.find(g => g.provider === 'Nayatel');
  assert.ok(nayatel);
  assert.equal(nayatel.activeSubscribers, 2);
  assert.equal(nayatel.failoverRole, 'Primary Active');
  assert.equal(nayatel.status, 'Optimal');

  const ptcl = data.gateways.find(g => g.provider === 'PTCL');
  assert.ok(ptcl);
  assert.equal(ptcl.activeSubscribers, 1);
  assert.equal(ptcl.failoverRole, 'Secondary Standby');
});

test('calculateUpstreamGatewayMetrics handles empty and unassigned accounts', () => {
  const emptyData = calculateUpstreamGatewayMetrics(createInitialState([]));
  assert.equal(emptyData.totalGatewaysCount, 0);
  assert.equal(emptyData.totalBandwidthCapacityMbps, 0);
  assert.equal(emptyData.failoverRedundancyStatus, 'No Configured Gateway');

  let state = createInitialState(['User X']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].ispProvider = ''; // unassigned
  const unassignedData = calculateUpstreamGatewayMetrics(state);
  assert.equal(unassignedData.totalGatewaysCount, 1);
  assert.equal(unassignedData.gateways[0].provider, 'Unassigned Gateway');
  assert.equal(unassignedData.failoverRedundancyStatus, 'No Configured Gateway');
});

test('generateUpstreamBriefingReport formats briefing report accurately', () => {
  let state = createInitialState(['Cust 1']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].ispProvider = 'Transworld';
  state.customers[0].packageSpeed = '50 Mbps';
  state.customers[0].monthlyPurchaseCost = 2500;
  state.customers[0].monthlySellingAmount = 4500;

  const data = calculateUpstreamGatewayMetrics(state, new Date('2026-10-15T12:00:00+05:00'));
  const text = generateUpstreamBriefingReport(data, new Date('2026-10-15T12:00:00+05:00'));

  assert.ok(text.includes('SHAHDARA ISP - UPSTREAM TRANSIT & FAILOVER BRIEFING'));
  assert.ok(text.includes('Primary Gateway: Transworld'));
  assert.ok(text.includes('14 ms latency'));
  assert.ok(text.includes('Total Allocated Capacity: 50 Mbps'));
  assert.ok(text.includes('Wholesale Transit Cost: PKR 2,500'));
});

test('renderUpstreamGatewaySvg renders clean SVG and handles empty state', () => {
  const emptySvg = renderUpstreamGatewaySvg(null);
  assert.ok(emptySvg.includes('No upstream ISP provider assigned'));

  let state = createInitialState(['Cust 1']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].ispProvider = 'Nayatel';
  state.customers[0].packageSpeed = '25 Mbps';
  const data = calculateUpstreamGatewayMetrics(state);

  const svg = renderUpstreamGatewaySvg(data);
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('Upstream ISP Transit &amp; Multi-Homed Failover Chart'));
  assert.ok(svg.includes('Nayatel'));
  assert.ok(svg.includes('PRIMARY'));
  assert.ok(svg.includes('25M'));
});

test('setupUpstreamGatewayModal wires up modal dialog, KPIs, table, and clipboard export', async () => {
  let state = createInitialState(['Cust 1', 'Cust 2']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].ispProvider = 'Nayatel';
  state.customers[1].serviceStatus = 'active';
  state.customers[1].ispProvider = 'PTCL';

  let openHandler = null;
  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') openHandler = fn; }
  };
  let closeHandler = null;
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') closeHandler = fn; }
  };
  let copyHandler = null;
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') copyHandler = fn; }
  };

  const mockPrimaryVal = { textContent: '' };
  const mockLatencyVal = { textContent: '' };
  const mockCapacityVal = { textContent: '' };
  const mockRedundancyBadge = { textContent: '', className: '' };
  const mockTableBody = { innerHTML: '' };

  let modalOpened = false;
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardUpstreamModal') return mockModal;
      if (id === 'dashboardOpenUpstreamModalBtn') return mockOpenBtn;
      if (id === 'dashboardUpstreamModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyUpstreamReportBtn') return mockCopyBtn;
      if (id === 'upstreamPrimaryVal') return mockPrimaryVal;
      if (id === 'upstreamLatencyVal') return mockLatencyVal;
      if (id === 'upstreamCapacityVal') return mockCapacityVal;
      if (id === 'upstreamRedundancyBadge') return mockRedundancyBadge;
      if (id === 'dashboardUpstreamTableBody') return mockTableBody;
      return null;
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };

  try {
    setupUpstreamGatewayModal(state, {
      referenceDate: new Date('2026-10-15T12:00:00+05:00'),
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.equal(mockPrimaryVal.textContent, 'Nayatel');
    assert.ok(mockLatencyVal.textContent.includes('ms'));
    assert.ok(mockCapacityVal.textContent.includes('Mbps'));
    assert.equal(mockRedundancyBadge.textContent, 'Multi-Homed Redundant');
    assert.ok(mockTableBody.innerHTML.includes('Nayatel'));
    assert.ok(mockTableBody.innerHTML.includes('PTCL'));

    await copyHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - UPSTREAM TRANSIT & FAILOVER BRIEFING'));
    assert.equal(toastMessage, 'Upstream failover report copied to clipboard!');

    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateAcquisitionRoiMetrics correctly segments subscribers into acquisition channels and computes CAC payback', () => {
  const state = createInitialState();
  const res = calculateAcquisitionRoiMetrics(state, new Date('2026-10-15T12:00:00+05:00'));

  assert.ok(res.totalPortfolioAcquisitions > 0);
  assert.ok(res.totalPortfolioActive > 0);
  assert.ok(res.totalPortfolioCac > 0);
  assert.equal(typeof res.portfolioNetRoiPercent, 'number');
  assert.equal(typeof res.portfolioAvgPaybackMonths, 'number');
  assert.ok(res.channels.length === 6);

  const walkin = res.channels.find(c => c.id === 'walkin');
  assert.ok(walkin);
  assert.equal(walkin.name, 'Direct Walk-in / Office');
  assert.equal(walkin.blendedCac, 2800);
  assert.ok(['Rapid Payback', 'Standard Payback', 'Lagging Payback', 'Inactive'].includes(walkin.velocityStatus));
});

test('calculateAcquisitionRoiMetrics handles explicit channels, notes keywords, and sensitivity multiplier', () => {
  const customCust1 = {
    id: 'cust-walkin',
    name: 'Walkin Test',
    acquisitionChannel: 'walkin',
    monthlySellingAmount: 3000,
    serviceStatus: 'active',
    bills: [{ payments: [{ amount: 9000 }] }]
  };
  const customCust2 = {
    id: 'cust-tech',
    name: 'Tech Test',
    notes: 'Introduced by lineman Faiz on site',
    monthlySellingAmount: 2500,
    serviceStatus: 'active',
    bills: [{ payments: [{ amount: 5000 }] }]
  };
  const customCust3 = {
    id: 'cust-builder',
    name: 'Plaza Test',
    leadSource: 'builder',
    monthlySellingAmount: 5000,
    serviceStatus: 'active',
    bills: []
  };

  const state = {
    customers: [customCust1, customCust2, customCust3],
    receipts: []
  };

  const baseline = calculateAcquisitionRoiMetrics(state, new Date(), { cacMultiplier: 1.0 });
  assert.equal(baseline.totalPortfolioAcquisitions, 3);
  assert.equal(baseline.totalPortfolioActive, 3);

  const tech = baseline.channels.find(c => c.id === 'technician');
  assert.equal(tech.totalAcquisitions, 1);
  assert.equal(tech.blendedCac, 3500);
  assert.equal(tech.totalRealizedRevenue, 5000);
  assert.ok(tech.netRoiPercent > 0);

  // Test sensitivity multiplier 1.2
  const sensitive = calculateAcquisitionRoiMetrics(state, new Date(), { cacMultiplier: 1.2 });
  const techSensitive = sensitive.channels.find(c => c.id === 'technician');
  assert.equal(techSensitive.blendedCac, Math.round(3500 * 1.2));
  assert.ok(techSensitive.paybackMonths > tech.paybackMonths);
});

test('calculateAcquisitionRoiMetrics handles empty state safely', () => {
  const emptyState = { customers: [], receipts: [] };
  const res = calculateAcquisitionRoiMetrics(emptyState);

  assert.equal(res.totalPortfolioAcquisitions, 0);
  assert.equal(res.totalPortfolioActive, 0);
  assert.equal(res.totalPortfolioCac, 0);
  assert.equal(res.totalPortfolioRealizedRevenue, 0);
  assert.equal(res.portfolioNetRoiPercent, 0);
  assert.equal(res.portfolioAvgPaybackMonths, 0);
  assert.equal(res.highestRoiChannel, 'None');
  assert.equal(res.fastestPaybackChannel, 'None');
});

test('renderAcquisitionRoiSvg renders accessible SVG with channel bars and empty state fallback', () => {
  const emptyState = { customers: [], receipts: [] };
  const emptyData = calculateAcquisitionRoiMetrics(emptyState);
  const emptySvg = renderAcquisitionRoiSvg(emptyData);

  assert.ok(emptySvg.includes('<svg'));
  assert.ok(emptySvg.includes('No subscriber acquisition data available'));

  const populatedState = createInitialState();
  const popData = calculateAcquisitionRoiMetrics(populatedState);
  const svg = renderAcquisitionRoiSvg(popData);

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('acquisition-roi-row'));
  assert.ok(svg.includes('Total CAC:'));
  assert.ok(svg.includes('Portfolio Net ROI:'));
});

test('generateAcquisitionBriefingReport generates structured plain text summary', () => {
  const state = createInitialState();
  const data = calculateAcquisitionRoiMetrics(state);
  const report = generateAcquisitionBriefingReport(data, new Date('2026-10-15T12:00:00+05:00'));

  assert.ok(report.includes('SHAHDARA ISP - ACQUISITION CHANNEL ROI & PAYBACK BRIEFING'));
  assert.ok(report.includes('PORTFOLIO UNIT ECONOMICS & ACQUISITION SUMMARY'));
  assert.ok(report.includes('ACQUISITION CHANNEL PERFORMANCE BREAKDOWN'));
  assert.ok(report.includes('Direct Walk-in / Office'));
  assert.ok(report.includes('Net Portfolio Marketing ROI:'));
});

test('setupAcquisitionRoiModal wires modal open, close, preset multipliers, and clipboard copy', async () => {
  const state = createInitialState();

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let copyHandler = null;
  const presetHandlers = [];

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, handler) => { if (evt === 'click') openHandler = handler; }
  };
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, handler) => { if (evt === 'click') closeHandler = handler; }
  };
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, handler) => { if (evt === 'click') copyHandler = handler; }
  };

  const mockTotalCacVal = { textContent: '' };
  const mockRealizedRevVal = { textContent: '' };
  const mockNetRoiVal = { textContent: '', style: {} };
  const mockAvgPaybackVal = { textContent: '' };
  const mockFastestVal = { textContent: '' };
  const mockTableBody = { innerHTML: '' };

  const mockPresetBtns = [
    {
      dataset: { cacMultiplier: '0.8' },
      classList: { toggle: () => {} },
      setAttribute: () => {},
      addEventListener: (evt, handler) => { if (evt === 'click') presetHandlers.push(handler); }
    },
    {
      dataset: { cacMultiplier: '1.0' },
      classList: { toggle: () => {} },
      setAttribute: () => {},
      addEventListener: (evt, handler) => { if (evt === 'click') presetHandlers.push(handler); }
    }
  ];

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardAcquisitionModal') return mockModal;
      if (id === 'dashboardOpenAcquisitionModalBtn') return mockOpenBtn;
      if (id === 'dashboardAcquisitionModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyAcquisitionReportBtn') return mockCopyBtn;
      if (id === 'acqTotalCacVal') return mockTotalCacVal;
      if (id === 'acqRealizedRevVal') return mockRealizedRevVal;
      if (id === 'acqNetRoiVal') return mockNetRoiVal;
      if (id === 'acqAvgPaybackVal') return mockAvgPaybackVal;
      if (id === 'acqFastestChannelVal') return mockFastestVal;
      if (id === 'dashboardAcquisitionTableBody') return mockTableBody;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes('#acquisitionCacPresetGroup')) return mockPresetBtns;
      return [];
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };

  try {
    setupAcquisitionRoiModal(state, {
      referenceDate: new Date('2026-10-15T12:00:00+05:00'),
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.ok(mockTotalCacVal.textContent.includes('PKR'));
    assert.ok(mockAvgPaybackVal.textContent.includes('mo'));
    assert.ok(mockTableBody.innerHTML.includes('Direct Walk-in / Office'));

    // Trigger low CAC preset (0.8x)
    presetHandlers[0]();
    assert.ok(mockTotalCacVal.textContent.includes('PKR'));

    await copyHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - ACQUISITION CHANNEL ROI & PAYBACK BRIEFING'));
    assert.equal(toastMessage, 'Acquisition ROI briefing copied to clipboard!');

    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateBandwidthShapingMetrics calculates peak demand, diurnal profile, and headroom', () => {
  const state = createInitialState();
  const res = calculateBandwidthShapingMetrics(state, new Date('2026-10-15T12:00:00+05:00'));

  assert.ok(res.activeSubscribersCount > 0);
  assert.ok(res.totalProvisionedBandwidthMbps > 0);
  assert.ok(res.upstreamCapacityMbps > 0);
  assert.ok(res.peakDemandMbps > 0);
  assert.ok(res.peakUtilizationPercent >= 0);
  assert.equal(res.hourlyProfile.length, 24);

  const peakPoint = res.hourlyProfile[20];
  assert.equal(peakPoint.isPeakHour, true);
  assert.equal(peakPoint.label, '20:00');
  assert.ok(peakPoint.demandMbps > 0);

  assert.ok(['Healthy Bandwidth Headroom', 'Moderate Congestion', 'Critical Saturation Risk', 'Idle Network'].includes(res.congestionStatus));
});

test('calculateBandwidthShapingMetrics handles ratio variations and expansion upgrades', () => {
  const cust1 = { id: 'c1', name: 'User 1', packageSpeed: '50 Mbps', serviceStatus: 'active' };
  const cust2 = { id: 'c2', name: 'User 2', packageSpeed: '100 Mbps', serviceStatus: 'active' };

  const state = { customers: [cust1, cust2] };

  const res8 = calculateBandwidthShapingMetrics(state, new Date(), { oversubscriptionRatio: 8, upstreamCapacityMbps: 20 });
  const res4 = calculateBandwidthShapingMetrics(state, new Date(), { oversubscriptionRatio: 4, upstreamCapacityMbps: 20 });

  assert.equal(res8.totalProvisionedBandwidthMbps, 150);
  assert.ok(res4.peakDemandMbps > res8.peakDemandMbps);

  assert.ok(res8.projected25DemandMbps > res8.peakDemandMbps);
});

test('calculateBandwidthShapingMetrics handles empty network', () => {
  const emptyState = { customers: [] };
  const res = calculateBandwidthShapingMetrics(emptyState);

  assert.equal(res.activeSubscribersCount, 0);
  assert.equal(res.totalProvisionedBandwidthMbps, 0);
  assert.equal(res.peakDemandMbps, 0);
  assert.equal(res.peakUtilizationPercent, 0);
  assert.equal(res.congestionStatus, 'Idle Network');
});

test('renderBandwidthShapingSvg renders accessible SVG with 24h diurnal curve and empty fallback', () => {
  const emptyState = { customers: [] };
  const emptyMetrics = calculateBandwidthShapingMetrics(emptyState);
  const emptySvg = renderBandwidthShapingSvg(emptyMetrics);

  assert.ok(emptySvg.includes('<svg'));
  assert.ok(emptySvg.includes('No active bandwidth demand detected'));

  const populatedState = createInitialState();
  const popMetrics = calculateBandwidthShapingMetrics(populatedState);
  const svg = renderBandwidthShapingSvg(popMetrics);

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('UPSTREAM CEILING'));
  assert.ok(svg.includes('Peak Surge:'));
  assert.ok(svg.includes('diurnal-bar-group'));
});

test('generateBandwidthShapingReport generates plain-text summary', () => {
  const state = createInitialState();
  const metrics = calculateBandwidthShapingMetrics(state);
  const report = generateBandwidthShapingReport(metrics, new Date('2026-10-15T12:00:00+05:00'));

  assert.ok(report.includes('SHAHDARA ISP - PEAK TRAFFIC & SHAPING BRIEFING'));
  assert.ok(report.includes('BANDWIDTH CAPACITY & CONCURRENCY SUMMARY'));
  assert.ok(report.includes('UTILIZATION & CONGESTION STATUS'));
  assert.ok(report.includes('SUBSCRIBER EXPANSION FORECAST'));
});

test('setupBandwidthShapingModal wires modal open, close, ratio toggling, and clipboard copy', async () => {
  const state = createInitialState();

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let copyHandler = null;
  const ratioHandlers = [];

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, handler) => { if (evt === 'click') openHandler = handler; }
  };
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, handler) => { if (evt === 'click') closeHandler = handler; }
  };
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, handler) => { if (evt === 'click') copyHandler = handler; }
  };

  const mockProvEl = { textContent: '' };
  const mockPeakEl = { textContent: '' };
  const mockUtilEl = { textContent: '', style: {} };
  const mockHeadroomEl = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockP10El = { textContent: '' };
  const mockP25El = { textContent: '' };
  const mockP50El = { textContent: '' };
  const mockUpgradeEl = { textContent: '', style: {} };

  const mockRatioBtns = [
    {
      dataset: { shapingRatio: '6' },
      classList: { toggle: () => {} },
      setAttribute: () => {},
      addEventListener: (evt, handler) => { if (evt === 'click') ratioHandlers.push(handler); }
    },
    {
      dataset: { shapingRatio: '10' },
      classList: { toggle: () => {} },
      setAttribute: () => {},
      addEventListener: (evt, handler) => { if (evt === 'click') ratioHandlers.push(handler); }
    }
  ];

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardShapingModal') return mockModal;
      if (id === 'dashboardOpenShapingModalBtn') return mockOpenBtn;
      if (id === 'dashboardShapingModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyShapingReportBtn') return mockCopyBtn;
      if (id === 'shapingProvisionedVal') return mockProvEl;
      if (id === 'shapingPeakDemandVal') return mockPeakEl;
      if (id === 'shapingUtilVal') return mockUtilEl;
      if (id === 'shapingHeadroomVal') return mockHeadroomEl;
      if (id === 'shapingStatusBadge') return mockStatusBadge;
      if (id === 'shapingProj10Val') return mockP10El;
      if (id === 'shapingProj25Val') return mockP25El;
      if (id === 'shapingProj50Val') return mockP50El;
      if (id === 'shapingUpgradeRecVal') return mockUpgradeEl;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes('#shapingRatioGroup')) return mockRatioBtns;
      return [];
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };

  try {
    setupBandwidthShapingModal(state, {
      referenceDate: new Date('2026-10-15T12:00:00+05:00'),
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.ok(mockProvEl.textContent.includes('Mbps'));
    assert.ok(mockPeakEl.textContent.includes('Mbps'));
    assert.ok(mockUtilEl.textContent.includes('%'));

    // Trigger ratio 6
    ratioHandlers[0]();
    assert.ok(mockPeakEl.textContent.includes('Mbps'));

    await copyHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - PEAK TRAFFIC & SHAPING BRIEFING'));
    assert.equal(toastMessage, 'Bandwidth shaping briefing copied to clipboard!');

    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateFiberDistributionMetrics handles empty customer state gracefully', () => {
  const state = createInitialState([]);
  const res = calculateFiberDistributionMetrics(state);

  assert.equal(res.hubs.length, 0);
  assert.equal(res.totalDeployedPorts, 0);
  assert.equal(res.totalAssignedPorts, 0);
  assert.equal(res.totalActivePorts, 0);
  assert.equal(res.totalOfflinePorts, 0);
  assert.equal(res.totalSparePorts, 0);
  assert.equal(res.overallSaturationPercent, 0);
  assert.equal(res.networkStatus, 'No Active Fiber Drops');
  assert.equal(res.targetSplitterSize, 8);
});

test('calculateFiberDistributionMetrics accurately aggregates area port splitters, saturation, and link attenuation', () => {
  let state = createInitialState(['Farooq User 1', 'Farooq User 2', 'Farooq User 3', 'Farooq User 4', 'Farooq User 5', 'Farooq User 6', 'Farooq User 7']);
  // Assign 7 users to Farooq Ganj
  state.customers = state.customers.map(c => ({ ...c, area: 'Farooq Ganj', status: 'active' }));
  // Set 1 user offline
  state.customers[0].status = 'offline';

  // Add 1 user to Baradari Road
  state.customers.push({ id: 'c-baradari', name: 'Baradari User', area: 'Baradari Road', status: 'active', bills: [] });

  const res = calculateFiberDistributionMetrics(state, { targetSplitterSize: 8 });

  assert.equal(res.hubs.length, 2);
  assert.equal(res.totalAssignedPorts, 8);
  // Farooq Ganj: 7 users => 1x 1:8 splitter => 8 ports. Saturation = 7/8 = 87.5% (Critical)
  const fg = res.hubs.find(h => h.areaName === 'Farooq Ganj');
  assert.ok(fg);
  assert.equal(fg.totalSubscribers, 7);
  assert.equal(fg.activeSubscribers, 6);
  assert.equal(fg.offlineSubscribers, 1);
  assert.equal(fg.splitters, 1);
  assert.equal(fg.totalPorts, 8);
  assert.equal(fg.sparePorts, 1);
  assert.equal(fg.saturationPercent, 87.5);
  assert.equal(fg.saturationTier, 'Critical Saturation');
  assert.equal(fg.badgeClass, 'badge-danger');
  assert.equal(fg.distanceKm, 1.8);
  assert.ok(fg.estRxPowerDbm < 0);
  assert.equal(fg.signalStatus, 'Signal Optimal');

  // Baradari Road: 1 user => 1x 1:8 splitter => 8 ports. Saturation = 1/8 = 12.5%
  const br = res.hubs.find(h => h.areaName === 'Baradari Road');
  assert.ok(br);
  assert.equal(br.totalSubscribers, 1);
  assert.equal(br.saturationPercent, 12.5);
  assert.equal(br.saturationTier, 'Optimal');

  // Overall totals: 8 assigned, 16 deployed ports => 50% saturation
  assert.equal(res.totalDeployedPorts, 16);
  assert.equal(res.totalSparePorts, 8);
  assert.equal(res.overallSaturationPercent, 50);
  assert.equal(res.criticalSaturationCount, 1);
  assert.equal(res.networkStatus, 'Critical Port Saturation Risk');
});

test('calculateFiberDistributionMetrics respects targetSplitterSize option (16 ports)', () => {
  let state = createInitialState(['User A', 'User B', 'User C']);
  state.customers = state.customers.map(c => ({ ...c, area: 'Saeed Park', status: 'active' }));

  const res = calculateFiberDistributionMetrics(state, { targetSplitterSize: 16 });
  assert.equal(res.targetSplitterSize, 16);
  assert.equal(res.hubs[0].totalPorts, 16);
  assert.equal(res.hubs[0].splitters, 1);
  assert.equal(res.hubs[0].sparePorts, 13);
  assert.equal(res.hubs[0].saturationPercent, 18.8);
});

test('generateFiberDistributionReport formats complete audit briefing text', () => {
  let state = createInitialState(['Alpha', 'Beta']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[1].area = 'Shahdara Town';
  state.customers[1].status = 'offline';

  const res = calculateFiberDistributionMetrics(state);
  const text = generateFiberDistributionReport(res, new Date('2026-10-16T12:00:00+05:00'));

  assert.ok(text.includes('SHAHDARA ISP - FIBER DISTRIBUTION HUB & OPTICAL SPLITTER AUDIT'));
  assert.ok(text.includes('Total Splitter Ports Provisioned: 8'));
  assert.ok(text.includes('Assigned Customer Drops: 2 (Active: 1, Offline: 1)'));
  assert.ok(text.includes('Dark Fiber / Spare Ports Available: 6'));
  assert.ok(text.includes('Shahdara Town: 2 / 8 ports'));
});

test('renderFiberDistributionSvg renders empty state and populated chart', () => {
  const emptyRes = calculateFiberDistributionMetrics(createInitialState([]));
  const emptySvg = renderFiberDistributionSvg(emptyRes);
  assert.ok(emptySvg.includes('No fiber distribution hubs or drops recorded'));

  let state = createInitialState(['Client 1', 'Client 2', 'Client 3']);
  state.customers[0].area = 'Farooq Ganj';
  state.customers[1].area = 'Begum Kot';
  state.customers[2].area = 'Begum Kot';

  const populatedRes = calculateFiberDistributionMetrics(state);
  const svg = renderFiberDistributionSvg(populatedRes);
  assert.ok(svg.includes('Markaz-e-Taqseem-e-Fiber (FDH)'));
  assert.ok(svg.includes('Begum Kot'));
  assert.ok(svg.includes('Active Drops'));
  assert.ok(svg.includes('Dark Headroom (Spare)'));
});

test('setupFiberDistributionModal wires dialog, filters, KPIs, and clipboard dispatch', async () => {
  let state = createInitialState(['User 1', 'User 2']);
  state.customers[0].area = 'Farooq Ganj';
  state.customers[1].area = 'Farooq Ganj';

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let copyHandler = null;
  const filterHandlers = [];

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, handler) => { if (evt === 'click') openHandler = handler; }
  };
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, handler) => { if (evt === 'click') closeHandler = handler; }
  };
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, handler) => { if (evt === 'click') copyHandler = handler; }
  };

  const mockTotalEl = { textContent: '' };
  const mockAssignedEl = { textContent: '' };
  const mockSpareEl = { textContent: '' };
  const mockSatEl = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockTbody = { innerHTML: '' };
  const mockP10El = { textContent: '' };
  const mockP25El = { textContent: '' };
  const mockP50El = { textContent: '' };
  const mockExpEl = { textContent: '' };

  const mockFilterBtns = [
    {
      dataset: { fiberFilter: 'all' },
      classList: { toggle: () => {} },
      setAttribute: () => {},
      addEventListener: (evt, handler) => { if (evt === 'click') filterHandlers.push(handler); }
    },
    {
      dataset: { fiberFilter: 'high' },
      classList: { toggle: () => {} },
      setAttribute: () => {},
      addEventListener: (evt, handler) => { if (evt === 'click') filterHandlers.push(handler); }
    }
  ];

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardFiberModal') return mockModal;
      if (id === 'dashboardOpenFiberModalBtn') return mockOpenBtn;
      if (id === 'dashboardFiberModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyFiberReportBtn') return mockCopyBtn;
      if (id === 'fiberTotalPortsVal') return mockTotalEl;
      if (id === 'fiberAssignedVal') return mockAssignedEl;
      if (id === 'fiberSpareVal') return mockSpareEl;
      if (id === 'fiberSaturationVal') return mockSatEl;
      if (id === 'fiberStatusBadge') return mockStatusBadge;
      if (id === 'fiberHubTableBody') return mockTbody;
      if (id === 'fiberProj10Val') return mockP10El;
      if (id === 'fiberProj25Val') return mockP25El;
      if (id === 'fiberProj50Val') return mockP50El;
      if (id === 'fiberExpansionSplittersVal') return mockExpEl;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel.includes('#fiberFilterGroup')) return mockFilterBtns;
      return [];
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };

  try {
    setupFiberDistributionModal(state, {
      referenceDate: new Date('2026-10-16T12:00:00+05:00'),
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.ok(mockTotalEl.textContent.includes('Ports'));
    assert.ok(mockAssignedEl.textContent.includes('Drops'));
    assert.ok(mockTbody.innerHTML.includes('Farooq Ganj'));

    // Trigger high filter
    filterHandlers[1]();
    // Re-verify modal functions
    await copyHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - FIBER DISTRIBUTION HUB & OPTICAL SPLITTER AUDIT'));
    assert.equal(toastMessage, 'Fiber distribution briefing copied to clipboard!');

    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateDelinquencyRecoveryPipeline handles empty and fully paid states gracefully', () => {
  const refDate = new Date('2026-10-16T12:00:00+05:00');
  const emptyState = createInitialState([]);
  const emptyRes = calculateDelinquencyRecoveryPipeline(emptyState, refDate);

  assert.equal(emptyRes.totalDelinquentAccounts, 0);
  assert.equal(emptyRes.totalDelinquentDues, 0);
  assert.equal(emptyRes.totalExpectedRecovery, 0);
  assert.equal(emptyRes.blendedRecoveryRatePercent, 0);
  assert.equal(emptyRes.severeAtRiskAmount, 0);
  assert.equal(emptyRes.pipelineHealthStatus, 'Clean Ledger (Zero Delinquency)');
  assert.equal(emptyRes.pipelineHealthBadgeClass, 'badge-expansion');
  assert.equal(emptyRes.dailyPacingTarget, 0);
  assert.equal(emptyRes.stages.length, 4);
  assert.equal(emptyRes.topDelinquentAreas.length, 0);
  assert.equal(emptyRes.topDelinquentAccounts.length, 0);

  // Test fully settled customer
  let state = createInitialState(['Settled Sub']);
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[0].id, '2026-10', { amount: '2000', date: '2026-10-09', method: 'Cash' }, refDate);

  const settledRes = calculateDelinquencyRecoveryPipeline(state, refDate);
  assert.equal(settledRes.totalDelinquentAccounts, 0);
  assert.equal(settledRes.totalDelinquentDues, 0);
  assert.equal(settledRes.pipelineHealthStatus, 'Clean Ledger (Zero Delinquency)');
});

test('calculateDelinquencyRecoveryPipeline categorizes overdue balances into stages accurately', () => {
  const refDate = new Date('2026-10-16T12:00:00+05:00');
  let state = createInitialState(['Grace Sub', 'Notice Sub', 'Suspension Sub', 'Severe Sub']);

  // Grace: 5 days overdue (dueDate 2026-10-11)
  state.customers[0].area = 'Main Bazaar';
  state.customers[0].bills = [{ month: '2026-10', amount: 1500, dueDate: '2026-10-11' }];

  // Notice: 14 days overdue (dueDate 2026-10-02)
  state.customers[1].area = 'Wandala Road';
  state.customers[1].bills = [{ month: '2026-09', amount: 2000, dueDate: '2026-10-02' }];

  // Suspension risk: 30 days overdue (dueDate 2026-09-16)
  state.customers[2].area = 'Main Bazaar';
  state.customers[2].bills = [{ month: '2026-09', amount: 3000, dueDate: '2026-09-16' }];

  // Severe: 60 days overdue (dueDate 2026-08-17)
  state.customers[3].area = 'Farooq Ganj';
  state.customers[3].bills = [{ month: '2026-08', amount: 4000, dueDate: '2026-08-17' }];

  const res = calculateDelinquencyRecoveryPipeline(state, refDate);

  assert.equal(res.totalDelinquentAccounts, 4);
  assert.equal(res.totalDelinquentDues, 1500 + 2000 + 3000 + 4000); // 10500

  const graceStage = res.stages.find(s => s.stageKey === 'grace');
  assert.equal(graceStage.subscriberCount, 1);
  assert.equal(graceStage.totalOverdueAmount, 1500);
  assert.equal(graceStage.expectedRecoverableAmount, Math.round(1500 * 0.90)); // 1350

  const noticeStage = res.stages.find(s => s.stageKey === 'notice');
  assert.equal(noticeStage.subscriberCount, 1);
  assert.equal(noticeStage.totalOverdueAmount, 2000);
  assert.equal(noticeStage.expectedRecoverableAmount, Math.round(2000 * 0.70)); // 1400

  const suspStage = res.stages.find(s => s.stageKey === 'suspension_risk');
  assert.equal(suspStage.subscriberCount, 1);
  assert.equal(suspStage.totalOverdueAmount, 3000);
  assert.equal(suspStage.expectedRecoverableAmount, Math.round(3000 * 0.45)); // 1350

  const severeStage = res.stages.find(s => s.stageKey === 'severe');
  assert.equal(severeStage.subscriberCount, 1);
  assert.equal(severeStage.totalOverdueAmount, 4000);
  assert.equal(severeStage.expectedRecoverableAmount, Math.round(4000 * 0.15)); // 600

  const expectedTotal = 1350 + 1400 + 1350 + 600; // 4700
  assert.equal(res.totalExpectedRecovery, expectedTotal);
  assert.equal(res.severeAtRiskAmount, 4000);

  // Severe dues: 4000 / 10500 = 38.09% (>= 35%), so critical
  assert.equal(res.pipelineHealthStatus, 'Critical Escalation Required');
  assert.equal(res.pipelineHealthBadgeClass, 'badge-contraction');

  // Daily target: 4700 / 30 = 157
  assert.equal(res.dailyPacingTarget, Math.round(4700 / 30));

  // Area aggregation: Main Bazaar has 1500 + 3000 = 4500
  assert.equal(res.topDelinquentAreas[0].areaName, 'Main Bazaar');
  assert.equal(res.topDelinquentAreas[0].totalOverdue, 4500);
  assert.equal(res.topDelinquentAreas[0].delinquentAccounts, 2);

  // Top delinquent accounts sorted by balanceDue desc
  assert.equal(res.topDelinquentAccounts[0].balanceDue, 4000);
  assert.equal(res.topDelinquentAccounts[0].name, 'Severe Sub');
});

test('calculateDelinquencyRecoveryPipeline evaluates moderate backlog and healthy pacing tiers', () => {
  const refDate = new Date('2026-10-16T12:00:00+05:00');
  let state = createInitialState(['Sub 1', 'Sub 2']);
  state.customers[0].bills = [{ month: '2026-10', amount: 8000, dueDate: '2026-10-12' }]; // Grace (4 days)
  state.customers[1].bills = [{ month: '2026-08', amount: 2000, dueDate: '2026-08-10' }]; // Severe (67 days)

  // Total: 10000, Severe: 2000 (20% -> between 15% and 35%)
  const modRes = calculateDelinquencyRecoveryPipeline(state, refDate);
  assert.equal(modRes.pipelineHealthStatus, 'Moderate Delinquency Backlog');
  assert.equal(modRes.pipelineHealthBadgeClass, 'badge-stable');

  // Low severe (< 15%)
  state.customers[0].bills = [{ month: '2026-10', amount: 9500, dueDate: '2026-10-12' }]; // Grace
  state.customers[1].bills = [{ month: '2026-08', amount: 500, dueDate: '2026-08-10' }];  // Severe
  const healthyRes = calculateDelinquencyRecoveryPipeline(state, refDate);
  assert.equal(healthyRes.pipelineHealthStatus, 'Healthy Pacing');
  assert.equal(healthyRes.pipelineHealthBadgeClass, 'badge-expansion');
});

test('generateDelinquencyPipelineReport outputs comprehensive plain-text operations briefing', () => {
  const refDate = new Date('2026-10-16T12:00:00+05:00');
  let state = createInitialState(['Tariq Mahmood', 'Zahid Ali']);
  state.customers[0].area = 'Millat Park';
  state.customers[0].bills = [{ month: '2026-10', amount: 1800, dueDate: '2026-10-12' }];
  state.customers[1].area = 'Main Bazaar';
  state.customers[1].bills = [{ month: '2026-08', amount: 3500, dueDate: '2026-08-15' }];

  const data = calculateDelinquencyRecoveryPipeline(state, refDate);
  const report = generateDelinquencyPipelineReport(data, refDate);

  assert.ok(report.includes('SHAHDARA ISP - DELINQUENCY RECOVERY & ESCALATION BRIEFING'));
  assert.ok(report.includes('Delinquent Accounts: 2'));
  assert.ok(report.includes('Total Overdue Dues: PKR 5,300'));
  assert.ok(report.includes('Grace Period (Gentle Reminder)'));
  assert.ok(report.includes('Severe Delinquency Escalation'));
  assert.ok(report.includes('Millat Park'));
  assert.ok(report.includes('Zahid Ali'));
  assert.ok(report.includes('Daily Collector Pacing Target:'));
});

test('renderDelinquencyPipelineSvg generates valid accessible SVG chart', () => {
  const emptySvg = renderDelinquencyPipelineSvg(null);
  assert.ok(emptySvg.includes('No delinquent subscriber accounts'));

  const refDate = new Date('2026-10-16T12:00:00+05:00');
  let state = createInitialState(['Sub X']);
  state.customers[0].bills = [{ month: '2026-10', amount: 2500, dueDate: '2026-10-10' }];
  const data = calculateDelinquencyRecoveryPipeline(state, refDate);

  const svg = renderDelinquencyPipelineSvg(data);
  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('Subscriber Delinquency Recovery &amp; Escalation Pipeline Chart'));
  assert.ok(svg.includes('Khata Wusooli &amp; Aging Pipeline'));
  assert.ok(svg.includes('Pacing Target:'));
  assert.ok(svg.includes('Delinquent:'));
});

test('setupDelinquencyPipelineModal wires modal dialog and interactions correctly', async () => {
  const originalDocument = globalThis.document;

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let copyHandler = null;
  let filterCustomerCalledWith = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') openHandler = cb; }
  };

  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') closeHandler = cb; }
  };

  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') copyHandler = cb; }
  };

  const mockTotalAccountsEl = { textContent: '' };
  const mockTotalDuesEl = { textContent: '' };
  const mockExpectedEl = { textContent: '' };
  const mockRateEl = { textContent: '' };
  const mockBadgeEl = { textContent: '', className: '' };
  const mockDailyTargetEl = { textContent: '' };
  const mockStageTbody = { innerHTML: '' };
  const mockAccountsTbody = {
    innerHTML: '',
    querySelectorAll: (sel) => {
      if (sel.includes('[data-delinquency-filter-id]')) {
        return [{
          getAttribute: () => 'cust-123',
          addEventListener: (evt, cb) => {
            if (evt === 'click') cb();
          }
        }];
      }
      return [];
    }
  };

  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardDelinquencyModal') return mockModal;
      if (id === 'dashboardOpenDelinquencyModalBtn') return mockOpenBtn;
      if (id === 'dashboardDelinquencyModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyDelinquencyReportBtn') return mockCopyBtn;
      if (id === 'delinquencyTotalAccountsVal') return mockTotalAccountsEl;
      if (id === 'delinquencyTotalDuesVal') return mockTotalDuesEl;
      if (id === 'delinquencyExpectedRecoveryVal') return mockExpectedEl;
      if (id === 'delinquencyBlendedRateVal') return mockRateEl;
      if (id === 'delinquencyStatusBadge') return mockBadgeEl;
      if (id === 'delinquencyDailyTargetVal') return mockDailyTargetEl;
      if (id === 'delinquencyStageTableBody') return mockStageTbody;
      if (id === 'delinquencyAccountsTableBody') return mockAccountsTbody;
      return null;
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };

  let state = createInitialState(['Muhammad Usman']);
  state.customers[0].id = 'cust-123';
  state.customers[0].bills = [{ month: '2026-09', amount: 2200, dueDate: '2026-09-10' }];

  try {
    setupDelinquencyPipelineModal(state, {
      referenceDate: new Date('2026-10-16T12:00:00+05:00'),
      onFilterCustomer: (cid) => { filterCustomerCalledWith = cid; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.equal(mockTotalAccountsEl.textContent, '1');
    assert.ok(mockTotalDuesEl.textContent.includes('2,200'));
    assert.ok(mockStageTbody.innerHTML.includes('Grace Period'));
    assert.ok(mockAccountsTbody.innerHTML.includes('Muhammad Usman'));

    // Test copy report
    await copyHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - DELINQUENCY RECOVERY & ESCALATION BRIEFING'));
    assert.equal(toastMessage, 'Delinquency recovery briefing copied to clipboard!');

    // Test close modal
    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('resolveSubscriberCpeModel maps custom and tiered package speeds accurately', () => {
  // Explicit custom model
  const customSub = { cpeModel: 'Nokia G-140W-MD Dual Band ONT' };
  const customRes = resolveSubscriberCpeModel(customSub);
  assert.equal(customRes.modelName, 'Nokia G-140W-MD Dual Band ONT');

  // Gigabit / high speed (>= 20 Mbps)
  const gigaSub = { packageSpeed: '25 Mbps Gigabit Fiber' };
  const gigaRes = resolveSubscriberCpeModel(gigaSub);
  assert.equal(gigaRes.modelId, 'zte-f670l');
  assert.equal(gigaRes.standardUnitCost, 6500);

  // Mid speed (>= 10 Mbps)
  const midSub = { packageSpeed: '12 Mbps Unlimited' };
  const midRes = resolveSubscriberCpeModel(midSub);
  assert.equal(midRes.modelId, 'huawei-hg8546m');
  assert.equal(midRes.standardUnitCost, 4500);

  // Standard speed (>= 5 Mbps)
  const stdSub = { packageSpeed: '7 Mbps Standard' };
  const stdRes = resolveSubscriberCpeModel(stdSub);
  assert.equal(stdRes.modelId, 'fiberhome-an5506');

  // Low speed (< 5 Mbps)
  const lowSub = { packageSpeed: '2 Mbps Economy' };
  const lowRes = resolveSubscriberCpeModel(lowSub);
  assert.equal(lowRes.modelId, 'generic-onu');
});

test('calculateCpeAssetMetrics calculates equipment fleet breakdown, asset values, and health tiers', () => {
  const refDate = new Date('2026-10-16T12:00:00+05:00');
  const emptyState = createInitialState([]);
  const emptyMetrics = calculateCpeAssetMetrics(emptyState, { referenceDate: refDate, warehouseStockOverride: 0 });
  assert.equal(emptyMetrics.totalCpeFleet, 0);
  assert.equal(emptyMetrics.totalFleetValuePkr, 0);
  assert.equal(emptyMetrics.fleetHealthStatus, 'No CPE Fleet Tracked');

  let state = createInitialState(['Active Sub 1', 'Active Sub 2', 'Offline Sub 1', 'Offline Sub 2']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].packageSpeed = '25 Mbps';
  state.customers[0].area = 'Main Bazaar';

  state.customers[1].serviceStatus = 'active';
  state.customers[1].packageSpeed = '10 Mbps';
  state.customers[1].area = 'Wandala Road';

  state.customers[2].serviceStatus = 'offline';
  state.customers[2].packageSpeed = '5 Mbps';
  state.customers[2].area = 'Main Bazaar';
  state.customers[2].offlineDate = '2026-08-01'; // 76 days offline

  state.customers[3].serviceStatus = 'offline';
  state.customers[3].packageSpeed = '25 Mbps';
  state.customers[3].area = 'Farooq Ganj';
  state.customers[3].offlineDate = '2026-09-20'; // 26 days offline

  const metrics = calculateCpeAssetMetrics(state, { referenceDate: refDate, warehouseStockOverride: 6 });

  assert.equal(metrics.activeDeployedCount, 2);
  assert.equal(metrics.dormantFieldCount, 2);
  assert.equal(metrics.warehouseStock, 6);
  assert.equal(metrics.totalCpeFleet, 2 + 2 + 6); // 10 units

  // Active units value: Sub 0 (ZTE: 6500) + Sub 1 (Huawei: 4500) = 11000
  assert.equal(metrics.activeFleetValuePkr, 11000);

  // Dormant units value: Sub 2 (FiberHome: 3800) + Sub 3 (ZTE: 6500) = 10300
  assert.equal(metrics.dormantCapitalAtRiskPkr, 10300);

  // Active utilization: 2 / 10 = 20%
  assert.equal(metrics.activeUtilizationPercent, 20);
  // Dormant risk: 2 / 10 = 20% (between 12% and 25% -> Moderate Idle Asset Exposure)
  assert.equal(metrics.dormantRiskPercent, 20);
  assert.equal(metrics.fleetHealthStatus, 'Moderate Idle Asset Exposure');
  assert.equal(metrics.fleetHealthBadgeClass, 'badge-stable');

  // Retrieval candidates
  assert.equal(metrics.retrievalCandidates.length, 2);
  assert.equal(metrics.retrievalCandidates[0].name, 'Offline Sub 1'); // High priority (76 days offline)
  assert.equal(metrics.retrievalCandidates[0].priority, 'High');

  // Model distribution
  assert.ok(metrics.modelDistribution.length >= 3);
});

test('calculateCpeAssetMetrics handles high equipment retrieval needed threshold and custom warehouse inventory', () => {
  const refDate = new Date('2026-10-16T12:00:00+05:00');
  let state = createInitialState(['Sub A', 'Sub B', 'Sub C']);
  state.customers[0].serviceStatus = 'active';
  state.customers[1].serviceStatus = 'offline';
  state.customers[2].serviceStatus = 'offline';

  // 2 out of 4 total (with warehouseStockOverride = 1) is 50% dormant -> High Equipment Retrieval Needed
  const metrics = calculateCpeAssetMetrics(state, { referenceDate: refDate, warehouseStockOverride: 1 });
  assert.equal(metrics.fleetHealthStatus, 'High Equipment Retrieval Needed');
  assert.equal(metrics.fleetHealthBadgeClass, 'badge-contraction');

  // Low dormant (< 12%)
  const lowDormant = calculateCpeAssetMetrics(state, { referenceDate: refDate, warehouseStockOverride: 20 });
  assert.equal(lowDormant.fleetHealthStatus, 'Optimal Asset Efficiency');
  assert.equal(lowDormant.fleetHealthBadgeClass, 'badge-expansion');
});

test('generateCpeAssetBriefing outputs comprehensive plain-text operations report', () => {
  const refDate = new Date('2026-10-16T12:00:00+05:00');
  let state = createInitialState(['Arshad Khan', 'Bilal Hassan']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].packageSpeed = '15 Mbps';
  state.customers[1].serviceStatus = 'offline';
  state.customers[1].packageSpeed = '25 Mbps';
  state.customers[1].area = 'Millat Park';

  const metrics = calculateCpeAssetMetrics(state, { referenceDate: refDate, warehouseStockOverride: 8 });
  const text = generateCpeAssetBriefing(metrics, refDate);

  assert.ok(text.includes('SHAHDARA ISP - CPE & ONU ASSET LIFECYCLE AUDIT'));
  assert.ok(text.includes('Total Tracked Units: 10'));
  assert.ok(text.includes('Active Field Deployment: 1 units'));
  assert.ok(text.includes('Dormant in Field (At Risk): 1 units'));
  assert.ok(text.includes('Warehouse Spares: 8 tested units'));
  assert.ok(text.includes('HARDWARE MODEL DISTRIBUTION'));
  assert.ok(text.includes('HIGH-PRIORITY CPE RETRIEVAL MANIFEST'));
  assert.ok(text.includes('Bilal Hassan'));
  assert.ok(text.includes('Millat Park'));
});

test('renderCpeAssetLifecycleSvg renders accessible SVG chart for empty and populated states', () => {
  const emptySvg = renderCpeAssetLifecycleSvg(null);
  assert.ok(emptySvg.includes('No customer premises equipment tracked'));

  const refDate = new Date('2026-10-16T12:00:00+05:00');
  let state = createInitialState(['Customer Alpha']);
  state.customers[0].serviceStatus = 'active';
  state.customers[0].packageSpeed = '20 Mbps';

  const metrics = calculateCpeAssetMetrics(state, { referenceDate: refDate });
  const svg = renderCpeAssetLifecycleSvg(metrics);

  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('Customer Premises Equipment CPE and ONU Asset Lifecycle Chart'));
  assert.ok(svg.includes('CPE &amp; ONU Asset Fleet'));
  assert.ok(svg.includes('Active Deployed'));
  assert.ok(svg.includes('Dormant in Field'));
  assert.ok(svg.includes('Warehouse Spares'));
});

test('setupCpeAssetModal wires dialog open, populate, filter, copy, and close actions', async () => {
  const originalDocument = globalThis.document;

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let copyHandler = null;
  let filterCustomerCalledWith = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') openHandler = cb; }
  };

  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') closeHandler = cb; }
  };

  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') copyHandler = cb; }
  };

  const mockTotalFleetEl = { textContent: '' };
  const mockTotalValueEl = { textContent: '' };
  const mockActiveDeployEl = { textContent: '' };
  const mockDormantRiskEl = { textContent: '' };
  const mockStatusBadgeEl = { textContent: '', className: '' };
  const mockRunwayEl = { textContent: '' };
  const mockModelsTbody = { innerHTML: '' };
  const mockRetrievalTbody = {
    innerHTML: '',
    querySelectorAll: (sel) => {
      if (sel.includes('[data-cpe-filter-id]')) {
        return [{
          getAttribute: () => 'sub-456',
          addEventListener: (evt, cb) => {
            if (evt === 'click') cb();
          }
        }];
      }
      return [];
    }
  };

  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardCpeModal') return mockModal;
      if (id === 'dashboardOpenCpeModalBtn') return mockOpenBtn;
      if (id === 'dashboardCpeModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyCpeReportBtn') return mockCopyBtn;
      if (id === 'cpeTotalFleetVal') return mockTotalFleetEl;
      if (id === 'cpeTotalValueVal') return mockTotalValueEl;
      if (id === 'cpeActiveDeployVal') return mockActiveDeployEl;
      if (id === 'cpeDormantRiskVal') return mockDormantRiskEl;
      if (id === 'cpeStatusBadge') return mockStatusBadgeEl;
      if (id === 'cpeSparesRunwayVal') return mockRunwayEl;
      if (id === 'cpeModelsTableBody') return mockModelsTbody;
      if (id === 'cpeRetrievalTableBody') return mockRetrievalTbody;
      return null;
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };

  let state = createInitialState(['Offline User']);
  state.customers[0].id = 'sub-456';
  state.customers[0].serviceStatus = 'offline';
  state.customers[0].packageSpeed = '15 Mbps';
  state.customers[0].area = 'Main Bazaar';

  try {
    setupCpeAssetModal(state, {
      referenceDate: new Date('2026-10-16T12:00:00+05:00'),
      onFilterCustomer: (cid) => { filterCustomerCalledWith = cid; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.ok(mockTotalFleetEl.textContent.includes('Units'));
    assert.ok(mockTotalValueEl.textContent.includes('PKR'));
    assert.ok(mockModelsTbody.innerHTML.includes('Huawei EchoLife'));
    assert.ok(mockRetrievalTbody.innerHTML.includes('Offline User'));

    // Copy briefing
    await copyHandler();
    assert.ok(copiedText.includes('SHAHDARA ISP - CPE & ONU ASSET LIFECYCLE AUDIT'));
    assert.equal(toastMessage, 'CPE asset audit briefing copied to clipboard!');

    // Close modal
    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculatePowerBackupMetrics handles empty and populated states, matching areas and evaluating runway', () => {
  // Empty state
  const emptyRes = calculatePowerBackupMetrics(null);
  assert.equal(emptyRes.totalHubsMonitored, 4);
  assert.equal(emptyRes.totalActiveSubscribers, 0);
  assert.equal(emptyRes.totalSubscribersProtected, 0);
  assert.ok(emptyRes.totalBatteryCapacityKwh > 0);
  assert.ok(emptyRes.totalFuelReservesLiters > 0);
  assert.ok(emptyRes.combinedFleetRunwayHours > 0);
  assert.ok(Array.isArray(emptyRes.hubs));
  assert.equal(emptyRes.hubs.length, 4);

  // Populated state
  let state = createInitialState(['User Vandala', 'User Begum Kot', 'User Saeed Park', 'User Jia Musa', 'User Unassigned']);
  state.customers[0].area = 'Vandala Road';
  state.customers[0].serviceStatus = 'active';
  state.customers[1].area = 'Begum Kot';
  state.customers[1].serviceStatus = 'active';
  state.customers[2].area = 'Saeed Park';
  state.customers[2].serviceStatus = 'offline';
  state.customers[3].area = 'Jia Musa';
  state.customers[3].serviceStatus = 'active';
  state.customers[4].area = 'Unknown Area';
  state.customers[4].serviceStatus = 'active';

  const metrics = calculatePowerBackupMetrics(state, { fuelCostPerLiter: 290 });
  assert.equal(metrics.totalSubscribersProtected, 5);
  assert.equal(metrics.totalActiveSubscribers, 4);
  assert.equal(metrics.fuelCostPerLiter, 290);

  // Vandala gets 2 subscribers (Vandala Road + fallback unknown area)
  const vandalaHub = metrics.hubs.find(h => h.id === 'hub-vandala-core');
  assert.ok(vandalaHub);
  assert.equal(vandalaHub.totalSubscribers, 2);
  assert.equal(vandalaHub.activeSubscribers, 2);
  assert.ok(vandalaHub.batteryRunwayHours > 0);
  assert.ok(vandalaHub.generatorRunwayHours > 0);
  assert.equal(vandalaHub.totalOutageRunwayHours, Number((vandalaHub.batteryRunwayHours + vandalaHub.generatorRunwayHours).toFixed(1)));

  // Begum Kot hub is on inverter battery
  const begumHub = metrics.hubs.find(h => h.id === 'hub-begum-kot');
  assert.ok(begumHub);
  assert.equal(begumHub.powerSource, 'Inverter Battery');
  assert.ok(metrics.activeOutagesCount >= 1);
  assert.equal(begumHub.totalSubscribers, 1);
  assert.equal(begumHub.activeSubscribers, 1);
});

test('calculatePowerBackupMetrics respects hubsOverride and handles critical battery/fuel levels', () => {
  const customHubs = [
    {
      id: 'custom-critical-hub',
      name: 'Critical Substation',
      role: 'Emergency Hub',
      primaryAreas: ['Sector A'],
      powerSource: 'Inverter Battery',
      batteryVoltage: 44.1,
      batteryCapacityAh: 50,
      batteryType: 'Lead Acid',
      batteryHealthSoH: 70,
      batteryLevelPercent: 20, // Critical < 35%
      inverterLoadWatts: 500,
      generatorModel: 'Small Portable',
      generatorFuelLiters: 3, // Critical <= 5L
      generatorCapacityLiters: 15,
      generatorFuelBurnRate: 1.5
    }
  ];

  const metrics = calculatePowerBackupMetrics({}, { hubsOverride: customHubs });
  assert.equal(metrics.totalHubsMonitored, 1);
  assert.equal(metrics.criticalHubsCount, 1);
  assert.equal(metrics.activeOutagesCount, 1);
  assert.equal(metrics.gridResilienceStatus, 'Critical Power Disruption');
  assert.equal(metrics.gridResilienceBadgeClass, 'badge-contraction');
  assert.equal(metrics.hubs[0].statusTier, 'Critical Discharge');
});

test('generatePowerBriefingReport formats briefing lines with telemetry and recommendations', () => {
  const emptyReport = generatePowerBriefingReport({ hubs: [] });
  assert.ok(emptyReport.includes('SHAHDARA ISP - POWER OUTAGE & OLT BATTERY HEALTH BRIEFING'));
  assert.ok(emptyReport.includes('No distribution hubs configured'));

  const metrics = calculatePowerBackupMetrics({});
  const report = generatePowerBriefingReport(metrics, new Date('2026-10-16T12:00:00+05:00'));
  assert.ok(report.includes('Date: 2026-10-16'));
  assert.ok(report.includes('Fleet Telecom Battery Capacity'));
  assert.ok(report.includes('Diesel / Petrol Fuel Reserves'));
  assert.ok(report.includes('Combined Outage Runway'));
  assert.ok(report.includes('POP TELEMETRY & RUNWAY AUDIT'));
  assert.ok(report.includes('Shahdara Core NOC (Vandala Road)'));
  assert.ok(report.includes('EMERGENCY FUEL CONSUMPTION ESTIMATE'));
});

test('renderPowerBackupSvg produces valid SVG graphics and handles empty state', () => {
  const emptySvg = renderPowerBackupSvg(null);
  assert.ok(emptySvg.includes('No distribution hub power telemetry recorded'));

  const metrics = calculatePowerBackupMetrics({});
  const svg = renderPowerBackupSvg(metrics);

  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('Power Outage and OLT Battery Health Chart'));
  assert.ok(svg.includes('Distribution POP Power &amp; Telecom Battery Telemetry'));
  assert.ok(svg.includes('BATT:'));
  assert.ok(svg.includes('GEN:'));
  assert.ok(svg.includes('Total Runway Pill') || svg.includes('Total'));
});

test('setupPowerBackupModal wires dialog open, populate, filter, copy, and close actions', async () => {
  const originalDocument = globalThis.document;

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let copyHandler = null;
  let filterAreaCalledWith = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') openHandler = cb; }
  };

  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') closeHandler = cb; }
  };

  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') copyHandler = cb; }
  };

  const mockEnergyEl = { textContent: '' };
  const mockBattRunwayEl = { textContent: '' };
  const mockFuelReservesEl = { textContent: '' };
  const mockFuelRunwayEl = { textContent: '' };
  const mockCombinedRunwayEl = { textContent: '' };
  const mockStatusBadgeEl = { textContent: '', className: '' };
  const mockOutagesCountEl = { textContent: '' };
  let filterClickHandler = null;
  const mockTableBody = {
    innerHTML: '',
    querySelectorAll: (sel) => {
      if (sel.includes('[data-power-filter-area]')) {
        return [{
          getAttribute: () => 'Vandala Road',
          addEventListener: (evt, cb) => {
            if (evt === 'click') filterClickHandler = cb;
          }
        }];
      }
      return [];
    }
  };

  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardPowerModal') return mockModal;
      if (id === 'dashboardOpenPowerModalBtn') return mockOpenBtn;
      if (id === 'dashboardPowerModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyPowerReportBtn') return mockCopyBtn;
      if (id === 'powerTotalEnergyVal') return mockEnergyEl;
      if (id === 'powerTotalRunwayVal') return mockBattRunwayEl;
      if (id === 'powerFuelReservesVal') return mockFuelReservesEl;
      if (id === 'powerFuelRunwayVal') return mockFuelRunwayEl;
      if (id === 'powerCombinedRunwayVal') return mockCombinedRunwayEl;
      if (id === 'powerStatusBadge') return mockStatusBadgeEl;
      if (id === 'powerOutagesCountVal') return mockOutagesCountEl;
      if (id === 'powerHubsTableBody') return mockTableBody;
      return null;
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };

  let state = createInitialState(['User Vandala']);
  state.customers[0].area = 'Vandala Road';

  try {
    setupPowerBackupModal(state, {
      referenceDate: new Date('2026-10-16T12:00:00+05:00'),
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.ok(mockEnergyEl.textContent.includes('kWh'));
    assert.ok(mockFuelReservesEl.textContent.includes('Liters'));
    assert.ok(mockCombinedRunwayEl.textContent.includes('Hours'));
    assert.ok(mockTableBody.innerHTML.includes('Shahdara Core NOC (Vandala Road)'));

    // Trigger area filter button
    assert.ok(filterClickHandler !== null);
    filterClickHandler();
    assert.equal(filterAreaCalledWith, 'Vandala Road');
    assert.equal(modalOpened, false);

    // Trigger copy report
    assert.ok(copyHandler !== null);
    await copyHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA ISP - POWER OUTAGE & OLT BATTERY HEALTH BRIEFING'));
    assert.equal(toastMessage, 'Power backup audit briefing copied to clipboard!');

    // Close modal
    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateRouteDensityMetrics evaluates area stop density, cluster yields, and crew allocations', () => {
  // Empty state
  const emptyRes = calculateRouteDensityMetrics(null);
  assert.equal(emptyRes.totalDelinquentAccounts, 0);
  assert.equal(emptyRes.totalUncollectedDues, 0);
  assert.equal(emptyRes.totalAreasTargeted, 0);
  assert.equal(emptyRes.totalRecommendedCollectors, 0);
  assert.equal(emptyRes.fleetRoutingStatus, 'Zero Overdue Stops (Roster Clean)');
  assert.equal(emptyRes.fleetRoutingBadgeClass, 'badge-expansion');

  // Populated state with unpaid bills
  let state = createInitialState(['Alice Begum', 'Bob Begum', 'Charlie Vandala', 'David Saeed']);
  state.customers[0].area = 'Begum Kot';
  state.customers[1].area = 'Begum Kot';
  state.customers[2].area = 'Vandala Road';
  state.customers[3].area = 'Saeed Park';

  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2500', status: 'pending' }, refDate);
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '3500', status: 'pending' }, refDate);
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '1800', status: 'pending' }, refDate);
  state = saveBillMonth(state, state.customers[3].id, { month: '2026-10', dueAmount: '1200', status: 'pending' }, refDate);

  const metrics = calculateRouteDensityMetrics(state, { referenceDate: refDate });
  assert.equal(metrics.totalDelinquentAccounts, 4);
  assert.equal(metrics.totalUncollectedDues, 9000);
  assert.equal(metrics.totalAreasTargeted, 3);
  assert.ok(metrics.totalRecommendedCollectors >= 3);
  assert.ok(metrics.avgFleetStopYieldPkr > 0);
  assert.ok(metrics.dailyFleetRecoveryTargetPkr > 0);

  // Begum Kot should have 2 accounts and 6000 total overdue
  const begum = metrics.areas.find(a => a.areaName === 'Begum Kot');
  assert.ok(begum);
  assert.equal(begum.overdueCount, 2);
  assert.equal(begum.totalOverdueAmount, 6000);
  assert.equal(begum.avgTicketPerStop, 3000);
  assert.ok(begum.routeEfficiencyScore > 0);
  assert.ok(begum.subscribers.length === 2);
});

test('generateRouteDensityReport formats report with sectors, crew recommendations, and advisory', () => {
  const emptyReport = generateRouteDensityReport({ areas: [] });
  assert.ok(emptyReport.includes('SHAHDARA ISP - FIELD ROUTE DENSITY & COLLECTOR PACING AUDIT'));
  assert.ok(emptyReport.includes('No delinquent collection stops recorded'));

  let state = createInitialState(['Cust 1']);
  state.customers[0].area = 'Vandala Road';
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);

  const metrics = calculateRouteDensityMetrics(state, { referenceDate: refDate });
  const report = generateRouteDensityReport(metrics, refDate);

  assert.ok(report.includes('Date: 2026-10-15'));
  assert.ok(report.includes('Total Delinquent Stops'));
  assert.ok(report.includes('Total Uncollected Target'));
  assert.ok(report.includes('Recommended Field Fleet'));
  assert.ok(report.includes('Vandala Road'));
  assert.ok(report.includes('COLLECTOR DISPATCH ADVISORY'));
});

test('renderRouteDensityMatrixSvg renders pure SVG graphic with density rows and legend', () => {
  const emptySvg = renderRouteDensityMatrixSvg(null);
  assert.ok(emptySvg.includes('No delinquent collection route stops recorded'));

  let state = createInitialState(['Cust A']);
  state.customers[0].area = 'Begum Kot';
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '5000', status: 'pending' }, refDate);

  const metrics = calculateRouteDensityMetrics(state, { referenceDate: refDate });
  const svg = renderRouteDensityMatrixSvg(metrics);

  assert.ok(svg.includes('role="img"'));
  assert.ok(svg.includes('Area Collection Route Density and Collector Pacing Chart'));
  assert.ok(svg.includes('Field Route Density &amp; Collector Pacing Matrix'));
  assert.ok(svg.includes('Begum Kot'));
  assert.ok(svg.includes('TARGET:'));
  assert.ok(svg.includes('DENSITY:'));
});

test('setupRouteDensityModal wires modal open, populate, filter, copy, and close actions', async () => {
  const originalDocument = globalThis.document;

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let copyHandler = null;
  let filterAreaCalledWith = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') openHandler = cb; }
  };

  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') closeHandler = cb; }
  };

  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, cb) => { if (evt === 'click') copyHandler = cb; }
  };

  const mockStopsEl = { textContent: '' };
  const mockDuesEl = { textContent: '' };
  const mockCrewEl = { textContent: '' };
  const mockStatusBadgeEl = { textContent: '', className: '' };
  const mockDailyTargetEl = { textContent: '' };

  let filterClickHandler = null;
  const mockTableBody = {
    innerHTML: '',
    querySelectorAll: (sel) => {
      if (sel.includes('[data-route-filter-area]')) {
        return [{
          getAttribute: () => 'Begum Kot',
          addEventListener: (evt, cb) => {
            if (evt === 'click') filterClickHandler = cb;
          }
        }];
      }
      return [];
    }
  };

  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardRouteDensityModal') return mockModal;
      if (id === 'dashboardOpenRouteDensityModalBtn') return mockOpenBtn;
      if (id === 'dashboardRouteDensityModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyRouteDensityReportBtn') return mockCopyBtn;
      if (id === 'routeDensityTotalStopsVal') return mockStopsEl;
      if (id === 'routeDensityTotalDuesVal') return mockDuesEl;
      if (id === 'routeDensityFleetCrewVal') return mockCrewEl;
      if (id === 'routeDensityStatusBadge') return mockStatusBadgeEl;
      if (id === 'routeDensityDailyTargetVal') return mockDailyTargetEl;
      if (id === 'routeDensityTableBody') return mockTableBody;
      return null;
    }
  };

  let toastMessage = null;
  let copiedText = null;
  const mockClipboard = {
    writeText: async (t) => { copiedText = t; }
  };

  let state = createInitialState(['User Begum']);
  state.customers[0].area = 'Begum Kot';
  const refDate = new Date('2026-10-15T12:00:00+05:00');
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '4000', status: 'pending' }, refDate);

  try {
    setupRouteDensityModal(state, {
      referenceDate: refDate,
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: mockClipboard
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    assert.ok(mockStopsEl.textContent.includes('Stops'));
    assert.ok(mockDuesEl.textContent.includes('4,000'));
    assert.ok(mockCrewEl.textContent.includes('Collectors'));
    assert.ok(mockTableBody.innerHTML.includes('Begum Kot'));

    // Trigger area filter button
    assert.ok(filterClickHandler !== null);
    filterClickHandler();
    assert.equal(filterAreaCalledWith, 'Begum Kot');
    assert.equal(modalOpened, false);

    // Trigger copy report
    assert.ok(copyHandler !== null);
    await copyHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA ISP - FIELD ROUTE DENSITY & COLLECTOR PACING AUDIT'));
    assert.equal(toastMessage, 'Route density briefing copied to clipboard!');

    // Close modal
    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateOtdrFaultMetrics handles empty state and returns monitored routes', () => {
  const result = calculateOtdrFaultMetrics();
  assert.equal(result.totalRoutesMonitored, 5);
  assert.ok(result.totalFiberDistanceKm > 10);
  assert.equal(result.wavelength, 1310);
  assert.equal(result.selectedRoute.id, 'saeed-park-feeder');
  assert.equal(result.routesWithBreaks, 0);
  assert.equal(result.fleetStatus, 'ALL FIBER ROUTES NORMAL');
  assert.equal(result.selectedRoute.totalSubscribers, 0);
  assert.equal(result.selectedRoute.hasFault, false);
});

test('calculateOtdrFaultMetrics detects critical fiber break when offline cluster exists', () => {
  let state = createInitialState(['Sub 1', 'Sub 2', 'Sub 3', 'Sub 4']);
  // Put 4 subscribers in Saeed Park, 3 of them offline
  state.customers[0].area = 'Saeed Park';
  state.customers[0].manualStatus = 'Offline';
  state.customers[0].packagePrice = 2000;

  state.customers[1].area = 'Saeed Park';
  state.customers[1].manualStatus = 'Offline';
  state.customers[1].packagePrice = 2500;

  state.customers[2].area = 'Saeed Park';
  state.customers[2].manualStatus = 'Offline';
  state.customers[2].packagePrice = 1800;

  state.customers[3].area = 'Saeed Park';
  state.customers[3].manualStatus = 'Active';
  state.customers[3].packagePrice = 2000;

  const result = calculateOtdrFaultMetrics(state, { routeId: 'saeed-park-feeder' });
  const route = result.selectedRoute;

  assert.equal(route.totalSubscribers, 4);
  assert.equal(route.offlineSubscribers, 3);
  assert.equal(route.activeSubscribers, 1);
  assert.equal(route.offlinePercent, 75);
  assert.equal(route.atRiskRevenuePkr, 6300);
  assert.equal(route.hasFault, true);
  assert.equal(route.faultSeverity, 'critical');
  assert.equal(route.faultDistanceMeters, 1420);
  assert.ok(route.faultStatusLabel.includes('CRITICAL FIBER BREAK'));
  assert.ok(route.faultLandmark.includes('Jamia Masjid'));
  assert.equal(result.routesWithBreaks, 1);
  assert.ok(result.fleetStatus.includes('1 CRITICAL FIBER CUT'));

  // Ensure break event was injected into events array
  const faultEvent = route.events.find(e => e.isFault);
  assert.ok(faultEvent);
  assert.equal(faultEvent.distanceMeters, 1420);
  assert.equal(faultEvent.lossDb, 35.0);
  assert.equal(faultEvent.powerLevelDbm, -38.0);

  // Subsequent events should be marked unreachable
  const unreachableEvents = route.events.filter(e => e.unreachable);
  assert.ok(unreachableEvents.length > 0);
});

test('calculateOtdrFaultMetrics detects macrobend when single subscriber offline', () => {
  let state = createInitialState(['Sub 1', 'Sub 2']);
  state.customers[0].area = 'Vandala Road';
  state.customers[0].manualStatus = 'Offline';
  state.customers[1].area = 'Vandala Road';
  state.customers[1].manualStatus = 'Active';

  const result1310 = calculateOtdrFaultMetrics(state, { routeId: 'wandala-trunk', wavelength: 1310 });
  const route1310 = result1310.selectedRoute;
  assert.equal(route1310.hasFault, true);
  assert.equal(route1310.faultSeverity, 'warning');
  assert.ok(route1310.faultType.includes('Macrobend'));

  const bendEv1310 = route1310.events.find(e => e.isFault);
  assert.ok(bendEv1310);
  assert.equal(bendEv1310.lossDb, 1.4);

  // At 1550nm, macrobend loss should be significantly higher
  const result1550 = calculateOtdrFaultMetrics(state, { routeId: 'wandala-trunk', wavelength: 1550 });
  const bendEv1550 = result1550.selectedRoute.events.find(e => e.isFault);
  assert.ok(bendEv1550);
  assert.equal(bendEv1550.lossDb, 4.8);
  assert.equal(result1550.selectedRoute.attenuationRateDbPerKm, '0.20');
});

test('calculateOtdrFaultMetrics handles manual distance simulation override and getters/setters', () => {
  let state = createInitialState(['Sub 1']);
  state.customers[0].area = 'Saeed Park';

  setOtdrSelectedRoute('wandala-trunk');
  assert.equal(getOtdrSelectedRoute(), 'wandala-trunk');

  setOtdrWavelength(1550);
  assert.equal(getOtdrWavelength(), 1550);

  setOtdrSimulatedDistance(980);
  assert.equal(getOtdrSimulatedDistance(), 980);

  const simResult = calculateOtdrFaultMetrics(state);
  assert.equal(simResult.selectedRoute.id, 'wandala-trunk');
  assert.equal(simResult.selectedRoute.hasFault, true);
  assert.equal(simResult.selectedRoute.faultDistanceMeters, 980);
  assert.ok(simResult.selectedRoute.faultType.includes('Simulated'));

  // Reset simulation
  setOtdrSimulatedDistance(null);
  assert.equal(getOtdrSimulatedDistance(), null);
  setOtdrSelectedRoute('saeed-park-feeder');
  setOtdrWavelength(1310);
});

test('generateOtdrReport formats operational field advisory with landmarks and action steps', () => {
  const emptyReport = generateOtdrReport();
  assert.ok(emptyReport.includes('SHAHDARA ISP - OTDR FIBER FAULT DISPATCH ADVISORY'));
  assert.ok(emptyReport.includes('Saeed Park Feeder'));
  assert.ok(emptyReport.includes('FIELD SPLICING ACTION PROTOCOL'));
  assert.ok(emptyReport.includes('Fujikura fusion splicer'));

  let state = createInitialState(['Sub 1', 'Sub 2']);
  state.customers[0].area = 'Saeed Park';
  state.customers[0].manualStatus = 'Offline';
  state.customers[0].packagePrice = 2500;
  state.customers[1].area = 'Saeed Park';
  state.customers[1].manualStatus = 'Offline';
  state.customers[1].packagePrice = 2500;

  const data = calculateOtdrFaultMetrics(state, { routeId: 'saeed-park-feeder' });
  const refDate = new Date('2026-10-16T10:00:00+05:00');
  const report = generateOtdrReport(data, refDate);

  assert.ok(report.includes('2026-10-16'));
  assert.ok(report.includes('⚡ FAULT DISTANCE FROM OLT: 1420 meters'));
  assert.ok(report.includes('Jamia Masjid'));
  assert.ok(report.includes('OFFLINE SUBSCRIBERS AT RISK: 2 accounts'));
  assert.ok(report.includes('REVENUE AT RISK:'));
  assert.ok(report.includes('5,000'));
  assert.ok(report.includes('Shahdara Splicing Crew 1'));
});

test('renderOtdrTraceSvg renders technical SVG with grid, Rayleigh slope, and fault overlay', () => {
  const fallbackSvg = renderOtdrTraceSvg(null);
  assert.ok(fallbackSvg.includes('role="img"'));
  assert.ok(fallbackSvg.includes('No OTDR fiber telemetry available'));

  let state = createInitialState(['Sub 1', 'Sub 2']);
  state.customers[0].area = 'Saeed Park';
  state.customers[0].manualStatus = 'Offline';
  state.customers[1].area = 'Saeed Park';
  state.customers[1].manualStatus = 'Offline';

  const data = calculateOtdrFaultMetrics(state, { routeId: 'saeed-park-feeder' });
  const svg = renderOtdrTraceSvg(data, { width: 640, height: 260 });

  assert.ok(svg.includes('viewBox="0 0 640 260"'));
  assert.ok(svg.includes('otdr-trace-svg'));
  assert.ok(svg.includes('Saeed Park Feeder'));
  assert.ok(svg.includes('Rayleigh Noise Floor'));
  assert.ok(svg.includes('FIBER CUT DETECTED'));
  assert.ok(svg.includes('otdr-fault-marker'));
  assert.ok(svg.includes('1420m'));
});

test('setupOtdrModal wires route select, wavelength, slider, filter area, copy report, and modal open/close', async () => {
  const originalDocument = globalThis.document;

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let routeChangeHandler = null;
  let wavelengthChangeHandler = null;
  let sliderInputHandler = null;
  let resetClickHandler = null;
  let copyHandler = null;
  let filterClickHandler = null;

  let filterAreaCalledWith = null;
  let copiedText = null;
  let toastMessage = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'click') openHandler = h; }
  };

  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'click') closeHandler = h; }
  };

  const mockRouteSelect = {
    children: [],
    innerHTML: '',
    value: 'wandala-trunk',
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'change') routeChangeHandler = h; }
  };

  const mockWavelengthSelect = {
    value: '1550',
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'change') wavelengthChangeHandler = h; }
  };

  const mockSlider = {
    value: '1850',
    max: '3800',
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'input') sliderInputHandler = h; }
  };

  const mockSliderVal = { textContent: '' };
  const mockResetBtn = {
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'click') resetClickHandler = h; }
  };

  const mockChartContainer = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const mockFilterAreaBtn = {
    textContent: '',
    dataset: {},
    setAttribute: (name, val) => { mockFilterAreaBtn[name] = val; },
    getAttribute: (name) => mockFilterAreaBtn[name],
    addEventListener: (evt, h) => { if (evt === 'click') filterClickHandler = h; }
  };

  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'click') copyHandler = h; }
  };

  const mockRouteNameEl = { textContent: '' };
  const mockBreakDistEl = { textContent: '' };
  const mockAffectedSubsEl = { textContent: '' };
  const mockAtRiskRevEl = { textContent: '' };
  const mockOpticalMarginEl = { textContent: '' };
  const mockStatusBadgeEl = { textContent: '', className: '' };

  try {
    globalThis.document = {
      getElementById: (id) => {
        switch (id) {
          case 'dashboardOtdrModal': return mockModal;
          case 'dashboardOpenOtdrModalBtn': return mockOpenBtn;
          case 'dashboardOtdrModalCloseBtn': return mockCloseBtn;
          case 'otdrRouteSelect': return mockRouteSelect;
          case 'otdrWavelengthSelect': return mockWavelengthSelect;
          case 'otdrDistanceSlider': return mockSlider;
          case 'otdrDistanceSliderVal': return mockSliderVal;
          case 'otdrResetSimBtn': return mockResetBtn;
          case 'otdrModalTraceChart': return mockChartContainer;
          case 'otdrEventsTableBody': return mockTableBody;
          case 'dashboardCopyOtdrReportBtn': return mockCopyBtn;
          case 'otdrFilterAreaBtn': return mockFilterAreaBtn;
          case 'otdrKpiRouteName': return mockRouteNameEl;
          case 'otdrKpiBreakDist': return mockBreakDistEl;
          case 'otdrKpiAffectedSubs': return mockAffectedSubsEl;
          case 'otdrKpiAtRiskRev': return mockAtRiskRevEl;
          case 'otdrKpiOpticalMargin': return mockOpticalMarginEl;
          case 'otdrStatusBadge': return mockStatusBadgeEl;
          default: return null;
        }
      }
    };

    let state = createInitialState(['Customer 1', 'Customer 2']);
    state.customers[0].area = 'Vandala Road';
    state.customers[0].manualStatus = 'Offline';
    state.customers[1].area = 'Vandala Road';
    state.customers[1].manualStatus = 'Offline';

    setupOtdrModal(state, {
      referenceDate: new Date('2026-10-16T10:00:00+05:00'),
      onFilterArea: (a) => { filterAreaCalledWith = a; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: { writeText: async (t) => { copiedText = t; } }
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    // Verify view populated
    assert.ok(mockRouteSelect.innerHTML.includes('Saeed Park'));
    assert.ok(mockChartContainer.innerHTML.includes('otdr-trace-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Launch Connector'));

    // Test wavelength change
    assert.ok(wavelengthChangeHandler !== null);
    mockWavelengthSelect.value = '1550';
    wavelengthChangeHandler();
    assert.equal(getOtdrWavelength(), 1550);

    // Test slider change
    assert.ok(sliderInputHandler !== null);
    mockSlider.value = '1250';
    sliderInputHandler();
    assert.equal(getOtdrSimulatedDistance(), 1250);
    assert.equal(mockSliderVal.textContent, '1250 m');

    // Test reset button
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getOtdrSimulatedDistance(), null);

    // Test filter area action
    assert.ok(filterClickHandler !== null);
    filterClickHandler();
    assert.equal(filterAreaCalledWith, 'Saeed Park');
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyHandler !== null);
    await copyHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA ISP - OTDR FIBER FAULT DISPATCH ADVISORY'));
    assert.equal(toastMessage, 'OTDR dispatch briefing copied to clipboard!');

    // Test close button
    assert.ok(closeHandler !== null);
    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateSolarInverterMetrics handles empty state and defaults to station-main-hub', () => {
  const result = calculateSolarInverterMetrics();
  assert.equal(result.hubs.length, 5);
  assert.equal(result.selectedHub.id, 'station-main-hub');
  assert.ok(result.totalFleetSolarWp >= 30000);
  assert.equal(result.selectedMode, 'SBU');
  assert.ok(result.selectedHub.hourlyData.length >= 14);
});

test('calculateSolarInverterMetrics calculates solar irradiance, diurnal curve and cost savings', () => {
  let state = createInitialState(['User 1', 'User 2', 'User 3']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].manualStatus = 'Active';

  // 12:30 PKT (Peak sun)
  const peakDate = new Date('2026-10-16T12:30:00+05:00');
  const peakResult = calculateSolarInverterMetrics(state, { referenceDate: peakDate, hubId: 'station-main-hub' });
  const hub = peakResult.selectedHub;

  assert.ok(hub.currentPvW > 5000); // 12kWp array produces over 5kW during peak sun
  assert.equal(hub.batteryState, 'CHARGING');
  assert.ok(hub.dailySolarKwh > 20);
  assert.ok(hub.dailySavedPkr > 1000);
  assert.ok(hub.monthlySavedPkr > 30000);

  // Night time (22:00 PKT)
  const nightDate = new Date('2026-10-16T22:00:00+05:00');
  const nightResult = calculateSolarInverterMetrics(state, { referenceDate: nightDate, hubId: 'station-main-hub' });
  assert.equal(nightResult.selectedHub.currentPvW, 0);
});

test('calculateSolarInverterMetrics detects LESCO load shedding during offline clusters or Island mode', () => {
  let state = createInitialState(['Sub 1', 'Sub 2', 'Sub 3', 'Sub 4']);
  // Put 4 subscribers in Wandala Road, 2 offline (50%)
  state.customers[0].area = 'Vandala Road';
  state.customers[0].manualStatus = 'Offline';
  state.customers[1].area = 'Vandala Road';
  state.customers[1].manualStatus = 'Offline';
  state.customers[2].area = 'Vandala Road';
  state.customers[2].manualStatus = 'Active';
  state.customers[3].area = 'Vandala Road';
  state.customers[3].manualStatus = 'Active';

  const result = calculateSolarInverterMetrics(state, { hubId: 'wandala-sub-station' });
  const hub = result.selectedHub;

  assert.equal(hub.isGridDown, true);
  assert.ok(hub.gridStatusLabel.includes('LOAD SHEDDING ACTIVE'));
  assert.equal(hub.inverterOperationMode, 'Island Backup');
  assert.ok(hub.autonomyHours > 0);
});

test('calculateSolarInverterMetrics handles simulation overrides and getters/setters', () => {
  setSolarSelectedHub('saeed-park-optical-pop');
  assert.equal(getSolarSelectedHub(), 'saeed-park-optical-pop');

  setSolarMode('Island');
  assert.equal(getSolarMode(), 'Island');

  setSolarIrradiance(95);
  assert.equal(getSolarIrradiance(), 95);

  const result = calculateSolarInverterMetrics();
  assert.equal(result.selectedHub.id, 'saeed-park-optical-pop');
  assert.equal(result.selectedMode, 'Island');
  assert.equal(result.irradiancePercent, 95);
  assert.equal(result.selectedHub.isGridDown, true);

  // Reset
  setSolarIrradiance(null);
  assert.equal(getSolarIrradiance(), null);
  setSolarMode('SBU');
  setSolarSelectedHub('station-main-hub');
});

test('generateSolarReport formats operational briefing with hourly breakdown', () => {
  const report = generateSolarReport();
  assert.ok(report.includes('SHAHDARA ISP - SOLAR INVERTER & GRID RESILIENCE AUDIT'));
  assert.ok(report.includes('Shahdara Station Central POP'));
  assert.ok(report.includes('LOAD SHEDDING OPERATING PROTOCOL'));
  assert.ok(report.includes('HOURLY SOLAR GENERATION CURVE'));
  assert.ok(report.includes('LESCO Grid Cost Avoided'));
});

test('renderSolarInverterSvg renders technical SVG with solar curve and battery autonomy', () => {
  const fallbackSvg = renderSolarInverterSvg(null);
  assert.ok(fallbackSvg.includes('role="img"'));
  assert.ok(fallbackSvg.includes('No solar inverter telemetry available'));

  const data = calculateSolarInverterMetrics();
  const svg = renderSolarInverterSvg(data, { width: 640, height: 260 });

  assert.ok(svg.includes('viewBox="0 0 640 260"'));
  assert.ok(svg.includes('solar-inverter-svg'));
  assert.ok(svg.includes('Shahdara Station Central POP'));
  assert.ok(svg.includes('Solar Generation Curve'));
  assert.ok(svg.includes('Equipment AC Load'));
  assert.ok(svg.includes('Battery Autonomy'));
});

test('setupSolarModal wires hub select, mode, irradiance slider, filter area, copy report, and modal open/close', async () => {
  const originalDocument = globalThis.document;

  let modalOpened = false;
  let openHandler = null;
  let closeHandler = null;
  let hubChangeHandler = null;
  let modeChangeHandler = null;
  let sliderInputHandler = null;
  let resetClickHandler = null;
  let copyHandler = null;
  let filterClickHandler = null;

  let filterAreaCalledWith = null;
  let copiedText = null;
  let toastMessage = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'click') openHandler = h; }
  };

  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'click') closeHandler = h; }
  };

  const mockHubSelect = {
    children: [],
    innerHTML: '',
    value: 'wandala-sub-station',
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'change') hubChangeHandler = h; }
  };

  const mockModeSelect = {
    value: 'Island',
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'change') modeChangeHandler = h; }
  };

  const mockSlider = {
    value: '80',
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'input') sliderInputHandler = h; }
  };

  const mockSliderVal = { textContent: '' };
  const mockResetBtn = {
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'click') resetClickHandler = h; }
  };

  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const mockFilterAreaBtn = {
    textContent: '',
    dataset: {},
    setAttribute: (name, val) => { mockFilterAreaBtn[name] = val; },
    getAttribute: (name) => mockFilterAreaBtn[name],
    addEventListener: (evt, h) => { if (evt === 'click') filterClickHandler = h; }
  };

  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, h) => { if (evt === 'click') copyHandler = h; }
  };

  const mockHubNameEl = { textContent: '' };
  const mockPvOutputEl = { textContent: '' };
  const mockBatterySocEl = { textContent: '' };
  const mockGridStatusEl = { textContent: '' };
  const mockSavingsEl = { textContent: '' };
  const mockStatusBadgeEl = { textContent: '', className: '' };

  try {
    globalThis.document = {
      getElementById: (id) => {
        switch (id) {
          case 'dashboardSolarModal': return mockModal;
          case 'dashboardOpenSolarModalBtn': return mockOpenBtn;
          case 'dashboardSolarModalCloseBtn': return mockCloseBtn;
          case 'solarHubSelect': return mockHubSelect;
          case 'solarModeSelect': return mockModeSelect;
          case 'solarIrradianceSlider': return mockSlider;
          case 'solarIrradianceVal': return mockSliderVal;
          case 'solarResetSimBtn': return mockResetBtn;
          case 'solarModalChartWrap': return mockChartWrap;
          case 'solarHubsTableBody': return mockTableBody;
          case 'dashboardCopySolarReportBtn': return mockCopyBtn;
          case 'solarFilterAreaBtn': return mockFilterAreaBtn;
          case 'solarKpiHubName': return mockHubNameEl;
          case 'solarKpiPvOutput': return mockPvOutputEl;
          case 'solarKpiBatterySoc': return mockBatterySocEl;
          case 'solarKpiGridStatus': return mockGridStatusEl;
          case 'solarKpiSavings': return mockSavingsEl;
          case 'solarStatusBadge': return mockStatusBadgeEl;
          default: return null;
        }
      }
    };

    let state = createInitialState(['Customer 1']);
    state.customers[0].area = 'Shahdara Town';

    setupSolarModal(state, {
      referenceDate: new Date('2026-10-16T12:00:00+05:00'),
      onFilterArea: (a) => { filterAreaCalledWith = a; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: { writeText: async (t) => { copiedText = t; } }
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    // Verify populated
    assert.ok(mockHubSelect.innerHTML.includes('Shahdara Station'));
    assert.ok(mockChartWrap.innerHTML.includes('solar-inverter-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Inverex'));

    // Test mode change
    assert.ok(modeChangeHandler !== null);
    mockModeSelect.value = 'Island';
    modeChangeHandler();
    assert.equal(getSolarMode(), 'Island');

    // Test slider change
    assert.ok(sliderInputHandler !== null);
    mockSlider.value = '75';
    sliderInputHandler();
    assert.equal(getSolarIrradiance(), 75);
    assert.equal(mockSliderVal.textContent, '75%');

    // Test reset
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getSolarIrradiance(), null);

    // Test filter area action
    assert.ok(filterClickHandler !== null);
    filterClickHandler();
    assert.equal(filterAreaCalledWith, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyHandler !== null);
    await copyHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA ISP - SOLAR INVERTER & GRID RESILIENCE AUDIT'));
    assert.equal(toastMessage, 'Solar power audit briefing copied to clipboard!');

    // Test close
    assert.ok(closeHandler !== null);
    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateAerialTensionMetrics computes baseline catenary sag, ground clearance, and clamp tension correctly', () => {
  const state = createInitialState([]);
  const data = calculateAerialTensionMetrics(state, {
    sectorId: 'wandala-corridor',
    windSpeed: 20,
    temperature: 25
  });

  assert.equal(data.sector.id, 'wandala-corridor');
  assert.equal(data.cable.id, 'adss-24c');
  assert.ok(data.inputs.dynamicWindPressurePa > 0);
  assert.ok(data.mechanical.verticalGravityLoadNm > 0);
  assert.ok(data.mechanical.horizontalWindLoadNm > 0);
  assert.ok(data.mechanical.totalResultantLoadNm > data.mechanical.verticalGravityLoadNm);

  // Sag should be positive and reasonable (typically 0.3m to 1.5m for 56m span)
  assert.ok(data.mechanical.verticalSagM > 0.1 && data.mechanical.verticalSagM < 2.5);
  // Clearance should be attachmentHeight - verticalSagM
  const expectedClearance = Number((data.sector.attachmentHeightMeters - data.mechanical.verticalSagM).toFixed(2));
  assert.equal(data.mechanical.midspanGroundClearanceM, expectedClearance);
  // Clearance is above minimum 5.5m under mild conditions
  assert.equal(data.mechanical.clearanceViolation, false);
  assert.ok(data.mechanical.clearanceMarginM > 0);

  // Mechanical tension should be within 10% to 50% UTS under mild wind
  assert.ok(data.mechanical.tensionUtsRatioPercent > 5 && data.mechanical.tensionUtsRatioPercent < 60);
  assert.equal(data.risk.statusTier, 'optimal');
  assert.ok(data.fleetSummary.length >= 5);
});

test('calculateAerialTensionMetrics detects clearance violation under excessive sag and thermal expansion', () => {
  const state = createInitialState([]);
  // Longest span (Shahdara Chowk Highway Crossing, 74m) or Saeed Park (68m), high temp 50°C and heavy cable
  const data = calculateAerialTensionMetrics(state, {
    sectorId: 'chowk-station-crossing',
    windSpeed: 60,
    temperature: 50,
    cableId: 'armored-48c'
  });

  assert.equal(data.sector.id, 'chowk-station-crossing');
  assert.ok(data.mechanical.verticalSagM > 0.5);
  // With 6.5m required clearance and 9.2m attachment height, sag > 2.7m causes clearance violation
  assert.ok(data.mechanical.midspanGroundClearanceM <= data.sector.attachmentHeightMeters);
  assert.ok(data.mechanical.poleBaseBendingMomentNm > 0);
});

test('calculateAerialTensionMetrics detects critical tension snap hazard under extreme storm gusts', () => {
  const state = createInitialState([]);
  // Severe monsoon dust storm (120 km/h) and freezing winter chill (-10°C) with Figure-8 2-core drop
  const data = calculateAerialTensionMetrics(state, {
    sectorId: 'saeed-park-overhead',
    windSpeed: 120,
    temperature: -10,
    cableId: 'fig8-2c' // 1250 N UTS
  });

  assert.equal(data.risk.statusTier, 'critical');
  assert.equal(data.risk.statusLabel, 'CRITICAL TENSION SNAP HAZARD');
  assert.ok(data.mechanical.tensionUtsRatioPercent >= 75);
  assert.ok(data.risk.primaryRiskFactor.includes('exceeds 75%'));
});

test('calculateAerialTensionMetrics aggregates sector customer counts and revenue at risk from ledger', () => {
  let state = createInitialState(['Customer One', 'Customer Two', 'Customer Three']);
  state.customers[0].area = 'Vandala Road';
  state.customers[0].serviceStatus = 'active';
  state.customers[0].monthlyRate = 2500;

  state.customers[1].area = 'Wandala Road';
  state.customers[1].serviceStatus = 'offline';
  state.customers[1].monthlyRate = 1800;

  state.customers[2].area = 'Begum Kot'; // Unrelated area
  state.customers[2].serviceStatus = 'active';
  state.customers[2].monthlyRate = 3000;

  const data = calculateAerialTensionMetrics(state, {
    sectorId: 'wandala-corridor'
  });

  assert.equal(data.ledger.totalAreaCustomers, 2);
  assert.equal(data.ledger.activeSubscribers, 1);
  assert.equal(data.ledger.offlineSubscribers, 1);
  assert.equal(data.ledger.totalMonthlyBilledPkr, 4300);
  assert.ok(data.ledger.monthlyRevenueAtRiskPkr > 0);
  assert.ok(data.ledger.estimatedDropsCarried >= 1);
});

test('renderAerialTensionSvg produces clean SVG markup with poles, catenary curve, and clearance tags', () => {
  const state = createInitialState([]);
  const data = calculateAerialTensionMetrics(state, { sectorId: 'wandala-corridor' });
  const svg = renderAerialTensionSvg(data);

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('class="aerial-svg"'));
  assert.ok(svg.includes('Pole A'));
  assert.ok(svg.includes('Pole B'));
  assert.ok(svg.includes('Req. Clearance'));
  assert.ok(svg.includes('Sag:'));
  assert.ok(svg.includes('Clearance:'));
  assert.ok(svg.includes('WIND:'));

  // Test empty/null state
  const emptySvg = renderAerialTensionSvg(null);
  assert.ok(emptySvg.includes('chart-empty-state'));
});

test('generateAerialTensionReport formats complete executive OSP engineering briefing', () => {
  const state = createInitialState(['Test User']);
  state.customers[0].area = 'Vandala Road';
  state.customers[0].monthlyRate = 2200;

  const data = calculateAerialTensionMetrics(state, { sectorId: 'wandala-corridor' });
  const report = generateAerialTensionReport(data, new Date('2026-10-16T12:00:00+05:00'));

  assert.ok(report.includes('SHAHDARA ISP OSP ENGINEERING BRIEFING: AERIAL POLE TENSION'));
  assert.ok(report.includes('1. PRIMARY MONITORED SECTOR:'));
  assert.ok(report.includes('WANDALA ROAD OPTICAL SPINE'));
  assert.ok(report.includes('2. MECHANICAL STRESS & CATENARY METRICS'));
  assert.ok(report.includes('3. SUBSCRIBER & REVENUE IMPACT'));
  assert.ok(report.includes('4. SHAHDARA SECTORS MECHANICAL AUDIT REGISTER'));
  assert.ok(report.includes('5. RECOMMENDED FIELD REMEDIATION ACTIONS'));

  assert.equal(generateAerialTensionReport(null), 'No aerial tension data available.');
});

test('setupAerialTensionModal wires modal controls, sliders, sector selection, area filter, and clipboard export', async () => {
  let modalOpened = false;
  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  const mockModal = {
    dataset: {},
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  let openHandler = null;
  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') openHandler = fn; }
  };

  let closeHandler = null;
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') closeHandler = fn; }
  };

  let copyHandler = null;
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') copyHandler = fn; }
  };

  let filterAreaHandler = null;
  const mockFilterAreaBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') filterAreaHandler = fn; }
  };

  let sectorChangeHandler = null;
  const mockSectorSelect = {
    dataset: {},
    children: [],
    innerHTML: '',
    value: 'wandala-corridor',
    addEventListener: (evt, fn) => { if (evt === 'change') sectorChangeHandler = fn; }
  };

  let cableChangeHandler = null;
  const mockCableSelect = {
    dataset: {},
    children: [],
    innerHTML: '',
    value: 'default',
    addEventListener: (evt, fn) => { if (evt === 'change') cableChangeHandler = fn; }
  };

  let windInputHandler = null;
  const mockWindSlider = {
    dataset: {},
    value: '35',
    addEventListener: (evt, fn) => { if (evt === 'input') windInputHandler = fn; }
  };
  const mockWindVal = { textContent: '' };

  let tempInputHandler = null;
  const mockTempSlider = {
    dataset: {},
    value: '25',
    addEventListener: (evt, fn) => { if (evt === 'input') tempInputHandler = fn; }
  };
  const mockTempVal = { textContent: '' };

  let resetClickHandler = null;
  const mockResetBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') resetClickHandler = fn; }
  };

  const mockSectorNameEl = { textContent: '' };
  const mockSagClearanceEl = { textContent: '' };
  const mockTensionUtsEl = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockRevenueRiskEl = { textContent: '' };
  const mockModalChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardAerialModal') return mockModal;
      if (id === 'dashboardOpenAerialModalBtn') return mockOpenBtn;
      if (id === 'dashboardAerialModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyAerialReportBtn') return mockCopyBtn;
      if (id === 'aerialFilterAreaBtn') return mockFilterAreaBtn;
      if (id === 'aerialSectorSelect') return mockSectorSelect;
      if (id === 'aerialCableSelect') return mockCableSelect;
      if (id === 'aerialWindSlider') return mockWindSlider;
      if (id === 'aerialWindVal') return mockWindVal;
      if (id === 'aerialTempSlider') return mockTempSlider;
      if (id === 'aerialTempVal') return mockTempVal;
      if (id === 'aerialResetSimBtn') return mockResetBtn;
      if (id === 'aerialKpiSectorName') return mockSectorNameEl;
      if (id === 'aerialKpiSagClearance') return mockSagClearanceEl;
      if (id === 'aerialKpiTensionUts') return mockTensionUtsEl;
      if (id === 'aerialStatusBadge') return mockStatusBadge;
      if (id === 'aerialKpiRevenueRisk') return mockRevenueRiskEl;
      if (id === 'aerialModalChartWrap') return mockModalChartWrap;
      if (id === 'aerialSectorsTableBody') return mockTableBody;
      return null;
    }
  };

  let state = createInitialState(['Customer 1']);
  state.customers[0].area = 'Vandala Road';

  try {
    setupAerialTensionModal(state, {
      referenceDate: new Date('2026-10-16T12:00:00+05:00'),
      onFilterArea: (a) => { filterAreaCalledWith = a; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: { writeText: async (t) => { copiedText = t; } }
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    // Verify UI populated
    assert.ok(mockSectorSelect.innerHTML.includes('Wandala Road'));
    assert.ok(mockModalChartWrap.innerHTML.includes('aerial-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Wandala Road Optical Spine'));

    // Test sector change
    assert.ok(sectorChangeHandler !== null);
    mockSectorSelect.value = 'jia-musa-bazaar';
    sectorChangeHandler();
    assert.equal(getAerialSelectedSector(), 'jia-musa-bazaar');

    // Test wind slider
    assert.ok(windInputHandler !== null);
    mockWindSlider.value = '55';
    windInputHandler();
    assert.equal(getAerialWindSpeed(), 55);
    assert.equal(mockWindVal.textContent, '55 km/h');

    // Test temp slider
    assert.ok(tempInputHandler !== null);
    mockTempSlider.value = '40';
    tempInputHandler();
    assert.equal(getAerialTemperature(), 40);
    assert.equal(mockTempVal.textContent, '40°C');

    // Test cable change
    assert.ok(cableChangeHandler !== null);
    mockCableSelect.value = 'adss-48c';
    cableChangeHandler();
    assert.equal(getAerialCableType(), 'adss-48c');

    // Test reset
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getAerialWindSpeed(), 35);
    assert.equal(getAerialTemperature(), 25);
    assert.equal(getAerialCableType(), null);

    // Test filter area action
    assert.ok(filterAreaHandler !== null);
    filterAreaHandler();
    assert.ok(filterAreaCalledWith !== null);
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyHandler !== null);
    await copyHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA ISP OSP ENGINEERING BRIEFING: AERIAL POLE TENSION'));
    assert.equal(toastMessage, 'Aerial pole tension audit copied to clipboard!');

    // Test close
    assert.ok(closeHandler !== null);
    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateMicrowaveLinkBudget calculates clear-sky FSPL, RSL, and fade margin correctly', () => {
  const state = createInitialState([]);
  const data = calculateMicrowaveLinkBudget(state, {
    linkId: 'station-to-vandala',
    rainRate: 0,
    frequencyGhz: 24.0
  });

  assert.equal(data.link.id, 'station-to-vandala');
  assert.equal(data.inputs.rainRateMmH, 0);
  assert.ok(data.budget.fsplDb > 100); // 3.8 km at 24 GHz FSPL ~ 131 dB
  assert.equal(data.budget.totalRainAttenuationDb, 0);
  // With 20 dBm Tx + 33 + 33 dBi antenna - 2 dB cable - 131.6 dB FSPL - 0.7 dB gas ~ -48 dBm
  assert.ok(data.budget.clearSkyRslDbm > -65 && data.budget.clearSkyRslDbm < -40);
  assert.ok(data.budget.actualFadeMarginDb > 15);
  assert.equal(data.risk.statusTier, 'optimal');
  assert.equal(data.budget.modulationEfficiencyPercent, 100);
  assert.equal(data.budget.effectiveThroughputMbps, 1024);
  assert.ok(data.fleetSummary.length >= 5);
});

test('calculateMicrowaveLinkBudget models severe monsoon rain fade and modulation degradation', () => {
  const state = createInitialState([]);
  // High monsoon downpour 80 mm/h on 24 GHz link
  const data = calculateMicrowaveLinkBudget(state, {
    linkId: 'station-to-vandala',
    rainRate: 80,
    frequencyGhz: 24.0
  });

  assert.ok(data.budget.totalRainAttenuationDb > 15); // Severe rain fade at 24GHz
  assert.ok(data.budget.actualRslDbm < data.budget.clearSkyRslDbm);
  // Fade margin should drop significantly
  assert.ok(data.budget.actualFadeMarginDb < data.budget.clearSkyFadeMarginDb);
  assert.ok(data.risk.statusTier === 'warning' || data.risk.statusTier === 'critical');
  assert.ok(data.budget.effectiveThroughputMbps < 1024);
});

test('calculateMicrowaveLinkBudget detects complete outage when rain attenuation breaches disconnect threshold', () => {
  const state = createInitialState([]);
  // Extreme cloudburst (140 mm/h) on 60 GHz V-Band (high oxygen and severe rain fade)
  const data = calculateMicrowaveLinkBudget(state, {
    linkId: 'jia-musa-micro-pop',
    rainRate: 140,
    frequencyGhz: 60.0
  });

  assert.equal(data.risk.statusTier, 'critical');
  assert.ok(data.risk.statusLabel.includes('OUTAGE') || data.risk.statusLabel.includes('DEGRADATION'));
  assert.ok(data.budget.actualRslDbm <= data.link.sensitivityThresholdDbm);
});

test('calculateMicrowaveLinkBudget aggregates linked subscribers and monthly revenue at risk from ledger', () => {
  let state = createInitialState(['Subscriber One', 'Subscriber Two']);
  state.customers[0].area = 'Vandala Road';
  state.customers[0].serviceStatus = 'active';
  state.customers[0].monthlyRate = 2200;

  state.customers[1].area = 'Zia Town';
  state.customers[1].serviceStatus = 'offline';
  state.customers[1].monthlyRate = 1800;

  const data = calculateMicrowaveLinkBudget(state, {
    linkId: 'station-to-vandala'
  });

  assert.equal(data.ledger.totalAreaCustomers, 2);
  assert.equal(data.ledger.activeSubscribers, 1);
  assert.equal(data.ledger.offlineSubscribers, 1);
  assert.equal(data.ledger.totalMonthlyBilledPkr, 4000);
  assert.ok(data.ledger.revenueAtRiskPkr > 0);
});

test('renderMicrowaveLinkSvg produces clean SVG markup with towers, Fresnel beam, and RSSI metrics', () => {
  const state = createInitialState([]);
  const data = calculateMicrowaveLinkBudget(state, { linkId: 'station-to-vandala', rainRate: 25 });
  const svg = renderMicrowaveLinkSvg(data);

  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('class="microwave-svg"'));
  assert.ok(svg.includes('Tx Tower'));
  assert.ok(svg.includes('Rx Tower'));
  assert.ok(svg.includes('Fresnel R1:'));
  assert.ok(svg.includes('PRECIPITATION:'));
  assert.ok(svg.includes('dBm'));

  // Test empty/null state
  const emptySvg = renderMicrowaveLinkSvg(null);
  assert.ok(emptySvg.includes('chart-empty-state'));
});

test('generateMicrowaveBriefingReport formats comprehensive executive RF audit briefing', () => {
  const state = createInitialState(['User Alpha']);
  state.customers[0].area = 'Vandala Road';
  state.customers[0].monthlyRate = 2500;

  const data = calculateMicrowaveLinkBudget(state, { linkId: 'station-to-vandala' });
  const report = generateMicrowaveBriefingReport(data, new Date('2026-10-16T12:00:00+05:00'));

  assert.ok(report.includes('SHAHDARA ISP RF ENGINEERING BRIEFING: MICROWAVE RAIN FADE AUDIT'));
  assert.ok(report.includes('1. MONITORED PT-TO-PT BACKHAUL:'));
  assert.ok(report.includes('2. RF LINK BUDGET & ITU-R P.838 ATTENUATION'));
  assert.ok(report.includes('3. SUBSCRIBER & REVENUE IMPACT'));
  assert.ok(report.includes('4. SHAHDARA WIRELESS FLEET LINK BUDGET REGISTER'));
  assert.ok(report.includes('5. RECOMMENDED MONSOON MITIGATION ACTIONS'));

  assert.equal(generateMicrowaveBriefingReport(null), 'No microwave link budget data available.');
});

test('setupMicrowaveModal wires modal controls, sliders, frequency override, and clipboard export', async () => {
  let modalOpened = false;
  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  const mockModal = {
    dataset: {},
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  let openHandler = null;
  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') openHandler = fn; }
  };

  let closeHandler = null;
  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') closeHandler = fn; }
  };

  let copyHandler = null;
  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') copyHandler = fn; }
  };

  let filterAreaHandler = null;
  const mockFilterAreaBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') filterAreaHandler = fn; }
  };

  let linkChangeHandler = null;
  const mockLinkSelect = {
    dataset: {},
    children: [],
    innerHTML: '',
    value: 'station-to-vandala',
    addEventListener: (evt, fn) => { if (evt === 'change') linkChangeHandler = fn; }
  };

  let freqChangeHandler = null;
  const mockFreqSelect = {
    dataset: {},
    value: 'default',
    addEventListener: (evt, fn) => { if (evt === 'change') freqChangeHandler = fn; }
  };

  let rainInputHandler = null;
  const mockRainSlider = {
    dataset: {},
    value: '15',
    addEventListener: (evt, fn) => { if (evt === 'input') rainInputHandler = fn; }
  };
  const mockRainVal = { textContent: '' };

  let resetClickHandler = null;
  const mockResetBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') resetClickHandler = fn; }
  };

  const mockLinkNameEl = { textContent: '' };
  const mockRslMarginEl = { textContent: '' };
  const mockRainFadeEl = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockRevenueRiskEl = { textContent: '' };
  const mockModalChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'dashboardMicrowaveModal') return mockModal;
      if (id === 'dashboardOpenMicrowaveModalBtn') return mockOpenBtn;
      if (id === 'dashboardMicrowaveModalCloseBtn') return mockCloseBtn;
      if (id === 'dashboardCopyMicrowaveReportBtn') return mockCopyBtn;
      if (id === 'microwaveFilterAreaBtn') return mockFilterAreaBtn;
      if (id === 'microwaveLinkSelect') return mockLinkSelect;
      if (id === 'microwaveFreqSelect') return mockFreqSelect;
      if (id === 'microwaveRainSlider') return mockRainSlider;
      if (id === 'microwaveRainVal') return mockRainVal;
      if (id === 'microwaveResetSimBtn') return mockResetBtn;
      if (id === 'microwaveKpiLinkName') return mockLinkNameEl;
      if (id === 'microwaveKpiRslMargin') return mockRslMarginEl;
      if (id === 'microwaveKpiRainFade') return mockRainFadeEl;
      if (id === 'microwaveStatusBadge') return mockStatusBadge;
      if (id === 'microwaveKpiRevenueRisk') return mockRevenueRiskEl;
      if (id === 'microwaveModalChartWrap') return mockModalChartWrap;
      if (id === 'microwaveLinksTableBody') return mockTableBody;
      return null;
    }
  };

  let state = createInitialState(['Customer 1']);
  state.customers[0].area = 'Vandala Road';

  try {
    setupMicrowaveModal(state, {
      referenceDate: new Date('2026-10-16T12:00:00+05:00'),
      onFilterArea: (a) => { filterAreaCalledWith = a; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: { writeText: async (t) => { copiedText = t; } }
    });

    assert.ok(openHandler !== null);
    openHandler();
    assert.equal(modalOpened, true);

    // Verify UI populated
    assert.ok(mockLinkSelect.innerHTML.includes('Central Station POP'));
    assert.ok(mockModalChartWrap.innerHTML.includes('microwave-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Central Station POP to Vandala'));

    // Test link change
    assert.ok(linkChangeHandler !== null);
    mockLinkSelect.value = 'station-to-saeed-park';
    linkChangeHandler();
    assert.equal(getMicrowaveSelectedLink(), 'station-to-saeed-park');

    // Test rain slider
    assert.ok(rainInputHandler !== null);
    mockRainSlider.value = '45';
    rainInputHandler();
    assert.equal(getMicrowaveRainRate(), 45);
    assert.equal(mockRainVal.textContent, '45 mm/h');

    // Test frequency change
    assert.ok(freqChangeHandler !== null);
    mockFreqSelect.value = '11.0';
    freqChangeHandler();
    assert.equal(getMicrowaveFrequencyOverride(), 11.0);

    // Test reset
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getMicrowaveRainRate(), 15);
    assert.equal(getMicrowaveFrequencyOverride(), null);

    // Test filter area action
    assert.ok(filterAreaHandler !== null);
    filterAreaHandler();
    assert.ok(filterAreaCalledWith !== null);
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyHandler !== null);
    await copyHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA ISP RF ENGINEERING BRIEFING: MICROWAVE RAIN FADE'));
    assert.equal(toastMessage, 'Microwave rain fade briefing copied to clipboard!');

    // Test close
    assert.ok(closeHandler !== null);
    closeHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateBendAttenuation accurately calculates macro-bend attenuation differential for G.652.D and G.657.A1', () => {
  // G.652.D standard single-mode with compliant radius (30mm)
  const g652Compliant = calculateBendAttenuation({
    fiberStandardKey: 'g652d',
    bendRadiusMm: 30,
    trayUtilizationPct: 70
  });
  assert.equal(g652Compliant.criticalRadiusMm, 30);
  assert.equal(g652Compliant.isBendInsensitive, false);
  assert.ok(g652Compliant.totalLoss1550Db < 0.1);
  assert.equal(g652Compliant.crowdPenaltyDb, 0);

  // G.652.D with acute bend radius (18mm) - significant macro-bending
  const g652Acute = calculateBendAttenuation({
    fiberStandardKey: 'g652d',
    bendRadiusMm: 18,
    trayUtilizationPct: 95
  });
  assert.ok(g652Acute.bendLoss1550Db > 1.0);
  assert.ok(g652Acute.totalLoss1550Db > g652Acute.totalLoss1310Db);
  assert.ok(g652Acute.differentialDeltaDb > 0.5);
  assert.ok(g652Acute.crowdPenaltyDb > 0); // utilization > 80%

  // G.657.A1 bend-insensitive fiber with 20mm radius (compliant since critical is 15mm)
  const g657Compliant = calculateBendAttenuation({
    fiberStandardKey: 'g657a1',
    bendRadiusMm: 20,
    trayUtilizationPct: 75
  });
  assert.equal(g657Compliant.criticalRadiusMm, 15);
  assert.equal(g657Compliant.isBendInsensitive, true);
  assert.ok(g657Compliant.totalLoss1550Db < 0.08);

  // G.657.A1 below critical radius (10mm)
  const g657Acute = calculateBendAttenuation({
    fiberStandardKey: 'g657a1',
    bendRadiusMm: 10,
    trayUtilizationPct: 75
  });
  assert.ok(g657Acute.bendLoss1550Db > 0.2);
});

test('calculateSpliceClosureMetrics aggregates fleet capacity, identifies overcrowded trays and links area subscribers', () => {
  let state = createInitialState(['User MB 1', 'User MB 2', 'User BD 1']);
  state.customers[0].area = 'Main Bazaar';
  state.customers[0].serviceStatus = 'active';
  state.customers[0].bills = [{ month: '2026-10', amount: 2500 }];

  state.customers[1].area = 'Main Bazaar';
  state.customers[1].serviceStatus = 'offline';
  state.customers[1].bills = [{ month: '2026-10', amount: 3000 }];

  state.customers[2].area = 'Baradari Road';
  state.customers[2].serviceStatus = 'active';
  state.customers[2].bills = [{ month: '2026-10', amount: 1800 }];

  const res = calculateSpliceClosureMetrics(state, {
    closureId: 'fosc-mb-02',
    referenceDate: '2026-10-15'
  });

  assert.equal(res.selectedClosure.id, 'fosc-mb-02');
  assert.equal(res.evaluation.installedCapacity, 96);
  assert.equal(res.evaluation.trayUtilizationPct, 94.8); // 91 / 96
  assert.equal(res.evaluation.statusTier, 'CRITICAL');
  assert.equal(res.evaluation.areaCustomersCount, 2);
  assert.equal(res.evaluation.activeSubscribers, 1);
  assert.equal(res.evaluation.offlineSubscribers, 1);
  assert.equal(res.evaluation.monthlyRevenue, 5500);
  assert.equal(res.evaluation.revenueAtRisk, 5500); // 100% at risk for critical

  // Fleet checks
  assert.equal(res.fleet.totalClosures, SHAHDARA_SPLICE_CLOSURES.length);
  assert.ok(res.fleet.totalSplices > 300);
  assert.ok(res.fleet.totalCapacity > 400);
  assert.ok(res.fleet.criticalCount >= 1);
  assert.ok(res.fleet.optimalCount >= 1);
});

test('calculateSpliceClosureMetrics supports bend radius simulation and added expansion trays', () => {
  const state = createInitialState([]);

  // Simulation with added trays on fosc-mb-02
  const resWithTrays = calculateSpliceClosureMetrics(state, {
    closureId: 'fosc-mb-02',
    addedTrays: 1, // fosc-mb-02 maxTrays is 4, traysInstalled is 4, so it stays capped at 4
    bendRadiusOverride: 35
  });

  assert.equal(resWithTrays.evaluation.radius, 35);
  // With 35mm radius on G.652.D, bend loss is minimized
  assert.ok(resWithTrays.evaluation.optLoss.bendLoss1550Db < 0.05);

  // Simulation on fosc-bd-01 (maxTrays is 6, traysInstalled is 4, so +1 tray expands capacity to 5*24 = 120)
  const resExpand = calculateSpliceClosureMetrics(state, {
    closureId: 'fosc-bd-01',
    addedTrays: 1
  });
  assert.equal(resExpand.evaluation.installedTrays, 5);
  assert.equal(resExpand.evaluation.installedCapacity, 120);
  assert.equal(resExpand.evaluation.freeTraySlots, 1);
  assert.ok(resExpand.evaluation.spareSleeves >= 38);
});

test('renderSpliceClosureSvg generates accessible, theme-aware pure SVG with trays and wavelength loss', () => {
  const state = createInitialState([]);
  const metrics = calculateSpliceClosureMetrics(state, { closureId: 'fosc-mb-02' });

  const svg = renderSpliceClosureSvg(metrics);
  assert.ok(svg.includes('<svg class="chart-svg splice-closure-svg"'));
  assert.ok(svg.includes('splice-tray-row'));
  assert.ok(svg.includes('Tray 1'));
  assert.ok(svg.includes('Tray Bend Radius:'));
  assert.ok(svg.includes('1310 nm (Upstream)'));
  assert.ok(svg.includes('1550 nm (Downstream / High Bend Drag)'));
  assert.ok(svg.includes('Loss (1550 - 1310):'));

  // Test empty state fallback
  const emptySvg = renderSpliceClosureSvg(null);
  assert.ok(emptySvg.includes('No splice closure metrics available'));
});

test('generateSpliceClosureReport produces structured field engineering briefing with actionable recommendations', () => {
  const state = createInitialState(['Cust 1']);
  state.customers[0].area = 'Main Bazaar';
  state.customers[0].bills = [{ month: '2026-10', amount: 2000 }];

  const metrics = calculateSpliceClosureMetrics(state, { closureId: 'fosc-mb-02', referenceDate: '2026-10-16' });
  const report = generateSpliceClosureReport(metrics, '2026-10-16');

  assert.ok(report.includes('SHAHDARA FTTH AERIAL SPLICE CLOSURE & MICRO-BEND LOSS AUDIT REPORT'));
  assert.ok(report.includes('TARGET CLOSURE & PHYSICAL SPECIFICATION:'));
  assert.ok(report.includes('[fosc-mb-02] Main Bazaar Commercial Hub Inline Enclosure'));
  assert.ok(report.includes('SPLICE TRAY CAPACITY & FILL METRICS:'));
  assert.ok(report.includes('OPTICAL MICRO-BEND & MACRO-BEND ATTENUATION (dB):'));
  assert.ok(report.includes('CUSTOMER ROSTER & REVENUE EXPOSURE:'));
  assert.ok(report.includes('SHAHDARA CLOSURE FLEET OVERVIEW:'));
  assert.ok(report.includes('RECOMMENDED FIELD REMEDIATION ACTIONS:'));
});

test('setupSpliceClosureModal wires open, close, select change, slider input, add tray, reset, filter, and copy actions', async () => {
  const originalDocument = globalThis.document;

  let modalOpened = false;
  let toastMessage = null;
  let copiedText = null;
  let filterAreaCalledWith = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: (attr) => { if (attr === 'open') modalOpened = true; },
    removeAttribute: (attr) => { if (attr === 'open') modalOpened = false; },
    addEventListener: () => {},
    dataset: {}
  };

  let openClickHandler = null;
  const mockOpenBtn = {
    addEventListener: (type, fn) => { if (type === 'click') openClickHandler = fn; },
    dataset: {}
  };

  let closeClickHandler = null;
  const mockCloseBtn = {
    addEventListener: (type, fn) => { if (type === 'click') closeClickHandler = fn; },
    dataset: {}
  };

  let selectChangeHandler = null;
  const mockSelect = {
    value: 'fosc-mb-02',
    children: [],
    appendChild: function(c) { this.children.push(c); },
    addEventListener: (type, fn) => { if (type === 'change') selectChangeHandler = fn; },
    dataset: {}
  };

  let sliderInputHandler = null;
  const mockSlider = {
    value: '22',
    addEventListener: (type, fn) => { if (type === 'input') sliderInputHandler = fn; },
    dataset: {}
  };

  const mockBendVal = { textContent: '22 mm' };

  let addTrayClickHandler = null;
  const mockAddTrayBtn = {
    textContent: '+ Add Expansion Tray',
    addEventListener: (type, fn) => { if (type === 'click') addTrayClickHandler = fn; },
    dataset: {}
  };

  let resetClickHandler = null;
  const mockResetBtn = {
    addEventListener: (type, fn) => { if (type === 'click') resetClickHandler = fn; },
    dataset: {}
  };

  let filterAreaClickHandler = null;
  const mockFilterAreaBtn = {
    addEventListener: (type, fn) => { if (type === 'click') filterAreaClickHandler = fn; },
    dataset: {}
  };

  let copyClickHandler = null;
  const mockCopyBtn = {
    addEventListener: (type, fn) => { if (type === 'click') copyClickHandler = fn; },
    dataset: {}
  };

  const mockKpiName = { textContent: '' };
  const mockKpiTray = { textContent: '' };
  const mockKpiLoss = { textContent: '' };
  const mockKpiBadge = { textContent: '', className: '' };
  const mockKpiRisk = { textContent: '' };
  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = {
    innerHTML: '',
    querySelectorAll: () => []
  };

  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'dashboardSpliceModal': return mockModal;
        case 'dashboardOpenSpliceModalBtn': return mockOpenBtn;
        case 'dashboardSpliceModalCloseBtn': return mockCloseBtn;
        case 'spliceClosureSelect': return mockSelect;
        case 'spliceBendSlider': return mockSlider;
        case 'spliceBendVal': return mockBendVal;
        case 'spliceAddTrayBtn': return mockAddTrayBtn;
        case 'spliceResetSimBtn': return mockResetBtn;
        case 'spliceFilterAreaBtn': return mockFilterAreaBtn;
        case 'dashboardCopySpliceReportBtn': return mockCopyBtn;
        case 'spliceKpiClosureName': return mockKpiName;
        case 'spliceKpiTrayCapacity': return mockKpiTray;
        case 'spliceKpiOpticalLoss': return mockKpiLoss;
        case 'spliceStatusBadge': return mockKpiBadge;
        case 'spliceKpiRevenueRisk': return mockKpiRisk;
        case 'spliceModalChartWrap': return mockChartWrap;
        case 'spliceClosuresTableBody': return mockTableBody;
        default: return null;
      }
    },
    createElement: (tag) => ({ tag, value: '', textContent: '', selected: false })
  };

  const state = createInitialState([]);

  try {
    setupSpliceClosureModal(state, {
      referenceDate: '2026-10-16',
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    // Check options populated
    assert.equal(mockSelect.children.length, SHAHDARA_SPLICE_CLOSURES.length);

    // Test open
    assert.ok(openClickHandler !== null);
    openClickHandler();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiName.textContent.includes('Main Bazaar'));
    assert.ok(mockChartWrap.innerHTML.includes('splice-closure-svg'));

    // Test slider input
    assert.ok(sliderInputHandler !== null);
    mockSlider.value = '35';
    sliderInputHandler();
    assert.equal(getSpliceBendRadius(), 35);
    assert.equal(mockBendVal.textContent, '35 mm');

    // Test add tray simulation
    assert.ok(addTrayClickHandler !== null);
    addTrayClickHandler();
    assert.equal(getSpliceAddedTrays(), 1);
    assert.equal(mockAddTrayBtn.textContent, '+1 Trays Added');

    // Test reset
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getSpliceBendRadius(), null);
    assert.equal(getSpliceAddedTrays(), 0);
    assert.equal(mockAddTrayBtn.textContent, '+ Add Expansion Tray');

    // Test filter area action
    assert.ok(filterAreaClickHandler !== null);
    filterAreaClickHandler();
    assert.equal(filterAreaCalledWith, 'Main Bazaar');
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyClickHandler !== null);
    await copyClickHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA FTTH AERIAL SPLICE CLOSURE & MICRO-BEND LOSS AUDIT REPORT'));
    assert.equal(toastMessage, 'Splice closure audit report copied to clipboard!');

    // Test close
    assert.ok(closeClickHandler !== null);
    closeClickHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});
