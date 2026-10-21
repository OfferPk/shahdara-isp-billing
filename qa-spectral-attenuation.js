/**
 * Shahdara ISP Billing & Network Operations - Outside Plant Fiber Metrology
 * Spectral Attenuation Coefficient, Rayleigh Backscatter Slope & Water Peak (1383nm) Hydroxide Ion QA Suite
 * Standards: ITU-T G.650.1, ITU-T G.652.D, IEC 60793-1-40 Method C, Telcordia GR-20-CORE Issue 4
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const SPECTRAL_ATTENUATION_STORAGE_KEY = 'shahdara_spectral_attenuation_certs_v1';

export const SPECTRAL_FIBER_TYPES = {
  'G652D_LOW_WATER_PEAK': {
    id: 'G652D_LOW_WATER_PEAK',
    name: 'ITU-T G.652.D Low Water Peak Single-Mode Fiber (SMF-28e+)',
    category: 'Full-Spectrum Unshifted SMF',
    rayleighCoeffA: 0.98, // dB*um^4/km
    baseWaterPeakDbKm: 0.04, // Excess OH- absorption above Rayleigh (~0.31 dB/km total)
    attenuation1310DbKm: 0.33,
    attenuation1550DbKm: 0.19,
    attenuation1625DbKm: 0.21,
    eBandTransmissionAllowed: true,
    description: 'Modern pure synthetic silica glass with virtually eliminated OH- radical water absorption peak at 1383 nm.'
  },
  'G652AB_LEGACY_HIGH_PEAK': {
    id: 'G652AB_LEGACY_HIGH_PEAK',
    name: 'ITU-T G.652.A/B Legacy Standard SMF (Pre-2002 High Water Peak)',
    category: 'Legacy High Water Peak SMF',
    rayleighCoeffA: 1.02,
    baseWaterPeakDbKm: 1.38,
    attenuation1310DbKm: 0.36,
    attenuation1550DbKm: 0.22,
    attenuation1625DbKm: 0.24,
    eBandTransmissionAllowed: false,
    description: 'Legacy fiber containing residual chemical moisture; exhibits sharp OH- vibrational attenuation spike in the E-Band (1360-1460 nm).'
  },
  'G657A2_BEND_INSENSITIVE': {
    id: 'G657A2_BEND_INSENSITIVE',
    name: 'ITU-T G.657.A2 Bend-Insensitive Access Drop Fiber',
    category: 'Bend-Insensitive Access SMF',
    rayleighCoeffA: 0.99,
    baseWaterPeakDbKm: 0.05,
    attenuation1310DbKm: 0.34,
    attenuation1550DbKm: 0.20,
    attenuation1625DbKm: 0.22,
    eBandTransmissionAllowed: true,
    description: 'Fluorine-doped trench-assisted refractive index profile drop cable engineered for tight premises routing and low water absorption.'
  },
  'G655_NZDSF_METRO': {
    id: 'G655_NZDSF_METRO',
    name: 'ITU-T G.655 Non-Zero Dispersion-Shifted Fiber (NZ-DSF Feeder)',
    category: 'Dispersion-Shifted Backbone',
    rayleighCoeffA: 1.05,
    baseWaterPeakDbKm: 0.06,
    attenuation1310DbKm: 0.38,
    attenuation1550DbKm: 0.21,
    attenuation1625DbKm: 0.23,
    eBandTransmissionAllowed: false,
    description: 'Shifted zero-dispersion wavelength optimized for dense C-band DWDM amplification; moderate E-band attenuation.'
  }
};

export const MOISTURE_INGRESS_LEVELS = {
  'DRY_HERMETIC_SEALED': {
    id: 'DRY_HERMETIC_SEALED',
    name: 'Dry Hermetic Environment (Factory Sealed / Silica Gel Intact)',
    excessWaterPeakDbKm: 0.0,
    riskRating: 'NEGLIGIBLE',
    recommendation: 'Optimal conditions. Enclosure seal and thixotropic gel intact.'
  },
  'VAPOR_HUMID_SEASONAL': {
    id: 'VAPOR_HUMID_SEASONAL',
    name: 'Vapor Humidity Ingress (Shahdara Monsoon Season Exposure)',
    excessWaterPeakDbKm: 0.15,
    riskRating: 'LOW_MODERATE',
    recommendation: 'Slight moisture vapor adsorption. Replenish silica desiccant bags inside joint closure.'
  },
  'FLOODED_DUCT_CONDENSATION': {
    id: 'FLOODED_DUCT_CONDENSATION',
    name: 'Flooded Duct Condensation (Road Shoulder Underground Pipe)',
    excessWaterPeakDbKm: 0.65,
    riskRating: 'HIGH',
    recommendation: 'Continuous damp condensation. Inspect buffer tube seal and apply heat-shrink wrap.'
  },
  'SATURATED_SUBMERGED_WATERLOGGED': {
    id: 'SATURATED_SUBMERGED_WATERLOGGED',
    name: 'Submerged Waterlogged Pedestal (Direct Water Contact)',
    excessWaterPeakDbKm: 1.85,
    riskRating: 'CRITICAL_HAZARD',
    recommendation: 'Enclosure breached and flooded. Emergency pump out, replace gel seal, and re-splice contaminated ends.'
  }
};

export const SPECTRAL_QA_VERDICTS = {
  'CERTIFIED_FULL_SPECTRUM_PASS': {
    id: 'CERTIFIED_FULL_SPECTRUM_PASS',
    name: 'Certified Full-Spectrum Pass (Zero Water Peak)',
    badgeClass: 'badge-success',
    color: '#16a34a',
    description: 'Water peak attenuation ≤ 0.35 dB/km @ 1383nm. Full O-, E-, S-, C-, and L-bands transparent for 18-channel CWDM expansion.'
  },
  'CONDITIONAL_PASS_LEGACY_WATER_PEAK': {
    id: 'CONDITIONAL_PASS_LEGACY_WATER_PEAK',
    name: 'Conditional Pass (Restricted E-Band / O & C Usable)',
    badgeClass: 'badge-warning',
    color: '#f59e0b',
    description: 'Water peak between 0.36 and 0.80 dB/km. Standard GPON (1310/1490nm) and XGS-PON (1577nm) pass, but E-band (1370-1450nm) blocked.'
  },
  'FAILED_WATER_INGRESS_HAZARD': {
    id: 'FAILED_WATER_INGRESS_HAZARD',
    name: 'Failed: Severe Hydroxide Absorption Hazard (Reject)',
    badgeClass: 'badge-danger',
    color: '#dc2626',
    description: 'Water peak attenuation > 0.80 dB/km. High risk of moisture diffusion into glass micro-cracks causing long-term structural failure.'
  }
};

export const SHAHDARA_SPECTRAL_PRESETS = [
  {
    id: 'BARADARI_CORE_FEEDER_RING',
    name: 'Baradari ODF to Ring Backbone Feeder (G.652.D Low Water Peak)',
    subscriberName: 'Shahdara Baradari Central Ring Feeder',
    routeDescription: 'Central OLT Rack 02 to Baradari Chowk Ring FAT-01 (12.4 km trunk)',
    fiberTypeId: 'G652D_LOW_WATER_PEAK',
    moistureIngressId: 'DRY_HERMETIC_SEALED',
    spanLengthKm: 12.4,
    spliceCount: 4,
    connectorCount: 2,
    technicianName: 'Shahdara OSP Metro Team',
    notes: 'Hermetically sealed FOSC-400 closure with nitrogen purge; zero water absorption.'
  },
  {
    id: 'VANDALA_ROAD_FLOODED_PEDESTAL',
    name: 'Vandala Road Canal Pedestal Crossing (Flooded Condensation)',
    subscriberName: 'Vandala Road Distribution Node',
    routeDescription: 'Vandala Road Canal Siphon Pedestal to Rachna Town FAT-04 (6.8 km)',
    fiberTypeId: 'G652D_LOW_WATER_PEAK',
    moistureIngressId: 'FLOODED_DUCT_CONDENSATION',
    spanLengthKm: 6.8,
    spliceCount: 6,
    connectorCount: 2,
    technicianName: 'Lineman Tariq & Umair',
    notes: 'Pedestal partially submerged after recent rains; moisture ingress noted on cable outer sheath.'
  },
  {
    id: 'BEGUM_KOT_HIGH_PEAK_LEGACY',
    name: 'Begum Kot Pre-2002 Legacy Overhead Trunk (High Water Peak)',
    subscriberName: 'Begum Kot Legacy Sub-Station',
    routeDescription: 'Old GT Road Overhead Pole Route to Begum Kot Bazaar (8.5 km legacy)',
    fiberTypeId: 'G652AB_LEGACY_HIGH_PEAK',
    moistureIngressId: 'VAPOR_HUMID_SEASONAL',
    spanLengthKm: 8.5,
    spliceCount: 8,
    connectorCount: 4,
    technicianName: 'Lineman Asim Rasheed',
    notes: 'Old high-peak fiber installed in 1999; 1383nm peak severely elevated, CWDM E-band prohibited.'
  },
  {
    id: 'JIA_MUSA_ACCESS_DROP_SPAN',
    name: 'Jia Musa Commercial Drop Cable (G.657.A2 Clean)',
    subscriberName: 'Jia Musa Plaza Distribution Ring',
    routeDescription: 'Jia Musa Main Strip FAT-08 to Commercial Tower Riser (1.8 km)',
    fiberTypeId: 'G657A2_BEND_INSENSITIVE',
    moistureIngressId: 'DRY_HERMETIC_SEALED',
    spanLengthKm: 1.8,
    spliceCount: 2,
    connectorCount: 2,
    technicianName: 'Shahdara Drop Crew',
    notes: 'Freshly deployed G.657.A2 flat drop cable; pristine spectral characteristics.'
  },
  {
    id: 'RAVI_SIPHON_RIVER_CROSSING',
    name: 'Ravi Siphon River Crossing Sub-Duct (Dry Hermetic G.652.D)',
    subscriberName: 'Ravi River Crossing Trunk Line',
    routeDescription: 'Ravi Siphon South Bank to North Flood Barrier Manhole (16.2 km)',
    fiberTypeId: 'G652D_LOW_WATER_PEAK',
    moistureIngressId: 'DRY_HERMETIC_SEALED',
    spanLengthKm: 16.2,
    spliceCount: 5,
    connectorCount: 2,
    technicianName: 'Metrology Lab QA Inspector',
    notes: 'Heavy HDPE armored duct bank under riverbed; pristine attenuation profile.'
  }
];

/**
 * Calculates continuous spectral attenuation curve alpha(lambda) from 1260 to 1650 nm.
 * Formula: alpha(lambda) = alpha_rayleigh(lambda) + alpha_OH(lambda) + alpha_IR(lambda)
 */
