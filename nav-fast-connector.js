/**
 * Shahdara ISP - Field Optical Fiber Mechanical Fast Connector / Field-Installable Connector (FIC) Assistant
 * 
 * Provides FTTH field technicians, outside plant linesmen, and drop installers with:
 * - IEC 61754-4 / Telcordia GR-326-CORE Fast Connector assembly quality validation
 * - SC/APC (Green) and SC/UPC (Blue) pre-embedded optical fiber stub abutment analysis
 * - Cleave length gauge verification (10.0mm bare glass, 18.0mm buffer, 45.0mm jacket)
 * - Fiber insertion micro-bow / catenary deflection compliance check (1.0 - 2.0 mm)
 * - Index-matching silicone gel condition (fresh, degraded, dry/wiped void) & Fresnel reflection modeling
 * - Tensile pull-out proof strength retention test (≥ 50 N drop cable clamping)
 * - Interactive vector SVG cutaway schematic showing ferrule, stub, gel pool, V-groove, and deflection bow
 * - LocalStorage audit log (shahdara_fast_connector_audits_v1), bilingual WhatsApp dispatch, and CSV export
 */

export const FAST_CONNECTOR_STORAGE_KEY = 'shahdara_fast_connector_audits_v1';

export const FAST_CONNECTOR_TYPES = {
  SC_APC: {
    id: 'SC_APC',
    name: 'SC/APC (8° Angled Physical Contact - Green)',
    housingColor: '#16a34a',
    bootColor: '#15803d',
    nominalIlMaxDb: 0.30,
    nominalRlMinDb: 50.0,
    endfaceTiltDeg: 8.0,
    targetCleaveMm: 10.0,
    targetBufferMm: 18.0,
    targetJacketMm: 45.0
  },
  SC_UPC: {
    id: 'SC_UPC',
    name: 'SC/UPC (Ultra Physical Contact - Blue)',
    housingColor: '#2563eb',
    bootColor: '#1d4ed8',
    nominalIlMaxDb: 0.35,
    nominalRlMinDb: 45.0,
    endfaceTiltDeg: 0.0,
    targetCleaveMm: 10.0,
    targetBufferMm: 18.0,
    targetJacketMm: 45.0
  }
};

export const CONNECTOR_TYPES = FAST_CONNECTOR_TYPES;

export const GEL_CONDITIONS = {
  FRESH: {
    id: 'FRESH',
    name: 'Fresh Factory Index-Matching Gel (Optimal)',
    refractiveIndex: 1.4682,
    gelLossPenaltyDb: 0.05,
    returnLossBonusDb: 5.0,
    description: 'Factory-applied high-purity silicone optical gel fully intact in V-groove reservoir.'
  },
  DEGRADED: {
    id: 'DEGRADED',
    name: 'Partially Degraded / Thermal Void Gel',
    refractiveIndex: 1.4550,
    gelLossPenaltyDb: 0.25,
    returnLossBonusDb: -6.0,
    description: 'Air bubbles, dust ingress, or partial gel drying from summer heat.'
  },
  DRY_WIPED: {
    id: 'DRY_WIPED',
    name: 'Dry / Wiped Out Index Gel (Reused Connector)',
    refractiveIndex: 1.0000, // Air gap
    gelLossPenaltyDb: 0.65,
    returnLossBonusDb: -22.0,
    description: 'Connector reused multiple times; index gel wiped clean, causing severe Fresnel reflections.'
  }
};

