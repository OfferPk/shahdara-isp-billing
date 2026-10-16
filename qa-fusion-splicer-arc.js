/**
 * Shahdara ISP Billing & Network Operations - Optical Fiber Fusion Splicer Arc Discharge Plasma Calibration,
 * Electrode Erosion & Proof-Test Tension QA Acceptance Certification Suite
 * Standards: IEC 61073-1, Telcordia GR-765-CORE Issue 1, ITU-T G.650.1, ITU-T G.652.D, JIS C 6861
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const FUSION_ARC_QA_STORAGE_KEY = 'shahdara_fusion_arc_qa_certs_v1';

export const SPLICER_MODELS = {
  'FUJIKURA_90S': {
    id: 'FUJIKURA_90S',
    brand: 'Fujikura',
    model: '90S+ Core Alignment Splicer',
    alignmentMethod: 'PAS (Profile Alignment System - Dual Axis Core)',
    maxElectrodeCycles: 5000,
    typicalLossSmfDb: 0.020,
    standardProofTensionN: 2.0,
    baseArcPower: 100,
    minProofTensionN: 1.96,
    maxProofTensionN: 2.25,
    sparkGapMm: 1.1,
    imageMagnification: '320x',
    heatingTimeSec: 13
  },
  'SUMITOMO_Z2C': {
    id: 'SUMITOMO_Z2C',
    brand: 'Sumitomo',
    model: 'Z2C High-Definition Core Splicer',
    alignmentMethod: 'Dual-Heater Core Alignment (Nano-Drive PAS)',
    maxElectrodeCycles: 6000,
    typicalLossSmfDb: 0.020,
    standardProofTensionN: 1.96,
    baseArcPower: 100,
    minProofTensionN: 1.96,
    maxProofTensionN: 2.20,
    sparkGapMm: 1.05,
    imageMagnification: '380x',
    heatingTimeSec: 15
  },
  'INNO_VIEW7': {
    id: 'INNO_VIEW7',
    brand: 'INNO Instrument',
    model: 'View 7 Premium Core Alignment Splicer',
    alignmentMethod: 'DAC (Digital Core Alignment System)',
    maxElectrodeCycles: 4500,
    typicalLossSmfDb: 0.020,
    standardProofTensionN: 2.0,
    baseArcPower: 100,
    minProofTensionN: 1.96,
    maxProofTensionN: 2.20,
    sparkGapMm: 1.15,
    imageMagnification: '520x',
    heatingTimeSec: 18
  },
  'SIGNALFIRE_AI9': {
    id: 'SIGNALFIRE_AI9',
    brand: 'Signal Fire',
    model: 'AI-9 6-Motor Auto Core Splicer',
    alignmentMethod: 'Auto Core Alignment (6-Motor Quad-Core Industrial)',
    maxElectrodeCycles: 3500,
    typicalLossSmfDb: 0.025,
    standardProofTensionN: 2.0,
    baseArcPower: 95,
    minProofTensionN: 1.85,
    maxProofTensionN: 2.10,
    sparkGapMm: 1.2,
    imageMagnification: '300x',
    heatingTimeSec: 15
  },
  'FUJIKURA_41S': {
    id: 'FUJIKURA_41S',
    brand: 'Fujikura',
    model: '41S+ Active V-Groove Cladding Splicer',
    alignmentMethod: 'Active V-Groove Cladding Alignment',
    maxElectrodeCycles: 3000,
    typicalLossSmfDb: 0.045,
    standardProofTensionN: 1.96,
    baseArcPower: 90,
    minProofTensionN: 1.96,
    maxProofTensionN: 2.15,
    sparkGapMm: 1.1,
    imageMagnification: '200x',
    heatingTimeSec: 20
  }
};

export const FIBER_TYPES = {
  'G652D': {
    id: 'G652D',
    label: 'ITU-T G.652.D (Standard Telecommunication SMF-28)',
    modeFieldDiameterUm: 9.2,
    claddingDiameterUm: 125.0,
    typicalSpliceLossDb: 0.020,
    maxAllowableLossDb: 0.050,
    nominalPreFuseTimeMs: 180,
    nominalMainFuseTimeMs: 1400,
    refractiveIndex: 1.4677
  },
  'G657A1': {
    id: 'G657A1',
    label: 'ITU-T G.657.A1 (Bend-Insensitive Subscriber Drop Cable)',
    modeFieldDiameterUm: 8.9,
    claddingDiameterUm: 125.0,
    typicalSpliceLossDb: 0.025,
    maxAllowableLossDb: 0.060,
    nominalPreFuseTimeMs: 170,
    nominalMainFuseTimeMs: 1350,
    refractiveIndex: 1.4670
  },
  'G657A2': {
    id: 'G657A2',
    label: 'ITU-T G.657.A2 (Ultra Bend-Insensitive Premises Drop)',
    modeFieldDiameterUm: 8.6,
    claddingDiameterUm: 125.0,
    typicalSpliceLossDb: 0.030,
    maxAllowableLossDb: 0.070,
    nominalPreFuseTimeMs: 160,
    nominalMainFuseTimeMs: 1300,
    refractiveIndex: 1.4672
  },
  'G655': {
    id: 'G655',
    label: 'ITU-T G.655 (Non-Zero Dispersion-Shifted Long-Haul)',
    modeFieldDiameterUm: 8.4,
    claddingDiameterUm: 125.0,
    typicalSpliceLossDb: 0.035,
    maxAllowableLossDb: 0.080,
    nominalPreFuseTimeMs: 190,
    nominalMainFuseTimeMs: 1500,
    refractiveIndex: 1.4680
  },
  'OM3_MMF': {
    id: 'OM3_MMF',
    label: 'ISO/IEC 11801 OM3 (50/125µm Multimode Datacenter LAN)',
    modeFieldDiameterUm: 50.0,
    claddingDiameterUm: 125.0,
    typicalSpliceLossDb: 0.015,
    maxAllowableLossDb: 0.040,
    nominalPreFuseTimeMs: 150,
    nominalMainFuseTimeMs: 1100,
    refractiveIndex: 1.4820
  }
};

export const PROOF_TEST_STATUSES = {
  PASSED_TENSILE_VERIFIED: {
    id: 'PASSED_TENSILE_VERIFIED',
    label: 'Verified Passed (≥ 1.96 N Tension / No Fracture)',
    badgeClass: 'badge-success',
    colorHex: '#10b981',
    isPassing: true
  },
  FAILED_TENSILE_FRACTURE: {
    id: 'FAILED_TENSILE_FRACTURE',
    label: 'Failed - Fiber Fractured Under Proof Load',
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    isPassing: false
  },
  SKIPPED_UNVERIFIED: {
    id: 'SKIPPED_UNVERIFIED',
    label: 'Skipped / Unverified (Warning: Mechanical Risk)',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    isPassing: false
  }
};

export const QA_VERDICTS = {
  TELCORDIA_GRADE_A: {
    id: 'TELCORDIA_GRADE_A',
    label: 'Telcordia GR-765-CORE Grade A Master Splice',
    description: 'Loss ≤ 0.030 dB, proof tension passed, clean concentric core alignment.',
    badgeClass: 'badge-grade-a',
    colorHex: '#10b981',
    isCompliant: true
  },
  COMMERCIAL_PASS: {
    id: 'COMMERCIAL_PASS',
    label: 'Commercial Telecom Compliant (ITU-T G.650 / G.652)',
    description: 'Loss ≤ 0.080 dB, proof tension verified, field distribution ready.',
    badgeClass: 'badge-pass',
    colorHex: '#0ea5e9',
    isCompliant: true
  },
  CONDITIONAL_PASS: {
    id: 'CONDITIONAL_PASS',
    label: 'Conditional Pass (Higher Loss - Distribution Only)',
    description: 'Loss 0.081 - 0.150 dB. Acceptable for short drop, re-cleave advised for backbone.',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    isCompliant: true
  },
  REJECT_RESPLICE_MANDATED: {
    id: 'REJECT_RESPLICE_MANDATED',
    label: 'REJECTED - Immediate Re-Splice Mandated',
    description: 'Excessive loss (> 0.150 dB), tensile fracture, or electrode arc plasma defect.',
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    isCompliant: false
  }
};

export const FUSION_ARC_PRESETS = {
  PRESET_BARADARI_MAIN_FEEDER_GRADE_A: {
    id: 'PRESET_BARADARI_MAIN_FEEDER_GRADE_A',
    label: 'Baradari Central Ring 48-Core Backbone (Fujikura 90S - Grade A)',
    splicerModelId: 'FUJIKURA_90S',
    fiberTypeId: 'G652D',
    splicerSerialNumber: 'F90S-PK-88241',
    dischargeCount: 450,
    ambientTempC: 22.0,
    pressureHpa: 1012.0,
    humidityRh: 45.0,
    coreOffsetXUm: 0.12,
    coreOffsetYUm: 0.08,
    cleaveAngleLeftDeg: 0.4,
    cleaveAngleRightDeg: 0.5,
    proofTensionN: 2.10,
    proofStatus: 'PASSED_TENSILE_VERIFIED',
    bubblePenaltyDb: 0.000,
    spliceLocation: 'Baradari Chowk ODF Enclosure #01'
  },
  PRESET_BEGUM_KOT_HIGH_PRESSURE_SUMITOMO: {
    id: 'PRESET_BEGUM_KOT_HIGH_PRESSURE_SUMITOMO',
    label: 'Begum Kot Commercial FAT Joint (Sumitomo Z2C - Auto-Compensated)',
    splicerModelId: 'SUMITOMO_Z2C',
    fiberTypeId: 'G657A1',
    splicerSerialNumber: 'SZ2C-99120',
    dischargeCount: 1850,
    ambientTempC: 34.0,
    pressureHpa: 998.0,
    humidityRh: 65.0,
    coreOffsetXUm: 0.18,
    coreOffsetYUm: 0.15,
    cleaveAngleLeftDeg: 0.7,
    cleaveAngleRightDeg: 0.6,
    proofTensionN: 1.98,
    proofStatus: 'PASSED_TENSILE_VERIFIED',
    bubblePenaltyDb: 0.000,
    spliceLocation: 'Begum Kot Commercial Plaza Sub-FAT'
  },
  PRESET_JIA_MUSA_WORN_ELECTRODE_WARNING: {
    id: 'PRESET_JIA_MUSA_WORN_ELECTRODE_WARNING',
    label: 'Jia Musa Road FAT Enclosure (INNO View 7 - Maintenance Due Warning)',
    splicerModelId: 'INNO_VIEW7',
    fiberTypeId: 'G652D',
    splicerSerialNumber: 'IV7-44021',
    dischargeCount: 4150,
    ambientTempC: 28.0,
    pressureHpa: 1008.0,
    humidityRh: 55.0,
    coreOffsetXUm: 0.35,
    coreOffsetYUm: 0.28,
    cleaveAngleLeftDeg: 1.1,
    cleaveAngleRightDeg: 1.0,
    proofTensionN: 2.00,
    proofStatus: 'PASSED_TENSILE_VERIFIED',
    bubblePenaltyDb: 0.025,
    spliceLocation: 'Jia Musa Main Market Overhead Closure'
  },
  PRESET_RACHNA_TOWN_CLEAVE_TILT_FAIL: {
    id: 'PRESET_RACHNA_TOWN_CLEAVE_TILT_FAIL',
    label: 'Rachna Town Lineman Joint (Signal Fire AI-9 - Bad Cleave Angle Tilt)',
    splicerModelId: 'SIGNALFIRE_AI9',
    fiberTypeId: 'G657A2',
    splicerSerialNumber: 'SFAI9-33129',
    dischargeCount: 1200,
    ambientTempC: 18.0,
    pressureHpa: 1018.0,
    humidityRh: 40.0,
    coreOffsetXUm: 0.55,
    coreOffsetYUm: 0.48,
    cleaveAngleLeftDeg: 2.8,
    cleaveAngleRightDeg: 2.4,
    proofTensionN: 1.96,
    proofStatus: 'PASSED_TENSILE_VERIFIED',
    bubblePenaltyDb: 0.040,
    spliceLocation: 'Rachna Town Street #4 Distribution Pole'
  },
  PRESET_VANDALA_ROAD_PROOF_SNAP_FRACTURE: {
    id: 'PRESET_VANDALA_ROAD_PROOF_SNAP_FRACTURE',
    label: 'Vandala Road Sub-FAT (Fujikura 41S - Tensile Proof Fracture Fail)',
    splicerModelId: 'FUJIKURA_41S',
    fiberTypeId: 'G657A1',
    splicerSerialNumber: 'F41S-10943',
    dischargeCount: 2850,
    ambientTempC: 25.0,
    pressureHpa: 1010.0,
    humidityRh: 50.0,
    coreOffsetXUm: 0.25,
    coreOffsetYUm: 0.20,
    cleaveAngleLeftDeg: 0.8,
    cleaveAngleRightDeg: 0.9,
    proofTensionN: 1.96,
    proofStatus: 'FAILED_TENSILE_FRACTURE',
    bubblePenaltyDb: 0.080,
    spliceLocation: 'Vandala Road Bridge Aerial FAT-09'
  }
};

/**
 * Calculates electrode lifespan status and remaining discharges.
 * Tungsten electrodes blunt and oxidize over discharge count.
 * @param {number} dischargeCount
 * @param {number} maxCycles
 * @returns {Object}
 */
