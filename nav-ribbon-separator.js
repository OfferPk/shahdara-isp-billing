/**
 * Shahdara ISP - Field Mass Fusion Ribbon Fiber De-Ribbonizer & Single-Core Breakout Assistant
 *
 * Provides FTTH optical test technicians, splice engineers, and field linesmen with:
 * - TIA-598-D & IEC 60304 12-fiber ribbon color code sequencing (1-Blue through 12-Aqua)
 * - Ribbon matrix peel integrity metrology (mechanical peel, thermal stripper, or solvent breakout)
 * - Residual matrix thickness (µm), fiber crossing risk, and peel force (N) evaluation
 * - Fan-out furcation kit (900µm tubing / spider manifold) and individual core routing planning
 * - Pure-vector responsive SVG schematic depicting ribbon matrix, peel split comb, and individual colored cores
 * - LocalStorage persistence (shahdara_ribbon_separator_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const RIBBON_SEPARATOR_STORAGE_KEY = 'shahdara_ribbon_separator_audits_v1';

export const RIBBON_COLOR_CODES = [
  { index: 1, name: 'Blue', hex: '#2563eb', urdu: 'نیلا' },
  { index: 2, name: 'Orange', hex: '#ea580c', urdu: 'نارنجی' },
  { index: 3, name: 'Green', hex: '#16a34a', urdu: 'سبز' },
  { index: 4, name: 'Brown', hex: '#854d0e', urdu: 'کتھئی' },
  { index: 5, name: 'Slate', hex: '#64748b', urdu: 'سرمئی' },
  { index: 6, name: 'White', hex: '#f1f5f9', urdu: 'سفید' },
  { index: 7, name: 'Red', hex: '#dc2626', urdu: 'سرخ' },
  { index: 8, name: 'Black', hex: '#1e293b', urdu: 'سیاہ' },
  { index: 9, name: 'Yellow', hex: '#eab308', urdu: 'پیلا' },
  { index: 10, name: 'Violet', hex: '#9333ea', urdu: 'جامنی' },
  { index: 11, name: 'Rose', hex: '#f43f5e', urdu: 'گلابی' },
  { index: 12, name: 'Aqua', hex: '#06b6d4', urdu: 'فیروزی' }
];

export const DE_RIBBON_METHODS = {
  MECHANICAL_COMB: {
    id: 'MECHANICAL_COMB',
    name: 'Mechanical Comb Separator (Precision Razor & Grooved Roller)',
    description: 'Precision mechanical delaminating tool separating matrix along fiber boundaries.',
    recommendedPeelForceMaxN: 2.5,
    matrixResidueMaxUm: 15,
    thermalPreheat: false
  },
  THERMAL_STRIPPER: {
    id: 'THERMAL_STRIPPER',
    name: 'Thermal Jacket Softener & Ribbon Splitter (Heated Blade)',
    description: 'Heated blade stripper softens acrylate matrix before separation, reducing glass micro-cracks.',
    recommendedPeelForceMaxN: 1.2,
    matrixResidueMaxUm: 8,
    thermalPreheat: true
  },
  SOLVENT_ASSISTED: {
    id: 'SOLVENT_ASSISTED',
    name: 'Solvent Wipe De-Matrixing (High-Purity Isopropyl Alcohol)',
    description: 'Solvent soak dissolves UV-cured acrylate matrix for delicate legacy cable breakouts.',
    recommendedPeelForceMaxN: 0.8,
    matrixResidueMaxUm: 5,
    thermalPreheat: false
  }
};

export const RIBBON_PRESETS = [
  {
    id: 'shahdara-trunk-144-ribbon-breakout',
    name: 'Shahdara Feeder 144F Trunk (Ribbon #3 Fan-Out to 900µm Tubing)',
    area: 'Shahdara Feeder Trunk',
    ribbonNumber: 3,
    totalRibbonsInCable: 12,
    cableFiberCount: 144,
    deRibbonMethod: 'MECHANICAL_COMB',
    peelLengthMm: 75,
    measuredPeelForceN: 1.8,
    matrixResidueUm: 12,
    targetCore: 'ALL_12_CORES',
    fanOutKitType: '900um Spider Furcation Fan-out Kit',
    technician: 'Rashid Mahmood (Splice Lead)',
    notes: 'Mass ribbon separation for FDB cabinet patch panel breakout.'
  },
  {
    id: 'ravi-ring-72-ribbon-splice',
    name: 'Ravi Siphon 72F Backhaul (Ribbon #1 Mass Fusion Prep)',
    area: 'Ravi Siphon Ring',
    ribbonNumber: 1,
    totalRibbonsInCable: 6,
    cableFiberCount: 72,
    deRibbonMethod: 'THERMAL_STRIPPER',
    peelLengthMm: 40,
    measuredPeelForceN: 0.9,
    matrixResidueUm: 6,
    targetCore: 'ALL_12_CORES',
    fanOutKitType: 'Direct 12-Fiber Mass Fusion Splice Holder',
    technician: 'Arshad Ali (Senior Tech)',
    notes: 'Thermal de-ribboning before 12-fiber simultaneous mass fusion splicing.'
  },
  {
    id: 'begum-kot-drop-single-core-split',
    name: 'Begum Kot 24F Branch (Extract Core #5 Slate for Local FAT Drop)',
    area: 'Begum Kot Node',
    ribbonNumber: 2,
    totalRibbonsInCable: 2,
    cableFiberCount: 24,
    deRibbonMethod: 'SOLVENT_ASSISTED',
    peelLengthMm: 60,
    measuredPeelForceN: 0.6,
    matrixResidueUm: 4,
    targetCore: '5_SLATE',
    fanOutKitType: 'Single Core Mid-Span Extraction to Drop Pigtail',
    technician: 'Tariq Javed (Field Linesman)',
    notes: 'Careful single fiber extraction leaving remaining 11 fibers intact in ribbon.'
  },
  {
    id: 'saeed-park-matrix-delamination-alert',
    name: 'Saeed Park Old Weathered Ribbon (Excessive Peel Force Warning)',
    area: 'Saeed Park',
    ribbonNumber: 1,
    totalRibbonsInCable: 4,
    cableFiberCount: 48,
    deRibbonMethod: 'MECHANICAL_COMB',
    peelLengthMm: 80,
    measuredPeelForceN: 3.4,
    matrixResidueUm: 28,
    targetCore: 'ALL_12_CORES',
    fanOutKitType: '900um Furcation Buffer Tubing',
    technician: 'Imran Shah (Tech)',
    notes: 'Weathered cable with matrix embrittlement requiring thermal pre-heating.'
  }
];

/**
 * Calculates ribbon separation metrics, peeling integrity, and fiber safety indices.
 */
