/**
 * Shahdara ISP - Field Optical Connector Cleaning & Telcordia GR-2923-CORE Sanitation Assistant
 *
 * Provides FTTH field fiber mechanics, technicians, and splicing crews with:
 * - Telcordia GR-2923-CORE & IEC 62627-01 standardized optical end-face cleaning workflows
 * - Tool lifecycle management: 2.5mm & 1.25mm push-action click-cleaner pen click counters, dry-reel cassette swipe indexing
 * - Contamination physics diagnostics: skin oils, silica dust, buffer gel, alcohol residue, mating sleeve debris
 * - Recommended cleaning protocol (Dry click vs Wet-to-Dry combination solvent wipe)
 * - Static charge dissipation risk calculation based on ambient humidity and repeated rubbing
 * - Pure-vector responsive SVG visualizer illustrating cleaning action & ribbon contact
 * - LocalStorage persistence (shahdara_connector_cleaning_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const CONNECTOR_CLEANING_STORAGE_KEY = 'shahdara_connector_cleaning_audits_v1';
export const CLEANER_TOOL_STATE_STORAGE_KEY = 'shahdara_cleaner_tool_counters_v1';

export const CLEANING_TOOLS = {
  CLICK_PEN_25: {
    id: 'CLICK_PEN_25',
    name: '2.5mm Push-Type Click Cleaner Pen (SC / FC / ST)',
    targetFerrule: '2.5mm Zirconia Ferrule',
    defaultCapacity: 800,
    applications: ['SC/APC & SC/UPC Drop Ports', 'FAT Box Bulkheads', 'Splitter Ports', 'ODF Patch Panels'],
    actionType: 'Rotational 360° micro-weave fabric push click',
    recommendedUse: 'Bulkhead adapters and male patch cord ferrules'
  },
  CLICK_PEN_125: {
    id: 'CLICK_PEN_125',
    name: '1.25mm Push-Type Click Cleaner Pen (LC / MU)',
    targetFerrule: '1.25mm Ferrule',
    defaultCapacity: 800,
    applications: ['SFP / SFP+ / GPON OLT Optical Transceivers', 'LC/UPC & LC/APC High-Density Trunks'],
    actionType: 'Rotational 360° micro-weave fabric push click',
    recommendedUse: 'Optical transceivers & high-density patch fields'
  },
  CASSETTE_REEL: {
    id: 'CASSETTE_REEL',
    name: 'Dry Microfiber Reel Cassette Cleaner (Cletop / Optipop)',
    targetFerrule: 'All Universal Male Ferrules (2.5mm & 1.25mm)',
    defaultCapacity: 400,
    applications: ['Patch Cords', 'Pigtails prior to Fusion Splicing', 'OTDR Launch Cables'],
    actionType: 'Linear bi-directional lint-free ribbon swipe with anti-static shutter',
    recommendedUse: 'Unconnected patch cords, launch fibers, and pigtails'
  },
  WET_TO_DRY_WIPE: {
    id: 'WET_TO_DRY_WIPE',
    name: 'Solvent Pen & Lint-Free Microfiber Wipe (Wet-to-Dry Pad)',
    targetFerrule: 'Universal Severe Contamination',
    defaultCapacity: 280,
    applications: ['Heavy Fingerprint Oils', 'Flooding Buffer Gel Contamination', 'Baked-on Dust'],
    actionType: 'Solvent spot dissolution followed by dry wipe over elastomer backing',
    recommendedUse: 'Stubborn contaminants resistant to dry click-cleaning'
  },
  CLEANING_SWAB_25: {
    id: 'CLEANING_SWAB_25',
    name: '2.5mm Precision Lint-Free Foam/Fabric Swab',
    targetFerrule: '2.5mm Recessed Bulkheads',
    defaultCapacity: 100,
    applications: ['Recessed FAT Splitter Sleeves', 'Severe adapter sleeve fouling'],
    actionType: 'Manual clockwise swab twist with optical-grade solvent dab',
    recommendedUse: 'Hard-to-reach female bulkhead mating sleeves'
  }
};

export const CONTAMINATION_TYPES = {
  DUST_AIRBORNE: {
    id: 'DUST_AIRBORNE',
    name: 'Dry Ambient Silica Dust & Grit',
    riskLevel: 'Moderate',
    difficulty: 'Easy',
    recommendedProtocol: 'DRY_CLICK',
    description: 'Dry airborne particulate adhering via electrostatic charges. Easily removed by 1 dry click or 1 cassette swipe.'
  },
  SKIN_OIL: {
    id: 'SKIN_OIL',
    name: 'Human Fingerprint & Skin Lipid Oil',
    riskLevel: 'High',
    difficulty: 'Moderate',
    recommendedProtocol: 'WET_TO_DRY',
    description: 'Organic oils that smear across the fiber core if dry-wiped. Requires optical solvent to dissolve, then dry wipe.'
  },
  BUFFER_GEL: {
    id: 'BUFFER_GEL',
    name: 'Thixotropic Buffer Tube Water-Blocking Gel',
    riskLevel: 'Severe',
    difficulty: 'Difficult',
    recommendedProtocol: 'SOLVENT_WIPE_DOUBLE',
    description: 'Petroleum/hydrocarbon gel from loose tube cable stripping. Leaves viscous residue. Requires double solvent wipe.'
  },
  ALCOHOL_RESIDUE: {
    id: 'ALCOHOL_RESIDUE',
    name: 'Mineral Salts / Impure Alcohol Halo',
    riskLevel: 'Moderate',
    difficulty: 'Moderate',
    recommendedProtocol: 'DRY_CASSETTE_SWIPE',
    description: 'Dried mineral ring from low-purity IPA or wet wiping without dry buffing. Removed with dry micro-weave cassette.'
  },
  CERAMIC_DEBRIS: {
    id: 'CERAMIC_DEBRIS',
    name: 'Zirconia Sleeve Wear Shavings & Metal Grit',
    riskLevel: 'High',
    difficulty: 'Moderate',
    recommendedProtocol: 'AIR_PUFF_THEN_CLICK',
    description: 'Hard micro-fragments from repeated connector insertions. Dry click with dust aspiration or clean swab.'
  }
};

export const CLEANING_PRESETS = [
  {
    id: 'routine-fat-drop',
    name: 'FAT Drop Port Routine Commissioning',
    location: 'FAT-03 Baradari Chungi Port 06',
    connectorType: 'SC/APC (2.5mm)',
    toolId: 'CLICK_PEN_25',
    contaminationId: 'DUST_AIRBORNE',
    ambientHumidityPercent: 45,
    clicksAttempted: 1,
    notes: 'Routine connector cleaning before customer ONT drop connection.'
  },
  {
    id: 'oily-patch-cord',
    name: 'Accidental Fingerprint on ODF Patch Cord',
    location: 'Main POP ODF Rack 02 Port 18',
    connectorType: 'SC/UPC (2.5mm)',
    toolId: 'WET_TO_DRY_WIPE',
    contaminationId: 'SKIN_OIL',
    ambientHumidityPercent: 35,
    clicksAttempted: 2,
    notes: 'Technician accidentally touched ferrule face during re-patching.'
  },
  {
    id: 'olt-sfp-cleaning',
    name: 'GPON OLT Transceiver Bulkhead Cleaning',
    location: 'Shahdara Main POP Subrack 1 Slot 4 Port 2',
    connectorType: 'LC/UPC (1.25mm)',
    toolId: 'CLICK_PEN_125',
    contaminationId: 'DUST_AIRBORNE',
    ambientHumidityPercent: 50,
    clicksAttempted: 1,
    notes: 'Transceiver optical port sanitization prior to trunk link activation.'
  },
  {
    id: 'buffer-gel-pigtail',
    name: 'Buffer Gel Contaminated Pigtail at Joint Closure',
    location: 'FJB-02 Ravi Bridge Closure Tray 3',
    connectorType: 'SC/APC (2.5mm)',
    toolId: 'WET_TO_DRY_WIPE',
    contaminationId: 'BUFFER_GEL',
    ambientHumidityPercent: 65,
    clicksAttempted: 3,
    notes: 'Cable flooding compound fouled pigtail connector during mid-span pull.'
  }
];

/**
 * Calculates cleaning sanitation recommendation, remaining tool clicks, and static triboelectric risk.
 *
 * @param {Object} params
 * @param {string} params.toolId
 * @param {string} params.contaminationId
 * @param {number} params.ambientHumidityPercent
 * @param {number} params.clicksAttempted
 * @param {number} [params.currentClicksRemaining]
 * @returns {Object}
 */
