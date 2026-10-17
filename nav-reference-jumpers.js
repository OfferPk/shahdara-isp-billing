/**
 * Shahdara ISP - Field Optical Reference Test Cords (TRC / Reference Jumpers) & Zero-Loss Baseline Referencing Assistant
 *
 * Provides FTTH optical test technicians, field linesmen, and certification inspectors with:
 * - IEC 61280-4-1, TIA-526-14-C, and ISO/IEC 14763-3 Tier-1 OLTS referencing metrology
 * - Method A (1-Jumper), Method B (2-Jumper), and Method C (3-Jumper) reference calibration
 * - Reference Grade Test Cord (TRC) qualification (IL <= 0.10 dB, ORL >= 65 dB, concentricity < 0.5 µm)
 * - Reference verification verification loss check (<= 0.20 dB mated pair threshold)
 * - Pure-vector responsive SVG schematic depicting Light Source, TRC cords, mating sleeves, and OPM
 * - LocalStorage persistence (shahdara_reference_jumpers_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const REF_JUMPERS_STORAGE_KEY = 'shahdara_reference_jumpers_audits_v1';

export const REFERENCING_METHODS = {
  METHOD_A_1_JUMPER: {
    id: 'METHOD_A_1_JUMPER',
    name: 'Method A: 1-Jumper Reference (Measures Both End Connectors)',
    standard: 'IEC 61280-4-1 / TIA-526-14-C Method A',
    jumpersUsed: 1,
    description: 'Reference set with 1 launch cord. Measures fiber link plus both patch panel terminal connections. Recommended for FTTH drop certification.',
    terminalConnectionsIncluded: 2,
    formula: 'Link Loss = Measured Power - P_ref'
  },
  METHOD_B_2_JUMPER: {
    id: 'METHOD_B_2_JUMPER',
    name: 'Method B: 2-Jumper Reference with Adapter (Measures One End Connector)',
    standard: 'IEC 61280-4-1 / TIA-526-14-C Method B',
    jumpersUsed: 2,
    description: 'Reference set with launch and receive cords connected via reference adapter. Measures fiber link plus one end connection.',
    terminalConnectionsIncluded: 1,
    formula: 'Link Loss = Measured Power - P_ref (Adjusted for 1 connector)'
  },
  METHOD_C_3_JUMPER: {
    id: 'METHOD_C_3_JUMPER',
    name: 'Method C: 3-Jumper Reference (Zero Terminal Connector Offset)',
    standard: 'IEC 61280-4-1 / TIA-526-14-C Method C',
    jumpersUsed: 3,
    description: 'Reference set with 3 cords and 2 adapters. Excludes both terminal mated connections; isolates installed fiber cable and intermediate splices only.',
    terminalConnectionsIncluded: 0,
    formula: 'Link Loss = Measured Power - P_ref (Excludes both end bulkheads)'
  }
};

export const JUMPER_GRADES = {
  SC_APC_REF: {
    id: 'SC_APC_REF',
    name: 'SC/APC Grade-A Reference Jumper (0.10 dB Max IL / 65 dB ORL)',
    maxInsertionLossDb: 0.10,
    minReturnLossDb: 65,
    concentricityMicrons: 0.3,
    ferruleMaterial: 'Precision Zirconia Ceramic',
    isReferenceGrade: true
  },
  SC_UPC_REF: {
    id: 'SC_UPC_REF',
    name: 'SC/UPC Grade-A Reference Jumper (0.10 dB Max IL / 55 dB ORL)',
    maxInsertionLossDb: 0.10,
    minReturnLossDb: 55,
    concentricityMicrons: 0.3,
    ferruleMaterial: 'Precision Zirconia Ceramic',
    isReferenceGrade: true
  },
  LC_APC_REF: {
    id: 'LC_APC_REF',
    name: 'LC/APC Grade-A Reference Jumper (0.10 dB Max IL / 65 dB ORL)',
    maxInsertionLossDb: 0.10,
    minReturnLossDb: 65,
    concentricityMicrons: 0.3,
    ferruleMaterial: 'Precision Zirconia Ceramic',
    isReferenceGrade: true
  },
  STANDARD_PATCH_CORD: {
    id: 'STANDARD_PATCH_CORD',
    name: 'Standard Commercial Patch Cord (0.35 dB Typ IL / 50 dB ORL)',
    maxInsertionLossDb: 0.40,
    minReturnLossDb: 50,
    concentricityMicrons: 1.2,
    ferruleMaterial: 'Standard Ceramic',
    isReferenceGrade: false
  }
};

export const REF_JUMPERS_PRESETS = [
  {
    id: 'shahdara-olt-trc-1jumper',
    name: 'Shahdara OLT Port Baseline 1-Jumper Method A (SC/APC Reference)',
    area: 'Shahdara Core',
    method: 'METHOD_A_1_JUMPER',
    launchJumper: 'SC_APC_REF',
    tailJumper: 'SC_APC_REF',
    wavelengthNm: 1310,
    referencePowerDbm: -3.00,
    trcVerificationLossDb: 0.08,
    measuredLinkPowerDbm: -18.45,
    technician: 'Rashid Mahmood (Fiber Lead)',
    notes: 'Tier-1 OLTS baseline referencing for FTTH feeder cable drop certification.'
  },
  {
    id: 'begum-kot-fat-2jumper',
    name: 'Begum Kot Distribution Ring FAT Drop 2-Jumper Method B',
    area: 'Begum Kot',
    method: 'METHOD_B_2_JUMPER',
    launchJumper: 'SC_UPC_REF',
    tailJumper: 'SC_APC_REF',
    wavelengthNm: 1550,
    referencePowerDbm: -4.50,
    trcVerificationLossDb: 0.12,
    measuredLinkPowerDbm: -16.20,
    technician: 'Arshad Ali (Senior Tech)',
    notes: 'Distribution ring fiber testing with hybrid SC/UPC to SC/APC reference cords.'
  },
  {
    id: 'ravi-siphon-backhaul-3jumper',
    name: 'Ravi Siphon High-Span Trunk 3-Jumper Method C (Zero-End Offset)',
    area: 'Ravi Siphon',
    method: 'METHOD_C_3_JUMPER',
    launchJumper: 'LC_APC_REF',
    tailJumper: 'LC_APC_REF',
    wavelengthNm: 1550,
    referencePowerDbm: -2.00,
    trcVerificationLossDb: 0.06,
    measuredLinkPowerDbm: -8.85,
    technician: 'Sajjad Malik',
    notes: 'Long-haul metro span baseline excluding terminal test jumper insertion loss.'
  },
  {
    id: 'worn-jumper-rejection-alert',
    name: 'Worn Commercial Patch Cord Rejection Alert (0.42 dB Excessive Loss)',
    area: 'Jia Musa',
    method: 'METHOD_A_1_JUMPER',
    launchJumper: 'STANDARD_PATCH_CORD',
    tailJumper: 'SC_APC_REF',
    wavelengthNm: 1310,
    referencePowerDbm: -3.50,
    trcVerificationLossDb: 0.42, // Exceeds 0.20 dB limit!
    measuredLinkPowerDbm: -19.00,
    technician: 'Tariq Butt',
    notes: 'Commercial cord used as TRC; failed verification test with excessive insertion loss.'
  }
];

/**
 * Calculates optical link attenuation and evaluates TRC reference jumper compliance.
 */
