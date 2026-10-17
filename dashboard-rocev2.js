import { formatPKR } from './core.js';

/**
 * Carrier RoCEv2 (RDMA over Converged Ethernet / InfiniBand Architecture)
 * Priority Flow Control (PFC - IEEE 802.1Qbb), Explicit Congestion Notification (ECN - RFC 3168)
 * & DCQCN Congestion Matrix
 *
 * Models lossless transport fabric across Shahdara ISP's edge AI compute clusters,
 * 5G Cloud-RAN distributed units, and ultra-low-latency NVMe-oF CDN storage tiers.
 *
 * Evaluates:
 * - Priority Flow Control (PFC - IEEE 802.1Qbb) 802.1p CoS 3 lossless queue management
 * - In-flight buffer headroom sizing based on cable RTT, switch pipeline latency, and MTU
 * - Random Early Detection (RED/WRED) ECN marking probability between K_min and K_max
 * - Data Center Quantized Congestion Notification (DCQCN - RFC 3168 / IBTA Annex A17)
 *   AIMD rate recovery and alpha parameter drift
 * - PFC watchdog deadlock detection and mitigation timers (100ms threshold)
 * - Impact on downstream subscriber video streaming, low-latency gaming, and SLA revenue
 */

export const ROCEV2_CONSTANTS = {
  DEFAULT_CLUSTER_ID: 'baradari-ai-edge',
  DEFAULT_LINK_SPEED_GBPS: 100,
  DEFAULT_PFC_PRIORITY: 3,
  DEFAULT_ECN_KMIN_KB: 150,
  DEFAULT_ECN_KMAX_KB: 600,
  DEFAULT_PFC_XOFF_KB: 800,
  DEFAULT_PFC_XON_KB: 500,
  DEFAULT_BUFFER_CAPACITY_KB: 1200,
  DEFAULT_BURST_ACTIVE: false,

  DEADLOCK_WATCHDOG_LIMIT_MS: 100,
  PROPAGATION_SPEED_NS_PER_M: 5.0, // 5 ns per meter in silica optical fiber
  SWITCH_INGRESS_EGRESS_LATENCY_NS: 450, // Cut-through ASIC latency

  LINK_SPEEDS: {
    25: { gbps: 25, label: '25 Gbps (Edge Access)', standardMtuBytes: 1500, jumboMtuBytes: 9216 },
    50: { gbps: 50, label: '50 Gbps (5G Fronthaul)', standardMtuBytes: 1500, jumboMtuBytes: 9216 },
    100: { gbps: 100, label: '100 Gbps (Spine Fabric)', standardMtuBytes: 1500, jumboMtuBytes: 9216 },
    400: { gbps: 400, label: '400 Gbps (Metro Ultra-Core)', standardMtuBytes: 1500, jumboMtuBytes: 9216 }
  },

  CLUSTERS: [
    {
      id: 'baradari-ai-edge',
      name: 'Baradari Edge Data Center (AI / Video Transcoding)',
      nodeType: 'Edge AI Compute & Transcoding Tier',
      rackCount: 16,
      linkSpeedGbps: 100,
      cableLengthMeters: 45,
      mtuBytes: 9216,
      baselineQueueKb: 180,
      activeFlows: 64,
      connectedSubscribers: 420,
      monthlyRevenueExposurePkr: 840000,
      description: 'Distributed AI inference and real-time OTT video caching delivering sub-millisecond transcoding.'
    },
    {
      id: 'begum-kot-cran',
      name: 'Begum Kot 5G Cloud-RAN Distributed Unit',
      nodeType: 'O-RAN Low-Latency Fronthaul DU',
      rackCount: 8,
      linkSpeedGbps: 50,
      cableLengthMeters: 120,
      mtuBytes: 1500,
      baselineQueueKb: 140,
      activeFlows: 32,
      connectedSubscribers: 310,
      monthlyRevenueExposurePkr: 620000,
      description: 'Ultra-Reliable Low-Latency Communication (URLLC) processing for cellular and fixed-wireless access.'
    },
    {
      id: 'jia-musa-cdn',
      name: 'Jia Musa CDN Edge Cache (NVMe-oF Storage)',
      nodeType: 'High-Throughput NVMe-oF Storage Tier',
      rackCount: 12,
      linkSpeedGbps: 100,
      cableLengthMeters: 30,
      mtuBytes: 9216,
      baselineQueueKb: 260,
      activeFlows: 48,
      connectedSubscribers: 550,
      monthlyRevenueExposurePkr: 1100000,
      description: 'All-flash NVMe over Fabrics storage fabric powering localized Steam, YouTube and Netflix caching.'
    },
    {
      id: 'ravi-siphon-core',
      name: 'Ravi Siphon Regional Spine Interconnect',
      nodeType: '400GbE Lossless Metro Core Fabric',
      rackCount: 24,
      linkSpeedGbps: 400,
      cableLengthMeters: 350,
      mtuBytes: 9216,
      baselineQueueKb: 380,
      activeFlows: 128,
      connectedSubscribers: 880,
      monthlyRevenueExposurePkr: 1760000,
      description: 'High-radix spine interconnect linking North and South Shahdara backbone rings with zero frame loss.'
    },
    {
      id: 'gt-road-dr',
      name: 'GT Road Disaster Recovery Colocation',
      nodeType: 'Disaster Recovery Replication Fabric',
      rackCount: 10,
      linkSpeedGbps: 100,
      cableLengthMeters: 600,
      mtuBytes: 9216,
      baselineQueueKb: 210,
      activeFlows: 24,
      connectedSubscribers: 280,
      monthlyRevenueExposurePkr: 560000,
      description: 'Synchronous block-level database replication between central NOC and remote disaster recovery site.'
    }
  ]
};