export function calculateRibbonSeparatorMetrics(params = {}) {
  const methodId = params.deRibbonMethod || 'MECHANICAL_COMB';
  const method = DE_RIBBON_METHODS[methodId] || DE_RIBBON_METHODS.MECHANICAL_COMB;

  const ribbonNumber = parseInt(params.ribbonNumber, 10) || 1;
  const cableFiberCount = parseInt(params.cableFiberCount, 10) || 144;
  const totalRibbonsInCable = parseInt(params.totalRibbonsInCable, 10) || Math.ceil(cableFiberCount / 12);
  const peelLengthMm = parseFloat(params.peelLengthMm) || 75;
  const measuredPeelForceN = parseFloat(params.measuredPeelForceN) || 1.8;
  const matrixResidueUm = parseFloat(params.matrixResidueUm) || 12;
  const targetCore = params.targetCore || 'ALL_12_CORES';

  // Standard ribbon specifications (TIA-598-D)
  const fiberPitchUm = 250; // Center-to-center nominal pitch
  const ribbonThicknessUm = 290; // Nominal thickness including UV acrylate matrix
  const ribbonWidthMm = 3.05; // 12 x 250µm + edges = ~3.05 mm
  const standardStrippingAngleDeg = 45; // Recommended peeling angle

  // Verification thresholds
  const isForcePass = measuredPeelForceN <= method.recommendedPeelForceMaxN;
  const isResiduePass = matrixResidueUm <= method.matrixResidueMaxUm;
  const isOverallPass = isForcePass && isResiduePass;

  // Fiber core integrity score (0 - 100)
  let integrityScore = 100;
  if (!isForcePass) {
    const forceExcess = measuredPeelForceN - method.recommendedPeelForceMaxN;
    integrityScore -= Math.min(40, Math.round(forceExcess * 25));
  }
  if (!isResiduePass) {
    const residueExcess = matrixResidueUm - method.matrixResidueMaxUm;
    integrityScore -= Math.min(30, Math.round(residueExcess * 2));
  }
  integrityScore = Math.max(10, integrityScore);

  let verdict = 'OPTIMAL_SEPARATION';
  let ratingText = 'Optimal Separation (Safe for Furcation & Splicing)';
  if (integrityScore < 50) {
    verdict = 'CRITICAL_RISK_COATING_DAMAGE';
    ratingText = 'Critical Risk! Glass Micro-Fracture / Coating Delamination';
  } else if (integrityScore < 75) {
    verdict = 'MARGINAL_HIGH_FORCE';
    ratingText = 'Marginal: High Peel Force / Adhesive Clumping';
  }

  // Target core label
  let targetCoreLabel = 'All 12 Cores (Full Breakout)';
  if (targetCore !== 'ALL_12_CORES') {
    const coreIdx = parseInt(targetCore.split('_')[0], 10);
    const colorObj = RIBBON_COLOR_CODES.find(c => c.index === coreIdx);
    if (colorObj) {
      targetCoreLabel = `Core #${colorObj.index} - ${colorObj.name} (${colorObj.urdu})`;
    }
  }

  return {
    method,
    ribbonNumber,
    cableFiberCount,
    totalRibbonsInCable,
    peelLengthMm,
    measuredPeelForceN,
    matrixResidueUm,
    targetCore,
    targetCoreLabel,
    fiberPitchUm,
    ribbonThicknessUm,
    ribbonWidthMm,
    standardStrippingAngleDeg,
    isForcePass,
    isResiduePass,
    isOverallPass,
    integrityScore,
    verdict,
    ratingText
  };
}

