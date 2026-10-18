/**
 * Shahdara ISP Billing & Network Operations - Optical Fiber Splice Protection Sleeve Heat-Shrink Cure,
 * Micro-Bend Void & Tensile Proof Retention QA Certification Suite
 * Standards: Telcordia GR-1380-CORE, IEC 61073-1, ITU-T L.400 / L.12, IEC 60793-1-46
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const SPLICE_SLEEVE_CURE_STORAGE_KEY = 'shahdara_splice_sleeve_cure_certs_v1';

export const SLEEVE_TYPES = {
  'SLEEVE_60MM_STANDARD': {
    id: 'SLEEVE_60MM_STANDARD',
    name: '60mm Heavy-Duty Standard Sleeve',
    category: 'ODF & Trunk Distribution Closure',
    nominalLengthMm: 60.0,
    recoveredOuterDiameterMm: 2.8,
    unrecoveredOuterDiameterMm: 3.8,
    strengthMemberType: '304 Stainless Steel Rod (1.5mm)',
    strengthMemberDiameterMm: 1.5,
    minCureTempC: 195,
    targetCureTempC: 205,
    maxCureTempC: 230,
    targetCureTimeSec: 28,
    minCureTimeSec: 22,
    ratedTensileRetentionN: 120,
    telcordiaMinTensileN: 100
  },
  'SLEEVE_40MM_SLIM': {
    id: 'SLEEVE_40MM_SLIM',
    name: '40mm Slim Access & Drop Sleeve',
    category: 'FAT Box & High-Density Splice Tray',
    nominalLengthMm: 40.0,
    recoveredOuterDiameterMm: 2.2,
    unrecoveredOuterDiameterMm: 3.2,
    strengthMemberType: '304 Stainless Steel Rod (1.2mm)',
    strengthMemberDiameterMm: 1.2,
    minCureTempC: 185,
    targetCureTempC: 195,
    maxCureTempC: 225,
    targetCureTimeSec: 18,
    minCureTimeSec: 14,
    ratedTensileRetentionN: 110,
    telcordiaMinTensileN: 100
  },
  'SLEEVE_25MM_MICRO': {
    id: 'SLEEVE_25MM_MICRO',
    name: '25mm Micro Optical Splice Sleeve',
    category: 'Ultra-Compact Drop Demarcation / Rosette',
    nominalLengthMm: 25.0,
    recoveredOuterDiameterMm: 1.5,
    unrecoveredOuterDiameterMm: 2.4,
    strengthMemberType: '304 Stainless Steel Pin (1.0mm)',
    strengthMemberDiameterMm: 1.0,
    minCureTempC: 175,
    targetCureTempC: 185,
    maxCureTempC: 215,
    targetCureTimeSec: 13,
    minCureTimeSec: 10,
    ratedTensileRetentionN: 105,
    telcordiaMinTensileN: 100
  },
  'SLEEVE_60MM_DIELECTRIC': {
    id: 'SLEEVE_60MM_DIELECTRIC',
    name: '60mm Non-Metallic Dielectric Sleeve',
    category: 'High-Voltage Power Line Aerial Crossing',
    nominalLengthMm: 60.0,
    recoveredOuterDiameterMm: 2.9,
    unrecoveredOuterDiameterMm: 4.0,
    strengthMemberType: 'Reinforced Ceramic / Glass Filament Rod',
    strengthMemberDiameterMm: 1.5,
    minCureTempC: 200,
    targetCureTempC: 215,
    maxCureTempC: 235,
    targetCureTimeSec: 32,
    minCureTimeSec: 25,
    ratedTensileRetentionN: 115,
    telcordiaMinTensileN: 100
  }
};

export const HOT_MELT_ADHESIVES = {
  'EVA_STANDARD': {
    id: 'EVA_STANDARD',
    name: 'Standard EVA (Ethylene Vinyl Acetate)',
    nominalMeltingPointC: 98,
    meltIndexG10Min: 150,
    viscosityCps: 18000,
    description: 'High elasticity, optimal encapsulation around single-mode bare silica glass.'
  },
  'POLYOLEFIN_HIGH_FLOW': {
    id: 'POLYOLEFIN_HIGH_FLOW',
    name: 'High-Flow Modified Polyolefin',
    nominalMeltingPointC: 115,
    meltIndexG10Min: 220,
    viscosityCps: 14000,
    description: 'Rapid wetting, enhanced thermal resistance for extreme Shahdara summer temperatures.'
  }
};

export const TUBE_CONDITIONS = {
  'PRISTINE_CRYSTALLINE': { id: 'PRISTINE_CRYSTALLINE', label: 'Pristine Uniform Shrink (Clear)', score: 5, penalty: 0 },
  'MINOR_HAZE': { id: 'MINOR_HAZE', label: 'Minor Translucent Haze (Compliant)', score: 4, penalty: 0 },
  'SURFACE_DISCOLORATION': { id: 'SURFACE_DISCOLORATION', label: 'Yellowed / Mild Scorching (Degraded)', score: 2, penalty: 15 },
  'CHARRED_EMBRITTLED': { id: 'CHARRED_EMBRITTLED', label: 'Charred / Severely Embrittled (Crack Risk)', score: 1, penalty: 40 }
};

export const SLEEVE_QA_VERDICTS = {
  'OPTIMAL_CERTIFIED': {
    code: 'OPTIMAL',
    label: 'Certified Optimal Cure',
    labelUrdu: 'مکمل تصدیق شدہ معیاری پروٹیکشن',
    badgeClass: 'badge-certified',
    colorHex: '#10b981',
    description: 'Complete hermetic adhesive seal, zero micro-voids over core splice, tensile retention exceeds 110 N.'
  },
  'COMPLIANT_STANDARD': {
    code: 'COMPLIANT',
    label: 'Compliant Access Splice',
    labelUrdu: 'معیاری منظور شدہ جوائنٹ پروٹیکٹر',
    badgeClass: 'badge-pass',
    colorHex: '#3b82f6',
    description: 'Compliant with Telcordia GR-1380-CORE. Minor peripheral void acceptable away from optical core.'
  },
  'CONDITIONAL_REHEAT': {
    code: 'REHEAT_DUE',
    label: 'Conditional - Re-heat Cycle Due',
    labelUrdu: 'مشروط - دوبارہ گرم کرنا لازمی',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    description: 'Incomplete adhesive flow or meniscus gap. Place back into splicer tube heater for secondary shrink.'
  },
  'REJECT_RE_SLEEVE': {
    code: 'RE_SLEEVE',
    label: 'Rejected - Re-sleeve Mandated',
    labelUrdu: 'مسترد - سلیو بدلنا اور دوبارہ سپلائس لازمی',
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    description: 'Severe void over fusion core or charred brittle polyolefin. Sleeve must be sliced and joint re-spliced.'
  }
};

/**
 * Calculates effective thermal curing energy delivered to the shrink sleeve.
 * Energy Ratio = ( (T_oven - T_melt) * t_cure ) / ( (T_target - T_melt) * t_target )
 * Adjusts for ambient temperature cooling losses.
 * @param {number} ovenTempC
 * @param {number} cureTimeSec
 * @param {number} ambientTempC
 * @param {object} sleeve
 * @param {object} adhesive
 * @returns {number} Thermal cure energy ratio (1.0 = perfect target)
 */
