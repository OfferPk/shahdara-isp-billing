import { formatPKR } from './core.js';

/**
 * Carrier MPLS-TP (Multi-Protocol Label Switching Transport Profile - ITU-T G.8113.1 / RFC 5960 / RFC 6371)
 * Bidirectional 1:1 Co-Routed Path Protection & Microsecond OAM Telemetry Matrix
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Vector Visualizer & SLA Telemetry
 */

export const MPLS_TP_CONSTANTS = {
  DEFAULT_LSP_ID: 'lsp-tp-01',
  DEFAULT_CC_INTERVAL_MS: 3.33,
  FIBER_REFRACTIVE_INDEX: 1.4682,
  SPEED_OF_LIGHT_KM_PER_US: 0.299792458,

  CC_INTERVALS: {
    FAST_3_33: { ms: 3.33, label: '3.33 ms (Fastest - 10ms Defect Detection)', detectionMultiplier: 3 },
    STANDARD_10: { ms: 10.0, label: '10.0 ms (Standard Carrier Backhaul)', detectionMultiplier: 3 },
    RELAXED_100: { ms: 100.0, label: '100.0 ms (Long-Haul Metro Ring)', detectionMultiplier: 3 },
    MINIMAL_1000: { ms: 1000.0, label: '1000.0 ms (Low-Overhead Periodic Keepalive)', detectionMultiplier: 3 }
  },

  FAULTS: {
    NONE: { code: 'NONE', label: 'Normal (Working Path Active)', severity: 'nominal', description: 'Dual co-routed paths healthy, traffic forwarding over Working LSP' },
    WORKING_CUT: { code: 'WORKING_CUT', label: 'Working Path Fiber Cut (Sub-50ms Switched)', severity: 'warning', description: 'Underground conduit severed; APS hardware switched traffic to Protection LSP in < 50ms' },
    PROTECTION_CUT: { code: 'PROTECTION_CUT', label: 'Protection Path Degradation', severity: 'warning', description: 'Backup path damaged; 1:1 redundancy temporarily lost, working path intact' },
    MANUAL_SWITCH: { code: 'MANUAL_SWITCH', label: 'Manual Switch for Maintenance (MS)', severity: 'nominal', description: 'Operator administrative switch to Protection LSP for scheduled fiber maintenance' },
    LOCKOUT: { code: 'LOCKOUT', label: 'Lockout of Protection (LO)', severity: 'warning', description: 'Protection path locked out from carrying traffic by carrier command' },
    DOUBLE_FAULT: { code: 'DOUBLE_FAULT', label: 'Catastrophic Dual Fiber Cut (Outage)', severity: 'critical', description: 'Simultaneous loss of both Working and Protection paths, SLA breached' }
  },

  STATUS: {
    OPTIMAL: 'Optimal (Working Path 1:1 Co-Routed, Resilient Headroom)',
    PROTECTED_ACTIVE: 'Protection Active (Sub-50ms Switched, 100% Traffic Preserved)',
    REDUNDANCY_DEGRADED: 'Degraded Redundancy (Backup Path Unavailable)',
    OUTAGE: 'Critical Path Failure (Dual Path Fault, Service Disrupted)'
  }
};