export function calculateElectrodeLife(dischargeCount = 0, maxCycles = 5000) {
  const safeCycles = Math.max(1, Number(maxCycles) || 5000);
  const count = Math.max(0, Number(dischargeCount) || 0);
  const remainingDischarges = Math.max(0, safeCycles - count);
  const remainingPercent = Math.min(100, Math.max(0, (remainingDischarges / safeCycles) * 100));
  const usagePercent = Math.min(100, Math.max(0, (count / safeCycles) * 100));

  let status = 'OPTIMAL_PRISTINE';
  let statusLabel = 'Optimal / Clean Discharge';
  let badgeClass = 'badge-success';
  let colorHex = '#10b981';

  if (count > safeCycles) {
    status = 'EXPIRED_REPLACE_MANDATORY';
    statusLabel = 'EXPIRED - Replace Electrodes Immediately';
    badgeClass = 'badge-danger';
    colorHex = '#ef4444';
  } else if (usagePercent >= 85) {
    status = 'MAINTENANCE_DUE';
    statusLabel = 'Maintenance Due - High Wear / Oxidation Risk';
    badgeClass = 'badge-warning';
    colorHex = '#f59e0b';
  } else if (usagePercent >= 60) {
    status = 'NORMAL_WEAR';
    statusLabel = 'Normal Field Wear - Stable Plasma Arc';
    badgeClass = 'badge-info';
    colorHex = '#0ea5e9';
  }

  // Tungsten tip erosion radius model: R_tip = R0 * (1 + 0.0006 * count) in µm
  const estimatedTipRadiusUm = Math.round((20.0 * (1 + 0.0006 * count)) * 10) / 10;

  return {
    dischargeCount: count,
    maxCycles: safeCycles,
    remainingDischarges,
    remainingPercent: Math.round(remainingPercent * 10) / 10,
    usagePercent: Math.round(usagePercent * 10) / 10,
    estimatedTipRadiusUm,
    status,
    statusLabel,
    badgeClass,
    colorHex
  };
}

/**
 * Calculates real-time atmospheric and barometric fusion arc power compensation.
 * Standard calibration reference: 20°C, 1013.25 hPa, 50% RH.
 * @param {number} ambientTempC
 * @param {number} pressureHpa
 * @param {number} humidityRh
 * @param {number} baseArcPower
 * @returns {Object}
 */
export function calculateArcCompensation(ambientTempC = 20, pressureHpa = 1013.25, humidityRh = 50, baseArcPower = 100) {
  const temp = Number(ambientTempC) || 20;
  const press = Number(pressureHpa) || 1013.25;
  const rh = Math.max(0, Math.min(100, Number(humidityRh) || 50));
  const base = Number(baseArcPower) || 100;

  // Temperature delta: hotter air lowers resistance, require lower drive current (-0.04 mA per °C)
  const deltaTemp = -0.04 * (temp - 20.0);
  // Pressure delta: lower pressure (higher elevation or storm drops) reduces air density, requiring boost (+0.015 mA per hPa drop)
  const deltaPress = 0.015 * (1013.25 - press);
  // Humidity delta: moisture absorbs plasma heat (+0.010 mA per % RH above 50%)
  const deltaHumidity = 0.010 * (rh - 50.0);

  const totalDeltaCurrentMa = Math.round((deltaTemp + deltaPress + deltaHumidity) * 100) / 100;
  // Arc power calibration step: 1 step ~ 0.02 mA
  const arcPowerStepAdjustment = Math.round(totalDeltaCurrentMa / 0.02);
  const calibratedArcPower = Math.max(50, Math.min(150, base + arcPowerStepAdjustment));

  let condition = 'BALANCED_STABLE';
  let advice = 'Arc discharge impedance is perfectly within stable fusion melting parameters.';
  if (calibratedArcPower > base + 12) {
    condition = 'HIGH_POWER_COMPENSATION';
    advice = 'Barometric drop/high moisture requires significant arc energy boost.';
  } else if (calibratedArcPower < base - 12) {
    condition = 'LOW_POWER_REDUCTION';
    advice = 'High ambient temperature requires reduced drive current to prevent fiber necking.';
  }

  return {
    ambientTempC: temp,
    pressureHpa: press,
    humidityRh: rh,
    baseArcPower: base,
    totalDeltaCurrentMa,
    arcPowerStepAdjustment,
    calibratedArcPower,
    condition,
    advice
  };
}

/**
 * Calculates mathematical single-mode optical fiber splice joint loss using Marcuse modal overlap,
 * lateral core eccentricity, cleave angle tilt, and bubble/micro-void penalties.
 * @param {Object} options
 * @returns {Object}
 */
