/**
 * Shahdara ISP - Field Mechanical Splice (Quick-Splice / Elastic Splice Element) & Index Matching Gel Restoration Assistant
 *
 * Provides FTTH field linemen, restoration technicians, and emergency crews with:
 * - Telcordia GR-765-CORE & IEC 61073-1 mechanical optical splice metrology
 * - Index-matching gel refractive index delta (n_core ~ 1.4682 vs n_gel ~ 1.4646) & air-gap Fresnel loss
 * - V-groove alignment precision, cleave end-face angle, and fiber butt gap tolerance
 * - Clamping wedge actuation status, tensile pull-out resistance (N), and thermal drift stability
 * - Pure-vector responsive SVG diagram depicting metallic splice element, aluminum clamping wedge, fiber ends in gel, and retention latches
 * - LocalStorage persistence (shahdara_mechanical_splice_audits_v1), bilingual WhatsApp dispatch, and RFC-4180 CSV export
 */

export const MECHANICAL_SPLICE_STORAGE_KEY = 'shahdara_mechanical_splice_audits_v1';

export const SPLICE_ELEMENT_TYPES = {
  FIBRLOK_UNIVERSAL_2529: {
    id: 'FIBRLOK_UNIVERSAL_2529',
    name: '3M Fibrlok II 2529 Universal Mechanical Splice (250µm & 900µm)',
    claddingDiamUm: 125,
    coatingDiamRange: '250µm to 900µm',
    typicalLossDb: 0.10,
    maxLossDb: 0.25,
    minReturnLossDb: 40,
    minTensilePullN: 4.4,
    description: 'High-precision ductile aluminum alloy element with factory-injected silicone index matching gel.'
  },
  CAMSPLICE_CORNING: {
    id: 'CAMSPLICE_CORNING',
    name: 'Corning CamSplice Mechanical Splice (Dual-Cam Locking)',
    claddingDiamUm: 125,
    coatingDiamRange: '250µm / 900µm',
    typicalLossDb: 0.15,
    maxLossDb: 0.35,
    minReturnLossDb: 40,
    minTensilePullN: 5.0,
    description: 'Rotating cam locking mechanism with transparent housing for optical glow verification.'
  },
  MICRO_DROP_SPLICE: {
    id: 'MICRO_DROP_SPLICE',
    name: 'FTTH Flat Drop & Round Cable Mechanical Splice Unit',
    claddingDiamUm: 125,
    coatingDiamRange: 'Flat Drop 2x3mm / 900µm',
    typicalLossDb: 0.18,
    maxLossDb: 0.40,
    minReturnLossDb: 45,
    minTensilePullN: 35.0,
    description: 'Integrated cable clamp retaining FRP strength members with internal elastic mechanical splice.'
  }
};

export const GEL_STATES = {
  OPTIMAL: {
    id: 'OPTIMAL',
    name: 'Fresh Factory Gel (Zero Contamination / Clear)',
    refractiveIndex: 1.4646,
    additionalLossDb: 0.00,
    returnLossDeductionDb: 0
  },
  DRIED_AGED: {
    id: 'DRIED_AGED',
    name: 'Aged / Oxidized Gel (Partial Desiccation)',
    refractiveIndex: 1.4580,
    additionalLossDb: 0.15,
    returnLossDeductionDb: 10
  },
  AIR_VOID_CONTAMINATED: {
    id: 'AIR_VOID_CONTAMINATED',
    name: 'Air Bubble Void or Dust Ingress',
    refractiveIndex: 1.0000,
    additionalLossDb: 0.45,
    returnLossDeductionDb: 25
  }
};

