import { formatPKR } from './core.js';

/**
 * Core MPLS Traffic Engineering (RSVP-TE / Fast Reroute 1:1 Facility Bypass)
 * Headroom & LSP Protection Matrix (RFC 3209 / RFC 4090 / RFC 4124)
 *
 * Models carrier Core MPLS Traffic Engineering across Shahdara Metro Backbone:
 * - RSVP-TE Explicit Route Objects (ERO) and Label Switched Paths (LSP)
 * - RFC 4090 Fast Reroute (FRR): Facility Bypass (many-to-one MP label stacking)
 *   and One-to-One Detour backup tunnels with sub-50ms Point of Local Repair (PLR)
 * - Multi-priority bandwidth reservation & unreserved headroom matrix
 * - Dynamic failure injection (link cut, traffic congestion surges)
 * - Correlates LSP availability with Shahdara subscriber traffic and SLA penalty risk
 */

export const MPLS_TE_CONSTANTS = {
  DEFAULT_TUNNEL_ID: 'te-lsp-shahdara-ravi-101',
  DEFAULT_FRR_MODE: 'FACILITY_BYPASS',
  DEFAULT_SETUP_PRIORITY: 7,
  DEFAULT_HOLDING_PRIORITY: 7,
  DEFAULT_CONGESTION_PCT: 0,
  DEFAULT_LINK_CUT: false,

  FRR_FACILITY_FAILOVER_MS: 42.5, // RFC 4090 Facility Bypass local repair latency (ms)
  FRR_DETOUR_FAILOVER_MS: 48.0, // RFC 4090 One-to-One Detour failover latency (ms)

  HEADROOM_WARNING_UTIL_PCT: 75.0,
  HEADROOM_CRITICAL_UTIL_PCT: 90.0,

  FRR_MODES: {
    FACILITY_BYPASS: 'RFC 4090 Facility Bypass (MP Label Stacking & Many-to-One Protection)',
    DETOUR_1TO1: 'RFC 4090 1:1 Detour LSP (Independent Dedicated Backup Path)'
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_TE_TUNNELS = [
  {
    id: 'te-lsp-shahdara-ravi-101',
    name: 'Shahdara NOC LER-01 -> Ravi Siphon LSR-01 Express LSP',
    primaryArea: 'Ravi Siphon',
    secondaryAreas: ['Shahdara Town', 'Kot Abdul Malik'],
    physicalCapacityMbps: 10000, // 10 Gbps
    reservedBandwidthMbps: 6500,
    setupPriority: 7,
    holdingPriority: 7,
    ingressRouter: 'SHD-NOC-LER01',
    egressRouter: 'RAVI-SIPHON-LSR01',
    primaryEroHops: ['SHD-NOC-LER01', 'SW-CORE01', 'RAVI-SIPHON-LSR01'],
    backupBypassTunnel: {
      id: 'te-bypass-ravi-via-baradari',
      name: 'Bypass LSP via Baradari LSR-02',
      physicalCapacityMbps: 10000,
      reservedBandwidthMbps: 7200,
      backupEroHops: ['SHD-NOC-LER01', 'BARADARI-LSR02', 'RAVI-SIPHON-LSR01']
    },
    operationalRole: 'Wholesale Transit & Core Ring Primary Backbone'
  },
  {
    id: 'te-lsp-shahdara-kam-102',
    name: 'Shahdara NOC LER-01 -> Kot Abdul Malik LER-02 Metro LSP',
    primaryArea: 'Kot Abdul Malik',
    secondaryAreas: ['Shahdara Town'],
    physicalCapacityMbps: 10000,
    reservedBandwidthMbps: 5200,
    setupPriority: 7,
    holdingPriority: 7,
    ingressRouter: 'SHD-NOC-LER01',
    egressRouter: 'KAM-EDGE-LER02',
    primaryEroHops: ['SHD-NOC-LER01', 'SW-CORE02', 'KAM-EDGE-LER02'],
    backupBypassTunnel: {
      id: 'te-bypass-kam-via-sheikhupura',
      name: 'Bypass LSP via SKP Western Arc',
      physicalCapacityMbps: 10000,
      reservedBandwidthMbps: 5800,
      backupEroHops: ['SHD-NOC-LER01', 'SKP-GW01', 'KAM-EDGE-LER02']
    },
    operationalRole: 'Industrial Dedicated Internet Access (DIA) Trunk'
  },
  {
    id: 'te-lsp-shahdara-vandala-103',
    name: 'Shahdara NOC LER-01 -> Vandala Distribution LER-03 LSP',
    primaryArea: 'Vandala Road',
    secondaryAreas: ['Shahdara Town'],
    physicalCapacityMbps: 10000,
    reservedBandwidthMbps: 4800,
    setupPriority: 7,
    holdingPriority: 7,
    ingressRouter: 'SHD-NOC-LER01',
    egressRouter: 'VANDALA-DIST-LER03',
    primaryEroHops: ['SHD-NOC-LER01', 'SW-AGG01', 'VANDALA-DIST-LER03'],
    backupBypassTunnel: {
      id: 'te-bypass-vandala-via-kam',
      name: 'Bypass LSP via Kot Abdul Malik Sub-Ring',
      physicalCapacityMbps: 10000,
      reservedBandwidthMbps: 5000,
      backupEroHops: ['SHD-NOC-LER01', 'KAM-EDGE-LER02', 'VANDALA-DIST-LER03']
    },
    operationalRole: 'FTTH High-Density GPON Aggregation Feeder'
  },
  {
    id: 'te-lsp-baradari-transit-104',
    name: 'Baradari LSR-02 -> Ravi Metro Peering Backbone LSP',
    primaryArea: 'Baradari',
    secondaryAreas: ['Shahdara Town'],
    physicalCapacityMbps: 20000, // 20 Gbps Link Aggregation
    reservedBandwidthMbps: 12500,
    setupPriority: 6,
    holdingPriority: 6,
    ingressRouter: 'BARADARI-LSR02',
    egressRouter: 'RAVI-SIPHON-LSR01',
    primaryEroHops: ['BARADARI-LSR02', 'SW-CORE01', 'RAVI-SIPHON-LSR01'],
    backupBypassTunnel: {
      id: 'te-bypass-baradari-direct',
      name: 'Bypass LSP via Direct Optical Express Ring',
      physicalCapacityMbps: 20000,
      reservedBandwidthMbps: 14000,
      backupEroHops: ['BARADARI-LSR02', 'OPT-ROADMO1', 'RAVI-SIPHON-LSR01']
    },
    operationalRole: 'High-Throughput Metro Ring Peering Transport'
  },
  {
    id: 'te-lsp-sheikhupura-peering-105',
    name: 'Shahdara Core -> Sheikhupura IXP Gateway LSP',
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Kot Abdul Malik', 'Ravi Siphon'],
    physicalCapacityMbps: 40000, // 40 Gbps
    reservedBandwidthMbps: 27500,
    setupPriority: 5,
    holdingPriority: 5,
    ingressRouter: 'SHD-NOC-LER01',
    egressRouter: 'SKP-IXP-GW01',
    primaryEroHops: ['SHD-NOC-LER01', 'TRANSIT-PE01', 'SKP-IXP-GW01'],
    backupBypassTunnel: {
      id: 'te-bypass-skp-multi-homed',
      name: 'Bypass LSP via Secondary IXP Peering Span',
      physicalCapacityMbps: 40000,
      reservedBandwidthMbps: 30000,
      backupEroHops: ['SHD-NOC-LER01', 'TRANSIT-PE02', 'SKP-IXP-GW01']
    },
    operationalRole: 'Inter-City Wholesale Carrier Peering'
  }
];

// Interactive state
let simSelectedTunnelId = MPLS_TE_CONSTANTS.DEFAULT_TUNNEL_ID;
let simFrrMode = MPLS_TE_CONSTANTS.DEFAULT_FRR_MODE;
let simCongestionPct = MPLS_TE_CONSTANTS.DEFAULT_CONGESTION_PCT;
let simLinkCutInjected = MPLS_TE_CONSTANTS.DEFAULT_LINK_CUT;

export function getMplsTeSelectedTunnel() {
  return simSelectedTunnelId;
}

export function setMplsTeSelectedTunnel(id) {
  if (SHAHDARA_TE_TUNNELS.some(t => t.id === id)) {
    simSelectedTunnelId = id;
    simCongestionPct = 0;
    simLinkCutInjected = false;
  }
}

export function getMplsTeFrrMode() {
  return simFrrMode;
}

export function setMplsTeFrrMode(mode) {
  if (Object.keys(MPLS_TE_CONSTANTS.FRR_MODES).includes(mode)) {
    simFrrMode = mode;
  }
}

export function getMplsTeCongestionPct() {
  return simCongestionPct;
}

export function setMplsTeCongestionPct(val) {
  const num = parseInt(val, 10);
  if (!Number.isNaN(num) && num >= 0 && num <= 100) {
    simCongestionPct = num;
  }
}

export function getMplsTeLinkCutInjected() {
  return simLinkCutInjected;
}

export function setMplsTeLinkCutInjected(val) {
  simLinkCutInjected = Boolean(val);
}

export function resetMplsTeSimState() {
  simSelectedTunnelId = MPLS_TE_CONSTANTS.DEFAULT_TUNNEL_ID;
  simFrrMode = MPLS_TE_CONSTANTS.DEFAULT_FRR_MODE;
  simCongestionPct = MPLS_TE_CONSTANTS.DEFAULT_CONGESTION_PCT;
  simLinkCutInjected = MPLS_TE_CONSTANTS.DEFAULT_LINK_CUT;
}

/**
 * Calculates physical RSVP-TE and FRR dynamics for an active tunnel.
 */
export function calculateMplsTeDynamics(params = {}) {
  const tunnelId = params.tunnelId || MPLS_TE_CONSTANTS.DEFAULT_TUNNEL_ID;
  const tunnel = SHAHDARA_TE_TUNNELS.find(t => t.id === tunnelId) || SHAHDARA_TE_TUNNELS[0];
  const frrMode = params.frrMode && MPLS_TE_CONSTANTS.FRR_MODES[params.frrMode] ? params.frrMode : MPLS_TE_CONSTANTS.DEFAULT_FRR_MODE;
  const congestionPct = Math.max(0, Math.min(100, parseInt(params.congestionPct ?? 0, 10)));
  const isLinkCut = Boolean(params.isLinkCut);

  const physicalCapacityMbps = tunnel.physicalCapacityMbps;
  const nominalReservedMbps = tunnel.reservedBandwidthMbps;
  // Dynamic congestion adds burst load above base reservation
  const dynamicCongestionMbps = Math.round((physicalCapacityMbps - nominalReservedMbps) * (congestionPct / 100));
  const activeTrafficLoadMbps = nominalReservedMbps + dynamicCongestionMbps;

  // Active path and bypass characteristics
  const isProtectionActive = isLinkCut;
  const activePath = isProtectionActive ? tunnel.backupBypassTunnel.backupEroHops : tunnel.primaryEroHops;
  const activeCapacityMbps = isProtectionActive ? tunnel.backupBypassTunnel.physicalCapacityMbps : physicalCapacityMbps;

  // Unreserved headroom
  const unreservedHeadroomMbps = Math.max(0, activeCapacityMbps - activeTrafficLoadMbps);
  const utilizationPct = Math.min(100, Math.round((activeTrafficLoadMbps / activeCapacityMbps) * 100));

  // FRR Local Repair Latency (sub-50ms)
  const failoverLatencyMs = frrMode === 'FACILITY_BYPASS' ? MPLS_TE_CONSTANTS.FRR_FACILITY_FAILOVER_MS : MPLS_TE_CONSTANTS.FRR_DETOUR_FAILOVER_MS;

  // Deficit / packet drop risk if active traffic exceeds available protection capacity
  const capacityDeficitMbps = Math.max(0, activeTrafficLoadMbps - activeCapacityMbps);

  // Status determination
  let status = MPLS_TE_CONSTANTS.STATUS.OPTIMAL;
  let statusReason = 'RSVP-TE LSP operating with optimal headroom and FRR facility bypass protection ready.';

  if (capacityDeficitMbps > 0 || utilizationPct >= MPLS_TE_CONSTANTS.HEADROOM_CRITICAL_UTIL_PCT) {
    status = MPLS_TE_CONSTANTS.STATUS.CRITICAL;
    if (capacityDeficitMbps > 0) {
      statusReason = `Critical traffic overload (${activeTrafficLoadMbps} Mbps exceeds ${activeCapacityMbps} Mbps capacity). Packet drops occurring on LSP!`;
    } else {
      statusReason = `Critical LSP utilization (${utilizationPct}%). Unreserved headroom depleted below 10%.`;
    }
  } else if (isProtectionActive || utilizationPct >= MPLS_TE_CONSTANTS.HEADROOM_WARNING_UTIL_PCT) {
    status = MPLS_TE_CONSTANTS.STATUS.WARNING;
    if (isProtectionActive) {
      statusReason = `Link cut detected! Traffic rerouted via ${tunnel.backupBypassTunnel.name} in ${failoverLatencyMs.toFixed(1)} ms. Local repair active.`;
    } else {
      statusReason = `Elevated LSP utilization (${utilizationPct}%). Unreserved headroom nearing 25% threshold.`;
    }
  }

  return {
    tunnel,
    frrMode,
    congestionPct,
    isLinkCut,
    isProtectionActive,
    activePath,
    activeCapacityMbps,
    nominalReservedMbps,
    dynamicCongestionMbps,
    activeTrafficLoadMbps,
    unreservedHeadroomMbps,
    utilizationPct,
    failoverLatencyMs,
    capacityDeficitMbps,
    status,
    statusReason
  };
}

/**
 * Correlates MPLS-TE metrics with live Shahdara subscriber state and MRR.
 */
export function calculateMplsTeMetrics(state = {}, options = {}) {
  const tunnelId = options.tunnelId || simSelectedTunnelId;
  const frrMode = options.frrMode || simFrrMode;
  const congestionPct = options.congestionPct !== undefined ? options.congestionPct : simCongestionPct;
  const isLinkCut = options.isLinkCut !== undefined ? options.isLinkCut : simLinkCutInjected;

  const dynamics = calculateMplsTeDynamics({
    tunnelId,
    frrMode,
    congestionPct,
    isLinkCut
  });

  const tunnel = dynamics.tunnel;
  const customers = Array.isArray(state.customers) ? state.customers : [];
  const primaryArea = tunnel.primaryArea;
  const secondaryAreas = tunnel.secondaryAreas || [];
  const allAffectedAreas = [primaryArea, ...secondaryAreas];

  let totalLinkedSubscribers = 0;
  let activeLinkedSubscribers = 0;
  let monthlyRecurringRevenuePkr = 0;

  for (const c of customers) {
    if (c.archived) continue;
    const area = (c.area || '').trim();
    const isAffected = allAffectedAreas.some(a => a.toLowerCase() === area.toLowerCase());
    if (isAffected) {
      totalLinkedSubscribers++;
      const isActive = (c.serviceStatus || '').toLowerCase() === 'active';
      if (isActive) {
        activeLinkedSubscribers++;
        const bills = Array.isArray(c.bills) ? c.bills : [];
        const latestBill = bills.length > 0 ? bills[bills.length - 1] : null;
        const billAmount = latestBill && latestBill.dueAmount ? Number(latestBill.dueAmount) : 0;
        monthlyRecurringRevenuePkr += (!Number.isNaN(billAmount) && billAmount > 0) ? billAmount : 1800;
      }
    }
  }

  // Calculate revenue at risk
  let riskFactor = 0;
  if (dynamics.status === MPLS_TE_CONSTANTS.STATUS.CRITICAL) {
    riskFactor = 1.0;
  } else if (dynamics.status === MPLS_TE_CONSTANTS.STATUS.WARNING) {
    riskFactor = 0.35;
  }
  const revenueAtRiskPkr = Math.round(monthlyRecurringRevenuePkr * riskFactor);

  return {
    tunnel,
    dynamics,
    totalLinkedSubscribers,
    activeLinkedSubscribers,
    monthlyRecurringRevenuePkr,
    revenueAtRiskPkr,
    allAffectedAreas
  };
}

/**
 * Pure offline SVG visualization of MPLS-TE Topology, ERO Hops, FRR Local Repair,
 * Headroom Capacity Bar, and Sub-50ms Protection Status.
 */
export function renderMplsTeDiagramSvg(metrics, options = {}) {
  const isCompact = !!options.compact;
  const d = metrics.dynamics;
  const t = metrics.tunnel;
  const width = isCompact ? 720 : 860;
  const height = isCompact ? 300 : 380;

  const statusColor = d.status === MPLS_TE_CONSTANTS.STATUS.OPTIMAL ? '#10b981'
    : d.status === MPLS_TE_CONSTANTS.STATUS.WARNING ? '#f59e0b' : '#ef4444';

  const titleY = isCompact ? 22 : 28;
  const footerY = height - 12;

  // Node Positions for Topology
  const startX = 90;
  const endX = width - 90;
  const midX = (startX + endX) / 2;

  const primaryY = isCompact ? 95 : 120;
  const bypassY = isCompact ? 185 : 230;

  // Primary Path Line
  const primaryStroke = d.isLinkCut ? '#ef4444' : '#38bdf8';
  const primaryDash = d.isLinkCut ? '4,4' : 'none';
  const primaryLabel = d.isLinkCut ? 'LINK CUT (FAILED)' : 'PRIMARY ACTIVE LSP';

  // Bypass Path Line
  const bypassStroke = d.isProtectionActive ? '#10b981' : '#64748b';
  const bypassDash = d.isProtectionActive ? 'none' : '4,4';
  const bypassLabel = d.isProtectionActive ? 'FRR BYPASS ACTIVE (REROUTED)' : 'FRR BACKUP READY (STANDBY)';

  // Headroom gauge dimensions
  const gaugeX = 90;
  const gaugeY = isCompact ? 225 : 295;
  const gaugeW = width - 180;
  const gaugeH = 14;
  const fillW = (d.utilizationPct / 100) * gaugeW;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="mpls-te-diagram-svg" style="width: 100%; height: auto; background: var(--bg-card, #ffffff); border-radius: 8px; font-family: Manrope, system-ui, sans-serif;">
      <!-- Title Header -->
      <text x="60" y="${titleY}" fill="var(--ink, #182e2a)" font-size="13" font-weight="700">
        MPLS Traffic Engineering (RSVP-TE &amp; FRR Protection): ${t.name}
      </text>
      <rect x="${width - 130}" y="${titleY - 14}" width="95" height="20" rx="4" fill="${statusColor}22" stroke="${statusColor}" stroke-width="1"/>
      <text x="${width - 82}" y="${titleY}" fill="${statusColor}" font-size="11" font-weight="700" text-anchor="middle">
        ${d.status.toUpperCase()}
      </text>

      <!-- Primary Path Link -->
      <line x1="${startX}" y1="${primaryY}" x2="${endX}" y2="${primaryY}" stroke="${primaryStroke}" stroke-width="3" stroke-dasharray="${primaryDash}"/>
      <text x="${midX}" y="${primaryY - 10}" fill="${primaryStroke}" font-size="10" font-weight="700" text-anchor="middle">${primaryLabel}</text>

      <!-- FRR Bypass Path Curve -->
      <path d="M ${startX} ${primaryY} C ${startX + 60} ${bypassY}, ${endX - 60} ${bypassY}, ${endX} ${primaryY}" fill="none" stroke="${bypassStroke}" stroke-width="2.5" stroke-dasharray="${bypassDash}"/>
      <text x="${midX}" y="${bypassY + 18}" fill="${bypassStroke}" font-size="10" font-weight="700" text-anchor="middle">${bypassLabel}</text>

      <!-- Ingress LER Node -->
      <circle cx="${startX}" cy="${primaryY}" r="16" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5"/>
      <text x="${startX}" y="${primaryY + 4}" fill="#ffffff" font-size="9" font-weight="700" text-anchor="middle">LER-01</text>
      <text x="${startX}" y="${primaryY + 30}" fill="var(--ink, #182e2a)" font-size="10" font-weight="700" text-anchor="middle">Point of Local Repair (PLR)</text>

      <!-- Core LSR Hop -->
      <circle cx="${midX}" cy="${primaryY}" r="14" fill="${d.isLinkCut ? '#ef4444' : '#0369a1'}" stroke="#7dd3fc" stroke-width="2"/>
      <text x="${midX}" y="${primaryY + 4}" fill="#ffffff" font-size="9" font-weight="700" text-anchor="middle">LSR-01</text>
      ${d.isLinkCut ? `<text x="${midX}" y="${primaryY + 24}" fill="#ef4444" font-size="10" font-weight="700" text-anchor="middle">CUT FAULT</text>` : ''}

      <!-- Egress LER Node -->
      <circle cx="${endX}" cy="${primaryY}" r="16" fill="#0284c7" stroke="#38bdf8" stroke-width="2.5"/>
      <text x="${endX}" y="${primaryY + 4}" fill="#ffffff" font-size="9" font-weight="700" text-anchor="middle">LER-02</text>
      <text x="${endX}" y="${primaryY + 30}" fill="var(--ink, #182e2a)" font-size="10" font-weight="700" text-anchor="middle">Merge Point (MP)</text>

      <!-- Bypass Intermediate Node -->
      <circle cx="${midX}" cy="${bypassY}" r="13" fill="#0d9488" stroke="#5eead4" stroke-width="2"/>
      <text x="${midX}" y="${bypassY + 4}" fill="#ffffff" font-size="8.5" font-weight="700" text-anchor="middle">BARADARI</text>

      <!-- Headroom Gauge Bar -->
      <text x="${gaugeX}" y="${gaugeY - 6}" fill="var(--muted, #60756c)" font-size="10" font-weight="700">
        LSP BANDWIDTH RESERVATION &amp; HEADROOM: ${d.activeTrafficLoadMbps} / ${d.activeCapacityMbps} Mbps (${d.utilizationPct}%)
      </text>
      <rect x="${gaugeX}" y="${gaugeY}" width="${gaugeW}" height="${gaugeH}" rx="7" fill="var(--bg-soft, #f1f5f9)" stroke="var(--line, #cbd5e1)" stroke-width="1"/>
      <rect x="${gaugeX}" y="${gaugeY}" width="${fillW}" height="${gaugeH}" rx="7" fill="${statusColor}"/>

      <!-- Footer Quick Summary -->
      <text x="60" y="${footerY}" fill="var(--muted, #60756c)" font-size="10.5">
        FRR Latency: <tspan font-weight="700" fill="#10b981">${d.failoverLatencyMs.toFixed(1)} ms</tspan> &bull;
        Unreserved Headroom: <tspan font-weight="700" fill="var(--ink, #182e2a)">${d.unreservedHeadroomMbps} Mbps</tspan> &bull;
        Protection Mode: <tspan font-weight="700">${d.frrMode}</tspan> &bull;
        Subscribers: <tspan font-weight="700">${metrics.activeLinkedSubscribers} Active</tspan> &bull;
        Revenue at Risk: <tspan font-weight="700" fill="${metrics.revenueAtRiskPkr > 0 ? '#ef4444' : '#10b981'}">${formatPKR(metrics.revenueAtRiskPkr)}</tspan>
      </text>
    </svg>
  `;
}

/**
 * Generates comprehensive MPLS-TE briefing report for clipboard copying.
 */
export function generateMplsTeReport(metrics) {
  const d = metrics.dynamics;
  const t = metrics.tunnel;

  return `========================================================================
SHAHDARA METRO MPLS-TE & FAST REROUTE (FRR) PROTECTION BRIEFING
RFC 3209 (RSVP-TE) / RFC 4090 (Fast Reroute Local Repair Facility Bypass)
========================================================================
LSP Identifier           : ${t.id}
LSP Name                 : ${t.name}
Ingress LER (PLR)        : ${t.ingressRouter}
Egress LER (MP)          : ${t.egressRouter}
Operational Role         : ${t.operationalRole}
Primary Impact Area      : ${t.primaryArea} (Secondary: ${metrics.allAffectedAreas.slice(1).join(', ') || 'None'})

PATH ROUTING & EXPLICIT ROUTE OBJECTS (ERO)
------------------------------------------------------------------------
Active Path In-Use       : ${d.activePath.join(' -> ')}
Primary ERO Route        : ${t.primaryEroHops.join(' -> ')}
FRR Backup Bypass ERO    : ${t.backupBypassTunnel.backupEroHops.join(' -> ')}
FRR Protection Mechanism : ${d.frrMode} (${MPLS_TE_CONSTANTS.FRR_MODES[d.frrMode]})
Local Repair Latency     : ${d.failoverLatencyMs.toFixed(1)} ms (Sub-50ms Carrier SLA Target: Pass)
Link Fault Simulation    : ${d.isLinkCut ? 'ACTIVE LINK CUT (PROTECTION IN-USE)' : 'Normal Primary Operation'}

BANDWIDTH ACCOUNTING & UNRESERVED HEADROOM
------------------------------------------------------------------------
Physical Link Capacity   : ${d.activeCapacityMbps} Mbps
Base Reserved Bandwidth  : ${d.nominalReservedMbps} Mbps
Dynamic Congestion Add   : +${d.dynamicCongestionMbps} Mbps (${d.congestionPct}% burst)
Total Active Traffic     : ${d.activeTrafficLoadMbps} Mbps
Unreserved Headroom      : ${d.unreservedHeadroomMbps} Mbps (${d.activeCapacityMbps - d.activeTrafficLoadMbps >= 0 ? 'Surplus' : 'Deficit'})
Bandwidth Utilization    : ${d.utilizationPct}% (Warning: >=75%, Critical: >=90%)
Capacity Deficit Drops   : ${d.capacityDeficitMbps} Mbps

OPERATIONAL STATUS & DIAGNOSTICS
------------------------------------------------------------------------
Operational Status       : ${d.status.toUpperCase()}
Diagnostic Assessment    : ${d.statusReason}

SUBSCRIBER REVENUE AT RISK
------------------------------------------------------------------------
Active Linked Subscribers: ${metrics.activeLinkedSubscribers} Accounts
Total Connected Accounts : ${metrics.totalLinkedSubscribers} Accounts
Monthly Recurring Revenue: ${formatPKR(metrics.monthlyRecurringRevenuePkr)}
Revenue at Risk          : ${formatPKR(metrics.revenueAtRiskPkr)}

RECOMMENDED ACTION:
${d.status === MPLS_TE_CONSTANTS.STATUS.OPTIMAL ? '- Path headroom is optimal. FRR bypass LSP is healthy and in standby.' : d.status === MPLS_TE_CONSTANTS.STATUS.WARNING ? '- Monitor backup tunnel utilization or re-optimize CSPF primary path.' : '- Immediate action: Trigger RSVP-TE preemption or allocate additional 10G LAG member to resolve capacity deficit.'}
========================================================================`;
}

/**
 * Initializes and wires interactive MPLS-TE modal dialog and quick action.
 */
export function setupMplsTeModal(state = {}, options = {}) {
  const modal = document.getElementById('dashboardMplsTeModal');
  const openBtn = document.getElementById('dashboardOpenMplsTeModalBtn');
  const closeBtn = document.getElementById('dashboardMplsTeModalCloseBtn');

  const tunnelSelect = document.getElementById('mplsTeTunnelSelect');
  const frrSelect = document.getElementById('mplsTeFrrSelect');
  const congestionSlider = document.getElementById('mplsTeCongestionSlider');
  const congestionLabel = document.getElementById('mplsTeCongestionValueLabel');
  const linkCutCheck = document.getElementById('mplsTeLinkCutCheck');
  const resetBtn = document.getElementById('mplsTeResetSimBtn');

  const statUtil = document.getElementById('mplsTeStatUtil');
  const statHeadroom = document.getElementById('mplsTeStatHeadroom');
  const statLatency = document.getElementById('mplsTeStatLatency');
  const statDeficit = document.getElementById('mplsTeStatDeficit');
  const statStatus = document.getElementById('mplsTeStatStatus');
  const statRevenue = document.getElementById('mplsTeStatRevenue');

  const diagramContainer = document.getElementById('mplsTeModalDiagramContainer');
  const filterAreaBtn = document.getElementById('mplsTeFilterAreaBtn');
  const copyReportBtn = document.getElementById('mplsTeCopyReportBtn');

  function renderView() {
    const metrics = calculateMplsTeMetrics(state);
    const d = metrics.dynamics;

    if (tunnelSelect) tunnelSelect.value = simSelectedTunnelId;
    if (frrSelect) frrSelect.value = simFrrMode;
    if (congestionSlider) congestionSlider.value = simCongestionPct;
    if (congestionLabel) congestionLabel.textContent = `+${simCongestionPct}%`;
    if (linkCutCheck) linkCutCheck.checked = simLinkCutInjected;

    if (statUtil) {
      statUtil.textContent = `${d.utilizationPct}%`;
      statUtil.style.color = d.utilizationPct >= MPLS_TE_CONSTANTS.HEADROOM_CRITICAL_UTIL_PCT ? '#ef4444' : d.utilizationPct >= MPLS_TE_CONSTANTS.HEADROOM_WARNING_UTIL_PCT ? '#f59e0b' : '#10b981';
    }
    if (statHeadroom) {
      statHeadroom.textContent = `${d.unreservedHeadroomMbps} Mbps`;
      statHeadroom.style.color = d.unreservedHeadroomMbps <= 500 ? '#ef4444' : '#38bdf8';
    }
    if (statLatency) {
      statLatency.textContent = `${d.failoverLatencyMs.toFixed(1)} ms`;
      statLatency.style.color = '#10b981';
    }
    if (statDeficit) {
      statDeficit.textContent = `${d.capacityDeficitMbps} Mbps`;
      statDeficit.style.color = d.capacityDeficitMbps > 0 ? '#ef4444' : '#10b981';
    }
    if (statStatus) {
      statStatus.textContent = d.status.toUpperCase();
      statStatus.style.color = d.status === MPLS_TE_CONSTANTS.STATUS.OPTIMAL ? '#10b981' : d.status === MPLS_TE_CONSTANTS.STATUS.WARNING ? '#f59e0b' : '#ef4444';
    }
    if (statRevenue) {
      statRevenue.textContent = formatPKR(metrics.revenueAtRiskPkr);
      statRevenue.style.color = metrics.revenueAtRiskPkr > 0 ? '#ef4444' : '#10b981';
    }

    if (diagramContainer) {
      diagramContainer.innerHTML = renderMplsTeDiagramSvg(metrics, { compact: false });
    }

    // Update compact chart if present
    const dashboardChart = document.getElementById('dashboardMplsTeChart');
    if (dashboardChart) {
      dashboardChart.innerHTML = renderMplsTeDiagramSvg(metrics, { compact: true });
    }
  }

  // Wire events
  if (tunnelSelect) {
    tunnelSelect.onchange = () => {
      setMplsTeSelectedTunnel(tunnelSelect.value);
      renderView();
    };
  }

  if (frrSelect) {
    frrSelect.onchange = () => {
      setMplsTeFrrMode(frrSelect.value);
      renderView();
    };
  }

  if (congestionSlider) {
    congestionSlider.oninput = () => {
      setMplsTeCongestionPct(congestionSlider.value);
      renderView();
    };
  }

  if (linkCutCheck) {
    linkCutCheck.onchange = () => {
      setMplsTeLinkCutInjected(linkCutCheck.checked);
      renderView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetMplsTeSimState();
      renderView();
    };
  }

  if (openBtn && modal) {
    openBtn.onclick = () => {
      renderView();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', 'true');
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
      const metrics = calculateMplsTeMetrics(state);
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
      const metrics = calculateMplsTeMetrics(state);
      const text = generateMplsTeReport(metrics);
      try {
        const cb = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
        if (cb?.writeText) {
          await cb.writeText(text);
          if (typeof options.onToast === 'function') {
            options.onToast('MPLS-TE briefing copied to clipboard!');
          }
        } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy MPLS-TE briefing:', text);
        }
      } catch (err) {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy MPLS-TE briefing:', text);
        }
      }
    };
  }

  // Initial draw
  renderView();
}