export const FAST_CONNECTOR_PRESETS = [
  {
    id: 'shahdara-town-drop-apc',
    name: 'Shahdara Town FAT-08 Drop Cable SC/APC Optimal Termination',
    area: 'Shahdara Town',
    connectorType: 'SC_APC',
    cableType: '2x3mm Outdoor Flat Bow-Type Drop Cable',
    actualCleaveMm: 10.0,
    actualBufferMm: 18.0,
    deflectionBowMm: 1.5,
    cleaveAngleDeg: 0.5,
    gelCondition: 'FRESH',
    clampingForceN: 62,
    technicianName: 'Arshad Ali (Senior OSP Splicer)',
    notes: 'Clean factory cleave using precision bench cleaver. Perfect contact and micro-bow observed.'
  },
  {
    id: 'vandala-road-short-cleave',
    name: 'Vandala Road Aerial Pole SC/UPC Short-Cleave Air Gap Failure',
    area: 'Vandala Road',
    connectorType: 'SC_UPC',
    cableType: '2x3mm Outdoor Flat Drop Cable',
    actualCleaveMm: 8.4, // 1.6mm short
    actualBufferMm: 16.0,
    deflectionBowMm: 0.2, // No micro-bow
    cleaveAngleDeg: 1.2,
    gelCondition: 'FRESH',
    clampingForceN: 52,
    technicianName: 'Tariq Mehmood (Field Tech)',
    notes: 'Technician cut fiber with manual stripper gauge error; fiber did not reach factory stub.'
  },
  {
    id: 'begumkot-dry-gel-reused',
    name: 'Begum Kot Re-used Connector Wiped/Dry Index Gel',
    area: 'Begum Kot',
    connectorType: 'SC_APC',
    cableType: '0.9mm Buffered Pigtail',
    actualCleaveMm: 10.0,
    actualBufferMm: 18.0,
    deflectionBowMm: 1.2,
    cleaveAngleDeg: 0.8,
    gelCondition: 'DRY_WIPED',
    clampingForceN: 55,
    technicianName: 'Hamza Rafiq (Sub-FAT Tech)',
    notes: 'Reused previously scrapped connector; factory index gel wiped off, severe Fresnel reflection.'
  },
  {
    id: 'jiamusa-long-cleave-buckle',
    name: 'Jia Musa Commercial Drop Excessive Cleave Length Buckle',
    area: 'Jia Musa',
    connectorType: 'SC_APC',
    cableType: '3.0mm Round Outdoor Drop Cable',
    actualCleaveMm: 12.2, // 2.2mm too long
    actualBufferMm: 20.0,
    deflectionBowMm: 3.8, // Excessive buckle
    cleaveAngleDeg: 1.8,
    gelCondition: 'FRESH',
    clampingForceN: 42,
    technicianName: 'Zahid Khan (Lineman)',
    notes: 'Over-extended fiber forced into housing, creating sharp macro-bend buckle and micro-cracks.'
  },
  {
    id: 'siphon-high-tension-apc',
    name: 'Ravi Siphon Long-Span Kevlar Clamping Wedge Retention Test',
    area: 'Ravi Siphon',
    connectorType: 'SC_APC',
    cableType: 'Heavy-Duty Aerial Self-Supporting FRP Drop',
    actualCleaveMm: 10.1,
    actualBufferMm: 18.2,
    deflectionBowMm: 1.4,
    cleaveAngleDeg: 0.4,
    gelCondition: 'FRESH',
    clampingForceN: 75,
    technicianName: 'Irfan Ullah (Master Rigger)',
    notes: 'High-tension aerial span termination with heavy-duty Kevlar clamping wedge test passed.'
  }
];

/**
 * Calculates Fast Connector insertion loss, return loss, cleave gap, and mechanical proof integrity
 * @param {Object} inputs - Termination parameters
 * @returns {Object} Calculated metrics and compliance verdicts
 */
