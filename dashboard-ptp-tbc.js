import { formatPKR } from './core.js';

/**
 * Carrier PTP IEEE 1588v2 Telecom Boundary Clock (T-BC / ITU-T G.8273.2 / G.8275.1)
 * Nanosecond Time Error (TE), Phase Wander & Fiber Asymmetry Alignment Matrix
 * Standards: IEEE 1588-2019 / ITU-T G.8275.1 / ITU-T G.8273.2 / ITU-T G.8271.1
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Vector Visualizer & Phase Synchronization Telemetry
 */

export const PTP_TBC_CONSTANTS = {
  DEFAULT_NODE_ID: 'ptp-baradari-prtc',
  FIBER_PROPAGATION_NS_PER_METER: 4.897, // n = 1.4682 in standard single-mode optical fiber

  CLOCK_CLASSES: {
    CLASS_6_GNSS: { code: 6, label: 'Class 6 - PRTC / GNSS Primary Reference Time Clock (Stratum 1)', accuracy: '< 100 ns to UTC' },
    CLASS_7_HOLDOVER: { code: 7, label: 'Class 7 - ePRTC Atomic Holdover (Rubidium / OCXO)', accuracy: '< 250 ns over 14 days' },
    CLASS_140_SLAVE: { code: 140, label: 'Class 140 - Telecom Time Slave Clock (T-TSC)', accuracy: 'Locked to upstream T-BC' }
  },

  TBC_LIMITS: {
    CLASS_A: { maxTeNs: 100, cteNs: 50, dteNs: 70, label: 'T-BC Class A (Standard ITU-T G.8273.2)' },
    CLASS_B: { maxTeNs: 70, cteNs: 20, dteNs: 50, label: 'T-BC Class B (Carrier 4G/5G Aggregation)' },
    CLASS_C: { maxTeNs: 30, cteNs: 10, dteNs: 20, label: 'T-BC Class C (Advanced 5G C-RAN Fronthaul)' },
    CLASS_D: { maxTeNs: 15, cteNs: 5, dteNs: 10, label: 'T-BC Class D (Ultra-Dense 5G Massive MIMO)' }
  },

  STATUS: {
    OPTIMAL: 'Optimal (Locked to PRTC, Nanosecond Phase Aligned, Class C/D Compliant)',
    ASYMMETRY_WARNING: 'Warning: Fiber Length Asymmetry Offset (> 20 ns constant TE)',
    WANDER_ALERT: 'Phase Alert: Dynamic Wander (dTE) Exceeding Mask Limit',
    HOLDOVER: 'Holdover Active: Local Oscillator Preserving Phase Time (< 100 ns/hr)',
    UNLOCKED: 'Critical: PTP Phase Loss of Lock (5G TDD Frame Interference Risk)'
  }
};

export const SHAHDARA_PTP_NODES = [
  {
    id: 'ptp-baradari-prtc',
    name: 'Baradari NOC Primary Reference Time Clock (PRTC / GNSS)',
    primaryArea: 'Baradari',
    role: 'Grandmaster (PRTC Class C)',
    clockClass: 6,
    targetStandard: 'CLASS_C',
    fiberAsymmetryMeters: 0.4,
    baseJitterDteNs: 4.5,
    radioSitesCount: 18,
    frequencySyncProtocol: 'SyncE (ITU-T G.8262) + PTPv2',
    monthlyRevenuePkr: 9800000,
    subscribersCount: 3400
  },
  {
    id: 'ptp-begumkot-tbc',
    name: 'Begum Kot 5G C-RAN Aggregation Hub T-BC',
    primaryArea: 'Begum Kot',
    role: 'Boundary Clock (T-BC Class B)',
    clockClass: 140,
    targetStandard: 'CLASS_B',
    fiberAsymmetryMeters: 4.2,
    baseJitterDteNs: 12.0,
    radioSitesCount: 12,
    frequencySyncProtocol: 'PTP Telecom Profile G.8275.1',
    monthlyRevenuePkr: 6400000,
    subscribersCount: 2100
  },
  {
    id: 'ptp-jiamusa-tbc',
    name: 'Jia Musa Industrial Sub-FAT Boundary Clock',
    primaryArea: 'Jia Musa',
    role: 'Boundary Clock (T-BC Class B)',
    clockClass: 140,
    targetStandard: 'CLASS_B',
    fiberAsymmetryMeters: 6.5,
    baseJitterDteNs: 16.5,
    radioSitesCount: 8,
    frequencySyncProtocol: 'PTP Telecom Profile G.8275.1',
    monthlyRevenuePkr: 3800000,
    subscribersCount: 1200
  },
  {
    id: 'ptp-ravisiphon-tbc',
    name: 'Ravi Siphon High-Tension Transmission T-BC',
    primaryArea: 'Ravi Siphon',
    role: 'Boundary Clock (T-BC Class A)',
    clockClass: 140,
    targetStandard: 'CLASS_A',
    fiberAsymmetryMeters: 14.8,
    baseJitterDteNs: 28.0,
    radioSitesCount: 6,
    frequencySyncProtocol: 'PTP Telecom Profile G.8275.1',
    monthlyRevenuePkr: 4200000,
    subscribersCount: 950
  },
  {
    id: 'ptp-shahdaratown-tbc',
    name: 'Shahdara Town Municipal Telecom Boundary Clock',
    primaryArea: 'Shahdara Town',
    role: 'Boundary Clock (T-BC Class B)',
    clockClass: 140,
    targetStandard: 'CLASS_B',
    fiberAsymmetryMeters: 2.1,
    baseJitterDteNs: 8.5,
    radioSitesCount: 10,
    frequencySyncProtocol: 'SyncE + PTPv2 Full Timing',
    monthlyRevenuePkr: 5100000,
    subscribersCount: 1800
  }
];