export function evaluateCleaningProtocol(params) {
  const tool = CLEANING_TOOLS[params.toolId] || CLEANING_TOOLS.CLICK_PEN_25;
  const contamination = CONTAMINATION_TYPES[params.contaminationId] || CONTAMINATION_TYPES.DUST_AIRBORNE;
  const humidity = typeof params.ambientHumidityPercent === 'number'
    ? Math.max(5, Math.min(95, params.ambientHumidityPercent))
    : 45;
  const clicks = Math.max(1, parseInt(params.clicksAttempted, 10) || 1);

  // Static charge risk increases when relative humidity is low (< 35%) and multiple dry clicks are performed
  let staticChargeKv = 0.2;
  if (humidity < 30) {
    staticChargeKv += (30 - humidity) * 0.12 * Math.min(clicks, 4);
  } else if (humidity < 45) {
    staticChargeKv += (45 - humidity) * 0.04 * Math.min(clicks, 4);
  }

  let staticRiskLevel = 'LOW';
  let staticRiskColor = '#10b981';
  let staticWarning = 'Minimal triboelectric charge accumulation. Safe dry environment.';
  if (staticChargeKv >= 2.0) {
    staticRiskLevel = 'CRITICAL';
    staticRiskColor = '#ef4444';
    staticWarning = 'High static charge will actively attract airborne dust within 10 seconds. Use anti-static solvent or ionizing wipe.';
  } else if (staticChargeKv >= 1.0) {
    staticRiskLevel = 'MODERATE';
    staticRiskColor = '#f59e0b';
    staticWarning = 'Moderate charge buildup. Avoid excessive dry rubbing; cap immediately if not mating.';
  }

  // Determine standard protocol
  let protocolName = '1-Click Dry Clean';
  let protocolSteps = [
    'Insert guide tip squarely into bulkhead or ferrule cap until seated.',
    'Push outer housing smoothly until a single audible click is heard.',
    'Rotate 0° (click mechanism automatically indexes ribbon 360°).',
    'Carefully withdraw tip straight out without touching ferrule edge.'
  ];
  let recommendedSolvent = false;
  let reInspectionRequired = true;
  let estimatedSuccessRatePercent = 95;

  if (contamination.id === 'SKIN_OIL') {
    protocolName = 'Wet-to-Dry Combination Cleaning (GR-2923)';
    protocolSteps = [
      'Moisten cleaning wipe or pen tip with 1 small dab of precision optical solvent (or 99.9% IPA).',
      'Swipe ferrule across damp spot with gentle, consistent pressure (wet action dissolves oil film).',
      'Immediately swipe across adjacent dry microfiber area in one direction (dry action lifts solvent residue).',
      'Never wipe in figure-8 or circular motions on manual wipes to prevent dragging dirt back onto core.'
    ];
    recommendedSolvent = true;
    estimatedSuccessRatePercent = 92;
  } else if (contamination.id === 'BUFFER_GEL') {
    protocolName = 'Double Solvent Degrease & Cassette Swipe';
    protocolSteps = [
      'Apply optical degreaser solvent generously to lint-free wipe.',
      'Wrap wipe around ferrule and twist gently to dissolve petroleum/silicone gel.',
      'Perform secondary swipe across fresh dry lint-free wipe.',
      'Finish with 1 click of push pen or cassette reel to remove any microscopic solvent residue.'
    ];
    recommendedSolvent = true;
    estimatedSuccessRatePercent = 88;
  } else if (contamination.id === 'CERAMIC_DEBRIS') {
    protocolName = 'Air Debris Blow + Dry Click';
    protocolSteps = [
      'Invert bulkhead / connector and puff filtered optical dry air to dislodge hard ceramic grit.',
      'Avoid high-velocity air directly onto fiber core from zero distance.',
      'Perform 1 dry click cleaner pen engagement.',
      'Inspect with video microscope before physical mating to prevent core pitting.'
    ];
    estimatedSuccessRatePercent = 94;
  } else if (contamination.id === 'ALCOHOL_RESIDUE') {
    protocolName = 'Dry Microfiber Reel Cassette Buff';
    protocolSteps = [
      'Advance clean cassette ribbon slot by depressing shutter lever.',
      'Place ferrule perpendicular to ribbon surface with light pressure.',
      'Swipe ferrule in single linear direction along the clean fabric path.',
      'Never back-swipe across used tape.'
    ];
    estimatedSuccessRatePercent = 98;
  }

  // Adjust success rate based on clicks attempted
  if (clicks > 3 && !recommendedSolvent && contamination.id === 'SKIN_OIL') {
    estimatedSuccessRatePercent = 65; // Dry wiping oil repeatedly smears it!
  } else if (clicks === 2 && recommendedSolvent) {
    estimatedSuccessRatePercent = Math.min(99, estimatedSuccessRatePercent + 4);
  }

  return {
    tool,
    contamination,
    humidity,
    clicks,
    staticChargeKv: Math.round(staticChargeKv * 100) / 100,
    staticRiskLevel,
    staticRiskColor,
    staticWarning,
    protocolName,
    protocolSteps,
    recommendedSolvent,
    reInspectionRequired,
    estimatedSuccessRatePercent,
    isCompliant: estimatedSuccessRatePercent >= 85
  };
}

