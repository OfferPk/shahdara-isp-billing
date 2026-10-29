/**
 * Shahdara ISP Billing & Network Operations - Optical Fiber Fusion Splice Core Alignment,
 * Mode Field Diameter (MFD) Mismatch & Lateral Offset QA Certification Suite
 * Standards: ITU-T G.650.1, ITU-T G.652.D, ITU-T G.657.A1/A2, Telcordia GR-765-CORE, IEC 60793-2-50
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const SPLICE_MFD_OFFSET_STORAGE_KEY = 'shahdara_splice_mfd_offset_certs_v1';

export const FIBER_PROFILES = {
  'ITU_G652D': {
    id: 'ITU_G652D',
    name: 'ITU-T G.652.D (Standard SMF-28)',
    category: 'Standard Single-Mode',
    nominalCoreDiameterUm: 8.2,
    nominalCladdingDiameterUm: 125.0,
    claddingToleranceUm: 0.7,
    nominalMfd1310Um: 9.2,
    nominalMfd1490Um: 9.8,
    nominalMfd1550Um: 10.4,
    nominalMfd1577Um: 10.6,
    maxConcentricityErrorUm: 0.5,
    typicalConcentricityErrorUm: 0.25,
    refractiveIndex1310: 1.4677,
    refractiveIndex1550: 1.4682,
    numericalAperture: 0.14
  },
  'ITU_G657A1': {
    id: 'ITU_G657A1',
    name: 'ITU-T G.657.A1 (Access Bend-Insensitive)',
    category: 'Bend-Insensitive Access',
    nominalCoreDiameterUm: 8.6,
    nominalCladdingDiameterUm: 125.0,
    claddingToleranceUm: 0.7,
    nominalMfd1310Um: 8.9,
    nominalMfd1490Um: 9.4,
    nominalMfd1550Um: 9.8,
    nominalMfd1577Um: 10.0,
    maxConcentricityErrorUm: 0.5,
    typicalConcentricityErrorUm: 0.28,
    refractiveIndex1310: 1.4675,
    refractiveIndex1550: 1.4680,
    numericalAperture: 0.142
  },
  'ITU_G657A2': {
    id: 'ITU_G657A2',
    name: 'ITU-T G.657.A2 (Tight Drop Bend-Insensitive)',
    category: 'Subscriber Premises Drop',
    nominalCoreDiameterUm: 8.2,
    nominalCladdingDiameterUm: 125.0,
    claddingToleranceUm: 0.7,
    nominalMfd1310Um: 8.6,
    nominalMfd1490Um: 9.1,
    nominalMfd1550Um: 9.6,
    nominalMfd1577Um: 9.8,
    maxConcentricityErrorUm: 0.5,
    typicalConcentricityErrorUm: 0.30,
    refractiveIndex1310: 1.4674,
    refractiveIndex1550: 1.4679,
    numericalAperture: 0.145
  },
  'ITU_G655_NZDSF': {
    id: 'ITU_G655_NZDSF',
    name: 'ITU-T G.655 (NZ-DSF Trunk Backbone)',
    category: 'Non-Zero Dispersion Shifted',
    nominalCoreDiameterUm: 6.0,
    nominalCladdingDiameterUm: 125.0,
    claddingToleranceUm: 0.7,
    nominalMfd1310Um: 7.8,
    nominalMfd1490Um: 8.1,
    nominalMfd1550Um: 8.4,
    nominalMfd1577Um: 8.6,
    maxConcentricityErrorUm: 0.5,
    typicalConcentricityErrorUm: 0.22,
    refractiveIndex1310: 1.4685,
    refractiveIndex1550: 1.4690,
    numericalAperture: 0.155
  },
  'LEGACY_AERIAL': {
    id: 'LEGACY_AERIAL',
    name: 'Legacy Aerial Span (Pre-2000 SMF)',
    category: 'Legacy High-Eccentricity Cable',
    nominalCoreDiameterUm: 8.8,
    nominalCladdingDiameterUm: 125.5,
    claddingToleranceUm: 1.5,
    nominalMfd1310Um: 9.5,
    nominalMfd1490Um: 10.2,
    nominalMfd1550Um: 10.8,
    nominalMfd1577Um: 11.0,
    maxConcentricityErrorUm: 1.2,
    typicalConcentricityErrorUm: 0.85,
    refractiveIndex1310: 1.4670,
    refractiveIndex1550: 1.4675,
    numericalAperture: 0.138
  }
};

export const SPLICER_ALIGNMENT_TYPES = {
  'CORE_PAS': {
    id: 'CORE_PAS',
    name: 'Core PAS (Dual-Axis Profile Alignment System)',
    mechanism: 'Direct Core CCD Imaging & Independent Micro-Motors',
    description: 'Directly aligns optical fiber cores. Compensates for core eccentricity and cladding variations.',
    baseOffsetToleranceUm: 0.10,
    eccentricityCompensationFactor: 0.10, // 90% eccentricity canceled by core alignment
    surfaceTensionFactor: 0.85
  },
  'ACTIVE_CLAD': {
    id: 'ACTIVE_CLAD',
    name: 'Active Cladding Alignment (Motorized V-Grooves)',
    mechanism: 'Motorized Cladding X/Y Alignment with Image Processing',
    description: 'Motorized precision cladding centering; cannot compensate for internal core-to-cladding eccentricity.',
    baseOffsetToleranceUm: 0.25,
    eccentricityCompensationFactor: 0.80, // Cladding aligned, core eccentricity largely preserved
    surfaceTensionFactor: 0.80
  },
  'FIXED_VGROOVE': {
    id: 'FIXED_VGROOVE',
    name: 'Fixed V-Groove (Passive Cladding Alignment)',
    mechanism: 'Mechanical Fixed Precision V-Grooves',
    description: 'Passive alignment relying entirely on fiber outer cladding diameter and concentricity. Sensitive to dirt and wear.',
    baseOffsetToleranceUm: 0.55,
    eccentricityCompensationFactor: 1.00, // Full eccentricity converted directly to offset
    surfaceTensionFactor: 0.70
  }
};

export const OPERATING_WAVELENGTHS = {
  '1310': { id: '1310', label: '1310 nm (GPON Upstream)', waveUm: 1.31, mfdKey: 'nominalMfd1310Um', refIndexKey: 'refractiveIndex1310' },
  '1490': { id: '1490', label: '1490 nm (GPON Downstream)', waveUm: 1.49, mfdKey: 'nominalMfd1490Um', refIndexKey: 'refractiveIndex1310' },
  '1550': { id: '1550', label: '1550 nm (Standard Video / DWDM)', waveUm: 1.55, mfdKey: 'nominalMfd1550Um', refIndexKey: 'refractiveIndex1550' },
  '1577': { id: '1577', label: '1577 nm (XGS-PON Downstream)', waveUm: 1.577, mfdKey: 'nominalMfd1577Um', refIndexKey: 'refractiveIndex1550' }
};

export const TELCORDIA_SPLICE_VERDICTS = {
  'GRADE_A_EXCELLENT': {
    id: 'GRADE_A_EXCELLENT',
    code: 'GRADE_A',
    label: 'Grade A - Premium Trunk Splice',
    labelUrdu: 'درجہ اے - بہترین کوالٹی سپلائس',
    maxLossDb: 0.03,
    badgeClass: 'badge-certified',
    colorHex: '#10b981',
    description: 'Excellent ultra-low loss splice. Complies with Telcordia GR-765-CORE Core Backbone standards.'
  },
  'GRADE_B_PASS': {
    id: 'GRADE_B_PASS',
    code: 'GRADE_B',
    label: 'Grade B - Standard Access Splice',
    labelUrdu: 'درجہ بی - معیاری منظور شدہ سپلائس',
    maxLossDb: 0.08,
    badgeClass: 'badge-pass',
    colorHex: '#3b82f6',
    description: 'Standard compliant fusion splice suitable for GPON distribution and feeder joint closures.'
  },
  'GRADE_C_CONDITIONAL': {
    id: 'GRADE_C_CONDITIONAL',
    code: 'GRADE_C',
    label: 'Grade C - Conditional Premises Pass',
    labelUrdu: 'درجہ سی - مشروط منظور (صارف اینڈ)',
    maxLossDb: 0.15,
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    description: 'Higher than typical loss. Tolerable on short subscriber drop spans; monitor power budget.'
  },
  'REJECT_RESPLICE_MANDATED': {
    id: 'REJECT_RESPLICE_MANDATED',
    code: 'REJECT',
    label: 'Rejected - Re-splice Mandated',
    labelUrdu: 'مسترد - دوبارہ سپلائس لازمی',
    maxLossDb: Infinity,
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    description: 'Excessive insertion loss exceeding 0.15 dB. Arc joint must be broken, re-cleaved and re-spliced.'
  }
};

/**
 * Calculates Gaussian Mode Field Diameter (MFD) mismatch splice loss (Marcuse Equation).
 * α_MFD = -10 * log10( 4 / ( (w1/w2 + w2/w1)^2 ) )
 * where w1 = MFD1 / 2, w2 = MFD2 / 2
 * @param {number} mfd1Um
 * @param {number} mfd2Um
 * @returns {number} Loss in dB (>= 0)
 */
