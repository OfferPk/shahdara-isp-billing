import { formatPKR } from './core.js';

/**
 * DWDM Optical Polarization Mode Dispersion (PMD) & Differential Group Delay (DGD) First-Order Matrix
 * Standards: ITU-T G.650.2, ITU-T G.652.D, IEC 60793-1-48
 *
 * Models core birefringence along single-mode transmission fiber where slight circular
 * core asymmetry and environmental stress cause orthogonal polarization modes (fast and slow axes)
 * to propagate at differing group velocities, creating Differential Group Delay (DGD).
 *
 * Simulates first-order Maxwellian DGD probability distributions, second-order PMD (SOPMD),
 * bit-rate dependent OSNR penalties (10G NRZ, 40G/100G/200G coherent DSP), thermal and mechanical
 * wind strain on aerial fiber runs, and correlates optical transport degradation with
 * Shahdara ISP subscriber revenue exposure.
 */

export const PMD_CONSTANTS = {
  DEFAULT_SPAN_ID: 'pmd-span-01',
  DEFAULT_BITRATE: '10G_NRZ',
  DEFAULT_ENV_CONDITION: 'QUIET_DUCT',
  DEFAULT_INDUCED_STRAIN_PCT: 0,
  DEFAULT_INJECTED_STRAIN_PCT: 0,
  MIN_STRAIN_PCT: 0,
  MAX_STRAIN_PCT: 100,

  BITRATES: {
    '10G_NRZ': {
      label: '10 Gbps NRZ Direct-Detect (Max DGD Tol: 12.0 ps)',
      bitPeriodPs: 100.0,
      maxDgdTolerancePs: 12.0,
      coherentDspCompensated: false
    },
    '40G_DP_QPSK': {
      label: '40 Gbps DP-QPSK Coherent (Max DGD Tol: 20.0 ps)',
      bitPeriodPs: 50.0,
      maxDgdTolerancePs: 20.0,
      coherentDspCompensated: true
    },
    '100G_DP_QPSK': {
      label: '100 Gbps DP-QPSK Coherent DSP (Max DGD Tol: 35.0 ps)',
      bitPeriodPs: 25.0,
      maxDgdTolerancePs: 35.0,
      coherentDspCompensated: true
    },
    '200G_16QAM': {
      label: '200 Gbps DP-16QAM High Spectral Efficiency (Max DGD Tol: 22.0 ps)',
      bitPeriodPs: 16.0,
      maxDgdTolerancePs: 22.0,
      coherentDspCompensated: true
    }
  },

  ENV_CONDITIONS: {
    QUIET_DUCT: {
      label: 'Buried Conduit / Underground Duct (Low Stress, Factor 1.0x)',
      multiplier: 1.0,
      description: 'Thermally buffered underground duct installation with minimal vibrations'
    },
    AERIAL_MODERATE: {
      label: 'Aerial Pole Suspended - Moderate Wind / Sun Cycle (Factor 1.35x)',
      multiplier: 1.35,
      description: 'Pole-mounted overhead fiber subject to diurnal solar temperature swing'
    },
    AERIAL_SEVERE: {
      label: 'Aerial Severe Span - High Wind Gusts & Heavy Sag (Factor 1.85x)',
      multiplier: 1.85,
      description: 'High tension aerial span crossing open canals/corridors with mechanical vibration'
    }
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_PMD_SPANS = [
  {
    id: 'pmd-span-01',
    name: 'Central Core Trunk 01: Shahdara Core to Kot Abdul Malik',
    lengthKm: 42,
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Kot Abdul Malik', 'Baradari Road', 'Old Town'],
    fiberType: 'Corning SMF-28e+ (G.652D)',
    pmdCoeffPsPerSqrtKm: 0.06,
    defaultBitrate: '10G_NRZ',
    defaultEnv: 'QUIET_DUCT'
  },
  {
    id: 'pmd-span-02',
    name: 'Metro Express Ring 02: Baradari Road to Ravi Siphon',
    lengthKm: 36,
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Ravi Siphon', 'Bara Dari', 'Siphon Road'],
    fiberType: 'OFS AllWave ZWP (G.652D)',
    pmdCoeffPsPerSqrtKm: 0.08,
    defaultBitrate: '100G_DP_QPSK',
    defaultEnv: 'QUIET_DUCT'
  },
  {
    id: 'pmd-span-03',
    name: 'Rural Aerial Trunk 03: Vandala Road to Narang Mandi Border',
    lengthKm: 58,
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    fiberType: 'Prysmian Draka (G.652D Legacy Aerial)',
    pmdCoeffPsPerSqrtKm: 0.22,
    defaultBitrate: '10G_NRZ',
    defaultEnv: 'AERIAL_MODERATE'
  },
  {
    id: 'pmd-span-04',
    name: 'Inter-POP Feeder 04: Jia Musa to Farrukhabad Loop',
    lengthKm: 28,
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    fiberType: 'Sterlite OH-LITE (G.652D)',
    pmdCoeffPsPerSqrtKm: 0.05,
    defaultBitrate: '40G_DP_QPSK',
    defaultEnv: 'QUIET_DUCT'
  },
  {
    id: 'pmd-span-05',
    name: 'South Border Link 05: Begum Kot to Kala Shah Kaku',
    lengthKm: 32,
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Kot Abdul Malik'],
    fiberType: 'Corning LEAF (G.655 NZ-DSF)',
    pmdCoeffPsPerSqrtKm: 0.12,
    defaultBitrate: '200G_16QAM',
    defaultEnv: 'AERIAL_SEVERE'
  }
];

// Interactive state variables
let currentSelectedSpanId = PMD_CONSTANTS.DEFAULT_SPAN_ID;
let currentSelectedBitrate = PMD_CONSTANTS.DEFAULT_BITRATE;
let currentSelectedEnv = PMD_CONSTANTS.DEFAULT_ENV_CONDITION;
let currentInducedStrainPct = PMD_CONSTANTS.DEFAULT_INJECTED_STRAIN_PCT;

export function getPmdSelectedSpan() {
  return currentSelectedSpanId;
}

export function setPmdSelectedSpan(id) {
  if (SHAHDARA_PMD_SPANS.some(s => s.id === id)) {
    currentSelectedSpanId = id;
    const span = SHAHDARA_PMD_SPANS.find(s => s.id === id);
    if (span) {
      currentSelectedBitrate = span.defaultBitrate;
      currentSelectedEnv = span.defaultEnv;
    }
  }
}

export function getPmdSelectedBitrate() {
  return currentSelectedBitrate;
}

export function setPmdSelectedBitrate(rate) {
  if (PMD_CONSTANTS.BITRATES[rate]) {
    currentSelectedBitrate = rate;
  }
}

export function getPmdSelectedEnv() {
  return currentSelectedEnv;
}

export function setPmdSelectedEnv(env) {
  if (PMD_CONSTANTS.ENV_CONDITIONS[env]) {
    currentSelectedEnv = env;
  }
}

export function getPmdInducedStrainPct() {
  return currentInducedStrainPct;
}

export function setPmdInducedStrainPct(pct) {
  const num = Number(pct);
  if (!Number.isNaN(num)) {
    currentInducedStrainPct = Math.max(
      PMD_CONSTANTS.MIN_STRAIN_PCT,
      Math.min(PMD_CONSTANTS.MAX_STRAIN_PCT, Math.round(num))
    );
  }
}

export function resetPmdSimState() {
  currentSelectedSpanId = PMD_CONSTANTS.DEFAULT_SPAN_ID;
  currentSelectedBitrate = PMD_CONSTANTS.DEFAULT_BITRATE;
  currentSelectedEnv = PMD_CONSTANTS.DEFAULT_ENV_CONDITION;
  currentInducedStrainPct = PMD_CONSTANTS.DEFAULT_INJECTED_STRAIN_PCT;
}

/**
 * Calculates First-Order PMD physics, mean DGD, peak Maxwellian DGD, and OSNR penalties.
 */
export function calculatePmdDynamics(span, bitrateKey, envKey, strainPct) {
  const sp = span || SHAHDARA_PMD_SPANS[0];
  const bRate = PMD_CONSTANTS.BITRATES[bitrateKey] || PMD_CONSTANTS.BITRATES['10G_NRZ'];
  const env = PMD_CONSTANTS.ENV_CONDITIONS[envKey] || PMD_CONSTANTS.ENV_CONDITIONS['QUIET_DUCT'];
  const strain = Math.max(0, Math.min(100, Number(strainPct) || 0));

  // Environmental stress and strain multiplier
  const strainFactor = 1.0 + (strain / 100) * 0.9;
  const effectivePmdCoeff = sp.pmdCoeffPsPerSqrtKm * env.multiplier * strainFactor;

  // Mean Differential Group Delay (DGD): <Delta tau> = D_pmd * sqrt(L)
  const meanDgdPs = Math.round((effectivePmdCoeff * Math.sqrt(sp.lengthKm)) * 100) / 100;

  // Peak Maxwellian instantaneous DGD at 99.99% probability (~3.2 * mean DGD)
  const peakDgdPs = Math.round((meanDgdPs * 3.2) * 100) / 100;

  // Second-Order PMD (SOPMD) in ps^2: approx (meanDgd^2) / (sqrt(3) * 2 * pi)
  const sopmdPs2 = Math.round((Math.pow(meanDgdPs, 2) / 10.88) * 100) / 100;

  // Pulse spreading ratio relative to bit period
  const pulseBroadeningRatio = Math.round((meanDgdPs / bRate.bitPeriodPs) * 1000) / 1000;

  // OSNR Penalty (dB): For direct detect NRZ ~ 0.5 * (meanDgd / bitPeriod)^2 * 10
  // Coherent DSP tracks and mitigates, but elevated peak DGD causes DSP equalizer cycle slip
  let osnrPenaltyDb = 0.0;
  if (bRate.coherentDspCompensated) {
    if (peakDgdPs > bRate.maxDgdTolerancePs) {
      osnrPenaltyDb = Math.round(((peakDgdPs - bRate.maxDgdTolerancePs) * 0.35) * 100) / 100;
    } else {
      osnrPenaltyDb = Math.round((0.08 + (meanDgdPs / bRate.maxDgdTolerancePs) * 0.25) * 100) / 100;
    }
  } else {
    // Direct detect NRZ
    osnrPenaltyDb = Math.round((Math.pow(meanDgdPs / (bRate.bitPeriodPs * 0.2), 2) * 1.8) * 100) / 100;
    if (peakDgdPs > bRate.maxDgdTolerancePs) {
      osnrPenaltyDb += Math.round(((peakDgdPs - bRate.maxDgdTolerancePs) * 0.45) * 100) / 100;
    }
  }

  // Outage Probability (annual probability of instantaneous DGD breaching tolerance)
  // Maxwellian tail calculation approximation
  const ratio = bRate.maxDgdTolerancePs / Math.max(0.1, meanDgdPs);
  let outageMinutesPerYear = 0;
  if (ratio < 2.0) {
    outageMinutesPerYear = Math.round(525600 * 0.05);
  } else if (ratio < 2.8) {
    outageMinutesPerYear = Math.round(525600 * 0.005);
  } else if (ratio < 3.2) {
    outageMinutesPerYear = Math.round(525600 * 0.0001);
  } else {
    outageMinutesPerYear = 0;
  }

  // Margin Headroom in ps
  const dgdMarginPs = Math.round((bRate.maxDgdTolerancePs - peakDgdPs) * 100) / 100;

  // Operational Status
  let status = PMD_CONSTANTS.STATUS.OPTIMAL;
  if (peakDgdPs >= bRate.maxDgdTolerancePs || osnrPenaltyDb >= 2.0) {
    status = PMD_CONSTANTS.STATUS.CRITICAL;
  } else if (peakDgdPs >= bRate.maxDgdTolerancePs * 0.8 || osnrPenaltyDb >= 0.8 || strain >= 60) {
    status = PMD_CONSTANTS.STATUS.WARNING;
  }

  return {
    effectivePmdCoeff: Math.round(effectivePmdCoeff * 1000) / 1000,
    meanDgdPs,
    peakDgdPs,
    sopmdPs2,
    pulseBroadeningRatio,
    osnrPenaltyDb,
    dgdMarginPs,
    outageMinutesPerYear,
    maxDgdTolerancePs: bRate.maxDgdTolerancePs,
    coherentDspCompensated: bRate.coherentDspCompensated,
    status
  };
}

/**
 * Calculates complete PMD metrics correlated with subscriber ledger and sector revenue.
 */
export function calculatePmdMetrics(state, options = {}) {
  const selectedSpanId = options.spanId || currentSelectedSpanId;
  const bitrateKey = options.bitrate || currentSelectedBitrate;
  const envKey = options.envCondition || currentSelectedEnv;
  const strainPct = options.strainPct !== undefined ? options.strainPct : currentInducedStrainPct;

  const span = SHAHDARA_PMD_SPANS.find(s => s.id === selectedSpanId) || SHAHDARA_PMD_SPANS[0];
  const dynamics = calculatePmdDynamics(span, bitrateKey, envKey, strainPct);

  // Correlate with subscriber roster in this span's served area
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const aliasAreas = span.aliasAreas || [span.primaryArea];

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

  // Revenue exposure: if peak DGD causes coherent transponder loss-of-frame (LOF)
  const riskFraction = dynamics.status === PMD_CONSTANTS.STATUS.CRITICAL
    ? 0.70
    : dynamics.status === PMD_CONSTANTS.STATUS.WARNING
    ? 0.20
    : 0.0;
  const revenueAtRisk = Math.round(sectorMonthlyRevenue * riskFraction);

  return {
    span,
    bitrateKey,
    bitrateConfig: PMD_CONSTANTS.BITRATES[bitrateKey],
    envConditionKey: envKey,
    envConditionConfig: PMD_CONSTANTS.ENV_CONDITIONS[envKey],
    inducedStrainPct: strainPct,
    dynamics,
    subscriberCorrelation: {
      totalSubscribers,
      activeSubscribers,
      offlineSubscribers,
      sectorMonthlyRevenue,
      sectorTotalDues,
      revenueAtRisk
    },
    spansList: SHAHDARA_PMD_SPANS
  };
}

/**
 * Generates pure offline SVG diagram showing Maxwellian DGD curve and Polarization pulse splitting.
 */
export function renderPmdDiagramSvg(metrics, options = {}) {
  if (!metrics || !metrics.span) {
    return `<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No Optical PMD metrics available.</div>`;
  }

  const { span, dynamics, bitrateConfig } = metrics;
  const isCompact = Boolean(options.compact);
  const width = isCompact ? 540 : 860;
  const height = isCompact ? 280 : 380;

  const isCritical = dynamics.status === PMD_CONSTANTS.STATUS.CRITICAL;
  const isWarning = dynamics.status === PMD_CONSTANTS.STATUS.WARNING;
  const statusColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

  // Chart coordinates
  const padLeft = isCompact ? 45 : 70;
  const padRight = isCompact ? 30 : 50;
  const padTop = isCompact ? 45 : 55;
  const padBottom = isCompact ? 60 : 75;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Maxwellian Distribution Curve: f(x) = sqrt(2/pi) * (x^2 / sigma^3) * exp(-x^2 / (2 * sigma^2))
  // where mean = sigma * 2 * sqrt(2/pi) -> sigma = mean / (2 * sqrt(2/pi)) = mean / 1.595769
  const sigma = Math.max(0.5, dynamics.meanDgdPs / 1.595769);
  const maxPlotDgd = Math.max(bitrateConfig.maxDgdTolerancePs * 1.35, dynamics.peakDgdPs * 1.25);

  const numPoints = 40;
  const curvePoints = [];
  let maxProb = 0.001;

  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * maxPlotDgd;
    const term = Math.sqrt(2 / Math.PI) * (Math.pow(x, 2) / Math.pow(sigma, 3)) * Math.exp(-Math.pow(x, 2) / (2 * Math.pow(sigma, 2)));
    if (term > maxProb) maxProb = term;
  }

  for (let i = 0; i <= numPoints; i++) {
    const frac = i / numPoints;
    const x = frac * maxPlotDgd;
    const prob = Math.sqrt(2 / Math.PI) * (Math.pow(x, 2) / Math.pow(sigma, 3)) * Math.exp(-Math.pow(x, 2) / (2 * Math.pow(sigma, 2)));
    const px = padLeft + frac * plotW;
    const py = padTop + (1.0 - (prob / maxProb) * 0.9) * plotH;
    curvePoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }

  const curvePathD = `M ${curvePoints.join(' L ')}`;
  const areaFillD = `M ${padLeft},${padTop + plotH} L ${curvePoints.join(' L ')} L ${padLeft + plotW},${padTop + plotH} Z`;

  // Threshold markers
  const meanX = padLeft + (dynamics.meanDgdPs / maxPlotDgd) * plotW;
  const peakX = padLeft + (dynamics.peakDgdPs / maxPlotDgd) * plotW;
  const tolX = padLeft + (bitrateConfig.maxDgdTolerancePs / maxPlotDgd) * plotW;

  return `
<svg class="pmd-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DWDM Optical PMD and DGD First-Order Maxwellian Distribution Diagram">
  <defs>
    <linearGradient id="pmdBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="100%" stop-color="#141c2b" />
    </linearGradient>
    <linearGradient id="pmdCurveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#pmdBgGrad)" stroke="#1e293b" stroke-width="1.2" />

  <!-- Header Section -->
  <text x="18" y="24" fill="#f8fafc" font-size="${isCompact ? 11 : 13}" font-weight="700" letter-spacing="0.5">DWDM POLARIZATION MODE DISPERSION (PMD / DGD - ITU-T G.650.2)</text>
  <text x="${width - 18}" y="24" text-anchor="end" fill="${statusColor}" font-size="${isCompact ? 10 : 12}" font-weight="700">STATUS: ${dynamics.status.toUpperCase()}</text>

  <!-- Plot Canvas -->
  <rect x="${padLeft}" y="${padTop}" width="${plotW}" height="${plotH}" fill="#0b1120" rx="6" stroke="#1e293b" stroke-width="1" />

  <!-- Grid Lines -->
  <g stroke="#334155" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.6">
    <line x1="${padLeft}" y1="${padTop + plotH * 0.33}" x2="${padLeft + plotW}" y2="${padTop + plotH * 0.33}" />
    <line x1="${padLeft}" y1="${padTop + plotH * 0.66}" x2="${padLeft + plotW}" y2="${padTop + plotH * 0.66}" />
  </g>

  <!-- Maxwellian Filled Distribution -->
  <path d="${areaFillD}" fill="url(#pmdCurveGrad)" />
  <path d="${curvePathD}" stroke="#38bdf8" stroke-width="2.2" fill="none" />

  <!-- Mean DGD Marker (Green Line) -->
  <line x1="${meanX}" y1="${padTop}" x2="${meanX}" y2="${padTop + plotH}" stroke="#10b981" stroke-width="1.8" stroke-dasharray="4,2" />
  <text x="${meanX}" y="${padTop - 6}" text-anchor="middle" fill="#10b981" font-size="${isCompact ? 7.5 : 9}" font-weight="700">Mean: ${dynamics.meanDgdPs}ps</text>

  <!-- Peak 99.99% DGD Marker (Amber Line) -->
  <line x1="${peakX}" y1="${padTop}" x2="${peakX}" y2="${padTop + plotH}" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="2,2" />
  <text x="${peakX}" y="${padTop + 14}" text-anchor="middle" fill="#f59e0b" font-size="${isCompact ? 7.5 : 8.5}">Peak: ${dynamics.peakDgdPs}ps</text>

  <!-- Transponder Tolerance Threshold Marker (Red Line) -->
  <line x1="${tolX}" y1="${padTop}" x2="${tolX}" y2="${padTop + plotH}" stroke="#ef4444" stroke-width="2.2" />
  <text x="${tolX}" y="${padTop - 6}" text-anchor="middle" fill="#ef4444" font-size="${isCompact ? 7.5 : 9}" font-weight="700">SLA Limit: ${bitrateConfig.maxDgdTolerancePs}ps</text>

  <!-- X-Axis Labels -->
  <text x="${padLeft}" y="${padTop + plotH + 18}" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">0 ps (DGD)</text>
  <text x="${padLeft + plotW * 0.5}" y="${padTop + plotH + 18}" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">${(maxPlotDgd * 0.5).toFixed(1)} ps</text>
  <text x="${padLeft + plotW}" y="${padTop + plotH + 18}" text-anchor="end" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">${maxPlotDgd.toFixed(1)} ps (Span: ${span.lengthKm}km)</text>

  <!-- Bottom Summary Stats Row -->
  <g transform="translate(18, ${height - (isCompact ? 36 : 46)})">
    <text x="0" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">OSNR Penalty: <tspan fill="${dynamics.osnrPenaltyDb >= 1.5 ? '#ef4444' : '#f8fafc'}" font-weight="700">${dynamics.osnrPenaltyDb} dB</tspan></text>
    <text x="${width * 0.35}" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">SOPMD: <tspan fill="#f8fafc">${dynamics.sopmdPs2} ps²</tspan></text>
    <text x="${width * 0.65}" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">Margin: <tspan fill="${dynamics.dgdMarginPs > 0 ? '#10b981' : '#ef4444'}" font-weight="700">${dynamics.dgdMarginPs} ps</tspan></text>
  </g>
</svg>
`;
}

/**
 * Generates technical executive briefing text of Optical PMD / DGD status.
 */
export function generatePmdReport(metrics) {
  if (!metrics || !metrics.span) {
    return 'No Optical PMD metrics available.';
  }

  const { span, dynamics, bitrateConfig, envConditionConfig, subscriberCorrelation } = metrics;
  const now = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });

  return [
    '================================================================================',
    'SHAHDARA ISP DWDM POLARIZATION MODE DISPERSION (PMD/DGD) AUDIT BRIEFING',
    'Standards: ITU-T G.650.2 (PMD Measurement), ITU-T G.652.D, IEC 60793-1-48',
    `Generated: ${now} (PKT)`,
    '================================================================================',
    '',
    `MONITORED FIBER SPAN:   ${span.name}`,
    `Primary Coverage Sector: ${span.primaryArea}`,
    `Physical Fiber Length:   ${span.lengthKm} km`,
    `Fiber Specification:     ${span.fiberType}`,
    `Base PMD Coefficient:    ${span.pmdCoeffPsPerSqrtKm} ps/sqrt(km)`,
    `Effective PMD Coeff:     ${dynamics.effectivePmdCoeff} ps/sqrt(km)`,
    `Installation Conduit:    ${envConditionConfig.label}`,
    `Active Transponder Rate: ${bitrateConfig.label}`,
    '',
    'DISPERSION DYNAMICS & STATISTICAL DGD:',
    `--------------------------------------------------------------------------------`,
    `Mean DGD (<Delta tau>):  ${dynamics.meanDgdPs} ps`,
    `Peak Instantaneous DGD:  ${dynamics.peakDgdPs} ps (99.99% Maxwellian Probability Boundary)`,
    `Second-Order PMD:        ${dynamics.sopmdPs2} ps^2`,
    `Transponder Tolerance:   ${dynamics.maxDgdTolerancePs} ps (${dynamics.coherentDspCompensated ? 'Coherent DSP Compensated' : 'Direct Detect NRZ Limit'})`,
    `DGD Margin Headroom:     ${dynamics.dgdMarginPs} ps (${dynamics.dgdMarginPs >= 0 ? 'COMPLIANT' : 'MARGIN DEFICIT'})`,
    `PMD OSNR Penalty:        ${dynamics.osnrPenaltyDb} dB`,
    `Projected Outage Risk:   ${dynamics.outageMinutesPerYear} minutes/year`,
    `Operational Status:      ${dynamics.status.toUpperCase()}`,
    '',
    'SUBSCRIBER & REVENUE CORRELATION:',
    `--------------------------------------------------------------------------------`,
    `Linked Area Accounts:    ${subscriberCorrelation.totalSubscribers} subscribers`,
    `Active Online Accounts:  ${subscriberCorrelation.activeSubscribers} subscribers`,
    `Offline Accounts:        ${subscriberCorrelation.offlineSubscribers} subscribers`,
    `Sector Monthly Billed:   ${formatPKR(subscriberCorrelation.sectorMonthlyRevenue)}`,
    `Sector Outstanding Due:  ${formatPKR(subscriberCorrelation.sectorTotalDues)}`,
    `Revenue at Risk:         ${formatPKR(subscriberCorrelation.revenueAtRisk)}`,
    '',
    'RECOMMENDED ENGINEERING ACTION:',
    dynamics.status === PMD_CONSTANTS.STATUS.CRITICAL
      ? 'CRITICAL ALERT: Peak Maxwellian DGD breaches optical transponder receiver tolerance. High risk of inter-symbol interference and frame loss. Upgrade line transponder to coherent DSP with adaptive polarization tracking or re-route high-priority wavelength lambdas.'
      : dynamics.status === PMD_CONSTANTS.STATUS.WARNING
      ? 'WARNING: Elevated PMD penalty detected due to aerial environmental stress or aging cable birefringence. Monitor aerial pole tension and SOPMD stability.'
      : 'OPTIMAL: Optical PMD and DGD variance well within ITU-T G.650.2 margins with zero projected transponder bit slips.'
  ].join('\n');
}

