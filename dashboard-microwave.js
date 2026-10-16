import { formatPKR } from './core.js';

/**
 * Microwave Wireless Backhaul Rain Fade Attenuation & Link Budget Forecast
 * Models Point-to-Point (PtP) wireless backhauls across the River Ravi and Shahdara towers,
 * incorporating ITU-R P.838 rain fade attenuation, Free Space Path Loss (FSPL),
 * 1st Fresnel zone clearance, dynamic adaptive modulation (QAM/QPSK),
 * link fade margin, and monsoon weather impairment forecasts.
 */

export const SHAHDARA_MICROWAVE_LINKS = [
  {
    id: 'station-to-vandala',
    name: 'Central Station POP to Vandala Water Tower Trunk',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    distanceKm: 3.8,
    carrierFreqGhz: 24.0, // 24 GHz ISM/PtP (airFiber 24HD)
    txPowerDbm: 20,
    txAntennaGainDbi: 33,
    rxAntennaGainDbi: 33,
    cableLossDb: 2.0,
    nominalThroughputMbps: 1024, // 1 Gbps Full Duplex
    sensitivityThresholdDbm: -71, // 256-QAM minimum sensitivity
    failoverThresholdDbm: -84, // QPSK modulation disconnect floor
    towerHeightTxM: 35,
    towerHeightRxM: 42,
    defaultRainRateMmH: 0
  },
  {
    id: 'station-to-saeed-park',
    name: 'Station Tower to Saeed Park Agricultural Silo',
    primaryArea: 'Saeed Park',
    aliasAreas: ['Saeed Park', 'Tariq Road'],
    distanceKm: 5.4,
    carrierFreqGhz: 11.0, // 11 GHz Licensed PtP (Mimosa B11)
    txPowerDbm: 24,
    txAntennaGainDbi: 28,
    rxAntennaGainDbi: 28,
    cableLossDb: 2.5,
    nominalThroughputMbps: 650,
    sensitivityThresholdDbm: -68,
    failoverThresholdDbm: -81,
    towerHeightTxM: 35,
    towerHeightRxM: 38,
    defaultRainRateMmH: 0
  },
  {
    id: 'chowk-to-riverfront',
    name: 'Shahdara Chowk to Riverfront Ravi Mast',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Ravi Riverfront'],
    distanceKm: 6.8, // Long cross-river reach
    carrierFreqGhz: 5.8, // 5 GHz UNII-3 (LTU Rocket / AF-5XHD)
    txPowerDbm: 27,
    txAntennaGainDbi: 30,
    rxAntennaGainDbi: 30,
    cableLossDb: 2.0,
    nominalThroughputMbps: 350,
    sensitivityThresholdDbm: -65,
    failoverThresholdDbm: -79,
    towerHeightTxM: 45,
    towerHeightRxM: 32,
    defaultRainRateMmH: 0
  },
  {
    id: 'jia-musa-micro-pop',
    name: 'Jia Musa Rooftop High-Capacity Micro-Backhaul',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Ghazi Park'],
    distanceKm: 1.8,
    carrierFreqGhz: 60.0, // 60 GHz V-Band (airFiber 60 LR with 5GHz failover)
    txPowerDbm: 18,
    txAntennaGainDbi: 38,
    rxAntennaGainDbi: 38,
    cableLossDb: 1.5,
    nominalThroughputMbps: 1800, // 1.8 Gbps Multi-Gigabit
    sensitivityThresholdDbm: -62,
    failoverThresholdDbm: -76,
    towerHeightTxM: 28,
    towerHeightRxM: 26,
    defaultRainRateMmH: 0
  },
  {
    id: 'begum-kot-interconnect',
    name: 'Begum Kot Industrial Ring Interconnect',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Sheikhupura Road'],
    distanceKm: 4.5,
    carrierFreqGhz: 11.0,
    txPowerDbm: 23,
    txAntennaGainDbi: 29,
    rxAntennaGainDbi: 29,
    cableLossDb: 2.2,
    nominalThroughputMbps: 500,
    sensitivityThresholdDbm: -69,
    failoverThresholdDbm: -82,
    towerHeightTxM: 36,
    towerHeightRxM: 30,
    defaultRainRateMmH: 0
  }
];

let selectedLinkId = 'station-to-vandala';
let simulatedRainRateMmH = 15; // Moderate rain by default
let simulatedFreqOverride = null; // null = use link default

export function getMicrowaveSelectedLink() {
  return selectedLinkId;
}

export function setMicrowaveSelectedLink(linkId) {
  if (SHAHDARA_MICROWAVE_LINKS.some(l => l.id === linkId)) {
    selectedLinkId = linkId;
  }
}

export function getMicrowaveRainRate() {
  return simulatedRainRateMmH;
}

export function setMicrowaveRainRate(mmh) {
  const num = Number(mmh);
  if (!isNaN(num)) {
    simulatedRainRateMmH = Math.max(0, Math.min(150, Math.round(num)));
  }
}