// Interactive state variables
let currentSelectedNodeId = PTP_TBC_CONSTANTS.DEFAULT_NODE_ID;
let currentAsymmetryCompensationMeters = 0; // Manual delay asymmetry calibration (meters)
let currentSimulatedHoldover = false; // GNSS unlock / holdover simulation
let currentSimulatedWanderNoise = 0; // Injected phase jitter (ns)

export function getPtpSelectedNodeId() {
  return currentSelectedNodeId;
}

export function setPtpSelectedNodeId(id) {
  if (SHAHDARA_PTP_NODES.some(n => n.id === id)) {
    currentSelectedNodeId = id;
  }
}

export function getPtpAsymmetryCompensation() {
  return currentAsymmetryCompensationMeters;
}

export function setPtpAsymmetryCompensation(val) {
  const num = parseFloat(val);
  if (!Number.isNaN(num)) {
    currentAsymmetryCompensationMeters = num;
  }
}

export function getPtpSimulatedHoldover() {
  return currentSimulatedHoldover;
}

export function setPtpSimulatedHoldover(state) {
  currentSimulatedHoldover = !!state;
}

export function getPtpSimulatedWanderNoise() {
  return currentSimulatedWanderNoise;
}

export function setPtpSimulatedWanderNoise(val) {
  const num = parseFloat(val);
  if (!Number.isNaN(num) && num >= 0) {
    currentSimulatedWanderNoise = num;
  }
}

export function resetPtpSimState() {
  currentSelectedNodeId = PTP_TBC_CONSTANTS.DEFAULT_NODE_ID;
  currentAsymmetryCompensationMeters = 0;
  currentSimulatedHoldover = false;
  currentSimulatedWanderNoise = 0;
}

/**
 * Calculates Constant Time Error (cTE) from uncompensated fiber path length asymmetry.
 * cTE (ns) = (Delta_L_meters * Delay_ns_per_meter) / 2
 */
export function calculateConstantTimeError(asymmetryMeters, compensationMeters = 0) {
  const rawAsymmetry = Math.max(0, parseFloat(asymmetryMeters) || 0);
  const comp = parseFloat(compensationMeters) || 0;
  const netAsymmetryMeters = Math.max(0, rawAsymmetry - comp);
  const rawCteNs = (rawAsymmetry * PTP_TBC_CONSTANTS.FIBER_PROPAGATION_NS_PER_METER) / 2;
  const netCteNs = (netAsymmetryMeters * PTP_TBC_CONSTANTS.FIBER_PROPAGATION_NS_PER_METER) / 2;

  return {
    rawAsymmetryMeters: Math.round(rawAsymmetry * 10) / 10,
    compensationMeters: Math.round(comp * 10) / 10,
    netAsymmetryMeters: Math.round(netAsymmetryMeters * 10) / 10,
    rawCteNs: Math.round(rawCteNs * 10) / 10,
    netCteNs: Math.round(netCteNs * 10) / 10
  };
}

/**
 * Calculates Maximum Absolute Time Error (|maxTE|) and checks ITU-T G.8273.2 compliance.
 * |maxTE| = cTE + dTE (Dynamic Time Error / packet jitter)
 */
