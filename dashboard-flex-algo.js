import { formatPKR } from './core.js';

/**
 * Carrier Segment Routing Flexible Algorithm (Flex-Algo - RFC 9350 / RFC 9351) Matrix
 * Multi-Plane Topology, Microsecond Min-Delay Optimization & SRLG Disjoint Path Telemetry
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Multi-Plane SIDs & SLA Telemetry
 */

export const FLEX_ALGO_CONSTANTS = {
  DEFAULT_ALGO_ID: 128,
  DEFAULT_TRAFFIC_LOAD_GBPS: 8,
  DEFAULT_JITTER_PENALTY_MS: 0.15,

  METRIC_TYPES: {
    IGP: 'IGP Cost Metric (SPF Default)',
    MIN_DELAY: 'Min-Delay Latency Metric (RFC 8570)',
    TE_METRIC: 'Traffic Engineering Cost Metric'
  },

  CONSTRAINTS: {
    EXCLUDE_MICROWAVE: 'Exclude High-Jitter Microwave Radio Hops',
    EXCLUDE_SRLG_AERIAL: 'Exclude Aerial Pole Trench Shared Risk Link Groups (SRLG)',
    INCLUDE_ENCRYPTED: 'Strict Optical MACsec Encrypted Links Only'
  },

  STATUS: {
    OPTIMAL_COMPLIANT: 'Optimal (SLA Fully Satisfied, Zero SRLG Overlap)',
    LATENCY_ELEVATED: 'Latency Elevated (Approaching SLA Upper Limit)',
    SRLG_RISK: 'SRLG Collision Risk (Shared Physical Fiber Conduit)',
    AFFINITY_VIOLATION: 'Affinity Constraint Violation (Unmet Link Property)'
  }
};

export const SHAHDARA_FLEX_ALGOS = [
  {
    id: 128,
    name: 'Flex-Algo 128: Ultra-Low Latency Plane (Financial & 5G URLLC)',
    metricType: FLEX_ALGO_CONSTANTS.METRIC_TYPES.MIN_DELAY,
    calculationType: 0, // SPF
    srv6Locator: '2001:db8:fa80::/48',
    primaryArea: 'Baradari',
    targetArea: 'Begum Kot',
    nodes: ['Baradari-Core', 'TownHall-Optical', 'BegumKot-Edge'],
    primaryLinkHops: 2,
    baselineLatencyMs: 0.82,
    defaultSpfLatencyMs: 2.45,
    srlgExclusionApplied: true,
    excludedLinks: ['Microwave-Radio-Span-02', 'Aerial-JiaMusa-Span-01'],
    capacityGbps: 20,
    monthlyRevenuePkr: 3200000,
    subscribersCount: 180
  },
  {
    id: 129,
    name: 'Flex-Algo 129: High-Throughput Optical Express Plane (CDN & Video)',
    metricType: FLEX_ALGO_CONSTANTS.METRIC_TYPES.TE_METRIC,
    calculationType: 0,
    srv6Locator: '2001:db8:fa81::/48',
    primaryArea: 'Jia Musa',
    targetArea: 'Ravi Siphon',
    nodes: ['JiaMusa-BNG', 'RaviSiphon-Express', 'TownHall-Optical'],
    primaryLinkHops: 2,
    baselineLatencyMs: 1.15,
    defaultSpfLatencyMs: 1.90,
    srlgExclusionApplied: false,
    excludedLinks: [],
    capacityGbps: 100,
    monthlyRevenuePkr: 2850000,
    subscribersCount: 420
  },
  {
    id: 130,
    name: 'Flex-Algo 130: Disjoint SRLG Underground Security Plane (Civil / Hospital)',
    metricType: FLEX_ALGO_CONSTANTS.METRIC_TYPES.TE_METRIC,
    calculationType: 0,
    srv6Locator: '2001:db8:fa82::/48',
    primaryArea: 'Baradari',
    targetArea: 'Vandala Road',
    nodes: ['Baradari-Core', 'Duct-Underground-01', 'VandalaClinic-Edge'],
    primaryLinkHops: 2,
    baselineLatencyMs: 1.35,
    defaultSpfLatencyMs: 2.10,
    srlgExclusionApplied: true,
    excludedLinks: ['Aerial-GT-Road-Pole-Run'],
    capacityGbps: 40,
    monthlyRevenuePkr: 2400000,
    subscribersCount: 260
  },
  {
    id: 131,
    name: 'Flex-Algo 131: Green Energy Solar-Powered Routing Plane',
    metricType: FLEX_ALGO_CONSTANTS.METRIC_TYPES.IGP,
    calculationType: 0,
    srv6Locator: '2001:db8:fa83::/48',
    primaryArea: 'Shahdara Town',
    targetArea: 'Begum Kot',
    nodes: ['TownHall-SolarHub', 'BegumKot-SolarHub'],
    primaryLinkHops: 1,
    baselineLatencyMs: 0.95,
    defaultSpfLatencyMs: 1.40,
    srlgExclusionApplied: false,
    excludedLinks: [],
    capacityGbps: 20,
    monthlyRevenuePkr: 1950000,
    subscribersCount: 310
  },
  {
    id: 0,
    name: 'Default Algo 0: Standard IGP Shortest Path First (Broadband Default)',
    metricType: FLEX_ALGO_CONSTANTS.METRIC_TYPES.IGP,
    calculationType: 0,
    srv6Locator: '2001:db8:fa00::/48',
    primaryArea: 'All Shahdara Sectors',
    targetArea: 'Core Mesh',
    nodes: ['Baradari-Core', 'JiaMusa-BNG', 'TownHall-Optical', 'BegumKot-Edge', 'RaviSiphon-Express'],
    primaryLinkHops: 4,
    baselineLatencyMs: 2.45,
    defaultSpfLatencyMs: 2.45,
    srlgExclusionApplied: false,
    excludedLinks: [],
    capacityGbps: 100,
    monthlyRevenuePkr: 4100000,
    subscribersCount: 1450
  }
];