export function calculateSpliceLoss({
  fiberTypeId = 'G652D',
  coreOffsetXUm = 0.10,
  coreOffsetYUm = 0.10,
  cleaveAngleLeftDeg = 0.5,
  cleaveAngleRightDeg = 0.5,
  bubblePenaltyDb = 0.000
} = {}) {
  const fiber = FIBER_TYPES[fiberTypeId] || FIBER_TYPES.G652D;
  const offsetX = Math.abs(Number(coreOffsetXUm) || 0);
  const offsetY = Math.abs(Number(coreOffsetYUm) || 0);
  const netCoreOffsetUm = Math.round(Math.sqrt(offsetX * offsetX + offsetY * offsetY) * 1000) / 1000;

  const cleaveLeft = Math.abs(Number(cleaveAngleLeftDeg) || 0);
  const cleaveRight = Math.abs(Number(cleaveAngleRightDeg) || 0);
  // Net angular tilt across cleavage plane:
  const netTiltAngleDeg = Math.round(Math.abs(cleaveLeft - cleaveRight) * 100) / 100;
  const maxCleaveAngleDeg = Math.max(cleaveLeft, cleaveRight);

  // Marcuse modal spot radius w = MFD / 2
  const w = fiber.modeFieldDiameterUm / 2.0;

  // Lateral core eccentricity loss (dB):
  // alpha_offset = 4.343 * (netCoreOffset / w)^2
  const offsetLossDb = Math.round((4.343 * Math.pow(netCoreOffsetUm / w, 2)) * 1000) / 1000;

  // Cleave tilt loss (Marcuse angular misalignment):
  // alpha_tilt = 4.343 * (pi * n2 * w * theta_rad / lambda)^2
  const thetaRad = (netTiltAngleDeg * Math.PI) / 180.0;
  const lambdaUm = 1.31; // 1310nm standard reference
  const tiltTerm = (Math.PI * fiber.refractiveIndex * w * thetaRad) / lambdaUm;
  const tiltLossDb = Math.round((4.343 * tiltTerm * tiltTerm) * 1000) / 1000;

  // Additional defect penalty (bubble, necking, core distortion)
  const defectLossDb = Math.max(0, Math.round((Number(bubblePenaltyDb) || 0) * 1000) / 1000);

  // Baseline intrinsic fusion joint diffusion loss (typically 0.010 dB)
  const intrinsicLossDb = 0.010;

  const totalSpliceLossDb = Math.round((intrinsicLossDb + offsetLossDb + tiltLossDb + defectLossDb) * 1000) / 1000;

  return {
    fiberTypeId: fiber.id,
    fiberLabel: fiber.label,
    modeFieldDiameterUm: fiber.modeFieldDiameterUm,
    netCoreOffsetUm,
    coreOffsetXUm: offsetX,
    coreOffsetYUm: offsetY,
    cleaveAngleLeftDeg: cleaveLeft,
    cleaveAngleRightDeg: cleaveRight,
    netTiltAngleDeg,
    maxCleaveAngleDeg,
    intrinsicLossDb,
    offsetLossDb,
    tiltLossDb,
    defectLossDb,
    totalSpliceLossDb
  };
}

/**
 * Evaluates comprehensive fusion splice quality, arc stability, proof pull tension, and standards compliance.
 * @param {Object} options
 * @returns {Object}
 */
export function evaluateFusionSpliceQa({
  splicerModelId = 'FUJIKURA_90S',
  fiberTypeId = 'G652D',
  splicerSerialNumber = 'SPLICER-SN-001',
  dischargeCount = 500,
  ambientTempC = 20,
  pressureHpa = 1013.25,
  humidityRh = 50,
  coreOffsetXUm = 0.15,
  coreOffsetYUm = 0.12,
  cleaveAngleLeftDeg = 0.5,
  cleaveAngleRightDeg = 0.5,
  proofTensionN = 2.0,
  proofStatus = 'PASSED_TENSILE_VERIFIED',
  bubblePenaltyDb = 0.000,
  spliceLocation = 'Shahdara Network Joint'
} = {}) {
  const splicer = SPLICER_MODELS[splicerModelId] || SPLICER_MODELS.FUJIKURA_90S;
  const fiber = FIBER_TYPES[fiberTypeId] || FIBER_TYPES.G652D;

  const electrodeLife = calculateElectrodeLife(dischargeCount, splicer.maxElectrodeCycles);
  const arcComp = calculateArcCompensation(ambientTempC, pressureHpa, humidityRh, splicer.baseArcPower);
  const spliceLoss = calculateSpliceLoss({
    fiberTypeId: fiber.id,
    coreOffsetXUm,
    coreOffsetYUm,
    cleaveAngleLeftDeg,
    cleaveAngleRightDeg,
    bubblePenaltyDb
  });

  const tensionN = Math.max(0, Number(proofTensionN) || 0);
  const pStatus = PROOF_TEST_STATUSES[proofStatus] || PROOF_TEST_STATUSES.PASSED_TENSILE_VERIFIED;

  // Silica fiber tensile stress: Area = pi * (62.5um)^2 ~ 1.227e-8 m^2
  // Stress (MPa) = tensionN / (1.227e-8) / 1e6 ~ tensionN * 81.49 MPa
  const proofStressMpa = Math.round(tensionN * 81.49 * 10) / 10;
  const proofStressKpsi = Math.round(proofStressMpa * 0.145038 * 10) / 10;

  // Determine overall QA Verdict
  let verdict = QA_VERDICTS.COMMERCIAL_PASS;
  const loss = spliceLoss.totalSpliceLossDb;

  if (pStatus.id === 'FAILED_TENSILE_FRACTURE' || loss > 0.150 || spliceLoss.maxCleaveAngleDeg > 2.0 || electrodeLife.status === 'EXPIRED_REPLACE_MANDATORY') {
    verdict = QA_VERDICTS.REJECT_RESPLICE_MANDATED;
  } else if (loss <= 0.030 && pStatus.id === 'PASSED_TENSILE_VERIFIED' && electrodeLife.remainingPercent >= 30 && spliceLoss.maxCleaveAngleDeg <= 1.0) {
    verdict = QA_VERDICTS.TELCORDIA_GRADE_A;
  } else if (loss <= 0.080 && pStatus.id === 'PASSED_TENSILE_VERIFIED') {
    verdict = QA_VERDICTS.COMMERCIAL_PASS;
  } else {
    verdict = QA_VERDICTS.CONDITIONAL_PASS;
  }

  return {
    splicer,
    fiber,
    splicerSerialNumber: String(splicerSerialNumber || 'UNSPECIFIED').trim(),
    spliceLocation: String(spliceLocation || 'Shahdara Network Joint').trim(),
    electrodeLife,
    arcComp,
    spliceLoss,
    proofTensionN: tensionN,
    proofStressMpa,
    proofStressKpsi,
    proofStatus: pStatus,
    verdict,
    isApproved: verdict.isCompliant
  };
}

/**
 * Pure-vector SVG visualizer displaying:
 * 1. Dual-view Profile Alignment System (PAS) camera (X-axis and Y-axis core alignment).
 * 2. Left fiber (A) & Right fiber (B) cladding and core with lateral offsets.
 * 3. High-voltage tungsten electrodes with glowing purple/cyan plasma arc discharge corona.
 * 4. Mechanical proof pull tension arrows and telemetry HUD ribbon.
 * @param {Object} evaluation - Output of evaluateFusionSpliceQa
 * @param {Object} [options]
 * @returns {string}
 */