/**
 * Initializes and wires the Optical PMD modal, controls, and SVG chart.
 */
export function setupPmdModal(state, options = {}) {
  const modal = document.getElementById('dashboardPmdModal');
  const openBtn = document.getElementById('dashboardOpenPmdModalBtn');
  const closeBtn = document.getElementById('dashboardPmdModalCloseBtn');

  const spanSelect = document.getElementById('pmdSpanSelect');
  const rateSelect = document.getElementById('pmdRateSelect');
  const envSelect = document.getElementById('pmdEnvSelect');
  const strainSlider = document.getElementById('pmdStrainSlider');
  const strainValPill = document.getElementById('pmdStrainVal');
  const resetBtn = document.getElementById('pmdResetBtn');

  // KPI elements
  const kpiSpanName = document.getElementById('pmdKpiSpanName');
  const kpiMeanDgd = document.getElementById('pmdKpiMeanDgd');
  const kpiPeakDgd = document.getElementById('pmdKpiPeakDgd');
  const kpiStatusBadge = document.getElementById('pmdStatusBadge');
  const kpiRevenueRisk = document.getElementById('pmdKpiRevenueRisk');

  // Chart wrap & Table
  const chartWrap = document.getElementById('pmdModalChartWrap');
  const spansTableBody = document.getElementById('pmdSpansTableBody');

  // Action buttons
  const filterAreaBtn = document.getElementById('pmdFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyPmdReportBtn');

  // Card chart
  const cardChart = document.getElementById('dashboardPmdChart');

  function renderView() {
    const metrics = calculatePmdMetrics(state);

    if (cardChart) {
      cardChart.innerHTML = renderPmdDiagramSvg(metrics, { compact: true });
    }

    if (!modal) return;

    if (kpiSpanName) {
      kpiSpanName.textContent = metrics.span.name.split(':')[0];
    }
    if (kpiMeanDgd) {
      kpiMeanDgd.textContent = `${metrics.dynamics.meanDgdPs} ps (OSNR -${metrics.dynamics.osnrPenaltyDb}dB)`;
      kpiMeanDgd.style.color = metrics.dynamics.osnrPenaltyDb < 1.0 ? '#10b981' : '#f59e0b';
    }
    if (kpiPeakDgd) {
      kpiPeakDgd.textContent = `${metrics.dynamics.peakDgdPs} ps (Tol ${metrics.dynamics.maxDgdTolerancePs}ps)`;
      kpiPeakDgd.style.color = metrics.dynamics.dgdMarginPs >= 0 ? '#38bdf8' : '#ef4444';
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = metrics.dynamics.status.toUpperCase();
      kpiStatusBadge.className = `sim-delta-badge badge-${
        metrics.dynamics.status === PMD_CONSTANTS.STATUS.CRITICAL
          ? 'danger'
          : metrics.dynamics.status === PMD_CONSTANTS.STATUS.WARNING
          ? 'warning'
          : 'success'
      }`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(metrics.subscriberCorrelation.revenueAtRisk)} at risk`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderPmdDiagramSvg(metrics, { compact: false });
    }

    if (spansTableBody) {
      spansTableBody.innerHTML = metrics.spansList
        .map(s => {
          const isSelected = s.id === metrics.span.id;
          const dyn = calculatePmdDynamics(s, metrics.bitrateKey, metrics.envConditionKey, 0);
          return `
            <tr class="${isSelected ? 'active-row' : ''}">
              <td><strong>${s.id.toUpperCase()}</strong></td>
              <td>${s.name.split(': ')[1] || s.name}</td>
              <td>${s.lengthKm} km</td>
              <td>${s.fiberType.split(' (')[0]}</td>
              <td>${s.pmdCoeffPsPerSqrtKm} ps/&radic;km</td>
              <td><strong>${dyn.meanDgdPs} ps</strong> (Peak ${dyn.peakDgdPs}ps)</td>
              <td>${isSelected ? '<span class="status-pill status-active">Monitored</span>' : '<span class="status-pill">Standby</span>'}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // Populate Selects
  if (spanSelect) {
    spanSelect.innerHTML = SHAHDARA_PMD_SPANS.map(
      s => `<option value="${s.id}" ${s.id === currentSelectedSpanId ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    spanSelect.onchange = e => {
      setPmdSelectedSpan(e.target.value);
      if (rateSelect) rateSelect.value = currentSelectedBitrate;
      if (envSelect) envSelect.value = currentSelectedEnv;
      renderView();
    };
  }

  if (rateSelect) {
    rateSelect.innerHTML = Object.entries(PMD_CONSTANTS.BITRATES).map(
      ([k, v]) => `<option value="${k}" ${k === currentSelectedBitrate ? 'selected' : ''}>${v.label}</option>`
    ).join('');
    rateSelect.onchange = e => {
      setPmdSelectedBitrate(e.target.value);
      renderView();
    };
  }

  if (envSelect) {
    envSelect.innerHTML = Object.entries(PMD_CONSTANTS.ENV_CONDITIONS).map(
      ([k, v]) => `<option value="${k}" ${k === currentSelectedEnv ? 'selected' : ''}>${v.label}</option>`
    ).join('');
    envSelect.onchange = e => {
      setPmdSelectedEnv(e.target.value);
      renderView();
    };
  }

  if (strainSlider) {
    strainSlider.value = currentInducedStrainPct;
    strainSlider.oninput = e => {
      setPmdInducedStrainPct(e.target.value);
      if (strainValPill) strainValPill.textContent = `${currentInducedStrainPct}%`;
      renderView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetPmdSimState();
      if (spanSelect) spanSelect.value = currentSelectedSpanId;
      if (rateSelect) rateSelect.value = currentSelectedBitrate;
      if (envSelect) envSelect.value = currentSelectedEnv;
      if (strainSlider) strainSlider.value = currentInducedStrainPct;
      if (strainValPill) strainValPill.textContent = `${currentInducedStrainPct}%`;
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Optical PMD simulation reset to baseline parameters.');
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
      const metrics = calculatePmdMetrics(state);
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(metrics.span.primaryArea);
        if (modal && typeof modal.close === 'function') modal.close();
        else if (modal) modal.removeAttribute('open');
        if (typeof options.onToast === 'function') {
          options.onToast(`Filtering subscribers in ${metrics.span.primaryArea}`);
        }
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculatePmdMetrics(state);
      const text = generatePmdReport(metrics);
      try {
        const cb = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
        if (cb?.writeText) {
          await cb.writeText(text);
          if (typeof options.onToast === 'function') {
            options.onToast('Optical PMD/DGD briefing copied to clipboard!');
          }
        } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy Optical PMD briefing:', text);
        }
      } catch (err) {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy Optical PMD briefing:', text);
        }
      }
    };
  }

  // Initial draw
  renderView();
}