export function calculateMfdMismatchLoss(mfd1Um, mfd2Um) {
  const m1 = Number(mfd1Um) || 9.2;
  const m2 = Number(mfd2Um) || 9.2;
  if (m1 <= 0 || m2 <= 0) return 0;
  if (Math.abs(m1 - m2) < 0.0001) return 0;

  const w1 = m1 / 2;
  const w2 = m2 / 2;
  const ratio = (w1 / w2) + (w2 / w1);
  const transmissionFactor = 4 / (ratio * ratio);
  if (transmissionFactor <= 0 || transmissionFactor >= 1) return 0;

  const lossDb = -10 * Math.log10(transmissionFactor);
  return Math.max(0, Number(lossDb.toFixed(4)));
}

/**
 * Calculates Gaussian Lateral Core Offset splice loss.
 * α_offset = 4.343 * (d / w0)^2
 * where d is lateral core offset in µm, w0 = sqrt( (w1^2 + w2^2) / 2 )
 * @param {number} radialOffsetUm
 * @param {number} mfd1Um
 * @param {number} mfd2Um
 * @returns {number} Loss in dB (>= 0)
 */
export function calculateLateralOffsetLoss(radialOffsetUm, mfd1Um, mfd2Um) {
  const d = Math.max(0, Number(radialOffsetUm) || 0);
  if (d === 0) return 0;

  const m1 = Number(mfd1Um) || 9.2;
  const m2 = Number(mfd2Um) || 9.2;
  const w1 = m1 / 2;
  const w2 = m2 / 2;
  const w0 = Math.sqrt((w1 * w1 + w2 * w2) / 2);
  if (w0 <= 0) return 0;

  const lossDb = 4.3429448 * Math.pow(d / w0, 2);
  return Math.max(0, Number(lossDb.toFixed(4)));
}

/**
 * Calculates Angular Tilt / Cleave Misalignment splice loss.
 * α_tilt = 4.343 * ( (pi * n2 * w0 * θ_rad) / λ_µm )^2
 * @param {number} tiltDeg
 * @param {number} mfd1Um
 * @param {number} mfd2Um
 * @param {number} wavelengthNm
 * @param {number} [refractiveIndex]
 * @returns {number} Loss in dB (>= 0)
 */
export function calculateAngularTiltLoss(tiltDeg, mfd1Um, mfd2Um, wavelengthNm, refractiveIndex = 1.468) {
  const thetaDeg = Math.max(0, Number(tiltDeg) || 0);
  if (thetaDeg === 0) return 0;

  const thetaRad = (thetaDeg * Math.PI) / 180;
  const m1 = Number(mfd1Um) || 9.2;
  const m2 = Number(mfd2Um) || 9.2;
  const w1 = m1 / 2;
  const w2 = m2 / 2;
  const w0 = Math.sqrt((w1 * w1 + w2 * w2) / 2);

  const lambdaUm = (Number(wavelengthNm) || 1310) / 1000;
  const n2 = Number(refractiveIndex) || 1.468;

  const factor = (Math.PI * n2 * w0 * thetaRad) / lambdaUm;
  const lossDb = 4.3429448 * (factor * factor);
  return Math.max(0, Number(lossDb.toFixed(4)));
}

/**
 * Calculates net radial lateral core offset based on splicer type, fiber eccentricities, and angle orientation.
 * @param {object} params
 * @returns {number} Net radial offset d in µm
 */
export function calculateNetCoreOffset({
  leftEccentricityUm = 0.25,
  rightEccentricityUm = 0.25,
  splicerType = 'CORE_PAS',
  residualOffsetUm = 0.10,
  alignmentAngleDeg = 45
}) {
  const splicer = SPLICER_ALIGNMENT_TYPES[splicerType] || SPLICER_ALIGNMENT_TYPES.CORE_PAS;
  const e1 = Math.max(0, Number(leftEccentricityUm) || 0);
  const e2 = Math.max(0, Number(rightEccentricityUm) || 0);
  const angleRad = ((Number(alignmentAngleDeg) || 45) * Math.PI) / 180;

  // Cladding eccentricity geometric resultant vector difference
  const geometricEccentricityOffset = Math.sqrt(
    Math.max(0, (e1 * e1) + (e2 * e2) - (2 * e1 * e2 * Math.cos(angleRad)))
  );

  // Apply splicer compensation factor
  const uncompensatedEccentricity = geometricEccentricityOffset * splicer.eccentricityCompensationFactor;

  // Combine with residual mechanical motor positioning offset
  const baseOffset = Math.max(0, Number(residualOffsetUm) || splicer.baseOffsetToleranceUm);
  const netOffset = Math.sqrt((baseOffset * baseOffset) + (uncompensatedEccentricity * uncompensatedEccentricity));

  return Number(netOffset.toFixed(3));
}

/**
 * Determines the Telcordia GR-765-CORE quality verdict based on insertion loss.
 * @param {number} totalLossDb
 * @returns {object} Verdict configuration object
 */
export function determineSpliceQualityVerdict(totalLossDb) {
  const loss = Number(totalLossDb) || 0;
  if (loss <= TELCORDIA_SPLICE_VERDICTS.GRADE_A_EXCELLENT.maxLossDb) {
    return TELCORDIA_SPLICE_VERDICTS.GRADE_A_EXCELLENT;
  }
  if (loss <= TELCORDIA_SPLICE_VERDICTS.GRADE_B_PASS.maxLossDb) {
    return TELCORDIA_SPLICE_VERDICTS.GRADE_B_PASS;
  }
  if (loss <= TELCORDIA_SPLICE_VERDICTS.GRADE_C_CONDITIONAL.maxLossDb) {
    return TELCORDIA_SPLICE_VERDICTS.GRADE_C_CONDITIONAL;
  }
  return TELCORDIA_SPLICE_VERDICTS.REJECT_RESPLICE_MANDATED;
}

/**
 * Evaluates comprehensive fusion splice loss parameters, MFD mismatch, lateral offset, and angular tilt.
 * @param {object} params
 * @returns {object} Comprehensive analysis result object
 */
