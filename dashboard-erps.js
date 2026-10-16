import { formatPKR } from './core.js';

/**
 * Metro Ethernet Ring Protection Switching (ITU-T G.8032 / Y.1344 ERPS v1/v2) Matrix
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Sub-50ms Ring Protection & Carrier Telemetry
 */

export const ERPS_CONSTANTS = {
  DEFAULT_RING_ID: 'shahdara-central-baradari',
  SPEED_OF_LIGHT_KM_S: 299792.458,
  SILICA_REFRACTIVE_INDEX: 1.4682, // Standard SMF-28 silica core
  MICROSEC_PER_KM: 4.897, // (1.4682 / 299792.458) * 1e6 us/km
  TRANSIT_NODE_DELAY_US: 2.5, // Per-switch frame transit processing delay
  RAPS_GEN_DELAY_MS: 0.5, // Hardware R-APS generation delay
  DEFAULT_WTR_MINUTES: 5,
  DEFAULT_GUARD_MS: 500,
  DEFAULT_HOLDOFF_MS: 0,
  BENCHMARK_MAX_SWITCHOVER_MS: 50.0,

  DETECTION_MODES: {
    HARDWARE_LOS: {
      id: 'los',
      label: 'Hardware Loss of Signal (LOS / Transceiver SF)',
      detectionTimeMs: 0.8
    },
    CFM_3_3MS_CCM: {
      id: 'cfm-3.3ms',
      label: 'IEEE 802.1ag / ITU-T Y.1731 CFM (3.3ms CCM x 3)',
      detectionTimeMs: 10.0
    },
    CFM_10MS_CCM: {
      id: 'cfm-10ms',
      label: 'IEEE 802.1ag CFM (10ms CCM x 3)',
      detectionTimeMs: 30.0
    }
  },

  STATES: {
    IDLE: 'IDLE',
    PROTECTION: 'PROTECTION',
    PENDING: 'PENDING',
    MANUAL_SWITCH: 'MANUAL_SWITCH'
  },

  NODE_ROLES: {
    RPL_OWNER: 'RPL Owner',
    RPL_NEIGHBOR: 'RPL Neighbor',
    TRANSIT: 'Transit Node'
  }
};