export function calculateTimeErrorBudget(netCteNs, baseDteNs, wanderNoiseNs = 0, isHoldover = false, targetStandard = 'CLASS_B') {
  const cte = Math.max(0, parseFloat(netCteNs) || 0);
  const baseDte = Math.max(0, parseFloat(baseDteNs) || 5);
  const noise = Math.max(0, parseFloat(wanderNoiseNs) || 0);
  const totalDteNs = Math.round((baseDte + noise) * 10) / 10;

  let maxTeNs = Math.round((cte + totalDteNs) * 10) / 10;
  if (isHoldover) {
    maxTeNs = Math.round((maxTeNs + 45.0) * 10) / 10; // Drift in holdover
  }

  const limits = PTP_TBC_CONSTANTS.TBC_LIMITS[targetStandard] || PTP_TBC_CONSTANTS.TBC_LIMITS.CLASS_B;
  const isCompliant = maxTeNs <= limits.maxTeNs;
  const marginNs = Math.round((limits.maxTeNs - maxTeNs) * 10) / 10;

  return {
    cteNs: cte,
    dteNs: totalDteNs,
    maxTeNs,
    targetLimitNs: limits.maxTeNs,
    marginNs,
    isCompliant,
    standardLabel: limits.label
  };
}

/**
 * Computes complete PTP Telecom Boundary Clock dynamics for the selected node and fleet summary.
 */
export function calculatePtpTbcDynamics(state = {}, options = {}) {
  const selectedId = options.nodeId || currentSelectedNodeId;
  const comp = (options.compensationMeters !== undefined) ? options.compensationMeters : currentAsymmetryCompensationMeters;
  const holdover = (options.isHoldover !== undefined) ? options.isHoldover : currentSimulatedHoldover;
  const wander = (options.wanderNoise !== undefined) ? options.wanderNoise : currentSimulatedWanderNoise;

  const baseNode = SHAHDARA_PTP_NODES.find(n => n.id === selectedId) || SHAHDARA_PTP_NODES[0];

  const cteCalc = calculateConstantTimeError(baseNode.fiberAsymmetryMeters, comp);
  const teBudget = calculateTimeErrorBudget(cteCalc.netCteNs, baseNode.baseJitterDteNs, wander, holdover, baseNode.targetStandard);

  let overallStatus = PTP_TBC_CONSTANTS.STATUS.OPTIMAL;
  let severity = 'nominal';

  if (!teBudget.isCompliant) {
    overallStatus = teBudget.maxTeNs > 120
      ? PTP_TBC_CONSTANTS.STATUS.UNLOCKED
      : PTP_TBC_CONSTANTS.STATUS.WANDER_ALERT;
    severity = 'critical';
  } else if (holdover) {
    overallStatus = PTP_TBC_CONSTANTS.STATUS.HOLDOVER;
    severity = 'warning';
  } else if (cteCalc.netCteNs > 20.0) {
    overallStatus = PTP_TBC_CONSTANTS.STATUS.ASYMMETRY_WARNING;
    severity = 'warning';
  }

  // Fleet-wide aggregations
  const totalNodes = SHAHDARA_PTP_NODES.length;
  const totalRadioSites = SHAHDARA_PTP_NODES.reduce((s, n) => s + n.radioSitesCount, 0);
  const totalSubscribers = SHAHDARA_PTP_NODES.reduce((s, n) => s + n.subscribersCount, 0);
  const totalFleetRevenue = SHAHDARA_PTP_NODES.reduce((s, n) => s + n.monthlyRevenuePkr, 0);

  return {
    node: {
      ...baseNode
    },
    isHoldoverSimulated: holdover,
    asymmetry: cteCalc,
    timeError: teBudget,
    overallStatus,
    severity,
    aggregates: {
      totalNodes,
      totalRadioSites,
      totalSubscribers,
      totalFleetRevenue
    }
  };
}

/**
 * Calculates fast metrics for dashboard cards.
 */
export function calculatePtpTbcMetrics(state = {}) {
  const dyn = calculatePtpTbcDynamics(state);
  return {
    nodeName: dyn.node.name,
    role: dyn.node.role,
    maxTeNs: dyn.timeError.maxTeNs,
    limitNs: dyn.timeError.targetLimitNs,
    marginNs: dyn.timeError.marginNs,
    cteNs: dyn.asymmetry.netCteNs,
    statusText: dyn.overallStatus,
    severity: dyn.severity,
    radioSites: dyn.aggregates.totalRadioSites,
    monthlyRevenuePkr: dyn.aggregates.totalFleetRevenue
  };
}

