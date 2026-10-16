/**
 * Shahdara ISP - Field Technician Optical Fiber Inspection Probe & Connector End-Face Assistant
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements IEC 61300-3-35 international inspection standard for optical fiber connector
 * end-faces (SC/APC, SC/UPC, LC/UPC, FC/UPC):
 * - Concentric Optical Zones: Zone A (Core: 0-25µm), Zone B (Cladding: 25-115µm),
 *   Zone C (Adhesive/Epoxy: 115-135µm), Zone D (Contact Ferrule: 135-250µm).
 * - Automated scratch and particulate contamination detection, IEC pass/fail grading,
 *   insertion loss penalty estimation, cleaning remediation workflow (dry click, wet-to-dry 99.9% IPA),
 *   pure vector SVG microscope simulator, persistent local audit logs, and lineman WhatsApp dispatches.
 */

export const FIBER_PROBE_STORAGE_KEY = 'shahdara_fiber_probe_audits_v1';

export const CONNECTOR_TYPES = {
  SC_APC: {
    id: 'SC_APC',
    name: 'SC/APC (Green Angled Physical Contact 8°)',
    polish: 'APC',
    colorCode: '#10b981',
    ferruleMm: 2.5,
    typicalReturnLossDb: 65.0,
    baseInsertionLossDb: 0.15
  },
  SC_UPC: {
    id: 'SC_UPC',
    name: 'SC/UPC (Blue Ultra Physical Contact)',
    polish: 'UPC',
    colorCode: '#0284c7',
    ferruleMm: 2.5,
    typicalReturnLossDb: 55.0,
    baseInsertionLossDb: 0.18
  },
  LC_UPC: {
    id: 'LC_UPC',
    name: 'LC/UPC (Blue Small Form Factor SFP)',
    polish: 'UPC',
    colorCode: '#38bdf8',
    ferruleMm: 1.25,
    typicalReturnLossDb: 55.0,
    baseInsertionLossDb: 0.20
  },
  FC_UPC: {
    id: 'FC_UPC',
    name: 'FC/UPC (Metallic Threaded Test Jumper)',
    polish: 'UPC',
    colorCode: '#94a3b8',
    ferruleMm: 2.5,
    typicalReturnLossDb: 52.0,
    baseInsertionLossDb: 0.22
  }
};

export const IEC_ZONES = {
  ZONE_A: {
    id: 'ZONE_A',
    name: 'Zone A: Optical Core (0 - 25 µm)',
    radiusUm: 12.5,
    maxScratches: 0,
    maxPits: 0,
    description: 'Strict zero defects or scratches allowed in the light-carrying core'
  },
  ZONE_B: {
    id: 'ZONE_B',
    name: 'Zone B: Glass Cladding (25 - 115 µm)',
    radiusUm: 57.5,
    maxScratches: 2,
    maxScratchWidthUm: 3.0,
    maxPitDiameterUm: 5.0,
    description: 'No scratches > 3µm, no loose contamination pits > 5µm'
  },
  ZONE_C: {
    id: 'ZONE_C',
    name: 'Zone C: Adhesive / Epoxy (115 - 135 µm)',
    radiusUm: 67.5,
    description: 'Structural boundary; no loose chipping or cracked epoxy'
  },
  ZONE_D: {
    id: 'ZONE_D',
    name: 'Zone D: Contact Ferrule (135 - 250 µm)',
    radiusUm: 125.0,
    description: 'Mechanical mating contact zone; particles > 10µm cause connector air gap'
  }
};

export const INSPECTION_PRESETS = [
  {
    id: 'PRISTINE_CLEAN',
    name: 'Pristine Clean Factory Ferrule (PASS)',
    connectorKey: 'SC_APC',
    magnification: '400X',
    defects: [],
    desc: 'Flawless ceramic and core end-face with zero contaminants'
  },
  {
    id: 'CORE_SCRATCH',
    name: 'Zone A Core Scratch Gouge (CRITICAL FAIL)',
    connectorKey: 'SC_APC',
    magnification: '400X',
    defects: [
      { id: 'def-1', type: 'scratch', xUm: 4.2, yUm: -3.5, widthUm: 4.5, lengthUm: 22.0, removable: false }
    ],
    desc: 'Permanent scratch crossing central singlemode core causing high back-reflection'
  },
  {
    id: 'DUST_CONTAMINATION',
    name: 'Outdoor Atmospheric Dust & Debris (FAIL)',
    connectorKey: 'SC_UPC',
    magnification: '200X',
    defects: [
      { id: 'def-2', type: 'dust', xUm: 18.0, yUm: 25.0, widthUm: 6.5, removable: true },
      { id: 'def-3', type: 'dust', xUm: -32.0, yUm: 14.0, widthUm: 8.0, removable: true },
      { id: 'def-4', type: 'dust', xUm: 55.0, yUm: -45.0, widthUm: 12.0, removable: true },
      { id: 'def-5', type: 'dust', xUm: -8.0, yUm: 6.0, widthUm: 5.0, removable: true }
    ],
    desc: 'Loose dust particles from outdoor FAT box splice enclosure'
  },
  {
    id: 'OIL_FINGERPRINT',
    name: 'Technician Fingerprint Oil Smear (FAIL)',
    connectorKey: 'SC_APC',
    magnification: '200X',
    defects: [
      { id: 'def-6', type: 'oil', xUm: 2.0, yUm: 5.0, widthUm: 28.0, removable: true },
      { id: 'def-7', type: 'oil', xUm: -20.0, yUm: -15.0, widthUm: 35.0, removable: true }
    ],
    desc: 'Skin oil contamination causing beam refraction and optical power attenuation'
  },
  {
    id: 'CLADDING_CHIP',
    name: 'Dropped Connector Cladding Edge Fracture (FAIL)',
    connectorKey: 'LC_UPC',
    magnification: '400X',
    defects: [
      { id: 'def-8', type: 'chip', xUm: -48.0, yUm: 22.0, widthUm: 16.0, removable: false }
    ],
    desc: 'Physical glass fracture on cladding perimeter from dropping ferrule on pavement'
  }
];