export const SHAHDARA_MPLS_TP_LSPS = [
  {
    id: 'lsp-tp-01',
    name: 'Shahdara Central OLT <-> Ravi Siphon Metro Aggregation LSP',
    primaryArea: 'Ravi Siphon',
    targetArea: 'Shahdara Town',
    bandwidthGbps: 10,
    workingRoute: 'Direct Underground Fiber via Old GT Road',
    workingDistanceKm: 18.6,
    protectionRoute: 'Aerial ADSS Backup via Ravi Siphon Barrage',
    protectionDistanceKm: 24.2,
    defaultCcIntervalMs: 3.33,
    workingInLabels: 'LSP-In: 10101 / PW-In: 201',
    workingOutLabels: 'LSP-Out: 10102 / PW-Out: 202',
    protectionInLabels: 'LSP-In: 10191 / PW-In: 291',
    protectionOutLabels: 'LSP-Out: 10192 / PW-Out: 292',
    monthlyRevenuePkr: 4800000,
    subscribersCount: 890
  },
  {
    id: 'lsp-tp-02',
    name: 'Begum Kot Business POP <-> Baradari Banking & Civic DC LSP',
    primaryArea: 'Begum Kot',
    targetArea: 'Baradari',
    bandwidthGbps: 10,
    workingRoute: 'Begum Kot High-Density Express Duct',
    workingDistanceKm: 14.8,
    protectionRoute: 'Vandala Road Secondary Metro Ring',
    protectionDistanceKm: 19.4,
    defaultCcIntervalMs: 10.0,
    workingInLabels: 'LSP-In: 10201 / PW-In: 301',
    workingOutLabels: 'LSP-Out: 10202 / PW-Out: 302',
    protectionInLabels: 'LSP-In: 10291 / PW-In: 391',
    protectionOutLabels: 'LSP-Out: 10292 / PW-Out: 392',
    monthlyRevenuePkr: 4200000,
    subscribersCount: 720
  },
  {
    id: 'lsp-tp-03',
    name: 'Jia Musa Industrial Zone <-> Shahdara Core Transponder Hub LSP',
    primaryArea: 'Jia Musa',
    targetArea: 'Shahdara Town',
    bandwidthGbps: 5,
    workingRoute: 'Jia Musa Railway Crossing Conduit Trench',
    workingDistanceKm: 11.5,
    protectionRoute: 'Eastern Feeder Canal Right-of-Way',
    protectionDistanceKm: 16.2,
    defaultCcIntervalMs: 10.0,
    workingInLabels: 'LSP-In: 10301 / PW-In: 401',
    workingOutLabels: 'LSP-Out: 10302 / PW-Out: 402',
    protectionInLabels: 'LSP-In: 10391 / PW-In: 491',
    protectionOutLabels: 'LSP-Out: 10392 / PW-Out: 492',
    monthlyRevenuePkr: 3100000,
    subscribersCount: 510
  },
  {
    id: 'lsp-tp-04',
    name: 'Kot Abdul Malik Core Gateway <-> GT Road Wholesale Transit LSP',
    primaryArea: 'Kot Abdul Malik',
    targetArea: 'Shahdara Core',
    bandwidthGbps: 20,
    workingRoute: 'GT Road Highway Armored Trench Duct',
    workingDistanceKm: 22.4,
    protectionRoute: 'Ring Road Northern Optical Pipeline',
    protectionDistanceKm: 28.7,
    defaultCcIntervalMs: 3.33,
    workingInLabels: 'LSP-In: 10401 / PW-In: 501',
    workingOutLabels: 'LSP-Out: 10402 / PW-Out: 502',
    protectionInLabels: 'LSP-In: 10491 / PW-In: 591',
    protectionOutLabels: 'LSP-Out: 10492 / PW-Out: 592',
    monthlyRevenuePkr: 5500000,
    subscribersCount: 980
  },
  {
    id: 'lsp-tp-05',
    name: 'Shahdara Town Municipal Security & Surveillance Backbone LSP',
    primaryArea: 'Shahdara Town',
    targetArea: 'Baradari',
    bandwidthGbps: 2.5,
    workingRoute: 'City Center Dedicated Underground Fiber',
    workingDistanceKm: 7.8,
    protectionRoute: 'Western Overhead Tension Cable Run',
    protectionDistanceKm: 12.1,
    defaultCcIntervalMs: 100.0,
    workingInLabels: 'LSP-In: 10501 / PW-In: 601',
    workingOutLabels: 'LSP-Out: 10502 / PW-Out: 602',
    protectionInLabels: 'LSP-In: 10591 / PW-In: 691',
    protectionOutLabels: 'LSP-Out: 10592 / PW-Out: 692',
    monthlyRevenuePkr: 2400000,
    subscribersCount: 430
  }
];

// Interactive state variables
let currentSelectedLspId = MPLS_TP_CONSTANTS.DEFAULT_LSP_ID;
let currentCcIntervalMs = MPLS_TP_CONSTANTS.DEFAULT_CC_INTERVAL_MS;
let currentInjectedFault = 'NONE'; // 'NONE', 'WORKING_CUT', 'PROTECTION_CUT', 'MANUAL_SWITCH', 'LOCKOUT', 'DOUBLE_FAULT'

export function getMplsTpSelectedLspId() {
  return currentSelectedLspId;
}

export function setMplsTpSelectedLspId(id) {
  if (SHAHDARA_MPLS_TP_LSPS.some(l => l.id === id)) {
    currentSelectedLspId = id;
  }
}

export function getMplsTpCcIntervalMs() {
  return currentCcIntervalMs;
}

export function setMplsTpCcIntervalMs(val) {
  const num = parseFloat(val);
  if (!Number.isNaN(num) && num > 0) {
    currentCcIntervalMs = num;
  }
}

export function getMplsTpInjectedFault() {
  return currentInjectedFault;
}

export function setMplsTpInjectedFault(faultCode) {
  if (MPLS_TP_CONSTANTS.FAULTS[faultCode]) {
    currentInjectedFault = faultCode;
  }
}

export function resetMplsTpSimState() {
  currentSelectedLspId = MPLS_TP_CONSTANTS.DEFAULT_LSP_ID;
  currentCcIntervalMs = MPLS_TP_CONSTANTS.DEFAULT_CC_INTERVAL_MS;
  currentInjectedFault = 'NONE';
}