export function calculateCureThermalEnergy(ovenTempC, cureTimeSec, ambientTempC, sleeve, adhesive) {
  const tOven = Math.max(100, Number(ovenTempC) || 200);
  const tSec = Math.max(5, Number(cureTimeSec) || 28);
  const tAmb = Number(ambientTempC) || 25;

  const tMelt = adhesive.nominalMeltingPointC;
  const tTarget = sleeve.targetCureTempC;
  const tTargetSec = sleeve.targetCureTimeSec;

  // Ambient compensation: cold environment (e.g. 5°C winter) accelerates heat loss from oven chamber
  const ambientFactor = 1 - ((25 - tAmb) * 0.005);

  const effectiveDeltaT = Math.max(10, tOven - tMelt);
  const targetDeltaT = Math.max(10, tTarget - tMelt);

  const energyRatio = ((effectiveDeltaT * tSec) / (targetDeltaT * tTargetSec)) * ambientFactor;
  return Number(energyRatio.toFixed(3));
}

/**
 * Calculates induced micro-bending loss caused by air void entrapment over the bare fiber core.
 * Under Telcordia GR-1380-CORE, air bubbles directly above the splice point expand/contract with
 * daily thermal cycling, producing localized transverse micro-bending stress.
 * @param {number} bubbleDiameterMm
 * @param {number} distanceFromSpliceMm
 * @returns {number} Induced micro-bend attenuation in dB
 */
export function calculateVoidMicroBendPenalty(bubbleDiameterMm, distanceFromSpliceMm) {
  const d = Math.max(0, Number(bubbleDiameterMm) || 0);
  const dist = Math.max(0, Number(distanceFromSpliceMm) || 0);
  if (d === 0) return 0;

  // Maximum risk when bubble is directly over splice (dist == 0)
  // Decays exponentially as distance from splice center increases
  const distanceDecay = Math.exp(-dist / 3.0);
  const microBendDb = 0.085 * Math.pow(d, 1.8) * distanceDecay;

  return Math.max(0, Number(microBendDb.toFixed(4)));
}

/**
 * Calculates axial tensile retention pull force (Newtons) under IEC 61073-1 Proof Retention.
 * @param {object} sleeve
 * @param {number} thermalEnergyRatio
 * @param {boolean} hasMeniscusSeal
 * @param {number} outerTubeConditionScore (1 to 5)
 * @returns {number} Retention force in Newtons
 */
export function calculateAxialTensileRetention(sleeve, thermalEnergyRatio, hasMeniscusSeal, outerTubeConditionScore = 5) {
  let baseRetentionN = sleeve.ratedTensileRetentionN;

  // Under-curing weakens adhesive bond
  if (thermalEnergyRatio < 0.85) {
    baseRetentionN *= Math.max(0.5, thermalEnergyRatio);
  } else if (thermalEnergyRatio > 1.30) {
    // Overheating embrittles polyolefin
    baseRetentionN *= 0.88;
  }

  // Meniscus seal confirms full tube end-to-end wet-out
  if (!hasMeniscusSeal) {
    baseRetentionN -= 18;
  }

  // Tube degradation
  if (outerTubeConditionScore <= 2) {
    baseRetentionN -= 25;
  }

  return Math.max(30, Number(baseRetentionN.toFixed(1)));
}

/**
 * Comprehensive fusion splice sleeve curing metrological evaluation.
 * @param {object} params
 * @returns {object} Full evaluation results
 */
export function evaluateSleeveCureQa({
  sleeveType = 'SLEEVE_60MM_STANDARD',
  adhesiveType = 'EVA_STANDARD',
  ovenTempC = 200,
  cureTimeSec = 28,
  ambientTempC = 25,
  bubbleCount = 0,
  maxBubbleDiamMm = 0,
  distanceFromSpliceMm = 10,
  isBubbleOverSplice = false,
  hasMeniscusSeal = true,
  rodAngleDeg = 0.25,
  outerTubeCondition = 'PRISTINE_CRYSTALLINE'
} = {}) {
  const sleeve = SLEEVE_TYPES[sleeveType] || SLEEVE_TYPES.SLEEVE_60MM_STANDARD;
  const adhesive = HOT_MELT_ADHESIVES[adhesiveType] || HOT_MELT_ADHESIVES.EVA_STANDARD;
  const tubeCond = TUBE_CONDITIONS[outerTubeCondition] || TUBE_CONDITIONS.PRISTINE_CRYSTALLINE;

  const energyRatio = calculateCureThermalEnergy(ovenTempC, cureTimeSec, ambientTempC, sleeve, adhesive);
  const effectiveDistance = isBubbleOverSplice ? 0 : Number(distanceFromSpliceMm);
  const microBendLossDb = calculateVoidMicroBendPenalty(maxBubbleDiamMm, effectiveDistance);
  const tensileRetentionN = calculateAxialTensileRetention(sleeve, energyRatio, hasMeniscusSeal, tubeCond.score);

  // Rod parallelism penalty
  const rodTilt = Math.max(0, Number(rodAngleDeg) || 0);

  // Determine QA Verdict
  let verdict = SLEEVE_QA_VERDICTS.OPTIMAL_CERTIFIED;

  // Reject conditions
  if (outerTubeCondition === 'CHARRED_EMBRITTLED' || energyRatio > 1.45 || (isBubbleOverSplice && maxBubbleDiamMm > 0.6)) {
    verdict = SLEEVE_QA_VERDICTS.REJECT_RE_SLEEVE;
  } else if (energyRatio < 0.75 || !hasMeniscusSeal || (isBubbleOverSplice && maxBubbleDiamMm > 0.25)) {
    verdict = SLEEVE_QA_VERDICTS.CONDITIONAL_REHEAT;
  } else if (tensileRetentionN < sleeve.telcordiaMinTensileN || rodTilt > 1.2 || maxBubbleDiamMm > 0.5) {
    verdict = SLEEVE_QA_VERDICTS.COMPLIANT_STANDARD;
  }

  return {
    sleeve,
    adhesive,
    tubeCond,
    ovenTempC: Number(ovenTempC),
    cureTimeSec: Number(cureTimeSec),
    ambientTempC: Number(ambientTempC),
    energyRatio,
    bubbleCount: Number(bubbleCount) || 0,
    maxBubbleDiamMm: Number(maxBubbleDiamMm) || 0,
    distanceFromSpliceMm: effectiveDistance,
    isBubbleOverSplice: Boolean(isBubbleOverSplice),
    hasMeniscusSeal: Boolean(hasMeniscusSeal),
    rodAngleDeg: rodTilt,
    microBendLossDb,
    tensileRetentionN,
    verdict,
    isTelcordiaCompliant: tensileRetentionN >= sleeve.telcordiaMinTensileN && microBendLossDb <= 0.03
  };
}

