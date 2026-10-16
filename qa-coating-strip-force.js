/**
 * Shahdara ISP Billing & Network Operations - Optical Fiber Primary/Secondary Acrylate Coating Mechanical Stripping Peak Force,
 * Tool Notch Calibration & Cladding Micro-Scratch QA Certification Suite
 * Standards: IEC 60793-1-32, Telcordia GR-20-CORE Issue 4, TIA-455-178-B (FOTP-178)
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const STRIP_FORCE_QA_STORAGE_KEY = 'shahdara_strip_force_qa_certs_v1';

export const STRIPPER_TOOLS = {
  'MILLER_CFS3': {
    id: 'MILLER_CFS3',
    brand: 'Ripley Miller',
    model: 'CFS-3 3-Hole Fiber Optic Stripper',
    type: 'Cold Mechanical Hand Tool',
    targetNotchUm: 140.0,
    minNotchUm: 135.0,
    maxNotchUm: 145.0,
    holeCount: 3,
    firstHoleDesc: '1.6mm - 3.0mm Cable Jacket',
    secondHoleDesc: '600µm - 900µm Buffer Tube',
    thirdHoleDesc: '250µm Coating to 125µm Bare Cladding',
    typicalPeakForceN: 3.2,
    serviceLifeStrips: 10000
  },
  'FUJIKURA_RS03': {
    id: 'FUJIKURA_RS03',
    brand: 'Fujikura',
    model: 'RS03 Single/Ribbon Thermal Stripper',
    type: 'Thermal Heated Blade Stripper',
    targetNotchUm: 142.0,
    minNotchUm: 138.0,
    maxNotchUm: 146.0,
    holeCount: 1,
    firstHoleDesc: 'Heated Dual Blade (100°C - 140°C)',
    secondHoleDesc: 'N/A',
    thirdHoleDesc: '200µm - 400µm Coating to 125µm Glass',
    typicalPeakForceN: 1.8,
    serviceLifeStrips: 50000
  },
  'SUMITOMO_JR6': {
    id: 'SUMITOMO_JR6',
    brand: 'Sumitomo Electric',
    model: 'JR-6+ Heated Precision Jacket Remover',
    type: 'Precision Thermal Stripper',
    targetNotchUm: 141.0,
    minNotchUm: 137.0,
    maxNotchUm: 145.0,
    holeCount: 1,
    firstHoleDesc: 'Controlled Induction Heating',
    secondHoleDesc: 'N/A',
    thirdHoleDesc: '250µm Coating to 125µm Glass',
    typicalPeakForceN: 1.9,
    serviceLifeStrips: 45000
  },
  'PROSKIT_8PK326': {
    id: 'PROSKIT_8PK326',
    brand: 'ProsKit',
    model: '8PK-326 Tri-Hole Fiber Stripper',
    type: 'Mechanical Field Plier',
    targetNotchUm: 140.0,
    minNotchUm: 132.0,
    maxNotchUm: 148.0,
    holeCount: 3,
    firstHoleDesc: '2.0mm - 3.0mm Outer Jacket',
    secondHoleDesc: '900µm Tight Buffer',
    thirdHoleDesc: '250µm Acrylate to 125µm Cladding',
    typicalPeakForceN: 3.8,
    serviceLifeStrips: 6000
  },
  'LOCAL_ECONOMY_TOOL': {
    id: 'LOCAL_ECONOMY_TOOL',
    brand: 'Generic / Local Market',
    model: 'Economy Fiber Plier (Uncalibrated)',
    type: 'Uncalibrated Mechanical Tool',
    targetNotchUm: 136.0,
    minNotchUm: 125.0,
    maxNotchUm: 155.0,
    holeCount: 2,
    firstHoleDesc: '2.0mm Jacket',
    secondHoleDesc: '250µm to 125µm Cladding',
    thirdHoleDesc: 'N/A',
    typicalPeakForceN: 6.5,
    serviceLifeStrips: 2000
  }
};

export const FIBER_COATING_TYPES = {
  'DUAL_ACRYLATE_250': {
    id: 'DUAL_ACRYLATE_250',
    label: 'Standard Dual-Layer UV-Cured Acrylate (250µm)',
    nominalCoatingDiameterUm: 245.0,
    nominalGlassDiameterUm: 125.0,
    innerCoatingModulusMpa: 1.2,
    outerCoatingModulusMpa: 750.0,
    telcordiaMinForceN: 1.3,
    telcordiaMaxForceN: 8.9,
    optimalMinForceN: 2.0,
    optimalMaxForceN: 4.5
  },
  'BEND_INSENSITIVE_250': {
    id: 'BEND_INSENSITIVE_250',
    label: 'G.657.A1/A2 Color-Coded Drop Acrylate (250µm)',
    nominalCoatingDiameterUm: 250.0,
    nominalGlassDiameterUm: 125.0,
    innerCoatingModulusMpa: 1.4,
    outerCoatingModulusMpa: 820.0,
    telcordiaMinForceN: 1.3,
    telcordiaMaxForceN: 8.9,
    optimalMinForceN: 2.2,
    optimalMaxForceN: 4.8
  },
  'COMPACT_COATING_200': {
    id: 'COMPACT_COATING_200',
    label: 'High-Density Micro-Duct Compact Acrylate (200µm)',
    nominalCoatingDiameterUm: 200.0,
    nominalGlassDiameterUm: 125.0,
    innerCoatingModulusMpa: 1.1,
    outerCoatingModulusMpa: 850.0,
    telcordiaMinForceN: 1.3,
    telcordiaMaxForceN: 7.5,
    optimalMinForceN: 1.8,
    optimalMaxForceN: 4.0
  },
  'TIGHT_BUFFER_900': {
    id: 'TIGHT_BUFFER_900',
    label: 'Tight-Buffered Pigtail LSZH Polymer (900µm)',
    nominalCoatingDiameterUm: 900.0,
    nominalGlassDiameterUm: 125.0,
    innerCoatingModulusMpa: 1.5,
    outerCoatingModulusMpa: 950.0,
    telcordiaMinForceN: 2.0,
    telcordiaMaxForceN: 12.0,
    optimalMinForceN: 3.5,
    optimalMaxForceN: 7.0
  }
};

export const STRIP_QA_VERDICTS = {
  GRADE_A_PRISTINE: {
    id: 'GRADE_A_PRISTINE',
    label: 'Telcordia GR-20 Grade A Pristine Strippability',
    description: 'Optimal force (1.8 - 4.5 N), zero residue, pristine mirror silica surface.',
    badgeClass: 'badge-grade-a',
    colorHex: '#10b981',
    isCompliant: true
  },
  COMMERCIAL_PASS: {
    id: 'COMMERCIAL_PASS',
    label: 'Telcordia / IEC Standard Compliant Pass',
    description: 'Force within 1.3 - 8.9 N, minimal residue cleared with single IPA wipe.',
    badgeClass: 'badge-pass',
    colorHex: '#0ea5e9',
    isCompliant: true
  },
  CONDITIONAL_PASS: {
    id: 'CONDITIONAL_PASS',
    label: 'Conditional Pass (Sub-optimal Force / Residue Cleaning Mandated)',
    description: 'Force near bounds or moderate residue. Requires double IPA wipe cleaning.',
    badgeClass: 'badge-warning',
    colorHex: '#f59e0b',
    isCompliant: true
  },
  FAILED_HIGH_FORCE_GOUGE: {
    id: 'FAILED_HIGH_FORCE_GOUGE',
    label: 'REJECTED - Excessive Force / Cladding Scratch Flaw',
    description: 'Force > 8.9 N or notch biting glass, causing Griffith micro-crack fracture hazard.',
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    isCompliant: false
  },
  FAILED_LOW_ADHESION_DELAMINATION: {
    id: 'FAILED_LOW_ADHESION_DELAMINATION',
    label: 'REJECTED - Coating Delamination / Inadequate Adhesion',
    description: 'Force < 1.3 N indicates defective coating bond, water migration risk.',
    badgeClass: 'badge-danger',
    colorHex: '#ef4444',
    isCompliant: false
  }
};

export const STRIP_FORCE_PRESETS = {
  PRESET_MILLER_CFS3_STANDARD_PASS: {
    id: 'PRESET_MILLER_CFS3_STANDARD_PASS',
    label: 'Standard FTTH Drop Stripping (Miller CFS-3 - Grade A)',
    toolId: 'MILLER_CFS3',
    coatingTypeId: 'DUAL_ACRYLATE_250',
    stripperSerialNumber: 'CFS3-22810',
    measuredNotchUm: 139.5,
    peakForceN: 3.2,
    stripLengthMm: 35.0,
    strippingSpeedMmS: 25.0,
    strippingTemperatureC: 22.0,
    residueScore: 5,
    hasVisibleScratches: false,
    estimatedFlawDepthNm: 0,
    location: 'Baradari Feeder FAT Closure #02'
  },
  PRESET_FUJIKURA_RS03_THERMAL_PERFECT: {
    id: 'PRESET_FUJIKURA_RS03_THERMAL_PERFECT',
    label: 'Thermal Precision Ribbon Fiber Stripping (Fujikura RS03 - Pristine)',
    toolId: 'FUJIKURA_RS03',
    coatingTypeId: 'BEND_INSENSITIVE_250',
    stripperSerialNumber: 'RS03-99412',
    measuredNotchUm: 141.2,
    peakForceN: 1.85,
    stripLengthMm: 40.0,
    strippingSpeedMmS: 30.0,
    strippingTemperatureC: 110.0,
    residueScore: 5,
    hasVisibleScratches: false,
    estimatedFlawDepthNm: 0,
    location: 'Shahdara Central OLT Main Distribution Frame'
  },
  PRESET_DULL_BLADE_CLADDING_GOUGE: {
    id: 'PRESET_DULL_BLADE_CLADDING_GOUGE',
    label: 'Dull / Misaligned Stripper Blade (Notch Gouging Glass Scratch Fail)',
    toolId: 'LOCAL_ECONOMY_TOOL',
    coatingTypeId: 'DUAL_ACRYLATE_250',
    stripperSerialNumber: 'GEN-4412',
    measuredNotchUm: 126.5,
    peakForceN: 7.9,
    stripLengthMm: 30.0,
    strippingSpeedMmS: 20.0,
    strippingTemperatureC: 24.0,
    residueScore: 2,
    hasVisibleScratches: true,
    estimatedFlawDepthNm: 450,
    location: 'Begum Kot Street #3 Lineman Joint'
  },
  PRESET_WEATHERED_DROP_CABLE_HARDENED: {
    id: 'PRESET_WEATHERED_DROP_CABLE_HARDENED',
    label: 'Weathered / UV-Hardened Aerial Drop (Excessive 11.4N Force Fail)',
    toolId: 'PROSKIT_8PK326',
    coatingTypeId: 'BEND_INSENSITIVE_250',
    stripperSerialNumber: 'PK8-33120',
    measuredNotchUm: 140.0,
    peakForceN: 11.4,
    stripLengthMm: 35.0,
    strippingSpeedMmS: 15.0,
    strippingTemperatureC: 38.0,
    residueScore: 2,
    hasVisibleScratches: false,
    estimatedFlawDepthNm: 120,
    location: 'Jia Musa Rooftop Aerial Drop Run'
  },
  PRESET_DEFECTIVE_LOOSE_JACKET_DELAMINATION: {
    id: 'PRESET_DEFECTIVE_LOOSE_JACKET_DELAMINATION',
    label: 'Defective Delaminated Coating (Low Adhesion 0.75N Force Fail)',
    toolId: 'MILLER_CFS3',
    coatingTypeId: 'DUAL_ACRYLATE_250',
    stripperSerialNumber: 'CFS3-99124',
    measuredNotchUm: 140.0,
    peakForceN: 0.75,
    stripLengthMm: 45.0,
    strippingSpeedMmS: 25.0,
    strippingTemperatureC: 22.0,
    residueScore: 3,
    hasVisibleScratches: false,
    estimatedFlawDepthNm: 0,
    location: 'Rachna Town Commercial Sub-FAT'
  }
};

/**
 * Calculates Griffith surface flaw fracture strength and tensile breaking stress.
 * Glass fracture toughness K_Ic = 0.75 MPa*m^0.5, flaw geometry factor Y = 1.12.
 * @param {number} flawDepthNm
 * @returns {Object}
 */