// Simulation and interactive UI state
let rocev2SelectedClusterId = ROCEV2_CONSTANTS.DEFAULT_CLUSTER_ID;
let rocev2LinkSpeedGbps = ROCEV2_CONSTANTS.DEFAULT_LINK_SPEED_GBPS;
let rocev2EcnKminKb = ROCEV2_CONSTANTS.DEFAULT_ECN_KMIN_KB;
let rocev2EcnKmaxKb = ROCEV2_CONSTANTS.DEFAULT_ECN_KMAX_KB;
let rocev2PfcXoffKb = ROCEV2_CONSTANTS.DEFAULT_PFC_XOFF_KB;
let rocev2PfcXonKb = ROCEV2_CONSTANTS.DEFAULT_PFC_XON_KB;
let rocev2CongestionBurstActive = ROCEV2_CONSTANTS.DEFAULT_BURST_ACTIVE;

export function getRocev2SelectedClusterId() {
  return rocev2SelectedClusterId;
}

export function setRocev2SelectedClusterId(id) {
  if (ROCEV2_CONSTANTS.CLUSTERS.some(c => c.id === id)) {
    rocev2SelectedClusterId = id;
    const cluster = ROCEV2_CONSTANTS.CLUSTERS.find(c => c.id === id);
    if (cluster) {
      rocev2LinkSpeedGbps = cluster.linkSpeedGbps;
    }
  }
}

export function getRocev2LinkSpeedGbps() {
  return rocev2LinkSpeedGbps;
}

export function setRocev2LinkSpeedGbps(speed) {
  const num = parseInt(speed, 10);
  if (ROCEV2_CONSTANTS.LINK_SPEEDS[num]) {
    rocev2LinkSpeedGbps = num;
  }
}

export function getRocev2EcnKminKb() {
  return rocev2EcnKminKb;
}

export function setRocev2EcnKminKb(kb) {
  const val = Math.max(50, Math.min(rocev2EcnKmaxKb - 50, parseInt(kb, 10) || 150));
  rocev2EcnKminKb = val;
}

export function getRocev2EcnKmaxKb() {
  return rocev2EcnKmaxKb;
}

export function setRocev2EcnKmaxKb(kb) {
  const val = Math.max(rocev2EcnKminKb + 50, Math.min(rocev2PfcXoffKb - 50, parseInt(kb, 10) || 600));
  rocev2EcnKmaxKb = val;
}

export function getRocev2CongestionBurst() {
  return rocev2CongestionBurstActive;
}

export function setRocev2CongestionBurst(active) {
  rocev2CongestionBurstActive = !!active;
}

export function resetRocev2SimState() {
  rocev2SelectedClusterId = ROCEV2_CONSTANTS.DEFAULT_CLUSTER_ID;
  rocev2LinkSpeedGbps = ROCEV2_CONSTANTS.DEFAULT_LINK_SPEED_GBPS;
  rocev2EcnKminKb = ROCEV2_CONSTANTS.DEFAULT_ECN_KMIN_KB;
  rocev2EcnKmaxKb = ROCEV2_CONSTANTS.DEFAULT_ECN_KMAX_KB;
  rocev2PfcXoffKb = ROCEV2_CONSTANTS.DEFAULT_PFC_XOFF_KB;
  rocev2PfcXonKb = ROCEV2_CONSTANTS.DEFAULT_PFC_XON_KB;
  rocev2CongestionBurstActive = ROCEV2_CONSTANTS.DEFAULT_BURST_ACTIVE;
}