/**
 * 5 Standard Shahdara ISP Splice Sleeve Curing Presets.
 */
export const SHAH_SLEEVE_PRESETS = {
  'BARADARI_EXCHANGE_60MM': {
    id: 'BARADARI_EXCHANGE_60MM',
    name: 'Baradari Central ODF Trunk Closure (60mm Heavy)',
    location: 'Baradari Road Main Exchange ODF Rack 02 Tray 07',
    sleeveType: 'SLEEVE_60MM_STANDARD',
    adhesiveType: 'EVA_STANDARD',
    ovenTempC: 205,
    cureTimeSec: 28,
    ambientTempC: 24,
    bubbleCount: 0,
    maxBubbleDiamMm: 0,
    isBubbleOverSplice: false,
    hasMeniscusSeal: true,
    rodAngleDeg: 0.15,
    outerTubeCondition: 'PRISTINE_CRYSTALLINE',
    technicianName: 'Muhammad Rizwan (Senior Fiber Splicing Specialist)'
  },
  'VANDALA_SLIM_40MM': {
    id: 'VANDALA_SLIM_40MM',
    name: 'Vandala Road Drop FAT Splice (40mm Slim)',
    location: 'Vandala Road Pole FAT-08 Closure',
    sleeveType: 'SLEEVE_40MM_SLIM',
    adhesiveType: 'EVA_STANDARD',
    ovenTempC: 195,
    cureTimeSec: 18,
    ambientTempC: 32,
    bubbleCount: 1,
    maxBubbleDiamMm: 0.20,
    distanceFromSpliceMm: 12,
    isBubbleOverSplice: false,
    hasMeniscusSeal: true,
    rodAngleDeg: 0.35,
    outerTubeCondition: 'MINOR_HAZE',
    technicianName: 'Tariq Mehmood (Lineman Lead)'
  },
  'JIA_MUSA_UNDER_CURED': {
    id: 'JIA_MUSA_UNDER_CURED',
    name: 'Jia Musa Winter Field Joint (Incomplete Adhesive Flow)',
    location: 'Jia Musa Main Market Overhead Joint Enclosure',
    sleeveType: 'SLEEVE_60MM_STANDARD',
    adhesiveType: 'EVA_STANDARD',
    ovenTempC: 170,
    cureTimeSec: 16,
    ambientTempC: 7, // Cold winter night in Shahdara
    bubbleCount: 2,
    maxBubbleDiamMm: 0.45,
    distanceFromSpliceMm: 2,
    isBubbleOverSplice: true,
    hasMeniscusSeal: false,
    rodAngleDeg: 0.45,
    outerTubeCondition: 'PRISTINE_CRYSTALLINE',
    technicianName: 'Sajjad Ali (Field Technician)'
  },
  'BEGUM_KOT_OVERHEATED_CHAR': {
    id: 'BEGUM_KOT_OVERHEATED_CHAR',
    name: 'Begum Kot Over-Heated Charred Sleeve (Oven Fault)',
    location: 'Begum Kot Industrial Grid Splicing Enclosure',
    sleeveType: 'SLEEVE_60MM_STANDARD',
    adhesiveType: 'POLYOLEFIN_HIGH_FLOW',
    ovenTempC: 245,
    cureTimeSec: 52,
    ambientTempC: 38,
    bubbleCount: 3,
    maxBubbleDiamMm: 0.85,
    distanceFromSpliceMm: 0,
    isBubbleOverSplice: true,
    hasMeniscusSeal: true,
    rodAngleDeg: 0.80,
    outerTubeCondition: 'CHARRED_EMBRITTLED',
    technicianName: 'Hamza Farooq (Assistant Lineman)'
  },
  'RAVI_SIPHON_NON_METALLIC': {
    id: 'RAVI_SIPHON_NON_METALLIC',
    name: 'Ravi Siphon River Crossing Dielectric Ceramic Sleeve',
    location: 'Ravi Siphon River Pylon Aerial Cable Joint',
    sleeveType: 'SLEEVE_60MM_DIELECTRIC',
    adhesiveType: 'POLYOLEFIN_HIGH_FLOW',
    ovenTempC: 215,
    cureTimeSec: 32,
    ambientTempC: 28,
    bubbleCount: 0,
    maxBubbleDiamMm: 0,
    isBubbleOverSplice: false,
    hasMeniscusSeal: true,
    rodAngleDeg: 0.20,
    outerTubeCondition: 'PRISTINE_CRYSTALLINE',
    technicianName: 'Engr. Imran Malik (NOC Metrology Engineer)'
  }
};

/**
 * Pure-vector high-contrast SVG visualization of splice protection sleeve cure,
 * EVA melt meniscus, stainless steel member alignment, and void micro-bend stress.
 * @param {object} analysis
 * @returns {string} SVG HTML markup
 */