export const CLEANING_METHODS = {
  DRY_CLICK: {
    id: 'DRY_CLICK',
    name: 'One-Click Dry Cleaner Pen (CleanClicker 2.5mm)',
    removesDust: true,
    removesOil: false,
    efficiencyPct: 75
  },
  WET_DRY_IPA: {
    id: 'WET_DRY_IPA',
    name: 'Wet-to-Dry Lint-Free Wipe + 99.9% Optical IPA',
    removesDust: true,
    removesOil: true,
    efficiencyPct: 98
  },
  OPTICAL_REEL: {
    id: 'OPTICAL_REEL',
    name: 'Reel-Type Cassette Cleaner (Optipop Microfiber)',
    removesDust: true,
    removesOil: true,
    efficiencyPct: 95
  }
};

/**
 * Determines which concentric IEC zone a defect coordinate falls within.
 * @param {number} xUm
 * @param {number} yUm
 * @returns {string} Zone key ('ZONE_A', 'ZONE_B', 'ZONE_C', 'ZONE_D', or 'OUTSIDE')
 */
export function evaluateDefectZone(xUm, yUm) {
  const distUm = Math.sqrt(Math.pow(Number(xUm) || 0, 2) + Math.pow(Number(yUm) || 0, 2));
  if (distUm <= IEC_ZONES.ZONE_A.radiusUm) return 'ZONE_A';
  if (distUm <= IEC_ZONES.ZONE_B.radiusUm) return 'ZONE_B';
  if (distUm <= IEC_ZONES.ZONE_C.radiusUm) return 'ZONE_C';
  if (distUm <= IEC_ZONES.ZONE_D.radiusUm) return 'ZONE_D';
  return 'OUTSIDE';
}

/**
 * Evaluates a list of defects against IEC 61300-3-35 criteria.
 * @param {Array} defects
 * @param {Object} connector
 * @returns {Object} Comprehensive pass/fail audit evaluation.
 */
