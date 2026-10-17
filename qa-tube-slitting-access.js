/**
 * Shahdara ISP Billing & Network Operations - Outside Plant Fiber Cable
 * Mid-Span Tube Ring-Cut, Shaving & Buffer Tube Longitudinal Slitting QA Certification Suite
 * Standards: IEC 60794-1-21 Method E19, Telcordia GR-20-CORE Issue 4, ITU-T L.400 / L.12
 * Area: agent3 (shahdara-forms-qa) - Tables, Forms, Receipts, QA & Metrology Certification
 */

export const TUBE_SLITTING_STORAGE_KEY = 'shahdara_tube_slitting_certs_v1';

export const TUBE_SLITTER_TOOL_TYPES = {
  'PRECISION_MICROMETER_SLITTER': {
    id: 'PRECISION_MICROMETER_SLITTER',
    name: 'Precision Dial-Micrometer Buffer Tube Shaver (Ripley MSAT-5 / Jonard MS-6)',
    category: 'Calibrated Precision Micrometer',
    maxBladeDepthMm: 1.5,
    bladeDepthAccuracyMm: 0.01,
    nickRiskRating: 'NEGLIGIBLE',
    recommendedTubeTypes: ['PBT_LOOSE_TUBE_2_0MM', 'PBT_LOOSE_TUBE_2_5MM', 'MICRO_TUBE_1_4MM'],
    description: 'Factory-calibrated dial micrometer with precision elliptical guide channels preventing blade intrusion into live express fiber core.'
  },
  'FIXED_BLADE_RING_CUTTER': {
    id: 'FIXED_BLADE_RING_CUTTER',
    name: 'Rotary Round-Cable Mid-Span Ring Stripper (Ideal 45-162 / 45-163)',
    category: 'Rotary Score Cutter',
    maxBladeDepthMm: 3.2,
    bladeDepthAccuracyMm: 0.05,
    nickRiskRating: 'LOW',
    recommendedTubeTypes: ['POLYCARBONATE_TUBE_3_0MM', 'CENTRAL_LOOSE_TUBE_4_0MM'],
    description: 'Adjustable depth blade designed for scoring thick-walled central buffer tubes prior to mechanical snap opening.'
  },
  'LONGITUDINAL_PEELER': {
    id: 'LONGITUDINAL_PEELER',
    name: 'Dual-Blade Longitudinal Tube Peeler (Jonard MS-306 / Corning OFT-000)',
    category: 'Opposing Dual Slitter',
    maxBladeDepthMm: 2.0,
    bladeDepthAccuracyMm: 0.02,
    nickRiskRating: 'VERY_LOW',
    recommendedTubeTypes: ['PBT_LOOSE_TUBE_2_0MM', 'PBT_LOOSE_TUBE_2_5MM'],
    description: 'Opposing dual blades cut two longitudinal score lines simultaneously, allowing clean clamshell peeling of live express tubes.'
  },
  'HANDHELD_FIELD_UTILITY': {
    id: 'HANDHELD_FIELD_UTILITY',
    name: 'Uncalibrated Field Utility Knife / Razor Blade (Extreme Nick Hazard)',
    category: 'Uncalibrated Manual Razor',
    maxBladeDepthMm: 10.0,
    bladeDepthAccuracyMm: 0.25,
    nickRiskRating: 'CRITICAL_HAZARD',
    recommendedTubeTypes: [],
    description: 'Manual utility knife lacking depth stops; poses acute risk of slicing, nicking, and severing active optical fibers.'
  }
};

export const BUFFER_TUBE_TYPES = {
  'PBT_LOOSE_TUBE_2_0MM': {
    id: 'PBT_LOOSE_TUBE_2_0MM',
    name: '2.0mm PBT Loose Buffer Tube (Wall 0.35mm, 6/12F Gel-Filled)',
    outerDiameterMm: 2.0,
    wallThicknessMm: 0.35,
    fiberCapacity: 12,
    minSlackBendRadiusMm: 30.0,
    gelFilled: true,
    description: 'Standard feeder loose buffer tube filled with thixotropic water-blocking gel.'
  },
  'PBT_LOOSE_TUBE_2_5MM': {
    id: 'PBT_LOOSE_TUBE_2_5MM',
    name: '2.5mm PBT Loose Buffer Tube (Wall 0.40mm, 12F Gel-Filled)',
    outerDiameterMm: 2.5,
    wallThicknessMm: 0.40,
    fiberCapacity: 12,
    minSlackBendRadiusMm: 35.0,
    gelFilled: true,
    description: 'High-density distribution tube with robust PBT walls designed for outdoor environmental tolerance.'
  },
  'POLYCARBONATE_TUBE_3_0MM': {
    id: 'POLYCARBONATE_TUBE_3_0MM',
    name: '3.0mm Heavy Polycarbonate Tube (Wall 0.50mm, 24F Dry-Core)',
    outerDiameterMm: 3.0,
    wallThicknessMm: 0.50,
    fiberCapacity: 24,
    minSlackBendRadiusMm: 45.0,
    gelFilled: false,
    description: 'Thick-walled dry-block tube with water-swellable yarns, requiring deeper blade score.'
  },
  'MICRO_TUBE_1_4MM': {
    id: 'MICRO_TUBE_1_4MM',
    name: '1.4mm Micro-Duct Ultra-Thin Tube (Wall 0.22mm, 4/6F Sensitive)',
    outerDiameterMm: 1.4,
    wallThicknessMm: 0.22,
    fiberCapacity: 6,
    minSlackBendRadiusMm: 25.0,
    gelFilled: false,
    description: 'Ultra-thin micro-sheath tube; requires ultra-high micrometer precision to avoid fiber damage.'
  },
  'CENTRAL_LOOSE_TUBE_4_0MM': {
    id: 'CENTRAL_LOOSE_TUBE_4_0MM',
    name: '4.0mm Central Core Uni-Tube (Wall 0.60mm, 48/96F Heavy)',
    outerDiameterMm: 4.0,
    wallThicknessMm: 0.60,
    fiberCapacity: 96,
    minSlackBendRadiusMm: 60.0,
    gelFilled: true,
    description: 'Central loose tube carrying multiple fiber bundles; mid-span access requires rotary scoring.'
  }
};

export const TUBE_SLITTING_VERDICTS = {
  'CERTIFIED_OPTIMAL_ACCESS': {
    id: 'CERTIFIED_OPTIMAL_ACCESS',
    name: 'Certified Optimal Mid-Span Access (Pass)',
    badgeClass: 'badge-success',
    color: '#16a34a',
    description: 'Shaving blade penetration is 80-92% of wall thickness, leaving safe buffer clearance; live express fibers intact with induced loss ≤ 0.02 dB.'
  },
  'CONDITIONAL_PASS_CARE_REQUIRED': {
    id: 'CONDITIONAL_PASS_CARE_REQUIRED',
    name: 'Conditional Pass (Marginal Blade Clearance / Retest Loss)',
    badgeClass: 'badge-warning',
    color: '#f59e0b',
    description: 'Shaving depth is 93-98% of wall thickness or slack loop radius is marginal; OTDR live transmission verification advised.'
  },
  'FAILED_BLADE_FIBER_NICK': {
    id: 'FAILED_BLADE_FIBER_NICK',
    name: 'Critical Hazard: Blade Penetration & Fiber Cladding Nick (Fail)',
    badgeClass: 'badge-danger',
    color: '#dc2626',
    description: 'Blade penetration exceeded 100% of buffer tube wall thickness; physical contact with live primary coating or glass cladding induced severe loss/break.'
  },
  'FAILED_INSUFFICIENT_SHAVE': {
    id: 'FAILED_INSUFFICIENT_SHAVE',
    name: 'Critical Defect: Incomplete Tube Slit / Under-Score (Fail)',
    badgeClass: 'badge-danger',
    color: '#991b1b',
    description: 'Blade penetration is < 70% of wall thickness; tube cannot clamshell open without excessive hand-prying that crushes fibers.'
  },
  'FAILED_EXCESSIVE_BEND_RADIUS': {
    id: 'FAILED_EXCESSIVE_BEND_RADIUS',
    name: 'Critical Defect: Express Tube Slack Loop Violates Min Bend Radius (Fail)',
    badgeClass: 'badge-danger',
    color: '#b91c1c',
    description: 'Uncut express buffer tube stored in closure basket has curvature radius below minimum standard, causing acute macro-bending loss.'
  }
};

