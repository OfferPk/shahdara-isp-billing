/**
 * Shahdara ISP - Field Optical Drop Cable Mid-Span Express Tube Access & Buffer Tube Slitter Assistant
 *
 * Provides FTTH field splicers, cable jointers, and technicians with:
 * - ITU-T L.200, IEC 60794-1-2, and Telcordia GR-771 mid-span express buffer tube management
 * - Stranded loose tube, Figure-8 aerial drop, dielectric flat drop, and micro-duct cable metrology
 * - Slitter blade micrometer depth calibration to prevent razor contact with 250 µm primary fiber coatings
 * - Express uncut fiber storage loop tray radius (>= 30 mm minimum dynamic bend radius) validation
 * - Macro-bend attenuation penalty estimation on express fiber cores during mid-span coiling
 * - Interactive pure-vector SVG cutaway diagram with sheath stripping, central clamp, and express loop
 * - LocalStorage persistence (shahdara_midspan_access_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const MIDSPAN_ACCESS_STORAGE_KEY = 'shahdara_midspan_access_audits_v1';

export const MIDSPAN_CABLE_CONSTRUCTIONS = {
  STRANDED_LOOSE_TUBE: {
    id: 'STRANDED_LOOSE_TUBE',
    name: 'Multi-Loose-Tube Stranded Armored Outdoor Cable (24-96 Cores)',
    defaultOuterDiaMm: 11.5,
    defaultTubeDiaMm: 2.2,
    defaultWallThicknessMm: 0.40,
    minBendRadiusMm: 30.0,
    strengthMember: 'FRP / Steel Central Member Clamp'
  },
  FIGURE_8_AERIAL: {
    id: 'FIGURE_8_AERIAL',
    name: 'Figure-8 Aerial Self-Supporting Drop Cable (2-12 Cores)',
    defaultOuterDiaMm: 8.5,
    defaultTubeDiaMm: 2.0,
    defaultWallThicknessMm: 0.35,
    minBendRadiusMm: 30.0,
    strengthMember: 'Steel Messenger Wire Web Separation'
  },
  FLAT_DIELECTRIC_DROP: {
    id: 'FLAT_DIELECTRIC_DROP',
    name: 'Flat Dielectric Drop Cable with Dual FRP (2-8 Cores)',
    defaultOuterDiaMm: 8.0,
    defaultTubeDiaMm: 3.0,
    defaultWallThicknessMm: 0.45,
    minBendRadiusMm: 30.0,
    strengthMember: 'Dual Dielectric FRP Rods'
  },
  MICRO_DUCT_AIR_BLOWN: {
    id: 'MICRO_DUCT_AIR_BLOWN',
    name: 'Micro-Duct Air-Blown Loose Tube Cable (12-72 Cores)',
    defaultOuterDiaMm: 6.0,
    defaultTubeDiaMm: 1.6,
    defaultWallThicknessMm: 0.30,
    minBendRadiusMm: 25.0,
    strengthMember: 'Aramid Yarn Matrix'
  }
};

export const SLITTER_TOOL_TYPES = {
  ROTARY_MICROMETER: {
    id: 'ROTARY_MICROMETER',
    name: 'Precision Rotary Micrometer Buffer Tube Shaver (0.1 - 3.2 mm)',
    bladeToleranceMm: 0.02
  },
  LONGITUDINAL_DUAL_BLADE: {
    id: 'LONGITUDINAL_DUAL_BLADE',
    name: 'Longitudinal Dual-Blade Express Shaver Tool',
    bladeToleranceMm: 0.04
  },
  RING_CUTTER_GUARD: {
    id: 'RING_CUTTER_GUARD',
    name: 'Circumferential Ring Cutter with Guarded Stop Guide',
    bladeToleranceMm: 0.05
  }
};

export const MIDSPAN_PRESETS = [
  {
    id: 'shahdara-town-48core-fat-tap',
    name: 'Shahdara Town 48-Core Mid-Span FAT Drop Tap (Express 36 Cores, Tap 12 Cores)',
    area: 'Shahdara Town',
    cableType: 'STRANDED_LOOSE_TUBE',
    slitterTool: 'ROTARY_MICROMETER',
    totalCores: 48,
    bufferTubeCount: 4,
    tappedTubeIndex: 1,
    tappedCoreCount: 12,
    tubeOuterDiameterMm: 2.2,
    tubeWallThicknessMm: 0.40,
    bladeDepthMm: 0.34,
    slackLoopRadiusMm: 38.0,
    technician: 'Rashid Mahmood (Senior Splicer)',
    notes: 'Mid-span splice on 48F trunk cable in FAT-16 enclosure near Shahdara roundabout.'
  },
  {
    id: 'begum-kot-96core-armored-midspan',
    name: 'Begum Kot Industrial 96-Core Armored Backbone (Express 84 Cores, Tap 12 Cores)',
    area: 'Begum Kot',
    cableType: 'STRANDED_LOOSE_TUBE',
    slitterTool: 'LONGITUDINAL_DUAL_BLADE',
    totalCores: 96,
    bufferTubeCount: 8,
    tappedTubeIndex: 2,
    tappedCoreCount: 12,
    tubeOuterDiameterMm: 2.4,
    tubeWallThicknessMm: 0.42,
    bladeDepthMm: 0.36,
    slackLoopRadiusMm: 45.0,
    technician: 'Arshad Ali (Field Lead)',
    notes: 'Express 7 tubes uncut through dome closure. Shave Blue tube for feeder connection.'
  },
  {
    id: 'ravi-road-fig8-drop-midspan',
    name: 'Ravi Road Figure-8 Aerial Drop Cable (4-Core Flat Drop, 2 Tap, 2 Express)',
    area: 'Ravi Road',
    cableType: 'FIGURE_8_AERIAL',
    slitterTool: 'ROTARY_MICROMETER',
    totalCores: 4,
    bufferTubeCount: 1,
    tappedTubeIndex: 1,
    tappedCoreCount: 2,
    tubeOuterDiameterMm: 2.0,
    tubeWallThicknessMm: 0.35,
    bladeDepthMm: 0.29,
    slackLoopRadiusMm: 32.0,
    technician: 'Sajjad Malik',
    notes: 'Messenger strand secured with wedge dead-end clamp. Express cores coiled in mini tray.'
  },
  {
    id: 'saeed-park-overdepth-blade-hazard',
    name: 'Saeed Park Over-Depth Blade Hazard (Razor Contact / Micro-Fracture Warning)',
    area: 'Saeed Park',
    cableType: 'STRANDED_LOOSE_TUBE',
    slitterTool: 'ROTARY_MICROMETER',
    totalCores: 24,
    bufferTubeCount: 2,
    tappedTubeIndex: 1,
    tappedCoreCount: 6,
    tubeOuterDiameterMm: 2.2,
    tubeWallThicknessMm: 0.40,
    bladeDepthMm: 0.44, // Exceeds 0.40mm wall thickness!
    slackLoopRadiusMm: 22.0, // Below 30mm bend radius!
    technician: 'Imran Ashraf',
    notes: 'Critical hazard: Blade depth exceeds wall thickness, risking core severance.'
  }
];

/**
 * Calculates mid-span buffer tube shaving metrics, blade depth clearance, and bend radius penalties.
 */
