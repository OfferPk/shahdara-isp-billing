/**
 * Shahdara ISP - Field Technician Visual Fault Locator (VFL) Laser & Fiber Core Color Code Identification Assistant
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements TIA-598-D / IEC 60304 standard 12-color fiber and buffer tube identification,
 * multi-tube cable core resolver (12, 24, 48, 96, 144, 288 cores), 650nm visible red laser diode
 * continuity and fault simulator (Continuous Wave CW, 1Hz blink, 2Hz strobe), fiber bend/break
 * leakage locator, persistent local test logs (localStorage), interactive SVG laser beam visualizer,
 * and lineman WhatsApp field dispatch reports.
 */

export const VFL_TEST_LOGS_STORAGE_KEY = 'shahdara_vfl_core_audit_logs_v1';

export const TIA_598_COLOR_CODES = [
  { id: 1, name: 'Blue', urduName: 'نیلا (Neela)', hex: '#0284c7', textDark: false },
  { id: 2, name: 'Orange', urduName: 'نارنجی (Naranji)', hex: '#f97316', textDark: false },
  { id: 3, name: 'Green', urduName: 'سبز (Sabz)', hex: '#16a34a', textDark: false },
  { id: 4, name: 'Brown', urduName: 'بھورا (Bhoora)', hex: '#854d0e', textDark: false },
  { id: 5, name: 'Slate', urduName: 'سلیٹی (Sleti / Grey)', hex: '#64748b', textDark: false },
  { id: 6, name: 'White', urduName: 'سفید (Safaid)', hex: '#f8fafc', textDark: true },
  { id: 7, name: 'Red', urduName: 'سرخ (Surkh / Red)', hex: '#dc2626', textDark: false },
  { id: 8, name: 'Black', urduName: 'کالا (Kala / Black)', hex: '#1e293b', textDark: false },
  { id: 9, name: 'Yellow', urduName: 'پیلا (Peela / Yellow)', hex: '#eab308', textDark: true },
  { id: 10, name: 'Violet', urduName: 'جامنی (Jamni / Purple)', hex: '#9333ea', textDark: false },
  { id: 11, name: 'Rose', urduName: 'گلابی (Gulabi / Pink)', hex: '#ec4899', textDark: false },
  { id: 12, name: 'Aqua', urduName: 'فیروزی (Ferozi / Cyan)', hex: '#06b6d4', textDark: false }
];

export const VFL_CABLE_TYPES = [
  { id: '12-core', name: '12-Core Drop / Feeder Cable', totalCores: 12, tubesCount: 1, coresPerTube: 12 },
  { id: '24-core', name: '24-Core Distribution Feeder', totalCores: 24, tubesCount: 2, coresPerTube: 12 },
  { id: '48-core', name: '48-Core Backbone Ring Cable', totalCores: 48, tubesCount: 4, coresPerTube: 12 },
  { id: '96-core', name: '96-Core High-Density Trunk', totalCores: 96, tubesCount: 8, coresPerTube: 12 },
  { id: '144-core', name: '144-Core Metro Transit Trunk', totalCores: 144, tubesCount: 12, coresPerTube: 12 }
];

export const VFL_LASER_MODES = {
  CW: { id: 'CW', label: 'Continuous Wave (Solid Red)', description: 'Constant laser emission for continuity check' },
  PULSE_1HZ: { id: 'PULSE_1HZ', label: '1 Hz Slow Pulse (Blinking)', description: 'Slow blink for identification in crowded trays' },
  PULSE_2HZ: { id: 'PULSE_2HZ', label: '2 Hz Rapid Strobe (Flashing)', description: 'Rapid strobe for pinpointing macrobends & micro-cracks' }
};

export const VFL_POWER_LEVELS = [
  { powerMw: 10, nominalRangeKm: 10, label: '10 mW (~10 km) - Standard Pen VFL' },
  { powerMw: 20, nominalRangeKm: 15, label: '20 mW (~15 km) - High-Power OSP VFL' },
  { powerMw: 30, nominalRangeKm: 20, label: '30 mW (~20 km) - Long-Distance Trunk VFL' }
];

