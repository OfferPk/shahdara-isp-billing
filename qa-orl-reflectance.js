/**
 * QA Certification Suite: Optical Return Loss (ORL), Connector Endface Contamination & Reflectance
 * Standard IEC 61300-3-35 & ITU-T G.984 GPON/XGS-PON Reflectance Compliance
 * Area: Shahdara ISP Fiber Distribution & Subscriber Demarcation
 */

export const ORL_CERT_STORAGE_KEY = 'shahdara_orl_certs_v1';

export const ORL_CONNECTOR_POLISHES = {
  SC_APC: {
    id: 'SC_APC',
    name: 'SC/APC (Green Angled 8°)',
    standardReturnLossDb: 60.0,
    maxReflectanceDb: -60.0,
    angleDegrees: 8,
    ferruleDiameterMm: 2.5,
    ferruleMaterial: 'Zirconia Ceramic',
    typicalLossDb: 0.20,
    colorCode: '#10b981'
  },
  SC_UPC: {
    id: 'SC_UPC',
    name: 'SC/UPC (Blue Ultra Physical)',
    standardReturnLossDb: 50.0,
    maxReflectanceDb: -50.0,
    angleDegrees: 0,
    ferruleDiameterMm: 2.5,
    ferruleMaterial: 'Zirconia Ceramic',
    typicalLossDb: 0.25,
    colorCode: '#0284c7'
  },
  LC_APC: {
    id: 'LC_APC',
    name: 'LC/APC (Small Green Angled 8°)',
    standardReturnLossDb: 65.0,
    maxReflectanceDb: -65.0,
    angleDegrees: 8,
    ferruleDiameterMm: 1.25,
    ferruleMaterial: 'Zirconia Ceramic',
    typicalLossDb: 0.15,
    colorCode: '#059669'
  },
  FC_UPC: {
    id: 'FC_UPC',
    name: 'FC/UPC (Metallic Screw Ferrule)',
    standardReturnLossDb: 45.0,
    maxReflectanceDb: -45.0,
    angleDegrees: 0,
    ferruleDiameterMm: 2.5,
    ferruleMaterial: 'Stainless Steel / Ceramic',
    typicalLossDb: 0.35,
    colorCode: '#64748b'
  }
};

export const ORL_END_FACE_ZONES = {
  ZONE_A: {
    id: 'ZONE_A',
    name: 'Zone A: Core (0–25 µm)',
    description: 'Optical transmission core. Zero defects and zero scratches permitted.',
    radiusUm: 25,
    maxDefectCount: 0,
    maxScratchCount: 0,
    critical: true
  },
  ZONE_B: {
    id: 'ZONE_B',
    name: 'Zone B: Cladding (25–115 µm)',
    description: 'Silica cladding boundary. Micro-pits < 3 µm permitted; no deep scratches.',
    radiusUm: 115,
    maxDefectCount: 2,
    maxScratchCount: 0,
    critical: true
  },
  ZONE_C: {
    id: 'ZONE_C',
    name: 'Zone C: Adhesive Layer (115–125 µm)',
    description: 'Epoxy adhesive bonding ring. Loose adhesive or voids inspected.',
    radiusUm: 125,
    maxDefectCount: 5,
    maxScratchCount: 2,
    critical: false
  },
  ZONE_D: {
    id: 'ZONE_D',
    name: 'Zone D: Ferrule Contact (125–250 µm)',
    description: 'Physical ceramic ferrule contact surface. Contamination assessed.',
    radiusUm: 250,
    maxDefectCount: 10,
    maxScratchCount: 5,
    critical: false
  }
};

export const ORL_DEFECT_TYPES = {
  NONE: {
    id: 'NONE',
    label: 'Pristine Clean (Zero Contamination)',
    penaltyDb: 0.0,
    iecVerdict: 'PASS',
    requiresCleaning: false,
    severity: 'NORMAL'
  },
  DUST_SPECS: {
    id: 'DUST_SPECS',
    label: 'Loose Airborne Dust Particulates',
    penaltyDb: 5.5,
    iecVerdict: 'FAIL_CLEAN_REQUIRED',
    requiresCleaning: true,
    severity: 'WARNING'
  },
  OIL_SMUDGE: {
    id: 'OIL_SMUDGE',
    label: 'Human Skin Fingerprint Oil / Grease',
    penaltyDb: 9.0,
    iecVerdict: 'FAIL_SOLVENT_REQUIRED',
    requiresCleaning: true,
    severity: 'WARNING'
  },
  CORE_SCRATCH: {
    id: 'CORE_SCRATCH',
    label: 'Deep Core Radial / Transverse Scratch',
    penaltyDb: 15.0,
    iecVerdict: 'CRITICAL_REPLACE_FERRULE',
    requiresCleaning: false,
    severity: 'CRITICAL'
  },
  CHIPPED_EDGE: {
    id: 'CHIPPED_EDGE',
    label: 'Chipped Ceramic Edge Crack Fracture',
    penaltyDb: 12.5,
    iecVerdict: 'CRITICAL_REPLACE_FERRULE',
    requiresCleaning: false,
    severity: 'CRITICAL'
  },
  ISOPROPYL_RESIDUE: {
    id: 'ISOPROPYL_RESIDUE',
    label: 'Dried Isopropyl Alcohol Water Film Halo',
    penaltyDb: 3.5,
    iecVerdict: 'FAIL_CLEAN_REQUIRED',
    requiresCleaning: true,
    severity: 'WARNING'
  }
};

export const ORL_VERDICTS = {
  CERTIFIED_PRISTINE: {
    id: 'CERTIFIED_PRISTINE',
    label: 'Certified Pristine Endface (Pass)',
    labelUrdu: 'مصدقہ معیاری صاف ریفلیکٹنس',
    color: '#10b981',
    badgeClass: 'badge-success',
    actionRequired: 'Optimal for multi-gigabit & RF video service. Safe for commissioning.'
  },
  ACCEPTABLE_PASS: {
    id: 'ACCEPTABLE_PASS',
    label: 'Acceptable Link Reflectance (Pass)',
    labelUrdu: 'قابل قبول آپٹیکل ریفلیکٹنس',
    color: '#38bdf8',
    badgeClass: 'badge-info',
    actionRequired: 'Complies with standard GPON Class B+ limits. No urgent action required.'
  },
  CONDITIONAL_CLEANING_REQUIRED: {
    id: 'CONDITIONAL_CLEANING_REQUIRED',
    label: 'Cleaning Cassette Required (Conditional)',
    labelUrdu: 'آپٹیکل فیرول صفائی ضروری ہے',
    color: '#f59e0b',
    badgeClass: 'badge-warning',
    actionRequired: 'Clean ferrule using lint-free dry optical cassette or solvent pen and re-test.'
  },
  CRITICAL_REPLACE_FERRULE: {
    id: 'CRITICAL_REPLACE_FERRULE',
    label: 'Reject / Ferrule Re-termination Mandated',
    labelUrdu: 'ناقص فیرول - فوری تبدیلی لازمی',
    color: '#ef4444',
    badgeClass: 'badge-danger',
    actionRequired: 'Scratched or chipped ferrule core causes laser reflection damage. Re-cleave and re-splice.'
  }
};

