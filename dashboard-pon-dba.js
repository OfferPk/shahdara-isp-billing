import { formatPKR } from './core.js';

/**
 * OLT PON Port Dynamic Bandwidth Allocation (DBA) & Upstream/Downstream TDM Latency Queue Estimator
 * Models downstream TDM broadcast (1490nm/1577nm) and upstream TDMA burst scheduling (1310nm/1270nm)
 * coordinated by Optical Line Terminal (OLT) DBA algorithms across Shahdara FTTH distribution hubs.
 * Simulates Status-Reporting DBA (SR-DBA, ITU-T G.984.3 / G.9807.1 DBRu buffer occupancy) vs
 * Non-Status-Reporting DBA (NSR-DBA) and Hybrid DBA scheduling latency, T-CONT grant queues,
 * serialization delays, round-trip propagation times, jitter distribution, and SLA latency breach risk.
 */

export const SHAHDARA_PON_PORTS = [
  {
    id: 'pon-st-01',
    name: 'Shahdara Town Central OLT-01 PON-1',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    standard: 'GPON (ITU-T G.984)',
    splitRatio: '1:64',
    maxLogicalOnus: 64,
    downstreamRateMbps: 2488, // 2.488 Gbps
    upstreamRateMbps: 1244,   // 1.244 Gbps
    fiberDistanceKm: 4.8,
    defaultDbaMode: 'SR-DBA',
    defaultCyclePeriodMs: 1.0, // 8x 125µs frames per cycle
    defaultConcurrencyLoad: 65, // 65% peak concurrent traffic
    slaLatencyThresholdMs: 15.0,
    bufferSizeKbPerOnu: 256
  },
  {
    id: 'pon-br-02',
    name: 'Baradari Road Feeder OLT-01 PON-2',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    standard: 'GPON (ITU-T G.984)',
    splitRatio: '1:64',
    maxLogicalOnus: 64,
    downstreamRateMbps: 2488,
    upstreamRateMbps: 1244,
    fiberDistanceKm: 6.2,
    defaultDbaMode: 'SR-DBA',
    defaultCyclePeriodMs: 1.25, // 10x 125µs frames
    defaultConcurrencyLoad: 72,
    slaLatencyThresholdMs: 15.0,
    bufferSizeKbPerOnu: 256
  },
  {
    id: 'pon-vr-03',
    name: 'Vandala Industrial Trunk OLT-02 PON-1',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    standard: 'XGS-PON (ITU-T G.9807.1)',
    splitRatio: '1:128',
    maxLogicalOnus: 128,
    downstreamRateMbps: 9953, // 10 Gbps symmetrical
    upstreamRateMbps: 9953,
    fiberDistanceKm: 8.5,
    defaultDbaMode: 'SR-DBA',
    defaultCyclePeriodMs: 1.0,
    defaultConcurrencyLoad: 55,
    slaLatencyThresholdMs: 10.0,
    bufferSizeKbPerOnu: 512
  },
  {
    id: 'pon-jm-04',
    name: 'Jia Musa High-Density OLT-02 PON-3',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    standard: 'GPON (ITU-T G.984)',
    splitRatio: '1:32',
    maxLogicalOnus: 32,
    downstreamRateMbps: 2488,
    upstreamRateMbps: 1244,
    fiberDistanceKm: 3.5,
    defaultDbaMode: 'NSR-DBA',
    defaultCyclePeriodMs: 2.0,
    defaultConcurrencyLoad: 85,
    slaLatencyThresholdMs: 20.0,
    bufferSizeKbPerOnu: 128
  },
  {
    id: 'pon-sp-05',
    name: 'Saeed Park Highway Spur OLT-03 PON-1',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Rehman Park'],
    standard: 'GPON (ITU-T G.984)',
    splitRatio: '1:64',
    maxLogicalOnus: 64,
    downstreamRateMbps: 2488,
    upstreamRateMbps: 1244,
    fiberDistanceKm: 5.4,
    defaultDbaMode: 'SR-DBA',
    defaultCyclePeriodMs: 1.0,
    defaultConcurrencyLoad: 50,
    slaLatencyThresholdMs: 15.0,
    bufferSizeKbPerOnu: 256
  },
  {
    id: 'pon-ot-06',
    name: 'Main Bazaar Commercial Hub OLT-03 PON-2',
    primaryArea: 'Main Bazaar',
    aliasAreas: ['Main Bazaar', 'Commercial Market'],
    standard: 'GPON (ITU-T G.984)',
    splitRatio: '1:64',
    maxLogicalOnus: 64,
    downstreamRateMbps: 2488,
    upstreamRateMbps: 1244,
    fiberDistanceKm: 2.8,
    defaultDbaMode: 'SR-DBA',
    defaultCyclePeriodMs: 1.0,
    defaultConcurrencyLoad: 60,
    slaLatencyThresholdMs: 15.0,
    bufferSizeKbPerOnu: 256
  }
];

let selectedPonPortId = 'pon-st-01';
let simulatedDbaMode = null; // 'SR-DBA' | 'NSR-DBA' | 'Hybrid-DBA' | null
let simulatedConcurrencyLoad = null; // 20 - 100 | null
let simulatedCyclePeriodMs = null; // 0.5 - 5.0 | null

export function getPonDbaSelectedPort() {
  return selectedPonPortId;
}

export function setPonDbaSelectedPort(portId) {
  if (SHAHDARA_PON_PORTS.some((p) => p.id === portId)) {
    selectedPonPortId = portId;
  }
}

export function getPonDbaMode() {
  return simulatedDbaMode;
}

export function setPonDbaMode(mode) {
  if (['SR-DBA', 'NSR-DBA', 'Hybrid-DBA'].includes(mode)) {
    simulatedDbaMode = mode;
  } else {
    simulatedDbaMode = null;
  }
}

export function getPonDbaConcurrency() {
  return simulatedConcurrencyLoad;
}