/**
 * Calculates one-way propagation delay in microseconds (µs) through optical fiber.
 * Delay (µs) = Distance (km) * (n / c) * 1000
 */
export function calculateMplsTpFiberDelay(distanceKm) {
  const speedOfLightInFiberKmPerUs = MPLS_TP_CONSTANTS.SPEED_OF_LIGHT_KM_PER_US / MPLS_TP_CONSTANTS.FIBER_REFRACTIVE_INDEX;
  const delayUs = distanceKm / speedOfLightInFiberKmPerUs;
  return Math.round(delayUs * 10) / 10;
}

/**
 * Calculates ITU-T G.8131 protection switching time budget in milliseconds.
 * Total Switch Time = 3 * CC_Interval + APS_PDU_Propagation + ASIC_Hardware_Forwarding
 */
export function calculateMplsTpSwitchBudget(ccIntervalMs) {
  const defectDetectionTimeMs = Math.round(ccIntervalMs * 3 * 100) / 100;
  const apsSignalingTimeMs = 2.5; // G-ACh APS exchange
  const hardwareAsicSwitchMs = 1.5; // Line card hardware switchover
  const totalSwitchingTimeMs = Math.round((defectDetectionTimeMs + apsSignalingTimeMs + hardwareAsicSwitchMs) * 100) / 100;
  const meetsSub50msSla = totalSwitchingTimeMs <= 50.0;

  return {
    ccIntervalMs,
    defectDetectionTimeMs,
    apsSignalingTimeMs,
    hardwareAsicSwitchMs,
    totalSwitchingTimeMs,
    meetsSub50msSla
  };
}

/**
 * Evaluates the full operational dynamics for the selected MPLS-TP LSP.
 */
export function calculateMplsTpDynamics(state = {}, options = {}) {
  const lspId = options.lspId || currentSelectedLspId;
  const ccInterval = options.ccIntervalMs !== undefined ? options.ccIntervalMs : currentCcIntervalMs;
  const fault = options.injectedFault || currentInjectedFault;

  const lsp = SHAHDARA_MPLS_TP_LSPS.find(l => l.id === lspId) || SHAHDARA_MPLS_TP_LSPS[0];
  const switchBudget = calculateMplsTpSwitchBudget(ccInterval);

  const workingDelayUs = calculateMplsTpFiberDelay(lsp.workingDistanceKm);
  const protectionDelayUs = calculateMplsTpFiberDelay(lsp.protectionDistanceKm);
  const delayDifferentialUs = Math.round((protectionDelayUs - workingDelayUs) * 10) / 10;

  const activeFault = MPLS_TP_CONSTANTS.FAULTS[fault] || MPLS_TP_CONSTANTS.FAULTS.NONE;

  // Active path selection and traffic forwarding state
  let activePath = 'WORKING'; // 'WORKING', 'PROTECTION', 'NONE'
  let trafficForwardingPct = 100;
  let packetLossPct = 0.0;
  let activeDelayUs = workingDelayUs;
  let status = MPLS_TP_CONSTANTS.STATUS.OPTIMAL;

  if (fault === 'WORKING_CUT') {
    activePath = 'PROTECTION';
    activeDelayUs = protectionDelayUs;
    status = MPLS_TP_CONSTANTS.STATUS.PROTECTED_ACTIVE;
    // Transient switchover packet drop equivalent to switch duration
    packetLossPct = Math.round((switchBudget.totalSwitchingTimeMs / 1000) * 0.05 * 1000) / 1000;
  } else if (fault === 'MANUAL_SWITCH') {
    activePath = 'PROTECTION';
    activeDelayUs = protectionDelayUs;
    status = MPLS_TP_CONSTANTS.STATUS.PROTECTED_ACTIVE;
    packetLossPct = 0.0; // Hitless make-before-break manual switch
  } else if (fault === 'PROTECTION_CUT') {
    activePath = 'WORKING';
    activeDelayUs = workingDelayUs;
    status = MPLS_TP_CONSTANTS.STATUS.REDUNDANCY_DEGRADED;
    packetLossPct = 0.0;
  } else if (fault === 'LOCKOUT') {
    activePath = 'WORKING';
    activeDelayUs = workingDelayUs;
    status = MPLS_TP_CONSTANTS.STATUS.REDUNDANCY_DEGRADED;
    packetLossPct = 0.0;
  } else if (fault === 'DOUBLE_FAULT') {
    activePath = 'NONE';
    trafficForwardingPct = 0;
    packetLossPct = 100.0;
    activeDelayUs = 0;
    status = MPLS_TP_CONSTANTS.STATUS.OUTAGE;
  }

  return {
    lsp,
    ccInterval,
    switchBudget,
    workingDelayUs,
    protectionDelayUs,
    delayDifferentialUs,
    activeFault,
    activePath,
    trafficForwardingPct,
    packetLossPct,
    activeDelayUs,
    status
  };
}