export function calculateFastConnectorMetrics(inputs = {}) {
  const cTypeKey = inputs.connectorType || 'SC_APC';
  const cType = CONNECTOR_TYPES[cTypeKey] || CONNECTOR_TYPES.SC_APC;

  const gelKey = inputs.gelCondition || 'FRESH';
  const gel = GEL_CONDITIONS[gelKey] || GEL_CONDITIONS.FRESH;

  const actualCleaveMm = typeof inputs.actualCleaveMm === 'number'
    ? Math.max(5.0, Math.min(16.0, inputs.actualCleaveMm))
    : cType.targetCleaveMm;

  const actualBufferMm = typeof inputs.actualBufferMm === 'number'
    ? Math.max(10.0, Math.min(25.0, inputs.actualBufferMm))
    : cType.targetBufferMm;

  const deflectionBowMm = typeof inputs.deflectionBowMm === 'number'
    ? Math.max(0.0, Math.min(6.0, inputs.deflectionBowMm))
    : 1.5;

  const cleaveAngleDeg = typeof inputs.cleaveAngleDeg === 'number'
    ? Math.max(0.1, Math.min(6.0, inputs.cleaveAngleDeg))
    : 0.5;

  const clampingForceN = typeof inputs.clampingForceN === 'number'
    ? Math.max(5, Math.min(100, Math.round(inputs.clampingForceN)))
    : 55;

  // 1. Cleave Length Delta & Gap Analysis
  // Target is 10.0mm bare fiber
  const cleaveDeltaMm = +(actualCleaveMm - cType.targetCleaveMm).toFixed(2);
  let airGapUm = 0;
  let isCleaveShort = false;
  let isCleaveLong = false;

  if (cleaveDeltaMm < -0.5) {
    isCleaveShort = true;
    airGapUm = Math.round(Math.abs(cleaveDeltaMm) * 1000);
  } else if (cleaveDeltaMm > 0.5) {
    isCleaveLong = true;
  }

  // 2. Micro-Bow / Catenary Deflection Evaluation
  // Ideal range: 1.0mm - 2.0mm
  let bowStatus = 'OPTIMAL';
  let bowPenaltyDb = 0;
  if (deflectionBowMm < 0.5) {
    bowStatus = 'INSUFFICIENT (Floating contact risk)';
    bowPenaltyDb = 0.35;
  } else if (deflectionBowMm > 2.5) {
    bowStatus = 'EXCESSIVE (Macro-bend buckle risk)';
    bowPenaltyDb = +(0.15 * (deflectionBowMm - 2.5)).toFixed(2);
  }

  // 3. Mathematical Insertion Loss Modeling
  // Base stub loss + Air Gap loss + Cleave Angle Loss + Bow Excess + Gel Condition
  const baseStubLossDb = 0.12;

  // Angular misalignment loss: alpha_theta approx 0.045 * theta^2
  const angleLossDb = +(0.045 * Math.pow(cleaveAngleDeg, 2)).toFixed(3);

  // Air gap loss
  let airGapLossDb = 0;
  if (airGapUm > 0) {
    if (gelKey === 'FRESH') {
      airGapLossDb = +(0.05 + 0.0008 * airGapUm).toFixed(3);
    } else if (gelKey === 'DEGRADED') {
      airGapLossDb = +(0.18 + 0.0018 * airGapUm).toFixed(3);
    } else {
      // Dry gel / Air gap
      airGapLossDb = +(0.45 + 0.0035 * airGapUm).toFixed(3);
    }
  }

  const calculatedIlDb = +(baseStubLossDb + angleLossDb + airGapLossDb + bowPenaltyDb + gel.gelLossPenaltyDb).toFixed(2);

  // 4. Mathematical Return Loss Modeling
  // Nominal return loss: APC >= 50dB, UPC >= 45dB
  let calculatedRlDb = +(cType.nominalRlMinDb + gel.returnLossBonusDb - (cleaveAngleDeg * 2.0)).toFixed(1);

  if (airGapUm > 200 || gelKey === 'DRY_WIPED') {
    // Severe Fresnel reflection
    calculatedRlDb = Math.min(calculatedRlDb, Math.max(14.7, +(26.0 - Math.min(10.0, airGapUm / 100)).toFixed(1)));
  }

  // 5. Tensile Strength Retention Verdict
  const minRequiredForceN = 50;
  const isTensileProofPass = clampingForceN >= minRequiredForceN;

  // 6. Overall Quality Rating & Pass/Fail
  const isIlPass = calculatedIlDb <= cType.nominalIlMaxDb;
  const isRlPass = calculatedRlDb >= (cType.id === 'SC_APC' ? 50.0 : 40.0);
  const isOverallPass = isIlPass && isRlPass && isTensileProofPass && !isCleaveShort && !isCleaveLong && (deflectionBowMm >= 0.5 && deflectionBowMm <= 2.8);

  let qualityRating = 'EXCELLENT';
  let ratingColor = '#10b981';

  if (!isOverallPass) {
    if (calculatedIlDb > 1.0 || calculatedRlDb < 30 || !isTensileProofPass || isCleaveShort) {
      qualityRating = 'FAIL (Re-terminate Immediately)';
      ratingColor = '#ef4444';
    } else {
      qualityRating = 'MARGINAL (Action Required)';
      ratingColor = '#f59e0b';
    }
  } else if (calculatedIlDb > 0.25 || calculatedRlDb < 52) {
    qualityRating = 'ACCEPTABLE';
    ratingColor = '#3b82f6';
  }

  return {
    connectorType: cType,
    gelCondition: gel,
    actualCleaveMm,
    actualBufferMm,
    deflectionBowMm,
    cleaveAngleDeg,
    clampingForceN,

    // Dynamics & Discrepancies
    cleaveDeltaMm,
    airGapUm,
    isCleaveShort,
    isCleaveLong,
    bowStatus,

    // Attenuation & Return Loss
    baseStubLossDb,
    angleLossDb,
    airGapLossDb,
    calculatedIlDb,
    calculatedRlDb,

    // Verification Verdicts
    isIlPass,
    isRlPass,
    isTensileProofPass,
    isOverallPass,
    qualityRating,
    ratingColor
  };
}

