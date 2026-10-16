import { formatPKR } from './core.js';

/**
 * Carrier Ethernet E-Line / E-LAN (MEF 6.2 / MEF 10.3 / MEF 23.1 Class of Service)
 * Bandwidth Profile & Color-Aware Dual-Rate Token Bucket (CIR/EIR/CBS/EBS - RFC 2698 / RFC 4115) Matrix
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, SLA Diagnostics & Carrier Telemetry
 */

export const MEF_ETHERNET_CONSTANTS = {
  DEFAULT_SERVICE_ID: 'mef-eline-nbp-bank-101',
  DEFAULT_OFFERED_RATE_MBPS: 100,
  DEFAULT_COUPLING_FLAG: false,
  DEFAULT_COLOR_AWARE: true,

  FLR_LIMIT_GREEN_PCT: 0.001,
  FLR_LIMIT_YELLOW_PCT: 1.000,
  MAX_ONE_WAY_DELAY_MS: 5.0,
  MAX_FRAME_JITTER_MS: 1.5,

  STATUS: {
    OPTIMAL: 'Optimal',
    CONGESTED: 'Congested',
    DEGRADED: 'Degraded',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_MEF_SERVICES = [
  {
    id: 'mef-eline-nbp-bank-101',
    name: 'NBP National Bank Shahdara Branch E-Line EVPL',
    serviceType: 'E-Line (EVPL Point-to-Point)',
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Ravi Siphon', 'Begum Kot'],
    cirMbps: 100,
    eirMbps: 20,
    cbsKbytes: 64,
    ebsKbytes: 32,
    baselineOfferedMbps: 95,
    cosProfile: 'High (CoS 1 - Core Banking/VoIP)',
    frameDelayMs: 3.2,
    frameJitterMs: 0.8,
    availabilitySlaPct: 99.99
  },
  {
    id: 'mef-elan-commercial-202',
    name: 'Shahdara Commercial Plaza Multi-Tenant E-LAN',
    serviceType: 'E-LAN (Multipoint-to-Multipoint)',
    primaryArea: 'Jia Musa',
    secondaryAreas: ['Shahdara Town', 'Vandala Road'],
    cirMbps: 500,
    eirMbps: 150,
    cbsKbytes: 256,
    ebsKbytes: 128,
    baselineOfferedMbps: 480,
    cosProfile: 'Medium (CoS 2 - Corporate Data/ERP)',
    frameDelayMs: 6.5,
    frameJitterMs: 1.8,
    availabilitySlaPct: 99.95
  },
  {
    id: 'mef-etree-hospital-303',
    name: 'Shahdara District Hospital Telemedicine E-Tree',
    serviceType: 'E-Tree (Rooted Multipoint)',
    primaryArea: 'Begum Kot',
    secondaryAreas: ['Baradari', 'Rachna Town'],
    cirMbps: 200,
    eirMbps: 50,
    cbsKbytes: 128,
    ebsKbytes: 64,
    baselineOfferedMbps: 185,
    cosProfile: 'High (CoS 1 - Critical PACS Imaging/Video)',
    frameDelayMs: 4.1,
    frameJitterMs: 0.9,
    availabilitySlaPct: 99.99
  },
  {
    id: 'mef-eline-cellular-404',
    name: 'Cellular 4G/5G Macro Tower Front-Haul EPL',
    serviceType: 'E-Line (EPL Dedicated Port)',
    primaryArea: 'Baradari',
    secondaryAreas: ['Kala Khatai Road', 'Kot Abdul Malik'],
    cirMbps: 1000,
    eirMbps: 250,
    cbsKbytes: 512,
    ebsKbytes: 256,
    baselineOfferedMbps: 850,
    cosProfile: 'High (CoS 1 - eCPRI/CPRI Ultra-Low Latency)',
    frameDelayMs: 2.1,
    frameJitterMs: 0.4,
    availabilitySlaPct: 99.999
  },
  {
    id: 'mef-eline-retail-burst-505',
    name: 'Kala Khatai Commercial Strip B2B Burst',
    serviceType: 'E-Line (EVPL Best Effort)',
    primaryArea: 'Kala Khatai Road',
    secondaryAreas: ['Shahdara Town'],
    cirMbps: 50,
    eirMbps: 10,
    cbsKbytes: 32,
    ebsKbytes: 16,
    baselineOfferedMbps: 75,
    cosProfile: 'Low (CoS 3 - General Internet)',
    frameDelayMs: 12.0,
    frameJitterMs: 3.5,
    availabilitySlaPct: 99.50
  }
];

/**
 * Calculates RFC 2698 / RFC 4115 two-rate three-color token bucket conditioning dynamics.
 */
export function calculateMefEthernetDynamics(params = {}) {
  const serviceId = params.serviceId || MEF_ETHERNET_CONSTANTS.DEFAULT_SERVICE_ID;
  const service = SHAHDARA_MEF_SERVICES.find(s => s.id === serviceId) || SHAHDARA_MEF_SERVICES[0];

  const cirMbps = Number.isFinite(Number(params.cirMbps)) && Number(params.cirMbps) >= 0
    ? Number(params.cirMbps)
    : service.cirMbps;
  const eirMbps = Number.isFinite(Number(params.eirMbps)) && Number(params.eirMbps) >= 0
    ? Number(params.eirMbps)
    : service.eirMbps;
  const cbsKbytes = Number.isFinite(Number(params.cbsKbytes)) && Number(params.cbsKbytes) > 0
    ? Number(params.cbsKbytes)
    : service.cbsKbytes;
  const ebsKbytes = Number.isFinite(Number(params.ebsKbytes)) && Number(params.ebsKbytes) > 0
    ? Number(params.ebsKbytes)
    : service.ebsKbytes;

  const offeredMbps = Number.isFinite(Number(params.offeredMbps)) && Number(params.offeredMbps) >= 0
    ? Number(params.offeredMbps)
    : service.baselineOfferedMbps;

  const couplingFlag = Boolean(params.couplingFlag);
  const colorAware = params.colorAware !== undefined ? Boolean(params.colorAware) : true;

  // Effective EIR with coupling flag: if CF=1 and CIR is underutilized, unused CIR capacity spills into EIR
  const unusedCirMbps = Math.max(0, cirMbps - offeredMbps);
  const effectiveEirMbps = couplingFlag ? eirMbps + unusedCirMbps : eirMbps;

  // Throughput color decomposition (RFC 2698 / RFC 4115 trTCM)
  const greenMbps = Math.min(offeredMbps, cirMbps);
  const remainingOffered = Math.max(0, offeredMbps - greenMbps);
  const yellowMbps = Math.min(remainingOffered, effectiveEirMbps);
  const redDropMbps = Math.max(0, remainingOffered - yellowMbps);

  const totalForwardedMbps = greenMbps + yellowMbps;
  const dropPct = offeredMbps > 0 ? Number(((redDropMbps / offeredMbps) * 100).toFixed(2)) : 0;
  const greenPct = offeredMbps > 0 ? Number(((greenMbps / offeredMbps) * 100).toFixed(1)) : 0;
  const yellowPct = offeredMbps > 0 ? Number(((yellowMbps / offeredMbps) * 100).toFixed(1)) : 0;
  const redPct = offeredMbps > 0 ? Number(((redDropMbps / offeredMbps) * 100).toFixed(1)) : 0;

  // Token Bucket Fill levels (steady state percentage under given offered rate)
  const cbsFillPct = cirMbps > 0 ? Math.max(0, Math.min(100, Number(((1 - (greenMbps / cirMbps)) * 100).toFixed(1)))) : 0;
  const ebsFillPct = effectiveEirMbps > 0 ? Math.max(0, Math.min(100, Number(((1 - (yellowMbps / effectiveEirMbps)) * 100).toFixed(1)))) : 0;

  // SLA Performance metrics modeling
  const baselineDelayMs = service.frameDelayMs;
  // Delay increases as policing buffer queue builds up
  const queueCongestionFactor = Math.pow(offeredMbps / Math.max(1, cirMbps + eirMbps), 2);
  const frameDelayMs = Number((baselineDelayMs * (1 + queueCongestionFactor * 0.4)).toFixed(2));
  const frameJitterMs = Number((service.frameJitterMs * (1 + queueCongestionFactor * 0.5)).toFixed(2));

  // Frame Loss Ratio for conforming traffic
  const flrPct = Number(dropPct.toFixed(3));

  // Health Status determination
  let status = MEF_ETHERNET_CONSTANTS.STATUS.OPTIMAL;
  let slaVerdict = 'SLA_COMPLIANT';
  let badgeColor = '#10b981';

  if (redDropMbps > 0) {
    if (dropPct > 20) {
      status = MEF_ETHERNET_CONSTANTS.STATUS.CRITICAL;
      slaVerdict = 'SLA_VIOLATION_RED_DROPS';
      badgeColor = '#ef4444';
    } else {
      status = MEF_ETHERNET_CONSTANTS.STATUS.DEGRADED;
      slaVerdict = 'CONGESTED_BURST_DISCARD';
      badgeColor = '#f59e0b';
    }
  } else if (yellowMbps > 0) {
    status = MEF_ETHERNET_CONSTANTS.STATUS.CONGESTED;
    slaVerdict = 'YELLOW_BEST_EFFORT_FORWARD';
    badgeColor = '#facc15';
  } else {
    status = MEF_ETHERNET_CONSTANTS.STATUS.OPTIMAL;
    slaVerdict = 'SLA_COMPLIANT_CONFORMING';
    badgeColor = '#10b981';
  }

  return {
    serviceId: service.id,
    serviceName: service.name,
    serviceType: service.serviceType,
    primaryArea: service.primaryArea,
    secondaryAreas: service.secondaryAreas,
    cosProfile: service.cosProfile,
    cirMbps,
    eirMbps,
    effectiveEirMbps,
    cbsKbytes,
    ebsKbytes,
    offeredMbps,
    couplingFlag,
    colorAware,
    greenMbps,
    yellowMbps,
    redDropMbps,
    totalForwardedMbps,
    dropPct,
    greenPct,
    yellowPct,
    redPct,
    cbsFillPct,
    ebsFillPct,
    frameDelayMs,
    frameJitterMs,
    flrPct,
    availabilitySlaPct: service.availabilitySlaPct,
    status,
    slaVerdict,
    badgeColor
  };
}

/**
 * Correlates MEF services with active customer base and financial revenue at risk.
 */
export function calculateMefEthernetMetrics(state = {}, options = {}) {
  const serviceId = options.serviceId || MEF_ETHERNET_CONSTANTS.DEFAULT_SERVICE_ID;
  const dynamics = calculateMefEthernetDynamics({
    serviceId,
    cirMbps: options.cirMbps,
    eirMbps: options.eirMbps,
    cbsKbytes: options.cbsKbytes,
    ebsKbytes: options.ebsKbytes,
    offeredMbps: options.offeredMbps,
    couplingFlag: options.couplingFlag,
    colorAware: options.colorAware
  });

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const linkedCustomers = customers.filter(c => {
    if (c.archived) return false;
    const a = c.area || '';
    return a === dynamics.primaryArea || dynamics.secondaryAreas.includes(a);
  });

  const totalDuesPkr = linkedCustomers.reduce((acc, c) => acc + (Number(c.balance) > 0 ? Number(c.balance) : 0), 0);
  const monthlyRevenuePkr = linkedCustomers.reduce((acc, c) => acc + (Number(c.packagePrice) || 0), 0);

  // Revenue at risk proportional to drop rate
  const revenueAtRiskPkr = Math.round(monthlyRevenuePkr * (dynamics.dropPct / 100));

  return {
    ...dynamics,
    linkedCustomerCount: linkedCustomers.length,
    monthlyRevenuePkr,
    totalDuesPkr,
    revenueAtRiskPkr
  };
}

/**
 * Pure-vector SVG visualizer rendering dual token buckets, ingress rate meter,
 * trTCM three-color bandwidth gauge, and telemetry HUD.
 */
export function renderMefCarrierEthernetSvg(metrics, options = {}) {
  const isCompact = Boolean(options.compact);
  const width = options.width || (isCompact ? 540 : 840);
  const height = options.height || (isCompact ? 220 : 340);

  const statusColor = metrics.badgeColor;

  if (isCompact) {
    return `
<svg class="mef-ethernet-svg mef-compact-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier Ethernet Bandwidth Profile Summary">
  <defs>
    <linearGradient id="mefCompactBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1329" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="url(#mefCompactBg)" stroke="#334155" stroke-width="1.2" />

  <text x="16" y="24" fill="#f8fafc" font-size="12" font-weight="700" font-family="system-ui, sans-serif">CARRIER ETHERNET TRTCM BANDWIDTH PROFILE</text>
  <text x="16" y="38" fill="#94a3b8" font-size="10">${metrics.serviceName.slice(0, 42)}</text>

  <!-- 3-Color Bandwidth Distribution Bar -->
  <g transform="translate(16, 52)">
    <rect x="0" y="0" width="${width - 32}" height="20" rx="4" fill="#334155" />
    <rect x="0" y="0" width="${((width - 32) * metrics.greenPct) / 100}" height="20" rx="4" fill="#10b981" />
    <rect x="${((width - 32) * metrics.greenPct) / 100}" y="0" width="${((width - 32) * metrics.yellowPct) / 100}" height="20" fill="#f59e0b" />
    <rect x="${((width - 32) * (metrics.greenPct + metrics.yellowPct)) / 100}" y="0" width="${((width - 32) * metrics.redPct) / 100}" height="20" rx="4" fill="#ef4444" />
  </g>

  <!-- KPI Badges -->
  <g transform="translate(16, 90)">
    <text x="0" y="12" fill="#94a3b8" font-size="9" font-weight="600">OFFERED</text>
    <text x="0" y="28" fill="#f8fafc" font-size="13" font-weight="700">${metrics.offeredMbps} Mbps</text>

    <text x="90" y="12" fill="#10b981" font-size="9" font-weight="600">CIR (GREEN)</text>
    <text x="90" y="28" fill="#10b981" font-size="13" font-weight="700">${metrics.greenMbps} Mbps</text>

    <text x="190" y="12" fill="#f59e0b" font-size="9" font-weight="600">EIR (YELLOW)</text>
    <text x="190" y="28" fill="#f59e0b" font-size="13" font-weight="700">${metrics.yellowMbps} Mbps</text>

    <text x="290" y="12" fill="#ef4444" font-size="9" font-weight="600">DISCARD (RED)</text>
    <text x="290" y="28" fill="#ef4444" font-size="13" font-weight="700">${metrics.redDropMbps} Mbps</text>

    <text x="390" y="12" fill="#38bdf8" font-size="9" font-weight="600">LATENCY</text>
    <text x="390" y="28" fill="#38bdf8" font-size="13" font-weight="700">${metrics.frameDelayMs} ms</text>
  </g>

  <!-- Bottom Verdict Banner -->
  <rect x="16" y="165" width="${width - 32}" height="24" rx="4" fill="${statusColor}" fill-opacity="0.15" stroke="${statusColor}" stroke-width="1.2" />
  <text x="${width / 2}" y="181" text-anchor="middle" fill="${statusColor}" font-size="11" font-weight="700">
    MEF STATUS: ${metrics.status.toUpperCase()} (${metrics.slaVerdict.replace(/_/g, ' ')})
  </text>
</svg>
    `.trim();
  }

  // Full detailed visualizer with Dual Token Buckets and Meter Schematic
  const bucketWidth = 110;
  const bucketHeight = 130;
  const tcFillY = bucketHeight * (1 - metrics.cbsFillPct / 100);
  const teFillY = bucketHeight * (1 - metrics.ebsFillPct / 100);

  return `
<svg class="mef-ethernet-svg mef-full-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MEF 10.3 Carrier Ethernet Bandwidth Profile and Token Bucket Diagram">
  <defs>
    <linearGradient id="mefFullBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090f1f" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>

    <!-- Green Token Fluid Gradient -->
    <linearGradient id="cirFluidGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>

    <!-- Yellow Token Fluid Gradient -->
    <linearGradient id="eirFluidGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>

    <filter id="mefGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#mefFullBg)" stroke="#334155" stroke-width="1.5" />

  <!-- Left Header -->
  <text x="24" y="32" fill="#f8fafc" font-size="14" font-weight="700" font-family="system-ui, sans-serif">CARRIER ETHERNET DUAL-RATE TOKEN BUCKET (MEF 10.3 / RFC 4115)</text>
  <text x="24" y="48" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">${metrics.serviceName} • CoS: ${metrics.cosProfile}</text>

  <!-- Section 1: Ingress Traffic Meter (Left) -->
  <g transform="translate(30, 80)">
    <rect x="0" y="0" width="130" height="150" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1.2" />
    <text x="65" y="22" text-anchor="middle" fill="#94a3b8" font-size="10" font-weight="700">INGRESS UNI TRAFFIC</text>

    <!-- Speedometer / Ingress Rate Dial -->
    <circle cx="65" cy="80" r="42" fill="none" stroke="#334155" stroke-width="8" stroke-dasharray="198" stroke-dashoffset="66" />
    <circle cx="65" cy="80" r="42" fill="none" stroke="${statusColor}" stroke-width="8" stroke-dasharray="198" stroke-dashoffset="${Math.max(66, 198 - (metrics.offeredMbps / Math.max(1, metrics.cirMbps + metrics.eirMbps)) * 132)}" />

    <text x="65" y="78" text-anchor="middle" fill="#f8fafc" font-size="15" font-weight="800">${metrics.offeredMbps}</text>
    <text x="65" y="92" text-anchor="middle" fill="#94a3b8" font-size="10">Mbps</text>
    <text x="65" y="116" text-anchor="middle" fill="#cbd5e1" font-size="9">Offered Rate</text>
    <text x="65" y="138" text-anchor="middle" fill="${metrics.colorAware ? '#38bdf8' : '#94a3b8'}" font-size="9" font-weight="600">
      ${metrics.colorAware ? '● Color-Aware' : '○ Color-Blind'}
    </text>
  </g>

  <!-- Flow Arrow from Meter to Buckets -->
  <path d="M 170 155 L 205 155" stroke="#64748b" stroke-width="2" marker-end="url(#arrow)" />

  <!-- Section 2: Committed Token Bucket Tc (Middle-Left) -->
  <g transform="translate(210, 80)">
    <text x="55" y="-10" text-anchor="middle" fill="#10b981" font-size="11" font-weight="700">COMMITTED BUCKET (Tc)</text>
    <rect x="0" y="0" width="${bucketWidth}" height="${bucketHeight}" rx="6" fill="#0f172a" stroke="#10b981" stroke-width="1.5" />
    <!-- Fluid Level -->
    <rect x="2" y="${tcFillY}" width="${bucketWidth - 4}" height="${bucketHeight - tcFillY - 2}" rx="4" fill="url(#cirFluidGrad)" opacity="0.85" />
    <text x="55" y="30" text-anchor="middle" fill="#f8fafc" font-size="12" font-weight="700">CIR: ${metrics.cirMbps}M</text>
    <text x="55" y="46" text-anchor="middle" fill="#cbd5e1" font-size="10">CBS: ${metrics.cbsKbytes} KB</text>
    <text x="55" y="${bucketHeight - 12}" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="800">
      ${metrics.cbsFillPct}% Full
    </text>
    <text x="55" y="${bucketHeight + 20}" text-anchor="middle" fill="#10b981" font-size="11" font-weight="700">
      ${metrics.greenMbps} Mbps Green
    </text>
  </g>

  <!-- Coupling Spillway Tube (if CF = 1) -->
  <g transform="translate(325, 120)">
    <line x1="0" y1="20" x2="35" y2="20" stroke="${metrics.couplingFlag ? '#38bdf8' : '#475569'}" stroke-width="${metrics.couplingFlag ? '3' : '1.5'}" stroke-dasharray="${metrics.couplingFlag ? 'none' : '3,3'}" />
    <text x="18" y="12" text-anchor="middle" fill="${metrics.couplingFlag ? '#38bdf8' : '#64748b'}" font-size="8" font-weight="700">
      CF=${metrics.couplingFlag ? '1 (Coupled)' : '0'}
    </text>
  </g>

  <!-- Section 3: Excess Token Bucket Te (Middle-Right) -->
  <g transform="translate(365, 80)">
    <text x="55" y="-10" text-anchor="middle" fill="#f59e0b" font-size="11" font-weight="700">EXCESS BUCKET (Te)</text>
    <rect x="0" y="0" width="${bucketWidth}" height="${bucketHeight}" rx="6" fill="#0f172a" stroke="#f59e0b" stroke-width="1.5" />
    <!-- Fluid Level -->
    <rect x="2" y="${teFillY}" width="${bucketWidth - 4}" height="${bucketHeight - teFillY - 2}" rx="4" fill="url(#eirFluidGrad)" opacity="0.85" />
    <text x="55" y="30" text-anchor="middle" fill="#f8fafc" font-size="12" font-weight="700">EIR: ${metrics.effectiveEirMbps}M</text>
    <text x="55" y="46" text-anchor="middle" fill="#cbd5e1" font-size="10">EBS: ${metrics.ebsKbytes} KB</text>
    <text x="55" y="${bucketHeight - 12}" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="800">
      ${metrics.ebsFillPct}% Full
    </text>
    <text x="55" y="${bucketHeight + 20}" text-anchor="middle" fill="#f59e0b" font-size="11" font-weight="700">
      ${metrics.yellowMbps} Mbps Yellow
    </text>
  </g>

  <!-- Section 4: Right Telemetry HUD & SLA Cards -->
  <g transform="translate(500, 65)">
    <rect x="0" y="0" width="310" height="205" rx="8" fill="#0b1329" stroke="#334155" stroke-width="1.2" />
    <text x="14" y="22" fill="#f8fafc" font-size="11" font-weight="700">MEF 23.1 COS SLA PERFORMANCE</text>

    <!-- Grid of 4 Metric Boxes -->
    <g transform="translate(14, 34)">
      <!-- Box 1: Forwarded Throughput -->
      <rect x="0" y="0" width="135" height="42" rx="4" fill="#1e293b" />
      <text x="8" y="14" fill="#94a3b8" font-size="8" font-weight="700">FORWARDED TRAFFIC</text>
      <text x="8" y="32" fill="#10b981" font-size="13" font-weight="800">${metrics.totalForwardedMbps} Mbps</text>

      <!-- Box 2: Discard Rate -->
      <rect x="145" y="0" width="135" height="42" rx="4" fill="#1e293b" />
      <text x="153" y="14" fill="#94a3b8" font-size="8" font-weight="700">DISCARDED (RED)</text>
      <text x="153" y="32" fill="${metrics.redDropMbps > 0 ? '#ef4444' : '#10b981'}" font-size="13" font-weight="800">
        ${metrics.redDropMbps} Mbps (${metrics.dropPct}%)
      </text>

      <!-- Box 3: One-Way Frame Delay -->
      <rect x="0" y="48" width="135" height="42" rx="4" fill="#1e293b" />
      <text x="8" y="62" fill="#94a3b8" font-size="8" font-weight="700">FRAME DELAY (FD)</text>
      <text x="8" y="80" fill="#38bdf8" font-size="13" font-weight="800">${metrics.frameDelayMs} ms</text>

      <!-- Box 4: Frame Jitter -->
      <rect x="145" y="48" width="135" height="42" rx="4" fill="#1e293b" />
      <text x="153" y="62" fill="#94a3b8" font-size="8" font-weight="700">JITTER (FDV)</text>
      <text x="153" y="80" fill="#a855f7" font-size="13" font-weight="800">${metrics.frameJitterMs} ms</text>
    </g>

    <!-- 3-Color Traffic Distribution Bar -->
    <g transform="translate(14, 138)">
      <text x="0" y="-4" fill="#94a3b8" font-size="8" font-weight="700">TRAFFIC PROFILE ALLOCATION</text>
      <rect x="0" y="2" width="280" height="12" rx="3" fill="#334155" />
      <rect x="0" y="2" width="${(280 * metrics.greenPct) / 100}" height="12" rx="3" fill="#10b981" />
      <rect x="${(280 * metrics.greenPct) / 100}" y="2" width="${(280 * metrics.yellowPct) / 100}" height="12" fill="#f59e0b" />
      <rect x="${(280 * (metrics.greenPct + metrics.yellowPct)) / 100}" y="2" width="${(280 * metrics.redPct) / 100}" height="12" rx="3" fill="#ef4444" />
      <text x="0" y="26" fill="#10b981" font-size="8">Green ${metrics.greenPct}%</text>
      <text x="100" y="26" fill="#f59e0b" font-size="8">Yellow ${metrics.yellowPct}%</text>
      <text x="210" y="26" fill="#ef4444" font-size="8">Red ${metrics.redPct}%</text>
    </g>
  </g>

  <!-- Bottom Full-Width Status Banner -->
  <g transform="translate(30, 285)">
    <rect x="0" y="0" width="${width - 60}" height="32" rx="6" fill="${statusColor}" fill-opacity="0.18" stroke="${statusColor}" stroke-width="1.5" />
    <text x="${(width - 60) / 2}" y="20" text-anchor="middle" fill="${statusColor}" font-size="12" font-weight="800">
      MEF CARRIER VERDICT: ${metrics.status.toUpperCase()} — ${metrics.slaVerdict.replace(/_/g, ' ')} (Availability SLA: ${metrics.availabilitySlaPct}%)
    </text>
  </g>
</svg>
  `.trim();
}

/**
 * Generates structured text report suitable for clipboard sharing and NOC briefings.
 */
export function generateMefEthernetReport(metrics, options = {}) {
  const dateStr = options.referenceDate || new Date().toISOString().slice(0, 10);

  return `
================================================================================
SHAHDARA METRO CARRIER ETHERNET BANDWIDTH PROFILE & SLA REPORT
Standards: MEF 6.2 (Services) / MEF 10.3 (Attributes) / RFC 4115 (trTCM)
Generated: ${dateStr}
================================================================================

SERVICE DETAILS:
• Service ID:         ${metrics.serviceId}
• Service Name:       ${metrics.serviceName}
• Service Type:       ${metrics.serviceType}
• Class of Service:   ${metrics.cosProfile}
• Geographic Scope:   ${metrics.primaryArea} (Secondary: ${metrics.secondaryAreas.join(', ')})

BANDWIDTH PROFILE SPECIFICATIONS:
• CIR:                       ${metrics.cirMbps} Mbps (Committed Information Rate, CBS: ${metrics.cbsKbytes} KB)
• EIR:                       ${metrics.eirMbps} Mbps (Excess Information Rate, EBS: ${metrics.ebsKbytes} KB)
• Coupling Flag (CF):        ${metrics.couplingFlag ? 'Enabled (1) - Unused CIR spills into EIR' : 'Disabled (0)'}
• Color-Aware Mode:          ${metrics.colorAware ? 'Enabled (Inspects 802.1p PCP/DEI)' : 'Disabled (Color-Blind)'}

TRAFFIC CONDITIONING & POLICING RESULTS:
• Ingress Offered Rate:      ${metrics.offeredMbps} Mbps
• Conforming (Green):        ${metrics.greenMbps} Mbps (${metrics.greenPct}%)
• Excess Forwarded (Yellow): ${metrics.yellowMbps} Mbps (${metrics.yellowPct}%)
• Violating Dropped (Red):   ${metrics.redDropMbps} Mbps (${metrics.redPct}%)
• Total Forwarded Throughput:${metrics.totalForwardedMbps} Mbps

SLA PERFORMANCE GUARANTEES:
• One-Way Frame Delay (FD):  ${metrics.frameDelayMs} ms (MEF CoS limit: $\\le 5.0$ ms)
• Frame Delay Variation(FDV):${metrics.frameJitterMs} ms (MEF CoS limit: $\\le 1.5$ ms)
• Frame Loss Ratio (FLR):    ${metrics.flrPct}% (Target: 0.000%)
• Availability Guarantee:    ${metrics.availabilitySlaPct}%
• Health Status:             ${metrics.status.toUpperCase()}
• SLA Verdict:               ${metrics.slaVerdict.replace(/_/g, ' ')}

BUSINESS & FINANCIAL EXPOSURE:
• Linked Subscribers:        ${metrics.linkedCustomerCount} accounts
• Monthly Area Revenue:      ${formatPKR(metrics.monthlyRevenuePkr)}
• Total Outstanding Dues:    ${formatPKR(metrics.totalDuesPkr)}
• Revenue at Risk:           ${formatPKR(metrics.revenueAtRiskPkr)}

ENGINEERING RECOMMENDATION:
${metrics.redDropMbps > 0
  ? `ALERT: Ingress traffic violates contracted CIR+EIR envelope by ${metrics.redDropMbps} Mbps. Recommend upgrading customer port to higher CIR tier or enabling traffic shaping queue at customer CE handoff.`
  : `OPTIMAL: Customer traffic is fully compliant with contracted bandwidth profile. Zero packet drops observed.`}
================================================================================
`.trim();
}

/**
 * Export metrics as JSON string suitable for automated NOC ingestion.
 */
export function exportMefEthernetJson(metrics, options = {}) {
  const payload = {
    standard: 'MEF 6.2 / MEF 10.3 / RFC 4115',
    timestamp: options.timestamp || new Date().toISOString(),
    service: {
      id: metrics.serviceId,
      name: metrics.serviceName,
      type: metrics.serviceType,
      cosProfile: metrics.cosProfile,
      primaryArea: metrics.primaryArea,
      secondaryAreas: metrics.secondaryAreas
    },
    bandwidthProfile: {
      cirMbps: metrics.cirMbps,
      cbsKbytes: metrics.cbsKbytes,
      eirMbps: metrics.eirMbps,
      ebsKbytes: metrics.ebsKbytes,
      couplingFlag: metrics.couplingFlag,
      colorAware: metrics.colorAware
    },
    policingResults: {
      offeredMbps: metrics.offeredMbps,
      greenMbps: metrics.greenMbps,
      greenPct: metrics.greenPct,
      yellowMbps: metrics.yellowMbps,
      yellowPct: metrics.yellowPct,
      redDropMbps: metrics.redDropMbps,
      redPct: metrics.redPct,
      totalForwardedMbps: metrics.totalForwardedMbps
    },
    slaMetrics: {
      frameDelayMs: metrics.frameDelayMs,
      frameJitterMs: metrics.frameJitterMs,
      flrPct: metrics.flrPct,
      availabilitySlaPct: metrics.availabilitySlaPct,
      status: metrics.status,
      verdict: metrics.slaVerdict
    },
    financialExposure: {
      linkedCustomers: metrics.linkedCustomerCount,
      monthlyRevenuePkr: metrics.monthlyRevenuePkr,
      totalDuesPkr: metrics.totalDuesPkr,
      revenueAtRiskPkr: metrics.revenueAtRiskPkr
    }
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Export metrics as CSV rows for spreadsheet analysis.
 */
export function exportMefEthernetCsv(metrics) {
  const headers = [
    'Service_ID',
    'Service_Name',
    'Service_Type',
    'CoS_Profile',
    'CIR_Mbps',
    'CBS_KB',
    'EIR_Mbps',
    'EBS_KB',
    'Offered_Mbps',
    'Green_Mbps',
    'Yellow_Mbps',
    'Red_Drop_Mbps',
    'Delay_ms',
    'Jitter_ms',
    'Availability_Pct',
    'Verdict',
    'Revenue_Risk_PKR'
  ];
  const row = [
    `"${metrics.serviceId}"`,
    `"${metrics.serviceName.replace(/"/g, '""')}"`,
    `"${metrics.serviceType}"`,
    `"${metrics.cosProfile}"`,
    metrics.cirMbps,
    metrics.cbsKbytes,
    metrics.eirMbps,
    metrics.ebsKbytes,
    metrics.offeredMbps,
    metrics.greenMbps,
    metrics.yellowMbps,
    metrics.redDropMbps,
    metrics.frameDelayMs,
    metrics.frameJitterMs,
    metrics.availabilitySlaPct,
    `"${metrics.slaVerdict}"`,
    metrics.revenueAtRiskPkr
  ];
  return `${headers.join(',')}\r\n${row.join(',')}`;
}

/**
 * Controller to wire and manage the Carrier Ethernet MEF modal dialog.
 */
export function setupMefEthernetModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const onToast = options.onToast || ((msg) => console.log(msg));

  if (!doc) return null;

  const modal = doc.getElementById('dashboardMefEthernetModal');
  const closeBtn = doc.getElementById('dashboardMefEthernetModalCloseBtn');
  const serviceSelect = doc.getElementById('mefEthernetServiceSelect');
  const offeredSlider = doc.getElementById('mefEthernetOfferedSlider');
  const offeredLabel = doc.getElementById('mefEthernetOfferedLabel');
  const cirInput = doc.getElementById('mefEthernetCirInput');
  const eirInput = doc.getElementById('mefEthernetEirInput');
  const cbsInput = doc.getElementById('mefEthernetCbsInput');
  const ebsInput = doc.getElementById('mefEthernetEbsInput');
  const couplingCheck = doc.getElementById('mefEthernetCouplingCheck');
  const colorModeSelect = doc.getElementById('mefEthernetColorModeSelect');
  const resetBtn = doc.getElementById('mefEthernetResetBtn');

  const statCir = doc.getElementById('mefEthernetStatCir');
  const statConforming = doc.getElementById('mefEthernetStatConforming');
  const statYellow = doc.getElementById('mefEthernetStatYellow');
  const statRedDrop = doc.getElementById('mefEthernetStatRedDrop');
  const statCompliance = doc.getElementById('mefEthernetStatCompliance');
  const statRevenue = doc.getElementById('mefEthernetStatRevenue');

  const diagramContainer = doc.getElementById('mefEthernetModalDiagramContainer');
  const filterAreaBtn = doc.getElementById('mefEthernetFilterAreaBtn');
  const copyReportBtn = doc.getElementById('mefEthernetCopyReportBtn');

  function getSimulationParams() {
    return {
      serviceId: serviceSelect?.value || MEF_ETHERNET_CONSTANTS.DEFAULT_SERVICE_ID,
      offeredMbps: Number(offeredSlider?.value) || 100,
      cirMbps: Number(cirInput?.value) || 100,
      eirMbps: Number(eirInput?.value) || 20,
      cbsKbytes: Number(cbsInput?.value) || 64,
      ebsKbytes: Number(ebsInput?.value) || 32,
      couplingFlag: Boolean(couplingCheck?.checked),
      colorAware: colorModeSelect?.value !== 'color-blind'
    };
  }

  function recalculate() {
    const params = getSimulationParams();
    const metrics = calculateMefEthernetMetrics(state, params);

    if (offeredLabel) {
      offeredLabel.textContent = `${metrics.offeredMbps} Mbps`;
    }

    if (statCir) {
      statCir.textContent = `${metrics.cirMbps} Mbps`;
    }
    if (statConforming) {
      statConforming.textContent = `${metrics.greenMbps} Mbps (${metrics.greenPct}%)`;
    }
    if (statYellow) {
      statYellow.textContent = `${metrics.yellowMbps} Mbps (${metrics.yellowPct}%)`;
    }
    if (statRedDrop) {
      statRedDrop.textContent = `${metrics.redDropMbps} Mbps (${metrics.dropPct}%)`;
      statRedDrop.style.color = metrics.redDropMbps > 0 ? '#ef4444' : '#10b981';
    }
    if (statCompliance) {
      statCompliance.textContent = metrics.status.toUpperCase();
      statCompliance.style.color = metrics.badgeColor;
    }
    if (statRevenue) {
      statRevenue.textContent = formatPKR(metrics.revenueAtRiskPkr);
      statRevenue.style.color = metrics.revenueAtRiskPkr > 0 ? '#ef4444' : '#10b981';
    }

    if (diagramContainer) {
      diagramContainer.innerHTML = renderMefCarrierEthernetSvg(metrics, { compact: false });
    }

    return metrics;
  }

  function loadService(serviceId) {
    const s = SHAHDARA_MEF_SERVICES.find(item => item.id === serviceId) || SHAHDARA_MEF_SERVICES[0];
    if (cirInput) cirInput.value = s.cirMbps;
    if (eirInput) eirInput.value = s.eirMbps;
    if (cbsInput) cbsInput.value = s.cbsKbytes;
    if (ebsInput) ebsInput.value = s.ebsKbytes;
    if (offeredSlider) {
      offeredSlider.max = Math.max(1500, (s.cirMbps + s.eirMbps) * 2);
      offeredSlider.value = s.baselineOfferedMbps;
    }
    if (couplingCheck) couplingCheck.checked = false;
    if (colorModeSelect) colorModeSelect.value = 'color-aware';

    recalculate();
  }

  // Listeners
  const openBtn = doc.getElementById('dashboardOpenMefEthernetModalBtn');
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

  if (serviceSelect) {
    serviceSelect.addEventListener('change', () => {
      loadService(serviceSelect.value);
    });
  }

  [offeredSlider, cirInput, eirInput, cbsInput, ebsInput, couplingCheck, colorModeSelect].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', recalculate);
      inp.addEventListener('change', recalculate);
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const currentServiceId = serviceSelect?.value || MEF_ETHERNET_CONSTANTS.DEFAULT_SERVICE_ID;
      loadService(currentServiceId);
      onToast('Carrier Ethernet parameters reset to default baseline.');
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const params = getSimulationParams();
      const metrics = calculateMefEthernetMetrics(state, params);
      const text = generateMefEthernetReport(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          onToast('MEF Carrier Ethernet SLA Report copied to clipboard!');
        }).catch(() => {
          onToast('Failed to copy report to clipboard.');
        });
      } else {
        onToast('Clipboard API not available.');
      }
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const params = getSimulationParams();
      const s = SHAHDARA_MEF_SERVICES.find(item => item.id === params.serviceId) || SHAHDARA_MEF_SERVICES[0];
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(s.primaryArea);
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
    loadService
  };
}