export const SHAH_TUBE_SLITTING_PRESETS = {
  'PRESET_BARADARI_EXPRESS_DROP': {
    id: 'PRESET_BARADARI_EXPRESS_DROP',
    name: 'Baradari Metro Trunk Feeder Mid-Span Branch (Tube #3 Orange Shaved)',
    customer: 'Shahdara Metro Ring-A Feeder',
    route: 'Baradari Chowk FOSC Dome Closure #04 (Mid-Span Tap)',
    toolId: 'PRECISION_MICROMETER_SLITTER',
    tubeTypeId: 'PBT_LOOSE_TUBE_2_5MM',
    bladeDepthMm: 0.35,
    shaveWindowLengthMm: 60.0,
    slackLoopRadiusMm: 45.0,
    isLiveTrafficOnTube: true,
    technicianName: 'Umair Lead OSP Splicer'
  },
  'PRESET_VANDALA_FAT_TAP': {
    id: 'PRESET_VANDALA_FAT_TAP',
    name: 'Vandala Road Aerial Closure Mid-Span Tap (Tube #1 Blue Shaved)',
    customer: 'Vandala Road Secondary FAT-02 Distribution',
    route: 'Vandala Road Pole #18 Aerial FOSC (Express Slack Tap)',
    toolId: 'LONGITUDINAL_PEELER',
    tubeTypeId: 'PBT_LOOSE_TUBE_2_0MM',
    bladeDepthMm: 0.30,
    shaveWindowLengthMm: 50.0,
    slackLoopRadiusMm: 38.0,
    isLiveTrafficOnTube: true,
    technicianName: 'Shahdara Fiber Lineworker'
  },
  'PRESET_BEGUM_KOT_HIGH_RISK_KNIFE': {
    id: 'PRESET_BEGUM_KOT_HIGH_RISK_KNIFE',
    name: 'Begum Kot Contractor Manual Knife Attempt (Severe Nick Hazard)',
    customer: 'Begum Kot Commercial Plaza Sub-FAT',
    route: 'Begum Kot Main GT Road Manhole Chamber',
    toolId: 'HANDHELD_FIELD_UTILITY',
    tubeTypeId: 'PBT_LOOSE_TUBE_2_0MM',
    bladeDepthMm: 0.42,
    shaveWindowLengthMm: 75.0,
    slackLoopRadiusMm: 28.0,
    isLiveTrafficOnTube: true,
    technicianName: 'Uncertified Field Contractor'
  },
  'PRESET_JIA_MUSA_CANAL_MICRO_TUBE': {
    id: 'PRESET_JIA_MUSA_CANAL_MICRO_TUBE',
    name: 'Jia Musa FTTH Microduct Mid-Span Shave (1.4mm Micro-Tube)',
    customer: 'Jia Musa Canal Road Subscriber Cluster',
    route: 'Jia Musa Canal Pedestal Closure #02',
    toolId: 'PRECISION_MICROMETER_SLITTER',
    tubeTypeId: 'MICRO_TUBE_1_4MM',
    bladeDepthMm: 0.19,
    shaveWindowLengthMm: 40.0,
    slackLoopRadiusMm: 32.0,
    isLiveTrafficOnTube: false,
    technicianName: 'Tariq Precision Fiber Tech'
  },
  'PRESET_RAVI_SIPHON_CENTRAL_TUBE': {
    id: 'PRESET_RAVI_SIPHON_CENTRAL_TUBE',
    name: 'Ravi Siphon Central Core Heavy Tube Slit (4.0mm Uni-Tube)',
    customer: 'Ravi Siphon North River Feeder Hub',
    route: 'Ravi Siphon Chamber 01 Trunk Closure',
    toolId: 'FIXED_BLADE_RING_CUTTER',
    tubeTypeId: 'CENTRAL_LOOSE_TUBE_4_0MM',
    bladeDepthMm: 0.52,
    shaveWindowLengthMm: 80.0,
    slackLoopRadiusMm: 65.0,
    isLiveTrafficOnTube: true,
    technicianName: 'Shahdara OSP Engineering Team'
  }
};

/**
 * Calculates buffer tube wall penetration percentage and remaining clearance to fiber bundle.
 * @param {number} bladeDepthMm
 * @param {number} tubeWallThicknessMm
 * @returns {{ penetrationPct: number, remainingClearanceMm: number, status: string }}
 */
export function calculateTubeSlitWallPenetration(bladeDepthMm, tubeWallThicknessMm) {
  const depth = Math.max(0.01, Number(bladeDepthMm) || 0.30);
  const wall = Math.max(0.05, Number(tubeWallThicknessMm) || 0.35);

  const penetrationPct = Math.round((depth / wall) * 1000) / 10;
  const remainingClearanceMm = Math.round((wall - depth) * 1000) / 1000;

  let status = 'OPTIMAL_SHAVE';
  if (penetrationPct > 100.0) {
    status = 'PENETRATION_FIBER_NICK';
  } else if (penetrationPct >= 93.0) {
    status = 'MARGINAL_HIGH_DEPTH';
  } else if (penetrationPct < 70.0) {
    status = 'INSUFFICIENT_UNDER_SCORE';
  }

  return {
    penetrationPct,
    remainingClearanceMm,
    status
  };
}

/**
 * Calculates induced optical transmission micro-scratch loss (dB).
 * @param {number} penetrationPct
 * @param {number} remainingClearanceMm
 * @param {string} toolId
 * @returns {number} induced loss in dB
 */
export function calculateInducedSlitLossDb(penetrationPct, remainingClearanceMm, toolId) {
  if (penetrationPct > 100.0 || remainingClearanceMm < 0) {
    // Direct blade contact with optical fiber
    const overcut = Math.abs(remainingClearanceMm);
    return Math.round((0.15 + overcut * 2.5) * 100) / 100;
  }
  if (toolId === 'HANDHELD_FIELD_UTILITY') {
    // Extreme uncalibrated razor blade chatter risk
    return Math.round((0.08 + Math.random() * 0.12) * 100) / 100;
  }
  if (penetrationPct >= 93.0) {
    return 0.03;
  }
  // Optimal clean shaving
  return 0.01;
}

/**
 * Evaluates comprehensive buffer tube mid-span access, slitting physics, and quality verdict.
 * @param {Object} params
 * @returns {Object} Comprehensive analysis and verdict
 */