export function calculateGriffithFractureStrength(flawDepthNm = 0) {
  const depthNm = Math.max(0, Number(flawDepthNm) || 0);
  const kIc = 0.75; // MPa * m^0.5
  const Y = 1.12;

  // Pristine silica glass theoretical breaking stress ~ 4800 MPa (4.8 GPa)
  if (depthNm <= 5) {
    return {
      flawDepthNm: depthNm,
      breakingStressMpa: 4800.0,
      breakingStressGpa: 4.80,
      breakingStressKpsi: 696.0,
      strengthRetentionPercent: 100.0,
      severity: 'PRISTINE_NO_FLAWS',
      severityLabel: 'Pristine Flawless Cladding (Full Proof Strength)'
    };
  }

  // Griffith equation: sigma_f = K_Ic / (Y * sqrt(a))
  // a in meters = depthNm * 1e-9
  const aMeters = depthNm * 1e-9;
  const sigmaMpa = Math.min(4800.0, Math.round((kIc / (Y * Math.sqrt(aMeters))) * 10) / 10);
  const sigmaGpa = Math.round((sigmaMpa / 1000.0) * 100) / 100;
  const sigmaKpsi = Math.round((sigmaMpa * 0.145038) * 10) / 10;
  const retentionPercent = Math.min(100.0, Math.round((sigmaMpa / 4800.0) * 1000) / 10);

  let severity = 'NEGLIGIBLE_HAZARD';
  let severityLabel = 'Superficial Micro-Scuff (Minor Strength Impact)';
  if (sigmaMpa < 800.0) {
    severity = 'CRITICAL_FRACTURE_HAZARD';
    severityLabel = 'CRITICAL - Deep Cladding Gouge (Severe Snapping Risk)';
  } else if (sigmaMpa < 1800.0) {
    severity = 'HIGH_STRESS_DEGRADATION';
    severityLabel = 'High Stress Concentration (Early Failure in Tray Bend)';
  } else if (sigmaMpa < 3200.0) {
    severity = 'MODERATE_FLAW';
    severityLabel = 'Moderate Cladding Abrasion (Reduced Tensile Margin)';
  }

  return {
    flawDepthNm: depthNm,
    breakingStressMpa: sigmaMpa,
    breakingStressGpa: sigmaGpa,
    breakingStressKpsi: sigmaKpsi,
    strengthRetentionPercent: retentionPercent,
    severity,
    severityLabel
  };
}

/**
 * Evaluates coating stripping peak force, blade notch clearance, and cleanliness compliance.
 * @param {Object} options
 * @returns {Object}
 */
