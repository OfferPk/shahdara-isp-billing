/**
 * Shahdara ISP Billing & Network Operations - Outside Plant Optical Fiber Aerial ADSS & Figure-8
 * Span Sag, Transverse Wind/Ice Load & Everyday Stress (EDS) Aeolian Fatigue QA Certification Suite
 * Standards: IEEE 1222, IEC 60794-4-20, Telcordia GR-20-CORE Issue 4, NESC Rule 232/250, WAPDA/NESPAK Regulations
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const ADSS_SAG_TENSION_STORAGE_KEY = 'shahdara_adss_sag_tension_certs_v1';

export const ADSS_CABLE_TYPES = {
  'ADSS_24F_100M': {
    id: 'ADSS_24F_100M',
    name: '24-Core All-Dielectric Self-Supporting (ADSS) Medium-Span',
    category: 'ADSS Multi-Tube',
    weightKgPerM: 0.115,
    cableOdMm: 10.5,
    ratedTensileStrengthN: 10000.0, // 10 kN RTS
    modulusElasticityEaN: 1150000.0,
    thermalExpansionCoeff: 0.000012, // 1.2e-5 / °C
    maxAllowableSagPercent: 3.5, // % of span length
    colorCode: '#0ea5e9',
    description: 'Standard 24-core ADSS cable with aramid yarn strength member for medium urban spans up to 100m.'
  },
  'ADSS_48F_RIVER_CROSSING': {
    id: 'ADSS_48F_RIVER_CROSSING',
    name: '48-Core ADSS Heavy Long-Span (Ravi River Crossing)',
    category: 'ADSS Reinforced Heavy Span',
    weightKgPerM: 0.165,
    cableOdMm: 12.8,
    ratedTensileStrengthN: 22000.0, // 22 kN RTS
    modulusElasticityEaN: 2300000.0,
    thermalExpansionCoeff: 0.000011, // 1.1e-5 / °C
    maxAllowableSagPercent: 4.0,
    colorCode: '#6366f1',
    description: 'High-modulus reinforced aramid ADSS engineered for wide river crossings and high-tension highway overpasses.'
  },
  'FIG8_12F_STEEL_MESSENGER': {
    id: 'FIG8_12F_STEEL_MESSENGER',
    name: '12-Core Figure-8 Self-Supporting Drop with Steel Messenger',
    category: 'Figure-8 Metallic Messenger',
    weightKgPerM: 0.085,
    cableOdMm: 8.2,
    ratedTensileStrengthN: 6000.0, // 6 kN RTS (7x0.5mm galvanized steel wire)
    modulusElasticityEaN: 1800000.0,
    thermalExpansionCoeff: 0.000013,
    maxAllowableSagPercent: 2.5,
    colorCode: '#10b981',
    description: 'Figure-8 aerial drop cable with integrated 7-strand steel messenger wire for pole-to-FAT distribution.'
  },
  'ADSS_96F_HEAVY_TRUNK': {
    id: 'ADSS_96F_HEAVY_TRUNK',
    name: '96-Core ADSS High-Density Backbone Trunk',
    category: 'ADSS Backbone Trunk',
    weightKgPerM: 0.230,
    cableOdMm: 15.2,
    ratedTensileStrengthN: 35000.0, // 35 kN RTS
    modulusElasticityEaN: 3500000.0,
    thermalExpansionCoeff: 0.000010,
    maxAllowableSagPercent: 3.5,
    colorCode: '#f59e0b',
    description: 'Heavy multi-loose-tube 96F feeder backbone with dual-layer cross-plied Kevlar/aramid reinforcement.'
  },
  'FIG8_4F_SUBSCRIBER_DROP': {
    id: 'FIG8_4F_SUBSCRIBER_DROP',
    name: '4-Core Figure-8 Compact Aerial Drop (Last-Mile)',
    category: 'Figure-8 Last-Mile Drop',
    weightKgPerM: 0.042,
    cableOdMm: 5.0,
    ratedTensileStrengthN: 2200.0, // 2.2 kN RTS (1.0mm steel messenger)
    modulusElasticityEaN: 850000.0,
    thermalExpansionCoeff: 0.000014,
    maxAllowableSagPercent: 2.0,
    colorCode: '#ec4899',
    description: 'Lightweight FTTH drop cable from distribution pole to subscriber rooftop rosette anchor.'
  }
};

export const ADSS_ENV_CONDITIONS = {
  'SPRING_EDS_NOMINAL': {
    id: 'SPRING_EDS_NOMINAL',
    name: 'Nominal Everyday Stress (EDS Baseline @ 25°C, Calm)',
    temperatureC: 25.0,
    windSpeedKmh: 0.0,
    windGustKmh: 0.0,
    radialIceThicknessMm: 0.0,
    severityFactor: 1.0,
    description: 'Everyday stringing baseline condition under IEEE 1222 to calculate long-term aeolian vibration stress.'
  },
  'LAHORE_SUMMER_HEAT': {
    id: 'LAHORE_SUMMER_HEAT',
    name: 'Lahore Extreme Rooftop Summer Heat (+48°C, Calm)',
    temperatureC: 48.0,
    windSpeedKmh: 5.0,
    windGustKmh: 10.0,
    radialIceThicknessMm: 0.0,
    severityFactor: 1.25,
    description: 'Severe thermal expansion causing maximum downward catenary elongation and lowest ground clearance.'
  },
  'MONSOON_HIGH_WIND': {
    id: 'MONSOON_HIGH_WIND',
    name: 'Monsoon High Wind Gust (+30°C, 100 km/h Wind Gale)',
    temperatureC: 30.0,
    windSpeedKmh: 80.0,
    windGustKmh: 100.0,
    radialIceThicknessMm: 0.0,
    severityFactor: 1.85,
    description: 'Intense cross-wind aerodynamic pressure causing substantial transverse cable swing and elevated working tension.'
  },
  'WINTER_FOG_BREEZE': {
    id: 'WINTER_FOG_BREEZE',
    name: 'Winter Dew / High Humidity Breeze (+4°C, 35 km/h Wind)',
    temperatureC: 4.0,
    windSpeedKmh: 25.0,
    windGustKmh: 35.0,
    radialIceThicknessMm: 0.0,
    severityFactor: 1.2,
    description: 'Chilly winter temperatures contracting aramid/steel strength members, increasing baseline stringing tension.'
  },
  'SEVERE_SQUALL_STORM': {
    id: 'SEVERE_SQUALL_STORM',
    name: 'Severe Squall Storm (+20°C, 120 km/h Severe Gust)',
    temperatureC: 20.0,
    windSpeedKmh: 95.0,
    windGustKmh: 120.0,
    radialIceThicknessMm: 0.0,
    severityFactor: 2.2,
    description: 'Maximum Working Tension (MWT) storm condition testing mechanical tensile proof limits of dead-end clamps.'
  }
};

export const CROSSING_CLASSES = {
  'NATIONAL_HIGHWAY_RAILWAY': {
    id: 'NATIONAL_HIGHWAY_RAILWAY',
    name: 'National Highway / Railway Track Crossing',
    minClearanceM: 6.5,
    authority: 'NESPAK / Pakistan Railways Rule 232',
    description: 'High vehicular traffic corridor requiring minimum 6.5 meters vertical ground clearance above road crown.'
  },
  'COMMERCIAL_ROADWAY': {
    id: 'COMMERCIAL_ROADWAY',
    name: 'Primary Commercial Roadway (Truck & Bus Route)',
    minClearanceM: 5.5,
    authority: 'WAPDA Distribution Code Rule 232-1',
    description: 'Commercial arterial avenue with commercial trucks requiring 5.5 meters vertical ground clearance.'
  },
  'RESIDENTIAL_STREET': {
    id: 'RESIDENTIAL_STREET',
    name: 'Urban Residential Street / Mohalla Lane',
    minClearanceM: 4.5,
    authority: 'Town Municipal Administration (TMA)',
    description: 'Standard residential lane requiring 4.5 meters vertical clearance above pavement.'
  },
  'PEDESTRIAN_ALLEY': {
    id: 'PEDESTRIAN_ALLEY',
    name: 'Narrow Pedestrian Alley / Rooftop Inter-House Run',
    minClearanceM: 3.8,
    authority: 'Internal Shahdara ISP Code of Practice',
    description: 'Pedestrian and motorcycle alley requiring minimum 3.8 meters vertical clearance.'
  },
  'WAPDA_11KV_POWER_CROSSING': {
    id: 'WAPDA_11KV_POWER_CROSSING',
    name: 'WAPDA 11kV Medium-Voltage Electrical Line Separation',
    minClearanceM: 2.0, // vertical air clearance between power line and fiber
    authority: 'IEEE 1222 / WAPDA High Tension Clearance',
    description: 'Dielectric spacing requirement: minimum 2.0 meters physical separation between fiber and live 11kV conductors.'
  }
};

export const ADSS_VERDICTS = {
  'CERTIFIED_OPTIMAL': {
    id: 'CERTIFIED_OPTIMAL',
    name: 'Certified Optimal Aerial Span (Pass)',
    badgeClass: 'badge-success',
    color: '#16a34a',
    description: 'Ground clearance satisfies regulatory codes, EDS ≤ 18% RTS, and MWT within safe elastic limit.'
  },
  'CONDITIONAL_PASS': {
    id: 'CONDITIONAL_PASS',
    name: 'Conditional Pass (Vibration Dampers Required)',
    badgeClass: 'badge-warning',
    color: '#f59e0b',
    description: 'Clearance is adequate, but span length or EDS (18-20% RTS) requires spiral vibration dampers to prevent aeolian fatigue.'
  },
  'FAILED_CLEARANCE_HAZARD': {
    id: 'FAILED_CLEARANCE_HAZARD',
    name: 'Critical Hazard: Low Ground Clearance (Fail)',
    badgeClass: 'badge-danger',
    color: '#dc2626',
    description: 'Cable sag drops below mandatory right-of-way clearance limit; immediate re-tensioning or pole lift required.'
  },
  'FAILED_OVERTENSION_FATIGUE': {
    id: 'FAILED_OVERTENSION_FATIGUE',
    name: 'Critical Reject: Excessive Stringing Tension (Fail)',
    badgeClass: 'badge-danger',
    color: '#991b1b',
    description: 'Everyday stress exceeds 20% RTS or storm tension exceeds 50% RTS; high probability of aramid yarn fatigue snap.'
  }
};

export const SHAH_ADSS_PRESETS = {
  'PRESET_BARADARI_RAVI_CROSSING': {
    id: 'PRESET_BARADARI_RAVI_CROSSING',
    name: 'Baradari to Ravi River Siphon Aerial Crossing (160m Long Span)',
    customer: 'Shahdara Baradari Main Ring Backbone',
    route: 'Baradari Pole #B-14 across Ravi Siphon to Tower #S-01',
    cableTypeId: 'ADSS_48F_RIVER_CROSSING',
    envConditionId: 'MONSOON_HIGH_WIND',
    crossingClassId: 'NATIONAL_HIGHWAY_RAILWAY',
    spanLengthM: 160.0,
    poleAttachmentHeightM: 12.5,
    initialTensionN: 2600.0,
    hasVibrationDamperInstalled: true
  },
  'PRESET_VANDALA_COMMERCIAL_ROAD': {
    id: 'PRESET_VANDALA_COMMERCIAL_ROAD',
    name: 'Vandala Road Main Commercial Corridor (65m Span, 48°C Heat)',
    customer: 'Al-Madina Commercial Plaza Feeder',
    route: 'Vandala Road Pole #VR-08 to Pole #VR-09',
    cableTypeId: 'ADSS_24F_100M',
    envConditionId: 'LAHORE_SUMMER_HEAT',
    crossingClassId: 'COMMERCIAL_ROADWAY',
    spanLengthM: 65.0,
    poleAttachmentHeightM: 8.5,
    initialTensionN: 1100.0,
    hasVibrationDamperInstalled: false
  },
  'PRESET_BEGUM_KOT_WAPDA_GRID': {
    id: 'PRESET_BEGUM_KOT_WAPDA_GRID',
    name: 'Begum Kot Industrial Grid 11kV Overcrossing (80m Span)',
    customer: 'Begum Kot Industrial Ring Node',
    route: 'Begum Kot Substation feeder to FAT-BK-02',
    cableTypeId: 'ADSS_96F_HEAVY_TRUNK',
    envConditionId: 'MONSOON_HIGH_WIND',
    crossingClassId: 'WAPDA_11KV_POWER_CROSSING',
    spanLengthM: 80.0,
    poleAttachmentHeightM: 10.5,
    initialTensionN: 2900.0,
    hasVibrationDamperInstalled: true
  },
  'PRESET_JIA_MUSA_FIG8_DROP': {
    id: 'PRESET_JIA_MUSA_FIG8_DROP',
    name: 'Jia Musa Dense Residential Figure-8 Drop Run (45m Span)',
    customer: 'Sample Customer (Acct #JM-4091)',
    route: 'Jia Musa Lane 4 Pole #JM-12 to Rooftop Hook #42',
    cableTypeId: 'FIG8_12F_STEEL_MESSENGER',
    envConditionId: 'SPRING_EDS_NOMINAL',
    crossingClassId: 'RESIDENTIAL_STREET',
    spanLengthM: 45.0,
    poleAttachmentHeightM: 7.2,
    initialTensionN: 650.0,
    hasVibrationDamperInstalled: false
  },
  'PRESET_IMAMIA_RAILWAY_OVERPASS': {
    id: 'PRESET_IMAMIA_RAILWAY_OVERPASS',
    name: 'Imamia Colony Railway Track Feeder Span (110m Storm Gale)',
    customer: 'Imamia Colony Central Distribution Hub',
    route: 'Railway Track Milepost 14 Pole #IC-03 to #IC-04',
    cableTypeId: 'ADSS_48F_RIVER_CROSSING',
    envConditionId: 'SEVERE_SQUALL_STORM',
    crossingClassId: 'NATIONAL_HIGHWAY_RAILWAY',
    spanLengthM: 110.0,
    poleAttachmentHeightM: 11.8,
    initialTensionN: 1950.0,
    hasVibrationDamperInstalled: true
  }
};

/**
 * Calculates dynamic aerodynamic wind pressure (N/m²) based on wind velocity.
 * Formula: P = 0.613 * v^2 where v is in m/s (NESC Rule 250 / IEC 60794-4-20)
 * @param {number} windSpeedKmh
 * @returns {number} wind pressure in Pascals (N/m²)
 */
