import { formatPKR } from './core.js';

/**
 * ITU-T Y.1731 / IEEE 802.1ag Carrier Ethernet OAM & Performance Monitoring (PM) Matrix
 * Area: agent1 (shahdara-dashboard) - Microsecond Frame Delay (DMM/DMR), Delay Variation (FDV),
 * Synthetic Loss (SLM/SLR), Service Availability & Carrier SLA Analytics
 */

export const Y1731_OAM_CONSTANTS = {
  DEFAULT_SERVICE_ID: 'nbp-bank-core-oam',
  MICROSEC_PER_KM: 4.897, // Optical transit speed in standard SMF-28 silica fiber (1.4682 / c)
  MEP_TRANSIT_DELAY_US: 3.2, // Hardware timestamping & PHY latency per MEP/MIP hop
  TIMESTAMP_RESOLUTION_NS: 10, // IEEE 1588v2 hardware timestamp resolution

  CCM_INTERVALS: {
    FAST_3_3MS: { id: '3.3ms', label: '3.33 ms (Fast Protection / BFD)', intervalMs: 3.33 },
    MEDIUM_10MS: { id: '10ms', label: '10.0 ms (Metro Leased Line)', intervalMs: 10.0 },
    STANDARD_100MS: { id: '100ms', label: '100.0 ms (Corporate Broadband)', intervalMs: 100.0 },
    SLOW_1S: { id: '1s', label: '1.0 s (Standard Fault Detection)', intervalMs: 1000.0 }
  },

  SLA_PROFILES: {
    HIGH_CRITICAL: {
      id: 'high',
      label: 'Ultra-Low Latency / Banking & 5G (CoS 1)',
      maxDelayMs: 4.0,
      maxDelayVariationMs: 1.0,
      maxFlrPct: 0.001,
      minAvailabilityPct: 99.99
    },
    MEDIUM_BUSINESS: {
      id: 'medium',
      label: 'Corporate VPN / ERP & Hospital PACS (CoS 2)',
      maxDelayMs: 12.0,
      maxDelayVariationMs: 4.0,
      maxFlrPct: 0.010,
      minAvailabilityPct: 99.95
    },
    STANDARD_BEST_EFFORT: {
      id: 'standard',
      label: 'Commercial Retail / Internet Blend (CoS 3)',
      maxDelayMs: 25.0,
      maxDelayVariationMs: 10.0,
      maxFlrPct: 0.100,
      minAvailabilityPct: 99.90
    }
  },

  AVAILABILITY_STATES: {
    AVAILABLE: 'AVAILABLE',
    DEGRADED: 'DEGRADED',
    UNAVAILABLE: 'UNAVAILABLE'
  }
};

export const SHAHDARA_Y1731_SERVICES = [
  {
    id: 'nbp-bank-core-oam',
    name: 'National Bank Shahdara Branch Core Leased Line',
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Baradari', 'Begum Kot'],
    spanLengthKm: 8.4,
    intermediateMips: 2,
    slaProfileKey: 'HIGH_CRITICAL',
    ccmIntervalKey: 'FAST_3_3MS',
    sourceMep: { id: 'MEP-101', name: 'Baradari Central OLT PE-01', port: '10GE 1/1/1', domain: 'MD-BANKS-L2' },
    targetMep: { id: 'MEP-102', name: 'Town Plaza Branch CE-02', port: '10GE 1/2/4', domain: 'MD-BANKS-L2' },
    baselineQueueDelayMs: 0.45,
    baselineLossPct: 0.0001,
    committedThroughputMbps: 200,
    monthlyRevenuePkr: 420000,
    subscribersCount: 85
  },
  {
    id: 'hospital-telemed-oam',
    name: 'Shahdara District Hospital Telemedicine PACS Circuit',
    primaryArea: 'Begum Kot',
    secondaryAreas: ['Shahdara Town', 'Baradari'],
    spanLengthKm: 6.2,
    intermediateMips: 1,
    slaProfileKey: 'HIGH_CRITICAL',
    ccmIntervalKey: 'MEDIUM_10MS',
    sourceMep: { id: 'MEP-201', name: 'Begum Kot Hub Aggregator', port: '10GE 1/1/3', domain: 'MD-HEALTH-L2' },
    targetMep: { id: 'MEP-202', name: 'District Hospital ICU POP', port: '10GE 1/1/1', domain: 'MD-HEALTH-L2' },
    baselineQueueDelayMs: 0.62,
    baselineLossPct: 0.0002,
    committedThroughputMbps: 500,
    monthlyRevenuePkr: 650000,
    subscribersCount: 140
  },
  {
    id: 'cellular-fronthaul-oam',
    name: 'Cellular 5G Macro Tower Front-Haul CPRI/eCPRI Trunk',
    primaryArea: 'Baradari',
    secondaryAreas: ['Kala Khatai Road', 'Ravi Siphon'],
    spanLengthKm: 12.8,
    intermediateMips: 3,
    slaProfileKey: 'HIGH_CRITICAL',
    ccmIntervalKey: 'FAST_3_3MS',
    sourceMep: { id: 'MEP-301', name: 'Baradari Core BBU Pool', port: '25GE 1/1/1', domain: 'MD-TELCO-CPRI' },
    targetMep: { id: 'MEP-302', name: 'Kala Khatai Macro RRU Tower', port: '25GE 1/1/2', domain: 'MD-TELCO-CPRI' },
    baselineQueueDelayMs: 0.28,
    baselineLossPct: 0.00005,
    committedThroughputMbps: 2500,
    monthlyRevenuePkr: 1100000,
    subscribersCount: 290
  },
  {
    id: 'b2b-plaza-agg-oam',
    name: 'Jia Musa Commercial Plaza Corporate Multipoint Trunk',
    primaryArea: 'Jia Musa',
    secondaryAreas: ['Vandala Road'],
    spanLengthKm: 4.5,
    intermediateMips: 1,
    slaProfileKey: 'MEDIUM_BUSINESS',
    ccmIntervalKey: 'MEDIUM_10MS',
    sourceMep: { id: 'MEP-401', name: 'Jia Musa Plaza Core Switch', port: '10GE 1/2/1', domain: 'MD-CORP-PLAZA' },
    targetMep: { id: 'MEP-402', name: 'Market Square Distribution', port: '10GE 1/2/2', domain: 'MD-CORP-PLAZA' },
    baselineQueueDelayMs: 1.15,
    baselineLossPct: 0.0020,
    committedThroughputMbps: 1000,
    monthlyRevenuePkr: 780000,
    subscribersCount: 210
  },
  {
    id: 'inter-olt-backbone-oam',
    name: 'Vandala Road to Baradari Inter-OLT Ring Interconnect',
    primaryArea: 'Vandala Road',
    secondaryAreas: ['Baradari', 'Jia Musa'],
    spanLengthKm: 16.5,
    intermediateMips: 4,
    slaProfileKey: 'HIGH_CRITICAL',
    ccmIntervalKey: 'FAST_3_3MS',
    sourceMep: { id: 'MEP-501', name: 'Vandala Central OLT Core', port: '100GE 1/1/1', domain: 'MD-CORE-BACKBONE' },
    targetMep: { id: 'MEP-502', name: 'Baradari Central OLT Core', port: '100GE 1/1/2', domain: 'MD-CORE-BACKBONE' },
    baselineQueueDelayMs: 0.50,
    baselineLossPct: 0.0001,
    committedThroughputMbps: 10000,
    monthlyRevenuePkr: 1850000,
    subscribersCount: 520
  }
];

