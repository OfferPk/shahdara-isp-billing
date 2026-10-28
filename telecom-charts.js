/**
 * telecom-charts.js — SISP-9: heavy telecom/engineering charts + diagnostics
 * modals, split out of dashboard-charts.js so they load LAZILY.
 *
 * Before SISP-9, dashboard-charts.js statically imported all ~44 of these
 * modules (dashboard-otdr, dashboard-dwdm, dashboard-roadm, dashboard-bgp,
 * dashboard-cgnat, dashboard-pon-dba, ...), so esbuild bundled ~2.4 MB of
 * optical/telecom simulation code into the first-load app.js chunk on every
 * home render — even when the user never opens those screens.
 *
 * Now this module is ONLY reached through a dynamic import() in
 * lazy-telecom.js, so it ships as a separate chunk that the browser fetches
 * after first paint and only when the dashboard charts region becomes
 * visible. The service worker precaches every dist file (build.mjs rewrites
 * APP_FILES), so the lazy chunk still works 100% offline.
 *
 * The code below is the telecom block moved verbatim out of
 * renderDashboardCharts (same chart ids, same setup calls, same option
 * shapes) — only the function wrapper is new.
 */

import { calculateOtdrFaultMetrics, setupOtdrModal, renderOtdrTraceSvg } from './dashboard-otdr.js';
import { calculateSolarInverterMetrics, setupSolarModal, renderSolarInverterSvg } from './dashboard-solar.js';
import { calculateAerialTensionMetrics, setupAerialTensionModal, renderAerialTensionSvg } from './dashboard-aerial.js';
import { calculateMicrowaveLinkBudget, setupMicrowaveModal, renderMicrowaveLinkSvg } from './dashboard-microwave.js';
import { calculateSpliceClosureMetrics, setupSpliceClosureModal, renderSpliceClosureSvg } from './dashboard-splice.js';
import { calculateDuctJettingMetrics, setupDuctJettingModal, renderDuctJettingSvg } from './dashboard-jetting.js';
import { calculatePonDbaMetrics, setupPonDbaModal, renderPonDbaQueueSvg } from './dashboard-pon-dba.js';
import { calculateFusionSplicerMetrics, setupFusionSplicerModal, renderFusionSplicerSvg } from './dashboard-splicer.js';
import { calculateBgpPeeringMetrics, setupBgpRoutingModal, renderBgpRoutingConvergenceSvg } from './dashboard-bgp.js';
import { calculateIptvMulticastMetrics, setupIptvMulticastModal, renderIptvMulticastSvg } from './dashboard-iptv.js';
import { calculateDnsMetrics, setupDnsDiagnosticsModal, renderDnsDiagnosticsSvg } from './dashboard-dns.js';
import { calculateDwdmMetrics, setupDwdmModal, renderDwdmBudgetSvg } from './dashboard-dwdm.js';
import { calculateOscMetrics, setupOscModal, renderOscTelemetrySvg } from './dashboard-osc.js';
import { calculateQinqMetrics, setupQinqModal, renderQinqTrunkSvg } from './dashboard-qinq.js';
import { calculateSyncEMetrics, setupSyncEModal, renderSyncEClockSvg } from './dashboard-synce.js';
import { calculateRoadmMetrics, setupRoadmModal, renderRoadmOpticalSvg } from './dashboard-roadm.js';
import { calculateMicroOtdrMetrics, setupMicroOtdrModal, renderMicroOtdrTraceSvg } from './dashboard-micro-otdr.js';
import { calculateMclagMetrics, setupMclagModal, renderMclagDiagramSvg } from './dashboard-mclag.js';
import { calculateFlowspecMetrics, setupFlowspecModal, renderFlowspecDiagramSvg } from './dashboard-flowspec.js';
import { calculateRamanMetrics, setupRamanModal, renderRamanDiagramSvg } from './dashboard-raman.js';
import { calculateSrMplsMetrics, setupSrMplsModal, renderSrMplsDiagramSvg } from './dashboard-sr-mpls.js';
import { calculatePmdMetrics, setupPmdModal, renderPmdDiagramSvg } from './dashboard-pmd.js';
import { calculateEvpnMetrics, setupEvpnModal, renderEvpnDiagramSvg } from './dashboard-evpn.js';
import { calculateKerrMetrics, setupKerrModal, renderKerrDiagramSvg } from './dashboard-kerr.js';
import { calculateMplsTeMetrics, setupMplsTeModal, renderMplsTeDiagramSvg } from './dashboard-mpls-te.js';
import { calculateMefEthernetMetrics, setupMefEthernetModal, renderMefCarrierEthernetSvg } from './dashboard-mef-ethernet.js';
import { calculateOtnDynamics, setupOtnModal, renderOtnDiagramSvg } from './dashboard-otn.js';
import { calculateMplsTpDynamics, setupMplsTpModal, renderMplsTpDiagramSvg } from './dashboard-mpls-tp.js';
import { calculateL3VpnDynamics, setupL3VpnModal, renderL3VpnDiagramSvg } from './dashboard-l3vpn.js';
import { calculateEdfaCascadeDynamics, setupEdfaCascadeModal, renderEdfaCascadeSvg } from './dashboard-edfa-cascade.js';
import { calculatePtpTbcDynamics, setupPtpTbcModal, renderPtpTbcDiagramSvg } from './dashboard-ptp-tbc.js';
import { calculateRpkiMetrics, setupRpkiModal, renderRpkiDiagramSvg } from './dashboard-rpki.js';
import { calculatePolarizationMetrics, setupPolarizationModal, renderPolarizationDiagramSvg } from './dashboard-polarization-eq.js';
import { calculateRocev2Metrics, setupRocev2Modal, renderRocev2DiagramSvg } from './dashboard-rocev2.js';
import { calculateOlpMetrics, setupOlpModal, renderOlpDiagramSvg } from './dashboard-olp-protection.js';
import { setupY1731Modal } from './dashboard-y1731-oam.js';
import { setupPseudowireModal } from './dashboard-pseudowire.js';
import { setupBfdModal } from './dashboard-bfd.js';
import { setupVplsModal } from './dashboard-vpls.js';
import { setupCgnatModal } from './dashboard-cgnat.js';
import { setupOltChassisModal } from './dashboard-olt-chassis.js';
import { setupSrv6Modal } from './dashboard-srv6.js';
import { setupOpticalEvmModal } from './dashboard-optical-evm.js';