/**
 * Pure-vector SVG cutaway visualizer for Fast Connector internal assembly
 * @param {Object} dynamics - Output of calculateFastConnectorMetrics
 * @param {Object} options - SVG dimensions and layout options
 * @returns {string} SVG markup
 */
export function renderFastConnectorDiagramSvg(dynamics, options = {}) {
  if (!dynamics) return '';

  const width = options.width || 720;
  const height = options.height || 260;

  const c = dynamics.connectorType;
  const gel = dynamics.gelCondition;
  const isPass = dynamics.isOverallPass;
  const ratingColor = dynamics.ratingColor;

  // Micro-bow deflection arc calculation
  const bowApex = Math.min(25, Math.max(0, dynamics.deflectionBowMm * 8));

  return `<svg class="fast-connector-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Fast Connector Mechanical Assembly Cutaway" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fcHousingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${c.housingColor}"/>
        <stop offset="100%" stop-color="${c.bootColor}"/>
      </linearGradient>
      <linearGradient id="fcFerruleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="100%" stop-color="#cbd5e1"/>
      </linearGradient>
      <linearGradient id="fcGelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.9"/>
      </linearGradient>
      <filter id="fcGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Background Canvas -->
    <rect width="${width}" height="${height}" rx="10" fill="#090d16"/>

    <!-- Header Details -->
    <g transform="translate(24, 22)">
      <text x="0" y="0" fill="#f8fafc" font-size="13" font-weight="700" font-family="system-ui, sans-serif">FAST CONNECTOR MECHANICAL ASSEMBLY · ${c.name}</text>
      <text x="0" y="16" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">Standard: IEC 61754-4 · V-Groove Index Gel: <tspan fill="#38bdf8" font-weight="600">${gel.name}</tspan></text>
    </g>

    <!-- Quality Rating Badge Top Right -->
    <g transform="translate(${width - 170}, 14)">
      <rect x="0" y="0" width="146" height="28" rx="6" fill="#0f172a" stroke="${ratingColor}" stroke-width="1.5" filter="url(#fcGlow)"/>
      <circle cx="14" cy="14" r="5" fill="${ratingColor}"/>
      <text x="26" y="18" fill="${ratingColor}" font-size="11" font-weight="800" font-family="system-ui">${dynamics.qualityRating.split(' ')[0]}</text>
    </g>

    <!-- Longitudinal Cutaway Assembly Graphic -->
    <g transform="translate(40, 60)">
      <!-- Outer Connector Body / Housing Outer Bounds -->
      <rect x="0" y="10" width="540" height="90" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>

      <!-- Ceramic Zirconia Ferrule (Left 0 to 110) -->
      <path d="M 0,25 L 110,25 L 110,85 L 0,85 Z" fill="url(#fcFerruleGrad)" stroke="#94a3b8" stroke-width="1.5"/>
      <!-- Angled Endface for APC -->
      ${c.id === 'SC_APC' ? `
      <polygon points="0,25 6,25 0,85" fill="#16a34a"/>
      ` : ''}
      <text x="35" y="58" fill="#475569" font-size="10" font-weight="800" font-family="system-ui">FERRULE</text>

      <!-- Pre-Embedded Factory Fiber Stub (Center x=0 to 140) -->
      <rect x="0" y="52" width="140" height="6" fill="#f59e0b"/>
      <line x1="0" y1="55" x2="140" y2="55" stroke="#ffffff" stroke-width="1.5"/>

      <!-- Precision V-Groove Alignment Bed (130 to 240) -->
      <rect x="130" y="35" width="110" height="40" rx="4" fill="#0f172a" stroke="#475569" stroke-width="1.5"/>
      <text x="145" y="47" fill="#94a3b8" font-size="9" font-weight="700" font-family="system-ui">V-GROOVE BED</text>

      <!-- Index-Matching Gel Pool (138 to 150) -->
      <rect x="138" y="48" width="16" height="14" rx="2" fill="url(#fcGelGrad)"/>
      <text x="146" y="70" fill="#06b6d4" font-size="8" font-weight="800" text-anchor="middle" font-family="system-ui">GEL</text>

      <!-- Field-Inserted Fiber (Entering from right x=530 to 142) -->
      <!-- 1. Outer Jacket Drop Cable (360 to 540) -->
      <rect x="360" y="30" width="180" height="50" rx="4" fill="#020617" stroke="#334155" stroke-width="1"/>
      <text x="430" y="60" fill="#64748b" font-size="10" font-weight="700" font-family="system-ui">DROP CABLE</text>

      <!-- 2. 250um/900um Buffer Strip (260 to 360) -->
      <rect x="260" y="45" width="100" height="20" rx="3" fill="#3b82f6"/>
      <text x="285" y="59" fill="#ffffff" font-size="9" font-weight="700" font-family="system-ui">BUFFER</text>

      <!-- 3. Bare Glass Fiber with Micro-Bow Deflection Arc (142 to 260) -->
      <!-- Abutment Point or Gap -->
      ${dynamics.airGapUm > 0 ? `
      <!-- Visible Air Gap Warning -->
      <rect x="140" y="50" width="8" height="10" fill="#ef4444"/>
      <line x1="148" y1="55" x2="260" y2="55" stroke="#f59e0b" stroke-width="4"/>
      <line x1="148" y1="55" x2="260" y2="55" stroke="#ffffff" stroke-width="1.5"/>
      ` : `
      <!-- Continuous Glass with Micro-Bow Arc -->
      <path d="M 140,55 Q 200,${55 - bowApex} 260,55" fill="none" stroke="#f59e0b" stroke-width="4"/>
      <path d="M 140,55 Q 200,${55 - bowApex} 260,55" fill="none" stroke="#ffffff" stroke-width="1.5"/>
      `}

      <!-- Deflection Indicator Callout -->
      <path d="M 200,${55 - bowApex - 5} L 200,20" stroke="#10b981" stroke-width="1.5" stroke-dasharray="3,2"/>
      <circle cx="200" cy="${55 - bowApex}" r="3" fill="#10b981"/>
      <text x="200" y="15" fill="#10b981" font-size="9" font-weight="800" text-anchor="middle" font-family="system-ui">BOW: ${dynamics.deflectionBowMm.toFixed(1)}mm</text>

      <!-- Rear Clamping Wedge / Lock Cam (340 to 380) -->
      <rect x="340" y="25" width="28" height="60" rx="4" fill="#eab308" stroke="#ca8a04" stroke-width="1.5"/>
      <text x="354" y="58" fill="#713f12" font-size="8" font-weight="800" text-anchor="middle" font-family="system-ui">LOCK</text>
    </g>

    <!-- Bottom Telemetry Metric Gauges -->
    <g transform="translate(24, 182)">
      <!-- Box 1: Insertion Loss -->
      <rect x="0" y="0" width="160" height="54" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="12" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">INSERTION LOSS (IL)</text>
      <text x="12" y="36" fill="${dynamics.isIlPass ? '#10b981' : '#ef4444'}" font-size="14" font-weight="800" font-family="system-ui">${dynamics.calculatedIlDb.toFixed(2)} dB</text>
      <text x="12" y="48" fill="#64748b" font-size="9" font-family="system-ui">Limit: ≤ ${c.nominalIlMaxDb.toFixed(2)} dB</text>

      <!-- Box 2: Return Loss -->
      <rect x="170" y="0" width="160" height="54" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="12" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">RETURN LOSS (RL)</text>
      <text x="12" y="36" fill="${dynamics.isRlPass ? '#38bdf8' : '#ef4444'}" font-size="14" font-weight="800" font-family="system-ui">${dynamics.calculatedRlDb.toFixed(1)} dB</text>
      <text x="12" y="48" fill="#64748b" font-size="9" font-family="system-ui">Reflectance: ${dynamics.isRlPass ? 'Compliant' : 'Excessive Reflection'}</text>

      <!-- Box 3: Cleave Length Gauge -->
      <rect x="340" y="0" width="170" height="54" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="12" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">CLEAVE GAUGE (10mm)</text>
      <text x="12" y="36" fill="${dynamics.airGapUm > 0 ? '#ef4444' : (dynamics.isCleaveLong ? '#f59e0b' : '#10b981')}" font-size="14" font-weight="800" font-family="system-ui">${dynamics.actualCleaveMm.toFixed(1)} mm</text>
      <text x="12" y="48" fill="#64748b" font-size="9" font-family="system-ui">${dynamics.airGapUm > 0 ? `Air Gap: ${dynamics.airGapUm} µm` : 'Precision Cleave Stop'}</text>

      <!-- Box 4: Tensile Proof Retention -->
      <rect x="520" y="0" width="150" height="54" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1"/>
      <text x="12" y="16" fill="#94a3b8" font-size="10" font-family="system-ui">CLAMPING PROOF (≥50N)</text>
      <text x="12" y="36" fill="${dynamics.isTensileProofPass ? '#10b981' : '#ef4444'}" font-size="14" font-weight="800" font-family="system-ui">${dynamics.clampingForceN} N</text>
      <text x="12" y="48" fill="#64748b" font-size="9" font-family="system-ui">${dynamics.isTensileProofPass ? 'Kevlar Wedge Locked' : 'Cable Slip Hazard'}</text>
    </g>
  </svg>`;
}

