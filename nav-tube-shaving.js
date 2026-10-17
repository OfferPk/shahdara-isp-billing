/**
 * nav-tube-shaving.js - Field Optical Fiber Buffer Tube Mid-Span Stripper & Shaving Gauge Assistant
 *
 * Engineering Standards & Specifications:
 * - ITU-T L.100 / L.400: Optical fiber cables for duct, aerial, and direct-buried installations
 * - Telcordia GR-20-CORE: Generic Requirements for Optical Fiber and Optical Fiber Cable
 * - TIA-598-D: Optical Fiber Cable Color Coding
 * - OSHA & IEC 60794: Safe buffer tube handling, mid-span slitting clearance & crush margins
 *
 * Provides optical outside-plant (OSP) technicians with:
 * 1. Buffer tube diameter, wall thickness, and safe blade penetration calibration (1.8mm to 3.2mm)
 * 2. Tube ovality & crush distortion detector to prevent blade pinching of 250µm primary fibers
 * 3. Thermal brittleness advisory for PBT and PP materials in cold Shahdara winter conditions
 * 4. Blade wear cycle monitor and risk score assessment
 * 5. TIA-598-D color code visualizer with dynamic SVG cross-section
 * 6. In-memory & localStorage audit logging with CSV export
 */

export const STORAGE_KEY = 'shahdara_nav_tube_shaving_history';
let inMemoryRecords = [];

// Standard Tube Specifications (ITU-T L.100 / Telcordia GR-20-CORE)
export const TUBE_SPECS = {
  '1.8': { nominalDiameter: 1.8, wallThickness: 0.30, defaultFibers: 6, safeMargin: 0.07, minBendRadiusMm: 36 },
  '2.0': { nominalDiameter: 2.0, wallThickness: 0.35, defaultFibers: 12, safeMargin: 0.07, minBendRadiusMm: 40 },
  '2.4': { nominalDiameter: 2.4, wallThickness: 0.40, defaultFibers: 12, safeMargin: 0.08, minBendRadiusMm: 48 },
  '2.8': { nominalDiameter: 2.8, wallThickness: 0.45, defaultFibers: 24, safeMargin: 0.08, minBendRadiusMm: 56 },
  '3.0': { nominalDiameter: 3.0, wallThickness: 0.50, defaultFibers: 24, safeMargin: 0.08, minBendRadiusMm: 60 },
  '3.2': { nominalDiameter: 3.2, wallThickness: 0.55, defaultFibers: 24, safeMargin: 0.09, minBendRadiusMm: 64 }
};

// Material Mechanical Properties
export const TUBE_MATERIALS = {
  PBT: {
    name: 'Polybutylene Terephthalate (PBT)',
    tensileModulusMpa: 2500,
    brittlenessTempC: 15,
    description: 'Rigid engineering thermoplastic. High crush resistance but brittle under cold stress.'
  },
  PP: {
    name: 'Polypropylene (PP)',
    tensileModulusMpa: 1300,
    brittlenessTempC: 8,
    description: 'Flexible copolymer. Softer cut, less sensitive to cold fractures but prone to blade drag.'
  },
  LSZH: {
    name: 'Low Smoke Zero Halogen (LSZH)',
    tensileModulusMpa: 2100,
    brittlenessTempC: 12,
    description: 'Flame retardant indoor/outdoor jacket. Stiff compound requiring progressive scoring.'
  }
};

// TIA-598-D 12 Fiber Color Sequence
export const FIBER_COLORS_TIA598 = [
  { pos: 1, name: 'Blue', hex: '#005bbb', textColor: '#ffffff' },
  { pos: 2, name: 'Orange', hex: '#ff6f00', textColor: '#ffffff' },
  { pos: 3, name: 'Green', hex: '#00873d', textColor: '#ffffff' },
  { pos: 4, name: 'Brown', hex: '#795548', textColor: '#ffffff' },
  { pos: 5, name: 'Slate', hex: '#757575', textColor: '#ffffff' },
  { pos: 6, name: 'White', hex: '#eeeeee', textColor: '#222222' },
  { pos: 7, name: 'Red', hex: '#d32f2f', textColor: '#ffffff' },
  { pos: 8, name: 'Black', hex: '#212121', textColor: '#ffffff' },
  { pos: 9, name: 'Yellow', hex: '#fbc02d', textColor: '#222222' },
  { pos: 10, name: 'Violet', hex: '#7b1fa2', textColor: '#ffffff' },
  { pos: 11, name: 'Rose', hex: '#e91e63', textColor: '#ffffff' },
  { pos: 12, name: 'Aqua', hex: '#00acc1', textColor: '#ffffff' }
];