/**
 * Pure client-side SVG renderer for PTP Synchronization Chain and Phase Eye Diagram.
 */
export function renderPtpTbcDiagramSvg(dynamics, options = {}) {
  const d = dynamics || calculatePtpTbcDynamics();
  const isDark = !!options.isDark;
  const compact = !!options.compact;

  const bgFill = isDark ? '#0f172a' : '#f8fafc';
  const cardFill = isDark ? '#1e293b' : '#ffffff';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? '#334155' : '#cbd5e1';

  let statusColor = '#10b981'; // Green
  if (d.severity === 'warning') statusColor = '#f59e0b'; // Amber
  if (d.severity === 'critical') statusColor = '#ef4444'; // Red

  const svgWidth = 840;
  const svgHeight = compact ? 260 : 360;

  const node = d.node;
  const te = d.timeError;
  const asym = d.asymmetry;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" class="ptp-tbc-svg" style="width: 100%; height: auto; font-family: system-ui, -apple-system, sans-serif;">
    <defs>
      <linearGradient id="ptpPhaseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b82f6" />
        <stop offset="50%" stop-color="#10b981" />
        <stop offset="100%" stop-color="#06b6d4" />
      </linearGradient>
      <filter id="ptpGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${svgWidth}" height="${svgHeight}" rx="10" fill="${bgFill}" stroke="${borderCol}" stroke-width="1.2" />

    <!-- Header Telemetry Ribbon -->
    <g transform="translate(18, 14)">
      <rect width="804" height="40" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
      <circle cx="16" cy="20" r="6" fill="${statusColor}" />
      <text x="32" y="24" font-size="12.5" font-weight="700" fill="${textMain}">
        PTP CLOCK: ${escapeHtml(node.name.substring(0, 42))} (${escapeHtml(node.role)})
      </text>
      <text x="560" y="24" font-size="12" font-weight="600" fill="${textMuted}">
        Time Error: <tspan fill="${statusColor}" font-weight="700">|maxTE| = ${te.maxTeNs} ns</tspan> (Limit: ≤ ${te.targetLimitNs} ns)
      </text>
      <text x="740" y="24" font-size="11" font-weight="700" fill="${statusColor}">
        ${te.isCompliant ? 'CONFORMANT' : 'BREACHED'}
      </text>
    </g>

    <!-- PTP Sync Chain: GNSS Satellites -> PRTC Master -> T-BC Node -> 5G Base Stations -->
    <g transform="translate(26, 68)">
      <!-- GNSS Satellite Constellation -->
      <g transform="translate(10, 15)">
        <rect width="115" height="52" rx="6" fill="${cardFill}" stroke="#3b82f6" stroke-width="1.8" filter="url(#ptpGlow)" />
        <text x="57" y="22" font-size="10.5" font-weight="700" fill="#3b82f6" text-anchor="middle">GNSS Constellation</text>
        <text x="57" y="38" font-size="9" fill="${textMuted}" text-anchor="middle">GPS / BeiDou / Galileo</text>
        <text x="57" y="48" font-size="8" font-weight="600" fill="#10b981" text-anchor="middle">UTC Stratum 1</text>
      </g>

      <!-- Sync Ray -->
      <line x1="125" y1="41" x2="190" y2="41" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="3,2" />
      <text x="157" y="32" font-size="8.5" font-weight="700" fill="#3b82f6" text-anchor="middle">1PPS / 10MHz</text>

      <!-- PRTC Grandmaster -->
      <g transform="translate(190, 10)">
        <rect width="145" height="62" rx="6" fill="${cardFill}" stroke="#10b981" stroke-width="2" filter="url(#ptpGlow)" />
        <rect width="145" height="18" rx="4" fill="#10b981" />
        <text x="72" y="13" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">PRTC Grandmaster (NOC)</text>
        <text x="10" y="34" font-size="9" font-weight="700" fill="${textMain}">Clock Class: ${node.clockClass}</text>
        <text x="10" y="47" font-size="8.5" fill="${textMuted}">G.8275.1 Master Profile</text>
        <text x="10" y="57" font-size="8.5" font-weight="600" fill="#10b981">Sync Rate: 16 pkts/s</text>
      </g>

      <!-- PTP Optical Fiber Span with Asymmetry Indicator -->
      <line x1="335" y1="41" x2="445" y2="41" stroke="#f59e0b" stroke-width="3" />
      <text x="390" y="32" font-size="8.5" font-weight="700" fill="#f59e0b" text-anchor="middle">Fiber Asymmetry</text>
      <text x="390" y="54" font-size="8" fill="${textMuted}" text-anchor="middle">ΔL: ${asym.netAsymmetryMeters}m · cTE: ${asym.netCteNs}ns</text>

      <!-- Target Telecom Boundary Clock (T-BC) -->
      <g transform="translate(445, 10)">
        <rect width="155" height="62" rx="6" fill="${cardFill}" stroke="${statusColor}" stroke-width="2" filter="url(#ptpGlow)" />
        <rect width="155" height="18" rx="4" fill="${statusColor}" />
        <text x="77" y="13" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeHtml(node.primaryArea)} T-BC Node</text>
        <text x="10" y="34" font-size="9" font-weight="700" fill="${textMain}">|maxTE|: ${te.maxTeNs} ns</text>
        <text x="10" y="47" font-size="8.5" fill="${textMuted}">cTE: ${asym.netCteNs}ns · dTE: ${te.dteNs}ns</text>
        <text x="10" y="57" font-size="8.5" font-weight="600" fill="${statusColor}">${te.standardLabel.split(' ')[0]} ${te.standardLabel.split(' ')[1]}</text>
      </g>

      <!-- Downstream Distribution Ray -->
      <line x1="600" y1="41" x2="670" y2="41" stroke="#06b6d4" stroke-width="2.5" stroke-dasharray="3,2" />
      <text x="635" y="32" font-size="8.5" font-weight="700" fill="#06b6d4" text-anchor="middle">Fronthaul</text>

      <!-- 5G C-RAN Radio Units (RU / Base Stations) -->
      <g transform="translate(670, 15)">
        <rect width="115" height="52" rx="6" fill="${cardFill}" stroke="#06b6d4" stroke-width="1.8" filter="url(#ptpGlow)" />
        <text x="57" y="22" font-size="10.5" font-weight="700" fill="#06b6d4" text-anchor="middle">5G Radio Units</text>
        <text x="57" y="36" font-size="9" fill="${textMuted}" text-anchor="middle">${node.radioSitesCount} Antennas Locked</text>
        <text x="57" y="47" font-size="8" font-weight="600" fill="#10b981" text-anchor="middle">TDD Sync ≤ 1.5 µs</text>
      </g>
    </g>

    <!-- Phase Alignment Waveform / Nanosecond Eye Diagram -->
    <g transform="translate(36, ${compact ? 165 : 185})">
      <rect width="768" height="65" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
      <text x="12" y="16" font-size="10" font-weight="700" fill="${textMuted}">PHASE ALIGNMENT EYE &amp; TIME ERROR OFFSET WAVEFORM (ns)</text>

      <!-- Center Zero Reference Line -->
      <line x1="80" y1="42" x2="750" y2="42" stroke="${borderCol}" stroke-width="1.2" />
      <text x="70" y="45" font-size="8.5" font-weight="700" fill="#10b981" text-anchor="end">0.0 ns (UTC)</text>

      <!-- Positive & Negative Limit Threshold Boundaries -->
      <line x1="80" y1="26" x2="750" y2="26" stroke="#ef4444" stroke-width="0.8" stroke-dasharray="2,2" />
      <text x="70" y="29" font-size="7.5" fill="#ef4444" text-anchor="end">+${te.targetLimitNs}ns</text>
      <line x1="80" y1="58" x2="750" y2="58" stroke="#ef4444" stroke-width="0.8" stroke-dasharray="2,2" />
      <text x="70" y="61" font-size="7.5" fill="#ef4444" text-anchor="end">-${te.targetLimitNs}ns</text>

      <!-- Actual Time Error Jitter Trace -->
      <path d="M 90,42 Q 130,${42 - (te.maxTeNs * 0.25)} 180,42 T 270,${42 + (te.maxTeNs * 0.25)} T 360,42 T 450,${42 - (te.maxTeNs * 0.2)} T 540,42 T 630,${42 + (te.maxTeNs * 0.2)} T 720,42" 
            fill="none" stroke="${statusColor}" stroke-width="2.5" />
    </g>

    ${!compact ? `
    <!-- Detail HUD Grid: TE Budget, Asymmetry Calibration, Mobile Backhaul Revenue -->
    <g transform="translate(36, 265)">
      <!-- Box 1: Time Error Budget -->
      <rect width="240" height="80" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
      <text x="12" y="18" font-size="10.5" font-weight="700" fill="${textMuted}">MAX ABSOLUTE TIME ERROR</text>
      <text x="12" y="42" font-size="18" font-weight="800" fill="${statusColor}">|maxTE| = ${te.maxTeNs} ns</text>
      <text x="12" y="60" font-size="9.5" fill="${textMuted}">Compliance Margin: <tspan font-weight="700" fill="${te.isCompliant ? '#10b981' : '#ef4444'}">+${te.marginNs} ns</tspan></text>
      <text x="12" y="73" font-size="9" fill="${textMuted}">Standard: <tspan font-weight="600" fill="${textMain}">${te.standardLabel}</tspan></text>

      <!-- Box 2: Fiber Asymmetry & cTE -->
      <g transform="translate(260, 0)">
        <rect width="240" height="80" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
        <text x="12" y="18" font-size="10.5" font-weight="700" fill="${textMuted}">FIBER DELAY ASYMMETRY</text>
        <text x="12" y="42" font-size="18" font-weight="800" fill="${asym.netCteNs > 20 ? '#f59e0b' : '#10b981'}">cTE: ${asym.netCteNs} ns</text>
        <text x="12" y="60" font-size="9.5" fill="${textMuted}">Net Length Delta: <tspan font-weight="700" fill="${textMain}">${asym.netAsymmetryMeters} m</tspan> (${asym.rawAsymmetryMeters}m raw)</text>
        <text x="12" y="73" font-size="8.5" fill="${textMuted}">Compensated: <tspan font-weight="600" fill="#3b82f6">${asym.compensationMeters} meters</tspan></text>
      </g>

      <!-- Box 3: Downstream 5G Base Stations -->
      <g transform="translate(520, 0)">
        <rect width="248" height="80" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
        <text x="12" y="18" font-size="10.5" font-weight="700" fill="${textMuted}">5G C-RAN PROTECTED FLEET</text>
        <text x="12" y="42" font-size="18" font-weight="800" fill="#3b82f6">${node.radioSitesCount} Radio Units</text>
        <text x="12" y="60" font-size="9.5" fill="${textMuted}">Subscribers: <tspan font-weight="700" fill="${textMain}">${node.subscribersCount} Mobile Users</tspan></text>
        <text x="12" y="73" font-size="9" fill="${textMuted}">Protected Revenue: <tspan font-weight="700" fill="#10b981">${formatPKR(node.monthlyRevenuePkr)}</tspan></text>
      </g>
    </g>
    ` : ''}
  </svg>
  `;
}

/**
 * Generates an executive Outside Plant / Phase Synchronization Audit Report.
 */
export function generatePtpTbcReport(dynamics) {
  const d = dynamics || calculatePtpTbcDynamics();
  const n = d.node;
  const t = d.timeError;
  const a = d.asymmetry;

  return `========================================================================