export function evaluateStripForceQa({
  toolId = 'MILLER_CFS3',
  coatingTypeId = 'DUAL_ACRYLATE_250',
  stripperSerialNumber = 'CFS3-22810',
  measuredNotchUm = 140.0,
  peakForceN = 3.2,
  stripLengthMm = 35.0,
  strippingSpeedMmS = 25.0,
  strippingTemperatureC = 22.0,
  residueScore = 5,
  hasVisibleScratches = false,
  estimatedFlawDepthNm = 0,
  location = 'Shahdara Network Joint'
} = {}) {
  const tool = STRIPPER_TOOLS[toolId] || STRIPPER_TOOLS.MILLER_CFS3;
  const coating = FIBER_COATING_TYPES[coatingTypeId] || FIBER_COATING_TYPES.DUAL_ACRYLATE_250;

  const force = Math.max(0, Number(peakForceN) || 0);
  const notch = Math.max(100, Number(measuredNotchUm) || 140.0);
  const length = Math.max(5, Number(stripLengthMm) || 35.0);
  const speed = Math.max(1, Number(strippingSpeedMmS) || 25.0);
  const temp = Number(strippingTemperatureC) || 22.0;
  const residue = Math.max(1, Math.min(5, Number(residueScore) || 5));
  const scratched = Boolean(hasVisibleScratches);
  const flawDepth = scratched ? Math.max(50, Number(estimatedFlawDepthNm) || 200) : 0;

  // Blade clearance over 125µm cladding
  const radialClearanceUm = Math.round(((notch - 125.0) / 2.0) * 10) / 10;

  // Notch aperture condition
  let notchStatus = 'OPTIMAL_CLEARANCE';
  let notchLabel = 'Optimal V-Notch Aperture (Clean Cladding Clearance)';
  if (notch < 130.0) {
    notchStatus = 'COLLISION_HAZARD';
    notchLabel = 'CRITICAL: Notch Narrower than 130µm (Bites Direct into Glass)';
  } else if (notch > 152.0) {
    notchStatus = 'EXCESSIVE_GAP';
    notchLabel = 'Warning: Notch Too Wide (Leaves Coating Residue)';
  }

  // Fracture strength evaluation
  const fracture = calculateGriffithFractureStrength(flawDepth);

  // Determine Overall QA Verdict
  let verdict = STRIP_QA_VERDICTS.COMMERCIAL_PASS;

  if (scratched || notch < 130.0 || force > coating.telcordiaMaxForceN) {
    verdict = STRIP_QA_VERDICTS.FAILED_HIGH_FORCE_GOUGE;
  } else if (force < coating.telcordiaMinForceN) {
    verdict = STRIP_QA_VERDICTS.FAILED_LOW_ADHESION_DELAMINATION;
  } else if (
    force >= coating.optimalMinForceN &&
    force <= coating.optimalMaxForceN &&
    residue >= 4 &&
    !scratched &&
    notchStatus === 'OPTIMAL_CLEARANCE'
  ) {
    verdict = STRIP_QA_VERDICTS.GRADE_A_PRISTINE;
  } else if (force >= coating.telcordiaMinForceN && force <= coating.telcordiaMaxForceN && residue >= 3) {
    verdict = STRIP_QA_VERDICTS.COMMERCIAL_PASS;
  } else {
    verdict = STRIP_QA_VERDICTS.CONDITIONAL_PASS;
  }

  return {
    tool,
    coating,
    stripperSerialNumber: String(stripperSerialNumber || 'UNSPECIFIED').trim(),
    location: String(location || 'Shahdara Network Joint').trim(),
    peakForceN: force,
    measuredNotchUm: notch,
    radialClearanceUm,
    notchStatus,
    notchLabel,
    stripLengthMm: length,
    strippingSpeedMmS: speed,
    strippingTemperatureC: temp,
    residueScore: residue,
    hasVisibleScratches: scratched,
    fracture,
    verdict,
    isApproved: verdict.isCompliant
  };
}

/**
 * Pure-vector SVG visualizer displaying:
 * 1. Longitudinal fiber cross-section showing 250µm coating, stripping transition, 125µm bare glass, and 9µm core.
 * 2. V-notch stripper blades clamping with aperture dimension callouts.
 * 3. Telcordia GR-20 stripping force scale with colored pass zones and dial indicator.
 * 4. High-magnification cladding surface flaw inspection callout.
 * @param {Object} evaluation - Output of evaluateStripForceQa
 * @param {Object} [options]
 * @returns {string}
 */