export function calculateSpectralAttenuation(params = {}) {
  const fiberType = SPECTRAL_FIBER_TYPES[params.fiberTypeId] || SPECTRAL_FIBER_TYPES['G652D_LOW_WATER_PEAK'];
  const moisture = MOISTURE_INGRESS_LEVELS[params.moistureIngressId] || MOISTURE_INGRESS_LEVELS['DRY_HERMETIC_SEALED'];

  const spanLengthKm = Math.max(0.1, Number(params.spanLengthKm) || 10.0);
  const spliceCount = Math.max(0, Math.round(Number(params.spliceCount) || 0));
  const connectorCount = Math.max(0, Math.round(Number(params.connectorCount) || 2));

  // Discrete standard wavelengths
  const wavelengths = [
    { name: '1310 nm (O-Band GPON Upstream)', lambdaNm: 1310, lambdaUm: 1.310 },
    { name: '1383 nm (E-Band Water Peak OH-)', lambdaNm: 1383, lambdaUm: 1.383 },
    { name: '1490 nm (S-Band GPON Downstream)', lambdaNm: 1490, lambdaUm: 1.490 },
    { name: '1550 nm (C-Band CATV / DWDM Feeder)', lambdaNm: 1550, lambdaUm: 1.550 },
    { name: '1577 nm (L-Band XGS-PON Downstream)', lambdaNm: 1577, lambdaUm: 1.577 },
    { name: '1625 nm (U-Band Live OTDR Monitor)', lambdaNm: 1625, lambdaUm: 1.625 }
  ];

  const totalWaterPeakCoeff = fiberType.baseWaterPeakDbKm + moisture.excessWaterPeakDbKm;

  function getAlphaAtLambda(lambdaUm) {
    // Rayleigh scattering: A / lambda^4
    const alphaRayleigh = fiberType.rayleighCoeffA / Math.pow(lambdaUm, 4);

    // Hydroxide OH- radical absorption Gaussian peak centered at 1.383 um with sigma = 0.015 um
    const deltaLambda = lambdaUm - 1.383;
    const alphaOh = totalWaterPeakCoeff * Math.exp(-Math.pow(deltaLambda, 2) / (2.0 * Math.pow(0.018, 2)));

    // Infrared tail absorption edge: ~ 0.001 * exp((lambda - 1.55) / 0.12)
    const alphaIr = 0.002 * Math.exp((lambdaUm - 1.55) / 0.14);

    return Number((alphaRayleigh + alphaOh + alphaIr).toFixed(3));
  }

  // Calculate discrete points
  const discreteResults = wavelengths.map(w => {
    const alphaDbKm = getAlphaAtLambda(w.lambdaUm);
    const fiberLossDb = alphaDbKm * spanLengthKm;
    const jointLossDb = (spliceCount * 0.05) + (connectorCount * 0.25);
    const totalLossDb = Number((fiberLossDb + jointLossDb).toFixed(2));

    return {
      name: w.name,
      lambdaNm: w.lambdaNm,
      alphaDbKm,
      fiberLossDb: Number(fiberLossDb.toFixed(2)),
      jointLossDb: Number(jointLossDb.toFixed(2)),
      totalLossDb
    };
  });

  // Calculate continuous spectral curve points for SVG visualization (1260nm to 1650nm step 10nm)
  const curvePoints = [];
  for (let l = 1260; l <= 1650; l += 10) {
    curvePoints.push({
      lambdaNm: l,
      alphaDbKm: getAlphaAtLambda(l / 1000.0)
    });
  }

  const alpha1310 = getAlphaAtLambda(1.310);
  const alpha1383 = getAlphaAtLambda(1.383);
  const alpha1550 = getAlphaAtLambda(1.550);

  // Water peak differential over 1310 nm baseline: Δα_water = α_1383 - α_1310
  const waterPeakDeltaDbKm = Number((alpha1383 - alpha1310).toFixed(3));

  // Determine Quality Verdict
  let verdict = SPECTRAL_QA_VERDICTS['CERTIFIED_FULL_SPECTRUM_PASS'];
  if (alpha1383 > 0.80) {
    verdict = SPECTRAL_QA_VERDICTS['FAILED_WATER_INGRESS_HAZARD'];
  } else if (alpha1383 > 0.35) {
    verdict = SPECTRAL_QA_VERDICTS['CONDITIONAL_PASS_LEGACY_WATER_PEAK'];
  }

  // CWDM E-Band suitability
  const isEBandUsable = alpha1383 <= 0.35;

  return {
    fiberType,
    moisture,
    spanLengthKm,
    spliceCount,
    connectorCount,
    totalWaterPeakCoeff: Number(totalWaterPeakCoeff.toFixed(3)),
    waterPeakDeltaDbKm,
    alpha1310,
    alpha1383,
    alpha1550,
    isEBandUsable,
    discreteResults,
    curvePoints,
    verdict
  };
}