/**
 * Calculates optical reflectance (in dB and ppm) from Optical Return Loss (ORL).
 * Mathematical relationship: Reflectance (dB) = -ORL (dB)
 * Power fraction = 10^(-ORL / 10)
 */
export function calculateReflectanceFromOrl(orlDb = 0) {
  const val = Number(orlDb);
  const clampedOrl = isNaN(val) ? 0 : Math.max(0, val);
  const reflectanceDb = -clampedOrl;
  const powerFraction = Math.pow(10, -clampedOrl / 10);
  const reflectancePpm = Math.round(powerFraction * 1000000);
  const opticalPowerReturnedPercent = Number((powerFraction * 100).toFixed(6));

  return {
    orlDb: clampedOrl,
    reflectanceDb,
    powerFraction,
    reflectancePpm,
    opticalPowerReturnedPercent
  };
}

/**
 * Calculates Optical Return Loss from Reflectance in dB.
 * ORL = -Reflectance (dB)
 */
export function calculateOrlFromReflectance(reflectanceDb = 0) {
  const val = Number(reflectanceDb);
  if (isNaN(val)) return 0;
  return Math.max(0, -val);
}

/**
 * Calculates optical return loss (ORL), reflection fraction, and compliance grade.
 */
export function evaluateOrlReflectance({
  polishType,
  defectType,
  measuredOrlDb = 58.0,
  wavelengthNm = 1490,
  polish,
  defect,
  defects
} = {}) {
  const pType = polishType || polish || 'SC_APC';
  const dType = defectType || defect || (Array.isArray(defects) && defects[0]) || 'NONE';
  const polishObj = ORL_CONNECTOR_POLISHES[pType] || ORL_CONNECTOR_POLISHES.SC_APC;
  const defectObj = ORL_DEFECT_TYPES[dType] || ORL_DEFECT_TYPES.NONE;

  const rawOrl = Number(measuredOrlDb);
  const baseOrl = isNaN(rawOrl) ? polishObj.standardReturnLossDb : Math.max(10, Math.min(75, rawOrl));
  const effectiveOrl = Math.max(10, Math.min(75, baseOrl - defectObj.penaltyDb));

  // Optical reflectance R_dB = -ORL
  const opticalReflectanceDb = -effectiveOrl;

  // Reflection power fraction = 10^(-ORL / 10)
  const reflectionFraction = Math.pow(10, -effectiveOrl / 10);
  const reflectionPpm = Math.round(reflectionFraction * 1000000);

  let verdict = ORL_VERDICTS.ACCEPTABLE_PASS;
  if (defectObj.id === 'CORE_SCRATCH' || defectObj.id === 'CHIPPED_EDGE' || defectObj.id === 'SCRATCH_ZONE_A' || effectiveOrl < 35.0) {
    verdict = ORL_VERDICTS.CRITICAL_REPLACE_FERRULE;
  } else if (defectObj.requiresCleaning || effectiveOrl < 45.0) {
    verdict = ORL_VERDICTS.CONDITIONAL_CLEANING_REQUIRED;
  } else if (effectiveOrl >= 55.0 && defectObj.id === 'NONE') {
    verdict = ORL_VERDICTS.CERTIFIED_PRISTINE;
  }

  // DFB Laser back-reflection stability risk assessment
  let laserStabilityRisk = 'LOW';
  let laserRiskNotes = 'Transmitter laser diode stable; optical feedback suppressed.';
  if (verdict.id === 'CERTIFIED_PRISTINE' && effectiveOrl >= 60.0) {
    laserStabilityRisk = 'NEGLIGIBLE';
  } else if (effectiveOrl < 35.0 || verdict.id === 'CRITICAL_REPLACE_FERRULE') {
    laserStabilityRisk = 'CRITICAL';
    laserRiskNotes = 'High backscatter reflection destabilizes OLT/ONU DFB laser cavity. High Bit Error Rate (BER).';
  } else if (effectiveOrl < 48.0) {
    laserStabilityRisk = 'MODERATE';
    laserRiskNotes = 'Marginal return loss. May induce Phase Noise or RF Carrier-to-Noise Ratio (CNR) degradation.';
  }

  const overallPass = verdict.id === 'CERTIFIED_PRISTINE' || verdict.id === 'ACCEPTABLE_PASS';
  const orlPassed = effectiveOrl >= polishObj.standardReturnLossDb;
  const iecEndfacePassed = !defectObj.requiresCleaning && defectObj.severity !== 'CRITICAL' && defectObj.id !== 'SCRATCH_ZONE_A';
  const qualityGrade = verdict.id === 'CERTIFIED_PRISTINE' ? 'GRADE_A' : verdict.id === 'ACCEPTABLE_PASS' ? 'GRADE_B' : verdict.id === 'CONDITIONAL_CLEANING_REQUIRED' ? 'GRADE_C' : 'GRADE_D';
  const marginDb = Number((effectiveOrl - polishObj.standardReturnLossDb).toFixed(2));

  return {
    polish: polishObj,
    defect: defectObj,
    effectiveOrlDb: Number(effectiveOrl.toFixed(2)),
    opticalReflectanceDb: Number(opticalReflectanceDb.toFixed(2)),
    reflectionFraction,
    reflectionPpm,
    wavelengthNm: Number(wavelengthNm) || 1490,
    verdict,
    laserStabilityRisk,
    laserRiskNotes,
    overallPass,
    orlPassed,
    iecEndfacePassed,
    qualityGrade,
    marginDb,
    actionRequired: verdict.actionRequired
  };
}

/**
 * Generates unique sequential ID for ORL certification.
 */
export function generateOrlCertId(existingCount = 0) {
  const now = new Date();
  const yearMo = now.toISOString().slice(0, 7).replace('-', '');
  const seq = String(existingCount + 1).padStart(4, '0');
  return `ORL-${yearMo}-${seq}`;
}

/**
 * Validates form submission for Optical Return Loss QA certification.
 */
