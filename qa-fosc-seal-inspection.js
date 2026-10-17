/**
 * Shahdara ISP Billing & Network Operations - Outside Plant Fiber Engineering
 * Fiber Optic Splice Closure (FOSC) Ingress Protection (IP68), Nitrogen Pressurization Pressure Decay & Moisture Seal QA Suite
 * Standards: IEC 60529 (IP68 Submersion), Telcordia GR-771-CORE Issue 2, ITU-T L.400 / L.13, IEC 60794-1-21 Method E1
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const FOSC_SEAL_CERT_STORAGE_KEY = 'shahdara_fosc_seal_certs_v1';

export const FOSC_ENCLOSURE_TYPES = {
  'DOME_FOSC_400_A4': {
    id: 'DOME_FOSC_400_A4',
    name: 'Dome FOSC 400 A4 (4-Round Port + 1-Oval Port)',
    category: 'Dome Underground / Aerial',
    maxFibers: 96,
    roundPorts: 4,
    ovalPorts: 1,
    maxCableDiaMm: 16,
    ratedDepthMeters: 5.0,
    internalAirVolumeLiters: 4.2,
    defaultTestPressureKpa: 70,
    description: 'High-density cylindrical dome enclosure with mechanical clamp collar and gel/heat-shrink base ports.'
  },
  'DOME_FOSC_400_B4': {
    id: 'DOME_FOSC_400_B4',
    name: 'Dome FOSC 400 B4 Feeder Trunk (6-Round Port + 1-Oval Port)',
    category: 'Heavy Backbone Feeder Dome',
    maxFibers: 144,
    roundPorts: 6,
    ovalPorts: 1,
    maxCableDiaMm: 22,
    ratedDepthMeters: 5.0,
    internalAirVolumeLiters: 6.8,
    defaultTestPressureKpa: 70,
    description: 'Expanded capacity feeder dome engineered for multiple mid-span express loops and branch spurs.'
  },
  'INLINE_HORIZONTAL_FOSC': {
    id: 'INLINE_HORIZONTAL_FOSC',
    name: 'Inline Horizontal Clamshell (2-In / 2-Out Flat Profile)',
    category: 'Horizontal Manhole / Handhole',
    maxFibers: 48,
    roundPorts: 4,
    ovalPorts: 0,
    maxCableDiaMm: 18,
    ratedDepthMeters: 3.0,
    internalAirVolumeLiters: 2.9,
    defaultTestPressureKpa: 50,
    description: 'Low-profile clamshell enclosure suited for shallow sidewalk handholes and utility trench vaults.'
  },
  'MICRO_PEDESTAL_FAT': {
    id: 'MICRO_PEDESTAL_FAT',
    name: 'Micro-Pedestal FAT Drop Closure (8-Drop + 2-Express Ports)',
    category: 'Premises Access Terminal',
    maxFibers: 24,
    roundPorts: 10,
    ovalPorts: 0,
    maxCableDiaMm: 12,
    ratedDepthMeters: 2.0,
    internalAirVolumeLiters: 1.5,
    defaultTestPressureKpa: 40,
    description: 'Compact distribution box for subscriber drop breakouts with individual elastomeric grommet seals.'
  },
  'HEAVY_VAULT_METRO_FOSC': {
    id: 'HEAVY_VAULT_METRO_FOSC',
    name: 'Heavy Sub-Surface Vault Metro Closure (8-Round + 2-Oval Ports)',
    category: 'Deep Submersion Vault',
    maxFibers: 288,
    roundPorts: 8,
    ovalPorts: 2,
    maxCableDiaMm: 25,
    ratedDepthMeters: 8.0,
    internalAirVolumeLiters: 9.5,
    defaultTestPressureKpa: 100,
    description: 'Ruggedized reinforced enclosure designed for flooded deep arterial utility manholes and river culverts.'
  }
};

export const SEALING_TECHNOLOGY_TYPES = {
  'HEAT_SHRINK_MASTIC': {
    id: 'HEAT_SHRINK_MASTIC',
    name: 'Heat-Shrink Polyolefin Sleeve with Hot-Melt Adhesive Mastic',
    standard: 'Telcordia GR-771-CORE §5.4.1',
    burstPressureKpa: 150,
    maxReentryCycles: 3,
    degradationPerReentry: 0.12,
    torchActivationRequired: true,
    description: 'Cross-linked heat-recoverable sleeve with internal mastic sealant; exceptional hermetic seal but limited field re-entry.'
  },
  'MECHANICAL_GROMMET_EPDM': {
    id: 'MECHANICAL_GROMMET_EPDM',
    name: 'Mechanical Compression EPDM Elastomeric Rubber Grommet',
    standard: 'IEC 60529 IP68 / GR-771 §5.4.2',
    burstPressureKpa: 100,
    maxReentryCycles: 15,
    degradationPerReentry: 0.03,
    torchActivationRequired: false,
    description: 'Cold-applied compression screw plug with EPDM elastomer; rapid installation and re-enterable.'
  },
  'COLD_SILICONE_GEL_BLOCK': {
    id: 'COLD_SILICONE_GEL_BLOCK',
    name: 'Cold-Applied High-Tack Silicone Gel Block Re-Enterable Seal',
    standard: 'Telcordia GR-771 §5.4.3',
    burstPressureKpa: 120,
    maxReentryCycles: 25,
    degradationPerReentry: 0.015,
    torchActivationRequired: false,
    description: 'Pre-cured cross-linked silicone polymer block under constant spring compression; excellent re-entry life and zero heat.'
  },
  'DIVIDED_EXPANSION_PLUG': {
    id: 'DIVIDED_EXPANSION_PLUG',
    name: 'Multi-Port Divided Mechanical Expansion Compression Plug',
    standard: 'IEC 60529 IP68',
    burstPressureKpa: 85,
    maxReentryCycles: 10,
    degradationPerReentry: 0.05,
    torchActivationRequired: false,
    description: 'Segmented elastomer plug designed for multiple small-diameter customer drop cables sharing a round port.'
  }
};

export const DEPLOYMENT_ENVIRONMENTS = {
  'SUBMERGED_MANHOLE_SUMP': {
    id: 'SUBMERGED_MANHOLE_SUMP',
    name: 'Flooded Road Sump / Canal Culvert (Continuous Submersion)',
    waterHeadMeters: 2.5,
    ambientTempC: 28,
    dynamicSurgeKpa: 3.5,
    riskRating: 'CRITICAL_HIGH',
    description: 'Heavy seasonal waterlogging from Ravi flood plain and urban storm drainage; continuous hydrostatic water head.'
  },
  'AERIAL_POLE_MONSOON_EXPOSED': {
    id: 'AERIAL_POLE_MONSOON_EXPOSED',
    name: 'Aerial Utility Pole (Monsoon Wind-Driven Rain & Solar UV)',
    waterHeadMeters: 0.0,
    ambientTempC: 44,
    dynamicSurgeKpa: 1.2,
    riskRating: 'MODERATE_THERMAL',
    description: 'Extreme diurnal thermal swings (-2°C winter to +48°C summer), intense UV degradation, and horizontal monsoon gusts.'
  },
  'DIRECT_BURIED_ALLUVIAL_SOIL': {
    id: 'DIRECT_BURIED_ALLUVIAL_SOIL',
    name: 'Direct-Buried Silt Handhole (High Groundwater Table)',
    waterHeadMeters: 1.2,
    ambientTempC: 25,
    dynamicSurgeKpa: 1.8,
    riskRating: 'MODERATE',
    description: 'Silty loam soil with seasonal water table rise, soil compressive overburden, and clay slurry ingress risk.'
  },
  'INDOOR_DRY_TELECOM_ROOM': {
    id: 'INDOOR_DRY_TELECOM_ROOM',
    name: 'Basement Building Demarcation / Dry Vault',
    waterHeadMeters: 0.0,
    ambientTempC: 22,
    dynamicSurgeKpa: 0.0,
    riskRating: 'NEGLIGIBLE',
    description: 'Clean protected indoor environment with ambient humidity control; minimal water exposure.'
  }
};

export const PORT_CLAMPING_CABLE_TYPES = {
  'FEEDER_ARMORED_CST': {
    id: 'FEEDER_ARMORED_CST',
    name: 'Corrugated Steel Tape Armored 24F/48F Cable',
    cableDiaMm: 11.5,
    requiredRetentionN: 500,
    cableCategory: 'Trunk Feeder'
  },
  'DIELECTRIC_ROUND_DROP': {
    id: 'DIELECTRIC_ROUND_DROP',
    name: 'All-Dielectric Round Access Cable 4F/8F',
    cableDiaMm: 6.0,
    requiredRetentionN: 150,
    cableCategory: 'Distribution'
  },
  'FLAT_BUTTERFLY_DROP': {
    id: 'FLAT_BUTTERFLY_DROP',
    name: '2-Core Butterfly Flat Drop with FRP Members',
    cableDiaMm: 3.0,
    requiredRetentionN: 80,
    cableCategory: 'Subscriber Drop'
  },
  'FIGURE8_STEEL_MESSENGER': {
    id: 'FIGURE8_STEEL_MESSENGER',
    name: 'Figure-8 Aerial Messenger Cable with 1.2mm Steel Strand',
    cableDiaMm: 7.5,
    requiredRetentionN: 400,
    cableCategory: 'Aerial Distribution'
  }
};

export const FOSC_QA_VERDICTS = {
  'CERTIFIED_IP68_HERMETIC_PASS': {
    id: 'CERTIFIED_IP68_HERMETIC_PASS',
    name: 'Certified IP68 Hermetic Sealed & Mechanically Anchored',
    badgeClass: 'badge-success',
    color: '#16a34a',
    description: 'Pneumatic decay ≤ 0.065 kPa/hr (≤ 1.5 kPa/24hr), external submersion margin ≥ 40 kPa, cable retention safety factor ≥ 1.25. Fully approved for underground flooded vaults.'
  },
  'CONDITIONAL_PASS_AERIAL_ONLY': {
    id: 'CONDITIONAL_PASS_AERIAL_ONLY',
    name: 'Conditional Pass (Overhead Pole Only / Restricted from Submerged Sump)',
    badgeClass: 'badge-warning',
    color: '#f59e0b',
    description: 'Pneumatic decay between 0.066 and 0.25 kPa/hr. Safe against wind-driven precipitation on poles, but prohibited from waterlogged sumps.'
  },
  'FAILED_SEAL_BREACH_HAZARD': {
    id: 'FAILED_SEAL_BREACH_HAZARD',
    name: 'Failed: Pneumatic Seal Breach or Port Clamp Slippage Hazard',
    badgeClass: 'badge-danger',
    color: '#dc2626',
    description: 'Pneumatic decay > 0.25 kPa/hr or cable clamp safety factor < 1.0. Critical ingress risk: immediate seal teardown, re-torquing, or replacement required.'
  }
};

export const SHAHDARA_FOSC_PRESETS = [
  {
    id: 'BARADARI_CANAL_CULVERT_DOME',
    name: 'Baradari Canal Culvert Manhole (Dome FOSC 400 B4, Submerged 2.5m)',
    subscriberName: 'Baradari Canal Culvert Feeder Splice #03',
    enclosureTypeId: 'DOME_FOSC_400_B4',
    sealingTechId: 'COLD_SILICONE_GEL_BLOCK',
    environmentId: 'SUBMERGED_MANHOLE_SUMP',
    cableTypeId: 'FEEDER_ARMORED_CST',
    waterHeadMeters: 2.5,
    initialPressureKpa: 70,
    finalPressureKpa: 69.2,
    testDurationHours: 12.0,
    tempInitialC: 26,
    tempFinalC: 25,
    reentryCount: 2,
    measuredClampRetentionN: 680,
    technicianName: 'Farooq Lineman (OSP Team)',
    notes: 'Canal road manhole with seasonal flooding. Gel seal block lubricated and clamped.'
  },
  {
    id: 'VANDALA_ROAD_AERIAL_POLE_FAT',
    name: 'Vandala Road Overhead Pole 14 (Micro-Pedestal FAT Drop Closure)',
    subscriberName: 'Vandala Road Pole 14 Sub-FAT Distribution',
    enclosureTypeId: 'MICRO_PEDESTAL_FAT',
    sealingTechId: 'MECHANICAL_GROMMET_EPDM',
    environmentId: 'AERIAL_POLE_MONSOON_EXPOSED',
    cableTypeId: 'FLAT_BUTTERFLY_DROP',
    waterHeadMeters: 0.0,
    initialPressureKpa: 40,
    finalPressureKpa: 39.5,
    testDurationHours: 4.0,
    tempInitialC: 40,
    tempFinalC: 41,
    reentryCount: 1,
    measuredClampRetentionN: 115,
    technicianName: 'Arslan Ali (Aerial Crew)',
    notes: 'Sun-baked pole mount. EPDM compression plugs torqued to 4.5 Nm with drip loop.'
  },
  {
    id: 'BEGUM_KOT_HIGHWAY_VAULT_METRO',
    name: 'Begum Kot GT Road Siphon Vault (Heavy Vault Metro Closure, 3.2m Head)',
    subscriberName: 'Begum Kot Highway Feeder Junction Vault 01',
    enclosureTypeId: 'HEAVY_VAULT_METRO_FOSC',
    sealingTechId: 'HEAT_SHRINK_MASTIC',
    environmentId: 'SUBMERGED_MANHOLE_SUMP',
    cableTypeId: 'FEEDER_ARMORED_CST',
    waterHeadMeters: 3.2,
    initialPressureKpa: 100,
    finalPressureKpa: 98.8,
    testDurationHours: 24.0,
    tempInitialC: 28,
    tempFinalC: 27,
    reentryCount: 1,
    measuredClampRetentionN: 720,
    technicianName: 'Tariq Mehmood (Senior OSP Lead)',
    notes: 'Deep vault under GT Road storm drain. Heat-shrink sleeves torched with green thermo-paint indicators.'
  },
  {
    id: 'JIA_MUSA_DISTRIBUTION_INLINE',
    name: 'Jia Musa Commercial Handhole (Inline Horizontal Clamshell)',
    subscriberName: 'Jia Musa Bazaar Ring Handhole 05',
    enclosureTypeId: 'INLINE_HORIZONTAL_FOSC',
    sealingTechId: 'DIVIDED_EXPANSION_PLUG',
    environmentId: 'DIRECT_BURIED_ALLUVIAL_SOIL',
    cableTypeId: 'DIELECTRIC_ROUND_DROP',
    waterHeadMeters: 1.0,
    initialPressureKpa: 50,
    finalPressureKpa: 48.5,
    testDurationHours: 6.0,
    tempInitialC: 24,
    tempFinalC: 24,
    reentryCount: 3,
    measuredClampRetentionN: 175,
    technicianName: 'Usman Ghani (Civil Splicer)',
    notes: 'Shallow sidewalk handhole. Silicone grease applied along silicone gasket channel.'
  },
  {
    id: 'RAVI_SIPHON_FEEDER_DOME',
    name: 'Ravi Siphon River Crossing Manhole (Dome FOSC 400 A4, 4.0m Flood Head)',
    subscriberName: 'Ravi Siphon South Embankment Feeder Closure',
    enclosureTypeId: 'DOME_FOSC_400_A4',
    sealingTechId: 'HEAT_SHRINK_MASTIC',
    environmentId: 'SUBMERGED_MANHOLE_SUMP',
    cableTypeId: 'FIGURE8_STEEL_MESSENGER',
    waterHeadMeters: 4.0,
    initialPressureKpa: 70,
    finalPressureKpa: 69.6,
    testDurationHours: 8.0,
    tempInitialC: 29,
    tempFinalC: 29,
    reentryCount: 1,
    measuredClampRetentionN: 540,
    technicianName: 'Zahid Hussain (River Crossing Specialist)',
    notes: 'River floodplain embankment chamber with high silt deposit risk. Nitrogen flash test passed.'
  }
];

/**
 * Calculates pneumatic pressure decay, temperature compensation, hydrostatic ingress margin,
 * and port cable retention safety factor for an Outside Plant FOSC joint closure.
 * @param {Object} params
 * @returns {Object} Comprehensive physics and QA audit analysis
 */
