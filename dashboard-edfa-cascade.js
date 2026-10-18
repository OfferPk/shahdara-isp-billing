import { formatPKR } from './core.js';

/**
 * Carrier DWDM Cascaded EDFA Optical Amplification, ASE Noise Accumulation &
 * Dynamic Spectral Gain Equalizer (DGE / GFF) Ripple Telemetry Matrix
 * Standards: ITU-T G.692 / G.661 / G.662 / G.680
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Vector Visualizer & Transmission Telemetry
 */

export const EDFA_CASCADE_CONSTANTS = {
  DEFAULT_LINK_ID: 'link-baradari-siphon',
  BOLTZMANN_CONSTANT: 1.380649e-23, // J/K
  PLANCK_CONSTANT: 6.62607015e-34, // J*s
  OPTICAL_FREQUENCY_C_BAND_HZ: 193.4e12, // ~1550 nm center frequency
  STANDARD_OSNR_BW_NM: 0.1, // 0.1 nm resolution bandwidth (~12.5 GHz)
  SD_FEC_OSNR_THRESHOLD_DB: 14.5, // Standard Soft-Decision FEC OSNR floor
  HD_FEC_OSNR_THRESHOLD_DB: 17.5, // Standard Hard-Decision FEC OSNR floor
  RAW_EDFA_RIPPLE_PER_STAGE_DB: 2.2, // Unflattened Erbium spectral gain ripple per stage
  EQUALIZED_DGE_RIPPLE_DB: 0.35, // Residual ripple with Dynamic Gain Equalization

  AGC_MODES: {
    FAST_HARDWARE: {
      code: 'FAST_HARDWARE',
      name: 'Fast Optical AGC (≤ 80 µs)',
      responseUs: 80,
      transientSurgeDb: 0.35,
      description: 'Nanosecond photodiode feedback circuit clamping surge during channel drop'
    },
    LEGACY_SLOW: {
      code: 'LEGACY_SLOW',
      name: 'Legacy Slow AGC (> 2 ms)',
      responseUs: 2200,
      transientSurgeDb: 4.2,
      description: 'Slow microprocessor loop resulting in destructive transient optical surge'
    }
  },

  STATUS: {
    OPTIMAL: 'Optimal (Clean OSNR Margin, Flat Spectrum, Transient Clamped)',
    MARGIN_WARNING: 'Warning: Low OSNR Margin (< 3.0 dB above SD-FEC)',
    CRITICAL_NOISE: 'Critical: OSNR Below SD-FEC Threshold (Bit Errors Uncorrectable)',
    RIPPLE_SEVE: 'Spectral Warning: Excessive Gain Ripple Divergence (DGE Off)',
    SURGE_ALERT: 'Transient Alert: High Optical Power Surge Detected (SPM/XPM Risk)'
  }
};

export const SHAHDARA_EDFA_LINKS = [
  {
    id: 'link-baradari-siphon',
    name: 'Baradari NOC <-> Ravi Siphon Long-Haul DWDM Trunk',
    primaryArea: 'Ravi Siphon',
    targetArea: 'Baradari',
    totalDistanceKm: 62.0,
    spansCount: 3,
    spanDistancesKm: [20.5, 21.0, 20.5],
    fiberAttenuationDbPerKm: 0.22,
    baseLaunchPowerDbm: 2.0,
    baseNoiseFigureDb: 5.2,
    configuredChannels: 40,
    dgeEnabled: true,
    agcMode: 'FAST_HARDWARE',
    monthlyRevenuePkr: 8500000,
    subscribersCount: 1420
  },
  {
    id: 'link-begumkot-gw',
    name: 'Begum Kot Commercial Ring <-> Kot Abdul Malik Core Gateway',
    primaryArea: 'Begum Kot',
    targetArea: 'Kot Abdul Malik',
    totalDistanceKm: 44.0,
    spansCount: 2,
    spanDistancesKm: [22.0, 22.0],
    fiberAttenuationDbPerKm: 0.23,
    baseLaunchPowerDbm: 1.5,
    baseNoiseFigureDb: 5.0,
    configuredChannels: 32,
    dgeEnabled: true,
    agcMode: 'FAST_HARDWARE',
    monthlyRevenuePkr: 6200000,
    subscribersCount: 980
  },
  {
    id: 'link-jiamusa-sub',
    name: 'Jia Musa Industrial Duct <-> River Crossing Feeder',
    primaryArea: 'Jia Musa',
    targetArea: 'Shahdara Town',
    totalDistanceKm: 36.0,
    spansCount: 2,
    spanDistancesKm: [18.0, 18.0],
    fiberAttenuationDbPerKm: 0.24,
    baseLaunchPowerDbm: 1.0,
    baseNoiseFigureDb: 5.5,
    configuredChannels: 16,
    dgeEnabled: true,
    agcMode: 'FAST_HARDWARE',
    monthlyRevenuePkr: 3900000,
    subscribersCount: 560
  },
  {
    id: 'link-gtroad-transit',
    name: 'GT Road Highway Express Backbone (Heavy Traffic Trunk)',
    primaryArea: 'Shahdara Town',
    targetArea: 'GT Road',
    totalDistanceKm: 88.0,
    spansCount: 4,
    spanDistancesKm: [22.0, 22.0, 22.0, 22.0],
    fiberAttenuationDbPerKm: 0.22,
    baseLaunchPowerDbm: 3.0,
    baseNoiseFigureDb: 4.8,
    configuredChannels: 80,
    dgeEnabled: true,
    agcMode: 'FAST_HARDWARE',
    monthlyRevenuePkr: 12400000,
    subscribersCount: 2800
  },
  {
    id: 'link-shahdara-town',
    name: 'Shahdara Town Internal Metro Optical Loop',
    primaryArea: 'Shahdara Town',
    targetArea: 'Baradari',
    totalDistanceKm: 18.5,
    spansCount: 1,
    spanDistancesKm: [18.5],
    fiberAttenuationDbPerKm: 0.25,
    baseLaunchPowerDbm: 0.5,
    baseNoiseFigureDb: 5.8,
    configuredChannels: 24,
    dgeEnabled: true,
    agcMode: 'FAST_HARDWARE',
    monthlyRevenuePkr: 4100000,
    subscribersCount: 710
  }
];