/**
 * Validates input parameters for a spectral attenuation certification.
 */
export function validateSpectralAttenuationInput(data = {}) {
  const errors = [];

  if (!data.subscriberName || !String(data.subscriberName).trim()) {
    errors.push('Subscriber name or link route designation is required.');
  }

  if (!data.routeDescription || !String(data.routeDescription).trim()) {
    errors.push('Route description / fiber span topology is required.');
  }

  const span = Number(data.spanLengthKm);
  if (isNaN(span) || span < 0.1 || span > 100.0) {
    errors.push('Fiber span length must be between 0.1 and 100.0 km.');
  }

  const splices = Number(data.spliceCount);
  if (isNaN(splices) || splices < 0 || splices > 50) {
    errors.push('Splice count must be between 0 and 50.');
  }

  const connectors = Number(data.connectorCount);
  if (isNaN(connectors) || connectors < 0 || connectors > 20) {
    errors.push('Connector count must be between 0 and 20.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Builds an immutable, audit-ready certificate record with identifier format SPT-YYYYMM-XXXX.
 */
export function buildSpectralAttenuationCertRecord(data = {}) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = data.id || `SPT-${yearMonth}-${randomSuffix}`;

  const analysis = calculateSpectralAttenuation(data);

  return {
    id: certId,
    timestamp: data.timestamp || now.toISOString(),
    subscriberName: String(data.subscriberName || 'Shahdara Fiber Span').trim(),
    customerId: data.customerId || null,
    routeDescription: String(data.routeDescription || 'Trunk Route').trim(),
    fiberTypeId: data.fiberTypeId || 'G652D_LOW_WATER_PEAK',
    moistureIngressId: data.moistureIngressId || 'DRY_HERMETIC_SEALED',
    spanLengthKm: Number(data.spanLengthKm) || 10.0,
    spliceCount: Number(data.spliceCount) || 4,
    connectorCount: Number(data.connectorCount) || 2,
    technicianName: String(data.technicianName || 'Shahdara Metrology Team').trim(),
    notes: String(data.notes || '').trim(),
    status: data.status || 'VERIFIED',
    analysis
  };
}

let inMemorySpectralCerts = [];

/**
 * LocalStorage CRUD operations with in-memory fallback.
 */
export function getSavedSpectralAttenuationCerts() {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(SPECTRAL_ATTENUATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error('Failed to read spectral attenuation certs:', err);
    }
  }
  return inMemorySpectralCerts;
}

export function saveSpectralAttenuationCert(record) {
  const existing = getSavedSpectralAttenuationCerts();
  const filtered = existing.filter(c => c.id !== record.id);
  filtered.unshift(record);
  const trimmed = filtered.slice(0, 100);

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SPECTRAL_ATTENUATION_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (err) {
      console.error('Failed to save spectral attenuation cert:', err);
    }
  }
  inMemorySpectralCerts = trimmed;
  return record;
}