/**
 * Calculates fleet-wide summary metrics across all Shahdara MPLS-TP carrier LSPs.
 */
export function calculateMplsTpMetrics(state = {}, options = {}) {
  let totalLsps = SHAHDARA_MPLS_TP_LSPS.length;
  let totalBandwidthGbps = 0;
  let totalMonthlyRevenuePkr = 0;
  let totalSubscribersProtected = 0;
  let optimalCount = 0;
  let protectedActiveCount = 0;
  let degradedCount = 0;
  let outageCount = 0;
  let sumSwitchTimeMs = 0;

  for (const lsp of SHAHDARA_MPLS_TP_LSPS) {
    totalBandwidthGbps += lsp.bandwidthGbps;
    totalMonthlyRevenuePkr += lsp.monthlyRevenuePkr;
    totalSubscribersProtected += lsp.subscribersCount;

    const dyn = calculateMplsTpDynamics(state, { lspId: lsp.id, injectedFault: 'NONE' });
    sumSwitchTimeMs += dyn.switchBudget.totalSwitchingTimeMs;
    optimalCount++;
  }

  const averageSwitchTimeMs = totalLsps > 0 ? Math.round((sumSwitchTimeMs / totalLsps) * 100) / 100 : 0;

  return {
    totalLsps,
    totalBandwidthGbps,
    totalMonthlyRevenuePkr,
    totalSubscribersProtected,
    optimalCount,
    protectedActiveCount,
    degradedCount,
    outageCount,
    averageSwitchTimeMs
  };
}

/**
 * Pure-vector SVG visualizer depicting dual-rail bidirectional 1:1 MPLS-TP path architecture,
 * G-ACh OAM continuity check heartbeats, sub-50ms APS signaling, and microsecond latency gauges.
 */