export function calculateReferenceJumpersMetrics(params = {}) {
  const methodId = params.method || 'METHOD_A_1_JUMPER';
  const method = REFERENCING_METHODS[methodId] || REFERENCING_METHODS.METHOD_A_1_JUMPER;

  const launchGradeId = params.launchJumper || 'SC_APC_REF';
  const tailGradeId = params.tailJumper || 'SC_APC_REF';
  const launchJumper = JUMPER_GRADES[launchGradeId] || JUMPER_GRADES.SC_APC_REF;
  const tailJumper = JUMPER_GRADES[tailGradeId] || JUMPER_GRADES.SC_APC_REF;

  const wavelengthNm = parseInt(params.wavelengthNm, 10) || 1310;
  const referencePowerDbm = parseFloat(params.referencePowerDbm) || -3.00;
  const trcVerificationLossDb = parseFloat(params.trcVerificationLossDb) || 0.08;
  const measuredLinkPowerDbm = parseFloat(params.measuredLinkPowerDbm) || -18.45;

  // Maximum allowed verification loss for reference cords mated pair (IEC standard <= 0.20 dB for SMF)
  const maxAllowedVerificationLossDb = 0.20;
  const trcVerificationPass = trcVerificationLossDb <= maxAllowedVerificationLossDb;

  let trcQualityRating = 'EXCELLENT';
  if (trcVerificationLossDb <= 0.10) {
    trcQualityRating = 'EXCELLENT (Ultra-Low Loss Grade-A TRC)';
  } else if (trcVerificationLossDb <= maxAllowedVerificationLossDb) {
    trcQualityRating = 'ACCEPTABLE (Within Standard 0.20 dB Limit)';
  } else if (trcVerificationLossDb <= 0.30) {
    trcQualityRating = 'MARGINAL (Clean & Re-Inspect Connectors)';
  } else {
    trcQualityRating = 'REJECTED (Worn / Contaminated / Non-TRC Cord)';
  }

  // Calculated link attenuation
  // Link Loss (dB) = Reference Power (dBm) - Measured Link Power (dBm)
  const calculatedLinkLossDb = Math.round((referencePowerDbm - measuredLinkPowerDbm) * 100) / 100;

  // Accuracy penalty if TRC is not reference grade
  let measurementUncertaintyDb = 0.15;
  if (!launchJumper.isReferenceGrade || !tailJumper.isReferenceGrade) {
    measurementUncertaintyDb += 0.35;
  }
  if (!trcVerificationPass) {
    measurementUncertaintyDb += 0.50;
  }

  // Pass / fail evaluation for typical FTTH drop span budget (target <= 20.0 dB)
  const maxSpanLossBudgetDb = 20.0;
  const spanLossPass = calculatedLinkLossDb <= maxSpanLossBudgetDb;

  let status = 'COMPLIANT';
  if (!trcVerificationPass) {
    status = 'TRC_REJECTED';
  } else if (!spanLossPass) {
    status = 'LINK_EXCESSIVE_LOSS';
  } else if (calculatedLinkLossDb > 16.0) {
    status = 'LINK_MARGINAL';
  }

  return {
    method,
    launchJumper,
    tailJumper,
    wavelengthNm,
    referencePowerDbm,
    trcVerificationLossDb,
    maxAllowedVerificationLossDb,
    trcVerificationPass,
    trcQualityRating,
    measuredLinkPowerDbm,
    calculatedLinkLossDb,
    measurementUncertaintyDb: Math.round(measurementUncertaintyDb * 100) / 100,
    maxSpanLossBudgetDb,
    spanLossPass,
    status
  };
}

