/**
 * Shahdara ISP Billing & Network Operations - Optical Fiber Cleave Angle, End-Face Mirror Quality,
 * Surface Roughness & Cleaver Blade Wear QA Certification Suite
 * Standards: ITU-T G.650.1, Telcordia GR-765-CORE, IEC 61073-1, IEC 60793-1-30, TIA/EIA-455-131
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const FIBER_CLEAVE_QUALITY_STORAGE_KEY = 'shahdara_fiber_cleave_quality_certs_v1';

export const CLEAVER_MODELS = {
  'FUJIKURA_CT50': {
    id: 'FUJIKURA_CT50',
    name: 'Fujikura CT50 Automated Bluetooth Cleaver',
    brand: 'Fujikura (Japan)',
    category: 'High-Precision Automated Rotary',
    bladeChannels: 16,
    cleavesPerChannel: 3750,
    totalBladeLife: 60000,
    targetAngleDeg: 0.35,
    maxPermissibleAngleDeg: 0.75,
    oilDamper: true,
    autoRotation: true,
    description: 'Motorized automatic blade rotation, dual fiber clamp, oil damper shock absorption for ultra-low fusion loss.'
  },
  'SUMITOMO_FC6S': {
    id: 'SUMITOMO_FC6S',
    name: 'Sumitomo FC-6S Precision Benchtop Cleaver',
    brand: 'Sumitomo Electric (Japan)',
    category: 'Manual Slide Carriage Precision Cleaver',
    bladeChannels: 16,
    cleavesPerChannel: 2250,
    totalBladeLife: 36000,
    targetAngleDeg: 0.50,
    maxPermissibleAngleDeg: 1.00,
    oilDamper: false,
    autoRotation: false,
    description: 'Industry workhorse manual 2-step sliding anvil carriage with tungsten carbide circular blade.'
  },
  'INNO_V7': {
    id: 'INNO_V7',
    name: 'INNO Instrument V7 Universal High-Precision Cleaver',
    brand: 'INNO Instrument',
    category: 'Field Universal Fiber Holder Cleaver',
    bladeChannels: 16,
    cleavesPerChannel: 3000,
    totalBladeLife: 48000,
    targetAngleDeg: 0.45,
    maxPermissibleAngleDeg: 0.90,
    oilDamper: true,
    autoRotation: false,
    description: 'Universal clamp accommodating 250µm bare fiber, 900µm tight buffer, and 3.0mm drop cable.'
  },
  'ILSINTECH_CI01': {
    id: 'ILSINTECH_CI01',
    name: 'Ilsintech / UCL Swift CI-01 Single-Action Cleaver',
    brand: 'Ilsintech (Korea)',
    category: 'Single-Action Auto-Return Cleaver',
    bladeChannels: 16,
    cleavesPerChannel: 2500,
    totalBladeLife: 40000,
    targetAngleDeg: 0.50,
    maxPermissibleAngleDeg: 1.00,
    oilDamper: false,
    autoRotation: false,
    description: 'Single-action lever press with automatic fiber off-cut collector and spring-loaded anvil return.'
  },
  'MANUAL_FIELD_PUCK': {
    id: 'MANUAL_FIELD_PUCK',
    name: 'Manual Sapphire Pen & Handheld Scribe Puck',
    brand: 'Generic / Local OSP',
    category: 'Manual Emergency Drop Field Scribe',
    bladeChannels: 1,
    cleavesPerChannel: 500,
    totalBladeLife: 500,
    targetAngleDeg: 1.20,
    maxPermissibleAngleDeg: 2.00,
    oilDamper: false,
    autoRotation: false,
    description: 'Handheld manual sapphire wedge scribe used for quick mechanical fast-connector drop terminations.'
  }
};

export const SURFACE_DEFECT_TYPES = {
  'NONE_PRISTINE': {
    id: 'NONE_PRISTINE',
    name: 'Pristine Mirror Zone (No Defect)',
    zone: 'Full 125µm Mirror Plane',
    lossPenaltyDb: 0.00,
    orlPenaltyDb: 0.0,
    verdictImpact: 'PASSED',
    description: 'Uniform planar mirror fracture across both 9µm core and 125µm cladding. Roughness < 0.03 µm RMS.'
  },
  'MIST_PERIPHERY': {
    id: 'MIST_PERIPHERY',
    name: 'Peripheral Mist Zone (Cladding Only)',
    zone: 'Outer Cladding (r > 40µm)',
    lossPenaltyDb: 0.02,
    orlPenaltyDb: -1.5,
    verdictImpact: 'PASSED',
    description: 'Fine microscopic granular striae localized near outer cladding edge; core region remains 100% mirror.'
  },
  'MIST_CORE_TOUCH': {
    id: 'MIST_CORE_TOUCH',
    name: 'Moderate Mist Bordering Core',
    zone: 'Mid-Cladding Near Core (r ≈ 15µm)',
    lossPenaltyDb: 0.06,
    orlPenaltyDb: -3.5,
    verdictImpact: 'CONDITIONAL',
    description: 'Granular surface roughness approaching mode field boundary; slight light scatter during core alignment.'
  },
  'HACKLE_RADIAL': {
    id: 'HACKLE_RADIAL',
    name: 'Radial Hackle Fractures (Step Cleavage)',
    zone: 'Cladding & Core Cross-Section',
    lossPenaltyDb: 0.22,
    orlPenaltyDb: -8.0,
    verdictImpact: 'REJECT',
    description: 'Severe multi-planar stepped glass cleavage caused by blade vibration or excessive anvil pressure.'
  },
  'LIP_SMALL': {
    id: 'LIP_SMALL',
    name: 'Small Glass Lip / Spur (< 2.0 µm)',
    zone: 'Tensile Exit Boundary',
    lossPenaltyDb: 0.05,
    orlPenaltyDb: -2.0,
    verdictImpact: 'CONDITIONAL',
    description: 'Minor glass overhang lip at fracture exit edge; may burn off under heavy splicer cleaning arc.'
  },
  'LIP_LARGE': {
    id: 'LIP_LARGE',
    name: 'Prominent Glass Lip / Overhang (≥ 2.0 µm)',
    zone: 'Tensile Exit Boundary',
    lossPenaltyDb: 0.28,
    orlPenaltyDb: -10.0,
    verdictImpact: 'REJECT',
    description: 'Protruding glass lip exceeding 2.0µm. Prevents longitudinal end-face abutment and creates huge arc bubbles.'
  },
  'CHIP_ROLLOFF': {
    id: 'CHIP_ROLLOFF',
    name: 'Roll-Off Chip / Corner Glass Spallation',
    zone: 'Cladding Edge Defect',
    lossPenaltyDb: 0.18,
    orlPenaltyDb: -7.5,
    verdictImpact: 'REJECT',
    description: 'Missing glass edge chip caused by dull blade scoring or dirty clamping pads. Re-cleave required.'
  }
};

export const BLADE_HEIGHT_SETTINGS = {
  'OPTIMAL': {
    id: 'OPTIMAL',
    name: 'Optimal Anvil Scoring Height (0.00 mm)',
    scoreDepthUm: 1.5,
    risk: 'Normal smooth mirror propagation',
    angleMultiplier: 1.0
  },
  'TOO_HIGH': {
    id: 'TOO_HIGH',
    name: 'Blade Too High (+0.08 mm Over-Penetration)',
    scoreDepthUm: 4.5,
    risk: 'Excessive score depth causing hackle and roll-off chip',
    angleMultiplier: 1.45
  },
  'TOO_LOW': {
    id: 'TOO_LOW',
    name: 'Blade Too Low (-0.08 mm Under-Penetration)',
    scoreDepthUm: 0.5,
    risk: 'Incomplete score resulting in high cleave angle and large tensile lip',
    angleMultiplier: 1.60
  }
};

export const CLEAVE_QA_VERDICTS = {
  'GRADE_A_EXCELLENT': {
    id: 'GRADE_A_EXCELLENT',
    code: 'GRADE_A',
    label: 'Grade A — Ultra-Low Loss Fusion Splice Certified',
    badgeClass: 'badge-pass-certified',
    statusClass: 'status-excellent',
    colorHex: '#10b981',
    isPassing: true,
    recommendationUrdu: 'شاندار کلیو — فیوژن سپلائسنگ کیلئے مکمل تصدیق شدہ',
    recommendation: 'Exceptional planar mirror end-face (Angle ≤ 0.5°). Immediate low-loss fusion splice approved.'
  },
  'GRADE_B_STANDARD': {
    id: 'GRADE_B_STANDARD',
    code: 'GRADE_B',
    label: 'Grade B — Standard Outside Plant Fusion Splice Pass',
    badgeClass: 'badge-pass-standard',
    statusClass: 'status-good',
    colorHex: '#3b82f6',
    isPassing: true,
    recommendationUrdu: 'معیاری کلیو — او ڈی ایف اور ڈسٹری بیوشن سپلائس کیلئے پاس',
    recommendation: 'Good cleave angle (0.5° to 1.0°) meeting ITU-T G.650.1. Suitable for feeder & distribution splices.'
  },
  'GRADE_C_CONDITIONAL': {
    id: 'GRADE_C_CONDITIONAL',
    code: 'GRADE_C',
    label: 'Grade C — Conditional Pass (Mechanical Fast Connector Only)',
    badgeClass: 'badge-pass-conditional',
    statusClass: 'status-warning',
    colorHex: '#f59e0b',
    isPassing: true,
    recommendationUrdu: 'مشروط کلیو — صرف فاسٹ کنیکٹر کیلئے قابلِ قبول، فیوژن کیلئے دوبارہ کاٹیں',
    recommendation: 'Marginal angle (1.0° to 1.5°) or slight mist. Acceptable for mechanical field pigtails; re-cleave advised for fusion.'
  },
  'GRADE_D_REJECT': {
    id: 'GRADE_D_REJECT',
    code: 'GRADE_D',
    label: 'Grade D — Cleave Rejected / Mandatory Re-Cleave',
    badgeClass: 'badge-fail-rework',
    statusClass: 'status-danger',
    colorHex: '#ef4444',
    isPassing: false,
    recommendationUrdu: 'مسترد شدہ کلیو — اینگل زیادہ یا شیشہ ٹوٹا ہوا، لازمی دوبارہ کاٹیں',
    recommendation: 'High angle (> 1.5°), hackle, or glass lip defect. Fiber will fail arc discharge or damage V-groove. Re-cleave immediately.'
  }
};

export const SHAH_CLEAVE_PRESETS = {
  'PRESET_BARADARI_CT50': {
    id: 'PRESET_BARADARI_CT50',
    name: 'Baradari ODF Feeder Core — Fujikura CT50 (Pristine 0.28°)',
    cleaverModel: 'FUJIKURA_CT50',
    cleaveAngleDeg: 0.28,
    defectType: 'NONE_PRISTINE',
    bladeHeight: 'OPTIMAL',
    bladeChannel: 4,
    cleavesOnChannel: 450,
    technician: 'Kamran Lead Splicer',
    location: 'Baradari Central Optical Distribution Frame (ODF-01)',
    notes: 'Fiber core 14/96 Baradari to Jia Musa trunk feeder. High-precision automated cleaver.'
  },
  'PRESET_VANDALA_FC6S': {
    id: 'PRESET_VANDALA_FC6S',
    name: 'Vandala Road Drop Fiber — Sumitomo FC-6S (Standard 0.65°)',
    cleaverModel: 'SUMITOMO_FC6S',
    cleaveAngleDeg: 0.65,
    defectType: 'MIST_PERIPHERY',
    bladeHeight: 'OPTIMAL',
    bladeChannel: 8,
    cleavesOnChannel: 1420,
    technician: 'Zahid OSP Technician',
    location: 'Vandala Road Drop Terminal FAT-06',
    notes: 'Standard subscriber drop cleave. Minor peripheral mist, core mirror clean.'
  },
  'PRESET_JIA_MUSA_V7': {
    id: 'PRESET_JIA_MUSA_V7',
    name: 'Jia Musa Ring Splicing Van — INNO V7 (Good 0.82°)',
    cleaverModel: 'INNO_V7',
    cleaveAngleDeg: 0.82,
    defectType: 'MIST_PERIPHERY',
    bladeHeight: 'OPTIMAL',
    bladeChannel: 12,
    cleavesOnChannel: 1850,
    technician: 'Umair Fiber Specialist',
    location: 'Jia Musa Ring Backbone Splice Closure FST-04',
    notes: 'Backbone 24-core ring repair. Blade approaching channel service limit.'
  },
  'PRESET_BEGUM_KOT_WORN': {
    id: 'PRESET_BEGUM_KOT_WORN',
    name: 'Begum Kot High-Tension Crossing — Worn Blade (1.42° + Small Lip)',
    cleaverModel: 'SUMITOMO_FC6S',
    cleaveAngleDeg: 1.42,
    defectType: 'LIP_SMALL',
    bladeHeight: 'TOO_LOW',
    bladeChannel: 16,
    cleavesOnChannel: 2450,
    technician: 'Rashid Maintenance Tech',
    location: 'Begum Kot Pole #14 Aerial Joint',
    notes: 'Blade channel 16 over-worn (2450 cleaves). Marginal cleave angle with 1.2µm lip.'
  },
  'PRESET_RAVI_SIPHON_REJECT': {
    id: 'PRESET_RAVI_SIPHON_REJECT',
    name: 'Ravi Siphon High-Span Repair — Dull Puck Reject (2.35° + Large Lip)',
    cleaverModel: 'MANUAL_FIELD_PUCK',
    cleaveAngleDeg: 2.35,
    defectType: 'LIP_LARGE',
    bladeHeight: 'TOO_HIGH',
    bladeChannel: 1,
    cleavesOnChannel: 480,
    technician: 'Emergency Night Team',
    location: 'Ravi Siphon River Crossing Manhole #02',
    notes: 'Severe cleave defect. Large lip (3.2µm) and angle > 2°. Mandatory re-cleave.'
  }
};

/**
 * Calculates theoretical angular tilt splice insertion loss based on Marcuse tilt equation
 * Loss_tilt = 4.343 * (pi^2 * n_cladding^2 * w_0^2 * theta_rad^2 / lambda^2)
 * For G.652.D SMF-28 at 1310nm: ~0.048 * theta_deg^2
 */