export function setPonDbaConcurrency(val) {
  const parsed = Number(val);
  if (!Number.isNaN(parsed) && parsed >= 20 && parsed <= 100) {
    simulatedConcurrencyLoad = Math.round(parsed);
  } else {
    simulatedConcurrencyLoad = null;
  }
}

export function getPonDbaCyclePeriod() {
  return simulatedCyclePeriodMs;
}

export function setPonDbaCyclePeriod(val) {
  const parsed = Number(val);
  if (!Number.isNaN(parsed) && parsed >= 0.5 && parsed <= 5.0) {
    simulatedCyclePeriodMs = Math.round(parsed * 100) / 100;
  } else {
    simulatedCyclePeriodMs = null;
  }
}

/**
 * Calculates optical propagation delay in singlemode silica optical fiber (SMF-28)
 * Speed of light in fiber c/n ≈ 300,000 / 1.4682 ≈ 204.3 km/ms = 4.89 µs/km.
 * One-way propagation delay T_prop = fiberDistanceKm * 0.00489 (ms).
 * Round trip time (RTT) = 2 * T_prop.
 */
export function calculateOpticalPropagationDelay(distanceKm) {
  const dist = Math.max(0.1, Number(distanceKm) || 0.1);
  const oneWayMs = Math.round(dist * 0.004893 * 10000) / 10000;
  const rttMs = Math.round(oneWayMs * 2 * 10000) / 10000;
  return { oneWayMs, rttMs };
}

/**
 * Calculates Dynamic Bandwidth Allocation (DBA) queue latency, grant burst pacing,
 * and packet drop probability.
 *
 * Latency components:
 * 1. Propagation delay: T_prop (from fiber physical distance)
 * 2. DBA scheduling turnaround delay:
 *    - SR-DBA: Request in DBRu -> OLT scheduling frame -> BWmap grant -> Burst transmission.
 *      T_grant ≈ 1.5 * cyclePeriodMs + RTT.
 *    - NSR-DBA: Autonomous traffic arrival estimation without waiting for DBRu report.
 *      T_grant ≈ 0.8 * cyclePeriodMs + non-linear lag penalty when concurrency > 75%.
 *    - Hybrid-DBA: Adaptive blend prioritizing low-latency T-CONT 1/2 with predictive grants.
 *      T_grant ≈ 1.1 * cyclePeriodMs + 0.5 * RTT.
 * 3. M/G/1 queueing delay:
 *    T_queue = (Rho / (1 - Rho)) * (cyclePeriodMs * 0.35)
 * 4. P99 Latency & Jitter modeling:
 *    P99 ≈ T_avg * (1 + 2.326 * sqrt(Rho))
 *    Jitter ≈ (P99 - T_avg) * 0.45
 * 5. Buffer overrun drop rate:
 *    When Rho > 0.85, buffer drop begins exponentially.
 */
export function calculateDbaQueueDynamics(ponPort, {
  dbaMode,
  concurrencyLoad,
  cyclePeriodMs,
  activeSubscriberCount = 0,
  totalBilledRevenue = 0
} = {}) {
  const port = ponPort || SHAHDARA_PON_PORTS[0];
  const effectiveMode = dbaMode || port.defaultDbaMode;
  const effectiveConcurrency = concurrencyLoad !== null && concurrencyLoad !== undefined
    ? Number(concurrencyLoad)
    : port.defaultConcurrencyLoad;
  const effectiveCycle = cyclePeriodMs !== null && cyclePeriodMs !== undefined
    ? Number(cyclePeriodMs)
    : port.defaultCyclePeriodMs;

  const prop = calculateOpticalPropagationDelay(port.fiberDistanceKm);

  // Determine active ONUs & upstream demand
  const activeCount = Math.max(1, Number(activeSubscriberCount) || 1);
  const avgUpstreamPerOnuMbps = port.standard.includes('XGS') ? 60 : 15;
  const totalSubscribedUpstreamMbps = activeCount * avgUpstreamPerOnuMbps;
  const concurrencyFraction = effectiveConcurrency / 100;
  const offeredTrafficMbps = Math.round(totalSubscribedUpstreamMbps * concurrencyFraction * 10) / 10;

  // Traffic intensity Rho (0.1 to 0.98 cap)
  const rawRho = offeredTrafficMbps / port.upstreamRateMbps;
  const rho = Math.min(0.98, Math.max(0.12, Math.round(rawRho * 1000) / 1000));
  const utilizationPct = Math.round(rho * 100);

  // DBA scheduling turnaround delay (ms)
  let schedulingDelayMs = 0;
  if (effectiveMode === 'SR-DBA') {
    schedulingDelayMs = 1.5 * effectiveCycle + prop.rttMs;
  } else if (effectiveMode === 'NSR-DBA') {
    const lagPenalty = effectiveConcurrency > 75 ? (effectiveConcurrency - 75) * 0.08 : 0;
    schedulingDelayMs = 0.85 * effectiveCycle + lagPenalty;
  } else {
    // Hybrid-DBA
    schedulingDelayMs = 1.1 * effectiveCycle + 0.5 * prop.rttMs;
  }

  // Queueing delay M/G/1
  const queueDelayMs = (rho / (1 - rho)) * (effectiveCycle * 0.38);

  // One-way and Round-trip average latency
  const avgOneWayLatencyMs = Math.round((prop.oneWayMs + schedulingDelayMs + queueDelayMs) * 100) / 100;
  const avgRttLatencyMs = Math.round((prop.rttMs + 2 * (schedulingDelayMs + queueDelayMs)) * 100) / 100;

  // 99th Percentile Latency (P99)
  const p99LatencyMs = Math.round((avgOneWayLatencyMs * (1 + 2.15 * Math.sqrt(rho))) * 100) / 100;

  // Jitter (variance)
  const jitterMs = Math.round(Math.max(0.25, (p99LatencyMs - avgOneWayLatencyMs) * 0.42) * 100) / 100;

  // Buffer overrun packet drop rate (%)
  let dropRatePct = 0;
  if (rho > 0.85) {
    const excess = (rho - 0.85) / 0.15;
    dropRatePct = Math.min(14.5, Math.round(Math.pow(excess, 2) * 5.8 * 100) / 100);
  }

  // T-CONT bandwidth allocation distribution (ITU-T G.984.3 / G.9807.1)
  // T-CONT 1: Fixed bandwidth (VoIP / High SLA management)
  // T-CONT 2: Assured bandwidth (Enterprise / Business Tier)
  // T-CONT 3: Assured + Non-Assured (Premium residential)
  // T-CONT 4: Best Effort (Standard residential)
  const tcontDistribution = [
    { type: 'T-CONT 1', label: 'Fixed Guaranteed (VoIP/SLA)', sharePct: 15, color: '#10b981' },
    { type: 'T-CONT 2', label: 'Assured Dedicated', sharePct: 25, color: '#3b82f6' },
    { type: 'T-CONT 3', label: 'Assured + Non-Assured', sharePct: 30, color: '#8b5cf6' },
    { type: 'T-CONT 4', label: 'Best-Effort Contention', sharePct: 30, color: '#f59e0b' }
  ];

  // SLA status evaluation
  const slaThreshold = port.slaLatencyThresholdMs;
  let status = 'OPTIMAL';
  let statusLabel = 'Optimal Latency';
  let badgeClass = 'badge-success';
  let revenueRiskFactor = 0;

  if (avgOneWayLatencyMs > slaThreshold || dropRatePct >= 2.0 || rho >= 0.90) {
    status = 'CRITICAL';
    statusLabel = 'Critical Buffer Overrun';
    badgeClass = 'badge-danger';
    revenueRiskFactor = 1.0;
  } else if (avgOneWayLatencyMs > slaThreshold * 0.72 || dropRatePct >= 0.4 || rho >= 0.78) {
    status = 'ELEVATED';
    statusLabel = 'Elevated Contention';
    badgeClass = 'badge-warning';
    revenueRiskFactor = 0.35;
  }

  const atRiskRevenue = Math.round(totalBilledRevenue * revenueRiskFactor);

  return {
    port,
    effectiveMode,
    effectiveConcurrency,
    effectiveCycle,
    propagation: prop,
    activeCount,
    offeredTrafficMbps,
    utilizationPct,
    rho,
    schedulingDelayMs: Math.round(schedulingDelayMs * 100) / 100,
    queueDelayMs: Math.round(queueDelayMs * 100) / 100,
    avgOneWayLatencyMs,
    avgRttLatencyMs,
    p99LatencyMs,
    jitterMs,
    dropRatePct,
    slaThresholdMs: slaThreshold,
    status,
    statusLabel,
    badgeClass,
    atRiskRevenue,
    tcontDistribution
  };
}