export function evaluateSpliceLoss({
  leftFiberType = 'ITU_G652D',
  rightFiberType = 'ITU_G652D',
  splicerType = 'CORE_PAS',
  wavelength = '1310',
  leftEccentricityUm = null,
  rightEccentricityUm = null,
  tiltAngleDeg = 0.25,
  alignmentAngleDeg = 45,
  residualOffsetUm = null,
  customMfdLeftUm = null,
  customMfdRightUm = null
} = {}) {
  const leftProfile = FIBER_PROFILES[leftFiberType] || FIBER_PROFILES.ITU_G652D;
  const rightProfile = FIBER_PROFILES[rightFiberType] || FIBER_PROFILES.ITU_G652D;
  const splicer = SPLICER_ALIGNMENT_TYPES[splicerType] || SPLICER_ALIGNMENT_TYPES.CORE_PAS;
  const wlConfig = OPERATING_WAVELENGTHS[String(wavelength)] || OPERATING_WAVELENGTHS['1310'];

  // Resolve MFD values for the given wavelength
  const mfd1 = Number(customMfdLeftUm) || leftProfile[wlConfig.mfdKey] || leftProfile.nominalMfd1310Um;
  const mfd2 = Number(customMfdRightUm) || rightProfile[wlConfig.mfdKey] || rightProfile.nominalMfd1310Um;

  // Resolve eccentricities
  const e1 = leftEccentricityUm !== null && !isNaN(leftEccentricityUm)
    ? Number(leftEccentricityUm)
    : leftProfile.typicalConcentricityErrorUm;
  const e2 = rightEccentricityUm !== null && !isNaN(rightEccentricityUm)
    ? Number(rightEccentricityUm)
    : rightProfile.typicalConcentricityErrorUm;

  const baseOffset = residualOffsetUm !== null && !isNaN(residualOffsetUm)
    ? Number(residualOffsetUm)
    : splicer.baseOffsetToleranceUm;

  // Net lateral core offset
  const netOffsetUm = calculateNetCoreOffset({
    leftEccentricityUm: e1,
    rightEccentricityUm: e2,
    splicerType,
    residualOffsetUm: baseOffset,
    alignmentAngleDeg
  });

  const tilt = Math.max(0, Number(tiltAngleDeg) || 0);
  const refIndex = (leftProfile[wlConfig.refIndexKey] + rightProfile[wlConfig.refIndexKey]) / 2;

  // Losses
  const lossMfd = calculateMfdMismatchLoss(mfd1, mfd2);
  const lossOffset = calculateLateralOffsetLoss(netOffsetUm, mfd1, mfd2);
  const lossTilt = calculateAngularTiltLoss(tilt, mfd1, mfd2, wlConfig.id, refIndex);

  // Surface tension molten silica relaxation factor
  const effectiveOffsetLoss = lossOffset * splicer.surfaceTensionFactor;
  const totalLossDb = Number((lossMfd + effectiveOffsetLoss + lossTilt).toFixed(3));

  // Multi-wavelength comparison (1310nm vs 1550nm)
  const mfd1_1550 = leftProfile.nominalMfd1550Um;
  const mfd2_1550 = rightProfile.nominalMfd1550Um;
  const lossMfd1550 = calculateMfdMismatchLoss(mfd1_1550, mfd2_1550);
  const lossOffset1550 = calculateLateralOffsetLoss(netOffsetUm, mfd1_1550, mfd2_1550) * splicer.surfaceTensionFactor;
  const lossTilt1550 = calculateAngularTiltLoss(tilt, mfd1_1550, mfd2_1550, 1550, leftProfile.refractiveIndex1550);
  const totalLoss1550Db = Number((lossMfd1550 + lossOffset1550 + lossTilt1550).toFixed(3));

  const verdict = determineSpliceQualityVerdict(totalLossDb);

  // Dominant loss contributor
  let dominantFactor = 'BALANCED';
  const maxLossComponent = Math.max(lossMfd, effectiveOffsetLoss, lossTilt);
  if (maxLossComponent === lossMfd && lossMfd > 0.01) {
    dominantFactor = 'MFD_MISMATCH';
  } else if (maxLossComponent === effectiveOffsetLoss && effectiveOffsetLoss > 0.01) {
    dominantFactor = 'CORE_OFFSET';
  } else if (maxLossComponent === lossTilt && lossTilt > 0.01) {
    dominantFactor = 'ANGULAR_TILT';
  }

  return {
    leftProfile,
    rightProfile,
    splicer,
    wavelength: wlConfig,
    mfdLeftUm: mfd1,
    mfdRightUm: mfd2,
    mfdDeltaUm: Number(Math.abs(m1Delta(mfd1, mfd2)).toFixed(2)),
    leftEccentricityUm: e1,
    rightEccentricityUm: e2,
    tiltAngleDeg: tilt,
    alignmentAngleDeg,
    netOffsetUm,
    lossMfdDb: lossMfd,
    lossOffsetDb: Number(effectiveOffsetLoss.toFixed(4)),
    lossTiltDb: lossTilt,
    totalLossDb,
    totalLoss1550Db,
    verdict,
    dominantFactor,
    isIdenticalFibers: leftProfile.id === rightProfile.id,
    isTelcordiaCompliant: totalLossDb <= TELCORDIA_SPLICE_VERDICTS.GRADE_B_PASS.maxLossDb
  };
}

function m1Delta(a, b) {
  return a - b;
}

/**
 * 5 Standard Shahdara ISP Outside Plant Fiber Joint Presets.
 */
export const SHAH_SPLICE_PRESETS = {
  'BARADARI_NOC_TRUNK': {
    id: 'BARADARI_NOC_TRUNK',
    name: 'Baradari Central OLT Trunk Backbone',
    location: 'Baradari NOC to Shahdara Main Exchange ODF Tray 04',
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G652D',
    splicerType: 'CORE_PAS',
    wavelength: '1310',
    leftEccentricityUm: 0.20,
    rightEccentricityUm: 0.20,
    tiltAngleDeg: 0.25,
    alignmentAngleDeg: 30,
    residualOffsetUm: 0.08,
    technicianName: 'Sample Technician (Senior Fiber Splicing Specialist)'
  },
  'VANDALA_DROP_TRANSITION': {
    id: 'VANDALA_DROP_TRANSITION',
    name: 'Vandala Road Feeder to G.657.A2 Drop Transition',
    location: 'Vandala Road Pole FAT-12 to Residential Demarcation',
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G657A2',
    splicerType: 'ACTIVE_CLAD',
    wavelength: '1490',
    leftEccentricityUm: 0.35,
    rightEccentricityUm: 0.30,
    tiltAngleDeg: 0.55,
    alignmentAngleDeg: 60,
    residualOffsetUm: 0.22,
    technicianName: 'Tariq Mehmood (Lineman Lead)'
  },
  'JIA_MUSA_FIXED_VGROOVE_ECCENTRIC': {
    id: 'JIA_MUSA_FIXED_VGROOVE_ECCENTRIC',
    name: 'Jia Musa Legacy Aerial to Drop Transition',
    location: 'Jia Musa Main Bazar Overhead Joint Closure #08',
    leftFiberType: 'LEGACY_AERIAL',
    rightFiberType: 'ITU_G657A1',
    splicerType: 'FIXED_VGROOVE',
    wavelength: '1310',
    leftEccentricityUm: 0.95,
    rightEccentricityUm: 0.35,
    tiltAngleDeg: 0.85,
    alignmentAngleDeg: 120,
    residualOffsetUm: 0.55,
    technicianName: 'Sajjad Ali (Field Technician)'
  },
  'BEGUM_KOT_HIGH_TILT_FAIL': {
    id: 'BEGUM_KOT_HIGH_TILT_FAIL',
    name: 'Begum Kot Hasty Aerial Cleave (Blunt Blade Defect)',
    location: 'Begum Kot High-Tension Aerial Crossing Sub-Closure',
    leftFiberType: 'ITU_G652D',
    rightFiberType: 'ITU_G652D',
    splicerType: 'ACTIVE_CLAD',
    wavelength: '1310',
    leftEccentricityUm: 0.30,
    rightEccentricityUm: 0.30,
    tiltAngleDeg: 1.85,
    alignmentAngleDeg: 45,
    residualOffsetUm: 0.35,
    technicianName: 'Hamza Farooq (Assistant Lineman)'
  },
  'RAVI_SIPHON_NZDSF_DISSIMILAR': {
    id: 'RAVI_SIPHON_NZDSF_DISSIMILAR',
    name: 'Ravi Siphon River Crossing NZ-DSF Backbone Interconnect',
    location: 'Ravi Siphon High-Span River Enclosure Manhole Joint',
    leftFiberType: 'ITU_G655_NZDSF',
    rightFiberType: 'ITU_G652D',
    splicerType: 'CORE_PAS',
    wavelength: '1550',
    leftEccentricityUm: 0.22,
    rightEccentricityUm: 0.25,
    tiltAngleDeg: 0.30,
    alignmentAngleDeg: 15,
    residualOffsetUm: 0.12,
    technicianName: 'Engr. Imran Malik (NOC Metrology Engineer)'
  }
};

/**
 * Pure-vector high-contrast SVG diagram of optical fiber fusion splice core alignment,
 * lateral offset, angular tilt, and Gaussian beam transmission profile.
 * @param {object} analysis
 * @returns {string} SVG HTML markup
 */