export const SHAHDARA_ERPS_RINGS = [
  {
    id: 'shahdara-central-baradari',
    name: 'Shahdara Central Baradari Metro Ring',
    primaryArea: 'Baradari',
    secondaryAreas: ['Shahdara Town', 'Ravi Siphon'],
    totalCircumferenceKm: 14.2,
    lineRateGbps: 10,
    offeredLoadPct: 68,
    activeFdbEntries: 12500,
    rplSpanIndex: 0, // Span between Node 0 and Node 1
    detectionMode: 'los',
    nodes: [
      { id: 'NODE-01', name: 'Baradari Core OLT', role: 'RPL Owner', area: 'Baradari', fdbCount: 3200 },
      { id: 'NODE-02', name: 'Ring Hub-02', role: 'RPL Neighbor', area: 'Baradari', fdbCount: 2400 },
      { id: 'NODE-03', name: 'Town Central Switch', role: 'Transit Node', area: 'Shahdara Town', fdbCount: 2100 },
      { id: 'NODE-04', name: 'Commercial Plaza Agg', role: 'Transit Node', area: 'Shahdara Town', fdbCount: 1900 },
      { id: 'NODE-05', name: 'Siphon Cross Junction', role: 'Transit Node', area: 'Ravi Siphon', fdbCount: 1500 },
      { id: 'NODE-06', name: 'Sub-FAT East Gateway', role: 'Transit Node', area: 'Baradari', fdbCount: 1400 }
    ],
    spans: [
      { id: 'SPAN-01', fromNode: 'NODE-01', toNode: 'NODE-02', lengthKm: 2.1, isRpl: true, label: 'Baradari Core - Hub-02 (RPL)' },
      { id: 'SPAN-02', fromNode: 'NODE-02', toNode: 'NODE-03', lengthKm: 2.6, isRpl: false, label: 'Hub-02 - Town Central' },
      { id: 'SPAN-03', fromNode: 'NODE-03', toNode: 'NODE-04', lengthKm: 1.9, isRpl: false, label: 'Town Central - Plaza Agg' },
      { id: 'SPAN-04', fromNode: 'NODE-04', toNode: 'NODE-05', lengthKm: 3.4, isRpl: false, label: 'Plaza Agg - Siphon Junction' },
      { id: 'SPAN-05', fromNode: 'NODE-05', toNode: 'NODE-06', lengthKm: 2.3, isRpl: false, label: 'Siphon Junction - Sub-FAT East' },
      { id: 'SPAN-06', fromNode: 'NODE-06', toNode: 'NODE-01', lengthKm: 1.9, isRpl: false, label: 'Sub-FAT East - Baradari Core' }
    ],
    subscribersCount: 420,
    monthlyRevenuePkr: 1480000
  },
  {
    id: 'jia-musa-plaza-ring',
    name: 'Jia Musa Commercial Plaza Ring',
    primaryArea: 'Jia Musa',
    secondaryAreas: ['Vandala Road', 'Shahdara Town'],
    totalCircumferenceKm: 8.6,
    lineRateGbps: 10,
    offeredLoadPct: 75,
    activeFdbEntries: 8200,
    rplSpanIndex: 0,
    detectionMode: 'cfm-3.3ms',
    nodes: [
      { id: 'JM-01', name: 'Plaza Core Switch', role: 'RPL Owner', area: 'Jia Musa', fdbCount: 2800 },
      { id: 'JM-02', name: 'East Commercial Hub', role: 'RPL Neighbor', area: 'Jia Musa', fdbCount: 2100 },
      { id: 'JM-03', name: 'North Plaza Dist', role: 'Transit Node', area: 'Jia Musa', fdbCount: 1800 },
      { id: 'JM-04', name: 'Market Square Switch', role: 'Transit Node', area: 'Vandala Road', fdbCount: 1500 }
    ],
    spans: [
      { id: 'SPAN-JM-01', fromNode: 'JM-01', toNode: 'JM-02', lengthKm: 1.8, isRpl: true, label: 'Plaza Core - East Hub (RPL)' },
      { id: 'SPAN-JM-02', fromNode: 'JM-02', toNode: 'JM-03', lengthKm: 2.2, isRpl: false, label: 'East Hub - North Dist' },
      { id: 'SPAN-JM-03', fromNode: 'JM-03', toNode: 'JM-04', lengthKm: 2.5, isRpl: false, label: 'North Dist - Market Square' },
      { id: 'SPAN-JM-04', fromNode: 'JM-04', toNode: 'JM-01', lengthKm: 2.1, isRpl: false, label: 'Market Square - Plaza Core' }
    ],
    subscribersCount: 310,
    monthlyRevenuePkr: 1085000
  },
  {
    id: 'begum-kot-industrial-ring',
    name: 'Begum Kot Industrial & Feeder Ring',
    primaryArea: 'Begum Kot',
    secondaryAreas: ['Kala Khatai Road', 'Baradari'],
    totalCircumferenceKm: 11.4,
    lineRateGbps: 10,
    offeredLoadPct: 62,
    activeFdbEntries: 9400,
    rplSpanIndex: 0,
    detectionMode: 'los',
    nodes: [
      { id: 'BK-01', name: 'Begum Kot Main Agg', role: 'RPL Owner', area: 'Begum Kot', fdbCount: 3100 },
      { id: 'BK-02', name: 'Mill Feeder-02', role: 'RPL Neighbor', area: 'Begum Kot', fdbCount: 2200 },
      { id: 'BK-03', name: 'Grid Substation-03', role: 'Transit Node', area: 'Begum Kot', fdbCount: 1600 },
      { id: 'BK-04', name: 'Industrial Zone Hub', role: 'Transit Node', area: 'Begum Kot', fdbCount: 1400 },
      { id: 'BK-05', name: 'Kala Khatai Junction', role: 'Transit Node', area: 'Kala Khatai Road', fdbCount: 1100 }
    ],
    spans: [
      { id: 'SPAN-BK-01', fromNode: 'BK-01', toNode: 'BK-02', lengthKm: 2.4, isRpl: true, label: 'BK Main - Mill Feeder (RPL)' },
      { id: 'SPAN-BK-02', fromNode: 'BK-02', toNode: 'BK-03', lengthKm: 2.1, isRpl: false, label: 'Mill Feeder - Grid Substation' },
      { id: 'SPAN-BK-03', fromNode: 'BK-03', toNode: 'BK-04', lengthKm: 2.7, isRpl: false, label: 'Grid Substation - Industrial Hub' },
      { id: 'SPAN-BK-04', fromNode: 'BK-04', toNode: 'BK-05', lengthKm: 2.3, isRpl: false, label: 'Industrial Hub - Kala Khatai' },
      { id: 'SPAN-BK-05', fromNode: 'BK-05', toNode: 'BK-01', lengthKm: 1.9, isRpl: false, label: 'Kala Khatai - BK Main' }
    ],
    subscribersCount: 260,
    monthlyRevenuePkr: 950000
  },
  {
    id: 'ravi-siphon-aerial-ring',
    name: 'Ravi Siphon River Crossing High-Span Ring',
    primaryArea: 'Ravi Siphon',
    secondaryAreas: ['Shahdara Town', 'Baradari'],
    totalCircumferenceKm: 18.2,
    lineRateGbps: 10,
    offeredLoadPct: 54,
    activeFdbEntries: 6100,
    rplSpanIndex: 0,
    detectionMode: 'los',
    nodes: [
      { id: 'RS-01', name: 'Siphon North Tower', role: 'RPL Owner', area: 'Ravi Siphon', fdbCount: 2200 },
      { id: 'RS-02', name: 'Siphon South Bridge', role: 'RPL Neighbor', area: 'Ravi Siphon', fdbCount: 1700 },
      { id: 'RS-03', name: 'River Bank Repeater', role: 'Transit Node', area: 'Ravi Siphon', fdbCount: 1200 },
      { id: 'RS-04', name: 'West Bund Hub', role: 'Transit Node', area: 'Shahdara Town', fdbCount: 1000 }
    ],
    spans: [
      { id: 'SPAN-RS-01', fromNode: 'RS-01', toNode: 'RS-02', lengthKm: 3.5, isRpl: true, label: 'North Tower - South Bridge (RPL Aerial)' },
      { id: 'SPAN-RS-02', fromNode: 'RS-02', toNode: 'RS-03', lengthKm: 4.8, isRpl: false, label: 'South Bridge - River Repeater' },
      { id: 'SPAN-RS-03', fromNode: 'RS-03', toNode: 'RS-04', lengthKm: 5.1, isRpl: false, label: 'River Repeater - West Bund' },
      { id: 'SPAN-RS-04', fromNode: 'RS-04', toNode: 'RS-01', lengthKm: 4.8, isRpl: false, label: 'West Bund - North Tower' }
    ],
    subscribersCount: 180,
    monthlyRevenuePkr: 680000
  },
  {
    id: 'vandala-road-olt-ring',
    name: 'Vandala Road OLT Aggregation Ring',
    primaryArea: 'Vandala Road',
    secondaryAreas: ['Jia Musa', 'Shahdara Town'],
    totalCircumferenceKm: 22.8,
    lineRateGbps: 10,
    offeredLoadPct: 78,
    activeFdbEntries: 16800,
    rplSpanIndex: 0,
    detectionMode: 'cfm-3.3ms',
    nodes: [
      { id: 'VR-01', name: 'Vandala Central OLT', role: 'RPL Owner', area: 'Vandala Road', fdbCount: 4200 },
      { id: 'VR-02', name: 'West Ring Hub', role: 'RPL Neighbor', area: 'Vandala Road', fdbCount: 3100 },
      { id: 'VR-03', name: 'Transit Switch-03', role: 'Transit Node', area: 'Vandala Road', fdbCount: 2200 },
      { id: 'VR-04', name: 'School Road Node', role: 'Transit Node', area: 'Vandala Road', fdbCount: 1800 },
      { id: 'VR-05', name: 'Main Bazaar Node', role: 'Transit Node', area: 'Vandala Road', fdbCount: 1600 },
      { id: 'VR-06', name: 'Rachna Town Feeder', role: 'Transit Node', area: 'Rachna Town', fdbCount: 1500 },
      { id: 'VR-07', name: 'Station Road Node', role: 'Transit Node', area: 'Vandala Road', fdbCount: 1300 },
      { id: 'VR-08', name: 'South East Dist', role: 'Transit Node', area: 'Jia Musa', fdbCount: 1100 }
    ],
    spans: [
      { id: 'SPAN-VR-01', fromNode: 'VR-01', toNode: 'VR-02', lengthKm: 2.9, isRpl: true, label: 'Vandala Central - West Hub (RPL)' },
      { id: 'SPAN-VR-02', fromNode: 'VR-02', toNode: 'VR-03', lengthKm: 2.4, isRpl: false, label: 'West Hub - Transit-03' },
      { id: 'SPAN-VR-03', fromNode: 'VR-03', toNode: 'VR-04', lengthKm: 3.1, isRpl: false, label: 'Transit-03 - School Road' },
      { id: 'SPAN-VR-04', fromNode: 'VR-04', toNode: 'VR-05', lengthKm: 2.6, isRpl: false, label: 'School Road - Main Bazaar' },
      { id: 'SPAN-VR-05', fromNode: 'VR-05', toNode: 'VR-06', lengthKm: 3.5, isRpl: false, label: 'Main Bazaar - Rachna Town' },
      { id: 'SPAN-VR-06', fromNode: 'VR-06', toNode: 'VR-07', lengthKm: 2.8, isRpl: false, label: 'Rachna Town - Station Road' },
      { id: 'SPAN-VR-07', fromNode: 'VR-07', toNode: 'VR-08', lengthKm: 2.7, isRpl: false, label: 'Station Road - South East' },
      { id: 'SPAN-VR-08', fromNode: 'VR-08', toNode: 'VR-01', lengthKm: 2.8, isRpl: false, label: 'South East - Vandala Central' }
    ],
    subscribersCount: 580,
    monthlyRevenuePkr: 1960000
  }
];