export function getMicrowaveFrequencyOverride() {
  return simulatedFreqOverride;
}

export function setMicrowaveFrequencyOverride(freq) {
  if (freq === null || freq === undefined || freq === '' || freq === 'default') {
    simulatedFreqOverride = null;
  } else {
    const num = Number(freq);
    simulatedFreqOverride = isNaN(num) ? null : num;
  }
}

function escapeXml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Calculates ITU-R P.838 rain fade attenuation coefficients (k, alpha) for given frequency (GHz)
 */
function getItuRainCoefficients(freqGhz) {
  // ITU-R P.838 approximation curve for vertical/horizontal polarization average
  if (freqGhz <= 6) {
    return { k: 0.00035, alpha: 1.25 };
  } else if (freqGhz <= 12) {
    return { k: 0.0185, alpha: 1.18 };
  } else if (freqGhz <= 18) {
    return { k: 0.065, alpha: 1.09 };
  } else if (freqGhz <= 28) {
    return { k: 0.155, alpha: 1.04 };
  } else if (freqGhz <= 42) {
    return { k: 0.38, alpha: 0.95 };
  } else if (freqGhz <= 65) {
    return { k: 0.78, alpha: 0.89 };
  } else {
    return { k: 1.15, alpha: 0.84 };
  }
}

/**
 * Computes RF link budget, free space path loss, rain attenuation, received signal level (RSL),
 * fade margin, adaptive modulation throughput, and subscriber revenue at risk.
 */