export const MECHANICAL_SPLICE_PRESETS = [
  {
    id: 'shahdara-storm-pole-emergency-splice',
    name: 'Shahdara Town Midnight Storm Pole-Top Emergency Restoration',
    area: 'Shahdara Town Feeder',
    spliceType: 'FIBRLOK_UNIVERSAL_2529',
    gelState: 'OPTIMAL',
    fiber1CleaveAngleDeg: 0.6,
    fiber2CleaveAngleDeg: 0.8,
    buttGapMicrons: 4,
    tensilePullN: 8.5,
    wavelengthNm: 1310,
    technician: 'Rashid Mahmood (Emergency Lead)',
    notes: 'Wind storm snapped drop cable; quick mechanical restoration restore service in 7 minutes.'
  },
  {
    id: 'ravi-road-drop-closure-joint',
    name: 'Ravi Road FAT Distribution Box Pigtail Jointing',
    area: 'Ravi Road Node',
    spliceType: 'CAMSPLICE_CORNING',
    gelState: 'OPTIMAL',
    fiber1CleaveAngleDeg: 0.5,
    fiber2CleaveAngleDeg: 0.5,
    buttGapMicrons: 2,
    tensilePullN: 6.2,
    wavelengthNm: 1550,
    technician: 'Arshad Ali (Senior Tech)',
    notes: 'Permanent mechanical splice inside outdoor pole-mounted mini-closure.'
  },
  {
    id: 'begum-kot-flat-drop-cut-repair',
    name: 'Begum Kot Flat Drop Cable Severed by Construction Truck',
    area: 'Begum Kot Industrial',
    spliceType: 'MICRO_DROP_SPLICE',
    gelState: 'OPTIMAL',
    fiber1CleaveAngleDeg: 1.1,
    fiber2CleaveAngleDeg: 1.0,
    buttGapMicrons: 8,
    tensilePullN: 42.0,
    wavelengthNm: 1310,
    technician: 'Tariq Javed (Field Lineman)',
    notes: 'Direct clamp retaining flat drop FRP strength members and glass core.'
  },
  {
    id: 'saeed-park-contaminated-old-splice',
    name: 'Saeed Park High Loss Mechanical Joint Investigation',
    area: 'Saeed Park Sub-Ring',
    spliceType: 'FIBRLOK_UNIVERSAL_2529',
    gelState: 'AIR_VOID_CONTAMINATED',
    fiber1CleaveAngleDeg: 2.2,
    fiber2CleaveAngleDeg: 2.4,
    buttGapMicrons: 25,
    tensilePullN: 3.2,
    wavelengthNm: 1550,
    technician: 'Imran Shah (Tech)',
    notes: 'Excessive 0.85 dB loss due to unseated fiber and air bubble void in element.'
  }
];

/**
 * Calculates mechanical splice loss, return loss, and mechanical stability.
 */