export function renderSpliceMfdOffsetSvg(analysis) {
  if (!analysis) return '';

  const {
    leftProfile,
    rightProfile,
    splicer,
    wavelength,
    mfdLeftUm,
    mfdRightUm,
    netOffsetUm,
    tiltAngleDeg,
    lossMfdDb,
    lossOffsetDb,
    lossTiltDb,
    totalLossDb,
    verdict,
    dominantFactor
  } = analysis;

  const width = 760;
  const height = 340;
  const midX = width / 2;
  const midY = 170;

  // Scale: 1 µm = 8 px vertically
  const scale = 7.5;
  const core1HalfHeight = (mfdLeftUm / 2) * scale;
  const core2HalfHeight = (mfdRightUm / 2) * scale;
  const cladHalfHeight = 110;

  // Visual vertical offset of right fiber
  const visualOffsetPx = Math.min(40, netOffsetUm * scale * 2.5); // amplified for clear visibility
  const visualTiltDeg = Math.min(15, tiltAngleDeg * 4); // amplified for visual distinction

  // Colors
  const leftCladColor = 'rgba(30, 58, 138, 0.45)';
  const rightCladColor = 'rgba(15, 118, 110, 0.45)';
  const leftCoreColor = '#38bdf8';
  const rightCoreColor = '#34d399';
  const beamColor = 'rgba(253, 224, 71, 0.35)';

  return `
<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Fiber Fusion Splice Core Alignment Diagram" style="width: 100%; height: auto; display: block; border-radius: 8px; background: #090d16;">
  <defs>
    <!-- Background Grid -->
    <pattern id="spliceGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    </pattern>
    <!-- Core Gaussian Glow -->
    <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.8"/>
      <stop offset="50%" stop-color="#fef08a" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#34d399" stop-opacity="0.75"/>
    </linearGradient>
    <linearGradient id="leftCoreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.2"/>
      <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.2"/>
    </linearGradient>
    <linearGradient id="rightCoreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.2"/>
      <stop offset="50%" stop-color="#34d399" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#34d399" stop-opacity="0.2"/>
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#facc15" />
    </marker>
    <marker id="arrowRed" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
    </marker>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#090d16" />
  <rect width="${width}" height="${height}" fill="url(#spliceGrid)" />

  <!-- Top Title & Telemetry Ribbon -->
  <g transform="translate(16, 20)">
    <rect width="${width - 32}" height="38" rx="6" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.1)" />
    <text x="14" y="24" fill="#f8fafc" font-size="12" font-weight="700" font-family="system-ui, sans-serif">
      ${escapeHtml(leftProfile.id)} → ${escapeHtml(rightProfile.id)} (${escapeHtml(splicer.name)})
    </text>
    <text x="${width - 48}" y="24" text-anchor="end" fill="${verdict.colorHex}" font-size="12" font-weight="800" font-family="system-ui, sans-serif">
      Total Joint Loss: ${totalLossDb.toFixed(3)} dB [${escapeHtml(verdict.code)}]
    </text>
  </g>

  <!-- Optical Fiber Splice Stage Area -->
  <g id="spliceStage">
    <!-- Center Splice Joint Line -->
    <line x1="${midX}" y1="65" x2="${midX}" y2="285" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.6"/>
    <text x="${midX}" y="298" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="system-ui, sans-serif">Joint Interface</text>

    <!-- LEFT FIBER (Static Reference) -->
    <g id="leftFiber">
      <!-- Cladding (125µm) -->
      <rect x="50" y="${midY - cladHalfHeight}" width="${midX - 50}" height="${cladHalfHeight * 2}" rx="4" fill="${leftCladColor}" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="70" y="${midY - cladHalfHeight + 18}" fill="#93c5fd" font-size="10" font-family="monospace">Cladding: 125.0 µm</text>

      <!-- Core / MFD -->
      <rect x="50" y="${midY - core1HalfHeight}" width="${midX - 50}" height="${core1HalfHeight * 2}" fill="url(#leftCoreGrad)" stroke="#38bdf8" stroke-width="1.5"/>
      <!-- Core Centerline -->
      <line x1="50" y1="${midY}" x2="${midX}" y2="${midY}" stroke="#38bdf8" stroke-dasharray="2,2" stroke-width="1"/>

      <!-- MFD Dimension Bracket -->
      <line x1="120" y1="${midY - core1HalfHeight}" x2="120" y2="${midY + core1HalfHeight}" stroke="#facc15" stroke-width="1.2" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
      <rect x="65" y="${midY - 10}" width="50" height="20" rx="3" fill="rgba(15,23,42,0.9)" />
      <text x="90" y="${midY + 4}" text-anchor="middle" fill="#facc15" font-size="9.5" font-weight="700" font-family="monospace">MFD ${mfdLeftUm.toFixed(1)}µm</text>
    </g>

    <!-- RIGHT FIBER (With Lateral Offset & Angular Tilt) -->
    <g id="rightFiber" transform="translate(${midX}, ${midY + visualOffsetPx}) rotate(${visualTiltDeg}) translate(${-midX}, ${-midY})">
      <!-- Cladding (125µm) -->
      <rect x="${midX}" y="${midY - cladHalfHeight}" width="${width - 50 - midX}" height="${cladHalfHeight * 2}" rx="4" fill="${rightCladColor}" stroke="#14b8a6" stroke-width="1.5"/>
      <text x="${width - 70}" y="${midY - cladHalfHeight + 18}" text-anchor="end" fill="#5eead4" font-size="10" font-family="monospace">Cladding: 125.0 µm</text>

      <!-- Core / MFD -->
      <rect x="${midX}" y="${midY - core2HalfHeight}" width="${width - 50 - midX}" height="${core2HalfHeight * 2}" fill="url(#rightCoreGrad)" stroke="#34d399" stroke-width="1.5"/>
      <!-- Core Centerline -->
      <line x1="${midX}" y1="${midY}" x2="${width - 50}" y2="${midY}" stroke="#34d399" stroke-dasharray="2,2" stroke-width="1"/>

      <!-- MFD Dimension Bracket -->
      <line x1="${midX + 90}" y1="${midY - core2HalfHeight}" x2="${midX + 90}" y2="${midY + core2HalfHeight}" stroke="#facc15" stroke-width="1.2" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
      <rect x="${midX + 95}" y="${midY - 10}" width="50" height="20" rx="3" fill="rgba(15,23,42,0.9)" />
      <text x="${midX + 120}" y="${midY + 4}" text-anchor="middle" fill="#facc15" font-size="9.5" font-weight="700" font-family="monospace">MFD ${mfdRightUm.toFixed(1)}µm</text>
    </g>

    <!-- Radiation Leakage & Offset Callout -->
    ${netOffsetUm > 0.05 ? `
      <!-- Offset Indicator Arrow -->
      <line x1="${midX + 15}" y1="${midY}" x2="${midX + 15}" y2="${midY + visualOffsetPx}" stroke="#ef4444" stroke-width="1.5" marker-start="url(#arrowRed)" marker-end="url(#arrowRed)"/>
      <rect x="${midX + 22}" y="${midY + (visualOffsetPx / 2) - 9}" width="68" height="18" rx="3" fill="#1e1b4b" stroke="#ef4444" stroke-width="1"/>
      <text x="${midX + 56}" y="${midY + (visualOffsetPx / 2) + 3}" text-anchor="middle" fill="#fca5a5" font-size="9" font-weight="700" font-family="monospace">Δd ${netOffsetUm.toFixed(2)}µm</text>
    ` : ''}

    ${tiltAngleDeg > 0.1 ? `
      <!-- Tilt Arc Callout -->
      <path d="M ${midX + 40} ${midY + visualOffsetPx - 15} A 30 30 0 0 1 ${midX + 45} ${midY + visualOffsetPx + 15}" fill="none" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="${midX + 50}" y="${midY + visualOffsetPx + 28}" fill="#fbbf24" font-size="9.5" font-weight="700" font-family="monospace">θ ${tiltAngleDeg.toFixed(2)}°</text>
    ` : ''}
  </g>

  <!-- Bottom Telemetry HUD Ribbon -->
  <g transform="translate(16, 290)">
    <rect width="${width - 32}" height="38" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(255,255,255,0.08)" />

    <text x="20" y="24" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#38bdf8">α_MFD:</tspan> <tspan font-weight="700" fill="#f8fafc">${lossMfdDb.toFixed(3)} dB</tspan>
    </text>

    <text x="170" y="24" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#ef4444">α_Offset:</tspan> <tspan font-weight="700" fill="#f8fafc">${lossOffsetDb.toFixed(3)} dB</tspan>
    </text>

    <text x="320" y="24" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#f59e0b">α_Tilt:</tspan> <tspan font-weight="700" fill="#f8fafc">${lossTiltDb.toFixed(3)} dB</tspan>
    </text>

    <text x="470" y="24" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#cbd5e1">Dominant:</tspan> <tspan font-weight="700" fill="#f8fafc">${dominantFactor}</tspan>
    </text>

    <text x="${width - 48}" y="24" text-anchor="end" fill="#cbd5e1" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#94a3b8">@ 1550nm:</tspan> <tspan font-weight="700" fill="#38bdf8">${analysis.totalLoss1550Db.toFixed(3)} dB</tspan>
    </text>
  </g>
</svg>
`;
}

/**
 * Validates fusion splice input parameters.
 * @param {object} formData
 * @returns {object} { isValid, errors }
 */
