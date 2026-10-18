/**
 * Shahdara ISP Billing & Network Operations - Optical Fiber Fast Mechanical Field-Installable Splice,
 * Index-Matching Gel Integrity & Cam-Lock Pull-Out Tensile Retention QA Suite
 * Standards: IEC 61754-4, IEC 61300-2-4, Telcordia GR-326-CORE Issue 4, ITU-T L.400 / L.12, TIA-568.3-D
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const FAST_CONNECTOR_QA_STORAGE_KEY = 'shahdara_fast_connector_qa_v1';

export const POLISH_TYPES = {
  'SC_APC': {
    id: 'SC_APC',
    name: 'SC/APC (8° Angled Physical Contact)',
    housingColor: '#16a34a',
    angleDeg: 8.0,
    targetReturnLossDb: 60.0,
    minReturnLossDb: 55.0,
    typicalInsertionLossDb: 0.25,
    description: 'Green housing, 8° oblique ferrule end-face ensuring ultra-high return loss (RL ≥ 60 dB) for GPON/XGS-PON video & data.'
  },
  'SC_UPC': {
    id: 'SC_UPC',
    name: 'SC/UPC (0° Ultra Physical Contact)',
    housingColor: '#0284c7',
    angleDeg: 0.0,
    targetReturnLossDb: 50.0,
    minReturnLossDb: 45.0,
    typicalInsertionLossDb: 0.25,
    description: 'Blue housing, flat dome radius end-face for digital GPON data drops with standard return loss (RL ≥ 50 dB).'
  }
};

export const FAST_CONNECTOR_MODELS = {
  'CORNING_UNICAM': {
    id: 'CORNING_UNICAM',
    name: 'Corning UniCam High-Performance Field Fast Connector',
    brand: 'Corning Optical Communications',
    category: 'Factory-Cleaved Optical Mechanical Splice',
    ratedTensileProofN: 50.0,
    typicalInsertionLossDb: 0.20,
    camMechanism: 'Precision Rotary Cam-Lock with Visual Continuity Indicator',
    gelType: 'High-Thermal Stability Optical Grade Synthetic Gel',
    maxOperatingTempC: 75.0,
    description: 'Factory-cleaved fiber stub, integrated V-groove cam lock, and patented continuity test system.'
  },
  'HUAWEI_FAST_SC': {
    id: 'HUAWEI_FAST_SC',
    name: 'Huawei Field Assembly Optical Quick Connector (FAST-SC)',
    brand: 'Huawei Technologies',
    category: 'Pre-Embedded Fiber Stub Drop Connector',
    ratedTensileProofN: 45.0,
    typicalInsertionLossDb: 0.25,
    camMechanism: 'Slide Push-Lock Wedge with Metal C-Clamp',
    gelType: 'Silicone High-Index Optical Gel',
    maxOperatingTempC: 70.0,
    description: 'Standard FTTH drop cable mechanical fast connector widely deployed in Shahdara GPON customer drops.'
  },
  'SUMITOMO_LYNX2': {
    id: 'SUMITOMO_LYNX2',
    name: 'Sumitomo Lynx2 Custom Field Splice-On Connector',
    brand: 'Sumitomo Electric (Japan)',
    category: 'Pre-Stubbed Micro-Splice Assembly',
    ratedTensileProofN: 60.0,
    typicalInsertionLossDb: 0.15,
    camMechanism: 'Micro-Mechanical Mechanical Splice Sleeve Lock',
    gelType: 'Fluorinated Index-Matching Matrix',
    maxOperatingTempC: 80.0,
    description: 'High-end telecommunications grade connector delivering fusion-like performance with mechanical clamp.'
  },
  'FIBRLOK_3M': {
    id: 'FIBRLOK_3M',
    name: '3M Fibrlok II Mechanical Splice Field Connector',
    brand: '3M Telecommunications',
    category: 'Metallic Element Cam-Lock Splice',
    ratedTensileProofN: 40.0,
    typicalInsertionLossDb: 0.30,
    camMechanism: 'Aluminum Alloy Resilient Element Wedge',
    gelType: 'Hydrocarbon Optical Matching Compound',
    maxOperatingTempC: 65.0,
    description: 'Durable metallic clamping element gripping both 125µm cladding and 250µm coating simultaneously.'
  },
  'GENERIC_OSP_FAST': {
    id: 'GENERIC_OSP_FAST',
    name: 'Generic Economy Field Quick Connector (Local OSP)',
    brand: 'Generic / Local Wholesale',
    category: 'Budget Plastic Cam-Wedge Connector',
    ratedTensileProofN: 30.0,
    typicalInsertionLossDb: 0.45,
    camMechanism: 'Plastic Snap-Ring Wedge',
    gelType: 'Standard Mineral Oil Index Gel',
    maxOperatingTempC: 55.0,
    description: 'Low-cost field connector vulnerable to thermal gel drying under hot Lahore summer rooftop environments.'
  }
};

export const INDEX_GEL_CONDITIONS = {
  'PRISTINE_FRESH': {
    id: 'PRISTINE_FRESH',
    name: 'Pristine Fresh Gel (Full Wetting, Zero Void)',
    refractiveIndex: 1.467,
    insertionLossPenaltyDb: 0.00,
    returnLossPenaltyDb: 0.0,
    scatterPenalty: 1.0,
    description: 'Fresh factory gel filling 100% of V-groove splice interface without micro-bubbles or void pockets.'
  },
  'MILD_BUBBLE': {
    id: 'MILD_BUBBLE',
    name: 'Mild Micro-Air Pocket / Partial Void',
    refractiveIndex: 1.450,
    insertionLossPenaltyDb: 0.12,
    returnLossPenaltyDb: -5.0,
    scatterPenalty: 1.5,
    description: 'Small trapped air bubble near fiber core junction causing minor Fresnel boundary reflection.'
  },
  'THERMAL_EVAPORATED': {
    id: 'THERMAL_EVAPORATED',
    name: 'Summer Rooftop Heat Evaporated / Gel Migration',
    refractiveIndex: 1.420,
    insertionLossPenaltyDb: 0.35,
    returnLossPenaltyDb: -14.0,
    scatterPenalty: 2.8,
    description: 'Extreme ambient heat (45-52°C) caused gel viscosity drop and capillary migration away from core axis.'
  },
  'CONTAMINATED_DUST': {
    id: 'CONTAMINATED_DUST',
    name: 'Airborne Dust Particulate Intrusion in V-Groove',
    refractiveIndex: 1.380,
    insertionLossPenaltyDb: 0.60,
    returnLossPenaltyDb: -20.0,
    scatterPenalty: 4.5,
    description: 'Lineman terminated connector in dusty outdoor wind, embedding silica micro-dust into gel matrix.'
  },
  'DRY_DEPLETED': {
    id: 'DRY_DEPLETED',
    name: 'Completely Dry / Depleted Index Gel (Air Boundary)',
    refractiveIndex: 1.000,
    insertionLossPenaltyDb: 1.20,
    returnLossPenaltyDb: -26.0,
    scatterPenalty: 8.0,
    description: 'Total lack of index gel resulting in glass-to-air Fresnel reflection (RL drops to 30-34 dB).'
  }
};

export const FAST_CONNECTOR_VERDICTS = {
  'CERTIFIED_PASS': {
    id: 'CERTIFIED_PASS',
    code: 'CERTIFIED_PASS',
    label: 'Certified Pass — Telcordia Tier-1 Subscriber Demarcation Grade',
    badgeClass: 'badge-pass-certified',
    statusClass: 'status-good',
    colorHex: '#10b981',
    actionRequired: 'COMMISSION SUBSCRIBER (APPROVED)',
    recommendationUrdu: 'مکمل تصدیق شدہ فاسٹ کنیکٹر — بہترین آپٹیکل سگنل اور کھنچاؤ برداشت کرنے کا حامل ہے',
    recommendation: 'Low insertion loss, pristine return loss, and full mechanical tensile clamp retention. Ready for active service.'
  },
  'STANDARD_PASS': {
    id: 'STANDARD_PASS',
    code: 'STANDARD_PASS',
    label: 'Standard Pass — Outside Plant Field Drop Installation Grade',
    badgeClass: 'badge-pass-standard',
    statusClass: 'status-good',
    colorHex: '#3b82f6',
    actionRequired: 'APPROVE FOR STANDARD SERVICE',
    recommendationUrdu: 'معیاری کنیکٹر — جی پون انٹرنیٹ سروس کے لیے مکمل موزوں اور منظور شدہ ہے',
    recommendation: 'Meets ITU-T L.400 / Telcordia GR-326 drop cable installation limits. Proceed with customer ONT turn-up.'
  },
  'CONDITIONAL_PASS': {
    id: 'CONDITIONAL_PASS',
    code: 'CONDITIONAL_PASS',
    label: 'Conditional Pass — Marginal Return Loss or Gel Degradation',
    badgeClass: 'badge-warning',
    statusClass: 'status-warning',
    colorHex: '#f59e0b',
    actionRequired: 'SCHEDULE ROUTINE INSPECTION IN 90 DAYS',
    recommendationUrdu: 'مشروط منظوری — ریٹرن لاس یا جیل قدرے کمزور ہے، موسم گرما میں باقاعدہ جانچ ضروری ہے',
    recommendation: 'Elevated backreflection or marginal tensile clamp. Acceptable for 25-50 Mbps, re-evaluate for Gigabit.'
  },
  'RE_TERMINATE_MANDATED': {
    id: 'RE_TERMINATE_MANDATED',
    code: 'RE_TERMINATE_MANDATED',
    label: 'Re-Terminate Mandated — Fiber Slippage, Void Gap or Severe Loss',
    badgeClass: 'badge-fail-rework',
    statusClass: 'status-danger',
    colorHex: '#ef4444',
    actionRequired: 'CUT DROP CABLE & TERMINATE FRESH CONNECTOR',
    recommendationUrdu: 'دوبارہ ٹرمینیشن ضروری — فائبر پھسل گیا ہے یا شدید سگنل ضائع ہو رہا ہے، نیا کنیکٹر لگائیں',
    recommendation: 'Exceeds 0.75 dB loss ceiling or cable slippage observed during tensile proof test. Cut and re-terminate.'
  }
};

export const SHAH_FAST_CONNECTOR_PRESETS = {
  'PRESET_BEGUM_KOT_DROP': {
    id: 'PRESET_BEGUM_KOT_DROP',
    name: 'Begum Kot Sub-FAT Drop — Huawei FAST-SC/APC (Certified Optimal)',
    customerName: 'Muhammad Arshad (Begum Kot #142)',
    route: 'FAT-BK-04 Port 06 to Subscriber ONT Rooftop Demarcation',
    connectorModelId: 'HUAWEI_FAST_SC',
    polishTypeId: 'SC_APC',
    gelConditionId: 'PRISTINE_FRESH',
    fiberGapUm: 0.8,
    angularMismatchDeg: 0.35,
    tensileLoadN: 44.0,
    slippageMm: 0.0,
    technicianName: 'Muhammad Rizwan (Senior Lineman)',
    notes: 'Terminated with precision 10mm cleaver guide. Optimal cam-lock clamping onto 2x3mm drop cable.'
  },
  'PRESET_VANDALA_HEAT_DRIFT': {
    id: 'PRESET_VANDALA_HEAT_DRIFT',
    name: 'Vandala Road Rooftop Drop — Generic Fast Connector (Summer Heat Gel Drift)',
    customerName: 'Khurram Shehzad (Vandala Road #58)',
    route: 'Splitter FAT-VR-09 to Sunny Rooftop ONT Demarcation Box',
    connectorModelId: 'GENERIC_OSP_FAST',
    polishTypeId: 'SC_APC',
    gelConditionId: 'THERMAL_EVAPORATED',
    fiberGapUm: 2.2,
    angularMismatchDeg: 0.85,
    tensileLoadN: 28.0,
    slippageMm: 0.15,
    technicianName: 'Tariq Mehmood (Field Tech)',
    notes: 'Exposed black PVC conduit heated to 49°C on galvanized tin roof. Index gel thinned out causing return loss degradation.'
  },
  'PRESET_RAVI_SIPHON_PULLOUT': {
    id: 'PRESET_RAVI_SIPHON_PULLOUT',
    name: 'Ravi Siphon River Crossing Drop — Cam-Lock Clamp Fiber Slippage',
    customerName: 'Haji Aslam (River Edge Dairy Farm)',
    route: 'Ravi Siphon Feeder Pole #14 Aerial Span to Farm Demarcation',
    connectorModelId: 'GENERIC_OSP_FAST',
    polishTypeId: 'SC_UPC',
    gelConditionId: 'CONTAMINATED_DUST',
    fiberGapUm: 4.8,
    angularMismatchDeg: 1.40,
    tensileLoadN: 18.0,
    slippageMm: 0.85,
    technicianName: 'Khurram Shahzad (Lineman)',
    notes: 'Strong riverbank monsoon wind tension pulled drop fiber out of cam lock wedge. Cable slipped 0.85mm. Critical failure.'
  },
  'PRESET_BARADARI_COMMERCIAL_ONT': {
    id: 'PRESET_BARADARI_COMMERCIAL_ONT',
    name: 'Baradari Commercial Plaza — Corning UniCam SC/APC 10G Demarcation',
    customerName: 'Al-Madina Commercial Bank (Shahdara Branch)',
    route: 'Central ODF Feeder to Commercial Server Room Rack #02',
    connectorModelId: 'CORNING_UNICAM',
    polishTypeId: 'SC_APC',
    gelConditionId: 'PRISTINE_FRESH',
    fiberGapUm: 0.4,
    angularMismatchDeg: 0.20,
    tensileLoadN: 52.0,
    slippageMm: 0.0,
    technicianName: 'Zubair Ahmad (Quality Lead)',
    notes: 'UniCam installation tool used with live optical continuity LED confirmation. Pristine lab-grade termination.'
  },
  'PRESET_JIA_MUSA_RESIDENTIAL': {
    id: 'PRESET_JIA_MUSA_RESIDENTIAL',
    name: 'Jia Musa Main Market Drop — 3M Fibrlok II Mechanical Splice',
    customerName: 'Nasir Iqbal (Jia Musa #89)',
    route: 'FAT-JM-02 Port 03 to Residence Ground Floor Router',
    connectorModelId: 'FIBRLOK_3M',
    polishTypeId: 'SC_APC',
    gelConditionId: 'MILD_BUBBLE',
    fiberGapUm: 1.4,
    angularMismatchDeg: 0.55,
    tensileLoadN: 38.0,
    slippageMm: 0.05,
    technicianName: 'Arshad Ali (Field Tech)',
    notes: '3M aluminum clamp securely engaged. Minor micro-void in gel resulting in standard pass for GPON 30 Mbps tier.'
  }
};

/**
 * Calculates Fresnel backreflection return loss in dB
 * Formula: R = ((n1 - n2) / (n1 + n2))^2
 * Return Loss = -10 * log10(R) + APC_tilt_bonus + gelPenalty
 */