export function calculateMechanicalSpliceMetrics(params = {}) {
  const spliceTypeId = params.spliceType || 'FIBRLOK_UNIVERSAL_2529';
  const spliceType = SPLICE_ELEMENT_TYPES[spliceTypeId] || SPLICE_ELEMENT_TYPES.FIBRLOK_UNIVERSAL_2529;

  const gelStateId = params.gelState || 'OPTIMAL';
  const gelState = GEL_STATES[gelStateId] || GEL_STATES.OPTIMAL;

  const fiber1CleaveAngle = parseFloat(params.fiber1CleaveAngleDeg) || 0.6;
  const fiber2CleaveAngle = parseFloat(params.fiber2CleaveAngleDeg) || 0.8;
  const buttGapMicrons = parseFloat(params.buttGapMicrons) || 4.0;
  const tensilePullN = parseFloat(params.tensilePullN) || 8.5;
  const wavelengthNm = parseInt(params.wavelengthNm, 10) || 1310;

  // Fresnel reflection index matching
  const nCore = 1.4682;
  const nGel = gelState.refractiveIndex;
  // Fresnel reflection coefficient R = ((nCore - nGel) / (nCore + nGel))^2
  const fresnelRefl = Math.pow((nCore - nGel) / (nCore + nGel), 2);
  let orlDb = fresnelRefl > 0 ? -10 * Math.log10(fresnelRefl) : 60;
  orlDb = Math.max(14, Math.min(65, orlDb - gelState.returnLossDeductionDb));

  // Cleave angle loss contribution
  const avgCleaveAngle = (fiber1CleaveAngle + fiber2CleaveAngle) / 2;
  const cleaveLossDb = Math.max(0, (avgCleaveAngle - 0.5) * 0.08);

  // Butt gap attenuation contribution (diffraction in gel)
  const gapLossDb = (buttGapMicrons / 10) * 0.05;

  // Total calculated insertion loss
  const calculatedLossDb = Math.round((spliceType.typicalLossDb + gelState.additionalLossDb + cleaveLossDb + gapLossDb) * 100) / 100;

  // Compliance evaluation
  const isLossPass = calculatedLossDb <= spliceType.maxLossDb;
  const isOrlPass = orlDb >= spliceType.minReturnLossDb;
  const isTensilePass = tensilePullN >= spliceType.minTensilePullN;
  const isCleavePass = fiber1CleaveAngle <= 1.5 && fiber2CleaveAngle <= 1.5;
  const isOverallPass = isLossPass && isOrlPass && isTensilePass && isCleavePass;

  let qualityRating = 'EXCELLENT';
  if (!isLossPass || !isOrlPass) {
    qualityRating = 'FAIL (Excessive Loss / Poor Gel Match)';
  } else if (!isTensilePass) {
    qualityRating = 'FAIL (Insufficient Clamping Force)';
  } else if (calculatedLossDb > spliceType.typicalLossDb * 1.5) {
    qualityRating = 'ACCEPTABLE (Within Field Tolerance)';
  } else {
    qualityRating = 'EXCELLENT (Low-Loss Tier-1 Splice)';
  }

  return {
    spliceType,
    gelState,
    fiber1CleaveAngle,
    fiber2CleaveAngle,
    avgCleaveAngle,
    buttGapMicrons,
    tensilePullN,
    wavelengthNm,
    nCore,
    nGel,
    calculatedLossDb,
    orlDb: Math.round(orlDb * 10) / 10,
    isLossPass,
    isOrlPass,
    isTensilePass,
    isCleavePass,
    isOverallPass,
    qualityRating
  };
}

/**
 * Pure-vector SVG schematic depicting mechanical splice V-groove element, fiber butt gap, and clamping wedge.
 */