/**
 * Helper: check if localStorage is accessible
 */
function hasLocalStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const testKey = '__sh_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

/**
 * Core Calculation: Tube Shaving & Mid-Span Calibration
 */
export function calculateTubeShavingParameters(input = {}) {
  const tubeSizeKey = String(input.tubeSize || '2.0');
  const spec = TUBE_SPECS[tubeSizeKey] || TUBE_SPECS['2.0'];

  const nominalDia = spec.nominalDiameter;
  const wallThickness = spec.wallThickness;
  const fiberCount = parseInt(input.fiberCount, 10) || spec.defaultFibers;
  const materialKey = (input.material || 'PBT').toUpperCase();
  const material = TUBE_MATERIALS[materialKey] || TUBE_MATERIALS.PBT;

  const ambientTemp = typeof input.ambientTemp === 'number' ? input.ambientTemp : 22;
  const bladeCycles = parseInt(input.bladeCycles, 10) || 0;
  const measuredMinor = typeof input.measuredMinor === 'number' && input.measuredMinor > 0 ? input.measuredMinor : nominalDia;
  const measuredMajor = typeof input.measuredMajor === 'number' && input.measuredMajor > 0 ? input.measuredMajor : nominalDia;
  const windowLengthCm = typeof input.windowLengthCm === 'number' && input.windowLengthCm > 0 ? input.windowLengthCm : 60;

  // Ovality calculation: ((D_major - D_minor) / D_nominal) * 100
  let ovalityPercent = 0;
  if (nominalDia > 0) {
    ovalityPercent = Math.max(0, ((measuredMajor - measuredMinor) / nominalDia) * 100);
  }
  ovalityPercent = Math.round(ovalityPercent * 10) / 10;

  let ovalityRating = 'Nominal Circular';
  let ovalityRisk = 'low';
  let ovalityRecommendation = 'Uniform wall thickness. Safe for standard rotary ring-cut & longitudinal slitting.';

  if (ovalityPercent > 8) {
    ovalityRating = 'Severe Flattening / Crush';
    ovalityRisk = 'critical';
    ovalityRecommendation = 'High risk of blade pinching 250µm fibers. Do not use rotary ring cutter. Warm tube and use longitudinal micro-cutter with minimal radial force.';
  } else if (ovalityPercent > 4) {
    ovalityRating = 'Minor Ovality';
    ovalityRisk = 'medium';
    ovalityRecommendation = 'Noticeable tube out-of-roundness. Orient shaving guide along major axis to maximize clearance.';
  }

  // Safety Clearance Margin
  const baseMargin = spec.safeMargin;
  // Cold temperature increases margin requirement because plastic is brittle
  let tempMarginPenalty = 0;
  if (ambientTemp < material.brittlenessTempC) {
    tempMarginPenalty = 0.015;
  }
  // High blade cycles increases margin because dull blade drags
  const bladeMarginPenalty = bladeCycles > 50 ? 0.01 : 0;

  let effectiveMargin = baseMargin + tempMarginPenalty + bladeMarginPenalty;
  effectiveMargin = Math.round(effectiveMargin * 1000) / 1000;

  // Maximum safe blade depth: Wall - Margin
  let maxBladeDepth = Math.max(0.1, wallThickness - effectiveMargin);
  maxBladeDepth = Math.round(maxBladeDepth * 1000) / 1000;

  const bladePenetrationPercent = Math.round((maxBladeDepth / wallThickness) * 100);

  // Thermal Condition Assessment
  let thermalStatus = 'Optimal';
  let thermalAlert = 'Normal ambient temperature for buffer tube stripping.';
  let thermalRisk = 'low';

  if (ambientTemp < material.brittlenessTempC - 5) {
    thermalStatus = `Severely Brittle (< ${material.brittlenessTempC - 5}°C)`;
    thermalAlert = 'Extreme risk of PBT/PP shattering and fiber shear. Pre-warm tube with hand warmers or hot air to >= 20°C before cutting.';
    thermalRisk = 'critical';
  } else if (ambientTemp < material.brittlenessTempC) {
    thermalStatus = `Chilled / Stiff (< ${material.brittlenessTempC}°C)`;
    thermalAlert = 'Material below transition point. Slow, continuous shaving pull required; avoid sudden twisting.';
    thermalRisk = 'medium';
  } else if (ambientTemp > 38) {
    thermalStatus = 'Softened (> 38°C)';
    thermalAlert = 'High heat softens tube wall; avoid longitudinal tube elongation during blade pull.';
    thermalRisk = 'medium';
  }

  // Blade Wear Assessment
  let bladeStatus = 'Sharp';
  let bladeAlert = 'Blade within optimal service envelope (< 30 cuts).';
  let bladeRisk = 'low';

  if (bladeCycles > 70) {
    bladeStatus = 'Dull / Worn Out (> 70 cuts)';
    bladeAlert = 'Dull blade creates ragged burrs, causes tube dragging, and risks buckling the 250µm fibers. Replace blade immediately.';
    bladeRisk = 'critical';
  } else if (bladeCycles > 35) {
    bladeStatus = 'Moderate Wear (36-70 cuts)';
    bladeAlert = 'Moderate cutting edge wear. Inspect blade edge under loupe for micro-nicks before mid-span entry.';
    bladeRisk = 'medium';
  }

  // Overall Risk Score (0 - 100)
  let riskScore = 10;
  if (ovalityRisk === 'critical') riskScore += 35;
  else if (ovalityRisk === 'medium') riskScore += 15;

  if (thermalRisk === 'critical') riskScore += 35;
  else if (thermalRisk === 'medium') riskScore += 15;

  if (bladeRisk === 'critical') riskScore += 30;
  else if (bladeRisk === 'medium') riskScore += 15;

  if (fiberCount > 12) riskScore += 10;
  riskScore = Math.min(100, Math.max(0, riskScore));

  let overallRating = 'Low Risk - Ready for Shave';
  let ratingColor = '#00873d';

  if (riskScore >= 75) {
    overallRating = 'Critical Risk - Halt & Calibrate';
    ratingColor = '#d32f2f';
  } else if (riskScore >= 45) {
    overallRating = 'Elevated Risk - Proceed with Precaution';
    ratingColor = '#ff6f00';
  }

  // Expressed slack loop & splice tray compatibility
  const minBendRadiusMm = spec.minBendRadiusMm;
  const recommendedTrayLoops = Math.max(1, Math.round(windowLengthCm / 45));

  return {
    tubeSize: tubeSizeKey,
    nominalDiameterMm: nominalDia,
    wallThicknessMm: wallThickness,
    fiberCount: fiberCount,
    material: materialKey,
    materialName: material.name,
    ambientTempC: ambientTemp,
    bladeCycles: bladeCycles,
    measuredMinorMm: measuredMinor,
    measuredMajorMm: measuredMajor,
    windowLengthCm: windowLengthCm,
    ovalityPercent: ovalityPercent,
    ovalityRating: ovalityRating,
    ovalityRisk: ovalityRisk,
    ovalityRecommendation: ovalityRecommendation,
    effectiveMarginMm: effectiveMargin,
    maxBladeDepthMm: maxBladeDepth,
    bladePenetrationPercent: bladePenetrationPercent,
    thermalStatus: thermalStatus,
    thermalAlert: thermalAlert,
    thermalRisk: thermalRisk,
    bladeStatus: bladeStatus,
    bladeAlert: bladeAlert,
    bladeRisk: bladeRisk,
    riskScore: riskScore,
    overallRating: overallRating,
    ratingColor: ratingColor,
    minBendRadiusMm: minBendRadiusMm,
    recommendedTrayLoops: recommendedTrayLoops
  };
}