// Interactive state variables
let currentSelectedLinkId = EDFA_CASCADE_CONSTANTS.DEFAULT_LINK_ID;
let currentChannelsOverride = null;
let currentDgeEnabled = true;
let currentAgcModeCode = 'FAST_HARDWARE';
let currentSimulatedChannelDrop = false; // Simulates drop from full channels to 4 channels

export function getEdfaSelectedLinkId() {
  return currentSelectedLinkId;
}

export function setEdfaSelectedLinkId(id) {
  if (SHAHDARA_EDFA_LINKS.some(l => l.id === id)) {
    currentSelectedLinkId = id;
  }
}

export function getEdfaChannelsOverride() {
  return currentChannelsOverride;
}

export function setEdfaChannelsOverride(ch) {
  const num = parseInt(ch, 10);
  if (!Number.isNaN(num) && num > 0) {
    currentChannelsOverride = num;
  } else {
    currentChannelsOverride = null;
  }
}

export function getEdfaDgeEnabled() {
  return currentDgeEnabled;
}

export function setEdfaDgeEnabled(enabled) {
  currentDgeEnabled = !!enabled;
}

export function getEdfaAgcModeCode() {
  return currentAgcModeCode;
}

export function setEdfaAgcModeCode(mode) {
  if (EDFA_CASCADE_CONSTANTS.AGC_MODES[mode]) {
    currentAgcModeCode = mode;
  }
}

export function getEdfaSimulatedChannelDrop() {
  return currentSimulatedChannelDrop;
}

export function setEdfaSimulatedChannelDrop(dropped) {
  currentSimulatedChannelDrop = !!dropped;
}

export function resetEdfaSimState() {
  currentSelectedLinkId = EDFA_CASCADE_CONSTANTS.DEFAULT_LINK_ID;
  currentChannelsOverride = null;
  currentDgeEnabled = true;
  currentAgcModeCode = 'FAST_HARDWARE';
  currentSimulatedChannelDrop = false;
}

/**
 * Calculates ASE noise power per amplifier stage and cascaded end-to-end OSNR (dB).
 * Formulation: OSNR (dB) = Pin(dBm) - SpanLoss(dB) - NF(dB) - 10*log10(N_spans) + 58
 */
export function calculateCascadedOsnr(launchPowerDbm, spanLossDb, noiseFigureDb, spansCount) {
  const pin = parseFloat(launchPowerDbm) || 0;
  const loss = Math.max(1, parseFloat(spanLossDb) || 1);
  const nf = Math.max(3, parseFloat(noiseFigureDb) || 5);
  const n = Math.max(1, parseInt(spansCount, 10) || 1);

  // Optical Signal-to-Noise Ratio for N identical cascaded spans referred to 0.1nm bandwidth
  const osnrDb = pin - loss - nf - (10 * Math.log10(n)) + 58.0;
  const roundedOsnr = Math.round(osnrDb * 10) / 10;
  const sdFecMargin = Math.round((roundedOsnr - EDFA_CASCADE_CONSTANTS.SD_FEC_OSNR_THRESHOLD_DB) * 10) / 10;
  const hdFecMargin = Math.round((roundedOsnr - EDFA_CASCADE_CONSTANTS.HD_FEC_OSNR_THRESHOLD_DB) * 10) / 10;

  return {
    osnrDb: roundedOsnr,
    sdFecMargin,
    hdFecMargin,
    isSdFecCompliant: sdFecMargin >= 0,
    isHdFecCompliant: hdFecMargin >= 0
  };
}

/**
 * Calculates spectral gain ripple accumulation with or without Dynamic Gain Equalization (DGE).
 */
export function calculateGainRipple(spansCount, dgeEnabled = true) {
  const n = Math.max(1, parseInt(spansCount, 10) || 1);
  if (dgeEnabled) {
    return {
      peakRippleDb: EDFA_CASCADE_CONSTANTS.EQUALIZED_DGE_RIPPLE_DB,
      rippleStatus: 'nominal',
      description: 'Dynamic Gain Equalizer (DGE) active: residual ripple clamped to ±0.35 dB'
    };
  }

  // Without DGE, ripple accumulates across cascaded stages
  const rawRipple = Math.round(n * EDFA_CASCADE_CONSTANTS.RAW_EDFA_RIPPLE_PER_STAGE_DB * 10) / 10;
  return {
    peakRippleDb: rawRipple,
    rippleStatus: rawRipple > 4.0 ? 'critical' : 'warning',
    description: `DGE Offline: raw Erbium spectral tilt divergence accumulating across ${n} stages (±${rawRipple} dB)`
  };
}

