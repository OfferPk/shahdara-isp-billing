/**
 * Shahdara ISP - Field Optical Fiber Drop Cable Tensile Pull & Clamping Retention Assistant
 *
 * Provides FTTH aerial linesmen, field installers, and supervisors with:
 * - IEC 60794-1-2 Method E1 (tensile performance under load) & Telcordia GR-326-CORE retention modeling
 * - Wedge drop clamp (S-clamp / P-clamp), spiral dead-end grip, and friction shoe clamp metrology
 * - Aerial span catenary tension, wind gust load, and fiber core elastic strain calculation
 * - Safety factor evaluation against cable breaking strength and clamp slip thresholds
 * - Pure-vector SVG schematic with pole anchor, wedge teeth grip, catenary curve, and tension gauge
 * - LocalStorage persistence (shahdara_drop_retention_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const DROP_RETENTION_STORAGE_KEY = 'shahdara_drop_retention_audits_v1';

export const RETENTION_CLAMP_TYPES = {
  WEDGE_DROP_CLAMP: {
    id: 'WEDGE_DROP_CLAMP',
    name: 'Wedge-Type Drop Wire Clamp (S-Clamp / P-Clamp)',
    ratedHoldingForceN: 250,
    slipLimitN: 320,
    crushRiskLevel: 'Moderate'
  },
  SPIRAL_DEAD_END: {
    id: 'SPIRAL_DEAD_END',
    name: 'Helical Preformed Dead-End Wire Grip (300mm)',
    ratedHoldingForceN: 500,
    slipLimitN: 650,
    crushRiskLevel: 'Low'
  },
  FRICTION_SHOE_CLAMP: {
    id: 'FRICTION_SHOE_CLAMP',
    name: 'Bifurcated Friction Shoe Pole Clamp',
    ratedHoldingForceN: 350,
    slipLimitN: 420,
    crushRiskLevel: 'Low'
  },
  INDOOR_TIE_BRACKET: {
    id: 'INDOOR_TIE_BRACKET',
    name: 'Indoor 900µm Pigtail Strain Relief Boot Clamp',
    ratedHoldingForceN: 60,
    slipLimitN: 80,
    crushRiskLevel: 'High'
  }
};

export const RETENTION_CABLE_TYPES = {
  FLAT_DROP_2X5: {
    id: 'FLAT_DROP_2X5',
    name: 'Flat Dielectric Drop Cable (2x5 mm Dual FRP)',
    weightKgPerKm: 22.0,
    outerWidthMm: 5.0,
    breakingStrengthN: 600,
    maxRatedTensionN: 200,
    youngsModulusGpa: 45
  },
  FIGURE_8_STEEL: {
    id: 'FIGURE_8_STEEL',
    name: 'Figure-8 Aerial Drop with 1.2mm Steel Messenger',
    weightKgPerKm: 38.0,
    outerWidthMm: 6.5,
    breakingStrengthN: 1200,
    maxRatedTensionN: 450,
    youngsModulusGpa: 190
  },
  ROUND_DROP_3MM: {
    id: 'ROUND_DROP_3MM',
    name: 'Round Armored Micro-Drop (3.0 mm Aramid Yarn)',
    weightKgPerKm: 14.0,
    outerWidthMm: 3.0,
    breakingStrengthN: 400,
    maxRatedTensionN: 150,
    youngsModulusGpa: 35
  },
  TIGHT_BUFFER_PIGTAIL: {
    id: 'TIGHT_BUFFER_PIGTAIL',
    name: 'Indoor 900 µm Tight-Buffered Pigtail',
    weightKgPerKm: 3.5,
    outerWidthMm: 0.9,
    breakingStrengthN: 100,
    maxRatedTensionN: 50,
    youngsModulusGpa: 15
  }
};

export const RETENTION_PRESETS = [
  {
    id: 'shahdara-town-pole-flat-drop',
    name: 'Shahdara Town 45m Aerial Pole Span Flat Drop (Wedge S-Clamp, Standard Wind)',
    area: 'Shahdara Town',
    cableType: 'FLAT_DROP_2X5',
    clampType: 'WEDGE_DROP_CLAMP',
    spanLengthM: 45.0,
    midspanSagM: 0.65,
    windSpeedKmh: 40.0,
    technician: 'Rashid Mahmood (Aerial Lead)',
    notes: 'Pole-to-pole drop span across main street in Shahdara Town.'
  },
  {
    id: 'ravi-road-monsoon-wind-gust',
    name: 'Ravi Road 65m Riverbank Span Monsoon Wind Gust (Figure-8 Steel Messenger)',
    area: 'Ravi Road',
    cableType: 'FIGURE_8_STEEL',
    clampType: 'SPIRAL_DEAD_END',
    spanLengthM: 65.0,
    midspanSagM: 0.90,
    windSpeedKmh: 75.0,
    technician: 'Arshad Ali (Field Lead)',
    notes: 'Heavy monsoon storm winds along open Ravi River bridge corridor.'
  },
  {
    id: 'begum-kot-overspan-excessive-tension',
    name: 'Begum Kot 90m Over-Span Tension Hazard (Flat Drop Exceeding 200N Limit)',
    area: 'Begum Kot',
    cableType: 'FLAT_DROP_2X5',
    clampType: 'WEDGE_DROP_CLAMP',
    spanLengthM: 90.0,
    midspanSagM: 0.50, // Low sag causes massive catenary tension!
    windSpeedKmh: 50.0,
    technician: 'Sajjad Malik',
    notes: 'Excessive tension due to insufficient sag. Tension exceeds cable safe working load.'
  },
  {
    id: 'saeed-park-pigtail-indoor-pull',
    name: 'Saeed Park Indoor FDB Pigtail Strain Relief (900µm Boot Clamp)',
    area: 'Saeed Park',
    cableType: 'TIGHT_BUFFER_PIGTAIL',
    clampType: 'INDOOR_TIE_BRACKET',
    spanLengthM: 3.0,
    midspanSagM: 0.05,
    windSpeedKmh: 0.0,
    technician: 'Imran Ashraf',
    notes: 'Indoor distribution frame strain relief buffer tube clamp.'
  }
];

/**
 * Calculates catenary tension, wind forces, core strain, and retention safety factor.
 */