export function calculateFresnelReturnLoss(nFiber = 1.467, nGel = 1.467, isApc = true, gelConditionPenaltyDb = 0.0) {
  const n1 = Math.max(1.0, parseFloat(nFiber) || 1.467);
  const n2 = Math.max(1.0, parseFloat(nGel) || 1.467);
  const penalty = parseFloat(gelConditionPenaltyDb) || 0.0;

  let baseRl = 0.0;
  if (Math.abs(n1 - n2) < 0.001) {
    baseRl = isApc ? 65.0 : 54.0;
  } else {
    const rFresnel = Math.pow((n1 - n2) / (n1 + n2), 2);
    baseRl = -10 * Math.log10(Math.max(1e-7, rFresnel));
    if (isApc) {
      // 8° APC oblique angle deflects reflected rays out of fiber core, adding ~18-20 dB RL bonus
      baseRl += 18.5;
    }
  }

  const finalRl = Math.min(70.0, Math.max(25.0, baseRl + penalty));
  return Math.round(finalRl * 10) / 10;
}

/**
 * Calculates mechanical index-gel splice insertion loss
 * Formula: IL = baseline + gapLoss + angularLoss + gelPenalty
 */
export function calculateMechanicalSpliceLoss(gapUm = 1.0, angularMismatchDeg = 0.4, gelPenaltyDb = 0.0, baselineModelLossDb = 0.20) {
  const gap = Math.max(0, parseFloat(gapUm) || 0.0);
  const ang = Math.max(0, parseFloat(angularMismatchDeg) || 0.0);
  const gelPen = Math.max(0, parseFloat(gelPenaltyDb) || 0.0);
  const base = Math.max(0.05, parseFloat(baselineModelLossDb) || 0.20);

  // Longitudinal gap loss: ~0.045 dB per µm of separation in gel
  const gapLoss = gap * 0.045;

  // Angular mismatch loss across mechanical stub: ~0.14 dB per degree
  const angularLoss = ang * 0.14;

  const totalLoss = base * 0.5 + gapLoss + angularLoss + gelPen;
  return Math.round(totalLoss * 1000) / 1000;
}

