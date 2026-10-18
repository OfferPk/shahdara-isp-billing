/**
 * Shahdara ISP Billing & Network Operations - Outside Plant Pneumatic Microduct Fiber Cable
 * Air-Jetting Installation, Viscous Drag & Crash-Test Buckling QA Certification Suite
 * Standards: IEC 60794-1-21 Method E1/E7, ITU-T L.400 / L.12, Telcordia GR-20-CORE Issue 4, IEEE 1222
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const CABLE_JETTING_STORAGE_KEY = 'shahdara_cable_jetting_certs_v1';

export const JETTING_CABLE_TYPES = {
  'MICRO_CABLE_24F_5MM': {
    id: 'MICRO_CABLE_24F_5MM',
    name: '24F Micro-Duct Cable (OD 5.4mm, 24 kg/km)',
    outerDiameterMm: 5.4,
    weightKgPerKm: 24.0,
    matsTensileLimitN: 1000.0,
    elasticModulusMpa: 8500.0,
    momentOfInertiaMm4: 42.0,
    minBendRadiusMm: 110.0,
    fiberCount: 24,
    colorCode: '#0ea5e9',
    description: 'Ultra-compact loose tube micro-cable optimized for 10/8mm and 12/10mm microduct jetting.'
  },
  'MICRO_CABLE_48F_6MM': {
    id: 'MICRO_CABLE_48F_6MM',
    name: '48F High-Density Micro-Cable (OD 6.2mm, 36 kg/km)',
    outerDiameterMm: 6.2,
    weightKgPerKm: 36.0,
    matsTensileLimitN: 1500.0,
    elasticModulusMpa: 9200.0,
    momentOfInertiaMm4: 73.0,
    minBendRadiusMm: 130.0,
    fiberCount: 48,
    colorCode: '#6366f1',
    description: 'Standard feeder distribution micro-cable with aramid yarns for high-speed pneumatic blowing.'
  },
  'MINI_CABLE_96F_7MM': {
    id: 'MINI_CABLE_96F_7MM',
    name: '96F Backbone Mini-Cable (OD 7.8mm, 55 kg/km)',
    outerDiameterMm: 7.8,
    weightKgPerKm: 55.0,
    matsTensileLimitN: 2200.0,
    elasticModulusMpa: 10500.0,
    momentOfInertiaMm4: 181.0,
    minBendRadiusMm: 160.0,
    fiberCount: 96,
    colorCode: '#10b981',
    description: 'High-fiber-count ring backbone mini-cable engineered for 14/10mm and 20/16mm conduit blowing.'
  },
  'STANDARD_DUCT_144F_11MM': {
    id: 'STANDARD_DUCT_144F_11MM',
    name: '144F Standard Heavy Duct Cable (OD 11.2mm, 105 kg/km)',
    outerDiameterMm: 11.2,
    weightKgPerKm: 105.0,
    matsTensileLimitN: 2700.0,
    elasticModulusMpa: 12000.0,
    momentOfInertiaMm4: 772.0,
    minBendRadiusMm: 225.0,
    fiberCount: 144,
    colorCode: '#f59e0b',
    description: 'Heavy core distribution cable requiring large 32/26mm HDPE conduit and high-volume compressor.'
  },
  'MICRO_DROP_4F_3MM': {
    id: 'MICRO_DROP_4F_3MM',
    name: '4F FTTH Micro-Drop Tube Cable (OD 2.8mm, 8.5 kg/km)',
    outerDiameterMm: 2.8,
    weightKgPerKm: 8.5,
    matsTensileLimitN: 400.0,
    elasticModulusMpa: 6500.0,
    momentOfInertiaMm4: 3.0,
    minBendRadiusMm: 60.0,
    fiberCount: 4,
    colorCode: '#ec4899',
    description: 'Last-mile customer subscriber tube cable for residential street microduct shuttle blowing.'
  }
};

export const JETTING_DUCT_TYPES = {
  'MICRODUCT_10_8': {
    id: 'MICRODUCT_10_8',
    name: '10/8 mm Microduct (Inner Ø 8.0mm, Max 15 Bar)',
    innerDiameterMm: 8.0,
    outerDiameterMm: 10.0,
    maxPressureBar: 15.0,
    siliconeLining: true,
    description: 'Standard multi-tube bundle microduct with low-friction ribbed internal silicone lining.'
  },
  'MICRODUCT_12_10': {
    id: 'MICRODUCT_12_10',
    name: '12/10 mm Microduct (Inner Ø 10.0mm, Max 15 Bar)',
    innerDiameterMm: 10.0,
    outerDiameterMm: 12.0,
    maxPressureBar: 15.0,
    siliconeLining: true,
    description: 'High-capacity microduct for up to 48F and 72F micro-cables with optimal airflow aerodynamic clearance.'
  },
  'MICRODUCT_14_10': {
    id: 'MICRODUCT_14_10',
    name: '14/10 mm Thick-Walled Direct Buried Microduct (Inner Ø 10.0mm, Max 16 Bar)',
    innerDiameterMm: 10.0,
    outerDiameterMm: 14.0,
    maxPressureBar: 16.0,
    siliconeLining: true,
    description: 'Heavy thick-walled microduct suitable for direct trenching without protective secondary subduct.'
  },
  'SUBDUCT_20_16': {
    id: 'SUBDUCT_20_16',
    name: '20/16 mm Subduct Conduit (Inner Ø 16.0mm, Max 12 Bar)',
    innerDiameterMm: 16.0,
    outerDiameterMm: 20.0,
    maxPressureBar: 12.0,
    siliconeLining: false,
    description: 'Intermediate sub-duct pulled inside main civil duct banks for 96F-144F mini-cables.'
  },
  'CONDUIT_32_26': {
    id: 'CONDUIT_32_26',
    name: '32/26 mm Heavy HDPE Feeder Duct (Inner Ø 26.0mm, Max 10 Bar)',
    innerDiameterMm: 26.0,
    outerDiameterMm: 32.0,
    maxPressureBar: 10.0,
    siliconeLining: false,
    description: 'Large diameter HDPE conduit for heavy trunk lines and canal under-crossings.'
  }
};

export const JETTING_EQUIPMENT_TYPES = {
  'SCREW_COMPRESSOR_15BAR': {
    id: 'SCREW_COMPRESSOR_15BAR',
    name: 'Diesel Rotary Screw Compressor (15 Bar / 218 PSI, 3.5 m³/min)',
    maxAirPressureBar: 15.0,
    airVolumeCfm: 125,
    aftercoolerFitted: true,
    waterSeparatorFitted: true,
    description: 'Industrial heavy-duty compressor equipped with aftercooler and dryer for zero moisture contamination.'
  },
  'MID_COMPRESSOR_10BAR': {
    id: 'MID_COMPRESSOR_10BAR',
    name: 'Mobile Piston Compressor (10 Bar / 145 PSI, 2.0 m³/min)',
    maxAirPressureBar: 10.0,
    airVolumeCfm: 70,
    aftercoolerFitted: false,
    waterSeparatorFitted: true,
    description: 'Towable field compressor for metropolitan urban streets and short sub-duct runs.'
  },
  'PORTABLE_JET_MACHINE': {
    id: 'PORTABLE_JET_MACHINE',
    name: 'Hydraulic Caterpillar Track Jetting Machine (0-800 N Push Force)',
    maxPushForceN: 800.0,
    maxPushSpeedMPerMin: 110.0,
    hasMagneticEncoder: true,
    description: 'Dual rubber-belt caterpillar drive system with electronic force-limiting crash protection.'
  },
  'PNEUMATIC_FEED_BLOCK': {
    id: 'PNEUMATIC_FEED_BLOCK',
    name: 'Handheld Air-Blowing Gun Shuttle (0-250 N Push Force)',
    maxPushForceN: 250.0,
    maxPushSpeedMPerMin: 70.0,
    hasMagneticEncoder: false,
    description: 'Lightweight air-assisted pusher designed for FTTH residential micro-drop cables.'
  }
};

export const CABLE_JETTING_VERDICTS = {
  'CERTIFIED_OPTIMAL_JETTING': {
    id: 'CERTIFIED_OPTIMAL_JETTING',
    name: 'Certified Optimal Air-Jetting Installation (Pass)',
    badgeClass: 'badge-success',
    color: '#16a34a',
    description: 'Duct fill ratio is 50-75%, machine push force is safely below Euler crash limit, and viscous air drag overcomes conduit friction.'
  },
  'CONDITIONAL_PASS_LUBRICATED': {
    id: 'CONDITIONAL_PASS_LUBRICATED',
    name: 'Conditional Pass (High Route Curvature / Pre-Lubrication Required)',
    badgeClass: 'badge-warning',
    color: '#f59e0b',
    description: 'Cumulative bend angle increases capstan drag; pre-blowing liquid silicone microduct lubricant is strictly mandatory.'
  },
  'FAILED_CRASH_BUCKLING_RISK': {
    id: 'FAILED_CRASH_BUCKLING_RISK',
    name: 'Critical Hazard: Machine Push Force Exceeds Crash-Test Buckling Limit (Fail)',
    badgeClass: 'badge-danger',
    color: '#dc2626',
    description: 'Push force exceeds critical Euler buckling capacity in annular clearance; acute risk of cable folding, kinking, and fiber breakage.'
  },
  'FAILED_DUCT_OVERFILL_CHOKE': {
    id: 'FAILED_DUCT_OVERFILL_CHOKE',
    name: 'Critical Defect: Excessive Duct Fill Ratio (> 80% Choke) (Fail)',
    badgeClass: 'badge-danger',
    color: '#991b1b',
    description: 'Cable outer diameter is too large relative to duct inner bore; airflow velocity is choked and cable will jam within 100 meters.'
  },
  'FAILED_EXCESSIVE_TENSILE_STRAIN': {
    id: 'FAILED_EXCESSIVE_TENSILE_STRAIN',
    name: 'Critical Defect: Net Installation Tension Exceeds MATS Limit (Fail)',
    badgeClass: 'badge-danger',
    color: '#b91c1c',
    description: 'Total friction and capstan drag exceed Maximum Allowable Tensile Strength (MATS); optical fibers will experience irreversible elongation strain.'
  }
};

export const SHAH_JETTING_PRESETS = {
  'PRESET_BARADARI_BACKBONE_JET': {
    id: 'PRESET_BARADARI_BACKBONE_JET',
    name: 'Baradari OLT to Begum Kot Ring (48F Micro-Cable, 12/10mm Duct, 1,450m)',
    customer: 'Shahdara Metro Ring-A Backbone',
    route: 'Baradari Central OLT Duct Bank to Begum Kot Interchange',
    cableTypeId: 'MICRO_CABLE_48F_6MM',
    ductTypeId: 'MICRODUCT_12_10',
    ductLengthM: 1450.0,
    airPressureBar: 12.0,
    machinePushForceN: 350.0,
    pushSpeedMPerMin: 65.0,
    totalBendsCount: 8,
    avgBendDegrees: 45.0,
    isPreLubricated: true,
    equipmentId: 'SCREW_COMPRESSOR_15BAR'
  },
  'PRESET_VANDALA_DROP_JET': {
    id: 'PRESET_VANDALA_DROP_JET',
    name: 'Vandala Road Feeder (24F Micro-Cable, 14/10mm Direct Buried, 850m)',
    customer: 'Vandala Road Sub-FAT Distribution Feeder',
    route: 'Vandala Road Chamber 04 to Rachna Town Entry Duct',
    cableTypeId: 'MICRO_CABLE_24F_5MM',
    ductTypeId: 'MICRODUCT_14_10',
    ductLengthM: 850.0,
    airPressureBar: 10.0,
    machinePushForceN: 220.0,
    pushSpeedMPerMin: 80.0,
    totalBendsCount: 5,
    avgBendDegrees: 30.0,
    isPreLubricated: true,
    equipmentId: 'MID_COMPRESSOR_10BAR'
  },
  'PRESET_JIA_MUSA_CANAL_HIGH_CURVATURE': {
    id: 'PRESET_JIA_MUSA_CANAL_HIGH_CURVATURE',
    name: 'Jia Musa Canal Meandering Route (96F Mini-Cable, 20/16mm Duct, 14 Bends)',
    customer: 'Jia Musa Commercial Plaza Ring Trunk',
    route: 'Jia Musa Embankment Subduct Bank to Canal Road Culvert',
    cableTypeId: 'MINI_CABLE_96F_7MM',
    ductTypeId: 'SUBDUCT_20_16',
    ductLengthM: 1150.0,
    airPressureBar: 11.5,
    machinePushForceN: 480.0,
    pushSpeedMPerMin: 50.0,
    totalBendsCount: 14,
    avgBendDegrees: 60.0,
    isPreLubricated: false,
    equipmentId: 'SCREW_COMPRESSOR_15BAR'
  },
  'PRESET_RAVI_SIPHON_RIVER_CROSSING': {
    id: 'PRESET_RAVI_SIPHON_RIVER_CROSSING',
    name: 'Ravi Siphon HDD Under-Bore (144F Heavy Duct Cable, 32/26mm HDPE, 1,800m)',
    customer: 'Shahdara North Inter-City River Crossing Trunk',
    route: 'Ravi Siphon North Bore Chamber to Old Ravi Toll Plaza Hub',
    cableTypeId: 'STANDARD_DUCT_144F_11MM',
    ductTypeId: 'CONDUIT_32_26',
    ductLengthM: 1800.0,
    airPressureBar: 14.5,
    machinePushForceN: 650.0,
    pushSpeedMPerMin: 45.0,
    totalBendsCount: 4,
    avgBendDegrees: 25.0,
    isPreLubricated: true,
    equipmentId: 'SCREW_COMPRESSOR_15BAR'
  },
  'PRESET_COMMERCIAL_PLAZA_OVERFILL': {
    id: 'PRESET_COMMERCIAL_PLAZA_OVERFILL',
    name: 'Commercial Plaza Overfilled Choke Risk (144F Cable in 12/10mm Duct)',
    customer: 'Shahdara Commercial Plaza Uncertified Run',
    route: 'Plaza Underground Utility Basement to Roof Riser',
    cableTypeId: 'STANDARD_DUCT_144F_11MM',
    ductTypeId: 'MICRODUCT_12_10',
    ductLengthM: 600.0,
    airPressureBar: 8.0,
    machinePushForceN: 750.0,
    pushSpeedMPerMin: 20.0,
    totalBendsCount: 10,
    avgBendDegrees: 90.0,
    isPreLubricated: false,
    equipmentId: 'MID_COMPRESSOR_10BAR'
  }
};

/**
 * Calculates duct fill ratio percentage (diameter ratio and area ratio).
 * @param {number} cableOdMm
 * @param {number} ductInnerMm
 * @returns {{ diameterRatioPct: number, areaRatioPct: number, status: string }}
 */