export function calculateWindPressure(windSpeedKmh) {
  const speed = Math.max(0, Number(windSpeedKmh) || 0);
  const vMps = (speed * 1000.0) / 3600.0;
  return 0.613 * Math.pow(vMps, 2);
}

/**
 * Calculates transverse aerodynamic wind force per linear meter of cable (N/m).
 * Formula: W_wind = P * (OD_mm / 1000) * C_d (where C_d ≈ 1.0 for cylindrical wire)
 * @param {number} windSpeedKmh
 * @param {number} cableOdMm
 * @param {number} [dragCoeff=1.0]
 * @returns {number} transverse wind force in N/m
 */
export function calculateAerodynamicWindForce(windSpeedKmh, cableOdMm, dragCoeff = 1.0) {
  const pressure = calculateWindPressure(windSpeedKmh);
  const odM = Math.max(0.001, (Number(cableOdMm) || 10.0) / 1000.0);
  return pressure * odM * dragCoeff;
}

/**
 * Calculates total resultant unit load vector per linear meter of cable (N/m).
 * Formula: W_res = sqrt( W_cable^2 + W_wind^2 )
 * @param {number} cableWeightKgPerM
 * @param {number} windForcePerM
 * @param {number} [gravity=9.80665]
 * @returns {{ unitGravityWeightN: number, unitWindForceN: number, resultantUnitLoadN: number, blowoutAngleDeg: number }}
 */
export function calculateResultantUnitLoad(cableWeightKgPerM, windForcePerM, gravity = 9.80665) {
  const wGrav = Math.max(0.001, (Number(cableWeightKgPerM) || 0.1) * gravity);
  const wWind = Math.max(0, Number(windForcePerM) || 0);
  const wRes = Math.sqrt(Math.pow(wGrav, 2) + Math.pow(wWind, 2));
  const blowoutRad = Math.atan2(wWind, wGrav);
  const blowoutDeg = (blowoutRad * 180.0) / Math.PI;

  return {
    unitGravityWeightN: Number(wGrav.toFixed(4)),
    unitWindForceN: Number(wWind.toFixed(4)),
    resultantUnitLoadN: Number(wRes.toFixed(4)),
    blowoutAngleDeg: Number(blowoutDeg.toFixed(2))
  };
}

/**
 * Calculates mid-span catenary sag components (meters).
 * Parabolic catenary approximation: Sag = (W_res * L^2) / (8 * H)
 * @param {number} resultantUnitLoadN
 * @param {number} spanLengthM
 * @param {number} horizontalTensionN
 * @param {number} blowoutAngleDeg
 * @returns {{ resultantSagM: number, verticalSagM: number, horizontalBlowoutSagM: number, sagPercentOfSpan: number }}
 */