export function renderMplsTpDiagramSvg(dynamics, options = {}) {
  const isDark = options.isDark ?? false;
  const compact = options.compact ?? false;

  const dyn = dynamics || calculateMplsTpDynamics();
  const { lsp, switchBudget, workingDelayUs, protectionDelayUs, activeFault, activePath, status, trafficForwardingPct } = dyn;

  const width = compact ? 720 : 860;
  const height = compact ? 330 : 410;

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  // Severity color
  let statusColor = '#10b981'; // nominal green
  if (activeFault.severity === 'warning') statusColor = '#f59e0b'; // amber
  if (activeFault.severity === 'critical') statusColor = '#ef4444'; // red

  // Node coordinates
  const pe1X = 70;
  const pe2X = width - 70;
  const railH = compact ? 120 : 150;
  const topY = compact ? 85 : 95;
  const botY = topY + railH;
  const midY = (topY + botY) / 2;

  // Rail styles
  const isWorkingActive = activePath === 'WORKING';
  const isProtectionActive = activePath === 'PROTECTION';
  const isWorkingCut = ['WORKING_CUT', 'DOUBLE_FAULT'].includes(activeFault.code);
  const isProtectionCut = ['PROTECTION_CUT', 'DOUBLE_FAULT'].includes(activeFault.code);

  const workingRailColor = isWorkingCut ? '#ef4444' : isWorkingActive ? '#10b981' : '#64748b';
  const protectionRailColor = isProtectionCut ? '#ef4444' : isProtectionActive ? '#3b82f6' : '#94a3b8';

  return `
  <svg class="mpls-tp-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MPLS-TP 1:1 Path Protection Architecture and Microsecond OAM Telemetry">
    <!-- Canvas Background -->
    <rect width="${width}" height="${height}" rx="10" fill="${bgColor}" stroke="${borderColor}" stroke-width="1.5"/>

    <!-- Header Section -->
    <g transform="translate(30, 28)">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="${textPrimary}">
        ${lsp.name}
      </text>
      <text x="0" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="500" fill="${textMuted}">
        Bandwidth: ${lsp.bandwidthGbps} Gbps CIR · Co-Routed 1:1 Bidirectional · Protection Switch: ${switchBudget.totalSwitchingTimeMs} ms (&lt; 50 ms SLA) · Revenue: ${formatPKR(lsp.monthlyRevenuePkr)}
      </text>
      <!-- Defect Pill -->
      <g transform="translate(${width - 250}, -10)">
        <rect width="190" height="26" rx="13" fill="${statusColor}" fill-opacity="0.15" stroke="${statusColor}" stroke-width="1.5"/>
        <circle cx="14" cy="13" r="5" fill="${statusColor}"/>
        <text x="26" y="17" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${statusColor}">
          ${activeFault.code} (${activeFault.severity.toUpperCase()})
        </text>
      </g>
    </g>

    <!-- Architecture Diagram Canvas -->
    <g>
      <!-- Rail 1: Working LSP (Top) -->
      <path d="M ${pe1X + 40} ${topY} Q ${width / 2} ${topY - 20} ${pe2X - 40} ${topY}" fill="none" stroke="${workingRailColor}" stroke-width="${isWorkingActive ? 3.5 : 2}" stroke-dasharray="${isWorkingCut ? '6 4' : 'none'}"/>
      <!-- Working Label Tag -->
      <rect x="${width / 2 - 130}" y="${topY - 42}" width="260" height="22" rx="4" fill="${cardBg}" stroke="${workingRailColor}" stroke-width="1"/>
      <text x="${width / 2}" y="${topY - 27}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="700" fill="${workingRailColor}">
        WORKING LSP: ${lsp.workingDistanceKm} km (${workingDelayUs} µs) · ${isWorkingCut ? 'FIBER CUT SEVERED' : isWorkingActive ? 'ACTIVE FORWARDING (0% LOSS)' : 'STANDBY'}
      </text>

      <!-- Rail 2: Protection LSP (Bottom) -->
      <path d="M ${pe1X + 40} ${botY} Q ${width / 2} ${botY + 20} ${pe2X - 40} ${botY}" fill="none" stroke="${protectionRailColor}" stroke-width="${isProtectionActive ? 3.5 : 2}" stroke-dasharray="${isProtectionCut ? '6 4' : 'none'}"/>
      <!-- Protection Label Tag -->
      <rect x="${width / 2 - 140}" y="${botY + 18}" width="280" height="22" rx="4" fill="${cardBg}" stroke="${protectionRailColor}" stroke-width="1"/>
      <text x="${width / 2}" y="${botY + 33}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="700" fill="${protectionRailColor}">
        PROTECTION LSP: ${lsp.protectionDistanceKm} km (${protectionDelayUs} µs) · ${isProtectionCut ? 'DAMAGED' : isProtectionActive ? 'ACTIVE 1:1 SWITCHED' : 'HOT-STANDBY'}
      </text>

      <!-- G-ACh OAM CC Heartbeat Pulse (Middle) -->
      <line x1="${pe1X + 50}" y1="${midY}" x2="${pe2X - 50}" y2="${midY}" stroke="#8b5cf6" stroke-width="1.5" stroke-dasharray="3 3"/>
      <rect x="${width / 2 - 110}" y="${midY - 11}" width="220" height="20" rx="10" fill="${cardBg}" stroke="#8b5cf6" stroke-width="1"/>
      <text x="${width / 2}" y="${midY + 3}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#8b5cf6">
        G-ACh CC-V Heartbeat (${dyn.ccInterval} ms) · Detection: ${switchBudget.defectDetectionTimeMs} ms
      </text>

      <!-- PE Router Node 1 (Ingress / Primary Area) -->
      <g transform="translate(${pe1X}, ${midY})">
        <rect x="-40" y="-35" width="80" height="70" rx="8" fill="${cardBg}" stroke="${borderColor}" stroke-width="2"/>
        <circle cx="0" cy="-6" r="14" fill="#047857" fill-opacity="0.15" stroke="#047857" stroke-width="1.5"/>
        <text x="0" y="-2" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#047857">PE-01</text>
        <text x="0" y="16" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">${lsp.primaryArea}</text>
        <text x="0" y="27" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="500" fill="${textMuted}">Ingress LER</text>
      </g>

      <!-- PE Router Node 2 (Egress / Target Area) -->
      <g transform="translate(${pe2X}, ${midY})">
        <rect x="-40" y="-35" width="80" height="70" rx="8" fill="${cardBg}" stroke="${borderColor}" stroke-width="2"/>
        <circle cx="0" cy="-6" r="14" fill="#047857" fill-opacity="0.15" stroke="#047857" stroke-width="1.5"/>
        <text x="0" y="-2" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#047857">PE-02</text>
        <text x="0" y="16" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">${lsp.targetArea}</text>
        <text x="0" y="27" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="500" fill="${textMuted}">Egress LER</text>
      </g>
    </g>

    <!-- Bottom Telemetry HUD Cards -->
    <g transform="translate(30, ${botY + (compact ? 45 : 55)})">
      <!-- Card 1: Active Latency -->
      <rect x="0" y="0" width="${(width - 90) / 4}" height="70" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="12" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${textMuted}">ACTIVE 1-WAY LATENCY</text>
      <text x="12" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="${textPrimary}">${dyn.activeDelayUs} µs</text>
      <text x="12" y="56" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${textMuted}">Working: ${workingDelayUs}µs | Prot: ${protectionDelayUs}µs</text>

      <!-- Card 2: Protection Switchover Budget -->
      <rect x="${(width - 90) / 4 + 10}" y="0" width="${(width - 90) / 4}" height="70" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="${(width - 90) / 4 + 22}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${textMuted}">SWITCH TIME BUDGET</text>
      <text x="${(width - 90) / 4 + 22}" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="#047857">${switchBudget.totalSwitchingTimeMs} ms</text>
      <text x="${(width - 90) / 4 + 22}" y="56" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${textMuted}">Target: &lt; 50 ms (ITU-T G.8131)</text>

      <!-- Card 3: Traffic Forwarding & Loss -->
      <rect x="${((width - 90) / 4) * 2 + 20}" y="0" width="${(width - 90) / 4}" height="70" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="${((width - 90) / 4) * 2 + 32}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${textMuted}">FORWARDING &amp; LOSS</text>
      <text x="${((width - 90) / 4) * 2 + 32}" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="700" fill="${statusColor}">${trafficForwardingPct}% (${dyn.packetLossPct}% Loss)</text>
      <text x="${((width - 90) / 4) * 2 + 32}" y="56" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${textMuted}">Active Rail: ${activePath}</text>

      <!-- Card 4: OAM CC Interval & Defect -->
      <rect x="${((width - 90) / 4) * 3 + 30}" y="0" width="${(width - 90) / 4}" height="70" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="${((width - 90) / 4) * 3 + 42}" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${textMuted}">OAM CC HEARTBEAT</text>
      <text x="${((width - 90) / 4) * 3 + 42}" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="700" fill="${textPrimary}">${dyn.ccInterval} ms</text>
      <text x="${((width - 90) / 4) * 3 + 42}" y="56" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${textMuted}">Defect Multiplier: 3x</text>
    </g>

    <!-- Footer Status Line -->
    <g transform="translate(30, ${height - 14})">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="600" fill="${textMuted}">
        State: <tspan font-weight="700" fill="${statusColor}">${status}</tspan> · Delay Differential: <tspan font-weight="700" fill="${textPrimary}">+${dyn.delayDifferentialUs} µs</tspan> · Protected Subscribers: <tspan font-weight="700" fill="#047857">${lsp.subscribersCount}</tspan>
      </text>
      <text x="${width - 60}" y="0" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="500" fill="${textMuted}">
        ITU-T G.8113.1 / RFC 5960 MPLS-TP OAM
      </text>
    </g>
  </svg>
  `;
}

