/**
 * Shahdara ISP Billing & Network Operations - Optical Fiber Ribbon Mass Fusion Splice Pitch Skew,
 * Fiber-to-Fiber Offset & Differential Arc Fusion QA Certification Suite
 * Standards: ITU-T G.650.1, ITU-T G.652.D, Telcordia GR-765-CORE, IEC 61073-1, TIA-598-D, TIA/EIA-455-131
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const RIBBON_SPLICE_QA_STORAGE_KEY = 'shahdara_ribbon_splice_qa_v1';

export const TIA598_RIBBON_COLORS = [
  { index: 1, name: 'Blue', urdu: 'نیلا', code: '#0066cc', textDark: false },
  { index: 2, name: 'Orange', urdu: 'نارنجی', code: '#ff7700', textDark: false },
  { index: 3, name: 'Green', urdu: 'سبز', code: '#009933', textDark: false },
  { index: 4, name: 'Brown', urdu: 'بھورا', code: '#8b4513', textDark: false },
  { index: 5, name: 'Slate', urdu: 'سلیٹی', code: '#708090', textDark: false },
  { index: 6, name: 'White', urdu: 'سفید', code: '#f5f5f5', textDark: true },
  { index: 7, name: 'Red', urdu: 'سرخ', code: '#dc143c', textDark: false },
  { index: 8, name: 'Black', urdu: 'کالا', code: '#1a1a1a', textDark: false },
  { index: 9, name: 'Yellow', urdu: 'پیلا', code: '#ffd700', textDark: true },
  { index: 10, name: 'Violet', urdu: 'جامنی', code: '#8a2be2', textDark: false },
  { index: 11, name: 'Rose', urdu: 'گلابی', code: '#ff69b4', textDark: false },
  { index: 12, name: 'Aqua', urdu: 'آسمانی', code: '#00c5cd', textDark: true }
];

export const RIBBON_SPLICER_MODELS = {
  'FUJIKURA_90R12': {
    id: 'FUJIKURA_90R12',
    name: 'Fujikura 90R12 Automated Mass Ribbon Splicer',
    brand: 'Fujikura (Japan)',
    category: 'High-Precision Automated Active V-Groove 12-Fiber',
    maxFibers: 12,
    arcCalibration: 'Real-Time Automated Plasma Sense',
    typicalLossDb: 0.02,
    maxPermissibleAngleDeg: 1.5,
    thermalArcBalanceScore: 0.98,
    description: 'Automated 12-fiber mass fusion with active blade management and computerized plasma discharge profiling.'
  },
  'SUMITOMO_72M12': {
    id: 'SUMITOMO_72M12',
    name: 'Sumitomo Type-72M12 Multi-Fiber Ribbon Splicer',
    brand: 'Sumitomo Electric (Japan)',
    category: 'Dual-Heater High-Speed Nano-Tune Ribbon Splicer',
    maxFibers: 12,
    arcCalibration: 'High-Precision Nano-Tune',
    typicalLossDb: 0.03,
    maxPermissibleAngleDeg: 1.5,
    thermalArcBalanceScore: 0.96,
    description: 'Ultra-fast dual independent shrink ovens and precision pitch V-grooves for 250µm ribbon arrays.'
  },
  'INNO_VIEW_12R': {
    id: 'INNO_VIEW_12R',
    name: 'INNO View 12R Field Ribbon Splicer',
    brand: 'INNO Instrument',
    category: 'Universal Field Ribbon Splicer',
    maxFibers: 12,
    arcCalibration: 'Motorized Anvil Arc Sensor',
    typicalLossDb: 0.04,
    maxPermissibleAngleDeg: 1.8,
    thermalArcBalanceScore: 0.92,
    description: 'High-magnification ribbon display with clamp guides for 4, 8, and 12-fiber ribbon bundles.'
  },
  'FITEL_S124M12': {
    id: 'FITEL_S124M12',
    name: 'Furukawa Fitel S124M12 Handheld Mass Splicer',
    brand: 'Furukawa Electric (Japan)',
    category: 'Handheld OSP Ribbon Splicer',
    maxFibers: 12,
    arcCalibration: 'Microprocessor Controlled Arc',
    typicalLossDb: 0.05,
    maxPermissibleAngleDeg: 2.0,
    thermalArcBalanceScore: 0.90,
    description: 'Compact handheld chassis designed for aerial pole buckets and tight manhole splice closures.'
  },
  'LEGACY_RIBBON_SPLICER': {
    id: 'LEGACY_RIBBON_SPLICER',
    name: 'Legacy Generic 12-Fiber Field Splicer',
    brand: 'Generic / OSP Contractor',
    category: 'Fixed V-Groove Manual Arc Splicer',
    maxFibers: 12,
    arcCalibration: 'Manual Pulse Adjustment',
    typicalLossDb: 0.07,
    maxPermissibleAngleDeg: 2.5,
    thermalArcBalanceScore: 0.82,
    description: 'Fixed mechanical V-groove chassis subject to edge channel thermal drop and uneven clamping pressure.'
  }
};

export const RIBBON_QA_VERDICTS = {
  'CERTIFIED_EXCELLENCE': {
    id: 'CERTIFIED_EXCELLENCE',
    code: 'TIER1_EXCELLENCE',
    label: 'Certified Excellence — Lab Grade Ribbon Splice (All Channels Green)',
    badgeClass: 'badge-pass-certified',
    statusClass: 'status-good',
    colorHex: '#10b981',
    maxLossThresholdDb: 0.05,
    actionRequired: 'SEAL ENCLOSURE (APPROVED)',
    recommendationUrdu: 'شاندار ریبن جوائنٹ — تمام 12 فائبرز مکمل منظور شدہ اور عالمی معیار کے مطابق ہیں',
    recommendation: 'Uniform arc discharge, near-zero core offset across all 12 channels. Ready for immediate closure sealing.'
  },
  'STANDARD_PASS': {
    id: 'STANDARD_PASS',
    code: 'OSP_PASS',
    label: 'Standard Pass — Outside Plant Feeder Deployment Grade',
    badgeClass: 'badge-pass-standard',
    statusClass: 'status-good',
    colorHex: '#3b82f6',
    maxLossThresholdDb: 0.10,
    actionRequired: 'APPROVE FOR TRAFFIC',
    recommendationUrdu: 'کامیاب جوائنٹ — آؤٹ سائیڈ پلانٹ نیٹ ورک پر ٹریفک کے لیے مکمل موزوں ہے',
    recommendation: 'All 12 channels within ITU-T G.652.D OSP loss tolerances. Proceed with splice protection sleeve heat shrink.'
  },
  'CONDITIONAL_PASS': {
    id: 'CONDITIONAL_PASS',
    code: 'CONDITIONAL_WARN',
    label: 'Conditional Pass — Marginal Edge Fiber Loss (Monitor Closely)',
    badgeClass: 'badge-warning',
    statusClass: 'status-warning',
    colorHex: '#f59e0b',
    maxLossThresholdDb: 0.15,
    actionRequired: 'LOG FOR BI-ANNUAL AUDIT',
    recommendationUrdu: 'مشروط منظوری — بیرونی فائبرز کا نقصان قدرے زیادہ ہے، باقاعدہ جانچ ضروری ہے',
    recommendation: 'Outer fibers exhibit elevated attenuation due to pitch drift or mild arc gradient. Accepted conditionally.'
  },
  'RE_SPLICE_MANDATED': {
    id: 'RE_SPLICE_MANDATED',
    code: 'RE_SPLICE',
    label: 'Re-Splice Mandated — Excessive Channel Loss or Pitch Skew',
    badgeClass: 'badge-fail-rework',
    statusClass: 'status-danger',
    colorHex: '#ef4444',
    maxLossThresholdDb: 99.9,
    actionRequired: 'RE-CLEAVE & RE-SPLICE IMMEDIATELY',
    recommendationUrdu: 'دوبارہ جوائنٹ ضروری — فائبر کٹ کر کے دوبارہ احتیاط سے وی گرُووز میں جوڑیں',
    recommendation: 'One or more channels exceed 0.15 dB ITU-T ceiling, or severe pitch skew detected. Cleave ribbon again.'
  }
};

export const SHAH_RIBBON_SPLICE_PRESETS = {
  'PRESET_BARADARI_12F_FEEDER': {
    id: 'PRESET_BARADARI_12F_FEEDER',
    name: 'Baradari Central ODF — 12-Fiber Feeder Ribbon to Ring-01',
    route: 'Baradari Chowk Central OLT to Jia Musa Ring ODF-01 (Feeder Trunk A)',
    splicerId: 'FUJIKURA_90R12',
    fiberCount: 12,
    pitchNominalUm: 250.0,
    pitchVariationUm: 0.8,
    cleaveLengthDiffUm: 1.2,
    arcDischargeCurrentMa: 14.5,
    arcBalanceFactor: 0.99,
    wavelengthNm: 1310,
    technicianName: 'Sample Technician (Senior OSP Splicer)',
    notes: 'Pristine ribbon preparation using thermal stripper and CT50 blade. Optimal fusion across all 12 channels.'
  },
  'PRESET_RAVI_SIPHON_24F_TRUNK': {
    id: 'PRESET_RAVI_SIPHON_24F_TRUNK',
    name: 'Ravi Siphon River Crossing — 24-Fiber High-Density Ribbon Trunk (Ribbon #1)',
    route: 'Ravi Siphon Feeder Crossing to Begum Kot East Ring Closure #03',
    splicerId: 'SUMITOMO_72M12',
    fiberCount: 12,
    pitchNominalUm: 250.0,
    pitchVariationUm: 2.9,
    cleaveLengthDiffUm: 4.8,
    arcDischargeCurrentMa: 14.0,
    arcBalanceFactor: 0.94,
    wavelengthNm: 1550,
    technicianName: 'Tariq Mehmood (OSP Lineman)',
    notes: 'High ribbon pitch skew observed on anvil guide; fiber #12 exhibits elevated offset. Conditional pass.'
  },
  'PRESET_BEGUM_KOT_ARC_IMBALANCE': {
    id: 'PRESET_BEGUM_KOT_ARC_IMBALANCE',
    name: 'Begum Kot Industrial Ring — 12-Fiber Feeder Ribbon (Electrode Arc Imbalance)',
    route: 'Begum Kot Industrial Estate ODF to Millat Tractor Backbone',
    splicerId: 'LEGACY_RIBBON_SPLICER',
    fiberCount: 12,
    pitchNominalUm: 250.0,
    pitchVariationUm: 4.5,
    cleaveLengthDiffUm: 6.2,
    arcDischargeCurrentMa: 13.2,
    arcBalanceFactor: 0.78,
    wavelengthNm: 1310,
    technicianName: 'Khurram Shahzad (Field Tech)',
    notes: 'Electrode tip oxidation causing severe parabolic arc cooling on outer fibers #1 and #12. Re-splice required.'
  },
  'PRESET_VANDALA_SUBFAT_DROP': {
    id: 'PRESET_VANDALA_SUBFAT_DROP',
    name: 'Vandala Road Sub-FAT Distribution — 12-Fiber Drop Ribbon',
    route: 'Vandala Road Main Splitter Enclosure to Rachna Town Sub-FAT 08',
    splicerId: 'INNO_VIEW_12R',
    fiberCount: 12,
    pitchNominalUm: 250.0,
    pitchVariationUm: 1.8,
    cleaveLengthDiffUm: 2.5,
    arcDischargeCurrentMa: 14.2,
    arcBalanceFactor: 0.93,
    wavelengthNm: 1490,
    technicianName: 'Arshad Ali (Field Tech)',
    notes: 'Minor pitch offset within acceptable Telcordia GR-765 limits. Suitable for standard FTTH GPON service.'
  },
  'PRESET_JIA_MUSA_RING_EXCELLENCE': {
    id: 'PRESET_JIA_MUSA_RING_EXCELLENCE',
    name: 'Jia Musa Commercial Ring — 12-Fiber Ribbon Backbone (NOC Lab Quality)',
    route: 'Jia Musa Main Exchange ODF-02 to Commercial Plaza Distribution Hub',
    splicerId: 'FUJIKURA_90R12',
    fiberCount: 12,
    pitchNominalUm: 250.0,
    pitchVariationUm: 0.4,
    cleaveLengthDiffUm: 0.8,
    arcDischargeCurrentMa: 14.6,
    arcBalanceFactor: 0.995,
    wavelengthNm: 1550,
    technicianName: 'Zubair Ahmad (Quality Lead)',
    notes: 'Lab-calibrated ribbon splice. Uniform arc heating, minimal cleave delta. Certified Excellence.'
  }
};

/**
 * Calculates theoretical Marcuse core lateral transverse offset loss
 * Formula: alpha_d = 4.343 * (2 * d^2 / (omega_0^2)) in dB
 */