export function calculateFoscSealPhysics(params = {}) {
  const enclosureType = FOSC_ENCLOSURE_TYPES[params.enclosureTypeId] || FOSC_ENCLOSURE_TYPES['DOME_FOSC_400_A4'];
  const sealingTech = SEALING_TECHNOLOGY_TYPES[params.sealingTechId] || SEALING_TECHNOLOGY_TYPES['COLD_SILICONE_GEL_BLOCK'];
  const environment = DEPLOYMENT_ENVIRONMENTS[params.environmentId] || DEPLOYMENT_ENVIRONMENTS['SUBMERGED_MANHOLE_SUMP'];
  const cableType = PORT_CLAMPING_CABLE_TYPES[params.cableTypeId] || PORT_CLAMPING_CABLE_TYPES['FEEDER_ARMORED_CST'];

  const waterHeadMeters = Number(params.waterHeadMeters !== undefined ? params.waterHeadMeters : environment.waterHeadMeters);
  const initialPressureKpa = Math.max(10, Number(params.initialPressureKpa || enclosureType.defaultTestPressureKpa));
  const finalPressureKpa = Math.max(0, Number(params.finalPressureKpa || initialPressureKpa));
  const testDurationHours = Math.max(0.25, Number(params.testDurationHours || 12.0));
  const tempInitialC = Number(params.tempInitialC !== undefined ? params.tempInitialC : 25);
  const tempFinalC = Number(params.tempFinalC !== undefined ? params.tempFinalC : 25);
  const reentryCount = Math.max(1, parseInt(params.reentryCount || 1, 10));
  const measuredClampRetentionN = Math.max(0, Number(params.measuredClampRetentionN || cableType.requiredRetentionN * 1.3));

  // Temperature compensation using Ideal Gas Law P1/T1 = P2/T2 (Kelvin)
  const t0K = tempInitialC + 273.15;
  const t1K = tempFinalC + 273.15;
  const temperatureRatio = t0K / t1K;
  const tempCompensatedFinalPressureKpa = finalPressureKpa * temperatureRatio;

  // True Pressure Decay (compensating for thermal pressure swings)
  const truePressureDecayKpa = Math.max(0, initialPressureKpa - tempCompensatedFinalPressureKpa);
  const rawDecayKpa = Math.max(0, initialPressureKpa - finalPressureKpa);
  const hourlyLeakRateKpaHr = truePressureDecayKpa / testDurationHours;
  const normalized24hDecayKpa = hourlyLeakRateKpaHr * 24.0;

  // Hydrostatic Water Head Pressure: P = rho * g * h
  // rho = 1000 kg/m^3, g = 9.80665 m/s^2 -> 9.80665 kPa per meter of water depth
  const hydrostaticPressureKpa = 9.80665 * waterHeadMeters;
  const dynamicSurgeKpa = environment.dynamicSurgeKpa || 0;
  const totalExternalIngressKpa = hydrostaticPressureKpa + dynamicSurgeKpa;

  // Seal Re-entry Degradation Factor
  const degradationFactor = Math.max(0.4, 1.0 - (reentryCount - 1) * sealingTech.degradationPerReentry);
  const effectiveSealBurstKpa = sealingTech.burstPressureKpa * degradationFactor;

  // Net Ingress Safety Margin (Resistance against floodwater entering closure)
  const netIngressSafetyMarginKpa = effectiveSealBurstKpa - totalExternalIngressKpa;

  // Cable Clamp Retention Safety Factor
  const clampRetentionSafetyFactor = cableType.requiredRetentionN > 0
    ? measuredClampRetentionN / cableType.requiredRetentionN
    : 1.0;

  // Standards Qualification Evaluation
  // Telcordia GR-771 §5.4: 24h pressure decay <= 1.5 kPa (or <= 0.0625 kPa/hr)
  // IEC 60529 IP68: Ingress margin > 40 kPa
  // IEC 60794-1-21 Method E1: Clamp SF >= 1.25
  let verdictKey = 'CERTIFIED_IP68_HERMETIC_PASS';
  if (hourlyLeakRateKpaHr > 0.25 || clampRetentionSafetyFactor < 1.0 || netIngressSafetyMarginKpa < 10) {
    verdictKey = 'FAILED_SEAL_BREACH_HAZARD';
  } else if (hourlyLeakRateKpaHr > 0.065 || netIngressSafetyMarginKpa < 35 || clampRetentionSafetyFactor < 1.2) {
    verdictKey = 'CONDITIONAL_PASS_AERIAL_ONLY';
  }

  const verdict = FOSC_QA_VERDICTS[verdictKey];

  return {
    enclosureType,
    sealingTech,
    environment,
    cableType,
    waterHeadMeters,
    initialPressureKpa,
    finalPressureKpa,
    testDurationHours,
    tempInitialC,
    tempFinalC,
    tempCompensatedFinalPressureKpa: Number(tempCompensatedFinalPressureKpa.toFixed(2)),
    truePressureDecayKpa: Number(truePressureDecayKpa.toFixed(2)),
    rawDecayKpa: Number(rawDecayKpa.toFixed(2)),
    hourlyLeakRateKpaHr: Number(hourlyLeakRateKpaHr.toFixed(4)),
    normalized24hDecayKpa: Number(normalized24hDecayKpa.toFixed(2)),
    hydrostaticPressureKpa: Number(hydrostaticPressureKpa.toFixed(2)),
    totalExternalIngressKpa: Number(totalExternalIngressKpa.toFixed(2)),
    reentryCount,
    degradationFactor: Number(degradationFactor.toFixed(3)),
    effectiveSealBurstKpa: Number(effectiveSealBurstKpa.toFixed(1)),
    netIngressSafetyMarginKpa: Number(netIngressSafetyMarginKpa.toFixed(1)),
    measuredClampRetentionN,
    clampRetentionSafetyFactor: Number(clampRetentionSafetyFactor.toFixed(2)),
    verdict
  };
}