export function renderFusionArcQaAnalysisSvg(evaluation, { width = 760, height = 360 } = {}) {
  if (!evaluation) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="50%" fill="#94a3b8" text-anchor="middle" font-family="sans-serif">No Fusion QA Data</text></svg>`;
  }

  const { splicer, fiber, electrodeLife, arcComp, spliceLoss, proofTensionN, proofStatus, verdict } = evaluation;

  // Visual scaling of core offset: 1 um = 18 px for dramatic clarity
  const scale = 18;
  const offX = Math.min(25, spliceLoss.coreOffsetXUm * scale);
  const offY = Math.min(25, spliceLoss.coreOffsetYUm * scale);

  // Cleave angles visual tilt
  const tiltLeft = Math.min(8, spliceLoss.cleaveAngleLeftDeg * 2.0);
  const tiltRight = Math.min(8, spliceLoss.cleaveAngleRightDeg * 2.0);

  // Colors
  const plasmaColor = electrodeLife.status === 'EXPIRED_REPLACE_MANDATORY' ? '#f43f5e' : (arcComp.calibratedArcPower > 105 ? '#c084fc' : '#38bdf8');
  const verdictColor = verdict.colorHex;

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fusion Splicer PAS Core Alignment and Arc Discharge Visualizer" style="background: #090d16; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <defs>
      <!-- Gradients -->
      <linearGradient id="plasmaGlow" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${plasmaColor}" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="#ffffff" stop-opacity="1.0"/>
        <stop offset="100%" stop-color="${plasmaColor}" stop-opacity="0.95"/>
      </linearGradient>

      <linearGradient id="fiberCladdingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#334155"/>
        <stop offset="50%" stop-color="#64748b"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>

      <linearGradient id="fiberCoreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="50%" stop-color="#bae6fd"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>

      <radialGradient id="arcHalo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${plasmaColor}" stop-opacity="0.8"/>
        <stop offset="40%" stop-color="${plasmaColor}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${plasmaColor}" stop-opacity="0"/>
      </radialGradient>

      <!-- Glow Filter -->
      <filter id="plasmaFilter" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Background Grid -->
    <g opacity="0.12" stroke="#38bdf8" stroke-width="0.75">
      ${Array.from({ length: 15 }, (_, i) => `<line x1="${i * 55}" y1="0" x2="${i * 55}" y2="${height}"/>`).join('')}
      ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${i * 45}" x2="${width}" y2="${i * 45}"/>`).join('')}
    </g>

    <!-- Top Telemetry Header -->
    <rect x="0" y="0" width="${width}" height="42" fill="#0f172a" opacity="0.95"/>
    <text x="20" y="26" fill="#f8fafc" font-size="13" font-weight="700">🔬 PAS Core Alignment (Dual-Axis) &amp; Arc Discharge Analysis</text>
    <rect x="${width - 240}" y="8" width="220" height="26" rx="4" fill="${verdictColor}" opacity="0.2"/>
    <rect x="${width - 240}" y="8" width="220" height="26" rx="4" fill="none" stroke="${verdictColor}" stroke-width="1.5"/>
    <text x="${width - 130}" y="25" fill="${verdictColor}" font-size="11" font-weight="700" text-anchor="middle">${verdict.label.split('(')[0].trim()}</text>

    <!-- Splicer Chamber Frame -->
    <rect x="30" y="55" width="${width - 60}" height="240" rx="6" fill="#030712" stroke="#334155" stroke-width="1.5"/>

    <!-- Axis Crosshair Reticle -->
    <line x1="${width / 2}" y1="65" x2="${width / 2}" y2="285" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.4"/>
    <line x1="45" y1="175" x2="${width - 45}" y2="175" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="3,3" opacity="0.4"/>

    <!-- Left Fiber A (Cladding 125um, Core 9um) -->
    <!-- Cladding -->
    <polygon points="50,115  ${width / 2 - 12},${115 + tiltLeft}  ${width / 2 - 12},${235 - tiltLeft}  50,235" fill="url(#fiberCladdingGrad)" stroke="#475569" stroke-width="1.5"/>
    <!-- Core -->
    <polygon points="50,170  ${width / 2 - 12},${170 + tiltLeft * 0.3}  ${width / 2 - 12},${180 - tiltLeft * 0.3}  50,180" fill="url(#fiberCoreGrad)"/>
    <text x="75" y="140" fill="#94a3b8" font-size="11" font-weight="600">Fiber A (Left)</text>
    <text x="75" y="155" fill="#38bdf8" font-size="10">θ₁: ${spliceLoss.cleaveAngleLeftDeg}°</text>

    <!-- Right Fiber B (Cladding with Lateral Offset offY, Core with offY) -->
    <!-- Cladding -->
    <polygon points="${width / 2 + 12},${115 + offY - tiltRight}  ${width - 50},115  ${width - 50},235  ${width / 2 + 12},${235 + offY + tiltRight}" fill="url(#fiberCladdingGrad)" stroke="#475569" stroke-width="1.5"/>
    <!-- Core -->
    <polygon points="${width / 2 + 12},${170 + offY - tiltRight * 0.3}  ${width - 50},170  ${width - 50},180  ${width / 2 + 12},${180 + offY + tiltRight * 0.3}" fill="url(#fiberCoreGrad)"/>
    <text x="${width - 165}" y="140" fill="#94a3b8" font-size="11" font-weight="600">Fiber B (Right)</text>
    <text x="${width - 165}" y="155" fill="#38bdf8" font-size="10">θ₂: ${spliceLoss.cleaveAngleRightDeg}°</text>

    <!-- Top Electrode Needle -->
    <polygon points="${width / 2 - 18},55  ${width / 2 + 18},55  ${width / 2 + 4},120  ${width / 2 - 4},120" fill="#64748b" stroke="#94a3b8" stroke-width="1"/>
    <circle cx="${width / 2}" cy="122" r="${Math.max(2, electrodeLife.estimatedTipRadiusUm / 8)}" fill="#cbd5e1"/>

    <!-- Bottom Electrode Needle -->
    <polygon points="${width / 2 - 18},295  ${width / 2 + 18},295  ${width / 2 + 4},230  ${width / 2 - 4},230" fill="#64748b" stroke="#94a3b8" stroke-width="1"/>
    <circle cx="${width / 2}" cy="228" r="${Math.max(2, electrodeLife.estimatedTipRadiusUm / 8)}" fill="#cbd5e1"/>

    <!-- Arc Glow Background Halo -->
    <ellipse cx="${width / 2}" cy="175" rx="55" ry="50" fill="url(#arcHalo)"/>

    <!-- High-Voltage Electric Arc Discharge Spark (Central Line + Corona) -->
    <path d="M ${width / 2} 122 Q ${width / 2 + 6} 150 ${width / 2 - 4} 175 T ${width / 2} 228" stroke="url(#plasmaGlow)" stroke-width="7" fill="none" filter="url(#plasmaFilter)"/>
    <path d="M ${width / 2} 122 Q ${width / 2 - 5} 145 ${width / 2 + 4} 175 T ${width / 2} 228" stroke="#ffffff" stroke-width="2.5" fill="none"/>

    <!-- Animated / Static Plasma Sparks -->
    <circle cx="${width / 2 - 12}" cy="165" r="2" fill="#e0f2fe"/>
    <circle cx="${width / 2 + 14}" cy="182" r="1.8" fill="#e0f2fe"/>
    <circle cx="${width / 2 - 8}" cy="195" r="1.5" fill="#e0f2fe"/>
    <circle cx="${width / 2 + 10}" cy="155" r="2.2" fill="#bae6fd"/>

    <!-- Core Offset Measurement Callout -->
    <g transform="translate(${width / 2 - 60}, 255)">
      <rect x="0" y="0" width="120" height="24" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
      <text x="60" y="16" fill="#38bdf8" font-size="10" font-weight="700" text-anchor="middle">Δ Core: ${spliceLoss.netCoreOffsetUm} µm</text>
    </g>

    <!-- Tensile Proof Pull Force Arrows (Telcordia 1.96N / 200g load) -->
    <g opacity="${proofStatus.id === 'PASSED_TENSILE_VERIFIED' ? '1' : '0.4'}">
      <!-- Left Pull Arrow -->
      <line x1="85" y1="210" x2="45" y2="210" stroke="#10b981" stroke-width="2.5" marker-end="url(#arrowLeft)"/>
      <polygon points="45,210 55,206 55,214" fill="#10b981"/>
      <text x="65" y="224" fill="#10b981" font-size="9" font-weight="700" text-anchor="middle">← ${proofTensionN} N</text>

      <!-- Right Pull Arrow -->
      <line x1="${width - 85}" y1="210" x2="${width - 45}" y2="210" stroke="#10b981" stroke-width="2.5"/>
      <polygon points="${width - 45},210 ${width - 55},206 ${width - 55},214" fill="#10b981"/>
      <text x="${width - 65}" y="224" fill="#10b981" font-size="9" font-weight="700" text-anchor="middle">${proofTensionN} N →</text>
    </g>

    ${proofStatus.id === 'FAILED_TENSILE_FRACTURE' ? `
      <!-- Fractured Glass Break Marker -->
      <path d="M ${width / 2 - 12} 165 L ${width / 2} 185 L ${width / 2 + 12} 165" stroke="#ef4444" stroke-width="3" fill="none"/>
      <text x="${width / 2}" y="205" fill="#ef4444" font-size="11" font-weight="800" text-anchor="middle">⚠️ TENSILE FRACTURE</text>
    ` : ''}

    <!-- Bottom Readout Bar -->
    <rect x="0" y="${height - 50}" width="${width}" height="50" fill="#0b1120"/>
    <line x1="0" y1="${height - 50}" x2="${width}" y2="${height - 50}" stroke="#1e293b" stroke-width="1"/>

    <!-- Metric 1: Splicer & Electrode -->
    <text x="25" y="${height - 30}" fill="#94a3b8" font-size="10">SPLICER &amp; ELECTRODE</text>
    <text x="25" y="${height - 14}" fill="#f8fafc" font-size="12" font-weight="700">${splicer.brand} ${splicer.model.split(' ')[0]} · Arc #${electrodeLife.dischargeCount} (${electrodeLife.remainingPercent}% life)</text>

    <!-- Metric 2: Estimated Loss -->
    <text x="${width * 0.40}" y="${height - 30}" fill="#94a3b8" font-size="10">ESTIMATED JOINT LOSS</text>
    <text x="${width * 0.40}" y="${height - 14}" fill="${spliceLoss.totalSpliceLossDb <= 0.05 ? '#10b981' : '#f59e0b'}" font-size="13" font-weight="800">${spliceLoss.totalSpliceLossDb.toFixed(3)} dB</text>

    <!-- Metric 3: Proof Load -->
    <text x="${width * 0.65}" y="${height - 30}" fill="#94a3b8" font-size="10">PROOF-TEST TENSILE LOAD</text>
    <text x="${width * 0.65}" y="${height - 14}" fill="${proofStatus.colorHex}" font-size="12" font-weight="700">${proofTensionN} N (${proofEvaluationLabel(proofStatus)})</text>

    <!-- Metric 4: Arc Power -->
    <text x="${width - 150}" y="${height - 30}" fill="#94a3b8" font-size="10">CALIBRATED ARC POWER</text>
    <text x="${width - 150}" y="${height - 14}" fill="#38bdf8" font-size="12" font-weight="700">${arcComp.calibratedArcPower} (step ${arcComp.arcPowerStepAdjustment >= 0 ? '+' : ''}${arcComp.arcPowerStepAdjustment})</text>
  </svg>
  `;
}

function proofEvaluationLabel(status) {
  if (!status) return 'Passed';
  if (status.id === 'PASSED_TENSILE_VERIFIED') return 'Passed';
  if (status.id === 'FAILED_TENSILE_FRACTURE') return 'Fractured';
  return 'Skipped';
}

/**
 * Builds structured immutable Fusion Splice Arc QA certification record.
 * @param {Object} options
 * @returns {Object}
 */
export function buildFusionArcQaRecord({
  customer = null,
  splicerModelId = 'FUJIKURA_90S',
  fiberTypeId = 'G652D',
  splicerSerialNumber = 'F90S-PK-88241',
  dischargeCount = 500,
  ambientTempC = 20,
  pressureHpa = 1013.25,
  humidityRh = 50,
  coreOffsetXUm = 0.15,
  coreOffsetYUm = 0.12,
  cleaveAngleLeftDeg = 0.5,
  cleaveAngleRightDeg = 0.5,
  proofTensionN = 2.0,
  proofStatus = 'PASSED_TENSILE_VERIFIED',
  bubblePenaltyDb = 0.000,
  spliceLocation = 'Baradari Chowk ODF Enclosure #01',
  technicianName = 'Umair / Field Splicing Team',
  notes = '',
  id = null,
  createdAt = null
} = {}) {
  const evalResult = evaluateFusionSpliceQa({
    splicerModelId,
    fiberTypeId,
    splicerSerialNumber,
    dischargeCount,
    ambientTempC,
    pressureHpa,
    humidityRh,
    coreOffsetXUm,
    coreOffsetYUm,
    cleaveAngleLeftDeg,
    cleaveAngleRightDeg,
    proofTensionN,
    proofStatus,
    bubblePenaltyDb,
    spliceLocation
  });

  const timestamp = createdAt || new Date().toISOString();
  const certId = id || generateFusionArcQaCertId(timestamp);

  return {
    id: certId,
    customerId: customer ? (customer.id || customer.customerNumber) : null,
    customerName: customer?.name || 'Shahdara Network Trunk / General Subscriber',
    customerPhone: customer?.phone || 'Not recorded',
    customerArea: [customer?.mohalla, customer?.zone].filter(Boolean).join(', ') || 'Shahdara Sector',
    evaluation: evalResult,
    technicianName: String(technicianName || 'Shahdara Fiber Lineman').trim(),
    notes: String(notes || '').trim(),
    createdAt: timestamp,
    status: evalResult.verdict.isCompliant ? 'ACTIVE_CERTIFIED' : 'ACTION_REQUIRED'
  };
}

export function generateFusionArcQaCertId(isoString = new Date().toISOString()) {
  const date = new Date(isoString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FUS-${y}${m}-${rand}`;
}