SHAHDARA ISP PTP IEEE 1588v2 TELECOM BOUNDARY CLOCK AUDIT REPORT
Standards: ITU-T G.8275.1 / G.8273.2 / G.8271.1 / IEEE 1588-2019
Date/Time (PKT): ${new Date().toISOString()}
========================================================================

1. TARGET BOUNDARY CLOCK NODE & PARAMETERS:
------------------------------------------------------------------------
• Node Identifier:       ${n.name}
• Primary Area:          ${n.primaryArea}
• PTP Role:              ${n.role}
• Clock Class:           ${n.clockClass}
• Target Standard:       ${t.standardLabel}
• Sync Protocol:         ${n.frequencySyncProtocol}
• Radio Units Fed:       ${n.radioSitesCount} 5G gNodeB / eNodeB Radios
• Active Subscribers:    ${n.subscribersCount} Users
• Monthly Revenue:       ${formatPKR(n.monthlyRevenuePkr)}

2. TIME ERROR METROLOGY & BUDGET:
------------------------------------------------------------------------
• Max Absolute TE (|maxTE|): ${t.maxTeNs} ns
• Target Limit Floor:        ≤ ${t.targetLimitNs} ns
• Compliance Margin:         +${t.marginNs} ns (${t.isCompliant ? 'CONFORMANT - PASS' : 'BREACHED - FAIL'})
• Constant Time Error (cTE): ${a.netCteNs} ns
• Dynamic Time Error (dTE):  ${t.dteNs} ns
• Holdover State:            ${d.isHoldoverSimulated ? 'ACTIVE (Local OCXO Free-running)' : 'LOCKED (Tracing GNSS PRTC)'}