/**
 * Evaluates comprehensive Fast Connector mechanical splice & tensile retention QA analysis
 */
export function evaluateFastConnectorQa(params = {}) {
  const modelId = params.connectorModelId || 'HUAWEI_FAST_SC';
  const model = FAST_CONNECTOR_MODELS[modelId] || FAST_CONNECTOR_MODELS['HUAWEI_FAST_SC'];
  const polishId = params.polishTypeId || 'SC_APC';
  const polish = POLISH_TYPES[polishId] || POLISH_TYPES['SC_APC'];
  const isApc = polish.angleDeg > 0;

  const gelId = params.gelConditionId || 'PRISTINE_FRESH';
  const gel = INDEX_GEL_CONDITIONS[gelId] || INDEX_GEL_CONDITIONS['PRISTINE_FRESH'];

  const gapUm = parseFloat(params.fiberGapUm) !== undefined && !isNaN(parseFloat(params.fiberGapUm)) ? parseFloat(params.fiberGapUm) : 1.0;
  const angularMismatchDeg = parseFloat(params.angularMismatchDeg) !== undefined && !isNaN(parseFloat(params.angularMismatchDeg)) ? parseFloat(params.angularMismatchDeg) : 0.4;
  const tensileLoadN = parseFloat(params.tensileLoadN) !== undefined && !isNaN(parseFloat(params.tensileLoadN)) ? parseFloat(params.tensileLoadN) : model.ratedTensileProofN;
  const slippageMm = parseFloat(params.slippageMm) !== undefined && !isNaN(parseFloat(params.slippageMm)) ? parseFloat(params.slippageMm) : 0.0;

  // Compute Optical Insertion Loss
  const insertionLossDb = calculateMechanicalSpliceLoss(gapUm, angularMismatchDeg, gel.insertionLossPenaltyDb, model.typicalInsertionLossDb);

  // Compute Optical Return Loss
  const returnLossDb = calculateFresnelReturnLoss(1.467, gel.refractiveIndex, isApc, gel.returnLossPenaltyDb);

  // Mechanical Tensile Retention Safety Margin
  const tensileRatio = Math.round((tensileLoadN / model.ratedTensileProofN) * 1000) / 10;
  const isSlippageDetected = slippageMm > 0.10;

  // Verdict Evaluation
  let verdictKey = 'STANDARD_PASS';
  if (insertionLossDb <= 0.35 && returnLossDb >= (isApc ? 58.0 : 50.0) && tensileLoadN >= 40.0 && slippageMm <= 0.05) {
    verdictKey = 'CERTIFIED_PASS';
  } else if (insertionLossDb <= 0.50 && returnLossDb >= (isApc ? 48.0 : 42.0) && tensileLoadN >= 30.0 && slippageMm <= 0.15) {
    verdictKey = 'STANDARD_PASS';
  } else if (insertionLossDb <= 0.75 && returnLossDb >= 38.0 && tensileLoadN >= 20.0 && slippageMm <= 0.30) {
    verdictKey = 'CONDITIONAL_PASS';
  } else {
    verdictKey = 'RE_TERMINATE_MANDATED';
  }

  const verdict = FAST_CONNECTOR_VERDICTS[verdictKey];

  return {
    model,
    polish,
    gel,
    gapUm: Math.round(gapUm * 100) / 100,
    angularMismatchDeg: Math.round(angularMismatchDeg * 100) / 100,
    tensileLoadN: Math.round(tensileLoadN * 10) / 10,
    slippageMm: Math.round(slippageMm * 100) / 100,
    isSlippageDetected,
    tensileRatio,
    insertionLossDb,
    returnLossDb,
    verdict
  };
}

/**
 * Validates fast connector certification input parameters
 */