export function calculateMarcuseCoreOffsetLoss(offsetUm, mfdUm = 9.2) {
  const d = Math.max(0, parseFloat(offsetUm) || 0);
  const mfd = Math.max(1, parseFloat(mfdUm) || 9.2);
  const w0 = mfd / 2.0;
  const loss = 4.343 * (2.0 * (d * d) / (w0 * w0));
  return Math.round(loss * 1000) / 1000;
}

/**
 * Calculates theoretical cleave angle tilt loss
 * Formula: alpha_theta = 4.343 * (pi^2 * n2^2 * w0^2 * theta^2 / lambda^2) in dB
 */
export function calculateCleaveTiltLoss(thetaDeg, wavelengthNm = 1310, n2 = 1.467, mfdUm = 9.2) {
  const theta = Math.max(0, parseFloat(thetaDeg) || 0);
  if (theta <= 0) return 0.00;
  const thetaRad = (theta * Math.PI) / 180.0;
  const lambdaUm = (parseFloat(wavelengthNm) || 1310) / 1000.0;
  const w0 = (parseFloat(mfdUm) || 9.2) / 2.0;
  const term = (Math.PI * n2 * w0 * thetaRad) / lambdaUm;
  const loss = 4.343 * (term * term);
  return Math.round(loss * 1000) / 1000;
}

/**
 * Calculates differential electric arc plasma thermal loss profile across ribbon width.
 * In ribbon fusion, electric arc temperature follows a parabolic curve across the width x in [-1, 1].
 * Central fibers receive peak temperature, while edge fibers (1 and 12) receive lower heat flux.
 */
export function calculateRibbonArcThermalLoss(fiberIndex, totalFibers = 12, arcBalanceFactor = 0.95) {
  const i = Math.max(1, parseInt(fiberIndex, 10) || 1);
  const n = Math.max(2, parseInt(totalFibers, 10) || 12);
  const balance = Math.min(1.0, Math.max(0.5, parseFloat(arcBalanceFactor) || 0.95));

  // Normalized position from center: -1.0 (fiber 1) to +1.0 (fiber N)
  const normalizedPos = ((i - 0.5) / (n / 2.0)) - 1.0;
  const edgeDistSq = normalizedPos * normalizedPos; // 0 at center, 1.0 at outer edges

  // Imperfect arc balance creates thermal deficit at edges
  const thermalDeficitFactor = (1.0 - balance) * 1.5;
  const lossDb = thermalDeficitFactor * edgeDistSq * 0.12;

  return Math.round(lossDb * 1000) / 1000;
}

/**
 * Calculates geometric ribbon pitch skew angle
 * Skew Angle Theta = arctan(cleaveDelta / ribbonWidth)
 */
export function calculateRibbonPitchSkew(fiberCount = 12, pitchNominalUm = 250.0, pitchVariationUm = 1.0, cleaveLengthDiffUm = 2.0) {
  const n = Math.max(2, parseInt(fiberCount, 10) || 12);
  const pNominal = Math.max(100, parseFloat(pitchNominalUm) || 250.0);
  const pVar = Math.max(0, parseFloat(pitchVariationUm) || 0.0);
  const cleaveDiff = Math.max(0, parseFloat(cleaveLengthDiffUm) || 0.0);

  const ribbonWidthUm = (n - 1) * pNominal;
  const skewAngleDeg = (Math.atan2(cleaveDiff, ribbonWidthUm) * 180.0) / Math.PI;
  const pitchVariationPercent = (pVar / pNominal) * 100.0;

  return {
    ribbonWidthUm: Math.round(ribbonWidthUm * 10) / 10,
    skewAngleDeg: Math.round(skewAngleDeg * 1000) / 1000,
    cleaveLengthDiffUm: Math.round(cleaveDiff * 100) / 100,
    pitchVariationPercent: Math.round(pitchVariationPercent * 100) / 100
  };
}