/**
 * Calculates ERPS protection switching dynamics, delays, and ITU-T G.8032 compliance
 * @param {Object} ringConfig - Ring topology definition
 * @param {Object} options - Simulation parameters (failedSpanId, detectionMode, currentState, wtrMinutes)
 * @returns {Object} Calculated ERPS dynamics
 */
export function calculateErpsDynamics(ringConfig, options = {}) {
  const ring = ringConfig || SHAHDARA_ERPS_RINGS[0];
  const failedSpanId = options.failedSpanId || null;
  const detectionModeKey = options.detectionMode || ring.detectionMode || 'los';
  const detConfig = ERPS_CONSTANTS.DETECTION_MODES[detectionModeKey.toUpperCase().replace(/[-.]/g, '_')]
    || Object.values(ERPS_CONSTANTS.DETECTION_MODES).find(m => m.id === detectionModeKey)
    || ERPS_CONSTANTS.DETECTION_MODES.HARDWARE_LOS;

  const wtrMinutes = typeof options.wtrMinutes === 'number' && options.wtrMinutes >= 1
    ? options.wtrMinutes
    : ERPS_CONSTANTS.DEFAULT_WTR_MINUTES;

  // Determine current operating state
  let currentState = ERPS_CONSTANTS.STATES.IDLE;
  if (options.forcedState) {
    currentState = options.forcedState;
  } else if (failedSpanId) {
    currentState = ERPS_CONSTANTS.STATES.PROTECTION;
  } else if (options.isPending) {
    currentState = ERPS_CONSTANTS.STATES.PENDING;
  }

  // Find failed span object if any
  const failedSpan = failedSpanId
    ? ring.spans.find(s => s.id === failedSpanId) || null
    : null;

  // 1. Defect Detection Time (t_detect)
  const tDetectMs = detConfig.detectionTimeMs;

  // 2. R-APS Message Generation Time (t_gen)
  const tGenMs = ERPS_CONSTANTS.RAPS_GEN_DELAY_MS;

  // 3. Propagation Time (t_prop)
  // One-way optical propagation along the worst-case circumference path
  const worstCaseFiberKm = ring.totalCircumferenceKm;
  const tPropMs = (worstCaseFiberKm * ERPS_CONSTANTS.MICROSEC_PER_KM) / 1000;

  // 4. Switch Processing Delay (t_proc)
  const nodeCount = ring.nodes.length;
  const tProcMs = (nodeCount * ERPS_CONSTANTS.TRANSIT_NODE_DELAY_US) / 1000;

  // 5. Hardware MAC Table FDB Flush Time (t_flush)
  // Unlearning stale MAC addresses to prevent traffic blackholing
  const fdbEntries = ring.activeFdbEntries || 10000;
  const tFlushMs = Math.min(6.0, Math.max(0.5, (fdbEntries * 0.04) / 1000));

  // 6. Total Switchover Time (T_switch)
  const tSwitchMs = +(tDetectMs + tGenMs + tPropMs + tProcMs + tFlushMs).toFixed(3);

  // ITU-T G.8032 Sub-50ms Benchmark Check
  let complianceStatus = 'PASS';
  let complianceLabel = 'Carrier Grade (<50ms)';
  let complianceColor = '#10b981'; // Emerald

  if (tSwitchMs > ERPS_CONSTANTS.BENCHMARK_MAX_SWITCHOVER_MS) {
    if (tSwitchMs <= 100.0) {
      complianceStatus = 'WARNING';
      complianceLabel = 'Degraded (>50ms)';
      complianceColor = '#f59e0b'; // Amber
    } else {
      complianceStatus = 'FAIL';
      complianceLabel = 'Non-Compliant (>100ms)';
      complianceColor = '#ef4444'; // Red
    }
  }

  // 7. Impact Assessment & Frame Loss
  const lineRateGbps = ring.lineRateGbps || 10;
  const offeredLoadPct = ring.offeredLoadPct || 65;
  const activeTrafficThroughputGbps = +(lineRateGbps * (offeredLoadPct / 100)).toFixed(2);

  // Frame loss during the outage window (T_switch)
  const lostMegabits = +((activeTrafficThroughputGbps * 1000) * (tSwitchMs / 1000)).toFixed(2);
  const avgFrameSizeBytes = 800; // Standard Internet blend (IMIX)
  const lostFramesCount = Math.round((lostMegabits * 1e6) / (avgFrameSizeBytes * 8));

  // RPL details
  const rplSpan = ring.spans.find(s => s.isRpl) || ring.spans[0];
  const rplStatus = currentState === ERPS_CONSTANTS.STATES.PROTECTION ? 'UNBLOCKED' : 'BLOCKED';
  const rplProtectionOverheadPct = +((rplSpan.lengthKm / ring.totalCircumferenceKm) * 100).toFixed(1);

  // Affected Subscribers & Monthly Revenue at risk during link cut
  const subscribersCount = ring.subscribersCount || 350;
  const monthlyRevenuePkr = ring.monthlyRevenuePkr || 1200000;

  return {
    ring,
    failedSpanId,
    failedSpan,
    currentState,
    detectionMode: detConfig,
    wtrMinutes,
    rplSpan,
    rplStatus,
    rplProtectionOverheadPct,

    // Timing breakdown
    timingBreakdown: {
      detectMs: +tDetectMs.toFixed(3),
      genMs: +tGenMs.toFixed(3),
      propMs: +tPropMs.toFixed(3),
      procMs: +tProcMs.toFixed(3),
      flushMs: +tFlushMs.toFixed(3),
      totalSwitchMs: tSwitchMs
    },

    // Compliance
    compliance: {
      status: complianceStatus,
      label: complianceLabel,
      color: complianceColor,
      isSub50ms: tSwitchMs <= ERPS_CONSTANTS.BENCHMARK_MAX_SWITCHOVER_MS,
      marginMs: +(ERPS_CONSTANTS.BENCHMARK_MAX_SWITCHOVER_MS - tSwitchMs).toFixed(3)
    },

    // Traffic telemetry
    activeTrafficThroughputGbps,
    lostMegabits,
    lostFramesCount,

    // Impact
    subscribersCount,
    monthlyRevenuePkr
  };
}

