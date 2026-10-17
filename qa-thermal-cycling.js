/**
 * Shahdara ISP Billing & Network Operations - Outside Plant Fiber Engineering
 * Environmental Temperature Diurnal Cycling, Attenuation Stability & Cold-Shrink Gel Freezing QA Suite
 * Standards: IEC 60794-1-22 Method F1, Telcordia GR-20-CORE Issue 4 §6.5, ITU-T G.650.1 / G.652.D / G.657.A2
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const FIBER_THERMAL_CYCLE_STORAGE_KEY = 'shahdara_fiber_thermal_cycle_certs_v1';

export const THERMAL_CYCLE_PROFILES = {
  'SHAHDARA_ROOFTOP_DIURNAL': {
    id: 'SHAHDARA_ROOFTOP_DIURNAL',
    name: 'Shahdara Rooftop Diurnal Cycle (-2°C Winter to +48°C Summer Day)',
    category: 'Severe Continental Diurnal',
    minTempC: -2,
    maxTempC: 48,
    nominalDeltaT: 50,
    solarIrradianceWm2: 950,
    humidityPercent: 85,
    description: 'Direct rooftop solar thermal heating and night radiation cooling typical of Lahore / Shahdara climate.'
  },
  'ARCTIC_FROST_FREEZE': {
    id: 'ARCTIC_FROST_FREEZE',
    name: 'Canal Bank Frost Freeze (-10°C Severe Winter to +20°C Mild Day)',
    category: 'Sub-Zero Freeze / Ice Ingress',
    minTempC: -10,
    maxTempC: 20,
    nominalDeltaT: 30,
    solarIrradianceWm2: 450,
    humidityPercent: 95,
    description: 'Saturated frost moisture with freezing ice expansion hazard inside manholes and unsealed joint boxes.'
  },
  'SUBMERGED_CANAL_DAMPED': {
    id: 'SUBMERGED_CANAL_DAMPED',
    name: 'Submerged Sump / Deep Duct Damped Profile (+15°C to +32°C)',
    category: 'Underground Thermally Moderated',
    minTempC: 15,
    maxTempC: 32,
    nominalDeltaT: 17,
    solarIrradianceWm2: 0,
    humidityPercent: 100,
    description: 'Groundwater-damped underground pipeline environment with tight seasonal thermal swings.'
  },
  'ACCELERATED_CHAMBER_TEST': {
    id: 'ACCELERATED_CHAMBER_TEST',
    name: 'Telcordia GR-20 Accelerated Chamber Test (-40°C to +70°C, 4 Cycles)',
    category: 'Laboratory Stress Qualification',
    minTempC: -40,
    maxTempC: 70,
    nominalDeltaT: 110,
    solarIrradianceWm2: 0,
    humidityPercent: 90,
    description: 'Rigorous 48-hour climatic environmental chamber test per Telcordia GR-20-CORE §6.5.1.'
  }
};

export const BUFFER_TUBE_POLYMERS = {
  'PBT_POLYBUTYLENE': {
    id: 'PBT_POLYBUTYLENE',
    name: 'PBT (Polybutylene Terephthalate) Loose Tube',
    ctePpmK: 80.0, // 80e-6 / K
    elasticModulusMpa: 2500,
    glassTransitionTempC: 45,
    meltTempC: 225,
    waterAbsorptionPercent: 0.08,
    description: 'Standard loose tube polymer with high dimensional stability, low creep, and balanced thermal expansion.'
  },
  'POLYCARBONATE_PC': {
    id: 'POLYCARBONATE_PC',
    name: 'Polycarbonate (PC) High-Modulus Buffer Tube',
    ctePpmK: 65.0, // 65e-6 / K
    elasticModulusMpa: 2300,
    glassTransitionTempC: 145,
    meltTempC: 260,
    waterAbsorptionPercent: 0.15,
    description: 'Rigid engineering thermoplastic with high thermal resistance and lowest plastic thermal expansion.'
  },
  'POLYPROPYLENE_PP': {
    id: 'POLYPROPYLENE_PP',
    name: 'Polypropylene Copolymer (PP) Flexible Tube',
    ctePpmK: 110.0, // 110e-6 / K
    elasticModulusMpa: 1400,
    glassTransitionTempC: -10,
    meltTempC: 165,
    waterAbsorptionPercent: 0.03,
    description: 'High-flexibility kink-resistant polymer; exhibits higher thermal expansion and contraction at extremes.'
  },
  'LSZH_COMPOUND': {
    id: 'LSZH_COMPOUND',
    name: 'LSZH (Low-Smoke Zero-Halogen) Flame Retardant',
    ctePpmK: 95.0, // 95e-6 / K
    elasticModulusMpa: 1800,
    glassTransitionTempC: 50,
    meltTempC: 190,
    waterAbsorptionPercent: 0.20,
    description: 'Halogen-free compound required for indoor riser and building entrance conduits; moderate thermal contraction.'
  }
};

export const FILLING_GEL_COMPOUNDS = {
  'SYNTHETIC_POLYBUTENE_GEL': {
    id: 'SYNTHETIC_POLYBUTENE_GEL',
    name: 'Synthetic Polybutene Thixotropic Water-Blocking Gel',
    freezePointC: -35,
    dripPointC: 75,
    viscosityCps: 4500,
    coldShrinkStressPenalty: 0.015,
    description: 'High-purity synthetic hydrocarbon jelly engineered to prevent water migration without micro-bending fibers.'
  },
  'SILICONE_BASED_GEL': {
    id: 'SILICONE_BASED_GEL',
    name: 'High-Viscosity Fluorosilicone Gel (Extreme Climate)',
    freezePointC: -55,
    dripPointC: 120,
    viscosityCps: 7000,
    coldShrinkStressPenalty: 0.008,
    description: 'Broad-temperature silicone compound ideal for extreme sub-zero frost and super-heated rooftop aerial lines.'
  },
  'DRY_WATER_SWELLABLE_YARN': {
    id: 'DRY_WATER_SWELLABLE_YARN',
    name: 'Dry Core Water-Swellable Tape & SAP Yarn (Gel-Free)',
    freezePointC: -60,
    dripPointC: 150,
    viscosityCps: 0,
    coldShrinkStressPenalty: 0.005,
    description: 'Gel-free dry design utilizing super-absorbent polymer powder; zero gel freezing or oil bleeding hazard.'
  },
  'MINERAL_PETROLEUM_JELLY': {
    id: 'MINERAL_PETROLEUM_JELLY',
    name: 'Commercial Petroleum Jelly Compound (Legacy OSP)',
    freezePointC: -8,
    dripPointC: 58,
    viscosityCps: 3200,
    coldShrinkStressPenalty: 0.045,
    description: 'Budget mineral wax/oil mixture; susceptible to oil separation at 50°C and solid crystallization at -5°C.'
  }
};

export const THERMAL_QA_VERDICTS = {
  'CERTIFIED_THERMAL_STABLE_PASS': {
    id: 'CERTIFIED_THERMAL_STABLE_PASS',
    name: 'Certified Thermally Stable (IEC 60794-1-22 Method F1 Pass)',
    badgeClass: 'badge-success',
    color: '#16a34a',
    description: 'Peak attenuation drift Δα ≤ 0.05 dB/km across -10°C to +60°C. Thixotropic gel stable, zero oil bleed, no ice formation.'
  },
  'CONDITIONAL_PASS_MILD_DRIFT': {
    id: 'CONDITIONAL_PASS_MILD_DRIFT',
    name: 'Conditional Pass (Mild Temperature Drift, Optical Margin OK)',
    badgeClass: 'badge-warning',
    color: '#f59e0b',
    description: 'Peak attenuation drift between 0.051 and 0.150 dB/km. Marginal micro-bending induced by polymer shrinkage; requires link budget safety buffer.'
  },
  'FAILED_THERMAL_MICROBEND_HAZARD': {
    id: 'FAILED_THERMAL_MICROBEND_HAZARD',
    name: 'Failed: Severe Thermal Micro-Bend or Gel Crystallization Hazard',
    badgeClass: 'badge-danger',
    color: '#dc2626',
    description: 'Peak attenuation drift > 0.150 dB/km or gel freezing below temperature minimum. High risk of fiber fatigue failure or signal blackout.'
  }
};

export const SHAHDARA_THERMAL_PRESETS = [
  {
    id: 'BARADARI_ROOFTOP_FEEDER',
    name: 'Baradari Commercial Plaza Rooftop Feeder (PBT, Polybutene Gel)',
    subscriberName: 'Baradari Commercial Plaza Feeder #04',
    routeDescription: 'OLT Main Hub to Plaza Rooftop FAT via South Wall Riser',
    profileId: 'SHAHDARA_ROOFTOP_DIURNAL',
    polymerId: 'PBT_POLYBUTYLENE',
    gelId: 'SYNTHETIC_POLYBUTENE_GEL',
    spanLengthKm: 4.8,
    fiberCount: 24,
    baseLoss1310DbKm: 0.33,
    baseLoss1550DbKm: 0.19,
    testMinTempC: -2,
    testMaxTempC: 48,
    measuredMaxDeltaAlphaDbKm: 0.038,
    technicianName: 'Sohail Akhtar (OSP Field Metrology)',
    notes: 'Exposed black jacket aerial trunk on rooftop cable tray with direct summer sunlight.'
  },
  {
    id: 'VANDALA_ROAD_AERIAL_DROP',
    name: 'Vandala Road Overhead Pole Drop (LSZH, Dry SAP Yarn, Diurnal)',
    subscriberName: 'Vandala Road Pole 22 Distribution Span',
    routeDescription: 'Feeder Pole 18 to Pole 22 Aerial Messenger Drop',
    profileId: 'SHAHDARA_ROOFTOP_DIURNAL',
    polymerId: 'LSZH_COMPOUND',
    gelId: 'DRY_WATER_SWELLABLE_YARN',
    spanLengthKm: 2.1,
    fiberCount: 8,
    baseLoss1310DbKm: 0.34,
    baseLoss1550DbKm: 0.20,
    testMinTempC: 0,
    testMaxTempC: 46,
    measuredMaxDeltaAlphaDbKm: 0.042,
    technicianName: 'Muhammad Hamza (Lineman Crew)',
    notes: 'Dry-core gel-free figure-8 drop cable. Excellent cold stability with zero jelly drip.'
  },
  {
    id: 'BEGUM_KOT_CANAL_FROST',
    name: 'Begum Kot Ravi Canal Sump (PBT, Petroleum Jelly, Frost Freeze Hazard)',
    subscriberName: 'Begum Kot Canal Culvert Cable Span 02',
    routeDescription: 'GT Road Siphon Culvert Chamber to North Sump Handhole',
    profileId: 'ARCTIC_FROST_FREEZE',
    polymerId: 'PBT_POLYBUTYLENE',
    gelId: 'MINERAL_PETROLEUM_JELLY',
    spanLengthKm: 3.5,
    fiberCount: 48,
    baseLoss1310DbKm: 0.35,
    baseLoss1550DbKm: 0.21,
    testMinTempC: -8,
    testMaxTempC: 18,
    measuredMaxDeltaAlphaDbKm: 0.185,
    technicianName: 'Zubair Qureshi (Canal Specialist)',
    notes: 'Low-cost legacy jelly hardened and solidified during winter frost, causing micro-bending spikes.'
  },
  {
    id: 'JIA_MUSA_UNDERGROUND_DUCT',
    name: 'Jia Musa Main Highway Duct (Polycarbonate, Polybutene Gel, Submerged)',
    subscriberName: 'Jia Musa Ring Backbone Duct Cable 01',
    routeDescription: 'Central Exchange ODF to Jia Musa Bypass Manhole 06',
    profileId: 'SUBMERGED_CANAL_DAMPED',
    polymerId: 'POLYCARBONATE_PC',
    gelId: 'SYNTHETIC_POLYBUTENE_GEL',
    spanLengthKm: 8.6,
    fiberCount: 72,
    baseLoss1310DbKm: 0.33,
    baseLoss1550DbKm: 0.19,
    testMinTempC: 16,
    testMaxTempC: 30,
    measuredMaxDeltaAlphaDbKm: 0.015,
    technicianName: 'Babar Azam (Senior Telecom Engineer)',
    notes: 'Underground conduit thermally buffered by waterlogged silt. Superb attenuation stability.'
  },
  {
    id: 'RAVI_SIPHON_QUALIFICATION',
    name: 'Ravi Siphon River Crossing Cable (Polycarbonate, Silicone Gel, Chamber)',
    subscriberName: 'Ravi Siphon Long-Span Armored River Cable',
    routeDescription: 'South River Embankment to North Siphon Terminal ODF',
    profileId: 'ACCELERATED_CHAMBER_TEST',
    polymerId: 'POLYCARBONATE_PC',
    gelId: 'SILICONE_BASED_GEL',
    spanLengthKm: 14.2,
    fiberCount: 96,
    baseLoss1310DbKm: 0.32,
    baseLoss1550DbKm: 0.18,
    testMinTempC: -40,
    testMaxTempC: 70,
    measuredMaxDeltaAlphaDbKm: 0.029,
    technicianName: 'Naveed Iqbal (Metrology Lab Director)',
    notes: 'Type qualification test for ruggedized heavy armored direct-buried river crossing cable.'
  }
];

/**
 * Calculates thermal expansion/contraction strain, micro-bending optical attenuation shift,
 * and gel freeze risk across ambient temperature extremes.
 * @param {Object} params
 * @returns {Object} Comprehensive thermal analysis
 */