export function validateOrlCertification(formData = {}) {
  const errors = [];
  const errorsObj = {};

  const custName = formData.customerName || formData.customerId;
  if (!custName || typeof custName !== 'string' || !custName.trim()) {
    errors.push('Customer name is required.');
    errorsObj.customerName = 'Customer name is required.';
  }

  if (!formData.technicianName || typeof formData.technicianName !== 'string' || formData.technicianName.trim().length < 2) {
    errors.push('Technician name is required (min 2 characters).');
    errorsObj.technicianName = 'Technician name is required (min 2 characters).';
  }

  if (formData.connectorPolish && !ORL_CONNECTOR_POLISHES[formData.connectorPolish]) {
    errors.push('Valid connector polish standard must be selected.');
    errorsObj.connectorPolish = 'Valid connector polish standard must be selected.';
  }

  const orl = Number(formData.measuredOrlDb);
  if (isNaN(orl) || orl < 0 || orl > 75) {
    errors.push('Measured ORL must be between 0 and 75 dB.');
    errorsObj.measuredOrlDb = 'Measured ORL must be between 0 and 75 dB.';
  }

  return {
    valid: errors.length === 0,
    errors,
    errorsObj
  };
}

export const validateOrlCertInput = validateOrlCertification;

/**
 * Builds sequential certification record.
 */
export function buildOrlCertRecord(formData = {}, existingCount = 0) {
  const now = new Date();
  const id = generateOrlCertId(existingCount);

  const evalResult = evaluateOrlReflectance({
    polishType: formData.connectorPolish || formData.polish || 'SC_APC',
    defectType: formData.defectType || (Array.isArray(formData.defects) ? formData.defects[0] : formData.defects) || 'NONE',
    measuredOrlDb: Number(formData.measuredOrlDb) || 58.0,
    wavelengthNm: Number(formData.wavelengthNm) || 1490
  });

  return {
    id,
    inspectionDate: now.toISOString().slice(0, 10),
    timestamp: now.toISOString(),
    customerId: formData.customerId || '',
    customerName: formData.customerName || 'Subscriber',
    customerPhone: formData.customerPhone || '',
    customerArea: formData.customerArea || 'Shahdara Town',
    technicianName: formData.technicianName || 'Lineman Bilal',
    polish: evalResult.polish.id,
    connectorPolish: evalResult.polish.id,
    polishName: evalResult.polish.name,
    defectType: evalResult.defect.id,
    defectLabel: evalResult.defect.label,
    measuredOrlDb: Number(formData.measuredOrlDb) || 58.0,
    effectiveOrlDb: evalResult.effectiveOrlDb,
    opticalReflectanceDb: evalResult.opticalReflectanceDb,
    reflectionPpm: evalResult.reflectionPpm,
    wavelengthNm: evalResult.wavelengthNm,
    verdictId: evalResult.verdict.id,
    verdictLabel: evalResult.verdict.label,
    verdictLabelUrdu: evalResult.verdict.labelUrdu,
    verdictColor: evalResult.verdict.color,
    verdictBadgeClass: evalResult.verdict.badgeClass,
    actionRequired: evalResult.verdict.actionRequired,
    laserStabilityRisk: evalResult.laserStabilityRisk,
    laserRiskNotes: evalResult.laserRiskNotes,
    overallPass: evalResult.overallPass,
    qualityGrade: evalResult.qualityGrade,
    status: evalResult.overallPass ? 'CERTIFIED_PASS' : 'ACTION_REQUIRED',
    evaluation: evalResult,
    isoStandard: 'IEC 61300-3-35 & ITU-T G.984 Optical Return Loss Certification',
    notes: (formData.notes || '').trim()
  };
}

/**
 * LocalStorage persistence helpers.
 */
export function getSavedOrlCerts(storage = null, customerId = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(ORL_CERT_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    if (customerId) {
      return list.filter(r => r.customerId === customerId);
    }
    return list;
  } catch (_) {
    return [];
  }
}

export function saveOrlCert(storage = null, cert = null) {
  if (!cert) return false;
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    const list = getSavedOrlCerts(store);
    const existingIdx = list.findIndex(r => r.id === cert.id);
    if (existingIdx >= 0) {
      list[existingIdx] = cert;
    } else {
      list.unshift(cert);
    }
    store.setItem(ORL_CERT_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (_) {
    return false;
  }
}

export function updateOrlCertStatus(storage = null, certId = '', newVerdictId = '', notes = '') {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || !certId) return null;
  try {
    const list = getSavedOrlCerts(store);
    const item = list.find(r => r.id === certId);
    if (!item) return null;
    if (newVerdictId === 'CLEANED_RETEST_PASS' || newVerdictId === 'CERTIFIED_PASS') {
      item.status = newVerdictId;
      item.overallPass = true;
      item.verdictId = 'CERTIFIED_PRISTINE';
      item.verdictLabel = ORL_VERDICTS.CERTIFIED_PRISTINE.label;
      item.verdictLabelUrdu = ORL_VERDICTS.CERTIFIED_PRISTINE.labelUrdu;
      item.verdictColor = ORL_VERDICTS.CERTIFIED_PRISTINE.color;
      item.verdictBadgeClass = ORL_VERDICTS.CERTIFIED_PRISTINE.badgeClass;
      item.qualityGrade = 'GRADE_A';
    } else {
      const v = ORL_VERDICTS[newVerdictId];
      if (v) {
        item.verdictId = v.id;
        item.verdictLabel = v.label;
        item.verdictLabelUrdu = v.labelUrdu;
        item.verdictColor = v.color;
        item.verdictBadgeClass = v.badgeClass;
        item.actionRequired = v.actionRequired;
      }
    }
    if (notes) item.notes = notes;
    store.setItem(ORL_CERT_STORAGE_KEY, JSON.stringify(list));
    return item;
  } catch (_) {
    return null;
  }
}

