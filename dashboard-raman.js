import { formatPKR } from './core.js';

/**
 * Optical Fiber Raman Amplifier (FRA / DRA - ITU-T G.665)
 * Distributed Optical Gain & Stimulated Raman Scattering (SRS) Estimator
 *
 * Models high-power optical pump lasers (1420nm - 1490nm) injecting optical power
 * directly into single-mode transmission fiber (SMF-28e+ / G.652D / LEAF G.655) to generate
 * distributed amplification via Stimulated Raman Scattering (SRS) across Shahdara ISP
 * long-haul and metro core optical fiber trunks.
 *
 * Evaluates on-off Raman gain, effective interaction length (Leff), counter-propagating
 * vs co-propagating vs bidirectional pump configurations, pump depletion, optical signal-to-noise
 * ratio (OSNR) improvement (+3 to +6 dB), and Double Rayleigh Scattering (DRS) multipath penalty,
 * correlating optical link health with Shahdara subscriber revenue exposure.
 */

export const RAMAN_CONSTANTS = {
  STOKES_FREQUENCY_SHIFT_THZ: 13.2,
  PEAK_RAMAN_GAIN_COEFF_M_PER_W: 1.05e-13, // SMF-28 silica fiber (m/W)
  LEAF_RAMAN_GAIN_COEFF_M_PER_W: 1.35e-13, // LEAF NZ-DSF smaller Aeff (m/W)
  SMF28_EFFECTIVE_AREA_UM2: 80.0,
  LEAF_EFFECTIVE_AREA_UM2: 72.0,
  POLARIZATION_FACTOR: 2.0, // Depolarized Raman pump
  MODE_OVERLAP_FACTOR: 0.55, // Optical mode field overlap & pump-signal polarization scrambling
  DEFAULT_SPAN_ID: 'raman-span-01',
  DEFAULT_PUMP_SCHEME: 'COUNTER',
  DEFAULT_PUMP_WAVELENGTH_NM: 1455,
  DEFAULT_PUMP_POWER_MW: 500,
  MIN_PUMP_POWER_MW: 100,
  MAX_PUMP_POWER_MW: 1000,

  PUMP_SCHEMES: {
    COUNTER: 'Counter-Propagating (Backward Pump - Low RIN Transfer)',
    CO: 'Co-Propagating (Forward Pump - Peak Signal OSNR)',
    BIDIRECTIONAL: 'Bidirectional (Dual Pump - Uniform Gain Profile)'
  },

  PUMP_WAVELENGTHS: {
    1445: '1445 nm (C-Band Blue Edge 1530-1545nm Gain)',
    1450: '1450 nm (C-Band Standard 1540-1555nm Gain)',
    1455: '1455 nm (C-Band Center 1550-1560nm Peak Gain)',
    1460: '1460 nm (C-Band Red Edge 1555-1565nm Gain)',
    1480: '1480 nm (Extended C/L-Band Boundary Gain)'
  },

  STATUS: {
    OPTIMAL: 'Optimal',
    WARNING: 'Warning',
    CRITICAL: 'Critical'
  }
};

export const SHAHDARA_RAMAN_SPANS = [
  {
    id: 'raman-span-01',
    name: 'Central Ring Trunk 01: Shahdara Core to Kot Abdul Malik',
    lengthKm: 42,
    primaryArea: 'Shahdara Town',
    aliasAreas: ['Shahdara Town', 'Kot Abdul Malik', 'Old Town'],
    fiberType: 'Corning SMF-28e+ (G.652D)',
    signalLossDbPerKm: 0.20,
    pumpLossDbPerKm: 0.26,
    effectiveAreaUm2: 80.0,
    ramanGainCoeff: 1.05e-13,
    defaultPumpPowerMw: 500,
    defaultPumpWavelengthNm: 1455,
    defaultPumpScheme: 'COUNTER'
  },
  {
    id: 'raman-span-02',
    name: 'Metro Express Trunk 02: Baradari Road to Ravi Siphon',
    lengthKm: 36,
    primaryArea: 'Baradari Road',
    aliasAreas: ['Baradari Road', 'Bara Dari', 'Tariq Road'],
    fiberType: 'OFS AllWave ZWP (G.652D)',
    signalLossDbPerKm: 0.21,
    pumpLossDbPerKm: 0.27,
    effectiveAreaUm2: 80.0,
    ramanGainCoeff: 1.05e-13,
    defaultPumpPowerMw: 450,
    defaultPumpWavelengthNm: 1450,
    defaultPumpScheme: 'COUNTER'
  },
  {
    id: 'raman-span-03',
    name: 'Rural Backhaul Trunk 03: Vandala Road to Narang Mandi Border',
    lengthKm: 58,
    primaryArea: 'Vandala Road',
    aliasAreas: ['Vandala Road', 'Wandala Road', 'Zia Town'],
    fiberType: 'Prysmian Draka (G.652D)',
    signalLossDbPerKm: 0.22,
    pumpLossDbPerKm: 0.28,
    effectiveAreaUm2: 82.0,
    ramanGainCoeff: 1.02e-13,
    defaultPumpPowerMw: 650,
    defaultPumpWavelengthNm: 1460,
    defaultPumpScheme: 'BIDIRECTIONAL'
  },
  {
    id: 'raman-span-04',
    name: 'Distribution Ring Trunk 04: Jia Musa to Farrukhabad Loop',
    lengthKm: 28,
    primaryArea: 'Jia Musa',
    aliasAreas: ['Jia Musa', 'Farrukhabad'],
    fiberType: 'Sterlite OH-LITE (G.652D)',
    signalLossDbPerKm: 0.20,
    pumpLossDbPerKm: 0.25,
    effectiveAreaUm2: 80.0,
    ramanGainCoeff: 1.05e-13,
    defaultPumpPowerMw: 350,
    defaultPumpWavelengthNm: 1445,
    defaultPumpScheme: 'COUNTER'
  },
  {
    id: 'raman-span-05',
    name: 'Perimeter Trunk 05: Begum Kot to Kala Shah Kaku Interchange',
    lengthKm: 32,
    primaryArea: 'Begum Kot',
    aliasAreas: ['Begum Kot', 'Kot Abdul Malik'],
    fiberType: 'Corning LEAF (G.655 NZ-DSF)',
    signalLossDbPerKm: 0.22,
    pumpLossDbPerKm: 0.28,
    effectiveAreaUm2: 72.0,
    ramanGainCoeff: 1.35e-13,
    defaultPumpPowerMw: 400,
    defaultPumpWavelengthNm: 1455,
    defaultPumpScheme: 'COUNTER'
  }
];