export function calculateDropRetentionMetrics({
  cableType = 'FLAT_DROP_2X5',
  clampType = 'WEDGE_DROP_CLAMP',
  spanLengthM = 45.0,
  midspanSagM = 0.65,
  windSpeedKmh = 40.0
} = {}) {
  const cable = RETENTION_CABLE_TYPES[cableType] || RETENTION_CABLE_TYPES.FLAT_DROP_2X5;
  const clamp = RETENTION_CLAMP_TYPES[clampType] || RETENTION_CLAMP_TYPES.WEDGE_DROP_CLAMP;

  const span = Math.max(1.0, Number(spanLengthM) || 45.0);
  const sag = Math.max(0.05, Number(midspanSagM) || 0.65);
  const windKmh = Math.max(0.0, Number(windSpeedKmh) || 0.0);
  const windMs = windKmh / 3.6;

  // Linear weight in N/m (gravity g = 9.806 m/s^2)
  const weightNPerM = (cable.weightKgPerKm / 1000) * 9.80665;

  // Horizontal catenary tension: T_grav = (w * L^2) / (8 * S)
  const catenaryTensionN = (weightNPerM * Math.pow(span, 2)) / (8 * sag);

  // Wind load force: F_wind = 0.5 * rho * v^2 * Cd * Area
  const airDensity = 1.225; // kg/m^3
  const dragCoeff = 1.2;
  const projectedAreaM2 = (cable.outerWidthMm / 1000) * span;
  const windForceN = 0.5 * airDensity * Math.pow(windMs, 2) * dragCoeff * projectedAreaM2;

  // Total resultant installation tension: T_total = sqrt(T_grav^2 + F_wind^2)
  const totalTensionN = Math.round(Math.sqrt(Math.pow(catenaryTensionN, 2) + Math.pow(windForceN, 2)) * 10) / 10;

  // Fiber elastic strain %: epsilon = Tension / (E * Area) * 100%
  // Typical drop cable cross-sectional area equivalent
  const equivAreaMm2 = Math.PI * Math.pow(cable.outerWidthMm / 2, 2) * 0.4;
  const strainPercent = Math.round(((totalTensionN / (cable.youngsModulusGpa * 1000 * equivAreaMm2)) * 100) * 1000) / 1000;

  // Safety factors
  const cableSafetyFactor = Math.round((cable.breakingStrengthN / Math.max(1, totalTensionN)) * 100) / 100;
  const clampHoldingFactor = Math.round((clamp.ratedHoldingForceN / Math.max(1, totalTensionN)) * 100) / 100;
  const clampSlipFactor = Math.round((clamp.slipLimitN / Math.max(1, totalTensionN)) * 100) / 100;

  // Verdict evaluation
  let status = 'PASS';
  let statusClass = 'status-pass';
  let statusLabel = 'Optimal Clamp Retention & Tension Safety';

  if (totalTensionN > cable.maxRatedTensionN || clampHoldingFactor < 1.0 || strainPercent > 0.45) {
    status = 'FAIL';
    statusClass = 'status-fail';
    statusLabel = 'CRITICAL HAZARD: Over-Tension / Clamp Slip Risk';
  } else if (totalTensionN > cable.maxRatedTensionN * 0.85 || clampHoldingFactor < 1.3 || strainPercent > 0.30) {
    status = 'WARNING';
    statusClass = 'status-warning';
    statusLabel = 'WARNING: Elevated Tension / Low Safety Margin';
  }

  return {
    cableType,
    cableName: cable.name,
    clampType,
    clampName: clamp.name,
    spanLengthM: span,
    midspanSagM: sag,
    windSpeedKmh: windKmh,
    catenaryTensionN: Math.round(catenaryTensionN * 10) / 10,
    windForceN: Math.round(windForceN * 10) / 10,
    totalTensionN,
    strainPercent,
    maxRatedTensionN: cable.maxRatedTensionN,
    breakingStrengthN: cable.breakingStrengthN,
    clampRatedHoldingN: clamp.ratedHoldingForceN,
    clampSlipLimitN: clamp.slipLimitN,
    cableSafetyFactor,
    clampHoldingFactor,
    clampSlipFactor,
    status,
    statusClass,
    statusLabel
  };
}