// In-memory simulation state
let selectedFlexAlgoId = FLEX_ALGO_CONSTANTS.DEFAULT_ALGO_ID;
let simTrafficLoadGbps = FLEX_ALGO_CONSTANTS.DEFAULT_TRAFFIC_LOAD_GBPS;
let simExcludeMicrowave = true;
let simExcludeSrlg = true;
let simStrictEncryption = false;

export function getFlexAlgoSelectedId() {
  return selectedFlexAlgoId;
}

export function setFlexAlgoSelectedId(id) {
  const numId = Number(id);
  if (SHAHDARA_FLEX_ALGOS.some(a => a.id === numId)) {
    selectedFlexAlgoId = numId;
  }
}

export function getFlexAlgoTrafficLoadGbps() {
  return simTrafficLoadGbps;
}

export function setFlexAlgoTrafficLoadGbps(load) {
  simTrafficLoadGbps = Math.max(1, Math.min(100, Number(load) || 8));
}

export function getFlexAlgoExcludeMicrowave() {
  return simExcludeMicrowave;
}

export function setFlexAlgoExcludeMicrowave(enabled) {
  simExcludeMicrowave = Boolean(enabled);
}

export function getFlexAlgoExcludeSrlg() {
  return simExcludeSrlg;
}

export function setFlexAlgoExcludeSrlg(enabled) {
  simExcludeSrlg = Boolean(enabled);
}

export function getFlexAlgoStrictEncryption() {
  return simStrictEncryption;
}

export function setFlexAlgoStrictEncryption(enabled) {
  simStrictEncryption = Boolean(enabled);
}

export function resetFlexAlgoSimState() {
  selectedFlexAlgoId = FLEX_ALGO_CONSTANTS.DEFAULT_ALGO_ID;
  simTrafficLoadGbps = FLEX_ALGO_CONSTANTS.DEFAULT_TRAFFIC_LOAD_GBPS;
  simExcludeMicrowave = true;
  simExcludeSrlg = true;
  simStrictEncryption = false;
}