// Interactive state variables
let currentSelectedSpanId = RAMAN_CONSTANTS.DEFAULT_SPAN_ID;
let currentPumpScheme = RAMAN_CONSTANTS.DEFAULT_PUMP_SCHEME;
let currentPumpWavelengthNm = RAMAN_CONSTANTS.DEFAULT_PUMP_WAVELENGTH_NM;
let currentPumpPowerMw = RAMAN_CONSTANTS.DEFAULT_PUMP_POWER_MW;

export function getRamanSelectedSpan() {
  return currentSelectedSpanId;
}

export function setRamanSelectedSpan(id) {
  if (SHAHDARA_RAMAN_SPANS.some(s => s.id === id)) {
    currentSelectedSpanId = id;
    const span = SHAHDARA_RAMAN_SPANS.find(s => s.id === id);
    if (span) {
      currentPumpPowerMw = span.defaultPumpPowerMw;
      currentPumpWavelengthNm = span.defaultPumpWavelengthNm;
      currentPumpScheme = span.defaultPumpScheme;
    }
  }
}

export function getRamanPumpScheme() {
  return currentPumpScheme;
}

export function setRamanPumpScheme(scheme) {
  if (RAMAN_CONSTANTS.PUMP_SCHEMES[scheme]) {
    currentPumpScheme = scheme;
  }
}

export function getRamanPumpWavelengthNm() {
  return currentPumpWavelengthNm;
}

export function setRamanPumpWavelengthNm(wl) {
  const num = Number(wl);
  if (RAMAN_CONSTANTS.PUMP_WAVELENGTHS[num]) {
    currentPumpWavelengthNm = num;
  }
}

export function getRamanPumpPowerMw() {
  return currentPumpPowerMw;
}

export function setRamanPumpPowerMw(power) {
  const num = Number(power);
  if (!Number.isNaN(num)) {
    currentPumpPowerMw = Math.max(
      RAMAN_CONSTANTS.MIN_PUMP_POWER_MW,
      Math.min(RAMAN_CONSTANTS.MAX_PUMP_POWER_MW, num)
    );
  }
}

export function resetRamanSimState() {
  currentSelectedSpanId = RAMAN_CONSTANTS.DEFAULT_SPAN_ID;
  currentPumpScheme = RAMAN_CONSTANTS.DEFAULT_PUMP_SCHEME;
  currentPumpWavelengthNm = RAMAN_CONSTANTS.DEFAULT_PUMP_WAVELENGTH_NM;
  currentPumpPowerMw = RAMAN_CONSTANTS.DEFAULT_PUMP_POWER_MW;
}

/**
 * Calculates optical Raman amplifier physics, distributed gain, and OSNR improvement.
 */