/**
 * Normalizes text string for fuzzy / case-insensitive area matching.
 */
function normalizeText(txt) {
  return String(txt || '').trim().toLowerCase();
}

/**
 * Calculates comprehensive PON DBA metrics across all Shahdara corridors.
 */
export function calculatePonDbaMetrics(state, options = {}) {
  const {
    portId = selectedPonPortId,
    modeOverride = simulatedDbaMode,
    concurrencyOverride = simulatedConcurrencyLoad,
    cycleOverride = simulatedCyclePeriodMs,
    referenceDate = '2026-10-16'
  } = options;

  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const bills = Array.isArray(state?.bills) ? state.bills : [];

  // Match customers to areas
  const portEvaluations = SHAHDARA_PON_PORTS.map((port) => {
    const areaAliases = port.aliasAreas.map(normalizeText);

    // Find customers belonging to this PON corridor
    const matchedCustomers = customers.filter((c) => {
      const cArea = normalizeText(c.area || c.mohalla || '');
      return areaAliases.some((alias) => cArea.includes(alias) || alias.includes(cArea));
    });

    const activeSubscribers = matchedCustomers.filter((c) => c.status !== 'archived' && c.status !== 'Offline');
    const subscriberCount = matchedCustomers.length;
    const activeCount = activeSubscribers.length;

    // Monthly revenue snapshot
    const refMonth = referenceDate.slice(0, 7);
    let corridorBilled = 0;
    matchedCustomers.forEach((c) => {
      const b = bills.find((bill) => bill.customerId === c.id && bill.month === refMonth);
      if (b && typeof b.amount === 'number') {
        corridorBilled += b.amount;
      } else {
        // Fallback default tier ARPU
        corridorBilled += (c.planRate || 2200);
      }
    });

    const isSelected = port.id === portId;
    const mode = isSelected && modeOverride ? modeOverride : port.defaultDbaMode;
    const concurrency = isSelected && concurrencyOverride !== null && concurrencyOverride !== undefined
      ? concurrencyOverride
      : port.defaultConcurrencyLoad;
    const cycle = isSelected && cycleOverride !== null && cycleOverride !== undefined
      ? cycleOverride
      : port.defaultCyclePeriodMs;

    const dynamics = calculateDbaQueueDynamics(port, {
      dbaMode: mode,
      concurrencyLoad: concurrency,
      cyclePeriodMs: cycle,
      activeSubscriberCount: activeCount > 0 ? activeCount : Math.round(port.maxLogicalOnus * 0.65),
      totalBilledRevenue: corridorBilled
    });

    return {
      port,
      isSelected,
      matchedCustomerCount: subscriberCount,
      activeCustomerCount: activeCount,
      billedRevenue: corridorBilled,
      dynamics
    };
  });

  const selectedEvaluation = portEvaluations.find((e) => e.port.id === portId) || portEvaluations[0];

  // Aggregate summary
  let totalSubscribers = 0;
  let totalActiveOnus = 0;
  let totalNetworkBilled = 0;
  let totalAtRiskRevenue = 0;
  let criticalPortCount = 0;
  let elevatedPortCount = 0;
  let optimalPortCount = 0;

  portEvaluations.forEach((pe) => {
    totalSubscribers += pe.matchedCustomerCount;
    totalActiveOnus += pe.activeCustomerCount;
    totalNetworkBilled += pe.billedRevenue;
    totalAtRiskRevenue += pe.dynamics.atRiskRevenue;

    if (pe.dynamics.status === 'CRITICAL') criticalPortCount++;
    else if (pe.dynamics.status === 'ELEVATED') elevatedPortCount++;
    else optimalPortCount++;
  });

  return {
    selectedPort: selectedEvaluation.port,
    selectedDynamics: selectedEvaluation.dynamics,
    selectedEvaluation,
    portEvaluations,
    summary: {
      totalPorts: SHAHDARA_PON_PORTS.length,
      totalSubscribers,
      totalActiveOnus,
      totalNetworkBilled,
      totalAtRiskRevenue,
      criticalPortCount,
      elevatedPortCount,
      optimalPortCount
    }
  };
}

