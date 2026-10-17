/**
 * Shahdara ISP - Field Optical Fiber Microscope Video Inspection Probe (VIP) Digital Surface Analysis Assistant
 *
 * Provides FTTH optical test technicians, field linesmen, and network auditors with:
 * - IEC 61300-3-35 Edition 2.0 & Telcordia GR-326-CORE Automated Connector End-Face Analysis
 * - Concentric Inspection Zones: Core Zone A (0-25µm), Cladding Zone B (25-115µm), Epoxy Zone C (115-130µm), Ferrule Contact Zone D (130-250µm)
 * - Defect & Scratch classification according to strict SMF UPC & APC criteria
 * - Optical Insertion Loss (IL dB) and Return Loss (RL dB) penalty estimation based on core occlusion
 * - Pure-vector responsive SVG end-face visualization with concentric rings and defect overlays
 * - LocalStorage persistence (shahdara_fiber_microscope_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const FIBER_MICROSCOPE_STORAGE_KEY = 'shahdara_fiber_microscope_audits_v1';

export const INSPECTION_ZONES = {
  ZONE_A_CORE: {
    id: 'ZONE_A_CORE',
    name: 'Zone A: Core (0 - 25 µm)',
    diameterRange: '0 - 25 µm',
    maxScratchesAllowed: 0,
    maxDefectSizeAllowedMicrons: 0,
    description: 'Optical core carrying single-mode light. Zero scratches and zero defects permitted by IEC 61300-3-35.'
  },
  ZONE_B_CLADDING: {
    id: 'ZONE_B_CLADDING',
    name: 'Zone B: Cladding (25 - 115 µm)',
    diameterRange: '25 - 115 µm',
    maxScratchesAllowed: 2,
    maxDefectSizeAllowedMicrons: 5,
    description: 'Silica glass cladding. Scratches ≤ 3 µm permitted; loose particulate must be cleaned.'
  },
  ZONE_C_EPOXY: {
    id: 'ZONE_C_EPOXY',
    name: 'Zone C: Adhesive / Epoxy (115 - 130 µm)',
    diameterRange: '115 - 130 µm',
    maxScratchesAllowed: 99,
    maxDefectSizeAllowedMicrons: 10,
    description: 'Epoxy adhesive bonding optical glass into ceramic ferrule. Chips/voids > 10 µm flagged.'
  },
  ZONE_D_CONTACT: {
    id: 'ZONE_D_CONTACT',
    name: 'Zone D: Ferrule Contact (130 - 250 µm)',
    diameterRange: '130 - 250 µm',
    maxScratchesAllowed: 99,
    maxDefectSizeAllowedMicrons: 15,
    description: 'Precision zirconia ceramic contact region. Large grit > 15 µm prevents physical fiber dome mating.'
  }
};

export const MICROSCOPE_PRESETS = [
  {
    id: 'pristine-sc-apc',
    name: 'Pristine SC/APC Demarcation Pigtail (Brand New Clean)',
    connectorType: 'SC/APC (8° Angled)',
    location: 'FAT-04 Baradari Central Splitter Port 02',
    magnification: '400x',
    coreScratches: 0,
    coreDefects: 0,
    claddingScratches: 0,
    claddingDefects: 0,
    epoxyDefects: 0,
    contactDefects: 0,
    estimatedCleanlinessScore: 99,
    notes: 'Reference laboratory quality end-face. Clean pass on all IEC zones.'
  },
  {
    id: 'dust-contaminated-sc-upc',
    name: 'Airborne Road Dust Contaminated SC/UPC Patchcord',
    connectorType: 'SC/UPC (0° Ultra)',
    location: 'Begum Kot Pole #14 Outdoor FAT Box',
    magnification: '200x',
    coreScratches: 0,
    coreDefects: 2, // 2 small dust specks in core
    claddingScratches: 1,
    claddingDefects: 4,
    epoxyDefects: 2,
    contactDefects: 6,
    estimatedCleanlinessScore: 48,
    notes: 'Dust intrusion from unsealed outdoor closure. Immediate dry reel cleaning required.'
  },
  {
    id: 'scratched-technician-jumper',
    name: 'Technician Test Jumper (Core Scratch Defect)',
    connectorType: 'SC/APC (8° Angled)',
    location: 'Vandala Road Field Test Kit TRC-01',
    magnification: '400x',
    coreScratches: 2, // Longitudinal scratch across core
    coreDefects: 0,
    claddingScratches: 3,
    claddingDefects: 1,
    epoxyDefects: 0,
    contactDefects: 1,
    estimatedCleanlinessScore: 32,
    notes: 'Permanent mechanical core gouge from dirty mating sleeve. Jumper must be retired.'
  },
  {
    id: 'oil-fingerprint-smudge',
    name: 'Sebum Skin Oil Smudge from Accidental Finger Contact',
    connectorType: 'LC/UPC (1.25mm)',
    location: 'Jia Musa OLT SFP+ Optical Transceiver Port',
    magnification: '200x',
    coreScratches: 0,
    coreDefects: 3,
    claddingScratches: 0,
    claddingDefects: 8,
    epoxyDefects: 4,
    contactDefects: 12,
    estimatedCleanlinessScore: 40,
    notes: 'Liquid sebum residue spreading across ferrule dome. Requires wet-to-dry solvent pen wipe.'
  },
  {
    id: 'chipped-fiber-edge',
    name: 'Chipped Fiber Core Edge from Improper Insertion',
    connectorType: 'SC/APC (8° Angled)',
    location: 'Ravi Siphon Drop Cable Demarcation',
    magnification: '400x',
    coreScratches: 1,
    coreDefects: 1,
    claddingScratches: 2,
    claddingDefects: 3,
    epoxyDefects: 1,
    contactDefects: 2,
    estimatedCleanlinessScore: 42,
    notes: 'Glass edge fracture encroaching into core zone. Causes Fresnel reflection and high attenuation.'
  }
];

/**
 * Evaluates IEC 61300-3-35 pass/fail verdict, optical penalties, and cleanliness index.
 */
