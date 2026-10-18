/**
 * Shahdara ISP - Field Technician Optical Link Loss Budget & Splitter Attenuation Assistant
 * Part of mobile navigation and field crew tools (agent2 - shahdara-mobile-nav).
 *
 * Implements ITU-T G.984 GPON (Class B+ / Class C+) and ITU-T G.9807.1 XGS-PON (Class N1 / Class N2)
 * optical link loss budget calculations, fiber span attenuation (1310nm / 1490nm / 1550nm / 1577nm),
 * cascaded PLC optical splitter staging (1:2 to 1:64), fusion and mechanical splice losses,
 * connector interface insertion penalties, optical headroom safety margin estimation,
 * pure client-side SVG waterfall power budget visualizer, persistent audit store,
 * and field lineman WhatsApp dispatch reports.
 */

export const OPTICAL_BUDGET_STORAGE_KEY = 'shahdara_optical_budget_logs_v1';

export const PON_OPTICAL_STANDARDS = [
  {
    id: 'GPON_CLASS_B_PLUS',
    name: 'ITU-T G.984 GPON Class B+ (Standard 2.5G/1.25G)',
    txPowerMinDbm: 1.5,
    txPowerMaxDbm: 5.0,
    txPowerNominalDbm: 3.0,
    rxSensitivityDbm: -27.0,
    maxOpticalBudgetDb: 28.5,
    downstreamWavelengthNm: 1490,
    upstreamWavelengthNm: 1310
  },
  {
    id: 'GPON_CLASS_C_PLUS',
    name: 'ITU-T G.984 GPON Class C+ (Extended Power 2.5G/1.25G)',
    txPowerMinDbm: 3.0,
    txPowerMaxDbm: 7.0,
    txPowerNominalDbm: 5.0,
    rxSensitivityDbm: -30.0,
    maxOpticalBudgetDb: 32.0,
    downstreamWavelengthNm: 1490,
    upstreamWavelengthNm: 1310
  },
  {
    id: 'XGS_PON_CLASS_N1',
    name: 'ITU-T G.9807.1 XGS-PON Class N1 (Symmetrical 10G)',
    txPowerMinDbm: 2.0,
    txPowerMaxDbm: 6.0,
    txPowerNominalDbm: 4.0,
    rxSensitivityDbm: -28.0,
    maxOpticalBudgetDb: 29.0,
    downstreamWavelengthNm: 1577,
    upstreamWavelengthNm: 1270
  },
  {
    id: 'XGS_PON_CLASS_N2',
    name: 'ITU-T G.9807.1 XGS-PON Class N2 (High-Loss 10G OLT)',
    txPowerMinDbm: 4.0,
    txPowerMaxDbm: 8.0,
    txPowerNominalDbm: 6.0,
    rxSensitivityDbm: -29.0,
    maxOpticalBudgetDb: 31.0,
    downstreamWavelengthNm: 1577,
    upstreamWavelengthNm: 1270
  }
];

export const SPLITTER_LOSS_TABLE = {
  'NONE': { id: 'NONE', label: 'Direct Pass-Through / No Splitter (0 dB)', lossDb: 0.0, splitCount: 1 },
  '1:2': { id: '1:2', label: '1:2 PLC Splitter (3.5 dB)', lossDb: 3.5, splitCount: 2 },
  '1:4': { id: '1:4', label: '1:4 PLC Splitter (7.2 dB)', lossDb: 7.2, splitCount: 4 },
  '1:8': { id: '1:8', label: '1:8 PLC Splitter (10.5 dB)', lossDb: 10.5, splitCount: 8 },
  '1:16': { id: '1:16', label: '1:16 PLC Splitter (13.8 dB)', lossDb: 13.8, splitCount: 16 },
  '1:32': { id: '1:32', label: '1:32 PLC Splitter (17.1 dB)', lossDb: 17.1, splitCount: 32 },
  '1:64': { id: '1:64', label: '1:64 PLC Splitter (20.5 dB)', lossDb: 20.5, splitCount: 64 }
};