/**
 * Generates pure-vector SVG schematic of pole anchor, wedge clamp, and cable catenary.
 */
export function renderDropRetentionSvg(metrics, { width = 720, height = 280 } = {}) {
  if (!metrics) {
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="No Retention Data">
      <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>
      <text x="${width / 2}" y="${height / 2}" fill="#94a3b8" text-anchor="middle" font-size="14" font-family="sans-serif">No Clamping Retention Data</text>
    </svg>`;
  }

  const isCritical = metrics.status === 'FAIL';
  const isWarning = metrics.status === 'WARNING';
  const statusColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Drop Cable Tensile Clamping Schematic">
    <defs>
      <linearGradient id="poleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#334155"/>
        <stop offset="50%" stop-color="#475569"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <linearGradient id="clampGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#94a3b8"/>
        <stop offset="50%" stop-color="#64748b"/>
        <stop offset="100%" stop-color="#475569"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>

    <!-- Header title & metrics -->
    <text x="25" y="24" fill="#38bdf8" font-size="13" font-weight="700" font-family="sans-serif">${metrics.cableName}</text>
    <text x="${width - 25}" y="24" fill="${statusColor}" font-size="12" font-weight="700" text-anchor="end" font-family="sans-serif">Tension: ${metrics.totalTensionN} N · SF: ${metrics.clampHoldingFactor}x [${metrics.status}]</text>

    <!-- Utility Pole (Left) -->
    <rect x="25" y="50" width="35" height="200" fill="url(#poleGrad)" rx="3"/>
    <text x="42" y="155" fill="#cbd5e1" font-size="10" font-weight="700" text-anchor="middle" transform="rotate(-90, 42, 155)" font-family="sans-serif">UTILITY POLE</text>

    <!-- Steel Pole Anchor Bracket & Bail Wire -->
    <path d="M 60 120 L 95 120 L 115 135" fill="none" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
    <circle cx="115" cy="135" r="4" fill="#38bdf8"/>

    <!-- Wedge Drop Clamp Body (S-Clamp / Dead-End) -->
    <g class="clamp-body" transform="translate(115, 115)">
      <polygon points="0,20 60,10 60,30 0,25" fill="url(#clampGrad)" stroke="#cbd5e1" stroke-width="1.5"/>
      <!-- Serrated Wedge Teeth Gripping Jacket -->
      <line x1="15" y1="18" x2="15" y2="24" stroke="#f59e0b" stroke-width="2"/>
      <line x1="25" y1="17" x2="25" y2="23" stroke="#f59e0b" stroke-width="2"/>
      <line x1="35" y1="16" x2="35" y2="22" stroke="#f59e0b" stroke-width="2"/>
      <line x1="45" y1="15" x2="45" y2="21" stroke="#f59e0b" stroke-width="2"/>
      <text x="30" y="45" fill="#f8fafc" font-size="9" font-weight="700" text-anchor="middle" font-family="sans-serif">${metrics.clampName}</text>
    </g>

    <!-- Drop Cable Catenary Arc extending across span to right pole -->
    <g class="catenary-span">
      <!-- Target right pole -->
      <rect x="${width - 55}" y="50" width="30" height="200" fill="url(#poleGrad)" rx="3"/>
      <text x="${width - 40}" y="155" fill="#cbd5e1" font-size="10" font-weight="700" text-anchor="middle" transform="rotate(90, ${width - 40}, 155)" font-family="sans-serif">FAR POLE</text>

      <!-- Cable curve -->
      <path d="M 175 135 Q ${width / 2} ${135 + metrics.midspanSagM * 50}, ${width - 55} 135" fill="none" stroke="#38bdf8" stroke-width="3.5" stroke-linecap="round"/>

      <!-- Sag indicator bracket -->
      <line x1="${width / 2}" y1="135" x2="${width / 2}" y2="${135 + metrics.midspanSagM * 50}" stroke="#f59e0b" stroke-dasharray="2,2" stroke-width="1.5"/>
      <text x="${width / 2 + 8}" y="${135 + (metrics.midspanSagM * 50) / 2}" fill="#f59e0b" font-size="9" font-weight="700" font-family="monospace">Sag: ${metrics.midspanSagM} m</text>
      <text x="${width / 2}" y="115" fill="#94a3b8" font-size="10" font-weight="600" text-anchor="middle" font-family="sans-serif">Span: ${metrics.spanLengthM} m · Wind: ${metrics.windSpeedKmh} km/h</text>
    </g>

    <!-- Tension & Strain Telemetry Gauge Box -->
    <g class="retention-callout" transform="translate(140, 185)">
      <rect x="0" y="0" width="${width - 240}" height="75" fill="#1e293b" rx="6" stroke="${metrics.totalTensionN > metrics.maxRatedTensionN ? '#ef4444' : '#475569'}" stroke-width="1.5"/>
      <text x="15" y="20" fill="#38bdf8" font-size="10" font-weight="700" font-family="sans-serif">Tension Vectors: Gravity ${metrics.catenaryTensionN} N | Wind Force: ${metrics.windForceN} N</text>
      <text x="15" y="38" fill="#f8fafc" font-size="10" font-family="monospace">Total Tension: ${metrics.totalTensionN} N (Cable Safe Limit: ${metrics.maxRatedTensionN} N)</text>
      <text x="15" y="56" fill="${metrics.strainPercent > 0.33 ? '#f59e0b' : '#4ade80'}" font-size="10" font-weight="700" font-family="monospace">
        Fiber Elastic Strain: ${metrics.strainPercent}% (Threshold: &lt;= 0.33%) · Clamp Slip SF: ${metrics.clampSlipFactor}x
      </text>
    </g>
  </svg>`;
}

/**
 * Formats bilingual WhatsApp field dispatch message (English / Urdu).
 */
export function formatDropRetentionWhatsApp(record) {
  const m = record.metrics || {};
  const statusEmoji = m.status === 'PASS' ? '✅' : m.status === 'WARNING' ? '⚠️' : '🚨';

  return `🪢 *SHAHDARA ISP - DROP CABLE RETENTION & TENSION REPORT* 🪢
${statusEmoji} *Status / کیفیت:* ${m.statusLabel || m.status}
📍 *Area / مقام:* ${record.area || 'Shahdara Aerial Drop'}
📦 *Drop Cable / کیبل:* ${m.cableName || record.cableType}
🔧 *Clamp Grip / کلیمپ:* ${m.clampName || record.clampType}
📏 *Span Length / فاصلہ:* ${m.spanLengthM || 0} m (Sag: ${m.midspanSagM || 0} m)
💨 *Wind Speed / آندھی:* ${m.windSpeedKmh || 0} km/h
⚡ *Total Dynamic Tension:* ${m.totalTensionN || 0} N (Max Safe: ${m.maxRatedTensionN || 0} N)
🧬 *Fiber Core Strain:* ${m.strainPercent || 0}% (${m.strainPercent <= 0.33 ? 'Safe <= 0.33%' : 'High Stress Hazard'})
🛡️ *Clamp Retention Safety Factor:* ${m.clampHoldingFactor || 0}x (Slip Margin: ${m.clampSlipFactor || 0}x)
👤 *Lineman / لائن مین:* ${record.technician || 'Shahdara Aerial Linesman'}
📝 *Notes / تفصیالت:* ${record.notes || 'Routine aerial span tension inspection.'}
⏰ *Timestamp:* ${record.timestamp || new Date().toISOString()}`;
}

/**
 * Generates RFC-4180 CSV export with UTF-8 BOM.
 */
export function generateDropRetentionCsv(records = []) {
  const headers = [
    'Audit ID',
    'Timestamp',
    'Area',
    'Cable Type',
    'Clamp Type',
    'Technician',
    'Span (m)',
    'Sag (m)',
    'Wind (km/h)',
    'Total Tension (N)',
    'Max Rated (N)',
    'Core Strain (%)',
    'Clamp SF',
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
      m.clampName || r.clampType || '',
      r.technician || '',
      m.spanLengthM || '',
      m.midspanSagM || '',
      m.windSpeedKmh || '',
      m.totalTensionN || '',
      m.maxRatedTensionN || '',
      m.strainPercent || '',
      m.clampHoldingFactor || '',
      m.status || '',
      r.notes || ''
    ].map(escapeField).join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export function loadDropRetentionAuditLog(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(DROP_RETENTION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveDropRetentionAuditLog(records, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    storage.setItem(DROP_RETENTION_STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export function clearDropRetentionAuditLog(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return;
  try {
    storage.removeItem(DROP_RETENTION_STORAGE_KEY);
  } catch {}
}

/**
 * Controller to wire and manage Mobile Drop Retention Assistant Modal dialog.
 */
export function setupMobileDropRetentionModal(state, { storage = typeof localStorage !== 'undefined' ? localStorage : null, onToast = () => {} } = {}) {
  if (typeof document === 'undefined') return { open: () => {}, close: () => {} };

  const modal = document.getElementById('mobileDropRetentionModal');
  const openBtn = document.getElementById('mobileMoreDropRetentionBtn');
  const closeBtn = document.getElementById('mobileDropRetentionCloseBtn');
  const presetSelect = document.getElementById('dropRetentionPresetSelect');
  const cableSelect = document.getElementById('dropRetentionCableSelect');
  const clampSelect = document.getElementById('dropRetentionClampSelect');
  const spanInput = document.getElementById('dropRetentionSpanInput');
  const sagInput = document.getElementById('dropRetentionSagInput');
  const windInput = document.getElementById('dropRetentionWindInput');
  const areaSelect = document.getElementById('dropRetentionAreaSelect');
  const technicianInput = document.getElementById('dropRetentionTechnicianInput');
  const notesInput = document.getElementById('dropRetentionNotesInput');
  const svgContainer = document.getElementById('dropRetentionSvgContainer');
  const saveBtn = document.getElementById('dropRetentionSaveAuditBtn');
  const shareBtn = document.getElementById('dropRetentionShareWhatsAppBtn');
  const exportCsvBtn = document.getElementById('dropRetentionExportCsvBtn');
  const clearHistoryBtn = document.getElementById('dropRetentionClearHistoryBtn');
  const historyTbody = document.getElementById('dropRetentionHistoryTbody');

  // KPI elements
  const kpiStatus = document.getElementById('dropRetentionKpiStatus');
  const kpiTension = document.getElementById('dropRetentionKpiTension');
  const kpiStrain = document.getElementById('dropRetentionKpiStrain');
  const kpiHoldingSf = document.getElementById('dropRetentionKpiHoldingSf');
  const kpiSlipSf = document.getElementById('dropRetentionKpiSlipSf');

  function open() {
    if (modal) {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
      renderHistory();
      if (presetSelect && presetSelect.value) {
        const p = RETENTION_PRESETS.find(x => x.id === presetSelect.value);
        if (p) applyPreset(p);
      } else {
        applyPreset(RETENTION_PRESETS[0]);
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
    if (clampSelect) clampSelect.value = preset.clampType;
    if (spanInput) spanInput.value = preset.spanLengthM;
    if (sagInput) sagInput.value = preset.midspanSagM;
    if (windInput) windInput.value = preset.windSpeedKmh;
    if (areaSelect) areaSelect.value = preset.area;
    if (technicianInput) technicianInput.value = preset.technician;
    if (notesInput) notesInput.value = preset.notes;

    recalculateAndRender();
  }

  function recalculateAndRender() {
    const cableType = cableSelect?.value || 'FLAT_DROP_2X5';
    const clampType = clampSelect?.value || 'WEDGE_DROP_CLAMP';
    const spanLengthM = parseFloat(spanInput?.value) || 45.0;
    const midspanSagM = parseFloat(sagInput?.value) || 0.65;
    const windSpeedKmh = parseFloat(windInput?.value) || 40.0;

    const metrics = calculateDropRetentionMetrics({
      cableType,
      clampType,
      spanLengthM,
      midspanSagM,
      windSpeedKmh
    });

    if (kpiStatus) {
      kpiStatus.textContent = metrics.statusLabel;
      kpiStatus.className = `audit-status-badge ${metrics.status === 'PASS' ? 'audit-pill-clean' : metrics.status === 'WARNING' ? 'audit-pill-review' : 'audit-pill-error'}`;
    }
    if (kpiTension) kpiTension.textContent = `${metrics.totalTensionN} N (Max: ${metrics.maxRatedTensionN} N)`;
    if (kpiStrain) {
      kpiStrain.textContent = `${metrics.strainPercent}% ${metrics.strainPercent > 0.33 ? '(HIGH STRESS)' : '(Safe)'}`;
      kpiStrain.style.color = metrics.strainPercent > 0.33 ? 'var(--red, #ef4444)' : 'inherit';
    }
    if (kpiHoldingSf) kpiHoldingSf.textContent = `${metrics.clampHoldingFactor}x Safety`;
    if (kpiSlipSf) kpiSlipSf.textContent = `${metrics.clampSlipFactor}x Slip Margin`;

    if (svgContainer) {
      svgContainer.innerHTML = renderDropRetentionSvg(metrics, { width: 720, height: 280 });
    }

    return metrics;
  }

  function renderHistory() {
    if (!historyTbody) return;
    const history = loadDropRetentionAuditLog(storage);
    historyTbody.innerHTML = '';
    if (!history.length) {
      historyTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:12px">No clamp retention audit records yet.</td></tr>';
      return;
    }
    history.slice(-10).reverse().forEach(rec => {
      const m = rec.metrics || {};
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:monospace;font-size:11px">${(rec.timestamp || '').slice(0, 16).replace('T', ' ')}</td>
        <td>${rec.area || '-'}</td>
        <td style="font-size:11px">${m.cableName || rec.cableType}</td>
        <td><strong>${m.totalTensionN || 0} N</strong></td>
        <td>${m.strainPercent || 0}%</td>
        <td><span class="audit-status-badge ${m.status === 'PASS' ? 'audit-pill-clean' : m.status === 'WARNING' ? 'audit-pill-review' : 'audit-pill-error'}">${m.status}</span></td>
      `;
      historyTbody.appendChild(tr);
    });
  }

  // Event handlers
  if (openBtn && !openBtn.dataset.wiredRetention) {
    openBtn.dataset.wiredRetention = 'true';
    openBtn.addEventListener('click', open);
  }
  if (closeBtn && !closeBtn.dataset.wiredRetention) {
    closeBtn.dataset.wiredRetention = 'true';
    closeBtn.addEventListener('click', close);
  }

  if (presetSelect && !presetSelect.dataset.wiredRetention) {
    presetSelect.dataset.wiredRetention = 'true';
    presetSelect.addEventListener('change', () => {
      const p = RETENTION_PRESETS.find(x => x.id === presetSelect.value);
      if (p) applyPreset(p);
    });
  }

  [cableSelect, clampSelect, spanInput, sagInput, windInput].forEach(el => {
    if (el && !el.dataset.wiredRetention) {
      el.dataset.wiredRetention = 'true';
      el.addEventListener('input', recalculateAndRender);
    }
  });

  if (saveBtn && !saveBtn.dataset.wiredRetention) {
    saveBtn.dataset.wiredRetention = 'true';
    saveBtn.addEventListener('click', () => {
      const metrics = recalculateAndRender();
      const record = {
        id: `RET-${Date.now()}`,
        timestamp: new Date().toISOString(),
        area: areaSelect?.value || 'Shahdara Town',
        cableType: cableSelect?.value || 'FLAT_DROP_2X5',
        clampType: clampSelect?.value || 'WEDGE_DROP_CLAMP',
        technician: technicianInput?.value || 'Lineman',
        notes: notesInput?.value || '',
        metrics
      };
      const history = loadDropRetentionAuditLog(storage);
      history.push(record);
      saveDropRetentionAuditLog(history, storage);
      renderHistory();
      onToast('Clamping retention audit saved!');
    });
  }

  if (shareBtn && !shareBtn.dataset.wiredRetention) {
    shareBtn.dataset.wiredRetention = 'true';
    shareBtn.addEventListener('click', () => {
      const metrics = recalculateAndRender();
      const record = {
        area: areaSelect?.value || 'Shahdara Town',
        cableType: cableSelect?.value || 'FLAT_DROP_2X5',
        clampType: clampSelect?.value || 'WEDGE_DROP_CLAMP',
        technician: technicianInput?.value || 'Lineman',
        notes: notesInput?.value || '',
        timestamp: new Date().toISOString(),
        metrics
      };
      const text = formatDropRetentionWhatsApp(record);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    });
  }

  if (exportCsvBtn && !exportCsvBtn.dataset.wiredRetention) {
    exportCsvBtn.dataset.wiredRetention = 'true';
    exportCsvBtn.addEventListener('click', () => {
      const history = loadDropRetentionAuditLog(storage);
      if (!history.length) {
        onToast('No retention audit records to export.');
        return;
      }
      const csv = generateDropRetentionCsv(history);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shahdara_drop_retention_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast('Retention audit CSV exported!');
    });
  }

  if (clearHistoryBtn && !clearHistoryBtn.dataset.wiredRetention) {
    clearHistoryBtn.dataset.wiredRetention = 'true';
    clearHistoryBtn.addEventListener('click', () => {
      clearDropRetentionAuditLog(storage);
      renderHistory();
      onToast('Drop retention audit history cleared.');
    });
  }

  return {
    open,
    close,
    applyPreset,
    recalculateAndRender
  };
}