export function calculateCleaveAngleLoss(angleDeg, wavelengthNm = 1310) {
  const theta = Math.max(0, Number(angleDeg) || 0);
  const lambda = (Number(wavelengthNm) || 1310) * 1e-9;
  const nClad = 1.467;
  const w0 = 4.6e-6; // 9.2um MFD / 2
  const thetaRad = (theta * Math.PI) / 180;

  // Marcuse angular loss equation
  const numerator = Math.PI * Math.PI * nClad * nClad * w0 * w0 * thetaRad * thetaRad;
  const denominator = lambda * lambda;
  const rawLoss = 4.343 * (numerator / denominator);

  return Math.round(rawLoss * 1000) / 1000;
}

/**
 * Calculates blade wear percentage based on current channel count and model rating
 */
export function calculateBladeWearMetrics(cleaverModelId, channelNumber, cleavesOnChannel) {
  const model = CLEAVER_MODELS[cleaverModelId] || CLEAVER_MODELS['SUMITOMO_FC6S'];
  const channel = Math.max(1, Math.min(model.bladeChannels, Math.floor(Number(channelNumber) || 1)));
  const count = Math.max(0, Math.floor(Number(cleavesOnChannel) || 0));

  const channelRatedLife = model.cleavesPerChannel;
  const channelWearPct = Math.min(150, Math.round((count / channelRatedLife) * 100));

  const totalEstimatedCleaves = ((channel - 1) * channelRatedLife) + count;
  const totalBladeWearPct = Math.min(100, Math.round((totalEstimatedCleaves / model.totalBladeLife) * 100));

  let channelHealth = 'OPTIMAL';
  let channelHealthLabel = 'Channel Sharp & Ready';
  let channelHealthColor = '#10b981';

  if (channelWearPct >= 110) {
    channelHealth = 'EXHAUSTED';
    channelHealthLabel = 'Channel Exhausted — Rotate Blade Immediately';
    channelHealthColor = '#ef4444';
  } else if (channelWearPct >= 85) {
    channelHealth = 'WARNING';
    channelHealthLabel = 'Channel Nearing End of Life (Rotate Soon)';
    channelHealthColor = '#f59e0b';
  }

  return {
    channel,
    cleavesOnChannel: count,
    channelRatedLife,
    channelWearPct,
    totalEstimatedCleaves,
    totalBladeLife: model.totalBladeLife,
    totalBladeWearPct,
    channelHealth,
    channelHealthLabel,
    channelHealthColor,
    isChannelExhausted: channelWearPct >= 100,
    isBladeExhausted: totalBladeWearPct >= 100
  };
}

