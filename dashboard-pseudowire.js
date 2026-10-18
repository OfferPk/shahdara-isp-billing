import { formatPKR } from './core.js';

/**
 * Carrier MPLS Pseudowire (PW / VPWS - RFC 4447 / RFC 3985 / RFC 4664) Matrix
 * Control Word (CW), 16-Bit Sequence Numbering, Playout Buffer & Jitter Emulation
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Encapsulation Stack & SLA Telemetry
 */

export const PSEUDOWIRE_CONSTANTS = {
  DEFAULT_SERVICE_ID: 'nbp-bank-vpws',
  DEFAULT_BUFFER_DEPTH_MS: 5.0,
  DEFAULT_CONTROL_WORD: true,
  MPLS_LABEL_SIZE_BYTES: 4,
  CONTROL_WORD_SIZE_BYTES: 4,
  ETHERNET_HEADER_SIZE_BYTES: 14,

  STATUS: {
    OPTIMAL: 'Optimal',
    ACCEPTABLE: 'Acceptable',
    DEGRADED: 'Degraded',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_PSEUDOWIRE_SERVICES = [
  {
    id: 'nbp-bank-vpws',
    name: 'NBP National Bank Shahdara Branch ATM/Core Banking EoMPLS VPWS',
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Baradari', 'Begum Kot'],
    pwId: 1001,
    psnTunnelLabel: 24012,
    vcLabel: 10084,
    controlWordEnabled: true,
    ingressPe: 'PE-01-Baradari',
    egressPe: 'PE-02-TownCenter',
    bandwidthMbps: 100,
    spanKm: 7.8,
    baselineJitterMs: 1.2,
    baselineReorderPct: 0.05,
    cosClass: 'CoS 1 (Strict In-Order / Banking)',
    monthlyRevenuePkr: 380000,
    subscribersCount: 75
  },
  {
    id: 'hospital-telemed-vpws',
    name: 'District Hospital ICU High-Definition Telemetry VPWS',
    primaryArea: 'Begum Kot',
    secondaryAreas: ['Shahdara Town', 'Baradari'],
    pwId: 2002,
    psnTunnelLabel: 24045,
    vcLabel: 10120,
    controlWordEnabled: true,
    ingressPe: 'PE-03-BegumKot',
    egressPe: 'PE-01-Baradari',
    bandwidthMbps: 250,
    spanKm: 6.4,
    baselineJitterMs: 1.5,
    baselineReorderPct: 0.02,
    cosClass: 'CoS 1 (Medical Video / Low Latency)',
    monthlyRevenuePkr: 550000,
    subscribersCount: 110
  },
  {
    id: 'cellular-cpri-vpws',
    name: '5G Macro Tower CPRI/eCPRI Front-Haul Transport VPWS',
    primaryArea: 'Baradari',
    secondaryAreas: ['Kala Khatai Road'],
    pwId: 3003,
    psnTunnelLabel: 32001,
    vcLabel: 10250,
    controlWordEnabled: false, // Fast cut-through without sequence check
    ingressPe: 'PE-01-Baradari',
    egressPe: 'PE-04-KalaKhatai',
    bandwidthMbps: 1000,
    spanKm: 11.2,
    baselineJitterMs: 0.8,
    baselineReorderPct: 0.00,
    cosClass: 'CoS 1 (Ultra-Low Latency CPRI)',
    monthlyRevenuePkr: 980000,
    subscribersCount: 240
  },
  {
    id: 'commercial-b2b-vpws',
    name: 'Jia Musa Commercial Plaza Corporate Multipoint Backhaul VPWS',
    primaryArea: 'Jia Musa',
    secondaryAreas: ['Vandala Road'],
    pwId: 4004,
    psnTunnelLabel: 28014,
    vcLabel: 10380,
    controlWordEnabled: true,
    ingressPe: 'PE-05-JiaMusa',
    egressPe: 'PE-06-Vandala',
    bandwidthMbps: 500,
    spanKm: 5.1,
    baselineJitterMs: 2.4,
    baselineReorderPct: 0.12,
    cosClass: 'CoS 2 (Corporate VPN / ERP)',
    monthlyRevenuePkr: 720000,
    subscribersCount: 180
  },
  {
    id: 'siphon-transit-vpws',
    name: 'Ravi Siphon River Crossing Fiber Trunk Transit VPWS',
    primaryArea: 'Ravi Siphon',
    secondaryAreas: ['Shahdara Town', 'Baradari'],
    pwId: 5005,
    psnTunnelLabel: 34100,
    vcLabel: 10512,
    controlWordEnabled: true,
    ingressPe: 'PE-07-SiphonNorth',
    egressPe: 'PE-08-SiphonSouth',
    bandwidthMbps: 1000,
    spanKm: 9.6,
    baselineJitterMs: 1.8,
    baselineReorderPct: 0.08,
    cosClass: 'CoS 2 (Metro Core Transit)',
    monthlyRevenuePkr: 1250000,
    subscribersCount: 310
  }
];

/**
 * Calculates MPLS Pseudowire encapsulation, jitter buffer playout, sequence reordering, and SLA compliance
 * @param {Object} serviceConfig - Pseudowire definition
 * @param {Object} options - Simulation inputs (injectedJitterMs, bufferDepthMs, controlWordEnabled)
 * @returns {Object} Calculated dynamics
 */
export function calculatePseudowireDynamics(serviceConfig, options = {}) {
  const s = serviceConfig || SHAHDARA_PSEUDOWIRE_SERVICES[0];

  const controlWordEnabled = typeof options.controlWordEnabled === 'boolean'
    ? options.controlWordEnabled
    : (typeof s.controlWordEnabled === 'boolean' ? s.controlWordEnabled : PSEUDOWIRE_CONSTANTS.DEFAULT_CONTROL_WORD);

  const injectedJitterMs = typeof options.injectedJitterMs === 'number'
    ? Math.max(0.1, options.injectedJitterMs)
    : s.baselineJitterMs;

  const bufferDepthMs = typeof options.bufferDepthMs === 'number'
    ? Math.max(1.0, Math.min(30.0, options.bufferDepthMs))
    : PSEUDOWIRE_CONSTANTS.DEFAULT_BUFFER_DEPTH_MS;

  // 1. Encapsulation Overhead Stack Breakdown
  // Ethernet Payload + [Optional CW: 4B] + Inner VC Label (4B) + Outer PSN Tunnel Label (4B) + Outer Eth (14B)
  const psnLabelBytes = PSEUDOWIRE_CONSTANTS.MPLS_LABEL_SIZE_BYTES;
  const vcLabelBytes = PSEUDOWIRE_CONSTANTS.MPLS_LABEL_SIZE_BYTES;
  const controlWordBytes = controlWordEnabled ? PSEUDOWIRE_CONSTANTS.CONTROL_WORD_SIZE_BYTES : 0;
  const transportEthBytes = PSEUDOWIRE_CONSTANTS.ETHERNET_HEADER_SIZE_BYTES;

  const totalMplsOverheadBytes = psnLabelBytes + vcLabelBytes + controlWordBytes;
  const totalEncapsulationBytes = totalMplsOverheadBytes + transportEthBytes;

  // Overhead percentage for a standard 1500-byte MTU frame and 64-byte minimum frame
  const overheadPctMtu1500 = +((totalEncapsulationBytes / 1500) * 100).toFixed(2);
  const overheadPctMin64 = +((totalEncapsulationBytes / 64) * 100).toFixed(2);

  // 2. Out-of-Order Packet Delivery & Sequence Reordering
  // Without CW, out-of-order packets cause TCP segment drops or VoIP glitching
  let reorderedPacketsPct = +(s.baselineReorderPct * (1 + injectedJitterMs * 0.4)).toFixed(3);
  let droppedOutOfOrderPct = 0;
  let reorderRecoverySuccessPct = 100;

  if (controlWordEnabled) {
    // Control Word contains 16-bit sequence number: reordering buffer sorts packets
    if (injectedJitterMs > bufferDepthMs) {
      // Jitter exceeds buffer depth -> late arrivals dropped as under-run
      const excessJitterRatio = (injectedJitterMs - bufferDepthMs) / injectedJitterMs;
      droppedOutOfOrderPct = +(reorderedPacketsPct * excessJitterRatio * 0.75).toFixed(3);
      reorderRecoverySuccessPct = +(100 - (droppedOutOfOrderPct / reorderedPacketsPct) * 100).toFixed(1);
    } else {
      droppedOutOfOrderPct = 0;
      reorderRecoverySuccessPct = 100;
    }
  } else {
    // Without Control Word: all reordered packets are delivered out-of-order directly to CE
    droppedOutOfOrderPct = reorderedPacketsPct;
    reorderRecoverySuccessPct = 0;
  }

  // 3. Playout Buffer Dynamics
  // Under-run (starvation when delay spikes) and Over-run (overflow when burst exceeds buffer)
  const bufferMarginMs = +(bufferDepthMs - injectedJitterMs).toFixed(2);
  let underRunRatePct = 0;
  let overRunRatePct = 0;

  if (bufferMarginMs < 0) {
    underRunRatePct = +(Math.abs(bufferMarginMs) * 0.45).toFixed(2);
  }
  if (bufferDepthMs < 2.0 && injectedJitterMs > 1.5) {
    overRunRatePct = 0.85;
  }

  // Recommended optimal playout buffer size
  const recommendedBufferDepthMs = +(injectedJitterMs * 1.6 + 1.0).toFixed(1);

  // 4. Overall Quality Verdict & Financial Exposure
  let status = PSEUDOWIRE_CONSTANTS.STATUS.OPTIMAL;
  let statusColor = '#10b981';

  if (droppedOutOfOrderPct > 1.0 || underRunRatePct > 2.0) {
    status = PSEUDOWIRE_CONSTANTS.STATUS.CRITICAL;
    statusColor = '#ef4444';
  } else if (droppedOutOfOrderPct > 0.1 || underRunRatePct > 0.5 || !controlWordEnabled && reorderedPacketsPct > 0.2) {
    status = PSEUDOWIRE_CONSTANTS.STATUS.DEGRADED;
    statusColor = '#f59e0b';
  } else if (bufferMarginMs < 0.5) {
    status = PSEUDOWIRE_CONSTANTS.STATUS.ACCEPTABLE;
    statusColor = '#3b82f6';
  }

  let penaltyRebatePct = 0;
  if (status === PSEUDOWIRE_CONSTANTS.STATUS.CRITICAL) penaltyRebatePct = 20;
  else if (status === PSEUDOWIRE_CONSTANTS.STATUS.DEGRADED) penaltyRebatePct = 10;
  const penaltyPkr = Math.round((s.monthlyRevenuePkr * penaltyRebatePct) / 100);

  return {
    service: s,
    controlWordEnabled,
    injectedJitterMs,
    bufferDepthMs,
    bufferMarginMs,
    recommendedBufferDepthMs,

    // Encapsulation Stack
    stack: {
      psnLabel: s.psnTunnelLabel,
      vcLabel: s.vcLabel,
      hasControlWord: controlWordEnabled,
      psnBytes: psnLabelBytes,
      vcBytes: vcLabelBytes,
      cwBytes: controlWordBytes,
      transportEthBytes,
      totalMplsOverheadBytes,
      totalEncapsulationBytes,
      overheadPctMtu1500,
      overheadPctMin64
    },

    // Reordering & Jitter Telemetry
    telemetry: {
      reorderedPacketsPct,
      droppedOutOfOrderPct,
      reorderRecoverySuccessPct,
      underRunRatePct,
      overRunRatePct
    },

    // Quality Verdict & Impact
    status,
    statusColor,
    penaltyRebatePct,
    penaltyPkr,
    monthlyRevenuePkr: s.monthlyRevenuePkr,
    subscribersCount: s.subscribersCount
  };
}

/**
 * Calculates aggregated Pseudowire metrics across all configured services or selected service
 * @param {Object} state - Application state
 * @param {Object} params - Simulation parameters
 * @returns {Object} Aggregated metrics
 */
export function calculatePseudowireMetrics(state, params = {}) {
  const selectedServiceId = params.serviceId || PSEUDOWIRE_CONSTANTS.DEFAULT_SERVICE_ID;
  const service = SHAHDARA_PSEUDOWIRE_SERVICES.find(s => s.id === selectedServiceId) || SHAHDARA_PSEUDOWIRE_SERVICES[0];

  const dynamics = calculatePseudowireDynamics(service, params);

  const totalServices = SHAHDARA_PSEUDOWIRE_SERVICES.length;
  const totalBandwidthMbps = SHAHDARA_PSEUDOWIRE_SERVICES.reduce((sum, s) => sum + s.bandwidthMbps, 0);
  const totalSubscribers = SHAHDARA_PSEUDOWIRE_SERVICES.reduce((sum, s) => sum + s.subscribersCount, 0);
  const totalRevenuePkr = SHAHDARA_PSEUDOWIRE_SERVICES.reduce((sum, s) => sum + s.monthlyRevenuePkr, 0);

  // Correlate with active customer roster
  let actualCustomersInArea = 0;
  if (state && Array.isArray(state.customers)) {
    const primary = service.primaryArea.toLowerCase();
    const secondaries = (service.secondaryAreas || []).map(a => a.toLowerCase());
    actualCustomersInArea = state.customers.filter(c => {
      if (c.archived) return false;
      const area = (c.area || '').toLowerCase();
      return area === primary || secondaries.includes(area);
    }).length;
  }

  return {
    selectedServiceId,
    service,
    dynamics,
    totalServices,
    totalBandwidthMbps,
    totalSubscribers,
    totalRevenuePkr,
    actualCustomersInArea
  };
}

/**
 * Pure-vector SVG visualizer for MPLS Pseudowire Header Encapsulation & Jitter Playout Buffer
 * @param {Object} dynamics - Output of calculatePseudowireDynamics
 * @param {Object} options - Visual customization options
 * @returns {string} Pure SVG string
 */
export function renderPseudowireDiagramSvg(dynamics, options = {}) {
  const {
    service,
    controlWordEnabled,
    injectedJitterMs,
    bufferDepthMs,
    bufferMarginMs,
    recommendedBufferDepthMs,
    stack,
    telemetry,
    status,
    statusColor
  } = dynamics;

  const width = options.width || 760;
  const height = options.height || 420;
  const isDark = options.isDarkMode !== false;

  // Theme Colors
  const bg = isDark ? '#0f172a' : '#f8fafc';
  const surface = isDark ? '#1e293b' : '#ffffff';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? '#334155' : '#e2e8f0';

  const blueCol = '#3b82f6';
  const purpleCol = '#8b5cf6';
  const cyanCol = '#06b6d4';
  const emeraldCol = '#10b981';
  const amberCol = '#f59e0b';
  const goldCol = '#fbbf24';
  const redCol = '#ef4444';

  // Left Panel Coordinates (Encapsulation Stack)
  const leftX = 20;
  const leftY = 20;
  const leftW = 440;
  const leftH = 375;

  // Right Panel Coordinates (Jitter Buffer Telemetry)
  const rightX = 480;
  const rightY = 20;
  const rightW = 255;
  const rightH = 375;

  // Encapsulation Stack Block Dimensions
  const stackX = 45;
  const stackY = 100;
  const stackW = 390;
  const blockH = 42;

  // Playout Buffer Bar Scale (0 to 20ms)
  const maxScaleMs = 20.0;
  const barW = 225;
  const bufferBarW = Math.min(barW, Math.max(4, +((bufferDepthMs / maxScaleMs) * barW).toFixed(1)));
  const jitterMarkerX = rightX + 15 + Math.min(barW, +((injectedJitterMs / maxScaleMs) * barW).toFixed(1));

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="pseudowire-svg" role="img" aria-label="Carrier MPLS Pseudowire Encapsulation and Playout Buffer Diagram">
      <defs>
        <linearGradient id="pwGradSurface" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${surface}" />
          <stop offset="100%" stop-color="${surface}" stop-opacity="0.85" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" rx="10" fill="${bg}" />

      <!-- Left Encapsulation Panel -->
      <rect x="${leftX}" y="${leftY}" width="${leftW}" height="${leftH}" rx="8" fill="url(#pwGradSurface)" stroke="${borderCol}" stroke-width="1" />
      <text x="35" y="44" font-size="12" font-weight="700" fill="${textMain}">${service.name}</text>
      <text x="35" y="60" font-size="9" fill="${textMuted}">VC-ID ${service.pwId} • ${service.ingressPe} → ${service.egressPe} • ${service.bandwidthMbps} Mbps • ${dynamics.subscribersCount} Subs</text>

      <!-- Header Encapsulation Stack Visual (Top to Bottom: Outer to Inner) -->
      <g transform="translate(${stackX}, ${stackY})">
        <!-- 1. Outer Transport Ethernet Header (14 Bytes) -->
        <rect x="0" y="0" width="${stackW}" height="${blockH}" rx="4" fill="${blueCol}" opacity="0.9" />
        <text x="12" y="24" font-size="9.5" font-weight="800" fill="#ffffff">Outer 802.3 Transport Eth Header (14B)</text>
        <text x="${stackW - 12}" y="24" font-size="8.5" fill="#ffffff" text-anchor="end">DMAC / SMAC / EtherType 0x8847</text>

        <!-- 2. Outer PSN Tunnel Label (4 Bytes) -->
        <rect x="15" y="48" width="${stackW - 15}" height="${blockH}" rx="4" fill="${purpleCol}" opacity="0.9" />
        <text x="27" y="72" font-size="9.5" font-weight="800" fill="#ffffff">Outer PSN MPLS Transport Label (4B)</text>
        <text x="${stackW - 12}" y="72" font-size="8.5" fill="#ffffff" text-anchor="end">Label: ${stack.psnLabel} • Exp: 5 • S: 0 • TTL: 64</text>

        <!-- 3. Inner Pseudowire VC Label (4 Bytes) -->
        <rect x="30" y="96" width="${stackW - 30}" height="${blockH}" rx="4" fill="${cyanCol}" opacity="0.9" />
        <text x="42" y="120" font-size="9.5" font-weight="800" fill="#ffffff">Inner Pseudowire VC Label (4B)</text>
        <text x="${stackW - 12}" y="120" font-size="8.5" fill="#ffffff" text-anchor="end">Label: ${stack.vcLabel} • Exp: 5 • S: 1 • TTL: 64</text>

        <!-- 4. Pseudowire Control Word (4 Bytes, Optional) -->
        ${controlWordEnabled
          ? `<rect x="45" y="144" width="${stackW - 45}" height="${blockH}" rx="4" fill="${goldCol}" opacity="0.95" />
             <text x="57" y="168" font-size="9.5" font-weight="800" fill="#182e2a">Pseudowire Control Word (CW - 4B)</text>
             <text x="${stackW - 12}" y="168" font-size="8.5" font-weight="700" fill="#182e2a" text-anchor="end">Flags: 0000 • Len: 0 • 16-Bit Seq: Active</text>`
          : `<rect x="45" y="144" width="${stackW - 45}" height="${blockH}" rx="4" fill="${surface}" stroke="${borderCol}" stroke-dasharray="4,2" />
             <text x="57" y="168" font-size="9" font-weight="700" fill="${textMuted}">Control Word (CW) Disabled (Raw Mode)</text>
             <text x="${stackW - 12}" y="168" font-size="8" fill="${redCol}" text-anchor="end">No Sequence Sorting</text>`
        }

        <!-- 5. Customer Layer 2 Ethernet Frame Payload -->
        <rect x="60" y="192" width="${stackW - 60}" height="${blockH}" rx="4" fill="${emeraldCol}" opacity="0.9" />
        <text x="72" y="216" font-size="9.5" font-weight="800" fill="#ffffff">Customer L2 Ethernet Payload (64 - 1500B)</text>
        <text x="${stackW - 12}" y="216" font-size="8.5" fill="#ffffff" text-anchor="end">Customer Banking / Telemedicine Frames</text>
      </g>

      <!-- Bottom Overhead Callout -->
      <g transform="translate(35, 360)">
        <text x="0" y="0" font-size="9" fill="${textMuted}">Total Encapsulation Overhead:</text>
        <text x="145" y="0" font-size="10" font-weight="800" fill="${textMain}">${stack.totalEncapsulationBytes} Bytes (+${stack.overheadPctMtu1500}% on 1500B MTU)</text>
        <text x="330" y="0" font-size="9" fill="${controlWordEnabled ? emeraldCol : redCol}" font-weight="700">${controlWordEnabled ? 'CW Protected' : 'Raw Mode'}</text>
      </g>

      <!-- Right Panel: Jitter Buffer & Telemetry -->
      <rect x="${rightX}" y="${rightY}" width="${rightW}" height="${rightH}" rx="8" fill="url(#pwGradSurface)" stroke="${borderCol}" stroke-width="1" />
      <text x="${rightX + 15}" y="${rightY + 24}" font-size="12" font-weight="700" fill="${textMain}">Playout Buffer &amp; Jitter</text>
      <text x="${rightX + 15}" y="${rightY + 40}" font-size="9" fill="${textMuted}">RFC 3985 / 4447 Sequence Telemetry</text>

      <!-- Quality Status Pill -->
      <g transform="translate(${rightX + 15}, ${rightY + 52})">
        <rect x="0" y="0" width="108" height="42" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <text x="8" y="14" font-size="8" fill="${textMuted}">Circuit Status</text>
        <text x="8" y="31" font-size="10" font-weight="800" fill="${statusColor}">${status}</text>

        <rect x="117" y="0" width="108" height="42" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <text x="125" y="14" font-size="8" fill="${textMuted}">Buffer Margin</text>
        <text x="125" y="31" font-size="10" font-weight="800" fill="${bufferMarginMs >= 0 ? emeraldCol : redCol}">${bufferMarginMs > 0 ? '+' : ''}${bufferMarginMs} ms</text>
      </g>

      <!-- Playout Buffer Depth Gauge -->
      <g transform="translate(${rightX + 15}, ${rightY + 115})">
        <text x="0" y="0" font-size="9.5" font-weight="700" fill="${textMain}">Playout Buffer Depth (${bufferDepthMs} ms)</text>
        <rect x="0" y="10" width="${barW}" height="16" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <rect x="0" y="10" width="${bufferBarW}" height="16" rx="4" fill="${cyanCol}" />

        <!-- Jitter Position Marker -->
        <line x1="${(injectedJitterMs / maxScaleMs) * barW}" y1="5" x2="${(injectedJitterMs / maxScaleMs) * barW}" y2="31" stroke="${redCol}" stroke-width="2" stroke-dasharray="3,2" />
        <text x="${(injectedJitterMs / maxScaleMs) * barW}" y="42" font-size="7.5" font-weight="700" fill="${redCol}" text-anchor="middle">Jitter (${injectedJitterMs}ms)</text>
      </g>

      <!-- Reordering Telemetry List -->
      <g transform="translate(${rightX + 15}, ${rightY + 185})" font-size="8.5">
        <text x="0" y="0" font-weight="700" fill="${textMain}">Out-of-Order Packets:</text>
        <text x="${barW}" y="0" font-weight="700" fill="${telemetry.reorderedPacketsPct > 0.1 ? amberCol : emeraldCol}" text-anchor="end">${telemetry.reorderedPacketsPct}%</text>

        <text x="0" y="20" fill="${textMain}">Dropped Out-of-Order:</text>
        <text x="${barW}" y="20" font-weight="700" fill="${telemetry.droppedOutOfOrderPct > 0 ? redCol : emeraldCol}" text-anchor="end">${telemetry.droppedOutOfOrderPct}%</text>

        <text x="0" y="40" fill="${textMain}">Sequence Recovery Rate:</text>
        <text x="${barW}" y="40" font-weight="700" fill="${emeraldCol}" text-anchor="end">${telemetry.reorderRecoverySuccessPct}%</text>

        <text x="0" y="60" fill="${textMain}">Under-run Starvation:</text>
        <text x="${barW}" y="60" fill="${textMuted}" text-anchor="end">${telemetry.underRunRatePct}%</text>

        <text x="0" y="80" fill="${textMain}">Recommended Buffer:</text>
        <text x="${barW}" y="80" font-weight="700" fill="${goldCol}" text-anchor="end">${recommendedBufferDepthMs} ms</text>
      </g>

      <!-- Financial Exposure Box -->
      <g transform="translate(${rightX + 15}, 325)">
        <rect x="0" y="0" width="${barW}" height="55" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <text x="10" y="16" font-size="8" fill="${textMuted}">SLA Penalty Exposure</text>
        <text x="10" y="34" font-size="11" font-weight="800" fill="${dynamics.penaltyRebatePct > 0 ? redCol : emeraldCol}">${dynamics.penaltyRebatePct}% (PKR ${dynamics.penaltyPkr.toLocaleString()})</text>
        <text x="10" y="48" font-size="7.5" fill="${textMuted}">Protected MRR: ${formatPKR(service.monthlyRevenuePkr)}</text>
      </g>
    </svg>
  `;
}

/**
 * Generates formal text report for Carrier MPLS Pseudowire audit
 * @param {Object} metrics - Output of calculatePseudowireMetrics or calculatePseudowireDynamics
 * @returns {string} Formatted audit report text
 */
export function generatePseudowireReport(metrics) {
  const d = metrics.dynamics || metrics;
  const s = d.service;
  const stk = d.stack;
  const tel = d.telemetry;

  return `========================================================================
SHAHDARA ISP CARRIER MPLS PSEUDOWIRE (VPWS) AUDIT REPORT (RFC 4447 / 3985)
========================================================================
Generated: ${new Date().toISOString()}
Standards: RFC 3985 (PWE3 Architecture), RFC 4447 (PW Setup via LDP), RFC 4664

1. PSEUDOWIRE CIRCUIT DEFINITIONS
------------------------------------------------------------------------
Service Name:         ${s.name}
Pseudowire ID (PW-ID):${s.pwId}
Coverage Area:        ${s.primaryArea} (${(s.secondaryAreas || []).join(', ')})
Ingress PE:           ${s.ingressPe}
Egress PE:            ${s.egressPe}
Committed Bandwidth:  ${s.bandwidthMbps} Mbps
Span Fiber Distance:  ${s.spanKm} km
Class of Service:     ${s.cosClass}
Linked Subscribers:   ${d.subscribersCount} Customers
Monthly Revenue:      PKR ${s.monthlyRevenuePkr.toLocaleString()}

2. MPLS HEADER ENCAPSULATION STACK
------------------------------------------------------------------------
Outer PSN Label:      ${stk.psnLabel} (Transport Tunnel - 4 Bytes)
Inner VC Label:       ${stk.vcLabel} (Pseudowire Demux - 4 Bytes)
Control Word (CW):    ${d.controlWordEnabled ? 'ENABLED (4 Bytes - RFC 4385)' : 'DISABLED (Raw Mode)'}
Transport Eth Header: ${stk.transportEthBytes} Bytes
Total Encapsulation:  ${stk.totalEncapsulationBytes} Bytes per frame
MTU 1500B Overhead:   ${stk.overheadPctMtu1500}%
Min 64B Frame Overhead:${stk.overheadPctMin64}%

3. JITTER PLAYOUT BUFFER & SEQUENCE REORDERING
------------------------------------------------------------------------
Injected Network Jitter:       ${d.injectedJitterMs} ms
Playout Buffer Depth:          ${d.bufferDepthMs} ms
Buffer Headroom Margin:        ${d.bufferMarginMs > 0 ? '+' : ''}${d.bufferMarginMs} ms
Recommended Playout Buffer:    ${d.recommendedBufferDepthMs} ms

Out-of-Order Arrival Rate:     ${tel.reorderedPacketsPct}%
Dropped Out-of-Order Packets:  ${tel.droppedOutOfOrderPct}%
Sequence Recovery Success:     ${tel.reorderRecoverySuccessPct}%
Under-run (Starvation Rate):   ${tel.underRunRatePct}%
Over-run (Buffer Overflow):    ${tel.overRunRatePct}%

Circuit SLA Quality Status:    ${d.status}
Contractual Penalty Rebate:    ${d.penaltyRebatePct}% (PKR ${d.penaltyPkr.toLocaleString()})

Recommendations:
- Keep Control Word enabled on all financial and enterprise VPWS circuits to ensure in-order delivery.
- Set playout buffer depth to ${d.recommendedBufferDepthMs} ms to absorb peak metro jitter.
========================================================================`;
}

/**
 * Exports metrics as JSON string
 * @param {Object} metrics - Output of calculatePseudowireMetrics or calculatePseudowireDynamics
 * @returns {string} JSON formatted string
 */
export function exportPseudowireJson(metrics) {
  const d = metrics.dynamics || metrics;
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    standard: 'RFC 4447 / RFC 3985 Carrier MPLS Pseudowire',
    service: {
      id: d.service.id,
      name: d.service.name,
      pwId: d.service.pwId,
      primaryArea: d.service.primaryArea,
      bandwidthMbps: d.service.bandwidthMbps
    },
    encapsulation: d.stack,
    playoutBuffer: {
      depthMs: d.bufferDepthMs,
      jitterMs: d.injectedJitterMs,
      marginMs: d.bufferMarginMs,
      recommendedMs: d.recommendedBufferDepthMs
    },
    telemetry: d.telemetry,
    verdict: {
      status: d.status,
      penaltyPct: d.penaltyRebatePct,
      penaltyPkr: d.penaltyPkr,
      monthlyRevenuePkr: d.monthlyRevenuePkr
    }
  }, null, 2);
}

/**
 * Exports metrics as RFC-4180 CSV string
 * @param {Object} metrics - Output of calculatePseudowireMetrics or calculatePseudowireDynamics
 * @returns {string} CSV formatted string
 */
export function exportPseudowireCsv(metrics) {
  const d = metrics.dynamics || metrics;
  const s = d.service;

  const headers = [
    'Service_ID',
    'Service_Name',
    'PW_ID',
    'Primary_Area',
    'Bandwidth_Mbps',
    'Control_Word',
    'Jitter_Ms',
    'Buffer_Depth_Ms',
    'Buffer_Margin_Ms',
    'Reordered_Pct',
    'Dropped_Pct',
    'Recovery_Pct',
    'Quality_Status',
    'Penalty_Pct',
    'Penalty_PKR',
    'Monthly_Revenue_PKR'
  ];

  const values = [
    `"${s.id}"`,
    `"${s.name}"`,
    s.pwId,
    `"${s.primaryArea}"`,
    s.bandwidthMbps,
    d.controlWordEnabled ? 'true' : 'false',
    d.injectedJitterMs,
    d.bufferDepthMs,
    d.bufferMarginMs,
    d.telemetry.reorderedPacketsPct,
    d.telemetry.droppedOutOfOrderPct,
    d.telemetry.reorderRecoverySuccessPct,
    `"${d.status}"`,
    d.penaltyRebatePct,
    d.penaltyPkr,
    d.monthlyRevenuePkr
  ];

  return `${headers.join(',')}\r\n${values.join(',')}\r\n`;
}

/**
 * Controller wiring for Pseudowire modal dialog and dashboard chart card
 * @param {Object} state - Application state
 * @param {Object} options - Environment options (document, onFilterArea, onToast)
 * @returns {Object} Modal controller
 */
export function setupPseudowireModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const onToast = typeof options.onToast === 'function'
    ? options.onToast
    : (msg) => { if (typeof alert === 'function') alert(msg); };

  // Elements
  const openBtn = doc.getElementById('dashboardOpenPseudowireModalBtn');
  const modal = doc.getElementById('dashboardPseudowireModal');
  const closeBtn = doc.getElementById('dashboardPseudowireModalCloseBtn');

  // Dashboard Card Chart Container
  const cardChartContainer = doc.getElementById('dashboardPseudowireChart');

  // Modal Inputs
  const serviceSelect = doc.getElementById('pwServiceSelect');
  const jitterSlider = doc.getElementById('pwJitterSlider');
  const jitterLabel = doc.getElementById('pwJitterLabel');
  const bufferSlider = doc.getElementById('pwBufferSlider');
  const bufferLabel = doc.getElementById('pwBufferLabel');
  const cwCheck = doc.getElementById('pwCwCheck');
  const resetBtn = doc.getElementById('pwResetBtn');

  // Modal KPI Stats
  const statStatus = doc.getElementById('pwStatStatus');
  const statMargin = doc.getElementById('pwStatMargin');
  const statReordered = doc.getElementById('pwStatReordered');
  const statRecovery = doc.getElementById('pwStatRecovery');
  const statOverhead = doc.getElementById('pwStatOverhead');
  const statPenalty = doc.getElementById('pwStatPenalty');

  // Modal Diagram Container
  const modalDiagramContainer = doc.getElementById('pwModalDiagramContainer');

  // Export / Action Buttons
  const copyReportBtn = doc.getElementById('pwCopyReportBtn');
  const exportJsonBtn = doc.getElementById('pwExportJsonBtn');
  const exportCsvBtn = doc.getElementById('pwExportCsvBtn');
  const filterAreaBtn = doc.getElementById('pwFilterAreaBtn');

  // State variables
  let currentServiceId = PSEUDOWIRE_CONSTANTS.DEFAULT_SERVICE_ID;
  let currentJitterMs = 1.2;
  let currentBufferDepthMs = PSEUDOWIRE_CONSTANTS.DEFAULT_BUFFER_DEPTH_MS;
  let currentControlWord = PSEUDOWIRE_CONSTANTS.DEFAULT_CONTROL_WORD;

  function getSimulationParams() {
    return {
      serviceId: currentServiceId,
      injectedJitterMs: currentJitterMs,
      bufferDepthMs: currentBufferDepthMs,
      controlWordEnabled: currentControlWord
    };
  }

  function recalculate() {
    const params = getSimulationParams();
    const metrics = calculatePseudowireMetrics(state, params);
    const d = metrics.dynamics;

    // Update Slider Labels
    if (jitterLabel) jitterLabel.textContent = `${currentJitterMs.toFixed(1)} ms`;
    if (bufferLabel) bufferLabel.textContent = `${currentBufferDepthMs.toFixed(1)} ms`;

    // Update Modal Stats
    if (statStatus) {
      statStatus.textContent = d.status;
      statStatus.style.color = d.statusColor;
    }

    if (statMargin) {
      statMargin.textContent = `${d.bufferMarginMs > 0 ? '+' : ''}${d.bufferMarginMs} ms`;
      statMargin.style.color = d.bufferMarginMs >= 0 ? '#10b981' : '#ef4444';
    }

    if (statReordered) {
      statReordered.textContent = `${d.telemetry.reorderedPacketsPct}% (${d.telemetry.droppedOutOfOrderPct}% drop)`;
      statReordered.style.color = d.telemetry.droppedOutOfOrderPct > 0 ? '#ef4444' : '#10b981';
    }

    if (statRecovery) {
      statRecovery.textContent = `${d.telemetry.reorderRecoverySuccessPct}%`;
      statRecovery.style.color = d.telemetry.reorderRecoverySuccessPct > 90 ? '#10b981' : '#f59e0b';
    }

    if (statOverhead) {
      statOverhead.textContent = `${d.stack.totalEncapsulationBytes} B (+${d.stack.overheadPctMtu1500}%)`;
    }

    if (statPenalty) {
      statPenalty.textContent = d.penaltyRebatePct > 0
        ? `${d.penaltyRebatePct}% (${formatPKR(d.penaltyPkr)})`
        : '0% (PKR 0)';
      statPenalty.style.color = d.penaltyRebatePct > 0 ? '#ef4444' : '#10b981';
    }

    // Render Modal Diagram
    if (modalDiagramContainer) {
      modalDiagramContainer.innerHTML = renderPseudowireDiagramSvg(d, {
        width: 760,
        height: 420,
        isDarkMode: doc.documentElement ? doc.documentElement.getAttribute('data-theme') !== 'light' : true
      });
    }

    // Render Dashboard Card Chart
    if (cardChartContainer) {
      cardChartContainer.innerHTML = renderPseudowireDiagramSvg(d, {
        width: 600,
        height: 320,
        isDarkMode: doc.documentElement ? doc.documentElement.getAttribute('data-theme') !== 'light' : true
      });
    }

    return metrics;
  }

  function loadService(serviceId) {
    currentServiceId = serviceId;
    const s = SHAHDARA_PSEUDOWIRE_SERVICES.find(item => item.id === serviceId) || SHAHDARA_PSEUDOWIRE_SERVICES[0];
    currentJitterMs = s.baselineJitterMs;
    currentBufferDepthMs = PSEUDOWIRE_CONSTANTS.DEFAULT_BUFFER_DEPTH_MS;
    currentControlWord = typeof s.controlWordEnabled === 'boolean' ? s.controlWordEnabled : true;

    if (serviceSelect) serviceSelect.value = serviceId;
    if (jitterSlider) jitterSlider.value = currentJitterMs;
    if (bufferSlider) bufferSlider.value = currentBufferDepthMs;
    if (cwCheck) cwCheck.checked = currentControlWord;

    recalculate();
  }

  // Initial populate
  loadService(currentServiceId);

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

  if (serviceSelect) {
    serviceSelect.addEventListener('change', () => {
      loadService(serviceSelect.value);
    });
  }

  if (jitterSlider) {
    jitterSlider.addEventListener('input', () => {
      currentJitterMs = parseFloat(jitterSlider.value) || 0.1;
      recalculate();
    });
  }

  if (bufferSlider) {
    bufferSlider.addEventListener('input', () => {
      currentBufferDepthMs = parseFloat(bufferSlider.value) || 1.0;
      recalculate();
    });
  }

  if (cwCheck) {
    cwCheck.addEventListener('change', () => {
      currentControlWord = cwCheck.checked;
      recalculate();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      loadService(currentServiceId);
      onToast('MPLS Pseudowire parameters reset to baseline.');
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const params = getSimulationParams();
      const metrics = calculatePseudowireMetrics(state, params);
      const text = generatePseudowireReport(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          onToast('MPLS Pseudowire Audit Report copied to clipboard!');
        }).catch(() => {
          onToast('Failed to copy report.');
        });
      } else {
        onToast('Clipboard API not available.');
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const params = getSimulationParams();
      const metrics = calculatePseudowireMetrics(state, params);
      const json = exportPseudowireJson(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(json).then(() => {
          onToast('Pseudowire JSON exported to clipboard!');
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
      const metrics = calculatePseudowireMetrics(state, params);
      const csv = exportPseudowireCsv(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(csv).then(() => {
          onToast('Pseudowire CSV exported to clipboard!');
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
      const s = SHAHDARA_PSEUDOWIRE_SERVICES.find(item => item.id === currentServiceId) || SHAHDARA_PSEUDOWIRE_SERVICES[0];
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