export function renderMechanicalSpliceSvg(metrics, options = {}) {
  const isDark = options.isDark ?? false;
  const m = metrics || calculateMechanicalSpliceMetrics();

  const width = 760;
  const height = 280;

  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textMuted = isDark ? '#94a3b8' : '#64748b';

  const statusColor = m.isOverallPass ? '#10b981' : '#ef4444';

  const centerX = width / 2;
  const centerY = 135;

  return `
  <svg class="mechanical-splice-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mechanical Splice Assembly and Index Matching Gel Diagram">
    <!-- Background Canvas -->
    <rect width="${width}" height="${height}" rx="10" fill="${bgColor}" stroke="${borderColor}" stroke-width="1.5"/>

    <!-- Header Section -->
    <g transform="translate(30, 24)">
      <text x="0" y="0" font-family="'DM Sans', system-ui, sans-serif" font-size="13" font-weight="700" fill="${textPrimary}">
        ${m.spliceType.name}
      </text>
      <text x="0" y="18" font-family="'DM Sans', system-ui, sans-serif" font-size="10.5" font-weight="500" fill="${textMuted}">
        Gel State: ${m.gelState.name} · Gap: ${m.buttGapMicrons} µm · Wavelength: ${m.wavelengthNm} nm
      </text>
      <!-- Status Badge -->
      <g transform="translate(${width - 260}, -10)">
        <rect width="200" height="26" rx="13" fill="${statusColor}" fill-opacity="0.15" stroke="${statusColor}" stroke-width="1.5"/>
        <circle cx="14" cy="13" r="5" fill="${statusColor}"/>
        <text x="26" y="17" font-family="'DM Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${statusColor}">
          ${m.isOverallPass ? 'SPLICE VERIFIED: PASS' : 'SPLICE REJECTED: FAIL'}
        </text>
      </g>
    </g>

    <!-- Splice Housing Outer Shell -->
    <g transform="translate(${centerX}, ${centerY})">
      <!-- Outer Plastic Body -->
      <rect x="-240" y="-55" width="480" height="110" rx="12" fill="${cardBg}" stroke="${borderColor}" stroke-width="2"/>

      <!-- Aluminum Alloy Element Channel -->
      <rect x="-180" y="-30" width="360" height="60" rx="6" fill="#94a3b8" fill-opacity="0.2" stroke="#64748b" stroke-width="1.5"/>

      <!-- Central Index Matching Gel Chamber -->
      <rect x="-50" y="-20" width="100" height="40" rx="4" fill="#38bdf8" fill-opacity="0.25" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4,2"/>
      <text x="0" y="-26" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8.5" font-weight="700" fill="#0284c7">
        INDEX MATCHING GEL (n = ${m.nGel.toFixed(4)})
      </text>

      <!-- Fiber 1 (Left Core & 250µm Coating) -->
      <!-- 250µm Coating -->
      <rect x="-230" y="-12" width="120" height="24" rx="3" fill="#2563eb" stroke="#1d4ed8" stroke-width="1.5"/>
      <text x="-170" y="4" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="#ffffff">
        Fiber 1 (250µm)
      </text>
      <!-- 125µm Bare Cladding entering V-groove -->
      <rect x="-110" y="-6" width="105" height="12" rx="1" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/>
      <!-- Angled End Face -->
      <line x1="-5" y1="-6" x2="-5" y2="6" stroke="#0284c7" stroke-width="2"/>

      <!-- Fiber 2 (Right Core & 250µm Coating) -->
      <!-- 250µm Coating -->
      <rect x="110" y="-12" width="120" height="24" rx="3" fill="#ea580c" stroke="#c2410c" stroke-width="1.5"/>
      <text x="170" y="4" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="#ffffff">
        Fiber 2 (250µm)
      </text>
      <!-- 125µm Bare Cladding entering V-groove -->
      <rect x="5" y="-6" width="105" height="12" rx="1" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/>
      <!-- Angled End Face -->
      <line x1="5" y1="-6" x2="5" y2="6" stroke="#0284c7" stroke-width="2"/>

      <!-- Butt Gap Callout -->
      <line x1="-5" y1="18" x2="5" y2="18" stroke="${statusColor}" stroke-width="1.5"/>
      <text x="0" y="30" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="8" font-weight="700" fill="${statusColor}">
        ${m.buttGapMicrons} µm Gap
      </text>

      <!-- Clamping Wedge / Actuation Cap Indicator -->
      <polygon points="0,-48 -20,-36 20,-36" fill="#f59e0b" stroke="#d97706" stroke-width="1"/>
      <text x="0" y="-42" text-anchor="middle" font-family="'DM Sans', system-ui, sans-serif" font-size="7.5" font-weight="800" fill="#ffffff">
        CLAMP
      </text>
    </g>

    <!-- Metrics Footer Banner -->
    <g transform="translate(30, ${height - 24})">
      <rect x="0" y="-14" width="${width - 60}" height="28" rx="6" fill="${cardBg}" stroke="${borderColor}" stroke-width="1"/>
      <text x="15" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">
        Insertion Loss: <tspan fill="${m.isLossPass ? '#10b981' : '#ef4444'}">${m.calculatedLossDb} dB (Max: ${m.spliceType.maxLossDb} dB)</tspan>
      </text>
      <text x="240" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">
        Return Loss: <tspan fill="${m.isOrlPass ? '#10b981' : '#ef4444'}">${m.orlDb} dB (Min: ${m.spliceType.minReturnLossDb} dB)</tspan>
      </text>
      <text x="440" y="4" font-family="'DM Sans', system-ui, sans-serif" font-size="9" font-weight="700" fill="${textPrimary}">
        Tensile Pull: <tspan fill="${m.isTensilePass ? '#10b981' : '#ef4444'}">${m.tensilePullN} N (Min: ${m.spliceType.minTensilePullN} N)</tspan>
      </text>
    </g>
  </svg>`;
}