export const VFL_FAULT_CONDITIONS = {
  CONTINUITY_OK: { id: 'CONTINUITY_OK', label: 'Continuity Verified (Clean Far-End Glow)', badgeClass: 'badge-success', severity: 'NORMAL' },
  MACROBEND: { id: 'MACROBEND', label: 'Macrobend Light Leakage Detected', badgeClass: 'badge-warning', severity: 'WARNING' },
  FIBER_BREAK: { id: 'FIBER_BREAK', label: 'Fiber Core Severed / Break Glow', badgeClass: 'badge-danger', severity: 'CRITICAL' },
  CRACKED_FERRULE: { id: 'CRACKED_FERRULE', label: 'Cracked Connector Ferrule Scattering', badgeClass: 'badge-danger', severity: 'CRITICAL' }
};

export const SHAHDARA_OSP_CABINETS = [
  { id: 'cab-sh-01', name: 'ODF-01 Main Central Exchange', area: 'Shahdara Town', landmark: 'Railway Station Road Central Exchange' },
  { id: 'cab-bd-02', name: 'FDH-02 Baradari Industrial Hub', area: 'Baradari Road', landmark: 'Tariq Road Near Carpet Mills Gate 2' },
  { id: 'cab-vn-03', name: 'FDH-03 Vandala Dayal Shah Box', area: 'Vandala Road', landmark: 'Main Vandala Chowk Near Grid Station' },
  { id: 'cab-jm-04', name: 'FAT-04 Jia Musa Primary ODF', area: 'Jia Musa', landmark: 'Farrukhabad Railway Crossing Pole #18' },
  { id: 'cab-sp-05', name: 'FAT-05 Saeed Park Aggregator', area: 'Saeed Park', landmark: 'Saeed Park Main Boulevard Street 4' },
  { id: 'cab-bk-06', name: 'ODF-06 Begum Kot Ring Splitter', area: 'Begum Kot', landmark: 'Sheikhupura Road Feeder Cabinet A' }
];

/**
 * Resolves standard TIA-598-D Tube Color and Core Color from absolute Core Number.
 */
export function resolveFiberCoreFromNumber(coreNumber, totalCores = 48) {
  const num = Math.max(1, Math.min(totalCores, Math.round(Number(coreNumber) || 1)));
  const tubeIndex = Math.floor((num - 1) / 12) + 1;
  const fiberIndex = ((num - 1) % 12) + 1;

  const tubeColor = TIA_598_COLOR_CODES.find(c => c.id === ((tubeIndex - 1) % 12) + 1) || TIA_598_COLOR_CODES[0];
  const fiberColor = TIA_598_COLOR_CODES.find(c => c.id === fiberIndex) || TIA_598_COLOR_CODES[0];
  const hasTracerRing = tubeIndex > 12;

  return {
    coreNumber: num,
    tubeNumber: tubeIndex,
    tubeColor,
    fiberNumberInTube: fiberIndex,
    fiberColor,
    totalCores,
    hasTracerRing
  };
}

/**
 * Reverse lookup: Calculates absolute Core Number from Tube Index and Fiber Index within tube.
 */
export function resolveCoreNumberFromTubeAndFiber(tubeNumber, fiberNumberInTube) {
  const tube = Math.max(1, Math.round(Number(tubeNumber) || 1));
  const fiber = Math.max(1, Math.min(12, Math.round(Number(fiberNumberInTube) || 1)));
  return (tube - 1) * 12 + fiber;
}

/**
 * Reads persistent VFL test logs from localStorage.
 */
