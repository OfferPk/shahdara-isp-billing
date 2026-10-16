import { formatPKR } from './core.js';

/**
 * Carrier MPLS Segment Routing (SR-MPLS / SRv6 - RFC 8402 / RFC 8660 / RFC 8986)
 * Traffic Engineering (SR-TE) & Low-Latency Label-Switched Path (LSP) Matrix
 *
 * Models source-routed label switching across Shahdara ISP's metro core & aggregation
 * network, steering subscriber flows along explicit paths defined by Segment Identifiers (SIDs):
 * - Node/Prefix-SIDs from the Segment Routing Global Block (SRGB: 16000-23999)
 * - Adjacency-SIDs (Adj-SIDs: 24000-29999) for strict interface pin-down
 * - Binding-SIDs (BSID) for hierarchical policy enforcement
 *
 * Evaluates path propagation latency, Maximum SID Depth (MSD), Topology-Independent
 * Loop-Free Alternate (TI-LFA) sub-50ms fast-reroute protection switching, SR-MPLS vs SRv6
 * encapsulation overhead, and correlates core transport health with Shahdara subscriber
 * revenue and SLA commitments.
 */

export const SR_MPLS_CONSTANTS = {
  SRGB_START: 16000,
  SRGB_END: 23999,
  SRLB_START: 24000,
  SRLB_END: 29999,
  MAX_SID_DEPTH: 5,
  DEFAULT_TUNNEL_ID: 'sr-lsp-01',
  DEFAULT_OPTIMIZATION_METRIC: 'LATENCY',
  DEFAULT_PLANE_MODE: 'SR_MPLS',
  DEFAULT_INJECTED_CONGESTION_PCT: 0,
  TI_LFA_SWITCH_TIME_MS: 38, // Sub-50ms carrier carrier SLA fast-reroute
  LATENCY_SLA_TARGET_MS: 4.0,

  OPTIMIZATION_METRICS: {
    LATENCY: 'Minimum Latency (SLA Low Delay < 4ms)',
    BANDWIDTH: 'Maximum Bandwidth Capacity Headroom',
    HOPS: 'Shortest IGP Hop Count',
    DISJOINT_TE: 'Strict Disjoint Path (TI-LFA 1:1 Protected)'
  },

  PLANE_MODES: {
    SR_MPLS: 'SR-MPLS 32-bit Label Stack (RFC 8660)',
    SRV6: 'SRv6 128-bit IPv6 Segment Routing Header (RFC 8986)'
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_SR_LSP_TUNNELS = [
  {
    id: 'sr-lsp-01',
    name: 'Primary Ring Low-Latency: PE-01 (Shahdara Core) to PE-02 (Kot Abdul Malik)',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Kot Abdul Malik', 'Baradari Road', 'Old Town'],
    ingressNode: 'PE-01 (Shahdara Core)',
    egressNode: 'PE-02 (Kot Abdul Malik)',
    ingressSid: 16001,
    egressSid: 16002,
    transitNodes: ['P-01 (Baradari)'],
    primarySegmentStack: [16003, 16002],
    primarySrv6Segments: ['2001:db8:1::3', '2001:db8:1::2'],
    backupSegmentStack: [16004, 16005, 16002],
    backupSrv6Segments: ['2001:db8:1::4', '2001:db8:1::5', '2001:db8:1::2'],
    baseLatencyMs: 1.8,
    backupLatencyMs: 3.4,
    allocatedBandwidthGbps: 10.0,
    currentLoadGbps: 4.8,
    bindingSid: 18001,
    pathHops: 2,
    backupHops: 3
  },
  {
    id: 'sr-lsp-02',
    name: 'Metro Transit Express: PE-01 (Shahdara Core) to ASBR-01 (Ravi Siphon Gateway)',
    primaryArea: 'Ravi Siphon',
    aliasAreas: ['Ravi Siphon', 'Siphon Road', 'Shahdara Town'],
    ingressNode: 'PE-01 (Shahdara Core)',
    egressNode: 'ASBR-01 (Ravi Siphon Transit)',
    ingressSid: 16001,
    egressSid: 16004,
    transitNodes: [],
    primarySegmentStack: [16004],
    primarySrv6Segments: ['2001:db8:1::4'],
    backupSegmentStack: [16003, 16004],
    backupSrv6Segments: ['2001:db8:1::3', '2001:db8:1::4'],
    baseLatencyMs: 1.2,
    backupLatencyMs: 2.6,
    allocatedBandwidthGbps: 25.0,
    currentLoadGbps: 16.2,
    bindingSid: 18002,
    pathHops: 1,
    backupHops: 2
  },
  {
    id: 'sr-lsp-03',
    name: 'North Sector Fiber Trunk: PE-02 (Kot Abdul Malik) to PE-03 (Vandala Road Aggr)',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town', 'Kot Abdul Malik'],
    ingressNode: 'PE-02 (Kot Abdul Malik)',
    egressNode: 'PE-03 (Vandala Road)',
    ingressSid: 16002,
    egressSid: 16005,
    transitNodes: ['P-02 (Farrukhabad Loop)'],
    primarySegmentStack: [16006, 16005],
    primarySrv6Segments: ['2001:db8:1::6', '2001:db8:1::5'],
    backupSegmentStack: [16001, 16005],
    backupSrv6Segments: ['2001:db8:1::1', '2001:db8:1::5'],
    baseLatencyMs: 2.4,
    backupLatencyMs: 4.8,
    allocatedBandwidthGbps: 10.0,
    currentLoadGbps: 6.1,
    bindingSid: 18003,
    pathHops: 2,
    backupHops: 2
  },
  {
    id: 'sr-lsp-04',
    name: 'Distribution Ring Express: PE-01 (Shahdara Core) to PE-04 (Farooq Ganj Access)',
    primaryArea: 'Farooq Ganj',
    aliasAreas: ['Farooq Ganj', 'Jia Musa', 'Farrukhabad'],
    ingressNode: 'PE-01 (Shahdara Core)',
    egressNode: 'PE-04 (Farooq Ganj Access)',
    ingressSid: 16001,
    egressSid: 16007,
    transitNodes: ['P-01 (Baradari)'],
    primarySegmentStack: [16003, 16007],
    primarySrv6Segments: ['2001:db8:1::3', '2001:db8:1::7'],
    backupSegmentStack: [16004, 16007],
    backupSrv6Segments: ['2001:db8:1::4', '2001:db8:1::7'],
    baseLatencyMs: 1.6,
    backupLatencyMs: 3.2,
    allocatedBandwidthGbps: 5.0,
    currentLoadGbps: 2.9,
    bindingSid: 18004,
    pathHops: 2,
    backupHops: 2
  },
  {
    id: 'sr-lsp-05',
    name: 'South Border Interconnect: PE-02 (Kot Abdul Malik) to PE-05 (Begum Kot Gateway)',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Kot Abdul Malik'],
    ingressNode: 'PE-02 (Kot Abdul Malik)',
    egressNode: 'PE-05 (Begum Kot Gateway)',
    ingressSid: 16002,
    egressSid: 16008,
    transitNodes: [],
    primarySegmentStack: [16008],
    primarySrv6Segments: ['2001:db8:1::8'],
    backupSegmentStack: [16001, 16008],
    backupSrv6Segments: ['2001:db8:1::1', '2001:db8:1::8'],
    baseLatencyMs: 1.4,
    backupLatencyMs: 2.9,
    allocatedBandwidthGbps: 10.0,
    currentLoadGbps: 5.4,
    bindingSid: 18005,
    pathHops: 1,
    backupHops: 2
  }
];

// Interactive state variables
let currentSelectedTunnelId = SR_MPLS_CONSTANTS.DEFAULT_TUNNEL_ID;
let currentOptimizationMetric = SR_MPLS_CONSTANTS.DEFAULT_OPTIMIZATION_METRIC;
let currentPlaneMode = SR_MPLS_CONSTANTS.DEFAULT_PLANE_MODE;
let currentInjectedCongestionPct = SR_MPLS_CONSTANTS.DEFAULT_INJECTED_CONGESTION_PCT;

export function getSrMplsSelectedTunnel() {
  return currentSelectedTunnelId;
}

export function setSrMplsSelectedTunnel(id) {
  if (SHAHDARA_SR_LSP_TUNNELS.some(t => t.id === id)) {
    currentSelectedTunnelId = id;
  }
}

export function getSrMplsOptimizationMetric() {
  return currentOptimizationMetric;
}

export function setSrMplsOptimizationMetric(metric) {
  if (SR_MPLS_CONSTANTS.OPTIMIZATION_METRICS[metric]) {
    currentOptimizationMetric = metric;
  }
}

export function getSrMplsPlaneMode() {
  return currentPlaneMode;
}

export function setSrMplsPlaneMode(mode) {
  if (SR_MPLS_CONSTANTS.PLANE_MODES[mode]) {
    currentPlaneMode = mode;
  }
}

export function getSrMplsInjectedCongestionPct() {
  return currentInjectedCongestionPct;
}

export function setSrMplsInjectedCongestionPct(pct) {
  const num = Number(pct);
  if (!Number.isNaN(num)) {
    currentInjectedCongestionPct = Math.max(0, Math.min(100, Math.round(num)));
  }
}

export function resetSrMplsSimState() {
  currentSelectedTunnelId = SR_MPLS_CONSTANTS.DEFAULT_TUNNEL_ID;
  currentOptimizationMetric = SR_MPLS_CONSTANTS.DEFAULT_OPTIMIZATION_METRIC;
  currentPlaneMode = SR_MPLS_CONSTANTS.DEFAULT_PLANE_MODE;
  currentInjectedCongestionPct = SR_MPLS_CONSTANTS.DEFAULT_INJECTED_CONGESTION_PCT;
}

/**
 * Calculates Segment Routing dynamics, active label stack, latency, and TI-LFA fast reroute.
 */
export function calculateSrMplsDynamics(tunnel, metric, planeMode, congestionPct) {
  const t = tunnel || SHAHDARA_SR_LSP_TUNNELS[0];
  const m = metric || SR_MPLS_CONSTANTS.DEFAULT_OPTIMIZATION_METRIC;
  const plane = planeMode || SR_MPLS_CONSTANTS.DEFAULT_PLANE_MODE;
  const cong = Math.max(0, Math.min(100, Number(congestionPct) || 0));

  // Base parameters
  let activeSegments = [...t.primarySegmentStack];
  let activeSrv6Segments = [...t.primarySrv6Segments];
  let hops = t.pathHops;
  let isTiLfaActive = false;
  let rerouteReason = 'None (Primary LSP Active)';
  let baseLat = t.baseLatencyMs;

  // Congestion impact on primary path
  const simulatedLoadGbps = Math.min(t.allocatedBandwidthGbps * 1.3, t.currentLoadGbps + (cong / 100) * (t.allocatedBandwidthGbps * 0.7));
  const linkUtilizationPct = Math.round((simulatedLoadGbps / t.allocatedBandwidthGbps) * 1000) / 10;

  // If congestion exceeds 85% or high injected load (> 50%), TI-LFA sub-50ms local repair engages
  if (linkUtilizationPct > 90.0 || cong >= 60 || m === 'DISJOINT_TE') {
    isTiLfaActive = true;
    activeSegments = [...t.backupSegmentStack];
    activeSrv6Segments = [...t.backupSrv6Segments];
    hops = t.backupHops;
    baseLat = t.backupLatencyMs;
    rerouteReason = m === 'DISJOINT_TE' 
      ? 'Strict Disjoint Path TE Policy' 
      : `TI-LFA Fast Reroute triggered by Link Congestion (${linkUtilizationPct}%)`;
  }

  // Adjust latency based on optimization metric and congestion queueing delay
  let queueingDelayMs = 0;
  if (!isTiLfaActive && cong > 0) {
    queueingDelayMs = Math.round(((cong / 100) * 3.2) * 100) / 100;
  } else if (isTiLfaActive && cong > 70) {
    queueingDelayMs = Math.round((((cong - 70) / 30) * 1.5) * 100) / 100;
  }

  let metricModifierMs = 0;
  if (m === 'LATENCY') {
    metricModifierMs = -0.15; // Low latency priority path optimization
  } else if (m === 'BANDWIDTH') {
    metricModifierMs = 0.2; // Extra hop allowed for max throughput
  }

  const activeLatencyMs = Math.max(0.6, Math.round((baseLat + queueingDelayMs + metricModifierMs) * 100) / 100);
  const jitterMs = Math.max(0.1, Math.round((0.15 + (cong / 100) * 1.4) * 100) / 100);

  // Maximum SID Depth (MSD)
  const labelStackDepth = activeSegments.length;
  const srv6HdrBytes = plane === 'SRV6' ? 8 + (activeSrv6Segments.length * 16) : 0;
  const mplsHeaderBytes = plane === 'SR_MPLS' ? activeSegments.length * 4 : 0;

  // Packet loss rate (%)
  let packetLossPct = 0.0;
  if (linkUtilizationPct > 98.0 && !isTiLfaActive) {
    packetLossPct = Math.round((linkUtilizationPct - 98.0) * 2.5 * 10) / 10;
  }

  // Bandwidth headroom
  const availableHeadroomGbps = Math.max(0, Math.round((t.allocatedBandwidthGbps - simulatedLoadGbps) * 10) / 10);

  // Determine SLA and health status
  let status = SR_MPLS_CONSTANTS.STATUS.OPTIMAL;
  if (activeLatencyMs > SR_MPLS_CONSTANTS.LATENCY_SLA_TARGET_MS || packetLossPct > 1.5 || linkUtilizationPct > 95.0) {
    status = SR_MPLS_CONSTANTS.STATUS.CRITICAL;
  } else if (activeLatencyMs > 3.0 || isTiLfaActive || linkUtilizationPct > 80.0) {
    status = SR_MPLS_CONSTANTS.STATUS.WARNING;
  }

  return {
    simulatedLoadGbps: Math.round(simulatedLoadGbps * 10) / 10,
    linkUtilizationPct,
    activeLatencyMs,
    jitterMs,
    packetLossPct,
    availableHeadroomGbps,
    labelStackDepth,
    activeSegments,
    activeSrv6Segments,
    headerOverheadBytes: plane === 'SRV6' ? srv6HdrBytes : mplsHeaderBytes,
    isTiLfaActive,
    rerouteReason,
    hops,
    slaTargetMs: SR_MPLS_CONSTANTS.LATENCY_SLA_TARGET_MS,
    slaMet: activeLatencyMs <= SR_MPLS_CONSTANTS.LATENCY_SLA_TARGET_MS && packetLossPct <= 0.1,
    status
  };
}

/**
 * Calculates complete Segment Routing metrics correlated with subscriber ledger and sector revenue.
 */
export function calculateSrMplsMetrics(state, options = {}) {
  const selectedTunnelId = options.tunnelId || currentSelectedTunnelId;
  const metric = options.optimizationMetric || currentOptimizationMetric;
  const planeMode = options.planeMode || currentPlaneMode;
  const congPct = options.congestionPct !== undefined ? options.congestionPct : currentInjectedCongestionPct;

  const tunnel = SHAHDARA_SR_LSP_TUNNELS.find(t => t.id === selectedTunnelId) || SHAHDARA_SR_LSP_TUNNELS[0];
  const dynamics = calculateSrMplsDynamics(tunnel, metric, planeMode, congPct);

  // Correlate with subscriber roster in this tunnel's served area
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const aliasAreas = tunnel.aliasAreas || [tunnel.primaryArea];

  const linkedCustomers = customers.filter(c => {
    if (c.archived) return false;
    const custArea = String(c.area || '').trim().toLowerCase();
    return aliasAreas.some(a => custArea === a.toLowerCase() || custArea.includes(a.toLowerCase()));
  });

  const totalSubscribers = linkedCustomers.length;
  const activeSubscribers = linkedCustomers.filter(c => String(c.serviceStatus || '').toLowerCase() === 'active').length;
  const offlineSubscribers = totalSubscribers - activeSubscribers;

  let sectorMonthlyRevenue = 0;
  let sectorTotalDues = 0;

  linkedCustomers.forEach(cust => {
    const bills = Array.isArray(cust.bills) ? cust.bills : [];
    bills.forEach(bill => {
      const due = Number(bill.dueAmount) || 0;
      const payments = Array.isArray(bill.payments) ? bill.payments : [];
      const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || (Number(bill.paidAmount) || 0);
      sectorMonthlyRevenue += due;
      sectorTotalDues += Math.max(0, due - paid);
    });
  });

  // Revenue exposure: if latency breaches SLA or packet loss drops carrier links
  const riskFraction = dynamics.status === SR_MPLS_CONSTANTS.STATUS.CRITICAL
    ? 0.70
    : dynamics.status === SR_MPLS_CONSTANTS.STATUS.WARNING
    ? 0.20
    : 0.0;
  const revenueAtRisk = Math.round(sectorMonthlyRevenue * riskFraction);

  return {
    tunnel,
    optimizationMetric: metric,
    optimizationMetricLabel: SR_MPLS_CONSTANTS.OPTIMIZATION_METRICS[metric] || metric,
    planeMode,
    planeModeLabel: SR_MPLS_CONSTANTS.PLANE_MODES[planeMode] || planeMode,
    congestionPct: congPct,
    dynamics,
    subscriberCorrelation: {
      totalSubscribers,
      activeSubscribers,
      offlineSubscribers,
      sectorMonthlyRevenue,
      sectorTotalDues,
      revenueAtRisk
    },
    tunnelsList: SHAHDARA_SR_LSP_TUNNELS
  };
}

/**
 * Generates pure offline SVG topological diagram of Segment Routing LSP and Label Stack.
 */
export function renderSrMplsDiagramSvg(metrics, options = {}) {
  if (!metrics || !metrics.tunnel) {
    return `<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No Segment Routing LSP metrics available.</div>`;
  }

  const { tunnel, dynamics, planeMode } = metrics;
  const isCompact = Boolean(options.compact);
  const width = isCompact ? 540 : 860;
  const height = isCompact ? 280 : 380;

  const isCritical = dynamics.status === SR_MPLS_CONSTANTS.STATUS.CRITICAL;
  const isWarning = dynamics.status === SR_MPLS_CONSTANTS.STATUS.WARNING;
  const statusColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

  // Coordinate geometry for router nodes in topology
  const ingressX = isCompact ? 70 : 110;
  const ingressY = isCompact ? 110 : 140;

  const transitX = isCompact ? 270 : 430;
  const transitY = isCompact ? 80 : 95;

  const backupX = isCompact ? 270 : 430;
  const backupY = isCompact ? 165 : 220;

  const egressX = isCompact ? 470 : 750;
  const egressY = isCompact ? 110 : 140;

  // Active path styling
  const primaryStroke = dynamics.isTiLfaActive ? '#64748b' : '#10b981';
  const primaryDash = dynamics.isTiLfaActive ? '4,4' : 'none';
  const backupStroke = dynamics.isTiLfaActive ? '#38bdf8' : '#f59e0b';
  const backupDash = dynamics.isTiLfaActive ? 'none' : '3,3';

  // Label stack rendering boxes
  const stackItems = planeMode === 'SRV6' ? dynamics.activeSrv6Segments : dynamics.activeSegments;

  return `
<svg class="sr-mpls-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier Segment Routing SR-MPLS TE Topology and Label Stack">
  <defs>
    <linearGradient id="srBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#131c2e" />
    </linearGradient>
    <linearGradient id="srPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <filter id="srNodeGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#srBgGrad)" stroke="#1e293b" stroke-width="1.2" />

  <!-- Header Section -->
  <text x="18" y="24" fill="#f8fafc" font-size="${isCompact ? 11 : 13}" font-weight="700" letter-spacing="0.5">CARRIER SEGMENT ROUTING (SR-MPLS / SRv6 RFC 8402) TE MATRIX</text>
  <text x="${width - 18}" y="24" text-anchor="end" fill="${statusColor}" font-size="${isCompact ? 10 : 12}" font-weight="700">STATUS: ${dynamics.status.toUpperCase()} ${dynamics.isTiLfaActive ? '(TI-LFA ACTIVE)' : ''}</text>

  <!-- Topology Link: Primary Path (Ingress -> Transit -> Egress) -->
  <path d="M ${ingressX} ${ingressY} Q ${transitX} ${transitY - 20} ${egressX} ${egressY}" 
        stroke="${primaryStroke}" stroke-width="${dynamics.isTiLfaActive ? 1.8 : 3.5}" 
        stroke-dasharray="${primaryDash}" fill="none" opacity="${dynamics.isTiLfaActive ? 0.45 : 0.95}" />

  <!-- Topology Link: Backup TI-LFA Disjoint Path (Ingress -> Bypass -> Egress) -->
  <path d="M ${ingressX} ${ingressY} Q ${backupX} ${backupY + 20} ${egressX} ${egressY}" 
        stroke="${backupStroke}" stroke-width="${dynamics.isTiLfaActive ? 3.5 : 1.8}" 
        stroke-dasharray="${backupDash}" fill="none" opacity="${dynamics.isTiLfaActive ? 0.95 : 0.45}" />

  <!-- Flow Direction Arrows / Animation Indicating Active Traffic -->
  <circle cx="${dynamics.isTiLfaActive ? backupX : transitX}" cy="${dynamics.isTiLfaActive ? backupY + 10 : transitY - 10}" r="4" fill="${dynamics.isTiLfaActive ? '#38bdf8' : '#10b981'}" filter="url(#srNodeGlow)">
    <animate attributeName="opacity" values="0.4;1.0;0.4" dur="1.6s" repeatCount="indefinite" />
  </circle>

  <!-- Ingress Router Node PE-01 -->
  <g transform="translate(${ingressX}, ${ingressY})">
    <circle cx="0" cy="0" r="${isCompact ? 18 : 24}" fill="#0f172a" stroke="#38bdf8" stroke-width="2.2" />
    <text x="0" y="3" text-anchor="middle" fill="#f8fafc" font-size="${isCompact ? 8.5 : 10}" font-weight="700">PE-01</text>
    <text x="0" y="${isCompact ? 28 : 36}" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? 7.5 : 9}">SID: ${tunnel.ingressSid}</text>
    <text x="0" y="${isCompact ? 37 : 47}" text-anchor="middle" fill="#38bdf8" font-size="${isCompact ? 7 : 8.5}">INGRESS</text>
  </g>

  <!-- Transit Primary P-Router Node -->
  <g transform="translate(${transitX}, ${transitY})">
    <circle cx="0" cy="0" r="${isCompact ? 15 : 20}" fill="#0f172a" stroke="${dynamics.isTiLfaActive ? '#475569' : '#10b981'}" stroke-width="2" />
    <text x="0" y="3" text-anchor="middle" fill="#f8fafc" font-size="${isCompact ? 8 : 9.5}" font-weight="700">P-01</text>
    <text x="0" y="${isCompact ? -20 : -26}" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? 7.5 : 8.5}">SID: 16003 (Primary)</text>
  </g>

  <!-- Backup TI-LFA Node -->
  <g transform="translate(${backupX}, ${backupY})">
    <circle cx="0" cy="0" r="${isCompact ? 15 : 20}" fill="#0f172a" stroke="${dynamics.isTiLfaActive ? '#38bdf8' : '#64748b'}" stroke-width="2" />
    <text x="0" y="3" text-anchor="middle" fill="#f8fafc" font-size="${isCompact ? 8 : 9.5}" font-weight="700">P-ALT</text>
    <text x="0" y="${isCompact ? 24 : 30}" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? 7.5 : 8.5}">TI-LFA Alternate</text>
  </g>

  <!-- Egress Router Node PE-02 -->
  <g transform="translate(${egressX}, ${egressY})">
    <circle cx="0" cy="0" r="${isCompact ? 18 : 24}" fill="#0f172a" stroke="#10b981" stroke-width="2.2" />
    <text x="0" y="3" text-anchor="middle" fill="#f8fafc" font-size="${isCompact ? 8.5 : 10}" font-weight="700">PE-02</text>
    <text x="0" y="${isCompact ? 28 : 36}" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? 7.5 : 9}">SID: ${tunnel.egressSid}</text>
    <text x="0" y="${isCompact ? 37 : 47}" text-anchor="middle" fill="#10b981" font-size="${isCompact ? 7 : 8.5}">EGRESS</text>
  </g>

  <!-- Bottom Panel: Segment Label Stack / Header & Latency SLA -->
  <g transform="translate(18, ${height - (isCompact ? 72 : 92)})">
    <rect x="0" y="0" width="${width - 36}" height="${isCompact ? 60 : 76}" rx="6" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
    
    <!-- Label Stack Visualization -->
    <text x="14" y="${isCompact ? 16 : 20}" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}" font-weight="600">
      ACTIVE SEGMENT LIST (${planeMode}) [MSD: ${dynamics.labelStackDepth}]:
    </text>

    <!-- Stack Pill Badges -->
    <g transform="translate(14, ${isCompact ? 24 : 30})">
      ${stackItems.map((sid, idx) => `
        <rect x="${idx * (isCompact ? 68 : 88)}" y="0" width="${isCompact ? 62 : 80}" height="${isCompact ? 18 : 22}" rx="4" fill="#1e293b" stroke="${idx === 0 ? '#38bdf8' : '#10b981'}" stroke-width="1" />
        <text x="${idx * (isCompact ? 68 : 88) + (isCompact ? 31 : 40)}" y="${isCompact ? 12 : 15}" text-anchor="middle" fill="#f8fafc" font-size="${isCompact ? 7.5 : 9}" font-family="monospace">
          ${String(sid).length > 8 ? String(sid).substring(0, 7) + '..' : sid}
        </text>
      `).join('')}
      <text x="${stackItems.length * (isCompact ? 68 : 88) + 12}" y="${isCompact ? 13 : 16}" fill="#64748b" font-size="${isCompact ? 7.5 : 9}">
        (BSID: ${tunnel.bindingSid})
      </text>
    </g>

    <!-- Latency & SLA Gauge on Right -->
    <g transform="translate(${width - (isCompact ? 160 : 220)}, ${isCompact ? 14 : 18})">
      <text x="0" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">RTT Latency:</text>
      <text x="75" y="0" fill="${dynamics.slaMet ? '#10b981' : '#ef4444'}" font-size="${isCompact ? 9 : 11}" font-weight="700">
        ${dynamics.activeLatencyMs} ms
      </text>
      <text x="0" y="${isCompact ? 16 : 20}" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">Jitter / Loss:</text>
      <text x="75" y="${isCompact ? 16 : 20}" fill="#f8fafc" font-size="${isCompact ? 8.5 : 10}">
        ${dynamics.jitterMs}ms / ${dynamics.packetLossPct}%
      </text>
      <text x="0" y="${isCompact ? 32 : 38}" fill="#94a3b8" font-size="${isCompact ? 7.5 : 8.5}">Protection:</text>
      <text x="75" y="${isCompact ? 32 : 38}" fill="${dynamics.isTiLfaActive ? '#38bdf8' : '#10b981'}" font-size="${isCompact ? 7.5 : 8.5}" font-weight="600">
        ${dynamics.isTiLfaActive ? 'TI-LFA Active (38ms)' : '1:1 Standby Ready'}
      </text>
    </g>
  </g>
</svg>
`;
}

/**
 * Generates technical executive briefing text of Segment Routing LSP status.
 */
export function generateSrMplsReport(metrics) {
  if (!metrics || !metrics.tunnel) {
    return 'No Segment Routing LSP metrics available.';
  }

  const { tunnel, dynamics, optimizationMetricLabel, planeModeLabel, subscriberCorrelation } = metrics;
  const now = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });

  return [
    '================================================================================',
    'SHAHDARA ISP CARRIER SEGMENT ROUTING (SR-MPLS / SRv6) TE LSP BRIEFING',
    'Standards: RFC 8402 (Segment Routing), RFC 8660 (SR-MPLS), RFC 8986 (SRv6)',
    `Generated: ${now} (PKT)`,
    '================================================================================',
    '',
    `MONITORED LSP TUNNEL: ${tunnel.name}`,
    `Primary Coverage Sector: ${tunnel.primaryArea}`,
    `Ingress Node:           ${tunnel.ingressNode} [SID: ${tunnel.ingressSid}]`,
    `Egress Node:            ${tunnel.egressNode} [SID: ${tunnel.egressSid}]`,
    `Binding SID (BSID):     ${tunnel.bindingSid}`,
    `Data Plane Mode:        ${planeModeLabel}`,
    `Optimization Policy:    ${optimizationMetricLabel}`,
    '',
    'SEGMENT ROUTING PATH & FORWARDING DYNAMICS:',
    `--------------------------------------------------------------------------------`,
    `Active Segment List:    [${(metrics.planeMode === 'SRV6' ? dynamics.activeSrv6Segments : dynamics.activeSegments).join(' -> ')}]`,
    `Label Stack Depth (MSD): ${dynamics.labelStackDepth} labels (${dynamics.headerOverheadBytes} bytes header overhead)`,
    `Active RTT Latency:     ${dynamics.activeLatencyMs} ms (SLA Target: < ${dynamics.slaTargetMs} ms -> ${dynamics.slaMet ? 'PASSED' : 'BREACHED'})`,
    `Path Jitter:            ${dynamics.jitterMs} ms`,
    `Path Packet Loss:       ${dynamics.packetLossPct} %`,
    `Link Throughput Load:   ${dynamics.simulatedLoadGbps} Gbps / ${tunnel.allocatedBandwidthGbps} Gbps (${dynamics.linkUtilizationPct}% Utilization)`,
    `Available Headroom:     ${dynamics.availableHeadroomGbps} Gbps`,
    `TI-LFA Protection:      ${dynamics.isTiLfaActive ? 'ACTIVE (Sub-50ms Local Repair Engaged)' : 'STANDBY READY'}`,
    `Reroute Trigger:        ${dynamics.rerouteReason}`,
    `Operational Status:     ${dynamics.status.toUpperCase()}`,
    '',
    'SUBSCRIBER & REVENUE CORRELATION:',
    `--------------------------------------------------------------------------------`,
    `Linked Area Accounts:   ${subscriberCorrelation.totalSubscribers} subscribers`,
    `Active Online Accounts: ${subscriberCorrelation.activeSubscribers} subscribers`,
    `Offline Accounts:       ${subscriberCorrelation.offlineSubscribers} subscribers`,
    `Sector Monthly Billed:  ${formatPKR(subscriberCorrelation.sectorMonthlyRevenue)}`,
    `Sector Outstanding Due: ${formatPKR(subscriberCorrelation.sectorTotalDues)}`,
    `Revenue at Risk:        ${formatPKR(subscriberCorrelation.revenueAtRisk)}`,
    '',
    'RECOMMENDED ENGINEERING ACTION:',
    dynamics.status === SR_MPLS_CONSTANTS.STATUS.CRITICAL
      ? 'CRITICAL ALERT: Latency SLA breach or severe congestion detected on segment routing LSP. Verify TI-LFA disjoint secondary path and allocate additional lambda capacity immediately.'
      : dynamics.status === SR_MPLS_CONSTANTS.STATUS.WARNING
      ? 'WARNING: Segment Routing path experiencing elevated load or TI-LFA alternate routing. Monitor transit queues and buffer occupancy.'
      : 'OPTIMAL: Segment Routing traffic engineering operating well within latency SLA (< 4.0ms) and low-jitter parameters.'
  ].join('\n');
}