/**
 * Loads saved mechanical splice audit records from localStorage.
 */
export function loadMechanicalSpliceAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(MECHANICAL_SPLICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves mechanical splice audit records to localStorage.
 */
export function saveMechanicalSpliceAuditLog(records = [], storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.setItem(MECHANICAL_SPLICE_STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
  } catch {}
}

/**
 * Clears saved mechanical splice audit records.
 */
export function clearMechanicalSpliceAuditLog(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(MECHANICAL_SPLICE_STORAGE_KEY);
  } catch {}
}

/**
 * Formats bilingual WhatsApp text for mechanical splice dispatch.
 */
export function formatMechanicalSpliceWhatsAppText(record) {
  const m = record.metrics;
  const statusEmoji = m.isOverallPass ? '✅' : '⚠️';

  return `*SHAHDARA ISP - MECHANICAL SPLICE RESTORATION AUDIT* ${statusEmoji}
----------------------------------------
*Splice ID:* ${record.id}
*Date:* ${record.date}
*Technician:* ${record.technician}
*Area / Span:* ${record.area}
*Element Type:* ${m.spliceType.name}

*OPTICAL & MECHANICAL METROLOGY:*
- Calculated Insertion Loss: ${m.calculatedLossDb} dB (Max Allowed: ${m.spliceType.maxLossDb} dB) -> ${m.isLossPass ? 'PASS' : 'EXCESSIVE LOSS'}
- Optical Return Loss (ORL): ${m.orlDb} dB (Min: ${m.spliceType.minReturnLossDb} dB) -> ${m.isOrlPass ? 'PASS' : 'HIGH REFLECTION'}
- Tensile Pull Resistance: ${m.tensilePullN} N (Min: ${m.spliceType.minTensilePullN} N) -> ${m.isTensilePass ? 'SECURE' : 'SLIP RISK'}
- Index Matching Gel: ${m.gelState.name} (n = ${m.nGel.toFixed(4)})
- Fiber Butt Gap: ${m.buttGapMicrons} µm · Cleave Angles: ${m.fiber1CleaveAngle}° / ${m.fiber2CleaveAngle}°
- Overall Splice Rating: ${m.qualityRating}

*URDU SUMMARY / خلاصہ:*
مکینیکل سپلائس بحالی مکمل ہو گئی ہے۔ انسرشن لاس ${m.calculatedLossDb} dB اور ریٹرن لاس ${m.orlDb} dB ہے۔ سپلائس ٹینسائل لوڈ ${m.tensilePullN} N پر لاک ہو گئی۔
----------------------------------------
_Shahdara Emergency Field Splice Dispatch_`;
}

/**
 * Generates RFC-4180 compliant CSV export of mechanical splice audit records.
 */