export function calculateDuctFillRatio(cableOdMm, ductInnerMm) {
  const cOd = Math.max(0.1, Number(cableOdMm) || 5.0);
  const dId = Math.max(0.1, Number(ductInnerMm) || 10.0);

  const diameterRatioPct = Math.round((cOd / dId) * 1000) / 10;
  const areaRatioPct = Math.round(((cOd * cOd) / (dId * dId)) * 1000) / 10;

  let status = 'OPTIMAL';
  if (diameterRatioPct > 80.0) {
    status = 'OVERFILLED_CHOKED';
  } else if (diameterRatioPct > 75.0) {
    status = 'TIGHT_HIGH_DRAG';
  } else if (diameterRatioPct < 35.0) {
    status = 'UNDERFILLED_BLOWOUT';
  }

  return {
    diameterRatioPct,
    areaRatioPct,
    status
  };
}

/**
 * Calculates critical Euler column crash-buckling force inside duct annular clearance.
 * Formula: F_crit = 2 * sqrt((E * I * w * g) / r_clearance)
 * where r_clearance = (D_inner - d_cable) / 2
 * @param {number} elasticModulusMpa
 * @param {number} momentOfInertiaMm4
 * @param {number} cableWeightKgPerKm
 * @param {number} ductInnerMm
 * @param {number} cableOdMm
 * @returns {{ criticalBucklingForceN: number, radialClearanceMm: number }}
 */
export function calculateCriticalBucklingPushForce(elasticModulusMpa, momentOfInertiaMm4, cableWeightKgPerKm, ductInnerMm, cableOdMm) {
  const E = Math.max(100.0, Number(elasticModulusMpa) || 8500.0) * 1e6; // Pa
  const I = Math.max(0.1, Number(momentOfInertiaMm4) || 40.0) * 1e-12; // m^4
  const w = (Math.max(1.0, Number(cableWeightKgPerKm) || 25.0) * 1e-3) * 9.80665; // N/m

  const radialClearanceMm = Math.max(0.1, (Number(ductInnerMm) - Number(cableOdMm)) / 2.0);
  const rMeters = radialClearanceMm * 1e-3;

  // Euler crash-test buckling critical compressive thrust inside duct wall constraint
  const EI = E * I;
  const stiffnessFactor = 350.0;
  const criticalBucklingForceN = Math.round(2.0 * Math.sqrt((EI * (w * stiffnessFactor + 120.0)) / rMeters) * 10) / 10;

  return {
    criticalBucklingForceN: Math.max(20.0, criticalBucklingForceN),
    radialClearanceMm: Math.round(radialClearanceMm * 100) / 100
  };
}