/**
 * Validates input parameters for FOSC Seal QA certification form.
 * @param {Object} input
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateFoscSealInput(input = {}) {
  const errors = [];

  if (!input.subscriberName || !String(input.subscriberName).trim()) {
    errors.push('Subscriber link name or enclosure reference is required.');
  }

  if (input.waterHeadMeters === undefined || isNaN(Number(input.waterHeadMeters)) || Number(input.waterHeadMeters) < 0 || Number(input.waterHeadMeters) > 30) {
    errors.push('Water submersion depth head must be between 0 and 30 meters.');
  }

  if (input.initialPressureKpa === undefined || isNaN(Number(input.initialPressureKpa)) || Number(input.initialPressureKpa) < 10 || Number(input.initialPressureKpa) > 200) {
    errors.push('Initial test pressure must be between 10 and 200 kPa.');
  }

  if (input.finalPressureKpa === undefined || isNaN(Number(input.finalPressureKpa)) || Number(input.finalPressureKpa) < 0 || Number(input.finalPressureKpa) > 200) {
    errors.push('Final test pressure must be between 0 and 200 kPa.');
  }

  if (input.testDurationHours === undefined || isNaN(Number(input.testDurationHours)) || Number(input.testDurationHours) < 0.25 || Number(input.testDurationHours) > 72) {
    errors.push('Pneumatic test duration must be between 0.25 and 72 hours.');
  }

  if (input.measuredClampRetentionN === undefined || isNaN(Number(input.measuredClampRetentionN)) || Number(input.measuredClampRetentionN) < 0 || Number(input.measuredClampRetentionN) > 3000) {
    errors.push('Measured cable clamp retention force must be between 0 and 3,000 N.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Builds a structured FOSC seal QA certificate record.
 * @param {Object} input
 * @returns {Object}
 */