/**
 * Pure SVG Renderer for PON DBA Frame Burst Schedule & Latency Queue Distribution.
 * Produces interactive, responsive, lightweight, dependency-free SVG graphics.
 */
export function renderPonDbaQueueSvg(data, options = {}) {
  if (!data || !data.selectedDynamics) {
    return `<div class="chart-empty-state"><p>No PON DBA metrics recorded for this corridor.</p></div>`;
  }

  const { selectedDynamics, selectedPort } = data;
  const d = selectedDynamics;
  const isCompact = options.compact === true;

  const width = isCompact ? 360 : 780;
  const height = isCompact ? 220 : 360;

  // Status color mapping
  const statusColor = d.status === 'CRITICAL' ? '#ef4444' : d.status === 'ELEVATED' ? '#f59e0b' : '#10b981';
  const statusBg = d.status === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : d.status === 'ELEVATED' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)';

  if (isCompact) {
    // Compact preview card version for main dashboard view
    const gaugePercent = Math.min(100, Math.round((d.avgOneWayLatencyMs / (d.slaThresholdMs * 1.5)) * 100));
    const gaugeStrokeDash = Math.round((gaugePercent / 100) * 220);

    return `
      <svg class="chart-svg pon-dba-svg compact-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OLT PON DBA Latency Gauge">
        <rect width="${width}" height="${height}" rx="8" fill="var(--surface, #ffffff)" />

        <!-- Header -->
        <text x="16" y="26" font-size="13" font-weight="700" fill="var(--ink, #182e2a)">${selectedPort.name}</text>
        <rect x="${width - 110}" y="12" width="94" height="20" rx="4" fill="${statusBg}" />
        <text x="${width - 63}" y="26" font-size="10" font-weight="700" fill="${statusColor}" text-anchor="middle">${d.status}</text>

        <!-- Semicircular / Arc Gauge -->
        <g transform="translate(180, 115)">
          <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="var(--border, #e2e8f0)" stroke-width="14" stroke-linecap="round" />
          <path d="M -90 0 A 90 90 0 0 1 90 0" fill="none" stroke="${statusColor}" stroke-width="14" stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="${Math.max(0, 283 - (gaugePercent * 2.83))}" />
          
          <text x="0" y="-12" font-size="24" font-weight="800" fill="var(--ink, #182e2a)" text-anchor="middle">${d.avgOneWayLatencyMs} ms</text>
          <text x="0" y="8" font-size="10" fill="var(--muted, #64748b)" text-anchor="middle">Avg 1-Way Latency</text>
          <text x="0" y="24" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">SLA: &lt; ${d.slaThresholdMs} ms | ${d.effectiveMode}</text>
        </g>

        <!-- Quick Mini Stats -->
        <g transform="translate(16, 175)">
          <!-- Stat 1 -->
          <rect x="0" y="0" width="102" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="51" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Utilization (ρ)</text>
          <text x="51" y="28" font-size="11" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="middle">${d.utilizationPct}%</text>

          <!-- Stat 2 -->
          <rect x="112" y="0" width="102" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="163" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">P99 Jitter</text>
          <text x="163" y="28" font-size="11" font-weight="700" fill="var(--ink, #182e2a)" text-anchor="middle">±${d.jitterMs} ms</text>

          <!-- Stat 3 -->
          <rect x="224" y="0" width="104" height="34" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
          <text x="276" y="14" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">Packet Drop</text>
          <text x="276" y="28" font-size="11" font-weight="700" fill="${d.dropRatePct > 0 ? '#ef4444' : '#10b981'}" text-anchor="middle">${d.dropRatePct}%</text>
        </g>
      </svg>
    `;
  }

  // Full High-Detail Modal SVG with TDMA Burst Gantt & Latency Distribution Curve
  return `
    <svg class="chart-svg pon-dba-svg full-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OLT PON DBA Upstream Burst Schedule & Latency Distribution">
      <defs>
        <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${statusColor}" stop-opacity="0.35" />
          <stop offset="100%" stop-color="${statusColor}" stop-opacity="0.02" />
        </linearGradient>
      </defs>

      <rect width="${width}" height="${height}" rx="10" fill="var(--surface, #ffffff)" stroke="var(--border, #e2e8f0)" />

      <!-- Title & Header Bar -->
      <text x="24" y="32" font-size="15" font-weight="800" fill="var(--ink, #182e2a)">${selectedPort.name} - Upstream TDMA Burst Timeline</text>
      <text x="24" y="49" font-size="11" fill="var(--muted, #64748b)">Standard: ${selectedPort.standard} | Split: ${selectedPort.splitRatio} | Distance: ${selectedPort.fiberDistanceKm} km (${d.propagation.rttMs} ms RTT)</text>
      
      <rect x="${width - 130}" y="18" width="106" height="24" rx="5" fill="${statusBg}" />
      <text x="${width - 77}" y="34" font-size="11" font-weight="800" fill="${statusColor}" text-anchor="middle">${d.status}</text>

      <!-- SECTION 1: Upstream TDMA T-CONT Frame Allocation Timeline (Y: 65 to 145) -->
      <g transform="translate(24, 65)">
        <text x="0" y="14" font-size="12" font-weight="700" fill="var(--ink, #182e2a)">125µs GPON Frame Burst Horizon (${d.effectiveMode} | Cycle: ${d.effectiveCycle} ms)</text>
        
        <!-- Frame background timeline track -->
        <rect x="0" y="24" width="732" height="34" rx="4" fill="var(--bg-soft, #f1f5f9)" stroke="var(--border, #cbd5e1)" />
        
        <!-- Preamble / Guard time -->
        <rect x="2" y="26" width="28" height="30" rx="3" fill="#64748b" opacity="0.7" />
        <text x="16" y="45" font-size="9" fill="#ffffff" text-anchor="middle" font-weight="600">Guard</text>

        <!-- T-CONT 1: Fixed Guaranteed (VoIP / Management) -->
        <rect x="32" y="26" width="108" height="30" rx="3" fill="#10b981" />
        <text x="86" y="45" font-size="10" fill="#ffffff" text-anchor="middle" font-weight="700">T-CONT 1 (Fixed)</text>

        <!-- T-CONT 2: Assured Bandwidth -->
        <rect x="142" y="26" width="180" height="30" rx="3" fill="#3b82f6" />
        <text x="232" y="45" font-size="10" fill="#ffffff" text-anchor="middle" font-weight="700">T-CONT 2 (Assured)</text>

        <!-- T-CONT 3: Assured + Non-Assured -->
        <rect x="324" y="26" width="216" height="30" rx="3" fill="#8b5cf6" />
        <text x="432" y="45" font-size="10" fill="#ffffff" text-anchor="middle" font-weight="700">T-CONT 3 (Non-Assured)</text>

        <!-- T-CONT 4: Best-Effort Elastic Contention -->
        <rect x="542" y="26" width="188" height="30" rx="3" fill="${d.utilizationPct > 80 ? '#f59e0b' : '#38bdf8'}" />
        <text x="636" y="45" font-size="10" fill="#ffffff" text-anchor="middle" font-weight="700">T-CONT 4 (Best Effort)</text>

        <!-- Timing Axis ticks -->
        <text x="0" y="70" font-size="9" fill="var(--muted, #64748b)">0 µs (BWmap Grant)</text>
        <text x="366" y="70" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">62.5 µs Burst Midpoint</text>
        <text x="732" y="70" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">125 µs Frame Boundary</text>
      </g>

      <!-- SECTION 2: Latency Distribution Curve & SLA Boundary (Y: 165 to 300) -->
      <g transform="translate(24, 165)">
        <text x="0" y="14" font-size="12" font-weight="700" fill="var(--ink, #182e2a)">Queue Delay &amp; Latency Horizon (M/G/1 Contention Model)</text>

        <!-- Chart Grid Lines -->
        <line x1="40" y1="26" x2="732" y2="26" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="62" x2="732" y2="62" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="98" x2="732" y2="98" stroke="var(--border, #e2e8f0)" stroke-dasharray="3,3" />
        <line x1="40" y1="120" x2="732" y2="120" stroke="var(--border, #cbd5e1)" />

        <!-- Y-Axis labels -->
        <text x="32" y="29" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">30ms</text>
        <text x="32" y="65" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">20ms</text>
        <text x="32" y="101" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">10ms</text>
        <text x="32" y="123" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">0ms</text>

        <!-- SLA Threshold Line -->
        ${(() => {
          const slaY = Math.max(26, 120 - (d.slaThresholdMs / 30) * 94);
          return `
            <line x1="40" y1="${slaY}" x2="732" y2="${slaY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,4" />
            <text x="732" y="${slaY - 4}" font-size="9" font-weight="700" fill="#ef4444" text-anchor="end">SLA Latency Cap (${d.slaThresholdMs} ms)</text>
          `;
        })()}

        <!-- Latency Curve Area & Line -->
        ${(() => {
          // Generate realistic Poisson / queue curve points
          const points = [];
          const numSteps = 16;
          for (let i = 0; i <= numSteps; i++) {
            const t = i / numSteps;
            const x = 40 + t * 692;
            // Simulated queue progression under traffic load
            const curveFactor = Math.pow(t, 2.2) * (d.avgOneWayLatencyMs / 30);
            const valMs = Math.min(30, (d.propagation.oneWayMs + d.schedulingDelayMs * 0.3) + curveFactor * 26);
            const y = Math.max(24, 120 - (valMs / 30) * 94);
            points.push({ x, y });
          }

          const pathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          const areaD = `${pathD} L 732 120 L 40 120 Z`;

          const avgX = 40 + 0.65 * 692;
          const avgY = Math.max(26, 120 - (d.avgOneWayLatencyMs / 30) * 94);

          return `
            <path d="${areaD}" fill="url(#latencyGradient)" />
            <path d="${pathD}" fill="none" stroke="${statusColor}" stroke-width="2.5" />
            
            <!-- Avg Latency Marker Point -->
            <circle cx="${avgX}" cy="${avgY}" r="5" fill="${statusColor}" stroke="#ffffff" stroke-width="2" />
            <rect x="${avgX - 60}" y="${avgY - 26}" width="120" height="20" rx="3" fill="var(--ink, #182e2a)" opacity="0.85" />
            <text x="${avgX}" y="${avgY - 13}" font-size="10" font-weight="700" fill="#ffffff" text-anchor="middle">Avg: ${d.avgOneWayLatencyMs} ms</text>
          `;
        })()}

        <!-- X-Axis Labels -->
        <text x="40" y="134" font-size="9" fill="var(--muted, #64748b)">0% Frame Load</text>
        <text x="386" y="134" font-size="9" fill="var(--muted, #64748b)" text-anchor="middle">50% Frame Load</text>
        <text x="732" y="134" font-size="9" fill="var(--muted, #64748b)" text-anchor="end">100% Saturation</text>
      </g>

      <!-- Bottom Summary Metric Badges (Y: 316 to 348) -->
      <g transform="translate(24, 316)">
        <rect x="0" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="10" y="14" font-size="8.5" fill="var(--muted, #64748b)">Round-Trip RTT:</text>
        <text x="10" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">${d.avgRttLatencyMs} ms</text>

        <rect x="146" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="156" y="14" font-size="8.5" fill="var(--muted, #64748b)">P99 Tail Latency:</text>
        <text x="156" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">${d.p99LatencyMs} ms</text>

        <rect x="292" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="302" y="14" font-size="8.5" fill="var(--muted, #64748b)">Jitter Variance:</text>
        <text x="302" y="26" font-size="11" font-weight="700" fill="var(--ink, #182e2a)">±${d.jitterMs} ms</text>

        <rect x="438" y="0" width="138" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="448" y="14" font-size="8.5" fill="var(--muted, #64748b)">Buffer Drop Rate:</text>
        <text x="448" y="26" font-size="11" font-weight="700" fill="${d.dropRatePct > 0 ? '#ef4444' : '#10b981'}">${d.dropRatePct}%</text>

        <rect x="584" y="0" width="148" height="32" rx="4" fill="var(--bg-soft, #f8fafc)" stroke="var(--border, #e2e8f0)" />
        <text x="594" y="14" font-size="8.5" fill="var(--muted, #64748b)">SLA At-Risk Revenue:</text>
        <text x="594" y="26" font-size="11" font-weight="700" fill="${d.atRiskRevenue > 0 ? '#ef4444' : '#10b981'}">${formatPKR(d.atRiskRevenue)}</text>
      </g>
    </svg>
  `;
}