/**
 * Generates plain-text SLA & compliance audit briefing for the MPLS-TP matrix.
 */
export function generateMplsTpReport(state = {}) {
  const dyn = calculateMplsTpDynamics(state);
  const metrics = calculateMplsTpMetrics(state);

  return [
    '========================================================================',
    '        SHAHDARA CARRIER MPLS-TP (ITU-T G.8113.1) SLA AUDIT REPORT',
    '========================================================================',
    `Timestamp: ${new Date().toISOString()}`,
    `Primary LSP: ${dyn.lsp.name}`,
    `Bandwidth CIR: ${dyn.lsp.bandwidthGbps} Gbps`,
    `Endpoints: ${dyn.lsp.primaryArea} <-> ${dyn.lsp.targetArea}`,
    '',
    'PHYSICAL FIBER DISJOINT ROUTES & PROPAGATION DELAY:',
    `  Working Path: ${dyn.lsp.workingRoute}`,
    `    Distance: ${dyn.lsp.workingDistanceKm} km`,
    `    1-Way Propagation Delay: ${dyn.workingDelayUs} µs`,
    `    Label Allocation: ${dyn.lsp.workingInLabels} / ${dyn.lsp.workingOutLabels}`,
    `  Protection Path: ${dyn.lsp.protectionRoute}`,
    `    Distance: ${dyn.lsp.protectionDistanceKm} km`,
    `    1-Way Propagation Delay: ${dyn.protectionDelayUs} µs`,
    `    Delay Differential: +${dyn.delayDifferentialUs} µs`,
    `    Label Allocation: ${dyn.lsp.protectionInLabels} / ${dyn.lsp.protectionOutLabels}`,
    '',
    'OAM TELEMETRY & 1:1 PROTECTION SWITCHING BUDGET:',
    `  CC-V Heartbeat Interval: ${dyn.ccInterval} ms`,
    `  Defect Detection Window (3x CC): ${dyn.switchBudget.defectDetectionTimeMs} ms`,
    `  G-ACh APS Protocol Signaling: ${dyn.switchBudget.apsSignalingTimeMs} ms`,
    `  Line Card Hardware ASIC Switch: ${dyn.switchBudget.hardwareAsicSwitchMs} ms`,
    `  Total Switchover Latency: ${dyn.switchBudget.totalSwitchingTimeMs} ms`,
    `  Sub-50ms SLA Conformance: ${dyn.switchBudget.meetsSub50msSla ? 'PASSED (Compliant)' : 'BREACHED'}`,
    '',
    'REAL-TIME FAULT & OPERATIONAL STATUS:',
    `  Active Fault: ${dyn.activeFault.code} (${dyn.activeFault.label})`,
    `  Fault Severity: ${dyn.activeFault.severity.toUpperCase()}`,
    `  Active Rail: ${dyn.activePath}`,
    `  Traffic Delivery: ${dyn.trafficForwardingPct}% (${dyn.packetLossPct}% Packet Loss)`,
    `  Current 1-Way Latency: ${dyn.activeDelayUs} µs`,
    `  Operational Status: ${dyn.status}`,
    `  Monthly Revenue Protected: ${formatPKR(dyn.lsp.monthlyRevenuePkr)}`,
    `  Subscribers at Risk: ${dyn.lsp.subscribersCount}`,
    '',
    'FLEET-WIDE CARRIER MPLS-TP SUMMARY:',
    `  Total Provisioned LSPs: ${metrics.totalLsps}`,
    `  Total Backbone Bandwidth: ${metrics.totalBandwidthGbps} Gbps`,
    `  Fleet Average Switchover Time: ${metrics.averageSwitchTimeMs} ms`,
    `  Optimal / Protected / Degraded / Outage LSPs: ${metrics.optimalCount} / ${metrics.protectedActiveCount} / ${metrics.degradedCount} / ${metrics.outageCount}`,
    `  Total Protected Revenue: ${formatPKR(metrics.totalMonthlyRevenuePkr)}`,
    `  Total Protected Subscribers: ${metrics.totalSubscribersProtected}`,
    '========================================================================'
  ].join('\n');
}