/**
 * Render dynamic SVG cross-section of the buffer tube
 */
export function renderTubeCrossSectionSvg(calc) {
  if (!calc) return '<svg viewBox="0 0 320 220" width="100%" height="220"></svg>';

  const cx = 140;
  const cy = 110;
  const outerRadius = 75;
  const wallRatio = calc.wallThicknessMm / calc.nominalDiameterMm;
  const innerRadius = Math.max(20, outerRadius * (1 - wallRatio * 2));
  const bladeDepthRatio = calc.maxBladeDepthMm / calc.wallThicknessMm;
  const bladeCutRadius = outerRadius - (outerRadius - innerRadius) * bladeDepthRatio;

  // Color sequence for inside fibers
  const fiberCount = Math.min(24, Math.max(2, calc.fiberCount));
  let fibersSvg = '';

  for (let i = 0; i < fiberCount; i++) {
    const colorDef = FIBER_COLORS_TIA598[i % 12];
    let angle = (i / fiberCount) * 2 * Math.PI - Math.PI / 2;
    let fDist = innerRadius * 0.65;
    if (fiberCount > 12) {
      // Inner and outer concentric rings of fibers
      fDist = (i < 12) ? innerRadius * 0.45 : innerRadius * 0.78;
      angle = ((i % 12) / 12) * 2 * Math.PI - Math.PI / 2;
    }
    const fx = cx + fDist * Math.cos(angle);
    const fy = cy + fDist * Math.sin(angle);
    const fr = fiberCount > 12 ? 4.5 : 6.5;

    fibersSvg += `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="${fr}" fill="${colorDef.hex}" stroke="#333" stroke-width="0.8">` +
      `<title>Fiber #${i + 1} (${colorDef.name})</title></circle>`;
    if (fiberCount <= 12) {
      fibersSvg += `<text x="${fx.toFixed(1)}" y="${(fy + 2.5).toFixed(1)}" text-anchor="middle" font-size="7" font-weight="bold" fill="${colorDef.textColor}">${i + 1}</text>`;
    }
  }

  const bladeColor = calc.riskScore >= 75 ? '#d32f2f' : (calc.riskScore >= 45 ? '#ff6f00' : '#00873d');

  return [
    '<svg viewBox="0 0 320 220" width="100%" height="220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Buffer Tube Cross Section Graphic">',
    '  <defs>',
    '    <linearGradient id="tubeWallGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
    '      <stop offset="0%" stop-color="#4a5568" />',
    '      <stop offset="100%" stop-color="#2d3748" />',
    '    </linearGradient>',
    '    <linearGradient id="innerCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
    '      <stop offset="0%" stop-color="#edf2f7" />',
    '      <stop offset="100%" stop-color="#e2e8f0" />',
    '    </linearGradient>',
    '  </defs>',
    '  <!-- Tube Outer Wall -->',
    `  <circle cx="${cx}" cy="${cy}" r="${outerRadius}" fill="url(#tubeWallGrad)" stroke="#1a202c" stroke-width="2" />`,
    '  <!-- Tube Inner Cavity -->',
    `  <circle cx="${cx}" cy="${cy}" r="${innerRadius.toFixed(1)}" fill="url(#innerCoreGrad)" stroke="#718096" stroke-width="1.2" stroke-dasharray="3,2" />`,
    '  <!-- Fibers inside core -->',
    fibersSvg,
    '  <!-- Core Center gel dot -->',
    `  <circle cx="${cx}" cy="${cy}" r="3" fill="#cbd5e0" />`,
    '  <!-- Blade Penetration Guide at Top -->',
    `  <path d="M ${cx - 14} ${cy - outerRadius - 16} L ${cx + 14} ${cy - outerRadius - 16} L ${cx} ${(cy - bladeCutRadius).toFixed(1)} Z" fill="${bladeColor}" opacity="0.9" stroke="#fff" stroke-width="1" />`,
    `  <line x1="${cx - 20}" y1="${(cy - bladeCutRadius).toFixed(1)}" x2="${cx + 20}" y2="${(cy - bladeCutRadius).toFixed(1)}" stroke="${bladeColor}" stroke-width="1.5" stroke-dasharray="2,2" />`,
    '  <!-- Clearance Zone Callout -->',
    `  <line x1="${cx + 22}" y1="${cy - outerRadius}" x2="${cx + 38}" y2="${cy - outerRadius}" stroke="#cbd5e0" stroke-width="1" />`,
    `  <line x1="${cx + 22}" y1="${(cy - innerRadius).toFixed(1)}" x2="${cx + 38}" y2="${(cy - innerRadius).toFixed(1)}" stroke="#cbd5e0" stroke-width="1" />`,
    `  <line x1="${cx + 35}" y1="${cy - outerRadius}" x2="${cx + 35}" y2="${(cy - innerRadius).toFixed(1)}" stroke="#4299e1" stroke-width="1.5" />`,
    `  <text x="${cx + 42}" y="${(cy - (outerRadius + innerRadius) / 2 + 3).toFixed(1)}" font-size="9" fill="#2b6cb0" font-weight="bold">${calc.wallThicknessMm}mm</text>`,
    '  <!-- Legend & Status -->',
    '  <g transform="translate(230, 20)">',
    '    <rect x="0" y="0" width="85" height="175" rx="6" fill="#f7fafc" stroke="#e2e8f0" />',
    '    <text x="6" y="16" font-size="10" font-weight="bold" fill="#2d3748">Parameters</text>',
    `    <text x="6" y="34" font-size="8.5" fill="#4a5568">Dia: ${calc.tubeSize} mm</text>`,
    `    <text x="6" y="50" font-size="8.5" fill="#4a5568">Wall: ${calc.wallThicknessMm} mm</text>`,
    `    <text x="6" y="66" font-size="8.5" fill="#2b6cb0">Depth: ${calc.maxBladeDepthMm} mm</text>`,
    `    <text x="6" y="82" font-size="8.5" fill="#2b6cb0">Cut: ${calc.bladePenetrationPercent}%</text>`,
    `    <text x="6" y="98" font-size="8.5" fill="#718096">Safe: ${calc.effectiveMarginMm} mm</text>`,
    `    <text x="6" y="114" font-size="8.5" fill="#4a5568">Oval: ${calc.ovalityPercent}%</text>`,
    `    <text x="6" y="130" font-size="8.5" fill="#4a5568">Fibers: ${calc.fiberCount}F</text>`,
    '    <line x1="6" y1="138" x2="79" y2="138" stroke="#cbd5e0" />',
    `    <rect x="6" y="146" width="73" height="20" rx="3" fill="${calc.ratingColor}" />`,
    `    <text x="42" y="160" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#fff">Risk: ${calc.riskScore}/100</text>`,
    '  </g>',
    '  <!-- Dimension Annotation -->',
    `  <text x="${cx}" y="210" text-anchor="middle" font-size="9" fill="#718096">${calc.material} | ${calc.ambientTempC}°C | ${calc.bladeCycles} cuts</text>`,
    '</svg>'
  ].join('\n');
}

