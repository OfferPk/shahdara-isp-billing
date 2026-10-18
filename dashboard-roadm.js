import { formatPKR } from './core.js';

/**
 * Reconfigurable Optical Add-Drop Multiplexer (ROADM)
 * Flex-Grid Wavelength Selective Switch (WSS / ITU-T G.694.1)
 * Dynamic Rerouting & Express Bypass Matrix
 *
 * Models Colorless, Directionless, Contentionless (CDC) ROADM architecture with
 * Liquid Crystal on Silicon (LCoS) 1x9 and 1x20 Flex-Grid WSS units across Shahdara ISP
 * optical fiber distribution rings and metro core nodes.
 *
 * Evaluates local optical Add/Drop vs Express optical bypass (sub-microsecond all-optical latency,
 * eliminating O-E-O conversion queuing), dynamic optical protection switching (<50ms optical restoration
 * during fiber span breaks), VOA (Variable Optical Attenuation) power balancing, and correlates
 * wavelength traffic integrity with Shahdara subscriber revenue exposure.
 */

export const ROADM_CONSTANTS = {
  GRID_GRANULARITY_GHZ: 6.25,
  DEFAULT_SLOT_WIDTH_GHZ: 50.0,
  SWITCHING_MODES: {
    AUTOMATIC_PROTECTION: 'Automatic WSS Optical Protection Switching (<50ms)',
    MANUAL_OVERRIDE: 'Manual Wavelength Add/Drop Override',
    MAINTENANCE_LOOPBACK: 'Maintenance Loopback to Optical Spectrum Analyzer'
  },
  FIBER_SPAN_CONDITIONS: {
    NORMAL: 'Normal All-Optical Dual-Ring Routing',
    EAST_SPAN_CUT: 'East Fiber Ring Span Severed (WSS Rerouting West)',
    WEST_SPAN_CUT: 'West Fiber Ring Span Severed (WSS Rerouting East)'
  },
  MIN_VOA_ATTENUATION_DB: 0.0,
  MAX_VOA_ATTENUATION_DB: 15.0,
  BASE_EXPRESS_LOSS_DB: 2.8,
  BASE_ADD_DROP_LOSS_DB: 6.5,
  MIN_ACCEPTABLE_OSNR_DB: 18.0
};

export const SHAHDARA_ROADM_NODES = [
  {
    id: 'roadm-node-central',
    name: 'ROADM-01 Shahdara Central Core Exchange',
    role: 'Degree-4 CDC Core Hub',
    degrees: 4,
    wssType: '1x20 Flex-Grid Twin-WSS (LCoS)',
    location: 'Central Optical Distribution Facility',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    addDropPorts: 32,
    expressPorts: 16,
    transponderCapacityTbps: 3.2,
    switchingLatencyMs: 38
  },
  {
    id: 'roadm-node-baradari',
    name: 'ROADM-02 Baradari Industrial Optical Sub-Hub',
    role: 'Degree-2 Optical Feeder',
    degrees: 2,
    wssType: '1x9 Flex-Grid WSS',
    location: 'Baradari Road Fiber Distribution Center',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    addDropPorts: 16,
    expressPorts: 8,
    transponderCapacityTbps: 1.6,
    switchingLatencyMs: 44
  },
  {
    id: 'roadm-node-vandala',
    name: 'ROADM-03 Vandala Road Core Hub',
    role: 'Degree-2 Core Ring Node',
    degrees: 2,
    wssType: '1x9 Flex-Grid WSS',
    location: 'Vandala Road OLT Node Facility',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    addDropPorts: 16,
    expressPorts: 8,
    transponderCapacityTbps: 1.6,
    switchingLatencyMs: 42
  },
  {
    id: 'roadm-node-jiamusa',
    name: 'ROADM-04 Jia Musa Access Node',
    role: 'Degree-2 Metro Distribution',
    degrees: 2,
    wssType: '1x9 Flex-Grid WSS',
    location: 'Jia Musa Main POP',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    addDropPorts: 8,
    expressPorts: 8,
    transponderCapacityTbps: 0.8,
    switchingLatencyMs: 46
  },
  {
    id: 'roadm-node-begumkot',
    name: 'ROADM-05 Begum Kot Perimeter Optical Ring',
    role: 'Degree-2 Outer Perimeter Node',
    degrees: 2,
    wssType: '1x9 Flex-Grid WSS',
    location: 'Begum Kot Outlying Sub-POP',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Sheikhupura Road', 'Kot Begum'],
    addDropPorts: 8,
    expressPorts: 8,
    transponderCapacityTbps: 0.8,
    switchingLatencyMs: 48
  }
];