export function renderTelecomCharts(state, referenceDate = new Date(), options = {}) {
  const otdrEl = document.getElementById('dashboardOtdrChart');
  if (otdrEl) {
    const otdrData = calculateOtdrFaultMetrics(state, { referenceDate });
    otdrEl.innerHTML = renderOtdrTraceSvg(otdrData);
  }

  setupOtdrModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const solarEl = document.getElementById('dashboardSolarChart');
  if (solarEl) {
    const solarData = calculateSolarInverterMetrics(state, { referenceDate });
    solarEl.innerHTML = renderSolarInverterSvg(solarData);
  }

  setupSolarModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const aerialEl = document.getElementById('dashboardAerialChart');
  if (aerialEl) {
    const aerialData = calculateAerialTensionMetrics(state, { referenceDate });
    aerialEl.innerHTML = renderAerialTensionSvg(aerialData);
  }

  setupAerialTensionModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const mwEl = document.getElementById('dashboardMicrowaveChart');
  if (mwEl) {
    const mwData = calculateMicrowaveLinkBudget(state, { referenceDate });
    mwEl.innerHTML = renderMicrowaveLinkSvg(mwData);
  }

  setupMicrowaveModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const spliceEl = document.getElementById('dashboardSpliceChart');
  if (spliceEl) {
    const spliceData = calculateSpliceClosureMetrics(state, { referenceDate });
    spliceEl.innerHTML = renderSpliceClosureSvg(spliceData);
  }

  setupSpliceClosureModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const jettingEl = document.getElementById('dashboardJettingChart');
  if (jettingEl) {
    const jettingData = calculateDuctJettingMetrics(state, { referenceDate });
    jettingEl.innerHTML = renderDuctJettingSvg(jettingData);
  }

  setupDuctJettingModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const ponDbaEl = document.getElementById('dashboardPonDbaChart');
  if (ponDbaEl) {
    const ponDbaData = calculatePonDbaMetrics(state, { referenceDate });
    ponDbaEl.innerHTML = renderPonDbaQueueSvg(ponDbaData, { compact: true });
  }

  setupPonDbaModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const splicerEl = document.getElementById('dashboardSplicerChart');
  if (splicerEl) {
    const splicerData = calculateFusionSplicerMetrics(state, { referenceDate });
    splicerEl.innerHTML = renderFusionSplicerSvg(splicerData, { compact: true });
  }

  setupFusionSplicerModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const bgpEl = document.getElementById('dashboardBgpChart');
  if (bgpEl) {
    const bgpData = calculateBgpPeeringMetrics(state, { referenceDate });
    bgpEl.innerHTML = renderBgpRoutingConvergenceSvg(bgpData, { compact: true });
  }

  setupBgpRoutingModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const iptvEl = document.getElementById('dashboardIptvChart');
  if (iptvEl) {
    const iptvData = calculateIptvMulticastMetrics(state, { referenceDate });
    iptvEl.innerHTML = renderIptvMulticastSvg(iptvData, { compact: true });
  }

  setupIptvMulticastModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const dnsEl = document.getElementById('dashboardDnsChart');
  if (dnsEl) {
    const dnsData = calculateDnsMetrics(state, { referenceDate });
    dnsEl.innerHTML = renderDnsDiagnosticsSvg(dnsData, { compact: true });
  }

  setupDnsDiagnosticsModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const dwdmEl = document.getElementById('dashboardDwdmChart');
  if (dwdmEl) {
    const dwdmData = calculateDwdmMetrics(state, { referenceDate });
    dwdmEl.innerHTML = renderDwdmBudgetSvg(dwdmData, { compact: true });
  }

  setupDwdmModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const oscEl = document.getElementById('dashboardOscChart');
  if (oscEl) {
    const oscData = calculateOscMetrics(state, { referenceDate });
    oscEl.innerHTML = renderOscTelemetrySvg(oscData, { compact: true });
  }

  setupOscModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const qinqEl = document.getElementById('dashboardQinqChart');
  if (qinqEl) {
    const qinqData = calculateQinqMetrics(state, { referenceDate });
    qinqEl.innerHTML = renderQinqTrunkSvg(qinqData, { compact: true });
  }

  setupQinqModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const synceEl = document.getElementById('dashboardSyncEChart');
  if (synceEl) {
    const syncData = calculateSyncEMetrics(state, { referenceDate });
    synceEl.innerHTML = renderSyncEClockSvg(syncData, { compact: true });
  }

  setupSyncEModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const roadmEl = document.getElementById('dashboardRoadmChart');
  if (roadmEl) {
    const roadmData = calculateRoadmMetrics(state, { referenceDate });
    roadmEl.innerHTML = renderRoadmOpticalSvg(roadmData, { compact: true });
  }

  setupRoadmModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const microOtdrEl = document.getElementById('dashboardMicroOtdrChart');
  if (microOtdrEl) {
    const microOtdrData = calculateMicroOtdrMetrics(state, { referenceDate });
    microOtdrEl.innerHTML = renderMicroOtdrTraceSvg(microOtdrData, { compact: true });
  }

  setupMicroOtdrModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const mclagEl = document.getElementById('dashboardMclagChart');
  if (mclagEl) {
    const mclagData = calculateMclagMetrics(state, { referenceDate });
    mclagEl.innerHTML = renderMclagDiagramSvg(mclagData, { compact: true });
  }

  setupMclagModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const flowspecEl = document.getElementById('dashboardFlowspecChart');
  if (flowspecEl) {
    const flowspecData = calculateFlowspecMetrics(state, { referenceDate });
    flowspecEl.innerHTML = renderFlowspecDiagramSvg(flowspecData, { compact: true });
  }

  setupFlowspecModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const ramanEl = document.getElementById('dashboardRamanChart');
  if (ramanEl) {
    const ramanData = calculateRamanMetrics(state, { referenceDate });
    ramanEl.innerHTML = renderRamanDiagramSvg(ramanData, { compact: true });
  }

  setupRamanModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const srMplsEl = document.getElementById('dashboardSrMplsChart');
  if (srMplsEl) {
    const srMplsData = calculateSrMplsMetrics(state, { referenceDate });
    srMplsEl.innerHTML = renderSrMplsDiagramSvg(srMplsData, { compact: true });
  }

  setupSrMplsModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const pmdEl = document.getElementById('dashboardPmdChart');
  if (pmdEl) {
    const pmdData = calculatePmdMetrics(state, { referenceDate });
    pmdEl.innerHTML = renderPmdDiagramSvg(pmdData, { compact: true });
  }

  setupPmdModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const evpnEl = document.getElementById('dashboardEvpnChart');
  if (evpnEl) {
    const evpnData = calculateEvpnMetrics(state, { referenceDate });
    evpnEl.innerHTML = renderEvpnDiagramSvg(evpnData, { compact: true });
  }

  setupEvpnModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const kerrEl = document.getElementById('dashboardKerrChart');
  if (kerrEl) {
    const kerrData = calculateKerrMetrics(state, { referenceDate });
    kerrEl.innerHTML = renderKerrDiagramSvg(kerrData, { compact: true });
  }

  setupKerrModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const mplsTeEl = document.getElementById('dashboardMplsTeChart');
  if (mplsTeEl) {
    const mplsTeData = calculateMplsTeMetrics(state, { referenceDate });
    mplsTeEl.innerHTML = renderMplsTeDiagramSvg(mplsTeData, { compact: true });
  }

  setupMplsTeModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const mefEthernetEl = document.getElementById('dashboardMefEthernetChart');
  if (mefEthernetEl) {
    const mefEthernetData = calculateMefEthernetMetrics(state, { referenceDate });
    mefEthernetEl.innerHTML = renderMefCarrierEthernetSvg(mefEthernetData, { compact: true });
  }

  setupMefEthernetModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const otnEl = document.getElementById('dashboardOtnChart');
  if (otnEl) {
    const otnDyn = calculateOtnDynamics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    otnEl.innerHTML = renderOtnDiagramSvg(otnDyn, { isDark, compact: true });
  }

  setupOtnModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const mplsTpEl = document.getElementById('dashboardMplsTpChart');
  if (mplsTpEl) {
    const mplsTpDyn = calculateMplsTpDynamics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    mplsTpEl.innerHTML = renderMplsTpDiagramSvg(mplsTpDyn, { isDark, compact: true });
  }

  setupMplsTpModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const l3vpnEl = document.getElementById('dashboardL3VpnChart');
  if (l3vpnEl) {
    const l3vpnDyn = calculateL3VpnDynamics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    l3vpnEl.innerHTML = renderL3VpnDiagramSvg(l3vpnDyn, { isDark, compact: true });
  }

  setupL3VpnModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const edfaEl = document.getElementById('dashboardEdfaCascadeChart');
  if (edfaEl) {
    const edfaDyn = calculateEdfaCascadeDynamics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    edfaEl.innerHTML = renderEdfaCascadeSvg(edfaDyn, { isDark, compact: true });
  }

  setupEdfaCascadeModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const ptpEl = document.getElementById('dashboardPtpTbcChart');
  if (ptpEl) {
    const ptpDyn = calculatePtpTbcDynamics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    ptpEl.innerHTML = renderPtpTbcDiagramSvg(ptpDyn, { isDark, compact: true });
  }

  setupPtpTbcModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const rpkiEl = document.getElementById('dashboardRpkiChart');
  if (rpkiEl) {
    const rpkiMetrics = calculateRpkiMetrics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    rpkiEl.innerHTML = renderRpkiDiagramSvg(rpkiMetrics, { isDark, compact: true });
  }

  setupRpkiModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const polEl = document.getElementById('dashboardPolarizationChart');
  if (polEl) {
    const polMetrics = calculatePolarizationMetrics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    polEl.innerHTML = renderPolarizationDiagramSvg(polMetrics, { isDark, compact: true });
  }

  setupPolarizationModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const rocev2El = document.getElementById('dashboardRocev2Chart');
  if (rocev2El) {
    const rocev2Metrics = calculateRocev2Metrics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    rocev2El.innerHTML = renderRocev2DiagramSvg(rocev2Metrics, { isDark, compact: true });
  }

  setupRocev2Modal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  const olpEl = document.getElementById('dashboardOlpChart');
  if (olpEl) {
    const olpMetrics = calculateOlpMetrics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    olpEl.innerHTML = renderOlpDiagramSvg(olpMetrics, { isDark, compact: true });
  }

  setupOlpModal(state, { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast });

  // 8 Dashboard Diagnostics Modals (#237)
  const diagOpts = { referenceDate, onFilterArea: options.onFilterArea, onFilterCustomer: options.onFilterCustomer, onToast: options.onToast };
  setupY1731Modal(state, diagOpts);
  setupPseudowireModal(state, diagOpts);
  setupBfdModal(state, diagOpts);
  setupVplsModal(state, diagOpts);
  setupCgnatModal(state, diagOpts);
  setupOltChassisModal(state, diagOpts);
  setupSrv6Modal(state, diagOpts);
  setupOpticalEvmModal(state, diagOpts);

  if (typeof document !== 'undefined') {
    ['dashboardY1731Modal', 'dashboardPseudowireModal', 'dashboardBfdModal', 'dashboardVplsModal', 'dashboardCgnatModal', 'dashboardOltChassisModal', 'dashboardSrv6Modal', 'dashboardOpticalEvmModal'].forEach(id => {
      const dlg = document.getElementById(id);
      if (dlg && !dlg.dataset.backdropWired) {
        dlg.dataset.backdropWired = 'true';
        dlg.addEventListener('click', (e) => {
          if (e.target === dlg && typeof dlg.close === 'function') dlg.close();
        });
      }
    });
  }
}