/**
 * Evaluates comprehensive Cleave QA metrics and assigns quality verdict
 */
export function evaluateCleaveQuality({
  cleaverModelId = 'SUMITOMO_FC6S',
  cleaveAngleDeg = 0.5,
  defectTypeId = 'NONE_PRISTINE',
  bladeHeightId = 'OPTIMAL',
  bladeChannel = 1,
  cleavesOnChannel = 500,
  wavelengthNm = 1310
}) {
  const model = CLEAVER_MODELS[cleaverModelId] || CLEAVER_MODELS['SUMITOMO_FC6S'];
  const defect = SURFACE_DEFECT_TYPES[defectTypeId] || SURFACE_DEFECT_TYPES['NONE_PRISTINE'];
  const height = BLADE_HEIGHT_SETTINGS[bladeHeightId] || BLADE_HEIGHT_SETTINGS['OPTIMAL'];
  const angle = Math.max(0, Number(cleaveAngleDeg) || 0);

  const angleLossDb = calculateCleaveAngleLoss(angle, wavelengthNm);
  const defectLossDb = defect.lossPenaltyDb;
  const totalEstimatedLossDb = Math.round((angleLossDb + defectLossDb) * 1000) / 1000;

  const bladeMetrics = calculateBladeWearMetrics(cleaverModelId, bladeChannel, cleavesOnChannel);

  // Quality grading
  let verdictKey = 'GRADE_D_REJECT';

  if (defect.verdictImpact === 'REJECT' || angle > 1.50) {
    verdictKey = 'GRADE_D_REJECT';
  } else if (angle <= 0.50 && defect.id === 'NONE_PRISTINE' && height.id === 'OPTIMAL') {
    verdictKey = 'GRADE_A_EXCELLENT';
  } else if (angle <= 1.00 && (defect.id === 'NONE_PRISTINE' || defect.id === 'MIST_PERIPHERY')) {
    verdictKey = 'GRADE_B_STANDARD';
  } else if (angle <= 1.50) {
    verdictKey = 'GRADE_C_CONDITIONAL';
  } else {
    verdictKey = 'GRADE_D_REJECT';
  }

  const verdict = CLEAVE_QA_VERDICTS[verdictKey];

  return {
    cleaverModel: model,
    cleaveAngleDeg: angle,
    angleLossDb,
    defect,
    defectLossDb,
    totalEstimatedLossDb,
    bladeHeight: height,
    bladeMetrics,
    verdict,
    isPassing: verdict.isPassing,
    fusionSpliceReady: verdictKey === 'GRADE_A_EXCELLENT' || verdictKey === 'GRADE_B_STANDARD',
    fastConnectorReady: verdict.isPassing,
    reCleaveRequired: verdictKey === 'GRADE_D_REJECT'
  };
}

/**
 * Pure vector SVG renderer for Fiber Cleave Angle, End-Face Topography, Defect & Blade Index
 */