/**
 * Formats a bilingual Urdu & English WhatsApp field dispatch message
 * @param {Object} dynamics - Output of calculateFastConnectorMetrics
 * @param {Object} context - Optional job context
 * @returns {string} WhatsApp formatted text
 */
export function formatFastConnectorWhatsApp(dynamics, context = {}) {
  const c = dynamics.connectorType;
  const isPass = dynamics.isOverallPass;
  const area = context.area || 'Shahdara Out Plant';
  const tech = context.technicianName || 'Field Linesman';

  return `*SHAHDARA ISP · FTTH MECHANICAL FAST CONNECTOR AUDIT*
*شاہدہرا آپٹیکل فاسٹ کنیکٹر فیلڈ رپورٹ*
----------------------------------------
📍 *Area / علاقہ:* ${area}
👷 *Technician:* ${tech}
🔌 *Connector:* ${c.name}
📊 *Overall Status:* ${isPass ? '✅ PASSED (کامیاب)' : '❌ FAILED (ناکام - دوبارہ کنیکٹر لگائیں)'}

*METROLOGICAL READINGS / ٹیسٹ کے نتائج:*
• Insertion Loss (انسرشن لاس): ${dynamics.calculatedIlDb.toFixed(2)} dB (Limit: ≤ ${c.nominalIlMaxDb.toFixed(2)} dB)
• Return Loss (ریفیکشن): ${dynamics.calculatedRlDb.toFixed(1)} dB (Min: ≥ ${c.nominalRlMinDb.toFixed(0)} dB)
• Cleave Length (فائبر کٹائی لمبائی): ${dynamics.actualCleaveMm.toFixed(1)} mm (Target: 10.0 mm)
• Micro-Bow Deflection (خم/جھکاؤ): ${dynamics.deflectionBowMm.toFixed(1)} mm (Range: 1.0 - 2.0 mm)
• Index Gel Status: ${dynamics.gelCondition.name}
• Clamping Retention (کھنچاؤ ٹیسٹ): ${dynamics.clampingForceN} N (Min: 50 N)

${!isPass ? `⚠️ *DEFECT ALERT / خرابی کی وجوہات:*
${dynamics.airGapUm > 0 ? `• Air Gap Detected: ${dynamics.airGapUm} µm gap inside V-groove. Re-cleave to exact 10mm stop.\n` : ''}${dynamics.isCleaveLong ? '• Cleave Too Long: Fiber buckled inside boot.\n' : ''}${dynamics.deflectionBowMm < 0.5 ? '• No Micro-Bow: Fiber not seated against factory stub.\n' : ''}${!dynamics.isTensileProofPass ? '• Clamping Loose: Tighten rear cable lock wedge to avoid pull-out.\n' : ''}` : '✨ Fast Connector compliant with IEC 61754-4 and Telcordia GR-326-CORE specifications.'}
----------------------------------------
_Shahdara Outside Plant Engineering Ledger_`;
}

