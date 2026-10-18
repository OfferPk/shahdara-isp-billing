import { formatPKR } from './core.js';

/**
 * Carrier Ethernet Synchronous Ethernet (SyncE / ITU-T G.8262)
 * & IEEE 1588v2 Precision Time Protocol (PTP / ITU-T G.8275.1 Telecom Profile)
 * Frequency & Phase Clock Synchronization Matrix
 *
 * Models physical layer frequency synchronization via Ethernet Synchronization
 * Messaging Channel (ESMC / ITU-T G.8264) with Synchronization Status Messages (SSM:
 * PRC, SSU-A, SSU-B, SEC, DNU) combined with sub-microsecond packet-based phase/time-of-day
 * synchronization (IEEE 1588v2 / PTP Telecom Profile G.8275.1).
 *
 * Simulates Grandmaster (T-GM) GNSS lock, Boundary Clock (T-BC) cascade delays,
 * Transparent Clock (T-TC) residence time compensation, slave clock phase error (±100ns target),
 * packet delay variation (PDV jitter), oscillator holdover aging drift (Rubidium vs OCXO vs TCXO),
 * and correlates clock health with Shahdara subscriber traffic integrity.
 */

export const SYNCE_CONSTANTS = {
  SSM_QUALITY_LEVELS: {
    PRC: { code: 'PRC', label: 'PRC / ITU-T G.811 (Primary Reference Clock, Stratum 1)', priority: 1, accuracy: '1x10^-11' },
    SSU_A: { code: 'SSU-A', label: 'SSU-A / Type I (Stratum 2 Rubidium Standard)', priority: 2, accuracy: '1x10^-9' },
    SSU_B: { code: 'SSU-B', label: 'SSU-B / Type II (Stratum 3E Clock)', priority: 3, accuracy: '1x10^-8' },
    SEC: { code: 'SEC', label: 'SEC / ITU-T G.8262 (Synchronous Ethernet Equipment Clock)', priority: 4, accuracy: '4.6x10^-6' },
    DNU: { code: 'DNU', label: 'DNU (Do Not Use / Clock Loop Suppression)', priority: 5, accuracy: 'N/A' }
  },
  PTP_PROFILES: {
    G8275_1: 'ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)',
    G8265_1: 'ITU-T G.8265.1 (Frequency Delivery over Packet Networks)',
    IEEE1588_DEFAULT: 'IEEE 1588-2008 Default E2E Profile'
  },
  TARGET_PHASE_ERROR_MAX_NS: 100.0,
  WARNING_PHASE_ERROR_MAX_NS: 500.0,
  TARGET_JITTER_MAX_US: 1.5,
  WARNING_JITTER_MAX_US: 3.0,
  OSCILLATOR_TYPES: {
    RUBIDIUM: { name: 'Rubidium Atomic Clock (Stratum 2)', baseDriftRateNsPerHour: 12.5 },
    OCXO: { name: 'Oven-Controlled Crystal Oscillator (OCXO, Stratum 3E)', baseDriftRateNsPerHour: 45.0 },
    TCXO: { name: 'Temperature-Compensated Oscillator (TCXO, Stratum 3)', baseDriftRateNsPerHour: 160.0 }
  }
};