export function getVflTestLogsStore(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  try {
    const raw = store.getItem(VFL_TEST_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Saves VFL test logs to localStorage.
 */
export function saveVflTestLogsStore(logs, storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.setItem(VFL_TEST_LOGS_STORAGE_KEY, JSON.stringify(logs.slice(0, 50)));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Records a new VFL test reading into persistent log storage.
 */
export function recordVflTestLog(reading, storage = null) {
  const logs = getVflTestLogsStore(storage);
  const faultId = typeof reading.faultCondition === 'object' && reading.faultCondition ? reading.faultCondition.id : (reading.faultCondition || 'CONTINUITY_OK');
  const faultLabel = typeof reading.faultCondition === 'object' && reading.faultCondition ? reading.faultCondition.label : (reading.faultLabel || faultId);

  const newEntry = {
    id: `vfl-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    coreNumber: reading.coreNumber,
    tubeNumber: reading.tubeNumber,
    tubeColorName: reading.tubeColor?.name || reading.tubeColorName || 'Blue',
    fiberColorName: reading.fiberColor?.name || reading.fiberColorName || 'Blue',
    laserMode: reading.laserMode,
    powerMw: reading.powerMw,
    faultCondition: faultId,
    faultLabel: faultLabel,
    cabinetId: reading.cabinetId,
    cabinetName: reading.cabinetName,
    linemanNotes: reading.linemanNotes || ''
  };

  logs.unshift(newEntry);
  saveVflTestLogsStore(logs, storage);
  return newEntry;
}

/**
 * Clears all VFL test logs from localStorage.
 */
export function clearVflTestLogsStore(storage = null) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.removeItem(VFL_TEST_LOGS_STORAGE_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Generates plain text WhatsApp dispatch report for linemen.
 */
export function generateVflFieldReport(reading, options = {}) {
  const dateStr = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
  const cabinet = SHAHDARA_OSP_CABINETS.find(c => c.id === reading.cabinetId) || SHAHDARA_OSP_CABINETS[0];

  return `🔴 *SHAHDARA ISP - VFL LASER & CORE IDENTIFICATION REPORT*
📅 Time: ${dateStr} PKT
📍 OSP Node: ${cabinet.name} (${cabinet.area})
📌 Landmark: ${cabinet.landmark}

*FIBER CORE SPECIFICATION (TIA-598-D):*
• Absolute Core Number: *Core #${reading.coreNumber}* (Total: ${reading.totalCores}-core cable)
• Buffer Tube #${reading.tubeNumber}: *${reading.tubeColor.name}* (${reading.tubeColor.urduName})
• Fiber Core in Tube: *#${reading.fiberNumberInTube} - ${reading.fiberColor.name}* (${reading.fiberColor.urduName})

*VFL LASER CONTINUITY TEST:*
• Light Source: 650nm Red Laser Diode (${reading.powerMw} mW)
• Emission Mode: ${reading.laserMode}
• Inspection Finding: *${reading.faultCondition.label}*
• Safety Warning: Class 3R Laser - Do NOT stare directly into optical ferrule.

${reading.linemanNotes ? `📝 Lineman Notes: ${reading.linemanNotes}\n` : ''}
Field verification performed via Shahdara Mobile Navigation Suite.`;
}

/**
 * Pure SVG Offline Visual Fault Locator (VFL) Laser Beam & Fiber Core Visualizer
 */
export function renderMobileVflLaserSvg(reading, options = {}) {
  const isCompact = !!options.compact;
  const tubeColor = reading.tubeColor || TIA_598_COLOR_CODES[0];
  const fiberColor = reading.fiberColor || TIA_598_COLOR_CODES[0];
  const fault = reading.faultCondition || VFL_FAULT_CONDITIONS.CONTINUITY_OK;
  const isPulse = reading.laserMode !== 'CW';

  if (isCompact) {
    // Compact preview for list tiles or small widgets (width: 320, height: 110)
    return `<svg class="vfl-compact-svg" viewBox="0 0 320 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="VFL Fiber Core Identifier Summary">
      <defs>
        <linearGradient id="vflCompactBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ef4444" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#dc2626" stop-opacity="0.9" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="320" height="110" rx="8" fill="var(--surface-alt, #0f172a)" stroke="var(--border-color, #334155)" />

      <!-- VFL Pen Emitter -->
      <g transform="translate(14, 25)">
        <rect x="0" y="10" width="40" height="18" rx="3" fill="#475569" stroke="#94a3b8" />
        <rect x="40" y="14" width="8" height="10" rx="2" fill="#cbd5e1" />
        <circle cx="48" cy="19" r="4" fill="#ef4444" />
        <text x="20" y="23" font-size="8" font-weight="700" fill="#f8fafc" text-anchor="middle">VFL</text>
      </g>

      <!-- Buffer Tube & Fiber Core Cable -->
      <g transform="translate(68, 35)">
        <!-- Outer Buffer Tube -->
        <rect x="0" y="0" width="180" height="18" rx="9" fill="${tubeColor.hex}" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
        <text x="90" y="13" font-size="9" font-weight="700" fill="${tubeColor.textDark ? '#0f172a' : '#ffffff'}" text-anchor="middle">Tube: ${tubeColor.name}</text>

        <!-- Inner Core Line with Laser Light -->
        <line x1="180" y1="9" x2="230" y2="9" stroke="${fiberColor.hex}" stroke-width="6" stroke-linecap="round" />
        <line x1="180" y1="9" x2="230" y2="9" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="${isPulse ? '4,2' : 'none'}" />
      </g>

      <!-- Far-end Connector Glow -->
      <g transform="translate(285, 44)">
        <circle cx="0" cy="0" r="10" fill="#ef4444" fill-opacity="${fault.id === 'FIBER_BREAK' ? '0.1' : '0.6'}" />
        <circle cx="0" cy="0" r="5" fill="#ffffff" />
      </g>

      <!-- Label Footer -->
      <text x="16" y="88" font-size="11" font-weight="700" fill="var(--text-color, #f8fafc)">Core #${reading.coreNumber} (${fiberColor.name})</text>
      <text x="16" y="100" font-size="9" fill="var(--text-muted, #94a3b8)">Tube #${reading.tubeNumber} · ${reading.powerMw}mW ${reading.laserMode}</text>
      <text x="304" y="94" font-size="10" font-weight="700" fill="${fault.severity === 'NORMAL' ? '#10b981' : fault.severity === 'WARNING' ? '#f59e0b' : '#ef4444'}" text-anchor="end">${fault.id.replace('_', ' ')}</text>
    </svg>`;
  }

  // Expanded detailed interactive SVG for mobile modal (width: 580, height: 260)
  return `<svg class="vfl-expanded-svg" viewBox="0 0 580 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Visual Fault Locator Red Laser and Fiber Core Diagram">
    <defs>
      <linearGradient id="vflPenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#334155" />
        <stop offset="50%" stop-color="#64748b" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <radialGradient id="vflLaserGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fee2e2" stop-opacity="1" />
        <stop offset="40%" stop-color="#ef4444" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#dc2626" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="faultGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="1" />
        <stop offset="30%" stop-color="#ef4444" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#991b1b" stop-opacity="0" />
      </radialGradient>
    </defs>

    <!-- Card Background -->
    <rect x="0" y="0" width="580" height="260" rx="10" fill="#0b1120" stroke="#334155" stroke-width="1.5" />

    <!-- Top Status Header -->
    <g transform="translate(16, 24)">
      <text x="0" y="0" font-size="12" font-weight="700" fill="#f8fafc">650nm VISIBLE RED LASER EMISSION · TIA-598-D CORE ID</text>
      <text x="548" y="0" font-size="11" font-weight="600" fill="#ef4444" text-anchor="end">Class 3R Laser · ${reading.powerMw} mW (${reading.laserMode})</text>
    </g>

    <!-- Visual Fault Locator Pen Body -->
    <g transform="translate(20, 90)">
      <!-- Pen Barrel -->
      <rect x="0" y="10" width="75" height="32" rx="4" fill="url(#vflPenGrad)" stroke="#94a3b8" />
      <text x="37" y="30" font-size="9" font-weight="700" fill="#f1f5f9" text-anchor="middle">VFL 650nm</text>
      
      <!-- Power LED Indicator -->
      <circle cx="15" cy="18" r="3" fill="#22c55e" />
      
      <!-- Brass Ferrule Adapter (2.5mm Universal) -->
      <rect x="75" y="16" width="16" height="20" rx="2" fill="#d97706" stroke="#b45309" />
      <rect x="91" y="21" width="8" height="10" rx="1" fill="#cbd5e1" />
      
      <!-- Emitted Red Laser Beam -->
      <circle cx="99" cy="26" r="10" fill="url(#vflLaserGlow)" />
      <line x1="99" y1="26" x2="125" y2="26" stroke="#ef4444" stroke-width="4" stroke-linecap="round" />
    </g>

    <!-- Optical Fiber Cable Section -->
    <g transform="translate(145, 90)">
      <!-- Loose Buffer Tube -->
      <rect x="0" y="0" width="220" height="52" rx="10" fill="${tubeColor.hex}" stroke="#ffffff" stroke-width="1.5" />
      
      <text x="110" y="20" font-size="11" font-weight="800" fill="${tubeColor.textDark ? '#0f172a' : '#ffffff'}" text-anchor="middle">
        TUBE #${reading.tubeNumber}: ${tubeColor.name.toUpperCase()} (${tubeColor.urduName})
      </text>

      <!-- Fiber Core inside buffer tube -->
      <rect x="15" y="28" width="190" height="16" rx="8" fill="${fiberColor.hex}" stroke="rgba(0,0,0,0.3)" />
      
      <!-- Laser Light propagating through core -->
      <line x1="20" y1="36" x2="200" y2="36" stroke="#ffffff" stroke-width="2" />
      <line x1="20" y1="36" x2="200" y2="36" stroke="#ef4444" stroke-width="4" stroke-opacity="0.85" stroke-dasharray="${isPulse ? '8,4' : 'none'}" />

      <text x="110" y="41" font-size="9" font-weight="700" fill="${fiberColor.textDark ? '#0f172a' : '#ffffff'}" text-anchor="middle">
        Core #${reading.fiberNumberInTube} (${fiberColor.name})
      </text>
    </g>

    <!-- Fault Inspection Zone / Macro-bend / Break -->
    <g transform="translate(385, 90)">
      ${fault.id === 'MACROBEND' ? `
        <!-- Macrobend light leak curve -->
        <path d="M 0,36 C 25,10 40,65 65,36" fill="none" stroke="${fiberColor.hex}" stroke-width="6" />
        <circle cx="35" cy="36" r="22" fill="url(#faultGlow)" />
        <circle cx="35" cy="36" r="6" fill="#ffffff" />
        <text x="35" y="80" font-size="9" font-weight="700" fill="#f59e0b" text-anchor="middle">⚠ Macrobend Light Leakage</text>
      ` : fault.id === 'FIBER_BREAK' ? `
        <!-- Severed Fiber Break -->
        <line x1="0" y1="36" x2="25" y2="36" stroke="${fiberColor.hex}" stroke-width="6" />
        <circle cx="28" cy="36" r="24" fill="url(#faultGlow)" />
        <line x1="45" y1="36" x2="70" y2="36" stroke="#475569" stroke-width="4" stroke-dasharray="3,3" />
        <text x="35" y="80" font-size="9" font-weight="700" fill="#ef4444" text-anchor="middle">🚨 Complete Fiber Break</text>
      ` : fault.id === 'CRACKED_FERRULE' ? `
        <!-- Cracked Ferrule Scatter -->
        <line x1="0" y1="36" x2="50" y2="36" stroke="${fiberColor.hex}" stroke-width="6" />
        <circle cx="50" cy="36" r="20" fill="url(#faultGlow)" />
        <text x="35" y="80" font-size="9" font-weight="700" fill="#ef4444" text-anchor="middle">⚠ Cracked Ferrule Scatter</text>
      ` : `
        <!-- Normal clean fiber propagation -->
        <line x1="0" y1="36" x2="70" y2="36" stroke="${fiberColor.hex}" stroke-width="6" />
        <line x1="0" y1="36" x2="70" y2="36" stroke="#ef4444" stroke-width="3" stroke-dasharray="${isPulse ? '8,4' : 'none'}" />
        <text x="35" y="80" font-size="9" font-weight="700" fill="#10b981" text-anchor="middle">✓ Unbroken Core Continuity</text>
      `}
    </g>

    <!-- Far-End Rosette / Patch Connector (Right) -->
    <g transform="translate(480, 95)">
      <rect x="0" y="15" width="28" height="22" rx="3" fill="#16a34a" stroke="#22c55e" />
      <rect x="28" y="21" width="10" height="10" rx="1" fill="#f8fafc" />
      
      <!-- Far-end laser light output -->
      ${fault.id !== 'FIBER_BREAK' ? `
        <circle cx="38" cy="26" r="18" fill="url(#vflLaserGlow)" />
        <circle cx="38" cy="26" r="6" fill="#ffffff" />
        <line x1="38" y1="26" x2="70" y2="26" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
      ` : `
        <circle cx="38" cy="26" r="3" fill="#475569" />
        <text x="25" y="54" font-size="8" fill="#94a3b8" text-anchor="middle">Dark (No Light)</text>
      `}
      <text x="14" y="29" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle">SC</text>
    </g>

    <!-- Bottom KPI & Information Summary Bar -->
    <g transform="translate(16, 205)">
      <rect x="0" y="0" width="548" height="42" rx="6" fill="#1e293b" stroke="#334155" />
      
      <text x="14" y="18" font-size="10" font-weight="600" fill="#94a3b8">ABSOLUTE CORE</text>
      <text x="14" y="32" font-size="13" font-weight="800" fill="#38bdf8">CORE #${reading.coreNumber} (${reading.totalCores}C)</text>

      <text x="160" y="18" font-size="10" font-weight="600" fill="#94a3b8">BUFFER TUBE</text>
      <text x="160" y="32" font-size="12" font-weight="700" fill="${tubeColor.hex}">Tube ${reading.tubeNumber} (${tubeColor.name})</text>

      <text x="310" y="18" font-size="10" font-weight="600" fill="#94a3b8">FIBER IN TUBE</text>
      <text x="310" y="32" font-size="12" font-weight="700" fill="${fiberColor.hex}">Fiber ${reading.fiberNumberInTube} (${fiberColor.name})</text>

      <text x="440" y="18" font-size="10" font-weight="600" fill="#94a3b8">INSPECTION RESULT</text>
      <text x="440" y="32" font-size="11" font-weight="800" fill="${fault.severity === 'NORMAL' ? '#10b981' : fault.severity === 'WARNING' ? '#f59e0b' : '#ef4444'}">${fault.id.replace('_', ' ')}</text>
    </g>
  </svg>`;
}

/**
 * Initializes and wires the interactive Visual Fault Locator (VFL) Modal Dialog & Mobile Navigation Triggers
 */
export function setupMobileVflModal(options = {}) {
  const modal = document.getElementById('mobileVflModal');
  const openButtons = document.querySelectorAll('[data-open-vfl-tracer]');
  const closeButton = document.getElementById('mobileVflModalCloseBtn');

  const cableTypeSelect = document.getElementById('vflCableTypeSelect');
  const coreNumberInput = document.getElementById('vflCoreNumberInput');
  const coreNumberSlider = document.getElementById('vflCoreNumberSlider');
  const tubeSelect = document.getElementById('vflTubeSelect');
  const fiberSelect = document.getElementById('vflFiberSelect');
  const laserModeSelect = document.getElementById('vflLaserModeSelect');
  const powerLevelSelect = document.getElementById('vflPowerLevelSelect');
  const faultConditionSelect = document.getElementById('vflFaultConditionSelect');
  const cabinetSelect = document.getElementById('vflCabinetSelect');
  const notesInput = document.getElementById('vflNotesInput');

  // KPI elements
  const kpiCorePill = document.getElementById('vflKpiCorePill');
  const kpiTubeBadge = document.getElementById('vflKpiTubeBadge');
  const kpiFiberBadge = document.getElementById('vflKpiFiberBadge');
  const kpiFaultBadge = document.getElementById('vflKpiFaultBadge');

  // Diagram container
  const diagramContainer = document.getElementById('vflLaserSvgContainer');
  const logsList = document.getElementById('vflLogsList');

  // Action buttons
  const recordLogBtn = document.getElementById('vflRecordLogBtn');
  const copyReportBtn = document.getElementById('vflCopyReportBtn');
  const filterAreaBtn = document.getElementById('vflFilterAreaBtn');
  const clearLogsBtn = document.getElementById('vflClearLogsBtn');

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  let currentReading = {
    cableTypeId: '48-core',
    totalCores: 48,
    coreNumber: 1,
    tubeNumber: 1,
    tubeColor: TIA_598_COLOR_CODES[0],
    fiberNumberInTube: 1,
    fiberColor: TIA_598_COLOR_CODES[0],
    laserMode: 'CW',
    powerMw: 10,
    faultCondition: VFL_FAULT_CONDITIONS.CONTINUITY_OK,
    cabinetId: 'cab-sh-01',
    cabinetName: SHAHDARA_OSP_CABINETS[0].name,
    linemanNotes: ''
  };

  function updateCoreFromNumber(coreNum) {
    const resolved = resolveFiberCoreFromNumber(coreNum, currentReading.totalCores);
    currentReading.coreNumber = resolved.coreNumber;
    currentReading.tubeNumber = resolved.tubeNumber;
    currentReading.tubeColor = resolved.tubeColor;
    currentReading.fiberNumberInTube = resolved.fiberNumberInTube;
    currentReading.fiberColor = resolved.fiberColor;

    if (coreNumberInput) coreNumberInput.value = currentReading.coreNumber;
    if (coreNumberSlider) coreNumberSlider.value = currentReading.coreNumber;
    if (tubeSelect) tubeSelect.value = currentReading.tubeNumber.toString();
    if (fiberSelect) fiberSelect.value = currentReading.fiberNumberInTube.toString();
  }

  function updateCoreFromTubeAndFiber(tubeNum, fiberNum) {
    const coreNum = resolveCoreNumberFromTubeAndFiber(tubeNum, fiberNum);
    updateCoreFromNumber(coreNum);
  }

  function renderView() {
    if (kpiCorePill) {
      kpiCorePill.textContent = `Core #${currentReading.coreNumber} of ${currentReading.totalCores}C`;
    }

    if (kpiTubeBadge) {
      kpiTubeBadge.textContent = `Tube ${currentReading.tubeNumber}: ${currentReading.tubeColor.name}`;
      kpiTubeBadge.style.backgroundColor = currentReading.tubeColor.hex;
      kpiTubeBadge.style.color = currentReading.tubeColor.textDark ? '#0f172a' : '#ffffff';
    }

    if (kpiFiberBadge) {
      kpiFiberBadge.textContent = `Fiber ${currentReading.fiberNumberInTube}: ${currentReading.fiberColor.name}`;
      kpiFiberBadge.style.backgroundColor = currentReading.fiberColor.hex;
      kpiFiberBadge.style.color = currentReading.fiberColor.textDark ? '#0f172a' : '#ffffff';
    }

    if (kpiFaultBadge) {
      kpiFaultBadge.textContent = currentReading.faultCondition.label;
      kpiFaultBadge.className = `badge ${currentReading.faultCondition.badgeClass}`;
    }

    if (diagramContainer) {
      diagramContainer.innerHTML = renderMobileVflLaserSvg(currentReading, { compact: false });
    }

    renderLogsList();
  }

  function renderLogsList() {
    if (!logsList) return;
    const logs = getVflTestLogsStore(storage);
    if (logs.length === 0) {
      logsList.innerHTML = '<li style="padding: 10px; color: var(--muted, #94a3b8); font-size: 12px; text-align: center;">No VFL field inspection logs recorded yet.</li>';
      return;
    }

    logsList.innerHTML = logs.map(l => {
      const time = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <li style="padding: 8px 10px; background: rgba(15, 23, 42, 0.4); border-radius: 6px; border: 1px solid var(--border, #334155); font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-weight: 700; color: #38bdf8;">Core #${l.coreNumber}</span>
            <span style="color: var(--muted, #94a3b8);"> (Tube: ${l.tubeColorName} · Fiber: ${l.fiberColorName})</span>
            <div style="font-size: 11px; color: var(--muted, #64748b);">${l.cabinetName} · ${time}</div>
          </div>
          <span class="badge ${l.faultCondition === 'CONTINUITY_OK' ? 'badge-success' : 'badge-danger'}" style="font-size: 10px;">${l.faultCondition.replace('_', ' ')}</span>
        </li>
      `;
    }).join('');
  }

  function openModal() {
    if (!modal) return;
    updateCoreFromNumber(currentReading.coreNumber);
    renderView();
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function closeModal() {
    if (!modal) return;
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  // Attach open triggers
  openButtons.forEach(btn => {
    btn.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      openModal();
    };
  });

  if (closeButton) {
    closeButton.onclick = (e) => {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      closeModal();
    };
  }

  if (cableTypeSelect) {
    cableTypeSelect.onchange = (e) => {
      const cable = VFL_CABLE_TYPES.find(c => c.id === e.target.value) || VFL_CABLE_TYPES[2];
      currentReading.cableTypeId = cable.id;
      currentReading.totalCores = cable.totalCores;
      if (coreNumberSlider) coreNumberSlider.max = cable.totalCores.toString();
      if (coreNumberInput) coreNumberInput.max = cable.totalCores.toString();
      updateCoreFromNumber(Math.min(currentReading.coreNumber, cable.totalCores));
      renderView();
    };
  }

  if (coreNumberSlider) {
    coreNumberSlider.oninput = (e) => {
      updateCoreFromNumber(Number(e.target.value));
      renderView();
    };
  }

  if (coreNumberInput) {
    coreNumberInput.oninput = (e) => {
      const val = Number(e.target.value);
      if (!isNaN(val) && val >= 1) {
        updateCoreFromNumber(val);
        renderView();
      }
    };
  }

  if (tubeSelect) {
    tubeSelect.onchange = (e) => {
      updateCoreFromTubeAndFiber(Number(e.target.value), currentReading.fiberNumberInTube);
      renderView();
    };
  }

  if (fiberSelect) {
    fiberSelect.onchange = (e) => {
      updateCoreFromTubeAndFiber(currentReading.tubeNumber, Number(e.target.value));
      renderView();
    };
  }

  if (laserModeSelect) {
    laserModeSelect.onchange = (e) => {
      currentReading.laserMode = e.target.value;
      renderView();
    };
  }

  if (powerLevelSelect) {
    powerLevelSelect.onchange = (e) => {
      currentReading.powerMw = Number(e.target.value);
      renderView();
    };
  }

  if (faultConditionSelect) {
    faultConditionSelect.onchange = (e) => {
      currentReading.faultCondition = VFL_FAULT_CONDITIONS[e.target.value] || VFL_FAULT_CONDITIONS.CONTINUITY_OK;
      renderView();
    };
  }

  if (cabinetSelect) {
    cabinetSelect.onchange = (e) => {
      const cab = SHAHDARA_OSP_CABINETS.find(c => c.id === e.target.value) || SHAHDARA_OSP_CABINETS[0];
      currentReading.cabinetId = cab.id;
      currentReading.cabinetName = cab.name;
    };
  }

  if (recordLogBtn) {
    recordLogBtn.onclick = () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      recordVflTestLog(currentReading, storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast(`✓ Logged VFL Core #${currentReading.coreNumber} inspection record`);
      }
    };
  }

  if (copyReportBtn) {
    copyReportBtn.onclick = async () => {
      if (notesInput) currentReading.linemanNotes = notesInput.value;
      const report = generateVflFieldReport(currentReading, options);
      const clipboard = options.clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      let success = false;
      if (clipboard && typeof clipboard.writeText === 'function') {
        try {
          await clipboard.writeText(report);
          success = true;
        } catch (_) {}
      }
      if (typeof options.onToast === 'function') {
        options.onToast(success ? '✓ VFL Field Dispatch Report copied to clipboard' : 'Report generated in console');
      }
    };
  }

  if (clearLogsBtn) {
    clearLogsBtn.onclick = () => {
      clearVflTestLogsStore(storage);
      renderView();
      if (typeof options.onToast === 'function') {
        options.onToast('Cleared VFL test logs');
      }
    };
  }

  if (filterAreaBtn) {
    filterAreaBtn.onclick = () => {
      const cabinet = SHAHDARA_OSP_CABINETS.find(c => c.id === currentReading.cabinetId) || SHAHDARA_OSP_CABINETS[0];
      if (typeof options.onFilterArea === 'function') {
        options.onFilterArea(cabinet.area);
        closeModal();
      }
    };
  }

  return {
    open: openModal,
    close: closeModal,
    getCurrentReading: () => ({ ...currentReading }),
    setReading: (newReading) => {
      Object.assign(currentReading, newReading);
      renderView();
    }
  };
}
