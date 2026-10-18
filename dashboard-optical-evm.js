import { formatPKR } from './core.js';

/**
 * Optical Fiber Modulation & Constellation Error Vector Magnitude (EVM) Matrix
 * ITU-T G.698.2 / OIF-400ZR DPSK, DQPSK, DP-QPSK, 16-QAM & Chromatic Dispersion Compensation
 * Area: agent1 (shahdara-dashboard) - KPIs, Charts, Constellation Diagrams & SLA Telemetry
 */

export const OPTICAL_EVM_CONSTANTS = {
  DEFAULT_LINK_ID: 'baradari-begumkot-100g-dpqpsk',
  DEFAULT_LAUNCH_POWER_DBM: 2.0,

  FORMATS: {
    DPSK: 'Differential Binary Phase Shift Keying (DPSK - 1 bit/sym)',
    DQPSK: 'Differential Quadrature Phase Shift Keying (DQPSK - 2 bits/sym)',
    DP_QPSK: 'Dual-Polarization QPSK (DP-QPSK - 4 bits/sym Coherent)',
    QAM_16: '16-ary Quadrature Amplitude Modulation (16-QAM - 4 bits/sym)'
  },

  FEC_LIMITS: {
    HD_FEC_BER: 3.8e-3,  // Hard Decision FEC limit (7% overhead)
    SD_FEC_BER: 2.0e-2,  // Soft Decision FEC limit (20% overhead)
    HD_FEC_EVM: 12.5,    // EVM % limit for HD-FEC
    SD_FEC_EVM: 18.5     // EVM % limit for SD-FEC
  },

  STATUS: {
    OPTIMAL_POST_FEC_CLEAR: 'Optimal (Error-Free Post-FEC, Robust Margin)',
    SD_FEC_OPERATIONAL: 'Operational via Soft-Decision FEC (Slight Penalty)',
    EVM_DEGRADED_WARNING: 'EVM Degraded (Approaching SD-FEC Limit)',
    FEC_UNRESOLVABLE_OUTAGE: 'Critical Loss of Frame (EVM Exceeds FEC Recovery Limit)'
  }
};

export const SHAHDARA_OPTICAL_EVM_LINKS = [
  {
    id: 'baradari-begumkot-100g-dpqpsk',
    name: 'Baradari to Begum Kot 100G DP-QPSK Core Optical Trunk',
    format: 'DP_QPSK',
    primaryArea: 'Baradari',
    targetArea: 'Begum Kot',
    distanceKm: 14.8,
    fiberType: 'G.652.D SMF-28',
    dispersionCoeffPsPerNmKm: 17.0,
    baselineEvmPct: 7.2,
    baselinePreFecBer: 1.2e-7,
    launchPowerDbm: 2.0,
    dcmCompensatedPsPerNm: 250.0,
    capacityGbps: 100,
    monthlyRevenuePkr: 3800000,
    subscribersCount: 650
  },
  {
    id: 'jia-musa-dqpsk-transit',
    name: 'Jia Musa Ring 40G DQPSK Direct-Detection Transit',
    format: 'DQPSK',
    primaryArea: 'Jia Musa',
    targetArea: 'Shahdara Town',
    distanceKm: 11.5,
    fiberType: 'G.652.D SMF-28',
    dispersionCoeffPsPerNmKm: 16.8,
    baselineEvmPct: 9.4,
    baselinePreFecBer: 4.5e-6,
    launchPowerDbm: 1.5,
    dcmCompensatedPsPerNm: 190.0,
    capacityGbps: 40,
    monthlyRevenuePkr: 2600000,
    subscribersCount: 390
  },
  {
    id: 'ravi-siphon-aerial-dpqpsk',
    name: 'Ravi Siphon High-Span 100G DP-QPSK Aerial Crossing',
    format: 'DP_QPSK',
    primaryArea: 'Ravi Siphon',
    targetArea: 'Begum Kot',
    distanceKm: 18.6,
    fiberType: 'G.652.D SMF-28 (High-Tension Aerial)',
    dispersionCoeffPsPerNmKm: 17.2,
    baselineEvmPct: 13.8,
    baselinePreFecBer: 2.1e-4,
    launchPowerDbm: 3.0,
    dcmCompensatedPsPerNm: 310.0,
    capacityGbps: 100,
    monthlyRevenuePkr: 4500000,
    subscribersCount: 820
  },
  {
    id: 'vandala-road-dpsk-backhaul',
    name: 'Vandala Road Wholesale 40G DPSK Direct-Detection Backhaul',
    format: 'DPSK',
    primaryArea: 'Vandala Road',
    targetArea: 'Baradari',
    distanceKm: 8.2,
    fiberType: 'G.652.D SMF-28',
    dispersionCoeffPsPerNmKm: 16.5,
    baselineEvmPct: 8.1,
    baselinePreFecBer: 8.9e-7,
    launchPowerDbm: 1.0,
    dcmCompensatedPsPerNm: 135.0,
    capacityGbps: 40,
    monthlyRevenuePkr: 2200000,
    subscribersCount: 310
  },
  {
    id: 'townhall-datacenter-16qam',
    name: 'Shahdara Town Hall to Data Center 200G 16-QAM Express',
    format: 'QAM_16',
    primaryArea: 'Shahdara Town',
    targetArea: 'Baradari',
    distanceKm: 6.4,
    fiberType: 'G.655 NZ-DSF Low-Dispersion',
    dispersionCoeffPsPerNmKm: 4.5,
    baselineEvmPct: 11.2,
    baselinePreFecBer: 5.8e-5,
    launchPowerDbm: 0.0,
    dcmCompensatedPsPerNm: 28.0,
    capacityGbps: 200,
    monthlyRevenuePkr: 5200000,
    subscribersCount: 940
  }
];