export function validateSpliceMfdOffset(formData = {}) {
  const errors = {};

  if (!formData.leftFiberType || !FIBER_PROFILES[formData.leftFiberType]) {
    errors.leftFiberType = 'Valid left optical fiber standard profile is required.';
  }
  if (!formData.rightFiberType || !FIBER_PROFILES[formData.rightFiberType]) {
    errors.rightFiberType = 'Valid right optical fiber standard profile is required.';
  }
  if (!formData.splicerType || !SPLICER_ALIGNMENT_TYPES[formData.splicerType]) {
    errors.splicerType = 'Valid fusion splicer alignment technology is required.';
  }

  const tilt = Number(formData.tiltAngleDeg);
  if (isNaN(tilt) || tilt < 0 || tilt > 10) {
    errors.tiltAngleDeg = 'Cleave tilt angle must be between 0.0° and 10.0°.';
  }

  const leftEcc = Number(formData.leftEccentricityUm);
  if (formData.leftEccentricityUm !== undefined && formData.leftEccentricityUm !== null && (isNaN(leftEcc) || leftEcc < 0 || leftEcc > 5)) {
    errors.leftEccentricityUm = 'Core-cladding eccentricity must be between 0.0 and 5.0 µm.';
  }

  const rightEcc = Number(formData.rightEccentricityUm);
  if (formData.rightEccentricityUm !== undefined && formData.rightEccentricityUm !== null && (isNaN(rightEcc) || rightEcc < 0 || rightEcc > 5)) {
    errors.rightEccentricityUm = 'Core-cladding eccentricity must be between 0.0 and 5.0 µm.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Generates an immutable, sequential certificate record for fusion splice QA metrology.
 * @param {object} params
 * @returns {object} Certificate record object
 */
export function buildSpliceMfdOffsetRecord({
  customer = null,
  leftFiberType = 'ITU_G652D',
  rightFiberType = 'ITU_G652D',
  splicerType = 'CORE_PAS',
  wavelength = '1310',
  leftEccentricityUm = null,
  rightEccentricityUm = null,
  tiltAngleDeg = 0.25,
  alignmentAngleDeg = 45,
  residualOffsetUm = null,
  technicianName = 'Engr. Shahdara Field Tech',
  location = 'Outside Plant Joint Closure',
  notes = '',
  status = 'CERTIFIED_PASS'
} = {}) {
  const analysis = evaluateSpliceLoss({
    leftFiberType,
    rightFiberType,
    splicerType,
    wavelength,
    leftEccentricityUm,
    rightEccentricityUm,
    tiltAngleDeg,
    alignmentAngleDeg,
    residualOffsetUm
  });

  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = `SMFD-${yearMonth}-${randomSuffix}`;

  return {
    id: certId,
    createdAt: now.toISOString(),
    customer: customer ? {
      id: customer.id,
      name: customer.name || 'Walk-in Subscriber',
      phone: customer.phone || '0300-0000000',
      address: customer.address || 'Shahdara Town',
      zone: customer.zone || customer.mohalla || 'General Zone'
    } : null,
    location,
    technicianName,
    notes,
    status: status || (analysis.verdict.id === 'REJECT_RESPLICE_MANDATED' ? 'REJECTED' : 'CERTIFIED_PASS'),
    leftFiberType,
    rightFiberType,
    splicerType,
    wavelength: String(wavelength),
    tiltAngleDeg: Number(tiltAngleDeg) || 0,
    leftEccentricityUm: analysis.leftEccentricityUm,
    rightEccentricityUm: analysis.rightEccentricityUm,
    netOffsetUm: analysis.netOffsetUm,
    lossMfdDb: analysis.lossMfdDb,
    lossOffsetDb: analysis.lossOffsetDb,
    lossTiltDb: analysis.lossTiltDb,
    totalLossDb: analysis.totalLossDb,
    totalLoss1550Db: analysis.totalLoss1550Db,
    verdict: analysis.verdict,
    dominantFactor: analysis.dominantFactor
  };
}

/**
 * LocalStorage Persistence Methods
 */
export function getSavedSpliceMfdOffsetCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SPLICE_MFD_OFFSET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read splice MFD certs:', e);
    return [];
  }
}