/**
 * Calculates aggregated ERPS metrics across all configured rings or the active selection
 * @param {Object} state - Application state (customers, payments)
 * @param {Object} params - Simulation parameters
 * @returns {Object} Aggregated metrics
 */
export function calculateErpsMetrics(state, params = {}) {
  const selectedRingId = params.ringId || ERPS_CONSTANTS.DEFAULT_RING_ID;
  const ring = SHAHDARA_ERPS_RINGS.find(r => r.id === selectedRingId) || SHAHDARA_ERPS_RINGS[0];

  const dynamics = calculateErpsDynamics(ring, params);

  // Calculate global portfolio statistics
  const totalRings = SHAHDARA_ERPS_RINGS.length;
  const totalRingKm = +SHAHDARA_ERPS_RINGS.reduce((sum, r) => sum + r.totalCircumferenceKm, 0).toFixed(1);
  const totalSubscribers = SHAHDARA_ERPS_RINGS.reduce((sum, r) => sum + r.subscribersCount, 0);
  const totalProtectedRevenuePkr = SHAHDARA_ERPS_RINGS.reduce((sum, r) => sum + r.monthlyRevenuePkr, 0);

  // Correlate with current customer ledger if provided
  let actualCustomersInArea = 0;
  if (state && Array.isArray(state.customers)) {
    const primary = ring.primaryArea.toLowerCase();
    const secondaries = (ring.secondaryAreas || []).map(a => a.toLowerCase());
    actualCustomersInArea = state.customers.filter(c => {
      if (c.archived) return false;
      const area = (c.area || '').toLowerCase();
      return area === primary || secondaries.includes(area);
    }).length;
  }

  return {
    selectedRingId,
    ring,
    dynamics,
    totalRings,
    totalRingKm,
    totalSubscribers,
    totalProtectedRevenuePkr,
    actualCustomersInArea
  };
}

/**
 * Pure-vector SVG visualizer for ITU-T G.8032 ERPS metro ring topology and sub-50ms timing budget
 * @param {Object} dynamics - Dynamics object returned by calculateErpsDynamics
 * @param {Object} options - Visual customization options (width, height, isDarkMode)
 * @returns {string} Pure SVG string
 */