// In-memory simulation state
let selectedLinkId = OPTICAL_EVM_CONSTANTS.DEFAULT_LINK_ID;
let simDcmCompPsPerNm = 250.0;
let simLaunchPowerDbm = OPTICAL_EVM_CONSTANTS.DEFAULT_LAUNCH_POWER_DBM;
let simCustomFormat = null;

export function getOpticalEvmSelectedLinkId() {
  return selectedLinkId;
}

export function setOpticalEvmSelectedLinkId(id) {
  if (SHAHDARA_OPTICAL_EVM_LINKS.some(l => l.id === id)) {
    selectedLinkId = id;
    const link = SHAHDARA_OPTICAL_EVM_LINKS.find(l => l.id === id);
    simDcmCompPsPerNm = link.dcmCompensatedPsPerNm;
    simLaunchPowerDbm = link.launchPowerDbm;
    simCustomFormat = null;
  }
}

export function getOpticalEvmDcmCompPsPerNm() {
  return simDcmCompPsPerNm;
}

export function setOpticalEvmDcmCompPsPerNm(val) {
  simDcmCompPsPerNm = Math.max(0, Math.min(500, Number(val) || 0));
}

export function getOpticalEvmLaunchPowerDbm() {
  return simLaunchPowerDbm;
}

export function setOpticalEvmLaunchPowerDbm(val) {
  simLaunchPowerDbm = Math.max(-5, Math.min(8, Number(val) || 0));
}

export function getOpticalEvmCustomFormat() {
  return simCustomFormat;
}

export function setOpticalEvmCustomFormat(fmt) {
  if (!fmt || Object.keys(OPTICAL_EVM_CONSTANTS.FORMATS).includes(fmt)) {
    simCustomFormat = fmt || null;
  }
}

export function resetOpticalEvmSimState() {
  selectedLinkId = OPTICAL_EVM_CONSTANTS.DEFAULT_LINK_ID;
  const link = SHAHDARA_OPTICAL_EVM_LINKS.find(l => l.id === selectedLinkId);
  simDcmCompPsPerNm = link.dcmCompensatedPsPerNm;
  simLaunchPowerDbm = link.launchPowerDbm;
  simCustomFormat = null;
}

/**
 * Calculate accumulated fiber chromatic dispersion (ps/nm).
 */
export function calculateAccumulatedDispersion(distanceKm, dispersionCoeffPsPerNmKm) {
  return Number(((Number(distanceKm) || 0) * (Number(dispersionCoeffPsPerNmKm) || 0)).toFixed(2));
}

/**
 * Calculate residual uncompensated chromatic dispersion (ps/nm).
 */
export function calculateResidualDispersion(accumulatedPsPerNm, compensatedPsPerNm) {
  return Number(((Number(accumulatedPsPerNm) || 0) - (Number(compensatedPsPerNm) || 0)).toFixed(2));
}

/**
 * Calculate dynamic EVM RMS percentage based on residual dispersion and optical launch power.
 */