export function renderSpliceSleeveCureSvg(analysis) {
  if (!analysis) return '';

  const {
    sleeve,
    adhesive,
    tubeCond,
    ovenTempC,
    cureTimeSec,
    energyRatio,
    maxBubbleDiamMm,
    isBubbleOverSplice,
    hasMeniscusSeal,
    microBendLossDb,
    tensileRetentionN,
    verdict
  } = analysis;

  const width = 760;
  const height = 340;
  const midX = width / 2;
  const midY = 160;

  // Sleeve geometry
  const sleevePxWidth = 560;
  const sleevePxHeight = 110;
  const leftX = midX - (sleevePxWidth / 2);
  const rightX = midX + (sleevePxWidth / 2);

  // Outer tube coloration based on condition
  let tubeFill = 'rgba(56, 189, 248, 0.15)';
  let tubeStroke = '#38bdf8';
  if (tubeCond.id === 'SURFACE_DISCOLORATION') {
    tubeFill = 'rgba(234, 179, 8, 0.25)';
    tubeStroke = '#eab308';
  } else if (tubeCond.id === 'CHARRED_EMBRITTLED') {
    tubeFill = 'rgba(127, 29, 29, 0.5)';
    tubeStroke = '#ef4444';
  }

  return `
<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Splice Protection Sleeve Heat-Shrink Cure Diagram" style="width: 100%; height: auto; display: block; border-radius: 8px; background: #090d16;">
  <defs>
    <!-- Background Grid -->
    <pattern id="sleeveGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    </pattern>
    <!-- Steel Rod Metallic Gradient -->
    <linearGradient id="steelRodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="50%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <!-- EVA Adhesive Melt Flow Gradient -->
    <linearGradient id="evaMeltGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#a7f3d0" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="#34d399" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#a7f3d0" stop-opacity="0.3"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#090d16" />
  <rect width="${width}" height="${height}" fill="url(#sleeveGrid)" />

  <!-- Top Header Banner -->
  <g transform="translate(16, 18)">
    <rect width="${width - 32}" height="36" rx="6" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.1)" />
    <text x="14" y="23" fill="#f8fafc" font-size="12" font-weight="700" font-family="system-ui, sans-serif">
      ${escapeHtml(sleeve.name)} (${ovenTempC}°C / ${cureTimeSec}s)
    </text>
    <text x="${width - 48}" y="23" text-anchor="end" fill="${verdict.colorHex}" font-size="12" font-weight="800" font-family="system-ui, sans-serif">
      Cure Index: ${(energyRatio * 100).toFixed(0)}% [${escapeHtml(verdict.code)}]
    </text>
  </g>

  <!-- Main Splice Protection Sleeve Assembly -->
  <g id="sleeveAssembly">
    <!-- Outer Recovered Heat-Shrink Polyolefin Tube -->
    <rect x="${leftX}" y="${midY - (sleevePxHeight / 2)}" width="${sleevePxWidth}" height="${sleevePxHeight}" rx="14" fill="${tubeFill}" stroke="${tubeStroke}" stroke-width="2" />
    <text x="${leftX + 16}" y="${midY - (sleevePxHeight / 2) + 18}" fill="#94a3b8" font-size="10" font-family="monospace">Recovered Polyolefin: 2:1 Ratio</text>

    <!-- Inner Melted Hot-Melt Adhesive Layer (EVA) -->
    <rect x="${leftX + 4}" y="${midY - 32}" width="${sleevePxWidth - 8}" height="64" rx="8" fill="url(#evaMeltGrad)" stroke="#10b981" stroke-width="1" stroke-dasharray="3,3" />

    <!-- Adhesive Flow Meniscus Seals at Both Ends -->
    ${hasMeniscusSeal ? `
      <!-- Left Meniscus -->
      <path d="M ${leftX} ${midY - 26} C ${leftX - 14} ${midY - 14}, ${leftX - 14} ${midY + 14}, ${leftX} ${midY + 26}" fill="#34d399" opacity="0.8" stroke="#10b981" stroke-width="1.5"/>
      <text x="${leftX - 8}" y="${midY + 42}" text-anchor="end" fill="#34d399" font-size="9" font-weight="700" font-family="monospace">Meniscus OK</text>
      <!-- Right Meniscus -->
      <path d="M ${rightX} ${midY - 26} C ${rightX + 14} ${midY - 14}, ${rightX + 14} ${midY + 14}, ${rightX} ${midY + 26}" fill="#34d399" opacity="0.8" stroke="#10b981" stroke-width="1.5"/>
      <text x="${rightX + 8}" y="${midY + 42}" fill="#34d399" font-size="9" font-weight="700" font-family="monospace">Meniscus OK</text>
    ` : `
      <!-- Missing Meniscus Warning -->
      <line x1="${leftX}" y1="${midY - 26}" x2="${leftX}" y2="${midY + 26}" stroke="#ef4444" stroke-width="2" />
      <text x="${leftX - 8}" y="${midY + 42}" text-anchor="end" fill="#ef4444" font-size="9" font-weight="700" font-family="monospace">Seal Incomplete</text>
      <line x1="${rightX}" y1="${midY - 26}" x2="${rightX}" y2="${midY + 26}" stroke="#ef4444" stroke-width="2" />
      <text x="${rightX + 8}" y="${midY + 42}" fill="#ef4444" font-size="9" font-weight="700" font-family="monospace">Seal Incomplete</text>
    `}

    <!-- Strength Member (Stainless Steel Rod at bottom of sleeve) -->
    <rect x="${leftX + 12}" y="${midY + 22}" width="${sleevePxWidth - 24}" height="18" rx="4" fill="url(#steelRodGrad)" stroke="#475569" stroke-width="1.2"/>
    <text x="${midX}" y="${midY + 34}" text-anchor="middle" fill="#1e293b" font-size="9.5" font-weight="800" font-family="system-ui, sans-serif">
      ${escapeHtml(sleeve.strengthMemberType)}
    </text>

    <!-- Optical Fiber (Passing through center) -->
    <!-- Cladding (125µm) -->
    <line x1="30" y1="${midY - 4}" x2="${width - 30}" y2="${midY - 4}" stroke="#60a5fa" stroke-width="4" opacity="0.8"/>
    <!-- Core / Light Guidance -->
    <line x1="30" y1="${midY - 4}" x2="${width - 30}" y2="${midY - 4}" stroke="#facc15" stroke-width="1.8"/>

    <!-- Fusion Splice Point Marker -->
    <circle cx="${midX}" cy="${midY - 4}" r="5" fill="#facc15" stroke="#ef4444" stroke-width="2"/>
    <line x1="${midX}" y1="${midY - 38}" x2="${midX}" y2="${midY - 14}" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="2,2"/>
    <rect x="${midX - 44}" y="${midY - 52}" width="88" height="18" rx="3" fill="#1e1b4b" stroke="#ef4444" stroke-width="1"/>
    <text x="${midX}" y="${midY - 40}" text-anchor="middle" fill="#fca5a5" font-size="9" font-weight="700" font-family="system-ui, sans-serif">Fusion Joint Core</text>

    <!-- Trapped Air Void / Bubble -->
    ${maxBubbleDiamMm > 0 ? `
      <g transform="translate(${isBubbleOverSplice ? midX : midX + 60}, ${midY - 8})">
        <circle cx="0" cy="0" r="${Math.min(18, maxBubbleDiamMm * 14)}" fill="rgba(239, 68, 68, 0.4)" stroke="#ef4444" stroke-width="1.5" />
        <text x="0" y="-14" text-anchor="middle" fill="#f87171" font-size="9" font-weight="700" font-family="monospace">
          Void ${maxBubbleDiamMm.toFixed(2)}mm
        </text>
      </g>
    ` : ''}
  </g>

  <!-- Bottom Telemetry HUD Ribbon -->
  <g transform="translate(16, 288)">
    <rect width="${width - 32}" height="38" rx="6" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(255,255,255,0.08)" />

    <text x="20" y="24" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#38bdf8">Thermal Cure:</tspan> <tspan font-weight="700" fill="#f8fafc">${(energyRatio * 100).toFixed(0)}%</tspan>
    </text>

    <text x="170" y="24" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#34d399">Tensile Retention:</tspan> <tspan font-weight="700" fill="#f8fafc">${tensileRetentionN.toFixed(0)} N</tspan>
    </text>

    <text x="340" y="24" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#f59e0b">Micro-Bend Loss:</tspan> <tspan font-weight="700" fill="#f8fafc">${microBendLossDb.toFixed(4)} dB</tspan>
    </text>

    <text x="520" y="24" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#cbd5e1">Meniscus Seal:</tspan> <tspan font-weight="700" fill="${hasMeniscusSeal ? '#10b981' : '#ef4444'}">${hasMeniscusSeal ? 'PASSED' : 'MISSING'}</tspan>
    </text>

    <text x="${width - 48}" y="24" text-anchor="end" fill="#cbd5e1" font-size="11" font-family="system-ui, sans-serif">
      <tspan fill="#94a3b8">Verdict:</tspan> <tspan font-weight="700" fill="${verdict.colorHex}">${verdict.code}</tspan>
    </text>
  </g>
</svg>
`;
}