/**
 * Generates plain-text dispatch/briefing report for operations engineers and executive briefings.
 */
export function generatePonDbaReport(data, referenceDate = '2026-10-16') {
  if (!data || !data.selectedDynamics) return 'No PON DBA diagnostics available.';

  const { selectedPort, selectedDynamics, summary, portEvaluations } = data;
  const d = selectedDynamics;

  let out = '';
  out += '========================================================================\n';
  out += '   SHAHDARA FTTH OLT PON PORT DBA & TDM LATENCY QUEUE AUDIT REPORT\n';
  out += `   Generated: ${referenceDate} PKT | Target Corridor: ${selectedPort.name}\n`;
  out += '========================================================================\n\n';

  out += '1. CORRIDOR OPTICAL & PON PROFILE:\n';
  out += `   - Corridor ID: ${selectedPort.id}\n`;
  out += `   - Serving Substation / Area: ${selectedPort.primaryArea}\n`;
  out += `   - Optical Standard: ${selectedPort.standard}\n`;
  out += `   - Downstream Broadcast Rate: ${selectedPort.downstreamRateMbps} Mbps (TDM 1490nm)\n`;
  out += `   - Upstream Burst Rate: ${selectedPort.upstreamRateMbps} Mbps (TDMA 1310nm)\n`;
  out += `   - Optical Splitter Ratio: ${selectedPort.splitRatio} (Max ${selectedPort.maxLogicalOnus} ONUs)\n`;
  out += `   - Feeder Fiber Span: ${selectedPort.fiberDistanceKm} km\n`;
  out += `   - Single-trip Optical Propagation: ${d.propagation.oneWayMs} ms (RTT: ${d.propagation.rttMs} ms)\n\n`;

  out += '2. DYNAMIC BANDWIDTH ALLOCATION (DBA) & QUEUE TELEMETRY:\n';
  out += `   - Operational DBA Algorithm: ${d.effectiveMode}\n`;
  out += `   - Scheduling Allocation Cycle: ${d.effectiveCycle} ms\n`;
  out += `   - Upstream Concurrency Load: ${d.effectiveConcurrency}%\n`;
  out += `   - Active Connected ONUs: ${d.activeCount}\n`;
  out += `   - Offered Upstream Throughput: ${d.offeredTrafficMbps} Mbps\n`;
  out += `   - PON Upstream Utilization (ρ): ${d.utilizationPct}%\n`;
  out += `   - DBA Scheduling Turnaround: ${d.schedulingDelayMs} ms\n`;
  out += `   - M/G/1 Buffer Queue Delay: ${d.queueDelayMs} ms\n`;
  out += `   - Blended One-Way Latency: ${d.avgOneWayLatencyMs} ms\n`;
  out += `   - Blended Round-Trip Latency: ${d.avgRttLatencyMs} ms\n`;
  out += `   - Tail P99 Latency: ${d.p99LatencyMs} ms\n`;
  out += `   - Jitter Variance: ±${d.jitterMs} ms\n`;
  out += `   - Buffer Overrun Drop Rate: ${d.dropRatePct}%\n`;
  out += `   - SLA Latency Threshold: < ${d.slaThresholdMs} ms\n`;
  out += `   - Operational Health Status: [ ${d.status} ] - ${d.statusLabel}\n`;
  out += `   - Corridor Monthly Billed Revenue: ${formatPKR(data.selectedEvaluation.billedRevenue)}\n`;
  out += `   - Latency-Impacted At-Risk Revenue: ${formatPKR(d.atRiskRevenue)}\n\n`;

  out += '3. T-CONT BANDWIDTH RESERVATION SPLIT:\n';
  d.tcontDistribution.forEach((tc) => {
    out += `   * [${tc.type}] ${tc.label}: ${tc.sharePct}% guaranteed quota\n`;
  });
  out += '\n';

  out += '4. ALL SHAHDARA OLT PON CORRIDORS PORTFOLIO ROLLUP:\n';
  out += `   - Monitored Corridors: ${summary.totalPorts}\n`;
  out += `   - Health Breakdown: ${summary.optimalPortCount} Optimal, ${summary.elevatedPortCount} Elevated, ${summary.criticalPortCount} Critical\n`;
  out += `   - Total Network Billed Revenue: ${formatPKR(summary.totalNetworkBilled)}\n`;
  out += `   - Total Network At-Risk Revenue: ${formatPKR(summary.totalAtRiskRevenue)}\n\n`;

  out += '   Corridor Comparison Table:\n';
  out += '   ---------------------------------------------------------------------\n';
  out += '   Port ID    | Primary Area      | Latency | P99 Jitter | Util  | Status\n';
  out += '   ---------------------------------------------------------------------\n';
  portEvaluations.forEach((pe) => {
    const dyn = pe.dynamics;
    const padPort = pe.port.id.padEnd(10, ' ');
    const padArea = pe.port.primaryArea.padEnd(17, ' ');
    const padLat = `${dyn.avgOneWayLatencyMs}ms`.padEnd(9, ' ');
    const padJit = `±${dyn.jitterMs}ms`.padEnd(12, ' ');
    const padUtil = `${dyn.utilizationPct}%`.padEnd(7, ' ');
    out += `   ${padPort} | ${padArea} | ${padLat} | ${padJit} | ${padUtil} | ${dyn.status}\n`;
  });
  out += '   ---------------------------------------------------------------------\n\n';

  out += '5. ENGINEERING RECOMMENDATIONS:\n';
  if (d.status === 'CRITICAL') {
    out += '   [URGENT] PON upstream contention is causing buffer drops and SLA breach.\n';
    out += '   - Immediate action: Transition from NSR-DBA to SR-DBA with optimized DBRu polling.\n';
    out += '   - Reduce DBA allocation cycle period to 1.0ms or activate 10G XGS-PON overlay split.\n';
    out += '   - Offload high-bandwidth commercial subscribers onto dedicated feeder port.\n';
  } else if (d.status === 'ELEVATED') {
    out += '   [ATTENTION] Peak evening traffic concurrency approaching warning thresholds.\n';
    out += '   - Tune T-CONT 4 best-effort maximum burst limit to prevent jitter on VoIP T-CONT 1.\n';
    out += '   - Schedule optical power budget and micro-splitter audit.\n';
  } else {
    out += '   [HEALTHY] DBA queue scheduling operating well within ITU-T G.984 SLA boundaries.\n';
    out += '   - Maintain standard routine optical power inspections.\n';
  }

  return out;
}

