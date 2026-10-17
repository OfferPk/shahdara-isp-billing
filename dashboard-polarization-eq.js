import { formatPKR } from './core.js';

/**
 * Carrier Coherent Optical Polarization Mode State (Stokes Parameters S0, S1, S2, S3,
 * Poincaré Sphere Tracking & DSP Equalization) Matrix
 *
 * Models state-of-the-art 400G / 800G DP-16QAM & DP-QPSK coherent optical transponders
 * deployed across Shahdara ISP's metro DWDM backbone spans.
 *
 * Evaluates:
 * - 4-element Stokes Vector S = [S0, S1, S2, S3] and Degree of Polarization (DOP %)
 * - Fast State of Polarization (SOP) rotation dynamics (0 to 120 krad/s) induced by
 *   train vibrations along the Shahdara railway corridor and wind sway on Ravi aerial spans
 * - 2x2 butterfly adaptive FIR equalizer tracking (CMA, DD-LMS, Radius-Directed)
 * - Polarization Dependent Loss (PDL in dB) and Differential Group Delay (DGD in ps)
 * - Cycle slip probability and pre-FEC Bit Error Rate (BER) margins
 * - Revenue exposure and subscriber SLA protection across connected optical sectors
 */

export const POLARIZATION_CONSTANTS = {
  DEFAULT_SPAN_ID: 'span-01-baradari',
  DEFAULT_MOD_FORMAT: 'DP_16QAM_400G',
  DEFAULT_EQUALIZER_MODE: 'DD_LMS',
  DEFAULT_SOP_SPEED_KRAD_S: 12,
  MIN_SOP_SPEED_KRAD_S: 0,
  MAX_SOP_SPEED_KRAD_S: 120,
  DEFAULT_PDL_DB: 1.2,
  DEFAULT_DGD_PS: 8.5,

  // SD-FEC (27% Overhead) pre-FEC threshold
  SD_FEC_LIMIT_BER: 0.024,
  HD_FEC_LIMIT_BER: 0.0038,

  MOD_FORMATS: {
    DP_QPSK_200G: {
      id: 'DP_QPSK_200G',
      label: 'DP-QPSK (200 Gbps · Ultra Long-Haul)',
      baudRateGbd: 64,
      requiredSnrDb: 13.5,
      dspTapCount: 21,
      baseBer: 0.00012
    },
    DP_16QAM_400G: {
      id: 'DP_16QAM_400G',
      label: 'DP-16QAM (400 Gbps · Metro Regional)',
      baudRateGbd: 64,
      requiredSnrDb: 19.8,
      dspTapCount: 31,
      baseBer: 0.00065
    },
    DP_64QAM_800G: {
      id: 'DP_64QAM_800G',
      label: 'DP-64QAM (800 Gbps · High-Density Core)',
      baudRateGbd: 96,
      requiredSnrDb: 26.2,
      dspTapCount: 41,
      baseBer: 0.0028
    }
  },

  EQUALIZER_MODES: {
    DD_LMS: {
      id: 'DD_LMS',
      label: 'Decision-Directed LMS (Optimal Steady-State)',
      stepSizeMu: 0.002,
      trackingBandwidthKhz: 80
    },
    CMA: {
      id: 'CMA',
      label: 'Constant Modulus Algorithm (Blind Pre-Convergence)',
      stepSizeMu: 0.005,
      trackingBandwidthKhz: 50
    },
    RADIUS_DIRECTED: {
      id: 'RADIUS_DIRECTED',
      label: 'Radius-Directed Equalizer (Multi-ring 16/64QAM)',
      stepSizeMu: 0.003,
      trackingBandwidthKhz: 65
    }
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_COHERENT_SPANS = [
  {
    id: 'span-01-baradari',
    name: 'Span 01: Shahdara Core NOC to Baradari Road Distribution Ring',
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    cableType: 'Buried 96-Core G.652.D Duct Fiber',
    distanceKm: 8.4,
    defaultSopSpeedKradS: 8,
    nominalPdlDb: 0.9,
    nominalDgdPs: 6.2,
    transponderModel: 'Cisco NCS 1004 (400G CFP2-DCO)',
    capacityGbps: 400
  },
  {
    id: 'span-02-ravisiphon',
    name: 'Span 02: Baradari Hub to Ravi Siphon River Span (High Aerial)',
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Old Town', 'Railway Road'],
    cableType: 'ADSS 48-Core Aerial River Crossing (Severe Wind Sway)',
    distanceKm: 14.8,
    defaultSopSpeedKradS: 45,
    nominalPdlDb: 2.1,
    nominalDgdPs: 14.5,
    transponderModel: 'Infinera Groove G30 (CHM2T 800G)',
    capacityGbps: 800
  },
  {
    id: 'span-03-vandala',
    name: 'Span 03: Shahdara Core to Vandala Road Industrial Substation',
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    cableType: 'OPGW Optical Ground Wire along 132kV Grid',
    distanceKm: 11.2,
    defaultSopSpeedKradS: 18,
    nominalPdlDb: 1.4,
    nominalDgdPs: 9.8,
    transponderModel: 'Huawei OptiX OSN 9800 (Blade 400G)',
    capacityGbps: 400
  },
  {
    id: 'span-04-begumkot',
    name: 'Span 04: Begum Kot Aggregation to Kot Abdul Malik Bypass',
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Kot Abdul Malik', 'Saeed Park'],
    cableType: 'Armored Sub-duct Fiber along Motorway M-2',
    distanceKm: 18.6,
    defaultSopSpeedKradS: 12,
    nominalPdlDb: 1.1,
    nominalDgdPs: 12.0,
    transponderModel: 'Ciena Waveserver 5 (WL5e 800G)',
    capacityGbps: 800
  },
  {
    id: 'span-05-jiamusa',
    name: 'Span 05: Jia Musa Feeder along Railway Track Corridor',
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    cableType: 'Railway Trackside Buried Fiber (Train Shock Vibration)',
    distanceKm: 7.5,
    defaultSopSpeedKradS: 32,
    nominalPdlDb: 1.8,
    nominalDgdPs: 8.0,
    transponderModel: 'Nokia 1830 PSS-8 (400G DCO)',
    capacityGbps: 400
  }
];

const STORAGE_KEY = 'shahdara_polarization_dsp_sim_state_v1';

let inMemorySimState = {
  spanId: POLARIZATION_CONSTANTS.DEFAULT_SPAN_ID,
  modFormat: POLARIZATION_CONSTANTS.DEFAULT_MOD_FORMAT,
  equalizerMode: POLARIZATION_CONSTANTS.DEFAULT_EQUALIZER_MODE,
  sopSpeedKradS: POLARIZATION_CONSTANTS.DEFAULT_SOP_SPEED_KRAD_S,
  isVibrationSurgeActive: false
};

function loadStoredState() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          spanId: parsed.spanId || inMemorySimState.spanId,
          modFormat: parsed.modFormat || inMemorySimState.modFormat,
          equalizerMode: parsed.equalizerMode || inMemorySimState.equalizerMode,
          sopSpeedKradS: Number(parsed.sopSpeedKradS) !== undefined ? Number(parsed.sopSpeedKradS) : inMemorySimState.sopSpeedKradS,
          isVibrationSurgeActive: Boolean(parsed.isVibrationSurgeActive)
        };
      }
    } catch (e) {
      // Fallback to inMemory
    }
  }
  return inMemorySimState;
}