export const SHAHDARA_WAVELENGTH_CHANNELS = [
  {
    id: 'ch-1-core-transit',
    channelNumber: 1,
    name: 'Ch 01 - 193.100 THz (1552.52nm)',
    frequencyTHz: 193.100,
    wavelengthNm: 1552.52,
    bandwidthGhz: 50.0,
    serviceName: '100GbE DP-QPSK Core Transit Trunk',
    modulation: 'DP-QPSK',
    defaultPathType: 'EXPRESS_BYPASS',
    baseOpticalPowerDbm: 1.5,
    snrMarginDb: 6.8
  },
  {
    id: 'ch-2-upstream-peer',
    channelNumber: 2,
    name: 'Ch 02 - 193.200 THz (1551.72nm)',
    frequencyTHz: 193.200,
    wavelengthNm: 1551.72,
    bandwidthGhz: 50.0,
    serviceName: '100GbE 16-QAM Upstream Carrier Peering',
    modulation: '16-QAM',
    defaultPathType: 'ADD_DROP',
    baseOpticalPowerDbm: 2.0,
    snrMarginDb: 5.4
  },
  {
    id: 'ch-3-gpon-agg',
    channelNumber: 3,
    name: 'Ch 03 - 193.300 THz (1550.92nm)',
    frequencyTHz: 193.300,
    wavelengthNm: 1550.92,
    bandwidthGhz: 50.0,
    serviceName: '40GbE GPON Aggregation Feeder',
    modulation: 'QPSK',
    defaultPathType: 'EXPRESS_BYPASS',
    baseOpticalPowerDbm: 0.8,
    snrMarginDb: 7.2
  },
  {
    id: 'ch-4-iptv-video',
    channelNumber: 4,
    name: 'Ch 04 - 193.400 THz (1550.12nm)',
    frequencyTHz: 193.400,
    wavelengthNm: 1550.12,
    bandwidthGhz: 50.0,
    serviceName: '10GbE IPTV Multicast Video Stream Trunk',
    modulation: 'NRZ-OOK',
    defaultPathType: 'EXPRESS_BYPASS',
    baseOpticalPowerDbm: -0.5,
    snrMarginDb: 8.5
  },
  {
    id: 'ch-5-dia-leased',
    channelNumber: 5,
    name: 'Ch 05 - 193.500 THz (1549.32nm)',
    frequencyTHz: 193.500,
    wavelengthNm: 1549.32,
    bandwidthGhz: 25.0,
    serviceName: '10GbE Enterprise Leased DIA Circuit',
    modulation: 'NRZ-OOK',
    defaultPathType: 'ADD_DROP',
    baseOpticalPowerDbm: -1.2,
    snrMarginDb: 4.8
  },
  {
    id: 'ch-6-voip-voice',
    channelNumber: 6,
    name: 'Ch 06 - 193.600 THz (1548.51nm)',
    frequencyTHz: 193.600,
    wavelengthNm: 1548.51,
    bandwidthGhz: 25.0,
    serviceName: '10GbE SIP VoIP Voice Gateway Backhaul',
    modulation: 'NRZ-OOK',
    defaultPathType: 'ADD_DROP',
    baseOpticalPowerDbm: -1.8,
    snrMarginDb: 5.1
  }
];

// Interactive simulation state
let currentSelectedRoadmNodeId = 'roadm-node-central';
let currentSelectedChannelId = 'ch-1-core-transit';
let currentSpanCondition = ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.NORMAL;
let currentSwitchingMode = ROADM_CONSTANTS.SWITCHING_MODES.AUTOMATIC_PROTECTION;
let currentVoaAttenuationDb = 2.0;

export function getRoadmSelectedNode() {
  return currentSelectedRoadmNodeId;
}

export function setRoadmSelectedNode(id) {
  if (SHAHDARA_ROADM_NODES.some(n => n.id === id)) {
    currentSelectedRoadmNodeId = id;
  }
}

export function getRoadmSelectedChannel() {
  return currentSelectedChannelId;
}

export function setRoadmSelectedChannel(id) {
  if (SHAHDARA_WAVELENGTH_CHANNELS.some(c => c.id === id)) {
    currentSelectedChannelId = id;
  }
}

export function getRoadmSpanCondition() {
  return currentSpanCondition;
}

export function setRoadmSpanCondition(cond) {
  if (Object.values(ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS).includes(cond)) {
    currentSpanCondition = cond;
  }
}

export function getRoadmSwitchingMode() {
  return currentSwitchingMode;
}

export function setRoadmSwitchingMode(mode) {
  if (Object.values(ROADM_CONSTANTS.SWITCHING_MODES).includes(mode)) {
    currentSwitchingMode = mode;
  }
}

export function getRoadmVoaAttenuationDb() {
  return currentVoaAttenuationDb;
}

export function setRoadmVoaAttenuationDb(val) {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    currentVoaAttenuationDb = Math.max(0.0, Math.min(15.0, val));
  }
}

export function resetRoadmSimState() {
  currentSelectedRoadmNodeId = 'roadm-node-central';
  currentSelectedChannelId = 'ch-1-core-transit';
  currentSpanCondition = ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.NORMAL;
  currentSwitchingMode = ROADM_CONSTANTS.SWITCHING_MODES.AUTOMATIC_PROTECTION;
  currentVoaAttenuationDb = 2.0;
}

/**
 * Calculates optical insertion loss and power budget for a wavelength channel through a ROADM node
 */