export function evaluateIec61300Criteria(defects = [], connector = CONNECTOR_TYPES.SC_APC) {
  const conn = connector || CONNECTOR_TYPES.SC_APC;
  const list = Array.isArray(defects) ? defects : [];

  let zoneAFaultCount = 0;
  let zoneBFaultCount = 0;
  let zoneCFaultCount = 0;
  let zoneDFaultCount = 0;

  const analyzedDefects = list.map(d => {
    const zoneKey = evaluateDefectZone(d.xUm, d.yUm);
    let passes = true;
    let failReason = '';

    if (zoneKey === 'ZONE_A') {
      passes = false;
      failReason = 'Zone A Core violation: zero defects allowed';
      zoneAFaultCount++;
    } else if (zoneKey === 'ZONE_B') {
      const dimUm = d.widthUm || d.sizeUm || 1.0;
      if (d.type === 'scratch' && (dimUm > 3.0 || (d.lengthUm && d.lengthUm > 30.0))) {
        passes = false;
        failReason = 'Zone B scratch exceeds 3µm threshold';
        zoneBFaultCount++;
      } else if (d.type !== 'scratch' && dimUm > 5.0) {
        passes = false;
        failReason = 'Zone B particulate exceeds 5µm limit';
        zoneBFaultCount++;
      }
    } else if (zoneKey === 'ZONE_D') {
      const dimUm = d.widthUm || d.sizeUm || 1.0;
      if (dimUm > 15.0) {
        passes = false;
        failReason = 'Zone D large particulate risks mating air-gap';
        zoneDFaultCount++;
      }
    }

    return {
      ...d,
      zoneKey,
      passes,
      failReason
    };
  });

  const totalViolations = zoneAFaultCount + zoneBFaultCount + zoneCFaultCount + zoneDFaultCount;
  const overallPass = totalViolations === 0;

  // Calculate estimated insertion loss penalty and return loss impact
  let estimatedLossPenaltyDb = 0.0;
  let returnLossDegradationDb = 0.0;

  if (zoneAFaultCount > 0) {
    estimatedLossPenaltyDb += zoneAFaultCount * 0.95;
    returnLossDegradationDb += 22.0;
  }
  if (zoneBFaultCount > 0) {
    estimatedLossPenaltyDb += zoneBFaultCount * 0.35;
    returnLossDegradationDb += 8.0;
  }
  if (zoneDFaultCount > 0) {
    estimatedLossPenaltyDb += zoneDFaultCount * 0.15;
    returnLossDegradationDb += 4.0;
  }

  const estimatedTotalInsertionLossDb = Math.round((conn.baseInsertionLossDb + estimatedLossPenaltyDb) * 100) / 100;
  const estimatedReturnLossDb = Math.max(22.0, Math.round((conn.typicalReturnLossDb - returnLossDegradationDb) * 10) / 10);

  let recommendation = 'CLEAN_VERIFIED_CONNECT';
  if (!overallPass) {
    const hasRemovable = analyzedDefects.some(d => d.removable);
    const hasPermanent = analyzedDefects.some(d => !d.removable && !d.passes);
    if (hasPermanent) {
      recommendation = 'FERRULE_REPLACE_RE_TERMINATE';
    } else if (hasRemovable) {
      recommendation = 'WET_TO_DRY_CLEAN_REQUIRED';
    }
  }

  const zoneResults = {
    ZONE_A: { id: 'ZONE_A', pass: zoneAFaultCount === 0, violations: zoneAFaultCount },
    ZONE_B: { id: 'ZONE_B', pass: zoneBFaultCount === 0, violations: zoneBFaultCount },
    ZONE_C: { id: 'ZONE_C', pass: zoneCFaultCount === 0, violations: zoneCFaultCount },
    ZONE_D: { id: 'ZONE_D', pass: zoneDFaultCount === 0, violations: zoneDFaultCount }
  };

  return {
    overallPass,
    grade: overallPass ? 'PASS' : 'FAIL',
    statusColor: overallPass ? '#10b981' : '#ef4444',
    totalDefects: list.length,
    totalViolations,
    zones: zoneResults,
    zoneCounts: {
      zoneA: zoneAFaultCount,
      zoneB: zoneBFaultCount,
      zoneC: zoneCFaultCount,
      zoneD: zoneDFaultCount
    },
    penaltyDb: estimatedLossPenaltyDb,
    estimatedLossPenaltyDb,
    estimatedInsertionLossDb: estimatedTotalInsertionLossDb,
    estInsertionLossDb: estimatedTotalInsertionLossDb,
    estimatedReturnLossDb,
    estReturnLossDb: estimatedReturnLossDb,
    recommendation,
    analyzedDefects
  };
}

/**
 * Simulates cleaning action on a connector end-face.
 * @param {Array} defects
 * @param {string} cleaningMethodKey
 * @returns {Array} Remaining defects post-cleaning.
 */
export function remediateConnectorCleaning(defects = [], cleaningMethodKey = 'WET_DRY_IPA') {
  const method = CLEANING_METHODS[cleaningMethodKey] || CLEANING_METHODS.WET_DRY_IPA;
  return defects.filter(d => {
    const isRemovable = d.removable !== undefined ? d.removable : (d.type !== 'scratch' && d.type !== 'chip');
    if (!isRemovable) return true; // Scratches and chips cannot be wiped off
    if (d.type === 'dust' && method.removesDust) return false;
    if (d.type === 'oil' && method.removesOil) return false;
    return false; // Removable contaminant cleaned
  });
}

/**
 * Retrieves the persistent inspection audit store.
 */
export function getFiberProbeStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) {
    return createInitialProbeStore();
  }
  try {
    const raw = storage.getItem(FIBER_PROBE_STORAGE_KEY);
    if (!raw) {
      const initial = createInitialProbeStore();
      saveFiberProbeStore(initial, storage);
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : createInitialProbeStore();
  } catch (err) {
    return createInitialProbeStore();
  }
}

/**
 * Saves inspection audit records to storage.
 */