export function calculateEvmFromDispersion(baselineEvm = 7.2, residualDispersion = 0, launchPowerDbm = 2.0) {
  // Dispersion phase eye closure penalty
  const absRes = Math.abs(residualDispersion);
  const cdPenalty = Number((0.012 * Math.pow(absRes / 10, 1.15)).toFixed(2));

  // Nonlinear Self-Phase Modulation (SPM) penalty at high launch power (> 2.5 dBm)
  const nlPenalty = launchPowerDbm > 2.5 ? Number(((launchPowerDbm - 2.5) * 1.35).toFixed(2)) : 0;

  // Amplified Spontaneous Emission (ASE) noise penalty at low power (< -1.0 dBm)
  const asePenalty = launchPowerDbm < -1.0 ? Number(((-1.0 - launchPowerDbm) * 1.85).toFixed(2)) : 0;

  const evmRmsPct = Number((baselineEvm + cdPenalty + nlPenalty + asePenalty).toFixed(2));
  const evmDb = Number((20 * Math.log10(evmRmsPct / 100)).toFixed(2));

  return {
    baselineEvm,
    cdPenalty,
    nlPenalty,
    asePenalty,
    evmRmsPct,
    evmDb
  };
}

/**
 * Approximate complementary error function erfc(x).
 */
function approxErfc(x) {
  if (x >= 8) return 0;
  if (x <= -8) return 2;
  // Numerical approximation (Abramowitz and Stegun)
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign === 1 ? (1.0 - y) : (1.0 + y);
}

/**
 * Estimate Pre-FEC Bit Error Rate (BER) from EVM RMS.
 */
export function estimatePreFecBer(evmRmsPct = 7.2, format = 'DP_QPSK') {
  const evmFraction = Math.max(0.01, evmRmsPct / 100);
  // Linear effective Signal-to-Noise Ratio (SNR)
  const snr = 1.0 / (evmFraction * evmFraction);
  let qFactor = Math.sqrt(snr);

  // 16-QAM has higher sensitivity to Euclidean distance error
  if (format === 'QAM_16') {
    qFactor = qFactor * 0.632;
  }

  const ber = 0.5 * approxErfc(qFactor / Math.SQRT2);
  return Number(Math.max(1e-12, Math.min(0.5, ber)).toExponential(2));
}

/**
 * Calculate Post-FEC Safety Margin in dB relative to SD-FEC threshold (2.0e-2).
 */
export function calculateFecMargin(preFecBer = 1.2e-7, sdFecLimit = OPTICAL_EVM_CONSTANTS.FEC_LIMITS.SD_FEC_BER) {
  if (preFecBer >= sdFecLimit) return 0;
  // Ratio of distance to FEC threshold in logarithmic dB scale
  const ratio = sdFecLimit / Math.max(1e-12, preFecBer);
  const marginDb = Number((10 * Math.log10(ratio)).toFixed(2));
  return Math.max(0, marginDb);
}

/**
 * Calculate complete optical link EVM and dispersion dynamics.
 */
export function calculateOpticalEvmDynamics(link, options = {}) {
  const selectedLink = link || SHAHDARA_OPTICAL_EVM_LINKS.find(l => l.id === selectedLinkId) || SHAHDARA_OPTICAL_EVM_LINKS[0];
  const dcmCompPsPerNm = options.dcmCompPsPerNm !== undefined ? Number(options.dcmCompPsPerNm) : simDcmCompPsPerNm;
  const launchPowerDbm = options.launchPowerDbm !== undefined ? Number(options.launchPowerDbm) : simLaunchPowerDbm;
  const format = options.format || simCustomFormat || selectedLink.format;

  const accumulatedDispersion = calculateAccumulatedDispersion(
    selectedLink.distanceKm,
    selectedLink.dispersionCoeffPsPerNmKm
  );

  const residualDispersion = calculateResidualDispersion(accumulatedDispersion, dcmCompPsPerNm);

  const evmData = calculateEvmFromDispersion(
    selectedLink.baselineEvmPct,
    residualDispersion,
    launchPowerDbm
  );

  const preFecBer = estimatePreFecBer(evmData.evmRmsPct, format);
  const fecMarginDb = calculateFecMargin(preFecBer, OPTICAL_EVM_CONSTANTS.FEC_LIMITS.SD_FEC_BER);

  // Status determination
  let status = OPTICAL_EVM_CONSTANTS.STATUS.OPTIMAL_POST_FEC_CLEAR;
  let statusClass = 'optimal';

  if (evmData.evmRmsPct > OPTICAL_EVM_CONSTANTS.FEC_LIMITS.SD_FEC_EVM) {
    status = OPTICAL_EVM_CONSTANTS.STATUS.FEC_UNRESOLVABLE_OUTAGE;
    statusClass = 'critical';
  } else if (evmData.evmRmsPct > OPTICAL_EVM_CONSTANTS.FEC_LIMITS.HD_FEC_EVM) {
    status = OPTICAL_EVM_CONSTANTS.STATUS.EVM_DEGRADED_WARNING;
    statusClass = 'degraded';
  } else if (evmData.cdPenalty > 1.5 || evmData.nlPenalty > 1.0) {
    status = OPTICAL_EVM_CONSTANTS.STATUS.SD_FEC_OPERATIONAL;
    statusClass = 'degraded';
  }

  return {
    link: selectedLink,
    format,
    formatName: OPTICAL_EVM_CONSTANTS.FORMATS[format] || format,
    dcmCompPsPerNm,
    launchPowerDbm,
    accumulatedDispersion,
    residualDispersion,
    evmData,
    preFecBer,
    fecMarginDb,
    status,
    statusClass
  };
}