/**
 * Calculates ITU-T Y.1731 DMM/DMR round-trip delay, one-way delay, delay variation (FDV),
 * Synthetic Loss Measurement (SLM) loss ratio, and service availability state
 * @param {Object} serviceConfig - Service configuration object
 * @param {Object} options - Simulation inputs (injectedQueueDelayMs, injectedLossPct, ccmIntervalKey)
 * @returns {Object} Calculated Y.1731 telemetry dynamics
 */
export function calculateY1731Dynamics(serviceConfig, options = {}) {
  const s = serviceConfig || SHAHDARA_Y1731_SERVICES[0];
  const sla = Y1731_OAM_CONSTANTS.SLA_PROFILES[s.slaProfileKey] || Y1731_OAM_CONSTANTS.SLA_PROFILES.HIGH_CRITICAL;

  const ccmKey = options.ccmIntervalKey || s.ccmIntervalKey || 'MEDIUM_10MS';
  const ccm = Y1731_OAM_CONSTANTS.CCM_INTERVALS[ccmKey] || Y1731_OAM_CONSTANTS.CCM_INTERVALS.MEDIUM_10MS;

  // Injected simulation variables
  const injectedQueueDelayMs = typeof options.injectedQueueDelayMs === 'number'
    ? Math.max(0, options.injectedQueueDelayMs)
    : s.baselineQueueDelayMs;

  const injectedLossPct = typeof options.injectedLossPct === 'number'
    ? Math.max(0, options.injectedLossPct)
    : s.baselineLossPct;

  // 1. Physical Propagation Delay in Optical Fiber (SMF-28 silica)
  // Distance * (1.4682 / c) = ~4.897 us/km one-way
  const oneWayOpticalTransitUs = s.spanLengthKm * Y1731_OAM_CONSTANTS.MICROSEC_PER_KM;
  const twoWayOpticalTransitUs = 2 * oneWayOpticalTransitUs;

  // 2. Switch/PHY Timestamp Processing Delay (MEPs and intermediate MIPs)
  // Total hops = 2 MEPs + N MIPs
  const totalHops = 2 + (s.intermediateMips || 0);
  const totalHopsDelayUs = 2 * (totalHops * Y1731_OAM_CONSTANTS.MEP_TRANSIT_DELAY_US);

  // 3. Queue Buffer Congestion Delay (Two-Way)
  const queueDelayUs = injectedQueueDelayMs * 1000;

  // 4. Two-Way Frame Delay (FD_two_way) = (T4 - T1) - (T3 - T2)
  const totalTwoWayDelayUs = +(twoWayOpticalTransitUs + totalHopsDelayUs + queueDelayUs).toFixed(1);
  const totalTwoWayDelayMs = +(totalTwoWayDelayUs / 1000).toFixed(4);

  // 5. One-Way Frame Delay (FD_one_way) assuming symmetric path (IEEE 1588 PTP or DMM/2)
  const oneWayDelayMs = +(totalTwoWayDelayMs / 2).toFixed(4);
  const oneWayDelayUs = +(totalTwoWayDelayUs / 2).toFixed(1);

  // 6. Frame Delay Variation (FDV / Packet Jitter) = |FD_k - FD_{k-1}|
  // Jitter is driven by queue depth variance and serialization dispersion
  const meanJitterUs = +(queueDelayUs * 0.18 + 4.5).toFixed(1);
  const peakJitter99thUs = +(queueDelayUs * 0.45 + 12.0).toFixed(1);
  const meanJitterMs = +(meanJitterUs / 1000).toFixed(4);
  const peakJitter99thMs = +(peakJitter99thUs / 1000).toFixed(4);

  // 7. Synthetic Loss Measurement (SLM/SLR) Frame Loss Ratio (FLR %)
  const flrPct = +(injectedLossPct).toFixed(4);
  const sentFramesCount = 10000;
  const lostFramesCount = Math.round((sentFramesCount * flrPct) / 100);
  const receivedFramesCount = sentFramesCount - lostFramesCount;

  // 8. Service Availability State Machine (ITU-T Y.1731 §8.1 / MEF 10.3)
  // Available: FLR < 50%
  // Degraded: FLR >= SLA limit but < 50%
  // Unavailable: FLR >= 50% or continuous defect
  let availabilityState = Y1731_OAM_CONSTANTS.AVAILABILITY_STATES.AVAILABLE;
  let availabilityColor = '#10b981'; // Emerald

  if (flrPct >= 50.0) {
    availabilityState = Y1731_OAM_CONSTANTS.AVAILABILITY_STATES.UNAVAILABLE;
    availabilityColor = '#ef4444'; // Red
  } else if (flrPct > sla.maxFlrPct || oneWayDelayMs > sla.maxDelayMs || peakJitter99thMs > sla.maxDelayVariationMs) {
    availabilityState = Y1731_OAM_CONSTANTS.AVAILABILITY_STATES.DEGRADED;
    availabilityColor = '#f59e0b'; // Amber
  }

  // 9. SLA Compliance Verdict
  let slaVerdict = 'SLA_COMPLIANT_OPTIMAL';
  let slaVerdictLabel = 'Full SLA Compliance';
  let slaVerdictColor = '#10b981';

  const delayCompliant = oneWayDelayMs <= sla.maxDelayMs;
  const jitterCompliant = peakJitter99thMs <= sla.maxDelayVariationMs;
  const flrCompliant = flrPct <= sla.maxFlrPct;

  if (!delayCompliant || !jitterCompliant || !flrCompliant) {
    if (availabilityState === Y1731_OAM_CONSTANTS.AVAILABILITY_STATES.UNAVAILABLE) {
      slaVerdict = 'SLA_BREACH_OUTAGE';
      slaVerdictLabel = 'Critical Outage (FLR >= 50%)';
      slaVerdictColor = '#ef4444';
    } else {
      slaVerdict = 'SLA_VIOLATION_MARGINAL';
      slaVerdictLabel = 'SLA Metric Exceeded';
      slaVerdictColor = '#f59e0b';
    }
  }

  // Headroom margin against SLA threshold (One-Way Delay)
  const delayMarginMs = +(sla.maxDelayMs - oneWayDelayMs).toFixed(4);
  const jitterMarginMs = +(sla.maxDelayVariationMs - peakJitter99thMs).toFixed(4);

  // Simulated synthetic timestamps T1, T2, T3, T4 in microsecond offsets
  const t1Us = 1000000.0;
  const t2Us = +(t1Us + oneWayDelayUs).toFixed(1);
  const t3Us = +(t2Us + 15.0).toFixed(1); // 15 us remote processing dwell
  const t4Us = +(t3Us + oneWayDelayUs).toFixed(1);

  // Financial Penalty Estimate (% of monthly service fee)
  let penaltyCreditPct = 0;
  if (slaVerdict === 'SLA_BREACH_OUTAGE') penaltyCreditPct = 25;
  else if (slaVerdict === 'SLA_VIOLATION_MARGINAL') penaltyCreditPct = 10;
  const penaltyPkr = Math.round((s.monthlyRevenuePkr * penaltyCreditPct) / 100);

  return {
    service: s,
    slaProfile: sla,
    ccmInterval: ccm,
    spanLengthKm: s.spanLengthKm,
    intermediateMips: s.intermediateMips,

    // Timing Dynamics
    propagationDelay: {
      oneWayUs: +oneWayOpticalTransitUs.toFixed(1),
      twoWayUs: +twoWayOpticalTransitUs.toFixed(1),
      hopsTransitDelayUs: +totalHopsDelayUs.toFixed(1),
      queueDelayUs: +queueDelayUs.toFixed(1)
    },

    // Measured Performance Metrics
    twoWayDelayMs: totalTwoWayDelayMs,
    twoWayDelayUs: totalTwoWayDelayUs,
    oneWayDelayMs,
    oneWayDelayUs,
    meanJitterMs,
    meanJitterUs,
    peakJitter99thMs,
    peakJitter99thUs,

    // Loss Telemetry
    flrPct,
    sentFramesCount,
    receivedFramesCount,
    lostFramesCount,

    // Timestamps
    timestamps: {
      t1Us,
      t2Us,
      t3Us,
      t4Us
    },

    // Availability & Verdict
    availabilityState,
    availabilityColor,
    slaVerdict,
    slaVerdictLabel,
    slaVerdictColor,
    delayCompliant,
    jitterCompliant,
    flrCompliant,
    delayMarginMs,
    jitterMarginMs,

    // Financial Exposure
    penaltyCreditPct,
    penaltyPkr,
    monthlyRevenuePkr: s.monthlyRevenuePkr,
    subscribersCount: s.subscribersCount
  };
}