export function calculateRamanDynamics(span, pumpPowerMw, pumpScheme, pumpWavelengthNm) {
  const sp = span || SHAHDARA_RAMAN_SPANS[0];
  const powerMw = Math.max(0, pumpPowerMw);
  const powerWatts = powerMw / 1000.0;

  // Convert attenuation coefficient from dB/km to 1/m: alpha = (alpha_dB / 4.343) / 1000
  const alphaPump_per_m = (sp.pumpLossDbPerKm / 4.3429448) / 1000.0;
  const lengthMeters = sp.lengthKm * 1000.0;

  // Effective interaction length: Leff = (1 - exp(-alpha_p * L)) / alpha_p
  const expTerm = Math.exp(-alphaPump_per_m * lengthMeters);
  const effectiveLengthMeters = (1.0 - expTerm) / alphaPump_per_m;
  const effectiveLengthKm = effectiveLengthMeters / 1000.0;

  // Core Area in m^2: Aeff (um^2) * 1e-12
  const aeffM2 = sp.effectiveAreaUm2 * 1e-12;
  const gR = sp.ramanGainCoeff;
  const kPol = RAMAN_CONSTANTS.POLARIZATION_FACTOR;

  // Wavelength efficiency multiplier based on peak Stokes shift alignment
  let wavelengthGainFactor = 1.0;
  if (pumpWavelengthNm === 1455) wavelengthGainFactor = 1.0;
  else if (pumpWavelengthNm === 1450 || pumpWavelengthNm === 1460) wavelengthGainFactor = 0.94;
  else if (pumpWavelengthNm === 1445) wavelengthGainFactor = 0.88;
  else if (pumpWavelengthNm === 1480) wavelengthGainFactor = 0.82;

  // Pump scheme multiplier
  let schemeMultiplier = 1.0;
  let noiseTransferRisk = 'Minimal (Counter-Propagating)';
  if (pumpScheme === 'BIDIRECTIONAL') {
    schemeMultiplier = 1.15; // Dual forward/backward pumping maintains uniform profile
    noiseTransferRisk = 'Moderate (Co+Counter Pumping)';
  } else if (pumpScheme === 'CO') {
    schemeMultiplier = 0.95;
    noiseTransferRisk = 'Elevated (RIN Transfer to Signal)';
  }

  // On-Off Raman Gain in dB: G_dB = 4.3429448 * (gR * P0 * Leff * factor * modeOverlap) / (Aeff * kPol)
  const exponent = (gR * powerWatts * effectiveLengthMeters * wavelengthGainFactor * schemeMultiplier * RAMAN_CONSTANTS.MODE_OVERLAP_FACTOR) / (aeffM2 * kPol);
  const onOffGainDb = Math.round(4.3429448 * exponent * 100) / 100;

  // Passive span transmission loss (dB)
  const passiveSpanLossDb = Math.round(sp.signalLossDbPerKm * sp.lengthKm * 100) / 100;

  // Net Gain / Residual Loss: NetGain = OnOffGain - PassiveSpanLoss
  const netSpanGainDb = Math.round((onOffGainDb - passiveSpanLossDb) * 100) / 100;

  // OSNR improvement factor compared to lumped discrete EDFA alone: typical +3 to +6 dB
  const osnrImprovementDb = Math.min(7.5, Math.max(0.5, Math.round((onOffGainDb * 0.42 + 0.8) * 10) / 10));

  // Double Rayleigh Scattering (DRS) multipath interference penalty
  // Occurs when pump power is very high (> 700 mW) and on-off gain exceeds ~15 dB
  let drsNoiseFloorDbm = -52.0 + (onOffGainDb * 1.3);
  let drsPenaltyDb = 0.0;
  if (onOffGainDb > 14.0) {
    drsPenaltyDb = Math.round(((onOffGainDb - 14.0) * 0.35) * 100) / 100;
  }

  // Pump depletion percentage (depleted by amplified spontaneous Raman emission)
  const pumpDepletionPercent = Math.min(35, Math.round((powerMw / 1000) * 18 + (sp.lengthKm / 50) * 8));

  // Status determination
  let status = RAMAN_CONSTANTS.STATUS.OPTIMAL;
  if (drsPenaltyDb > 1.2 || powerMw >= 900) {
    status = RAMAN_CONSTANTS.STATUS.CRITICAL;
  } else if (drsPenaltyDb > 0.4 || powerMw >= 750 || netSpanGainDb < -8.0) {
    status = RAMAN_CONSTANTS.STATUS.WARNING;
  }

  return {
    powerMw,
    powerWatts,
    effectiveLengthKm: Math.round(effectiveLengthKm * 10) / 10,
    onOffGainDb,
    passiveSpanLossDb,
    netSpanGainDb,
    osnrImprovementDb,
    drsNoiseFloorDbm: Math.round(drsNoiseFloorDbm * 10) / 10,
    drsPenaltyDb,
    pumpDepletionPercent,
    noiseTransferRisk,
    status
  };
}

/**
 * Calculates complete Raman amplifier metrics correlated with subscriber ledger and sector revenue.
 */