/**
 * Calculates optical power transient surge during channel add/drop events.
 */
export function calculateTransientSurge(agcModeCode, isChannelDropped = false) {
  const mode = EDFA_CASCADE_CONSTANTS.AGC_MODES[agcModeCode] || EDFA_CASCADE_CONSTANTS.AGC_MODES.FAST_HARDWARE;
  if (!isChannelDropped) {
    return {
      transientSurgeDb: 0.0,
      responseTimeUs: mode.responseUs,
      surgeStatus: 'nominal',
      riskDescription: 'Steady-state multi-channel transmission; no optical transient surge present'
    };
  }

  const surge = mode.transientSurgeDb;
  const isHighSurge = surge >= 2.0;
  return {
    transientSurgeDb: surge,
    responseTimeUs: mode.responseUs,
    surgeStatus: isHighSurge ? 'critical' : 'nominal',
    riskDescription: isHighSurge
      ? `Severe transient power surge (+${surge} dB); nonlinear SPM/XPM threshold breached!`
      : `Fast AGC suppressed surge; clamped to safe level (+${surge} dB)`
  };
}

/**
 * Computes complete cascaded EDFA dynamics for the selected link and fleet summaries.
 */
export function calculateEdfaCascadeDynamics(state = {}, options = {}) {
  const selectedId = options.linkId || currentSelectedLinkId;
  const dge = (options.dgeEnabled !== undefined) ? options.dgeEnabled : currentDgeEnabled;
  const agcCode = options.agcMode || currentAgcModeCode;
  const channelDrop = (options.channelDrop !== undefined) ? options.channelDrop : currentSimulatedChannelDrop;

  const baseLink = SHAHDARA_EDFA_LINKS.find(l => l.id === selectedId) || SHAHDARA_EDFA_LINKS[0];

  const activeChannels = channelDrop ? 4 : (options.channels || currentChannelsOverride || baseLink.configuredChannels);

  // Compute average span loss
  const avgSpanLengthKm = baseLink.totalDistanceKm / baseLink.spansCount;
  const avgSpanLossDb = Math.round(avgSpanLengthKm * baseLink.fiberAttenuationDbPerKm * 10) / 10;

  // OSNR calculation
  const osnrCalc = calculateCascadedOsnr(
    baseLink.baseLaunchPowerDbm,
    avgSpanLossDb,
    baseLink.baseNoiseFigureDb,
    baseLink.spansCount
  );

  // Gain ripple
  const rippleCalc = calculateGainRipple(baseLink.spansCount, dge);

  // Transient surge
  const surgeCalc = calculateTransientSurge(agcCode, channelDrop);

  // Aggregate optical output power
  // P_total_dBm = P_ch_dBm + 10*log10(activeChannels) + surge
  const totalOpticalPowerDbm = Math.round(
    (baseLink.baseLaunchPowerDbm + (10 * Math.log10(activeChannels)) + surgeCalc.transientSurgeDb) * 10
  ) / 10;

  // Status & severity determination
  let overallStatus = EDFA_CASCADE_CONSTANTS.STATUS.OPTIMAL;
  let severity = 'nominal';

  if (!osnrCalc.isSdFecCompliant) {
    overallStatus = EDFA_CASCADE_CONSTANTS.STATUS.CRITICAL_NOISE;
    severity = 'critical';
  } else if (surgeCalc.surgeStatus === 'critical') {
    overallStatus = EDFA_CASCADE_CONSTANTS.STATUS.SURGE_ALERT;
    severity = 'critical';
  } else if (rippleCalc.rippleStatus === 'critical') {
    overallStatus = EDFA_CASCADE_CONSTANTS.STATUS.RIPPLE_SEVE;
    severity = 'critical';
  } else if (osnrCalc.sdFecMargin < 3.0) {
    overallStatus = EDFA_CASCADE_CONSTANTS.STATUS.MARGIN_WARNING;
    severity = 'warning';
  } else if (rippleCalc.rippleStatus === 'warning') {
    overallStatus = 'Warning: Spectral Gain Ripple Moderate (±' + rippleCalc.peakRippleDb + ' dB)';
    severity = 'warning';
  }

  // Fleet-wide aggregations
  const totalLinks = SHAHDARA_EDFA_LINKS.length;
  const totalAmplifiedDistanceKm = SHAHDARA_EDFA_LINKS.reduce((s, l) => s + l.totalDistanceKm, 0);
  const totalSpans = SHAHDARA_EDFA_LINKS.reduce((s, l) => s + l.spansCount, 0);
  const totalEdfaUnits = totalSpans + totalLinks; // 1 Booster + N-1 ILAs + 1 Pre-Amp per link
  const totalProtectedSubscribers = SHAHDARA_EDFA_LINKS.reduce((s, l) => s + l.subscribersCount, 0);
  const totalFleetMonthlyRevenue = SHAHDARA_EDFA_LINKS.reduce((s, l) => s + l.monthlyRevenuePkr, 0);

  return {
    link: {
      ...baseLink,
      activeChannels,
      avgSpanLossDb,
      avgSpanLengthKm: Math.round(avgSpanLengthKm * 10) / 10
    },
    dgeEnabled: dge,
    agcMode: EDFA_CASCADE_CONSTANTS.AGC_MODES[agcCode] || EDFA_CASCADE_CONSTANTS.AGC_MODES.FAST_HARDWARE,
    isChannelDropSimulated: channelDrop,
    osnr: osnrCalc,
    ripple: rippleCalc,
    surge: surgeCalc,
    totalOpticalPowerDbm,
    overallStatus,
    severity,
    aggregates: {
      totalLinks,
      totalAmplifiedDistanceKm: Math.round(totalAmplifiedDistanceKm * 10) / 10,
      totalSpans,
      totalEdfaUnits,
      totalProtectedSubscribers,
      totalFleetMonthlyRevenue
    }
  };
}