/**
 * Renders pure-vector SVG schematic depicting OLTS Light Source, TRC cords, reference adapters, and OPM.
 */
export function renderReferenceJumpersSvg(metrics, options = {}) {
  const isDark = options.isDark ?? false;
  const m = metrics || calculateReferenceJumpersMetrics();

  const width = 760;
  const height = 280;

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  // Quality indicator color
  let trcColor = '#10b981'; // Green
  if (m.trcVerificationLossDb > m.maxAllowedVerificationLossDb) {
    trcColor = '#ef4444'; // Red
  } else if (m.trcVerificationLossDb > 0.10) {
    trcColor = '#f59e0b'; // Amber
  }

  // Component coordinates
  const slsX = 60;
  const opmX = width - 130;
  const yCenter = 100;

  return `
  <svg class="ref-jumpers-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Reference Test Cords and Referencing Method Diagram">
    <!-- Background Canvas -->
    <rect width="${width}" height="${height}" rx="10" fill="${bgColor}" stroke="${borderColor}" stroke-width="1.5"/>

    <!-- Header Section -->
    <g transform="translate(30, 26)">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="700" fill="${textPrimary}">
        ${m.method.name}
      </text>
      <text x="0" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="500" fill="${textMuted}">
        Wavelength: ${m.wavelengthNm} nm · Reference Power P_ref: ${m.referencePowerDbm.toFixed(2)} dBm · Standard: ${m.method.standard}
      </text>
      <!-- TRC Verification Badge -->
      <g transform="translate(${width - 270}, -10)">
        <rect width="210" height="26" rx="13" fill="${trcColor}" fill-opacity="0.15" stroke="${trcColor}" stroke-width="1.5"/>
        <circle cx="14" cy="13" r="5" fill="${trcColor}"/>
        <text x="26" y="17" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${trcColor}">
          TRC VERIF: ${m.trcVerificationLossDb.toFixed(2)} dB (${m.trcVerificationPass ? 'PASS' : 'FAIL'})
        </text>
      </g>
    </g>

    <!-- Schematic Drawing -->
    <g>
      <!-- Stabilized Light Source (SLS) Unit -->
      <g transform="translate(${slsX}, ${yCenter})">
        <rect x="-40" y="-35" width="80" height="70" rx="8" fill="${cardBg}" stroke="${borderColor}" stroke-width="2"/>
        <circle cx="0" cy="-6" r="14" fill="#3b82f6" fill-opacity="0.15" stroke="#3b82f6" stroke-width="1.5"/>
        <text x="0" y="-2" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#3b82f6">SLS</text>
        <text x="0" y="16" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">Laser Source</text>
        <text x="0" y="27" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="500" fill="${textMuted}">P_ref: ${m.referencePowerDbm} dBm</text>
      </g>

      <!-- Launch TRC Cord -->
      <path d="M ${slsX + 40} ${yCenter} Q 210 ${yCenter - 25} 300 ${yCenter}" fill="none" stroke="#10b981" stroke-width="3"/>
      <rect x="160" y="${yCenter - 38}" width="120" height="18" rx="4" fill="${cardBg}" stroke="#10b981" stroke-width="1"/>
      <text x="220" y="${yCenter - 25}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="#10b981">
        Launch TRC (Grade-A)
      </text>

      <!-- Center Mating Sleeve / DUT Link -->
      <g transform="translate(340, ${yCenter})">
        <rect x="-35" y="-25" width="70" height="50" rx="6" fill="${cardBg}" stroke="${trcColor}" stroke-width="1.5"/>
        <text x="0" y="-8" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="${trcColor}">
          ${m.method.jumpersUsed === 1 ? 'Adapter &amp; DUT' : 'Reference Sleeve'}
        </text>
        <text x="0" y="6" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9.5" font-weight="800" fill="${textPrimary}">
          ${m.trcVerificationLossDb.toFixed(2)} dB
        </text>
        <text x="0" y="18" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7" font-weight="600" fill="${textMuted}">
          Mated Jumper IL
        </text>
      </g>

      <!-- Tail TRC Cord -->
      <path d="M 375 ${yCenter} Q 500 ${yCenter + 25} ${opmX - 40} ${yCenter}" fill="none" stroke="#10b981" stroke-width="3"/>
      <rect x="440" y="${yCenter + 18}" width="110" height="18" rx="4" fill="${cardBg}" stroke="#10b981" stroke-width="1"/>
      <text x="495" y="${yCenter + 31}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="#10b981">
        Tail TRC (${m.tailJumper.name.split(' ')[0]})
      </text>

      <!-- Optical Power Meter (OPM) Unit -->
      <g transform="translate(${opmX}, ${yCenter})">
        <rect x="-40" y="-35" width="80" height="70" rx="8" fill="${cardBg}" stroke="${borderColor}" stroke-width="2"/>
        <circle cx="0" cy="-6" r="14" fill="#047857" fill-opacity="0.15" stroke="#047857" stroke-width="1.5"/>
        <text x="0" y="-2" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#047857">OPM</text>
        <text x="0" y="16" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">Power Meter</text>
        <text x="0" y="27" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${trcColor}">Rx: ${m.measuredLinkPowerDbm} dBm</text>
      </g>
    </g>

    <!-- Bottom Telemetry HUD Cards -->
    <g transform="translate(30, ${height - 95})">
      <!-- Card 1: Calculated Link Loss -->
      <rect x="0" y="0" width="165" height="66" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="12" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${textMuted}">CALCULATED LINK LOSS</text>
      <text x="12" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="${textPrimary}">${m.calculatedLinkLossDb} dB</text>
      <text x="12" y="54" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${textMuted}">P_ref - Measured Rx</text>

      <!-- Card 2: TRC Verification Status -->
      <rect x="175" y="0" width="170" height="66" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="187" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${textMuted}">TRC VERIFICATION IL</text>
      <text x="187" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="${trcColor}">${m.trcVerificationLossDb} dB</text>
      <text x="187" y="54" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${textMuted}">Limit: &lt;= 0.20 dB (IEC)</text>

      <!-- Card 3: TRC Rating -->
      <rect x="355" y="0" width="185" height="66" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="367" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${textMuted}">TRC QUALITY RATING</text>
      <text x="367" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="11" font-weight="700" fill="${trcColor}">${m.trcQualityRating.split(' ')[0]}</text>
      <text x="367" y="54" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${textMuted}">Launch: ${m.launchJumper.name.split(' ')[0]}</text>

      <!-- Card 4: Uncertainty -->
      <rect x="550" y="0" width="150" height="66" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="562" y="16" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="600" fill="${textMuted}">UNCERTAINTY</text>
      <text x="562" y="38" font-family="'DM Sans', system-ui, sans-serif" font-size="14" font-weight="700" fill="${textPrimary}">±${m.measurementUncertaintyDb} dB</text>
      <text x="562" y="54" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="500" fill="${textMuted}">Terminal Conn: ${m.method.terminalConnectionsIncluded}</text>
    </g>

    <!-- Footer Status Line -->
    <g transform="translate(30, ${height - 12})">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="600" fill="${textMuted}">
        Compliance Status: <tspan font-weight="700" fill="${trcColor}">${m.status}</tspan> · Reference Grade Core Concentricity: <tspan font-weight="700" fill="${textPrimary}">&lt; 0.5 µm</tspan>
      </text>
      <text x="${width - 60}" y="0" text-anchor="end" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="500" fill="${textMuted}">
        IEC 61280-4-1 / TIA-526-14-C
      </text>
    </g>
  </svg>
  `;
}

