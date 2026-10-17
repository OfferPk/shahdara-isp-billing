import { formatPKR } from './core.js';

/**
 * Carrier BGP/MPLS IP VPN (L3VPN - RFC 4364 / RFC 4659 / RFC 4360)
 * Multi-VRF Routing, Route Distinguisher (RD) & Route Target (RT) Isolation Telemetry Matrix
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Pure-Vector SVG Visualizer & SLA Telemetry
 */

export const L3VPN_CONSTANTS = {
  DEFAULT_VRF_ID: 'vrf-hbl-banking',
  WARNING_PREFIX_RATIO: 0.75, // 75% max-prefix threshold triggers telemetry warning
  CRITICAL_PREFIX_RATIO: 0.90, // 90% max-prefix threshold triggers alert

  PE_CE_PROTOCOLS: {
    EBGP: {
      code: 'EBGP',
      name: 'eBGP (External BGP)',
      port: 179,
      convergenceMs: 85,
      asOverrideSupported: true,
      description: 'Direct eBGP peering with AS-Override for multi-site branch routing'
    },
    OSPF: {
      code: 'OSPF',
      name: 'OSPF (RFC 4577)',
      port: 89,
      convergenceMs: 120,
      shamLinkSupported: true,
      description: 'IGP with Sham-Link over MPLS core to suppress unencrypted backdoor paths'
    },
    STATIC_BFD: {
      code: 'STATIC_BFD',
      name: 'Static / Micro-BFD',
      port: 3784,
      convergenceMs: 30,
      description: 'Deterministic static routes backed by microsecond hardware BFD tracking'
    }
  },

  STATUS: {
    OPTIMAL: 'Optimal (Strict VRF Isolation & Ample Prefix Headroom)',
    WARNING_CAPACITY: 'Warning: VRF Approaching Max-Prefix Threshold (≥ 75%)',
    CRITICAL_CAPACITY: 'Critical: High Prefix Utilization Alert (≥ 90%)',
    EXTRANET_SHARED: 'Active Extranet (Controlled Route Leaking via Shared RT)',
    LEAK_DETECTED: 'Security Alert: Unauthorized Cross-VRF Route Leakage'
  }
};

export const SHAHDARA_L3VPN_VRFS = [
  {
    id: 'vrf-hbl-banking',
    name: 'Habib Bank Limited (HBL) Financial Core & ATM Ring',
    primaryArea: 'Shahdara Town',
    rd: '65001:101',
    rdType: 'Type 0 (2-byte AS)',
    rtExport: ['target:65001:101'],
    rtImport: ['target:65001:101'],
    peCeProtocol: 'EBGP',
    customerAsn: 65101,
    asOverride: true,
    maxPrefixes: 500,
    activePrefixes: 142,
    transportLabel: 1001,
    vpnLabel: 20101,
    qosClass: 'EF (Expedited Forwarding - Core Ledger & ATMs)',
    monthlyRevenuePkr: 3850000,
    branchSitesCount: 14,
    bandwidthMbps: 1200
  },
  {
    id: 'vrf-punjab-cctv',
    name: 'Punjab Safe Cities Authority / Municipal CCTV Ring',
    primaryArea: 'Begum Kot',
    rd: '65001:102',
    rdType: 'Type 0 (2-byte AS)',
    rtExport: ['target:65001:102'],
    rtImport: ['target:65001:102', 'target:65001:999'],
    peCeProtocol: 'OSPF',
    ospfDomainId: '0.0.0.1',
    shamLinkConfigured: true,
    backdoorLinkCost: 200,
    shamLinkCost: 50,
    maxPrefixes: 1200,
    activePrefixes: 486,
    transportLabel: 1002,
    vpnLabel: 20102,
    qosClass: 'AF41 (Video Surveillance Feeds & Telemetry)',
    monthlyRevenuePkr: 6200000,
    branchSitesCount: 38,
    bandwidthMbps: 4800
  },
  {
    id: 'vrf-ravi-health',
    name: 'Ravi Teaching Hospital & Healthcare Telemedicine Network',
    primaryArea: 'Ravi Siphon',
    rd: '65001:103',
    rdType: 'Type 0 (2-byte AS)',
    rtExport: ['target:65001:103'],
    rtImport: ['target:65001:103'],
    peCeProtocol: 'STATIC_BFD',
    bfdMultiplier: 3,
    bfdIntervalMs: 50,
    maxPrefixes: 350,
    activePrefixes: 88,
    transportLabel: 1003,
    vpnLabel: 20103,
    qosClass: 'AF31 (Telemedicine Audio/Video & PACS Imaging)',
    monthlyRevenuePkr: 2400000,
    branchSitesCount: 8,
    bandwidthMbps: 850
  },
  {
    id: 'vrf-higher-edu',
    name: 'Government College & Shahdara Academic Campuses VPN',
    primaryArea: 'Vandala Road',
    rd: '65001:104',
    rdType: 'Type 0 (2-byte AS)',
    rtExport: ['target:65001:104'],
    rtImport: ['target:65001:104', 'target:65001:999'],
    peCeProtocol: 'EBGP',
    customerAsn: 65104,
    dualStackIpv6: true,
    maxPrefixes: 800,
    activePrefixes: 310,
    transportLabel: 1004,
    vpnLabel: 20104,
    qosClass: 'AF21 (Research Labs, Digital Library & LMS)',
    monthlyRevenuePkr: 2900000,
    branchSitesCount: 6,
    bandwidthMbps: 2400
  },
  {
    id: 'vrf-baradari-ind',
    name: 'Baradari Industrial Estate Textile Mills & Logistics Extranet',
    primaryArea: 'Baradari',
    rd: '65001:105',
    rdType: 'Type 0 (2-byte AS)',
    rtExport: ['target:65001:105'],
    rtImport: ['target:65001:105'],
    peCeProtocol: 'EBGP',
    customerAsn: 65105,
    maxPrefixes: 2500,
    activePrefixes: 1140,
    transportLabel: 1005,
    vpnLabel: 20105,
    qosClass: 'AF11 (ERP Systems, Logistics & SCADA Controls)',
    monthlyRevenuePkr: 7100000,
    branchSitesCount: 42,
    bandwidthMbps: 6500
  }
];