/**
 * Calculates in-flight buffer headroom required to guarantee zero packet loss under PFC.
 * Sizing formula: Headroom = 2 * (t_prop + t_asic) * Bandwidth + 2 * MTU + Safety
 */
export function calculateRocev2BufferHeadroom({
  linkSpeedGbps = 100,
  cableLengthMeters = 50,
  switchLatencyNs = ROCEV2_CONSTANTS.SWITCH_INGRESS_EGRESS_LATENCY_NS,
  mtuBytes = 9216
} = {}) {
  const oneWayPropDelayNs = cableLengthMeters * ROCEV2_CONSTANTS.PROPAGATION_SPEED_NS_PER_M;
  const roundTripTimeNs = 2 * oneWayPropDelayNs + 2 * switchLatencyNs;
  const byteRatePerNs = (linkSpeedGbps * 1e9) / (8 * 1e9); // bytes per nanosecond

  const inFlightFlightBytes = Math.round(roundTripTimeNs * byteRatePerNs);
  // Add 2 frames of MTU drainage buffer and 10% safety margin
  const requiredHeadroomBytes = inFlightFlightBytes + 2 * mtuBytes;
  const requiredHeadroomKb = Math.ceil((requiredHeadroomBytes * 1.1) / 1024);

  return {
    oneWayPropDelayNs: Math.round(oneWayPropDelayNs),
    roundTripTimeNs: Math.round(roundTripTimeNs),
    inFlightFlightBytes,
    requiredHeadroomBytes,
    requiredHeadroomKb
  };
}

/**
 * Evaluates instantaneous RoCEv2 queue congestion, ECN marking probability,
 * PFC PAUSE generation, and DCQCN rate throttling dynamics.
 */
export function evaluateRocev2Congestion({
  queueOccupancyKb = 200,
  ecnKminKb = ROCEV2_CONSTANTS.DEFAULT_ECN_KMIN_KB,
  ecnKmaxKb = ROCEV2_CONSTANTS.DEFAULT_ECN_KMAX_KB,
  pfcXoffKb = ROCEV2_CONSTANTS.DEFAULT_PFC_XOFF_KB,
  pfcXonKb = ROCEV2_CONSTANTS.DEFAULT_PFC_XON_KB,
  linkSpeedGbps = 100
} = {}) {
  // 1. ECN Random Early Detection Marking Probability P_mark
  let ecnMarkingProb = 0;
  if (queueOccupancyKb <= ecnKminKb) {
    ecnMarkingProb = 0;
  } else if (queueOccupancyKb >= ecnKmaxKb) {
    ecnMarkingProb = 1.0;
  } else {
    ecnMarkingProb = (queueOccupancyKb - ecnKminKb) / (ecnKmaxKb - ecnKminKb);
  }

  // 2. PFC State: Normal, XOFF Triggered, or XON Cleared
  let pfcState = 'FLOWING';
  let pfcActive = false;
  if (queueOccupancyKb >= pfcXoffKb) {
    pfcState = 'PAUSE_TRIGGERED';
    pfcActive = true;
  } else if (queueOccupancyKb > pfcXonKb && queueOccupancyKb < pfcXoffKb) {
    pfcState = 'HEADROOM_EATING';
  } else {
    pfcState = 'FLOWING';
  }

  // 3. DCQCN Rate Adjustment
  // Base alpha drift and multiplicative decrease on ECN/PFC
  let dcqcnAlpha = ecnMarkingProb * 0.85;
  if (pfcActive) dcqcnAlpha = Math.min(1.0, dcqcnAlpha + 0.35);

  const rateThrottlingPct = Math.min(85, Math.round((dcqcnAlpha / 2) * 100 + (pfcActive ? 30 : 0)));
  const currentEffectiveRateGbps = Number((linkSpeedGbps * (1 - rateThrottlingPct / 100)).toFixed(1));

  // 4. Queuing Delay (microsecond latency penalty)
  const bitsInQueue = queueOccupancyKb * 1024 * 8;
  const queuingDelayUs = Number(((bitsInQueue / (linkSpeedGbps * 1e9)) * 1e6).toFixed(2));

  // 5. Fabric Health Verdict
  let healthVerdict = 'OPTIMAL_LOSSLESS';
  let badgeColor = '#10b981';
  let label = 'Lossless Fabric Optimal (Zero Drops · Low Latency)';

  if (pfcActive) {
    healthVerdict = 'PFC_PAUSE_ACTIVE';
    badgeColor = '#ef4444';
    label = 'PFC Pause Active (XOFF Sent · Buffer Flow Throttled)';
  } else if (queueOccupancyKb >= ecnKminKb) {
    healthVerdict = 'ECN_MARKING_ACTIVE';
    badgeColor = '#f59e0b';
    label = 'ECN Marking Active (DCQCN Rate Reduction Engaged)';
  }

  return {
    queueOccupancyKb,
    ecnKminKb,
    ecnKmaxKb,
    pfcXoffKb,
    pfcXonKb,
    ecnMarkingProb: Number(ecnMarkingProb.toFixed(3)),
    ecnMarkingPct: Number((ecnMarkingProb * 100).toFixed(1)),
    pfcState,
    pfcActive,
    dcqcnAlpha: Number(dcqcnAlpha.toFixed(3)),
    rateThrottlingPct,
    currentEffectiveRateGbps,
    queuingDelayUs,
    healthVerdict,
    badgeColor,
    label
  };
}