export function renderFiberCleaveQualitySvg(analysis) {
  const {
    cleaveAngleDeg,
    defect,
    totalEstimatedLossDb,
    bladeMetrics,
    verdict
  } = analysis;

  const width = 800;
  const height = 440;

  // Visual angle amplification for clarity (max visual slant ~15 deg)
  const clampedAngle = Math.min(10, Math.max(0, cleaveAngleDeg));
  const visualAngleDeg = clampedAngle * 5.0;
  const slantDx = Math.sin((visualAngleDeg * Math.PI) / 180) * 80;

  // Defect rendering properties
  let defectOverlaySvg = '';
  if (defect.id === 'NONE_PRISTINE') {
    defectOverlaySvg = `
      <circle cx="560" cy="200" r="75" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6"/>
      <text x="560" y="295" text-anchor="middle" fill="#10b981" font-size="11" font-weight="600">100% Mirror Zone</text>
    `;
  } else if (defect.id.startsWith('MIST')) {
    defectOverlaySvg = `
      <path d="M 500 150 Q 560 170 620 150 Q 640 220 590 260 Q 520 260 500 200 Z" fill="url(#mistPattern)" opacity="0.8"/>
      <text x="560" y="295" text-anchor="middle" fill="#f59e0b" font-size="11" font-weight="600">Granular Mist Zone</text>
    `;
  } else if (defect.id === 'HACKLE_RADIAL') {
    defectOverlaySvg = `
      <g stroke="#ef4444" stroke-width="2.5" stroke-linecap="round">
        <line x1="510" y1="170" x2="610" y2="185"/>
        <line x1="495" y1="210" x2="625" y2="215"/>
        <line x1="515" y1="240" x2="605" y2="235"/>
        <line x1="535" y1="140" x2="585" y2="160"/>
      </g>
      <text x="560" y="295" text-anchor="middle" fill="#ef4444" font-size="11" font-weight="700">Hackle Steps Fracture</text>
    `;
  } else if (defect.id.startsWith('LIP')) {
    defectOverlaySvg = `
      <!-- Lip protrusion at edge -->
      <path d="M 635 185 Q 655 200 635 215 Z" fill="#ef4444" stroke="#fca5a5" stroke-width="1.5"/>
      <text x="560" y="295" text-anchor="middle" fill="#ef4444" font-size="11" font-weight="700">Tensile Lip Protrusion</text>
    `;
  } else if (defect.id === 'CHIP_ROLLOFF') {
    defectOverlaySvg = `
      <!-- Missing glass corner -->
      <path d="M 485 170 Q 515 190 500 230 Z" fill="#0f172a" stroke="#ef4444" stroke-width="1.5"/>
      <text x="560" y="295" text-anchor="middle" fill="#ef4444" font-size="11" font-weight="700">Edge Roll-Off Chip</text>
    `;
  }

  // Blade dial rotation (16 positions, 22.5 deg per channel)
  const dialRotation = (bladeMetrics.channel - 1) * 22.5;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="cleave-analysis-svg" width="100%" height="auto" role="img" aria-label="Optical Fiber Cleave Analysis Diagram">
      <defs>
        <linearGradient id="fiberCladdingGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25"/>
          <stop offset="50%" stop-color="#0284c7" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.25"/>
        </linearGradient>
        <linearGradient id="fiberCoreGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#d97706" stop-opacity="0.9"/>
        </linearGradient>
        <pattern id="mistPattern" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="#f59e0b" opacity="0.6"/>
          <circle cx="5" cy="5" r="1.0" fill="#f59e0b" opacity="0.4"/>
        </pattern>
      </defs>

      <!-- Background -->
      <rect width="${width}" height="${height}" rx="12" fill="#0b1120" stroke="#1e293b" stroke-width="1.5"/>

      <!-- Header Banner -->
      <rect x="0" y="0" width="${width}" height="42" fill="#0f172a" rx="12 12 0 0"/>
      <text x="24" y="26" fill="#f8fafc" font-size="13" font-weight="700" letter-spacing="0.5">FIBER CLEAVE ANGLE &amp; END-FACE TOPOGRAPHY METROLOGY</text>
      <text x="${width - 24}" y="26" text-anchor="end" fill="#94a3b8" font-size="11">ITU-T G.650.1 / TELCORDIA GR-765-CORE</text>

      <!-- LEFT PANEL: Longitudinal Cleave Angle Profile -->
      <g transform="translate(24, 60)">
        <rect width="360" height="260" rx="8" fill="#111c33" stroke="#1e293b" stroke-width="1"/>
        <text x="16" y="24" fill="#94a3b8" font-size="11" font-weight="700">LONGITUDINAL CLEAVE ANGLE PROFILE</text>

        <!-- 90 Deg Perpendicular Reference -->
        <line x1="260" y1="45" x2="260" y2="225" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4,4"/>
        <text x="260" y="40" text-anchor="middle" fill="#64748b" font-size="10">90.0° Reference Axis</text>

        <!-- Bare Fiber Tube (125µm representation) -->
        <path d="M 40 75 L 260 75 L ${260 + slantDx} 195 L 40 195 Z" fill="url(#fiberCladdingGrad)" stroke="#38bdf8" stroke-width="2"/>
        
        <!-- Core (9µm representation) -->
        <path d="M 40 130 L 260 130 L ${260 + (slantDx * 0.5)} 140 L 40 140 Z" fill="url(#fiberCoreGrad)" opacity="0.85"/>

        <!-- Cleave Plane Slant Line -->
        <line x1="${260 - (slantDx * 0.3)}" y1="50" x2="${260 + (slantDx * 1.3)}" y2="220" stroke="${verdict.colorHex}" stroke-width="3" stroke-linecap="round"/>

        <!-- Angle Arc Indicator -->
        <path d="M 260 100 A 35 35 0 0 1 ${260 + (slantDx * 0.3)} 100" fill="none" stroke="${verdict.colorHex}" stroke-width="2"/>
        <text x="${275 + slantDx}" y="115" fill="${verdict.colorHex}" font-size="14" font-weight="800">θ = ${cleaveAngleDeg.toFixed(2)}°</text>

        <!-- Dimension Labels -->
        <text x="50" y="105" fill="#38bdf8" font-size="10">Cladding (125 µm)</text>
        <text x="50" y="155" fill="#fbbf24" font-size="10">Core (9.2 µm)</text>
      </g>

      <!-- RIGHT PANEL: 2D End-Face Mirror & Defect Map -->
      <g transform="translate(416, 60)">
        <rect width="360" height="260" rx="8" fill="#111c33" stroke="#1e293b" stroke-width="1"/>
        <text x="16" y="24" fill="#94a3b8" font-size="11" font-weight="700">END-FACE CROSS-SECTION &amp; DEFECT MAP</text>

        <!-- Cladding Circle (125µm) -->
        <circle cx="180" cy="140" r="75" fill="#0f172a" stroke="#38bdf8" stroke-width="2.5"/>

        <!-- Core Circle (9µm) -->
        <circle cx="180" cy="140" r="14" fill="url(#fiberCoreGrad)" stroke="#f59e0b" stroke-width="1.5"/>

        <!-- Defect Overlay -->
        <g transform="translate(-380, -60)">
          ${defectOverlaySvg}
        </g>

        <!-- Reticle Grid -->
        <line x1="105" y1="140" x2="255" y2="140" stroke="#334155" stroke-width="1" stroke-dasharray="2,2"/>
        <line x1="180" y1="65" x2="180" y2="215" stroke="#334155" stroke-width="1" stroke-dasharray="2,2"/>
      </g>

      <!-- BOTTOM TELEMETRY RIBBON -->
      <g transform="translate(24, 335)">
        <rect width="752" height="85" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1"/>

        <!-- Metric 1: Cleave Angle -->
        <g transform="translate(20, 16)">
          <text x="0" y="14" fill="#94a3b8" font-size="10" font-weight="600">CLEAVE ANGLE (θ)</text>
          <text x="0" y="38" fill="#f8fafc" font-size="18" font-weight="800">${cleaveAngleDeg.toFixed(2)}°</text>
          <text x="0" y="54" fill="${cleaveAngleDeg <= 0.75 ? '#10b981' : cleaveAngleDeg <= 1.5 ? '#f59e0b' : '#ef4444'}" font-size="10">Target &lt; 0.50°</text>
        </g>

        <!-- Metric 2: Estimated Loss -->
        <g transform="translate(180, 16)">
          <text x="0" y="14" fill="#94a3b8" font-size="10" font-weight="600">EST. SPLICE LOSS PENALTY</text>
          <text x="0" y="38" fill="#38bdf8" font-size="18" font-weight="800">+${totalEstimatedLossDb.toFixed(3)} dB</text>
          <text x="0" y="54" fill="#94a3b8" font-size="10">Marcuse + Defect Penalty</text>
        </g>

        <!-- Metric 3: Blade Channel Wear -->
        <g transform="translate(370, 16)">
          <text x="0" y="14" fill="#94a3b8" font-size="10" font-weight="600">BLADE CHANNEL (POS ${bladeMetrics.channel}/16)</text>
          <text x="0" y="38" fill="${bladeMetrics.channelHealthColor}" font-size="18" font-weight="800">${bladeMetrics.channelWearPct}% Wear</text>
          <text x="0" y="54" fill="#94a3b8" font-size="10">${bladeMetrics.cleavesOnChannel} / ${bladeMetrics.channelRatedLife} Cleaves</text>
        </g>

        <!-- Metric 4: Quality Verdict -->
        <g transform="translate(560, 16)">
          <text x="0" y="14" fill="#94a3b8" font-size="10" font-weight="600">QA METROLOGY VERDICT</text>
          <rect x="0" y="22" width="170" height="26" rx="4" fill="${verdict.colorHex}" opacity="0.2"/>
          <text x="8" y="40" fill="${verdict.colorHex}" font-size="12" font-weight="800">${verdict.code} — ${verdict.isPassing ? 'PASSED' : 'REJECT'}</text>
          <text x="0" y="60" fill="#94a3b8" font-size="9">${verdict.isPassing ? 'Ready for Splicing' : 'Re-Cleave Mandated'}</text>
        </g>
      </g>
    </svg>
  `;
}

/**
 * Validates input parameters for Fiber Cleave QA inspection
 */
export function validateFiberCleaveInput({
  cleaveAngleDeg,
  cleavesOnChannel,
  bladeChannel
}) {
  const errors = [];

  const angle = Number(cleaveAngleDeg);
  if (isNaN(angle) || angle < 0 || angle > 20) {
    errors.push('Cleave angle must be a valid number between 0.00° and 20.00°.');
  }

  const channel = Number(bladeChannel);
  if (isNaN(channel) || channel < 1 || channel > 24) {
    errors.push('Blade channel index must be an integer between 1 and 24.');
  }

  const cleaves = Number(cleavesOnChannel);
  if (isNaN(cleaves) || cleaves < 0 || cleaves > 10000) {
    errors.push('Cleaves on current channel must be between 0 and 10,000.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Builds an immutable, sequentially identified Cleave QA Certificate record
 */
export function buildFiberCleaveRecord({
  customer,
  cleaverModelId = 'SUMITOMO_FC6S',
  cleaveAngleDeg = 0.50,
  defectTypeId = 'NONE_PRISTINE',
  bladeHeightId = 'OPTIMAL',
  bladeChannel = 1,
  cleavesOnChannel = 500,
  technicianName = 'Certified Specialist',
  location = 'Outside Plant Enclosure',
  notes = '',
  timestamp = null
}) {
  const now = timestamp ? new Date(timestamp) : new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = `CLV-${yearMonth}-${randomSuffix}`;

  const analysis = evaluateCleaveQuality({
    cleaverModelId,
    cleaveAngleDeg,
    defectTypeId,
    bladeHeightId,
    bladeChannel,
    cleavesOnChannel
  });

  return {
    id: certId,
    timestamp: now.toISOString(),
    dateStr: now.toISOString().slice(0, 10),
    customerId: customer?.id || null,
    customerName: customer?.name || 'Shahdara Network Feeder',
    customerMohalla: customer?.mohalla || customer?.zone || 'Shahdara OSP',
    customerPhone: customer?.phone || '—',
    cleaverModelId,
    cleaverModelName: analysis.cleaverModel.name,
    cleaveAngleDeg: Number(cleaveAngleDeg),
    defectTypeId,
    defectName: analysis.defect.name,
    bladeHeightId,
    bladeHeightName: analysis.bladeHeight.name,
    bladeChannel: Number(bladeChannel),
    cleavesOnChannel: Number(cleavesOnChannel),
    angleLossDb: analysis.angleLossDb,
    defectLossDb: analysis.defectLossDb,
    totalEstimatedLossDb: analysis.totalEstimatedLossDb,
    channelWearPct: analysis.bladeMetrics.channelWearPct,
    channelHealth: analysis.bladeMetrics.channelHealth,
    verdictCode: analysis.verdict.code,
    verdictLabel: analysis.verdict.label,
    isPassing: analysis.verdict.isPassing,
    fusionSpliceReady: analysis.fusionSpliceReady,
    technicianName: technicianName || 'Certified Technician',
    location: location || 'Field Enclosure',
    notes: notes || ''
  };
}

/**
 * LocalStorage management for Cleave QA Certificates
 */
export function getSavedFiberCleaveCerts(storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return [];
    const raw = store.getItem(FIBER_CLEAVE_QUALITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load saved fiber cleave certs:', err);
    return [];
  }
}

export function saveFiberCleaveCert(record, storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store || !record || !record.id) return false;
    const existing = getSavedFiberCleaveCerts(store);
    const updated = [record, ...existing.filter(r => r.id !== record.id)].slice(0, 100);
    store.setItem(FIBER_CLEAVE_QUALITY_STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error('Failed to save fiber cleave cert:', err);
    return false;
  }
}

export function clearFiberCleaveCerts(storage = null) {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    store.removeItem(FIBER_CLEAVE_QUALITY_STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Aggregates summary KPI metrics across saved Cleave QA records
 */
export function calculateFiberCleaveMetrics(records = []) {
  const total = records.length;
  if (!total) {
    return {
      totalCertificates: 0,
      gradeACount: 0,
      gradeBCount: 0,
      gradeCCount: 0,
      gradeDCount: 0,
      passRatePct: 0,
      avgCleaveAngleDeg: 0,
      avgLossPenaltyDb: 0,
      reCleaveMandatedCount: 0
    };
  }

  let gradeA = 0;
  let gradeB = 0;
  let gradeC = 0;
  let gradeD = 0;
  let passing = 0;
  let sumAngle = 0;
  let sumLoss = 0;

  records.forEach(r => {
    if (r.verdictCode === 'GRADE_A') gradeA++;
    else if (r.verdictCode === 'GRADE_B') gradeB++;
    else if (r.verdictCode === 'GRADE_C') gradeC++;
    else if (r.verdictCode === 'GRADE_D') gradeD++;

    if (r.isPassing) passing++;
    sumAngle += (Number(r.cleaveAngleDeg) || 0);
    sumLoss += (Number(r.totalEstimatedLossDb) || 0);
  });

  return {
    totalCertificates: total,
    gradeACount: gradeA,
    gradeBCount: gradeB,
    gradeCCount: gradeC,
    gradeDCount: gradeD,
    passRatePct: Math.round((passing / total) * 100),
    avgCleaveAngleDeg: Math.round((sumAngle / total) * 100) / 100,
    avgLossPenaltyDb: Math.round((sumLoss / total) * 1000) / 1000,
    reCleaveMandatedCount: gradeD
  };
}

/**
 * Generates dual printable documents: Formal A4 Certificate & 80mm POS Slip
 */
export function generateFiberCleaveQualityCertHtml(record, { format = 'A4' } = {}) {
  const isPos = format.toUpperCase() === 'POS';

  if (isPos) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Thermal Slip - ${escapeHtml(record.id)}</title>
        <style>
          @page { size: 80mm auto; margin: 3mm; }
          body {
            font-family: 'Courier New', monospace;
            width: 74mm;
            margin: 0 auto;
            font-size: 11px;
            color: #000;
            line-height: 1.25;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .verdict-box {
            border: 1px solid #000;
            padding: 4px;
            text-align: center;
            font-weight: bold;
            margin: 6px 0;
          }
        </style>
      </head>
      <body>
        <div class="center bold">SHAHDARA FIBER NETWORK</div>
        <div class="center">FIBER CLEAVE QA FIELD SLIP</div>
        <div class="center">Telcordia GR-765 / ITU-T G.650.1</div>
        <div class="divider"></div>
        <div class="row"><span>CERT ID:</span><span class="bold">${escapeHtml(record.id)}</span></div>
        <div class="row"><span>DATE:</span><span>${escapeHtml(record.dateStr)}</span></div>
        <div class="row"><span>TECH:</span><span>${escapeHtml(record.technicianName)}</span></div>
        <div class="row"><span>LOCATION:</span><span>${escapeHtml(record.location)}</span></div>
        <div class="divider"></div>
        <div class="row"><span>CLEAVER:</span><span class="bold">${escapeHtml(record.cleaverModelName)}</span></div>
        <div class="row"><span>BLADE POS:</span><span>Channel ${record.bladeChannel} (${record.channelWearPct}% wear)</span></div>
        <div class="row"><span>CLEAVE ANGLE:</span><span class="bold">${record.cleaveAngleDeg.toFixed(2)}°</span></div>
        <div class="row"><span>SURFACE TOPOGRAPHY:</span><span>${escapeHtml(record.defectName)}</span></div>
        <div class="row"><span>EST. TILT LOSS:</span><span>+${record.angleLossDb.toFixed(3)} dB</span></div>
        <div class="row"><span>TOTAL EST. LOSS:</span><span class="bold">+${record.totalEstimatedLossDb.toFixed(3)} dB</span></div>
        <div class="divider"></div>
        <div class="verdict-box">
          ${escapeHtml(record.verdictLabel)}<br>
          ${record.isPassing ? 'PASS - READY FOR TERMINATION' : 'REJECT - MANDATORY RE-CLEAVE'}
        </div>
        <div class="center" style="font-size: 9px; margin-top: 6px;">
          Shahdara ISP Network Operations Center<br>
          Verification Hotline: 042-37920000
        </div>
      </body>
      </html>
    `;
  }

  // Formal A4 Certificate
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Fiber Cleave QA Accreditation Certificate - ${escapeHtml(record.id)}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          color: #1e293b;
          line-height: 1.5;
          margin: 0;
          padding: 10px;
        }
        .cert-border {
          border: 3px double #0284c7;
          border-radius: 8px;
          padding: 24px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .title h1 {
          margin: 0;
          font-size: 20px;
          color: #0369a1;
          letter-spacing: 0.5px;
        }
        .title p {
          margin: 2px 0 0;
          font-size: 11px;
          color: #64748b;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .data-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px;
        }
        .data-card h3 {
          margin: 0 0 8px;
          font-size: 12px;
          color: #0369a1;
          text-transform: uppercase;
        }
        .data-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 4px;
          border-bottom: 1px dashed #e2e8f0;
          padding-bottom: 2px;
        }
        .verdict-banner {
          background: ${record.isPassing ? '#ecfdf5' : '#fef2f2'};
          border: 2px solid ${record.isPassing ? '#10b981' : '#ef4444'};
          border-radius: 6px;
          padding: 14px;
          text-align: center;
          margin: 20px 0;
        }
        .verdict-banner h2 {
          margin: 0;
          font-size: 16px;
          color: ${record.isPassing ? '#065f46' : '#991b1b'};
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 36px;
          padding-top: 12px;
          border-top: 1px solid #cbd5e1;
        }
        .sig-box {
          width: 40%;
          text-align: center;
          font-size: 11px;
        }
        .sig-line {
          border-bottom: 1px solid #475569;
          margin-bottom: 6px;
          height: 30px;
        }
      </style>
    </head>
    <body>
      <div class="cert-border">
        <div class="header">
          <div class="title">
            <h1>SHAHDARA OPTICAL NETWORK METROLOGY LABORATORY</h1>
            <p>Outside Plant Fiber Cleave Angle, End-Face Topography &amp; Blade Integrity Certificate</p>
            <p>Reference Standards: ITU-T G.650.1 | Telcordia GR-765-CORE | IEC 61073-1</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: bold; color: #0284c7;">${escapeHtml(record.id)}</div>
            <div style="font-size: 11px; color: #64748b;">Date: ${escapeHtml(record.dateStr)}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="data-card">
            <h3>Fiber &amp; Location Metadata</h3>
            <div class="data-row"><span>Customer / Link:</span><span style="font-weight: 600;">${escapeHtml(record.customerName)}</span></div>
            <div class="data-row"><span>Area / Mohalla:</span><span>${escapeHtml(record.customerMohalla)}</span></div>
            <div class="data-row"><span>Field Location:</span><span>${escapeHtml(record.location)}</span></div>
            <div class="data-row"><span>Certified Technician:</span><span style="font-weight: 600;">${escapeHtml(record.technicianName)}</span></div>
          </div>

          <div class="data-card">
            <h3>Precision Cleaver Telemetry</h3>
            <div class="data-row"><span>Cleaver Model:</span><span style="font-weight: 600;">${escapeHtml(record.cleaverModelName)}</span></div>
            <div class="data-row"><span>Active Blade Channel:</span><span>Channel ${record.bladeChannel} / 16</span></div>
            <div class="data-row"><span>Channel Cleave Count:</span><span>${record.cleavesOnChannel} cleaves (${record.channelWearPct}% rated wear)</span></div>
            <div class="data-row"><span>Anvil Height Setting:</span><span>${escapeHtml(record.bladeHeightName)}</span></div>
          </div>
        </div>

        <div class="grid-2">
          <div class="data-card">
            <h3>End-Face Metrological Analysis</h3>
            <div class="data-row"><span>Measured Cleave Angle (θ):</span><span style="font-weight: bold; color: ${record.cleaveAngleDeg <= 0.75 ? '#059669' : '#dc2626'};">${record.cleaveAngleDeg.toFixed(2)}° (Target &le; 0.50°)</span></div>
            <div class="data-row"><span>Surface Morphology:</span><span>${escapeHtml(record.defectName)}</span></div>
            <div class="data-row"><span>Angular Tilt Loss (Marcuse):</span><span>+${record.angleLossDb.toFixed(3)} dB</span></div>
            <div class="data-row"><span>Defect Scattering Penalty:</span><span>+${record.defectLossDb.toFixed(3)} dB</span></div>
            <div class="data-row"><span>Total Theoretical Insertion Loss:</span><span style="font-weight: bold;">+${record.totalEstimatedLossDb.toFixed(3)} dB</span></div>
          </div>

          <div class="data-card">
            <h3>Termination Suitability</h3>
            <div class="data-row"><span>Core Alignment System (PAS):</span><span>${record.cleaveAngleDeg <= 1.0 ? 'Optimal Alignment' : 'Marginal Deflection'}</span></div>
            <div class="data-row"><span>Fusion Splicer Readiness:</span><span style="font-weight: 600;">${record.fusionSpliceReady ? 'APPROVED (Low Loss)' : 'NOT RECOMMENDED'}</span></div>
            <div class="data-row"><span>Fast Mechanical Connector:</span><span style="font-weight: 600;">${record.isPassing ? 'SUITABLE' : 'REJECT'}</span></div>
            <div class="data-row"><span>Inspection Notes:</span><span>${escapeHtml(record.notes || 'Routine high-reliability Outside Plant verification.')}</span></div>
          </div>
        </div>

        <div class="verdict-banner">
          <h2>${escapeHtml(record.verdictLabel)}</h2>
          <p style="margin: 4px 0 0; font-size: 12px; color: ${record.isPassing ? '#065f46' : '#991b1b'};">
            ${record.isPassing
              ? 'Meets Outside Plant Optical Fiber Quality Acceptance Standards according to ITU-T G.650.1 and Telcordia GR-765-CORE.'
              : 'End-face defect or excessive angular slant detected. Re-cleave fiber with clean scoring before arc splicing.'}
          </p>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Field Splicing Specialist</strong><br>
            Outside Plant Operations, Shahdara
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>Quality Assurance Director</strong><br>
            Optical Metrology &amp; Fiber Standards
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Formats bilingual Urdu & English WhatsApp technician dispatch notice
 */