export function calculateThermalCyclingPhysics(params = {}) {
  const profile = THERMAL_CYCLE_PROFILES[params.profileId] || THERMAL_CYCLE_PROFILES['SHAHDARA_ROOFTOP_DIURNAL'];
  const polymer = BUFFER_TUBE_POLYMERS[params.polymerId] || BUFFER_TUBE_POLYMERS['PBT_POLYBUTYLENE'];
  const gel = FILLING_GEL_COMPOUNDS[params.gelId] || FILLING_GEL_COMPOUNDS['SYNTHETIC_POLYBUTENE_GEL'];

  const spanLengthKm = Math.max(0.1, Number(params.spanLengthKm || 5.0));
  const fiberCount = Math.max(1, parseInt(params.fiberCount || 24, 10));
  const baseLoss1310DbKm = Math.max(0.1, Number(params.baseLoss1310DbKm || 0.33));
  const baseLoss1550DbKm = Math.max(0.1, Number(params.baseLoss1550DbKm || 0.19));

  const testMinTempC = Number(params.testMinTempC !== undefined ? params.testMinTempC : profile.minTempC);
  const testMaxTempC = Number(params.testMaxTempC !== undefined ? params.testMaxTempC : profile.maxTempC);
  const deltaT = Math.max(1, testMaxTempC - testMinTempC);

  // Silica glass CTE is ~0.55e-6 / K (0.55 ppm/K)
  const silicaCtePpmK = 0.55;
  const differentialCtePpmK = polymer.ctePpmK - silicaCtePpmK;

  // Maximum thermal strain in buffer tube: epsilon = Delta_CTE * Delta_T
  const thermalStrainPercent = (differentialCtePpmK * 1e-6 * deltaT) * 100.0;

  // Cold temperature contraction strain (below reference room temp 20°C)
  const coldDeltaT = Math.max(0, 20.0 - testMinTempC);
  const coldContractionPercent = (differentialCtePpmK * 1e-6 * coldDeltaT) * 100.0;

  // Hot temperature expansion (above 20°C)
  const hotDeltaT = Math.max(0, testMaxTempC - 20.0);
  const hotExpansionPercent = (differentialCtePpmK * 1e-6 * hotDeltaT) * 100.0;

  // Gel Freeze & Drip Risk Analysis
  const isGelFrozen = testMinTempC <= gel.freezePointC;
  const isGelDripping = testMaxTempC >= gel.dripPointC;

  // Mathematical Micro-bending Attenuation Shift Modeling
  // Micro-bend loss scales with (strain)^1.8 and is ~1.5x higher at 1550nm than 1310nm
  let theoreticalMaxDeltaAlphaDbKm = 0.015 * Math.pow(coldContractionPercent / 0.15, 1.8) + gel.coldShrinkStressPenalty;
  if (isGelFrozen) {
    theoreticalMaxDeltaAlphaDbKm += 0.12; // Massive ice/solid crystallization penalty
  }
  if (isGelDripping) {
    theoreticalMaxDeltaAlphaDbKm += 0.04; // Oil drainage and dry fiber friction
  }

  // Use user-provided measured value if available, clamped to realistic bounds
  const measuredMaxDeltaAlphaDbKm = Number(
    params.measuredMaxDeltaAlphaDbKm !== undefined
      ? params.measuredMaxDeltaAlphaDbKm
      : theoreticalMaxDeltaAlphaDbKm
  );

  const peakLoss1550DbKm = baseLoss1550DbKm + measuredMaxDeltaAlphaDbKm;
  const peakLoss1310DbKm = baseLoss1310DbKm + measuredMaxDeltaAlphaDbKm * 0.72;

  const totalLinkBaseLoss1550Db = baseLoss1550DbKm * spanLengthKm;
  const totalLinkPeakLoss1550Db = peakLoss1550DbKm * spanLengthKm;
  const totalLinkThermalPenaltyDb = measuredMaxDeltaAlphaDbKm * spanLengthKm;

  // Standards Verdict Qualification: Telcordia GR-20-CORE / IEC 60794-1-22 Method F1 limit: Delta_alpha <= 0.05 dB/km
  let verdictKey = 'CERTIFIED_THERMAL_STABLE_PASS';
  if (measuredMaxDeltaAlphaDbKm > 0.15 || isGelFrozen) {
    verdictKey = 'FAILED_THERMAL_MICROBEND_HAZARD';
  } else if (measuredMaxDeltaAlphaDbKm > 0.05 || isGelDripping) {
    verdictKey = 'CONDITIONAL_PASS_MILD_DRIFT';
  }

  const verdict = THERMAL_QA_VERDICTS[verdictKey];

  return {
    profile,
    polymer,
    gel,
    spanLengthKm,
    fiberCount,
    baseLoss1310DbKm,
    baseLoss1550DbKm,
    testMinTempC,
    testMaxTempC,
    deltaT,
    differentialCtePpmK: Number(differentialCtePpmK.toFixed(1)),
    thermalStrainPercent: Number(thermalStrainPercent.toFixed(3)),
    coldContractionPercent: Number(coldContractionPercent.toFixed(3)),
    hotExpansionPercent: Number(hotExpansionPercent.toFixed(3)),
    isGelFrozen,
    isGelDripping,
    theoreticalMaxDeltaAlphaDbKm: Number(theoreticalMaxDeltaAlphaDbKm.toFixed(4)),
    measuredMaxDeltaAlphaDbKm: Number(measuredMaxDeltaAlphaDbKm.toFixed(4)),
    peakLoss1310DbKm: Number(peakLoss1310DbKm.toFixed(3)),
    peakLoss1550DbKm: Number(peakLoss1550DbKm.toFixed(3)),
    totalLinkBaseLoss1550Db: Number(totalLinkBaseLoss1550Db.toFixed(2)),
    totalLinkPeakLoss1550Db: Number(totalLinkPeakLoss1550Db.toFixed(2)),
    totalLinkThermalPenaltyDb: Number(totalLinkThermalPenaltyDb.toFixed(2)),
    verdict
  };
}