export function evaluateTubeSlittingAccess(params = {}) {
  const tool = TUBE_SLITTER_TOOL_TYPES[params.toolId] || TUBE_SLITTER_TOOL_TYPES['PRECISION_MICROMETER_SLITTER'];
  const tube = BUFFER_TUBE_TYPES[params.tubeTypeId] || BUFFER_TUBE_TYPES['PBT_LOOSE_TUBE_2_5MM'];

  const bladeDepthMm = Math.max(0.01, Math.min(tool.maxBladeDepthMm, Number(params.bladeDepthMm) || 0.35));
  const shaveWindowLengthMm = Math.max(10.0, Number(params.shaveWindowLengthMm) || 50.0);
  const slackLoopRadiusMm = Math.max(10.0, Number(params.slackLoopRadiusMm) || 40.0);
  const isLiveTrafficOnTube = params.isLiveTrafficOnTube !== false;

  // 1. Wall penetration analysis
  const penetration = calculateTubeSlitWallPenetration(bladeDepthMm, tube.wallThicknessMm);

  // 2. Induced micro-bending / scratch loss
  const inducedLossDb = calculateInducedSlitLossDb(penetration.penetrationPct, penetration.remainingClearanceMm, tool.id);

  // 3. Slack loop bend radius compliance
  const minRadius = tube.minSlackBendRadiusMm;
  const bendRadiusRatio = Math.round((slackLoopRadiusMm / minRadius) * 100) / 100;
  const isBendRadiusCompliant = slackLoopRadiusMm >= minRadius;

  // 4. Deficiencies checklist
  const deficiencyList = [];
  if (penetration.penetrationPct > 100.0) {
    deficiencyList.push(`Blade depth (${bladeDepthMm}mm) penetrates beyond tube wall thickness (${tube.wallThicknessMm}mm); direct fiber nick hazard.`);
  } else if (penetration.penetrationPct < 70.0) {
    deficiencyList.push(`Blade depth (${bladeDepthMm}mm) is only ${penetration.penetrationPct}% of wall; tube cannot cleanly peel open.`);
  }

  if (tool.id === 'HANDHELD_FIELD_UTILITY') {
    deficiencyList.push('Uncalibrated utility knife used; high risk of manual slip and severed express fibers.');
  }

  if (!isBendRadiusCompliant) {
    deficiencyList.push(`Express tube slack bend radius (${slackLoopRadiusMm}mm) is below required minimum (${minRadius}mm).`);
  }

  // 5. Verdict selection
  let verdictKey = 'CERTIFIED_OPTIMAL_ACCESS';
  if (penetration.penetrationPct > 100.0 || inducedLossDb > 0.10) {
    verdictKey = 'FAILED_BLADE_FIBER_NICK';
  } else if (penetration.penetrationPct < 70.0) {
    verdictKey = 'FAILED_INSUFFICIENT_SHAVE';
  } else if (!isBendRadiusCompliant) {
    verdictKey = 'FAILED_EXCESSIVE_BEND_RADIUS';
  } else if (penetration.penetrationPct >= 93.0 || tool.id === 'HANDHELD_FIELD_UTILITY') {
    verdictKey = 'CONDITIONAL_PASS_CARE_REQUIRED';
  }

  const verdict = TUBE_SLITTING_VERDICTS[verdictKey];

  return {
    tool,
    tube,
    bladeDepthMm,
    shaveWindowLengthMm,
    slackLoopRadiusMm,
    isLiveTrafficOnTube,
    penetration,
    inducedLossDb,
    bendRadiusRatio,
    isBendRadiusCompliant,
    deficiencyList,
    verdict,
    testedAt: new Date().toISOString()
  };
}

/**
 * Validates form inputs for Mid-Span Tube Slitting & Shaving QA Suite.
 * @param {Object} input
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTubeSlittingInput(input = {}) {
  const errors = [];

  if (!input.customer || !String(input.customer).trim()) {
    errors.push('Subscriber name or feeder route owner is required.');
  }

  if (!input.route || !String(input.route).trim()) {
    errors.push('FOSC enclosure ID or mid-span tap location is required.');
  }

  const depth = Number(input.bladeDepthMm);
  if (isNaN(depth) || depth < 0.05 || depth > 5.0) {
    errors.push('Slitter blade depth must be between 0.05 and 5.0 mm.');
  }

  const win = Number(input.shaveWindowLengthMm);
  if (isNaN(win) || win < 10.0 || win > 300.0) {
    errors.push('Shave window length must be between 10 and 300 mm.');
  }

  const radius = Number(input.slackLoopRadiusMm);
  if (isNaN(radius) || radius < 5.0 || radius > 200.0) {
    errors.push('Slack loop storage bend radius must be between 5 and 200 mm.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Builds an immutable certificate record with official identifier format SLT-YYYYMM-XXXX.
 * @param {Object} input
 * @param {Object} [analysisResult]
 * @returns {Object} Immutable QA certificate record
 */
export function buildTubeSlittingCertRecord(input = {}, analysisResult = null) {
  const analysis = analysisResult || evaluateTubeSlittingAccess(input);
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const certId = input.certId || `SLT-${yearMonth}-${randomSuffix}`;

  return {
    certId,
    customer: String(input.customer || 'Shahdara Network Feeder').trim(),
    route: String(input.route || 'Mid-Span Tap Closure').trim(),
    technicianName: String(input.technicianName || 'Shahdara OSP Splicer').trim(),
    toolId: analysis.tool.id,
    tubeTypeId: analysis.tube.id,
    bladeDepthMm: analysis.bladeDepthMm,
    shaveWindowLengthMm: analysis.shaveWindowLengthMm,
    slackLoopRadiusMm: analysis.slackLoopRadiusMm,
    isLiveTrafficOnTube: analysis.isLiveTrafficOnTube,
    analysis,
    status: analysis.verdict.id === 'CERTIFIED_OPTIMAL_ACCESS' ? 'VERIFIED' : 'ACTION_REQUIRED',
    createdAt: now.toISOString()
  };
}

let inMemorySlittingCerts = [];

/**
 * Retrieves saved Tube Slitting certificates from LocalStorage or in-memory fallback.
 * @param {Object} [state]
 * @returns {Array} list of certificate records
 */
export function getSavedTubeSlittingCerts(state = {}) {
  if (state && typeof state === 'object' && Array.isArray(state.tubeSlittingCerts)) {
    return state.tubeSlittingCerts;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(TUBE_SLITTING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      // fallback
    }
  }
  return inMemorySlittingCerts;
}

/**
 * Saves a Tube Slitting certificate record to LocalStorage (FIFO capacity: 100 records).
 * @param {Object} record
 * @param {Object} [state]
 * @returns {Array} updated certificates list
 */
export function saveTubeSlittingCert(record, state = {}) {
  const current = getSavedTubeSlittingCerts(state);
  const filtered = current.filter(c => c.certId !== record.certId);
  filtered.unshift(record);
  if (filtered.length > 100) {
    filtered.pop();
  }
  inMemorySlittingCerts = filtered;
  if (state && typeof state === 'object') {
    state.tubeSlittingCerts = filtered;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(TUBE_SLITTING_STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      // fallback
    }
  }
  return filtered;
}

/**
 * Updates status of an existing certificate (VERIFIED, RESOLVED, ACTION_REQUIRED).
 * @param {string} certId
 * @param {string} newStatus
 * @param {Object} [state]
 * @returns {Array} updated certificates list
 */
export function updateTubeSlittingCertStatus(certId, newStatus, state = {}) {
  const current = getSavedTubeSlittingCerts(state);
  const item = current.find(c => c.certId === certId);
  if (item) {
    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
  }
  inMemorySlittingCerts = current;
  if (state && typeof state === 'object') {
    state.tubeSlittingCerts = current;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(TUBE_SLITTING_STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      // fallback
    }
  }
  return current;
}