export const SHAHDARA_SYNCE_NODES = [
  {
    id: 'synce-node-gm-central',
    name: 'T-GM-01 Shahdara Central Grandmaster Clock',
    role: 'Grandmaster (T-GM)',
    location: 'Shahdara Central POP Core Facility',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    hardwarePlatform: 'Microchip TimeProvider 4100 / Oscilloquartz OSA 5420',
    clockSource: 'Dual GNSS (GPS L1/L2 + Galileo E1/E5) & Rubidium Atomic Core',
    ssmQuality: 'PRC',
    ptpProfile: 'ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)',
    oscillatorType: 'RUBIDIUM',
    basePhaseErrorNs: 0.0,
    baseJitterUs: 0.12,
    cableDelayNs: 8.5,
    connectedDownstreamCount: 18,
    isGrandmaster: true
  },
  {
    id: 'synce-node-bc-core',
    name: 'T-BC-01 Shahdara Town Core Aggregator',
    role: 'Boundary Clock (T-BC)',
    location: 'Central Exchange Aggregation Facility',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town'],
    hardwarePlatform: 'Juniper MX204 Telecom Boundary Clock Router',
    clockSource: 'SyncE (xe-0/0/0) + PTP Sync Flow from T-GM-01',
    ssmQuality: 'SSU_A',
    ptpProfile: 'ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)',
    oscillatorType: 'OCXO',
    basePhaseErrorNs: 18.0,
    baseJitterUs: 0.38,
    cableDelayNs: 14.2,
    connectedDownstreamCount: 14,
    isGrandmaster: false
  },
  {
    id: 'synce-node-bc-baradari',
    name: 'T-BC-02 Baradari Industrial Feeder POP',
    role: 'Boundary Clock (T-BC)',
    location: 'Baradari Road Fiber Distribution Center',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    hardwarePlatform: 'Cisco ASR 920 Metro Aggregator Clock Unit',
    clockSource: 'SyncE (xe-0/0/1) + PTP Sync Flow from T-BC-01',
    ssmQuality: 'SSU_A',
    ptpProfile: 'ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)',
    oscillatorType: 'OCXO',
    basePhaseErrorNs: 42.0,
    baseJitterUs: 0.75,
    cableDelayNs: 22.8,
    connectedDownstreamCount: 9,
    isGrandmaster: false
  },
  {
    id: 'synce-node-bc-vandala',
    name: 'T-BC-03 Vandala Road Distribution Hub',
    role: 'Boundary Clock (T-BC)',
    location: 'Vandala Road OLT Node Facility',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    hardwarePlatform: 'Huawei S6730-H Telecom Boundary Switch',
    clockSource: 'SyncE (xe-0/0/2) + PTP Sync Flow from T-BC-01',
    ssmQuality: 'SSU_B',
    ptpProfile: 'ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)',
    oscillatorType: 'OCXO',
    basePhaseErrorNs: -35.0,
    baseJitterUs: 0.98,
    cableDelayNs: 31.4,
    connectedDownstreamCount: 11,
    isGrandmaster: false
  },
  {
    id: 'synce-node-bc-jiamusa',
    name: 'T-BC-04 Jia Musa Aggregation Link',
    role: 'Boundary Clock (T-BC)',
    location: 'Jia Musa Main POP',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    hardwarePlatform: 'ZTE ZXR10 5960 Metro Clock Unit',
    clockSource: 'SyncE (xe-0/0/3) + PTP Sync Flow from T-BC-01',
    ssmQuality: 'SSU_B',
    ptpProfile: 'ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)',
    oscillatorType: 'TCXO',
    basePhaseErrorNs: 65.0,
    baseJitterUs: 1.25,
    cableDelayNs: 27.6,
    connectedDownstreamCount: 7,
    isGrandmaster: false
  },
  {
    id: 'synce-node-tc-saeed',
    name: 'T-TC-05 Saeed Park Distribution Ring',
    role: 'Transparent Clock (T-TC)',
    location: 'Saeed Park Metro Substation',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park'],
    hardwarePlatform: 'FiberHome CiTRANS 660A Metro Unit',
    clockSource: 'PTP Residence Time Hardware Timestamper (TC)',
    ssmQuality: 'SEC',
    ptpProfile: 'ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)',
    oscillatorType: 'TCXO',
    basePhaseErrorNs: 88.0,
    baseJitterUs: 1.45,
    cableDelayNs: 36.2,
    connectedDownstreamCount: 5,
    isGrandmaster: false
  },
  {
    id: 'synce-node-sc-begumkot',
    name: 'T-TSC-06 Begum Kot Edge Slave Clock',
    role: 'Time Slave Clock (T-TSC)',
    location: 'Begum Kot Outlying Sub-POP',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Sheikhupura Road', 'Kot Begum'],
    hardwarePlatform: 'Nokia 7210 SAS-Mxp Service Router Client',
    clockSource: 'SyncE (ge-0/0/1) + PTP Client Loop Recovery',
    ssmQuality: 'SEC',
    ptpProfile: 'ITU-T G.8275.1 (Telecom Phase/Time with Full Timing Support)',
    oscillatorType: 'TCXO',
    basePhaseErrorNs: 280.0,
    baseJitterUs: 2.95,
    cableDelayNs: 54.0,
    connectedDownstreamCount: 3,
    isGrandmaster: false
  }
];

// Interactive simulation state
let currentSelectedSyncNodeId = 'synce-node-gm-central';
let currentHoldoverHours = 0.0;
let currentJitterSurgeUs = 0.0;
let currentGnssLossInjected = false;
let currentSelectedProfile = SYNCE_CONSTANTS.PTP_PROFILES.G8275_1;

export function getSyncESelectedNode() {
  return currentSelectedSyncNodeId;
}

export function setSyncESelectedNode(id) {
  if (SHAHDARA_SYNCE_NODES.some(n => n.id === id)) {
    currentSelectedSyncNodeId = id;
  }
}

export function getSyncEHoldoverHours() {
  return currentHoldoverHours;
}

export function setSyncEHoldoverHours(val) {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    currentHoldoverHours = Math.max(0.0, Math.min(72.0, val));
  }
}

export function getSyncEJitterSurgeUs() {
  return currentJitterSurgeUs;
}

export function setSyncEJitterSurgeUs(val) {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    currentJitterSurgeUs = Math.max(0.0, Math.min(10.0, val));
  }
}

export function getSyncEGnssLossInjected() {
  return currentGnssLossInjected;
}

export function setSyncEGnssLossInjected(val) {
  currentGnssLossInjected = Boolean(val);
}

export function getSyncESelectedProfile() {
  return currentSelectedProfile;
}

export function setSyncESelectedProfile(profile) {
  if (Object.values(SYNCE_CONSTANTS.PTP_PROFILES).includes(profile)) {
    currentSelectedProfile = profile;
  }
}

export function resetSyncESimState() {
  currentSelectedSyncNodeId = 'synce-node-gm-central';
  currentHoldoverHours = 0.0;
  currentJitterSurgeUs = 0.0;
  currentGnssLossInjected = false;
  currentSelectedProfile = SYNCE_CONSTANTS.PTP_PROFILES.G8275_1;
}

/**
 * Calculates oscillator holdover drift in nanoseconds
 */
export function calculateOscillatorHoldoverDrift(oscillatorKey, hours) {
  if (hours <= 0) return 0.0;
  const osc = SYNCE_CONSTANTS.OSCILLATOR_TYPES[oscillatorKey] || SYNCE_CONSTANTS.OSCILLATOR_TYPES.OCXO;
  const rate = osc.baseDriftRateNsPerHour;
  // Non-linear aging and temperature drift curve
  const drift = rate * hours + 0.12 * Math.pow(hours, 1.85);
  return Number(drift.toFixed(1));
}

/**
 * Calculates synchronization performance metrics for a single SyncE/PTP node
 */