export const WAVELENGTH_ATTENUATION_TABLE = {
  '1310': { nm: 1310, coeffDbKm: 0.35, desc: 'O-Band (GPON Upstream)' },
  '1490': { nm: 1490, coeffDbKm: 0.28, desc: 'S-Band (GPON Downstream)' },
  '1550': { nm: 1550, coeffDbKm: 0.21, desc: 'C-Band (Video / DWDM Overlay)' },
  '1577': { nm: 1577, coeffDbKm: 0.20, desc: 'L-Band (XGS-PON Downstream)' }
};

export const BUDGET_QUALITY_GRADES = {
  OPTIMAL_PASS: {
    id: 'OPTIMAL_PASS',
    label: 'OPTIMAL PASS (Margin ≥ 4.0 dB)',
    badgeClass: 'badge-success',
    desc: 'Flawless Gigabit Optical Signal with Abundant Headroom',
    pass: true
  },
  ACCEPTABLE_PASS: {
    id: 'ACCEPTABLE_PASS',
    label: 'ACCEPTABLE PASS (Margin 1.5 to 3.9 dB)',
    badgeClass: 'badge-success',
    desc: 'Meets ITU-T Specs with Standard Operational Headroom',
    pass: true
  },
  MARGINAL_WARNING: {
    id: 'MARGINAL_WARNING',
    label: 'MARGINAL WARNING (Margin 0.0 to 1.4 dB)',
    badgeClass: 'badge-warning',
    desc: 'At Sensitivity Edge; Temperature Drift May Cause CRC/FEC Flaps',
    pass: false
  },
  CRITICAL_FAIL: {
    id: 'CRITICAL_FAIL',
    label: 'CRITICAL BUDGET DEFICIT (Margin < 0.0 dB)',
    badgeClass: 'badge-danger',
    desc: 'Received Light Below ONT Sensitivity Floor; No Connection',
    pass: false
  }
};

export const SHAHDARA_FEEDER_PRESETS = [
  {
    id: 'PRESET_SHAHDARA_TOWN',
    name: 'Shahdara Town Central OLT - Feeder 01',
    area: 'Shahdara Town',
    standardId: 'GPON_CLASS_B_PLUS',
    defaultDistanceM: 2800,
    primarySplitter: '1:8',
    secondarySplitter: '1:8',
    fusionSplices: 4,
    mechanicalSplices: 0,
    connectorPairs: 2
  },
  {
    id: 'PRESET_BARADARI_ROAD',
    name: 'Baradari Industrial Hub - Feeder 02',
    area: 'Baradari Road',
    standardId: 'GPON_CLASS_C_PLUS',
    defaultDistanceM: 3900,
    primarySplitter: '1:4',
    secondarySplitter: '1:16',
    fusionSplices: 5,
    mechanicalSplices: 1,
    connectorPairs: 3
  },
  {
    id: 'PRESET_VANDALA_ROAD',
    name: 'Vandala Road Core - Feeder 03',
    area: 'Vandala Road',
    standardId: 'XGS_PON_CLASS_N1',
    defaultDistanceM: 3200,
    primarySplitter: '1:8',
    secondarySplitter: '1:8',
    fusionSplices: 3,
    mechanicalSplices: 0,
    connectorPairs: 2
  },
  {
    id: 'PRESET_JIA_MUSA',
    name: 'Jia Musa Main POP - Feeder 04',
    area: 'Jia Musa',
    standardId: 'GPON_CLASS_B_PLUS',
    defaultDistanceM: 1900,
    primarySplitter: '1:8',
    secondarySplitter: '1:4',
    fusionSplices: 3,
    mechanicalSplices: 0,
    connectorPairs: 2
  },
  {
    id: 'PRESET_BEGUM_KOT',
    name: 'Begum Kot Outlying Sub-Hub - Feeder 05',
    area: 'Begum Kot',
    standardId: 'GPON_CLASS_C_PLUS',
    defaultDistanceM: 5200,
    primarySplitter: '1:4',
    secondarySplitter: '1:8',
    fusionSplices: 6,
    mechanicalSplices: 1,
    connectorPairs: 3
  }
];

/**
 * Calculates fiber distance attenuation in dB.
 */