/**
 * Pure-vector SVG schematic depicting 12-fiber ribbon cross section, de-matrixing comb, and fan-out fibers.
 */
export function renderRibbonSeparatorSvg(metrics, options = {}) {
  const isDark = options.isDark ?? false;
  const m = metrics || calculateRibbonSeparatorMetrics();

  const width = 760;
  const height = 300;

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  const statusColor = m.isOverallPass ? '#10b981' : (m.integrityScore >= 50 ? '#f59e0b' : '#ef4444');

  // SVG fiber breakout paths
  const startX = 140;
  const combX = 320;
  const endX = 660;
  const centerY = 150;

  // 12 fibers distributed across height
  const fiberSpacings = RIBBON_COLOR_CODES.map((c, i) => {
    const ribbonY = centerY - 28 + (i * 5); // compact ribbon bundle
    const fanoutY = 55 + (i * 18); // spread out into splice tray
    return {
      ...c,
      ribbonY,
      fanoutY
    };
  });

  return `
  <svg class="ribbon-separator-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="12-Fiber Ribbon De-Ribbonizer and Breakout Diagram">
    <!-- Background Canvas -->
    <rect width="${width}" height="${height}" rx="10" fill="${bgColor}" stroke="${borderColor}" stroke-width="1.5"/>

    <!-- Header Section -->
    <g transform="translate(30, 24)">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="700" fill="${textPrimary}">
        Ribbon #${m.ribbonNumber} Breakout · ${m.method.name}
      </text>
      <text x="0" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="500" fill="${textMuted}">
        Peel Length: ${m.peelLengthMm} mm · Target: ${m.targetCoreLabel} · TIA-598-D 12-Color Sequence
      </text>
      <!-- Status Badge -->
      <g transform="translate(${width - 250}, -10)">
        <rect width="190" height="26" rx="13" fill="${statusColor}" fill-opacity="0.15" stroke="${statusColor}" stroke-width="1.5"/>
        <circle cx="14" cy="13" r="5" fill="${statusColor}"/>
        <text x="26" y="17" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${statusColor}">
          ${m.isOverallPass ? 'PASS: INTEGRITY 100%' : `RISK: SCORE ${m.integrityScore}%`}
        </text>
      </g>
    </g>

    <!-- Intact Ribbon Section (Left) -->
    <g>
      <!-- Outer Acrylate Matrix Boundary -->
      <rect x="50" y="${centerY - 35}" width="220" height="70" rx="8" fill="${cardBg}" stroke="${borderColor}" stroke-width="2"/>
      <rect x="52" y="${centerY - 33}" width="216" height="66" rx="6" fill="#3b82f6" fill-opacity="0.08"/>
      <text x="160" y="${centerY - 42}" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="#3b82f6">
        Intact 12-Fiber Ribbon (Pitch: 250µm)
      </text>

      <!-- Draw 12 bonded cores in matrix -->
      ${fiberSpacings.map(f => `
        <line x1="55" y1="${f.ribbonY}" x2="${combX}" y2="${f.ribbonY}" stroke="${f.hex}" stroke-width="3"/>
      `).join('')}
    </g>

    <!-- De-Ribboning Comb / Peeler Boundary (Center) -->
    <g transform="translate(${combX}, ${centerY})">
      <rect x="-10" y="-45" width="20" height="90" rx="4" fill="#64748b" stroke="#334155" stroke-width="2"/>
      <!-- Delaminating Teeth -->
      <line x1="0" y1="-40" x2="0" y2="40" stroke="#f8fafc" stroke-width="2" stroke-dasharray="3,3"/>
      <text x="0" y="60" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="800" fill="${textPrimary}">
        SEPARATOR
      </text>
      <text x="0" y="72" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="600" fill="${statusColor}">
        ${m.measuredPeelForceN} N Peel Force
      </text>
    </g>

    <!-- Fan-out Singulated Fibers (Right) -->
    <g>
      ${fiberSpacings.map(f => `
        <path d="M ${combX + 10} ${f.ribbonY} C ${combX + 100} ${f.ribbonY}, ${endX - 100} ${f.fanoutY}, ${endX} ${f.fanoutY}"
              fill="none" stroke="${f.hex}" stroke-width="2.5"/>
        <circle cx="${endX}" cy="${f.fanoutY}" r="4" fill="${f.hex}" stroke="${cardBg}" stroke-width="1.5"/>
        <text x="${endX + 12}" y="${f.fanoutY + 3}" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="${textPrimary}">
          #${f.index} ${f.name}
        </text>
      `).join('')}
    </g>

    <!-- Metrics Footer Banner -->
    <g transform="translate(30, ${height - 24})">
      <rect x="0" y="-14" width="${width - 60}" height="28" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="15" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">
        Residual Matrix Residue: <tspan fill="${m.isResiduePass ? '#10b981' : '#ef4444'}">${m.matrixResidueUm} µm (Max: ${m.method.matrixResidueMaxUm} µm)</tspan>
      </text>
      <text x="280" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">
        Peel Force: <tspan fill="${m.isForcePass ? '#10b981' : '#ef4444'}">${m.measuredPeelForceN} N (Max: ${m.method.recommendedPeelForceMaxN} N)</tspan>
      </text>
      <text x="500" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">
        Integrity: <tspan fill="${statusColor}">${m.integrityScore} / 100 (${m.verdict})</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Loads saved ribbon separator audit records from localStorage.
 */
export function loadRibbonSeparatorAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RIBBON_SEPARATOR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves ribbon separator audit records to localStorage.
 */
export function saveRibbonSeparatorAuditLog(records = [], storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.setItem(RIBBON_SEPARATOR_STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
  } catch {}
}

/**
 * Clears saved ribbon separator audit records.
 */
export function clearRibbonSeparatorAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(RIBBON_SEPARATOR_STORAGE_KEY);
  } catch {}
}

/**
 * Generates bilingual WhatsApp text for technician field dispatch.
 */
export function formatRibbonSeparatorWhatsAppText(record) {
  const m = record.metrics;
  const statusEmoji = m.isOverallPass ? '✅' : '⚠️';

  return `*SHAHDARA ISP - RIBBON FIBER SEPARATOR AUDIT* ${statusEmoji}
----------------------------------------
*Audit ID:* ${record.id}
*Date:* ${record.date}
*Technician:* ${record.technician}
*Area / Node:* ${record.area}
*Method:* ${m.method.name}

*RIBBON & BREAKOUT CONFIGURATION:*
- Cable Fiber Count: ${m.cableFiberCount} Cores (${m.totalRibbonsInCable} Ribbons)
- Active Ribbon: Ribbon #${m.ribbonNumber}
- Target Core: ${m.targetCoreLabel}
- Peel Length: ${m.peelLengthMm} mm
- Furcation / Fan-out Kit: ${record.params.fanOutKitType || 'Standard 900µm Tubing'}

*SEPARATION METROLOGY & INTEGRITY:*
- Measured Peel Force: ${m.measuredPeelForceN} N (Max Allowed: ${m.method.recommendedPeelForceMaxN} N) -> ${m.isForcePass ? 'PASS' : 'HIGH FORCE ALERT'}
- Residual Matrix Coating: ${m.matrixResidueUm} µm (Max Allowed: ${m.method.matrixResidueMaxUm} µm) -> ${m.isResiduePass ? 'CLEAN' : 'RESIDUE CLUMPING'}
- Core Integrity Score: ${m.integrityScore} / 100
- Separation Verdict: ${m.ratingText}

*URDU SUMMARY / خلاصہ:*
ربن فائبر ڈی-ربنائزر اور سنگل کور بریک آؤٹ مکمل ہوا۔ پیل فورس ${m.measuredPeelForceN} N ریکارڈ ہوئی اور کور انٹیگریٹی ${m.integrityScore}% ہے۔
----------------------------------------
_Shahdara Optical Splice & Breakout Dispatch_`;
}

/**
 * Generates RFC-4180 compliant CSV export of audit records.
 */
export function generateRibbonSeparatorCsv(records = []) {
  const headers = [
    'TestId',
    'Date',
    'Area',
    'Technician',
    'Method',
    'RibbonNumber',
    'CableCores',
    'TargetCore',
    'PeelLengthMm',
    'PeelForceN',
    'ForcePass',
    'MatrixResidueUm',
    'ResiduePass',
    'IntegrityScore',
    'Verdict',
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
      m.ribbonNumber,
      m.cableFiberCount,
      `"${m.targetCore}"`,
      m.peelLengthMm,
      m.measuredPeelForceN,
      m.isForcePass,
      m.matrixResidueUm,
      m.isResiduePass,
      m.integrityScore,
      `"${m.verdict}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Modal controller for Field Ribbon Fiber De-Ribbonizer Assistant.
 */
export function setupMobileRibbonSeparatorModal(state = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const modal = doc.getElementById('mobileRibbonSeparatorModal');
  const openBtn = doc.getElementById('mobileMoreRibbonSeparatorBtn');
  const closeBtn = doc.getElementById('mobileRibbonSeparatorModalCloseBtn');

  const presetSelect = doc.getElementById('ribbonSeparatorPresetSelect');
  const methodSelect = doc.getElementById('ribbonSeparatorMethodSelect');
  const ribbonNumInput = doc.getElementById('ribbonSeparatorRibbonNumInput');
  const cableCoresSelect = doc.getElementById('ribbonSeparatorCableCoresSelect');
  const peelLengthInput = doc.getElementById('ribbonSeparatorPeelLengthInput');
  const peelForceInput = doc.getElementById('ribbonSeparatorPeelForceInput');
  const residueInput = doc.getElementById('ribbonSeparatorResidueInput');
  const targetCoreSelect = doc.getElementById('ribbonSeparatorTargetCoreSelect');
  const fanOutInput = doc.getElementById('ribbonSeparatorFanOutInput');
  const areaInput = doc.getElementById('ribbonSeparatorAreaInput');
  const techInput = doc.getElementById('ribbonSeparatorTechInput');
  const notesInput = doc.getElementById('ribbonSeparatorNotesInput');

  const svgContainer = doc.getElementById('ribbonSeparatorSvgContainer');
  const statScore = doc.getElementById('ribbonSeparatorStatScore');
  const statForce = doc.getElementById('ribbonSeparatorStatForce');
  const statResidue = doc.getElementById('ribbonSeparatorStatResidue');
  const statVerdict = doc.getElementById('ribbonSeparatorStatVerdict');

  const saveAuditBtn = doc.getElementById('ribbonSeparatorSaveAuditBtn');
  const copyWhatsappBtn = doc.getElementById('ribbonSeparatorCopyWhatsappBtn');
  const exportCsvBtn = doc.getElementById('ribbonSeparatorExportCsvBtn');
  const clearHistoryBtn = doc.getElementById('ribbonSeparatorClearHistoryBtn');
  const historyList = doc.getElementById('ribbonSeparatorHistoryList');

  const getParams = () => ({
    deRibbonMethod: methodSelect?.value || 'MECHANICAL_COMB',
    ribbonNumber: ribbonNumInput?.value || '3',
    cableFiberCount: cableCoresSelect?.value || '144',
    peelLengthMm: peelLengthInput?.value || '75',
    measuredPeelForceN: peelForceInput?.value || '1.8',
    matrixResidueUm: residueInput?.value || '12',
    targetCore: targetCoreSelect?.value || 'ALL_12_CORES',
    fanOutKitType: fanOutInput?.value || '900um Furcation Buffer Tubing'
  });

  const renderView = () => {
    const isDark = doc.documentElement && doc.documentElement.getAttribute('data-theme') === 'dark';
    const params = getParams();
    const metrics = calculateRibbonSeparatorMetrics(params);

    if (svgContainer) {
      svgContainer.innerHTML = renderRibbonSeparatorSvg(metrics, { isDark });
    }

    if (statScore) {
      statScore.textContent = `${metrics.integrityScore} / 100`;
      statScore.style.color = metrics.isOverallPass ? '#10b981' : '#f59e0b';
    }
    if (statForce) {
      statForce.textContent = `${metrics.measuredPeelForceN} N (${metrics.isForcePass ? 'PASS' : 'HIGH'})`;
      statForce.style.color = metrics.isForcePass ? '#10b981' : '#ef4444';
    }
    if (statResidue) {
      statResidue.textContent = `${metrics.matrixResidueUm} µm (${metrics.isResiduePass ? 'PASS' : 'CLUMP'})`;
      statResidue.style.color = metrics.isResiduePass ? '#10b981' : '#ef4444';
    }
    if (statVerdict) {
      statVerdict.textContent = metrics.verdict;
      statVerdict.style.color = metrics.isOverallPass ? '#10b981' : '#ef4444';
    }
  };

  const renderHistory = () => {
    if (!historyList) return;
    const records = loadRibbonSeparatorAuditLog(storage);
    if (!records.length) {
      historyList.innerHTML = '<li class="empty-log-item" style="padding: 10px; color: var(--text-muted, #94a3b8); font-size: 0.85rem; text-align: center;">No ribbon breakout audits recorded yet.</li>';
      return;
    }

    historyList.innerHTML = records.map(r => `
      <li class="history-item" style="border: 1px solid var(--border-color, #e2e8f0); border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; font-size: 0.85rem;">
        <div style="display: flex; justify-content: space-between; font-weight: 700;">
          <span>${r.id} · ${r.area}</span>
          <span style="color: ${r.metrics.isOverallPass ? '#10b981' : '#ef4444'};">${r.metrics.isOverallPass ? 'PASS' : 'RISK'}</span>
        </div>
        <div style="color: var(--text-muted, #94a3b8); font-size: 0.8rem; margin: 2px 0;">
          ${r.date} · Tech: ${r.technician} · Ribbon #${r.metrics.ribbonNumber} · ${r.metrics.cableFiberCount}F
        </div>
        <div>
          Integrity: <strong>${r.metrics.integrityScore}/100</strong> · Force: <strong>${r.metrics.measuredPeelForceN} N</strong> · Residue: <strong>${r.metrics.matrixResidueUm} µm</strong>
        </div>
      </li>
    `).join('');
  };

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const preset = RIBBON_PRESETS.find(p => p.id === presetSelect.value);
      if (preset) {
        if (methodSelect) methodSelect.value = preset.deRibbonMethod;
        if (ribbonNumInput) ribbonNumInput.value = preset.ribbonNumber;
        if (cableCoresSelect) cableCoresSelect.value = String(preset.cableFiberCount);
        if (peelLengthInput) peelLengthInput.value = preset.peelLengthMm;
        if (peelForceInput) peelForceInput.value = preset.measuredPeelForceN;
        if (residueInput) residueInput.value = preset.matrixResidueUm;
        if (targetCoreSelect) targetCoreSelect.value = preset.targetCore;
        if (fanOutInput) fanOutInput.value = preset.fanOutKitType;
        if (areaInput) areaInput.value = preset.area;
        if (techInput) techInput.value = preset.technician;
        if (notesInput) notesInput.value = preset.notes;
        renderView();
      }
    });
  }

  [methodSelect, ribbonNumInput, cableCoresSelect, peelLengthInput, peelForceInput, residueInput, targetCoreSelect].forEach(el => {
    if (el) {
      el.addEventListener('change', renderView);
      el.addEventListener('input', renderView);
    }
  });

  if (saveAuditBtn) {
    saveAuditBtn.addEventListener('click', () => {
      const params = getParams();
      const metrics = calculateRibbonSeparatorMetrics(params);
      const record = {
        id: `RBN-${Date.now().toString(36).toUpperCase()}`,
        date: new Date().toLocaleString(),
        area: areaInput?.value || 'Shahdara Area',
        technician: techInput?.value || 'Splice Technician',
        notes: notesInput?.value || '',
        params,
        metrics
      };
      const records = loadRibbonSeparatorAuditLog(storage);
      records.unshift(record);
      saveRibbonSeparatorAuditLog(records, storage);
      renderHistory();
      if (typeof options.onToast === 'function') {
        options.onToast('Ribbon separator audit saved successfully');
      }
    });
  }

  if (copyWhatsappBtn) {
    copyWhatsappBtn.addEventListener('click', () => {
      const params = getParams();
      const metrics = calculateRibbonSeparatorMetrics(params);
      const record = {
        id: `RBN-${Date.now().toString(36).toUpperCase()}`,
        date: new Date().toLocaleString(),
        area: areaInput?.value || 'Shahdara Area',
        technician: techInput?.value || 'Splice Technician',
        notes: notesInput?.value || '',
        params,
        metrics
      };
      const text = formatRibbonSeparatorWhatsAppText(record);
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
      const records = loadRibbonSeparatorAuditLog(storage);
      if (!records.length) {
        if (typeof options.onToast === 'function') options.onToast('No records to export');
        return;
      }
      const csvStr = generateRibbonSeparatorCsv(records);
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
      clearRibbonSeparatorAuditLog(storage);
      renderHistory();
      if (typeof options.onToast === 'function') {
        options.onToast('Ribbon audit history cleared');
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