/**
 * Calculate dynamic path latency taking into account link constraints and queuing load.
 */
export function calculateFlexAlgoPathLatency(baselineLatencyMs = 0.82, hops = 2, loadGbps = 8, capacityGbps = 20) {
  const loadRatio = Math.min(1.0, loadGbps / Math.max(1, capacityGbps));
  // Queuing delay increases non-linearly above 70% link utilization (M/M/1 queue model)
  const queuingDelayMs = loadRatio > 0.70 ? Number((((loadRatio - 0.70) / 0.30) * 0.45).toFixed(3)) : 0;
  const pathLatencyMs = Number((baselineLatencyMs + queuingDelayMs).toFixed(3));
  return {
    baselineLatencyMs,
    queuingDelayMs,
    pathLatencyMs,
    loadRatio: Number((loadRatio * 100).toFixed(1))
  };
}

/**
 * Calculate percentage latency reduction vs Default SPF Algo 0.
 */
export function calculateFlexAlgoLatencyReduction(flexLatencyMs = 0.82, defaultSpfLatencyMs = 2.45) {
  if (defaultSpfLatencyMs <= 0) return 0;
  const reduction = ((defaultSpfLatencyMs - flexLatencyMs) / defaultSpfLatencyMs) * 100;
  return Number(Math.max(0, reduction).toFixed(1));
}

/**
 * Calculate complete Flex-Algo topology dynamics and status evaluation.
 */
export function calculateFlexAlgoDynamics(algo, options = {}) {
  const selectedAlgo = algo || SHAHDARA_FLEX_ALGOS.find(a => a.id === selectedFlexAlgoId) || SHAHDARA_FLEX_ALGOS[0];
  const trafficLoad = options.trafficLoadGbps !== undefined ? Number(options.trafficLoadGbps) : simTrafficLoadGbps;
  const excludeMicrowave = options.excludeMicrowave !== undefined ? Boolean(options.excludeMicrowave) : simExcludeMicrowave;
  const excludeSrlg = options.excludeSrlg !== undefined ? Boolean(options.excludeSrlg) : simExcludeSrlg;
  const strictEncryption = options.strictEncryption !== undefined ? Boolean(options.strictEncryption) : simStrictEncryption;

  const latencyData = calculateFlexAlgoPathLatency(
    selectedAlgo.baselineLatencyMs,
    selectedAlgo.primaryLinkHops,
    trafficLoad,
    selectedAlgo.capacityGbps
  );

  const latencySavingsPercent = calculateFlexAlgoLatencyReduction(
    latencyData.pathLatencyMs,
    selectedAlgo.defaultSpfLatencyMs
  );

  const headroomGbps = Math.max(0, selectedAlgo.capacityGbps - trafficLoad);

  // Status determination
  let status = FLEX_ALGO_CONSTANTS.STATUS.OPTIMAL_COMPLIANT;
  let statusClass = 'optimal';

  if (trafficLoad > selectedAlgo.capacityGbps) {
    status = FLEX_ALGO_CONSTANTS.STATUS.LATENCY_ELEVATED;
    statusClass = 'critical';
  } else if (!excludeSrlg && selectedAlgo.srlgExclusionApplied) {
    status = FLEX_ALGO_CONSTANTS.STATUS.SRLG_RISK;
    statusClass = 'degraded';
  } else if (strictEncryption && selectedAlgo.id === 0) {
    status = FLEX_ALGO_CONSTANTS.STATUS.AFFINITY_VIOLATION;
    statusClass = 'degraded';
  } else if (latencyData.pathLatencyMs > 2.0 && selectedAlgo.id === 128) {
    status = FLEX_ALGO_CONSTANTS.STATUS.LATENCY_ELEVATED;
    statusClass = 'degraded';
  }

  return {
    algo: selectedAlgo,
    trafficLoadGbps: trafficLoad,
    excludeMicrowave,
    excludeSrlg,
    strictEncryption,
    latencyData,
    latencySavingsPercent,
    headroomGbps,
    status,
    statusClass
  };
}