/**
 * Exports current MPLS-TP telemetry state as JSON string.
 */
export function exportMplsTpJson(state = {}) {
  const dyn = calculateMplsTpDynamics(state);
  const metrics = calculateMplsTpMetrics(state);

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    selectedLsp: {
      id: dyn.lsp.id,
      name: dyn.lsp.name,
      bandwidthGbps: dyn.lsp.bandwidthGbps,
      primaryArea: dyn.lsp.primaryArea,
      targetArea: dyn.lsp.targetArea,
      workingRoute: dyn.lsp.workingRoute,
      workingDistanceKm: dyn.lsp.workingDistanceKm,
      workingDelayUs: dyn.workingDelayUs,
      protectionRoute: dyn.lsp.protectionRoute,
      protectionDistanceKm: dyn.lsp.protectionDistanceKm,
      protectionDelayUs: dyn.protectionDelayUs,
      delayDifferentialUs: dyn.delayDifferentialUs,
      monthlyRevenuePkr: dyn.lsp.monthlyRevenuePkr,
      subscribersCount: dyn.lsp.subscribersCount
    },
    oamTelemetry: {
      ccIntervalMs: dyn.ccInterval,
      switchBudget: dyn.switchBudget,
      activePath: dyn.activePath,
      trafficForwardingPct: dyn.trafficForwardingPct,
      packetLossPct: dyn.packetLossPct,
      activeDelayUs: dyn.activeDelayUs
    },
    faults: {
      code: dyn.activeFault.code,
      label: dyn.activeFault.label,
      severity: dyn.activeFault.severity,
      description: dyn.activeFault.description,
      status: dyn.status
    },
    fleetMetrics: metrics
  }, null, 2);
}

/**
 * Exports current MPLS-TP telemetry state as CSV string.
 */
export function exportMplsTpCsv(state = {}) {
  const headers = [
    'LspId',
    'LspName',
    'BandwidthGbps',
    'PrimaryArea',
    'WorkingKm',
    'WorkingDelayUs',
    'ProtectionKm',
    'ProtectionDelayUs',
    'CcIntervalMs',
    'SwitchTimeMs',
    'ActivePath',
    'TrafficForwardingPct',
    'PacketLossPct',
    'FaultCode',
    'Status',
    'MonthlyRevenuePkr',
    'Subscribers'
  ];

  const dyn = calculateMplsTpDynamics(state);
  const l = dyn.lsp;

  const row = [
    l.id,
    `"${l.name}"`,
    l.bandwidthGbps,
    l.primaryArea,
    l.workingDistanceKm,
    dyn.workingDelayUs,
    l.protectionDistanceKm,
    dyn.protectionDelayUs,
    dyn.ccInterval,
    dyn.switchBudget.totalSwitchingTimeMs,
    dyn.activePath,
    dyn.trafficForwardingPct,
    dyn.packetLossPct,
    dyn.activeFault.code,
    `"${dyn.status}"`,
    l.monthlyRevenuePkr,
    l.subscribersCount
  ];

  return headers.join(',') + '\n' + row.join(',');
}