/**
 * Calculates aggregated Y.1731 metrics across all configured services or selected service
 * @param {Object} state - Application state (customers, payments)
 * @param {Object} params - Simulation parameters
 * @returns {Object} Aggregated metrics
 */
export function calculateY1731Metrics(state, params = {}) {
  const selectedServiceId = params.serviceId || Y1731_OAM_CONSTANTS.DEFAULT_SERVICE_ID;
  const service = SHAHDARA_Y1731_SERVICES.find(s => s.id === selectedServiceId) || SHAHDARA_Y1731_SERVICES[0];

  const dynamics = calculateY1731Dynamics(service, params);

  // Global portfolio summary
  const totalServices = SHAHDARA_Y1731_SERVICES.length;
  const totalFiberSpanKm = +SHAHDARA_Y1731_SERVICES.reduce((sum, s) => sum + s.spanLengthKm, 0).toFixed(1);
  const totalSubscribers = SHAHDARA_Y1731_SERVICES.reduce((sum, s) => sum + s.subscribersCount, 0);
  const totalProtectedRevenuePkr = SHAHDARA_Y1731_SERVICES.reduce((sum, s) => sum + s.monthlyRevenuePkr, 0);

  // Correlate with current customer ledger if provided
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
    totalFiberSpanKm,
    totalSubscribers,
    totalProtectedRevenuePkr,
    actualCustomersInArea
  };
}