export function calculateNodeSyncMetrics(node, overrides = {}) {
  const isSelected = node.id === (overrides.selectedNodeId || currentSelectedSyncNodeId);
  const holdoverHours = isSelected ? (overrides.holdoverHours ?? currentHoldoverHours) : 0.0;
  const jitterSurgeUs = isSelected ? (overrides.jitterSurgeUs ?? currentJitterSurgeUs) : 0.0;
  const gnssLossInjected = isSelected ? (overrides.gnssLossInjected ?? currentGnssLossInjected) : false;
  const ptpProfile = isSelected ? (overrides.ptpProfile ?? currentSelectedProfile) : node.ptpProfile;

  const isHoldoverActive = holdoverHours > 0 || (node.isGrandmaster && gnssLossInjected);
  const effectiveHoldoverHours = isHoldoverActive ? Math.max(holdoverHours, (node.isGrandmaster && gnssLossInjected ? Math.max(1.0, holdoverHours) : holdoverHours)) : 0.0;

  const holdoverDriftNs = calculateOscillatorHoldoverDrift(node.oscillatorType, effectiveHoldoverHours);
  const effectiveJitterUs = Number((node.baseJitterUs + jitterSurgeUs).toFixed(2));

  // Jitter surge induces dynamic phase measurement uncertainty (approx 22ns per 1us PDV surge)
  const jitterInducedPhaseNs = jitterSurgeUs * 22.0;
  const sign = node.basePhaseErrorNs >= 0 ? 1 : -1;
  const rawPhaseErrorNs = node.basePhaseErrorNs + (sign * holdoverDriftNs) + (sign * jitterInducedPhaseNs * 0.4);
  const effectivePhaseErrorNs = Number(rawPhaseErrorNs.toFixed(1));
  const absPhaseErrorNs = Math.abs(effectivePhaseErrorNs);


  // Maximum Time Interval Error (MTIE) and Time Deviation (TDEV) estimates
  const mtieNs = Number((absPhaseErrorNs * 1.35 + effectiveJitterUs * 18.0).toFixed(1));
  const tdevNs = Number((effectiveJitterUs * 8.5 + (absPhaseErrorNs > 100 ? absPhaseErrorNs * 0.12 : 3.5)).toFixed(1));

  // Determine SSM and operational sync state
  let effectiveSsm = node.ssmQuality;
  let syncState = 'LOCKED';
  let badgeClass = 'badge-success';
  let syncStateLabel = 'LOCKED (In-Spec)';

  if (node.isGrandmaster) {
    if (gnssLossInjected || effectiveHoldoverHours > 0) {
      effectiveSsm = 'SSU_A'; // Grandmaster downgrades to Rubidium holdover
      if (absPhaseErrorNs > SYNCE_CONSTANTS.WARNING_PHASE_ERROR_MAX_NS || effectiveHoldoverHours > 24) {
        syncState = 'OUT_OF_SPEC';
        badgeClass = 'badge-danger';
        syncStateLabel = 'HOLDOVER EXPIRED';
      } else {
        syncState = 'HOLDOVER';
        badgeClass = 'badge-warning';
        syncStateLabel = `HOLDOVER (${effectiveHoldoverHours.toFixed(1)}h)`;
      }
    } else {
      effectiveSsm = 'PRC';
      syncState = 'LOCKED_GNSS';
      badgeClass = 'badge-success';
      syncStateLabel = 'GNSS LOCKED (PRC)';
    }
  } else {
    if (effectiveHoldoverHours > 0) {
      effectiveSsm = 'SEC';
      if (absPhaseErrorNs > SYNCE_CONSTANTS.WARNING_PHASE_ERROR_MAX_NS || effectiveHoldoverHours > 24) {
        syncState = 'OUT_OF_SPEC';
        badgeClass = 'badge-danger';
        syncStateLabel = 'OUT OF SPEC / UNLOCKED';
      } else {
        syncState = 'HOLDOVER';
        badgeClass = 'badge-warning';
        syncStateLabel = `HOLDOVER (${effectiveHoldoverHours.toFixed(1)}h)`;
      }
    } else if (absPhaseErrorNs > SYNCE_CONSTANTS.WARNING_PHASE_ERROR_MAX_NS || effectiveJitterUs > SYNCE_CONSTANTS.WARNING_JITTER_MAX_US) {
      syncState = 'OUT_OF_SPEC';
      badgeClass = 'badge-danger';
      syncStateLabel = 'OUT OF SPEC (Phase Slip)';
      effectiveSsm = 'DNU';
    } else if (absPhaseErrorNs > SYNCE_CONSTANTS.TARGET_PHASE_ERROR_MAX_NS || effectiveJitterUs > SYNCE_CONSTANTS.TARGET_JITTER_MAX_US) {
      syncState = 'DEGRADED';
      badgeClass = 'badge-warning';
      syncStateLabel = 'DEGRADED (High Jitter)';
    } else {
      syncState = 'LOCKED';
      badgeClass = 'badge-success';
      syncStateLabel = 'LOCKED (In-Spec)';
    }
  }

  // Estimated microsecond packet timestamping SLA penalty risk (%)
  let slaPacketSlipRiskPct = 0.0;
  if (syncState === 'OUT_OF_SPEC') {
    slaPacketSlipRiskPct = Math.min(100.0, Number(((absPhaseErrorNs / 1000.0) * 15.0 + effectiveJitterUs * 5.0).toFixed(1)));
  } else if (syncState === 'DEGRADED' || syncState === 'HOLDOVER') {
    slaPacketSlipRiskPct = Number(((absPhaseErrorNs / 500.0) * 4.5).toFixed(1));
  }

  const ssmInfo = SYNCE_CONSTANTS.SSM_QUALITY_LEVELS[effectiveSsm] || SYNCE_CONSTANTS.SSM_QUALITY_LEVELS.SEC;

  return {
    ...node,
    effectivePhaseErrorNs,
    absPhaseErrorNs,
    effectiveJitterUs,
    holdoverHours: effectiveHoldoverHours,
    holdoverDriftNs,
    isHoldoverActive,
    mtieNs,
    tdevNs,
    effectiveSsm,
    ssmInfo,
    ptpProfile,
    syncState,
    syncStateLabel,
    badgeClass,
    slaPacketSlipRiskPct,
    isSelected
  };
}

/**
 * Calculates aggregate SyncE and IEEE 1588v2 PTP metrics correlated with Shahdara ledger
 */