export function validateFastConnectorInput(data = {}) {
  const errors = [];

  if (!data.customerName || typeof data.customerName !== 'string' || data.customerName.trim().length < 2) {
    errors.push('Subscriber name is required (min 2 chars).');
  }

  if (!data.route || typeof data.route !== 'string' || data.route.trim().length < 3) {
    errors.push('Route or FAT port location is required (min 3 chars).');
  }

  if (!data.technicianName || typeof data.technicianName !== 'string' || data.technicianName.trim().length < 2) {
    errors.push('Technician name is required (min 2 chars).');
  }

  const gap = parseFloat(data.fiberGapUm);
  if (isNaN(gap) || gap < 0 || gap > 25.0) {
    errors.push('Fiber gap spacing must be between 0.0 and 25.0 µm.');
  }

  const ang = parseFloat(data.angularMismatchDeg);
  if (isNaN(ang) || ang < 0 || ang > 10.0) {
    errors.push('Cleave angular mismatch must be between 0.0° and 10.0°.');
  }

  const tensile = parseFloat(data.tensileLoadN);
  if (isNaN(tensile) || tensile < 0 || tensile > 150.0) {
    errors.push('Tensile proof load must be between 0.0 and 150.0 N.');
  }

  const slip = parseFloat(data.slippageMm);
  if (isNaN(slip) || slip < 0 || slip > 10.0) {
    errors.push('Slippage displacement must be between 0.0 and 10.0 mm.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generates an immutable, sequentially tracked Fast Connector QA record
 */
export function buildFastConnectorRecord(data = {}, state = {}) {
  const validation = validateFastConnectorInput(data);
  if (!validation.isValid) {
    throw new Error('Validation failed: ' + validation.errors.join('; '));
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Sequence ID: FST-YYYYMM-XXXX
  const existingCerts = getSavedFastConnectorCerts(state);
  const sequenceNum = existingCerts.length + 1;
  const certId = `FST-${year}${month}-${String(sequenceNum).padStart(4, '0')}`;

  const analysis = evaluateFastConnectorQa({
    connectorModelId: data.connectorModelId || 'HUAWEI_FAST_SC',
    polishTypeId: data.polishTypeId || 'SC_APC',
    gelConditionId: data.gelConditionId || 'PRISTINE_FRESH',
    fiberGapUm: data.fiberGapUm || 1.0,
    angularMismatchDeg: data.angularMismatchDeg || 0.4,
    tensileLoadN: data.tensileLoadN || 45.0,
    slippageMm: data.slippageMm || 0.0
  });

  return {
    id: certId,
    createdAt: now.toISOString(),
    customerName: data.customerName.trim(),
    route: data.route.trim(),
    technicianName: data.technicianName.trim(),
    connectorModelId: analysis.model.id,
    connectorModelName: analysis.model.name,
    polishTypeId: analysis.polish.id,
    polishTypeName: analysis.polish.name,
    gelConditionId: analysis.gel.id,
    gelConditionName: analysis.gel.name,
    notes: data.notes ? data.notes.trim() : '',
    analysis,
    status: analysis.verdict.id
  };
}

/**
 * LocalStorage persistence handlers with safe fallbacks
 */
export function getSavedFastConnectorCerts(state = {}) {
  if (state && Array.isArray(state.fastConnectorCerts)) {
    return state.fastConnectorCerts;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(FAST_CONNECTOR_QA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
  }
  return [];
}

export function saveFastConnectorCert(cert, state = {}) {
  if (!cert || !cert.id) throw new Error('Invalid fast connector certificate record.');
  const existing = getSavedFastConnectorCerts(state);
  const updated = [cert, ...existing.filter(c => c.id !== cert.id)];

  if (state && typeof state === 'object') {
    state.fastConnectorCerts = updated;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(FAST_CONNECTOR_QA_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage fallback
    }
  }
  return updated;
}

export function updateFastConnectorCertStatus(certId, newStatus, state = {}) {
  const existing = getSavedFastConnectorCerts(state);
  const updated = existing.map(c => {
    if (c.id === certId) {
      return { ...c, status: newStatus, updatedAt: new Date().toISOString() };
    }
    return c;
  });
  if (state && typeof state === 'object') {
    state.fastConnectorCerts = updated;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(FAST_CONNECTOR_QA_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage fallback
    }
  }
  return updated;
}

export function clearFastConnectorCerts(state = {}) {
  if (state && typeof state === 'object') {
    state.fastConnectorCerts = [];
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(FAST_CONNECTOR_QA_STORAGE_KEY);
    } catch {
      // Storage fallback
    }
  }
  return [];
}

/**
 * Aggregates high-level Fast Connector QA KPIs
 */
export function calculateFastConnectorMetrics(certs = [], filterOptions = {}) {
  let filtered = Array.isArray(certs) ? certs : [];

  if (filterOptions.status) {
    filtered = filtered.filter(c => c.status === filterOptions.status);
  }
  if (filterOptions.searchQuery) {
    const q = filterOptions.searchQuery.toLowerCase().trim();
    filtered = filtered.filter(c => 
      c.id.toLowerCase().includes(q) ||
      c.customerName.toLowerCase().includes(q) ||
      c.route.toLowerCase().includes(q) ||
      c.technicianName.toLowerCase().includes(q)
    );
  }

  const total = filtered.length;
  let certifiedPass = 0;
  let standardPass = 0;
  let conditionalPass = 0;
  let reTerminateMandated = 0;
  let sumInsertionLoss = 0.0;
  let sumReturnLoss = 0.0;

  filtered.forEach(c => {
    if (c.status === 'CERTIFIED_PASS') certifiedPass++;
    else if (c.status === 'STANDARD_PASS') standardPass++;
    else if (c.status === 'CONDITIONAL_PASS') conditionalPass++;
    else if (c.status === 'RE_TERMINATE_MANDATED') reTerminateMandated++;

    if (c.analysis) {
      sumInsertionLoss += c.analysis.insertionLossDb || 0;
      sumReturnLoss += c.analysis.returnLossDb || 0;
    }
  });

  const avgInsertionLossDb = total > 0 ? Math.round((sumInsertionLoss / total) * 1000) / 1000 : 0.00;
  const avgReturnLossDb = total > 0 ? Math.round((sumReturnLoss / total) * 10) / 10 : 0.0;
  const passRatePercent = total > 0 ? Math.round(((certifiedPass + standardPass) / total) * 1000) / 10 : 100.0;

  return {
    total,
    certifiedPass,
    standardPass,
    conditionalPass,
    reTerminateMandated,
    passRatePercent,
    avgInsertionLossDb,
    avgReturnLossDb
  };
}

/**
 * Pure-vector SVG visualizer displaying longitudinal mechanical splice cutaway,
 * index-matching gel cavity, cam-lock wedge, drop fiber, and tensile pull indicator.
 */
export function renderFastConnectorQaSvg(analysis, options = {}) {
  if (!analysis) return '<svg viewBox="0 0 740 320"></svg>';

  const width = options.width || 740;
  const height = options.height || 320;
  const model = analysis.model;
  const polish = analysis.polish;
  const gel = analysis.gel;
  const verdict = analysis.verdict;

  // Colors
  const housingColor = polish.housingColor;
  const gelColor = gel.id === 'PRISTINE_FRESH' ? '#38bdf8' :
                   gel.id === 'MILD_BUBBLE' ? '#f59e0b' :
                   gel.id === 'THERMAL_EVAPORATED' ? '#ea580c' :
                   gel.id === 'CONTAMINATED_DUST' ? '#78716c' : '#dc2626';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="fast-connector-svg" style="background:#0f172a; border-radius:8px; font-family:system-ui, -apple-system, sans-serif;">
      <defs>
        <linearGradient id="ferruleCeramicGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="50%" stop-color="#e2e8f0" />
          <stop offset="100%" stop-color="#cbd5e1" />
        </linearGradient>
        <linearGradient id="bodyPlasticGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${housingColor}" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <pattern id="diagonalHatch" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="#475569" stroke-width="0.8" />
        </pattern>
      </defs>

      <!-- Top HUD Telemetry Ribbon -->
      <rect x="15" y="12" width="${width - 30}" height="42" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1" />
      <text x="30" y="37" fill="#f8fafc" font-size="12" font-weight="700">FAST CONNECTOR MECHANICAL SPLICE &amp; CAM RETENTION METROLOGY</text>

      <text x="440" y="27" fill="#94a3b8" font-size="9" font-weight="600">INSERTION LOSS</text>
      <text x="440" y="44" fill="${analysis.insertionLossDb <= 0.35 ? '#4ade80' : '#f87171'}" font-size="13" font-weight="800">${analysis.insertionLossDb.toFixed(3)} dB</text>

      <text x="535" y="27" fill="#94a3b8" font-size="9" font-weight="600">RETURN LOSS</text>
      <text x="535" y="44" fill="#38bdf8" font-size="13" font-weight="800">${analysis.returnLossDb.toFixed(1)} dB</text>

      <!-- Verdict Badge -->
      <rect x="${width - 135}" y="19" width="115" height="28" rx="4" fill="${verdict.colorHex}" />
      <text x="${width - 77}" y="37" fill="#ffffff" font-size="10" font-weight="800" text-anchor="middle">${verdict.code.substring(0, 15)}</text>

      <!-- Main Cutaway Illustration (Y: 75 to 260) -->
      <!-- Outer Plastic Body Frame -->
      <rect x="50" y="90" width="560" height="150" rx="6" fill="url(#diagonalHatch)" stroke="#334155" stroke-width="1.5" />
      <rect x="50" y="90" width="110" height="150" rx="4" fill="${housingColor}" opacity="0.85" />
      <text x="105" y="165" fill="#ffffff" font-size="11" font-weight="800" text-anchor="middle">${polish.id}</text>

      <!-- Ceramic Ferrule (Left 50 to 140) -->
      <rect x="55" y="130" width="95" height="70" rx="3" fill="url(#ferruleCeramicGrad)" stroke="#94a3b8" stroke-width="1.5" />
      <text x="102" y="170" fill="#334155" font-size="9" font-weight="700" text-anchor="middle">Zirconia Ferrule</text>

      <!-- 8° APC End-face Angle indicator if APC -->
      ${polish.angleDeg > 0 ? `
        <polygon points="55,130 50,165 55,200" fill="#10b981" />
        <text x="35" y="168" fill="#10b981" font-size="9" font-weight="800" text-anchor="end">8° APC</text>
      ` : `
        <line x1="55" y1="130" x2="55" y2="200" stroke="#0284c7" stroke-width="3" />
        <text x="35" y="168" fill="#0284c7" font-size="9" font-weight="800" text-anchor="end">0° UPC</text>
      `}

      <!-- Factory Optical Fiber Stub (Embedded inside ferrule to V-groove) -->
      <rect x="55" y="162" width="170" height="6" fill="#e2e8f0" stroke="#64748b" stroke-width="0.5" />
      <line x1="55" y1="165" x2="225" y2="165" stroke="#38bdf8" stroke-width="2" />
      <text x="175" y="156" fill="#94a3b8" font-size="8.5" text-anchor="middle">Factory Stub</text>

      <!-- V-Groove Mechanical Splice Alignment Chamber (220 to 320) -->
      <rect x="215" y="125" width="105" height="80" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="1.5" />
      
      <!-- Index-Matching Gel Cavity -->
      <rect x="220" y="145" width="95" height="40" rx="3" fill="${gelColor}" opacity="0.55" />
      <text x="267" y="140" fill="${gelColor}" font-size="9" font-weight="700" text-anchor="middle">Index Gel V-Groove</text>
      <text x="267" y="170" fill="#f8fafc" font-size="8" font-weight="600" text-anchor="middle">Gap: ${analysis.gapUm} µm</text>

      <!-- Cleave Face Gap Splice Point Marker -->
      <line x1="267" y1="145" x2="267" y2="185" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="2,2" />

      <!-- Field Drop Optical Fiber (Enters from Right) -->
      <rect x="268" y="162" width="340" height="6" fill="#e2e8f0" stroke="#64748b" stroke-width="0.5" />
      <line x1="268" y1="165" x2="608" y2="165" stroke="#38bdf8" stroke-width="2" />

      <!-- Cam-Lock Clamping Wedge (360 to 450) -->
      <rect x="350" y="110" width="100" height="40" rx="3" fill="#f59e0b" stroke="#d97706" stroke-width="1.5" />
      <text x="400" y="133" fill="#1e293b" font-size="9" font-weight="800" text-anchor="middle">CAM-LOCK WEDGE</text>
      <!-- Clamping force arrows -->
      <path d="M 400 152 L 400 160" stroke="#f59e0b" stroke-width="2.5" marker-end="url(#arrow)" />
      
      <!-- Drop Cable Outer PVC Jacket & Strength Member Clamp (470 to 600) -->
      <rect x="470" y="140" width="140" height="50" rx="4" fill="#020617" stroke="#475569" stroke-width="1.5" />
      <text x="540" y="168" fill="#94a3b8" font-size="8.5" text-anchor="middle">Drop Cable Clamp</text>

      <!-- Mechanical Tensile Proof Pull Force Indicator (Right side arrow) -->
      <g transform="translate(620, 165)">
        <line x1="0" y1="0" x2="60" y2="0" stroke="#10b981" stroke-width="3" />
        <polygon points="65,0 52,-5 52,5" fill="#10b981" />
        <text x="30" y="-8" fill="#10b981" font-size="10" font-weight="800" text-anchor="middle">${analysis.tensileLoadN} N</text>
        <text x="30" y="16" fill="${analysis.slippageMm > 0.1 ? '#ef4444' : '#94a3b8'}" font-size="8.5" font-weight="700" text-anchor="middle">
          Slip: ${analysis.slippageMm}mm
        </text>
      </g>

      <!-- Bottom Status & Standards Footer Bar -->
      <rect x="15" y="270" width="${width - 30}" height="38" rx="6" fill="#1e293b" />
      <text x="30" y="293" fill="#cbd5e1" font-size="10.5">
        <strong>Model:</strong> ${model.name} &nbsp;|&nbsp; 
        <strong>Gel:</strong> ${gel.name} &nbsp;|&nbsp;
        <strong>Tensile Safety Margin:</strong> ${analysis.tensileRatio}%
      </text>
      <text x="${width - 30}" y="293" fill="#94a3b8" font-size="9.5" text-anchor="end">IEC 61754-4 · IEC 61300-2-4 · Telcordia GR-326-CORE</text>
    </svg>
  `;
}

/**
 * Dual printable documents generator:
 * 1. Standard A4 Formal Accreditation Certificate
 * 2. 80mm Thermal POS field slip
 */
export function generateFastConnectorCertHtml(cert, options = {}) {
  if (!cert || !cert.analysis) return '<div class="alert alert-danger">Certificate data missing</div>';

  const format = options.format || 'a4';
  const a = cert.analysis;
  const m = a.model;
  const p = a.polish;
  const g = a.gel;
  const v = a.verdict;

  if (format === 'thermal') {
    return `
      <div class="thermal-receipt fast-connector-thermal" style="width:76mm; padding:3mm; font-family:monospace; font-size:11px; line-height:1.3; color:#000;">
        <div style="text-align:center; font-weight:bold; font-size:13px;">SHAHDARA FIBER NETWORKS</div>
        <div style="text-align:center; font-size:10px;">FIELD FAST CONNECTOR QA SLIP</div>
        <div style="text-align:center; margin:2mm 0; border-top:1px dashed #000; border-bottom:1px dashed #000; padding:1mm 0;">
          CERT: ${cert.id}<br>
          DATE: ${cert.createdAt.substring(0, 16).replace('T', ' ')} PKT
        </div>
        <div><strong>SUBSCRIBER:</strong> ${cert.customerName}</div>
        <div><strong>ROUTE:</strong> ${cert.route}</div>
        <div><strong>CONNECTOR:</strong> ${cert.connectorModelName}</div>
        <div><strong>POLISH:</strong> ${cert.polishTypeName}</div>
        <div><strong>TECH:</strong> ${cert.technicianName}</div>
        <div style="margin:2mm 0; border-top:1px dashed #000; padding-top:1mm;">
          <strong>METROLOGY READINGS:</strong><br>
          INSERTION LOSS: ${a.insertionLossDb.toFixed(3)} dB (Max 0.50)<br>
          RETURN LOSS: ${a.returnLossDb.toFixed(1)} dB (Min ${p.minReturnLossDb})<br>
          GEL STATUS: ${g.name}<br>
          TENSILE PROOF: ${a.tensileLoadN.toFixed(1)} N (Rated ${m.ratedTensileProofN}N)<br>
          FIBER SLIPPAGE: ${a.slippageMm.toFixed(2)} mm
        </div>
        <div style="border-top:1px dashed #000; margin:2mm 0; padding-top:1mm;">
          VERDICT: <strong>${v.code}</strong><br>
          ACTION: ${v.actionRequired}<br>
          URDU: ${v.recommendationUrdu}
        </div>
        <div style="text-align:center; margin-top:3mm; font-size:9px; border-top:1px dashed #000; padding-top:1mm;">
          Shahdara ISP Network Operations Center<br>
          IEC 61754-4 / Telcordia GR-326-CORE
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="a4-cert-sheet fast-connector-a4" style="max-width:800px; margin:0 auto; padding:24px; font-family:system-ui, -apple-system, sans-serif; background:#fff; color:#1e293b; border:1px solid #e2e8f0; border-radius:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:16px; margin-bottom:20px;">
        <div>
          <h2 style="margin:0; font-size:22px; color:#0f172a;">SHAHDARA FIBER OPTIC METROLOGY LABORATORY</h2>
          <div style="font-size:12px; color:#64748b; font-weight:600; text-transform:uppercase;">Field Fast Mechanical Connector &amp; Cam-Lock Tensile Retention Certificate</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:15px; font-weight:800; color:#0284c7;">${cert.id}</div>
          <div style="font-size:11px; color:#64748b;">Standards: IEC 61754-4 / Telcordia GR-326-CORE</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; font-size:12.5px;">
        <div style="background:#f8fafc; padding:12px; border-radius:6px; border:1px solid #e2e8f0;">
          <h4 style="margin:0 0 8px 0; color:#334155; font-size:13px;">SUBSCRIBER &amp; CONNECTOR SPECIFICATIONS</h4>
          <div><strong>Subscriber:</strong> ${cert.customerName}</div>
          <div><strong>Drop Route / FAT:</strong> ${cert.route}</div>
          <div><strong>Connector Model:</strong> ${cert.connectorModelName}</div>
          <div><strong>Interface Polish:</strong> ${cert.polishTypeName}</div>
          <div><strong>Index Gel Condition:</strong> ${g.name}</div>
        </div>
        <div style="background:#f8fafc; padding:12px; border-radius:6px; border:1px solid #e2e8f0;">
          <h4 style="margin:0 0 8px 0; color:#334155; font-size:13px;">TESTING &amp; COMMISSIONING PARTICULARS</h4>
          <div><strong>Technician:</strong> ${cert.technicianName}</div>
          <div><strong>Date & Time:</strong> ${cert.createdAt.substring(0, 19).replace('T', ' ')} PKT</div>
          <div><strong>Quality Verdict:</strong> <span style="font-weight:800; color:${v.colorHex};">${v.label}</span></div>
          <div><strong>Field Directive:</strong> <span style="font-weight:700;">${v.actionRequired}</span></div>
        </div>
      </div>

      <!-- KPI Summary Ribbon -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px;">
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:10px; text-align:center;">
          <div style="font-size:10px; color:#1e40af; font-weight:700;">INSERTION LOSS</div>
          <div style="font-size:18px; font-weight:800; color:#1d4ed8;">${a.insertionLossDb.toFixed(3)} dB</div>
        </div>
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:10px; text-align:center;">
          <div style="font-size:10px; color:#166534; font-weight:700;">RETURN LOSS</div>
          <div style="font-size:18px; font-weight:800; color:#15803d;">${a.returnLossDb.toFixed(1)} dB</div>
        </div>
        <div style="background:#fefce8; border:1px solid #fef08a; border-radius:6px; padding:10px; text-align:center;">
          <div style="font-size:10px; color:#854d0e; font-weight:700;">TENSILE PROOF RETENTION</div>
          <div style="font-size:18px; font-weight:800; color:#a16207;">${a.tensileLoadN.toFixed(1)} N (${a.tensileRatio}%)</div>
        </div>
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:10px; text-align:center;">
          <div style="font-size:10px; color:#475569; font-weight:700;">CABLE SLIPPAGE</div>
          <div style="font-size:18px; font-weight:800; color:${a.slippageMm > 0.1 ? '#b91c1c' : '#334155'};">${a.slippageMm.toFixed(2)} mm</div>
        </div>
      </div>

      <!-- Vector Visualizer -->
      <div style="margin-bottom:20px;">
        ${renderFastConnectorQaSvg(a, { width: 750, height: 320 })}
      </div>

      <!-- Signatures -->
      <div style="display:flex; justify-content:space-between; margin-top:30px; padding-top:16px; border-top:1px solid #cbd5e1; font-size:11.5px;">
        <div style="text-align:center; width:200px;">
          <div style="border-bottom:1px solid #94a3b8; height:32px;"></div>
          <div style="margin-top:4px; font-weight:700;">Field Lineman / Splicer</div>
          <div style="color:#64748b;">${cert.technicianName}</div>
        </div>
        <div style="text-align:center; width:200px;">
          <div style="border-bottom:1px solid #94a3b8; height:32px;"></div>
          <div style="margin-top:4px; font-weight:700;">Outside Plant Metrology Officer</div>
          <div style="color:#64748b;">Shahdara QA Department</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Formats bilingual WhatsApp notification
 */
export function formatFastConnectorCertWhatsApp(cert) {
  if (!cert || !cert.analysis) return '';
  const a = cert.analysis;
  const v = a.verdict;

  return `🔌 *SHAHDARA FIBER NETWORKS — FIELD FAST CONNECTOR QA CERTIFICATE*\n` +
    `📋 *Certificate ID:* ${cert.id}\n` +
    `👤 *Subscriber:* ${cert.customerName}\n` +
    `📍 *Route / FAT:* ${cert.route}\n` +
    `🔧 *Model:* ${cert.connectorModelName} (${cert.polishTypeName})\n` +
    `👷 *Technician:* ${cert.technicianName}\n` +
    `--------------------------------------\n` +
    `📉 *Insertion Loss:* ${a.insertionLossDb.toFixed(3)} dB (Max 0.50 dB)\n` +
    `📈 *Return Loss:* ${a.returnLossDb.toFixed(1)} dB (Target ≥ ${a.polish.minReturnLossDb} dB)\n` +
    `🧪 *Index Gel:* ${a.gel.name}\n` +
    `💪 *Tensile Retention:* ${a.tensileLoadN.toFixed(1)} N (Slip: ${a.slippageMm.toFixed(2)} mm)\n` +
    `--------------------------------------\n` +
    `🏁 *Verdict:* ${v.code}\n` +
    `📢 *Directive:* ${v.actionRequired}\n` +
    `🇵🇰 *Urdu:* ${v.recommendationUrdu}\n` +
    `🌐 *Accreditation:* IEC 61754-4 / Telcordia GR-326-CORE`;
}

/**
 * Generates RFC-4180 CSV export with UTF-8 BOM
 */
export function generateFastConnectorCertsCsv(certs = []) {
  const records = Array.isArray(certs) ? certs : [];
  const header = [
    'CertificateID',
    'CreatedAt',
    'Subscriber',
    'Route',
    'ConnectorModel',
    'PolishType',
    'GelCondition',
    'InsertionLossDb',
    'ReturnLossDb',
    'TensileLoadN',
    'SlippageMm',
    'Technician',
    'VerdictCode',
    'ActionRequired'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map(c => {
    const a = c.analysis || {};
    const v = a.verdict || {};

    return [
      escapeCsv(c.id),
      escapeCsv(c.createdAt),
      escapeCsv(c.customerName),
      escapeCsv(c.route),
      escapeCsv(c.connectorModelName),
      escapeCsv(c.polishTypeName),
      escapeCsv(c.gelConditionName),
      a.insertionLossDb !== undefined ? a.insertionLossDb.toFixed(3) : '',
      a.returnLossDb !== undefined ? a.returnLossDb.toFixed(1) : '',
      a.tensileLoadN !== undefined ? a.tensileLoadN.toFixed(1) : '',
      a.slippageMm !== undefined ? a.slippageMm.toFixed(2) : '',
      escapeCsv(c.technicianName),
      escapeCsv(v.code || c.status),
      escapeCsv(v.actionRequired || '')
    ].join(',');
  });

  return '\uFEFF' + [header.join(','), ...rows].join('\r\n');
}

/**
 * UI Controller wiring modal dialog
 */
export function setupFastConnectorQaModal(options = {}) {
  const modal = document.getElementById('fastConnectorQaModal');
  if (!modal) return;

  const presetSelect = document.getElementById('fastConnectorPresetSelect');
  const custInput = document.getElementById('fastConnectorCustInput');
  const routeInput = document.getElementById('fastConnectorRouteInput');
  const modelSelect = document.getElementById('fastConnectorModelSelect');
  const polishSelect = document.getElementById('fastConnectorPolishSelect');
  const gelSelect = document.getElementById('fastConnectorGelSelect');
  const gapInput = document.getElementById('fastConnectorGapInput');
  const angInput = document.getElementById('fastConnectorAngInput');
  const tensileInput = document.getElementById('fastConnectorTensileInput');
  const slipInput = document.getElementById('fastConnectorSlipInput');
  const techInput = document.getElementById('fastConnectorTechInput');
  const notesInput = document.getElementById('fastConnectorNotesInput');

  const svgContainer = document.getElementById('fastConnectorSvgContainer');
  const summaryBox = document.getElementById('fastConnectorSummaryBox');
  const saveBtn = document.getElementById('fastConnectorSaveBtn');
  const historyTbody = document.getElementById('fastConnectorHistoryTbody');
  const printA4Btn = document.getElementById('fastConnectorPrintA4Btn');
  const printThermalBtn = document.getElementById('fastConnectorPrintThermalBtn');
  const whatsappBtn = document.getElementById('fastConnectorWhatsAppBtn');
  const csvBtn = document.getElementById('fastConnectorCsvBtn');
  const closeBtn = document.getElementById('fastConnectorCloseBtn');
  const searchInput = document.getElementById('fastConnectorSearchInput');
  const statusFilter = document.getElementById('fastConnectorStatusFilter');

  let currentAnalysis = null;
  let activeCert = null;

  function recalculate() {
    const params = {
      connectorModelId: modelSelect ? modelSelect.value : 'HUAWEI_FAST_SC',
      polishTypeId: polishSelect ? polishSelect.value : 'SC_APC',
      gelConditionId: gelSelect ? gelSelect.value : 'PRISTINE_FRESH',
      fiberGapUm: gapInput ? parseFloat(gapInput.value) || 1.0 : 1.0,
      angularMismatchDeg: angInput ? parseFloat(angInput.value) || 0.4 : 0.4,
      tensileLoadN: tensileInput ? parseFloat(tensileInput.value) || 45.0 : 45.0,
      slippageMm: slipInput ? parseFloat(slipInput.value) || 0.0 : 0.0
    };

    currentAnalysis = evaluateFastConnectorQa(params);

    if (svgContainer) {
      svgContainer.innerHTML = renderFastConnectorQaSvg(currentAnalysis, { width: 720, height: 320 });
    }

    if (summaryBox) {
      const v = currentAnalysis.verdict;
      summaryBox.innerHTML = `
        <div class="kpi-mini-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
          <div class="kpi-mini-item">
            <span class="kpi-mini-label">Insertion Loss</span>
            <span class="kpi-mini-value" style="color:${currentAnalysis.insertionLossDb <= 0.35 ? '#10b981' : '#ef4444'};">${currentAnalysis.insertionLossDb.toFixed(3)} dB</span>
          </div>
          <div class="kpi-mini-item">
            <span class="kpi-mini-label">Return Loss</span>
            <span class="kpi-mini-value" style="color:#0284c7;">${currentAnalysis.returnLossDb.toFixed(1)} dB</span>
          </div>
          <div class="kpi-mini-item">
            <span class="kpi-mini-label">Tensile Pull</span>
            <span class="kpi-mini-value" style="color:#f59e0b;">${currentAnalysis.tensileLoadN.toFixed(1)} N</span>
          </div>
          <div class="kpi-mini-item">
            <span class="kpi-mini-label">Slippage</span>
            <span class="kpi-mini-value" style="color:${currentAnalysis.slippageMm > 0.1 ? '#ef4444' : '#10b981'};">${currentAnalysis.slippageMm.toFixed(2)} mm</span>
          </div>
          <div class="kpi-mini-item">
            <span class="kpi-mini-label">Verdict</span>
            <span class="badge ${v.badgeClass}">${v.code}</span>
          </div>
        </div>
      `;
    }
  }

  function applyPreset(presetId) {
    const p = SHAH_FAST_CONNECTOR_PRESETS[presetId];
    if (!p) return;

    if (custInput) custInput.value = p.customerName;
    if (routeInput) routeInput.value = p.route;
    if (modelSelect) modelSelect.value = p.connectorModelId;
    if (polishSelect) polishSelect.value = p.polishTypeId;
    if (gelSelect) gelSelect.value = p.gelConditionId;
    if (gapInput) gapInput.value = p.fiberGapUm;
    if (angInput) angInput.value = p.angularMismatchDeg;
    if (tensileInput) tensileInput.value = p.tensileLoadN;
    if (slipInput) slipInput.value = p.slippageMm;
    if (techInput) techInput.value = p.technicianName;
    if (notesInput) notesInput.value = p.notes;

    recalculate();
  }

  function renderHistory() {
    if (!historyTbody) return;
    const certs = getSavedFastConnectorCerts(options.state);
    const filter = {
      status: statusFilter ? statusFilter.value : '',
      searchQuery: searchInput ? searchInput.value : ''
    };

    let displayCerts = certs;
    if (filter.status) displayCerts = displayCerts.filter(c => c.status === filter.status);
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      displayCerts = displayCerts.filter(c => 
        c.id.toLowerCase().includes(q) || 
        c.customerName.toLowerCase().includes(q) || 
        c.route.toLowerCase().includes(q) ||
        c.technicianName.toLowerCase().includes(q)
      );
    }

    if (displayCerts.length === 0) {
      historyTbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:12px;">No Fast Connector QA certificates recorded yet.</td></tr>';
      return;
    }

    historyTbody.innerHTML = displayCerts.map(c => `
      <tr>
        <td style="font-weight:bold; font-family:monospace;">${c.id}</td>
        <td>${c.customerName}</td>
        <td>${c.route}</td>
        <td style="text-align:right;">${c.analysis ? c.analysis.insertionLossDb.toFixed(3) : '-'} dB</td>
        <td style="text-align:center;"><span class="badge ${c.analysis && c.analysis.verdict ? c.analysis.verdict.badgeClass : 'badge-neutral'}">${c.status}</span></td>
        <td style="text-align:center;">
          <button class="btn btn-sm btn-ghost view-fast-btn" data-cert-id="${c.id}" title="Load & View">🔍</button>
        </td>
      </tr>
    `).join('');

    // Wire view buttons
    historyTbody.querySelectorAll('.view-fast-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cert-id');
        const found = certs.find(x => x.id === id);
        if (found) {
          activeCert = found;
          if (custInput) custInput.value = found.customerName;
          if (routeInput) routeInput.value = found.route;
          if (techInput) techInput.value = found.technicianName;
          if (modelSelect) modelSelect.value = found.connectorModelId;
          if (polishSelect) polishSelect.value = found.polishTypeId;
          if (gelSelect) gelSelect.value = found.gelConditionId;
          if (notesInput) notesInput.value = found.notes || '';
          currentAnalysis = found.analysis;
          if (svgContainer) svgContainer.innerHTML = renderFastConnectorQaSvg(currentAnalysis);
        }
      });
    });
  }

  // Bind input listeners
  [modelSelect, polishSelect, gelSelect, gapInput, angInput, tensileInput, slipInput].forEach(el => {
    if (el) el.addEventListener('input', recalculate);
  });

  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => applyPreset(e.target.value));
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      try {
        const record = buildFastConnectorRecord({
          customerName: custInput ? custInput.value : 'Subscriber',
          route: routeInput ? routeInput.value : 'Begum Kot Drop',
          connectorModelId: modelSelect ? modelSelect.value : 'HUAWEI_FAST_SC',
          polishTypeId: polishSelect ? polishSelect.value : 'SC_APC',
          gelConditionId: gelSelect ? gelSelect.value : 'PRISTINE_FRESH',
          fiberGapUm: gapInput ? parseFloat(gapInput.value) || 1.0 : 1.0,
          angularMismatchDeg: angInput ? parseFloat(angInput.value) || 0.4 : 0.4,
          tensileLoadN: tensileInput ? parseFloat(tensileInput.value) || 45.0 : 45.0,
          slippageMm: slipInput ? parseFloat(slipInput.value) || 0.0 : 0.0,
          technicianName: techInput ? techInput.value : 'Muhammad Rizwan',
          notes: notesInput ? notesInput.value : ''
        }, options.state);

        saveFastConnectorCert(record, options.state);
        activeCert = record;
        renderHistory();
        alert('Fast Connector QA Certificate ' + record.id + ' successfully recorded!');
      } catch (err) {
        alert('Save Error: ' + err.message);
      }
    });
  }

  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const cert = activeCert || (currentAnalysis ? {
        id: 'FST-PREVIEW',
        createdAt: new Date().toISOString(),
        customerName: custInput ? custInput.value : 'Subscriber',
        route: routeInput ? routeInput.value : 'Field Drop',
        connectorModelName: modelSelect ? modelSelect.options[modelSelect.selectedIndex].text : 'Fast SC',
        polishTypeName: polishSelect ? polishSelect.options[polishSelect.selectedIndex].text : 'SC/APC',
        technicianName: techInput ? techInput.value : 'Technician',
        analysis: currentAnalysis
      } : null);

      if (!cert) return alert('No analysis data to print.');
      const html = generateFastConnectorCertHtml(cert, { format: 'a4' });
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
        id: 'FST-PREVIEW',
        createdAt: new Date().toISOString(),
        customerName: custInput ? custInput.value : 'Subscriber',
        route: routeInput ? routeInput.value : 'Field Drop',
        connectorModelName: modelSelect ? modelSelect.options[modelSelect.selectedIndex].text : 'Fast SC',
        polishTypeName: polishSelect ? polishSelect.options[polishSelect.selectedIndex].text : 'SC/APC',
        technicianName: techInput ? techInput.value : 'Technician',
        analysis: currentAnalysis
      } : null);

      if (!cert) return alert('No analysis data.');
      const html = generateFastConnectorCertHtml(cert, { format: 'thermal' });
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
        id: 'FST-PREVIEW',
        createdAt: new Date().toISOString(),
        customerName: custInput ? custInput.value : 'Subscriber',
        route: routeInput ? routeInput.value : 'Field Drop',
        connectorModelName: modelSelect ? modelSelect.options[modelSelect.selectedIndex].text : 'Fast SC',
        polishTypeName: polishSelect ? polishSelect.options[polishSelect.selectedIndex].text : 'SC/APC',
        technicianName: techInput ? techInput.value : 'Technician',
        analysis: currentAnalysis
      } : null);

      if (!cert) return alert('No analysis data.');
      const text = formatFastConnectorCertWhatsApp(cert);
      if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          alert('WhatsApp Fast Connector QA Notice copied to clipboard!\n\n' + text);
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
      const certs = getSavedFastConnectorCerts(options.state);
      if (certs.length === 0) return alert('No saved certificates to export.');
      const csv = generateFastConnectorCertsCsv(certs);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Shahdara_Fast_Connector_QA_${new Date().toISOString().substring(0, 10)}.csv`;
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
  applyPreset('PRESET_BEGUM_KOT_DROP');
  renderHistory();
}
