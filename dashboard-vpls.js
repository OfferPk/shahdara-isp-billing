import { formatPKR } from './core.js';

/**
 * Carrier MPLS VPLS (Virtual Private LAN Service - RFC 4761 / RFC 4762) Matrix
 * Multi-Point MAC Learning, Split-Horizon Loop Prevention & Flood Mitigation
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Full-Mesh PWs & SLA Telemetry
 */

export const VPLS_CONSTANTS = {
  DEFAULT_NETWORK_ID: 'shahdara-civic-mesh',
  DEFAULT_MAC_AGING_SEC: 300,
  DEFAULT_SPLIT_HORIZON: true,
  DEFAULT_MAC_FLAP_THRESHOLD: 5, // moves per second
  DEFAULT_BUM_TRAFFIC_MBPS: 10,

  SIGNALING: {
    BGP_VPLS: 'RFC 4761 (BGP Auto-Discovery & Signaling)',
    LDP_VPLS: 'RFC 4762 (Targeted LDP Signaling)'
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    ACCEPTABLE: 'Acceptable',
    DEGRADED: 'Degraded',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_VPLS_NETWORKS = [
  {
    id: 'shahdara-civic-mesh',
    name: 'Punjab Civic Administration & Municipal Secretariat Mesh VPLS',
    vplsId: 10010,
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Baradari', 'Begum Kot', 'Vandala Road'],
    signaling: VPLS_CONSTANTS.SIGNALING.BGP_VPLS,
    peNodes: ['PE-01-TownHall', 'PE-02-Secretariat', 'PE-03-SubRegistrar', 'PE-04-CivicCenter'],
    maxMacEntries: 8192,
    baselineActiveMacs: 2340,
    macAgingSec: 300,
    bumRateLimitMbps: 20,
    totalBandwidthMbps: 1000,
    monthlyRevenuePkr: 1850000,
    subscribersCount: 520
  },
  {
    id: 'banking-atm-vpls',
    name: 'Bank of Punjab & Allied Bank ATM Inter-Branch Layer-2 VPLS',
    vplsId: 20020,
    primaryArea: 'Baradari',
    secondaryAreas: ['Jia Musa', 'Begum Kot'],
    signaling: VPLS_CONSTANTS.SIGNALING.LDP_VPLS,
    peNodes: ['PE-BaradariMain', 'PE-JiaMusaBranch', 'PE-BegumKotDepot'],
    maxMacEntries: 4096,
    baselineActiveMacs: 680,
    macAgingSec: 300,
    bumRateLimitMbps: 5,
    totalBandwidthMbps: 200,
    monthlyRevenuePkr: 920000,
    subscribersCount: 160
  },
  {
    id: 'hospital-health-cluster',
    name: 'District Health & Radiology Hospital PACS Imaging VPLS',
    vplsId: 30030,
    primaryArea: 'Begum Kot',
    secondaryAreas: ['Baradari', 'Vandala Road'],
    signaling: VPLS_CONSTANTS.SIGNALING.BGP_VPLS,
    peNodes: ['PE-HospitalTrauma', 'PE-BegumKotICU', 'PE-VandalaClinic'],
    maxMacEntries: 4096,
    baselineActiveMacs: 1420,
    macAgingSec: 600,
    bumRateLimitMbps: 50,
    totalBandwidthMbps: 1000,
    monthlyRevenuePkr: 1250000,
    subscribersCount: 280
  },
  {
    id: 'education-campus-mesh',
    name: 'University Multi-Campus Academic & Research Mesh VPLS',
    vplsId: 40040,
    primaryArea: 'Jia Musa',
    secondaryAreas: ['Shahdara Town', 'Kala Khatai Road'],
    signaling: VPLS_CONSTANTS.SIGNALING.LDP_VPLS,
    peNodes: ['PE-JiaMusaCampus', 'PE-TownCollege', 'PE-KalaKhataiHostel'],
    maxMacEntries: 8192,
    baselineActiveMacs: 3650,
    macAgingSec: 300,
    bumRateLimitMbps: 30,
    totalBandwidthMbps: 1000,
    monthlyRevenuePkr: 780000,
    subscribersCount: 390
  },
  {
    id: 'safe-cities-surveillance',
    name: 'Safe Cities Traffic Surveillance & PTZ Camera Multi-Drop VPLS',
    vplsId: 50050,
    primaryArea: 'Ravi Siphon',
    secondaryAreas: ['Baradari', 'Begum Kot', 'Shahdara Town'],
    signaling: VPLS_CONSTANTS.SIGNALING.BGP_VPLS,
    peNodes: ['PE-SiphonBridge', 'PE-BaradariToll', 'PE-BegumKotRoundabout', 'PE-TownCrossing'],
    maxMacEntries: 16384,
    baselineActiveMacs: 5820,
    macAgingSec: 180,
    bumRateLimitMbps: 80,
    totalBandwidthMbps: 2000,
    monthlyRevenuePkr: 2100000,
    subscribersCount: 650
  }
];

/**
 * Calculates RFC 4761 / 4762 VPLS full-mesh pseudowires, MAC table dynamics, BUM replication and loop prevention
 * @param {Object} networkConfig - VPLS network definition
 * @param {Object} options - Simulation inputs (macCount, macAgingSec, bumTrafficMbps, injectedMacFlapRate, splitHorizonEnforced)
 * @returns {Object} Calculated dynamics
 */
export function calculateVplsDynamics(networkConfig, options = {}) {
  const n = networkConfig || SHAHDARA_VPLS_NETWORKS[0];

  const peCount = Array.isArray(n.peNodes) ? n.peNodes.length : 3;

  // 1. Full-Mesh Pseudowire Calculation: N*(N-1)/2
  const fullMeshPwCount = Math.round((peCount * (peCount - 1)) / 2);

  const splitHorizonEnforced = typeof options.splitHorizonEnforced === 'boolean'
    ? options.splitHorizonEnforced
    : VPLS_CONSTANTS.DEFAULT_SPLIT_HORIZON;

  const macCount = typeof options.macCount === 'number'
    ? Math.max(10, Math.min(n.maxMacEntries * 1.5, Math.round(options.macCount)))
    : n.baselineActiveMacs;

  const macAgingSec = typeof options.macAgingSec === 'number'
    ? Math.max(30, Math.min(1800, Math.round(options.macAgingSec)))
    : n.macAgingSec;

  const bumTrafficMbps = typeof options.bumTrafficMbps === 'number'
    ? Math.max(0.5, Math.min(150, options.bumTrafficMbps))
    : VPLS_CONSTANTS.DEFAULT_BUM_TRAFFIC_MBPS;

  const injectedMacFlapRate = typeof options.injectedMacFlapRate === 'number'
    ? Math.max(0, Math.min(30, options.injectedMacFlapRate))
    : 0;

  // 2. MAC Table Utilization & Unknown Unicast Flooding
  const maxMacEntries = n.maxMacEntries;
  const macUtilizationPct = +Math.min(100, (macCount / maxMacEntries) * 100).toFixed(1);
  const isMacTableOverflow = macCount > maxMacEntries;

  let unknownUnicastFloodPct = 0.5;
  if (isMacTableOverflow) {
    const overflowRatio = (macCount - maxMacEntries) / maxMacEntries;
    unknownUnicastFloodPct = +Math.min(50, 15 + overflowRatio * 35).toFixed(1);
  } else if (macUtilizationPct > 85) {
    unknownUnicastFloodPct = +((macUtilizationPct - 85) * 0.4 + 1.0).toFixed(1);
  }

  // 3. Ingress BUM Replication Bandwidth
  // Ingress PE must replicate each BUM frame across (N - 1) remote pseudowires
  const remotePeCount = Math.max(1, peCount - 1);
  const rawReplicationLoadMbps = +(bumTrafficMbps * remotePeCount).toFixed(1);

  // BUM Storm Policer
  const isBumPolicerActive = rawReplicationLoadMbps > n.bumRateLimitMbps;
  const passedBumMbps = isBumPolicerActive ? n.bumRateLimitMbps : rawReplicationLoadMbps;
  const droppedBumMbps = isBumPolicerActive ? +(rawReplicationLoadMbps - n.bumRateLimitMbps).toFixed(1) : 0;

  // 4. Loop Condition Evaluation
  let isLoopDetected = false;
  let loopRiskLevel = 'None (Safe)';

  if (!splitHorizonEnforced) {
    // Split Horizon disabled in a full-mesh L2 VPN creates an immediate forwarding storm loop!
    isLoopDetected = true;
    loopRiskLevel = 'Catastrophic (Split-Horizon Disabled)';
  } else if (injectedMacFlapRate >= VPLS_CONSTANTS.DEFAULT_MAC_FLAP_THRESHOLD) {
    loopRiskLevel = 'Severe (Customer-Side Bridge Loop / Flapping)';
  } else if (injectedMacFlapRate > 1) {
    loopRiskLevel = 'Moderate (Intermittent MAC Moves)';
  }

  // 5. Overall Status Verdict
  let status = VPLS_CONSTANTS.STATUS.OPTIMAL;
  let statusColor = '#10b981';

  if (isLoopDetected || isMacTableOverflow || injectedMacFlapRate >= 8) {
    status = VPLS_CONSTANTS.STATUS.CRITICAL;
    statusColor = '#ef4444';
  } else if (isBumPolicerActive || macUtilizationPct > 80 || injectedMacFlapRate > 2) {
    status = VPLS_CONSTANTS.STATUS.DEGRADED;
    statusColor = '#f59e0b';
  } else if (macUtilizationPct > 60 || unknownUnicastFloodPct > 2.0) {
    status = VPLS_CONSTANTS.STATUS.ACCEPTABLE;
    statusColor = '#3b82f6';
  }

  // SLA Penalty Exposure (e.g. if bridge loop or packet drops breach SLA)
  let penaltyRebatePct = 0;
  if (status === VPLS_CONSTANTS.STATUS.CRITICAL) penaltyRebatePct = 25;
  else if (status === VPLS_CONSTANTS.STATUS.DEGRADED) penaltyRebatePct = 10;
  const penaltyPkr = Math.round((n.monthlyRevenuePkr * penaltyRebatePct) / 100);

  return {
    network: n,
    peCount,
    fullMeshPwCount,
    splitHorizonEnforced,
    macCount,
    macAgingSec,
    bumTrafficMbps,
    injectedMacFlapRate,

    // MAC Table Dynamics
    table: {
      maxMacEntries,
      macUtilizationPct,
      isMacTableOverflow,
      unknownUnicastFloodPct
    },

    // BUM Flood & Ingress Replication
    replication: {
      remotePeCount,
      rawReplicationLoadMbps,
      passedBumMbps,
      droppedBumMbps,
      isBumPolicerActive,
      bumRateLimitMbps: n.bumRateLimitMbps
    },

    // Loop & Stability Telemetry
    stability: {
      isLoopDetected,
      loopRiskLevel,
      flapDampeningTriggered: injectedMacFlapRate >= VPLS_CONSTANTS.DEFAULT_MAC_FLAP_THRESHOLD
    },

    // Quality Verdict & Financial Impact
    status,
    statusColor,
    penaltyRebatePct,
    penaltyPkr
  };
}

/**
 * Calculates aggregate VPLS metrics across all Shahdara corporate L2 VPN networks
 * @param {Array} networks - Array of VPLS network definitions
 * @param {Object} state - Application state
 * @param {Object} options - Calculation options
 * @returns {Object} Rollup metrics
 */
export function calculateVplsMetrics(networks = SHAHDARA_VPLS_NETWORKS, state = null, options = {}) {
  const networkList = Array.isArray(networks) && networks.length > 0 ? networks : SHAHDARA_VPLS_NETWORKS;

  let totalNetworks = networkList.length;
  let totalMeshPws = 0;
  let totalLearnedMacs = 0;
  let totalRevenuePkr = 0;
  let totalSubscribers = 0;
  let totalBumLoadMbps = 0;
  let totalPenaltyPkr = 0;
  let loopIncidentsCount = 0;

  const analyzedNetworks = networkList.map(net => {
    const dynamics = calculateVplsDynamics(net, options);
    totalMeshPws += dynamics.fullMeshPwCount;
    totalLearnedMacs += dynamics.macCount;
    totalRevenuePkr += net.monthlyRevenuePkr || 0;
    totalSubscribers += net.subscribersCount || 0;
    totalBumLoadMbps += dynamics.replication.rawReplicationLoadMbps;
    totalPenaltyPkr += dynamics.penaltyPkr;
    if (dynamics.stability.isLoopDetected) loopIncidentsCount++;
    return dynamics;
  });

  return {
    totalNetworks,
    totalMeshPws,
    totalLearnedMacs,
    totalRevenuePkr,
    totalSubscribers,
    totalBumLoadMbps: +totalBumLoadMbps.toFixed(1),
    totalPenaltyPkr,
    loopIncidentsCount,
    analyzedNetworks
  };
}

/**
 * Renders pure SVG vector visualizer for VPLS mesh topology, split-horizon shield and BUM replication
 * @param {Object} dynamics - Output of calculateVplsDynamics
 * @param {Object} options - SVG render options (isCompact)
 * @returns {string} SVG markup
 */
export function renderVplsDiagramSvg(dynamics, options = {}) {
  if (!dynamics) return '';

  const isCompact = Boolean(options.isCompact);
  const width = 740;
  const height = isCompact ? 160 : 250;

  const n = dynamics.network;
  const tab = dynamics.table;
  const rep = dynamics.replication;
  const stab = dynamics.stability;
  const stateColor = dynamics.statusColor;

  if (isCompact) {
    return `<svg class="vpls-svg vpls-compact-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Carrier VPLS Network Overview" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="vplsGradCompact" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0b1329"/>
          <stop offset="100%" stop-color="#1e1b4b"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="8" fill="url(#vplsGradCompact)"/>

      <!-- Title & Details -->
      <text x="20" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui, sans-serif">${escapeXml(n.name)}</text>
      <text x="20" y="46" fill="#a5b4fc" font-size="11" font-family="system-ui, sans-serif">VSI ID: ${n.vplsId} · ${escapeXml(n.signaling)} · PEs: ${dynamics.peCount} (${dynamics.fullMeshPwCount} Mesh PWs)</text>

      <!-- KPI Pills -->
      <g transform="translate(20, 64)">
        <!-- State -->
        <rect x="0" y="0" width="115" height="44" rx="6" fill="#1e1b4b" stroke="${stateColor}" stroke-width="1.5"/>
        <text x="12" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">VPLS STATUS</text>
        <text x="12" y="36" fill="${stateColor}" font-size="13" font-weight="800" font-family="system-ui">${escapeXml(dynamics.status)}</text>

        <!-- MAC Utilization -->
        <rect x="125" y="0" width="130" height="44" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
        <text x="137" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">MAC TABLE UTIL</text>
        <text x="137" y="36" fill="#38bdf8" font-size="13" font-weight="800" font-family="system-ui">${tab.macUtilizationPct}% (${dynamics.macCount})</text>

        <!-- BUM Replication -->
        <rect x="265" y="0" width="135" height="44" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
        <text x="277" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">BUM INGRESS REPL</text>
        <text x="277" y="36" fill="#c084fc" font-size="13" font-weight="800" font-family="system-ui">${rep.rawReplicationLoadMbps} Mbps</text>

        <!-- Split Horizon -->
        <rect x="410" y="0" width="140" height="44" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
        <text x="422" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">SPLIT-HORIZON</text>
        <text x="422" y="36" fill="${dynamics.splitHorizonEnforced ? '#10b981' : '#ef4444'}" font-size="13" font-weight="800" font-family="system-ui">${dynamics.splitHorizonEnforced ? 'ENFORCED' : 'DISABLED'}</text>

        <!-- Protected Revenue -->
        <rect x="560" y="0" width="150" height="44" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
        <text x="572" y="18" fill="#a5b4fc" font-size="10" font-family="system-ui">PROTECTED MRR</text>
        <text x="572" y="36" fill="#34d399" font-size="13" font-weight="800" font-family="system-ui">${formatPKR(n.monthlyRevenuePkr)}</text>
      </g>

      <!-- Bottom Status Bar -->
      <g transform="translate(20, 128)">
        <text x="0" y="14" fill="#818cf8" font-size="10.5" font-family="system-ui">Aging: <tspan fill="#e0e7ff" font-weight="600">${dynamics.macAgingSec}s</tspan> · Flood: <tspan fill="#e0e7ff" font-weight="600">${tab.unknownUnicastFloodPct}%</tspan> · Flap: <tspan fill="#e0e7ff" font-weight="600">${dynamics.injectedMacFlapRate} moves/s</tspan> · Policer: <tspan fill="#e0e7ff" font-weight="600">${rep.isBumPolicerActive ? 'Policing Active' : 'Uncongested'}</tspan></text>
      </g>
    </svg>`;
  }

  // Expanded Detailed Visualizer
  const pePositions = [
    { x: 120, y: 70, label: n.peNodes[0] || 'PE-01' },
    { x: 620, y: 70, label: n.peNodes[1] || 'PE-02' },
    { x: 500, y: 160, label: n.peNodes[2] || 'PE-03' },
    { x: 240, y: 160, label: n.peNodes[3] || 'PE-04' }
  ].slice(0, dynamics.peCount);

  // Generate full mesh lines between PE nodes
  let meshLinesSvg = '';
  for (let i = 0; i < pePositions.length; i++) {
    for (let j = i + 1; j < pePositions.length; j++) {
      const p1 = pePositions[i];
      const p2 = pePositions[j];
      meshLinesSvg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#6366f1" stroke-width="1.8" stroke-dasharray="5,4"/>`;
    }
  }

  return `<svg class="vpls-svg vpls-expanded-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Carrier VPLS Full-Mesh Architecture and MAC Dynamics" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="vplsGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e1b4b"/>
      </linearGradient>
      <filter id="vplsGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Canvas -->
    <rect width="${width}" height="${height}" rx="10" fill="url(#vplsGradMain)"/>

    <!-- Header Banner -->
    <g transform="translate(24, 22)">
      <text x="0" y="0" fill="#f8fafc" font-size="14" font-weight="700" font-family="system-ui, sans-serif">${escapeXml(n.name)}</text>
      <text x="0" y="16" fill="#a5b4fc" font-size="11" font-family="system-ui, sans-serif">VSI ID: ${n.vplsId} · Signaling: <tspan fill="#38bdf8" font-weight="600">${escapeXml(n.signaling)}</tspan> · Coverage: ${n.primaryArea} (${n.secondaryAreas.join(', ')})</text>
    </g>

    <!-- Status Indicator Top Right -->
    <g transform="translate(${width - 150}, 16)">
      <rect x="0" y="0" width="126" height="28" rx="6" fill="#0f172a" stroke="${stateColor}" stroke-width="1.5" filter="url(#vplsGlow)"/>
      <circle cx="14" cy="14" r="5" fill="${stateColor}"/>
      <text x="26" y="18" fill="${stateColor}" font-size="12" font-weight="800" font-family="system-ui, sans-serif">VSI: ${escapeXml(dynamics.status)}</text>
    </g>

    <!-- Mesh Lines -->
    <g>
      ${meshLinesSvg}
    </g>

    <!-- Center Split-Horizon Shield & Core Emulation -->
    <g transform="translate(${width / 2}, 115)">
      <circle cx="0" cy="0" r="28" fill="#1e1b4b" stroke="${dynamics.splitHorizonEnforced ? '#10b981' : '#ef4444'}" stroke-width="2"/>
      <text x="0" y="-4" fill="${dynamics.splitHorizonEnforced ? '#10b981' : '#ef4444'}" font-size="10" font-weight="800" text-anchor="middle" font-family="system-ui">SPLIT-H</text>
      <text x="0" y="10" fill="#a5b4fc" font-size="8" text-anchor="middle" font-family="system-ui">${dynamics.splitHorizonEnforced ? 'NO LOOPS' : 'LOOP RISK'}</text>
    </g>

    <!-- PE Router Nodes -->
    ${pePositions.map(pos => `
      <g transform="translate(${pos.x}, ${pos.y})">
        <circle cx="0" cy="0" r="18" fill="#312e81" stroke="#818cf8" stroke-width="2"/>
        <text x="0" y="4" fill="#ffffff" font-size="10" font-weight="800" text-anchor="middle" font-family="system-ui">PE</text>
        <rect x="-55" y="22" width="110" height="20" rx="4" fill="#0f172a" stroke="#312e81" stroke-width="1"/>
        <text x="0" y="35" fill="#e0e7ff" font-size="9" font-weight="600" text-anchor="middle" font-family="system-ui">${escapeXml(pos.label)}</text>
      </g>
    `).join('')}

    <!-- Bottom Telemetry HUD Matrix -->
    <g transform="translate(24, 186)">
      <!-- Box 1: Full-Mesh Pseudowires -->
      <rect x="0" y="0" width="165" height="48" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
      <text x="10" y="15" fill="#a5b4fc" font-size="10" font-family="system-ui">FULL-MESH PWs</text>
      <text x="10" y="32" fill="#38bdf8" font-size="13" font-weight="800" font-family="system-ui">${dynamics.fullMeshPwCount} Point-to-Point PWs</text>
      <text x="10" y="43" fill="#818cf8" font-size="8.5" font-family="system-ui">Connecting ${dynamics.peCount} Core PEs</text>

      <!-- Box 2: MAC Table & Aging -->
      <rect x="175" y="0" width="165" height="48" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
      <text x="10" y="15" fill="#a5b4fc" font-size="10" font-family="system-ui">MAC TABLE OCCUPANCY</text>
      <text x="10" y="32" fill="#c084fc" font-size="13" font-weight="800" font-family="system-ui">${tab.macUtilizationPct}% (${dynamics.macCount}/${tab.maxMacEntries})</text>
      <text x="10" y="43" fill="#818cf8" font-size="8.5" font-family="system-ui">Aging Timer: ${dynamics.macAgingSec}s</text>

      <!-- Box 3: BUM Replication Load -->
      <rect x="350" y="0" width="170" height="48" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
      <text x="10" y="15" fill="#a5b4fc" font-size="10" font-family="system-ui">BUM REPLICATION</text>
      <text x="10" y="32" fill="${rep.isBumPolicerActive ? '#f59e0b' : '#38bdf8'}" font-size="13" font-weight="800" font-family="system-ui">${rep.rawReplicationLoadMbps} Mbps</text>
      <text x="10" y="43" fill="#818cf8" font-size="8.5" font-family="system-ui">Cap: ${rep.bumRateLimitMbps} Mbps (${rep.droppedBumMbps} Mb drop)</text>

      <!-- Box 4: Protection & SLA Exposure -->
      <rect x="530" y="0" width="160" height="48" rx="6" fill="#1e1b4b" stroke="#312e81" stroke-width="1"/>
      <text x="10" y="15" fill="#a5b4fc" font-size="10" font-family="system-ui">PROTECTED REVENUE</text>
      <text x="10" y="32" fill="#34d399" font-size="13" font-weight="800" font-family="system-ui">${formatPKR(n.monthlyRevenuePkr)}</text>
      <text x="10" y="43" fill="#818cf8" font-size="8.5" font-family="system-ui">${n.subscribersCount} Subscribed Endpoints</text>
    </g>
  </svg>`;
}

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Generates audit text report for VPLS network
 * @param {Object} dynamics - Output of calculateVplsDynamics
 * @param {Object} allMetrics - Output of calculateVplsMetrics
 * @returns {string} Plaintext report
 */
export function generateVplsReport(dynamics, allMetrics = null) {
  if (!dynamics) return 'No VPLS telemetry data available.';

  const n = dynamics.network;
  const tab = dynamics.table;
  const rep = dynamics.replication;
  const stab = dynamics.stability;

  const now = new Date().toISOString();

  let repText = `================================================================================
SHAHDARA ISP METRO FIBER - CARRIER VPLS L2VPN AUDIT REPORT
Protocol Standards: RFC 4761 (BGP VPLS) / RFC 4762 (LDP VPLS)
Audit Timestamp: ${now}
================================================================================

1. VPLS NETWORK IDENTITY & TOPOLOGY
--------------------------------------------------------------------------------
VPLS Instance ID   : ${n.vplsId}
Instance Name      : ${n.name}
Signaling Protocol : ${n.signaling}
Member PE Routers  : ${n.peNodes.join(', ')} (${dynamics.peCount} PEs)
Full Mesh PW Count : ${dynamics.fullMeshPwCount} Pseudowires (Formula: N*(N-1)/2)
Primary Core Area  : ${n.primaryArea}
Secondary Spans    : ${n.secondaryAreas.join(', ')}

2. MAC ADDRESS LEARNING & TABLE UTILIZATION
--------------------------------------------------------------------------------
Max MAC Capacity   : ${tab.maxMacEntries} Entries
Learned Active MACs: ${dynamics.macCount} Entries
MAC Utilization    : ${tab.macUtilizationPct}%
MAC Aging Interval : ${dynamics.macAgingSec} seconds
Unknown Unicast Fl : ${tab.unknownUnicastFloodPct}% of ingress traffic
MAC Flap Rate      : ${dynamics.injectedMacFlapRate} moves/sec
Flap Dampening     : ${stab.flapDampeningTriggered ? 'TRIGGERED (Dampening quarantine active)' : 'NORMAL'}

3. BUM (BROADCAST / UNKNOWN / MULTICAST) REPLICATION DYNAMICS
--------------------------------------------------------------------------------
Ingress BUM Rate   : ${dynamics.bumTrafficMbps} Mbps
Remote PE Copies   : ${rep.remotePeCount} Replicas
Total Ingress Repl : ${rep.rawReplicationLoadMbps} Mbps
BUM Policer Cap    : ${rep.bumRateLimitMbps} Mbps
Policer Status     : ${rep.isBumPolicerActive ? `POLICING ACTIVE (${rep.droppedBumMbps} Mbps dropped)` : 'WITHIN SPEC (No storm drop)'}

4. SPLIT-HORIZON LOOP PREVENTION VERDICT
--------------------------------------------------------------------------------
Split-Horizon Rule : ${dynamics.splitHorizonEnforced ? 'ENFORCED (RFC 4762 Compliant)' : 'DISABLED (SEVERE RISK)'}
Loop Threat Status : ${stab.loopRiskLevel}
Loop Detected      : ${stab.isLoopDetected ? 'YES (Immediate Bridge Loop!)' : 'NO (Forwarding Safe)'}

5. FINANCIAL IMPACT & CARRIER SLA EXPOSURE
--------------------------------------------------------------------------------
Quality Verdict    : ${dynamics.status.toUpperCase()}
Protected Revenue  : ${formatPKR(n.monthlyRevenuePkr)} / month
Active Subscribers : ${n.subscribersCount} Subscribed Sites
SLA Penalty Rebate : ${dynamics.penaltyRebatePct}% (${formatPKR(dynamics.penaltyPkr)})
`;

  if (allMetrics) {
    repText += `
6. SHAHDARA METRO NETWORK VPLS AGGREGATE SUMMARY
--------------------------------------------------------------------------------
Total VPLS Networks: ${allMetrics.totalNetworks}
Total Mesh PWs     : ${allMetrics.totalMeshPws}
Total Learned MACs : ${allMetrics.totalLearnedMacs}
Total BUM Repl Load: ${allMetrics.totalBumLoadMbps} Mbps
Total Protected MRR: ${formatPKR(allMetrics.totalRevenuePkr)} / month
Total Subscribers  : ${allMetrics.totalSubscribers}
Total SLA Penalties: ${formatPKR(allMetrics.totalPenaltyPkr)}
`;
  }

  repText += `================================================================================
END OF CARRIER VPLS TELEMETRY & SLA REPORT
================================================================================`;

  return repText;
}

/**
 * Exports VPLS network telemetry as JSON string
 */
export function exportVplsJson(dynamics, allMetrics = null) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    dynamics,
    allMetrics
  }, null, 2);
}