function persistSimState(state) {
  inMemorySimState = { ...inMemorySimState, ...state };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemorySimState));
    } catch (e) {
      // Ignore quota errors
    }
  }
}

export function getPolarizationSelectedSpanId() {
  return loadStoredState().spanId;
}

export function setPolarizationSelectedSpanId(id) {
  if (SHAHDARA_COHERENT_SPANS.some(s => s.id === id)) {
    persistSimState({ spanId: id });
  }
}

export function getPolarizationModFormat() {
  return loadStoredState().modFormat;
}

export function setPolarizationModFormat(format) {
  if (POLARIZATION_CONSTANTS.MOD_FORMATS[format]) {
    persistSimState({ modFormat: format });
  }
}

export function getPolarizationEqualizerMode() {
  return loadStoredState().equalizerMode;
}

export function setPolarizationEqualizerMode(mode) {
  if (POLARIZATION_CONSTANTS.EQUALIZER_MODES[mode]) {
    persistSimState({ equalizerMode: mode });
  }
}

export function getPolarizationSopSpeedKradS() {
  return loadStoredState().sopSpeedKradS;
}

export function setPolarizationSopSpeedKradS(speed) {
  const num = Math.max(0, Math.min(120, Number(speed) || 0));
  persistSimState({ sopSpeedKradS: num });
}

export function getPolarizationVibrationSurge() {
  return loadStoredState().isVibrationSurgeActive;
}

export function setPolarizationVibrationSurge(active) {
  persistSimState({ isVibrationSurgeActive: Boolean(active) });
}

export function resetPolarizationSimState() {
  const resetObj = {
    spanId: POLARIZATION_CONSTANTS.DEFAULT_SPAN_ID,
    modFormat: POLARIZATION_CONSTANTS.DEFAULT_MOD_FORMAT,
    equalizerMode: POLARIZATION_CONSTANTS.DEFAULT_EQUALIZER_MODE,
    sopSpeedKradS: POLARIZATION_CONSTANTS.DEFAULT_SOP_SPEED_KRAD_S,
    isVibrationSurgeActive: false
  };
  persistSimState(resetObj);
  return resetObj;
}

/**
 * Computes 4-element Stokes Vector S = [S0, S1, S2, S3] and Degree of Polarization (DOP %).
 * Maps state angles (azimuth psi, ellipticity chi) to coordinates on the unit Poincaré sphere.
 */