export function renderStripForceAnalysisSvg(evaluation, { width = 760, height = 360 } = {}) {
  if (!evaluation) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="50%" fill="#94a3b8" text-anchor="middle" font-family="sans-serif">No Strip Force QA Data</text></svg>`;
  }

  const { tool, coating, peakForceN, measuredNotchUm, radialClearanceUm, residueScore, hasVisibleScratches, fracture, verdict } = evaluation;

  // Telcordia bounds: min 1.3N, max 8.9N
  const force = peakForceN;
  const maxScaleN = 14.0;
  // Map force (0 to 14N) to horizontal bar (width 260px)
  const barWidth = 260;
  const forcePos = Math.min(barWidth, Math.max(0, (force / maxScaleN) * barWidth));
  const minPos = (1.3 / maxScaleN) * barWidth;
  const maxPos = (8.9 / maxScaleN) * barWidth;

  const verdictColor = verdict.colorHex;

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fiber Optic Coating Strip Force and Blade Notch Metrology Visualizer" style="background: #090d16; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <defs>
      <!-- Gradients -->
      <linearGradient id="coatingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="50%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#d97706"/>
      </linearGradient>

      <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="50%" stop-color="#bae6fd"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>

      <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#64748b"/>
        <stop offset="50%" stop-color="#94a3b8"/>
        <stop offset="100%" stop-color="#475569"/>
      </linearGradient>
    </defs>

    <!-- Top Telemetry Header -->
    <rect x="0" y="0" width="${width}" height="42" fill="#0f172a" opacity="0.95"/>
    <text x="20" y="26" fill="#f8fafc" font-size="13" font-weight="700">🔬 Coating Stripping Force &amp; Cladding Surface Integrity Metrology</text>
    <rect x="${width - 250}" y="8" width="230" height="26" rx="4" fill="${verdictColor}" opacity="0.2"/>
    <rect x="${width - 250}" y="8" width="230" height="26" rx="4" fill="none" stroke="${verdictColor}" stroke-width="1.5"/>
    <text x="${width - 135}" y="25" fill="${verdictColor}" font-size="11" font-weight="700" text-anchor="middle">${verdict.label.split('(')[0].trim()}</text>

    <!-- Main Inspection Stage -->
    <rect x="25" y="55" width="${width - 50}" height="240" rx="6" fill="#030712" stroke="#334155" stroke-width="1.5"/>

    <!-- Left: Fiber Stripping Diagram -->
    <g transform="translate(45, 75)">
      <text x="0" y="15" fill="#94a3b8" font-size="11" font-weight="700">OPTICAL FIBER STRIPPING TRANSITION</text>

      <!-- 250um Outer Coating Section (Left) -->
      <rect x="0" y="50" width="140" height="80" rx="4" fill="url(#coatingGrad)" stroke="#b45309" stroke-width="1"/>
      <text x="70" y="95" fill="#78350f" font-size="11" font-weight="800" text-anchor="middle">250µm Jacket</text>

      <!-- Stripped 125um Bare Glass Cladding Section (Right) -->
      <rect x="140" y="70" width="170" height="40" fill="url(#glassGrad)" stroke="#0284c7" stroke-width="1"/>
      <!-- 9um Core -->
      <line x1="0" y1="90" x2="310" y2="90" stroke="#f8fafc" stroke-width="3" stroke-dasharray="4,2"/>
      <text x="225" y="94" fill="#0f172a" font-size="10" font-weight="800" text-anchor="middle">125µm Bare Glass</text>

      <!-- Stripper V-Notch Blade Position Indicator -->
      <!-- Top Blade -->
      <polygon points="135,10  145,10  142,66  138,66" fill="url(#bladeGrad)" stroke="#cbd5e1" stroke-width="1"/>
      <!-- Bottom Blade -->
      <polygon points="135,170  145,170  142,114  138,114" fill="url(#bladeGrad)" stroke="#cbd5e1" stroke-width="1"/>
      <text x="140" y="8" fill="#f8fafc" font-size="10" font-weight="700" text-anchor="middle">V-Notch (${measuredNotchUm}µm)</text>

      <!-- Dimension Callout -->
      <line x1="140" y1="135" x2="310" y2="135" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2"/>
      <text x="225" y="150" fill="#94a3b8" font-size="10" text-anchor="middle">Strip Length: ${evaluation.stripLengthMm} mm</text>

      ${hasVisibleScratches ? `
        <!-- Cladding Micro-Scratch Markers -->
        <line x1="170" y1="68" x2="190" y2="72" stroke="#ef4444" stroke-width="2.5"/>
        <line x1="210" y1="108" x2="230" y2="112" stroke="#ef4444" stroke-width="2.5"/>
        <text x="200" y="60" fill="#ef4444" font-size="10" font-weight="800" text-anchor="middle">⚠️ CLADDING GOUGE (${fracture.flawDepthNm}nm)</text>
      ` : ''}
    </g>

    <!-- Right: Telcordia GR-20 Force Scale & Fracture Analysis -->
    <g transform="translate(420, 75)">
      <text x="0" y="15" fill="#94a3b8" font-size="11" font-weight="700">TELCORDIA GR-20 PEAK STRIPPING FORCE</text>

      <!-- Force Gauge Bar (0 to 14 N) -->
      <rect x="0" y="35" width="${barWidth}" height="24" rx="4" fill="#1e293b"/>
      <!-- Fail Low Zone (< 1.3N) -->
      <rect x="0" y="35" width="${minPos}" height="24" fill="#ef4444" opacity="0.4"/>
      <!-- Compliant Zone (1.3N - 8.9N) -->
      <rect x="${minPos}" y="35" width="${maxPos - minPos}" height="24" fill="#10b981" opacity="0.4"/>
      <!-- Fail High Zone (> 8.9N) -->
      <rect x="${maxPos}" y="35" width="${barWidth - maxPos}" height="24" fill="#ef4444" opacity="0.4"/>

      <!-- Limit Markers -->
      <line x1="${minPos}" y1="30" x2="${minPos}" y2="65" stroke="#f8fafc" stroke-width="1.5"/>
      <text x="${minPos}" y="76" fill="#94a3b8" font-size="9" text-anchor="middle">1.3N (Min)</text>

      <line x1="${maxPos}" y1="30" x2="${maxPos}" y2="65" stroke="#f8fafc" stroke-width="1.5"/>
      <text x="${maxPos}" y="76" fill="#94a3b8" font-size="9" text-anchor="middle">8.9N (Max)</text>

      <!-- Current Force Needle -->
      <line x1="${forcePos}" y1="25" x2="${forcePos}" y2="65" stroke="#f8fafc" stroke-width="3"/>
      <polygon points="${forcePos - 6},25  ${forcePos + 6},25  ${forcePos},33" fill="#f8fafc"/>
      <text x="${forcePos}" y="20" fill="${verdictColor}" font-size="12" font-weight="800" text-anchor="middle">${force.toFixed(2)} N</text>

      <!-- Cladding Surface Integrity / Griffith Strength Box -->
      <g transform="translate(0, 100)">
        <rect x="0" y="0" width="${barWidth}" height="80" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <text x="12" y="20" fill="#94a3b8" font-size="10" font-weight="700">GRIFFITH BREAKING STRENGTH RETENTION</text>
        <text x="12" y="44" fill="${fracture.severity === 'PRISTINE_NO_FLAWS' ? '#10b981' : (fracture.breakingStressMpa < 1000 ? '#ef4444' : '#f59e0b')}" font-size="18" font-weight="800">
          ${fracture.breakingStressGpa} GPa (${fracture.strengthRetentionPercent}%)
        </text>
        <text x="12" y="65" fill="#64748b" font-size="10">${fracture.severityLabel}</text>
      </g>
    </g>

    <!-- Bottom Readout Ribbon -->
    <rect x="0" y="${height - 50}" width="${width}" height="50" fill="#0b1120"/>
    <line x1="0" y1="${height - 50}" x2="${width}" y2="${height - 50}" stroke="#1e293b" stroke-width="1"/>

    <!-- Readout 1: Tool & Notch -->
    <text x="25" y="${height - 30}" fill="#94a3b8" font-size="10">STRIPPER TOOL &amp; APERTURE</text>
    <text x="25" y="${height - 14}" fill="#f8fafc" font-size="12" font-weight="700">${tool.brand} ${tool.model.split(' ')[0]} · V-Notch ${measuredNotchUm}µm (gap ${radialClearanceUm}µm)</text>

    <!-- Readout 2: Peak Stripping Force -->
    <text x="${width * 0.40}" y="${height - 30}" fill="#94a3b8" font-size="10">PEAK STRIPPING FORCE</text>
    <text x="${width * 0.40}" y="${height - 14}" fill="${verdictColor}" font-size="13" font-weight="800">${peakForceN} N (Telcordia 1.3 - 8.9N)</text>

    <!-- Readout 3: Residue Rating -->
    <text x="${width * 0.65}" y="${height - 30}" fill="#94a3b8" font-size="10">CLEANLINESS / RESIDUE</text>
    <text x="${width * 0.65}" y="${height - 14}" fill="${residueScore >= 4 ? '#10b981' : '#f59e0b'}" font-size="12" font-weight="700">Score ${residueScore}/5 (${cleanlinessLabel(residueScore)})</text>

    <!-- Readout 4: Breaking Stress -->
    <text x="${width - 150}" y="${height - 30}" fill="#94a3b8" font-size="10">PROOF STRENGTH</text>
    <text x="${width - 150}" y="${height - 14}" fill="${fracture.breakingStressMpa >= 3000 ? '#10b981' : '#ef4444'}" font-size="12" font-weight="700">${fracture.breakingStressGpa} GPa</text>
  </svg>
  `;
}

function cleanlinessLabel(score) {
  if (score >= 5) return 'Pristine Clean';
  if (score === 4) return 'Single Wipe Pass';
  if (score === 3) return 'Moderate Residue';
  return 'Gummy / Contaminated';
}

/**
 * Builds structured immutable Coating Stripping Force QA certification record.
 * @param {Object} options
 * @returns {Object}
 */