export function calculateRamanMetrics(state, options = {}) {
  const selectedSpanId = options.spanId || currentSelectedSpanId;
  const pumpPower = options.pumpPowerMw !== undefined ? options.pumpPowerMw : currentPumpPowerMw;
  const pumpScheme = options.pumpScheme || currentPumpScheme;
  const pumpWl = options.pumpWavelengthNm !== undefined ? options.pumpWavelengthNm : currentPumpWavelengthNm;

  const span = SHAHDARA_RAMAN_SPANS.find(s => s.id === selectedSpanId) || SHAHDARA_RAMAN_SPANS[0];
  const dynamics = calculateRamanDynamics(span, pumpPower, pumpScheme, pumpWl);

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

  // Revenue exposure: if DRS penalty or net loss causes optical link flapped drops
  const riskFraction = dynamics.status === RAMAN_CONSTANTS.STATUS.CRITICAL
    ? 0.75
    : dynamics.status === RAMAN_CONSTANTS.STATUS.WARNING
    ? 0.20
    : 0.0;
  const revenueAtRisk = Math.round(sectorMonthlyRevenue * riskFraction);

  return {
    span,
    pumpPowerMw: dynamics.powerMw,
    pumpScheme,
    pumpSchemeLabel: RAMAN_CONSTANTS.PUMP_SCHEMES[pumpScheme] || pumpScheme,
    pumpWavelengthNm: pumpWl,
    pumpWavelengthLabel: RAMAN_CONSTANTS.PUMP_WAVELENGTHS[pumpWl] || `${pumpWl} nm`,
    dynamics,
    subscriberCorrelation: {
      totalSubscribers,
      activeSubscribers,
      offlineSubscribers,
      sectorMonthlyRevenue,
      sectorTotalDues,
      revenueAtRisk
    },
    spansList: SHAHDARA_RAMAN_SPANS
  };
}

/**
 * Generates pure offline SVG diagram of Raman distributed amplification profile along fiber span.
 */