/**
 * Loads saved reference jumper audit records from storage.
 */
export function loadReferenceJumpersAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(REF_JUMPERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves reference jumper audit records to storage.
 */
export function saveReferenceJumpersAuditLog(records = [], storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.setItem(REF_JUMPERS_STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
  } catch {}
}

/**
 * Clears saved reference jumper audit records.
 */
export function clearReferenceJumpersAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(REF_JUMPERS_STORAGE_KEY);
  } catch {}
}

/**
 * Generates bilingual WhatsApp text for field dispatch.
 */
export function formatReferenceJumpersWhatsAppText(record) {
  const m = record.metrics;
  const statusEmoji = m.trcVerificationPass ? '✅' : '❌';

  return `*SHAHDARA ISP - OPTICAL TRC REFERENCING AUDIT* ${statusEmoji}
----------------------------------------
*Test ID:* ${record.id}
*Date:* ${record.date}
*Technician:* ${record.technician}
*Area / Node:* ${record.area}
*Referencing Method:* ${m.method.name}

*CALIBRATION & VERIFICATION:*
- Wavelength: ${m.wavelengthNm} nm
- Reference Power (P_ref): ${m.referencePowerDbm} dBm
- TRC Mated Verification Loss: ${m.trcVerificationLossDb} dB (Max: ${m.maxAllowedVerificationLossDb} dB)
- TRC Verification Status: ${m.trcVerificationPass ? 'PASSED (Reference Grade Validated)' : 'FAILED (Worn / Contaminated Cord)'}
- TRC Quality Rating: ${m.trcQualityRating}

*INSTALLED LINK ATTENUATION:*
- Measured Rx Power: ${m.measuredLinkPowerDbm} dBm
- Calculated Link Loss: ${m.calculatedLinkLossDb} dB
- Measurement Uncertainty: ±${m.measurementUncertaintyDb} dB
- Compliance Status: ${m.status}

*URDU SUMMARY / خلاصہ:*
آپٹیکل ٹیسٹ ریفرنس کارڈ (TRC) زیرو-لاس کیلیبریشن ${m.trcVerificationPass ? 'کامیاب رہی' : 'فیل ہو گئی ہے، کیبل تبدیل کریں'}۔ کل لنک لاس ${m.calculatedLinkLossDb} dB ریکارڈ ہوا۔
----------------------------------------
_Shahdara Tier-1 OLTS Certification Dispatch_`;
}