/**
 * Clears all saved Tube Slitting certificates from LocalStorage and in-memory.
 * @param {Object} [state]
 */
export function clearTubeSlittingCerts(state = {}) {
  inMemorySlittingCerts = [];
  if (state && typeof state === 'object') {
    state.tubeSlittingCerts = [];
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(TUBE_SLITTING_STORAGE_KEY);
    } catch (e) {
      // fallback
    }
  }
  return [];
}

/**
 * Calculates summary KPI metrics across saved Tube Slitting certificates.
 * @param {Array} records
 * @returns {Object} aggregated metrics
 */
export function calculateTubeSlittingMetrics(records = []) {
  const list = Array.isArray(records) ? records : [];
  const total = list.length;
  let certified = 0;
  let conditional = 0;
  let failed = 0;
  let totalLiveTaps = 0;
  let maxInducedLossSeen = 0;

  list.forEach(r => {
    const vId = r.analysis?.verdict?.id;
    if (vId === 'CERTIFIED_OPTIMAL_ACCESS') certified++;
    else if (vId === 'CONDITIONAL_PASS_CARE_REQUIRED') conditional++;
    else failed++;

    if (r.isLiveTrafficOnTube) totalLiveTaps++;

    const l = Number(r.analysis?.inducedLossDb) || 0;
    if (l > maxInducedLossSeen) maxInducedLossSeen = l;
  });

  const passRatePct = total > 0 ? Math.round(((certified + conditional) / total) * 100) : 100;

  return {
    total,
    certified,
    conditional,
    failed,
    passRatePct,
    totalLiveTaps,
    maxInducedLossSeen
  };
}

/**
 * Pure-vector SVG visualizer displaying mid-span jacket window, buffer tube entry into slitter guide,
 * precision micrometer blade dial, peeled tube shavings, primary coated optical fiber core, and telemetry HUD.
 * @param {Object} recordOrAnalysis
 * @returns {string} SVG markup string
 */