/**
 * Wires the interactive modal dialog for OLT PON DBA diagnostics.
 */
export function setupPonDbaModal(state, options = {}) {
  const {
    referenceDate = '2026-10-16',
    onFilterArea,
    onToast,
    clipboard
  } = options;

  if (typeof document === 'undefined') return;

  const modal = document.getElementById('dashboardPonDbaModal');
  const openBtn = document.getElementById('dashboardOpenPonDbaModalBtn');
  const closeBtn = document.getElementById('dashboardPonDbaModalCloseBtn');

  const portSelect = document.getElementById('ponDbaPortSelect');
  const modeSelect = document.getElementById('ponDbaModeSelect');
  const concurrencySlider = document.getElementById('ponDbaConcurrencySlider');
  const concurrencyVal = document.getElementById('ponDbaConcurrencyVal');
  const cycleSlider = document.getElementById('ponDbaCycleSlider');
  const cycleVal = document.getElementById('ponDbaCycleVal');
  const resetBtn = document.getElementById('ponDbaResetSimBtn');

  const kpiPortName = document.getElementById('ponDbaKpiPortName');
  const kpiLatency = document.getElementById('ponDbaKpiLatency');
  const kpiP99Jitter = document.getElementById('ponDbaKpiP99Jitter');
  const kpiStatusBadge = document.getElementById('ponDbaStatusBadge');
  const kpiRevenueRisk = document.getElementById('ponDbaKpiRevenueRisk');

  const chartWrap = document.getElementById('ponDbaModalChartWrap');
  const tableBody = document.getElementById('ponDbaPortsTableBody');

  const filterAreaBtn = document.getElementById('ponDbaFilterAreaBtn');
  const copyBtn = document.getElementById('dashboardCopyPonDbaReportBtn');

  function refreshModalContent() {
    const data = calculatePonDbaMetrics(state, {
      portId: selectedPonPortId,
      modeOverride: simulatedDbaMode,
      concurrencyOverride: simulatedConcurrencyLoad,
      cycleOverride: simulatedCyclePeriodMs,
      referenceDate
    });

    const d = data.selectedDynamics;
    const port = data.selectedPort;

    if (kpiPortName) {
      kpiPortName.textContent = `${port.name} (${port.splitRatio})`;
    }
    if (kpiLatency) {
      kpiLatency.textContent = `${d.avgOneWayLatencyMs} ms (RTT: ${d.avgRttLatencyMs} ms)`;
    }
    if (kpiP99Jitter) {
      kpiP99Jitter.textContent = `P99: ${d.p99LatencyMs} ms | ±${d.jitterMs} ms`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = d.status;
      kpiStatusBadge.className = `sim-delta-badge ${d.badgeClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(d.atRiskRevenue)} at risk`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderPonDbaQueueSvg(data, { compact: false });
    }

    if (tableBody) {
      tableBody.innerHTML = data.portEvaluations.map((pe) => {
        const dyn = pe.dynamics;
        const isCurrent = pe.port.id === selectedPonPortId;
        const rowClass = isCurrent ? 'table-row-selected' : '';
        return `
          <tr class="${rowClass}">
            <td><strong>${pe.port.name}</strong><br><span style="font-size: 10px; color: var(--muted, #64748b);">${pe.port.standard}</span></td>
            <td>${pe.port.primaryArea}</td>
            <td>${dyn.effectiveMode}</td>
            <td><strong>${dyn.avgOneWayLatencyMs} ms</strong><br><span style="font-size: 10px; color: var(--muted, #64748b);">P99: ${dyn.p99LatencyMs}ms</span></td>
            <td>±${dyn.jitterMs} ms</td>
            <td>${dyn.utilizationPct}%</td>
            <td>${dyn.dropRatePct}%</td>
            <td><span class="sim-delta-badge ${dyn.badgeClass}">${dyn.status}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // Populate port select
  if (portSelect && portSelect.options && portSelect.options.length === 0) {
    SHAHDARA_PON_PORTS.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} - ${p.primaryArea} (${p.splitRatio})`;
      if (p.id === selectedPonPortId) opt.selected = true;
      portSelect.appendChild(opt);
    });
  }

  // Populate mode select
  if (modeSelect && modeSelect.options && modeSelect.options.length === 0) {
    ['SR-DBA', 'NSR-DBA', 'Hybrid-DBA'].forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      modeSelect.appendChild(opt);
    });
  }

  // Open Modal Event
  if (openBtn && !openBtn.dataset.wired) {
    openBtn.dataset.wired = 'true';
    openBtn.addEventListener('click', () => {
      if (portSelect) portSelect.value = selectedPonPortId;
      const initialEval = calculatePonDbaMetrics(state, {
        portId: selectedPonPortId,
        referenceDate
      }).selectedDynamics;

      if (modeSelect) modeSelect.value = initialEval.effectiveMode;
      if (concurrencySlider) concurrencySlider.value = initialEval.effectiveConcurrency;
      if (concurrencyVal) concurrencyVal.textContent = `${initialEval.effectiveConcurrency}%`;
      if (cycleSlider) cycleSlider.value = initialEval.effectiveCycle;
      if (cycleVal) cycleVal.textContent = `${initialEval.effectiveCycle} ms`;

      refreshModalContent();
      if (typeof modal.showModal === 'function') {
        try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
      } else {
        modal.setAttribute('open', '');
      }
    });
  }

  // Close Modal Event
  if (closeBtn && !closeBtn.dataset.wired) {
    closeBtn.dataset.wired = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        try { modal.close(); } catch { modal.removeAttribute('open'); }
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  if (modal && !modal.dataset.backdropWired) {
    modal.dataset.backdropWired = 'true';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal.close === 'function') {
          try { modal.close(); } catch { modal.removeAttribute('open'); }
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  // Port Select Change
  if (portSelect && !portSelect.dataset.wired) {
    portSelect.dataset.wired = 'true';
    portSelect.addEventListener('change', () => {
      setPonDbaSelectedPort(portSelect.value);
      const newEval = calculatePonDbaMetrics(state, { portId: portSelect.value, referenceDate }).selectedDynamics;
      if (modeSelect) modeSelect.value = newEval.effectiveMode;
      if (concurrencySlider) concurrencySlider.value = newEval.effectiveConcurrency;
      if (concurrencyVal) concurrencyVal.textContent = `${newEval.effectiveConcurrency}%`;
      if (cycleSlider) cycleSlider.value = newEval.effectiveCycle;
      if (cycleVal) cycleVal.textContent = `${newEval.effectiveCycle} ms`;
      refreshModalContent();
    });
  }

  // Mode Select Change
  if (modeSelect && !modeSelect.dataset.wired) {
    modeSelect.dataset.wired = 'true';
    modeSelect.addEventListener('change', () => {
      setPonDbaMode(modeSelect.value);
      refreshModalContent();
    });
  }

  // Concurrency Slider Input
  if (concurrencySlider && !concurrencySlider.dataset.wired) {
    concurrencySlider.dataset.wired = 'true';
    concurrencySlider.addEventListener('input', () => {
      setPonDbaConcurrency(concurrencySlider.value);
      if (concurrencyVal) concurrencyVal.textContent = `${concurrencySlider.value}%`;
      refreshModalContent();
    });
  }

  // Cycle Slider Input
  if (cycleSlider && !cycleSlider.dataset.wired) {
    cycleSlider.dataset.wired = 'true';
    cycleSlider.addEventListener('input', () => {
      setPonDbaCyclePeriod(cycleSlider.value);
      if (cycleVal) cycleVal.textContent = `${cycleSlider.value} ms`;
      refreshModalContent();
    });
  }

  // Reset Simulation Button
  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = 'true';
    resetBtn.addEventListener('click', () => {
      setPonDbaMode(null);
      setPonDbaConcurrency(null);
      setPonDbaCyclePeriod(null);
      const resetEval = calculatePonDbaMetrics(state, { portId: selectedPonPortId, referenceDate }).selectedDynamics;
      if (modeSelect) modeSelect.value = resetEval.effectiveMode;
      if (concurrencySlider) concurrencySlider.value = resetEval.effectiveConcurrency;
      if (concurrencyVal) concurrencyVal.textContent = `${resetEval.effectiveConcurrency}%`;
      if (cycleSlider) cycleSlider.value = resetEval.effectiveCycle;
      if (cycleVal) cycleVal.textContent = `${resetEval.effectiveCycle} ms`;
      refreshModalContent();
    });
  }

  // Filter Area Button
  if (filterAreaBtn && !filterAreaBtn.dataset.wired) {
    filterAreaBtn.dataset.wired = 'true';
    filterAreaBtn.addEventListener('click', () => {
      const data = calculatePonDbaMetrics(state, { portId: selectedPonPortId, referenceDate });
      if (typeof onFilterArea === 'function') {
        onFilterArea(data.selectedPort.primaryArea);
        if (typeof modal.close === 'function') {
          try { modal.close(); } catch { modal.removeAttribute('open'); }
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  // Copy Briefing Report Button
  if (copyBtn && !copyBtn.dataset.wired) {
    copyBtn.dataset.wired = 'true';
    copyBtn.addEventListener('click', async () => {
      const data = calculatePonDbaMetrics(state, {
        portId: selectedPonPortId,
        modeOverride: simulatedDbaMode,
        concurrencyOverride: simulatedConcurrencyLoad,
        cycleOverride: simulatedCyclePeriodMs,
        referenceDate
      });
      const text = generatePonDbaReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('PON DBA latency diagnostics briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy diagnostics briefing.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard API not available.');
      }
    });
  }
}