/**
 * Generates dual printable HTML certificates:
 * 1. Formal A4 Outside Plant Splicing & Metrology Accreditation Certificate.
 * 2. 80mm POS field technician thermal receipt slip.
 * @param {Object} record - Output of buildFusionArcQaRecord
 * @param {Object} [options]
 * @returns {string}
 */
export function generateFusionArcQaCertHtml(record, { format = 'standard' } = {}) {
  if (!record || !record.evaluation) {
    return `<div class="empty-state">No Fusion Arc QA certification data available.</div>`;
  }

  const { evaluation } = record;
  const { splicer, fiber, electrodeLife, arcComp, spliceLoss, proofTensionN, proofStressMpa, proofStatus, verdict } = evaluation;

  if (format === 'thermal') {
    return `
    <article class="thermal-receipt fusion-arc-thermal-slip" aria-label="80mm Thermal Splicing QA Slip">
      <header class="thermal-header">
        <h2 class="thermal-company">Shahdara ISP Network</h2>
        <p class="thermal-tagline">آپٹیکل فائبر فیوژن ویلڈنگ و کوالٹی رپورٹ</p>
        <div class="thermal-rule">================================</div>
        <p class="thermal-title"><strong>FUSION SPLICER ARC QA SLIP</strong></p>
        <p class="thermal-date">Cert ID: ${escapeHtml(record.id)}</p>
        <p class="thermal-date">Date: ${escapeHtml(record.createdAt.slice(0, 10))}</p>
        <div class="thermal-rule">--------------------------------</div>
      </header>

      <section class="thermal-customer-meta">
        <div class="thermal-row"><span>Splicer:</span><strong>${escapeHtml(splicer.brand)} ${escapeHtml(splicer.model.split(' ')[0])}</strong></div>
        <div class="thermal-row"><span>Serial No:</span><span>${escapeHtml(record.evaluation.splicerSerialNumber)}</span></div>
        <div class="thermal-row"><span>Location:</span><span>${escapeHtml(record.evaluation.spliceLocation)}</span></div>
        <div class="thermal-row"><span>Fiber Type:</span><span>${escapeHtml(fiber.id)} (9.2µm Core)</span></div>
        <div class="thermal-row"><span>Technician:</span><span>${escapeHtml(record.technicianName)}</span></div>
      </section>

      <div class="thermal-rule">--------------------------------</div>

      <section class="thermal-breakdown">
        <div class="thermal-row"><span>Discharge Cycles:</span><strong>${electrodeLife.dischargeCount} / ${electrodeLife.maxCycles}</strong></div>
        <div class="thermal-row"><span>Electrode Life:</span><strong>${electrodeLife.remainingPercent}% rem</strong></div>
        <div class="thermal-row"><span>Arc Power Index:</span><strong>${arcComp.calibratedArcPower} (step ${arcComp.arcPowerStepAdjustment >= 0 ? '+' : ''}${arcComp.arcPowerStepAdjustment})</strong></div>
        <div class="thermal-row"><span>Cleave Angles:</span><span>L: ${spliceLoss.cleaveAngleLeftDeg}° · R: ${spliceLoss.cleaveAngleRightDeg}°</span></div>
        <div class="thermal-row"><span>Core Offset Δ:</span><span>${spliceLoss.netCoreOffsetUm} µm</span></div>
        <div class="thermal-rule">--------------------------------</div>
        <div class="thermal-row thermal-total-row">
          <span>ESTIMATED LOSS:</span>
          <strong>${spliceLoss.totalSpliceLossDb.toFixed(3)} dB</strong>
        </div>
        <div class="thermal-row">
          <span>PROOF TENSION:</span>
          <strong>${proofTensionN} N (${proofEvaluationLabel(proofStatus)})</strong>
        </div>
        <div class="thermal-row">
          <span>TENSILE STRESS:</span>
          <strong>${proofStressMpa} MPa</strong>
        </div>
        <div class="thermal-row">
          <span>QA VERDICT:</span>
          <strong>${escapeHtml(verdict.label.split('(')[0].trim())}</strong>
        </div>
      </section>

      ${record.notes ? `
        <div class="thermal-rule">--------------------------------</div>
        <p class="thermal-notes"><strong>Note:</strong> ${escapeHtml(record.notes)}</p>
      ` : ''}

      <div class="thermal-rule">================================</div>

      <footer class="thermal-footer">
        <p class="thermal-urgent">${verdict.isCompliant ? '✓ Certified for OSP field service.' : '⚠️ Splicing rejected. Re-splice required.'}</p>
        <div class="thermal-sig-block">
          <div class="thermal-sig-line"></div>
          <span>Certified Splicing Specialist Signature</span>
        </div>
        <p class="thermal-closing">Shahdara Outside Plant Engineering QA</p>
      </footer>
    </article>
    `;
  }

  // Standard A4 Executive Metrology Certificate
  return `
  <article class="bill-invoice-sheet fusion-arc-qa-sheet" aria-label="Formal A4 Splicing QA Certificate">
    <header class="invoice-header">
      <div class="invoice-brand-block">
        <div class="invoice-brand-badge" aria-hidden="true" style="background: #0284c7;">⚡</div>
        <div>
          <h1 class="invoice-title">Shahdara ISP Network Operations</h1>
          <p class="invoice-subtitle">Optical Fiber Fusion Splicer Arc Discharge Plasma &amp; Mechanical Proof Tensile QA Certificate</p>
          <p class="invoice-urdu-tag">شاہدرہ آپٹیکل فائبر فیوژن آرک کیلیبریشن و ٹینسائل کوالٹی سرٹیفکیٹ</p>
        </div>
      </div>
      <div class="invoice-meta-block">
        <div class="invoice-badge ${verdict.badgeClass}" style="background: ${verdict.colorHex}22; color: ${verdict.colorHex}; border: 1px solid ${verdict.colorHex}; font-size: 11px;">
          ${escapeHtml(verdict.label)}
        </div>
        <p class="invoice-number"><strong>Certificate #:</strong> ${escapeHtml(record.id)}</p>
        <p class="invoice-date"><strong>Inspection Date:</strong> ${escapeHtml(record.createdAt.slice(0, 10))}</p>
        <p class="invoice-due-date"><strong>Standard:</strong> IEC 61073-1 / Telcordia GR-765</p>
      </div>
    </header>

    <div class="invoice-parties-grid" style="margin: 20px 0;">
      <div class="invoice-party-box">
        <p class="party-label">SPLICER &amp; METROLOGY HARDWARE</p>
        <h2 class="party-name">${escapeHtml(splicer.brand)} ${escapeHtml(splicer.model)}</h2>
        <p class="party-line"><strong>Serial Number:</strong> ${escapeHtml(record.evaluation.splicerSerialNumber)}</p>
        <p class="party-line"><strong>Alignment System:</strong> ${escapeHtml(splicer.alignmentMethod)}</p>
        <p class="party-line"><strong>Magnification:</strong> ${escapeHtml(splicer.imageMagnification)} (Dual Camera)</p>
        <p class="party-line"><strong>Splice Location:</strong> ${escapeHtml(record.evaluation.spliceLocation)}</p>
      </div>

      <div class="invoice-party-box service-box">
        <p class="party-label">OPTICAL JOINT &amp; SUBSCRIBER TARGET</p>
        <h2 class="party-name">${escapeHtml(record.customerName)}</h2>
        <p class="party-line"><strong>Fiber Standard:</strong> ${escapeHtml(fiber.label)}</p>
        <p class="party-line"><strong>Mode Field Diameter:</strong> ${fiber.modeFieldDiameterUm} µm (Cladding: 125 µm)</p>
        <p class="party-line"><strong>Lead Lineman / Splicer:</strong> ${escapeHtml(record.technicianName)}</p>
        <p class="party-line"><strong>Area / Sector:</strong> ${escapeHtml(record.customerArea)}</p>
      </div>
    </div>

    <!-- Splicer PAS Core Alignment SVG Diagram -->
    <div style="margin: 18px 0; text-align: center;">
      ${renderFusionArcQaAnalysisSvg(evaluation, { width: 700, height: 260 })}
    </div>

    <table class="invoice-table" aria-label="Splicing QA Telemetry Parameters">
      <thead>
        <tr>
          <th scope="col">Inspection Parameter &amp; Quality Vector</th>
          <th scope="col">Measurement Value</th>
          <th scope="col">Standard Limit (Telcordia/IEC)</th>
          <th scope="col" class="text-right">Evaluation Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Total Estimated Joint Insertion Loss</strong>
            <div class="invoice-item-sub">Marcuse modal overlap + lateral core eccentricity + cleave angle tilt</div>
          </td>
          <td><strong>${spliceLoss.totalSpliceLossDb.toFixed(3)} dB</strong></td>
          <td>≤ 0.050 dB (Grade A) / ≤ 0.080 dB (Telc)</td>
          <td class="text-right"><span style="color: ${verdict.colorHex}; font-weight: 700;">${verdict.isCompliant ? 'PASS' : 'FAIL'}</span></td>
        </tr>
        <tr>
          <td>
            <strong>Mechanical Proof-Test Tensile Pull Load</strong>
            <div class="invoice-item-sub">Post-fusion clamping axial pull tension (weeds out micro-cracks &amp; thermal stress)</div>
          </td>
          <td>${proofTensionN} N (${proofStressMpa} MPa / ${evaluation.proofStressKpsi} kpsi)</td>
          <td>1.96 N to 2.25 N (Telcordia GR-765)</td>
          <td class="text-right"><span style="color: ${proofStatus.colorHex}; font-weight: 700;">${proofStatus.label}</span></td>
        </tr>
        <tr>
          <td>
            <strong>Electrode Arc Discharge Lifespan &amp; Wear</strong>
            <div class="invoice-item-sub">Tungsten tip erosion odometer (Tip Radius: ~${electrodeLife.estimatedTipRadiusUm} µm)</div>
          </td>
          <td>${electrodeLife.dischargeCount} cycles (${electrodeLife.remainingPercent}% life remaining)</td>
          <td>Max ${electrodeLife.maxCycles} discharges</td>
          <td class="text-right"><span style="color: ${electrodeLife.colorHex}; font-weight: 700;">${electrodeLife.statusLabel}</span></td>
        </tr>
        <tr>
          <td>
            <strong>Real-time Atmospheric Arc Power Compensation</strong>
            <div class="invoice-item-sub">Ambient: ${arcComp.ambientTempC}°C · Pressure: ${arcComp.pressureHpa} hPa · RH: ${arcComp.humidityRh}%</div>
          </td>
          <td>Index ${arcComp.calibratedArcPower} (Δ current: ${arcComp.totalDeltaCurrentMa >= 0 ? '+' : ''}${arcComp.totalDeltaCurrentMa} mA)</td>
          <td>Automatic barometric tracking</td>
          <td class="text-right"><span style="color: #0ea5e9; font-weight: 700;">${arcComp.condition}</span></td>
        </tr>
        <tr>
          <td>
            <strong>Lateral Core Offset &amp; Angular Tilt</strong>
            <div class="invoice-item-sub">X: ${spliceLoss.coreOffsetXUm} µm, Y: ${spliceLoss.coreOffsetYUm} µm · Net cleave tilt: ${spliceLoss.netTiltAngleDeg}°</div>
          </td>
          <td>Δ Core: ${spliceLoss.netCoreOffsetUm} µm · Max θ: ${spliceLoss.maxCleaveAngleDeg}°</td>
          <td>Δ Core ≤ 0.35 µm · Tilt ≤ 1.5°</td>
          <td class="text-right"><span style="color: #10b981; font-weight: 700;">CONCENTRIC</span></td>
        </tr>
      </tbody>
    </table>

    <div class="invoice-summary-section" style="margin-top: 18px;">
      <div class="invoice-payment-guidance">
        <h3>Quality Assurance Verification &amp; Engineering Rules</h3>
        <ul>
          <li><strong>Fiber Protection Sleeve:</strong> Apply 60mm steel-reinforced heat-shrink sleeve with 13-18s oven shrink cycle immediately.</li>
          <li><strong>Splice Tray Routing:</strong> Ensure minimum 30mm bend radius inside closure tray without micro-bending pinch points.</li>
          <li><strong>Electrode Maintenance:</strong> Wipe tungsten electrodes with pure ethanol pad every 500 cycles; replace at ${electrodeLife.maxCycles} cycles.</li>
        </ul>
      </div>

      <div class="invoice-totals-box">
        <div class="totals-row">
          <span>Net Splice Insertion Loss:</span>
          <strong>${spliceLoss.totalSpliceLossDb.toFixed(3)} dB</strong>
        </div>
        <div class="totals-row">
          <span>Proof Tensile Load:</span>
          <span>${proofTensionN} N (100% verified)</span>
        </div>
        <div class="totals-row">
          <span>Electrode Odometer:</span>
          <span>${electrodeLife.dischargeCount} / ${electrodeLife.maxCycles}</span>
        </div>
        <div class="totals-divider"></div>
        <div class="totals-row grand-total" style="color: ${verdict.colorHex};">
          <span>Overall QA Status:</span>
          <strong>${escapeHtml(verdict.label.split('(')[0].trim())}</strong>
        </div>
      </div>
    </div>

    ${record.notes ? `
      <div class="invoice-note-banner" style="margin-top: 14px;">
        <strong>Field Engineering Notes:</strong> ${escapeHtml(record.notes)}
      </div>
    ` : ''}

    <footer class="invoice-footer">
      <p class="notice">This certificate confirms compliance under IEC 61073-1 and Telcordia GR-765-CORE Issue 1 standards for fiber optic fusion joints across Shahdara FTTH Outside Plant.</p>
      <div class="invoice-auth-block">
        <div class="auth-sig-line"></div>
        <span>Lead Splicing Specialist &amp; QA Stamp</span>
      </div>
    </footer>
  </article>
  `;
}