/**
 * Calculate aggregate fleet metrics across all 5 Shahdara optical coherent links.
 */
export function calculateOpticalEvmMetrics(state = {}, options = {}) {
  const links = SHAHDARA_OPTICAL_EVM_LINKS;
  const currentDynamics = calculateOpticalEvmDynamics(null, options);

  let totalCapacityGbps = 0;
  let totalRevenuePkr = 0;
  let totalSubscribers = 0;
  let totalDistanceKm = 0;

  links.forEach(l => {
    totalCapacityGbps += l.capacityGbps;
    totalRevenuePkr += l.monthlyRevenuePkr;
    totalSubscribers += l.subscribersCount;
    totalDistanceKm += l.distanceKm;
  });

  const avgEvmRms = Number(
    (links.reduce((acc, l) => acc + l.baselineEvmPct, 0) / links.length).toFixed(1)
  );

  return {
    totalLinks: links.length,
    totalCapacityGbps,
    totalRevenuePkr,
    totalSubscribers,
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    avgEvmRms,
    currentDynamics
  };
}

/**
 * Pure-vector SVG visualizer for 2D Optical Constellation Diagram (I vs Q) and EVM Scatter.
 */
export function renderOpticalEvmDiagramSvg(dynamics, options = {}) {
  const d = dynamics || calculateOpticalEvmDynamics();
  const l = d.link;
  const isDark = Boolean(options.isDark);

  const bg = isDark ? '#0f172a' : '#ffffff';
  const textMain = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? '#334155' : '#e2e8f0';

  const width = 800;
  const height = 400;

  // Center of constellation coordinate plane
  const cx = 220;
  const cy = 200;
  const scale = 110;

  // Reference constellation points based on modulation format
  let refPoints = [];
  if (d.format === 'DPSK') {
    // 2 points on real I axis: +1 and -1
    refPoints = [{ x: 1, y: 0 }, { x: -1, y: 0 }];
  } else if (d.format === 'QAM_16') {
    // 16 points grid (-3, -1, +1, +3) normalized by sqrt(10)
    const norm = 1.0 / Math.sqrt(10);
    const coords = [-3, -1, 1, 3];
    coords.forEach(ix => {
      coords.forEach(qy => {
        refPoints.push({ x: ix * norm, y: qy * norm });
      });
    });
  } else {
    // QPSK / DQPSK / DP-QPSK: 4 points on diagonals (pi/4, 3pi/4, 5pi/4, 7pi/4)
    const norm = 1.0 / Math.SQRT2;
    refPoints = [
      { x: norm, y: norm },
      { x: -norm, y: norm },
      { x: -norm, y: -norm },
      { x: norm, y: -norm }
    ];
  }

  // Generate simulated scatter point cloud around reference points based on EVM RMS
  const scatterCountPerPoint = d.format === 'QAM_16' ? 12 : 24;
  const noiseSigma = (d.evmData.evmRmsPct / 100) * 0.75;

  let scatterMarkup = '';
  // Deterministic pseudo-random scatter cloud for stability in testing and rendering
  refPoints.forEach((rp, pIdx) => {
    for (let s = 0; s < scatterCountPerPoint; s++) {
      const angle = ((s * 137.5) % 360) * (Math.PI / 180);
      const r = ((s * 0.17) % 1.0) * noiseSigma;
      const px = cx + ((rp.x + (r * Math.cos(angle))) * scale);
      const py = cy - ((rp.y + (r * Math.sin(angle))) * scale);

      scatterMarkup += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="#06b6d4" opacity="0.45"/>`;
    }
  });

  // Reference ideal points
  let refPointsMarkup = '';
  refPoints.forEach((rp) => {
    const rx = cx + (rp.x * scale);
    const ry = cy - (rp.y * scale);
    refPointsMarkup += `
      <circle cx="${rx}" cy="${ry}" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
      <circle cx="${rx}" cy="${ry}" r="${(noiseSigma * scale).toFixed(1)}" fill="none" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2" opacity="0.6"/>
    `;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="optical-evm-svg" style="background:${bg}; border-radius:12px; width:100%; height:auto;">
      <!-- Title & Status Ribbon -->
      <text x="40" y="34" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="${textMain}">${l.name}</text>
      <rect x="${width - 240}" y="18" width="200" height="24" rx="12" fill="${d.statusClass === 'optimal' ? '#10b98120' : (d.statusClass === 'critical' ? '#ef444420' : '#f59e0b20')}"/>
      <circle cx="${width - 226}" cy="30" r="5" fill="${d.statusClass === 'optimal' ? '#10b981' : (d.statusClass === 'critical' ? '#ef4444' : '#f59e0b')}"/>
      <text x="${width - 214}" y="34" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${d.statusClass === 'optimal' ? '#10b981' : (d.statusClass === 'critical' ? '#ef4444' : '#f59e0b')}">${d.status.split('(')[0].trim()}</text>

      <!-- Constellation Graph Container -->
      <g>
        <!-- Axes -->
        <rect x="40" y="60" width="360" height="280" rx="8" fill="${isDark ? '#1e293b' : '#f8fafc'}" stroke="${borderCol}" stroke-width="1"/>
        <line x1="50" y1="${cy}" x2="390" y2="${cy}" stroke="${borderCol}" stroke-width="1.5"/>
        <line x1="${cx}" y1="70" x2="${cx}" y2="330" stroke="${borderCol}" stroke-width="1.5"/>
        <!-- Unit circle -->
        <circle cx="${cx}" cy="${cy}" r="${scale}" fill="none" stroke="${borderCol}" stroke-width="1" stroke-dasharray="4,4"/>

        <!-- Axis Labels -->
        <text x="380" y="${cy - 8}" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${textMuted}" text-anchor="end">In-Phase (I)</text>
        <text x="${cx + 8}" y="82" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="${textMuted}">Quadrature (Q)</text>

        <!-- Scatter Points and Reference Constellation -->
        ${scatterMarkup}
        ${refPointsMarkup}

        <text x="50" y="78" font-family="system-ui, sans-serif" font-size="10.5" font-weight="700" fill="${textMain}">${d.format}</text>
      </g>

      <!-- Right Telemetry Panel -->
      <g transform="translate(420, 60)">
        <rect x="0" y="0" width="340" height="280" rx="8" fill="${isDark ? '#1e293b' : '#f8fafc'}" stroke="${borderCol}" stroke-width="1"/>

        <!-- Header -->
        <text x="20" y="30" font-family="system-ui, sans-serif" font-size="12" font-weight="800" fill="${textMain}">COHERENT DSP OPTICAL TELEMETRY</text>
        <line x1="20" y1="44" x2="320" y2="44" stroke="${borderCol}" stroke-width="1"/>

        <!-- Stat 1: EVM RMS -->
        <text x="20" y="70" font-family="system-ui, sans-serif" font-size="10" fill="${textMuted}">ERROR VECTOR MAGNITUDE (EVM)</text>
        <text x="20" y="94" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="${d.evmData.evmRmsPct <= 12.5 ? '#10b981' : (d.evmData.evmRmsPct <= 18.5 ? '#f59e0b' : '#ef4444')}">${d.evmData.evmRmsPct}% <tspan font-size="12" font-weight="500" fill="${textMuted}">(${d.evmData.evmDb} dB)</tspan></text>

        <!-- Stat 2: Pre-FEC BER -->
        <text x="20" y="126" font-family="system-ui, sans-serif" font-size="10" fill="${textMuted}">ESTIMATED PRE-FEC BER</text>
        <text x="20" y="148" font-family="monospace" font-size="15" font-weight="700" fill="${textMain}">${d.preFecBer}</text>
        <text x="20" y="162" font-family="system-ui, sans-serif" font-size="9" fill="${textMuted}">SD-FEC Threshold Limit: 2.00e-2</text>

        <!-- Stat 3: Post-FEC Margin -->
        <text x="20" y="194" font-family="system-ui, sans-serif" font-size="10" fill="${textMuted}">POST-FEC SAFETY MARGIN</text>
        <text x="20" y="216" font-family="system-ui, sans-serif" font-size="16" font-weight="700" fill="#10b981">+${d.fecMarginDb} dB</text>

        <!-- Stat 4: Chromatic Dispersion -->
        <text x="20" y="248" font-family="system-ui, sans-serif" font-size="10" fill="${textMuted}">RESIDUAL CHROMATIC DISPERSION</text>
        <text x="20" y="268" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="${Math.abs(d.residualDispersion) < 30 ? '#10b981' : '#f59e0b'}">${d.residualDispersion} ps/nm <tspan font-size="10" font-weight="500" fill="${textMuted}">(Accum: ${d.accumulatedDispersion})</tspan></text>
      </g>

      <!-- Bottom HUD Ribbon -->
      <g transform="translate(40, 350)">
        <rect x="0" y="0" width="${width - 80}" height="38" rx="6" fill="${isDark ? '#1e293b' : '#f1f5f9'}"/>
        <text x="16" y="24" font-family="system-ui, sans-serif" font-size="10" fill="${textMuted}">FIBER: <tspan font-weight="700" fill="${textMain}">${l.fiberType}</tspan> | SPAN: <tspan font-weight="700" fill="${textMain}">${l.distanceKm} km</tspan> | TX POWER: <tspan font-weight="700" fill="${textMain}">${d.launchPowerDbm} dBm</tspan> | DCM COMP: <tspan font-weight="700" fill="${textMain}">${d.dcmCompPsPerNm} ps/nm</tspan> | REVENUE: <tspan font-weight="700" fill="${textMain}">${formatPKR(l.monthlyRevenuePkr)}</tspan></text>
      </g>
    </svg>
  `;
}

/**
 * Generate formatted ASCII audit report for Optical EVM telemetry.
 */
export function generateOpticalEvmReport(dynamics, options = {}) {
  const d = dynamics || calculateOpticalEvmDynamics();
  const l = d.link;

  const lines = [
    '================================================================================',
    '   SHAHDARA OPTICAL CORE - CONSTELLATION EVM & DISPERSION AUDIT REPORT         ',
    '================================================================================',
    `Date & Time        : ${new Date().toISOString()}`,
    `Link Identifier    : ${l.id}`,
    `Link Description   : ${l.name}`,
    `Modulation Format  : ${d.formatName}`,
    `Optical Span Route : ${l.primaryArea} -> ${l.targetArea} (${l.distanceKm} km, ${l.fiberType})`,
    `Monthly Recurring  : ${formatPKR(l.monthlyRevenuePkr)} (${l.subscribersCount} Active Subs)`,
    '--------------------------------------------------------------------------------',
    'CONSTELLATION EVM & FORWARD ERROR CORRECTION (FEC) TELEMETRY:',
    `  EVM RMS Percentage     : ${d.evmData.evmRmsPct}% (${d.evmData.evmDb} dB)`,
    `  Baseline Back-to-Back  : ${d.evmData.baselineEvm}%`,
    `  Chromatic Disp Penalty : +${d.evmData.cdPenalty}% EVM`,
    `  Nonlinear SPM Penalty  : +${d.evmData.nlPenalty}% EVM (Tx Launch: ${d.launchPowerDbm} dBm)`,
    `  ASE Optical Noise Pen  : +${d.evmData.asePenalty}% EVM`,
    `  Pre-FEC Bit Error Rate : ${d.preFecBer}`,
    `  Hard-Decision Limit    : ${OPTICAL_EVM_CONSTANTS.FEC_LIMITS.HD_FEC_BER} (Max EVM: ${OPTICAL_EVM_CONSTANTS.FEC_LIMITS.HD_FEC_EVM}%)`,
    `  Soft-Decision Limit    : ${OPTICAL_EVM_CONSTANTS.FEC_LIMITS.SD_FEC_BER} (Max EVM: ${OPTICAL_EVM_CONSTANTS.FEC_LIMITS.SD_FEC_EVM}%)`,
    `  Post-FEC Safety Margin : +${d.fecMarginDb} dB`,
    `  Link Quality Verdict   : ${d.status}`,
    '--------------------------------------------------------------------------------',
    'OPTICAL DISPERSION COMPENSATION TELEMETRY:',
    `  Accumulated Dispersion : ${d.accumulatedDispersion} ps/nm (@ ${l.dispersionCoeffPsPerNmKm} ps/nm/km)`,
    `  DCM Module Comp Applied: ${d.dcmCompPsPerNm} ps/nm`,
    `  Residual Dispersion    : ${d.residualDispersion} ps/nm`,
    'Compliant with ITU-T G.698.2 and OIF-400ZR Coherent Optical Interface Standards.',
    '================================================================================'
  ];

  return lines.join('\n');
}

/**
 * Export Optical EVM telemetry snapshot to JSON string.
 */
export function exportOpticalEvmJson(dynamics) {
  const d = dynamics || calculateOpticalEvmDynamics();
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    standard: 'ITU-T G.698.2 / OIF-400ZR',
    link: d.link,
    telemetry: {
      format: d.format,
      evmRmsPct: d.evmData.evmRmsPct,
      evmDb: d.evmData.evmDb,
      preFecBer: d.preFecBer,
      fecMarginDb: d.fecMarginDb,
      accumulatedDispersion: d.accumulatedDispersion,
      residualDispersion: d.residualDispersion,
      dcmCompPsPerNm: d.dcmCompPsPerNm,
      launchPowerDbm: d.launchPowerDbm,
      status: d.status
    }
  }, null, 2);
}

/**
 * Export Optical EVM telemetry snapshot to CSV string.
 */
export function exportOpticalEvmCsv(dynamics) {
  const d = dynamics || calculateOpticalEvmDynamics();
  const l = d.link;

  const headers = [
    'LinkId',
    'LinkName',
    'Format',
    'DistanceKm',
    'LaunchPowerDbm',
    'AccumulatedDispersion',
    'ResidualDispersion',
    'EvmRmsPct',
    'PreFecBer',
    'FecMarginDb',
    'CapacityGbps',
    'Status',
    'MonthlyRevenuePkr'
  ];

  const row = [
    `"${l.id}"`,
    `"${l.name}"`,
    `"${d.format}"`,
    l.distanceKm,
    d.launchPowerDbm,
    d.accumulatedDispersion,
    d.residualDispersion,
    d.evmData.evmRmsPct,
    d.preFecBer,
    d.fecMarginDb,
    l.capacityGbps,
    `"${d.status}"`,
    l.monthlyRevenuePkr
  ];

  return headers.join(',') + '\n' + row.join(',');
}

/**
 * Modal and dashboard card UI controller for Optical EVM Matrix.
 */
export function setupOpticalEvmModal(state = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('dashboardOpticalEvmModal');
  const openBtn = doc.getElementById('dashboardOpenOpticalEvmModalBtn');
  const closeBtn = doc.getElementById('dashboardOpticalEvmModalCloseBtn');

  const cardChart = doc.getElementById('dashboardOpticalEvmChart');
  const modalDiagram = doc.getElementById('opticalEvmModalDiagramContainer');

  const linkSelect = doc.getElementById('opticalEvmLinkSelect');
  const formatSelect = doc.getElementById('opticalEvmFormatSelect');
  const dcmSlider = doc.getElementById('opticalEvmDcmSlider');
  const dcmLabel = doc.getElementById('opticalEvmDcmLabel');
  const powerSlider = doc.getElementById('opticalEvmPowerSlider');
  const powerLabel = doc.getElementById('opticalEvmPowerLabel');
  const resetBtn = doc.getElementById('opticalEvmResetBtn');

  // Stats in modal
  const statStatus = doc.getElementById('opticalEvmStatStatus');
  const statEvm = doc.getElementById('opticalEvmStatEvm');
  const statBer = doc.getElementById('opticalEvmStatBer');
  const statMargin = doc.getElementById('opticalEvmStatMargin');
  const statDispersion = doc.getElementById('opticalEvmStatDispersion');
  const statCapacity = doc.getElementById('opticalEvmStatCapacity');

  // Action buttons
  const filterAreaBtn = doc.getElementById('opticalEvmFilterAreaBtn');
  const exportJsonBtn = doc.getElementById('opticalEvmExportJsonBtn');
  const exportCsvBtn = doc.getElementById('opticalEvmExportCsvBtn');
  const copyReportBtn = doc.getElementById('opticalEvmCopyReportBtn');

  function renderView() {
    const isDark = doc.documentElement && doc.documentElement.getAttribute('data-theme') === 'dark';
    const dyn = calculateOpticalEvmDynamics();

    // Render SVG into card
    if (cardChart) {
      cardChart.innerHTML = renderOpticalEvmDiagramSvg(dyn, { isDark });
    }

    // Render SVG into modal
    if (modalDiagram) {
      modalDiagram.innerHTML = renderOpticalEvmDiagramSvg(dyn, { isDark });
    }

    // Update modal stat HUD
    if (statStatus) {
      statStatus.textContent = dyn.status.split('(')[0].trim();
      statStatus.className = 'optical-evm-stat-val ' + dyn.statusClass;
    }
    if (statEvm) {
      statEvm.textContent = `${dyn.evmData.evmRmsPct}% (${dyn.evmData.evmDb} dB)`;
    }
    if (statBer) {
      statBer.textContent = `${dyn.preFecBer}`;
    }
    if (statMargin) {
      statMargin.textContent = `+${dyn.fecMarginDb} dB`;
      statMargin.style.color = dyn.fecMarginDb >= 3.0 ? 'var(--color-success, #10b981)' : 'var(--color-warning, #f59e0b)';
    }
    if (statDispersion) {
      statDispersion.textContent = `${dyn.residualDispersion} ps/nm`;
    }
    if (statCapacity) {
      statCapacity.textContent = `${dyn.link.capacityGbps} Gbps`;
    }

    // Labels
    if (dcmLabel && dcmSlider) {
      dcmLabel.textContent = `${dcmSlider.value} ps/nm`;
    }
    if (powerLabel && powerSlider) {
      powerLabel.textContent = `${powerSlider.value} dBm`;
    }
  }

  // Event handlers
  if (linkSelect) {
    linkSelect.addEventListener('change', () => {
      setOpticalEvmSelectedLinkId(linkSelect.value);
      if (dcmSlider) dcmSlider.value = getOpticalEvmDcmCompPsPerNm();
      if (powerSlider) powerSlider.value = getOpticalEvmLaunchPowerDbm();
      renderView();
    });
  }

  if (formatSelect) {
    formatSelect.addEventListener('change', () => {
      setOpticalEvmCustomFormat(formatSelect.value);
      renderView();
    });
  }

  if (dcmSlider) {
    dcmSlider.addEventListener('input', () => {
      setOpticalEvmDcmCompPsPerNm(dcmSlider.value);
      renderView();
    });
  }

  if (powerSlider) {
    powerSlider.addEventListener('input', () => {
      setOpticalEvmLaunchPowerDbm(powerSlider.value);
      renderView();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetOpticalEvmSimState();
      if (linkSelect) linkSelect.value = getOpticalEvmSelectedLinkId();
      if (dcmSlider) dcmSlider.value = getOpticalEvmDcmCompPsPerNm();
      if (powerSlider) powerSlider.value = getOpticalEvmLaunchPowerDbm();
      if (formatSelect) formatSelect.value = '';
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Optical EVM parameters reset to baseline');
      }
    });
  }

  if (filterAreaBtn) {
    filterAreaBtn.addEventListener('click', () => {
      const dyn = calculateOpticalEvmDynamics();
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(dyn.link.primaryArea);
      }
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const jsonStr = exportOpticalEvmJson();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(jsonStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Optical EVM JSON telemetry copied to clipboard');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csvStr = exportOpticalEvmCsv();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(csvStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Optical EVM CSV telemetry copied to clipboard');
      }
    });
  }

  if (copyReportBtn) {
    copyReportBtn.addEventListener('click', () => {
      const report = generateOpticalEvmReport();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(report);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Optical EVM audit report copied to clipboard');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      if (linkSelect) linkSelect.value = getOpticalEvmSelectedLinkId();
      if (dcmSlider) dcmSlider.value = getOpticalEvmDcmCompPsPerNm();
      if (powerSlider) powerSlider.value = getOpticalEvmLaunchPowerDbm();
      renderView();
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

  // Initial draw
  renderView();

  return {
    open: () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
        renderView();
      }
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    render: renderView
  };
}