/**
 * Calculate multi-plane aggregate metrics across all Shahdara Flex-Algos.
 */
export function calculateFlexAlgoMetrics(state = {}, options = {}) {
  const algos = SHAHDARA_FLEX_ALGOS;
  const currentDynamics = calculateFlexAlgoDynamics(null, options);

  let totalCapacityGbps = 0;
  let totalRevenuePkr = 0;
  let totalSubscribers = 0;

  algos.forEach(a => {
    totalCapacityGbps += a.capacityGbps;
    totalRevenuePkr += a.monthlyRevenuePkr;
    totalSubscribers += a.subscribersCount;
  });

  const avgLatencySavings = Number(
    (algos.filter(a => a.id > 0).reduce((acc, a) => acc + calculateFlexAlgoLatencyReduction(a.baselineLatencyMs, a.defaultSpfLatencyMs), 0) / (algos.length - 1)).toFixed(1)
  );

  return {
    totalPlanes: algos.length,
    totalCapacityGbps,
    totalRevenuePkr,
    totalSubscribers,
    avgLatencySavings,
    currentDynamics
  };
}

/**
 * Pure-vector SVG visualizer for Multi-Plane Flex-Algo Topology and Path Routing.
 */
export function renderFlexAlgoDiagramSvg(dynamics, options = {}) {
  const d = dynamics || calculateFlexAlgoDynamics();
  const a = d.algo;
  const isDark = Boolean(options.isDark);

  const bg = isDark ? '#0f172a' : '#ffffff';
  const textMain = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? '#334155' : '#e2e8f0';

  // Plane styling colors
  const planeColors = {
    128: '#8b5cf6', // Purple - Low Latency
    129: '#06b6d4', // Cyan - High Throughput
    130: '#10b981', // Emerald - SRLG Disjoint
    131: '#eab308', // Amber - Solar Green
    0:   '#f97316'  // Orange - Default IGP
  };

  const primaryCol = planeColors[a.id] || '#6366f1';

  const width = 800;
  const height = 400;

  // Node graph coordinates across Shahdara geography
  const nodeMap = {
    'Baradari-Core': { x: 120, y: 150, name: 'Baradari' },
    'TownHall-Optical': { x: 300, y: 100, name: 'Town Hall' },
    'TownHall-SolarHub': { x: 300, y: 100, name: 'Town Hall' },
    'Duct-Underground-01': { x: 300, y: 220, name: 'UG Duct' },
    'BegumKot-Edge': { x: 680, y: 150, name: 'Begum Kot' },
    'BegumKot-SolarHub': { x: 680, y: 150, name: 'Begum Kot' },
    'JiaMusa-BNG': { x: 260, y: 260, name: 'Jia Musa' },
    'RaviSiphon-Express': { x: 520, y: 100, name: 'Ravi Siphon' },
    'VandalaClinic-Edge': { x: 500, y: 240, name: 'Vandala Rd' }
  };

  // Build path polyline points
  const pathPoints = (a.nodes || []).map(n => nodeMap[n] ? `${nodeMap[n].x},${nodeMap[n].y}` : null).filter(Boolean);
  const pathD = pathPoints.length > 0 ? `M ${pathPoints.join(' L ')}` : '';

  // Node markers
  let nodesMarkup = '';
  Object.keys(nodeMap).forEach(key => {
    const node = nodeMap[key];
    const isInPath = a.nodes && a.nodes.includes(key);
    const fill = isInPath ? primaryCol : (isDark ? '#334155' : '#cbd5e1');
    const radius = isInPath ? 14 : 9;

    nodesMarkup += `
      <g transform="translate(${node.x}, ${node.y})">
        <circle cx="0" cy="0" r="${radius}" fill="${fill}" stroke="${textMain}" stroke-width="${isInPath ? 2.5 : 1.5}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"/>
        ${isInPath ? `<circle cx="0" cy="0" r="${radius + 5}" fill="none" stroke="${primaryCol}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.7"/>` : ''}
        <text x="0" y="${radius + 16}" font-family="system-ui, sans-serif" font-size="10.5" font-weight="${isInPath ? '700' : '500'}" fill="${isInPath ? textMain : textMuted}" text-anchor="middle">${node.name}</text>
      </g>
    `;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="flex-algo-svg" style="background:${bg}; border-radius:12px; width:100%; height:auto;">
      <!-- Title & Status Ribbon -->
      <text x="40" y="34" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="${textMain}">${a.name}</text>
      <rect x="${width - 240}" y="18" width="200" height="24" rx="12" fill="${d.statusClass === 'optimal' ? '#10b98120' : (d.statusClass === 'critical' ? '#ef444420' : '#f59e0b20')}"/>
      <circle cx="${width - 226}" cy="30" r="5" fill="${d.statusClass === 'optimal' ? '#10b981' : (d.statusClass === 'critical' ? '#ef4444' : '#f59e0b')}"/>
      <text x="${width - 214}" y="34" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${d.statusClass === 'optimal' ? '#10b981' : (d.statusClass === 'critical' ? '#ef4444' : '#f59e0b')}">${d.status.split('(')[0].trim()}</text>

      <!-- Multi-Plane Navigation Strip -->
      <g transform="translate(40, 56)">
        <rect x="0" y="0" width="${width - 80}" height="32" rx="6" fill="${isDark ? '#1e293b' : '#f1f5f9'}"/>
        <text x="16" y="20" font-family="system-ui, sans-serif" font-size="10.5" fill="${textMuted}">FAD LOCATOR: <tspan font-family="monospace" font-weight="700" fill="${primaryCol}">${a.srv6Locator}</tspan> | METRIC: <tspan font-weight="700" fill="${textMain}">${a.metricType.split('(')[0].trim()}</tspan> | SRLG EXCLUSION: <tspan font-weight="700" fill="${d.excludeSrlg ? '#10b981' : textMuted}">${d.excludeSrlg ? 'ACTIVE' : 'OFF'}</tspan></text>
      </g>

      <!-- Background Mesh Lines (Default IGP Topology) -->
      <g stroke="${borderCol}" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.6">
        <line x1="120" y1="150" x2="300" y2="100"/>
        <line x1="300" y1="100" x2="520" y2="100"/>
        <line x1="520" y1="100" x2="680" y2="150"/>
        <line x1="120" y1="150" x2="260" y2="260"/>
        <line x1="260" y1="260" x2="500" y2="240"/>
        <line x1="500" y1="240" x2="680" y2="150"/>
        <line x1="120" y1="150" x2="300" y2="220"/>
        <line x1="300" y1="220" x2="500" y2="240"/>
      </g>

      <!-- Active Flex-Algo Computed SPF Path -->
      ${pathD ? `<path d="${pathD}" fill="none" stroke="${primaryCol}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" filter="drop-shadow(0 2px 6px ${primaryCol}40)"/>` : ''}

      <!-- Nodes Layer -->
      ${nodesMarkup}

      <!-- Bottom Telemetry HUD Ribbon -->
      <g transform="translate(40, 314)">
        <rect x="0" y="0" width="${width - 80}" height="70" rx="8" fill="${isDark ? '#1e293b' : '#f8fafc'}" stroke="${borderCol}" stroke-width="1"/>

        <!-- Cell 1: Path Latency -->
        <text x="20" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${textMuted}">FLEX-ALGO LATENCY</text>
        <text x="20" y="46" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="${primaryCol}">${d.latencyData.pathLatencyMs} ms</text>
        <text x="20" y="59" font-family="system-ui, sans-serif" font-size="8.5" fill="${textMuted}">SPF: ${a.defaultSpfLatencyMs} ms (${d.latencySavingsPercent}% faster)</text>

        <!-- Cell 2: SRLG Disjointness -->
        <text x="240" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${textMuted}">SRLG PROTECTION</text>
        <text x="240" y="46" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${a.srlgExclusionApplied ? '#10b981' : '#f59e0b'}">${a.srlgExclusionApplied ? 'Disjoint Protected' : 'Shared Risk Common'}</text>
        <text x="240" y="59" font-family="system-ui, sans-serif" font-size="8.5" fill="${textMuted}">${a.excludedLinks.length} excluded risky spans</text>

        <!-- Cell 3: Throughput Headroom -->
        <text x="440" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${textMuted}">PLANE HEADROOM</text>
        <text x="440" y="46" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${textMain}">${d.headroomGbps} / ${a.capacityGbps} Gbps</text>
        <text x="440" y="59" font-family="system-ui, sans-serif" font-size="8.5" fill="${textMuted}">Load: ${d.trafficLoadGbps} Gbps (${d.latencyData.loadRatio}%)</text>

        <!-- Cell 4: Recurring Revenue -->
        <text x="610" y="24" font-family="system-ui, sans-serif" font-size="9.5" fill="${textMuted}">PLANE REVENUE</text>
        <text x="610" y="46" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${textMain}">${formatPKR(a.monthlyRevenuePkr)}</text>
        <text x="610" y="59" font-family="system-ui, sans-serif" font-size="8.5" fill="${textMuted}">${a.subscribersCount} Enterprise Accounts</text>
      </g>
    </svg>
  `;
}

/**
 * Generate formatted ASCII audit report for Flex-Algo telemetry.
 */
export function generateFlexAlgoReport(dynamics, options = {}) {
  const d = dynamics || calculateFlexAlgoDynamics();
  const a = d.algo;

  const lines = [
    '================================================================================',
    '    SHAHDARA CARRIER METRO NETWORK - FLEXIBLE ALGORITHM (RFC 9350) REPORT      ',
    '================================================================================',
    `Date & Time        : ${new Date().toISOString()}`,
    `Algorithm ID (FAD) : Flex-Algo ${a.id}`,
    `Plane Description  : ${a.name}`,
    `Calculation Type   : Type ${a.calculationType} (Dijkstra Shortest Path First)`,
    `Optimization Metric: ${a.metricType}`,
    `SRv6 FAD Locator   : ${a.srv6Locator}`,
    `Carrier Span       : ${a.primaryArea} -> ${a.targetArea}`,
    `Monthly Recurring  : ${formatPKR(a.monthlyRevenuePkr)} (${a.subscribersCount} Subscribers)`,
    '--------------------------------------------------------------------------------',
    'CALCULATED PATH TELEMETRY & LATENCY SAVINGS:',
    `  Path Latency           : ${d.latencyData.pathLatencyMs} ms`,
    `  Queuing Delay Added    : ${d.latencyData.queuingDelayMs} ms (Traffic: ${d.trafficLoadGbps} / ${a.capacityGbps} Gbps)`,
    `  Default SPF Latency    : ${a.defaultSpfLatencyMs} ms`,
    `  Latency Reduction      : ${d.latencySavingsPercent}% faster than default IGP plane`,
    `  Available Headroom     : ${d.headroomGbps} Gbps (${d.latencyData.loadRatio}% utilized)`,
    `  Forwarding Health      : ${d.status}`,
    '--------------------------------------------------------------------------------',
    'SRLG CONSTRAINTS & EXCLUDED RISKY SPANS:',
    `  SRLG Disjoint Protection : ${d.excludeSrlg ? 'Enabled' : 'Disabled'}`,
    `  Microwave Radio Bypass  : ${d.excludeMicrowave ? 'Active (Rain fade zeroed)' : 'Inactive'}`,
    `  Strict MACsec Encrypted : ${d.strictEncryption ? 'Enforced' : 'Unrestricted'}`,
    ...(a.excludedLinks.length > 0
      ? a.excludedLinks.map((link, idx) => `  [Excluded Link ${idx + 1}] ${link}`)
      : ['  No link exclusion constraints configured.']),
    '--------------------------------------------------------------------------------',
    'COMPUTED HOP NODES IN FLEX-ALGO TOPOLOGY:',
    ...(a.nodes || []).map((node, idx) => `  [Hop ${idx + 1}] ${node}`),
    '================================================================================'
  ];

  return lines.join('\n');
}

/**
 * Export Flex-Algo telemetry snapshot to JSON string.
 */
export function exportFlexAlgoJson(dynamics) {
  const d = dynamics || calculateFlexAlgoDynamics();
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    standard: 'IETF RFC 9350 / RFC 9351',
    algo: d.algo,
    telemetry: {
      trafficLoadGbps: d.trafficLoadGbps,
      headroomGbps: d.headroomGbps,
      pathLatencyMs: d.latencyData.pathLatencyMs,
      defaultSpfLatencyMs: d.algo.defaultSpfLatencyMs,
      latencySavingsPercent: d.latencySavingsPercent,
      excludeMicrowave: d.excludeMicrowave,
      excludeSrlg: d.excludeSrlg,
      strictEncryption: d.strictEncryption,
      status: d.status
    }
  }, null, 2);
}

/**
 * Export Flex-Algo telemetry snapshot to CSV string.
 */
export function exportFlexAlgoCsv(dynamics) {
  const d = dynamics || calculateFlexAlgoDynamics();
  const a = d.algo;

  const headers = [
    'AlgoId',
    'Name',
    'MetricType',
    'Srv6Locator',
    'PrimaryArea',
    'TargetArea',
    'PathLatencyMs',
    'DefaultSpfLatencyMs',
    'LatencySavingsPercent',
    'CapacityGbps',
    'TrafficLoadGbps',
    'HeadroomGbps',
    'SrlgProtected',
    'Status',
    'MonthlyRevenuePkr'
  ];

  const row = [
    a.id,
    `"${a.name}"`,
    `"${a.metricType}"`,
    `"${a.srv6Locator}"`,
    `"${a.primaryArea}"`,
    `"${a.targetArea}"`,
    d.latencyData.pathLatencyMs,
    a.defaultSpfLatencyMs,
    d.latencySavingsPercent,
    a.capacityGbps,
    d.trafficLoadGbps,
    d.headroomGbps,
    a.srlgExclusionApplied ? 'true' : 'false',
    `"${d.status}"`,
    a.monthlyRevenuePkr
  ];

  return headers.join(',') + '\n' + row.join(',');
}

/**
 * Modal and dashboard card UI controller for Flex-Algo Matrix.
 */
export function setupFlexAlgoModal(state = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardFlexAlgoModal');
  const openBtn = doc.getElementById('dashboardOpenFlexAlgoModalBtn');
  const closeBtn = doc.getElementById('dashboardFlexAlgoModalCloseBtn');

  const cardChart = doc.getElementById('dashboardFlexAlgoChart');
  const modalDiagram = doc.getElementById('flexAlgoModalDiagramContainer');

  const algoSelect = doc.getElementById('flexAlgoSelect');
  const loadSlider = doc.getElementById('flexAlgoLoadSlider');
  const loadLabel = doc.getElementById('flexAlgoLoadLabel');
  const srlgToggle = doc.getElementById('flexAlgoSrlgToggle');
  const microwaveToggle = doc.getElementById('flexAlgoMicrowaveToggle');
  const resetBtn = doc.getElementById('flexAlgoResetBtn');

  // Stats in modal
  const statStatus = doc.getElementById('flexAlgoStatStatus');
  const statLatency = doc.getElementById('flexAlgoStatLatency');
  const statSavings = doc.getElementById('flexAlgoStatSavings');
  const statHeadroom = doc.getElementById('flexAlgoStatHeadroom');
  const statSrlg = doc.getElementById('flexAlgoStatSrlg');
  const statCapacity = doc.getElementById('flexAlgoStatCapacity');

  // Action buttons
  const filterAreaBtn = doc.getElementById('flexAlgoFilterAreaBtn');
  const exportJsonBtn = doc.getElementById('flexAlgoExportJsonBtn');
  const exportCsvBtn = doc.getElementById('flexAlgoExportCsvBtn');
  const copyReportBtn = doc.getElementById('flexAlgoCopyReportBtn');

  function renderView() {
    const isDark = doc.documentElement && doc.documentElement.getAttribute('data-theme') === 'dark';
    const dyn = calculateFlexAlgoDynamics();

    // Render SVG into card
    if (cardChart) {
      cardChart.innerHTML = renderFlexAlgoDiagramSvg(dyn, { isDark });
    }

    // Render SVG into modal
    if (modalDiagram) {
      modalDiagram.innerHTML = renderFlexAlgoDiagramSvg(dyn, { isDark });
    }

    // Update modal stat HUD
    if (statStatus) {
      statStatus.textContent = dyn.status.split('(')[0].trim();
      statStatus.className = 'flex-algo-stat-val ' + dyn.statusClass;
    }
    if (statLatency) {
      statLatency.textContent = `${dyn.latencyData.pathLatencyMs} ms`;
    }
    if (statSavings) {
      statSavings.textContent = `${dyn.latencySavingsPercent}% vs SPF`;
    }
    if (statHeadroom) {
      statHeadroom.textContent = `${dyn.headroomGbps} Gbps`;
      statHeadroom.style.color = dyn.headroomGbps > 0 ? 'var(--color-success, #10b981)' : 'var(--color-danger, #ef4444)';
    }
    if (statSrlg) {
      statSrlg.textContent = dyn.algo.srlgExclusionApplied ? 'Disjoint Protected' : 'Shared Risk';
    }
    if (statCapacity) {
      statCapacity.textContent = `${dyn.algo.capacityGbps} Gbps`;
    }

    // Labels
    if (loadLabel && loadSlider) {
      loadLabel.textContent = `${loadSlider.value} Gbps`;
    }
  }

  // Event handlers
  if (algoSelect) {
    algoSelect.addEventListener('change', () => {
      setFlexAlgoSelectedId(algoSelect.value);
      renderView();
    });
  }

  if (loadSlider) {
    loadSlider.addEventListener('input', () => {
      setFlexAlgoTrafficLoadGbps(loadSlider.value);
      renderView();
    });
  }

  if (srlgToggle) {
    srlgToggle.addEventListener('change', () => {
      setFlexAlgoExcludeSrlg(srlgToggle.checked);
      renderView();
    });
  }

  if (microwaveToggle) {
    microwaveToggle.addEventListener('change', () => {
      setFlexAlgoExcludeMicrowave(microwaveToggle.checked);
      renderView();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetFlexAlgoSimState();
      if (algoSelect) algoSelect.value = getFlexAlgoSelectedId();
      if (loadSlider) loadSlider.value = getFlexAlgoTrafficLoadGbps();
      if (srlgToggle) srlgToggle.checked = getFlexAlgoExcludeSrlg();
      if (microwaveToggle) microwaveToggle.checked = getFlexAlgoExcludeMicrowave();
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Flex-Algo parameters reset to baseline');
      }
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const dyn = calculateFlexAlgoDynamics();
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(dyn.algo.primaryArea);
      }
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const jsonStr = exportFlexAlgoJson();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(jsonStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Flex-Algo JSON telemetry copied to clipboard');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csvStr = exportFlexAlgoCsv();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(csvStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Flex-Algo CSV telemetry copied to clipboard');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const report = generateFlexAlgoReport();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(report);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Flex-Algo RFC 9350 audit report copied to clipboard');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      if (algoSelect) algoSelect.value = getFlexAlgoSelectedId();
      if (loadSlider) loadSlider.value = getFlexAlgoTrafficLoadGbps();
      if (srlgToggle) srlgToggle.checked = getFlexAlgoExcludeSrlg();
      if (microwaveToggle) microwaveToggle.checked = getFlexAlgoExcludeMicrowave();
      renderView();
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

  // Initial draw
  renderView();

  return {
    open: () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
        renderView();
      }
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    render: renderView
  };
}