export function calculateMicroscopeMetrics({
  coreScratches = 0,
  coreDefects = 0,
  claddingScratches = 0,
  claddingDefects = 0,
  epoxyDefects = 0,
  contactDefects = 0,
  connectorType = 'SC/APC (8° Angled)'
} = {}) {
  const cScratches = Math.max(0, parseInt(coreScratches, 10) || 0);
  const cDefects = Math.max(0, parseInt(coreDefects, 10) || 0);
  const cladScratches = Math.max(0, parseInt(claddingScratches, 10) || 0);
  const cladDefects = Math.max(0, parseInt(claddingDefects, 10) || 0);
  const epDefects = Math.max(0, parseInt(epoxyDefects, 10) || 0);
  const contDefects = Math.max(0, parseInt(contactDefects, 10) || 0);

  // IEC 61300-3-35 Pass/Fail logic:
  // Zone A (Core): Strictly ZERO scratches, ZERO defects
  const isCorePassed = cScratches === 0 && cDefects === 0;

  // Zone B (Cladding): Scratches <= 2, Defects <= 2 (<= 5µm)
  const isCladdingPassed = cladScratches <= 2 && cladDefects <= 2;

  // Zone C (Epoxy): Defects <= 5
  const isEpoxyPassed = epDefects <= 5;

  // Zone D (Contact): Defects <= 8
  const isContactPassed = contDefects <= 8;

  const isOverallPassed = isCorePassed && isCladdingPassed && isEpoxyPassed && isContactPassed;

  // Cleanliness score (0 to 100)
  let score = 100;
  score -= (cScratches * 35) + (cDefects * 25);
  score -= (cladScratches * 6) + (cladDefects * 8);
  score -= (epDefects * 3) + (contDefects * 2);
  const cleanlinessScore = Math.max(0, Math.min(100, score));

  // Insertion Loss penalty (dB)
  let lossPenaltyDb = 0.05; // Baseline mated pair loss
  if (cDefects > 0) lossPenaltyDb += (cDefects * 0.45);
  if (cScratches > 0) lossPenaltyDb += (cScratches * 0.35);
  if (cladDefects > 2) lossPenaltyDb += ((cladDefects - 2) * 0.10);
  const estimatedInsertionLossDb = Math.round(lossPenaltyDb * 100) / 100;

  // Return Loss penalty (dB)
  const isApc = connectorType.includes('APC');
  let baseRl = isApc ? 65.0 : 52.0;
  if (cDefects > 0 || cScratches > 0) baseRl -= 18.0;
  if (contDefects > 4) baseRl -= 6.0;
  const estimatedReturnLossDb = Math.max(20.0, Math.round(baseRl * 10) / 10);

  let recommendation = 'Connector end-face is pristine. Safe to mate with optical transceiver.';
  if (!isCorePassed) {
    recommendation = 'CORE ZONE DEFECT: Do NOT connect! Clean with dry click-cleaner pen and re-inspect immediately.';
  } else if (!isOverallPassed) {
    recommendation = 'Cladding/Contact zone contamination present. Clean ferrule to prevent particulate migration into core.';
  }

  return {
    isOverallPassed,
    isCorePassed,
    isCladdingPassed,
    isEpoxyPassed,
    isContactPassed,
    cleanlinessScore,
    estimatedInsertionLossDb,
    estimatedReturnLossDb,
    recommendation,
    verdictLabel: isOverallPassed ? 'PASS (IEC 61300-3-35 Compliant)' : 'FAIL (Contaminated / Scratched)'
  };
}