export function updateSpectralAttenuationCertStatus(certId, newStatus) {
  const list = getSavedSpectralAttenuationCerts();
  const target = list.find(c => c.id === certId);
  if (target) {
    target.status = newStatus;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SPECTRAL_ATTENUATION_STORAGE_KEY, JSON.stringify(list));
      } catch (err) {
        console.error('Failed to update spectral cert status:', err);
      }
    }
    return true;
  }
  return false;
}

export function clearSpectralAttenuationCerts() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(SPECTRAL_ATTENUATION_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear spectral attenuation certs:', err);
    }
  }
  inMemorySpectralCerts = [];
}

/**
 * Aggregates summary KPI metrics from certified records.
 */
export function calculateSpectralAttenuationMetrics(records = []) {
  const total = records.length;
  if (total === 0) {
    return {
      totalCertificates: 0,
      fullSpectrumPassCount: 0,
      conditionalPassCount: 0,
      failedCount: 0,
      passRatePercent: 0,
      avgWaterPeakDbKm: 0,
      maxWaterPeakDbKm: 0,
      eBandReadyPercent: 0
    };
  }

  let fullPass = 0;
  let conditional = 0;
  let failed = 0;
  let sumPeak = 0;
  let maxPeak = 0;
  let eBandReady = 0;

  for (const r of records) {
    const a = r.analysis;
    if (a && a.verdict) {
      if (a.verdict.id === 'CERTIFIED_FULL_SPECTRUM_PASS') fullPass++;
      else if (a.verdict.id === 'CONDITIONAL_PASS_LEGACY_WATER_PEAK') conditional++;
      else failed++;
    }
    if (a) {
      const p = a.alpha1383 || 0;
      sumPeak += p;
      if (p > maxPeak) maxPeak = p;
      if (a.isEBandUsable) eBandReady++;
    }
  }

  const passRate = ((fullPass + conditional) / total) * 100.0;
  const eBandPct = (eBandReady / total) * 100.0;

  return {
    totalCertificates: total,
    fullSpectrumPassCount: fullPass,
    conditionalPassCount: conditional,
    failedCount: failed,
    passRatePercent: Number(passRate.toFixed(1)),
    avgWaterPeakDbKm: Number((sumPeak / total).toFixed(3)),
    maxWaterPeakDbKm: Number(maxPeak.toFixed(3)),
    eBandReadyPercent: Number(eBandPct.toFixed(1))
  };
}

/**
 * Pure-vector SVG visualizer rendering the continuous spectral attenuation curve,
 * OH- water absorption peak, wavelength cursors, and real-time HUD telemetry ribbon.
 */