/**
 * Persistence: save record to history
 */
export function saveTubeShavingRecord(record) {
  if (!record) return null;
  const entry = {
    id: `shave_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    location: record.location || 'Shahdara OSP',
    tubeSize: record.tubeSize || '2.0',
    wallThicknessMm: record.wallThicknessMm || 0.35,
    material: record.material || 'PBT',
    fiberCount: record.fiberCount || 12,
    maxBladeDepthMm: record.maxBladeDepthMm || 0.28,
    effectiveMarginMm: record.effectiveMarginMm || 0.07,
    ovalityPercent: record.ovalityPercent || 0,
    riskScore: record.riskScore || 0,
    overallRating: record.overallRating || 'Low',
    ambientTempC: record.ambientTempC || 22,
    bladeCycles: record.bladeCycles || 0,
    windowLengthCm: record.windowLengthCm || 60,
    technicianNote: record.technicianNote || ''
  };

  inMemoryRecords.unshift(entry);

  if (hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      let list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list.unshift(entry);
      if (list.length > 50) list = list.slice(0, 50);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // Silently continue with in-memory record
    }
  }

  return entry;
}

/**
 * Persistence: get history
 */
export function getTubeShavingHistory() {
  if (hasLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      // Fall back to memory
    }
  }
  return inMemoryRecords.slice(0, 50);
}

/**
 * Persistence: clear history
 */
export function clearTubeShavingHistory() {
  inMemoryRecords = [];
  if (hasLocalStorage()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
  }
  return true;
}

/**
 * Export CSV representation of history
 */
export function exportTubeShavingReportCsv(records) {
  records = records || getTubeShavingHistory();
  const headers = [
    'Timestamp',
    'Location',
    'Tube Size (mm)',
    'Wall (mm)',
    'Material',
    'Fibers',
    'Max Blade Depth (mm)',
    'Safe Margin (mm)',
    'Ovality (%)',
    'Ambient Temp (°C)',
    'Blade Cycles',
    'Window Length (cm)',
    'Risk Score',
    'Rating',
    'Note'
  ];

  const rows = [headers.join(',')];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const row = [
      `"${r.timestamp || ''}"`,
      `"${(r.location || '').replace(/"/g, '""')}"`,
      r.tubeSize || '',
      r.wallThicknessMm || '',
      `"${r.material || ''}"`,
      r.fiberCount || '',
      r.maxBladeDepthMm || '',
      r.effectiveMarginMm || '',
      r.ovalityPercent || '',
      r.ambientTempC || '',
      r.bladeCycles || '',
      r.windowLengthCm || '',
      r.riskScore || '',
      `"${(r.overallRating || '').replace(/"/g, '""')}"`,
      `"${(r.technicianNote || '').replace(/"/g, '""')}"`
    ];
    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Summary metrics calculation
 */