export function calculateFiberDistanceLoss(distanceMeters, wavelengthNm = '1490') {
  const dKm = Math.max(0, Number(distanceMeters) || 0) / 1000;
  const wl = String(wavelengthNm);
  const info = WAVELENGTH_ATTENUATION_TABLE[wl] || WAVELENGTH_ATTENUATION_TABLE['1490'];
  return Number((dKm * info.coeffDbKm).toFixed(3));
}

/**
 * Calculates optical splitter insertion loss.
 */
export function calculateSplitterLoss(splitterRatio) {
  const key = String(splitterRatio || 'NONE').trim();
  const entry = SPLITTER_LOSS_TABLE[key] || SPLITTER_LOSS_TABLE['NONE'];
  return entry.lossDb;
}

/**
 * Calculates losses for fusion splices (0.08 dB each), mechanical splices (0.25 dB each),
 * and SC/APC connector pairs (0.35 dB each).
 */
export function calculateSplicesAndConnectorsLoss(fusionCount = 2, mechanicalCount = 0, connectorPairsCount = 2) {
  const f = Math.max(0, parseInt(fusionCount, 10) || 0);
  const m = Math.max(0, parseInt(mechanicalCount, 10) || 0);
  const c = Math.max(0, parseInt(connectorPairsCount, 10) || 0);

  const fusionLoss = f * 0.08;
  const mechLoss = m * 0.25;
  const connLoss = c * 0.35;
  const total = fusionLoss + mechLoss + connLoss;

  return {
    fusionCount: f,
    fusionLossDb: Number(fusionLoss.toFixed(3)),
    mechanicalCount: m,
    mechanicalLossDb: Number(mechLoss.toFixed(3)),
    connectorPairsCount: c,
    connectorLossDb: Number(connLoss.toFixed(3)),
    totalJointLossDb: Number(total.toFixed(3))
  };
}

/**
 * Evaluates optical budget quality grade and safety headroom margin.
 */
export function evaluateOpticalBudgetQuality(expectedRxDbm, minSensitivityDbm) {
  const rx = Number(expectedRxDbm);
  const sens = Number(minSensitivityDbm);
  const headroomDb = Number((rx - sens).toFixed(2));

  if (headroomDb >= 4.0) {
    return { ...BUDGET_QUALITY_GRADES.OPTIMAL_PASS, headroomDb };
  }
  if (headroomDb >= 1.5) {
    return { ...BUDGET_QUALITY_GRADES.ACCEPTABLE_PASS, headroomDb };
  }
  if (headroomDb >= 0.0) {
    return { ...BUDGET_QUALITY_GRADES.MARGINAL_WARNING, headroomDb };
  }
  return { ...BUDGET_QUALITY_GRADES.CRITICAL_FAIL, headroomDb };
}

/**
 * Calculates comprehensive optical link budget.
 */