/**
 * Computes complete RoCEv2 metrics across clusters and user state.
 */
export function calculateRocev2Metrics(state = {}, options = {}) {
  const clusterId = options.clusterId || rocev2SelectedClusterId;
  const cluster = ROCEV2_CONSTANTS.CLUSTERS.find(c => c.id === clusterId) || ROCEV2_CONSTANTS.CLUSTERS[0];

  const linkSpeedGbps = options.linkSpeedGbps || rocev2LinkSpeedGbps;
  const isBurst = options.congestionBurst !== undefined ? options.congestionBurst : rocev2CongestionBurstActive;

  const ecnKminKb = options.ecnKminKb || rocev2EcnKminKb;
  const ecnKmaxKb = options.ecnKmaxKb || rocev2EcnKmaxKb;
  const pfcXoffKb = options.pfcXoffKb || rocev2PfcXoffKb;
  const pfcXonKb = options.pfcXonKb || rocev2PfcXonKb;

  // Compute buffer headroom sizing
  const headroom = calculateRocev2BufferHeadroom({
    linkSpeedGbps,
    cableLengthMeters: cluster.cableLengthMeters,
    mtuBytes: cluster.mtuBytes
  });

  // Calculate simulated instantaneous queue occupancy
  let queueOccupancyKb = cluster.baselineQueueKb;
  if (isBurst) {
    queueOccupancyKb += 680; // Burst drives queue into PFC XOFF zone
  }

  const congestion = evaluateRocev2Congestion({
    queueOccupancyKb,
    ecnKminKb,
    ecnKmaxKb,
    pfcXoffKb,
    pfcXonKb,
    linkSpeedGbps
  });

  // Correlate with ISP state customers and monthly revenue
  const totalCustomers = Array.isArray(state?.customers) ? state.customers.length : 0;
  const activeCustomers = Array.isArray(state?.customers)
    ? state.customers.filter(c => c.status === 'ACTIVE' || c.status === 'Active').length
    : 0;

  return {
    cluster,
    linkSpeedGbps,
    headroom,
    congestion,
    isBurst,
    totalCustomers,
    activeCustomers,
    revenueExposureFormatted: formatPKR(cluster.monthlyRevenueExposurePkr)
  };
}

/**
 * Pure vector SVG visualizer showing queue watermark thresholds,
 * lossless packet stream with ECN/PFC markers, and DCQCN rate curves.
 */