/**
 * Evaluates comprehensive 12-fiber mass ribbon fusion splice analysis
 */
export function evaluateRibbonSpliceAnalysis(params = {}) {
  const fiberCount = Math.max(4, Math.min(24, parseInt(params.fiberCount, 10) || 12));
  const splicerId = params.splicerId || 'FUJIKURA_90R12';
  const splicer = RIBBON_SPLICER_MODELS[splicerId] || RIBBON_SPLICER_MODELS['FUJIKURA_90R12'];
  const wavelengthNm = parseInt(params.wavelengthNm, 10) || 1310;
  const mfdUm = wavelengthNm >= 1550 ? 10.4 : 9.2;
  const pitchNominalUm = parseFloat(params.pitchNominalUm) || 250.0;
  const pitchVariationUm = parseFloat(params.pitchVariationUm) || 1.0;
  const cleaveLengthDiffUm = parseFloat(params.cleaveLengthDiffUm) || 2.0;
  const arcBalanceFactor = parseFloat(params.arcBalanceFactor) || splicer.thermalArcBalanceScore;

  const skew = calculateRibbonPitchSkew(fiberCount, pitchNominalUm, pitchVariationUm, cleaveLengthDiffUm);

  // Calculate telemetry for each individual fiber in the ribbon
  const fiberResults = [];
  let sumLoss = 0.0;
  let maxLoss = 0.0;
  let minLoss = 999.0;
  let maxLossFiberIndex = 1;
  let minLossFiberIndex = 1;

  for (let i = 1; i <= fiberCount; i++) {
    const colorInfo = TIA598_RIBBON_COLORS[(i - 1) % 12];
    
    // Normalized position from center for pitch skew contribution
    const normalizedPos = ((i - 0.5) / (fiberCount / 2.0)) - 1.0;
    
    // Pitch variation and cleave skew produce fiber-dependent offset and angular tilt
    const localOffsetUm = Math.abs(normalizedPos) * (pitchVariationUm * 0.35) + (splicer.typicalLossDb > 0.04 ? 0.25 : 0.08);
    const localCleaveTiltDeg = (skew.skewAngleDeg * (0.6 + 0.4 * Math.abs(normalizedPos))) + 0.12;

    const offsetLoss = calculateMarcuseCoreOffsetLoss(localOffsetUm, mfdUm);
    const tiltLoss = calculateCleaveTiltLoss(localCleaveTiltDeg, wavelengthNm, 1.467, mfdUm);
    const thermalLoss = calculateRibbonArcThermalLoss(i, fiberCount, arcBalanceFactor);
    const baselineLoss = splicer.typicalLossDb * 0.25;

    // Total Channel Insertion Loss
    const totalChannelLoss = Math.round((offsetLoss + tiltLoss + thermalLoss + baselineLoss) * 1000) / 1000;

    sumLoss += totalChannelLoss;
    if (totalChannelLoss > maxLoss) {
      maxLoss = totalChannelLoss;
      maxLossFiberIndex = i;
    }
    if (totalChannelLoss < minLoss) {
      minLoss = totalChannelLoss;
      minLossFiberIndex = i;
    }

    let status = 'PASS';
    let badgeClass = 'badge-pass-standard';
    if (totalChannelLoss <= 0.05) {
      status = 'EXCELLENT';
      badgeClass = 'badge-pass-certified';
    } else if (totalChannelLoss <= 0.10) {
      status = 'PASS';
      badgeClass = 'badge-pass-standard';
    } else if (totalChannelLoss <= 0.15) {
      status = 'MARGINAL';
      badgeClass = 'badge-warning';
    } else {
      status = 'FAIL';
      badgeClass = 'badge-fail-rework';
    }

    fiberResults.push({
      fiberIndex: i,
      color: colorInfo.name,
      colorUrdu: colorInfo.urdu,
      colorHex: colorInfo.code,
      textDark: colorInfo.textDark,
      offsetUm: Math.round(localOffsetUm * 100) / 100,
      cleaveTiltDeg: Math.round(localCleaveTiltDeg * 100) / 100,
      offsetLossDb: offsetLoss,
      tiltLossDb: tiltLoss,
      thermalLossDb: thermalLoss,
      totalLossDb: totalChannelLoss,
      status,
      badgeClass
    });
  }

  const meanLossDb = Math.round((sumLoss / fiberCount) * 1000) / 1000;
  const lossSpreadDb = Math.round((maxLoss - minLoss) * 1000) / 1000;

  // Compute Standard Deviation across channels
  let varianceSum = 0.0;
  fiberResults.forEach(f => {
    const diff = f.totalLossDb - meanLossDb;
    varianceSum += diff * diff;
  });
  const lossStdDevDb = Math.round(Math.sqrt(varianceSum / fiberCount) * 1000) / 1000;

  // Determine Overall Quality Verdict
  let verdictKey = 'STANDARD_PASS';
  if (maxLoss <= 0.06 && meanLossDb <= 0.04 && lossSpreadDb <= 0.035 && skew.skewAngleDeg <= 0.08) {
    verdictKey = 'CERTIFIED_EXCELLENCE';
  } else if (maxLoss <= 0.10 && meanLossDb <= 0.06 && skew.skewAngleDeg <= 0.15) {
    verdictKey = 'STANDARD_PASS';
  } else if (maxLoss <= 0.15 && meanLossDb <= 0.09) {
    verdictKey = 'CONDITIONAL_PASS';
  } else {
    verdictKey = 'RE_SPLICE_MANDATED';
  }

  const verdict = RIBBON_QA_VERDICTS[verdictKey];

  return {
    splicer,
    fiberCount,
    wavelengthNm,
    mfdUm,
    pitchNominalUm,
    pitchVariationUm,
    cleaveLengthDiffUm,
    arcBalanceFactor,
    skew,
    fiberResults,
    metrics: {
      meanLossDb,
      maxLossDb: maxLoss,
      minLossDb: minLoss,
      lossSpreadDb,
      lossStdDevDb,
      maxLossFiberIndex,
      minLossFiberIndex,
      passedFiberCount: fiberResults.filter(f => f.status === 'PASS' || f.status === 'EXCELLENT').length,
      marginalFiberCount: fiberResults.filter(f => f.status === 'MARGINAL').length,
      failedFiberCount: fiberResults.filter(f => f.status === 'FAIL').length
    },
    verdict
  };
}

/**
 * Validates ribbon splice certification input parameters
 */
