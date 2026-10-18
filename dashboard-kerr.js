import { formatPKR } from './core.js';

/**
 * Optical Fiber Nonlinear Kerr Effects (Self-Phase Modulation - SPM,
 * Cross-Phase Modulation - XPM, Four-Wave Mixing - FWM) Threshold & Crosstalk Estimator
 *
 * Models carrier DWDM/CWDM optical transport and nonlinear optical propagation across
 * Shahdara ISP regional fiber backhauls and distribution trunks:
 * - Refractive index intensity dependence: n = n0 + n2 * (P / Aeff)
 * - Self-Phase Modulation (SPM): Spectral chirping & temporal pulse distortion
 * - Cross-Phase Modulation (XPM): Inter-channel phase jitter and walk-off suppression
 * - Four-Wave Mixing (FWM): Intermodulation products and coherent in-band crosstalk
 * - Nonlinear Optical SNR Penalty and maximum launch power threshold
 * - Correlates optical span health with Shahdara subscriber revenue and SLA commitments
 */

export const KERR_CONSTANTS = {
  DEFAULT_LINK_ID: 'kerr-link-shahdara-core',
  DEFAULT_FIBER_KEY: 'SSMF_G652D',
  DEFAULT_LAUNCH_POWER_DBM: 3.0,
  DEFAULT_CHANNEL_COUNT: 16,
  DEFAULT_GRID_SPACING_GHZ: 100,

  OPTICAL_WAVELENGTH_NM: 1550.0,
  OPTICAL_WAVELENGTH_M: 1.55e-6,
  SPEED_OF_LIGHT_KM_S: 2.99792458e5, // km/s
  SPEED_OF_LIGHT_M_S: 2.99792458e8, // m/s
  NONLINEAR_INDEX_N2: 2.6e-20, // m^2 / W

  SPM_PHASE_THRESHOLD_RAD: 1.0, // Critical SPM nonlinear phase criterion (rad)
  SPM_OPTIMAL_PHASE_RAD: 0.6,
  FWM_CROSSTALK_WARNING_DBC: -30.0, // Max recommended FWM crosstalk ratio (dBc)
  FWM_CROSSTALK_CRITICAL_DBC: -24.0,
  OSNR_PENALTY_WARNING_DB: 0.8,
  OSNR_PENALTY_CRITICAL_DB: 2.0,

  GRID_SPACINGS: {
    50: '50 GHz (ITU-T DWDM Dense Grid - 0.4 nm)',
    100: '100 GHz (ITU-T DWDM Standard Grid - 0.8 nm)',
    200: '200 GHz (ITU-T DWDM Coarse Grid - 1.6 nm)'
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const FIBER_PROFILES = {
  SSMF_G652D: {
    name: 'G.652.D Standard Single-Mode Fiber (SSMF)',
    effectiveAreaUm2: 80.0, // Aeff (um^2)
    attenuationDbPerKm: 0.20, // alpha_dB (dB/km) at 1550 nm
    chromaticDispersionPsNmKm: 17.0, // D at 1550 nm
    dispersionSlope: 0.058, // S (ps / nm^2 / km)
    pmdCoeff: 0.04,
    description: 'Universal standard metro/regional fiber. High dispersion suppresses FWM crosstalk effectively.'
  },
  NZDSF_G655: {
    name: 'G.655 Non-Zero Dispersion-Shifted Fiber (NZDSF)',
    effectiveAreaUm2: 55.0,
    attenuationDbPerKm: 0.22,
    chromaticDispersionPsNmKm: 4.5,
    dispersionSlope: 0.070,
    pmdCoeff: 0.06,
    description: 'Reduced dispersion reduces dispersion compensation needs, but lower Aeff and low D elevate FWM risk.'
  },
  ULL_G654E: {
    name: 'G.654.E Ultra-Low Loss Large Effective Area Fiber',
    effectiveAreaUm2: 125.0,
    attenuationDbPerKm: 0.17,
    chromaticDispersionPsNmKm: 20.0,
    dispersionSlope: 0.060,
    pmdCoeff: 0.03,
    description: 'Large effective area (125 um^2) and ULL core maximize Kerr nonlinear power handling headroom.'
  },
  DSF_G653: {
    name: 'G.653 Legacy Dispersion-Shifted Fiber (Zero-Dispersion C-Band)',
    effectiveAreaUm2: 50.0,
    attenuationDbPerKm: 0.24,
    chromaticDispersionPsNmKm: 0.5,
    dispersionSlope: 0.075,
    pmdCoeff: 0.08,
    description: 'Near-zero chromatic dispersion in C-band causes severe FWM intermodulation and channel collapse.'
  },
  BIF_G657A2: {
    name: 'G.657.A2 Bend-Insensitive Feeder / Trunk Fiber',
    effectiveAreaUm2: 78.0,
    attenuationDbPerKm: 0.21,
    chromaticDispersionPsNmKm: 16.8,
    dispersionSlope: 0.058,
    pmdCoeff: 0.05,
    description: 'Tight macro-bend tolerance with high dispersion and robust Kerr nonlinear threshold.'
  }
};

export const SHAHDARA_KERR_LINKS = [
  {
    id: 'kerr-link-shahdara-core',
    name: 'Shahdara Central NOC -> Ravi Siphon Metro Transit Ring',
    defaultFiberKey: 'SSMF_G652D',
    lengthKm: 28.5,
    defaultLaunchPowerDbm: 3.0,
    defaultChannels: 16,
    defaultGridGhz: 100,
    primaryArea: 'Ravi Siphon',
    secondaryAreas: ['Shahdara Town', 'Kot Abdul Malik'],
    operationalRole: 'Primary Wholesale Transit & Core Ring Interconnect',
    equipmentType: 'DWDM Metro Reconfigurable OADM ROADM-16'
  },
  {
    id: 'kerr-link-kot-abdul-malik',
    name: 'Shahdara Hub -> Kot Abdul Malik Sub-Ring Feeder',
    defaultFiberKey: 'NZDSF_G655',
    lengthKm: 22.0,
    defaultLaunchPowerDbm: 1.0,
    defaultChannels: 8,
    defaultGridGhz: 50,
    primaryArea: 'Kot Abdul Malik',
    secondaryAreas: ['Shahdara Town'],
    operationalRole: 'Industrial Zone Carrier-Grade Enterprise Feeder',
    equipmentType: '100G Coherent CFP2-DCO DWDM Transponder'
  },
  {
    id: 'kerr-link-vandala-express',
    name: 'Shahdara Exchange -> Vandala Road OLT Distribution Trunk',
    defaultFiberKey: 'BIF_G657A2',
    lengthKm: 14.8,
    defaultLaunchPowerDbm: 4.0,
    defaultChannels: 4,
    defaultGridGhz: 200,
    primaryArea: 'Vandala Road',
    secondaryAreas: ['Shahdara Town'],
    operationalRole: 'FTTH OLT Aggregation Feeder Trunk',
    equipmentType: 'Combo-PON / DWDM Co-existence Mux-Demux'
  },
  {
    id: 'kerr-link-baradari-metro',
    name: 'Baradari Feeder -> Lahore Ring Fiber Interconnect',
    defaultFiberKey: 'SSMF_G652D',
    lengthKm: 36.2,
    defaultLaunchPowerDbm: 2.0,
    defaultChannels: 24,
    defaultGridGhz: 50,
    primaryArea: 'Baradari',
    secondaryAreas: ['Shahdara Town'],
    operationalRole: 'Inter-City Gateway & Metro Peering Backbone',
    equipmentType: 'DWDM EDFA/ROADM Flexible Grid Terminal'
  },
  {
    id: 'kerr-link-sheikhupura-gateway',
    name: 'Shahdara Regional Gateway -> Sheikhupura Wholesale IXP',
    defaultFiberKey: 'ULL_G654E',
    lengthKm: 45.0,
    defaultLaunchPowerDbm: 5.0,
    defaultChannels: 32,
    defaultGridGhz: 100,
    primaryArea: 'Shahdara Town',
    secondaryAreas: ['Kot Abdul Malik', 'Ravi Siphon'],
    operationalRole: 'High-Capacity Metro Core Transport Ring',
    equipmentType: '400G ZR+ Coherent Optical DWDM Transport'
  }
];

// Mutable interactive simulation state with deterministic fallbacks
let simSelectedLinkId = KERR_CONSTANTS.DEFAULT_LINK_ID;
let simSelectedFiberKey = KERR_CONSTANTS.DEFAULT_FIBER_KEY;
let simLaunchPowerDbm = KERR_CONSTANTS.DEFAULT_LAUNCH_POWER_DBM;
let simChannelCount = KERR_CONSTANTS.DEFAULT_CHANNEL_COUNT;
let simGridSpacingGhz = KERR_CONSTANTS.DEFAULT_GRID_SPACING_GHZ;

export function getKerrSelectedLink() {
  return simSelectedLinkId;
}

export function setKerrSelectedLink(id) {
  if (SHAHDARA_KERR_LINKS.some(link => link.id === id)) {
    simSelectedLinkId = id;
    const link = SHAHDARA_KERR_LINKS.find(l => l.id === id);
    if (link) {
      simSelectedFiberKey = link.defaultFiberKey;
      simLaunchPowerDbm = link.defaultLaunchPowerDbm;
      simChannelCount = link.defaultChannels;
      simGridSpacingGhz = link.defaultGridGhz;
    }
  }
}

export function getKerrSelectedFiberType() {
  return simSelectedFiberKey;
}

export function setKerrSelectedFiberType(key) {
  if (FIBER_PROFILES[key]) {
    simSelectedFiberKey = key;
  }
}

export function getKerrLaunchPowerDbm() {
  return simLaunchPowerDbm;
}

export function setKerrLaunchPowerDbm(val) {
  const num = Number(val);
  if (!Number.isNaN(num) && num >= -5.0 && num <= 12.0) {
    simLaunchPowerDbm = Math.round(num * 10) / 10;
  }
}

export function getKerrChannelCount() {
  return simChannelCount;
}

export function setKerrChannelCount(val) {
  const num = parseInt(val, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= 48) {
    simChannelCount = num;
  }
}

export function getKerrGridSpacingGhz() {
  return simGridSpacingGhz;
}

export function setKerrGridSpacingGhz(val) {
  const num = parseInt(val, 10);
  if ([50, 100, 200].includes(num)) {
    simGridSpacingGhz = num;
  }
}

export function resetKerrSimState() {
  simSelectedLinkId = KERR_CONSTANTS.DEFAULT_LINK_ID;
  const link = SHAHDARA_KERR_LINKS.find(l => l.id === simSelectedLinkId);
  simSelectedFiberKey = link ? link.defaultFiberKey : KERR_CONSTANTS.DEFAULT_FIBER_KEY;
  simLaunchPowerDbm = link ? link.defaultLaunchPowerDbm : KERR_CONSTANTS.DEFAULT_LAUNCH_POWER_DBM;
  simChannelCount = link ? link.defaultChannels : KERR_CONSTANTS.DEFAULT_CHANNEL_COUNT;
  simGridSpacingGhz = link ? link.defaultGridGhz : KERR_CONSTANTS.DEFAULT_GRID_SPACING_GHZ;
}

/**
 * Calculates physical Kerr nonlinear parameters (SPM, XPM, FWM) for a given span.
 */
export function calculateKerrDynamics(params = {}) {
  const lengthKm = Math.max(0.1, Number(params.lengthKm ?? 28.5));
  const fiberKey = params.fiberKey && FIBER_PROFILES[params.fiberKey] ? params.fiberKey : KERR_CONSTANTS.DEFAULT_FIBER_KEY;
  const fiber = FIBER_PROFILES[fiberKey];
  const launchPowerDbm = Number(params.launchPowerDbm ?? KERR_CONSTANTS.DEFAULT_LAUNCH_POWER_DBM);
  const channels = Math.max(1, parseInt(params.channels ?? KERR_CONSTANTS.DEFAULT_CHANNEL_COUNT, 10));
  const gridGhz = [50, 100, 200].includes(Number(params.gridGhz)) ? Number(params.gridGhz) : KERR_CONSTANTS.DEFAULT_GRID_SPACING_GHZ;

  // Optical wavelength lambda in meters
  const lambda = KERR_CONSTANTS.OPTICAL_WAVELENGTH_M;
  // Effective area in m^2
  const aEffM2 = fiber.effectiveAreaUm2 * 1e-12;

  // Nonlinear coefficient gamma = (2 * pi * n2) / (lambda * Aeff) in W^-1 * m^-1 -> convert to W^-1 * km^-1
  const gammaM = (2 * Math.PI * KERR_CONSTANTS.NONLINEAR_INDEX_N2) / (lambda * aEffM2);
  const gammaKm = gammaM * 1000.0; // W^-1 * km^-1

  // Fiber attenuation alpha in 1/km (Neper / km)
  // alpha_Np = alpha_dB / (10 * log10(e)) = alpha_dB / 4.3429448
  const alphaNp = fiber.attenuationDbPerKm / 4.342944819;

  // Effective interaction length Leff = (1 - exp(-alpha * L)) / alpha
  const expAlphaL = Math.exp(-alphaNp * lengthKm);
  const leffKm = (1.0 - expAlphaL) / alphaNp;

  // Channel launch power in Watts
  const powerMw = Math.pow(10, launchPowerDbm / 10.0);
  const powerW = powerMw / 1000.0;

  // Total launched optical power across all WDM channels
  const totalPowerW = powerW * channels;
  const totalPowerDbm = 10.0 * Math.log10(Math.max(1e-6, totalPowerW * 1000.0));

  // 1. Self-Phase Modulation (SPM):
  // Non-linear phase shift Phi_SPM = gamma * P_W * Leff (radians)
  const phiSpmRad = gammaKm * powerW * leffKm;

  // SPM Critical Launch Power Threshold (where Phi_SPM reaches threshold criterion)
  const spmThresholdW = KERR_CONSTANTS.SPM_PHASE_THRESHOLD_RAD / (gammaKm * leffKm);
  const spmThresholdDbm = 10.0 * Math.log10(Math.max(1e-6, spmThresholdW * 1000.0));
  const spmThresholdMarginDb = spmThresholdDbm - launchPowerDbm;

  // 2. Cross-Phase Modulation (XPM):
  // Adjacent channel frequency separation Delta_f in Hz
  // Walk-off parameter d_jk = |D| * (lambda^2 / c) * Delta_f (ps/km -> s/km)
  // For each interferer channel j != k:
  const D_ps_nm_km = Math.abs(fiber.chromaticDispersionPsNmKm);
  const c_m_s = KERR_CONSTANTS.SPEED_OF_LIGHT_M_S;
  let xpmSumSuppression = 0.0;

  const centerIndex = Math.floor(channels / 2);
  for (let j = 0; j < channels; j++) {
    if (j === centerIndex) continue;
    const channelOffset = Math.abs(j - centerIndex);
    const deltaFHz = channelOffset * gridGhz * 1e9;
    // Walk-off parameter in s/km
    // D is in ps/(nm * km) = 1e-12 s / (1e-9 m * 1e3 m) = 1e-6 s / m^2
    // d_jk = |D_s_m2| * (lambda^2 / c) * delta_f
    const D_s_m2 = D_ps_nm_km * 1e-6;
    const walkoff_s_m = D_s_m2 * ((lambda * lambda) / c_m_s) * deltaFHz;
    const walkoff_s_km = walkoff_s_m * 1000.0;

    // Suppression factor: 1 / sqrt(1 + (2 * pi * delta_f * walkoff * Leff)^2)
    const omegaDelta = 2 * Math.PI * deltaFHz;
    const walkoffTerm = omegaDelta * walkoff_s_km * leffKm;
    const suppression = 1.0 / Math.sqrt(1.0 + (walkoffTerm * walkoffTerm));
    xpmSumSuppression += suppression;
  }

  // Phi_XPM = 2 * gamma * Leff * P_W * sum(suppression)
  const phiXpmRad = 2.0 * gammaKm * powerW * leffKm * xpmSumSuppression;

  // 3. Four-Wave Mixing (FWM):
  // Phase mismatch Delta_beta = (2 * pi * lambda^2 / c) * (Delta_f)^2 * |D|
  const deltaFGridHz = gridGhz * 1e9;
  const deltaBetaM = (2 * Math.PI * (lambda * lambda) / c_m_s) * (deltaFGridHz * deltaFGridHz) * (D_ps_nm_km * 1e-6);
  const deltaBetaKm = deltaBetaM * 1000.0; // 1/km

  // FWM efficiency eta_FWM
  const denom = (alphaNp * alphaNp) + (deltaBetaKm * deltaBetaKm);
  const sinArg = (deltaBetaKm * lengthKm) / 2.0;
  const sinTerm = Math.sin(sinArg);
  const oscillatory = 1.0 + (4.0 * expAlphaL * (sinTerm * sinTerm)) / Math.max(1e-5, Math.pow(1.0 - expAlphaL, 2));
  const rawEtaFwm = (alphaNp * alphaNp / denom) * oscillatory;
  const etaFwm = Math.min(1.0, Math.max(1e-10, rawEtaFwm));

  // Generated FWM intermodulation products count: M = N^2 * (N - 1) / 2
  const totalFwmProducts = channels > 1 ? Math.round((channels * channels * (channels - 1)) / 2) : 0;
  const effectiveInBandInterferers = Math.min(totalFwmProducts, Math.max(1, channels * 2));

  // Output power of carrier after fiber span
  const powerOutW = powerW * expAlphaL;

  // FWM generated power on worst-case center channel:
  // P_fwm = eta_FWM * (gamma * Leff)^2 * P_W^3 * exp(-alpha * L) * degeneracy_factor
  const pFwmW = etaFwm * Math.pow(gammaKm * leffKm, 2) * Math.pow(powerW, 3) * expAlphaL * effectiveInBandInterferers;
  const fwmCrosstalkRatio = powerOutW > 0 ? pFwmW / powerOutW : 0;
  const fwmCrosstalkDbc = 10.0 * Math.log10(Math.max(1e-12, fwmCrosstalkRatio));

  // Total nonlinear phase shift
  const totalNonlinearPhaseRad = phiSpmRad + phiXpmRad;

  // Nonlinear OSNR Degradation Penalty (dB)
  // Empirical coherent NLI (Nonlinear Interference) expansion
  const nliTerm = 0.45 * (totalNonlinearPhaseRad * totalNonlinearPhaseRad);
  const fwmTerm = Math.pow(10, (fwmCrosstalkDbc + 24.0) / 10.0);
  const osnrPenaltyDb = Math.min(8.0, 10.0 * Math.log10(1.0 + nliTerm + fwmTerm));

  // Determine overall span Kerr status
  let status = KERR_CONSTANTS.STATUS.OPTIMAL;
  let statusReason = 'Kerr nonlinear phase shifts and FWM crosstalk remain well within safe optical margins.';

  if (phiSpmRad >= KERR_CONSTANTS.SPM_PHASE_THRESHOLD_RAD || fwmCrosstalkDbc >= KERR_CONSTANTS.FWM_CROSSTALK_CRITICAL_DBC || osnrPenaltyDb >= KERR_CONSTANTS.OSNR_PENALTY_CRITICAL_DB) {
    status = KERR_CONSTANTS.STATUS.CRITICAL;
    if (fwmCrosstalkDbc >= KERR_CONSTANTS.FWM_CROSSTALK_CRITICAL_DBC) {
      statusReason = `Critical Four-Wave Mixing crosstalk (${fwmCrosstalkDbc.toFixed(1)} dBc) exceeding threshold. Low dispersion or tight spacing causing channel intermodulation!`;
    } else if (phiSpmRad >= KERR_CONSTANTS.SPM_PHASE_THRESHOLD_RAD) {
      statusReason = `Critical SPM phase shift (${phiSpmRad.toFixed(2)} rad) exceeding 1.0 rad. Excessive launch power induces severe pulse chirping and spectral broadening.`;
    } else {
      statusReason = `Critical nonlinear OSNR penalty (${osnrPenaltyDb.toFixed(2)} dB) causing optical transponder bit-error floor.`;
    }
  } else if (phiSpmRad >= KERR_CONSTANTS.SPM_OPTIMAL_PHASE_RAD || fwmCrosstalkDbc >= KERR_CONSTANTS.FWM_CROSSTALK_WARNING_DBC || osnrPenaltyDb >= KERR_CONSTANTS.OSNR_PENALTY_WARNING_DB) {
    status = KERR_CONSTANTS.STATUS.WARNING;
    if (fwmCrosstalkDbc >= KERR_CONSTANTS.FWM_CROSSTALK_WARNING_DBC) {
      statusReason = `FWM intermodulation crosstalk (${fwmCrosstalkDbc.toFixed(1)} dBc) approaching design limit. Consider 100 GHz grid or launch power reduction.`;
    } else {
      statusReason = `Elevated nonlinear phase shift (${totalNonlinearPhaseRad.toFixed(2)} rad). Power levels nearing Kerr threshold.`;
    }
  }

  return {
    fiberKey,
    fiber,
    lengthKm,
    launchPowerDbm,
    channels,
    gridGhz,
    gammaKm,
    alphaNp,
    leffKm,
    powerW,
    totalPowerW,
    totalPowerDbm,
    phiSpmRad,
    spmThresholdW,
    spmThresholdDbm,
    spmThresholdMarginDb,
    phiXpmRad,
    totalFwmProducts,
    effectiveInBandInterferers,
    etaFwm,
    pFwmW,
    fwmCrosstalkDbc,
    totalNonlinearPhaseRad,
    osnrPenaltyDb,
    status,
    statusReason
  };
}

/**
 * Correlates Kerr dynamics with live Shahdara subscriber state and recurring revenue.
 */
export function calculateKerrMetrics(state = {}, options = {}) {
  const linkId = options.linkId || simSelectedLinkId;
  const link = SHAHDARA_KERR_LINKS.find(l => l.id === linkId) || SHAHDARA_KERR_LINKS[0];

  const fiberKey = options.fiberKey || simSelectedFiberKey;
  const launchPowerDbm = options.launchPowerDbm !== undefined ? Number(options.launchPowerDbm) : simLaunchPowerDbm;
  const channels = options.channels !== undefined ? parseInt(options.channels, 10) : simChannelCount;
  const gridGhz = options.gridGhz !== undefined ? Number(options.gridGhz) : simGridSpacingGhz;

  const dynamics = calculateKerrDynamics({
    lengthKm: link.lengthKm,
    fiberKey,
    launchPowerDbm,
    channels,
    gridGhz
  });

  const customers = Array.isArray(state.customers) ? state.customers : [];
  const primaryArea = link.primaryArea;
  const secondaryAreas = link.secondaryAreas || [];
  const allAffectedAreas = [primaryArea, ...secondaryAreas];

  let totalLinkedSubscribers = 0;
  let activeLinkedSubscribers = 0;
  let monthlyRecurringRevenuePkr = 0;

  for (const c of customers) {
    if (c.archived) continue;
    const area = (c.area || '').trim();
    const isAffected = allAffectedAreas.some(a => a.toLowerCase() === area.toLowerCase());
    if (isAffected) {
      totalLinkedSubscribers++;
      const isActive = (c.serviceStatus || '').toLowerCase() === 'active';
      if (isActive) {
        activeLinkedSubscribers++;
        const bills = Array.isArray(c.bills) ? c.bills : [];
        const latestBill = bills.length > 0 ? bills[bills.length - 1] : null;
        const billAmount = latestBill && latestBill.dueAmount ? Number(latestBill.dueAmount) : 0;
        monthlyRecurringRevenuePkr += (!Number.isNaN(billAmount) && billAmount > 0) ? billAmount : 1800; // default ARPU
      }
    }
  }

  // Calculate revenue at risk based on status
  let riskFactor = 0;
  if (dynamics.status === KERR_CONSTANTS.STATUS.CRITICAL) {
    riskFactor = 1.0;
  } else if (dynamics.status === KERR_CONSTANTS.STATUS.WARNING) {
    riskFactor = 0.35;
  }
  const revenueAtRiskPkr = Math.round(monthlyRecurringRevenuePkr * riskFactor);

  return {
    link,
    dynamics,
    totalLinkedSubscribers,
    activeLinkedSubscribers,
    monthlyRecurringRevenuePkr,
    revenueAtRiskPkr,
    allAffectedAreas
  };
}

/**
 * Pure offline SVG visualization of Optical Spectrum, SPM Spectral Chirp,
 * XPM modulation envelope, FWM intermodulation products, and Kerr phase threshold.
 */
export function renderKerrDiagramSvg(metrics, options = {}) {
  const isCompact = !!options.compact;
  const dynamics = metrics.dynamics;
  const link = metrics.link;
  const width = isCompact ? 720 : 860;
  const height = isCompact ? 300 : 380;

  const statusColor = dynamics.status === KERR_CONSTANTS.STATUS.OPTIMAL ? '#10b981'
    : dynamics.status === KERR_CONSTANTS.STATUS.WARNING ? '#f59e0b' : '#ef4444';

  const centerWavelength = 1550.0;
  const gridGhz = dynamics.gridGhz;
  // delta lambda in nm = lambda^2 / c * delta_f
  const deltaLambdaNm = (Math.pow(1550e-9, 2) / 3e8) * (gridGhz * 1e9) * 1e9; // ~0.4, 0.8, or 1.6 nm

  const numChannels = Math.min(16, dynamics.channels);
  const startLambda = centerWavelength - ((numChannels - 1) / 2) * deltaLambdaNm - 2.5;
  const endLambda = centerWavelength + ((numChannels - 1) / 2) * deltaLambdaNm + 2.5;

  const graphX = 60;
  const graphY = isCompact ? 40 : 50;
  const graphW = width - graphX - 40;
  const graphH = isCompact ? 180 : 230;

  const getX = wl => graphX + ((wl - startLambda) / (endLambda - startLambda)) * graphW;
  const getY = pDbm => {
    const minDbm = -50.0;
    const maxDbm = 15.0;
    const clamped = Math.max(minDbm, Math.min(maxDbm, pDbm));
    return graphY + graphH - ((clamped - minDbm) / (maxDbm - minDbm)) * graphH;
  };

  // Build grid lines
  let gridLinesSvg = '';
  for (let dbm = -40; dbm <= 10; dbm += 10) {
    const y = getY(dbm);
    gridLinesSvg += `<line x1="${graphX}" y1="${y}" x2="${graphX + graphW}" y2="${y}" stroke="var(--line, #e2ece7)" stroke-dasharray="3,3" stroke-width="1"/>
      <text x="${graphX - 8}" y="${y + 4}" fill="var(--muted, #60756c)" font-size="10" text-anchor="end" font-family="monospace">${dbm} dBm</text>`;
  }

  // Draw optical noise floor
  const noiseFloorY = getY(-45);
  let noiseWavePath = `M ${graphX} ${noiseFloorY}`;
  for (let i = 0; i <= 20; i++) {
    const x = graphX + (i / 20) * graphW;
    const jitter = (i % 2 === 0 ? -2 : 2) * Math.sin(i * 1.5);
    noiseWavePath += ` L ${x} ${noiseFloorY + jitter}`;
  }

  // Draw WDM Channel Peaks with SPM broadening skirt
  let channelPeaksSvg = '';
  const spmBroadeningFactor = Math.min(1.5, Math.max(0.2, dynamics.phiSpmRad));

  for (let c = 0; c < numChannels; c++) {
    const chWl = centerWavelength - (((numChannels - 1) / 2) - c) * deltaLambdaNm;
    const chX = getX(chWl);
    const peakY = getY(dynamics.launchPowerDbm);
    const skirtLeftX = getX(chWl - 0.25 * spmBroadeningFactor);
    const skirtRightX = getX(chWl + 0.25 * spmBroadeningFactor);

    // SPM spectral broadening shape
    channelPeaksSvg += `
      <path d="M ${skirtLeftX} ${noiseFloorY} Q ${chX} ${peakY} ${skirtRightX} ${noiseFloorY} Z" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" stroke-width="1.8"/>
      <circle cx="${chX}" cy="${peakY}" r="3.5" fill="#38bdf8"/>
      <text x="${chX}" y="${peakY - 7}" fill="var(--ink, #182e2a)" font-size="9" text-anchor="middle" font-weight="700" font-family="monospace">CH${c + 1}</text>
    `;

    // Inter-channel FWM mix products (for adjacent pairs)
    if (c < numChannels - 1 && dynamics.fwmCrosstalkDbc > -45) {
      const nextChWl = chWl + deltaLambdaNm;
      const fwmIntermodWl = chWl - deltaLambdaNm; // 2 * f1 - f2
      if (fwmIntermodWl >= startLambda && fwmIntermodWl <= endLambda) {
        const fwmX = getX(fwmIntermodWl);
        const fwmPowerDbm = dynamics.launchPowerDbm + dynamics.fwmCrosstalkDbc;
        const fwmY = getY(fwmPowerDbm);
        channelPeaksSvg += `
          <line x1="${fwmX}" y1="${noiseFloorY}" x2="${fwmX}" y2="${fwmY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="2,2"/>
          <circle cx="${fwmX}" cy="${fwmY}" r="2.5" fill="#ef4444"/>
          <text x="${fwmX}" y="${fwmY - 4}" fill="#ef4444" font-size="8" text-anchor="middle" font-family="monospace">FWM</text>
        `;
      }
    }
  }

  // SPM Critical Power Threshold line
  const threshY = getY(dynamics.spmThresholdDbm);
  const spmThreshSvg = `
    <line x1="${graphX}" y1="${threshY}" x2="${graphX + graphW}" y2="${threshY}" stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="4,3"/>
    <text x="${graphX + graphW - 5}" y="${threshY - 5}" fill="#f59e0b" font-size="10" text-anchor="end" font-weight="700">SPM Threshold: ${dynamics.spmThresholdDbm.toFixed(1)} dBm</text>
  `;

  // Status Badge and Title Header
  const titleY = isCompact ? 22 : 28;
  const footerY = height - 12;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="kerr-diagram-svg" style="width: 100%; height: auto; background: var(--bg-card, #ffffff); border-radius: 8px; font-family: Manrope, system-ui, sans-serif;">
      <!-- Title Header -->
      <text x="${graphX}" y="${titleY}" fill="var(--ink, #182e2a)" font-size="13" font-weight="700">
        Optical Kerr Nonlinear Spectrum &amp; Intermodulation Matrix: ${link.name}
      </text>
      <rect x="${width - 130}" y="${titleY - 14}" width="95" height="20" rx="4" fill="${statusColor}22" stroke="${statusColor}" stroke-width="1"/>
      <text x="${width - 82}" y="${titleY}" fill="${statusColor}" font-size="11" font-weight="700" text-anchor="middle">
        ${dynamics.status.toUpperCase()}
      </text>

      <!-- Background Plot Area -->
      <rect x="${graphX}" y="${graphY}" width="${graphW}" height="${graphH}" fill="var(--bg-soft, #f8fafc)" stroke="var(--line, #e2ece7)" rx="4"/>

      <!-- Grid and Axis -->
      ${gridLinesSvg}

      <!-- Optical Noise Floor -->
      <path d="${noiseWavePath}" fill="none" stroke="var(--line, #cbd5e1)" stroke-width="1.2"/>

      <!-- SPM Threshold Line -->
      ${spmThreshSvg}

      <!-- Channel Peaks and FWM Products -->
      ${channelPeaksSvg}

      <!-- X-Axis Legend -->
      <text x="${graphX + graphW / 2}" y="${graphY + graphH + 28}" fill="var(--muted, #60756c)" font-size="11" text-anchor="middle">
        Optical Wavelength &lambda; (nm) [DWDM C-Band &bull; ${dynamics.gridGhz} GHz Grid &bull; ${dynamics.fiber.name}]
      </text>

      <!-- Footer Quick Summary -->
      <text x="${graphX}" y="${footerY}" fill="var(--muted, #60756c)" font-size="10.5">
        &Phi;<tspan font-size="8">SPM</tspan>: <tspan font-weight="700" fill="var(--ink, #182e2a)">${dynamics.phiSpmRad.toFixed(2)} rad</tspan> &bull;
        &Phi;<tspan font-size="8">XPM</tspan>: <tspan font-weight="700" fill="var(--ink, #182e2a)">${dynamics.phiXpmRad.toFixed(2)} rad</tspan> &bull;
        FWM Crosstalk: <tspan font-weight="700" fill="${dynamics.fwmCrosstalkDbc >= -28 ? '#ef4444' : 'var(--ink, #182e2a)'}">${dynamics.fwmCrosstalkDbc.toFixed(1)} dBc</tspan> &bull;
        OSNR Penalty: <tspan font-weight="700" fill="${statusColor}">${dynamics.osnrPenaltyDb.toFixed(2)} dB</tspan> &bull;
        Launch Margin: <tspan font-weight="700">${dynamics.spmThresholdMarginDb.toFixed(1)} dB</tspan>
      </text>
    </svg>
  `;
}

/**
 * Generates comprehensive engineering briefing text for clipboard copying.
 */
export function generateKerrReport(metrics) {
  const d = metrics.dynamics;
  const l = metrics.link;

  return `========================================================================
SHAHDARA METRO OPTICAL TRANSPORT - KERR NONLINEARITY BRIEFING
ITU-T G.652 / G.655 / G.694.1 Kerr Effect Threshold Matrix (SPM / XPM / FWM)
========================================================================
Link Identifier          : ${l.id}
Link Name                : ${l.name}
Span Distance            : ${l.lengthKm.toFixed(1)} km
Operational Role         : ${l.operationalRole}
Terminal Equipment       : ${l.equipmentType}
Primary Impact Area      : ${l.primaryArea} (Secondary: ${metrics.allAffectedAreas.slice(1).join(', ') || 'None'})

OPTICAL FIBER PHYSICAL PARAMETERS
------------------------------------------------------------------------
Fiber Profile            : ${d.fiber.name}
Effective Area (Aeff)    : ${d.fiber.effectiveAreaUm2.toFixed(1)} um^2
Attenuation Coeff (alpha): ${d.fiber.attenuationDbPerKm.toFixed(2)} dB/km (${d.alphaNp.toFixed(4)} Np/km)
Effective Length (Leff)  : ${d.leffKm.toFixed(2)} km (Span Physical: ${d.lengthKm.toFixed(1)} km)
Chromatic Dispersion (D) : ${d.fiber.chromaticDispersionPsNmKm.toFixed(1)} ps/(nm*km)
Nonlinear Coeff (gamma)  : ${d.gammaKm.toFixed(3)} W^-1*km^-1

TRANSMISSION & MULTIPLEXING CONFIGURATION
------------------------------------------------------------------------
WDM Active Channels      : ${d.channels} Channels
Channel Grid Spacing     : ${d.gridGhz} GHz (${KERR_CONSTANTS.GRID_SPACINGS[d.gridGhz]})
Channel Launch Power     : ${d.launchPowerDbm.toFixed(1)} dBm (${(d.powerW * 1000).toFixed(2)} mW/channel)
Total Aggregate Power    : ${d.totalPowerDbm.toFixed(1)} dBm (${(d.totalPowerW * 1000).toFixed(1)} mW)

KERR NONLINEAR EFFECTS ESTIMATION & THRESHOLDS
------------------------------------------------------------------------
Self-Phase Modulation (SPM):
  - SPM Nonlinear Phase Shift (Phi_SPM): ${d.phiSpmRad.toFixed(3)} rad (Max Recommended: 1.00 rad)
  - SPM Launch Power Threshold         : ${d.spmThresholdDbm.toFixed(1)} dBm
  - Power Threshold Safety Margin      : ${d.spmThresholdMarginDb.toFixed(1)} dB

Cross-Phase Modulation (XPM):
  - XPM Phase Jitter (Phi_XPM)         : ${d.phiXpmRad.toFixed(3)} rad
  - Walk-Off Dispersion Suppression    : Active (D = ${d.fiber.chromaticDispersionPsNmKm.toFixed(1)} ps/nm*km)

Four-Wave Mixing (FWM):
  - FWM Phase Matching Efficiency (eta): ${(d.etaFwm * 100).toFixed(4)}%
  - Total Potential FWM Intermods      : ${d.totalFwmProducts} Mixing Products
  - Worst-Case In-Band Crosstalk Ratio : ${d.fwmCrosstalkDbc.toFixed(1)} dBc (Warning: -30.0 dBc, Crit: -24.0 dBc)

OVERALL TRANSMISSION METRICS & SUBSCRIBER IMPACT
------------------------------------------------------------------------
Total Nonlinear Phase Shift (SPM+XPM) : ${d.totalNonlinearPhaseRad.toFixed(3)} rad
Nonlinear OSNR Penalty                : ${d.osnrPenaltyDb.toFixed(2)} dB
Operational Status                    : ${d.status.toUpperCase()}
Diagnostic Assessment                 : ${d.statusReason}

AFFECTED SUBSCRIBER POPULATION
------------------------------------------------------------------------
Active Linked Subscribers             : ${metrics.activeLinkedSubscribers} Accounts
Total Connected Span Accounts         : ${metrics.totalLinkedSubscribers} Accounts
Monthly Recurring Revenue (MRR)       : ${formatPKR(metrics.monthlyRecurringRevenuePkr)}
Subscriber Revenue at Risk            : ${formatPKR(metrics.revenueAtRiskPkr)}

RECOMMENDED ENGINEERING REMEDIATION:
${d.status === KERR_CONSTANTS.STATUS.OPTIMAL ? '- Span is operating within design limits. Maintain current optical launch attenuation.' : d.status === KERR_CONSTANTS.STATUS.WARNING ? '- Reduce per-channel launch power by 1.5 dB or expand channel spacing from 50 GHz to 100 GHz to suppress FWM products.' : '- Immediate action required: Lower EDFA booster gain by 3.0 dB to prevent nonlinear pulse distortion and bit-error-rate collapse.'}
========================================================================`;
}

/**
 * Initializes and wires interactive Kerr simulation modal dialog and quick action.
 */
export function setupKerrModal(state = {}, options = {}) {
  const modal = document.getElementById('dashboardKerrModal');
  const openBtn = document.getElementById('dashboardOpenKerrModalBtn');
  const closeBtn = document.getElementById('dashboardKerrModalCloseBtn');

  const linkSelect = document.getElementById('kerrLinkSelect');
  const fiberSelect = document.getElementById('kerrFiberSelect');
  const powerSlider = document.getElementById('kerrPowerSlider');
  const powerLabel = document.getElementById('kerrPowerValueLabel');
  const channelSlider = document.getElementById('kerrChannelSlider');
  const channelLabel = document.getElementById('kerrChannelValueLabel');
  const gridSelect = document.getElementById('kerrGridSelect');
  const resetBtn = document.getElementById('kerrResetSimBtn');

  const statSpm = document.getElementById('kerrStatSpm');
  const statXpm = document.getElementById('kerrStatXpm');
  const statFwm = document.getElementById('kerrStatFwm');
  const statPenalty = document.getElementById('kerrStatPenalty');
  const statMargin = document.getElementById('kerrStatMargin');
  const statRevenue = document.getElementById('kerrStatRevenue');

  const diagramContainer = document.getElementById('kerrModalDiagramContainer');
  const filterAreaBtn = document.getElementById('kerrFilterAreaBtn');
  const copyReportBtn = document.getElementById('kerrCopyReportBtn');

  function renderView() {
    const metrics = calculateKerrMetrics(state);
    const d = metrics.dynamics;

    if (linkSelect) linkSelect.value = simSelectedLinkId;
    if (fiberSelect) fiberSelect.value = simSelectedFiberKey;
    if (powerSlider) powerSlider.value = simLaunchPowerDbm;
    if (powerLabel) powerLabel.textContent = `${simLaunchPowerDbm >= 0 ? '+' : ''}${simLaunchPowerDbm.toFixed(1)} dBm`;
    if (channelSlider) channelSlider.value = simChannelCount;
    if (channelLabel) channelLabel.textContent = `${simChannelCount} Channels`;
    if (gridSelect) gridSelect.value = simGridSpacingGhz;

    if (statSpm) {
      statSpm.textContent = `${d.phiSpmRad.toFixed(2)} rad`;
      statSpm.style.color = d.phiSpmRad >= KERR_CONSTANTS.SPM_PHASE_THRESHOLD_RAD ? '#ef4444' : d.phiSpmRad >= KERR_CONSTANTS.SPM_OPTIMAL_PHASE_RAD ? '#f59e0b' : '#10b981';
    }
    if (statXpm) {
      statXpm.textContent = `${d.phiXpmRad.toFixed(2)} rad`;
    }
    if (statFwm) {
      statFwm.textContent = `${d.fwmCrosstalkDbc.toFixed(1)} dBc`;
      statFwm.style.color = d.fwmCrosstalkDbc >= KERR_CONSTANTS.FWM_CROSSTALK_CRITICAL_DBC ? '#ef4444' : d.fwmCrosstalkDbc >= KERR_CONSTANTS.FWM_CROSSTALK_WARNING_DBC ? '#f59e0b' : '#38bdf8';
    }
    if (statPenalty) {
      statPenalty.textContent = `${d.osnrPenaltyDb.toFixed(2)} dB`;
      statPenalty.style.color = d.osnrPenaltyDb >= KERR_CONSTANTS.OSNR_PENALTY_CRITICAL_DB ? '#ef4444' : d.osnrPenaltyDb >= KERR_CONSTANTS.OSNR_PENALTY_WARNING_DB ? '#f59e0b' : '#10b981';
    }
    if (statMargin) {
      statMargin.textContent = `${d.spmThresholdMarginDb >= 0 ? '+' : ''}${d.spmThresholdMarginDb.toFixed(1)} dB`;
      statMargin.style.color = d.spmThresholdMarginDb < 0 ? '#ef4444' : '#10b981';
    }
    if (statRevenue) {
      statRevenue.textContent = formatPKR(metrics.revenueAtRiskPkr);
      statRevenue.style.color = metrics.revenueAtRiskPkr > 0 ? '#ef4444' : '#10b981';
    }

    if (diagramContainer) {
      diagramContainer.innerHTML = renderKerrDiagramSvg(metrics, { compact: false });
    }

    // Update compact chart if present on dashboard
    const dashboardChart = document.getElementById('dashboardKerrChart');
    if (dashboardChart) {
      dashboardChart.innerHTML = renderKerrDiagramSvg(metrics, { compact: true });
    }
  }

  // Wire event handlers
  if (linkSelect) {
    linkSelect.onchange = () => {
      setKerrSelectedLink(linkSelect.value);
      renderView();
    };
  }

  if (fiberSelect) {
    fiberSelect.onchange = () => {
      setKerrSelectedFiberType(fiberSelect.value);
      renderView();
    };
  }

  if (powerSlider) {
    powerSlider.oninput = () => {
      setKerrLaunchPowerDbm(powerSlider.value);
      renderView();
    };
  }

  if (channelSlider) {
    channelSlider.oninput = () => {
      setKerrChannelCount(channelSlider.value);
      renderView();
    };
  }

  if (gridSelect) {
    gridSelect.onchange = () => {
      setKerrGridSpacingGhz(gridSelect.value);
      renderView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetKerrSimState();
      renderView();
    };
  }

  if (openBtn && modal) {
    openBtn.onclick = () => {
      renderView();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', 'true');
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
      const metrics = calculateKerrMetrics(state);
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(metrics.link.primaryArea);
        if (modal && typeof modal.close === 'function') modal.close();
        else if (modal) modal.removeAttribute('open');
        if (typeof options.onToast === 'function') {
          options.onToast(`Filtering subscribers in ${metrics.link.primaryArea}`);
        }
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateKerrMetrics(state);
      const text = generateKerrReport(metrics);
      try {
        const cb = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
        if (cb?.writeText) {
          await cb.writeText(text);
          if (typeof options.onToast === 'function') {
            options.onToast('Optical Kerr briefing copied to clipboard!');
          }
        } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy Optical Kerr briefing:', text);
        }
      } catch (err) {
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
          window.prompt('Copy Optical Kerr briefing:', text);
        }
      }
    };
  }

  // Initial draw
  renderView();
}