export function generateTubeShavingSummary(records) {
  records = records || getTubeShavingHistory();
  const total = records.length;
  if (total === 0) {
    return {
      totalShaves: 0,
      avgRiskScore: 0,
      highRiskCount: 0,
      bladeWearAlerts: 0,
      mostCommonSize: 'N/A'
    };
  }

  let riskSum = 0;
  let highRiskCount = 0;
  let bladeAlerts = 0;
  const sizeCounts = {};

  for (let i = 0; i < total; i++) {
    const r = records[i];
    riskSum += (r.riskScore || 0);
    if (r.riskScore >= 45) highRiskCount++;
    if (r.bladeCycles > 70) bladeAlerts++;

    const sz = r.tubeSize || '2.0';
    sizeCounts[sz] = (sizeCounts[sz] || 0) + 1;
  }

  let mostCommonSize = '2.0';
  let maxCount = 0;
  for (const k in sizeCounts) {
    if (sizeCounts[k] > maxCount) {
      maxCount = sizeCounts[k];
      mostCommonSize = k;
    }
  }

  return {
    totalShaves: total,
    avgRiskScore: Math.round(riskSum / total),
    highRiskCount: highRiskCount,
    bladeWearAlerts: bladeAlerts,
    mostCommonSize: mostCommonSize
  };
}