/**
 * Validates splice sleeve cure form inputs.
 * @param {object} formData
 * @returns {object} { isValid, errors }
 */
export function validateSpliceSleeveCure(formData = {}) {
  const errors = {};

  if (!formData.sleeveType || !SLEEVE_TYPES[formData.sleeveType]) {
    errors.sleeveType = 'Valid optical splice protection sleeve standard is required.';
  }

  const temp = Number(formData.ovenTempC);
  if (isNaN(temp) || temp < 140 || temp > 260) {
    errors.ovenTempC = 'Oven temperature must be between 140°C and 260°C.';
  }

  const timeSec = Number(formData.cureTimeSec);
  if (isNaN(timeSec) || timeSec < 5 || timeSec > 90) {
    errors.cureTimeSec = 'Cure heating duration must be between 5 and 90 seconds.';
  }

  const bubbleDiam = Number(formData.maxBubbleDiamMm);
  if (formData.maxBubbleDiamMm !== undefined && (isNaN(bubbleDiam) || bubbleDiam < 0 || bubbleDiam > 5)) {
    errors.maxBubbleDiamMm = 'Bubble diameter must be between 0.0 and 5.0 mm.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Builds an immutable certificate record for splice sleeve curing QA.
 * @param {object} params
 * @returns {object} Certificate record object
 */
export function buildSpliceSleeveCureRecord({
  customer = null,
  sleeveType = 'SLEEVE_60MM_STANDARD',
  adhesiveType = 'EVA_STANDARD',
  ovenTempC = 200,
  cureTimeSec = 28,
  ambientTempC = 25,
  bubbleCount = 0,
  maxBubbleDiamMm = 0,
  distanceFromSpliceMm = 10,
  isBubbleOverSplice = false,
  hasMeniscusSeal = true,
  rodAngleDeg = 0.25,
  outerTubeCondition = 'PRISTINE_CRYSTALLINE',
  technicianName = 'Engr. Shahdara Field Specialist',
  location = 'Outside Plant Joint Closure',
  notes = '',
  status = 'CERTIFIED_PASS'
} = {}) {
  const analysis = evaluateSleeveCureQa({
    sleeveType,
    adhesiveType,
    ovenTempC,
    cureTimeSec,
    ambientTempC,
    bubbleCount,
    maxBubbleDiamMm,
    distanceFromSpliceMm,
    isBubbleOverSplice,
    hasMeniscusSeal,
    rodAngleDeg,
    outerTubeCondition
  });

  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = `SCUR-${yearMonth}-${randomSuffix}`;

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
    status: status || (analysis.verdict.code === 'RE_SLEEVE' ? 'REJECTED' : 'CERTIFIED_PASS'),
    sleeveType,
    adhesiveType,
    ovenTempC: analysis.ovenTempC,
    cureTimeSec: analysis.cureTimeSec,
    ambientTempC: analysis.ambientTempC,
    energyRatio: analysis.energyRatio,
    bubbleCount: analysis.bubbleCount,
    maxBubbleDiamMm: analysis.maxBubbleDiamMm,
    isBubbleOverSplice: analysis.isBubbleOverSplice,
    hasMeniscusSeal: analysis.hasMeniscusSeal,
    rodAngleDeg: analysis.rodAngleDeg,
    outerTubeCondition,
    microBendLossDb: analysis.microBendLossDb,
    tensileRetentionN: analysis.tensileRetentionN,
    verdict: analysis.verdict
  };
}

/**
 * LocalStorage Persistence Methods
 */
export function getSavedSpliceSleeveCureCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SPLICE_SLEEVE_CURE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read splice sleeve cure certs:', e);
    return [];
  }
}