export function buildFoscSealCertRecord(input = {}) {
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const id = input.id || `FOSC-${yearMonth}-${randomSuffix}`;

  const analysis = calculateFoscSealPhysics(input);

  return {
    id,
    createdAt: input.createdAt || now.toISOString(),
    subscriberName: String(input.subscriberName || 'Shahdara Outside Plant Enclosure').trim(),
    routeDescription: String(input.routeDescription || 'Feeder Trunk to Distribution Route').trim(),
    enclosureTypeId: input.enclosureTypeId || 'DOME_FOSC_400_A4',
    sealingTechId: input.sealingTechId || 'COLD_SILICONE_GEL_BLOCK',
    environmentId: input.environmentId || 'SUBMERGED_MANHOLE_SUMP',
    cableTypeId: input.cableTypeId || 'FEEDER_ARMORED_CST',
    waterHeadMeters: analysis.waterHeadMeters,
    initialPressureKpa: analysis.initialPressureKpa,
    finalPressureKpa: analysis.finalPressureKpa,
    testDurationHours: analysis.testDurationHours,
    tempInitialC: analysis.tempInitialC,
    tempFinalC: analysis.tempFinalC,
    reentryCount: analysis.reentryCount,
    measuredClampRetentionN: analysis.measuredClampRetentionN,
    technicianName: String(input.technicianName || 'Shahdara OSP Lineman Crew').trim(),
    notes: String(input.notes || '').trim(),
    status: input.status || 'VERIFIED_AUDIT',
    analysis
  };
}

let inMemoryFoscCerts = [];

/**
 * Retrieves saved FOSC seal QA certificates from storage.
 * @param {Storage} [storage]
 * @returns {Object[]}
 */
export function getSavedFoscSealCerts(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (store) {
    try {
      const raw = store.getItem(FOSC_SEAL_CERT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error('Error reading saved FOSC seal certs:', err);
    }
  }
  return inMemoryFoscCerts;
}

/**
 * Saves a FOSC seal QA certificate record to storage.
 * @param {Object} record
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function saveFoscSealCert(record, storage) {
  if (!record || !record.id) return false;
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const existing = getSavedFoscSealCerts(store);
  const filtered = existing.filter(c => c.id !== record.id);
  filtered.unshift(record);
  const bounded = filtered.slice(0, 100);

  if (store) {
    try {
      store.setItem(FOSC_SEAL_CERT_STORAGE_KEY, JSON.stringify(bounded));
    } catch (err) {
      console.error('Error saving FOSC seal cert:', err);
    }
  }
  inMemoryFoscCerts = bounded;
  return true;
}

/**
 * Updates status of an existing FOSC seal QA certificate.
 * @param {string} certId
 * @param {string} newStatus
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function updateFoscSealCertStatus(certId, newStatus, storage) {
  if (!certId) return false;
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const certs = getSavedFoscSealCerts(store);
  const target = certs.find(c => c.id === certId);
  if (!target) return false;
  target.status = newStatus;

  if (store) {
    try {
      store.setItem(FOSC_SEAL_CERT_STORAGE_KEY, JSON.stringify(certs));
    } catch (err) {
      console.error('Error updating FOSC seal cert status:', err);
    }
  }
  return true;
}

/**
 * Clears all FOSC seal QA certificates from storage.
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function clearFoscSealCerts(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (store) {
    try {
      store.removeItem(FOSC_SEAL_CERT_STORAGE_KEY);
    } catch (err) {
      console.error('Error clearing FOSC seal certs:', err);
    }
  }
  inMemoryFoscCerts = [];
  return true;
}

/**
 * Computes aggregate summary metrics over a collection of FOSC seal QA certificates.
 * @param {Object[]} records
 * @returns {Object}
 */
export function calculateFoscSealMetrics(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      totalCertificates: 0,
      passedCertificates: 0,
      conditionalCertificates: 0,
      failedCertificates: 0,
      passRatePercent: 0,
      avgHourlyLeakRate: 0,
      avgClampSafetyFactor: 0
    };
  }

  let passed = 0;
  let conditional = 0;
  let failed = 0;
  let totalLeakRate = 0;
  let totalClampSf = 0;

  for (const r of records) {
    const verdictId = r.analysis?.verdict?.id;
    if (verdictId === 'CERTIFIED_IP68_HERMETIC_PASS') passed++;
    else if (verdictId === 'CONDITIONAL_PASS_AERIAL_ONLY') conditional++;
    else failed++;

    totalLeakRate += (r.analysis?.hourlyLeakRateKpaHr || 0);
    totalClampSf += (r.analysis?.clampRetentionSafetyFactor || 0);
  }

  const count = records.length;
  const passRatePercent = count > 0 ? Number(((passed / count) * 100).toFixed(1)) : 0;
  const avgHourlyLeakRate = count > 0 ? Number((totalLeakRate / count).toFixed(4)) : 0;
  const avgClampSafetyFactor = count > 0 ? Number((totalClampSf / count).toFixed(2)) : 0;

  return {
    totalCertificates: count,
    passedCertificates: passed,
    conditionalCertificates: conditional,
    failedCertificates: failed,
    passRatePercent,
    avgHourlyLeakRate,
    avgClampSafetyFactor
  };
}

/**
 * Generates pure-vector SVG visualization displaying the FOSC closure cutaway,
 * manometer gauge, waterhead line, and real-time HUD telemetry ribbon.
 * @param {Object} analysis
 * @returns {string} SVG markup string
 */