export function calculateMidspanSag(resultantUnitLoadN, spanLengthM, horizontalTensionN, blowoutAngleDeg = 0.0) {
  const w = Math.max(0.0001, Number(resultantUnitLoadN) || 1.0);
  const l = Math.max(1.0, Number(spanLengthM) || 50.0);
  const h = Math.max(10.0, Number(horizontalTensionN) || 500.0);

  const sagRes = (w * Math.pow(l, 2)) / (8.0 * h);
  const blowoutRad = (blowoutAngleDeg * Math.PI) / 180.0;
  const sagVert = sagRes * Math.cos(blowoutRad);
  const sagHoriz = sagRes * Math.sin(blowoutRad);
  const sagPct = (sagRes / l) * 100.0;

  return {
    resultantSagM: Number(sagRes.toFixed(3)),
    verticalSagM: Number(sagVert.toFixed(3)),
    horizontalBlowoutSagM: Number(sagHoriz.toFixed(3)),
    sagPercentOfSpan: Number(sagPct.toFixed(2))
  };
}

/**
 * Calculates maximum cable tension at dead-end pole supports (N).
 * Formula: T_max = H + W_res * Sag_res
 * @param {number} horizontalTensionN
 * @param {number} resultantUnitLoadN
 * @param {number} resultantSagM
 * @returns {number} maximum support tension in N
 */
export function calculateMaxCableTension(horizontalTensionN, resultantUnitLoadN, resultantSagM) {
  const h = Math.max(10.0, Number(horizontalTensionN) || 500.0);
  const w = Math.max(0.0001, Number(resultantUnitLoadN) || 1.0);
  const s = Math.max(0, Number(resultantSagM) || 0.1);
  return Number((h + (w * s)).toFixed(2));
}

/**
 * Calculates everyday stress (EDS) percentage of cable Rated Tensile Strength (RTS).
 * Standards IEEE 1222 / Telcordia: EDS ≤ 18% RTS for infinite fatigue life.
 * @param {number} baselineTensionN
 * @param {number} ratedTensileStrengthN
 * @returns {number} EDS % of RTS
 */
export function calculateEverydayStressPercent(baselineTensionN, ratedTensileStrengthN) {
  const t = Math.max(0, Number(baselineTensionN) || 0);
  const rts = Math.max(100.0, Number(ratedTensileStrengthN) || 1000.0);
  return Number(((t / rts) * 100.0).toFixed(2));
}

/**
 * Calculates maximum working tension (MWT) percentage of RTS during extreme storm gusts.
 * Limit: MWT ≤ 40% (elastic zone), up to 50% max permissible storm overload.
 * @param {number} maxSupportTensionN
 * @param {number} ratedTensileStrengthN
 * @returns {number} MWT % of RTS
 */
export function calculateMaxWorkingTensionPercent(maxSupportTensionN, ratedTensileStrengthN) {
  const t = Math.max(0, Number(maxSupportTensionN) || 0);
  const rts = Math.max(100.0, Number(ratedTensileStrengthN) || 1000.0);
  return Number(((t / rts) * 100.0).toFixed(2));
}

/**
 * Evaluates aeolian vibration vortex shedding frequency and vibration damper requirements.
 * Strouhal relation: f = (St * v) / D_m where St ≈ 0.185 (vortex shedding constant)
 * @param {number} spanLengthM
 * @param {number} cableOdMm
 * @param {number} edsPercent
 * @returns {{ vortexFrequencyHz: number, dampersRequired: boolean, recommendedDamperCount: number, damperType: string, rationale: string }}
 */
export function calculateAeolianFrequencyAndDampers(spanLengthM, cableOdMm, edsPercent) {
  const span = Math.max(1.0, Number(spanLengthM) || 50.0);
  const odM = Math.max(0.001, (Number(cableOdMm) || 10.0) / 1000.0);
  const eds = Math.max(0, Number(edsPercent) || 15.0);

  // Typical low-velocity steady laminar wind that generates aeolian standing waves: 3.5 m/s (~12.6 km/h)
  const laminarBreezeMps = 3.5;
  const strouhal = 0.185;
  const frequency = (strouhal * laminarBreezeMps) / odM;

  let dampersRequired = false;
  let count = 0;
  let rationale = '';
  let damperType = 'None Required';

  if (span > 150.0) {
    dampersRequired = true;
    count = 4;
    damperType = 'Stockbridge / Spiral Vibration Damper (Dual Each End)';
    rationale = `Span length (${span}m) exceeds 150m long-span threshold; 4 dampers mandated to prevent standing-wave fatigue.`;
  } else if (span > 70.0 || eds > 18.0) {
    dampersRequired = true;
    count = 2;
    damperType = 'Spiral Vibration Damper (SVD, 1 Each End)';
    rationale = span > 70.0
      ? `Span length (${span}m) exceeds 70m aerial threshold; 2 spiral vibration dampers required near dead-end clamps.`
      : `Everyday stress (${eds}% RTS) exceeds 18% safe fatigue threshold; dampers required to suppress high-frequency fatigue.`;
  } else {
    dampersRequired = false;
    count = 0;
    damperType = 'None Required';
    rationale = `Span (${span}m) and EDS (${eds}% RTS) are within natural damping envelope; no external dampers necessary.`;
  }

  return {
    vortexFrequencyHz: Number(frequency.toFixed(1)),
    dampersRequired,
    recommendedDamperCount: count,
    damperType,
    rationale
  };
}

/**
 * Full structural and optical evaluation of an aerial ADSS or Figure-8 fiber span.
 * @param {Object} input
 * @returns {Object} detailed metrology analysis report
 */
export function evaluateAdssSagTension(input = {}) {
  const cableType = ADSS_CABLE_TYPES[input.cableTypeId] || ADSS_CABLE_TYPES['ADSS_24F_100M'];
  const envCondition = ADSS_ENV_CONDITIONS[input.envConditionId] || ADSS_ENV_CONDITIONS['SPRING_EDS_NOMINAL'];
  const crossingClass = CROSSING_CLASSES[input.crossingClassId] || CROSSING_CLASSES['RESIDENTIAL_STREET'];

  const spanLengthM = Math.max(5.0, Number(input.spanLengthM) || 50.0);
  const poleAttachmentHeightM = Math.max(3.0, Number(input.poleAttachmentHeightM) || 8.0);
  const initialTensionN = Math.max(50.0, Number(input.initialTensionN) || 800.0);
  const hasVibrationDamperInstalled = Boolean(input.hasVibrationDamperInstalled);

  // Aerodynamic wind and resultant loads
  const windForcePerM = calculateAerodynamicWindForce(envCondition.windGustKmh, cableType.cableOdMm);
  const loadVector = calculateResultantUnitLoad(cableType.weightKgPerM, windForcePerM);

  // Sag and geometric deflection
  const sagProfile = calculateMidspanSag(
    loadVector.resultantUnitLoadN,
    spanLengthM,
    initialTensionN,
    loadVector.blowoutAngleDeg
  );

  // Support tensions and stress limits
  const maxSupportTensionN = calculateMaxCableTension(
    initialTensionN,
    loadVector.resultantUnitLoadN,
    sagProfile.resultantSagM
  );

  const edsPercent = calculateEverydayStressPercent(initialTensionN, cableType.ratedTensileStrengthN);
  const mwtPercent = calculateMaxWorkingTensionPercent(maxSupportTensionN, cableType.ratedTensileStrengthN);

  // Ground and Right-of-Way clearance
  const netGroundClearanceM = Number((poleAttachmentHeightM - sagProfile.verticalSagM).toFixed(3));
  const clearanceMarginM = Number((netGroundClearanceM - crossingClass.minClearanceM).toFixed(3));
  const clearancePass = netGroundClearanceM >= crossingClass.minClearanceM;

  // Aeolian vibration & dampers
  const vibration = calculateAeolianFrequencyAndDampers(spanLengthM, cableType.cableOdMm, edsPercent);

  // Overall verdict synthesis
  let verdictKey = 'CERTIFIED_OPTIMAL';
  const deficiencyList = [];

  if (!clearancePass) {
    verdictKey = 'FAILED_CLEARANCE_HAZARD';
    deficiencyList.push(`Ground clearance (${netGroundClearanceM}m) drops below mandatory ${crossingClass.minClearanceM}m limit for ${crossingClass.name}.`);
  }

  if (edsPercent > 20.0 || mwtPercent > 50.0) {
    verdictKey = 'FAILED_OVERTENSION_FATIGUE';
    if (edsPercent > 20.0) {
      deficiencyList.push(`Everyday stress (${edsPercent}% RTS) exceeds 20% aramid fatigue snap limit.`);
    }
    if (mwtPercent > 50.0) {
      deficiencyList.push(`Maximum working storm tension (${mwtPercent}% RTS) exceeds 50% elastic proof rating.`);
    }
  } else if (verdictKey === 'CERTIFIED_OPTIMAL') {
    if (edsPercent > 18.0 || (vibration.dampersRequired && !hasVibrationDamperInstalled)) {
      verdictKey = 'CONDITIONAL_PASS';
      if (edsPercent > 18.0) {
        deficiencyList.push(`Everyday stress (${edsPercent}% RTS) is elevated (>18%); vibration dampers required to safeguard long-term life.`);
      }
      if (vibration.dampersRequired && !hasVibrationDamperInstalled) {
        deficiencyList.push(`Span length (${spanLengthM}m) requires ${vibration.recommendedDamperCount} spiral vibration dampers, which are currently uninstalled.`);
      }
    }
  }

  const verdict = ADSS_VERDICTS[verdictKey];

  return {
    cableType,
    envCondition,
    crossingClass,
    spanLengthM,
    poleAttachmentHeightM,
    initialTensionN,
    hasVibrationDamperInstalled,
    loadVector,
    sagProfile,
    maxSupportTensionN,
    edsPercent,
    mwtPercent,
    netGroundClearanceM,
    clearanceMarginM,
    clearancePass,
    vibration,
    verdict,
    deficiencyList,
    testedAt: new Date().toISOString()
  };
}