export function generateMechanicalSpliceCsv(records = []) {
  const headers = [
    'TestId',
    'Date',
    'Area',
    'Technician',
    'SpliceType',
    'GelState',
    'WavelengthNm',
    'CalculatedLossDb',
    'LossPass',
    'ReturnLossDb',
    'OrlPass',
    'TensilePullN',
    'TensilePass',
    'ButtGapUm',
    'Rating',
    'Notes'
  ];

  const rows = records.map(r => {
    const m = r.metrics;
    return [
      r.id,
      `"${r.date}"`,
      `"${r.area}"`,
      `"${r.technician}"`,
      `"${m.spliceType.id}"`,
      `"${m.gelState.id}"`,
      m.wavelengthNm,
      m.calculatedLossDb,
      m.isLossPass,
      m.orlDb,
      m.isOrlPass,
      m.tensilePullN,
      m.isTensilePass,
      m.buttGapMicrons,
      `"${m.qualityRating}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Modal controller for Field Mechanical Splice Assistant.
 */
export function setupMobileMechanicalSpliceModal(state = {}, options = {}) {
  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;

  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const modal = doc.getElementById('mobileMechanicalSpliceModal');
  const openBtn = doc.getElementById('mobileMoreMechanicalSpliceBtn');
  const closeBtn = doc.getElementById('mobileMechanicalSpliceModalCloseBtn');

  const presetSelect = doc.getElementById('mechanicalSplicePresetSelect');
  const typeSelect = doc.getElementById('mechanicalSpliceTypeSelect');
  const gelSelect = doc.getElementById('mechanicalSpliceGelSelect');
  const cleave1Input = doc.getElementById('mechanicalSpliceCleave1Input');
  const cleave2Input = doc.getElementById('mechanicalSpliceCleave2Input');
  const gapInput = doc.getElementById('mechanicalSpliceGapInput');
  const tensileInput = doc.getElementById('mechanicalSpliceTensileInput');
  const waveSelect = doc.getElementById('mechanicalSpliceWaveSelect');
  const areaInput = doc.getElementById('mechanicalSpliceAreaInput');
  const techInput = doc.getElementById('mechanicalSpliceTechInput');
  const notesInput = doc.getElementById('mechanicalSpliceNotesInput');

  const svgContainer = doc.getElementById('mechanicalSpliceSvgContainer');
  const statLoss = doc.getElementById('mechanicalSpliceStatLoss');
  const statOrl = doc.getElementById('mechanicalSpliceStatOrl');
  const statTensile = doc.getElementById('mechanicalSpliceStatTensile');
  const statRating = doc.getElementById('mechanicalSpliceStatRating');

  const saveAuditBtn = doc.getElementById('mechanicalSpliceSaveAuditBtn');
  const copyWhatsappBtn = doc.getElementById('mechanicalSpliceCopyWhatsappBtn');
  const exportCsvBtn = doc.getElementById('mechanicalSpliceExportCsvBtn');
  const clearHistoryBtn = doc.getElementById('mechanicalSpliceClearHistoryBtn');
  const historyList = doc.getElementById('mechanicalSpliceHistoryList');

  const getParams = () => ({
    spliceType: typeSelect?.value || 'FIBRLOK_UNIVERSAL_2529',
    gelState: gelSelect?.value || 'OPTIMAL',
    fiber1CleaveAngleDeg: cleave1Input?.value || '0.6',
    fiber2CleaveAngleDeg: cleave2Input?.value || '0.8',
    buttGapMicrons: gapInput?.value || '4.0',
    tensilePullN: tensileInput?.value || '8.5',
    wavelengthNm: waveSelect?.value || '1310'
  });

  const renderView = () => {
    const isDark = doc.documentElement && doc.documentElement.getAttribute('data-theme') === 'dark';
    const params = getParams();
    const metrics = calculateMechanicalSpliceMetrics(params);

    if (svgContainer) {
      svgContainer.innerHTML = renderMechanicalSpliceSvg(metrics, { isDark });
    }

    if (statLoss) {
      statLoss.textContent = `${metrics.calculatedLossDb} dB`;
      statLoss.style.color = metrics.isLossPass ? '#10b981' : '#ef4444';
    }
    if (statOrl) {
      statOrl.textContent = `${metrics.orlDb} dB`;
      statOrl.style.color = metrics.isOrlPass ? '#10b981' : '#ef4444';
    }
    if (statTensile) {
      statTensile.textContent = `${metrics.tensilePullN} N`;
      statTensile.style.color = metrics.isTensilePass ? '#10b981' : '#ef4444';
    }
    if (statRating) {
      statRating.textContent = metrics.qualityRating.split(' ')[0];
      statRating.style.color = metrics.isOverallPass ? '#10b981' : '#ef4444';
    }
  };

  const renderHistory = () => {
    if (!historyList) return;
    const records = loadMechanicalSpliceAuditLog(storage);
    if (!records.length) {
      historyList.innerHTML = '<li class="empty-log-item" style="padding: 10px; color: var(--text-muted, #94a3b8); font-size: 0.85rem; text-align: center;">No mechanical splice restorations recorded yet.</li>';
      return;
    }

    historyList.innerHTML = records.map(r => `
      <li class="history-item" style="border: 1px solid var(--border-color, #e2e8f0); border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; font-size: 0.85rem;">
        <div style="display: flex; justify-content: space-between; font-weight: 700;">
          <span>${r.id} · ${r.area}</span>
          <span style="color: ${r.metrics.isOverallPass ? '#10b981' : '#ef4444'};">${r.metrics.isOverallPass ? 'PASS' : 'FAIL'}</span>
        </div>
        <div style="color: var(--text-muted, #94a3b8); font-size: 0.8rem; margin: 2px 0;">
          ${r.date} · Tech: ${r.technician} · ${r.metrics.spliceType.name.split(' ')[0]}
        </div>
        <div>
          Loss: <strong>${r.metrics.calculatedLossDb} dB</strong> · ORL: <strong>${r.metrics.orlDb} dB</strong> · Pull: <strong>${r.metrics.tensilePullN} N</strong>
        </div>
      </li>
    `).join('');
  };

  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      const preset = MECHANICAL_SPLICE_PRESETS.find(p => p.id === presetSelect.value);
      if (preset) {
        if (typeSelect) typeSelect.value = preset.spliceType;
        if (gelSelect) gelSelect.value = preset.gelState;
        if (cleave1Input) cleave1Input.value = preset.fiber1CleaveAngleDeg;
        if (cleave2Input) cleave2Input.value = preset.fiber2CleaveAngleDeg;
        if (gapInput) gapInput.value = preset.buttGapMicrons;
        if (tensileInput) tensileInput.value = preset.tensilePullN;
        if (waveSelect) waveSelect.value = String(preset.wavelengthNm);
        if (areaInput) areaInput.value = preset.area;
        if (techInput) techInput.value = preset.technician;
        if (notesInput) notesInput.value = preset.notes;
        renderView();
      }
    });
  }

  [typeSelect, gelSelect, cleave1Input, cleave2Input, gapInput, tensileInput, waveSelect].forEach(el => {
    if (el) {
      el.addEventListener('change', renderView);
      el.addEventListener('input', renderView);
    }
  });

  if (saveAuditBtn) {
    saveAuditBtn.addEventListener('click', () => {
      const params = getParams();
      const metrics = calculateMechanicalSpliceMetrics(params);
      const record = {
        id: `MEC-${Date.now().toString(36).toUpperCase()}`,
        date: new Date().toLocaleString(),
        area: areaInput?.value || 'Shahdara Area',
        technician: techInput?.value || 'Field Lineman',
        notes: notesInput?.value || '',
        params,
        metrics
      };
      const records = loadMechanicalSpliceAuditLog(storage);
      records.unshift(record);
      saveMechanicalSpliceAuditLog(records, storage);
      renderHistory();
      if (typeof options.onToast === 'function') {
        options.onToast('Mechanical splice audit saved successfully');
      }
    });
  }

  if (copyWhatsappBtn) {
    copyWhatsappBtn.addEventListener('click', () => {
      const params = getParams();
      const metrics = calculateMechanicalSpliceMetrics(params);
      const record = {
        id: `MEC-${Date.now().toString(36).toUpperCase()}`,
        date: new Date().toLocaleString(),
        area: areaInput?.value || 'Shahdara Area',
        technician: techInput?.value || 'Field Lineman',
        notes: notesInput?.value || '',
        params,
        metrics
      };
      const text = formatMechanicalSpliceWhatsAppText(record);
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
      const records = loadMechanicalSpliceAuditLog(storage);
      if (!records.length) {
        if (typeof options.onToast === 'function') options.onToast('No records to export');
        return;
      }
      const csvStr = generateMechanicalSpliceCsv(records);
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
      clearMechanicalSpliceAuditLog(storage);
      renderHistory();
      if (typeof options.onToast === 'function') {
        options.onToast('Splice audit history cleared');
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