export function renderSpectralAttenuationQaSvg(analysis) {
  if (!analysis) return '<svg width="100%" height="220" viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg"><text x="320" y="110" text-anchor="middle" fill="#64748b">No Telemetry Available</text></svg>';

  const v = analysis.verdict;
  const statusColor = v ? v.color : '#16a34a';
  const alpha1310 = analysis.alpha1310 || 0.33;
  const alpha1383 = analysis.alpha1383 || 0.28;
  const alpha1550 = analysis.alpha1550 || 0.19;
  const delta = analysis.waterPeakDeltaDbKm || 0;

  // Chart coordinates: X: 1260 to 1650 nm (width 360 px), Y: 0.10 to 2.00 dB/km (height 140 px)
  const chartX0 = 50;
  const chartY0 = 50;
  const chartW = 340;
  const chartH = 130;

  function toX(nm) {
    return chartX0 + ((nm - 1260) / (1650 - 1260)) * chartW;
  }

  function toY(alpha) {
    const clamped = Math.max(0.10, Math.min(2.00, alpha));
    return chartY0 + chartH - ((clamped - 0.10) / (2.00 - 0.10)) * chartH;
  }

  // Construct SVG path for spectral curve
  const pathD = analysis.curvePoints.map((pt, idx) => {
    const x = toX(pt.lambdaNm);
    const y = toY(pt.alphaDbKm);
    return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return `
<svg width="100%" height="220" viewBox="0 0 640 220" xmlns="http://www.w3.org/2000/svg" style="background:#0f172a; border-radius:10px; font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="35%" stop-color="#f59e0b" />
      <stop offset="70%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
  </defs>

  <!-- Header Banner -->
  <rect x="0" y="0" width="640" height="34" fill="#1e293b" />
  <text x="16" y="22" fill="#94a3b8" font-size="11" font-weight="600" letter-spacing="0.5">SPECTRAL ATTENUATION METROLOGY · ITU-T G.650.1 / IEC 60793-1-40</text>
  <rect x="490" y="7" width="134" height="20" rx="4" fill="${statusColor}22" stroke="${statusColor}" stroke-width="1" />
  <text x="557" y="21" fill="${statusColor}" font-size="10" font-weight="700" text-anchor="middle">${v ? v.name.split(' ')[0] : 'PASS'}</text>

  <!-- Chart Grid Lines -->
  <g stroke="#334155" stroke-dasharray="3,3" stroke-width="1">
    <!-- Horizontal Grid -->
    <line x1="${chartX0}" y1="${toY(0.2)}" x2="${chartX0 + chartW}" y2="${toY(0.2)}" />
    <line x1="${chartX0}" y1="${toY(0.5)}" x2="${chartX0 + chartW}" y2="${toY(0.5)}" />
    <line x1="${chartX0}" y1="${toY(1.0)}" x2="${chartX0 + chartW}" y2="${toY(1.0)}" />
    <line x1="${chartX0}" y1="${toY(1.5)}" x2="${chartX0 + chartW}" y2="${toY(1.5)}" />
    <!-- Vertical Grid -->
    <line x1="${toX(1310)}" y1="${chartY0}" x2="${toX(1310)}" y2="${chartY0 + chartH}" />
    <line x1="${toX(1383)}" y1="${chartY0}" x2="${toX(1383)}" y2="${chartY0 + chartH}" />
    <line x1="${toX(1490)}" y1="${chartY0}" x2="${toX(1490)}" y2="${chartY0 + chartH}" />
    <line x1="${toX(1550)}" y1="${chartY0}" x2="${toX(1550)}" y2="${chartY0 + chartH}" />
  </g>

  <!-- Axis Labels -->
  <text x="${chartX0 - 8}" y="${toY(0.2) + 3}" fill="#64748b" font-size="8" text-anchor="end">0.2</text>
  <text x="${chartX0 - 8}" y="${toY(0.5) + 3}" fill="#64748b" font-size="8" text-anchor="end">0.5</text>
  <text x="${chartX0 - 8}" y="${toY(1.0) + 3}" fill="#64748b" font-size="8" text-anchor="end">1.0</text>
  <text x="${chartX0 - 8}" y="${toY(1.5) + 3}" fill="#64748b" font-size="8" text-anchor="end">1.5 dB/km</text>

  <text x="${toX(1310)}" y="${chartY0 + chartH + 14}" fill="#64748b" font-size="8" text-anchor="middle">1310</text>
  <text x="${toX(1383)}" y="${chartY0 + chartH + 14}" fill="#f59e0b" font-size="8" font-weight="700" text-anchor="middle">1383 (OH-)</text>
  <text x="${toX(1490)}" y="${chartY0 + chartH + 14}" fill="#64748b" font-size="8" text-anchor="middle">1490</text>
  <text x="${toX(1550)}" y="${chartY0 + chartH + 14}" fill="#64748b" font-size="8" text-anchor="middle">1550 nm</text>

  <!-- Spectral Attenuation Curve -->
  <path d="${pathD}" fill="none" stroke="url(#curveGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

  <!-- 1383nm Water Peak Callout Marker -->
  <circle cx="${toX(1383)}" cy="${toY(alpha1383)}" r="4.5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" />
  <text x="${toX(1383) + 8}" y="${toY(alpha1383) - 6}" fill="#f59e0b" font-size="9" font-weight="700">${alpha1383} dB/km</text>

  <!-- Right HUD Telemetry Panel -->
  <g transform="translate(416, 46)">
    <rect x="0" y="0" width="210" height="162" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />

    <!-- Metric 1: Water Peak 1383nm -->
    <text x="12" y="18" fill="#94a3b8" font-size="9">WATER PEAK (1383nm)</text>
    <text x="12" y="34" fill="${alpha1383 > 0.35 ? '#f59e0b' : '#10b981'}" font-size="14" font-weight="700">${alpha1383} dB/km</text>
    <text x="105" y="34" fill="#64748b" font-size="9">(Limit: &le; 0.35)</text>

    <!-- Metric 2: Standard 1310 & 1550nm -->
    <text x="12" y="58" fill="#94a3b8" font-size="9">STANDARD TRANSMISSION</text>
    <text x="12" y="74" fill="#f8fafc" font-size="12" font-weight="600">1310nm: ${alpha1310} dB/km</text>
    <text x="12" y="90" fill="#f8fafc" font-size="12" font-weight="600">1550nm: ${alpha1550} dB/km</text>

    <!-- Metric 3: Water Peak Delta & CWDM Status -->
    <text x="12" y="114" fill="#94a3b8" font-size="9">E-BAND CWDM SUITABILITY</text>
    <rect x="12" y="122" width="186" height="24" rx="4" fill="${analysis.isEBandUsable ? '#10b98122' : '#dc262622'}" stroke="${analysis.isEBandUsable ? '#10b981' : '#dc2626'}" stroke-width="1" />
    <text x="105" y="137" fill="${analysis.isEBandUsable ? '#10b981' : '#f87171'}" font-size="10" font-weight="700" text-anchor="middle">${analysis.isEBandUsable ? '18-CH CWDM UNBLOCKED' : 'E-BAND CHANNELS BLOCKED'}</text>

    <text x="12" y="156" fill="#64748b" font-size="8">&Delta;&alpha; (1383-1310): ${delta} dB/km | Span: ${analysis.spanLengthKm} km</text>
  </g>
</svg>
`;
}

/**
 * Generates printable HTML certificate:
 * Options: { format: 'A4' | 'POS80' }
 */
export function generateSpectralAttenuationCertHtml(record, options = {}) {
  const format = options.format || 'A4';
  const a = record.analysis;
  const v = a ? a.verdict : SPECTRAL_QA_VERDICTS['CERTIFIED_FULL_SPECTRUM_PASS'];

  if (format === 'POS80') {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>POS-80 ${record.id}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: monospace, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 4px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
  .badge { display: inline-block; padding: 2px 4px; border: 1px solid #000; font-weight: bold; }
</style>
</head>
<body>
  <div class="center bold" style="font-size: 13px;">SHAHDARA ISP BROADBAND</div>
  <div class="center" style="font-size: 9px;">SPECTRAL ATTENUATION QA FIELD SLIP</div>
  <div class="center" style="font-size: 9px;">ITU-T G.650.1 / IEC 60793-1-40</div>
  <div class="divider"></div>

  <div class="row"><span>Cert ID:</span><span class="bold">${record.id}</span></div>
  <div class="row"><span>Date:</span><span>${new Date(record.timestamp).toLocaleDateString()}</span></div>
  <div class="row"><span>Link:</span><span class="bold">${record.subscriberName.slice(0, 18)}</span></div>
  <div class="row"><span>Span Length:</span><span>${record.spanLengthKm} km</span></div>
  <div class="row"><span>Splices / Conns:</span><span>${record.spliceCount} spl / ${record.connectorCount} conn</span></div>
  <div class="row"><span>Fiber Spec:</span><span>${a.fiberType.name.slice(0, 16)}</span></div>

  <div class="divider"></div>
  <div class="row bold"><span>1310 nm Atten:</span><span>${a.alpha1310} dB/km</span></div>
  <div class="row bold"><span>1383 nm (OH-):</span><span>${a.alpha1383} dB/km</span></div>
  <div class="row bold"><span>1550 nm Atten:</span><span>${a.alpha1550} dB/km</span></div>
  <div class="row"><span>Water Delta:</span><span>${a.waterPeakDeltaDbKm} dB/km</span></div>
  <div class="row"><span>E-Band CWDM:</span><span class="bold">${a.isEBandUsable ? 'PASS (18-CH)' : 'BLOCKED'}</span></div>

  <div class="divider"></div>
  <div class="center bold badge">${v.name.slice(0, 24)}</div>
  <div class="center" style="margin-top: 6px; font-size: 8px;">Metrology Crew: ${record.technicianName}</div>
  <div class="center" style="margin-top: 10px;">_________________________<br>QA Metrologist Signature</div>
</body>
</html>
`;
  }

  // Formal A4 Certificate
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Spectral Attenuation Certificate ${record.id}</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; line-height: 1.5; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
  .logo { font-size: 20px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; }
  .sub-logo { font-size: 11px; color: #64748b; font-weight: 500; }
  .cert-meta { text-align: right; }
  .cert-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 6px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; text-transform: uppercase; }
  .badge-success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
  .badge-warning { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
  .badge-danger { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 13px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
  .card-label { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; }
  .card-value { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; color: #475569; }
  .footer { margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">SHAHDARA BROADBAND ISP</div>
      <div class="sub-logo">Outside Plant Optical Metrology &amp; Spectral Analysis Laboratory</div>
    </div>
    <div class="cert-meta">
      <div style="font-size: 11px; color: #64748b;">Certificate No:</div>
      <div style="font-size: 14px; font-weight: 800; color: #0284c7;">${record.id}</div>
      <div style="font-size: 10px; color: #94a3b8;">Issued: ${new Date(record.timestamp).toLocaleString()}</div>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <div>
      <div class="cert-title">Optical Fiber Spectral Attenuation &amp; Water Peak (1383nm) Certification</div>
      <div style="font-size: 11px; color: #64748b;">Standards Compliance: ITU-T G.650.1 · ITU-T G.652.D · IEC 60793-1-40 Method C · Telcordia GR-20-CORE</div>
    </div>
    <div>
      <span class="badge ${v.badgeClass}">${v.name}</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">1. Link Metadata &amp; Route Topology</div>
    <div class="grid">
      <div class="card">
        <div class="card-label">Fiber Route / Trunk Segment</div>
        <div class="card-value">${record.subscriberName}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Topology: ${record.routeDescription}</div>
      </div>
      <div class="card">
        <div class="card-label">Environmental Enclosure State</div>
        <div class="card-value">${a.moisture.name}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Risk Rating: ${a.moisture.riskRating}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">2. Spectral Attenuation Metrology Summary</div>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
      <div class="card">
        <div class="card-label">1383nm Water Peak OH-</div>
        <div class="card-value" style="color: ${a.alpha1383 > 0.35 ? '#dc2626' : '#047857'};">
          ${a.alpha1383} dB/km
        </div>
        <div style="font-size: 10px; color: #64748b;">Limit: &le; 0.35 dB/km</div>
      </div>
      <div class="card">
        <div class="card-label">1310nm O-Band Loss</div>
        <div class="card-value" style="color: #0284c7;">
          ${a.alpha1310} dB/km
        </div>
        <div style="font-size: 10px; color: #64748b;">GPON Upstream Baseline</div>
      </div>
      <div class="card">
        <div class="card-label">1550nm C-Band Loss</div>
        <div class="card-value" style="color: #047857;">
          ${a.alpha1550} dB/km
        </div>
        <div style="font-size: 10px; color: #64748b;">DWDM Transmission Rate</div>
      </div>
      <div class="card">
        <div class="card-label">CWDM E-Band Status</div>
        <div class="card-value" style="color: ${a.isEBandUsable ? '#047857' : '#dc2626'};">
          ${a.isEBandUsable ? '18-CH READY' : 'BLOCKED'}
        </div>
        <div style="font-size: 10px; color: #64748b;">1360-1460nm Window</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. Multi-Wavelength Discrete Optical Event &amp; Total Link Loss Table</div>
    <table>
      <thead>
        <tr>
          <th>Standard Operating Wavelength</th>
          <th>Spectral Attenuation (dB/km)</th>
          <th>Fiber Glass Loss (${a.spanLengthKm} km)</th>
          <th>Joint &amp; Connector Loss (dB)</th>
          <th>Total Link Insertion Loss (dB)</th>
        </tr>
      </thead>
      <tbody>
        ${a.discreteResults.map(r => `
          <tr>
            <td><strong>${r.name}</strong></td>
            <td><strong>${r.alphaDbKm} dB/km</strong></td>
            <td>${r.fiberLossDb} dB</td>
            <td>${r.jointLossDb} dB</td>
            <td><strong style="color: #0369a1;">${r.totalLossDb} dB</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  ${record.notes ? `
  <div class="section">
    <div class="section-title">4. Laboratory QA Inspector Notes</div>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-style: italic;">
      "${record.notes}"
    </div>
  </div>
  ` : ''}

  <div class="footer">
    <div>Shahdara Optical Metrology Laboratory · Ravi Zone NOC Lahore</div>
    <div>ISO/IEC 17025 Certified Optical Metrology Document</div>
  </div>
</body>
</html>
`;
}

/**
 * Generates a bilingual Urdu/English WhatsApp technician notice.
 */
export function formatSpectralAttenuationCertWhatsApp(record) {
  const a = record.analysis;
  const v = a ? a.verdict : SPECTRAL_QA_VERDICTS['CERTIFIED_FULL_SPECTRUM_PASS'];

  const statusEmoji = v.id === 'CERTIFIED_FULL_SPECTRUM_PASS' ? '✅' : (v.id === 'CONDITIONAL_PASS_LEGACY_WATER_PEAK' ? '⚠️' : '❌');

  return `*${statusEmoji} SHAHDARA ISP SPECTRAL ATTENUATION QA CERTIFICATE*
*سرٹیفکیٹ برائے سپیکٹرل ایٹینوئیشن و واٹر پیک (1383nm) ٹیسٹنگ*

📄 *Certificate ID:* ${record.id}
👤 *Link / Route:* ${record.subscriberName}
📍 *Span Topology:* ${record.routeDescription}
📅 *Date:* ${new Date(record.timestamp).toLocaleDateString()}

🔍 *SPECTRAL LOSS METROLOGY (نتائج تجزیہ):*
• *Fiber Model:* ${a.fiberType.name}
• *Span Length:* ${a.spanLengthKm} km
• *1310 nm Attenuation:* *${a.alpha1310} dB/km*
• *1383 nm Water Peak (OH-):* *${a.alpha1383} dB/km* (Limit: ≤ 0.35 dB/km)
• *1550 nm Attenuation:* *${a.alpha1550} dB/km*
• *Water Peak Delta (Δα):* ${a.waterPeakDeltaDbKm} dB/km
• *CWDM E-Band Readiness:* *${a.isEBandUsable ? '18-Channel Ready' : 'Blocked / High Loss'}*

📋 *VERDICT (حتمی فیصلہ):*
*${v.name}*
${v.description}

🔧 *Metrologist / Crew:* ${record.technicianName}
_Shahdara Optical Metrology & Quality Assurance Laboratory_`;
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM.
 */
export function generateSpectralAttenuationCertsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Timestamp',
    'Subscriber Name',
    'Route Description',
    'Fiber Type',
    'Moisture Ingress',
    'Span Length (km)',
    'Splice Count',
    'Connector Count',
    'Alpha 1310 (dB/km)',
    'Alpha 1383 (dB/km)',
    'Alpha 1550 (dB/km)',
    'Water Delta (dB/km)',
    'E-Band Usable',
    'Verdict',
    'Technician Name',
    'Status'
  ];

  const rows = records.map(r => {
    const a = r.analysis || {};
    const ft = a.fiberType || {};
    const mi = a.moisture || {};
    const v = a.verdict || {};

    return [
      r.id,
      r.timestamp,
      r.subscriberName,
      r.routeDescription,
      ft.name || r.fiberTypeId,
      mi.name || r.moistureIngressId,
      r.spanLengthKm,
      r.spliceCount,
      r.connectorCount,
      a.alpha1310,
      a.alpha1383,
      a.alpha1550,
      a.waterPeakDeltaDbKm,
      a.isEBandUsable ? 'YES' : 'NO',
      v.name || 'UNKNOWN',
      r.technicianName,
      r.status
    ].map(val => {
      const s = String(val == null ? '' : val).replace(/"/g, '""');
      return `"${s}"`;
    }).join(',');
  });

  return '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
}

/**
 * Interactive UI Modal Dialog Controller for Spectral Attenuation QA.
 */
export function setupSpectralAttenuationModal(options = {}) {
  const {
    state,
    dialogElement,
    triggerButton,
    onToast
  } = options;

  if (!dialogElement) return null;

  // Form input elements
  const presetSelect = dialogElement.querySelector('#sptPresetSelect');
  const subscriberInput = dialogElement.querySelector('#sptSubscriberInput');
  const routeInput = dialogElement.querySelector('#sptRouteInput');
  const fiberTypeSelect = dialogElement.querySelector('#sptFiberTypeSelect');
  const moistureSelect = dialogElement.querySelector('#sptMoistureSelect');
  const spanInput = dialogElement.querySelector('#sptSpanInput');
  const spliceInput = dialogElement.querySelector('#sptSpliceInput');
  const connectorInput = dialogElement.querySelector('#sptConnectorInput');
  const technicianInput = dialogElement.querySelector('#sptTechnicianInput');
  const notesInput = dialogElement.querySelector('#sptNotesInput');

  // Preview elements
  const svgContainer = dialogElement.querySelector('#sptSvgContainer');
  const peakDisplay = dialogElement.querySelector('#sptPeakDisplay');
  const loss1310Display = dialogElement.querySelector('#sptLoss1310Display');
  const loss1550Display = dialogElement.querySelector('#sptLoss1550Display');
  const ebandDisplay = dialogElement.querySelector('#sptEbandDisplay');
  const verdictBanner = dialogElement.querySelector('#sptVerdictBanner');

  // Action buttons
  const saveBtn = dialogElement.querySelector('#sptSaveBtn');
  const printA4Btn = dialogElement.querySelector('#sptPrintA4Btn');
  const printPosBtn = dialogElement.querySelector('#sptPrintPosBtn');
  const whatsappBtn = dialogElement.querySelector('#sptWhatsAppBtn');
  const csvExportBtn = dialogElement.querySelector('#sptCsvExportBtn');
  const closeBtn = dialogElement.querySelector('#sptCloseBtn');
  const historyTableBody = dialogElement.querySelector('#sptHistoryTableBody');

  let currentAnalysis = null;
  let activeRecord = null;

  function getCurrentFormData() {
    return {
      subscriberName: subscriberInput ? subscriberInput.value : '',
      routeDescription: routeInput ? routeInput.value : '',
      fiberTypeId: fiberTypeSelect ? fiberTypeSelect.value : 'G652D_LOW_WATER_PEAK',
      moistureIngressId: moistureSelect ? moistureSelect.value : 'DRY_HERMETIC_SEALED',
      spanLengthKm: Number(spanInput ? spanInput.value : 10),
      spliceCount: Number(spliceInput ? spliceInput.value : 4),
      connectorCount: Number(connectorInput ? connectorInput.value : 2),
      technicianName: technicianInput ? technicianInput.value : 'Shahdara Metrology Team',
      notes: notesInput ? notesInput.value : ''
    };
  }

  function recalculate() {
    const data = getCurrentFormData();
    currentAnalysis = calculateSpectralAttenuation(data);

    if (peakDisplay) peakDisplay.textContent = `${currentAnalysis.alpha1383} dB/km`;
    if (loss1310Display) loss1310Display.textContent = `${currentAnalysis.alpha1310} dB/km`;
    if (loss1550Display) loss1550Display.textContent = `${currentAnalysis.alpha1550} dB/km`;
    if (ebandDisplay) ebandDisplay.textContent = currentAnalysis.isEBandUsable ? '18-CH READY' : 'BLOCKED';

    if (verdictBanner) {
      const v = currentAnalysis.verdict;
      verdictBanner.className = `verdict-banner ${v.badgeClass}`;
      verdictBanner.textContent = `${v.name} - ${v.description}`;
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderSpectralAttenuationQaSvg(currentAnalysis);
    }
  }

  function loadPreset(presetId) {
    const p = SHAHDARA_SPECTRAL_PRESETS.find(item => item.id === presetId);
    if (!p) return;

    if (subscriberInput) subscriberInput.value = p.subscriberName;
    if (routeInput) routeInput.value = p.routeDescription;
    if (fiberTypeSelect) fiberTypeSelect.value = p.fiberTypeId;
    if (moistureSelect) moistureSelect.value = p.moistureIngressId;
    if (spanInput) spanInput.value = p.spanLengthKm;
    if (spliceInput) spliceInput.value = p.spliceCount;
    if (connectorInput) connectorInput.value = p.connectorCount;
    if (technicianInput) technicianInput.value = p.technicianName;
    if (notesInput) notesInput.value = p.notes;

    recalculate();
  }

  function renderHistory() {
    if (!historyTableBody) return;
    const certs = getSavedSpectralAttenuationCerts();
    if (certs.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:12px;">No saved spectral attenuation certifications.</td></tr>';
      return;
    }

    historyTableBody.innerHTML = certs.map(c => {
      const v = c.analysis ? c.analysis.verdict : null;
      return `
        <tr>
          <td><strong>${c.id}</strong></td>
          <td>${new Date(c.timestamp).toLocaleDateString()}</td>
          <td>${c.subscriberName}</td>
          <td><strong>${c.analysis ? c.analysis.alpha1383 : '-'} dB/km</strong></td>
          <td><span class="badge ${v ? v.badgeClass : 'badge-secondary'}">${v ? v.name.split(' ')[0] : 'VERIFIED'}</span></td>
          <td>
            <button type="button" class="action-link-btn" data-spt-view="${c.id}" style="background:none; border:none; color:#0284c7; cursor:pointer; font-weight:600;">View</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire view buttons
    historyTableBody.querySelectorAll('[data-spt-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-spt-view');
        const record = certs.find(item => item.id === id);
        if (record) {
          activeRecord = record;
          if (subscriberInput) subscriberInput.value = record.subscriberName;
          if (routeInput) routeInput.value = record.routeDescription;
          if (fiberTypeSelect) fiberTypeSelect.value = record.fiberTypeId;
          if (moistureSelect) moistureSelect.value = record.moistureIngressId;
          if (spanInput) spanInput.value = record.spanLengthKm;
          if (spliceInput) spliceInput.value = record.spliceCount;
          if (connectorInput) connectorInput.value = record.connectorCount;
          if (technicianInput) technicianInput.value = record.technicianName;
          if (notesInput) notesInput.value = record.notes;
          recalculate();
          if (onToast) onToast(`Loaded certificate ${record.id}`);
        }
      });
    });
  }

  // Bind input change events for live recalculation
  const inputsToListen = [
    fiberTypeSelect, moistureSelect, spanInput, spliceInput, connectorInput
  ];
  inputsToListen.forEach(input => {
    if (input) {
      input.addEventListener('input', recalculate);
      input.addEventListener('change', recalculate);
    }
  });

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      if (presetSelect.value) {
        loadPreset(presetSelect.value);
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const data = getCurrentFormData();
      const val = validateSpectralAttenuationInput(data);
      if (!val.isValid) {
        const errText = 'Validation errors:\n' + val.errors.join('\n');
        if (typeof onToast === 'function') {
          onToast(errText);
        } else if (typeof window !== 'undefined' && typeof window.toast === 'function') {
          window.toast(errText);
        } else if (typeof alert === 'function') {
          alert(errText);
        }
        return;
      }
      const record = buildSpectralAttenuationCertRecord(data);
      saveSpectralAttenuationCert(record);
      activeRecord = record;
      renderHistory();
      if (onToast) onToast(`Certified and saved ${record.id}`);
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const record = activeRecord || buildSpectralAttenuationCertRecord(getCurrentFormData());
      const html = generateSpectralAttenuationCertHtml(record, { format: 'A4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
      }
    });
  }

  if (printPosBtn) {
    printPosBtn.addEventListener('click', () => {
      const record = activeRecord || buildSpectralAttenuationCertRecord(getCurrentFormData());
      const html = generateSpectralAttenuationCertHtml(record, { format: 'POS80' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 300);
      }
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const record = activeRecord || buildSpectralAttenuationCertRecord(getCurrentFormData());
      const msg = formatSpectralAttenuationCertWhatsApp(record);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).then(() => {
          if (onToast) onToast('Copied WhatsApp dispatch notice to clipboard!');
        });
      } else {
        alert(msg);
      }
    });
  }

  if (csvExportBtn) {
    csvExportBtn.addEventListener('click', () => {
      const list = getSavedSpectralAttenuationCerts();
      if (list.length === 0) {
        const dummy = activeRecord || buildSpectralAttenuationCertRecord(getCurrentFormData());
        list.push(dummy);
      }
      const csv = generateSpectralAttenuationCertsCsv(list);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spectral-attenuation-certs-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (onToast) onToast('Downloaded spectral attenuation certificates CSV.');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      dialogElement.close();
    });
  }

  // Initial load
  if (presetSelect && presetSelect.options.length > 0) {
    presetSelect.value = 'BARADARI_CORE_FEEDER_RING';
    loadPreset('BARADARI_CORE_FEEDER_RING');
  } else {
    recalculate();
  }
  renderHistory();

  return {
    recalculate,
    loadPreset,
    renderHistory,
    getCurrentFormData
  };
}