/**
 * Validates user input fields for the ADSS Sag & Tension certification form.
 * @param {Object} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAdssSagTensionInput(input = {}) {
  const errors = [];

  if (!input.customer || !String(input.customer).trim()) {
    errors.push('Subscriber name or network span owner is required.');
  }

  if (!input.route || !String(input.route).trim()) {
    errors.push('Route, pole IDs, and span location are required.');
  }

  const span = Number(input.spanLengthM);
  if (isNaN(span) || span < 5.0 || span > 500.0) {
    errors.push('Span length must be between 5 and 500 meters.');
  }

  const poleHeight = Number(input.poleAttachmentHeightM);
  if (isNaN(poleHeight) || poleHeight < 3.0 || poleHeight > 40.0) {
    errors.push('Pole attachment height must be between 3.0 and 40.0 meters.');
  }

  const tension = Number(input.initialTensionN);
  if (isNaN(tension) || tension < 50.0 || tension > 25000.0) {
    errors.push('Stringing tension must be between 50 and 25,000 Newtons.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Builds an immutable certificate record with an official identifier.
 * Format: ADSS-YYYYMM-XXXX
 * @param {Object} input
 * @param {Object} [analysisResult]
 * @returns {Object} complete certificate record
 */
export function buildAdssSagTensionRecord(input = {}, analysisResult = null) {
  const analysis = analysisResult || evaluateAdssSagTension(input);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const certId = `ADSS-${year}${month}-${rand}`;

  return {
    certId,
    timestamp: now.toISOString(),
    customer: String(input.customer || 'Shahdara Network Subscriber').trim(),
    route: String(input.route || 'Baradari Central Feeder Span').trim(),
    technicianName: String(input.technicianName || 'Shahdara OSP Aerial Lineworker').trim(),
    status: analysis.verdict.id === 'FAILED_CLEARANCE_HAZARD' || analysis.verdict.id === 'FAILED_OVERTENSION_FATIGUE' ? 'ACTION_REQUIRED' : 'VERIFIED',
    analysis
  };
}

let inMemoryAdssCerts = [];

/**
 * Retrieves saved ADSS certificates from LocalStorage or in-memory fallback.
 * @param {Object} [state]
 * @returns {Array} list of certificate records
 */
export function getSavedAdssSagTensionCerts(state = {}) {
  if (state && typeof state === 'object' && Array.isArray(state.adssCerts)) {
    return state.adssCerts;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(ADSS_SAG_TENSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // storage fallback
    }
  }
  return inMemoryAdssCerts;
}

/**
 * Saves an ADSS certificate record to LocalStorage (FIFO capacity: 100 records).
 * @param {Object} record
 * @param {Object} [state]
 * @returns {Array} updated certificates list
 */
export function saveAdssSagTensionCert(record, state = {}) {
  const current = getSavedAdssSagTensionCerts(state);
  const filtered = current.filter(c => c.certId !== record.certId);
  filtered.unshift(record);
  if (filtered.length > 100) {
    filtered.pop();
  }
  inMemoryAdssCerts = filtered;
  if (state && typeof state === 'object') {
    state.adssCerts = filtered;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ADSS_SAG_TENSION_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      // storage fallback
    }
  }
  return filtered;
}

/**
 * Updates status of an existing certificate (VERIFIED, RESOLVED, ACTION_REQUIRED).
 * @param {string} certId
 * @param {string} newStatus
 * @param {Object} [state]
 * @returns {Array} updated certificates list
 */
export function updateAdssSagTensionCertStatus(certId, newStatus, state = {}) {
  const current = getSavedAdssSagTensionCerts(state);
  const item = current.find(c => c.certId === certId);
  if (item) {
    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
  }
  inMemoryAdssCerts = current;
  if (state && typeof state === 'object') {
    state.adssCerts = current;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ADSS_SAG_TENSION_STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      // storage fallback
    }
  }
  return current;
}

/**
 * Clears all saved ADSS certificates from LocalStorage and in-memory.
 * @param {Object} [state]
 */
export function clearAdssSagTensionCerts(state = {}) {
  inMemoryAdssCerts = [];
  if (state && typeof state === 'object') {
    state.adssCerts = [];
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(ADSS_SAG_TENSION_STORAGE_KEY);
    } catch (e) {
      // storage fallback
    }
  }
  return [];
}

/**
 * Calculates high-level aggregate KPI metrics for all saved ADSS certificates.
 * @param {Array} [certs]
 * @returns {Object} aggregate metrics
 */
export function calculateAdssSagTensionMetrics(certs = null) {
  const list = certs || getSavedAdssSagTensionCerts();
  const total = list.length;
  if (total === 0) {
    return {
      totalInspections: 0,
      optimalCount: 0,
      conditionalCount: 0,
      failedClearanceCount: 0,
      failedTensionCount: 0,
      passRatePercent: 0,
      avgSpanLengthM: 0,
      dampersRequiredCount: 0
    };
  }

  let optimal = 0;
  let conditional = 0;
  let failClearance = 0;
  let failTension = 0;
  let spanSum = 0;
  let dampersReq = 0;

  list.forEach(c => {
    const vId = c.analysis?.verdict?.id;
    if (vId === 'CERTIFIED_OPTIMAL') optimal++;
    else if (vId === 'CONDITIONAL_PASS') conditional++;
    else if (vId === 'FAILED_CLEARANCE_HAZARD') failClearance++;
    else if (vId === 'FAILED_OVERTENSION_FATIGUE') failTension++;

    spanSum += Number(c.analysis?.spanLengthM) || 0;
    if (c.analysis?.vibration?.dampersRequired) dampersReq++;
  });

  const passingTotal = optimal + conditional;
  const passRate = Number(((passingTotal / total) * 100.0).toFixed(1));
  const avgSpan = Number((spanSum / total).toFixed(1));

  return {
    totalInspections: total,
    optimalCount: optimal,
    conditionalCount: conditional,
    failedClearanceCount: failClearance,
    failedTensionCount: failTension,
    passRatePercent: passRate,
    avgSpanLengthM: avgSpan,
    dampersRequiredCount: dampersReq
  };
}

/**
 * Pure-vector SVG visualizer rendering utility poles, catenary sag profile,
 * road clearance boundary, wind deflection, dampers, and telemetry HUD ribbon.
 * @param {Object} analysis
 * @returns {string} pure SVG markup
 */