export function renderRamanDiagramSvg(metrics, options = {}) {
  if (!metrics || !metrics.span) {
    return `<div class="otdr-empty-chart" style="padding: 24px; text-align: center; color: var(--text-muted, #64748b);">No Optical Raman metrics available.</div>`;
  }

  const { span, dynamics, pumpPowerMw, pumpScheme, pumpWavelengthNm } = metrics;
  const isCompact = Boolean(options.compact);
  const width = isCompact ? 540 : 860;
  const height = isCompact ? 280 : 380;

  const isCritical = dynamics.status === RAMAN_CONSTANTS.STATUS.CRITICAL;
  const isWarning = dynamics.status === RAMAN_CONSTANTS.STATUS.WARNING;

  const statusColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

  // Chart coordinates
  const padLeft = isCompact ? 45 : 70;
  const padRight = isCompact ? 30 : 50;
  const padTop = isCompact ? 45 : 55;
  const padBottom = isCompact ? 60 : 75;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Signal & Raman Power Profile curve generation (0 to L km)
  const numPoints = 30;
  const points = [];
  const unamplifiedPoints = [];
  const pumpPoints = [];

  for (let i = 0; i <= numPoints; i++) {
    const frac = i / numPoints;
    const zKm = frac * span.lengthKm;
    const px = padLeft + frac * plotW;

    // Unamplified signal: starts at 0 dBm, decays linearly with loss
    const unamplifiedP = 0 - (span.signalLossDbPerKm * zKm);

    // Raman gain distribution along fiber
    let localGain = 0;
    if (pumpScheme === 'COUNTER') {
      // Counter-pump enters at z = L, decays towards z = 0
      const distFromEnd = span.lengthKm - zKm;
      const pumpFrac = Math.exp(-((span.pumpLossDbPerKm / 4.343) * distFromEnd));
      localGain = dynamics.onOffGainDb * (1.0 - Math.exp(-((span.pumpLossDbPerKm / 4.343) * zKm * 0.4))) * pumpFrac;
    } else if (pumpScheme === 'CO') {
      // Co-pump enters at z = 0
      const pumpFrac = Math.exp(-((span.pumpLossDbPerKm / 4.343) * zKm));
      localGain = dynamics.onOffGainDb * (1.0 - pumpFrac);
    } else {
      // Bidirectional
      const p1 = Math.exp(-((span.pumpLossDbPerKm / 4.343) * zKm));
      const p2 = Math.exp(-((span.pumpLossDbPerKm / 4.343) * (span.lengthKm - zKm)));
      localGain = dynamics.onOffGainDb * (0.5 * (1.0 - p1) + 0.5 * (1.0 - p2));
    }

    const amplifiedP = unamplifiedP + localGain;

    // Mapping power to Y: Range from +5 dBm down to -25 dBm
    const minP = -25;
    const maxP = 8;
    const pyAmp = padTop + (1.0 - (amplifiedP - minP) / (maxP - minP)) * plotH;
    const pyUnamp = padTop + (1.0 - (unamplifiedP - minP) / (maxP - minP)) * plotH;

    // Pump curve for visual representation
    let pumpYVal = 0;
    if (pumpScheme === 'COUNTER') {
      pumpYVal = Math.exp(-((span.pumpLossDbPerKm / 4.343) * (span.lengthKm - zKm)));
    } else if (pumpScheme === 'CO') {
      pumpYVal = Math.exp(-((span.pumpLossDbPerKm / 4.343) * zKm));
    } else {
      pumpYVal = 0.5 * Math.exp(-((span.pumpLossDbPerKm / 4.343) * zKm)) + 0.5 * Math.exp(-((span.pumpLossDbPerKm / 4.343) * (span.lengthKm - zKm)));
    }
    const pyPump = padTop + (1.0 - pumpYVal) * plotH;

    points.push(`${px.toFixed(1)},${pyAmp.toFixed(1)}`);
    unamplifiedPoints.push(`${px.toFixed(1)},${pyUnamp.toFixed(1)}`);
    pumpPoints.push(`${px.toFixed(1)},${pyPump.toFixed(1)}`);
  }

  const ampPathD = `M ${points.join(' L ')}`;
  const unampPathD = `M ${unamplifiedPoints.join(' L ')}`;
  const pumpPathD = `M ${pumpPoints.join(' L ')}`;

  // Bar sizes for bottom summary
  const barW = isCompact ? 100 : 150;
  const gainFillW = Math.max(4, Math.round((dynamics.onOffGainDb / 20.0) * barW));
  const osnrFillW = Math.max(4, Math.round((dynamics.osnrImprovementDb / 8.0) * barW));
  const depletionFillW = Math.max(4, Math.round((dynamics.pumpDepletionPercent / 40.0) * barW));

  return `
<svg class="raman-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Fiber Raman Distributed Gain Profile Diagram">
  <defs>
    <linearGradient id="ramanBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="ramanAmpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="60%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
    <linearGradient id="ramanPumpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0.8" />
    </linearGradient>
    <filter id="ramanGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="url(#ramanBgGrad)" stroke="#334155" stroke-width="1.2" />

  <!-- Title / Legend Bar -->
  <text x="18" y="24" fill="#f8fafc" font-size="${isCompact ? 11 : 13}" font-weight="700" letter-spacing="0.5">OPTICAL FIBER RAMAN AMPLIFIER (FRA) DISTRIBUTED GAIN</text>
  <text x="${width - 18}" y="24" text-anchor="end" fill="${statusColor}" font-size="${isCompact ? 10 : 12}" font-weight="700">STATUS: ${dynamics.status.toUpperCase()}</text>

  <!-- Plot Area Background -->
  <rect x="${padLeft}" y="${padTop}" width="${plotW}" height="${plotH}" fill="#0b1120" rx="6" stroke="#1e293b" stroke-width="1" />

  <!-- Horizontal Grid Lines -->
  <g stroke="#334155" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.6">
    <line x1="${padLeft}" y1="${padTop + plotH * 0.25}" x2="${padLeft + plotW}" y2="${padTop + plotH * 0.25}" />
    <line x1="${padLeft}" y1="${padTop + plotH * 0.5}" x2="${padLeft + plotW}" y2="${padTop + plotH * 0.5}" />
    <line x1="${padLeft}" y1="${padTop + plotH * 0.75}" x2="${padLeft + plotW}" y2="${padTop + plotH * 0.75}" />
  </g>

  <!-- Y-Axis Ticks -->
  <text x="${padLeft - 8}" y="${padTop + 4}" text-anchor="end" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">+5 dBm</text>
  <text x="${padLeft - 8}" y="${padTop + plotH * 0.5 + 3}" text-anchor="end" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">-10 dBm</text>
  <text x="${padLeft - 8}" y="${padTop + plotH + 2}" text-anchor="end" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">-25 dBm</text>

  <!-- X-Axis Distance Ticks -->
  <text x="${padLeft}" y="${padTop + plotH + 16}" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">0 km (TX)</text>
  <text x="${padLeft + plotW * 0.5}" y="${padTop + plotH + 16}" text-anchor="middle" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">${(span.lengthKm / 2).toFixed(0)} km (Fiber Leff: ${dynamics.effectiveLengthKm}km)</text>
  <text x="${padLeft + plotW}" y="${padTop + plotH + 16}" text-anchor="end" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">${span.lengthKm} km (RX)</text>

  <!-- Curve 1: Unamplified Passive Loss Decay (Dashed Gray) -->
  <path d="${unampPathD}" stroke="#64748b" stroke-width="1.8" stroke-dasharray="4,4" fill="none" opacity="0.75" />

  <!-- Curve 2: Pump Power Decay (Orange/Red) -->
  <path d="${pumpPathD}" stroke="url(#ramanPumpGrad)" stroke-width="1.5" stroke-dasharray="2,2" fill="none" opacity="0.6" />

  <!-- Curve 3: Distributed Raman Amplified Signal (Vibrant Solid with Glow) -->
  <path d="${ampPathD}" stroke="url(#ramanAmpGrad)" stroke-width="2.8" fill="none" filter="url(#ramanGlow)" />

  <!-- Markers: TX / RX / Pump Laser Injection Icons -->
  <circle cx="${padLeft}" cy="${padTop + plotH * 0.24}" r="5" fill="#10b981" stroke="#ffffff" stroke-width="1.5" />
  <circle cx="${padLeft + plotW}" cy="${padTop + (1.0 - (dynamics.netSpanGainDb - (-25)) / 33) * plotH}" r="5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />

  <!-- Legend in Plot Top-Right -->
  <g transform="translate(${padLeft + plotW - (isCompact ? 170 : 230)}, ${padTop + 10})">
    <line x1="0" y1="4" x2="16" y2="4" stroke="#38bdf8" stroke-width="2.5" />
    <text x="22" y="8" fill="#f8fafc" font-size="${isCompact ? 8 : 9.5}">Raman Signal (+${dynamics.onOffGainDb}dB)</text>
    <line x1="0" y1="18" x2="16" y2="18" stroke="#64748b" stroke-width="1.8" stroke-dasharray="3,3" />
    <text x="22" y="22" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">Passive Loss (-${dynamics.passiveSpanLossDb}dB)</text>
    <line x1="0" y1="32" x2="16" y2="32" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="2,2" />
    <text x="22" y="36" fill="#f59e0b" font-size="${isCompact ? 8 : 9.5}">Pump (${pumpPowerMw}mW @ ${pumpWavelengthNm}nm)</text>
  </g>

  <!-- METRIC GAUGES & BARS (BOTTOM SECTION) -->
  <g class="raman-bottom-gauges" transform="translate(24, ${height - (isCompact ? 30 : 38)})">
    <!-- On-Off Gain -->
    <text x="0" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">On-Off Gain: <tspan fill="#38bdf8" font-weight="700">+${dynamics.onOffGainDb} dB</tspan></text>
    <rect x="0" y="6" width="${barW}" height="5" rx="2.5" fill="#334155" />
    <rect x="0" y="6" width="${gainFillW}" height="5" rx="2.5" fill="#38bdf8" />

    <!-- OSNR Improvement -->
    <text x="${isCompact ? 150 : 240}" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">OSNR Boost: <tspan fill="#10b981" font-weight="700">+${dynamics.osnrImprovementDb} dB</tspan></text>
    <rect x="${isCompact ? 150 : 240}" y="6" width="${barW}" height="5" rx="2.5" fill="#334155" />
    <rect x="${isCompact ? 150 : 240}" y="6" width="${osnrFillW}" height="5" rx="2.5" fill="#10b981" />

    <!-- Pump Depletion -->
    <text x="${isCompact ? 300 : 480}" y="0" fill="#94a3b8" font-size="${isCompact ? 8 : 9.5}">Pump Depletion: <tspan fill="#f59e0b" font-weight="700">${dynamics.pumpDepletionPercent}%</tspan></text>
    <rect x="${isCompact ? 300 : 480}" y="6" width="${barW}" height="5" rx="2.5" fill="#334155" />
    <rect x="${isCompact ? 300 : 480}" y="6" width="${depletionFillW}" height="5" rx="2.5" fill="${dynamics.pumpDepletionPercent > 28 ? '#ef4444' : '#f59e0b'}" />

    <!-- Net Residual Margin -->
    <text x="${width - 48}" y="8" text-anchor="end" fill="#94a3b8" font-size="${isCompact ? 8.5 : 10}">Net Gain / Margin: <tspan fill="${dynamics.netSpanGainDb >= 0 ? '#10b981' : '#f59e0b'}" font-weight="700">${dynamics.netSpanGainDb > 0 ? '+' : ''}${dynamics.netSpanGainDb} dB</tspan></text>
  </g>
</svg>
  `.trim();
}