export function saveSpliceSleeveCureCert(record, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !record) return false;
  try {
    const records = getSavedSpliceSleeveCureCerts(storage);
    records.unshift(record);
    storage.setItem(SPLICE_SLEEVE_CURE_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (e) {
    console.error('Failed to save splice sleeve cure cert:', e);
    return false;
  }
}

export function updateSpliceSleeveCureCertStatus(id, newStatus, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !id) return false;
  try {
    const records = getSavedSpliceSleeveCureCerts(storage);
    const item = records.find(r => r.id === id);
    if (!item) return false;
    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
    storage.setItem(SPLICE_SLEEVE_CURE_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (e) {
    console.error('Failed to update splice sleeve cert status:', e);
    return false;
  }
}

export function clearSpliceSleeveCureCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.removeItem(SPLICE_SLEEVE_CURE_STORAGE_KEY);
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
export function calculateSpliceSleeveCureMetrics(records = []) {
  const total = records.length;
  if (!total) {
    return {
      total: 0,
      optimalCount: 0,
      compliantCount: 0,
      reheatCount: 0,
      rejectCount: 0,
      passRatePercent: 0,
      avgTensileN: 0,
      avgMicroBendDb: 0
    };
  }

  let opt = 0;
  let comp = 0;
  let reheat = 0;
  let reject = 0;
  let sumTensile = 0;
  let sumMicroBend = 0;

  for (const r of records) {
    sumTensile += Number(r.tensileRetentionN) || 0;
    sumMicroBend += Number(r.microBendLossDb) || 0;
    const v = r.verdict?.code || '';
    if (v === 'OPTIMAL') opt++;
    else if (v === 'COMPLIANT') comp++;
    else if (v === 'REHEAT_DUE') reheat++;
    else reject++;
  }

  const passCount = opt + comp;
  const passRate = total > 0 ? (passCount / total) * 100 : 0;

  return {
    total,
    optimalCount: opt,
    compliantCount: comp,
    reheatCount: reheat,
    rejectCount: reject,
    passRatePercent: Number(passRate.toFixed(1)),
    avgTensileN: Number((sumTensile / total).toFixed(1)),
    avgMicroBendDb: Number((sumMicroBend / total).toFixed(4))
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
export function generateSpliceSleeveCureCertHtml(record, { format = 'A4' } = {}) {
  if (!record) return '';

  const isPos = format.toUpperCase() === 'POS';
  const sleeve = SLEEVE_TYPES[record.sleeveType] || SLEEVE_TYPES.SLEEVE_60MM_STANDARD;
  const adhesive = HOT_MELT_ADHESIVES[record.adhesiveType] || HOT_MELT_ADHESIVES.EVA_STANDARD;
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
    <p>Outside Plant & Enclosure QA</p>
    <p>SPLICE PROTECTOR CURE SLIP</p>
  </div>
  <div class="row"><span class="bold">Cert ID:</span><span>${escapeHtml(record.id)}</span></div>
  <div class="row"><span>Date:</span><span>${dateStr}</span></div>
  <div class="row"><span>Tech:</span><span>${escapeHtml(record.technicianName)}</span></div>
  <div class="row"><span>Location:</span><span>${escapeHtml(record.location)}</span></div>
  ${record.customer ? `<div class="row"><span>Customer:</span><span>${escapeHtml(record.customer.name)}</span></div>` : ''}

  <div class="divider"></div>
  <div class="row"><span class="bold">Sleeve:</span><span>${escapeHtml(sleeve.name.split(' ')[0])}</span></div>
  <div class="row"><span>Heat Oven:</span><span>${record.ovenTempC}°C (${record.cureTimeSec}s)</span></div>
  <div class="row"><span>Cure Index:</span><span>${(record.energyRatio * 100).toFixed(0)}%</span></div>
  <div class="row"><span>Meniscus:</span><span>${record.hasMeniscusSeal ? 'PASSED (Hermetic)' : 'MISSING (Reheat)'}</span></div>

  <div class="divider"></div>
  <div class="row"><span>Void Diam:</span><span>${record.maxBubbleDiamMm.toFixed(2)} mm</span></div>
  <div class="row"><span>Over Splice:</span><span>${record.isBubbleOverSplice ? 'YES' : 'NO'}</span></div>
  <div class="row"><span>Micro-Bend:</span><span>${record.microBendLossDb.toFixed(4)} dB</span></div>
  <div class="row"><span class="bold">Tensile Hold:</span><span class="bold">${record.tensileRetentionN.toFixed(0)} N</span></div>

  <div class="verdict-box">
    ${escapeHtml(record.verdict?.code || 'UNKNOWN')}: ${record.tensileRetentionN >= 100 ? 'PASS' : 'RE-WORK'}
    <div style="font-size: 9px; font-weight: normal;">${escapeHtml(record.verdict?.labelUrdu || '')}</div>
  </div>

  <div class="footer">
    Telcordia GR-1380-CORE / IEC 61073-1<br>
    NOC Helpline: 042-37900000<br>
    *** KEEP IN CLOSURE TRAY ***
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
          <div class="sub-text">Outside Plant & Enclosure Joint Engineering Laboratory</div>
          <div style="font-size: 10px; color: #475569;">Baradari Road, Shahdara, Lahore, Punjab, Pakistan</div>
        </td>
        <td style="text-align: right;">
          <div style="font-size: 12px; font-weight: 700;">Certificate No: ${escapeHtml(record.id)}</div>
          <div style="font-size: 10px; color: #64748b;">Issue Date: ${dateStr}</div>
          <div style="font-size: 10px; color: #64748b;">Standard: Telcordia GR-1380-CORE / IEC 61073-1</div>
        </td>
      </tr>
    </table>

    <div class="cert-title-block">
      <h1 class="cert-title">OPTICAL FUSION SPLICE PROTECTOR CURE & TENSILE RETENTION CERTIFICATE</h1>
      <p class="cert-subtitle">Polyolefin Heat-Shrink Enclosure, EVA Melt Wetting & Micro-Bend Bubble Void Assessment</p>
      <div class="cert-badge">${escapeHtml(record.verdict?.label || 'CERTIFIED')} - ${escapeHtml(record.verdict?.labelUrdu || '')}</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Joint Closure / ODF Location</div>
        <div class="meta-val">${escapeHtml(record.location)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Certified Splicing Specialist</div>
        <div class="meta-val">${escapeHtml(record.technicianName)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Splice Sleeve Standard</div>
        <div class="meta-val">${escapeHtml(sleeve.name)} (${sleeve.nominalLengthMm}mm)</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Subscriber / Enclosure Context</div>
        <div class="meta-val">${record.customer ? `${escapeHtml(record.customer.name)} (${escapeHtml(record.customer.phone)})` : 'Outside Plant Distribution Tray'}</div>
      </div>
    </div>

    <h3 style="font-size: 13px; text-transform: uppercase; margin: 14px 0 6px 0; color: #0f172a;">Oven Heat Profile & Thermodynamic Parameters</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Measured / Applied Value</th>
          <th>Telcordia Nominal Target</th>
          <th>Cure Tolerance Verdict</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Oven Heating Temperature</strong></td>
          <td>${record.ovenTempC}°C</td>
          <td>${sleeve.minCureTempC}°C - ${sleeve.maxCureTempC}°C</td>
          <td>${record.ovenTempC >= sleeve.minCureTempC && record.ovenTempC <= sleeve.maxCureTempC ? '<span style="color:#10b981;font-weight:bold;">OPTIMAL</span>' : '<span style="color:#ef4444;font-weight:bold;">OUT OF SPEC</span>'}</td>
        </tr>
        <tr>
          <td><strong>Heating Cycle Duration</strong></td>
          <td>${record.cureTimeSec} seconds</td>
          <td>${sleeve.minCureTimeSec}s - ${sleeve.targetCureTimeSec + 6}s</td>
          <td>${record.cureTimeSec >= sleeve.minCureTimeSec ? '<span style="color:#10b981;font-weight:bold;">ADEQUATE</span>' : '<span style="color:#f59e0b;font-weight:bold;">UNDER-CURED</span>'}</td>
        </tr>
        <tr>
          <td><strong>Thermal Energy Index</strong></td>
          <td><strong>${(record.energyRatio * 100).toFixed(0)}%</strong></td>
          <td>85% - 130% target</td>
          <td>${record.energyRatio >= 0.85 && record.energyRatio <= 1.30 ? 'FULL CURE' : 'ADJUST HEATER'}</td>
        </tr>
      </tbody>
    </table>

    <h3 style="font-size: 13px; text-transform: uppercase; margin: 14px 0 6px 0; color: #0f172a;">Hermetic Seal, Void Defect & Mechanical Proof Test</h3>
    <table class="data-table">
      <thead>
        <tr>
          <th>Quality Check</th>
          <th>Observed Condition</th>
          <th>Standard Acceptance Criterion</th>
          <th>QA Result</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Adhesive Meniscus Seal</strong></td>
          <td>${record.hasMeniscusSeal ? 'Convex EVA Flow Meniscus Present' : 'Incomplete Flow / Flat Edge'}</td>
          <td>Hermetic Seal at Both Sleeve Ends</td>
          <td>${record.hasMeniscusSeal ? '<span style="color:#10b981;font-weight:bold;">PASS</span>' : '<span style="color:#ef4444;font-weight:bold;">FAIL</span>'}</td>
        </tr>
        <tr>
          <td><strong>Air Bubble Void Over Splice</strong></td>
          <td>${record.isBubbleOverSplice ? `Trapped Void: ${record.maxBubbleDiamMm.toFixed(2)}mm` : 'Zero Voids Over Core Junction'}</td>
          <td>Max ≤ 0.50mm, 0 over center core</td>
          <td>${!record.isBubbleOverSplice && record.maxBubbleDiamMm <= 0.5 ? '<span style="color:#10b981;font-weight:bold;">PASS</span>' : '<span style="color:#f59e0b;font-weight:bold;">CHECK STRESS</span>'}</td>
        </tr>
        <tr>
          <td><strong>Induced Micro-Bend Attenuation</strong></td>
          <td><strong>${record.microBendLossDb.toFixed(4)} dB</strong></td>
          <td>≤ 0.0200 dB (IEC 60793-1-46)</td>
          <td>${record.microBendLossDb <= 0.02 ? '<span style="color:#10b981;font-weight:bold;">PASS</span>' : '<span style="color:#ef4444;font-weight:bold;">EXCESSIVE</span>'}</td>
        </tr>
        <tr style="background: #f8fafc;">
          <td><strong>Axial Tensile Proof Retention</strong></td>
          <td><strong style="font-size: 14px; color: ${record.tensileRetentionN >= 100 ? '#0284c7' : '#ef4444'};">${record.tensileRetentionN.toFixed(1)} N</strong></td>
          <td>≥ 100.0 N (Telcordia GR-1380)</td>
          <td><strong>${record.tensileRetentionN >= 100 ? 'ACCREDITED PASS' : 'WEAK RETENTION'}</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="summary-card">
      <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Engineering Metrology Analysis</div>
      <div style="font-size: 12px; margin-top: 4px; color: #1e293b;">
        <strong>Strength Member:</strong> ${escapeHtml(sleeve.strengthMemberType)}<br>
        <strong>Technical Notes:</strong> ${escapeHtml(record.notes || 'Fusion joint protector cured under standard SOP. Fully compliant with outside plant moisture barrier standards.')}
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
export function formatSpliceSleeveCureCertWhatsApp(record) {
  if (!record) return '';
  const dateStr = record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' }) : 'Today';
  const sleeve = SLEEVE_TYPES[record.sleeveType] || SLEEVE_TYPES.SLEEVE_60MM_STANDARD;

  return `🔬 *SHAHDARA FIBER NET - SPLICE SLEEVE CURE QA CERTIFICATE*
📜 *Cert No:* ${record.id}
📅 *Date:* ${dateStr}
📍 *Location:* ${record.location}
👷 *Technician:* ${record.technicianName}
${record.customer ? `👤 *Subscriber:* ${record.customer.name} (${record.customer.zone})\n` : ''}
🛡️ *Sleeve Spec:* ${sleeve.name} (${sleeve.nominalLengthMm}mm)
🔥 *Oven Profile:* ${record.ovenTempC}°C (${record.cureTimeSec}s, Index: ${(record.energyRatio * 100).toFixed(0)}%)

📊 *Quality Assessment:*
• Meniscus Seal: ${record.hasMeniscusSeal ? '✅ Hermetic Flow OK' : '⚠️ Seal Missing / Flat'}
• Air Void: ${record.maxBubbleDiamMm.toFixed(2)} mm (${record.isBubbleOverSplice ? 'OVER CORE' : 'Peripheral'})
• Micro-Bend Loss: ${record.microBendLossDb.toFixed(4)} dB
• Tensile Hold: ${record.tensileRetentionN.toFixed(0)} N (Standard: ≥100 N)
🎯 *Verdict:* ${record.verdict?.code} - ${record.verdict?.label}
🇵🇰 *اردو رزلٹ:* ${record.verdict?.labelUrdu}

${record.tensileRetentionN >= 100 ? '✅ *Approved for Outside Plant Splicing Tray Closing.*' : '⚠️ *Action Required! Re-heat or replace protector sleeve under Telcordia GR-1380.*'}
📞 *Shahdara NOC Metrology:* 042-37900000`;
}

/**
 * Generates compliant RFC-4180 CSV Export with UTF-8 BOM.
 * @param {Array} records
 * @returns {string} CSV text
 */
export function generateSpliceSleeveCureCertsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Date',
    'Customer Name',
    'Location',
    'Technician',
    'Sleeve Type',
    'Oven Temp (C)',
    'Cure Time (s)',
    'Energy Ratio',
    'Meniscus Seal',
    'Max Bubble (mm)',
    'Bubble Over Splice',
    'Micro-Bend Loss (dB)',
    'Tensile Retention (N)',
    'Verdict Code',
    'Status'
  ];

  const rows = records.map(r => [
    r.id,
    r.createdAt ? r.createdAt.slice(0, 19).replace('T', ' ') : '',
    r.customer?.name || 'N/A',
    r.location || '',
    r.technicianName || '',
    r.sleeveType,
    r.ovenTempC,
    r.cureTimeSec,
    r.energyRatio?.toFixed(2) || '1.00',
    r.hasMeniscusSeal ? 'YES' : 'NO',
    r.maxBubbleDiamMm?.toFixed(2) || '0.00',
    r.isBubbleOverSplice ? 'YES' : 'NO',
    r.microBendLossDb?.toFixed(4) || '0.0000',
    r.tensileRetentionN?.toFixed(1) || '0.0',
    r.verdict?.code || '',
    r.status || ''
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
export function setupSpliceSleeveCureModal({
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

  const sleeveSelect = dialogElement.querySelector('#sleeveTypeSelect');
  const adhesiveSelect = dialogElement.querySelector('#sleeveAdhesiveSelect');
  const presetSelect = dialogElement.querySelector('#sleevePresetSelect');
  const tempInput = dialogElement.querySelector('#sleeveTempInput');
  const timeInput = dialogElement.querySelector('#sleeveTimeInput');
  const ambientInput = dialogElement.querySelector('#sleeveAmbientInput');
  const bubbleCountInput = dialogElement.querySelector('#sleeveBubbleCountInput');
  const bubbleDiamInput = dialogElement.querySelector('#sleeveBubbleDiamInput');
  const overSpliceSelect = dialogElement.querySelector('#sleeveOverSpliceSelect');
  const meniscusSelect = dialogElement.querySelector('#sleeveMeniscusSelect');
  const tubeCondSelect = dialogElement.querySelector('#sleeveTubeCondSelect');
  const technicianInput = dialogElement.querySelector('#sleeveTechnicianInput');
  const locationInput = dialogElement.querySelector('#sleeveLocationInput');
  const notesInput = dialogElement.querySelector('#sleeveNotesInput');

  // Preview elements
  const svgContainer = dialogElement.querySelector('#sleeveSvgContainer');
  const energyBadge = dialogElement.querySelector('#sleeveEnergyBadge');
  const verdictPill = dialogElement.querySelector('#sleeveVerdictPill');
  const tensileBadge = dialogElement.querySelector('#sleeveTensileBadge');
  const microBendBadge = dialogElement.querySelector('#sleeveMicroBendBadge');
  const meniscusBadge = dialogElement.querySelector('#sleeveMeniscusBadge');

  // History table
  const historyTbody = dialogElement.querySelector('#sleeveHistoryTbody');
  const searchInput = dialogElement.querySelector('#sleeveHistorySearch');
  const verdictFilter = dialogElement.querySelector('#sleeveHistoryVerdictFilter');

  // Buttons
  const saveBtn = dialogElement.querySelector('#sleeveSaveCertBtn');
  const printA4Btn = dialogElement.querySelector('#sleevePrintA4Btn');
  const printPosBtn = dialogElement.querySelector('#sleevePrintPosBtn');
  const exportCsvBtn = dialogElement.querySelector('#sleeveExportCsvBtn');
  const whatsAppBtn = dialogElement.querySelector('#sleeveWhatsAppBtn');
  const closeBtn = dialogElement.querySelector('#sleeveCloseBtn');

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

  if (sleeveSelect && !sleeveSelect.children.length) {
    Object.values(SLEEVE_TYPES).forEach(s => {
      sleeveSelect.appendChild(createOption(s.id, `${s.name} (${s.nominalLengthMm}mm)`));
    });
  }

  if (adhesiveSelect && !adhesiveSelect.children.length) {
    Object.values(HOT_MELT_ADHESIVES).forEach(a => {
      adhesiveSelect.appendChild(createOption(a.id, `${a.name}`));
    });
  }

  if (presetSelect && presetSelect.children.length <= 1) {
    Object.values(SHAH_SLEEVE_PRESETS).forEach(p => {
      presetSelect.appendChild(createOption(p.id, p.name));
    });
  }

  function getFormValues() {
    return {
      sleeveType: sleeveSelect?.value || 'SLEEVE_60MM_STANDARD',
      adhesiveType: adhesiveSelect?.value || 'EVA_STANDARD',
      ovenTempC: Number(tempInput?.value) || 200,
      cureTimeSec: Number(timeInput?.value) || 28,
      ambientTempC: Number(ambientInput?.value) || 25,
      bubbleCount: Number(bubbleCountInput?.value) || 0,
      maxBubbleDiamMm: Number(bubbleDiamInput?.value) || 0,
      isBubbleOverSplice: overSpliceSelect?.value === 'YES',
      hasMeniscusSeal: meniscusSelect?.value !== 'NO',
      outerTubeCondition: tubeCondSelect?.value || 'PRISTINE_CRYSTALLINE'
    };
  }

  function recalculate() {
    const values = getFormValues();
    const analysis = evaluateSleeveCureQa(values);

    if (svgContainer) {
      svgContainer.innerHTML = renderSpliceSleeveCureSvg(analysis);
    }
    if (energyBadge) {
      energyBadge.textContent = `${(analysis.energyRatio * 100).toFixed(0)}%`;
      energyBadge.style.color = analysis.verdict.colorHex;
    }
    if (verdictPill) {
      verdictPill.textContent = `${analysis.verdict.code}: ${analysis.verdict.label}`;
      verdictPill.className = `status-pill ${analysis.verdict.badgeClass}`;
      verdictPill.style.backgroundColor = analysis.verdict.colorHex + '22';
      verdictPill.style.color = analysis.verdict.colorHex;
    }
    if (tensileBadge) tensileBadge.textContent = `${analysis.tensileRetentionN.toFixed(0)} N`;
    if (microBendBadge) microBendBadge.textContent = `${analysis.microBendLossDb.toFixed(4)} dB`;
    if (meniscusBadge) {
      meniscusBadge.textContent = analysis.hasMeniscusSeal ? 'PASSED (Hermetic)' : 'MISSING (Gap)';
      meniscusBadge.style.color = analysis.hasMeniscusSeal ? '#10b981' : '#ef4444';
    }

    return analysis;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const records = getSavedSpliceSleeveCureCerts(storage);
    const query = searchInput?.value.trim().toLowerCase() || '';
    const filterV = verdictFilter?.value || 'ALL';

    const filtered = records.filter(r => {
      if (filterV !== 'ALL' && (r.verdict?.code || '') !== filterV) return false;
      if (query) {
        const text = `${r.id} ${r.location} ${r.technicianName} ${r.customer?.name || ''} ${r.sleeveType}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      historyTbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#94a3b8;">No splice sleeve cure QA records found.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = filtered.map(r => `
      <tr>
        <td style="font-family: monospace; font-weight: 600;">${escapeHtml(r.id)}</td>
        <td>${r.createdAt ? r.createdAt.slice(0, 10) : ''}</td>
        <td>${escapeHtml(r.customer?.name || r.location || 'OSP Enclosure')}</td>
        <td>${escapeHtml(r.sleeveType.replace('SLEEVE_', ''))} (${r.ovenTempC}°C/${r.cureTimeSec}s)</td>
        <td><strong>${r.tensileRetentionN.toFixed(0)} N</strong></td>
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
          openPrintWindow(generateSpliceSleeveCureCertHtml(record, { format: 'POS' }));
        } else if (action === 'print-a4') {
          openPrintWindow(generateSpliceSleeveCureCertHtml(record, { format: 'A4' }));
        }
      });
    });
  }

  // Event Listeners
  [sleeveSelect, adhesiveSelect, overSpliceSelect, meniscusSelect, tubeCondSelect].forEach(el => {
    el?.addEventListener('change', recalculate);
  });
  [tempInput, timeInput, ambientInput, bubbleCountInput, bubbleDiamInput].forEach(el => {
    el?.addEventListener('input', recalculate);
    el?.addEventListener('change', recalculate);
  });

  presetSelect?.addEventListener('change', () => {
    const pid = presetSelect.value;
    const p = SHAH_SLEEVE_PRESETS[pid];
    if (!p) return;

    if (sleeveSelect) sleeveSelect.value = p.sleeveType;
    if (adhesiveSelect) adhesiveSelect.value = p.adhesiveType;
    if (tempInput) tempInput.value = p.ovenTempC;
    if (timeInput) timeInput.value = p.cureTimeSec;
    if (ambientInput) ambientInput.value = p.ambientTempC;
    if (bubbleCountInput) bubbleCountInput.value = p.bubbleCount;
    if (bubbleDiamInput) bubbleDiamInput.value = p.maxBubbleDiamMm;
    if (overSpliceSelect) overSpliceSelect.value = p.isBubbleOverSplice ? 'YES' : 'NO';
    if (meniscusSelect) meniscusSelect.value = p.hasMeniscusSeal ? 'YES' : 'NO';
    if (tubeCondSelect) tubeCondSelect.value = p.outerTubeCondition;
    if (technicianInput) technicianInput.value = p.technicianName;
    if (locationInput) locationInput.value = p.location;

    recalculate();
    onToast(`Applied field preset: ${p.name}`);
  });

  saveBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildSpliceSleeveCureRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value || 'Certified Specialist',
      location: locationInput?.value || 'Outside Plant Enclosure',
      notes: notesInput?.value || ''
    });

    const ok = saveSpliceSleeveCureCert(record, storage);
    if (ok) {
      onToast(`Saved Splice Protector Certificate ${record.id}!`);
      renderHistory();
    } else {
      onToast('Error saving record.');
    }
  });

  printA4Btn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildSpliceSleeveCureRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const html = generateSpliceSleeveCureCertHtml(record, { format: 'A4' });
    openPrintWindow(html);
  });

  printPosBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildSpliceSleeveCureRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const html = generateSpliceSleeveCureCertHtml(record, { format: 'POS' });
    openPrintWindow(html);
  });

  exportCsvBtn?.addEventListener('click', () => {
    const records = getSavedSpliceSleeveCureCerts(storage);
    if (!records.length) {
      onToast('No saved records to export.');
      return;
    }
    const csv = generateSpliceSleeveCureCertsCsv(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara_splice_sleeve_qa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported CSV successfully!');
  });

  whatsAppBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildSpliceSleeveCureRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const text = formatSpliceSleeveCureCertWhatsApp(record);
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