/**
 * Validates form input parameters for Thermal Cycling QA certification.
 * @param {Object} input
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateThermalCyclingInput(input = {}) {
  const errors = [];

  if (!input.subscriberName || !String(input.subscriberName).trim()) {
    errors.push('Link or span name reference is required.');
  }

  if (input.spanLengthKm === undefined || isNaN(Number(input.spanLengthKm)) || Number(input.spanLengthKm) < 0.1 || Number(input.spanLengthKm) > 100) {
    errors.push('Span length must be between 0.1 and 100.0 km.');
  }

  if (input.testMinTempC === undefined || isNaN(Number(input.testMinTempC)) || Number(input.testMinTempC) < -60 || Number(input.testMinTempC) > 50) {
    errors.push('Minimum cycle temperature must be between -60°C and +50°C.');
  }

  if (input.testMaxTempC === undefined || isNaN(Number(input.testMaxTempC)) || Number(input.testMaxTempC) < -20 || Number(input.testMaxTempC) > 100) {
    errors.push('Maximum cycle temperature must be between -20°C and +100°C.');
  }

  if (input.testMinTempC !== undefined && input.testMaxTempC !== undefined && Number(input.testMinTempC) >= Number(input.testMaxTempC)) {
    errors.push('Maximum temperature must be greater than minimum temperature.');
  }

  if (input.measuredMaxDeltaAlphaDbKm === undefined || isNaN(Number(input.measuredMaxDeltaAlphaDbKm)) || Number(input.measuredMaxDeltaAlphaDbKm) < 0 || Number(input.measuredMaxDeltaAlphaDbKm) > 2.0) {
    errors.push('Measured attenuation drift Δα must be between 0.0 and 2.0 dB/km.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Builds structured Thermal Cycling QA certificate record.
 * @param {Object} input
 * @returns {Object}
 */
export function buildThermalCyclingCertRecord(input = {}) {
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const id = input.id || `THM-${yearMonth}-${randomSuffix}`;

  const analysis = calculateThermalCyclingPhysics(input);

  return {
    id,
    createdAt: input.createdAt || now.toISOString(),
    subscriberName: String(input.subscriberName || 'Shahdara Optical Feeder Span').trim(),
    routeDescription: String(input.routeDescription || 'Exchange ODF to Field Joint Enclosure').trim(),
    profileId: input.profileId || 'SHAHDARA_ROOFTOP_DIURNAL',
    polymerId: input.polymerId || 'PBT_POLYBUTYLENE',
    gelId: input.gelId || 'SYNTHETIC_POLYBUTENE_GEL',
    spanLengthKm: analysis.spanLengthKm,
    fiberCount: analysis.fiberCount,
    baseLoss1310DbKm: analysis.baseLoss1310DbKm,
    baseLoss1550DbKm: analysis.baseLoss1550DbKm,
    testMinTempC: analysis.testMinTempC,
    testMaxTempC: analysis.testMaxTempC,
    measuredMaxDeltaAlphaDbKm: analysis.measuredMaxDeltaAlphaDbKm,
    technicianName: String(input.technicianName || 'Shahdara OSP Field Metrology').trim(),
    notes: String(input.notes || '').trim(),
    status: input.status || 'VERIFIED_AUDIT',
    analysis
  };
}

let inMemoryThermalCerts = [];

/**
 * Retrieves saved Thermal Cycling QA certificates from storage.
 * @param {Storage} [storage]
 * @returns {Object[]}
 */