/**
 * Pure-vector SVG visualizer for ITU-T Y.1731 DMM/DMR Delay Measurement and MEP/MIP Topology
 * @param {Object} dynamics - Output of calculateY1731Dynamics
 * @param {Object} options - Visual customization options (width, height, isDarkMode)
 * @returns {string} Pure SVG string
 */
export function renderY1731DiagramSvg(dynamics, options = {}) {
  const {
    service,
    slaProfile,
    oneWayDelayMs,
    twoWayDelayMs,
    peakJitter99thMs,
    flrPct,
    availabilityState,
    availabilityColor,
    slaVerdictLabel,
    slaVerdictColor,
    timestamps,
    delayMarginMs
  } = dynamics;

  const width = options.width || 760;
  const height = options.height || 420;
  const isDark = options.isDarkMode !== false;

  // Palettes
  const bg = isDark ? '#0f172a' : '#f8fafc';
  const surface = isDark ? '#1e293b' : '#ffffff';
  const textMain = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? '#334155' : '#e2e8f0';

  const blueCol = '#3b82f6';
  const cyanCol = '#06b6d4';
  const emeraldCol = '#10b981';
  const amberCol = '#f59e0b';
  const redCol = '#ef4444';
  const purpleCol = '#8b5cf6';

  // MEP Coordinates
  const mepAY = 140;
  const mepAX = 90;
  const mepBX = 370;
  const mepBY = 140;

  // Intermediate MIP circles
  const mipsCount = service.intermediateMips || 2;
  const mipCoords = [];
  for (let i = 1; i <= mipsCount; i++) {
    const fraction = i / (mipsCount + 1);
    mipCoords.push({
      x: +(mepAX + fraction * (mepBX - mepAX)).toFixed(1),
      y: mepAY,
      label: `MIP-${i}`
    });
  }

  const mipsSvg = mipCoords.map(mip => `
    <g transform="translate(${mip.x}, ${mip.y})">
      <circle r="12" fill="${surface}" stroke="${purpleCol}" stroke-width="2" />
      <circle r="4" fill="${purpleCol}" />
      <text y="-18" font-size="8" font-weight="700" fill="${purpleCol}" text-anchor="middle">${mip.label}</text>
    </g>
  `).join('');

  // Right Panel Telemetry Coordinates
  const panelX = 480;
  const panelY = 25;
  const panelW = 255;

  // SLA Delay Progress Bar (Max scale 15ms or 30ms)
  const maxScaleMs = Math.max(10.0, slaProfile.maxDelayMs * 1.5);
  const barW = 225;
  const currentDelayBarW = Math.min(barW, Math.max(4, +((oneWayDelayMs / maxScaleMs) * barW).toFixed(1)));
  const slaThresholdX = panelX + 15 + +((slaProfile.maxDelayMs / maxScaleMs) * barW).toFixed(1);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="y1731-svg" role="img" aria-label="ITU-T Y.1731 Carrier Ethernet OAM and Performance Monitoring Diagram">
      <defs>
        <linearGradient id="y1731GradSurface" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${surface}" />
          <stop offset="100%" stop-color="${surface}" stop-opacity="0.85" />
        </linearGradient>
        <linearGradient id="y1731BeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${blueCol}" />
          <stop offset="50%" stop-color="${cyanCol}" />
          <stop offset="100%" stop-color="${emeraldCol}" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" rx="10" fill="${bg}" />

      <!-- Left Circuit Box -->
      <rect x="20" y="20" width="440" height="375" rx="8" fill="url(#y1731GradSurface)" stroke="${borderCol}" stroke-width="1" />
      <text x="35" y="44" font-size="12" font-weight="700" fill="${textMain}">${service.name}</text>
      <text x="35" y="60" font-size="9" fill="${textMuted}">${service.spanLengthKm} km SMF-28 • ${service.sourceMep.domain} • ${dynamics.subscribersCount} Subs • ${formatPKR(service.monthlyRevenuePkr)}</text>

      <!-- Optical Span Line Between MEPs -->
      <line x1="${mepAX}" y1="${mepAY}" x2="${mepBX}" y2="${mepBY}" stroke="url(#y1731BeamGrad)" stroke-width="4" stroke-linecap="round" />

      <!-- Forward DMM Path Arrow (T1 -> T2) -->
      <path d="M ${mepAX + 25} ${mepAY - 20} Q ${(mepAX + mepBX) / 2} ${mepAY - 45} ${mepBX - 25} ${mepBY - 20}"
            fill="none" stroke="${cyanCol}" stroke-width="2" stroke-dasharray="5,3" />
      <polygon points="${mepBX - 20},${mepBY - 20} ${mepBX - 30},${mepBY - 25} ${mepBX - 28},${mepBY - 18}" fill="${cyanCol}" />
      <text x="${(mepAX + mepBX) / 2}" y="${mepAY - 48}" font-size="8.5" font-weight="700" fill="${cyanCol}" text-anchor="middle">DMM Request (T1 → T2)</text>

      <!-- Reverse DMR Path Arrow (T3 -> T4) -->
      <path d="M ${mepBX - 25} ${mepBY + 20} Q ${(mepAX + mepBX) / 2} ${mepBY + 45} ${mepAX + 25} ${mepAY + 20}"
            fill="none" stroke="${emeraldCol}" stroke-width="2" stroke-dasharray="5,3" />
      <polygon points="${mepAX + 20},${mepAY + 20} ${mepAX + 28},${mepAY + 18} ${mepAX + 30},${mepAY + 25}" fill="${emeraldCol}" />
      <text x="${(mepAX + mepBX) / 2}" y="${mepAY + 58}" font-size="8.5" font-weight="700" fill="${emeraldCol}" text-anchor="middle">DMR Response (T3 → T4)</text>

      <!-- Intermediate MIPs -->
      ${mipsSvg}

      <!-- Source MEP A -->
      <g transform="translate(${mepAX}, ${mepAY})">
        <circle r="22" fill="${surface}" stroke="${blueCol}" stroke-width="3" />
        <circle r="8" fill="${blueCol}" />
        <text y="4" font-size="8.5" font-weight="800" fill="#ffffff" text-anchor="middle">A</text>
        <text y="-28" font-size="9" font-weight="700" fill="${textMain}" text-anchor="middle">${service.sourceMep.id}</text>
        <text y="-40" font-size="7.5" fill="${textMuted}" text-anchor="middle">PE-01</text>
        <text y="38" font-size="8" fill="${cyanCol}" text-anchor="middle">T1: ${timestamps.t1Us} μs</text>
        <text y="50" font-size="8" fill="${emeraldCol}" text-anchor="middle">T4: ${timestamps.t4Us} μs</text>
      </g>

      <!-- Target MEP B -->
      <g transform="translate(${mepBX}, ${mepBY})">
        <circle r="22" fill="${surface}" stroke="${emeraldCol}" stroke-width="3" />
        <circle r="8" fill="${emeraldCol}" />
        <text y="4" font-size="8.5" font-weight="800" fill="#ffffff" text-anchor="middle">B</text>
        <text y="-28" font-size="9" font-weight="700" fill="${textMain}" text-anchor="middle">${service.targetMep.id}</text>
        <text y="-40" font-size="7.5" fill="${textMuted}" text-anchor="middle">CE-02</text>
        <text y="38" font-size="8" fill="${cyanCol}" text-anchor="middle">T2: ${timestamps.t2Us} μs</text>
        <text y="50" font-size="8" fill="${emeraldCol}" text-anchor="middle">T3: ${timestamps.t3Us} μs</text>
      </g>

      <!-- Center Telemetry Ribbon Inside Left Box -->
      <g transform="translate(35, 255)">
        <rect x="0" y="0" width="410" height="120" rx="6" fill="${bg}" stroke="${borderCol}" stroke-width="1" />

        <text x="15" y="24" font-size="9.5" font-weight="700" fill="${textMain}">Two-Way Frame Delay (FD):</text>
        <text x="195" y="24" font-size="11" font-weight="800" fill="${cyanCol}">${twoWayDelayMs} ms (${dynamics.twoWayDelayUs} μs)</text>

        <text x="15" y="46" font-size="9.5" font-weight="700" fill="${textMain}">One-Way Delay (FD_1way):</text>
        <text x="195" y="46" font-size="11" font-weight="800" fill="${blueCol}">${oneWayDelayMs} ms (${dynamics.oneWayDelayUs} μs)</text>

        <text x="15" y="68" font-size="9.5" font-weight="700" fill="${textMain}">Packet Jitter (FDV 99th):</text>
        <text x="195" y="68" font-size="11" font-weight="800" fill="${purpleCol}">${peakJitter99thMs} ms (${dynamics.peakJitter99thUs} μs)</text>

        <text x="15" y="90" font-size="9.5" font-weight="700" fill="${textMain}">Synthetic Loss Ratio (FLR):</text>
        <text x="195" y="90" font-size="11" font-weight="800" fill="${dynamics.flrCompliant ? emeraldCol : redCol}">${flrPct}% (${dynamics.lostFramesCount} / 10k frames)</text>

        <text x="15" y="110" font-size="9" fill="${textMuted}">SLA Margin:</text>
        <text x="195" y="110" font-size="9.5" font-weight="700" fill="${delayMarginMs > 0 ? emeraldCol : redCol}">${delayMarginMs > 0 ? '+' : ''}${delayMarginMs} ms headroom</text>
      </g>

      <!-- Right Performance Monitoring & SLA Panel -->
      <rect x="${panelX}" y="${panelY}" width="${panelW}" height="370" rx="8" fill="url(#y1731GradSurface)" stroke="${borderCol}" stroke-width="1" />
      <text x="${panelX + 15}" y="${panelY + 24}" font-size="12" font-weight="700" fill="${textMain}">Y.1731 Performance Telemetry</text>
      <text x="${panelX + 15}" y="${panelY + 40}" font-size="9" fill="${textMuted}">Carrier Ethernet SLA Verification</text>

      <!-- Availability State Pill -->
      <g transform="translate(${panelX + 15}, ${panelY + 52})">
        <rect x="0" y="0" width="108" height="42" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <text x="8" y="14" font-size="8" fill="${textMuted}">Availability State</text>
        <text x="8" y="31" font-size="10" font-weight="800" fill="${availabilityColor}">${availabilityState}</text>

        <rect x="117" y="0" width="108" height="42" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <text x="125" y="14" font-size="8" fill="${textMuted}">SLA Verdict</text>
        <text x="125" y="31" font-size="9" font-weight="800" fill="${slaVerdictColor}">${slaVerdictLabel.split(' ')[0]}</text>
      </g>

      <!-- Delay Gauge vs SLA Threshold -->
      <g transform="translate(${panelX + 15}, ${panelY + 115})">
        <text x="0" y="0" font-size="9.5" font-weight="700" fill="${textMain}">One-Way Delay vs SLA (${slaProfile.maxDelayMs} ms max)</text>
        <rect x="0" y="10" width="${barW}" height="16" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <rect x="0" y="10" width="${currentDelayBarW}" height="16" rx="4" fill="${dynamics.delayCompliant ? emeraldCol : redCol}" />
        
        <!-- Threshold Mark -->
        <line x1="${(slaProfile.maxDelayMs / maxScaleMs) * barW}" y1="5" x2="${(slaProfile.maxDelayMs / maxScaleMs) * barW}" y2="31" stroke="${redCol}" stroke-width="1.8" stroke-dasharray="3,2" />
        <text x="${(slaProfile.maxDelayMs / maxScaleMs) * barW}" y="42" font-size="7.5" font-weight="700" fill="${redCol}" text-anchor="middle">SLA Limit (${slaProfile.maxDelayMs}ms)</text>
      </g>

      <!-- Detailed Metrics List -->
      <g transform="translate(${panelX + 15}, ${panelY + 185})" font-size="8.5">
        <text x="0" y="0" font-weight="700" fill="${textMain}">SLA Profile:</text>
        <text x="${barW}" y="0" font-weight="700" fill="${cyanCol}" text-anchor="end">${slaProfile.id.toUpperCase()}</text>

        <text x="0" y="20" fill="${textMain}">CCM Frequency:</text>
        <text x="${barW}" y="20" fill="${textMuted}" text-anchor="end">${dynamics.ccmInterval.label}</text>

        <text x="0" y="40" fill="${textMain}">Optical Transit (Pure Glass):</text>
        <text x="${barW}" y="40" fill="${textMuted}" text-anchor="end">${dynamics.propagationDelay.oneWayUs} μs</text>

        <text x="0" y="60" fill="${textMain}">Switch Hardware Timestamping:</text>
        <text x="${barW}" y="60" fill="${textMuted}" text-anchor="end">${dynamics.propagationDelay.hopsTransitDelayUs} μs</text>

        <text x="0" y="80" fill="${textMain}">Buffer Queue Delay:</text>
        <text x="${barW}" y="80" fill="${textMuted}" text-anchor="end">${dynamics.propagationDelay.queueDelayUs} μs</text>
      </g>

      <!-- Penalty Rebate Exposure Box -->
      <g transform="translate(${panelX + 15}, 325)">
        <rect x="0" y="0" width="${barW}" height="55" rx="4" fill="${bg}" stroke="${borderCol}" stroke-width="1" />
        <text x="10" y="16" font-size="8" fill="${textMuted}">SLA Rebate Penalty Exposure</text>
        <text x="10" y="34" font-size="11" font-weight="800" fill="${dynamics.penaltyCreditPct > 0 ? redCol : emeraldCol}">${dynamics.penaltyCreditPct}% (PKR ${dynamics.penaltyPkr.toLocaleString()})</text>
        <text x="10" y="48" font-size="7.5" fill="${textMuted}">Contractual credit for service degradation</text>
      </g>
    </svg>
  `;
}

/**
 * Generates formal text report for ITU-T Y.1731 Carrier Ethernet OAM Audit
 * @param {Object} metrics - Output of calculateY1731Metrics or calculateY1731Dynamics
 * @returns {string} Formatted audit report text
 */
export function generateY1731Report(metrics) {
  const d = metrics.dynamics || metrics;
  const s = d.service;
  const sla = d.slaProfile;

  return `========================================================================
SHAHDARA ISP CARRIER ETHERNET OAM & PM AUDIT REPORT (ITU-T Y.1731 / 802.1ag)
========================================================================
Generated: ${new Date().toISOString()}
Standards: ITU-T Y.1731, IEEE 802.1ag CFM, MEF 10.3 / MEF 35.1

1. CIRCUIT TOPOLOGY & MAINTENANCE DOMAIN
------------------------------------------------------------------------
Service Name:         ${s.name}
Service ID:           ${s.id}
Coverage Area:        ${s.primaryArea} (${(s.secondaryAreas || []).join(', ')})
Span Distance:        ${s.spanLengthKm} km (SMF-28 Silica Optical Fiber)
Maintenance Domain:   ${s.sourceMep.domain}
Source MEP (A):       ${s.sourceMep.id} (${s.sourceMep.name}) [Port: ${s.sourceMep.port}]
Target MEP (B):       ${s.targetMep.id} (${s.targetMep.name}) [Port: ${s.targetMep.port}]
Intermediate MIPs:    ${s.intermediateMips} Points
Throughput Committed: ${s.committedThroughputMbps} Mbps
Monthly Revenue:      PKR ${s.monthlyRevenuePkr.toLocaleString()}
Linked Subscribers:   ${d.subscribersCount} Accounts

2. FRAME DELAY & JITTER PERFORMANCE MONITORING (DMM/DMR)
------------------------------------------------------------------------
Two-Way Frame Delay (FD):      ${d.twoWayDelayMs} ms (${d.twoWayDelayUs} us)
One-Way Frame Delay (FD_1way): ${d.oneWayDelayMs} ms (${d.oneWayDelayUs} us)
SLA Delay Ceiling:             ${sla.maxDelayMs} ms [${d.delayCompliant ? 'COMPLIANT' : 'BREACH'}]
Headroom Margin:               ${d.delayMarginMs > 0 ? '+' : ''}${d.delayMarginMs} ms

Mean Packet Jitter (FDV_mean): ${d.meanJitterMs} ms (${d.meanJitterUs} us)
Peak 99th Jitter (FDV_99th):   ${d.peakJitter99thMs} ms (${d.peakJitter99thUs} us)
SLA Jitter Ceiling:            ${sla.maxDelayVariationMs} ms [${d.jitterCompliant ? 'COMPLIANT' : 'BREACH'}]

3. SYNTHETIC LOSS MEASUREMENT & AVAILABILITY (SLM/SLR)
------------------------------------------------------------------------
Transmitted Test Frames:       ${d.sentFramesCount.toLocaleString()}
Received Test Frames:          ${d.receivedFramesCount.toLocaleString()}
Lost Test Frames:              ${d.lostFramesCount.toLocaleString()}
Frame Loss Ratio (FLR):        ${d.flrPct}%
SLA FLR Ceiling:               ${sla.maxFlrPct}% [${d.flrCompliant ? 'COMPLIANT' : 'BREACH'}]

Availability State:            ${d.availabilityState} (Target: >= ${sla.minAvailabilityPct}%)
SLA Overall Verdict:           ${d.slaVerdict} (${d.slaVerdictLabel})
Contractual Penalty Credit:    ${d.penaltyCreditPct}% (PKR ${d.penaltyPkr.toLocaleString()})

4. COMPONENT LATENCY STACK
------------------------------------------------------------------------
Optical Transit (Glass Core):  ${d.propagationDelay.oneWayUs} us
Hardware Timestamp / Switch:   ${d.propagationDelay.hopsTransitDelayUs} us
Buffer Queue Delay:            ${d.propagationDelay.queueDelayUs} us

Recommendations:
- Maintain DMM/DMR probe frequency at ${d.ccmInterval.label} to catch transient buffer spikes.
- Hardware timestamping at PHY/MAC layer is active on both MEP-A and MEP-B.
========================================================================`;
}

/**
 * Exports metrics as JSON string
 * @param {Object} metrics - Output of calculateY1731Metrics or calculateY1731Dynamics
 * @returns {string} JSON formatted string
 */
export function exportY1731Json(metrics) {
  const d = metrics.dynamics || metrics;
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    standard: 'ITU-T Y.1731 / IEEE 802.1ag Carrier Ethernet OAM',
    service: {
      id: d.service.id,
      name: d.service.name,
      primaryArea: d.service.primaryArea,
      spanLengthKm: d.service.spanLengthKm,
      slaProfile: d.slaProfile.id
    },
    performance: {
      twoWayDelayMs: d.twoWayDelayMs,
      oneWayDelayMs: d.oneWayDelayMs,
      peakJitter99thMs: d.peakJitter99thMs,
      flrPct: d.flrPct,
      availabilityState: d.availabilityState,
      slaVerdict: d.slaVerdict
    },
    compliance: {
      delayCompliant: d.delayCompliant,
      jitterCompliant: d.jitterCompliant,
      flrCompliant: d.flrCompliant,
      delayMarginMs: d.delayMarginMs
    },
    exposure: {
      penaltyCreditPct: d.penaltyCreditPct,
      penaltyPkr: d.penaltyPkr,
      monthlyRevenuePkr: d.monthlyRevenuePkr
    }
  }, null, 2);
}

/**
 * Exports metrics as RFC-4180 CSV string
 * @param {Object} metrics - Output of calculateY1731Metrics or calculateY1731Dynamics
 * @returns {string} CSV formatted string
 */
export function exportY1731Csv(metrics) {
  const d = metrics.dynamics || metrics;
  const s = d.service;

  const headers = [
    'Service_ID',
    'Service_Name',
    'Primary_Area',
    'Span_Km',
    'SLA_Profile',
    'CCM_Interval',
    'Two_Way_Delay_Ms',
    'One_Way_Delay_Ms',
    'Peak_Jitter_Ms',
    'FLR_Pct',
    'Availability_State',
    'SLA_Verdict',
    'Delay_Margin_Ms',
    'Penalty_Pct',
    'Penalty_PKR',
    'Monthly_Revenue_PKR'
  ];

  const values = [
    `"${s.id}"`,
    `"${s.name}"`,
    `"${s.primaryArea}"`,
    s.spanLengthKm,
    `"${d.slaProfile.id}"`,
    `"${d.ccmInterval.id}"`,
    d.twoWayDelayMs,
    d.oneWayDelayMs,
    d.peakJitter99thMs,
    d.flrPct,
    `"${d.availabilityState}"`,
    `"${d.slaVerdict}"`,
    d.delayMarginMs,
    d.penaltyCreditPct,
    d.penaltyPkr,
    d.monthlyRevenuePkr
  ];

  return `${headers.join(',')}\r\n${values.join(',')}\r\n`;
}

/**
 * Controller wiring for Y.1731 modal dialog and dashboard chart card
 * @param {Object} state - Application state
 * @param {Object} options - Environment options (document, onFilterArea, onToast)
 * @returns {Object} Modal controller
 */
export function setupY1731Modal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const onToast = typeof options.onToast === 'function'
    ? options.onToast
    : (msg) => { if (typeof alert === 'function') alert(msg); };

  // Elements
  const openBtn = doc.getElementById('dashboardOpenY1731ModalBtn');
  const modal = doc.getElementById('dashboardY1731Modal');
  const closeBtn = doc.getElementById('dashboardY1731ModalCloseBtn');

  // Dashboard Card Chart Container
  const cardChartContainer = doc.getElementById('dashboardY1731Chart');

  // Modal Inputs
  const serviceSelect = doc.getElementById('y1731ServiceSelect');
  const queueDelaySlider = doc.getElementById('y1731QueueDelaySlider');
  const queueDelayLabel = doc.getElementById('y1731QueueDelayLabel');
  const lossInput = doc.getElementById('y1731LossInput');
  const ccmSelect = doc.getElementById('y1731CcmSelect');
  const resetBtn = doc.getElementById('y1731ResetBtn');

  // Modal KPI Stats
  const statDelay = doc.getElementById('y1731StatDelay');
  const statJitter = doc.getElementById('y1731StatJitter');
  const statFlr = doc.getElementById('y1731StatFlr');
  const statAvailability = doc.getElementById('y1731StatAvailability');
  const statVerdict = doc.getElementById('y1731StatVerdict');
  const statPenalty = doc.getElementById('y1731StatPenalty');

  // Modal Diagram Container
  const modalDiagramContainer = doc.getElementById('y1731ModalDiagramContainer');

  // Export / Action Buttons
  const copyReportBtn = doc.getElementById('y1731CopyReportBtn');
  const exportJsonBtn = doc.getElementById('y1731ExportJsonBtn');
  const exportCsvBtn = doc.getElementById('y1731ExportCsvBtn');
  const filterAreaBtn = doc.getElementById('y1731FilterAreaBtn');

  // State variables
  let currentServiceId = Y1731_OAM_CONSTANTS.DEFAULT_SERVICE_ID;
  let currentQueueDelayMs = 0.45;
  let currentLossPct = 0.0001;
  let currentCcmIntervalKey = 'FAST_3_3MS';

  function getSimulationParams() {
    return {
      serviceId: currentServiceId,
      injectedQueueDelayMs: currentQueueDelayMs,
      injectedLossPct: currentLossPct,
      ccmIntervalKey: currentCcmIntervalKey
    };
  }

  function recalculate() {
    const params = getSimulationParams();
    const metrics = calculateY1731Metrics(state, params);
    const d = metrics.dynamics;

    // Update Slider Label
    if (queueDelayLabel) {
      queueDelayLabel.textContent = `${currentQueueDelayMs.toFixed(2)} ms`;
    }

    // Update Modal Stats
    if (statDelay) {
      statDelay.textContent = `${d.oneWayDelayMs} ms (${d.twoWayDelayMs} ms 2-way)`;
      statDelay.style.color = d.delayCompliant ? '#10b981' : '#ef4444';
    }

    if (statJitter) {
      statJitter.textContent = `${d.peakJitter99thMs} ms (99th)`;
      statJitter.style.color = d.jitterCompliant ? '#10b981' : '#ef4444';
    }

    if (statFlr) {
      statFlr.textContent = `${d.flrPct}%`;
      statFlr.style.color = d.flrCompliant ? '#10b981' : '#ef4444';
    }

    if (statAvailability) {
      statAvailability.textContent = d.availabilityState;
      statAvailability.style.color = d.availabilityColor;
    }

    if (statVerdict) {
      statVerdict.textContent = d.slaVerdictLabel;
      statVerdict.style.color = d.slaVerdictColor;
    }

    if (statPenalty) {
      statPenalty.textContent = d.penaltyCreditPct > 0
        ? `${d.penaltyCreditPct}% (${formatPKR(d.penaltyPkr)})`
        : '0% (PKR 0)';
      statPenalty.style.color = d.penaltyCreditPct > 0 ? '#ef4444' : '#10b981';
    }

    // Render Modal Diagram
    if (modalDiagramContainer) {
      modalDiagramContainer.innerHTML = renderY1731DiagramSvg(d, {
        width: 760,
        height: 420,
        isDarkMode: doc.documentElement ? doc.documentElement.getAttribute('data-theme') !== 'light' : true
      });
    }

    // Render Dashboard Card Chart
    if (cardChartContainer) {
      cardChartContainer.innerHTML = renderY1731DiagramSvg(d, {
        width: 600,
        height: 320,
        isDarkMode: doc.documentElement ? doc.documentElement.getAttribute('data-theme') !== 'light' : true
      });
    }

    return metrics;
  }

  function loadService(serviceId) {
    currentServiceId = serviceId;
    const s = SHAHDARA_Y1731_SERVICES.find(item => item.id === serviceId) || SHAHDARA_Y1731_SERVICES[0];
    currentQueueDelayMs = s.baselineQueueDelayMs;
    currentLossPct = s.baselineLossPct;
    currentCcmIntervalKey = s.ccmIntervalKey || 'FAST_3_3MS';

    if (serviceSelect) serviceSelect.value = serviceId;
    if (queueDelaySlider) queueDelaySlider.value = currentQueueDelayMs;
    if (lossInput) lossInput.value = currentLossPct;
    if (ccmSelect) ccmSelect.value = currentCcmIntervalKey;

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

  if (queueDelaySlider) {
    queueDelaySlider.addEventListener('input', () => {
      currentQueueDelayMs = parseFloat(queueDelaySlider.value) || 0;
      recalculate();
    });
  }

  if (lossInput) {
    lossInput.addEventListener('input', () => {
      currentLossPct = parseFloat(lossInput.value) || 0;
      recalculate();
    });
  }

  if (ccmSelect) {
    ccmSelect.addEventListener('change', () => {
      currentCcmIntervalKey = ccmSelect.value;
      recalculate();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      loadService(currentServiceId);
      onToast('Y.1731 OAM parameters reset to baseline.');
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const params = getSimulationParams();
      const metrics = calculateY1731Metrics(state, params);
      const text = generateY1731Report(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          onToast('ITU-T Y.1731 OAM Audit Report copied to clipboard!');
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
      const metrics = calculateY1731Metrics(state, params);
      const json = exportY1731Json(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(json).then(() => {
          onToast('Y.1731 OAM JSON exported to clipboard!');
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
      const metrics = calculateY1731Metrics(state, params);
      const csv = exportY1731Csv(metrics);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(csv).then(() => {
          onToast('Y.1731 OAM CSV exported to clipboard!');
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
      const s = SHAHDARA_Y1731_SERVICES.find(item => item.id === currentServiceId) || SHAHDARA_Y1731_SERVICES[0];
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