/**
 * Generates RFC-4180 compliant CSV export of audit records.
 */
export function generateReferenceJumpersCsv(records = []) {
  const headers = [
    'TestId',
    'Date',
    'Area',
    'Technician',
    'Method',
    'WavelengthNm',
    'ReferencePowerDbm',
    'TrcVerificationLossDb',
    'TrcPass',
    'MeasuredPowerDbm',
    'CalculatedLinkLossDb',
    'UncertaintyDb',
    'Status',
    'Notes'
  ];

  const rows = records.map(r => {
    const m = r.metrics;
    return [
      r.id,
      `"${r.date}"`,
      `"${r.area}"`,
      `"${r.technician}"`,
      `"${m.method.id}"`,
      m.wavelengthNm,
      m.referencePowerDbm,
      m.trcVerificationLossDb,
      m.trcVerificationPass,
      m.measuredLinkPowerDbm,
      m.calculatedLinkLossDb,
      m.measurementUncertaintyDb,
      `"${m.status}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Modal controller for Field Reference Test Cords Assistant.
 */
export function setupMobileRefJumpersModal(state = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const modal = doc.getElementById('mobileRefJumpersModal');
  const openBtn = doc.getElementById('mobileMoreRefJumpersBtn');
  const closeBtn = doc.getElementById('mobileRefJumpersModalCloseBtn');

  const presetSelect = doc.getElementById('refJumpersPresetSelect');
  const methodSelect = doc.getElementById('refJumpersMethodSelect');
  const launchSelect = doc.getElementById('refJumpersLaunchSelect');
  const tailSelect = doc.getElementById('refJumpersTailSelect');
  const waveSelect = doc.getElementById('refJumpersWavelengthSelect');
  const prefInput = doc.getElementById('refJumpersPrefInput');
  const verifInput = doc.getElementById('refJumpersVerifInput');
  const rxPowerInput = doc.getElementById('refJumpersRxPowerInput');
  const techInput = doc.getElementById('refJumpersTechInput');
  const areaInput = doc.getElementById('refJumpersAreaInput');
  const notesInput = doc.getElementById('refJumpersNotesInput');

  const svgContainer = doc.getElementById('refJumpersSvgContainer');
  const statLoss = doc.getElementById('refJumpersStatLoss');
  const statVerif = doc.getElementById('refJumpersStatVerif');
  const statRating = doc.getElementById('refJumpersStatRating');
  const statUncertainty = doc.getElementById('refJumpersStatUncertainty');

  const saveAuditBtn = doc.getElementById('refJumpersSaveAuditBtn');
  const copyWhatsappBtn = doc.getElementById('refJumpersCopyWhatsappBtn');
  const exportCsvBtn = doc.getElementById('refJumpersExportCsvBtn');
  const clearHistoryBtn = doc.getElementById('refJumpersClearHistoryBtn');
  const historyList = doc.getElementById('refJumpersHistoryList');

  const getParams = () => ({
    method: methodSelect?.value || 'METHOD_A_1_JUMPER',
    launchJumper: launchSelect?.value || 'SC_APC_REF',
    tailJumper: tailSelect?.value || 'SC_APC_REF',
    wavelengthNm: waveSelect?.value || '1310',
    referencePowerDbm: prefInput?.value || '-3.00',
    trcVerificationLossDb: verifInput?.value || '0.08',
    measuredLinkPowerDbm: rxPowerInput?.value || '-18.45'
  });

  const renderView = () => {
    const isDark = doc.documentElement && doc.documentElement.getAttribute('data-theme') === 'dark';
    const params = getParams();
    const metrics = calculateReferenceJumpersMetrics(params);

    if (svgContainer) {
      svgContainer.innerHTML = renderReferenceJumpersSvg(metrics, { isDark });
    }

    if (statLoss) {
      statLoss.textContent = `${metrics.calculatedLinkLossDb} dB`;
    }
    if (statVerif) {
      statVerif.textContent = `${metrics.trcVerificationLossDb} dB (${metrics.trcVerificationPass ? 'PASS' : 'FAIL'})`;
      statVerif.style.color = metrics.trcVerificationPass ? '#10b981' : '#ef4444';
    }
    if (statRating) {
      statRating.textContent = metrics.trcQualityRating.split(' ')[0];
      statRating.style.color = metrics.trcVerificationPass ? '#10b981' : '#ef4444';
    }
    if (statUncertainty) {
      statUncertainty.textContent = `±${metrics.measurementUncertaintyDb} dB`;
    }
  };

  const renderHistory = () => {
    if (!historyList) return;
    const records = loadReferenceJumpersAuditLog(storage);
    if (!records.length) {
      historyList.innerHTML = '<li class="empty-log-item" style="padding: 10px; color: var(--text-muted, #94a3b8); font-size: 0.85rem; text-align: center;">No reference jumper calibrations recorded yet.</li>';
      return;
    }

    historyList.innerHTML = records.map(r => `
      <li class="history-item" style="border: 1px solid var(--border-color, #e2e8f0); border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; font-size: 0.85rem;">
        <div style="display: flex; justify-content: space-between; font-weight: 700;">
          <span>${r.id} · ${r.area}</span>
          <span style="color: ${r.metrics.trcVerificationPass ? '#10b981' : '#ef4444'};">${r.metrics.trcVerificationPass ? 'TRC PASS' : 'TRC FAIL'}</span>
        </div>
        <div style="color: var(--text-muted, #94a3b8); font-size: 0.8rem; margin: 2px 0;">
          ${r.date} · Tech: ${r.technician} · ${r.metrics.method.name.split(':')[0]} · ${r.metrics.wavelengthNm}nm
        </div>
        <div>
          Link Loss: <strong>${r.metrics.calculatedLinkLossDb} dB</strong> · TRC Verif: <strong>${r.metrics.trcVerificationLossDb} dB</strong>
        </div>
      </li>
    `).join('');
  };

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const preset = REF_JUMPERS_PRESETS.find(p => p.id === presetSelect.value);
      if (preset) {
        if (methodSelect) methodSelect.value = preset.method;
        if (launchSelect) launchSelect.value = preset.launchJumper;
        if (tailSelect) tailSelect.value = preset.tailJumper;
        if (waveSelect) waveSelect.value = String(preset.wavelengthNm);
        if (prefInput) prefInput.value = preset.referencePowerDbm;
        if (verifInput) verifInput.value = preset.trcVerificationLossDb;
        if (rxPowerInput) rxPowerInput.value = preset.measuredLinkPowerDbm;
        if (techInput) techInput.value = preset.technician;
        if (areaInput) areaInput.value = preset.area;
        if (notesInput) notesInput.value = preset.notes;
        renderView();
      }
    });
  }

  [methodSelect, launchSelect, tailSelect, waveSelect, prefInput, verifInput, rxPowerInput].forEach(el => {
    if (el) {
      el.addEventListener('change', renderView);
      el.addEventListener('input', renderView);
    }
  });

  if (saveAuditBtn) {
    saveAuditBtn.addEventListener('click', () => {
      const params = getParams();
      const metrics = calculateReferenceJumpersMetrics(params);
      const record = {
        id: `TRC-${Date.now().toString(36).toUpperCase()}`,
        date: new Date().toLocaleString(),
        area: areaInput?.value || 'Shahdara Area',
        technician: techInput?.value || 'Field Technician',
        notes: notesInput?.value || '',
        params,
        metrics
      };
      const records = loadReferenceJumpersAuditLog(storage);
      records.unshift(record);
      saveReferenceJumpersAuditLog(records, storage);
      renderHistory();
      if (typeof options.onToast === 'function') {
        options.onToast('TRC reference audit saved successfully');
      }
    });
  }

  if (copyWhatsappBtn) {
    copyWhatsappBtn.addEventListener('click', () => {
      const params = getParams();
      const metrics = calculateReferenceJumpersMetrics(params);
      const record = {
        id: `TRC-${Date.now().toString(36).toUpperCase()}`,
        date: new Date().toLocaleString(),
        area: areaInput?.value || 'Shahdara Area',
        technician: techInput?.value || 'Field Technician',
        notes: notesInput?.value || '',
        params,
        metrics
      };
      const text = formatReferenceJumpersWhatsAppText(record);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('WhatsApp dispatch copied to clipboard');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const records = loadReferenceJumpersAuditLog(storage);
      if (!records.length) {
        if (typeof options.onToast === 'function') options.onToast('No records to export');
        return;
      }
      const csvStr = generateReferenceJumpersCsv(records);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(csvStr);
      }
      if (typeof options.onToast === 'function') {
        options.onToast('CSV audit export copied to clipboard');
      }
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      clearReferenceJumpersAuditLog(storage);
      renderHistory();
      if (typeof options.onToast === 'function') {
        options.onToast('Calibration history cleared');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      renderView();
      renderHistory();
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    });
  }

  // Initial render
  renderView();
  renderHistory();

  return {
    open: () => {
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
        renderView();
        renderHistory();
      }
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    render: renderView
  };
}