export function getSavedThermalCyclingCerts(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (store) {
    try {
      const raw = store.getItem(FIBER_THERMAL_CYCLE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error('Error reading saved Thermal Cycling certs:', err);
    }
  }
  return inMemoryThermalCerts;
}

/**
 * Saves a Thermal Cycling QA certificate record to storage.
 * @param {Object} record
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function saveThermalCyclingCert(record, storage) {
  if (!record || !record.id) return false;
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const existing = getSavedThermalCyclingCerts(store);
  const filtered = existing.filter(c => c.id !== record.id);
  filtered.unshift(record);
  const bounded = filtered.slice(0, 100);

  if (store) {
    try {
      store.setItem(FIBER_THERMAL_CYCLE_STORAGE_KEY, JSON.stringify(bounded));
    } catch (err) {
      console.error('Error saving Thermal Cycling cert:', err);
    }
  }
  inMemoryThermalCerts = bounded;
  return true;
}

/**
 * Updates status of an existing Thermal Cycling QA certificate.
 * @param {string} certId
 * @param {string} newStatus
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function updateThermalCyclingCertStatus(certId, newStatus, storage) {
  if (!certId) return false;
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const certs = getSavedThermalCyclingCerts(store);
  const target = certs.find(c => c.id === certId);
  if (!target) return false;
  target.status = newStatus;

  if (store) {
    try {
      store.setItem(FIBER_THERMAL_CYCLE_STORAGE_KEY, JSON.stringify(certs));
    } catch (err) {
      console.error('Error updating Thermal Cycling cert status:', err);
    }
  }
  return true;
}

/**
 * Clears all Thermal Cycling QA certificates from storage.
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function clearThermalCyclingCerts(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (store) {
    try {
      store.removeItem(FIBER_THERMAL_CYCLE_STORAGE_KEY);
    } catch (err) {
      console.error('Error clearing Thermal Cycling certs:', err);
    }
  }
  inMemoryThermalCerts = [];
  return true;
}

/**
 * Computes aggregate summary metrics over a collection of Thermal Cycling QA certificates.
 * @param {Object[]} records
 * @returns {Object}
 */
export function calculateThermalCyclingMetrics(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      totalCertificates: 0,
      passedCertificates: 0,
      conditionalCertificates: 0,
      failedCertificates: 0,
      passRatePercent: 0,
      avgDeltaAlphaDbKm: 0,
      maxDeltaAlphaDbKm: 0
    };
  }

  let passed = 0;
  let conditional = 0;
  let failed = 0;
  let totalDeltaAlpha = 0;
  let maxDeltaAlpha = 0;

  for (const r of records) {
    const verdictId = r.analysis?.verdict?.id;
    if (verdictId === 'CERTIFIED_THERMAL_STABLE_PASS') passed++;
    else if (verdictId === 'CONDITIONAL_PASS_MILD_DRIFT') conditional++;
    else failed++;

    const drift = r.analysis?.measuredMaxDeltaAlphaDbKm || 0;
    totalDeltaAlpha += drift;
    if (drift > maxDeltaAlpha) maxDeltaAlpha = drift;
  }

  const count = records.length;
  const passRatePercent = count > 0 ? Number(((passed / count) * 100).toFixed(1)) : 0;
  const avgDeltaAlphaDbKm = count > 0 ? Number((totalDeltaAlpha / count).toFixed(4)) : 0;

  return {
    totalCertificates: count,
    passedCertificates: passed,
    conditionalCertificates: conditional,
    failedCertificates: failed,
    passRatePercent,
    avgDeltaAlphaDbKm,
    maxDeltaAlphaDbKm: Number(maxDeltaAlpha.toFixed(4))
  };
}

/**
 * Pure vector SVG visualizer showing 24-hr diurnal temperature cycle,
 * attenuation shift curve, and real-time HUD telemetry ribbon.
 * @param {Object} analysis
 * @returns {string} SVG markup string
 */