export function calculateMidspanAccessMetrics({
  cableType = 'STRANDED_LOOSE_TUBE',
  slitterTool = 'ROTARY_MICROMETER',
  totalCores = 48,
  bufferTubeCount = 4,
  tappedTubeIndex = 1,
  tappedCoreCount = 12,
  tubeOuterDiameterMm = 2.2,
  tubeWallThicknessMm = 0.40,
  bladeDepthMm = 0.34,
  slackLoopRadiusMm = 35.0
} = {}) {
  const cable = MIDSPAN_CABLE_CONSTRUCTIONS[cableType] || MIDSPAN_CABLE_CONSTRUCTIONS.STRANDED_LOOSE_TUBE;
  const tool = SLITTER_TOOL_TYPES[slitterTool] || SLITTER_TOOL_TYPES.ROTARY_MICROMETER;

  const cores = Math.max(1, Number(totalCores) || 24);
  const tubes = Math.max(1, Number(bufferTubeCount) || 1);
  const coresPerTube = Math.round(cores / tubes);
  const tappedCores = Math.min(cores, Math.max(1, Number(tappedCoreCount) || 1));
  const expressCores = Math.max(0, cores - tappedCores);
  const expressTubes = Math.max(0, tubes - 1);

  const tubeDia = Math.max(1.0, Number(tubeOuterDiameterMm) || 2.2);
  const wallThick = Math.max(0.2, Number(tubeWallThicknessMm) || 0.40);
  const bladeDepth = Math.max(0.1, Number(bladeDepthMm) || 0.34);
  const loopRadius = Math.max(10.0, Number(slackLoopRadiusMm) || 35.0);

  // Optimal blade depth: 85% of tube wall thickness
  const optimalBladeDepthMm = Math.round(wallThick * 0.85 * 100) / 100;
  const isBladeTooDeep = bladeDepth >= wallThick * 0.98; // Razor cuts directly into fiber chamber!
  const isBladeTooShallow = bladeDepth < wallThick * 0.65; // Won't crack open easily

  // Clearance between blade tip and inner core bundle (in micrometers)
  const remainingWallMm = Math.max(0, wallThick - bladeDepth);
  const clearanceMicrons = Math.round(remainingWallMm * 1000);

  // Express tube macro-bend radius check (ITU-T L.200 min 30mm)
  const minRadius = cable.minBendRadiusMm;
  const isBendRadiusViolated = loopRadius < minRadius;
  let macroBendPenaltyDb = 0.0;
  if (isBendRadiusViolated) {
    // Inverse square penalty when bend radius is violated
    macroBendPenaltyDb = Math.round(1.5 * Math.pow(minRadius / loopRadius, 2) * 100) / 100;
  }

  // Splicer risk assessment
  let status = 'PASS';
  let statusClass = 'status-pass';
  let statusLabel = 'Safe Mid-Span Access (Zero Core Risk)';

  if (isBladeTooDeep || tappedCores > coresPerTube * 1.5) {
    status = 'FAIL';
    statusClass = 'status-fail';
    statusLabel = 'CRITICAL HAZARD: Blade Penetration / Core Severance Risk';
  } else if (isBladeTooShallow || isBendRadiusViolated) {
    status = 'WARNING';
    statusClass = 'status-warning';
    statusLabel = 'WARNING: ' + (isBladeTooShallow ? 'Shallow Blade Depth' : 'Macro-Bend Loss on Express Cores');
  }

  return {
    cableType,
    cableName: cable.name,
    strengthMember: cable.strengthMember,
    slitterTool,
    toolName: tool.name,
    totalCores,
    bufferTubeCount: tubes,
    coresPerTube,
    tappedTubeIndex: Number(tappedTubeIndex) || 1,
    tappedCoreCount: tappedCores,
    expressCoreCount: expressCores,
    expressTubeCount: expressTubes,
    tubeOuterDiameterMm: tubeDia,
    tubeWallThicknessMm: wallThick,
    bladeDepthMm: bladeDepth,
    optimalBladeDepthMm,
    clearanceMicrons,
    isBladeTooDeep,
    isBladeTooShallow,
    slackLoopRadiusMm: loopRadius,
    minBendRadiusMm: minRadius,
    isBendRadiusViolated,
    macroBendPenaltyDb,
    status,
    statusClass,
    statusLabel
  };
}