export function buildStripForceRecord({
  customer = null,
  toolId = 'MILLER_CFS3',
  coatingTypeId = 'DUAL_ACRYLATE_250',
  stripperSerialNumber = 'CFS3-22810',
  measuredNotchUm = 140.0,
  peakForceN = 3.2,
  stripLengthMm = 35.0,
  strippingSpeedMmS = 25.0,
  strippingTemperatureC = 22.0,
  residueScore = 5,
  hasVisibleScratches = false,
  estimatedFlawDepthNm = 0,
  location = 'Baradari Feeder FAT Closure #02',
  technicianName = 'Umair / Optical Field Crew',
  notes = '',
  id = null,
  createdAt = null
} = {}) {
  const evalResult = evaluateStripForceQa({
    toolId,
    coatingTypeId,
    stripperSerialNumber,
    measuredNotchUm,
    peakForceN,
    stripLengthMm,
    strippingSpeedMmS,
    strippingTemperatureC,
    residueScore,
    hasVisibleScratches,
    estimatedFlawDepthNm,
    location
  });

  const timestamp = createdAt || new Date().toISOString();
  const certId = id || generateStripForceCertId(timestamp);

  return {
    id: certId,
    customerId: customer ? (customer.id || customer.customerNumber) : null,
    customerName: customer?.name || 'Shahdara Network Subscriber / Distribution Run',
    customerPhone: customer?.phone || 'Not recorded',
    customerArea: [customer?.mohalla, customer?.zone].filter(Boolean).join(', ') || 'Shahdara Area',
    evaluation: evalResult,
    technicianName: String(technicianName || 'Shahdara Fiber Lineman').trim(),
    notes: String(notes || '').trim(),
    createdAt: timestamp,
    status: evalResult.verdict.isCompliant ? 'ACTIVE_CERTIFIED' : 'ACTION_REQUIRED'
  };
}