/**
 * DOM Controller: Setup Mobile Modal
 */
export function setupMobileTubeShavingModal() {
  if (typeof document === 'undefined') return;

  const modal = document.getElementById('mobileTubeShavingModal');
  const openBtn = document.getElementById('mobileMoreTubeShavingBtn');
  const closeBtn = document.getElementById('closeMobileTubeShavingModalBtn');
  if (!modal) return;

  function openModal() {
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
    recalculate();
    renderHistoryList();
  }

  function closeModal() {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  if (openBtn) {
    openBtn.addEventListener('click', openModal);
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Inputs
  const tubeSizeSelect = document.getElementById('shaveTubeSize');
  const materialSelect = document.getElementById('shaveMaterial');
  const fiberCountInput = document.getElementById('shaveFiberCount');
  const minorDiaInput = document.getElementById('shaveMinorDia');
  const majorDiaInput = document.getElementById('shaveMajorDia');
  const ambientTempInput = document.getElementById('shaveAmbientTemp');
  const bladeCyclesInput = document.getElementById('shaveBladeCycles');
  const windowLengthInput = document.getElementById('shaveWindowLength');
  const locationInput = document.getElementById('shaveLocation');
  const noteInput = document.getElementById('shaveNote');

  // Action buttons
  const saveRecordBtn = document.getElementById('shaveSaveRecordBtn');
  const exportCsvBtn = document.getElementById('shaveExportCsvBtn');
  const clearHistoryBtn = document.getElementById('shaveClearHistoryBtn');

  // Preset buttons
  const presetPbt20 = document.getElementById('shavePresetPbt20');
  const presetPbt28 = document.getElementById('shavePresetPbt28');
  const presetPp18 = document.getElementById('shavePresetPp18');
  const presetColdMorning = document.getElementById('shavePresetColdMorning');

  function applyPreset(preset) {
    if (!preset) return;
    if (tubeSizeSelect && preset.tubeSize) tubeSizeSelect.value = preset.tubeSize;
    if (materialSelect && preset.material) materialSelect.value = preset.material;
    if (fiberCountInput && preset.fiberCount) fiberCountInput.value = preset.fiberCount;
    if (minorDiaInput && preset.minorDia) minorDiaInput.value = preset.minorDia;
    if (majorDiaInput && preset.majorDia) majorDiaInput.value = preset.majorDia;
    if (ambientTempInput && typeof preset.temp === 'number') ambientTempInput.value = preset.temp;
    if (bladeCyclesInput && typeof preset.cycles === 'number') bladeCyclesInput.value = preset.cycles;
    if (windowLengthInput && preset.winLen) windowLengthInput.value = preset.winLen;
    recalculate();
  }

  if (presetPbt20) {
    presetPbt20.addEventListener('click', () => {
      applyPreset({ tubeSize: '2.0', material: 'PBT', fiberCount: 12, minorDia: 2.0, majorDia: 2.0, temp: 24, cycles: 12, winLen: 60 });
    });
  }
  if (presetPbt28) {
    presetPbt28.addEventListener('click', () => {
      applyPreset({ tubeSize: '2.8', material: 'PBT', fiberCount: 24, minorDia: 2.75, majorDia: 2.85, temp: 22, cycles: 25, winLen: 80 });
    });
  }
  if (presetPp18) {
    presetPp18.addEventListener('click', () => {
      applyPreset({ tubeSize: '1.8', material: 'PP', fiberCount: 6, minorDia: 1.8, majorDia: 1.8, temp: 26, cycles: 8, winLen: 45 });
    });
  }
  if (presetColdMorning) {
    presetColdMorning.addEventListener('click', () => {
      applyPreset({ tubeSize: '2.0', material: 'PBT', fiberCount: 12, minorDia: 1.9, majorDia: 2.1, temp: 7, cycles: 78, winLen: 60 });
    });
  }

  let currentCalc = null;

  function recalculate() {
    const tubeSize = tubeSizeSelect ? tubeSizeSelect.value : '2.0';
    const material = materialSelect ? materialSelect.value : 'PBT';
    const fiberCount = fiberCountInput ? parseInt(fiberCountInput.value, 10) : 12;
    const minorDia = minorDiaInput ? parseFloat(minorDiaInput.value) : 2.0;
    const majorDia = majorDiaInput ? parseFloat(majorDiaInput.value) : 2.0;
    const ambientTemp = ambientTempInput ? parseFloat(ambientTempInput.value) : 22;
    const bladeCycles = bladeCyclesInput ? parseInt(bladeCyclesInput.value, 10) : 0;
    const windowLength = windowLengthInput ? parseFloat(windowLengthInput.value) : 60;

    currentCalc = calculateTubeShavingParameters({
      tubeSize: tubeSize,
      material: material,
      fiberCount: fiberCount,
      measuredMinor: minorDia,
      measuredMajor: majorDia,
      ambientTemp: ambientTemp,
      bladeCycles: bladeCycles,
      windowLengthCm: windowLength
    });

    // Update Outputs
    const svgContainer = document.getElementById('shaveSvgContainer');
    if (svgContainer) {
      svgContainer.innerHTML = renderTubeCrossSectionSvg(currentCalc);
    }

    const maxBladeDepthEl = document.getElementById('shaveOutMaxBladeDepth');
    if (maxBladeDepthEl) maxBladeDepthEl.textContent = `${currentCalc.maxBladeDepthMm.toFixed(3)} mm`;

    const marginEl = document.getElementById('shaveOutMargin');
    if (marginEl) marginEl.textContent = `${currentCalc.effectiveMarginMm.toFixed(3)} mm`;

    const cutPercentEl = document.getElementById('shaveOutCutPercent');
    if (cutPercentEl) cutPercentEl.textContent = `${currentCalc.bladePenetrationPercent}%`;

    const ovalityEl = document.getElementById('shaveOutOvality');
    if (ovalityEl) ovalityEl.textContent = `${currentCalc.ovalityPercent}% (${currentCalc.ovalityRating})`;

    const thermalEl = document.getElementById('shaveOutThermal');
    if (thermalEl) thermalEl.textContent = currentCalc.thermalStatus;

    const bladeEl = document.getElementById('shaveOutBlade');
    if (bladeEl) bladeEl.textContent = currentCalc.bladeStatus;

    const riskBadge = document.getElementById('shaveOutRiskBadge');
    if (riskBadge) {
      riskBadge.textContent = `Risk: ${currentCalc.riskScore}/100 (${currentCalc.overallRating})`;
      riskBadge.style.backgroundColor = currentCalc.ratingColor;
      riskBadge.style.color = '#ffffff';
    }

    const alertBox = document.getElementById('shaveOutAlertBox');
    if (alertBox) {
      const alerts = [];
      if (currentCalc.ovalityRisk !== 'low') alerts.push(`<strong>Ovality Alert:</strong> ${currentCalc.ovalityRecommendation}`);
      if (currentCalc.thermalRisk !== 'low') alerts.push(`<strong>Thermal Advisory:</strong> ${currentCalc.thermalAlert}`);
      if (currentCalc.bladeRisk !== 'low') alerts.push(`<strong>Blade Advisory:</strong> ${currentCalc.bladeAlert}`);
      if (alerts.length === 0) alerts.push('All parameters within standard ITU-T / Telcordia tolerance. Proceed with steady continuous draw.');
      alertBox.innerHTML = alerts.join('<br><br>');
    }
  }

  // Attach input listeners
  const inputs = [tubeSizeSelect, materialSelect, fiberCountInput, minorDiaInput, majorDiaInput, ambientTempInput, bladeCyclesInput, windowLengthInput];
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i]) {
      inputs[i].addEventListener('input', recalculate);
      inputs[i].addEventListener('change', recalculate);
    }
  }

  // Save record
  if (saveRecordBtn) {
    saveRecordBtn.addEventListener('click', () => {
      if (!currentCalc) recalculate();
      const loc = locationInput ? locationInput.value.trim() : 'Shahdara OSP';
      const note = noteInput ? noteInput.value.trim() : '';

      const record = Object.assign({}, currentCalc, {
        location: loc || 'Shahdara OSP',
        technicianNote: note
      });

      saveTubeShavingRecord(record);
      renderHistoryList();
      if (noteInput) noteInput.value = '';
    });
  }

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const csv = exportTubeShavingReportCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara_tube_shaving_audit_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Clear History
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      if (window.confirm('Clear all buffer tube shaving calibration logs?')) {
        clearTubeShavingHistory();
        renderHistoryList();
      }
    });
  }

  function renderHistoryList() {
    const historyTableBody = document.getElementById('shaveHistoryTableBody');
    const summaryEl = document.getElementById('shaveSummaryMetrics');
    if (!historyTableBody) return;

    const records = getTubeShavingHistory();
    const summary = generateTubeShavingSummary(records);

    if (summaryEl) {
      summaryEl.innerHTML = `Total Logged: <strong>${summary.totalShaves}</strong> | Avg Risk: <strong>${summary.avgRiskScore}/100</strong> | High Risk: <strong>${summary.highRiskCount}</strong> | Blade Alerts: <strong>${summary.bladeWearAlerts}</strong>`;
    }

    if (records.length === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#718096;padding:12px;">No calibration logs recorded yet.</td></tr>';
      return;
    }

    let html = '';
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const timeStr = r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
      html += `<tr>` +
        `<td>${timeStr}</td>` +
        `<td>${r.location || 'Shahdara'}</td>` +
        `<td>${r.tubeSize}mm ${r.material} (${r.fiberCount}F)</td>` +
        `<td>${r.maxBladeDepthMm.toFixed(3)}mm</td>` +
        `<td>${r.ovalityPercent}%</td>` +
        `<td><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-weight:bold;color:#fff;background-color:${r.riskScore >= 75 ? '#d32f2f' : (r.riskScore >= 45 ? '#ff6f00' : '#00873d')}">${r.riskScore}</span></td>` +
        `<td>${r.technicianNote || '-'}</td>` +
        `</tr>`;
    }
    historyTableBody.innerHTML = html;
  }
}