/**
 * Generates pure-vector SVG cutaway diagram of mid-span cable shave & express fiber loop.
 */
export function renderMidspanAccessSvg(metrics, { width = 720, height = 280 } = {}) {
  if (!metrics) {
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="No Mid-Span Data">
      <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>
      <text x="${width / 2}" y="${height / 2}" fill="#94a3b8" text-anchor="middle" font-size="14" font-family="sans-serif">No Mid-Span Access Configuration</text>
    </svg>`;
  }

  const isCritical = metrics.status === 'FAIL';
  const isWarning = metrics.status === 'WARNING';
  const statusColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Cable Mid-Span Access Diagram">
    <defs>
      <linearGradient id="sheathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="50%" stop-color="#334155"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#cbd5e1"/>
        <stop offset="100%" stop-color="#64748b"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>

    <!-- Header info banner -->
    <text x="25" y="25" fill="#38bdf8" font-size="13" font-weight="700" font-family="sans-serif">${metrics.cableName}</text>
    <text x="${width - 25}" y="25" fill="${statusColor}" font-size="12" font-weight="700" text-anchor="end" font-family="sans-serif">${metrics.statusLabel} [${metrics.status}]</text>

    <!-- Cable Outer Sheath Cutaway (Left & Right intact jackets) -->
    <g class="cable-sheath">
      <!-- Left Jacket -->
      <rect x="25" y="115" width="110" height="70" fill="url(#sheathGrad)" rx="4" stroke="#475569" stroke-width="1.5"/>
      <text x="80" y="155" fill="#94a3b8" font-size="10" font-weight="600" text-anchor="middle" font-family="sans-serif">CABLE INLET</text>
      
      <!-- Right Jacket -->
      <rect x="${width - 135}" y="115" width="110" height="70" fill="url(#sheathGrad)" rx="4" stroke="#475569" stroke-width="1.5"/>
      <text x="${width - 80}" y="155" fill="#94a3b8" font-size="10" font-weight="600" text-anchor="middle" font-family="sans-serif">EXPRESS OUTLET</text>
    </g>

    <!-- Central Strength Member clamp (horizontal steel/FRP rod) -->
    <line x1="135" y1="150" x2="${width - 135}" y2="150" stroke="#f59e0b" stroke-width="4"/>
    <text x="${width / 2}" y="145" fill="#f59e0b" font-size="9" font-weight="600" text-anchor="middle" font-family="sans-serif">CENTRAL FRP/STEEL STRENGTH MEMBER (CLAMPED CONTINUOUS)</text>

    <!-- Express Uncut Buffer Tubes (Looped in Storage Tray) -->
    <g class="express-loop">
      <path d="M 135 130 C 220 50, ${width - 220} 50, ${width - 135} 130" fill="none" stroke="#0ea5e9" stroke-width="6" stroke-linecap="round" opacity="0.85"/>
      <path d="M 135 125 C 220 40, ${width - 220} 40, ${width - 135} 125" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round" opacity="0.85"/>
      <text x="${width / 2}" y="65" fill="#38bdf8" font-size="11" font-weight="700" text-anchor="middle" font-family="sans-serif">
        ${metrics.expressTubeCount} Express Uncut Tubes (${metrics.expressCoreCount} Cores) · Tray Loop Radius: ${metrics.slackLoopRadiusMm} mm ${metrics.isBendRadiusViolated ? '⚠️ MACRO-BEND' : '✓ OK'}
      </text>
    </g>

    <!-- Shaved Tapped Buffer Tube (Lower Arc being accessed) -->
    <g class="shaved-tube">
      <path d="M 135 170 Q 250 215, 330 215" fill="none" stroke="#f43f5e" stroke-width="7" stroke-linecap="round"/>
      <path d="M 390 215 Q 470 215, ${width - 135} 170" fill="none" stroke="#f43f5e" stroke-width="7" stroke-linecap="round"/>
      
      <!-- Open window in buffer tube -->
      <rect x="330" y="210" width="60" height="10" fill="#0f172a" stroke="#f43f5e" stroke-dasharray="2,2" stroke-width="1.5"/>
      <text x="360" y="202" fill="#fda4af" font-size="9" text-anchor="middle" font-weight="700" font-family="sans-serif">SHAVED WINDOW</text>
      
      <!-- Extracted optical fibers branching out to splice tray -->
      <path d="M 345 215 C 330 250, 310 260, 240 265" fill="none" stroke="#38bdf8" stroke-width="2"/>
      <path d="M 360 215 C 355 250, 345 260, 310 265" fill="none" stroke="#22c55e" stroke-width="2"/>
      <path d="M 375 215 C 380 250, 390 260, 420 265" fill="none" stroke="#eab308" stroke-width="2"/>
      <text x="330" y="275" fill="#a5f3fc" font-size="10" font-weight="700" text-anchor="middle" font-family="sans-serif">
        Tapped ${metrics.tappedCoreCount} Fibers to FAT Splice Tray
      </text>
    </g>

    <!-- Slitter Tool Blade Schematic (Zoom Box) -->
    <g class="slitter-callout" transform="translate(${width - 250}, 180)">
      <rect x="0" y="0" width="225" height="85" fill="#1e293b" rx="6" stroke="${metrics.isBladeTooDeep ? '#ef4444' : '#475569'}" stroke-width="1.5"/>
      <text x="10" y="18" fill="#f8fafc" font-size="10" font-weight="700" font-family="sans-serif">${metrics.toolName}</text>
      <text x="10" y="36" fill="#94a3b8" font-size="9" font-family="monospace">Tube Wall: ${metrics.tubeWallThicknessMm} mm | Blade: ${metrics.bladeDepthMm} mm</text>
      <text x="10" y="52" fill="#38bdf8" font-size="9" font-family="monospace">Optimal: ${metrics.optimalBladeDepthMm} mm (85% wall)</text>
      <text x="10" y="68" fill="${metrics.isBladeTooDeep ? '#ef4444' : metrics.clearanceMicrons < 50 ? '#f59e0b' : '#4ade80'}" font-size="9" font-weight="700" font-family="monospace">
        Core Clearance: ${metrics.clearanceMicrons} µm ${metrics.isBladeTooDeep ? '(BLADE NICK HAZARD!)' : '(SAFE)'}
      </text>
    </g>
  </svg>`;
}

/**
 * Formats bilingual WhatsApp field dispatch message (English / Urdu).
 */
export function formatMidspanAccessWhatsApp(record) {
  const m = record.metrics || {};
  const statusEmoji = m.status === 'PASS' ? '✅' : m.status === 'WARNING' ? '⚠️' : '🚨';

  return `✂️ *SHAHDARA ISP - MID-SPAN BUFFER TUBE ACCESS REPORT* ✂️
${statusEmoji} *Status / کیفیت:* ${m.statusLabel || m.status}
📍 *Area / مقام:* ${record.area || 'Shahdara Distribution'}
📦 *Cable Construction / کیبل:* ${m.cableName || record.cableType}
🔧 *Slitter Tool / شیونگ ٹول:* ${m.toolName || record.slitterTool}
🎯 *Total Cores:* ${m.totalCores || 0} (${m.bufferTubeCount || 1} Tubes)
🔗 *Express Cores (Uncut):* ${m.expressCoreCount || 0} Cores (${m.expressTubeCount || 0} Tubes)
✂️ *Tapped Cores:* ${m.tappedCoreCount || 0} Cores (Tube #${m.tappedTubeIndex || 1})
📏 *Blade Depth:* ${m.bladeDepthMm || 0} mm (Optimal: ${m.optimalBladeDepthMm || 0} mm)
🔬 *Core Clearance:* ${m.clearanceMicrons || 0} µm (${m.isBladeTooDeep ? 'HAZARD - Blade Nick' : 'Safe Clearance'})
🔄 *Slack Loop Radius:* ${m.slackLoopRadiusMm || 0} mm (Min: ${m.minBendRadiusMm || 30} mm, Penalty: ${m.macroBendPenaltyDb || 0} dB)
👤 *Splicer / سپلائیسر:* ${record.technician || 'Shahdara Splicing Team'}
📝 *Notes / تفصیالت:* ${record.notes || 'Mid-span buffer tube express loop performed in FAT closure.'}
⏰ *Timestamp:* ${record.timestamp || new Date().toISOString()}`;
}

/**
 * Generates RFC-4180 CSV export with UTF-8 BOM.
 */
export function generateMidspanAccessCsv(records = []) {
  const headers = [
    'Audit ID',
    'Timestamp',
    'Area',
    'Cable Type',
    'Slitter Tool',
    'Technician',
    'Total Cores',
    'Buffer Tubes',
    'Tapped Cores',
    'Express Cores',
    'Blade Depth (mm)',
    'Wall Thickness (mm)',
    'Clearance (um)',
    'Loop Radius (mm)',
    'Macro-Bend Loss (dB)',
    'Status',
    'Notes'
  ];

  const escapeField = str => {
    const val = str === null || str === undefined ? '' : String(str);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = records.map(r => {
    const m = r.metrics || {};
    return [
      r.id || '',
      r.timestamp || '',
      r.area || '',
      m.cableName || r.cableType || '',
      m.toolName || r.slitterTool || '',
      r.technician || '',
      m.totalCores || 0,
      m.bufferTubeCount || 0,
      m.tappedCoreCount || 0,
      m.expressCoreCount || 0,
      m.bladeDepthMm || '',
      m.tubeWallThicknessMm || '',
      m.clearanceMicrons || '',
      m.slackLoopRadiusMm || '',
      m.macroBendPenaltyDb || '',
      m.status || '',
      r.notes || ''
    ].map(escapeField).join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export function loadMidspanAccessAuditLog(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(MIDSPAN_ACCESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveMidspanAccessAuditLog(records, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    storage.setItem(MIDSPAN_ACCESS_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export function clearMidspanAccessAuditLog(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    storage.removeItem(MIDSPAN_ACCESS_STORAGE_KEY);
  } catch {}
}

/**
 * Controller to wire and manage Mobile Mid-Span Access Assistant Modal dialog.
 */
export function setupMobileMidspanAccessModal(state, { storage = typeof localStorage !== 'undefined' ? localStorage : null, onToast = () => {} } = {}) {
  if (typeof document === 'undefined') return { open: () => {}, close: () => {} };

  const modal = document.getElementById('mobileMidspanAccessModal');
  const openBtn = document.getElementById('mobileMoreMidspanAccessBtn');
  const closeBtn = document.getElementById('mobileMidspanAccessCloseBtn');
  const presetSelect = document.getElementById('midspanPresetSelect');
  const cableSelect = document.getElementById('midspanCableSelect');
  const toolSelect = document.getElementById('midspanToolSelect');
  const totalCoresInput = document.getElementById('midspanTotalCoresInput');
  const bufferTubesInput = document.getElementById('midspanBufferTubesInput');
  const tappedTubeIndexInput = document.getElementById('midspanTappedTubeIndexInput');
  const tappedCoresInput = document.getElementById('midspanTappedCoresInput');
  const tubeOuterDiaInput = document.getElementById('midspanTubeOuterDiaInput');
  const tubeWallThickInput = document.getElementById('midspanTubeWallThickInput');
  const bladeDepthInput = document.getElementById('midspanBladeDepthInput');
  const loopRadiusInput = document.getElementById('midspanLoopRadiusInput');
  const areaSelect = document.getElementById('midspanAreaSelect');
  const technicianInput = document.getElementById('midspanTechnicianInput');
  const notesInput = document.getElementById('midspanNotesInput');
  const svgContainer = document.getElementById('midspanSvgContainer');
  const saveBtn = document.getElementById('midspanSaveAuditBtn');
  const shareBtn = document.getElementById('midspanShareWhatsAppBtn');
  const exportCsvBtn = document.getElementById('midspanExportCsvBtn');
  const clearHistoryBtn = document.getElementById('midspanClearHistoryBtn');
  const historyTbody = document.getElementById('midspanHistoryTbody');

  // KPI elements
  const kpiStatus = document.getElementById('midspanKpiStatus');
  const kpiExpressCores = document.getElementById('midspanKpiExpressCores');
  const kpiOptimalDepth = document.getElementById('midspanKpiOptimalDepth');
  const kpiClearance = document.getElementById('midspanKpiClearance');
  const kpiBendRadius = document.getElementById('midspanKpiBendRadius');

  function open() {
    if (modal) {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
      renderHistory();
      if (presetSelect && presetSelect.value) {
        const p = MIDSPAN_PRESETS.find(x => x.id === presetSelect.value);
        if (p) applyPreset(p);
      } else {
        applyPreset(MIDSPAN_PRESETS[0]);
      }
    }
  }

  function close() {
    if (modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  }

  function applyPreset(preset) {
    if (!preset) return;
    if (cableSelect) cableSelect.value = preset.cableType;
    if (toolSelect) toolSelect.value = preset.slitterTool;
    if (totalCoresInput) totalCoresInput.value = preset.totalCores;
    if (bufferTubesInput) bufferTubesInput.value = preset.bufferTubeCount;
    if (tappedTubeIndexInput) tappedTubeIndexInput.value = preset.tappedTubeIndex;
    if (tappedCoresInput) tappedCoresInput.value = preset.tappedCoreCount;
    if (tubeOuterDiaInput) tubeOuterDiaInput.value = preset.tubeOuterDiameterMm;
    if (tubeWallThickInput) tubeWallThickInput.value = preset.tubeWallThicknessMm;
    if (bladeDepthInput) bladeDepthInput.value = preset.bladeDepthMm;
    if (loopRadiusInput) loopRadiusInput.value = preset.slackLoopRadiusMm;
    if (areaSelect) areaSelect.value = preset.area;
    if (technicianInput) technicianInput.value = preset.technician;
    if (notesInput) notesInput.value = preset.notes;

    recalculateAndRender();
  }

  function recalculateAndRender() {
    const cableType = cableSelect?.value || 'STRANDED_LOOSE_TUBE';
    const slitterTool = toolSelect?.value || 'ROTARY_MICROMETER';
    const totalCores = parseInt(totalCoresInput?.value, 10) || 48;
    const bufferTubeCount = parseInt(bufferTubesInput?.value, 10) || 4;
    const tappedTubeIndex = parseInt(tappedTubeIndexInput?.value, 10) || 1;
    const tappedCoreCount = parseInt(tappedCoresInput?.value, 10) || 12;
    const tubeOuterDiameterMm = parseFloat(tubeOuterDiaInput?.value) || 2.2;
    const tubeWallThicknessMm = parseFloat(tubeWallThickInput?.value) || 0.40;
    const bladeDepthMm = parseFloat(bladeDepthInput?.value) || 0.34;
    const slackLoopRadiusMm = parseFloat(loopRadiusInput?.value) || 35.0;

    const metrics = calculateMidspanAccessMetrics({
      cableType,
      slitterTool,
      totalCores,
      bufferTubeCount,
      tappedTubeIndex,
      tappedCoreCount,
      tubeOuterDiameterMm,
      tubeWallThicknessMm,
      bladeDepthMm,
      slackLoopRadiusMm
    });

    if (kpiStatus) {
      kpiStatus.textContent = metrics.statusLabel;
      kpiStatus.className = `audit-status-badge ${metrics.status === 'PASS' ? 'audit-pill-clean' : metrics.status === 'WARNING' ? 'audit-pill-review' : 'audit-pill-error'}`;
    }
    if (kpiExpressCores) kpiExpressCores.textContent = `${metrics.expressCoreCount} Cores (${metrics.expressTubeCount} Tubes Uncut)`;
    if (kpiOptimalDepth) kpiOptimalDepth.textContent = `${metrics.optimalBladeDepthMm} mm (Set: ${metrics.bladeDepthMm} mm)`;
    if (kpiClearance) {
      kpiClearance.textContent = `${metrics.clearanceMicrons} µm ${metrics.isBladeTooDeep ? '(NICK HAZARD)' : '(Safe)'}`;
      kpiClearance.style.color = metrics.isBladeTooDeep ? 'var(--red, #ef4444)' : 'inherit';
    }
    if (kpiBendRadius) {
      kpiBendRadius.textContent = `${metrics.slackLoopRadiusMm} mm (Min: ${metrics.minBendRadiusMm} mm)`;
    }

    if (svgContainer) {
      svgContainer.innerHTML = renderMidspanAccessSvg(metrics, { width: 720, height: 280 });
    }

    return metrics;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const history = loadMidspanAccessAuditLog(storage);
    historyTbody.innerHTML = '';
    if (!history.length) {
      historyTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:12px">No mid-span access audit records yet.</td></tr>';
      return;
    }
    history.slice(-10).reverse().forEach(rec => {
      const m = rec.metrics || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:monospace;font-size:11px">${(rec.timestamp || '').slice(0, 16).replace('T', ' ')}</td>
        <td>${rec.area || '-'}</td>
        <td style="font-size:11px">${m.cableName || rec.cableType}</td>
        <td><strong>${m.tappedCoreCount || 0} Tapped / ${m.expressCoreCount || 0} Exp</strong></td>
        <td>${m.clearanceMicrons || 0} µm</td>
        <td><span class="audit-status-badge ${m.status === 'PASS' ? 'audit-pill-clean' : m.status === 'WARNING' ? 'audit-pill-review' : 'audit-pill-error'}">${m.status}</span></td>
      `;
      historyTbody.appendChild(tr);
    });
  }

  // Event handlers
  if (openBtn && !openBtn.dataset.wiredMidspan) {
    openBtn.dataset.wiredMidspan = 'true';
    openBtn.addEventListener('click', open);
  }
  if (closeBtn && !closeBtn.dataset.wiredMidspan) {
    closeBtn.dataset.wiredMidspan = 'true';
    closeBtn.addEventListener('click', close);
  }

  if (presetSelect && !presetSelect.dataset.wiredMidspan) {
    presetSelect.dataset.wiredMidspan = 'true';
    presetSelect.addEventListener('change', () => {
      const p = MIDSPAN_PRESETS.find(x => x.id === presetSelect.value);
      if (p) applyPreset(p);
    });
  }

  const inputs = [
    cableSelect, toolSelect, totalCoresInput, bufferTubesInput,
    tappedTubeIndexInput, tappedCoresInput, tubeOuterDiaInput,
    tubeWallThickInput, bladeDepthInput, loopRadiusInput
  ];
  inputs.forEach(el => {
    if (el && !el.dataset.wiredMidspan) {
      el.dataset.wiredMidspan = 'true';
      el.addEventListener('input', recalculateAndRender);
    }
  });

  if (cableSelect && !cableSelect.dataset.wiredCableChange) {
    cableSelect.dataset.wiredCableChange = 'true';
    cableSelect.addEventListener('change', () => {
      const c = MIDSPAN_CABLE_CONSTRUCTIONS[cableSelect.value];
      if (c) {
        if (tubeOuterDiaInput) tubeOuterDiaInput.value = c.defaultTubeDiaMm;
        if (tubeWallThickInput) tubeWallThickInput.value = c.defaultWallThicknessMm;
        if (bladeDepthInput) bladeDepthInput.value = Math.round(c.defaultWallThicknessMm * 0.85 * 100) / 100;
        recalculateAndRender();
      }
    });
  }

  if (saveBtn && !saveBtn.dataset.wiredMidspan) {
    saveBtn.dataset.wiredMidspan = 'true';
    saveBtn.addEventListener('click', () => {
      const metrics = recalculateAndRender();
      const record = {
        id: `MIDSPAN-${Date.now()}`,
        timestamp: new Date().toISOString(),
        area: areaSelect?.value || 'Shahdara Town',
        cableType: cableSelect?.value || 'STRANDED_LOOSE_TUBE',
        slitterTool: toolSelect?.value || 'ROTARY_MICROMETER',
        technician: technicianInput?.value || 'Technician',
        notes: notesInput?.value || '',
        metrics
      };
      const history = loadMidspanAccessAuditLog(storage);
      history.push(record);
      saveMidspanAccessAuditLog(history, storage);
      renderHistory();
      onToast('Mid-Span Access audit record saved!');
    });
  }

  if (shareBtn && !shareBtn.dataset.wiredMidspan) {
    shareBtn.dataset.wiredMidspan = 'true';
    shareBtn.addEventListener('click', () => {
      const metrics = recalculateAndRender();
      const record = {
        area: areaSelect?.value || 'Shahdara Town',
        cableType: cableSelect?.value || 'STRANDED_LOOSE_TUBE',
        slitterTool: toolSelect?.value || 'ROTARY_MICROMETER',
        technician: technicianInput?.value || 'Technician',
        notes: notesInput?.value || '',
        timestamp: new Date().toISOString(),
        metrics
      };
      const text = formatMidspanAccessWhatsApp(record);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    });
  }

  if (exportCsvBtn && !exportCsvBtn.dataset.wiredMidspan) {
    exportCsvBtn.dataset.wiredMidspan = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const history = loadMidspanAccessAuditLog(storage);
      if (!history.length) {
        onToast('No mid-span audit records to export.');
        return;
      }
      const csv = generateMidspanAccessCsv(history);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara_midspan_access_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('Mid-span audit CSV exported!');
    });
  }

  if (clearHistoryBtn && !clearHistoryBtn.dataset.wiredMidspan) {
    clearHistoryBtn.dataset.wiredMidspan = 'true';
    clearHistoryBtn.addEventListener('click', () => {
      clearMidspanAccessAuditLog(storage);
      renderHistory();
      onToast('Mid-Span access audit history cleared.');
    });
  }

  return {
    open,
    close,
    applyPreset,
    recalculateAndRender
  };
}
