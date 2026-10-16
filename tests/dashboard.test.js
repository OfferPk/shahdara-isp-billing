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
  renderSpliceClosureSvg,
  SHAHDARA_JETTING_ROUTES,
  calculateDuctClearance,
  calculateBlowingDynamics,
  calculateDuctJettingMetrics,
  generateDuctJettingReport,
  setupDuctJettingModal,
  getJettingSelectedRoute,
  setJettingSelectedRoute,
  getJettingPressure,
  setJettingPressure,
  getJettingFriction,
  setJettingFriction,
  renderDuctJettingSvg,
  SHAHDARA_PON_PORTS,
  getPonDbaSelectedPort,
  setPonDbaSelectedPort,
  getPonDbaMode,
  setPonDbaMode,
  getPonDbaConcurrency,
  setPonDbaConcurrency,
  getPonDbaCyclePeriod,
  setPonDbaCyclePeriod,
  calculateOpticalPropagationDelay,
  calculateDbaQueueDynamics,
  calculatePonDbaMetrics,
  renderPonDbaQueueSvg,
  generatePonDbaReport,
  setupPonDbaModal,
  SHAHDARA_SPLICER_UNITS,
  getSplicerSelectedUnit,
  setSplicerSelectedUnit,
  getSplicerArcCount,
  setSplicerArcCount,
  getSplicerCleaveAngle,
  setSplicerCleaveAngle,
  getSplicerCalibCurrent,
  setSplicerCalibCurrent,
  calculateElectrodeDynamics,
  calculateFusionSplicerMetrics,
  renderFusionSplicerSvg,
  generateFusionSplicerReport,
  setupFusionSplicerModal,
  SHAHDARA_BGP_PEERS,
  BGP_CONSTANTS,
  getBgpSelectedPeer,
  setBgpSelectedPeer,
  getBgpFlapCount,
  setBgpFlapCount,
  getBgpSuppressThreshold,
  setBgpSuppressThreshold,
  resetBgpSimState,
  calculateBgpFlapPenalty,
  calculateRouteConvergenceTime,
  calculateBgpPeeringMetrics,
  renderBgpRoutingConvergenceSvg,
  generateBgpRoutingReport,
  setupBgpRoutingModal,
  SHAHDARA_IPTV_CHANNELS,
  IPTV_CONSTANTS,
  getIptvSelectedChannel,
  setIptvSelectedChannel,
  getIptvFastLeaveEnabled,
  setIptvFastLeaveEnabled,
  getIptvGopSizeSec,
  setIptvGopSizeSec,
  getIptvFccAssist,
  setIptvFccAssist,
  resetIptvSimState,
  calculateZappingLatency,
  calculateIptvMulticastMetrics,
  renderIptvMulticastSvg,
  generateIptvMulticastReport,
  setupIptvMulticastModal,
  SHAHDARA_DNS_RESOLVERS,
  UPSTREAM_FORWARDERS,
  DNS_CONSTANTS,
  getDnsSelectedResolver,
  setDnsSelectedResolver,
  getDnsCacheHitRatio,
  setDnsCacheHitRatio,
  getDnsUpstreamForwarder,
  setDnsUpstreamForwarder,
  getDnssecMode,
  setDnssecMode,
  getDnsClockDriftMs,
  setDnsClockDriftMs,
  resetDnsSimState,
  calculateDnsLatency,
  calculateDnssecValidation,
  calculateDnsMetrics,
  renderDnsDiagnosticsSvg,
  generateDnsDiagnosticReport,
  setupDnsDiagnosticsModal,
  SHAHDARA_DWDM_CHANNELS,
  DWDM_CONSTANTS,
  getDwdmSelectedChannel,
  setDwdmSelectedChannel,
  getDwdmFiberLossCoeff,
  setDwdmFiberLossCoeff,
  getDwdmEdfaNoiseFigure,
  setDwdmEdfaNoiseFigure,
  getDwdmSpanCount,
  setDwdmSpanCount,
  resetDwdmSimState,
  calculateOsnrBudget,
  calculateDwdmMetrics,
  renderDwdmBudgetSvg,
  generateDwdmReport,
  setupDwdmModal,
  SHAHDARA_OSC_LINKS,
  OSC_CONSTANTS,
  getOscSelectedLink,
  setOscSelectedLink,
  getOscFiberLossDelta,
  setOscFiberLossDelta,
  getOscSpliceLossDelta,
  setOscSpliceLossDelta,
  getOscLoopbackMode,
  setOscLoopbackMode,
  resetOscSimState,
  calculateOpticalRttMicroseconds,
  calculateOscLinkBudget,
  calculateOscMetrics,
  renderOscTelemetrySvg,
  generateOscReport,
  setupOscModal,
  SHAHDARA_QINQ_TRUNKS,
  QINQ_CONSTANTS,
  getQinqSelectedTrunk,
  setQinqSelectedTrunk,
  getQinqTrafficSurgeGbps,
  setQinqTrafficSurgeGbps,
  getQinqFailedMembersCount,
  setQinqFailedMembersCount,
  getQinqHashAlgorithm,
  setQinqHashAlgorithm,
  resetQinqSimState,
  calculateTrunkLacpMetrics,
  calculateQinqMetrics,
  renderQinqTrunkSvg,
  generateQinqReport,
  setupQinqModal,
  SHAHDARA_SYNCE_NODES,
  SYNCE_CONSTANTS,
  getSyncESelectedNode,
  setSyncESelectedNode,
  getSyncEHoldoverHours,
  setSyncEHoldoverHours,
  getSyncEJitterSurgeUs,
  setSyncEJitterSurgeUs,
  getSyncEGnssLossInjected,
  setSyncEGnssLossInjected,
  getSyncESelectedProfile,
  setSyncESelectedProfile,
  resetSyncESimState,
  calculateOscillatorHoldoverDrift,
  calculateNodeSyncMetrics,
  calculateSyncEMetrics,
  renderSyncEClockSvg,
  generateSyncEReport,
  setupSyncEModal,
  SHAHDARA_ROADM_NODES,
  SHAHDARA_WAVELENGTH_CHANNELS,
  ROADM_CONSTANTS,
  getRoadmSelectedNode,
  setRoadmSelectedNode,
  getRoadmSelectedChannel,
  setRoadmSelectedChannel,
  getRoadmSpanCondition,
  setRoadmSpanCondition,
  getRoadmSwitchingMode,
  setRoadmSwitchingMode,
  getRoadmVoaAttenuationDb,
  setRoadmVoaAttenuationDb,
  resetRoadmSimState,
  calculateChannelOpticalLoss,
  calculateRoadmMetrics,
  renderRoadmOpticalSvg,
  generateRoadmReport,
  setupRoadmModal,
  MICRO_OTDR_CONSTANTS,
  SHAHDARA_MICRO_OTDR_PORTS,
  getMicroOtdrPortId,
  setMicroOtdrPortId,
  getMicroOtdrWavelength,
  setMicroOtdrWavelength,
  getMicroOtdrPulseWidth,
  setMicroOtdrPulseWidth,
  getMicroOtdrFaultPreset,
  setMicroOtdrFaultPreset,
  getMicroOtdrThresholdDbm,
  setMicroOtdrThresholdDbm,
  resetMicroOtdrSimState,
  calculateFiberPropagationDelay,
  calculateEventSignatures,
  calculateMicroOtdrMetrics,
  renderMicroOtdrTraceSvg,
  generateMicroOtdrReport,
  setupMicroOtdrModal,
  MCLAG_CONSTANTS,
  SHAHDARA_MCLAG_TRUNKS,
  getMclagSelectedTrunk,
  setMclagSelectedTrunk,
  getMclagSelectedRole,
  setMclagSelectedRole,
  getMclagFailureScenario,
  setMclagFailureScenario,
  getMclagTrafficLoadGbps,
  setMclagTrafficLoadGbps,
  getMclagIccpIntervalMs,
  setMclagIccpIntervalMs,
  resetMclagSimState,
  calculateTrunkForwardingDynamics,
  calculateMclagMetrics,
  renderMclagDiagramSvg,
  generateMclagReport,
  setupMclagModal,
  FLOWSPEC_CONSTANTS,
  SHAHDARA_FLOWSPEC_GATEWAYS,
  SHAHDARA_FLOWSPEC_RULES,
  getFlowspecSelectedGateway,
  setFlowspecSelectedGateway,
  getFlowspecSelectedRule,
  setFlowspecSelectedRule,
  getFlowspecAttackVector,
  setFlowspecAttackVector,
  getFlowspecAttackVolumeGbps,
  setFlowspecAttackVolumeGbps,
  getFlowspecScrubCapacityGbps,
  setFlowspecScrubCapacityGbps,
  resetFlowspecSimState,
  calculateFlowspecMitigation,
  calculateFlowspecMetrics,
  renderFlowspecDiagramSvg,
  generateFlowspecReport,
  setupFlowspecModal,
  RAMAN_CONSTANTS,
  SHAHDARA_RAMAN_SPANS,
  getRamanSelectedSpan,
  setRamanSelectedSpan,
  getRamanPumpScheme,
  setRamanPumpScheme,
  getRamanPumpWavelengthNm,
  setRamanPumpWavelengthNm,
  getRamanPumpPowerMw,
  setRamanPumpPowerMw,
  resetRamanSimState,
  calculateRamanDynamics,
  calculateRamanMetrics,
  renderRamanDiagramSvg,
  generateRamanReport,
  setupRamanModal,
  SR_MPLS_CONSTANTS,
  SHAHDARA_SR_LSP_TUNNELS,
  getSrMplsSelectedTunnel,
  setSrMplsSelectedTunnel,
  getSrMplsOptimizationMetric,
  setSrMplsOptimizationMetric,
  getSrMplsPlaneMode,
  setSrMplsPlaneMode,
  getSrMplsInjectedCongestionPct,
  setSrMplsInjectedCongestionPct,
  resetSrMplsSimState,
  calculateSrMplsDynamics,
  calculateSrMplsMetrics,
  renderSrMplsDiagramSvg,
  generateSrMplsReport,
  setupSrMplsModal,
  PMD_CONSTANTS,
  SHAHDARA_PMD_SPANS,
  getPmdSelectedSpan,
  setPmdSelectedSpan,
  getPmdSelectedBitrate,
  setPmdSelectedBitrate,
  getPmdSelectedEnv,
  setPmdSelectedEnv,
  getPmdInducedStrainPct,
  setPmdInducedStrainPct,
  resetPmdSimState,
  calculatePmdDynamics,
  calculatePmdMetrics,
  renderPmdDiagramSvg,
  generatePmdReport,
  setupPmdModal,
  EVPN_CONSTANTS,
  SHAHDARA_EVPN_VNIS,
  getEvpnSelectedVni,
  setEvpnSelectedVni,
  getEvpnSelectedIrbMode,
  setEvpnSelectedIrbMode,
  getEvpnSelectedReplication,
  setEvpnSelectedReplication,
  getEvpnArpSuppression,
  setEvpnArpSuppression,
  getEvpnTrafficSurgePct,
  setEvpnTrafficSurgePct,
  getEvpnUnderlayMtu,
  setEvpnUnderlayMtu,
  resetEvpnSimState,
  calculateEvpnDynamics,
  calculateEvpnMetrics,
  renderEvpnDiagramSvg,
  generateEvpnReport,
  setupEvpnModal,
  KERR_CONSTANTS,
  FIBER_PROFILES,
  SHAHDARA_KERR_LINKS,
  getKerrSelectedLink,
  setKerrSelectedLink,
  getKerrSelectedFiberType,
  setKerrSelectedFiberType,
  getKerrLaunchPowerDbm,
  setKerrLaunchPowerDbm,
  getKerrChannelCount,
  setKerrChannelCount,
  getKerrGridSpacingGhz,
  setKerrGridSpacingGhz,
  resetKerrSimState,
  calculateKerrDynamics,
  calculateKerrMetrics,
  renderKerrDiagramSvg,
  generateKerrReport,
  setupKerrModal,
  MPLS_TE_CONSTANTS,
  SHAHDARA_TE_TUNNELS,
  getMplsTeSelectedTunnel,
  setMplsTeSelectedTunnel,
  getMplsTeFrrMode,
  setMplsTeFrrMode,
  getMplsTeCongestionPct,
  setMplsTeCongestionPct,
  getMplsTeLinkCutInjected,
  setMplsTeLinkCutInjected,
  resetMplsTeSimState,
  calculateMplsTeDynamics,
  calculateMplsTeMetrics,
  renderMplsTeDiagramSvg,
  generateMplsTeReport,
  setupMplsTeModal
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

test('calculateDuctClearance calculates fill ratio, clearance gap and flags choked/loose conditions', () => {
  // Optimal standard clearance (10mm ID duct, 6mm OD cable = 60% fill)
  const opt = calculateDuctClearance({ ductInnerDiaMm: 10, cableOuterDiaMm: 6 });
  assert.equal(opt.fillRatioPct, 60.0);
  assert.equal(opt.clearanceGapMm, 4.0);
  assert.equal(opt.areaRatioPct, 36.0);
  assert.equal(opt.clearanceStatus, 'OPTIMAL');

  // Choked clearance (10mm ID duct, 8.5mm OD cable = 85% fill)
  const choked = calculateDuctClearance({ ductInnerDiaMm: 10, cableOuterDiaMm: 8.5 });
  assert.equal(choked.fillRatioPct, 85.0);
  assert.equal(choked.clearanceStatus, 'CHOKED');

  // Loose clearance (16mm ID duct, 5mm OD cable = 31.3% fill)
  const loose = calculateDuctClearance({ ductInnerDiaMm: 16, cableOuterDiaMm: 5.0 });
  assert.equal(loose.fillRatioPct, 31.3);
  assert.equal(loose.clearanceStatus, 'LOOSE');
});

test('calculateBlowingDynamics models capstan bend drag, Euler buckling limits, and reach horizon', () => {
  const dyn = calculateBlowingDynamics({
    routeLengthM: 650,
    ductInnerDiaMm: 10,
    cableOuterDiaMm: 6.2,
    cableWeightKgM: 0.034,
    cableStiffnessNm2: 0.85,
    compressorPressureBar: 12,
    frictionCoeff: 0.12,
    bendAnglesDegrees: [45, 45, 45, 45],
    pusherThrustN: 20
  });

  assert.ok(dyn.pCritN > 15); // Critical buckling load
  assert.ok(dyn.capstanMultiplier > 1.0); // Euler bend drag multiplier
  assert.ok(dyn.airDragForcePerMeterN > 0.1);
  assert.ok(dyn.maxJettingDistanceM > 500);
  assert.ok(dyn.jettingSpeedMPerMin >= 30);
  assert.ok(dyn.estimatedInstallMinutes > 0);
  assert.ok(dyn.bucklingStatus === 'SAFE' || dyn.bucklingStatus === 'WARNING');
});

test('calculateDuctJettingMetrics aggregates corridor fleet, links area subscribers and calculates revenue at risk', () => {
  let state = createInitialState(['User MB 1', 'User MB 2', 'User ST 1']);
  state.customers[0].area = 'Main Bazaar';
  state.customers[0].serviceStatus = 'active';
  state.customers[0].bills = [{ month: '2026-10', amount: 3500 }];

  state.customers[1].area = 'Main Bazaar';
  state.customers[1].serviceStatus = 'offline';
  state.customers[1].bills = [{ month: '2026-10', amount: 2500 }];

  state.customers[2].area = 'Shahdara Town';
  state.customers[2].serviceStatus = 'active';
  state.customers[2].bills = [{ month: '2026-10', amount: 1500 }];

  const res = calculateDuctJettingMetrics(state, {
    routeId: 'jet-mb-03',
    referenceDate: '2026-10-16'
  });

  assert.equal(res.selectedRoute.id, 'jet-mb-03');
  assert.equal(res.evaluation.route.routeLengthMeters, 420);
  assert.equal(res.evaluation.areaCustomersCount, 2);
  assert.equal(res.evaluation.activeSubscribers, 1);
  assert.equal(res.evaluation.offlineSubscribers, 1);
  assert.equal(res.evaluation.monthlyRevenue, 6000);
  assert.equal(res.evaluation.statusTier, 'CRITICAL'); // high friction 0.28
  assert.equal(res.evaluation.revenueAtRisk, 6000);

  // Fleet checks
  assert.equal(res.fleet.totalRoutes, SHAHDARA_JETTING_ROUTES.length);
  assert.ok(res.fleet.totalMeters > 3000);
  assert.ok(res.fleet.lockupRiskCount >= 1);
  assert.ok(res.fleet.optimalCount >= 1);
});

test('renderDuctJettingSvg generates accessible, theme-aware pure SVG with duct cutaway, airflow vector, and reach gauge', () => {
  const state = createInitialState([]);
  const metrics = calculateDuctJettingMetrics(state, { routeId: 'jet-gt-01' });

  const svg = renderDuctJettingSvg(metrics);
  assert.ok(svg.includes('<svg class="chart-svg duct-jetting-svg"'));
  assert.ok(svg.includes('Pneumatic Cable Blowing Trajectory'));
  assert.ok(svg.includes('Bore Fill &amp; Clearance'));
  assert.ok(svg.includes('CRITICAL BUCKLING'));
  assert.ok(svg.includes('BLOWING SPEED'));
  assert.ok(svg.includes('Maximum Blowing Reach Horizon'));
  assert.ok(svg.includes('Route Length:'));

  // Test empty state fallback
  const emptySvg = renderDuctJettingSvg(null);
  assert.ok(emptySvg.includes('No underground duct jetting metrics available'));
});

test('generateDuctJettingReport produces structured contractor and field technician report', () => {
  const state = createInitialState(['User Alpha']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].bills = [{ month: '2026-10', amount: 2000 }];

  const metrics = calculateDuctJettingMetrics(state, { routeId: 'jet-gt-01', referenceDate: '2026-10-16' });
  const report = generateDuctJettingReport(metrics, '2026-10-16');

  assert.ok(report.includes('SHAHDARA FTTH UNDERGROUND DUCT HYDRAULIC PRESSURE & JETTING AUDIT REPORT'));
  assert.ok(report.includes('ROUTE SPECIFICATION & TRENCH TOPOLOGY:'));
  assert.ok(report.includes('[jet-gt-01] GT Road Railway Underpass Subduct Trench'));
  assert.ok(report.includes('CONDUIT BORE & CABLE CLEARANCE METRICS:'));
  assert.ok(report.includes('PNEUMATIC BLOWING & BUCKLING DYNAMICS:'));
  assert.ok(report.includes('CUSTOMER ROSTER & BACKBONE REVENUE AT RISK:'));
  assert.ok(report.includes('SHAHDARA UNDERGROUND CONDUIT FLEET REGISTER:'));
  assert.ok(report.includes('CONTRACTOR & JETTING MACHINE RECOMMENDATIONS:'));
});

test('setupDuctJettingModal wires open, close, select change, slider input, reset, filter, and copy actions', async () => {
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
    value: 'jet-mb-03',
    children: [],
    appendChild: function(c) { this.children.push(c); },
    addEventListener: (type, fn) => { if (type === 'change') selectChangeHandler = fn; },
    dataset: {}
  };

  let pressureInputHandler = null;
  const mockPressureSlider = {
    value: '10',
    addEventListener: (type, fn) => { if (type === 'input') pressureInputHandler = fn; },
    dataset: {}
  };
  const mockPressureVal = { textContent: '10 bar' };

  let frictionInputHandler = null;
  const mockFrictionSlider = {
    value: '0.28',
    addEventListener: (type, fn) => { if (type === 'input') frictionInputHandler = fn; },
    dataset: {}
  };
  const mockFrictionVal = { textContent: '0.28' };

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
  const mockKpiReach = { textContent: '' };
  const mockKpiBuckling = { textContent: '' };
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
        case 'dashboardJettingModal': return mockModal;
        case 'dashboardOpenJettingModalBtn': return mockOpenBtn;
        case 'dashboardJettingModalCloseBtn': return mockCloseBtn;
        case 'jettingRouteSelect': return mockSelect;
        case 'jettingPressureSlider': return mockPressureSlider;
        case 'jettingPressureVal': return mockPressureVal;
        case 'jettingFrictionSlider': return mockFrictionSlider;
        case 'jettingFrictionVal': return mockFrictionVal;
        case 'jettingResetSimBtn': return mockResetBtn;
        case 'jettingFilterAreaBtn': return mockFilterAreaBtn;
        case 'dashboardCopyJettingReportBtn': return mockCopyBtn;
        case 'jettingKpiRouteName': return mockKpiName;
        case 'jettingKpiBlowingReach': return mockKpiReach;
        case 'jettingKpiBucklingLoad': return mockKpiBuckling;
        case 'jettingStatusBadge': return mockKpiBadge;
        case 'jettingKpiRevenueRisk': return mockKpiRisk;
        case 'jettingModalChartWrap': return mockChartWrap;
        case 'jettingRoutesTableBody': return mockTableBody;
        default: return null;
      }
    },
    createElement: (tag) => ({ tag, value: '', textContent: '', selected: false })
  };

  const state = createInitialState([]);

  try {
    setupDuctJettingModal(state, {
      referenceDate: '2026-10-16',
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    // Check options populated
    assert.equal(mockSelect.children.length, SHAHDARA_JETTING_ROUTES.length);

    // Test open
    assert.ok(openClickHandler !== null);
    openClickHandler();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiName.textContent.includes('Main Bazaar'));
    assert.ok(mockChartWrap.innerHTML.includes('duct-jetting-svg'));

    // Test pressure slider input
    assert.ok(pressureInputHandler !== null);
    mockPressureSlider.value = '15';
    pressureInputHandler();
    assert.equal(getJettingPressure(), 15);
    assert.equal(mockPressureVal.textContent, '15 bar');

    // Test friction slider input
    assert.ok(frictionInputHandler !== null);
    mockFrictionSlider.value = '0.10';
    frictionInputHandler();
    assert.equal(getJettingFriction(), 0.10);
    assert.equal(mockFrictionVal.textContent, '0.10');

    // Test reset
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getJettingPressure(), null);
    assert.equal(getJettingFriction(), null);

    // Test filter area action
    assert.ok(filterAreaClickHandler !== null);
    filterAreaClickHandler();
    assert.equal(filterAreaCalledWith, 'Main Bazaar');
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyClickHandler !== null);
    await copyClickHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA FTTH UNDERGROUND DUCT HYDRAULIC PRESSURE & JETTING AUDIT REPORT'));
    assert.equal(toastMessage, 'Underground duct jetting audit copied to clipboard!');

    // Test close
    assert.ok(closeClickHandler !== null);
    closeClickHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateOpticalPropagationDelay returns accurate single-trip and RTT physical delays', () => {
  const delay1 = calculateOpticalPropagationDelay(4.8);
  assert.ok(delay1.oneWayMs > 0.02 && delay1.oneWayMs < 0.03);
  assert.equal(delay1.rttMs, Math.round(delay1.oneWayMs * 2 * 1000) / 1000);

  const delay2 = calculateOpticalPropagationDelay(8.5);
  assert.ok(delay2.oneWayMs > 0.04 && delay2.oneWayMs < 0.05);
  assert.ok(delay2.rttMs > delay1.rttMs);

  // Fallback on invalid or zero distance
  const delayZero = calculateOpticalPropagationDelay(0);
  assert.ok(delayZero.oneWayMs > 0);
  assert.ok(delayZero.rttMs > 0);
});

test('calculateDbaQueueDynamics models SR-DBA, NSR-DBA, and Hybrid-DBA latency queueing', () => {
  const gponPort = SHAHDARA_PON_PORTS[0]; // Shahdara Town Central

  // Low concurrency baseline
  const lowLoad = calculateDbaQueueDynamics(gponPort, {
    dbaMode: 'SR-DBA',
    concurrencyLoad: 30,
    cyclePeriodMs: 1.0,
    activeSubscriberCount: 40,
    totalBilledRevenue: 88000
  });

  assert.equal(lowLoad.effectiveMode, 'SR-DBA');
  assert.equal(lowLoad.status, 'OPTIMAL');
  assert.equal(lowLoad.dropRatePct, 0);
  assert.equal(lowLoad.atRiskRevenue, 0);
  assert.ok(lowLoad.avgOneWayLatencyMs < gponPort.slaLatencyThresholdMs);
  assert.ok(lowLoad.p99LatencyMs > lowLoad.avgOneWayLatencyMs);
  assert.ok(lowLoad.jitterMs > 0);

  // Compare DBA modes at moderate load
  const srDba = calculateDbaQueueDynamics(gponPort, { dbaMode: 'SR-DBA', concurrencyLoad: 70, cyclePeriodMs: 1.0 });
  const nsrDba = calculateDbaQueueDynamics(gponPort, { dbaMode: 'NSR-DBA', concurrencyLoad: 70, cyclePeriodMs: 1.0 });
  const hybridDba = calculateDbaQueueDynamics(gponPort, { dbaMode: 'Hybrid-DBA', concurrencyLoad: 70, cyclePeriodMs: 1.0 });

  assert.equal(srDba.effectiveMode, 'SR-DBA');
  assert.equal(nsrDba.effectiveMode, 'NSR-DBA');
  assert.equal(hybridDba.effectiveMode, 'Hybrid-DBA');
  assert.ok(srDba.schedulingDelayMs > 0);
  assert.ok(nsrDba.schedulingDelayMs > 0);

  // High concurrency causing buffer overrun & SLA breach
  const heavyLoad = calculateDbaQueueDynamics(gponPort, {
    dbaMode: 'NSR-DBA',
    concurrencyLoad: 98,
    cyclePeriodMs: 2.5,
    activeSubscriberCount: 80,
    totalBilledRevenue: 176000
  });

  assert.equal(heavyLoad.status, 'CRITICAL');
  assert.ok(heavyLoad.dropRatePct > 0);
  assert.equal(heavyLoad.atRiskRevenue, 176000);
  assert.ok(heavyLoad.avgOneWayLatencyMs > gponPort.slaLatencyThresholdMs || heavyLoad.dropRatePct >= 2.0);

  // T-CONT distribution validation
  assert.equal(lowLoad.tcontDistribution.length, 4);
  assert.equal(lowLoad.tcontDistribution[0].type, 'T-CONT 1');
  assert.equal(lowLoad.tcontDistribution[3].type, 'T-CONT 4');
});

test('calculatePonDbaMetrics evaluates customer correlations across Shahdara corridors', () => {
  const state = {
    customers: [
      { id: 'cust-1', name: 'Zahid Khan', area: 'Shahdara Town', plan: 'Fiber 20M', planRate: 2000, status: 'Active' },
      { id: 'cust-2', name: 'Rashid Mehmood', area: 'Baradari Road', plan: 'Fiber 30M', planRate: 2500, status: 'Active' },
      { id: 'cust-3', name: 'Farooq Textile', area: 'Vandala Road', plan: 'Gigabit Biz', planRate: 6000, status: 'Active' },
      { id: 'cust-4', name: 'Asif Autos', area: 'Jia Musa', plan: 'Fiber 15M', planRate: 1800, status: 'Active' }
    ],
    bills: []
  };

  const metrics = calculatePonDbaMetrics(state, {
    portId: 'pon-vr-03',
    modeOverride: 'Hybrid-DBA',
    concurrencyOverride: 60,
    cycleOverride: 1.5,
    referenceDate: '2026-10-16'
  });

  assert.ok(metrics.selectedPort.id === 'pon-vr-03');
  assert.equal(metrics.selectedDynamics.effectiveMode, 'Hybrid-DBA');
  assert.equal(metrics.selectedDynamics.effectiveConcurrency, 60);
  assert.equal(metrics.selectedDynamics.effectiveCycle, 1.5);
  assert.equal(metrics.portEvaluations.length, SHAHDARA_PON_PORTS.length);
  assert.ok(metrics.summary.totalPorts === SHAHDARA_PON_PORTS.length);
  assert.ok(metrics.summary.totalSubscribers >= 4);
});

test('renderPonDbaQueueSvg renders valid, accessible SVG for compact and modal views', () => {
  const dummyData = {
    selectedPort: SHAHDARA_PON_PORTS[0],
    selectedDynamics: {
      status: 'OPTIMAL',
      statusLabel: 'Optimal Latency',
      badgeClass: 'badge-success',
      effectiveMode: 'SR-DBA',
      effectiveConcurrency: 65,
      effectiveCycle: 1.0,
      propagation: { oneWayMs: 0.023, rttMs: 0.047 },
      utilizationPct: 62,
      jitterMs: 1.25,
      dropRatePct: 0.0,
      avgOneWayLatencyMs: 4.85,
      avgRttLatencyMs: 9.75,
      p99LatencyMs: 8.65,
      slaThresholdMs: 15.0,
      atRiskRevenue: 0,
      schedulingDelayMs: 1.55,
      tcontDistribution: [
        { type: 'T-CONT 1', label: 'Fixed', sharePct: 15 },
        { type: 'T-CONT 2', label: 'Assured', sharePct: 25 },
        { type: 'T-CONT 3', label: 'Non-Assured', sharePct: 30 },
        { type: 'T-CONT 4', label: 'Best-Effort', sharePct: 30 }
      ]
    }
  };

  // Compact rendering
  const compactSvg = renderPonDbaQueueSvg(dummyData, { compact: true });
  assert.ok(compactSvg.includes('<svg class="chart-svg pon-dba-svg compact-svg"'));
  assert.ok(compactSvg.includes('Avg 1-Way Latency'));
  assert.ok(compactSvg.includes('4.85 ms'));
  assert.ok(compactSvg.includes('OPTIMAL'));

  // Full modal rendering
  const fullSvg = renderPonDbaQueueSvg(dummyData, { compact: false });
  assert.ok(fullSvg.includes('<svg class="chart-svg pon-dba-svg full-svg"'));
  assert.ok(fullSvg.includes('125µs GPON Frame Burst Horizon'));
  assert.ok(fullSvg.includes('T-CONT 1 (Fixed)'));
  assert.ok(fullSvg.includes('T-CONT 4 (Best Effort)'));
  assert.ok(fullSvg.includes('SLA Latency Cap'));

  // Empty state fallback
  const emptySvg = renderPonDbaQueueSvg(null);
  assert.ok(emptySvg.includes('No PON DBA metrics recorded'));
});

test('generatePonDbaReport outputs complete diagnostic briefing', () => {
  const dummyData = {
    selectedPort: SHAHDARA_PON_PORTS[0],
    selectedEvaluation: { billedRevenue: 85000 },
    selectedDynamics: {
      status: 'CRITICAL',
      statusLabel: 'Critical Buffer Overrun',
      effectiveMode: 'NSR-DBA',
      effectiveCycle: 2.0,
      effectiveConcurrency: 90,
      activeCount: 60,
      offeredTrafficMbps: 900,
      utilizationPct: 88,
      schedulingDelayMs: 2.9,
      queueDelayMs: 8.5,
      avgOneWayLatencyMs: 18.5,
      avgRttLatencyMs: 37.1,
      p99LatencyMs: 32.4,
      jitterMs: 5.8,
      dropRatePct: 3.4,
      slaThresholdMs: 15.0,
      atRiskRevenue: 85000,
      propagation: { oneWayMs: 0.023, rttMs: 0.047 },
      tcontDistribution: [
        { type: 'T-CONT 1', label: 'Fixed Guaranteed (VoIP/SLA)', sharePct: 15 },
        { type: 'T-CONT 2', label: 'Assured Dedicated', sharePct: 25 },
        { type: 'T-CONT 3', label: 'Assured + Non-Assured', sharePct: 30 },
        { type: 'T-CONT 4', label: 'Best-Effort Contention', sharePct: 30 }
      ]
    },
    summary: {
      totalPorts: 6,
      optimalPortCount: 4,
      elevatedPortCount: 1,
      criticalPortCount: 1,
      totalNetworkBilled: 450000,
      totalAtRiskRevenue: 85000
    },
    portEvaluations: [
      {
        port: SHAHDARA_PON_PORTS[0],
        dynamics: {
          avgOneWayLatencyMs: 18.5,
          jitterMs: 5.8,
          utilizationPct: 88,
          status: 'CRITICAL'
        }
      }
    ]
  };

  const report = generatePonDbaReport(dummyData, '2026-10-16');
  assert.ok(report.includes('SHAHDARA FTTH OLT PON PORT DBA & TDM LATENCY QUEUE AUDIT REPORT'));
  assert.ok(report.includes('Shahdara Town Central OLT-01 PON-1'));
  assert.ok(report.includes('T-CONT 1'));
  assert.ok(report.includes('URGENT'));
  assert.ok(report.includes('Transition from NSR-DBA to SR-DBA'));
});

test('get/set state helpers validate port, mode, concurrency, and cycle period', () => {
  setPonDbaSelectedPort('pon-vr-03');
  assert.equal(getPonDbaSelectedPort(), 'pon-vr-03');

  setPonDbaSelectedPort('invalid-port');
  assert.equal(getPonDbaSelectedPort(), 'pon-vr-03');

  setPonDbaMode('Hybrid-DBA');
  assert.equal(getPonDbaMode(), 'Hybrid-DBA');
  setPonDbaMode('invalid-mode');
  assert.equal(getPonDbaMode(), null);

  setPonDbaConcurrency(85);
  assert.equal(getPonDbaConcurrency(), 85);
  setPonDbaConcurrency(150); // out of range
  assert.equal(getPonDbaConcurrency(), null);

  setPonDbaCyclePeriod(2.25);
  assert.equal(getPonDbaCyclePeriod(), 2.25);
  setPonDbaCyclePeriod(10.0); // out of range
  assert.equal(getPonDbaCyclePeriod(), null);
});

test('setupPonDbaModal wires interactive controls, sliders, reset, filter, and clipboard dispatch', async () => {
  setPonDbaSelectedPort('pon-st-01');
  const originalDocument = globalThis.document;

  let modalOpened = false;
  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  let openClickHandler = null;
  let closeClickHandler = null;
  let portChangeHandler = null;
  let modeChangeHandler = null;
  let concurrencyInputHandler = null;
  let cycleInputHandler = null;
  let resetClickHandler = null;
  let filterAreaClickHandler = null;
  let copyClickHandler = null;

  const mockModal = {
    dataset: {},
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') openClickHandler = fn; }
  };

  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') closeClickHandler = fn; }
  };

  const mockPortSelect = {
    options: [],
    value: 'pon-st-01',
    dataset: {},
    appendChild: (opt) => mockPortSelect.options.push(opt),
    addEventListener: (evt, fn) => { if (evt === 'change') portChangeHandler = fn; }
  };

  const mockModeSelect = {
    options: [],
    value: 'SR-DBA',
    dataset: {},
    appendChild: (opt) => mockModeSelect.options.push(opt),
    addEventListener: (evt, fn) => { if (evt === 'change') modeChangeHandler = fn; }
  };

  const mockConcurrencySlider = {
    value: '65',
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'input') concurrencyInputHandler = fn; }
  };
  const mockConcurrencyVal = { textContent: '' };

  const mockCycleSlider = {
    value: '1.0',
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'input') cycleInputHandler = fn; }
  };
  const mockCycleVal = { textContent: '' };

  const mockResetBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') resetClickHandler = fn; }
  };

  const mockFilterAreaBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') filterAreaClickHandler = fn; }
  };

  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') copyClickHandler = fn; }
  };

  const mockKpiPortName = { textContent: '' };
  const mockKpiLatency = { textContent: '' };
  const mockKpiP99Jitter = { textContent: '' };
  const mockKpiStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };
  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'dashboardPonDbaModal': return mockModal;
        case 'dashboardOpenPonDbaModalBtn': return mockOpenBtn;
        case 'dashboardPonDbaModalCloseBtn': return mockCloseBtn;
        case 'ponDbaPortSelect': return mockPortSelect;
        case 'ponDbaModeSelect': return mockModeSelect;
        case 'ponDbaConcurrencySlider': return mockConcurrencySlider;
        case 'ponDbaConcurrencyVal': return mockConcurrencyVal;
        case 'ponDbaCycleSlider': return mockCycleSlider;
        case 'ponDbaCycleVal': return mockCycleVal;
        case 'ponDbaResetSimBtn': return mockResetBtn;
        case 'ponDbaFilterAreaBtn': return mockFilterAreaBtn;
        case 'dashboardCopyPonDbaReportBtn': return mockCopyBtn;
        case 'ponDbaKpiPortName': return mockKpiPortName;
        case 'ponDbaKpiLatency': return mockKpiLatency;
        case 'ponDbaKpiP99Jitter': return mockKpiP99Jitter;
        case 'ponDbaStatusBadge': return mockKpiStatusBadge;
        case 'ponDbaKpiRevenueRisk': return mockKpiRevenueRisk;
        case 'ponDbaModalChartWrap': return mockChartWrap;
        case 'ponDbaPortsTableBody': return mockTableBody;
        default: return null;
      }
    },
    createElement: (tag) => ({ tag, value: '', textContent: '', selected: false })
  };

  const state = createInitialState([]);

  try {
    setupPonDbaModal(state, {
      referenceDate: '2026-10-16',
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    // Check options populated
    assert.equal(mockPortSelect.options.length, SHAHDARA_PON_PORTS.length);
    assert.equal(mockModeSelect.options.length, 3);

    // Test open
    assert.ok(openClickHandler !== null);
    openClickHandler();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiPortName.textContent.includes('Shahdara Town'));
    assert.ok(mockChartWrap.innerHTML.includes('pon-dba-svg'));

    // Test concurrency slider input
    assert.ok(concurrencyInputHandler !== null);
    mockConcurrencySlider.value = '80';
    concurrencyInputHandler();
    assert.equal(getPonDbaConcurrency(), 80);
    assert.equal(mockConcurrencyVal.textContent, '80%');

    // Test cycle slider input
    assert.ok(cycleInputHandler !== null);
    mockCycleSlider.value = '2.5';
    cycleInputHandler();
    assert.equal(getPonDbaCyclePeriod(), 2.5);
    assert.equal(mockCycleVal.textContent, '2.5 ms');

    // Test reset
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getPonDbaConcurrency(), null);
    assert.equal(getPonDbaCyclePeriod(), null);

    // Test filter area action
    assert.ok(filterAreaClickHandler !== null);
    filterAreaClickHandler();
    assert.equal(filterAreaCalledWith, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyClickHandler !== null);
    await copyClickHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA FTTH OLT PON PORT DBA & TDM LATENCY QUEUE AUDIT REPORT'));
    assert.equal(toastMessage, 'PON DBA latency diagnostics briefing copied to clipboard!');

    // Test close
    assert.ok(closeClickHandler !== null);
    closeClickHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateElectrodeDynamics models wear percentage, insertion loss, and tensile proof strength', () => {
  const kit = SHAHDARA_SPLICER_UNITS[0]; // Fujikura 88S+

  // Low wear baseline
  const lowWear = calculateElectrodeDynamics(kit, {
    arcCount: 500,
    cleaveAngleDeg: 0.35,
    calibCurrentMa: 15.2,
    totalBilledRevenue: 60000
  });

  assert.equal(lowWear.status, 'OPTIMAL');
  assert.equal(lowWear.atRiskRevenue, 0);
  assert.ok(lowWear.estimatedLossDb < 0.04);
  assert.ok(lowWear.tensileProofN > 2.0);
  assert.ok(lowWear.arcStabilityPct > 80);

  // Moderate / Elevated wear
  const elevated = calculateElectrodeDynamics(kit, {
    arcCount: 3000,
    cleaveAngleDeg: 0.95,
    calibCurrentMa: 15.5,
    totalBilledRevenue: 60000
  });

  assert.equal(elevated.status, 'ELEVATED');
  assert.ok(elevated.atRiskRevenue > 0);
  assert.ok(elevated.estimatedLossDb > lowWear.estimatedLossDb);

  // Critical wear & high cleave angle error
  const critical = calculateElectrodeDynamics(kit, {
    arcCount: 3800,
    cleaveAngleDeg: 2.10,
    calibCurrentMa: 17.8,
    totalBilledRevenue: 60000
  });

  assert.equal(critical.status, 'CRITICAL');
  assert.equal(critical.atRiskRevenue, 60000);
  assert.ok(critical.estimatedLossDb >= 0.10);
  assert.ok(critical.tensileProofN < 1.7);
  assert.ok(critical.cleaveRating.includes('Reject'));
});

test('calculateFusionSplicerMetrics correlates splicer kits with area subscribers and revenue', () => {
  const state = {
    customers: [
      { id: 'c1', name: 'Zahid Khan', area: 'Shahdara Town', plan: 'Fiber 20M', planRate: 2000, status: 'Active' },
      { id: 'c2', name: 'Hamza Tariq', area: 'Baradari Road', plan: 'Fiber 30M', planRate: 2500, status: 'Active' }
    ],
    bills: []
  };

  const metrics = calculateFusionSplicerMetrics(state, {
    unitId: 'spl-vr-03',
    arcCountOverride: 1500,
    cleaveAngleOverride: 0.40,
    calibCurrentOverride: 15.0,
    referenceDate: '2026-10-16'
  });

  assert.equal(metrics.selectedUnit.id, 'spl-vr-03');
  assert.equal(metrics.selectedDynamics.effectiveArcs, 1500);
  assert.equal(metrics.selectedDynamics.effectiveAngle, 0.40);
  assert.equal(metrics.selectedDynamics.effectiveCurrent, 15.0);
  assert.equal(metrics.unitEvaluations.length, SHAHDARA_SPLICER_UNITS.length);
  assert.equal(metrics.summary.totalKits, SHAHDARA_SPLICER_UNITS.length);
});

test('renderFusionSplicerSvg renders compact arc gauge and full alignment chamber', () => {
  const dummyData = {
    selectedUnit: SHAHDARA_SPLICER_UNITS[0],
    selectedDynamics: {
      status: 'OPTIMAL',
      statusLabel: 'High Quality Splice',
      badgeClass: 'badge-success',
      effectiveArcs: 1850,
      effectiveAngle: 0.45,
      effectiveCurrent: 15.2,
      wearPct: 46,
      remainingArcs: 2150,
      arcStabilityPct: 67,
      estimatedLossDb: 0.024,
      tensileProofN: 2.12,
      cleaveRating: 'Excellent (< 0.5°)',
      atRiskRevenue: 0
    }
  };

  // Compact rendering
  const compactSvg = renderFusionSplicerSvg(dummyData, { compact: true });
  assert.ok(compactSvg.includes('<svg class="chart-svg splicer-svg compact-svg"'));
  assert.ok(compactSvg.includes('0.024 dB'));
  assert.ok(compactSvg.includes('OPTIMAL'));
  assert.ok(compactSvg.includes('Arc Stability'));

  // Full modal rendering
  const fullSvg = renderFusionSplicerSvg(dummyData, { compact: false });
  assert.ok(fullSvg.includes('<svg class="chart-svg splicer-svg full-svg"'));
  assert.ok(fullSvg.includes('Dual-Camera Optical Alignment'));
  assert.ok(fullSvg.includes('Arc Gap'));
  assert.ok(fullSvg.includes('ITU-T Max Splice Loss Cap'));

  // Empty data fallback
  const emptySvg = renderFusionSplicerSvg(null);
  assert.ok(emptySvg.includes('No fusion splicer telemetry recorded'));
});

test('generateFusionSplicerReport creates technician maintenance directives', () => {
  const dummyData = {
    selectedUnit: SHAHDARA_SPLICER_UNITS[0],
    selectedEvaluation: { billedRevenue: 75000 },
    selectedDynamics: {
      status: 'CRITICAL',
      statusLabel: 'Electrode Replace / Re-cleave Due',
      effectiveArcs: 3800,
      remainingArcs: 200,
      wearPct: 95,
      arcStabilityPct: 32,
      effectiveAngle: 2.1,
      cleaveRating: 'Reject / Re-cleave (> 1.8°)',
      effectiveCurrent: 17.5,
      estimatedLossDb: 0.125,
      tensileProofN: 1.45,
      atRiskRevenue: 75000
    },
    summary: {
      totalKits: 6,
      optimalKitsCount: 4,
      elevatedKitsCount: 1,
      criticalKitsCount: 1,
      totalBilledRevenue: 450000,
      totalAtRiskRevenue: 75000
    },
    unitEvaluations: [
      {
        unit: SHAHDARA_SPLICER_UNITS[0],
        dynamics: {
          effectiveArcs: 3800,
          wearPct: 95,
          effectiveAngle: 2.1,
          estimatedLossDb: 0.125,
          status: 'CRITICAL'
        }
      }
    ]
  };

  const report = generateFusionSplicerReport(dummyData, '2026-10-16');
  assert.ok(report.includes('SHAHDARA FTTH FUSION SPLICER ELECTRODE WEAR & ARC DIAGNOSTICS AUDIT'));
  assert.ok(report.includes('Shahdara Town Central Kit #1'));
  assert.ok(report.includes('URGENT'));
  assert.ok(report.includes('Replace electrode pair immediately'));
  assert.ok(report.includes('Rotate cleaver diamond blade'));
});

test('get/set state helpers validate unit, arc count, cleave angle, and calib current', () => {
  setSplicerSelectedUnit('spl-vr-03');
  assert.equal(getSplicerSelectedUnit(), 'spl-vr-03');
  setSplicerSelectedUnit('invalid-unit');
  assert.equal(getSplicerSelectedUnit(), 'spl-vr-03');

  setSplicerArcCount(2400);
  assert.equal(getSplicerArcCount(), 2400);
  setSplicerArcCount(9999); // out of range
  assert.equal(getSplicerArcCount(), null);

  setSplicerCleaveAngle(1.25);
  assert.equal(getSplicerCleaveAngle(), 1.25);
  setSplicerCleaveAngle(5.0); // out of range
  assert.equal(getSplicerCleaveAngle(), null);

  setSplicerCalibCurrent(16.2);
  assert.equal(getSplicerCalibCurrent(), 16.2);
  setSplicerCalibCurrent(25.0); // out of range
  assert.equal(getSplicerCalibCurrent(), null);
});

test('setupFusionSplicerModal wires interactive controls, sliders, reset, filter, and clipboard dispatch', async () => {
  setSplicerSelectedUnit('spl-st-01');
  const originalDocument = globalThis.document;

  let modalOpened = false;
  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  let openClickHandler = null;
  let closeClickHandler = null;
  let unitChangeHandler = null;
  let arcInputHandler = null;
  let angleInputHandler = null;
  let resetClickHandler = null;
  let filterAreaClickHandler = null;
  let copyClickHandler = null;

  const mockModal = {
    dataset: {},
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; },
    addEventListener: () => {}
  };

  const mockOpenBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') openClickHandler = fn; }
  };

  const mockCloseBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') closeClickHandler = fn; }
  };

  const mockUnitSelect = {
    options: [],
    value: 'spl-st-01',
    dataset: {},
    appendChild: (opt) => mockUnitSelect.options.push(opt),
    addEventListener: (evt, fn) => { if (evt === 'change') unitChangeHandler = fn; }
  };

  const mockArcSlider = {
    value: '1850',
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'input') arcInputHandler = fn; }
  };
  const mockArcVal = { textContent: '' };

  const mockAngleSlider = {
    value: '0.45',
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'input') angleInputHandler = fn; }
  };
  const mockAngleVal = { textContent: '' };

  const mockResetBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') resetClickHandler = fn; }
  };

  const mockFilterAreaBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') filterAreaClickHandler = fn; }
  };

  const mockCopyBtn = {
    dataset: {},
    addEventListener: (evt, fn) => { if (evt === 'click') copyClickHandler = fn; }
  };

  const mockKpiUnitName = { textContent: '' };
  const mockKpiLoss = { textContent: '' };
  const mockKpiTensile = { textContent: '' };
  const mockKpiStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };
  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'dashboardSplicerModal': return mockModal;
        case 'dashboardOpenSplicerModalBtn': return mockOpenBtn;
        case 'dashboardSplicerModalCloseBtn': return mockCloseBtn;
        case 'splicerUnitSelect': return mockUnitSelect;
        case 'splicerArcSlider': return mockArcSlider;
        case 'splicerArcVal': return mockArcVal;
        case 'splicerAngleSlider': return mockAngleSlider;
        case 'splicerAngleVal': return mockAngleVal;
        case 'splicerResetSimBtn': return mockResetBtn;
        case 'splicerFilterAreaBtn': return mockFilterAreaBtn;
        case 'dashboardCopySplicerReportBtn': return mockCopyBtn;
        case 'splicerKpiUnitName': return mockKpiUnitName;
        case 'splicerKpiLoss': return mockKpiLoss;
        case 'splicerKpiTensile': return mockKpiTensile;
        case 'splicerStatusBadge': return mockKpiStatusBadge;
        case 'splicerKpiRevenueRisk': return mockKpiRevenueRisk;
        case 'splicerModalChartWrap': return mockChartWrap;
        case 'splicerUnitsTableBody': return mockTableBody;
        default: return null;
      }
    },
    createElement: (tag) => ({ tag, value: '', textContent: '', selected: false })
  };

  const state = { customers: [], bills: [] };

  try {
    setupFusionSplicerModal(state, {
      referenceDate: '2026-10-16',
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    // Check options populated
    assert.equal(mockUnitSelect.options.length, SHAHDARA_SPLICER_UNITS.length);

    // Test open
    assert.ok(openClickHandler !== null);
    openClickHandler();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiUnitName.textContent.includes('Shahdara Town'));
    assert.ok(mockChartWrap.innerHTML.includes('splicer-svg'));

    // Test arc slider input
    assert.ok(arcInputHandler !== null);
    mockArcSlider.value = '3200';
    arcInputHandler();
    assert.equal(getSplicerArcCount(), 3200);
    assert.equal(mockArcVal.textContent, '3200 arcs');

    // Test angle slider input
    assert.ok(angleInputHandler !== null);
    mockAngleSlider.value = '1.20';
    angleInputHandler();
    assert.equal(getSplicerCleaveAngle(), 1.20);
    assert.equal(mockAngleVal.textContent, '1.20°');

    // Test reset
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getSplicerArcCount(), null);
    assert.equal(getSplicerCleaveAngle(), null);

    // Test filter area action
    assert.ok(filterAreaClickHandler !== null);
    filterAreaClickHandler();
    assert.equal(filterAreaCalledWith, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyClickHandler !== null);
    await copyClickHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA FTTH FUSION SPLICER ELECTRODE WEAR & ARC DIAGNOSTICS AUDIT'));
    assert.equal(toastMessage, 'Fusion splicer maintenance briefing copied to clipboard!');

    // Test close
    assert.ok(closeClickHandler !== null);
    closeClickHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateBgpFlapPenalty calculates RFC 2439 exponential penalty decay and half-life dynamics', () => {
  // Test zero flaps
  const zeroResult = calculateBgpFlapPenalty(0, 0);
  assert.equal(zeroResult.initialPenalty, 0);
  assert.equal(zeroResult.currentPenalty, 0);
  assert.equal(zeroResult.decayFactor, 1.0);

  // Test 2 flaps at t = 0 min
  const t0Result = calculateBgpFlapPenalty(2, 0, 15);
  assert.equal(t0Result.initialPenalty, 2000);
  assert.equal(t0Result.currentPenalty, 2000);
  assert.equal(t0Result.decayFactor, 1.0);
  assert.equal(t0Result.halfLifeMins, 15);

  // Test 2 flaps after 1 half-life (15 min) -> penalty should halve to 1000
  const t15Result = calculateBgpFlapPenalty(2, 15, 15);
  assert.equal(t15Result.initialPenalty, 2000);
  assert.equal(t15Result.currentPenalty, 1000);
  assert.equal(t15Result.decayFactor, 0.5);

  // Test 2 flaps after 2 half-lives (30 min) -> penalty should quarter to 500
  const t30Result = calculateBgpFlapPenalty(2, 30, 15);
  assert.equal(t30Result.initialPenalty, 2000);
  assert.equal(t30Result.currentPenalty, 500);
  assert.equal(t30Result.decayFactor, 0.25);

  // Test 4 flaps after 45 min (3 half-lives) -> 4000 * 0.125 = 500
  const t45Result = calculateBgpFlapPenalty(4, 45, 15);
  assert.equal(t45Result.initialPenalty, 4000);
  assert.equal(t45Result.currentPenalty, 500);

  // Fallback / negative handling
  const safeNeg = calculateBgpFlapPenalty(-5, -10, -3);
  assert.equal(safeNeg.initialPenalty, 0);
  assert.equal(safeNeg.currentPenalty, 0);
});

test('calculateRouteConvergenceTime scales with prefix count, CPU load, and TCAM usage', () => {
  const baseTime = calculateRouteConvergenceTime(100000, 30, 60);
  assert.ok(baseTime >= 12);

  // Higher prefixes increase convergence time
  const highPrefixTime = calculateRouteConvergenceTime(900000, 30, 60);
  assert.ok(highPrefixTime > baseTime);

  // Higher CPU increases convergence time
  const highCpuTime = calculateRouteConvergenceTime(900000, 90, 60);
  assert.ok(highCpuTime > highPrefixTime);

  // Minimum floor
  const minTime = calculateRouteConvergenceTime(0, 0, 0);
  assert.equal(minTime, 12);
});

test('BGP simulation state getters, setters, and reset functionality work correctly', () => {
  resetBgpSimState();
  assert.equal(getBgpSelectedPeer(), SHAHDARA_BGP_PEERS[0].id);
  assert.equal(getBgpFlapCount(), null);
  assert.equal(getBgpSuppressThreshold(), BGP_CONSTANTS.DEFAULT_SUPPRESS_THRESHOLD);

  setBgpSelectedPeer('bgp-ptcl-02');
  assert.equal(getBgpSelectedPeer(), 'bgp-ptcl-02');

  setBgpFlapCount(18);
  assert.equal(getBgpFlapCount(), 18);

  // Clamp limits for flap count
  setBgpFlapCount(50);
  assert.equal(getBgpFlapCount(), 30);
  setBgpFlapCount(-10);
  assert.equal(getBgpFlapCount(), 0);

  // Threshold bounds
  setBgpSuppressThreshold(3500);
  assert.equal(getBgpSuppressThreshold(), 3500);
  setBgpSuppressThreshold(9000);
  assert.equal(getBgpSuppressThreshold(), 5000);
  setBgpSuppressThreshold(500);
  assert.equal(getBgpSuppressThreshold(), 1000);

  // Reset
  resetBgpSimState();
  assert.equal(getBgpSelectedPeer(), SHAHDARA_BGP_PEERS[0].id);
  assert.equal(getBgpFlapCount(), null);
  assert.equal(getBgpSuppressThreshold(), BGP_CONSTANTS.DEFAULT_SUPPRESS_THRESHOLD);
});

test('calculateBgpPeeringMetrics evaluates peers, RPKI validation, and subscriber revenue exposure', () => {
  resetBgpSimState();

  const state = {
    customers: [
      { id: 'c1', name: 'Zahid Khan', area: 'Shahdara Town', isArchived: false },
      { id: 'c2', name: 'Farhan Ali', area: 'Baradari Road', isArchived: false },
      { id: 'c3', name: 'Tariq Mehmood', area: 'Vandala Road', isArchived: false },
      { id: 'c4', name: 'Archived User', area: 'Shahdara Town', isArchived: true }
    ],
    bills: [
      { customerId: 'c1', balance: 2500 },
      { customerId: 'c2', balance: 4000 },
      { customerId: 'c3', balance: 1800 }
    ]
  };

  const metrics = calculateBgpPeeringMetrics(state);
  assert.equal(metrics.totalPeers, SHAHDARA_BGP_PEERS.length);
  assert.equal(metrics.establishedPeers, SHAHDARA_BGP_PEERS.length);
  assert.ok(metrics.totalPrefixesReceived > 2000000);
  assert.ok(metrics.totalLinkCapacityGbps >= 50);
  assert.ok(metrics.overallRpkiValidPct >= 90 && metrics.overallRpkiValidPct <= 100);

  // Check selected peer data
  const p = metrics.selectedPeer;
  assert.equal(p.id, SHAHDARA_BGP_PEERS[0].id);
  assert.equal(p.name, SHAHDARA_BGP_PEERS[0].name);
  assert.ok(p.linkedSubscribers >= 1);
  assert.ok(p.linkedDues >= 2500);

  // Test simulation override with high flap count causing suppression
  setBgpFlapCount(25);
  setBgpSuppressThreshold(2000);
  const suppressedMetrics = calculateBgpPeeringMetrics(state);
  assert.equal(suppressedMetrics.selectedPeer.isSuppressed, true);
  assert.equal(suppressedMetrics.selectedPeer.healthTier, 'Suppressed');
  assert.ok(suppressedMetrics.suppressedPeersCount >= 1);
  assert.ok(suppressedMetrics.totalDuesAtRisk >= 2500);
  assert.ok(suppressedMetrics.selectedPeer.minsUntilReuse > 0);

  resetBgpSimState();
});

test('renderBgpRoutingConvergenceSvg renders clean, accessible SVG for both compact and modal modes', () => {
  const metrics = calculateBgpPeeringMetrics({});

  // Compact mode
  const compactSvg = renderBgpRoutingConvergenceSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg'));
  assert.ok(compactSvg.includes('bgp-svg'));
  assert.ok(compactSvg.includes('FLAP PENALTY'));
  assert.ok(compactSvg.includes('CONVERGENCE'));
  assert.ok(compactSvg.includes('RPKI ROA'));
  assert.ok(compactSvg.includes('</svg>'));

  // Detailed mode
  const detailedSvg = renderBgpRoutingConvergenceSvg(metrics, { compact: false });
  assert.ok(detailedSvg.includes('<svg'));
  assert.ok(detailedSvg.includes('bgp-svg-detailed'));
  assert.ok(detailedSvg.includes('RFC 2439 Route Flap Penalty Decay Simulation'));
  assert.ok(detailedSvg.includes('SUPPRESS'));
  assert.ok(detailedSvg.includes('REUSE'));
  assert.ok(detailedSvg.includes('TCAM FIB ROUTE TABLE OCCUPANCY'));
  assert.ok(detailedSvg.includes('</svg>'));
});

test('generateBgpRoutingReport produces complete ASCII briefing text for NOC clipboard dispatch', () => {
  const metrics = calculateBgpPeeringMetrics({});
  const report = generateBgpRoutingReport(metrics, { referenceDate: '2026-10-16T12:00:00Z' });

  assert.ok(report.includes('SHAHDARA CORE IP BACKBONE BGP PEERING & FLAP DAMPING AUDIT BRIEFING'));
  assert.ok(report.includes('Local Border ASN: AS204555'));
  assert.ok(report.includes('FLAP DAMPING METRICS (RFC 2439)'));
  assert.ok(report.includes('ALL SHAHDARA BGP PEERS & CARRIERS REGISTER'));
  assert.ok(report.includes('OPERATIONAL MITIGATION ACTIONS'));
});

test('setupBgpRoutingModal wires DOM controls, sliders, buttons, and callbacks correctly', async () => {
  resetBgpSimState();

  let modalOpened = false;
  let openClickHandler = null;
  let closeClickHandler = null;
  let resetClickHandler = null;
  let flapInputHandler = null;
  let threshInputHandler = null;
  let peerChangeHandler = null;
  let filterAreaClickHandler = null;
  let copyClickHandler = null;

  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };

  const mockPeerSelect = {
    options: [],
    value: '',
    appendChild: function(opt) { this.options.push(opt); },
    onchange: null
  };

  const mockFlapSlider = { value: '2', oninput: null };
  const mockThreshSlider = { value: '2000', oninput: null };
  const mockFlapVal = { textContent: '' };
  const mockThreshVal = { textContent: '' };
  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const mockKpiPeerName = { textContent: '' };
  const mockKpiPenalty = { textContent: '' };
  const mockKpiConvergence = { textContent: '' };
  const mockKpiStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'dashboardBgpModal': return mockModal;
        case 'dashboardOpenBgpModalBtn': return { set onclick(fn) { openClickHandler = fn; } };
        case 'dashboardBgpModalCloseBtn': return { set onclick(fn) { closeClickHandler = fn; } };
        case 'bgpPeerSelect': return mockPeerSelect;
        case 'bgpFlapSlider': return mockFlapSlider;
        case 'bgpFlapVal': return mockFlapVal;
        case 'bgpThreshSlider': return mockThreshSlider;
        case 'bgpThreshVal': return mockThreshVal;
        case 'bgpResetSimBtn': return { set onclick(fn) { resetClickHandler = fn; } };
        case 'bgpModalChartWrap': return mockChartWrap;
        case 'bgpFilterAreaBtn': return { set onclick(fn) { filterAreaClickHandler = fn; } };
        case 'dashboardCopyBgpReportBtn': return { set onclick(fn) { copyClickHandler = fn; } };
        case 'bgpPeersTableBody': return mockTableBody;
        case 'bgpKpiPeerName': return mockKpiPeerName;
        case 'bgpKpiPenalty': return mockKpiPenalty;
        case 'bgpKpiConvergence': return mockKpiConvergence;
        case 'bgpStatusBadge': return mockKpiStatusBadge;
        case 'bgpKpiRevenueRisk': return mockKpiRevenueRisk;
        default: return null;
      }
    },
    createElement: (tag) => ({ tag, value: '', textContent: '', selected: false })
  };

  const state = { customers: [], bills: [] };

  try {
    setupBgpRoutingModal(state, {
      referenceDate: '2026-10-16',
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    // Verify peers populated
    assert.equal(mockPeerSelect.options.length, SHAHDARA_BGP_PEERS.length);

    // Open modal
    assert.ok(openClickHandler !== null);
    openClickHandler();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiPeerName.textContent.includes('AS133929'));
    assert.ok(mockChartWrap.innerHTML.includes('bgp-svg-detailed'));
    assert.ok(mockTableBody.innerHTML.includes('AS133929'));

    // Test flap slider input
    assert.ok(mockFlapSlider.oninput !== null);
    mockFlapSlider.value = '20';
    mockFlapSlider.oninput();
    assert.equal(getBgpFlapCount(), 20);
    assert.equal(mockFlapVal.textContent, '20 flaps');

    // Test threshold slider input
    assert.ok(mockThreshSlider.oninput !== null);
    mockThreshSlider.value = '3000';
    mockThreshSlider.oninput();
    assert.equal(getBgpSuppressThreshold(), 3000);
    assert.equal(mockThreshVal.textContent, '3000 pts');

    // Test reset
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getBgpFlapCount(), null);
    assert.equal(getBgpSuppressThreshold(), BGP_CONSTANTS.DEFAULT_SUPPRESS_THRESHOLD);

    // Test filter area action
    assert.ok(filterAreaClickHandler !== null);
    filterAreaClickHandler();
    assert.equal(filterAreaCalledWith, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyClickHandler !== null);
    await copyClickHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA CORE IP BACKBONE BGP PEERING & FLAP DAMPING AUDIT BRIEFING'));
    assert.equal(toastMessage, 'BGP routing and flap damping briefing copied to clipboard!');

    // Test close
    assert.ok(closeClickHandler !== null);
    closeClickHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('calculateZappingLatency calculates IGMP leave, join, keyframe GOP wait, and FCC acceleration', () => {
  const channel = SHAHDARA_IPTV_CHANNELS[0];

  // Test standard fast-leave with 1.5s GOP
  const fastResult = calculateZappingLatency(channel, { fastLeaveEnabled: true, gopSec: 1.5, fccAssist: false });
  assert.equal(fastResult.tLeave, IPTV_CONSTANTS.FAST_LEAVE_LATENCY_MS);
  assert.equal(fastResult.tJoin, 110);
  assert.equal(fastResult.tGop, 750); // (1.5 * 1000) / 2
  assert.equal(fastResult.tBuffer, 140);
  assert.equal(fastResult.rawZapMs, 45 + 110 + 750 + 140); // 1045 ms
  assert.equal(fastResult.totalZapMs, 1045);

  // Test query-timeout leave (fast leave disabled)
  const slowLeaveResult = calculateZappingLatency(channel, { fastLeaveEnabled: false, gopSec: 1.5, fccAssist: false });
  assert.equal(slowLeaveResult.tLeave, IPTV_CONSTANTS.QUERY_TIMEOUT_LEAVE_LATENCY_MS);
  assert.equal(slowLeaveResult.totalZapMs, 950 + 110 + 750 + 140); // 1950 ms

  // Test FCC acceleration enabled
  const fccResult = calculateZappingLatency(channel, { fastLeaveEnabled: true, gopSec: 1.5, fccAssist: true });
  assert.equal(fccResult.rawZapMs, 1045);
  assert.equal(fccResult.totalZapMs, Math.round(1045 * IPTV_CONSTANTS.FCC_ACCELERATION_FACTOR)); // 397 ms
});

test('IPTV simulation state getters, setters, and reset functionality work correctly', () => {
  resetIptvSimState();
  assert.equal(getIptvSelectedChannel(), SHAHDARA_IPTV_CHANNELS[0].id);
  assert.equal(getIptvFastLeaveEnabled(), true);
  assert.equal(getIptvGopSizeSec(), null);
  assert.equal(getIptvFccAssist(), false);

  setIptvSelectedChannel('iptv-ptv-03');
  assert.equal(getIptvSelectedChannel(), 'iptv-ptv-03');

  setIptvFastLeaveEnabled(false);
  assert.equal(getIptvFastLeaveEnabled(), false);

  setIptvGopSizeSec(2.5);
  assert.equal(getIptvGopSizeSec(), 2.5);

  // Bounds checking
  setIptvGopSizeSec(5.0);
  assert.equal(getIptvGopSizeSec(), 3.0);
  setIptvGopSizeSec(0.1);
  assert.equal(getIptvGopSizeSec(), 0.5);

  setIptvFccAssist(true);
  assert.equal(getIptvFccAssist(), true);

  resetIptvSimState();
  assert.equal(getIptvSelectedChannel(), SHAHDARA_IPTV_CHANNELS[0].id);
  assert.equal(getIptvFastLeaveEnabled(), true);
  assert.equal(getIptvGopSizeSec(), null);
  assert.equal(getIptvFccAssist(), false);
});

test('calculateIptvMulticastMetrics evaluates multicast channels, viewership, and subscriber exposure', () => {
  resetIptvSimState();

  const state = {
    customers: [
      { id: 'c1', name: 'Zahid Khan', area: 'Shahdara Town', isArchived: false },
      { id: 'c2', name: 'Farhan Ali', area: 'Baradari Road', isArchived: false },
      { id: 'c3', name: 'Tariq Mehmood', area: 'Vandala Road', isArchived: false }
    ],
    bills: [
      { customerId: 'c1', balance: 3000 },
      { customerId: 'c2', balance: 2500 },
      { customerId: 'c3', balance: 1800 }
    ]
  };

  const metrics = calculateIptvMulticastMetrics(state);
  assert.equal(metrics.totalChannels, SHAHDARA_IPTV_CHANNELS.length);
  assert.ok(metrics.totalActiveViewers >= 800);
  assert.ok(metrics.totalMulticastBandwidthMbps >= 30);
  assert.ok(metrics.avgZappingTimeMs > 0);

  const ch = metrics.selectedChannel;
  assert.equal(ch.id, SHAHDARA_IPTV_CHANNELS[0].id);
  assert.ok(ch.linkedSubscribers >= 1);
  assert.ok(ch.linkedDues >= 3000);

  // Test simulation causing slow zapping with query-timeout leave
  setIptvFastLeaveEnabled(false);
  const slowMetrics = calculateIptvMulticastMetrics(state);
  assert.ok(slowMetrics.degradedChannelsCount >= 1);
  assert.ok(slowMetrics.totalDuesAtRisk >= 3000);

  resetIptvSimState();
});

test('renderIptvMulticastSvg renders valid SVG for compact and modal displays', () => {
  const metrics = calculateIptvMulticastMetrics({});

  // Compact
  const compactSvg = renderIptvMulticastSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg'));
  assert.ok(compactSvg.includes('iptv-svg'));
  assert.ok(compactSvg.includes('AVG ZAPPING TIME'));
  assert.ok(compactSvg.includes('CONCURRENT VIEWERS'));
  assert.ok(compactSvg.includes('STREAM BITRATE'));
  assert.ok(compactSvg.includes('</svg>'));

  // Detailed
  const detailedSvg = renderIptvMulticastSvg(metrics, { compact: false });
  assert.ok(detailedSvg.includes('<svg'));
  assert.ok(detailedSvg.includes('iptv-svg-detailed'));
  assert.ok(detailedSvg.includes('Channel Change Latency Sequence Breakdown'));
  assert.ok(detailedSvg.includes('Fast Channel Change (FCC) Burst Assist'));
  assert.ok(detailedSvg.includes('OLT Multicast Bandwidth Distribution'));
  assert.ok(detailedSvg.includes('</svg>'));
});

test('generateIptvMulticastReport produces complete ASCII briefing text for NOC dispatch', () => {
  const metrics = calculateIptvMulticastMetrics({});
  const report = generateIptvMulticastReport(metrics, { referenceDate: '2026-10-16T12:00:00Z' });

  assert.ok(report.includes('SHAHDARA DOWNSTREAM IPTV MULTICAST & ZAPPING AUDIT BRIEFING'));
  assert.ok(report.includes('Total Multicast Channels:'));
  assert.ok(report.includes('ZAPPING LATENCY PIPELINE BREAKDOWN:'));
  assert.ok(report.includes('ALL SHAHDARA IPTV MULTICAST CHANNELS REGISTER:'));
  assert.ok(report.includes('OPERATIONAL MITIGATION ACTIONS:'));
});

test('setupIptvMulticastModal wires DOM controls, checkboxes, sliders, and callbacks correctly', async () => {
  resetIptvSimState();

  let modalOpened = false;
  let openClickHandler = null;
  let closeClickHandler = null;
  let resetClickHandler = null;
  let fastLeaveChangeHandler = null;
  let gopInputHandler = null;
  let fccChangeHandler = null;
  let channelChangeHandler = null;
  let filterAreaClickHandler = null;
  let copyClickHandler = null;

  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };

  const mockChannelSelect = {
    options: [],
    value: '',
    appendChild: function(opt) { this.options.push(opt); },
    onchange: null
  };

  const mockFastLeaveCheckbox = { checked: true, onchange: null };
  const mockGopSlider = { value: '1.5', oninput: null };
  const mockGopVal = { textContent: '' };
  const mockFccCheckbox = { checked: false, onchange: null };
  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const mockKpiChannelName = { textContent: '' };
  const mockKpiZappingTime = { textContent: '' };
  const mockKpiViewers = { textContent: '' };
  const mockKpiStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => {
      switch (id) {
        case 'dashboardIptvModal': return mockModal;
        case 'dashboardOpenIptvModalBtn': return { set onclick(fn) { openClickHandler = fn; } };
        case 'dashboardIptvModalCloseBtn': return { set onclick(fn) { closeClickHandler = fn; } };
        case 'iptvChannelSelect': return mockChannelSelect;
        case 'iptvFastLeaveCheckbox': return mockFastLeaveCheckbox;
        case 'iptvGopSlider': return mockGopSlider;
        case 'iptvGopVal': return mockGopVal;
        case 'iptvFccCheckbox': return mockFccCheckbox;
        case 'iptvResetSimBtn': return { set onclick(fn) { resetClickHandler = fn; } };
        case 'iptvModalChartWrap': return mockChartWrap;
        case 'iptvFilterAreaBtn': return { set onclick(fn) { filterAreaClickHandler = fn; } };
        case 'dashboardCopyIptvReportBtn': return { set onclick(fn) { copyClickHandler = fn; } };
        case 'iptvChannelsTableBody': return mockTableBody;
        case 'iptvKpiChannelName': return mockKpiChannelName;
        case 'iptvKpiZappingTime': return mockKpiZappingTime;
        case 'iptvKpiViewers': return mockKpiViewers;
        case 'iptvStatusBadge': return mockKpiStatusBadge;
        case 'iptvKpiRevenueRisk': return mockKpiRevenueRisk;
        default: return null;
      }
    },
    createElement: (tag) => ({ tag, value: '', textContent: '', selected: false })
  };

  const state = { customers: [], bills: [] };

  try {
    setupIptvMulticastModal(state, {
      referenceDate: '2026-10-16',
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    // Options populated
    assert.equal(mockChannelSelect.options.length, SHAHDARA_IPTV_CHANNELS.length);

    // Open modal
    assert.ok(openClickHandler !== null);
    openClickHandler();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiChannelName.textContent.includes('Geo'));
    assert.ok(mockChartWrap.innerHTML.includes('iptv-svg-detailed'));

    // Toggle fast leave
    assert.ok(mockFastLeaveCheckbox.onchange !== null);
    mockFastLeaveCheckbox.checked = false;
    mockFastLeaveCheckbox.onchange();
    assert.equal(getIptvFastLeaveEnabled(), false);

    // Change GOP
    assert.ok(mockGopSlider.oninput !== null);
    mockGopSlider.value = '2.0';
    mockGopSlider.oninput();
    assert.equal(getIptvGopSizeSec(), 2.0);
    assert.equal(mockGopVal.textContent, '2.0s');

    // Toggle FCC assist
    assert.ok(mockFccCheckbox.onchange !== null);
    mockFccCheckbox.checked = true;
    mockFccCheckbox.onchange();
    assert.equal(getIptvFccAssist(), true);

    // Test reset
    assert.ok(resetClickHandler !== null);
    resetClickHandler();
    assert.equal(getIptvFastLeaveEnabled(), true);
    assert.equal(getIptvGopSizeSec(), null);
    assert.equal(getIptvFccAssist(), false);

    // Test filter area action
    assert.ok(filterAreaClickHandler !== null);
    filterAreaClickHandler();
    assert.equal(filterAreaCalledWith, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Test copy briefing
    assert.ok(copyClickHandler !== null);
    await copyClickHandler();
    assert.ok(copiedText !== null);
    assert.ok(copiedText.includes('SHAHDARA DOWNSTREAM IPTV MULTICAST & ZAPPING AUDIT BRIEFING'));
    assert.equal(toastMessage, 'IPTV multicast and zapping briefing copied to clipboard!');

    // Test close
    assert.ok(closeClickHandler !== null);
    closeClickHandler();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('SHAHDARA_DNS_RESOLVERS, UPSTREAM_FORWARDERS, and DNS_CONSTANTS have valid topologies and parameters', () => {
  assert.ok(Array.isArray(SHAHDARA_DNS_RESOLVERS));
  assert.ok(SHAHDARA_DNS_RESOLVERS.length >= 6);

  for (const r of SHAHDARA_DNS_RESOLVERS) {
    assert.ok(r.id && typeof r.id === 'string');
    assert.ok(r.name && typeof r.name === 'string');
    assert.ok(r.ip && typeof r.ip === 'string');
    assert.ok(r.software && typeof r.software === 'string');
    assert.ok(r.primaryArea && typeof r.primaryArea === 'string');
    assert.ok(Array.isArray(r.aliasAreas));
    assert.ok(r.memoryCacheMb > 0);
    assert.ok(r.baseCacheHitRatioPct >= 70 && r.baseCacheHitRatioPct <= 95);
    assert.ok(r.qpsCapacity >= 10000);
    assert.ok(r.currentQps > 0 && r.currentQps <= r.qpsCapacity);
  }

  assert.ok(Array.isArray(UPSTREAM_FORWARDERS));
  assert.ok(UPSTREAM_FORWARDERS.length >= 5);
  for (const f of UPSTREAM_FORWARDERS) {
    assert.ok(f.id && typeof f.id === 'string');
    assert.ok(f.name && typeof f.name === 'string');
    assert.ok(f.primaryIp && typeof f.primaryIp === 'string');
    assert.ok(f.rttMs > 0 && f.rttMs < 50);
    assert.ok(f.reliabilityPct > 99);
  }

  assert.ok(DNS_CONSTANTS.CACHE_HIT_LATENCY_MS > 0);
  assert.ok(DNS_CONSTANTS.LOCAL_AUTH_LATENCY_MS > DNS_CONSTANTS.CACHE_HIT_LATENCY_MS);
  assert.ok(DNS_CONSTANTS.ITERATIVE_ROOT_LATENCY_MS > 50);
});

test('Edge DNS simulation state getters, setters, clamping, and reset work reliably', () => {
  resetDnsSimState();
  assert.equal(getDnsSelectedResolver(), 'dns-shd-01');
  assert.equal(getDnsCacheHitRatio(), null);
  assert.equal(getDnsUpstreamForwarder(), null);
  assert.equal(getDnssecMode(), 'strict');
  assert.equal(getDnsClockDriftMs(), null);

  // Set selected resolver
  setDnsSelectedResolver('dns-bar-02');
  assert.equal(getDnsSelectedResolver(), 'dns-bar-02');
  setDnsSelectedResolver('non-existent');
  assert.equal(getDnsSelectedResolver(), 'dns-bar-02');

  // Set cache hit ratio
  setDnsCacheHitRatio(92.4);
  assert.equal(getDnsCacheHitRatio(), 92.4);
  setDnsCacheHitRatio(150); // Clamped to 99
  assert.equal(getDnsCacheHitRatio(), 99);
  setDnsCacheHitRatio(10); // Clamped to 40
  assert.equal(getDnsCacheHitRatio(), 40);
  setDnsCacheHitRatio(null);
  assert.equal(getDnsCacheHitRatio(), null);

  // Set upstream forwarder
  setDnsUpstreamForwarder('goog-8888');
  assert.equal(getDnsUpstreamForwarder(), 'goog-8888');
  setDnsUpstreamForwarder('invalid-fwd');
  assert.equal(getDnsUpstreamForwarder(), 'goog-8888');
  setDnsUpstreamForwarder(null);
  assert.equal(getDnsUpstreamForwarder(), null);

  // Set DNSSEC mode
  setDnssecMode('permissive');
  assert.equal(getDnssecMode(), 'permissive');
  setDnssecMode('disabled');
  assert.equal(getDnssecMode(), 'disabled');
  setDnssecMode('invalid');
  assert.equal(getDnssecMode(), 'disabled');
  setDnssecMode('strict');
  assert.equal(getDnssecMode(), 'strict');

  // Set clock drift
  setDnsClockDriftMs(150000);
  assert.equal(getDnsClockDriftMs(), 150000);
  setDnsClockDriftMs(null);
  assert.equal(getDnsClockDriftMs(), null);

  // Reset
  setDnsSelectedResolver('dns-van-03');
  setDnsCacheHitRatio(90);
  setDnssecMode('disabled');
  resetDnsSimState();
  assert.equal(getDnsSelectedResolver(), 'dns-shd-01');
  assert.equal(getDnsCacheHitRatio(), null);
  assert.equal(getDnssecMode(), 'strict');
});

test('calculateDnsLatency calculates weighted response latency across cache, local auth, forwarder, and iterative root', () => {
  const result = calculateDnsLatency(90, 10.0);
  assert.ok(result.weightedLatencyMs > 0);
  assert.equal(result.hitRatioPct, 90);
  assert.equal(result.authRatioPct, 4);
  // High hit ratio should result in low weighted latency (< 5ms)
  assert.ok(result.weightedLatencyMs < 6.0);

  // Low hit ratio (50%) with high forwarder RTT (30ms) increases latency
  const lowHit = calculateDnsLatency(50, 30.0);
  assert.ok(lowHit.weightedLatencyMs > result.weightedLatencyMs);
  assert.ok(lowHit.weightedLatencyMs > 10.0);
});

test('calculateDnssecValidation properly models strict vs permissive vs disabled modes and clock drift impact', () => {
  // Normal clock drift (under 60s) in strict mode
  const normal = calculateDnssecValidation('strict', 250);
  assert.equal(normal.mode, 'strict');
  assert.equal(normal.clockInSync, true);
  assert.equal(normal.status, 'SECURE & OPTIMAL');
  assert.equal(normal.statusBadge, 'badge-success');
  assert.ok(normal.secureRatePct >= 99);
  assert.ok(normal.servfailRatePct <= 1.0);

  // Severe clock drift (240s = 240,000ms) exceeding 120s tolerance
  const drifted = calculateDnssecValidation('strict', 240000);
  assert.equal(drifted.clockInSync, false);
  assert.ok(drifted.bogusRatePct > 10.0);
  assert.equal(drifted.status, 'CRITICAL BOGUS FAILURES');
  assert.equal(drifted.statusBadge, 'badge-danger');
  assert.equal(drifted.servfailRatePct, drifted.bogusRatePct);

  // Permissive mode logs but does not drop with high SERVFAIL
  const permissive = calculateDnssecValidation('permissive', 240000);
  assert.equal(permissive.mode, 'permissive');
  assert.equal(permissive.status, 'PERMISSIVE (LOG ONLY)');
  assert.equal(permissive.statusBadge, 'badge-warning');
  assert.equal(permissive.servfailRatePct, 0.05);

  // Disabled mode
  const disabled = calculateDnssecValidation('disabled', 0);
  assert.equal(disabled.mode, 'disabled');
  assert.equal(disabled.status, 'DNSSEC DISABLED');
  assert.equal(disabled.statusBadge, 'badge-danger');
});

test('calculateDnsMetrics aggregates subscribers, revenues, and risk metrics correctly', () => {
  let state = createInitialState(['Sub 1', 'Sub 2', 'Sub 3']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].status = 'Active';
  state.customers[0].packagePrice = 2500;
  state.customers[0].bills = [{ month: '2026-10', dueAmount: 2500 }];

  state.customers[1].area = 'Baradari Road';
  state.customers[1].status = 'Active';
  state.customers[1].packagePrice = 3000;
  state.customers[1].bills = [{ month: '2026-10', dueAmount: 1500 }];

  state.customers[2].area = 'Vandala Road';
  state.customers[2].status = 'Offline';
  state.customers[2].packagePrice = 2000;
  state.customers[2].bills = [{ month: '2026-10', dueAmount: 2000 }];

  const metrics = calculateDnsMetrics(state);
  assert.ok(Array.isArray(metrics.resolvers));
  assert.equal(metrics.resolvers.length, SHAHDARA_DNS_RESOLVERS.length);
  assert.ok(metrics.selectedResolver);
  assert.ok(metrics.totalQps > 0);
  assert.ok(metrics.networkAvgLatencyMs > 0);
  assert.ok(metrics.networkAvgCacheHitPct > 0);

  const shd = metrics.resolvers.find(r => r.id === 'dns-shd-01');
  assert.ok(shd);
  assert.equal(shd.linkedSubscribers, 1);
  assert.equal(shd.activeSubscribers, 1);
  assert.equal(shd.duesAtRisk, 2500);
  assert.equal(shd.monthlyRevenue, 2500);

  const bar = metrics.resolvers.find(r => r.id === 'dns-bar-02');
  assert.ok(bar);
  assert.equal(bar.linkedSubscribers, 1);
  assert.equal(bar.duesAtRisk, 1500);
});

test('renderDnsDiagnosticsSvg renders compact and detailed SVG views cleanly', () => {
  let state = createInitialState(['Sub 1']);
  state.customers[0].area = 'Shahdara Town';
  const metrics = calculateDnsMetrics(state);

  const compactSvg = renderDnsDiagnosticsSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="dns-compact-svg"'));
  assert.ok(compactSvg.includes('CACHE HIT RATIO'));
  assert.ok(compactSvg.includes('RECURSIVE LATENCY'));
  assert.ok(compactSvg.includes('DNSSEC INTEGRITY'));

  const expandedSvg = renderDnsDiagnosticsSvg(metrics, { compact: false });
  assert.ok(expandedSvg.includes('<svg class="dns-expanded-svg"'));
  assert.ok(expandedSvg.includes('Recursive Query Latency'));
  assert.ok(expandedSvg.includes('DNSSEC Cryptographic Chain'));
  assert.ok(expandedSvg.includes('ROOT (.)'));
  assert.ok(expandedSvg.includes('TLD (.pk / .com)'));
  assert.ok(expandedSvg.includes('ZONE DNSKEY'));
});

test('generateDnsDiagnosticReport formats clear executive NOC report', () => {
  let state = createInitialState(['Shahdara User']);
  state.customers[0].area = 'Shahdara Town';
  const metrics = calculateDnsMetrics(state);

  const report = generateDnsDiagnosticReport(metrics, { referenceDate: '2026-10-16T12:00:00Z' });
  assert.ok(report.includes('SHAHDARA EDGE DNS RESOLVERS & DNSSEC VALIDATION AUDIT BRIEFING'));
  assert.ok(report.includes('Total Active Resolvers:'));
  assert.ok(report.includes('RECURSIVE QUERY RESPONSE LATENCY BREAKDOWN'));
  assert.ok(report.includes('DNSSEC CRYPTOGRAPHIC VALIDATION & INTEGRITY'));
  assert.ok(report.includes('SUBSCRIBER QoE & BUSINESS IMPACT'));
});

test('setupDnsDiagnosticsModal attaches event handlers and handles interactions seamlessly', async () => {
  let state = createInitialState(['Shahdara Client']);
  state.customers[0].area = 'Shahdara Town';

  const originalDocument = globalThis.document;
  let modalOpened = false;
  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  const mockResolverSelect = { options: [], value: 'dns-shd-01', innerHTML: '', onchange: null };
  const mockForwarderSelect = { options: [], value: 'cf-1111', innerHTML: '', onchange: null };
  const mockCacheSlider = { value: '88.5', oninput: null };
  const mockCacheVal = { textContent: '' };
  const mockDnssecSelect = { value: 'strict', onchange: null };
  const mockDriftSlider = { value: '0', oninput: null };
  const mockDriftVal = { textContent: '' };
  const mockResetBtn = { onclick: null };

  const mockKpiNodeName = { textContent: '' };
  const mockKpiLatency = { textContent: '' };
  const mockKpiDnssec = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };

  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };

  const elementsMap = {
    'dashboardDnsModal': mockModal,
    'dashboardOpenDnsModalBtn': mockOpenBtn,
    'dashboardDnsModalCloseBtn': mockCloseBtn,
    'dnsResolverSelect': mockResolverSelect,
    'dnsForwarderSelect': mockForwarderSelect,
    'dnsCacheSlider': mockCacheSlider,
    'dnsCacheVal': mockCacheVal,
    'dnssecModeSelect': mockDnssecSelect,
    'dnsClockDriftSlider': mockDriftSlider,
    'dnsClockDriftVal': mockDriftVal,
    'dnsResetSimBtn': mockResetBtn,
    'dnsKpiNodeName': mockKpiNodeName,
    'dnsKpiLatency': mockKpiLatency,
    'dnsKpiDnssec': mockKpiDnssec,
    'dnsStatusBadge': mockStatusBadge,
    'dnsKpiRevenueRisk': mockKpiRevenueRisk,
    'dnsModalChartWrap': mockChartWrap,
    'dnsResolversTableBody': mockTableBody,
    'dnsFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyDnsReportBtn': mockCopyReportBtn
  };

  globalThis.document = {
    getElementById: (id) => elementsMap[id] || null
  };

  try {
    setupDnsDiagnosticsModal(state, {
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });


    // Verify open button hooked
    assert.ok(mockOpenBtn.onclick !== null);
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiNodeName.textContent.includes('10.42.1.2'));
    assert.ok(mockChartWrap.innerHTML.includes('dns-expanded-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Shahdara Town'));

    // Change resolver
    assert.ok(mockResolverSelect.onchange !== null);
    mockResolverSelect.onchange({ target: { value: 'dns-bar-02' } });
    assert.equal(getDnsSelectedResolver(), 'dns-bar-02');
    assert.ok(mockKpiNodeName.textContent.includes('10.42.2.2'));

    // Change forwarder
    assert.ok(mockForwarderSelect.onchange !== null);
    mockForwarderSelect.onchange({ target: { value: 'goog-8888' } });
    assert.equal(getDnsUpstreamForwarder(), 'goog-8888');

    // Change cache slider
    assert.ok(mockCacheSlider.oninput !== null);
    mockCacheSlider.oninput({ target: { value: '95' } });
    assert.equal(getDnsCacheHitRatio(), 95);
    assert.equal(mockCacheVal.textContent, '95%');

    // Change DNSSEC mode
    assert.ok(mockDnssecSelect.onchange !== null);
    mockDnssecSelect.onchange({ target: { value: 'permissive' } });
    assert.equal(getDnssecMode(), 'permissive');

    // Change clock drift slider
    assert.ok(mockDriftSlider.oninput !== null);
    mockDriftSlider.oninput({ target: { value: '150000' } });
    assert.equal(getDnsClockDriftMs(), 150000);
    assert.equal(mockDriftVal.textContent, '+150000 ms');

    // Reset simulation
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getDnsSelectedResolver(), 'dns-shd-01');
    assert.equal(getDnsCacheHitRatio(), null);
    assert.equal(getDnssecMode(), 'strict');

    // Filter area
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaCalledWith, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(toastMessage.includes('DNS Diagnostic Briefing'));

    // Close modal
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetDnsSimState();
  }
});

test('SHAHDARA_DWDM_CHANNELS and DWDM_CONSTANTS have valid optical parameters and channel definitions', () => {
  assert.ok(Array.isArray(SHAHDARA_DWDM_CHANNELS));
  assert.ok(SHAHDARA_DWDM_CHANNELS.length >= 6);

  for (const ch of SHAHDARA_DWDM_CHANNELS) {
    assert.ok(ch.id && typeof ch.id === 'string');
    assert.ok(ch.channelNumber >= 20 && ch.channelNumber <= 60);
    assert.ok(ch.wavelengthNm >= 1520 && ch.wavelengthNm <= 1570);
    assert.ok(ch.frequencyThz >= 190.0 && ch.frequencyThz <= 196.0);
    assert.ok(ch.transponderModel && typeof ch.transponderModel === 'string');
    assert.ok(ch.primaryArea && typeof ch.primaryArea === 'string');
    assert.ok(Array.isArray(ch.aliasAreas));
    assert.ok(ch.bitrateGbps >= 100);
    assert.ok(ch.spanLengthKm > 0);
    assert.ok(ch.baseFiberLossDbPerKm >= 0.18 && ch.baseFiberLossDbPerKm <= 0.35);
    assert.ok(ch.baseEdfaNfDb >= 4.0 && ch.baseEdfaNfDb <= 7.0);
    assert.ok(ch.baseSpansCount >= 1);
    assert.ok(ch.sdFecThresholdDb >= 11.0 && ch.sdFecThresholdDb <= 16.0);
  }

  assert.ok(DWDM_CONSTANTS.STANDARD_CHROMATIC_DISPERSION_PS_PER_NM_KM > 15.0);
  assert.ok(DWDM_CONSTANTS.OPTIMAL_MARGIN_MIN_DB >= 3.0);
  assert.ok(DWDM_CONSTANTS.MARGINAL_MARGIN_MIN_DB >= 1.0);
});

test('DWDM simulation state getters, setters, clamping, and reset work as intended', () => {
  resetDwdmSimState();
  assert.equal(getDwdmSelectedChannel(), 'dwdm-ch-21');
  assert.equal(getDwdmFiberLossCoeff(), null);
  assert.equal(getDwdmEdfaNoiseFigure(), null);
  assert.equal(getDwdmSpanCount(), null);

  // Set selected channel
  setDwdmSelectedChannel('dwdm-ch-28');
  assert.equal(getDwdmSelectedChannel(), 'dwdm-ch-28');
  setDwdmSelectedChannel('invalid-id');
  assert.equal(getDwdmSelectedChannel(), 'dwdm-ch-28');

  // Set fiber loss coefficient
  setDwdmFiberLossCoeff(0.28);
  assert.equal(getDwdmFiberLossCoeff(), 0.28);
  setDwdmFiberLossCoeff(0.99); // Clamped to 0.45
  assert.equal(getDwdmFiberLossCoeff(), 0.45);
  setDwdmFiberLossCoeff(0.05); // Clamped to 0.18
  assert.equal(getDwdmFiberLossCoeff(), 0.18);
  setDwdmFiberLossCoeff(null);
  assert.equal(getDwdmFiberLossCoeff(), null);

  // Set EDFA noise figure
  setDwdmEdfaNoiseFigure(6.2);
  assert.equal(getDwdmEdfaNoiseFigure(), 6.2);
  setDwdmEdfaNoiseFigure(15.0); // Clamped to 9.5
  assert.equal(getDwdmEdfaNoiseFigure(), 9.5);
  setDwdmEdfaNoiseFigure(1.0); // Clamped to 3.5
  assert.equal(getDwdmEdfaNoiseFigure(), 3.5);
  setDwdmEdfaNoiseFigure(null);
  assert.equal(getDwdmEdfaNoiseFigure(), null);

  // Set span count
  setDwdmSpanCount(4);
  assert.equal(getDwdmSpanCount(), 4);
  setDwdmSpanCount(12); // Clamped to 6
  assert.equal(getDwdmSpanCount(), 6);
  setDwdmSpanCount(0); // Clamped to 1
  assert.equal(getDwdmSpanCount(), 1);
  setDwdmSpanCount(null);
  assert.equal(getDwdmSpanCount(), null);

  // Reset
  setDwdmSelectedChannel('dwdm-ch-42');
  setDwdmFiberLossCoeff(0.30);
  resetDwdmSimState();
  assert.equal(getDwdmSelectedChannel(), 'dwdm-ch-21');
  assert.equal(getDwdmFiberLossCoeff(), null);
});

test('calculateOsnrBudget computes accurate single and multi-span OSNR and SD-FEC margin', () => {
  // Typical single-span link: Launch +2 dBm, Span loss 6.5 dB, NF 5.2 dB, 1 span, FEC limit 12.8 dB
  const single = calculateOsnrBudget(2.0, 6.5, 5.2, 1, { sdFecThresholdDb: 12.8 });
  assert.equal(single.singleSpanOsnrDb, 48.3);
  assert.equal(single.accumulatedOsnrDb, 48.3);
  assert.ok(single.fecMarginDb > 30);
  assert.equal(single.healthTier, 'OPTIMAL');
  assert.equal(single.healthClass, 'badge-success');

  // Multi-span link: 4 spans with cascaded noise
  const multi = calculateOsnrBudget(2.0, 6.5, 5.2, 4, { sdFecThresholdDb: 12.8 });
  // 10*log10(4) = ~6.02 dB degradation
  assert.ok(multi.accumulatedOsnrDb < single.accumulatedOsnrDb);
  assert.equal(Math.round(single.accumulatedOsnrDb - multi.accumulatedOsnrDb), 6);

  // Severe loss / low margin condition
  const degraded = calculateOsnrBudget(0.0, 32.0, 9.0, 4, { sdFecThresholdDb: 12.8 });
  assert.ok(degraded.fecMarginDb < 2.0);
  assert.ok(degraded.healthTier.includes('CRITICAL') || degraded.healthTier.includes('MARGINAL'));
});

test('calculateDwdmMetrics aggregates subscribers, chromatic dispersion, and portfolio exposure', () => {
  let state = createInitialState(['Trans Sub 1', 'Trans Sub 2']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].status = 'Active';
  state.customers[0].packagePrice = 3000;
  state.customers[0].bills = [{ month: '2026-10', dueAmount: 3000 }];

  state.customers[1].area = 'Baradari Road';
  state.customers[1].status = 'Active';
  state.customers[1].packagePrice = 4000;
  state.customers[1].bills = [{ month: '2026-10', dueAmount: 2000 }];

  const metrics = calculateDwdmMetrics(state);
  assert.ok(Array.isArray(metrics.channels));
  assert.equal(metrics.channels.length, SHAHDARA_DWDM_CHANNELS.length);
  assert.ok(metrics.selectedChannel);
  assert.ok(metrics.totalBandwidthGbps >= 800);
  assert.ok(metrics.networkAvgOsnrDb > 0);
  assert.ok(metrics.networkAvgMarginDb > 0);

  const ch21 = metrics.channels.find(c => c.id === 'dwdm-ch-21');
  assert.ok(ch21);
  assert.equal(ch21.linkedSubscribers, 1);
  assert.equal(ch21.activeSubscribers, 1);
  assert.equal(ch21.duesAtRisk, 3000);
  assert.equal(ch21.monthlyRevenue, 3000);
  assert.ok(ch21.accumulatedCdPsPerNm > 0);
  assert.ok(ch21.cdCompensationPct > 0 && ch21.cdCompensationPct <= 100);
});

test('renderDwdmBudgetSvg renders compact gauge and expanded waterfall views', () => {
  let state = createInitialState(['Sub']);
  state.customers[0].area = 'Shahdara Town';
  const metrics = calculateDwdmMetrics(state);

  const compactSvg = renderDwdmBudgetSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="dwdm-compact-svg"'));
  assert.ok(compactSvg.includes('SD-FEC MARGIN'));
  assert.ok(compactSvg.includes('ACCUMULATED OSNR'));
  assert.ok(compactSvg.includes('ITU GRID CHANNEL'));

  const expandedSvg = renderDwdmBudgetSvg(metrics, { compact: false });
  assert.ok(expandedSvg.includes('<svg class="dwdm-expanded-svg"'));
  assert.ok(expandedSvg.includes('Optical Link Budget &amp; Cascaded EDFA ASE Waterfall'));
  assert.ok(expandedSvg.includes('Coherent DSP &amp; Chromatic Dispersion Compensation'));
  assert.ok(expandedSvg.includes('FEC Limit'));
});

test('generateDwdmReport produces comprehensive plain text diagnostic brief', () => {
  let state = createInitialState(['Shahdara Trunk User']);
  state.customers[0].area = 'Shahdara Town';
  const metrics = calculateDwdmMetrics(state);

  const report = generateDwdmReport(metrics, { referenceDate: '2026-10-16T12:00:00Z' });
  assert.ok(report.includes('SHAHDARA DWDM OPTICAL CHANNEL TRANSPONDER OSNR AUDIT BRIEFING'));
  assert.ok(report.includes('Total Active DWDM Channels:'));
  assert.ok(report.includes('OPTICAL SIGNAL-TO-NOISE RATIO (OSNR) & LINK BUDGET'));
  assert.ok(report.includes('CHROMATIC DISPERSION (CD) & DSP COMPENSATION'));
  assert.ok(report.includes('SUBSCRIBER QoE & AGGREGATE REVENUE EXPOSURE'));
});

test('setupDwdmModal hooks all UI elements, controls, and callbacks properly', async () => {
  let state = createInitialState(['DWDM Client']);
  state.customers[0].area = 'Shahdara Town';

  const originalDocument = globalThis.document;
  let modalOpened = false;
  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  const mockChannelSelect = { options: [], value: 'dwdm-ch-21', innerHTML: '', onchange: null };
  const mockLossSlider = { value: '0.22', oninput: null };
  const mockLossVal = { textContent: '' };
  const mockNfSlider = { value: '5.2', oninput: null };
  const mockNfVal = { textContent: '' };
  const mockSpansSlider = { value: '2', oninput: null };
  const mockSpansVal = { textContent: '' };
  const mockResetBtn = { onclick: null };

  const mockKpiChannelName = { textContent: '' };
  const mockKpiOsnr = { textContent: '' };
  const mockKpiMargin = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };

  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };

  const elementsMap = {
    'dashboardDwdmModal': mockModal,
    'dashboardOpenDwdmModalBtn': mockOpenBtn,
    'dashboardDwdmModalCloseBtn': mockCloseBtn,
    'dwdmChannelSelect': mockChannelSelect,
    'dwdmFiberLossSlider': mockLossSlider,
    'dwdmFiberLossVal': mockLossVal,
    'dwdmEdfaNfSlider': mockNfSlider,
    'dwdmEdfaNfVal': mockNfVal,
    'dwdmSpansSlider': mockSpansSlider,
    'dwdmSpansVal': mockSpansVal,
    'dwdmResetSimBtn': mockResetBtn,
    'dwdmKpiChannelName': mockKpiChannelName,
    'dwdmKpiOsnr': mockKpiOsnr,
    'dwdmKpiMargin': mockKpiMargin,
    'dwdmStatusBadge': mockStatusBadge,
    'dwdmKpiRevenueRisk': mockKpiRevenueRisk,
    'dwdmModalChartWrap': mockChartWrap,
    'dwdmChannelsTableBody': mockTableBody,
    'dwdmFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyDwdmReportBtn': mockCopyReportBtn
  };

  globalThis.document = {
    getElementById: (id) => elementsMap[id] || null
  };

  try {
    setupDwdmModal(state, {
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    // Test open
    assert.ok(mockOpenBtn.onclick !== null);
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiChannelName.textContent.includes('Ch 21'));
    assert.ok(mockChartWrap.innerHTML.includes('dwdm-expanded-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Shahdara Town'));

    // Change channel
    assert.ok(mockChannelSelect.onchange !== null);
    mockChannelSelect.onchange({ target: { value: 'dwdm-ch-28' } });
    assert.equal(getDwdmSelectedChannel(), 'dwdm-ch-28');
    assert.ok(mockKpiChannelName.textContent.includes('Ch 28'));

    // Change loss slider
    assert.ok(mockLossSlider.oninput !== null);
    mockLossSlider.oninput({ target: { value: '0.28' } });
    assert.equal(getDwdmFiberLossCoeff(), 0.28);
    assert.equal(mockLossVal.textContent, '0.28 dB/km');

    // Change NF slider
    assert.ok(mockNfSlider.oninput !== null);
    mockNfSlider.oninput({ target: { value: '6.5' } });
    assert.equal(getDwdmEdfaNoiseFigure(), 6.5);
    assert.equal(mockNfVal.textContent, '6.5 dB');

    // Change spans slider
    assert.ok(mockSpansSlider.oninput !== null);
    mockSpansSlider.oninput({ target: { value: '4' } });
    assert.equal(getDwdmSpanCount(), 4);
    assert.equal(mockSpansVal.textContent, '4 spans');

    // Reset simulation
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getDwdmSelectedChannel(), 'dwdm-ch-21');
    assert.equal(getDwdmFiberLossCoeff(), null);
    assert.equal(getDwdmEdfaNoiseFigure(), null);

    // Filter area
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaCalledWith, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(toastMessage.includes('DWDM OSNR Diagnostic Briefing'));
    assert.ok(copiedText.includes('SHAHDARA DWDM OPTICAL CHANNEL TRANSPONDER OSNR AUDIT BRIEFING'));

    // Close modal
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetDwdmSimState();
  }
});

test('calculateOpticalRttMicroseconds computes accurate round-trip time in silica fiber', () => {
  const rtt20km = calculateOpticalRttMicroseconds(20.0);
  // Speed in silica ~ 204,190 km/s -> 20 km one-way = ~97.94 µs -> RTT = ~195.89 µs
  assert.ok(rtt20km > 190 && rtt20km < 200, `Expected ~196µs, got ${rtt20km}`);

  const rtt0km = calculateOpticalRttMicroseconds(0);
  assert.equal(rtt0km, 0);
});

test('calculateOscLinkBudget calculates attenuation, Rx power, link margin, and health status', () => {
  const coreLink = SHAHDARA_OSC_LINKS.find(l => l.id === 'osc-link-1510-core');
  assert.ok(coreLink);

  const normalBudget = calculateOscLinkBudget(coreLink, {
    fiberLossDelta: 0.0,
    spliceLossDelta: 0.0,
    loopbackMode: OSC_CONSTANTS.LOOPBACK_MODES.NORMAL
  });

  // Base fiber loss: 28.5 * 0.24 = 6.84 dB
  // Base splice loss: 0.50 dB
  // Filter loss: 2.4 dB, connector: 0.5 dB
  // Total attenuation: 6.84 + 0.50 + 2.4 + 0.5 = 10.24 dB
  // Tx: +3.0 dBm -> Rx: 3.0 - 10.24 = -7.24 dBm
  // Sens: -38.0 dBm -> Margin: -7.24 - (-38.0) = +30.76 dB
  assert.equal(normalBudget.spanLengthKm, 28.5);
  assert.equal(normalBudget.status, 'OPTIMAL');
  assert.equal(normalBudget.badgeClass, 'badge-success');
  assert.ok(normalBudget.linkMarginDb > 25.0);
  assert.equal(normalBudget.berExponent, -13);
  assert.equal(normalBudget.loopbackActive, false);
  assert.equal(normalBudget.loopbackMode, 'NORMAL');

  // Extreme attenuation simulation (degradation)
  const degradedBudget = calculateOscLinkBudget(coreLink, {
    fiberLossDelta: 0.45, // 0.24 + 0.45 = 0.69 dB/km -> 28.5 * 0.69 = 19.665 dB
    spliceLossDelta: 10.0, // +10 dB splice damage
    loopbackMode: OSC_CONSTANTS.LOOPBACK_MODES.FACILITY
  });

  assert.ok(degradedBudget.totalAttenuationDb > 30.0);
  assert.ok(degradedBudget.linkMarginDb < normalBudget.linkMarginDb);
  assert.equal(degradedBudget.loopbackActive, true);
  assert.equal(degradedBudget.loopbackMode, 'FACILITY');
});

test('calculateOscMetrics evaluates aggregate network telemetry and subscriber risk', () => {
  let state = createInitialState(['Sub Core 1', 'Sub Core 2', 'Sub Vandala', 'Sub Unrelated']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].packagePrice = 2500;
  state.customers[1].area = 'Railway Road';
  state.customers[1].packagePrice = 3000;
  state.customers[2].area = 'Vandala Road';
  state.customers[2].packagePrice = 2000;
  state.customers[3].area = 'NonExistentArea';
  state.customers[3].packagePrice = 1500;

  // Add bill and unpaid balance for Sub Core 1
  state.customers[0].bills = [{
    id: 'b-core-1',
    customerId: state.customers[0].id,
    serviceMonth: '2026-10',
    amount: 2500,
    timestamp: '2026-10-01T00:00:00Z'
  }];



  const metrics = calculateOscMetrics(state);
  assert.equal(metrics.totalLinks, 6);
  assert.ok(metrics.totalSpanKm > 100);
  assert.ok(metrics.selectedLink !== null);
  assert.ok(metrics.allLinks.length === 6);

  // Link 1 (Shahdara Town + Railway Road) should match Sub Core 1 and Sub Core 2
  const coreLinkMetrics = metrics.allLinks.find(l => l.id === 'osc-link-1510-core');
  assert.ok(coreLinkMetrics);
  assert.equal(coreLinkMetrics.matchingCount, 2);
  assert.equal(coreLinkMetrics.totalBilledRevenue, 5500);
  assert.ok(coreLinkMetrics.totalOutstandingDues >= 2500);
});

test('OSC simulation state getters, setters, and clamp limits function properly', () => {
  resetOscSimState();
  assert.equal(getOscSelectedLink(), 'osc-link-1510-core');
  assert.equal(getOscFiberLossDelta(), 0.0);
  assert.equal(getOscSpliceLossDelta(), 0.0);
  assert.equal(getOscLoopbackMode(), 'NORMAL');

  setOscSelectedLink('osc-link-1610-vandala');
  assert.equal(getOscSelectedLink(), 'osc-link-1610-vandala');

  // Ignored if invalid ID
  setOscSelectedLink('invalid-link-id');
  assert.equal(getOscSelectedLink(), 'osc-link-1610-vandala');

  setOscFiberLossDelta(0.25);
  assert.equal(getOscFiberLossDelta(), 0.25);
  setOscFiberLossDelta(1.50); // should clamp to 0.50
  assert.equal(getOscFiberLossDelta(), 0.50);

  setOscSpliceLossDelta(4.5);
  assert.equal(getOscSpliceLossDelta(), 4.5);
  setOscSpliceLossDelta(25.0); // should clamp to 10.0
  assert.equal(getOscSpliceLossDelta(), 10.0);

  setOscLoopbackMode(OSC_CONSTANTS.LOOPBACK_MODES.PRBS31);
  assert.equal(getOscLoopbackMode(), 'PRBS31');

  resetOscSimState();
  assert.equal(getOscSelectedLink(), 'osc-link-1510-core');
  assert.equal(getOscFiberLossDelta(), 0.0);
  assert.equal(getOscSpliceLossDelta(), 0.0);
  assert.equal(getOscLoopbackMode(), 'NORMAL');
});

test('renderOscTelemetrySvg produces valid SVG markup for compact and expanded modes', () => {
  let state = createInitialState(['Sub']);
  state.customers[0].area = 'Shahdara Town';
  const metrics = calculateOscMetrics(state);

  const compactSvg = renderOscTelemetrySvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="osc-compact-svg"'));
  assert.ok(compactSvg.includes('OPTICAL RX POWER'));
  assert.ok(compactSvg.includes('OPTICAL MARGIN'));
  assert.ok(compactSvg.includes('ESTIMATED BER'));
  assert.ok(compactSvg.includes('OSC-1510'));

  const expandedSvg = renderOscTelemetrySvg(metrics, { compact: false });
  assert.ok(expandedSvg.includes('<svg class="osc-expanded-svg"'));
  assert.ok(expandedSvg.includes('OPTICAL SPECTRUM ISOLATION'));
  assert.ok(expandedSvg.includes('TRANSPONDER SCHEMATIC &amp; REMOTE LOOPBACK STATE'));
  assert.ok(expandedSvg.includes('OPTICAL LOSS BUDGET WATERFALL'));
  assert.ok(expandedSvg.includes('RECEIVER POWER vs SENSITIVITY FLOOR'));
  assert.ok(expandedSvg.includes('NEAR-END NODE'));
  assert.ok(expandedSvg.includes('FAR-END NODE'));
});

test('generateOscReport produces comprehensive plain text diagnostic brief', () => {
  let state = createInitialState(['Core Subscriber']);
  state.customers[0].area = 'Shahdara Town';
  const metrics = calculateOscMetrics(state);

  const report = generateOscReport(metrics, { referenceDate: '2026-10-16T12:00:00Z' });
  assert.ok(report.includes('SHAHDARA OPTICAL SUPERVISORY CHANNEL (OSC) & LOOPBACK AUDIT BRIEFING'));
  assert.ok(report.includes('NETWORK FLEET SUMMARY'));
  assert.ok(report.includes('AUDITED LINK TELEMETRY DETAILS'));
  assert.ok(report.includes('OPTICAL POWER BUDGET & ATTENUATION'));
  assert.ok(report.includes('DIAGNOSTIC LOOPBACK & SUBSCRIBER EXPOSURE'));
  assert.ok(report.includes('RECOMMENDED FIELD ACTIONS:'));
});

test('setupOscModal hooks all UI elements, controls, and callbacks properly', async () => {
  let state = createInitialState(['OSC Test Client']);
  state.customers[0].area = 'Shahdara Town';

  let modalOpened = false;
  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };
  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };

  const mockLinkSelect = { options: [], value: 'osc-link-1510-core', innerHTML: '', onchange: null };
  const mockLoopbackSelect = { options: [], value: 'NORMAL', innerHTML: '', onchange: null };
  const mockFiberLossSlider = { value: '0.00', oninput: null };
  const mockFiberLossVal = { textContent: '' };
  const mockSpliceLossSlider = { value: '0.0', oninput: null };
  const mockSpliceLossVal = { textContent: '' };
  const mockResetBtn = { onclick: null };

  const mockKpiLinkName = { textContent: '' };
  const mockKpiRxPower = { textContent: '' };
  const mockKpiMargin = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };

  const elementsMap = {
    'dashboardOscModal': mockModal,
    'dashboardOpenOscModalBtn': mockOpenBtn,
    'dashboardOscModalCloseBtn': mockCloseBtn,
    'oscLinkSelect': mockLinkSelect,
    'oscLoopbackModeSelect': mockLoopbackSelect,
    'oscFiberLossSlider': mockFiberLossSlider,
    'oscFiberLossVal': mockFiberLossVal,
    'oscSpliceLossSlider': mockSpliceLossSlider,
    'oscSpliceLossVal': mockSpliceLossVal,
    'oscResetSimBtn': mockResetBtn,
    'oscKpiLinkName': mockKpiLinkName,
    'oscKpiRxPower': mockKpiRxPower,
    'oscKpiMargin': mockKpiMargin,
    'oscStatusBadge': mockStatusBadge,
    'oscKpiRevenueRisk': mockKpiRevenueRisk,
    'oscModalChartWrap': mockChartWrap,
    'oscLinksTableBody': mockTableBody,
    'oscFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyOscReportBtn': mockCopyReportBtn
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementsMap[id] || null
  };

  try {
    setupOscModal(state, {
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (text) => { copiedText = text; }
      }
    });

    // Open modal
    assert.ok(mockOpenBtn.onclick !== null);
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiLinkName.textContent.includes('OSC-1510'));
    assert.ok(mockChartWrap.innerHTML.includes('osc-expanded-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Shahdara Town Core'));

    // Change link
    assert.ok(mockLinkSelect.onchange !== null);
    mockLinkSelect.onchange({ target: { value: 'osc-link-1610-vandala' } });
    assert.equal(getOscSelectedLink(), 'osc-link-1610-vandala');
    assert.ok(mockKpiLinkName.textContent.includes('Vandala'));

    // Change loopback mode
    assert.ok(mockLoopbackSelect.onchange !== null);
    mockLoopbackSelect.onchange({ target: { value: 'TERMINAL' } });
    assert.equal(getOscLoopbackMode(), 'TERMINAL');

    // Change fiber loss slider
    assert.ok(mockFiberLossSlider.oninput !== null);
    mockFiberLossSlider.oninput({ target: { value: '0.12' } });
    assert.equal(getOscFiberLossDelta(), 0.12);
    assert.equal(mockFiberLossVal.textContent, '+0.12 dB/km');

    // Change splice loss slider
    assert.ok(mockSpliceLossSlider.oninput !== null);
    mockSpliceLossSlider.oninput({ target: { value: '1.4' } });
    assert.equal(getOscSpliceLossDelta(), 1.4);
    assert.equal(mockSpliceLossVal.textContent, '+1.40 dB');

    // Reset button
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getOscSelectedLink(), 'osc-link-1510-core');
    assert.equal(getOscFiberLossDelta(), 0.0);
    assert.equal(getOscSpliceLossDelta(), 0.0);
    assert.equal(getOscLoopbackMode(), 'NORMAL');

    // Filter area
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaCalledWith, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(toastMessage.includes('OSC Telemetry Briefing'));
    assert.ok(copiedText.includes('SHAHDARA OPTICAL SUPERVISORY CHANNEL (OSC) & LOOPBACK AUDIT BRIEFING'));

    // Close modal
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetOscSimState();
  }
});

test('calculateTrunkLacpMetrics evaluates nominal/operational capacity, saturation, and failover', () => {
  const coreTrunk = SHAHDARA_QINQ_TRUNKS.find(t => t.id === 'lacp-trunk-core-agg');
  assert.ok(coreTrunk);

  // Normal baseline state
  const normal = calculateTrunkLacpMetrics(coreTrunk, {
    trafficSurgeGbps: 0.0,
    failedMembersCount: 0
  });

  assert.equal(normal.totalMembers, 4);
  assert.equal(normal.activeMembers, 4);
  assert.equal(normal.nominalCapacityGbps, 40);
  assert.equal(normal.operationalCapacityGbps, 40);
  assert.equal(normal.effectiveTrafficGbps, 24.5);
  // 24.5 / 40 = 61.25% -> rounded to 61.3%
  assert.equal(normal.saturationPct, 61.3);
  assert.equal(normal.healthStatus, 'OPTIMAL');
  assert.equal(normal.badgeClass, 'badge-success');
  assert.equal(normal.packetLossEstPct, 0.0);
  assert.equal(normal.memberLinks.length, 4);
  assert.ok(normal.memberLinks.every(l => l.isActive));

  // High load simulation (surge +10 Gbps -> 34.5 Gbps -> 86.25% saturation)
  const surge = calculateTrunkLacpMetrics(coreTrunk, {
    trafficSurgeGbps: 10.0,
    failedMembersCount: 0
  });
  assert.equal(surge.effectiveTrafficGbps, 34.5);
  assert.equal(surge.saturationPct, 86.3);
  assert.equal(surge.healthStatus, 'HIGH UTILIZATION');
  assert.equal(surge.badgeClass, 'badge-warning');

  // Severe failover scenario (2 links down -> capacity drops to 20 Gbps; 24.5G load -> 122.5% saturation)
  const failover = calculateTrunkLacpMetrics(coreTrunk, {
    trafficSurgeGbps: 0.0,
    failedMembersCount: 2
  });
  assert.equal(failover.activeMembers, 2);
  assert.equal(failover.operationalCapacityGbps, 20);
  assert.equal(failover.saturationPct, 122.5);
  assert.equal(failover.healthStatus, 'SATURATED / DROPPING');
  assert.equal(failover.badgeClass, 'badge-danger');
  assert.ok(failover.packetLossEstPct > 0);
  assert.equal(failover.memberLinks.filter(l => !l.isActive).length, 2);
});

test('calculateQinqMetrics evaluates aggregate metro ethernet fleet and customer exposure', () => {
  let state = createInitialState(['Core Subscriber 1', 'Baradari User', 'Vandala User']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].packagePrice = 3000;
  state.customers[0].bills = [{ id: 'b-q1', amount: 3000, serviceMonth: '2026-10' }];

  state.customers[1].area = 'Baradari Road';
  state.customers[1].packagePrice = 5000;

  state.customers[2].area = 'Vandala Road';
  state.customers[2].packagePrice = 2500;

  const metrics = calculateQinqMetrics(state);
  assert.equal(metrics.totalTrunks, 6);
  assert.ok(metrics.totalCarrierCapacityGbps > 100);
  assert.ok(metrics.totalLiveTrafficGbps > 50);
  assert.ok(metrics.selectedTrunk !== null);
  assert.ok(metrics.allTrunks.length === 6);

  const coreMetrics = metrics.allTrunks.find(t => t.id === 'lacp-trunk-core-agg');
  assert.ok(coreMetrics);
  assert.equal(coreMetrics.matchingCount, 1);
  assert.equal(coreMetrics.totalBilledRevenue, 3000);
  assert.equal(coreMetrics.totalOutstandingDues, 3000);
});

test('QinQ simulation state getters, setters, and bounds operate properly', () => {
  resetQinqSimState();
  assert.equal(getQinqSelectedTrunk(), 'lacp-trunk-core-agg');
  assert.equal(getQinqTrafficSurgeGbps(), 0.0);
  assert.equal(getQinqFailedMembersCount(), 0);
  assert.equal(getQinqHashAlgorithm(), QINQ_CONSTANTS.HASH_ALGORITHMS.L3_L4);

  setQinqSelectedTrunk('lacp-trunk-baradari-ind');
  assert.equal(getQinqSelectedTrunk(), 'lacp-trunk-baradari-ind');

  setQinqTrafficSurgeGbps(15.5);
  assert.equal(getQinqTrafficSurgeGbps(), 15.5);
  setQinqTrafficSurgeGbps(50.0); // should clamp to 25.0
  assert.equal(getQinqTrafficSurgeGbps(), 25.0);

  setQinqFailedMembersCount(2);
  assert.equal(getQinqFailedMembersCount(), 2);
  setQinqFailedMembersCount(10); // should clamp to 3
  assert.equal(getQinqFailedMembersCount(), 3);

  setQinqHashAlgorithm(QINQ_CONSTANTS.HASH_ALGORITHMS.L2);
  assert.equal(getQinqHashAlgorithm(), QINQ_CONSTANTS.HASH_ALGORITHMS.L2);

  resetQinqSimState();
  assert.equal(getQinqSelectedTrunk(), 'lacp-trunk-core-agg');
  assert.equal(getQinqTrafficSurgeGbps(), 0.0);
  assert.equal(getQinqFailedMembersCount(), 0);
  assert.equal(getQinqHashAlgorithm(), QINQ_CONSTANTS.HASH_ALGORITHMS.L3_L4);
});

test('renderQinqTrunkSvg produces valid SVG markup for compact and expanded modes', () => {
  let state = createInitialState(['Sub']);
  state.customers[0].area = 'Shahdara Town';
  const metrics = calculateQinqMetrics(state);

  const compactSvg = renderQinqTrunkSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="qinq-compact-svg"'));
  assert.ok(compactSvg.includes('ACTIVE CAPACITY'));
  assert.ok(compactSvg.includes('LIVE TRAFFIC'));
  assert.ok(compactSvg.includes('PORT SATURATION'));
  assert.ok(compactSvg.includes('Trunk-LAG-01'));

  const expandedSvg = renderQinqTrunkSvg(metrics, { compact: false });
  assert.ok(expandedSvg.includes('<svg class="qinq-expanded-svg"'));
  assert.ok(expandedSvg.includes('IEEE 802.1ad PROVIDER BRIDGING (Q-IN-Q) FRAME STRUCTURE'));
  assert.ok(expandedSvg.includes('OUTER S-TAG (802.1ad)'));
  assert.ok(expandedSvg.includes('INNER C-TAG (802.1Q)'));
  assert.ok(expandedSvg.includes('IEEE 802.3ad LACP BUNDLE MEMBER INTERFACES &amp; LOAD SHARE'));
  assert.ok(expandedSvg.includes('TRUNK BANDWIDTH CAPACITY &amp; SATURATION'));
  assert.ok(expandedSvg.includes('CUSTOMER VLANS &amp; REVENUE'));
});

test('generateQinqReport produces comprehensive plain text diagnostic brief', () => {
  let state = createInitialState(['Corporate Trunk User']);
  state.customers[0].area = 'Shahdara Town';
  const metrics = calculateQinqMetrics(state);

  const report = generateQinqReport(metrics, { referenceDate: '2026-10-16T12:00:00Z' });
  assert.ok(report.includes('SHAHDARA METRO ETHERNET Q-IN-Q & LACP TRUNK AUDIT BRIEFING'));
  assert.ok(report.includes('NETWORK METRO FLEET SUMMARY'));
  assert.ok(report.includes('AUDITED TRUNK LAG DETAILS'));
  assert.ok(report.includes('LACP AGGREGATION & SATURATION PERFORMANCE'));
  assert.ok(report.includes('MULTIPLEXED CUSTOMER VLANS'));
  assert.ok(report.includes('SUBSCRIBER EXPOSURE & FINANCIALS'));
  assert.ok(report.includes('OPERATIONAL DIRECTIVES:'));
});

test('setupQinqModal hooks all UI elements, controls, and callbacks properly', async () => {
  let state = createInitialState(['QinQ Client']);
  state.customers[0].area = 'Shahdara Town';

  let modalOpened = false;
  let filterAreaCalledWith = null;
  let toastMessage = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };
  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };

  const mockTrunkSelect = { options: [], value: 'lacp-trunk-core-agg', innerHTML: '', onchange: null };
  const mockFailSelect = { options: [], value: '0', innerHTML: '', onchange: null };
  const mockHashSelect = { options: [], value: QINQ_CONSTANTS.HASH_ALGORITHMS.L3_L4, innerHTML: '', onchange: null };
  const mockSurgeSlider = { value: '0.0', oninput: null };
  const mockSurgeVal = { textContent: '' };
  const mockResetBtn = { onclick: null };

  const mockKpiTrunkName = { textContent: '' };
  const mockKpiCapacity = { textContent: '' };
  const mockKpiSaturation = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };

  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };

  const elementsMap = {
    'dashboardQinqModal': mockModal,
    'dashboardOpenQinqModalBtn': mockOpenBtn,
    'dashboardQinqModalCloseBtn': mockCloseBtn,
    'qinqTrunkSelect': mockTrunkSelect,
    'qinqFailLinkSelect': mockFailSelect,
    'qinqHashSelect': mockHashSelect,
    'qinqSurgeSlider': mockSurgeSlider,
    'qinqSurgeVal': mockSurgeVal,
    'qinqResetSimBtn': mockResetBtn,
    'qinqKpiTrunkName': mockKpiTrunkName,
    'qinqKpiCapacity': mockKpiCapacity,
    'qinqKpiSaturation': mockKpiSaturation,
    'qinqStatusBadge': mockStatusBadge,
    'qinqKpiRevenueRisk': mockKpiRevenueRisk,
    'qinqModalChartWrap': mockChartWrap,
    'qinqTrunksTableBody': mockTableBody,
    'qinqFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyQinqReportBtn': mockCopyReportBtn
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementsMap[id] || null
  };

  try {
    setupQinqModal(state, {
      onFilterArea: (area) => { filterAreaCalledWith = area; },
      onToast: (msg) => { toastMessage = msg; },
      clipboard: {
        writeText: async (text) => { copiedText = text; }
      }
    });

    // Open modal
    assert.ok(mockOpenBtn.onclick !== null);
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiTrunkName.textContent.includes('Trunk-LAG-01'));
    assert.ok(mockChartWrap.innerHTML.includes('qinq-expanded-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Shahdara Central Core'));

    // Change trunk
    assert.ok(mockTrunkSelect.onchange !== null);
    mockTrunkSelect.onchange({ target: { value: 'lacp-trunk-baradari-ind' } });
    assert.equal(getQinqSelectedTrunk(), 'lacp-trunk-baradari-ind');
    assert.ok(mockKpiTrunkName.textContent.includes('Baradari'));

    // Change fail link select
    assert.ok(mockFailSelect.onchange !== null);
    mockFailSelect.onchange({ target: { value: '1' } });
    assert.equal(getQinqFailedMembersCount(), 1);

    // Change hash select
    assert.ok(mockHashSelect.onchange !== null);
    mockHashSelect.onchange({ target: { value: QINQ_CONSTANTS.HASH_ALGORITHMS.L2 } });
    assert.equal(getQinqHashAlgorithm(), QINQ_CONSTANTS.HASH_ALGORITHMS.L2);

    // Change surge slider
    assert.ok(mockSurgeSlider.oninput !== null);
    mockSurgeSlider.oninput({ target: { value: '6.0' } });
    assert.equal(getQinqTrafficSurgeGbps(), 6.0);
    assert.equal(mockSurgeVal.textContent, '+6.0 Gbps');

    // Reset button
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getQinqSelectedTrunk(), 'lacp-trunk-core-agg');
    assert.equal(getQinqTrafficSurgeGbps(), 0.0);
    assert.equal(getQinqFailedMembersCount(), 0);
    assert.equal(getQinqHashAlgorithm(), QINQ_CONSTANTS.HASH_ALGORITHMS.L3_L4);

    // Filter area
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaCalledWith, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(toastMessage.includes('Metro Ethernet QinQ & LACP Audit Briefing'));
    assert.ok(copiedText.includes('SHAHDARA METRO ETHERNET Q-IN-Q & LACP TRUNK AUDIT BRIEFING'));

    // Close modal
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetQinqSimState();
  }
});

test('calculateOscillatorHoldoverDrift handles zero hours and calculates drift correctly for oscillator types', () => {
  assert.equal(calculateOscillatorHoldoverDrift('RUBIDIUM', 0), 0.0);
  assert.equal(calculateOscillatorHoldoverDrift('RUBIDIUM', -2), 0.0);

  const rubidium12h = calculateOscillatorHoldoverDrift('RUBIDIUM', 12);
  const ocxo12h = calculateOscillatorHoldoverDrift('OCXO', 12);
  const tcxo12h = calculateOscillatorHoldoverDrift('TCXO', 12);

  assert.ok(rubidium12h > 0);
  assert.ok(ocxo12h > rubidium12h);
  assert.ok(tcxo12h > ocxo12h);
});

test('calculateNodeSyncMetrics calculates baseline phase error, jitter, MTIE, and lock status', () => {
  const gmNode = SHAHDARA_SYNCE_NODES.find(n => n.id === 'synce-node-gm-central');
  assert.ok(gmNode);

  const gmMetrics = calculateNodeSyncMetrics(gmNode, {
    selectedNodeId: gmNode.id,
    holdoverHours: 0,
    jitterSurgeUs: 0,
    gnssLossInjected: false
  });

  assert.equal(gmMetrics.effectivePhaseErrorNs, 0.0);
  assert.equal(gmMetrics.syncState, 'LOCKED_GNSS');
  assert.equal(gmMetrics.effectiveSsm, 'PRC');
  assert.equal(gmMetrics.badgeClass, 'badge-success');
  assert.ok(gmMetrics.mtieNs > 0);

  const bcNode = SHAHDARA_SYNCE_NODES.find(n => n.id === 'synce-node-bc-core');
  assert.ok(bcNode);
  const bcMetrics = calculateNodeSyncMetrics(bcNode, {
    selectedNodeId: bcNode.id,
    holdoverHours: 0,
    jitterSurgeUs: 0
  });

  assert.equal(bcMetrics.effectivePhaseErrorNs, 18.0);
  assert.equal(bcMetrics.syncState, 'LOCKED');
  assert.equal(bcMetrics.effectiveSsm, 'SSU_A');
  assert.equal(bcMetrics.slaPacketSlipRiskPct, 0.0);
});

test('calculateNodeSyncMetrics simulates GNSS loss, holdover aging, and out-of-spec phase slips', () => {
  const gmNode = SHAHDARA_SYNCE_NODES.find(n => n.id === 'synce-node-gm-central');
  
  // Inject GNSS signal loss (switches to Rubidium holdover SSU-A)
  const gmHoldover = calculateNodeSyncMetrics(gmNode, {
    selectedNodeId: gmNode.id,
    gnssLossInjected: true,
    holdoverHours: 4.0
  });

  assert.equal(gmHoldover.syncState, 'HOLDOVER');
  assert.equal(gmHoldover.effectiveSsm, 'SSU_A');
  assert.equal(gmHoldover.badgeClass, 'badge-warning');
  assert.ok(gmHoldover.holdoverDriftNs > 0);

  // Severe holdover (> 24 hours) causes OUT_OF_SPEC
  const gmExpired = calculateNodeSyncMetrics(gmNode, {
    selectedNodeId: gmNode.id,
    gnssLossInjected: true,
    holdoverHours: 36.0
  });

  assert.equal(gmExpired.syncState, 'OUT_OF_SPEC');
  assert.equal(gmExpired.badgeClass, 'badge-danger');
  assert.ok(gmExpired.slaPacketSlipRiskPct > 0);

  // Severe jitter surge on slave node causes out-of-spec condition
  const slaveNode = SHAHDARA_SYNCE_NODES.find(n => n.id === 'synce-node-sc-begumkot');
  const slaveDegraded = calculateNodeSyncMetrics(slaveNode, {
    selectedNodeId: slaveNode.id,
    jitterSurgeUs: 5.0
  });

  assert.equal(slaveDegraded.syncState, 'OUT_OF_SPEC');
  assert.equal(slaveDegraded.effectiveSsm, 'DNU');
  assert.ok(slaveDegraded.slaPacketSlipRiskPct > 0);
});

test('calculateSyncEMetrics computes fleet health index and correlates subscriber revenue exposure', () => {
  let state = createInitialState(['Sync Cust A', 'Sync Cust B']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].serviceStatus = 'active';
  state.customers[1].area = 'Begum Kot';
  state.customers[1].serviceStatus = 'active';

  const metrics = calculateSyncEMetrics(state, {
    selectedNodeId: 'synce-node-gm-central'
  });

  assert.equal(metrics.totalNodes, SHAHDARA_SYNCE_NODES.length);
  assert.ok(metrics.healthIndex > 50);
  assert.ok(metrics.nodes.length === SHAHDARA_SYNCE_NODES.length);
  assert.equal(metrics.selectedNode.id, 'synce-node-gm-central');

  const begumNode = metrics.nodes.find(n => n.id === 'synce-node-sc-begumkot');
  assert.ok(begumNode);
  assert.equal(begumNode.matchedCustomersCount, 1);
});

test('renderSyncEClockSvg renders accessible SVG for both compact dial and full modal waveform', () => {
  let state = createInitialState(['Clock User']);
  const metrics = calculateSyncEMetrics(state);

  const compactSvg = renderSyncEClockSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('synce-compact-svg'));
  assert.ok(compactSvg.includes('Phase Offset (ITU-T G.8275.1)'));
  assert.ok(compactSvg.includes('SSM QUALITY'));
  assert.ok(compactSvg.includes('PDV PACKET JITTER'));

  const modalSvg = renderSyncEClockSvg(metrics, { compact: false });
  assert.ok(modalSvg.includes('synce-modal-svg'));
  assert.ok(modalSvg.includes('CARRIER ETHERNET CLOCK TOPOLOGY TREE'));
  assert.ok(modalSvg.includes('PHASE OFFSET JITTER &amp; HOLDOVER ENVELOPE'));
  assert.ok(modalSvg.includes('T-GM'));

  const emptySvg = renderSyncEClockSvg(null);
  assert.ok(emptySvg.includes('No clock telemetry recorded'));
});

test('generateSyncEReport generates complete executive audit text', () => {
  let state = createInitialState(['Timing Cust']);
  const metrics = calculateSyncEMetrics(state);

  const report = generateSyncEReport(metrics);
  assert.ok(report.includes('SHAHDARA ISP — SYNCHRONOUS ETHERNET & PTP CLOCK AUDIT BRIEFING'));
  assert.ok(report.includes('ACTIVE MONITORED NODE'));
  assert.ok(report.includes('SHAHDARA ISP NETWORK CLOCK REGISTER'));
  assert.ok(report.includes('FLEET SYNCHRONIZATION SUMMARY'));
});

test('setupSyncEModal wires interactive DOM controls, inputs, and events', async () => {
  let state = createInitialState(['Clock Tech']);
  state.customers[0].area = 'Shahdara Town';

  let modalOpened = false;
  let filterAreaTarget = null;
  let toastMsg = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };
  const mockOpenBtn = { addEventListener: (evt, fn) => { mockOpenBtn.onclick = fn; }, onclick: null };
  const mockCloseBtn = { addEventListener: (evt, fn) => { mockCloseBtn.onclick = fn; }, onclick: null };

  const mockNodeSelect = { options: [], value: 'synce-node-gm-central', appendChild: (opt) => mockNodeSelect.options.push(opt), addEventListener: (evt, fn) => { mockNodeSelect.onchange = fn; } };
  const mockGnssLossSelect = { options: [], value: 'normal', appendChild: (opt) => mockGnssLossSelect.options.push(opt), addEventListener: (evt, fn) => { mockGnssLossSelect.onchange = fn; } };
  const mockProfileSelect = { options: [], value: SYNCE_CONSTANTS.PTP_PROFILES.G8275_1, appendChild: (opt) => mockProfileSelect.options.push(opt), addEventListener: (evt, fn) => { mockProfileSelect.onchange = fn; } };
  const mockHoldoverSlider = { value: '0.0', addEventListener: (evt, fn) => { mockHoldoverSlider.oninput = fn; } };
  const mockHoldoverVal = { textContent: '' };
  const mockJitterSlider = { value: '0.0', addEventListener: (evt, fn) => { mockJitterSlider.oninput = fn; } };
  const mockJitterVal = { textContent: '' };
  const mockResetBtn = { addEventListener: (evt, fn) => { mockResetBtn.onclick = fn; }, onclick: null };

  const mockKpiNodeName = { textContent: '' };
  const mockKpiPhaseError = { textContent: '', style: {} };
  const mockKpiJitter = { textContent: '', style: {} };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = {
    innerHTML: '',
    querySelectorAll: () => []
  };

  const mockFilterAreaBtn = { addEventListener: (evt, fn) => { mockFilterAreaBtn.onclick = fn; }, onclick: null };
  const mockCopyReportBtn = { addEventListener: (evt, fn) => { mockCopyReportBtn.onclick = fn; }, onclick: null };

  const elementsMap = {
    'dashboardSyncEModal': mockModal,
    'dashboardOpenSyncEModalBtn': mockOpenBtn,
    'dashboardSyncEModalCloseBtn': mockCloseBtn,
    'synceNodeSelect': mockNodeSelect,
    'synceGnssLossSelect': mockGnssLossSelect,
    'synceProfileSelect': mockProfileSelect,
    'synceHoldoverSlider': mockHoldoverSlider,
    'synceHoldoverVal': mockHoldoverVal,
    'synceJitterSlider': mockJitterSlider,
    'synceJitterVal': mockJitterVal,
    'synceResetSimBtn': mockResetBtn,
    'synceKpiNodeName': mockKpiNodeName,
    'synceKpiPhaseError': mockKpiPhaseError,
    'synceKpiJitter': mockKpiJitter,
    'synceStatusBadge': mockStatusBadge,
    'synceKpiRevenueRisk': mockKpiRevenueRisk,
    'synceModalChartWrap': mockChartWrap,
    'synceNodesTableBody': mockTableBody,
    'synceFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopySyncEReportBtn': mockCopyReportBtn
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementsMap[id] || null,
    createElement: () => ({ value: '', textContent: '' })
  };


  try {
    setupSyncEModal(state, {
      onFilterArea: (a) => { filterAreaTarget = a; },
      onToast: (m) => { toastMsg = m; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });


    // Open modal
    assert.ok(mockOpenBtn.onclick !== null);
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiNodeName.textContent.includes('T-GM-01'));
    assert.ok(mockChartWrap.innerHTML.includes('synce-modal-svg'));
    assert.ok(mockTableBody.innerHTML.includes('T-GM-01'));

    // Change node
    mockNodeSelect.value = 'synce-node-bc-core';
    mockNodeSelect.onchange();
    assert.equal(getSyncESelectedNode(), 'synce-node-bc-core');

    // Change GNSS loss
    mockGnssLossSelect.value = 'lost';
    mockGnssLossSelect.onchange();
    assert.equal(getSyncEGnssLossInjected(), true);

    // Change holdover slider
    mockHoldoverSlider.value = '8.0';
    mockHoldoverSlider.oninput();
    assert.equal(getSyncEHoldoverHours(), 8.0);
    assert.equal(mockHoldoverVal.textContent, '8.0 hrs');

    // Change jitter slider
    mockJitterSlider.value = '2.5';
    mockJitterSlider.oninput();
    assert.equal(getSyncEJitterSurgeUs(), 2.5);
    assert.equal(mockJitterVal.textContent, '+2.5 µs');

    // Reset button
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getSyncESelectedNode(), 'synce-node-gm-central');
    assert.equal(getSyncEGnssLossInjected(), false);
    assert.equal(getSyncEHoldoverHours(), 0.0);
    assert.equal(getSyncEJitterSurgeUs(), 0.0);
    assert.equal(toastMsg, 'Clock synchronization state reset to baseline.');

    // Filter area button
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaTarget, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report button
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(copiedText.includes('SYNCHRONOUS ETHERNET & PTP CLOCK AUDIT BRIEFING'));
    assert.equal(toastMsg, 'SyncE audit report copied to clipboard!');

    // Close button
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetSyncESimState();
  }

});

test('SyncE state getters, setters, and boundary clamping work reliably', () => {
  resetSyncESimState();
  assert.equal(getSyncESelectedNode(), 'synce-node-gm-central');

  setSyncESelectedNode('synce-node-bc-vandala');
  assert.equal(getSyncESelectedNode(), 'synce-node-bc-vandala');
  setSyncESelectedNode('invalid-node-id');
  assert.equal(getSyncESelectedNode(), 'synce-node-bc-vandala');

  setSyncEHoldoverHours(15.5);
  assert.equal(getSyncEHoldoverHours(), 15.5);
  setSyncEHoldoverHours(100.0); // Clamped to 72.0
  assert.equal(getSyncEHoldoverHours(), 72.0);
  setSyncEHoldoverHours(-10.0); // Clamped to 0.0
  assert.equal(getSyncEHoldoverHours(), 0.0);

  setSyncEJitterSurgeUs(3.2);
  assert.equal(getSyncEJitterSurgeUs(), 3.2);
  setSyncEJitterSurgeUs(20.0); // Clamped to 10.0
  assert.equal(getSyncEJitterSurgeUs(), 10.0);
  setSyncEJitterSurgeUs(-5.0); // Clamped to 0.0
  assert.equal(getSyncEJitterSurgeUs(), 0.0);

  setSyncEGnssLossInjected(true);
  assert.equal(getSyncEGnssLossInjected(), true);
  setSyncEGnssLossInjected(false);
  assert.equal(getSyncEGnssLossInjected(), false);

  setSyncESelectedProfile(SYNCE_CONSTANTS.PTP_PROFILES.G8265_1);
  assert.equal(getSyncESelectedProfile(), SYNCE_CONSTANTS.PTP_PROFILES.G8265_1);
  setSyncESelectedProfile('invalid-profile');
  assert.equal(getSyncESelectedProfile(), SYNCE_CONSTANTS.PTP_PROFILES.G8265_1);

  resetSyncESimState();
  assert.equal(getSyncESelectedNode(), 'synce-node-gm-central');
  assert.equal(getSyncEHoldoverHours(), 0.0);
  assert.equal(getSyncEJitterSurgeUs(), 0.0);
  assert.equal(getSyncEGnssLossInjected(), false);
  assert.equal(getSyncESelectedProfile(), SYNCE_CONSTANTS.PTP_PROFILES.G8275_1);
});

test('calculateChannelOpticalLoss calculates insertion loss, output power, and OSNR for express and add/drop channels', () => {
  const node = SHAHDARA_ROADM_NODES[0];
  const expressCh = SHAHDARA_WAVELENGTH_CHANNELS[0]; // Ch 1 Express
  const addDropCh = SHAHDARA_WAVELENGTH_CHANNELS[1]; // Ch 2 Add/Drop

  const expressMetrics = calculateChannelOpticalLoss(expressCh, node, {
    spanCondition: ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.NORMAL,
    switchingMode: ROADM_CONSTANTS.SWITCHING_MODES.AUTOMATIC_PROTECTION,
    voaAttenuationDb: 0.0
  });

  assert.equal(expressMetrics.activePathType, 'EXPRESS_BYPASS');
  assert.equal(expressMetrics.opticalLossDb, ROADM_CONSTANTS.BASE_EXPRESS_LOSS_DB);
  assert.equal(expressMetrics.pathStatus, 'OPTIMAL');
  assert.equal(expressMetrics.badgeClass, 'badge-success');
  assert.ok(expressMetrics.effectiveOsnrDb > ROADM_CONSTANTS.MIN_ACCEPTABLE_OSNR_DB);

  const addDropMetrics = calculateChannelOpticalLoss(addDropCh, node, {
    spanCondition: ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.NORMAL,
    switchingMode: ROADM_CONSTANTS.SWITCHING_MODES.AUTOMATIC_PROTECTION,
    voaAttenuationDb: 2.0
  });

  assert.equal(addDropMetrics.activePathType, 'ADD_DROP');
  assert.equal(addDropMetrics.opticalLossDb, ROADM_CONSTANTS.BASE_ADD_DROP_LOSS_DB + 2.0);
  assert.equal(addDropMetrics.statusLabel, 'LOCAL ADD/DROP');
});

test('calculateChannelOpticalLoss simulates WSS protection rerouting and loopback modes', () => {
  const node = SHAHDARA_ROADM_NODES[0];
  const expressCh = SHAHDARA_WAVELENGTH_CHANNELS[0];

  // Fiber span cut: East span cut triggers West protection rerouting (<50ms)
  const reroutedEast = calculateChannelOpticalLoss(expressCh, node, {
    spanCondition: ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.EAST_SPAN_CUT,
    switchingMode: ROADM_CONSTANTS.SWITCHING_MODES.AUTOMATIC_PROTECTION
  });

  assert.equal(reroutedEast.activePathType, 'PROTECTION_WEST_REROUTE');
  assert.equal(reroutedEast.rerouted, true);
  assert.equal(reroutedEast.pathStatus, 'PROTECTED');
  assert.equal(reroutedEast.badgeClass, 'badge-warning');
  assert.equal(reroutedEast.protectionLatencyMs, node.switchingLatencyMs);

  // Maintenance loopback
  const loopback = calculateChannelOpticalLoss(expressCh, node, {
    switchingMode: ROADM_CONSTANTS.SWITCHING_MODES.MAINTENANCE_LOOPBACK
  });

  assert.equal(loopback.activePathType, 'LOOPBACK_OSA');
  assert.equal(loopback.pathStatus, 'MAINTENANCE');
  assert.equal(loopback.statusLabel, 'OSA LOOPBACK');

  // Excessive VOA attenuation triggers low OSNR
  const degraded = calculateChannelOpticalLoss(expressCh, node, {
    voaAttenuationDb: 15.0
  });

  assert.ok(degraded.effectiveOsnrDb < ROADM_CONSTANTS.MIN_ACCEPTABLE_OSNR_DB);
  assert.equal(degraded.pathStatus, 'DEGRADED');
  assert.equal(degraded.badgeClass, 'badge-danger');
});

test('calculateRoadmMetrics computes channel counts, fleet status, and subscriber revenue exposure', () => {
  let state = createInitialState(['Roadm Cust 1', 'Roadm Cust 2']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].serviceStatus = 'active';
  state.customers[1].area = 'Baradari Road';
  state.customers[1].serviceStatus = 'active';

  const metrics = calculateRoadmMetrics(state, {
    selectedNodeId: 'roadm-node-central',
    selectedChannelId: 'ch-1-core-transit'
  });

  assert.equal(metrics.nodes.length, SHAHDARA_ROADM_NODES.length);
  assert.equal(metrics.channels.length, SHAHDARA_WAVELENGTH_CHANNELS.length);
  assert.equal(metrics.selectedNode.id, 'roadm-node-central');
  assert.equal(metrics.selectedChannel.id, 'ch-1-core-transit');
  assert.equal(metrics.matchedCustomersCount, 1);
  assert.ok(metrics.expressChannelsCount > 0);
  assert.ok(metrics.addDropChannelsCount > 0);
  assert.equal(metrics.opticalFleetStatus, 'OPTIMAL DUAL-RING');
});

test('renderRoadmOpticalSvg renders accessible SVG in compact dial mode and modal WSS/OSA mode', () => {
  let state = createInitialState(['Opt User']);
  const metrics = calculateRoadmMetrics(state);

  const compactSvg = renderRoadmOpticalSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('roadm-compact-svg'));
  assert.ok(compactSvg.includes('WSS OPTICAL OSNR'));
  assert.ok(compactSvg.includes('VOA ATTENUATION'));
  assert.ok(compactSvg.includes('RING ROUTING STATE'));

  const modalSvg = renderRoadmOpticalSvg(metrics, { compact: false });
  assert.ok(modalSvg.includes('roadm-modal-svg'));
  assert.ok(modalSvg.includes('LCOS FLEX-GRID WAVELENGTH SELECTIVE SWITCH'));
  assert.ok(modalSvg.includes('OPTICAL SPECTRUM ANALYZER (OSA)'));
  assert.ok(modalSvg.includes('ALL-OPTICAL EXPRESS BYPASS'));

  const emptySvg = renderRoadmOpticalSvg(null);
  assert.ok(emptySvg.includes('No optical ROADM telemetry recorded'));
});

test('generateRoadmReport formats comprehensive executive optical audit text', () => {
  let state = createInitialState(['Carrier Cust']);
  const metrics = calculateRoadmMetrics(state);

  const report = generateRoadmReport(metrics);
  assert.ok(report.includes('ROADM FLEX-GRID WSS OPTICAL ROUTING AUDIT BRIEFING'));
  assert.ok(report.includes('AUDITED ROADM NODE'));
  assert.ok(report.includes('ACTIVE WAVELENGTH CARRIER:'));
  assert.ok(report.includes('C-BAND FLEX-GRID CHANNEL REGISTER'));
  assert.ok(report.includes('SUBSCRIBER IMPACT & FINANCIAL RISK'));
});

test('setupRoadmModal wires interactive controls, dropdowns, sliders, and clipboard copy', async () => {
  let state = createInitialState(['ROADM Tech']);
  state.customers[0].area = 'Shahdara Town';

  let modalOpened = false;
  let filterAreaTarget = null;
  let toastMsg = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };
  const mockOpenBtn = { addEventListener: (evt, fn) => { mockOpenBtn.onclick = fn; }, onclick: null };
  const mockCloseBtn = { addEventListener: (evt, fn) => { mockCloseBtn.onclick = fn; }, onclick: null };

  const mockNodeSelect = { options: [], value: 'roadm-node-central', appendChild: (opt) => mockNodeSelect.options.push(opt), addEventListener: (evt, fn) => { mockNodeSelect.onchange = fn; } };
  const mockChannelSelect = { options: [], value: 'ch-1-core-transit', appendChild: (opt) => mockChannelSelect.options.push(opt), addEventListener: (evt, fn) => { mockChannelSelect.onchange = fn; } };
  const mockSpanSelect = { options: [], value: ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.NORMAL, appendChild: (opt) => mockSpanSelect.options.push(opt), addEventListener: (evt, fn) => { mockSpanSelect.onchange = fn; } };
  const mockModeSelect = { options: [], value: ROADM_CONSTANTS.SWITCHING_MODES.AUTOMATIC_PROTECTION, appendChild: (opt) => mockModeSelect.options.push(opt), addEventListener: (evt, fn) => { mockModeSelect.onchange = fn; } };
  const mockVoaSlider = { value: '2.0', addEventListener: (evt, fn) => { mockVoaSlider.oninput = fn; } };
  const mockVoaVal = { textContent: '' };
  const mockResetBtn = { addEventListener: (evt, fn) => { mockResetBtn.onclick = fn; }, onclick: null };

  const mockKpiNodeName = { textContent: '' };
  const mockKpiOutputPower = { textContent: '', style: {} };
  const mockKpiOsnr = { textContent: '', style: {} };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = {
    innerHTML: '',
    querySelectorAll: () => []
  };

  const mockFilterAreaBtn = { addEventListener: (evt, fn) => { mockFilterAreaBtn.onclick = fn; }, onclick: null };
  const mockCopyReportBtn = { addEventListener: (evt, fn) => { mockCopyReportBtn.onclick = fn; }, onclick: null };

  const elementsMap = {
    'dashboardRoadmModal': mockModal,
    'dashboardOpenRoadmModalBtn': mockOpenBtn,
    'dashboardRoadmModalCloseBtn': mockCloseBtn,
    'roadmNodeSelect': mockNodeSelect,
    'roadmChannelSelect': mockChannelSelect,
    'roadmSpanSelect': mockSpanSelect,
    'roadmModeSelect': mockModeSelect,
    'roadmVoaSlider': mockVoaSlider,
    'roadmVoaVal': mockVoaVal,
    'roadmResetSimBtn': mockResetBtn,
    'roadmKpiNodeName': mockKpiNodeName,
    'roadmKpiOutputPower': mockKpiOutputPower,
    'roadmKpiOsnr': mockKpiOsnr,
    'roadmStatusBadge': mockStatusBadge,
    'roadmKpiRevenueRisk': mockKpiRevenueRisk,
    'roadmModalChartWrap': mockChartWrap,
    'roadmChannelsTableBody': mockTableBody,
    'roadmFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyRoadmReportBtn': mockCopyReportBtn
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementsMap[id] || null,
    createElement: () => ({ value: '', textContent: '' })
  };

  try {
    setupRoadmModal(state, {
      onFilterArea: (a) => { filterAreaTarget = a; },
      onToast: (m) => { toastMsg = m; },
      clipboard: {
        writeText: async (t) => { copiedText = t; }
      }
    });

    // Open modal
    assert.ok(mockOpenBtn.onclick !== null);
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiNodeName.textContent.includes('ROADM-01'));
    assert.ok(mockChartWrap.innerHTML.includes('roadm-modal-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Ch 01'));

    // Change node
    mockNodeSelect.value = 'roadm-node-baradari';
    mockNodeSelect.onchange();
    assert.equal(getRoadmSelectedNode(), 'roadm-node-baradari');

    // Change channel
    mockChannelSelect.value = 'ch-2-upstream-peer';
    mockChannelSelect.onchange();
    assert.equal(getRoadmSelectedChannel(), 'ch-2-upstream-peer');

    // Change span condition
    mockSpanSelect.value = ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.EAST_SPAN_CUT;
    mockSpanSelect.onchange();
    assert.equal(getRoadmSpanCondition(), ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.EAST_SPAN_CUT);

    // Change mode
    mockModeSelect.value = ROADM_CONSTANTS.SWITCHING_MODES.MANUAL_OVERRIDE;
    mockModeSelect.onchange();
    assert.equal(getRoadmSwitchingMode(), ROADM_CONSTANTS.SWITCHING_MODES.MANUAL_OVERRIDE);

    // Change VOA slider
    mockVoaSlider.value = '4.5';
    mockVoaSlider.oninput();
    assert.equal(getRoadmVoaAttenuationDb(), 4.5);
    assert.equal(mockVoaVal.textContent, '4.5 dB');

    // Reset button
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getRoadmSelectedNode(), 'roadm-node-central');
    assert.equal(getRoadmSelectedChannel(), 'ch-1-core-transit');
    assert.equal(getRoadmSpanCondition(), ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.NORMAL);
    assert.equal(getRoadmSwitchingMode(), ROADM_CONSTANTS.SWITCHING_MODES.AUTOMATIC_PROTECTION);
    assert.equal(getRoadmVoaAttenuationDb(), 2.0);
    assert.equal(toastMsg, 'ROADM flex-grid state reset to baseline.');

    // Filter area
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaTarget, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(copiedText.includes('ROADM FLEX-GRID WSS OPTICAL ROUTING AUDIT BRIEFING'));
    assert.equal(toastMsg, 'ROADM audit report copied to clipboard!');

    // Close button
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetRoadmSimState();
  }
});

test('ROADM state getters, setters, and boundary clamping work reliably', () => {
  resetRoadmSimState();
  assert.equal(getRoadmSelectedNode(), 'roadm-node-central');

  setRoadmSelectedNode('roadm-node-vandala');
  assert.equal(getRoadmSelectedNode(), 'roadm-node-vandala');
  setRoadmSelectedNode('invalid-node-id');
  assert.equal(getRoadmSelectedNode(), 'roadm-node-vandala');

  setRoadmSelectedChannel('ch-3-gpon-agg');
  assert.equal(getRoadmSelectedChannel(), 'ch-3-gpon-agg');
  setRoadmSelectedChannel('invalid-ch-id');
  assert.equal(getRoadmSelectedChannel(), 'ch-3-gpon-agg');

  setRoadmSpanCondition(ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.WEST_SPAN_CUT);
  assert.equal(getRoadmSpanCondition(), ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.WEST_SPAN_CUT);
  setRoadmSpanCondition('invalid-span');
  assert.equal(getRoadmSpanCondition(), ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.WEST_SPAN_CUT);

  setRoadmSwitchingMode(ROADM_CONSTANTS.SWITCHING_MODES.MAINTENANCE_LOOPBACK);
  assert.equal(getRoadmSwitchingMode(), ROADM_CONSTANTS.SWITCHING_MODES.MAINTENANCE_LOOPBACK);
  setRoadmSwitchingMode('invalid-mode');
  assert.equal(getRoadmSwitchingMode(), ROADM_CONSTANTS.SWITCHING_MODES.MAINTENANCE_LOOPBACK);

  setRoadmVoaAttenuationDb(5.5);
  assert.equal(getRoadmVoaAttenuationDb(), 5.5);
  setRoadmVoaAttenuationDb(30.0); // Clamped to 15.0
  assert.equal(getRoadmVoaAttenuationDb(), 15.0);
  setRoadmVoaAttenuationDb(-5.0); // Clamped to 0.0
  assert.equal(getRoadmVoaAttenuationDb(), 0.0);

  resetRoadmSimState();
  assert.equal(getRoadmSelectedNode(), 'roadm-node-central');
  assert.equal(getRoadmSelectedChannel(), 'ch-1-core-transit');
  assert.equal(getRoadmSpanCondition(), ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.NORMAL);
  assert.equal(getRoadmSwitchingMode(), ROADM_CONSTANTS.SWITCHING_MODES.AUTOMATIC_PROTECTION);
  assert.equal(getRoadmVoaAttenuationDb(), 2.0);
});

test('MICRO_OTDR_CONSTANTS and SHAHDARA_MICRO_OTDR_PORTS have valid specifications', () => {
  assert.ok(Array.isArray(SHAHDARA_MICRO_OTDR_PORTS));
  assert.equal(SHAHDARA_MICRO_OTDR_PORTS.length, 5);

  for (const port of SHAHDARA_MICRO_OTDR_PORTS) {
    assert.ok(port.id.startsWith('sfp-port-'));
    assert.ok(port.name.length > 5);
    assert.ok(port.primaryArea.length > 0);
    assert.ok(Array.isArray(port.aliasAreas) && port.aliasAreas.length > 0);
    assert.ok(port.transceiverType.length > 5);
    assert.ok(port.targetDistanceM > 1000);
    assert.ok(typeof port.txPowerDbm === 'number');
    assert.ok(typeof port.rxSensitivityDbm === 'number');
    assert.ok(port.rxSensitivityDbm < port.txPowerDbm);
  }

  assert.equal(MICRO_OTDR_CONSTANTS.FIBER_REFRACTIVE_INDEX, 1.4682);
  assert.equal(MICRO_OTDR_CONSTANTS.DEFAULT_WAVELENGTH, '1310');
  assert.ok(MICRO_OTDR_CONSTANTS.FIBER_ATTENUATION_COEFF_DB_KM['1310'] > 0);
  assert.ok(MICRO_OTDR_CONSTANTS.FIBER_ATTENUATION_COEFF_DB_KM['1550'] > 0);
  assert.ok(MICRO_OTDR_CONSTANTS.FIBER_ATTENUATION_COEFF_DB_KM['1577'] > 0);
});

test('calculateFiberPropagationDelay computes round-trip optical time of flight precisely', () => {
  // At 0 meters, delay is 0
  assert.equal(calculateFiberPropagationDelay(0), 0.0);

  // At 1,420 meters:
  // tau = (2 * 1.4682 * 1420) / (299792.458 m/s * 1s/1000000us) / 1000
  // tau = (2 * 1.4682 * 1420) / 299.792458 = 4169.688 / 299.792458 ~= 13.908 us
  const delay1420 = calculateFiberPropagationDelay(1420);
  assert.ok(delay1420 > 13.8 && delay1420 < 14.0);

  // At 5,000 meters:
  const delay5000 = calculateFiberPropagationDelay(5000);
  assert.ok(delay5000 > 48.0 && delay5000 < 50.0);
});

test('calculateEventSignatures correctly models normal, fiber cut, dirty connector, and macro-bend states', () => {
  const port = SHAHDARA_MICRO_OTDR_PORTS[0];

  // 1. Normal Intact Link
  const normalSig = calculateEventSignatures(port, { faultPreset: 'NORMAL', wavelength: '1577' });
  assert.equal(normalSig.faultDetected, false);
  assert.equal(normalSig.faultType, null);
  assert.equal(normalSig.faultDistanceM, null);
  assert.equal(normalSig.linkStatus, 'Optimal');
  assert.ok(normalSig.events.length >= 4);
  assert.equal(normalSig.events[0].type, MICRO_OTDR_CONSTANTS.EVENT_TYPES.LAUNCH);
  assert.ok(normalSig.totalLinkLossDb > 0 && normalSig.totalLinkLossDb < 5.0);
  assert.ok(normalSig.opticalReturnLossDb > 25.0);
  assert.ok(normalSig.opticalSafetyMarginDb > 0);

  // 2. Fiber Cut at 1420m
  const cutSig = calculateEventSignatures(port, { faultPreset: 'FIBER_CUT_1400M', wavelength: '1577' });
  assert.equal(cutSig.faultDetected, true);
  assert.equal(cutSig.faultType, 'FIBER_CUT');
  assert.equal(cutSig.faultDistanceM, 1420);
  assert.equal(cutSig.linkStatus, 'Critical');
  assert.equal(cutSig.activeDistanceLimit, 1420);
  const cutEvent = cutSig.events.find(e => e.type === MICRO_OTDR_CONSTANTS.EVENT_TYPES.TERMINATION_BREAK);
  assert.ok(cutEvent);
  assert.equal(cutEvent.distanceM, 1420);
  assert.equal(cutEvent.reflectanceDb, -14.8);
  assert.equal(cutEvent.severity, 'Critical');
  assert.ok(cutSig.totalLinkLossDb > 30.0);

  // 3. Dirty APC Connector at 850m
  const dirtySig = calculateEventSignatures(port, { faultPreset: 'DIRTY_CONNECTOR_850M', wavelength: '1577' });
  assert.equal(dirtySig.faultDetected, true);
  assert.equal(dirtySig.faultType, 'DIRTY_CONNECTOR');
  assert.equal(dirtySig.faultDistanceM, 850);
  assert.equal(dirtySig.linkStatus, 'Warning');
  const dirtyEvent = dirtySig.events.find(e => e.type === MICRO_OTDR_CONSTANTS.EVENT_TYPES.FRESNEL_REFLECTION);
  assert.ok(dirtyEvent);
  assert.equal(dirtyEvent.distanceM, 850);
  assert.equal(dirtyEvent.reflectanceDb, -26.2);
  assert.equal(dirtyEvent.stepLossDb, 1.85);
  assert.equal(dirtyEvent.severity, 'Warning');

  // 4. Macro-bend at 2100m
  const bendSig = calculateEventSignatures(port, { faultPreset: 'MACRO_BEND_2100M', wavelength: '1577' });
  assert.equal(bendSig.faultDetected, true);
  assert.equal(bendSig.faultType, 'MACRO_BEND');
  assert.equal(bendSig.faultDistanceM, 2100);
  assert.equal(bendSig.linkStatus, 'Warning');
  const bendEvent = bendSig.events.find(e => e.type === MICRO_OTDR_CONSTANTS.EVENT_TYPES.ATTENUATION_STEP);
  assert.ok(bendEvent);
  assert.equal(bendEvent.distanceM, 2100);
  assert.ok(bendEvent.stepLossDb >= 3.4);
  assert.equal(bendEvent.reflectanceDb, -62.0); // Non-reflective
});

test('calculateMicroOtdrMetrics correlates physical link telemetry with customer revenue exposure', () => {
  const state = {
    ...createInitialState(['OTDR Tech']),
    customers: [
      { id: 'c1', name: 'Tariq Textiles Feeder', area: 'Shahdara Town', status: 'Active', packagePrice: 3500 },
      { id: 'c2', name: 'Old Town Commercial Hub', area: 'Old Town', status: 'Active', packagePrice: 6000 },
      { id: 'c3', name: 'Baradari Fiber User', area: 'Baradari Road', status: 'Active', packagePrice: 2800 }
    ]
  };

  // Calculate metrics under Normal state for Port 1 (Shahdara Town)
  const normalMetrics = calculateMicroOtdrMetrics(state, {
    selectedPortId: 'sfp-port-01',
    faultPreset: 'NORMAL'
  });

  assert.equal(normalMetrics.selectedPort.id, 'sfp-port-01');
  assert.equal(normalMetrics.totalAreaSubscribers, 2);
  assert.equal(normalMetrics.activeSubscribers, 2);
  assert.equal(normalMetrics.monthlyBilledRevenue, 9500); // 3500 + 6000
  assert.equal(normalMetrics.affectedSubscribers, 0);
  assert.equal(normalMetrics.monthlyRevenueAtRiskPkr, 0);
  assert.equal(normalMetrics.revenueProtectionRate, 100.0);
  assert.equal(normalMetrics.linkStatus, 'Optimal');

  // Calculate metrics under Fiber Cut state
  const cutMetrics = calculateMicroOtdrMetrics(state, {
    selectedPortId: 'sfp-port-01',
    faultPreset: 'FIBER_CUT_1400M'
  });

  assert.equal(cutMetrics.linkStatus, 'Critical');
  assert.equal(cutMetrics.affectedSubscribers, 2);
  assert.equal(cutMetrics.monthlyRevenueAtRiskPkr, 9500);
  assert.equal(cutMetrics.revenueProtectionRate, 0.0);

  // Calculate metrics under Macro-Bend state
  const bendMetrics = calculateMicroOtdrMetrics(state, {
    selectedPortId: 'sfp-port-01',
    faultPreset: 'MACRO_BEND_2100M'
  });

  assert.equal(bendMetrics.linkStatus, 'Warning');
  assert.ok(bendMetrics.affectedSubscribers > 0);
  assert.ok(bendMetrics.monthlyRevenueAtRiskPkr > 0 && bendMetrics.monthlyRevenueAtRiskPkr < 9500);
  assert.ok(bendMetrics.revenueProtectionRate > 0 && bendMetrics.revenueProtectionRate < 100);

  // Check ports summary list
  assert.equal(normalMetrics.portsSummary.length, 5);
  const p1 = normalMetrics.portsSummary.find(p => p.id === 'sfp-port-01');
  assert.ok(p1);
  assert.equal(p1.isSelected, true);
});

test('renderMicroOtdrTraceSvg generates valid SVG markup in compact and modal modes', () => {
  const state = {
    ...createInitialState(['OTDR Tech']),
    customers: [
      { id: 'c1', name: 'Customer 1', area: 'Shahdara Town', status: 'Active', packagePrice: 3000 }
    ]
  };
  const metrics = calculateMicroOtdrMetrics(state, { selectedPortId: 'sfp-port-01' });

  // Compact SVG
  const compactSvg = renderMicroOtdrTraceSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="micro-otdr-svg"'));
  assert.ok(compactSvg.includes('viewBox="0 0 560 220"'));
  assert.ok(compactSvg.includes('Backscatter Power (dBm)'));
  assert.ok(compactSvg.includes('Distance (m)'));
  assert.ok(compactSvg.includes('Sens:'));

  // Full/Modal SVG
  const modalSvg = renderMicroOtdrTraceSvg(metrics, { compact: false });
  assert.ok(modalSvg.includes('<svg class="micro-otdr-svg"'));
  assert.ok(modalSvg.includes('viewBox="0 0 780 340"'));
  assert.ok(modalSvg.includes('path d='));
});

test('generateMicroOtdrReport formats comprehensive physical reflectometry audit report', () => {
  const state = {
    ...createInitialState(['OTDR Tech']),
    customers: [
      { id: 'c1', name: 'Customer 1', area: 'Shahdara Town', status: 'Active', packagePrice: 3000 }
    ]
  };
  const metrics = calculateMicroOtdrMetrics(state, {
    selectedPortId: 'sfp-port-01',
    faultPreset: 'FIBER_CUT_1400M'
  });

  const report = generateMicroOtdrReport(metrics);
  assert.ok(report.includes('SHAHDARA ISP · SFP MICRO-OTDR REFLECTOMETRY AUDIT BRIEFING'));
  assert.ok(report.includes('ITU-T G.984 / SFF-8472 / SFF-8636 EMBEDDED DIAGNOSTICS'));
  assert.ok(report.includes('Monitored Port: OLT-01 Port 1 Feeder (Shahdara Town)'));
  assert.ok(report.includes('Fault Classification: FIBER_CUT'));
  assert.ok(report.includes('Fault Location Distance: 1420 m'));
  assert.ok(report.includes('DISCRETE REFLECTION & ATTENUATION EVENT REGISTER'));
  assert.ok(report.includes('RECOMMENDED FIELD SPLICING ACTION:'));
  assert.ok(report.includes('Dispatch OTDR splicing crew'));
});

test('setupMicroOtdrModal wires interactive controls, dropdowns, slider, and clipboard copy', async () => {
  const state = {
    ...createInitialState(['OTDR Tech']),
    customers: [
      { id: 'c1', name: 'Test Customer', area: 'Shahdara Town', status: 'Active', packagePrice: 3000 }
    ]
  };

  let modalOpened = false;
  let copiedText = '';
  let toastMsg = '';
  let filterAreaTarget = '';

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };

  const mockOpenBtn = { addEventListener: (evt, fn) => { mockOpenBtn.onclick = fn; } };
  const mockCloseBtn = { addEventListener: (evt, fn) => { mockCloseBtn.onclick = fn; } };
  const mockPortSelect = { options: [], value: 'sfp-port-01', appendChild: (opt) => mockPortSelect.options.push(opt), addEventListener: (evt, fn) => { mockPortSelect.onchange = fn; } };
  const mockWavelengthSelect = { options: [], value: '1577', appendChild: (opt) => mockWavelengthSelect.options.push(opt), addEventListener: (evt, fn) => { mockWavelengthSelect.onchange = fn; } };
  const mockPulseWidthSelect = { options: [], value: '50', appendChild: (opt) => mockPulseWidthSelect.options.push(opt), addEventListener: (evt, fn) => { mockPulseWidthSelect.onchange = fn; } };
  const mockFaultSelect = { options: [], value: 'NORMAL', appendChild: (opt) => mockFaultSelect.options.push(opt), addEventListener: (evt, fn) => { mockFaultSelect.onchange = fn; } };
  const mockThreshSlider = { value: '-30.0', addEventListener: (evt, fn) => { mockThreshSlider.oninput = fn; } };
  const mockThreshVal = { textContent: '-30.0 dBm' };
  const mockResetBtn = { addEventListener: (evt, fn) => { mockResetBtn.onclick = fn; } };
  const mockKpiPortName = { textContent: '' };
  const mockKpiFaultDistance = { textContent: '', style: {} };
  const mockKpiReturnLoss = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };
  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };
  const mockFilterAreaBtn = { addEventListener: (evt, fn) => { mockFilterAreaBtn.onclick = fn; } };
  const mockCopyReportBtn = { addEventListener: (evt, fn) => { mockCopyReportBtn.onclick = fn; } };
  const mockCardChart = { innerHTML: '' };

  const elementMap = {
    'dashboardMicroOtdrModal': mockModal,
    'dashboardOpenMicroOtdrModalBtn': mockOpenBtn,
    'dashboardMicroOtdrModalCloseBtn': mockCloseBtn,
    'microOtdrPortSelect': mockPortSelect,
    'microOtdrWavelengthSelect': mockWavelengthSelect,
    'microOtdrPulseWidthSelect': mockPulseWidthSelect,
    'microOtdrFaultSelect': mockFaultSelect,
    'microOtdrThreshSlider': mockThreshSlider,
    'microOtdrThreshVal': mockThreshVal,
    'microOtdrResetBtn': mockResetBtn,
    'microOtdrKpiPortName': mockKpiPortName,
    'microOtdrKpiFaultDistance': mockKpiFaultDistance,
    'microOtdrKpiReturnLoss': mockKpiReturnLoss,
    'microOtdrStatusBadge': mockStatusBadge,
    'microOtdrKpiRevenueRisk': mockKpiRevenueRisk,
    'microOtdrModalChartWrap': mockChartWrap,
    'microOtdrEventsTableBody': mockTableBody,
    'microOtdrFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyMicroOtdrReportBtn': mockCopyReportBtn,
    'dashboardMicroOtdrChart': mockCardChart
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementMap[id] || null
  };

  try {
    setupMicroOtdrModal(state, {
      onFilterArea: (area) => { filterAreaTarget = area; },
      onToast: (msg) => { toastMsg = msg; },
      clipboard: {
        writeText: async (txt) => { copiedText = txt; }
      }
    });

    // Check initial render of card chart
    assert.ok(mockCardChart.innerHTML.includes('micro-otdr-svg'));

    // Open modal
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiPortName.textContent.includes('OLT-01'));
    assert.ok(mockChartWrap.innerHTML.includes('micro-otdr-svg'));
    assert.ok(mockTableBody.innerHTML.includes('#1'));

    // Change port
    mockPortSelect.value = 'sfp-port-02';
    mockPortSelect.onchange({ target: { value: 'sfp-port-02' } });
    assert.equal(getMicroOtdrPortId(), 'sfp-port-02');

    // Change wavelength
    mockWavelengthSelect.value = '1490';
    mockWavelengthSelect.onchange({ target: { value: '1490' } });
    assert.equal(getMicroOtdrWavelength(), '1490');

    // Change pulse width
    mockPulseWidthSelect.value = '100';
    mockPulseWidthSelect.onchange({ target: { value: '100' } });
    assert.equal(getMicroOtdrPulseWidth(), 100);

    // Change fault preset
    mockFaultSelect.value = 'FIBER_CUT_1400M';
    mockFaultSelect.onchange({ target: { value: 'FIBER_CUT_1400M' } });
    assert.equal(getMicroOtdrFaultPreset(), 'FIBER_CUT_1400M');
    assert.equal(mockStatusBadge.textContent, 'CRITICAL');

    // Change threshold slider
    mockThreshSlider.value = '-25.0';
    mockThreshSlider.oninput({ target: { value: '-25.0' } });
    assert.equal(getMicroOtdrThresholdDbm(), -25.0);
    assert.equal(mockThreshVal.textContent, '-25.0 dBm');

    // Reset button
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getMicroOtdrPortId(), 'sfp-port-01');
    assert.equal(getMicroOtdrWavelength(), '1577');
    assert.equal(getMicroOtdrPulseWidth(), 50);
    assert.equal(getMicroOtdrFaultPreset(), 'NORMAL');
    assert.equal(getMicroOtdrThresholdDbm(), -30.0);
    assert.equal(toastMsg, 'Micro-OTDR simulation reset to baseline.');

    // Filter area
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaTarget, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(copiedText.includes('SFP MICRO-OTDR REFLECTOMETRY AUDIT BRIEFING'));
    assert.equal(toastMsg, 'Micro-OTDR diagnostic briefing copied to clipboard!');

    // Close button
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetMicroOtdrSimState();
  }
});

test('Micro-OTDR state getters, setters, and boundary clamping work reliably', () => {
  resetMicroOtdrSimState();
  assert.equal(getMicroOtdrPortId(), 'sfp-port-01');

  setMicroOtdrPortId('sfp-port-03');
  assert.equal(getMicroOtdrPortId(), 'sfp-port-03');
  setMicroOtdrPortId('invalid-port');
  assert.equal(getMicroOtdrPortId(), 'sfp-port-03');

  setMicroOtdrWavelength('1550');
  assert.equal(getMicroOtdrWavelength(), '1550');
  setMicroOtdrWavelength('9999');
  assert.equal(getMicroOtdrWavelength(), '1550');

  setMicroOtdrPulseWidth(500);
  assert.equal(getMicroOtdrPulseWidth(), 500);
  setMicroOtdrPulseWidth(999);
  assert.equal(getMicroOtdrPulseWidth(), 500);

  setMicroOtdrFaultPreset('DIRTY_CONNECTOR_850M');
  assert.equal(getMicroOtdrFaultPreset(), 'DIRTY_CONNECTOR_850M');
  setMicroOtdrFaultPreset('invalid-fault');
  assert.equal(getMicroOtdrFaultPreset(), 'DIRTY_CONNECTOR_850M');

  setMicroOtdrThresholdDbm(-20.0);
  assert.equal(getMicroOtdrThresholdDbm(), -20.0);
  setMicroOtdrThresholdDbm(0.0); // Clamped to -15.0
  assert.equal(getMicroOtdrThresholdDbm(), -15.0);
  setMicroOtdrThresholdDbm(-100.0); // Clamped to -45.0
  assert.equal(getMicroOtdrThresholdDbm(), -45.0);

  resetMicroOtdrSimState();
  assert.equal(getMicroOtdrPortId(), 'sfp-port-01');
  assert.equal(getMicroOtdrWavelength(), '1577');
  assert.equal(getMicroOtdrPulseWidth(), 50);
  assert.equal(getMicroOtdrFaultPreset(), 'NORMAL');
  assert.equal(getMicroOtdrThresholdDbm(), -30.0);
});

test('MCLAG_CONSTANTS and SHAHDARA_MCLAG_TRUNKS have valid engineering specifications', () => {
  assert.ok(Array.isArray(SHAHDARA_MCLAG_TRUNKS));
  assert.equal(SHAHDARA_MCLAG_TRUNKS.length, 5);

  for (const trunk of SHAHDARA_MCLAG_TRUNKS) {
    assert.ok(trunk.id.startsWith('mclag-trunk-'));
    assert.ok(trunk.name.length > 5);
    assert.ok(trunk.role.length > 0);
    assert.ok(trunk.primaryArea.length > 0);
    assert.ok(Array.isArray(trunk.aliasAreas) && trunk.aliasAreas.length > 0);
    assert.ok(trunk.bandwidthGbps >= 20);
    assert.ok(trunk.memberLinksCount >= 2);
    assert.ok(trunk.iclBandwidthGbps > 0);
    assert.ok(trunk.defaultTrafficGbps > 0);
    assert.ok(trunk.syncMacCount > 500);
  }

  assert.equal(MCLAG_CONSTANTS.ICCP_PORT, 8888);
  assert.equal(MCLAG_CONSTANTS.LACP_VERSION, 2);
  assert.ok(MCLAG_CONSTANTS.ICCP_INTERVALS_MS.includes(100));
  assert.ok(MCLAG_CONSTANTS.FAILURE_SCENARIOS.NORMAL);
  assert.ok(MCLAG_CONSTANTS.FAILURE_SCENARIOS.MEMBER_LINK_FAIL);
  assert.ok(MCLAG_CONSTANTS.FAILURE_SCENARIOS.ICL_BREAK);
  assert.ok(MCLAG_CONSTANTS.FAILURE_SCENARIOS.NODE_A_FAIL);
});

test('calculateTrunkForwardingDynamics models normal active-active, member link failover, ICL break, and chassis failure', () => {
  const trunk = SHAHDARA_MCLAG_TRUNKS[0]; // 4x100GbE, 400Gbps, 2 links per chassis

  // 1. Normal Dual-Active
  const normalDyn = calculateTrunkForwardingDynamics(trunk, { scenario: 'NORMAL', trafficLoadGbps: 120 });
  assert.equal(normalDyn.operationalState, 'ACTIVE-ACTIVE');
  assert.equal(normalDyn.statusLevel, 'Optimal');
  assert.equal(normalDyn.switchALinksUp, 2);
  assert.equal(normalDyn.switchBLinksUp, 2);
  assert.equal(normalDyn.activeLinksCount, 4);
  assert.equal(normalDyn.iclLinkUp, true);
  assert.equal(normalDyn.switchATrafficGbps, 60);
  assert.equal(normalDyn.switchBTrafficGbps, 60);
  assert.equal(normalDyn.iclBypassTrafficGbps, 0);
  assert.equal(normalDyn.failoverTimeMs, 0);
  assert.equal(normalDyn.packetLossPercent, 0.0);
  assert.equal(normalDyn.memberLinks.length, 4);
  assert.ok(normalDyn.memberLinks.every(l => l.isUp));

  // 2. Member Link Failure on Switch A
  const memberFailDyn = calculateTrunkForwardingDynamics(trunk, { scenario: 'MEMBER_LINK_FAIL', trafficLoadGbps: 120 });
  assert.equal(memberFailDyn.operationalState, 'DEGRADED ACTIVE-ACTIVE');
  assert.equal(memberFailDyn.statusLevel, 'Warning');
  assert.equal(memberFailDyn.switchALinksUp, 1);
  assert.equal(memberFailDyn.switchBLinksUp, 2);
  assert.equal(memberFailDyn.activeLinksCount, 3);
  assert.ok(memberFailDyn.iclBypassTrafficGbps > 0);
  assert.equal(memberFailDyn.failoverTimeMs, 18);
  assert.ok(memberFailDyn.packetLossPercent > 0 && memberFailDyn.packetLossPercent < 0.1);

  // 3. ICL Peer Link Break (Split-Brain Prevention)
  const iclBreakDyn = calculateTrunkForwardingDynamics(trunk, { scenario: 'ICL_BREAK', trafficLoadGbps: 120, iccpIntervalMs: 100 });
  assert.equal(iclBreakDyn.operationalState, 'SPLIT-BRAIN ISOLATION');
  assert.equal(iclBreakDyn.statusLevel, 'Critical');
  assert.equal(iclBreakDyn.iclLinkUp, false);
  assert.equal(iclBreakDyn.switchALinksUp, 2);
  assert.equal(iclBreakDyn.switchBLinksUp, 0); // Standby node isolates ports
  assert.equal(iclBreakDyn.switchATrafficGbps, 120);
  assert.equal(iclBreakDyn.switchBTrafficGbps, 0);
  assert.equal(iclBreakDyn.failoverTimeMs, 200);

  // 4. Total Switch A Chassis Outage
  const nodeAFailDyn = calculateTrunkForwardingDynamics(trunk, { scenario: 'NODE_A_FAIL', trafficLoadGbps: 120 });
  assert.equal(nodeAFailDyn.operationalState, 'FAILOVER TO CHASSIS B');
  assert.equal(nodeAFailDyn.statusLevel, 'Critical');
  assert.equal(nodeAFailDyn.switchALinksUp, 0);
  assert.equal(nodeAFailDyn.switchBLinksUp, 2);
  assert.equal(nodeAFailDyn.switchATrafficGbps, 0);
  assert.equal(nodeAFailDyn.switchBTrafficGbps, 120);
  assert.equal(nodeAFailDyn.failoverTimeMs, 38);
});

test('calculateMclagMetrics correlates subscriber revenue exposure with failover state', () => {
  const state = {
    ...createInitialState(['MC-LAG Tech']),
    customers: [
      { id: 'c1', name: 'Shahdara Core Client 1', area: 'Shahdara Town', status: 'Active', packagePrice: 4000 },
      { id: 'c2', name: 'Railway Road Enterprise', area: 'Railway Road', status: 'Active', packagePrice: 8000 },
      { id: 'c3', name: 'Baradari Client', area: 'Baradari Road', status: 'Active', packagePrice: 3000 }
    ]
  };

  // Normal scenario
  const normalMetrics = calculateMclagMetrics(state, {
    selectedTrunkId: 'mclag-trunk-01',
    scenario: 'NORMAL',
    trafficLoadGbps: 120
  });

  assert.equal(normalMetrics.selectedTrunk.id, 'mclag-trunk-01');
  assert.equal(normalMetrics.totalAreaSubscribers, 2);
  assert.equal(normalMetrics.activeSubscribers, 2);
  assert.equal(normalMetrics.monthlyBilledRevenue, 12000); // 4000 + 8000
  assert.equal(normalMetrics.affectedSubscribers, 0);
  assert.equal(normalMetrics.monthlyRevenueAtRiskPkr, 0);
  assert.equal(normalMetrics.revenueProtectionRate, 100.0);

  // Member link failure
  const memberFailMetrics = calculateMclagMetrics(state, {
    selectedTrunkId: 'mclag-trunk-01',
    scenario: 'MEMBER_LINK_FAIL',
    trafficLoadGbps: 120
  });
  assert.equal(memberFailMetrics.monthlyRevenueAtRiskPkr, 0);
  assert.equal(memberFailMetrics.revenueProtectionRate, 100.0);

  // ICL Break scenario
  const iclBreakMetrics = calculateMclagMetrics(state, {
    selectedTrunkId: 'mclag-trunk-01',
    scenario: 'ICL_BREAK',
    trafficLoadGbps: 120
  });
  assert.ok(iclBreakMetrics.monthlyRevenueAtRiskPkr > 0);
  assert.ok(iclBreakMetrics.affectedSubscribers > 0);
  assert.ok(iclBreakMetrics.revenueProtectionRate < 100.0);

  // Trunks summary check
  assert.equal(normalMetrics.trunksSummary.length, 5);
  const t1 = normalMetrics.trunksSummary.find(t => t.id === 'mclag-trunk-01');
  assert.ok(t1);
  assert.equal(t1.isSelected, true);
});

test('renderMclagDiagramSvg generates valid compact and modal SVG topology diagrams', () => {
  const state = {
    ...createInitialState(['MC-LAG Tech']),
    customers: [
      { id: 'c1', name: 'Client 1', area: 'Shahdara Town', status: 'Active', packagePrice: 4000 }
    ]
  };
  const metrics = calculateMclagMetrics(state, { selectedTrunkId: 'mclag-trunk-01' });

  // Compact SVG
  const compactSvg = renderMclagDiagramSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="mclag-svg mclag-compact-svg"'));
  assert.ok(compactSvg.includes('viewBox="0 0 560 220"'));
  assert.ok(compactSvg.includes('CHASSIS A (Master)'));
  assert.ok(compactSvg.includes('CHASSIS B (Peer)'));
  assert.ok(compactSvg.includes('ICL (ICCP Sync)'));

  // Full / Modal SVG
  const modalSvg = renderMclagDiagramSvg(metrics, { compact: false });
  assert.ok(modalSvg.includes('<svg class="mclag-svg mclag-modal-svg"'));
  assert.ok(modalSvg.includes('viewBox="0 0 780 340"'));
  assert.ok(modalSvg.includes('VIRTUAL CHASSIS DOMAIN'));
  assert.ok(modalSvg.includes('REVENUE PROTECTION'));
});

test('generateMclagReport formats comprehensive MC-LAG engineering briefing report', () => {
  const state = {
    ...createInitialState(['MC-LAG Tech']),
    customers: [
      { id: 'c1', name: 'Client 1', area: 'Shahdara Town', status: 'Active', packagePrice: 4000 }
    ]
  };
  const metrics = calculateMclagMetrics(state, {
    selectedTrunkId: 'mclag-trunk-01',
    scenario: 'MEMBER_LINK_FAIL'
  });

  const report = generateMclagReport(metrics);
  assert.ok(report.includes('SHAHDARA ISP · MC-LAG DUAL-CHASSIS REDUNDANCY AUDIT BRIEFING'));
  assert.ok(report.includes('RFC 7275 ICCP / IEEE 802.1AX ACTIVE-ACTIVE CLUSTER TELEMETRY'));
  assert.ok(report.includes('Monitored Trunk: MC-LAG 01 Central Core Transit (4x100GbE)'));
  assert.ok(report.includes('MEMBER INTERFACE STATUS & LACP STATE MACHINE'));
  assert.ok(report.includes('SHAHDARA SUBSCRIBER REVENUE AT RISK'));
  assert.ok(report.includes('NETWORK OPERATION RECOMMENDATION:'));
  assert.ok(report.includes('Traffic is successfully bypassing via ICL'));
});

test('setupMclagModal wires interactive controls, selects, slider, reset button, and clipboard copy', async () => {
  const state = {
    ...createInitialState(['MC-LAG Tech']),
    customers: [
      { id: 'c1', name: 'Test Customer', area: 'Shahdara Town', status: 'Active', packagePrice: 4000 }
    ]
  };

  let modalOpened = false;
  let copiedText = '';
  let toastMsg = '';
  let filterAreaTarget = '';

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; },
    setAttribute: () => { modalOpened = true; },
    removeAttribute: () => { modalOpened = false; }
  };

  const mockOpenBtn = { addEventListener: (evt, fn) => { mockOpenBtn.onclick = fn; } };
  const mockCloseBtn = { addEventListener: (evt, fn) => { mockCloseBtn.onclick = fn; } };
  const mockTrunkSelect = { options: [], value: 'mclag-trunk-01', appendChild: (opt) => mockTrunkSelect.options.push(opt), addEventListener: (evt, fn) => { mockTrunkSelect.onchange = fn; } };
  const mockScenarioSelect = { options: [], value: 'NORMAL', appendChild: (opt) => mockScenarioSelect.options.push(opt), addEventListener: (evt, fn) => { mockScenarioSelect.onchange = fn; } };
  const mockRoleSelect = { options: [], value: 'CLUSTER', appendChild: (opt) => mockRoleSelect.options.push(opt), addEventListener: (evt, fn) => { mockRoleSelect.onchange = fn; } };
  const mockIccpSelect = { options: [], value: '100', appendChild: (opt) => mockIccpSelect.options.push(opt), addEventListener: (evt, fn) => { mockIccpSelect.onchange = fn; } };
  const mockLoadSlider = { value: '120', addEventListener: (evt, fn) => { mockLoadSlider.oninput = fn; } };
  const mockLoadVal = { textContent: '120 Gbps' };
  const mockResetBtn = { addEventListener: (evt, fn) => { mockResetBtn.onclick = fn; } };
  const mockKpiTrunkName = { textContent: '' };
  const mockKpiState = { textContent: '', style: {} };
  const mockKpiFailover = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };
  const mockChartWrap = { innerHTML: '' };
  const mockTableBody = { innerHTML: '' };
  const mockFilterAreaBtn = { addEventListener: (evt, fn) => { mockFilterAreaBtn.onclick = fn; } };
  const mockCopyReportBtn = { addEventListener: (evt, fn) => { mockCopyReportBtn.onclick = fn; } };
  const mockCardChart = { innerHTML: '' };

  const elementMap = {
    'dashboardMclagModal': mockModal,
    'dashboardOpenMclagModalBtn': mockOpenBtn,
    'dashboardMclagModalCloseBtn': mockCloseBtn,
    'mclagTrunkSelect': mockTrunkSelect,
    'mclagScenarioSelect': mockScenarioSelect,
    'mclagRoleSelect': mockRoleSelect,
    'mclagIccpSelect': mockIccpSelect,
    'mclagLoadSlider': mockLoadSlider,
    'mclagLoadVal': mockLoadVal,
    'mclagResetBtn': mockResetBtn,
    'mclagKpiTrunkName': mockKpiTrunkName,
    'mclagKpiState': mockKpiState,
    'mclagKpiFailover': mockKpiFailover,
    'mclagStatusBadge': mockStatusBadge,
    'mclagKpiRevenueRisk': mockKpiRevenueRisk,
    'mclagModalChartWrap': mockChartWrap,
    'mclagLinksTableBody': mockTableBody,
    'mclagFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyMclagReportBtn': mockCopyReportBtn,
    'dashboardMclagChart': mockCardChart
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementMap[id] || null
  };

  try {
    setupMclagModal(state, {
      onFilterArea: (area) => { filterAreaTarget = area; },
      onToast: (msg) => { toastMsg = msg; },
      clipboard: {
        writeText: async (txt) => { copiedText = txt; }
      }
    });

    // Check initial render of card chart
    assert.ok(mockCardChart.innerHTML.includes('mclag-svg'));

    // Open modal
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiTrunkName.textContent.includes('MC-LAG 01'));
    assert.ok(mockChartWrap.innerHTML.includes('mclag-svg'));
    assert.ok(mockTableBody.innerHTML.includes('Te1/0/1'));

    // Change trunk
    mockTrunkSelect.value = 'mclag-trunk-02';
    mockTrunkSelect.onchange({ target: { value: 'mclag-trunk-02' } });
    assert.equal(getMclagSelectedTrunk(), 'mclag-trunk-02');

    // Change scenario
    mockScenarioSelect.value = 'MEMBER_LINK_FAIL';
    mockScenarioSelect.onchange({ target: { value: 'MEMBER_LINK_FAIL' } });
    assert.equal(getMclagFailureScenario(), 'MEMBER_LINK_FAIL');
    assert.equal(mockStatusBadge.textContent, 'WARNING');

    // Change role
    mockRoleSelect.value = 'NODE_A';
    mockRoleSelect.onchange({ target: { value: 'NODE_A' } });
    assert.equal(getMclagSelectedRole(), 'NODE_A');

    // Change load slider
    mockLoadSlider.value = '150';
    mockLoadSlider.oninput({ target: { value: '150' } });
    assert.equal(getMclagTrafficLoadGbps(), 150);
    assert.equal(mockLoadVal.textContent, '150 Gbps');

    // Change ICCP interval
    mockIccpSelect.value = '50';
    mockIccpSelect.onchange({ target: { value: '50' } });
    assert.equal(getMclagIccpIntervalMs(), 50);

    // Reset button
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getMclagSelectedTrunk(), 'mclag-trunk-01');
    assert.equal(getMclagFailureScenario(), 'NORMAL');
    assert.equal(getMclagSelectedRole(), 'CLUSTER');
    assert.equal(getMclagTrafficLoadGbps(), 120);
    assert.equal(getMclagIccpIntervalMs(), 100);
    assert.equal(toastMsg, 'MC-LAG simulation reset to dual-active baseline.');

    // Filter area
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaTarget, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(copiedText.includes('MC-LAG DUAL-CHASSIS REDUNDANCY AUDIT BRIEFING'));
    assert.equal(toastMsg, 'MC-LAG engineering briefing copied to clipboard!');

    // Close button
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetMclagSimState();
  }
});

test('MC-LAG state getters, setters, and boundary clamping work reliably', () => {
  resetMclagSimState();
  assert.equal(getMclagSelectedTrunk(), 'mclag-trunk-01');

  setMclagSelectedTrunk('mclag-trunk-03');
  assert.equal(getMclagSelectedTrunk(), 'mclag-trunk-03');
  setMclagSelectedTrunk('invalid-trunk');
  assert.equal(getMclagSelectedTrunk(), 'mclag-trunk-03');

  setMclagSelectedRole('NODE_B');
  assert.equal(getMclagSelectedRole(), 'NODE_B');
  setMclagSelectedRole('invalid-role');
  assert.equal(getMclagSelectedRole(), 'NODE_B');

  setMclagFailureScenario('ICL_BREAK');
  assert.equal(getMclagFailureScenario(), 'ICL_BREAK');
  setMclagFailureScenario('invalid-scenario');
  assert.equal(getMclagFailureScenario(), 'ICL_BREAK');

  setMclagTrafficLoadGbps(80);
  assert.equal(getMclagTrafficLoadGbps(), 80);
  setMclagTrafficLoadGbps(500); // Clamped to 350
  assert.equal(getMclagTrafficLoadGbps(), 350);
  setMclagTrafficLoadGbps(1); // Clamped to 5
  assert.equal(getMclagTrafficLoadGbps(), 5);

  setMclagIccpIntervalMs(500);
  assert.equal(getMclagIccpIntervalMs(), 500);
  setMclagIccpIntervalMs(9999);
  assert.equal(getMclagIccpIntervalMs(), 500);

  resetMclagSimState();
  assert.equal(getMclagSelectedTrunk(), 'mclag-trunk-01');
  assert.equal(getMclagSelectedRole(), 'CLUSTER');
  assert.equal(getMclagFailureScenario(), 'NORMAL');
  assert.equal(getMclagTrafficLoadGbps(), 120);
  assert.equal(getMclagIccpIntervalMs(), 100);
});

test('calculateFlowspecMitigation calculates attack suppression, wire-speed TCAM policing, and link saturation', () => {
  const gw100G = SHAHDARA_FLOWSPEC_GATEWAYS.find(g => g.id === 'gw-01');
  const dropRule = SHAHDARA_FLOWSPEC_RULES.find(r => r.id === 'fs-rule-01'); // DROP DNS_AMP
  const rateLimitRule = SHAHDARA_FLOWSPEC_RULES.find(r => r.id === 'fs-rule-02'); // RATE_LIMIT_10M NTP_MONLIST
  const scrubRule = SHAHDARA_FLOWSPEC_RULES.find(r => r.id === 'fs-rule-03'); // SCRUB_REDIRECT SYN_FLOOD

  // 1. Clean Baseline (no attack)
  const baseline = calculateFlowspecMitigation(gw100G, dropRule, 'BASELINE_CLEAN', 0, 60);
  assert.equal(baseline.safeAttackVol, 0);
  assert.equal(baseline.droppedBandwidthGbps, 0);
  assert.equal(baseline.passedAttackBandwidthGbps, 0);
  assert.equal(baseline.mitigationEffectivenessPercent, 100);
  assert.equal(baseline.falsePositiveDropPercent, 0);
  assert.equal(baseline.status, FLOWSPEC_CONSTANTS.STATUS.OPTIMAL);

  // 2. Volumetric DNS Amplification Attack (45 Gbps) with DROP rule
  const dropResult = calculateFlowspecMitigation(gw100G, dropRule, 'DNS_AMP', 45, 60);
  assert.equal(dropResult.safeAttackVol, 45);
  assert.ok(dropResult.droppedBandwidthGbps >= 44.5); // ~99.5% dropped
  assert.ok(dropResult.passedAttackBandwidthGbps <= 0.5);
  assert.ok(dropResult.mitigationEffectivenessPercent >= 99);
  assert.equal(dropResult.falsePositiveDropPercent, 0.08);
  assert.ok(dropResult.tcamUsedEntries > 0);
  assert.ok(dropResult.edgeCpuLoadPercent < 80);
  assert.equal(dropResult.status, FLOWSPEC_CONSTANTS.STATUS.OPTIMAL);

  // 3. Rate-Limit 10Mbps Ingress Policer on NTP Monlist
  const rlResult = calculateFlowspecMitigation(gw100G, rateLimitRule, 'NTP_MONLIST', 20, 60);
  assert.equal(rlResult.safeAttackVol, 20);
  assert.ok(rlResult.droppedBandwidthGbps >= 19.9);
  assert.ok(rlResult.passedAttackBandwidthGbps <= 0.02);
  assert.equal(rlResult.falsePositiveDropPercent, 0.12);

  // 4. Scrubbing VRF Redirection with 60 Gbps scrubbing capacity on 40 Gbps SYN flood
  const scrubResult = calculateFlowspecMitigation(gw100G, scrubRule, 'SYN_FLOOD', 40, 60);
  assert.equal(scrubResult.scrubbedBandwidthGbps, 40);
  assert.ok(scrubResult.droppedBandwidthGbps >= 39);
  assert.equal(scrubResult.falsePositiveDropPercent, 0.02);
  assert.ok(scrubResult.responseLatencyMs > gw100G.baseLatencyMs); // redirection latency

  // 5. Massive 140 Gbps unmitigated overflow on 40G link -> CRITICAL
  const gw40G = SHAHDARA_FLOWSPEC_GATEWAYS.find(g => g.id === 'gw-02');
  const criticalResult = calculateFlowspecMitigation(gw40G, null, 'UDP_FRAG', 140, 30);
  assert.equal(criticalResult.passedAttackBandwidthGbps, 140);
  assert.equal(criticalResult.status, FLOWSPEC_CONSTANTS.STATUS.CRITICAL);
  assert.ok(criticalResult.edgeCpuLoadPercent >= 80);
});

test('calculateFlowspecMetrics correlates edge border gateway with subscriber roster and sector revenue at risk', () => {
  let state = createInitialState(['Sub Shahdara 1', 'Sub Shahdara 2', 'Sub Baradari']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Customer 0: Shahdara Town, Active, 2500 PKR bill
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '2500', status: 'pending' }, refDate);

  // Customer 1: Old Town (alias for Shahdara Town), Active, 3500 PKR bill, 1500 paid
  state.customers[1].area = 'Old Town';
  state.customers[1].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '3500', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-10', { amount: '1500', date: '2026-10-05', method: 'Cash' }, refDate);

  // Customer 2: Baradari Road (belongs to GW-02)
  state.customers[2].area = 'Baradari Road';
  state.customers[2].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '4000', status: 'pending' }, refDate);

  // Test GW-01 (Nayatel - Shahdara Town / Old Town)
  const metrics = calculateFlowspecMetrics(state, {
    gatewayId: 'gw-01',
    ruleId: 'fs-rule-01',
    vector: 'DNS_AMP',
    attackVolumeGbps: 45,
    scrubCapacityGbps: 60
  });

  assert.equal(metrics.gateway.id, 'gw-01');
  assert.equal(metrics.gateway.name, 'Nayatel 100G Border Gateway (AS23945)');
  assert.equal(metrics.rule.id, 'fs-rule-01');
  assert.equal(metrics.subscriberCorrelation.totalSubscribers, 2);
  assert.equal(metrics.subscriberCorrelation.activeSubscribers, 2);
  assert.equal(metrics.subscriberCorrelation.offlineSubscribers, 0);
  assert.equal(metrics.subscriberCorrelation.sectorMonthlyRevenue, 6000); // 2500 + 3500
  assert.equal(metrics.subscriberCorrelation.sectorTotalDues, 4500); // 2500 + 2000

  // Under normal optimal mitigation, revenue at risk is 0
  assert.equal(metrics.subscriberCorrelation.revenueAtRisk, 0);

  // Test empty state handling
  const emptyMetrics = calculateFlowspecMetrics({ customers: [] }, { gatewayId: 'gw-03' });
  assert.equal(emptyMetrics.gateway.id, 'gw-03');
  assert.equal(emptyMetrics.subscriberCorrelation.totalSubscribers, 0);
  assert.equal(emptyMetrics.subscriberCorrelation.sectorMonthlyRevenue, 0);
  assert.equal(emptyMetrics.subscriberCorrelation.revenueAtRisk, 0);
});

test('renderFlowspecDiagramSvg produces accessible and valid SVG with visual network topology and meters', () => {
  const state = createInitialState(['Test Customer']);
  const metrics = calculateFlowspecMetrics(state, {
    gatewayId: 'gw-01',
    ruleId: 'fs-rule-01',
    vector: 'DNS_AMP',
    attackVolumeGbps: 45,
    scrubCapacityGbps: 60
  });

  // 1. Full modal SVG
  const fullSvg = renderFlowspecDiagramSvg(metrics, { compact: false });
  assert.ok(fullSvg.includes('<svg class="flowspec-svg"'));
  assert.ok(fullSvg.includes('viewBox="0 0 860 380"'));
  assert.ok(fullSvg.includes('role="img"'));
  assert.ok(fullSvg.includes('BGP FLOWSPEC RFC 5575 / 8955 EDGE MITIGATION ENGINE'));
  assert.ok(fullSvg.includes('UPSTREAM'));
  assert.ok(fullSvg.includes('FLOWSPEC CONTROLLER'));
  assert.ok(fullSvg.includes('Nayatel 100G Border Gateway'));
  assert.ok(fullSvg.includes('NULL0 / SCRUB'));
  assert.ok(fullSvg.includes('SHAHDARA'));
  assert.ok(fullSvg.includes('TCAM Entries:'));
  assert.ok(fullSvg.includes('Edge CPU:'));
  assert.ok(fullSvg.includes('Link Saturation:'));
  assert.ok(fullSvg.includes('Mitigation Efficiency:'));

  // 2. Compact card SVG
  const compactSvg = renderFlowspecDiagramSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="flowspec-svg"'));
  assert.ok(compactSvg.includes('viewBox="0 0 540 280"'));

  // 3. Fallback on null/undefined
  const fallbackSvg = renderFlowspecDiagramSvg(null);
  assert.ok(fallbackSvg.includes('No BGP Flowspec metrics available.'));
});

test('generateFlowspecReport formats comprehensive NOC security audit report', () => {
  const state = createInitialState(['NOC Customer']);
  const metrics = calculateFlowspecMetrics(state, {
    gatewayId: 'gw-01',
    ruleId: 'fs-rule-01',
    vector: 'DNS_AMP',
    attackVolumeGbps: 45,
    scrubCapacityGbps: 60
  });

  const report = generateFlowspecReport(metrics);
  assert.ok(report.includes('BGP FLOWSPEC (RFC 5575 / 8955) NOC SECURITY AUDIT BRIEFING'));
  assert.ok(report.includes('Border Gateway: Nayatel 100G Border Gateway (AS23945)'));
  assert.ok(report.includes('Core Link Bandwidth: 100 Gbps'));
  assert.ok(report.includes('Attack Classification: DNS Port 53 UDP Amplification Reflection'));
  assert.ok(report.includes('Offered Attack Ingress: 45 Gbps'));
  assert.ok(report.includes('Active Flowspec Rule: FS-RULE-01: Discard UDP 53 DNS Amplification'));
  assert.ok(report.includes('Mitigation Status: OPTIMAL'));
  assert.ok(report.includes('Mitigation Effectiveness:'));
  assert.ok(report.includes('NORMAL CARRIER OPERATION'));

  // Empty metrics check
  const emptyReport = generateFlowspecReport(null);
  assert.equal(emptyReport, 'No BGP Flowspec data recorded.');
});

test('setupFlowspecModal binds DOM events, handles input updates, resets state, filters area, and copies report', async () => {
  let modalOpened = false;
  let filterAreaTarget = null;
  let toastMsg = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; }
  };
  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };
  const mockGwSelect = { value: 'gw-01', innerHTML: '', onchange: null };
  const mockVectorSelect = { value: 'DNS_AMP', innerHTML: '', onchange: null };
  const mockRuleSelect = { value: 'fs-rule-01', innerHTML: '', onchange: null };
  const mockAttackSlider = { value: '45', oninput: null };
  const mockAttackValPill = { textContent: '' };
  const mockScrubSlider = { value: '60', oninput: null };
  const mockScrubValPill = { textContent: '' };
  const mockResetBtn = { onclick: null };

  const mockKpiGatewayName = { textContent: '' };
  const mockKpiMitigationState = { textContent: '', style: {} };
  const mockKpiEffectiveness = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockRulesTableBody = { innerHTML: '' };
  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };
  const mockCardChart = { innerHTML: '' };

  const elementMap = {
    'dashboardFlowspecModal': mockModal,
    'dashboardOpenFlowspecModalBtn': mockOpenBtn,
    'dashboardFlowspecModalCloseBtn': mockCloseBtn,
    'flowspecGwSelect': mockGwSelect,
    'flowspecVectorSelect': mockVectorSelect,
    'flowspecRuleSelect': mockRuleSelect,
    'flowspecAttackSlider': mockAttackSlider,
    'flowspecAttackVal': mockAttackValPill,
    'flowspecScrubSlider': mockScrubSlider,
    'flowspecScrubVal': mockScrubValPill,
    'flowspecResetBtn': mockResetBtn,
    'flowspecKpiGatewayName': mockKpiGatewayName,
    'flowspecKpiMitigationState': mockKpiMitigationState,
    'flowspecKpiEffectiveness': mockKpiEffectiveness,
    'flowspecStatusBadge': mockStatusBadge,
    'flowspecKpiRevenueRisk': mockKpiRevenueRisk,
    'flowspecModalChartWrap': mockChartWrap,
    'flowspecRulesTableBody': mockRulesTableBody,
    'flowspecFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyFlowspecReportBtn': mockCopyReportBtn,
    'dashboardFlowspecChart': mockCardChart
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementMap[id] || null
  };

  try {
    const state = createInitialState(['DOM Test User']);
    setupFlowspecModal(state, {
      onFilterArea: (area) => { filterAreaTarget = area; },
      onToast: (msg) => { toastMsg = msg; },
      clipboard: {
        writeText: async (txt) => { copiedText = txt; }
      }
    });

    // Check initial render of card chart
    assert.ok(mockCardChart.innerHTML.includes('flowspec-svg'));

    // Open modal
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiGatewayName.textContent.includes('Nayatel 100G'));
    assert.ok(mockChartWrap.innerHTML.includes('flowspec-svg'));
    assert.ok(mockRulesTableBody.innerHTML.includes('FS-RULE-01'));

    // Change gateway to GW-02 (PTCL)
    mockGwSelect.value = 'gw-02';
    mockGwSelect.onchange({ target: { value: 'gw-02' } });
    assert.equal(getFlowspecSelectedGateway(), 'gw-02');
    assert.equal(getFlowspecAttackVector(), 'SYN_FLOOD');

    // Change vector to NTP_MONLIST
    mockVectorSelect.value = 'NTP_MONLIST';
    mockVectorSelect.onchange({ target: { value: 'NTP_MONLIST' } });
    assert.equal(getFlowspecAttackVector(), 'NTP_MONLIST');
    assert.equal(getFlowspecSelectedRule(), 'fs-rule-02');

    // Change rule to fs-rule-04
    mockRuleSelect.value = 'fs-rule-04';
    mockRuleSelect.onchange({ target: { value: 'fs-rule-04' } });
    assert.equal(getFlowspecSelectedRule(), 'fs-rule-04');

    // Change attack volume slider
    mockAttackSlider.value = '80';
    mockAttackSlider.oninput({ target: { value: '80' } });
    assert.equal(getFlowspecAttackVolumeGbps(), 80);
    assert.equal(mockAttackValPill.textContent, '80 Gbps');

    // Change scrubbing capacity slider
    mockScrubSlider.value = '90';
    mockScrubSlider.oninput({ target: { value: '90' } });
    assert.equal(getFlowspecScrubCapacityGbps(), 90);
    assert.equal(mockScrubValPill.textContent, '90 Gbps');

    // Reset button
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getFlowspecSelectedGateway(), 'gw-01');
    assert.equal(getFlowspecAttackVector(), 'DNS_AMP');
    assert.equal(getFlowspecSelectedRule(), 'fs-rule-01');
    assert.equal(getFlowspecAttackVolumeGbps(), 45);
    assert.equal(getFlowspecScrubCapacityGbps(), 60);
    assert.equal(toastMsg, 'BGP Flowspec simulation reset to baseline parameters.');

    // Filter area
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaTarget, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(copiedText.includes('BGP FLOWSPEC (RFC 5575 / 8955) NOC SECURITY AUDIT BRIEFING'));
    assert.equal(toastMsg, 'BGP Flowspec NOC briefing copied to clipboard!');

    // Close button
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetFlowspecSimState();
  }
});

test('Flowspec simulation state getters, setters, and boundary constraints work correctly', () => {
  resetFlowspecSimState();
  assert.equal(getFlowspecSelectedGateway(), 'gw-01');

  // Gateway selection & auto-configuration
  setFlowspecSelectedGateway('gw-03');
  assert.equal(getFlowspecSelectedGateway(), 'gw-03');
  assert.equal(getFlowspecAttackVector(), 'NTP_MONLIST');
  assert.equal(getFlowspecSelectedRule(), 'fs-rule-02');
  setFlowspecSelectedGateway('invalid-gw');
  assert.equal(getFlowspecSelectedGateway(), 'gw-03');

  // Threat vector selection
  setFlowspecAttackVector('ICMP_SWEEP');
  assert.equal(getFlowspecAttackVector(), 'ICMP_SWEEP');
  assert.equal(getFlowspecSelectedRule(), 'fs-rule-05');
  setFlowspecAttackVector('invalid-vector');
  assert.equal(getFlowspecAttackVector(), 'ICMP_SWEEP');

  // Rule selection
  setFlowspecSelectedRule('fs-rule-03');
  assert.equal(getFlowspecSelectedRule(), 'fs-rule-03');
  setFlowspecSelectedRule('invalid-rule');
  assert.equal(getFlowspecSelectedRule(), 'fs-rule-03');

  // Attack volume clamping [0, 150]
  setFlowspecAttackVolumeGbps(75);
  assert.equal(getFlowspecAttackVolumeGbps(), 75);
  setFlowspecAttackVolumeGbps(300); // clamped to 150
  assert.equal(getFlowspecAttackVolumeGbps(), 150);
  setFlowspecAttackVolumeGbps(-20); // clamped to 0
  assert.equal(getFlowspecAttackVolumeGbps(), 0);

  // Scrubbing capacity clamping [10, 100]
  setFlowspecScrubCapacityGbps(50);
  assert.equal(getFlowspecScrubCapacityGbps(), 50);
  setFlowspecScrubCapacityGbps(250); // clamped to 100
  assert.equal(getFlowspecScrubCapacityGbps(), 100);
  setFlowspecScrubCapacityGbps(2); // clamped to 10
  assert.equal(getFlowspecScrubCapacityGbps(), 10);

  // Reset
  resetFlowspecSimState();
  assert.equal(getFlowspecSelectedGateway(), 'gw-01');
  assert.equal(getFlowspecAttackVector(), 'DNS_AMP');
  assert.equal(getFlowspecSelectedRule(), 'fs-rule-01');
  assert.equal(getFlowspecAttackVolumeGbps(), 45);
  assert.equal(getFlowspecScrubCapacityGbps(), 60);
});

test('calculateRamanDynamics computes effective length, distributed on-off gain, OSNR boost, and DRS penalty', () => {
  const span01 = SHAHDARA_RAMAN_SPANS.find(s => s.id === 'raman-span-01'); // 42 km SMF-28e+

  // 1. Baseline 500 mW counter-pump @ 1455 nm
  const base = calculateRamanDynamics(span01, 500, 'COUNTER', 1455);
  assert.equal(base.powerMw, 500);
  assert.ok(base.effectiveLengthKm > 10 && base.effectiveLengthKm < 20); // typical Leff ~ 15.3 km for 42km fiber
  assert.ok(base.onOffGainDb >= 9.0 && base.onOffGainDb <= 16.0); // typical ~12 dB
  assert.equal(base.passiveSpanLossDb, 8.4); // 42 km * 0.20 dB/km = 8.4 dB
  assert.ok(base.netSpanGainDb > 0); // Net positive link margin
  assert.ok(base.osnrImprovementDb >= 4.0 && base.osnrImprovementDb <= 6.5);
  assert.equal(base.status, RAMAN_CONSTANTS.STATUS.OPTIMAL);
  assert.ok(base.noiseTransferRisk.includes('Counter-Propagating'));

  // 2. High power pump (950 mW) triggering DRS penalty and CRITICAL status
  const highPower = calculateRamanDynamics(span01, 950, 'COUNTER', 1455);
  assert.ok(highPower.onOffGainDb > 20.0);
  assert.ok(highPower.drsPenaltyDb > 1.2);
  assert.equal(highPower.status, RAMAN_CONSTANTS.STATUS.CRITICAL);

  // 3. Bidirectional pump scheme provides uniform gain profile
  const biPump = calculateRamanDynamics(span01, 500, 'BIDIRECTIONAL', 1455);
  assert.ok(biPump.onOffGainDb > base.onOffGainDb); // 1.15x multiplier
  assert.ok(biPump.noiseTransferRisk.includes('Co+Counter'));

  // 4. Low power 150 mW pump gives lower gain with minimal depletion
  const lowPower = calculateRamanDynamics(span01, 150, 'COUNTER', 1455);
  assert.ok(lowPower.onOffGainDb < 5.0);
  assert.equal(lowPower.drsPenaltyDb, 0.0);
});

test('calculateRamanMetrics correlates optical span with subscriber ledger, revenue, and dues', () => {
  let state = createInitialState(['Raman Cust 1', 'Raman Cust 2', 'Raman Far']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  // Customer 0: Shahdara Town, Active, 3000 PKR bill
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);

  // Customer 1: Kot Abdul Malik (alias for Span 01), Active, 2000 PKR bill, 1000 paid
  state.customers[1].area = 'Kot Abdul Malik';
  state.customers[1].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '2000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-10', { amount: '1000', date: '2026-10-06', method: 'Cash' }, refDate);

  // Customer 2: Baradari Road (belongs to Span 02)
  state.customers[2].area = 'Baradari Road';
  state.customers[2].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '4500', status: 'pending' }, refDate);

  // Test Span 01
  const metrics = calculateRamanMetrics(state, {
    spanId: 'raman-span-01',
    pumpPowerMw: 500,
    pumpScheme: 'COUNTER',
    pumpWavelengthNm: 1455
  });

  assert.equal(metrics.span.id, 'raman-span-01');
  assert.equal(metrics.subscriberCorrelation.totalSubscribers, 2);
  assert.equal(metrics.subscriberCorrelation.activeSubscribers, 2);
  assert.equal(metrics.subscriberCorrelation.sectorMonthlyRevenue, 5000); // 3000 + 2000
  assert.equal(metrics.subscriberCorrelation.sectorTotalDues, 4000); // 3000 + 1000
  assert.equal(metrics.subscriberCorrelation.revenueAtRisk, 0); // Optimal status -> 0 at risk

  // Test Empty state
  const emptyMetrics = calculateRamanMetrics({ customers: [] }, { spanId: 'raman-span-03' });
  assert.equal(emptyMetrics.span.id, 'raman-span-03');
  assert.equal(emptyMetrics.subscriberCorrelation.totalSubscribers, 0);
  assert.equal(emptyMetrics.subscriberCorrelation.sectorMonthlyRevenue, 0);
  assert.equal(emptyMetrics.subscriberCorrelation.revenueAtRisk, 0);
});

test('renderRamanDiagramSvg produces accessible and valid SVG with power curves, gauges, and legend', () => {
  const state = createInitialState(['Svg Customer']);
  const metrics = calculateRamanMetrics(state, {
    spanId: 'raman-span-01',
    pumpPowerMw: 500,
    pumpScheme: 'COUNTER',
    pumpWavelengthNm: 1455
  });

  // 1. Full modal view
  const fullSvg = renderRamanDiagramSvg(metrics, { compact: false });
  assert.ok(fullSvg.includes('<svg class="raman-svg"'));
  assert.ok(fullSvg.includes('viewBox="0 0 860 380"'));
  assert.ok(fullSvg.includes('role="img"'));
  assert.ok(fullSvg.includes('OPTICAL FIBER RAMAN AMPLIFIER (FRA) DISTRIBUTED GAIN'));
  assert.ok(fullSvg.includes('Raman Signal (+'));
  assert.ok(fullSvg.includes('Passive Loss (-'));
  assert.ok(fullSvg.includes('On-Off Gain:'));
  assert.ok(fullSvg.includes('OSNR Boost:'));
  assert.ok(fullSvg.includes('Net Gain / Margin:'));

  // 2. Compact card view
  const compactSvg = renderRamanDiagramSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="raman-svg"'));
  assert.ok(compactSvg.includes('viewBox="0 0 540 280"'));

  // 3. Null fallback
  const fallbackSvg = renderRamanDiagramSvg(null);
  assert.ok(fallbackSvg.includes('No Optical Raman metrics available.'));
});

test('generateRamanReport formats comprehensive optical engineering report', () => {
  const state = createInitialState(['NOC Customer']);
  const metrics = calculateRamanMetrics(state, {
    spanId: 'raman-span-01',
    pumpPowerMw: 500,
    pumpScheme: 'COUNTER',
    pumpWavelengthNm: 1455
  });

  const report = generateRamanReport(metrics);
  assert.ok(report.includes('OPTICAL FIBER RAMAN AMPLIFIER (ITU-T G.665) AUDIT BRIEFING'));
  assert.ok(report.includes('Optical Span: Central Ring Trunk 01: Shahdara Core to Kot Abdul Malik'));
  assert.ok(report.includes('Span Physical Length: 42 km'));
  assert.ok(report.includes('Launch Pump Power: 500 mW'));
  assert.ok(report.includes('On-Off Distributed Raman Gain: +'));
  assert.ok(report.includes('OSNR Improvement Factor: +'));
  assert.ok(report.includes('OPTIMAL CARRIER PERFORMANCE'));

  // Null fallback
  assert.equal(generateRamanReport(null), 'No Optical Raman Amplifier data recorded.');
});

test('setupRamanModal binds DOM events, handles input updates, resets state, filters area, and copies report', async () => {
  let modalOpened = false;
  let filterAreaTarget = null;
  let toastMsg = null;
  let copiedText = null;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalOpened = false; }
  };
  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };
  const mockSpanSelect = { value: 'raman-span-01', innerHTML: '', onchange: null };
  const mockSchemeSelect = { value: 'COUNTER', innerHTML: '', onchange: null };
  const mockWlSelect = { value: '1455', innerHTML: '', onchange: null };
  const mockPowerSlider = { value: '500', oninput: null };
  const mockPowerValPill = { textContent: '' };
  const mockResetBtn = { onclick: null };

  const mockKpiSpanName = { textContent: '' };
  const mockKpiGain = { textContent: '', style: {} };
  const mockKpiOsnr = { textContent: '' };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockSpansTableBody = { innerHTML: '' };
  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };
  const mockCardChart = { innerHTML: '' };

  const elementMap = {
    'dashboardRamanModal': mockModal,
    'dashboardOpenRamanModalBtn': mockOpenBtn,
    'dashboardRamanModalCloseBtn': mockCloseBtn,
    'ramanSpanSelect': mockSpanSelect,
    'ramanSchemeSelect': mockSchemeSelect,
    'ramanWlSelect': mockWlSelect,
    'ramanPowerSlider': mockPowerSlider,
    'ramanPowerVal': mockPowerValPill,
    'ramanResetBtn': mockResetBtn,
    'ramanKpiSpanName': mockKpiSpanName,
    'ramanKpiGain': mockKpiGain,
    'ramanKpiOsnr': mockKpiOsnr,
    'ramanStatusBadge': mockStatusBadge,
    'ramanKpiRevenueRisk': mockKpiRevenueRisk,
    'ramanModalChartWrap': mockChartWrap,
    'ramanSpansTableBody': mockSpansTableBody,
    'ramanFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyRamanReportBtn': mockCopyReportBtn,
    'dashboardRamanChart': mockCardChart
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elementMap[id] || null
  };

  try {
    const state = createInitialState(['DOM Test User']);
    setupRamanModal(state, {
      onFilterArea: (area) => { filterAreaTarget = area; },
      onToast: (msg) => { toastMsg = msg; },
      clipboard: {
        writeText: async (txt) => { copiedText = txt; }
      }
    });

    // Initial render
    assert.ok(mockCardChart.innerHTML.includes('raman-svg'));

    // Open modal
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    assert.ok(mockKpiSpanName.textContent.includes('Central Ring Trunk 01'));
    assert.ok(mockChartWrap.innerHTML.includes('raman-svg'));
    assert.ok(mockSpansTableBody.innerHTML.includes('RAMAN-SPAN-01'));

    // Change span to Span 02 (Baradari)
    mockSpanSelect.value = 'raman-span-02';
    mockSpanSelect.onchange({ target: { value: 'raman-span-02' } });
    assert.equal(getRamanSelectedSpan(), 'raman-span-02');
    assert.equal(getRamanPumpPowerMw(), 450);

    // Change scheme to BIDIRECTIONAL
    mockSchemeSelect.value = 'BIDIRECTIONAL';
    mockSchemeSelect.onchange({ target: { value: 'BIDIRECTIONAL' } });
    assert.equal(getRamanPumpScheme(), 'BIDIRECTIONAL');

    // Change wavelength to 1460
    mockWlSelect.value = '1460';
    mockWlSelect.onchange({ target: { value: '1460' } });
    assert.equal(getRamanPumpWavelengthNm(), 1460);

    // Change power slider
    mockPowerSlider.value = '700';
    mockPowerSlider.oninput({ target: { value: '700' } });
    assert.equal(getRamanPumpPowerMw(), 700);
    assert.equal(mockPowerValPill.textContent, '700 mW');

    // Reset button
    assert.ok(mockResetBtn.onclick !== null);
    mockResetBtn.onclick();
    assert.equal(getRamanSelectedSpan(), 'raman-span-01');
    assert.equal(getRamanPumpScheme(), 'COUNTER');
    assert.equal(getRamanPumpWavelengthNm(), 1455);
    assert.equal(getRamanPumpPowerMw(), 500);
    assert.equal(toastMsg, 'Raman Amplifier simulation reset to baseline parameters.');

    // Filter area
    assert.ok(mockFilterAreaBtn.onclick !== null);
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaTarget, 'Shahdara Town');
    assert.equal(modalOpened, false);

    // Copy report
    assert.ok(mockCopyReportBtn.onclick !== null);
    await mockCopyReportBtn.onclick();
    assert.ok(copiedText.includes('OPTICAL FIBER RAMAN AMPLIFIER (ITU-T G.665) AUDIT BRIEFING'));
    assert.equal(toastMsg, 'Optical Raman engineering report copied to clipboard!');

    // Close button
    assert.ok(mockCloseBtn.onclick !== null);
    mockCloseBtn.onclick();
    assert.equal(modalOpened, false);
  } finally {
    globalThis.document = originalDocument;
    resetRamanSimState();
  }
});

test('Raman simulation state getters, setters, and boundary constraints work correctly', () => {
  resetRamanSimState();
  assert.equal(getRamanSelectedSpan(), 'raman-span-01');

  // Span selection
  setRamanSelectedSpan('raman-span-03');
  assert.equal(getRamanSelectedSpan(), 'raman-span-03');
  assert.equal(getRamanPumpPowerMw(), 650);
  assert.equal(getRamanPumpScheme(), 'BIDIRECTIONAL');
  setRamanSelectedSpan('invalid-span');
  assert.equal(getRamanSelectedSpan(), 'raman-span-03');

  // Pump scheme
  setRamanPumpScheme('CO');
  assert.equal(getRamanPumpScheme(), 'CO');
  setRamanPumpScheme('invalid-scheme');
  assert.equal(getRamanPumpScheme(), 'CO');

  // Pump wavelength
  setRamanPumpWavelengthNm(1480);
  assert.equal(getRamanPumpWavelengthNm(), 1480);
  setRamanPumpWavelengthNm(9999);
  assert.equal(getRamanPumpWavelengthNm(), 1480);

  // Pump power clamping [100, 1000]
  setRamanPumpPowerMw(600);
  assert.equal(getRamanPumpPowerMw(), 600);
  setRamanPumpPowerMw(1800); // clamped to 1000
  assert.equal(getRamanPumpPowerMw(), 1000);
  setRamanPumpPowerMw(20); // clamped to 100
  assert.equal(getRamanPumpPowerMw(), 100);

  // Reset
  resetRamanSimState();
  assert.equal(getRamanSelectedSpan(), 'raman-span-01');
  assert.equal(getRamanPumpScheme(), 'COUNTER');
  assert.equal(getRamanPumpWavelengthNm(), 1455);
  assert.equal(getRamanPumpPowerMw(), 500);
});

test('calculateSrMplsDynamics calculates active segment list, latency, jitter, and triggers TI-LFA sub-50ms protection on high congestion or disjoint policy', () => {
  const tunnel01 = SHAHDARA_SR_LSP_TUNNELS[0];

  // Baseline optimal condition (0% congestion, LATENCY metric)
  const baseline = calculateSrMplsDynamics(tunnel01, 'LATENCY', 'SR_MPLS', 0);
  assert.equal(baseline.status, 'Optimal');
  assert.equal(baseline.isTiLfaActive, false);
  assert.deepEqual(baseline.activeSegments, [16003, 16002]);
  assert.equal(baseline.labelStackDepth, 2);
  assert.equal(baseline.headerOverheadBytes, 8); // 2 labels * 4 bytes
  assert.ok(baseline.activeLatencyMs < 2.0);
  assert.equal(baseline.slaMet, true);

  // SRv6 mode check
  const srv6Dyn = calculateSrMplsDynamics(tunnel01, 'LATENCY', 'SRV6', 0);
  assert.deepEqual(srv6Dyn.activeSrv6Segments, ['2001:db8:1::3', '2001:db8:1::2']);
  assert.equal(srv6Dyn.headerOverheadBytes, 8 + (2 * 16)); // 40 bytes SRv6 SRH

  // High congestion triggers TI-LFA fast reroute
  const congDyn = calculateSrMplsDynamics(tunnel01, 'LATENCY', 'SR_MPLS', 75);
  assert.equal(congDyn.isTiLfaActive, true);
  assert.deepEqual(congDyn.activeSegments, [16004, 16005, 16002]); // Backup path engaged
  assert.equal(congDyn.hops, 3);
  assert.ok(congDyn.rerouteReason.includes('TI-LFA Fast Reroute'));

  // Disjoint policy triggers backup path even at 0% congestion
  const disjointDyn = calculateSrMplsDynamics(tunnel01, 'DISJOINT_TE', 'SR_MPLS', 0);
  assert.equal(disjointDyn.isTiLfaActive, true);
  assert.deepEqual(disjointDyn.activeSegments, [16004, 16005, 16002]);
  assert.equal(disjointDyn.rerouteReason, 'Strict Disjoint Path TE Policy');
});

test('calculateSrMplsMetrics correlates segment routing LSP tunnel with subscriber roster, monthly billed volume, and revenue at risk', () => {
  let state = createInitialState(['SR Cust 1', 'SR Cust 2', 'SR Remote']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  state.customers[0].area = 'Shahdara Town';
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '4000', status: 'pending' }, refDate);

  state.customers[1].area = 'Kot Abdul Malik';
  state.customers[1].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '3000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-10', { amount: '1000', date: '2026-10-06', method: 'Cash' }, refDate);

  state.customers[2].area = 'Distant Unlinked Village';
  state.customers[2].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '5000', status: 'pending' }, refDate);

  const metrics = calculateSrMplsMetrics(state, {
    tunnelId: 'sr-lsp-01',
    optimizationMetric: 'LATENCY',
    planeMode: 'SR_MPLS',
    congestionPct: 0
  });

  assert.equal(metrics.tunnel.id, 'sr-lsp-01');
  assert.equal(metrics.subscriberCorrelation.totalSubscribers, 2);
  assert.equal(metrics.subscriberCorrelation.activeSubscribers, 2);
  assert.equal(metrics.subscriberCorrelation.sectorMonthlyRevenue, 7000);
  assert.equal(metrics.subscriberCorrelation.sectorTotalDues, 6000);
  assert.equal(metrics.subscriberCorrelation.revenueAtRisk, 0); // Optimal status -> 0 at risk

  // Test empty state
  const emptyMetrics = calculateSrMplsMetrics({ customers: [] }, { tunnelId: 'sr-lsp-02' });
  assert.equal(emptyMetrics.tunnel.id, 'sr-lsp-02');
  assert.equal(emptyMetrics.subscriberCorrelation.totalSubscribers, 0);
  assert.equal(emptyMetrics.subscriberCorrelation.sectorMonthlyRevenue, 0);
});

test('renderSrMplsDiagramSvg generates accessible and valid SVG with topology nodes, segment paths, label stack, and SLA gauges', () => {
  let state = createInitialState(['Test Cust']);
  const metrics = calculateSrMplsMetrics(state, {
    tunnelId: 'sr-lsp-01',
    optimizationMetric: 'LATENCY',
    planeMode: 'SR_MPLS',
    congestionPct: 20
  });

  const fullSvg = renderSrMplsDiagramSvg(metrics, { compact: false });
  assert.ok(fullSvg.includes('<svg class="sr-mpls-svg"'));
  assert.ok(fullSvg.includes('CARRIER SEGMENT ROUTING (SR-MPLS / SRv6 RFC 8402) TE MATRIX'));
  assert.ok(fullSvg.includes('PE-01'));
  assert.ok(fullSvg.includes('PE-02'));
  assert.ok(fullSvg.includes('ACTIVE SEGMENT LIST (SR_MPLS)'));
  assert.ok(fullSvg.includes('RTT Latency:'));

  const compactSvg = renderSrMplsDiagramSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="sr-mpls-svg"'));
  assert.ok(compactSvg.includes('viewBox="0 0 540 280"'));

  const fallbackSvg = renderSrMplsDiagramSvg(null);
  assert.ok(fallbackSvg.includes('No Segment Routing LSP metrics available.'));
});

test('generateSrMplsReport formats comprehensive RFC 8402/8660/8986 engineering briefing', () => {
  let state = createInitialState(['Test Cust']);
  const metrics = calculateSrMplsMetrics(state, {
    tunnelId: 'sr-lsp-01',
    optimizationMetric: 'LATENCY',
    planeMode: 'SR_MPLS',
    congestionPct: 15
  });

  const report = generateSrMplsReport(metrics);
  assert.ok(report.includes('SHAHDARA ISP CARRIER SEGMENT ROUTING (SR-MPLS / SRv6) TE LSP BRIEFING'));
  assert.ok(report.includes('MONITORED LSP TUNNEL:'));
  assert.ok(report.includes('Binding SID (BSID):'));
  assert.ok(report.includes('Active Segment List:'));
  assert.ok(report.includes('TI-LFA Protection:'));
  assert.ok(report.includes('SUBSCRIBER & REVENUE CORRELATION:'));

  assert.equal(generateSrMplsReport(null), 'No Segment Routing LSP metrics available.');
});

test('setupSrMplsModal binds DOM events, handles input updates, resets state, filters area, and copies briefing', async () => {
  let state = createInitialState(['SR Modal Cust']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '5000', status: 'pending' }, new Date('2026-10-15T12:00:00+05:00'));


  let modalOpened = false;
  let modalClosed = false;
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    removeAttribute: () => {},
    setAttribute: () => {},
    onclick: null
  };
  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };

  const mockTunnelSelect = { value: 'sr-lsp-01', innerHTML: '', onchange: null };
  const mockMetricSelect = { value: 'LATENCY', innerHTML: '', onchange: null };
  const mockPlaneSelect = { value: 'SR_MPLS', innerHTML: '', onchange: null };
  const mockCongSlider = { value: '0', oninput: null };
  const mockCongValPill = { textContent: '0%' };
  const mockResetBtn = { onclick: null };

  const mockKpiTunnelName = { textContent: '' };
  const mockKpiLatency = { textContent: '', style: {} };
  const mockKpiStack = { textContent: '', style: {} };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockTunnelsTableBody = { innerHTML: '' };

  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };
  const mockCardChart = { innerHTML: '' };

  const elementRegistry = {
    'dashboardSrMplsModal': mockModal,
    'dashboardOpenSrMplsModalBtn': mockOpenBtn,
    'dashboardSrMplsModalCloseBtn': mockCloseBtn,
    'srMplsTunnelSelect': mockTunnelSelect,
    'srMplsMetricSelect': mockMetricSelect,
    'srMplsPlaneSelect': mockPlaneSelect,
    'srMplsCongSlider': mockCongSlider,
    'srMplsCongVal': mockCongValPill,
    'srMplsResetBtn': mockResetBtn,
    'srMplsKpiTunnelName': mockKpiTunnelName,
    'srMplsKpiLatency': mockKpiLatency,
    'srMplsKpiStack': mockKpiStack,
    'srMplsStatusBadge': mockStatusBadge,
    'srMplsKpiRevenueRisk': mockKpiRevenueRisk,
    'srMplsModalChartWrap': mockChartWrap,
    'srMplsTunnelsTableBody': mockTunnelsTableBody,
    'srMplsFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopySrMplsReportBtn': mockCopyReportBtn,
    'dashboardSrMplsChart': mockCardChart
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: id => elementRegistry[id] || null
  };

  let filteredArea = null;
  let toastMsg = null;
  let copiedText = null;

  try {
    setupSrMplsModal(state, {
      onFilterArea: area => { filteredArea = area; },
      onToast: msg => { toastMsg = msg; },
      clipboard: {
        writeText: async text => { copiedText = text; }
      }
    });

    // Verification of initial render
    assert.ok(mockCardChart.innerHTML.includes('sr-mpls-svg'));
    assert.ok(mockChartWrap.innerHTML.includes('sr-mpls-svg'));
    assert.ok(mockTunnelsTableBody.innerHTML.includes('SR-LSP-01'));
    assert.ok(mockKpiTunnelName.textContent.includes('Primary Ring'));

    // Test select change: Switch tunnel to sr-lsp-02
    mockTunnelSelect.value = 'sr-lsp-02';
    mockTunnelSelect.onchange({ target: { value: 'sr-lsp-02' } });
    assert.equal(getSrMplsSelectedTunnel(), 'sr-lsp-02');

    // Test metric change: Switch to BANDWIDTH
    mockMetricSelect.value = 'BANDWIDTH';
    mockMetricSelect.onchange({ target: { value: 'BANDWIDTH' } });
    assert.equal(getSrMplsOptimizationMetric(), 'BANDWIDTH');

    // Test plane mode change: Switch to SRV6
    mockPlaneSelect.value = 'SRV6';
    mockPlaneSelect.onchange({ target: { value: 'SRV6' } });
    assert.equal(getSrMplsPlaneMode(), 'SRV6');

    // Test congestion slider input: 50%
    mockCongSlider.oninput({ target: { value: 50 } });
    assert.equal(getSrMplsInjectedCongestionPct(), 50);
    assert.equal(mockCongValPill.textContent, '50%');

    // Test reset button
    mockResetBtn.onclick();
    assert.equal(getSrMplsSelectedTunnel(), 'sr-lsp-01');
    assert.equal(getSrMplsOptimizationMetric(), 'LATENCY');
    assert.equal(getSrMplsPlaneMode(), 'SR_MPLS');
    assert.equal(getSrMplsInjectedCongestionPct(), 0);
    assert.equal(toastMsg, 'Segment Routing simulation reset to baseline parameters.');

    // Test filter area action
    mockFilterAreaBtn.onclick();
    assert.equal(filteredArea, 'Shahdara Town');
    assert.equal(modalClosed, true);

    // Test copy briefing action
    await mockCopyReportBtn.onclick();
    assert.ok(copiedText.includes('SHAHDARA ISP CARRIER SEGMENT ROUTING (SR-MPLS / SRv6) TE LSP BRIEFING'));
    assert.equal(toastMsg, 'Segment Routing TE briefing copied to clipboard!');

    // Test open and close dialog
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    mockCloseBtn.onclick();
    assert.equal(modalClosed, true);

  } finally {
    globalThis.document = originalDocument;
    resetSrMplsSimState();
  }
});


test('SR-MPLS simulation state getters, setters, and boundary constraints work correctly', () => {
  resetSrMplsSimState();
  assert.equal(getSrMplsSelectedTunnel(), 'sr-lsp-01');

  // Tunnel selection
  setSrMplsSelectedTunnel('sr-lsp-03');
  assert.equal(getSrMplsSelectedTunnel(), 'sr-lsp-03');
  setSrMplsSelectedTunnel('non-existent-tunnel');
  assert.equal(getSrMplsSelectedTunnel(), 'sr-lsp-03');

  // Metric selection
  setSrMplsOptimizationMetric('DISJOINT_TE');
  assert.equal(getSrMplsOptimizationMetric(), 'DISJOINT_TE');
  setSrMplsOptimizationMetric('INVALID_METRIC');
  assert.equal(getSrMplsOptimizationMetric(), 'DISJOINT_TE');

  // Plane mode
  setSrMplsPlaneMode('SRV6');
  assert.equal(getSrMplsPlaneMode(), 'SRV6');
  setSrMplsPlaneMode('INVALID_PLANE');
  assert.equal(getSrMplsPlaneMode(), 'SRV6');

  // Congestion percentage clamping [0, 100]
  setSrMplsInjectedCongestionPct(45);
  assert.equal(getSrMplsInjectedCongestionPct(), 45);
  setSrMplsInjectedCongestionPct(150); // clamped to 100
  assert.equal(getSrMplsInjectedCongestionPct(), 100);
  setSrMplsInjectedCongestionPct(-25); // clamped to 0
  assert.equal(getSrMplsInjectedCongestionPct(), 0);

  // Reset
  resetSrMplsSimState();
  assert.equal(getSrMplsSelectedTunnel(), 'sr-lsp-01');
  assert.equal(getSrMplsOptimizationMetric(), 'LATENCY');
  assert.equal(getSrMplsPlaneMode(), 'SR_MPLS');
  assert.equal(getSrMplsInjectedCongestionPct(), 0);
});

test('calculatePmdDynamics calculates mean DGD, Maxwellian peak DGD, SOPMD, and OSNR penalties under direct detect vs coherent DSP', () => {
  const span01 = SHAHDARA_PMD_SPANS[0];

  // Baseline optimal condition (10G NRZ, Quiet Duct, 0% strain)
  const baseline = calculatePmdDynamics(span01, '10G_NRZ', 'QUIET_DUCT', 0);
  assert.equal(baseline.status, 'Optimal');
  assert.equal(baseline.meanDgdPs, 0.39);
  assert.equal(baseline.peakDgdPs, 1.25);
  assert.ok(baseline.dgdMarginPs > 10.0); // 12.0 - 1.25
  assert.equal(baseline.coherentDspCompensated, false);
  assert.equal(baseline.outageMinutesPerYear, 0);

  // Coherent 100G DP-QPSK on modern span
  const coherentDyn = calculatePmdDynamics(span01, '100G_DP_QPSK', 'QUIET_DUCT', 0);
  assert.equal(coherentDyn.coherentDspCompensated, true);
  assert.equal(coherentDyn.maxDgdTolerancePs, 35.0);
  assert.ok(coherentDyn.dgdMarginPs > 30.0);

  // Severe aerial span with 80% induced strain triggering CRITICAL status on 10G NRZ
  const span03 = SHAHDARA_PMD_SPANS[2]; // 58km legacy aerial 0.22 ps/sqrt(km)
  const severeDyn = calculatePmdDynamics(span03, '10G_NRZ', 'AERIAL_SEVERE', 80);
  assert.ok(severeDyn.peakDgdPs > severeDyn.maxDgdTolerancePs);
  assert.equal(severeDyn.status, 'Critical');
  assert.ok(severeDyn.dgdMarginPs < 0);
  assert.ok(severeDyn.outageMinutesPerYear > 0);
});

test('calculatePmdMetrics correlates optical span with subscriber ledger, monthly billed revenue, and revenue at risk', () => {
  let state = createInitialState(['PMD Cust 1', 'PMD Cust 2', 'PMD Remote']);
  const refDate = new Date('2026-10-15T12:00:00+05:00');

  state.customers[0].area = 'Shahdara Town';
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '6000', status: 'pending' }, refDate);

  state.customers[1].area = 'Kot Abdul Malik';
  state.customers[1].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[1].id, { month: '2026-10', dueAmount: '4000', status: 'pending' }, refDate);
  state = addPayment(state, state.customers[1].id, '2026-10', { amount: '2000', date: '2026-10-06', method: 'Cash' }, refDate);

  state.customers[2].area = 'Distant Village';
  state.customers[2].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[2].id, { month: '2026-10', dueAmount: '3500', status: 'pending' }, refDate);

  const metrics = calculatePmdMetrics(state, {
    spanId: 'pmd-span-01',
    bitrate: '10G_NRZ',
    envCondition: 'QUIET_DUCT',
    strainPct: 0
  });

  assert.equal(metrics.span.id, 'pmd-span-01');
  assert.equal(metrics.subscriberCorrelation.totalSubscribers, 2);
  assert.equal(metrics.subscriberCorrelation.activeSubscribers, 2);
  assert.equal(metrics.subscriberCorrelation.sectorMonthlyRevenue, 10000);
  assert.equal(metrics.subscriberCorrelation.sectorTotalDues, 8000); // 6000 + (4000 - 2000)
  assert.equal(metrics.subscriberCorrelation.revenueAtRisk, 0);

  // Test empty state
  const emptyMetrics = calculatePmdMetrics({ customers: [] }, { spanId: 'pmd-span-02' });
  assert.equal(emptyMetrics.span.id, 'pmd-span-02');
  assert.equal(emptyMetrics.subscriberCorrelation.totalSubscribers, 0);
  assert.equal(emptyMetrics.subscriberCorrelation.sectorMonthlyRevenue, 0);
});

test('renderPmdDiagramSvg produces accessible and valid SVG with Maxwellian curve, threshold markers, and SLA gauges', () => {
  let state = createInitialState(['Test Cust']);
  const metrics = calculatePmdMetrics(state, {
    spanId: 'pmd-span-01',
    bitrate: '10G_NRZ',
    envCondition: 'QUIET_DUCT',
    strainPct: 20
  });

  const fullSvg = renderPmdDiagramSvg(metrics, { compact: false });
  assert.ok(fullSvg.includes('<svg class="pmd-svg"'));
  assert.ok(fullSvg.includes('DWDM POLARIZATION MODE DISPERSION (PMD / DGD - ITU-T G.650.2)'));
  assert.ok(fullSvg.includes('Mean:'));
  assert.ok(fullSvg.includes('SLA Limit: 12ps'));
  assert.ok(fullSvg.includes('OSNR Penalty:'));

  const compactSvg = renderPmdDiagramSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('<svg class="pmd-svg"'));
  assert.ok(compactSvg.includes('viewBox="0 0 540 280"'));

  const fallbackSvg = renderPmdDiagramSvg(null);
  assert.ok(fallbackSvg.includes('No Optical PMD metrics available.'));
});

test('generatePmdReport formats comprehensive ITU-T G.650.2 engineering briefing', () => {
  let state = createInitialState(['Test Cust']);
  const metrics = calculatePmdMetrics(state, {
    spanId: 'pmd-span-01',
    bitrate: '10G_NRZ',
    envCondition: 'QUIET_DUCT',
    strainPct: 15
  });

  const report = generatePmdReport(metrics);
  assert.ok(report.includes('SHAHDARA ISP DWDM POLARIZATION MODE DISPERSION (PMD/DGD) AUDIT BRIEFING'));
  assert.ok(report.includes('MONITORED FIBER SPAN:'));
  assert.ok(report.includes('Mean DGD (<Delta tau>):'));
  assert.ok(report.includes('Peak Instantaneous DGD:'));
  assert.ok(report.includes('Transponder Tolerance:'));
  assert.ok(report.includes('SUBSCRIBER & REVENUE CORRELATION:'));

  assert.equal(generatePmdReport(null), 'No Optical PMD metrics available.');
});

test('setupPmdModal binds DOM events, handles input updates, resets state, filters area, and copies briefing', async () => {
  let state = createInitialState(['PMD Modal Cust']);
  state.customers[0].area = 'Shahdara Town';
  state.customers[0].serviceStatus = 'active';
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-10', dueAmount: '5000', status: 'pending' }, new Date('2026-10-15T12:00:00+05:00'));

  let modalOpened = false;
  let modalClosed = false;
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    removeAttribute: () => {},
    setAttribute: () => {},
    onclick: null
  };
  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };

  const mockSpanSelect = { value: 'pmd-span-01', innerHTML: '', onchange: null };
  const mockRateSelect = { value: '10G_NRZ', innerHTML: '', onchange: null };
  const mockEnvSelect = { value: 'QUIET_DUCT', innerHTML: '', onchange: null };
  const mockStrainSlider = { value: '0', oninput: null };
  const mockStrainValPill = { textContent: '0%' };
  const mockResetBtn = { onclick: null };

  const mockKpiSpanName = { textContent: '' };
  const mockKpiMeanDgd = { textContent: '', style: {} };
  const mockKpiPeakDgd = { textContent: '', style: {} };
  const mockStatusBadge = { textContent: '', className: '' };
  const mockKpiRevenueRisk = { textContent: '' };

  const mockChartWrap = { innerHTML: '' };
  const mockSpansTableBody = { innerHTML: '' };

  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };
  const mockCardChart = { innerHTML: '' };

  const elementRegistry = {
    'dashboardPmdModal': mockModal,
    'dashboardOpenPmdModalBtn': mockOpenBtn,
    'dashboardPmdModalCloseBtn': mockCloseBtn,
    'pmdSpanSelect': mockSpanSelect,
    'pmdRateSelect': mockRateSelect,
    'pmdEnvSelect': mockEnvSelect,
    'pmdStrainSlider': mockStrainSlider,
    'pmdStrainVal': mockStrainValPill,
    'pmdResetBtn': mockResetBtn,
    'pmdKpiSpanName': mockKpiSpanName,
    'pmdKpiMeanDgd': mockKpiMeanDgd,
    'pmdKpiPeakDgd': mockKpiPeakDgd,
    'pmdStatusBadge': mockStatusBadge,
    'pmdKpiRevenueRisk': mockKpiRevenueRisk,
    'pmdModalChartWrap': mockChartWrap,
    'pmdSpansTableBody': mockSpansTableBody,
    'pmdFilterAreaBtn': mockFilterAreaBtn,
    'dashboardCopyPmdReportBtn': mockCopyReportBtn,
    'dashboardPmdChart': mockCardChart
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: id => elementRegistry[id] || null
  };

  let filteredArea = null;
  let toastMsg = null;
  let copiedText = null;

  try {
    setupPmdModal(state, {
      onFilterArea: area => { filteredArea = area; },
      onToast: msg => { toastMsg = msg; },
      clipboard: {
        writeText: async text => { copiedText = text; }
      }
    });

    // Verification of initial render
    assert.ok(mockCardChart.innerHTML.includes('pmd-svg'));
    assert.ok(mockChartWrap.innerHTML.includes('pmd-svg'));
    assert.ok(mockSpansTableBody.innerHTML.includes('PMD-SPAN-01'));
    assert.ok(mockKpiSpanName.textContent.includes('Central Core Trunk'));

    // Test select change: Switch span to pmd-span-02
    mockSpanSelect.value = 'pmd-span-02';
    mockSpanSelect.onchange({ target: { value: 'pmd-span-02' } });
    assert.equal(getPmdSelectedSpan(), 'pmd-span-02');
    assert.equal(getPmdSelectedBitrate(), '100G_DP_QPSK');

    // Test bitrate change: Switch to 40G_DP_QPSK
    mockRateSelect.value = '40G_DP_QPSK';
    mockRateSelect.onchange({ target: { value: '40G_DP_QPSK' } });
    assert.equal(getPmdSelectedBitrate(), '40G_DP_QPSK');

    // Test env condition change: Switch to AERIAL_SEVERE
    mockEnvSelect.value = 'AERIAL_SEVERE';
    mockEnvSelect.onchange({ target: { value: 'AERIAL_SEVERE' } });
    assert.equal(getPmdSelectedEnv(), 'AERIAL_SEVERE');

    // Test strain slider input: 60%
    mockStrainSlider.oninput({ target: { value: 60 } });
    assert.equal(getPmdInducedStrainPct(), 60);
    assert.equal(mockStrainValPill.textContent, '60%');

    // Test reset button
    mockResetBtn.onclick();
    assert.equal(getPmdSelectedSpan(), 'pmd-span-01');
    assert.equal(getPmdSelectedBitrate(), '10G_NRZ');
    assert.equal(getPmdSelectedEnv(), 'QUIET_DUCT');
    assert.equal(getPmdInducedStrainPct(), 0);
    assert.equal(toastMsg, 'Optical PMD simulation reset to baseline parameters.');

    // Test filter area action
    mockFilterAreaBtn.onclick();
    assert.equal(filteredArea, 'Shahdara Town');
    assert.equal(modalClosed, true);

    // Test copy briefing action
    await mockCopyReportBtn.onclick();
    assert.ok(copiedText.includes('SHAHDARA ISP DWDM POLARIZATION MODE DISPERSION (PMD/DGD) AUDIT BRIEFING'));
    assert.equal(toastMsg, 'Optical PMD/DGD briefing copied to clipboard!');

    // Test open and close dialog
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    mockCloseBtn.onclick();
    assert.equal(modalClosed, true);

  } finally {
    globalThis.document = originalDocument;
    resetPmdSimState();
  }
});

test('PMD simulation state getters, setters, and boundary constraints work correctly', () => {
  resetPmdSimState();
  assert.equal(getPmdSelectedSpan(), 'pmd-span-01');

  // Span selection
  setPmdSelectedSpan('pmd-span-03');
  assert.equal(getPmdSelectedSpan(), 'pmd-span-03');
  assert.equal(getPmdSelectedBitrate(), '10G_NRZ');
  assert.equal(getPmdSelectedEnv(), 'AERIAL_MODERATE');
  setPmdSelectedSpan('non-existent-span');
  assert.equal(getPmdSelectedSpan(), 'pmd-span-03');

  // Bitrate selection
  setPmdSelectedBitrate('200G_16QAM');
  assert.equal(getPmdSelectedBitrate(), '200G_16QAM');
  setPmdSelectedBitrate('INVALID_RATE');
  assert.equal(getPmdSelectedBitrate(), '200G_16QAM');

  // Env condition
  setPmdSelectedEnv('AERIAL_SEVERE');
  assert.equal(getPmdSelectedEnv(), 'AERIAL_SEVERE');
  setPmdSelectedEnv('INVALID_ENV');
  assert.equal(getPmdSelectedEnv(), 'AERIAL_SEVERE');

  // Strain percentage clamping [0, 100]
  setPmdInducedStrainPct(35);
  assert.equal(getPmdInducedStrainPct(), 35);
  setPmdInducedStrainPct(160); // clamped to 100
  assert.equal(getPmdInducedStrainPct(), 100);
  setPmdInducedStrainPct(-15); // clamped to 0
  assert.equal(getPmdInducedStrainPct(), 0);

  // Reset
  resetPmdSimState();
  assert.equal(getPmdSelectedSpan(), 'pmd-span-01');
  assert.equal(getPmdSelectedBitrate(), '10G_NRZ');
  assert.equal(getPmdSelectedEnv(), 'QUIET_DUCT');
  assert.equal(getPmdInducedStrainPct(), 0);
});

test('EVPN constants and predefined overlays are defined with valid properties', () => {
  assert.equal(EVPN_CONSTANTS.DEFAULT_OVERLAY_ID, 'evpn-vni-10010');
  assert.equal(EVPN_CONSTANTS.DEFAULT_IRB_MODE, 'SYMMETRIC_IRB');
  assert.equal(EVPN_CONSTANTS.DEFAULT_REPLICATION, 'HER');
  assert.equal(EVPN_CONSTANTS.DEFAULT_ARP_SUPPRESSION, true);
  assert.equal(EVPN_CONSTANTS.STANDARD_PAYLOAD_MTU, 1500);
  assert.equal(EVPN_CONSTANTS.ENCAPSULATION_OVERHEAD_BYTES, 50);
  assert.equal(EVPN_CONSTANTS.MIN_REQUIRED_UNDERLAY_MTU, 1550);
  assert.equal(EVPN_CONSTANTS.RECOMMENDED_JUMBO_MTU, 9216);
  assert.equal(EVPN_CONSTANTS.ARP_SUPPRESSION_EFFICIENCY_PCT, 88);

  assert.ok(Array.isArray(SHAHDARA_EVPN_VNIS));
  assert.equal(SHAHDARA_EVPN_VNIS.length, 5);

  SHAHDARA_EVPN_VNIS.forEach(vni => {
    assert.ok(vni.id.startsWith('evpn-vni-'));
    assert.ok(vni.vni >= 10000);
    assert.ok(vni.l3Vni >= 50000);
    assert.ok(vni.vrf.startsWith('VRF-'));
    assert.ok(vni.primaryArea.length > 0);
    assert.ok(Array.isArray(vni.aliasAreas) && vni.aliasAreas.length > 0);
    assert.ok(vni.subnet.includes('/'));
    assert.ok(vni.anycastVirtualIp.startsWith('10.140.'));
    assert.ok(vni.anycastVirtualMac.startsWith('00:00:5e:00:01:'));
    assert.ok(vni.totalMacsLearned > 0);
    assert.ok(vni.activeHosts > 0);
    assert.ok(vni.arpRequestsSec > 0);
    assert.ok(vni.bumTrafficMbps > 0);
    assert.ok(vni.unicastThroughputGbps > 0);
    assert.ok(Array.isArray(vni.vtepLeaves) && vni.vtepLeaves.length >= 2);
    assert.ok(vni.baseLatencyMs > 0);
    assert.ok(vni.underlayMtu >= 9000);
  });
});

test('calculateEvpnDynamics computes MTU headroom, fragmentation risk, and encapsulation overhead', () => {
  const vni = SHAHDARA_EVPN_VNIS[0];

  // Standard jumbo underlay (9100B)
  const dJumbo = calculateEvpnDynamics(vni, 'SYMMETRIC_IRB', 'HER', true, 0, 9100);
  assert.equal(dJumbo.underlayMtu, 9100);
  assert.equal(dJumbo.requiredMtu, 1550);
  assert.equal(dJumbo.mtuHeadroom, 7550);
  assert.equal(dJumbo.mtuStatus, 'Optimal');
  assert.equal(dJumbo.fragmentationRisk, false);

  // Borderline underlay MTU (1580B) -> Warning
  const dWarn = calculateEvpnDynamics(vni, 'SYMMETRIC_IRB', 'HER', true, 0, 1580);
  assert.equal(dWarn.mtuHeadroom, 30);
  assert.equal(dWarn.mtuStatus, 'Warning');
  assert.equal(dWarn.fragmentationRisk, false);

  // Sub-standard MTU (1500B standard ethernet without jumbo frames) -> Critical fragmentation
  const dCrit = calculateEvpnDynamics(vni, 'SYMMETRIC_IRB', 'HER', true, 0, 1500);
  assert.equal(dCrit.mtuHeadroom, -50);
  assert.equal(dCrit.mtuStatus, 'Critical');
  assert.equal(dCrit.fragmentationRisk, true);
  assert.equal(dCrit.overallStatus, 'Critical');
  assert.ok(dCrit.effectiveLatencyMs >= 4.5); // software reassembly penalty
});

test('calculateEvpnDynamics computes ARP suppression efficiency and BUM replication load', () => {
  const vni = SHAHDARA_EVPN_VNIS[0]; // vtepLeaves has 4 nodes (peerVtepCount = 3)

  // With ARP suppression enabled
  const dSuppressed = calculateEvpnDynamics(vni, 'SYMMETRIC_IRB', 'HER', true, 0, 9100);
  assert.equal(dSuppressed.arpSuppression, true);
  assert.equal(dSuppressed.suppressionEfficiencyPct, 88);
  assert.equal(dSuppressed.totalArpRequestsSec, vni.arpRequestsSec);
  assert.equal(dSuppressed.floodedArpRequestsSec, Math.round(vni.arpRequestsSec * 0.12));
  assert.equal(dSuppressed.locallySuppressedArpSec, vni.arpRequestsSec - Math.round(vni.arpRequestsSec * 0.12));
  assert.ok(dSuppressed.savedFloodingBandwidthMbps > 0);

  // With ARP suppression disabled
  const dFlooded = calculateEvpnDynamics(vni, 'SYMMETRIC_IRB', 'HER', false, 0, 9100);
  assert.equal(dFlooded.arpSuppression, false);
  assert.equal(dFlooded.suppressionEfficiencyPct, 0);
  assert.equal(dFlooded.floodedArpRequestsSec, vni.arpRequestsSec);
  assert.equal(dFlooded.locallySuppressedArpSec, 0);
  assert.equal(dFlooded.savedFloodingBandwidthMbps, 0);
  assert.ok(dFlooded.effectiveBumMbps > dSuppressed.effectiveBumMbps);

  // Multicast vs HER replication
  const dPim = calculateEvpnDynamics(vni, 'SYMMETRIC_IRB', 'PIM_SM', true, 0, 9100);
  assert.equal(dPim.replicationMode, 'PIM_SM');
  assert.equal(dPim.totalReplicatedBumThroughputMbps, dSuppressed.effectiveBumMbps); // 1x copy
  assert.equal(dSuppressed.totalReplicatedBumThroughputMbps, Number((dSuppressed.effectiveBumMbps * 3).toFixed(2))); // 3x copies
});

test('calculateEvpnDynamics evaluates Symmetric vs Asymmetric IRB forwarding latency and savings', () => {
  const vni = SHAHDARA_EVPN_VNIS[0];

  // Symmetric IRB
  const dSym = calculateEvpnDynamics(vni, 'SYMMETRIC_IRB', 'HER', true, 0, 9100);
  assert.equal(dSym.irbMode, 'SYMMETRIC_IRB');
  assert.equal(dSym.effectiveLatencyMs, vni.baseLatencyMs);
  assert.equal(dSym.latencySavedMs, 0);

  // Asymmetric IRB (Trombone routing)
  const dAsym = calculateEvpnDynamics(vni, 'ASYMMETRIC_IRB', 'HER', true, 0, 9100);
  assert.equal(dAsym.irbMode, 'ASYMMETRIC_IRB');
  assert.ok(dAsym.effectiveLatencyMs > dSym.effectiveLatencyMs * 2.5);
  assert.ok(dAsym.latencySavedMs > 2.0);
  assert.equal(dAsym.overallStatus, 'Warning');
});

test('calculateEvpnMetrics correlates overlay topology with subscriber base and revenue at risk', () => {
  const c1 = { id: 'cust-1', name: 'Shahdara Residential Customer', area: 'Shahdara Town', packagePrice: 2000, status: 'Active' };
  const c2 = { id: 'cust-2', name: 'Old Town Business', area: 'Old Town', packagePrice: 3500, status: 'Active' };
  const c3 = { id: 'cust-3', name: 'Kot Abdul Malik Enterprise', area: 'Kot Abdul Malik', packagePrice: 8000, status: 'Active' };

  const customState = {
    customers: [c1, c2, c3],
    bills: [
      { customerId: c1.id, amount: 2000, packagePrice: 2000 },
      { customerId: c2.id, amount: 3500, packagePrice: 3500 },
      { customerId: c3.id, amount: 8000, packagePrice: 8000 }
    ]
  };

  const metricsVni10010 = calculateEvpnMetrics(customState, { vniId: 'evpn-vni-10010' });
  assert.equal(metricsVni10010.vni.id, 'evpn-vni-10010');
  assert.equal(metricsVni10010.subscribers.matchedSubscribers, 2); // c1 (Shahdara Town) + c2 (Old Town)
  assert.equal(metricsVni10010.subscribers.totalMonthlyRevenueAtRisk, 5500);

  const metricsVni10020 = calculateEvpnMetrics(customState, { vniId: 'evpn-vni-10020' });
  assert.equal(metricsVni10020.vni.id, 'evpn-vni-10020');
  assert.equal(metricsVni10020.subscribers.matchedSubscribers, 1); // c3 (Kot Abdul Malik)
  assert.equal(metricsVni10020.subscribers.totalMonthlyRevenueAtRisk, 8000);
});

test('renderEvpnDiagramSvg generates compliant SVG in compact and expanded views', () => {
  const state = createInitialState();
  const metrics = calculateEvpnMetrics(state, { vniId: 'evpn-vni-10010' });

  // Compact SVG
  const svgCompact = renderEvpnDiagramSvg(metrics, { compact: true });
  assert.ok(svgCompact.includes('<svg'));
  assert.ok(svgCompact.includes('evpn-svg-compact'));
  assert.ok(svgCompact.includes('VNI 10010'));
  assert.ok(svgCompact.includes('SPINE-01-RR'));
  assert.ok(svgCompact.includes('LEAF-1'));
  assert.ok(svgCompact.includes('OVERLAY L2/L3 VNI'));

  // Expanded SVG
  const svgExpanded = renderEvpnDiagramSvg(metrics, { compact: false });
  assert.ok(svgExpanded.includes('<svg'));
  assert.ok(svgExpanded.includes('evpn-svg-expanded'));
  assert.ok(svgExpanded.includes('Shahdara Metro Core MP-BGP EVPN / VXLAN Fabric'));
  assert.ok(svgExpanded.includes('SPINE-01-CORE'));
  assert.ok(svgExpanded.includes('SPINE-02-CORE'));
  assert.ok(svgExpanded.includes('LEAF-01'));
  assert.ok(svgExpanded.includes('LEAF-02'));
  assert.ok(svgExpanded.includes('LEAF-03'));
  assert.ok(svgExpanded.includes('LEAF-04'));
  assert.ok(svgExpanded.includes('Anycast IP: 10.140.10.1'));
  assert.ok(svgExpanded.includes('VMAC: 00:00:5e:00:01:01'));
  assert.ok(svgExpanded.includes('ECMP Entropy: 16384 ports'));
});

test('generateEvpnReport formats comprehensive engineering briefing', () => {
  const state = createInitialState();
  const metrics = calculateEvpnMetrics(state, { vniId: 'evpn-vni-10010' });
  const report = generateEvpnReport(metrics);

  assert.ok(report.includes('SHAHDARA ISP CARRIER MP-BGP EVPN / VXLAN OVERLAY BRIEFING'));
  assert.ok(report.includes('L2 VNI: 10010'));
  assert.ok(report.includes('L3 VNI: 50010'));
  assert.ok(report.includes('Distributed Anycast Gateway IP: 10.140.10.1'));
  assert.ok(report.includes('Underlay MTU: 9100 Bytes'));
  assert.ok(report.includes('ARP Suppression Status: ENABLED'));
  assert.ok(report.includes('Total Active BGP EVPN NLRIs:'));
  assert.ok(report.includes('Engineering Recommendation:'));
});

test('setupEvpnModal binds UI events, controls, presets, and clipboard integration', async () => {
  const state = createInitialState();
  addCustomer(state, { name: 'Evpn Test Customer', area: 'Shahdara Town', packagePrice: 2500, status: 'Active' });

  let modalOpened = false;
  let modalClosed = false;
  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    removeAttribute: () => {},
    setAttribute: () => {},
    onclick: null
  };
  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };

  const mockVniSelect = { value: 'evpn-vni-10010', onchange: null };
  const mockIrbModeSelect = { value: 'SYMMETRIC_IRB', onchange: null };
  const mockRepSelect = { value: 'HER', onchange: null };
  const mockArpCheckbox = { checked: true, onchange: null };
  const mockSurgeSlider = { value: '0', oninput: null };
  const mockSurgeLabel = { textContent: '+0%' };
  const mockMtuSlider = { value: '9100', oninput: null };
  const mockMtuLabel = { textContent: '9100 Bytes' };
  const mockResetBtn = { onclick: null };

  const mockStatLatency = { textContent: '' };
  const mockStatArp = { textContent: '' };
  const mockStatMtu = { textContent: '', className: '' };
  const mockStatNlri = { textContent: '' };
  const mockStatBum = { textContent: '' };
  const mockStatRevenue = { textContent: '' };

  const mockDiagramContainer = { innerHTML: '' };
  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };
  const mockCardChart = { innerHTML: '' };

  const elementRegistry = {
    'dashboardEvpnModal': mockModal,
    'dashboardOpenEvpnModalBtn': mockOpenBtn,
    'dashboardEvpnModalCloseBtn': mockCloseBtn,
    'evpnVniSelect': mockVniSelect,
    'evpnIrbModeSelect': mockIrbModeSelect,
    'evpnReplicationSelect': mockRepSelect,
    'evpnArpSuppressionCheck': mockArpCheckbox,
    'evpnSurgeSlider': mockSurgeSlider,
    'evpnSurgeValueLabel': mockSurgeLabel,
    'evpnMtuSlider': mockMtuSlider,
    'evpnMtuValueLabel': mockMtuLabel,
    'evpnResetSimBtn': mockResetBtn,
    'evpnStatLatency': mockStatLatency,
    'evpnStatArp': mockStatArp,
    'evpnStatMtu': mockStatMtu,
    'evpnStatNlri': mockStatNlri,
    'evpnStatBum': mockStatBum,
    'evpnStatRevenue': mockStatRevenue,
    'evpnModalDiagramContainer': mockDiagramContainer,
    'evpnFilterAreaBtn': mockFilterAreaBtn,
    'evpnCopyReportBtn': mockCopyReportBtn,
    'dashboardEvpnChart': mockCardChart
  };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: id => elementRegistry[id] || null
  };

  let filteredArea = null;
  let toastMsg = null;
  let copiedText = null;

  try {
    setupEvpnModal(state, {
      onFilterArea: area => { filteredArea = area; },
      onToast: msg => { toastMsg = msg; },
      clipboard: {
        writeText: async text => { copiedText = text; }
      }
    });

    // Verification of initial render
    assert.ok(mockDiagramContainer.innerHTML.includes('evpn-svg-expanded'));
    assert.ok(mockStatLatency.textContent.includes('ms'));
    assert.ok(mockStatArp.textContent.includes('88%'));
    assert.ok(mockStatMtu.textContent.includes('9100B'));

    // Test select change: Switch VNI to evpn-vni-10020
    mockVniSelect.value = 'evpn-vni-10020';
    mockVniSelect.onchange({ target: { value: 'evpn-vni-10020' } });
    assert.equal(getEvpnSelectedVni(), 'evpn-vni-10020');

    // Test IRB mode change: Switch to ASYMMETRIC_IRB
    mockIrbModeSelect.value = 'ASYMMETRIC_IRB';
    mockIrbModeSelect.onchange({ target: { value: 'ASYMMETRIC_IRB' } });
    assert.equal(getEvpnSelectedIrbMode(), 'ASYMMETRIC_IRB');

    // Test replication mode change: Switch to PIM_SM
    mockRepSelect.value = 'PIM_SM';
    mockRepSelect.onchange({ target: { value: 'PIM_SM' } });
    assert.equal(getEvpnSelectedReplication(), 'PIM_SM');

    // Test ARP suppression toggle
    mockArpCheckbox.onchange({ target: { checked: false } });
    assert.equal(getEvpnArpSuppression(), false);

    // Test traffic surge slider: 50%
    mockSurgeSlider.oninput({ target: { value: 50 } });
    assert.equal(getEvpnTrafficSurgePct(), 50);
    assert.equal(mockSurgeLabel.textContent, '+50%');

    // Test MTU slider: 1550 Bytes
    mockMtuSlider.oninput({ target: { value: 1550 } });
    assert.equal(getEvpnUnderlayMtu(), 1550);
    assert.equal(mockMtuLabel.textContent, '1550 Bytes');

    // Test reset button
    mockResetBtn.onclick();
    assert.equal(getEvpnSelectedVni(), 'evpn-vni-10010');
    assert.equal(getEvpnSelectedIrbMode(), 'SYMMETRIC_IRB');
    assert.equal(getEvpnSelectedReplication(), 'HER');
    assert.equal(getEvpnArpSuppression(), true);
    assert.equal(getEvpnTrafficSurgePct(), 0);
    assert.equal(getEvpnUnderlayMtu(), 9100);

    // Test filter area action
    mockFilterAreaBtn.onclick();
    assert.equal(filteredArea, 'Shahdara Town');
    assert.equal(modalClosed, true);

    // Test copy briefing action
    await mockCopyReportBtn.onclick();
    assert.ok(copiedText.includes('SHAHDARA ISP CARRIER MP-BGP EVPN / VXLAN OVERLAY BRIEFING'));
    assert.equal(toastMsg, 'EVPN/VXLAN briefing copied to clipboard!');

    // Test open and close dialog
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    mockCloseBtn.onclick();
    assert.equal(modalClosed, true);

  } finally {
    globalThis.document = originalDocument;
    resetEvpnSimState();
  }
});

test('EVPN simulation state getters, setters, and boundary constraints work correctly', () => {
  resetEvpnSimState();
  assert.equal(getEvpnSelectedVni(), 'evpn-vni-10010');

  // VNI selection
  setEvpnSelectedVni('evpn-vni-10030');
  assert.equal(getEvpnSelectedVni(), 'evpn-vni-10030');
  setEvpnSelectedVni('non-existent-vni');
  assert.equal(getEvpnSelectedVni(), 'evpn-vni-10030');

  // IRB mode selection
  setEvpnSelectedIrbMode('ASYMMETRIC_IRB');
  assert.equal(getEvpnSelectedIrbMode(), 'ASYMMETRIC_IRB');
  setEvpnSelectedIrbMode('INVALID_IRB');
  assert.equal(getEvpnSelectedIrbMode(), 'ASYMMETRIC_IRB');

  // Replication mode selection
  setEvpnSelectedReplication('PIM_SM');
  assert.equal(getEvpnSelectedReplication(), 'PIM_SM');
  setEvpnSelectedReplication('INVALID_REP');
  assert.equal(getEvpnSelectedReplication(), 'PIM_SM');

  // ARP suppression
  setEvpnArpSuppression(false);
  assert.equal(getEvpnArpSuppression(), false);
  setEvpnArpSuppression(true);
  assert.equal(getEvpnArpSuppression(), true);

  // Traffic surge percentage clamping [0, 200]
  setEvpnTrafficSurgePct(75);
  assert.equal(getEvpnTrafficSurgePct(), 75);
  setEvpnTrafficSurgePct(300); // invalid, out of range -> unchanged
  assert.equal(getEvpnTrafficSurgePct(), 75);
  setEvpnTrafficSurgePct(-20); // invalid, out of range -> unchanged
  assert.equal(getEvpnTrafficSurgePct(), 75);

  // Underlay MTU setting clamping [1400, 9216]
  setEvpnUnderlayMtu(9000);
  assert.equal(getEvpnUnderlayMtu(), 9000);
  setEvpnUnderlayMtu(1200); // invalid, out of range -> unchanged
  assert.equal(getEvpnUnderlayMtu(), 9000);
  setEvpnUnderlayMtu(10000); // invalid, out of range -> unchanged
  assert.equal(getEvpnUnderlayMtu(), 9000);

  // Reset
  resetEvpnSimState();
  assert.equal(getEvpnSelectedVni(), 'evpn-vni-10010');
  assert.equal(getEvpnSelectedIrbMode(), 'SYMMETRIC_IRB');
  assert.equal(getEvpnSelectedReplication(), 'HER');
  assert.equal(getEvpnArpSuppression(), true);
  assert.equal(getEvpnTrafficSurgePct(), 0);
  assert.equal(getEvpnUnderlayMtu(), 9100);
});

test('calculateKerrDynamics computes accurate SPM, XPM, and FWM metrics across fiber types', () => {
  // Standard SSMF G.652.D Link
  const ssmf = calculateKerrDynamics({
    lengthKm: 28.5,
    fiberKey: 'SSMF_G652D',
    launchPowerDbm: 3.0,
    channels: 16,
    gridGhz: 100
  });

  assert.equal(ssmf.fiberKey, 'SSMF_G652D');
  assert.ok(ssmf.leffKm > 15.0 && ssmf.leffKm < 28.5, 'Effective length must be less than physical length');
  assert.ok(ssmf.gammaKm > 1.2 && ssmf.gammaKm < 1.4, 'SSMF gamma should be ~1.31 W^-1*km^-1');
  assert.ok(ssmf.phiSpmRad > 0.01 && ssmf.phiSpmRad < 0.6, 'SPM phase shift within normal bounds');
  assert.ok(ssmf.spmThresholdDbm > ssmf.launchPowerDbm, 'Launch power should be below SPM threshold');
  assert.ok(ssmf.spmThresholdMarginDb > 0, 'Positive SPM safety margin');
  assert.ok(ssmf.fwmCrosstalkDbc < -30.0, 'SSMF dispersion D=17 suppresses FWM crosstalk below -30 dBc');
  assert.equal(ssmf.status, KERR_CONSTANTS.STATUS.OPTIMAL);


  // NZDSF G.655 Link (low dispersion D=4.5, smaller Aeff=55)
  const nzdsf = calculateKerrDynamics({
    lengthKm: 22.0,
    fiberKey: 'NZDSF_G655',
    launchPowerDbm: 1.0,
    channels: 8,
    gridGhz: 50
  });

  assert.ok(nzdsf.gammaKm > 1.8, 'NZDSF should have higher gamma due to lower Aeff');
  assert.ok(nzdsf.etaFwm > ssmf.etaFwm, 'NZDSF has higher FWM phase matching efficiency than SSMF');

  // ULL G.654.E Link (large Aeff=125, ultra low loss)
  const ull = calculateKerrDynamics({
    lengthKm: 45.0,
    fiberKey: 'ULL_G654E',
    launchPowerDbm: 5.0,
    channels: 32,
    gridGhz: 100
  });

  assert.ok(ull.gammaKm < 1.0, 'ULL fiber has lower gamma due to 125 um^2 effective area');
  assert.ok(ull.spmThresholdDbm > ssmf.spmThresholdDbm, 'ULL fiber handles higher optical power threshold');

  // DSF G.653 Link (zero-dispersion C-band collapse)
  const dsf = calculateKerrDynamics({
    lengthKm: 25.0,
    fiberKey: 'DSF_G653',
    launchPowerDbm: 4.0,
    channels: 16,
    gridGhz: 50
  });

  assert.ok(dsf.fwmCrosstalkDbc >= -24.0, 'Near-zero dispersion causes severe FWM crosstalk');
  assert.equal(dsf.status, KERR_CONSTANTS.STATUS.CRITICAL);
  assert.ok(dsf.statusReason.includes('Four-Wave Mixing'));

  // SPM Critical Launch Power Test (+17.5 dBm launch)
  const spmCrit = calculateKerrDynamics({
    lengthKm: 30.0,
    fiberKey: 'SSMF_G652D',
    launchPowerDbm: 17.5,
    channels: 16,
    gridGhz: 100
  });

  assert.ok(spmCrit.phiSpmRad >= 1.0, 'Excessive launch power causes Phi_SPM >= 1.0 rad');
  assert.equal(spmCrit.status, KERR_CONSTANTS.STATUS.CRITICAL);
  assert.ok(spmCrit.statusReason.includes('SPM'));

  // Grid Spacing Impact (50 GHz vs 200 GHz)
  const grid50 = calculateKerrDynamics({ channels: 16, gridGhz: 50 });
  const grid200 = calculateKerrDynamics({ channels: 16, gridGhz: 200 });
  assert.ok(grid50.fwmCrosstalkDbc > grid200.fwmCrosstalkDbc, '50 GHz grid has significantly higher FWM mixing than 200 GHz');

  // Fallback defaults for missing/invalid params
  const defaults = calculateKerrDynamics();
  assert.equal(defaults.fiberKey, KERR_CONSTANTS.DEFAULT_FIBER_KEY);
  assert.equal(defaults.gridGhz, KERR_CONSTANTS.DEFAULT_GRID_SPACING_GHZ);
});

test('calculateKerrMetrics correlates physical dynamics with subscriber revenue and area segmentation', () => {
  let state = createInitialState(['Sub 1', 'Sub 2', 'Sub 3', 'Sub 4']);
  state.customers[0].area = 'Ravi Siphon';
  state.customers[0].serviceStatus = 'active';
  state.customers[0].bills = [{ month: '2026-10', dueAmount: '3500' }];

  state.customers[1].area = 'Shahdara Town';
  state.customers[1].serviceStatus = 'active';
  state.customers[1].bills = [{ month: '2026-10', dueAmount: '2500' }];

  state.customers[2].area = 'Kot Abdul Malik';
  state.customers[2].serviceStatus = 'offline';
  state.customers[2].bills = [{ month: '2026-10', dueAmount: '2000' }];

  state.customers[3].area = 'Unrelated Area';
  state.customers[3].serviceStatus = 'active';
  state.customers[3].bills = [{ month: '2026-10', dueAmount: '4000' }];

  // Target core link (Ravi Siphon primary, Shahdara Town & Kot Abdul Malik secondary)
  const metrics = calculateKerrMetrics(state, {
    linkId: 'kerr-link-shahdara-core',
    launchPowerDbm: 3.0
  });

  assert.equal(metrics.link.id, 'kerr-link-shahdara-core');
  assert.equal(metrics.totalLinkedSubscribers, 3);
  assert.equal(metrics.activeLinkedSubscribers, 2);
  assert.equal(metrics.monthlyRecurringRevenuePkr, 6000); // 3500 + 2500
  assert.equal(metrics.revenueAtRiskPkr, 0); // Optimal status -> 0 at risk

  // Test Warning status risk scaling
  const warningMetrics = calculateKerrMetrics(state, {
    linkId: 'kerr-link-shahdara-core',
    fiberKey: 'NZDSF_G655',
    launchPowerDbm: 2.5,
    channels: 16,
    gridGhz: 50
  });

  assert.equal(warningMetrics.dynamics.status, KERR_CONSTANTS.STATUS.WARNING);
  assert.equal(warningMetrics.revenueAtRiskPkr, Math.round(6000 * 0.35));

  // Test Critical status risk scaling
  const criticalMetrics = calculateKerrMetrics(state, {
    linkId: 'kerr-link-shahdara-core',
    fiberKey: 'DSF_G653',
    launchPowerDbm: 4.0,
    channels: 16,
    gridGhz: 50
  });

  assert.equal(criticalMetrics.dynamics.status, KERR_CONSTANTS.STATUS.CRITICAL);
  assert.equal(criticalMetrics.revenueAtRiskPkr, 6000); // 100% at risk
});


test('renderKerrDiagramSvg and generateKerrReport output valid diagrams and briefing texts', () => {
  const metrics = calculateKerrMetrics({}, {
    linkId: 'kerr-link-shahdara-core',
    launchPowerDbm: 3.0,
    channels: 16,
    gridGhz: 100
  });

  // Standard Diagram SVG
  const svg = renderKerrDiagramSvg(metrics, { compact: false });
  assert.ok(svg.includes('<svg'), 'Must produce an SVG tag');
  assert.ok(svg.includes('kerr-diagram-svg'), 'Must have class kerr-diagram-svg');
  assert.ok(svg.includes('CH1'), 'Must include channel peak markers');
  assert.ok(svg.includes('SPM Threshold'), 'Must render SPM threshold marker');
  assert.ok(svg.includes('OPTIMAL'), 'Must display status badge');

  // Compact Diagram SVG
  const compactSvg = renderKerrDiagramSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('viewBox="0 0 720 300"'), 'Compact SVG uses 720x300 viewBox');

  // Engineering Briefing Report
  const report = generateKerrReport(metrics);
  assert.ok(report.includes('SHAHDARA METRO OPTICAL TRANSPORT - KERR NONLINEARITY BRIEFING'));
  assert.ok(report.includes('Self-Phase Modulation (SPM)'));
  assert.ok(report.includes('Cross-Phase Modulation (XPM)'));
  assert.ok(report.includes('Four-Wave Mixing (FWM)'));
  assert.ok(report.includes('RECOMMENDED ENGINEERING REMEDIATION'));
});

test('setupKerrModal wires interactive controls, slider updates, reset, filtering and report copy', async () => {
  let state = createInitialState(['Shahdara Client']);
  state.customers[0].area = 'Ravi Siphon';
  state.customers[0].serviceStatus = 'active';

  let modalOpened = false;
  let modalClosed = false;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    setAttribute: () => {},
    removeAttribute: () => {}
  };

  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };
  const mockLinkSelect = { value: 'kerr-link-shahdara-core', onchange: null };
  const mockFiberSelect = { value: 'SSMF_G652D', onchange: null };
  const mockPowerSlider = { value: '3.0', oninput: null };
  const mockPowerLabel = { textContent: '' };
  const mockChannelSlider = { value: '16', oninput: null };
  const mockChannelLabel = { textContent: '' };
  const mockGridSelect = { value: '100', onchange: null };
  const mockResetBtn = { onclick: null };

  const mockStatSpm = { textContent: '', style: {} };
  const mockStatXpm = { textContent: '', style: {} };
  const mockStatFwm = { textContent: '', style: {} };
  const mockStatPenalty = { textContent: '', style: {} };
  const mockStatMargin = { textContent: '', style: {} };
  const mockStatRevenue = { textContent: '', style: {} };

  const mockDiagramContainer = { innerHTML: '' };
  const mockDashboardChart = { innerHTML: '' };
  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: id => {
      switch (id) {
        case 'dashboardKerrModal': return mockModal;
        case 'dashboardOpenKerrModalBtn': return mockOpenBtn;
        case 'dashboardKerrModalCloseBtn': return mockCloseBtn;
        case 'kerrLinkSelect': return mockLinkSelect;
        case 'kerrFiberSelect': return mockFiberSelect;
        case 'kerrPowerSlider': return mockPowerSlider;
        case 'kerrPowerValueLabel': return mockPowerLabel;
        case 'kerrChannelSlider': return mockChannelSlider;
        case 'kerrChannelValueLabel': return mockChannelLabel;
        case 'kerrGridSelect': return mockGridSelect;
        case 'kerrResetSimBtn': return mockResetBtn;
        case 'kerrStatSpm': return mockStatSpm;
        case 'kerrStatXpm': return mockStatXpm;
        case 'kerrStatFwm': return mockStatFwm;
        case 'kerrStatPenalty': return mockStatPenalty;
        case 'kerrStatMargin': return mockStatMargin;
        case 'kerrStatRevenue': return mockStatRevenue;
        case 'kerrModalDiagramContainer': return mockDiagramContainer;
        case 'dashboardKerrChart': return mockDashboardChart;
        case 'kerrFilterAreaBtn': return mockFilterAreaBtn;
        case 'kerrCopyReportBtn': return mockCopyReportBtn;
        default: return null;
      }
    }
  };

  let filterAreaInvoked = null;
  let toastMessage = null;
  let copiedClipboardText = null;

  try {
    setupKerrModal(state, {
      onFilterArea: area => { filterAreaInvoked = area; },
      onToast: msg => { toastMessage = msg; },
      clipboard: {
        writeText: async txt => { copiedClipboardText = txt; }
      }
    });

    // Test initial rendering
    assert.ok(mockStatSpm.textContent.includes('rad'));
    assert.ok(mockDiagramContainer.innerHTML.includes('<svg'));
    assert.ok(mockDashboardChart.innerHTML.includes('<svg'));

    // Test power slider interaction
    mockPowerSlider.value = '7.0';
    mockPowerSlider.oninput();
    assert.equal(getKerrLaunchPowerDbm(), 7.0);
    assert.ok(mockPowerLabel.textContent.includes('+7.0 dBm'));

    // Test channel slider interaction
    mockChannelSlider.value = '24';
    mockChannelSlider.oninput();
    assert.equal(getKerrChannelCount(), 24);
    assert.ok(mockChannelLabel.textContent.includes('24 Channels'));

    // Test fiber select interaction
    mockFiberSelect.value = 'NZDSF_G655';
    mockFiberSelect.onchange();
    assert.equal(getKerrSelectedFiberType(), 'NZDSF_G655');

    // Test grid select interaction
    mockGridSelect.value = '50';
    mockGridSelect.onchange();
    assert.equal(getKerrGridSpacingGhz(), 50);

    // Test link select interaction
    mockLinkSelect.value = 'kerr-link-kot-abdul-malik';
    mockLinkSelect.onchange();
    assert.equal(getKerrSelectedLink(), 'kerr-link-kot-abdul-malik');

    // Test reset button
    mockResetBtn.onclick();
    assert.equal(getKerrSelectedLink(), KERR_CONSTANTS.DEFAULT_LINK_ID);

    // Test filter area action
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaInvoked, 'Ravi Siphon');
    assert.ok(toastMessage.includes('Ravi Siphon'));

    // Test copy report action
    await mockCopyReportBtn.onclick();
    assert.ok(copiedClipboardText.includes('KERR NONLINEARITY BRIEFING'));
    assert.ok(toastMessage.includes('copied to clipboard'));

    // Test open and close modal
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    mockCloseBtn.onclick();
    assert.equal(modalClosed, true);

  } finally {
    globalThis.document = originalDocument;
    resetKerrSimState();
  }
});

test('Kerr simulation state getters, setters, and boundary constraints work correctly', () => {
  resetKerrSimState();
  assert.equal(getKerrSelectedLink(), 'kerr-link-shahdara-core');

  // Link selection
  setKerrSelectedLink('kerr-link-vandala-express');
  assert.equal(getKerrSelectedLink(), 'kerr-link-vandala-express');
  setKerrSelectedLink('invalid-link-id');
  assert.equal(getKerrSelectedLink(), 'kerr-link-vandala-express');

  // Fiber profile selection
  setKerrSelectedFiberType('ULL_G654E');
  assert.equal(getKerrSelectedFiberType(), 'ULL_G654E');
  setKerrSelectedFiberType('INVALID_FIBER');
  assert.equal(getKerrSelectedFiberType(), 'ULL_G654E');

  // Launch power clamping [-5.0, 12.0]
  setKerrLaunchPowerDbm(4.5);
  assert.equal(getKerrLaunchPowerDbm(), 4.5);
  setKerrLaunchPowerDbm(20.0); // out of range -> unchanged
  assert.equal(getKerrLaunchPowerDbm(), 4.5);
  setKerrLaunchPowerDbm(-10.0); // out of range -> unchanged
  assert.equal(getKerrLaunchPowerDbm(), 4.5);

  // Channel count clamping [1, 48]
  setKerrChannelCount(32);
  assert.equal(getKerrChannelCount(), 32);
  setKerrChannelCount(64); // out of range -> unchanged
  assert.equal(getKerrChannelCount(), 32);
  setKerrChannelCount(0); // out of range -> unchanged
  assert.equal(getKerrChannelCount(), 32);

  // Grid spacing restriction [50, 100, 200]
  setKerrGridSpacingGhz(50);
  assert.equal(getKerrGridSpacingGhz(), 50);
  setKerrGridSpacingGhz(75); // invalid -> unchanged
  assert.equal(getKerrGridSpacingGhz(), 50);
  setKerrGridSpacingGhz(200);
  assert.equal(getKerrGridSpacingGhz(), 200);

  // Reset to default
  resetKerrSimState();
  assert.equal(getKerrSelectedLink(), 'kerr-link-shahdara-core');
  assert.equal(getKerrSelectedFiberType(), 'SSMF_G652D');
  assert.equal(getKerrLaunchPowerDbm(), 3.0);
  assert.equal(getKerrChannelCount(), 16);
  assert.equal(getKerrGridSpacingGhz(), 100);
});

test('calculateMplsTeDynamics computes accurate headroom, unreserved bandwidth, and FRR local repair failover', () => {
  // Default LSP 101: Shahdara NOC -> Ravi Siphon Express (10G)
  const d = calculateMplsTeDynamics({
    tunnelId: 'te-lsp-shahdara-ravi-101',
    frrMode: 'FACILITY_BYPASS',
    congestionPct: 0,
    isLinkCut: false
  });

  assert.equal(d.tunnel.id, 'te-lsp-shahdara-ravi-101');
  assert.equal(d.activeCapacityMbps, 10000);
  assert.equal(d.nominalReservedMbps, 6500);
  assert.equal(d.activeTrafficLoadMbps, 6500);
  assert.equal(d.unreservedHeadroomMbps, 3500);
  assert.equal(d.utilizationPct, 65);
  assert.equal(d.failoverLatencyMs, 42.5);
  assert.equal(d.isProtectionActive, false);
  assert.equal(d.capacityDeficitMbps, 0);
  assert.equal(d.status, MPLS_TE_CONSTANTS.STATUS.OPTIMAL);

  // Congestion surge (+50%)
  const cong = calculateMplsTeDynamics({
    tunnelId: 'te-lsp-shahdara-ravi-101',
    congestionPct: 50,
    isLinkCut: false
  });
  assert.ok(cong.dynamicCongestionMbps > 0);
  assert.ok(cong.utilizationPct >= 75);
  assert.equal(cong.status, MPLS_TE_CONSTANTS.STATUS.WARNING);

  // Severe Congestion (+95%) -> Critical status
  const crit = calculateMplsTeDynamics({
    tunnelId: 'te-lsp-shahdara-ravi-101',
    congestionPct: 95,
    isLinkCut: false
  });
  assert.ok(crit.utilizationPct >= 90);
  assert.equal(crit.status, MPLS_TE_CONSTANTS.STATUS.CRITICAL);

  // Link Cut Injection (Failover to Backup Bypass Tunnel)
  const cut = calculateMplsTeDynamics({
    tunnelId: 'te-lsp-shahdara-ravi-101',
    isLinkCut: true
  });
  assert.equal(cut.isProtectionActive, true);
  assert.deepEqual(cut.activePath, cut.tunnel.backupBypassTunnel.backupEroHops);
  assert.equal(cut.status, MPLS_TE_CONSTANTS.STATUS.WARNING);
  assert.ok(cut.statusReason.includes('Link cut detected'));

  // Detour 1:1 Mode
  const detour = calculateMplsTeDynamics({
    frrMode: 'DETOUR_1TO1'
  });
  assert.equal(detour.failoverLatencyMs, 48.0);

  // Fallbacks for invalid inputs
  const fallbacks = calculateMplsTeDynamics({ tunnelId: 'invalid-id' });
  assert.equal(fallbacks.tunnel.id, MPLS_TE_CONSTANTS.DEFAULT_TUNNEL_ID);
});

test('calculateMplsTeMetrics correlates LSP protection with live subscriber revenue and area segmentation', () => {
  let state = createInitialState(['User A', 'User B', 'User C', 'User D']);
  state.customers[0].area = 'Ravi Siphon';
  state.customers[0].serviceStatus = 'active';
  state.customers[0].bills = [{ month: '2026-10', dueAmount: '3000' }];

  state.customers[1].area = 'Shahdara Town';
  state.customers[1].serviceStatus = 'active';
  state.customers[1].bills = [{ month: '2026-10', dueAmount: '2000' }];

  state.customers[2].area = 'Kot Abdul Malik';
  state.customers[2].serviceStatus = 'offline';
  state.customers[2].bills = [{ month: '2026-10', dueAmount: '1500' }];

  state.customers[3].area = 'Outside Area';
  state.customers[3].serviceStatus = 'active';
  state.customers[3].bills = [{ month: '2026-10', dueAmount: '5000' }];

  // Optimal status -> 0 revenue at risk
  const opt = calculateMplsTeMetrics(state, {
    tunnelId: 'te-lsp-shahdara-ravi-101',
    congestionPct: 0,
    isLinkCut: false
  });
  assert.equal(opt.totalLinkedSubscribers, 3);
  assert.equal(opt.activeLinkedSubscribers, 2);
  assert.equal(opt.monthlyRecurringRevenuePkr, 5000); // 3000 + 2000
  assert.equal(opt.revenueAtRiskPkr, 0);

  // Warning status -> 35% revenue at risk
  const warn = calculateMplsTeMetrics(state, {
    tunnelId: 'te-lsp-shahdara-ravi-101',
    congestionPct: 50,
    isLinkCut: false
  });
  assert.equal(warn.dynamics.status, MPLS_TE_CONSTANTS.STATUS.WARNING);
  assert.equal(warn.revenueAtRiskPkr, Math.round(5000 * 0.35));

  // Critical status -> 100% revenue at risk
  const crit = calculateMplsTeMetrics(state, {
    tunnelId: 'te-lsp-shahdara-ravi-101',
    congestionPct: 95,
    isLinkCut: false
  });
  assert.equal(crit.dynamics.status, MPLS_TE_CONSTANTS.STATUS.CRITICAL);
  assert.equal(crit.revenueAtRiskPkr, 5000);
});

test('renderMplsTeDiagramSvg and generateMplsTeReport output valid diagrams and briefing reports', () => {
  const metrics = calculateMplsTeMetrics({}, { tunnelId: 'te-lsp-shahdara-ravi-101' });

  // Standard Diagram SVG
  const svg = renderMplsTeDiagramSvg(metrics, { compact: false });
  assert.ok(svg.includes('<svg'), 'Must produce an SVG tag');
  assert.ok(svg.includes('mpls-te-diagram-svg'), 'Must have mpls-te-diagram-svg class');
  assert.ok(svg.includes('Point of Local Repair (PLR)'), 'Must render PLR node');
  assert.ok(svg.includes('Merge Point (MP)'), 'Must render MP node');
  assert.ok(svg.includes('OPTIMAL'), 'Must display status badge');

  // Compact Diagram SVG
  const compactSvg = renderMplsTeDiagramSvg(metrics, { compact: true });
  assert.ok(compactSvg.includes('viewBox="0 0 720 300"'), 'Compact SVG uses 720x300 viewBox');

  // Link Cut SVG representation
  const cutMetrics = calculateMplsTeMetrics({}, { tunnelId: 'te-lsp-shahdara-ravi-101', isLinkCut: true });
  const cutSvg = renderMplsTeDiagramSvg(cutMetrics, { compact: false });
  assert.ok(cutSvg.includes('CUT FAULT'), 'Cut state must display cut fault label');

  // Briefing Report
  const report = generateMplsTeReport(metrics);
  assert.ok(report.includes('SHAHDARA METRO MPLS-TE & FAST REROUTE (FRR) PROTECTION BRIEFING'));
  assert.ok(report.includes('RFC 3209 (RSVP-TE) / RFC 4090'));
  assert.ok(report.includes('BANDWIDTH ACCOUNTING & UNRESERVED HEADROOM'));
  assert.ok(report.includes('RECOMMENDED ACTION'));
});

test('setupMplsTeModal wires interactive controls, slider updates, link cut toggle, filtering, and report copy', async () => {
  let state = createInitialState(['Client X']);
  state.customers[0].area = 'Ravi Siphon';
  state.customers[0].serviceStatus = 'active';

  let modalOpened = false;
  let modalClosed = false;

  const mockModal = {
    showModal: () => { modalOpened = true; },
    close: () => { modalClosed = true; },
    setAttribute: () => {},
    removeAttribute: () => {}
  };

  const mockOpenBtn = { onclick: null };
  const mockCloseBtn = { onclick: null };
  const mockTunnelSelect = { value: 'te-lsp-shahdara-ravi-101', onchange: null };
  const mockFrrSelect = { value: 'FACILITY_BYPASS', onchange: null };
  const mockCongestionSlider = { value: '0', oninput: null };
  const mockCongestionLabel = { textContent: '' };
  const mockLinkCutCheck = { checked: false, onchange: null };
  const mockResetBtn = { onclick: null };

  const mockStatUtil = { textContent: '', style: {} };
  const mockStatHeadroom = { textContent: '', style: {} };
  const mockStatLatency = { textContent: '', style: {} };
  const mockStatDeficit = { textContent: '', style: {} };
  const mockStatStatus = { textContent: '', style: {} };
  const mockStatRevenue = { textContent: '', style: {} };

  const mockDiagramContainer = { innerHTML: '' };
  const mockDashboardChart = { innerHTML: '' };
  const mockFilterAreaBtn = { onclick: null };
  const mockCopyReportBtn = { onclick: null };

  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: id => {
      switch (id) {
        case 'dashboardMplsTeModal': return mockModal;
        case 'dashboardOpenMplsTeModalBtn': return mockOpenBtn;
        case 'dashboardMplsTeModalCloseBtn': return mockCloseBtn;
        case 'mplsTeTunnelSelect': return mockTunnelSelect;
        case 'mplsTeFrrSelect': return mockFrrSelect;
        case 'mplsTeCongestionSlider': return mockCongestionSlider;
        case 'mplsTeCongestionValueLabel': return mockCongestionLabel;
        case 'mplsTeLinkCutCheck': return mockLinkCutCheck;
        case 'mplsTeResetSimBtn': return mockResetBtn;
        case 'mplsTeStatUtil': return mockStatUtil;
        case 'mplsTeStatHeadroom': return mockStatHeadroom;
        case 'mplsTeStatLatency': return mockStatLatency;
        case 'mplsTeStatDeficit': return mockStatDeficit;
        case 'mplsTeStatStatus': return mockStatStatus;
        case 'mplsTeStatRevenue': return mockStatRevenue;
        case 'mplsTeModalDiagramContainer': return mockDiagramContainer;
        case 'dashboardMplsTeChart': return mockDashboardChart;
        case 'mplsTeFilterAreaBtn': return mockFilterAreaBtn;
        case 'mplsTeCopyReportBtn': return mockCopyReportBtn;
        default: return null;
      }
    }
  };

  let filterAreaInvoked = null;
  let toastMessage = null;
  let copiedClipboardText = null;

  try {
    setupMplsTeModal(state, {
      onFilterArea: area => { filterAreaInvoked = area; },
      onToast: msg => { toastMessage = msg; },
      clipboard: {
        writeText: async txt => { copiedClipboardText = txt; }
      }
    });

    // Test initial rendering
    assert.ok(mockStatUtil.textContent.includes('%'));
    assert.ok(mockDiagramContainer.innerHTML.includes('<svg'));
    assert.ok(mockDashboardChart.innerHTML.includes('<svg'));

    // Test congestion slider interaction
    mockCongestionSlider.value = '40';
    mockCongestionSlider.oninput();
    assert.equal(getMplsTeCongestionPct(), 40);
    assert.ok(mockCongestionLabel.textContent.includes('+40%'));

    // Test link cut checkbox interaction
    mockLinkCutCheck.checked = true;
    mockLinkCutCheck.onchange();
    assert.equal(getMplsTeLinkCutInjected(), true);

    // Test FRR select interaction
    mockFrrSelect.value = 'DETOUR_1TO1';
    mockFrrSelect.onchange();
    assert.equal(getMplsTeFrrMode(), 'DETOUR_1TO1');

    // Test tunnel select interaction
    mockTunnelSelect.value = 'te-lsp-shahdara-kam-102';
    mockTunnelSelect.onchange();
    assert.equal(getMplsTeSelectedTunnel(), 'te-lsp-shahdara-kam-102');

    // Test reset button
    mockResetBtn.onclick();
    assert.equal(getMplsTeSelectedTunnel(), MPLS_TE_CONSTANTS.DEFAULT_TUNNEL_ID);
    assert.equal(getMplsTeLinkCutInjected(), false);

    // Test filter area action
    mockFilterAreaBtn.onclick();
    assert.equal(filterAreaInvoked, 'Ravi Siphon');
    assert.ok(toastMessage.includes('Ravi Siphon'));

    // Test copy report action
    await mockCopyReportBtn.onclick();
    assert.ok(copiedClipboardText.includes('MPLS-TE & FAST REROUTE'));
    assert.ok(toastMessage.includes('copied to clipboard'));

    // Test open and close modal
    mockOpenBtn.onclick();
    assert.equal(modalOpened, true);
    mockCloseBtn.onclick();
    assert.equal(modalClosed, true);

  } finally {
    globalThis.document = originalDocument;
    resetMplsTeSimState();
  }
});

test('MPLS-TE simulation state getters, setters, and boundary constraints work correctly', () => {
  resetMplsTeSimState();
  assert.equal(getMplsTeSelectedTunnel(), 'te-lsp-shahdara-ravi-101');

  // Tunnel selection
  setMplsTeSelectedTunnel('te-lsp-baradari-transit-104');
  assert.equal(getMplsTeSelectedTunnel(), 'te-lsp-baradari-transit-104');
  setMplsTeSelectedTunnel('non-existent-tunnel');
  assert.equal(getMplsTeSelectedTunnel(), 'te-lsp-baradari-transit-104');

  // FRR mode
  setMplsTeFrrMode('DETOUR_1TO1');
  assert.equal(getMplsTeFrrMode(), 'DETOUR_1TO1');
  setMplsTeFrrMode('INVALID_MODE');
  assert.equal(getMplsTeFrrMode(), 'DETOUR_1TO1');

  // Congestion percentage clamping [0, 100]
  setMplsTeCongestionPct(60);
  assert.equal(getMplsTeCongestionPct(), 60);
  setMplsTeCongestionPct(150); // out of range -> unchanged
  assert.equal(getMplsTeCongestionPct(), 60);
  setMplsTeCongestionPct(-10); // out of range -> unchanged
  assert.equal(getMplsTeCongestionPct(), 60);

  // Link cut toggle
  setMplsTeLinkCutInjected(true);
  assert.equal(getMplsTeLinkCutInjected(), true);
  setMplsTeLinkCutInjected(false);
  assert.equal(getMplsTeLinkCutInjected(), false);

  // Reset to default
  resetMplsTeSimState();
  assert.equal(getMplsTeSelectedTunnel(), 'te-lsp-shahdara-ravi-101');
  assert.equal(getMplsTeFrrMode(), 'FACILITY_BYPASS');
  assert.equal(getMplsTeCongestionPct(), 0);
  assert.equal(getMplsTeLinkCutInjected(), false);
});

// ============================================================================
// Carrier Ethernet E-Line / E-LAN (MEF 6.2 / 10.3 / RFC 4115 trTCM) Tests
// ============================================================================

test('MEF_ETHERNET_CONSTANTS and SHAHDARA_MEF_SERVICES contain valid specifications', async () => {
  const { MEF_ETHERNET_CONSTANTS, SHAHDARA_MEF_SERVICES } = await import('../dashboard.js');

  assert.ok(MEF_ETHERNET_CONSTANTS.DEFAULT_SERVICE_ID);
  assert.equal(MEF_ETHERNET_CONSTANTS.STATUS.OPTIMAL, 'Optimal');
  assert.equal(MEF_ETHERNET_CONSTANTS.STATUS.CRITICAL, 'Critical');

  assert.ok(Array.isArray(SHAHDARA_MEF_SERVICES));
  assert.equal(SHAHDARA_MEF_SERVICES.length, 5);

  const bankService = SHAHDARA_MEF_SERVICES.find(s => s.id === 'mef-eline-nbp-bank-101');
  assert.ok(bankService);
  assert.equal(bankService.cirMbps, 100);
  assert.equal(bankService.eirMbps, 20);
  assert.ok(bankService.availabilitySlaPct >= 99.9);
});

test('calculateMefEthernetDynamics computes correct 3-color policing rates and SLA verdicts', async () => {
  const { calculateMefEthernetDynamics } = await import('../dashboard.js');

  // Case 1: Conforming traffic (offered 80 Mbps <= CIR 100 Mbps)
  const conforming = calculateMefEthernetDynamics({
    serviceId: 'mef-eline-nbp-bank-101',
    cirMbps: 100,
    eirMbps: 20,
    offeredMbps: 80
  });
  assert.equal(conforming.greenMbps, 80);
  assert.equal(conforming.yellowMbps, 0);
  assert.equal(conforming.redDropMbps, 0);
  assert.equal(conforming.dropPct, 0);
  assert.equal(conforming.status, 'Optimal');
  assert.equal(conforming.slaVerdict, 'SLA_COMPLIANT_CONFORMING');

  // Case 2: Excess traffic (offered 115 Mbps, CIR 100, EIR 20)
  const excess = calculateMefEthernetDynamics({
    serviceId: 'mef-eline-nbp-bank-101',
    cirMbps: 100,
    eirMbps: 20,
    offeredMbps: 115
  });
  assert.equal(excess.greenMbps, 100);
  assert.equal(excess.yellowMbps, 15);
  assert.equal(excess.redDropMbps, 0);
  assert.equal(excess.status, 'Congested');
  assert.equal(excess.slaVerdict, 'YELLOW_BEST_EFFORT_FORWARD');

  // Case 3: Violating traffic (offered 150 Mbps, CIR 100, EIR 20 -> 30 Mbps Red drop)
  const violating = calculateMefEthernetDynamics({
    serviceId: 'mef-eline-nbp-bank-101',
    cirMbps: 100,
    eirMbps: 20,
    offeredMbps: 150
  });
  assert.equal(violating.greenMbps, 100);
  assert.equal(violating.yellowMbps, 20);
  assert.equal(violating.redDropMbps, 30);
  assert.equal(violating.dropPct, 20);
  assert.ok(violating.status === 'Degraded' || violating.status === 'Critical');

  // Case 4: Coupling flag spillover (CF=1)
  const coupled = calculateMefEthernetDynamics({
    serviceId: 'mef-eline-nbp-bank-101',
    cirMbps: 100,
    eirMbps: 20,
    offeredMbps: 110,
    couplingFlag: true
  });
  assert.equal(coupled.couplingFlag, true);
  assert.equal(coupled.greenMbps, 100);
  assert.equal(coupled.yellowMbps, 10);
});

test('calculateMefEthernetMetrics correlates linked customers and revenue exposure', async () => {
  const { calculateMefEthernetMetrics } = await import('../dashboard.js');

  const mockState = {
    customers: [
      { id: 'c1', area: 'Shahdara Town', packagePrice: 3500, balance: 1500, archived: false },
      { id: 'c2', area: 'Shahdara Town', packagePrice: 4500, balance: 0, archived: false },
      { id: 'c3', area: 'Begum Kot', packagePrice: 5000, balance: 2000, archived: false },
      { id: 'c4', area: 'Unrelated Area', packagePrice: 2000, balance: 500, archived: false },
      { id: 'c5', area: 'Shahdara Town', packagePrice: 3000, balance: 0, archived: true } // archived excluded
    ]
  };

  const metrics = calculateMefEthernetMetrics(mockState, {
    serviceId: 'mef-eline-nbp-bank-101',
    cirMbps: 100,
    eirMbps: 20,
    offeredMbps: 150 // Red drop = 30 Mbps = 20%
  });

  assert.equal(metrics.linkedCustomerCount, 3); // c1, c2, c3
  assert.equal(metrics.monthlyRevenuePkr, 13000); // 3500 + 4500 + 5000
  assert.equal(metrics.totalDuesPkr, 3500); // 1500 + 2000
  assert.equal(metrics.revenueAtRiskPkr, 2600); // 20% of 13000
});

test('renderMefCarrierEthernetSvg generates valid compact and full SVG markup', async () => {
  const { calculateMefEthernetDynamics, renderMefCarrierEthernetSvg } = await import('../dashboard.js');

  const dynamics = calculateMefEthernetDynamics({
    serviceId: 'mef-eline-nbp-bank-101',
    cirMbps: 100,
    eirMbps: 20,
    offeredMbps: 110
  });

  const compactSvg = renderMefCarrierEthernetSvg(dynamics, { compact: true });
  assert.ok(compactSvg.includes('<svg'));
  assert.ok(compactSvg.includes('mef-compact-svg'));
  assert.ok(compactSvg.includes('CIR (GREEN)'));
  assert.ok(compactSvg.includes('EIR (YELLOW)'));

  const fullSvg = renderMefCarrierEthernetSvg(dynamics, { compact: false });
  assert.ok(fullSvg.includes('<svg'));
  assert.ok(fullSvg.includes('mef-full-svg'));
  assert.ok(fullSvg.includes('COMMITTED BUCKET (Tc)'));
  assert.ok(fullSvg.includes('EXCESS BUCKET (Te)'));
  assert.ok(fullSvg.includes('MEF 23.1 COS SLA PERFORMANCE'));
});

test('generateMefEthernetReport formats structured engineering briefing', async () => {
  const { calculateMefEthernetMetrics, generateMefEthernetReport } = await import('../dashboard.js');

  const metrics = calculateMefEthernetMetrics({}, {
    serviceId: 'mef-eline-nbp-bank-101',
    cirMbps: 100,
    eirMbps: 20,
    offeredMbps: 95
  });

  const report = generateMefEthernetReport(metrics, { referenceDate: '2026-10-17' });
  assert.ok(report.includes('SHAHDARA METRO CARRIER ETHERNET'));
  assert.ok(report.includes('MEF 6.2 (Services)'));
  assert.ok(report.includes('NBP National Bank'));
  assert.ok(report.includes('CIR:'));
  assert.ok(report.includes('SLA PERFORMANCE GUARANTEES:'));
});

test('exportMefEthernetJson and exportMefEthernetCsv generate valid structured payloads', async () => {
  const { calculateMefEthernetMetrics, exportMefEthernetJson, exportMefEthernetCsv } = await import('../dashboard.js');

  const metrics = calculateMefEthernetMetrics({}, {
    serviceId: 'mef-elan-commercial-202',
    cirMbps: 50,
    eirMbps: 200,
    offeredMbps: 180
  });

  const jsonStr = exportMefEthernetJson(metrics, { timestamp: '2026-10-17T03:30:00Z' });
  const parsed = JSON.parse(jsonStr);
  assert.strictEqual(parsed.standard, 'MEF 6.2 / MEF 10.3 / RFC 4115');
  assert.strictEqual(parsed.service.id, 'mef-elan-commercial-202');
  assert.strictEqual(parsed.bandwidthProfile.cirMbps, 50);
  assert.strictEqual(parsed.policingResults.offeredMbps, 180);
  assert.strictEqual(parsed.slaMetrics.verdict, 'YELLOW_BEST_EFFORT_FORWARD');

  const csvStr = exportMefEthernetCsv(metrics);
  assert.ok(csvStr.includes('Service_ID,Service_Name,Service_Type'));
  assert.ok(csvStr.includes('"mef-elan-commercial-202"'));
  assert.ok(csvStr.includes('50,256,200,128,180'));
});

test('setupMefEthernetModal binds DOM elements, recalculates, handles resets and report copy', async () => {
  const { setupMefEthernetModal } = await import('../dashboard.js');

  function createMockEl(id) {
    const listeners = {};
    return {
      id,
      value: '',
      checked: false,
      innerHTML: '',
      textContent: '',
      open: false,
      style: {},
      addEventListener(evt, fn) {
        if (!listeners[evt]) listeners[evt] = [];
        listeners[evt].push(fn);
      },
      click() {
        if (listeners['click']) listeners['click'].forEach(fn => fn({ type: 'click' }));
      },
      input() {
        if (listeners['input']) listeners['input'].forEach(fn => fn({ type: 'input' }));
      },
      change() {
        if (listeners['change']) listeners['change'].forEach(fn => fn({ type: 'change' }));
      },
      showModal() { this.open = true; },
      close() { this.open = false; },
      setAttribute(attr, val) { if (attr === 'open') this.open = true; },
      removeAttribute(attr) { if (attr === 'open') this.open = false; }
    };
  }

  const elements = {
    dashboardMefEthernetModal: createMockEl('dashboardMefEthernetModal'),
    dashboardOpenMefEthernetModalBtn: createMockEl('dashboardOpenMefEthernetModalBtn'),
    dashboardMefEthernetModalCloseBtn: createMockEl('dashboardMefEthernetModalCloseBtn'),
    mefEthernetServiceSelect: createMockEl('mefEthernetServiceSelect'),
    mefEthernetOfferedSlider: createMockEl('mefEthernetOfferedSlider'),
    mefEthernetOfferedLabel: createMockEl('mefEthernetOfferedLabel'),
    mefEthernetCirInput: createMockEl('mefEthernetCirInput'),
    mefEthernetEirInput: createMockEl('mefEthernetEirInput'),
    mefEthernetCbsInput: createMockEl('mefEthernetCbsInput'),
    mefEthernetEbsInput: createMockEl('mefEthernetEbsInput'),
    mefEthernetCouplingCheck: createMockEl('mefEthernetCouplingCheck'),
    mefEthernetColorModeSelect: createMockEl('mefEthernetColorModeSelect'),
    mefEthernetResetBtn: createMockEl('mefEthernetResetBtn'),
    mefEthernetStatCir: createMockEl('mefEthernetStatCir'),
    mefEthernetStatConforming: createMockEl('mefEthernetStatConforming'),
    mefEthernetStatYellow: createMockEl('mefEthernetStatYellow'),
    mefEthernetStatRedDrop: createMockEl('mefEthernetStatRedDrop'),
    mefEthernetStatCompliance: createMockEl('mefEthernetStatCompliance'),
    mefEthernetStatRevenue: createMockEl('mefEthernetStatRevenue'),
    mefEthernetModalDiagramContainer: createMockEl('mefEthernetModalDiagramContainer'),
    mefEthernetFilterAreaBtn: createMockEl('mefEthernetFilterAreaBtn'),
    mefEthernetExportJsonBtn: createMockEl('mefEthernetExportJsonBtn'),
    mefEthernetExportCsvBtn: createMockEl('mefEthernetExportCsvBtn'),
    mefEthernetCopyReportBtn: createMockEl('mefEthernetCopyReportBtn')
  };

  elements.mefEthernetServiceSelect.value = 'mef-eline-nbp-bank-101';
  elements.mefEthernetOfferedSlider.value = '95';
  elements.mefEthernetCirInput.value = '100';
  elements.mefEthernetEirInput.value = '20';

  const mockDoc = {
    getElementById(id) {
      return elements[id] || null;
    }
  };

  let filterArea = null;
  let toastMsg = null;
  const controller = setupMefEthernetModal({}, {
    document: mockDoc,
    onFilterArea: area => { filterArea = area; },
    onToast: msg => { toastMsg = msg; }
  });

  assert.ok(controller);
  controller.open();
  assert.equal(elements.dashboardMefEthernetModal.open, true);
  assert.ok(elements.mefEthernetModalDiagramContainer.innerHTML.includes('<svg'));

  // Test offered rate adjustment
  elements.mefEthernetOfferedSlider.value = '140';
  elements.mefEthernetOfferedSlider.input();
  assert.ok(elements.mefEthernetStatRedDrop.textContent.includes('20 Mbps'));

  // Test reset
  elements.mefEthernetResetBtn.click();
  assert.ok(toastMsg.includes('reset to default'));

  // Test export buttons
  elements.mefEthernetExportJsonBtn.click();
  assert.ok(toastMsg.includes('JSON exported') || toastMsg.includes('Clipboard'));
  elements.mefEthernetExportCsvBtn.click();
  assert.ok(toastMsg.includes('CSV exported') || toastMsg.includes('Clipboard'));

  // Test filter area
  elements.mefEthernetFilterAreaBtn.click();
  assert.equal(filterArea, 'Shahdara Town');

  controller.close();
  assert.equal(elements.dashboardMefEthernetModal.open, false);
});

test('index.html and dashboard.css contain Carrier Ethernet MEF markup and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('chart-card-mef-ethernet'));
  assert.ok(html.includes('id="dashboardMefEthernetChart"'));
  assert.ok(html.includes('id="dashboardOpenMefEthernetModalBtn"'));
  assert.ok(html.includes('id="dashboardMefEthernetModal"'));
  assert.ok(html.includes('id="mefEthernetServiceSelect"'));
  assert.ok(html.includes('id="mefEthernetOfferedSlider"'));
  assert.ok(html.includes('id="mefEthernetModalDiagramContainer"'));
  assert.ok(html.includes('id="mefEthernetExportJsonBtn"'));
  assert.ok(html.includes('id="mefEthernetExportCsvBtn"'));

  const css = fs.readFileSync(path.resolve('./dashboard.css'), 'utf-8');
  assert.ok(css.includes('.chart-card-mef-ethernet'));
  assert.ok(css.includes('.mef-ethernet-modal-card'));
  assert.ok(css.includes('.mef-ethernet-svg'));
});

test('ERPS_CONSTANTS and SHAHDARA_ERPS_RINGS contain valid specifications', async () => {
  const { ERPS_CONSTANTS, SHAHDARA_ERPS_RINGS } = await import('../dashboard.js');

  assert.ok(ERPS_CONSTANTS.DEFAULT_RING_ID);
  assert.equal(ERPS_CONSTANTS.BENCHMARK_MAX_SWITCHOVER_MS, 50.0);
  assert.equal(ERPS_CONSTANTS.STATES.IDLE, 'IDLE');
  assert.equal(ERPS_CONSTANTS.STATES.PROTECTION, 'PROTECTION');
  assert.equal(ERPS_CONSTANTS.STATES.PENDING, 'PENDING');

  assert.ok(Array.isArray(SHAHDARA_ERPS_RINGS));
  assert.equal(SHAHDARA_ERPS_RINGS.length, 5);

  SHAHDARA_ERPS_RINGS.forEach(ring => {
    assert.ok(ring.id);
    assert.ok(ring.name);
    assert.ok(ring.totalCircumferenceKm > 0);
    assert.ok(ring.nodes.length >= 4);
    assert.ok(ring.spans.length >= 4);
    assert.ok(ring.spans.some(s => s.isRpl));
    assert.ok(ring.nodes.some(n => n.role === 'RPL Owner'));
    assert.ok(ring.nodes.some(n => n.role === 'RPL Neighbor'));
  });
});

test('calculateErpsDynamics computes sub-50ms switchover latency and timing breakdown in IDLE', async () => {
  const { calculateErpsDynamics, SHAHDARA_ERPS_RINGS } = await import('../dashboard.js');

  const baradariRing = SHAHDARA_ERPS_RINGS[0];
  const dynamics = calculateErpsDynamics(baradariRing);

  assert.equal(dynamics.currentState, 'IDLE');
  assert.equal(dynamics.rplStatus, 'BLOCKED');
  assert.equal(dynamics.failedSpanId, null);
  assert.equal(dynamics.failedSpan, null);

  // Timing breakdown assertions
  const t = dynamics.timingBreakdown;
  assert.equal(t.detectMs, 0.8); // Hardware LOS
  assert.equal(t.genMs, 0.5); // R-APS generation
  assert.ok(t.propMs > 0.05 && t.propMs < 0.2); // ~0.07 ms for 14.2 km
  assert.ok(t.procMs > 0.01 && t.procMs < 0.05); // ~0.015 ms for 6 nodes
  assert.ok(t.flushMs >= 0.5 && t.flushMs <= 6.0); // FDB flush
  assert.ok(t.totalSwitchMs < 5.0); // Sub-5ms overall switchover in hardware mode

  // Compliance assertions
  assert.equal(dynamics.compliance.status, 'PASS');
  assert.equal(dynamics.compliance.isSub50ms, true);
  assert.ok(dynamics.compliance.marginMs > 40.0);
  assert.ok(dynamics.rplProtectionOverheadPct > 0);
});

test('calculateErpsDynamics simulates fiber cut and activates PROTECTION state', async () => {
  const { calculateErpsDynamics, SHAHDARA_ERPS_RINGS } = await import('../dashboard.js');

  const ring = SHAHDARA_ERPS_RINGS[0];
  const targetSpan = ring.spans[1]; // SPAN-02 (Hub-02 to Town Central)

  const dynamics = calculateErpsDynamics(ring, {
    failedSpanId: targetSpan.id
  });

  assert.equal(dynamics.currentState, 'PROTECTION');
  assert.equal(dynamics.rplStatus, 'UNBLOCKED');
  assert.equal(dynamics.failedSpanId, targetSpan.id);
  assert.ok(dynamics.failedSpan);
  assert.equal(dynamics.failedSpan.label, targetSpan.label);

  assert.ok(dynamics.activeTrafficThroughputGbps > 0);
  assert.ok(dynamics.lostMegabits > 0);
  assert.ok(dynamics.lostFramesCount > 0);
});

test('calculateErpsDynamics with CFM 10ms CCM and PENDING state with WTR', async () => {
  const { calculateErpsDynamics, SHAHDARA_ERPS_RINGS } = await import('../dashboard.js');

  const ring = SHAHDARA_ERPS_RINGS[1]; // Jia Musa ring
  const dynamics = calculateErpsDynamics(ring, {
    detectionMode: 'cfm-10ms',
    isPending: true,
    wtrMinutes: 8
  });

  assert.equal(dynamics.currentState, 'PENDING');
  assert.equal(dynamics.wtrMinutes, 8);
  assert.equal(dynamics.timingBreakdown.detectMs, 30.0);
  assert.ok(dynamics.timingBreakdown.totalSwitchMs > 30.0);
  assert.ok(dynamics.compliance.isSub50ms);
});

test('calculateErpsMetrics aggregates portfolio statistics and area customers', async () => {
  const { calculateErpsMetrics } = await import('../dashboard.js');

  const mockState = {
    customers: [
      { id: 'c1', area: 'Baradari', packagePrice: 3500, balance: 0, archived: false },
      { id: 'c2', area: 'Shahdara Town', packagePrice: 4000, balance: 1000, archived: false },
      { id: 'c3', area: 'Ravi Siphon', packagePrice: 2500, balance: 0, archived: false },
      { id: 'c4', area: 'Unrelated Sector', packagePrice: 2000, balance: 500, archived: false },
      { id: 'c5', area: 'Baradari', packagePrice: 3000, balance: 0, archived: true } // archived excluded
    ]
  };

  const metrics = calculateErpsMetrics(mockState, {
    ringId: 'shahdara-central-baradari'
  });

  assert.equal(metrics.totalRings, 5);
  assert.ok(metrics.totalRingKm > 50);
  assert.ok(metrics.totalSubscribers > 1500);
  assert.ok(metrics.totalProtectedRevenuePkr > 5000000);
  assert.equal(metrics.actualCustomersInArea, 3); // c1, c2, c3
});

test('renderErpsDiagramSvg outputs valid vector graphics in both light and dark modes', async () => {
  const { calculateErpsDynamics, renderErpsDiagramSvg, SHAHDARA_ERPS_RINGS } = await import('../dashboard.js');

  const ring = SHAHDARA_ERPS_RINGS[0];

  // 1. Dark mode Idle diagram
  const idleDynamics = calculateErpsDynamics(ring);
  const darkSvg = renderErpsDiagramSvg(idleDynamics, { isDarkMode: true });
  assert.ok(darkSvg.includes('<svg'));
  assert.ok(darkSvg.includes('class="erps-svg"'));
  assert.ok(darkSvg.includes('RPL (BLOCKED)'));
  assert.ok(darkSvg.includes('ITU-T G.8032 Switchover Budget'));
  assert.ok(darkSvg.includes('50ms Benchmark'));
  assert.ok(darkSvg.includes('#0f172a'));

  // 2. Light mode Protection diagram with simulated cut
  const cutDynamics = calculateErpsDynamics(ring, { failedSpanId: ring.spans[2].id });
  const lightSvg = renderErpsDiagramSvg(cutDynamics, { isDarkMode: false });
  assert.ok(lightSvg.includes('SIGNAL FAIL'));
  assert.ok(lightSvg.includes('RPL (UNBLOCKED)'));
  assert.ok(lightSvg.includes('#f8fafc'));
});

test('generateErpsReport, exportErpsJson, and exportErpsCsv format data accurately', async () => {
  const {
    calculateErpsDynamics,
    generateErpsReport,
    exportErpsJson,
    exportErpsCsv,
    SHAHDARA_ERPS_RINGS
  } = await import('../dashboard.js');

  const ring = SHAHDARA_ERPS_RINGS[0];
  const dynamics = calculateErpsDynamics(ring);

  // 1. Audit Text Report
  const report = generateErpsReport(dynamics);
  assert.ok(report.includes('SHAHDARA ISP METRO OPTICAL NETWORK - ITU-T G.8032 ERPS AUDIT REPORT'));
  assert.ok(report.includes('1. RING IDENTIFICATION & TOPOLOGY'));
  assert.ok(report.includes('2. RPL CONFIGURATION & ROLES'));
  assert.ok(report.includes('3. SUB-50MS PROTECTION SWITCHOVER BUDGET'));
  assert.ok(report.includes('4. FAULT & TRAFFIC IMPACT ANALYSIS'));
  assert.ok(report.includes('TOTAL SWITCHOVER TIME:'));

  // 2. JSON Export
  const jsonStr = exportErpsJson(dynamics);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.standard, 'ITU-T G.8032 / Y.1344 ERPS');
  assert.equal(parsed.ring.id, 'shahdara-central-baradari');
  assert.equal(parsed.state, 'IDLE');
  assert.equal(parsed.rplStatus, 'BLOCKED');
  assert.ok(parsed.timingBreakdown.totalSwitchMs > 0);

  // 3. CSV Export
  const csvStr = exportErpsCsv(dynamics);
  assert.ok(csvStr.startsWith('Ring_ID,Ring_Name,Primary_Area'));
  assert.ok(csvStr.includes('"shahdara-central-baradari"'));
  assert.ok(csvStr.includes('"IDLE"'));
  assert.ok(csvStr.includes('\r\n'));
});

test('setupErpsModal binds event handlers, simulates cuts, transitions states, and exports', async () => {
  const { setupErpsModal } = await import('../dashboard.js');

  function createMockEl(id) {
    const listeners = {};
    return {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      open: false,
      style: {},
      addEventListener(evt, fn) {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      click() {
        if (listeners['click']) listeners['click'].forEach(fn => fn({ type: 'click' }));
      },
      input() {
        if (listeners['input']) listeners['input'].forEach(fn => fn({ type: 'input' }));
      },
      change() {
        if (listeners['change']) listeners['change'].forEach(fn => fn({ type: 'change' }));
      },
      showModal() { this.open = true; },
      close() { this.open = false; },
      setAttribute(attr, val) { if (attr === 'open') this.open = true; },
      removeAttribute(attr) { if (attr === 'open') this.open = false; }
    };
  }

  const elements = {
    dashboardErpsModal: createMockEl('dashboardErpsModal'),
    dashboardOpenErpsModalBtn: createMockEl('dashboardOpenErpsModalBtn'),
    dashboardErpsModalCloseBtn: createMockEl('dashboardErpsModalCloseBtn'),
    dashboardErpsChart: createMockEl('dashboardErpsChart'),
    erpsRingSelect: createMockEl('erpsRingSelect'),
    erpsSpanSelect: createMockEl('erpsSpanSelect'),
    erpsDetectSelect: createMockEl('erpsDetectSelect'),
    erpsWtrInput: createMockEl('erpsWtrInput'),
    erpsInjectCutBtn: createMockEl('erpsInjectCutBtn'),
    erpsRestoreBtn: createMockEl('erpsRestoreBtn'),
    erpsClearBtn: createMockEl('erpsClearBtn'),
    erpsStatState: createMockEl('erpsStatState'),
    erpsStatSwitchTime: createMockEl('erpsStatSwitchTime'),
    erpsStatCompliance: createMockEl('erpsStatCompliance'),
    erpsStatRpl: createMockEl('erpsStatRpl'),
    erpsStatLoss: createMockEl('erpsStatLoss'),
    erpsStatSubscribers: createMockEl('erpsStatSubscribers'),
    erpsModalDiagramContainer: createMockEl('erpsModalDiagramContainer'),
    erpsFilterAreaBtn: createMockEl('erpsFilterAreaBtn'),
    erpsExportJsonBtn: createMockEl('erpsExportJsonBtn'),
    erpsExportCsvBtn: createMockEl('erpsExportCsvBtn'),
    erpsCopyReportBtn: createMockEl('erpsCopyReportBtn')
  };

  elements.erpsRingSelect.value = 'shahdara-central-baradari';
  elements.erpsDetectSelect.value = 'los';
  elements.erpsWtrInput.value = '5';

  const mockDoc = {
    getElementById(id) {
      return elements[id] || null;
    }
  };

  let filterArea = null;
  let toastMsg = null;
  const controller = setupErpsModal({}, {
    document: mockDoc,
    onFilterArea: area => { filterArea = area; },
    onToast: msg => { toastMsg = msg; }
  });

  assert.ok(controller);
  controller.open();
  assert.equal(elements.dashboardErpsModal.open, true);
  assert.ok(elements.erpsModalDiagramContainer.innerHTML.includes('<svg'));
  assert.ok(elements.dashboardErpsChart.innerHTML.includes('<svg'));

  // Test state in IDLE
  assert.equal(elements.erpsStatState.textContent, 'IDLE');
  assert.equal(elements.erpsStatRpl.textContent, 'BLOCKED');

  // Test Inject Cut
  elements.erpsInjectCutBtn.click();
  assert.equal(elements.erpsStatState.textContent, 'PROTECTION');
  assert.equal(elements.erpsStatRpl.textContent, 'UNBLOCKED');
  assert.ok(toastMsg.includes('Simulated Fiber Cut injected'));

  // Test Restore Link
  elements.erpsRestoreBtn.click();
  assert.equal(elements.erpsStatState.textContent, 'PENDING');
  assert.ok(toastMsg.includes('ERPS transitioned to PENDING'));

  // Test Clear / Reset to Idle
  elements.erpsClearBtn.click();
  assert.equal(elements.erpsStatState.textContent, 'IDLE');
  assert.equal(elements.erpsStatRpl.textContent, 'BLOCKED');
  assert.ok(toastMsg.includes('reset to normal IDLE'));

  // Test Export buttons
  elements.erpsExportJsonBtn.click();
  assert.ok(toastMsg.includes('JSON') || toastMsg.includes('Clipboard'));
  elements.erpsExportCsvBtn.click();
  assert.ok(toastMsg.includes('CSV') || toastMsg.includes('Clipboard'));

  // Test Filter Area
  elements.erpsFilterAreaBtn.click();
  assert.equal(filterArea, 'Baradari');

  controller.close();
  assert.equal(elements.dashboardErpsModal.open, false);
});

test('index.html and dashboard.css contain ITU-T G.8032 ERPS markup and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('chart-card-erps-ring'));
  assert.ok(html.includes('id="dashboardErpsChart"'));
  assert.ok(html.includes('id="dashboardOpenErpsModalBtn"'));
  assert.ok(html.includes('id="dashboardErpsModal"'));
  assert.ok(html.includes('id="erpsRingSelect"'));
  assert.ok(html.includes('id="erpsSpanSelect"'));
  assert.ok(html.includes('id="erpsDetectSelect"'));
  assert.ok(html.includes('id="erpsInjectCutBtn"'));
  assert.ok(html.includes('id="erpsRestoreBtn"'));
  assert.ok(html.includes('id="erpsClearBtn"'));
  assert.ok(html.includes('id="erpsModalDiagramContainer"'));
  assert.ok(html.includes('id="erpsExportJsonBtn"'));
  assert.ok(html.includes('id="erpsExportCsvBtn"'));
  assert.ok(html.includes('id="erpsCopyReportBtn"'));

  const css = fs.readFileSync(path.resolve('./dashboard.css'), 'utf-8');
  assert.ok(css.includes('.chart-card-erps-ring'));
  assert.ok(css.includes('.erps-modal-card'));
  assert.ok(css.includes('.erps-svg'));
});

test('Y1731_OAM_CONSTANTS and SHAHDARA_Y1731_SERVICES contain valid specifications', async () => {
  const { Y1731_OAM_CONSTANTS, SHAHDARA_Y1731_SERVICES } = await import('../dashboard.js');

  assert.ok(Y1731_OAM_CONSTANTS.DEFAULT_SERVICE_ID);
  assert.equal(Y1731_OAM_CONSTANTS.AVAILABILITY_STATES.AVAILABLE, 'AVAILABLE');
  assert.equal(Y1731_OAM_CONSTANTS.AVAILABILITY_STATES.UNAVAILABLE, 'UNAVAILABLE');
  assert.ok(Y1731_OAM_CONSTANTS.SLA_PROFILES.HIGH_CRITICAL);

  assert.ok(Array.isArray(SHAHDARA_Y1731_SERVICES));
  assert.equal(SHAHDARA_Y1731_SERVICES.length, 5);

  SHAHDARA_Y1731_SERVICES.forEach(s => {
    assert.ok(s.id);
    assert.ok(s.name);
    assert.ok(s.spanLengthKm > 0);
    assert.ok(s.sourceMep && s.sourceMep.id);
    assert.ok(s.targetMep && s.targetMep.id);
    assert.ok(s.committedThroughputMbps > 0);
    assert.ok(s.monthlyRevenuePkr > 0);
  });
});

test('calculateY1731Dynamics computes microsecond frame delay and jitter in baseline', async () => {
  const { calculateY1731Dynamics, SHAHDARA_Y1731_SERVICES } = await import('../dashboard.js');

  const bankService = SHAHDARA_Y1731_SERVICES[0];
  const dynamics = calculateY1731Dynamics(bankService);

  assert.ok(dynamics.twoWayDelayMs > 0);
  assert.ok(dynamics.oneWayDelayMs > 0);
  assert.equal(dynamics.oneWayDelayMs, +(dynamics.twoWayDelayMs / 2).toFixed(4));

  // Optical propagation assertions for 8.4 km SMF-28
  assert.ok(dynamics.propagationDelay.oneWayUs > 35.0 && dynamics.propagationDelay.oneWayUs < 50.0);
  assert.ok(dynamics.propagationDelay.hopsTransitDelayUs > 10.0);

  // SLA assertions
  assert.equal(dynamics.delayCompliant, true);
  assert.equal(dynamics.jitterCompliant, true);
  assert.equal(dynamics.flrCompliant, true);
  assert.equal(dynamics.availabilityState, 'AVAILABLE');
  assert.equal(dynamics.slaVerdict, 'SLA_COMPLIANT_OPTIMAL');
  assert.equal(dynamics.penaltyCreditPct, 0);
  assert.equal(dynamics.penaltyPkr, 0);

  // Timestamps check
  assert.ok(dynamics.timestamps.t1Us);
  assert.ok(dynamics.timestamps.t2Us > dynamics.timestamps.t1Us);
  assert.ok(dynamics.timestamps.t4Us > dynamics.timestamps.t3Us);
});

test('calculateY1731Dynamics with severe buffer congestion and loss triggers SLA violation', async () => {
  const { calculateY1731Dynamics, SHAHDARA_Y1731_SERVICES } = await import('../dashboard.js');

  const bankService = SHAHDARA_Y1731_SERVICES[0];
  const dynamics = calculateY1731Dynamics(bankService, {
    injectedQueueDelayMs: 12.0,
    injectedLossPct: 1.5
  });

  assert.ok(dynamics.oneWayDelayMs > 6.0);
  assert.equal(dynamics.delayCompliant, false);
  assert.equal(dynamics.flrCompliant, false);
  assert.equal(dynamics.availabilityState, 'DEGRADED');
  assert.equal(dynamics.slaVerdict, 'SLA_VIOLATION_MARGINAL');
  assert.equal(dynamics.penaltyCreditPct, 10);
  assert.ok(dynamics.penaltyPkr > 0);
});

test('calculateY1731Dynamics with FLR >= 50% triggers UNAVAILABLE outage state', async () => {
  const { calculateY1731Dynamics, SHAHDARA_Y1731_SERVICES } = await import('../dashboard.js');

  const bankService = SHAHDARA_Y1731_SERVICES[0];
  const dynamics = calculateY1731Dynamics(bankService, {
    injectedLossPct: 58.5
  });

  assert.equal(dynamics.availabilityState, 'UNAVAILABLE');
  assert.equal(dynamics.slaVerdict, 'SLA_BREACH_OUTAGE');
  assert.equal(dynamics.penaltyCreditPct, 25);
  assert.ok(dynamics.penaltyPkr > 0);
  assert.ok(dynamics.lostFramesCount > 5000);
});

test('calculateY1731Metrics aggregates portfolio metrics and area customers', async () => {
  const { calculateY1731Metrics } = await import('../dashboard.js');

  const mockState = {
    customers: [
      { id: 'c1', area: 'Shahdara Town', packagePrice: 3500, balance: 0, archived: false },
      { id: 'c2', area: 'Baradari', packagePrice: 4000, balance: 1000, archived: false },
      { id: 'c3', area: 'Begum Kot', packagePrice: 2500, balance: 0, archived: false },
      { id: 'c4', area: 'Random Area', packagePrice: 2000, balance: 500, archived: false },
      { id: 'c5', area: 'Shahdara Town', packagePrice: 3000, balance: 0, archived: true }
    ]
  };

  const metrics = calculateY1731Metrics(mockState, {
    serviceId: 'nbp-bank-core-oam'
  });

  assert.equal(metrics.totalServices, 5);
  assert.ok(metrics.totalFiberSpanKm > 40);
  assert.ok(metrics.totalSubscribers > 1000);
  assert.ok(metrics.totalProtectedRevenuePkr > 4000000);
  assert.equal(metrics.actualCustomersInArea, 3); // c1, c2, c3
});

test('renderY1731DiagramSvg outputs valid vector graphics in both light and dark modes', async () => {
  const { calculateY1731Dynamics, renderY1731DiagramSvg, SHAHDARA_Y1731_SERVICES } = await import('../dashboard.js');

  const service = SHAHDARA_Y1731_SERVICES[0];
  const dynamics = calculateY1731Dynamics(service);

  // 1. Dark Mode
  const darkSvg = renderY1731DiagramSvg(dynamics, { isDarkMode: true });
  assert.ok(darkSvg.includes('<svg'));
  assert.ok(darkSvg.includes('class="y1731-svg"'));
  assert.ok(darkSvg.includes('DMM Request'));
  assert.ok(darkSvg.includes('DMR Response'));
  assert.ok(darkSvg.includes('MEP-101'));
  assert.ok(darkSvg.includes('MEP-102'));
  assert.ok(darkSvg.includes('#0f172a'));

  // 2. Light Mode
  const lightSvg = renderY1731DiagramSvg(dynamics, { isDarkMode: false });
  assert.ok(lightSvg.includes('#f8fafc'));
  assert.ok(lightSvg.includes('Two-Way Frame Delay'));
});

test('generateY1731Report, exportY1731Json, and exportY1731Csv format data accurately', async () => {
  const {
    calculateY1731Dynamics,
    generateY1731Report,
    exportY1731Json,
    exportY1731Csv,
    SHAHDARA_Y1731_SERVICES
  } = await import('../dashboard.js');

  const service = SHAHDARA_Y1731_SERVICES[0];
  const dynamics = calculateY1731Dynamics(service);

  // 1. Text Report
  const report = generateY1731Report(dynamics);
  assert.ok(report.includes('SHAHDARA ISP CARRIER ETHERNET OAM & PM AUDIT REPORT'));
  assert.ok(report.includes('1. CIRCUIT TOPOLOGY & MAINTENANCE DOMAIN'));
  assert.ok(report.includes('2. FRAME DELAY & JITTER PERFORMANCE MONITORING'));
  assert.ok(report.includes('3. SYNTHETIC LOSS MEASUREMENT & AVAILABILITY'));
  assert.ok(report.includes('4. COMPONENT LATENCY STACK'));

  // 2. JSON
  const jsonStr = exportY1731Json(dynamics);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.standard, 'ITU-T Y.1731 / IEEE 802.1ag Carrier Ethernet OAM');
  assert.equal(parsed.service.id, 'nbp-bank-core-oam');
  assert.ok(parsed.performance.twoWayDelayMs > 0);

  // 3. CSV
  const csvStr = exportY1731Csv(dynamics);
  assert.ok(csvStr.startsWith('Service_ID,Service_Name,Primary_Area'));
  assert.ok(csvStr.includes('"nbp-bank-core-oam"'));
  assert.ok(csvStr.includes('\r\n'));
});

test('setupY1731Modal binds DOM controls, slider, loss input, reset, and exports', async () => {
  const { setupY1731Modal } = await import('../dashboard.js');

  function createMockEl(id) {
    const listeners = {};
    return {
      id,
      value: '',
      textContent: '',
      innerHTML: '',
      open: false,
      style: {},
      addEventListener(evt, fn) {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(fn);
      },
      click() {
        if (listeners['click']) listeners['click'].forEach(fn => fn({ type: 'click' }));
      },
      input() {
        if (listeners['input']) listeners['input'].forEach(fn => fn({ type: 'input' }));
      },
      change() {
        if (listeners['change']) listeners['change'].forEach(fn => fn({ type: 'change' }));
      },
      showModal() { this.open = true; },
      close() { this.open = false; },
      setAttribute(attr, val) { if (attr === 'open') this.open = true; },
      removeAttribute(attr) { if (attr === 'open') this.open = false; }
    };
  }

  const elements = {
    dashboardY1731Modal: createMockEl('dashboardY1731Modal'),
    dashboardOpenY1731ModalBtn: createMockEl('dashboardOpenY1731ModalBtn'),
    dashboardY1731ModalCloseBtn: createMockEl('dashboardY1731ModalCloseBtn'),
    dashboardY1731Chart: createMockEl('dashboardY1731Chart'),
    y1731ServiceSelect: createMockEl('y1731ServiceSelect'),
    y1731QueueDelaySlider: createMockEl('y1731QueueDelaySlider'),
    y1731QueueDelayLabel: createMockEl('y1731QueueDelayLabel'),
    y1731LossInput: createMockEl('y1731LossInput'),
    y1731CcmSelect: createMockEl('y1731CcmSelect'),
    y1731ResetBtn: createMockEl('y1731ResetBtn'),
    y1731StatDelay: createMockEl('y1731StatDelay'),
    y1731StatJitter: createMockEl('y1731StatJitter'),
    y1731StatFlr: createMockEl('y1731StatFlr'),
    y1731StatAvailability: createMockEl('y1731StatAvailability'),
    y1731StatVerdict: createMockEl('y1731StatVerdict'),
    y1731StatPenalty: createMockEl('y1731StatPenalty'),
    y1731ModalDiagramContainer: createMockEl('y1731ModalDiagramContainer'),
    y1731FilterAreaBtn: createMockEl('y1731FilterAreaBtn'),
    y1731ExportJsonBtn: createMockEl('y1731ExportJsonBtn'),
    y1731ExportCsvBtn: createMockEl('y1731ExportCsvBtn'),
    y1731CopyReportBtn: createMockEl('y1731CopyReportBtn')
  };

  elements.y1731ServiceSelect.value = 'nbp-bank-core-oam';
  elements.y1731QueueDelaySlider.value = '0.45';
  elements.y1731LossInput.value = '0.0001';
  elements.y1731CcmSelect.value = 'FAST_3_3MS';

  const mockDoc = {
    getElementById(id) {
      return elements[id] || null;
    }
  };

  let filterArea = null;
  let toastMsg = null;
  const controller = setupY1731Modal({}, {
    document: mockDoc,
    onFilterArea: area => { filterArea = area; },
    onToast: msg => { toastMsg = msg; }
  });

  assert.ok(controller);
  controller.open();
  assert.equal(elements.dashboardY1731Modal.open, true);
  assert.ok(elements.y1731ModalDiagramContainer.innerHTML.includes('<svg'));
  assert.ok(elements.dashboardY1731Chart.innerHTML.includes('<svg'));

  // Test slider adjustment
  elements.y1731QueueDelaySlider.value = '5.0';
  elements.y1731QueueDelaySlider.input();
  assert.ok(elements.y1731QueueDelayLabel.textContent.includes('5.00 ms'));

  // Test reset
  elements.y1731ResetBtn.click();
  assert.ok(toastMsg.includes('reset to baseline'));

  // Test export buttons
  elements.y1731ExportJsonBtn.click();
  assert.ok(toastMsg.includes('JSON') || toastMsg.includes('Clipboard'));
  elements.y1731ExportCsvBtn.click();
  assert.ok(toastMsg.includes('CSV') || toastMsg.includes('Clipboard'));

  // Test filter area
  elements.y1731FilterAreaBtn.click();
  assert.equal(filterArea, 'Shahdara Town');

  controller.close();
  assert.equal(elements.dashboardY1731Modal.open, false);
});

test('index.html and dashboard.css contain Y.1731 OAM markup and styles', async () => {
  const fs = await import('fs');
  const path = await import('path');

  const html = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert.ok(html.includes('chart-card-y1731-oam'));
  assert.ok(html.includes('id="dashboardY1731Chart"'));
  assert.ok(html.includes('id="dashboardOpenY1731ModalBtn"'));
  assert.ok(html.includes('id="dashboardY1731Modal"'));
  assert.ok(html.includes('id="y1731ServiceSelect"'));
  assert.ok(html.includes('id="y1731QueueDelaySlider"'));
  assert.ok(html.includes('id="y1731LossInput"'));
  assert.ok(html.includes('id="y1731CcmSelect"'));
  assert.ok(html.includes('id="y1731ResetBtn"'));
  assert.ok(html.includes('id="y1731ModalDiagramContainer"'));
  assert.ok(html.includes('id="y1731ExportJsonBtn"'));
  assert.ok(html.includes('id="y1731ExportCsvBtn"'));
  assert.ok(html.includes('id="y1731CopyReportBtn"'));

  const css = fs.readFileSync(path.resolve('./dashboard.css'), 'utf-8');
  assert.ok(css.includes('.chart-card-y1731-oam'));
  assert.ok(css.includes('.y1731-modal-card'));
  assert.ok(css.includes('.y1731-svg'));
});