export function calculateStokesVector(sopSpeedKradS, isVibrationSurge) {
  const effectiveSpeed = sopSpeedKradS + (isVibrationSurge ? 35 : 0);

  // Time-dependent phase angles based on rotation speed
  const t = 1.25;
  const omega = effectiveSpeed * 0.05;

  const psi = Math.sin(omega * t) * (Math.PI / 3); // Azimuth: -60 to +60 deg
  const chi = Math.cos(omega * t * 0.7) * (Math.PI / 6); // Ellipticity: -30 to +30 deg

  const S0 = 1.0;
  // Normalized Stokes coordinates
  const S1 = Math.round(Math.cos(2 * psi) * Math.cos(2 * chi) * 1000) / 1000;
  const S2 = Math.round(Math.sin(2 * psi) * Math.cos(2 * chi) * 1000) / 1000;
  const S3 = Math.round(Math.sin(2 * chi) * 1000) / 1000;

  // DOP calculation: sqrt(S1^2 + S2^2 + S3^2) / S0
  const polarizedPower = Math.sqrt(S1 * S1 + S2 * S2 + S3 * S3);
  // Slight unpolarized noise component as speed grows
  const unpolarizedNoise = Math.min(0.08, effectiveSpeed * 0.0006);
  const dopPercent = Math.max(90, Math.min(100, Math.round(((polarizedPower - unpolarizedNoise) / S0) * 1000) / 10));

  return {
    S0,
    S1,
    S2,
    S3,
    azimuthDeg: Math.round((psi * 180 / Math.PI) * 10) / 10,
    ellipticityDeg: Math.round((chi * 180 / Math.PI) * 10) / 10,
    dopPercent,
    effectiveSpeedKradS: Math.round(effectiveSpeed * 10) / 10
  };
}

/**
 * Simulates 2x2 butterfly adaptive FIR equalizer convergence, Mean Squared Error (MSE),
 * cycle slip probability and Pre-FEC Bit Error Rate.
 */
export function calculateDspEqualizerDynamics(span, modFormatId, equalizerModeId, sopSpeedKradS, isVibrationSurge) {
  const modFormat = POLARIZATION_CONSTANTS.MOD_FORMATS[modFormatId] || POLARIZATION_CONSTANTS.MOD_FORMATS.DP_16QAM_400G;
  const eqMode = POLARIZATION_CONSTANTS.EQUALIZER_MODES[equalizerModeId] || POLARIZATION_CONSTANTS.EQUALIZER_MODES.DD_LMS;

  const stokes = calculateStokesVector(sopSpeedKradS, isVibrationSurge);
  const effectiveSpeed = stokes.effectiveSpeedKradS;

  // Fiber PDL and DGD with surge scaling
  const pdlDb = Math.round((span.nominalPdlDb + (isVibrationSurge ? 1.4 : 0) + (effectiveSpeed > 60 ? 0.8 : 0)) * 10) / 10;
  const dgdPs = Math.round((span.nominalDgdPs + (isVibrationSurge ? 5.2 : 0)) * 10) / 10;

  // Equalizer convergence performance (MSE in dB)
  // Base MSE: -24 dB for QPSK, -20 dB for 16QAM, -16 dB for 64QAM
  const baseMseDb = modFormatId === 'DP_QPSK_200G' ? -24 : modFormatId === 'DP_16QAM_400G' ? -20 : -16;
  const sopPenaltyDb = (effectiveSpeed / 120) * 7.5;
  const pdlPenaltyDb = (pdlDb / 4.0) * 3.5;
  const currentMseDb = Math.round((baseMseDb + sopPenaltyDb + pdlPenaltyDb) * 10) / 10;

  // Pre-FEC Bit Error Rate estimation
  const berMultiplier = Math.pow(10, (currentMseDb - baseMseDb) / 6.0);
  const preFecBer = Math.min(0.045, Math.round(modFormat.baseBer * berMultiplier * 100000) / 100000);

  // Cycle slip risk / frame drop
  let cycleSlipAlert = false;
  let cycleSlipsPerHour = 0;
  if (effectiveSpeed >= 80 || pdlDb >= 3.5 || preFecBer >= POLARIZATION_CONSTANTS.SD_FEC_LIMIT_BER) {
    cycleSlipAlert = true;
    cycleSlipsPerHour = Math.round((effectiveSpeed - 75) * 0.4 + (pdlDb > 3.0 ? 5 : 0));
  } else if (effectiveSpeed >= 40 || pdlDb >= 2.2) {
    cycleSlipsPerHour = Math.round((effectiveSpeed - 35) * 0.08);
  }

  // Tap convergence curve (31 iterations)
  const convergenceCurve = [];
  for (let step = 0; step <= 30; step++) {
    // Exponential approach towards currentMseDb
    const decay = Math.exp(-step * 0.18);
    const stepMse = Math.round((-4.0 * decay + currentMseDb * (1 - decay)) * 10) / 10;
    convergenceCurve.push({ step, mseDb: stepMse });
  }

  // System status
  let status = POLARIZATION_CONSTANTS.STATUS.OPTIMAL;
  let statusExplanation = 'Coherent DSP butterfly equalizer is locked with robust pre-FEC margin.';

  if (cycleSlipAlert || preFecBer >= POLARIZATION_CONSTANTS.SD_FEC_LIMIT_BER || pdlDb >= 3.5) {
    status = POLARIZATION_CONSTANTS.STATUS.CRITICAL;
    statusExplanation = 'CRITICAL: Equalizer loss-of-lock risk or cycle slips detected! Pre-FEC BER exceeds carrier margin.';
  } else if (effectiveSpeed >= 40 || pdlDb >= 2.0 || preFecBer >= POLARIZATION_CONSTANTS.HD_FEC_LIMIT_BER) {
    status = POLARIZATION_CONSTANTS.STATUS.WARNING;
    statusExplanation = 'WARNING: High SOP rotation speed or elevated PDL degrading equalizer MSE. Operating under SD-FEC.';
  }

  return {
    stokes,
    modFormat,
    eqMode,
    pdlDb,
    dgdPs,
    currentMseDb,
    preFecBer,
    cycleSlipAlert,
    cycleSlipsPerHour,
    convergenceCurve,
    status,
    statusExplanation
  };
}