/**
 * Calculates fast metrics for dashboard cards.
 */
export function calculateEdfaCascadeMetrics(state = {}) {
  const dyn = calculateEdfaCascadeDynamics(state);
  return {
    linkName: dyn.link.name,
    distanceKm: dyn.link.totalDistanceKm,
    spansCount: dyn.link.spansCount,
    osnrDb: dyn.osnr.osnrDb,
    osnrMargin: dyn.osnr.sdFecMargin,
    peakRippleDb: dyn.ripple.peakRippleDb,
    totalPowerDbm: dyn.totalOpticalPowerDbm,
    statusText: dyn.overallStatus,
    severity: dyn.severity,
    subscribersProtected: dyn.aggregates.totalProtectedSubscribers,
    monthlyRevenuePkr: dyn.aggregates.totalFleetMonthlyRevenue
  };
}

/**
 * Pure client-side SVG renderer for Cascaded EDFA Chain & Optical Power Profile.
 */
export function renderEdfaCascadeSvg(dynamics, options = {}) {
  const d = dynamics || calculateEdfaCascadeDynamics();
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
  const svgHeight = compact ? 260 : 360;

  const link = d.link;
  const osnr = d.osnr;
  const ripple = d.ripple;
  const surge = d.surge;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" class="edfa-cascade-svg" style="width: 100%; height: auto; font-family: system-ui, -apple-system, sans-serif;">
    <defs>
      <linearGradient id="edfaGainGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
      </linearGradient>
      <linearGradient id="edfaNoiseGrad" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#ef4444" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#ef4444" stop-opacity="0.0" />
      </linearGradient>
      <filter id="edfaGlow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${svgWidth}" height="${svgHeight}" rx="10" fill="${bgFill}" stroke="${borderCol}" stroke-width="1.2" />

    <!-- Header Telemetry Ribbon -->
    <g transform="translate(18, 14)">
      <rect width="804" height="40" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
      <circle cx="16" cy="20" r="6" fill="${statusColor}" />
      <text x="32" y="24" font-size="12.5" font-weight="700" fill="${textMain}">
        DWDM TRUNK: ${escapeHtml(link.name.substring(0, 42))} (${link.totalDistanceKm} km · ${link.spansCount} Spans)
      </text>
      <text x="560" y="24" font-size="12" font-weight="600" fill="${textMuted}">
        End-to-End OSNR: <tspan fill="${statusColor}" font-weight="700">${osnr.osnrDb} dB</tspan> (Margin: +${osnr.sdFecMargin} dB)
      </text>
      <text x="740" y="24" font-size="11" font-weight="700" fill="${statusColor}">
        ${d.severity.toUpperCase()}
      </text>
    </g>

    <!-- Schematic: Tx -> Booster EDFA -> Span Reels + ILAs -> Pre-Amp -> Rx -->
    <g transform="translate(30, 68)">
      <!-- Optical Transmitter Tx -->
      <g transform="translate(0, 15)">
        <rect width="70" height="46" rx="6" fill="${cardFill}" stroke="#06b6d4" stroke-width="1.8" filter="url(#edfaGlow)" />
        <text x="35" y="22" font-size="10.5" font-weight="700" fill="#06b6d4" text-anchor="middle">DWDM Tx</text>
        <text x="35" y="36" font-size="9" fill="${textMuted}" text-anchor="middle">${link.activeChannels}ch C-Band</text>
      </g>

      <!-- Booster Amplifier (BA) Triangle -->
      <g transform="translate(85, 8)">
        <polygon points="0,0 45,30 0,60" fill="#10b981" opacity="0.9" filter="url(#edfaGlow)" />
        <text x="12" y="34" font-size="9.5" font-weight="800" fill="#ffffff">BA</text>
        <text x="22" y="74" font-size="8.5" fill="${textMuted}" text-anchor="middle">+${link.baseLaunchPowerDbm} dBm</text>
      </g>

      <!-- Span 1 Fiber Line -->
      <line x1="130" y1="38" x2="235" y2="38" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4,1" />
      <text x="182" y="30" font-size="8.5" font-weight="600" fill="${textMuted}" text-anchor="middle">Span 1 (${link.spanDistancesKm[0]} km)</text>
      <text x="182" y="52" font-size="8" fill="#ef4444" text-anchor="middle">-${link.avgSpanLossDb} dB</text>

      <!-- In-Line Amplifier 1 (ILA-1) Triangle -->
      <g transform="translate(235, 8)">
        <polygon points="0,0 45,30 0,60" fill="#8b5cf6" opacity="0.9" filter="url(#edfaGlow)" />
        <text x="10" y="34" font-size="9.5" font-weight="800" fill="#ffffff">ILA-1</text>
        <text x="22" y="74" font-size="8.5" fill="${textMuted}" text-anchor="middle">NF ${link.baseNoiseFigureDb}dB</text>
      </g>

      <!-- Span 2 Fiber Line -->
      <line x1="280" y1="38" x2="385" y2="38" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4,1" />
      <text x="332" y="30" font-size="8.5" font-weight="600" fill="${textMuted}" text-anchor="middle">Span 2 (${link.spanDistancesKm[1] || 20} km)</text>
      <text x="332" y="52" font-size="8" fill="#ef4444" text-anchor="middle">-${link.avgSpanLossDb} dB</text>

      <!-- Dynamic Gain Equalizer (DGE) Module -->
      <g transform="translate(385, 12)">
        <rect width="65" height="52" rx="6" fill="${cardFill}" stroke="${d.dgeEnabled ? '#10b981' : '#ef4444'}" stroke-width="1.8" filter="url(#edfaGlow)" />
        <text x="32" y="24" font-size="10" font-weight="700" fill="${d.dgeEnabled ? '#10b981' : '#ef4444'}" text-anchor="middle">DGE/GFF</text>
        <text x="32" y="40" font-size="8.5" font-weight="600" fill="${textMuted}" text-anchor="middle">${d.dgeEnabled ? 'Active' : 'OFF'}</text>
      </g>

      <!-- Span 3 / Final Line -->
      <line x1="450" y1="38" x2="555" y2="38" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4,1" />
      <text x="502" y="30" font-size="8.5" font-weight="600" fill="${textMuted}" text-anchor="middle">Span ${link.spansCount} (${link.spanDistancesKm[link.spansCount - 1]} km)</text>
      <text x="502" y="52" font-size="8" fill="#ef4444" text-anchor="middle">-${link.avgSpanLossDb} dB</text>

      <!-- Pre-Amplifier (PA) Triangle -->
      <g transform="translate(555, 8)">
        <polygon points="0,0 45,30 0,60" fill="#ec4899" opacity="0.9" filter="url(#edfaGlow)" />
        <text x="10" y="34" font-size="9.5" font-weight="800" fill="#ffffff">PA</text>
        <text x="22" y="74" font-size="8.5" fill="${textMuted}" text-anchor="middle">Gain +${link.avgSpanLossDb}dB</text>
      </g>

      <!-- Optical Receiver Rx -->
      <g transform="translate(620, 15)">
        <rect width="70" height="46" rx="6" fill="${cardFill}" stroke="#06b6d4" stroke-width="1.8" filter="url(#edfaGlow)" />
        <text x="35" y="22" font-size="10.5" font-weight="700" fill="#06b6d4" text-anchor="middle">DWDM Rx</text>
        <text x="35" y="36" font-size="9" fill="${textMuted}" text-anchor="middle">SD-FEC Coherent</text>
      </g>

      <!-- Fast AGC Loop Indicator -->
      <g transform="translate(705, 12)">
        <rect width="65" height="52" rx="6" fill="${cardFill}" stroke="${d.agcMode.code === 'FAST_HARDWARE' ? '#10b981' : '#f59e0b'}" stroke-width="1.5" />
        <text x="32" y="22" font-size="9" font-weight="700" fill="${textMain}" text-anchor="middle">AGC Loop</text>
        <text x="32" y="36" font-size="8" font-weight="700" fill="${d.agcMode.code === 'FAST_HARDWARE' ? '#10b981' : '#f59e0b'}" text-anchor="middle">${d.agcMode.responseUs} µs</text>
        <text x="32" y="47" font-size="7.5" fill="${textMuted}" text-anchor="middle">+${surge.transientSurgeDb}dB surge</text>
      </g>
    </g>

    <!-- Sawtooth Power Level Profile & ASE Noise Floor -->
    <g transform="translate(36, ${compact ? 165 : 185})">
      <rect width="768" height="65" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
      <text x="12" y="16" font-size="10" font-weight="700" fill="${textMuted}">OPTICAL POWER SAWTOOTH &amp; ASE NOISE ACCUMULATION (dBm)</text>

      <!-- Grid lines -->
      <line x1="80" y1="26" x2="750" y2="26" stroke="${borderCol}" stroke-width="0.8" stroke-dasharray="2,2" />
      <text x="70" y="29" font-size="8" fill="${textMuted}" text-anchor="end">+10 dBm</text>
      <line x1="80" y1="44" x2="750" y2="44" stroke="${borderCol}" stroke-width="0.8" stroke-dasharray="2,2" />
      <text x="70" y="47" font-size="8" fill="${textMuted}" text-anchor="end">0 dBm</text>

      <!-- Optical Power Sawtooth Polyline -->
      <polyline points="90,32 150,22 250,52 280,22 380,52 410,22 510,52 540,22 640,52 670,26" 
                fill="none" stroke="#10b981" stroke-width="2.5" />

      <!-- Cumulative ASE Noise Floor Polyline -->
      <polyline points="90,60 150,56 250,56 280,50 380,50 410,46 510,46 540,42 640,42 670,39" 
                fill="none" stroke="#ef4444" stroke-width="1.8" stroke-dasharray="3,2" />
      <text x="680" y="42" font-size="8.5" font-weight="700" fill="#ef4444">ASE Noise Floor</text>
    </g>

    ${!compact ? `
    <!-- Detail HUD Grid: OSNR Margin, Gain Ripple, Surge Protection -->
    <g transform="translate(36, 265)">
      <!-- Box 1: OSNR & FEC Margin -->
      <rect width="240" height="80" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
      <text x="12" y="18" font-size="10.5" font-weight="700" fill="${textMuted}">CASCADED OSNR METROLOGY</text>
      <text x="12" y="42" font-size="18" font-weight="800" fill="${statusColor}">${osnr.osnrDb} dB</text>
      <text x="12" y="60" font-size="9.5" fill="${textMuted}">SD-FEC Margin: <tspan font-weight="700" fill="${osnr.isSdFecCompliant ? '#10b981' : '#ef4444'}">+${osnr.sdFecMargin} dB</tspan></text>
      <text x="12" y="73" font-size="9" fill="${textMuted}">HD-FEC Margin: <tspan font-weight="600" fill="${textMain}">+${osnr.hdFecMargin} dB</tspan></text>

      <!-- Box 2: Spectral Gain Ripple -->
      <g transform="translate(260, 0)">
        <rect width="240" height="80" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
        <text x="12" y="18" font-size="10.5" font-weight="700" fill="${textMuted}">SPECTRAL GAIN RIPPLE (DGE)</text>
        <text x="12" y="42" font-size="18" font-weight="800" fill="${ripple.rippleStatus === 'critical' ? '#ef4444' : (ripple.rippleStatus === 'warning' ? '#f59e0b' : '#10b981')}">±${ripple.peakRippleDb} dB</text>
        <text x="12" y="60" font-size="9.5" fill="${textMuted}">DGE Status: <tspan font-weight="700" fill="${d.dgeEnabled ? '#10b981' : '#ef4444'}">${d.dgeEnabled ? 'Active (Flattened)' : 'Bypassed (Tilted)'}</tspan></text>
        <text x="12" y="73" font-size="8.5" fill="${textMuted}">${escapeHtml(ripple.description.substring(0, 42))}</text>
      </g>

      <!-- Box 3: Fast Optical AGC & Transient Surge -->
      <g transform="translate(520, 0)">
        <rect width="248" height="80" rx="6" fill="${cardFill}" stroke="${borderCol}" stroke-width="1" />
        <text x="12" y="18" font-size="10.5" font-weight="700" fill="${textMuted}">OPTICAL TRANSIENT &amp; AGC</text>
        <text x="12" y="42" font-size="18" font-weight="800" fill="${surge.surgeStatus === 'critical' ? '#ef4444' : '#10b981'}">+${surge.transientSurgeDb} dB</text>
        <text x="12" y="60" font-size="9.5" fill="${textMuted}">AGC Response: <tspan font-weight="700" fill="${textMain}">${d.agcMode.responseUs} µs</tspan></text>
        <text x="12" y="73" font-size="9" fill="${textMuted}">Total Power: <tspan font-weight="700" fill="#3b82f6">+${d.totalOpticalPowerDbm} dBm</tspan></text>
      </g>
    </g>
    ` : ''}
  </svg>
  `;
}

/**
 * Generates Outside Plant / Optical Transmission Engineering Audit Report.
 */
export function generateEdfaCascadeReport(dynamics) {
  const d = dynamics || calculateEdfaCascadeDynamics();
  const l = d.link;
  const o = d.osnr;
  const r = d.ripple;
  const s = d.surge;

  return `========================================================================
SHAHDARA ISP DWDM CASCADED EDFA OPTICAL TRANSMISSION AUDIT REPORT
Standards: ITU-T G.692 / G.661 / G.662 / G.680
Date/Time (PKT): ${new Date().toISOString()}
========================================================================

1. TARGET DWDM ROUTE IDENTIFICATION & TOPOLOGY:
------------------------------------------------------------------------
• Route Name:             ${l.name}
• Primary Area:           ${l.primaryArea} <-> ${l.targetArea}
• Total Optical Distance: ${l.totalDistanceKm} km
• Cascaded Spans:         ${l.spansCount} Spans (Avg span: ${l.avgSpanLengthKm} km)
• Fiber Attenuation:      ${l.fiberAttenuationDbPerKm} dB/km (Avg span loss: ${l.avgSpanLossDb} dB)
• Active DWDM Channels:   ${l.activeChannels} channels (C-Band Grid)
• Channel Launch Power:   +${l.baseLaunchPowerDbm} dBm
• EDFA Noise Figure (NF): ${l.baseNoiseFigureDb} dB
• Total Aggregate Power:  +${d.totalOpticalPowerDbm} dBm
• Protected Subscribers:  ${l.subscribersCount} Active Fiber Subscribers
• Monthly Route Revenue:  ${formatPKR(l.monthlyRevenuePkr)}

2. CASCADED OSNR & ASE NOISE METROLOGY:
------------------------------------------------------------------------
• End-to-End OSNR:        ${o.osnrDb} dB (0.1 nm resolution bandwidth)
• SD-FEC Threshold:       ${EDFA_CASCADE_CONSTANTS.SD_FEC_OSNR_THRESHOLD_DB} dB
• SD-FEC Margin:          +${o.sdFecMargin} dB (${o.isSdFecCompliant ? 'PASS - Zero Uncorrectable Errors' : 'FAIL - Bit Error Rate Elevated'})
• HD-FEC Margin:          +${o.hdFecMargin} dB (${o.isHdFecCompliant ? 'PASS' : 'FAIL'})
• Amplified Spontaneous Emission: Linearly accumulating across ${l.spansCount} stages

3. SPECTRAL GAIN EQUALIZATION (DGE / GFF):
------------------------------------------------------------------------
• Dynamic Gain Equalizer: ${d.dgeEnabled ? 'ENABLED (WSS-based dynamic attenuation)' : 'DISABLED (Raw unflattened ripple)'}
• Peak Spectral Ripple:   ±${r.peakRippleDb} dB across active channels
• Ripple Assessment:      ${r.description}

4. FAST AGC & TRANSIENT SURGE CONTROL:
------------------------------------------------------------------------
• AGC Circuit Architecture: ${d.agcMode.name}
• Loop Response Speed:    ${d.agcMode.responseUs} µs
• Channel Drop Simulated: ${d.isChannelDropSimulated ? 'YES (Dropped to 4 surviving channels)' : 'NO (Steady-state operation)'}
• Transient Optical Surge: +${s.transientSurgeDb} dB
• Nonlinear Safety Risk:  ${s.riskDescription}

5. OVERALL STATUS & NETWORK HEALTH:
------------------------------------------------------------------------
• Health Code:            ${d.overallStatus}
• Severity Level:         ${d.severity.toUpperCase()}
• Fleet Transmission Stats:
  - Total Amplified Links:  ${d.aggregates.totalLinks}
  - Total Optical Distance: ${d.aggregates.totalAmplifiedDistanceKm} km
  - Total Installed EDFAs:  ${d.aggregates.totalEdfaUnits} Amplifiers
  - Total Protected Users:  ${d.aggregates.totalProtectedSubscribers}
  - Total Fleet Revenue:    ${formatPKR(d.aggregates.totalFleetMonthlyRevenue)} / month
========================================================================`;
}

/**
 * Exports Cascaded EDFA data to JSON.
 */
export function exportEdfaCascadeJson(dynamics) {
  const d = dynamics || calculateEdfaCascadeDynamics();
  const jsonStr = JSON.stringify(d, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-edfa-${d.link.id}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports Cascaded EDFA data to RFC-4180 CSV.
 */
export function exportEdfaCascadeCsv(dynamics) {
  const d = dynamics || calculateEdfaCascadeDynamics();
  const rows = [
    ['Link ID', 'Link Name', 'Primary Area', 'Distance Km', 'Spans', 'Channels', 'OSNR dB', 'SD-FEC Margin dB', 'Ripple dB', 'DGE Enabled', 'AGC Response us', 'Surge dB', 'Total Power dBm', 'Subscribers', 'Revenue PKR', 'Status']
  ];

  SHAHDARA_EDFA_LINKS.forEach(l => {
    const isSelected = l.id === d.link.id;
    const ch = isSelected ? d.link.activeChannels : l.configuredChannels;
    const avgLoss = (l.totalDistanceKm / l.spansCount) * l.fiberAttenuationDbPerKm;
    const osnrRes = calculateCascadedOsnr(l.baseLaunchPowerDbm, avgLoss, l.baseNoiseFigureDb, l.spansCount);
    const ripRes = calculateGainRipple(l.spansCount, isSelected ? d.dgeEnabled : true);

    rows.push([
      l.id,
      `"${l.name}"`,
      l.primaryArea,
      l.totalDistanceKm,
      l.spansCount,
      ch,
      osnrRes.osnrDb,
      osnrRes.sdFecMargin,
      ripRes.peakRippleDb,
      isSelected ? (d.dgeEnabled ? 'YES' : 'NO') : 'YES',
      isSelected ? d.agcMode.responseUs : 80,
      isSelected ? d.surge.transientSurgeDb : 0.0,
      isSelected ? d.totalOpticalPowerDbm : (l.baseLaunchPowerDbm + 10 * Math.log10(ch)),
      l.subscribersCount,
      l.monthlyRevenuePkr,
      isSelected ? `"${d.overallStatus}"` : '"Nominal"'
    ]);
  });

  const csvContent = rows.map(r => r.join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-edfa-cascade-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Helper to escape HTML characters.
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
 * Wires up interactive controls inside the Cascaded EDFA modal dialog.
 */
export function setupEdfaCascadeModal(state = {}, options = {}) {
  const modal = document.getElementById('dashboardEdfaCascadeModal');
  if (!modal) return;

  const openBtn = document.getElementById('dashboardOpenEdfaCascadeModalBtn');
  const closeBtn = document.getElementById('dashboardEdfaCascadeModalCloseBtn');

  const linkSelect = document.getElementById('edfaLinkSelect');
  const dgeToggle = document.getElementById('edfaDgeToggle');
  const agcSelect = document.getElementById('edfaAgcModeSelect');
  const chDropBtn = document.getElementById('edfaSurgeTestBtn');
  const resetBtn = document.getElementById('edfaResetBtn');

  const statOsnr = document.getElementById('edfaStatOsnr');
  const statMargin = document.getElementById('edfaStatMargin');
  const statRipple = document.getElementById('edfaStatRipple');
  const statSurge = document.getElementById('edfaStatSurge');
  const statStatusBadge = document.getElementById('edfaStatStatusBadge');

  const svgContainer = document.getElementById('dashboardEdfaCascadeModalSvgContainer');
  const copyReportBtn = document.getElementById('edfaCopyReportBtn');
  const exportJsonBtn = document.getElementById('edfaExportJsonBtn');
  const exportCsvBtn = document.getElementById('edfaExportCsvBtn');

  function updateUi() {
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    const dyn = calculateEdfaCascadeDynamics(state);

    if (svgContainer) {
      svgContainer.innerHTML = renderEdfaCascadeSvg(dyn, { isDark, compact: false });
    }

    const cardSvg = document.getElementById('dashboardEdfaCascadeChart');
    if (cardSvg) {
      cardSvg.innerHTML = renderEdfaCascadeSvg(dyn, { isDark, compact: true });
    }

    if (statOsnr) {
      statOsnr.textContent = `${dyn.osnr.osnrDb} dB`;
    }
    if (statMargin) {
      statMargin.textContent = `+${dyn.osnr.sdFecMargin} dB (SD-FEC)`;
      statMargin.className = `optical-evm-stat-val ${dyn.osnr.isSdFecCompliant ? 'optimal' : 'critical'}`;
    }
    if (statRipple) {
      statRipple.textContent = `±${dyn.ripple.peakRippleDb} dB`;
      statRipple.className = `optical-evm-stat-val ${dyn.ripple.rippleStatus === 'nominal' ? 'optimal' : 'warning'}`;
    }
    if (statSurge) {
      statSurge.textContent = `+${dyn.surge.transientSurgeDb} dB (${dyn.agcMode.responseUs}µs)`;
    }
    if (statStatusBadge) {
      statStatusBadge.textContent = dyn.overallStatus;
      statStatusBadge.className = `status-badge badge-${dyn.severity}`;
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

  if (linkSelect && !linkSelect.dataset.wired) {
    linkSelect.dataset.wired = 'true';
    linkSelect.addEventListener('change', (e) => {
      setEdfaSelectedLinkId(e.target.value);
      updateUi();
    });
  }

  if (dgeToggle && !dgeToggle.dataset.wired) {
    dgeToggle.dataset.wired = 'true';
    dgeToggle.addEventListener('change', (e) => {
      setEdfaDgeEnabled(e.target.checked);
      updateUi();
    });
  }

  if (agcSelect && !agcSelect.dataset.wired) {
    agcSelect.dataset.wired = 'true';
    agcSelect.addEventListener('change', (e) => {
      setEdfaAgcModeCode(e.target.value);
      updateUi();
    });
  }

  if (chDropBtn && !chDropBtn.dataset.wired) {
    chDropBtn.dataset.wired = 'true';
    chDropBtn.addEventListener('click', () => {
      const next = !getEdfaSimulatedChannelDrop();
      setEdfaSimulatedChannelDrop(next);
      chDropBtn.textContent = next ? '⚠️ Recover Channels (Normal)' : '⚡ Simulate 75% Channel Drop Surge';
      updateUi();
    });
  }

  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = 'true';
    resetBtn.addEventListener('click', () => {
      resetEdfaSimState();
      if (linkSelect) linkSelect.value = EDFA_CASCADE_CONSTANTS.DEFAULT_LINK_ID;
      if (dgeToggle) dgeToggle.checked = true;
      if (agcSelect) agcSelect.value = 'FAST_HARDWARE';
      if (chDropBtn) chDropBtn.textContent = '⚡ Simulate 75% Channel Drop Surge';
      updateUi();
    });
  }

  if (copyReportBtn && !copyReportBtn.dataset.wired) {
    copyReportBtn.dataset.wired = 'true';
    copyReportBtn.addEventListener('click', async () => {
      const dyn = calculateEdfaCascadeDynamics(state);
      const text = generateEdfaCascadeReport(dyn);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          if (options.onToast) options.onToast('Cascaded EDFA Report copied to clipboard!');
        } else {
          window.prompt('Copy Cascaded EDFA Report:', text);
        }
      } catch (err) {
        window.prompt('Copy Cascaded EDFA Report:', text);
      }
    });
  }

  if (exportJsonBtn && !exportJsonBtn.dataset.wired) {
    exportJsonBtn.dataset.wired = 'true';
    exportJsonBtn.addEventListener('click', () => {
      const dyn = calculateEdfaCascadeDynamics(state);
      exportEdfaCascadeJson(dyn);
    });
  }

  if (exportCsvBtn && !exportCsvBtn.dataset.wired) {
    exportCsvBtn.dataset.wired = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const dyn = calculateEdfaCascadeDynamics(state);
      exportEdfaCascadeCsv(dyn);
    });
  }

  // Initial render
  updateUi();
}