export function renderAdssSagTensionSvg(analysis) {
  if (!analysis) return '';

  const {
    spanLengthM,
    poleAttachmentHeightM,
    loadVector,
    sagProfile,
    netGroundClearanceM,
    crossingClass,
    edsPercent,
    mwtPercent,
    vibration,
    verdict,
    hasVibrationDamperInstalled
  } = analysis;

  const w = 780;
  const h = 330;

  // Geometry coordinate mapping
  const poleLeftX = 110;
  const poleRightX = 670;
  const groundY = 270;
  const spanPixelWidth = poleRightX - poleLeftX; // 560px

  // Scale pole height to pixels: max pole height range ~15m -> ~180px
  const scaleY = 180.0 / Math.max(12.0, poleAttachmentHeightM * 1.15);
  const attachmentY = groundY - (poleAttachmentHeightM * scaleY);

  // Sag in pixels
  const sagVertPx = Math.min(120, sagProfile.verticalSagM * scaleY);
  const midX = (poleLeftX + poleRightX) / 2;
  const midY = attachmentY + sagVertPx;

  // Clearance boundary line in pixels
  const minClearancePx = crossingClass.minClearanceM * scaleY;
  const clearanceLineY = groundY - minClearancePx;

  // Path for parabolic catenary sag curve (calm / vertical)
  // Bezier curve approximation: Q midX (attachmentY + 2 * sagVertPx)
  const catenaryPath = `M ${poleLeftX} ${attachmentY} Q ${midX} ${attachmentY + (2.0 * sagVertPx)} ${poleRightX} ${attachmentY}`;

  // Wind-deflected curve (dashed amber/magenta blowout curve)
  const blowoutShiftPx = Math.min(25, loadVector.blowoutAngleDeg * 0.4);
  const windCatenaryPath = `M ${poleLeftX} ${attachmentY} Q ${midX + blowoutShiftPx} ${attachmentY + (2.0 * sagVertPx) - (blowoutShiftPx * 0.2)} ${poleRightX} ${attachmentY}`;

  // Verdict status color
  const statusColor = verdict.color || '#10b981';

  // Ground clearance status badge color
  const clearanceBadgeColor = analysis.clearancePass ? '#16a34a' : '#dc2626';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%"  class="adss-sag-tension-svg" style="background:#090d16; border-radius:8px; font-family:system-ui,-apple-system,sans-serif;">
      <defs>
        <linearGradient id="adssPoleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#475569" />
          <stop offset="50%" stop-color="#94a3b8" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
        <linearGradient id="adssRoadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <filter id="adssGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <marker id="adssArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
        </marker>
        <marker id="adssArrowDanger" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#f87171" />
        </marker>
      </defs>

      <!-- Background Grid -->
      <g stroke="#1e293b" stroke-width="0.8" opacity="0.6">
        <line x1="50" y1="40" x2="730" y2="40" />
        <line x1="50" y1="90" x2="730" y2="90" />
        <line x1="50" y1="140" x2="730" y2="140" />
        <line x1="50" y1="190" x2="730" y2="190" />
        <line x1="50" y1="240" x2="730" y2="240" />
      </g>

      <!-- Road & Ground Surface -->
      <rect x="30" y="${groundY}" width="720" height="45" fill="url(#adssRoadGrad)" rx="3" stroke="#334155" stroke-width="1" />
      <line x1="30" y1="${groundY}" x2="750" y2="${groundY}" stroke="#64748b" stroke-width="2" />
      <text x="50" y="${groundY + 24}" fill="#94a3b8" font-size="11" font-weight="600">
        Right-of-Way Surface: ${crossingClass.name} (Mandatory Clearance ≥ ${crossingClass.minClearanceM}m)
      </text>

      <!-- Regulatory Minimum Clearance Threshold Plane -->
      <line x1="90" y1="${clearanceLineY}" x2="690" y2="${clearanceLineY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5,4" />
      <text x="695" y="${clearanceLineY + 3}" fill="#f87171" font-size="9.5" font-weight="700">
        MIN CLR ${crossingClass.minClearanceM}m
      </text>

      <!-- Utility Pole Left -->
      <g>
        <rect x="${poleLeftX - 7}" y="${attachmentY - 15}" width="14" height="${groundY - attachmentY + 15}" fill="url(#adssPoleGrad)" rx="2" />
        <line x1="${poleLeftX - 16}" y1="${attachmentY}" x2="${poleLeftX + 16}" y2="${attachmentY}" stroke="#e2e8f0" stroke-width="3" />
        <circle cx="${poleLeftX}" cy="${attachmentY}" r="4" fill="#38bdf8" />
        <text x="${poleLeftX}" y="${groundY + 38}" fill="#cbd5e1" font-size="10" text-anchor="middle" font-weight="600">POLE A (${poleAttachmentHeightM}m)</text>
      </g>

      <!-- Utility Pole Right -->
      <g>
        <rect x="${poleRightX - 7}" y="${attachmentY - 15}" width="14" height="${groundY - attachmentY + 15}" fill="url(#adssPoleGrad)" rx="2" />
        <line x1="${poleRightX - 16}" y1="${attachmentY}" x2="${poleRightX + 16}" y2="${attachmentY}" stroke="#e2e8f0" stroke-width="3" />
        <circle cx="${poleRightX}" cy="${attachmentY}" r="4" fill="#38bdf8" />
        <text x="${poleRightX}" y="${groundY + 38}" fill="#cbd5e1" font-size="10" text-anchor="middle" font-weight="600">POLE B (${poleAttachmentHeightM}m)</text>
      </g>

      <!-- Span Dimension Line Top -->
      <g stroke="#38bdf8" stroke-width="1.2">
        <line x1="${poleLeftX}" y1="${attachmentY - 22}" x2="${poleRightX}" y2="${attachmentY - 22}" marker-start="url(#adssArrow)" marker-end="url(#adssArrow)" />
        <line x1="${poleLeftX}" y1="${attachmentY - 28}" x2="${poleLeftX}" y2="${attachmentY - 16}" />
        <line x1="${poleRightX}" y1="${attachmentY - 28}" x2="${poleRightX}" y2="${attachmentY - 16}" />
      </g>
      <rect x="${midX - 55}" y="${attachmentY - 33}" width="110" height="18" fill="#090d16" rx="3" stroke="#0284c7" stroke-width="0.8" />
      <text x="${midX}" y="${attachmentY - 20}" fill="#38bdf8" font-size="10.5" font-weight="700" text-anchor="middle">
        SPAN L = ${spanLengthM}m
      </text>

      <!-- Wind-Deflected Blowout Curve (Dashed) -->
      ${loadVector.blowoutAngleDeg > 2 ? `
        <path d="${windCatenaryPath}" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-dasharray="6,4" opacity="0.85" />
        <text x="${midX + blowoutShiftPx + 8}" y="${midY - 8}" fill="#fbbf24" font-size="9.5" font-weight="600">
          Blowout: ${sagProfile.horizontalBlowoutSagM}m (${loadVector.blowoutAngleDeg}°)
        </text>
      ` : ''}

      <!-- Main Catenary Sag Curve (Solid) -->
      <path d="${catenaryPath}" fill="none" stroke="${statusColor}" stroke-width="3" filter="url(#adssGlow)" />

      <!-- Vibration Dampers (if required or installed) -->
      ${vibration.dampersRequired ? `
        <!-- Damper Pole Left -->
        <g transform="translate(${poleLeftX + 35}, ${attachmentY + 8})">
          <rect x="-4" y="-8" width="8" height="16" fill="${hasVibrationDamperInstalled ? '#10b981' : '#ef4444'}" rx="2" />
          <circle cx="0" cy="11" r="3.5" fill="#94a3b8" />
          <circle cx="0" cy="-11" r="3.5" fill="#94a3b8" />
        </g>
        <!-- Damper Pole Right -->
        <g transform="translate(${poleRightX - 35}, ${attachmentY + 8})">
          <rect x="-4" y="-8" width="8" height="16" fill="${hasVibrationDamperInstalled ? '#10b981' : '#ef4444'}" rx="2" />
          <circle cx="0" cy="11" r="3.5" fill="#94a3b8" />
          <circle cx="0" cy="-11" r="3.5" fill="#94a3b8" />
        </g>
        <text x="${poleLeftX + 40}" y="${attachmentY + 36}" fill="${hasVibrationDamperInstalled ? '#34d399' : '#f87171'}" font-size="9" font-weight="700">
          ${hasVibrationDamperInstalled ? '✓ DAMPER INSTALLED' : '⚠ DAMPER MISSING'}
        </text>
      ` : ''}

      <!-- Midspan Sag Indicator Dimension -->
      <g stroke="#38bdf8" stroke-width="1.2">
        <line x1="${midX}" y1="${attachmentY}" x2="${midX}" y2="${midY}" marker-end="url(#adssArrow)" />
        <line x1="${midX - 12}" y1="${attachmentY}" x2="${midX + 12}" y2="${attachmentY}" stroke-dasharray="2,2" />
      </g>
      <rect x="${midX - 78}" y="${attachmentY + (sagVertPx / 2) - 10}" width="70" height="18" fill="#0f172a" rx="3" stroke="#38bdf8" stroke-width="0.8" />
      <text x="${midX - 43}" y="${attachmentY + (sagVertPx / 2) + 3}" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">
        Sag: ${sagProfile.verticalSagM}m
      </text>

      <!-- Ground Clearance Dimension -->
      <g stroke="${clearanceBadgeColor}" stroke-width="1.4">
        <line x1="${midX + 45}" y1="${midY}" x2="${midX + 45}" y2="${groundY}" marker-start="url(#adssArrow)" marker-end="url(#adssArrow)" />
        <line x1="${midX + 35}" y1="${midY}" x2="${midX + 55}" y2="${midY}" />
        <line x1="${midX + 35}" y1="${groundY}" x2="${midX + 55}" y2="${groundY}" />
      </g>
      <rect x="${midX + 55}" y="${midY + ((groundY - midY) / 2) - 11}" width="105" height="20" fill="#0f172a" rx="4" stroke="${clearanceBadgeColor}" stroke-width="1.2" />
      <text x="${midX + 107}" y="${midY + ((groundY - midY) / 2) + 3}" fill="${clearanceBadgeColor}" font-size="10" font-weight="800" text-anchor="middle">
        Clearance: ${netGroundClearanceM}m
      </text>

      <!-- Top Telemetry HUD Ribbon -->
      <rect x="25" y="8" width="730" height="26" fill="#0f172a" rx="4" stroke="#1e293b" stroke-width="1" />
      <text x="40" y="25" fill="#38bdf8" font-size="10.5" font-weight="700">
        TENSION: ${analysis.initialTensionN} N
      </text>
      <text x="170" y="25" fill="#a78bfa" font-size="10.5" font-weight="700">
        EDS: ${edsPercent}% RTS (Max 18%)
      </text>
      <text x="350" y="25" fill="#fbbf24" font-size="10.5" font-weight="700">
        MWT GUST: ${mwtPercent}% RTS (Max 40%)
      </text>
      <text x="540" y="25" fill="${clearanceBadgeColor}" font-size="10.5" font-weight="800">
        VERDICT: ${verdict.name}
      </text>
    </svg>
  `;
}

/**
 * Generates printable HTML documents (Formal A4 QA Certificate & 80mm POS Thermal Slip).
 * @param {Object} certRecord
 * @param {Object} options
 * @returns {string} full HTML document
 */
export function generateAdssSagTensionCertHtml(certRecord, options = { format: 'a4' }) {
  if (!certRecord || !certRecord.analysis) return '';

  const { certId, timestamp, customer, route, technicianName, analysis } = certRecord;
  const {
    cableType,
    envCondition,
    crossingClass,
    spanLengthM,
    poleAttachmentHeightM,
    initialTensionN,
    maxSupportTensionN,
    sagProfile,
    loadVector,
    netGroundClearanceM,
    clearanceMarginM,
    edsPercent,
    mwtPercent,
    vibration,
    verdict,
    hasVibrationDamperInstalled,
    deficiencyList
  } = analysis;

  const isA4 = options.format !== 'thermal';
  const dateStr = new Date(timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  if (isA4) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>ADSS Sag & Tension QA Accreditation Certificate - ${certId}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; line-height: 1.4; margin: 0; padding: 0; background: #fff; font-size: 11pt; }
          .cert-container { border: 2px solid #0284c7; padding: 24px; border-radius: 8px; position: relative; }
          .cert-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px; }
          .cert-title h1 { margin: 0; font-size: 18pt; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; }
          .cert-title h2 { margin: 4px 0 0; font-size: 11pt; color: #64748b; font-weight: 500; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 10pt; text-transform: uppercase; }
          .badge-optimal { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .badge-conditional { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
          .badge-hazard { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .metric-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 6px; }
          .metric-label { font-size: 8.5pt; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 3px; }
          .metric-val { font-size: 13pt; font-weight: 700; color: #0f172a; }
          .metric-sub { font-size: 8.5pt; color: #475569; margin-top: 2px; }
          table.data-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 16px; font-size: 9.5pt; }
          table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
          table.data-table th { background: #f1f5f9; font-weight: 600; color: #334155; }
          .signature-row { display: flex; justify-content: space-between; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
          .sig-box { width: 42%; text-align: center; }
          .sig-line { border-bottom: 1px dashed #64748b; margin-bottom: 6px; height: 36px; }
        </style>
      </head>
      <body>
        <div class="cert-container">
          <div class="cert-header">
            <div class="cert-title">
              <h1>Outside Plant Aerial ADSS &amp; Span Sag QA Certificate</h1>
              <h2>Shahdara Telecom Outside Plant Quality Assurance &amp; Civil Safety Division</h2>
              <p style="margin:4px 0 0; font-size:9pt; color:#64748b;">Standards: IEEE 1222 · IEC 60794-4-20 · NESC Rule 232 · WAPDA Overhead Regulations</p>
            </div>
            <div style="text-align: right;">
              <span class="badge ${verdict.id === 'CERTIFIED_OPTIMAL' ? 'badge-optimal' : verdict.id === 'CONDITIONAL_PASS' ? 'badge-conditional' : 'badge-hazard'}">
                ${verdict.name}
              </span>
              <div style="font-size: 9pt; color: #64748b; margin-top: 6px;">Certificate ID: <strong>${certId}</strong></div>
              <div style="font-size: 9pt; color: #64748b;">Issued: ${dateStr}</div>
            </div>
          </div>

          <div class="grid-2">
            <div class="metric-box">
              <div class="metric-label">Route / Span Demarcation</div>
              <div style="font-weight: 700; font-size: 11pt;">${route}</div>
              <div class="metric-sub">Subscriber / Node: <strong>${customer}</strong></div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Right-of-Way Crossing Authority</div>
              <div style="font-weight: 700; font-size: 11pt;">${crossingClass.name}</div>
              <div class="metric-sub">Mandatory Clearance: <strong>≥ ${crossingClass.minClearanceM} m</strong> (${crossingClass.authority})</div>
            </div>
          </div>

          <div class="grid-3">
            <div class="metric-box">
              <div class="metric-label">Mid-Span Vertical Sag</div>
              <div class="metric-val">${sagProfile.verticalSagM} m</div>
              <div class="metric-sub">${sagProfile.sagPercentOfSpan}% of ${spanLengthM}m span</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Net Ground Clearance</div>
              <div class="metric-val" style="color: ${analysis.clearancePass ? '#16a34a' : '#dc2626'}">${netGroundClearanceM} m</div>
              <div class="metric-sub">Margin: ${clearanceMarginM >= 0 ? '+' : ''}${clearanceMarginM} m vs threshold</div>
            </div>
            <div class="metric-box">
              <div class="metric-label">Everyday Stress (EDS)</div>
              <div class="metric-val" style="color: ${edsPercent <= 18 ? '#16a34a' : edsPercent <= 20 ? '#d97706' : '#dc2626'}">${edsPercent}% RTS</div>
              <div class="metric-sub">Initial Tension: ${initialTensionN} N (Max 18%)</div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Metrology Parameter</th>
                <th>Engineering Value</th>
                <th>Standard Reference Limit</th>
                <th>Compliance Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Optical Cable Specification</strong></td>
                <td>${cableType.name} (OD: ${cableType.cableOdMm}mm, Wt: ${cableType.weightKgPerM} kg/m)</td>
                <td>Rated Tensile Strength: ${cableType.ratedTensileStrengthN} N</td>
                <td><strong style="color:#0284c7">VERIFIED</strong></td>
              </tr>
              <tr>
                <td><strong>Environmental Loading State</strong></td>
                <td>${envCondition.name} (${envCondition.temperatureC}°C, Gust: ${envCondition.windGustKmh} km/h)</td>
                <td>Aerodynamic Load: ${loadVector.unitWindForceN} N/m</td>
                <td><strong>${loadVector.blowoutAngleDeg}° Swing</strong></td>
              </tr>
              <tr>
                <td><strong>Support Dead-End Tension</strong></td>
                <td>Max T: ${maxSupportTensionN} N (MWT: ${mwtPercent}% RTS)</td>
                <td>Storm Working Tension ≤ 40% RTS</td>
                <td><strong style="color:${mwtPercent <= 40 ? '#16a34a' : '#dc2626'}">${mwtPercent <= 40 ? 'SAFE ELASTIC' : 'OVERLOAD'}</strong></td>
              </tr>
              <tr>
                <td><strong>Aeolian Vibration &amp; Dampers</strong></td>
                <td>Vortex Frequency: ${vibration.vortexFrequencyHz} Hz · ${vibration.damperType}</td>
                <td>Dampers Installed: ${hasVibrationDamperInstalled ? 'Yes (Verified)' : 'None'}</td>
                <td><strong style="color:${!vibration.dampersRequired || hasVibrationDamperInstalled ? '#16a34a' : '#d97706'}">${!vibration.dampersRequired || hasVibrationDamperInstalled ? 'PROTECTED' : 'ACTION ADVISORY'}</strong></td>
              </tr>
            </tbody>
          </table>

          ${deficiencyList.length > 0 ? `
            <div style="background:#fef2f2; border:1px solid #f87171; border-radius:6px; padding:10px 14px; margin-bottom:16px;">
              <strong style="color:#991b1b; font-size:9.5pt;">Mandatory Remedial Actions / Deficiencies:</strong>
              <ul style="margin:4px 0 0 16px; padding:0; font-size:9pt; color:#b91c1c;">
                ${deficiencyList.map(d => `<li>${d}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="signature-row">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div style="font-weight:700; font-size:9.5pt;">${technicianName}</div>
              <div style="font-size:8pt; color:#64748b;">OSP Certified Aerial Lineworker / Rigger</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div style="font-weight:700; font-size:9.5pt;">Chief Structural &amp; Optical Engineer</div>
              <div style="font-size:8pt; color:#64748b;">Shahdara Telecom Network Operations Center</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // 80mm Thermal POS Slip Format
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>POS Slip - ${certId}</title>
      <style>
        @page { size: 80mm auto; margin: 3mm; }
        body { font-family: "Courier New", Courier, monospace; width: 74mm; margin: 0 auto; padding: 2mm; font-size: 9pt; color: #000; line-height: 1.25; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .sep { border-top: 1px dashed #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; }
      </style>
    </head>
    <body>
      <div class="center bold">SHAHDARA TELECOM OSP</div>
      <div class="center">AERIAL ADSS SAG &amp; TENSION SLIP</div>
      <div class="center">Standards: IEEE 1222 / NESC 232</div>
      <div class="sep"></div>
      <div class="row"><span>CERT:</span><span>${certId}</span></div>
      <div class="row"><span>DATE:</span><span>${dateStr}</span></div>
      <div class="row"><span>TECH:</span><span>${technicianName}</span></div>
      <div class="row"><span>CUST:</span><span>${customer}</span></div>
      <div class="sep"></div>
      <div class="bold">SPAN METROLOGY:</div>
      <div class="row"><span>Span Length:</span><span>${spanLengthM} m</span></div>
      <div class="row"><span>Pole Height:</span><span>${poleAttachmentHeightM} m</span></div>
      <div class="row"><span>Cable Type:</span><span>${cableType.id}</span></div>
      <div class="row"><span>Env State:</span><span>${envCondition.id}</span></div>
      <div class="sep"></div>
      <div class="bold">TENSION &amp; SAG:</div>
      <div class="row"><span>Initial Tension:</span><span>${initialTensionN} N</span></div>
      <div class="row"><span>Vertical Sag:</span><span>${sagProfile.verticalSagM} m</span></div>
      <div class="row"><span>Net Clearance:</span><span class="bold">${netGroundClearanceM} m</span></div>
      <div class="row"><span>Req Clearance:</span><span>≥ ${crossingClass.minClearanceM} m</span></div>
      <div class="row"><span>EDS (% RTS):</span><span>${edsPercent}%</span></div>
      <div class="row"><span>MWT (% RTS):</span><span>${mwtPercent}%</span></div>
      <div class="row"><span>Dampers:</span><span>${hasVibrationDamperInstalled ? 'INSTALLED' : 'NONE'}</span></div>
      <div class="sep"></div>
      <div class="center bold" style="font-size:11pt;">*** ${verdict.id} ***</div>
      <div class="center">${verdict.name}</div>
      <div class="sep"></div>
      <div style="height: 25px;"></div>
      <div class="center">Lineman Signature: __________________</div>
      <div class="center" style="font-size:7pt; margin-top:4px;">Shahdara ISP Offline Field POS</div>
    </body>
    </html>
  `;
}

/**
 * Formats bilingual Urdu & English WhatsApp technician dispatch and lineworker notice.
 * @param {Object} certRecord
 * @returns {string} WhatsApp formatted text
 */
export function formatAdssSagTensionCertWhatsApp(certRecord) {
  if (!certRecord || !certRecord.analysis) return '';

  const { certId, customer, route, technicianName, analysis } = certRecord;
  const {
    spanLengthM,
    poleAttachmentHeightM,
    initialTensionN,
    sagProfile,
    netGroundClearanceM,
    crossingClass,
    edsPercent,
    mwtPercent,
    vibration,
    verdict,
    hasVibrationDamperInstalled
  } = analysis;

  const isPass = verdict.id === 'CERTIFIED_OPTIMAL';
  const icon = isPass ? '✅' : verdict.id === 'CONDITIONAL_PASS' ? '⚠️' : '🚨';

  return `*${icon} SHAHDARA ISP · AERIAL ADSS SAG & TENSION QA*
*سرٹیفکیٹ برائے فضائی فائبر آپٹک تناؤ اور کلیئرنس*
---------------------------------------
📋 *Certificate:* ${certId}
👤 *Subscriber / Node:* ${customer}
📍 *Route:* ${route}
👷 *Lineworker:* ${technicianName}

📏 *Span Metrology / پیمائش:*
• Span Length (فاصلہ): *${spanLengthM} m*
• Pole Height (کھمبے کی اونچائی): *${poleAttachmentHeightM} m*
• Crossing: *${crossingClass.name}*

⚡ *Tension & Sag / تناؤ اور جھول:*
• Initial Stringing Tension: *${initialTensionN} N*
• Vertical Sag (درمیانی جھول): *${sagProfile.verticalSagM} m* (${sagProfile.sagPercentOfSpan}%)
• Ground Clearance (زمین سے اونچائی): *${netGroundClearanceM} m* (Limit: ≥ ${crossingClass.minClearanceM}m)
• Everyday Stress (EDS): *${edsPercent}% RTS* (Max Safe: 18%)
• Storm Max Tension (MWT): *${mwtPercent}% RTS*
• Vibration Dampers: *${hasVibrationDamperInstalled ? 'Installed ✓' : vibration.dampersRequired ? 'Mandatory Required ⚠️' : 'Not Required'}*

⚖️ *QA Verdict:* *${verdict.name}*
${isPass ? '✓ All WAPDA/NESC clearance and IEEE 1222 fatigue stress limits verified.' : '⚠️ Immediate lineman action required: check sag, re-tension, or fit spiral vibration dampers.'}

_Shahdara Outside Plant & Civil Safety Division_`;
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM.
 * @param {Array} certs
 * @returns {string} CSV text
 */
export function generateAdssSagTensionCertsCsv(certs = null) {
  const list = certs || getSavedAdssSagTensionCerts();
  const headers = [
    'Certificate ID',
    'Date',
    'Customer',
    'Route / Location',
    'Technician',
    'Cable Type',
    'Environmental State',
    'Crossing Authority',
    'Span Length (m)',
    'Pole Height (m)',
    'Initial Tension (N)',
    'Vertical Sag (m)',
    'Sag Percent (%)',
    'Net Clearance (m)',
    'Required Clearance (m)',
    'Clearance Margin (m)',
    'EDS (% RTS)',
    'MWT (% RTS)',
    'Dampers Required',
    'Dampers Installed',
    'Verdict ID',
    'Status'
  ];

  const escape = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = list.map(c => {
    const a = c.analysis || {};
    return [
      escape(c.certId),
      escape(c.timestamp),
      escape(c.customer),
      escape(c.route),
      escape(c.technicianName),
      escape(a.cableType?.id),
      escape(a.envCondition?.id),
      escape(a.crossingClass?.id),
      escape(a.spanLengthM),
      escape(a.poleAttachmentHeightM),
      escape(a.initialTensionN),
      escape(a.sagProfile?.verticalSagM),
      escape(a.sagProfile?.sagPercentOfSpan),
      escape(a.netGroundClearanceM),
      escape(a.crossingClass?.minClearanceM),
      escape(a.clearanceMarginM),
      escape(a.edsPercent),
      escape(a.mwtPercent),
      escape(a.vibration?.dampersRequired ? 'YES' : 'NO'),
      escape(a.hasVibrationDamperInstalled ? 'YES' : 'NO'),
      escape(a.verdict?.id),
      escape(c.status)
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Controller setting up the modal dialog, interactive recalculation,
 * live SVG preview, preset selection, printable views, and history table.
 * @param {Object} options
 * @returns {Object} modal controller instance
 */
export function setupAdssSagTensionModal(options = {}) {
  const modal = document.getElementById('adssSagTensionModal');
  if (!modal) return null;

  const triggerButton = options.triggerButton || document.getElementById('openAdssSagTensionBtn');
  const closeBtn = document.getElementById('adssSagTensionCloseBtn');
  const presetSelect = document.getElementById('adssPresetSelect');
  const custInput = document.getElementById('adssCustInput');
  const routeInput = document.getElementById('adssRouteInput');
  const techInput = document.getElementById('adssTechInput');
  const cableTypeSelect = document.getElementById('adssCableTypeSelect');
  const envConditionSelect = document.getElementById('adssEnvConditionSelect');
  const crossingClassSelect = document.getElementById('adssCrossingClassSelect');
  const spanLengthInput = document.getElementById('adssSpanLengthInput');
  const poleHeightInput = document.getElementById('adssPoleHeightInput');
  const tensionInput = document.getElementById('adssTensionInput');
  const damperCheckbox = document.getElementById('adssDamperCheckbox');
  const svgContainer = document.getElementById('adssSvgContainer');
  const kpiRibbon = document.getElementById('adssKpiRibbon');
  const saveBtn = document.getElementById('adssSaveCertBtn');
  const printA4Btn = document.getElementById('adssPrintA4Btn');
  const printThermalBtn = document.getElementById('adssPrintThermalBtn');
  const copyWhatsAppBtn = document.getElementById('adssCopyWhatsAppBtn');
  const exportCsvBtn = document.getElementById('adssExportCsvBtn');
  const tableBody = document.getElementById('adssHistoryTableBody');
  const searchInput = document.getElementById('adssSearchInput');

  let currentAnalysis = null;
  let currentRecord = null;

  function getFormData() {
    return {
      customer: custInput ? custInput.value : 'Muhammad Arshad',
      route: routeInput ? routeInput.value : 'Baradari Pole #B-14 to Siphon Tower',
      technicianName: techInput ? techInput.value : 'Shahdara OSP Aerial Lineworker',
      cableTypeId: cableTypeSelect ? cableTypeSelect.value : 'ADSS_24F_100M',
      envConditionId: envConditionSelect ? envConditionSelect.value : 'SPRING_EDS_NOMINAL',
      crossingClassId: crossingClassSelect ? crossingClassSelect.value : 'RESIDENTIAL_STREET',
      spanLengthM: spanLengthInput ? Number(spanLengthInput.value) : 65.0,
      poleAttachmentHeightM: poleHeightInput ? Number(poleHeightInput.value) : 8.5,
      initialTensionN: tensionInput ? Number(tensionInput.value) : 1100.0,
      hasVibrationDamperInstalled: damperCheckbox ? damperCheckbox.checked : false
    };
  }

  function recalculate() {
    const data = getFormData();
    currentAnalysis = evaluateAdssSagTension(data);
    currentRecord = buildAdssSagTensionRecord(data, currentAnalysis);

    if (svgContainer) {
      svgContainer.innerHTML = renderAdssSagTensionSvg(currentAnalysis);
    }

    if (kpiRibbon) {
      const v = currentAnalysis.verdict;
      const clrPass = currentAnalysis.clearancePass;
      kpiRibbon.innerHTML = `
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 12px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:700;">Vertical Sag</div>
          <div style="font-size:16px; font-weight:800; color:#38bdf8;">${currentAnalysis.sagProfile.verticalSagM} m</div>
          <div style="font-size:10px; color:#64748b;">${currentAnalysis.sagProfile.sagPercentOfSpan}% span</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 12px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:700;">Net Clearance</div>
          <div style="font-size:16px; font-weight:800; color:${clrPass ? '#10b981' : '#ef4444'};">${currentAnalysis.netGroundClearanceM} m</div>
          <div style="font-size:10px; color:#64748b;">Req ≥ ${currentAnalysis.crossingClass.minClearanceM}m</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 12px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:700;">Everyday Stress</div>
          <div style="font-size:16px; font-weight:800; color:${currentAnalysis.edsPercent <= 18 ? '#10b981' : '#f59e0b'};">${currentAnalysis.edsPercent}% RTS</div>
          <div style="font-size:10px; color:#64748b;">Limit ≤ 18% RTS</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 12px; text-align:center;">
          <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; font-weight:700;">QA Verdict</div>
          <div style="font-size:13px; font-weight:800; color:${v.color}; margin-top:2px;">${v.name}</div>
          <div style="font-size:10px; color:#64748b;">${currentAnalysis.vibration.damperType}</div>
        </div>
      `;
    }
  }

  function renderHistoryTable() {
    if (!tableBody) return;
    const certs = getSavedAdssSagTensionCerts();
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = certs.filter(c => {
      if (!query) return true;
      return (
        c.certId.toLowerCase().includes(query) ||
        (c.customer && c.customer.toLowerCase().includes(query)) ||
        (c.route && c.route.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:16px; color:#94a3b8;">
            No aerial ADSS sag-tension certification records found.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(c => {
      const a = c.analysis || {};
      const v = a.verdict || {};
      return `
        <tr>
          <td><strong>${c.certId}</strong></td>
          <td>${new Date(c.timestamp).toLocaleDateString('en-GB')}</td>
          <td>${c.customer || '—'}</td>
          <td>${a.spanLengthM || 0}m / ${a.sagProfile?.verticalSagM || 0}m sag</td>
          <td><strong style="color:${a.clearancePass ? '#10b981' : '#ef4444'}">${a.netGroundClearanceM || 0}m</strong></td>
          <td><span class="badge" style="background:${v.color}22; color:${v.color}; border:1px solid ${v.color}44; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">${v.id || 'N/A'}</span></td>
          <td>
            <button type="button" class="btn-adss-view" data-cert-id="${c.certId}" style="padding:2px 6px; font-size:10px; cursor:pointer;">View</button>
            <button type="button" class="btn-adss-print" data-cert-id="${c.certId}" style="padding:2px 6px; font-size:10px; cursor:pointer;">Print</button>
          </td>
        </tr>
      `;
    }).join('');

    tableBody.querySelectorAll('.btn-adss-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-cert-id');
        const match = certs.find(x => x.certId === id);
        if (match && match.analysis) {
          currentAnalysis = match.analysis;
          currentRecord = match;
          if (custInput) custInput.value = match.customer || '';
          if (routeInput) routeInput.value = match.route || '';
          if (cableTypeSelect) cableTypeSelect.value = match.analysis.cableType?.id || 'ADSS_24F_100M';
          if (spanLengthInput) spanLengthInput.value = match.analysis.spanLengthM || 65;
          if (poleHeightInput) poleHeightInput.value = match.analysis.poleAttachmentHeightM || 8.5;
          if (tensionInput) tensionInput.value = match.analysis.initialTensionN || 1100;
          if (damperCheckbox) damperCheckbox.checked = match.analysis.hasVibrationDamperInstalled || false;
          recalculate();
        }
      });
    });

    tableBody.querySelectorAll('.btn-adss-print').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-cert-id');
        const match = certs.find(x => x.certId === id);
        if (match) {
          const html = generateAdssSagTensionCertHtml(match, { format: 'a4' });
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(html);
            win.document.close();
            win.print();
          }
        }
      });
    });
  }

  function loadPreset(presetKey) {
    const p = SHAH_ADSS_PRESETS[presetKey];
    if (!p) return;
    if (custInput) custInput.value = p.customer;
    if (routeInput) routeInput.value = p.route;
    if (cableTypeSelect) cableTypeSelect.value = p.cableTypeId;
    if (envConditionSelect) envConditionSelect.value = p.envConditionId;
    if (crossingClassSelect) crossingClassSelect.value = p.crossingClassId;
    if (spanLengthInput) spanLengthInput.value = p.spanLengthM;
    if (poleHeightInput) poleHeightInput.value = p.poleAttachmentHeightM;
    if (tensionInput) tensionInput.value = p.initialTensionN;
    if (damperCheckbox) damperCheckbox.checked = p.hasVibrationDamperInstalled;
    recalculate();
  }

  // Event wiring
  if (presetSelect) {
    presetSelect.addEventListener('change', () => loadPreset(presetSelect.value));
  }

  [
    custInput, routeInput, techInput, cableTypeSelect, envConditionSelect,
    crossingClassSelect, spanLengthInput, poleHeightInput, tensionInput, damperCheckbox
  ].forEach(el => {
    if (el) {
      el.addEventListener('input', recalculate);
      el.addEventListener('change', recalculate);
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      recalculate();
      saveAdssSagTensionCert(currentRecord);
      renderHistoryTable();
      alert(`ADSS Certification ${currentRecord.certId} saved successfully.`);
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      recalculate();
      const html = generateAdssSagTensionCertHtml(currentRecord, { format: 'a4' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    });
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      recalculate();
      const html = generateAdssSagTensionCertHtml(currentRecord, { format: 'thermal' });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    });
  }

  if (copyWhatsAppBtn) {
    copyWhatsAppBtn.addEventListener('click', () => {
      recalculate();
      const text = formatAdssSagTensionCertWhatsApp(currentRecord);
      navigator.clipboard.writeText(text).then(() => {
        alert('WhatsApp Lineman dispatch notice copied to clipboard.');
      }).catch(() => {
        prompt('Copy WhatsApp Notice:', text);
      });
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csv = generateAdssSagTensionCertsCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adss-sag-tension-certs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderHistoryTable);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
  }

  if (triggerButton) {
    triggerButton.addEventListener('click', () => {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
      recalculate();
      renderHistoryTable();
    });
  }

  // Initial load
  recalculate();
  renderHistoryTable();

  return {
    modal,
    recalculate,
    renderHistoryTable,
    loadPreset
  };
}