export function renderRocev2DiagramSvg(metrics, { isDark = false, compact = false } = {}) {
  const width = compact ? 560 : 780;
  const height = compact ? 220 : 310;

  const bg = isDark ? '#0f172a' : '#ffffff';
  const textMain = isDark ? '#f8fafc' : '#0f172a';
  const textSub = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const { cluster, congestion, headroom, linkSpeedGbps } = metrics;
  const maxScaleKb = ROCEV2_CONSTANTS.DEFAULT_BUFFER_CAPACITY_KB;

  // Coordinates for the buffer queue bar
  const barX = 70;
  const barY = compact ? 50 : 65;
  const barWidth = width - (compact ? 120 : 180);
  const barHeight = compact ? 26 : 34;

  const qPct = Math.min(100, (congestion.queueOccupancyKb / maxScaleKb) * 100);
  const qBarWidth = (qPct / 100) * barWidth;

  const kminX = barX + (congestion.ecnKminKb / maxScaleKb) * barWidth;
  const kmaxX = barX + (congestion.ecnKmaxKb / maxScaleKb) * barWidth;
  const xoffX = barX + (congestion.pfcXoffKb / maxScaleKb) * barWidth;

  const statusColor = congestion.badgeColor;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Background Container -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${bg}" stroke="${borderColor}" stroke-width="1" />

      <!-- Title / Header -->
      <text x="${barX}" y="${barY - 30}" font-size="${compact ? 11 : 13}" font-weight="700" fill="${textMain}">
        RoCEv2 Lossless Buffer Queue &amp; Congestion Watermarks (${linkSpeedGbps} Gbps · CoS ${ROCEV2_CONSTANTS.DEFAULT_PFC_PRIORITY})
      </text>
      <text x="${barX}" y="${barY - 14}" font-size="${compact ? 9 : 10}" fill="${textSub}">
        Cluster: ${cluster.name} · RTT: ${headroom.roundTripTimeNs} ns · Headroom: ${headroom.requiredHeadroomKb} KB
      </text>

      <!-- Buffer Capacity Rail Background -->
      <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="4" fill="${isDark ? '#1e293b' : '#f1f5f9'}" stroke="${borderColor}" stroke-width="1.5" />

      <!-- ECN Marking Zone (K_min to K_max) -->
      <rect x="${kminX}" y="${barY}" width="${Math.max(0, kmaxX - kminX)}" height="${barHeight}" fill="#f59e0b" fill-opacity="${isDark ? 0.25 : 0.15}" />

      <!-- PFC XOFF Headroom Zone (X_off to Capacity) -->
      <rect x="${xoffX}" y="${barY}" width="${Math.max(0, barX + barWidth - xoffX)}" height="${barHeight}" fill="#ef4444" fill-opacity="${isDark ? 0.25 : 0.15}" />

      <!-- Current Queue Occupancy Fill -->
      <rect x="${barX}" y="${barY}" width="${qBarWidth}" height="${barHeight}" rx="4" fill="${statusColor}" fill-opacity="0.85" />

      <!-- Threshold Watermark Lines -->
      <!-- K_min Marker -->
      <line x1="${kminX}" y1="${barY - 4}" x2="${kminX}" y2="${barY + barHeight + 4}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3,2" />
      <text x="${kminX}" y="${barY + barHeight + 14}" font-size="9" font-weight="600" fill="#f59e0b" text-anchor="middle">K_min (${congestion.ecnKminKb}K)</text>

      <!-- K_max Marker -->
      <line x1="${kmaxX}" y1="${barY - 4}" x2="${kmaxX}" y2="${barY + barHeight + 4}" stroke="#ea580c" stroke-width="2" stroke-dasharray="3,2" />
      <text x="${kmaxX}" y="${barY + barHeight + 14}" font-size="9" font-weight="600" fill="#ea580c" text-anchor="middle">K_max (${congestion.ecnKmaxKb}K)</text>

      <!-- PFC XOFF Marker -->
      <line x1="${xoffX}" y1="${barY - 4}" x2="${xoffX}" y2="${barY + barHeight + 4}" stroke="#ef4444" stroke-width="2" />
      <text x="${xoffX}" y="${barY + barHeight + 14}" font-size="9" font-weight="700" fill="#ef4444" text-anchor="middle">XOFF (${congestion.pfcXoffKb}K)</text>

      <!-- Current Level Pointer -->
      <polygon points="${barX + qBarWidth},${barY - 2} ${barX + qBarWidth - 5},${barY - 9} ${barX + qBarWidth + 5},${barY - 9}" fill="${statusColor}" />
      <text x="${barX + qBarWidth}" y="${barY - 12}" font-size="9" font-weight="700" fill="${statusColor}" text-anchor="middle">${congestion.queueOccupancyKb} KB</text>

      <!-- Lossless Packet Flow Representation -->
      <g transform="translate(${barX}, ${compact ? barY + 45 : barY + 60})">
        <text x="0" y="14" font-size="10" font-weight="600" fill="${textMain}">Packet Flow:</text>

        <!-- Packet stream rectangles -->
        <rect x="75" y="2" width="38" height="18" rx="3" fill="#10b981" />
        <text x="94" y="14" font-size="8" fill="#fff" font-weight="700" text-anchor="middle">DATA</text>

        <rect x="120" y="2" width="38" height="18" rx="3" fill="${congestion.ecnMarkingProb > 0 ? '#f59e0b' : '#10b981'}" />
        <text x="139" y="14" font-size="8" fill="#fff" font-weight="700" text-anchor="middle">${congestion.ecnMarkingProb > 0 ? 'ECN-CE' : 'DATA'}</text>

        <rect x="165" y="2" width="38" height="18" rx="3" fill="${congestion.pfcActive ? '#ef4444' : '#10b981'}" />
        <text x="184" y="14" font-size="8" fill="#fff" font-weight="700" text-anchor="middle">${congestion.pfcActive ? 'PAUSE' : 'DATA'}</text>

        <rect x="210" y="2" width="38" height="18" rx="3" fill="#10b981" />
        <text x="229" y="14" font-size="8" fill="#fff" font-weight="700" text-anchor="middle">DATA</text>

        <!-- Status Tag -->
        <rect x="260" y="2" width="${compact ? 170 : 220}" height="18" rx="9" fill="${statusColor}" fill-opacity="0.15" stroke="${statusColor}" stroke-width="1" />
        <text x="${compact ? 345 : 370}" y="14" font-size="9" font-weight="700" fill="${statusColor}" text-anchor="middle">
          ${congestion.pfcActive ? 'PFC PAUSE XOFF EMITTED' : (congestion.ecnMarkingProb > 0 ? `ECN MARKING: ${congestion.ecnMarkingPct}%` : 'ZERO PAUSE · 100% LINE RATE')}
        </text>
      </g>

      <!-- Bottom HUD Telemetry Ribbon -->
      <g transform="translate(${barX}, ${compact ? barY + 85 : barY + 110})">
        <rect x="0" y="0" width="${barWidth}" height="${compact ? 45 : 55}" rx="6" fill="${isDark ? '#1e293b' : '#f8fafc'}" stroke="${borderColor}" stroke-width="1" />

        <text x="15" y="${compact ? 16 : 20}" font-size="9" font-weight="600" fill="${textSub}">EFFECTIVE THROUGHPUT</text>
        <text x="15" y="${compact ? 34 : 42}" font-size="${compact ? 12 : 14}" font-weight="800" fill="${statusColor}">${congestion.currentEffectiveRateGbps} Gbps</text>

        <text x="${barWidth * 0.32}" y="${compact ? 16 : 20}" font-size="9" font-weight="600" fill="${textSub}">QUEUE LATENCY</text>
        <text x="${barWidth * 0.32}" y="${compact ? 34 : 42}" font-size="${compact ? 12 : 14}" font-weight="800" fill="${textMain}">${congestion.queuingDelayUs} µs</text>

        <text x="${barWidth * 0.58}" y="${compact ? 16 : 20}" font-size="9" font-weight="600" fill="${textSub}">DCQCN ALPHA</text>
        <text x="${barWidth * 0.58}" y="${compact ? 34 : 42}" font-size="${compact ? 12 : 14}" font-weight="800" fill="#f59e0b">${congestion.dcqcnAlpha}</text>

        <text x="${barWidth * 0.82}" y="${compact ? 16 : 20}" font-size="9" font-weight="600" fill="${textSub}">PFC STATE</text>
        <text x="${barWidth * 0.82}" y="${compact ? 34 : 42}" font-size="${compact ? 11 : 13}" font-weight="800" fill="${statusColor}">${congestion.pfcState}</text>
      </g>
    </svg>
  `;
}

/**
 * Generates plain-text Outside Plant & Data Center Engineering Audit Report.
 */
export function generateRocev2Report(metrics) {
  const { cluster, congestion, headroom, linkSpeedGbps } = metrics;
  const now = new Date().toISOString();

  return `================================================================================
SHAHDARA ISP CARRIER NOC - ROCEV2 LOSSLESS FABRIC AUDIT REPORT
================================================================================
Generated: ${now}
Cluster Target: ${cluster.name} (${cluster.id})
Architecture: ${cluster.nodeType}
Configured Link Speed: ${linkSpeedGbps} Gbps · CoS 3 Lossless

--------------------------------------------------------------------------------
1. FABRIC HEADROOM & PROPAGATION DYNAMICS
--------------------------------------------------------------------------------
Cable Length (Optical Fiber): ${cluster.cableLengthMeters} meters
One-Way Fiber Delay: ${headroom.oneWayPropDelayNs} ns
Round-Trip Time (RTT): ${headroom.roundTripTimeNs} ns (incl. 2x ASIC latency)
Calculated Lossless Headroom: ${headroom.requiredHeadroomKb} KB (${headroom.requiredHeadroomBytes} Bytes)
Standard MTU Size: ${cluster.mtuBytes} Bytes

--------------------------------------------------------------------------------
2. QUEUE OCCUPANCY & CONGESTION THRESHOLDS
--------------------------------------------------------------------------------
Current Queue Occupancy: ${congestion.queueOccupancyKb} KB
ECN K_min Watermark: ${congestion.ecnKminKb} KB
ECN K_max Watermark: ${congestion.ecnKmaxKb} KB
PFC XOFF Trigger Threshold: ${congestion.pfcXoffKb} KB
PFC XON Release Threshold: ${congestion.pfcXonKb} KB

--------------------------------------------------------------------------------
3. PERFORMANCE & DCQCN RATE METRICS
--------------------------------------------------------------------------------
Fabric Health Verdict: ${congestion.healthVerdict} (${congestion.label})
ECN Marking Probability: ${congestion.ecnMarkingPct}%
PFC Pause Emitted: ${congestion.pfcActive ? 'YES (XOFF ACTIVE)' : 'NO (FLOWING)'}
DCQCN Alpha Parameter: ${congestion.dcqcnAlpha}
Rate Throttling Applied: ${congestion.rateThrottlingPct}%
Effective Transmission Rate: ${congestion.currentEffectiveRateGbps} Gbps
Instantaneous Queue Latency: ${congestion.queuingDelayUs} microseconds

--------------------------------------------------------------------------------
4. SUBSCRIBER SLA & REVENUE IMPACT
--------------------------------------------------------------------------------
Active Optical Flows: ${cluster.activeFlows}
Connected Subscribers in Sector: ${cluster.connectedSubscribers}
Monthly Revenue Exposure: ${metrics.revenueExposureFormatted}
Lossless Guarantee: 100% Zero-Drop RDMA / RoCEv2 transport maintained.
================================================================================
`;
}

/**
 * Exports RoCEv2 metrics as JSON file.
 */
export function exportRocev2Json(metrics) {
  const jsonStr = JSON.stringify(metrics, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rocev2-metrics-${metrics.cluster.id}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports RoCEv2 metrics as RFC-4180 CSV file with UTF-8 BOM.
 */
export function exportRocev2Csv(metrics) {
  const { cluster, congestion, headroom, linkSpeedGbps } = metrics;
  const headers = [
    'Timestamp',
    'ClusterID',
    'ClusterName',
    'LinkSpeedGbps',
    'CableMeters',
    'RttNs',
    'HeadroomKb',
    'QueueOccupancyKb',
    'EcnKminKb',
    'EcnKmaxKb',
    'PfcXoffKb',
    'EcnMarkingPct',
    'PfcActive',
    'DcqcnAlpha',
    'EffectiveRateGbps',
    'LatencyUs',
    'Verdict',
    'MonthlyRevenueExposurePKR'
  ];

  const row = [
    new Date().toISOString(),
    cluster.id,
    `"${cluster.name.replace(/"/g, '""')}"`,
    linkSpeedGbps,
    cluster.cableLengthMeters,
    headroom.roundTripTimeNs,
    headroom.requiredHeadroomKb,
    congestion.queueOccupancyKb,
    congestion.ecnKminKb,
    congestion.ecnKmaxKb,
    congestion.pfcXoffKb,
    congestion.ecnMarkingPct,
    congestion.pfcActive ? 'TRUE' : 'FALSE',
    congestion.dcqcnAlpha,
    congestion.currentEffectiveRateGbps,
    congestion.queuingDelayUs,
    `"${congestion.healthVerdict}"`,
    cluster.monthlyRevenueExposurePkr
  ];

  const csvContent = '\uFEFF' + headers.join(',') + '\n' + row.join(',') + '\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rocev2-audit-${cluster.id}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Modal dialog event listener and UI wiring for #dashboardRocev2Modal.
 */