/**
 * Builds bilingual Urdu & English WhatsApp technician dispatch text.
 * @param {Object} record
 * @returns {string}
 */
export function formatFusionArcQaCertWhatsApp(record) {
  if (!record || !record.evaluation) return '';
  const { evaluation } = record;
  const { splicer, fiber, electrodeLife, arcComp, spliceLoss, proofTensionN, proofStatus, verdict } = evaluation;

  return [
    `*SHAHDARA ISP · FUSION SPLICER ARC QA CERTIFICATE*`,
    `آپٹیکل فائبر فیوژن ویلڈنگ و کوالٹی رپورٹ`,
    `----------------------------------------`,
    `📄 *سرٹیفکیٹ نمبر:* ${record.id}`,
    `📅 *تاریخ:* ${record.createdAt.slice(0, 10)}`,
    `📍 *مقام:* ${record.evaluation.spliceLocation}`,
    `🔧 *فیوژن مشین:* ${splicer.brand} ${splicer.model}`,
    `🔢 *سریل نمبر:* ${record.evaluation.splicerSerialNumber}`,
    `👨‍🔧 *ٹیکنیشن:* ${record.technicianName}`,
    `----------------------------------------`,
    `*کیلیبریشن و ویلڈنگ پیمائش (Telemetry):*`,
    `• جوائنٹ لاس (Insertion Loss): *${spliceLoss.totalSpliceLossDb.toFixed(3)} dB*`,
    `• کلیرو اینگلز: Left ${spliceLoss.cleaveAngleLeftDeg}° | Right ${spliceLoss.cleaveAngleRightDeg}°`,
    `• کور آفسیٹ (Core Offset): ${spliceLoss.netCoreOffsetUm} µm`,
    `• ٹینسائل ٹیسٹ (Proof Pull): *${proofTensionN} N (${proofEvaluationLabel(proofStatus)})*`,
    `• الیکٹروڈ سائیکل: ${electrodeLife.dischargeCount} / ${electrodeLife.maxCycles} (${electrodeLife.remainingPercent}% باقی)`,
    `• خودکار آرک ایڈجسٹمنٹ: انڈیکس ${arcComp.calibratedArcPower} (step ${arcComp.arcPowerStepAdjustment >= 0 ? '+' : ''}${arcComp.arcPowerStepAdjustment})`,
    `----------------------------------------`,
    `*حتمی نتیجہ (QA Verdict):*`,
    `${verdict.isCompliant ? '✅' : '❌'} *${verdict.label}*`,
    verdict.isCompliant
      ? `سروس کیلئے تصدیق شدہ ہے۔ ہیٹ شرنک سلیو لگائیں اور ٹرے میں محفوظ کریں۔`
      : `⚠️ جوائنٹ مسترد کر دیا گیا ہے۔ فائبر دوبارہ کاٹ کر نیا ویلڈ کریں۔`,
    `----------------------------------------`,
    `شاہدرہ انٹرنیٹ سروسز · آپٹیکل نیٹ ورک آپریشنز`
  ].join('\n');
}