export function calculateChannelOpticalLoss(channel, node, overrides = {}) {
  const spanCondition = overrides.spanCondition ?? currentSpanCondition;
  const switchingMode = overrides.switchingMode ?? currentSwitchingMode;
  const voaDb = overrides.voaAttenuationDb ?? currentVoaAttenuationDb;

  let activePathType = channel.defaultPathType;
  let rerouted = false;
  let opticalLossDb = 0.0;
  let protectionLatencyMs = 0;

  // Evaluate optical path and rerouting behavior
  if (switchingMode === ROADM_CONSTANTS.SWITCHING_MODES.MAINTENANCE_LOOPBACK) {
    activePathType = 'LOOPBACK_OSA';
    opticalLossDb = ROADM_CONSTANTS.BASE_EXPRESS_LOSS_DB + 3.5 + voaDb;
  } else if (switchingMode === ROADM_CONSTANTS.SWITCHING_MODES.MANUAL_OVERRIDE) {
    activePathType = 'LOCAL_ADD_DROP';
    opticalLossDb = ROADM_CONSTANTS.BASE_ADD_DROP_LOSS_DB + voaDb;
  } else {
    // AUTOMATIC PROTECTION
    if (spanCondition === ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.EAST_SPAN_CUT) {
      activePathType = 'PROTECTION_WEST_REROUTE';
      rerouted = true;
      opticalLossDb = ROADM_CONSTANTS.BASE_EXPRESS_LOSS_DB + 1.8 + voaDb;
      protectionLatencyMs = node.switchingLatencyMs;
    } else if (spanCondition === ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.WEST_SPAN_CUT) {
      activePathType = 'PROTECTION_EAST_REROUTE';
      rerouted = true;
      opticalLossDb = ROADM_CONSTANTS.BASE_EXPRESS_LOSS_DB + 2.1 + voaDb;
      protectionLatencyMs = node.switchingLatencyMs;
    } else {
      activePathType = channel.defaultPathType;
      opticalLossDb = (channel.defaultPathType === 'EXPRESS_BYPASS' ? ROADM_CONSTANTS.BASE_EXPRESS_LOSS_DB : ROADM_CONSTANTS.BASE_ADD_DROP_LOSS_DB) + voaDb;
    }
  }

  const effectiveOutputPowerDbm = Number((channel.baseOpticalPowerDbm - opticalLossDb).toFixed(2));
  const effectiveOsnrDb = Number((channel.snrMarginDb + 16.5 - (opticalLossDb * 0.4)).toFixed(2));

  // Determine channel operational health
  let pathStatus = 'OPTIMAL';
  let badgeClass = 'badge-success';
  let statusLabel = 'ACTIVE EXPRESS';

  if (activePathType === 'LOOPBACK_OSA') {
    pathStatus = 'MAINTENANCE';
    badgeClass = 'badge-warning';
    statusLabel = 'OSA LOOPBACK';
  } else if (rerouted) {
    pathStatus = 'PROTECTED';
    badgeClass = 'badge-warning';
    statusLabel = `REROUTED (${protectionLatencyMs}ms)`;
  } else if (channel.defaultPathType === 'ADD_DROP') {
    pathStatus = 'ADD_DROP';
    badgeClass = 'badge-success';
    statusLabel = 'LOCAL ADD/DROP';
  }

  if (effectiveOsnrDb < ROADM_CONSTANTS.MIN_ACCEPTABLE_OSNR_DB) {
    pathStatus = 'DEGRADED';
    badgeClass = 'badge-danger';
    statusLabel = 'LOW OSNR / ATTENUATION';
  }

  return {
    ...channel,
    activePathType,
    rerouted,
    opticalLossDb: Number(opticalLossDb.toFixed(2)),
    voaDb: Number(voaDb.toFixed(1)),
    effectiveOutputPowerDbm,
    effectiveOsnrDb,
    protectionLatencyMs,
    pathStatus,
    badgeClass,
    statusLabel
  };
}

/**
 * Calculates aggregate ROADM matrix and subscriber revenue correlations
 */