export function renderFoscSealAnalysisSvg(analysis = {}) {
  const enc = analysis.enclosureType || FOSC_ENCLOSURE_TYPES['DOME_FOSC_400_A4'];
  const tech = analysis.sealingTech || SEALING_TECHNOLOGY_TYPES['COLD_SILICONE_GEL_BLOCK'];
  const env = analysis.environment || DEPLOYMENT_ENVIRONMENTS['SUBMERGED_MANHOLE_SUMP'];
  const verdict = analysis.verdict || FOSC_QA_VERDICTS['CERTIFIED_IP68_HERMETIC_PASS'];

  const width = 880;
  const height = 440;

  // Gauge needle rotation angle (0 to 120 kPa -> -120 deg to +120 deg)
  const pressure = analysis.finalPressureKpa || 0;
  const needleAngle = Math.min(120, Math.max(-120, -120 + (pressure / 120) * 240));

  const isFailed = verdict.id === 'FAILED_SEAL_BREACH_HAZARD';
  const isCond = verdict.id === 'CONDITIONAL_PASS_AERIAL_ONLY';
  const sealColor = isFailed ? '#ef4444' : (isCond ? '#f59e0b' : '#10b981');
  const sealGlow = isFailed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; background: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius: 8px;">
      <defs>
        <linearGradient id="domeBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#1e293b" stop-opacity="0.95" />
          <stop offset="35%" stop-color="#334155" stop-opacity="0.85" />
          <stop offset="70%" stop-color="#1e293b" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.95" />
        </linearGradient>

        <linearGradient id="waterFloodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0284c7" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#0369a1" stop-opacity="0.55" />
        </linearGradient>

        <linearGradient id="gaugeDialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>

        <filter id="sealGlowEffect" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Background Grid -->
      <g stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" opacity="0.6">
        <line x1="0" y1="80" x2="${width}" y2="80" />
        <line x1="0" y1="160" x2="${width}" y2="160" />
        <line x1="0" y1="240" x2="${width}" y2="240" />
        <line x1="0" y1="320" x2="${width}" y2="320" />
        <line x1="0" y1="380" x2="${width}" y2="380" />
        <line x1="220" y1="0" x2="220" y2="${height}" />
        <line x1="440" y1="0" x2="440" y2="${height}" />
        <line x1="660" y1="0" x2="660" y2="${height}" />
      </g>

      <!-- Water Flood Level (Submersion Environment) -->
      ${analysis.waterHeadMeters > 0 ? `
        <rect x="20" y="${280 - Math.min(180, analysis.waterHeadMeters * 35)}" width="580" height="${100 + Math.min(180, analysis.waterHeadMeters * 35)}" fill="url(#waterFloodGrad)" />
        <line x1="20" y1="${280 - Math.min(180, analysis.waterHeadMeters * 35)}" x2="600" y2="${280 - Math.min(180, analysis.waterHeadMeters * 35)}" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6,4" />
        <text x="30" y="${272 - Math.min(180, analysis.waterHeadMeters * 35)}" fill="#38bdf8" font-size="11" font-weight="600">WATERLINE: ${analysis.waterHeadMeters}m Hydrostatic Head (${analysis.hydrostaticPressureKpa} kPa)</text>
      ` : ''}

      <!-- Main FOSC Closure Cutaway Diagram -->
      <g transform="translate(180, 50)">
        <!-- Outer Dome Silhouette -->
        <path d="M 0,260 L 0,80 C 0,15 160,15 160,80 L 160,260 Z" fill="url(#domeBodyGrad)" stroke="#475569" stroke-width="2.5" />

        <!-- Dome Reinforcement Ribs -->
        <path d="M 0,110 Q 80,125 160,110" fill="none" stroke="#64748b" stroke-width="1.5" opacity="0.7" />
        <path d="M 0,160 Q 80,175 160,160" fill="none" stroke="#64748b" stroke-width="1.5" opacity="0.7" />
        <path d="M 0,210 Q 80,225 160,210" fill="none" stroke="#64748b" stroke-width="1.5" opacity="0.7" />

        <!-- Internal Splice Trays (Stacked Cassettes) -->
        <g transform="translate(30, 85)">
          <!-- Tray 1 -->
          <rect x="0" y="0" width="100" height="24" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
          <path d="M 12,12 Q 50,4 88,12" fill="none" stroke="#38bdf8" stroke-width="1" />
          <circle cx="50" cy="12" r="3" fill="#10b981" />
          <!-- Tray 2 -->
          <rect x="0" y="32" width="100" height="24" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
          <path d="M 12,44 Q 50,36 88,44" fill="none" stroke="#f59e0b" stroke-width="1" />
          <circle cx="50" cy="44" r="3" fill="#10b981" />
          <!-- Tray 3 -->
          <rect x="0" y="64" width="100" height="24" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
          <path d="M 12,76 Q 50,68 88,76" fill="none" stroke="#ec4899" stroke-width="1" />
          <circle cx="50" cy="76" r="3" fill="#10b981" />
          <text x="50" y="105" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600">SPLICE TRAYS (TIA-598-D)</text>
        </g>

        <!-- Mechanical Base Clamp Collar -->
        <rect x="-10" y="260" width="180" height="22" rx="3" fill="#334155" stroke="#94a3b8" stroke-width="2" />
        <circle cx="10" cy="271" r="4" fill="#64748b" stroke="#cbd5e1" stroke-width="1" />
        <circle cx="150" cy="271" r="4" fill="#64748b" stroke="#cbd5e1" stroke-width="1" />
        <text x="80" y="275" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="700">BASE CLAMP RING (TORQUED)</text>

        <!-- Cable Entry Port Glands & Seal Collar -->
        <g transform="translate(15, 282)">
          <!-- Port 1 (Round Left) -->
          <rect x="0" y="0" width="28" height="35" rx="3" fill="${sealColor}" stroke="#f8fafc" stroke-width="1.5" filter="url(#sealGlowEffect)" />
          <line x1="14" y1="35" x2="14" y2="70" stroke="#000" stroke-width="8" stroke-linecap="round" />
          <line x1="14" y1="35" x2="14" y2="70" stroke="#475569" stroke-width="6" stroke-linecap="round" />

          <!-- Port 2 (Oval Center Feeder Express) -->
          <rect x="38" y="0" width="54" height="40" rx="4" fill="${sealColor}" stroke="#f8fafc" stroke-width="2" filter="url(#sealGlowEffect)" />
          <line x1="53" y1="40" x2="53" y2="70" stroke="#000" stroke-width="11" stroke-linecap="round" />
          <line x1="53" y1="40" x2="53" y2="70" stroke="#334155" stroke-width="9" stroke-linecap="round" />
          <line x1="77" y1="40" x2="77" y2="70" stroke="#000" stroke-width="11" stroke-linecap="round" />
          <line x1="77" y1="40" x2="77" y2="70" stroke="#334155" stroke-width="9" stroke-linecap="round" />

          <!-- Port 3 (Round Right) -->
          <rect x="102" y="0" width="28" height="35" rx="3" fill="${sealColor}" stroke="#f8fafc" stroke-width="1.5" filter="url(#sealGlowEffect)" />
          <line x1="116" y1="35" x2="116" y2="70" stroke="#000" stroke-width="8" stroke-linecap="round" />
          <line x1="116" y1="35" x2="116" y2="70" stroke="#475569" stroke-width="6" stroke-linecap="round" />
        </g>

        <!-- Leak Bubbles if Failed -->
        ${isFailed ? `
          <g fill="#ef4444" opacity="0.8">
            <circle cx="25" cy="290" r="4" />
            <circle cx="20" cy="275" r="5" />
            <circle cx="30" cy="260" r="6" />
            <circle cx="120" cy="292" r="4" />
            <circle cx="130" cy="270" r="5" />
            <text x="80" y="340" text-anchor="middle" fill="#ef4444" font-size="11" font-weight="800">⚠️ ACTIVE SEAL LEAK DETECTED</text>
          </g>
        ` : ''}

        <!-- Sealing Technology Callout -->
        <text x="80" y="345" text-anchor="middle" fill="#38bdf8" font-size="11" font-weight="700">${tech.name.slice(0, 32)}</text>
      </g>

      <!-- Integrated Dial Manometer Gauge (Right Side) -->
      <g transform="translate(670, 160)">
        <!-- Outer Gauge Bezel -->
        <circle cx="0" cy="0" r="85" fill="url(#gaugeDialGrad)" stroke="#475569" stroke-width="5" />
        <circle cx="0" cy="0" r="80" fill="none" stroke="#1e293b" stroke-width="2" />

        <!-- Dial Arc Scale (0 to 120 kPa) -->
        <path d="M -56,40 A 70,70 0 1,1 56,40" fill="none" stroke="#334155" stroke-width="8" stroke-linecap="round" />
        <path d="M -56,40 A 70,70 0 0,1 -20,-67" fill="none" stroke="#10b981" stroke-width="8" />
        <path d="M -20,-67 A 70,70 0 0,1 35,-60" fill="none" stroke="#f59e0b" stroke-width="8" />
        <path d="M 35,-60 A 70,70 0 0,1 56,40" fill="none" stroke="#ef4444" stroke-width="8" />

        <!-- Scale Tick Marks -->
        <text x="-50" y="30" fill="#94a3b8" font-size="9" text-anchor="middle">0</text>
        <text x="-50" y="-35" fill="#94a3b8" font-size="9" text-anchor="middle">30</text>
        <text x="0" y="-62" fill="#94a3b8" font-size="9" text-anchor="middle">60</text>
        <text x="50" y="-35" fill="#94a3b8" font-size="9" text-anchor="middle">90</text>
        <text x="50" y="30" fill="#94a3b8" font-size="9" text-anchor="middle">120</text>

        <!-- Center Needle -->
        <g transform="rotate(${needleAngle})">
          <line x1="0" y1="12" x2="0" y2="-68" stroke="#f43f5e" stroke-width="3" stroke-linecap="round" />
          <polygon points="-4,-50 4,-50 0,-68" fill="#f43f5e" />
        </g>
        <circle cx="0" cy="0" r="7" fill="#f8fafc" stroke="#f43f5e" stroke-width="2" />

        <!-- Manometer Center Readout -->
        <text x="0" y="42" text-anchor="middle" fill="#f8fafc" font-size="16" font-weight="800">${analysis.finalPressureKpa} kPa</text>
        <text x="0" y="56" text-anchor="middle" fill="#94a3b8" font-size="9" font-weight="600">NITROGEN TEST</text>
        <text x="0" y="70" text-anchor="middle" fill="${verdict.color}" font-size="10" font-weight="700">Decay: -${analysis.truePressureDecayKpa} kPa</text>
      </g>

      <!-- Bottom HUD Telemetry Ribbon -->
      <g transform="translate(20, 390)">
        <rect x="0" y="0" width="${width - 40}" height="42" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1.5" />

        <text x="15" y="18" fill="#94a3b8" font-size="9" font-weight="600">HOURLY LEAK RATE</text>
        <text x="15" y="33" fill="${isFailed ? '#ef4444' : '#38bdf8'}" font-size="13" font-weight="800">${analysis.hourlyLeakRateKpaHr} kPa/hr</text>

        <text x="175" y="18" fill="#94a3b8" font-size="9" font-weight="600">24-HR NORMALIZED DECAY</text>
        <text x="175" y="33" fill="${analysis.normalized24hDecayKpa <= 1.5 ? '#10b981' : '#f59e0b'}" font-size="13" font-weight="800">${analysis.normalized24hDecayKpa} kPa</text>

        <text x="365" y="18" fill="#94a3b8" font-size="9" font-weight="600">INGRESS MARGIN</text>
        <text x="365" y="33" fill="${analysis.netIngressSafetyMarginKpa >= 40 ? '#10b981' : '#ef4444'}" font-size="13" font-weight="800">+${analysis.netIngressSafetyMarginKpa} kPa</text>

        <text x="535" y="18" fill="#94a3b8" font-size="9" font-weight="600">CLAMP RETENTION (SF)</text>
        <text x="535" y="33" fill="${analysis.clampRetentionSafetyFactor >= 1.25 ? '#10b981' : '#f59e0b'}" font-size="13" font-weight="800">${analysis.measuredClampRetentionN} N (${analysis.clampRetentionSafetyFactor}x)</text>

        <text x="720" y="18" fill="#94a3b8" font-size="9" font-weight="600">IP68 VERDICT</text>
        <text x="720" y="33" fill="${verdict.color}" font-size="12" font-weight="800">${verdict.name.slice(0, 18)}</text>
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
export function generateFoscSealCertHtml(record, { format = 'A4' } = {}) {
  if (!record || !record.analysis) return '<p>Invalid FOSC certificate record</p>';

  const a = record.analysis;
  const isPos = format === 'POS80';

  if (isPos) {
    return `
      <div class="fosc-pos-slip" style="width: 280px; font-family: 'Courier New', monospace; font-size: 11px; padding: 10px; color: #000; background: #fff; line-height: 1.3;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
          <div style="font-weight: bold; font-size: 13px;">SHAHDARA ISP NETWORK</div>
          <div style="font-size: 10px;">OSP FIELD FOSC SEAL QA SLIP</div>
          <div style="font-size: 9px;">IEC 60529 IP68 / GR-771-CORE</div>
        </div>
        <div><strong>Cert ID:</strong> ${record.id}</div>
        <div><strong>Date:</strong> ${record.createdAt.slice(0, 10)}</div>
        <div><strong>Enclosure:</strong> ${a.enclosureType.name.slice(0, 24)}</div>
        <div><strong>Sealing:</strong> ${a.sealingTech.name.slice(0, 24)}</div>
        <div><strong>Water Depth:</strong> ${a.waterHeadMeters} m</div>
        <div><strong>P0 Initial:</strong> ${a.initialPressureKpa} kPa</div>
        <div><strong>Pt Final:</strong> ${a.finalPressureKpa} kPa (${a.testDurationHours}h)</div>
        <div><strong>True Decay:</strong> ${a.truePressureDecayKpa} kPa</div>
        <div><strong>Leak Rate:</strong> ${a.hourlyLeakRateKpaHr} kPa/hr</div>
        <div><strong>24h Equiv:</strong> ${a.normalized24hDecayKpa} kPa</div>
        <div><strong>Clamp Force:</strong> ${a.measuredClampRetentionN} N (${a.clampRetentionSafetyFactor}x)</div>
        <div style="margin: 6px 0; padding: 4px; border: 1px solid #000; text-align: center; font-weight: bold;">
          VERDICT: ${a.verdict.name}
        </div>
        <div style="font-size: 9px; text-align: center; margin-top: 6px; border-top: 1px dashed #000; padding-top: 4px;">
          Lineman: ${record.technicianName}<br>
          Shahdara ISP Network Operations
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <article class="fosc-cert-a4" style="max-width: 820px; margin: 0 auto; padding: 28px; background: #ffffff; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border: 1px solid #cbd5e1; border-radius: 8px;">
      <header style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 20px;">
        <div>
          <span style="font-size: 11px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.05em;">Outside Plant Telecom Engineering &amp; Civil QA Laboratory</span>
          <h1 style="font-size: 20px; font-weight: 800; margin: 4px 0 2px 0; color: #0f172a;">Fiber Optic Splice Closure (FOSC) Ingress &amp; Pressure Decay QA Certificate</h1>
          <p style="font-size: 11px; color: #64748b; margin: 0;">Standards: IEC 60529 IP68 Continuous Submersion Metrology · Telcordia GR-771-CORE Issue 2 · ITU-T L.400 / L.13</p>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 10px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 13px; font-weight: 700;">${record.id}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Date: ${record.createdAt.slice(0, 10)}</div>
        </div>
      </header>

      <!-- Section 1: Facility & Enclosure Specs -->
      <section style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; font-size: 12px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <h3 style="font-size: 11px; text-transform: uppercase; color: #0369a1; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Enclosure &amp; Installation Telemetry</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Enclosure / Joint Ref:</span>
            <strong style="color: #0f172a;">${record.subscriberName}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Route Description:</span>
            <strong>${record.routeDescription}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Enclosure Model:</span>
            <strong style="color: #0f172a;">${a.enclosureType.name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Max Fiber Capacity:</span>
            <strong>${a.enclosureType.maxFibers} Fibers (${a.enclosureType.roundPorts} Rnd + ${a.enclosureType.ovalPorts} Oval)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Sealing Mechanism:</span>
            <strong>${a.sealingTech.name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Re-entry Cycles:</span>
            <strong>Cycle #${a.reentryCount} (Degradation: ${(100 - a.degradationFactor * 100).toFixed(1)}%)</strong>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <h3 style="font-size: 11px; text-transform: uppercase; color: #0369a1; margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Environmental &amp; Hydrostatic Exposure</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Environment:</span>
            <strong style="color: #0f172a;">${a.environment.name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Water Submersion Head:</span>
            <strong>${a.waterHeadMeters} meters (${a.hydrostaticPressureKpa} kPa)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #64748b;">Cable Clamped:</span>
            <strong>${a.cableType.name}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #64748b;">Clamp Retention Force:</span>
            <strong>${a.measuredClampRetentionN} N (Safety Factor ${a.clampRetentionSafetyFactor}x)</strong>
          </div>
        </div>
      </section>

      <!-- Section 2: Pneumatic Metrology Test Table -->
      <section style="margin-bottom: 18px;">
        <h3 style="font-size: 11px; text-transform: uppercase; color: #0369a1; margin: 0 0 8px 0;">Pneumatic Flash Test &amp; Pressure Decay Metrology</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
              <th style="padding: 6px 10px;">Parameter</th>
              <th style="padding: 6px 10px;">Observed Value</th>
              <th style="padding: 6px 10px;">Standard Limit</th>
              <th style="padding: 6px 10px;">Compliance Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">Initial Flash Pressure (P0)</td>
              <td style="padding: 6px 10px; font-weight: 600;">${a.initialPressureKpa} kPa @ ${a.tempInitialC}°C</td>
              <td style="padding: 6px 10px; color: #64748b;">40 - 100 kPa (GR-771)</td>
              <td style="padding: 6px 10px; color: #16a34a; font-weight: 600;">Optimal Charge</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">Final Pressure (Pt) &amp; Duration</td>
              <td style="padding: 6px 10px; font-weight: 600;">${a.finalPressureKpa} kPa (${a.testDurationHours} hrs @ ${a.tempFinalC}°C)</td>
              <td style="padding: 6px 10px; color: #64748b;">≥ 4.0 hrs test window</td>
              <td style="padding: 6px 10px; color: #16a34a; font-weight: 600;">Compliant</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">True Thermal-Compensated Decay</td>
              <td style="padding: 6px 10px; font-weight: 600;">${a.truePressureDecayKpa} kPa</td>
              <td style="padding: 6px 10px; color: #64748b;">≤ 1.5 kPa (24h equiv)</td>
              <td style="padding: 6px 10px; font-weight: 600; color: ${a.normalized24hDecayKpa <= 1.5 ? '#16a34a' : '#ef4444'};">${a.normalized24hDecayKpa <= 1.5 ? 'Pass (GR-771)' : 'Excessive Decay'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">Hourly Leakage Rate (R_leak)</td>
              <td style="padding: 6px 10px; font-weight: 600;">${a.hourlyLeakRateKpaHr} kPa/hr</td>
              <td style="padding: 6px 10px; color: #64748b;">≤ 0.0625 kPa/hr</td>
              <td style="padding: 6px 10px; font-weight: 600; color: ${a.hourlyLeakRateKpaHr <= 0.065 ? '#16a34a' : '#f59e0b'};">${a.hourlyLeakRateKpaHr <= 0.065 ? 'Hermetic Seal' : 'Minor Weepage'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 6px 10px;">Net Ingress Safety Margin</td>
              <td style="padding: 6px 10px; font-weight: 600;">+${a.netIngressSafetyMarginKpa} kPa</td>
              <td style="padding: 6px 10px; color: #64748b;">≥ 40.0 kPa (IP68)</td>
              <td style="padding: 6px 10px; font-weight: 600; color: ${a.netIngressSafetyMarginKpa >= 40 ? '#16a34a' : '#ef4444'};">${a.netIngressSafetyMarginKpa >= 40 ? 'Certified Safe' : 'Submersion Hazard'}</td>
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
          <div><strong>Inspecting Lineman:</strong> ${record.technicianName}</div>
          <div style="color: #64748b;">Shahdara Outside Plant Engineering Lead</div>
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
export function formatFoscSealCertWhatsApp(record) {
  if (!record || !record.analysis) return '';

  const a = record.analysis;
  const isPass = a.verdict.id === 'CERTIFIED_IP68_HERMETIC_PASS';
  const icon = isPass ? '✅' : (a.verdict.id === 'CONDITIONAL_PASS_AERIAL_ONLY' ? '⚠️' : '🚨');

  return [
    `*SHAHDARA ISP NETWORK - FOSC INGRESS & PRESSURE SEAL QA*`,
    `----------------------------------------`,
    `سرٹیفکیٹ نمبر: *${record.id}*`,
    `مقام / جوائنٹ: *${record.subscriberName}*`,
    `روٹ تفصیل: *${record.routeDescription}*`,
    `جوائنٹ باکس قسم: *${a.enclosureType.name}*`,
    `سیلنگ ٹیکنالوجی: *${a.sealingTech.name}*`,
    `ماحول / گہرائی: *${a.environment.name} (${a.waterHeadMeters}m Head)*`,
    `----------------------------------------`,
    `*پریشر و لیکیج پیمائش (Pneumatic Metrology):*`,
    `• ابتدائی ٹیسٹ پریشر (P0): ${a.initialPressureKpa} kPa`,
    `• فائنل پریشر (Pt): ${a.finalPressureKpa} kPa (${a.testDurationHours} گھنٹے)`,
    `• تھرمل ٹرو ڈیکے (Decay): -${a.truePressureDecayKpa} kPa`,
    `• فی گھنٹہ لیکیج شرح: ${a.hourlyLeakRateKpaHr} kPa/hr`,
    `• 24 گھنٹے نارملائزڈ ڈیکے: ${a.normalized24hDecayKpa} kPa (Limit: ≤1.5)`,
    `• واٹر پروفنگ مارجن: +${a.netIngressSafetyMarginKpa} kPa`,
    `• کیبل کلیمپ کھچاؤ مزاحمت: ${a.measuredClampRetentionN} N (${a.clampRetentionSafetyFactor}x)`,
    `----------------------------------------`,
    `*حتمی نتیجہ (Verdict):* ${icon} *${a.verdict.name}*`,
    `کیفیت: ${a.verdict.description}`,
    `----------------------------------------`,
    `ٹیکنیشن: *${record.technicianName}* | شاہدرہ او ایس پی آپریشنز`
  ].join('\n');
}

/**
 * Exports FOSC seal QA records to RFC-4180 compliant CSV string with UTF-8 BOM.
 * @param {Object[]} records
 * @returns {string} CSV text
 */
export function generateFoscSealCertsCsv(records = []) {
  const headers = [
    'Cert_ID',
    'Date',
    'Enclosure_Ref',
    'Route_Description',
    'Enclosure_Type',
    'Sealing_Technology',
    'Environment',
    'Water_Head_Meters',
    'P0_Initial_kPa',
    'Pt_Final_kPa',
    'Duration_Hours',
    'Decay_kPa',
    'Hourly_Leak_Rate_kPa_hr',
    'Normalized_24h_Decay_kPa',
    'Ingress_Margin_kPa',
    'Clamp_Retention_N',
    'Clamp_SF',
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
      a.enclosureType?.name || '',
      a.sealingTech?.name || '',
      a.environment?.name || '',
      a.waterHeadMeters !== undefined ? a.waterHeadMeters : '',
      a.initialPressureKpa !== undefined ? a.initialPressureKpa : '',
      a.finalPressureKpa !== undefined ? a.finalPressureKpa : '',
      a.testDurationHours !== undefined ? a.testDurationHours : '',
      a.truePressureDecayKpa !== undefined ? a.truePressureDecayKpa : '',
      a.hourlyLeakRateKpaHr !== undefined ? a.hourlyLeakRateKpaHr : '',
      a.normalized24hDecayKpa !== undefined ? a.normalized24hDecayKpa : '',
      a.netIngressSafetyMarginKpa !== undefined ? a.netIngressSafetyMarginKpa : '',
      a.measuredClampRetentionN !== undefined ? a.measuredClampRetentionN : '',
      a.clampRetentionSafetyFactor !== undefined ? a.clampRetentionSafetyFactor : '',
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
 * Controller setting up the interactive DOM modal dialog for FOSC Seal QA.
 * @param {Object} options
 * @returns {Object} Controller instance with refresh and destroy
 */
export function setupFoscSealModal(options = {}) {
  const {
    dialogElement,
    triggerButton,
    storage = (typeof localStorage !== 'undefined' ? localStorage : null),
    onToast = (msg) => console.log(msg)
  } = options;

  if (!dialogElement) return null;

  // DOM Query Helpers
  const $ = (sel) => dialogElement.querySelector(sel);

  const presetSelect = $('#foscPresetSelect');
  const subscriberInput = $('#foscSubscriberInput');
  const routeInput = $('#foscRouteInput');
  const enclosureTypeSelect = $('#foscEnclosureTypeSelect');
  const sealingTechSelect = $('#foscSealingTechSelect');
  const environmentSelect = $('#foscEnvironmentSelect');
  const cableTypeSelect = $('#foscCableTypeSelect');
  const waterHeadInput = $('#foscWaterHeadInput');
  const initialPressureInput = $('#foscInitialPressureInput');
  const finalPressureInput = $('#foscFinalPressureInput');
  const durationInput = $('#foscDurationInput');
  const tempInitialInput = $('#foscTempInitialInput');
  const tempFinalInput = $('#foscTempFinalInput');
  const reentryInput = $('#foscReentryInput');
  const clampRetentionInput = $('#foscClampRetentionInput');
  const technicianInput = $('#foscTechnicianInput');
  const notesInput = $('#foscNotesInput');

  const closeBtn = $('#foscCloseBtn');
  const saveBtn = $('#foscSaveBtn');
  const printA4Btn = $('#foscPrintA4Btn');
  const printPosBtn = $('#foscPrintPosBtn');
  const whatsAppBtn = $('#foscWhatsAppBtn');
  const csvExportBtn = $('#foscCsvExportBtn');

  const svgContainer = $('#foscSvgContainer');
  const verdictBanner = $('#foscVerdictBanner');
  const historyTableBody = $('#foscHistoryTableBody');

  const leakRateDisplay = $('#foscLeakRateDisplay');
  const decay24hDisplay = $('#foscDecay24hDisplay');
  const ingressMarginDisplay = $('#foscIngressMarginDisplay');
  const clampSfDisplay = $('#foscClampSfDisplay');

  function getFormData() {
    return {
      subscriberName: subscriberInput ? subscriberInput.value : '',
      routeDescription: routeInput ? routeInput.value : '',
      enclosureTypeId: enclosureTypeSelect ? enclosureTypeSelect.value : 'DOME_FOSC_400_A4',
      sealingTechId: sealingTechSelect ? sealingTechSelect.value : 'COLD_SILICONE_GEL_BLOCK',
      environmentId: environmentSelect ? environmentSelect.value : 'SUBMERGED_MANHOLE_SUMP',
      cableTypeId: cableTypeSelect ? cableTypeSelect.value : 'FEEDER_ARMORED_CST',
      waterHeadMeters: waterHeadInput ? Number(waterHeadInput.value) : 2.5,
      initialPressureKpa: initialPressureInput ? Number(initialPressureInput.value) : 70,
      finalPressureKpa: finalPressureInput ? Number(finalPressureInput.value) : 69.2,
      testDurationHours: durationInput ? Number(durationInput.value) : 12.0,
      tempInitialC: tempInitialInput ? Number(tempInitialInput.value) : 25,
      tempFinalC: tempFinalInput ? Number(tempFinalInput.value) : 25,
      reentryCount: reentryInput ? Number(reentryInput.value) : 1,
      measuredClampRetentionN: clampRetentionInput ? Number(clampRetentionInput.value) : 600,
      technicianName: technicianInput ? technicianInput.value : '',
      notes: notesInput ? notesInput.value : ''
    };
  }

  function recalculateAndRender() {
    const data = getFormData();
    const analysis = calculateFoscSealPhysics(data);

    if (leakRateDisplay) leakRateDisplay.textContent = `${analysis.hourlyLeakRateKpaHr} kPa/hr`;
    if (decay24hDisplay) decay24hDisplay.textContent = `${analysis.normalized24hDecayKpa} kPa`;
    if (ingressMarginDisplay) ingressMarginDisplay.textContent = `+${analysis.netIngressSafetyMarginKpa} kPa`;
    if (clampSfDisplay) clampSfDisplay.textContent = `${analysis.clampRetentionSafetyFactor}x`;

    if (verdictBanner) {
      verdictBanner.textContent = analysis.verdict.name;
      verdictBanner.className = `verdict-banner ${analysis.verdict.badgeClass}`;
      verdictBanner.style.color = analysis.verdict.color;
      verdictBanner.style.background = `${analysis.verdict.color}18`;
      verdictBanner.style.border = `1px solid ${analysis.verdict.color}44`;
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderFoscSealAnalysisSvg(analysis);
    }
  }

  function renderHistoryTable() {
    if (!historyTableBody) return;
    const certs = getSavedFoscSealCerts(storage);

    if (certs.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 12px;">No saved FOSC seal QA certificates found.</td></tr>`;
      return;
    }

    historyTableBody.innerHTML = certs.map(c => `
      <tr style="border-bottom: 1px solid var(--border-color, #1e293b);">
        <td style="padding: 6px 8px; font-family: monospace; font-weight: 700; color: #38bdf8;">${c.id}</td>
        <td style="padding: 6px 8px; color: #94a3b8;">${c.createdAt.slice(0, 10)}</td>
        <td style="padding: 6px 8px; font-weight: 600;">${c.subscriberName}</td>
        <td style="padding: 6px 8px;">${c.analysis?.hourlyLeakRateKpaHr || '--'} kPa/h</td>
        <td style="padding: 6px 8px;"><span class="badge ${c.analysis?.verdict?.badgeClass || ''}" style="color: ${c.analysis?.verdict?.color || '#cbd5e1'}; font-weight: 600;">${c.analysis?.verdict?.name?.slice(0, 22) || 'Audit'}</span></td>
        <td style="padding: 6px 8px;">
          <button class="secondary-button" style="font-size: 10px; padding: 2px 6px;" data-fosc-pos-id="${c.id}" type="button">🧾 Slip</button>
        </td>
      </tr>
    `).join('');

    historyTableBody.querySelectorAll('[data-fosc-pos-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-fosc-pos-id');
        const target = certs.find(item => item.id === id);
        if (target) {
          const slipHtml = generateFoscSealCertHtml(target, { format: 'POS80' });
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
    enclosureTypeSelect, sealingTechSelect, environmentSelect, cableTypeSelect,
    waterHeadInput, initialPressureInput, finalPressureInput, durationInput,
    tempInitialInput, tempFinalInput, reentryInput, clampRetentionInput,
    subscriberInput, routeInput, technicianInput, notesInput
  ];

  inputElements.forEach(el => {
    if (el) {
      el.addEventListener('input', recalculateAndRender);
      el.addEventListener('change', recalculateAndRender);
    }
  });

  if (environmentSelect && waterHeadInput) {
    environmentSelect.addEventListener('change', () => {
      const env = DEPLOYMENT_ENVIRONMENTS[environmentSelect.value];
      if (env) {
        waterHeadInput.value = env.waterHeadMeters;
        recalculateAndRender();
      }
    });
  }

  if (enclosureTypeSelect && initialPressureInput) {
    enclosureTypeSelect.addEventListener('change', () => {
      const enc = FOSC_ENCLOSURE_TYPES[enclosureTypeSelect.value];
      if (enc) {
        initialPressureInput.value = enc.defaultTestPressureKpa;
        recalculateAndRender();
      }
    });
  }

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const p = SHAHDARA_FOSC_PRESETS.find(item => item.id === presetSelect.value);
      if (p) {
        if (subscriberInput) subscriberInput.value = p.subscriberName;
        if (enclosureTypeSelect) enclosureTypeSelect.value = p.enclosureTypeId;
        if (sealingTechSelect) sealingTechSelect.value = p.sealingTechId;
        if (environmentSelect) environmentSelect.value = p.environmentId;
        if (cableTypeSelect) cableTypeSelect.value = p.cableTypeId;
        if (waterHeadInput) waterHeadInput.value = p.waterHeadMeters;
        if (initialPressureInput) initialPressureInput.value = p.initialPressureKpa;
        if (finalPressureInput) finalPressureInput.value = p.finalPressureKpa;
        if (durationInput) durationInput.value = p.testDurationHours;
        if (tempInitialInput) tempInitialInput.value = p.tempInitialC;
        if (tempFinalInput) tempFinalInput.value = p.tempFinalC;
        if (reentryInput) reentryInput.value = p.reentryCount;
        if (clampRetentionInput) clampRetentionInput.value = p.measuredClampRetentionN;
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
      const validation = validateFoscSealInput(data);
      if (!validation.isValid) {
        onToast(`Validation Error: ${validation.errors[0]}`);
        return;
      }
      const record = buildFoscSealCertRecord(data);
      saveFoscSealCert(record, storage);
      renderHistoryTable();
      onToast(`Saved FOSC Seal Certificate: ${record.id}`);
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const data = getFormData();
      const record = buildFoscSealCertRecord(data);
      const html = generateFoscSealCertHtml(record, { format: 'A4' });
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
      const record = buildFoscSealCertRecord(data);
      const html = generateFoscSealCertHtml(record, { format: 'POS80' });
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
      const record = buildFoscSealCertRecord(data);
      const text = formatFoscSealCertWhatsApp(record);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          onToast('FOSC QA notice copied to clipboard!');
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
      const certs = getSavedFoscSealCerts(storage);
      const current = buildFoscSealCertRecord(getFormData());
      const dataset = certs.length > 0 ? certs : [current];
      const csv = generateFoscSealCertsCsv(dataset);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara_fosc_seal_certs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('FOSC seal certificates exported to CSV!');
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