/**
 * Calculates complete coherent optical metrics correlated with subscriber ledger and revenue.
 */
export function calculatePolarizationMetrics(state = {}, options = {}) {
  const current = loadStoredState();
  const spanId = options.spanId || current.spanId;
  const modFormatId = options.modFormat || current.modFormat;
  const equalizerModeId = options.equalizerMode || current.equalizerMode;
  const sopSpeed = options.sopSpeedKradS !== undefined ? options.sopSpeedKradS : current.sopSpeedKradS;
  const vibrationActive = options.isVibrationSurgeActive !== undefined ? options.isVibrationSurgeActive : current.isVibrationSurgeActive;

  const span = SHAHDARA_COHERENT_SPANS.find(s => s.id === spanId) || SHAHDARA_COHERENT_SPANS[0];
  const dynamics = calculateDspEqualizerDynamics(span, modFormatId, equalizerModeId, sopSpeed, vibrationActive);

  // Correlate with subscribers in span's linked sector
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

  // Revenue exposure fraction
  let riskFraction = 0.0;
  if (dynamics.status === POLARIZATION_CONSTANTS.STATUS.CRITICAL) {
    riskFraction = 0.85; // High probability of uncorrected frame loss
  } else if (dynamics.status === POLARIZATION_CONSTANTS.STATUS.WARNING) {
    riskFraction = 0.20; // Degraded jitter / buffering
  }

  const revenueAtRisk = Math.round(sectorMonthlyRevenue * riskFraction);

  return {
    span,
    modFormatId,
    equalizerModeId,
    sopSpeedKradS: sopSpeed,
    isVibrationSurgeActive: vibrationActive,
    dynamics,
    subscriberCorrelation: {
      totalSubscribers,
      activeSubscribers,
      offlineSubscribers,
      sectorMonthlyRevenue,
      sectorTotalDues,
      revenueAtRisk,
      riskFraction
    },
    spansList: SHAHDARA_COHERENT_SPANS
  };
}

/**
 * Pure offline vector SVG visualizer for Poincaré Sphere & DSP Adaptive Butterfly Equalizer.
 */