// Interactive state variables
let currentSelectedVrfId = L3VPN_CONSTANTS.DEFAULT_VRF_ID;
let currentPrefixInjectionOffset = 0; // Simulated injected routes (+ / -)
let currentSimulatedProtocol = null; // Override protocol if set
let currentSimulatedLeakTarget = null; // Test security isolation leak

export function getL3VpnSelectedVrfId() {
  return currentSelectedVrfId;
}

export function setL3VpnSelectedVrfId(id) {
  if (SHAHDARA_L3VPN_VRFS.some(v => v.id === id)) {
    currentSelectedVrfId = id;
  }
}

export function getL3VpnPrefixInjectionOffset() {
  return currentPrefixInjectionOffset;
}

export function setL3VpnPrefixInjectionOffset(offset) {
  const num = parseInt(offset, 10);
  if (!Number.isNaN(num)) {
    currentPrefixInjectionOffset = num;
  }
}

export function getL3VpnSimulatedProtocol() {
  return currentSimulatedProtocol;
}

export function setL3VpnSimulatedProtocol(proto) {
  if (proto === null || L3VPN_CONSTANTS.PE_CE_PROTOCOLS[proto]) {
    currentSimulatedProtocol = proto;
  }
}

export function getL3VpnSimulatedLeakTarget() {
  return currentSimulatedLeakTarget;
}

export function setL3VpnSimulatedLeakTarget(targetRt) {
  currentSimulatedLeakTarget = targetRt || null;
}

export function resetL3VpnSimState() {
  currentSelectedVrfId = L3VPN_CONSTANTS.DEFAULT_VRF_ID;
  currentPrefixInjectionOffset = 0;
  currentSimulatedProtocol = null;
  currentSimulatedLeakTarget = null;
}

/**
 * Calculates VRF prefix capacity, headroom, and thresholds.
 */
export function calculateVrfPrefixCapacity(activePrefixes, maxPrefixes) {
  const active = Math.max(0, parseInt(activePrefixes, 10) || 0);
  const max = Math.max(1, parseInt(maxPrefixes, 10) || 1);
  const utilizationRatio = Math.round((active / max) * 1000) / 1000;
  const utilizationPercent = Math.round(utilizationRatio * 1000) / 10;
  const headroom = Math.max(0, max - active);

  let statusLevel = 'nominal';
  if (utilizationRatio >= 1.0) {
    statusLevel = 'critical';
  } else if (utilizationRatio >= L3VPN_CONSTANTS.CRITICAL_PREFIX_RATIO) {
    statusLevel = 'critical';
  } else if (utilizationRatio >= L3VPN_CONSTANTS.WARNING_PREFIX_RATIO) {
    statusLevel = 'warning';
  }

  return {
    activePrefixes: active,
    maxPrefixes: max,
    headroom,
    utilizationRatio,
    utilizationPercent,
    statusLevel
  };
}

/**
 * Calculates MPLS 2-level encapsulation stack overhead.
 * Outer Transport Label (4B) + Inner VPN Label (4B) + Ethernet MAC (14B) + CRC (4B)
 */
export function calculateMplsLabelStack(transportLabel, vpnLabel, payloadBytes = 1500) {
  const outerLabelBytes = 4;
  const innerLabelBytes = 4;
  const ethernetL2HeaderBytes = 14;
  const crcBytes = 4;
  const totalMplsOverheadBytes = outerLabelBytes + innerLabelBytes;
  const totalFrameBytes = payloadBytes + ethernetL2HeaderBytes + totalMplsOverheadBytes + crcBytes;
  const payloadEfficiencyPercent = Math.round((payloadBytes / totalFrameBytes) * 1000) / 10;

  return {
    transportLabel: parseInt(transportLabel, 10) || 1000,
    vpnLabel: parseInt(vpnLabel, 10) || 20000,
    outerLabelBytes,
    innerLabelBytes,
    totalMplsOverheadBytes,
    totalFrameBytes,
    payloadEfficiencyPercent,
    requiredMtu: payloadBytes + totalMplsOverheadBytes
  };
}