export function calculateOpticalLinkBudget({
  ponStandardId = 'GPON_CLASS_B_PLUS',
  wavelengthNm = '1490',
  distanceMeters = 2500,
  primarySplitter = '1:8',
  secondarySplitter = '1:8',
  fusionSplices = 3,
  mechanicalSplices = 0,
  connectorPairs = 2,
  customTxPowerDbm = null
} = {}) {
  const standard = PON_OPTICAL_STANDARDS.find(s => s.id === ponStandardId) || PON_OPTICAL_STANDARDS[0];
  const txPower = customTxPowerDbm !== null && !isNaN(Number(customTxPowerDbm))
    ? Number(customTxPowerDbm)
    : standard.txPowerNominalDbm;

  const fiberLossDb = calculateFiberDistanceLoss(distanceMeters, wavelengthNm);
  const primarySplitterLossDb = calculateSplitterLoss(primarySplitter);
  const secondarySplitterLossDb = calculateSplitterLoss(secondarySplitter);
  const jointLoss = calculateSplicesAndConnectorsLoss(fusionSplices, mechanicalSplices, connectorPairs);

  const totalSplitterLossDb = Number((primarySplitterLossDb + secondarySplitterLossDb).toFixed(3));
  const totalAttenuationDb = Number((fiberLossDb + totalSplitterLossDb + jointLoss.totalJointLossDb).toFixed(2));

  const expectedRxPowerDbm = Number((txPower - totalAttenuationDb).toFixed(2));
  const evaluation = evaluateOpticalBudgetQuality(expectedRxPowerDbm, standard.rxSensitivityDbm);

  const primarySplitCount = (SPLITTER_LOSS_TABLE[primarySplitter] || SPLITTER_LOSS_TABLE['NONE']).splitCount;
  const secondarySplitCount = (SPLITTER_LOSS_TABLE[secondarySplitter] || SPLITTER_LOSS_TABLE['NONE']).splitCount;
  const totalSubscribersPerPort = primarySplitCount * secondarySplitCount;

  return {
    standard,
    wavelengthNm: String(wavelengthNm),
    distanceMeters: Number(distanceMeters),
    distanceKm: Number((distanceMeters / 1000).toFixed(3)),
    txPowerDbm: txPower,
    fiberLossDb,
    primarySplitter,
    primarySplitterLossDb,
    secondarySplitter,
    secondarySplitterLossDb,
    totalSplitterLossDb,
    jointLoss,
    totalAttenuationDb,
    expectedRxPowerDbm,
    rxSensitivityDbm: standard.rxSensitivityDbm,
    headroomMarginDb: evaluation.headroomDb,
    evaluation,
    totalSubscribersPerPort
  };
}

/**
 * Retrieves audit log store from localStorage.
 */