export function renderPolarizationDiagramSvg(metrics, options = {}) {
  if (!metrics || !metrics.span || !metrics.dynamics) {
    return `<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No polarization telemetry available.</div>`;
  }

  const isCompact = Boolean(options.compact);
  const isDark = Boolean(options.isDark !== undefined ? options.isDark : true);

  const width = isCompact ? 560 : 860;
  const height = isCompact ? 280 : 380;

  const { span, dynamics } = metrics;
  const { stokes, status } = dynamics;

  const bgGradStart = isDark ? '#0f172a' : '#f8fafc';
  const bgGradEnd = isDark ? '#1e293b' : '#e2e8f0';
  const strokeGrid = isDark ? '#334155' : '#cbd5e1';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  const statusColor = status === POLARIZATION_CONSTANTS.STATUS.CRITICAL
    ? '#ef4444'
    : status === POLARIZATION_CONSTANTS.STATUS.WARNING
    ? '#f59e0b'
    : '#10b981';

  // Poincaré Sphere 3D projection coordinates
  const sphereR = isCompact ? 70 : 100;
  const sphereCx = isCompact ? 130 : 180;
  const sphereCy = isCompact ? 130 : 170;

  // 3D projection: x' = S1 * cos(30) - S2 * cos(30), y' = -S3 + (S1 + S2) * 0.3
  const projX = sphereCx + (stokes.S1 * 0.8 - stokes.S2 * 0.6) * sphereR;
  const projY = sphereCy - (stokes.S3 * 0.85) * sphereR + (stokes.S1 + stokes.S2) * 0.25 * sphereR;

  // DSP Equalizer Convergence Graph coordinates
  const graphX = isCompact ? 260 : 390;
  const graphY = isCompact ? 50 : 60;
  const graphW = isCompact ? 270 : 430;
  const graphH = isCompact ? 160 : 230;

  // MSE range: -28 dB (best) to -5 dB (worst)
  const minMse = -28;
  const maxMse = -5;
  const curvePoints = dynamics.convergenceCurve || [];

  let pathD = '';
  curvePoints.forEach((pt, idx) => {
    const px = graphX + (pt.step / 30) * graphW;
    const clampedMse = Math.min(maxMse, Math.max(minMse, pt.mseDb));
    const py = graphY + ((clampedMse - maxMse) / (minMse - maxMse)) * graphH;
    if (idx === 0) {
      pathD += `M ${px} ${py}`;
    } else {
      pathD += ` L ${px} ${py}`;
    }
  });

  // SD-FEC limit line (-12 dB)
  const sdFecY = graphY + ((-12 - maxMse) / (minMse - maxMse)) * graphH;

  return `
<svg class="polarization-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Carrier Coherent Optical Polarization and DSP Equalizer Diagram">
  <defs>
    <linearGradient id="polBgGrad_${isDark ? 'd' : 'l'}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradStart}" />
      <stop offset="100%" stop-color="${bgGradEnd}" />
    </linearGradient>
    <radialGradient id="sphereGrad" cx="40%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${isDark ? '#3b82f6' : '#93c5fd'}" stop-opacity="0.25" />
      <stop offset="80%" stop-color="${isDark ? '#1e293b' : '#e2e8f0'}" stop-opacity="0.1" />
      <stop offset="100%" stop-color="${isDark ? '#0f172a' : '#cbd5e1'}" stop-opacity="0.4" />
    </radialGradient>
    <filter id="polGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#polBgGrad_${isDark ? 'd' : 'l'})" stroke="${strokeGrid}" stroke-width="1.2" />

  <!-- Left: Poincaré Sphere -->
  <g id="poincareSphereGroup">
    <text x="${sphereCx}" y="${graphY - 14}" text-anchor="middle" font-size="${isCompact ? 11 : 13}" font-weight="700" fill="${textColor}">Poincaré Sphere (Stokes $\\vec{S}$)</text>

    <!-- Main sphere perimeter -->
    <circle cx="${sphereCx}" cy="${sphereCy}" r="${sphereR}" fill="url(#sphereGrad)" stroke="#3b82f6" stroke-width="1.5" />

    <!-- Equator ellipse (Linear polarizations) -->
    <ellipse cx="${sphereCx}" cy="${sphereCy}" rx="${sphereR}" ry="${sphereR * 0.35}" fill="none" stroke="#06b6d4" stroke-width="1" stroke-dasharray="3,3" opacity="0.7" />

    <!-- Meridian ellipse -->
    <ellipse cx="${sphereCx}" cy="${sphereCy}" rx="${sphereR * 0.35}" ry="${sphereR}" fill="none" stroke="#64748b" stroke-width="1" stroke-dasharray="2,2" opacity="0.6" />

    <!-- Equator axis lines -->
    <line x1="${sphereCx - sphereR}" y1="${sphereCy}" x2="${sphereCx + sphereR}" y2="${sphereCy}" stroke="${strokeGrid}" stroke-width="1" opacity="0.6" />
    <line x1="${sphereCx}" y1="${sphereCy - sphereR}" x2="${sphereCx}" y2="${sphereCy + sphereR}" stroke="${strokeGrid}" stroke-width="1" opacity="0.6" />

    <!-- Poles labels -->
    <text x="${sphereCx}" y="${sphereCy - sphereR - 4}" text-anchor="middle" font-size="8" font-weight="600" fill="#a855f7">+S3 (RHC)</text>
    <text x="${sphereCx}" y="${sphereCy + sphereR + 12}" text-anchor="middle" font-size="8" font-weight="600" fill="#a855f7">-S3 (LHC)</text>
    <text x="${sphereCx + sphereR + 6}" y="${sphereCy + 3}" font-size="8" fill="${textMuted}">+S1 (H)</text>
    <text x="${sphereCx - sphereR - 6}" y="${sphereCy + 3}" text-anchor="end" font-size="8" fill="${textMuted}">-S1 (V)</text>

    <!-- Vector from origin to state point -->
    <line x1="${sphereCx}" y1="${sphereCy}" x2="${projX}" y2="${projY}" stroke="${statusColor}" stroke-width="2" stroke-dasharray="2,2" />

    <!-- Active State Point Marker -->
    <circle cx="${projX}" cy="${projY}" r="6" fill="${statusColor}" stroke="#ffffff" stroke-width="2" filter="url(#polGlow)" />

    <!-- Coordinates pill -->
    <text x="${sphereCx}" y="${sphereCy + sphereR + (isCompact ? 24 : 32)}" text-anchor="middle" font-size="${isCompact ? 9 : 10}" font-weight="600" fill="${textColor}">
      S1: ${stokes.S1} · S2: ${stokes.S2} · S3: ${stokes.S3} (DOP ${stokes.dopPercent}%)
    </text>
  </g>

  <!-- Right: 2x2 Butterfly DSP Equalizer Convergence Graph -->
  <g id="dspConvergenceGroup">
    <text x="${graphX}" y="${graphY - 14}" font-size="${isCompact ? 11 : 13}" font-weight="700" fill="${textColor}">2×2 Butterfly FIR Equalizer Convergence</text>
    <text x="${graphX + graphW}" y="${graphY - 14}" text-anchor="end" font-size="${isCompact ? 9 : 10}" fill="${textMuted}">Mode: ${dynamics.eqMode.id} · Taps: ${dynamics.modFormat.dspTapCount}</text>

    <!-- Graph Canvas Box -->
    <rect x="${graphX}" y="${graphY}" width="${graphW}" height="${graphH}" rx="4" fill="${isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.8)'}" stroke="${strokeGrid}" stroke-width="1" />

    <!-- SD-FEC Threshold line -->
    <line x1="${graphX}" y1="${sdFecY}" x2="${graphX + graphW}" y2="${sdFecY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="${graphX + 6}" y="${sdFecY - 4}" font-size="9" font-weight="600" fill="#ef4444">SD-FEC LIMIT (-12 dB MSE)</text>

    <!-- Optimal line (-20 dB) -->
    <line x1="${graphX}" y1="${graphY + ((-20 - maxMse) / (minMse - maxMse)) * graphH}" x2="${graphX + graphW}" y2="${graphY + ((-20 - maxMse) / (minMse - maxMse)) * graphH}" stroke="#10b981" stroke-width="1" stroke-dasharray="3,3" opacity="0.6" />
    <text x="${graphX + 6}" y="${graphY + ((-20 - maxMse) / (minMse - maxMse)) * graphH - 4}" font-size="8" fill="#10b981">TARGET CONVERGENCE (-20 dB)</text>

    <!-- Convergence path -->
    ${pathD ? `<path d="${pathD}" fill="none" stroke="#3b82f6" stroke-width="2.5" />` : ''}

    <!-- Steady State Value Label -->
    <text x="${graphX + graphW - 8}" y="${graphY + 18}" text-anchor="end" font-size="11" font-weight="700" fill="${statusColor}">
      MSE: ${dynamics.currentMseDb} dB (BER: ${dynamics.preFecBer})
    </text>

    <!-- X-axis labels -->
    <text x="${graphX}" y="${graphY + graphH + 14}" font-size="8" fill="${textMuted}">Iter 0</text>
    <text x="${graphX + graphW * 0.5}" y="${graphY + graphH + 14}" text-anchor="middle" font-size="8" fill="${textMuted}">Iter 15</text>
    <text x="${graphX + graphW}" y="${graphY + graphH + 14}" text-anchor="end" font-size="8" fill="${textMuted}">Iter 30</text>
  </g>

  <!-- Bottom KPI Strip -->
  <g id="bottomPolarizationStrip" transform="translate(0, ${height - (isCompact ? 35 : 45)})">
    <rect x="${isCompact ? 15 : 25}" y="0" width="${width - (isCompact ? 30 : 50)}" height="${isCompact ? 26 : 34}" rx="6" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="${strokeGrid}" stroke-width="1" />
    <text x="${isCompact ? 25 : 37}" y="${isCompact ? 16 : 21}" font-size="${isCompact ? 9 : 11}" font-weight="600" fill="${textColor}">
      SOP Speed: <tspan fill="${statusColor}">${stokes.effectiveSpeedKradS} krad/s</tspan> · PDL: ${dynamics.pdlDb} dB · DGD: ${dynamics.dgdPs} ps
    </text>
    <text x="${width - (isCompact ? 25 : 37)}" y="${isCompact ? 16 : 21}" text-anchor="end" font-size="${isCompact ? 9 : 11}" font-weight="600" fill="${textColor}">
      DSP Status: <tspan fill="${statusColor}">${status.toUpperCase()}</tspan> (${dynamics.cycleSlipsPerHour > 0 ? dynamics.cycleSlipsPerHour + ' slips/hr' : 'Zero Slips'})
    </text>
  </g>
</svg>
  `.trim();
}