/**
 * Validates OSPF Sham-Link configuration to guarantee MPLS core preference over backdoor links.
 * RFC 4577 Section 4.2.7: Sham-link cost must be strictly lower than backdoor link cost.
 */
export function calculateShamLinkMetrics(shamLinkCost, backdoorCost) {
  const sCost = parseInt(shamLinkCost, 10) || 1;
  const bCost = parseInt(backdoorCost, 10) || 100;
  const isOptimal = sCost < bCost;
  const costMargin = bCost - sCost;

  return {
    shamLinkCost: sCost,
    backdoorCost: bCost,
    isOptimal,
    costMargin,
    recommendation: isOptimal 
      ? 'Sham-Link cost is properly calibrated; MPLS superbackbone is preferred.'
      : 'Misconfiguration: Backdoor link cost is lower or equal. Traffic may bypass MPLS encryption core.'
  };
}

/**
 * Evaluates Route Target isolation and detects cross-VRF route leak risks.
 */
export function evaluateRouteTargetIsolation(activeVrf, candidateVrf, simulatedLeakRt = null) {
  const activeImports = new Set(activeVrf.rtImport);
  if (simulatedLeakRt) {
    activeImports.add(simulatedLeakRt);
  }

  const candidateExports = candidateVrf.rtExport;
  const intersectingCommunities = candidateExports.filter(rt => activeImports.has(rt));
  const isIsolated = intersectingCommunities.length === 0;

  return {
    sourceVrfId: candidateVrf.id,
    targetVrfId: activeVrf.id,
    intersectingCommunities,
    isIsolated,
    isExtranetShared: intersectingCommunities.includes('target:65001:999')
  };
}

/**
 * Computes complete L3VPN dynamics for the selected VRF and carrier-wide aggregations.
 */
export function calculateL3VpnDynamics(state = {}, options = {}) {
  const selectedId = options.vrfId || currentSelectedVrfId;
  const prefixOffset = (options.prefixOffset !== undefined) ? options.prefixOffset : currentPrefixInjectionOffset;
  const protoOverride = options.protocol || currentSimulatedProtocol;
  const leakTarget = options.simulatedLeak || currentSimulatedLeakTarget;

  const baseVrf = SHAHDARA_L3VPN_VRFS.find(v => v.id === selectedId) || SHAHDARA_L3VPN_VRFS[0];

  const effectiveActivePrefixes = Math.max(0, baseVrf.activePrefixes + prefixOffset);
  const prefixCap = calculateVrfPrefixCapacity(effectiveActivePrefixes, baseVrf.maxPrefixes);

  const effectiveProtoCode = protoOverride || baseVrf.peCeProtocol;
  const protoInfo = L3VPN_CONSTANTS.PE_CE_PROTOCOLS[effectiveProtoCode] || L3VPN_CONSTANTS.PE_CE_PROTOCOLS.EBGP;

  const labelStack = calculateMplsLabelStack(baseVrf.transportLabel, baseVrf.vpnLabel);

  let shamLink = null;
  if (baseVrf.shamLinkConfigured) {
    shamLink = calculateShamLinkMetrics(baseVrf.shamLinkCost, baseVrf.backdoorLinkCost);
  }

  // Cross-VRF isolation audit
  const isolationAudits = SHAHDARA_L3VPN_VRFS
    .filter(v => v.id !== baseVrf.id)
    .map(other => evaluateRouteTargetIsolation(baseVrf, other, leakTarget));

  const hasUnauthorizedLeak = isolationAudits.some(audit => !audit.isIsolated && !audit.isExtranetShared);
  const isExtranet = baseVrf.rtImport.includes('target:65001:999');

  let overallStatus = L3VPN_CONSTANTS.STATUS.OPTIMAL;
  let severity = 'nominal';

  if (hasUnauthorizedLeak) {
    overallStatus = L3VPN_CONSTANTS.STATUS.LEAK_DETECTED;
    severity = 'critical';
  } else if (prefixCap.statusLevel === 'critical') {
    overallStatus = (prefixCap.utilizationRatio >= 1.0)
      ? 'Alert: Max-Prefix Ceiling Reached (Routes Dropped / Session Policed)'
      : L3VPN_CONSTANTS.STATUS.CRITICAL_CAPACITY;
    severity = 'critical';
  } else if (prefixCap.statusLevel === 'warning') {
    overallStatus = L3VPN_CONSTANTS.STATUS.WARNING_CAPACITY;
    severity = 'warning';
  } else if (isExtranet) {
    overallStatus = L3VPN_CONSTANTS.STATUS.EXTRANET_SHARED;
    severity = 'nominal';
  }

  // Carrier-wide aggregations
  const totalSubscribedSites = SHAHDARA_L3VPN_VRFS.reduce((sum, v) => sum + v.branchSitesCount, 0);
  const totalMonthlyRevenue = SHAHDARA_L3VPN_VRFS.reduce((sum, v) => sum + v.monthlyRevenuePkr, 0);
  const totalBandwidthMbps = SHAHDARA_L3VPN_VRFS.reduce((sum, v) => sum + v.bandwidthMbps, 0);
  const totalMaxPrefixCapacity = SHAHDARA_L3VPN_VRFS.reduce((sum, v) => sum + v.maxPrefixes, 0);
  const totalActivePrefixes = SHAHDARA_L3VPN_VRFS.reduce((sum, v) => {
    return sum + (v.id === baseVrf.id ? effectiveActivePrefixes : v.activePrefixes);
  }, 0);

  return {
    selectedVrf: {
      ...baseVrf,
      effectiveActivePrefixes,
      effectiveProtoCode
    },
    protocolInfo: protoInfo,
    prefixCapacity: prefixCap,
    labelStack,
    shamLink,
    isolationAudits,
    hasUnauthorizedLeak,
    isExtranet,
    overallStatus,
    severity,
    aggregates: {
      totalVrfs: SHAHDARA_L3VPN_VRFS.length,
      totalSubscribedSites,
      totalMonthlyRevenue,
      totalBandwidthMbps,
      totalBandwidthGbps: Math.round((totalBandwidthMbps / 1000) * 10) / 10,
      totalMaxPrefixCapacity,
      totalActivePrefixes,
      overallPrefixUtilizationPercent: Math.round((totalActivePrefixes / totalMaxPrefixCapacity) * 1000) / 10
    }
  };
}