export function calculateSyncEMetrics(state, options = {}) {
  const selectedId = options.selectedNodeId || currentSelectedSyncNodeId;
  const customers = (state && Array.isArray(state.customers)) ? state.customers : [];
  const bills = (state && Array.isArray(state.bills)) ? state.bills : [];

  const allNodes = SHAHDARA_SYNCE_NODES.map(node => {
    const nodeData = calculateNodeSyncMetrics(node, {
      selectedNodeId: selectedId,
      holdoverHours: options.holdoverHours,
      jitterSurgeUs: options.jitterSurgeUs,
      gnssLossInjected: options.gnssLossInjected,
      ptpProfile: options.ptpProfile
    });

    // Correlate with ledger subscribers by primaryArea and aliasAreas
    const matchedCustomers = customers.filter(c => {
      if (c.archived) return false;
      const area = (c.area || '').trim().toLowerCase();
      return node.aliasAreas.some(alias => alias.toLowerCase() === area || area.includes(alias.toLowerCase()));
    });

    const activeCount = matchedCustomers.filter(c => c.serviceStatus === 'active').length;
    const offlineCount = matchedCustomers.filter(c => c.serviceStatus === 'offline').length;

    let totalDue = 0;
    matchedCustomers.forEach(c => {
      const cBills = Array.isArray(c.bills) ? c.bills : [];
      cBills.forEach(b => {
        const due = Number(b.dueAmount) || 0;
        if (due > 0 && b.paid !== true) {
          totalDue += due;
        }
      });
    });

    // Potential billing SLA exposure if node sync slips out of spec
    const atRiskRevenue = (nodeData.syncState === 'OUT_OF_SPEC' || nodeData.syncState === 'DEGRADED')
      ? Math.round(totalDue * (nodeData.slaPacketSlipRiskPct / 100.0) + (activeCount * 85))
      : 0;

    return {
      ...nodeData,
      matchedCustomersCount: matchedCustomers.length,
      activeCount,
      offlineCount,
      totalDue,
      atRiskRevenue
    };
  });

  const selectedNode = allNodes.find(n => n.id === selectedId) || allNodes[0];

  const totalNodes = allNodes.length;
  const lockedCount = allNodes.filter(n => n.syncState === 'LOCKED' || n.syncState === 'LOCKED_GNSS').length;
  const holdoverCount = allNodes.filter(n => n.syncState === 'HOLDOVER').length;
  const degradedCount = allNodes.filter(n => n.syncState === 'DEGRADED').length;
  const outOfSpecCount = allNodes.filter(n => n.syncState === 'OUT_OF_SPEC').length;

  // Fleet synchronization health index (0 to 100%)
  const healthIndex = Math.round(
    ((lockedCount * 1.0 + holdoverCount * 0.7 + degradedCount * 0.4 + outOfSpecCount * 0.0) / totalNodes) * 100
  );

  const totalRevenueRisk = allNodes.reduce((sum, n) => sum + n.atRiskRevenue, 0);

  let fleetStatus = 'OPTIMAL';
  let fleetBadgeClass = 'badge-success';
  if (outOfSpecCount > 0) {
    fleetStatus = 'CLOCK SLIP DETECTED';
    fleetBadgeClass = 'badge-danger';
  } else if (holdoverCount > 0 || degradedCount > 0) {
    fleetStatus = 'HOLDOVER RUNNING';
    fleetBadgeClass = 'badge-warning';
  }

  return {
    nodes: allNodes,
    selectedNode,
    totalNodes,
    lockedCount,
    holdoverCount,
    degradedCount,
    outOfSpecCount,
    healthIndex,
    totalRevenueRisk,
    fleetStatus,
    fleetBadgeClass
  };
}

/**
 * Pure offline SVG rendering for SyncE / PTP clock synchronization
 */