/**
 * Generates formatted text report for Optical Transport & NOC Engineering.
 */
export function generateRamanReport(metrics) {
  if (!metrics || !metrics.span) return 'No Optical Raman Amplifier data recorded.';

  const { span, dynamics, pumpPowerMw, pumpScheme, pumpWavelengthNm, subscriberCorrelation } = metrics;

  return `
================================================================================
SHAHDARA ISP · OPTICAL FIBER RAMAN AMPLIFIER (ITU-T G.665) AUDIT BRIEFING
================================================================================
Generated: ${new Date().toISOString()} PKT
Optical Span: ${span.name}
Span Physical Length: ${span.lengthKm} km
Fiber Specification: ${span.fiberType} (Effective Area Aeff: ${span.effectiveAreaUm2} µm²)
Signal Attenuation: ${span.signalLossDbPerKm} dB/km | Pump Attenuation: ${span.pumpLossDbPerKm} dB/km
Primary Sector: ${span.primaryArea} (Aliases: ${(span.aliasAreas || []).join(', ')})

[ RAMAN PUMP LASER CONFIGURATION ]
--------------------------------------------------------------------------------
Launch Pump Power: ${pumpPowerMw} mW (${dynamics.powerWatts.toFixed(3)} W)
Pump Laser Wavelength: ${metrics.pumpWavelengthLabel}
Injection Configuration: ${metrics.pumpSchemeLabel}
Effective Interaction Length (Leff): ${dynamics.effectiveLengthKm} km
Noise Transfer Characteristic: ${dynamics.noiseTransferRisk}

[ DISTRIBUTED OPTICAL GAIN & NOISE PERFORMANCE ]
--------------------------------------------------------------------------------
Raman Operational Status: ${dynamics.status.toUpperCase()}
On-Off Distributed Raman Gain: +${dynamics.onOffGainDb} dB
Passive Optical Span Loss: -${dynamics.passiveSpanLossDb} dB
Net Span Transmission Margin: ${dynamics.netSpanGainDb > 0 ? '+' : ''}${dynamics.netSpanGainDb} dB
OSNR Improvement Factor: +${dynamics.osnrImprovementDb} dB (relative to lumped EDFA)
Double Rayleigh Scattering (DRS) Noise: ${dynamics.drsNoiseFloorDbm} dBm (Penalty: ${dynamics.drsPenaltyDb} dB)
Pump Laser Depletion: ${dynamics.pumpDepletionPercent}%

[ SUBSCRIBER LEDGER & REVENUE CORRELATION ]
--------------------------------------------------------------------------------
Linked Sector Subscribers: ${subscriberCorrelation.totalSubscribers} (${subscriberCorrelation.activeSubscribers} Active, ${subscriberCorrelation.offlineSubscribers} Offline)
Sector Monthly Billed Revenue: ${formatPKR(subscriberCorrelation.sectorMonthlyRevenue)}
Sector Outstanding Dues: ${formatPKR(subscriberCorrelation.sectorTotalDues)}
Estimated Revenue Exposure At Risk: ${formatPKR(subscriberCorrelation.revenueAtRisk)}

[ NOC OPTICAL TRANSPORT RECOMMENDATION ]
--------------------------------------------------------------------------------
${
  dynamics.status === RAMAN_CONSTANTS.STATUS.CRITICAL
    ? 'CRITICAL WARNING: Double Rayleigh Scattering (DRS) multipath penalty exceeds 1.2 dB or pump laser drive power is near hardware thermal saturation. Lower pump power below 800 mW or switch to bidirectional dual-pump scheme.'
    : dynamics.status === RAMAN_CONSTANTS.STATUS.WARNING
    ? 'CAUTION: Pump power elevated or net link margin operates near receiver threshold. Review optical connector return loss (ORL) to prevent reflection-induced pump instabilities.'
    : 'OPTIMAL CARRIER PERFORMANCE: Distributed Raman amplification operating within ITU-T G.665 design budget with clean OSNR margin.'
}
================================================================================
`.trim();
}