export function validateRibbonSpliceInput(data = {}) {
  const errors = [];

  if (!data.route || typeof data.route !== 'string' || data.route.trim().length < 3) {
    errors.push('Fiber route name or ODF span description is required (min 3 chars).');
  }

  if (!data.technicianName || typeof data.technicianName !== 'string' || data.technicianName.trim().length < 2) {
    errors.push('Technician name is required (min 2 chars).');
  }

  const pitchVar = parseFloat(data.pitchVariationUm);
  if (isNaN(pitchVar) || pitchVar < 0 || pitchVar > 20.0) {
    errors.push('Pitch variation must be between 0.0 and 20.0 µm.');
  }

  const cleaveDiff = parseFloat(data.cleaveLengthDiffUm);
  if (isNaN(cleaveDiff) || cleaveDiff < 0 || cleaveDiff > 30.0) {
    errors.push('Cleave length differential must be between 0.0 and 30.0 µm.');
  }

  const arcBalance = parseFloat(data.arcBalanceFactor);
  if (isNaN(arcBalance) || arcBalance < 0.5 || arcBalance > 1.0) {
    errors.push('Arc balance factor must be between 0.50 and 1.00.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generates an immutable, sequentially tracked ribbon splice QA record
 */
export function buildRibbonSpliceRecord(data = {}, state = {}) {
  const validation = validateRibbonSpliceInput(data);
  if (!validation.isValid) {
    throw new Error('Validation failed: ' + validation.errors.join('; '));
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Generate sequence ID: RBN-YYYYMM-XXXX
  const existingCerts = getSavedRibbonSpliceCerts(state);
  const sequenceNum = existingCerts.length + 1;
  const certId = `RBN-${year}${month}-${String(sequenceNum).padStart(4, '0')}`;

  const analysis = evaluateRibbonSpliceAnalysis({
    fiberCount: data.fiberCount || 12,
    splicerId: data.splicerId || 'FUJIKURA_90R12',
    wavelengthNm: data.wavelengthNm || 1310,
    pitchNominalUm: data.pitchNominalUm || 250.0,
    pitchVariationUm: data.pitchVariationUm || 1.0,
    cleaveLengthDiffUm: data.cleaveLengthDiffUm || 2.0,
    arcBalanceFactor: data.arcBalanceFactor || 0.96
  });

  return {
    id: certId,
    createdAt: now.toISOString(),
    route: data.route.trim(),
    splicerId: analysis.splicer.id,
    splicerName: analysis.splicer.name,
    fiberCount: analysis.fiberCount,
    wavelengthNm: analysis.wavelengthNm,
    technicianName: data.technicianName.trim(),
    customerId: data.customerId || '',
    customerName: data.customerName || '',
    notes: data.notes ? data.notes.trim() : '',
    analysis,
    status: analysis.verdict.id
  };
}

/**
 * LocalStorage management functions with safe fallbacks
 */
export function getSavedRibbonSpliceCerts(state = {}) {
  if (state && Array.isArray(state.ribbonSpliceCerts)) {
    return state.ribbonSpliceCerts;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(RIBBON_SPLICE_QA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore JSON parse error in restricted sandbox
    }
  }
  return [];
}

export function saveRibbonSpliceCert(cert, state = {}) {
  if (!cert || !cert.id) throw new Error('Invalid ribbon splice certificate record.');
  const existing = getSavedRibbonSpliceCerts(state);
  const updated = [cert, ...existing.filter(c => c.id !== cert.id)];

  if (state && typeof state === 'object') {
    state.ribbonSpliceCerts = updated;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(RIBBON_SPLICE_QA_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage quota or restriction fallback
    }
  }
  return updated;
}

export function updateRibbonSpliceCertStatus(certId, newStatus, state = {}) {
  const existing = getSavedRibbonSpliceCerts(state);
  const updated = existing.map(c => {
    if (c.id === certId) {
      return { ...c, status: newStatus, updatedAt: new Date().toISOString() };
    }
    return c;
  });
  if (state && typeof state === 'object') {
    state.ribbonSpliceCerts = updated;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(RIBBON_SPLICE_QA_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage fallback
    }
  }
  return updated;
}

export function clearRibbonSpliceCerts(state = {}) {
  if (state && typeof state === 'object') {
    state.ribbonSpliceCerts = [];
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(RIBBON_SPLICE_QA_STORAGE_KEY);
    } catch {
      // Storage fallback
    }
  }
  return [];
}

/**
 * Aggregates high-level QA KPI metrics
 */
export function calculateRibbonSpliceMetrics(certs = [], filterOptions = {}) {
  let filtered = Array.isArray(certs) ? certs : [];

  if (filterOptions.status) {
    filtered = filtered.filter(c => c.status === filterOptions.status);
  }
  if (filterOptions.searchQuery) {
    const q = filterOptions.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(c => 
      c.id.toLowerCase().includes(q) ||
      c.route.toLowerCase().includes(q) ||
      c.technicianName.toLowerCase().includes(q)
    );
  }

  const total = filtered.length;
  let certifiedExcellence = 0;
  let standardPass = 0;
  let conditionalPass = 0;
  let reSpliceMandated = 0;
  let sumMeanLoss = 0.0;
  let maxRecordedLoss = 0.0;

  filtered.forEach(c => {
    if (c.status === 'CERTIFIED_EXCELLENCE') certifiedExcellence++;
    else if (c.status === 'STANDARD_PASS') standardPass++;
    else if (c.status === 'CONDITIONAL_PASS') conditionalPass++;
    else if (c.status === 'RE_SPLICE_MANDATED') reSpliceMandated++;

    if (c.analysis && c.analysis.metrics) {
      sumMeanLoss += c.analysis.metrics.meanLossDb || 0;
      if (c.analysis.metrics.maxLossDb > maxRecordedLoss) {
        maxRecordedLoss = c.analysis.metrics.maxLossDb;
      }
    }
  });

  const avgRibbonLossDb = total > 0 ? Math.round((sumMeanLoss / total) * 1000) / 1000 : 0.00;
  const passRatePercent = total > 0 ? Math.round(((certifiedExcellence + standardPass) / total) * 1000) / 10 : 100.0;

  return {
    total,
    certifiedExcellence,
    standardPass,
    conditionalPass,
    reSpliceMandated,
    passRatePercent,
    avgRibbonLossDb,
    maxRecordedLossDb: Math.round(maxRecordedLoss * 1000) / 1000
  };
}

/**
 * Renders pure-vector SVG visualizer displaying 12-fiber ribbon array,
 * arc plasma thermal profile, and individual fiber insertion loss bar chart.
 */
export function renderRibbonSpliceQaSvg(analysis, options = {}) {
  if (!analysis || !analysis.fiberResults) return '<svg viewBox="0 0 760 360"></svg>';

  const width = options.width || 760;
  const height = options.height || 360;
  const fibers = analysis.fiberResults;
  const count = fibers.length;
  const metrics = analysis.metrics;
  const skew = analysis.skew;
  const verdict = analysis.verdict;

  // SVG Layout dimensions
  const ribbonX = 60;
  const ribbonY = 70;
  const ribbonW = width - 120;
  const ribbonH = 65;

  const chartX = 60;
  const chartY = 175;
  const chartW = width - 120;
  const chartH = 135;
  const maxDisplayLoss = 0.20; // 0.20 dB scale ceiling

  // Generate Ribbon Fiber Circles & Cladding Array
  let fibersSvg = '';
  const fiberSpacing = ribbonW / count;

  fibers.forEach((f, idx) => {
    const cx = ribbonX + (idx + 0.5) * fiberSpacing;
    const cy = ribbonY + ribbonH / 2;
    const coreR = 7;
    const cladR = 14;

    // Spliced fiber joint line showing micro-cleave angle skew
    const skewOffsetY = (idx - count / 2) * (skew.skewAngleDeg * 1.5);

    fibersSvg += `
      <g class="ribbon-fiber-group" data-fiber="${f.fiberIndex}">
        <!-- Cladding circle (125µm) -->
        <circle cx="${cx}" cy="${cy}" r="${cladR}" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5" />
        <!-- Color-coded primary acrylate buffer ring -->
        <circle cx="${cx}" cy="${cy}" r="${cladR + 3}" fill="none" stroke="${f.colorHex}" stroke-width="2.5" />
        <!-- Core circle (9µm) -->
        <circle cx="${cx}" cy="${cy + skewOffsetY}" r="${coreR}" fill="${f.colorHex}" />
        <!-- Fiber Index Number -->
        <text x="${cx}" y="${cy + cladR + 16}" fill="#475569" font-size="11" font-weight="700" text-anchor="middle">#${f.fiberIndex}</text>
      </g>
    `;
  });

  // Generate Per-Fiber Bar Chart
  let barsSvg = '';
  const barW = Math.min(28, (chartW / count) - 8);

  fibers.forEach((f, idx) => {
    const bx = chartX + idx * (chartW / count) + ((chartW / count) - barW) / 2;
    const clampedLoss = Math.min(maxDisplayLoss, f.totalLossDb);
    const barHeight = (clampedLoss / maxDisplayLoss) * (chartH - 25);
    const by = chartY + chartH - barHeight;

    let barColor = '#10b981'; // Green (<= 0.05)
    if (f.totalLossDb > 0.15) barColor = '#ef4444'; // Red
    else if (f.totalLossDb > 0.10) barColor = '#f59e0b'; // Amber
    else if (f.totalLossDb > 0.05) barColor = '#3b82f6'; // Blue

    barsSvg += `
      <g class="ribbon-chart-bar">
        <rect x="${bx}" y="${by}" width="${barW}" height="${barHeight}" rx="3" fill="${barColor}" opacity="0.9" />
        <!-- Value label on top of bar -->
        <text x="${bx + barW / 2}" y="${Math.max(chartY + 12, by - 4)}" fill="#334155" font-size="9.5" font-weight="700" text-anchor="middle">${f.totalLossDb.toFixed(3)}</text>
        <!-- X-axis Color Pill -->
        <rect x="${bx}" y="${chartY + chartH + 3}" width="${barW}" height="4" rx="2" fill="${f.colorHex}" />
      </g>
    `;
  });

  // Threshold Limit Lines (0.05 dB, 0.10 dB, 0.15 dB)
  const lineY05 = chartY + chartH - (0.05 / maxDisplayLoss) * (chartH - 25);
  const lineY10 = chartY + chartH - (0.10 / maxDisplayLoss) * (chartH - 25);
  const lineY15 = chartY + chartH - (0.15 / maxDisplayLoss) * (chartH - 25);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="ribbon-splice-svg" style="background:#f8fafc; border-radius:8px; font-family:system-ui, -apple-system, sans-serif;">
      <defs>
        <!-- Arc Plasma Heat Gradient across width -->
        <linearGradient id="plasmaHeatGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
          <stop offset="25%" stop-color="#8b5cf6" stop-opacity="0.45" />
          <stop offset="50%" stop-color="#ef4444" stop-opacity="0.7" />
          <stop offset="75%" stop-color="#8b5cf6" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.3" />
        </linearGradient>
        <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.5" />
        </pattern>
      </defs>

      <!-- Grid Background -->
      <rect width="${width}" height="${height}" fill="url(#gridPattern)" />

      <!-- Top Telemetry Ribbon HUD -->
      <rect x="15" y="12" width="${width - 30}" height="42" rx="6" fill="#1e293b" />
      <text x="30" y="37" fill="#f8fafc" font-size="13" font-weight="700">12-FIBER MASS RIBBON FUSION SPLICE MATRIX</text>
      
      <text x="370" y="28" fill="#94a3b8" font-size="9" font-weight="600">MEAN LOSS</text>
      <text x="370" y="44" fill="#38bdf8" font-size="13" font-weight="800">${metrics.meanLossDb.toFixed(3)} dB</text>

      <text x="460" y="28" fill="#94a3b8" font-size="9" font-weight="600">MAX CHANNEL</text>
      <text x="460" y="44" fill="${metrics.maxLossDb <= 0.10 ? '#4ade80' : '#f87171'}" font-size="13" font-weight="800">${metrics.maxLossDb.toFixed(3)} dB (#${metrics.maxLossFiberIndex})</text>

      <text x="565" y="28" fill="#94a3b8" font-size="9" font-weight="600">PITCH SKEW</text>
      <text x="565" y="44" fill="#fbbf24" font-size="13" font-weight="800">${skew.skewAngleDeg.toFixed(2)}° (${skew.cleaveLengthDiffUm.toFixed(1)}µm)</text>

      <!-- Verdict Badge -->
      <rect x="${width - 150}" y="19" width="125" height="28" rx="4" fill="${verdict.colorHex}" />
      <text x="${width - 87}" y="37" fill="#ffffff" font-size="10.5" font-weight="800" text-anchor="middle">${verdict.code}</text>

      <!-- Ribbon Chassis Backing -->
      <rect x="${ribbonX - 10}" y="${ribbonY - 5}" width="${ribbonW + 20}" height="${ribbonH + 10}" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
      
      <!-- Plasma Arc Discharge Glow Overlay -->
      <rect x="${ribbonX}" y="${ribbonY + 8}" width="${ribbonW}" height="${ribbonH - 16}" rx="4" fill="url(#plasmaHeatGlow)" opacity="0.65" />
      <text x="${ribbonX + ribbonW / 2}" y="${ribbonY + 14}" fill="#dc2626" font-size="9" font-weight="800" text-anchor="middle">▲ ELECTRIC PLASMA ARC DISCHARGE CORE AXIS ▲</text>

      <!-- 12 Fibers Array -->
      ${fibersSvg}

      <!-- Bar Chart Container -->
      <rect x="${chartX - 10}" y="${chartY - 12}" width="${chartW + 20}" height="${chartH + 34}" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
      
      <!-- Y-Axis Limit Lines -->
      <line x1="${chartX}" y1="${lineY05}" x2="${chartX + chartW}" y2="${lineY05}" stroke="#10b981" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${chartX + chartW + 2}" y="${lineY05 + 3}" fill="#10b981" font-size="9" font-weight="600">0.05 (Lab)</text>

      <line x1="${chartX}" y1="${lineY10}" x2="${chartX + chartW}" y2="${lineY10}" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3,3" />
      <text x="${chartX + chartW + 2}" y="${lineY10 + 3}" fill="#3b82f6" font-size="9" font-weight="600">0.10 (OSP)</text>

      <line x1="${chartX}" y1="${lineY15}" x2="${chartX + chartW}" y2="${lineY15}" stroke="#ef4444" stroke-width="1" stroke-dasharray="2,2" />
      <text x="${chartX + chartW + 2}" y="${lineY15 + 3}" fill="#ef4444" font-size="9" font-weight="700">0.15 Max</text>

      <!-- Chart Bars -->
      ${barsSvg}

      <!-- Chart Baseline -->
      <line x1="${chartX}" y1="${chartY + chartH}" x2="${chartX + chartW}" y2="${chartY + chartH}" stroke="#64748b" stroke-width="1.5" />
    </svg>
  `;
}

/**
 * Dual printable documents generator:
 * 1. Standard A4 Formal Accreditation Certificate
 * 2. 80mm Thermal POS field slip
 */
export function generateRibbonSpliceCertHtml(cert, options = {}) {
  if (!cert || !cert.analysis) return '<div class="alert alert-danger">Certificate data missing</div>';

  const format = options.format || 'a4';
  const analysis = cert.analysis;
  const metrics = analysis.metrics;
  const skew = analysis.skew;
  const verdict = analysis.verdict;
  const fibers = analysis.fiberResults;

  if (format === 'thermal') {
    return `
      <div class="thermal-receipt ribbon-splice-thermal" style="width:76mm; padding:3mm; font-family:monospace; font-size:11px; line-height:1.3; color:#000;">
        <div style="text-align:center; font-weight:bold; font-size:13px;">SHAHDARA FIBER NETWORKS</div>
        <div style="text-align:center; font-size:10px;">MASS RIBBON FUSION QA SLIP</div>
        <div style="text-align:center; margin:2mm 0; border-top:1px dashed #000; border-bottom:1px dashed #000; padding:1mm 0;">
          CERT: ${cert.id}<br>
          DATE: ${cert.createdAt.substring(0, 16).replace('T', ' ')} PKT
        </div>
        <div><strong>ROUTE:</strong> ${cert.route}</div>
        <div><strong>SPLICER:</strong> ${cert.splicerName}</div>
        <div><strong>TECH:</strong> ${cert.technicianName}</div>
        <div><strong>CHANNELS:</strong> 12 Fibers (TIA-598-D)</div>
        <div style="margin:2mm 0; border-top:1px dashed #000; padding-top:1mm;">
          <strong>12-FIBER CHANNEL LOSSES:</strong>
          <table style="width:100%; border-collapse:collapse; font-size:10px; margin-top:1mm;">
            <thead>
              <tr style="border-bottom:1px solid #000;">
                <th style="text-align:left;">#</th>
                <th style="text-align:left;">COLOR</th>
                <th style="text-align:right;">LOSS (dB)</th>
                <th style="text-align:right;">ST</th>
              </tr>
            </thead>
            <tbody>
              ${fibers.map(f => `
                <tr>
                  <td>${f.fiberIndex}</td>
                  <td>${f.color.substring(0, 4)}</td>
                  <td style="text-align:right;">${f.totalLossDb.toFixed(3)}</td>
                  <td style="text-align:right;">${f.status.substring(0, 4)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="border-top:1px dashed #000; margin:2mm 0; padding-top:1mm;">
          <strong>SUMMARY TELEMETRY:</strong><br>
          MEAN LOSS: ${metrics.meanLossDb.toFixed(3)} dB<br>
          MAX LOSS: ${metrics.maxLossDb.toFixed(3)} dB (#${metrics.maxLossFiberIndex})<br>
          MIN LOSS: ${metrics.minLossDb.toFixed(3)} dB<br>
          PITCH SKEW: ${skew.skewAngleDeg.toFixed(2)} deg (${skew.cleaveLengthDiffUm.toFixed(1)} um)<br>
          VERDICT: <strong>${verdict.code}</strong><br>
          ACTION: ${verdict.actionRequired}
        </div>
        <div style="text-align:center; margin-top:3mm; font-size:9px; border-top:1px dashed #000; padding-top:1mm;">
          Shahdara ISP Network Operations Center<br>
          Telcordia GR-765-CORE / ITU-T G.652.D
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="a4-cert-sheet ribbon-splice-a4" style="max-width:800px; margin:0 auto; padding:24px; font-family:system-ui, -apple-system, sans-serif; background:#fff; color:#1e293b; border:1px solid #e2e8f0; border-radius:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:16px; margin-bottom:20px;">
        <div>
          <h2 style="margin:0; font-size:22px; color:#0f172a;">SHAHDARA FIBER OPTIC METROLOGY LABORATORY</h2>
          <div style="font-size:12px; color:#64748b; font-weight:600; text-transform:uppercase;">Mass Ribbon Fusion Splice Pitch Skew & 12-Fiber Core Attenuation Certificate</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:15px; font-weight:800; color:#0284c7;">${cert.id}</div>
          <div style="font-size:11px; color:#64748b;">Standards: ITU-T G.650.1 / Telcordia GR-765-CORE</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; font-size:12.5px;">
        <div style="background:#f8fafc; padding:12px; border-radius:6px; border:1px solid #e2e8f0;">
          <h4 style="margin:0 0 8px 0; color:#334155; font-size:13px;">SPAN & HARDWARE SPECIFICATIONS</h4>
          <div><strong>Span / Route:</strong> ${cert.route}</div>
          <div><strong>Mass Splicer:</strong> ${cert.splicerName}</div>
          <div><strong>Wavelength:</strong> ${cert.wavelengthNm} nm (MFD: ${analysis.mfdUm} µm)</div>
          <div><strong>Nominal Pitch:</strong> ${analysis.pitchNominalUm.toFixed(1)} µm (Var: ${analysis.pitchVariationUm.toFixed(2)} µm)</div>
        </div>
        <div style="background:#f8fafc; padding:12px; border-radius:6px; border:1px solid #e2e8f0;">
          <h4 style="margin:0 0 8px 0; color:#334155; font-size:13px;">METROLOGY AUDIT PARTICULARS</h4>
          <div><strong>Technician:</strong> ${cert.technicianName}</div>
          <div><strong>Date & Time:</strong> ${cert.createdAt.substring(0, 19).replace('T', ' ')} PKT</div>
          <div><strong>Status Verdict:</strong> <span style="font-weight:800; color:${verdict.colorHex};">${verdict.label}</span></div>
          <div><strong>Action Required:</strong> <span style="font-weight:700;">${verdict.actionRequired}</span></div>
        </div>
      </div>

      <!-- KPI Summary Ribbon -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px;">
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:10px; text-align:center;">
          <div style="font-size:10px; color:#1e40af; font-weight:700;">MEAN ATTENUATION</div>
          <div style="font-size:18px; font-weight:800; color:#1d4ed8;">${metrics.meanLossDb.toFixed(3)} dB</div>
        </div>
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:10px; text-align:center;">
          <div style="font-size:10px; color:#166534; font-weight:700;">MAX CHANNEL LOSS</div>
          <div style="font-size:18px; font-weight:800; color:#15803d;">${metrics.maxLossDb.toFixed(3)} dB (#${metrics.maxLossFiberIndex})</div>
        </div>
        <div style="background:#fefce8; border:1px solid #fef08a; border-radius:6px; padding:10px; text-align:center;">
          <div style="font-size:10px; color:#854d0e; font-weight:700;">PITCH SKEW ANGLE</div>
          <div style="font-size:18px; font-weight:800; color:#a16207;">${skew.skewAngleDeg.toFixed(2)}° (${skew.cleaveLengthDiffUm.toFixed(1)}µm)</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:10px; text-align:center;">
          <div style="font-size:10px; color:#475569; font-weight:700;">LOSS SPREAD (Δα)</div>
          <div style="font-size:18px; font-weight:800; color:#334155;">${metrics.lossSpreadDb.toFixed(3)} dB</div>
        </div>
      </div>

      <!-- Vector Visualizer -->
      <div style="margin-bottom:20px;">
        ${renderRibbonSpliceQaSvg(analysis, { width: 750, height: 320 })}
      </div>

      <!-- 12-Channel Table -->
      <h4 style="margin:0 0 8px 0; color:#0f172a; font-size:13px;">TIA-598-D 12-FIBER INDIVIDUAL CHANNEL AUDIT TABLE</h4>
      <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:20px;">
        <thead>
          <tr style="background:#0f172a; color:#f8fafc;">
            <th style="padding:6px; text-align:center;">CH#</th>
            <th style="padding:6px; text-align:left;">Color</th>
            <th style="padding:6px; text-align:left;">Urdu</th>
            <th style="padding:6px; text-align:right;">Offset (µm)</th>
            <th style="padding:6px; text-align:right;">Cleave Tilt (°)</th>
            <th style="padding:6px; text-align:right;">Offset Loss</th>
            <th style="padding:6px; text-align:right;">Tilt Loss</th>
            <th style="padding:6px; text-align:right;">Thermal Loss</th>
            <th style="padding:6px; text-align:right;">Total Loss (dB)</th>
            <th style="padding:6px; text-align:center;">Verdict</th>
          </tr>
        </thead>
        <tbody>
          ${fibers.map((f, idx) => `
            <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom:1px solid #e2e8f0;">
              <td style="padding:5px; text-align:center; font-weight:700;">#${f.fiberIndex}</td>
              <td style="padding:5px;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${f.colorHex}; margin-right:4px;"></span>
                ${f.color}
              </td>
              <td style="padding:5px; font-family:sans-serif;">${f.colorUrdu}</td>
              <td style="padding:5px; text-align:right;">${f.offsetUm.toFixed(2)}</td>
              <td style="padding:5px; text-align:right;">${f.cleaveTiltDeg.toFixed(2)}°</td>
              <td style="padding:5px; text-align:right;">${f.offsetLossDb.toFixed(3)}</td>
              <td style="padding:5px; text-align:right;">${f.tiltLossDb.toFixed(3)}</td>
              <td style="padding:5px; text-align:right;">${f.thermalLossDb.toFixed(3)}</td>
              <td style="padding:5px; text-align:right; font-weight:700; color:${f.totalLossDb <= 0.10 ? '#166534' : '#991b1b'};">${f.totalLossDb.toFixed(3)}</td>
              <td style="padding:5px; text-align:center;"><span class="badge ${f.badgeClass}">${f.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Signatures -->
      <div style="display:flex; justify-content:space-between; margin-top:30px; padding-top:16px; border-top:1px solid #cbd5e1; font-size:11.5px;">
        <div style="text-align:center; width:200px;">
          <div style="border-bottom:1px solid #94a3b8; height:32px;"></div>
          <div style="margin-top:4px; font-weight:700;">Splicing Field Technician</div>
          <div style="color:#64748b;">${cert.technicianName}</div>
        </div>
        <div style="text-align:center; width:200px;">
          <div style="border-bottom:1px solid #94a3b8; height:32px;"></div>
          <div style="margin-top:4px; font-weight:700;">Outside Plant QA Lead</div>
          <div style="color:#64748b;">Shahdara Metrology Dept</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Formats bilingual WhatsApp message for dispatch to NOC or technician
 */
export function formatRibbonSpliceCertWhatsApp(cert) {
  if (!cert || !cert.analysis) return '';
  const m = cert.analysis.metrics;
  const s = cert.analysis.skew;
  const v = cert.analysis.verdict;

  return `🔬 *SHAHDARA FIBER NETWORKS — 12-FIBER MASS RIBBON FUSION QA CERTIFICATE*\n` +
    `📋 *Certificate ID:* ${cert.id}\n` +
    `📍 *Route / Span:* ${cert.route}\n` +
    `⚡ *Splicer:* ${cert.splicerName}\n` +
    `👷 *Technician:* ${cert.technicianName}\n` +
    `--------------------------------------\n` +
    `📊 *Mean Ribbon Loss:* ${m.meanLossDb.toFixed(3)} dB\n` +
    `📈 *Peak Channel Loss:* ${m.maxLossDb.toFixed(3)} dB (Fiber #${m.maxLossFiberIndex})\n` +
    `📐 *Ribbon Pitch Skew:* ${s.skewAngleDeg.toFixed(2)}° (ΔL: ${s.cleaveLengthDiffUm.toFixed(1)} µm)\n` +
    `⚖️ *Loss Spread (Δα):* ${m.lossSpreadDb.toFixed(3)} dB\n` +
    `--------------------------------------\n` +
    `🏁 *Verdict:* ${v.code}\n` +
    `📢 *Action:* ${v.actionRequired}\n` +
    `🇵🇰 *Urdu:* ${v.recommendationUrdu}\n` +
    `🌐 *Accreditation:* ITU-T G.650.1 / Telcordia GR-765-CORE`;
}

/**
 * Generates RFC-4180 compliant CSV export with UTF-8 BOM
 */
export function generateRibbonSpliceCertsCsv(certs = []) {
  const records = Array.isArray(certs) ? certs : [];
  const header = [
    'CertificateID',
    'CreatedAt',
    'Route',
    'Splicer',
    'Technician',
    'FiberCount',
    'WavelengthNm',
    'MeanLossDb',
    'MaxLossDb',
    'MaxLossFiberIndex',
    'MinLossDb',
    'PitchSkewDeg',
    'CleaveDeltaUm',
    'LossSpreadDb',
    'VerdictCode',
    'F1_Blue_Db',
    'F2_Orange_Db',
    'F3_Green_Db',
    'F4_Brown_Db',
    'F5_Slate_Db',
    'F6_White_Db',
    'F7_Red_Db',
    'F8_Black_Db',
    'F9_Yellow_Db',
    'F10_Violet_Db',
    'F11_Rose_Db',
    'F12_Aqua_Db'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map(c => {
    const a = c.analysis || {};
    const m = a.metrics || {};
    const s = a.skew || {};
    const v = a.verdict || {};
    const fibers = a.fiberResults || [];

    const fiberLossMap = {};
    fibers.forEach(f => {
      fiberLossMap[f.fiberIndex] = f.totalLossDb;
    });

    return [
      escapeCsv(c.id),
      escapeCsv(c.createdAt),
      escapeCsv(c.route),
      escapeCsv(c.splicerName),
      escapeCsv(c.technicianName),
      c.fiberCount || 12,
      c.wavelengthNm || 1310,
      m.meanLossDb !== undefined ? m.meanLossDb.toFixed(3) : '',
      m.maxLossDb !== undefined ? m.maxLossDb.toFixed(3) : '',
      m.maxLossFiberIndex || '',
      m.minLossDb !== undefined ? m.minLossDb.toFixed(3) : '',
      s.skewAngleDeg !== undefined ? s.skewAngleDeg.toFixed(3) : '',
      s.cleaveLengthDiffUm !== undefined ? s.cleaveLengthDiffUm.toFixed(2) : '',
      m.lossSpreadDb !== undefined ? m.lossSpreadDb.toFixed(3) : '',
      escapeCsv(v.code || c.status),
      fiberLossMap[1] !== undefined ? fiberLossMap[1].toFixed(3) : '',
      fiberLossMap[2] !== undefined ? fiberLossMap[2].toFixed(3) : '',
      fiberLossMap[3] !== undefined ? fiberLossMap[3].toFixed(3) : '',
      fiberLossMap[4] !== undefined ? fiberLossMap[4].toFixed(3) : '',
      fiberLossMap[5] !== undefined ? fiberLossMap[5].toFixed(3) : '',
      fiberLossMap[6] !== undefined ? fiberLossMap[6].toFixed(3) : '',
      fiberLossMap[7] !== undefined ? fiberLossMap[7].toFixed(3) : '',
      fiberLossMap[8] !== undefined ? fiberLossMap[8].toFixed(3) : '',
      fiberLossMap[9] !== undefined ? fiberLossMap[9].toFixed(3) : '',
      fiberLossMap[10] !== undefined ? fiberLossMap[10].toFixed(3) : '',
      fiberLossMap[11] !== undefined ? fiberLossMap[11].toFixed(3) : '',
      fiberLossMap[12] !== undefined ? fiberLossMap[12].toFixed(3) : ''
    ].join(',');
  });

  return '\uFEFF' + [header.join(','), ...rows].join('\r\n');
}

/**
 * UI Controller wiring modal dialog, live recalculation, historical table,
 * printable formats, and WhatsApp copy triggers.
 */
export function setupRibbonSpliceQaModal(options = {}) {
  const modal = document.getElementById('ribbonSpliceQaModal');
  if (!modal) return;

  const presetSelect = document.getElementById('ribbonSplicePresetSelect');
  const routeInput = document.getElementById('ribbonSpliceRouteInput');
  const splicerSelect = document.getElementById('ribbonSpliceSplicerSelect');
  const fiberCountSelect = document.getElementById('ribbonSpliceFiberCountSelect');
  const wavelengthSelect = document.getElementById('ribbonSpliceWavelengthSelect');
  const pitchVarInput = document.getElementById('ribbonSplicePitchVarInput');
  const cleaveDiffInput = document.getElementById('ribbonSpliceCleaveDiffInput');
  const arcBalanceInput = document.getElementById('ribbonSpliceArcBalanceInput');
  const techInput = document.getElementById('ribbonSpliceTechInput');
  const notesInput = document.getElementById('ribbonSpliceNotesInput');

  const svgContainer = document.getElementById('ribbonSpliceSvgContainer');
  const summaryBox = document.getElementById('ribbonSpliceSummaryBox');
  const tableBody = document.getElementById('ribbonSpliceTableBody');
  const saveBtn = document.getElementById('ribbonSpliceSaveBtn');
  const historyTbody = document.getElementById('ribbonSpliceHistoryTbody');
  const printA4Btn = document.getElementById('ribbonSplicePrintA4Btn');
  const printThermalBtn = document.getElementById('ribbonSplicePrintThermalBtn');
  const whatsappBtn = document.getElementById('ribbonSpliceWhatsAppBtn');
  const csvBtn = document.getElementById('ribbonSpliceCsvBtn');
  const closeBtn = document.getElementById('ribbonSpliceCloseBtn');
  const searchInput = document.getElementById('ribbonSpliceSearchInput');
  const statusFilter = document.getElementById('ribbonSpliceStatusFilter');

  let currentAnalysis = null;
  let activeCert = null;

  function recalculate() {
    const params = {
      route: routeInput ? routeInput.value : '',
      splicerId: splicerSelect ? splicerSelect.value : 'FUJIKURA_90R12',
      fiberCount: fiberCountSelect ? parseInt(fiberCountSelect.value, 10) : 12,
      wavelengthNm: wavelengthSelect ? parseInt(wavelengthSelect.value, 10) : 1310,
      pitchNominalUm: 250.0,
      pitchVariationUm: pitchVarInput ? parseFloat(pitchVarInput.value) || 1.0 : 1.0,
      cleaveLengthDiffUm: cleaveDiffInput ? parseFloat(cleaveDiffInput.value) || 2.0 : 2.0,
      arcBalanceFactor: arcBalanceInput ? parseFloat(arcBalanceInput.value) || 0.96 : 0.96
    };

    currentAnalysis = evaluateRibbonSpliceAnalysis(params);

    if (svgContainer) {
      svgContainer.innerHTML = renderRibbonSpliceQaSvg(currentAnalysis, { width: 720, height: 340 });
    }

    if (summaryBox) {
      const m = currentAnalysis.metrics;
      const s = currentAnalysis.skew;
      const v = currentAnalysis.verdict;
      summaryBox.innerHTML = `
        <div class="kpi-mini-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
          <div class="kpi-mini-item">
            <span class="kpi-mini-label">Mean Loss</span>
            <span class="kpi-mini-value" style="color:#0284c7;">${m.meanLossDb.toFixed(3)} dB</span>
          </div>
          <div class="kpi-mini-item">
            <span class="kpi-mini-label">Max Channel</span>
            <span class="kpi-mini-value" style="color:${m.maxLossDb <= 0.10 ? '#10b981' : '#ef4444'};">${m.maxLossDb.toFixed(3)} dB (#${m.maxLossFiberIndex})</span>
          </div>
          <div class="kpi-mini-item">
            <span class="kpi-mini-label">Pitch Skew</span>
            <span class="kpi-mini-value" style="color:#f59e0b;">${s.skewAngleDeg.toFixed(2)}°</span>
          </div>
          <div class="kpi-mini-item">
            <span class="kpi-mini-label">Verdict</span>
            <span class="badge ${v.badgeClass}">${v.code}</span>
          </div>
        </div>
      `;
    }

    if (tableBody) {
      tableBody.innerHTML = currentAnalysis.fiberResults.map(f => `
        <tr>
          <td style="font-weight:bold; text-align:center;">#${f.fiberIndex}</td>
          <td>
            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${f.colorHex}; margin-right:4px;"></span>
            ${f.color} (${f.colorUrdu})
          </td>
          <td style="text-align:right;">${f.offsetUm.toFixed(2)}</td>
          <td style="text-align:right;">${f.cleaveTiltDeg.toFixed(2)}°</td>
          <td style="text-align:right;">${f.thermalLossDb.toFixed(3)}</td>
          <td style="text-align:right; font-weight:bold; color:${f.totalLossDb <= 0.10 ? '#166534' : '#991b1b'};">${f.totalLossDb.toFixed(3)}</td>
          <td style="text-align:center;"><span class="badge ${f.badgeClass}">${f.status}</span></td>
        </tr>
      `).join('');
    }
  }

  function applyPreset(presetId) {
    const preset = SHAH_RIBBON_SPLICE_PRESETS[presetId];
    if (!preset) return;

    if (routeInput) routeInput.value = preset.route;
    if (splicerSelect) splicerSelect.value = preset.splicerId;
    if (fiberCountSelect) fiberCountSelect.value = preset.fiberCount;
    if (wavelengthSelect) wavelengthSelect.value = preset.wavelengthNm;
    if (pitchVarInput) pitchVarInput.value = preset.pitchVariationUm;
    if (cleaveDiffInput) cleaveDiffInput.value = preset.cleaveLengthDiffUm;
    if (arcBalanceInput) arcBalanceInput.value = preset.arcBalanceFactor;
    if (techInput) techInput.value = preset.technicianName;
    if (notesInput) notesInput.value = preset.notes;

    recalculate();
  }

  function renderHistory() {
    if (!historyTbody) return;
    const certs = getSavedRibbonSpliceCerts(options.state);
    const filter = {
      status: statusFilter ? statusFilter.value : '',
      searchQuery: searchInput ? searchInput.value : ''
    };
    const metrics = calculateRibbonSpliceMetrics(certs, filter);

    let displayCerts = certs;
    if (filter.status) displayCerts = displayCerts.filter(c => c.status === filter.status);
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      displayCerts = displayCerts.filter(c => 
        c.id.toLowerCase().includes(q) || 
        c.route.toLowerCase().includes(q) || 
        c.technicianName.toLowerCase().includes(q)
      );
    }

    if (displayCerts.length === 0) {
      historyTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:12px;">No ribbon fusion certificates recorded yet.</td></tr>';
      return;
    }

    historyTbody.innerHTML = displayCerts.map(c => `
      <tr>
        <td style="font-weight:bold; font-family:monospace;">${c.id}</td>
        <td>${c.route}</td>
        <td>${c.technicianName}</td>
        <td style="text-align:right;">${c.analysis && c.analysis.metrics ? c.analysis.metrics.meanLossDb.toFixed(3) : '-'} dB</td>
        <td style="text-align:center;"><span class="badge ${c.analysis && c.analysis.verdict ? c.analysis.verdict.badgeClass : 'badge-neutral'}">${c.status}</span></td>
        <td style="text-align:center;">
          <button class="btn btn-sm btn-ghost view-cert-btn" data-cert-id="${c.id}" title="Load & View">🔍</button>
        </td>
      </tr>
    `).join('');

    // Wire view buttons
    historyTbody.querySelectorAll('.view-cert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cert-id');
        const found = certs.find(x => x.id === id);
        if (found) {
          activeCert = found;
          if (routeInput) routeInput.value = found.route;
          if (techInput) techInput.value = found.technicianName;
          if (splicerSelect) splicerSelect.value = found.splicerId;
          if (wavelengthSelect) wavelengthSelect.value = found.wavelengthNm;
          if (notesInput) notesInput.value = found.notes || '';
          currentAnalysis = found.analysis;
          if (svgContainer) svgContainer.innerHTML = renderRibbonSpliceQaSvg(currentAnalysis);
        }
      });
    });
  }

  // Bind input change events
  [splicerSelect, fiberCountSelect, wavelengthSelect, pitchVarInput, cleaveDiffInput, arcBalanceInput, routeInput, techInput].forEach(el => {
    if (el) el.addEventListener('input', recalculate);
  });

  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => applyPreset(e.target.value));
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      try {
        const record = buildRibbonSpliceRecord({
          route: routeInput ? routeInput.value : 'Shahdara OSP Feeder',
          splicerId: splicerSelect ? splicerSelect.value : 'FUJIKURA_90R12',
          fiberCount: fiberCountSelect ? parseInt(fiberCountSelect.value, 10) : 12,
          wavelengthNm: wavelengthSelect ? parseInt(wavelengthSelect.value, 10) : 1310,
          pitchNominalUm: 250.0,
          pitchVariationUm: pitchVarInput ? parseFloat(pitchVarInput.value) || 1.0 : 1.0,
          cleaveLengthDiffUm: cleaveDiffInput ? parseFloat(cleaveDiffInput.value) || 2.0 : 2.0,
          arcBalanceFactor: arcBalanceInput ? parseFloat(arcBalanceInput.value) || 0.96 : 0.96,
          technicianName: techInput ? techInput.value : 'Sample Technician',
          notes: notesInput ? notesInput.value : ''
        }, options.state);

        saveRibbonSpliceCert(record, options.state);
        activeCert = record;
        renderHistory();
        alert('Mass Ribbon Fusion Splice Certificate ' + record.id + ' successfully recorded!');
      } catch (err) {
        alert('Save Error: ' + err.message);
      }
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const cert = activeCert || (currentAnalysis ? {
        id: 'RBN-PREVIEW',
        createdAt: new Date().toISOString(),
        route: routeInput ? routeInput.value : 'Shahdara ODF Span',
        splicerName: splicerSelect ? splicerSelect.options[splicerSelect.selectedIndex].text : 'Fujikura 90R12',
        technicianName: techInput ? techInput.value : 'Technician',
        analysis: currentAnalysis
      } : null);

      if (!cert) return alert('No analysis data to print.');
      const html = generateRibbonSpliceCertHtml(cert, { format: 'a4' });
      const w = window.open('', '_blank');
      if (w) {
        w.document.write('<!DOCTYPE html><html><head><title>' + cert.id + '</title></head><body>' + html + '</body></html>');
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
      }
    });
  }

  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const cert = activeCert || (currentAnalysis ? {
        id: 'RBN-PREVIEW',
        createdAt: new Date().toISOString(),
        route: routeInput ? routeInput.value : 'Shahdara ODF Span',
        splicerName: splicerSelect ? splicerSelect.options[splicerSelect.selectedIndex].text : 'Fujikura 90R12',
        technicianName: techInput ? techInput.value : 'Technician',
        analysis: currentAnalysis
      } : null);

      if (!cert) return alert('No analysis data to print.');
      const html = generateRibbonSpliceCertHtml(cert, { format: 'thermal' });
      const w = window.open('', '_blank', 'width=350,height=600');
      if (w) {
        w.document.write('<!DOCTYPE html><html><head><title>Thermal Slip</title></head><body>' + html + '</body></html>');
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
      }
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const cert = activeCert || (currentAnalysis ? {
        id: 'RBN-PREVIEW',
        createdAt: new Date().toISOString(),
        route: routeInput ? routeInput.value : 'Shahdara ODF Span',
        splicerName: splicerSelect ? splicerSelect.options[splicerSelect.selectedIndex].text : 'Fujikura 90R12',
        technicianName: techInput ? techInput.value : 'Technician',
        analysis: currentAnalysis
      } : null);

      if (!cert) return alert('No analysis data.');
      const text = formatRibbonSpliceCertWhatsApp(cert);
      if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          alert('WhatsApp Ribbon QA Dispatch copied to clipboard!\n\n' + text);
        }).catch(() => {
          prompt('Copy WhatsApp text:', text);
        });
      } else {
        prompt('Copy WhatsApp text:', text);
      }
    });
  }

  if (csvBtn) {
    csvBtn.addEventListener('click', () => {
      const certs = getSavedRibbonSpliceCerts(options.state);
      if (certs.length === 0) return alert('No saved certificates to export.');
      const csv = generateRibbonSpliceCertsCsv(certs);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Shahdara_Ribbon_Splice_QA_${new Date().toISOString().substring(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (searchInput) searchInput.addEventListener('input', renderHistory);
  if (statusFilter) statusFilter.addEventListener('change', renderHistory);
  if (closeBtn) closeBtn.addEventListener('click', () => modal.close());

  // Initialize
  applyPreset('PRESET_BARADARI_12F_FEEDER');
  renderHistory();
}