export function saveFiberProbeStore(records, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  try {
    storage.setItem(FIBER_PROBE_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Appends a new audit record to the persistent store.
 */
export function recordFiberProbeAudit(entry, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  const store = getFiberProbeStore(storage);
  const now = new Date();
  const record = {
    id: `PROBE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    timestamp: now.toISOString(),
    displayTime: now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }),
    displayDate: now.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' }),
    locationArea: entry.locationArea || 'Shahdara Town',
    nodeTag: entry.nodeTag || 'FAT-BAR-01',
    connectorType: entry.connectorType || 'SC_APC',
    magnification: entry.magnification || '400X',
    grade: entry.grade || 'PASS',
    totalViolations: entry.totalViolations || 0,
    insertionLossDb: entry.insertionLossDb || 0.15,
    returnLossDb: entry.returnLossDb || 65.0,
    cleaned: Boolean(entry.cleaned),
    technician: entry.technician || 'Lineman Team 02'
  };

  store.unshift(record);
  if (store.length > 50) store.length = 50; // Cap at 50 logs
  saveFiberProbeStore(store, storage);
  return store;
}

/**
 * Clears the inspection audit store.
 */
export function clearFiberProbeStore(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return false;
  return saveFiberProbeStore([], storage);
}

function createInitialProbeStore() {
  return [
    {
      id: 'PROBE-20261016-01',
      timestamp: '2026-10-16T15:20:00.000Z',
      displayTime: '03:20 PM',
      displayDate: 'Oct 16, 2026',
      locationArea: 'Baradari Road',
      nodeTag: 'FAT-BAR-01 Drop 4',
      connectorType: 'SC_APC',
      magnification: '400X',
      grade: 'PASS',
      totalViolations: 0,
      insertionLossDb: 0.14,
      returnLossDb: 66.2,
      cleaned: true,
      technician: 'Tariq Lineman'
    },
    {
      id: 'PROBE-20261016-02',
      timestamp: '2026-10-16T14:45:00.000Z',
      displayTime: '02:45 PM',
      displayDate: 'Oct 16, 2026',
      locationArea: 'Vandala Road',
      nodeTag: 'FDT-VAN-04 Port 7',
      connectorType: 'SC_UPC',
      magnification: '200X',
      grade: 'FAIL',
      totalViolations: 3,
      insertionLossDb: 1.85,
      returnLossDb: 34.0,
      cleaned: false,
      technician: 'Kashif Tech'
    },
    {
      id: 'PROBE-20261016-03',
      timestamp: '2026-10-16T13:10:00.000Z',
      displayTime: '01:10 PM',
      displayDate: 'Oct 16, 2026',
      locationArea: 'Shahdara Town',
      nodeTag: 'OLT-01 SFP Port 2',
      connectorType: 'LC_UPC',
      magnification: '400X',
      grade: 'PASS',
      totalViolations: 0,
      insertionLossDb: 0.18,
      returnLossDb: 56.4,
      cleaned: true,
      technician: 'Asim Field Sup'
    }
  ];
}

/**
 * Generates pure vector SVG of the optical fiber probe microscope display.
 */
export function renderMobileFiberProbeSvg(evaluation, options = {}) {
  const ev = evaluation || evaluateIec61300Criteria([], CONNECTOR_TYPES.SC_APC);
  const conn = options.connector || CONNECTOR_TYPES.SC_APC;
  const mag = options.magnification || '400X';
  const width = options.width || 420;
  const height = options.height || 360;

  const centerX = width / 2;
  const centerY = height / 2 - 10;
  const scale = mag === '400X' ? 1.6 : 0.95;

  const coreRadius = IEC_ZONES.ZONE_A.radiusUm * scale;
  const cladRadius = IEC_ZONES.ZONE_B.radiusUm * scale;
  const adhrRadius = IEC_ZONES.ZONE_C.radiusUm * scale;
  const ferrRadius = IEC_ZONES.ZONE_D.radiusUm * scale;

  const isPass = ev.overallPass;
  const gradeColor = isPass ? '#10b981' : '#ef4444';

  return `<svg class="fiber-probe-svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Fiber Inspection Probe Microscope IEC 61300-3-35 View">
  <defs>
    <radialGradient id="ferruleFaceGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="65%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </radialGradient>
    <radialGradient id="claddingGlassGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25" />
      <stop offset="85%" stop-color="#0284c7" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#0369a1" stop-opacity="0.30" />
    </radialGradient>
    <radialGradient id="coreLightGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="50%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </radialGradient>
    <filter id="probeGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Dark Field Microscope Background -->
  <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#090d16" stroke="#1e293b" stroke-width="1.2" />

  <!-- Top Microscope Status Bar -->
  <text x="14" y="20" fill="#94a3b8" font-size="10" font-family="monospace">IEC 61300-3-35 MICROSCOPE PROBE [${conn.id || conn.code || 'SC'}]</text>
  <text x="${width - 14}" y="20" text-anchor="end" fill="#38bdf8" font-size="10" font-weight="700" font-family="monospace">ZOOM: ${mag}</text>

  <!-- Outer Zirconia Ferrule Body (Zone D Outer Boundary) -->
  <circle cx="${centerX}" cy="${centerY}" r="${ferrRadius}" fill="url(#ferruleFaceGrad)" stroke="#334155" stroke-width="1.5" />

  <!-- Zone C: Epoxy Adhesive Ring -->
  <circle cx="${centerX}" cy="${centerY}" r="${adhrRadius}" fill="none" stroke="#475569" stroke-width="1" stroke-dasharray="3,3" />

  <!-- Zone B: 125µm Glass Cladding Face -->
  <circle cx="${centerX}" cy="${centerY}" r="${cladRadius}" fill="url(#claddingGlassGrad)" stroke="#0284c7" stroke-width="1.2" />

  <!-- Zone A: 9µm Singlemode Optical Core -->
  <g id="zoneACoreGroup">
    <title>Zone A: Core (0-25µm)</title>
    <circle cx="${centerX}" cy="${centerY}" r="${coreRadius}" fill="url(#coreLightGrad)" stroke="#38bdf8" stroke-width="1.5" filter="url(#probeGlow)" />
  </g>

  <!-- Reticle Crosshairs -->
  <line x1="${centerX - ferrRadius - 10}" y1="${centerY}" x2="${centerX + ferrRadius + 10}" y2="${centerY}" stroke="#334155" stroke-width="0.8" stroke-dasharray="4,4" opacity="0.6" />
  <line x1="${centerX}" y1="${centerY - ferrRadius - 10}" x2="${centerX}" y2="${centerY + ferrRadius + 10}" stroke="#334155" stroke-width="0.8" stroke-dasharray="4,4" opacity="0.6" />

  <!-- Micron Scale Rings Indicator Labels -->
  <text x="${centerX + coreRadius + 4}" y="${centerY - 4}" fill="#38bdf8" font-size="7.5" font-family="monospace">A:25µm</text>
  <text x="${centerX + cladRadius + 4}" y="${centerY - 4}" fill="#0284c7" font-size="7.5" font-family="monospace">B:115µm</text>
  <text x="${centerX + ferrRadius - 28}" y="${centerY - 4}" fill="#64748b" font-size="7.5" font-family="monospace">D:250µm</text>

  <!-- Defect Overlays -->
  ${ev.analyzedDefects.map(d => {
    const dx = centerX + d.xUm * scale;
    const dy = centerY + d.yUm * scale;
    const isFatal = !d.passes;
    const defColor = isFatal ? '#ef4444' : '#f59e0b';
    const radius = Math.max(3, (d.widthUm / 2) * scale);

    if (d.type === 'scratch') {
      const len = (d.lengthUm || 15) * scale;
      return `
        <line x1="${dx - len / 2}" y1="${dy - 3}" x2="${dx + len / 2}" y2="${dy + 3}" stroke="${defColor}" stroke-width="${Math.max(2, d.widthUm * 0.8)}" stroke-linecap="round" />
        <circle cx="${dx}" cy="${dy}" r="${radius + 4}" fill="none" stroke="${defColor}" stroke-width="1" stroke-dasharray="2,2" />
      `;
    }
    if (d.type === 'oil') {
      return `
        <ellipse cx="${dx}" cy="${dy}" rx="${radius * 1.5}" ry="${radius * 0.9}" fill="${defColor}" fill-opacity="0.35" stroke="${defColor}" stroke-width="1.2" />
      `;
    }
    // Dust or chip
    return `
      <circle cx="${dx}" cy="${dy}" r="${radius}" fill="${defColor}" fill-opacity="0.7" stroke="#ffffff" stroke-width="0.8" />
      <circle cx="${dx}" cy="${dy}" r="${radius + 3}" fill="none" stroke="${defColor}" stroke-width="1" stroke-dasharray="2,2" />
    `;
  }).join('')}

  <!-- Pass / Fail Stamp Overlay Badge -->
  <g transform="translate(${width - 105}, 36)">
    <rect x="0" y="0" width="90" height="28" rx="6" fill="#0f172a" stroke="${gradeColor}" stroke-width="2" />
    <text x="45" y="18" text-anchor="middle" fill="${gradeColor}" font-size="13" font-weight="800" letter-spacing="1">
      ${ev.grade}
    </text>
  </g>

  <!-- Bottom Telemetry HUD -->
  <g transform="translate(14, ${height - 48})">
    <rect x="0" y="0" width="${width - 28}" height="38" rx="6" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
    <text x="12" y="16" fill="#94a3b8" font-size="8.5">Est Insertion Loss:</text>
    <text x="12" y="30" fill="${ev.estimatedInsertionLossDb > 0.4 ? '#ef4444' : '#10b981'}" font-size="11" font-weight="700">
      ${ev.estimatedInsertionLossDb} dB
    </text>

    <text x="${width * 0.38}" y="16" fill="#94a3b8" font-size="8.5">Est Return Loss:</text>
    <text x="${width * 0.38}" y="30" fill="${ev.estimatedReturnLossDb < 50 ? '#f59e0b' : '#38bdf8'}" font-size="11" font-weight="700">
      ${ev.estimatedReturnLossDb} dB
    </text>

    <text x="${width * 0.72}" y="16" fill="#94a3b8" font-size="8.5">Defect Count:</text>
    <text x="${width * 0.72}" y="30" fill="${ev.totalViolations > 0 ? '#ef4444' : '#10b981'}" font-size="11" font-weight="700">
      ${ev.totalDefects} (${ev.totalViolations} Fail)
    </text>
  </g>
</svg>
`;
}

/**
 * Generates a WhatsApp field dispatch slip for lineman fiber inspection audits.
 */
export function generateFiberProbeWhatsAppReport(audit) {
  if (!audit) return 'No inspection audit data available.';

  const connName = (audit.connectorType && CONNECTOR_TYPES[audit.connectorType])
    ? CONNECTOR_TYPES[audit.connectorType].name
    : audit.connectorType;

  return [
    '🔬 *SHAHDARA ISP FIELD FIBER CONNECTOR PROBE REPORT*',
    'Standard: IEC 61300-3-35 End-Face Visual Certification',
    '------------------------------------------------',
    `📍 *Location / Node:* ${audit.locationArea} (${audit.nodeTag})`,
    `🔌 *Connector Type:* ${connName}`,
    `🔍 *Inspection Zoom:* ${audit.magnification}`,
    `📊 *Inspection Result (GRADE: ${audit.grade}):* ${audit.grade === 'PASS' ? '✅ PASSED (Within Limits)' : '❌ FAILED (Defects Detected)'}`,
    `⚠️ *Violations:* ${audit.totalViolations} defect(s)`,
    `📉 *Est Insertion Loss:* ${audit.insertionLossDb} dB`,
    `🛡️ *Est Return Loss:* ${audit.returnLossDb} dB`,
    `🧼 *Cleaned On-Site:* ${audit.cleaned ? 'Yes (Cleaned & Re-Inspected)' : 'No'}`,
    `👷 *Technician:* ${audit.technician}`,
    `🕒 *Timestamp:* ${audit.displayDate} ${audit.displayTime}`,
    '------------------------------------------------',
    audit.grade === 'PASS'
      ? '✨ *Action:* Connector verified clean. Approved for insertion into adapter sleeve.'
      : '⚠️ *Action:* Do NOT connect! Clean with wet-to-dry 99.9% optical IPA wipe or replace drop pigtail.'
  ].join('\n');
}

/**
 * Initializes and wires the mobile Fiber Probe modal, controls, and events.
 */
export function setupMobileFiberProbeModal({ storage = (typeof localStorage !== 'undefined' ? localStorage : null), onToast, clipboard } = {}) {
  const modal = document.getElementById('mobileFiberProbeModal');
  const closeBtn = document.getElementById('mobileFiberProbeCloseBtn');

  const connectorSelect = document.getElementById('fiberProbeConnSelect');
  const presetSelect = document.getElementById('fiberProbePresetSelect');
  const zoomSelect = document.getElementById('fiberProbeZoomSelect') || document.getElementById('fiberProbeMagSelect');
  const cleanBtn = document.getElementById('fiberProbeCleanBtn');
  const recordBtn = document.getElementById('fiberProbeRecordBtn') || document.getElementById('fiberProbeReinspectBtn');
  const copyWhatsappBtn = document.getElementById('fiberProbeCopyWhatsappBtn') || document.getElementById('fiberProbeWhatsappBtn');
  const clearHistoryBtn = document.getElementById('fiberProbeClearHistoryBtn');

  const nodeInput = document.getElementById('fiberProbeNodeInput') || document.getElementById('fiberProbeNodeTagInput');
  const areaSelect = document.getElementById('fiberProbeAreaSelect') || document.getElementById('fiberProbeLocationInput');
  const techInput = document.getElementById('fiberProbeTechInput');

  const svgWrap = document.getElementById('fiberProbeSvgWrap') || document.getElementById('fiberProbeSvgContainer');
  const historyList = document.getElementById('fiberProbeHistoryList');

  const kpiGrade = document.getElementById('fiberProbeKpiGrade') || document.getElementById('fiberProbeOverallBadge');
  const kpiLoss = document.getElementById('fiberProbeKpiLoss') || document.getElementById('fiberProbeIlPenalty');
  const kpiReturnLoss = document.getElementById('fiberProbeKpiReturnLoss') || document.getElementById('fiberProbeRlEst');
  const kpiViolations = document.getElementById('fiberProbeKpiViolations');
  const recBadge = document.getElementById('fiberProbeRecBadge') || document.getElementById('fiberProbeRemediationTip');

  const coreStatus = document.getElementById('fiberProbeCoreStatus');
  const cladStatus = document.getElementById('fiberProbeCladStatus');
  const adhrStatus = document.getElementById('fiberProbeAdhrStatus');
  const ferrStatus = document.getElementById('fiberProbeFerrStatus');

  let currentConnector = CONNECTOR_TYPES.SC_APC;
  let currentPreset = INSPECTION_PRESETS[0];
  let currentDefects = [...currentPreset.defects];
  let currentMagnification = '400X';
  let hasBeenCleaned = false;

  function renderView() {
    const evaluation = evaluateIec61300Criteria(currentDefects, currentConnector);

    if (svgWrap) {
      svgWrap.innerHTML = renderMobileFiberProbeSvg(evaluation, {
        connector: currentConnector,
        magnification: currentMagnification
      });
    }

    if (kpiGrade) {
      kpiGrade.textContent = evaluation.grade;
      if (kpiGrade.style) kpiGrade.style.color = evaluation.statusColor;
    }
    if (kpiLoss) {
      kpiLoss.textContent = `${evaluation.estimatedInsertionLossDb} dB`;
      if (kpiLoss.style) kpiLoss.style.color = evaluation.estimatedInsertionLossDb > 0.4 ? '#ef4444' : '#10b981';
    }
    if (kpiReturnLoss) {
      kpiReturnLoss.textContent = `${evaluation.estimatedReturnLossDb} dB`;
      if (kpiReturnLoss.style) kpiReturnLoss.style.color = evaluation.estimatedReturnLossDb < 50 ? '#f59e0b' : '#38bdf8';
    }
    if (kpiViolations) {
      kpiViolations.textContent = `${evaluation.totalViolations} Fail (${evaluation.totalDefects} Total)`;
    }
    if (recBadge) {
      if (evaluation.overallPass) {
        recBadge.textContent = 'End-face meets IEC 61300-3-35 standard. Safe to mate with patch panel adapter.';
        recBadge.className = 'sim-delta-badge badge-success';
      } else if (evaluation.recommendation === 'WET_TO_DRY_CLEAN_REQUIRED') {
        recBadge.textContent = 'Defects detected! Clean with wet-to-dry 99.9% IPA optical wipe and re-inspect.';
        recBadge.className = 'sim-delta-badge badge-warning';
      } else {
        recBadge.textContent = 'Core gouge or permanent crack detected! Replace drop cable pigtail or re-polish.';
        recBadge.className = 'sim-delta-badge badge-danger';
      }
    }
    if (coreStatus) {
      coreStatus.textContent = `${evaluation.zoneCounts.zoneA} Defect(s) (${evaluation.zones.ZONE_A.pass ? 'PASS' : 'FAIL'})`;
    }
    if (cladStatus) {
      cladStatus.textContent = `${evaluation.zoneCounts.zoneB} Defect(s) (${evaluation.zones.ZONE_B.pass ? 'PASS' : 'FAIL'})`;
    }
    if (adhrStatus) {
      adhrStatus.textContent = `${evaluation.zoneCounts.zoneC} Defect(s) (${evaluation.zones.ZONE_C.pass ? 'PASS' : 'FAIL'})`;
    }
    if (ferrStatus) {
      ferrStatus.textContent = `${evaluation.zoneCounts.zoneD} Defect(s) (${evaluation.zones.ZONE_D.pass ? 'PASS' : 'FAIL'})`;
    }

    renderHistory();
  }

  function renderHistory() {
    if (!historyList) return;
    const store = getFiberProbeStore(storage);
    if (!store || store.length === 0) {
      historyList.innerHTML = `<li style="padding: 12px; text-align: center; color: var(--text-muted, #64748b);">No fiber probe audits recorded.</li>`;
      return;
    }

    historyList.innerHTML = store.slice(0, 10).map(item => `
      <li class="ont-history-card">
        <div>
          <strong>${item.locationArea}</strong> &bull; <span style="font-family: monospace;">${item.nodeTag}</span> [${item.connectorType}]
          <div style="font-size: 11px; color: var(--text-muted, #64748b);">${item.displayDate} ${item.displayTime} &bull; ${item.technician}</div>
        </div>
        <div style="text-align: right;">
          <span class="status-pill ${item.grade === 'PASS' ? 'status-active' : 'status-danger'}">${item.grade}</span>
          <div style="font-size: 11px; font-weight: 600;">IL ${item.insertionLossDb}dB</div>
        </div>
      </li>
    `).join('');
  }

  // Populate Selects
  if (connectorSelect) {
    connectorSelect.innerHTML = Object.values(CONNECTOR_TYPES).map(c => `
      <option value="${c.id}" ${c.id === currentConnector.id ? 'selected' : ''}>${c.name}</option>
    `).join('');
    connectorSelect.onchange = e => {
      currentConnector = CONNECTOR_TYPES[e.target.value] || CONNECTOR_TYPES.SC_APC;
      renderView();
    };
  }

  if (presetSelect) {
    presetSelect.innerHTML = INSPECTION_PRESETS.map(p => `
      <option value="${p.id}" ${p.id === currentPreset.id ? 'selected' : ''}>${p.name}</option>
    `).join('');
    presetSelect.onchange = e => {
      const found = INSPECTION_PRESETS.find(p => p.id === e.target.value);
      if (found) {
        currentPreset = found;
        currentDefects = [...found.defects];
        hasBeenCleaned = false;
        if (connectorSelect && found.connectorKey) {
          connectorSelect.value = found.connectorKey;
          currentConnector = CONNECTOR_TYPES[found.connectorKey] || CONNECTOR_TYPES.SC_APC;
        }
        if (zoomSelect && found.magnification) {
          zoomSelect.value = found.magnification;
          currentMagnification = found.magnification;
        }
        renderView();
      }
    };
  }

  if (zoomSelect) {
    zoomSelect.onchange = e => {
      currentMagnification = e.target.value;
      renderView();
    };
  }

  if (cleanBtn) {
    cleanBtn.onclick = () => {
      const beforeCount = currentDefects.length;
      currentDefects = remediateConnectorCleaning(currentDefects, 'WET_DRY_IPA');
      hasBeenCleaned = true;
      const removed = beforeCount - currentDefects.length;
      renderView();
      if (typeof onToast === 'function') {
        onToast(`Executed cleaning protocol with 99.9% IPA wipe: removed ${removed} contaminant(s).`);
      }
    };
  }

  if (recordBtn) {
    recordBtn.onclick = () => {
      const evaluation = evaluateIec61300Criteria(currentDefects, currentConnector);
      const loc = areaSelect ? areaSelect.value : 'Shahdara Town';
      const node = nodeInput && nodeInput.value.trim() ? nodeInput.value.trim() : 'FAT-BAR-01';

      const entry = {
        locationArea: loc,
        nodeTag: node,
        connectorType: currentConnector.code,
        magnification: currentMagnification,
        grade: evaluation.grade,
        totalViolations: evaluation.totalViolations,
        insertionLossDb: evaluation.estimatedInsertionLossDb,
        returnLossDb: evaluation.estimatedReturnLossDb,
        cleaned: hasBeenCleaned
      };

      recordFiberProbeAudit(entry, storage);
      renderView();
      if (typeof onToast === 'function') {
        onToast(`Recorded inspection audit for ${node} (${evaluation.grade})!`);
      }
    };
  }

  if (copyWhatsappBtn) {
    copyWhatsappBtn.onclick = async () => {
      const evaluation = evaluateIec61300Criteria(currentDefects, currentConnector);
      const loc = areaSelect ? areaSelect.value : 'Shahdara Town';
      const node = nodeInput && nodeInput.value.trim() ? nodeInput.value.trim() : 'FAT-BAR-01';

      const auditData = {
        locationArea: loc,
        nodeTag: node,
        connectorType: currentConnector.name,
        magnification: currentMagnification,
        grade: evaluation.grade,
        totalViolations: evaluation.totalViolations,
        insertionLossDb: evaluation.estimatedInsertionLossDb,
        returnLossDb: evaluation.estimatedReturnLossDb,
        cleaned: hasBeenCleaned,
        technician: 'Shahdara Field Tech',
        displayDate: new Date().toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' }),
        displayTime: new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })
      };

      const text = generateFiberProbeWhatsAppReport(auditData);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      try {
        if (clip?.writeText) {
          await clip.writeText(text);
          if (typeof onToast === 'function') {
            onToast('WhatsApp fiber inspection report copied to clipboard!');
          }
        } else if (typeof window !== 'undefined' && window.prompt) {
          window.prompt('Copy WhatsApp inspection report:', text);
        }
      } catch (err) {
        if (typeof window !== 'undefined' && window.prompt) {
          window.prompt('Copy WhatsApp inspection report:', text);
        }
      }
    };
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = () => {
      clearFiberProbeStore(storage);
      renderView();
      if (typeof onToast === 'function') {
        onToast('Cleared fiber probe audit logs.');
      }
    };
  }

  function openModal(presetId = null) {
    if (presetId) {
      const found = INSPECTION_PRESETS.find(p => p.id === presetId);
      if (found) {
        currentPreset = found;
        currentDefects = [...found.defects];
        hasBeenCleaned = false;
        if (presetSelect) presetSelect.value = found.id;
      }
    }
    renderView();
    if (modal) {
      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', '');
      }
    }
  }

  function closeModal() {
    if (modal) {
      if (typeof modal.close === 'function') {
        modal.close();
      } else {
        modal.removeAttribute('open');
      }
    }
  }

  if (closeBtn) {
    closeBtn.onclick = closeModal;
  }

  if (modal) {
    modal.onclick = e => {
      if (e.target === modal) closeModal();
    };
  }

  // Hook multi-surface triggers
  document.querySelectorAll('[data-open-fiber-probe]').forEach(btn => {
    btn.onclick = () => openModal();
  });

  // Initial draw
  renderView();

  return {
    openModal,
    closeModal,
    getCurrentDefects: () => [...currentDefects],
    getCurrentConnector: () => currentConnector,
    renderView
  };
}