export function saveSpliceMfdOffsetCert(record, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !record) return false;
  try {
    const records = getSavedSpliceMfdOffsetCerts(storage);
    records.unshift(record);
    storage.setItem(SPLICE_MFD_OFFSET_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (e) {
    console.error('Failed to save splice MFD cert:', e);
    return false;
  }
}

export function updateSpliceMfdOffsetCertStatus(id, newStatus, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !id) return false;
  try {
    const records = getSavedSpliceMfdOffsetCerts(storage);
    const item = records.find(r => r.id === id);
    if (!item) return false;
    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
    storage.setItem(SPLICE_MFD_OFFSET_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (e) {
    console.error('Failed to update splice MFD cert status:', e);
    return false;
  }
}

export function clearSpliceMfdOffsetCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.removeItem(SPLICE_MFD_OFFSET_STORAGE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Aggregates KPI summary metrics from saved certs.
 * @param {Array} records
 * @returns {object} Summary KPI object
 */
export function calculateSpliceMfdOffsetMetrics(records = []) {
  const total = records.length;
  if (!total) {
    return {
      total: 0,
      gradeACount: 0,
      gradeBCount: 0,
      gradeCCount: 0,
      rejectCount: 0,
      passRatePercent: 0,
      avgLossDb: 0,
      dominantMfdCount: 0,
      dominantOffsetCount: 0,
      dominantTiltCount: 0
    };
  }

  let gradeA = 0;
  let gradeB = 0;
  let gradeC = 0;
  let reject = 0;
  let sumLoss = 0;
  let domMfd = 0;
  let domOffset = 0;
  let domTilt = 0;

  for (const r of records) {
    sumLoss += Number(r.totalLossDb) || 0;
    const v = r.verdict?.code || '';
    if (v === 'GRADE_A') gradeA++;
    else if (v === 'GRADE_B') gradeB++;
    else if (v === 'GRADE_C') gradeC++;
    else reject++;

    if (r.dominantFactor === 'MFD_MISMATCH') domMfd++;
    else if (r.dominantFactor === 'CORE_OFFSET') domOffset++;
    else if (r.dominantFactor === 'ANGULAR_TILT') domTilt++;
  }

  const passCount = gradeA + gradeB + gradeC;
  const passRate = total > 0 ? (passCount / total) * 100 : 0;
  const avgLoss = total > 0 ? sumLoss / total : 0;

  return {
    total,
    gradeACount: gradeA,
    gradeBCount: gradeB,
    gradeCCount: gradeC,
    rejectCount: reject,
    passRatePercent: Number(passRate.toFixed(1)),
    avgLossDb: Number(avgLoss.toFixed(3)),
    dominantMfdCount: domMfd,
    dominantOffsetCount: domOffset,
    dominantTiltCount: domTilt
  };
}

/**
 * Dual Printable Documents Generator:
 * Formats: 'A4' (Formal Outside Plant Engineering Accreditation Certificate)
 *          'POS' (80mm Field Technician Thermal Slip)
 * @param {object} record
 * @param {object} options
 * @returns {string} Printable HTML markup
 */
export function generateSpliceMfdOffsetCertHtml(record, { format = 'A4' } = {}) {
  if (!record) return '';

  const isPos = format.toUpperCase() === 'POS';
  const leftProf = FIBER_PROFILES[record.leftFiberType] || FIBER_PROFILES.ITU_G652D;
  const rightProf = FIBER_PROFILES[record.rightFiberType] || FIBER_PROFILES.ITU_G652D;
  const splicer = SPLICER_ALIGNMENT_TYPES[record.splicerType] || SPLICER_ALIGNMENT_TYPES.CORE_PAS;
  const dateStr = record.createdAt ? new Date(record.createdAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : 'N/A';

  if (isPos) {
    // 80mm POS Thermal Slip
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>POS Slip - ${escapeHtml(record.id)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; background: #fff; margin: 0; padding: 2mm; width: 72mm; }
    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 6px; }
    .header h2 { margin: 2px 0; font-size: 13px; text-transform: uppercase; }
    .header p { margin: 1px 0; font-size: 9.5px; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 5px 0; }
    .verdict-box { text-align: center; border: 1px solid #000; padding: 4px; margin: 6px 0; font-weight: bold; }
    .footer { text-align: center; font-size: 8.5px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>SHAHDARA FIBER NET</h2>
    <p>Outside Plant & Joint Metrology</p>
    <p>FUSION SPLICE QA SLIP</p>
  </div>
  <div class="row"><span class="bold">Cert ID:</span><span>${escapeHtml(record.id)}</span></div>
  <div class="row"><span>Date:</span><span>${dateStr}</span></div>
  <div class="row"><span>Tech:</span><span>${escapeHtml(record.technicianName)}</span></div>
  <div class="row"><span>Location:</span><span>${escapeHtml(record.location)}</span></div>
  ${record.customer ? `<div class="row"><span>Customer:</span><span>${escapeHtml(record.customer.name)}</span></div>` : ''}

  <div class="divider"></div>
  <div class="row"><span class="bold">Fiber Left:</span><span>${escapeHtml(leftProf.category)}</span></div>
  <div class="row"><span class="bold">Fiber Right:</span><span>${escapeHtml(rightProf.category)}</span></div>
  <div class="row"><span>Splicer:</span><span>${escapeHtml(splicer.name.split(' ')[0])}</span></div>
  <div class="row"><span>Wavelength:</span><span>${escapeHtml(record.wavelength)} nm</span></div>

  <div class="divider"></div>
  <div class="row"><span>Cleave Tilt:</span><span>${record.tiltAngleDeg.toFixed(2)}°</span></div>
  <div class="row"><span>Net Offset:</span><span>${record.netOffsetUm.toFixed(2)} µm</span></div>
  <div class="row"><span>α_MFD:</span><span>${record.lossMfdDb.toFixed(3)} dB</span></div>
  <div class="row"><span>α_Offset:</span><span>${record.lossOffsetDb.toFixed(3)} dB</span></div>
  <div class="row"><span>α_Tilt:</span><span>${record.lossTiltDb.toFixed(3)} dB</span></div>
  <div class="row"><span class="bold">Total Loss:</span><span class="bold">${record.totalLossDb.toFixed(3)} dB</span></div>
  <div class="row"><span>@ 1550nm:</span><span>${record.totalLoss1550Db.toFixed(3)} dB</span></div>

  <div class="verdict-box">
    ${escapeHtml(record.verdict?.code || 'UNKNOWN')}: ${record.totalLossDb <= 0.08 ? 'PASS' : 'RE-SPLICE'}
    <div style="font-size: 9px; font-weight: normal;">${escapeHtml(record.verdict?.labelUrdu || '')}</div>
  </div>

  <div class="footer">
    Telcordia GR-765-CORE Compliant<br>
    NOC Helpline: 042-37900000<br>
    *** KEEP FOR JOINT RECORDS ***
  </div>
</body>
</html>`;
  }

  // Formal A4 Outside Plant & Metrology Laboratory Accreditation Certificate
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Accreditation Certificate - ${escapeHtml(record.id)}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #fff; margin: 0; padding: 0; line-height: 1.45; }
    .cert-frame { border: 3px double #334155; padding: 24px; position: relative; }
    .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }
    .logo-text { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .sub-text { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .cert-title-block { text-align: center; margin: 16px 0; }
    .cert-title { font-size: 18px; font-weight: 800; color: #0284c7; text-transform: uppercase; margin: 0; }
    .cert-subtitle { font-size: 11px; color: #475569; margin: 4px 0 0 0; }
    .cert-badge { display: inline-block; padding: 6px 16px; border-radius: 4px; font-size: 13px; font-weight: 700; color: #fff; background: ${record.verdict?.colorHex || '#0284c7'}; margin-top: 8px; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; font-size: 12px; }
    .meta-item { border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; background: #f8fafc; }
    .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
    .meta-val { font-size: 13px; font-weight: 600; color: #0f172a; }
    table.data-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    table.data-table th { background: #f1f5f9; font-weight: 700; color: #334155; }
    .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 16px 0; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 20px; }
    .sig-line { border-top: 1px dashed #64748b; text-align: center; padding-top: 6px; font-size: 11px; font-weight: 600; color: #334155; }
    .official-seal { width: 80px; height: 80px; border-radius: 50%; border: 2px dashed #0284c7; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #0284c7; text-align: center; margin: 0 auto; text-transform: uppercase; transform: rotate(-10deg); }
  </style>
</head>
<body>
  <div class="cert-frame">
    <table class="header-table">
      <tr>
        <td>
          <div class="logo-text">SHAHDARA BROADBAND FIBER NETWORK</div>
          <div class="sub-text">Outside Plant & Metrological Engineering Laboratory</div>
          <div style="font-size: 10px; color: #475569;">Baradari Road, Shahdara, Lahore, Punjab, Pakistan</div>
        </td>
        <td style="text-align: right;">
          <div style="font-size: 12px; font-weight: 700;">Certificate No: ${escapeHtml(record.id)}</div>
          <div style="font-size: 10px; color: #64748b;">Issue Date: ${dateStr}</div>
          <div style="font-size: 10px; color: #64748b;">Standard: ITU-T G.650.1 / GR-765-CORE</div>
        </td>
      </tr>
    </table>

    <div class="cert-title-block">
      <h1 class="cert-title">FUSION SPLICE CORE GEOMETRY & LOSS ACCREDITATION</h1>
      <p class="cert-subtitle">Mode Field Diameter (MFD) Mismatch, Radial Lateral Offset & Angular Cleave Tilt Assessment</p>
      <div class="cert-badge">${escapeHtml(record.verdict?.label || 'CERTIFIED')} - ${escapeHtml(record.verdict?.labelUrdu || '')}</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Inspection Location / Enclosure</div>
        <div class="meta-val">${escapeHtml(record.location)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Certified Splicing Specialist</div>
        <div class="meta-val">${escapeHtml(record.technicianName)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Splicer Technology</div>
        <div class="meta-val">${escapeHtml(splicer.name)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Subscriber / Account Reference</div>
        <div class="meta-val">${record.customer ? `${escapeHtml(record.customer.name)} (${escapeHtml(record.customer.phone)})` : 'Outside Plant Trunk Closure'}</div>
      </div>
    </div>

    <h3 style="font-size: 13px; text-transform: uppercase; margin: 14px 0 6px 0; color: #0f172a;">Optical Fiber Joint Specifications</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th>Joint Component</th>
          <th>Standard Profile</th>
          <th>Nominal MFD (@ ${escapeHtml(record.wavelength)}nm)</th>
          <th>Concentricity Error</th>
          <th>Cladding Diameter</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Left Fiber (Reference)</strong></td>
          <td>${escapeHtml(leftProf.name)}</td>
          <td>${(record.leftFiberType ? (leftProf['nominalMfd' + record.wavelength + 'Um'] || leftProf.nominalMfd1310Um) : 9.2).toFixed(2)} µm</td>
          <td>${record.leftEccentricityUm.toFixed(2)} µm</td>
          <td>125.0 ± 0.7 µm</td>
        </tr>
        <tr>
          <td><strong>Right Fiber (Demarcation)</strong></td>
          <td>${escapeHtml(rightProf.name)}</td>
          <td>${(record.rightFiberType ? (rightProf['nominalMfd' + record.wavelength + 'Um'] || rightProf.nominalMfd1310Um) : 9.2).toFixed(2)} µm</td>
          <td>${record.rightEccentricityUm.toFixed(2)} µm</td>
          <td>125.0 ± 0.7 µm</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size: 13px; text-transform: uppercase; margin: 14px 0 6px 0; color: #0f172a;">Loss Breakdown & Mathematical Decomposition</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th>Loss Mechanism</th>
          <th>Physical Parameter</th>
          <th>Calculated Value</th>
          <th>Telcordia Threshold</th>
          <th>Compliance Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>MFD Mismatch Loss (α_MFD)</strong></td>
          <td>ΔMFD = ${Math.abs(leftProf.nominalMfd1310Um - rightProf.nominalMfd1310Um).toFixed(2)} µm</td>
          <td><strong>${record.lossMfdDb.toFixed(4)} dB</strong></td>
          <td>≤ 0.050 dB</td>
          <td>${record.lossMfdDb <= 0.05 ? '<span style="color: #10b981; font-weight: bold;">PASS</span>' : '<span style="color: #f59e0b; font-weight: bold;">EVALUATE</span>'}</td>
        </tr>
        <tr>
          <td><strong>Radial Core Offset Loss (α_Offset)</strong></td>
          <td>Net Offset d = ${record.netOffsetUm.toFixed(3)} µm</td>
          <td><strong>${record.lossOffsetDb.toFixed(4)} dB</strong></td>
          <td>≤ 0.040 dB</td>
          <td>${record.lossOffsetDb <= 0.04 ? '<span style="color: #10b981; font-weight: bold;">PASS</span>' : '<span style="color: #ef4444; font-weight: bold;">HIGH OFFSET</span>'}</td>
        </tr>
        <tr>
          <td><strong>Cleave Angular Tilt Loss (α_Tilt)</strong></td>
          <td>End-face Tilt θ = ${record.tiltAngleDeg.toFixed(2)}°</td>
          <td><strong>${record.lossTiltDb.toFixed(4)} dB</strong></td>
          <td>≤ 0.030 dB</td>
          <td>${record.lossTiltDb <= 0.03 ? '<span style="color: #10b981; font-weight: bold;">PASS</span>' : '<span style="color: #ef4444; font-weight: bold;">RE-CLEAVE</span>'}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td><strong>Total Modeled Loss (@ ${escapeHtml(record.wavelength)}nm)</strong></td>
          <td>Sum (Marcuse & ITU-T G.650)</td>
          <td><strong style="font-size: 14px; color: ${record.totalLossDb <= 0.08 ? '#0284c7' : '#ef4444'};">${record.totalLossDb.toFixed(3)} dB</strong></td>
          <td>≤ 0.080 dB (Access)</td>
          <td><strong>${record.totalLossDb <= 0.08 ? 'ACCREDITED PASS' : 'OUT OF SPEC'}</strong></td>
        </tr>
        <tr>
          <td><strong>Estimated Loss @ 1550nm (C-Band)</strong></td>
          <td>Extended Wavelength Validation</td>
          <td><strong>${record.totalLoss1550Db.toFixed(3)} dB</strong></td>
          <td>≤ 0.080 dB</td>
          <td>${record.totalLoss1550Db <= 0.08 ? 'PASS' : 'MONITOR'}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary-card">
      <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Engineering Metrology Analysis</div>
      <div style="font-size: 12px; margin-top: 4px; color: #1e293b;">
        <strong>Dominant Contributor:</strong> ${escapeHtml(record.dominantFactor)}<br>
        <strong>Technical Notes:</strong> ${escapeHtml(record.notes || 'Routine outside plant fiber fusion joint. Verified compliant with Telcordia GR-765-CORE.')}
      </div>
    </div>

    <div class="signatures">
      <div class="sig-line">
        ${escapeHtml(record.technicianName)}<br>
        Certified Field Splicer / Lead Lineman
      </div>
      <div>
        <div class="official-seal">
          NOC QA<br>ACCREDITED<br>METROLOGY
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates bilingual Urdu & English WhatsApp notification for technician dispatch.
 * @param {object} record
 * @returns {string} Plain text WhatsApp message
 */
export function formatSpliceMfdOffsetCertWhatsApp(record) {
  if (!record) return '';
  const dateStr = record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' }) : 'Today';
  const leftName = FIBER_PROFILES[record.leftFiberType]?.name || record.leftFiberType;
  const rightName = FIBER_PROFILES[record.rightFiberType]?.name || record.rightFiberType;

  return `🔬 *SHAHDARA FIBER NET - FUSION SPLICE QA CERTIFICATE*
📜 *Cert No:* ${record.id}
📅 *Date:* ${dateStr}
📍 *Location:* ${record.location}
👷 *Technician:* ${record.technicianName}
${record.customer ? `👤 *Subscriber:* ${record.customer.name} (${record.customer.zone})\n` : ''}
🔗 *Fiber Profiles:*
• Left: ${leftName}
• Right: ${rightName}
• Alignment: ${record.splicerType}

📊 *Optical Joint Decomposition:*
• Cleave Tilt: ${record.tiltAngleDeg.toFixed(2)}°
• Net Lateral Core Offset: ${record.netOffsetUm.toFixed(2)} µm
• MFD Loss (α_MFD): ${record.lossMfdDb.toFixed(3)} dB
• Offset Loss (α_Offset): ${record.lossOffsetDb.toFixed(3)} dB
• Tilt Loss (α_Tilt): ${record.lossTiltDb.toFixed(3)} dB
⚡ *TOTAL INSERTION LOSS:* ${record.totalLossDb.toFixed(3)} dB (@ ${record.wavelength}nm)
🎯 *Verdict:* ${record.verdict?.code} - ${record.verdict?.label}
🇵🇰 *اردو رزلٹ:* ${record.verdict?.labelUrdu}

${record.totalLossDb <= 0.08 ? '✅ *Approved for Outside Plant Splicing Tray Closing.*' : '⚠️ *Excessive Loss! Re-cleave and re-splice mandated under Telcordia GR-765-CORE.*'}
📞 *Shahdara NOC Metrology:* 042-37900000`;
}

/**
 * Generates compliant RFC-4180 CSV Export with UTF-8 BOM.
 * @param {Array} records
 * @returns {string} CSV text
 */
export function generateSpliceMfdOffsetCertsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Date',
    'Customer Name',
    'Customer Phone',
    'Location',
    'Technician',
    'Left Fiber',
    'Right Fiber',
    'Splicer Alignment',
    'Wavelength (nm)',
    'Tilt Angle (deg)',
    'Net Offset (um)',
    'MFD Loss (dB)',
    'Offset Loss (dB)',
    'Tilt Loss (dB)',
    'Total Loss (dB)',
    'Total Loss 1550 (dB)',
    'Verdict Code',
    'Status',
    'Dominant Factor'
  ];

  const rows = records.map(r => [
    r.id,
    r.createdAt ? r.createdAt.slice(0, 19).replace('T', ' ') : '',
    r.customer?.name || 'N/A',
    r.customer?.phone || '',
    r.location || '',
    r.technicianName || '',
    r.leftFiberType,
    r.rightFiberType,
    r.splicerType,
    r.wavelength,
    r.tiltAngleDeg?.toFixed(2) || '0.00',
    r.netOffsetUm?.toFixed(2) || '0.00',
    r.lossMfdDb?.toFixed(3) || '0.000',
    r.lossOffsetDb?.toFixed(3) || '0.000',
    r.lossTiltDb?.toFixed(3) || '0.000',
    r.totalLossDb?.toFixed(3) || '0.000',
    r.totalLoss1550Db?.toFixed(3) || '0.000',
    r.verdict?.code || '',
    r.status || '',
    r.dominantFactor || ''
  ]);

  const escapeCell = (c) => {
    const s = String(c ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvBody = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\r\n');
  return '\uFEFF' + csvBody;
}

/**
 * Interactive UI Modal Controller for HTML Dialog.
 */
export function setupSpliceMfdOffsetModal({
  dialogElement,
  triggerButton,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = (msg) => console.log(msg),
  openPrintWindow = (html) => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
    }
  }
} = {}) {
  if (!dialogElement) return null;

  const leftFiberSelect = dialogElement.querySelector('#spliceLeftFiberSelect');
  const rightFiberSelect = dialogElement.querySelector('#spliceRightFiberSelect');
  const splicerSelect = dialogElement.querySelector('#spliceSplicerSelect');
  const wavelengthSelect = dialogElement.querySelector('#spliceWavelengthSelect');
  const presetSelect = dialogElement.querySelector('#splicePresetSelect');
  const tiltInput = dialogElement.querySelector('#spliceTiltInput');
  const tiltValBadge = dialogElement.querySelector('#spliceTiltValBadge');
  const leftEccInput = dialogElement.querySelector('#spliceLeftEccInput');
  const rightEccInput = dialogElement.querySelector('#spliceRightEccInput');
  const technicianInput = dialogElement.querySelector('#spliceTechnicianInput');
  const locationInput = dialogElement.querySelector('#spliceLocationInput');
  const notesInput = dialogElement.querySelector('#spliceNotesInput');

  // Preview elements
  const svgContainer = dialogElement.querySelector('#spliceSvgContainer');
  const totalLossBadge = dialogElement.querySelector('#spliceTotalLossBadge');
  const verdictPill = dialogElement.querySelector('#spliceVerdictPill');
  const mfdLossBadge = dialogElement.querySelector('#spliceMfdLossBadge');
  const offsetLossBadge = dialogElement.querySelector('#spliceOffsetLossBadge');
  const tiltLossBadge = dialogElement.querySelector('#spliceTiltLossBadge');

  // History table
  const historyTbody = dialogElement.querySelector('#spliceHistoryTbody');
  const searchInput = dialogElement.querySelector('#spliceHistorySearch');
  const verdictFilter = dialogElement.querySelector('#spliceHistoryVerdictFilter');

  // Buttons
  const saveBtn = dialogElement.querySelector('#spliceSaveCertBtn');
  const printA4Btn = dialogElement.querySelector('#splicePrintA4Btn');
  const printPosBtn = dialogElement.querySelector('#splicePrintPosBtn');
  const exportCsvBtn = dialogElement.querySelector('#spliceExportCsvBtn');
  const whatsAppBtn = dialogElement.querySelector('#spliceWhatsAppBtn');
  const closeBtn = dialogElement.querySelector('#spliceCloseBtn');

  let activeCustomer = null;

  // Populate Select Dropdowns safely
  const doc = dialogElement?.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const createOption = (val, text) => {
    if (doc?.createElement) {
      const opt = doc.createElement('option');
      opt.value = val;
      opt.textContent = text;
      return opt;
    }
    return { value: val, textContent: text, tagName: 'OPTION' };
  };

  if (leftFiberSelect && !leftFiberSelect.children.length) {
    Object.values(FIBER_PROFILES).forEach(f => {
      leftFiberSelect.appendChild(createOption(f.id, `${f.name} (MFD ~${f.nominalMfd1310Um}µm)`));
    });
  }

  if (rightFiberSelect && !rightFiberSelect.children.length) {
    Object.values(FIBER_PROFILES).forEach(f => {
      rightFiberSelect.appendChild(createOption(f.id, `${f.name} (MFD ~${f.nominalMfd1310Um}µm)`));
    });
  }

  if (splicerSelect && !splicerSelect.children.length) {
    Object.values(SPLICER_ALIGNMENT_TYPES).forEach(s => {
      splicerSelect.appendChild(createOption(s.id, `${s.name}`));
    });
  }

  if (presetSelect && presetSelect.children.length <= 1) {
    Object.values(SHAH_SPLICE_PRESETS).forEach(p => {
      presetSelect.appendChild(createOption(p.id, p.name));
    });
  }

  function getFormValues() {
    return {
      leftFiberType: leftFiberSelect?.value || 'ITU_G652D',
      rightFiberType: rightFiberSelect?.value || 'ITU_G652D',
      splicerType: splicerSelect?.value || 'CORE_PAS',
      wavelength: wavelengthSelect?.value || '1310',
      tiltAngleDeg: Number(tiltInput?.value) || 0.25,
      leftEccentricityUm: leftEccInput ? Number(leftEccInput.value) : 0.25,
      rightEccentricityUm: rightEccInput ? Number(rightEccInput.value) : 0.25
    };
  }

  function recalculate() {
    const values = getFormValues();
    if (tiltValBadge && tiltInput) {
      tiltValBadge.textContent = `${Number(tiltInput.value).toFixed(2)}°`;
    }

    const analysis = evaluateSpliceLoss(values);

    if (svgContainer) {
      svgContainer.innerHTML = renderSpliceMfdOffsetSvg(analysis);
    }
    if (totalLossBadge) {
      totalLossBadge.textContent = `${analysis.totalLossDb.toFixed(3)} dB`;
      totalLossBadge.style.color = analysis.verdict.colorHex;
    }
    if (verdictPill) {
      verdictPill.textContent = `${analysis.verdict.code}: ${analysis.verdict.label}`;
      verdictPill.className = `status-pill ${analysis.verdict.badgeClass}`;
      verdictPill.style.backgroundColor = analysis.verdict.colorHex + '22';
      verdictPill.style.color = analysis.verdict.colorHex;
    }
    if (mfdLossBadge) mfdLossBadge.textContent = `${analysis.lossMfdDb.toFixed(3)} dB`;
    if (offsetLossBadge) offsetLossBadge.textContent = `${analysis.lossOffsetDb.toFixed(3)} dB`;
    if (tiltLossBadge) tiltLossBadge.textContent = `${analysis.lossTiltDb.toFixed(3)} dB`;

    return analysis;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const records = getSavedSpliceMfdOffsetCerts(storage);
    const query = searchInput?.value.trim().toLowerCase() || '';
    const filterV = verdictFilter?.value || 'ALL';

    const filtered = records.filter(r => {
      if (filterV !== 'ALL' && (r.verdict?.code || '') !== filterV) return false;
      if (query) {
        const text = `${r.id} ${r.location} ${r.technicianName} ${r.customer?.name || ''} ${r.leftFiberType} ${r.rightFiberType}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      historyTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#94a3b8;">No fusion splice QA records found.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = filtered.map(r => `
      <tr>
        <td style="font-family: monospace; font-weight: 600;">${escapeHtml(r.id)}</td>
        <td>${r.createdAt ? r.createdAt.slice(0, 10) : ''}</td>
        <td>${escapeHtml(r.customer?.name || r.location || 'OSP Enclosure')}</td>
        <td>${escapeHtml(r.leftFiberType.replace('ITU_', ''))} → ${escapeHtml(r.rightFiberType.replace('ITU_', ''))}</td>
        <td><strong>${r.totalLossDb.toFixed(3)} dB</strong></td>
        <td><span class="status-pill ${r.verdict?.badgeClass || 'badge-pass'}">${escapeHtml(r.verdict?.code || 'PASS')}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" data-action="print-pos" data-id="${escapeHtml(r.id)}">Slip</button>
          <button class="btn btn-sm btn-secondary" data-action="print-a4" data-id="${escapeHtml(r.id)}">Cert</button>
        </td>
      </tr>
    `).join('');

    // Attach row button events
    historyTbody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        const record = records.find(x => x.id === id);
        if (!record) return;

        if (action === 'print-pos') {
          openPrintWindow(generateSpliceMfdOffsetCertHtml(record, { format: 'POS' }));
        } else if (action === 'print-a4') {
          openPrintWindow(generateSpliceMfdOffsetCertHtml(record, { format: 'A4' }));
        }
      });
    });
  }

  // Event Listeners
  [leftFiberSelect, rightFiberSelect, splicerSelect, wavelengthSelect, leftEccInput, rightEccInput].forEach(el => {
    el?.addEventListener('change', recalculate);
    el?.addEventListener('input', recalculate);
  });
  tiltInput?.addEventListener('input', recalculate);

  presetSelect?.addEventListener('change', () => {
    const pid = presetSelect.value;
    const p = SHAH_SPLICE_PRESETS[pid];
    if (!p) return;

    if (leftFiberSelect) leftFiberSelect.value = p.leftFiberType;
    if (rightFiberSelect) rightFiberSelect.value = p.rightFiberType;
    if (splicerSelect) splicerSelect.value = p.splicerType;
    if (wavelengthSelect) wavelengthSelect.value = p.wavelength;
    if (tiltInput) tiltInput.value = p.tiltAngleDeg;
    if (leftEccInput) leftEccInput.value = p.leftEccentricityUm;
    if (rightEccInput) rightEccInput.value = p.rightEccentricityUm;
    if (technicianInput) technicianInput.value = p.technicianName;
    if (locationInput) locationInput.value = p.location;

    recalculate();
    onToast(`Applied field preset: ${p.name}`);
  });

  saveBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildSpliceMfdOffsetRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value || 'Certified Specialist',
      location: locationInput?.value || 'Outside Plant Enclosure',
      notes: notesInput?.value || ''
    });

    const ok = saveSpliceMfdOffsetCert(record, storage);
    if (ok) {
      onToast(`Saved Splice Certificate ${record.id}!`);
      renderHistory();
    } else {
      onToast('Error saving record.');
    }
  });

  printA4Btn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildSpliceMfdOffsetRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const html = generateSpliceMfdOffsetCertHtml(record, { format: 'A4' });
    openPrintWindow(html);
  });

  printPosBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildSpliceMfdOffsetRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const html = generateSpliceMfdOffsetCertHtml(record, { format: 'POS' });
    openPrintWindow(html);
  });

  exportCsvBtn?.addEventListener('click', () => {
    const records = getSavedSpliceMfdOffsetCerts(storage);
    if (!records.length) {
      onToast('No saved records to export.');
      return;
    }
    const csv = generateSpliceMfdOffsetCertsCsv(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara_splice_mfd_qa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported CSV successfully!');
  });

  whatsAppBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildSpliceMfdOffsetRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const text = formatSpliceMfdOffsetCertWhatsApp(record);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      onToast('WhatsApp dispatch notice copied to clipboard!');
    }
  });

  searchInput?.addEventListener('input', renderHistory);
  verdictFilter?.addEventListener('change', renderHistory);

  triggerButton?.addEventListener('click', () => {
    if (typeof dialogElement.showModal === 'function') {
      dialogElement.showModal();
    } else {
      dialogElement.setAttribute('open', '');
    }
    recalculate();
    renderHistory();
  });

  closeBtn?.addEventListener('click', () => {
    if (typeof dialogElement.close === 'function') {
      dialogElement.close();
    } else {
      dialogElement.removeAttribute('open');
    }
  });

  recalculate();
  renderHistory();

  return {
    recalculate,
    populateCustomer: (c) => {
      activeCustomer = c;
      if (locationInput && c) {
        locationInput.value = `${c.name || 'Subscriber'} Premises Drop (${c.mohalla || c.zone || 'Shahdara'})`;
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