/**
 * Exports VPLS network telemetry as CSV string
 */
export function exportVplsCsv(dynamics, allMetrics = null) {
  const networks = allMetrics?.analyzedNetworks || [dynamics];
  const headers = [
    'VPLS ID',
    'Instance ID',
    'Network Name',
    'Signaling',
    'PE Count',
    'Mesh PWs',
    'Primary Area',
    'MAC Count',
    'MAC Max',
    'MAC Util %',
    'Aging (s)',
    'BUM Repl (Mbps)',
    'Split-Horizon',
    'Loop Detected',
    'Monthly Revenue (PKR)',
    'Subscribers',
    'Status',
    'Penalty (PKR)'
  ];

  const rows = networks.map(d => {
    const n = d.network;
    const tab = d.table;
    const rep = d.replication;
    const stab = d.stability;
    return [
      n.vplsId,
      `"${n.id}"`,
      `"${n.name.replace(/"/g, '""')}"`,
      `"${n.signaling}"`,
      d.peCount,
      d.fullMeshPwCount,
      `"${n.primaryArea}"`,
      d.macCount,
      tab.maxMacEntries,
      tab.macUtilizationPct,
      d.macAgingSec,
      rep.rawReplicationLoadMbps,
      d.splitHorizonEnforced ? 'TRUE' : 'FALSE',
      stab.isLoopDetected ? 'TRUE' : 'FALSE',
      n.monthlyRevenuePkr,
      n.subscribersCount,
      `"${d.status}"`,
      d.penaltyPkr
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Modal and Dashboard Card Controller for VPLS Telemetry
 * @param {Object} state - Application state
 * @param {Object} options - Controller options (document, onFilterArea, onToast)
 * @returns {Object} Controller interface
 */
export function setupVplsModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardVplsModal');
  const closeBtn = doc.getElementById('dashboardVplsModalCloseBtn');
  const openBtn = doc.getElementById('dashboardOpenVplsModalBtn');

  const cardChartContainer = doc.getElementById('dashboardVplsChart');
  const modalDiagramContainer = doc.getElementById('vplsModalDiagramContainer');

  // Input Controls
  const networkSelect = doc.getElementById('vplsNetworkSelect');
  const macSlider = doc.getElementById('vplsMacSlider');
  const macLabel = doc.getElementById('vplsMacLabel');
  const agingSlider = doc.getElementById('vplsAgingSlider');
  const agingLabel = doc.getElementById('vplsAgingLabel');
  const bumSlider = doc.getElementById('vplsBumSlider');
  const bumLabel = doc.getElementById('vplsBumLabel');
  const flapSlider = doc.getElementById('vplsFlapSlider');
  const flapLabel = doc.getElementById('vplsFlapLabel');
  const splitHorizonCheck = doc.getElementById('vplsSplitHorizonCheck');
  const resetBtn = doc.getElementById('vplsResetBtn');

  // Stat Labels
  const statStatus = doc.getElementById('vplsStatStatus');
  const statMesh = doc.getElementById('vplsStatMesh');
  const statMacUtil = doc.getElementById('vplsStatMacUtil');
  const statBum = doc.getElementById('vplsStatBum');
  const statFlap = doc.getElementById('vplsStatFlap');
  const statPenalty = doc.getElementById('vplsStatPenalty');

  // Action Buttons
  const filterAreaBtn = doc.getElementById('vplsFilterAreaBtn');
  const exportJsonBtn = doc.getElementById('vplsExportJsonBtn');
  const exportCsvBtn = doc.getElementById('vplsExportCsvBtn');
  const copyReportBtn = doc.getElementById('vplsCopyReportBtn');

  let currentNetworkId = VPLS_CONSTANTS.DEFAULT_NETWORK_ID;
  let customMac = null;
  let customAging = null;
  let customBum = null;
  let customFlap = null;
  let customSplitHorizon = null;

  function getCurrentNetwork() {
    return SHAHDARA_VPLS_NETWORKS.find(net => net.id === currentNetworkId) || SHAHDARA_VPLS_NETWORKS[0];
  }

  function getCalculatedDynamics() {
    const n = getCurrentNetwork();
    return calculateVplsDynamics(n, {
      macCount: customMac !== null ? customMac : n.baselineActiveMacs,
      macAgingSec: customAging !== null ? customAging : n.macAgingSec,
      bumTrafficMbps: customBum !== null ? customBum : VPLS_CONSTANTS.DEFAULT_BUM_TRAFFIC_MBPS,
      injectedMacFlapRate: customFlap !== null ? customFlap : 0,
      splitHorizonEnforced: customSplitHorizon !== null ? customSplitHorizon : true
    });
  }

  function updateUi() {
    const dynamics = getCalculatedDynamics();
    const allMetrics = calculateVplsMetrics(SHAHDARA_VPLS_NETWORKS, state);

    // Update Card Chart if present
    if (cardChartContainer) {
      cardChartContainer.innerHTML = renderVplsDiagramSvg(dynamics, { isCompact: true });
    }

    // Update Modal Diagram if present
    if (modalDiagramContainer) {
      modalDiagramContainer.innerHTML = renderVplsDiagramSvg(dynamics, { isCompact: false });
    }

    // Update KPI Stat Elements
    if (statStatus) {
      statStatus.textContent = dynamics.status;
      statStatus.style.color = dynamics.statusColor;
    }
    if (statMesh) {
      statMesh.textContent = `${dynamics.fullMeshPwCount} Mesh PWs`;
      statMesh.style.color = '#38bdf8';
    }
    if (statMacUtil) {
      statMacUtil.textContent = `${dynamics.table.macUtilizationPct}% (${dynamics.macCount})`;
      statMacUtil.style.color = dynamics.table.macUtilizationPct > 80 ? '#f59e0b' : '#10b981';
    }
    if (statBum) {
      statBum.textContent = `${dynamics.replication.rawReplicationLoadMbps} Mbps`;
      statBum.style.color = dynamics.replication.isBumPolicerActive ? '#f59e0b' : '#a78bfa';
    }
    if (statFlap) {
      statFlap.textContent = `${dynamics.injectedMacFlapRate} moves/s`;
      statFlap.style.color = dynamics.stability.flapDampeningTriggered ? '#ef4444' : '#10b981';
    }
    if (statPenalty) {
      statPenalty.textContent = `${dynamics.penaltyRebatePct}% (${formatPKR(dynamics.penaltyPkr)})`;
      statPenalty.style.color = dynamics.penaltyPkr > 0 ? '#ef4444' : '#10b981';
    }

    // Update Slider Labels
    if (macLabel) macLabel.textContent = `${dynamics.macCount}`;
    if (agingLabel) agingLabel.textContent = `${dynamics.macAgingSec}s`;
    if (bumLabel) bumLabel.textContent = `${dynamics.bumTrafficMbps} Mbps`;
    if (flapLabel) flapLabel.textContent = `${dynamics.injectedMacFlapRate} moves/s`;
  }

  function syncControls() {
    const n = getCurrentNetwork();
    if (networkSelect) networkSelect.value = n.id;
    if (macSlider) macSlider.value = String(customMac !== null ? customMac : n.baselineActiveMacs);
    if (agingSlider) agingSlider.value = String(customAging !== null ? customAging : n.macAgingSec);
    if (bumSlider) bumSlider.value = String(customBum !== null ? customBum : VPLS_CONSTANTS.DEFAULT_BUM_TRAFFIC_MBPS);
    if (flapSlider) flapSlider.value = String(customFlap !== null ? customFlap : 0);
    if (splitHorizonCheck) splitHorizonCheck.checked = Boolean(customSplitHorizon !== null ? customSplitHorizon : true);
    updateUi();
  }

  // Event Listeners
  if (networkSelect) {
    networkSelect.addEventListener('change', () => {
      currentNetworkId = networkSelect.value;
      customMac = null;
      customAging = null;
      customBum = null;
      customFlap = null;
      customSplitHorizon = null;
      syncControls();
    });
  }

  if (macSlider) {
    macSlider.addEventListener('input', () => {
      customMac = Number(macSlider.value);
      updateUi();
    });
  }

  if (agingSlider) {
    agingSlider.addEventListener('input', () => {
      customAging = Number(agingSlider.value);
      updateUi();
    });
  }

  if (bumSlider) {
    bumSlider.addEventListener('input', () => {
      customBum = Number(bumSlider.value);
      updateUi();
    });
  }

  if (flapSlider) {
    flapSlider.addEventListener('input', () => {
      customFlap = Number(flapSlider.value);
      updateUi();
    });
  }

  if (splitHorizonCheck) {
    splitHorizonCheck.addEventListener('change', () => {
      customSplitHorizon = splitHorizonCheck.checked;
      updateUi();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      customMac = null;
      customAging = null;
      customBum = null;
      customFlap = null;
      customSplitHorizon = null;
      syncControls();
      if (typeof options.onToast === 'function') {
        options.onToast('VPLS parameters reset to standard baseline.');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      syncControls();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const n = getCurrentNetwork();
      if (modal && typeof modal.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(n.primaryArea);
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateVplsMetrics(SHAHDARA_VPLS_NETWORKS, state);
      const json = exportVplsJson(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(json).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('VPLS JSON telemetry copied to clipboard.');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateVplsMetrics(SHAHDARA_VPLS_NETWORKS, state);
      const csv = exportVplsCsv(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(csv).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('VPLS CSV telemetry copied to clipboard.');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateVplsMetrics(SHAHDARA_VPLS_NETWORKS, state);
      const report = generateVplsReport(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(report).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('VPLS audit report copied to clipboard.');
      }
    });
  }

  // Initial render
  updateUi();

  return {
    open: () => {
      syncControls();
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    update: updateUi,
    getDynamics: getCalculatedDynamics,
    getMetrics: () => calculateVplsMetrics(SHAHDARA_VPLS_NETWORKS, state)
  };
}