export function generateStripForceCertId(isoString = new Date().toISOString()) {
  const date = new Date(isoString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `STR-${y}${m}-${rand}`;
}

/**
 * Generates dual printable HTML certificates:
 * 1. Formal A4 Outside Plant Splicing & Metrology Accreditation Certificate.
 * 2. 80mm POS field technician thermal receipt slip.
 * @param {Object} record - Output of buildStripForceRecord
 * @param {Object} [options]
 * @returns {string}
 */
export function generateStripForceCertHtml(record, { format = 'standard' } = {}) {
  if (!record || !record.evaluation) {
    return `<div class="empty-state">No Strip Force QA certification data available.</div>`;
  }

  const { evaluation } = record;
  const { tool, coating, peakForceN, measuredNotchUm, radialClearanceUm, residueScore, hasVisibleScratches, fracture, verdict } = evaluation;

  if (format === 'thermal') {
    return `
    <article class="thermal-receipt strip-force-thermal-slip" aria-label="80mm Thermal Strip Force QA Slip">
      <header class="thermal-header">
        <h2 class="thermal-company">Shahdara ISP Network</h2>
        <p class="thermal-tagline">فائبر کوٹنگ اسٹرپنگ فورس و کوالٹی رپورٹ</p>
        <div class="thermal-rule">================================</div>
        <p class="thermal-title"><strong>FIBER STRIP FORCE QA SLIP</strong></p>
        <p class="thermal-date">Cert ID: ${escapeHtml(record.id)}</p>
        <p class="thermal-date">Date: ${escapeHtml(record.createdAt.slice(0, 10))}</p>
        <div class="thermal-rule">--------------------------------</div>
      </header>

      <section class="thermal-customer-meta">
        <div class="thermal-row"><span>Tool:</span><strong>${escapeHtml(tool.brand)} ${escapeHtml(tool.model.split(' ')[0])}</strong></div>
        <div class="thermal-row"><span>Serial:</span><span>${escapeHtml(record.evaluation.stripperSerialNumber)}</span></div>
        <div class="thermal-row"><span>Location:</span><span>${escapeHtml(record.evaluation.location)}</span></div>
        <div class="thermal-row"><span>Coating:</span><span>${escapeHtml(coating.id)}</span></div>
        <div class="thermal-row"><span>Technician:</span><span>${escapeHtml(record.technicianName)}</span></div>
      </section>

      <div class="thermal-rule">--------------------------------</div>

      <section class="thermal-breakdown">
        <div class="thermal-row thermal-total-row">
          <span>PEAK STRIP FORCE:</span>
          <strong>${peakForceN} N</strong>
        </div>
        <div class="thermal-row"><span>Telcordia Limits:</span><span>1.3 N - 8.9 N</span></div>
        <div class="thermal-row"><span>V-Notch Gap:</span><strong>${measuredNotchUm} µm (Δ ${radialClearanceUm}µm)</strong></div>
        <div class="thermal-row"><span>Cleanliness Score:</span><strong>${residueScore} / 5 (${cleanlinessLabel(residueScore)})</strong></div>
        <div class="thermal-row"><span>Cladding Scratches:</span><strong>${hasVisibleScratches ? 'YES (GOUGE FAIL)' : 'NONE (PRISTINE)'}</strong></div>
        <div class="thermal-row"><span>Tensile Strength:</span><strong>${fracture.breakingStressGpa} GPa</strong></div>
        <div class="thermal-rule">--------------------------------</div>
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
        <p class="thermal-urgent">${verdict.isCompliant ? '✓ Certified for OSP field jointing.' : '⚠️ Stripping rejected. Re-cut and adjust stripper.'}</p>
        <div class="thermal-sig-block">
          <div class="thermal-sig-line"></div>
          <span>Certified Fiber Specialist Signature</span>
        </div>
        <p class="thermal-closing">Shahdara Outside Plant Engineering QA</p>
      </footer>
    </article>
    `;
  }

  // Standard A4 Executive Metrology Certificate
  return `
  <article class="bill-invoice-sheet strip-force-qa-sheet" aria-label="Formal A4 Coating Strip Force Certificate">
    <header class="invoice-header">
      <div class="invoice-brand-block">
        <div class="invoice-brand-badge" aria-hidden="true" style="background: #d97706;">✂️</div>
        <div>
          <h1 class="invoice-title">Shahdara ISP Network Operations</h1>
          <p class="invoice-subtitle">Optical Fiber Primary/Secondary Acrylate Coating Mechanical Stripping Force &amp; Cladding Integrity QA Certificate</p>
          <p class="invoice-urdu-tag">شاہدرہ آپٹیکل فائبر کوٹنگ اسٹرپنگ فورس و گلاس کوالٹی سرٹیفکیٹ</p>
        </div>
      </div>
      <div class="invoice-meta-block">
        <div class="invoice-badge ${verdict.badgeClass}" style="background: ${verdict.colorHex}22; color: ${verdict.colorHex}; border: 1px solid ${verdict.colorHex}; font-size: 11px;">
          ${escapeHtml(verdict.label)}
        </div>
        <p class="invoice-number"><strong>Certificate #:</strong> ${escapeHtml(record.id)}</p>
        <p class="invoice-date"><strong>Inspection Date:</strong> ${escapeHtml(record.createdAt.slice(0, 10))}</p>
        <p class="invoice-due-date"><strong>Standard:</strong> IEC 60793-1-32 / Telcordia GR-20</p>
      </div>
    </header>

    <div class="invoice-parties-grid" style="margin: 20px 0;">
      <div class="invoice-party-box">
        <p class="party-label">STRIPPER TOOL &amp; APERTURE METROLOGY</p>
        <h2 class="party-name">${escapeHtml(tool.brand)} ${escapeHtml(tool.model)}</h2>
        <p class="party-line"><strong>Tool Serial Number:</strong> ${escapeHtml(record.evaluation.stripperSerialNumber)}</p>
        <p class="party-line"><strong>Operating Type:</strong> ${escapeHtml(tool.type)}</p>
        <p class="party-line"><strong>V-Notch Blade Gap:</strong> ${measuredNotchUm} µm (Target: 140µm)</p>
        <p class="party-line"><strong>Inspection Location:</strong> ${escapeHtml(record.evaluation.location)}</p>
      </div>

      <div class="invoice-party-box service-box">
        <p class="party-label">OPTICAL FIBER &amp; COATING SPECIFICATION</p>
        <h2 class="party-name">${escapeHtml(record.customerName)}</h2>
        <p class="party-line"><strong>Coating Classification:</strong> ${escapeHtml(coating.label)}</p>
        <p class="party-line"><strong>Dimensions:</strong> ${coating.nominalCoatingDiameterUm}µm Jacket to 125µm Glass</p>
        <p class="party-line"><strong>Lead Technician / Splicer:</strong> ${escapeHtml(record.technicianName)}</p>
        <p class="party-line"><strong>Area / Sector:</strong> ${escapeHtml(record.customerArea)}</p>
      </div>
    </div>

    <!-- Stripping Force & Tool V-Notch SVG Diagram -->
    <div style="margin: 18px 0; text-align: center;">
      ${renderStripForceAnalysisSvg(evaluation, { width: 700, height: 260 })}
    </div>

    <table class="invoice-table" aria-label="Stripping QA Telemetry Parameters">
      <thead>
        <tr>
          <th scope="col">Inspection Parameter &amp; Quality Vector</th>
          <th scope="col">Measurement Value</th>
          <th scope="col">Telcordia GR-20 Standard Limits</th>
          <th scope="col" class="text-right">Evaluation Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Peak Stripping Force (F_peak)</strong>
            <div class="invoice-item-sub">Mechanical axial pull resistance during acrylate severance</div>
          </td>
          <td><strong>${peakForceN} N</strong></td>
          <td>1.3 N to 8.9 N (0.3 - 2.0 lbf)</td>
          <td class="text-right"><span style="color: ${verdict.colorHex}; font-weight: 700;">${verdict.isCompliant ? 'PASS' : 'FAIL'}</span></td>
        </tr>
        <tr>
          <td>
            <strong>V-Notch Blade Aperture &amp; Radial Clearance</strong>
            <div class="invoice-item-sub">Microscopic blade gap preventing direct steel-to-silica impact</div>
          </td>
          <td>${measuredNotchUm} µm (Clearance: +${radialClearanceUm} µm)</td>
          <td>135 µm to 145 µm (≥ 130 µm critical min)</td>
          <td class="text-right"><span style="color: ${evaluation.notchStatus === 'OPTIMAL_CLEARANCE' ? '#10b981' : '#ef4444'}; font-weight: 700;">${evaluation.notchStatus}</span></td>
        </tr>
        <tr>
          <td>
            <strong>Bare Cladding Surface Micro-Scratch Check</strong>
            <div class="invoice-item-sub">Visual &amp; interferometric check for longitudinal gouges or blade scrapes</div>
          </td>
          <td>${hasVisibleScratches ? `Scratched (${fracture.flawDepthNm} nm depth)` : '0 Flaws (Pristine Mirror Surface)'}</td>
          <td>0 Micro-Scratches allowed (Griffith safe)</td>
          <td class="text-right"><span style="color: ${hasVisibleScratches ? '#ef4444' : '#10b981'}; font-weight: 700;">${hasVisibleScratches ? 'FAIL' : 'PASS'}</span></td>
        </tr>
        <tr>
          <td>
            <strong>Bare Silica Cladding Breaking Strength (Griffith Mechanics)</strong>
            <div class="invoice-item-sub">Tensile breaking limit retention after blade stripping pass</div>
          </td>
          <td><strong>${fracture.breakingStressGpa} GPa</strong> (${fracture.strengthRetentionPercent}% retention)</td>
          <td>≥ 3.0 GPa (proof stress threshold)</td>
          <td class="text-right"><span style="color: ${fracture.breakingStressMpa >= 3000 ? '#10b981' : '#ef4444'}; font-weight: 700;">${fracture.severity}</span></td>
        </tr>
        <tr>
          <td>
            <strong>Bare Fiber Cleanliness &amp; Acrylate Residue</strong>
            <div class="invoice-item-sub">Surface contamination rating prior to 99.8% IPA wipe</div>
          </td>
          <td>Score ${residueScore} / 5 (${cleanlinessLabel(residueScore)})</td>
          <td>Score ≥ 3 (must clear with single IPA wipe)</td>
          <td class="text-right"><span style="color: #10b981; font-weight: 700;">CLEAN</span></td>
        </tr>
      </tbody>
    </table>

    <div class="invoice-summary-section" style="margin-top: 18px;">
      <div class="invoice-payment-guidance">
        <h3>Standard Splicing Preparation Rules</h3>
        <ul>
          <li><strong>Blade Alignment:</strong> Never use strippers with damaged or notched pivot pins. Verify 140µm aperture weekly.</li>
          <li><strong>Cleaning Solvents:</strong> Always use 99.8% pure electronic grade Isopropyl Alcohol (IPA) with lint-free wipes.</li>
          <li><strong>Fiber Handling:</strong> Do not touch stripped silica cladding with bare fingers; skin oils cause fusion arc contamination.</li>
        </ul>
      </div>

      <div class="invoice-totals-box">
        <div class="totals-row">
          <span>Peak Mechanical Force:</span>
          <strong>${peakForceN} N (Telcordia compliant)</strong>
        </div>
        <div class="totals-row">
          <span>Blade Notch Aperture:</span>
          <span>${measuredNotchUm} µm</span>
        </div>
        <div class="totals-row">
          <span>Breaking Strength:</span>
          <span>${fracture.breakingStressGpa} GPa</span>
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
        <strong>Field Observations &amp; Notes:</strong> ${escapeHtml(record.notes)}
      </div>
    ` : ''}

    <footer class="invoice-footer">
      <p class="notice">This certificate confirms compliance under IEC 60793-1-32 and Telcordia GR-20-CORE Issue 4 standards for optical fiber coating strippability and mechanical glass integrity across Shahdara OSP.</p>
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
export function formatStripForceCertWhatsApp(record) {
  if (!record || !record.evaluation) return '';
  const { evaluation } = record;
  const { tool, coating, peakForceN, measuredNotchUm, residueScore, hasVisibleScratches, fracture, verdict } = evaluation;

  return [
    `*SHAHDARA ISP · FIBER STRIP FORCE QA CERTIFICATE*`,
    `آپٹیکل فائبر کوٹنگ اسٹرپنگ فورس و کوالٹی رپورٹ`,
    `----------------------------------------`,
    `📄 *سرٹیفکیٹ نمبر:* ${record.id}`,
    `📅 *تاریخ:* ${record.createdAt.slice(0, 10)}`,
    `📍 *مقام:* ${record.evaluation.location}`,
    `🔧 *اسٹرپر ٹول:* ${tool.brand} ${tool.model}`,
    `🔢 *سریل نمبر:* ${record.evaluation.stripperSerialNumber}`,
    `👨‍🔧 *ٹیکنیشن:* ${record.technicianName}`,
    `----------------------------------------`,
    `*اسٹرپنگ ٹیسٹ و پیمائش (Telemetry):*`,
    `• پیک اسٹرپ فورس (Peak Force): *${peakForceN} N* (حد: 1.3 - 8.9 N)`,
    `• بلیڈ وی-نوچ گیپ (V-Notch Gap): ${measuredNotchUm} µm`,
    `• گلاس پر کٹ/اسکریچ: *${hasVisibleScratches ? '⚠️ اسکریچ موجود (ناقص)' : '✅ بالکل صاف (کوئی اسکریچ نہیں)'}*`,
    `• کوٹنگ صفائی (Cleanliness): ${residueScore} / 5 (${cleanlinessLabel(residueScore)})`,
    `• گلاس ٹینسائل مضبوطی: ${fracture.breakingStressGpa} GPa (${fracture.strengthRetentionPercent}% برقراری)`,
    `----------------------------------------`,
    `*حتمی نتیجہ (QA Verdict):*`,
    `${verdict.isCompliant ? '✅' : '❌'} *${verdict.label}*`,
    verdict.isCompliant
      ? `فائبر اسٹرپنگ بالکل معیاری ہے۔ آئی پی اے سے صاف کر کے فیوژن ویلڈ کیلئے تیار ہے۔`
      : `⚠️ اسٹرپنگ مسترد۔ بلیڈ گیپ چیک کریں یا نیا اسٹرپر استعمال کریں۔`,
    `----------------------------------------`,
    `شاہدرہ انٹرنیٹ سروسز · آپٹیکل نیٹ ورک آپریشنز`
  ].join('\n');
}

/**
 * Generates RFC-4180 CSV export of coating strip force certificates with UTF-8 BOM.
 * @param {Array<Object>} records
 * @returns {string}
 */
export function generateStripForceCertsCsv(records = []) {
  const headers = [
    'Certificate_ID',
    'Created_At',
    'Customer_Name',
    'Customer_Area',
    'Location',
    'Tool_Brand',
    'Tool_Model',
    'Tool_Serial_Number',
    'Coating_Type',
    'Peak_Force_N',
    'Measured_Notch_Um',
    'Radial_Clearance_Um',
    'Notch_Status',
    'Strip_Length_Mm',
    'Stripping_Speed_MmS',
    'Temperature_C',
    'Residue_Score',
    'Has_Visible_Scratches',
    'Flaw_Depth_Nm',
    'Breaking_Stress_Gpa',
    'Strength_Retention_Percent',
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
    const tl = ev.tool || {};
    const ct = ev.coating || {};
    const fr = ev.fracture || {};
    const vd = ev.verdict || {};

    return [
      escapeCsv(r.id),
      escapeCsv(r.createdAt),
      escapeCsv(r.customerName),
      escapeCsv(r.customerArea),
      escapeCsv(ev.location),
      escapeCsv(tl.brand),
      escapeCsv(tl.model),
      escapeCsv(ev.stripperSerialNumber),
      escapeCsv(ct.id),
      escapeCsv(ev.peakForceN),
      escapeCsv(ev.measuredNotchUm),
      escapeCsv(ev.radialClearanceUm),
      escapeCsv(ev.notchStatus),
      escapeCsv(ev.stripLengthMm),
      escapeCsv(ev.strippingSpeedMmS),
      escapeCsv(ev.strippingTemperatureC),
      escapeCsv(ev.residueScore),
      escapeCsv(ev.hasVisibleScratches ? 'YES' : 'NO'),
      escapeCsv(fr.flawDepthNm),
      escapeCsv(fr.breakingStressGpa),
      escapeCsv(fr.strengthRetentionPercent),
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
export function getSavedStripForceCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STRIP_FORCE_QA_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveStripForceCert(record, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !record || !record.id) return false;
  try {
    const list = getSavedStripForceCerts(storage);
    const existingIndex = list.findIndex(r => r.id === record.id);
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.unshift(record);
      if (list.length > 150) list.length = 150;
    }
    storage.setItem(STRIP_FORCE_QA_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function updateStripForceCertStatus(certId, newStatus, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !certId) return false;
  try {
    const list = getSavedStripForceCerts(storage);
    const item = list.find(r => r.id === certId);
    if (!item) return false;
    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
    storage.setItem(STRIP_FORCE_QA_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function clearStripForceCerts(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.removeItem(STRIP_FORCE_QA_STORAGE_KEY);
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
export function calculateStripForceMetrics(records = []) {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      totalInspections: 0,
      gradeACount: 0,
      commercialPassCount: 0,
      conditionalPassCount: 0,
      rejectedCount: 0,
      compliantCount: 0,
      complianceRatePercent: 0,
      averageForceN: 0,
      scratchedCount: 0
    };
  }

  let gradeACount = 0;
  let commercialPassCount = 0;
  let conditionalPassCount = 0;
  let rejectedCount = 0;
  let compliantCount = 0;
  let totalForce = 0;
  let scratchedCount = 0;

  records.forEach(r => {
    const ev = r.evaluation || {};
    const force = Number(ev.peakForceN ?? 0);
    totalForce += force;

    if (ev.hasVisibleScratches) {
      scratchedCount++;
    }

    if (ev.verdict?.isCompliant) {
      compliantCount++;
    }

    if (ev.verdict?.id === 'GRADE_A_PRISTINE') {
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
    averageForceN: Math.round((totalForce / total) * 100) / 100,
    scratchedCount
  };
}

/**
 * Interactive Modal Controller setup for index.html UI
 * @param {Object} options
 * @returns {Object} Controller with recalculate, populateCustomer, and open methods
 */
export function setupStripForceQaModal({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onToast = (msg) => console.log(msg)
} = {}) {
  const modal = typeof document !== 'undefined' ? document.getElementById('stripForceQaModal') : null;
  if (!modal) return null;

  const closeBtn = document.getElementById('closeStripForceQaBtn');
  const presetSelect = document.getElementById('stripForcePresetSelect');
  const toolSelect = document.getElementById('stripForceToolSelect');
  const coatingSelect = document.getElementById('stripForceCoatingSelect');
  const serialInput = document.getElementById('stripForceSerialInput');
  const locationInput = document.getElementById('stripForceLocationInput');
  const technicianInput = document.getElementById('stripForceTechnicianInput');
  const forceInput = document.getElementById('stripForcePeakForceInput');
  const notchInput = document.getElementById('stripForceNotchInput');
  const lengthInput = document.getElementById('stripForceLengthInput');
  const residueSelect = document.getElementById('stripForceResidueSelect');
  const scratchSelect = document.getElementById('stripForceScratchSelect');
  const flawDepthInput = document.getElementById('stripForceFlawDepthInput');
  const notesInput = document.getElementById('stripForceNotesInput');

  const svgContainer = document.getElementById('stripForceSvgContainer');
  const hudRibbon = document.getElementById('stripForceHudRibbon');
  const historyTbody = document.getElementById('stripForceHistoryTbody');
  const searchInput = document.getElementById('stripForceSearchInput');
  const statusFilterSelect = document.getElementById('stripForceStatusFilterSelect');

  const saveBtn = document.getElementById('saveStripForceCertBtn');
  const printStandardBtn = document.getElementById('printStripForceStandardBtn');
  const printThermalBtn = document.getElementById('printStripForceThermalBtn');
  const exportCsvBtn = document.getElementById('exportStripForceCsvBtn');
  const whatsAppBtn = document.getElementById('whatsAppStripForceBtn');

  let activeCustomer = null;
  let currentEvaluation = null;

  function getFormValues() {
    return {
      toolId: toolSelect?.value || 'MILLER_CFS3',
      coatingTypeId: coatingSelect?.value || 'DUAL_ACRYLATE_250',
      stripperSerialNumber: serialInput?.value || 'CFS3-22810',
      measuredNotchUm: Number(notchInput?.value) || 140.0,
      peakForceN: Number(forceInput?.value) || 3.2,
      stripLengthMm: Number(lengthInput?.value) || 35.0,
      residueScore: Number(residueSelect?.value) || 5,
      hasVisibleScratches: scratchSelect?.value === 'YES',
      estimatedFlawDepthNm: Number(flawDepthInput?.value) || 0,
      location: locationInput?.value || 'Baradari Feeder FAT Closure #02'
    };
  }

  function recalculate() {
    const values = getFormValues();
    currentEvaluation = evaluateStripForceQa(values);

    if (svgContainer) {
      svgContainer.innerHTML = renderStripForceAnalysisSvg(currentEvaluation, { width: 700, height: 260 });
    }

    if (hudRibbon) {
      const { peakForceN, measuredNotchUm, residueScore, fracture, verdict } = currentEvaluation;
      hudRibbon.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 11px; color: #94a3b8;">Peak Stripping Force</div>
          <div style="font-size: 18px; font-weight: 800; color: ${verdict.colorHex};">
            ${peakForceN} N
          </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 11px; color: #94a3b8;">Blade Notch Gap</div>
          <div style="font-size: 18px; font-weight: 800; color: ${measuredNotchUm >= 135 && measuredNotchUm <= 145 ? '#10b981' : '#f59e0b'};">
            ${measuredNotchUm} µm
          </div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.7); padding: 8px 12px; border-radius: 6px; border: 1px solid #334155;">
          <div style="font-size: 11px; color: #94a3b8;">Tensile Strength Retained</div>
          <div style="font-size: 18px; font-weight: 800; color: ${fracture.breakingStressMpa >= 3000 ? '#10b981' : '#ef4444'};">
            ${fracture.breakingStressGpa} GPa (${fracture.strengthRetentionPercent}%)
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
    const preset = STRIP_FORCE_PRESETS[presetKey];
    if (!preset) return;

    if (toolSelect) toolSelect.value = preset.toolId;
    if (coatingSelect) coatingSelect.value = preset.coatingTypeId;
    if (serialInput) serialInput.value = preset.stripperSerialNumber;
    if (notchInput) notchInput.value = preset.measuredNotchUm;
    if (forceInput) forceInput.value = preset.peakForceN;
    if (lengthInput) lengthInput.value = preset.stripLengthMm;
    if (residueSelect) residueSelect.value = String(preset.residueScore);
    if (scratchSelect) scratchSelect.value = preset.hasVisibleScratches ? 'YES' : 'NO';
    if (flawDepthInput) flawDepthInput.value = preset.estimatedFlawDepthNm;
    if (locationInput) locationInput.value = preset.location;

    recalculate();
  }

  function renderHistory() {
    if (!historyTbody) return;
    const records = getSavedStripForceCerts(storage);
    const query = (searchInput?.value || '').toLowerCase();
    const filter = statusFilterSelect?.value || '';

    const filtered = records.filter(r => {
      const matchQuery = !query ||
        r.id.toLowerCase().includes(query) ||
        r.customerName.toLowerCase().includes(query) ||
        r.technicianName.toLowerCase().includes(query) ||
        (r.evaluation?.location || '').toLowerCase().includes(query);

      const matchFilter = !filter ||
        (filter === 'COMPLIANT' && r.evaluation?.verdict?.isCompliant) ||
        (filter === 'NON_COMPLIANT' && !r.evaluation?.verdict?.isCompliant);

      return matchQuery && matchFilter;
    });

    if (filtered.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 16px;">No coating strip force certifications recorded.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = filtered.map(r => {
      const ev = r.evaluation || {};
      const force = ev.peakForceN ? `${ev.peakForceN} N` : '—';
      const vd = ev.verdict || {};
      return `
        <tr>
          <td><strong>${escapeHtml(r.id)}</strong><br><small style="color: #64748b;">${escapeHtml(r.createdAt.slice(0, 10))}</small></td>
          <td>${escapeHtml(ev.tool?.brand || '')} ${escapeHtml(ev.tool?.model?.split(' ')[0] || '')}<br><small style="color: #64748b;">${escapeHtml(ev.stripperSerialNumber || '')}</small></td>
          <td>${escapeHtml(ev.location || '')}</td>
          <td><strong>${force}</strong></td>
          <td>${ev.measuredNotchUm || 0} µm</td>
          <td><span class="badge ${vd.badgeClass || ''}" style="color: ${vd.colorHex}; font-weight: 700;">${escapeHtml(vd.label?.split('(')[0] || '')}</span></td>
          <td>
            <button type="button" class="secondary-button" style="padding: 4px 8px; font-size: 11px;" data-print-strip="${escapeHtml(r.id)}">🖨️</button>
            <button type="button" class="secondary-button" style="padding: 4px 8px; font-size: 11px;" data-wa-strip="${escapeHtml(r.id)}">💬</button>
          </td>
        </tr>
      `;
    }).join('');

    // Wire actions
    historyTbody.querySelectorAll('[data-print-strip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-print-strip');
        const found = records.find(r => r.id === id);
        if (found) {
          const html = generateStripForceCertHtml(found, { format: 'standard' });
          openPrintWindow(html);
        }
      });
    });

    historyTbody.querySelectorAll('[data-wa-strip]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-wa-strip');
        const found = records.find(r => r.id === id);
        if (found) {
          const text = formatStripForceCertWhatsApp(found);
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
      win.document.write(`<!DOCTYPE html><html><head><title>Print Strip Force Certificate</title><style>@media print { body { margin: 0; padding: 0; } } body { font-family: sans-serif; background: #fff; padding: 20px; }</style></head><body>${html}<script>window.onload=()=>{window.print();}</script></body></html>`);
      win.document.close();
    }
  }

  // Event Listeners
  [toolSelect, coatingSelect, serialInput, locationInput, forceInput, notchInput, lengthInput, residueSelect, scratchSelect, flawDepthInput].forEach(el => {
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
    const record = buildStripForceRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      notes: notesInput?.value
    });
    saveStripForceCert(record, storage);
    onToast(`Strip Force QA Certificate ${record.id} saved successfully!`);
    renderHistory();
  });

  printStandardBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildStripForceRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      notes: notesInput?.value
    });
    const html = generateStripForceCertHtml(record, { format: 'standard' });
    openPrintWindow(html);
  });

  printThermalBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildStripForceRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      notes: notesInput?.value
    });
    const html = generateStripForceCertHtml(record, { format: 'thermal' });
    openPrintWindow(html);
  });

  exportCsvBtn?.addEventListener('click', () => {
    const records = getSavedStripForceCerts(storage);
    if (!records.length) {
      onToast('No saved records to export.');
      return;
    }
    const csv = generateStripForceCertsCsv(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara_strip_force_qa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported CSV successfully!');
  });

  whatsAppBtn?.addEventListener('click', () => {
    const values = getFormValues();
    const record = buildStripForceRecord({
      customer: activeCustomer,
      ...values,
      technicianName: technicianInput?.value,
      notes: notesInput?.value
    });
    const text = formatStripForceCertWhatsApp(record);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      onToast('WhatsApp dispatch notice copied to clipboard!');
    }
  });

  searchInput?.addEventListener('input', renderHistory);
  statusFilterSelect?.addEventListener('change', renderHistory);

  recalculate();
  renderHistory();

  return {
    recalculate,
    populateCustomer: (c) => {
      activeCustomer = c;
      if (locationInput && c) {
        locationInput.value = `${c.name || 'Subscriber'} Premises Cable Drop (${c.mohalla || c.zone || 'Shahdara'})`;
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