export function calculateRoadmMetrics(state, options = {}) {
  const selectedNodeId = options.selectedNodeId || currentSelectedRoadmNodeId;
  const selectedChannelId = options.selectedChannelId || currentSelectedChannelId;
  const spanCondition = options.spanCondition ?? currentSpanCondition;
  const switchingMode = options.switchingMode ?? currentSwitchingMode;
  const voaAttenuationDb = options.voaAttenuationDb ?? currentVoaAttenuationDb;

  const customers = (state && Array.isArray(state.customers)) ? state.customers : [];

  const selectedNode = SHAHDARA_ROADM_NODES.find(n => n.id === selectedNodeId) || SHAHDARA_ROADM_NODES[0];

  // Calculate channel metrics across all channels for the active node
  const channels = SHAHDARA_WAVELENGTH_CHANNELS.map(ch => {
    return calculateChannelOpticalLoss(ch, selectedNode, {
      spanCondition,
      switchingMode,
      voaAttenuationDb: ch.id === selectedChannelId ? voaAttenuationDb : 2.0
    });
  });

  const selectedChannel = channels.find(c => c.id === selectedChannelId) || channels[0];

  // Correlate with subscribers
  const matchedCustomers = customers.filter(c => {
    if (c.archived) return false;
    const area = (c.area || '').trim().toLowerCase();
    return selectedNode.aliasAreas.some(alias => alias.toLowerCase() === area || area.includes(alias.toLowerCase()));
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

  // Revenue exposure if optical span is broken or OSNR is degraded
  let atRiskRevenue = 0;
  if (selectedChannel.pathStatus === 'DEGRADED') {
    atRiskRevenue = Math.round(totalDue * 0.85 + activeCount * 120);
  } else if (selectedChannel.rerouted) {
    // Transient protection switching exposure (minimal)
    atRiskRevenue = Math.round(activeCount * 25);
  }

  const expressChannelsCount = channels.filter(c => c.activePathType.includes('EXPRESS') || c.activePathType.includes('PROTECTION')).length;
  const addDropChannelsCount = channels.filter(c => c.activePathType.includes('ADD_DROP')).length;

  let opticalFleetStatus = 'OPTIMAL DUAL-RING';
  let fleetBadgeClass = 'badge-success';

  if (spanCondition !== ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS.NORMAL) {
    opticalFleetStatus = 'WSS PROTECTION ENGAGED';
    fleetBadgeClass = 'badge-warning';
  } else if (switchingMode === ROADM_CONSTANTS.SWITCHING_MODES.MAINTENANCE_LOOPBACK) {
    opticalFleetStatus = 'MAINTENANCE MODE';
    fleetBadgeClass = 'badge-warning';
  }

  return {
    nodes: SHAHDARA_ROADM_NODES,
    selectedNode,
    channels,
    selectedChannel,
    spanCondition,
    switchingMode,
    voaAttenuationDb,
    matchedCustomersCount: matchedCustomers.length,
    activeCount,
    offlineCount,
    totalDue,
    atRiskRevenue,
    expressChannelsCount,
    addDropChannelsCount,
    opticalFleetStatus,
    fleetBadgeClass
  };
}

/**
 * Pure offline SVG rendering for ROADM Flex-Grid WSS Dynamic Rerouting
 */
export function renderRoadmOpticalSvg(roadmData, { compact = false, width = 560, height = 280 } = {}) {
  if (!roadmData || !roadmData.selectedNode || !roadmData.selectedChannel) {
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="ROADM Optical Bypass: No data">
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="12" fill="var(--muted, #71817c)">No optical ROADM telemetry recorded</text>
    </svg>`;
  }

  const { selectedNode, selectedChannel, opticalFleetStatus, fleetBadgeClass } = roadmData;

  if (compact) {
    // Compact card widget: Semicircular Optical Power Gauge & Spectrum Bar
    const cWidth = 480;
    const cHeight = 210;
    const cx = cWidth / 2 - 80;
    const cy = 135;
    const radius = 68;

    // Optical Output Power (-15 dBm to +5 dBm scale)
    const minPowerDbm = -15.0;
    const maxPowerDbm = 5.0;
    const powerRange = maxPowerDbm - minPowerDbm;
    const clampedPower = Math.max(minPowerDbm, Math.min(maxPowerDbm, selectedChannel.effectiveOutputPowerDbm));
    const powerFraction = (clampedPower - minPowerDbm) / powerRange; // 0 to 1
    const angleRad = (powerFraction - 0.5) * Math.PI; // -PI/2 to +PI/2
    const needleX = cx + radius * Math.sin(angleRad);
    const needleY = cy - radius * Math.cos(angleRad);

    const needleColor = selectedChannel.effectiveOsnrDb < ROADM_CONSTANTS.MIN_ACCEPTABLE_OSNR_DB
      ? '#ef4444'
      : (selectedChannel.rerouted ? '#f59e0b' : '#10b981');

    return `<svg class="chart-svg roadm-compact-svg" viewBox="0 0 ${cWidth} ${cHeight}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="ROADM Optical Power Dial: ${selectedChannel.name}, ${selectedChannel.effectiveOutputPowerDbm} dBm, OSNR ${selectedChannel.effectiveOsnrDb} dB">
      <!-- Gauge Track Arc -->
      <path d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}" fill="none" stroke="var(--line, #e2ece7)" stroke-width="12" stroke-linecap="round"/>
      
      <!-- Safe Operating Track (-8 dBm to +3 dBm) -->
      <path d="M ${cx - radius * 0.707} ${cy - radius * 0.707} A ${radius} ${radius} 0 0 1 ${cx + radius * 0.707} ${cy - radius * 0.707}" fill="none" stroke="#10b981" stroke-width="12" opacity="0.35"/>

      <!-- Needle -->
      <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="${needleColor}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="var(--ink, #182e2a)"/>
      <circle cx="${cx}" cy="${cy}" r="3" fill="#ffffff"/>

      <!-- Gauge Scale Labels -->
      <text x="${cx - radius - 2}" y="${cy + 16}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">-15dBm</text>
      <text x="${cx}" y="${cy - radius - 8}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#10b981">-5 dBm (Opt)</text>
      <text x="${cx + radius + 4}" y="${cy + 16}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" fill="var(--muted, #71817c)">+5dBm</text>

      <!-- Center Digital Readout -->
      <text x="${cx}" y="${cy + 24}" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="16" font-weight="800" fill="${needleColor}">
        ${selectedChannel.effectiveOutputPowerDbm > 0 ? '+' : ''}${selectedChannel.effectiveOutputPowerDbm} dBm
      </text>
      <text x="${cx}" y="${cy + 38}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" fill="var(--muted, #71817c)">
        ${selectedChannel.statusLabel}
      </text>

      <!-- Right Side KPI Cards -->
      <g transform="translate(${cWidth - 180}, 20)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">WSS OPTICAL OSNR</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="#0284c7">${selectedChannel.effectiveOsnrDb} dB <tspan font-size="9" font-weight="500" fill="var(--muted, #71817c)">(spec ≥18dB)</tspan></text>
      </g>

      <g transform="translate(${cWidth - 180}, 70)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">VOA ATTENUATION</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="var(--ink, #182e2a)">${selectedChannel.voaDb} dB (Trimmed)</text>
      </g>

      <g transform="translate(${cWidth - 180}, 120)">
        <rect width="165" height="42" rx="6" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>
        <text x="12" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="600" fill="var(--muted, #71817c)">RING ROUTING STATE</text>
        <text x="12" y="34" font-family="Manrope, system-ui, sans-serif" font-size="12" font-weight="800" fill="${selectedChannel.rerouted ? '#f59e0b' : '#10b981'}">${selectedChannel.pathStatus}</text>
      </g>

      <!-- Bottom node badge -->
      <text x="${cWidth / 2}" y="${cHeight - 8}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="10" fill="var(--muted, #71817c)">
        Node: <tspan font-weight="700" fill="var(--ink, #182e2a)">${selectedNode.name}</tspan> · ${selectedChannel.name}
      </text>
    </svg>`;
  }

  // Full detailed WSS Add/Drop / Express Bypass block diagram and Optical Spectrum Analyzer (OSA) plot
  const svgW = 760;
  const svgH = 340;

  // Upper section: Flex-Grid WSS Block Diagram
  // Box for WSS Switching Core
  const wssBoxX = 270;
  const wssBoxY = 24;
  const wssBoxW = 220;
  const wssBoxH = 80;

  let opticalPathsSvg = '';
  // East Optical Fiber In/Out (Left)
  opticalPathsSvg += `<line x1="120" y1="50" x2="270" y2="50" stroke="#0284c7" stroke-width="3"/>`;
  opticalPathsSvg += `<polygon points="270,50 262,46 262,54" fill="#0284c7"/>`;
  opticalPathsSvg += `<text x="130" y="44" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#0284c7">East Ingress Fiber</text>`;

  // West Optical Fiber In/Out (Right)
  opticalPathsSvg += `<line x1="490" y1="50" x2="640" y2="50" stroke="#0284c7" stroke-width="3"/>`;
  opticalPathsSvg += `<polygon points="640,50 632,46 632,54" fill="#0284c7"/>`;
  opticalPathsSvg += `<text x="500" y="44" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#0284c7">West Egress Fiber</text>`;

  // Local Add / Drop Transponder Ports (Bottom of WSS box)
  opticalPathsSvg += `<line x1="330" y1="104" x2="330" y2="128" stroke="#10b981" stroke-width="2.5" stroke-dasharray="3,3"/>`;
  opticalPathsSvg += `<polygon points="330,104 326,112 334,112" fill="#10b981"/>`;
  opticalPathsSvg += `<text x="310" y="125" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#10b981">Local Add</text>`;

  opticalPathsSvg += `<line x1="430" y1="104" x2="430" y2="128" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="3,3"/>`;
  opticalPathsSvg += `<polygon points="430,128 426,120 434,120" fill="#f59e0b"/>`;
  opticalPathsSvg += `<text x="440" y="125" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#f59e0b">Local Drop</text>`;

  // Inside WSS Box: LCoS Switching Elements and Express Bypass Path
  let wssInternalSvg = '';
  if (selectedChannel.activePathType.includes('EXPRESS') || selectedChannel.activePathType.includes('PROTECTION')) {
    // Direct all-optical express beam across WSS
    const pathColor = selectedChannel.rerouted ? '#f59e0b' : '#0284c7';
    wssInternalSvg += `<line x1="${wssBoxX + 10}" y1="50" x2="${wssBoxX + wssBoxW - 10}" y2="50" stroke="${pathColor}" stroke-width="3.5" stroke-dasharray="${selectedChannel.rerouted ? '4,2' : 'none'}"/>`;
    wssInternalSvg += `<text x="${wssBoxX + wssBoxW / 2}" y="42" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="800" fill="${pathColor}">ALL-OPTICAL EXPRESS BYPASS (&lt;1µs)</text>`;
  } else if (selectedChannel.activePathType.includes('ADD_DROP')) {
    // Add/Drop diversion path
    wssInternalSvg += `<path d="M ${wssBoxX + 10} 50 Q ${wssBoxX + 70} 50, ${wssBoxX + 60} 70 L 330 104" fill="none" stroke="#10b981" stroke-width="3"/>`;
    wssInternalSvg += `<path d="M 430 104 L 430 70 Q 430 50, ${wssBoxX + wssBoxW - 10} 50" fill="none" stroke="#f59e0b" stroke-width="3"/>`;
    wssInternalSvg += `<text x="${wssBoxX + wssBoxW / 2}" y="42" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="800" fill="#10b981">LOCAL CLIENT ADD/DROP</text>`;
  } else {
    // OSA Loopback
    wssInternalSvg += `<path d="M ${wssBoxX + 10} 50 Q ${wssBoxX + wssBoxW / 2} 20, ${wssBoxX + wssBoxW - 10} 50" fill="none" stroke="#8b5cf6" stroke-width="3"/>`;
    wssInternalSvg += `<text x="${wssBoxX + wssBoxW / 2}" y="42" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="800" fill="#8b5cf6">OSA SPECTRUM LOOPBACK</text>`;
  }

  // Lower Section: Optical Spectrum Analyzer (OSA) Channel Passband Profile
  const osaX = 70;
  const osaY = 160;
  const osaW = 620;
  const osaH = 140;

  // Render optical channel spectrum bars (Ch 1 to Ch 6)
  let channelsSvg = '';
  const channelWidth = 80;
  const channelGap = 16;
  const startChX = osaX + 24;

  roadmData.channels.forEach((ch, idx) => {
    const cx = startChX + idx * (channelWidth + channelGap);
    const isSelected = ch.id === selectedChannel.id;
    const barHeight = Math.max(20, Math.min(osaH - 30, (ch.effectiveOutputPowerDbm + 18.0) * 5.2));
    const cy = osaY + osaH - barHeight;
    const barColor = isSelected ? (ch.effectiveOsnrDb < 18 ? '#ef4444' : '#0e5b4d') : '#0284c7';
    const barOpacity = isSelected ? 0.95 : 0.65;

    channelsSvg += `
      <g class="roadm-ch-bar" style="cursor: pointer;">
        <!-- Filter Passband Shape -->
        <rect x="${cx}" y="${cy}" width="${channelWidth}" height="${barHeight}" rx="4" fill="${barColor}" opacity="${barOpacity}">
          <title>${ch.name}: ${ch.serviceName} | Loss: ${ch.opticalLossDb}dB | OSNR: ${ch.effectiveOsnrDb}dB</title>
        </rect>
        <text x="${cx + channelWidth / 2}" y="${cy - 6}" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="9" font-weight="700" fill="var(--ink, #182e2a)">
          ${ch.effectiveOutputPowerDbm > 0 ? '+' : ''}${ch.effectiveOutputPowerDbm}dBm
        </text>
        <text x="${cx + channelWidth / 2}" y="${osaY + osaH + 16}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="${isSelected ? '700' : '500'}" fill="${isSelected ? 'var(--ink, #182e2a)' : 'var(--muted, #71817c)'}">
          ${ch.name.split(' - ')[0]}
        </text>
        <text x="${cx + channelWidth / 2}" y="${osaY + osaH + 28}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" fill="var(--muted, #71817c)">
          ${ch.bandwidthGhz}GHz
        </text>
      </g>
    `;
  });

  return `<svg class="chart-svg roadm-modal-svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" style="height: auto; max-width: 100%; display: block;" role="img" aria-label="ROADM Flex-Grid WSS Switching Architecture and Optical Spectrum Plot">
    <!-- Header Labels -->
    <text x="70" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--muted, #71817c)">
      LCOS FLEX-GRID WAVELENGTH SELECTIVE SWITCH (ITU-T G.694.1 ROADM ARCHITECTURE)
    </text>

    <!-- WSS Switching Core Box -->
    <rect x="${wssBoxX}" y="${wssBoxY}" width="${wssBoxW}" height="${wssBoxH}" rx="8" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="2"/>
    <text x="${wssBoxX + wssBoxW / 2}" y="95" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="var(--muted, #71817c)">
      ${selectedNode.wssType} (LCoS Matrix)
    </text>

    <!-- Optical Paths and Internal Beams -->
    ${opticalPathsSvg}
    ${wssInternalSvg}

    <!-- Lower Section: Optical Spectrum Analyzer Background -->
    <text x="70" y="150" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="var(--muted, #71817c)">
      OPTICAL SPECTRUM ANALYZER (OSA) — C-BAND FLEX-GRID CHANNEL PASSBAND PROFILES
    </text>
    <rect x="${osaX}" y="${osaY}" width="${osaW}" height="${osaH}" rx="4" fill="var(--surface-sunken, #f0f5f2)" stroke="var(--line, #e2ece7)" stroke-width="1"/>

    <!-- Spectrum Grid Lines -->
    <line x1="${osaX}" y1="${osaY + osaH * 0.25}" x2="${osaX + osaW}" y2="${osaY + osaH * 0.25}" stroke="var(--line, #e2ece7)" stroke-dasharray="3,3"/>
    <line x1="${osaX}" y1="${osaY + osaH * 0.5}" x2="${osaX + osaW}" y2="${osaY + osaH * 0.5}" stroke="var(--line, #e2ece7)" stroke-dasharray="3,3"/>
    <line x1="${osaX}" y1="${osaY + osaH * 0.75}" x2="${osaX + osaW}" y2="${osaY + osaH * 0.75}" stroke="var(--line, #e2ece7)" stroke-dasharray="3,3"/>

    <!-- Spectrum Channels -->
    ${channelsSvg}
  </svg>`;
}

/**
 * Generates an executive briefing report for ROADM Flex-Grid WSS performance
 */
export function generateRoadmReport(roadmData) {
  if (!roadmData || !roadmData.selectedNode || !roadmData.selectedChannel) {
    return 'No ROADM telemetry available.';
  }

  const { selectedNode, selectedChannel, channels, spanCondition, switchingMode, atRiskRevenue } = roadmData;

  const lines = [
    '====================================================================',
    '📡 SHAHDARA ISP — ROADM FLEX-GRID WSS OPTICAL ROUTING AUDIT BRIEFING',
    `Report Time: ${new Date().toISOString()} PKT`,
    'Architecture: Colorless, Directionless, Contentionless (CDC) Flex-Grid WSS',
    '====================================================================',
    '',
    `[ AUDITED ROADM NODE ]`,
    `• Node: ${selectedNode.name}`,
    `• Architecture Role: ${selectedNode.role}`,
    `• Location: ${selectedNode.location}`,
    `• Switch Hardware: ${selectedNode.wssType}`,
    `• Nodal Degrees: ${selectedNode.degrees} Optical Ring Degrees`,
    `• Transponder Capacity: ${selectedNode.transponderCapacityTbps} Tbps Optical Fabric`,
    `• Switching Latency: ${selectedNode.switchingLatencyMs} ms Protection Restoration`,
    `• Span Health Condition: ${spanCondition}`,
    `• WSS Switching Mode: ${switchingMode}`,
    '',
    `[ ACTIVE WAVELENGTH CARRIER: ${selectedChannel.name} ]`,
    `• Service: ${selectedChannel.serviceName}`,
    `• Frequency: ${selectedChannel.frequencyTHz} THz (${selectedChannel.wavelengthNm} nm)`,
    `• Channel Slot Width: ${selectedChannel.bandwidthGhz} GHz Flex-Grid Slot`,
    `• Modulation: ${selectedChannel.modulation}`,
    `• Optical Path: ${selectedChannel.statusLabel} (${selectedChannel.activePathType})`,
    `• Output Power: ${selectedChannel.effectiveOutputPowerDbm > 0 ? '+' : ''}${selectedChannel.effectiveOutputPowerDbm} dBm`,
    `• Total Insertion Loss: ${selectedChannel.opticalLossDb} dB (VOA: ${selectedChannel.voaDb} dB)`,
    `• Optical OSNR: ${selectedChannel.effectiveOsnrDb} dB (Target: ≥18.0 dB)`,
    `• Optical Protection Reroute: ${selectedChannel.rerouted ? `Engaged (${selectedChannel.protectionLatencyMs}ms restoration)` : 'Nominal Dual-Ring Path'}`,
    '',
    `[ C-BAND FLEX-GRID CHANNEL REGISTER ]`
  ];

  channels.forEach(ch => {
    lines.push(
      `• [Ch 0${ch.channelNumber}] ${ch.frequencyTHz}THz | ${ch.serviceName} | Path: ${ch.statusLabel} | Pwr: ${ch.effectiveOutputPowerDbm}dBm | OSNR: ${ch.effectiveOsnrDb}dB`
    );
  });

  lines.push(
    '',
    `[ SUBSCRIBER IMPACT & FINANCIAL RISK ]`,
    `• Linked Subscribers: ${roadmData.matchedCustomersCount} (${roadmData.activeCount} active)`,
    `• Active Optical Express Channels: ${roadmData.expressChannelsCount} | Add/Drop: ${roadmData.addDropChannelsCount}`,
    `• Revenue Exposure: ${formatPKR(atRiskRevenue)}`,
    '====================================================================',
    'Shahdara ISP Optical Transport Infrastructure & Dynamic WSS Switching'
  );

  return lines.join('\n');
}

/**
 * Wires the interactive ROADM Flex-Grid WSS modal dialog
 */
export function setupRoadmModal(state, { referenceDate = new Date(), onFilterArea, onFilterCustomer, onToast, clipboard } = {}) {
  const modal = document.getElementById('dashboardRoadmModal');
  const openBtn = document.getElementById('dashboardOpenRoadmModalBtn');
  const closeBtn = document.getElementById('dashboardRoadmModalCloseBtn');

  const nodeSelect = document.getElementById('roadmNodeSelect');
  const channelSelect = document.getElementById('roadmChannelSelect');
  const spanSelect = document.getElementById('roadmSpanSelect');
  const modeSelect = document.getElementById('roadmModeSelect');
  const voaSlider = document.getElementById('roadmVoaSlider');
  const voaValPill = document.getElementById('roadmVoaVal');
  const resetBtn = document.getElementById('roadmResetSimBtn');

  const chartWrap = document.getElementById('roadmModalChartWrap');
  const tableBody = document.getElementById('roadmChannelsTableBody');
  const filterAreaBtn = document.getElementById('roadmFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyRoadmReportBtn');

  function refreshModalView() {
    const roadmData = calculateRoadmMetrics(state, {
      selectedNodeId: currentSelectedRoadmNodeId,
      selectedChannelId: currentSelectedChannelId,
      spanCondition: currentSpanCondition,
      switchingMode: currentSwitchingMode,
      voaAttenuationDb: currentVoaAttenuationDb
    });

    const { selectedNode, selectedChannel } = roadmData;

    // Update KPI cards
    const kpiNodeName = document.getElementById('roadmKpiNodeName');
    const kpiOutputPower = document.getElementById('roadmKpiOutputPower');
    const kpiOsnr = document.getElementById('roadmKpiOsnr');
    const kpiStatusBadge = document.getElementById('roadmStatusBadge');
    const kpiRevenueRisk = document.getElementById('roadmKpiRevenueRisk');

    if (kpiNodeName) kpiNodeName.textContent = selectedNode.name.split(' ')[0] + ' ' + selectedNode.role.split(' ')[0];
    if (kpiOutputPower) {
      kpiOutputPower.textContent = `${selectedChannel.effectiveOutputPowerDbm > 0 ? '+' : ''}${selectedChannel.effectiveOutputPowerDbm} dBm`;
      kpiOutputPower.style.color = selectedChannel.effectiveOutputPowerDbm < -10 ? '#ef4444' : '#10b981';
    }
    if (kpiOsnr) {
      kpiOsnr.textContent = `${selectedChannel.effectiveOsnrDb} dB`;
      kpiOsnr.style.color = selectedChannel.effectiveOsnrDb < 18 ? '#ef4444' : '#0284c7';
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = selectedChannel.statusLabel;
      kpiStatusBadge.className = `sim-delta-badge ${selectedChannel.badgeClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(roadmData.atRiskRevenue)} at risk`;
    }

    // Update SVG
    if (chartWrap) {
      chartWrap.innerHTML = renderRoadmOpticalSvg(roadmData, { compact: false });
    }

    // Update Table
    if (tableBody) {
      tableBody.innerHTML = roadmData.channels.map(ch => {
        const isSel = ch.id === currentSelectedChannelId;
        const rowBg = isSel ? 'style="background-color: rgba(14, 91, 77, 0.08); font-weight: 600;"' : '';
        return `
          <tr ${rowBg} data-ch-id="${ch.id}">
            <td><strong>${ch.name.split(' - ')[0]}</strong></td>
            <td>${ch.frequencyTHz} THz (${ch.wavelengthNm}nm)</td>
            <td>${ch.serviceName}</td>
            <td><span class="badge-pill">${ch.bandwidthGhz} GHz</span></td>
            <td style="color: ${ch.effectiveOutputPowerDbm < -10 ? '#ef4444' : '#10b981'}; font-weight: 700;">
              ${ch.effectiveOutputPowerDbm > 0 ? '+' : ''}${ch.effectiveOutputPowerDbm} dBm
            </td>
            <td>${ch.opticalLossDb} dB</td>
            <td>${ch.effectiveOsnrDb} dB</td>
            <td><span class="sim-delta-badge ${ch.badgeClass}">${ch.statusLabel}</span></td>
            <td>
              <button class="secondary-button roadm-select-row-btn" data-ch-id="${ch.id}" style="padding: 2px 8px; font-size: 11px;">
                ${isSel ? 'Active' : 'Select'}
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tableBody.querySelectorAll('.roadm-select-row-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetId = e.currentTarget.getAttribute('data-ch-id');
          if (targetId) {
            currentSelectedChannelId = targetId;
            if (channelSelect) channelSelect.value = targetId;
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
    SHAHDARA_ROADM_NODES.forEach(n => {
      nodeSelect.appendChild(createOpt(n.id, `${n.role} - ${n.name}`));
    });
    nodeSelect.value = currentSelectedRoadmNodeId;
  }

  if (channelSelect && channelSelect.options.length === 0) {
    SHAHDARA_WAVELENGTH_CHANNELS.forEach(c => {
      channelSelect.appendChild(createOpt(c.id, `${c.name} (${c.serviceName})`));
    });
    channelSelect.value = currentSelectedChannelId;
  }

  if (spanSelect && spanSelect.options.length === 0) {
    Object.values(ROADM_CONSTANTS.FIBER_SPAN_CONDITIONS).forEach(cond => {
      spanSelect.appendChild(createOpt(cond, cond));
    });
    spanSelect.value = currentSpanCondition;
  }

  if (modeSelect && modeSelect.options.length === 0) {
    Object.values(ROADM_CONSTANTS.SWITCHING_MODES).forEach(mode => {
      modeSelect.appendChild(createOpt(mode, mode));
    });
    modeSelect.value = currentSwitchingMode;
  }

  // Wire events
  if (nodeSelect) {
    nodeSelect.addEventListener('change', () => {
      currentSelectedRoadmNodeId = nodeSelect.value;
      refreshModalView();
    });
  }

  if (channelSelect) {
    channelSelect.addEventListener('change', () => {
      currentSelectedChannelId = channelSelect.value;
      refreshModalView();
    });
  }

  if (spanSelect) {
    spanSelect.addEventListener('change', () => {
      currentSpanCondition = spanSelect.value;
      refreshModalView();
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      currentSwitchingMode = modeSelect.value;
      refreshModalView();
    });
  }

  if (voaSlider && voaValPill) {
    voaSlider.addEventListener('input', () => {
      currentVoaAttenuationDb = parseFloat(voaSlider.value) || 0.0;
      voaValPill.textContent = `${currentVoaAttenuationDb.toFixed(1)} dB`;
      refreshModalView();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetRoadmSimState();
      if (nodeSelect) nodeSelect.value = currentSelectedRoadmNodeId;
      if (channelSelect) channelSelect.value = currentSelectedChannelId;
      if (spanSelect) spanSelect.value = currentSpanCondition;
      if (modeSelect) modeSelect.value = currentSwitchingMode;
      if (voaSlider) voaSlider.value = '2.0';
      if (voaValPill) voaValPill.textContent = '2.0 dB';
      refreshModalView();
      if (typeof onToast === 'function') onToast('ROADM flex-grid state reset to baseline.');
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const roadmData = calculateRoadmMetrics(state, { selectedNodeId: currentSelectedRoadmNodeId });
      if (roadmData.selectedNode && typeof onFilterArea === 'function') {
        if (modal) {
          if (modal.close) modal.close();
          else modal.removeAttribute('open');
        }
        onFilterArea(roadmData.selectedNode.primaryArea);
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', async () => {
      const roadmData = calculateRoadmMetrics(state, {
        selectedNodeId: currentSelectedRoadmNodeId,
        selectedChannelId: currentSelectedChannelId,
        spanCondition: currentSpanCondition,
        switchingMode: currentSwitchingMode,
        voaAttenuationDb: currentVoaAttenuationDb
      });
      const report = generateRoadmReport(roadmData);
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
        onToast(copied ? 'ROADM audit report copied to clipboard!' : 'Report generated.');
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
  const cardChartEl = document.getElementById('dashboardRoadmChart');
  if (cardChartEl) {
    const roadmData = calculateRoadmMetrics(state, { referenceDate });
    cardChartEl.innerHTML = renderRoadmOpticalSvg(roadmData, { compact: true });
  }
}