export function getOpticalBudgetStore(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(OPTICAL_BUDGET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves audit log store to localStorage.
 */
export function saveOpticalBudgetStore(records, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
  if (!storage) return false;
  try {
    const list = Array.isArray(records) ? records.slice(-50) : [];
    storage.setItem(OPTICAL_BUDGET_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/**
 * Records an optical budget audit entry.
 */
export function recordOpticalBudgetCalculation(record, storage) {
  const store = getOpticalBudgetStore(storage);
  const entry = {
    id: `opt-budget-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...record
  };
  store.unshift(entry);
  saveOpticalBudgetStore(store, storage);
  return entry;
}

/**
 * Clears the optical budget audit store.
 */
export function clearOpticalBudgetStore(storage) {
  if (!storage) return false;
  try {
    storage.removeItem(OPTICAL_BUDGET_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Renders pure client-side SVG waterfall power budget chart.
 */
export function renderMobileOpticalBudgetSvg(budgetResult, { compact = false } = {}) {
  const b = budgetResult || calculateOpticalLinkBudget();
  const width = compact ? 560 : 760;
  const height = compact ? 220 : 320;
  const padLeft = compact ? 50 : 65;
  const padRight = compact ? 25 : 35;
  const padTop = compact ? 30 : 40;
  const padBottom = compact ? 35 : 45;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const minDbm = -35;
  const maxDbm = 10;

  const scaleY = (dbm) => {
    const clamped = Math.max(minDbm, Math.min(maxDbm, dbm));
    const ratio = (clamped - minDbm) / (maxDbm - minDbm);
    return padTop + chartH - ratio * chartH;
  };

  // Waterfall stages
  const stages = [
    { name: 'OLT Tx', dbm: b.txPowerDbm, loss: 0 },
    { name: 'Fiber Span', dbm: b.txPowerDbm - b.fiberLossDb, loss: b.fiberLossDb },
    { name: 'Splitter 1', dbm: b.txPowerDbm - b.fiberLossDb - b.primarySplitterLossDb, loss: b.primarySplitterLossDb },
    { name: 'Splitter 2', dbm: b.txPowerDbm - b.fiberLossDb - b.totalSplitterLossDb, loss: b.secondarySplitterLossDb },
    { name: 'Joints/Connectors', dbm: b.expectedRxPowerDbm, loss: b.jointLoss.totalJointLossDb }
  ];

  const colWidth = chartW / stages.length;

  let barsXml = '';
  let prevY = scaleY(stages[0].dbm);

  for (let i = 0; i < stages.length; i++) {
    const st = stages[i];
    const x = padLeft + i * colWidth + colWidth * 0.15;
    const w = colWidth * 0.7;
    const y = scaleY(st.dbm);

    let barH = 0;
    let barY = 0;
    if (i === 0) {
      barY = y;
      barH = scaleY(0) - y;
      barsXml += `
        <rect x="${x}" y="${barY}" width="${w}" height="${Math.max(4, Math.abs(barH))}" rx="4" fill="#10b981" fill-opacity="0.8" />
        <text x="${x + w / 2}" y="${barY - 6}" font-size="${compact ? 9 : 11}" font-weight="700" fill="#10b981" text-anchor="middle">+${st.dbm.toFixed(1)}</text>
      `;
    } else {
      const topY = Math.min(prevY, y);
      const diffH = Math.abs(y - prevY);
      barsXml += `
        <!-- Dotted connector line from prev step -->
        <line x1="${x - colWidth * 0.15}" y1="${prevY}" x2="${x}" y2="${prevY}" stroke="currentColor" stroke-opacity="0.25" stroke-dasharray="2,2" />
        <!-- Drop step bar -->
        <rect x="${x}" y="${topY}" width="${w}" height="${Math.max(3, diffH)}" rx="3" fill="#0284c7" fill-opacity="0.75" />
        <text x="${x + w / 2}" y="${y + (y > prevY ? 14 : -6)}" font-size="${compact ? 9 : 10}" font-weight="600" fill="currentColor" opacity="0.85" text-anchor="middle">${st.dbm.toFixed(1)}</text>
        ${st.loss > 0 ? `<text x="${x + w / 2}" y="${topY + diffH / 2 + 3}" font-size="${compact ? 8 : 9}" font-weight="700" fill="#ffffff" text-anchor="middle">-${st.loss.toFixed(1)}</text>` : ''}
      `;
    }

    prevY = y;

    // X-axis stage labels
    barsXml += `
      <text x="${x + w / 2}" y="${height - padBottom + (compact ? 14 : 18)}" font-size="${compact ? 8 : 10}" fill="currentColor" opacity="0.7" text-anchor="middle">${st.name}</text>
    `;
  }

  // Horizontal reference gridlines (Power in dBm)
  let gridXml = '';
  for (let pDbm = -30; pDbm <= 10; pDbm += 10) {
    const y = scaleY(pDbm);
    gridXml += `
      <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="3,3" />
      <text x="${padLeft - 8}" y="${y + 4}" font-size="${compact ? 8 : 10}" fill="currentColor" opacity="0.6" text-anchor="end">${pDbm}</text>
    `;
  }

  // Sensitivity floor reference line
  const sensY = scaleY(b.rxSensitivityDbm);
  const sensLineXml = `
    <line x1="${padLeft}" y1="${sensY}" x2="${width - padRight}" y2="${sensY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,4" />
    <text x="${width - padRight - 6}" y="${sensY - 5}" font-size="${compact ? 8 : 10}" fill="#ef4444" font-weight="700" text-anchor="end">ONT Sens Floor (${b.rxSensitivityDbm} dBm)</text>
  `;

  // Status color badge
  const statusColor = b.evaluation.pass ? (b.headroomMarginDb >= 4.0 ? '#10b981' : '#0284c7') : (b.headroomMarginDb >= 0 ? '#f59e0b' : '#ef4444');

  return `
    <svg class="optical-budget-svg" viewBox="0 0 ${width} ${height}" width="100%" style="height: auto; max-width: 100%; display: block;" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Optical Link Budget Waterfall Power Chart">
      <!-- Background -->
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="transparent" />

      <!-- Grids and Reference lines -->
      ${gridXml}
      ${sensLineXml}

      <!-- Waterfall Bars -->
      ${barsXml}

      <!-- Axis title -->
      <text x="${padLeft}" y="${padTop - 12}" font-size="${compact ? 8 : 10}" font-weight="700" fill="currentColor" opacity="0.8">Optical Power (dBm)</text>

      <!-- Headroom Margin Callout -->
      <g transform="translate(${width - padRight - (compact ? 130 : 160)}, ${padTop - 15})">
        <rect x="0" y="0" width="${compact ? 130 : 160}" height="${compact ? 22 : 26}" rx="4" fill="${statusColor}" fill-opacity="0.15" stroke="${statusColor}" stroke-width="1" />
        <text x="${compact ? 65 : 80}" y="${compact ? 15 : 17}" font-size="${compact ? 9 : 11}" font-weight="700" fill="${statusColor}" text-anchor="middle">
          Margin: +${b.headroomMarginDb} dB
        </text>
      </g>
    </svg>
  `.trim();
}

/**
 * Generates formatted WhatsApp dispatch report.
 */
export function generateOpticalBudgetWhatsAppReport(budgetResult, {
  customerName = 'Shahdara Subscriber',
  poleLocation = 'Pole #14, Main Road',
  technicianName = 'Field Lineman'
} = {}) {
  const b = budgetResult || calculateOpticalLinkBudget();
  const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });

  const lines = [
    `*SHAHDARA FIBER NET · OPTICAL LINK BUDGET REPORT* 📡⚡`,
    `----------------------------------------`,
    `📅 *Date & Time:* ${dateStr} at ${timeStr}`,
    `👤 *Technician:* ${technicianName}`,
    `🏢 *Location / Pole:* ${poleLocation}`,
    `🎯 *Customer / Feeder:* ${customerName}`,
    `----------------------------------------`,
    `📶 *PON Standard:* ${b.standard.name}`,
    `⚡ *Wavelength:* ${b.wavelengthNm} nm`,
    `📏 *Fiber Distance:* ${b.distanceMeters} m (${b.distanceKm} km)`,
    `🔘 *Tx OLT Launch:* +${b.txPowerDbm.toFixed(1)} dBm`,
    `----------------------------------------`,
    `*LINK LOSS BREAKDOWN:*`,
    `• Fiber Span Loss: -${b.fiberLossDb.toFixed(2)} dB`,
    `• Primary Splitter (${b.primarySplitter}): -${b.primarySplitterLossDb.toFixed(2)} dB`,
    `• Secondary Splitter (${b.secondarySplitter}): -${b.secondarySplitterLossDb.toFixed(2)} dB`,
    `• Splices (${b.jointLoss.fusionCount} fusion, ${b.jointLoss.mechanicalCount} mech): -${(b.jointLoss.fusionLossDb + b.jointLoss.mechanicalLossDb).toFixed(2)} dB`,
    `• SC/APC Connectors (${b.jointLoss.connectorPairsCount} pairs): -${b.jointLoss.connectorLossDb.toFixed(2)} dB`,
    `👉 *Total Link Attenuation:* -${b.totalAttenuationDb.toFixed(2)} dB`,
    `----------------------------------------`,
    `*CUSTOMER ONT RECEPTION VERIFICATION:*`,
    `📥 *Expected Rx Power:* ${b.expectedRxPowerDbm.toFixed(2)} dBm`,
    `📊 *ONT Sensitivity Floor:* ${b.rxSensitivityDbm.toFixed(1)} dBm`,
    `🛡️ *Optical Headroom Margin:* +${b.headroomMarginDb.toFixed(2)} dB`,
    `🚦 *Certification Status:* ${b.evaluation.pass ? '✅ PASS' : '❌ DEFICIT / WARNING'} (${b.evaluation.id})`,
    `ℹ️ *Note:* ${b.evaluation.desc}`,
    `----------------------------------------`,
    `_Offline generated via Shahdara ISP Billing & Field Crew Portal_`
  ];

  return lines.join('\n');
}

/**
 * Initializes and wires the field technician optical budget modal.
 */
export function setupMobileOpticalBudgetModal({
  onToast,
  storage = (typeof window !== 'undefined' ? window.localStorage : null)
} = {}) {
  const modal = document.getElementById('mobileOpticalBudgetModal');
  const closeBtn = document.getElementById('mobileOpticalBudgetModalCloseBtn');

  // Trigger buttons
  const triggers = document.querySelectorAll('[data-open-optical-budget]');

  // Form inputs
  const presetSelect = document.getElementById('opticalBudgetPresetSelect');
  const standardSelect = document.getElementById('opticalBudgetStandardSelect');
  const wavelengthSelect = document.getElementById('opticalBudgetWavelengthSelect');
  const distanceInput = document.getElementById('opticalBudgetDistanceInput');
  const primarySplitterSelect = document.getElementById('opticalBudgetPrimarySplitterSelect');
  const secondarySplitterSelect = document.getElementById('opticalBudgetSecondarySplitterSelect');
  const fusionSpliceInput = document.getElementById('opticalBudgetFusionSpliceInput');
  const mechSpliceInput = document.getElementById('opticalBudgetMechSpliceInput');
  const connPairsInput = document.getElementById('opticalBudgetConnPairsInput');
  const txPowerInput = document.getElementById('opticalBudgetTxPowerInput');

  // Display outputs
  const kpiRxPower = document.getElementById('opticalBudgetKpiRxPower');
  const kpiMargin = document.getElementById('opticalBudgetKpiMargin');
  const kpiTotalLoss = document.getElementById('opticalBudgetKpiTotalLoss');
  const kpiStatus = document.getElementById('opticalBudgetKpiStatus');
  const chartWrap = document.getElementById('opticalBudgetChartWrap');

  // Action buttons
  const saveRecordBtn = document.getElementById('opticalBudgetSaveRecordBtn');
  const whatsappReportBtn = document.getElementById('opticalBudgetWhatsAppReportBtn');
  const resetFormBtn = document.getElementById('opticalBudgetResetBtn');
  const clearHistoryBtn = document.getElementById('opticalBudgetClearHistoryBtn');
  const historyListEl = document.getElementById('opticalBudgetHistoryList');

  function getFormValues() {
    return {
      ponStandardId: standardSelect ? standardSelect.value : 'GPON_CLASS_B_PLUS',
      wavelengthNm: wavelengthSelect ? wavelengthSelect.value : '1490',
      distanceMeters: distanceInput ? Number(distanceInput.value) || 2500 : 2500,
      primarySplitter: primarySplitterSelect ? primarySplitterSelect.value : '1:8',
      secondarySplitter: secondarySplitterSelect ? secondarySplitterSelect.value : '1:8',
      fusionSplices: fusionSpliceInput ? Number(fusionSpliceInput.value) || 3 : 3,
      mechanicalSplices: mechSpliceInput ? Number(mechSpliceInput.value) || 0 : 0,
      connectorPairs: connPairsInput ? Number(connPairsInput.value) || 2 : 2,
      customTxPowerDbm: txPowerInput && txPowerInput.value ? Number(txPowerInput.value) : null
    };
  }

  function renderHistory() {
    if (!historyListEl) return;
    const records = getOpticalBudgetStore(storage);
    if (records.length === 0) {
      historyListEl.innerHTML = `<li class="history-item-empty">No saved optical link budget calculations yet.</li>`;
      return;
    }

    historyListEl.innerHTML = records.map(r => `
      <li class="history-item">
        <div class="history-item-header">
          <strong>${r.feederName || 'Link Budget'} · ${r.distanceMeters}m</strong>
          <span class="sim-delta-badge ${r.evaluation.pass ? 'badge-success' : 'badge-danger'}">${r.evaluation.id}</span>
        </div>
        <div class="history-item-body">
          <span>Expected Rx: <strong>${r.expectedRxPowerDbm} dBm</strong></span> | 
          <span>Margin: <strong>+${r.headroomMarginDb} dB</strong></span> | 
          <span>Loss: <strong>-${r.totalAttenuationDb} dB</strong></span>
        </div>
        <div class="history-item-sub">
          <small>${new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Split: ${r.primarySplitter} / ${r.secondarySplitter}</small>
        </div>
      </li>
    `).join('');
  }

  function updateView() {
    const vals = getFormValues();
    const result = calculateOpticalLinkBudget(vals);

    if (kpiRxPower) {
      kpiRxPower.textContent = `${result.expectedRxPowerDbm.toFixed(2)} dBm`;
      kpiRxPower.style.color = result.evaluation.pass ? '#10b981' : '#ef4444';
    }
    if (kpiMargin) {
      kpiMargin.textContent = `+${result.headroomMarginDb.toFixed(2)} dB`;
      kpiMargin.style.color = result.headroomMarginDb >= 4.0 ? '#10b981' : result.headroomMarginDb >= 1.5 ? '#0284c7' : '#f59e0b';
    }
    if (kpiTotalLoss) {
      kpiTotalLoss.textContent = `-${result.totalAttenuationDb.toFixed(2)} dB`;
    }
    if (kpiStatus) {
      kpiStatus.textContent = result.evaluation.id.replace(/_/g, ' ');
      kpiStatus.className = `sim-delta-badge ${result.evaluation.badgeClass}`;
    }
    if (chartWrap) {
      chartWrap.innerHTML = renderMobileOpticalBudgetSvg(result, { compact: false });
    }
  }

  function populatePreset(presetId) {
    const p = SHAHDARA_FEEDER_PRESETS.find(x => x.id === presetId);
    if (!p) return;
    if (standardSelect) standardSelect.value = p.standardId;
    if (distanceInput) distanceInput.value = p.defaultDistanceM;
    if (primarySplitterSelect) primarySplitterSelect.value = p.primarySplitter;
    if (secondarySplitterSelect) secondarySplitterSelect.value = p.secondarySplitter;
    if (fusionSpliceInput) fusionSpliceInput.value = p.fusionSplices;
    if (mechSpliceInput) mechSpliceInput.value = p.mechanicalSplices;
    if (connPairsInput) connPairsInput.value = p.connectorPairs;
    updateView();
  }

  // Bind inputs
  const allInputs = [standardSelect, wavelengthSelect, distanceInput, primarySplitterSelect, secondarySplitterSelect, fusionSpliceInput, mechSpliceInput, connPairsInput, txPowerInput];
  allInputs.forEach(el => {
    if (el) {
      el.addEventListener('input', updateView);
      el.addEventListener('change', updateView);
    }
  });

  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      populatePreset(e.target.value);
    });
  }

  if (resetFormBtn) {
    resetFormBtn.addEventListener('click', () => {
      if (presetSelect) presetSelect.value = 'PRESET_SHAHDARA_TOWN';
      populatePreset('PRESET_SHAHDARA_TOWN');
      if (typeof onToast === 'function') onToast('Link budget form reset to Shahdara Town preset.');
    });
  }

  if (saveRecordBtn) {
    saveRecordBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const result = calculateOpticalLinkBudget(vals);
      const presetObj = presetSelect ? SHAHDARA_FEEDER_PRESETS.find(p => p.id === presetSelect.value) : null;
      recordOpticalBudgetCalculation({
        ...result,
        feederName: presetObj ? presetObj.name : 'Custom Feeder Link'
      }, storage);
      renderHistory();
      if (typeof onToast === 'function') onToast('Optical link budget record saved to device.');
    });
  }

  if (whatsappReportBtn) {
    whatsappReportBtn.addEventListener('click', () => {
      const vals = getFormValues();
      const result = calculateOpticalLinkBudget(vals);
      const presetObj = presetSelect ? SHAHDARA_FEEDER_PRESETS.find(p => p.id === presetSelect.value) : null;
      const text = generateOpticalBudgetWhatsAppReport(result, {
        customerName: presetObj ? presetObj.name : 'Shahdara Subscriber',
        poleLocation: presetObj ? presetObj.area : 'Field Feeder Pole'
      });
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
      if (typeof onToast === 'function') onToast('WhatsApp link budget dispatch opened.');
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      clearOpticalBudgetStore(storage);
      renderHistory();
      if (typeof onToast === 'function') onToast('Saved link budget history cleared.');
    });
  }

  // Trigger modal open
  triggers.forEach(btn => {
    btn.addEventListener('click', () => {
      updateView();
      renderHistory();
      if (modal) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
    });
  });

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    });
  }

  // Initial render
  updateView();
  renderHistory();

  return {
    updateView,
    renderHistory,
    calculate: (vals) => calculateOpticalLinkBudget(vals)
  };
}