3. FIBER PROPAGATION ASYMMETRY CALIBRATION:
------------------------------------------------------------------------
• Physical Fiber Asymmetry:  ${a.rawAsymmetryMeters} meters
• Calibration Compensation:  ${a.compensationMeters} meters
• Net Residual Asymmetry:    ${a.netAsymmetryMeters} meters
• Uncompensated cTE Penalty: ${a.rawCteNs} ns -> Reduced to ${a.netCteNs} ns

4. NETWORK-WIDE 5G C-RAN SYNCHRONIZATION SUMMARY:
------------------------------------------------------------------------
• Total Telecom Clocks:      ${d.aggregates.totalNodes} PTP Nodes
• Total 5G Radio Sites Fed:  ${d.aggregates.totalRadioSites} gNodeB Stations
• Total 5G Users Protected:  ${d.aggregates.totalSubscribers} Subscribers
• Total Fleet Revenue:       ${formatPKR(d.aggregates.totalFleetRevenue)} / month
• Overall Synchronization:   ${d.overallStatus}
========================================================================`;
}

/**
 * Exports PTP data to JSON.
 */
export function exportPtpTbcJson(dynamics) {
  const d = dynamics || calculatePtpTbcDynamics();
  const jsonStr = JSON.stringify(d, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-ptp-${d.node.id}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports PTP data to RFC-4180 CSV.
 */
export function exportPtpTbcCsv(dynamics) {
  const d = dynamics || calculatePtpTbcDynamics();
  const rows = [
    ['Node ID', 'Node Name', 'Area', 'Role', 'Clock Class', 'Target Standard', 'maxTE ns', 'Limit ns', 'Margin ns', 'cTE ns', 'dTE ns', 'Asymmetry Meters', 'Radio Sites', 'Subscribers', 'Revenue PKR', 'Status']
  ];

  SHAHDARA_PTP_NODES.forEach(n => {
    const isSelected = n.id === d.node.id;
    const cte = calculateConstantTimeError(n.fiberAsymmetryMeters, isSelected ? d.asymmetry.compensationMeters : 0);
    const te = calculateTimeErrorBudget(cte.netCteNs, n.baseJitterDteNs, isSelected ? (d.timeError.dteNs - n.baseJitterDteNs) : 0, isSelected ? d.isHoldoverSimulated : false, n.targetStandard);

    rows.push([
      n.id,
      `"${n.name}"`,
      n.primaryArea,
      `"${n.role}"`,
      n.clockClass,
      n.targetStandard,
      te.maxTeNs,
      te.targetLimitNs,
      te.marginNs,
      cte.netCteNs,
      te.dteNs,
      cte.netAsymmetryMeters,
      n.radioSitesCount,
      n.subscribersCount,
      n.monthlyRevenuePkr,
      isSelected ? `"${d.overallStatus}"` : '"Nominal"'
    ]);
  });

  const csvContent = rows.map(r => r.join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-ptp-tbc-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Helper to escape HTML characters.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}

/**
 * Wires up interactive controls inside the PTP Telecom Boundary Clock modal dialog.
 */
export function setupPtpTbcModal(state = {}, options = {}) {
  const modal = document.getElementById('dashboardPtpTbcModal');
  if (!modal) return;

  const openBtn = document.getElementById('dashboardOpenPtpTbcModalBtn');
  const closeBtn = document.getElementById('dashboardPtpTbcModalCloseBtn');

  const nodeSelect = document.getElementById('ptpNodeSelect');
  const asymRange = document.getElementById('ptpAsymCompRange');
  const asymValLabel = document.getElementById('ptpAsymValLabel');
  const holdoverBtn = document.getElementById('ptpHoldoverToggleBtn');
  const resetBtn = document.getElementById('ptpResetBtn');

  const statMaxTe = document.getElementById('ptpStatMaxTe');
  const statMargin = document.getElementById('ptpStatMargin');
  const statCte = document.getElementById('ptpStatCte');
  const statDte = document.getElementById('ptpStatDte');
  const statStatusBadge = document.getElementById('ptpStatStatusBadge');

  const svgContainer = document.getElementById('dashboardPtpTbcModalSvgContainer');
  const copyReportBtn = document.getElementById('ptpCopyReportBtn');
  const exportJsonBtn = document.getElementById('ptpExportJsonBtn');
  const exportCsvBtn = document.getElementById('ptpExportCsvBtn');

  function updateUi() {
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    const dyn = calculatePtpTbcDynamics(state);

    if (svgContainer) {
      svgContainer.innerHTML = renderPtpTbcDiagramSvg(dyn, { isDark, compact: false });
    }

    const cardSvg = document.getElementById('dashboardPtpTbcChart');
    if (cardSvg) {
      cardSvg.innerHTML = renderPtpTbcDiagramSvg(dyn, { isDark, compact: true });
    }

    if (statMaxTe) {
      statMaxTe.textContent = `${dyn.timeError.maxTeNs} ns`;
      statMaxTe.className = `optical-evm-stat-val ${dyn.timeError.isCompliant ? 'optimal' : 'critical'}`;
    }
    if (statMargin) {
      statMargin.textContent = `+${dyn.timeError.marginNs} ns (${dyn.timeError.standardLabel.split(' ')[0]} ${dyn.timeError.standardLabel.split(' ')[1]})`;
      statMargin.className = `optical-evm-stat-val ${dyn.timeError.isCompliant ? 'optimal' : 'critical'}`;
    }
    if (statCte) {
      statCte.textContent = `${dyn.asymmetry.netCteNs} ns (${dyn.asymmetry.netAsymmetryMeters}m)`;
    }
    if (statDte) {
      statDte.textContent = `${dyn.timeError.dteNs} ns jitter`;
    }
    if (statStatusBadge) {
      statStatusBadge.textContent = dyn.overallStatus;
      statStatusBadge.className = `status-badge badge-${dyn.severity}`;
    }
    if (asymValLabel) {
      asymValLabel.textContent = `${currentAsymmetryCompensationMeters} m`;
    }
  }

  if (openBtn && !openBtn.dataset.wired) {
    openBtn.dataset.wired = 'true';
    openBtn.addEventListener('click', () => {
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
      updateUi();
    });
  }

  if (closeBtn && !closeBtn.dataset.wired) {
    closeBtn.dataset.wired = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  if (nodeSelect && !nodeSelect.dataset.wired) {
    nodeSelect.dataset.wired = 'true';
    nodeSelect.addEventListener('change', (e) => {
      setPtpSelectedNodeId(e.target.value);
      updateUi();
    });
  }

  if (asymRange && !asymRange.dataset.wired) {
    asymRange.dataset.wired = 'true';
    asymRange.addEventListener('input', (e) => {
      setPtpAsymmetryCompensation(e.target.value);
      updateUi();
    });
  }

  if (holdoverBtn && !holdoverBtn.dataset.wired) {
    holdoverBtn.dataset.wired = 'true';
    holdoverBtn.addEventListener('click', () => {
      const next = !getPtpSimulatedHoldover();
      setPtpSimulatedHoldover(next);
      holdoverBtn.textContent = next ? '⚠️ Restore GNSS PRTC Lock' : '🛰️ Simulate GNSS Loss / Holdover';
      updateUi();
    });
  }

  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = 'true';
    resetBtn.addEventListener('click', () => {
      resetPtpSimState();
      if (nodeSelect) nodeSelect.value = PTP_TBC_CONSTANTS.DEFAULT_NODE_ID;
      if (asymRange) asymRange.value = '0';
      if (holdoverBtn) holdoverBtn.textContent = '🛰️ Simulate GNSS Loss / Holdover';
      updateUi();
    });
  }

  if (copyReportBtn && !copyReportBtn.dataset.wired) {
    copyReportBtn.dataset.wired = 'true';
    copyReportBtn.addEventListener('click', async () => {
      const dyn = calculatePtpTbcDynamics(state);
      const text = generatePtpTbcReport(dyn);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          if (options.onToast) options.onToast('PTP T-BC Report copied to clipboard!');
        } else {
          window.prompt('Copy PTP T-BC Report:', text);
        }
      } catch (err) {
        window.prompt('Copy PTP T-BC Report:', text);
      }
    });
  }

  if (exportJsonBtn && !exportJsonBtn.dataset.wired) {
    exportJsonBtn.dataset.wired = 'true';
    exportJsonBtn.addEventListener('click', () => {
      const dyn = calculatePtpTbcDynamics(state);
      exportPtpTbcJson(dyn);
    });
  }

  if (exportCsvBtn && !exportCsvBtn.dataset.wired) {
    exportCsvBtn.dataset.wired = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const dyn = calculatePtpTbcDynamics(state);
      exportPtpTbcCsv(dyn);
    });
  }

  // Initial render
  updateUi();
}