export function renderSyncEClockSvg(syncData, { compact = false, width = 560, height = 280 } = {}) {
  if (!syncData || !syncData.selectedNode) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="SyncE Clock Synchronization: No data">
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="12" fill="var(--muted, #71817c)">No clock telemetry recorded</text>
    </svg>`;
  }

  const { selectedNode, healthIndex, fleetBadgeClass } = syncData;

  if (compact) {
    // Compact widget for dashboard card: Semicircular Phase Error Gauge and SSM Badge
    const cWidth = 480;
    const cHeight = 210;
    const cx = cWidth / 2 - 80;
    const cy = 135;
    const radius = 68;

    // Semicircle gauge path (-90 to +90 degrees)
    // Scale: -200ns to +200ns
    const maxScaleNs = 200.0;
    const clampedPhase = Math.max(-maxScaleNs, Math.min(maxScaleNs, selectedNode.effectivePhaseErrorNs));
    const angleRad = (clampedPhase / maxScaleNs) * (Math.PI / 2); // -PI/2 to +PI/2
    const needleX = cx + radius * Math.sin(angleRad);
    const needleY = cy - radius * Math.cos(angleRad);

    const needleColor = selectedNode.absPhaseErrorNs > SYNCE_CONSTANTS.WARNING_PHASE_ERROR_MAX_NS
      ? '#ef4444'
      : (selectedNode.absPhaseErrorNs > SYNCE_CONSTANTS.TARGET_PHASE_ERROR_MAX_NS ? '#f59e0b' : '#10b981');

    return `<svg class="chart-svg synce-compact-svg" viewBox="0 0 ${cWidth} ${cHeight}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="SyncE Phase Error Dial: ${selectedNode.name}, ${selectedNode.effectivePhaseErrorNs} ns, Status ${selectedNode.syncStateLabel}">
      <!-- Gauge Track Arc -->
      <path d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}" fill="none" stroke="var(--line, #e2ece7)" stroke-width="12" stroke-linecap="round"/>
      
      <!-- Safe Window Track (±100ns) -->
      <path d="M ${cx - radius * 0.707} ${cy - radius * 0.707} A ${radius} ${radius} 0 0 1 ${cx + radius * 0.707} ${cy - radius * 0.707}" fill="none" stroke="#10b981" stroke-width="12" opacity="0.35"/>

      <!-- Gauge Needle -->
      <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="${needleColor}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="var(--ink, #182e2a)"/>
      <circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>

      <!-- Gauge Scale Labels -->
      <text x="${cx - radius - 2}" y="${cy + 16}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">-200ns</text>
      <text x="${cx}" y="${cy - radius - 8}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#10b981">0 ns (In-Spec)</text>
      <text x="${cx + radius + 4}" y="${cy + 16}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">+200ns</text>

      <!-- Center Digital Readout -->
      <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="16" font-weight="800" fill="${needleColor}">
        ${selectedNode.effectivePhaseErrorNs > 0 ? '+' : ''}${selectedNode.effectivePhaseErrorNs} ns
      </text>
      <text x="${cx}" y="${cy + 38}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">
        Phase Offset (ITU-T G.8275.1)
      </text>

      <!-- Right Side KPI Summary Cards -->
      <g transform="translate(${cWidth - 180}, 20)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">SSM QUALITY (ESMC)</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="#0284c7">${selectedNode.effectiveSsm} · ${selectedNode.oscillatorType}</text>
      </g>

      <g transform="translate(${cWidth - 180}, 70)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">PDV PACKET JITTER</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #182e2a)">${selectedNode.effectiveJitterUs} µs <tspan font-size="9" font-weight="500" fill="var(--muted, #71817c)">(target ≤1.5µs)</tspan></text>
      </g>

      <g transform="translate(${cWidth - 180}, 120)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">FLEET SYNC HEALTH</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="#10b981">${healthIndex}% Synchronized</text>
      </g>

      <!-- Bottom node badge -->
      <text x="${cWidth / 2}" y="${cHeight - 8}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        Monitored: <tspan font-weight="700" fill="var(--ink, #182e2a)">${selectedNode.name}</tspan> · ${selectedNode.syncStateLabel}
      </text>
    </svg>`;
  }

  // Full detailed topology and timing waveform diagram for modal dialog
  const svgW = 760;
  const svgH = 340;

  // Upper section: Timing Clock Hierarchy Tree
  // Nodes layout across X axis:
  // GM (x=110), Core (x=240), Baradari (x=370), Vandala (x=500), JiaMusa (x=630)
  const nodeXCoords = {
    'synce-node-gm-central': 100,
    'synce-node-bc-core': 230,
    'synce-node-bc-baradari': 360,
    'synce-node-bc-vandala': 490,
    'synce-node-bc-jiamusa': 620
  };

  let treeLinksSvg = '';
  // GM to Core
  treeLinksSvg += `<line x1="135" y1="50" x2="195" y2="50" stroke="#0284c7" stroke-width="2.5" stroke-dasharray="3,3"/>`;
  treeLinksSvg += `<polygon points="195,50 187,46 187,54" fill="#0284c7"/>`;

  // Core to Baradari, Vandala, JiaMusa
  treeLinksSvg += `<path d="M 265 50 L 325 50" stroke="#0284c7" stroke-width="2.5"/>`;
  treeLinksSvg += `<polygon points="325,50 317,46 317,54" fill="#0284c7"/>`;

  treeLinksSvg += `<path d="M 265 55 L 290 85 L 455 85 L 455 55" fill="none" stroke="#0284c7" stroke-width="2"/>`;
  treeLinksSvg += `<polygon points="455,55 451,63 459,63" fill="#0284c7"/>`;

  treeLinksSvg += `<path d="M 265 60 L 290 100 L 585 100 L 585 55" fill="none" stroke="#0284c7" stroke-width="2"/>`;
  treeLinksSvg += `<polygon points="585,55 581,63 589,63" fill="#0284c7"/>`;

  // Draw node boxes
  let nodesSvg = '';
  syncData.nodes.slice(0, 5).forEach(node => {
    const nx = nodeXCoords[node.id] || 100;
    const ny = 24;
    const nw = 70;
    const nh = 52;
    const isNodeSelected = node.id === selectedNode.id;
    const strokeColor = isNodeSelected ? '#0e5b4d' : (node.absPhaseErrorNs > 100 ? '#f59e0b' : '#0284c7');
    const strokeWidth = isNodeSelected ? 3 : 1.5;
    const fillColor = isNodeSelected ? 'rgba(14, 91, 77, 0.12)' : 'var(--surface-sunken, #f0f5f2)';

    nodesSvg += `
      <g class="synce-node-box" transform="translate(${nx}, ${ny})" style="cursor: pointer;">
        <rect width="${nw}" height="${nh}" rx="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
        <text x="${nw / 2}" y="16" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="var(--ink, #182e2a)">${node.name.split(' ')[0]}</text>
        <text x="${nw / 2}" y="30" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="10" font-weight="800" fill="${node.absPhaseErrorNs > 100 ? '#ef4444' : '#10b981'}">
          ${node.effectivePhaseErrorNs > 0 ? '+' : ''}${node.effectivePhaseErrorNs}ns
        </text>
        <text x="${nw / 2}" y="44" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="600" fill="var(--muted, #71817c)">${node.effectiveSsm}</text>
      </g>
    `;

  });

  // Lower Section: Phase Error Drift Waveform & Holdover Stability Plot
  const plotX = 70;
  const plotY = 145;
  const plotW = 620;
  const plotH = 150;
  const midY = plotY + plotH / 2; // 0 ns line

  // Safe corridor: ±100ns (height corresponds to ±300ns max plot range)
  const maxPlotRangeNs = 300.0;
  const scaleNsToPx = (plotH / 2) / maxPlotRangeNs;
  const safeTopY = midY - 100.0 * scaleNsToPx;
  const safeBottomY = midY + 100.0 * scaleNsToPx;
  const safeH = safeBottomY - safeTopY;

  // Grid lines
  let gridSvg = `
    <!-- Target ±100ns Safe Corridor -->
    <rect x="${plotX}" y="${safeTopY}" width="${plotW}" height="${safeH}" fill="rgba(16, 185, 129, 0.08)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1" stroke-dasharray="3,3"/>
    
    <!-- Zero Phase Reference Line -->
    <line x1="${plotX}" y1="${midY}" x2="${plotX + plotW}" y2="${midY}" stroke="var(--ink, #182e2a)" stroke-width="1.5" stroke-dasharray="4,2"/>
    <text x="${plotX - 8}" y="${midY + 4}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="var(--ink, #182e2a)">0 ns</text>

    <!-- +100ns and -100ns lines -->
    <text x="${plotX - 8}" y="${safeTopY + 3}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" fill="#10b981">+100ns</text>
    <text x="${plotX - 8}" y="${safeBottomY + 3}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" fill="#10b981">-100ns</text>

    <!-- +250ns and -250ns boundary lines -->
    <line x1="${plotX}" y1="${midY - 250 * scaleNsToPx}" x2="${plotX + plotW}" y2="${midY - 250 * scaleNsToPx}" stroke="rgba(239, 68, 68, 0.35)" stroke-dasharray="2,2"/>
    <line x1="${plotX}" y1="${midY + 250 * scaleNsToPx}" x2="${plotX + plotW}" y2="${midY + 250 * scaleNsToPx}" stroke="rgba(239, 68, 68, 0.35)" stroke-dasharray="2,2"/>
    <text x="${plotX - 8}" y="${midY - 250 * scaleNsToPx + 3}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="8" fill="#ef4444">+250ns</text>
    <text x="${plotX - 8}" y="${midY + 250 * scaleNsToPx + 3}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="8" fill="#ef4444">-250ns</text>
  `;

  // Generate simulated time-series wave across 24 intervals
  const steps = 24;
  let wavePoints = '';
  const baseVal = selectedNode.effectivePhaseErrorNs;
  const jitterVal = selectedNode.effectiveJitterUs * 12.0;

  for (let i = 0; i <= steps; i++) {
    const x = plotX + (i / steps) * plotW;
    const progress = i / steps;
    // Harmonic wave simulating packet delay jitter + holdover ramp
    const noise = Math.sin(i * 1.3) * jitterVal + Math.cos(i * 0.7) * (jitterVal * 0.5);
    const holdoverRamp = selectedNode.isHoldoverActive ? (progress * selectedNode.holdoverDriftNs * 0.8) : 0;
    const val = baseVal + noise + holdoverRamp;
    const clampedVal = Math.max(-290, Math.min(290, val));
    const y = midY - clampedVal * scaleNsToPx;
    wavePoints += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
  }

  const waveColor = selectedNode.absPhaseErrorNs > SYNCE_CONSTANTS.WARNING_PHASE_ERROR_MAX_NS
    ? '#ef4444'
    : (selectedNode.absPhaseErrorNs > SYNCE_CONSTANTS.TARGET_PHASE_ERROR_MAX_NS ? '#f59e0b' : '#0284c7');

  return `<svg class="chart-svg synce-modal-svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="SyncE Clock Synchronization Tree and Phase Error Trajectory">
    <!-- Header Labels -->
    <text x="70" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--muted, #71817c)">
      CARRIER ETHERNET CLOCK TOPOLOGY TREE (ITU-T G.8262 ESMC &amp; IEEE 1588v2 PTP)
    </text>

    <!-- Topology Tree -->
    <g class="synce-topology-group">
      ${treeLinksSvg}
      ${nodesSvg}
    </g>

    <!-- Phase Error Waveform Plot -->
    <text x="70" y="132" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--muted, #71817c)">
      PHASE OFFSET JITTER &amp; HOLDOVER ENVELOPE (TARGET ±100ns WINDOW)
    </text>

    <!-- Plot Background -->
    <rect x="${plotX}" y="${plotY}" width="${plotW}" height="${plotH}" rx="4" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
    
    ${gridSvg}

    <!-- Live Waveform Polyline -->
    <path d="${wavePoints}" fill="none" stroke="${waveColor}" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Plot X Axis Labels -->
    <text x="${plotX}" y="${plotY + plotH + 16}" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">-60 min</text>
    <text x="${plotX + plotW / 2}" y="${plotY + plotH + 16}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">-30 min</text>
    <text x="${plotX + plotW}" y="${plotY + plotH + 16}" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">Live Now (PKT)</text>
  </svg>`;
}

/**
 * Generates an executive synchronization report for clipboard export
 */
export function generateSyncEReport(syncData) {
  if (!syncData || !syncData.selectedNode) return 'No synchronization telemetry available.';
  const { selectedNode, nodes, healthIndex, totalRevenueRisk } = syncData;

  const lines = [
    '====================================================================',
    '📡 SHAHDARA ISP — SYNCHRONOUS ETHERNET & PTP CLOCK AUDIT BRIEFING',
    `Report Time: ${new Date().toISOString()} PKT`,
    'Standards: ITU-T G.8262 (SyncE) / G.8264 (ESMC) / G.8275.1 (PTP Phase)',
    '====================================================================',
    '',
    `[ ACTIVE MONITORED NODE ]`,
    `• Node Name: ${selectedNode.name}`,
    `• Architecture Role: ${selectedNode.role}`,
    `• Location: ${selectedNode.location}`,
    `• Clock Hardware: ${selectedNode.hardwarePlatform}`,
    `• Reference Source: ${selectedNode.clockSource}`,
    `• Quality SSM: ${selectedNode.ssmInfo.label}`,
    `• Oscillator Type: ${selectedNode.oscillatorType}`,
    `• PTP Telecom Profile: ${selectedNode.ptpProfile}`,
    `• Phase Error: ${selectedNode.effectivePhaseErrorNs > 0 ? '+' : ''}${selectedNode.effectivePhaseErrorNs} ns (Spec target: ±100 ns)`,
    `• 2-Way PDV Jitter: ${selectedNode.effectiveJitterUs} µs (Spec target: ≤1.5 µs)`,
    `• MTIE / TDEV Estimates: MTIE=${selectedNode.mtieNs} ns, TDEV=${selectedNode.tdevNs} ns`,
    `• Synchronization State: ${selectedNode.syncStateLabel}`,
    `• Holdover Runway: ${selectedNode.holdoverHours > 0 ? `${selectedNode.holdoverHours.toFixed(1)} hrs (${selectedNode.holdoverDriftNs}ns drift)` : 'Locked (No Holdover)'}`,
    `• Downstream Slaves: ${selectedNode.connectedDownstreamCount} subtended clock nodes`,
    `• Matched Customers: ${selectedNode.matchedCustomersCount} (${selectedNode.activeCount} active)`,
    `• Revenue SLA Exposure: ${formatPKR(selectedNode.atRiskRevenue)}`,
    '',
    `[ SHAHDARA ISP NETWORK CLOCK REGISTER ]`
  ];

  nodes.forEach((n, idx) => {
    lines.push(
      `${idx + 1}. [${n.role.split(' ')[0]}] ${n.name}`,
      `   SSM: ${n.effectiveSsm} | Phase: ${n.effectivePhaseErrorNs > 0 ? '+' : ''}${n.effectivePhaseErrorNs}ns | Jitter: ${n.effectiveJitterUs}µs | State: ${n.syncStateLabel} | Exposure: ${formatPKR(n.atRiskRevenue)}`
    );
  });

  lines.push(
    '',
    `[ FLEET SYNCHRONIZATION SUMMARY ]`,
    `• Overall Health Index: ${healthIndex}% in lock`,
    `• Total Monitored Nodes: ${nodes.length}`,
    `• Locked: ${syncData.lockedCount} | Holdover: ${syncData.holdoverCount} | Degraded: ${syncData.degradedCount} | Out-of-Spec: ${syncData.outOfSpecCount}`,
    `• Total Network Revenue Exposure: ${formatPKR(totalRevenueRisk)}`,
    '====================================================================',
    'Shahdara ISP Precision Timing & Core Synchronous Carrier Transport'
  );

  return lines.join('\n');
}

/**
 * Wires the interactive SyncE / PTP modal dialog with user controls, KPI cards, table, and actions
 */
export function setupSyncEModal(state, { referenceDate = new Date(), onFilterArea, onFilterCustomer, onToast, clipboard } = {}) {
  const modal = document.getElementById('dashboardSyncEModal');

  const openBtn = document.getElementById('dashboardOpenSyncEModalBtn');
  const closeBtn = document.getElementById('dashboardSyncEModalCloseBtn');

  const nodeSelect = document.getElementById('synceNodeSelect');
  const gnssLossSelect = document.getElementById('synceGnssLossSelect');
  const profileSelect = document.getElementById('synceProfileSelect');
  const holdoverSlider = document.getElementById('synceHoldoverSlider');
  const holdoverValPill = document.getElementById('synceHoldoverVal');
  const jitterSlider = document.getElementById('synceJitterSlider');
  const jitterValPill = document.getElementById('synceJitterVal');
  const resetBtn = document.getElementById('synceResetSimBtn');

  const chartWrap = document.getElementById('synceModalChartWrap');
  const tableBody = document.getElementById('synceNodesTableBody');
  const filterAreaBtn = document.getElementById('synceFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopySyncEReportBtn');

  function refreshModalView() {
    const syncData = calculateSyncEMetrics(state, {
      selectedNodeId: currentSelectedSyncNodeId,
      holdoverHours: currentHoldoverHours,
      jitterSurgeUs: currentJitterSurgeUs,
      gnssLossInjected: currentGnssLossInjected,
      ptpProfile: currentSelectedProfile
    });

    const { selectedNode } = syncData;

    // Update KPI summary cards
    const kpiNodeName = document.getElementById('synceKpiNodeName');
    const kpiPhaseError = document.getElementById('synceKpiPhaseError');
    const kpiJitter = document.getElementById('synceKpiJitter');
    const kpiStatusBadge = document.getElementById('synceStatusBadge');
    const kpiRevenueRisk = document.getElementById('synceKpiRevenueRisk');

    if (kpiNodeName) kpiNodeName.textContent = selectedNode.name.split(' ')[0] + ' ' + selectedNode.role.split(' ')[0];
    if (kpiPhaseError) {
      kpiPhaseError.textContent = `${selectedNode.effectivePhaseErrorNs > 0 ? '+' : ''}${selectedNode.effectivePhaseErrorNs} ns`;
      kpiPhaseError.style.color = selectedNode.absPhaseErrorNs > 100 ? '#ef4444' : '#10b981';
    }
    if (kpiJitter) {
      kpiJitter.textContent = `${selectedNode.effectiveJitterUs} µs`;
      kpiJitter.style.color = selectedNode.effectiveJitterUs > 1.5 ? '#f59e0b' : 'var(--ink, #182e2a)';
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = selectedNode.syncStateLabel;
      kpiStatusBadge.className = `sim-delta-badge ${selectedNode.badgeClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(selectedNode.atRiskRevenue)} at risk`;
    }

    // Update chart
    if (chartWrap) {
      chartWrap.innerHTML = renderSyncEClockSvg(syncData, { compact: false });
    }

    // Update table
    if (tableBody) {
      tableBody.innerHTML = syncData.nodes.map(node => {
        const isSel = node.id === currentSelectedSyncNodeId;
        const rowBg = isSel ? 'style="background-color: rgba(14, 91, 77, 0.08); font-weight: 600;"' : '';
        return `
          <tr ${rowBg} data-node-id="${node.id}">
            <td><strong>${node.name}</strong></td>
            <td><span class="badge-pill">${node.role}</span></td>
            <td>${node.effectiveSsm}</td>
            <td>${node.oscillatorType}</td>
            <td style="color: ${node.absPhaseErrorNs > 100 ? '#ef4444' : '#10b981'}; font-weight: 700;">
              ${node.effectivePhaseErrorNs > 0 ? '+' : ''}${node.effectivePhaseErrorNs} ns
            </td>
            <td>${node.effectiveJitterUs} µs</td>
            <td><span class="sim-delta-badge ${node.badgeClass}">${node.syncStateLabel}</span></td>
            <td>${formatPKR(node.atRiskRevenue)}</td>
            <td>
              <button class="secondary-button synce-select-row-btn" data-node-id="${node.id}" style="padding: 2px 8px; font-size: 11px;">
                ${isSel ? 'Active' : 'Select'}
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tableBody.querySelectorAll('.synce-select-row-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetId = e.currentTarget.getAttribute('data-node-id');
          if (targetId) {
            currentSelectedSyncNodeId = targetId;
            if (nodeSelect) nodeSelect.value = targetId;
            refreshModalView();
          }
        });
      });
    }
  }

  function createOpt(val, text) {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      return opt;
    }
    return { value: val, textContent: text };
  }

  // Populate dropdowns once
  if (nodeSelect && nodeSelect.options.length === 0) {
    SHAHDARA_SYNCE_NODES.forEach(n => {
      nodeSelect.appendChild(createOpt(n.id, `${n.role} - ${n.name}`));
    });
    nodeSelect.value = currentSelectedSyncNodeId;
  }

  if (gnssLossSelect && gnssLossSelect.options.length === 0) {
    gnssLossSelect.appendChild(createOpt('normal', 'Normal GNSS L1/L2 Lock (PRC)'));
    gnssLossSelect.appendChild(createOpt('lost', 'GNSS Signal Loss / Jamming (Holdover)'));
    gnssLossSelect.value = currentGnssLossInjected ? 'lost' : 'normal';
  }

  if (profileSelect && profileSelect.options.length === 0) {
    Object.entries(SYNCE_CONSTANTS.PTP_PROFILES).forEach(([key, label]) => {
      profileSelect.appendChild(createOpt(label, label));
    });
    profileSelect.value = currentSelectedProfile;
  }


  // Wire event handlers
  if (nodeSelect) {
    nodeSelect.addEventListener('change', () => {
      currentSelectedSyncNodeId = nodeSelect.value;
      refreshModalView();
    });
  }

  if (gnssLossSelect) {
    gnssLossSelect.addEventListener('change', () => {
      currentGnssLossInjected = (gnssLossSelect.value === 'lost');
      refreshModalView();
    });
  }

  if (profileSelect) {
    profileSelect.addEventListener('change', () => {
      currentSelectedProfile = profileSelect.value;
      refreshModalView();
    });
  }

  if (holdoverSlider && holdoverValPill) {
    holdoverSlider.addEventListener('input', () => {
      currentHoldoverHours = parseFloat(holdoverSlider.value) || 0.0;
      holdoverValPill.textContent = `${currentHoldoverHours.toFixed(1)} hrs`;
      refreshModalView();
    });
  }

  if (jitterSlider && jitterValPill) {
    jitterSlider.addEventListener('input', () => {
      currentJitterSurgeUs = parseFloat(jitterSlider.value) || 0.0;
      jitterValPill.textContent = `+${currentJitterSurgeUs.toFixed(1)} µs`;
      refreshModalView();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetSyncESimState();
      if (nodeSelect) nodeSelect.value = currentSelectedSyncNodeId;
      if (gnssLossSelect) gnssLossSelect.value = 'normal';
      if (profileSelect) profileSelect.value = currentSelectedProfile;
      if (holdoverSlider) holdoverSlider.value = '0.0';
      if (holdoverValPill) holdoverValPill.textContent = '0.0 hrs';
      if (jitterSlider) jitterSlider.value = '0.0';
      if (jitterValPill) jitterValPill.textContent = '+0.0 µs';
      refreshModalView();
      if (typeof onToast === 'function') onToast('Clock synchronization state reset to baseline.');
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const syncData = calculateSyncEMetrics(state, { selectedNodeId: currentSelectedSyncNodeId });
      if (syncData.selectedNode && typeof onFilterArea === 'function') {
        if (modal) {
          if (modal.close) modal.close();
          else modal.removeAttribute('open');
        }
        onFilterArea(syncData.selectedNode.primaryArea);
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', async () => {
      const syncData = calculateSyncEMetrics(state, {
        selectedNodeId: currentSelectedSyncNodeId,
        holdoverHours: currentHoldoverHours,
        jitterSurgeUs: currentJitterSurgeUs,
        gnssLossInjected: currentGnssLossInjected,
        ptpProfile: currentSelectedProfile
      });
      const report = generateSyncEReport(syncData);
      let copied = false;
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(report);
          copied = true;
        } catch {
          copied = false;
        }
      }
      if (typeof onToast === 'function') {
        onToast(copied ? 'SyncE audit report copied to clipboard!' : 'Report generated.');
      }

    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      refreshModalView();
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Initial render if card chart is present
  const cardChartEl = document.getElementById('dashboardSyncEChart');
  if (cardChartEl) {
    const syncData = calculateSyncEMetrics(state, { referenceDate });
    cardChartEl.innerHTML = renderSyncEClockSvg(syncData, { compact: true });
  }
}