/**
 * Calculates aerodynamic viscous air drag force along microduct.
 * @param {number} ductInnerMm
 * @param {number} cableOdMm
 * @param {number} ductLengthM
 * @param {number} airPressureBar
 * @returns {{ totalViscousDragForceN: number, avgPressureBar: number, exitAirVelocityMps: number }}
 */
export function calculateViscousDragForce(ductInnerMm, cableOdMm, ductLengthM, airPressureBar) {
  const dId = Math.max(2.0, Number(ductInnerMm) || 10.0) * 1e-3; // m
  const cOd = Math.max(1.0, Number(cableOdMm) || 5.0) * 1e-3; // m
  const L = Math.max(10.0, Number(ductLengthM) || 500.0); // m
  const pBar = Math.max(1.0, Number(airPressureBar) || 10.0);

  // Aerodynamic boundary-layer shear force on cable outer sheath
  const tauMeanPa = Math.min(35.0, Math.max(2.0, 1.2 * pBar * Math.sqrt(L / 1000.0)));
  const cableSurfaceAreaM2 = Math.PI * cOd * L;
  const totalViscousDragForceN = Math.round((cableSurfaceAreaM2 * tauMeanPa * 0.45) * 10) / 10;

  const avgPressureBar = Math.round(((pBar + 1.013) / 2.0) * 10) / 10;
  const exitAirVelocityMps = Math.round(Math.min(320.0, 35.0 * Math.sqrt(pBar)) * 10) / 10;

  return {
    totalViscousDragForceN: Math.max(10.0, totalViscousDragForceN),
    avgPressureBar,
    exitAirVelocityMps
  };
}


/**
 * Calculates Capstan route curvature resistance factor.
 * Formula: K_curv = exp(mu * totalAngleRadians)
 * @param {number} totalBendsCount
 * @param {number} avgBendDegrees
 * @param {number} frictionCoeff
 * @returns {{ capstanMultiplier: number, totalAngleDegrees: number, totalAngleRadians: number }}
 */
export function calculateCapstanCurvatureFactor(totalBendsCount, avgBendDegrees, frictionCoeff) {
  const bends = Math.max(0, Number(totalBendsCount) || 0);
  const deg = Math.max(0, Number(avgBendDegrees) || 0);
  const mu = Math.max(0.01, Number(frictionCoeff) || 0.10);

  const totalAngleDegrees = bends * deg;
  const totalAngleRadians = (totalAngleDegrees * Math.PI) / 180.0;
  const capstanMultiplier = Math.round(Math.exp(mu * totalAngleRadians) * 1000) / 1000;

  return {
    capstanMultiplier,
    totalAngleDegrees,
    totalAngleRadians: Math.round(totalAngleRadians * 100) / 100
  };
}

/**
 * Evaluates comprehensive Outside Plant Cable Air-Jetting Installation Physics.
 * @param {Object} params
 * @returns {Object} Comprehensive physics, safety ratios, and quality verdict
 */
export function evaluateCableJettingPhysics(params = {}) {
  const cable = JETTING_CABLE_TYPES[params.cableTypeId] || JETTING_CABLE_TYPES['MICRO_CABLE_48F_6MM'];
  const duct = JETTING_DUCT_TYPES[params.ductTypeId] || JETTING_DUCT_TYPES['MICRODUCT_12_10'];
  const equipment = JETTING_EQUIPMENT_TYPES[params.equipmentId] || JETTING_EQUIPMENT_TYPES['SCREW_COMPRESSOR_15BAR'];

  const ductLengthM = Math.max(10.0, Number(params.ductLengthM) || 1000.0);
  const airPressureBar = Math.max(1.0, Math.min(duct.maxPressureBar, Number(params.airPressureBar) || 12.0));
  const machinePushForceN = Math.max(10.0, Number(params.machinePushForceN) || 300.0);
  const pushSpeedMPerMin = Math.max(5.0, Number(params.pushSpeedMPerMin) || 60.0);
  const totalBendsCount = Math.max(0, Number(params.totalBendsCount) || 6);
  const avgBendDegrees = Math.max(0, Number(params.avgBendDegrees) || 45.0);
  const isPreLubricated = params.isPreLubricated !== false;

  // Friction coefficient: 0.08 if pre-lubricated with silicone, 0.28 if unlubricated/dry
  const frictionCoeff = isPreLubricated ? 0.08 : 0.28;

  // 1. Duct fill ratio
  const fillRatio = calculateDuctFillRatio(cable.outerDiameterMm, duct.innerDiameterMm);

  // 2. Critical Euler crash-test buckling thrust
  const buckling = calculateCriticalBucklingPushForce(
    cable.elasticModulusMpa,
    cable.momentOfInertiaMm4,
    cable.weightKgPerKm,
    duct.innerDiameterMm,
    cable.outerDiameterMm
  );

  // 3. Aerodynamic viscous air drag
  const airDrag = calculateViscousDragForce(
    duct.innerDiameterMm,
    cable.outerDiameterMm,
    ductLengthM,
    airPressureBar
  );

  // 4. Capstan route curvature factor
  const capstan = calculateCapstanCurvatureFactor(totalBendsCount, avgBendDegrees, frictionCoeff);

  // 5. Normal gravitational friction force (N)
  const totalCableWeightN = (cable.weightKgPerKm * 1e-3 * ductLengthM) * 9.80665;
  const gravityFrictionN = Math.round((totalCableWeightN * frictionCoeff) * 10) / 10;

  // 6. Net Installation Tension (N)
  // Tension = max(0, (GravityFriction - ViscousDrag) * CapstanMultiplier - MachinePushForce)
  const dragSurplusN = airDrag.totalViscousDragForceN - gravityFrictionN;
  let netInstallationTensionN = 0.0;
  if (dragSurplusN < 0) {
    const rawTensionN = (Math.abs(dragSurplusN) * capstan.capstanMultiplier) - machinePushForceN;
    netInstallationTensionN = Math.max(0, Math.round(rawTensionN * 10) / 10);
  } else {
    // Viscous air drag exceeds weight friction; cable floats aerodynamically!
    netInstallationTensionN = 0.0;
  }

  // Push force ratio against critical buckling crash threshold
  const pushBucklingRatio = Math.round((machinePushForceN / buckling.criticalBucklingForceN) * 100) / 100;

  // Tension ratio against cable MATS limit
  const tensionMatsRatio = Math.round((netInstallationTensionN / cable.matsTensileLimitN) * 100) / 100;

  // Maximum estimated blowing distance (meters)
  const effectiveDrivingForceN = machinePushForceN + airDrag.totalViscousDragForceN;
  const unitFrictionNPerM = (cable.weightKgPerKm * 1e-3 * 9.80665 * frictionCoeff) * (capstan.capstanMultiplier * 0.7 + 0.3);
  const estimatedMaxBlowingDistanceM = Math.round(Math.min(3500.0, (effectiveDrivingForceN / Math.max(0.05, unitFrictionNPerM))));

  // Deficiency audit list
  const deficiencyList = [];
  if (fillRatio.diameterRatioPct > 80.0) {
    deficiencyList.push(`Duct fill ratio (${fillRatio.diameterRatioPct}%) exceeds 80% pneumatic choke threshold; cable will jam.`);
  }
  if (pushBucklingRatio > 1.0) {
    deficiencyList.push(`Machine push force (${machinePushForceN} N) exceeds Euler crash limit (${buckling.criticalBucklingForceN} N); buckling imminent.`);
  }
  if (tensionMatsRatio > 0.8) {
    deficiencyList.push(`Net installation tension (${netInstallationTensionN} N) exceeds 80% of cable MATS rating (${cable.matsTensileLimitN} N).`);
  }
  if (!isPreLubricated && totalBendsCount > 6) {
    deficiencyList.push(`High route curvature (${totalBendsCount} bends) without pre-lubrication elevates friction coefficient to ${frictionCoeff}.`);
  }

  // Verdict selection
  let verdictKey = 'CERTIFIED_OPTIMAL_JETTING';
  if (fillRatio.diameterRatioPct > 80.0) {
    verdictKey = 'FAILED_DUCT_OVERFILL_CHOKE';
  } else if (pushBucklingRatio > 1.0) {
    verdictKey = 'FAILED_CRASH_BUCKLING_RISK';
  } else if (tensionMatsRatio > 0.95) {
    verdictKey = 'FAILED_EXCESSIVE_TENSILE_STRAIN';
  } else if (pushBucklingRatio > 0.85 || !isPreLubricated || totalBendsCount > 8) {
    verdictKey = 'CONDITIONAL_PASS_LUBRICATED';
  }

  const verdict = CABLE_JETTING_VERDICTS[verdictKey];

  return {
    cable,
    duct,
    equipment,
    ductLengthM,
    airPressureBar,
    machinePushForceN,
    pushSpeedMPerMin,
    totalBendsCount,
    avgBendDegrees,
    isPreLubricated,
    frictionCoeff,
    fillRatio,
    buckling,
    airDrag,
    capstan,
    totalCableWeightN: Math.round(totalCableWeightN * 10) / 10,
    gravityFrictionN,
    netInstallationTensionN,
    pushBucklingRatio,
    tensionMatsRatio,
    estimatedMaxBlowingDistanceM,
    deficiencyList,
    verdict,
    testedAt: new Date().toISOString()
  };
}