export function clearOrlCerts(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.removeItem(ORL_CERT_STORAGE_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Calculates aggregate summary metrics.
 */
export function calculateOrlCertMetrics(records = [], filterOptions = {}) {
  let filtered = Array.isArray(records) ? [...records] : [];

  if (filterOptions.customerId) {
    filtered = filtered.filter(r => r.customerId === filterOptions.customerId);
  }
  if (filterOptions.verdictId) {
    filtered = filtered.filter(r => r.verdictId === filterOptions.verdictId);
  }
  if (filterOptions.polishType) {
    filtered = filtered.filter(r => (r.connectorPolish === filterOptions.polishType || r.polish === filterOptions.polishType));
  }
  if (filterOptions.query) {
    const q = filterOptions.query.toLowerCase().trim();
    filtered = filtered.filter(r =>
      r.id.toLowerCase().includes(q) ||
      (r.customerName && r.customerName.toLowerCase().includes(q)) ||
      (r.technicianName && r.technicianName.toLowerCase().includes(q))
    );
  }

  const total = filtered.length;
  if (total === 0) {
    return {
      total: 0,
      passCount: 0,
      failCount: 0,
      pristineCount: 0,
      acceptableCount: 0,
      passRatePercent: 0,
      cleaningRequiredCount: 0,
      criticalReplaceCount: 0,
      averageOrlDb: 0
    };
  }

  const pristineCount = filtered.filter(r => r.verdictId === 'CERTIFIED_PRISTINE' || r.qualityGrade === 'GRADE_A').length;
  const acceptableCount = filtered.filter(r => r.verdictId === 'ACCEPTABLE_PASS' || r.qualityGrade === 'GRADE_B').length;
  const totalPass = filtered.filter(r => r.overallPass === true || r.verdictId === 'CERTIFIED_PRISTINE' || r.verdictId === 'ACCEPTABLE_PASS').length;
  const failCount = total - totalPass;
  const cleaningRequiredCount = filtered.filter(r => r.verdictId === 'CONDITIONAL_CLEANING_REQUIRED').length;
  const criticalReplaceCount = filtered.filter(r => r.verdictId === 'CRITICAL_REPLACE_FERRULE').length;

  const totalOrl = filtered.reduce((acc, r) => acc + (Number(r.effectiveOrlDb || r.measuredOrlDb) || 0), 0);
  const averageOrlDb = Number((totalOrl / total).toFixed(1));
  const passRatePercent = Number(((totalPass / total) * 100).toFixed(1));

  return {
    total,
    passCount: totalPass,
    failCount,
    pristineCount,
    acceptableCount,
    passRatePercent,
    cleaningRequiredCount,
    criticalReplaceCount,
    averageOrlDb
  };
}

/**
 * Generates WhatsApp dispatch report for technicians.
 */
export function formatOrlCertWhatsApp(cert = {}) {
  const dateStr = cert.inspectionDate || new Date().toISOString().slice(0, 10);
  return `🔬 *SHAHDARA ISP - OPTICAL RETURN LOSS & ENDFACE QA CERTIFICATE*
📜 Certificate ID: *${cert.id}*
📅 Date: ${dateStr}
👤 Subscriber: *${cert.customerName}* (${cert.customerArea || 'Shahdara'})
👷 Lead Inspector: *${cert.technicianName}*

*CONNECTOR SPECIFICATIONS & MEASUREMENTS:*
• Connector Polish: *${cert.polishName}*
• Laser Wavelength: ${cert.wavelengthNm || 1490} nm
• Optical Return Loss: *${cert.effectiveOrlDb} dB*
• Connector Reflectance: *${cert.opticalReflectanceDb} dB* (${cert.reflectionPpm} ppm backscatter)
• Endface Inspection: *${cert.defectLabel}*

*IEC 61300-3-35 COMPLIANCE VERDICT:*
• Status: *${cert.verdictLabel}* (${cert.verdictLabelUrdu})
• DFB Laser Stability Risk: *${cert.laserStabilityRisk}*
• Recommended Action: ${cert.actionRequired}
${cert.notes ? `📝 Field Notes: ${cert.notes}\n` : ''}
Certified by Shahdara ISP Quality Assurance Engineering Laboratory.`;
}

/**
 * Generates printable HTML representation for A4 or thermal slip.
 */
export function generateOrlCertHtml(cert = {}, options = { format: 'a4' }) {
  const format = options.format || 'a4';
  const escape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  if (format === 'slip') {
    return `
      <div class="orl-cert-slip" style="max-width: 300px; font-family: monospace; font-size: 12px; color: #000; padding: 10px;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 14px;">SHAHDARA BROADBAND</h3>
          <p style="margin: 2px 0; font-size: 10px;">Optical Return Loss &amp; Endface QA Slip</p>
          <p style="margin: 2px 0; font-size: 11px;">سرٹیفکیٹ آپٹیکل ریفلیکٹنس</p>
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-top: 4px;">
            <span>ID: ${escape(cert.id)}</span>
            <span>${escape(cert.inspectionDate)}</span>
          </div>
        </div>
        <div style="margin-bottom: 6px;">
          <div><strong>Subscriber:</strong> ${escape(cert.customerName)}</div>
          <div><strong>Area:</strong> ${escape(cert.customerArea)}</div>
          <div><strong>Polish:</strong> ${escape(cert.polishName)}</div>
          <div><strong>Measured ORL:</strong> ${escape(cert.effectiveOrlDb)} dB</div>
          <div><strong>Reflectance:</strong> ${escape(cert.opticalReflectanceDb)} dB</div>
          <div><strong>Endface Finding:</strong> ${escape(cert.defectLabel)}</div>
        </div>
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 6px; text-align: center;">
          <div style="font-size: 13px; font-weight: bold;">VERDICT: ${escape(cert.verdictLabel)}</div>
          <div style="font-size: 10px; margin-top: 2px;">${escape(cert.actionRequired)}</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 20px; font-size: 10px; text-align: center;">
          <div>
            <div style="border-bottom: 1px solid #000; width: 100px; height: 18px; margin-bottom: 4px;"></div>
            <span>Tech: ${escape(cert.technicianName)}</span>
          </div>
          <div>
            <div style="border-bottom: 1px solid #000; width: 100px; height: 18px; margin-bottom: 4px;"></div>
            <span>QA Stamp</span>
          </div>
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="orl-cert-document" style="max-width: 800px; margin: 0 auto; padding: 24px; font-family: system-ui, sans-serif; color: #1e293b; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;">
      <header style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0e5b4d; padding-bottom: 14px; margin-bottom: 18px;">
        <div>
          <h2 style="margin: 0; color: #0e5b4d; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">SHAHDARA FIBER NETWORKS &amp; BROADBAND</h2>
          <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Quality Assurance Laboratory &amp; Outside Plant Inspection Unit</p>
          <p style="margin: 4px 0 0; font-size: 14px; font-weight: 700; color: #0f172a; direction: rtl;">آپٹیکل ریٹرن لاس و کنیکٹر فیرول کوالٹی اشورنس سرٹیفکیٹ</p>
        </div>
        <div style="text-align: right;">
          <span style="display: inline-block; padding: 4px 10px; background: #0e5b4d; color: #ffffff; font-weight: 700; font-size: 11px; border-radius: 4px; margin-bottom: 6px;">IEC 61300-3-35 CERTIFICATE</span>
          <div style="font-family: monospace; font-size: 13px; font-weight: 700;">ID: ${escape(cert.id)}</div>
          <div style="font-size: 12px; color: #64748b;">Date: ${escape(cert.inspectionDate)}</div>
        </div>
      </header>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0e5b4d; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Subscriber &amp; Circuit Particulars</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr><td style="padding: 3px 0; color: #64748b;">Customer Name:</td><td style="font-weight: 700;">${escape(cert.customerName)}</td></tr>
            <tr><td style="padding: 3px 0; color: #64748b;">Customer ID / Circuit:</td><td style="font-family: monospace;">#${escape(cert.customerId)}</td></tr>
            <tr><td style="padding: 3px 0; color: #64748b;">Contact Number:</td><td>${escape(cert.customerPhone || '—')}</td></tr>
            <tr><td style="padding: 3px 0; color: #64748b;">Installation Sector:</td><td>${escape(cert.customerArea)}</td></tr>
            <tr><td style="padding: 3px 0; color: #64748b;">Lead Field Inspector:</td><td>${escape(cert.technicianName)}</td></tr>
          </table>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
          <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0e5b4d; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Optical Return Loss &amp; Reflectance Metrics</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr><td style="padding: 3px 0; color: #64748b;">Connector Polish:</td><td style="font-weight: 700;">${escape(cert.polishName)}</td></tr>
            <tr><td style="padding: 3px 0; color: #64748b;">Laser Wavelength:</td><td>${escape(cert.wavelengthNm || 1490)} nm</td></tr>
            <tr><td style="padding: 3px 0; color: #64748b;">Optical Return Loss:</td><td style="font-weight: 800; color: #0284c7; font-size: 13px;">${escape(cert.effectiveOrlDb)} dB</td></tr>
            <tr><td style="padding: 3px 0; color: #64748b;">Reflectance (R):</td><td style="font-weight: 700; color: #ef4444;">${escape(cert.opticalReflectanceDb)} dB (${escape(cert.reflectionPpm)} ppm)</td></tr>
            <tr><td style="padding: 3px 0; color: #64748b;">Laser Stability Risk:</td><td style="font-weight: 700;">${escape(cert.laserStabilityRisk)}</td></tr>
          </table>
        </div>
      </div>

      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 16px; background: #ffffff;">
        <h4 style="margin: 0 0 10px; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0e5b4d; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">IEC 61300-3-35 Ferrule Endface Inspection Breakdown</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9; color: #475569;">
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Zone</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Dimension</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">IEC 61300-3-35 Criteria</th>
              <th style="padding: 6px 8px; border: 1px solid #cbd5e1;">Observed Condition</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700;">Zone A (Core)</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">0–25 µm</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Zero defects, zero scratches</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; color: ${cert.defectType === 'CORE_SCRATCH' ? '#ef4444' : '#10b981'};">${cert.defectType === 'CORE_SCRATCH' ? 'FAILED (Defect Detected)' : 'PASSED (Clean)'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700;">Zone B (Cladding)</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">25–115 µm</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">No scratches; pits &lt; 3 µm</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; color: ${cert.defectType === 'DUST_SPECS' || cert.defectType === 'OIL_SMUDGE' ? '#f59e0b' : '#10b981'};">${cert.defectType === 'DUST_SPECS' ? 'PARTICULATES DETECTED' : cert.defectType === 'OIL_SMUDGE' ? 'OIL RESIDUE' : 'PASSED'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700;">Zone C (Adhesive)</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">115–125 µm</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">Intact epoxy, no voids</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">PASSED (Bonding Secure)</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700;">Zone D (Ferrule)</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">125–250 µm</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1;">No chips, fractures, or cracks</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; color: ${cert.defectType === 'CHIPPED_EDGE' ? '#ef4444' : '#10b981'};">${cert.defectType === 'CHIPPED_EDGE' ? 'FAILED (Edge Chip)' : 'PASSED'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">FINAL QA ENGINEERING VERDICT:</span>
            <div style="font-size: 15px; font-weight: 800; color: ${escape(cert.verdictColor || '#10b981')}; margin-top: 2px;">
              ${escape(cert.verdictLabel)} (${escape(cert.verdictLabelUrdu)})
            </div>
            <p style="margin: 4px 0 0; font-size: 12px; color: #334155;">${escape(cert.actionRequired)}</p>
          </div>
          <span style="padding: 6px 14px; background: ${escape(cert.verdictColor || '#10b981')}; color: #ffffff; font-weight: 800; font-size: 12px; border-radius: 4px;">
            ${cert.verdictId === 'CERTIFIED_PRISTINE' || cert.verdictId === 'ACCEPTABLE_PASS' ? 'APPROVED' : 'ACTION REQUIRED'}
          </span>
        </div>
      </div>

      <footer style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11px;">
        <div style="width: 200px;">
          <div style="height: 35px; border-bottom: 1px solid #000; margin-bottom: 6px;"></div>
          <strong>${escape(cert.technicianName)}</strong>
          <div style="color: #64748b;">Field Optical Technician</div>
        </div>
        <div style="width: 200px;">
          <div style="height: 35px; border-bottom: 1px solid #000; margin-bottom: 6px;"></div>
          <strong>Lead QA Engineer</strong>
          <div style="color: #64748b;">Shahdara ISP Lab Operations</div>
        </div>
        <div style="width: 140px;">
          <div style="height: 35px; border: 1px dashed #94a3b8; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: 700; margin-bottom: 6px;">SEAL</div>
          <div style="color: #64748b;">Official QA Stamp</div>
        </div>
      </footer>
    </div>
  `;
}

/**
 * Generates RFC-4180 CSV export with UTF-8 BOM.
 */
export function generateOrlCertsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Date',
    'Customer ID',
    'Customer Name',
    'Customer Phone',
    'Customer Area',
    'Technician',
    'Connector Polish',
    'Wavelength (nm)',
    'Measured ORL (dB)',
    'Effective ORL (dB)',
    'Reflectance (dB)',
    'Reflection (ppm)',
    'Endface Defect',
    'Verdict ID',
    'Verdict Label',
    'Laser Stability Risk',
    'Notes'
  ];

  const escapeCell = (str) => {
    const s = String(str ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = [headers.join(',')];
  for (const r of records) {
    const row = [
      r.id,
      r.inspectionDate,
      r.customerId,
      r.customerName,
      r.customerPhone,
      r.customerArea,
      r.technicianName,
      r.polishName || r.connectorPolish,
      r.wavelengthNm,
      r.measuredOrlDb,
      r.effectiveOrlDb,
      r.opticalReflectanceDb,
      r.reflectionPpm,
      r.defectLabel,
      r.verdictId,
      r.verdictLabel,
      r.laserStabilityRisk,
      r.notes
    ];
    rows.push(row.map(escapeCell).join(','));
  }

  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Renders pure SVG Microscopic Ferrule Endface & Reflectance Vector Visualization.
 */
export function renderFerruleEndfaceSvg(evaluation = {}, options = {}) {
  const evalResult = evaluation.effectiveOrlDb !== undefined
    ? evaluation
    : evaluateOrlReflectance(evaluation);

  const defectId = evalResult.defect?.id || 'NONE';
  const orlDb = evalResult.effectiveOrlDb || 58.0;
  const isPass = evalResult.verdict.id === 'CERTIFIED_PRISTINE' || evalResult.verdict.id === 'ACCEPTABLE_PASS';

  // Needle angle for ORL scale: 0 dB -> -90 deg, 70 dB -> +90 deg
  const needleDeg = Math.max(-90, Math.min(90, ((orlDb - 35) / 35) * 90));

  return `<svg class="ferrule-endface-svg" viewBox="0 0 540 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Microscopic Optical Ferrule Endface Diagram">
    <defs>
      <!-- Gradient for Zirconia Ferrule -->
      <radialGradient id="ferruleBodyGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f8fafc" />
        <stop offset="70%" stop-color="#e2e8f0" />
        <stop offset="100%" stop-color="#cbd5e1" />
      </radialGradient>

      <!-- Gradient for Cladding Zone B -->
      <radialGradient id="claddingGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f0fdf4" />
        <stop offset="85%" stop-color="#dcfce7" />
        <stop offset="100%" stop-color="#bbf7d0" />
      </radialGradient>

      <!-- Core Zone A Glow -->
      <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fbbf24" />
        <stop offset="70%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#d97706" />
      </radialGradient>
    </defs>

    <!-- Dark Studio Background -->
    <rect x="0" y="0" width="540" height="260" rx="8" fill="#0b1120" stroke="#334155" />

    <!-- Left Header -->
    <g transform="translate(16, 22)">
      <text x="0" y="0" font-size="11" font-weight="800" fill="#f8fafc" letter-spacing="0.5">IEC 61300-3-35 MICROSCOPIC ENDFACE INSPECTION</text>
      <text x="0" y="14" font-size="9" fill="#94a3b8">Polish: ${evalResult.polish.name} · Wavelength: ${evalResult.wavelengthNm} nm</text>
    </g>

    <!-- Concentric Ferrule Endface Section (Left/Center) -->
    <g transform="translate(130, 145)">
      <!-- Zone D: Ferrule Ceramic Body (r = 95) -->
      <circle cx="0" cy="0" r="95" fill="url(#ferruleBodyGrad)" stroke="#94a3b8" stroke-width="2" />
      <text x="0" y="-80" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">Zone D: Ferrule (125–250µm)</text>

      <!-- Zone C: Epoxy Adhesive Ring (r = 65) -->
      <circle cx="0" cy="0" r="65" fill="#334155" stroke="#475569" stroke-width="1.5" />
      <text x="0" y="-52" font-size="7" font-weight="600" fill="#94a3b8" text-anchor="middle">Zone C: Adhesive</text>

      <!-- Zone B: Silica Cladding (r = 45) -->
      <circle cx="0" cy="0" r="45" fill="url(#claddingGrad)" stroke="#16a34a" stroke-width="1.5" />
      <text x="0" y="-32" font-size="7" font-weight="700" fill="#15803d" text-anchor="middle">Zone B: Cladding</text>

      <!-- Zone A: Fiber Core (r = 16) -->
      <circle cx="0" cy="0" r="16" fill="url(#coreGlow)" stroke="#b45309" stroke-width="1" />
      <text x="0" y="3" font-size="8" font-weight="800" fill="#ffffff" text-anchor="middle">Core</text>

      <!-- Defect Overlay Artifacts -->
      ${defectId === 'CORE_SCRATCH' ? `
        <!-- Scratches cutting across Zone A Core -->
        <line x1="-30" y1="-12" x2="35" y2="15" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
        <line x1="-15" y1="20" x2="25" y2="-22" stroke="#dc2626" stroke-width="2" stroke-linecap="round" />
        <circle cx="5" cy="2" r="5" fill="#ef4444" fill-opacity="0.6" />
      ` : defectId === 'DUST_SPECS' ? `
        <!-- Airborne dust particulates in Zone B & D -->
        <circle cx="-25" cy="-20" r="3" fill="#475569" />
        <circle cx="-20" cy="-24" r="2" fill="#334155" />
        <circle cx="30" cy="-15" r="3.5" fill="#1e293b" />
        <circle cx="24" cy="28" r="4" fill="#334155" />
        <circle cx="-35" cy="30" r="2.5" fill="#475569" />
        <circle cx="10" cy="-38" r="3" fill="#1e293b" />
      ` : defectId === 'OIL_SMUDGE' ? `
        <!-- Fingerprint skin oil film -->
        <ellipse cx="5" cy="5" rx="38" ry="22" fill="#ca8a04" fill-opacity="0.38" stroke="#eab308" stroke-width="1.5" stroke-dasharray="3,2" />
        <circle cx="-12" cy="8" r="8" fill="#eab308" fill-opacity="0.4" />
      ` : defectId === 'CHIPPED_EDGE' ? `
        <!-- Fracture notch at Zone D boundary -->
        <path d="M 65,-65 Q 95,-35 80,-15 Z" fill="#ef4444" fill-opacity="0.75" stroke="#b91c1c" stroke-width="2" />
        <line x1="60" y1="-70" x2="45" y2="-45" stroke="#ef4444" stroke-width="2" />
      ` : defectId === 'ISOPROPYL_RESIDUE' ? `
        <!-- Evaporated alcohol watermark halo -->
        <circle cx="2" cy="0" r="28" fill="none" stroke="#38bdf8" stroke-width="3" stroke-opacity="0.7" stroke-dasharray="4,3" />
        <circle cx="0" cy="0" r="24" fill="#38bdf8" fill-opacity="0.15" />
      ` : `
        <!-- Pristine clean core tick -->
        <circle cx="0" cy="0" r="6" fill="#22c55e" />
        <text x="0" y="2" font-size="7" font-weight="900" fill="#ffffff" text-anchor="middle">✓</text>
      `}
    </g>

    <!-- Right Side: Dial Gauge & Reflectance Spectrum -->
    <g transform="translate(265, 30)">
      <!-- ORL Needle Gauge Container -->
      <rect x="0" y="0" width="255" height="135" rx="6" fill="#1e293b" stroke="#334155" />
      
      <text x="14" y="20" font-size="10" font-weight="700" fill="#94a3b8">OPTICAL RETURN LOSS (ORL)</text>
      <text x="240" y="20" font-size="11" font-weight="800" fill="#38bdf8" text-anchor="end">${orlDb.toFixed(1)} dB</text>

      <!-- Gauge Arc Base -->
      <g transform="translate(127, 85)">
        <path d="M -80,0 A 80,80 0 0,1 80,0" fill="none" stroke="#475569" stroke-width="12" stroke-linecap="round" />
        <!-- Color Segments: Critical (<35), Warning (35-50), Pristine (50-70) -->
        <path d="M -78,0 A 78,78 0 0,1 -30,-72" fill="none" stroke="#ef4444" stroke-width="10" />
        <path d="M -30,-72 A 78,78 0 0,1 30,-72" fill="none" stroke="#f59e0b" stroke-width="10" />
        <path d="M 30,-72 A 78,78 0 0,1 78,0" fill="none" stroke="#10b981" stroke-width="10" />

        <!-- Scale Labels -->
        <text x="-80" y="16" font-size="8" fill="#94a3b8" text-anchor="middle">0 dB</text>
        <text x="-30" y="-76" font-size="8" fill="#94a3b8" text-anchor="middle">35 dB</text>
        <text x="30" y="-76" font-size="8" fill="#94a3b8" text-anchor="middle">50 dB</text>
        <text x="80" y="16" font-size="8" fill="#94a3b8" text-anchor="middle">70 dB</text>

        <!-- Gauge Needle -->
        <g transform="rotate(${needleDeg})">
          <line x1="0" y1="0" x2="0" y2="-65" stroke="#f8fafc" stroke-width="3" stroke-linecap="round" />
          <circle cx="0" cy="0" r="6" fill="#f8fafc" />
          <circle cx="0" cy="0" r="3" fill="#0f172a" />
        </g>
      </g>

      <!-- Digital Sub-labels -->
      <text x="14" y="122" font-size="9" fill="#94a3b8">Reflectance (R):</text>
      <text x="86" y="122" font-size="10" font-weight="700" fill="${isPass ? '#10b981' : '#ef4444'}">${evalResult.opticalReflectanceDb} dB (${evalResult.reflectionPpm} ppm)</text>
    </g>

    <!-- Bottom Verdict & Safety Ribbon -->
    <g transform="translate(265, 175)">
      <rect x="0" y="0" width="255" height="70" rx="6" fill="#1e293b" stroke="#334155" />
      
      <text x="12" y="18" font-size="9" font-weight="600" fill="#94a3b8">QA VERDICT</text>
      <text x="12" y="34" font-size="11" font-weight="800" fill="${evalResult.verdict.color}">${evalResult.verdict.label}</text>
      
      <text x="12" y="52" font-size="9" fill="#94a3b8">DFB Laser Risk: <tspan font-weight="700" fill="${evalResult.laserStabilityRisk === 'LOW' ? '#10b981' : evalResult.laserStabilityRisk === 'MODERATE' ? '#f59e0b' : '#ef4444'}">${evalResult.laserStabilityRisk}</tspan></text>
      <text x="12" y="63" font-size="8" fill="#64748b">${evalResult.defect.label}</text>
    </g>
  </svg>`;
}

/**
 * Controller wiring dialog modal, forms, inputs, and action buttons.
 */
export function setupOrlCertModal({
  getState = () => ({}),
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = (msg) => { if (typeof console !== 'undefined') console.log(msg); }
} = {}) {
  if (typeof document === 'undefined') {
    const fallback = {
      open: () => fallback,
      close: () => fallback,
      setCustomer: () => fallback,
      setPolish: () => fallback,
      setMeasuredOrl: () => fallback,
      addDefect: () => fallback,
      refresh: () => fallback,
      recalculate: () => {}
    };
    return fallback;
  }

  const modal = document.getElementById('orlCertModal');
  const closeBtn = document.getElementById('closeOrlCertModalBtn');

  const custSelect = document.getElementById('orlCustomerSelect');
  const techInput = document.getElementById('orlTechInput');
  const polishSelect = document.getElementById('orlPolishSelect');
  const defectSelect = document.getElementById('orlDefectSelect');
  const orlSlider = document.getElementById('orlMeasuredSlider');
  const orlInput = document.getElementById('orlMeasuredInput');
  const notesInput = document.getElementById('orlNotesInput');

  // KPI elements
  const kpiOrl = document.getElementById('orlKpiEffectiveOrl');
  const kpiReflectance = document.getElementById('orlKpiReflectance');
  const kpiLaserRisk = document.getElementById('orlKpiLaserRisk');
  const kpiVerdict = document.getElementById('orlKpiVerdict');

  // Diagram & History
  const svgContainer = document.getElementById('orlFerruleSvgContainer');
  const historyList = document.getElementById('orlHistoryList');

  // Buttons
  const saveBtn = document.getElementById('orlSaveBtn');
  const printBtn = document.getElementById('orlPrintBtn');
  const whatsappBtn = document.getElementById('orlWhatsAppBtn');
  const csvBtn = document.getElementById('orlCsvBtn');

  let activeCustomer = null;
  let activeRecord = null;

  function recalculate() {
    const polish = polishSelect?.value || 'SC_APC';
    const defect = defectSelect?.value || 'NONE';
    const measured = Number(orlInput?.value || orlSlider?.value || 58.0);

    const evaluation = evaluateOrlReflectance({
      polishType: polish,
      defectType: defect,
      measuredOrlDb: measured,
      wavelengthNm: 1490
    });

    if (svgContainer) {
      svgContainer.innerHTML = renderFerruleEndfaceSvg(evaluation);
    }

    if (kpiOrl) {
      kpiOrl.textContent = `${evaluation.effectiveOrlDb.toFixed(1)} dB`;
    }

    if (kpiReflectance) {
      kpiReflectance.textContent = `${evaluation.opticalReflectanceDb.toFixed(1)} dB`;
    }

    if (kpiLaserRisk) {
      kpiLaserRisk.textContent = evaluation.laserStabilityRisk;
      kpiLaserRisk.style.color = evaluation.laserStabilityRisk === 'LOW' ? '#10b981' : evaluation.laserStabilityRisk === 'MODERATE' ? '#f59e0b' : '#ef4444';
    }

    if (kpiVerdict) {
      kpiVerdict.textContent = evaluation.verdict.label.split(' (')[0];
      kpiVerdict.className = `badge ${evaluation.verdict.badgeClass}`;
      kpiVerdict.style.color = evaluation.verdict.color;
    }

    return evaluation;
  }

  function renderHistory() {
    if (!historyList) return;
    const records = getSavedOrlCerts(storage, activeCustomer?.id);
    if (records.length === 0) {
      historyList.innerHTML = '<li style="padding: 8px; color: var(--muted, #94a3b8); font-size: 12px; text-align: center;">No ORL certificates recorded yet.</li>';
      return;
    }

    historyList.innerHTML = records.slice(0, 15).map(r => `
      <li class="orl-cert-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: rgba(15, 23, 42, 0.4); border-radius: 6px; border: 1px solid var(--border, #334155); margin-bottom: 6px; font-size: 12px;">
        <div>
          <span style="font-weight: bold; color: #38bdf8;">${r.id}</span> ·
          <span>${r.polishName}</span> ·
          <span style="font-weight: bold; color: #0284c7;">${r.effectiveOrlDb} dB</span> ·
          <span style="color: ${r.verdictColor || '#10b981'}; font-weight: bold;">${r.verdictLabel.split(' (')[0]}</span>
          <div style="font-size: 11px; color: var(--muted, #94a3b8);">${r.inspectionDate} by ${r.technicianName}</div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="icon-button btn-print-single" data-cert-id="${r.id}" type="button" title="Print Certificate" style="padding: 2px 6px; font-size: 11px;">🖨️</button>
        </div>
      </li>
    `).join('');

    historyList.querySelectorAll('.btn-print-single').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-cert-id');
        const c = records.find(x => x.id === id);
        if (c) printCert(c);
      };
    });
  }

  function setCustomerContext(cust) {
    activeCustomer = cust;
    if (custSelect && cust) {
      custSelect.value = cust.id;
    }
    recalculate();
    renderHistory();
  }

  function printCert(cert) {
    const html = generateOrlCertHtml(cert, { format: 'a4' });
    const win = window.open ? window.open('', '_blank') : null;
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>ORL QA Certificate - ${cert.id}</title>
          <style>body { margin: 15px; background: #fff; }</style>
        </head>
        <body>
          ${html}
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `);
      win.document.close();
    } else if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  // Hook input changes
  if (orlSlider) {
    orlSlider.oninput = (e) => {
      if (orlInput) orlInput.value = e.target.value;
      recalculate();
    };
  }
  if (orlInput) {
    orlInput.oninput = (e) => {
      if (orlSlider) orlSlider.value = e.target.value;
      recalculate();
    };
  }
  if (polishSelect) polishSelect.onchange = recalculate;
  if (defectSelect) defectSelect.onchange = recalculate;

  if (saveBtn) {
    saveBtn.onclick = () => {
      const state = getState();
      const currentCust = activeCustomer || state?.customers?.find(c => c.id === custSelect?.value) || state?.customers?.[0];
      const formData = {
        customerId: currentCust?.id || 'CUST-GENERAL',
        customerName: currentCust?.name || 'Walk-in Subscriber',
        customerPhone: currentCust?.phone || '',
        customerArea: currentCust?.area || 'Shahdara Town',
        technicianName: techInput?.value || 'Lineman Bilal',
        connectorPolish: polishSelect?.value || 'SC_APC',
        defectType: defectSelect?.value || 'NONE',
        measuredOrlDb: Number(orlInput?.value || orlSlider?.value || 58.0),
        wavelengthNm: 1490,
        notes: notesInput?.value || ''
      };

      const val = validateOrlCertification(formData);
      if (!val.valid) {
        onToast(Object.values(val.errors)[0]);
        return;
      }

      const allCerts = getSavedOrlCerts(storage);
      const record = buildOrlCertRecord(formData, allCerts.length);
      saveOrlCert(storage, record);
      activeRecord = record;
      renderHistory();
      onToast(`✓ Recorded ORL Certificate #${record.id} (${record.verdictLabel.split(' (')[0]})`);
    };
  }

  if (printBtn) {
    printBtn.onclick = () => {
      const all = getSavedOrlCerts(storage, activeCustomer?.id);
      const target = activeRecord || all[0];
      if (!target) {
        onToast('Please save or select a certification record first.');
        return;
      }
      printCert(target);
    };
  }

  if (whatsappBtn) {
    whatsappBtn.onclick = async () => {
      const all = getSavedOrlCerts(storage, activeCustomer?.id);
      const target = activeRecord || all[0];
      if (!target) {
        onToast('Please save or select a certification record first.');
        return;
      }
      const text = formatOrlCertWhatsApp(target);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          onToast('✓ WhatsApp ORL Certificate copied to clipboard');
        } catch (_) {
          onToast('Generated WhatsApp certificate');
        }
      }
    };
  }

  if (csvBtn) {
    csvBtn.onclick = () => {
      const all = getSavedOrlCerts(storage);
      if (all.length === 0) {
        onToast('No ORL records to export');
        return;
      }
      const csv = generateOrlCertsCsv(all);
      const filename = `shahdara_orl_certs_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast(`Exported ${filename}`);
    };
  }

  // Trigger buttons
  document.querySelectorAll('[data-open-orl-cert], #openOrlCertBtn').forEach(btn => {
    btn.onclick = () => {
      const state = getState();
      const cust = activeCustomer || state?.customers?.[0] || null;
      setCustomerContext(cust);
      if (typeof modal?.showModal === 'function') modal.showModal();
      else modal?.setAttribute('open', '');
    };
  });

  if (closeBtn) {
    closeBtn.onclick = () => {
      if (typeof modal?.close === 'function') modal.close();
      else modal?.removeAttribute('open');
    };
  }

  const controller = {
    open: (cust) => {
      setCustomerContext(cust);
      if (typeof modal?.showModal === 'function') modal.showModal();
      else modal?.setAttribute('open', '');
      return controller;
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else modal?.removeAttribute('open');
      return controller;
    },
    setCustomer: (cust) => {
      setCustomerContext(cust);
      return controller;
    },
    setPolish: (p) => {
      if (polishSelect) polishSelect.value = p;
      recalculate();
      return controller;
    },
    setMeasuredOrl: (o) => {
      if (orlInput) orlInput.value = o;
      if (orlSlider) orlSlider.value = o;
      recalculate();
      return controller;
    },
    addDefect: (d) => {
      if (defectSelect) defectSelect.value = d;
      recalculate();
      return controller;
    },
    refresh: () => {
      recalculate();
      renderHistory();
      return controller;
    },
    recalculate
  };

  return controller;
}