/**
 * Modal and dashboard card UI controller for MPLS-TP Matrix.
 */
export function setupMplsTpModal(state = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardMplsTpModal');
  const openBtn = doc.getElementById('dashboardOpenMplsTpModalBtn');
  const closeBtn = doc.getElementById('dashboardMplsTpModalCloseBtn');

  const cardChart = doc.getElementById('dashboardMplsTpChart');
  const modalDiagram = doc.getElementById('mplsTpModalDiagramContainer');

  const lspSelect = doc.getElementById('mplsTpLspSelect');
  const ccSelect = doc.getElementById('mplsTpCcIntervalSelect');
  const faultSelect = doc.getElementById('mplsTpFaultSelect');
  const resetBtn = doc.getElementById('mplsTpResetBtn');

  // Stats in modal
  const statBandwidth = doc.getElementById('mplsTpStatBandwidth');
  const statSwitchTime = doc.getElementById('mplsTpStatSwitchTime');
  const statActiveDelay = doc.getElementById('mplsTpStatActiveDelay');
  const statForwarding = doc.getElementById('mplsTpStatForwarding');
  const statCcInterval = doc.getElementById('mplsTpStatCcInterval');
  const statFault = doc.getElementById('mplsTpStatFault');

  // Action buttons
  const filterAreaBtn = doc.getElementById('mplsTpFilterAreaBtn');
  const exportJsonBtn = doc.getElementById('mplsTpExportJsonBtn');
  const exportCsvBtn = doc.getElementById('mplsTpExportCsvBtn');
  const copyReportBtn = doc.getElementById('mplsTpCopyReportBtn');

  const renderView = () => {
    const isDark = doc.documentElement && doc.documentElement.getAttribute('data-theme') === 'dark';
    const dyn = calculateMplsTpDynamics(state);

    if (cardChart) {
      cardChart.innerHTML = renderMplsTpDiagramSvg(dyn, { isDark, compact: true });
    }
    if (modalDiagram) {
      modalDiagram.innerHTML = renderMplsTpDiagramSvg(dyn, { isDark, compact: false });
    }

    if (statBandwidth) {
      statBandwidth.textContent = `${dyn.lsp.bandwidthGbps} Gbps CIR`;
    }
    if (statSwitchTime) {
      statSwitchTime.textContent = `${dyn.switchBudget.totalSwitchingTimeMs} ms (< 50ms)`;
    }
    if (statActiveDelay) {
      statActiveDelay.textContent = `${dyn.activeDelayUs} µs (${dyn.activePath})`;
    }
    if (statForwarding) {
      statForwarding.textContent = `${dyn.trafficForwardingPct}% (${dyn.packetLossPct}% loss)`;
      statForwarding.style.color = dyn.trafficForwardingPct < 100 ? '#ef4444' : '#10b981';
    }
    if (statCcInterval) {
      statCcInterval.textContent = `${dyn.ccInterval} ms (3x detect)`;
    }
    if (statFault) {
      statFault.textContent = dyn.activeFault.code;
      statFault.style.color = dyn.activeFault.severity === 'critical' ? '#ef4444' : dyn.activeFault.severity === 'warning' ? '#f59e0b' : '#10b981';
    }
  };

  if (lspSelect) {
    lspSelect.addEventListener('change', () => {
      setMplsTpSelectedLspId(lspSelect.value);
      renderView();
    });
  }

  if (ccSelect) {
    ccSelect.addEventListener('change', () => {
      setMplsTpCcIntervalMs(parseFloat(ccSelect.value));
      renderView();
    });
  }

  if (faultSelect) {
    faultSelect.addEventListener('change', () => {
      setMplsTpInjectedFault(faultSelect.value);
      renderView();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetMplsTpSimState();
      if (lspSelect) lspSelect.value = getMplsTpSelectedLspId();
      if (ccSelect) ccSelect.value = getMplsTpCcIntervalMs();
      if (faultSelect) faultSelect.value = getMplsTpInjectedFault();
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('MPLS-TP 1:1 LSP parameters reset to baseline');
      }
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const dyn = calculateMplsTpDynamics(state);
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(dyn.lsp.primaryArea);
      }
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const jsonStr = exportMplsTpJson(state);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(jsonStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('MPLS-TP JSON telemetry copied to clipboard');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csvStr = exportMplsTpCsv(state);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(csvStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('MPLS-TP CSV telemetry copied to clipboard');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const report = generateMplsTpReport(state);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(report);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('MPLS-TP SLA audit report copied to clipboard');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      if (lspSelect) lspSelect.value = getMplsTpSelectedLspId();
      if (ccSelect) ccSelect.value = getMplsTpCcIntervalMs();
      if (faultSelect) faultSelect.value = getMplsTpInjectedFault();
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