/**
 * Generates an SVG visualizing the cleaning mechanism, cleaner tip, and ferrule end-face.
 *
 * @param {Object} evalResult Result from evaluateCleaningProtocol
 * @returns {string} SVG string
 */
export function renderCleaningSvg(evalResult) {
  const isWetToDry = evalResult.recommendedSolvent;
  const toolName = evalResult.tool ? evalResult.tool.name : 'Cleaning Pen';
  const protocol = evalResult.protocolName;
  const riskColor = evalResult.staticRiskColor;
  const staticKv = evalResult.staticChargeKv;

  return `
<svg viewBox="0 0 560 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Connector Cleaning Diagram" style="width:100%;max-width:560px;height:auto;display:block;margin:0 auto;background:#0f172a;border-radius:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.3);font-family:system-ui,-apple-system,sans-serif;">
  <defs>
    <linearGradient id="ferruleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="50%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>
    <linearGradient id="penBodyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="ribbonGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="100%" stop-color="#fef9c3" />
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Header & Protocol Label -->
  <rect x="0" y="0" width="560" height="38" fill="#1e293b" />
  <text x="20" y="24" fill="#38bdf8" font-size="13" font-weight="700">GR-2923 / IEC 62627-01 CLEANING PROCESS</text>
  <rect x="420" y="10" width="125" height="20" rx="4" fill="${evalResult.isCompliant ? '#065f46' : '#7f1d1d'}" />
  <text x="482" y="24" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">${evalResult.isCompliant ? 'PASS RECOMMENDED' : 'CAUTION PROTOCOL'}</text>

  <!-- Left: Fiber Connector Ferrule Dome -->
  <g transform="translate(40, 60)">
    <rect x="0" y="20" width="90" height="90" rx="4" fill="#334155" stroke="#64748b" stroke-width="2" />
    <text x="45" y="15" fill="#94a3b8" font-size="10" text-anchor="middle" font-weight="600">CONNECTOR FERRULE</text>
    
    <!-- Zirconia ceramic white barrel -->
    <path d="M 40,30 L 90,30 L 90,100 L 40,100 Q 15,65 40,30 Z" fill="url(#ferruleGrad)" stroke="#64748b" stroke-width="1.5" />
    
    <!-- 8 deg APC tilt or flat dome -->
    <ellipse cx="40" cy="65" rx="5" ry="32" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1" />
    
    <!-- Optical core center point -->
    <circle cx="40" cy="65" r="3" fill="#0284c7" filter="url(#softGlow)" />
    <circle cx="40" cy="65" r="1.5" fill="#38bdf8" />
    <text x="40" y="125" fill="#e2e8f0" font-size="10" text-anchor="middle">9µm Core / 125µm Cladding</text>
  </g>

  <!-- Middle: Cleaning Action Interface -->
  <g transform="translate(190, 75)">
    <!-- Contact motion arrow -->
    <path d="M 0,50 L 50,50" stroke="${isWetToDry ? '#06b6d4' : '#f59e0b'}" stroke-width="3" stroke-dasharray="4,2" />
    <polygon points="45,45 55,50 45,55" fill="${isWetToDry ? '#06b6d4' : '#f59e0b'}" />

    <!-- Ribbon / Tip Microfiber Strand -->
    <rect x="58" y="25" width="14" height="50" rx="3" fill="url(#ribbonGrad)" stroke="#eab308" stroke-width="1.5" />
    <line x1="65" y1="28" x2="65" y2="72" stroke="#ca8a04" stroke-width="1" stroke-dasharray="2,2" />

    <!-- Action indicator text -->
    <text x="35" y="20" fill="#f8fafc" font-size="11" font-weight="700" text-anchor="middle">${isWetToDry ? 'SOLVENT DISSOLVE' : 'ROTATIONAL SWIPE'}</text>
    <text x="35" y="95" fill="#94a3b8" font-size="9" text-anchor="middle">360° Micro-Weave Index</text>
  </g>

  <!-- Right: Cleaning Pen or Cassette Body -->
  <g transform="translate(280, 60)">
    <rect x="0" y="28" width="120" height="74" rx="6" fill="url(#penBodyGrad)" stroke="#60a5fa" stroke-width="2" />
    <text x="60" y="15" fill="#94a3b8" font-size="10" text-anchor="middle" font-weight="600">CLEANING TOOL BODY</text>

    <!-- Cleaner Tip Guide Extension -->
    <rect x="-18" y="52" width="18" height="26" fill="#475569" stroke="#94a3b8" stroke-width="1" />

    <!-- Tool details inside body -->
    <text x="60" y="52" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">${evalResult.tool.id === 'CASSETTE_REEL' ? 'CASS-REEL' : 'PUSH PEN'}</text>
    <text x="60" y="68" fill="#bfdbfe" font-size="9" text-anchor="middle">${evalResult.clicks} Click(s) Engaged</text>
    <text x="60" y="85" fill="#e0f2fe" font-size="8" text-anchor="middle">${evalResult.tool.targetFerrule}</text>

    <!-- Spring click arrow -->
    <path d="M 125,65 L 145,65" stroke="#38bdf8" stroke-width="2" />
    <polygon points="125,62 120,65 125,68" fill="#38bdf8" />
  </g>

  <!-- Bottom Panel: Protocol & Triboelectric Static Risk -->
  <g transform="translate(20, 185)">
    <rect x="0" y="0" width="520" height="65" rx="6" fill="#1e293b" stroke="#334155" stroke-width="1" />
    <text x="15" y="22" fill="#f8fafc" font-size="12" font-weight="700">Protocol: ${protocol}</text>
    <text x="15" y="40" fill="#94a3b8" font-size="10">Contamination: <tspan fill="#facc15" font-weight="600">${evalResult.contamination.name}</tspan> | RH: <tspan fill="#e2e8f0">${evalResult.humidity}%</tspan></text>
    <text x="15" y="55" fill="#94a3b8" font-size="10">Expected 1st-Pass Success: <tspan fill="#34d399" font-weight="700">${evalResult.estimatedSuccessRatePercent}%</tspan></text>

    <!-- Static Charge Badge -->
    <rect x="365" y="14" width="140" height="38" rx="4" fill="#0f172a" stroke="${riskColor}" stroke-width="1.5" />
    <text x="435" y="29" fill="${riskColor}" font-size="10" font-weight="700" text-anchor="middle">STATIC CHARGE: ${staticKv} kV</text>
    <text x="435" y="44" fill="#94a3b8" font-size="8.5" text-anchor="middle">Risk: ${evalResult.staticRiskLevel}</text>
  </g>
</svg>
`.trim();
}