export function renderErpsDiagramSvg(dynamics, options = {}) {
  const {
    ring,
    failedSpanId,
    currentState,
    rplSpan,
    rplStatus,
    timingBreakdown,
    compliance
  } = dynamics;

  const width = options.width || 760;
  const height = options.height || 440;
  const isDark = options.isDarkMode !== false;

  // Theme palettes
  const bg = isDark ? '#0f172a' : '#f8fafc';
  const surface = isDark ? '#1e293b' : '#ffffff';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? '#334155' : '#e2e8f0';

  const greenCol = '#10b981';
  const amberCol = '#f59e0b';
  const redCol = '#ef4444';
  const goldCol = '#fbbf24';
  const cyanCol = '#06b6d4';

  // Ring topology layout
  const nodes = ring.nodes || [];
  const nodeCount = nodes.length;
  const centerX = 230;
  const centerY = 205;
  const radius = 125;

  // Compute node coordinates in a circular layout
  const nodeCoords = nodes.map((node, i) => {
    // Start from top (-PI/2) and distribute clockwise
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / nodeCount;
    return {
      node,
      index: i,
      x: +(centerX + radius * Math.cos(angle)).toFixed(1),
      y: +(centerY + radius * Math.sin(angle)).toFixed(1),
      angle
    };
  });

  // Generate spans SVG lines
  const spansSvg = ring.spans.map(span => {
    const fromIndex = nodes.findIndex(n => n.id === span.fromNode);
    const toIndex = nodes.findIndex(n => n.id === span.toNode);
    if (fromIndex < 0 || toIndex < 0) return '';

    const p1 = nodeCoords[fromIndex];
    const p2 = nodeCoords[toIndex];

    const isFailed = failedSpanId === span.id;
    const isRpl = span.isRpl;

    let strokeCol = greenCol;
    let strokeWidth = 3;
    let strokeDash = 'none';
    let animationClass = '';
    let markerHtml = '';

    if (isFailed) {
      strokeCol = redCol;
      strokeWidth = 4;
      strokeDash = '6,4';
    } else if (isRpl) {
      if (rplStatus === 'BLOCKED') {
        strokeCol = goldCol;
        strokeWidth = 3.5;
        strokeDash = '8,5';
      } else {
        strokeCol = cyanCol;
        strokeWidth = 4;
        strokeDash = 'none';
      }
    }

    // Midpoint for badge / icon
    const midX = +((p1.x + p2.x) / 2).toFixed(1);
    const midY = +((p1.y + p2.y) / 2).toFixed(1);

    if (isFailed) {
      // Crimson jagged lightning break badge
      markerHtml = `
        <g transform="translate(${midX}, ${midY})">
          <circle r="13" fill="${redCol}" opacity="0.9" />
          <path d="M-2 -7 L3 -1 L0 0 L3 7 L-3 1 L0 0 Z" fill="#ffffff" />
          <text y="21" font-size="9" font-weight="700" fill="${redCol}" text-anchor="middle">SIGNAL FAIL</text>
        </g>
      `;
    } else if (isRpl) {
      // Lock icon for blocked RPL or Unlock icon for active RPL
      const lockFill = rplStatus === 'BLOCKED' ? goldCol : cyanCol;
      const lockIcon = rplStatus === 'BLOCKED'
        ? `<rect x="-5" y="-3" width="10" height="9" rx="2" fill="${surface}" stroke="${lockFill}" stroke-width="1.5" />
           <path d="M-3 -3 V-6 A3 3 0 0 1 3 -6 V-3" fill="none" stroke="${lockFill}" stroke-width="1.5" />`
        : `<rect x="-5" y="-3" width="10" height="9" rx="2" fill="${surface}" stroke="${lockFill}" stroke-width="1.5" />
           <path d="M-3 -3 V-6 A3 3 0 0 1 3 -6" fill="none" stroke="${lockFill}" stroke-width="1.5" />`;

      markerHtml = `
        <g transform="translate(${midX}, ${midY})">
          <circle r="12" fill="${surface}" stroke="${lockFill}" stroke-width="1.5" />
          ${lockIcon}
          <text y="20" font-size="9" font-weight="600" fill="${lockFill}" text-anchor="middle">RPL (${rplStatus})</text>
        </g>
      `;
    }

    return `
      <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"
            stroke="${strokeCol}" stroke-width="${strokeWidth}" stroke-dasharray="${strokeDash}"
            stroke-linecap="round" opacity="0.85" />
      ${markerHtml}
    `;
  }).join('');

  // Generate nodes SVG
  const nodesSvg = nodeCoords.map(item => {
    const { node, x, y } = item;
    const isOwner = node.role === ERPS_CONSTANTS.NODE_ROLES.RPL_OWNER;
    const isNeighbor = node.role === ERPS_CONSTANTS.NODE_ROLES.RPL_NEIGHBOR;

    let ringStroke = greenCol;
    let badgeText = 'TRANSIT';
    let badgeFill = textMuted;

    if (isOwner) {
      ringStroke = goldCol;
      badgeText = 'RPL OWNER';
      badgeFill = goldCol;
    } else if (isNeighbor) {
      ringStroke = cyanCol;
      badgeText = 'NEIGHBOR';
      badgeFill = cyanCol;
    }

    // Offset label away from center
    const labelAngle = item.angle;
    const labelDist = 28;
    const lx = +(x + labelDist * Math.cos(labelAngle)).toFixed(1);
    const ly = +(y + labelDist * Math.sin(labelAngle)).toFixed(1);

    return `
      <g class="erps-node" transform="translate(${x}, ${y})">
        <circle r="18" fill="${surface}" stroke="${ringStroke}" stroke-width="3" />
        <circle r="6" fill="${ringStroke}" />
        <text y="3" font-size="8.5" font-weight="700" fill="${textMain}" text-anchor="middle">${node.id.replace('NODE-', 'N')}</text>
      </g>
      <text x="${lx}" y="${ly}" font-size="9" font-weight="600" fill="${textMain}" text-anchor="middle">${node.name}</text>
      <text x="${lx}" y="${ly + 10}" font-size="7.5" font-weight="700" fill="${badgeFill}" text-anchor="middle">${badgeText}</text>
    `;
  }).join('');

  // Center Ring HUD
  let stateBg = greenCol;
  if (currentState === ERPS_CONSTANTS.STATES.PROTECTION) stateBg = redCol;
  if (currentState === ERPS_CONSTANTS.STATES.PENDING) stateBg = amberCol;

  const centerHud = `
    <g transform="translate(${centerX}, ${centerY})">
      <circle r="44" fill="${surface}" stroke="${borderCol}" stroke-width="1.5" />
      <rect x="-38" y="-30" width="76" height="18" rx="9" fill="${stateBg}" />
      <text y="-18" font-size="9.5" font-weight="800" fill="#ffffff" text-anchor="middle">${currentState}</text>
      <text y="2" font-size="13" font-weight="800" fill="${textMain}" text-anchor="middle">${timingBreakdown.totalSwitchMs} ms</text>
      <text y="14" font-size="8" font-weight="600" fill="${textMuted}" text-anchor="middle">Switch Time</text>
      <text y="26" font-size="7.5" font-weight="700" fill="${compliance.color}" text-anchor="middle">${compliance.label}</text>
    </g>
  `;

  // Timing Budget Breakdown Bar (Right Side Panel)
  const panelX = 460;
  const panelY = 40;
  const panelW = 275;
  const barY = 195;
  const barW = 250;
  const barH = 18;

  // Normalize timing breakdown components into bar fractions (max 60ms scale)
  const maxScaleMs = 60.0;
  const detectW = Math.max(4, +((timingBreakdown.detectMs / maxScaleMs) * barW).toFixed(1));
  const genW = Math.max(3, +((timingBreakdown.genMs / maxScaleMs) * barW).toFixed(1));
  const propW = Math.max(3, +((timingBreakdown.propMs / maxScaleMs) * barW).toFixed(1));
  const procW = Math.max(3, +((timingBreakdown.procMs / maxScaleMs) * barW).toFixed(1));
  const flushW = Math.max(4, +((timingBreakdown.flushMs / maxScaleMs) * barW).toFixed(1));

  // Benchmark 50ms line position on the bar
  const benchmarkX = panelX + (ERPS_CONSTANTS.BENCHMARK_MAX_SWITCHOVER_MS / maxScaleMs) * barW;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="erps-svg" role="img" aria-label="ITU-T G.8032 ERPS Metro Ring Topology and Sub-50ms Protection Switching Diagram">
      <defs>
        <linearGradient id="erpsGradSurface" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${surface}" />
          <stop offset="100%" stop-color="${surface}" stop-opacity="0.85" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" rx="10" fill="${bg}" />

      <!-- Ring Sub-panel Container -->
      <rect x="20" y="20" width="415" height="375" rx="8" fill="url(#erpsGradSurface)" stroke="${borderCol}" stroke-width="1" />
      <text x="35" y="42" font-size="12" font-weight="700" fill="${textMain}">${ring.name}</text>
      <text x="35" y="58" font-size="9" fill="${textMuted}">${ring.nodes.length} Nodes • ${ring.totalCircumferenceKm} km • ${ring.lineRateGbps}G • ${dynamics.subscribersCount} Subscribers</text>

      <!-- Ring Diagram Spans & Nodes -->
      ${spansSvg}
      ${centerHud}
      ${nodesSvg}

      <!-- Legend -->
      <g transform="translate(35, 370)">
        <line x1="0" y1="0" x2="16" y2="0" stroke="${greenCol}" stroke-width="3" />
        <text x="22" y="3" font-size="8.5" fill="${textMuted}">Normal Path</text>

        <line x1="90" y1="0" x2="106" y2="0" stroke="${goldCol}" stroke-width="3" stroke-dasharray="4,2" />
        <text x="112" y="3" font-size="8.5" fill="${textMuted}">RPL (Blocked)</text>

        <line x1="185" y1="0" x2="201" y2="0" stroke="${redCol}" stroke-width="3" stroke-dasharray="4,2" />
        <text x="207" y="3" font-size="8.5" fill="${textMuted}">Fiber Break (SF)</text>

        <line x1="290" y1="0" x2="306" y2="0" stroke="${cyanCol}" stroke-width="3" />
        <text x="312" y="3" font-size="8.5" fill="${textMuted}">RPL Unblocked</text>
      </g>

      <!-- Right Telemetry Panel -->
      <rect x="${panelX}" y="${panelY}" width="${panelW}" height="355" rx="8" fill="url(#erpsGradSurface)" stroke="${borderCol}" stroke-width="1" />
      <text x="${panelX + 15}" y="${panelY + 24}" font-size="12" font-weight="700" fill="${textMain}">ITU-T G.8032 Switchover Budget</text>
      <text x="${panelX + 15}" y="${panelY + 40}" font-size="9" fill="${textMuted}">Sub-50ms Protection Switching Budget</text>

      <!-- Status Metric Cards -->
      <g transform="translate(${panelX + 15}, ${panelY + 55})">
        <!-- Detection Mode -->
        <rect x="0" y="0" width="118" height="42" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <text x="8" y="14" font-size="8" fill="${textMuted}">Detection Mode</text>
        <text x="8" y="30" font-size="9.5" font-weight="700" fill="${textMain}">${dynamics.detectionMode.label.split(' ')[0]}</text>

        <!-- Compliance Margin -->
        <rect x="127" y="0" width="118" height="42" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <text x="135" y="14" font-size="8" fill="${textMuted}">Headroom Margin</text>
        <text x="135" y="30" font-size="10" font-weight="700" fill="${compliance.color}">${compliance.marginMs > 0 ? '+' : ''}${compliance.marginMs} ms</text>
      </g>

      <!-- Timing Breakdown Horizontal Stacked Bar -->
      <text x="${panelX + 15}" y="${barY - 8}" font-size="9.5" font-weight="700" fill="${textMain}">Latency Stack (${timingBreakdown.totalSwitchMs} ms / 50 ms max)</text>
      <rect x="${panelX + 15}" y="${barY}" width="${barW}" height="${barH}" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />

      <!-- Stack segments -->
      <rect x="${panelX + 15}" y="${barY}" width="${detectW}" height="${barH}" rx="3" fill="#3b82f6" />
      <rect x="${panelX + 15 + detectW}" y="${barY}" width="${genW}" height="${barH}" fill="#8b5cf6" />
      <rect x="${panelX + 15 + detectW + genW}" y="${barY}" width="${propW}" height="${barH}" fill="#06b6d4" />
      <rect x="${panelX + 15 + detectW + genW + propW}" y="${barY}" width="${procW}" height="${barH}" fill="#10b981" />
      <rect x="${panelX + 15 + detectW + genW + propW + procW}" y="${barY}" width="${flushW}" height="${barH}" rx="3" fill="#f59e0b" />

      <!-- Benchmark vertical mark at 50ms -->
      <line x1="${benchmarkX}" y1="${barY - 5}" x2="${benchmarkX}" y2="${barY + barH + 5}" stroke="${redCol}" stroke-width="1.8" stroke-dasharray="3,2" />
      <text x="${benchmarkX}" y="${barY + barH + 15}" font-size="7.5" font-weight="700" fill="${redCol}" text-anchor="middle">50ms Benchmark</text>

      <!-- Timing Stack Legend & Values -->
      <g transform="translate(${panelX + 15}, ${barY + 36})" font-size="8.5">
        <circle cx="5" cy="5" r="4" fill="#3b82f6" />
        <text x="14" y="8" fill="${textMain}">Fault Detect (t_det):</text>
        <text x="240" y="8" font-weight="700" fill="${textMain}" text-anchor="end">${timingBreakdown.detectMs} ms</text>

        <circle cx="5" cy="22" r="4" fill="#8b5cf6" />
        <text x="14" y="25" fill="${textMain}">R-APS Generation (t_gen):</text>
        <text x="240" y="25" font-weight="700" fill="${textMain}" text-anchor="end">${timingBreakdown.genMs} ms</text>

        <circle cx="5" cy="39" r="4" fill="#06b6d4" />
        <text x="14" y="42" fill="${textMain}">Optical Propagation (t_prop):</text>
        <text x="240" y="42" font-weight="700" fill="${textMain}" text-anchor="end">${timingBreakdown.propMs} ms</text>

        <circle cx="5" cy="56" r="4" fill="#10b981" />
        <text x="14" y="59" fill="${textMain}">Switch Transit (t_proc):</text>
        <text x="240" y="59" font-weight="700" fill="${textMain}" text-anchor="end">${timingBreakdown.procMs} ms</text>

        <circle cx="5" cy="73" r="4" fill="#f59e0b" />
        <text x="14" y="76" fill="${textMain}">MAC FDB Flush (t_flush):</text>
        <text x="240" y="76" font-weight="700" fill="${textMain}" text-anchor="end">${timingBreakdown.flushMs} ms</text>
      </g>

      <!-- Failover Impact Summary -->
      <g transform="translate(${panelX + 15}, 338)">
        <rect x="0" y="0" width="245" height="42" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <text x="10" y="15" font-size="8" fill="${textMuted}">Failover Data Loss Window</text>
        <text x="10" y="31" font-size="9.5" font-weight="700" fill="${amberCol}">${dynamics.lostMegabits} Mb (~${dynamics.lostFramesCount.toLocaleString()} frames)</text>
      </g>
    </svg>
  `;
}

/**
 * Generates formal text report for Metro Ethernet Ring Protection audit
 * @param {Object} metrics - Output of calculateErpsMetrics or calculateErpsDynamics
 * @returns {string} Formatted audit report text
 */
export function generateErpsReport(metrics) {
  const d = metrics.dynamics || metrics;
  const ring = d.ring;
  const t = d.timingBreakdown;
  const c = d.compliance;

  return `========================================================================
SHAHDARA ISP METRO OPTICAL NETWORK - ITU-T G.8032 ERPS AUDIT REPORT
========================================================================
Generated: ${new Date().toISOString()}
Standard: ITU-T G.8032 / Y.1344 (Ethernet Ring Protection Switching)

1. RING IDENTIFICATION & TOPOLOGY
------------------------------------------------------------------------
Ring Name:            ${ring.name}
Ring Identifier:      ${ring.id}
Coverage Area:        ${ring.primaryArea} (${(ring.secondaryAreas || []).join(', ')})
Total Circumference:  ${ring.totalCircumferenceKm} km (Silica SMF-28)
Node Count:           ${ring.nodes.length} Switches/OLTs
Physical Spans:       ${ring.spans.length} Optical Spans
Line Rate:            ${ring.lineRateGbps} Gbps
Active Subscriptions: ${d.subscribersCount} Customers
Protected MRR:        PKR ${d.monthlyRevenuePkr.toLocaleString()}

2. RPL CONFIGURATION & ROLES
------------------------------------------------------------------------
RPL Span:             ${d.rplSpan.label} (${d.rplSpan.lengthKm} km)
RPL Owner Node:       ${ring.nodes.find(n => n.role === ERPS_CONSTANTS.NODE_ROLES.RPL_OWNER)?.name || 'N/A'}
RPL Neighbor Node:    ${ring.nodes.find(n => n.role === ERPS_CONSTANTS.NODE_ROLES.RPL_NEIGHBOR)?.name || 'N/A'}
Current RPL State:    ${d.rplStatus}
Current Ring State:   ${d.currentState}
Protection Overhead:  ${d.rplProtectionOverheadPct}% of ring capacity

3. SUB-50MS PROTECTION SWITCHOVER BUDGET
------------------------------------------------------------------------
Detection Mechanism:  ${d.detectionMode.label}
Fault Detection (t_det):   ${t.detectMs} ms
R-APS Generation (t_gen):  ${t.genMs} ms
Optical Propagation (t_pr):${t.propMs} ms (${ring.totalCircumferenceKm} km @ 4.897 us/km)
Switch Transit (t_proc):   ${t.procMs} ms (${ring.nodes.length} nodes @ 2.5 us/node)
MAC FDB Flush (t_flush):   ${t.flushMs} ms (${ring.activeFdbEntries} MAC table entries)
------------------------------------------------------------------------
TOTAL SWITCHOVER TIME:     ${t.totalSwitchMs} ms
ITU-T G.8032 BENCHMARK:    50.000 ms
SLA VERDICT:               ${c.status} (${c.label})
HEADROOM MARGIN:           ${c.marginMs > 0 ? '+' : ''}${c.marginMs} ms

4. FAULT & TRAFFIC IMPACT ANALYSIS
------------------------------------------------------------------------
Simulated Fault:      ${d.failedSpan ? d.failedSpan.label : 'None (Ring Healthy / All Spans Up)'}
Active Ingress Load:  ${d.activeTrafficThroughputGbps} Gbps (${ring.offeredLoadPct}% capacity)
Estimated Data Loss:  ${d.lostMegabits} Megabits (~${d.lostFramesCount.toLocaleString()} Ethernet frames)
WTR Timer Setting:    ${d.wtrMinutes} minutes

Recommendations:
- Maintain hardware LOS or fast CFM CCM (3.3ms) across all metro ring spans to uphold sub-50ms carrier SLA.
- Ensure MAC table aging and FDB flush triggers are synchronized on RPL Owner and Neighbor.
========================================================================`;
}

/**
 * Exports metrics as JSON string
 * @param {Object} metrics - Output of calculateErpsMetrics or calculateErpsDynamics
 * @returns {string} JSON formatted string
 */
export function exportErpsJson(metrics) {
  const d = metrics.dynamics || metrics;
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    standard: 'ITU-T G.8032 / Y.1344 ERPS',
    ring: {
      id: d.ring.id,
      name: d.ring.name,
      primaryArea: d.ring.primaryArea,
      totalCircumferenceKm: d.ring.totalCircumferenceKm,
      nodeCount: d.ring.nodes.length,
      lineRateGbps: d.ring.lineRateGbps
    },
    state: d.currentState,
    rplStatus: d.rplStatus,
    timingBreakdown: d.timingBreakdown,
    compliance: d.compliance,
    impact: {
      activeThroughputGbps: d.activeTrafficThroughputGbps,
      lostMegabits: d.lostMegabits,
      lostFramesCount: d.lostFramesCount,
      subscribersCount: d.subscribersCount,
      monthlyRevenuePkr: d.monthlyRevenuePkr
    }
  }, null, 2);
}

/**
 * Exports metrics as RFC-4180 CSV string
 * @param {Object} metrics - Output of calculateErpsMetrics or calculateErpsDynamics
 * @returns {string} CSV formatted string
 */
export function exportErpsCsv(metrics) {
  const d = metrics.dynamics || metrics;
  const r = d.ring;
  const t = d.timingBreakdown;

  const headers = [
    'Ring_ID',
    'Ring_Name',
    'Primary_Area',
    'Circumference_Km',
    'Node_Count',
    'Line_Rate_Gbps',
    'Current_State',
    'RPL_Status',
    'Failed_Span',
    'Detect_Mode',
    'Detect_Ms',
    'Gen_Ms',
    'Prop_Ms',
    'Proc_Ms',
    'Flush_Ms',
    'Total_Switch_Ms',
    'Compliance_Status',
    'Lost_Megabits',
    'Lost_Frames',
    'Subscribers',
    'Protected_Revenue_PKR'
  ];

  const values = [
    `"${r.id}"`,
    `"${r.name}"`,
    `"${r.primaryArea}"`,
    r.totalCircumferenceKm,
    r.nodes.length,
    r.lineRateGbps,
    `"${d.currentState}"`,
    `"${d.rplStatus}"`,
    `"${d.failedSpan ? d.failedSpan.label : 'None'}"`,
    `"${d.detectionMode.label}"`,
    t.detectMs,
    t.genMs,
    t.propMs,
    t.procMs,
    t.flushMs,
    t.totalSwitchMs,
    `"${d.compliance.status}"`,
    d.lostMegabits,
    d.lostFramesCount,
    d.subscribersCount,
    d.monthlyRevenuePkr
  ];

  return `${headers.join(',')}\r\n${values.join(',')}\r\n`;
}

/**
 * Controller wiring for ERPS modal and dashboard chart card
 * @param {Object} state - Application state
 * @param {Object} options - Environment options (document, onFilterArea, onToast)
 * @returns {Object} Modal controller
 */
export function setupErpsModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const onToast = typeof options.onToast === 'function'
    ? options.onToast
    : (msg) => { if (typeof alert === 'function') alert(msg); };

  // Elements
  const openBtn = doc.getElementById('dashboardOpenErpsModalBtn');
  const modal = doc.getElementById('dashboardErpsModal');
  const closeBtn = doc.getElementById('dashboardErpsModalCloseBtn');

  // Dashboard Card Chart Container
  const cardChartContainer = doc.getElementById('dashboardErpsChart');

  // Modal Inputs
  const ringSelect = doc.getElementById('erpsRingSelect');
  const spanSelect = doc.getElementById('erpsSpanSelect');
  const detectSelect = doc.getElementById('erpsDetectSelect');
  const wtrInput = doc.getElementById('erpsWtrInput');
  const injectCutBtn = doc.getElementById('erpsInjectCutBtn');
  const restoreBtn = doc.getElementById('erpsRestoreBtn');
  const clearBtn = doc.getElementById('erpsClearBtn');

  // Modal KPI stats
  const statState = doc.getElementById('erpsStatState');
  const statSwitchTime = doc.getElementById('erpsStatSwitchTime');
  const statCompliance = doc.getElementById('erpsStatCompliance');
  const statRpl = doc.getElementById('erpsStatRpl');
  const statLoss = doc.getElementById('erpsStatLoss');
  const statSubscribers = doc.getElementById('erpsStatSubscribers');

  // Modal Diagram Container
  const modalDiagramContainer = doc.getElementById('erpsModalDiagramContainer');

  // Export / Action buttons
  const copyReportBtn = doc.getElementById('erpsCopyReportBtn');
  const exportJsonBtn = doc.getElementById('erpsExportJsonBtn');
  const exportCsvBtn = doc.getElementById('erpsExportCsvBtn');
  const filterAreaBtn = doc.getElementById('erpsFilterAreaBtn');

  // State variables
  let currentRingId = ERPS_CONSTANTS.DEFAULT_RING_ID;
  let simulatedFailedSpanId = null;
  let simulatedState = null; // null (auto), or 'PENDING'
  let currentDetectionMode = 'los';
  let currentWtrMinutes = ERPS_CONSTANTS.DEFAULT_WTR_MINUTES;

  function populateSpanSelect(ring) {
    if (!spanSelect) return;
    spanSelect.innerHTML = '<option value="">None (All Spans Normal / Healthy)</option>'
      + ring.spans.map(s => `<option value="${s.id}">${s.label} (${s.lengthKm} km)${s.isRpl ? ' [RPL]' : ''}</option>`).join('');
    spanSelect.value = simulatedFailedSpanId || '';
  }

  function getSimulationParams() {
    return {
      ringId: currentRingId,
      failedSpanId: simulatedFailedSpanId,
      forcedState: simulatedState,
      detectionMode: currentDetectionMode,
      wtrMinutes: currentWtrMinutes
    };
  }

  function recalculate() {
    const ring = SHAHDARA_ERPS_RINGS.find(r => r.id === currentRingId) || SHAHDARA_ERPS_RINGS[0];
    const params = getSimulationParams();
    const metrics = calculateErpsMetrics(state, params);
    const d = metrics.dynamics;

    // Update Modal KPIs
    if (statState) {
      statState.textContent = d.currentState;
      let col = '#10b981';
      if (d.currentState === ERPS_CONSTANTS.STATES.PROTECTION) col = '#ef4444';
      if (d.currentState === ERPS_CONSTANTS.STATES.PENDING) col = '#f59e0b';
      statState.style.color = col;
    }

    if (statSwitchTime) {
      statSwitchTime.textContent = `${d.timingBreakdown.totalSwitchMs} ms`;
      statSwitchTime.style.color = d.compliance.color;
    }

    if (statCompliance) {
      statCompliance.textContent = d.compliance.label;
      statCompliance.style.color = d.compliance.color;
    }

    if (statRpl) {
      statRpl.textContent = d.rplStatus;
      statRpl.style.color = d.rplStatus === 'BLOCKED' ? '#fbbf24' : '#06b6d4';
    }

    if (statLoss) {
      statLoss.textContent = `${d.lostMegabits} Mb (${d.lostFramesCount.toLocaleString()} frames)`;
    }

    if (statSubscribers) {
      statSubscribers.textContent = `${d.subscribersCount} Sub (${formatPKR(d.monthlyRevenuePkr)})`;
    }

    // Render Modal Diagram
    if (modalDiagramContainer) {
      modalDiagramContainer.innerHTML = renderErpsDiagramSvg(d, {
        width: 760,
        height: 440,
        isDarkMode: doc.documentElement ? doc.documentElement.getAttribute('data-theme') !== 'light' : true
      });
    }

    // Render Dashboard Card Chart
    if (cardChartContainer) {
      cardChartContainer.innerHTML = renderErpsDiagramSvg(d, {
        width: 600,
        height: 320,
        isDarkMode: doc.documentElement ? doc.documentElement.getAttribute('data-theme') !== 'light' : true
      });
    }

    return metrics;
  }

  function loadRing(ringId) {
    currentRingId = ringId;
    const ring = SHAHDARA_ERPS_RINGS.find(r => r.id === ringId) || SHAHDARA_ERPS_RINGS[0];
    simulatedFailedSpanId = null;
    simulatedState = null;
    currentDetectionMode = ring.detectionMode || 'los';
    currentWtrMinutes = ERPS_CONSTANTS.DEFAULT_WTR_MINUTES;

    if (ringSelect) ringSelect.value = ringId;
    if (detectSelect) detectSelect.value = currentDetectionMode;
    if (wtrInput) wtrInput.value = currentWtrMinutes;

    populateSpanSelect(ring);
    recalculate();
  }

  // Initial populate
  const initialRing = SHAHDARA_ERPS_RINGS.find(r => r.id === currentRingId) || SHAHDARA_ERPS_RINGS[0];
  populateSpanSelect(initialRing);
  recalculate();

  // Event Listeners
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
      recalculate();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  if (ringSelect) {
    ringSelect.addEventListener('change', () => {
      loadRing(ringSelect.value);
    });
  }

  if (spanSelect) {
    spanSelect.addEventListener('change', () => {
      simulatedFailedSpanId = spanSelect.value || null;
      simulatedState = null;
      recalculate();
    });
  }

  if (detectSelect) {
    detectSelect.addEventListener('change', () => {
      currentDetectionMode = detectSelect.value;
      recalculate();
    });
  }

  if (wtrInput) {
    wtrInput.addEventListener('input', () => {
      currentWtrMinutes = parseFloat(wtrInput.value) || ERPS_CONSTANTS.DEFAULT_WTR_MINUTES;
      recalculate();
    });
  }

  if (injectCutBtn) {
    injectCutBtn.addEventListener('click', () => {
      const ring = SHAHDARA_ERPS_RINGS.find(r => r.id === currentRingId) || SHAHDARA_ERPS_RINGS[0];
      // Pick span 2 (index 1) if none selected
      if (!simulatedFailedSpanId) {
        const targetSpan = ring.spans.find(s => !s.isRpl) || ring.spans[1] || ring.spans[0];
        simulatedFailedSpanId = targetSpan.id;
        if (spanSelect) spanSelect.value = simulatedFailedSpanId;
      }
      simulatedState = ERPS_CONSTANTS.STATES.PROTECTION;
      recalculate();
      onToast(`Simulated Fiber Cut injected on ${simulatedFailedSpanId}! ERPS Protection activated (<50ms).`);
    });
  }

  if (restoreBtn) {
    restoreBtn.addEventListener('click', () => {
      simulatedFailedSpanId = null;
      if (spanSelect) spanSelect.value = '';
      simulatedState = ERPS_CONSTANTS.STATES.PENDING;
      recalculate();
      onToast(`Optical link repaired! ERPS transitioned to PENDING state with WTR timer running (${currentWtrMinutes} min).`);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      simulatedFailedSpanId = null;
      simulatedState = null;
      if (spanSelect) spanSelect.value = '';
      recalculate();
      onToast('ERPS reset to normal IDLE state. RPL blocked.');
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const params = getSimulationParams();
      const metrics = calculateErpsMetrics(state, params);
      const text = generateErpsReport(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          onToast('ITU-T G.8032 ERPS Metro Ring Report copied to clipboard!');
        }).catch(() => {
          onToast('Failed to copy report to clipboard.');
        });
      } else {
        onToast('Clipboard API not available.');
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const params = getSimulationParams();
      const metrics = calculateErpsMetrics(state, params);
      const json = exportErpsJson(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(json).then(() => {
          onToast('ERPS JSON audit telemetry exported to clipboard!');
        }).catch(() => {
          onToast('Failed to copy JSON.');
        });
      } else {
        onToast('Clipboard API not available.');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const params = getSimulationParams();
      const metrics = calculateErpsMetrics(state, params);
      const csv = exportErpsCsv(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(csv).then(() => {
          onToast('ERPS CSV audit metrics exported to clipboard!');
        }).catch(() => {
          onToast('Failed to copy CSV.');
        });
      } else {
        onToast('Clipboard API not available.');
      }
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const ring = SHAHDARA_ERPS_RINGS.find(r => r.id === currentRingId) || SHAHDARA_ERPS_RINGS[0];
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(ring.primaryArea);
      }
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    open: () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
      recalculate();
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    recalculate,
    loadRing
  };
}