export function formatFiberCleaveQualityCertWhatsApp(record) {
  const isPass = record.isPassing;
  const statusEmoji = isPass ? '✅' : '❌';

  return `*SHAHDARA FIBER NETWORK — CLEAVE QA CERTIFICATE* 🪓
*سرٹیفکیٹ برائے آپٹیکل فائبر کلیو اینگل و کوالٹی*
━━━━━━━━━━━━━━━━━━━━
*Cert ID:* ${record.id}
*Date / تاریخ:* ${record.dateStr}
*Customer / صارف:* ${record.customerName} (${record.customerMohalla})
*Technician / ٹیکنیشن:* ${record.technicianName}
*Location / مقام:* ${record.location}
━━━━━━━━━━━━━━━━━━━━
*Cleaver / کلیور ماڈل:* ${record.cleaverModelName}
*Blade Channel:* Pos ${record.bladeChannel} (${record.cleavesOnChannel} cuts, ${record.channelWearPct}% wear)
*Cleave Angle (θ):* ${record.cleaveAngleDeg.toFixed(2)}° ${record.cleaveAngleDeg <= 0.75 ? '🟢' : '⚠️'}
*End-Face Topography:* ${record.defectName}
*Est. Splice Loss:* +${record.totalEstimatedLossDb.toFixed(3)} dB
━━━━━━━━━━━━━━━━━━━━
*Verdict / حتمی نتیجہ:* ${statusEmoji} ${record.verdictLabel}
*Recommendation / ہدایت:*
${isPass
  ? 'فائبر کا سرا صاف ہے، فیوژن سپلائسنگ کیلئے تیار ہے۔'
  : 'اینگل زیادہ یا شیشہ چٹا ہوا ہے، لازمی دوبارہ کلیو کریں۔'}

_Shahdara ISP Network Operations Center — Metrology Dept_`;
}