export function renderTubeSlittingAccessSvg(recordOrAnalysis = {}) {
  const analysis = recordOrAnalysis.analysis || recordOrAnalysis;
  const {
    tool,
    tube,
    bladeDepthMm,
    shaveWindowLengthMm,
    slackLoopRadiusMm,
    penetration,
    inducedLossDb,
    isBendRadiusCompliant,
    isLiveTrafficOnTube,
    verdict
  } = analysis;

  const w = 780;
  const h = 330;
  const statusColor = verdict.color || '#16a34a';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="auto" class="tube-slitting-access-svg" style="background:#090d16; border-radius:8px; font-family:system-ui,-apple-system,sans-serif;">
      <defs>
        <linearGradient id="jacketPeelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
        <linearGradient id="pbtTubeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b" />
          <stop offset="50%" stop-color="#fbbf24" />
          <stop offset="100%" stop-color="#d97706" />
        </linearGradient>
        <linearGradient id="toolSteelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#64748b" />
          <stop offset="50%" stop-color="#94a3b8" />
          <stop offset="100%" stop-color="#475569" />
        </linearGradient>
        <marker id="toolArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
        </marker>
      </defs>

      <!-- Background Grid -->
      <g stroke="#1e293b" stroke-width="0.8" opacity="0.6">
        <line x1="30" y1="50" x2="750" y2="50" />
        <line x1="30" y1="110" x2="750" y2="110" />
        <line x1="30" y1="170" x2="750" y2="170" />
        <line x1="30" y1="230" x2="750" y2="230" />
        <line x1="30" y1="290" x2="750" y2="290" />
      </g>

      <!-- Main Section 1: Mid-Span Cable Jacket Peel Window (X: 30 to 410) -->
      <!-- Left Uncut Cable Jacket -->
      <rect x="30" y="125" width="55" height="50" rx="4" fill="url(#jacketPeelGrad)" stroke="#64748b" stroke-width="1.5" />
      <text x="57" y="154" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">PEEL END</text>

      <!-- Right Uncut Cable Jacket -->
      <rect x="355" y="125" width="55" height="50" rx="4" fill="url(#jacketPeelGrad)" stroke="#64748b" stroke-width="1.5" />
      <text x="382" y="154" fill="#94a3b8" font-size="8" font-weight="700" text-anchor="middle">EXPRESS</text>

      <!-- Mid-Span Window Bracket Marker -->
      <line x1="85" y1="105" x2="355" y2="105" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,3" />
      <line x1="85" y1="100" x2="85" y2="110" stroke="#38bdf8" stroke-width="1.5" />
      <line x1="355" y1="100" x2="355" y2="110" stroke="#38bdf8" stroke-width="1.5" />
      <text x="220" y="98" fill="#38bdf8" font-size="9" font-weight="700" text-anchor="middle">
        MID-SPAN ACCESS WINDOW: ${shaveWindowLengthMm} mm
      </text>

      <!-- Exposed Central PBT Buffer Tube (Continuous Express Path) -->
      <rect x="85" y="137" width="270" height="26" rx="4" fill="url(#pbtTubeGrad)" stroke="#b45309" stroke-width="1.5" />

      <!-- Shaved Window revealing 250μm Optical Fibers (X: 180 to 280) -->
      <rect x="180" y="140" width="100" height="20" rx="3" fill="#0f172a" stroke="#38bdf8" stroke-width="1.2" />

      <!-- Multi-color 250μm Primary-Coated Optical Fibers (Blue, Orange, Green, Brown) -->
      <line x1="180" y1="144" x2="280" y2="144" stroke="#0284c7" stroke-width="2" />
      <line x1="180" y1="148" x2="280" y2="148" stroke="#f97316" stroke-width="2" />
      <line x1="180" y1="152" x2="280" y2="152" stroke="#16a34a" stroke-width="2" />
      <line x1="180" y1="156" x2="280" y2="156" stroke="#854d0e" stroke-width="2" />

      <!-- Precision Shaving Tool Caliper Body overlaying Tube -->
      <g transform="translate(170, 70)">
        <!-- Tool Caliper Frame -->
        <rect x="0" y="0" width="55" height="50" rx="4" fill="url(#toolSteelGrad)" stroke="#cbd5e1" stroke-width="1.5" />
        <!-- Micrometer Dial Knob -->
        <circle cx="27" cy="18" r="12" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5" />
        <line x1="27" y1="18" x2="33" y2="12" stroke="#ef4444" stroke-width="1.5" />
        <text x="27" y="21" fill="#f8fafc" font-size="6.5" font-weight="800" text-anchor="middle">${bladeDepthMm}mm</text>
        <text x="27" y="42" fill="#0f172a" font-size="7" font-weight="800" text-anchor="middle">BLADE</text>

        <!-- Downward Razor Blade Point -->
        <polygon points="24,50 30,50 27,67" fill="#ef4444" stroke="#991b1b" stroke-width="1" />
      </g>

      <!-- Blade Depth & Penetration Annotation -->
      <line x1="202" y1="168" x2="202" y2="195" stroke="#f59e0b" stroke-width="1.5" />
      <text x="202" y="206" fill="#fbbf24" font-size="8" font-weight="700" text-anchor="middle">
        Blade Depth: ${bladeDepthMm}mm (${penetration.penetrationPct}% of wall)
      </text>

      <!-- Express Slack Loop Storage in Closure Tray (X: 30 to 410, Y: 220 to 310) -->
      <g transform="translate(30, 225)">
        <rect x="0" y="0" width="380" height="85" rx="6" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
        <text x="12" y="18" fill="#38bdf8" font-size="9" font-weight="700">EXPRESS TUBE SLACK STORAGE METROLOGY</text>

        <!-- Slack Loop Curvature Arc Visual -->
        <path d="M 12 55 C 60 25, 100 25, 140 55" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4,2" />
        <text x="76" y="70" fill="#94a3b8" font-size="8" text-anchor="middle">Curvature Radius: ${slackLoopRadiusMm} mm</text>

        <text x="170" y="38" fill="#94a3b8" font-size="8.5">Min Allowed Radius: <tspan fill="#f8fafc" font-weight="700">${tube.minSlackBendRadiusMm} mm</tspan></text>
        <text x="170" y="52" fill="#94a3b8" font-size="8.5">Bend Ratio: <tspan fill="${isBendRadiusCompliant ? '#10b981' : '#ef4444'}" font-weight="700">${analysis.bendRadiusRatio}x</tspan> (${isBendRadiusCompliant ? 'COMPLIANT' : 'MACRO-BEND RISK'})</text>
        <text x="170" y="66" fill="#94a3b8" font-size="8.5">Traffic State: <tspan fill="${isLiveTrafficOnTube ? '#38bdf8' : '#94a3b8'}" font-weight="700">${isLiveTrafficOnTube ? 'LIVE EXPRESS TRAFFIC' : 'DARK FIBER / UNLIT'}</tspan></text>
      </g>

      <!-- Right Side Engineering Metrology Panel (X: 430 to 760) -->
      <g transform="translate(430, 40)">
        <rect x="0" y="0" width="320" height="270" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" />
        <text x="16" y="24" fill="#38bdf8" font-size="11" font-weight="800">
          MID-SPAN ACCESS METROLOGY HUD
        </text>
        <line x1="16" y1="34" x2="304" y2="34" stroke="#334155" stroke-width="1" />

        <!-- Parameter 1: Blade Shave Penetration -->
        <text x="16" y="56" fill="#94a3b8" font-size="9.5">Tube Wall Thickness:</text>
        <text x="304" y="56" fill="#f8fafc" font-size="11" font-weight="700" text-anchor="end">
          ${tube.wallThicknessMm} mm
        </text>
        <text x="16" y="70" fill="#64748b" font-size="8.5">Blade Depth: ${bladeDepthMm}mm · Penetration: ${penetration.penetrationPct}%</text>

        <!-- Parameter 2: Remaining Fiber Clearance -->
        <text x="16" y="94" fill="#94a3b8" font-size="9.5">Clearance to Live Fibers:</text>
        <text x="304" y="94" fill="${penetration.remainingClearanceMm >= 0.02 ? '#10b981' : '#ef4444'}" font-size="11" font-weight="800" text-anchor="end">
          ${penetration.remainingClearanceMm} mm
        </text>
        <text x="16" y="108" fill="#64748b" font-size="8.5">Safety Buffer: 0.02mm minimum standard</text>

        <!-- Parameter 3: Induced Scratch Loss -->
        <text x="16" y="132" fill="#94a3b8" font-size="9.5">Induced Optical Attenuation:</text>
        <text x="304" y="132" fill="${inducedLossDb <= 0.03 ? '#10b981' : inducedLossDb <= 0.08 ? '#f59e0b' : '#ef4444'}" font-size="11" font-weight="800" text-anchor="end">
          ${inducedLossDb} dB
        </text>
        <text x="16" y="146" fill="#64748b" font-size="8.5">Limit: ≤ 0.05 dB live transmission (IEC 60794-1-21 E19)</text>

        <!-- Parameter 4: Shaving Tool Model -->
        <text x="16" y="170" fill="#94a3b8" font-size="9.5">Shaving Tool Calibration:</text>
        <text x="304" y="170" fill="#f8fafc" font-size="10.5" font-weight="700" text-anchor="end">
          ${tool.category}
        </text>
        <text x="16" y="184" fill="#64748b" font-size="8.5">Blade Accuracy: ±${tool.bladeDepthAccuracyMm} mm</text>

        <!-- Parameter 5: Slack Storage Bend -->
        <text x="16" y="208" fill="#94a3b8" font-size="9.5">Closure Tray Slack Storage:</text>
        <text x="304" y="208" fill="${isBendRadiusCompliant ? '#10b981' : '#ef4444'}" font-size="11" font-weight="700" text-anchor="end">
          R=${slackLoopRadiusMm} mm
        </text>
        <text x="16" y="222" fill="#64748b" font-size="8.5">Min Radius: ${tube.minSlackBendRadiusMm} mm (${isBendRadiusCompliant ? 'PASS' : 'FAIL'})</text>

        <!-- Status Box -->
        <rect x="16" y="234" width="288" height="26" rx="4" fill="#1e293b" stroke="${statusColor}" stroke-width="1.2" />
        <circle cx="28" cy="247" r="4.5" fill="${statusColor}" />
        <text x="40" y="251" fill="#f8fafc" font-size="9" font-weight="800">
          ${verdict.name}
        </text>
      </g>
    </svg>
  `;
}

/**
 * Generates dual printable documents:
 * 1. Standard A4 Formal Outside Plant Mid-Span Accreditation Certificate
 * 2. 80mm POS field technician thermal slip
 * @param {Object} record
 * @param {{ format?: string }} [options]
 * @returns {string} HTML string
 */
export function generateTubeSlittingCertHtml(record, options = {}) {
  const analysis = record.analysis || evaluateTubeSlittingAccess(record);
  const isThermal = options.format === 'thermal';
  const certId = record.certId || 'SLT-202610-0001';
  const statusColor = analysis.verdict.color || '#16a34a';

  if (isThermal) {
    return `
      <div class="pos-thermal-slip" style="width: 280px; font-family: monospace; font-size: 11px; line-height: 1.35; padding: 10px; background: #fff; color: #000;">
        <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 14px; font-weight: 900;">SHAHDARA FIBER NETWORK</h2>
          <p style="margin: 2px 0; font-size: 10px;">MID-SPAN TUBE SLITTING &amp; SHAVING QA</p>
          <p style="margin: 0; font-size: 9px;">IEC 60794-1-21 E19 / GR-20-CORE</p>
        </div>
        <div style="margin-bottom: 8px;">
          <div><b>CERT ID:</b> ${certId}</div>
          <div><b>DATE:</b> ${record.createdAt ? record.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}</div>
          <div><b>TECH:</b> ${record.technicianName || 'Lineworker'}</div>
          <div><b>ROUTE:</b> ${record.route || 'FOSC Mid-Span'}</div>
        </div>
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 8px;">
          <div><b>TUBE WALL:</b> ${analysis.tube.wallThicknessMm} mm</div>
          <div><b>BLADE DEPTH:</b> ${analysis.bladeDepthMm} mm (${analysis.penetration.penetrationPct}%)</div>
          <div><b>FIBER CLEARANCE:</b> ${analysis.penetration.remainingClearanceMm} mm</div>
          <div><b>INDUCED LOSS:</b> ${analysis.inducedLossDb} dB</div>
          <div><b>SLACK RADIUS:</b> ${analysis.slackLoopRadiusMm} mm (Min: ${analysis.tube.minSlackBendRadiusMm}mm)</div>
          <div><b>LIVE TRAFFIC:</b> ${analysis.isLiveTrafficOnTube ? 'YES (Live Express)' : 'NO (Dark Fiber)'}</div>
        </div>
        <div style="text-align: center; font-weight: 900; font-size: 12px; margin-bottom: 8px;">
          VERDICT: ${analysis.verdict.name}
        </div>
        <div style="font-size: 9px; text-align: center; border-top: 1px dashed #000; padding-top: 6px;">
          Sign: ____________________<br>
          NOC Shahdara Fiber Operations
        </div>
      </div>
    `;
  }

  // Formal A4 Certificate
  return `
    <div class="a4-certificate-container" style="max-width: 800px; margin: 0 auto; padding: 32px; background: #fff; color: #0f172a; font-family: system-ui, -apple-system, sans-serif; border: 1px solid #cbd5e1; border-radius: 8px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px;">
            SHAHDARA FIBER NETWORK OPERATIONS
          </h1>
          <p style="margin: 2px 0 0; font-size: 13px; font-weight: 700; color: #475569;">
            Outside Plant Fiber Cable Mid-Span Tube Ring-Cut &amp; Shaving QA Certificate
          </p>
          <p style="margin: 2px 0 0; font-size: 10.5px; color: #64748b;">
            Standards: IEC 60794-1-21 Method E19 · Telcordia GR-20-CORE Issue 4 · ITU-T L.400 / L.12
          </p>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; padding: 4px 10px; background: #f0f9ff; border: 1px solid #0284c7; border-radius: 4px; font-size: 11px; font-weight: 800; color: #0284c7;">
            ${certId}
          </div>
          <p style="margin: 4px 0 0; font-size: 10px; color: #64748b;">
            Date: ${record.createdAt ? record.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
          </p>
        </div>
      </div>

      <!-- Project Metadata Grid -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 20px; font-size: 11.5px;">
        <div><b>Subscriber / Feeder Owner:</b> ${record.customer || 'Shahdara Network Feeder'}</div>
        <div><b>FOSC Enclosure / Mid-Span Location:</b> ${record.route || 'Mid-Span Tap'}</div>
        <div><b>Buffer Tube Specification:</b> ${analysis.tube.name}</div>
        <div><b>Shaving Tool Model:</b> ${analysis.tool.name}</div>
        <div><b>Shave Window Length:</b> ${analysis.shaveWindowLengthMm} mm</div>
        <div><b>Certified Splicer / Tech:</b> ${record.technicianName || 'Shahdara Splicer'}</div>
      </div>

      <!-- Metrology Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11.5px;">
        <thead>
          <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
            <th style="padding: 8px 10px;">Engineering Parameter</th>
            <th style="padding: 8px 10px;">Measured / Applied</th>
            <th style="padding: 8px 10px;">Standard / Design Limit</th>
            <th style="padding: 8px 10px;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Buffer Tube Wall Thickness</b></td>
            <td style="padding: 8px 10px;">${analysis.tube.wallThicknessMm} mm</td>
            <td style="padding: 8px 10px;">Outer Diameter: ${analysis.tube.outerDiameterMm} mm</td>
            <td style="padding: 8px 10px; font-weight: 700; color: #16a34a;">NOMINAL PBT</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Shaving Blade Depth &amp; Penetration</b></td>
            <td style="padding: 8px 10px;">${analysis.bladeDepthMm} mm (${analysis.penetration.penetrationPct}%)</td>
            <td style="padding: 8px 10px;">80% – 92% of wall (≤ 95% max)</td>
            <td style="padding: 8px 10px; font-weight: 700; color: ${analysis.penetration.penetrationPct <= 92 ? '#16a34a' : analysis.penetration.penetrationPct <= 98 ? '#d97706' : '#dc2626'};">
              ${analysis.penetration.status}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Clearance to Live Optical Fibers</b></td>
            <td style="padding: 8px 10px;">${analysis.penetration.remainingClearanceMm} mm</td>
            <td style="padding: 8px 10px;">≥ 0.02 mm safety buffer</td>
            <td style="padding: 8px 10px; font-weight: 700; color: ${analysis.penetration.remainingClearanceMm >= 0.02 ? '#16a34a' : '#dc2626'};">
              ${analysis.penetration.remainingClearanceMm >= 0.02 ? 'CLEARANCE SAFE' : 'BLADE NICK HAZARD'}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Induced Optical Attenuation</b></td>
            <td style="padding: 8px 10px;">${analysis.inducedLossDb} dB</td>
            <td style="padding: 8px 10px;">≤ 0.05 dB live transmission</td>
            <td style="padding: 8px 10px; font-weight: 700; color: ${analysis.inducedLossDb <= 0.05 ? '#16a34a' : '#dc2626'};">
              ${analysis.inducedLossDb <= 0.05 ? 'NO DETECTABLE SCRATCH' : 'ATTENUATION REJECT'}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px;"><b>Closure Slack Loop Bend Radius</b></td>
            <td style="padding: 8px 10px;">${analysis.slackLoopRadiusMm} mm</td>
            <td style="padding: 8px 10px;">Min Allowed: ${analysis.tube.minSlackBendRadiusMm} mm</td>
            <td style="padding: 8px 10px; font-weight: 700; color: ${analysis.isBendRadiusCompliant ? '#16a34a' : '#dc2626'};">
              ${analysis.isBendRadiusCompliant ? 'COMPLIANT SLACK' : 'MACRO-BEND VIOLATION'}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 10px;"><b>Service Continuity on Express Fibers</b></td>
            <td style="padding: 8px 10px;">${analysis.isLiveTrafficOnTube ? 'Active Live Traffic' : 'Dark Express Fiber'}</td>
            <td style="padding: 8px 10px;">Zero Interruption Mandated</td>
            <td style="padding: 8px 10px; font-weight: 700; color: #16a34a;">PROTECTED</td>
          </tr>
        </tbody>
      </table>

      <!-- Verdict Banner -->
      <div style="background: #f8fafc; border-left: 4px solid ${statusColor}; border-radius: 4px; padding: 12px; margin-bottom: 24px;">
        <h3 style="margin: 0; font-size: 13px; font-weight: 800; color: ${statusColor};">
          QA VERDICT: ${analysis.verdict.name}
        </h3>
        <p style="margin: 4px 0 0; font-size: 11px; color: #475569;">
          ${analysis.verdict.description}
        </p>
      </div>

      <!-- Sign-off Footer -->
      <div style="display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; border-top: 1px solid #cbd5e1; font-size: 10.5px;">
        <div>
          <b>Outside Plant Fiber Splicer:</b><br><br>
          ________________________________________<br>
          Sign &amp; Stamp
        </div>
        <div style="text-align: right;">
          <b>NOC Quality Assurance Engineer:</b><br><br>
          ________________________________________<br>
          Authorized Engineering Approval
        </div>
      </div>
    </div>
  `;
}

/**
 * Formats a bilingual English & Urdu WhatsApp notification for lineworkers and splicers.
 * @param {Object} record
 * @returns {string} WhatsApp notification text
 */
export function formatTubeSlittingCertWhatsApp(record) {
  const analysis = record.analysis || evaluateTubeSlittingAccess(record);
  const certId = record.certId || 'SLT-202610-0001';

  return `*SHAHDARA FIBER NETWORK — OSP MID-SPAN TUBE SLITTING & SHAVING QA* ✂️
_شہدرہ آپٹیکل فائبر نیٹ ورک — مڈ اسپین بفر ٹیوب شیوونگ و رسائی سرٹیفکیٹ_

*Certificate ID:* ${certId}
*Date / تاریخ:* ${record.createdAt ? record.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)}
*Feeder / Trunk:* ${record.customer || 'Shahdara Network Feeder'}
*Closure Location:* ${record.route || 'Mid-Span Tap'}
*Splicer / لیڈ اسپلسر:* ${record.technicianName || 'Shahdara Splicer'}

*SHAVING & ACCESS METRICS / مڈ اسپین پیرامیٹرز:*
• Buffer Tube: ${analysis.tube.name}
• Shaving Tool: ${analysis.tool.name}
• Tube Wall: ${analysis.tube.wallThicknessMm} mm
• Blade Depth: ${analysis.bladeDepthMm} mm (${analysis.penetration.penetrationPct}% penetration)
• Fiber Clearance: ${analysis.penetration.remainingClearanceMm} mm (${analysis.penetration.status})
• Induced Loss: ${analysis.inducedLossDb} dB (IEC E19 limit ≤ 0.05 dB)
• Slack Loop Radius: ${analysis.slackLoopRadiusMm} mm (Min: ${analysis.tube.minSlackBendRadiusMm} mm)
• Live Traffic State: ${analysis.isLiveTrafficOnTube ? 'LIVE EXPRESS CONTINUOUS' : 'DARK FIBER'}

*QA VERDICT / حتمی نتیجہ:*
${analysis.verdict.name}
${analysis.verdict.description}

_Official NOC Outside Plant Civil & Splicing Record (IEC 60794-1-21 Method E19 / Telcordia GR-20-CORE)._`;
}

/**
 * Generates an RFC-4180 compliant CSV export with UTF-8 BOM.
 * @param {Array} records
 * @returns {string} CSV content
 */
export function generateTubeSlittingCertsCsv(records = []) {
  const headers = [
    'Certificate ID',
    'Date',
    'Customer / Route Owner',
    'Closure / Mid-Span Location',
    'Technician',
    'Tool Model',
    'Buffer Tube Type',
    'Wall Thickness (mm)',
    'Blade Depth (mm)',
    'Penetration (%)',
    'Fiber Clearance (mm)',
    'Induced Loss (dB)',
    'Slack Radius (mm)',
    'Live Traffic',
    'Verdict'
  ];

  const rows = (Array.isArray(records) ? records : []).map(r => {
    const a = r.analysis || {};
    return [
      r.certId || '',
      r.createdAt ? r.createdAt.slice(0, 10) : '',
      `"${String(r.customer || '').replace(/"/g, '""')}"`,
      `"${String(r.route || '').replace(/"/g, '""')}"`,
      `"${String(r.technicianName || '').replace(/"/g, '""')}"`,
      a.tool?.id || '',
      a.tube?.id || '',
      a.tube?.wallThicknessMm || 0,
      a.bladeDepthMm || 0,
      a.penetration?.penetrationPct || 0,
      a.penetration?.remainingClearanceMm || 0,
      a.inducedLossDb || 0,
      a.slackLoopRadiusMm || 0,
      a.isLiveTrafficOnTube ? 'LIVE' : 'DARK',
      `"${String(a.verdict?.name || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Sets up and wires the Mid-Span Tube Slitting & Shaving QA Modal Dialog UI controller.
 * @param {Object} options
 * @returns {Object} modal controller methods
 */
export function setupTubeSlittingAccessModal(options = {}) {
  const {
    state,
    dialogElement,
    triggerButton,
    onToast
  } = options;

  if (!dialogElement) return null;

  const presetSelect = dialogElement.querySelector('#slittingPresetSelect');
  const custInput = dialogElement.querySelector('#slittingCustInput');
  const routeInput = dialogElement.querySelector('#slittingRouteInput');
  const techInput = dialogElement.querySelector('#slittingTechInput');
  const toolSelect = dialogElement.querySelector('#slittingToolSelect');
  const tubeSelect = dialogElement.querySelector('#slittingTubeSelect');
  const depthInput = dialogElement.querySelector('#slittingDepthInput');
  const windowInput = dialogElement.querySelector('#slittingWindowInput');
  const radiusInput = dialogElement.querySelector('#slittingRadiusInput');
  const liveCheckbox = dialogElement.querySelector('#slittingLiveCheckbox');

  const kpiRibbon = dialogElement.querySelector('#slittingKpiRibbon');
  const svgContainer = dialogElement.querySelector('#slittingSvgContainer');
  const tableBody = dialogElement.querySelector('#slittingHistoryTableBody');
  const searchInput = dialogElement.querySelector('#slittingSearchInput');

  const saveBtn = dialogElement.querySelector('#slittingSaveCertBtn');
  const printA4Btn = dialogElement.querySelector('#slittingPrintA4Btn');
  const printThermalBtn = dialogElement.querySelector('#slittingPrintThermalBtn');
  const copyWhatsAppBtn = dialogElement.querySelector('#slittingCopyWhatsAppBtn');
  const exportCsvBtn = dialogElement.querySelector('#slittingExportCsvBtn');
  const closeBtn = dialogElement.querySelector('#tubeSlittingCloseBtn');

  function getFormValues() {
    return {
      customer: custInput ? custInput.value : 'Shahdara Network Feeder',
      route: routeInput ? routeInput.value : 'FOSC Mid-Span Tap',
      technicianName: techInput ? techInput.value : 'Shahdara OSP Splicer',
      toolId: toolSelect ? toolSelect.value : 'PRECISION_MICROMETER_SLITTER',
      tubeTypeId: tubeSelect ? tubeSelect.value : 'PBT_LOOSE_TUBE_2_5MM',
      bladeDepthMm: depthInput ? Number(depthInput.value) : 0.35,
      shaveWindowLengthMm: windowInput ? Number(windowInput.value) : 60,
      slackLoopRadiusMm: radiusInput ? Number(radiusInput.value) : 45,
      isLiveTrafficOnTube: liveCheckbox ? liveCheckbox.checked : true
    };
  }

  function updatePreview() {
    const values = getFormValues();
    const analysis = evaluateTubeSlittingAccess(values);

    // Update KPI Ribbon
    if (kpiRibbon) {
      kpiRibbon.innerHTML = `
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Wall Penetration</div>
          <div style="font-size:15px; font-weight:800; color:${analysis.penetration.penetrationPct <= 92 ? '#10b981' : analysis.penetration.penetrationPct <= 98 ? '#f59e0b' : '#ef4444'};">${analysis.penetration.penetrationPct}%</div>
          <div style="font-size:9px; color:#64748b;">${analysis.bladeDepthMm}mm / ${analysis.tube.wallThicknessMm}mm</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Fiber Clearance</div>
          <div style="font-size:15px; font-weight:800; color:${analysis.penetration.remainingClearanceMm >= 0.02 ? '#10b981' : '#ef4444'};">${analysis.penetration.remainingClearanceMm} mm</div>
          <div style="font-size:9px; color:#64748b;">${analysis.penetration.status}</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Induced Loss</div>
          <div style="font-size:15px; font-weight:800; color:${analysis.inducedLossDb <= 0.03 ? '#10b981' : analysis.inducedLossDb <= 0.08 ? '#f59e0b' : '#ef4444'};">${analysis.inducedLossDb} dB</div>
          <div style="font-size:9px; color:#64748b;">Limit: ≤ 0.05 dB</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Slack Bend Ratio</div>
          <div style="font-size:15px; font-weight:800; color:${analysis.isBendRadiusCompliant ? '#10b981' : '#ef4444'};">${analysis.bendRadiusRatio}x</div>
          <div style="font-size:9px; color:#64748b;">R=${analysis.slackLoopRadiusMm}mm (Min: ${analysis.tube.minSlackBendRadiusMm}mm)</div>
        </div>
        <div style="background:#0f172a; border:1px solid #1e293b; border-radius:6px; padding:8px 10px; text-align:center;">
          <div style="font-size:9.5px; color:#94a3b8; text-transform:uppercase;">Traffic State</div>
          <div style="font-size:15px; font-weight:800; color:#38bdf8;">${analysis.isLiveTrafficOnTube ? 'LIVE' : 'DARK'}</div>
          <div style="font-size:9px; color:#64748b;">${analysis.tube.fiberCapacity} Cores Max</div>
        </div>
      `;
    }

    // Update SVG
    if (svgContainer) {
      svgContainer.innerHTML = renderTubeSlittingAccessSvg(analysis);
    }
  }

  function renderHistoryTable() {
    if (!tableBody) return;
    const certs = getSavedTubeSlittingCerts(state);
    const filter = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const matching = certs.filter(c => {
      if (!filter) return true;
      return (
        (c.certId && c.certId.toLowerCase().includes(filter)) ||
        (c.customer && c.customer.toLowerCase().includes(filter)) ||
        (c.route && c.route.toLowerCase().includes(filter)) ||
        (c.technicianName && c.technicianName.toLowerCase().includes(filter))
      );
    });

    if (matching.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:16px; color:#64748b;">No tube slitting QA certificates found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = matching.map(c => {
      const a = c.analysis || {};
      const statusColor = a.verdict?.color || '#16a34a';
      return `
        <tr style="border-bottom: 1px solid #1e293b;">
          <td style="padding: 6px 8px; font-weight: 700; color: #38bdf8;">${c.certId}</td>
          <td style="padding: 6px 8px;">${c.createdAt ? c.createdAt.slice(0, 10) : '-'}</td>
          <td style="padding: 6px 8px;">${c.customer || '-'}<br><small style="color:#64748b;">${c.route || ''}</small></td>
          <td style="padding: 6px 8px;">${a.bladeDepthMm || 0}mm (${a.penetration?.penetrationPct || 0}%)<br><small style="color:#94a3b8;">Clr: ${a.penetration?.remainingClearanceMm || 0}mm</small></td>
          <td style="padding: 6px 8px;">${a.inducedLossDb || 0} dB<br><small style="color:${a.isLiveTrafficOnTube ? '#38bdf8' : '#94a3b8'};">${a.isLiveTrafficOnTube ? 'Live Tap' : 'Dark'}</small></td>
          <td style="padding: 6px 8px; font-weight: 700; color: ${statusColor};">${a.verdict?.name ? a.verdict.name.split(' (')[0] : 'VERIFIED'}</td>
          <td style="padding: 6px 8px;">
            <button class="secondary-button" type="button" style="padding: 2px 6px; font-size: 10px;" data-print-a4-id="${c.certId}">🖨️ A4</button>
            <button class="secondary-button" type="button" style="padding: 2px 6px; font-size: 10px;" data-print-pos-id="${c.certId}">🧾 POS</button>
            <button class="secondary-button" type="button" style="padding: 2px 6px; font-size: 10px;" data-wa-id="${c.certId}">💬 WA</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row button triggers
    tableBody.querySelectorAll('[data-print-a4-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-print-a4-id');
        const item = certs.find(c => c.certId === id);
        if (item) {
          const html = generateTubeSlittingCertHtml(item, { format: 'a4' });
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => w.print(), 250);
          }
        }
      });
    });

    tableBody.querySelectorAll('[data-print-pos-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-print-pos-id');
        const item = certs.find(c => c.certId === id);
        if (item) {
          const html = generateTubeSlittingCertHtml(item, { format: 'thermal' });
          const w = window.open('', '_blank');
          if (w) {
            w.document.write(html);
            w.document.close();
            w.focus();
            setTimeout(() => w.print(), 250);
          }
        }
      });
    });

    tableBody.querySelectorAll('[data-wa-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-wa-id');
        const item = certs.find(c => c.certId === id);
        if (item) {
          const text = formatTubeSlittingCertWhatsApp(item);
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            if (typeof onToast === 'function') onToast('WhatsApp notice copied to clipboard!');
          }
        }
      });
    });
  }

  // Event: Preset Selection
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const presetKey = presetSelect.value;
      const preset = SHAH_TUBE_SLITTING_PRESETS[presetKey];
      if (preset) {
        if (custInput) custInput.value = preset.customer;
        if (routeInput) routeInput.value = preset.route;
        if (toolSelect) toolSelect.value = preset.toolId;
        if (tubeSelect) tubeSelect.value = preset.tubeTypeId;
        if (depthInput) depthInput.value = preset.bladeDepthMm;
        if (windowInput) windowInput.value = preset.shaveWindowLengthMm;
        if (radiusInput) radiusInput.value = preset.slackLoopRadiusMm;
        if (liveCheckbox) liveCheckbox.checked = preset.isLiveTrafficOnTube;
        if (techInput) techInput.value = preset.technicianName;
        updatePreview();
      }
    });
  }

  // Live input changes
  [custInput, routeInput, techInput, toolSelect, tubeSelect, depthInput, windowInput, radiusInput, liveCheckbox].forEach(el => {
    if (el) {
      el.addEventListener('input', updatePreview);
      el.addEventListener('change', updatePreview);
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', renderHistoryTable);
  }

  // Save Cert
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const values = getFormValues();
      const validation = validateTubeSlittingInput(values);
      if (!validation.valid) {
        if (typeof onToast === 'function') onToast(validation.errors[0] || 'Invalid inputs');
        return;
      }
      const record = buildTubeSlittingCertRecord(values);
      saveTubeSlittingCert(record, state);
      renderHistoryTable();
      if (typeof onToast === 'function') onToast(`Saved QA Certificate ${record.certId}!`);
    });
  }

  // Print A4
  if (printA4Btn) {
    printA4Btn.addEventListener('click', () => {
      const values = getFormValues();
      const record = buildTubeSlittingCertRecord(values);
      const html = generateTubeSlittingCertHtml(record, { format: 'a4' });
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
      }
    });
  }

  // Print Thermal
  if (printThermalBtn) {
    printThermalBtn.addEventListener('click', () => {
      const values = getFormValues();
      const record = buildTubeSlittingCertRecord(values);
      const html = generateTubeSlittingCertHtml(record, { format: 'thermal' });
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 250);
      }
    });
  }

  // Copy WhatsApp
  if (copyWhatsAppBtn) {
    copyWhatsAppBtn.addEventListener('click', () => {
      const values = getFormValues();
      const record = buildTubeSlittingCertRecord(values);
      const text = formatTubeSlittingCertWhatsApp(record);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        if (typeof onToast === 'function') onToast('WhatsApp notice copied to clipboard!');
      }
    });
  }

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const certs = getSavedTubeSlittingCerts(state);
      const currentRec = buildTubeSlittingCertRecord(getFormValues());
      const listToExport = certs.length > 0 ? certs : [currentRec];
      const csv = generateTubeSlittingCertsCsv(listToExport);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tube-slitting-certs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (typeof onToast === 'function') onToast('Exported CSV successfully!');
    });
  }

  // Close Btn
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      dialogElement.close();
    });
  }

  // Initial preview and render
  updatePreview();
  renderHistoryTable();

  return {
    updatePreview,
    renderHistoryTable,
    getFormValues
  };
}