/**
 * Initializes and wires the Segment Routing (SR-MPLS) modal, controls, and SVG chart.
 */
export function setupSrMplsModal(state, options = {}) {
  const modal = document.getElementById('dashboardSrMplsModal');
  const openBtn = document.getElementById('dashboardOpenSrMplsModalBtn');
  const closeBtn = document.getElementById('dashboardSrMplsModalCloseBtn');

  const tunnelSelect = document.getElementById('srMplsTunnelSelect');
  const metricSelect = document.getElementById('srMplsMetricSelect');
  const planeSelect = document.getElementById('srMplsPlaneSelect');
  const congSlider = document.getElementById('srMplsCongSlider');
  const congValPill = document.getElementById('srMplsCongVal');
  const resetBtn = document.getElementById('srMplsResetBtn');

  // KPI elements
  const kpiTunnelName = document.getElementById('srMplsKpiTunnelName');
  const kpiLatency = document.getElementById('srMplsKpiLatency');
  const kpiStack = document.getElementById('srMplsKpiStack');
  const kpiStatusBadge = document.getElementById('srMplsStatusBadge');
  const kpiRevenueRisk = document.getElementById('srMplsKpiRevenueRisk');

  // Chart wrap & Table
  const chartWrap = document.getElementById('srMplsModalChartWrap');
  const tunnelsTableBody = document.getElementById('srMplsTunnelsTableBody');

  // Action buttons
  const filterAreaBtn = document.getElementById('srMplsFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopySrMplsReportBtn');

  // Card chart
  const cardChart = document.getElementById('dashboardSrMplsChart');

  function renderView() {
    const metrics = calculateSrMplsMetrics(state);

    if (cardChart) {
      cardChart.innerHTML = renderSrMplsDiagramSvg(metrics, { compact: true });
    }

    if (!modal) return;

    if (kpiTunnelName) {
      kpiTunnelName.textContent = metrics.tunnel.name.split(':')[0];
    }
    if (kpiLatency) {
      kpiLatency.textContent = `${metrics.dynamics.activeLatencyMs} ms (Jitter ${metrics.dynamics.jitterMs}ms)`;
      kpiLatency.style.color = metrics.dynamics.slaMet ? '#10b981' : '#ef4444';
    }
    if (kpiStack) {
      kpiStack.textContent = `${metrics.dynamics.labelStackDepth} Labels (${metrics.planeMode})`;
      kpiStack.style.color = '#38bdf8';
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = metrics.dynamics.status.toUpperCase();
      kpiStatusBadge.className = `sim-delta-badge badge-${
        metrics.dynamics.status === SR_MPLS_CONSTANTS.STATUS.CRITICAL
          ? 'danger'
          : metrics.dynamics.status === SR_MPLS_CONSTANTS.STATUS.WARNING
          ? 'warning'
          : 'success'
      }`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(metrics.subscriberCorrelation.revenueAtRisk)} at risk`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderSrMplsDiagramSvg(metrics, { compact: false });
    }

    if (tunnelsTableBody) {
      tunnelsTableBody.innerHTML = metrics.tunnelsList
        .map(t => {
          const isSelected = t.id === metrics.tunnel.id;
          const dyn = calculateSrMplsDynamics(t, metrics.optimizationMetric, metrics.planeMode, 0);
          return `
            <tr class="${isSelected ? 'active-row' : ''}">
              <td><strong>${t.id.toUpperCase()}</strong></td>
              <td>${t.name.split(': ')[1] || t.name}</td>
              <td>${t.ingressNode.split(' (')[0]} &rarr; ${t.egressNode.split(' (')[0]}</td>
              <td>[${dyn.activeSegments.join(', ')}]</td>
              <td><strong>${dyn.activeLatencyMs} ms</strong></td>
              <td>${t.currentLoadGbps} / ${t.allocatedBandwidthGbps}G</td>
              <td>${isSelected ? '<span class="status-pill status-active">Monitored</span>' : '<span class="status-pill">Standby</span>'}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // Populate Selects
  if (tunnelSelect) {
    tunnelSelect.innerHTML = SHAHDARA_SR_LSP_TUNNELS.map(
      t => `<option value="${t.id}" ${t.id === currentSelectedTunnelId ? 'selected' : ''}>${t.name}</option>`
    ).join('');
    tunnelSelect.onchange = e => {
      setSrMplsSelectedTunnel(e.target.value);
      renderView();
    };
  }

  if (metricSelect) {
    metricSelect.innerHTML = Object.entries(SR_MPLS_CONSTANTS.OPTIMIZATION_METRICS).map(
      ([k, v]) => `<option value="${k}" ${k === currentOptimizationMetric ? 'selected' : ''}>${v}</option>`
    ).join('');
    metricSelect.onchange = e => {
      setSrMplsOptimizationMetric(e.target.value);
      renderView();
    };
  }

  if (planeSelect) {
    planeSelect.innerHTML = Object.entries(SR_MPLS_CONSTANTS.PLANE_MODES).map(
      ([k, v]) => `<option value="${k}" ${k === currentPlaneMode ? 'selected' : ''}>${v}</option>`
    ).join('');
    planeSelect.onchange = e => {
      setSrMplsPlaneMode(e.target.value);
      renderView();
    };
  }

  if (congSlider) {
    congSlider.value = currentInjectedCongestionPct;
    congSlider.oninput = e => {
      setSrMplsInjectedCongestionPct(e.target.value);
      if (congValPill) congValPill.textContent = `${currentInjectedCongestionPct}%`;
      renderView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetSrMplsSimState();
      if (tunnelSelect) tunnelSelect.value = currentSelectedTunnelId;
      if (metricSelect) metricSelect.value = currentOptimizationMetric;
      if (planeSelect) planeSelect.value = currentPlaneMode;
      if (congSlider) congSlider.value = currentInjectedCongestionPct;
      if (congValPill) congValPill.textContent = `${currentInjectedCongestionPct}%`;
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Segment Routing simulation reset to baseline parameters.');
      }
    };
  }

  if (openBtn && modal) {
    openBtn.onclick = () => {
      renderView();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    };
  }

  if (closeBtn && modal) {
    closeBtn.onclick = () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    };
  }

  if (modal) {
    modal.onclick = e => {
      if (e.target === modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateSrMplsMetrics(state);
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(metrics.tunnel.primaryArea);
        if (modal && typeof modal.close === 'function') modal.close();
        else if (modal) modal.removeAttribute('open');
        if (typeof options.onToast === 'function') {
          options.onToast(`Filtering subscribers in ${metrics.tunnel.primaryArea}`);
        }
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateSrMplsMetrics(state);
      const text = generateSrMplsReport(metrics);
      try {
        const cb = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
        if (cb?.writeText) {
          await cb.writeText(text);
          if (typeof options.onToast === 'function') {
            options.onToast('Segment Routing TE briefing copied to clipboard!');
          }
        } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy Segment Routing briefing:', text);
        }
      } catch (err) {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy Segment Routing briefing:', text);
        }
      }
    };
  }

  // Initial draw
  renderView();
}
