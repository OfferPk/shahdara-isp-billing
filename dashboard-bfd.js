import { formatPKR } from './core.js';

/**
 * Carrier BFD (Bidirectional Forwarding Detection - RFC 5880 / RFC 5881 / RFC 7130) Matrix
 * Microsecond Link Fault Detection, Echo Mode & Multi-Protocol State Machine
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Protocol Timers & SLA Telemetry
 */

export const BFD_CONSTANTS = {
  DEFAULT_SESSION_ID: 'nayatel-10g-transit',
  DEFAULT_DESIRED_MIN_TX_MS: 50,
  DEFAULT_REQUIRED_MIN_RX_MS: 50,
  DEFAULT_DETECT_MULTIPLIER: 3,
  DEFAULT_ECHO_ENABLED: false,
  DEFAULT_PACKET_DROP_PCT: 0.0,

  BFD_CONTROL_PORT: 3784,
  BFD_ECHO_PORT: 3785,
  BFD_LAG_CONTROL_PORT: 6784, // RFC 7130 Micro-BFD on LAG

  STATES: {
    ADMIN_DOWN: 'AdminDown',
    DOWN: 'Down',
    INIT: 'Init',
    UP: 'Up'
  },

  DIAG_CODES: {
    0: 'No Diagnostic',
    1: 'Control Detection Time Expired',
    2: 'Echo Function Failed',
    3: 'Neighbor Signaled Session Down',
    4: 'Forwarding Plane Reset',
    5: 'Path Down',
    6: 'Concatenated Path Down',
    7: 'AdminDown',
    8: 'Reverse Concatenated Path Down'
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    ACCEPTABLE: 'Acceptable',
    DEGRADED: 'Degraded',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_BFD_SESSIONS = [
  {
    id: 'nayatel-10g-transit',
    name: 'Baradari Core OLT to Nayatel 10G IP Transit BGP Fast Peering',
    primaryArea: 'Baradari',
    secondaryAreas: ['Shahdara Town', 'Begum Kot'],
    interface: 'TenGigE0/0/1',
    rfcProfile: 'RFC 5881 (Single-Hop IPv4)',
    clientProtocol: 'BGP-4 (AS 133221)',
    baselineTxIntervalMs: 50,
    baselineRxIntervalMs: 50,
    baselineMultiplier: 3,
    echoSupported: true,
    baselineEchoRxMs: 20,
    hardwareOffload: true,
    igpDeadTimeMs: 90000, // 90s standard BGP hold-time
    monthlyRevenuePkr: 1450000,
    subscribersCount: 420
  },
  {
    id: 'begumkot-vandala-lag-bfd',
    name: 'Begum Kot Ring to Vandala Distribution Hub Micro-BFD (RFC 7130)',
    primaryArea: 'Begum Kot',
    secondaryAreas: ['Vandala Road', 'Jia Musa'],
    interface: 'Bundle-Ether1 (Te0/1/0, Te0/1/1)',
    rfcProfile: 'RFC 7130 (Micro-BFD on LAG)',
    clientProtocol: 'IEEE 802.1AX LACP Bundle',
    baselineTxIntervalMs: 100,
    baselineRxIntervalMs: 100,
    baselineMultiplier: 3,
    echoSupported: false,
    baselineEchoRxMs: 0,
    hardwareOffload: true,
    igpDeadTimeMs: 30000, // 30s LACP long timeout
    monthlyRevenuePkr: 880000,
    subscribersCount: 260
  },
  {
    id: 'jiamusa-subfat-ospf',
    name: 'Jia Musa Aggregation Ring to Sub-FAT OSPF Area 0 Fast Neighbor',
    primaryArea: 'Jia Musa',
    secondaryAreas: ['Shahdara Town'],
    interface: 'GigabitEthernet0/1/4',
    rfcProfile: 'RFC 5883 (Multi-Hop OSPF)',
    clientProtocol: 'OSPFv2 (Area 0.0.0.0)',
    baselineTxIntervalMs: 100,
    baselineRxIntervalMs: 100,
    baselineMultiplier: 3,
    echoSupported: false,
    baselineEchoRxMs: 0,
    hardwareOffload: false, // Software CPU mode
    igpDeadTimeMs: 40000, // 40s OSPF dead interval
    monthlyRevenuePkr: 620000,
    subscribersCount: 190
  },
  {
    id: 'siphon-aerial-frr',
    name: 'Ravi Siphon Aerial Span MPLS RSVP-TE Fast Reroute (FRR) Trigger',
    primaryArea: 'Ravi Siphon',
    secondaryAreas: ['Baradari', 'Kala Khatai Road'],
    interface: 'TenGigE0/2/0 (Optical Aerial Crossing)',
    rfcProfile: 'RFC 5880 / 5881 (Single-Hop with Echo)',
    clientProtocol: 'RSVP-TE 1:1 Fast Reroute',
    baselineTxIntervalMs: 10,
    baselineRxIntervalMs: 10,
    baselineMultiplier: 3,
    echoSupported: true,
    baselineEchoRxMs: 10,
    hardwareOffload: true, // FPGA / ASIC Hardware
    igpDeadTimeMs: 10000, // 10s RSVP teardown
    monthlyRevenuePkr: 1120000,
    subscribersCount: 310
  },
  {
    id: 'gt-road-corporate-vpls',
    name: 'GT Road Commercial Hub Corporate VPLS Multi-Chassis Peering',
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Jia Musa', 'Begum Kot'],
    interface: 'TenGigE0/3/2',
    rfcProfile: 'RFC 5881 (Single-Hop IS-IS)',
    clientProtocol: 'IS-IS Level-2 (Corporate Mesh)',
    baselineTxIntervalMs: 50,
    baselineRxIntervalMs: 50,
    baselineMultiplier: 4,
    echoSupported: false,
    baselineEchoRxMs: 0,
    hardwareOffload: true,
    igpDeadTimeMs: 30000, // 30s IS-IS holding timer
    monthlyRevenuePkr: 790000,
    subscribersCount: 175
  }
];

/**
 * Calculates RFC 5880 / 5881 / 7130 BFD timing, detection windows, flap probability, and failover speedup
 * @param {Object} sessionConfig - BFD session definition
 * @param {Object} options - Simulation inputs (desiredMinTxMs, requiredMinRxMs, detectMultiplier, echoEnabled, simulatedPacketDropPct, diagCode)
 * @returns {Object} Calculated dynamics
 */
export function calculateBfdDynamics(sessionConfig, options = {}) {
  const s = sessionConfig || SHAHDARA_BFD_SESSIONS[0];

  const desiredMinTxMs = typeof options.desiredMinTxMs === 'number'
    ? Math.max(5, Math.min(1000, options.desiredMinTxMs))
    : s.baselineTxIntervalMs;

  const requiredMinRxMs = typeof options.requiredMinRxMs === 'number'
    ? Math.max(5, Math.min(1000, options.requiredMinRxMs))
    : s.baselineRxIntervalMs;

  const detectMultiplier = typeof options.detectMultiplier === 'number'
    ? Math.max(2, Math.min(10, Math.round(options.detectMultiplier)))
    : s.baselineMultiplier;

  const echoEnabled = typeof options.echoEnabled === 'boolean'
    ? (options.echoEnabled && s.echoSupported)
    : false;

  const simulatedPacketDropPct = typeof options.simulatedPacketDropPct === 'number'
    ? Math.max(0, Math.min(30, options.simulatedPacketDropPct))
    : BFD_CONSTANTS.DEFAULT_PACKET_DROP_PCT;

  const diagCode = typeof options.diagCode === 'number' && BFD_CONSTANTS.DIAG_CODES[options.diagCode]
    ? options.diagCode
    : 0;

  // 1. Negotiated Transmit & Receive Intervals (RFC 5880 Section 6.8.3)
  // Assuming symmetric remote peer capability
  const negotiatedTxIntervalMs = Math.max(desiredMinTxMs, requiredMinRxMs);
  const negotiatedRxIntervalMs = Math.max(requiredMinRxMs, desiredMinTxMs);

  // 2. Detection Time Calculation
  // Asynchronous Mode Detection Time = Detect Multiplier * Negotiated RX Interval
  let detectionTimeMs = detectMultiplier * negotiatedRxIntervalMs;

  // Echo Mode Detection Time (RFC 5880 Section 6.8.9)
  let echoIntervalMs = 0;
  if (echoEnabled) {
    echoIntervalMs = s.baselineEchoRxMs || Math.round(desiredMinTxMs / 2);
    detectionTimeMs = detectMultiplier * echoIntervalMs;
  }

  // 3. Hardware vs Software Jitter & Stability
  const jitterToleranceMs = s.hardwareOffload ? 0.5 : 15.0;
  const isJitterAtRisk = !s.hardwareOffload && negotiatedTxIntervalMs < 50;

  // 4. Packet Loss / Flap Risk Probability
  // Flap occurs if 'detectMultiplier' consecutive BFD control packets are lost
  const dropRatio = simulatedPacketDropPct / 100;
  const falseFlapProbability = Math.pow(dropRatio, detectMultiplier);
  const falseFlapPct = +(falseFlapProbability * 100).toFixed(5);

  // Estimated packets per second generated by BFD session
  const packetsPerSec = echoEnabled && echoIntervalMs > 0
    ? Math.round(1000 / echoIntervalMs) + Math.round(1000 / Math.max(1000, negotiatedTxIntervalMs))
    : Math.round(1000 / negotiatedTxIntervalMs);

  // 5. Failover Speedup vs Default IGP Dead Timer
  const igpDeadTimeMs = s.igpDeadTimeMs || 40000;
  const failoverSpeedupFactor = +(igpDeadTimeMs / Math.max(1, detectionTimeMs)).toFixed(1);
  const outageReductionPct = +(((igpDeadTimeMs - detectionTimeMs) / igpDeadTimeMs) * 100).toFixed(2);

  // 6. State Machine Determination
  let state = BFD_CONSTANTS.STATES.UP;
  let diagName = BFD_CONSTANTS.DIAG_CODES[diagCode];

  if (diagCode === 7) {
    state = BFD_CONSTANTS.STATES.ADMIN_DOWN;
  } else if (diagCode > 0 || (simulatedPacketDropPct >= 20 && falseFlapProbability > 0.01)) {
    state = BFD_CONSTANTS.STATES.DOWN;
    if (diagCode === 0) {
      diagName = BFD_CONSTANTS.DIAG_CODES[1]; // Control Detection Time Expired
    }
  }

  // 7. Status Verdict & SLA Risk
  let status = BFD_CONSTANTS.STATUS.OPTIMAL;
  let statusColor = '#10b981';

  if (state === BFD_CONSTANTS.STATES.DOWN || state === BFD_CONSTANTS.STATES.ADMIN_DOWN || falseFlapProbability > 0.005) {
    status = BFD_CONSTANTS.STATUS.CRITICAL;
    statusColor = '#ef4444';
  } else if (detectionTimeMs > 300 || isJitterAtRisk || simulatedPacketDropPct >= 5) {
    status = BFD_CONSTANTS.STATUS.DEGRADED;
    statusColor = '#f59e0b';
  } else if (detectionTimeMs > 100) {
    status = BFD_CONSTANTS.STATUS.ACCEPTABLE;
    statusColor = '#3b82f6';
  }

  // SLA Penalty Exposure (e.g. if detection time violates sub-150ms carrier SLA or session down)
  let penaltyRebatePct = 0;
  if (status === BFD_CONSTANTS.STATUS.CRITICAL) penaltyRebatePct = 25;
  else if (status === BFD_CONSTANTS.STATUS.DEGRADED) penaltyRebatePct = 10;
  const penaltyPkr = Math.round((s.monthlyRevenuePkr * penaltyRebatePct) / 100);

  return {
    session: s,
    desiredMinTxMs,
    requiredMinRxMs,
    detectMultiplier,
    echoEnabled,
    echoIntervalMs,
    simulatedPacketDropPct,
    diagCode,
    diagName,
    state,

    // Timing Dynamics
    timing: {
      negotiatedTxIntervalMs,
      negotiatedRxIntervalMs,
      detectionTimeMs,
      jitterToleranceMs,
      isJitterAtRisk,
      packetsPerSec
    },

    // Reliability & Flap Risk
    reliability: {
      dropRatio,
      falseFlapProbability,
      falseFlapPct,
      hardwareOffload: s.hardwareOffload
    },

    // Failover Performance
    performance: {
      igpDeadTimeMs,
      failoverSpeedupFactor,
      outageReductionPct
    },

    // Quality Verdict & Financial Impact
    status,
    statusColor,
    penaltyRebatePct,
    penaltyPkr
  };
}

/**
 * Calculates aggregate BFD metrics across all Shahdara peering sessions
 * @param {Array} sessions - Array of BFD session definitions
 * @param {Object} state - Application state
 * @param {Object} options - Calculation options
 * @returns {Object} Rollup metrics
 */
export function calculateBfdMetrics(sessions = SHAHDARA_BFD_SESSIONS, state = null, options = {}) {
  const sessionList = Array.isArray(sessions) && sessions.length > 0 ? sessions : SHAHDARA_BFD_SESSIONS;

  let totalSessions = sessionList.length;
  let hardwareOffloadCount = 0;
  let sub50msSessionsCount = 0;
  let sub150msSessionsCount = 0;
  let totalRevenuePkr = 0;
  let totalSubscribers = 0;
  let sumDetectionTimeMs = 0;
  let maxSpeedup = 0;
  let totalPenaltyPkr = 0;

  const analyzedSessions = sessionList.map(s => {
    const dynamics = calculateBfdDynamics(s, options);
    if (s.hardwareOffload) hardwareOffloadCount++;
    if (dynamics.timing.detectionTimeMs <= 50) sub50msSessionsCount++;
    if (dynamics.timing.detectionTimeMs <= 150) sub150msSessionsCount++;
    totalRevenuePkr += s.monthlyRevenuePkr || 0;
    totalSubscribers += s.subscribersCount || 0;
    sumDetectionTimeMs += dynamics.timing.detectionTimeMs;
    if (dynamics.performance.failoverSpeedupFactor > maxSpeedup) {
      maxSpeedup = dynamics.performance.failoverSpeedupFactor;
    }
    totalPenaltyPkr += dynamics.penaltyPkr;
    return dynamics;
  });

  const meanDetectionTimeMs = +(sumDetectionTimeMs / Math.max(1, totalSessions)).toFixed(1);
  const hardwareOffloadPct = Math.round((hardwareOffloadCount / Math.max(1, totalSessions)) * 100);

  return {
    totalSessions,
    hardwareOffloadCount,
    hardwareOffloadPct,
    sub50msSessionsCount,
    sub150msSessionsCount,
    totalRevenuePkr,
    totalSubscribers,
    meanDetectionTimeMs,
    maxSpeedup,
    totalPenaltyPkr,
    analyzedSessions
  };
}

/**
 * Renders pure SVG vector visualizer for BFD session peering, heartbeat wave, echo mode and state
 * @param {Object} dynamics - Output of calculateBfdDynamics
 * @param {Object} options - SVG render options (isCompact)
 * @returns {string} SVG markup
 */
export function renderBfdDiagramSvg(dynamics, options = {}) {
  if (!dynamics) return '';

  const isCompact = Boolean(options.isCompact);
  const width = 740;
  const height = isCompact ? 160 : 250;

  const s = dynamics.session;
  const t = dynamics.timing;
  const r = dynamics.reliability;
  const p = dynamics.performance;
  const stateColor = dynamics.statusColor;

  // Pulse wave animation frequency indicator
  const pulseFreq = Math.min(3.0, Math.max(0.4, (t.detectionTimeMs / 100))).toFixed(2);

  if (isCompact) {
    return `<svg class="bfd-svg bfd-compact-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Carrier BFD Session Telemetry Overview" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bfdGradCompact" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="8" fill="url(#bfdGradCompact)"/>

      <!-- Session Title & Interface -->
      <text x="20" y="28" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui, sans-serif">${escapeXml(s.name)}</text>
      <text x="20" y="46" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">${escapeXml(s.interface)} · ${escapeXml(s.clientProtocol)} · ${escapeXml(s.rfcProfile)}</text>

      <!-- KPI Pills -->
      <g transform="translate(20, 64)">
        <!-- State -->
        <rect x="0" y="0" width="115" height="44" rx="6" fill="#1e293b" stroke="${stateColor}" stroke-width="1.5"/>
        <text x="12" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">BFD STATE</text>
        <text x="12" y="36" fill="${stateColor}" font-size="13" font-weight="800" font-family="system-ui">${escapeXml(dynamics.state)}</text>

        <!-- Detection Time -->
        <rect x="125" y="0" width="130" height="44" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="137" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">DETECTION TIME</text>
        <text x="137" y="36" fill="#38bdf8" font-size="13" font-weight="800" font-family="system-ui">${t.detectionTimeMs} ms</text>

        <!-- Transmit Timer -->
        <rect x="265" y="0" width="125" height="44" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="277" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">TX / RX INTERVAL</text>
        <text x="277" y="36" fill="#a78bfa" font-size="13" font-weight="800" font-family="system-ui">${t.negotiatedTxIntervalMs} / ${t.negotiatedRxIntervalMs} ms</text>

        <!-- Speedup Factor -->
        <rect x="400" y="0" width="140" height="44" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="412" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">FAILOVER SPEEDUP</text>
        <text x="412" y="36" fill="#34d399" font-size="13" font-weight="800" font-family="system-ui">${p.failoverSpeedupFactor}x Faster</text>

        <!-- Flap Probability -->
        <rect x="550" y="0" width="150" height="44" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
        <text x="562" y="18" fill="#94a3b8" font-size="10" font-family="system-ui">FALSE FLAP RISK</text>
        <text x="562" y="36" fill="${r.falseFlapPct > 0.01 ? '#f59e0b' : '#10b981'}" font-size="13" font-weight="800" font-family="system-ui">${r.falseFlapPct}%</text>
      </g>

      <!-- Bottom Status Bar -->
      <g transform="translate(20, 128)">
        <text x="0" y="14" fill="#64748b" font-size="10.5" font-family="system-ui">Offload: <tspan fill="#e2e8f0" font-weight="600">${s.hardwareOffload ? 'ASIC/FPGA Hardware' : 'Host CPU Software'}</tspan> · Echo: <tspan fill="#e2e8f0" font-weight="600">${dynamics.echoEnabled ? `Active (${dynamics.echoIntervalMs}ms)` : 'Disabled'}</tspan> · Multiplier: <tspan fill="#e2e8f0" font-weight="600">${dynamics.detectMultiplier}x</tspan> · Rate: <tspan fill="#e2e8f0" font-weight="600">${t.packetsPerSec} pkts/s</tspan></text>
      </g>
    </svg>`;
  }

  // Expanded Detailed Visualizer
  return `<svg class="bfd-svg bfd-expanded-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Carrier BFD Peer Architecture and Timing Diagram" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bfdGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <filter id="bfdGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <marker id="bfdArrowRight" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8"/>
      </marker>
      <marker id="bfdArrowLeft" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
        <path d="M6,0 L0,3 L6,6 Z" fill="#a78bfa"/>
      </marker>
      <marker id="bfdEchoArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b"/>
      </marker>
    </defs>

    <!-- Background Canvas -->
    <rect width="${width}" height="${height}" rx="10" fill="url(#bfdGradMain)"/>

    <!-- Header Banner -->
    <g transform="translate(24, 22)">
      <text x="0" y="0" fill="#f8fafc" font-size="14" font-weight="700" font-family="system-ui, sans-serif">${escapeXml(s.name)}</text>
      <text x="0" y="16" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">Profile: ${escapeXml(s.rfcProfile)} · Bound Client: <tspan fill="#38bdf8" font-weight="600">${escapeXml(s.clientProtocol)}</tspan> · Port: UDP ${dynamics.echoEnabled ? BFD_CONSTANTS.BFD_ECHO_PORT : BFD_CONSTANTS.BFD_CONTROL_PORT}</text>
    </g>

    <!-- State Indicator Badge Top Right -->
    <g transform="translate(${width - 150}, 16)">
      <rect x="0" y="0" width="126" height="28" rx="6" fill="#0f172a" stroke="${stateColor}" stroke-width="1.5" filter="url(#bfdGlow)"/>
      <circle cx="14" cy="14" r="5" fill="${stateColor}"/>
      <text x="26" y="18" fill="${stateColor}" font-size="12" font-weight="800" font-family="system-ui, sans-serif">STATE: ${escapeXml(dynamics.state)}</text>
    </g>

    <!-- Network Topology & Packet Transmission Model -->
    <g transform="translate(0, 68)">
      <!-- Local Peer Node -->
      <g transform="translate(30, 10)">
        <rect x="0" y="0" width="160" height="90" rx="8" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
        <rect x="0" y="0" width="160" height="24" rx="8" fill="#334155"/>
        <text x="12" y="16" fill="#f8fafc" font-size="11" font-weight="700" font-family="system-ui">LOCAL ENDPOINT</text>
        <text x="12" y="42" fill="#e2e8f0" font-size="12" font-weight="700" font-family="system-ui">${escapeXml(s.interface)}</text>
        <text x="12" y="58" fill="#94a3b8" font-size="10.5" font-family="system-ui">Area: ${escapeXml(s.primaryArea)}</text>
        <text x="12" y="74" fill="#38bdf8" font-size="10" font-weight="600" font-family="system-ui">TX: ${dynamics.desiredMinTxMs}ms · Mult: ${dynamics.detectMultiplier}x</text>
      </g>

      <!-- Bidirectional Link / Transmission Channel -->
      <g transform="translate(190, 10)">
        <!-- Forward Control Channel -->
        <line x1="10" y1="26" x2="330" y2="26" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#bfdArrowRight)"/>
        <text x="170" y="20" fill="#38bdf8" font-size="10" font-weight="600" text-anchor="middle" font-family="system-ui">Control PDU (UDP 3784) · ${t.negotiatedTxIntervalMs}ms</text>

        <!-- Reverse Control Channel -->
        <line x1="330" y1="46" x2="10" y2="46" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#bfdArrowLeft)"/>
        <text x="170" y="60" fill="#a78bfa" font-size="10" font-weight="600" text-anchor="middle" font-family="system-ui">Echo / Peer RX (UDP 3784) · ${t.negotiatedRxIntervalMs}ms</text>

        <!-- Optional Echo Loopback Wave -->
        ${dynamics.echoEnabled ? `
        <path d="M 20,18 C 170,-18 300,-18 310,18" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#bfdEchoArrow)"/>
        <text x="170" y="-4" fill="#f59e0b" font-size="10" font-weight="700" text-anchor="middle" font-family="system-ui">RFC 5880 Echo Loopback (${dynamics.echoIntervalMs}ms)</text>
        ` : ''}

        <!-- Center Failure Window Indicator -->
        <rect x="85" y="68" width="170" height="22" rx="4" fill="#0f172a" stroke="#475569" stroke-width="1"/>
        <text x="170" y="83" fill="#38bdf8" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui">Detect Window: ${t.detectionTimeMs} ms</text>
      </g>

      <!-- Remote Peer Node -->
      <g transform="translate(540, 10)">
        <rect x="0" y="0" width="170" height="90" rx="8" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
        <rect x="0" y="0" width="170" height="24" rx="8" fill="#334155"/>
        <text x="12" y="16" fill="#f8fafc" font-size="11" font-weight="700" font-family="system-ui">REMOTE PEER ENDPOINT</text>
        <text x="12" y="42" fill="#e2e8f0" font-size="12" font-weight="700" font-family="system-ui">${escapeXml(s.clientProtocol)}</text>
        <text x="12" y="58" fill="#94a3b8" font-size="10.5" font-family="system-ui">Peer AS / Router Gateway</text>
        <text x="12" y="74" fill="#a78bfa" font-size="10" font-weight="600" font-family="system-ui">RX: ${dynamics.requiredMinRxMs}ms · Diag: ${dynamics.diagCode}</text>
      </g>
    </g>

    <!-- Bottom Telemetry HUD Matrix -->
    <g transform="translate(24, 180)">
      <!-- Box 1: Detection Time vs IGP -->
      <rect x="0" y="0" width="165" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">FAILOVER TIME</text>
      <text x="10" y="34" fill="#38bdf8" font-size="13" font-weight="800" font-family="system-ui">${t.detectionTimeMs} ms</text>
      <text x="10" y="46" fill="#64748b" font-size="9" font-family="system-ui">IGP Dead: ${(p.igpDeadTimeMs / 1000).toFixed(0)}s (${p.failoverSpeedupFactor}x faster)</text>

      <!-- Box 2: Rate & Packet Transmission -->
      <rect x="175" y="0" width="165" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">PACKET RATE &amp; OFFLOAD</text>
      <text x="10" y="34" fill="#a78bfa" font-size="13" font-weight="800" font-family="system-ui">${t.packetsPerSec} pkts/sec</text>
      <text x="10" y="46" fill="#64748b" font-size="9" font-family="system-ui">${s.hardwareOffload ? 'ASIC Hardware' : 'Host CPU Soft'}</text>

      <!-- Box 3: Flap Immunity & Drop Sensitivity -->
      <rect x="350" y="0" width="170" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">FALSE FLAP RISK</text>
      <text x="10" y="34" fill="${r.falseFlapPct > 0.01 ? '#f59e0b' : '#10b981'}" font-size="13" font-weight="800" font-family="system-ui">${r.falseFlapPct}%</text>
      <text x="10" y="46" fill="#64748b" font-size="9" font-family="system-ui">Drop Rate: ${dynamics.simulatedPacketDropPct}%</text>

      <!-- Box 4: Financial & Subscriber Protection -->
      <rect x="530" y="0" width="160" height="52" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="10" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">PROTECTED REVENUE</text>
      <text x="10" y="34" fill="#34d399" font-size="13" font-weight="800" font-family="system-ui">${formatPKR(s.monthlyRevenuePkr)}</text>
      <text x="10" y="46" fill="#64748b" font-size="9" font-family="system-ui">${s.subscribersCount} Connected Users</text>
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
 * Generates audit text report for BFD session
 * @param {Object} dynamics - Output of calculateBfdDynamics
 * @param {Object} allMetrics - Output of calculateBfdMetrics
 * @returns {string} Plaintext report
 */
export function generateBfdReport(dynamics, allMetrics = null) {
  if (!dynamics) return 'No BFD telemetry data available.';

  const s = dynamics.session;
  const t = dynamics.timing;
  const r = dynamics.reliability;
  const p = dynamics.performance;

  const now = new Date().toISOString();

  let rep = `================================================================================
SHAHDARA ISP METRO FIBER - CARRIER BFD TELEMETRY & FAILOVER AUDIT REPORT
Protocol Standard: RFC 5880 / RFC 5881 / RFC 7130 (Micro-BFD on LAG)
Audit Timestamp: ${now}
================================================================================

1. SESSION IDENTITY & PROTOCOL PROFILE
--------------------------------------------------------------------------------
Session Identifier : ${s.id}
Session Description: ${s.name}
Physical Interface : ${s.interface}
RFC Profile Type   : ${s.rfcProfile}
Bound Client Prot  : ${s.clientProtocol}
Primary OLT Hub    : ${s.primaryArea}
Secondary Coverage : ${s.secondaryAreas.join(', ')}
Execution Mode     : ${s.hardwareOffload ? 'ASIC/FPGA Hardware Offload (Deterministic Microsecond)' : 'Host CPU Software Mode'}

2. NEGOTIATED TIMING PARAMETERS & STATE MACHINE
--------------------------------------------------------------------------------
Operational State  : ${dynamics.state.toUpperCase()}
RFC Diagnostic Code: ${dynamics.diagCode} (${dynamics.diagName})
Desired Min TX     : ${dynamics.desiredMinTxMs} ms
Required Min RX    : ${dynamics.requiredMinRxMs} ms
Detect Multiplier  : ${dynamics.detectMultiplier}
Echo Mode Active   : ${dynamics.echoEnabled ? `YES (Interval: ${dynamics.echoIntervalMs} ms)` : 'NO (Disabled / Unsupported)'}
Negotiated TX Int  : ${t.negotiatedTxIntervalMs} ms
Negotiated RX Int  : ${t.negotiatedRxIntervalMs} ms
Detection Time     : ${t.detectionTimeMs} ms
Jitter Tolerance   : ±${t.jitterToleranceMs} ms
Packet Rate        : ${t.packetsPerSec} packets/second

3. FAILOVER CONVERGENCE & OUTAGE REDUCTION
--------------------------------------------------------------------------------
Default IGP Dead   : ${(p.igpDeadTimeMs / 1000).toFixed(1)} seconds (${p.igpDeadTimeMs} ms)
BFD Detection Time : ${t.detectionTimeMs} ms
Failover Speedup   : ${p.failoverSpeedupFactor}x Faster than standard IGP dead timers
Outage Reduction   : ${p.outageReductionPct}%

4. PACKET LOSS SENSITIVITY & FLAP IMMUNITY
--------------------------------------------------------------------------------
Simulated Drop Rate: ${dynamics.simulatedPacketDropPct.toFixed(1)}%
False Flap Risk    : ${r.falseFlapPct}%
Flap Immunity Eval : ${r.falseFlapPct < 0.01 ? 'EXCELLENT (Impervious to burst jitter)' : 'ELEVATED (Risk of spurious link teardown)'}

5. CARRIER SLA IMPACT & REVENUE AT RISK
--------------------------------------------------------------------------------
Quality Verdict    : ${dynamics.status.toUpperCase()}
Protected Revenue  : ${formatPKR(s.monthlyRevenuePkr)} / month
Active Subscribers : ${s.subscribersCount} Accounts
SLA Penalty Rebate : ${dynamics.penaltyRebatePct}% (${formatPKR(dynamics.penaltyPkr)})
`;

  if (allMetrics) {
    rep += `
6. SHADARA METRO NETWORK BFD AGGREGATE SUMMARY
--------------------------------------------------------------------------------
Total Monitored Sessions: ${allMetrics.totalSessions}
Hardware Offloaded      : ${allMetrics.hardwareOffloadCount} (${allMetrics.hardwareOffloadPct}%)
Sub-50ms Fast Sessions  : ${allMetrics.sub50msSessionsCount}
Sub-150ms Carrier Tier  : ${allMetrics.sub150msSessionsCount}
Mean Detection Time     : ${allMetrics.meanDetectionTimeMs} ms
Max Network Speedup     : ${allMetrics.maxSpeedup}x
Total Protected Revenue : ${formatPKR(allMetrics.totalRevenuePkr)} / month
Total Protected Accounts: ${allMetrics.totalSubscribers}
Total SLA Penalties     : ${formatPKR(allMetrics.totalPenaltyPkr)}
`;
  }

  rep += `================================================================================
END OF CARRIER BFD TELEMETRY & SLA REPORT
================================================================================`;

  return rep;
}

/**
 * Exports BFD session telemetry as JSON string
 */
export function exportBfdJson(dynamics, allMetrics = null) {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    dynamics,
    allMetrics
  }, null, 2);
}

/**
 * Exports BFD session telemetry as CSV string
 */
export function exportBfdCsv(dynamics, allMetrics = null) {
  const sessions = allMetrics?.analyzedSessions || [dynamics];
  const headers = [
    'Session ID',
    'Session Name',
    'Interface',
    'Client Protocol',
    'Primary Area',
    'State',
    'Detection Time (ms)',
    'TX Interval (ms)',
    'RX Interval (ms)',
    'Multiplier',
    'Echo Enabled',
    'Speedup Factor',
    'False Flap %',
    'Hardware Offload',
    'Monthly Revenue (PKR)',
    'Subscribers',
    'Status',
    'Penalty (PKR)'
  ];

  const rows = sessions.map(d => {
    const s = d.session;
    const t = d.timing;
    const r = d.reliability;
    const p = d.performance;
    return [
      `"${s.id}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.interface}"`,
      `"${s.clientProtocol}"`,
      `"${s.primaryArea}"`,
      `"${d.state}"`,
      t.detectionTimeMs,
      t.negotiatedTxIntervalMs,
      t.negotiatedRxIntervalMs,
      d.detectMultiplier,
      d.echoEnabled ? 'TRUE' : 'FALSE',
      p.failoverSpeedupFactor,
      r.falseFlapPct,
      r.hardwareOffload ? 'TRUE' : 'FALSE',
      s.monthlyRevenuePkr,
      s.subscribersCount,
      `"${d.status}"`,
      d.penaltyPkr
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Modal and Dashboard Card Controller for BFD Telemetry
 * @param {Object} state - Application state
 * @param {Object} options - Controller options (document, onFilterArea, onToast)
 * @returns {Object} Controller interface
 */
export function setupBfdModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardBfdModal');
  const closeBtn = doc.getElementById('dashboardBfdModalCloseBtn');
  const openBtn = doc.getElementById('dashboardOpenBfdModalBtn');

  const cardChartContainer = doc.getElementById('dashboardBfdChart');
  const modalDiagramContainer = doc.getElementById('bfdModalDiagramContainer');

  // Input Controls
  const sessionSelect = doc.getElementById('bfdSessionSelect');
  const txSlider = doc.getElementById('bfdTxSlider');
  const txLabel = doc.getElementById('bfdTxLabel');
  const rxSlider = doc.getElementById('bfdRxSlider');
  const rxLabel = doc.getElementById('bfdRxLabel');
  const multiplierSlider = doc.getElementById('bfdMultiplierSlider');
  const multiplierLabel = doc.getElementById('bfdMultiplierLabel');
  const echoCheck = doc.getElementById('bfdEchoCheck');
  const lossSlider = doc.getElementById('bfdLossSlider');
  const lossLabel = doc.getElementById('bfdLossLabel');
  const resetBtn = doc.getElementById('bfdResetBtn');

  // Stat Labels
  const statStatus = doc.getElementById('bfdStatStatus');
  const statDetect = doc.getElementById('bfdStatDetect');
  const statSpeedup = doc.getElementById('bfdStatSpeedup');
  const statFlap = doc.getElementById('bfdStatFlap');
  const statRate = doc.getElementById('bfdStatRate');
  const statPenalty = doc.getElementById('bfdStatPenalty');

  // Action Buttons
  const filterAreaBtn = doc.getElementById('bfdFilterAreaBtn');
  const exportJsonBtn = doc.getElementById('bfdExportJsonBtn');
  const exportCsvBtn = doc.getElementById('bfdExportCsvBtn');
  const copyReportBtn = doc.getElementById('bfdCopyReportBtn');

  let currentSessionId = BFD_CONSTANTS.DEFAULT_SESSION_ID;
  let customTx = null;
  let customRx = null;
  let customMultiplier = null;
  let customEcho = null;
  let customLoss = null;

  function getCurrentSession() {
    return SHAHDARA_BFD_SESSIONS.find(s => s.id === currentSessionId) || SHAHDARA_BFD_SESSIONS[0];
  }

  function getCalculatedDynamics() {
    const s = getCurrentSession();
    return calculateBfdDynamics(s, {
      desiredMinTxMs: customTx !== null ? customTx : s.baselineTxIntervalMs,
      requiredMinRxMs: customRx !== null ? customRx : s.baselineRxIntervalMs,
      detectMultiplier: customMultiplier !== null ? customMultiplier : s.baselineMultiplier,
      echoEnabled: customEcho !== null ? customEcho : false,
      simulatedPacketDropPct: customLoss !== null ? customLoss : 0.0
    });
  }

  function updateUi() {
    const dynamics = getCalculatedDynamics();
    const allMetrics = calculateBfdMetrics(SHAHDARA_BFD_SESSIONS, state);

    // Update Card Chart if present
    if (cardChartContainer) {
      cardChartContainer.innerHTML = renderBfdDiagramSvg(dynamics, { isCompact: true });
    }

    // Update Modal Diagram if present
    if (modalDiagramContainer) {
      modalDiagramContainer.innerHTML = renderBfdDiagramSvg(dynamics, { isCompact: false });
    }

    // Update KPI Stat Elements
    if (statStatus) {
      statStatus.textContent = dynamics.status;
      statStatus.style.color = dynamics.statusColor;
    }
    if (statDetect) {
      statDetect.textContent = `${dynamics.timing.detectionTimeMs} ms`;
      statDetect.style.color = dynamics.timing.detectionTimeMs <= 50 ? '#10b981' : (dynamics.timing.detectionTimeMs <= 150 ? '#38bdf8' : '#f59e0b');
    }
    if (statSpeedup) {
      statSpeedup.textContent = `${dynamics.performance.failoverSpeedupFactor}x Faster`;
      statSpeedup.style.color = '#10b981';
    }
    if (statFlap) {
      statFlap.textContent = `${dynamics.reliability.falseFlapPct}%`;
      statFlap.style.color = dynamics.reliability.falseFlapPct > 0.01 ? '#ef4444' : '#10b981';
    }
    if (statRate) {
      statRate.textContent = `${dynamics.timing.packetsPerSec} pkts/s`;
      statRate.style.color = '#a78bfa';
    }
    if (statPenalty) {
      statPenalty.textContent = `${dynamics.penaltyRebatePct}% (${formatPKR(dynamics.penaltyPkr)})`;
      statPenalty.style.color = dynamics.penaltyPkr > 0 ? '#ef4444' : '#10b981';
    }

    // Update Slider Labels
    if (txLabel) txLabel.textContent = `${dynamics.desiredMinTxMs} ms`;
    if (rxLabel) rxLabel.textContent = `${dynamics.requiredMinRxMs} ms`;
    if (multiplierLabel) multiplierLabel.textContent = `${dynamics.detectMultiplier}x`;
    if (lossLabel) lossLabel.textContent = `${dynamics.simulatedPacketDropPct.toFixed(1)}%`;
  }

  function syncControls() {
    const s = getCurrentSession();
    if (sessionSelect) sessionSelect.value = s.id;
    if (txSlider) txSlider.value = String(customTx !== null ? customTx : s.baselineTxIntervalMs);
    if (rxSlider) rxSlider.value = String(customRx !== null ? customRx : s.baselineRxIntervalMs);
    if (multiplierSlider) multiplierSlider.value = String(customMultiplier !== null ? customMultiplier : s.baselineMultiplier);
    if (echoCheck) {
      echoCheck.checked = Boolean(customEcho !== null ? customEcho : false);
      echoCheck.disabled = !s.echoSupported;
    }
    if (lossSlider) lossSlider.value = String(customLoss !== null ? customLoss : 0.0);
    updateUi();
  }

  // Event Listeners
  if (sessionSelect) {
    sessionSelect.addEventListener('change', () => {
      currentSessionId = sessionSelect.value;
      customTx = null;
      customRx = null;
      customMultiplier = null;
      customEcho = null;
      customLoss = null;
      syncControls();
    });
  }

  if (txSlider) {
    txSlider.addEventListener('input', () => {
      customTx = Number(txSlider.value);
      updateUi();
    });
  }

  if (rxSlider) {
    rxSlider.addEventListener('input', () => {
      customRx = Number(rxSlider.value);
      updateUi();
    });
  }

  if (multiplierSlider) {
    multiplierSlider.addEventListener('input', () => {
      customMultiplier = Number(multiplierSlider.value);
      updateUi();
    });
  }

  if (echoCheck) {
    echoCheck.addEventListener('change', () => {
      customEcho = echoCheck.checked;
      updateUi();
    });
  }

  if (lossSlider) {
    lossSlider.addEventListener('input', () => {
      customLoss = Number(lossSlider.value);
      updateUi();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      customTx = null;
      customRx = null;
      customMultiplier = null;
      customEcho = null;
      customLoss = null;
      syncControls();
      if (typeof options.onToast === 'function') {
        options.onToast('BFD parameters reset to standard baseline.');
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
      const s = getCurrentSession();
      if (modal && typeof modal.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(s.primaryArea);
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateBfdMetrics(SHAHDARA_BFD_SESSIONS, state);
      const json = exportBfdJson(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(json).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('BFD JSON telemetry copied to clipboard.');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateBfdMetrics(SHAHDARA_BFD_SESSIONS, state);
      const csv = exportBfdCsv(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(csv).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('BFD CSV telemetry copied to clipboard.');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const dynamics = getCalculatedDynamics();
      const allMetrics = calculateBfdMetrics(SHAHDARA_BFD_SESSIONS, state);
      const report = generateBfdReport(dynamics, allMetrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(report).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('BFD audit report copied to clipboard.');
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
    getMetrics: () => calculateBfdMetrics(SHAHDARA_BFD_SESSIONS, state)
  };
}