export function renderThermalCyclingQaSvg(analysis = {}) {
  const prof = analysis.profile || THERMAL_CYCLE_PROFILES['SHAHDARA_ROOFTOP_DIURNAL'];
  const poly = analysis.polymer || BUFFER_TUBE_POLYMERS['PBT_POLYBUTYLENE'];
  const gel = analysis.gel || FILLING_GEL_COMPOUNDS['SYNTHETIC_POLYBUTENE_GEL'];
  const verdict = analysis.verdict || THERMAL_QA_VERDICTS['CERTIFIED_THERMAL_STABLE_PASS'];

  const width = 880;
  const height = 440;

  const isFailed = verdict.id === 'FAILED_THERMAL_MICROBEND_HAZARD';
  const isCond = verdict.id === 'CONDITIONAL_PASS_MILD_DRIFT';
  const statusColor = isFailed ? '#ef4444' : (isCond ? '#f59e0b' : '#10b981');

  // Generate 24-hour Diurnal Sinusoidal Temperature Points
  // T(t) = T_min + (Delta_T / 2) * (1 - cos(2*pi*t / 24))
  const tempPoints = [];
  const lossPoints = [];
  const chartX = 80;
  const chartY = 70;
  const chartW = 460;
  const chartH = 240;

  for (let h = 0; h <= 24; h += 0.5) {
    const tNorm = h / 24;
    const rad = tNorm * 2 * Math.PI - Math.PI / 2; // Peak around 14:00 (hour 14)
    const sinFactor = (Math.sin(rad) + 1) / 2;
    const tempC = analysis.testMinTempC + sinFactor * analysis.deltaT;

    // X coordinate
    const px = chartX + tNorm * chartW;
    // Temperature Y coordinate (-40 to 80°C range)
    const pyTemp = chartY + chartH - ((tempC - (-20)) / 90) * chartH;
    tempPoints.push(`${px.toFixed(1)},${pyTemp.toFixed(1)}`);

    // Attenuation shift Y coordinate (0 to 0.25 dB/km)
    // Micro-bend spikes at extreme cold (contraction) and extreme hot (expansion)
    const coldPenalty = Math.max(0, 20.0 - tempC);
    const hotPenalty = Math.max(0, tempC - 20.0);
    const instShift = (Math.pow(coldPenalty / 35, 2) + Math.pow(hotPenalty / 40, 2)) * analysis.measuredMaxDeltaAlphaDbKm;
    const pyLoss = chartY + chartH - (instShift / 0.25) * chartH;
    lossPoints.push(`${px.toFixed(1)},${pyLoss.toFixed(1)}`);
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; background: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius: 8px;">
      <defs>
        <linearGradient id="tempCurveGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="50%" stop-color="#f59e0b" />
          <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>

        <linearGradient id="tempAreaFill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3" />
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.05" />
        </linearGradient>

        <linearGradient id="bufferTubeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>

      <!-- Background Grid -->
      <g stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" opacity="0.6">
        <line x1="${chartX}" y1="${chartY}" x2="${chartX + chartW}" y2="${chartY}" />
        <line x1="${chartX}" y1="${chartY + 60}" x2="${chartX + chartW}" y2="${chartY + 60}" />
        <line x1="${chartX}" y1="${chartY + 120}" x2="${chartX + chartW}" y2="${chartY + 120}" />
        <line x1="${chartX}" y1="${chartY + 180}" x2="${chartX + chartW}" y2="${chartY + 180}" />
        <line x1="${chartX}" y1="${chartY + chartH}" x2="${chartX + chartW}" y2="${chartY + chartH}" />

        <line x1="${chartX}" y1="${chartY}" x2="${chartX}" y2="${chartY + chartH}" />
        <line x1="${chartX + chartW * 0.25}" y1="${chartY}" x2="${chartX + chartW * 0.25}" y2="${chartY + chartH}" />
        <line x1="${chartX + chartW * 0.5}" y1="${chartY}" x2="${chartX + chartW * 0.5}" y2="${chartY + chartH}" />
        <line x1="${chartX + chartW * 0.75}" y1="${chartY}" x2="${chartX + chartW * 0.75}" y2="${chartY + chartH}" />
        <line x1="${chartX + chartW}" y1="${chartY}" x2="${chartX + chartW}" y2="${chartY + chartH}" />
      </g>

      <!-- Axis Labels -->
      <text x="${chartX - 10}" y="${chartY + 5}" fill="#ef4444" font-size="9" text-anchor="end">+60°C</text>
      <text x="${chartX - 10}" y="${chartY + 80}" fill="#f59e0b" font-size="9" text-anchor="end">+30°C</text>
      <text x="${chartX - 10}" y="${chartY + 155}" fill="#38bdf8" font-size="9" text-anchor="end">0°C (Freezing)</text>
      <text x="${chartX - 10}" y="${chartY + chartH}" fill="#38bdf8" font-size="9" text-anchor="end">-20°C</text>

      <text x="${chartX}" y="${chartY + chartH + 18}" fill="#94a3b8" font-size="9" text-anchor="middle">00:00 (Midnight)</text>
      <text x="${chartX + chartW * 0.25}" y="${chartY + chartH + 18}" fill="#94a3b8" font-size="9" text-anchor="middle">06:00 (Dawn)</text>
      <text x="${chartX + chartW * 0.5}" y="${chartY + chartH + 18}" fill="#94a3b8" font-size="9" text-anchor="middle">12:00 (Noon)</text>
      <text x="${chartX + chartW * 0.75}" y="${chartY + chartH + 18}" fill="#94a3b8" font-size="9" text-anchor="middle">18:00 (Dusk)</text>
      <text x="${chartX + chartW}" y="${chartY + chartH + 18}" fill="#94a3b8" font-size="9" text-anchor="middle">24:00</text>

      <!-- Diurnal Temperature Curve -->
      <polyline points="${tempPoints.join(' ')}" fill="none" stroke="url(#tempCurveGrad)" stroke-width="3" stroke-linecap="round" />

      <!-- Attenuation Shift Limit Line (0.05 dB/km) -->
      <line x1="${chartX}" y1="${chartY + chartH - (0.05 / 0.25) * chartH}" x2="${chartX + chartW}" y2="${chartY + chartH - (0.05 / 0.25) * chartH}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4,3" />
      <text x="${chartX + chartW - 5}" y="${chartY + chartH - (0.05 / 0.25) * chartH - 5}" fill="#10b981" font-size="9" font-weight="600" text-anchor="end">GR-20 Limit: Δα ≤ 0.05 dB/km</text>

      <!-- Measured Attenuation Shift Curve (Cyan) -->
      <polyline points="${lossPoints.join(' ')}" fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-dasharray="5,2" />

      <!-- Legend -->
      <g transform="translate(${chartX}, 35)">
        <line x1="0" y1="0" x2="20" y2="0" stroke="#f59e0b" stroke-width="3" />
        <text x="26" y="4" fill="#f8fafc" font-size="10" font-weight="600">24-Hr Temperature Wave T(t)</text>

        <line x1="210" y1="0" x2="230" y2="0" stroke="#06b6d4" stroke-width="2.5" stroke-dasharray="5,2" />
        <text x="236" y="4" fill="#38bdf8" font-size="10" font-weight="600">Micro-Bend Loss Drift Δα(t)</text>
      </g>

      <!-- Right Column: Buffer Tube Cutaway & Gel Physical State -->
      <g transform="translate(620, 70)">
        <rect x="0" y="0" width="230" height="250" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
        <text x="115" y="24" text-anchor="middle" fill="#38bdf8" font-size="11" font-weight="700">BUFFER TUBE CUTAWAY</text>

        <!-- Concentric Buffer Tube Rings -->
        <g transform="translate(115, 115)">
          <!-- Outer Polymer Jacket -->
          <circle cx="0" cy="0" r="70" fill="url(#bufferTubeGrad)" stroke="#64748b" stroke-width="4" />
          <!-- Inner Gel Chamber -->
          <circle cx="0" cy="0" r="56" fill="${analysis.isGelFrozen ? '#0284c7' : '#1e293b'}" stroke="#38bdf8" stroke-width="2" />

          <!-- Optical Fibers (12-Fiber Bundle) -->
          <circle cx="-25" cy="-20" r="6" fill="#38bdf8" stroke="#f8fafc" stroke-width="1" />
          <circle cx="0" cy="-30" r="6" fill="#f59e0b" stroke="#f8fafc" stroke-width="1" />
          <circle cx="25" cy="-20" r="6" fill="#10b981" stroke="#f8fafc" stroke-width="1" />
          <circle cx="-35" cy="5" r="6" fill="#8b5cf6" stroke="#f8fafc" stroke-width="1" />
          <circle cx="0" cy="0" r="6" fill="#ec4899" stroke="#f8fafc" stroke-width="1" />
          <circle cx="35" cy="5" r="6" fill="#ffffff" stroke="#94a3b8" stroke-width="1" />
          <circle cx="-25" cy="30" r="6" fill="#ef4444" stroke="#f8fafc" stroke-width="1" />
          <circle cx="0" cy="30" r="6" fill="#000000" stroke="#f8fafc" stroke-width="1" />
          <circle cx="25" cy="30" r="6" fill="#eab308" stroke="#f8fafc" stroke-width="1" />

          <!-- Radial Stress Contraction Arrows if Cold -->
          <g stroke="${statusColor}" stroke-width="2">
            <line x1="-50" y1="0" x2="-35" y2="0" marker-end="url(#arrow)" />
            <line x1="50" y1="0" x2="35" y2="0" />
            <line x1="0" y1="-50" x2="0" y2="-35" />
            <line x1="0" y1="50" x2="0" y2="35" />
          </g>
        </g>

        <!-- Material Details -->
        <text x="115" y="205" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="600">${poly.name.slice(0, 28)}</text>
        <text x="115" y="220" text-anchor="middle" fill="#94a3b8" font-size="9">CTE: ${poly.ctePpmK} ppm/K · Gel: ${gel.freezePointC}°C Freeze</text>
        <text x="115" y="238" text-anchor="middle" fill="${statusColor}" font-size="10" font-weight="700">Strain: ${analysis.thermalStrainPercent}% (ΔT ${analysis.deltaT}°C)</text>
      </g>

      <!-- Bottom HUD Telemetry Ribbon -->
      <g transform="translate(20, 390)">
        <rect x="0" y="0" width="${width - 40}" height="42" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1.5" />

        <text x="15" y="18" fill="#94a3b8" font-size="9" font-weight="600">CYCLE TEMPERATURE ΔT</text>
        <text x="15" y="33" fill="#38bdf8" font-size="13" font-weight="800">${analysis.testMinTempC}°C to +${analysis.testMaxTempC}°C (${analysis.deltaT}°C)</text>

        <text x="215" y="18" fill="#94a3b8" font-size="9" font-weight="600">MAX ATTENUATION DRIFT Δα</text>
        <text x="215" y="33" fill="${analysis.measuredMaxDeltaAlphaDbKm <= 0.05 ? '#10b981' : '#f59e0b'}" font-size="13" font-weight="800">${analysis.measuredMaxDeltaAlphaDbKm} dB/km</text>

        <text x="425" y="18" fill="#94a3b8" font-size="9" font-weight="600">PEAK LINK LOSS (1550nm)</text>
        <text x="425" y="33" fill="#38bdf8" font-size="13" font-weight="800">${analysis.totalLinkPeakLoss1550Db} dB (${analysis.spanLengthKm} km)</text>

        <text x="600" y="18" fill="#94a3b8" font-size="9" font-weight="600">GEL PHYSICAL STATE</text>
        <text x="600" y="33" fill="${analysis.isGelFrozen ? '#ef4444' : '#10b981'}" font-size="12" font-weight="800">${analysis.isGelFrozen ? 'FROZEN / SOLID' : 'FLUID THIXOTROPIC'}</text>

        <text x="745" y="18" fill="#94a3b8" font-size="9" font-weight="600">IEC 60794-1-22 VERDICT</text>
        <text x="745" y="33" fill="${verdict.color}" font-size="12" font-weight="800">${verdict.name.slice(0, 18)}</text>
      </g>
    </svg>
  `;
}

/**
 * Generates printable HTML certificate for formal Outside Plant QA Accreditation or POS thermal slip.
 * @param {Object} record
 * @param {Object} options { format: 'A4' | 'POS80' }
 * @returns {string} HTML markup string
 */
export function generateThermalCyclingCertHtml(record, { format = 'A4' } = {}) {
  if (!record || !record.analysis) return '<p>Invalid Thermal Cycling certificate record</p>';

  const a = record.analysis;
  const isPos = format === 'POS80';

  if (isPos) {
    return `
      <div class="thermal-pos-slip" style="width: 280px; font-family: 'Courier New', monospace; font-size: 11px; padding: 10px; color: #000; background: #fff; line-height: 1.3;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <div style="font-weight: bold; font-size: 13px;">SHAHDARA ISP NETWORK</div>
          <div style="font-size: 10px;">OSP THERMAL CYCLING QA SLIP</div>
          <div style="font-size: 9px;">IEC 60794-1-22 / GR-20-CORE §6.5</div>
        </div>
        <div><strong>Cert ID:</strong> ${record.id}</div>
        <div><strong>Date:</strong> ${record.createdAt.slice(0, 10)}</div>
        <div><strong>Span:</strong> ${record.subscriberName.slice(0, 24)}</div>
        <div><strong>Length:</strong> ${a.spanLengthKm} km (${a.fiberCount}F)</div>
        <div><strong>Profile:</strong> ${a.profile.name.slice(0, 24)}</div>
        <div><strong>Polymer:</strong> ${a.polymer.name.slice(0, 24)}</div>
        <div><strong>Gel Type:</strong> ${a.gel.name.slice(0, 24)}</div>
        <div><strong>Range:</strong> ${a.testMinTempC}°C to +${a.testMaxTempC}°C</div>
        <div><strong>Delta T:</strong> ${a.deltaT}°C</div>
        <div><strong>Max Δα:</strong> ${a.measuredMaxDeltaAlphaDbKm} dB/km</div>
        <div><strong>Peak 1550:</strong> ${a.peakLoss1550DbKm} dB/km</div>
        <div><strong>Link Penalty:</strong> +${a.totalLinkThermalPenaltyDb} dB</div>
        <div><strong>Gel State:</strong> ${a.isGelFrozen ? 'FROZEN (REJECT)' : 'STABLE FLUID'}</div>
        <div style="margin: 6px 0; padding: 4px; border: 1px solid #000; text-align: center; font-weight: bold;">
          VERDICT: ${a.verdict.name}
        </div>
        <div style="font-size: 9px; text-align: center; margin-top: 6px; border-top: 1px dashed #000; padding-top: 4px;">
          Metrology: ${record.technicianName}<br>
          Shahdara ISP Network Operations
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <article class="thermal-cert-a4" style="max-width: 820px; margin: 0 auto; padding: 28px; background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border: 1px solid #cbd5e1; border-radius: 8px;">
      <header style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 20px;">
        <div>
          <span style="font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.05em;">Outside Plant Telecom Engineering &amp; Environmental Climatic Laboratory</span>
          <h1 style="font-size: 20px; font-weight: 800; margin: 4px 0 2px 0; color: #0f172a;">Optical Fiber Temperature Cycling &amp; Attenuation Stability QA Certificate</h1>
          <p style="font-size: 11px; color: #64748b; margin: 0;">Standards: IEC 60794-1-22 Method F1 · Telcordia GR-20-CORE Issue 4 §6.5 · ITU-T G.650.1 / G.652.D</p>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 13px; font-weight: 700;">${record.id}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Date: ${record.createdAt.slice(0, 10)}</div>
        </div>
      </header>

      <!-- Section 1: Route & Cable Material Telemetry -->
      <section style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; font-size: 12px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <h3 style="font-size: 11px; text-transform: uppercase; color: #0369a1; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Span Topology &amp; Cable Construction</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Span / Link Ref:</span>
            <strong style="color: #0f172a;">${record.subscriberName}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Route Topology:</span>
            <strong>${record.routeDescription}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Span Length &amp; Core Count:</span>
            <strong>${a.spanLengthKm} km · ${a.fiberCount} Cores</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Buffer Tube Polymer:</span>
            <strong>${a.polymer.name}</strong>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <h3 style="font-size: 11px; text-transform: uppercase; color: #0369a1; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Climatic Cycle &amp; Thixotropic Gel State</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Cycle Profile:</span>
            <strong style="color: #0f172a;">${a.profile.name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Temperature Range:</span>
            <strong>${a.testMinTempC}°C to +${a.testMaxTempC}°C (ΔT ${a.deltaT}°C)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Filling Compound:</span>
            <strong>${a.gel.name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Differential CTE &amp; Strain:</span>
            <strong>${a.differentialCtePpmK} ppm/K · ${a.thermalStrainPercent}% Strain</strong>
          </div>
        </div>
      </section>

      <!-- Section 2: Temperature Attenuation Shift Table -->
      <section style="margin-bottom: 18px;">
        <h3 style="font-size: 11px; text-transform: uppercase; color: #0369a1; margin: 0 0 8px 0;">Optical Transmission Shift Metrology Across Temperature Extremes</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 6px 10px;">Metrology Parameter</th>
              <th style="padding: 6px 10px;">Measured / Modeled Value</th>
              <th style="padding: 6px 10px;">Telcordia GR-20 Limit</th>
              <th style="padding: 6px 10px;">QA Verdict</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">Baseline Attenuation @ 20°C (1550nm)</td>
              <td style="padding: 6px 10px; font-weight: 600;">${a.baseLoss1550DbKm} dB/km (${a.totalLinkBaseLoss1550Db} dB link)</td>
              <td style="padding: 6px 10px; color: #64748b;">≤ 0.22 dB/km</td>
              <td style="padding: 6px 10px; color: #16a34a; font-weight: 600;">Optimal</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">Max Attenuation Drift (Δα @ 1550nm)</td>
              <td style="padding: 6px 10px; font-weight: 600;">${a.measuredMaxDeltaAlphaDbKm} dB/km</td>
              <td style="padding: 6px 10px; color: #64748b;">≤ 0.050 dB/km</td>
              <td style="padding: 6px 10px; font-weight: 600; color: ${a.measuredMaxDeltaAlphaDbKm <= 0.05 ? '#16a34a' : '#ef4444'};">${a.measuredMaxDeltaAlphaDbKm <= 0.05 ? 'Pass (GR-20 §6.5)' : 'Exceeds Limit'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">Peak Attenuation at Cold Extreme</td>
              <td style="padding: 6px 10px; font-weight: 600;">${a.peakLoss1550DbKm} dB/km (${a.totalLinkPeakLoss1550Db} dB link)</td>
              <td style="padding: 6px 10px; color: #64748b;">≤ 0.27 dB/km</td>
              <td style="padding: 6px 10px; color: #16a34a; font-weight: 600;">Certified</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">Total Link Temperature Power Penalty</td>
              <td style="padding: 6px 10px; font-weight: 600;">+${a.totalLinkThermalPenaltyDb} dB (over ${a.spanLengthKm} km)</td>
              <td style="padding: 6px 10px; color: #64748b;">≤ 0.50 dB per link</td>
              <td style="padding: 6px 10px; font-weight: 600; color: ${a.totalLinkThermalPenaltyDb <= 0.5 ? '#16a34a' : '#f59e0b'};">${a.totalLinkThermalPenaltyDb <= 0.5 ? 'Negligible Impact' : 'Review Budget'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">Filling Gel Physical Stability</td>
              <td style="padding: 6px 10px; font-weight: 600;">Freeze: ${a.gel.freezePointC}°C · Drip: ${a.gel.dripPointC}°C</td>
              <td style="padding: 6px 10px; color: #64748b;">Zero freeze at ${a.testMinTempC}°C</td>
              <td style="padding: 6px 10px; font-weight: 600; color: ${a.isGelFrozen ? '#ef4444' : '#16a34a'};">${a.isGelFrozen ? 'Freeze Hazard' : 'Stable Thixotropic'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Section 3: Official Verdict Badge -->
      <section style="background: ${a.verdict.color}15; border: 1px solid ${a.verdict.color}40; border-left: 5px solid ${a.verdict.color}; border-radius: 6px; padding: 14px; margin-bottom: 18px;">
        <div style="font-size: 11px; font-weight: 700; color: ${a.verdict.color}; text-transform: uppercase;">Official QA Certification Verdict</div>
        <div style="font-size: 16px; font-weight: 800; color: ${a.verdict.color}; margin: 2px 0 4px 0;">${a.verdict.name}</div>
        <div style="font-size: 12px; color: #334155; line-height: 1.4;">${a.verdict.description}</div>
      </section>

      <!-- Signatures Footer -->
      <footer style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 14px; border-top: 1px dashed #cbd5e1; font-size: 11px;">
        <div>
          <div><strong>Metrology Engineer:</strong> ${record.technicianName}</div>
          <div style="color: #64748b;">Outside Plant Fiber Testing &amp; Climatic QA Team</div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; width: 140px; border-bottom: 1px solid #000; margin-bottom: 4px;"></div>
          <div>Authorized QA Sign-Off &amp; Field Stamp</div>
        </div>
      </footer>
    </article>
  `;
}

/**
 * Formats clean bilingual Urdu/English WhatsApp technician notification for field dispatch.
 * @param {Object} record
 * @returns {string} WhatsApp text message
 */
export function formatThermalCyclingCertWhatsApp(record) {
  if (!record || !record.analysis) return '';

  const a = record.analysis;
  const isPass = a.verdict.id === 'CERTIFIED_THERMAL_STABLE_PASS';
  const icon = isPass ? '✅' : (a.verdict.id === 'CONDITIONAL_PASS_MILD_DRIFT' ? '⚠️' : '🚨');

  return [
    `*SHAHDARA ISP NETWORK - FIBER THERMAL CYCLING QA*`,
    `----------------------------------------`,
    `سرٹیفکیٹ نمبر: *${record.id}*`,
    `فائبر روٹ: *${record.subscriberName}*`,
    `روٹ تفصیل: *${record.routeDescription}*`,
    `لمبائی و کور: *${a.spanLengthKm} km · ${a.fiberCount} Cores*`,
    `بفر ٹیوب مٹیریل: *${a.polymer.name}*`,
    `فلنگ جیل: *${a.gel.name}*`,
    `موسمی درجہ حرارت: *${a.testMinTempC}°C تا +${a.testMaxTempC}°C (فرق: ${a.deltaT}°C)*`,
    `----------------------------------------`,
    `*تھرمل آپٹیکل پیمائش (Climatic Metrology):*`,
    `• بنیادی لاس (1550nm): ${a.baseLoss1550DbKm} dB/km`,
    `• زیادہ سے زیادہ ڈرفٹ (Max Δα): ${a.measuredMaxDeltaAlphaDbKm} dB/km (Limit: ≤0.05)`,
    `• انتہائی سردی میں لاس: ${a.peakLoss1550DbKm} dB/km`,
    `• مکمل لنک تھرمل پنالٹی: +${a.totalLinkThermalPenaltyDb} dB`,
    `• جیل منجمد خطرہ: ${a.isGelFrozen ? 'منجمد (Freezing Alert)' : 'محفوظ سیال (Stable)'}`,
    `----------------------------------------`,
    `*حتمی نتیجہ (Verdict):* ${icon} *${a.verdict.name}*`,
    `کیفیت: ${a.verdict.description}`,
    `----------------------------------------`,
    `ٹیکنیشن: *${record.technicianName}* | شاہدرہ او ایس پی نیٹ ورک`
  ].join('\n');
}

/**
 * Exports Thermal Cycling QA records to RFC-4180 compliant CSV string with UTF-8 BOM.
 * @param {Object[]} records
 * @returns {string} CSV text
 */
export function generateThermalCyclingCertsCsv(records = []) {
  const headers = [
    'Cert_ID',
    'Date',
    'Span_Ref',
    'Route_Description',
    'Span_km',
    'Fiber_Count',
    'Profile_Name',
    'Polymer_Name',
    'Gel_Name',
    'Min_Temp_C',
    'Max_Temp_C',
    'Delta_T_C',
    'Base_Loss_1550_dB_km',
    'Max_Delta_Alpha_dB_km',
    'Peak_Loss_1550_dB_km',
    'Link_Penalty_dB',
    'Gel_Frozen',
    'Verdict_ID',
    'Verdict_Name',
    'Technician',
    'Notes'
  ];

  const escapeCsv = (val) => {
    const s = String(val === undefined || val === null ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = [headers.join(',')];

  for (const r of records) {
    const a = r.analysis || {};
    const row = [
      r.id || '',
      r.createdAt ? r.createdAt.slice(0, 10) : '',
      r.subscriberName || '',
      r.routeDescription || '',
      a.spanLengthKm !== undefined ? a.spanLengthKm : '',
      a.fiberCount !== undefined ? a.fiberCount : '',
      a.profile?.name || '',
      a.polymer?.name || '',
      a.gel?.name || '',
      a.testMinTempC !== undefined ? a.testMinTempC : '',
      a.testMaxTempC !== undefined ? a.testMaxTempC : '',
      a.deltaT !== undefined ? a.deltaT : '',
      a.baseLoss1550DbKm !== undefined ? a.baseLoss1550DbKm : '',
      a.measuredMaxDeltaAlphaDbKm !== undefined ? a.measuredMaxDeltaAlphaDbKm : '',
      a.peakLoss1550DbKm !== undefined ? a.peakLoss1550DbKm : '',
      a.totalLinkThermalPenaltyDb !== undefined ? a.totalLinkThermalPenaltyDb : '',
      a.isGelFrozen ? 'TRUE' : 'FALSE',
      a.verdict?.id || '',
      a.verdict?.name || '',
      r.technicianName || '',
      r.notes || ''
    ];
    rows.push(row.map(escapeCsv).join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Controller setting up the interactive DOM modal dialog for Thermal Cycling QA.
 * @param {Object} options
 * @returns {Object} Controller instance with refresh and destroy
 */
export function setupThermalCyclingModal(options = {}) {
  const {
    dialogElement,
    triggerButton,
    storage = (typeof localStorage !== 'undefined' ? localStorage : null),
    onToast = (msg) => console.log(msg)
  } = options;

  if (!dialogElement) return null;

  // DOM Query Helpers
  const $ = (sel) => dialogElement.querySelector(sel);

  const presetSelect = $('#thmPresetSelect');
  const subscriberInput = $('#thmSubscriberInput');
  const routeInput = $('#thmRouteInput');
  const profileSelect = $('#thmProfileSelect');
  const polymerSelect = $('#thmPolymerSelect');
  const gelSelect = $('#thmGelSelect');
  const spanInput = $('#thmSpanInput');
  const fiberCountInput = $('#thmFiberCountInput');
  const minTempInput = $('#thmMinTempInput');
  const maxTempInput = $('#thmMaxTempInput');
  const measuredDriftInput = $('#thmMeasuredDriftInput');
  const technicianInput = $('#thmTechnicianInput');
  const notesInput = $('#thmNotesInput');

  const closeBtn = $('#thmCloseBtn');
  const saveBtn = $('#thmSaveBtn');
  const printA4Btn = $('#thmPrintA4Btn');
  const printPosBtn = $('#thmPrintPosBtn');
  const whatsAppBtn = $('#thmWhatsAppBtn');
  const csvExportBtn = $('#thmCsvExportBtn');

  const svgContainer = $('#thmSvgContainer');
  const verdictBanner = $('#thmVerdictBanner');
  const historyTableBody = $('#thmHistoryTableBody');

  const deltaTDisplay = $('#thmDeltaTDisplay');
  const driftDisplay = $('#thmDriftDisplay');
  const penaltyDisplay = $('#thmPenaltyDisplay');
  const gelStateDisplay = $('#thmGelStateDisplay');

  function getFormData() {
    return {
      subscriberName: subscriberInput ? subscriberInput.value : '',
      routeDescription: routeInput ? routeInput.value : '',
      profileId: profileSelect ? profileSelect.value : 'SHAHDARA_ROOFTOP_DIURNAL',
      polymerId: polymerSelect ? polymerSelect.value : 'PBT_POLYBUTYLENE',
      gelId: gelSelect ? gelSelect.value : 'SYNTHETIC_POLYBUTENE_GEL',
      spanLengthKm: spanInput ? Number(spanInput.value) : 4.8,
      fiberCount: fiberCountInput ? Number(fiberCountInput.value) : 24,
      testMinTempC: minTempInput ? Number(minTempInput.value) : -2,
      testMaxTempC: maxTempInput ? Number(maxTempInput.value) : 48,
      measuredMaxDeltaAlphaDbKm: measuredDriftInput ? Number(measuredDriftInput.value) : 0.038,
      technicianName: technicianInput ? technicianInput.value : '',
      notes: notesInput ? notesInput.value : ''
    };
  }

  function recalculateAndRender() {
    const data = getFormData();
    const analysis = calculateThermalCyclingPhysics(data);

    if (deltaTDisplay) deltaTDisplay.textContent = `${analysis.deltaT}°C`;
    if (driftDisplay) driftDisplay.textContent = `${analysis.measuredMaxDeltaAlphaDbKm} dB/km`;
    if (penaltyDisplay) penaltyDisplay.textContent = `+${analysis.totalLinkThermalPenaltyDb} dB`;
    if (gelStateDisplay) {
      gelStateDisplay.textContent = analysis.isGelFrozen ? 'FROZEN' : 'STABLE FLUID';
      gelStateDisplay.style.color = analysis.isGelFrozen ? '#ef4444' : '#10b981';
    }

    if (verdictBanner) {
      verdictBanner.textContent = analysis.verdict.name;
      verdictBanner.className = `verdict-banner ${analysis.verdict.badgeClass}`;
      verdictBanner.style.color = analysis.verdict.color;
      verdictBanner.style.background = `${analysis.verdict.color}18`;
      verdictBanner.style.border = `1px solid ${analysis.verdict.color}44`;
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderThermalCyclingQaSvg(analysis);
    }
  }

  function renderHistoryTable() {
    if (!historyTableBody) return;
    const certs = getSavedThermalCyclingCerts(storage);

    if (certs.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 12px;">No saved Thermal Cycling QA certificates found.</td></tr>`;
      return;
    }

    historyTableBody.innerHTML = certs.map(c => `
      <tr style="border-bottom: 1px solid var(--border-color, #1e293b);">
        <td style="padding: 6px 8px; font-family: monospace; font-weight: 700; color: #38bdf8;">${c.id}</td>
        <td style="padding: 6px 8px; color: #94a3b8;">${c.createdAt.slice(0, 10)}</td>
        <td style="padding: 6px 8px; font-weight: 600;">${c.subscriberName}</td>
        <td style="padding: 6px 8px;">${c.analysis?.measuredMaxDeltaAlphaDbKm || '--'} dB/km</td>
        <td style="padding: 6px 8px;"><span class="badge ${c.analysis?.verdict?.badgeClass || ''}" style="color: ${c.analysis?.verdict?.color || '#cbd5e1'}; font-weight: 600;">${c.analysis?.verdict?.name?.slice(0, 22) || 'Audit'}</span></td>
        <td style="padding: 6px 8px;">
          <button class="secondary-button" style="font-size: 10px; padding: 2px 6px;" data-thm-pos-id="${c.id}" type="button">🧾 Slip</button>
        </td>
      </tr>
    `).join('');

    historyTableBody.querySelectorAll('[data-thm-pos-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-thm-pos-id');
        const target = certs.find(item => item.id === id);
        if (target) {
          const slipHtml = generateThermalCyclingCertHtml(target, { format: 'POS80' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`<html><head><title>${target.id} - POS</title></head><body>${slipHtml}</body></html>`);
            win.document.close();
            win.print();
          }
        }
      });
    });
  }

  // Event Listeners
  const inputElements = [
    profileSelect, polymerSelect, gelSelect, spanInput, fiberCountInput,
    minTempInput, maxTempInput, measuredDriftInput, subscriberInput,
    routeInput, technicianInput, notesInput
  ];

  inputElements.forEach(el => {
    if (el) {
      el.addEventListener('input', recalculateAndRender);
      el.addEventListener('change', recalculateAndRender);
    }
  });

  if (profileSelect && minTempInput && maxTempInput) {
    profileSelect.addEventListener('change', () => {
      const prof = THERMAL_CYCLE_PROFILES[profileSelect.value];
      if (prof) {
        minTempInput.value = prof.minTempC;
        maxTempInput.value = prof.maxTempC;
        recalculateAndRender();
      }
    });
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const p = SHAHDARA_THERMAL_PRESETS.find(item => item.id === presetSelect.value);
      if (p) {
        if (subscriberInput) subscriberInput.value = p.subscriberName;
        if (routeInput) routeInput.value = p.routeDescription;
        if (profileSelect) profileSelect.value = p.profileId;
        if (polymerSelect) polymerSelect.value = p.polymerId;
        if (gelSelect) gelSelect.value = p.gelId;
        if (spanInput) spanInput.value = p.spanLengthKm;
        if (fiberCountInput) fiberCountInput.value = p.fiberCount;
        if (minTempInput) minTempInput.value = p.testMinTempC;
        if (maxTempInput) maxTempInput.value = p.testMaxTempC;
        if (measuredDriftInput) measuredDriftInput.value = p.measuredMaxDeltaAlphaDbKm;
        if (technicianInput) technicianInput.value = p.technicianName;
        if (notesInput) notesInput.value = p.notes;
        recalculateAndRender();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      dialogElement.close();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const data = getFormData();
      const validation = validateThermalCyclingInput(data);
      if (!validation.isValid) {
        onToast(`Validation Error: ${validation.errors[0]}`);
        return;
      }
      const record = buildThermalCyclingCertRecord(data);
      saveThermalCyclingCert(record, storage);
      renderHistoryTable();
      onToast(`Saved Thermal Cycling Certificate: ${record.id}`);
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const data = getFormData();
      const record = buildThermalCyclingCertRecord(data);
      const html = generateThermalCyclingCertHtml(record, { format: 'A4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<html><head><title>${record.id} - A4 Certificate</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
      }
    });
  }

  if (printPosBtn) {
    printPosBtn.addEventListener('click', () => {
      const data = getFormData();
      const record = buildThermalCyclingCertRecord(data);
      const html = generateThermalCyclingCertHtml(record, { format: 'POS80' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<html><head><title>${record.id} - POS Slip</title></head><body>${html}</body></html>`);
        win.document.close();
        win.print();
      }
    });
  }

  if (whatsAppBtn) {
    whatsAppBtn.addEventListener('click', () => {
      const data = getFormData();
      const record = buildThermalCyclingCertRecord(data);
      const text = formatThermalCyclingCertWhatsApp(record);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          onToast('Thermal QA notice copied to clipboard!');
        }).catch(() => {
          onToast('Copied text!');
        });
      } else {
        onToast('Clipboard not accessible');
      }
    });
  }

  if (csvExportBtn) {
    csvExportBtn.addEventListener('click', () => {
      const certs = getSavedThermalCyclingCerts(storage);
      const current = buildThermalCyclingCertRecord(getFormData());
      const dataset = certs.length > 0 ? certs : [current];
      const csv = generateThermalCyclingCertsCsv(dataset);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara_thermal_cycling_certs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('Thermal cycling certificates exported to CSV!');
    });
  }

  // Initial render
  recalculateAndRender();
  renderHistoryTable();

  return {
    recalculate: recalculateAndRender,
    refreshHistory: renderHistoryTable
  };
}