/**
 * Initializes and wires the Raman Amplifier modal dialog and card.
 */
export function setupRamanModal(state, options = {}) {
  const modal = document.getElementById('dashboardRamanModal');
  const openBtn = document.getElementById('dashboardOpenRamanModalBtn');
  const closeBtn = document.getElementById('dashboardRamanModalCloseBtn');

  const spanSelect = document.getElementById('ramanSpanSelect');
  const schemeSelect = document.getElementById('ramanSchemeSelect');
  const wlSelect = document.getElementById('ramanWlSelect');
  const powerSlider = document.getElementById('ramanPowerSlider');
  const powerValPill = document.getElementById('ramanPowerVal');
  const resetBtn = document.getElementById('ramanResetBtn');

  // KPI elements
  const kpiSpanName = document.getElementById('ramanKpiSpanName');
  const kpiGain = document.getElementById('ramanKpiGain');
  const kpiOsnr = document.getElementById('ramanKpiOsnr');
  const kpiStatusBadge = document.getElementById('ramanStatusBadge');
  const kpiRevenueRisk = document.getElementById('ramanKpiRevenueRisk');

  // Chart wrap & Table
  const chartWrap = document.getElementById('ramanModalChartWrap');
  const spansTableBody = document.getElementById('ramanSpansTableBody');

  // Action buttons
  const filterAreaBtn = document.getElementById('ramanFilterAreaBtn');
  const copyReportBtn = document.getElementById('dashboardCopyRamanReportBtn');

  // Card chart
  const cardChart = document.getElementById('dashboardRamanChart');

  function renderView() {
    const metrics = calculateRamanMetrics(state);

    if (cardChart) {
      cardChart.innerHTML = renderRamanDiagramSvg(metrics, { compact: true });
    }

    if (!modal) return;

    if (kpiSpanName) {
      kpiSpanName.textContent = metrics.span.name.split(':')[0];
    }
    if (kpiGain) {
      kpiGain.textContent = `+${metrics.dynamics.onOffGainDb} dB (Net ${metrics.dynamics.netSpanGainDb > 0 ? '+' : ''}${metrics.dynamics.netSpanGainDb}dB)`;
      kpiGain.style.color = metrics.dynamics.netSpanGainDb >= 0 ? '#10b981' : '#38bdf8';
    }
    if (kpiOsnr) {
      kpiOsnr.textContent = `+${metrics.dynamics.osnrImprovementDb} dB (DRS ${metrics.dynamics.drsPenaltyDb}dB)`;
    }
    if (kpiStatusBadge) {
      kpiStatusBadge.textContent = metrics.dynamics.status.toUpperCase();
      kpiStatusBadge.className = `sim-delta-badge badge-${
        metrics.dynamics.status === RAMAN_CONSTANTS.STATUS.CRITICAL
          ? 'danger'
          : metrics.dynamics.status === RAMAN_CONSTANTS.STATUS.WARNING
          ? 'warning'
          : 'success'
      }`;
    }
    if (kpiRevenueRisk) {
      kpiRevenueRisk.textContent = `${formatPKR(metrics.subscriberCorrelation.revenueAtRisk)} at risk`;
    }

    if (chartWrap) {
      chartWrap.innerHTML = renderRamanDiagramSvg(metrics, { compact: false });
    }

    if (spansTableBody) {
      spansTableBody.innerHTML = metrics.spansList
        .map(s => {
          const isSelected = s.id === metrics.span.id;
          const dyn = calculateRamanDynamics(s, s.defaultPumpPowerMw, s.defaultPumpScheme, s.defaultPumpWavelengthNm);
          return `
            <tr class="${isSelected ? 'active-row' : ''}">
              <td><strong>${s.id.toUpperCase()}</strong></td>
              <td>${s.name.split(': ')[1] || s.name}</td>
              <td>${s.lengthKm} km</td>
              <td>${s.fiberType.split(' (')[0]}</td>
              <td><strong>+${dyn.onOffGainDb} dB</strong></td>
              <td>+${dyn.osnrImprovementDb} dB</td>
              <td>${isSelected ? '<span class="status-pill status-active">Monitored Active</span>' : '<span class="status-pill">Standby</span>'}</td>
            </tr>
          `;
        })
        .join('');
    }
  }

  // Populate Selects
  if (spanSelect) {
    spanSelect.innerHTML = SHAHDARA_RAMAN_SPANS.map(
      s => `<option value="${s.id}" ${s.id === currentSelectedSpanId ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    spanSelect.onchange = e => {
      setRamanSelectedSpan(e.target.value);
      if (powerSlider) powerSlider.value = currentPumpPowerMw;
      if (powerValPill) powerValPill.textContent = `${currentPumpPowerMw} mW`;
      if (schemeSelect) schemeSelect.value = currentPumpScheme;
      if (wlSelect) wlSelect.value = currentPumpWavelengthNm;
      renderView();
    };
  }

  if (schemeSelect) {
    schemeSelect.innerHTML = Object.entries(RAMAN_CONSTANTS.PUMP_SCHEMES).map(
      ([k, v]) => `<option value="${k}" ${k === currentPumpScheme ? 'selected' : ''}>${v}</option>`
    ).join('');
    schemeSelect.onchange = e => {
      setRamanPumpScheme(e.target.value);
      renderView();
    };
  }

  if (wlSelect) {
    wlSelect.innerHTML = Object.entries(RAMAN_CONSTANTS.PUMP_WAVELENGTHS).map(
      ([k, v]) => `<option value="${k}" ${Number(k) === currentPumpWavelengthNm ? 'selected' : ''}>${v}</option>`
    ).join('');
    wlSelect.onchange = e => {
      setRamanPumpWavelengthNm(e.target.value);
      renderView();
    };
  }

  if (powerSlider) {
    powerSlider.value = currentPumpPowerMw;
    powerSlider.oninput = e => {
      setRamanPumpPowerMw(e.target.value);
      if (powerValPill) powerValPill.textContent = `${currentPumpPowerMw} mW`;
      renderView();
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      resetRamanSimState();
      if (spanSelect) spanSelect.value = currentSelectedSpanId;
      if (schemeSelect) schemeSelect.value = currentPumpScheme;
      if (wlSelect) wlSelect.value = currentPumpWavelengthNm;
      if (powerSlider) powerSlider.value = currentPumpPowerMw;
      if (powerValPill) powerValPill.textContent = `${currentPumpPowerMw} mW`;
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Raman Amplifier simulation reset to baseline parameters.');
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

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const metrics = calculateRamanMetrics(state);
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(metrics.span.primaryArea);
      }
      if (modal && typeof modal.close === 'function') {
        modal.close();
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      const metrics = calculateRamanMetrics(state);
      const text = generateRamanReport(metrics);
      try {
        if (options.clipboard && typeof options.clipboard.writeText === 'function') {
          await options.clipboard.writeText(text);
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        }
        if (typeof options.onToast === 'function') {
          options.onToast('Optical Raman engineering report copied to clipboard!');
        }
      } catch {
        if (typeof options.onToast === 'function') {
          options.onToast('Failed to copy Optical Raman report.');
        }
      }
    };
  }

  renderView();
}