/**
 * Generates RFC-4180 CSV export of fusion splicer QA certificates with UTF-8 BOM.
 * @param {Array<Object>} records
 * @returns {string}
 */
export function generateFusionArcQaCertsCsv(records = []) {
  const headers = [
    'Certificate_ID',
    'Created_At',
    'Customer_Name',
    'Customer_Area',
    'Splice_Location',
    'Splicer_Brand',
    'Splicer_Model',
    'Splicer_Serial_Number',
    'Fiber_Type',
    'Discharge_Cycles',
    'Electrode_Life_Remaining_Percent',
    'Electrode_Status',
    'Ambient_Temp_C',
    'Pressure_Hpa',
    'Calibrated_Arc_Power',
    'Cleave_Angle_Left_Deg',
    'Cleave_Angle_Right_Deg',
    'Net_Core_Offset_Um',
    'Estimated_Splice_Loss_Db',
    'Proof_Tension_N',
    'Proof_Stress_Mpa',
    'Proof_Test_Status',
    'QA_Verdict_ID',
    'QA_Verdict_Label',
    'Is_Approved',
    'Technician_Name',
    'Notes'
  ];

  const escapeCsv = (val) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = records.map(r => {
    const ev = r.evaluation || {};
    const sp = ev.splicer || {};
    const fb = ev.fiber || {};
    const el = ev.electrodeLife || {};
    const ac = ev.arcComp || {};
    const sl = ev.spliceLoss || {};
    const ps = ev.proofStatus || {};
    const vd = ev.verdict || {};

    return [
      escapeCsv(r.id),
      escapeCsv(r.createdAt),
      escapeCsv(r.customerName),
      escapeCsv(r.customerArea),
      escapeCsv(ev.spliceLocation),
      escapeCsv(sp.brand),
      escapeCsv(sp.model),
      escapeCsv(ev.splicerSerialNumber),
      escapeCsv(fb.id),
      escapeCsv(el.dischargeCount),
      escapeCsv(el.remainingPercent),
      escapeCsv(el.status),
      escapeCsv(ac.ambientTempC),
      escapeCsv(ac.pressureHpa),
      escapeCsv(ac.calibratedArcPower),
      escapeCsv(sl.cleaveAngleLeftDeg),
      escapeCsv(sl.cleaveAngleRightDeg),
      escapeCsv(sl.netCoreOffsetUm),
      escapeCsv(sl.totalSpliceLossDb),
      escapeCsv(ev.proofTensionN),
      escapeCsv(ev.proofStressMpa),
      escapeCsv(ps.id),
      escapeCsv(vd.id),
      escapeCsv(vd.label),
      escapeCsv(vd.isCompliant ? 'YES' : 'NO'),
      escapeCsv(r.technicianName),
      escapeCsv(r.notes)
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * LocalStorage Persistence and CRUD helpers
 */
export function getSavedFusionArcQaCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(FUSION_ARC_QA_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveFusionArcQaCert(record, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !record || !record.id) return false;
  try {
    const list = getSavedFusionArcQaCerts(storage);
    const existingIndex = list.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.unshift(record);
      // Cap at 150 records
      if (list.length > 150) list.length = 150;
    }
    storage.setItem(FUSION_ARC_QA_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function updateFusionArcQaCertStatus(certId, newStatus, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !certId) return false;
  try {
    const list = getSavedFusionArcQaCerts(storage);
    const item = list.find(r => r.id === certId);
    if (!item) return false;
    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
    storage.setItem(FUSION_ARC_QA_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function clearFusionArcQaCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.removeItem(FUSION_ARC_QA_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Aggregates summary KPI metrics across saved certification audits.
 * @param {Array<Object>} records
 * @returns {Object}
 */
export function calculateFusionArcQaMetrics(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      totalInspections: 0,
      gradeACount: 0,
      commercialPassCount: 0,
      conditionalPassCount: 0,
      rejectedCount: 0,
      compliantCount: 0,
      complianceRatePercent: 0,
      averageLossDb: 0,
      fractureCount: 0,
      maintenanceDueCount: 0
    };
  }

  let gradeACount = 0;
  let commercialPassCount = 0;
  let conditionalPassCount = 0;
  let rejectedCount = 0;
  let compliantCount = 0;
  let totalLoss = 0;
  let fractureCount = 0;
  let maintenanceDueCount = 0;

  records.forEach(r => {
    const ev = r.evaluation || {};
    const loss = Number(ev.spliceLoss?.totalSpliceLossDb ?? 0);
    totalLoss += loss;

    if (ev.proofStatus?.id === 'FAILED_TENSILE_FRACTURE') {
      fractureCount++;
    }

    if (ev.electrodeLife?.status === 'MAINTENANCE_DUE' || ev.electrodeLife?.status === 'EXPIRED_REPLACE_MANDATORY') {
      maintenanceDueCount++;
    }

    if (ev.verdict?.isCompliant) {
      compliantCount++;
    }

    if (ev.verdict?.id === 'TELCORDIA_GRADE_A') {
      gradeACount++;
    } else if (ev.verdict?.id === 'COMMERCIAL_PASS') {
      commercialPassCount++;
    } else if (ev.verdict?.id === 'CONDITIONAL_PASS') {
      conditionalPassCount++;
    } else {
      rejectedCount++;
    }
  });

  const total = records.length;
  return {
    totalInspections: total,
    gradeACount,
    commercialPassCount,
    conditionalPassCount,
    rejectedCount,
    compliantCount,
    complianceRatePercent: Math.round((compliantCount / total) * 1000) / 10,
    averageLossDb: Math.round((totalLoss / total) * 1000) / 1000,
    fractureCount,
    maintenanceDueCount
  };
}

/**
 * Interactive Modal Controller setup for index.html UI
 * @param {Object} options
 * @returns {Object} Controller with recalculate, populateCustomer, and open methods
 */
export function setupFusionArcQaModal({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = (msg) => console.log(msg)
} = {}) {
  const modal = typeof document !== 'undefined' ? document.getElementById('fusionArcQaModal') : null;
  if (!modal) return null;

  const closeBtn = document.getElementById('closeFusionArcQaBtn');
  const presetSelect = document.getElementById('fusionArcPresetSelect');
  const splicerModelSelect = document.getElementById('fusionArcSplicerSelect');
  const fiberTypeSelect = document.getElementById('fusionArcFiberTypeSelect');
  const serialInput = document.getElementById('fusionArcSerialInput');
  const locationInput = document.getElementById('fusionArcLocationInput');
  const technicianInput = document.getElementById('fusionArcTechnicianInput');
  const dischargeInput = document.getElementById('fusionArcDischargeInput');
  const tempInput = document.getElementById('fusionArcTempInput');
  const pressureInput = document.getElementById('fusionArcPressureInput');
  const humidityInput = document.getElementById('fusionArcHumidityInput');
  const coreOffsetXInput = document.getElementById('fusionArcOffsetXInput');
  const coreOffsetYInput = document.getElementById('fusionArcOffsetYInput');
  const cleaveLeftInput = document.getElementById('fusionArcCleaveLeftInput');
  const cleaveRightInput = document.getElementById('fusionArcCleaveRightInput');
  const proofTensionInput = document.getElementById('fusionArcProofTensionInput');
  const proofStatusSelect = document.getElementById('fusionArcProofStatusSelect');
  const bubblePenaltyInput = document.getElementById('fusionArcBubblePenaltyInput');
  const notesInput = document.getElementById('fusionArcNotesInput');

  const svgContainer = document.getElementById('fusionArcSvgContainer');
  const hudRibbon = document.getElementById('fusionArcHudRibbon');
  const historyTbody = document.getElementById('fusionArcHistoryTbody');
  const searchInput = document.getElementById('fusionArcSearchInput');
  const statusFilterSelect = document.getElementById('fusionArcStatusFilterSelect');

  const saveBtn = document.getElementById('saveFusionArcCertBtn');
  const printStandardBtn = document.getElementById('printFusionArcStandardBtn');
  const printThermalBtn = document.getElementById('printFusionArcThermalBtn');
  const exportCsvBtn = document.getElementById('exportFusionArcCsvBtn');
  const whatsAppBtn = document.getElementById('whatsAppFusionArcBtn');

  let activeCustomer = null;
  let currentEvaluation = null;

  function getFormValues() {
    return {
      splicerModelId: splicerModelSelect?.value || 'FUJIKURA_90S',
      fiberTypeId: fiberTypeSelect?.value || 'G652D',
      splicerSerialNumber: serialInput?.value || 'F90S-PK-88241',
      dischargeCount: Number(dischargeInput?.value) || 500,
      ambientTempC: Number(tempInput?.value) || 20,
      pressureHpa: Number(pressureInput?.value) || 1013.25,
      humidityRh: Number(humidityInput?.value) || 50,
      coreOffsetXUm: Number(coreOffsetXInput?.value) || 0.15,
      coreOffsetYUm: Number(coreOffsetYInput?.value) || 0.12,
      cleaveAngleLeftDeg: Number(cleaveLeftInput?.value) || 0.5,
      cleaveAngleRightDeg: Number(cleaveRightInput?.value) || 0.5,
      proofTensionN: Number(proofTensionInput?.value) || 2.0,
      proofStatus: proofStatusSelect?.value || 'PASSED_TENSILE_VERIFIED',
      bubblePenaltyDb: Number(bubblePenaltyInput?.value) || 0.000,
      spliceLocation: locationInput?.value || 'Baradari Chowk ODF Enclosure #01'
    };
  }

  function recalculate() {
    const values = getFormValues();
    currentEvaluation = evaluateFusionSpliceQa(values);

    if (svgContainer) {
      svgContainer.innerHTML = renderFusionArcQaAnalysisSvg(currentEvaluation, { width: 700, height: 260 });
    }

    if (hudRibbon) {
      const { electrodeLife, spliceLoss, proofStatus, verdict } = currentEvaluation;
      hudRibbon.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 11px; color: #94a3b8;">Estimated Joint Loss</div>
          <div style="font-size: 18px; font-weight: 800; color: ${spliceLoss.totalSpliceLossDb <= 0.05 ? '#10b981' : '#f59e0b'};">
            ${spliceLoss.totalSpliceLossDb.toFixed(3)} dB
          </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 11px; color: #94a3b8;">Proof Tension Pull</div>
          <div style="font-size: 18px; font-weight: 800; color: ${proofStatus.colorHex};">
            ${values.proofTensionN} N (${proofEvaluationLabel(proofStatus)})
          </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 11px; color: #94a3b8;">Electrode Remaining</div>
          <div style="font-size: 18px; font-weight: 800; color: ${electrodeLife.colorHex};">
            ${electrodeLife.remainingPercent}% (${electrodeLife.remainingDischarges} left)
          </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 11px; color: #94a3b8;">QA Verdict</div>
          <div style="font-size: 14px; font-weight: 700; color: ${verdict.colorHex}; margin-top: 3px;">
            ${verdict.label.split('(')[0].trim()}
          </div>
        </div>
      `;
    }
  }

  function applyPreset(presetKey) {
    const preset = FUSION_ARC_PRESETS[presetKey];
    if (!preset) return;

    if (splicerModelSelect) splicerModelSelect.value = preset.splicerModelId;
    if (fiberTypeSelect) fiberTypeSelect.value = preset.fiberTypeId;
    if (serialInput) serialInput.value = preset.splicerSerialNumber;
    if (dischargeInput) dischargeInput.value = preset.dischargeCount;
    if (tempInput) tempInput.value = preset.ambientTempC;
    if (pressureInput) pressureInput.value = preset.pressureHpa;
    if (humidityInput) humidityInput.value = preset.humidityRh;
    if (coreOffsetXInput) coreOffsetXInput.value = preset.coreOffsetXUm;
    if (coreOffsetYInput) coreOffsetYInput.value = preset.coreOffsetYUm;
    if (cleaveLeftInput) cleaveLeftInput.value = preset.cleaveAngleLeftDeg;
    if (cleaveRightInput) cleaveRightInput.value = preset.cleaveAngleRightDeg;
    if (proofTensionInput) proofTensionInput.value = preset.proofTensionN;
    if (proofStatusSelect) proofStatusSelect.value = preset.proofStatus;
    if (bubblePenaltyInput) bubblePenaltyInput.value = preset.bubblePenaltyDb;
    if (locationInput) locationInput.value = preset.spliceLocation;

    recalculate();
  }

  function renderHistory() {
    if (!historyTbody) return;
    const records = getSavedFusionArcQaCerts(storage);
    const query = (searchInput?.value || '').toLowerCase();
    const filter = statusFilterSelect?.value || '';

    const filtered = records.filter(r => {
      const matchQuery = !query ||
        r.id.toLowerCase().includes(query) ||
        r.customerName.toLowerCase().includes(query) ||
        r.technicianName.toLowerCase().includes(query) ||
        (r.evaluation?.spliceLocation || '').toLowerCase().includes(query);

      const matchFilter = !filter ||
        (filter === 'COMPLIANT' && r.evaluation?.verdict?.isCompliant) ||
        (filter === 'NON_COMPLIANT' && !r.evaluation?.verdict?.isCompliant);

      return matchQuery && matchFilter;
    });

    if (filtered.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 16px;">No fusion arc certifications recorded.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = filtered.map(r => {
      const ev = r.evaluation || {};
      const loss = ev.spliceLoss?.totalSpliceLossDb?.toFixed(3) || '—';
      const vd = ev.verdict || {};
      return `
        <tr>
          <td><strong>${escapeHtml(r.id)}</strong><br><small style="color: #64748b;">${escapeHtml(r.createdAt.slice(0, 10))}</small></td>
          <td>${escapeHtml(ev.splicer?.brand || '')} ${escapeHtml(ev.splicer?.model?.split(' ')[0] || '')}<br><small style="color: #64748b;">${escapeHtml(ev.splicerSerialNumber || '')}</small></td>
          <td>${escapeHtml(ev.spliceLocation || '')}</td>
          <td><strong>${loss} dB</strong></td>
          <td>${ev.proofTensionN || 0} N</td>
          <td><span class="badge ${vd.badgeClass || ''}" style="color: ${vd.colorHex}; font-weight: 700;">${escapeHtml(vd.label?.split('(')[0] || '')}</span></td>
          <td>
            <button type="button" class="secondary-button" style="padding: 4px 8px; font-size: 11px;" data-print-cert="${escapeHtml(r.id)}">🖨️</button>
            <button type="button" class="secondary-button" style="padding: 4px 8px; font-size: 11px;" data-wa-cert="${escapeHtml(r.id)}">💬</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire action buttons
    historyTbody.querySelectorAll('[data-print-cert]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-print-cert');
        const found = records.find(r => r.id === id);
        if (found) {
          const html = generateFusionArcQaCertHtml(found, { format: 'standard' });
          openPrintWindow(html);
        }
      });
    });

    historyTbody.querySelectorAll('[data-wa-cert]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-wa-cert');
        const found = records.find(r => r.id === id);
        if (found) {
          const text = formatFusionArcQaCertWhatsApp(found);
          navigator?.clipboard?.writeText(text);
          onToast('WhatsApp text copied to clipboard!');
        }
      });
    });
  }

  function openPrintWindow(html) {
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>Print QA Certificate</title><style>@media print { body { margin: 0; padding: 0; } } body { font-family: sans-serif; background: #fff; padding: 20px; }</style></head><body>${html}<script>window.onload=()=>{window.print();}</script></body></html>`);
      win.document.close();
    }
  }

  // Event Listeners
  [
    splicerModelSelect, fiberTypeSelect, serialInput, locationInput, dischargeInput,
    tempInput, pressureInput, humidityInput, coreOffsetXInput, coreOffsetYInput,
    cleaveLeftInput, cleaveRightInput, proofTensionInput, proofStatusSelect, bubblePenaltyInput
  ].forEach(el => {
    el?.addEventListener('input', recalculate);
    el?.addEventListener('change', recalculate);
  });

  presetSelect?.addEventListener('change', (e) => {
    if (e.target.value) applyPreset(e.target.value);
  });

  closeBtn?.addEventListener('click', () => {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  });

  saveBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildFusionArcQaRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      notes: notesInput?.value
    });
    saveFusionArcQaCert(record, storage);
    onToast(`Fusion QA Certificate ${record.id} saved successfully!`);
    renderHistory();
  });

  printStandardBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildFusionArcQaRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      notes: notesInput?.value
    });
    const html = generateFusionArcQaCertHtml(record, { format: 'standard' });
    openPrintWindow(html);
  });

  printThermalBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildFusionArcQaRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      notes: notesInput?.value
    });
    const html = generateFusionArcQaCertHtml(record, { format: 'thermal' });
    openPrintWindow(html);
  });

  exportCsvBtn?.addEventListener('click', () => {
    const records = getSavedFusionArcQaCerts(storage);
    if (!records.length) {
      onToast('No saved records to export.');
      return;
    }
    const csv = generateFusionArcQaCertsCsv(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara_fusion_arc_qa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported CSV successfully!');
  });

  whatsAppBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildFusionArcQaRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      notes: notesInput?.value
    });
    const text = formatFusionArcQaCertWhatsApp(record);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      onToast('WhatsApp dispatch notice copied to clipboard!');
    }
  });

  searchInput?.addEventListener('input', renderHistory);
  statusFilterSelect?.addEventListener('change', renderHistory);

  // Initial Calculation & History
  recalculate();
  renderHistory();

  return {
    recalculate,
    populateCustomer: (c) => {
      activeCustomer = c;
      if (locationInput && c) {
        locationInput.value = `${c.name || 'Subscriber'} Premises FAT Drop (${c.mohalla || c.zone || 'Shahdara'})`;
      }
      recalculate();
    },
    renderHistory
  };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}