/**
 * Generates formal Outside Plant Coherent Optical DSP & Polarization Audit Report text.
 */
export function generatePolarizationReport(metrics) {
  if (!metrics || !metrics.span) return 'No polarization audit metrics available.';

  const { span, dynamics, subscriberCorrelation } = metrics;
  const { stokes, modFormat, eqMode, status } = dynamics;

  return `
================================================================================
SHAHDARA ISP COHERENT OPTICAL POLARIZATION & DSP EQUALIZATION AUDIT REPORT
Standards: ITU-T G.698.2, IEEE 802.3ct (400ZR), OIF-400ZR, Telcordia GR-253
Timestamp: ${new Date().toISOString()}
================================================================================

[ OPTICAL METRO SPAN & TRANSPONDER TELEMETRY ]
--------------------------------------------------------------------------------
Monitored Span: ${span.name}
Primary Sector: ${span.primaryArea} (Aliases: ${(span.aliasAreas || []).join(', ')})
Fiber Cable Profile: ${span.cableType} (${span.distanceKm} km)
Transponder Model: ${span.transponderModel}
Nominal Capacity: ${span.capacityGbps} Gbps
Active Modulation: ${modFormat.label} (${modFormat.baudRateGbd} Gbaud)
Adaptive Equalizer: ${eqMode.label} (Tracking Bandwidth: ${eqMode.trackingBandwidthKhz} kHz)

[ STOKES VECTOR & POINCARÉ SPHERE STATE ]
--------------------------------------------------------------------------------
Normalized Stokes Vector: [ S0: ${stokes.S0}, S1: ${stokes.S1}, S2: ${stokes.S2}, S3: ${stokes.S3} ]
Azimuth Angle (2*psi): ${stokes.azimuthDeg}°
Ellipticity Angle (2*chi): ${stokes.ellipticityDeg}°
Degree of Polarization (DOP): ${stokes.dopPercent}%
State of Polarization (SOP) Rotation Speed: ${stokes.effectiveSpeedKradS} krad/s
Vibration / Aerial Sway Perturbation: ${metrics.isVibrationSurgeActive ? 'ACTIVE (Elevated Wind / Train Shock)' : 'NORMAL'}

[ 2x2 BUTTERFLY DSP EQUALIZER TELEMETRY ]
--------------------------------------------------------------------------------
Equalizer Filter Taps: ${modFormat.dspTapCount} taps per polarization tributary
Steady-State Equalizer MSE: ${dynamics.currentMseDb} dB
Pre-FEC Bit Error Rate: ${dynamics.preFecBer} (SD-FEC Threshold: ${POLARIZATION_CONSTANTS.SD_FEC_LIMIT_BER})
Polarization Dependent Loss (PDL): ${dynamics.pdlDb} dB (Max Allowable: 3.5 dB)
Differential Group Delay (DGD): ${dynamics.dgdPs} ps
Cycle Slip Risk: ${dynamics.cycleSlipAlert ? 'CRITICAL CYCLE SLIP WARNING' : 'NOMINAL (Locked)'}
Cycle Slips Rate: ${dynamics.cycleSlipsPerHour} slips / hour
DSP Tracking Health: ${status.toUpperCase()}
Technical Assessment: ${dynamics.statusExplanation}

[ SUBSCRIBER REVENUE & SECTOR SLA EXPOSURE ]
--------------------------------------------------------------------------------
Connected Sector Subscribers: ${subscriberCorrelation.totalSubscribers} (${subscriberCorrelation.activeSubscribers} Active, ${subscriberCorrelation.offlineSubscribers} Offline)
Sector Monthly Billed Revenue: ${formatPKR(subscriberCorrelation.sectorMonthlyRevenue)}
Outstanding Dues: ${formatPKR(subscriberCorrelation.sectorTotalDues)}
Estimated Revenue At Risk: ${formatPKR(subscriberCorrelation.revenueAtRisk)} (${Math.round(subscriberCorrelation.riskFraction * 100)}% Exposure)

[ NOC ACTION RECOMMENDATIONS ]
--------------------------------------------------------------------------------
${
  status === POLARIZATION_CONSTANTS.STATUS.CRITICAL
    ? 'CRITICAL ALERT: DSP equalizer loss-of-lock or uncorrected cycle slips detected! Immediately inspect aerial span river crossing for excessive mechanical oscillation or trackside cable shielding. Enable optical fast-protection switching (APS) to secondary underground path.'
    : status === POLARIZATION_CONSTANTS.STATUS.WARNING
    ? 'WARNING NOTICE: State of Polarization rotation speed or fiber PDL is elevated. Equalizer is compensating within SD-FEC margin. Schedule routine inspection of ADSS aerial dampers and cable tension.'
    : 'OPTIMAL OPERATION: Polarization state is tracking smoothly on the Poincaré sphere. 2x2 butterfly DSP equalizer converged with clean pre-FEC margin.'
}
================================================================================
`.trim();
}