/**
 * Saves a cleaning audit record into localStorage.
 *
 * @param {Object} record
 * @returns {Array} Updated array of records
 */
export function saveCleaningRecord(record) {
  try {
    const raw = localStorage.getItem(CONNECTOR_CLEANING_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const completeRecord = {
      id: record.id || `CLEAN-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: record.timestamp || new Date().toISOString(),
      location: record.location || 'Shahdara Distribution Zone',
      connectorType: record.connectorType || 'SC/APC',
      toolId: record.toolId || 'CLICK_PEN_25',
      toolName: record.toolName || '2.5mm Push Click Pen',
      contaminationId: record.contaminationId || 'DUST_AIRBORNE',
      contaminationName: record.contaminationName || 'Dry Silica Dust',
      humidityPercent: record.humidityPercent || 45,
      clicksAttempted: record.clicksAttempted || 1,
      protocolName: record.protocolName || '1-Click Dry Clean',
      recommendedSolvent: !!record.recommendedSolvent,
      staticChargeKv: record.staticChargeKv || 0.2,
      staticRiskLevel: record.staticRiskLevel || 'LOW',
      estimatedSuccessRatePercent: record.estimatedSuccessRatePercent || 95,
      technicianName: record.technicianName || 'Field Linesman',
      notes: record.notes || ''
    };
    list.unshift(completeRecord);
    // Keep up to 100 recent records
    const trimmed = list.slice(0, 100);
    localStorage.setItem(CONNECTOR_CLEANING_STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.error('Failed to save connector cleaning record to localStorage:', err);
    return [];
  }
}

/**
 * Loads all cleaning audit records from localStorage.
 *
 * @returns {Array}
 */
export function loadCleaningRecords() {
  try {
    const raw = localStorage.getItem(CONNECTOR_CLEANING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load connector cleaning records:', err);
    return [];
  }
}

/**
 * Clears all cleaning audit records.
 */
export function clearCleaningRecords() {
  try {
    localStorage.removeItem(CONNECTOR_CLEANING_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear cleaning records:', err);
  }
}

/**
 * Retrieves tool counters from localStorage or defaults.
 *
 * @returns {Object}
 */
export function loadToolCounters() {
  try {
    const raw = localStorage.getItem(CLEANER_TOOL_STATE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read tool counters:', e);
  }
  const defaults = {};
  Object.keys(CLEANING_TOOLS).forEach(k => {
    defaults[k] = CLEANING_TOOLS[k].defaultCapacity;
  });
  return defaults;
}

/**
 * Decrements click counter for a specific tool.
 *
 * @param {string} toolId
 * @param {number} count
 * @returns {number} Remaining count
 */
export function decrementToolCounter(toolId, count = 1) {
  const counters = loadToolCounters();
  const current = counters[toolId] !== undefined ? counters[toolId] : (CLEANING_TOOLS[toolId]?.defaultCapacity || 500);
  const updated = Math.max(0, current - count);
  counters[toolId] = updated;
  try {
    localStorage.setItem(CLEANER_TOOL_STATE_STORAGE_KEY, JSON.stringify(counters));
  } catch (e) {
    console.warn('Could not save tool counters:', e);
  }
  return updated;
}

/**
 * Resets a tool click counter back to its factory default capacity.
 *
 * @param {string} toolId
 * @returns {number}
 */
export function resetToolCounter(toolId) {
  const counters = loadToolCounters();
  const capacity = CLEANING_TOOLS[toolId]?.defaultCapacity || 800;
  counters[toolId] = capacity;
  try {
    localStorage.setItem(CLEANER_TOOL_STATE_STORAGE_KEY, JSON.stringify(counters));
  } catch (e) {
    console.warn('Could not reset tool counter:', e);
  }
  return capacity;
}

/**
 * Generates RFC-4180 compliant CSV export for cleaning audits.
 *
 * @param {Array} records
 * @returns {string}
 */
export function exportCleaningCsv(records) {
  const headers = [
    'Record ID',
    'Timestamp',
    'Location',
    'Connector Type',
    'Tool Used',
    'Contamination',
    'RH (%)',
    'Clicks',
    'Protocol',
    'Solvent Used',
    'Static (kV)',
    'Static Risk',
    'Success Rate (%)',
    'Technician',
    'Notes'
  ];

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = (records || []).map(r => [
    escapeCell(r.id),
    escapeCell(r.timestamp),
    escapeCell(r.location),
    escapeCell(r.connectorType),
    escapeCell(r.toolName || r.toolId),
    escapeCell(r.contaminationName || r.contaminationId),
    escapeCell(r.humidityPercent),
    escapeCell(r.clicksAttempted),
    escapeCell(r.protocolName),
    escapeCell(r.recommendedSolvent ? 'YES' : 'NO'),
    escapeCell(r.staticChargeKv),
    escapeCell(r.staticRiskLevel),
    escapeCell(r.estimatedSuccessRatePercent),
    escapeCell(r.technicianName),
    escapeCell(r.notes)
  ].join(','));

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Formats a bilingual WhatsApp dispatch message for field technicians.
 *
 * @param {Object} record
 * @returns {string}
 */
export function formatCleaningWhatsAppText(record) {
  const solventBadge = record.recommendedSolvent ? '💧 Solvent Wet-to-Dry Required' : '💨 Dry Click Action';
  const complianceBadge = (record.estimatedSuccessRatePercent || 0) >= 85 ? '✅ PASS READY' : '⚠️ HIGH CONTAMINATION';

  return `*SHAHDARA ISP - OPTICAL CONNECTOR SANITATION AUDIT*
📍 *Location / مقام:* ${record.location || 'Shahdara Network'}
🔌 *Connector:* ${record.connectorType || 'SC/APC'}
🛠️ *Tool:* ${record.toolName || record.toolId}
🔍 *Contaminant:* ${record.contaminationName || record.contaminationId}
📋 *Protocol:* ${record.protocolName}
✨ *Status:* ${complianceBadge}
⚡ *Static Risk:* ${record.staticRiskLevel} (${record.staticChargeKv} kV at ${record.humidityPercent}% RH)
🧪 *Solvent Method:* ${solventBadge}
🎯 *1st-Pass Success:* ${record.estimatedSuccessRatePercent}%
👤 *Tech:* ${record.technicianName || 'Field Linesman'}
🕒 *Date:* ${record.timestamp ? new Date(record.timestamp).toLocaleString() : new Date().toLocaleString()}
${record.notes ? `📝 *Notes:* ${record.notes}` : ''}

_Telcordia GR-2923-CORE & IEC 62627-01 Certified Sanitation_`.trim();
}

/**
 * Binds UI modal dialog for the mobile connector cleaning assistant.
 *
 * @param {Object} [options]
 * @param {Document} [options.doc]
 * @returns {Object} Controller with open, close, and refresh methods
 */
export function setupMobileConnectorCleaningModal(options = {}) {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const modal = doc.getElementById('mobileConnectorCleaningModal');
  const openBtn = doc.getElementById('mobileMoreConnectorCleaningBtn');
  const closeBtn = doc.getElementById('closeMobileConnectorCleaningModalBtn');

  const presetSelect = doc.getElementById('cleanPresetSelect');
  const locationInput = doc.getElementById('cleanLocationInput');
  const connectorInput = doc.getElementById('cleanConnectorInput');
  const toolSelect = doc.getElementById('cleanToolSelect');
  const contaminationSelect = doc.getElementById('cleanContaminationSelect');
  const humidityInput = doc.getElementById('cleanHumidityInput');
  const clicksInput = doc.getElementById('cleanClicksInput');
  const notesInput = doc.getElementById('cleanNotesInput');
  const techInput = doc.getElementById('cleanTechInput');

  const toolLifeRemainingEl = doc.getElementById('cleanToolLifeRemaining');
  const resetToolBtn = doc.getElementById('cleanResetToolBtn');

  const diagramContainer = doc.getElementById('cleanDiagramContainer');
  const protocolNameEl = doc.getElementById('cleanProtocolName');
  const protocolStepsList = doc.getElementById('cleanProtocolStepsList');
  const staticBadgeEl = doc.getElementById('cleanStaticBadge');
  const successRateEl = doc.getElementById('cleanSuccessRate');
  const staticWarningEl = doc.getElementById('cleanStaticWarning');

  const saveAuditBtn = doc.getElementById('cleanSaveAuditBtn');
  const exportCsvBtn = doc.getElementById('cleanExportCsvBtn');
  const shareWhatsAppBtn = doc.getElementById('cleanShareWhatsAppBtn');
  const auditHistoryList = doc.getElementById('cleanAuditHistoryList');
  const clearHistoryBtn = doc.getElementById('cleanClearHistoryBtn');

  let currentEval = null;

  function updateToolLifeBadge() {
    if (!toolSelect || !toolLifeRemainingEl) return;
    const toolId = toolSelect.value;
    const counters = loadToolCounters();
    const remaining = counters[toolId] !== undefined ? counters[toolId] : (CLEANING_TOOLS[toolId]?.defaultCapacity || 800);
    const capacity = CLEANING_TOOLS[toolId]?.defaultCapacity || 800;
    const pct = Math.round((remaining / capacity) * 100);

    toolLifeRemainingEl.textContent = `${remaining} / ${capacity} (${pct}%)`;
    if (pct < 10) {
      toolLifeRemainingEl.style.color = '#ef4444';
    } else if (pct < 30) {
      toolLifeRemainingEl.style.color = '#f59e0b';
    } else {
      toolLifeRemainingEl.style.color = '#10b981';
    }
  }

  function recalculate() {
    if (!toolSelect || !contaminationSelect) return;
    const toolId = toolSelect.value;
    const contaminationId = contaminationSelect.value;
    const humidity = parseFloat(humidityInput?.value || '45');
    const clicks = parseInt(clicksInput?.value || '1', 10);

    currentEval = evaluateCleaningProtocol({
      toolId,
      contaminationId,
      ambientHumidityPercent: humidity,
      clicksAttempted: clicks
    });

    if (diagramContainer) {
      diagramContainer.innerHTML = renderCleaningSvg(currentEval);
    }
    if (protocolNameEl) {
      protocolNameEl.textContent = currentEval.protocolName;
    }
    if (protocolStepsList) {
      protocolStepsList.innerHTML = currentEval.protocolSteps.map(s => `<li>${s}</li>`).join('');
    }
    if (staticBadgeEl) {
      staticBadgeEl.textContent = `${currentEval.staticChargeKv} kV (${currentEval.staticRiskLevel})`;
      staticBadgeEl.style.backgroundColor = currentEval.staticRiskColor;
    }
    if (successRateEl) {
      successRateEl.textContent = `${currentEval.estimatedSuccessRatePercent}% Expected 1st-Pass`;
      successRateEl.style.color = currentEval.isCompliant ? '#10b981' : '#f59e0b';
    }
    if (staticWarningEl) {
      staticWarningEl.textContent = currentEval.staticWarning;
    }

    updateToolLifeBadge();
  }

  function renderHistory() {
    if (!auditHistoryList) return;
    const records = loadCleaningRecords();
    if (!records.length) {
      auditHistoryList.innerHTML = '<li class="text-muted" style="padding:8px;font-size:12px;">No connector sanitation audits recorded yet.</li>';
      return;
    }
    auditHistoryList.innerHTML = records.slice(0, 15).map(r => `
      <li class="audit-item" style="border-bottom:1px solid rgba(255,255,255,0.08);padding:8px 4px;font-size:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;color:#f8fafc;">${r.location} (${r.connectorType})</div>
          <div style="color:#94a3b8;font-size:11px;">${r.toolName || r.toolId} &bull; ${r.protocolName}</div>
          <div style="color:#64748b;font-size:10px;">${new Date(r.timestamp).toLocaleTimeString()} &bull; Tech: ${r.technicianName}</div>
        </div>
        <div style="text-align:right;">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;background:${r.estimatedSuccessRatePercent >= 85 ? '#065f46' : '#7f1d1d'};color:#ffffff;">
            ${r.estimatedSuccessRatePercent}%
          </span>
          <div style="font-size:10px;color:${r.staticRiskLevel === 'CRITICAL' ? '#ef4444' : '#94a3b8'};margin-top:2px;">
            ${r.staticChargeKv} kV
          </div>
        </div>
      </li>
    `).join('');
  }

  // Populate presets
  if (presetSelect && presetSelect.options.length <= 1) {
    CLEANING_PRESETS.forEach(p => {
      const opt = doc.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      presetSelect.appendChild(opt);
    });
  }

  // Populate tools
  if (toolSelect && toolSelect.options.length === 0) {
    Object.keys(CLEANING_TOOLS).forEach(k => {
      const opt = doc.createElement('option');
      opt.value = k;
      opt.textContent = CLEANING_TOOLS[k].name;
      toolSelect.appendChild(opt);
    });
  }

  // Populate contaminations
  if (contaminationSelect && contaminationSelect.options.length === 0) {
    Object.keys(CONTAMINATION_TYPES).forEach(k => {
      const opt = doc.createElement('option');
      opt.value = k;
      opt.textContent = CONTAMINATION_TYPES[k].name;
      contaminationSelect.appendChild(opt);
    });
  }

  // Preset change handler
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const p = CLEANING_PRESETS.find(x => x.id === presetSelect.value);
      if (!p) return;
      if (locationInput) locationInput.value = p.location;
      if (connectorInput) connectorInput.value = p.connectorType;
      if (toolSelect) toolSelect.value = p.toolId;
      if (contaminationSelect) contaminationSelect.value = p.contaminationId;
      if (humidityInput) humidityInput.value = p.ambientHumidityPercent;
      if (clicksInput) clicksInput.value = p.clicksAttempted;
      if (notesInput) notesInput.value = p.notes;
      recalculate();
    });
  }

  // Inputs change handlers
  [toolSelect, contaminationSelect, humidityInput, clicksInput].forEach(el => {
    if (el) el.addEventListener('input', recalculate);
    if (el) el.addEventListener('change', recalculate);
  });

  // Reset tool capacity
  if (resetToolBtn) {
    resetToolBtn.addEventListener('click', () => {
      if (!toolSelect) return;
      resetToolCounter(toolSelect.value);
      updateToolLifeBadge();
    });
  }

  // Save audit
  if (saveAuditBtn) {
    saveAuditBtn.addEventListener('click', () => {
      if (!currentEval) recalculate();
      const toolId = toolSelect?.value || 'CLICK_PEN_25';
      const clicks = parseInt(clicksInput?.value || '1', 10);
      decrementToolCounter(toolId, clicks);

      const record = {
        location: locationInput?.value || 'FAT Terminal',
        connectorType: connectorInput?.value || 'SC/APC',
        toolId,
        toolName: currentEval.tool.name,
        contaminationId: currentEval.contamination.id,
        contaminationName: currentEval.contamination.name,
        humidityPercent: currentEval.humidity,
        clicksAttempted: clicks,
        protocolName: currentEval.protocolName,
        recommendedSolvent: currentEval.recommendedSolvent,
        staticChargeKv: currentEval.staticChargeKv,
        staticRiskLevel: currentEval.staticRiskLevel,
        estimatedSuccessRatePercent: currentEval.estimatedSuccessRatePercent,
        technicianName: techInput?.value || 'Linesman',
        notes: notesInput?.value || ''
      };

      saveCleaningRecord(record);
      renderHistory();
      updateToolLifeBadge();
    });
  }

  // Clear audit history
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      clearCleaningRecords();
      renderHistory();
    });
  }

  // Export CSV
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const records = loadCleaningRecords();
      const csv = exportCleaningCsv(records);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = `shahdara-connector-cleaning-audits-${Date.now()}.csv`;
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Share WhatsApp
  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', () => {
      if (!currentEval) recalculate();
      const record = {
        location: locationInput?.value || 'FAT Terminal',
        connectorType: connectorInput?.value || 'SC/APC',
        toolName: currentEval.tool.name,
        contaminationName: currentEval.contamination.name,
        humidityPercent: currentEval.humidity,
        protocolName: currentEval.protocolName,
        recommendedSolvent: currentEval.recommendedSolvent,
        staticChargeKv: currentEval.staticChargeKv,
        staticRiskLevel: currentEval.staticRiskLevel,
        estimatedSuccessRatePercent: currentEval.estimatedSuccessRatePercent,
        technicianName: techInput?.value || 'Linesman',
        notes: notesInput?.value || ''
      };
      const text = formatCleaningWhatsAppText(record);
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    });
  }

  // Open & Close
  if (openBtn && modal) {
    openBtn.addEventListener('click', () => {
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', 'true');
      }
      recalculate();
      renderHistory();
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

  // Initial calculation
  recalculate();
  renderHistory();

  return {
    recalculate,
    renderHistory,
    updateToolLifeBadge,
    open: () => modal && (typeof modal.showModal === 'function' ? modal.showModal() : modal.setAttribute('open', 'true')),
    close: () => modal && (typeof modal.close === 'function' ? modal.close() : modal.removeAttribute('open'))
  };
}