/**
 * Generates RFC-4180 CSV export string for fast connector audits
 * @param {Array} auditRecords - Array of audit objects
 * @returns {string} CSV with UTF-8 BOM
 */
export function generateFastConnectorCsv(auditRecords = []) {
  const headers = [
    'Timestamp',
    'Area',
    'Technician',
    'Connector Type',
    'Cleave Length (mm)',
    'Micro-Bow (mm)',
    'Cleave Angle (deg)',
    'Index Gel',
    'Clamping Force (N)',
    'Insertion Loss (dB)',
    'Return Loss (dB)',
    'Rating',
    'Pass Status'
  ];

  const rows = auditRecords.map(r => [
    `"${r.timestamp || new Date().toISOString()}"`,
    `"${(r.area || '').replace(/"/g, '""')}"`,
    `"${(r.technicianName || '').replace(/"/g, '""')}"`,
    `"${r.connectorType || ''}"`,
    r.actualCleaveMm ?? '',
    r.deflectionBowMm ?? '',
    r.cleaveAngleDeg ?? '',
    `"${(r.gelCondition || '').replace(/"/g, '""')}"`,
    r.clampingForceN ?? '',
    r.calculatedIlDb ?? '',
    r.calculatedRlDb ?? '',
    `"${r.qualityRating || ''}"`,
    r.isOverallPass ? 'PASS' : 'FAIL'
  ].join(','));

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Controller for Fast Connector Modal Dialog in Mobile Nav
 * @param {Object} state - Application state
 * @param {Object} options - Controller hooks and overrides
 * @returns {Object} Controller interface
 */
export function setupMobileFastConnectorModal(state, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const modal = doc.getElementById('mobileFastConnectorModal');
  const openBtn = doc.getElementById('mobileMoreFastConnectorBtn');
  const closeBtn = doc.getElementById('mobileFastConnectorModalCloseBtn');

  // Input Controls
  const presetSelect = doc.getElementById('fcPresetSelect');
  const typeSelect = doc.getElementById('fcTypeSelect');
  const gelSelect = doc.getElementById('fcGelSelect');
  const cleaveSlider = doc.getElementById('fcCleaveSlider');
  const cleaveLabel = doc.getElementById('fcCleaveLabel');
  const bowSlider = doc.getElementById('fcBowSlider');
  const bowLabel = doc.getElementById('fcBowLabel');
  const angleSlider = doc.getElementById('fcAngleSlider');
  const angleLabel = doc.getElementById('fcAngleLabel');
  const forceSlider = doc.getElementById('fcForceSlider');
  const forceLabel = doc.getElementById('fcForceLabel');
  const areaSelect = doc.getElementById('fcAreaSelect');
  const techInput = doc.getElementById('fcTechInput');

  // Visualization Container
  const diagramWrap = doc.getElementById('fcDiagramContainer');

  // Action Buttons
  const resetBtn = doc.getElementById('fcResetBtn');
  const saveBtn = doc.getElementById('fcSaveBtn');
  const whatsAppBtn = doc.getElementById('fcWhatsAppBtn');
  const exportCsvBtn = doc.getElementById('fcExportCsvBtn');

  let currentInputs = {
    connectorType: 'SC_APC',
    gelCondition: 'FRESH',
    actualCleaveMm: 10.0,
    actualBufferMm: 18.0,
    deflectionBowMm: 1.5,
    cleaveAngleDeg: 0.5,
    clampingForceN: 55,
    area: 'Shahdara Town',
    technicianName: 'Arshad Ali'
  };

  function getSavedAudits() {
    if (!storage) return [];
    try {
      const raw = storage.getItem(FAST_CONNECTOR_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveAudit(dynamics) {
    if (!storage) return;
    const audits = getSavedAudits();
    const entry = {
      id: 'fc_' + Date.now(),
      timestamp: new Date().toISOString(),
      area: currentInputs.area,
      technicianName: currentInputs.technicianName,
      connectorType: dynamics.connectorType.id,
      gelCondition: dynamics.gelCondition.id,
      actualCleaveMm: dynamics.actualCleaveMm,
      deflectionBowMm: dynamics.deflectionBowMm,
      cleaveAngleDeg: dynamics.cleaveAngleDeg,
      clampingForceN: dynamics.clampingForceN,
      calculatedIlDb: dynamics.calculatedIlDb,
      calculatedRlDb: dynamics.calculatedRlDb,
      qualityRating: dynamics.qualityRating,
      isOverallPass: dynamics.isOverallPass
    };
    audits.unshift(entry);
    if (audits.length > 50) audits.pop();
    storage.setItem(FAST_CONNECTOR_STORAGE_KEY, JSON.stringify(audits));
  }

  function updateUi() {
    const dynamics = calculateFastConnectorMetrics(currentInputs);

    if (diagramWrap) {
      diagramWrap.innerHTML = renderFastConnectorDiagramSvg(dynamics);
    }

    if (cleaveLabel) cleaveLabel.textContent = `${currentInputs.actualCleaveMm.toFixed(1)} mm`;
    if (bowLabel) bowLabel.textContent = `${currentInputs.deflectionBowMm.toFixed(1)} mm`;
    if (angleLabel) angleLabel.textContent = `${currentInputs.cleaveAngleDeg.toFixed(1)}°`;
    if (forceLabel) forceLabel.textContent = `${currentInputs.clampingForceN} N`;
  }

  function loadPreset(presetId) {
    const p = FAST_CONNECTOR_PRESETS.find(item => item.id === presetId);
    if (!p) return;

    currentInputs = {
      connectorType: p.connectorType,
      gelCondition: p.gelCondition,
      actualCleaveMm: p.actualCleaveMm,
      actualBufferMm: p.actualBufferMm,
      deflectionBowMm: p.deflectionBowMm,
      cleaveAngleDeg: p.cleaveAngleDeg,
      clampingForceN: p.clampingForceN,
      area: p.area,
      technicianName: p.technicianName
    };

    if (typeSelect) typeSelect.value = currentInputs.connectorType;
    if (gelSelect) gelSelect.value = currentInputs.gelCondition;
    if (cleaveSlider) cleaveSlider.value = String(currentInputs.actualCleaveMm);
    if (bowSlider) bowSlider.value = String(currentInputs.deflectionBowMm);
    if (angleSlider) angleSlider.value = String(currentInputs.cleaveAngleDeg);
    if (forceSlider) forceSlider.value = String(currentInputs.clampingForceN);
    if (areaSelect) areaSelect.value = currentInputs.area;
    if (techInput) techInput.value = currentInputs.technicianName;

    updateUi();
  }

  // Bind Event Listeners
  if (presetSelect) {
    presetSelect.addEventListener('change', () => loadPreset(presetSelect.value));
  }

  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      currentInputs.connectorType = typeSelect.value;
      updateUi();
    });
  }

  if (gelSelect) {
    gelSelect.addEventListener('change', () => {
      currentInputs.gelCondition = gelSelect.value;
      updateUi();
    });
  }

  if (cleaveSlider) {
    cleaveSlider.addEventListener('input', () => {
      currentInputs.actualCleaveMm = Number(cleaveSlider.value);
      updateUi();
    });
  }

  if (bowSlider) {
    bowSlider.addEventListener('input', () => {
      currentInputs.deflectionBowMm = Number(bowSlider.value);
      updateUi();
    });
  }

  if (angleSlider) {
    angleSlider.addEventListener('input', () => {
      currentInputs.cleaveAngleDeg = Number(angleSlider.value);
      updateUi();
    });
  }

  if (forceSlider) {
    forceSlider.addEventListener('input', () => {
      currentInputs.clampingForceN = Number(forceSlider.value);
      updateUi();
    });
  }

  if (areaSelect) {
    areaSelect.addEventListener('change', () => {
      currentInputs.area = areaSelect.value;
    });
  }

  if (techInput) {
    techInput.addEventListener('input', () => {
      currentInputs.technicianName = techInput.value;
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      loadPreset('shahdara-town-drop-apc');
      if (presetSelect) presetSelect.value = 'shahdara-town-drop-apc';
      if (typeof options.onToast === 'function') {
        options.onToast('Fast Connector reset to Shahdara Town standard baseline.');
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const dynamics = calculateFastConnectorMetrics(currentInputs);
      saveAudit(dynamics);
      if (typeof options.onToast === 'function') {
        options.onToast(`Fast connector audit saved (${dynamics.isOverallPass ? 'PASS' : 'FAIL'}).`);
      }
    });
  }

  if (whatsAppBtn) {
    whatsAppBtn.addEventListener('click', () => {
      const dynamics = calculateFastConnectorMetrics(currentInputs);
      const text = formatFastConnectorWhatsApp(dynamics, currentInputs);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Bilingual WhatsApp audit dispatch copied to clipboard.');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const audits = getSavedAudits();
      if (!audits.length) {
        // Create an audit from current inputs
        const currentDyn = calculateFastConnectorMetrics(currentInputs);
        saveAudit(currentDyn);
      }
      const csv = generateFastConnectorCsv(getSavedAudits());
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(csv).catch(() => {});
      }
      if (typeof options.onToast === 'function') {
        options.onToast('Fast connector audits exported to CSV (copied to clipboard).');
      }
    });
  }

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      updateUi();
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Initial render
  updateUi();

  return {
    open: () => {
      updateUi();
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
    },
    close: () => {
      if (modal) {
        if (typeof modal.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    },
    update: updateUi,
    getMetrics: () => calculateFastConnectorMetrics(currentInputs),
    getSavedAudits
  };
}