/**
 * Exports polarization simulation data as JSON.
 */
export function exportPolarizationJson(metrics) {
  const data = {
    exportedAt: new Date().toISOString(),
    metrics
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-coherent-dsp-matrix-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports polarization simulation data as CSV.
 */
export function exportPolarizationCsv(metrics) {
  const { span, dynamics, subscriberCorrelation } = metrics;
  const { stokes, modFormat, eqMode } = dynamics;

  const rows = [
    ['Metric', 'Value'],
    ['Span Name', span.name],
    ['Primary Sector', span.primaryArea],
    ['Cable Type', span.cableType],
    ['Span Distance km', span.distanceKm],
    ['Transponder Model', span.transponderModel],
    ['Modulation Format', modFormat.label],
    ['Equalizer Mode', eqMode.label],
    ['Stokes S0', stokes.S0],
    ['Stokes S1', stokes.S1],
    ['Stokes S2', stokes.S2],
    ['Stokes S3', stokes.S3],
    ['Degree of Polarization DOP %', stokes.dopPercent],
    ['SOP Rotation Speed krad/s', stokes.effectiveSpeedKradS],
    ['PDL dB', dynamics.pdlDb],
    ['DGD ps', dynamics.dgdPs],
    ['Equalizer MSE dB', dynamics.currentMseDb],
    ['Pre-FEC BER', dynamics.preFecBer],
    ['Cycle Slips Per Hour', dynamics.cycleSlipsPerHour],
    ['DSP Status', dynamics.status],
    ['Sector Total Subscribers', subscriberCorrelation.totalSubscribers],
    ['Sector Active Subscribers', subscriberCorrelation.activeSubscribers],
    ['Sector Monthly Revenue PKR', subscriberCorrelation.sectorMonthlyRevenue],
    ['Revenue At Risk PKR', subscriberCorrelation.revenueAtRisk]
  ];

  const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shahdara-coherent-dsp-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Initializes and wires the Coherent Optical DSP and Polarization modal dialog and dashboard card.
 */
export function setupPolarizationModal(state = {}, options = {}) {
  const modal = document.getElementById('dashboardPolarizationModal');
  const openBtn = document.getElementById('dashboardOpenPolarizationModalBtn');
  const closeBtn = document.getElementById('dashboardPolarizationModalCloseBtn');

  const spanSelect = document.getElementById('polSpanSelect');
  const modSelect = document.getElementById('polModSelect');
  const eqSelect = document.getElementById('polEqSelect');
  const speedRange = document.getElementById('polSpeedRange');
  const speedValLabel = document.getElementById('polSpeedValLabel');
  const surgeBtn = document.getElementById('polSurgeToggleBtn');
  const resetBtn = document.getElementById('polResetBtn');

  // KPI elements
  const statDop = document.getElementById('polStatDop');
  const statSpeed = document.getElementById('polStatSpeed');
  const statMse = document.getElementById('polStatMse');
  const statPdl = document.getElementById('polStatPdl');
  const statStatusBadge = document.getElementById('polStatStatusBadge');
  const statRevenueRisk = document.getElementById('polStatRevenueRisk');

  // Containers
  const svgContainer = document.getElementById('dashboardPolarizationModalSvgContainer');
  const cardSvg = document.getElementById('dashboardPolarizationChart');

  // Action buttons
  const copyReportBtn = document.getElementById('polCopyReportBtn');
  const exportJsonBtn = document.getElementById('polExportJsonBtn');
  const exportCsvBtn = document.getElementById('polExportCsvBtn');

  function updateUi() {
    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');
    const metrics = calculatePolarizationMetrics(state);
    const { dynamics, subscriberCorrelation } = metrics;
    const { stokes, status } = dynamics;

    // Update Card chart
    if (cardSvg) {
      cardSvg.innerHTML = renderPolarizationDiagramSvg(metrics, { isDark, compact: true });
    }

    // Update Modal SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderPolarizationDiagramSvg(metrics, { isDark, compact: false });
    }

    if (!modal) return;

    // Update KPIs
    if (statDop) {
      statDop.textContent = `${stokes.dopPercent}% (S1:${stokes.S1})`;
      statDop.className = `optical-evm-stat-val ${stokes.dopPercent >= 95 ? 'optimal' : 'warning'}`;
    }
    if (statSpeed) {
      statSpeed.textContent = `${stokes.effectiveSpeedKradS} krad/s`;
      statSpeed.className = `optical-evm-stat-val ${stokes.effectiveSpeedKradS > 70 ? 'critical' : stokes.effectiveSpeedKradS > 35 ? 'warning' : 'optimal'}`;
    }
    if (statMse) {
      statMse.textContent = `${dynamics.currentMseDb} dB (BER ${dynamics.preFecBer})`;
      statMse.className = `optical-evm-stat-val ${dynamics.currentMseDb > -14 ? 'critical' : dynamics.currentMseDb > -18 ? 'warning' : 'optimal'}`;
    }
    if (statPdl) {
      statPdl.textContent = `${dynamics.pdlDb} dB (${dynamics.dgdPs} ps)`;
      statPdl.className = `optical-evm-stat-val ${dynamics.pdlDb > 3.0 ? 'critical' : dynamics.pdlDb > 1.8 ? 'warning' : 'optimal'}`;
    }
    if (statStatusBadge) {
      statStatusBadge.textContent = status.toUpperCase();
      statStatusBadge.className = `optical-evm-stat-val ${status === POLARIZATION_CONSTANTS.STATUS.CRITICAL ? 'critical' : status === POLARIZATION_CONSTANTS.STATUS.WARNING ? 'warning' : 'optimal'}`;
    }
    if (statRevenueRisk) {
      statRevenueRisk.textContent = formatPKR(subscriberCorrelation.revenueAtRisk);
      statRevenueRisk.className = `optical-evm-stat-val ${subscriberCorrelation.revenueAtRisk > 0 ? 'critical' : 'optimal'}`;
    }

    // Update select values to match state
    if (spanSelect && spanSelect.value !== metrics.span.id) {
      spanSelect.value = metrics.span.id;
    }
    if (modSelect && modSelect.value !== metrics.modFormatId) {
      modSelect.value = metrics.modFormatId;
    }
    if (eqSelect && eqSelect.value !== metrics.equalizerModeId) {
      eqSelect.value = metrics.equalizerModeId;
    }
    if (speedRange) {
      speedRange.value = metrics.sopSpeedKradS;
      if (speedValLabel) speedValLabel.textContent = `${metrics.sopSpeedKradS} krad/s`;
    }
    if (surgeBtn) {
      surgeBtn.textContent = metrics.isVibrationSurgeActive ? '⚡ Vibration Surge Active (Click to Clear)' : '🌪️ Simulate Aerial Wind / Train Vibration';
      surgeBtn.className = metrics.isVibrationSurgeActive ? 'primary-button' : 'secondary-button';
    }
  }

  // Event handlers
  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      updateUi();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
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

  if (spanSelect) {
    spanSelect.addEventListener('change', () => {
      setPolarizationSelectedSpanId(spanSelect.value);
      updateUi();
    });
  }

  if (modSelect) {
    modSelect.addEventListener('change', () => {
      setPolarizationModFormat(modSelect.value);
      updateUi();
    });
  }

  if (eqSelect) {
    eqSelect.addEventListener('change', () => {
      setPolarizationEqualizerMode(eqSelect.value);
      updateUi();
    });
  }

  if (speedRange) {
    speedRange.addEventListener('input', () => {
      setPolarizationSopSpeedKradS(speedRange.value);
      if (speedValLabel) speedValLabel.textContent = `${speedRange.value} krad/s`;
      updateUi();
    });
  }

  if (surgeBtn) {
    surgeBtn.addEventListener('click', () => {
      const active = getPolarizationVibrationSurge();
      setPolarizationVibrationSurge(!active);
      updateUi();
      if (options.onToast) {
        options.onToast(!active ? 'Vibration & aerodynamic wind sway surge injected.' : 'Vibration baseline restored.');
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetPolarizationSimState();
      updateUi();
      if (options.onToast) {
        options.onToast('Coherent polarization baseline parameters reset.');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const metrics = calculatePolarizationMetrics(state);
      const report = generatePolarizationReport(metrics);
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(report).then(() => {
          if (options.onToast) options.onToast('Polarization audit report copied to clipboard.');
        }).catch(() => {
          prompt('Copy Polarization Audit Report:', report);
        });
      } else {
        prompt('Copy Polarization Audit Report:', report);
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const metrics = calculatePolarizationMetrics(state);
      exportPolarizationJson(metrics);
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const metrics = calculatePolarizationMetrics(state);
      exportPolarizationCsv(metrics);
    });
  }

  // Initial draw
  updateUi();
}