/**
 * Exports Cleave QA records to compliant RFC-4180 CSV with UTF-8 BOM
 */
export function generateFiberCleaveQualityCertsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Date',
    'Customer ID',
    'Customer Name',
    'Mohalla',
    'Technician',
    'Location',
    'Cleaver Model',
    'Blade Channel',
    'Cleaves on Channel',
    'Channel Wear %',
    'Cleave Angle (Deg)',
    'Surface Defect',
    'Blade Height',
    'Angle Loss (dB)',
    'Defect Loss (dB)',
    'Total Est Loss (dB)',
    'Verdict Code',
    'Verdict Label',
    'Is Passing',
    'Fusion Ready',
    'Notes'
  ];

  const escapeCsv = (val) => {
    if (val == null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = records.map(r => [
    escapeCsv(r.id),
    escapeCsv(r.dateStr),
    escapeCsv(r.customerId),
    escapeCsv(r.customerName),
    escapeCsv(r.customerMohalla),
    escapeCsv(r.technicianName),
    escapeCsv(r.location),
    escapeCsv(r.cleaverModelName),
    escapeCsv(r.bladeChannel),
    escapeCsv(r.cleavesOnChannel),
    escapeCsv(r.channelWearPct),
    escapeCsv(r.cleaveAngleDeg),
    escapeCsv(r.defectName),
    escapeCsv(r.bladeHeightName),
    escapeCsv(r.angleLossDb),
    escapeCsv(r.defectLossDb),
    escapeCsv(r.totalEstimatedLossDb),
    escapeCsv(r.verdictCode),
    escapeCsv(r.verdictLabel),
    escapeCsv(r.isPassing ? 'YES' : 'NO'),
    escapeCsv(r.fusionSpliceReady ? 'YES' : 'NO'),
    escapeCsv(r.notes)
  ].join(','));

  return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
}

/**
 * Comprehensive UI Controller for Fiber Cleave QA Modal Dialog
 */
export function setupFiberCleaveQualityModal({
  dialogElement,
  triggerButton,
  storage = null,
  onToast = () => {}
}) {
  if (!dialogElement) return null;

  // Form controls
  const cleaverModelSelect = dialogElement.querySelector('#cleaveModelSelect');
  const presetSelect = dialogElement.querySelector('#cleavePresetSelect');
  const angleInput = dialogElement.querySelector('#cleaveAngleInput');
  const defectSelect = dialogElement.querySelector('#cleaveDefectSelect');
  const bladeHeightSelect = dialogElement.querySelector('#cleaveBladeHeightSelect');
  const channelInput = dialogElement.querySelector('#cleaveChannelInput');
  const cleavesInput = dialogElement.querySelector('#cleaveCountInput');
  const technicianInput = dialogElement.querySelector('#cleaveTechnicianInput');
  const locationInput = dialogElement.querySelector('#cleaveLocationInput');
  const notesInput = dialogElement.querySelector('#cleaveNotesInput');

  // Badges & Containers
  const svgContainer = dialogElement.querySelector('#cleaveSvgContainer');
  const angleBadge = dialogElement.querySelector('#cleaveAngleBadge');
  const verdictPill = dialogElement.querySelector('#cleaveVerdictPill');
  const lossBadge = dialogElement.querySelector('#cleaveLossBadge');
  const wearBadge = dialogElement.querySelector('#cleaveWearBadge');

  // History & Table
  const historyTbody = dialogElement.querySelector('#cleaveHistoryTbody');
  const historySearch = dialogElement.querySelector('#cleaveHistorySearch');
  const historyFilter = dialogElement.querySelector('#cleaveHistoryFilter');

  // Action Buttons
  const saveCertBtn = dialogElement.querySelector('#cleaveSaveCertBtn');
  const printA4Btn = dialogElement.querySelector('#cleavePrintA4Btn');
  const printPosBtn = dialogElement.querySelector('#cleavePrintPosBtn');
  const exportCsvBtn = dialogElement.querySelector('#cleaveExportCsvBtn');
  const whatsAppBtn = dialogElement.querySelector('#cleaveWhatsAppBtn');
  const closeBtn = dialogElement.querySelector('#cleaveCloseBtn');

  let activeCustomer = null;

  // Populate Dropdowns safely
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

  if (cleaverModelSelect && !cleaverModelSelect.children.length) {
    Object.values(CLEAVER_MODELS).forEach(m => {
      cleaverModelSelect.appendChild(createOption(m.id, `${m.name} (${m.brand})`));
    });
  }

  if (defectSelect && !defectSelect.children.length) {
    Object.values(SURFACE_DEFECT_TYPES).forEach(d => {
      defectSelect.appendChild(createOption(d.id, `${d.name} (+${d.lossPenaltyDb} dB)`));
    });
  }

  if (bladeHeightSelect && !bladeHeightSelect.children.length) {
    Object.values(BLADE_HEIGHT_SETTINGS).forEach(h => {
      bladeHeightSelect.appendChild(createOption(h.id, h.name));
    });
  }

  if (presetSelect && !presetSelect.children.length) {
    presetSelect.appendChild(createOption('', '— Select Standard Shahdara Preset —'));

    Object.values(SHAH_CLEAVE_PRESETS).forEach(p => {
      presetSelect.appendChild(createOption(p.id, p.name));
    });
  }

  function getFormValues() {
    return {
      cleaverModelId: cleaverModelSelect?.value || 'SUMITOMO_FC6S',
      cleaveAngleDeg: parseFloat(angleInput?.value) || 0.50,
      defectTypeId: defectSelect?.value || 'NONE_PRISTINE',
      bladeHeightId: bladeHeightSelect?.value || 'OPTIMAL',
      bladeChannel: parseInt(channelInput?.value, 10) || 1,
      cleavesOnChannel: parseInt(cleavesInput?.value, 10) || 500
    };
  }

  function recalculate() {
    const vals = getFormValues();
    const analysis = evaluateCleaveQuality(vals);

    if (svgContainer) {
      svgContainer.innerHTML = renderFiberCleaveQualitySvg(analysis);
    }

    if (angleBadge) {
      angleBadge.textContent = `${analysis.cleaveAngleDeg.toFixed(2)}°`;
      angleBadge.className = `metric-badge ${analysis.cleaveAngleDeg <= 0.75 ? 'badge-success' : analysis.cleaveAngleDeg <= 1.5 ? 'badge-warning' : 'badge-danger'}`;
    }

    if (lossBadge) {
      lossBadge.textContent = `+${analysis.totalEstimatedLossDb.toFixed(3)} dB`;
    }

    if (wearBadge) {
      wearBadge.textContent = `${analysis.bladeMetrics.channelWearPct}% Wear`;
      wearBadge.style.color = analysis.bladeMetrics.channelHealthColor;
    }

    if (verdictPill) {
      verdictPill.textContent = `${analysis.verdict.code} — ${analysis.verdict.isPassing ? 'PASSED' : 'REJECT'}`;
      verdictPill.className = `status-pill ${analysis.verdict.badgeClass}`;
    }

    return analysis;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const records = getSavedFiberCleaveCerts(storage);
    const search = (historySearch?.value || '').toLowerCase().trim();
    const filter = historyFilter?.value || 'ALL';

    const filtered = records.filter(r => {
      if (filter === 'PASS' && !r.isPassing) return false;
      if (filter === 'REJECT' && r.isPassing) return false;
      if (!search) return true;
      return (
        r.id.toLowerCase().includes(search) ||
        r.customerName.toLowerCase().includes(search) ||
        r.location.toLowerCase().includes(search) ||
        r.cleaverModelName.toLowerCase().includes(search)
      );
    });

    if (!filtered.length) {
      historyTbody.innerHTML = `<tr><td colspan="7" class="table-empty-hint" style="text-align: center; padding: 16px;">No cleave QA certificates found matching query.</td></tr>`;
      return;
    }

    historyTbody.innerHTML = filtered.map(r => `
      <tr>
        <td style="font-weight: 600; font-family: monospace;">${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.dateStr)}</td>
        <td>${escapeHtml(r.customerName)} <small style="color: #64748b;">(${escapeHtml(r.location)})</small></td>
        <td><strong>${r.cleaveAngleDeg.toFixed(2)}°</strong> <small style="color: #64748b;">(${escapeHtml(r.defectName)})</small></td>
        <td>+${r.totalEstimatedLossDb.toFixed(3)} dB</td>
        <td><span class="status-pill ${r.isPassing ? 'badge-pass-standard' : 'badge-fail-rework'}">${escapeHtml(r.verdictCode)}</span></td>
        <td>
          <button type="button" class="action-btn-sm" data-cleave-print-pos="${escapeHtml(r.id)}" title="Print Thermal Slip">POS</button>
          <button type="button" class="action-btn-sm" data-cleave-print-a4="${escapeHtml(r.id)}" title="Print Formal Certificate">A4</button>
        </td>
      </tr>
    `).join('');

    // Attach row button listeners
    historyTbody.querySelectorAll('[data-cleave-print-pos]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cleave-print-pos');
        const rec = records.find(x => x.id === id);
        if (rec) {
          const html = generateFiberCleaveQualityCertHtml(rec, { format: 'POS' });
          openPrintWindow(html);
        }
      });
    });

    historyTbody.querySelectorAll('[data-cleave-print-a4]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cleave-print-a4');
        const rec = records.find(x => x.id === id);
        if (rec) {
          const html = generateFiberCleaveQualityCertHtml(rec, { format: 'A4' });
          openPrintWindow(html);
        }
      });
    });
  }

  function openPrintWindow(html) {
    if (typeof window === 'undefined') return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 350);
    }
  }

  // Event Listeners
  [cleaverModelSelect, angleInput, defectSelect, bladeHeightSelect, channelInput, cleavesInput].forEach(ctrl => {
    ctrl?.addEventListener('input', recalculate);
    ctrl?.addEventListener('change', recalculate);
  });

  presetSelect?.addEventListener('change', () => {
    const presetId = presetSelect.value;
    const p = SHAH_CLEAVE_PRESETS[presetId];
    if (p) {
      if (cleaverModelSelect) cleaverModelSelect.value = p.cleaverModel;
      if (angleInput) angleInput.value = p.cleaveAngleDeg;
      if (defectSelect) defectSelect.value = p.defectType;
      if (bladeHeightSelect) bladeHeightSelect.value = p.bladeHeight;
      if (channelInput) channelInput.value = p.bladeChannel;
      if (cleavesInput) cleavesInput.value = p.cleavesOnChannel;
      if (technicianInput) technicianInput.value = p.technician;
      if (locationInput) locationInput.value = p.location;
      if (notesInput) notesInput.value = p.notes;
      recalculate();
      onToast(`Loaded preset: ${p.name}`);
    }
  });

  saveCertBtn?.addEventListener('click', () => {
    const vals = getFormValues();
    const valid = validateFiberCleaveInput(vals);
    if (!valid.isValid) {
      onToast(`Validation error: ${valid.errors[0]}`);
      return;
    }

    const record = buildFiberCleaveRecord({
      customer: activeCustomer,
      ...vals,
      technicianName: technicianInput?.value || 'Certified Specialist',
      location: locationInput?.value || 'Outside Plant Enclosure',
      notes: notesInput?.value || ''
    });

    const ok = saveFiberCleaveCert(record, storage);
    if (ok) {
      onToast(`Saved Cleave QA Certificate ${record.id}!`);
      renderHistory();
    } else {
      onToast('Error saving record.');
    }
  });

  printA4Btn?.addEventListener('click', () => {
    const vals = getFormValues();
    const record = buildFiberCleaveRecord({
      customer: activeCustomer,
      ...vals,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const html = generateFiberCleaveQualityCertHtml(record, { format: 'A4' });
    openPrintWindow(html);
  });

  printPosBtn?.addEventListener('click', () => {
    const vals = getFormValues();
    const record = buildFiberCleaveRecord({
      customer: activeCustomer,
      ...vals,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const html = generateFiberCleaveQualityCertHtml(record, { format: 'POS' });
    openPrintWindow(html);
  });

  exportCsvBtn?.addEventListener('click', () => {
    const records = getSavedFiberCleaveCerts(storage);
    if (!records.length) {
      onToast('No saved records to export.');
      return;
    }
    const csv = generateFiberCleaveQualityCertsCsv(records);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shahdara_fiber_cleave_qa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported CSV successfully!');
  });

  whatsAppBtn?.addEventListener('click', () => {
    const vals = getFormValues();
    const record = buildFiberCleaveRecord({
      customer: activeCustomer,
      ...vals,
      technicianName: technicianInput?.value,
      location: locationInput?.value,
      notes: notesInput?.value
    });
    const text = formatFiberCleaveQualityCertWhatsApp(record);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      onToast('WhatsApp dispatch notice copied to clipboard!');
    }
  });

  historySearch?.addEventListener('input', renderHistory);
  historyFilter?.addEventListener('change', renderHistory);

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
        locationInput.value = `${c.name || 'Subscriber'} Drop Termination (${c.mohalla || c.zone || 'Shahdara'})`;
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