export function evaluateConnectorSurface(params = {}) {
  const m = calculateMicroscopeMetrics(params);
  return {
    ...m,
    overallPassed: m.isOverallPassed,
    zones: {
      ZONE_A_CORE: { passed: m.isCorePassed },
      ZONE_B_CLADDING: { passed: m.isCladdingPassed },
      ZONE_C_EPOXY: { passed: m.isEpoxyPassed },
      ZONE_D_CONTACT: { passed: m.isContactPassed }
    }
  };
}

export const renderMicroscopeSvg = renderFiberMicroscopeSvg;
export const loadMicroscopeAuditRecords = loadFiberMicroscopeAuditLog;
export const saveMicroscopeAuditRecord = saveFiberMicroscopeAuditLog;
export const clearMicroscopeAuditRecords = (storage = (typeof localStorage !== 'undefined' ? localStorage : null)) => {
  if (storage) storage.removeItem(FIBER_MICROSCOPE_STORAGE_KEY);
};
export const exportMicroscopeCsv = generateFiberMicroscopeCsv;
export const formatMicroscopeWhatsAppText = formatFiberMicroscopeWhatsAppText;

/**
 * Pure client-side SVG renderer for the Fiber Microscope End-Face and Concentric Inspection Zones.
 */
export function renderFiberMicroscopeSvg(metrics, {
  connectorType = 'SC/APC (8° Angled)',
  magnification = '400x',
  coreScratches = 0,
  coreDefects = 0,
  claddingDefects = 0,
  isDark = false
} = {}) {
  const m = metrics || calculateMicroscopeMetrics();
  const bgFill = isDark ? '#0f172a' : '#f8fafc';
  const ferruleFill = isDark ? '#1e293b' : '#f1f5f9';
  const epoxyFill = isDark ? '#334155' : '#e2e8f0';
  const glassFill = isDark ? '#1e1b4b' : '#e0e7ff';
  const coreFill = isDark ? '#3b82f6' : '#60a5fa';
  const textMain = isDark ? '#f8fafc' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';
  const borderCol = isDark ? '#475569' : '#cbd5e1';

  const statusColor = m.isOverallPassed ? '#10b981' : '#ef4444';

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 400" class="microscope-svg" style="width: 100%; height: auto; font-family: system-ui, -apple-system, sans-serif;">
    <defs>
      <radialGradient id="glassReflectionGrad" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3" />
        <stop offset="70%" stop-color="${glassFill}" />
        <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.8" />
      </radialGradient>
      <filter id="microscopeGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.35" />
      </filter>
    </defs>

    <!-- Canvas Background -->
    <rect width="540" height="400" rx="10" fill="${bgFill}" stroke="${borderCol}" stroke-width="1.2" />

    <!-- Top Telemetry Ribbon -->
    <g transform="translate(16, 14)">
      <rect width="508" height="38" rx="6" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="${borderCol}" stroke-width="1" />
      <circle cx="16" cy="19" r="6" fill="${statusColor}" />
      <text x="32" y="23" font-size="12" font-weight="700" fill="${textMain}">
        ${escapeHtml(connectorType)} · Zoom: ${escapeHtml(magnification)}
      </text>
      <text x="360" y="23" font-size="11.5" font-weight="700" fill="${statusColor}">
        ${m.isOverallPassed ? '✓ PASS (IEC 61300-3-35)' : '✗ FAIL (DEBRIS/SCRATCH)'}
      </text>
    </g>

    <!-- Center Concentric Inspection Target -->
    <g transform="translate(200, 215)">
      <!-- Zone D: Ceramic Ferrule Contact (Outer Ring) -->
      <circle r="150" fill="${ferruleFill}" stroke="${borderCol}" stroke-width="1.5" filter="url(#microscopeGlow)" />
      
      <!-- Zone C: Epoxy Adhesive Ring -->
      <circle r="105" fill="${epoxyFill}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,2" />

      <!-- Zone B: Silica Glass Cladding -->
      <circle r="85" fill="url(#glassReflectionGrad)" stroke="#38bdf8" stroke-width="1.8" />

      <!-- Zone A: Core Boundary -->
      <circle r="22" fill="${coreFill}" stroke="${m.isCorePassed ? '#10b981' : '#ef4444'}" stroke-width="2.5" />
      <circle r="22" fill="none" stroke="${m.isCorePassed ? '#10b981' : '#ef4444'}" stroke-width="1" stroke-dasharray="2,2" opacity="0.8" />

      <!-- Reticle Crosshairs -->
      <line x1="-155" y1="0" x2="155" y2="0" stroke="${textMuted}" stroke-width="0.8" opacity="0.4" stroke-dasharray="4,4" />
      <line x1="0" y1="-155" x2="0" y2="155" stroke="${textMuted}" stroke-width="0.8" opacity="0.4" stroke-dasharray="4,4" />

      <!-- Simulated Defects -->
      ${coreDefects > 0 ? `
        <!-- Core Particle Debris -->
        <circle cx="-5" cy="-6" r="3.5" fill="#ef4444" stroke="#ffffff" stroke-width="0.8" />
        <circle cx="7" cy="4" r="2.8" fill="#f59e0b" stroke="#ffffff" stroke-width="0.8" />
        <text x="-6" y="-12" font-size="8" font-weight="700" fill="#ef4444" text-anchor="middle">Grit</text>
      ` : ''}

      ${coreScratches > 0 ? `
        <!-- Core Scratch line -->
        <line x1="-16" y1="-12" x2="14" y2="10" stroke="#f87171" stroke-width="2" stroke-linecap="round" />
        <text x="18" y="16" font-size="8" font-weight="700" fill="#ef4444">Scratch</text>
      ` : ''}

      ${claddingDefects > 0 ? `
        <!-- Cladding dust particles -->
        <circle cx="45" cy="-35" r="4" fill="#64748b" opacity="0.85" />
        <circle cx="-50" cy="40" r="3" fill="#64748b" opacity="0.85" />
        <circle cx="-35" cy="-55" r="5" fill="#64748b" opacity="0.85" />
      ` : ''}

      <!-- Center Focal Point Marker -->
      <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
    </g>

    <!-- Zone Legend / Telemetry HUD on the Right -->
    <g transform="translate(375, 75)">
      <rect width="145" height="295" rx="6" fill="${isDark ? '#1e293b' : '#ffffff'}" stroke="${borderCol}" stroke-width="1" />
      
      <text x="12" y="22" font-size="11" font-weight="700" fill="${textMuted}">INSPECTION ZONES</text>

      <!-- Zone A Core -->
      <g transform="translate(12, 38)">
        <circle cx="6" cy="6" r="5" fill="${m.isCorePassed ? '#10b981' : '#ef4444'}" />
        <text x="18" y="9" font-size="10.5" font-weight="700" fill="${textMain}">Zone A (Core)</text>
        <text x="18" y="21" font-size="9" fill="${textMuted}">0 - 25 µm: ${m.isCorePassed ? 'PASS' : 'FAIL'}</text>
      </g>

      <!-- Zone B Cladding -->
      <g transform="translate(12, 75)">
        <circle cx="6" cy="6" r="5" fill="${m.isCladdingPassed ? '#10b981' : '#f59e0b'}" />
        <text x="18" y="9" font-size="10.5" font-weight="700" fill="${textMain}">Zone B (Clad)</text>
        <text x="18" y="21" font-size="9" fill="${textMuted}">25 - 115 µm: ${m.isCladdingPassed ? 'PASS' : 'FAIL'}</text>
      </g>

      <!-- Zone C Epoxy -->
      <g transform="translate(12, 112)">
        <circle cx="6" cy="6" r="5" fill="${m.isEpoxyPassed ? '#10b981' : '#f59e0b'}" />
        <text x="18" y="9" font-size="10.5" font-weight="700" fill="${textMain}">Zone C (Epoxy)</text>
        <text x="18" y="21" font-size="9" fill="${textMuted}">115 - 130 µm: ${m.isEpoxyPassed ? 'PASS' : 'WARN'}</text>
      </g>

      <!-- Zone D Contact -->
      <g transform="translate(12, 149)">
        <circle cx="6" cy="6" r="5" fill="${m.isContactPassed ? '#10b981' : '#f59e0b'}" />
        <text x="18" y="9" font-size="10.5" font-weight="700" fill="${textMain}">Zone D (Ferrule)</text>
        <text x="18" y="21" font-size="9" fill="${textMuted}">130 - 250 µm: ${m.isContactPassed ? 'PASS' : 'WARN'}</text>
      </g>

      <line x1="10" y1="188" x2="135" y2="188" stroke="${borderCol}" stroke-width="0.8" />

      <!-- Optical Loss Estimates -->
      <text x="12" y="206" font-size="10" font-weight="700" fill="${textMuted}">ESTIMATED PENALTY</text>
      <text x="12" y="224" font-size="10" fill="${textMain}">Loss: <tspan font-weight="700" fill="${m.estimatedInsertionLossDb <= 0.25 ? '#10b981' : '#ef4444'}">${m.estimatedInsertionLossDb} dB</tspan></text>
      <text x="12" y="240" font-size="10" fill="${textMain}">RL: <tspan font-weight="700" fill="${m.estimatedReturnLossDb >= 55 ? '#10b981' : '#f59e0b'}">-${m.estimatedReturnLossDb} dB</tspan></text>
      <text x="12" y="260" font-size="10" fill="${textMain}">Index: <tspan font-weight="800" fill="${statusColor}">${m.cleanlinessScore}%</tspan></text>
    </g>
  </svg>
  `;
}

/**
 * Loads saved microscope audit logs from localStorage.
 */
export function loadFiberMicroscopeAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(FIBER_MICROSCOPE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to load fiber microscope audit log:', err);
    return [];
  }
}

/**
 * Saves a new inspection entry into localStorage audit trail.
 */
export function saveFiberMicroscopeAuditLog(entry, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !entry) return [];
  try {
    const existing = loadFiberMicroscopeAuditLog(storage);
    const updated = [entry, ...existing].slice(0, 50); // Keep last 50 audits
    storage.setItem(FIBER_MICROSCOPE_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('Failed to save fiber microscope audit log:', err);
    return [];
  }
}

/**
 * Formats a bilingual English/Urdu technician WhatsApp report.
 */
export function formatFiberMicroscopeWhatsAppText(entry) {
  return `*🔬 SHAHDARA ISP - FIBER MICROSCOPE INSPECTION (IEC 61300-3-35)*
------------------------------------------------
• Location: ${entry.location || 'Shahdara Metro Network'}
• Connector: ${entry.connectorType || 'SC/APC'}
• Magnification: ${entry.magnification || '400x'}
• Cleanliness Score: ${entry.cleanlinessScore}% (${entry.verdictLabel})
• Core Zone A: ${entry.isCorePassed ? 'PASS (Clean)' : 'FAIL (Contaminated / Scratched)'}
• Cladding Zone B: ${entry.isCladdingPassed ? 'PASS' : 'FAIL'}
• Est Insertion Loss: ${entry.estimatedInsertionLossDb} dB
• Est Return Loss: -${entry.estimatedReturnLossDb} dB

*اردو نوٹ (Technician Notice):*
${entry.isOverallPassed 
  ? 'کنیکٹر کا اینڈ فیس مکمل صاف ہے اور سگنل کنکشن کے لیے تیار ہے۔' 
  : 'کنیکٹر کے اینڈ فیس پر گرد یا سکریچ موجود ہے۔ فوری طور پر کلینر قلم سے صاف کریں۔'}

Timestamp: ${entry.timestamp || new Date().toISOString()}`;
}

/**
 * Generates an RFC-4180 CSV export of microscope audit logs.
 */
export function generateFiberMicroscopeCsv(logs = []) {
  const headers = ['Timestamp', 'Location', 'Connector Type', 'Magnification', 'Cleanliness Score', 'Verdict', 'Core Passed', 'Clad Passed', 'Est Loss dB', 'Est RL dB', 'Notes'];
  const rows = logs.map(l => [
    l.timestamp || '',
    `"${(l.location || '').replace(/"/g, '""')}"`,
    `"${(l.connectorType || '').replace(/"/g, '""')}"`,
    l.magnification || '',
    l.cleanlinessScore || '',
    `"${(l.verdictLabel || '').replace(/"/g, '""')}"`,
    l.isCorePassed ? 'TRUE' : 'FALSE',
    l.isCladdingPassed ? 'TRUE' : 'FALSE',
    l.estimatedInsertionLossDb || '',
    l.estimatedReturnLossDb || '',
    `"${(l.notes || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
}

/**
 * Helper to escape HTML characters.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}

/**
 * Wires up interactive controls for the Mobile Fiber Microscope Modal.
 */
export function setupMobileFiberMicroscopeModal(state = {}, options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const modal = document.getElementById('mobileFiberMicroscopeModal');
  if (!modal) return { open: () => {}, close: () => {} };

  const openBtn = document.getElementById('mobileMoreFiberMicroscopeBtn');
  const closeBtn = document.getElementById('mobileFiberMicroscopeCloseBtn');

  const presetSelect = document.getElementById('microscopePresetSelect');
  const magSelect = document.getElementById('microscopeMagSelect');
  const coreScratchesInput = document.getElementById('microscopeCoreScratches');
  const coreDefectsInput = document.getElementById('microscopeCoreDefects');
  const cladDefectsInput = document.getElementById('microscopeCladDefects');

  const scoreBadge = document.getElementById('microscopeScoreBadge');
  const verdictText = document.getElementById('microscopeVerdictText');
  const lossText = document.getElementById('microscopeLossText');
  const rlText = document.getElementById('microscopeRlText');

  const svgContainer = document.getElementById('microscopeSvgContainer');
  const saveBtn = document.getElementById('microscopeSaveBtn');
  const shareBtn = document.getElementById('microscopeShareBtn');
  const exportBtn = document.getElementById('microscopeExportBtn');

  function getFormValues() {
    return {
      connectorType: presetSelect ? presetSelect.options[presetSelect.selectedIndex]?.dataset?.conn || 'SC/APC (8° Angled)' : 'SC/APC (8° Angled)',
      location: presetSelect ? presetSelect.options[presetSelect.selectedIndex]?.dataset?.loc || 'Shahdara Network' : 'Shahdara Network',
      magnification: magSelect ? magSelect.value : '400x',
      coreScratches: parseInt(coreScratchesInput?.value, 10) || 0,
      coreDefects: parseInt(coreDefectsInput?.value, 10) || 0,
      claddingDefects: parseInt(cladDefectsInput?.value, 10) || 0
    };
  }

  function updateUi() {
    const vals = getFormValues();
    const metrics = calculateMicroscopeMetrics({
      coreScratches: vals.coreScratches,
      coreDefects: vals.coreDefects,
      claddingDefects: vals.claddingDefects,
      connectorType: vals.connectorType
    });

    const isDark = (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark');

    if (svgContainer) {
      svgContainer.innerHTML = renderFiberMicroscopeSvg(metrics, {
        connectorType: vals.connectorType,
        magnification: vals.magnification,
        coreScratches: vals.coreScratches,
        coreDefects: vals.coreDefects,
        claddingDefects: vals.claddingDefects,
        isDark
      });
    }

    if (scoreBadge) {
      scoreBadge.textContent = `${metrics.cleanlinessScore}% Clean`;
      scoreBadge.className = `status-badge ${metrics.isOverallPassed ? 'badge-nominal' : 'badge-critical'}`;
    }
    if (verdictText) {
      verdictText.textContent = metrics.verdictLabel;
      verdictText.style.color = metrics.isOverallPassed ? 'var(--green, #10b981)' : 'var(--danger, #ef4444)';
    }
    if (lossText) {
      lossText.textContent = `${metrics.estimatedInsertionLossDb} dB`;
    }
    if (rlText) {
      rlText.textContent = `-${metrics.estimatedReturnLossDb} dB`;
    }
  }

  function open() {
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
    updateUi();
  }

  function close() {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  if (openBtn && !openBtn.dataset.wired) {
    openBtn.dataset.wired = 'true';
    openBtn.addEventListener('click', open);
  }

  if (closeBtn && !closeBtn.dataset.wired) {
    closeBtn.dataset.wired = 'true';
    closeBtn.addEventListener('click', close);
  }

  if (presetSelect && !presetSelect.dataset.wired) {
    presetSelect.dataset.wired = 'true';
    presetSelect.addEventListener('change', (e) => {
      const selected = MICROSCOPE_PRESETS.find(p => p.id === e.target.value);
      if (selected) {
        if (coreScratchesInput) coreScratchesInput.value = selected.coreScratches;
        if (coreDefectsInput) coreDefectsInput.value = selected.coreDefects;
        if (cladDefectsInput) cladDefectsInput.value = selected.claddingDefects;
        if (magSelect) magSelect.value = selected.magnification;
      }
      updateUi();
    });
  }

  [coreScratchesInput, coreDefectsInput, cladDefectsInput, magSelect].forEach(input => {
    if (input && !input.dataset.wired) {
      input.dataset.wired = 'true';
      input.addEventListener('input', updateUi);
      input.addEventListener('change', updateUi);
    }
  });

  if (saveBtn && !saveBtn.dataset.wired) {
    saveBtn.dataset.wired = 'true';
    saveBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const metrics = calculateMicroscopeMetrics(vals);
      const entry = {
        ...vals,
        ...metrics,
        timestamp: new Date().toISOString()
      };
      saveFiberMicroscopeAuditLog(entry, storage);
      if (options.onToast) options.onToast('Microscope Inspection audit saved to local log!');
    });
  }

  if (shareBtn && !shareBtn.dataset.wired) {
    shareBtn.dataset.wired = 'true';
    shareBtn.addEventListener('click', async () => {
      const vals = getFormValues();
      const metrics = calculateMicroscopeMetrics(vals);
      const text = formatFiberMicroscopeWhatsAppText({
        ...vals,
        ...metrics,
        timestamp: new Date().toISOString()
      });
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          if (options.onToast) options.onToast('WhatsApp technician notice copied to clipboard!');
        } else {
          window.prompt('Copy WhatsApp Report:', text);
        }
      } catch {
        window.prompt('Copy WhatsApp Report:', text);
      }
    });
  }

  if (exportBtn && !exportBtn.dataset.wired) {
    exportBtn.dataset.wired = 'true';
    exportBtn.addEventListener('click', () => {
      const logs = loadFiberMicroscopeAuditLog(storage);
      const current = {
        ...getFormValues(),
        ...calculateMicroscopeMetrics(getFormValues()),
        timestamp: new Date().toISOString()
      };
      const allLogs = logs.length > 0 ? logs : [current];
      const csv = generateFiberMicroscopeCsv(allLogs);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shahdara-microscope-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  // Initial render
  updateUi();

  return { open, close, updateUi };
}