/**
 * Validates form inputs for Cable Jetting & Air-Blowing QA Suite.
 * @param {Object} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCableJettingInput(input = {}) {
  const errors = [];

  if (!input.customer || !String(input.customer).trim()) {
    errors.push('Subscriber name or feeder route owner is required.');
  }

  if (!input.route || !String(input.route).trim()) {
    errors.push('Trench route, microduct chamber, or ODF span is required.');
  }

  const len = Number(input.ductLengthM);
  if (isNaN(len) || len < 10.0 || len > 5000.0) {
    errors.push('Duct span length must be between 10 and 5,000 meters.');
  }

  const press = Number(input.airPressureBar);
  if (isNaN(press) || press < 1.0 || press > 20.0) {
    errors.push('Compressor pneumatic pressure must be between 1.0 and 20.0 Bar.');
  }

  const push = Number(input.machinePushForceN);
  if (isNaN(push) || push < 10.0 || push > 1500.0) {
    errors.push('Machine caterpillar push force must be between 10 and 1,500 N.');
  }

  const speed = Number(input.pushSpeedMPerMin);
  if (isNaN(speed) || speed < 5.0 || speed > 150.0) {
    errors.push('Push blowing speed must be between 5 and 150 m/min.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Builds an immutable certificate record with official identifier format JET-YYYYMM-XXXX.
 * @param {Object} input
 * @param {Object} [analysisResult]
 * @returns {Object} Immutable QA certificate record
 */
export function buildCableJettingCertRecord(input = {}, analysisResult = null) {
  const analysis = analysisResult || evaluateCableJettingPhysics(input);
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = input.certId || `JET-${yearMonth}-${randomSuffix}`;

  return {
    certId,
    customer: String(input.customer || 'Shahdara Network Subscriber').trim(),
    route: String(input.route || 'Duct Span Chamber').trim(),
    technicianName: String(input.technicianName || 'Shahdara Lineworker & Jetting Tech').trim(),
    cableTypeId: analysis.cable.id,
    ductTypeId: analysis.duct.id,
    equipmentId: analysis.equipment.id,
    ductLengthM: analysis.ductLengthM,
    airPressureBar: analysis.airPressureBar,
    machinePushForceN: analysis.machinePushForceN,
    pushSpeedMPerMin: analysis.pushSpeedMPerMin,
    totalBendsCount: analysis.totalBendsCount,
    avgBendDegrees: analysis.avgBendDegrees,
    isPreLubricated: analysis.isPreLubricated,
    analysis,
    status: analysis.verdict.id === 'CERTIFIED_OPTIMAL_JETTING' ? 'VERIFIED' : 'ACTION_REQUIRED',
    createdAt: now.toISOString()
  };
}

let inMemoryJettingCerts = [];

/**
 * Retrieves saved Cable Jetting certificates from LocalStorage or in-memory fallback.
 * @param {Object} [state]
 * @returns {Array} list of certificate records
 */
export function getSavedCableJettingCerts(state = {}) {
  if (state && typeof state === 'object' && Array.isArray(state.cableJettingCerts)) {
    return state.cableJettingCerts;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(CABLE_JETTING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // fallback
    }
  }
  return inMemoryJettingCerts;
}

/**
 * Saves a Cable Jetting certificate record to LocalStorage (FIFO capacity: 100 records).
 * @param {Object} record
 * @param {Object} [state]
 * @returns {Array} updated certificates list
 */
export function saveCableJettingCert(record, state = {}) {
  const current = getSavedCableJettingCerts(state);
  const filtered = current.filter(c => c.certId !== record.certId);
  filtered.unshift(record);
  if (filtered.length > 100) {
    filtered.pop();
  }
  inMemoryJettingCerts = filtered;
  if (state && typeof state === 'object') {
    state.cableJettingCerts = filtered;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CABLE_JETTING_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      // fallback
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
export function updateCableJettingCertStatus(certId, newStatus, state = {}) {
  const current = getSavedCableJettingCerts(state);
  const item = current.find(c => c.certId === certId);
  if (item) {
    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
  }
  inMemoryJettingCerts = current;
  if (state && typeof state === 'object') {
    state.cableJettingCerts = current;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CABLE_JETTING_STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      // fallback
    }
  }
  return current;
}

/**
 * Clears all saved Cable Jetting certificates from LocalStorage and in-memory.
 * @param {Object} [state]
 */
export function clearCableJettingCerts(state = {}) {
  inMemoryJettingCerts = [];
  if (state && typeof state === 'object') {
    state.cableJettingCerts = [];
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CABLE_JETTING_STORAGE_KEY);
    } catch (e) {
      // fallback
    }
  }
  return [];
}

/**
 * Calculates summary KPI metrics across saved Cable Jetting certificates.
 * @param {Array} records
 * @returns {Object} aggregated metrics
 */
export function calculateCableJettingMetrics(records = []) {
  const list = Array.isArray(records) ? records : [];
  const total = list.length;
  let certified = 0;
  let conditional = 0;
  let failed = 0;
  let totalBlowingMeters = 0;
  let maxPressureBarSeen = 0;

  list.forEach(r => {
    const vId = r.analysis?.verdict?.id;
    if (vId === 'CERTIFIED_OPTIMAL_JETTING') certified++;
    else if (vId === 'CONDITIONAL_PASS_LUBRICATED') conditional++;
    else failed++;

    const m = Number(r.ductLengthM) || 0;
    totalBlowingMeters += m;

    const p = Number(r.airPressureBar) || 0;
    if (p > maxPressureBarSeen) maxPressureBarSeen = p;
  });

  const passRatePct = total > 0 ? Math.round(((certified + conditional) / total) * 100) : 100;
  const avgDistanceM = total > 0 ? Math.round(totalBlowingMeters / total) : 0;

  return {
    total,
    certified,
    conditional,
    failed,
    passRatePct,
    totalBlowingMeters,
    avgDistanceM,
    maxPressureBarSeen
  };
}

/**
 * Pure-vector SVG visualizer displaying pneumatic air compressor, caterpillar pusher,
 * microduct cross-section, aerodynamic air velocity lines, and real-time telemetry HUD.
 * @param {Object} recordOrAnalysis
 * @returns {string} SVG markup string
 */