export function calculateMicrowaveLinkBudget(state, options = {}) {
  const activeLinkId = options.linkId || selectedLinkId;
  const link = SHAHDARA_MICROWAVE_LINKS.find(l => l.id === activeLinkId) || SHAHDARA_MICROWAVE_LINKS[0];

  const rainRate = options.rainRate !== undefined ? Number(options.rainRate) : simulatedRainRateMmH;
  const freqGhz = options.frequencyGhz || simulatedFreqOverride || link.carrierFreqGhz;

  // 1. Free Space Path Loss (FSPL): FSPL = 20*log10(d) + 20*log10(f) + 92.45
  const dKm = link.distanceKm;
  const fsplDb = (20 * Math.log10(dKm)) + (20 * Math.log10(freqGhz)) + 92.45;

  // 2. Atmospheric & Oxygen Absorption Gas Loss: ~0.02 dB/km at 5GHz, up to 15 dB/km at 60GHz O2 line
  let atmosphericGasCoeffDbKm = 0.04;
  if (freqGhz >= 55 && freqGhz <= 65) {
    // 60 GHz Oxygen absorption peak
    atmosphericGasCoeffDbKm = 14.5;
  } else if (freqGhz >= 20 && freqGhz <= 26) {
    atmosphericGasCoeffDbKm = 0.18; // Water vapor resonance peak
  }
  const gasLossDb = atmosphericGasCoeffDbKm * dKm;

  // 3. ITU-R P.838 Specific Rain Attenuation: gamma_R = k * (R ^ alpha) [dB/km]
  const { k, alpha } = getItuRainCoefficients(freqGhz);
  const specificRainAttenuationDbKm = rainRate > 0 ? (k * Math.pow(rainRate, alpha)) : 0;

  // Effective path reduction factor (ITU-R P.530 path length reduction factor)
  const d0 = 35 * Math.exp(-0.015 * rainRate);
  const pathReductionFactor = 1 / (1 + (dKm / Math.max(1, d0)));
  const totalRainAttenuationDb = specificRainAttenuationDbKm * dKm * pathReductionFactor;

  // 4. Total Received Signal Level (RSL) in dBm:
  // RSL = P_tx + G_tx + G_rx - L_cable - FSPL - GasLoss - RainLoss
  const clearSkyRslDbm = link.txPowerDbm + link.txAntennaGainDbi + link.rxAntennaGainDbi - link.cableLossDb - fsplDb - gasLossDb;
  const actualRslDbm = clearSkyRslDbm - totalRainAttenuationDb;

  // 5. Fade Margin (dB) above threshold:
  const clearSkyFadeMarginDb = clearSkyRslDbm - link.sensitivityThresholdDbm;
  const actualFadeMarginDb = actualRslDbm - link.sensitivityThresholdDbm;
  const disconnectMarginDb = actualRslDbm - link.failoverThresholdDbm;

  // 6. 1st Fresnel Zone Radius at mid-span: R1 = 17.32 * sqrt((d/2 * d/2) / (f * d)) = 8.66 * sqrt(d / f)
  const midFresnelRadiusMeters = 8.66 * Math.sqrt(dKm / freqGhz);

  // 7. Dynamic Adaptive Modulation & Throughput Realization
  let modulationScheme = '256-QAM / 1024-QAM';
  let modulationEfficiencyPercent = 100;
  let statusTier = 'optimal';
  let statusLabel = 'FULL CAPACITY (EXCELLENT)';
  let statusBadgeClass = 'badge-success';
  let diagnosticNotes = 'Link is operating at peak modulation with robust fade headroom.';

  if (actualRslDbm < link.failoverThresholdDbm) {
    modulationScheme = 'OUTAGE / LINK DISCONNECTED';
    modulationEfficiencyPercent = 0;
    statusTier = 'critical';
    statusLabel = 'MONSOON RAIN OUTAGE';
    statusBadgeClass = 'badge-danger';
    diagnosticNotes = `Rain fade attenuation (${totalRainAttenuationDb.toFixed(1)} dB) exceeds link budget. Signal (${actualRslDbm.toFixed(1)} dBm) is below hardware sensitivity (${link.failoverThresholdDbm} dBm).`;
  } else if (actualFadeMarginDb < 0) {
    modulationScheme = 'QPSK (Failover Low-Rate)';
    modulationEfficiencyPercent = 25;
    statusTier = 'critical';
    statusLabel = 'SEVERE DEGRADATION (QPSK)';
    statusBadgeClass = 'badge-danger';
    diagnosticNotes = `Link dropped to minimum modulation QPSK. Throughput heavily throttled to 25% due to heavy ${rainRate} mm/h precipitation.`;
  } else if (actualFadeMarginDb < 10) {
    modulationScheme = '16-QAM (Rain Constrained)';
    modulationEfficiencyPercent = 55;
    statusTier = 'warning';
    statusLabel = 'RAIN FADE THROTTLED (16-QAM)';
    statusBadgeClass = 'badge-warning';
    diagnosticNotes = `Fade margin narrowed to ${actualFadeMarginDb.toFixed(1)} dB. Adaptive modulation stepped down to protect packet integrity.`;
  } else if (actualFadeMarginDb < 20) {
    modulationScheme = '64-QAM (Sub-Optimal)';
    modulationEfficiencyPercent = 80;
    statusTier = 'elevated';
    statusLabel = 'MODERATE FADE (64-QAM)';
    statusBadgeClass = 'badge-warning';
    diagnosticNotes = `Minor rain fade detected; throughput maintained at 80% nominal speed.`;
  }

  const effectiveThroughputMbps = Math.round((link.nominalThroughputMbps * modulationEfficiencyPercent) / 100);

  // 8. Ledger Integration & Customer Impact
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const linkAreasSet = new Set(link.aliasAreas.map(a => a.toLowerCase().trim()));

  let totalAreaCustomers = 0;
  let activeSubscribers = 0;
  let offlineSubscribers = 0;
  let totalMonthlyBilledPkr = 0;

  for (const c of customers) {
    if (c.archived) continue;
    const cArea = String(c.area ?? '').toLowerCase().trim();
    if (linkAreasSet.has(cArea)) {
      totalAreaCustomers++;
      if (c.serviceStatus === 'offline') {
        offlineSubscribers++;
      } else {
        activeSubscribers++;
      }
      const monthlyRate = Number(c.monthlyRate ?? c.packageRate ?? 0) || 0;
      totalMonthlyBilledPkr += monthlyRate;
    }
  }

  const revenueAtRiskPkr = statusTier === 'critical'
    ? totalMonthlyBilledPkr
    : statusTier === 'warning'
      ? Math.round(totalMonthlyBilledPkr * 0.60)
      : Math.round(totalMonthlyBilledPkr * 0.15);

  // 9. Fleet Summary for all Shahdara Wireless Links
  const fleetSummary = SHAHDARA_MICROWAVE_LINKS.map(l => {
    const fGhz = l.id === link.id ? freqGhz : l.carrierFreqGhz;
    const fspl = (20 * Math.log10(l.distanceKm)) + (20 * Math.log10(fGhz)) + 92.45;
    let gas = 0.04;
    if (fGhz >= 55 && fGhz <= 65) gas = 14.5;
    else if (fGhz >= 20 && fGhz <= 26) gas = 0.18;
    const gasL = gas * l.distanceKm;

    const coef = getItuRainCoefficients(fGhz);
    const gamma = rainRate > 0 ? (coef.k * Math.pow(rainRate, coef.alpha)) : 0;
    const red = 1 / (1 + (l.distanceKm / Math.max(1, 35 * Math.exp(-0.015 * rainRate))));
    const rainLoss = gamma * l.distanceKm * red;

    const clearRsl = l.txPowerDbm + l.txAntennaGainDbi + l.rxAntennaGainDbi - l.cableLossDb - fspl - gasL;
    const curRsl = clearRsl - rainLoss;
    const fMargin = curRsl - l.sensitivityThresholdDbm;

    let tier = 'optimal';
    if (curRsl < l.failoverThresholdDbm) tier = 'critical';
    else if (fMargin < 0) tier = 'critical';
    else if (fMargin < 10) tier = 'warning';
    else if (fMargin < 20) tier = 'elevated';

    return {
      linkId: l.id,
      name: l.name,
      primaryArea: l.primaryArea,
      distanceKm: l.distanceKm,
      frequencyGhz: fGhz,
      clearSkyRslDbm: Number(clearRsl.toFixed(1)),
      actualRslDbm: Number(curRsl.toFixed(1)),
      rainAttenuationDb: Number(rainLoss.toFixed(1)),
      fadeMarginDb: Number(fMargin.toFixed(1)),
      statusTier: tier
    };
  });

  return {
    link,
    inputs: {
      rainRateMmH: rainRate,
      carrierFreqGhz: freqGhz
    },
    budget: {
      distanceKm: dKm,
      carrierFreqGhz: freqGhz,
      fsplDb: Number(fsplDb.toFixed(1)),
      gasLossDb: Number(gasLossDb.toFixed(1)),
      specificRainAttenuationDbKm: Number(specificRainAttenuationDbKm.toFixed(2)),
      totalRainAttenuationDb: Number(totalRainAttenuationDb.toFixed(1)),
      clearSkyRslDbm: Number(clearSkyRslDbm.toFixed(1)),
      actualRslDbm: Number(actualRslDbm.toFixed(1)),
      clearSkyFadeMarginDb: Number(clearSkyFadeMarginDb.toFixed(1)),
      actualFadeMarginDb: Number(actualFadeMarginDb.toFixed(1)),
      disconnectMarginDb: Number(disconnectMarginDb.toFixed(1)),
      midFresnelRadiusMeters: Number(midFresnelRadiusMeters.toFixed(1)),
      modulationScheme,
      modulationEfficiencyPercent,
      effectiveThroughputMbps
    },
    risk: {
      statusTier,
      statusLabel,
      statusBadgeClass,
      diagnosticNotes
    },
    ledger: {
      totalAreaCustomers,
      activeSubscribers,
      offlineSubscribers,
      totalMonthlyBilledPkr,
      revenueAtRiskPkr
    },
    fleetSummary
  };
}