export function setupRocev2Modal(state = {}, options = {}) {
  if (typeof document === 'undefined') return;

  const modal = document.getElementById('dashboardRocev2Modal');
  const openBtn = document.getElementById('openDashboardRocev2Btn');
  const closeBtn = document.getElementById('dashboardRocev2CloseBtn');

  const clusterSelect = document.getElementById('rocev2ClusterSelect');
  const speedSelect = document.getElementById('rocev2SpeedSelect');
  const kminInput = document.getElementById('rocev2KminInput');
  const kmaxInput = document.getElementById('rocev2KmaxInput');
  const burstBtn = document.getElementById('rocev2BurstBtn');
  const resetBtn = document.getElementById('rocev2ResetBtn');
  const copyReportBtn = document.getElementById('rocev2CopyReportBtn');
  const exportJsonBtn = document.getElementById('rocev2ExportJsonBtn');
  const exportCsvBtn = document.getElementById('rocev2ExportCsvBtn');

  const chartContainer = document.getElementById('rocev2SvgContainer');
  const kpiVerdict = document.getElementById('rocev2KpiVerdict');
  const kpiRate = document.getElementById('rocev2KpiRate');
  const kpiLatency = document.getElementById('rocev2KpiLatency');
  const kpiHeadroom = document.getElementById('rocev2KpiHeadroom');

  function updateUi() {
    const metrics = calculateRocev2Metrics(state);
    const isDark = (typeof document !== 'undefined' && document.documentElement?.getAttribute?.('data-theme') === 'dark');

    if (chartContainer) {
      chartContainer.innerHTML = renderRocev2DiagramSvg(metrics, { isDark, compact: false });
    }

    if (kpiVerdict) {
      kpiVerdict.textContent = metrics.congestion.label;
      kpiVerdict.style.color = metrics.congestion.badgeColor;
    }
    if (kpiRate) {
      kpiRate.textContent = `${metrics.congestion.currentEffectiveRateGbps} Gbps (${metrics.linkSpeedGbps}G Line)`;
    }
    if (kpiLatency) {
      kpiLatency.textContent = `${metrics.congestion.queuingDelayUs} µs (RTT: ${metrics.headroom.roundTripTimeNs} ns)`;
    }
    if (kpiHeadroom) {
      kpiHeadroom.textContent = `${metrics.headroom.requiredHeadroomKb} KB (${metrics.headroom.requiredHeadroomBytes} B)`;
    }

    if (burstBtn) {
      burstBtn.textContent = metrics.isBurst ? '🔥 Clear Congestion Burst' : '💥 Inject Micro-Burst Congestion';
      burstBtn.className = metrics.isBurst ? 'secondary-button' : 'primary-button';
    }

    // Update compact chart on dashboard card if present
    const cardChart = document.getElementById('dashboardRocev2Chart');
    if (cardChart) {
      cardChart.innerHTML = renderRocev2DiagramSvg(metrics, { isDark, compact: true });
    }
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.showModal === 'function') {
          modal.showModal();
        } else {
          modal.setAttribute('open', '');
        }
        updateUi();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) {
        if (typeof modal.close === 'function') {
          modal.close();
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        if (typeof modal.close === 'function') {
          modal.close();
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  if (clusterSelect) {
    clusterSelect.addEventListener('change', () => {
      setRocev2SelectedClusterId(clusterSelect.value);
      if (speedSelect) speedSelect.value = getRocev2LinkSpeedGbps();
      updateUi();
    });
  }

  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      setRocev2LinkSpeedGbps(speedSelect.value);
      updateUi();
    });
  }

  if (kminInput) {
    kminInput.addEventListener('input', () => {
      setRocev2EcnKminKb(kminInput.value);
      updateUi();
    });
  }

  if (kmaxInput) {
    kmaxInput.addEventListener('input', () => {
      setRocev2EcnKmaxKb(kmaxInput.value);
      updateUi();
    });
  }

  if (burstBtn) {
    burstBtn.addEventListener('click', () => {
      const active = getRocev2CongestionBurst();
      setRocev2CongestionBurst(!active);
      updateUi();
      if (options.onToast) {
        options.onToast(!active ? 'Micro-burst congestion injected into RoCEv2 queue.' : 'Congestion baseline restored.');
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetRocev2SimState();
      if (clusterSelect) clusterSelect.value = getRocev2SelectedClusterId();
      if (speedSelect) speedSelect.value = getRocev2LinkSpeedGbps();
      if (kminInput) kminInput.value = getRocev2EcnKminKb();
      if (kmaxInput) kmaxInput.value = getRocev2EcnKmaxKb();
      updateUi();
      if (options.onToast) {
        options.onToast('RoCEv2 parameters reset to factory baseline.');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const metrics = calculateRocev2Metrics(state);
      const report = generateRocev2Report(metrics);
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(report).then(() => {
          if (options.onToast) options.onToast('RoCEv2 audit report copied to clipboard.');
        }).catch(() => {
          prompt('Copy RoCEv2 Audit Report:', report);
        });
      } else {
        prompt('Copy RoCEv2 Audit Report:', report);
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const metrics = calculateRocev2Metrics(state);
      exportRocev2Json(metrics);
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const metrics = calculateRocev2Metrics(state);
      exportRocev2Csv(metrics);
    });
  }

  // Initial render
  updateUi();
}