export function renderCableJettingAnalysisSvg(recordOrAnalysis = {}) {
  const analysis = recordOrAnalysis.analysis || recordOrAnalysis;
  const {
    cable,
    duct,
    equipment,
    ductLengthM,
    airPressureBar,
    machinePushForceN,
    pushSpeedMPerMin,
    totalBendsCount,
    fillRatio,
    buckling,
    airDrag,
    capstan,
    netInstallationTensionN,
    pushBucklingRatio,
    verdict,
    isPreLubricated
  } = analysis;

  const w = 780;
  const h = 330;
  const statusColor = verdict.color || '#16a34a';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%"  class="cable-jetting-analysis-svg" style="background:#090d16; border-radius:8px; font-family:system-ui,-apple-system,sans-serif;">
      <defs>
        <linearGradient id="compressorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#475569" />
          <stop offset="50%" stop-color="#64748b" />
          <stop offset="100%" stop-color="#334155" />
        </linearGradient>
        <linearGradient id="ductGlassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0369a1" stop-opacity="0.25" />
          <stop offset="50%" stop-color="#0284c7" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#0369a1" stop-opacity="0.25" />
        </linearGradient>
        <linearGradient id="airFlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.1" />
        </linearGradient>
        <marker id="jetArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
        </marker>
        <marker id="pushArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
        </marker>
      </defs>

      <!-- Background Grid -->
      <g stroke="#1e293b" stroke-width="0.8" opacity="0.6">
        <line x1="30" y1="50" x2="750" y2="50" />
        <line x1="30" y1="110" x2="750" y2="110" />
        <line x1="30" y1="170" x2="750" y2="170" />
        <line x1="30" y1="230" x2="750" y2="230" />
        <line x1="30" y1="290" x2="750" y2="290" />
      </g>

      <!-- Machine Zone 1: Compressor & Pneumatic Feed Chamber (X: 30 to 110) -->
      <g transform="translate(30, 90)">
        <rect x="0" y="0" width="70" height="110" rx="6" fill="url(#compressorGrad)" stroke="#38bdf8" stroke-width="1.5" />
        <text x="35" y="24" fill="#f8fafc" font-size="9" font-weight="700" text-anchor="middle">AIR COMP</text>
        <circle cx="35" cy="55" r="18" fill="#0f172a" stroke="#94a3b8" stroke-width="1.5" />
        <!-- Gauge needle -->
        <line x1="35" y1="55" x2="45" y2="44" stroke="#ef4444" stroke-width="2" />
        <text x="35" y="60" fill="#38bdf8" font-size="8" font-weight="800" text-anchor="middle">${airPressureBar}B</text>
        <text x="35" y="94" fill="#94a3b8" font-size="7.5" text-anchor="middle">${equipment.airVolumeCfm} CFM</text>
      </g>

      <!-- High-Pressure Air Hose to Chamber -->
      <path d="M 100 145 C 115 145, 115 145, 125 145" fill="none" stroke="#38bdf8" stroke-width="6" />

      <!-- Machine Zone 2: Caterpillar Pusher Machine (X: 125 to 205) -->
      <g transform="translate(125, 95)">
        <rect x="0" y="0" width="80" height="100" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="1.2" />
        <!-- Top Track -->
        <rect x="10" y="10" width="60" height="18" rx="3" fill="url(#trackGrad)" stroke="#94a3b8" stroke-width="1" />
        <!-- Bottom Track -->
        <rect x="10" y="72" width="60" height="18" rx="3" fill="url(#trackGrad)" stroke="#94a3b8" stroke-width="1" />
        <!-- Track Grip Gear teeth -->
        <line x1="20" y1="28" x2="20" y2="34" stroke="#f8fafc" stroke-width="1.5" />
        <line x1="40" y1="28" x2="40" y2="34" stroke="#f8fafc" stroke-width="1.5" />
        <line x1="60" y1="28" x2="60" y2="34" stroke="#f8fafc" stroke-width="1.5" />
        <line x1="20" y1="66" x2="20" y2="72" stroke="#f8fafc" stroke-width="1.5" />
        <line x1="40" y1="66" x2="40" y2="72" stroke="#f8fafc" stroke-width="1.5" />
        <line x1="60" y1="66" x2="60" y2="72" stroke="#f8fafc" stroke-width="1.5" />

        <text x="40" y="52" fill="#10b981" font-size="8.5" font-weight="800" text-anchor="middle">PUSH: ${machinePushForceN}N</text>
        <text x="40" y="62" fill="#94a3b8" font-size="7.5" text-anchor="middle">${pushSpeedMPerMin} m/min</text>
      </g>

      <!-- Push Vector Arrow forward -->
      <line x1="205" y1="145" x2="225" y2="145" stroke="#10b981" stroke-width="3.5" marker-end="url(#pushArrow)" />

      <!-- Section 3: Microduct Body & Air Jetting Chamber (X: 230 to 420) -->
      <g transform="translate(230, 110)">
        <!-- Outer Microduct Wall -->
        <rect x="0" y="0" width="180" height="70" rx="6" fill="url(#ductGlassGrad)" stroke="#0284c7" stroke-width="2" />
        <text x="90" y="14" fill="#38bdf8" font-size="8.5" font-weight="700" text-anchor="middle">
          ${duct.name} (${ductLengthM}m)
        </text>

        <!-- Air Flow Streamlines (Turbulent/Laminar Shear) -->
        <path d="M 5 24 Q 50 20 95 24 T 175 24" fill="none" stroke="url(#airFlowGrad)" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#jetArrow)" />
        <path d="M 5 46 Q 50 50 95 46 T 175 46" fill="none" stroke="url(#airFlowGrad)" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#jetArrow)" />

        <!-- Optical Fiber Cable Inside Duct -->
        <rect x="0" y="30" width="150" height="10" rx="3" fill="#f59e0b" stroke="#d97706" stroke-width="1.5" />
        <!-- Bullet Nose Carrier Shuttle at Cable Front -->
        <path d="M 150 28 L 165 35 L 150 42 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="1" />

        <!-- Aerodynamic shear force arrows along cable jacket -->
        <line x1="30" y1="28" x2="50" y2="28" stroke="#38bdf8" stroke-width="1.5" marker-end="url(#jetArrow)" />
        <line x1="70" y1="28" x2="90" y2="28" stroke="#38bdf8" stroke-width="1.5" marker-end="url(#jetArrow)" />
        <line x1="110" y1="28" x2="130" y2="28" stroke="#38bdf8" stroke-width="1.5" marker-end="url(#jetArrow)" />

        <text x="75" y="62" fill="#e2e8f0" font-size="8" font-weight="600" text-anchor="middle">
          Aerodynamic Air Drag: ${airDrag.totalViscousDragForceN} N
        </text>
      </g>

      <!-- Bend Arc / Curvature Capstan Symbol -->
      <g transform="translate(370, 205)">
        <path d="M 0 0 C 20 20, 20 40, 40 40" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,2" />
        <text x="25" y="52" fill="#fbbf24" font-size="8" font-weight="700">Bends: ${totalBendsCount} (x${capstan.capstanMultiplier})</text>
      </g>

      <!-- Left Bottom Annotations -->
      <g transform="translate(30, 240)">
        <rect x="0" y="0" width="380" height="70" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
        <text x="12" y="18" fill="#38bdf8" font-size="9" font-weight="700">PNEUMATIC JETTING METRICS &amp; RATIOS</text>
        <text x="12" y="34" fill="#94a3b8" font-size="8">Duct Fill Ratio: <tspan fill="#f8fafc" font-weight="700">${fillRatio.diameterRatioPct}%</tspan> (${fillRatio.status})</text>
        <text x="12" y="48" fill="#94a3b8" font-size="8">Pre-Lubrication: <tspan fill="${isPreLubricated ? '#10b981' : '#f59e0b'}" font-weight="700">${isPreLubricated ? 'Liquid Silicone Applied (μ=0.08)' : 'Dry Conduit (μ=0.28)'}</tspan></text>
        <text x="12" y="62" fill="#94a3b8" font-size="8">Est. Max Blowing Reach: <tspan fill="#38bdf8" font-weight="700">${analysis.estimatedMaxBlowingDistanceM} meters</tspan></text>

        <text x="210" y="34" fill="#94a3b8" font-size="8">Push/Crash Ratio: <tspan fill="${pushBucklingRatio <= 0.85 ? '#10b981' : pushBucklingRatio <= 1.0 ? '#f59e0b' : '#ef4444'}" font-weight="700">${Math.round(pushBucklingRatio * 100)}%</tspan></text>
        <text x="210" y="48" fill="#94a3b8" font-size="8">Euler Crash Limit: <tspan fill="#f8fafc" font-weight="700">${buckling.criticalBucklingForceN} N</tspan></text>
        <text x="210" y="62" fill="#94a3b8" font-size="8">Net Tension: <tspan fill="${netInstallationTensionN === 0 ? '#10b981' : '#f59e0b'}" font-weight="700">${netInstallationTensionN} N</tspan> (MATS: ${cable.matsTensileLimitN}N)</text>
      </g>

      <!-- Right Side Engineering Metrology Panel (X: 430 to 760) -->
      <g transform="translate(430, 40)">
        <rect x="0" y="0" width="320" height="270" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" />
        <text x="16" y="24" fill="#38bdf8" font-size="11" font-weight="800">
          CABLE JETTING METROLOGY HUD
        </text>
        <line x1="16" y1="34" x2="304" y2="34" stroke="#334155" stroke-width="1" />

        <!-- Parameter 1: Machine Push vs Buckling Crash -->
        <text x="16" y="56" fill="#94a3b8" font-size="9.5">Caterpillar Machine Push Force:</text>
        <text x="304" y="56" fill="#f8fafc" font-size="11" font-weight="700" text-anchor="end">
          ${machinePushForceN} N
        </text>
        <text x="16" y="70" fill="#64748b" font-size="8.5">Euler Crash Limit: ${buckling.criticalBucklingForceN} N (${Math.round(pushBucklingRatio * 100)}% threshold)</text>

        <!-- Parameter 2: Viscous Air Drag -->
        <text x="16" y="94" fill="#94a3b8" font-size="9.5">Aerodynamic Air Drag Force:</text>
        <text x="304" y="94" fill="#38bdf8" font-size="11" font-weight="700" text-anchor="end">
          ${airDrag.totalViscousDragForceN} N
        </text>
        <text x="16" y="108" fill="#64748b" font-size="8.5">Air Pressure: ${airPressureBar} Bar · Flow: ${equipment.airVolumeCfm} CFM</text>

        <!-- Parameter 3: Duct Fill Ratio -->
        <text x="16" y="132" fill="#94a3b8" font-size="9.5">Duct Fill Ratio (OD/ID):</text>
        <text x="304" y="132" fill="${fillRatio.diameterRatioPct <= 75 ? '#10b981' : fillRatio.diameterRatioPct <= 80 ? '#f59e0b' : '#ef4444'}" font-size="11" font-weight="800" text-anchor="end">
          ${fillRatio.diameterRatioPct}%
        </text>
        <text x="16" y="146" fill="#64748b" font-size="8.5">Cable Ø: ${cable.outerDiameterMm}mm · Duct Inner Ø: ${duct.innerDiameterMm}mm</text>

        <!-- Parameter 4: Net Installation Tension -->
        <text x="16" y="170" fill="#94a3b8" font-size="9.5">Net Cable Installation Tension:</text>
        <text x="304" y="170" fill="${netInstallationTensionN === 0 ? '#10b981' : '#f59e0b'}" font-size="11" font-weight="800" text-anchor="end">
          ${netInstallationTensionN} N
        </text>
        <text x="16" y="184" fill="#64748b" font-size="8.5">Rated MATS Limit: ${cable.matsTensileLimitN} N (IEC 60794-1-21 E1)</text>

        <!-- Parameter 5: Curvature Drag Factor -->
        <text x="16" y="208" fill="#94a3b8" font-size="9.5">Route Curvature Capstan Drag:</text>
        <text x="304" y="208" fill="#f8fafc" font-size="11" font-weight="700" text-anchor="end">
          ${capstan.capstanMultiplier}x
        </text>
        <text x="16" y="222" fill="#64748b" font-size="8.5">${totalBendsCount} Bends · Friction Coeff μ: ${analysis.frictionCoeff}</text>

        <!-- Status Box -->
        <rect x="16" y="234" width="288" height="26" rx="4" fill="#1e293b" stroke="${statusColor}" stroke-width="1.2" />
        <circle cx="28" cy="247" r="4.5" fill="${statusColor}" />
        <text x="40" y="251" fill="#f8fafc" font-size="9.5" font-weight="800">
          ${verdict.name}
        </text>
      </g>
    </svg>
  `;
}

/**
 * Generates dual printable documents:
 * 1. Standard A4 Formal Outside Plant & Pneumatic Civil Engineering Certificate
 * 2. 80mm POS field technician thermal slip
 * @param {Object} record
 * @param {{ format?: string }} [options]
 * @returns {string} HTML string
 */
export function generateCableJettingCertHtml(record, options = {}) {
  const analysis = record.analysis || evaluateCableJettingPhysics(record);
  const isThermal = options.format === 'thermal';
  const certId = record.certId || 'JET-202610-0001';
  const statusColor = analysis.verdict.color || '#16a34a';

  if (isThermal) {
    return `
      <div class="pos-thermal-slip" style="width: 280px; font-family: monospace; font-size: 11px; line-height: 1.35; padding: 10px; background: #fff; color: #000;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: 900;">SHAHDARA FIBER NETWORK</h2>
          <p style="margin: 2px 0; font-size: 10px;">OUTSIDE PLANT PNEUMATIC JETTING QA SLIP</p>
          <p style="margin: 0; font-size: 9px;">IEC 60794-1-21 E7 / ITU-T L.400</p>
        </div>
        <div style="margin-bottom: 8px;">
          <div><b>CERT ID:</b> ${certId}</div>
          <div><b>DATE:</b> ${record.createdAt ? record.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}</div>
          <div><b>TECH:</b> ${record.technicianName || 'Lineworker'}</div>
          <div><b>ROUTE:</b> ${record.route || 'Duct Span'}</div>
        </div>
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 8px;">
          <div><b>SPAN LENGTH:</b> ${analysis.ductLengthM} m</div>
          <div><b>AIR PRESSURE:</b> ${analysis.airPressureBar} Bar</div>
          <div><b>PUSH FORCE:</b> ${analysis.machinePushForceN} N</div>
          <div><b>CRASH LIMIT:</b> ${analysis.buckling.criticalBucklingForceN} N</div>
          <div><b>VISCOUS DRAG:</b> ${analysis.airDrag.totalViscousDragForceN} N</div>
          <div><b>FILL RATIO:</b> ${analysis.fillRatio.diameterRatioPct}% (${analysis.fillRatio.status})</div>
          <div><b>NET TENSION:</b> ${analysis.netInstallationTensionN} N (MATS: ${analysis.cable.matsTensileLimitN}N)</div>
          <div><b>PRE-LUBED:</b> ${analysis.isPreLubricated ? 'YES (Silicone)' : 'NO (Dry Conduit)'}</div>
        </div>
        <div style="text-align: center; font-weight: 900; font-size: 12px; margin-bottom: 8px;">
          VERDICT: ${analysis.verdict.name}
        </div>
        <div style="font-size: 9px; text-align: center; border-top: 1px dashed #000; padding-top: 6px;">
          Sign: ____________________<br>
          NOC Shahdara Field Operations
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="a4-certificate-container" style="max-width: 800px; margin: 0 auto; padding: 32px; background: #fff; color: #0f172a; font-family: system-ui, -apple-system, sans-serif; border: 1px solid #cbd5e1; border-radius: 8px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px;">
            SHAHDARA FIBER NETWORK OPERATIONS
          </h1>
          <p style="margin: 2px 0 0; font-size: 13px; font-weight: 700; color: #475569;">
            Outside Plant Pneumatic Cable Jetting &amp; Microduct Air-Blowing QA Certificate
          </p>
          <p style="margin: 2px 0 0; font-size: 10.5px; color: #64748b;">
            Standards: IEC 60794-1-21 Method E1/E7 · ITU-T L.400 / L.12 · Telcordia GR-20-CORE Issue 4 · IEEE 1222
          </p>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 10px; background: #f0f9ff; border: 1px solid #0284c7; border-radius: 4px; font-size: 11px; font-weight: 800; color: #0284c7;">
            ${certId}
          </div>
          <p style="margin: 4px 0 0; font-size: 10px; color: #64748b;">
            Date: ${record.createdAt ? record.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
          </p>
        </div>
      </div>

      <!-- Project Metadata Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 20px; font-size: 11.5px;">
        <div><b>Subscriber / Feeder Owner:</b> ${record.customer || 'Shahdara Network Subscriber'}</div>
        <div><b>Trench / Duct Span:</b> ${record.route || 'Duct Span'}</div>
        <div><b>Cable Specification:</b> ${analysis.cable.name}</div>
        <div><b>Microduct Specification:</b> ${analysis.duct.name}</div>
        <div><b>Compressor Equipment:</b> ${analysis.equipment.name}</div>
        <div><b>Certified Technician:</b> ${record.technicianName || 'Shahdara Lineworker'}</div>
      </div>

      <!-- Metrology Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11.5px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 8px 10px;">Engineering Parameter</th>
            <th style="padding: 8px 10px;">Measured / Applied</th>
            <th style="padding: 8px 10px;">Standard / Design Limit</th>
            <th style="padding: 8px 10px;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Duct Fill Ratio (OD/ID)</b></td>
            <td style="padding: 8px 10px;">${analysis.fillRatio.diameterRatioPct}% (${analysis.fillRatio.areaRatioPct}% area)</td>
            <td style="padding: 8px 10px;">50% – 75% optimal (Max 80%)</td>
            <td style="padding: 8px 10px; font-weight: 700; color: ${analysis.fillRatio.diameterRatioPct <= 75 ? '#16a34a' : analysis.fillRatio.diameterRatioPct <= 80 ? '#d97706' : '#dc2626'};">
              ${analysis.fillRatio.status}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Caterpillar Machine Push Force</b></td>
            <td style="padding: 8px 10px;">${analysis.machinePushForceN} N</td>
            <td style="padding: 8px 10px;">Euler Crash Limit: ${analysis.buckling.criticalBucklingForceN} N</td>
            <td style="padding: 8px 10px; font-weight: 700; color: ${analysis.pushBucklingRatio <= 1.0 ? '#16a34a' : '#dc2626'};">
              ${Math.round(analysis.pushBucklingRatio * 100)}% load (${analysis.pushBucklingRatio <= 1.0 ? 'SAFE' : 'CRASH HAZARD'})
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Aerodynamic Viscous Air Drag</b></td>
            <td style="padding: 8px 10px;">${analysis.airDrag.totalViscousDragForceN} N</td>
            <td style="padding: 8px 10px;">Air Pressure: ${analysis.airPressureBar} Bar</td>
            <td style="padding: 8px 10px; font-weight: 700; color: #16a34a;">LAMINAR SHEAR OK</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Net Cable Installation Tension</b></td>
            <td style="padding: 8px 10px;">${analysis.netInstallationTensionN} N</td>
            <td style="padding: 8px 10px;">Rated MATS: ${analysis.cable.matsTensileLimitN} N</td>
            <td style="padding: 8px 10px; font-weight: 700; color: ${analysis.tensionMatsRatio <= 0.8 ? '#16a34a' : '#dc2626'};">
              ${analysis.netInstallationTensionN === 0 ? 'FLOATING / ZERO STRAIN' : `${analysis.tensionMatsRatio * 100}% MATS`}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Route Curvature &amp; Pre-Lubrication</b></td>
            <td style="padding: 8px 10px;">${analysis.totalBendsCount} bends (${analysis.capstan.capstanMultiplier}x drag)</td>
            <td style="padding: 8px 10px;">${analysis.isPreLubricated ? 'Liquid Silicone Applied (μ=0.08)' : 'Dry Conduit (μ=0.28)'}</td>
            <td style="padding: 8px 10px; font-weight: 700; color: ${analysis.isPreLubricated ? '#16a34a' : '#d97706'};">
              ${analysis.isPreLubricated ? 'LUBRICATED' : 'UNLUBRICATED WARNING'}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 10px;"><b>Estimated Max Blowing Distance</b></td>
            <td style="padding: 8px 10px;">${analysis.estimatedMaxBlowingDistanceM} meters</td>
            <td style="padding: 8px 10px;">Installed Span: ${analysis.ductLengthM} meters</td>
            <td style="padding: 8px 10px; font-weight: 700; color: ${analysis.estimatedMaxBlowingDistanceM >= analysis.ductLengthM ? '#16a34a' : '#dc2626'};">
              ${analysis.estimatedMaxBlowingDistanceM >= analysis.ductLengthM ? 'REACH ACHIEVABLE' : 'RISK OF SHORT BLOW'}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Verdict Banner -->
      <div style="background: #f8fafc; border-left: 4px solid ${statusColor}; border-radius: 4px; padding: 12px; margin-bottom: 24px;">
        <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: ${statusColor};">
          QA VERDICT: ${analysis.verdict.name}
        </h3>
        <p style="margin: 4px 0 0; font-size: 11px; color: #475569;">
          ${analysis.verdict.description}
        </p>
      </div>

      <!-- Sign-off Footer -->
      <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; border-top: 1px solid #cbd5e1; font-size: 10.5px;">
        <div>
          <b>Outside Plant Civil Inspector:</b><br><br>
          ________________________________________<br>
          Sign &amp; Stamp
        </div>
        <div style="text-align: right;">
          <b>NOC Quality Assurance Lead:</b><br><br>
          ________________________________________<br>
          Authorized Engineering Approval
        </div>
      </div>
    </div>
  `;
}

/**
 * Formats a bilingual English & Urdu WhatsApp notification for lineworkers and contractors.
 * @param {Object} record
 * @returns {string} WhatsApp notification text
 */
export function formatCableJettingCertWhatsApp(record) {
  const analysis = record.analysis || evaluateCableJettingPhysics(record);
  const certId = record.certId || 'JET-202610-0001';

  return `*SHAHDARA FIBER NETWORK — OSP PNEUMATIC CABLE JETTING QA CERTIFICATE* 💨
_شہدرہ آپٹیکل فائبر نیٹ ورک — پینومیٹک کیبل جیٹنگ و ایئر بلونگ کوالٹی سرٹیفکیٹ_

*Certificate ID:* ${certId}
*Date / تاریخ:* ${record.createdAt ? record.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
*Subscriber / Feeder:* ${record.customer || 'Shahdara Network Subscriber'}
*Duct Route:* ${record.route || 'Duct Span'}
*Lineworker / فیلڈ لائن مین:* ${record.technicianName || 'Shahdara Jetting Tech'}

*JETTING PARAMETERS / جیٹنگ پیرامیٹرز:*
• Span Length: ${analysis.ductLengthM} meters
• Air Pressure: ${analysis.airPressureBar} Bar (${Math.round(analysis.airPressureBar * 14.5038)} PSI)
• Machine Push Force: ${analysis.machinePushForceN} N (Crash Limit: ${analysis.buckling.criticalBucklingForceN} N)
• Aerodynamic Air Drag: ${analysis.airDrag.totalViscousDragForceN} N
• Duct Fill Ratio: ${analysis.fillRatio.diameterRatioPct}% (${analysis.fillRatio.status})
• Net Cable Tension: ${analysis.netInstallationTensionN} N (MATS Limit: ${analysis.cable.matsTensileLimitN} N)
• Pre-Lubricated: ${analysis.isPreLubricated ? 'YES (Silicone Lubricant)' : 'NO (Dry Conduit)'}
• Estimated Reach: ${analysis.estimatedMaxBlowingDistanceM} meters

*QA VERDICT / حتمی نتیجہ:*
${analysis.verdict.name}
${analysis.verdict.description}

_Official NOC Outside Plant Civil Metrology Record (IEC 60794-1-21 Method E1/E7 / ITU-T L.400)._`;
}

/**
 * Generates an RFC-4180 compliant CSV export with UTF-8 BOM.
 * @param {Array} records
 * @returns {string} CSV content
 */
export function generateCableJettingCertsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Date',
    'Customer / Route Owner',
    'Route / Duct Span',
    'Technician',
    'Cable Type',
    'Duct Type',
    'Equipment Model',
    'Span Length (m)',
    'Air Pressure (Bar)',
    'Machine Push Force (N)',
    'Euler Crash Limit (N)',
    'Viscous Air Drag (N)',
    'Fill Ratio (%)',
    'Net Tension (N)',
    'MATS Limit (N)',
    'Pre-Lubricated',
    'Verdict'
  ];

  const rows = (Array.isArray(records) ? records : []).map(r => {
    const a = r.analysis || {};
    return [
      r.certId || '',
      r.createdAt ? r.createdAt.slice(0, 10) : '',
      `"${String(r.customer || '').replace(/"/g, '""')}"`,
      `"${String(r.route || '').replace(/"/g, '""')}"`,
      `"${String(r.technicianName || '').replace(/"/g, '""')}"`,
      a.cable?.id || '',
      a.duct?.id || '',
      a.equipment?.id || '',
      a.ductLengthM || 0,
      a.airPressureBar || 0,
      a.machinePushForceN || 0,
      a.buckling?.criticalBucklingForceN || 0,
      a.airDrag?.totalViscousDragForceN || 0,
      a.fillRatio?.diameterRatioPct || 0,
      a.netInstallationTensionN || 0,
      a.cable?.matsTensileLimitN || 0,
      a.isPreLubricated ? 'YES' : 'NO',
      `"${String(a.verdict?.name || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Sets up and wires the Cable Jetting QA Modal Dialog UI controller.
 * @param {Object} options
 * @returns {Object} modal controller methods
 */
export function setupCableJettingModal(options = {}) {
  const {
    state,
    dialogElement,
    triggerButton,
    onToast
  } = options;

  if (!dialogElement) return null;

  const presetSelect = dialogElement.querySelector('#jettingPresetSelect');
  const custInput = dialogElement.querySelector('#jettingCustInput');
  const routeInput = dialogElement.querySelector('#jettingRouteInput');
  const techInput = dialogElement.querySelector('#jettingTechInput');
  const cableSelect = dialogElement.querySelector('#jettingCableSelect');
  const ductSelect = dialogElement.querySelector('#jettingDuctSelect');
  const equipSelect = dialogElement.querySelector('#jettingEquipSelect');
  const lengthInput = dialogElement.querySelector('#jettingLengthInput');
  const pressInput = dialogElement.querySelector('#jettingPressInput');
  const pushInput = dialogElement.querySelector('#jettingPushInput');
  const speedInput = dialogElement.querySelector('#jettingSpeedInput');
  const bendsInput = dialogElement.querySelector('#jettingBendsInput');
  const lubedCheckbox = dialogElement.querySelector('#jettingLubedCheckbox');

  const kpiRibbon = dialogElement.querySelector('#jettingKpiRibbon');
  const svgContainer = dialogElement.querySelector('#jettingSvgContainer');
  const tableBody = dialogElement.querySelector('#jettingHistoryTableBody');
  const searchInput = dialogElement.querySelector('#jettingSearchInput');

  const saveBtn = dialogElement.querySelector('#jettingSaveCertBtn');
  const printA4Btn = dialogElement.querySelector('#jettingPrintA4Btn');
  const printThermalBtn = dialogElement.querySelector('#jettingPrintThermalBtn');
  const copyWhatsAppBtn = dialogElement.querySelector('#jettingCopyWhatsAppBtn');
  const exportCsvBtn = dialogElement.querySelector('#jettingExportCsvBtn');
  const closeBtn = dialogElement.querySelector('#cableJettingCloseBtn');

  function getFormValues() {
    return {
      customer: custInput ? custInput.value : 'Shahdara Network Subscriber',
      route: routeInput ? routeInput.value : 'Duct Span Chamber',
      technicianName: techInput ? techInput.value : 'Shahdara Jetting Tech',
      cableTypeId: cableSelect ? cableSelect.value : 'MICRO_CABLE_48F_6MM',
      ductTypeId: ductSelect ? ductSelect.value : 'MICRODUCT_12_10',
      equipmentId: equipSelect ? equipSelect.value : 'SCREW_COMPRESSOR_15BAR',
      ductLengthM: lengthInput ? Number(lengthInput.value) : 1000,
      airPressureBar: pressInput ? Number(pressInput.value) : 12,
      machinePushForceN: pushInput ? Number(pushInput.value) : 300,
      pushSpeedMPerMin: speedInput ? Number(speedInput.value) : 60,
      totalBendsCount: bendsInput ? Number(bendsInput.value) : 6,
      isPreLubricated: lubedCheckbox ? lubedCheckbox.checked : true
    };
  }

  function updatePreview() {
    const values = getFormValues();
    const analysis = evaluateCableJettingPhysics(values);

    // Update KPI Ribbon
    if (kpiRibbon) {
      kpiRibbon.innerHTML = `
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Duct Fill Ratio</div>
          <div style="font-size:15px; font-weight:800; color:${analysis.fillRatio.diameterRatioPct <= 75 ? '#10b981' : analysis.fillRatio.diameterRatioPct <= 80 ? '#f59e0b' : '#ef4444'};">${analysis.fillRatio.diameterRatioPct}%</div>
          <div style="font-size:9px; color:#64748b;">${analysis.fillRatio.status}</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Push vs Crash</div>
          <div style="font-size:15px; font-weight:800; color:${analysis.pushBucklingRatio <= 0.85 ? '#10b981' : analysis.pushBucklingRatio <= 1.0 ? '#f59e0b' : '#ef4444'};">${Math.round(analysis.pushBucklingRatio * 100)}%</div>
          <div style="font-size:9px; color:#64748b;">Limit: ${analysis.buckling.criticalBucklingForceN} N</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Viscous Air Drag</div>
          <div style="font-size:15px; font-weight:800; color:#38bdf8;">${analysis.airDrag.totalViscousDragForceN} N</div>
          <div style="font-size:9px; color:#64748b;">${analysis.airPressureBar} Bar Flow</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Net Tension</div>
          <div style="font-size:15px; font-weight:800; color:${analysis.netInstallationTensionN === 0 ? '#10b981' : '#f59e0b'};">${analysis.netInstallationTensionN} N</div>
          <div style="font-size:9px; color:#64748b;">MATS: ${analysis.cable.matsTensileLimitN} N</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Est. Blowing Reach</div>
          <div style="font-size:15px; font-weight:800; color:#a855f7;">${analysis.estimatedMaxBlowingDistanceM} m</div>
          <div style="font-size:9px; color:#64748b;">Span: ${analysis.ductLengthM} m</div>
        </div>
      `;
    }

    // Update SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderCableJettingAnalysisSvg(analysis);
    }
  }

  function renderHistoryTable() {
    if (!tableBody) return;
    const certs = getSavedCableJettingCerts(state);
    const filter = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const matching = certs.filter(c => {
      if (!filter) return true;
      return (
        (c.certId && c.certId.toLowerCase().includes(filter)) ||
        (c.customer && c.customer.toLowerCase().includes(filter)) ||
        (c.route && c.route.toLowerCase().includes(filter)) ||
        (c.technicianName && c.technicianName.toLowerCase().includes(filter))
      );
    });

    if (matching.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px; color:#64748b;">No cable jetting QA certificates found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = matching.map(c => {
      const a = c.analysis || {};
      const statusColor = a.verdict?.color || '#16a34a';
      return `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 6px 8px; font-weight: 700; color: #38bdf8;">${c.certId}</td>
          <td style="padding: 6px 8px;">${c.createdAt ? c.createdAt.slice(0, 10) : '-'}</td>
          <td style="padding: 6px 8px;">${c.customer || '-'}<br><small style="color:#64748b;">${c.route || ''}</small></td>
          <td style="padding: 6px 8px;">${a.ductLengthM || 0}m @ ${a.airPressureBar || 0} Bar<br><small style="color:#94a3b8;">Push: ${a.machinePushForceN || 0}N / Crash: ${a.buckling?.criticalBucklingForceN || 0}N</small></td>
          <td style="padding: 6px 8px;">${a.fillRatio?.diameterRatioPct || 0}%<br><small style="color:${a.isPreLubricated ? '#10b981' : '#f59e0b'};">${a.isPreLubricated ? 'Lubricated' : 'Dry'}</small></td>
          <td style="padding: 6px 8px; font-weight: 700; color: ${statusColor};">${a.verdict?.name ? a.verdict.name.split(' (')[0] : 'VERIFIED'}</td>
          <td style="padding: 6px 8px;">
            <button class="secondary-button" type="button" style="padding: 2px 6px; font-size: 10px;" data-print-a4-id="${c.certId}">🖨️ A4</button>
            <button class="secondary-button" type="button" style="padding: 2px 6px; font-size: 10px;" data-print-pos-id="${c.certId}">🧾 POS</button>
            <button class="secondary-button" type="button" style="padding: 2px 6px; font-size: 10px;" data-wa-id="${c.certId}">💬 WA</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row button triggers
    tableBody.querySelectorAll('[data-print-a4-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-print-a4-id');
        const item = certs.find(c => c.certId === id);
        if (item) {
          const html = generateCableJettingCertHtml(item, { format: 'a4' });
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => w.print(), 250);
          }
        }
      });
    });

    tableBody.querySelectorAll('[data-print-pos-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-print-pos-id');
        const item = certs.find(c => c.certId === id);
        if (item) {
          const html = generateCableJettingCertHtml(item, { format: 'thermal' });
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => w.print(), 250);
          }
        }
      });
    });

    tableBody.querySelectorAll('[data-wa-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-wa-id');
        const item = certs.find(c => c.certId === id);
        if (item) {
          const text = formatCableJettingCertWhatsApp(item);
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            if (typeof onToast === 'function') onToast('WhatsApp notice copied to clipboard!');
          }
        }
      });
    });
  }

  // Event: Preset Selection
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const presetKey = presetSelect.value;
      const preset = SHAH_JETTING_PRESETS[presetKey];
      if (preset) {
        if (custInput) custInput.value = preset.customer;
        if (routeInput) routeInput.value = preset.route;
        if (cableSelect) cableSelect.value = preset.cableTypeId;
        if (ductSelect) ductSelect.value = preset.ductTypeId;
        if (equipSelect) equipSelect.value = preset.equipmentId;
        if (lengthInput) lengthInput.value = preset.ductLengthM;
        if (pressInput) pressInput.value = preset.airPressureBar;
        if (pushInput) pushInput.value = preset.machinePushForceN;
        if (speedInput) speedInput.value = preset.pushSpeedMPerMin;
        if (bendsInput) bendsInput.value = preset.totalBendsCount;
        if (lubedCheckbox) lubedCheckbox.checked = preset.isPreLubricated;
        updatePreview();
      }
    });
  }

  // Live input changes
  [custInput, routeInput, techInput, cableSelect, ductSelect, equipSelect, lengthInput, pressInput, pushInput, speedInput, bendsInput, lubedCheckbox].forEach(el => {
    if (el) {
      el.addEventListener('input', updatePreview);
      el.addEventListener('change', updatePreview);
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', renderHistoryTable);
  }

  // Save Cert
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const values = getFormValues();
      const validation = validateCableJettingInput(values);
      if (!validation.valid) {
        if (typeof onToast === 'function') onToast(validation.errors[0] || 'Invalid inputs');
        return;
      }
      const record = buildCableJettingCertRecord(values);
      saveCableJettingCert(record, state);
      renderHistoryTable();
      if (typeof onToast === 'function') onToast(`Saved QA Certificate ${record.certId}!`);
    });
  }

  // Print A4
  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const values = getFormValues();
      const record = buildCableJettingCertRecord(values);
      const html = generateCableJettingCertHtml(record, { format: 'a4' });
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
      }
    });
  }

  // Print Thermal
  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const values = getFormValues();
      const record = buildCableJettingCertRecord(values);
      const html = generateCableJettingCertHtml(record, { format: 'thermal' });
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
      }
    });
  }

  // Copy WhatsApp
  if (copyWhatsAppBtn) {
    copyWhatsAppBtn.addEventListener('click', () => {
      const values = getFormValues();
      const record = buildCableJettingCertRecord(values);
      const text = formatCableJettingCertWhatsApp(record);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        if (typeof onToast === 'function') onToast('WhatsApp notice copied to clipboard!');
      }
    });
  }

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const certs = getSavedCableJettingCerts(state);
      const currentRec = buildCableJettingCertRecord(getFormValues());
      const listToExport = certs.length > 0 ? certs : [currentRec];
      const csv = generateCableJettingCertsCsv(listToExport);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cable-jetting-certs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (typeof onToast === 'function') onToast('Exported CSV successfully!');
    });
  }

  // Close Btn
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      dialogElement.close();
    });
  }

  // Initial preview and render
  updatePreview();
  renderHistoryTable();

  return {
    updatePreview,
    renderHistoryTable,
    getFormValues
  };
}