/**
 * Pure client-side SVG diagram illustrating PtP microwave tower antennas,
 * Fresnel ellipsoid beam envelope, rainfall precipitation curtain,
 * and real-time signal RSSI bar gauge.
 */
export function renderMicrowaveLinkSvg(data) {
  if (!data || !data.link || !data.budget) {
    return `<div class="chart-empty-state"><p>No microwave link budget data available.</p></div>`;
  }

  const { link, inputs, budget, risk } = data;
  const width = 680;
  const height = 310;

  const groundY = 250;
  const towerLeftX = 110;
  const towerRightX = 570;
  const antennaLeftY = 120;
  const antennaRightY = 115;
  const midX = (towerLeftX + towerRightX) / 2;
  const midY = (antennaLeftY + antennaRightY) / 2;

  // Fresnel zone height scaling (meters to pixels)
  const fresnelRadiusPx = Math.min(65, Math.max(18, budget.midFresnelRadiusMeters * 3.5));

  // Visual rain opacity and slant particles
  const rainDropsCount = Math.min(24, Math.max(0, Math.round(inputs.rainRateMmH / 4)));
  let rainLinesSvg = '';
  for (let i = 0; i < rainDropsCount; i++) {
    const rx = 180 + (i * 16) + (i % 3 * 7);
    const ry = 40 + (i % 5 * 22);
    rainLinesSvg += `
      <line x1="${rx}" y1="${ry}" x2="${rx - 14}" y2="${ry + 28}" stroke="#38bdf8" stroke-width="1.6" stroke-linecap="round" opacity="0.75" />
    `;
  }

  // Beam color based on risk tier
  let beamStroke = '#38bdf8';
  let beamFill = 'rgba(56, 189, 248, 0.14)';
  if (risk.statusTier === 'critical') {
    beamStroke = '#ef4444';
    beamFill = 'rgba(239, 68, 68, 0.16)';
  } else if (risk.statusTier === 'warning') {
    beamStroke = '#f59e0b';
    beamFill = 'rgba(245, 158, 11, 0.14)';
  } else if (risk.statusTier === 'elevated') {
    beamStroke = '#eab308';
    beamFill = 'rgba(234, 179, 8, 0.12)';
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" class="microwave-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Microwave Wireless Backhaul Rain Fade Diagram">
      <defs>
        <linearGradient id="mwSkyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1e293b" />
        </linearGradient>
        <linearGradient id="towerGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#475569" />
          <stop offset="50%" stop-color="#94a3b8" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
      </defs>

      <!-- Sky Background -->
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#mwSkyGrad)" rx="8" />

      <!-- Rain Precipitation Animation Layer -->
      <g class="rain-precipitation">
        ${rainLinesSvg}
        <text x="180" y="50" fill="#38bdf8" font-size="11" font-weight="700">PRECIPITATION: ${inputs.rainRateMmH} mm/h (Fade Loss: -${budget.totalRainAttenuationDb} dB)</text>
      </g>

      <!-- Ground Terrain & River Ravi Base -->
      <rect x="20" y="${groundY}" width="${width - 40}" height="${height - groundY - 10}" fill="#0f172a" rx="2" />
      <line x1="20" y1="${groundY}" x2="${width - 20}" y2="${groundY}" stroke="#475569" stroke-width="2.5" />
      <text x="32" y="${groundY + 22}" fill="#94a3b8" font-size="11" font-weight="600">Shahdara / Ravi River Basin Ground Elevation</text>

      <!-- 1st Fresnel Zone Ellipsoid Envelope -->
      <ellipse cx="${midX}" cy="${midY}" rx="${(towerRightX - towerLeftX) / 2 - 10}" ry="${fresnelRadiusPx}" fill="${beamFill}" stroke="${beamStroke}" stroke-width="1.8" stroke-dasharray="6,4" />

      <!-- Direct PtP Microwave Line-of-Sight Beam Core -->
      <line x1="${towerLeftX}" y1="${antennaLeftY}" x2="${towerRightX}" y2="${antennaRightY}" stroke="${beamStroke}" stroke-width="3" stroke-linecap="round" />
      <line x1="${towerLeftX}" y1="${antennaLeftY}" x2="${towerRightX}" y2="${antennaRightY}" stroke="#ffffff" stroke-width="1" stroke-dasharray="4,4" opacity="0.8" />

      <!-- Left Transmit Lattice Mast Tower -->
      <g class="tower-tx">
        <polygon points="${towerLeftX - 16},${groundY} ${towerLeftX + 16},${groundY} ${towerLeftX + 5},${antennaLeftY - 15} ${towerLeftX - 5},${antennaLeftY - 15}" fill="url(#towerGrad)" opacity="0.85" />
        <!-- Antenna Mast Pole -->
        <rect x="${towerLeftX - 3}" y="${antennaLeftY - 22}" width="6" height="30" fill="#64748b" />
        <!-- Parabolic Dish Antenna (facing right) -->
        <path d="M ${towerLeftX + 4} ${antennaLeftY - 12} C ${towerLeftX - 6} ${antennaLeftY} ${towerLeftX - 6} ${antennaLeftY} ${towerLeftX + 4} ${antennaLeftY + 12} Z" fill="#0284c7" stroke="#e0f2fe" stroke-width="1.5" />
        <circle cx="${towerLeftX + 6}" cy="${antennaLeftY}" r="3" fill="#f8fafc" />
        <text x="${towerLeftX}" y="${groundY + 36}" fill="#cbd5e1" font-size="10" font-weight="600" text-anchor="middle">Tx Tower (35m)</text>
      </g>

      <!-- Right Receive Lattice Mast Tower -->
      <g class="tower-rx">
        <polygon points="${towerRightX - 16},${groundY} ${towerRightX + 16},${groundY} ${towerRightX + 5},${antennaRightY - 15} ${towerRightX - 5},${antennaRightY - 15}" fill="url(#towerGrad)" opacity="0.85" />
        <!-- Antenna Mast Pole -->
        <rect x="${towerRightX - 3}" y="${antennaRightY - 22}" width="6" height="30" fill="#64748b" />
        <!-- Parabolic Dish Antenna (facing left) -->
        <path d="M ${towerRightX - 4} ${antennaRightY - 12} C ${towerRightX + 6} ${antennaRightY} ${towerRightX + 6} ${antennaRightY} ${towerRightX - 4} ${antennaRightY + 12} Z" fill="#0284c7" stroke="#e0f2fe" stroke-width="1.5" />
        <circle cx="${towerRightX - 6}" cy="${antennaRightY}" r="3" fill="#f8fafc" />
        <text x="${towerRightX}" y="${groundY + 36}" fill="#cbd5e1" font-size="10" font-weight="600" text-anchor="middle">Rx Tower (${link.distanceKm} km)</text>
      </g>

      <!-- Fresnel Zone Dimension Tag (Center) -->
      <g class="fresnel-tag">
        <line x1="${midX}" y1="${midY - fresnelRadiusPx}" x2="${midX}" y2="${midY + fresnelRadiusPx}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,3" />
        <rect x="${midX - 70}" y="${midY - 11}" width="140" height="22" fill="#0f172a" rx="4" stroke="#475569" stroke-width="1" />
        <text x="${midX}" y="${midY + 4}" fill="#f1f5f9" font-size="10" font-weight="700" text-anchor="middle">Fresnel R1: ${budget.midFresnelRadiusMeters}m</text>
      </g>

      <!-- Status Header Callout (Top Left) -->
      <g class="header-callouts" transform="translate(16, 16)">
        <rect x="0" y="0" width="230" height="42" fill="#0f172a" opacity="0.94" rx="6" stroke="#334155" stroke-width="1" />
        <text x="10" y="16" fill="#94a3b8" font-size="9.5" font-weight="700" letter-spacing="0.5">LINK AVAILABILITY STATUS</text>
        <circle cx="16" cy="30" r="5" fill="${risk.statusTier === 'critical' ? '#ef4444' : risk.statusTier === 'warning' ? '#f59e0b' : '#10b981'}" />
        <text x="26" y="34" fill="#ffffff" font-size="11" font-weight="700">${escapeXml(risk.statusLabel)}</text>
      </g>

      <!-- RF Signal RSSI & Margin Callout (Top Right) -->
      <g class="rf-callouts" transform="translate(${width - 220}, 16)">
        <rect x="0" y="0" width="204" height="42" fill="#0f172a" opacity="0.94" rx="6" stroke="#334155" stroke-width="1" />
        <text x="10" y="16" fill="#94a3b8" font-size="9.5" font-weight="700" letter-spacing="0.5">RECEIVED RSSI &amp; MARGIN</text>
        <text x="10" y="34" fill="#f8fafc" font-size="12" font-weight="700">${budget.actualRslDbm} dBm <tspan font-size="10.5" font-weight="600" fill="${budget.actualFadeMarginDb < 10 ? '#ef4444' : '#34d399'}">(Fade Margin: +${budget.actualFadeMarginDb} dB)</tspan></text>
      </g>
    </svg>
  `;
}

/**
 * Formats an executive telecom outside-plant microwave RF audit report.
 */
export function generateMicrowaveBriefingReport(data, referenceDate = new Date()) {
  if (!data) return 'No microwave link budget data available.';

  const { link, inputs, budget, risk, ledger, fleetSummary } = data;
  const dateStr = referenceDate instanceof Date ? referenceDate.toISOString().slice(0, 19).replace('T', ' ') : String(referenceDate);

  let out = `# SHAHDARA ISP RF ENGINEERING BRIEFING: MICROWAVE RAIN FADE AUDIT\n`;
  out += `Generated: ${dateStr} PKT | Outside Plant Microwave Transmission Division\n\n`;

  out += `## 1. MONITORED PT-TO-PT BACKHAUL: ${link.name.toUpperCase()}\n`;
  out += `- Service Areas Connected: ${link.primaryArea} (${link.aliasAreas.join(', ')})\n`;
  out += `- Path Length: ${link.distanceKm} km | Carrier Frequency: ${budget.carrierFreqGhz} GHz\n`;
  out += `- Tower Heights: Tx ${link.towerHeightTxM}m (Central Hub), Rx ${link.towerHeightRxM}m (Remote Mast)\n`;
  out += `- RF Hardware: Tx Power +${link.txPowerDbm} dBm, Antennas ${link.txAntennaGainDbi} dBi / ${link.rxAntennaGainDbi} dBi, Cable Loss ${link.cableLossDb} dB\n`;
  out += `- Sensitivity Floor: ${link.sensitivityThresholdDbm} dBm (Disconnect: ${link.failoverThresholdDbm} dBm)\n\n`;

  out += `## 2. RF LINK BUDGET & ITU-R P.838 ATTENUATION\n`;
  out += `- Free Space Path Loss (FSPL): ${budget.fsplDb} dB\n`;
  out += `- Atmospheric Gas Absorption: ${budget.gasLossDb} dB\n`;
  out += `- Specific Rain Attenuation: ${budget.specificRainAttenuationDbKm} dB/km (Precipitation: ${inputs.rainRateMmH} mm/h)\n`;
  out += `- Total Rain Fade Loss: -${budget.totalRainAttenuationDb} dB\n`;
  out += `- Clear-Sky RSL: ${budget.clearSkyRslDbm} dBm (Fade Margin: +${budget.clearSkyFadeMarginDb} dB)\n`;
  out += `- Current Received RSL: ${budget.actualRslDbm} dBm (Fade Margin: +${budget.actualFadeMarginDb} dB)\n`;
  out += `- 1st Fresnel Zone Radius: ${budget.midFresnelRadiusMeters} meters mid-span\n`;
  out += `- Active Adaptive Modulation: ${budget.modulationScheme} (${budget.modulationEfficiencyPercent}% capacity)\n`;
  out += `- Effective Link Throughput: ${budget.effectiveThroughputMbps} Mbps / ${link.nominalThroughputMbps} Mbps nominal\n`;
  out += `- Operational Assessment: ${risk.statusLabel}\n`;
  out += `- Technical Notes: ${risk.diagnosticNotes}\n\n`;

  out += `## 3. SUBSCRIBER & REVENUE IMPACT\n`;
  out += `- Customers Backhauled by Route: ${ledger.totalAreaCustomers} (${ledger.activeSubscribers} Active, ${ledger.offlineSubscribers} Offline)\n`;
  out += `- Sector Monthly Revenue: ${formatPKR(ledger.totalMonthlyBilledPkr)}\n`;
  out += `- Monthly Revenue at Immediate Fade Risk: ${formatPKR(ledger.revenueAtRiskPkr)}\n\n`;

  out += `## 4. SHAHDARA WIRELESS FLEET LINK BUDGET REGISTER\n`;
  out += `| Microwave Route | Dist (km) | Freq (GHz) | Clear RSL | Rain RSL | Rain Fade | Margin | Status |\n`;
  out += `|---|---|---|---|---|---|---|---|\n`;
  for (const f of fleetSummary) {
    const stat = f.statusTier === 'critical' ? '🔴 CRITICAL' : f.statusTier === 'warning' ? '🟠 THROTTLED' : f.statusTier === 'elevated' ? '🟡 ELEVATED' : '🟢 OPTIMAL';
    out += `| ${f.name} | ${f.distanceKm} km | ${f.frequencyGhz} GHz | ${f.clearSkyRslDbm} dBm | ${f.actualRslDbm} dBm | -${f.rainAttenuationDb} dB | +${f.fadeMarginDb} dB | ${stat} |\n`;
  }

  out += `\n## 5. RECOMMENDED MONSOON MITIGATION ACTIONS\n`;
  if (budget.actualFadeMarginDb < 0) {
    out += `1. [CRITICAL OUTAGE RISK] Activate redundant terrestrial optical fiber failover or 5 GHz lower-frequency backup path.\n`;
    out += `2. Enable hitless adaptive modulation (AMR) down to QPSK to prevent complete session teardown during peak cloudbursts.\n`;
  } else if (budget.actualFadeMarginDb < 15) {
    out += `1. Monitor monsoon rain squalls via live radar; ensure battery backup holds radio transceiver voltages stable.\n`;
    out += `2. Plan dry-season upgrade to 3-foot high-gain shroud antennas (+3 dBi) to boost clear-sky fade margin.\n`;
  } else {
    out += `1. RF link budget has ample fade margin headroom (+${budget.actualFadeMarginDb} dB) capable of absorbing heavy monsoon rainfall.\n`;
    out += `2. Routine quarterly alignment of tower radomes and sealant inspection.\n`;
  }

  return out;
}

/**
 * Sets up event listeners, sliders, and modal interaction for the microwave backhaul dashboard card and dialog.
 */
export function setupMicrowaveModal(state, { referenceDate = new Date(), onFilterArea, onFilterCustomer, onToast, clipboard } = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const openBtn = document.getElementById('dashboardOpenMicrowaveModalBtn');
  const modal = document.getElementById('dashboardMicrowaveModal');
  const closeBtn = document.getElementById('dashboardMicrowaveModalCloseBtn');
  const copyBtn = document.getElementById('dashboardCopyMicrowaveReportBtn');
  const filterAreaBtn = document.getElementById('microwaveFilterAreaBtn');

  const linkSelect = document.getElementById('microwaveLinkSelect');
  const freqSelect = document.getElementById('microwaveFreqSelect');
  const rainSlider = document.getElementById('microwaveRainSlider');
  const rainVal = document.getElementById('microwaveRainVal');
  const resetBtn = document.getElementById('microwaveResetSimBtn');

  function populateAndOpen() {
    if (!modal) return;

    // Populate links dropdown
    if (linkSelect && linkSelect.children.length === 0) {
      linkSelect.innerHTML = SHAHDARA_MICROWAVE_LINKS.map(l =>
        `<option value="${escapeXml(l.id)}" ${l.id === selectedLinkId ? 'selected' : ''}>${escapeXml(l.name)} (${l.distanceKm}km, ${l.carrierFreqGhz}GHz)</option>`
      ).join('');
    } else if (linkSelect) {
      linkSelect.value = selectedLinkId;
    }

    if (rainSlider) rainSlider.value = simulatedRainRateMmH;
    if (rainVal) rainVal.textContent = `${simulatedRainRateMmH} mm/h`;
    if (freqSelect) freqSelect.value = simulatedFreqOverride !== null ? String(simulatedFreqOverride) : 'default';

    refreshModalContent();

    if (typeof modal.showModal === 'function') {
      try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
    } else {
      modal.setAttribute('open', '');
    }
  }

  function refreshModalContent() {
    const data = calculateMicrowaveLinkBudget(state, {
      linkId: selectedLinkId,
      rainRate: simulatedRainRateMmH,
      frequencyGhz: simulatedFreqOverride
    });

    const kpiLinkName = document.getElementById('microwaveKpiLinkName');
    const kpiRslMargin = document.getElementById('microwaveKpiRslMargin');
    const kpiRainFade = document.getElementById('microwaveKpiRainFade');
    const kpiStatusBadge = document.getElementById('microwaveStatusBadge');
    const kpiRevenueRisk = document.getElementById('microwaveKpiRevenueRisk');

    if (kpiLinkName) {
      kpiLinkName.textContent = `${data.link.name} (${data.link.distanceKm}km)`;
    }
    if (kpiRslMargin) {
      kpiRslMargin.textContent = `${data.budget.actualRslDbm} dBm (Margin +${data.budget.actualFadeMarginDb} dB)`;
    }
    if (kpiRainFade) {
      kpiRainFade.textContent = `-${data.budget.totalRainAttenuationDb} dB (${data.budget.effectiveThroughputMbps} Mbps)`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = data.risk.statusLabel;
      kpiStatusBadge.className = `sim-delta-badge ${data.risk.statusBadgeClass}`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(data.ledger.revenueAtRiskPkr)} at risk (${data.ledger.activeSubscribers} subs)`;
    }

    const modalChartWrap = document.getElementById('microwaveModalChartWrap');
    if (modalChartWrap) {
      modalChartWrap.innerHTML = renderMicrowaveLinkSvg(data);
    }

    const tableBody = document.getElementById('microwaveLinksTableBody');
    if (tableBody) {
      tableBody.innerHTML = data.fleetSummary.map(f => {
        let badgeHtml = '<span class="status-pill status-pill-active">OPTIMAL</span>';
        if (f.statusTier === 'critical') badgeHtml = '<span class="status-pill status-pill-offline" style="background:#dc2626;color:#fff;">CRITICAL</span>';
        else if (f.statusTier === 'warning') badgeHtml = '<span class="status-pill status-pill-pending" style="background:#ea580c;color:#fff;">THROTTLED</span>';
        else if (f.statusTier === 'elevated') badgeHtml = '<span class="status-pill status-pill-pending">ELEVATED</span>';

        const isCurrent = f.linkId === selectedLinkId;
        return `
          <tr class="${isCurrent ? 'selected-row' : ''}" style="${isCurrent ? 'font-weight:700;' : ''}">
            <td>${escapeXml(f.name)}</td>
            <td>${f.distanceKm} km</td>
            <td>${f.frequencyGhz} GHz</td>
            <td>${f.clearSkyRslDbm} dBm</td>
            <td style="${f.actualRslDbm < -75 ? 'color:#ef4444;font-weight:700;' : ''}">${f.actualRslDbm} dBm</td>
            <td>-${f.rainAttenuationDb} dB</td>
            <td style="${f.fadeMarginDb < 10 ? 'color:#ef4444;font-weight:700;' : ''}">+${f.fadeMarginDb} dB</td>
            <td>${badgeHtml}</td>
          </tr>
        `;
      }).join('');
    }

    const dashChartEl = document.getElementById('dashboardMicrowaveChart');
    if (dashChartEl) {
      dashChartEl.innerHTML = renderMicrowaveLinkSvg(data);
    }
  }

  if (openBtn && !openBtn.dataset.wired) {
    openBtn.dataset.wired = 'true';
    openBtn.addEventListener('click', populateAndOpen);
  }

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

  if (modal && !modal.dataset.wired) {
    modal.dataset.wired = 'true';
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

  if (linkSelect && !linkSelect.dataset.wired) {
    linkSelect.dataset.wired = 'true';
    linkSelect.addEventListener('change', () => {
      setMicrowaveSelectedLink(linkSelect.value);
      refreshModalContent();
    });
  }

  if (freqSelect && !freqSelect.dataset.wired) {
    freqSelect.dataset.wired = 'true';
    freqSelect.addEventListener('change', () => {
      setMicrowaveFrequencyOverride(freqSelect.value === 'default' ? null : Number(freqSelect.value));
      refreshModalContent();
    });
  }

  if (rainSlider && !rainSlider.dataset.wired) {
    rainSlider.dataset.wired = 'true';
    rainSlider.addEventListener('input', () => {
      setMicrowaveRainRate(rainSlider.value);
      if (rainVal) rainVal.textContent = `${rainSlider.value} mm/h`;
      refreshModalContent();
    });
  }

  if (resetBtn && !resetBtn.dataset.wired) {
    resetBtn.dataset.wired = 'true';
    resetBtn.addEventListener('click', () => {
      setMicrowaveRainRate(15);
      setMicrowaveFrequencyOverride(null);
      if (rainSlider) rainSlider.value = 15;
      if (rainVal) rainVal.textContent = '15 mm/h';
      if (freqSelect) freqSelect.value = 'default';
      refreshModalContent();
    });
  }

  if (filterAreaBtn && !filterAreaBtn.dataset.wired) {
    filterAreaBtn.dataset.wired = 'true';
    filterAreaBtn.addEventListener('click', () => {
      const data = calculateMicrowaveLinkBudget(state);
      if (typeof onFilterArea === 'function') {
        onFilterArea(data.link.primaryArea);
        if (typeof modal.close === 'function') {
          try { modal.close(); } catch { modal.removeAttribute('open'); }
        } else {
          modal.removeAttribute('open');
        }
      }
    });
  }

  if (copyBtn && !copyBtn.dataset.wired) {
    copyBtn.dataset.wired = 'true';
    copyBtn.addEventListener('click', async () => {
      const data = calculateMicrowaveLinkBudget(state, {
        linkId: selectedLinkId,
        rainRate: simulatedRainRateMmH,
        frequencyGhz: simulatedFreqOverride
      });
      const text = generateMicrowaveBriefingReport(data, referenceDate);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Microwave rain fade briefing copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy briefing.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard API not available.');
      }
    });
  }
}