/**
 * Calculates summary metrics for quick dashboard rendering.
 */
export function calculateL3VpnMetrics(state = {}) {
  const dyn = calculateL3VpnDynamics(state);
  return {
    vrfName: dyn.selectedVrf.name,
    rd: dyn.selectedVrf.rd,
    protocol: dyn.protocolInfo.name,
    activePrefixes: dyn.prefixCapacity.activePrefixes,
    maxPrefixes: dyn.prefixCapacity.maxPrefixes,
    utilizationPercent: dyn.prefixCapacity.utilizationPercent,
    statusText: dyn.overallStatus,
    severity: dyn.severity,
    totalMonthlyRevenue: dyn.aggregates.totalMonthlyRevenue,
    totalSites: dyn.aggregates.totalSubscribedSites
  };
}

/**
 * Pure client-side SVG renderer for L3VPN Architecture & Telemetry.
 */
export function renderL3VpnDiagramSvg(dynamics, options = {}) {
  const d = dynamics || calculateL3VpnDynamics();
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
  const svgHeight = compact ? 270 : 380;

  const vrf = d.selectedVrf;
  const cap = d.prefixCapacity;
  const labels = d.labelStack;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" class="l3vpn-svg-diagram" style="width: 100%; height: auto; font-family: system-ui, -apple-system, sans-serif;">
    <defs>
      <linearGradient id="l3vpnCoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.85" />
        <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#ec4899" stop-opacity="0.85" />
      </linearGradient>
      <linearGradient id="l3vpnPacketGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#06b6d4" />
        <stop offset="100%" stop-color="#3b82f6" />
      </linearGradient>
      <filter id="l3vpnGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${svgWidth}" height="${svgHeight}" rx="10" fill="${bgFill}" stroke="${borderCol}" stroke-width="1.2" />

    <!-- Top Telemetry Ribbon -->
    <g transform="translate(18, 14)">
      <rect width="804" height="42" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
      <circle cx="16" cy="21" r="6" fill="${statusColor}" />
      <text x="32" y="25" font-size="13" font-weight="700" fill="${textMain}">
        VRF: ${escapeHtml(vrf.rd)} · ${escapeHtml(vrf.name.substring(0, 38))}
      </text>
      <text x="560" y="25" font-size="12" font-weight="600" fill="${textMuted}">
        Prefixes: <tspan fill="${statusColor}" font-weight="700">${cap.activePrefixes} / ${cap.maxPrefixes}</tspan> (${cap.utilizationPercent}%)
      </text>
      <text x="730" y="25" font-size="11" font-weight="700" fill="${statusColor}">
        ${cap.statusLevel.toUpperCase()}
      </text>
    </g>

    <!-- Topology: CE-1 -> PE-1 (Baradari) -> P Core -> PE-2 (Begum Kot) -> CE-2 -->
    <g transform="translate(24, 75)">
      <!-- Customer Edge (Site A) -->
      <g transform="translate(10, 30)">
        <rect width="110" height="70" rx="8" fill="${cardFill}" stroke="#3b82f6" stroke-width="1.8" filter="url(#l3vpnGlow)" />
        <rect width="110" height="20" rx="6" fill="#3b82f6" />
        <text x="55" y="14" font-size="10.5" font-weight="700" fill="#ffffff" text-anchor="middle">CE-Site A (Branch)</text>
        <text x="55" y="38" font-size="10" font-weight="600" fill="${textMain}" text-anchor="middle">AS ${vrf.customerAsn || 65000}</text>
        <text x="55" y="52" font-size="9" fill="${textMuted}" text-anchor="middle">IP: 10.101.1.1/24</text>
      </g>

      <!-- PE-CE Protocol Link 1 -->
      <line x1="120" y1="65" x2="180" y2="65" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="4,2" />
      <text x="150" y="56" font-size="9.5" font-weight="700" fill="#3b82f6" text-anchor="middle">${escapeHtml(d.protocolInfo.code)}</text>

      <!-- Provider Edge 1 (Ingress PE) -->
      <g transform="translate(180, 20)">
        <rect width="130" height="90" rx="8" fill="${cardFill}" stroke="#8b5cf6" stroke-width="2" filter="url(#l3vpnGlow)" />
        <rect width="130" height="22" rx="6" fill="#8b5cf6" />
        <text x="65" y="15" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">PE-1 (Baradari Hub)</text>
        <text x="10" y="38" font-size="9.5" font-weight="700" fill="#8b5cf6">VRF Table:</text>
        <text x="10" y="52" font-size="8.5" fill="${textMuted}">RD: ${escapeHtml(vrf.rd)}</text>
        <text x="10" y="66" font-size="8.5" fill="${textMuted}">RT Exp: ${escapeHtml(vrf.rtExport[0])}</text>
        <text x="10" y="80" font-size="8.5" font-weight="600" fill="#10b981">VPN Label: ${labels.vpnLabel}</text>
      </g>

      <!-- MPLS Core Pipeline (LDP / RSVP-TE / SR) -->
      <g transform="translate(310, 45)">
        <rect width="170" height="40" rx="20" fill="url(#l3vpnCoreGrad)" opacity="0.9" filter="url(#l3vpnGlow)" />
        <text x="85" y="24" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">MPLS Core (P Routers)</text>
      </g>

      <!-- Provider Edge 2 (Egress PE) -->
      <g transform="translate(480, 20)">
        <rect width="130" height="90" rx="8" fill="${cardFill}" stroke="#ec4899" stroke-width="2" filter="url(#l3vpnGlow)" />
        <rect width="130" height="22" rx="6" fill="#ec4899" />
        <text x="65" y="15" font-size="11" font-weight="700" fill="#ffffff" text-anchor="middle">PE-2 (Begum Kot)</text>
        <text x="10" y="38" font-size="9.5" font-weight="700" fill="#ec4899">VRF Table:</text>
        <text x="10" y="52" font-size="8.5" fill="${textMuted}">RD: ${escapeHtml(vrf.rd)}</text>
        <text x="10" y="66" font-size="8.5" fill="${textMuted}">RT Imp: ${escapeHtml(vrf.rtImport[0])}</text>
        <text x="10" y="80" font-size="8.5" font-weight="600" fill="#10b981">Pop &amp; Forward to CE</text>
      </g>

      <!-- PE-CE Protocol Link 2 -->
      <line x1="610" y1="65" x2="670" y2="65" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="4,2" />
      <text x="640" y="56" font-size="9.5" font-weight="700" fill="#3b82f6" text-anchor="middle">${escapeHtml(d.protocolInfo.code)}</text>

      <!-- Customer Edge (Site B) -->
      <g transform="translate(670, 30)">
        <rect width="110" height="70" rx="8" fill="${cardFill}" stroke="#3b82f6" stroke-width="1.8" filter="url(#l3vpnGlow)" />
        <rect width="110" height="20" rx="6" fill="#3b82f6" />
        <text x="55" y="14" font-size="10.5" font-weight="700" fill="#ffffff" text-anchor="middle">CE-Site B (HQ / DC)</text>
        <text x="55" y="38" font-size="10" font-weight="600" fill="${textMain}" text-anchor="middle">AS ${vrf.customerAsn || 65000}</text>
        <text x="55" y="52" font-size="9" fill="${textMuted}" text-anchor="middle">IP: 10.101.2.1/24</text>
      </g>
    </g>

    <!-- 2-Level MPLS Label Stack Graphic -->
    <g transform="translate(42, ${compact ? 195 : 210})">
      <rect width="756" height="48" rx="8" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
      <text x="16" y="28" font-size="11" font-weight="700" fill="${textMain}">MPLS Encapsulation:</text>

      <!-- L2 Eth Header -->
      <rect x="145" y="10" width="105" height="28" rx="4" fill="#64748b" />
      <text x="197" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">Eth L2 (14B)</text>

      <!-- Outer Transport Label -->
      <rect x="256" y="10" width="135" height="28" rx="4" fill="#8b5cf6" />
      <text x="323" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">Outer LDP: ${labels.transportLabel} (4B)</text>

      <!-- Inner VPN Label -->
      <rect x="397" y="10" width="145" height="28" rx="4" fill="#ec4899" />
      <text x="469" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">Inner VPN: ${labels.vpnLabel} (4B)</text>

      <!-- Customer IP Payload -->
      <rect x="548" y="10" width="125" height="28" rx="4" fill="#0ea5e9" />
      <text x="610" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">IPv4 Payload (1500B)</text>

      <!-- CRC -->
      <rect x="679" y="10" width="60" height="28" rx="4" fill="#64748b" />
      <text x="709" y="27" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">CRC (4B)</text>
    </g>

    ${!compact ? `
    <!-- Detail HUD Grid: Capacity, RT Policy, OSPF Sham-Link / Convergence -->
    <g transform="translate(42, 275)">
      <!-- Box 1: Prefix Utilization -->
      <rect width="235" height="85" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
      <text x="12" y="20" font-size="11" font-weight="700" fill="${textMuted}">PREFIX CAPACITY &amp; HEADROOM</text>
      <text x="12" y="44" font-size="18" font-weight="800" fill="${statusColor}">${cap.activePrefixes} / ${cap.maxPrefixes}</text>
      <text x="12" y="62" font-size="10" fill="${textMuted}">Remaining Headroom: <tspan font-weight="700" fill="${textMain}">${cap.headroom} prefixes</tspan></text>
      <text x="12" y="75" font-size="10" fill="${textMuted}">Policing: <tspan font-weight="700" fill="${statusColor}">Drop &amp; Log at 100%</tspan></text>

      <!-- Box 2: Route Target Filtering -->
      <g transform="translate(255, 0)">
        <rect width="245" height="85" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
        <text x="12" y="20" font-size="11" font-weight="700" fill="${textMuted}">ROUTE TARGET (RT) ISOLATION</text>
        <text x="12" y="40" font-size="10" font-weight="600" fill="${textMain}">Export: <tspan font-family="monospace">${escapeHtml(vrf.rtExport.join(', '))}</tspan></text>
        <text x="12" y="56" font-size="10" font-weight="600" fill="${textMain}">Import: <tspan font-family="monospace">${escapeHtml(vrf.rtImport.join(', '))}</tspan></text>
        <text x="12" y="74" font-size="10" font-weight="700" fill="${d.hasUnauthorizedLeak ? '#ef4444' : '#10b981'}">
          ${d.hasUnauthorizedLeak ? '⚠️ Unauthorized Leak Detected' : '✓ Strict Inter-VRF Isolation Enforced'}
        </text>
      </g>

      <!-- Box 3: PE-CE QoS & Convergence -->
      <g transform="translate(520, 0)">
        <rect width="235" height="85" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
        <text x="12" y="20" font-size="11" font-weight="700" fill="${textMuted}">PE-CE PROTOCOL &amp; CONVERGENCE</text>
        <text x="12" y="40" font-size="11" font-weight="700" fill="${textMain}">${escapeHtml(d.protocolInfo.name)}</text>
        <text x="12" y="56" font-size="10" fill="${textMuted}">Convergence Window: <tspan font-weight="700" fill="${textMain}">~${d.protocolInfo.convergenceMs} ms</tspan></text>
        <text x="12" y="74" font-size="9.5" fill="${textMuted}">QoS: <tspan font-weight="600" fill="#3b82f6">${escapeHtml(vrf.qosClass.split(' ')[0])}</tspan> (${vrf.bandwidthMbps} Mbps CIR)</text>
      </g>
    </g>
    ` : ''}
  </svg>
  `;
}

/**
 * Generates an executive Outside Plant / Carrier Core Audit Report.
 */
export function generateL3VpnReport(dynamics) {
  const d = dynamics || calculateL3VpnDynamics();
  const v = d.selectedVrf;
  const c = d.prefixCapacity;
  const l = d.labelStack;

  return `========================================================================
SHAHDARA ISP CARRIER BGP/MPLS IP VPN (L3VPN) AUDIT REPORT
Standard: RFC 4364 / RFC 4659 / RFC 4360 / RFC 4577
Date/Time (PKT): ${new Date().toISOString()}
========================================================================

1. TARGET VRF IDENTIFICATION & PARAMETERS:
------------------------------------------------------------------------
• VRF Name:             ${v.name}
• Primary Area:         ${v.primaryArea}
• Route Distinguisher:  ${v.rd} (${v.rdType})
• Route Target Export:  ${v.rtExport.join(', ')}
• Route Target Import:  ${v.rtImport.join(', ')}
• PE-CE Protocol:       ${d.protocolInfo.name}
• QoS Profile:          ${v.qosClass}
• Committed Bandwidth:  ${v.bandwidthMbps} Mbps CIR
• Customer Sites:       ${v.branchSitesCount} Active Branches / Demarcations
• Monthly VRF Revenue:  ${formatPKR(v.monthlyRevenuePkr)}

2. PREFIX CAPACITY & ROUTE POLICING:
------------------------------------------------------------------------
• Active Routes:        ${c.activePrefixes} prefixes
• Maximum Capacity:     ${c.maxPrefixes} prefixes
• Utilization:          ${c.utilizationPercent}%
• Available Headroom:   ${c.headroom} prefixes
• Capacity Status:      ${c.statusLevel.toUpperCase()}
• Policy Action:        75% Warning Log -> 90% High Alert -> 100% Session Teardown

3. MPLS 2-LEVEL FORWARDING STACK:
------------------------------------------------------------------------
• Transport Label (LDP): ${l.transportLabel} (Outer Tunnel to Egress PE)
• VPN Label (MP-BGP):   ${l.vpnLabel} (Inner Demux to VRF Table)
• MPLS Label Overhead:  ${l.totalMplsOverheadBytes} Bytes
• MTU Requirement:      ${l.requiredMtu} Bytes
• Payload Efficiency:   ${l.payloadEfficiencyPercent}%

4. SECURITY & CROSS-VRF ISOLATION STATUS:
------------------------------------------------------------------------
• Overall Status:       ${d.overallStatus}
• Inter-VRF Leakage:    ${d.hasUnauthorizedLeak ? 'DETECTED - SECURITY VULNERABILITY' : 'None (Strict Isolation Enforced)'}
• Extranet Sharing:     ${d.isExtranet ? 'Active (Controlled Extranet Leaking via target:65001:999)' : 'Disabled (Closed Enterprise Intranet)'}

5. CARRIER-WIDE ENTERPRISE L3VPN SUMMARY:
------------------------------------------------------------------------
• Total Active VRFs:    ${d.aggregates.totalVrfs}
• Total Customer Sites: ${d.aggregates.totalSubscribedSites}
• Aggregate VPN Traffic: ${d.aggregates.totalBandwidthGbps} Gbps
• Total Active Routes:  ${d.aggregates.totalActivePrefixes} / ${d.aggregates.totalMaxPrefixCapacity} (${d.aggregates.overallPrefixUtilizationPercent}%)
• Total VPN Revenue:    ${formatPKR(d.aggregates.totalMonthlyRevenue)} / month
========================================================================`;
}

/**
 * Exports L3VPN configuration and dynamics to JSON format.
 */
export function exportL3VpnJson(dynamics) {
  const d = dynamics || calculateL3VpnDynamics();
  const jsonStr = JSON.stringify(d, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-l3vpn-${d.selectedVrf.id}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports L3VPN metrics to RFC-4180 CSV format.
 */
export function exportL3VpnCsv(dynamics) {
  const d = dynamics || calculateL3VpnDynamics();
  const rows = [
    ['VRF ID', 'VRF Name', 'Primary Area', 'Route Distinguisher', 'PE-CE Protocol', 'Active Prefixes', 'Max Prefixes', 'Utilization %', 'VPN Label', 'Transport Label', 'Bandwidth Mbps', 'Sites', 'Monthly Revenue PKR', 'Status']
  ];

  SHAHDARA_L3VPN_VRFS.forEach(v => {
    const isSelected = v.id === d.selectedVrf.id;
    const active = isSelected ? d.prefixCapacity.activePrefixes : v.activePrefixes;
    const util = Math.round((active / v.maxPrefixes) * 1000) / 10;
    rows.push([
      v.id,
      `"${v.name}"`,
      v.primaryArea,
      v.rd,
      isSelected ? d.protocolInfo.code : v.peCeProtocol,
      active,
      v.maxPrefixes,
      util,
      v.vpnLabel,
      v.transportLabel,
      v.bandwidthMbps,
      v.branchSitesCount,
      v.monthlyRevenuePkr,
      isSelected ? `"${d.overallStatus}"` : '"Nominal"'
    ]);
  });

  const csvContent = rows.map(r => r.join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-l3vpn-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Helper to escape HTML characters in dynamic strings.
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
 * Wires up interactive controls inside the L3VPN modal dialog.
 */
export function setupL3VpnModal(state = {}, options = {}) {
  const modal = document.getElementById('dashboardL3VpnModal');
  if (!modal) return;

  const openBtn = document.getElementById('dashboardOpenL3VpnModalBtn');
  const closeBtn = document.getElementById('dashboardL3VpnModalCloseBtn');

  const vrfSelect = document.getElementById('l3vpnVrfSelect');
  const protoSelect = document.getElementById('l3vpnProtoSelect');
  const prefixRange = document.getElementById('l3vpnPrefixRange');
  const prefixValLabel = document.getElementById('l3vpnPrefixValLabel');
  const simLeakSelect = document.getElementById('l3vpnSimLeakSelect');
  const resetBtn = document.getElementById('l3vpnResetBtn');

  const statBandwidth = document.getElementById('l3vpnStatBandwidth');
  const statPrefixHeadroom = document.getElementById('l3vpnStatPrefixHeadroom');
  const statLabelStack = document.getElementById('l3vpnStatLabelStack');
  const statMonthlyRev = document.getElementById('l3vpnStatMonthlyRev');
  const statStatusBadge = document.getElementById('l3vpnStatStatusBadge');

  const svgContainer = document.getElementById('dashboardL3VpnModalSvgContainer');
  const copyReportBtn = document.getElementById('l3vpnCopyReportBtn');
  const exportJsonBtn = document.getElementById('l3vpnExportJsonBtn');
  const exportCsvBtn = document.getElementById('l3vpnExportCsvBtn');

  function updateUi() {
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    const dyn = calculateL3VpnDynamics(state);

    if (svgContainer) {
      svgContainer.innerHTML = renderL3VpnDiagramSvg(dyn, { isDark, compact: false });
    }

    // Update main dashboard card chart as well if present
    const cardSvgContainer = document.getElementById('dashboardL3VpnChart');
    if (cardSvgContainer) {
      cardSvgContainer.innerHTML = renderL3VpnDiagramSvg(dyn, { isDark, compact: true });
    }

    if (statBandwidth) {
      statBandwidth.textContent = `${dyn.selectedVrf.bandwidthMbps} Mbps CIR`;
    }
    if (statPrefixHeadroom) {
      statPrefixHeadroom.textContent = `${dyn.prefixCapacity.headroom} Available (${dyn.prefixCapacity.utilizationPercent}%)`;
    }
    if (statLabelStack) {
      statLabelStack.textContent = `LDP: ${dyn.labelStack.transportLabel} / VPN: ${dyn.labelStack.vpnLabel}`;
    }
    if (statMonthlyRev) {
      statMonthlyRev.textContent = formatPKR(dyn.selectedVrf.monthlyRevenuePkr);
    }
    if (statStatusBadge) {
      statStatusBadge.textContent = dyn.overallStatus;
      statStatusBadge.className = `status-badge badge-${dyn.severity}`;
    }

    if (prefixValLabel) {
      prefixValLabel.textContent = `${currentPrefixInjectionOffset >= 0 ? '+' : ''}${currentPrefixInjectionOffset} routes`;
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

  if (vrfSelect && !vrfSelect.dataset.wired) {
    vrfSelect.dataset.wired = 'true';
    vrfSelect.addEventListener('change', (e) => {
      setL3VpnSelectedVrfId(e.target.value);
      updateUi();
    });
  }

  if (protoSelect && !protoSelect.dataset.wired) {
    protoSelect.dataset.wired = 'true';
    protoSelect.addEventListener('change', (e) => {
      setL3VpnSimulatedProtocol(e.target.value === 'DEFAULT' ? null : e.target.value);
      updateUi();
    });
  }

  if (prefixRange && !prefixRange.dataset.wired) {
    prefixRange.dataset.wired = 'true';
    prefixRange.addEventListener('input', (e) => {
      setL3VpnPrefixInjectionOffset(e.target.value);
      updateUi();
    });
  }

  if (simLeakSelect && !simLeakSelect.dataset.wired) {
    simLeakSelect.dataset.wired = 'true';
    simLeakSelect.addEventListener('change', (e) => {
      setL3VpnSimulatedLeakTarget(e.target.value === 'NONE' ? null : e.target.value);
      updateUi();
    });
  }

  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = 'true';
    resetBtn.addEventListener('click', () => {
      resetL3VpnSimState();
      if (vrfSelect) vrfSelect.value = L3VPN_CONSTANTS.DEFAULT_VRF_ID;
      if (protoSelect) protoSelect.value = 'DEFAULT';
      if (prefixRange) prefixRange.value = '0';
      if (simLeakSelect) simLeakSelect.value = 'NONE';
      updateUi();
    });
  }

  if (copyReportBtn && !copyReportBtn.dataset.wired) {
    copyReportBtn.dataset.wired = 'true';
    copyReportBtn.addEventListener('click', async () => {
      const dyn = calculateL3VpnDynamics(state);
      const text = generateL3VpnReport(dyn);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          if (options.onToast) options.onToast('L3VPN Audit Report copied to clipboard!');
        } else {
          window.prompt('Copy L3VPN Audit Report:', text);
        }
      } catch (err) {
        window.prompt('Copy L3VPN Audit Report:', text);
      }
    });
  }

  if (exportJsonBtn && !exportJsonBtn.dataset.wired) {
    exportJsonBtn.dataset.wired = 'true';
    exportJsonBtn.addEventListener('click', () => {
      const dyn = calculateL3VpnDynamics(state);
      exportL3VpnJson(dyn);
    });
  }

  if (exportCsvBtn && !exportCsvBtn.dataset.wired) {
    exportCsvBtn.dataset.wired = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const dyn = calculateL3VpnDynamics(state);
      exportL3VpnCsv(dyn);
    });
  }

  // Initial render
  updateUi();
}
